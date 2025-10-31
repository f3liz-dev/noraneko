// SPDX-License-Identifier: MPL-2.0
// This file demonstrates the simplified RPC system with automatic type inference

import { noraComponent, NoraComponentBase } from "#features-chrome/utils/base";
import type { RPCDependencies } from "#features-chrome/common/rpc-interfaces.ts";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";

/**
 * Example Module A - Provider
 * Exposes RPC methods with automatic type inference
 */
@noraComponent(import.meta.hot)
export class ModuleA extends NoraComponentBase {
  // No dependencies
  protected rpc!: RPCDependencies<[]>;

  private data = "initial value";

  init() {
    console.log("ModuleA initialized");
  }

  _metadata() {
    return {
      moduleName: "module-a",
      dependencies: [],
      softDependencies: [],
      rpcMethods: {
        getData: () => this.getData(),
        setData: (value: string) => this.setData(value),
        performAction: (action: string) => this.performAction(action),
      },
    } as const;
  }

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
    await new Promise((resolve) => setTimeout(resolve, 100));
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
 * Uses simplified RPC with Either for error handling
 */
@noraComponent(import.meta.hot)
export class ModuleB extends NoraComponentBase {
  // Simplified: no distinction between hard and soft dependencies
  // Either handles both available and missing modules
  protected rpc!: RPCDependencies<["module-a"]>;

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
    console.log("=== Simplified RPC with Either ===");

    // All calls return Either<Error, T | undefined>
    // No distinction needed - Either handles everything!

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
        },
      ),
    );

    // All the same pattern - clean and simple!
    const setResult = await this.rpc["module-a"].setData("new value");
    pipe(
      setResult,
      E.fold(
        (error) => console.error("Failed to set data:", error),
        () => console.log("Data set successfully"),
      ),
    );

    const actionResult = await this.rpc["module-a"].performAction("test");
    pipe(
      actionResult,
      E.fold(
        (error) => console.error("Failed to perform action:", error),
        (result) => console.log("Action result:", result || "No result"),
      ),
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
 * Benefits of Simplified RPC:
 *
 * 1. ✅ **Real RPC Instances**: Direct access to birpc, not proxies
 * 2. ✅ **Single Type**: RPCDependencies for all - Either handles availability
 * 3. ✅ **Clean API**: Only this.rpc pattern, all helpers removed
 * 4. ✅ **Error Safety**: Either<Error, T | undefined> for all cases
 * 5. ✅ **Type Inference**: Types extracted from rpcMethods automatically
 * 6. ✅ **Simple**: No complex proxy chains, no hard/soft distinction
 *
 * Usage:
 * 1. Define rpcMethods in _metadata()
 * 2. Register module in FeatureModuleRegistry
 * 3. Use this.rpc.moduleName.method()
 * 4. Handle result with Either fold
 */
