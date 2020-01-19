const debug = require('debug')('sms:tplib')

const alphabets = require('./alphabets')

// 9.1.2.3 Semi-octet representation
const SemiOctet = {
  encodeTable: {
    0: 0,
    1: 1,
    2: 2,
    3: 3,
    4: 4,
    5: 5,
    6: 6,
    7: 7,
    8: 8,
    9: 9,
    '*': 10,
    '#': 11,
    a: 12,
    b: 13,
    c: 14
  },
  encode (number) {
    let digits = []
    for (let i = 0; i < number.length; i += 2) {
      let ln = SemiOctet.encodeTable[number[i]]
      let hn = number[i + 1] ? SemiOctet.encodeTable[number[i + 1]] : 0xf
      digits.push(ln | hn << 4)
    }
    return Buffer.from(digits, 'raw')
  },
  decodeTable: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '#', 'a', 'b', 'c', ''],
  decode (buffer) {
    let number = ''
    for (let i = 0; i < buffer.length; i++) {
      let octet = buffer[i]
      let ln = octet & 0xf
      let hn = octet >>> 4
      number += SemiOctet.decodeTable[ln] + SemiOctet.decodeTable[hn]
    }
    return number
  }
}

// 9.1.2.5 Address fields
const Address = {
  encode (address) {
    let number
    if (typeof address !== 'object') {
      // throw new TypeError('invalid address type ' + address);
      address = {
        number: address,
        ton: 1,
        npi: 1
      }
    }
    if (typeof address.number === 'string') {
      number = address.number
    } else if (typeof address.number === 'number') {
      number = address.number.toString()
    } else {
      const msg = 'Invalid address number'
      debug(msg, address)
      throw new TypeError(msg)
    }
    let ton = +address.ton
    let npi = +address.npi
    let length = number.length
    let encoded
    if (ton === 0x05) {
      npi = 0 // For Type-of-number = 101 bits 3,2,1,0 are reserved and shall be transmitted as 0000
      encoded = alphabets.gsm7bit.encode(number)
      length = Math.ceil(length * 7 / 4)
    } else {
      encoded = SemiOctet.encode(number)
      // length = number.length;
    }
    let type = npi | (ton << 4) | 0x80
    // The maximum length of the full address field (Address-Length, Type-of-Address and Address-Value) is 12 octets.
    // if (encoded.length > 10) return;
    return Buffer.concat([Buffer.from([length, type], 'raw'), encoded])
  },

  decode (buffer) {
    let result
    let semiOctetsCount = buffer[0]
    let type = buffer[1]
    let npi = type & 0xf
    let ton = (type >>> 4) & 0x7
    let length = Math.ceil(semiOctetsCount / 2) + 2
    let number = ''
    if (length > 0) {
      if (ton === 0x05) {
        length = Math.floor(semiOctetsCount * 4 / 7)
        // todo make decode use buffer length, not number of symbols
        number = alphabets.gsm7bit.decode(buffer.slice(2), length)
      } else {
        number = SemiOctet.decode(buffer.slice(2, length))
      }
    }
    result = {
      ton: ton,
      npi: npi,
      number: number,
      length: length
    }

    buffer.__offset += length
    return result
  },
  readLength (buffer) {
    /*
    The Address-Length field is an integer representation of the number of useful semi-octets within the Address-Value field,
     i.e. excludes any semi octet containing only fill bits.
     */
    let valueLength = Math.ceil(buffer[0] / 2)
    // let ton = (buffer[1] >> 4) & 0b111
    // if (ton === 5) {
    //   valueLength = Math.floor(buffer[0] / 7 * 4)
    // }

    return valueLength + 2
  }
}

// 9.2.3.11 TP-Service-Centre-Time-Stamp (TP-SCTS)

function tz2octet (zone) {
  zone = ~~zone * 4
  const high = zone % 10
  const low = Math.floor(zone / 10)
  return (high << 4) + (zone > 0 ? low : (low | 0b1000))
}

