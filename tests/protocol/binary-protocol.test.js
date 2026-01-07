/**
 * Binary Protocol Tests
 * Tests for binary data encoding and protocols
 * 
 * @module tests/protocol/binary-protocol.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Binary buffer builder
const createBufferBuilder = () => {
    const chunks = [];
    let position = 0;

    return {
        writeUint8: (value) => {
            chunks.push({ type: 'uint8', value: value & 0xFF });
            position += 1;
        },

        writeUint16: (value, littleEndian = false) => {
            chunks.push({ type: 'uint16', value: value & 0xFFFF, littleEndian });
            position += 2;
        },

        writeUint32: (value, littleEndian = false) => {
            chunks.push({ type: 'uint32', value: value >>> 0, littleEndian });
            position += 4;
        },

        writeFloat32: (value, littleEndian = false) => {
            chunks.push({ type: 'float32', value, littleEndian });
            position += 4;
        },

        writeString: (str, encoding = 'utf8') => {
            const bytes = [...str].map(c => c.charCodeAt(0));
            chunks.push({ type: 'string', value: bytes, length: bytes.length });
            position += bytes.length;
        },

        writeLengthPrefixed: (str) => {
            const bytes = [...str].map(c => c.charCodeAt(0));
            chunks.push({ type: 'uint16', value: bytes.length, littleEndian: false });
            chunks.push({ type: 'bytes', value: bytes });
            position += 2 + bytes.length;
        },

        writeBytes: (bytes) => {
            chunks.push({ type: 'bytes', value: [...bytes] });
            position += bytes.length;
        },

        getPosition: () => position,

        getChunks: () => [...chunks],

        build: () => {
            const buffer = new Uint8Array(position);
            let offset = 0;

            for (const chunk of chunks) {
                switch (chunk.type) {
                    case 'uint8':
                        buffer[offset++] = chunk.value;
                        break;
                    case 'uint16':
                        if (chunk.littleEndian) {
                            buffer[offset++] = chunk.value & 0xFF;
                            buffer[offset++] = (chunk.value >> 8) & 0xFF;
                        } else {
                            buffer[offset++] = (chunk.value >> 8) & 0xFF;
                            buffer[offset++] = chunk.value & 0xFF;
                        }
                        break;
                    case 'uint32':
                        if (chunk.littleEndian) {
                            buffer[offset++] = chunk.value & 0xFF;
                            buffer[offset++] = (chunk.value >> 8) & 0xFF;
                            buffer[offset++] = (chunk.value >> 16) & 0xFF;
                            buffer[offset++] = (chunk.value >> 24) & 0xFF;
                        } else {
                            buffer[offset++] = (chunk.value >> 24) & 0xFF;
                            buffer[offset++] = (chunk.value >> 16) & 0xFF;
                            buffer[offset++] = (chunk.value >> 8) & 0xFF;
                            buffer[offset++] = chunk.value & 0xFF;
                        }
                        break;
                    case 'string':
                    case 'bytes':
                        for (const b of chunk.value) {
                            buffer[offset++] = b;
                        }
                        break;
                }
            }

            return buffer;
        },

        clear: () => {
            chunks.length = 0;
            position = 0;
        },
    };
};

// Binary buffer reader
const createBufferReader = (buffer) => {
    const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let position = 0;

    return {
        readUint8: () => {
            return data[position++];
        },

        readUint16: (littleEndian = false) => {
            const a = data[position++];
            const b = data[position++];
            return littleEndian ? (b << 8) | a : (a << 8) | b;
        },

        readUint32: (littleEndian = false) => {
            const a = data[position++];
            const b = data[position++];
            const c = data[position++];
            const d = data[position++];

            return littleEndian
                ? (d << 24) | (c << 16) | (b << 8) | a
                : (a << 24) | (b << 16) | (c << 8) | d;
        },

        readString: (length) => {
            const bytes = [];
            for (let i = 0; i < length; i++) {
                bytes.push(data[position++]);
            }
            return String.fromCharCode(...bytes);
        },

        readLengthPrefixed: () => {
            const length = this.readUint16();
            return this.readString(length);
        },

        readBytes: (length) => {
            const bytes = data.slice(position, position + length);
            position += length;
            return bytes;
        },

        getPosition: () => position,

        setPosition: (pos) => {
            position = pos;
        },

        remaining: () => data.length - position,

        isEOF: () => position >= data.length,
    };
};

// Message framing protocol
const createFrameProtocol = (options = {}) => {
    const { maxFrameSize = 65535, headerSize = 4 } = options;

    return {
        encode: (type, payload) => {
            const payloadBytes = typeof payload === 'string'
                ? [...payload].map(c => c.charCodeAt(0))
                : payload;

            if (payloadBytes.length > maxFrameSize) {
                throw new Error('Payload too large');
            }

            const frame = new Uint8Array(headerSize + payloadBytes.length);

            // Header: type (1 byte) + length (3 bytes)
            frame[0] = type & 0xFF;
            frame[1] = (payloadBytes.length >> 16) & 0xFF;
            frame[2] = (payloadBytes.length >> 8) & 0xFF;
            frame[3] = payloadBytes.length & 0xFF;

            // Payload
            for (let i = 0; i < payloadBytes.length; i++) {
                frame[headerSize + i] = payloadBytes[i];
            }

            return frame;
        },

        decode: (frame) => {
            if (frame.length < headerSize) {
                throw new Error('Frame too small');
            }

            const type = frame[0];
            const length = (frame[1] << 16) | (frame[2] << 8) | frame[3];

            if (frame.length < headerSize + length) {
                throw new Error('Incomplete frame');
            }

            const payload = frame.slice(headerSize, headerSize + length);

            return { type, payload, length };
        },

        getHeaderSize: () => headerSize,
    };
};

// TLV (Type-Length-Value) encoder
const createTLVEncoder = () => {
    return {
        encode: (entries) => {
            const chunks = [];

            for (const { type, value } of entries) {
                const valueBytes = typeof value === 'string'
                    ? [...value].map(c => c.charCodeAt(0))
                    : value;

                // Type (1 byte) + Length (2 bytes) + Value
                chunks.push(type & 0xFF);
                chunks.push((valueBytes.length >> 8) & 0xFF);
                chunks.push(valueBytes.length & 0xFF);
                chunks.push(...valueBytes);
            }

            return new Uint8Array(chunks);
        },

        decode: (buffer) => {
            const entries = [];
            let position = 0;
            const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

            while (position < data.length) {
                const type = data[position++];
                const length = (data[position++] << 8) | data[position++];
                const value = data.slice(position, position + length);
                position += length;

                entries.push({ type, length, value });
            }

            return entries;
        },
    };
};

// Varint encoder (like protobuf)
const createVarintEncoder = () => {
    return {
        encode: (value) => {
            const result = [];
            let v = value >>> 0;

            while (v >= 0x80) {
                result.push((v & 0x7F) | 0x80);
                v >>>= 7;
            }
            result.push(v);

            return new Uint8Array(result);
        },

        decode: (buffer, position = 0) => {
            let result = 0;
            let shift = 0;

            while (position < buffer.length) {
                const byte = buffer[position++];
                result |= (byte & 0x7F) << shift;

                if ((byte & 0x80) === 0) {
                    break;
                }

                shift += 7;
            }

            return { value: result >>> 0, bytesRead: position };
        },

        sizeOf: (value) => {
            if (value < 0x80) return 1;
            if (value < 0x4000) return 2;
            if (value < 0x200000) return 3;
            if (value < 0x10000000) return 4;
            return 5;
        },
    };
};

describe('Buffer Builder Tests', () => {
    let builder;

    beforeEach(() => {
        builder = createBufferBuilder();
    });

    it('should write uint8', () => {
        builder.writeUint8(255);

        const buffer = builder.build();
        expect(buffer[0]).toBe(255);
    });

    it('should write uint16 big endian', () => {
        builder.writeUint16(0x1234);

        const buffer = builder.build();
        expect(buffer[0]).toBe(0x12);
        expect(buffer[1]).toBe(0x34);
    });

    it('should write uint16 little endian', () => {
        builder.writeUint16(0x1234, true);

        const buffer = builder.build();
        expect(buffer[0]).toBe(0x34);
        expect(buffer[1]).toBe(0x12);
    });

    it('should write string', () => {
        builder.writeString('Hi');

        const buffer = builder.build();
        expect(buffer[0]).toBe(72); // H
        expect(buffer[1]).toBe(105); // i
    });

    it('should track position', () => {
        builder.writeUint8(1);
        builder.writeUint16(2);
        builder.writeUint32(3);

        expect(builder.getPosition()).toBe(7);
    });
});

describe('Buffer Reader Tests', () => {
    it('should read uint8', () => {
        const reader = createBufferReader(new Uint8Array([42]));

        expect(reader.readUint8()).toBe(42);
    });

    it('should read uint16', () => {
        const reader = createBufferReader(new Uint8Array([0x12, 0x34]));

        expect(reader.readUint16()).toBe(0x1234);
    });

    it('should read string', () => {
        const reader = createBufferReader(new Uint8Array([72, 105]));

        expect(reader.readString(2)).toBe('Hi');
    });

    it('should track remaining', () => {
        const reader = createBufferReader(new Uint8Array([1, 2, 3]));
        reader.readUint8();

        expect(reader.remaining()).toBe(2);
    });
});

describe('Frame Protocol Tests', () => {
    let protocol;

    beforeEach(() => {
        protocol = createFrameProtocol();
    });

    it('should encode and decode', () => {
        const frame = protocol.encode(1, 'hello');
        const decoded = protocol.decode(frame);

        expect(decoded.type).toBe(1);
        expect(String.fromCharCode(...decoded.payload)).toBe('hello');
    });

    it('should throw on large payload', () => {
        const largePayload = new Array(70000).fill(0);

        expect(() => protocol.encode(1, largePayload)).toThrow('too large');
    });
});

describe('TLV Encoder Tests', () => {
    let tlv;

    beforeEach(() => {
        tlv = createTLVEncoder();
    });

    it('should encode and decode', () => {
        const entries = [
            { type: 1, value: 'hello' },
            { type: 2, value: [1, 2, 3] },
        ];

        const encoded = tlv.encode(entries);
        const decoded = tlv.decode(encoded);

        expect(decoded).toHaveLength(2);
        expect(decoded[0].type).toBe(1);
        expect(decoded[1].type).toBe(2);
    });
});

describe('Varint Encoder Tests', () => {
    let varint;

    beforeEach(() => {
        varint = createVarintEncoder();
    });

    it('should encode small numbers', () => {
        const encoded = varint.encode(127);

        expect(encoded).toHaveLength(1);
        expect(encoded[0]).toBe(127);
    });

    it('should encode larger numbers', () => {
        const encoded = varint.encode(300);

        expect(encoded.length).toBeGreaterThan(1);
    });

    it('should decode', () => {
        const encoded = varint.encode(12345);
        const { value } = varint.decode(encoded);

        expect(value).toBe(12345);
    });

    it('should calculate size', () => {
        expect(varint.sizeOf(127)).toBe(1);
        expect(varint.sizeOf(128)).toBe(2);
    });
});
