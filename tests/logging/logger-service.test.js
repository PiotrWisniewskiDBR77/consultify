/**
 * Logger Service Tests
 * Tests for logging service with levels and transports
 * 
 * @module tests/logging/logger-service.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Logger implementation
const createLogger = (options = {}) => {
    const { level = 'info', transports = [] } = options;

    const levels = { error: 0, warn: 1, info: 2, debug: 3, trace: 4 };
    const currentLevel = levels[level] ?? 2;
    const logs = [];

    const shouldLog = (msgLevel) => levels[msgLevel] <= currentLevel;

    const formatMessage = (level, message, meta = {}) => ({
        timestamp: new Date().toISOString(),
        level,
        message,
        ...meta,
    });

    const log = (level, message, meta) => {
        if (!shouldLog(level)) return;

        const entry = formatMessage(level, message, meta);
        logs.push(entry);

        transports.forEach(transport => {
            try {
                transport(entry);
            } catch (e) {
                // Silent fail for transports
            }
        });
    };

    return {
        error: (message, meta) => log('error', message, meta),
        warn: (message, meta) => log('warn', message, meta),
        info: (message, meta) => log('info', message, meta),
        debug: (message, meta) => log('debug', message, meta),
        trace: (message, meta) => log('trace', message, meta),

        log: (level, message, meta) => log(level, message, meta),

        child: (defaultMeta) => {
            return createLogger({
                level,
                transports: [
                    (entry) => log(entry.level, entry.message, { ...defaultMeta, ...entry }),
                ],
            });
        },

        getLevel: () => level,
        getLogs: () => [...logs],
        clearLogs: () => { logs.length = 0; },

        setLevel: (newLevel) => {
            if (levels[newLevel] !== undefined) {
                return createLogger({ level: newLevel, transports });
            }
            return null;
        },

        addTransport: (transport) => {
            transports.push(transport);
        },

        time: (label) => {
            const start = Date.now();
            return {
                end: (message) => {
                    const duration = Date.now() - start;
                    log('info', message || label, { duration, label });
                },
            };
        },

        profile: (label, fn) => {
            const timer = { start: Date.now() };
            const result = fn();
            timer.end = Date.now();
            timer.duration = timer.end - timer.start;

            log('info', `${label} completed`, { duration: timer.duration });

            return result;
        },

        group: (label) => {
            const groupLogs = [];
            return {
                log: (level, message, meta) => {
                    groupLogs.push(formatMessage(level, message, { ...meta, group: label }));
                },
                end: () => {
                    groupLogs.forEach(entry => {
                        logs.push(entry);
                        transports.forEach(t => t(entry));
                    });
                },
            };
        },
    };
};

describe('Logger Service Tests', () => {
    let logger;
    let mockTransport;

    beforeEach(() => {
        mockTransport = vi.fn();
        logger = createLogger({ level: 'debug', transports: [mockTransport] });
    });

    // ═══════════════════════════════════════════════════════════════════
    // BASIC LOGGING
    // ═══════════════════════════════════════════════════════════════════

    describe('Basic Logging', () => {
        it('should log error', () => {
            logger.error('Error message');

            expect(mockTransport).toHaveBeenCalledWith(
                expect.objectContaining({
                    level: 'error',
                    message: 'Error message',
                })
            );
        });

        it('should log warn', () => {
            logger.warn('Warning message');

            expect(mockTransport).toHaveBeenCalledWith(
                expect.objectContaining({ level: 'warn' })
            );
        });

        it('should log info', () => {
            logger.info('Info message');

            expect(mockTransport).toHaveBeenCalledWith(
                expect.objectContaining({ level: 'info' })
            );
        });

        it('should log debug', () => {
            logger.debug('Debug message');

            expect(mockTransport).toHaveBeenCalledWith(
                expect.objectContaining({ level: 'debug' })
            );
        });

        it('should include timestamp', () => {
            logger.info('Test');

            expect(mockTransport).toHaveBeenCalledWith(
                expect.objectContaining({ timestamp: expect.any(String) })
            );
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // METADATA
    // ═══════════════════════════════════════════════════════════════════

    describe('Metadata', () => {
        it('should include metadata', () => {
            logger.info('Message', { userId: 123, action: 'login' });

            expect(mockTransport).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: 123,
                    action: 'login',
                })
            );
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // LOG LEVELS
    // ═══════════════════════════════════════════════════════════════════

    describe('Log Levels', () => {
        it('should respect log level', () => {
            const infoLogger = createLogger({ level: 'info', transports: [mockTransport] });

            infoLogger.debug('Debug message');

            expect(mockTransport).not.toHaveBeenCalled();
        });

        it('should log at and above level', () => {
            const warnLogger = createLogger({ level: 'warn', transports: [mockTransport] });

            warnLogger.error('Error');
            warnLogger.warn('Warn');
            warnLogger.info('Info');

            expect(mockTransport).toHaveBeenCalledTimes(2);
        });

        it('should return current level', () => {
            expect(logger.getLevel()).toBe('debug');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // GET/CLEAR LOGS
    // ═══════════════════════════════════════════════════════════════════

    describe('Get/Clear Logs', () => {
        it('should get all logs', () => {
            logger.info('Message 1');
            logger.info('Message 2');

            expect(logger.getLogs().length).toBe(2);
        });

        it('should clear logs', () => {
            logger.info('Message');
            logger.clearLogs();

            expect(logger.getLogs().length).toBe(0);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // CHILD LOGGER
    // ═══════════════════════════════════════════════════════════════════

    describe('Child Logger', () => {
        it('should create child with default meta', () => {
            const child = logger.child({ module: 'auth' });

            child.info('Login');

            const logs = child.getLogs();
            expect(logs.length).toBeGreaterThan(0);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // TIME
    // ═══════════════════════════════════════════════════════════════════

    describe('Time', () => {
        it('should time operations', async () => {
            const timer = logger.time('operation');

            await new Promise(r => setTimeout(r, 10));
            timer.end('Operation completed');

            expect(mockTransport).toHaveBeenCalledWith(
                expect.objectContaining({
                    duration: expect.any(Number),
                })
            );
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // PROFILE
    // ═══════════════════════════════════════════════════════════════════

    describe('Profile', () => {
        it('should profile function', () => {
            const result = logger.profile('computation', () => {
                let sum = 0;
                for (let i = 0; i < 1000; i++) sum += i;
                return sum;
            });

            expect(result).toBe(499500);
            expect(mockTransport).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'computation completed',
                    duration: expect.any(Number),
                })
            );
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // GROUP
    // ═══════════════════════════════════════════════════════════════════

    describe('Group', () => {
        it('should group logs', () => {
            const group = logger.group('batch');

            group.log('info', 'Step 1');
            group.log('info', 'Step 2');
            group.end();

            expect(mockTransport).toHaveBeenCalledWith(
                expect.objectContaining({ group: 'batch' })
            );
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // TRANSPORT
    // ═══════════════════════════════════════════════════════════════════

    describe('Transport', () => {
        it('should call all transports', () => {
            const transport1 = vi.fn();
            const transport2 = vi.fn();

            const multiLogger = createLogger({
                level: 'info',
                transports: [transport1, transport2]
            });

            multiLogger.info('Test');

            expect(transport1).toHaveBeenCalled();
            expect(transport2).toHaveBeenCalled();
        });

        it('should continue on transport error', () => {
            const failingTransport = vi.fn().mockImplementation(() => {
                throw new Error('Transport failed');
            });
            const successTransport = vi.fn();

            const loggerWithFailing = createLogger({
                level: 'info',
                transports: [failingTransport, successTransport],
            });

            loggerWithFailing.info('Test');

            expect(successTransport).toHaveBeenCalled();
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // SET LEVEL
    // ═══════════════════════════════════════════════════════════════════

    describe('Set Level', () => {
        it('should create new logger with different level', () => {
            const newLogger = logger.setLevel('error');

            expect(newLogger.getLevel()).toBe('error');
        });

        it('should return null for invalid level', () => {
            expect(logger.setLevel('invalid')).toBeNull();
        });
    });
});
