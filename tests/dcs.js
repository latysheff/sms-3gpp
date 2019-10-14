const tape = require('tape')
const dcs = require('../lib/dcs')

tape('DCS decode', (t) => {
  t.deepEquals(dcs.sms.decode(0xf6), {
    coding: 'binary',
    group: 'class',
    class: 2
  })
  t.end()
})

tape('DCS decode', (t) => {
  t.deepEquals(dcs.sms.decode(0x10), {
    coding: 'default',
    group: 'general',
    compressed: false,
    haveClass: true,
    class: 0
  })
  t.end()
})

tape('DCS decode', (t) => {
  t.deepEquals(dcs.sms.decode(0x18), {
    coding: 'ucs2',
    group: 'general',
    compressed: false,
    haveClass: true,
    class: 0
  })
  t.end()
})

tape('DCS decode', (t) => {
  t.deepEquals(dcs.sms.decode(0xf0), {
    coding: 'default',
    group: 'class',
    class: 0
  })
  t.end()
})
