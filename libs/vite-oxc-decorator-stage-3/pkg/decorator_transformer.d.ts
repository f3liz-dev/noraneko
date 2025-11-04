// world root:component/root
export interface TransformResult {
  code: string,
  map?: string,
  errors: Array<string>,
}
export type * as WasiCliEnvironment026 from './interfaces/wasi-cli-environment.js'; // import wasi:cli/environment@0.2.6
export type * as WasiCliExit026 from './interfaces/wasi-cli-exit.js'; // import wasi:cli/exit@0.2.6
export type * as WasiCliStderr026 from './interfaces/wasi-cli-stderr.js'; // import wasi:cli/stderr@0.2.6
export type * as WasiIoError026 from './interfaces/wasi-io-error.js'; // import wasi:io/error@0.2.6
export type * as WasiIoStreams026 from './interfaces/wasi-io-streams.js'; // import wasi:io/streams@0.2.6
export function transform(filename: string, sourceText: string, options: string): TransformResult;
