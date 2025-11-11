// SPDX-License-Identifier: MPL-2.0

import * as E from "fp-ts/Either";

/**
 * EventDispatcher Registry
 * Provides event dispatcher instances to modules via this.events
 * All methods return Either<Error, T> for error safety
 * 
 * Note: Payloads don't need to be serializable as everything runs in one process.
 * This is an event dispatching system, not traditional RPC.
 */
class EventDispatcherRegistry {
  private static instance: EventDispatcherRegistry | null = null;
  
  // Map of module name to their event dispatcher instances
  private modules: Map<string, any> = new Map();

  private constructor() {}

  static getInstance(): EventDispatcherRegistry {
    if (!EventDispatcherRegistry.instance) {
      EventDispatcherRegistry.instance = new EventDispatcherRegistry();
    }
    return EventDispatcherRegistry.instance;
  }

  /**
   * Register a module's event dispatcher interface
   * @param moduleName - Name of the module
   * @param functions - Object containing the module's event handler functions
   */
  registerModule<T extends Record<string, any>>(
    moduleName: string,
    functions: T
  ): void {
    if (this.modules.has(moduleName)) {
      console.warn(`[EventDispatcher] Module ${moduleName} is already registered, replacing...`);
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
    console.debug(`[EventDispatcher] Registered module: ${moduleName}`);
  }

  /**
   * Unregister a module's event dispatcher interface
   * @param moduleName - Name of the module to unregister
   */
  unregisterModule(moduleName: string): void {
    this.modules.delete(moduleName);
    console.debug(`[EventDispatcher] Unregistered module: ${moduleName}`);
  }

  /**
   * Get the event dispatcher instance for a module
   * Returns the actual event handler functions, or a soft proxy for missing modules
   * @param moduleName - Name of the module
   * @returns The event dispatcher instance with Either-wrapped methods
   */
  getEventDispatcherInstance(moduleName: string): any {
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
export const eventDispatcherRegistry = EventDispatcherRegistry.getInstance();

// Export only the functions needed for this.events pattern
export function registerModuleEventDispatcher<T extends Record<string, any>>(
  moduleName: string,
  functions: T
): void {
  eventDispatcherRegistry.registerModule(moduleName, functions);
}

export function unregisterModuleEventDispatcher(moduleName: string): void {
  eventDispatcherRegistry.unregisterModule(moduleName);
}

export function isModuleRegistered(moduleName: string): boolean {
  return eventDispatcherRegistry.isModuleRegistered(moduleName);
}

/**
 * Create a typed event dispatcher object for module dependencies
 * Returns real event dispatcher instances with Either-wrapped methods
 * All dependencies (both hard and soft) handled the same way with Either
 * @param dependencies - Array of all dependency module names
 * @returns Object with event dispatcher instances for each dependency
 */
export function createDependencyEventDispatchers<T extends Record<string, any>>(
  dependencies: string[]
): T {
  const eventsObject: any = {};
  
  // Add all dependencies - Either handles both available and missing modules
  for (const dep of dependencies) {
    Object.defineProperty(eventsObject, dep, {
      get: () => eventDispatcherRegistry.getEventDispatcherInstance(dep),
      enumerable: true,
      configurable: false,
    });
  }
  
  return eventsObject as T;
}
