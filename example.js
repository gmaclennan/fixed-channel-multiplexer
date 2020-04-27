const channelizer = require('.')
const through = require('through2')
const Pumpify = require('pumpify')
const BlockStream = require('block-stream2')

// Chunk stream into blocks of 4-bytes.
const echoSpy = new Pumpify(
  new BlockStream({ size: 4, zeroPadding: false }),
  through((chunk, enc, cb) => {
    // Encoded chunk
    console.log('spy', chunk)
    cb(null, chunk)
  })
)

/** @type {import('.').Encoding} */
const jsonEncoding = {
  encode: v => Buffer.from(JSON.stringify(v)),
  decode: b => JSON.parse(b.toString())
}

const [bufferStream, jsonStream] = channelizer(echoSpy, [
  0,
  { id: 1, encoding: jsonEncoding }
])

// Should echo whatever is written to the stream
bufferStream.on('data', d => console.log('bufferStream', d, d.toString()))
jsonStream.on('data', d => console.log('jsonStream', d))

jsonStream.write({ some: { test: 'data', id: 1 } })
bufferStream.write(Buffer.from('Hello World'))

// Since we are chunking the stream, we need to flush out any buffered bytes
echoSpy.end()
