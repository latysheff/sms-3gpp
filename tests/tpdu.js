const tape = require('tape')
const { TPDU } = require('..')
const { SUBMIT, SUBMIT_REPORT, DELIVER, DELIVER_REPORT, STATUS_REPORT } = TPDU

tape('SUBMIT', (t) => {
  const hex = '01010b911732214365f7000005e8329bfd06'
  const message = {
    type: 'SUBMIT',
    reference: 1,
    destination: { ton: 1, npi: 1, number: '71231234567', length: 8 },
    report: false,
    dcs: 0,
    pid: 0,
    coding: 'default',
    content: 'hello'
  }

  t.same(SUBMIT.from(message).encode().toString('hex'), hex)
  t.same(SUBMIT.parse(Buffer.from(hex, 'hex')).decode(), message)

  t.end()
})

tape('SUBMIT_REPORT decode', (t) => {
  const hex = '010022219281739121'

  t.same(SUBMIT_REPORT.parse(Buffer.from(hex, 'hex')).decode(), {
    type: 'SUBMIT-REPORT',
    timestamp: new Date('Thu Dec 29 2022 18:37:19 GMT+0300 (Moscow Standard Time)')
  })

  t.end()
})

tape('DELIVER decode', (t) => {
  const hex = '240b919758700027f340002221928173912100'

  t.same(DELIVER.parse(Buffer.from(hex, 'hex')).decode(), {
    type: 'DELIVER',
    timestamp: new Date('Thu Dec 29 2022 18:37:19 GMT+0300 (Moscow Standard Time)'),
    source: { ton: 1, npi: 1, number: '79850700723', length: 8 },
    report: true,
    dcs: 0,
    pid: 64,
    coding: 'default',
    content: ''
  })

  t.end()
})

tape('DELIVER_REPORT encode', (t) => {
  const hex = '008100'

  t.same(DELIVER_REPORT.from({
    cause: 0x81
  }).encode().toString('hex'), hex)

  t.end()
})

tape('STATUS-REPORT decode', (t) => {
  const hex = '06000b919758700027f3222192818400212221928184002100'

  t.same(STATUS_REPORT.parse(Buffer.from(hex, 'hex')).decode(), {
    type: 'STATUS-REPORT',
    reference: 0,
    recipient: { ton: 1, npi: 1, number: '79850700723', length: 8 },
    timestamp: new Date('Thu Dec 29 2022 18:48:00 GMT+0300 (Moscow Standard Time)'),
    discharge: new Date('Thu Dec 29 2022 18:48:00 GMT+0300 (Moscow Standard Time)'),
    status: { group: 'Short message transaction completed', reason: 'Short message received by the SME' }
  })

  t.end()
})
