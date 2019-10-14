// const debug = require('debug')('sms:rplib')
const { SemiOctet } = require('./tplib')

/*
GSM 04.11 Version 5.1.0 March 1996

Abbreviations:
SM-AL  Short Message Application Layer
SM-TL  Short Message Transfer Layer
SM-RL  Short Message Relay Layer
SM-RP  Short Message Relay Protocol SMR  Short Message Relay (entity)
CM-sub  Connection Management sublayer
SM-CP  Short Message Control Protocol SMC  Short Message Control (entity)
MM-sub : Mobility Management sublayer
RR-sub : Radio Resource Management sublayer
 */

const Errors = {
  1: 'Unassigned (unallocated) number',
  8: 'Operator determined barring',
  10: 'Call barred',
  11: 'Reserved',
  21: 'Short message transfer rejected',
  27: 'Destination out of order',
  28: 'Unidentified subscriber',
  29: 'Facility rejected',
  30: 'Unknown subscriber',
  38: 'Network out of order',
  41: 'Temporary failure',
  42: 'Congestion',
  47: 'Resources unavailable, unspecified',
  50: 'Requested facility not subscribed',
  69: 'Requested facility not implemented',
  81: 'Invalid short message transfer reference value',
  95: 'Semantically incorrect message',
  96: 'Invalid mandatory information',
  97: 'Message type non-existent or not implemented',
  98: 'Message not compatible with short message protocol state',
  99: 'Information element non-existent or not implemented',
  111: 'Protocol error, unspecified',
  127: 'Interworking, unspecified'
}

/*

Annex E (informative):
Cause definition

0 0 0 0 0 0 1 1 Unassigned (unallocated) number
0 0 0 1 0 0 0 8 Operator determined barring
0 0 0 1 0 1 0 10 Call barred
0 0 0 1 0 1 1 11 Reserved
0 0 1 0 1 0 1 21 Short message transfer rejected
0 0 1 1 0 1 1 27 Destination out of order
0 0 1 1 1 0 0 28 Unidentified subscriber
0 0 1 1 1 0 1 29 Facility rejected
0 0 1 1 1 1 0 30 Unknown subscriber
0 1 0 0 1 1 0 38 Network out of order
0 1 0 1 0 0 1 41 Temporary failure
0 1 0 1 0 1 0 42 Congestion
0 1 0 1 1 1 1 47 Resources unavailable, unspecified
0 1 1 0 0 1 0 50 Requested facility not subscribed
1 0 0 0 1 0 1 69 Requested facility not implemented
1 0 1 0 0 0 1 81 Invalid short message transfer reference value
1 0 1 1 1 1 1 95 Semantically incorrect message
1 1 0 0 0 0 0 96 Invalid mandatory information
1 1 0 0 0 0 1 97 Message type non-existent or not implemented
1 1 0 0 0 1 0 98 Message not compatible with short message protocol state
1 1 0 0 0 1 1 99 Information element non-existent or not implemented
1 1 0 1 1 1 1 111 Protocol error, unspecified
1 1 1 1 1 1 1 127 Interworking, unspecified

7 6 5 4 3 2 1 #
0 0 1 0 1 1 0 22 Memory capacity exceeded
1 0 1 0 0 0 1 81 Invalid short message transfer reference value
1 0 1 1 1 1 1 95 Semantically incorrect message
1 1 0 0 0 0 0 96 Invalid mandatory information
1 1 0 0 0 0 1 97 Message type non-existent or not implemented
1 1 0 0 0 1 0 98 Message not compatible with short message protocol state
1 1 0 0 0 1 1 99 Information element non-existent or not implemented
1 1 0 1 1 1 1 111 Protocol error, unspecified

All other cause values shall be treated as cause number 111, "Protocol error, unspecified".
 */

/*
8.2.2 Message type indicator (MTI)
The message type indicator, MTI, is a 3-bit field, located in the first octet of all RP-messages. The coding of the MTI is defined by table 8.3/GSM 04.11.

const MTI_ = {
  decode: {
    'MS': {
      0b000: 'DATA',
      0b001: 'Reserved',
      0b010: 'ACK',
      0b011: 'Reserved',
      0b100: 'ERROR',
      0b101: 'Reserved',
      0b110: 'SMMA',
      0b111: 'Reserved'
    },
    'NETWORK': {
      0b000: 'Reserved',
      0b001: 'DATA',
      0b010: 'Reserved',
      0b011: 'ACK',
      0b100: 'Reserved',
      0b101: 'ERROR',
      0b110: 'Reserved',
      0b111: 'Reserved'
    }
  },
  encode: {
    'MS': {
      'DATA': 0,
      'ACK': 2,
      'ERROR': 4,
      'SMMA': 6
    },
    'NETWORK': {
      'DATA': 1,
      'ACK': 3,
      'ERROR': 5
    }
  }
}

 */

const MTI = {
  list: ['DATA', 'ACK', 'ERROR', 'SMMA'],
  encode: function (type, network) {
    // todo benchmark vs object
    return MTI.list.indexOf(type) << 1 | !!network
  },
  decode: function (bits) {
    return {
      type: MTI.list[(bits >> 1) & 0b11],
      network: !!(bits & 1)
    }
  }
}

/*
Page 35
GSM 04.11 Version 5.1.0 March 1996
8.2.5.2 Destination address element
 */
const RPAddress = {
  encode (address) {
    if (!address) return Buffer.from([0], 'raw')
    let ton = 1
    let npi = 1
    if (typeof address === 'object') {
      ton = address.ton
      npi = address.npi
      address = address.number
    }
    let digits = SemiOctet.encode(address)
    let result = Buffer.alloc(digits.length + 2)
    result[0] = digits.length + 1
    result[1] = 0x80 | ton << 4 | npi
    digits.copy(result, 2)

    return result
  },
  decode (buf) {
    let offset = buf.__offset
    let buffer = buf.slice(offset)

    if (buffer[0] === 0) {
      buf.__offset++
      return
    }

    const end = buffer[0] + 1
    buffer.offset = end

    let address = {
      ton: buffer[1] >>> 4 & 0b111,
      npi: buffer[1] & 0b1111,
      number: SemiOctet.decode(buffer.slice(2, end))
    }

    buf.__offset = end + 2
    return address
  },
  getLength (buffer) {
    return 1 + buffer[0]
  }
}

module.exports = { Errors, MTI, RPAddress }
