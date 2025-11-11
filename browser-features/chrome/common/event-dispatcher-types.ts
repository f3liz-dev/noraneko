// SPDX-License-Identifier: MPL-2.0

/**
 * Automatic EventDispatcher type inference system
 * Extracts event method types directly from module metadata without manual interface declarations
 * 
 * Note: Payloads don't need to be serializable as everything runs in one process.
 * This is an event dispatching system, not traditional RPC.
 */

import type * as E from "fp-ts/Either";

/**
 * Extract the type of eventMethods from a module's metadata
 */
export type ExtractEventMethods<T> = T extends {
  _metadata(): { eventMethods: infer R };
}
  ? R
  : never;

/**
 * Convert event methods to Promise-based and Either-wrapped versions
 * This wraps all methods to return Either<Error, T> for error safety
 */
export type EventMethodsToEither<T> = {
  [K in keyof T]: T[K] extends (...args: infer Args) => infer Ret
    ? Ret extends Promise<infer AsyncRet>
      ? (...args: Args) => Promise<E.Either<Error, AsyncRet>>
      : (...args: Args) => Promise<E.Either<Error, Ret>>
    : never;
};

/**
 * Convert event methods to Promise-based versions (for soft dependencies)
 * Soft dependencies return Either<Error, T | undefined>
 */
export type EventMethodsToSoftEither<T> = {
  [K in keyof T]: T[K] extends (...args: infer Args) => infer Ret
    ? Ret extends Promise<infer AsyncRet>
      ? (...args: Args) => Promise<E.Either<Error, AsyncRet | undefined>>
      : (...args: Args) => Promise<E.Either<Error, Ret | undefined>>
    : never;
};

/**
 * Global registry of module EventDispatcher types
 * This will be populated automatically as modules are loaded
 */
export interface ModuleEventDispatcherRegistry {
  // Types will be automatically inferred from modules
  // No manual interface declarations needed!
}

/**
 * Helper to create typed EventDispatcher dependencies from module names
 * Hard dependencies use Either for errors
 * Soft dependencies use Either with undefined fallback
 */
export type InferredEventDispatcherDependencies<
  TDeps extends readonly string[],
  TSoftDeps extends readonly string[],
> = {
  [K in TDeps[number]]: K extends keyof ModuleEventDispatcherRegistry
    ? EventMethodsToEither<ModuleEventDispatcherRegistry[K]>
    : never;
} & {
  [K in TSoftDeps[number]]: K extends keyof ModuleEventDispatcherRegistry
    ? EventMethodsToSoftEither<ModuleEventDispatcherRegistry[K]>
    : never;
};

/**
 * Type-safe metadata return type with event methods
 */
export interface ModuleMetadataWithEventMethods<TName extends string, TEventMethods> {
  moduleName: TName;
  dependencies: readonly string[];
  softDependencies: readonly string[];
  eventMethods: TEventMethods;
}

/**
 * Helper to declare module metadata with automatic event method type inference
 */
export function defineModuleMetadata<
  TName extends string,
  TEventMethods extends Record<string, (...args: any[]) => any>,
>(
  metadata: ModuleMetadataWithEventMethods<TName, TEventMethods>,
): ModuleMetadataWithEventMethods<TName, TEventMethods> {
  return metadata;
}
