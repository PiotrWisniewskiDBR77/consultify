/**
 * ReportVersionService Unit Tests
 * Enterprise SaaS Architecture - TypeScript Backend
 */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

// Use vi.hoisted to ensure mock data is available to vi.mock
const { mockDb } = vi.hoisted(() => ({
    mockDb: {
        get: vi.fn(),
        all: vi.fn(),
        run: vi.fn().mockImplementation((sql: string, params: any[], callback: (err: Error | null) => void) => {
            if (callback) callback.call({ lastID: 1, changes: 1 }, null);
            return { lastID: 1, changes: 1 };
        }),
        exec: vi.fn(),
        serialize: vi.fn(),
        close: vi.fn(),
        query: vi.fn(),
    }
}));

// Mock the Database module
vi.mock('../../../../src/database/Database.ts', () => ({
    getDatabase: () => mockDb,
    default: mockDb
}));

import ReportVersionService from '../../../../src/services/reportVersionService.js';

describe('ReportVersionService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default mock implementations for get/all to prevent timeouts
        (mockDb.get as Mock).mockImplementation((sql, params, callback) => {
            if (callback) callback(null, null);
        });
        (mockDb.all as Mock).mockImplementation((sql, params, callback) => {
            if (callback) callback(null, []);
        });
    });

    describe('createVersion', () => {
        it('should create initial major version', async () => {
            (mockDb.get as Mock).mockImplementation((sql: string, params: any[], callback: (err: Error | null, row: any) => void) => {
                if (sql.includes('MAX(version_number)')) {
                    callback(null, { max_version: null });
                } else if (sql.includes('FROM management_reports')) {
                    callback(null, { id: 'report1', organization_id: 'org1' });
                } else {
                    callback(null, null);
                }
            });

            const result = await ReportVersionService.createVersion(
                'report1',
                { executiveSummary: 'Test' },
                'user1',
                'Initial version',
                'major'
            );

            expect(result.versionNumber).toBe(1);
            expect(result.versionLabel).toBe('1.0');
        });
    });

    describe('getVersions', () => {
        it('should return all versions ordered by version number desc', async () => {
            (mockDb.get as Mock).mockImplementation((sql: string, params: any[], callback: (err: Error | null, row: any) => void) => {
                callback(null, { total: 2 });
            });

            (mockDb.all as Mock).mockImplementation((sql: string, params: any[], callback: (err: Error | null, rows: any[]) => void) => {
                callback(null, [
                    { id: 'v3', version_number: 3, version_label: '2.0', created_at: '2025-12-20' },
                    { id: 'v2', version_number: 2, version_label: '1.1', created_at: '2025-12-15' }
                ]);
            });

            const result = await ReportVersionService.getVersions('report1');

            expect(result.versions.length).toBe(2);
            expect(result.versions[0].versionNumber).toBe(3);
            expect(result.total).toBe(2);
        });
    });

    describe('getVersion', () => {
        it('should return specific version', async () => {
            (mockDb.get as Mock).mockImplementation((sql: string, params: any[], callback: (err: Error | null, row: any) => void) => {
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
    });
});
