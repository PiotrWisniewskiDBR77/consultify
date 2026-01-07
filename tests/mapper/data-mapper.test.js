/**
 * Data Mapper Tests
 * Tests for object mapping and conversion
 * 
 * @module tests/mapper/data-mapper.test.js
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Data mapper implementation
const createDataMapper = () => {
    const mappings = new Map();

    const getPath = (obj, path) => {
        const parts = path.split('.');
        let current = obj;

        for (const part of parts) {
            if (current === null || current === undefined) return undefined;
            current = current[part];
        }

        return current;
    };

    const setPath = (obj, path, value) => {
        const parts = path.split('.');
        let current = obj;

        for (let i = 0; i < parts.length - 1; i++) {
            if (current[parts[i]] === undefined) {
                current[parts[i]] = {};
            }
            current = current[parts[i]];
        }

        current[parts[parts.length - 1]] = value;
    };

    return {
        define: (name, schema) => {
            mappings.set(name, schema);
        },

        map: (name, source) => {
            const schema = mappings.get(name);
            if (!schema) throw new Error(`Mapping not found: ${name}`);

            const result = {};

            for (const [targetPath, config] of Object.entries(schema)) {
                let value;

                if (typeof config === 'string') {
                    value = getPath(source, config);
                } else if (typeof config === 'object') {
                    const { from, transform, default: defaultValue, required } = config;

                    value = getPath(source, from);

                    if (value === undefined && defaultValue !== undefined) {
                        value = typeof defaultValue === 'function' ? defaultValue(source) : defaultValue;
                    }

                    if (transform && value !== undefined) {
                        value = transform(value, source);
                    }

                    if (required && value === undefined) {
                        throw new Error(`Required field missing: ${from}`);
                    }
                } else if (typeof config === 'function') {
                    value = config(source);
                }

                if (value !== undefined) {
                    setPath(result, targetPath, value);
                }
            }

            return result;
        },

        mapArray: (name, sources) => {
            return sources.map(source => this.map(name, source));
        },

        extend: (baseName, newName, extensions) => {
            const baseSchema = mappings.get(baseName);
            if (!baseSchema) throw new Error(`Base mapping not found: ${baseName}`);

            mappings.set(newName, { ...baseSchema, ...extensions });
        },

        compose: (...names) => {
            return (source) => {
                let result = source;
                for (const name of names) {
                    result = this.map(name, result);
                }
                return result;
            };
        },

        getSchema: (name) => {
            return mappings.get(name);
        },

        clear: () => {
            mappings.clear();
        },
    };
};

// DTO builder
const createDTOBuilder = () => {
    const fields = [];

    return {
        field: (name, options = {}) => {
            fields.push({ name, ...options });
            return this;
        },

        string: (name, options = {}) => {
            return this.field(name, { ...options, type: 'string' });
        },

        number: (name, options = {}) => {
            return this.field(name, { ...options, type: 'number' });
        },

        boolean: (name, options = {}) => {
            return this.field(name, { ...options, type: 'boolean' });
        },

        date: (name, options = {}) => {
            return this.field(name, { ...options, type: 'date' });
        },

        nested: (name, builder, options = {}) => {
            return this.field(name, { ...options, nested: builder });
        },

        array: (name, itemBuilder, options = {}) => {
            return this.field(name, { ...options, array: true, itemBuilder });
        },

        build: (source) => {
            const result = {};

            for (const field of fields) {
                let value = source[field.from || field.name];

                // Apply default
                if (value === undefined && field.default !== undefined) {
                    value = typeof field.default === 'function' ? field.default() : field.default;
                }

                // Type coercion
                if (value !== undefined && field.type) {
                    switch (field.type) {
                        case 'string':
                            value = String(value);
                            break;
                        case 'number':
                            value = Number(value);
                            break;
                        case 'boolean':
                            value = Boolean(value);
                            break;
                        case 'date':
                            value = new Date(value);
                            break;
                    }
                }

                // Transform
                if (value !== undefined && field.transform) {
                    value = field.transform(value);
                }

                // Nested
                if (value !== undefined && field.nested) {
                    value = field.nested.build(value);
                }

                // Array
                if (value !== undefined && field.array && field.itemBuilder) {
                    value = value.map(item => field.itemBuilder.build(item));
                }

                if (value !== undefined || field.includeUndefined) {
                    result[field.name] = value;
                }
            }

            return result;
        },

        reset: () => {
            fields.length = 0;
            return this;
        },
    };
};

describe('Data Mapper Tests', () => {
    let mapper;

    beforeEach(() => {
        mapper = createDataMapper();
    });

    // ═══════════════════════════════════════════════════════════════════
    // DEFINE AND MAP
    // ═══════════════════════════════════════════════════════════════════

    describe('define and map', () => {
        it('should map simple fields', () => {
            mapper.define('userDTO', {
                id: 'userId',
                name: 'fullName',
            });

            const result = mapper.map('userDTO', {
                userId: '123',
                fullName: 'John Doe',
            });

            expect(result.id).toBe('123');
            expect(result.name).toBe('John Doe');
        });

        it('should map nested source paths', () => {
            mapper.define('userDTO', {
                email: 'contact.email',
                city: 'address.city',
            });

            const result = mapper.map('userDTO', {
                contact: { email: 'john@example.com' },
                address: { city: 'New York' },
            });

            expect(result.email).toBe('john@example.com');
            expect(result.city).toBe('New York');
        });

        it('should map to nested target paths', () => {
            mapper.define('userDTO', {
                'meta.id': 'id',
                'meta.created': 'createdAt',
            });

            const result = mapper.map('userDTO', {
                id: '123',
                createdAt: '2024-01-15',
            });

            expect(result.meta.id).toBe('123');
            expect(result.meta.created).toBe('2024-01-15');
        });

        it('should throw for unknown mapping', () => {
            expect(() => mapper.map('unknown', {})).toThrow('Mapping not found');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // TRANSFORM
    // ═══════════════════════════════════════════════════════════════════

    describe('transform', () => {
        it('should apply transform', () => {
            mapper.define('userDTO', {
                name: { from: 'fullName', transform: v => v.toUpperCase() },
            });

            const result = mapper.map('userDTO', { fullName: 'John' });

            expect(result.name).toBe('JOHN');
        });

        it('should use function as config', () => {
            mapper.define('userDTO', {
                displayName: (source) => `${source.firstName} ${source.lastName}`,
            });

            const result = mapper.map('userDTO', { firstName: 'John', lastName: 'Doe' });

            expect(result.displayName).toBe('John Doe');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // DEFAULT
    // ═══════════════════════════════════════════════════════════════════

    describe('default', () => {
        it('should apply default value', () => {
            mapper.define('userDTO', {
                role: { from: 'role', default: 'user' },
            });

            const result = mapper.map('userDTO', {});

            expect(result.role).toBe('user');
        });

        it('should apply default function', () => {
            mapper.define('userDTO', {
                createdAt: { from: 'createdAt', default: () => new Date().toISOString() },
            });

            const result = mapper.map('userDTO', {});

            expect(result.createdAt).toBeDefined();
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // REQUIRED
    // ═══════════════════════════════════════════════════════════════════

    describe('required', () => {
        it('should throw for missing required field', () => {
            mapper.define('userDTO', {
                id: { from: 'userId', required: true },
            });

            expect(() => mapper.map('userDTO', {})).toThrow('Required field missing');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // MAP ARRAY
    // ═══════════════════════════════════════════════════════════════════

    describe('mapArray', () => {
        it('should map array of objects', () => {
            mapper.define('userDTO', { name: 'fullName' });

            const result = mapper.mapArray('userDTO', [
                { fullName: 'John' },
                { fullName: 'Jane' },
            ]);

            expect(result.length).toBe(2);
            expect(result[0].name).toBe('John');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // EXTEND
    // ═══════════════════════════════════════════════════════════════════

    describe('extend', () => {
        it('should extend base mapping', () => {
            mapper.define('baseUser', { id: 'userId' });
            mapper.extend('baseUser', 'fullUser', { email: 'emailAddress' });

            const result = mapper.map('fullUser', {
                userId: '123',
                emailAddress: 'john@example.com',
            });

            expect(result.id).toBe('123');
            expect(result.email).toBe('john@example.com');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // COMPOSE
    // ═══════════════════════════════════════════════════════════════════

    describe('compose', () => {
        it('should compose mappings', () => {
            mapper.define('step1', { name: 'fullName' });
            mapper.define('step2', { displayName: 'name' });

            const composed = mapper.compose('step1', 'step2');
            const result = composed({ fullName: 'John Doe' });

            expect(result.displayName).toBe('John Doe');
        });
    });
});

describe('DTO Builder Tests', () => {
    let builder;

    beforeEach(() => {
        builder = createDTOBuilder();
    });

    // ═══════════════════════════════════════════════════════════════════
    // FIELD TYPES
    // ═══════════════════════════════════════════════════════════════════

    describe('Field Types', () => {
        it('should build string field', () => {
            const result = builder
                .string('name')
                .build({ name: 123 });

            expect(result.name).toBe('123');
        });

        it('should build number field', () => {
            const result = builder
                .number('age')
                .build({ age: '30' });

            expect(result.age).toBe(30);
        });

        it('should build boolean field', () => {
            const result = builder
                .boolean('active')
                .build({ active: 1 });

            expect(result.active).toBe(true);
        });

        it('should build date field', () => {
            const result = builder
                .date('createdAt')
                .build({ createdAt: '2024-01-15' });

            expect(result.createdAt).toBeInstanceOf(Date);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // OPTIONS
    // ═══════════════════════════════════════════════════════════════════

    describe('Options', () => {
        it('should apply default', () => {
            const result = builder
                .field('role', { default: 'user' })
                .build({});

            expect(result.role).toBe('user');
        });

        it('should apply transform', () => {
            const result = builder
                .field('name', { transform: v => v.toUpperCase() })
                .build({ name: 'john' });

            expect(result.name).toBe('JOHN');
        });

        it('should map from different field', () => {
            const result = builder
                .field('id', { from: 'userId' })
                .build({ userId: '123' });

            expect(result.id).toBe('123');
        });
    });
});
