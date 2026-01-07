/**
 * Encryption Utilities Tests
 * Tests for encryption and decryption patterns
 * 
 * @module tests/encryption/encryption-utils.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Simple XOR cipher (for demonstration)
const createXorCipher = (key) => {
    const keyBytes = [...key].map(c => c.charCodeAt(0));

    const process = (data) => {
        const result = [];
        for (let i = 0; i < data.length; i++) {
            result.push(data[i] ^ keyBytes[i % keyBytes.length]);
        }
        return result;
    };

    return {
        encrypt: (plaintext) => {
            const bytes = [...plaintext].map(c => c.charCodeAt(0));
            return process(bytes);
        },

        decrypt: (ciphertext) => {
            const decrypted = process(ciphertext);
            return String.fromCharCode(...decrypted);
        },
    };
};

// AES-like block cipher mock
const createBlockCipher = (options = {}) => {
    const { blockSize = 16, mode = 'CBC' } = options;
    let key = null;
    let iv = null;

    const pad = (data) => {
        const padLength = blockSize - (data.length % blockSize);
        return [...data, ...new Array(padLength).fill(padLength)];
    };

    const unpad = (data) => {
        const padLength = data[data.length - 1];
        return data.slice(0, -padLength);
    };

    return {
        setKey: (k) => {
            key = k;
        },

        setIV: (i) => {
            iv = i;
        },

        encrypt: (plaintext) => {
            if (!key) throw new Error('Key not set');

            const bytes = typeof plaintext === 'string'
                ? [...plaintext].map(c => c.charCodeAt(0))
                : plaintext;

            const padded = pad(bytes);

            // Simulate block encryption
            const encrypted = padded.map((b, i) => {
                const keyByte = key.charCodeAt(i % key.length);
                const ivByte = iv ? iv.charCodeAt(i % iv.length) : 0;
                return (b ^ keyByte ^ ivByte) & 0xFF;
            });

            return encrypted;
        },

        decrypt: (ciphertext) => {
            if (!key) throw new Error('Key not set');

            const decrypted = ciphertext.map((b, i) => {
                const keyByte = key.charCodeAt(i % key.length);
                const ivByte = iv ? iv.charCodeAt(i % iv.length) : 0;
                return (b ^ keyByte ^ ivByte) & 0xFF;
            });

            const unpadded = unpad(decrypted);
            return String.fromCharCode(...unpadded);
        },

        getBlockSize: () => blockSize,

        getMode: () => mode,
    };
};

// Key derivation function mock
const createKDF = (options = {}) => {
    const { iterations = 10000, keyLength = 32 } = options;

    const simpleHash = (data) => {
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            const char = data.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    };

    return {
        derive: (password, salt) => {
            let derived = password + salt;

            for (let i = 0; i < iterations; i++) {
                derived = simpleHash(derived).toString(16) + salt;
            }

            // Create key of desired length
            const key = [];
            for (let i = 0; i < keyLength; i++) {
                key.push(derived.charCodeAt(i % derived.length));
            }

            return key;
        },

        deriveWithInfo: (password, salt, info) => {
            const baseKey = this.derive(password, salt);
            // HKDF-like expansion
            const expanded = baseKey.map((b, i) => {
                const infoByte = info.charCodeAt(i % info.length);
                return (b ^ infoByte) & 0xFF;
            });
            return expanded;
        },
    };
};

// Envelope encryption
const createEnvelopeEncryption = (masterKey) => {
    const dataKeys = new Map();

    const generateDataKey = () => {
        const key = [];
        for (let i = 0; i < 32; i++) {
            key.push(Math.floor(Math.random() * 256));
        }
        return key;
    };

    const encryptKey = (dataKey) => {
        return dataKey.map((b, i) => (b ^ masterKey.charCodeAt(i % masterKey.length)) & 0xFF);
    };

    const decryptKey = (encryptedKey) => {
        return encryptedKey.map((b, i) => (b ^ masterKey.charCodeAt(i % masterKey.length)) & 0xFF);
    };

    return {
        encrypt: (keyId, plaintext) => {
            let dataKey = dataKeys.get(keyId);

            if (!dataKey) {
                dataKey = generateDataKey();
                dataKeys.set(keyId, dataKey);
            }

            const bytes = [...plaintext].map(c => c.charCodeAt(0));
            const encrypted = bytes.map((b, i) => (b ^ dataKey[i % dataKey.length]) & 0xFF);

            return {
                ciphertext: encrypted,
                encryptedDataKey: encryptKey(dataKey),
            };
        },

        decrypt: (encryptedDataKey, ciphertext) => {
            const dataKey = decryptKey(encryptedDataKey);
            const decrypted = ciphertext.map((b, i) => (b ^ dataKey[i % dataKey.length]) & 0xFF);
            return String.fromCharCode(...decrypted);
        },

        rotateDataKey: (keyId) => {
            const newKey = generateDataKey();
            dataKeys.set(keyId, newKey);
            return encryptKey(newKey);
        },
    };
};

// Signing utilities
const createSigner = (privateKey) => {
    const sign = (message) => {
        // Simple signature simulation
        let sig = 0;
        const combined = message + privateKey;

        for (let i = 0; i < combined.length; i++) {
            sig = ((sig << 5) - sig) + combined.charCodeAt(i);
            sig = sig & sig;
        }

        return Math.abs(sig).toString(16);
    };

    return {
        sign: (data) => {
            const message = typeof data === 'string' ? data : JSON.stringify(data);
            return sign(message);
        },

        signWithTimestamp: (data) => {
            const timestamp = Date.now();
            const message = typeof data === 'string' ? data : JSON.stringify(data);
            const signature = sign(message + timestamp);

            return { signature, timestamp };
        },
    };
};

describe('XOR Cipher Tests', () => {
    let cipher;

    beforeEach(() => {
        cipher = createXorCipher('secretkey');
    });

    it('should encrypt and decrypt', () => {
        const original = 'Hello World';
        const encrypted = cipher.encrypt(original);
        const decrypted = cipher.decrypt(encrypted);

        expect(decrypted).toBe(original);
    });

    it('should produce different ciphertext', () => {
        const encrypted = cipher.encrypt('Test');

        expect(encrypted).not.toEqual([84, 101, 115, 116]); // Not plain ASCII
    });
});

describe('Block Cipher Tests', () => {
    let cipher;

    beforeEach(() => {
        cipher = createBlockCipher({ blockSize: 16 });
        cipher.setKey('0123456789abcdef');
        cipher.setIV('fedcba9876543210');
    });

    it('should encrypt and decrypt', () => {
        const original = 'Secret message!';
        const encrypted = cipher.encrypt(original);
        const decrypted = cipher.decrypt(encrypted);

        expect(decrypted).toBe(original);
    });

    it('should throw without key', () => {
        const newCipher = createBlockCipher();

        expect(() => newCipher.encrypt('test')).toThrow('Key not set');
    });

    it('should report block size', () => {
        expect(cipher.getBlockSize()).toBe(16);
    });
});

describe('KDF Tests', () => {
    let kdf;

    beforeEach(() => {
        kdf = createKDF({ iterations: 100, keyLength: 32 });
    });

    it('should derive key', () => {
        const key = kdf.derive('password', 'salt');

        expect(key).toHaveLength(32);
    });

    it('should produce consistent keys', () => {
        const key1 = kdf.derive('password', 'salt');
        const key2 = kdf.derive('password', 'salt');

        expect(key1).toEqual(key2);
    });

    it('should produce different keys for different passwords', () => {
        const key1 = kdf.derive('password1', 'salt');
        const key2 = kdf.derive('password2', 'salt');

        expect(key1).not.toEqual(key2);
    });
});

describe('Envelope Encryption Tests', () => {
    let envelope;

    beforeEach(() => {
        envelope = createEnvelopeEncryption('masterkeyformyapp');
    });

    it('should encrypt and decrypt', () => {
        const original = 'Sensitive data';
        const { ciphertext, encryptedDataKey } = envelope.encrypt('key1', original);
        const decrypted = envelope.decrypt(encryptedDataKey, ciphertext);

        expect(decrypted).toBe(original);
    });

    it('should use same data key for same ID', () => {
        const result1 = envelope.encrypt('key1', 'test1');
        const result2 = envelope.encrypt('key1', 'test2');

        expect(result1.encryptedDataKey).toEqual(result2.encryptedDataKey);
    });

    it('should rotate data key', () => {
        const original = envelope.encrypt('key1', 'test');
        envelope.rotateDataKey('key1');
        const rotated = envelope.encrypt('key1', 'test');

        expect(original.encryptedDataKey).not.toEqual(rotated.encryptedDataKey);
    });
});

describe('Signer Tests', () => {
    let signer;

    beforeEach(() => {
        signer = createSigner('privatekey');
    });

    it('should sign string', () => {
        const signature = signer.sign('message');

        expect(signature).toBeDefined();
        expect(typeof signature).toBe('string');
    });

    it('should produce consistent signatures', () => {
        const sig1 = signer.sign('message');
        const sig2 = signer.sign('message');

        expect(sig1).toBe(sig2);
    });

    it('should sign with timestamp', () => {
        const { signature, timestamp } = signer.signWithTimestamp('message');

        expect(signature).toBeDefined();
        expect(timestamp).toBeDefined();
    });
});
