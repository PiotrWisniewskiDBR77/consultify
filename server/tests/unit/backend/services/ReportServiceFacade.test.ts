/**
 * ReportServiceFacade Unit Tests
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Unit tests for ReportServiceFacade - 95%+ coverage target
 */

import { v4 as uuidv4 } from 'uuid';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ReportServiceFacade from '../../../../src/services/reportService.js';

// Mock the DbPromise module
vi.mock('../../../../src/utils/DbPromise.ts', () => ({
    run: vi.fn().mockResolvedValue({ success: true, lastID: 1, changes: 1 }),
    get: vi.fn().mockResolvedValue(null),
    all: vi.fn().mockResolvedValue([]),
}));

// Mock logger
vi.mock('../../../../src/utils/Logger.ts', () => ({
    default: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

describe('ReportService Facade Smoke Test', () => {
    beforeEach(async () => {
        vi.clearAllMocks();

        const DbPromise = await import('../../../../src/utils/DbPromise.ts');

        (DbPromise.run as ReturnType<typeof vi.fn>).mockResolvedValue({
            success: true,
            lastID: 1,
            changes: 1,
        });

        // Create a mock db that matches the expected interface
        const mockDb = {
            run: vi.fn().mockResolvedValue({ lastID: 1, changes: 1 }),
            get: vi.fn().mockResolvedValue(null),
            all: vi.fn().mockResolvedValue([]),
        };

        // Inject mock dependencies
        ReportServiceFacade.setDependencies({
            db: mockDb as any,
            uuidv4,
        });
    });

    it('should delegate createReport to ReportDefinitionService', async () => {
        const DbPromise = await import('../../../../src/utils/DbPromise.ts');

        // Mock get to return the created report
        (DbPromise.get as ReturnType<typeof vi.fn>).mockResolvedValue({
            id: 'test-report-id',
            name: 'Test Report',
            report_type: 'users',
            filters_json: JSON.stringify({ status: 'active' }),
            columns_json: JSON.stringify([{ key: 'email', label: 'Email' }]),
            created_by: 'user1',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });

        const reportData = {
            name: 'Test Report',
            report_type: 'users',
            filters: { status: 'active' },
            columns: [{ key: 'email', label: 'Email' }],
        };
        const userId = 'user1';

        const report = await ReportServiceFacade.createReport(reportData, userId);

        expect(report).toBeDefined();
        expect(report.name).toBe('Test Report');
    });

    it('should delegate getReportById to ReportDefinitionService', async () => {
        const DbPromise = await import('../../../../src/utils/DbPromise.ts');

        // Mock get to return the report
        (DbPromise.get as ReturnType<typeof vi.fn>).mockResolvedValue({
            id: 'test-report-id',
            name: 'Fetch Report',
            report_type: 'organizations',
            filters_json: '{}',
            columns_json: '[]',
            created_by: 'user1',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });

        const fetched = await ReportServiceFacade.getReportById('test-report-id');

        expect(fetched).toBeDefined();
        expect(fetched?.name).toBe('Fetch Report');
    });

    it('should delegate executeReport to Execution and Generator services', async () => {
        const DbPromise = await import('../../../../src/utils/DbPromise.ts');

        // Mock get for report definition
        (DbPromise.get as ReturnType<typeof vi.fn>).mockResolvedValue({
            id: 'test-report-id',
            name: 'Execution Report',
            report_type: 'users',
            filters_json: JSON.stringify({ status: 'active' }),
            columns_json: '[]',
            created_by: 'user1',
        });

        // Mock all for data query
        (DbPromise.all as ReturnType<typeof vi.fn>).mockResolvedValue([
            { id: 'user1', email: 'test@example.com', role: 'admin', status: 'active' },
        ]);

        const result = await ReportServiceFacade.executeReport('test-report-id');

        expect(result).toBeDefined();
        expect(result.status).toBe('completed');
    });

    it('should delegate exportToCsv to ExportService', () => {
        const reportData = {
            data: [
                { name: 'John', role: 'admin' },
                { name: 'Jane', role: 'user' },
            ],
        };

        const csv = ReportServiceFacade.exportToCsv(reportData);

        expect(csv).toContain('name,role');
        expect(csv).toContain('John,admin');
        expect(csv).toContain('Jane,user');
    });
});
