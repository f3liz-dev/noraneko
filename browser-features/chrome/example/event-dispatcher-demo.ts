// SPDX-License-Identifier: MPL-2.0
// This file demonstrates the EventDispatcher system with automatic type inference

import { component } from "#features-chrome/utils/base";
import type { EventDispatcherDependencies } from "#features-chrome/common/event-dispatcher-interfaces.ts";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";

/**
 * Example Module A - Provider
 * Exposes event methods with automatic type inference
 * 
 * Note: Payloads don't need to be serializable as everything runs in one process.
 */
@component({
  moduleName: "module-a",
  dependencies: [],
  softDependencies: [],
  hot: import.meta.hot,
})
export class ModuleA {
  // No dependencies
  protected events!: EventDispatcherDependencies<[]>;

  private data = "initial value";

  init() {
    console.log("ModuleA initialized");
  }

  _metadata() {
    return {
      moduleName: "module-a",
      dependencies: [],
      softDependencies: [],
      eventMethods: {
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

/**
 * Example Module B - Consumer
 * Uses EventDispatcher with Either for error handling
 */
@component({
  moduleName: "module-b",
  dependencies: [],
  softDependencies: ["module-a"],
  hot: import.meta.hot,
})
export class ModuleB {
  // Simplified: no distinction between hard and soft dependencies
  // Either handles both available and missing modules
  protected events!: EventDispatcherDependencies<["module-a"]>;

  init() {
    console.log("ModuleB initialized");
    this.demonstrateEventDispatcherCalls();
  }

  _metadata() {
    return {
      moduleName: "module-b",
      dependencies: [],
      softDependencies: ["module-a"],
      eventMethods: {
        notifyModuleB: (message: string) => this.notifyModuleB(message),
      },
    } as const;
  }

  private async demonstrateEventDispatcherCalls() {
    console.log("=== EventDispatcher with Either ===");

    // All calls return Either<Error, T | undefined>
    // No distinction needed - Either handles everything!

    const dataResult = await this.events["module-a"].getData();

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
    const setResult = await this.events["module-a"].setData("new value");
    pipe(
      setResult,
      E.fold(
        (error) => console.error("Failed to set data:", error),
        () => console.log("Data set successfully"),
      ),
    );

    const actionResult = await this.events["module-a"].performAction("test");
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

/**
 * Benefits of EventDispatcher:
 *
 * 1. ✅ **Real EventDispatcher Instances**: Direct access, not proxies
 * 2. ✅ **Single Type**: EventDispatcherDependencies for all - Either handles availability
 * 3. ✅ **Clean API**: Only this.events pattern, all helpers removed
 * 4. ✅ **Error Safety**: Either<Error, T | undefined> for all cases
 * 5. ✅ **Type Inference**: Types extracted from eventMethods automatically
 * 6. ✅ **Simple**: No complex proxy chains, no hard/soft distinction
 * 7. ✅ **No Serialization**: Payloads don't need to be serializable - everything runs in one process
 * 8. ✅ **Event-Based**: Better reflects the actual usage pattern than "RPC"
 *
 * Usage:
 * 1. Define eventMethods in _metadata()
 * 2. Register module in FeatureModuleRegistry
 * 3. Use this.events.moduleName.method()
 * 4. Handle result with Either fold
 */
