const debug = require('debug')('sms:ud')

const alphabets = require('./alphabets')

class UD {
  static encode (data, coding, udh) {
    // ETSI TS 123 040 V9.3.0 page 74;

    debug('encode', data, coding, udh)

    let buffer = Buffer.alloc(0)
    let udhLength = 0
    let udLength = 0

    switch (coding) {
      case 'default':
      case 'gsm7bit':
      default:
        if (udh) {
          udhLength = Math.ceil(udh.length * 8 / 7)
          buffer = alphabets.gsm7bit.encode('@'.repeat(udhLength) + data)
          udh.copy(buffer)
        } else {
          buffer = alphabets.gsm7bit.encode(data)
        }
        udLength = data.length
        break
      case 'binary':
        // data should contain binary data (buffer)
        if (udh) {
          udhLength = udh.length
          buffer = Buffer.concat([udh, data])
        } else {
          buffer = data
        }
        udLength = data.length
        break
      case 'ucs2':
        buffer = alphabets.ucs2.encode(data)
        debug('user data for UCS2', buffer)
        if (udh) {
          udhLength = udh.length
          buffer = Buffer.concat([udh, buffer])
        }
        udLength = data.length * 2
        break
      // default:
      //   throw new Error('wrong DCS/encoding')
    }

    const length = udhLength + udLength
    // debug('UDL=', udl, udhLength, udLength)

    return { buffer, length }
  }

  static decode (buffer, coding, udhi, udl) {
    debug('UD decode: coding %s, udhi %s, udl %s', coding, udhi, udl, buffer)
    const ud = {}
    let headerLength = 0

    if (udhi) {
      headerLength = buffer.readUInt8(0) + 1
      ud.udh = buffer.slice(0, headerLength)
    }

    switch (coding) {
      case 'default':
      case 'gsm7bit':
      default:
        // todo get rid of hack and use UDL to detect extra char @. Do testing
        // next is a hack: cut decoded content at UDH boundary
        ud.content = alphabets.gsm7bit.decode(buffer).substring(Math.ceil(headerLength * 8 / 7))
        break
      case 'binary':
        ud.content = buffer.slice(headerLength)
        break
      case 'ucs2':
        ud.content = alphabets.ucs2.decode(buffer.slice(headerLength))
        break
    }
    // debug('UD decoded', ud)

    return ud
  }
}

module.exports = { UD }
