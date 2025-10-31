// SPDX-License-Identifier: MPL-2.0

/**
 * RPC type definitions - now using automatic type inference!
 * 
 * Types are automatically inferred from module metadata via declaration merging.
 * See features-rpc.d.ts for the inference system.
 * 
 * All RPC methods automatically return Either<Error, T> for error safety.
 */

import type { InferredRPCDependencies, FeatureRpcMethods } from "./features-rpc.d.ts";

/**
 * Helper type to create typed RPC object based on dependencies
 * Usage: RPCDependencies<["sidebar", "other-module"]>
 * 
 * Types are automatically inferred from module metadata!
 * No manual interface declarations needed.
 * 
 * All methods return Either<Error, T> for error-safe handling:
 * - Hard dependencies: Either<Error, T>
 * - Soft dependencies: Either<Error, T | undefined>
 */
export type RPCDependencies<T extends readonly (keyof FeatureRpcMethods)[]> = 
  InferredRPCDependencies<T, []>;

/**
 * Helper type with separate hard and soft dependencies
 */
export type RPCDependenciesWithSoft<
  THard extends readonly (keyof FeatureRpcMethods)[],
  TSoft extends readonly (keyof FeatureRpcMethods)[]
> = InferredRPCDependencies<THard, TSoft>;

// Re-export for convenience
export type { FeatureRpcMethods, InferredRPCDependencies };

