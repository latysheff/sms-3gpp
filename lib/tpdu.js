const debug = require('debug')('sms:tpdu')

/*
https://portal.3gpp.org/desktopmodules/Specifications/SpecificationDetails.aspx?specificationId=747

GSM 03.40
ETSI TS 123 040

2.2.2 Abbreviations
ACSE Association Control Service Element
SM MT Short Message Mobile Terminated Point-to-Point
SM MO Short Message Mobile Originated Point-to-Point
SM-AL Short Message Application Layer
SM-TL Short Message Transfer Layer
SM-RL Short Message Relay Layer
SM-LL Short Message Lower Layers
SM-TP Short Message Transfer Layer Protocol
SM-RP Short Message Relay Layer Protocol
SM-TS Short Message Transfer Service
SM-RS Short Message Relay Service
TPDU Transfer protocol data unit

*/

const { UD } = require('./ud')
const { UDH } = require('./udh')
const dcs = require('./dcs')

const { Address, TimeStamp, ValidityPeriod, Errors, Status } = require('./tplib')

// GSM 03.40 9.2.2.2 SMS-SUBMIT type

// 9.2.3.1 TP-Message-Type-Indicator (TP-MTI)
const MTI = {
  decode: {
    MS: {
      0b00: 'DELIVER-REPORT',
      0b01: 'SUBMIT',
      0b10: 'COMMAND',
      0b11: 'Reserved'
    },
    NETWORK: {
      0b00: 'DELIVER',
      0b01: 'SUBMIT-REPORT',
      0b10: 'STATUS-REPORT',
      0b11: 'Reserved'
    }
  },
  encode: {
    MS: {
      'DELIVER-REPORT': 0,
      SUBMIT: 1,
      COMMAND: 2
    },
    NETWORK: {
      DELIVER: 0,
      'SUBMIT-REPORT': 1,
      'STATUS-REPORT': 2
    }
  }
}

class TPDU {
  constructor (options, network) {
    // todo shared properties and behavior?
  }
}

class SUBMIT extends TPDU {
  constructor (options = {}) {
    super(options)

    this.MTI = MTI.encode.MS.SUBMIT // message type indicator
    // this.MTI = 1 // message type indicator
    this.RD = options.RD // reject duplicates
    this.VPF = options.VPF // validity period format
    this.RP = options.RP // reply path
    this.UDHI = options.UDHI // user data header included
    this.SRR = options.SRR // status report requested

    this.MR = options.MR // message reference
    this.DA = options.DA // destination address
    this.PID = options.PID // protocol identifier
    this.DCS = options.DCS // data coding schema
    this.VP = options.VP // validity period
    this.UDL = options.UDL // user data length
    this.UD = options.UD // user data
  }

  static from (options) {
    const pdu = new SUBMIT()
    pdu.MR = options.reference & 0xFF
    pdu.DA = Address.encode(options.destination)

    // todo
    pdu.VPF = options.validity ? 0x03 : 0x00
    pdu.VP = ValidityPeriod.encode(options.validity, options.VPF)

    pdu.SRR = !!options.report

    pdu.PID = options.pid || 0

    let coding = options.coding || 'default'
    let content = options.content || ''

    if (options.dcs !== undefined) {
      pdu.DCS = options.dcs
      const scheme = dcs.sms.decode(options.dcs)
      if (!scheme) {
        debug('can not detect scheme for DSC', options.dcs)
        return
      }
      debug('DCS scheme', scheme)
      coding = scheme.coding
      if (coding === 'binary') {
        if (typeof content === 'string') {
          content = Buffer.from(content, 'hex')
        }
      }
    } else {
      pdu.DCS = dcs.sms.encode({ coding })
    }

    if (typeof options.udh === 'string') {
      options.udh = Buffer.from(options.udh, 'hex')
    }
    const udh = Buffer.isBuffer(options.udh) ? options.udh : UDH.encode(options.udh)
    pdu.UDH = udh // not actually a known property
    pdu.UDHI = !!udh
    const ud = UD.encode(content, coding, udh)
    pdu.UD = ud.buffer
    pdu.UDL = ud.length

    return pdu
  }

  headers () {
    return (this.MTI & 0b11) |
      ((this.RD & 0b1) << 2) |
      ((this.VPF & 0b11) << 3) |
      ((this.SRR & 0b1) << 5) |
      ((this.UDHI & 0b1) << 6) |
      ((this.RP & 0b1) << 7)
  }

