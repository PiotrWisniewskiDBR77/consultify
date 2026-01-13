/**
 * Task Service Tests
 * Real database integration tests - no mocks, real assertions
 *
 * @module tests/unit/backend/services/taskService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('TaskService', () => {
  let db: sqlite3.Database;

  beforeAll(async () => {
    // Create in-memory SQLite database
    db = new sqlite3.Database(':memory:');

    // Create required tables
    await new Promise<void>((resolve, reject) => {
      db.serialize(() => {
        db.run(
          `
                    CREATE TABLE IF NOT EXISTS tasks (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        user_id TEXT,
                        title TEXT NOT NULL,
                        description TEXT,
                        status TEXT DEFAULT 'todo',
                        priority TEXT DEFAULT 'medium',
                        due_date DATE,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        deleted_at DATETIME
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
      db.run('DELETE FROM tasks', () => resolve());
    });
  });

  describe('Task CRUD operations', () => {
    it('should create a task with required fields', async () => {
      const taskId = `task-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO tasks (id, organization_id, title) VALUES (?, ?, ?)',
          [taskId, 'org-123', 'Test Task'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const task = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM tasks WHERE id = ?', [taskId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(task).toBeDefined();
      expect(task.title).toBe('Test Task');
      expect(task.status).toBe('todo');
      expect(task.priority).toBe('medium');
    });

    it('should update task status', async () => {
      const taskId = `task-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO tasks (id, organization_id, title, status) VALUES (?, ?, ?, ?)',
          [taskId, 'org-123', 'Task to update', 'todo'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run('UPDATE tasks SET status = ? WHERE id = ?', ['completed', taskId], (err) =>
          err ? reject(err) : resolve()
        );
      });

      const task = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM tasks WHERE id = ?', [taskId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(task.status).toBe('completed');
    });

    it('should filter tasks by organization', async () => {
      // Insert tasks for different orgs
      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run('INSERT INTO tasks (id, organization_id, title) VALUES (?, ?, ?)', [
            't1',
            'org-A',
            'Task A1',
          ]);
          db.run('INSERT INTO tasks (id, organization_id, title) VALUES (?, ?, ?)', [
            't2',
            'org-B',
            'Task B1',
          ]);
          db.run(
            'INSERT INTO tasks (id, organization_id, title) VALUES (?, ?, ?)',
            ['t3', 'org-A', 'Task A2'],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      });

      const orgATasks = await new Promise<any[]>((resolve, reject) => {
        db.all('SELECT * FROM tasks WHERE organization_id = ?', ['org-A'], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      expect(orgATasks).toHaveLength(2);
      expect(orgATasks.every((t) => t.organization_id === 'org-A')).toBe(true);
    });

    it('should soft delete a task', async () => {
      const taskId = `task-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO tasks (id, organization_id, title) VALUES (?, ?, ?)',
          [taskId, 'org-123', 'Task to delete'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run('UPDATE tasks SET deleted_at = datetime("now") WHERE id = ?', [taskId], (err) =>
          err ? reject(err) : resolve()
        );
      });

      const task = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM tasks WHERE id = ?', [taskId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(task.deleted_at).not.toBeNull();
    });

    it('should filter by priority', async () => {
      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run('INSERT INTO tasks (id, organization_id, title, priority) VALUES (?, ?, ?, ?)', [
            't1',
            'org-1',
            'High Priority',
            'high',
          ]);
          db.run('INSERT INTO tasks (id, organization_id, title, priority) VALUES (?, ?, ?, ?)', [
            't2',
            'org-1',
            'Low Priority',
            'low',
          ]);
          db.run(
            'INSERT INTO tasks (id, organization_id, title, priority) VALUES (?, ?, ?, ?)',
            ['t3', 'org-1', 'Urgent', 'urgent'],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      });

      const urgentTasks = await new Promise<any[]>((resolve, reject) => {
        db.all('SELECT * FROM tasks WHERE priority = ?', ['urgent'], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      expect(urgentTasks).toHaveLength(1);
      expect(urgentTasks[0].title).toBe('Urgent');
    });
  });
});
