/**
 * Dependency Injection Container Tests
 * Tests for DI container implementation
 *
 * @module tests/di/container.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// DI Container implementation
const createContainer = () => {
  const services = new Map();
  const singletons = new Map();
  const factories = new Map();
  const aliases = new Map();
  const tags = new Map();

  return {
    // Register a class/constructor
    register: (name, Service, options = {}) => {
      const { singleton = false, dependencies = [] } = options;

      services.set(name, {
        Service,
        singleton,
        dependencies,
      });

      return this;
    },

    // Register a factory function
    factory: (name, factoryFn, options = {}) => {
      const { singleton = false } = options;

      factories.set(name, {
        factory: factoryFn,
        singleton,
      });

      return this;
    },

    // Register a pre-instantiated value
    value: (name, value) => {
      singletons.set(name, value);
      return this;
    },

    // Create an alias
    alias: (aliasName, originalName) => {
      aliases.set(aliasName, originalName);
      return this;
    },

    // Tag a service
    tag: (name, tagName) => {
      if (!tags.has(tagName)) {
        tags.set(tagName, []);
      }
      tags.get(tagName).push(name);
      return this;
    },

    // Resolve a service
    resolve: (name) => {
      // Check alias
      if (aliases.has(name)) {
        return this.resolve(aliases.get(name));
      }

      // Check if already instantiated singleton
      if (singletons.has(name)) {
        return singletons.get(name);
      }

      // Check factory
      if (factories.has(name)) {
        const { factory, singleton } = factories.get(name);
        const instance = factory(this);

        if (singleton) {
          singletons.set(name, instance);
        }

        return instance;
      }

      // Check registered service
      if (services.has(name)) {
        const { Service, singleton, dependencies } = services.get(name);
        const resolvedDeps = dependencies.map((dep) => this.resolve(dep));
        const instance = new Service(...resolvedDeps);

        if (singleton) {
          singletons.set(name, instance);
        }

        return instance;
      }

      throw new Error(`Service not found: ${name}`);
    },

    // Get all services with a tag
    getTagged: (tagName) => {
      const taggedNames = tags.get(tagName) || [];
      return taggedNames.map((name) => this.resolve(name));
    },

    // Check if service is registered
    has: (name) => {
      return services.has(name) || factories.has(name) || singletons.has(name) || aliases.has(name);
    },

    // Remove a service
    remove: (name) => {
      services.delete(name);
      factories.delete(name);
      singletons.delete(name);
      aliases.delete(name);
    },

    // Clear all services
    clear: () => {
      services.clear();
      factories.clear();
      singletons.clear();
      aliases.clear();
      tags.clear();
    },

    // Get all registered service names
    getServiceNames: () => {
      return [...services.keys(), ...factories.keys(), ...singletons.keys()];
    },
  };
};

describe('DI Container Tests', () => {
  let container;

  beforeEach(() => {
    container = createContainer();
  });

  // ═══════════════════════════════════════════════════════════════════
  // REGISTER
  // ═══════════════════════════════════════════════════════════════════

  describe('register', () => {
    it('should register a service', () => {
      class TestService {}
      container.register('test', TestService);

      expect(container.has('test')).toBe(true);
    });

    it('should resolve registered service', () => {
      class TestService {
        getValue() {
          return 'test';
        }
      }
      container.register('test', TestService);

      const instance = container.resolve('test');
      expect(instance.getValue()).toBe('test');
    });

    it('should inject dependencies', () => {
      class Logger {
        log(msg) {
          return msg;
        }
      }

      class UserService {
        constructor(logger) {
          this.logger = logger;
        }
      }

      container.register('logger', Logger);
      container.register('userService', UserService, { dependencies: ['logger'] });

      const userService = container.resolve('userService');
      expect(userService.logger).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // SINGLETON
  // ═══════════════════════════════════════════════════════════════════

  describe('Singleton', () => {
    it('should return same instance for singleton', () => {
      class SingletonService {
        constructor() {
          this.id = Math.random();
        }
      }
      container.register('singleton', SingletonService, { singleton: true });

      const instance1 = container.resolve('singleton');
      const instance2 = container.resolve('singleton');

      expect(instance1).toBe(instance2);
      expect(instance1.id).toBe(instance2.id);
    });

    it('should return different instances for non-singleton', () => {
      class TransientService {
        constructor() {
          this.id = Math.random();
        }
      }
      container.register('transient', TransientService, { singleton: false });

      const instance1 = container.resolve('transient');
      const instance2 = container.resolve('transient');

      expect(instance1).not.toBe(instance2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // FACTORY
  // ═══════════════════════════════════════════════════════════════════

  describe('factory', () => {
    it('should register factory function', () => {
      container.factory('config', () => ({ port: 3000 }));

      const config = container.resolve('config');
      expect(config.port).toBe(3000);
    });

    it('should pass container to factory', () => {
      container.value('port', 8080);
      container.factory('server', (c) => ({
        port: c.resolve('port'),
      }));

      const server = container.resolve('server');
      expect(server.port).toBe(8080);
    });

    it('should support singleton factory', () => {
      let callCount = 0;
      container.factory('counter', () => ({ count: ++callCount }), { singleton: true });

      container.resolve('counter');
      container.resolve('counter');

      expect(callCount).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // VALUE
  // ═══════════════════════════════════════════════════════════════════

  describe('value', () => {
    it('should register value', () => {
      container.value('apiKey', 'secret123');

      expect(container.resolve('apiKey')).toBe('secret123');
    });

    it('should register object value', () => {
      const config = { port: 3000, host: 'localhost' };
      container.value('config', config);

      expect(container.resolve('config')).toBe(config);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // ALIAS
  // ═══════════════════════════════════════════════════════════════════

  describe('alias', () => {
    it('should resolve alias', () => {
      class DatabaseService {}
      container.register('database', DatabaseService);
      container.alias('db', 'database');

      expect(container.resolve('db')).toBeInstanceOf(DatabaseService);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // TAGS
  // ═══════════════════════════════════════════════════════════════════

  describe('Tags', () => {
    it('should tag services', () => {
      class Handler1 {}
      class Handler2 {}

      container.register('handler1', Handler1);
      container.register('handler2', Handler2);
      container.tag('handler1', 'handlers');
      container.tag('handler2', 'handlers');

      const handlers = container.getTagged('handlers');
      expect(handlers.length).toBe(2);
    });

    it('should return empty array for unknown tag', () => {
      expect(container.getTagged('unknown')).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // HAS
  // ═══════════════════════════════════════════════════════════════════

  describe('has', () => {
    it('should check registered service', () => {
      class Test {}
      container.register('test', Test);

      expect(container.has('test')).toBe(true);
      expect(container.has('unknown')).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // REMOVE
  // ═══════════════════════════════════════════════════════════════════

  describe('remove', () => {
    it('should remove service', () => {
      class Test {}
      container.register('test', Test);
      container.remove('test');

      expect(container.has('test')).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // CLEAR
  // ═══════════════════════════════════════════════════════════════════

  describe('clear', () => {
    it('should clear all services', () => {
      class Test {}
      container.register('test', Test);
      container.value('config', {});

      container.clear();

      expect(container.getServiceNames().length).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // ERROR HANDLING
  // ═══════════════════════════════════════════════════════════════════

  describe('Error Handling', () => {
    it('should throw for unknown service', () => {
      expect(() => container.resolve('unknown')).toThrow('Service not found');
    });
  });
});