  encode () {
    // const elements = [this.headers(), this.MR, this.DA, this.PID, this.DCS, this.VP, this.UDL, this.UD]
    // debug(elements)
    // return Buffer.concat(elements)

    // fixed length: headers, mr, pid, dcs, udl - total 5 bytes

    const length = 5 + this.DA.length + this.VP.length + this.UD.length
    const buffer = Buffer.alloc(length)
    let offset = 0

    buffer[offset++] = this.headers()
    buffer[offset++] = this.MR
    this.DA.copy(buffer, offset)
    offset += this.DA.length
    buffer[offset++] = this.PID
    buffer[offset++] = this.DCS
    this.VP.copy(buffer, offset)
    offset += this.VP.length
    buffer[offset++] = this.UDL
    this.UD.copy(buffer, offset)

    return buffer
  }
}

class DELIVER extends TPDU {
  constructor (options = {}) {
    super(options)

    this.MTI = MTI.encode.NETWORK.DELIVER // message type indicator
    // this.MTI = 0 // message type indicator
    this.MMS = options.MMS // more messages to send
    this.LP = options.LP // loop prevention (ETSI TS 123 040)
    this.RP = options.RP // reply path
    this.UDHI = options.UDHI // user data header included
    this.SRI = options.SRI // status report indication

    this.OA = options.OA // originating address
    this.PID = options.PID // protocol identifier
    this.DCS = options.DCS // data coding schema
    this.SCTS = options.SCTS // service centre time stamp
    this.UDL = options.UDL // user data length
    this.UD = options.UD // user data
  }

  headers () {
    return (this.MTI & 0x03) |
      ((this.MMS & 0x01) << 2) |
      ((this.LP & 0x01) << 3) |
      ((this.SRI & 0x01) << 5) |
      ((this.UDHI & 0x01) << 6) |
      ((this.RP & 0x01) << 7)
  }

  static from (options) {
    const pdu = new DELIVER()
    pdu.OA = Address.encode(options.source)

    pdu.SRI = options.report
    pdu.PID = options.pid

    let coding
    if (options.dcs !== undefined) {
      pdu.DCS = options.dcs
      const scheme = dcs.sms.decode(options.dcs)
      if (!scheme) return
      coding = scheme.coding
    } else {
      coding = options.coding || 'default'
      pdu.DCS = dcs.sms.encode({ coding })
    }

    pdu.SCTS = TimeStamp.encode(options.timestamp || new Date())

    const udh = UDH.encode(options.udh)
    pdu.UDH = udh // not actually a known property
    pdu.UDHI = !!udh
    const ud = UD.encode(options.content, coding, udh)
    pdu.UD = ud.buffer
    pdu.UDL = ud.length

    return pdu
  }

  static parse (buffer, type) {
    const pdu = new DELIVER()
    let offset = 0

    const headers = buffer[offset++]
    pdu.MTI = headers & 0b11
    pdu.RP = (headers >> 7) & 1
    pdu.UDHI = (headers >> 6) & 1
    pdu.SRI = (headers >> 5) & 1
    pdu.LP = (headers >> 3) & 1
    pdu.MMS = (headers >> 2) & 1

    const len = Address.readLength(buffer.slice(offset))
    pdu.OA = buffer.slice(offset, offset + len)
    offset += len

    pdu.PID = buffer[offset++]
    pdu.DCS = buffer[offset++]
    pdu.SCTS = buffer.slice(offset, offset + 7)
    offset += 7
    pdu.UDL = buffer[offset++]
    pdu.UD = buffer.slice(offset)

    return pdu
  }

  decode () {
    const scheme = dcs.sms.decode(this.DCS)
    if (!scheme) return
    let coding = scheme.coding

    const { udh, content } = UD.decode(this.UD, coding, this.UDHI, this.UDL)

    const options = {
      type: 'DELIVER',
      timestamp: TimeStamp.decode(this.SCTS),
      // PID: this.PID, // todo
      source: Address.decode(this.OA),
      report: !!this.SRI,
      dcs: this.DCS,
      pid: this.PID,
      // scheme,
      coding,
      content
    }

    if (udh) {
      options.udh = UDH.decode(udh)
    }

    return options
  }

  encode () {
    // const elements = [this.headers(), this.OA, this.PID, this.DCS, this.SCTS, this.UDL, this.UD]
    // debug(elements)
    // return Buffer.concat(elements)

    // fixed length: headers, pid, dcs, udl - total 4 bytes
    const length = 4 + this.OA.length + this.SCTS.length + this.UD.length
    const buffer = Buffer.alloc(length)
    let offset = 0

    buffer[offset++] = this.headers()
    this.OA.copy(buffer, offset)
    offset += this.OA.length
    buffer[offset++] = this.PID
    buffer[offset++] = this.DCS
    this.SCTS.copy(buffer, offset)
    offset += this.SCTS.length
    buffer[offset++] = this.UDL
    this.UD.copy(buffer, offset)

    return buffer
  }
}

