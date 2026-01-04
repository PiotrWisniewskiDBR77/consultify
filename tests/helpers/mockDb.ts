/**
 * Central MockDB Helper
 * 
 * Provides consistent mock database and logger instances using vi.hoisted()
 * for proper hoisting in Vitest test environment.
 * 
 * Usage:
 * ```typescript
 * import { createMockDb, createMockLogger } from './helpers/mockDb.js';
 * 
 * const mockDb = createMockDb();
 * const mockLogger = createMockLogger();
 * ```
 */

import { vi } from 'vitest';

/**
 * Mock Database interface matching SQLite3 and Postgres-compatible APIs
 */
export interface MockDb {
    // Callback-style (SQLite3)
    get: ReturnType<typeof vi.fn>;
    all: ReturnType<typeof vi.fn>;
    run: ReturnType<typeof vi.fn>;
    exec: ReturnType<typeof vi.fn>;
    prepare: ReturnType<typeof vi.fn>;
    serialize: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    
    // Promise-style (Postgres-compatible)
    query: ReturnType<typeof vi.fn>;
    
    // Async wrappers
    runAsync: ReturnType<typeof vi.fn>;
    getAsync: ReturnType<typeof vi.fn>;
    allAsync: ReturnType<typeof vi.fn>;
    execAsync: ReturnType<typeof vi.fn>;
    
    // Common properties
    initPromise: Promise<void>;
}

/**
 * Mock Logger interface matching Winston logger
 */
export interface MockLogger {
    error: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    debug: ReturnType<typeof vi.fn>;
    verbose: ReturnType<typeof vi.fn>;
    silly: ReturnType<typeof vi.fn>;
}

/**
 * Create a mock database instance
 * Supports both callback-style (SQLite3) and Promise-style (Postgres-compatible) APIs
 *
 * @param options - Configuration options for the mock
 * @returns Mock database instance
 */
export function createMockDb(options: {
    defaultGetResult?: any;
    defaultAllResult?: any[];
    defaultRunResult?: { lastID?: number; changes?: number };
    enableLogging?: boolean;
} = {}): MockDb {
    const {
        defaultGetResult = null,
        defaultAllResult = [],
        defaultRunResult = { lastID: 1, changes: 1 },
        enableLogging = false
    } = options;

    // Create mock database object
        const db: Partial<MockDb> = {
            // Callback-style (SQLite3)
            get: vi.fn(),
            all: vi.fn(),
            run: vi.fn(),
            exec: vi.fn(),
            prepare: vi.fn(),
            serialize: vi.fn(),
            close: vi.fn(),
            on: vi.fn().mockReturnThis(),
            
            // Promise-style (Postgres-compatible)
            query: vi.fn(),
            
            // Async wrappers
            runAsync: vi.fn(),
            getAsync: vi.fn(),
            allAsync: vi.fn(),
            execAsync: vi.fn(),
            
            // Common properties
            initPromise: Promise.resolve()
        };

        // Default implementations - callback-style (SQLite3)
        // Handle both (sql, callback) and (sql, params, callback) signatures
        db.get!.mockImplementation(function (sql: string, params?: any, callback?: any) {
            const cb = typeof params === 'function' ? params : callback;
            if (enableLogging) {
                console.log('[MockDB] get called', { sql: sql.substring(0, 50), hasCallback: !!cb });
            }
            if (typeof cb === 'function') {
                // Use process.nextTick for async callback simulation
                process.nextTick(() => {
                    try {
                        cb(null, defaultGetResult);
                    } catch (e) {
                        if (enableLogging) {
                            console.error('[MockDB] get callback error', e);
                        }
                    }
                });
            }
            return this;
        });

        db.all!.mockImplementation(function (sql: string, params?: any, callback?: any) {
            const cb = typeof params === 'function' ? params : callback;
            if (enableLogging) {
                console.log('[MockDB] all called', { sql: sql.substring(0, 50), hasCallback: !!cb });
            }
            if (typeof cb === 'function') {
                process.nextTick(() => {
                    try {
                        cb(null, defaultAllResult);
                    } catch (e) {
                        if (enableLogging) {
                            console.error('[MockDB] all callback error', e);
                        }
                    }
                });
            }
            return this;
        });

        db.run!.mockImplementation(function (sql: string, params?: any, callback?: any) {
            const cb = typeof params === 'function' ? params : callback;
            if (enableLogging) {
                console.log('[MockDB] run called', { sql: sql.substring(0, 50), hasCallback: !!cb });
            }
            if (typeof cb === 'function') {
                process.nextTick(() => {
                    try {
                        // Call callback with context (this) containing lastID and changes
                        cb.call({ lastID: defaultRunResult.lastID, changes: defaultRunResult.changes }, null);
                    } catch (e) {
                        if (enableLogging) {
                            console.error('[MockDB] run callback error', e);
                        }
                    }
                });
            }
            return this;
        });

        db.exec!.mockImplementation(function (sql: string, callback?: any) {
            if (enableLogging) {
                console.log('[MockDB] exec called', { sql: sql.substring(0, 50), hasCallback: !!callback });
            }
            if (typeof callback === 'function') {
                process.nextTick(() => {
                    try {
                        callback(null);
                    } catch (e) {
                        if (enableLogging) {
                            console.error('[MockDB] exec callback error', e);
                        }
                    }
                });
            }
            return this;
        });

        db.serialize!.mockImplementation(function (callback?: any) {
            if (typeof callback === 'function') {
                process.nextTick(() => {
                    try {
                        callback();
                    } catch (e) {
                        if (enableLogging) {
                            console.error('[MockDB] serialize callback error', e);
                        }
                    }
                });
            }
            return this;
        });

        db.close!.mockImplementation(function (callback?: any) {
            if (typeof callback === 'function') {
                process.nextTick(() => {
                    try {
                        callback(null);
                    } catch (e) {
                        if (enableLogging) {
                            console.error('[MockDB] close callback error', e);
                        }
                    }
                });
            }
        });

        // Default implementations - Promise-style (Postgres-compatible)
        db.query!.mockResolvedValue({ rows: defaultAllResult, rowCount: defaultAllResult.length });
        db.runAsync!.mockResolvedValue({ lastID: defaultRunResult.lastID, changes: defaultRunResult.changes });
        db.getAsync!.mockResolvedValue(defaultGetResult);
        db.allAsync!.mockResolvedValue(defaultAllResult);
        db.execAsync!.mockResolvedValue(undefined);

        // Prepare mock - returns statement object
        db.prepare!.mockReturnValue({
            run: vi.fn().mockImplementation(function (params?: any, callback?: any) {
                const cb = typeof params === 'function' ? params : callback;
                if (typeof cb === 'function') {
                    process.nextTick(() => {
                        try {
                            cb.call({ changes: defaultRunResult.changes, lastID: defaultRunResult.lastID }, null);
                        } catch (e) {
                            if (enableLogging) {
                                console.error('[MockDB] prepare.run callback error', e);
                            }
                        }
                    });
                }
                return this;
            }),
            get: vi.fn().mockImplementation(function (params?: any, callback?: any) {
                const cb = typeof params === 'function' ? params : callback;
                if (typeof cb === 'function') {
                    process.nextTick(() => {
                        try {
                            cb(null, defaultGetResult);
                        } catch (e) {
                            if (enableLogging) {
                                console.error('[MockDB] prepare.get callback error', e);
                            }
                        }
                    });
                }
                return this;
            }),
            all: vi.fn().mockImplementation(function (params?: any, callback?: any) {
                const cb = typeof params === 'function' ? params : callback;
                if (typeof cb === 'function') {
                    process.nextTick(() => {
                        try {
                            cb(null, defaultAllResult);
                        } catch (e) {
                            if (enableLogging) {
                                console.error('[MockDB] prepare.all callback error', e);
                            }
                        }
                    });
                }
                return this;
            }),
            finalize: vi.fn().mockImplementation(function (callback?: any) {
                if (typeof callback === 'function') {
                    process.nextTick(() => {
                        try {
                            callback(null);
                        } catch (e) {
                            if (enableLogging) {
                                console.error('[MockDB] prepare.finalize callback error', e);
                            }
                        }
                    });
                }
                return this;
            })
        } as any);

    return db as MockDb;
}

