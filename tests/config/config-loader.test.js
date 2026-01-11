/**
 * Configuration Loader Tests
 * Tests for configuration loading and management
 *
 * @module tests/config/config-loader.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Configuration loader implementation
const createConfigLoader = (options = {}) => {
  const { sources = [], validators = {}, defaults = {} } = options;
  let config = { ...defaults };
  let frozen = false;

  return {
    load: async () => {
      const merged = { ...defaults };

      for (const source of sources) {
        try {
          const data = await source.load();
          Object.assign(merged, data);
        } catch (error) {
          if (source.required) {
            throw new Error(`Failed to load required config source: ${error.message}`);
          }
        }
      }

      // Validate
      for (const [key, validator] of Object.entries(validators)) {
        if (merged[key] !== undefined) {
          const result = validator(merged[key]);
          if (result !== true) {
            throw new Error(`Validation failed for ${key}: ${result}`);
          }
        }
      }

      config = merged;
      return config;
    },

    get: (path, defaultValue) => {
      const parts = path.split('.');
      let current = config;

      for (const part of parts) {
        if (current === null || current === undefined) {
          return defaultValue;
        }
        current = current[part];
      }

      return current !== undefined ? current : defaultValue;
    },

    set: (path, value) => {
      if (frozen) {
        throw new Error('Config is frozen');
      }

      const parts = path.split('.');
      let current = config;

      for (let i = 0; i < parts.length - 1; i++) {
        if (current[parts[i]] === undefined) {
          current[parts[i]] = {};
        }
        current = current[parts[i]];
      }

      current[parts[parts.length - 1]] = value;
    },

    has: (path) => {
      return this.get(path) !== undefined;
    },

    getAll: () => JSON.parse(JSON.stringify(config)),

    freeze: () => {
      frozen = true;
    },

    isFrozen: () => frozen,

    merge: (newConfig) => {
      if (frozen) {
        throw new Error('Config is frozen');
      }
      Object.assign(config, newConfig);
    },

    reset: () => {
      if (frozen) {
        throw new Error('Config is frozen');
      }
      config = { ...defaults };
      frozen = false;
    },
  };
};

// Environment variable source
const createEnvSource = (prefix = '', mapping = {}) => ({
  load: async () => {
    const result = {};

    for (const [envKey, configKey] of Object.entries(mapping)) {
      const fullKey = prefix ? `${prefix}_${envKey}` : envKey;
      const value = process.env[fullKey];

      if (value !== undefined) {
        // Auto-parse booleans and numbers
        if (value === 'true') result[configKey] = true;
        else if (value === 'false') result[configKey] = false;
        else if (!isNaN(Number(value))) result[configKey] = Number(value);
        else result[configKey] = value;
      }
    }

    return result;
  },
});

describe('Configuration Loader Tests', () => {
  let loader;

  beforeEach(() => {
    loader = createConfigLoader({
      defaults: {
        app: { name: 'TestApp', version: '1.0.0' },
        server: { port: 3000, host: 'localhost' },
      },
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // GET
  // ═══════════════════════════════════════════════════════════════════

  describe('get', () => {
    it('should get simple value', async () => {
      await loader.load();
      expect(loader.get('server.port')).toBe(3000);
    });

    it('should get nested value', async () => {
      await loader.load();
      expect(loader.get('app.name')).toBe('TestApp');
    });

    it('should return default for missing', async () => {
      await loader.load();
      expect(loader.get('missing.key', 'default')).toBe('default');
    });

    it('should return undefined for missing without default', async () => {
      await loader.load();
      expect(loader.get('missing.key')).toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // SET
  // ═══════════════════════════════════════════════════════════════════

  describe('set', () => {
    it('should set value', async () => {
      await loader.load();
      loader.set('server.port', 8080);
      expect(loader.get('server.port')).toBe(8080);
    });

    it('should create nested path', async () => {
      await loader.load();
      loader.set('new.nested.value', 'test');
      expect(loader.get('new.nested.value')).toBe('test');
    });

    it('should throw when frozen', async () => {
      await loader.load();
      loader.freeze();
      expect(() => loader.set('server.port', 8080)).toThrow('frozen');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // LOAD
  // ═══════════════════════════════════════════════════════════════════

  describe('load', () => {
    it('should load from sources', async () => {
      const mockSource = {
        load: vi.fn().mockResolvedValue({ custom: 'value' }),
      };

      const loaderWithSource = createConfigLoader({
        sources: [mockSource],
      });

      await loaderWithSource.load();

      expect(mockSource.load).toHaveBeenCalled();
      expect(loaderWithSource.get('custom')).toBe('value');
    });

    it('should merge sources in order', async () => {
      const source1 = { load: vi.fn().mockResolvedValue({ a: 1, b: 1 }) };
      const source2 = { load: vi.fn().mockResolvedValue({ b: 2, c: 2 }) };

      const loaderWithSources = createConfigLoader({
        sources: [source1, source2],
      });

      await loaderWithSources.load();

      expect(loaderWithSources.get('a')).toBe(1);
      expect(loaderWithSources.get('b')).toBe(2);
      expect(loaderWithSources.get('c')).toBe(2);
    });

    it('should use defaults', async () => {
      await loader.load();
      expect(loader.get('app.name')).toBe('TestApp');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // VALIDATION
  // ═══════════════════════════════════════════════════════════════════

  describe('Validation', () => {
    it('should validate config', async () => {
      const loaderWithValidator = createConfigLoader({
        defaults: { port: 3000 },
        validators: {
          port: (value) => (value > 0 && value < 65536) || 'Invalid port',
        },
      });

      await loaderWithValidator.load();
      expect(loaderWithValidator.get('port')).toBe(3000);
    });

    it('should throw on validation failure', async () => {
      const mockSource = { load: vi.fn().mockResolvedValue({ port: -1 }) };

      const loaderWithValidator = createConfigLoader({
        sources: [mockSource],
        validators: {
          port: (value) => value > 0 || 'Port must be positive',
        },
      });

      await expect(loaderWithValidator.load()).rejects.toThrow('Validation failed');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // FREEZE
  // ═══════════════════════════════════════════════════════════════════

  describe('freeze', () => {
    it('should freeze config', async () => {
      await loader.load();
      loader.freeze();
      expect(loader.isFrozen()).toBe(true);
    });

    it('should prevent modifications after freeze', async () => {
      await loader.load();
      loader.freeze();

      expect(() => loader.set('key', 'value')).toThrow();
      expect(() => loader.merge({ key: 'value' })).toThrow();
      expect(() => loader.reset()).toThrow();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // MERGE
  // ═══════════════════════════════════════════════════════════════════

  describe('merge', () => {
    it('should merge config', async () => {
      await loader.load();
      loader.merge({ server: { port: 8080 }, extra: true });

      expect(loader.get('server.port')).toBe(8080);
      expect(loader.get('extra')).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // RESET
  // ═══════════════════════════════════════════════════════════════════

  describe('reset', () => {
    it('should reset to defaults', async () => {
      await loader.load();
      loader.set('server.port', 8080);
      loader.reset();

      expect(loader.get('server.port')).toBe(3000);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // GET ALL
  // ═══════════════════════════════════════════════════════════════════

  describe('getAll', () => {
    it('should return copy of config', async () => {
      await loader.load();
      const all = loader.getAll();

      all.server.port = 9999;
      expect(loader.get('server.port')).toBe(3000);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // ERROR HANDLING
  // ═══════════════════════════════════════════════════════════════════

  describe('Error Handling', () => {
    it('should throw for required source failure', async () => {
      const failingSource = {
        load: vi.fn().mockRejectedValue(new Error('Load failed')),
        required: true,
      };

      const loaderWithRequired = createConfigLoader({
        sources: [failingSource],
      });

      await expect(loaderWithRequired.load()).rejects.toThrow('required config source');
    });

    it('should ignore optional source failure', async () => {
      const failingSource = {
        load: vi.fn().mockRejectedValue(new Error('Load failed')),
        required: false,
      };

      const loaderWithOptional = createConfigLoader({
        sources: [failingSource],
        defaults: { fallback: true },
      });

      await loaderWithOptional.load();
      expect(loaderWithOptional.get('fallback')).toBe(true);
    });
  });
});