const COMMANDS = ['enquire', 'cancel', 'delete', 'report']

class COMMAND extends TPDU {
  constructor (options = {}) {
    super(options)

    this.MTI = MTI.encode.MS.COMMAND // message type indicator
    this.UDHI = options.UDHI // user data header included
    this.SRR = options.SRR // status report requested

    this.MR = options.MR // message reference
    this.PID = options.PID // protocol identifier
    this.CT = options.CT // command type
    this.MN = options.MN // message number
    this.DA = options.DA // destination address
    this.CDL = options.CDL // command data length
    this.CD = options.CD // command data
  }

  headers () {
    return (this.MTI & 0b11) |
      ((this.SRR & 0b1) << 5) |
      ((this.UDHI & 0b1) << 6)
  }

  static parse () {
    // pdu.MR = buffer[offset++]
  }

  static from (options) {
    const pdu = new COMMAND()
    pdu.SRR = !!options.report

    pdu.MR = options.reference & 0xFF
    pdu.PID = options.pid // todo
    pdu.CT = Number.isInteger(options.command) ? options.command : COMMANDS[options.command]
    pdu.MN = options.message_number

    pdu.DA = Address.encode(options.destination)

    pdu.CD = Buffer.from(options.content) || Buffer.alloc(0)
    pdu.CDL = pdu.CD.length

    return pdu
  }

  encode () {
    // fixed length: headers, mr, pid, ct, mn, cdl - total 6 bytes
    const length = 6 + this.DA.length + this.CD.length
    const buffer = Buffer.alloc(length)
    let offset = 0

    buffer[offset++] = this.headers()
    buffer[offset++] = this.MR
    buffer[offset++] = this.PID
    buffer[offset++] = this.CT
    buffer[offset++] = this.MN

    this.DA.copy(buffer, offset)
    offset += this.DA.length

    buffer[offset++] = this.CDL
    this.CD.copy(buffer, offset)

    return buffer
  }
}

class SUBMIT_REPORT extends TPDU {
  constructor (options = {}) {
    super(options)

    this.MTI = MTI.encode.NETWORK['SUBMIT-REPORT']
  }

  headers () {
    return (this.MTI & 0b11) |
      ((this.UDHI & 0x01) << 6)
  }

  static from (options) {
    const pdu = new SUBMIT_REPORT()

    // todo

    return pdu
  }

  static parse (buffer, type) {
    const pdu = new SUBMIT_REPORT()
    let offset = 0

    const headers = buffer[offset++]
    pdu.MTI = headers & 0b11
    pdu.UDHI = (headers >> 6) & 1

    if (type === 'error') pdu.FCS = buffer[offset++]

    pdu.PI = buffer[offset++]
    pdu.SCTS = buffer.slice(offset, offset + 7)
    offset += 7

    const present = {
      PID: (pdu.PI >> 0) & 1,
      DCS: (pdu.PI >> 1) & 1,
      UDL: (pdu.PI >> 2) & 1
    }

    let next = ['PID', 'DCS', 'UDL']
    let key
    while ((key = next.shift())) {
      if (present[key]) {
        pdu[key] = buffer[offset++]
      }
    }

    if (present.UDL) {
      pdu.UD = buffer.slice(offset)
    }

    return pdu
  }

  decode () {
    const options = {
      type: 'SUBMIT-REPORT',
      timestamp: TimeStamp.decode(this.SCTS)
      // content: this.UD,
    }

    if ('FCS' in this) {
      options.cause = Errors[this.FCS] || this.FCS
    }

    // todo
    // options.PID = this.PID
    // options.DCS = this.DCS

    if (('DCS' in this) && this.UD) {
      const scheme = dcs.sms.decode(this.DCS)
      if (!scheme) return
      let coding = scheme.coding
      options.coding = coding

      const { udh, content } = UD.decode(this.UD, coding, this.UDHI)

      if (udh) {
        options.header = UDH.decode(udh)
      }

      options.content = content
    }

    return options
  }

  encode () {
    // fixed length: headers, pid, dcs, udl - total 4 bytes
    const length = 4 + this.OA.length + this.SCTS.length + this.UD.length
    const buffer = Buffer.alloc(length)
    let offset = 0

    buffer[offset++] = this.headers()
    this.OA.copy(buffer, offset)
    offset += this.OA.length
    buffer[offset++] = this.PID
    buffer[offset++] = this.DCS
    this.SCTS.copy(buffer, offset)
    offset += this.SCTS.length
    buffer[offset++] = this.UDL
    this.UD.copy(buffer, offset)

    return buffer
  }
}

