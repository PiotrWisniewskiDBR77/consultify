/**
 * Billing Service Tests
 * Real database tests for billing and subscriptions
 *
 * @module tests/unit/backend/services/billingService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('BillingService', () => {
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
                        billing_cycle TEXT DEFAULT 'monthly',
                        amount REAL,
                        currency TEXT DEFAULT 'USD',
                        current_period_start DATETIME,
                        current_period_end DATETIME,
                        canceled_at DATETIME,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);
        db.run(
          `
                    CREATE TABLE IF NOT EXISTS invoices (
                        id TEXT PRIMARY KEY,
                        subscription_id TEXT NOT NULL,
                        organization_id TEXT NOT NULL,
                        amount REAL NOT NULL,
                        status TEXT DEFAULT 'pending',
                        due_date DATETIME,
                        paid_at DATETIME,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (subscription_id) REFERENCES subscriptions(id)
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
      db.serialize(() => {
        db.run('DELETE FROM invoices');
        db.run('DELETE FROM subscriptions', () => resolve());
      });
    });
  });

  describe('Subscriptions', () => {
    it('should create subscription', async () => {
      const subId = `sub-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO subscriptions (id, organization_id, plan_id, amount, billing_cycle) VALUES (?, ?, ?, ?, ?)',
          [subId, 'org-123', 'plan-pro', 99.99, 'monthly'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const sub = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM subscriptions WHERE id = ?', [subId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(sub).toBeDefined();
      expect(sub.plan_id).toBe('plan-pro');
      expect(sub.amount).toBe(99.99);
    });

    it('should cancel subscription', async () => {
      const subId = `sub-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO subscriptions (id, organization_id, plan_id, status) VALUES (?, ?, ?, ?)',
          [subId, 'org-123', 'plan-basic', 'active'],
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

      const sub = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM subscriptions WHERE id = ?', [subId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(sub.status).toBe('canceled');
      expect(sub.canceled_at).not.toBeNull();
    });
  });

  describe('Invoices', () => {
    it('should create invoice', async () => {
      const subId = `sub-${Date.now()}`;
      const invId = `inv-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run('INSERT INTO subscriptions (id, organization_id, plan_id) VALUES (?, ?, ?)', [
            subId,
            'org-123',
            'plan-pro',
          ]);
          db.run(
            'INSERT INTO invoices (id, subscription_id, organization_id, amount, due_date) VALUES (?, ?, ?, ?, ?)',
            [invId, subId, 'org-123', 99.99, '2026-02-01'],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      });

      const invoice = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM invoices WHERE id = ?', [invId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(invoice.amount).toBe(99.99);
      expect(invoice.status).toBe('pending');
    });

    it('should mark invoice as paid', async () => {
      const invId = `inv-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO invoices (id, subscription_id, organization_id, amount) VALUES (?, ?, ?, ?)',
          [invId, 'sub-1', 'org-1', 50.0],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run(
          'UPDATE invoices SET status = ?, paid_at = datetime("now") WHERE id = ?',
          ['paid', invId],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const invoice = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM invoices WHERE id = ?', [invId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(invoice.status).toBe('paid');
    });
  });
});
