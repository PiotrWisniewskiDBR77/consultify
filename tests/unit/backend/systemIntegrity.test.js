import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import DbPromise from '../../../server/src/utils/DbPromise.ts';

// Mock DbPromise
vi.mock('../../../server/src/utils/DbPromise.ts', () => ({
    default: {
        get: vi.fn(),
        all: vi.fn(),
    }
}));

// Mock Database (if constructor calls it)
vi.mock('../../../server/src/database/Database.js', () => ({
    getDatabase: vi.fn(() => ({}))
}));

// Import Service
import SystemIntegrity from '../../../server/src/services/systemIntegrity.ts';

describe('System Integrity Service', () => {
    let mockDb;

    beforeEach(() => {
        vi.clearAllMocks();

        mockDb = {}; // Mock DB object
        SystemIntegrity.setDependencies({ db: mockDb });

        // Default: Console spies to suppress output
        vi.spyOn(console, 'log').mockImplementation(() => { });
        vi.spyOn(console, 'error').mockImplementation(() => { });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('check', () => {
        it('should detect missing DBR77 anchor', async () => {
            // Mock DbPromise.get to return null (anchor not found)
            vi.mocked(DbPromise.get).mockResolvedValue(null);
            // Mock DbPromise.all for empty providers list so we don't crash later
            vi.mocked(DbPromise.all).mockResolvedValue([]);

            await SystemIntegrity.check();

            expect(DbPromise.get).toHaveBeenCalled();
            const [db, sql] = vi.mocked(DbPromise.get).mock.calls[0];
            expect(sql).toContain('DBR77');

            // Should verify that log was called with critical error?
            // Since we spy on console, we can check calls.
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Anchor Tenant \'DBR77\' NOT FOUND'));
        });

        it('should detect valid DBR77 anchor', async () => {
            // Found anchor
            vi.mocked(DbPromise.get).mockResolvedValue({ id: 'dbr77', name: 'DBR77 Organization' });
            // Providers empty
            vi.mocked(DbPromise.all).mockResolvedValue([]);

            await SystemIntegrity.check();

            expect(DbPromise.get).toHaveBeenCalled();
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Database Anchor Found'));
        });

        it('should check LLM providers', async () => {
            // Found anchor
            vi.mocked(DbPromise.get).mockResolvedValue({ id: 'dbr77', name: 'DBR77' });
            // Providers list
            vi.mocked(DbPromise.all).mockResolvedValue([
                { provider: 'openai', api_key: 'sk-real-key-123' }
            ]);

            await SystemIntegrity.check();

            expect(DbPromise.all).toHaveBeenCalled();
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Found 1 Valid LLM Providers'));
        });
    });
});
