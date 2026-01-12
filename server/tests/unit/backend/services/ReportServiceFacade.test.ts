import { v4 as uuidv4 } from 'uuid';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { TestDatabaseFactory } from '../../../../../tests/utils/TestDatabaseFactory.js';
import ReportServiceFacade from '../../../../src/services/reportService.js';

describe('ReportService Facade Smoke Test', () => {
    let db;

    beforeAll(async () => {
        // Initialize Test Database with necessary schema
        db = await TestDatabaseFactory.create();

        // Define Admin Saved Reports Table
        await db.run(`CREATE TABLE IF NOT EXISTS admin_saved_reports (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            report_type TEXT NOT NULL,
            filters_json TEXT DEFAULT '{}',
            columns_json TEXT DEFAULT '[]',
            schedule_json TEXT,
            created_by TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Define Admin Report Executions Table
        await db.run(`CREATE TABLE IF NOT EXISTS admin_report_executions (
            id TEXT PRIMARY KEY,
            report_id TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            completed_at DATETIME,
            result_json TEXT,
            error_message TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(report_id) REFERENCES admin_saved_reports(id) ON DELETE CASCADE
        )`);

        // Drop tables if they exist from default schema to ensure our definitions are used
        await db.run('DROP TABLE IF EXISTS organizations');
        await db.run('DROP TABLE IF EXISTS users');

        // Define Users and Organizations for report generation testing
        await db.run(
            `CREATE TABLE IF NOT EXISTS organizations (id TEXT PRIMARY KEY, name TEXT, status TEXT, subscription_plan TEXT, created_at TEXT)`,
        );
        await db.run(
            `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT, role TEXT, status TEXT, created_at TEXT, organization_id TEXT)`,
        );

        // Seed some data
        await db.run(
            `INSERT INTO organizations (id, name, status, subscription_plan, created_at) VALUES ('org1', 'Test Org', 'active', 'enterprise', '2023-01-01')`,
        );
        await db.run(
            `INSERT INTO users (id, email, role, status, created_at, organization_id) VALUES ('user1', 'test@example.com', 'admin', 'active', '2023-01-01', 'org1')`,
        );
    });

    beforeEach(() => {
        // Inject the test database into the facade
        // We need to wrap the sqlite3 db to match IDatabase interface (Promise-based)
        const dbWrapper = {
            ...db,
            run: db.runAsync.bind(db),
            get: db.getAsync.bind(db),
            all: db.allAsync.bind(db),
            exec: (sql: string) =>
                new Promise<void>((resolve, reject) => {
                    db.exec(sql, (err: Error | null) => {
                        if (err) reject(err);
                        else resolve();
                    });
                }),
            close: () =>
                new Promise<void>((resolve, reject) => {
                    db.close((err: Error | null) => {
                        if (err) reject(err);
                        else resolve();
                    });
                }),
        };

        ReportServiceFacade.setDependencies({
            db: dbWrapper as any,
            uuidv4,
        });
    });

    it('should delegate createReport to ReportDefinitionService', async () => {
        const reportData = {
            name: 'Test Report',
            report_type: 'users',
            filters: { status: 'active' },
            columns: [{ key: 'email', label: 'Email' }],
        };
        const userId = 'user1';

        const report = await ReportServiceFacade.createReport(reportData, userId);

        expect(report).toBeDefined();
        expect(report.id).toBeDefined();
        expect(report.name).toBe('Test Report');
        expect(report.reportType).toBe('users');
    });

    it('should delegate getReportById to ReportDefinitionService', async () => {
        const reportData = {
            name: 'Fetch Report',
            report_type: 'organizations',
        };
        const created = await ReportServiceFacade.createReport(reportData, 'user1');

        const fetched = await ReportServiceFacade.getReportById(created.id);

        expect(fetched).toBeDefined();
        expect(fetched?.id).toBe(created.id);
        expect(fetched?.name).toBe('Fetch Report');
    });

    it('should delegate executeReport to Execution and Generator services', async () => {
        const reportData = {
            name: 'Execution Report',
            report_type: 'users', // Use 'users' type which we seeded
            filters: { status: 'active' },
            columns: [],
        };
        const created = await ReportServiceFacade.createReport(reportData, 'user1');

        const result = await ReportServiceFacade.executeReport(created.id);

        expect(result).toBeDefined();
        expect(result.executionId).toBeDefined();
        expect(result.status).toBe('completed');
        expect(result.result).toBeDefined();
        expect(result.result.report_type).toBe('users');
        expect(result.result.data).toBeInstanceOf(Array);
        expect(result.result.data.length).toBeGreaterThan(0);
        expect(result.result.data[0].email).toBe('test@example.com');
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