function octet2tz (octet) {
  return (((octet >>> 4) + ((octet & 0b111) * 10)) / 4) * ((octet & 0b1000) ? -1 : 1)
}

function number2octet (number) {
  number = ~~number
  const high = number % 10
  const low = Math.floor(number / 10)
  return (high << 4) + low
}

function octet2number (octet) {
  return (octet >>> 4) + ((octet & 0x0f) * 10)
}

/*
9.2.3.15 TP-Status (TP-ST)

7-й бит 0

Short message transaction completed

 0000000   Short message received by the SME
 0000001   Short message forwarded by the SC to the SME but the SC is unable to confirm delivery
 0000010   Short message replaced by the SC
 0000011..0001111  Reserved
 0010000..0011111  Values specific to each SC

Temporary error, SC still trying to transfer SM

 0100000   Congestion 64
 0100001   SME busy 65
 0100010   No response from SME 66
 0100011   Service rejected 67
 0100100   Quality of service not available 68
 0100101   Error in SME 69
 0100110..0101111  Reserved
 0110000..0111111  Values specific to each SC

Permanent error, SC is not making any more transfer attempts

 1000000   Remote procedure error
 1000001   Incompatible destination
 1000010   Connection rejected by SME
 1000011   Not obtainable
 1000100   Quality of service not available
 1000101   No interworking available
 1000110   SM Validity Period Expired
 1000111   SM Deleted by originating SME
 1001000   SM Deleted by SC Administration
 1001001   SM does not exist (The SM may have previously existed in the SC but the SC no longer has knowledge of it
  or the SM may never have previously existed in the SC)
 1001010..1001111  Reserved
 1010000..1011111  Values specific to each SC

Temporary error, SC is not making any more transfer attempts

 1100000   Congestion
 1100001   SME busy
 1100010   No response from SME
 1100011   Service rejected
 1100100   Quality of service not available
 1100101   Error in SME
 1100110..1101001  Reserved
 1101010..1101111  Reserved
 1110000..1111111  Values specific to each SC

 */

const StatusGroups = {
  0b00: 'Short message transaction completed',
  0b01: 'Temporary error, SC still trying to transfer SM',
  0b10: 'Permanent error, SC is not making any more transfer attempts',
  0b11: 'Temporary error, SC is not making any more transfer attempts'
}

const StatusCodes = {
  0b0000000: 'Short message received by the SME',
  0b0000001: 'Short message forwarded by the SC to the SME but the SC is unable to confirm delivery',
  0b0000010: 'Short message replaced by the SC',
  0b0100000: 'Congestion',
  0b0100001: 'SME busy',
  0b0100010: 'No response from SME',
  0b0100011: 'Service rejected',
  0b0100100: 'Quality of service not available',
  0b0100101: 'Error in SME',
  0b1000000: 'Remote procedure error',
  0b1000001: 'Incompatible destination',
  0b1000010: 'Connection rejected by SME',
  0b1000011: 'Not obtainable',
  0b1000100: 'Quality of service not available',
  0b1000101: 'No interworking available',
  0b1000110: 'SM Validity Period Expired',
  0b1000111: 'SM Deleted by originating SME',
  0b1001000: 'SM Deleted by SC Administration',
  0b1001001: 'SM does not exist (The SM may have previously existed in the SC but the SC no longer has knowledge of it  or the SM may never have previously existed in the SC)',
  0b1100000: 'Congestion',
  0b1100001: 'SME busy',
  0b1100010: 'No response from SME',
  0b1100011: 'Service rejected',
  0b1100100: 'Quality of service not available',
  0b1100101: 'Error in SME'
}

const Status = {
  decode: function (byte) {
    const group = StatusGroups[(byte && 0b01100000) >> 5]
    const reason = StatusCodes[byte && 0b11111]
    return { group, reason }
  }
}

