/**
 * Hash and Digest Tests
 * Tests for hashing and digest algorithms
 * 
 * @module tests/crypto/hash-digest.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Simple hash functions
const createHashUtils = () => {
    // Simple DJB2 hash
    const djb2 = (str) => {
        let hash = 5381;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) + hash) + str.charCodeAt(i);
            hash = hash >>> 0; // Convert to unsigned
        }
        return hash.toString(16);
    };

    // Simple FNV-1a hash
    const fnv1a = (str) => {
        let hash = 2166136261;
        for (let i = 0; i < str.length; i++) {
            hash ^= str.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
            hash = hash >>> 0;
        }
        return hash.toString(16);
    };

    // MurmurHash3-like
    const murmur3 = (str, seed = 0) => {
        let h = seed;
        for (let i = 0; i < str.length; i++) {
            let k = str.charCodeAt(i);
            k = Math.imul(k, 0xcc9e2d51);
            k = (k << 15) | (k >>> 17);
            k = Math.imul(k, 0x1b873593);
            h ^= k;
            h = (h << 13) | (h >>> 19);
            h = Math.imul(h, 5) + 0xe6546b64;
        }
        h ^= str.length;
        h ^= h >>> 16;
        h = Math.imul(h, 0x85ebca6b);
        h ^= h >>> 13;
        h = Math.imul(h, 0xc2b2ae35);
        h ^= h >>> 16;
        return (h >>> 0).toString(16);
    };

    return {
        djb2,
        fnv1a,
        murmur3,

        // Content-addressable hash
        contentHash: (content) => {
            const str = typeof content === 'string' ? content : JSON.stringify(content);
            return `${murmur3(str)}-${fnv1a(str)}`;
        },

        // Consistent hash for partitioning
        consistentHash: (key, buckets) => {
            const hash = parseInt(murmur3(key), 16);
            return hash % buckets;
        },
    };
};

// Checksum utilities
const createChecksumUtils = () => {
    return {
        // Simple modular checksum
        modular: (data) => {
            let sum = 0;
            for (let i = 0; i < data.length; i++) {
                sum = (sum + data.charCodeAt(i)) % 256;
            }
            return sum.toString(16).padStart(2, '0');
        },

        // XOR checksum
        xor: (data) => {
            let checksum = 0;
            for (let i = 0; i < data.length; i++) {
                checksum ^= data.charCodeAt(i);
            }
            return checksum.toString(16).padStart(2, '0');
        },

        // Fletcher-16
        fletcher16: (data) => {
            let sum1 = 0, sum2 = 0;
            for (let i = 0; i < data.length; i++) {
                sum1 = (sum1 + data.charCodeAt(i)) % 255;
                sum2 = (sum2 + sum1) % 255;
            }
            return ((sum2 << 8) | sum1).toString(16).padStart(4, '0');
        },

        // Luhn algorithm (for credit cards, etc.)
        luhn: (num) => {
            const digits = String(num).split('').map(Number);
            let sum = 0;
            let isEven = false;

            for (let i = digits.length - 1; i >= 0; i--) {
                let digit = digits[i];
                if (isEven) {
                    digit *= 2;
                    if (digit > 9) digit -= 9;
                }
                sum += digit;
                isEven = !isEven;
            }

            return sum % 10 === 0;
        },

        // Generate Luhn check digit
        luhnCheckDigit: (num) => {
            const digits = String(num).split('').map(Number);
            let sum = 0;
            let isEven = true;

            for (let i = digits.length - 1; i >= 0; i--) {
                let digit = digits[i];
                if (isEven) {
                    digit *= 2;
                    if (digit > 9) digit -= 9;
                }
                sum += digit;
                isEven = !isEven;
            }

            return (10 - (sum % 10)) % 10;
        },
    };
};

// HMAC-like message authentication
const createHmacUtils = () => {
    const hashFn = (str) => {
        const hash = createHashUtils();
        return hash.murmur3(str);
    };

    return {
        sign: (message, secret) => {
            const innerKey = secret + '_inner';
            const outerKey = secret + '_outer';

            const innerHash = hashFn(innerKey + message);
            const outerHash = hashFn(outerKey + innerHash);

            return outerHash;
        },

        verify: (message, secret, signature) => {
            return this.sign(message, secret) === signature;
        },

        // Time-based one-time password (simplified)
        totp: (secret, timeStep = 30) => {
            const time = Math.floor(Date.now() / 1000 / timeStep);
            const hash = hashFn(secret + time);
            return parseInt(hash, 16) % 1000000;
        },
    };
};

describe('Hash Utils Tests', () => {
    let hash;

    beforeEach(() => {
        hash = createHashUtils();
    });

    it('should compute djb2 hash', () => {
        const h1 = hash.djb2('hello');
        const h2 = hash.djb2('hello');
        const h3 = hash.djb2('world');

        expect(h1).toBe(h2);
        expect(h1).not.toBe(h3);
    });

    it('should compute fnv1a hash', () => {
        const h1 = hash.fnv1a('test');
        const h2 = hash.fnv1a('test');

        expect(h1).toBe(h2);
    });

    it('should compute murmur3 hash', () => {
        const h1 = hash.murmur3('data', 42);
        const h2 = hash.murmur3('data', 42);
        const h3 = hash.murmur3('data', 123);

        expect(h1).toBe(h2);
        expect(h1).not.toBe(h3);
    });

    it('should compute content hash', () => {
        const h1 = hash.contentHash({ a: 1, b: 2 });
        const h2 = hash.contentHash({ a: 1, b: 2 });

        expect(h1).toBe(h2);
    });

    it('should compute consistent hash', () => {
        const bucket1 = hash.consistentHash('key1', 10);
        const bucket2 = hash.consistentHash('key1', 10);

        expect(bucket1).toBe(bucket2);
        expect(bucket1).toBeGreaterThanOrEqual(0);
        expect(bucket1).toBeLessThan(10);
    });
});

describe('Checksum Utils Tests', () => {
    let checksum;

    beforeEach(() => {
        checksum = createChecksumUtils();
    });

    it('should compute modular checksum', () => {
        const c1 = checksum.modular('hello');
        const c2 = checksum.modular('hello');

        expect(c1).toBe(c2);
    });

    it('should compute xor checksum', () => {
        const c = checksum.xor('AB');
        expect(c).toBe('03'); // 65 XOR 66 = 3
    });

    it('should compute fletcher16', () => {
        const c1 = checksum.fletcher16('test');
        const c2 = checksum.fletcher16('test');

        expect(c1).toBe(c2);
    });

    it('should validate Luhn', () => {
        expect(checksum.luhn('79927398713')).toBe(true);
        expect(checksum.luhn('79927398710')).toBe(false);
    });

    it('should generate Luhn check digit', () => {
        const digit = checksum.luhnCheckDigit('7992739871');
        expect(digit).toBe(3);
    });
});

describe('HMAC Utils Tests', () => {
    let hmac;

    beforeEach(() => {
        hmac = createHmacUtils();
    });

    it('should sign message', () => {
        const sig1 = hmac.sign('hello', 'secret');
        const sig2 = hmac.sign('hello', 'secret');
        const sig3 = hmac.sign('hello', 'different');

        expect(sig1).toBe(sig2);
        expect(sig1).not.toBe(sig3);
    });

    it('should verify signature', () => {
        const sig = hmac.sign('message', 'key');

        expect(hmac.verify('message', 'key', sig)).toBe(true);
        expect(hmac.verify('message', 'wrong', sig)).toBe(false);
    });

    it('should generate TOTP', () => {
        const code = hmac.totp('secret');

        expect(code).toBeGreaterThanOrEqual(0);
        expect(code).toBeLessThan(1000000);
    });
});
