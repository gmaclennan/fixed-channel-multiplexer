# fixed-channel-multiplexer

[![standard-readme compliant](https://img.shields.io/badge/standard--readme-OK-green.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)

Multiplex streams over a single duplex stream with fixed channel ids

Creates an array of duplex streams multiplexed over a single duplex stream.
Each message is encoded as a length-prefixed chunk, and each message is
prefixed with the channel id. Lengths and channels are encoded as
protobuf-style varints. The wire protocol is:

```text
<chunk-1-length> <chunk-1-channel> <chunk-1> <chunk-2-length> <chunk-2-channel> <chunk-2>...
```

You may optionally pass an encoding to each channel, which must be able to
encode any chunk you write to the stream into buffer, and also decode it.
Streams on channels with encoding have `objectMode=true`.

## ⚠️ Development Status

Unreleased. This is an experiment with an API for multiplexing, written to learn more about streams.

## Table of Contents

- [Background](#background)
- [Install](#install)
- [Usage](#usage)
- [API](#api)
- [Maintainers](#maintainers)
- [Contributing](#contributing)
- [License](#license)

## Background

## Install

```bash
npm install github:gmaclennan/fixed-channel-multiplexer
```

## Usage

See [example.js](example.js)

```js
const channelizer = require('fixed-channel-multiplexer')
const through = require('through2')

const echoSpy = through((chunk, enc, cb) => {
  console.log('spy', chunk)
  cb(null, chunk)
})

const jsonEncoding = {
  encode: v => Buffer.from(JSON.stringify(v)),
  decode: b => JSON.parse(b.toString())
}

const channels = [0, { id: 1, encoding: jsonEncoding }]

const [bufferStream, jsonStream] = channelizer(echoSpy, channels)

// Should echo whatever is written to the stream
bufferStream.on('data', d => console.log('bufferStream', d, d.toString()))
jsonStream.on('data', d => console.log('jsonStream', d))

jsonStream.write({ some: { test: 'data', id: 1 } })
bufferStream.write(Buffer.from('Hello World'))
```

## API

See [JSDoc in index.js](index.js)

## Maintainers

[@gmaclennan](https://github.com/@gmaclennan)

## Contributing

PRs accepted.

Small note: If editing the README, please conform to the [standard-readme](https://github.com/RichardLitt/standard-readme) specification.

## License

ISC © 2020 Gregor MacLennan
