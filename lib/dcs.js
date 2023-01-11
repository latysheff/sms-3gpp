const LANGUAGES = [
  'german',
  'english',
  'italian',
  'french',
  'spanish',
  'dutch',
  'swedish',
  'danish',
  'portuguese',
  'finnish',
  'norwegian',
  'greek',
  'turkish',
  'reserved1',
  'reserved2',
  'unpecified'
]

const languages = {}
LANGUAGES.forEach((key, index) => {
  languages[key] = index
})

const CODING = ['default', 'binary', 'ucs2', 'reserved']

const coding = {}
CODING.forEach((key, index) => {
  coding[key] = index
})

/*
 Bit 1 Bit 0 Message Class
 0 0 Class 0
 0 1 Class 1   Default meaning: ME-specific.
 1 0 Class 2   SIM specific message
 1 1 Class 3   Default meaning: TE specific (see GSM TS 07.05 [8])
 */

const dcs = {
  sms: {
    encode: function (scheme = {}) {
      // throw Error('not implemented')
      return scheme.coding === 'ucs2' ? 8 : 0
    },

    decode: function (buffer) {
      let octet

      if (typeof buffer === 'number') {
        octet = buffer
      } else if (Buffer.isBuffer(buffer)) {
        octet = buffer[0]
      } else {
        throw new TypeError('invalid type of DCS')
      }

      const scheme = { coding: 'default' }

      const high = octet >>> 4
      // let low = octet & 0x0f

      if (octet === 0) {
        scheme.group = 'general'
        scheme.coding = 'default'
      } else if (high >>> 2 === 0b00) { // 00xx
        scheme.group = 'general'
        scheme.compressed = !!(high & 0b0010)
        scheme.coding = CODING[(octet & 0b1100) >>> 2]
        scheme.haveClass = !!(high & 0b0001)
        scheme.class = octet & 0b0011
      } else if (high >>> 2 === 0b11) {
        if (high === 0b1111) {
          scheme.group = 'class'

          if (octet & 0b1000) scheme.error = true

          scheme.coding = (octet & 0b0100) ? 'binary' : 'default'
          scheme.class = octet & 0b0011
        } else {
          // Message Waiting Indication Group
          scheme.group = 'mwi'
          scheme.active = !!(octet & 0b1000)

          if (octet & 0b0100) scheme.error = true

          scheme.type = octet & 0b0011

          if (high === 0b1100) {
            scheme.discard = true
            scheme.coding = 'default'
          } else if (high === 0b1101) {
            scheme.discard = false
            scheme.coding = 'default'
          } else if (high === 0b1110) {
            scheme.discard = false
            scheme.coding = 'ucs2'
          }
        }
      } else {
        scheme.group = 'reserved'
      }

      return scheme
    }
  },
  cell: {
    encode: function (scheme) {
      let octet
      if (typeof scheme !== 'object') {
        if (typeof scheme === 'string') {
          scheme = { coding: scheme }
        } else {
          throw Error('DCS should be an object or string')
        }
      }
      if (!scheme.group) {
        if (scheme.compressed || scheme.coding === 'ucs2' || scheme.coding === 'reserved') {
          // binary and default coding will be encoded by '1111' or '0000' scheme
        } else if (scheme.coding === 'binary' || ('class' in scheme)) {
          scheme.group = 'class'
        } else {
          scheme.group = 'default'
        }
      }
      switch (scheme.group) {
        case 'default':
          if (!scheme.language) scheme.language = 'unpecified'
          octet = languages[scheme.language]
          break
        case 'general':
          octet = 0b01000000 | (scheme.compressed << 5) | (scheme.haveClass << 4) |
            ((coding[scheme.coding] << 2) & 0b1100) | (scheme.class & 0b0011)
          break
        case 'class':
          octet = 0b11110000 | ((scheme.coding === 'binary') << 2) | (scheme.class & 0b0011)
          break
      }

      return Buffer.from([octet], 'raw')
    },
    decode: function (buffer) {
      let octet

      if (typeof buffer === 'number') {
        octet = buffer
      } else if (Buffer.isBuffer(buffer)) {
        octet = buffer[0]
      } else {
        throw new TypeError('invalid type of DCS')
      }

      const scheme = {
        coding: 'default'
      }

      const high = octet >>> 4
      const low = octet & 0x0f

      if (high === 0) {
        scheme.group = 'default'
        scheme.language = LANGUAGES[octet & 0x0f] || low
      } else if (high >>> 2 === 0) {
        scheme.group = 'reserved'
      } else if (high >>> 2 === 0b01) {
        scheme.group = 'general'
        scheme.compressed = !!(high & 0b0010)
        scheme.coding = CODING[(octet & 0b1100) >>> 2]
        scheme.haveClass = !!(high & 0b0001)
        scheme.class = octet & 0b0011
      } else if (high === 0b1111) {
        scheme.group = 'class'

        if (octet & 0b1000) scheme.error = true

        scheme.coding = (octet & 0b0100) ? 'binary' : 'default'
        scheme.class = octet & 0b0011
      } else {
        scheme.group = 'reserved'
      }

      return scheme
    }
  }
}

module.exports = dcs
