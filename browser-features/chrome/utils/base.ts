// SPDX-License-Identifier: MPL-2.0

import { ViteHotContext } from "vite/types/hot";
import { kebabCase } from "es-toolkit/string";
import { createRootHMR } from "@nora/solid-xul";
import { onCleanup } from "solid-js";
import { createDependencyRPCProxies } from "#bridge-loader-features/loader/modules-hooks.ts";

const _hotContexts = new Map<string, ViteHotContext | undefined>();
const _metadata = new Map<string, ComponentMetadata>();
const _rpcMethods = new Map<string, Set<string | symbol>>();

interface ComponentMetadata {
  moduleName: string;
  dependencies: string[];
  softDependencies: string[];
}

/**
 * Mark method as RPC-exposed
 */
export function rpcMethod(_: Function, context: ClassMethodDecoratorContext) {
  context.addInitializer(function () {
    const className = context.static ? this.name : this.constructor.name;

    if (!className) {
      console.error(
        "RPCMethod: Could not determine class name for decorator on method:",
        context.name,
      );
      return;
    }
    // END OF FIX
    console.log(className);

    if (!_rpcMethods.has(className)) _rpcMethods.set(className, new Set());
    _rpcMethods.get(className)!.add(context.name);
  });
}

/**
 * Define component with auto-injection
 */
export function component(config: {
  moduleName: string;
  dependencies?: string[];
  softDependencies?: string[];
  hot?: ViteHotContext;
}) {
  return <T extends { new (...args: any[]): {} }>(
    target: T,
    context: ClassDecoratorContext,
  ) => {
    const name = context.name as string;
    if (_hotContexts.has(name)) throw new Error(`Duplicate component: ${name}`);

    _hotContexts.set(name, config.hot);
    _metadata.set(name, {
      moduleName: config.moduleName,
      dependencies: config.dependencies || [],
      softDependencies: config.softDependencies || [],
    });

    return class extends target {
      protected logger = console.createInstance({
        prefix: `nora@${kebabCase(name)}`,
      });
      protected rpc = createDependencyRPCProxies([
        ..._metadata.get(name)!.dependencies,
        ..._metadata.get(name)!.softDependencies,
      ]);

      constructor(...args: any[]) {
        super(...args);
        console.log("construct on decorator");
        createRootHMR(() => {
          if ("init" in this && typeof this.init === "function") this.init();
          onCleanup(() => _hotContexts.delete(name));
        }, _hotContexts.get(name));
      }

      static _metadata() {
        return _metadata.get(name)!;
      }

      rpcMethods() {
        const methods = _rpcMethods.get(name);
        if (!methods) return {};
        return Object.fromEntries(
          Array.from(methods).map((m) => [m, (this as any)[m].bind(this)]),
        );
      }
    } as T;
  };
}
