const tape = require('tape')
const { UD } = require('../lib/ud')

tape('UD encode', (t) => {
  const { buffer, length } = UD.encode('hello', 'default')
  console.log(buffer.toString('hex'), length)
  t.same(buffer.toString('hex'), 'e8329bfd06')

  t.end()
})

tape('UD decode', (t) => {
  const buffer = Buffer.from('e8329bfd06', 'hex')
  console.log(buffer.toString('hex'))
  const { content } = UD.decode(buffer)
  t.same(content, 'hello')

  t.end()
})
