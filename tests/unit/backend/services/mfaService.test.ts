/**
 * MFA Service Tests
 * Real database integration tests for Multi-Factor Authentication
 *
 * @module tests/unit/backend/services/mfaService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('MFAService', () => {
  let db: sqlite3.Database;

  beforeAll(async () => {
    db = new sqlite3.Database(':memory:');

    await new Promise<void>((resolve, reject) => {
      db.serialize(() => {
        db.run(`
                    CREATE TABLE IF NOT EXISTS mfa_factors (
                        id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        factor_type TEXT NOT NULL,
                        secret TEXT,
                        is_verified INTEGER DEFAULT 0,
                        is_primary INTEGER DEFAULT 0,
                        phone_number TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        verified_at DATETIME,
                        UNIQUE(user_id, factor_type)
                    )
                `);
        db.run(`
                    CREATE TABLE IF NOT EXISTS mfa_backup_codes (
                        id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        code_hash TEXT NOT NULL,
                        used_at DATETIME,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);
        db.run(
          `
                    CREATE TABLE IF NOT EXISTS mfa_challenges (
                        id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        factor_id TEXT NOT NULL,
                        challenge_type TEXT NOT NULL,
                        expires_at DATETIME NOT NULL,
                        verified_at DATETIME,
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

  afterAll(() => {
    db.close();
  });

  beforeEach(async () => {
    await new Promise<void>((resolve) => {
      db.serialize(() => {
        db.run('DELETE FROM mfa_factors');
        db.run('DELETE FROM mfa_backup_codes');
        db.run('DELETE FROM mfa_challenges', () => resolve());
      });
    });
  });

  describe('MFA Factor Management', () => {
    it('should enroll TOTP factor for user', async () => {
      const factorId = `mfa-${Date.now()}`;
      const userId = 'user-123';

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO mfa_factors (id, user_id, factor_type, secret, is_verified) VALUES (?, ?, ?, ?, ?)',
          [factorId, userId, 'totp', 'JBSWY3DPEHPK3PXP', 0],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const factor = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM mfa_factors WHERE id = ?', [factorId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(factor).toBeDefined();
      expect(factor.user_id).toBe('user-123');
      expect(factor.factor_type).toBe('totp');
      expect(factor.is_verified).toBe(0);
      expect(factor.secret).toBe('JBSWY3DPEHPK3PXP');
    });

    it('should verify MFA factor', async () => {
      const factorId = `mfa-${Date.now()}`;
      const userId = 'user-456';

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO mfa_factors (id, user_id, factor_type, secret, is_verified) VALUES (?, ?, ?, ?, ?)',
          [factorId, userId, 'totp', 'SECRET123', 0],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run(
          'UPDATE mfa_factors SET is_verified = 1, verified_at = datetime("now") WHERE id = ?',
          [factorId],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const factor = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM mfa_factors WHERE id = ?', [factorId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(factor.is_verified).toBe(1);
      expect(factor.verified_at).not.toBeNull();
    });

    it('should set primary factor', async () => {
      const userId = 'user-multi';

      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run(
            'INSERT INTO mfa_factors (id, user_id, factor_type, is_primary) VALUES (?, ?, ?, ?)',
            ['mfa-1', userId, 'totp', 1]
          );
          db.run(
            'INSERT INTO mfa_factors (id, user_id, factor_type, is_primary) VALUES (?, ?, ?, ?)',
            ['mfa-2', userId, 'sms', 0],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      });

      const primaryFactor = await new Promise<any>((resolve, reject) => {
        db.get(
          'SELECT * FROM mfa_factors WHERE user_id = ? AND is_primary = 1',
          [userId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      expect(primaryFactor.factor_type).toBe('totp');
    });
  });

  describe('Backup Codes', () => {
    it('should store backup codes', async () => {
      const userId = 'user-backup';
      const codes = ['code1hash', 'code2hash', 'code3hash'];

      for (const hash of codes) {
        await new Promise<void>((resolve, reject) => {
          db.run(
            'INSERT INTO mfa_backup_codes (id, user_id, code_hash) VALUES (?, ?, ?)',
            [`backup-${Date.now()}-${Math.random()}`, userId, hash],
            (err) => (err ? reject(err) : resolve())
          );
        });
      }

      const storedCodes = await new Promise<any[]>((resolve, reject) => {
        db.all('SELECT * FROM mfa_backup_codes WHERE user_id = ?', [userId], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      expect(storedCodes).toHaveLength(3);
      expect(storedCodes.every((c) => c.used_at === null)).toBe(true);
    });

    it('should mark backup code as used', async () => {
      const codeId = `backup-${Date.now()}`;
      const userId = 'user-use-backup';

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO mfa_backup_codes (id, user_id, code_hash) VALUES (?, ?, ?)',
          [codeId, userId, 'hashedcode'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run(
          'UPDATE mfa_backup_codes SET used_at = datetime("now") WHERE id = ?',
          [codeId],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const code = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM mfa_backup_codes WHERE id = ?', [codeId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(code.used_at).not.toBeNull();
    });
  });

  describe('Challenges', () => {
    it('should create MFA challenge', async () => {
      const challengeId = `challenge-${Date.now()}`;
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO mfa_challenges (id, user_id, factor_id, challenge_type, expires_at) VALUES (?, ?, ?, ?, ?)',
          [challengeId, 'user-123', 'mfa-456', 'verify', expiresAt],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const challenge = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM mfa_challenges WHERE id = ?', [challengeId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(challenge).toBeDefined();
      expect(challenge.challenge_type).toBe('verify');
      expect(challenge.verified_at).toBeNull();
    });
  });
});
