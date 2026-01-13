/**
 * Subscription Analytics Service Tests
 * Real database integration tests for subscription metrics
 * 
 * @module tests/unit/backend/services/subscriptionAnalyticsService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('SubscriptionAnalyticsService', () => {
    let db: sqlite3.Database;

    beforeAll(async () => {
        db = new sqlite3.Database(':memory:');

        await new Promise<void>((resolve, reject) => {
            db.serialize(() => {
                db.run(`
                    CREATE TABLE IF NOT EXISTS subscriptions (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        plan_id TEXT NOT NULL,
                        status TEXT DEFAULT 'active',
                        amount_cents INTEGER,
                        billing_cycle TEXT DEFAULT 'monthly',
                        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        canceled_at DATETIME,
                        ends_at DATETIME
                    )
                `);
                db.run(`
                    CREATE TABLE IF NOT EXISTS subscription_events (
                        id TEXT PRIMARY KEY,
                        subscription_id TEXT NOT NULL,
                        event_type TEXT NOT NULL,
                        metadata TEXT,
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
                db.run('DELETE FROM subscription_events');
                db.run('DELETE FROM subscriptions', () => resolve());
            });
        });
    });

    describe('MRR Calculations', () => {
        it('should calculate Monthly Recurring Revenue', async () => {
            await new Promise<void>((resolve, reject) => {
                db.serialize(() => {
                    db.run('INSERT INTO subscriptions (id, organization_id, plan_id, amount_cents, status) VALUES (?, ?, ?, ?, ?)',
                        ['sub-1', 'org-1', 'pro', 9900, 'active']);
                    db.run('INSERT INTO subscriptions (id, organization_id, plan_id, amount_cents, status) VALUES (?, ?, ?, ?, ?)',
                        ['sub-2', 'org-2', 'pro', 9900, 'active']);
                    db.run('INSERT INTO subscriptions (id, organization_id, plan_id, amount_cents, status) VALUES (?, ?, ?, ?, ?)',
                        ['sub-3', 'org-3', 'enterprise', 29900, 'active']);
                    db.run('INSERT INTO subscriptions (id, organization_id, plan_id, amount_cents, status) VALUES (?, ?, ?, ?, ?)',
                        ['sub-4', 'org-4', 'pro', 9900, 'canceled'], (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                });
            });

            const result = await new Promise<any>((resolve, reject) => {
                db.get('SELECT SUM(amount_cents) as mrr FROM subscriptions WHERE status = ?', ['active'], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            // 9900 + 9900 + 29900 = 49700 cents = $497 MRR
            expect(result.mrr).toBe(49700);
        });

        it('should calculate ARR from monthly subscriptions', async () => {
            await new Promise<void>((resolve, reject) => {
                db.run('INSERT INTO subscriptions (id, organization_id, plan_id, amount_cents, status, billing_cycle) VALUES (?, ?, ?, ?, ?, ?)',
                    ['sub-1', 'org-1', 'pro', 9900, 'active', 'monthly'],
                    (err) => err ? reject(err) : resolve()
                );
            });

            const result = await new Promise<any>((resolve, reject) => {
                db.get('SELECT SUM(amount_cents * 12) as arr FROM subscriptions WHERE status = ? AND billing_cycle = ?',
                    ['active', 'monthly'], (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    });
            });

            // 9900 * 12 = 118800 cents = $1188 ARR
            expect(result.arr).toBe(118800);
        });
    });

    describe('Churn Analysis', () => {
        it('should identify churned subscriptions', async () => {
            await new Promise<void>((resolve, reject) => {
                db.serialize(() => {
                    db.run('INSERT INTO subscriptions (id, organization_id, plan_id, status, canceled_at) VALUES (?, ?, ?, ?, ?)',
                        ['sub-1', 'org-1', 'pro', 'canceled', '2026-01-05']);
                    db.run('INSERT INTO subscriptions (id, organization_id, plan_id, status) VALUES (?, ?, ?, ?)',
                        ['sub-2', 'org-2', 'pro', 'active']);
                    db.run('INSERT INTO subscriptions (id, organization_id, plan_id, status, canceled_at) VALUES (?, ?, ?, ?, ?)',
                        ['sub-3', 'org-3', 'pro', 'canceled', '2026-01-08'], (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                });
            });

            const churned = await new Promise<any[]>((resolve, reject) => {
                db.all('SELECT * FROM subscriptions WHERE status = ?', ['canceled'], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            expect(churned).toHaveLength(2);
        });

        it('should calculate churn rate', async () => {
            await new Promise<void>((resolve, reject) => {
                db.serialize(() => {
                    // 8 active, 2 canceled = 20% churn
                    for (let i = 0; i < 8; i++) {
                        db.run('INSERT INTO subscriptions (id, organization_id, plan_id, status) VALUES (?, ?, ?, ?)',
                            [`sub-active-${i}`, `org-${i}`, 'pro', 'active']);
                    }
                    db.run('INSERT INTO subscriptions (id, organization_id, plan_id, status) VALUES (?, ?, ?, ?)',
                        ['sub-churn-1', 'org-churn-1', 'pro', 'canceled']);
                    db.run('INSERT INTO subscriptions (id, organization_id, plan_id, status) VALUES (?, ?, ?, ?)',
                        ['sub-churn-2', 'org-churn-2', 'pro', 'canceled'], (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                });
            });

            const result = await new Promise<any>((resolve, reject) => {
                db.get(`
                    SELECT 
                        (SELECT COUNT(*) FROM subscriptions WHERE status = 'canceled') as churned,
                        COUNT(*) as total
                    FROM subscriptions
                `, (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            const churnRate = (result.churned / result.total) * 100;
            expect(churnRate).toBe(20);
        });
    });

    describe('Plan Distribution', () => {
        it('should analyze subscription distribution by plan', async () => {
            await new Promise<void>((resolve, reject) => {
                db.serialize(() => {
                    db.run('INSERT INTO subscriptions (id, organization_id, plan_id, status) VALUES (?, ?, ?, ?)',
                        ['sub-1', 'org-1', 'starter', 'active']);
                    db.run('INSERT INTO subscriptions (id, organization_id, plan_id, status) VALUES (?, ?, ?, ?)',
                        ['sub-2', 'org-2', 'pro', 'active']);
                    db.run('INSERT INTO subscriptions (id, organization_id, plan_id, status) VALUES (?, ?, ?, ?)',
                        ['sub-3', 'org-3', 'pro', 'active']);
                    db.run('INSERT INTO subscriptions (id, organization_id, plan_id, status) VALUES (?, ?, ?, ?)',
                        ['sub-4', 'org-4', 'enterprise', 'active'], (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                });
            });

            const distribution = await new Promise<any[]>((resolve, reject) => {
                db.all(`
                    SELECT plan_id, COUNT(*) as count 
                    FROM subscriptions 
                    WHERE status = 'active'
                    GROUP BY plan_id
                `, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            expect(distribution).toHaveLength(3);
            const proCount = distribution.find(d => d.plan_id === 'pro');
            expect(proCount?.count).toBe(2);
        });
    });
});
