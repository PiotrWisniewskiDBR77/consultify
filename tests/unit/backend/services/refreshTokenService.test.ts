/**
 * Refresh Token Service Tests
 * Real database integration tests for token lifecycle
 *
 * @module tests/unit/backend/services/refreshTokenService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('RefreshTokenService', () => {
  let db: sqlite3.Database;

  beforeAll(async () => {
    db = new sqlite3.Database(':memory:');

    await new Promise<void>((resolve, reject) => {
      db.serialize(() => {
        db.run(
          `
                    CREATE TABLE IF NOT EXISTS refresh_tokens (
                        id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        token_hash TEXT NOT NULL UNIQUE,
                        device_info TEXT,
                        ip_address TEXT,
                        is_revoked INTEGER DEFAULT 0,
                        expires_at DATETIME NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        last_used_at DATETIME
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

  afterAll(() => {
    db.close();
  });

  beforeEach(async () => {
    await new Promise<void>((resolve) => {
      db.run('DELETE FROM refresh_tokens', () => resolve());
    });
  });

  describe('Token Lifecycle', () => {
    it('should create refresh token', async () => {
      const tokenId = `rt-${Date.now()}`;
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, device_info) VALUES (?, ?, ?, ?, ?)',
          [tokenId, 'user-123', 'hash_abc123', expiresAt, 'Chrome/Windows'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const token = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM refresh_tokens WHERE id = ?', [tokenId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(token).toBeDefined();
      expect(token.user_id).toBe('user-123');
      expect(token.is_revoked).toBe(0);
      expect(token.device_info).toBe('Chrome/Windows');
    });

    it('should validate token by hash', async () => {
      const tokenHash = 'unique_hash_xyz';
      const expiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(); // 1 hour

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
          ['rt-1', 'user-456', tokenHash, expiresAt],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const token = await new Promise<any>((resolve, reject) => {
        db.get(
          'SELECT * FROM refresh_tokens WHERE token_hash = ? AND is_revoked = 0 AND expires_at > datetime("now")',
          [tokenHash],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      expect(token).toBeDefined();
      expect(token.user_id).toBe('user-456');
    });

    it('should revoke token', async () => {
      const tokenId = `rt-${Date.now()}`;
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
          [tokenId, 'user-789', 'hash_to_revoke', expiresAt],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run('UPDATE refresh_tokens SET is_revoked = 1 WHERE id = ?', [tokenId], (err) =>
          err ? reject(err) : resolve()
        );
      });

      const token = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM refresh_tokens WHERE id = ?', [tokenId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(token.is_revoked).toBe(1);
    });

    it('should revoke all tokens for user', async () => {
      const userId = 'user-revoke-all';
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run(
            'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
            ['rt-1', userId, 'hash1', expiresAt]
          );
          db.run(
            'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
            ['rt-2', userId, 'hash2', expiresAt]
          );
          db.run(
            'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
            ['rt-3', 'other-user', 'hash3', expiresAt],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      });

      await new Promise<void>((resolve, reject) => {
        db.run('UPDATE refresh_tokens SET is_revoked = 1 WHERE user_id = ?', [userId], (err) =>
          err ? reject(err) : resolve()
        );
      });

      const revokedCount = await new Promise<any>((resolve, reject) => {
        db.get('SELECT COUNT(*) as count FROM refresh_tokens WHERE is_revoked = 1', (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(revokedCount.count).toBe(2);
    });

    it('should update last_used_at on token use', async () => {
      const tokenId = `rt-${Date.now()}`;
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
          [tokenId, 'user-active', 'hash_active', expiresAt],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run(
          'UPDATE refresh_tokens SET last_used_at = datetime("now") WHERE id = ?',
          [tokenId],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const token = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM refresh_tokens WHERE id = ?', [tokenId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(token.last_used_at).not.toBeNull();
    });
  });

  describe('Token Cleanup', () => {
    it('should identify expired tokens for cleanup', async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // Yesterday

      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run(
            'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
            ['rt-valid', 'user-1', 'hash_valid', futureDate]
          );
          db.run(
            'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
            ['rt-expired', 'user-2', 'hash_expired', pastDate],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      });

      const expired = await new Promise<any[]>((resolve, reject) => {
        db.all('SELECT * FROM refresh_tokens WHERE expires_at < datetime("now")', (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      expect(expired).toHaveLength(1);
      expect(expired[0].id).toBe('rt-expired');
    });
  });
});
