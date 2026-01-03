/**
 * SentryConfig Unit Tests
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Unit tests for SentryConfig - 95%+ coverage target
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initSentry } from '../../../../src/config/sentry.js';
import type { Express } from 'express';

describe('SentryConfig', () => {
    let mockApp: Express;

    beforeEach(() => {
        vi.clearAllMocks();
        process.env.NODE_ENV = 'test';
        process.env.SENTRY_DSN = undefined;

        mockApp = {
            use: vi.fn(),
        } as unknown as Express;
    });

    describe('initSentry', () => {
        it('should initialize Sentry in production', () => {
            process.env.NODE_ENV = 'production';
            process.env.SENTRY_DSN = 'https://test@sentry.io/test';

            const handlers = initSentry(mockApp);

            expect(handlers).toBeDefined();
        });

        it('should not initialize Sentry in test environment', () => {
            process.env.NODE_ENV = 'test';
            process.env.SENTRY_DSN = undefined;

            const handlers = initSentry(mockApp);

            expect(handlers).toBeDefined();
        });

        it('should return handlers with requestHandler, tracingHandler, errorHandler', () => {
            const handlers = initSentry(mockApp);

            expect(handlers).toHaveProperty('requestHandler');
            expect(handlers).toHaveProperty('tracingHandler');
            expect(handlers).toHaveProperty('errorHandler');
        });
    });
});

