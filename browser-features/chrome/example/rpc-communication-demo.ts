// SPDX-License-Identifier: MPL-2.0
// This file demonstrates how to use the RPC registry for inter-module communication
// with automatic type inference

import { noraComponent, NoraComponentBase } from "#features-chrome/utils/base";
import type { RPCDependenciesWithSoft } from "#features-chrome/common/rpc-interfaces.ts";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";

/**
 * Example Module A - Provider
 * This module exposes RPC methods that other modules can call
 * Types are automatically inferred - no manual interface needed!
 */
@noraComponent(import.meta.hot)
export class ModuleA extends NoraComponentBase {
  // No dependencies
  protected rpc!: RPCDependenciesWithSoft<[], []>;

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
      // Define RPC methods - types are automatically inferred!
      rpcMethods: {
        getData: () => this.getData(),
        setData: (value: string) => this.setData(value),
        performAction: (action: string) => this.performAction(action),
      },
    } as const;
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
    await new Promise(resolve => setTimeout(resolve, 100));
    return `Performed: ${action}`;
  }
}

// Register in global registry for automatic type inference
declare global {
  interface FeatureModuleRegistry {
    ModuleA: typeof ModuleA;
  }
}

/**
 * Example Module B - Consumer
 * This module calls RPC methods on Module A
 * Types are automatically inferred from ModuleA's metadata!
 */
@noraComponent(import.meta.hot)
export class ModuleB extends NoraComponentBase {
  // Type-safe RPC access - types automatically inferred from module-a!
  // No manual interface declaration needed
  protected rpc!: RPCDependenciesWithSoft<[], ["module-a"]>;

  init() {
    console.log("ModuleB initialized");
    this.demonstrateRPCCalls();
  }

  _metadata() {
    return {
      moduleName: "module-b",
      dependencies: [],
      softDependencies: ["module-a"],
      rpcMethods: {
        notifyModuleB: (message: string) => this.notifyModuleB(message),
      },
    } as const;
  }

  private async demonstrateRPCCalls() {
    console.log("=== Demonstrating automatic type inference with Either ===");
    
    // All types are automatically inferred!
    // IDE autocomplete works perfectly
    
    // Call getData - returns Either<Error, string | undefined> (soft dependency)
    const dataResult = await this.rpc["module-a"].getData();
    
    pipe(
      dataResult,
      E.fold(
        (error) => console.error("Failed to get data:", error),
        (data) => {
          if (data === undefined) {
            console.log("ModuleA not available");
          } else {
            console.log("ModuleB: Received data from ModuleA:", data);
          }
        }
      )
    );

    // Call setData - types inferred automatically!
    const setResult = await this.rpc["module-a"].setData("new value");
    
    pipe(
      setResult,
      E.fold(
        (error) => console.error("Failed to set data:", error),
        () => console.log("Data set successfully")
      )
    );
    
    // Call performAction - return type automatically inferred as string
    const actionResult = await this.rpc["module-a"].performAction("test");
    
    pipe(
      actionResult,
      E.fold(
        (error) => console.error("Failed to perform action:", error),
        (result) => console.log("Action result:", result || "No result")
      )
    );
  }

  private notifyModuleB(message: string): void {
    console.log("ModuleB: Received notification:", message);
  }
}

// Register in global registry
declare global {
  interface FeatureModuleRegistry {
    ModuleB: typeof ModuleB;
  }
}

/**
 * Key Benefits of Automatic Type Inference:
 * 
 * 1. ✅ **No Manual Interface Declarations**: Types extracted from rpcMethods
 * 2. ✅ **Type Safety**: Full TypeScript checking on method signatures
 * 3. ✅ **IDE Autocomplete**: Works perfectly with inferred types
 * 4. ✅ **Error Safety**: Either<Error, T> for all RPC calls
 * 5. ✅ **DRY**: Single source of truth (the rpcMethods object)
 * 6. ✅ **Refactoring Safe**: Change rpcMethods, types update automatically
 * 
 * How it works:
 * 
 * 1. Module defines rpcMethods in _metadata()
 * 2. Module registers in FeatureModuleRegistry via declaration merging
 * 3. TypeScript extracts types from rpcMethods automatically
 * 4. RPCDependencies type creates typed proxy based on module name
 * 5. All wrapped with Either for error safety
 * 
 * No .d.ts generation needed - pure TypeScript type system!
 */
