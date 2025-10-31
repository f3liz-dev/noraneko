// SPDX-License-Identifier: MPL-2.0

/**
 * RPC type definitions with automatic type inference
 *
 * Types are automatically inferred from module metadata via declaration merging.
 * See features-rpc.d.ts for the inference system.
 *
 * All RPC methods automatically return Either<Error, T> for error safety.
 * Both hard and soft dependencies use Either - no distinction needed!
 */

import type {
  InferredRPCDependencies,
  FeatureRpcMethods,
} from "./features-rpc.d.ts";

/**
 * Helper type to create typed RPC object based on dependencies
 * Usage: RPCDependencies<["sidebar", "other-module"]>
 *
 * Types are automatically inferred from module metadata!
 * No manual interface declarations needed.
 *
 * All methods return Either<Error, T> for error-safe handling:
 * - Available modules: Either<Error, T>
 * - Missing modules: Either<Error, undefined>
 *
 * No distinction between hard and soft dependencies - Either handles both!
 */
export type RPCDependencies<T extends readonly (keyof FeatureRpcMethods)[]> =
  InferredRPCDependencies<T, T>;

// Re-export for convenience
export type { FeatureRpcMethods, InferredRPCDependencies };
