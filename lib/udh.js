const debug = require('debug')('sms:udh')

/*
00 Concatenated short messages, 8-bit reference number SMS Control No
01 Special SMS Message Indication SMS Control Yes
02 Reserved N/A N/A
03 Value not used to avoid misinterpretation as <LF> character N/A N/A
04 Application port addressing scheme, 8 bit address SMS Control No
05 Application port addressing scheme, 16 bit address SMS Control No
06 SMSC Control Parameters SMS Control No
07 UDH Source Indicator  SMS Control Yes
08 Concatenated short message, 16-bit reference number SMS Control No
09 Wireless Control Message Protocol SMS Control Note 3
0A Text Formatting EMS Control Yes
0B Predefined Sound EMS Content Yes
0C User Defined Sound (iMelody max 128 bytes) EMS Content Yes
0D Predefined Animation EMS Content Yes
0E Large Animation (16*16 times 4 = 32*4 =128 bytes) EMS Content Yes
0F Small Animation (8*8 times 4 = 8*4 =32 bytes) EMS Content Yes
10 Large Picture (32*32 = 128 bytes) EMS Content Yes
11 Small Picture (16*16 = 32 bytes) EMS Content Yes
12 Variable Picture EMS Content Yes
13 User prompt indicator EMS Control Yes
14 Extended Object EMS Content Yes
15 Reused Extended Object EMS Control Yes
16 Compression Control EMS Control No
17 Object Distribution Indicator EMS Control Yes
18 Standard WVG object EMS Content Yes
19 Character Size WVG object EMS Content Yes
1A Extended Object Data Request Command EMS Control No
1B-1F Reserved for future EMS features (see subclause 3.10) N/A N/A
20 RFC 822 E-Mail Header SMS Control No
21 Hyperlink format element SMS Control Yes
22 Reply Address Element SMS Control No
23 Enhanced Voice Mail Information SMS Control No
24 National Language Single Shift  SMS Control No
25 National Language Locking Shift SMS Control No
 */

const IE = {
  0: {
    key: 'sms',
    length: 3,
    name: 'CONCATENATED_SHORT_MESSAGES_8BIT',
    decode: b => {
      return { ref: b[0], total: b[1], seq: b[2] }
    },
    encode: o => {
      return Buffer.from([o.ref, o.total, o.seq], 'raw')
    },
    repeat: false
  },
  4: {
    key: 'port',
    length: 2,
    name: 'APPLICATION_PORT_ADDRESSING_SCHEME_8BIT',
    decode: b => {
      return { dst: b[0], src: b[1] }
    },
    encode: o => {
      return Buffer.from([o.dst, o.src], 'raw')
    },
    repeat: false
  },
  5: {
    key: 'port',
    length: 4,
    name: 'APPLICATION_PORT_ADDRESSING_SCHEME_16BIT',
    decode: b => {
      return { dst: b.readUInt16BE(0), src: b.readUInt16BE(2) }
    },
    encode: o => {
      const b = Buffer.alloc(4)
      b.writeUInt16BE(o.dst, 0)
      b.writeUInt16BE(o.src, 2)

      return b
    },
    repeat: false
  },
  8: {
    key: 'sms',
    length: 4,
    name: 'CONCATENATED_SHORT_MESSAGES_16BIT',
    decode: b => {
      return { ref: b.readUInt16BE(0), total: b[2], seq: b[3] }
    },
    encode: o => {
      const b = Buffer.alloc(4)
      b.writeUInt16BE(o.ref, 0)
      b[2] = o.total
      b[3] = o.seq

      return b
    },
    repeat: false
  }
}

const UDH = {
  prepare (udh = []) {
    // if (!udh) return
    const ies = []
    for (const e in udh) {
      if (e === 'sms') {
        const ieId = 0
        ies.push({ ieId, data: udh.sms })
      } else if (e === 'port') {
        if (typeof udh.port !== 'object') {
          udh.port = { dst: +udh.port, src: 0 }
        }
        const ieId = (udh.port.src > 0xff || udh.port.dst > 0xff) ? 5 : 4
        ies.push({ ieId, data: udh.port })
      } else {
        ies.push({ ieId: e, data: udh[e] })
      }
    }

    debug('prepared UDH informational elements %j', ies)
    return ies
  },

  length (udh) {
    const ies = UDH.prepare(udh)
    let length = 0
    ies.forEach(({ ieId, data }) => {
      if (IE[ieId]) {
        length += 2 + IE[ieId].length
        debug(ieId, length)
      } else {
        length += 2 + data.length
      }
    })

    return length + 1
  },
  encode (udh) {
    const ies = UDH.prepare(udh)
    // if (!ies) return

    let length = 0
    const buffers = []

    ies.forEach(({ ieId, data }) => {
      let cursor = 0
      let buffer
      // console.log(ieId, data)
      if (IE[ieId]) {
        // known IEs
        const ie = IE[ieId].encode(data)
        // length += 2 + ie.length
        buffer = Buffer.alloc(2 + ie.length)
        buffer[cursor++] = ieId
        buffer[cursor++] = ie.length
        ie.copy(buffer, cursor)
      } else {
        // raw IE
        if (!data) data = ''
        if (typeof data === 'string') data = Buffer.from(data, 'hex')
        buffer = Buffer.alloc(data.length + 2)
        buffer[0] = +ieId
        buffer[1] = data.length
        data.copy(buffer, 2)
      }
      length += buffer.length
      buffers.push(buffer)
    })

    if (length) {
      buffers.unshift(Buffer.from([length], 'raw'))
      return Buffer.concat(buffers)
    }
  },

  decode (buffer, sms) {
    /*
    https://github.com/hdiniz/smsjs
    https://github.com/ethanwu118/CDMA_SMS_Parser
    ts_123040v090300p
    https://github.com/mozilla-services/services-central-legacy/blob/0d477ba40457ac842697b77478254bca040c5d21/dom/system/gonk/ril_worker.js
     */

    let cursor = 0

    const udhLength = buffer[cursor++]
    const ies = []

    if (udhLength <= 0) {
      return
    }

    while (cursor < udhLength + 1) {
      const id = buffer[cursor++]
      const length = buffer[cursor++]
      const data = buffer.slice(cursor, cursor + length)
      cursor += length
      const ie = { id, length, data }
      ies.push(ie)
    }

    const result = { ies }
    ies.forEach(ie => {
      if (ie.id in IE) {
        const decoded = IE[ie.id].decode(ie.data)
        const key = IE[ie.id].key
        if (IE[ie.id].repeat) {
          if (!result[key]) result[key] = []
          result[key].push(decoded)
        } else {
          result[key] = decoded
        }
      }
    })

    return result
  }
}

module.exports = { UDH }
