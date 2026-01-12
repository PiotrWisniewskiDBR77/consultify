/**
 * ErrorLogger Tests
 * 
 * Tests for error logging service.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logError, logWarning, logInfo } from '../../../services/errorLogger';

// Mock console methods
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

describe('ErrorLogger', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('logError', () => {
        it('should log error messages', () => {
            logError('Test error message');

            expect(consoleErrorSpy).toHaveBeenCalled();
        });

        it('should log error objects', () => {
            const error = new Error('Test error');
            logError(error);

            expect(consoleErrorSpy).toHaveBeenCalled();
        });

        it('should include context when provided', () => {
            logError('Error message', { userId: 'user-1', action: 'test' });

            expect(consoleErrorSpy).toHaveBeenCalled();
        });
    });

    describe('logWarning', () => {
        it('should log warning messages', () => {
            logWarning('Test warning');

            expect(consoleWarnSpy).toHaveBeenCalled();
        });

        it('should include context when provided', () => {
            logWarning('Warning message', { component: 'TestComponent' });

            expect(consoleWarnSpy).toHaveBeenCalled();
        });
    });

    describe('logInfo', () => {
        it('should log info messages', () => {
            logInfo('Test info');

            expect(consoleInfoSpy).toHaveBeenCalled();
        });

        it('should include context when provided', () => {
            logInfo('Info message', { event: 'test_event' });

            expect(consoleInfoSpy).toHaveBeenCalled();
        });
    });
});










