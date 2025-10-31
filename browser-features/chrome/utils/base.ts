// SPDX-License-Identifier: MPL-2.0

import { ViteHotContext } from "vite/types/hot";
import { kebabCase } from "es-toolkit/string";
import type { ClassDecorator } from "./decorator";
import { createRootHMR } from "@nora/solid-xul";
import { onCleanup } from "solid-js";
import { createDependencyRPCProxies } from "#bridge-loader-features/loader/modules-hooks.ts";

// U+2063 before `@` needed
//https://github.com/microsoft/TypeScript/issues/47679

/**
 * @exmaple ```ts
 * ⁣@noraComponent(import.meta.hot)
 * class FooBar extends NoraComponentBase {}
 * ```
 * @see {@link file://./../../vite.config.ts vite.config.ts} noraneko_component_hmr_support
 */
export function noraComponent(
  aViteHotContext: ViteHotContext | undefined,
): ClassDecorator<NoraComponentBase> {
  return (clazz, ctx) => {
    if (_NoraComponentBase_viteHotContext.has(ctx.name!)) {
      throw new Error(`Duplicate NoraComponent Name: ${ctx.name}`);
    }

    _NoraComponentBase_viteHotContext.set(ctx.name!, aViteHotContext);
    console.debug("[nora@base] noraComponent " + ctx.name);
  };
}

const nora_component_base_console = console.createInstance({
  prefix: `nora@nora-component-base`,
});

let _NoraComponentBase_viteHotContext = new Map<
  string,
  ViteHotContext | undefined
>();

/**
 * Base class for all Noraneko components
 * Provides RPC access to dependencies via this.rpc
 */
export abstract class NoraComponentBase {
  logger: ConsoleInstance;

  /**
   * RPC proxy object for calling methods on dependency modules
   * Access dependencies like: this.rpc.sidebar.registerIcon(...)
   * Type-safe based on module metadata
   */
  protected rpc: any;

  constructor() {
    // support HMR
    const hot = _NoraComponentBase_viteHotContext.get(this.constructor.name);
    // Initialize logger
    const _console = console.createInstance({
      prefix: `nora@${kebabCase(this.constructor.name)}`,
    });
    this.logger = _console;

    // Initialize RPC proxies based on metadata
    const metadata = this._metadata();
    this.rpc = this._createRPCProxies(metadata);

    // Run init with solid-js HMR support
    createRootHMR(() => {
      this.init();
      onCleanup(() => {
        nora_component_base_console.debug(`onCleanup ${this.constructor.name}`);
        _NoraComponentBase_viteHotContext.delete(this.constructor.name);
      });
    }, hot);
  }

  /**
   * Internal method to create RPC proxies for dependencies
   * Combines both hard and soft dependencies - Either handles both the same way
   */
  protected _createRPCProxies(
    metadata: ReturnType<typeof this._metadata>,
  ): any {
    const allDeps = [
      ...(metadata.dependencies || []),
      ...(metadata.softDependencies || []),
    ];
    return createDependencyRPCProxies(allDeps);
  }

  abstract init(): void;

  /**
   * Return module metadata for dependency management and internal RPC
   */
  abstract _metadata(): {
    moduleName: string;
    dependencies: string[];
    softDependencies: string[];
  };
}
