const duplexify = require('duplexify')
const lpstream = require('length-prefixed-stream')
const pump = require('pump')
const varint = require('varint')
const isStream = require('is-stream')
const stream = require('stream')
const assert = require('assert')

/** @typedef {import('stream').Duplex} DuplexStream */
/** @typedef {import('stream').Transform} TransformStream */

/** @typedef {{encode: (data: any) => Buffer, decode: (data: Buffer) => any}} Encoding */
/** @typedef {{id: number, encoding?: Encoding}} Channel */
/** @typedef {{id: number, stream: DuplexStream}[]} DecodedStreams */

// Max length of Buffer that a channel id could be encoded as
const varintMaxLength = varint.encodingLength(Number.MAX_SAFE_INTEGER)

/**
 * Create an array of duplex streams multiplexed over a single duplex stream.
 * Each message is encoded as a length-prefixed chunk, and each message is
 * prefixed with the channel id. Lengths and channels are encoded as
 * protobuf-style varints. The wire protocol is:
 *
 * ```
 * <chunk-1-length> <chunk-1-channel> <chunk-1> <chunk-2-length> <chunk-2-channel> <chunk-2>...
 * ```
 *
 * You may optionally pass an encoding to each channel, which must be able to
 * encode any chunk you write to the stream into buffer, and also decode it.
 * Streams on channels with encoding have `objectMode=true`.
 *
 * @param {DuplexStream} duplex
 * @param {Array<number | Channel>} channels
 * @returns {DuplexStream[]}
 */
module.exports = function channelize (duplex, channels) {
  assert(isStream(duplex), 'Must pass stream as 1st arg.')
  assert(Array.isArray(channels), '2nd arg must be an array')
  channels.forEach(validateChannel)

  /** @type {DuplexStream[]} */
  const decodedStreams = []
  const lpDecodeStream = lpstream.decode()
  pump(duplex, lpDecodeStream)

  channels.forEach((val, i) => {
    const ch = typeof val === 'number' ? { id: val } : val
    const encoder = createChannelEncoder(ch)
    const decoder = createChannelDecoder(ch)
    const stream = duplexify(encoder, decoder, { objectMode: !!ch.encoding, highWaterMark: 0 })
    decodedStreams.push(stream)
    const lpEncodeStream = lpstream.encode()
    // Errors bubble up here...
    pump(encoder, lpEncodeStream)
    // ...but don't destroy the encoded stream, and don't end it
    lpEncodeStream.pipe(duplex, { end: false })
    pump(lpDecodeStream, decoder)
  })

  return decodedStreams
}

/** @param {Buffer | string} x */
function bufferPassthrough (x) {
  return typeof x === 'string' ? Buffer.from(x) : x
}

/**
 * @param {Channel} ch
 * @returns {TransformStream}
 */
function createChannelEncoder (ch) {
  const offset = varint.encodingLength(ch.id)
  const encodedChannel = varint.encode(ch.id, Buffer.allocUnsafe(offset))
  const encode = ch.encoding ? ch.encoding.encode : bufferPassthrough

  return new stream.Transform({
    highWaterMark: 0,
    transform(chunk, enc, cb) {
      const encoded = encode(chunk)
      const data = Buffer.allocUnsafe(offset + encoded.length)
      encodedChannel.copy(data)
      encoded.copy(data, offset)
      cb(null, data)
    }
  })
}

/** @type {<T>(x: T) => T} */
const noop = x => x

/**
 * Filter stream, ignores chunks that do not match `ch.id` and decodes chunks
 * that do match.
 * @param {Channel} ch
 * @returns {TransformStream}
 */
function createChannelDecoder (ch) {
  const decode = ch.encoding ? ch.encoding.decode : noop

  return new stream.Transform({
    objectMode: true,
    highWaterMark: 0,
    transform (chunk, enc, cb) {
      try {
        const channelId = varint.decode(chunk.slice(0, varintMaxLength))
        // Doesn't pass any data if id does not match
        if (channelId !== ch.id) return cb()
        const data = chunk.slice(varint.decode.bytes)
        cb(null, decode(data))
      } catch (err) {
        // TODO: Should we just ignore invalid chunks?
        cb(err)
      }
    }
  })
}

/** @param {any} ch */
function validateChannel (ch) {
  if (ch == null) throw new Error('Channel cannot be null or undefined')
  const id = typeof ch === 'number' ? ch : ch.id
  if (typeof id !== 'number') throw new Error('Channel id must be a number')
  if (!Number.isSafeInteger(id)) {
    throw new Error(
      'Channel id must be and integer less than Number.MAX_SAFE_INTEGER'
    )
  }
  if (typeof ch.encoding !== 'undefined') {
    if (typeof ch.encoding.encode !== 'function') {
      throw new Error('Channel encoder must be a function')
    }
    if (typeof ch.encoding.decode !== 'function') {
      throw new Error('Channel decoder must be a function')
    }
  }
}
