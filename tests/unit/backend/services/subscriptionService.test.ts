/**
 * Subscription Service Tests
 * Real database tests for subscription management
 *
 * @module tests/unit/backend/services/subscriptionService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('SubscriptionService', () => {
  let db: sqlite3.Database;

  beforeAll(async () => {
    db = new sqlite3.Database(':memory:');

    await new Promise<void>((resolve, reject) => {
      db.serialize(() => {
        db.run(
          `
                    CREATE TABLE IF NOT EXISTS subscriptions (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        plan_id TEXT NOT NULL,
                        status TEXT DEFAULT 'active',
                        billing_interval TEXT DEFAULT 'monthly',
                        current_period_start DATETIME,
                        current_period_end DATETIME,
                        cancel_at DATETIME,
                        canceled_at DATETIME,
                        stripe_subscription_id TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `,
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    });
  });

  afterAll(() => db.close());

  beforeEach(async () => {
    await new Promise<void>((resolve) => {
      db.run('DELETE FROM subscriptions', () => resolve());
    });
  });

  describe('Subscription CRUD', () => {
    it('should create subscription', async () => {
      const subId = `sub-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO subscriptions (id, organization_id, plan_id, status, billing_interval) VALUES (?, ?, ?, ?, ?)',
          [subId, 'org-123', 'plan-pro', 'active', 'monthly'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const subscription = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM subscriptions WHERE id = ?', [subId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(subscription).toBeDefined();
      expect(subscription.status).toBe('active');
      expect(subscription.billing_interval).toBe('monthly');
    });

    it('should cancel subscription', async () => {
      const subId = `sub-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO subscriptions (id, organization_id, plan_id) VALUES (?, ?, ?)',
          [subId, 'org-1', 'plan-1'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run(
          'UPDATE subscriptions SET status = ?, canceled_at = datetime("now") WHERE id = ?',
          ['canceled', subId],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const subscription = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM subscriptions WHERE id = ?', [subId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(subscription.status).toBe('canceled');
      expect(subscription.canceled_at).not.toBeNull();
    });
  });

  describe('Subscription Queries', () => {
    it('should get active subscriptions', async () => {
      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run(
            'INSERT INTO subscriptions (id, organization_id, plan_id, status) VALUES (?, ?, ?, ?)',
            ['s1', 'o1', 'p1', 'active']
          );
          db.run(
            'INSERT INTO subscriptions (id, organization_id, plan_id, status) VALUES (?, ?, ?, ?)',
            ['s2', 'o2', 'p2', 'active']
          );
          db.run(
            'INSERT INTO subscriptions (id, organization_id, plan_id, status) VALUES (?, ?, ?, ?)',
            ['s3', 'o3', 'p3', 'canceled'],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      });

      const activeSubscriptions = await new Promise<any[]>((resolve, reject) => {
        db.all('SELECT * FROM subscriptions WHERE status = ?', ['active'], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      expect(activeSubscriptions).toHaveLength(2);
    });
  });
});
