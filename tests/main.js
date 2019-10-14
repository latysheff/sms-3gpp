const tape = require('tape')
const sms = require('..')

const timestamp = new Date('2019-10-10 12:00:00Z')
const reference = 1

tape('SUBMIT encode', (t) => {
  const buffer = sms.submit({ reference, timestamp, destination: '71231234567', smsc: '73219876543', content: 'hello' })

  console.log(buffer.toString('hex'))
  t.same(buffer.toString('hex'), '00010007913712896745f31201010b911732214365f7000005e8329bfd06')

  t.end()
})

tape('COMMAND encode', (t) => {
  const buffer = sms.command({
    reference,
    timestamp,
    destination: '71231234567',
    smsc: '73219876543',
    content: 'hello'
  })

  console.log(buffer.toString('hex'))
  t.same(buffer.toString('hex'), '00010007913712896745f31302010000000b911732214365f70568656c6c6f')

  t.end()
})

tape('SMMA encode', (t) => {
  const buffer = sms.smma({ reference })

  console.log(buffer.toString('hex'))
  t.same(buffer.toString('hex'), '0601')

  t.end()
})

tape('ERROR encode', (t) => {
  const buffer = sms.error({ reference })

  console.log(buffer.toString('hex'))
  t.same(buffer.toString('hex'), '04010100')

  t.end()
})
