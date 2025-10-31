// SPDX-License-Identifier: MPL-2.0
// This file demonstrates how to use the RPC registry for inter-module communication

import {
  registerModuleRPC,
  callModuleRPC,
  tryCallModuleRPC,
  getModuleProxy,
  getSoftModuleProxy,
} from "#bridge-loader-features/loader/modules-hooks.ts";

/**
 * Example Module A - Provider
 * This module exposes RPC methods that other modules can call
 */
export class ModuleA {
  init() {
    console.log("ModuleA initialized");
  }

  _metadata() {
    return {
      moduleName: "module-a",
      dependencies: [],
      softDependencies: [],
      // Define RPC methods that other modules can call
      rpcMethods: {
        getData: () => this.getData(),
        setData: (value: string) => this.setData(value),
        performAction: (action: string) => this.performAction(action),
      },
    };
  }

  // Private state
  private data = "initial value";

  // RPC-exposed methods
  private getData(): string {
    console.log("ModuleA: getData called");
    return this.data;
  }

  private setData(value: string): void {
    console.log("ModuleA: setData called with", value);
    this.data = value;
  }

  private async performAction(action: string): Promise<string> {
    console.log("ModuleA: performAction called with", action);
    // Simulate async work
    await new Promise(resolve => setTimeout(resolve, 100));
    return `Performed: ${action}`;
  }
}

/**
 * Example Module B - Consumer
 * This module calls RPC methods on Module A
 */
export class ModuleB {
  init() {
    console.log("ModuleB initialized");
    this.demonstrateRPCCalls();
  }

  _metadata() {
    return {
      moduleName: "module-b",
      dependencies: [], // No hard dependency on module-a
      softDependencies: ["module-a"], // Soft dependency - won't fail if module-a is missing
      // Module B can also expose its own RPC methods
      rpcMethods: {
        notifyModuleB: (message: string) => this.notifyModuleB(message),
      },
    };
  }

  private async demonstrateRPCCalls() {
    // Method 1: Direct call using callModuleRPC
    // This will throw if the module is not available
    try {
      const data = await callModuleRPC<string>("module-a", "getData");
      console.log("ModuleB: Received data from ModuleA:", data);
    } catch (e) {
      console.error("ModuleB: Failed to call ModuleA (this is expected if ModuleA is not loaded):", e);
    }

    // Method 2: Safe call using tryCallModuleRPC
    // This will return undefined if the module is not available (no exception thrown)
    const result = await tryCallModuleRPC<string>("module-a", "performAction", "test-action");
    if (result) {
      console.log("ModuleB: Action result:", result);
    } else {
      console.log("ModuleB: ModuleA not available, continuing without it");
    }

    // Method 3: Using a proxy for cleaner syntax
    interface ModuleAInterface {
      getData(): Promise<string>;
      setData(value: string): Promise<void>;
      performAction(action: string): Promise<string>;
    }

    const moduleA = getModuleProxy<ModuleAInterface>("module-a");
    try {
      await moduleA.setData("new value from ModuleB");
      const updatedData = await moduleA.getData();
      console.log("ModuleB: Updated data:", updatedData);
    } catch (e) {
      console.error("ModuleB: Proxy call failed:", e);
    }

    // Method 4: Using a soft proxy (doesn't throw on errors)
    const moduleASoft = getSoftModuleProxy<ModuleAInterface>("module-a");
    const softResult = await moduleASoft.performAction("soft-call-action");
    console.log("ModuleB: Soft call result:", softResult || "No result (module not available)");
  }

  private notifyModuleB(message: string): void {
    console.log("ModuleB: Received notification:", message);
  }
}

/**
 * Example Module C - No Dependencies
 * This module demonstrates a module that doesn't use RPC at all
 */
export class ModuleC {
  init() {
    console.log("ModuleC initialized - this module works independently");
  }

  _metadata() {
    return {
      moduleName: "module-c",
      dependencies: [],
      softDependencies: [],
      // No RPC methods exposed
    };
  }
}

/**
 * Best Practices:
 * 
 * 1. Use tryCallModuleRPC or getSoftModuleProxy for soft dependencies
 *    - These won't throw exceptions if the target module is missing
 *    - Perfect for optional features
 * 
 * 2. Use callModuleRPC or getModuleProxy for hard dependencies
 *    - These will throw if the target module is not available
 *    - Use with modules listed in the "dependencies" array
 * 
 * 3. Define RPC methods in _metadata().rpcMethods
 *    - This makes it clear what the module exposes
 *    - The loader will automatically register these methods
 * 
 * 4. Avoid Services.obs for module-to-module communication
 *    - Use the RPC system instead
 *    - Services.obs should only be used for browser-internal events
 * 
 * 5. Don't import other modules directly
 *    - Use RPC calls instead of direct imports
 *    - This prevents tight coupling and circular dependencies
 * 
 * 6. Handle missing modules gracefully
 *    - Always consider that a soft dependency might not be loaded
 *    - Provide fallback behavior when optional modules are missing
 */
