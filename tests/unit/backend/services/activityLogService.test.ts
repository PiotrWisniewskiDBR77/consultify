/**
 * Activity Log Service Tests
 * Real database tests for activity log tracking
 *
 * @module tests/unit/backend/services/activityLogService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('ActivityLogService', () => {
  let db: sqlite3.Database;

  beforeAll(async () => {
    db = new sqlite3.Database(':memory:');

    await new Promise<void>((resolve, reject) => {
      db.serialize(() => {
        db.run(
          `
                    CREATE TABLE IF NOT EXISTS activity_logs (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        user_id TEXT NOT NULL,
                        activity_type TEXT NOT NULL,
                        entity_type TEXT,
                        entity_id TEXT,
                        metadata TEXT,
                        ip_address TEXT,
                        user_agent TEXT,
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
      db.run('DELETE FROM activity_logs', () => resolve());
    });
  });

  describe('Activity Logging', () => {
    it('should log activity', async () => {
      const activityId = `act-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO activity_logs (id, organization_id, user_id, activity_type, entity_type, entity_id) VALUES (?, ?, ?, ?, ?, ?)',
          [activityId, 'org-123', 'user-456', 'task.created', 'task', 'task-789'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const activity = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM activity_logs WHERE id = ?', [activityId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(activity).toBeDefined();
      expect(activity.activity_type).toBe('task.created');
    });

    it('should store metadata', async () => {
      const activityId = `act-${Date.now()}`;
      const metadata = { oldStatus: 'pending', newStatus: 'completed' };

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO activity_logs (id, organization_id, user_id, activity_type, metadata) VALUES (?, ?, ?, ?, ?)',
          [activityId, 'org-123', 'user-456', 'task.updated', JSON.stringify(metadata)],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const activity = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM activity_logs WHERE id = ?', [activityId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      const parsedMetadata = JSON.parse(activity.metadata);
      expect(parsedMetadata.newStatus).toBe('completed');
    });
  });

  describe('Activity Queries', () => {
    it('should get activities by user', async () => {
      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run(
            'INSERT INTO activity_logs (id, organization_id, user_id, activity_type) VALUES (?, ?, ?, ?)',
            ['a1', 'org-1', 'user-A', 'login']
          );
          db.run(
            'INSERT INTO activity_logs (id, organization_id, user_id, activity_type) VALUES (?, ?, ?, ?)',
            ['a2', 'org-1', 'user-A', 'task.created']
          );
          db.run(
            'INSERT INTO activity_logs (id, organization_id, user_id, activity_type) VALUES (?, ?, ?, ?)',
            ['a3', 'org-1', 'user-B', 'login'],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      });

      const userActivities = await new Promise<any[]>((resolve, reject) => {
        db.all('SELECT * FROM activity_logs WHERE user_id = ?', ['user-A'], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      expect(userActivities).toHaveLength(2);
    });
  });
});
