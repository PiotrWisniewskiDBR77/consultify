/**
 * Approval Pattern Service Tests
 * Real database tests for approval workflows
 * 
 * @module tests/unit/backend/services/approvalPatternService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('ApprovalPatternService', () => {
    let db: sqlite3.Database;

    beforeAll(async () => {
        db = new sqlite3.Database(':memory:');

        await new Promise<void>((resolve, reject) => {
            db.serialize(() => {
                db.run(`
                    CREATE TABLE IF NOT EXISTS approval_patterns (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        name TEXT NOT NULL,
                        pattern_type TEXT NOT NULL,
                        approvers TEXT,
                        min_approvals INTEGER DEFAULT 1,
                        require_all INTEGER DEFAULT 0,
                        auto_approve_threshold REAL,
                        is_active INTEGER DEFAULT 1,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);
                db.run(`
                    CREATE TABLE IF NOT EXISTS approval_requests (
                        id TEXT PRIMARY KEY,
                        pattern_id TEXT NOT NULL,
                        request_type TEXT,
                        requestor_id TEXT,
                        status TEXT DEFAULT 'pending',
                        approved_by TEXT,
                        rejected_by TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (pattern_id) REFERENCES approval_patterns(id)
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
                db.run('DELETE FROM approval_requests');
                db.run('DELETE FROM approval_patterns', () => resolve());
            });
        });
    });

    describe('Pattern Configuration', () => {
        it('should create approval pattern', async () => {
            const patternId = `pattern-${Date.now()}`;
            const approvers = ['manager-1', 'manager-2', 'director-1'];

            await new Promise<void>((resolve, reject) => {
                db.run(
                    'INSERT INTO approval_patterns (id, organization_id, name, pattern_type, approvers, min_approvals) VALUES (?, ?, ?, ?, ?, ?)',
                    [patternId, 'org-123', 'Budget Approval', 'sequential', JSON.stringify(approvers), 2],
                    (err) => err ? reject(err) : resolve()
                );
            });

            const pattern = await new Promise<any>((resolve, reject) => {
                db.get('SELECT * FROM approval_patterns WHERE id = ?', [patternId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(pattern).toBeDefined();
            expect(pattern.name).toBe('Budget Approval');
            expect(pattern.min_approvals).toBe(2);
        });

        it('should configure auto-approval threshold', async () => {
            const patternId = `pattern-${Date.now()}`;

            await new Promise<void>((resolve, reject) => {
                db.run(
                    'INSERT INTO approval_patterns (id, organization_id, name, pattern_type, auto_approve_threshold) VALUES (?, ?, ?, ?, ?)',
                    [patternId, 'org-123', 'Small Expenses', 'auto', 500.00],
                    (err) => err ? reject(err) : resolve()
                );
            });

            const pattern = await new Promise<any>((resolve, reject) => {
                db.get('SELECT * FROM approval_patterns WHERE id = ?', [patternId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(pattern.auto_approve_threshold).toBe(500.00);
        });
    });

    describe('Approval Requests', () => {
        it('should create approval request', async () => {
            const patternId = `pattern-${Date.now()}`;

            await new Promise<void>((resolve, reject) => {
                db.run(
                    'INSERT INTO approval_patterns (id, organization_id, name, pattern_type) VALUES (?, ?, ?, ?)',
                    [patternId, 'org-123', 'Test Pattern', 'parallel'],
                    (err) => err ? reject(err) : resolve()
                );
            });

            await new Promise<void>((resolve, reject) => {
                db.run(
                    'INSERT INTO approval_requests (id, pattern_id, request_type, requestor_id) VALUES (?, ?, ?, ?)',
                    ['req-1', patternId, 'expense', 'user-123'],
                    (err) => err ? reject(err) : resolve()
                );
            });

            const request = await new Promise<any>((resolve, reject) => {
                db.get('SELECT * FROM approval_requests WHERE id = ?', ['req-1'], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(request.status).toBe('pending');
            expect(request.requestor_id).toBe('user-123');
        });

        it('should approve request', async () => {
            const patternId = `pattern-${Date.now()}`;

            await new Promise<void>((resolve, reject) => {
                db.serialize(() => {
                    db.run('INSERT INTO approval_patterns (id, organization_id, name, pattern_type) VALUES (?, ?, ?, ?)',
                        [patternId, 'org-123', 'Approval Test', 'simple']);
                    db.run('INSERT INTO approval_requests (id, pattern_id, requestor_id) VALUES (?, ?, ?)',
                        ['req-approve', patternId, 'user-456'], (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                });
            });

            await new Promise<void>((resolve, reject) => {
                db.run(
                    'UPDATE approval_requests SET status = ?, approved_by = ? WHERE id = ?',
                    ['approved', 'manager-1', 'req-approve'],
                    (err) => err ? reject(err) : resolve()
                );
            });

            const request = await new Promise<any>((resolve, reject) => {
                db.get('SELECT * FROM approval_requests WHERE id = ?', ['req-approve'], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(request.status).toBe('approved');
        });
    });
});
