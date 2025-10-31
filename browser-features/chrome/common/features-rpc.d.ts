// SPDX-License-Identifier: MPL-2.0

/**
 * Automatic RPC type inference system using TypeScript declaration merging
 * This allows modules to automatically expose their RPC types without manual interface declarations
 */

import type * as E from "fp-ts/Either";

// Helper to extract module name from metadata
type ExtractModuleName<T> = T extends {
  _metadata(): { moduleName: infer N };
}
  ? N
  : never;

// Helper to extract RPC methods from metadata
type ExtractRpcMethods<T> = T extends {
  _metadata(): { rpcMethods: infer R };
}
  ? R
  : never;

// Helper to extract dependencies from metadata
type ExtractDependencies<T> = T extends {
  _metadata(): { dependencies: readonly (infer D)[] };
}
  ? D
  : never;

// Helper to extract soft dependencies from metadata
type ExtractSoftDependencies<T> = T extends {
  _metadata(): { softDependencies: readonly (infer D)[] };
}
  ? D
  : never;

// Convert RPC methods to Either-wrapped versions (for hard dependencies)
type RPCMethodsToEither<T> = {
  [K in keyof T]: T[K] extends (...args: infer Args) => infer Ret
    ? Ret extends Promise<infer AsyncRet>
      ? (...args: Args) => Promise<E.Either<Error, AsyncRet>>
      : (...args: Args) => Promise<E.Either<Error, Ret>>
    : never;
};

// Convert RPC methods to Either-wrapped versions (for soft dependencies)
type RPCMethodsToSoftEither<T> = {
  [K in keyof T]: T[K] extends (...args: infer Args) => infer Ret
    ? Ret extends Promise<infer AsyncRet>
      ? (...args: Args) => Promise<E.Either<Error, AsyncRet | undefined>>
      : (...args: Args) => Promise<E.Either<Error, Ret | undefined>>
    : never;
};

// Global registry interface - each module augments this via declaration merging
declare global {
  /**
   * Global registry of feature modules
   * Modules augment this interface to register their class types
   * 
   * Example:
   * ```typescript
   * declare global {
   *   interface FeatureModuleRegistry {
   *     Sidebar: typeof Sidebar;
   *     SidebarAddonPanel: typeof SidebarAddonPanel;
   *   }
   * }
   * ```
   */
  interface FeatureModuleRegistry {
    // Each feature module adds itself here via declaration merging
  }
}

// Get all feature classes from the global registry
type AllFeatureClasses = FeatureModuleRegistry[keyof FeatureModuleRegistry];

// Generate map from module name to class using metadata
type FeatureModuleClassMap = {
  [K in AllFeatureClasses as ExtractModuleName<
    InstanceType<K>
  >]: K;
};

// Extract RPC methods for each module by module name
type FeatureRpcMethods = {
  [K in keyof FeatureModuleClassMap]: ExtractRpcMethods<
    InstanceType<FeatureModuleClassMap[K]>
  >;
};

/**
 * Inferred RPC dependencies type
 * Automatically creates typed RPC object from module names
 * Hard dependencies get Either<Error, T>
 * Soft dependencies get Either<Error, T | undefined>
 */
export type InferredRPCDependencies<
  TDeps extends readonly (keyof FeatureRpcMethods)[],
  TSoftDeps extends readonly (keyof FeatureRpcMethods)[]
> = {
  [K in TDeps[number]]: RPCMethodsToEither<FeatureRpcMethods[K]>;
} & {
  [K in TSoftDeps[number]]: RPCMethodsToSoftEither<FeatureRpcMethods[K]>;
};

/**
 * Helper type to get RPC type for a specific module
 */
export type ModuleRPCType<TModuleName extends keyof FeatureRpcMethods> = 
  RPCMethodsToEither<FeatureRpcMethods[TModuleName]>;

/**
 * Helper type to get soft RPC type for a specific module
 */
export type SoftModuleRPCType<TModuleName extends keyof FeatureRpcMethods> = 
  RPCMethodsToSoftEither<FeatureRpcMethods[TModuleName]>;

// Re-export for convenience
export type {
  ExtractModuleName,
  ExtractRpcMethods,
  ExtractDependencies,
  ExtractSoftDependencies,
  FeatureModuleClassMap,
  FeatureRpcMethods,
};
