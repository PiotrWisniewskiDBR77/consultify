/**
 * Cache Service Tests
 * Tests for caching functionality
 *
 * @module tests/unit/backend/services/cacheService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('CacheService', () => {
  let db: sqlite3.Database;

  beforeAll(async () => {
    db = new sqlite3.Database(':memory:');

    await new Promise<void>((resolve, reject) => {
      db.serialize(() => {
        db.run(
          `
                    CREATE TABLE IF NOT EXISTS cache (
                        key TEXT PRIMARY KEY,
                        value TEXT NOT NULL,
                        expires_at DATETIME,
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
      db.run('DELETE FROM cache', () => resolve());
    });
  });

  describe('Cache CRUD', () => {
    it('should set cache value', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO cache (key, value) VALUES (?, ?)',
          ['user:123', JSON.stringify({ name: 'John' })],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const cached = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM cache WHERE key = ?', ['user:123'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(cached).toBeDefined();
      expect(JSON.parse(cached.value).name).toBe('John');
    });

    it('should update cache value', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run('INSERT INTO cache (key, value) VALUES (?, ?)', ['counter', '10'], (err) =>
          err ? reject(err) : resolve()
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run('UPDATE cache SET value = ? WHERE key = ?', ['20', 'counter'], (err) =>
          err ? reject(err) : resolve()
        );
      });

      const cached = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM cache WHERE key = ?', ['counter'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(cached.value).toBe('20');
    });

    it('should delete cache value', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run('INSERT INTO cache (key, value) VALUES (?, ?)', ['temp', 'data'], (err) =>
          err ? reject(err) : resolve()
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run('DELETE FROM cache WHERE key = ?', ['temp'], (err) =>
          err ? reject(err) : resolve()
        );
      });

      const cached = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM cache WHERE key = ?', ['temp'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(cached).toBeUndefined();
    });
  });

  describe('Cache Expiration', () => {
    it('should set expiration', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO cache (key, value, expires_at) VALUES (?, ?, ?)',
          ['session', 'token-123', '2026-02-01 00:00:00'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const cached = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM cache WHERE key = ?', ['session'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(cached.expires_at).toBe('2026-02-01 00:00:00');
    });

    it('should clean expired entries', async () => {
      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run('INSERT INTO cache (key, value, expires_at) VALUES (?, ?, ?)', [
            'old',
            'data',
            '2025-01-01',
          ]);
          db.run(
            'INSERT INTO cache (key, value, expires_at) VALUES (?, ?, ?)',
            ['new', 'data', '2027-01-01'],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      });

      await new Promise<void>((resolve, reject) => {
        db.run('DELETE FROM cache WHERE expires_at < datetime("now")', (err) =>
          err ? reject(err) : resolve()
        );
      });

      const remaining = await new Promise<any[]>((resolve, reject) => {
        db.all('SELECT * FROM cache', (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      expect(remaining).toHaveLength(1);
      expect(remaining[0].key).toBe('new');
    });
  });
});
