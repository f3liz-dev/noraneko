// SPDX-License-Identifier: MPL-2.0

/**
 * Automatic RPC type inference system
 * Extracts RPC method types directly from module metadata without manual interface declarations
 */

import type * as E from "fp-ts/Either";

/**
 * Extract the type of rpcMethods from a module's metadata
 */
export type ExtractRPCMethods<T> = T extends {
  _metadata(): { rpcMethods: infer R };
}
  ? R
  : never;

/**
 * Convert RPC methods to Promise-based and Either-wrapped versions
 * This wraps all methods to return Either<Error, T> for error safety
 */
export type RPCMethodsToEither<T> = {
  [K in keyof T]: T[K] extends (...args: infer Args) => infer Ret
    ? Ret extends Promise<infer AsyncRet>
      ? (...args: Args) => Promise<E.Either<Error, AsyncRet>>
      : (...args: Args) => Promise<E.Either<Error, Ret>>
    : never;
};

/**
 * Convert RPC methods to Promise-based versions (for soft dependencies)
 * Soft dependencies return Either<Error, T | undefined>
 */
export type RPCMethodsToSoftEither<T> = {
  [K in keyof T]: T[K] extends (...args: infer Args) => infer Ret
    ? Ret extends Promise<infer AsyncRet>
      ? (...args: Args) => Promise<E.Either<Error, AsyncRet | undefined>>
      : (...args: Args) => Promise<E.Either<Error, Ret | undefined>>
    : never;
};

/**
 * Global registry of module RPC types
 * This will be populated automatically as modules are loaded
 */
export interface ModuleRPCRegistry {
  // Types will be automatically inferred from modules
  // No manual interface declarations needed!
}

/**
 * Helper to create typed RPC dependencies from module names
 * Hard dependencies use Either for errors
 * Soft dependencies use Either with undefined fallback
 */
export type InferredRPCDependencies<
  TDeps extends readonly string[],
  TSoftDeps extends readonly string[],
> = {
  [K in TDeps[number]]: K extends keyof ModuleRPCRegistry
    ? RPCMethodsToEither<ModuleRPCRegistry[K]>
    : never;
} & {
  [K in TSoftDeps[number]]: K extends keyof ModuleRPCRegistry
    ? RPCMethodsToSoftEither<ModuleRPCRegistry[K]>
    : never;
};

/**
 * Type-safe metadata return type with RPC methods
 */
export interface ModuleMetadataWithRPC<TName extends string, TRPCMethods> {
  moduleName: TName;
  dependencies: readonly string[];
  softDependencies: readonly string[];
  rpcMethods: TRPCMethods;
}

/**
 * Helper to declare module metadata with automatic RPC type inference
 */
export function defineModuleMetadata<
  TName extends string,
  TRPCMethods extends Record<string, (...args: any[]) => any>,
>(
  metadata: ModuleMetadataWithRPC<TName, TRPCMethods>,
): ModuleMetadataWithRPC<TName, TRPCMethods> {
  return metadata;
}
