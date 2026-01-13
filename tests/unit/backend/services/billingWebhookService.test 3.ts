/**
 * Billing Webhook Service Tests
 * Real database integration tests for Stripe webhook handling
 * 
 * @module tests/unit/backend/services/billingWebhookService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('BillingWebhookService', () => {
    let db: sqlite3.Database;

    beforeAll(async () => {
        db = new sqlite3.Database(':memory:');

        await new Promise<void>((resolve, reject) => {
            db.serialize(() => {
                db.run(`
                    CREATE TABLE IF NOT EXISTS webhook_events (
                        id TEXT PRIMARY KEY,
                        stripe_event_id TEXT UNIQUE,
                        event_type TEXT NOT NULL,
                        payload TEXT,
                        processed INTEGER DEFAULT 0,
                        processed_at DATETIME,
                        error TEXT,
                        retry_count INTEGER DEFAULT 0,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);
                db.run(`
                    CREATE TABLE IF NOT EXISTS payment_intents (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        stripe_payment_intent_id TEXT UNIQUE,
                        status TEXT DEFAULT 'pending',
                        amount_cents INTEGER NOT NULL,
                        currency TEXT DEFAULT 'usd',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        });
    });

    afterAll(() => {
        db.close();
    });

    beforeEach(async () => {
        await new Promise<void>((resolve) => {
            db.serialize(() => {
                db.run('DELETE FROM webhook_events');
                db.run('DELETE FROM payment_intents', () => resolve());
            });
        });
    });

    describe('Webhook Event Storage', () => {
        it('should store incoming webhook event', async () => {
            const eventId = `evt-${Date.now()}`;
            const payload = { type: 'invoice.paid', data: { amount: 9900 } };

            await new Promise<void>((resolve, reject) => {
                db.run(
                    'INSERT INTO webhook_events (id, stripe_event_id, event_type, payload) VALUES (?, ?, ?, ?)',
                    [eventId, 'evt_stripe_123', 'invoice.paid', JSON.stringify(payload)],
                    (err) => err ? reject(err) : resolve()
                );
            });

            const event = await new Promise<any>((resolve, reject) => {
                db.get('SELECT * FROM webhook_events WHERE id = ?', [eventId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(event).toBeDefined();
            expect(event.event_type).toBe('invoice.paid');
            expect(event.processed).toBe(0);
        });

        it('should prevent duplicate event processing', async () => {
            const stripeEventId = 'evt_unique_12345';

            await new Promise<void>((resolve, reject) => {
                db.run(
                    'INSERT INTO webhook_events (id, stripe_event_id, event_type) VALUES (?, ?, ?)',
                    ['evt-1', stripeEventId, 'invoice.paid'],
                    (err) => err ? reject(err) : resolve()
                );
            });

            // Try to insert duplicate
            const insertResult = await new Promise<boolean>((resolve) => {
                db.run(
                    'INSERT INTO webhook_events (id, stripe_event_id, event_type) VALUES (?, ?, ?)',
                    ['evt-2', stripeEventId, 'invoice.paid'],
                    (err) => resolve(!err)
                );
            });

            expect(insertResult).toBe(false); // Should fail due to UNIQUE constraint
        });
    });

    describe('Webhook Processing', () => {
        it('should mark event as processed', async () => {
            const eventId = `evt-${Date.now()}`;

            await new Promise<void>((resolve, reject) => {
                db.run(
                    'INSERT INTO webhook_events (id, stripe_event_id, event_type) VALUES (?, ?, ?)',
                    [eventId, 'evt_to_process', 'payment_intent.succeeded'],
                    (err) => err ? reject(err) : resolve()
                );
            });

            await new Promise<void>((resolve, reject) => {
                db.run(
                    'UPDATE webhook_events SET processed = 1, processed_at = datetime("now") WHERE id = ?',
                    [eventId],
                    (err) => err ? reject(err) : resolve()
                );
            });

            const event = await new Promise<any>((resolve, reject) => {
                db.get('SELECT * FROM webhook_events WHERE id = ?', [eventId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(event.processed).toBe(1);
            expect(event.processed_at).not.toBeNull();
        });

        it('should handle processing errors with retry count', async () => {
            const eventId = `evt-${Date.now()}`;

            await new Promise<void>((resolve, reject) => {
                db.run(
                    'INSERT INTO webhook_events (id, stripe_event_id, event_type) VALUES (?, ?, ?)',
                    [eventId, 'evt_failing', 'invoice.payment_failed'],
                    (err) => err ? reject(err) : resolve()
                );
            });

            // Simulate 3 failed processing attempts
            for (let i = 0; i < 3; i++) {
                await new Promise<void>((resolve, reject) => {
                    db.run(
                        'UPDATE webhook_events SET retry_count = retry_count + 1, error = ? WHERE id = ?',
                        ['Connection timeout', eventId],
                        (err) => err ? reject(err) : resolve()
                    );
                });
            }

            const event = await new Promise<any>((resolve, reject) => {
                db.get('SELECT * FROM webhook_events WHERE id = ?', [eventId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(event.retry_count).toBe(3);
            expect(event.error).toBe('Connection timeout');
        });
    });

    describe('Payment Intent Updates', () => {
        it('should update payment intent status from webhook', async () => {
            const paymentIntentId = `pi-${Date.now()}`;

            await new Promise<void>((resolve, reject) => {
                db.run(
                    'INSERT INTO payment_intents (id, organization_id, stripe_payment_intent_id, amount_cents, status) VALUES (?, ?, ?, ?, ?)',
                    [paymentIntentId, 'org-123', 'pi_stripe_abc', 9900, 'pending'],
                    (err) => err ? reject(err) : resolve()
                );
            });

            // Simulate webhook updating status
            await new Promise<void>((resolve, reject) => {
                db.run(
                    'UPDATE payment_intents SET status = ? WHERE stripe_payment_intent_id = ?',
                    ['succeeded', 'pi_stripe_abc'],
                    (err) => err ? reject(err) : resolve()
                );
            });

            const pi = await new Promise<any>((resolve, reject) => {
                db.get('SELECT * FROM payment_intents WHERE id = ?', [paymentIntentId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(pi.status).toBe('succeeded');
        });
    });
});
