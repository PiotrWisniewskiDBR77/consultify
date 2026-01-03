/**
 * ReportService Tests (Analytics & Admin Reports)
 * 
 * Tests for the rewrittern ReportService with mocked dependencies.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';



const path = require('path');

// Mock dependencies with hoisting
const { mockDb, mockUuid } = vi.hoisted(() => {
    return {
        mockDb: {
            get: vi.fn(),
            all: vi.fn(),
            run: vi.fn()
        },
        mockUuid: vi.fn(() => 'mock-uuid')
    };
});

// Mock Dependencies using absolute path


describe('ReportService', () => {
    let ReportService;

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        // Import the service
        const module = await import('../../../server/services/reportService.js');
        ReportService = module.default || module;

        // Inject mock DB
        ReportService.setDependencies({ db: mockDb });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('getReports', () => {
        it('should return reports list with defaults', async () => {
            if (!ReportService) return;

            const mockRows = [{ id: 'rpt-1', name: 'Test Report' }];
            mockDb.all.mockImplementation((sql, params, callback) => callback(null, mockRows));

            const result = await ReportService.getReports();

            expect(mockDb.all).toHaveBeenCalled();
            expect(result).toEqual(mockRows);
        });

        it('should apply filters', async () => {
            if (!ReportService) return;

            mockDb.all.mockImplementation((sql, params, callback) => callback(null, []));

            await ReportService.getReports({
                report_type: 'users',
                created_by: 'user-1',
                has_schedule: true,
                limit: 10
            });

            const sqlCall = mockDb.all.mock.calls[0][0];
            const paramsCall = mockDb.all.mock.calls[0][1];

            expect(sqlCall).toContain('report_type = ?');
            expect(sqlCall).toContain('created_by = ?');
            expect(sqlCall).toContain('schedule_json IS NOT NULL');
            expect(sqlCall).toContain('LIMIT ?');
            expect(paramsCall).toContain('users');
            expect(paramsCall).toContain('user-1');
            expect(paramsCall).toContain(10);
        });
    });

    describe('createReport', () => {
        it('should create a new report', async () => {
            if (!ReportService) return;

            mockDb.run.mockImplementation((sql, params, callback) => callback(null));

            const reportData = {
                name: 'New Report',
                report_type: 'revenue',
                filters: { status: 'paid' },
                columns: ['id', 'amount']
            };

            const result = await ReportService.createReport(reportData, 'user-1');

            expect(result.id).toBeDefined();
            expect(result.name).toBe('New Report');
            expect(mockDb.run).toHaveBeenCalled();
        });
    });

    describe('executeReport', () => {
        it('should execute a report and store results', async () => {
            if (!ReportService) return;

            const mockReport = {
                id: 'rpt-1',
                report_type: 'users',
                filters_json: JSON.stringify({ role: 'admin' }),
                columns_json: JSON.stringify(['id', 'email'])
            };

            // 1. getReportById
            mockDb.get.mockImplementation((sql, params, callback) => callback(null, mockReport));

            // 2. generateReportData -> generateUsersReport
            // For generateUsersReport, it calls db.all to fetch users
            const mockUsers = [{ id: 1, email: 'admin@test.com' }];
            // We need to orchestrate the multiple db calls.
            // Call 1: INSERT execution (run)
            // Call 2: SELECT users (all)
            // Call 3: UPDATE execution (run)

            mockDb.run.mockImplementation((sql, params, callback) => callback(null));
            mockDb.all.mockImplementation((sql, params, callback) => callback(null, mockUsers));

            const result = await ReportService.executeReport('rpt-1');

            expect(result.status).toBe('completed');
            expect(result.result.report_type).toBe('users');
            expect(result.result.data).toEqual(mockUsers);

            // Verify execution logging
            expect(mockDb.run).toHaveBeenCalledTimes(2); // INSERT start, UPDATE complete
        });

        it('should handle execution errors', async () => {
            if (!ReportService) return;

            const mockReport = {
                id: 'rpt-1',
                report_type: 'users'
            };

            mockDb.get.mockImplementation((sql, params, callback) => callback(null, mockReport));
            mockDb.run.mockImplementation((sql, params, callback) => callback(null));
            // Simulate generation error
            mockDb.all.mockImplementation((sql, params, callback) => callback(new Error('Query Failed')));

            await expect(ReportService.executeReport('rpt-1')).rejects.toThrow('Query Failed');

            // Verify execution logging of failure: 
            // 1. INSERT start
            // 2. UPDATE failed
            expect(mockDb.run).toHaveBeenCalledTimes(2);
            const updateCall = mockDb.run.mock.calls[1];
            expect(updateCall[0]).toContain("status = 'failed'");
        });
    });

    describe('generateReportData', () => {
        it('should generate revenue report data', async () => {
            if (!ReportService) return;

            const mockInvoices = [
                { id: 1, amount: 100 },
                { id: 2, amount: 200 }
            ];
            mockDb.all.mockImplementation((sql, params, callback) => callback(null, mockInvoices));

            const result = await ReportService.generateReportData('revenue', {}, []);

            expect(result.report_type).toBe('revenue');
            expect(result.total_revenue).toBe(300);
            expect(result.data).toEqual(mockInvoices);
        });

        it('should return error for unknown type', async () => {
            if (!ReportService) return;
            const result = await ReportService.generateReportData('unknown', {}, []);
            expect(result.error).toBe('Unknown report type');
        });
    });

    describe('exportToCsv', () => {
        it('should convert data to CSV string', () => {
            if (!ReportService) return;

            const reportData = {
                data: [
                    { name: 'A', value: 1 },
                    { name: 'B, C', value: 2 }, // Comma handling
                    { name: null, value: 3 } // Null handling
                ]
            };

            const csv = ReportService.exportToCsv(reportData);
            const lines = csv.split('\n');

            expect(lines[0]).toBe('name,value');
            expect(lines[1]).toBe('A,1');
            expect(lines[2]).toBe('"B, C",2');
            expect(lines[3]).toBe(',3');
        });

        it('should return empty string for empty data', () => {
            if (!ReportService) return;
            expect(ReportService.exportToCsv({ data: [] })).toBe('');
        });
    });
});
