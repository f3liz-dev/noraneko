// SPDX-License-Identifier: MPL-2.0

import type * as E from "fp-ts/Either";

type ExtractModuleName<T> = T extends {
  _metadata: () => { moduleName: infer N };
} ? N : never;

declare global {
  interface FeatureModuleRegistry {}
  interface FeatureModuleRPCMethods {}
}

type AllFeatureClasses = FeatureModuleRegistry[keyof FeatureModuleRegistry];

type FeatureModuleClassMap = {
  [K in AllFeatureClasses as ExtractModuleName<K>]: K;
};

// Use the global RPC methods interface directly
type FeatureRpcMethods = FeatureModuleRPCMethods;

type RPCMethodsToEither<T> = {
  [K in keyof T]: T[K] extends (...args: infer Args) => infer Ret
    ? Ret extends Promise<infer AsyncRet>
      ? (...args: Args) => Promise<E.Either<Error, AsyncRet>>
      : (...args: Args) => Promise<E.Either<Error, Ret>>
    : never;
};

type RPCMethodsToSoftEither<T> = {
  [K in keyof T]: T[K] extends (...args: infer Args) => infer Ret
    ? Ret extends Promise<infer AsyncRet>
      ? (...args: Args) => Promise<E.Either<Error, AsyncRet | undefined>>
      : (...args: Args) => Promise<E.Either<Error, Ret | undefined>>
    : never;
};

export type InferredRPCDependencies<
  TDeps extends readonly (keyof FeatureRpcMethods)[],
  TSoftDeps extends readonly (keyof FeatureRpcMethods)[],
> = {
  [K in TDeps[number]]: RPCMethodsToEither<FeatureRpcMethods[K]>;
} & {
  [K in TSoftDeps[number]]: RPCMethodsToSoftEither<FeatureRpcMethods[K]>;
};

export type ModuleRPCType<TModuleName extends keyof FeatureRpcMethods> =
  RPCMethodsToEither<FeatureRpcMethods[TModuleName]>;

export type SoftModuleRPCType<TModuleName extends keyof FeatureRpcMethods> =
  RPCMethodsToSoftEither<FeatureRpcMethods[TModuleName]>;
