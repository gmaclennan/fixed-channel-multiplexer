// Type definitions for length-prefixed-stream 2.0.0
// Project: https://github.com/mafintosh/length-prefixed-stream

/// <reference types="node" />

declare module 'native-duplexpairs' {
  import { Duplex, DuplexOptions } from 'stream';

  interface DuplexPair {
    new(opts: DuplexOptions): DuplexPair
  }

  class DuplexPair extends Duplex {
    constructor(opts: DuplexOptions)
  }
  export = DuplexPair
}
