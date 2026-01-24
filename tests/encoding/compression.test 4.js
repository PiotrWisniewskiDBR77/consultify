/**
 * Compression and Encoding Tests
 * Tests for data compression utilities
 *
 * @module tests/encoding/compression.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Base64 encoding
const createBase64 = () => {
  return {
    encode: (str) => {
      if (typeof btoa === 'function') {
        return btoa(unescape(encodeURIComponent(str)));
      }
      return Buffer.from(str, 'utf-8').toString('base64');
    },

    decode: (str) => {
      if (typeof atob === 'function') {
        return decodeURIComponent(escape(atob(str)));
      }
      return Buffer.from(str, 'base64').toString('utf-8');
    },

    encodeUrl: (str) => {
      return this.encode(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    },

    decodeUrl: (str) => {
      let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4) base64 += '=';
      return this.decode(base64);
    },
  };
};

// Run-length encoding
const createRLE = () => {
  return {
    encode: (str) => {
      if (!str) return '';
      let result = '';
      let count = 1;

      for (let i = 1; i <= str.length; i++) {
        if (i < str.length && str[i] === str[i - 1]) {
          count++;
        } else {
          result += count > 1 ? `${count}${str[i - 1]}` : str[i - 1];
          count = 1;
        }
      }

      return result;
    },

    decode: (str) => {
      if (!str) return '';
      let result = '';
      let num = '';

      for (const char of str) {
        if (/\d/.test(char)) {
          num += char;
        } else {
          const count = num ? parseInt(num) : 1;
          result += char.repeat(count);
          num = '';
        }
      }

      return result;
    },
  };
};

// Simple LZ-like compression (dictionary-based)
const createSimpleCompress = () => {
  return {
    compress: (str) => {
      const dict = new Map();
      let dictSize = 256;
      let current = '';
      const result = [];

      for (let i = 0; i < 256; i++) {
        dict.set(String.fromCharCode(i), i);
      }

      for (const char of str) {
        const combined = current + char;
        if (dict.has(combined)) {
          current = combined;
        } else {
          result.push(dict.get(current));
          dict.set(combined, dictSize++);
          current = char;
        }
      }

      if (current) {
        result.push(dict.get(current));
      }

      return result;
    },

    decompress: (codes) => {
      if (!codes.length) return '';

      const dict = new Map();
      let dictSize = 256;

      for (let i = 0; i < 256; i++) {
        dict.set(i, String.fromCharCode(i));
      }

      let current = String.fromCharCode(codes[0]);
      let result = current;

      for (let i = 1; i < codes.length; i++) {
        const code = codes[i];
        let entry;

        if (dict.has(code)) {
          entry = dict.get(code);
        } else if (code === dictSize) {
          entry = current + current[0];
        } else {
          throw new Error('Invalid compressed data');
        }

        result += entry;
        dict.set(dictSize++, current + entry[0]);
        current = entry;
      }

      return result;
    },
  };
};

// Hex encoding
const createHexEncoding = () => {
  return {
    encode: (str) => {
      return [...str].map((c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
    },

    decode: (hex) => {
      let result = '';
      for (let i = 0; i < hex.length; i += 2) {
        result += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
      }
      return result;
    },

    encodeBytes: (bytes) => {
      return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
    },

    decodeBytes: (hex) => {
      const bytes = [];
      for (let i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.substr(i, 2), 16));
      }
      return new Uint8Array(bytes);
    },
  };
};

describe('Base64 Tests', () => {
  let base64;

  beforeEach(() => {
    base64 = createBase64();
  });

  it('should encode string', () => {
    expect(base64.encode('Hello World')).toBe('SGVsbG8gV29ybGQ=');
  });

  it('should decode string', () => {
    expect(base64.decode('SGVsbG8gV29ybGQ=')).toBe('Hello World');
  });

  it('should handle unicode', () => {
    const original = 'Hello 世界';
    expect(base64.decode(base64.encode(original))).toBe(original);
  });

  it('should url-safe encode', () => {
    const encoded = base64.encodeUrl('test?value=123');
    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
    expect(encoded).not.toContain('=');
  });

  it('should url-safe decode', () => {
    const encoded = base64.encodeUrl('test?value=123');
    expect(base64.decodeUrl(encoded)).toBe('test?value=123');
  });
});

describe('RLE Tests', () => {
  let rle;

  beforeEach(() => {
    rle = createRLE();
  });

  it('should encode repeated chars', () => {
    expect(rle.encode('AAABBC')).toBe('3A2BC');
  });

  it('should decode', () => {
    expect(rle.decode('3A2BC')).toBe('AAABBC');
  });

  it('should handle no repeats', () => {
    expect(rle.encode('ABC')).toBe('ABC');
  });

  it('should roundtrip', () => {
    const original = 'AAAAABBBBCCCCCDDDDE';
    expect(rle.decode(rle.encode(original))).toBe(original);
  });
});

describe('Simple Compress Tests', () => {
  let compress;

  beforeEach(() => {
    compress = createSimpleCompress();
  });

  it('should compress string', () => {
    const result = compress.compress('ABABABA');
    expect(result.length).toBeLessThan('ABABABA'.length);
  });

  it('should decompress', () => {
    const codes = compress.compress('Hello');
    expect(compress.decompress(codes)).toBe('Hello');
  });

  it('should roundtrip', () => {
    const original = 'The quick brown fox jumps over the lazy dog';
    const compressed = compress.compress(original);
    expect(compress.decompress(compressed)).toBe(original);
  });
});

describe('Hex Encoding Tests', () => {
  let hex;

  beforeEach(() => {
    hex = createHexEncoding();
  });

  it('should encode to hex', () => {
    expect(hex.encode('AB')).toBe('4142');
  });

  it('should decode from hex', () => {
    expect(hex.decode('4142')).toBe('AB');
  });

  it('should encode bytes', () => {
    expect(hex.encodeBytes([255, 0, 128])).toBe('ff0080');
  });

  it('should decode bytes', () => {
    const bytes = hex.decodeBytes('ff0080');
    expect(bytes[0]).toBe(255);
    expect(bytes[1]).toBe(0);
    expect(bytes[2]).toBe(128);
  });
});