class DELIVER_REPORT extends TPDU {
  constructor (options = {}) {
    super(options)
    // todo
  }

  headers () {
    return (this.MTI & 0b11) |
      ((this.UDHI & 0x01) << 6)
  }

  static from (options) {
    const pdu = new DELIVER_REPORT()
    // todo

    return pdu
  }

  static parse (buffer, type) {
    const pdu = new DELIVER_REPORT()
    // todo

    return pdu
  }

  decode () {
    const options = {}
    // todo

    return options
  }

  encode () {
    // todo
  }
}

class STATUS_REPORT extends TPDU {
  constructor (options = {}) {
    super(options)

    this.MTI = MTI.encode.NETWORK['STATUS-REPORT']
  }

  headers () {
    return (this.MTI & 0b11) |
      ((this.UDHI & 0x01) << 6)
  }

  static from (options) {
    const pdu = new STATUS_REPORT()

    // todo

    return pdu
  }

  static parse (buffer, type) {
    const pdu = new STATUS_REPORT()
    let offset = 0

    const headers = buffer[offset++]
    pdu.MTI = headers & 0b11

    pdu.UDHI = (headers >> 6) & 1
    pdu.SRQ = (headers >> 5) & 1
    pdu.LP = (headers >> 3) & 1
    pdu.MMS = (headers >> 2) & 1

    if (type === 'error') pdu.FCS = buffer[offset++]

    pdu.MR = buffer[offset++]

    const len = Address.readLength(buffer.slice(offset))
    pdu.RA = buffer.slice(offset, offset + len)
    offset += len

    pdu.SCTS = buffer.slice(offset, offset + 7)
    offset += 7

    pdu.DT = buffer.slice(offset, offset + 7)
    offset += 7

    pdu.ST = buffer[offset]

    pdu.PI = buffer[offset++]

    const present = {
      PID: (pdu.PI >> 0) & 1,
      DCS: (pdu.PI >> 1) & 1,
      UDL: (pdu.PI >> 2) & 1
    }

    let next = ['PID', 'DCS', 'UDL']
    let key
    while ((key = next.shift())) {
      if (present[key]) {
        pdu[key] = buffer[offset++]
      }
    }

    if (present.UDL) {
      pdu.UD = buffer.slice(offset)
    }

    return pdu
  }

  decode () {
    // return this
    const options = {
      type: 'STATUS-REPORT',
      reference: this.MR,
      recipient: Address.decode(this.RA),
      timestamp: TimeStamp.decode(this.SCTS),
      discharge: TimeStamp.decode(this.DT),
      status: Status.decode(this.ST)
      // content: this.UD,
    }

    // todo dcs etc, common with submit reposrt
    return options
  }

  encode () {
    // fixed length: headers, pid, dcs, udl - total 4 bytes
    const length = 4 + this.OA.length + this.SCTS.length + this.UD.length
    const buffer = Buffer.alloc(length)
    let offset = 0

    buffer[offset++] = this.headers()
    this.OA.copy(buffer, offset)
    offset += this.OA.length
    buffer[offset++] = this.PID
    buffer[offset++] = this.DCS
    this.SCTS.copy(buffer, offset)
    offset += this.SCTS.length
    buffer[offset++] = this.UDL
    this.UD.copy(buffer, offset)

    return buffer
  }
}

function decode (message) {
  const buffer = message.content
  const type = MTI.decode[message.network ? 'NETWORK' : 'MS'][buffer[0] & 0b11]
  debug('[%s] SMS-%s %j', message.network ? 'network' : 'ms', type, message)

  if (!type || type === 'Reserved') {
    debug('invalid MTI', buffer[0])
    return
  }

  let tpdu
  switch (type) {
    case 'SUBMIT':
      tpdu = SUBMIT.parse(buffer)
      break
    case 'DELIVER':
      tpdu = DELIVER.parse(buffer)
      break
    case 'COMMAND':
      tpdu = COMMAND.parse(buffer)
      break
    case 'SUBMIT-REPORT':
      tpdu = SUBMIT_REPORT.parse(buffer, message.type)
      break
    case 'DELIVER-REPORT':
      tpdu = DELIVER_REPORT.parse(buffer, message.type)
      break
    case 'STATUS-REPORT':
      tpdu = STATUS_REPORT.parse(buffer, message.type)
      break
  }

  return tpdu.decode()
}

module.exports = { SUBMIT, DELIVER, COMMAND, SUBMIT_REPORT, DELIVER_REPORT, STATUS_REPORT, decode }
