const debug = require('debug')('sms:rpdu')
const { Errors, MTI, RPAddress } = require('./rplib')

class DATA {
  // constructor () {
  // }

  static parse (buffer, network) {
    // todo network defines that DA is absent
    const pdu = new DATA()
    let offset = 0
    pdu.MTI = buffer[offset++]
    pdu.MR = buffer[offset++]

    let len

    len = RPAddress.getLength(buffer.slice(offset))
    pdu.OA = buffer.slice(offset, offset + len)
    offset += len

    len = RPAddress.getLength(buffer.slice(offset))
    pdu.DA = buffer.slice(offset, offset + len)
    offset += len

    pdu.UDL = buffer[offset++]
    pdu.UD = buffer.slice(offset)

    return pdu
  }

  decode () {
    const options = {
      type: 'data',
      reference: this.MR,
      source: RPAddress.decode(this.OA),
      destination: RPAddress.decode(this.DA),
      content: this.UD
    }

    return options
  }

  static from (message, network) {
    const pdu = new DATA({}, network)
    pdu.MTI = MTI.encode('DATA', network)
    pdu.MR = message.reference
    pdu.OA = RPAddress.encode(message.source)
    pdu.DA = RPAddress.encode(message.destination)
    pdu.UD = message.content

    debug('built DELIVER TPDU', pdu)
    return pdu
  }

  encode () {
    // 3 bytes: MTI + MR + UDL
    const length = 3 + this.OA.length + this.DA.length + this.UD.length
    const buffer = Buffer.alloc(length)
    let offset = 0

    buffer[offset++] = this.MTI
    buffer[offset++] = this.MR
    this.OA.copy(buffer, offset)
    offset += this.OA.length
    this.DA.copy(buffer, offset)
    offset += this.DA.length
    buffer[offset++] = this.UD.length
    this.UD.copy(buffer, offset)

    return buffer
  }
}

const FIELDS = {
  65: function (pdu, buffer, options) {
    // debug(buffer[options.offset + 1])
    pdu.UD = buffer.slice(options.offset + 2, options.offset + 2 + buffer[options.offset + 1])
    options.offset += 2 + pdu.UD.length
  }
}

class ACK {
  // constructor () {
  // }

  static parse (buffer, network) {
    const pdu = new ACK()
    let offset = 0
    pdu.MTI = buffer[offset++]
    pdu.MR = buffer[offset++]
    const options = { offset }
    while (options.offset < buffer.length - 2) {
      const id = buffer[options.offset]
      const parse = FIELDS[id]
      if (typeof parse === 'function') {
        parse(pdu, buffer, options)
      } else {
        return
      }
    }

    return pdu
  }

  decode () {
    const options = {
      type: 'ack',
      reference: this.MR,
      content: this.UD
    }

    return options
  }

  static from (message, network) {
    const pdu = new ACK()
    pdu.MTI = MTI.encode('ACK', network)
    pdu.MR = message.reference
    pdu.UD = message.content

    return pdu
  }

  encode () {
    // 3 bytes: MTI + MR
    let length = 2
    if (this.UD) {
      length += 2 + this.UD.length
    }
    const buffer = Buffer.alloc(length)
    let offset = 0

    buffer[offset++] = this.MTI
    buffer[offset++] = this.MR

    if (this.UD) {
      // todo generic optional element
      buffer[offset++] = 0x41
      buffer[offset++] = this.UD.length
      this.UD.copy(buffer, offset)
    }

    return buffer
  }
}

class ERROR {
  // constructor () {
  // }

  static parse (buffer) {
    const pdu = new ERROR()
    let offset = 0
    pdu.MTI = buffer[offset++]
    pdu.MR = buffer[offset++]
    pdu.CAUSE = buffer.slice(offset, offset + 2)
    offset += 2

    const options = { offset }
    while (options.offset < buffer.length - 2) {
      const id = buffer[options.offset]
      const parse = FIELDS[id]
      if (typeof parse === 'function') {
        parse(pdu, buffer, options)
      }
    }

    return pdu
  }

  decode () {
    // todo decode 8.2.5.4 RP-Cause element
    const options = {
      type: 'error',
      reference: this.MR,
      cause: Errors[this.CAUSE[1]],
      content: this.UD
    }

    return options
  }

  static from (message, network) {
    const pdu = new ERROR()
    pdu.MTI = MTI.encode('ERROR', network)
    pdu.MR = message.reference

    pdu.CAUSE = Buffer.alloc(2)
    pdu.CAUSE[0] = 1
    pdu.CAUSE[1] = message.errorCode & 0x7f

    pdu.UD = message.content

    return pdu
  }

  encode () {
    // 4 bytes: MTI + MR + Cause
    let length = 2 + 2
    if (this.UD) {
      length += 2 + this.UD.length
    }

    const buffer = Buffer.alloc(length)
    let offset = 0

    buffer[offset++] = this.MTI
    buffer[offset++] = this.MR

    this.CAUSE.copy(buffer, offset)
    offset += this.CAUSE.length
    // buffer[offset++] = this.CAUSE[0]
    // buffer[offset++] = this.CAUSE[1]

    if (this.UD) {
      // todo generic optional element
      buffer[offset++] = 0x41
      buffer[offset++] = this.UD.length
      this.UD.copy(buffer, offset)
    }

    return buffer
  }
}

class SMMA {
  // constructor () {
  // }

  static parse (buffer) {
    // todo
  }

  static from (message) {
    // assert(!network)
    const pdu = new SMMA()
    pdu.MTI = MTI.encode('SMMA')

    pdu.MR = message.reference

    return pdu
  }

  encode () {
    // 3 bytes: MTI + MR
    let length = 2
    const buffer = Buffer.alloc(length)
    let offset = 0

    buffer[offset++] = this.MTI
    buffer[offset] = this.MR

    return buffer
  }
}

function decode (buffer) {
  const { type, network } = MTI.decode(buffer[0])
  debug('[%s] RP-%s', network ? 'network' : 'ms', type, buffer)

  let rpdu
  switch (type) {
    case 'DATA':
      rpdu = DATA.parse(buffer, network)
      break
    case 'ACK':
      rpdu = ACK.parse(buffer, network)
      break
    case 'ERROR':
      rpdu = ERROR.parse(buffer, network)
      break
    case 'SMMA':
      rpdu = SMMA.parse(buffer, network)
      break
  }

  if (!rpdu) return

  let rpMessage = rpdu.decode()
  rpMessage.network = network

  return rpMessage
}

module.exports = { DATA, ACK, ERROR, SMMA, decode }