/**
 * Create a mock logger instance
 * Matches Winston logger interface
 *
 * @param options - Configuration options for the mock
 * @returns Mock logger instance
 */
export function createMockLogger(options: {
    enableLogging?: boolean;
} = {}): MockLogger {
    const { enableLogging = false } = options;

    // Create mock logger object
        const logger: Partial<MockLogger> = {
            error: vi.fn(),
            warn: vi.fn(),
            info: vi.fn(),
            debug: vi.fn(),
            verbose: vi.fn(),
            silly: vi.fn()
        };

        // Default implementations - all methods are no-ops by default
        // Tests can override with .mockImplementation() if needed
        logger.error!.mockImplementation((...args: any[]) => {
            if (enableLogging) {
                console.error('[MockLogger] error', ...args);
            }
        });

        logger.warn!.mockImplementation((...args: any[]) => {
            if (enableLogging) {
                console.warn('[MockLogger] warn', ...args);
            }
        });

        logger.info!.mockImplementation((...args: any[]) => {
            if (enableLogging) {
                console.info('[MockLogger] info', ...args);
            }
        });

        logger.debug!.mockImplementation((...args: any[]) => {
            if (enableLogging) {
                console.debug('[MockLogger] debug', ...args);
            }
        });

        logger.verbose!.mockImplementation((...args: any[]) => {
            if (enableLogging) {
                console.log('[MockLogger] verbose', ...args);
            }
        });

        logger.silly!.mockImplementation((...args: any[]) => {
            if (enableLogging) {
                console.log('[MockLogger] silly', ...args);
            }
        });

    return logger as MockLogger;
}

/**
 * Create both mock database and logger in one call
 * 
 * @param options - Configuration options for both mocks
 * @returns Object containing mockDb and mockLogger
 */
export function createMockDependencies(options: {
    defaultGetResult?: any;
    defaultAllResult?: any[];
    defaultRunResult?: { lastID?: number; changes?: number };
    enableLogging?: boolean;
} = {}) {
    return {
        mockDb: createMockDb(options),
        mockLogger: createMockLogger(options)
    };
}

export default {
    createMockDb,
    createMockLogger,
    createMockDependencies
};

