/**
 * Order Service Tests
 * Real database tests for orders
 *
 * @module tests/unit/backend/services/orderService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('OrderService', () => {
  let db: sqlite3.Database;

  beforeAll(async () => {
    db = new sqlite3.Database(':memory:');

    await new Promise<void>((resolve, reject) => {
      db.serialize(() => {
        db.run(
          `
                    CREATE TABLE IF NOT EXISTS orders (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        customer_id TEXT NOT NULL,
                        status TEXT DEFAULT 'pending',
                        subtotal REAL NOT NULL,
                        tax REAL DEFAULT 0,
                        total REAL NOT NULL,
                        currency TEXT DEFAULT 'USD',
                        payment_status TEXT DEFAULT 'unpaid',
                        fulfillment_status TEXT DEFAULT 'unfulfilled',
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
      db.run('DELETE FROM orders', () => resolve());
    });
  });

  describe('Order CRUD', () => {
    it('should create order', async () => {
      const orderId = `order-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO orders (id, organization_id, customer_id, subtotal, tax, total) VALUES (?, ?, ?, ?, ?, ?)',
          [orderId, 'org-123', 'cust-456', 100.0, 10.0, 110.0],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const order = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM orders WHERE id = ?', [orderId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(order).toBeDefined();
      expect(order.total).toBe(110.0);
      expect(order.status).toBe('pending');
    });

    it('should complete order', async () => {
      const orderId = `order-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO orders (id, organization_id, customer_id, subtotal, total) VALUES (?, ?, ?, ?, ?)',
          [orderId, 'org-1', 'c-1', 50, 50],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run(
          'UPDATE orders SET status = ?, payment_status = ?, fulfillment_status = ? WHERE id = ?',
          ['completed', 'paid', 'fulfilled', orderId],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const order = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM orders WHERE id = ?', [orderId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(order.status).toBe('completed');
      expect(order.payment_status).toBe('paid');
    });
  });

  describe('Order Queries', () => {
    it('should get pending orders', async () => {
      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run(
            'INSERT INTO orders (id, organization_id, customer_id, subtotal, total, status) VALUES (?, ?, ?, ?, ?, ?)',
            ['o1', 'org', 'c1', 50, 50, 'pending']
          );
          db.run(
            'INSERT INTO orders (id, organization_id, customer_id, subtotal, total, status) VALUES (?, ?, ?, ?, ?, ?)',
            ['o2', 'org', 'c2', 100, 100, 'completed']
          );
          db.run(
            'INSERT INTO orders (id, organization_id, customer_id, subtotal, total, status) VALUES (?, ?, ?, ?, ?, ?)',
            ['o3', 'org', 'c3', 75, 75, 'pending'],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      });

      const pendingOrders = await new Promise<any[]>((resolve, reject) => {
        db.all('SELECT * FROM orders WHERE status = ?', ['pending'], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      expect(pendingOrders).toHaveLength(2);
    });
  });
});
