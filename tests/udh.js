const tape = require('tape')
const { UDH } = require('../lib/udh')

tape('UDH encode port', (t) => {
  const buffer = UDH.encode({ port: { src: 9200, dst: 2948 } })
  const length = UDH.length({ port: { src: 9200, dst: 2948 } })
  console.log(buffer.toString('hex'))
  t.same(buffer.toString('hex'), '0605040b8423f0')
  t.same(length, 7)

  t.end()
})

tape('UDH encode multiple', (t) => {
  const buffer = UDH.encode({ port: { src: 9200, dst: 2948 }, 0x70: Buffer.alloc(0) })
  const length = UDH.length({ port: { src: 9200, dst: 2948 }, 0x70: Buffer.alloc(0) })
  console.log(buffer.toString('hex'))
  t.same(buffer.toString('hex'), '08700005040b8423f0')
  t.same(length, 9)

  t.end()
})
