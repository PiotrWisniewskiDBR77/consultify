/**
 * ApiKeyService Unit Tests
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Unit tests for ApiKeyService - Covering Key Generation, Validation, and Lifecycle
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock DB Promise - Hoisted
const { mockDbPromise } = vi.hoisted(() => {
    return {
        mockDbPromise: {
            get: vi.fn(),
            all: vi.fn(),
            run: vi.fn(),
        },
    };
});

// Mock Database wrapper
vi.mock('../../../../src/utils/DbPromise.ts', () => ({
    // Mocking the util directly
    get: mockDbPromise.get,
    all: mockDbPromise.all,
    run: mockDbPromise.run,
}));

vi.mock('../../../../src/database/Database.js', () => ({
    getDatabase: vi.fn(() => ({})), // Return empty object as mock db instance
}));

vi.mock('../../../../src/utils/Logger.ts', () => ({
    default: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock('crypto', () => ({
    default: {
        randomBytes: vi.fn(() => ({ toString: () => 'random-string' })),
        createHash: vi.fn(() => ({
            update: vi.fn().mockReturnThis(),
            digest: vi.fn().mockReturnValue('hashed-key'),
        })),
    },
}));

vi.mock('uuid', () => ({
    v4: vi.fn(() => 'mock-uuid'),
}));

// Import service
import ApiKeyService from '../../../../src/services/apiKeyService.js';
import * as DbPromise from '../../../../src/utils/DbPromise.js'; // Import to check calls

describe('ApiKeyService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default mocks
        mockDbPromise.run.mockResolvedValue({ changes: 1, lastID: 1 });
    });

    describe('createKey', () => {
        const createOptions = {
            name: 'Test Key',
            organizationId: 'org-1',
            permissions: ['read:projects'],
            createdBy: 'admin',
        };

        it('should create a new API key with hashed secret', async () => {
            const result = await ApiKeyService.createKey(createOptions);

            expect(result.key.keyPrefix).toBe('random-s'); // from mock crypto
            expect(result.plainTextKey).toContain('ck_random-string');
            expect(result.key.id).toBe('mock-uuid');
            expect(result.key.permissions).toEqual(['read:projects']);

            // Verify DB Insert via DbPromise.run
            // The service calls DbPromise.run(db, sql, params)
            expect(mockDbPromise.run).toHaveBeenCalledWith(
                expect.anything(), // db instance
                expect.stringContaining('INSERT INTO api_keys'),
                expect.arrayContaining(['mock-uuid', 'org-1', 'hashed-key', JSON.stringify(['read:projects'])]),
            );
        });
    });

    describe('validateKey', () => {
        it('should validate a correct active key', async () => {
            const mockRow = {
                id: 'key-1',
                organization_id: 'org-1',
                name: 'Test Key',
                key_prefix: 'random-s',
                key_hash: 'hashed-key',
                permissions: JSON.stringify(['read:projects']),
                status: 'active',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                rate_limit: 100,
            };

            mockDbPromise.get.mockResolvedValue(mockRow);

            const result = await ApiKeyService.validateKey('ck_random-string');

            expect(result).not.toBeNull();
            expect(result?.id).toBe('key-1');
            expect(result?.permissions).toEqual(['read:projects']);

            // Verify Last Used Update
            expect(mockDbPromise.run).toHaveBeenCalledWith(
                expect.anything(),
                expect.stringContaining('UPDATE api_keys SET last_used_at'),
                expect.arrayContaining(['key-1']),
            );
        });

        it('should return null if key not found', async () => {
            mockDbPromise.get.mockResolvedValue(null);
            const result = await ApiKeyService.validateKey('ck_invalid');
            expect(result).toBeNull();
        });

        it('should return null if IP not in whitelist', async () => {
            const mockRow = {
                id: 'key-1',
                key_hash: 'hashed-key',
                status: 'active',
                ip_whitelist: JSON.stringify(['10.0.0.1']),
                permissions: '[]',
            };
            mockDbPromise.get.mockResolvedValue(mockRow);

            const result = await ApiKeyService.validateKey('ck_valid', '192.168.1.1');
            expect(result).toBeNull();
        });
    });

    describe('rotateKey', () => {
        it('should rotate key and archive old one', async () => {
            const existingRow = {
                id: 'key-1',
                organization_id: 'org-1',
                name: 'Old Key',
                status: 'active',
                permissions: JSON.stringify(['read:projects']),
                rate_limit: 100,
            };
            mockDbPromise.get.mockResolvedValue(existingRow);

            const result = await ApiKeyService.rotateKey({ keyId: 'key-1', userId: 'admin' });

            expect(result.newKey.rotatedFromId).toBe('key-1');
            expect(result.newKey.status).toBe('active');

            // Verify Update of Old Key
            expect(mockDbPromise.run).toHaveBeenCalledWith(
                expect.anything(),
                expect.stringContaining("UPDATE api_keys SET status = 'rotated'"),
                expect.arrayContaining(['key-1']),
            );
        });
    });

    describe('revokeKey', () => {
        it('should revoke key', async () => {
            await ApiKeyService.revokeKey('key-1', 'admin');

            expect(mockDbPromise.run).toHaveBeenCalledWith(
                expect.anything(),
                expect.stringContaining("UPDATE api_keys SET status = 'revoked'"),
                expect.arrayContaining(['key-1']),
            );
        });
    });
});
