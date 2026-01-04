import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiKeyService } from '../../../../server/src/services/apiKeyService.js';
import * as DbPromise from '../../../../server/src/utils/DbPromise.js';

// Mock dependencies
const mockDb = {
    run: vi.fn(),
    get: vi.fn(),
    all: vi.fn()
};

vi.mock('../../../../server/src/database/Database.js', () => ({
    getDatabase: () => mockDb
}));

vi.mock('../../../../server/src/utils/DbPromise.js', () => ({
    run: vi.fn(),
    get: vi.fn(),
    all: vi.fn()
}));

vi.mock('../../../../server/src/utils/Logger.ts', () => ({
    default: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

describe('ApiKeyService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('createKey', () => {
        it('should create a new API key', async () => {
            // Mock DbPromise.run to return success
            (DbPromise.run as any).mockResolvedValue({ changes: 1 });

            const options = {
                organizationId: 'org-1',
                name: 'Test Key',
                createdBy: 'user-1'
            };

            const result = await ApiKeyService.createKey(options);

            expect(result.key).toBeDefined();
            expect(result.plainTextKey).toMatch(/^ck_/);
            expect(DbPromise.run).toHaveBeenCalledTimes(1);
        });
    });

    describe('validateKey', () => {
        it('should validate a correct key', async () => {
            // First create a key to get a hash (or just mock the db response for a known hash)
            // We can just mock DbPromise.get to return a row if the hash matches.

            const mockRow = {
                id: 'key-1',
                organization_id: 'org-1',
                name: 'Test Key',
                status: 'active',
                permissions: '["read:projects"]',
                key_hash: 'hashed_value',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            (DbPromise.get as any).mockResolvedValue(mockRow);
            (DbPromise.run as any).mockResolvedValue({ changes: 1 });

            // pass any string, we are mocking the DB lookup anyway
            const result = await ApiKeyService.validateKey('ck_testkey');

            expect(result).toBeDefined();
            expect(result?.id).toBe('key-1');
        });

        it('should return null for invalid key', async () => {
            (DbPromise.get as any).mockResolvedValue(null);
            const result = await ApiKeyService.validateKey('ck_invalid');
            expect(result).toBeNull();
        });
    });
});
