const debug = require('debug')('sms')

const RPDU = require('./lib/rpdu')
const TPDU = require('./lib/tpdu')
const { UD } = require('./lib/ud')
const { UDH } = require('./lib/udh')

function ack (message) {
  const rpdu = RPDU.ACK.from({
    reference: message.reference
  })

  return rpdu.encode()
}

function error (message) {
  const rpdu = RPDU.ERROR.from({
    reference: message.reference,
    errorCode: message.errorCode
  })
  debug(rpdu)

  return rpdu.encode()
}

function submit (message) {
  const reference = message.reference || Math.floor(Math.random() * 0xff)

  // todo pass message as a buffer, if have from smpp
  const tpdu = TPDU.SUBMIT.from({
    reference: reference,
    destination: message.destination,
    report: message.report,
    pid: message.pid,
    dcs: message.dcs,
    coding: message.coding,
    udh: message.udh,
    data: message.content
  })
  // debug(tpdu)

  const rpdu = RPDU.DATA.from({
    reference,
    source: message.source,
    destination: message.smsc,
    data: tpdu.encode()
  })
  // debug(rpdu)

  const buffer = rpdu.encode()
  // debug(buffer)

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
    data: tpBuffer
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
    data: message.content
  })
  debug(tpdu)
  const tpBuffer = tpdu.encode()
  debug('TPDU buffer', tpBuffer)

  const rpdu = RPDU.DATA.from({
    reference,
    destination: message.smsc,
    data: tpdu.encode()
  })

  debug(rpdu)

  return rpdu.encode()
}

function decode (buffer) {
  const rpMessage = RPDU.decode(buffer)

  if (!rpMessage) return

  const message = rpMessage

  if (rpMessage.data) {
    const tpMessage = TPDU.decode(rpMessage)

    message.tpdu = tpMessage
  }

  return message
}

module.exports = { decode, command, smma, deliver, submit, error, ack, TPDU, UD, UDH }
