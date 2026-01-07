/**
 * Test Fixtures and Factories Tests
 * Tests for test data generation patterns
 * 
 * @module tests/testing/fixtures.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Factory builder for test data
const createFactoryBuilder = () => {
    const factories = new Map();
    const sequences = new Map();
    const traits = new Map();

    return {
        define: (name, defaultAttrs, options = {}) => {
            factories.set(name, {
                defaults: defaultAttrs,
                afterCreate: options.afterCreate,
                beforeCreate: options.beforeCreate,
            });
            sequences.set(name, 0);
            traits.set(name, new Map());
        },

        trait: (factoryName, traitName, attrs) => {
            const factoryTraits = traits.get(factoryName);
            if (factoryTraits) {
                factoryTraits.set(traitName, attrs);
            }
        },

        build: (name, overrides = {}, options = {}) => {
            const factory = factories.get(name);
            if (!factory) throw new Error(`Factory "${name}" not defined`);

            const seq = sequences.get(name);
            sequences.set(name, seq + 1);

            // Resolve defaults (can be functions)
            const defaults = typeof factory.defaults === 'function'
                ? factory.defaults(seq)
                : { ...factory.defaults };

            // Apply traits
            let traitAttrs = {};
            if (options.traits) {
                const factoryTraits = traits.get(name);
                for (const traitName of options.traits) {
                    const trait = factoryTraits?.get(traitName);
                    if (trait) {
                        const resolved = typeof trait === 'function' ? trait(seq) : trait;
                        traitAttrs = { ...traitAttrs, ...resolved };
                    }
                }
            }

            const result = { ...defaults, ...traitAttrs, ...overrides };

            // Hooks
            factory.beforeCreate?.(result);

            return result;
        },

        buildList: (name, count, overrides = {}, options = {}) => {
            return Array.from({ length: count }, (_, i) =>
                this.build(name, typeof overrides === 'function' ? overrides(i) : overrides, options)
            );
        },

        resetSequence: (name) => {
            sequences.set(name, 0);
        },

        resetAll: () => {
            for (const key of sequences.keys()) {
                sequences.set(key, 0);
            }
        },
    };
};

// Fixture manager
const createFixtureManager = () => {
    const fixtures = new Map();
    const loaded = new Map();

    return {
        register: (name, loader) => {
            fixtures.set(name, loader);
        },

        load: async (name) => {
            if (loaded.has(name)) {
                return loaded.get(name);
            }

            const loader = fixtures.get(name);
            if (!loader) throw new Error(`Fixture "${name}" not registered`);

            const data = await loader();
            loaded.set(name, data);
            return data;
        },

        get: (name) => {
            return loaded.get(name);
        },

        clear: (name) => {
            if (name) {
                loaded.delete(name);
            } else {
                loaded.clear();
            }
        },

        loadAll: async (names) => {
            const results = {};
            for (const name of names) {
                results[name] = await this.load(name);
            }
            return results;
        },
    };
};

// Test data builder (fluent API)
const createTestDataBuilder = (initialData = {}) => {
    let data = { ...initialData };

    const builder = {
        with: (key, value) => {
            data[key] = value;
            return builder;
        },

        without: (key) => {
            delete data[key];
            return builder;
        },

        merge: (obj) => {
            data = { ...data, ...obj };
            return builder;
        },

        transform: (key, fn) => {
            if (key in data) {
                data[key] = fn(data[key]);
            }
            return builder;
        },

        build: () => ({ ...data }),

        clone: () => createTestDataBuilder({ ...data }),
    };

    return builder;
};

// Random data generators
const createRandomGenerator = (seed = Date.now()) => {
    // Simple seeded random for reproducibility
    let s = seed;
    const random = () => {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        return s / 0x7fffffff;
    };

    return {
        int: (min = 0, max = 100) => Math.floor(random() * (max - min + 1)) + min,

        float: (min = 0, max = 1) => random() * (max - min) + min,

        bool: (probability = 0.5) => random() < probability,

        pick: (array) => array[Math.floor(random() * array.length)],

        shuffle: (array) => {
            const result = [...array];
            for (let i = result.length - 1; i > 0; i--) {
                const j = Math.floor(random() * (i + 1));
                [result[i], result[j]] = [result[j], result[i]];
            }
            return result;
        },

        string: (length = 10) => {
            const chars = 'abcdefghijklmnopqrstuvwxyz';
            return Array.from({ length }, () => chars[Math.floor(random() * chars.length)]).join('');
        },

        email: () => `${this.string(8)}@example.com`,

        uuid: () => {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
                const r = Math.floor(random() * 16);
                const v = c === 'x' ? r : (r & 0x3) | 0x8;
                return v.toString(16);
            });
        },

        date: (start = new Date(2020, 0, 1), end = new Date()) => {
            return new Date(start.getTime() + random() * (end.getTime() - start.getTime()));
        },

        setSeed: (newSeed) => {
            s = newSeed;
        },
    };
};

describe('Factory Builder Tests', () => {
    let factory;

    beforeEach(() => {
        factory = createFactoryBuilder();
        factory.define('user', (seq) => ({
            id: seq + 1,
            name: `User ${seq + 1}`,
            email: `user${seq + 1}@example.com`,
            active: true,
        }));
    });

    it('should build with defaults', () => {
        const user = factory.build('user');

        expect(user.id).toBe(1);
        expect(user.name).toBe('User 1');
        expect(user.active).toBe(true);
    });

    it('should apply overrides', () => {
        const user = factory.build('user', { name: 'Custom Name' });

        expect(user.name).toBe('Custom Name');
        expect(user.id).toBe(1);
    });

    it('should increment sequence', () => {
        const user1 = factory.build('user');
        const user2 = factory.build('user');

        expect(user1.id).toBe(1);
        expect(user2.id).toBe(2);
    });

    it('should build list', () => {
        const users = factory.buildList('user', 3);

        expect(users.length).toBe(3);
        expect(users[0].id).toBe(1);
        expect(users[2].id).toBe(3);
    });

    it('should apply traits', () => {
        factory.trait('user', 'admin', { role: 'admin', permissions: ['all'] });

        const admin = factory.build('user', {}, { traits: ['admin'] });

        expect(admin.role).toBe('admin');
        expect(admin.permissions).toContain('all');
    });

    it('should reset sequence', () => {
        factory.build('user');
        factory.build('user');
        factory.resetSequence('user');

        const user = factory.build('user');
        expect(user.id).toBe(1);
    });
});

describe('Fixture Manager Tests', () => {
    let fixtures;

    beforeEach(() => {
        fixtures = createFixtureManager();
    });

    it('should register and load fixture', async () => {
        fixtures.register('products', async () => [
            { id: 1, name: 'Product A' },
            { id: 2, name: 'Product B' },
        ]);

        const data = await fixtures.load('products');

        expect(data.length).toBe(2);
        expect(data[0].name).toBe('Product A');
    });

    it('should cache loaded fixtures', async () => {
        const loader = vi.fn(async () => ({ value: 42 }));
        fixtures.register('config', loader);

        await fixtures.load('config');
        await fixtures.load('config');

        expect(loader).toHaveBeenCalledTimes(1);
    });

    it('should get loaded fixture synchronously', async () => {
        fixtures.register('data', async () => ({ test: true }));
        await fixtures.load('data');

        expect(fixtures.get('data').test).toBe(true);
    });

    it('should clear fixtures', async () => {
        fixtures.register('temp', async () => ({}));
        await fixtures.load('temp');
        fixtures.clear('temp');

        expect(fixtures.get('temp')).toBeUndefined();
    });

    it('should load multiple fixtures', async () => {
        fixtures.register('a', async () => ({ a: 1 }));
        fixtures.register('b', async () => ({ b: 2 }));

        const result = await fixtures.loadAll(['a', 'b']);

        expect(result.a.a).toBe(1);
        expect(result.b.b).toBe(2);
    });
});

describe('Test Data Builder Tests', () => {
    it('should build with fluent API', () => {
        const user = createTestDataBuilder({ name: 'John', age: 25 })
            .with('email', 'john@example.com')
            .with('role', 'user')
            .build();

        expect(user.name).toBe('John');
        expect(user.email).toBe('john@example.com');
    });

    it('should remove properties', () => {
        const data = createTestDataBuilder({ a: 1, b: 2, c: 3 })
            .without('b')
            .build();

        expect(data.a).toBe(1);
        expect(data.b).toBeUndefined();
        expect(data.c).toBe(3);
    });

    it('should merge objects', () => {
        const data = createTestDataBuilder({ a: 1 })
            .merge({ b: 2, c: 3 })
            .build();

        expect(data).toEqual({ a: 1, b: 2, c: 3 });
    });

    it('should transform values', () => {
        const data = createTestDataBuilder({ count: 5 })
            .transform('count', (n) => n * 2)
            .build();

        expect(data.count).toBe(10);
    });

    it('should clone builder', () => {
        const base = createTestDataBuilder({ type: 'base' });
        const clone = base.clone().with('type', 'clone');

        expect(base.build().type).toBe('base');
        expect(clone.build().type).toBe('clone');
    });
});

describe('Random Generator Tests', () => {
    let rng;

    beforeEach(() => {
        rng = createRandomGenerator(12345); // Fixed seed for reproducibility
    });

    it('should generate reproducible integers', () => {
        const a = rng.int(1, 100);

        rng.setSeed(12345);
        const b = rng.int(1, 100);

        expect(a).toBe(b);
    });

    it('should generate integers in range', () => {
        for (let i = 0; i < 50; i++) {
            const n = rng.int(10, 20);
            expect(n).toBeGreaterThanOrEqual(10);
            expect(n).toBeLessThanOrEqual(20);
        }
    });

    it('should pick from array', () => {
        const items = ['a', 'b', 'c'];
        const picked = rng.pick(items);

        expect(items).toContain(picked);
    });

    it('should shuffle array', () => {
        const original = [1, 2, 3, 4, 5];
        const shuffled = rng.shuffle(original);

        expect(shuffled.length).toBe(original.length);
        expect(shuffled.sort()).toEqual(original);
    });

    it('should generate string', () => {
        const str = rng.string(15);

        expect(str.length).toBe(15);
        expect(/^[a-z]+$/.test(str)).toBe(true);
    });

    it('should generate UUID format', () => {
        const uuid = rng.uuid();

        expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it('should generate date in range', () => {
        const start = new Date(2023, 0, 1);
        const end = new Date(2023, 11, 31);
        const date = rng.date(start, end);

        expect(date.getTime()).toBeGreaterThanOrEqual(start.getTime());
        expect(date.getTime()).toBeLessThanOrEqual(end.getTime());
    });
});
