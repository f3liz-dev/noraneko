/** @module Interface wasi:io/streams@0.2.6 **/
export type Error = import('./wasi-io-error.js').Error;
export type StreamError = StreamErrorLastOperationFailed | StreamErrorClosed;
export interface StreamErrorLastOperationFailed {
  tag: 'last-operation-failed',
  val: Error,
}
export interface StreamErrorClosed {
  tag: 'closed',
}

export class OutputStream {
  /**
   * This type does not have a public constructor.
   */
  private constructor();
  blockingWriteAndFlush(contents: Uint8Array): void;
}
