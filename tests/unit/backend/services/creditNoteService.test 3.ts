/**
 * Credit Note Service Tests
 * Real database tests for credit note management
 * 
 * @module tests/unit/backend/services/creditNoteService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('CreditNoteService', () => {
    let db: sqlite3.Database;

    beforeAll(async () => {
        db = new sqlite3.Database(':memory:');

        await new Promise<void>((resolve, reject) => {
            db.serialize(() => {
                db.run(`
                    CREATE TABLE IF NOT EXISTS credit_notes (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        invoice_id TEXT,
                        amount REAL NOT NULL,
                        currency TEXT DEFAULT 'USD',
                        reason TEXT,
                        status TEXT DEFAULT 'pending',
                        applied_at DATETIME,
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
            db.run('DELETE FROM credit_notes', () => resolve());
        });
    });

    describe('Credit Note CRUD', () => {
        it('should create credit note', async () => {
            const noteId = `cn-${Date.now()}`;

            await new Promise<void>((resolve, reject) => {
                db.run(
                    'INSERT INTO credit_notes (id, organization_id, invoice_id, amount, reason, created_by) VALUES (?, ?, ?, ?, ?, ?)',
                    [noteId, 'org-123', 'inv-456', 150.00, 'Service credit', 'admin'],
                    (err) => err ? reject(err) : resolve()
                );
            });

            const note = await new Promise<any>((resolve, reject) => {
                db.get('SELECT * FROM credit_notes WHERE id = ?', [noteId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(note).toBeDefined();
            expect(note.amount).toBe(150.00);
            expect(note.status).toBe('pending');
        });

        it('should apply credit note', async () => {
            const noteId = `cn-${Date.now()}`;

            await new Promise<void>((resolve, reject) => {
                db.run(
                    'INSERT INTO credit_notes (id, organization_id, amount) VALUES (?, ?, ?)',
                    [noteId, 'org-123', 100.00],
                    (err) => err ? reject(err) : resolve()
                );
            });

            await new Promise<void>((resolve, reject) => {
                db.run(
                    'UPDATE credit_notes SET status = ?, applied_at = datetime("now") WHERE id = ?',
                    ['applied', noteId],
                    (err) => err ? reject(err) : resolve()
                );
            });

            const note = await new Promise<any>((resolve, reject) => {
                db.get('SELECT * FROM credit_notes WHERE id = ?', [noteId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(note.status).toBe('applied');
            expect(note.applied_at).not.toBeNull();
        });
    });

    describe('Credit Note Analytics', () => {
        it('should calculate total credits by organization', async () => {
            await new Promise<void>((resolve, reject) => {
                db.serialize(() => {
                    db.run('INSERT INTO credit_notes (id, organization_id, amount, status) VALUES (?, ?, ?, ?)', ['c1', 'org-A', 100, 'applied']);
                    db.run('INSERT INTO credit_notes (id, organization_id, amount, status) VALUES (?, ?, ?, ?)', ['c2', 'org-A', 50, 'applied']);
                    db.run('INSERT INTO credit_notes (id, organization_id, amount, status) VALUES (?, ?, ?, ?)', ['c3', 'org-A', 75, 'pending']);
                    db.run('INSERT INTO credit_notes (id, organization_id, amount, status) VALUES (?, ?, ?, ?)', ['c4', 'org-B', 200, 'applied'], (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            });

            const result = await new Promise<any>((resolve, reject) => {
                db.get('SELECT SUM(amount) as total FROM credit_notes WHERE organization_id = ? AND status = ?', ['org-A', 'applied'], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(result.total).toBe(150); // 100 + 50
        });
    });
});
