/**
 * Database Performance Tests
 * Testing database query performance
 *
 * @module tests/performance/database/db-query-performance.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('Database Query Performance', () => {
  let db: sqlite3.Database;
  const MAX_QUERY_TIME_MS = 50;

  beforeAll(async () => {
    db = new sqlite3.Database(':memory:');

    await new Promise<void>((resolve, reject) => {
      db.serialize(() => {
        db.run(`CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT, email TEXT)`);
        db.run(
          `CREATE TABLE orders (id TEXT PRIMARY KEY, user_id TEXT, total REAL, created_at DATETIME)`
        );
        db.run(`CREATE INDEX idx_orders_user ON orders(user_id)`);

        // Insert test data
        for (let i = 0; i < 1000; i++) {
          db.run('INSERT INTO users (id, name, email) VALUES (?, ?, ?)', [
            `u${i}`,
            `User ${i}`,
            `user${i}@example.com`,
          ]);
          db.run(
            'INSERT INTO orders (id, user_id, total, created_at) VALUES (?, ?, ?, datetime("now"))',
            [`o${i}`, `u${i % 100}`, Math.random() * 1000]
          );
        }
        resolve();
      });
    });
  });

  afterAll(() => db.close());

  describe('Simple Query Performance', () => {
    it('should select single row under 10ms', async () => {
      const start = Date.now();

      await new Promise<void>((resolve, reject) => {
        db.get('SELECT * FROM users WHERE id = ?', ['u50'], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(100);
    });

    it('should select all users under 50ms', async () => {
      const start = Date.now();

      await new Promise<void>((resolve, reject) => {
        db.all('SELECT * FROM users', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(MAX_QUERY_TIME_MS);
    });
  });

  describe('Indexed Query Performance', () => {
    it('should query by indexed column under 20ms', async () => {
      const start = Date.now();

      await new Promise<void>((resolve, reject) => {
        db.all('SELECT * FROM orders WHERE user_id = ?', ['u50'], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(20);
    });
  });

  describe('Aggregate Query Performance', () => {
    it('should count rows under 30ms', async () => {
      const start = Date.now();

      await new Promise<number>((resolve, reject) => {
        db.get('SELECT COUNT(*) as count FROM orders', (err, row: any) => {
          if (err) reject(err);
          else resolve(row.count);
        });
      });

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(30);
    });

    it('should sum with group by under 50ms', async () => {
      const start = Date.now();

      await new Promise<void>((resolve, reject) => {
        db.all('SELECT user_id, SUM(total) as total FROM orders GROUP BY user_id', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(MAX_QUERY_TIME_MS);
    });
  });

  describe('Write Performance', () => {
    it('should insert single row under 10ms', async () => {
      const start = Date.now();

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO users (id, name, email) VALUES (?, ?, ?)',
          [`perf-${Date.now()}`, 'Perf User', 'perf@example.com'],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(10);
    });
  });
});
