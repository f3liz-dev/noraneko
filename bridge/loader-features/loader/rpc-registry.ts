// SPDX-License-Identifier: MPL-2.0

import * as E from "fp-ts/Either";

/**
 * Simplified RPC Registry
 * Provides real RPC instances to modules via this.rpc
 * All methods return Either<Error, T> for error safety
 */
class RPCRegistry {
  private static instance: RPCRegistry | null = null;
  
  // Map of module name to their RPC instances
  private modules: Map<string, any> = new Map();

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

    // Wrap all functions with Either for error safety
    const wrappedFunctions: any = {};
    for (const [key, fn] of Object.entries(functions)) {
      if (typeof fn === 'function') {
        wrappedFunctions[key] = async (...args: any[]) => {
          try {
            const result = await fn(...args);
            return E.right(result);
          } catch (error) {
            return E.left(error instanceof Error ? error : new Error(String(error)));
          }
        };
      }
    }

    this.modules.set(moduleName, wrappedFunctions);
    console.debug(`[RPC] Registered module: ${moduleName}`);
  }

  /**
   * Unregister a module's RPC interface
   * @param moduleName - Name of the module to unregister
   */
  unregisterModule(moduleName: string): void {
    this.modules.delete(moduleName);
    console.debug(`[RPC] Unregistered module: ${moduleName}`);
  }

  /**
   * Get the RPC instance for a module
   * Returns the actual RPC functions, or a soft proxy for missing modules
   * @param moduleName - Name of the module
   * @returns The RPC instance with Either-wrapped methods
   */
  getRPCInstance(moduleName: string): any {
    const instance = this.modules.get(moduleName);
    if (instance) {
      return instance;
    }
    
    // Return a soft proxy that returns Either<Error, undefined> for missing modules
    return new Proxy({}, {
      get: () => {
        return async () => E.right(undefined);
      }
    });
  }

  /**
   * Check if a module is registered
   * @param moduleName - Name of the module to check
   * @returns true if the module is registered
   */
  isModuleRegistered(moduleName: string): boolean {
    return this.modules.has(moduleName);
  }
}

// Export singleton instance
export const rpcRegistry = RPCRegistry.getInstance();

// Export only the functions needed for this.rpc pattern
export function registerModuleRPC<T extends Record<string, any>>(
  moduleName: string,
  functions: T
): void {
  rpcRegistry.registerModule(moduleName, functions);
}

export function unregisterModuleRPC(moduleName: string): void {
  rpcRegistry.unregisterModule(moduleName);
}

export function isModuleRegistered(moduleName: string): boolean {
  return rpcRegistry.isModuleRegistered(moduleName);
}

/**
 * Create a typed RPC object for module dependencies
 * Returns real RPC instances with Either-wrapped methods
 * All dependencies (both hard and soft) handled the same way with Either
 * @param dependencies - Array of all dependency module names
 * @returns Object with RPC instances for each dependency
 */
export function createDependencyRPCProxies<T extends Record<string, any>>(
  dependencies: string[]
): T {
  const rpcObject: any = {};
  
  // Add all dependencies - Either handles both available and missing modules
  for (const dep of dependencies) {
    Object.defineProperty(rpcObject, dep, {
      get: () => rpcRegistry.getRPCInstance(dep),
      enumerable: true,
      configurable: false,
    });
  }
  
  return rpcObject as T;
}
