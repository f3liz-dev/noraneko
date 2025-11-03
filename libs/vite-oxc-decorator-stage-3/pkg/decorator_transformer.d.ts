// world root:component/root
export interface TransformResult {
  code: string,
  map?: string,
  errors: Array<string>,
}
export type * as WasiCliEnvironment023 from './interfaces/wasi-cli-environment.js'; // import wasi:cli/environment@0.2.3
export type * as WasiCliExit023 from './interfaces/wasi-cli-exit.js'; // import wasi:cli/exit@0.2.3
export type * as WasiCliStderr023 from './interfaces/wasi-cli-stderr.js'; // import wasi:cli/stderr@0.2.3
export type * as WasiCliStdin023 from './interfaces/wasi-cli-stdin.js'; // import wasi:cli/stdin@0.2.3
export type * as WasiCliStdout023 from './interfaces/wasi-cli-stdout.js'; // import wasi:cli/stdout@0.2.3
export type * as WasiClocksWallClock023 from './interfaces/wasi-clocks-wall-clock.js'; // import wasi:clocks/wall-clock@0.2.3
export type * as WasiFilesystemPreopens023 from './interfaces/wasi-filesystem-preopens.js'; // import wasi:filesystem/preopens@0.2.3
export type * as WasiFilesystemTypes023 from './interfaces/wasi-filesystem-types.js'; // import wasi:filesystem/types@0.2.3
export type * as WasiIoError023 from './interfaces/wasi-io-error.js'; // import wasi:io/error@0.2.3
export type * as WasiIoStreams023 from './interfaces/wasi-io-streams.js'; // import wasi:io/streams@0.2.3
export function transform(filename: string, sourceText: string, options: string): TransformResult;
