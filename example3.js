const DuplexPair = require('native-duplexpair')
const crypto = require('crypto')
const { encode, decode } = require('@msgpack/msgpack')
const intoStream = require('into-stream');
const { Transform, Writable, Readable } = require('stream')

const channelizer = require('.')

/** @type {import('.').Encoding} */
/** @type {import('.').Encoding} */
const encoding = {
  encode: v => Buffer.from(encode(v)),
  decode
}

const channels = [0, { id: 1, encoding }]

const randomBuffer = crypto.randomBytes(300 * 1024) // 256kb

const { socket1, socket2 } = new DuplexPair({ objectMode: true })

const [bufferStream1, objectStream1] = channelizer(socket1, channels)
const [bufferStream2, objectStream2] = channelizer(socket2, channels)

/** @type {Map<number, number>} */
const pings = new Map()
let pos = 0


const pingIn = new Readable({
  objectMode: true,
  read(size) {
    setTimeout(() => {
      if (pings.size > 300) {
        return
      }
      if (pings.size === 4) {
        console.log("PAUSING buffer")
        // Also try pingPong.cork()
        bufferOut.cork()
        setTimeout(() => {
          bufferOut.uncork()
        }, 2000);
      }
      const seq = pings.size
      pings.set(seq, Date.now())
      const buf = crypto.randomBytes(16 * 1024)
      this.push({ seq, buf, type: 'ping' })
    }, 0);
  }
})

const pingPong = new Transform({
  objectMode: true,
  transform(chunk, enc, cb) {
    const {seq, buf, type} = chunk
    if (type !== 'ping') {
      console.error('Expected a ping, got', type)
      cb(new Error())
    } else {
      cb(null, {seq, buf, type: 'pong'})
    }
  }
})

const pongOut = new Writable({
  objectMode: true,
  write(chunk, enc, cb) {
    const {seq, buf, type} = chunk
    if (type !== 'pong') {
      return cb(new Error(`Expected a pong, got ${type}`))
    }
    const sent = pings.get(seq)
    if (typeof sent !== 'number') {
      return cb(new Error(`Unexpected pong: ${seq}`))
    }
    const time = Date.now() - sent
    const size = buf.length
    console.log(`${size} bytes: seq=${seq} time=${time} ms`)
    cb()
  }
})

const bufferOut = new Writable({
  write (chunk, enc, cb) {
    const isEqual = chunk.equals(randomBuffer.slice(pos, chunk.length + pos))
    if (isEqual) {
      console.log(`Buffer chunk received: pos=${pos} length=${chunk.length} remaining=${randomBuffer.length - pos - chunk.length}`)
    } else {
      console.error(`Buffer chunk does not match expected`)
    }
    pos += chunk.length
    cb()
  }
})

const bufferIn = intoStream(randomBuffer).pipe(new Transform({
  transform(chunk, enc, cb) {
    console.log('Buffer chunk in', chunk.length)
    cb(null, chunk)
  }
}))

objectStream2.pipe(pingPong).pipe(objectStream2)
objectStream1.pipe(pongOut)
bufferStream2.pipe(bufferOut)
bufferIn.pipe(bufferStream1, { end: false })
pingIn.pipe(objectStream1)
