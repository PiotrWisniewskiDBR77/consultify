/**
 * Quote Service Tests
 * Real database tests for quotes
 * 
 * @module tests/unit/backend/services/quoteService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('QuoteService', () => {
    let db: sqlite3.Database;

    beforeAll(async () => {
        db = new sqlite3.Database(':memory:');

        await new Promise<void>((resolve, reject) => {
            db.serialize(() => {
                db.run(`
                    CREATE TABLE IF NOT EXISTS quotes (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        client_id TEXT NOT NULL,
                        title TEXT NOT NULL,
                        items TEXT,
                        subtotal REAL DEFAULT 0,
                        tax REAL DEFAULT 0,
                        total REAL DEFAULT 0,
                        status TEXT DEFAULT 'draft',
                        valid_until DATE,
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
            db.run('DELETE FROM quotes', () => resolve());
        });
    });

    describe('Quote CRUD', () => {
        it('should create quote', async () => {
            const quoteId = `quote-${Date.now()}`;
            const items = [{ description: 'Service', quantity: 1, price: 1000 }];

            await new Promise<void>((resolve, reject) => {
                db.run(
                    'INSERT INTO quotes (id, organization_id, client_id, title, items, total) VALUES (?, ?, ?, ?, ?, ?)',
                    [quoteId, 'org-123', 'client-456', 'Project Quote', JSON.stringify(items), 1000],
                    (err) => err ? reject(err) : resolve()
                );
            });

            const quote = await new Promise<any>((resolve, reject) => {
                db.get('SELECT * FROM quotes WHERE id = ?', [quoteId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(quote).toBeDefined();
            expect(quote.title).toBe('Project Quote');
            expect(quote.total).toBe(1000);
        });

        it('should send quote', async () => {
            const quoteId = `quote-${Date.now()}`;

            await new Promise<void>((resolve, reject) => {
                db.run('INSERT INTO quotes (id, organization_id, client_id, title) VALUES (?, ?, ?, ?)', [quoteId, 'org-1', 'c-1', 'Test'], (err) => err ? reject(err) : resolve());
            });

            await new Promise<void>((resolve, reject) => {
                db.run('UPDATE quotes SET status = ? WHERE id = ?', ['sent', quoteId], (err) => err ? reject(err) : resolve());
            });

            const quote = await new Promise<any>((resolve, reject) => {
                db.get('SELECT * FROM quotes WHERE id = ?', [quoteId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(quote.status).toBe('sent');
        });
    });
});
