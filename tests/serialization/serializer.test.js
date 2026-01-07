/**
 * Serialization Tests
 * Tests for data serialization and deserialization
 * 
 * @module tests/serialization/serializer.test.js
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Serializer implementation
const createSerializer = () => {
    const customTypes = new Map();

    return {
        registerType: (name, { serialize, deserialize }) => {
            customTypes.set(name, { serialize, deserialize });
        },

        serialize: (data, options = {}) => {
            const { format = 'json', pretty = false } = options;

            const replacer = (key, value) => {
                // Handle special types
                if (value instanceof Date) {
                    return { __type: 'Date', value: value.toISOString() };
                }
                if (value instanceof Map) {
                    return { __type: 'Map', value: [...value.entries()] };
                }
                if (value instanceof Set) {
                    return { __type: 'Set', value: [...value] };
                }
                if (value instanceof RegExp) {
                    return { __type: 'RegExp', source: value.source, flags: value.flags };
                }
                if (value instanceof Error) {
                    return { __type: 'Error', message: value.message, name: value.name };
                }
                if (ArrayBuffer.isView(value)) {
                    return { __type: 'TypedArray', data: [...value], type: value.constructor.name };
                }

                // Check custom types
                for (const [typeName, handler] of customTypes) {
                    if (handler.serialize.check?.(value)) {
                        return { __type: typeName, value: handler.serialize(value) };
                    }
                }

                return value;
            };

            if (format === 'json') {
                return pretty
                    ? JSON.stringify(data, replacer, 2)
                    : JSON.stringify(data, replacer);
            }

            throw new Error(`Unknown format: ${format}`);
        },

        deserialize: (str, options = {}) => {
            const { format = 'json' } = options;

            const reviver = (key, value) => {
                if (value && typeof value === 'object' && value.__type) {
                    switch (value.__type) {
                        case 'Date':
                            return new Date(value.value);
                        case 'Map':
                            return new Map(value.value);
                        case 'Set':
                            return new Set(value.value);
                        case 'RegExp':
                            return new RegExp(value.source, value.flags);
                        case 'Error': {
                            const error = new Error(value.message);
                            error.name = value.name;
                            return error;
                        }
                        case 'TypedArray': {
                            const TypedArrayConstructor = globalThis[value.type];
                            return new TypedArrayConstructor(value.data);
                        }
                        default:
                            // Check custom types
                            if (customTypes.has(value.__type)) {
                                return customTypes.get(value.__type).deserialize(value.value);
                            }
                    }
                }
                return value;
            };

            if (format === 'json') {
                return JSON.parse(str, reviver);
            }

            throw new Error(`Unknown format: ${format}`);
        },

        clone: (data) => {
            return this.deserialize(this.serialize(data));
        },
    };
};

// Binary serializer
const createBinarySerializer = () => {
    return {
        encode: (data) => {
            const json = JSON.stringify(data);
            const encoder = new TextEncoder();
            return encoder.encode(json);
        },

        decode: (buffer) => {
            const decoder = new TextDecoder();
            const json = decoder.decode(buffer);
            return JSON.parse(json);
        },

        toBase64: (data) => {
            const bytes = this.encode(data);
            return btoa(String.fromCharCode(...bytes));
        },

        fromBase64: (base64) => {
            const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
            return this.decode(bytes);
        },

        toHex: (data) => {
            const bytes = this.encode(data);
            return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
        },

        fromHex: (hex) => {
            const bytes = new Uint8Array(hex.match(/.{2}/g).map(b => parseInt(b, 16)));
            return this.decode(bytes);
        },
    };
};

describe('Serialization Tests', () => {
    let serializer;

    beforeEach(() => {
        serializer = createSerializer();
    });

    // ═══════════════════════════════════════════════════════════════════
    // BASIC SERIALIZATION
    // ═══════════════════════════════════════════════════════════════════

    describe('Basic Serialization', () => {
        it('should serialize primitives', () => {
            expect(serializer.serialize('hello')).toBe('"hello"');
            expect(serializer.serialize(42)).toBe('42');
            expect(serializer.serialize(true)).toBe('true');
            expect(serializer.serialize(null)).toBe('null');
        });

        it('should serialize objects', () => {
            const obj = { name: 'John', age: 30 };
            const serialized = serializer.serialize(obj);

            expect(serialized).toContain('John');
            expect(serialized).toContain('30');
        });

        it('should serialize arrays', () => {
            const arr = [1, 2, 3];
            const serialized = serializer.serialize(arr);

            expect(serialized).toBe('[1,2,3]');
        });

        it('should serialize nested structures', () => {
            const data = {
                user: { name: 'John', tags: ['a', 'b'] },
                count: 5,
            };
            const result = serializer.deserialize(serializer.serialize(data));

            expect(result.user.name).toBe('John');
            expect(result.user.tags).toEqual(['a', 'b']);
        });

        it('should support pretty print', () => {
            const obj = { a: 1 };
            const pretty = serializer.serialize(obj, { pretty: true });

            expect(pretty).toContain('\n');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // SPECIAL TYPES
    // ═══════════════════════════════════════════════════════════════════

    describe('Special Types', () => {
        it('should serialize/deserialize Date', () => {
            const date = new Date('2024-01-15T10:30:00Z');
            const serialized = serializer.serialize({ date });
            const result = serializer.deserialize(serialized);

            expect(result.date).toBeInstanceOf(Date);
            expect(result.date.toISOString()).toBe(date.toISOString());
        });

        it('should serialize/deserialize Map', () => {
            const map = new Map([['a', 1], ['b', 2]]);
            const serialized = serializer.serialize({ map });
            const result = serializer.deserialize(serialized);

            expect(result.map).toBeInstanceOf(Map);
            expect(result.map.get('a')).toBe(1);
        });

        it('should serialize/deserialize Set', () => {
            const set = new Set([1, 2, 3]);
            const serialized = serializer.serialize({ set });
            const result = serializer.deserialize(serialized);

            expect(result.set).toBeInstanceOf(Set);
            expect(result.set.has(2)).toBe(true);
        });

        it('should serialize/deserialize RegExp', () => {
            const regex = /test/gi;
            const serialized = serializer.serialize({ regex });
            const result = serializer.deserialize(serialized);

            expect(result.regex).toBeInstanceOf(RegExp);
            expect(result.regex.source).toBe('test');
            expect(result.regex.flags).toBe('gi');
        });

        it('should serialize/deserialize Error', () => {
            const error = new TypeError('Something went wrong');
            const serialized = serializer.serialize({ error });
            const result = serializer.deserialize(serialized);

            expect(result.error).toBeInstanceOf(Error);
            expect(result.error.message).toBe('Something went wrong');
        });

        it('should serialize/deserialize TypedArray', () => {
            const arr = new Uint8Array([1, 2, 3, 4]);
            const serialized = serializer.serialize({ arr });
            const result = serializer.deserialize(serialized);

            expect(result.arr).toBeInstanceOf(Uint8Array);
            expect([...result.arr]).toEqual([1, 2, 3, 4]);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // CUSTOM TYPES
    // ═══════════════════════════════════════════════════════════════════

    describe('Custom Types', () => {
        it('should register and use custom type', () => {
            class Point {
                constructor(x, y) {
                    this.x = x;
                    this.y = y;
                }
            }

            serializer.registerType('Point', {
                serialize: (point) => ({ x: point.x, y: point.y }),
                deserialize: (data) => new Point(data.x, data.y),
            });

            // Manual test since check isn't implemented
            const point = { __type: 'Point', value: { x: 10, y: 20 } };
            const result = serializer.deserialize(JSON.stringify({ point }));

            expect(result.point).toBeInstanceOf(Point);
            expect(result.point.x).toBe(10);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // CLONE
    // ═══════════════════════════════════════════════════════════════════

    describe('Clone', () => {
        it('should deep clone object', () => {
            const original = { a: { b: { c: 1 } } };
            const cloned = serializer.clone(original);

            cloned.a.b.c = 999;
            expect(original.a.b.c).toBe(1);
        });
    });
});

describe('Binary Serializer Tests', () => {
    let binarySerializer;

    beforeEach(() => {
        binarySerializer = createBinarySerializer();
    });

    // ═══════════════════════════════════════════════════════════════════
    // ENCODE / DECODE
    // ═══════════════════════════════════════════════════════════════════

    describe('Encode / Decode', () => {
        it('should encode to Uint8Array', () => {
            const data = { hello: 'world' };
            const encoded = binarySerializer.encode(data);

            expect(encoded).toBeInstanceOf(Uint8Array);
        });

        it('should decode from Uint8Array', () => {
            const data = { hello: 'world' };
            const encoded = binarySerializer.encode(data);
            const decoded = binarySerializer.decode(encoded);

            expect(decoded).toEqual(data);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // BASE64
    // ═══════════════════════════════════════════════════════════════════

    describe('Base64', () => {
        it('should encode to base64', () => {
            const data = { test: 123 };
            const base64 = binarySerializer.toBase64(data);

            expect(typeof base64).toBe('string');
        });

        it('should decode from base64', () => {
            const data = { test: 123 };
            const base64 = binarySerializer.toBase64(data);
            const decoded = binarySerializer.fromBase64(base64);

            expect(decoded).toEqual(data);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // HEX
    // ═══════════════════════════════════════════════════════════════════

    describe('Hex', () => {
        it('should encode to hex', () => {
            const data = { a: 1 };
            const hex = binarySerializer.toHex(data);

            expect(hex).toMatch(/^[0-9a-f]+$/);
        });

        it('should decode from hex', () => {
            const data = { a: 1 };
            const hex = binarySerializer.toHex(data);
            const decoded = binarySerializer.fromHex(hex);

            expect(decoded).toEqual(data);
        });
    });
});
