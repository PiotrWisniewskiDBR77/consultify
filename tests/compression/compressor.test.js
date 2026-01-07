/**
 * Compression Tests
 * Tests for data compression utilities
 * 
 * @module tests/compression/compressor.test.js
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Simple RLE compression for demo
const createRLECompressor = () => {
    return {
        compress: (data) => {
            if (typeof data !== 'string') {
                data = JSON.stringify(data);
            }

            let result = '';
            let count = 1;

            for (let i = 0; i < data.length; i++) {
                if (data[i] === data[i + 1]) {
                    count++;
                } else {
                    if (count > 3) {
                        result += `~${count}~${data[i]}`;
                    } else {
                        result += data[i].repeat(count);
                    }
                    count = 1;
                }
            }

            return result;
        },

        decompress: (data) => {
            let result = '';
            let i = 0;

            while (i < data.length) {
                if (data[i] === '~') {
                    const end = data.indexOf('~', i + 1);
                    const count = parseInt(data.slice(i + 1, end));
                    const char = data[end + 1];
                    result += char.repeat(count);
                    i = end + 2;
                } else {
                    result += data[i];
                    i++;
                }
            }

            return result;
        },

        ratio: (original, compressed) => {
            const originalSize = original.length;
            const compressedSize = compressed.length;
            return 1 - (compressedSize / originalSize);
        },
    };
};

// LZ77-like compression (simplified)
const createLZ77Compressor = (windowSize = 100) => {
    return {
        compress: (data) => {
            if (typeof data !== 'string') {
                data = JSON.stringify(data);
            }

            const tokens = [];
            let i = 0;

            while (i < data.length) {
                let bestMatch = { offset: 0, length: 0 };
                const windowStart = Math.max(0, i - windowSize);

                // Find longest match in window
                for (let j = windowStart; j < i; j++) {
                    let matchLength = 0;
                    while (
                        i + matchLength < data.length &&
                        data[j + matchLength] === data[i + matchLength] &&
                        matchLength < 255
                    ) {
                        matchLength++;
                    }

                    if (matchLength > bestMatch.length) {
                        bestMatch = { offset: i - j, length: matchLength };
                    }
                }

                if (bestMatch.length >= 3) {
                    tokens.push({ type: 'ref', offset: bestMatch.offset, length: bestMatch.length });
                    i += bestMatch.length;
                } else {
                    tokens.push({ type: 'lit', char: data[i] });
                    i++;
                }
            }

            return JSON.stringify(tokens);
        },

        decompress: (compressed) => {
            const tokens = JSON.parse(compressed);
            let result = '';

            for (const token of tokens) {
                if (token.type === 'lit') {
                    result += token.char;
                } else {
                    const start = result.length - token.offset;
                    for (let i = 0; i < token.length; i++) {
                        result += result[start + i];
                    }
                }
            }

            return result;
        },
    };
};

// JSON minification
const createJSONCompressor = () => {
    return {
        minify: (data) => {
            if (typeof data === 'string') {
                data = JSON.parse(data);
            }
            return JSON.stringify(data);
        },

        prettify: (data, indent = 2) => {
            if (typeof data === 'string') {
                data = JSON.parse(data);
            }
            return JSON.stringify(data, null, indent);
        },

        compressKeys: (data, keyMap = {}) => {
            let nextKey = 0;
            const reverseMap = {};

            const compress = (obj) => {
                if (Array.isArray(obj)) {
                    return obj.map(compress);
                }
                if (obj !== null && typeof obj === 'object') {
                    const result = {};
                    for (const [key, value] of Object.entries(obj)) {
                        let shortKey = keyMap[key];
                        if (!shortKey) {
                            shortKey = `_${nextKey++}`;
                            keyMap[key] = shortKey;
                            reverseMap[shortKey] = key;
                        }
                        result[shortKey] = compress(value);
                    }
                    return result;
                }
                return obj;
            };

            return {
                data: compress(data),
                keyMap,
                reverseMap,
            };
        },

        decompressKeys: (data, reverseMap) => {
            const decompress = (obj) => {
                if (Array.isArray(obj)) {
                    return obj.map(decompress);
                }
                if (obj !== null && typeof obj === 'object') {
                    const result = {};
                    for (const [key, value] of Object.entries(obj)) {
                        const originalKey = reverseMap[key] || key;
                        result[originalKey] = decompress(value);
                    }
                    return result;
                }
                return obj;
            };

            return decompress(data);
        },
    };
};

describe('Compression Tests', () => {
    // ═══════════════════════════════════════════════════════════════════
    // RLE COMPRESSION
    // ═══════════════════════════════════════════════════════════════════

    describe('RLE Compression', () => {
        let rle;

        beforeEach(() => {
            rle = createRLECompressor();
        });

        it('should compress repeated characters', () => {
            const result = rle.compress('aaaaaaaaaa');

            expect(result.length).toBeLessThan(10);
        });

        it('should decompress correctly', () => {
            const original = 'aaaaaaaaaa';
            const compressed = rle.compress(original);
            const decompressed = rle.decompress(compressed);

            expect(decompressed).toBe(original);
        });

        it('should handle mixed content', () => {
            const original = 'aaabbbcccccddddd';
            const compressed = rle.compress(original);
            const decompressed = rle.decompress(compressed);

            expect(decompressed).toBe(original);
        });

        it('should calculate compression ratio', () => {
            const original = 'a'.repeat(100);
            const compressed = rle.compress(original);
            const ratio = rle.ratio(original, compressed);

            expect(ratio).toBeGreaterThan(0.5);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // LZ77 COMPRESSION
    // ═══════════════════════════════════════════════════════════════════

    describe('LZ77 Compression', () => {
        let lz77;

        beforeEach(() => {
            lz77 = createLZ77Compressor();
        });

        it('should compress repeating patterns', () => {
            const original = 'abcabcabcabc';
            const compressed = lz77.compress(original);
            const decompressed = lz77.decompress(compressed);

            expect(decompressed).toBe(original);
        });

        it('should handle unique content', () => {
            const original = 'abcdefghij';
            const compressed = lz77.compress(original);
            const decompressed = lz77.decompress(compressed);

            expect(decompressed).toBe(original);
        });

        it('should compress JSON', () => {
            const original = JSON.stringify({
                users: [
                    { name: 'John', age: 30 },
                    { name: 'Jane', age: 25 },
                    { name: 'Bob', age: 30 },
                ],
            });

            const compressed = lz77.compress(original);
            const decompressed = lz77.decompress(compressed);

            expect(decompressed).toBe(original);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // JSON COMPRESSION
    // ═══════════════════════════════════════════════════════════════════

    describe('JSON Compression', () => {
        let jsonCompressor;

        beforeEach(() => {
            jsonCompressor = createJSONCompressor();
        });

        describe('minify / prettify', () => {
            it('should minify JSON', () => {
                const pretty = JSON.stringify({ a: 1, b: 2 }, null, 2);
                const minified = jsonCompressor.minify(pretty);

                expect(minified.length).toBeLessThan(pretty.length);
                expect(minified).toBe('{"a":1,"b":2}');
            });

            it('should prettify JSON', () => {
                const minified = '{"a":1,"b":2}';
                const pretty = jsonCompressor.prettify(minified);

                expect(pretty).toContain('\n');
            });
        });

        describe('key compression', () => {
            it('should compress keys', () => {
                const data = {
                    firstName: 'John',
                    lastName: 'Doe',
                    emailAddress: 'john@example.com',
                };

                const { data: compressed, reverseMap } = jsonCompressor.compressKeys(data);

                // Keys should be shorter
                const compressedJson = JSON.stringify(compressed);
                const originalJson = JSON.stringify(data);
                expect(compressedJson.length).toBeLessThan(originalJson.length);

                // Should decompress correctly
                const decompressed = jsonCompressor.decompressKeys(compressed, reverseMap);
                expect(decompressed).toEqual(data);
            });

            it('should handle nested objects', () => {
                const data = {
                    user: {
                        firstName: 'John',
                        address: {
                            streetName: '123 Main St',
                        },
                    },
                };

                const { data: compressed, reverseMap } = jsonCompressor.compressKeys(data);
                const decompressed = jsonCompressor.decompressKeys(compressed, reverseMap);

                expect(decompressed).toEqual(data);
            });

            it('should handle arrays', () => {
                const data = {
                    users: [
                        { firstName: 'John' },
                        { firstName: 'Jane' },
                    ],
                };

                const { data: compressed, reverseMap } = jsonCompressor.compressKeys(data);
                const decompressed = jsonCompressor.decompressKeys(compressed, reverseMap);

                expect(decompressed).toEqual(data);
            });

            it('should reuse key mappings', () => {
                const data = {
                    firstName: 'John',
                    users: [
                        { firstName: 'Jane' },
                        { firstName: 'Bob' },
                    ],
                };

                const { keyMap } = jsonCompressor.compressKeys(data);

                // firstName should only be mapped once
                expect(Object.values(keyMap).filter(v => v === keyMap.firstName).length).toBe(1);
            });
        });
    });
});

describe('Compression Utilities', () => {
    it('should round-trip compress/decompress', () => {
        const testCases = [
            'Hello, World!',
            'aaaaaaaaabbbbbbbbcccccccc',
            JSON.stringify({ key: 'value', nested: { data: [1, 2, 3] } }),
            'The quick brown fox jumps over the lazy dog',
        ];

        const rle = createRLECompressor();
        const lz77 = createLZ77Compressor();

        for (const original of testCases) {
            expect(rle.decompress(rle.compress(original))).toBe(original);
            expect(lz77.decompress(lz77.compress(original))).toBe(original);
        }
    });
});