const TimeStamp = {
  CENTURY: (new Date()).getUTCFullYear().toString().substr(0, 2) * 100,
  DEFAULT_TARGET_TIMEZONE: 3,
  DEFAULT_SYSTEM_TIMEZONE: 0,

  encode: function (inputDate, targetTimezone = TimeStamp.DEFAULT_TARGET_TIMEZONE, systemTimezone = TimeStamp.DEFAULT_SYSTEM_TIMEZONE) {
    const date = new Date(inputDate) // we should not alter input date
    date.setTime(date.getTime() - ((systemTimezone - targetTimezone) * 60 * 60 * 1000))
    let year = date.getUTCFullYear() % 100
    let month = date.getUTCMonth() + 1
    let day = date.getUTCDate()
    let hour = date.getUTCHours()
    let minute = date.getUTCMinutes()
    let second = date.getUTCSeconds()

    const buffer = Buffer.alloc(7)
    buffer[0] = number2octet(year)
    buffer[1] = number2octet(month)
    buffer[2] = number2octet(day)
    buffer[3] = number2octet(hour)
    buffer[4] = number2octet(minute)
    buffer[5] = number2octet(second)
    buffer[6] = tz2octet(targetTimezone)

    return buffer
  },
  decode: function (buffer) {
    if (typeof buffer === 'string') buffer = Buffer.from(buffer, 'hex')

    let year = TimeStamp.CENTURY + octet2number(buffer[0])
    let month = octet2number(buffer[1])
    let day = octet2number(buffer[2])
    let hour = octet2number(buffer[3])
    let minute = octet2number(buffer[4])
    let second = octet2number(buffer[5])
    let timezone = octet2tz(buffer[6])

    let date = new Date()
    date.setUTCFullYear(year, month - 1, day)
    date.setUTCHours(hour, minute, second, 0)
    date.setTime(date.getTime() - (timezone * 60 * 60 * 1000))

    return date
  }
}

/*
The Time Zone indicates the difference, expressed in quarters of an hour, between the local time and GMT.
In the first of the two semi-octets, the first bit (bit 3 of the seventh octet of the TP-Service-Centre-Time-Stamp field)
 represents the algebraic sign of this difference (0: positive, 1: negative).
The Service-Centre-Time-Stamp, and any other times coded in this format that are defined in the present document,
 represent the time local to the sending entity.

If the MS has knowledge of the local time zone, then any time received (e.g. Service-Centre-Time-Stamp) at the MS
may be displayed in the local time rather than the time local to the sending entity.
Messages shall be stored as received without change to any time contained therein.

The Time Zone code enables the receiver to calculate the equivalent time in GMT from the other semi-octets in the Service-Centre-Time-Stamp,
or indicate the time zone (GMT, GMT+1H etc.), or perform other similar calculations as required by the implementation.
The value contained in the Time Zone field must take into account daylight saving time,
such that when the sending entity changes from regular (winter) time to daylight saving (summer) time,
 there is a change to the value in the Time Zone field, for example in the UK the winter setting is 00000000 and the summer setting is 01000000.
If the MS receives a non-integer value in the SCTS, it shall assume that the digit is set to 0 but shall store the entire field exactly as received.
 */

// 9.2.3.3 TP-Validity-Period-Format (TP-VPF)
// 9.2.3.12 TP-Validity-Period (TP-VP)

