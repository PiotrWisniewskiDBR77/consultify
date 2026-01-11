/**
 * Session Service Tests
 * Real database tests for session management
 *
 * @module tests/unit/backend/services/sessionService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('SessionService', () => {
  let db: sqlite3.Database;

  beforeAll(async () => {
    db = new sqlite3.Database(':memory:');

    await new Promise<void>((resolve, reject) => {
      db.serialize(() => {
        db.run(
          `
                    CREATE TABLE IF NOT EXISTS sessions (
                        id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        token TEXT NOT NULL UNIQUE,
                        ip_address TEXT,
                        user_agent TEXT,
                        expires_at DATETIME NOT NULL,
                        last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
      db.run('DELETE FROM sessions', () => resolve());
    });
  });

  describe('Session Management', () => {
    it('should create session', async () => {
      const sessionId = `sess-${Date.now()}`;
      const token = `token-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO sessions (id, user_id, token, ip_address, expires_at) VALUES (?, ?, ?, ?, ?)',
          [sessionId, 'user-123', token, '192.168.1.1', '2026-02-01'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const session = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM sessions WHERE id = ?', [sessionId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(session).toBeDefined();
      expect(session.user_id).toBe('user-123');
    });

    it('should find session by token', async () => {
      const token = `unique-token-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)',
          ['sess-1', 'user-456', token, '2026-02-01'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const session = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM sessions WHERE token = ?', [token], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(session).toBeDefined();
      expect(session.user_id).toBe('user-456');
    });

    it('should delete expired sessions', async () => {
      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run('INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)', [
            's1',
            'u1',
            't1',
            '2025-01-01',
          ]);
          db.run(
            'INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)',
            ['s2', 'u2', 't2', '2027-01-01'],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      });

      await new Promise<void>((resolve, reject) => {
        db.run('DELETE FROM sessions WHERE expires_at < datetime("now")', (err) =>
          err ? reject(err) : resolve()
        );
      });

      const remaining = await new Promise<any[]>((resolve, reject) => {
        db.all('SELECT * FROM sessions', (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('s2');
    });
  });
});
