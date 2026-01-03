/**
 * Unit tests for OrganizationMetadataService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import OrganizationMetadataService from '../../../../server/services/organizationMetadataService';
import * as dbModule from '../../../../server/database';

vi.mock('../../../../server/database', () => ({
    default: {
        all: vi.fn(),
        run: vi.fn(),
        get: vi.fn()
    }
}));

const db = dbModule.default;

describe('OrganizationMetadataService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getMetadata', () => {
        it('should return metadata for an organization', async () => {
            const mockMetadata = [
                { id: '1', organization_id: 'org1', key: 'custom_field', value: 'test' }
            ];
            db.all.mockImplementation((query, params, callback) => {
                if (callback) callback(null, mockMetadata);
                return Promise.resolve(mockMetadata);
            });

            const result = await OrganizationMetadataService.getMetadata('org1');
            expect(result).toEqual(mockMetadata);
            expect(db.all).toHaveBeenCalledWith(
                expect.stringContaining('organization_metadata'),
                ['org1'],
                expect.any(Function)
            );
        });

        it('should return empty array on error', async () => {
            db.all.mockImplementation((query, params, callback) => {
                callback(new Error('DB Error'), null);
            });

            await expect(OrganizationMetadataService.getMetadata('org1')).rejects.toThrow();
        });
    });

    describe('setMetadata', () => {
        it('should set metadata value', async () => {
            db.run.mockImplementation((query, params, callback) => {
                callback(null, { changes: 1 });
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
            db.run.mockImplementation((query, params, callback) => {
                callback(null, { changes: 1 });
            });

            const result = await OrganizationMetadataService.deleteMetadata('org1', 'key1');
            expect(result.deleted).toBe(true);
        });
    });
});

