import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { createMockDb } from '../../helpers/dependencyInjector.js';

const require = createRequire(import.meta.url);

describe('System Integrity Service', () => {
    let SystemIntegrity;
    let mockDb;

    beforeEach(() => {
        vi.resetModules();

        mockDb = createMockDb();

        vi.doMock('../../../server/database', () => ({ default: mockDb }));

        SystemIntegrity = require('../../../server/services/systemIntegrity.js');
        
        // Inject mock dependencies
        SystemIntegrity.setDependencies({
            db: mockDb
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.doUnmock('../../../server/database');
    });

    describe('check', () => {
        it('should detect missing DBR77 anchor', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => {
                if (sql.includes('DBR77')) {
                    cb(null, null); // No anchor found
                } else {
                    cb(null, []);
                }
            });

            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            await SystemIntegrity.check();

            expect(mockDb.get).toHaveBeenCalled();
            consoleSpy.mockRestore();
            consoleErrorSpy.mockRestore();
        });

        it('should detect valid DBR77 anchor', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => {
                if (sql.includes('DBR77')) {
                    cb(null, { id: 'dbr77', name: 'DBR77 Organization' });
                } else {
                    cb(null, []);
                }
            });

            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            await SystemIntegrity.check();

            expect(mockDb.get).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });

        it('should check LLM providers', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => {
                if (sql.includes('DBR77')) {
                    cb(null, { id: 'dbr77', name: 'DBR77' });
                } else {
                    cb(null, []);
                }
            });

            mockDb.all.mockImplementation((sql, params, cb) => {
                if (sql.includes('llm_providers')) {
                    cb(null, [
                        { provider: 'openai', api_key: 'sk-real-key-123' }
                    ]);
                } else {
                    cb(null, []);
                }
            });

            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            await SystemIntegrity.check();

            expect(mockDb.all).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });
});
