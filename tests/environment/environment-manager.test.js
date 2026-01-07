/**
 * Environment Manager Tests
 * Tests for environment detection and configuration
 * 
 * @module tests/environment/environment-manager.test.js
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Environment manager implementation
const createEnvironmentManager = () => {
    let currentEnv = 'development';
    const envConfigs = new Map();
    const envChecks = new Map();

    // Default environment checks
    envChecks.set('development', () => currentEnv === 'development');
    envChecks.set('production', () => currentEnv === 'production');
    envChecks.set('staging', () => currentEnv === 'staging');
    envChecks.set('test', () => currentEnv === 'test');

    return {
        getEnvironment: () => currentEnv,

        setEnvironment: (env) => {
            if (!['development', 'production', 'staging', 'test'].includes(env)) {
                throw new Error(`Invalid environment: ${env}`);
            }
            currentEnv = env;
        },

        isDevelopment: () => currentEnv === 'development',
        isProduction: () => currentEnv === 'production',
        isStaging: () => currentEnv === 'staging',
        isTest: () => currentEnv === 'test',

        is: (env) => currentEnv === env,

        registerConfig: (env, config) => {
            envConfigs.set(env, config);
        },

        getConfig: (key, defaultValue) => {
            const config = envConfigs.get(currentEnv) || {};
            return config[key] !== undefined ? config[key] : defaultValue;
        },

        getAllConfigs: () => {
            return envConfigs.get(currentEnv) || {};
        },

        detectEnvironment: () => {
            // Simulate environment detection
            const nodeEnv = process.env.NODE_ENV;
            if (nodeEnv) {
                if (['development', 'production', 'staging', 'test'].includes(nodeEnv)) {
                    currentEnv = nodeEnv;
                }
            }
            return currentEnv;
        },

        requireProduction: (feature) => {
            if (!currentEnv.includes('production')) {
                throw new Error(`${feature} requires production environment`);
            }
        },

        requireNonProduction: (feature) => {
            if (currentEnv === 'production') {
                throw new Error(`${feature} is not available in production`);
            }
        },

        getFeatureFlags: () => {
            const flags = {
                development: { debug: true, hotReload: true, mockData: true },
                production: { debug: false, hotReload: false, mockData: false },
                staging: { debug: true, hotReload: false, mockData: false },
                test: { debug: true, hotReload: false, mockData: true },
            };
            return flags[currentEnv] || {};
        },

        getLogLevel: () => {
            const levels = {
                development: 'debug',
                production: 'warn',
                staging: 'info',
                test: 'error',
            };
            return levels[currentEnv] || 'info';
        },

        getBaseUrl: () => {
            const urls = {
                development: 'http://localhost:3000',
                production: 'https://api.example.com',
                staging: 'https://staging-api.example.com',
                test: 'http://localhost:3001',
            };
            return urls[currentEnv] || 'http://localhost:3000';
        },
    };
};

describe('Environment Manager Tests', () => {
    let envManager;

    beforeEach(() => {
        envManager = createEnvironmentManager();
    });

    // ═══════════════════════════════════════════════════════════════════
    // GET/SET ENVIRONMENT
    // ═══════════════════════════════════════════════════════════════════

    describe('Get/Set Environment', () => {
        it('should default to development', () => {
            expect(envManager.getEnvironment()).toBe('development');
        });

        it('should set environment', () => {
            envManager.setEnvironment('production');
            expect(envManager.getEnvironment()).toBe('production');
        });

        it('should throw for invalid environment', () => {
            expect(() => envManager.setEnvironment('invalid')).toThrow('Invalid environment');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // ENVIRONMENT CHECKS
    // ═══════════════════════════════════════════════════════════════════

    describe('Environment Checks', () => {
        it('should check isDevelopment', () => {
            expect(envManager.isDevelopment()).toBe(true);
            envManager.setEnvironment('production');
            expect(envManager.isDevelopment()).toBe(false);
        });

        it('should check isProduction', () => {
            expect(envManager.isProduction()).toBe(false);
            envManager.setEnvironment('production');
            expect(envManager.isProduction()).toBe(true);
        });

        it('should check isStaging', () => {
            envManager.setEnvironment('staging');
            expect(envManager.isStaging()).toBe(true);
        });

        it('should check isTest', () => {
            envManager.setEnvironment('test');
            expect(envManager.isTest()).toBe(true);
        });

        it('should check is()', () => {
            expect(envManager.is('development')).toBe(true);
            expect(envManager.is('production')).toBe(false);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // ENVIRONMENT CONFIG
    // ═══════════════════════════════════════════════════════════════════

    describe('Environment Config', () => {
        it('should register and get config', () => {
            envManager.registerConfig('development', { apiKey: 'dev-key' });
            expect(envManager.getConfig('apiKey')).toBe('dev-key');
        });

        it('should return default for missing config', () => {
            expect(envManager.getConfig('missing', 'default')).toBe('default');
        });

        it('should get all configs', () => {
            envManager.registerConfig('development', { a: 1, b: 2 });
            const configs = envManager.getAllConfigs();

            expect(configs.a).toBe(1);
            expect(configs.b).toBe(2);
        });

        it('should use config for current environment', () => {
            envManager.registerConfig('development', { key: 'dev' });
            envManager.registerConfig('production', { key: 'prod' });

            expect(envManager.getConfig('key')).toBe('dev');

            envManager.setEnvironment('production');
            expect(envManager.getConfig('key')).toBe('prod');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // REQUIRE ENVIRONMENT
    // ═══════════════════════════════════════════════════════════════════

    describe('Require Environment', () => {
        it('should require production', () => {
            envManager.setEnvironment('production');
            expect(() => envManager.requireProduction('Feature')).not.toThrow();
        });

        it('should throw when requiring production in dev', () => {
            expect(() => envManager.requireProduction('Feature')).toThrow('requires production');
        });

        it('should require non-production', () => {
            expect(() => envManager.requireNonProduction('Debug')).not.toThrow();
        });

        it('should throw when requiring non-production in prod', () => {
            envManager.setEnvironment('production');
            expect(() => envManager.requireNonProduction('Debug')).toThrow('not available in production');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // FEATURE FLAGS
    // ═══════════════════════════════════════════════════════════════════

    describe('Feature Flags', () => {
        it('should get feature flags for development', () => {
            const flags = envManager.getFeatureFlags();

            expect(flags.debug).toBe(true);
            expect(flags.hotReload).toBe(true);
        });

        it('should get feature flags for production', () => {
            envManager.setEnvironment('production');
            const flags = envManager.getFeatureFlags();

            expect(flags.debug).toBe(false);
            expect(flags.hotReload).toBe(false);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // LOG LEVEL
    // ═══════════════════════════════════════════════════════════════════

    describe('Log Level', () => {
        it('should return debug for development', () => {
            expect(envManager.getLogLevel()).toBe('debug');
        });

        it('should return warn for production', () => {
            envManager.setEnvironment('production');
            expect(envManager.getLogLevel()).toBe('warn');
        });

        it('should return info for staging', () => {
            envManager.setEnvironment('staging');
            expect(envManager.getLogLevel()).toBe('info');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // BASE URL
    // ═══════════════════════════════════════════════════════════════════

    describe('Base URL', () => {
        it('should return localhost for development', () => {
            expect(envManager.getBaseUrl()).toBe('http://localhost:3000');
        });

        it('should return production URL for production', () => {
            envManager.setEnvironment('production');
            expect(envManager.getBaseUrl()).toBe('https://api.example.com');
        });

        it('should return staging URL for staging', () => {
            envManager.setEnvironment('staging');
            expect(envManager.getBaseUrl()).toBe('https://staging-api.example.com');
        });
    });
});
