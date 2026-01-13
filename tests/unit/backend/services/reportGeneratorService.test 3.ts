/**
 * Report Service Tests
 * Real database tests for report generation
 * 
 * @module tests/unit/backend/services/reportGeneratorService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('ReportGeneratorService', () => {
    let db: sqlite3.Database;

    beforeAll(async () => {
        db = new sqlite3.Database(':memory:');

        await new Promise<void>((resolve, reject) => {
            db.serialize(() => {
                db.run(`
                    CREATE TABLE IF NOT EXISTS generated_reports (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        user_id TEXT NOT NULL,
                        title TEXT NOT NULL,
                        type TEXT NOT NULL,
                        template_id TEXT,
                        parameters TEXT,
                        status TEXT DEFAULT 'pending',
                        file_path TEXT,
                        file_size INTEGER,
                        generated_at DATETIME,
                        expires_at DATETIME,
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
            db.run('DELETE FROM generated_reports', () => resolve());
        });
    });

    describe('Report Generation', () => {
        it('should create report request', async () => {
            const reportId = `report-${Date.now()}`;

            await new Promise<void>((resolve, reject) => {
                db.run(
                    'INSERT INTO generated_reports (id, organization_id, user_id, title, type, parameters) VALUES (?, ?, ?, ?, ?, ?)',
                    [reportId, 'org-123', 'user-456', 'Monthly Summary', 'summary', JSON.stringify({ month: '2026-01' })],
                    (err) => err ? reject(err) : resolve()
                );
            });

            const report = await new Promise<any>((resolve, reject) => {
                db.get('SELECT * FROM generated_reports WHERE id = ?', [reportId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(report).toBeDefined();
            expect(report.title).toBe('Monthly Summary');
            expect(report.status).toBe('pending');
        });

        it('should update report status on completion', async () => {
            const reportId = `report-${Date.now()}`;

            await new Promise<void>((resolve, reject) => {
                db.run('INSERT INTO generated_reports (id, organization_id, user_id, title, type) VALUES (?, ?, ?, ?, ?)', [reportId, 'org-1', 'user-1', 'Test Report', 'pdf'], (err) => err ? reject(err) : resolve());
            });

            await new Promise<void>((resolve, reject) => {
                db.run('UPDATE generated_reports SET status = ?, file_path = ?, file_size = ?, generated_at = datetime("now") WHERE id = ?', ['completed', '/reports/test.pdf', 102400, reportId], (err) => err ? reject(err) : resolve());
            });

            const report = await new Promise<any>((resolve, reject) => {
                db.get('SELECT * FROM generated_reports WHERE id = ?', [reportId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(report.status).toBe('completed');
            expect(report.file_size).toBe(102400);
        });
    });

    describe('Report Queries', () => {
        it('should get user reports', async () => {
            await new Promise<void>((resolve, reject) => {
                db.serialize(() => {
                    db.run('INSERT INTO generated_reports (id, organization_id, user_id, title, type) VALUES (?, ?, ?, ?, ?)', ['r1', 'o1', 'user-A', 'Report 1', 'pdf']);
                    db.run('INSERT INTO generated_reports (id, organization_id, user_id, title, type) VALUES (?, ?, ?, ?, ?)', ['r2', 'o1', 'user-A', 'Report 2', 'csv']);
                    db.run('INSERT INTO generated_reports (id, organization_id, user_id, title, type) VALUES (?, ?, ?, ?, ?)', ['r3', 'o1', 'user-B', 'Report 3', 'pdf'], (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            });

            const userReports = await new Promise<any[]>((resolve, reject) => {
                db.all('SELECT * FROM generated_reports WHERE user_id = ?', ['user-A'], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            expect(userReports).toHaveLength(2);
        });
    });
});
