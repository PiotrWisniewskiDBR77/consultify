/**
 * Plugin System Tests
 * Tests for extensible plugin architecture
 * 
 * @module tests/plugins/plugin-system.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Plugin manager
const createPluginManager = () => {
    const plugins = new Map();
    const hooks = new Map();
    const middleware = [];

    return {
        register: (name, plugin) => {
            if (plugins.has(name)) {
                throw new Error(`Plugin ${name} already registered`);
            }

            const pluginInstance = {
                name,
                version: plugin.version || '1.0.0',
                enabled: true,
                hooks: plugin.hooks || {},
                middleware: plugin.middleware || [],
                initialize: plugin.initialize,
                destroy: plugin.destroy,
            };

            plugins.set(name, pluginInstance);

            // Register hooks
            for (const [hookName, handler] of Object.entries(pluginInstance.hooks)) {
                if (!hooks.has(hookName)) {
                    hooks.set(hookName, []);
                }
                hooks.get(hookName).push({ plugin: name, handler });
            }

            // Register middleware
            for (const mw of pluginInstance.middleware) {
                middleware.push({ plugin: name, handler: mw });
            }

            return pluginInstance;
        },

        unregister: (name) => {
            const plugin = plugins.get(name);
            if (!plugin) return false;

            // Remove hooks
            for (const handlers of hooks.values()) {
                const index = handlers.findIndex(h => h.plugin === name);
                if (index !== -1) handlers.splice(index, 1);
            }

            // Remove middleware
            for (let i = middleware.length - 1; i >= 0; i--) {
                if (middleware[i].plugin === name) {
                    middleware.splice(i, 1);
                }
            }

            plugins.delete(name);
            return true;
        },

        enable: (name) => {
            const plugin = plugins.get(name);
            if (plugin) plugin.enabled = true;
        },

        disable: (name) => {
            const plugin = plugins.get(name);
            if (plugin) plugin.enabled = false;
        },

        executeHook: async (hookName, context = {}) => {
            const handlers = hooks.get(hookName) || [];
            let result = context;

            for (const { plugin, handler } of handlers) {
                if (plugins.get(plugin)?.enabled) {
                    result = await handler(result);
                }
            }

            return result;
        },

        runMiddleware: async (context, next) => {
            let index = 0;

            const run = async (ctx) => {
                if (index >= middleware.length) {
                    return next ? await next(ctx) : ctx;
                }

                const mw = middleware[index++];
                if (plugins.get(mw.plugin)?.enabled) {
                    return mw.handler(ctx, run);
                }
                return run(ctx);
            };

            return run(context);
        },

        getPlugin: (name) => plugins.get(name),

        listPlugins: () => [...plugins.values()].map(p => ({
            name: p.name,
            version: p.version,
            enabled: p.enabled,
        })),

        initializeAll: async () => {
            for (const plugin of plugins.values()) {
                if (plugin.initialize) {
                    await plugin.initialize();
                }
            }
        },

        destroyAll: async () => {
            for (const plugin of plugins.values()) {
                if (plugin.destroy) {
                    await plugin.destroy();
                }
            }
        },
    };
};

// Extension registry
const createExtensionRegistry = () => {
    const extensions = new Map(); // point -> extensions[]

    return {
        registerPoint: (name) => {
            if (!extensions.has(name)) {
                extensions.set(name, []);
            }
        },

        extend: (point, extension) => {
            if (!extensions.has(point)) {
                extensions.set(point, []);
            }

            const ext = {
                id: crypto.randomUUID(),
                ...extension,
                priority: extension.priority || 0,
            };

            extensions.get(point).push(ext);
            extensions.get(point).sort((a, b) => b.priority - a.priority);

            return ext.id;
        },

        remove: (point, extensionId) => {
            const exts = extensions.get(point);
            if (!exts) return false;

            const index = exts.findIndex(e => e.id === extensionId);
            if (index !== -1) {
                exts.splice(index, 1);
                return true;
            }
            return false;
        },

        getExtensions: (point) => {
            return [...(extensions.get(point) || [])];
        },

        execute: async (point, context) => {
            const exts = extensions.get(point) || [];
            let result = context;

            for (const ext of exts) {
                if (ext.handler) {
                    result = await ext.handler(result);
                }
            }

            return result;
        },

        getPoints: () => [...extensions.keys()],
    };
};

// Module loader
const createModuleLoader = () => {
    const modules = new Map();
    const dependencies = new Map();

    const resolveDependencies = (name, resolved = new Set(), stack = []) => {
        if (stack.includes(name)) {
            throw new Error(`Circular dependency: ${stack.join(' -> ')} -> ${name}`);
        }

        if (resolved.has(name)) return;

        const deps = dependencies.get(name) || [];
        for (const dep of deps) {
            resolveDependencies(dep, resolved, [...stack, name]);
        }

        resolved.add(name);
    };

    return {
        register: (name, module, deps = []) => {
            modules.set(name, {
                name,
                module,
                loaded: false,
            });
            dependencies.set(name, deps);
        },

        load: async (name) => {
            const entry = modules.get(name);
            if (!entry) throw new Error(`Module not found: ${name}`);
            if (entry.loaded) return entry.instance;

            // Load dependencies first
            for (const dep of dependencies.get(name) || []) {
                await this.load(dep);
            }

            // Load this module
            const depInstances = {};
            for (const dep of dependencies.get(name) || []) {
                depInstances[dep] = modules.get(dep).instance;
            }

            entry.instance = await entry.module(depInstances);
            entry.loaded = true;

            return entry.instance;
        },

        loadAll: async () => {
            const order = [];
            const resolved = new Set();

            for (const name of modules.keys()) {
                resolveDependencies(name, resolved);
            }

            for (const name of resolved) {
                await this.load(name);
                order.push(name);
            }

            return order;
        },

        isLoaded: (name) => modules.get(name)?.loaded || false,

        unload: (name) => {
            const entry = modules.get(name);
            if (entry) {
                entry.loaded = false;
                entry.instance = undefined;
            }
        },

        getModule: (name) => modules.get(name)?.instance,
    };
};

describe('Plugin Manager Tests', () => {
    let manager;

    beforeEach(() => {
        manager = createPluginManager();
    });

    it('should register plugin', () => {
        manager.register('my-plugin', { version: '1.0.0' });

        expect(manager.getPlugin('my-plugin')).toBeTruthy();
        expect(manager.getPlugin('my-plugin').version).toBe('1.0.0');
    });

    it('should execute hooks', async () => {
        manager.register('transform', {
            hooks: {
                'before-save': async (ctx) => ({ ...ctx, transformed: true }),
            },
        });

        const result = await manager.executeHook('before-save', { data: 'test' });

        expect(result.transformed).toBe(true);
    });

    it('should skip disabled plugins', async () => {
        manager.register('disabled', {
            hooks: {
                'test': async (ctx) => ({ ...ctx, ran: true }),
            },
        });

        manager.disable('disabled');
        const result = await manager.executeHook('test', {});

        expect(result.ran).toBeUndefined();
    });

    it('should run middleware', async () => {
        manager.register('logging', {
            middleware: [
                async (ctx, next) => {
                    ctx.logged = true;
                    return next(ctx);
                },
            ],
        });

        const result = await manager.runMiddleware({ data: 1 }, async (ctx) => ctx);

        expect(result.logged).toBe(true);
    });

    it('should unregister plugin', () => {
        manager.register('temp', {});
        manager.unregister('temp');

        expect(manager.getPlugin('temp')).toBeUndefined();
    });

    it('should list plugins', () => {
        manager.register('a', {});
        manager.register('b', {});

        const list = manager.listPlugins();

        expect(list).toHaveLength(2);
    });
});

describe('Extension Registry Tests', () => {
    let registry;

    beforeEach(() => {
        registry = createExtensionRegistry();
    });

    it('should register extension point', () => {
        registry.registerPoint('menu.items');

        expect(registry.getPoints()).toContain('menu.items');
    });

    it('should add extensions', () => {
        const id = registry.extend('toolbar', {
            label: 'My Button',
            handler: async () => { },
        });

        expect(id).toBeTruthy();
        expect(registry.getExtensions('toolbar')).toHaveLength(1);
    });

    it('should respect priority', () => {
        registry.extend('actions', { name: 'low', priority: 1 });
        registry.extend('actions', { name: 'high', priority: 10 });
        registry.extend('actions', { name: 'medium', priority: 5 });

        const exts = registry.getExtensions('actions');

        expect(exts[0].name).toBe('high');
        expect(exts[1].name).toBe('medium');
        expect(exts[2].name).toBe('low');
    });

    it('should execute extensions', async () => {
        registry.extend('transform', {
            handler: async (ctx) => ({ ...ctx, a: true }),
        });
        registry.extend('transform', {
            handler: async (ctx) => ({ ...ctx, b: true }),
        });

        const result = await registry.execute('transform', {});

        expect(result.a).toBe(true);
        expect(result.b).toBe(true);
    });
});

describe('Module Loader Tests', () => {
    let loader;

    beforeEach(() => {
        loader = createModuleLoader();
    });

    it('should load module', async () => {
        loader.register('config', async () => ({ apiUrl: 'http://api' }));

        const config = await loader.load('config');

        expect(config.apiUrl).toBe('http://api');
    });

    it('should load dependencies', async () => {
        loader.register('db', async () => ({ connect: vi.fn() }));
        loader.register('service', async (deps) => ({
            db: deps.db,
            query: vi.fn(),
        }), ['db']);

        const service = await loader.load('service');

        expect(service.db).toBeTruthy();
    });

    it('should detect circular dependencies', async () => {
        loader.register('a', async () => ({}), ['b']);
        loader.register('b', async () => ({}), ['a']);

        await expect(loader.loadAll()).rejects.toThrow('Circular');
    });

    it('should load all in order', async () => {
        loader.register('c', async () => ({}), ['b']);
        loader.register('a', async () => ({}));
        loader.register('b', async () => ({}), ['a']);

        const order = await loader.loadAll();

        expect(order.indexOf('a')).toBeLessThan(order.indexOf('b'));
        expect(order.indexOf('b')).toBeLessThan(order.indexOf('c'));
    });
});
