/**
 * Logger Tests
 * Enterprise SaaS Architecture - TypeScript Backend
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import logger from '../../../../src/utils/Logger.js';

describe('Logger', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should have all required methods', () => {
        expect(typeof logger.info).toBe('function');
        expect(typeof logger.warn).toBe('function');
        expect(typeof logger.error).toBe('function');
        expect(typeof logger.debug).toBe('function');
        expect(typeof logger.requestLogger).toBe('function');
    });

    it('should log info messages', () => {
        expect(() => logger.info('Test message')).not.toThrow();
        expect(() => logger.info('Test message', { key: 'value' })).not.toThrow();
    });

    it('should log warn messages', () => {
        expect(() => logger.warn('Warning message')).not.toThrow();
        expect(() => logger.warn('Warning message', { key: 'value' })).not.toThrow();
    });

    it('should log error messages', () => {
        expect(() => logger.error('Error message')).not.toThrow();
        expect(() => logger.error('Error message', new Error('Test error'))).not.toThrow();
        expect(() => logger.error('Error message', null, { key: 'value' })).not.toThrow();
    });

    it('should log debug messages', () => {
        expect(() => logger.debug('Debug message')).not.toThrow();
        expect(() => logger.debug('Debug message', { key: 'value' })).not.toThrow();
    });
});
