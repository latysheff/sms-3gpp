const assert = require('assert')

// ETSI TS 100 900
// GSM 03.38
// 6.1.2.1.1 Packing of 7-bit characters

const GSM_ALPHABET = '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1bÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'

const gsm7bit = {
  alphabet: GSM_ALPHABET,
  encode: function (value) {
    if (!value) {
      return Buffer.alloc(0)
    }

    const buffer = Buffer.alloc(Math.ceil((value.length * 7) / 8))
    for (let i = 0; i < value.length; i++) {
      const char = GSM_ALPHABET.indexOf(value.charAt(i))

      assert(char > -1, `invalid alphabet for [${value}]`)

      let ls = char << ((8 - (i % 8)) % 8)
      const hs = (ls & 0xffff) >>> 8
      ls &= 0xff

      const index = ((i * 7) / 8) | 0
      buffer[index] |= ls

      if (index + 1 < buffer.length) {
        buffer[index + 1] |= hs
      }
    }

    return buffer
  },

  decode: function (buffer, length) {
    let result = ''
    let carry = 0

    for (let i = 0; i < buffer.length; i++) {
      carry |= buffer[i] << (i % 7)

      if (result.length === length) return result

      result += GSM_ALPHABET[carry & 0x7f]
      carry >>>= 7

      if (result.length === length) return result

      if (i % 7 === 6) {
        result += GSM_ALPHABET[carry & 0x7f]
        carry >>>= 7
      }
    }

    return result
  }
}

const ussd7bit = {
  /* 6.1.2.3.1 Packing of 7 bits */
  encode: function (value) {
    if (value.length * 7 % 8 === 1) {
      value = value + '\r'
    }

    return gsm7bit.encode(value)
  },

  decode: function (buffer) {
    let content = gsm7bit.decode(buffer)
    if (content && content.charAt(content.length - 1) === '\r') content = content.substring(0, content.length - 1)

    return content
  }
}

const ucs2 = {
  encode: function (value) {
    let buffer = Buffer.from(value, 'ucs2')
    buffer = toggle(buffer, 2)

    return buffer
  },
  decode: function (buffer) {
    return toggle(buffer, 2).toString('ucs2')
  }
}

function toggle (buffer, bytes = 1) {
  const output = Buffer.alloc(buffer.length)

  for (let i = 0; i < buffer.length; i += bytes) {
    for (let j = 0; j < bytes; j++) {
      output[i + bytes - j - 1] = buffer[i + j]
    }
  }

  return output
}

module.exports = { gsm7bit, ussd7bit, ucs2 }
