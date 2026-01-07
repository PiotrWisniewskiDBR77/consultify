/**
 * Advanced Dependency Injection Tests
 * Tests for IoC container with lifecycle hooks
 * 
 * @module tests/di/advanced-container.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Advanced DI container with lifecycles
const createAdvancedContainer = () => {
    const registry = new Map();
    const singletons = new Map();
    const hooks = { beforeResolve: [], afterResolve: [] };

    return {
        register: (name, factory, options = {}) => {
            registry.set(name, {
                factory,
                singleton: options.singleton || false,
                lazy: options.lazy || false,
                onInit: options.onInit,
                onDispose: options.onDispose,
            });
        },

        value: (name, value) => {
            registry.set(name, {
                factory: () => value,
                singleton: true,
            });
            singletons.set(name, value);
        },

        resolve: (name) => {
            for (const hook of hooks.beforeResolve) {
                hook(name);
            }

            const entry = registry.get(name);
            if (!entry) throw new Error(`Not found: ${name}`);

            let instance;
            if (entry.singleton && singletons.has(name)) {
                instance = singletons.get(name);
            } else {
                instance = entry.factory(this);
                if (entry.onInit) entry.onInit(instance);
                if (entry.singleton) singletons.set(name, instance);
            }

            for (const hook of hooks.afterResolve) {
                hook(name, instance);
            }

            return instance;
        },

        has: (name) => registry.has(name),

        dispose: async (name) => {
            const entry = registry.get(name);
            const instance = singletons.get(name);

            if (entry?.onDispose && instance) {
                await entry.onDispose(instance);
            }
            singletons.delete(name);
        },

        disposeAll: async () => {
            for (const name of singletons.keys()) {
                await this.dispose(name);
            }
        },

        onBeforeResolve: (fn) => hooks.beforeResolve.push(fn),
        onAfterResolve: (fn) => hooks.afterResolve.push(fn),

        getRegistered: () => [...registry.keys()],
    };
};

// Module system
const createModuleSystem = () => {
    const modules = new Map();
    const loaded = new Set();

    return {
        define: (name, dependencies, factory) => {
            modules.set(name, { dependencies, factory });
        },

        load: (name) => {
            if (loaded.has(name)) return modules.get(name).instance;

            const mod = modules.get(name);
            if (!mod) throw new Error(`Module not found: ${name}`);

            // Load dependencies first
            const deps = mod.dependencies.map(d => this.load(d));
            mod.instance = mod.factory(...deps);
            loaded.add(name);

            return mod.instance;
        },

        isLoaded: (name) => loaded.has(name),

        unload: (name) => {
            loaded.delete(name);
            const mod = modules.get(name);
            if (mod) mod.instance = null;
        },

        getLoadOrder: (name, order = []) => {
            const mod = modules.get(name);
            if (!mod) return order;

            for (const dep of mod.dependencies) {
                if (!order.includes(dep)) {
                    this.getLoadOrder(dep, order);
                }
            }

            if (!order.includes(name)) {
                order.push(name);
            }

            return order;
        },
    };
};

describe('Advanced Container Tests', () => {
    let container;

    beforeEach(() => {
        container = createAdvancedContainer();
    });

    it('should call onInit', () => {
        const onInit = vi.fn();
        container.register('service', () => ({ start: vi.fn() }), { onInit, singleton: true });

        container.resolve('service');

        expect(onInit).toHaveBeenCalled();
    });

    it('should call onDispose', async () => {
        const onDispose = vi.fn();
        container.register('service', () => ({ stop: vi.fn() }), { onDispose, singleton: true });

        container.resolve('service');
        await container.dispose('service');

        expect(onDispose).toHaveBeenCalled();
    });

    it('should trigger hooks', () => {
        const before = vi.fn();
        const after = vi.fn();

        container.onBeforeResolve(before);
        container.onAfterResolve(after);
        container.value('test', 123);

        container.resolve('test');

        expect(before).toHaveBeenCalledWith('test');
        expect(after).toHaveBeenCalled();
    });

    it('should list registered', () => {
        container.value('a', 1);
        container.value('b', 2);

        expect(container.getRegistered()).toContain('a');
        expect(container.getRegistered()).toContain('b');
    });

    it('should dispose all', async () => {
        const dispose1 = vi.fn();
        const dispose2 = vi.fn();

        container.register('s1', () => ({}), { onDispose: dispose1, singleton: true });
        container.register('s2', () => ({}), { onDispose: dispose2, singleton: true });

        container.resolve('s1');
        container.resolve('s2');
        await container.disposeAll();

        expect(dispose1).toHaveBeenCalled();
        expect(dispose2).toHaveBeenCalled();
    });
});

describe('Module System Tests', () => {
    let system;

    beforeEach(() => {
        system = createModuleSystem();
    });

    it('should define and load module', () => {
        system.define('config', [], () => ({ apiUrl: 'http://api' }));

        const config = system.load('config');

        expect(config.apiUrl).toBe('http://api');
    });

    it('should resolve dependencies', () => {
        system.define('db', [], () => ({ query: vi.fn() }));
        system.define('service', ['db'], (db) => ({ db, run: vi.fn() }));

        const service = system.load('service');

        expect(service.db.query).toBeDefined();
    });

    it('should track loaded state', () => {
        system.define('mod', [], () => ({}));

        expect(system.isLoaded('mod')).toBe(false);
        system.load('mod');
        expect(system.isLoaded('mod')).toBe(true);
    });

    it('should calculate load order', () => {
        system.define('a', [], () => ({}));
        system.define('b', ['a'], () => ({}));
        system.define('c', ['b'], () => ({}));

        const order = system.getLoadOrder('c');

        expect(order).toEqual(['a', 'b', 'c']);
    });
});
