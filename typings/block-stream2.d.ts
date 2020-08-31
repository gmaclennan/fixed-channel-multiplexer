// Type definitions for length-prefixed-stream 2.0.0
// Project: https://github.com/mafintosh/length-prefixed-stream

/// <reference types="node" />

declare module 'block-stream2' {
  import { Transform } from 'stream';

  interface BlockStreamOptions {
    size?: number,
    zeroPadding?: boolean
  }

  interface BlockStream {
    new(opts: BlockStreamOptions): BlockStream
  }

  class BlockStream extends Transform {
    constructor(opts: BlockStreamOptions)
  }
  export = BlockStream
}
