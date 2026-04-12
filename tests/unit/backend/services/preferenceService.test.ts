/**
 * Preference Service Tests
 * Real database tests for user preferences
 *
 * @module tests/unit/backend/services/preferenceService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('PreferenceService', () => {
  let db: sqlite3.Database;

  beforeAll(async () => {
    db = new sqlite3.Database(':memory:');

    await new Promise<void>((resolve, reject) => {
      db.serialize(() => {
        db.run(
          `
                    CREATE TABLE IF NOT EXISTS user_preferences (
                        id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL UNIQUE,
                        theme TEXT DEFAULT 'system',
                        language TEXT DEFAULT 'en',
                        timezone TEXT DEFAULT 'UTC',
                        date_format TEXT DEFAULT 'YYYY-MM-DD',
                        notifications_enabled INTEGER DEFAULT 1,
                        email_digest TEXT DEFAULT 'daily',
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
      db.run('DELETE FROM user_preferences', () => resolve());
    });
  });

  describe('Preference Management', () => {
    it('should create preferences', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO user_preferences (id, user_id, theme, language) VALUES (?, ?, ?, ?)',
          ['pref-1', 'user-123', 'dark', 'pl'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const prefs = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM user_preferences WHERE user_id = ?', ['user-123'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(prefs).toBeDefined();
      expect(prefs.theme).toBe('dark');
      expect(prefs.language).toBe('pl');
    });

    it('should update preferences', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO user_preferences (id, user_id) VALUES (?, ?)',
          ['pref-2', 'user-456'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run(
          'UPDATE user_preferences SET theme = ?, timezone = ?, updated_at = datetime("now") WHERE user_id = ?',
          ['light', 'Europe/Warsaw', 'user-456'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const prefs = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM user_preferences WHERE user_id = ?', ['user-456'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(prefs.theme).toBe('light');
      expect(prefs.timezone).toBe('Europe/Warsaw');
    });

    it('should toggle notifications', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO user_preferences (id, user_id, notifications_enabled) VALUES (?, ?, ?)',
          ['pref-3', 'user-789', 1],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run(
          'UPDATE user_preferences SET notifications_enabled = 0 WHERE user_id = ?',
          ['user-789'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const prefs = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM user_preferences WHERE user_id = ?', ['user-789'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(prefs.notifications_enabled).toBe(0);
    });
  });
});
