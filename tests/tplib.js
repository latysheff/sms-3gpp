const tape = require('tape')
// const {Address, Status, TimeStamp, ValidityPeriod, Errors} = require('../lib/tplib')
const { Address, TimeStamp } = require('../lib/tplib')

tape('Address encode', (t) => {
  t.same(Address.encode({ number: '123456768', ton: 1, npi: 1 }).toString('hex'), '099121436567f8')
  t.same(Address.encode({ number: '1234567689', ton: 1, npi: 1 }).toString('hex'), '0a912143656798')
  t.same(Address.encode({ number: 'test', ton: 5, npi: 1 }).toString('hex'), '07d0f4f29c0e')

  t.end()
})

tape('TimeStamp encode', (t) => {
  const date = new Date('2019-01-01 12:00:00Z')
  // console.log(date)
  t.same(TimeStamp.encode(date).toString('hex'), '91101051000021')
  t.same(TimeStamp.decode('91101051000021'), date)

  t.end()
})

// todo more tests
