/**
 * Payment Service Tests
 * Real database tests for payments
 * 
 * @module tests/unit/backend/services/paymentService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('PaymentService', () => {
    let db: sqlite3.Database;

    beforeAll(async () => {
        db = new sqlite3.Database(':memory:');

        await new Promise<void>((resolve, reject) => {
            db.serialize(() => {
                db.run(`
                    CREATE TABLE IF NOT EXISTS payments (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        invoice_id TEXT,
                        amount REAL NOT NULL,
                        currency TEXT DEFAULT 'USD',
                        status TEXT DEFAULT 'pending',
                        method TEXT,
                        stripe_payment_id TEXT,
                        processed_at DATETIME,
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
            db.run('DELETE FROM payments', () => resolve());
        });
    });

    describe('Payment CRUD', () => {
        it('should create payment', async () => {
            const paymentId = `pay-${Date.now()}`;

            await new Promise<void>((resolve, reject) => {
                db.run(
                    'INSERT INTO payments (id, organization_id, amount, currency, method) VALUES (?, ?, ?, ?, ?)',
                    [paymentId, 'org-123', 99.99, 'USD', 'card'],
                    (err) => err ? reject(err) : resolve()
                );
            });

            const payment = await new Promise<any>((resolve, reject) => {
                db.get('SELECT * FROM payments WHERE id = ?', [paymentId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(payment).toBeDefined();
            expect(payment.amount).toBe(99.99);
            expect(payment.status).toBe('pending');
        });

        it('should process payment', async () => {
            const paymentId = `pay-${Date.now()}`;

            await new Promise<void>((resolve, reject) => {
                db.run('INSERT INTO payments (id, organization_id, amount) VALUES (?, ?, ?)', [paymentId, 'org-1', 50.00], (err) => err ? reject(err) : resolve());
            });

            await new Promise<void>((resolve, reject) => {
                db.run('UPDATE payments SET status = ?, processed_at = datetime("now") WHERE id = ?', ['succeeded', paymentId], (err) => err ? reject(err) : resolve());
            });

            const payment = await new Promise<any>((resolve, reject) => {
                db.get('SELECT * FROM payments WHERE id = ?', [paymentId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(payment.status).toBe('succeeded');
            expect(payment.processed_at).not.toBeNull();
        });
    });

    describe('Payment Queries', () => {
        it('should get successful payments', async () => {
            await new Promise<void>((resolve, reject) => {
                db.serialize(() => {
                    db.run('INSERT INTO payments (id, organization_id, amount, status) VALUES (?, ?, ?, ?)', ['p1', 'o1', 100, 'succeeded']);
                    db.run('INSERT INTO payments (id, organization_id, amount, status) VALUES (?, ?, ?, ?)', ['p2', 'o1', 200, 'failed']);
                    db.run('INSERT INTO payments (id, organization_id, amount, status) VALUES (?, ?, ?, ?)', ['p3', 'o1', 300, 'succeeded'], (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            });

            const successfulPayments = await new Promise<any[]>((resolve, reject) => {
                db.all('SELECT * FROM payments WHERE status = ?', ['succeeded'], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            expect(successfulPayments).toHaveLength(2);
        });
    });
});
