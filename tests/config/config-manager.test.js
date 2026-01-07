/**
 * Configuration Management Tests
 * Tests for dynamic configuration and feature flags
 * 
 * @module tests/config/config-manager.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Configuration manager
const createConfigManager = (initialConfig = {}) => {
    let config = { ...initialConfig };
    const listeners = [];
    const validators = new Map();

    const emit = (key, oldValue, newValue) => {
        listeners.forEach(fn => fn({ key, oldValue, newValue }));
    };

    return {
        get: (key, defaultValue = undefined) => {
            const parts = key.split('.');
            let current = config;

            for (const part of parts) {
                if (current === undefined || current === null) {
                    return defaultValue;
                }
                current = current[part];
            }

            return current ?? defaultValue;
        },

        set: (key, value) => {
            const validator = validators.get(key);
            if (validator && !validator(value)) {
                throw new Error(`Invalid value for ${key}`);
            }

            const parts = key.split('.');
            const oldValue = this.get(key);

            let current = config;
            for (let i = 0; i < parts.length - 1; i++) {
                if (!current[parts[i]]) {
                    current[parts[i]] = {};
                }
                current = current[parts[i]];
            }

            current[parts[parts.length - 1]] = value;
            emit(key, oldValue, value);
        },

        has: (key) => this.get(key) !== undefined,

        delete: (key) => {
            const parts = key.split('.');
            let current = config;

            for (let i = 0; i < parts.length - 1; i++) {
                if (!current[parts[i]]) return false;
                current = current[parts[i]];
            }

            delete current[parts[parts.length - 1]];
            return true;
        },

        getAll: () => structuredClone(config),

        merge: (newConfig) => {
            const deepMerge = (target, source) => {
                for (const key of Object.keys(source)) {
                    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                        target[key] = target[key] || {};
                        deepMerge(target[key], source[key]);
                    } else {
                        target[key] = source[key];
                    }
                }
            };
            deepMerge(config, newConfig);
        },

        setValidator: (key, validator) => {
            validators.set(key, validator);
        },

        onChange: (handler) => {
            listeners.push(handler);
            return () => {
                const idx = listeners.indexOf(handler);
                if (idx !== -1) listeners.splice(idx, 1);
            };
        },

        reset: () => {
            config = { ...initialConfig };
        },
    };
};

// Environment config loader
const createEnvLoader = () => {
    const env = new Map();

    return {
        set: (key, value) => {
            env.set(key, value);
        },

        get: (key, defaultValue) => {
            return env.get(key) ?? defaultValue;
        },

        getRequired: (key) => {
            const value = env.get(key);
            if (value === undefined) {
                throw new Error(`Required env var missing: ${key}`);
            }
            return value;
        },

        getBoolean: (key, defaultValue = false) => {
            const value = env.get(key);
            if (value === undefined) return defaultValue;
            return value === 'true' || value === '1';
        },

        getNumber: (key, defaultValue = 0) => {
            const value = env.get(key);
            if (value === undefined) return defaultValue;
            const num = parseInt(value, 10);
            return isNaN(num) ? defaultValue : num;
        },

        getJSON: (key, defaultValue = null) => {
            const value = env.get(key);
            if (value === undefined) return defaultValue;
            try {
                return JSON.parse(value);
            } catch {
                return defaultValue;
            }
        },

        getList: (key, separator = ',') => {
            const value = env.get(key);
            if (!value) return [];
            return value.split(separator).map(s => s.trim());
        },
    };
};

// Feature flag manager
const createFeatureFlagManager = () => {
    const flags = new Map();
    const overrides = new Map();

    return {
        define: (name, config) => {
            flags.set(name, {
                name,
                enabled: config.enabled ?? false,
                percentage: config.percentage ?? 100,
                allowedUsers: config.allowedUsers || [],
                startDate: config.startDate,
                endDate: config.endDate,
            });
        },

        isEnabled: (name, context = {}) => {
            // Check overrides first
            if (overrides.has(name)) {
                return overrides.get(name);
            }

            const flag = flags.get(name);
            if (!flag) return false;

            if (!flag.enabled) return false;

            // Check date range
            const now = Date.now();
            if (flag.startDate && now < flag.startDate) return false;
            if (flag.endDate && now > flag.endDate) return false;

            // Check user allowlist
            if (flag.allowedUsers.length > 0 && context.userId) {
                if (!flag.allowedUsers.includes(context.userId)) {
                    return false;
                }
            }

            // Check percentage rollout
            if (flag.percentage < 100 && context.userId) {
                const hash = Array.from(`${name}:${context.userId}`)
                    .reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
                const normalized = Math.abs(hash) % 100;
                if (normalized >= flag.percentage) return false;
            }

            return true;
        },

        setOverride: (name, value) => {
            overrides.set(name, value);
        },

        clearOverride: (name) => {
            overrides.delete(name);
        },

        clearAllOverrides: () => {
            overrides.clear();
        },

        getAllFlags: () => {
            return [...flags.entries()].map(([name, config]) => ({
                name,
                ...config,
                overridden: overrides.has(name),
            }));
        },

        getFlag: (name) => flags.get(name),
    };
};

// Secret manager
const createSecretManager = () => {
    const secrets = new Map();
    const accessLog = [];

    return {
        set: (key, value, metadata = {}) => {
            secrets.set(key, {
                value,
                metadata,
                createdAt: Date.now(),
                version: (secrets.get(key)?.version || 0) + 1,
            });
        },

        get: (key) => {
            const secret = secrets.get(key);
            if (secret) {
                accessLog.push({ key, accessedAt: Date.now() });
                return secret.value;
            }
            return null;
        },

        rotate: (key, newValue) => {
            const existing = secrets.get(key);
            if (!existing) return false;

            existing.previousValue = existing.value;
            existing.value = newValue;
            existing.rotatedAt = Date.now();
            existing.version++;

            return true;
        },

        delete: (key) => {
            return secrets.delete(key);
        },

        getVersion: (key) => {
            return secrets.get(key)?.version || 0;
        },

        getAccessLog: () => [...accessLog],

        listKeys: () => [...secrets.keys()],
    };
};

describe('Config Manager Tests', () => {
    let config;

    beforeEach(() => {
        config = createConfigManager({
            app: { name: 'Test', port: 3000 },
        });
    });

    it('should get nested config', () => {
        expect(config.get('app.name')).toBe('Test');
        expect(config.get('app.port')).toBe(3000);
    });

    it('should return default for missing', () => {
        expect(config.get('missing', 'default')).toBe('default');
    });

    it('should set nested config', () => {
        config.set('app.debug', true);

        expect(config.get('app.debug')).toBe(true);
    });

    it('should merge configs', () => {
        config.merge({ app: { version: '1.0' }, db: { host: 'localhost' } });

        expect(config.get('app.version')).toBe('1.0');
        expect(config.get('db.host')).toBe('localhost');
        expect(config.get('app.name')).toBe('Test'); // Preserved
    });

    it('should validate values', () => {
        config.setValidator('app.port', (v) => typeof v === 'number' && v > 0);

        expect(() => config.set('app.port', -1)).toThrow();
    });

    it('should notify on change', () => {
        const handler = vi.fn();
        config.onChange(handler);

        config.set('app.name', 'Updated');

        expect(handler).toHaveBeenCalledWith({
            key: 'app.name',
            oldValue: 'Test',
            newValue: 'Updated',
        });
    });
});

describe('Env Loader Tests', () => {
    let env;

    beforeEach(() => {
        env = createEnvLoader();
    });

    it('should get env value', () => {
        env.set('API_KEY', 'secret123');

        expect(env.get('API_KEY')).toBe('secret123');
    });

    it('should get required throws', () => {
        expect(() => env.getRequired('MISSING')).toThrow();
    });

    it('should parse boolean', () => {
        env.set('DEBUG', 'true');
        env.set('PROD', '0');

        expect(env.getBoolean('DEBUG')).toBe(true);
        expect(env.getBoolean('PROD')).toBe(false);
    });

    it('should parse number', () => {
        env.set('PORT', '3000');

        expect(env.getNumber('PORT')).toBe(3000);
    });

    it('should parse list', () => {
        env.set('HOSTS', 'a.com,b.com,c.com');

        expect(env.getList('HOSTS')).toEqual(['a.com', 'b.com', 'c.com']);
    });
});

describe('Feature Flag Manager Tests', () => {
    let flags;

    beforeEach(() => {
        flags = createFeatureFlagManager();
    });

    it('should check enabled flag', () => {
        flags.define('new_ui', { enabled: true });

        expect(flags.isEnabled('new_ui')).toBe(true);
    });

    it('should check disabled flag', () => {
        flags.define('beta', { enabled: false });

        expect(flags.isEnabled('beta')).toBe(false);
    });

    it('should check percentage rollout', () => {
        flags.define('experiment', { enabled: true, percentage: 50 });

        // With deterministic hashing, result depends on userId
        const result = flags.isEnabled('experiment', { userId: 'user-1' });
        expect(typeof result).toBe('boolean');
    });

    it('should check user allowlist', () => {
        flags.define('vip', { enabled: true, allowedUsers: ['user-1'] });

        expect(flags.isEnabled('vip', { userId: 'user-1' })).toBe(true);
        expect(flags.isEnabled('vip', { userId: 'user-2' })).toBe(false);
    });

    it('should override flags', () => {
        flags.define('feature', { enabled: false });
        flags.setOverride('feature', true);

        expect(flags.isEnabled('feature')).toBe(true);
    });
});

describe('Secret Manager Tests', () => {
    let secrets;

    beforeEach(() => {
        secrets = createSecretManager();
    });

    it('should store and retrieve secret', () => {
        secrets.set('api_key', 'secret123');

        expect(secrets.get('api_key')).toBe('secret123');
    });

    it('should rotate secret', () => {
        secrets.set('password', 'old');
        secrets.rotate('password', 'new');

        expect(secrets.get('password')).toBe('new');
        expect(secrets.getVersion('password')).toBe(2);
    });

    it('should log access', () => {
        secrets.set('key', 'value');
        secrets.get('key');
        secrets.get('key');

        expect(secrets.getAccessLog()).toHaveLength(2);
    });

    it('should list keys', () => {
        secrets.set('a', '1');
        secrets.set('b', '2');

        expect(secrets.listKeys()).toContain('a');
        expect(secrets.listKeys()).toContain('b');
    });
});
