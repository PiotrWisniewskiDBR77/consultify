import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockDb = vi.hoisted(() => ({
    run: vi.fn(),
    get: vi.fn(),
    all: vi.fn(),
    exec: vi.fn(),
    query: vi.fn(),
    serialize: vi.fn((cb) => cb()),
    on: vi.fn(),
    initPromise: Promise.resolve()
}));

vi.mock('../../../server/database', () => ({ default: mockDb }));

describe('VersioningService', () => {
    let VersioningService;

    beforeEach(async () => {
        vi.clearAllMocks();

        // Default mock implementations - MUST USE CALLBACKS
        mockDb.run.mockImplementation(function(sql, params, callback) {
            const cb = typeof params === 'function' ? params : callback;
            if (typeof cb === 'function') cb.call({ lastID: 1, changes: 1 }, null);
        });

        mockDb.get.mockImplementation((sql, params, callback) => {
            const cb = typeof params === 'function' ? params : callback;
            if (typeof cb === 'function') {
                if (sql.includes('MAX(version_number)')) {
                    cb(null, { maxVersion: 1 });
                } else if (sql.includes('digitization_analyses')) {
                    cb(null, {
                        id: 'analysis-123',
                        overall_score: 4.5,
                        completion_percent: 75
                    });
                } else {
                    cb(null, {
                        id: 'version-123',
                        analysis_id: 'analysis-123',
                        version_number: 2,
                        version_name: 'Version 2',
                        version_type: 'snapshot',
                        snapshot_data: '{}'
                    });
                }
            }
        });

        mockDb.all.mockImplementation((sql, params, callback) => {
            const cb = typeof params === 'function' ? params : callback;
            if (typeof cb === 'function') cb(null, []);
        });

        // Dynamic import for ESM compatibility
        const mod = await import('../../../server/src/services/versioningService');
        VersioningService = mod.default || mod;
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
                const cb = typeof params === 'function' ? params : callback;
                if (typeof cb === 'function') cb(null, { maxVersion: null });
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
                const cb = typeof params === 'function' ? params : callback;
                if (typeof cb === 'function') {
                    if (sql.includes('digitization_analyses')) {
                        cb(null, null);
                    } else {
                        cb(null, { maxVersion: 0 });
                    }
                }
            });

            await expect(
                VersioningService.createVersion('nonexistent', {}, 'user-123')
            ).rejects.toThrow('Analysis not found');
        });
    });
});






