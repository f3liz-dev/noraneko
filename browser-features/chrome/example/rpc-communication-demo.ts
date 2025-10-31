// SPDX-License-Identifier: MPL-2.0
// This file demonstrates how to use the RPC registry for inter-module communication

import { noraComponent, NoraComponentBase } from "#features-chrome/utils/base";
import type { RPCDependencies } from "#features-chrome/common/rpc-interfaces.ts";

/**
 * Example Module A - Provider
 * This module exposes RPC methods that other modules can call
 */
@noraComponent(import.meta.hot)
export class ModuleA extends NoraComponentBase {
  // Type-safe RPC access (this module has no dependencies)
  protected rpc!: RPCDependencies<[]>;

  // Private state
  private data = "initial value";

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
 * Example Module B - Consumer (NEW PATTERN)
 * This module calls RPC methods on Module A using this.rpc
 */
@noraComponent(import.meta.hot)
export class ModuleB extends NoraComponentBase {
  // Type-safe RPC access to module-a
  // Since module-a is in softDependencies, calls will return undefined if not available
  protected rpc!: RPCDependencies<["module-a"]>;

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
    // NEW PATTERN: Clean, type-safe RPC calls via this.rpc
    // IDE autocomplete will work here!
    
    console.log("=== Demonstrating new this.rpc pattern ===");
    
    // Call getData - type-safe, returns string | undefined
    const data = await this.rpc["module-a"].getData();
    if (data) {
      console.log("ModuleB: Received data from ModuleA:", data);
    } else {
      console.log("ModuleB: ModuleA not available, continuing without it");
    }

    // Call setData
    await this.rpc["module-a"].setData("new value from ModuleB");
    
    // Call performAction
    const result = await this.rpc["module-a"].performAction("test-action");
    console.log("ModuleB: Action result:", result || "No result (module not available)");
    
    // Get updated data
    const updatedData = await this.rpc["module-a"].getData();
    console.log("ModuleB: Updated data:", updatedData || "No data");
  }

  private notifyModuleB(message: string): void {
    console.log("ModuleB: Received notification:", message);
  }
}

/**
 * Example Module C - No Dependencies
 * This module demonstrates a module that doesn't use RPC at all
 */
@noraComponent(import.meta.hot)
export class ModuleC extends NoraComponentBase {
  protected rpc!: RPCDependencies<[]>;

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
 * Key Benefits of the new this.rpc pattern:
 * 
 * 1. ✅ Clean syntax: `this.rpc.sidebar.registerIcon(...)` 
 *    vs old: `getSoftModuleProxy<SidebarRPC>("sidebar").registerIcon(...)`
 * 
 * 2. ✅ Type-safe: IDE autocomplete works automatically
 *    Just declare: `protected rpc!: RPCDependencies<["sidebar", "other"]>`
 * 
 * 3. ✅ Automatic setup: RPC proxies created in NoraComponentBase constructor
 *    based on dependencies/softDependencies in metadata
 * 
 * 4. ✅ Consistent pattern: All modules use the same `this.rpc.moduleName.method()` pattern
 * 
 * 5. ✅ Still graceful: Soft dependencies return undefined if module not loaded
 *    Hard dependencies throw errors if module not available
 * 
 * To add a new module with RPC:
 * 
 * 1. Add its RPC interface to common/rpc-interfaces.ts
 * 2. Update ModuleRPCInterfaces mapping
 * 3. Declare `protected rpc!: RPCDependencies<["dependency-name"]>` in your class
 * 4. Use `this.rpc["dependency-name"].method()` to call RPC methods
 * 5. Add softDependencies or dependencies in _metadata()
 */
