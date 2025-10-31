// SPDX-License-Identifier: MPL-2.0

import { createBirpc } from "birpc";

/**
 * Interface for RPC channel configuration
 */
interface RPCChannelConfig {
  post: (data: any) => void;
  on: (fn: (data: any) => void) => void;
  serialize?: (v: any) => any;
  deserialize?: (v: any) => any;
}

/**
 * Central registry for module RPC communication.
 * Modules can register RPC interfaces and call methods on other modules
 * without direct dependencies. If a module is not loaded or fails,
 * RPC calls will gracefully fail without panicking.
 */
class RPCRegistry {
  private static instance: RPCRegistry | null = null;
  private static readonly DEFAULT_TIMEOUT_MS = 5000;
  
  // Map of module name to their RPC instances
  private modules: Map<string, any> = new Map();
  
  // Map of module name to message handlers
  private messageHandlers: Map<string, Set<(data: any) => void>> = new Map();
  
  // Map of pending RPC calls waiting for modules to be registered
  private pendingCalls: Map<string, Array<{ method: string; args: any[]; resolve: (v: any) => void; reject: (e: any) => void }>> = new Map();

  private constructor() {}

  static getInstance(): RPCRegistry {
    if (!RPCRegistry.instance) {
      RPCRegistry.instance = new RPCRegistry();
    }
    return RPCRegistry.instance;
  }

  /**
   * Register a module's RPC interface
   * @param moduleName - Name of the module
   * @param functions - Object containing the module's RPC functions
   */
  registerModule<T extends Record<string, any>>(
    moduleName: string,
    functions: T
  ): void {
    if (this.modules.has(moduleName)) {
      console.warn(`[RPC] Module ${moduleName} is already registered, replacing...`);
    }

    // Create RPC channel configuration for this module
    const channelConfig: RPCChannelConfig = {
      post: (data: any) => {
        // Send data to all handlers listening to this module
        const handlers = this.messageHandlers.get(moduleName);
        if (handlers) {
          handlers.forEach(handler => {
            try {
              handler(data);
            } catch (e) {
              console.error(`[RPC] Error in message handler for ${moduleName}:`, e);
            }
          });
        }
      },
      on: (fn: (data: any) => void) => {
        // Register message handler for incoming messages
        if (!this.messageHandlers.has(moduleName)) {
          this.messageHandlers.set(moduleName, new Set());
        }
        this.messageHandlers.get(moduleName)!.add(fn);
      },
      serialize: (v) => v,
      deserialize: (v) => v,
    };

    // Create birpc instance for this module
    const rpc = createBirpc(functions, channelConfig);
    this.modules.set(moduleName, rpc);

    console.debug(`[RPC] Registered module: ${moduleName}`);

    // Process any pending calls for this module
    this.processPendingCalls(moduleName);
  }

  /**
   * Unregister a module's RPC interface
   * @param moduleName - Name of the module to unregister
   */
  unregisterModule(moduleName: string): void {
    this.modules.delete(moduleName);
    this.messageHandlers.delete(moduleName);
    console.debug(`[RPC] Unregistered module: ${moduleName}`);
  }

  /**
   * Call an RPC method on a remote module
   * @param targetModule - Name of the target module
   * @param method - Method name to call
   * @param args - Arguments to pass to the method
   * @returns Promise that resolves with the method result or rejects if the module is not available
   */
  async call<T = any>(
    targetModule: string,
    method: string,
    ...args: any[]
  ): Promise<T> {
    const moduleRpc = this.modules.get(targetModule);

    if (!moduleRpc) {
      // Module not registered yet - add to pending calls with timeout
      console.debug(`[RPC] Module ${targetModule} not ready, queueing call to ${method}`);
      
      return new Promise<T>((resolve, reject) => {
        // Queue the call
        if (!this.pendingCalls.has(targetModule)) {
          this.pendingCalls.set(targetModule, []);
        }
        this.pendingCalls.get(targetModule)!.push({
          method,
          args,
          resolve,
          reject,
        });

        // Set timeout to reject if module doesn't become available
        setTimeout(() => {
          const pending = this.pendingCalls.get(targetModule);
          if (pending) {
            const callIndex = pending.findIndex(
              c => c.resolve === resolve
            );
            if (callIndex !== -1) {
              pending.splice(callIndex, 1);
              reject(
                new Error(
                  `[RPC] Timeout: Module ${targetModule} not available for method ${method}`
                )
              );
            }
          }
        }, RPCRegistry.DEFAULT_TIMEOUT_MS);
      });
    }

    // Module is registered, make the call
    if (typeof moduleRpc[method] === "function") {
      try {
        return await moduleRpc[method](...args);
      } catch (e) {
        console.error(`[RPC] Error calling ${targetModule}.${method}:`, e);
        throw e;
      }
    } else {
      throw new Error(
        `[RPC] Method ${method} not found on module ${targetModule}`
      );
    }
  }

