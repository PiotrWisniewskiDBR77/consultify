/**
 * FeatureFlags Unit Tests
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Unit tests for FeatureFlags - 95%+ coverage target
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { loadFeatureFlags } from '../../../../src/config/FeatureFlags.js';

describe('FeatureFlags', () => {
    beforeEach(() => {
        delete process.env.ENABLE_ACTION_EXECUTION;
        delete process.env.ENABLE_ACTION_DECISIONS;
        delete process.env.ENABLE_METRICS_DASHBOARD;
        delete process.env.ENABLE_AI_COACH;
        delete process.env.ENABLE_HELP_SYSTEM;
    });

    describe('loadFeatureFlags', () => {
        it('should load feature flags with defaults', () => {
            const flags = loadFeatureFlags();

            expect(flags).toHaveProperty('ENABLE_ACTION_EXECUTION');
            expect(flags).toHaveProperty('ENABLE_ACTION_DECISIONS');
            expect(flags).toHaveProperty('ENABLE_METRICS_DASHBOARD');
            expect(flags).toHaveProperty('ENABLE_AI_COACH');
            expect(flags).toHaveProperty('ENABLE_HELP_SYSTEM');
        });

        it('should respect environment variable overrides', () => {
            process.env.ENABLE_ACTION_EXECUTION = 'true';
            process.env.ENABLE_ACTION_DECISIONS = 'false';

            const flags = loadFeatureFlags();

            expect(flags.ENABLE_ACTION_EXECUTION).toBe(true);
            expect(flags.ENABLE_ACTION_DECISIONS).toBe(false);
        });

        it('should use default true for flags not explicitly set to false', () => {
            const flags = loadFeatureFlags();

            expect(flags.ENABLE_ACTION_DECISIONS).toBe(true);
            expect(flags.ENABLE_METRICS_DASHBOARD).toBe(true);
        });
    });
});

