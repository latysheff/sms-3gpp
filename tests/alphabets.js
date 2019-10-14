const tape = require('tape')
const { gsm7bit } = require('../lib/alphabets')
const { alphabet, encode, decode } = gsm7bit

tape('GSM 7 bit encode and decode back variable length strings', (t) => {
  let content = ''
  let encoded = Buffer.alloc(0)
  let decoded = ''
  let ok = true

  const start = 0
  const end = alphabet.length

  for (let i = start + 1; i < end; i++) {
    content = alphabet.slice(start, i)
    encoded = encode(content)
    decoded = decode(encoded, content.length)
    // console.log('string [%s]: encoded %s, decoded  %s', content, encoded.toString('hex'), decoded)
    // console.log('string encoded %s', encoded.toString('hex'))
    ok = ok && (content === decoded)
  }
  t.ok(ok)

  t.end()
})
