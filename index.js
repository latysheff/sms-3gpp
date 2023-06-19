const debug = require('debug')('sms')

const RPDU = require('./lib/rpdu')
const TPDU = require('./lib/tpdu')
const { UD } = require('./lib/ud')
const { UDH } = require('./lib/udh')
const alphabets = require('./lib/alphabets')
const tplib = require('./lib/tplib')
const rplib = require('./lib/rplib')

function ack (message) {
  const rpdu = RPDU.ACK.from({
    reference: message.reference,
    content: message.content
  })

  return rpdu.encode()
}

function error (message) {
  const rpdu = RPDU.ERROR.from({
    reference: message.reference,
    errorCode: message.errorCode,
    content: message.content
  })

  return rpdu.encode()
}

function submit (message) {
  // todo pass message as a buffer, if have from smpp

  const reference = message.reference ?? Math.floor(Math.random() * 256)

  const tpdu = TPDU.SUBMIT.from({
    reference,
    destination: message.destination,
    report: message.report,
    pid: message.pid,
    dcs: message.dcs,
    coding: message.coding,
    udh: message.udh,
    content: message.content
  })

  const rpdu = RPDU.DATA.from({
    reference,
    source: message.source,
    destination: message.smsc,
    content: tpdu.encode()
  })

  const buffer = rpdu.encode()

  return buffer
}

function deliver (message) {
  const reference = message.reference || Math.floor(Math.random() * 0xff)

  // todo pass message as a buffer, if have from smpp
  const tpdu = TPDU.DELIVER.from({
    source: message.source,
    dcs: message.dcs,
    coding: message.coding,
    udh: message.udh,
    content: message.content
  })
  // debug(tpdu)

  const tpBuffer = tpdu.encode()
  // debug('built TPDU buffer', tpBuffer)

  const rpdu = RPDU.DATA.from({
    reference,
    source: message.smsc,
    content: tpBuffer
  }, true)

  debug(rpdu)

  return rpdu.encode()
}

function smma (message) {
  const reference = message.reference || Math.floor(Math.random() * 0xff)

  const rpdu = RPDU.SMMA.from({
    reference
  })

  return rpdu.encode()
}

function command (message) {
  // todo explain reference usage
  const reference = message.reference || Math.floor(Math.random() * 0xff)

  debug(message)
  // todo pass message as a buffer, if have from smpp
  const tpdu = TPDU.COMMAND.from({
    reference,
    report: message.report,
    destination: message.destination,
    command: message.command,
    message_number: message.message_number,
    content: message.content
  })
  debug(tpdu)
  const tpBuffer = tpdu.encode()
  debug('TPDU buffer', tpBuffer)

  const rpdu = RPDU.DATA.from({
    reference,
    destination: message.smsc,
    content: tpdu.encode()
  })

  debug(rpdu)

  return rpdu.encode()
}

function decode (buffer) {
  const rpMessage = RPDU.decode(buffer)

  if (!rpMessage) return

  const message = rpMessage

  if (rpMessage.content) {
    const tpMessage = TPDU.decode(rpMessage)

    message.tpdu = tpMessage
  }

  return message
}

module.exports = {
  decode,
  command,
  smma,
  deliver,
  submit,
  error,
  ack,
  RPDU,
  TPDU,
  UD,
  UDH,
  alphabets,
  tplib,
  rplib
}
