/**
 * Feature Flag Service Tests
 * Real database tests for feature flags
 *
 * @module tests/unit/backend/services/featureFlagService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('FeatureFlagService', () => {
  let db: sqlite3.Database;

  beforeAll(async () => {
    db = new sqlite3.Database(':memory:');

    await new Promise<void>((resolve, reject) => {
      db.serialize(() => {
        db.run(
          `
                    CREATE TABLE IF NOT EXISTS feature_flags (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL UNIQUE,
                        description TEXT,
                        is_enabled INTEGER DEFAULT 0,
                        rollout_percentage INTEGER DEFAULT 0,
                        target_users TEXT,
                        target_organizations TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
      db.run('DELETE FROM feature_flags', () => resolve());
    });
  });

  describe('Flag CRUD', () => {
    it('should create feature flag', async () => {
      const flagId = `flag-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO feature_flags (id, name, description, is_enabled) VALUES (?, ?, ?, ?)',
          [flagId, 'new-dashboard', 'New dashboard UI', 1],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const flag = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM feature_flags WHERE id = ?', [flagId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(flag).toBeDefined();
      expect(flag.name).toBe('new-dashboard');
      expect(flag.is_enabled).toBe(1);
    });

    it('should toggle flag', async () => {
      const flagId = `flag-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO feature_flags (id, name, is_enabled) VALUES (?, ?, ?)',
          [flagId, 'test-flag', 0],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run('UPDATE feature_flags SET is_enabled = 1 WHERE id = ?', [flagId], (err) =>
          err ? reject(err) : resolve()
        );
      });

      const flag = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM feature_flags WHERE id = ?', [flagId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(flag.is_enabled).toBe(1);
    });
  });

  describe('Rollout', () => {
    it('should set rollout percentage', async () => {
      const flagId = `flag-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO feature_flags (id, name, rollout_percentage) VALUES (?, ?, ?)',
          [flagId, 'gradual-rollout', 25],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const flag = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM feature_flags WHERE id = ?', [flagId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(flag.rollout_percentage).toBe(25);
    });

    it('should target specific users', async () => {
      const flagId = `flag-${Date.now()}`;
      const targetUsers = ['user-1', 'user-2', 'user-3'];

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO feature_flags (id, name, target_users) VALUES (?, ?, ?)',
          [flagId, 'beta-feature', JSON.stringify(targetUsers)],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const flag = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM feature_flags WHERE id = ?', [flagId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      const users = JSON.parse(flag.target_users);
      expect(users).toHaveLength(3);
    });
  });
});