const ValidityPeriod = {
  encode (timestamp, vpf = 0) {
    let buffer = Buffer.alloc(0)
    switch (vpf) {
      case 0x00:
        // VP not present
        break
      case 0x01:
        // 9.2.3.12.3 TP-VP (Enhanced format)
        // todo
        break
      case 0x02:
        // VP relative format
        buffer = Buffer.alloc(1)
        let relative = timestamp

        if (timestamp instanceof Date) {
          let minutes = Math.floor((timestamp - new Date()) / 60000)

          switch (true) {
            case (minutes < 5):
              relative = 0
              break
            case (minutes < 5 * 144):
              relative = Math.floor(minutes / 5)
              break
            case (minutes < 5 * 144 + 30 * 24):
              relative = 143 + Math.ceil((minutes - 5 * 144) / 30)
              break
            case (minutes < 5 * 144 + 30 * 24 + 1440 * 30):
              relative = 166 + Math.ceil((minutes) / 1440)
              break
            case (minutes < 5 * 144 + 30 * 24 + 1440 * 30 + 1440 * 7 * 58):
              relative = 192 + Math.ceil((minutes) / 1440 / 7)
              break
            default:
              relative = 0xff
          }
        }

        buffer[0] = relative
        break
      case 0x03:
        // VP absolute format
        buffer = TimeStamp.encode(timestamp)
        break
    }

    debug('encoded %s to', timestamp, buffer)
    return buffer
  },
  decode (buffer, vpf = 0, decodeAsDate) {
    let timestamp

    switch (vpf) {
      case 0x00:
        // no validity period
        break
      case 0x01:
        // 9.2.3.12.3 TP-VP (Enhanced format)
        // todo
        break
      case 0x02:
        // VP relative format
        let relative = buffer[0]
        if (decodeAsDate) {
          let minutes
          switch (true) {
            case (relative < 144):
              minutes = (relative + 1) * 5 // 5 minutes intervals up to 12 hours
              break
            case (relative < 168):
              minutes = 12 * 60 + (relative - 143) * 30 // half an hour intervals
              break
            case (relative < 197):
              minutes = (relative - 166) * 24 * 60 // days
              break
            default:
              minutes = (relative - 192) * 24 * 60 * 7 // weeks
              break
          }
          timestamp = new Date(Date.now() + minutes * 60 * 1000)
        } else {
          timestamp = relative
        }
        break
      case 0x03:
        timestamp = TimeStamp.decode(buffer)
        break
    }

    return timestamp
  },

  length (vpf) {
    // const LENGTH = [0, 0, 1, 7]
    // return LENGTH[vpf]
    return [0, 0, 1, 7][vpf]
  }
}

/*
00 - 7F Reserved
80 - 8F TP-PID errors
80 Telematic interworking not supported x
81 Short message Type 0 not supported x x
82 Cannot replace short message x x
83 - 8E Reserved
8F Unspecified TP-PID error x x
90 - 9F TP-DCS errors
90 Data coding scheme (alphabet) not supported x
91 Message class not supported  x
92 - 9E Reserved
9F Unspecified TP-DCS error x x
A0 - AF TP-Command Errors
A0 Command cannot be actioned x
A1  Command unsupported x
A2 - AE Reserved
AF Unspecified TP-Command error x
B0 TPDU not supported x x
B1 - BF Reserved
C0 SC busy x
C1 No SC subscription x
C2 SC system failure x
C3 Invalid SME address x
C4 Destination SME barred x
C5  SM Rejected-Duplicate SM x
C6 TP-VPF not supported X
C7 TP-VP not supported X
C8 - CF Reserved
D0 (U)SIM SMS storage full  x
D1 No SMS storage capability in (U)SIM  x
D2 Error in MS  x
D3 Memory Capacity Exceeded  X
D4 (U)SIM Application Toolkit Busy  x
D5 (U)SIM data download error  x D6 - DF Reserved       E0 - FE Values specific to an application x x     FF Unspecified error cause x x
 */

const Errors = {
  0x80: 'Telematic interworking not supported',
  0x81: 'Short message Type 0 not supported',
  0x90: 'Data coding scheme (alphabet) not supported',
  0x91: 'Message class not supported',
  0xC3: 'Invalid SME address',
  0xC4: 'Destination SME barred'
  // 0x91: '',
  // 0x91: '',
  // 0x91: '',
}

module.exports = { SemiOctet, Address, Status, TimeStamp, ValidityPeriod, Errors }