  /**
   * Try to call an RPC method, but don't throw if it fails
   * @param targetModule - Name of the target module
   * @param method - Method name to call
   * @param args - Arguments to pass to the method
   * @returns Promise that resolves with the result or undefined if failed
   */
  async tryCall<T = any>(
    targetModule: string,
    method: string,
    ...args: any[]
  ): Promise<T | undefined> {
    try {
      return await this.call<T>(targetModule, method, ...args);
    } catch (e) {
      console.debug(
        `[RPC] Soft call to ${targetModule}.${method} failed (this is ok):`,
        e
      );
      return undefined;
    }
  }

  /**
   * Check if a module is registered
   * @param moduleName - Name of the module to check
   * @returns true if the module is registered
   */
  isModuleRegistered(moduleName: string): boolean {
    return this.modules.has(moduleName);
  }

  /**
   * Process pending RPC calls for a newly registered module
   * @param moduleName - Name of the module that was just registered
   */
  private processPendingCalls(moduleName: string): void {
    const pending = this.pendingCalls.get(moduleName);
    if (!pending || pending.length === 0) {
      return;
    }

    console.debug(`[RPC] Processing ${pending.length} pending calls for ${moduleName}`);

    // Process all pending calls
    for (const call of pending) {
      this.call(moduleName, call.method, ...call.args)
        .then(call.resolve)
        .catch(call.reject);
    }

    // Clear pending calls for this module
    this.pendingCalls.delete(moduleName);
  }

  /**
   * Send a direct message to a module (bypassing RPC)
   * This is useful for broadcasting events
   * @param targetModule - Name of the target module
   * @param data - Data to send
   */
  sendMessage(targetModule: string, data: any): void {
    const handlers = this.messageHandlers.get(targetModule);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (e) {
          console.error(`[RPC] Error sending message to ${targetModule}:`, e);
        }
      });
    }
  }

  /**
   * Get a proxy object for calling methods on a remote module
   * @param targetModule - Name of the target module
   * @returns Proxy object that forwards method calls to the RPC system
   */
  getProxy<T extends Record<string, any>>(targetModule: string): T {
    return new Proxy({} as T, {
      get: (_target, prop: string) => {
        if (typeof prop === "string") {
          return (...args: any[]) => this.call(targetModule, prop, ...args);
        }
        return undefined;
      },
    });
  }

  /**
   * Get a soft proxy object that doesn't throw on errors
   * @param targetModule - Name of the target module
   * @returns Proxy object that forwards method calls and returns undefined on errors
   */
  getSoftProxy<T extends Record<string, any>>(targetModule: string): T {
    return new Proxy({} as T, {
      get: (_target, prop: string) => {
        if (typeof prop === "string") {
          return (...args: any[]) => this.tryCall(targetModule, prop, ...args);
        }
        return undefined;
      },
    });
  }
}

// Export singleton instance
export const rpcRegistry = RPCRegistry.getInstance();

// Export helper functions
export function registerModuleRPC<T extends Record<string, any>>(
  moduleName: string,
  functions: T
): void {
  rpcRegistry.registerModule(moduleName, functions);
}

export function unregisterModuleRPC(moduleName: string): void {
  rpcRegistry.unregisterModule(moduleName);
}

export function callModuleRPC<T = any>(
  targetModule: string,
  method: string,
  ...args: any[]
): Promise<T> {
  return rpcRegistry.call<T>(targetModule, method, ...args);
}

export function tryCallModuleRPC<T = any>(
  targetModule: string,
  method: string,
  ...args: any[]
): Promise<T | undefined> {
  return rpcRegistry.tryCall<T>(targetModule, method, ...args);
}

export function getModuleProxy<T extends Record<string, any>>(
  targetModule: string
): T {
  return rpcRegistry.getProxy<T>(targetModule);
}

export function getSoftModuleProxy<T extends Record<string, any>>(
  targetModule: string
): T {
  return rpcRegistry.getSoftProxy<T>(targetModule);
}

export function isModuleRegistered(moduleName: string): boolean {
  return rpcRegistry.isModuleRegistered(moduleName);
}
