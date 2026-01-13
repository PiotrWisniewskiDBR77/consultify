/**
 * Generic Report Service Tests
 * Real database tests for report generation
 * 
 * @module tests/unit/backend/services/genericReportService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('GenericReportService', () => {
    let db: sqlite3.Database;

    beforeAll(async () => {
        db = new sqlite3.Database(':memory:');

        await new Promise<void>((resolve, reject) => {
            db.serialize(() => {
                db.run(`
                    CREATE TABLE IF NOT EXISTS reports (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        report_type TEXT NOT NULL,
                        title TEXT NOT NULL,
                        status TEXT DEFAULT 'pending',
                        parameters TEXT,
                        output_format TEXT DEFAULT 'pdf',
                        file_path TEXT,
                        generated_at DATETIME,
                        created_by TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        });
    });

    afterAll(() => db.close());

    beforeEach(async () => {
        await new Promise<void>((resolve) => {
            db.run('DELETE FROM reports', () => resolve());
        });
    });

    describe('Report Generation', () => {
        it('should create report request', async () => {
            const reportId = `rpt-${Date.now()}`;
            const params = { dateRange: '2026-01-01/2026-01-31', metrics: ['revenue', 'users'] };

            await new Promise<void>((resolve, reject) => {
                db.run(
                    'INSERT INTO reports (id, organization_id, report_type, title, parameters, created_by) VALUES (?, ?, ?, ?, ?, ?)',
                    [reportId, 'org-123', 'monthly_summary', 'January 2026 Report', JSON.stringify(params), 'user-admin'],
                    (err) => err ? reject(err) : resolve()
                );
            });

            const report = await new Promise<any>((resolve, reject) => {
                db.get('SELECT * FROM reports WHERE id = ?', [reportId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(report).toBeDefined();
            expect(report.report_type).toBe('monthly_summary');
            expect(report.status).toBe('pending');
        });

        it('should complete report generation', async () => {
            const reportId = `rpt-${Date.now()}`;

            await new Promise<void>((resolve, reject) => {
                db.run(
                    'INSERT INTO reports (id, organization_id, report_type, title, status) VALUES (?, ?, ?, ?, ?)',
                    [reportId, 'org-123', 'analytics', 'Analytics Report', 'processing'],
                    (err) => err ? reject(err) : resolve()
                );
            });

            await new Promise<void>((resolve, reject) => {
                db.run(
                    'UPDATE reports SET status = ?, file_path = ?, generated_at = datetime("now") WHERE id = ?',
                    ['completed', '/reports/rpt-123.pdf', reportId],
                    (err) => err ? reject(err) : resolve()
                );
            });

            const report = await new Promise<any>((resolve, reject) => {
                db.get('SELECT * FROM reports WHERE id = ?', [reportId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(report.status).toBe('completed');
            expect(report.file_path).toBe('/reports/rpt-123.pdf');
        });
    });

    describe('Report Queries', () => {
        it('should list reports by organization', async () => {
            await new Promise<void>((resolve, reject) => {
                db.serialize(() => {
                    db.run('INSERT INTO reports (id, organization_id, report_type, title) VALUES (?, ?, ?, ?)',
                        ['r1', 'org-A', 'summary', 'Report 1']);
                    db.run('INSERT INTO reports (id, organization_id, report_type, title) VALUES (?, ?, ?, ?)',
                        ['r2', 'org-A', 'analytics', 'Report 2']);
                    db.run('INSERT INTO reports (id, organization_id, report_type, title) VALUES (?, ?, ?, ?)',
                        ['r3', 'org-B', 'summary', 'Report 3'], (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                });
            });

            const orgAReports = await new Promise<any[]>((resolve, reject) => {
                db.all('SELECT * FROM reports WHERE organization_id = ?', ['org-A'], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            expect(orgAReports).toHaveLength(2);
        });
    });
});
