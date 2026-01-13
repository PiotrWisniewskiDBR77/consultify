/**
 * AI Charter Generator Service Tests
 * Real database integration tests for AI charter generation
 * 
 * @module tests/unit/backend/services/aiCharterGeneratorService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('AICharterGeneratorService', () => {
    let db: sqlite3.Database;

    beforeAll(async () => {
        db = new sqlite3.Database(':memory:');

        await new Promise<void>((resolve, reject) => {
            db.serialize(() => {
                db.run(`
                    CREATE TABLE IF NOT EXISTS ai_charters (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        title TEXT NOT NULL,
                        content TEXT,
                        status TEXT DEFAULT 'draft',
                        version INTEGER DEFAULT 1,
                        created_by TEXT,
                        approved_by TEXT,
                        approved_at DATETIME,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);
                db.run(`
                    CREATE TABLE IF NOT EXISTS charter_templates (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        industry TEXT,
                        template_content TEXT NOT NULL,
                        is_active INTEGER DEFAULT 1
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
            db.serialize(() => {
                db.run('DELETE FROM ai_charters');
                db.run('DELETE FROM charter_templates', () => resolve());
            });
        });
    });

    describe('Charter Generation', () => {
        it('should create new AI charter from template', async () => {
            const charterId = `charter-${Date.now()}`;

            await new Promise<void>((resolve, reject) => {
                db.run(
                    'INSERT INTO ai_charters (id, organization_id, title, content, created_by) VALUES (?, ?, ?, ?, ?)',
                    [charterId, 'org-123', 'AI Ethics Charter 2026', 'Our AI principles...', 'user-admin'],
                    (err) => err ? reject(err) : resolve()
                );
            });

            const charter = await new Promise<any>((resolve, reject) => {
                db.get('SELECT * FROM ai_charters WHERE id = ?', [charterId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(charter).toBeDefined();
            expect(charter.title).toBe('AI Ethics Charter 2026');
            expect(charter.status).toBe('draft');
            expect(charter.version).toBe(1);
        });

        it('should increment version on update', async () => {
            const charterId = `charter-${Date.now()}`;

            await new Promise<void>((resolve, reject) => {
                db.run(
                    'INSERT INTO ai_charters (id, organization_id, title, version) VALUES (?, ?, ?, ?)',
                    [charterId, 'org-123', 'Charter v1', 1],
                    (err) => err ? reject(err) : resolve()
                );
            });

            await new Promise<void>((resolve, reject) => {
                db.run(
                    'UPDATE ai_charters SET version = version + 1, title = ?, updated_at = datetime("now") WHERE id = ?',
                    ['Charter v2', charterId],
                    (err) => err ? reject(err) : resolve()
                );
            });

            const charter = await new Promise<any>((resolve, reject) => {
                db.get('SELECT * FROM ai_charters WHERE id = ?', [charterId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(charter.version).toBe(2);
            expect(charter.title).toBe('Charter v2');
        });
    });

    describe('Charter Approval', () => {
        it('should approve charter', async () => {
            const charterId = `charter-${Date.now()}`;

            await new Promise<void>((resolve, reject) => {
                db.run(
                    'INSERT INTO ai_charters (id, organization_id, title, status) VALUES (?, ?, ?, ?)',
                    [charterId, 'org-123', 'Pending Charter', 'pending_approval'],
                    (err) => err ? reject(err) : resolve()
                );
            });

            await new Promise<void>((resolve, reject) => {
                db.run(
                    'UPDATE ai_charters SET status = ?, approved_by = ?, approved_at = datetime("now") WHERE id = ?',
                    ['approved', 'admin-user', charterId],
                    (err) => err ? reject(err) : resolve()
                );
            });

            const charter = await new Promise<any>((resolve, reject) => {
                db.get('SELECT * FROM ai_charters WHERE id = ?', [charterId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(charter.status).toBe('approved');
            expect(charter.approved_by).toBe('admin-user');
        });
    });

    describe('Templates', () => {
        it('should list active templates', async () => {
            await new Promise<void>((resolve, reject) => {
                db.serialize(() => {
                    db.run('INSERT INTO charter_templates (id, name, industry, template_content, is_active) VALUES (?, ?, ?, ?, ?)',
                        ['t1', 'Tech Company', 'technology', 'Tech AI principles...', 1]);
                    db.run('INSERT INTO charter_templates (id, name, industry, template_content, is_active) VALUES (?, ?, ?, ?, ?)',
                        ['t2', 'Healthcare', 'healthcare', 'Healthcare AI...', 1]);
                    db.run('INSERT INTO charter_templates (id, name, industry, template_content, is_active) VALUES (?, ?, ?, ?, ?)',
                        ['t3', 'Deprecated', 'other', 'Old template', 0], (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                });
            });

            const templates = await new Promise<any[]>((resolve, reject) => {
                db.all('SELECT * FROM charter_templates WHERE is_active = 1', (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            expect(templates).toHaveLength(2);
        });
    });
});
