/**
 * Unit tests for OrganizationMetadataService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockDb } = vi.hoisted(() => ({
    mockDb: {
        all: vi.fn(),
        run: vi.fn(),
        get: vi.fn()
    }
}));

vi.mock('../../../../server/src/database/Database.ts', () => ({
    getDatabase: () => mockDb
}));

import OrganizationMetadataService from '../../../../server/services/organizationMetadataService';

describe('OrganizationMetadataService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getMetadata', () => {
        it('should return metadata for an organization', async () => {
            const mockMetadata = [
                { id: '1', organization_id: 'org1', key: 'custom_field', value: 'test' }
            ];

            mockDb.all.mockImplementation((query, params, callback) => {
                // The service uses callback-style API wrapped in Promise
                if (typeof callback === 'function') {
                    process.nextTick(() => callback(null, mockMetadata));
                }
                // Also support Promise-style return
                return Promise.resolve(mockMetadata);
            });

            const result = await OrganizationMetadataService.getMetadata('org1');
            expect(result).toEqual(mockMetadata);
            expect(mockDb.all).toHaveBeenCalledWith(
                expect.stringContaining('organization_metadata'),
                ['org1'],
                expect.any(Function)
            );
        });

        it('should reject on database error', async () => {
            const dbError = new Error('DB Error');
            mockDb.all.mockImplementation((query, params, callback) => {
                if (typeof callback === 'function') {
                    process.nextTick(() => callback(dbError, null));
                }
                return Promise.reject(dbError);
            });

            await expect(OrganizationMetadataService.getMetadata('org1')).rejects.toThrow('DB Error');
        });
    });

    describe('setMetadata', () => {
        it('should set metadata value', async () => {
            mockDb.run.mockImplementation(function (query, params, callback) {
                // The service uses `this.changes` in callback, simulate it
                callback.call({ changes: 1, lastID: 1 }, null);
            });

            const result = await OrganizationMetadataService.setMetadata(
                'org1', 'key1', 'value1', 'string', 'category1', false
            );
            expect(result).toHaveProperty('id');
            expect(result.organizationId).toBe('org1');
            expect(result.key).toBe('key1');
        });
    });

    describe('deleteMetadata', () => {
        it('should delete metadata by key', async () => {
            mockDb.run.mockImplementation(function (query, params, callback) {
                // Simulate `this.changes` for delete
                callback.call({ changes: 1 }, null);
            });

            const result = await OrganizationMetadataService.deleteMetadata('org1', 'key1');
            expect(result.deleted).toBe(true);
        });
    });
});

