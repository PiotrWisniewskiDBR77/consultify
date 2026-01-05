/**
 * Unit Tests for ReportVersionService
 * 
 * Tests the version management system for Management Reports.
 */

const ReportVersionService = require('../services/reportVersionService');

// Mock database
jest.mock('../database', () => {
    const mockDb = {
        get: jest.fn(),
        all: jest.fn(),
        run: jest.fn()
    };
    return mockDb;
});

const db = require('../database');

describe('ReportVersionService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('createVersion', () => {
        it('should create initial major version', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                if (sql.includes('MAX(version_number)')) {
                    callback(null, { max_version: null }); // No previous versions
                } else if (sql.includes('FROM management_reports')) {
                    callback(null, { id: 'report1', organization_id: 'org1' });
                }
            });

            db.run.mockImplementation((sql, params, callback) => {
                callback.call({ lastID: 1, changes: 1 }, null);
            });

            const content = { executiveSummary: 'Test', kpis: [] };
            const result = await ReportVersionService.createVersion(
                'report1', 
                content, 
                'user1', 
                'Initial version', 
                'major'
            );

            expect(result.versionNumber).toBe(1);
            expect(result.versionLabel).toBe('1.0');
            expect(result.reportId).toBe('report1');
        });

        it('should create minor version increment', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                if (sql.includes('MAX(version_number)')) {
                    callback(null, { max_version: 1 });
                } else if (sql.includes('FROM management_reports')) {
                    callback(null, { id: 'report1', current_version: 1 });
                } else if (sql.includes('FROM management_report_versions WHERE version_number')) {
                    callback(null, { id: 'v1', version_label: '1.0' });
                }
            });

            db.run.mockImplementation((sql, params, callback) => {
                callback.call({ lastID: 2, changes: 1 }, null);
            });

            const content = { executiveSummary: 'Updated', kpis: [] };
            const result = await ReportVersionService.createVersion(
                'report1', 
                content, 
                'user1', 
                'Minor update', 
                'minor'
            );

            expect(result.versionNumber).toBe(2);
            expect(result.versionLabel).toBe('1.1');
        });

        it('should create major version increment', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                if (sql.includes('MAX(version_number)')) {
                    callback(null, { max_version: 2 });
                } else if (sql.includes('FROM management_reports')) {
                    callback(null, { id: 'report1', current_version: 2 });
                } else if (sql.includes('FROM management_report_versions WHERE version_number')) {
                    callback(null, { id: 'v2', version_label: '1.1' });
                }
            });

            db.run.mockImplementation((sql, params, callback) => {
                callback.call({ lastID: 3, changes: 1 }, null);
            });

            const content = { executiveSummary: 'Major rewrite', kpis: [] };
            const result = await ReportVersionService.createVersion(
                'report1', 
                content, 
                'user1', 
                'Major revision', 
                'major'
            );

            expect(result.versionNumber).toBe(3);
            expect(result.versionLabel).toBe('2.0');
        });
    });

    describe('getVersions', () => {
        it('should return all versions ordered by version number desc', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                callback(null, { id: 'report1' });
            });

            db.all.mockImplementation((sql, params, callback) => {
                callback(null, [
                    { id: 'v3', version_number: 3, version_label: '2.0', created_at: '2025-12-20' },
                    { id: 'v2', version_number: 2, version_label: '1.1', created_at: '2025-12-15' },
                    { id: 'v1', version_number: 1, version_label: '1.0', created_at: '2025-12-10' }
                ]);
            });

            const result = await ReportVersionService.getVersions('report1');

            expect(result.length).toBe(3);
            expect(result[0].versionNumber).toBe(3);
            expect(result[0].versionLabel).toBe('2.0');
        });
    });

    describe('getVersion', () => {
        it('should return specific version', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                callback(null, { 
                    id: 'v2', 
                    version_number: 2, 
                    version_label: '1.1',
                    content: JSON.stringify({ executiveSummary: 'Version 2 content' }),
                    created_by: 'user1',
                    created_at: '2025-12-15'
                });
            });

            const result = await ReportVersionService.getVersion('report1', 2);

            expect(result.versionNumber).toBe(2);
            expect(result.content.executiveSummary).toBe('Version 2 content');
        });

        it('should return null if version not found', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                callback(null, null);
            });

            const result = await ReportVersionService.getVersion('report1', 999);

            expect(result).toBeNull();
        });
    });

    describe('compareVersions', () => {
        it('should return diff between two versions', async () => {
            const version1Content = {
                executiveSummary: 'Original summary',
                kpis: [{ name: 'KPI 1', value: 10 }],
                overallStatus: { status: 'GREEN' }
            };

            const version2Content = {
                executiveSummary: 'Updated summary',
                kpis: [{ name: 'KPI 1', value: 15 }, { name: 'KPI 2', value: 5 }],
                overallStatus: { status: 'AMBER' }
            };

            db.get.mockImplementation((sql, params, callback) => {
                if (params && params[1] === 1) {
                    callback(null, { 
                        id: 'v1', 
                        version_number: 1,
                        content: JSON.stringify(version1Content)
                    });
                } else if (params && params[1] === 2) {
                    callback(null, { 
                        id: 'v2', 
                        version_number: 2,
                        content: JSON.stringify(version2Content)
                    });
                } else {
                    callback(null, { id: 'report1' });
                }
            });

            const result = await ReportVersionService.compareVersions('report1', 1, 2);

            expect(result.v1).toBe(1);
            expect(result.v2).toBe(2);
            expect(result.changes).toBeDefined();
            expect(result.changes.executiveSummary).toBeDefined();
            expect(result.changes.overallStatus).toBeDefined();
        });

        it('should throw error if versions are same', async () => {
            await expect(
                ReportVersionService.compareVersions('report1', 1, 1)
            ).rejects.toThrow('Cannot compare same versions');
        });
    });

    describe('restoreVersion', () => {
        it('should create new draft from old version', async () => {
            const oldContent = {
                executiveSummary: 'Old content',
                kpis: []
            };

            db.get.mockImplementation((sql, params, callback) => {
                if (sql.includes('FROM management_report_versions WHERE report_id') && params && params[1] === 1) {
                    callback(null, { 
                        id: 'v1', 
                        version_number: 1,
                        version_label: '1.0',
                        content: JSON.stringify(oldContent),
                        ai_narrative: 'Old narrative'
                    });
                } else if (sql.includes('FROM management_reports WHERE id')) {
                    callback(null, { 
                        id: 'report1', 
                        status: 'DRAFT',
                        current_version: 3
                    });
                } else if (sql.includes('MAX(version_number)')) {
                    callback(null, { max_version: 3 });
                }
            });

            db.run.mockImplementation((sql, params, callback) => {
                callback.call({ lastID: 4, changes: 1 }, null);
            });

            const result = await ReportVersionService.restoreVersion('report1', 1, 'user1');

            expect(result.success).toBe(true);
            expect(result.restoredFromVersion).toBe(1);
            expect(result.newVersionNumber).toBe(4);
            expect(result.content).toEqual(oldContent);
        });

        it('should throw error if report is finalized', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                if (sql.includes('FROM management_reports')) {
                    callback(null, { id: 'report1', status: 'FINAL' });
                }
            });

            await expect(
                ReportVersionService.restoreVersion('report1', 1, 'user1')
            ).rejects.toThrow('Cannot restore version of finalized report');
        });
    });

    describe('getCurrentVersion', () => {
        it('should return current version number', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                callback(null, { current_version: 5 });
            });

            const result = await ReportVersionService.getCurrentVersion('report1');

            expect(result).toBe(5);
        });
    });

    describe('incrementVersion', () => {
        it('should increment major version correctly', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                callback(null, { 
                    id: 'v2', 
                    version_label: '1.5' 
                });
            });

            const result = await ReportVersionService.incrementVersion('report1', 'major');

            expect(result).toBe('2.0');
        });

        it('should increment minor version correctly', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                callback(null, { 
                    id: 'v2', 
                    version_label: '1.5' 
                });
            });

            const result = await ReportVersionService.incrementVersion('report1', 'minor');

            expect(result).toBe('1.6');
        });

        it('should increment patch version correctly', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                callback(null, { 
                    id: 'v2', 
                    version_label: '1.5.2' 
                });
            });

            const result = await ReportVersionService.incrementVersion('report1', 'patch');

            expect(result).toBe('1.5.3');
        });

        it('should return 1.0 for first version', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                callback(null, null);
            });

            const result = await ReportVersionService.incrementVersion('report1', 'major');

            expect(result).toBe('1.0');
        });
    });
});















