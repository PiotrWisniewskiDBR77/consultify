/**
 * Factory Pattern Tests
 * Tests for factory pattern implementations
 * 
 * @module tests/patterns/factory.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Simple factory
const createSimpleFactory = (creators) => {
    return {
        create: (type, ...args) => {
            const creator = creators[type];
            if (!creator) {
                throw new Error(`Unknown type: ${type}`);
            }
            return creator(...args);
        },

        register: (type, creator) => {
            creators[type] = creator;
        },

        unregister: (type) => {
            delete creators[type];
        },

        getTypes: () => Object.keys(creators),

        has: (type) => type in creators,
    };
};

// Abstract factory
const createAbstractFactory = () => {
    const factories = new Map();

    return {
        registerFactory: (name, factory) => {
            factories.set(name, factory);
        },

        getFactory: (name) => {
            const factory = factories.get(name);
            if (!factory) {
                throw new Error(`Factory not found: ${name}`);
            }
            return factory;
        },

        create: (factoryName, productType, ...args) => {
            const factory = factories.get(factoryName);
            if (!factory) {
                throw new Error(`Factory not found: ${factoryName}`);
            }
            return factory.create(productType, ...args);
        },

        getFactoryNames: () => [...factories.keys()],
    };
};

// Builder factory (creates builders)
const createBuilderFactory = () => {
    const builders = new Map();

    return {
        register: (type, builderClass) => {
            builders.set(type, builderClass);
        },

        getBuilder: (type) => {
            const BuilderClass = builders.get(type);
            if (!BuilderClass) {
                throw new Error(`Builder not found: ${type}`);
            }
            return new BuilderClass();
        },
    };
};

// Pool factory (object pooling)
const createPoolFactory = (creator, options = {}) => {
    const { initialSize = 0, maxSize = 100, resetFn } = options;
    const available = [];
    const inUse = new Set();

    // Initialize pool
    for (let i = 0; i < initialSize; i++) {
        available.push(creator());
    }

    return {
        acquire: () => {
            let instance;

            if (available.length > 0) {
                instance = available.pop();
            } else if (inUse.size < maxSize) {
                instance = creator();
            } else {
                throw new Error('Pool exhausted');
            }

            inUse.add(instance);
            return instance;
        },

        release: (instance) => {
            if (!inUse.has(instance)) {
                throw new Error('Instance not from this pool');
            }

            inUse.delete(instance);

            if (resetFn) {
                resetFn(instance);
            }

            available.push(instance);
        },

        getStats: () => ({
            available: available.length,
            inUse: inUse.size,
            total: available.length + inUse.size,
            maxSize,
        }),

        clear: () => {
            available.length = 0;
            inUse.clear();
        },
    };
};

// Singleton factory
const createSingletonFactory = () => {
    const instances = new Map();

    return {
        get: (key, creator) => {
            if (!instances.has(key)) {
                instances.set(key, creator());
            }
            return instances.get(key);
        },

        has: (key) => instances.has(key),

        remove: (key) => instances.delete(key),

        clear: () => instances.clear(),
    };
};

// Prototype factory (clone-based)
const createPrototypeFactory = () => {
    const prototypes = new Map();

    return {
        register: (type, prototype) => {
            prototypes.set(type, prototype);
        },

        create: (type, overrides = {}) => {
            const prototype = prototypes.get(type);
            if (!prototype) {
                throw new Error(`Prototype not found: ${type}`);
            }

            // Deep clone and apply overrides
            const clone = JSON.parse(JSON.stringify(prototype));
            return { ...clone, ...overrides };
        },

        getPrototype: (type) => prototypes.get(type),
    };
};

describe('Factory Pattern Tests', () => {
    // ═══════════════════════════════════════════════════════════════════
    // SIMPLE FACTORY
    // ═══════════════════════════════════════════════════════════════════

    describe('Simple Factory', () => {
        let factory;

        beforeEach(() => {
            factory = createSimpleFactory({
                circle: (radius) => ({ type: 'circle', radius }),
                square: (size) => ({ type: 'square', size }),
            });
        });

        it('should create objects by type', () => {
            const circle = factory.create('circle', 5);
            const square = factory.create('square', 10);

            expect(circle.type).toBe('circle');
            expect(circle.radius).toBe(5);
            expect(square.type).toBe('square');
        });

        it('should throw for unknown type', () => {
            expect(() => factory.create('triangle')).toThrow('Unknown type');
        });

        it('should register new type', () => {
            factory.register('triangle', (a, b, c) => ({ type: 'triangle', sides: [a, b, c] }));

            const triangle = factory.create('triangle', 3, 4, 5);
            expect(triangle.sides).toEqual([3, 4, 5]);
        });

        it('should unregister type', () => {
            factory.unregister('circle');

            expect(() => factory.create('circle', 5)).toThrow();
        });

        it('should get available types', () => {
            expect(factory.getTypes()).toContain('circle');
            expect(factory.getTypes()).toContain('square');
        });

        it('should check if type exists', () => {
            expect(factory.has('circle')).toBe(true);
            expect(factory.has('hexagon')).toBe(false);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // ABSTRACT FACTORY
    // ═══════════════════════════════════════════════════════════════════

    describe('Abstract Factory', () => {
        let abstractFactory;

        beforeEach(() => {
            abstractFactory = createAbstractFactory();

            // Register UI factories for different themes
            abstractFactory.registerFactory('light', createSimpleFactory({
                button: () => ({ theme: 'light', component: 'button' }),
                input: () => ({ theme: 'light', component: 'input' }),
            }));

            abstractFactory.registerFactory('dark', createSimpleFactory({
                button: () => ({ theme: 'dark', component: 'button' }),
                input: () => ({ theme: 'dark', component: 'input' }),
            }));
        });

        it('should create products from specific factory', () => {
            const lightButton = abstractFactory.create('light', 'button');
            const darkButton = abstractFactory.create('dark', 'button');

            expect(lightButton.theme).toBe('light');
            expect(darkButton.theme).toBe('dark');
        });

        it('should get factory by name', () => {
            const lightFactory = abstractFactory.getFactory('light');

            expect(lightFactory.create('button').theme).toBe('light');
        });

        it('should throw for unknown factory', () => {
            expect(() => abstractFactory.getFactory('neon')).toThrow('not found');
        });

        it('should list factory names', () => {
            expect(abstractFactory.getFactoryNames()).toContain('light');
            expect(abstractFactory.getFactoryNames()).toContain('dark');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // POOL FACTORY
    // ═══════════════════════════════════════════════════════════════════

    describe('Pool Factory', () => {
        let pool;
        let createCount;

        beforeEach(() => {
            createCount = 0;
            pool = createPoolFactory(
                () => ({ id: ++createCount, data: null }),
                { initialSize: 2, maxSize: 5, resetFn: (obj) => { obj.data = null; } }
            );
        });

        it('should acquire from pool', () => {
            const obj = pool.acquire();

            expect(obj.id).toBeDefined();
        });

        it('should reuse released objects', () => {
            const obj1 = pool.acquire();
            const id = obj1.id;

            pool.release(obj1);
            const obj2 = pool.acquire();

            expect(obj2.id).toBe(id);
        });

        it('should reset object on release', () => {
            const obj = pool.acquire();
            obj.data = 'test';

            pool.release(obj);
            const reacquired = pool.acquire();

            expect(reacquired.data).toBeNull();
        });

        it('should throw when pool exhausted', () => {
            for (let i = 0; i < 5; i++) {
                pool.acquire();
            }

            expect(() => pool.acquire()).toThrow('exhausted');
        });

        it('should get pool stats', () => {
            pool.acquire();
            pool.acquire();

            const stats = pool.getStats();

            expect(stats.inUse).toBe(2);
            expect(stats.available).toBe(0);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // SINGLETON FACTORY
    // ═══════════════════════════════════════════════════════════════════

    describe('Singleton Factory', () => {
        let singletonFactory;

        beforeEach(() => {
            singletonFactory = createSingletonFactory();
        });

        it('should create instance once', () => {
            let callCount = 0;

            const instance1 = singletonFactory.get('db', () => ({ id: ++callCount }));
            const instance2 = singletonFactory.get('db', () => ({ id: ++callCount }));

            expect(instance1).toBe(instance2);
            expect(callCount).toBe(1);
        });

        it('should check if instance exists', () => {
            singletonFactory.get('test', () => ({}));

            expect(singletonFactory.has('test')).toBe(true);
            expect(singletonFactory.has('other')).toBe(false);
        });

        it('should remove instance', () => {
            singletonFactory.get('test', () => ({ version: 1 }));
            singletonFactory.remove('test');

            const newInstance = singletonFactory.get('test', () => ({ version: 2 }));
            expect(newInstance.version).toBe(2);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // PROTOTYPE FACTORY
    // ═══════════════════════════════════════════════════════════════════

    describe('Prototype Factory', () => {
        let prototypeFactory;

        beforeEach(() => {
            prototypeFactory = createPrototypeFactory();

            prototypeFactory.register('user', {
                role: 'user',
                permissions: ['read'],
                settings: { theme: 'light' },
            });
        });

        it('should create from prototype', () => {
            const user = prototypeFactory.create('user');

            expect(user.role).toBe('user');
            expect(user.permissions).toEqual(['read']);
        });

        it('should apply overrides', () => {
            const admin = prototypeFactory.create('user', {
                role: 'admin',
                permissions: ['read', 'write', 'delete'],
            });

            expect(admin.role).toBe('admin');
            expect(admin.permissions).toContain('delete');
        });

        it('should not modify prototype', () => {
            const user = prototypeFactory.create('user', { role: 'guest' });

            const prototype = prototypeFactory.getPrototype('user');
            expect(prototype.role).toBe('user');
        });
    });
});
