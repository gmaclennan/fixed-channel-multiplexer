const net = require('net')
const { encode, decode } = require('@msgpack/msgpack')
const channelizer = require('.')

/** @type {import('.').Encoding} */
const msgpackEncoding = {
  encode: v => Buffer.from(encode(v)),
  decode
}

const channels = [0, { id: 1, encoding: msgpackEncoding }]

const server = net
  .createServer(function (con) {
    const [bufferStream, jsonStream] = channelizer(con, channels)
    bufferStream.on('data', d => console.log('bufferStream', d, d.toString()))
    jsonStream.on('data', d => console.log('jsonStream', d))
    con.on('end', () => server.close())
  })
  .listen(3000)

var con = net.connect(3000)
const [bufferStream, jsonStream] = channelizer(con, channels)

jsonStream.write({ some: { test: 'data', id: 1 } })
bufferStream.write(Buffer.from('Hello World'))
con.end()
