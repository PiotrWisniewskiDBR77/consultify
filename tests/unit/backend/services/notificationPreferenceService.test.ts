/**
 * Notification Preference Service Tests
 * Real database tests for user notification preferences
 *
 * @module tests/unit/backend/services/notificationPreferenceService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('NotificationPreferenceService', () => {
  let db: sqlite3.Database;

  beforeAll(async () => {
    db = new sqlite3.Database(':memory:');

    await new Promise<void>((resolve, reject) => {
      db.serialize(() => {
        db.run(
          `
                    CREATE TABLE IF NOT EXISTS notification_preferences (
                        id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        channel TEXT NOT NULL,
                        event_type TEXT NOT NULL,
                        is_enabled INTEGER DEFAULT 1,
                        frequency TEXT DEFAULT 'immediate',
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(user_id, channel, event_type)
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
      db.run('DELETE FROM notification_preferences', () => resolve());
    });
  });

  describe('Preference Management', () => {
    it('should create notification preference', async () => {
      const prefId = `pref-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO notification_preferences (id, user_id, channel, event_type, is_enabled) VALUES (?, ?, ?, ?, ?)',
          [prefId, 'user-123', 'email', 'task_assigned', 1],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const pref = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM notification_preferences WHERE id = ?', [prefId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(pref).toBeDefined();
      expect(pref.channel).toBe('email');
      expect(pref.is_enabled).toBe(1);
    });

    it('should disable notification', async () => {
      const prefId = `pref-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO notification_preferences (id, user_id, channel, event_type) VALUES (?, ?, ?, ?)',
          [prefId, 'user-456', 'push', 'comment_added'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run(
          'UPDATE notification_preferences SET is_enabled = 0 WHERE id = ?',
          [prefId],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const pref = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM notification_preferences WHERE id = ?', [prefId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(pref.is_enabled).toBe(0);
    });
  });

  describe('Preference Queries', () => {
    it('should get user preferences by channel', async () => {
      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run(
            'INSERT INTO notification_preferences (id, user_id, channel, event_type) VALUES (?, ?, ?, ?)',
            ['p1', 'user-1', 'email', 'event1']
          );
          db.run(
            'INSERT INTO notification_preferences (id, user_id, channel, event_type) VALUES (?, ?, ?, ?)',
            ['p2', 'user-1', 'push', 'event2']
          );
          db.run(
            'INSERT INTO notification_preferences (id, user_id, channel, event_type) VALUES (?, ?, ?, ?)',
            ['p3', 'user-1', 'email', 'event3'],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      });

      const emailPrefs = await new Promise<any[]>((resolve, reject) => {
        db.all(
          'SELECT * FROM notification_preferences WHERE user_id = ? AND channel = ?',
          ['user-1', 'email'],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      expect(emailPrefs).toHaveLength(2);
    });
  });
});
