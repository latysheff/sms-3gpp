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

tape('SMS Type 0 SUBMIT decode', (t) => {
  const hex = '00000007919761989901f00d21000b919761000000f0400000'
  const buffer = Buffer.from(hex, 'hex')
  const message = sms.decode(buffer)

  console.log(message.content.toString('hex'))
  delete message.content

  t.same(message, {
    type: 'data',
    reference: 0,
    source: undefined,
    destination: { ton: 1, npi: 1, number: '79168999100' },
    network: false,
    tpdu: {
      type: 'SUBMIT',
      reference: 0,
      destination: { ton: 1, npi: 1, number: '79160000000', length: 8 },
      report: false,
      dcs: 0,
      pid: 64,
      coding: 'default',
      content: ''
    }
  })

  t.end()
})

tape('SMS Type 0 DELIVER decode', (t) => {
  const hex = '012007919781340310f100102406d04dea1040002221921092112100'
  const buffer = Buffer.from(hex, 'hex')
  const message = sms.decode(buffer)

  delete message.content

  t.same(message, {
    type: 'data',
    reference: 32,
    source: { ton: 1, npi: 1, number: '79184330011' },
    destination: undefined,
    network: true,
    tpdu: {
      type: 'DELIVER',
      timestamp: new Date('Thu Dec 29 2022 01:29:11 GMT+0300 (Moscow Standard Time)'),
      source: { ton: 5, npi: 0, number: 'MTC', length: 3 },
      report: true,
      dcs: 0,
      pid: 64,
      coding: 'default',
      content: ''
    }
  })

  t.end()
})
