import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const mockDb = {
    run: vi.fn(),
    get: vi.fn(),
    all: vi.fn()
};

vi.mock('../../../server/database', () => ({
    default: mockDb
}));

describe('VersioningService', () => {
    let VersioningService;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();

        mockDb.run.mockImplementation((sql, params, callback) => {
            if (typeof callback === 'function') {
                callback(null, { lastID: 1, changes: 1 });
            }
        });

        mockDb.get.mockImplementation((sql, params, callback) => {
            if (sql.includes('MAX(version_number)')) {
                callback(null, { maxVersion: 1 });
            } else if (sql.includes('digitization_analyses')) {
                callback(null, {
                    id: 'analysis-123',
                    overall_score: 4.5,
                    completion_percent: 75
                });
            } else {
                callback(null, {
                    id: 'version-123',
                    analysis_id: 'analysis-123',
                    version_number: 2,
                    version_name: 'Version 2',
                    version_type: 'snapshot'
                });
            }
        });

        mockDb.all.mockImplementation((sql, params, callback) => {
            callback(null, []);
        });

        VersioningService = require('../../../server/services/versioningService');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('getNextVersionNumber', () => {
        it('should return next version number', async () => {
            const versionNumber = await VersioningService.getNextVersionNumber('analysis-123');
            expect(versionNumber).toBe(2);
        });

        it('should return 1 for first version', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, { maxVersion: null });
            });

            const versionNumber = await VersioningService.getNextVersionNumber('analysis-123');
            expect(versionNumber).toBe(1);
        });
    });

    describe('createVersion', () => {
        it('should create a version snapshot', async () => {
            const result = await VersioningService.createVersion(
                'analysis-123',
                {
                    versionName: 'Test Version',
                    versionType: 'snapshot',
                    notes: 'Test notes'
                },
                'user-123'
            );

            expect(result).toBeDefined();
            expect(mockDb.run).toHaveBeenCalled();
        });

        it('should throw error if analysis not found', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                if (sql.includes('digitization_analyses')) {
                    callback(null, null);
                } else {
                    callback(null, { maxVersion: 0 });
                }
            });

            await expect(
                VersioningService.createVersion('nonexistent', {}, 'user-123')
            ).rejects.toThrow('Analysis not found');
        });
    });
});

