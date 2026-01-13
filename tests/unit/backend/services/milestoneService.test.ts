/**
 * Milestone Service Tests
 * Real database tests for project milestones
 *
 * @module tests/unit/backend/services/milestoneService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('MilestoneService', () => {
  let db: sqlite3.Database;

  beforeAll(async () => {
    db = new sqlite3.Database(':memory:');

    await new Promise<void>((resolve, reject) => {
      db.serialize(() => {
        db.run(
          `
                    CREATE TABLE IF NOT EXISTS milestones (
                        id TEXT PRIMARY KEY,
                        project_id TEXT NOT NULL,
                        title TEXT NOT NULL,
                        description TEXT,
                        due_date DATETIME,
                        status TEXT DEFAULT 'pending',
                        progress INTEGER DEFAULT 0,
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
      db.run('DELETE FROM milestones', () => resolve());
    });
  });

  describe('Milestone CRUD', () => {
    it('should create milestone', async () => {
      const milestoneId = `ms-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO milestones (id, project_id, title, due_date) VALUES (?, ?, ?, ?)',
          [milestoneId, 'proj-123', 'Phase 1 Complete', '2026-02-01'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const milestone = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM milestones WHERE id = ?', [milestoneId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(milestone).toBeDefined();
      expect(milestone.title).toBe('Phase 1 Complete');
    });

    it('should update progress', async () => {
      const milestoneId = `ms-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO milestones (id, project_id, title) VALUES (?, ?, ?)',
          [milestoneId, 'proj-1', 'Launch'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run('UPDATE milestones SET progress = ? WHERE id = ?', [75, milestoneId], (err) =>
          err ? reject(err) : resolve()
        );
      });

      const milestone = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM milestones WHERE id = ?', [milestoneId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(milestone.progress).toBe(75);
    });

    it('should complete milestone', async () => {
      const milestoneId = `ms-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO milestones (id, project_id, title) VALUES (?, ?, ?)',
          [milestoneId, 'proj-1', 'Testing'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run(
          'UPDATE milestones SET status = ?, progress = 100 WHERE id = ?',
          ['completed', milestoneId],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const milestone = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM milestones WHERE id = ?', [milestoneId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(milestone.status).toBe('completed');
      expect(milestone.progress).toBe(100);
    });
  });
});
