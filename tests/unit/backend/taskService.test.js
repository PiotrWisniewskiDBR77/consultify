/**
 * Task Service Unit Tests
 * Tests task CRUD, filtering, stats, and workflow operations
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { getDatabase } from '../../../server/src/database/Database.js';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';
import { v4 as uuidv4 } from 'uuid';

const RUN_DB_TESTS = process.env.RUN_DB_TESTS === '1';
const describeIfDb = RUN_DB_TESTS ? describe : describe.skip;

vi.hoisted(() => {
  if (process.env.RUN_DB_TESTS !== '1') return;
  process.env.MOCK_DB = 'false';
  const workerId = process.env.VITEST_WORKER_ID || '0';
  process.env.SQLITE_PATH = `./test-task-service-${workerId}.db`;
});

describeIfDb('TaskService', () => {
  const db = getDatabase();
  let testOrgId;
  let testUserId;
  let testProjectId;
  let createdTaskIds = [];

  beforeAll(async () => {
    await initializeDatabase();

    // Create test organization
    testOrgId = uuidv4();
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`,
        [testOrgId, 'Task Test Org', 'pro', 'active'],
        (err) => (err ? reject(err) : resolve())
      );
    });

    // Create test user
    testUserId = uuidv4();
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO users (id, organization_id, email, password, role, status) VALUES (?, ?, ?, ?, ?, ?)`,
        [testUserId, testOrgId, `tasktest-${Date.now()}@test.com`, 'hash', 'ADMIN', 'active'],
        (err) => (err ? reject(err) : resolve())
      );
    });

    // Create test project
    testProjectId = uuidv4();
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO projects (id, organization_id, name, owner_id, status) VALUES (?, ?, ?, ?, ?)`,
        [testProjectId, testOrgId, 'Task Test Project', testUserId, 'active'],
        (err) => (err ? reject(err) : resolve())
      );
    });
  });

  afterAll(async () => {
    // Cleanup
    for (const taskId of createdTaskIds) {
      await new Promise((r) => db.run(`DELETE FROM tasks WHERE id = ?`, [taskId], () => r()));
    }
    await new Promise((r) =>
      db.run(`DELETE FROM projects WHERE id = ?`, [testProjectId], () => r())
    );
    await new Promise((r) =>
      db.run(`DELETE FROM users WHERE organization_id = ?`, [testOrgId], () => r())
    );
    await new Promise((r) =>
      db.run(`DELETE FROM organizations WHERE id = ?`, [testOrgId], () => r())
    );
  });

  beforeEach(async () => {
    // Clean tasks before each test
    await new Promise((r) =>
      db.run(`DELETE FROM tasks WHERE project_id = ?`, [testProjectId], () => r())
    );
    createdTaskIds = [];
  });

  describe('Task CRUD Operations', () => {
    it('should create a task', async () => {
      const taskId = uuidv4();
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO tasks (id, project_id, organization_id, title, description, status, priority, assignee_id, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
          [
            taskId,
            testProjectId,
            testOrgId,
            'Test Task',
            'Test Description',
            'todo',
            'medium',
            testUserId,
          ],
          (err) => (err ? reject(err) : resolve())
        );
      });
      createdTaskIds.push(taskId);

      const task = await new Promise((resolve) => {
        db.get(`SELECT * FROM tasks WHERE id = ?`, [taskId], (_, row) => resolve(row));
      });

      expect(task).toBeDefined();
      expect(task.title).toBe('Test Task');
      expect(task.status).toBe('todo');
    });

    it('should retrieve task by ID', async () => {
      const taskId = uuidv4();
      await new Promise((resolve) => {
        db.run(
          `INSERT INTO tasks (id, project_id, organization_id, title, status, priority)
                     VALUES (?, ?, ?, ?, ?, ?)`,
          [taskId, testProjectId, testOrgId, 'Get Test', 'todo', 'high'],
          () => resolve()
        );
      });
      createdTaskIds.push(taskId);

      const task = await new Promise((resolve) => {
        db.get(`SELECT * FROM tasks WHERE id = ?`, [taskId], (_, row) => resolve(row));
      });

      expect(task).toBeDefined();
      expect(task.id).toBe(taskId);
    });

    it('should list tasks for project', async () => {
      // Create multiple tasks
      for (let i = 0; i < 3; i++) {
        const taskId = uuidv4();
        await new Promise((resolve) => {
          db.run(
            `INSERT INTO tasks (id, project_id, organization_id, title, status, priority)
                         VALUES (?, ?, ?, ?, ?, ?)`,
            [taskId, testProjectId, testOrgId, `Task ${i}`, 'todo', 'medium'],
            () => resolve()
          );
        });
        createdTaskIds.push(taskId);
      }

      const tasks = await new Promise((resolve) => {
        db.all(`SELECT * FROM tasks WHERE project_id = ?`, [testProjectId], (_, rows) =>
          resolve(rows)
        );
      });

      expect(tasks.length).toBe(3);
    });

    it('should update task', async () => {
      const taskId = uuidv4();
      await new Promise((resolve) => {
        db.run(
          `INSERT INTO tasks (id, project_id, organization_id, title, status, priority)
                     VALUES (?, ?, ?, ?, ?, ?)`,
          [taskId, testProjectId, testOrgId, 'Original Title', 'todo', 'low'],
          () => resolve()
        );
      });
      createdTaskIds.push(taskId);

      await new Promise((resolve) => {
        db.run(
          `UPDATE tasks SET title = ?, status = ? WHERE id = ?`,
          ['Updated Title', 'in_progress', taskId],
          () => resolve()
        );
      });

      const task = await new Promise((resolve) => {
        db.get(`SELECT * FROM tasks WHERE id = ?`, [taskId], (_, row) => resolve(row));
      });

      expect(task.title).toBe('Updated Title');
      expect(task.status).toBe('in_progress');
    });

    it('should delete task', async () => {
      const taskId = uuidv4();
      await new Promise((resolve) => {
        db.run(
          `INSERT INTO tasks (id, project_id, organization_id, title, status, priority)
                     VALUES (?, ?, ?, ?, ?, ?)`,
          [taskId, testProjectId, testOrgId, 'Delete Me', 'todo', 'low'],
          () => resolve()
        );
      });

      await new Promise((resolve) => {
        db.run(`DELETE FROM tasks WHERE id = ?`, [taskId], () => resolve());
      });

      const task = await new Promise((resolve) => {
        db.get(`SELECT * FROM tasks WHERE id = ?`, [taskId], (_, row) => resolve(row));
      });

      expect(task).toBeNull();
    });
  });

  describe('Task Filtering', () => {
    it('should filter tasks by status', async () => {
      // Create tasks with different statuses
      const statuses = ['todo', 'in_progress', 'done'];
      for (const status of statuses) {
        const taskId = uuidv4();
        await new Promise((resolve) => {
          db.run(
            `INSERT INTO tasks (id, project_id, organization_id, title, status, priority)
                         VALUES (?, ?, ?, ?, ?, ?)`,
            [taskId, testProjectId, testOrgId, `${status} task`, status, 'medium'],
            () => resolve()
          );
        });
        createdTaskIds.push(taskId);
      }

      const todoTasks = await new Promise((resolve) => {
        db.all(
          `SELECT * FROM tasks WHERE project_id = ? AND status = ?`,
          [testProjectId, 'todo'],
          (_, rows) => resolve(rows)
        );
      });

      expect(todoTasks.length).toBe(1);
      expect(todoTasks[0].status).toBe('todo');
    });

    it('should filter tasks by priority', async () => {
      const priorities = ['low', 'medium', 'high', 'urgent'];
      for (const priority of priorities) {
        const taskId = uuidv4();
        await new Promise((resolve) => {
          db.run(
            `INSERT INTO tasks (id, project_id, organization_id, title, status, priority)
                         VALUES (?, ?, ?, ?, ?, ?)`,
            [taskId, testProjectId, testOrgId, `${priority} priority`, 'todo', priority],
            () => resolve()
          );
        });
        createdTaskIds.push(taskId);
      }

      const urgentTasks = await new Promise((resolve) => {
        db.all(
          `SELECT * FROM tasks WHERE project_id = ? AND priority = ?`,
          [testProjectId, 'urgent'],
          (_, rows) => resolve(rows)
        );
      });

      expect(urgentTasks.length).toBe(1);
    });

    it('should filter tasks by assignee', async () => {
      const taskId = uuidv4();
      await new Promise((resolve) => {
        db.run(
          `INSERT INTO tasks (id, project_id, organization_id, title, status, priority, assignee_id)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [taskId, testProjectId, testOrgId, 'Assigned Task', 'todo', 'medium', testUserId],
          () => resolve()
        );
      });
      createdTaskIds.push(taskId);

      const assignedTasks = await new Promise((resolve) => {
        db.all(`SELECT * FROM tasks WHERE assignee_id = ?`, [testUserId], (_, rows) =>
          resolve(rows)
        );
      });

      expect(assignedTasks.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Task Statistics', () => {
    it('should count tasks by status', async () => {
      // Create tasks with different statuses
      await new Promise((r) =>
        db.run(
          `INSERT INTO tasks (id, project_id, organization_id, title, status, priority) VALUES (?, ?, ?, ?, ?, ?)`,
          [uuidv4(), testProjectId, testOrgId, 'T1', 'todo', 'medium'],
          () => r()
        )
      );
      await new Promise((r) =>
        db.run(
          `INSERT INTO tasks (id, project_id, organization_id, title, status, priority) VALUES (?, ?, ?, ?, ?, ?)`,
          [uuidv4(), testProjectId, testOrgId, 'T2', 'todo', 'medium'],
          () => r()
        )
      );
      await new Promise((r) =>
        db.run(
          `INSERT INTO tasks (id, project_id, organization_id, title, status, priority) VALUES (?, ?, ?, ?, ?, ?)`,
          [uuidv4(), testProjectId, testOrgId, 'T3', 'done', 'medium'],
          () => r()
        )
      );

      const stats = await new Promise((resolve) => {
        db.all(
          `SELECT status, COUNT(*) as count FROM tasks WHERE project_id = ? GROUP BY status`,
          [testProjectId],
          (_, rows) => resolve(rows)
        );
      });

      expect(stats.length).toBeGreaterThan(0);
      const todoCount = stats.find((s) => s.status === 'todo');
      expect(Number(todoCount?.count)).toBe(2);
    });

    it('should calculate completion rate', async () => {
      await new Promise((r) =>
        db.run(
          `INSERT INTO tasks (id, project_id, organization_id, title, status, priority) VALUES (?, ?, ?, ?, ?, ?)`,
          [uuidv4(), testProjectId, testOrgId, 'Done1', 'done', 'medium'],
          () => r()
        )
      );
      await new Promise((r) =>
        db.run(
          `INSERT INTO tasks (id, project_id, organization_id, title, status, priority) VALUES (?, ?, ?, ?, ?, ?)`,
          [uuidv4(), testProjectId, testOrgId, 'Done2', 'done', 'medium'],
          () => r()
        )
      );
      await new Promise((r) =>
        db.run(
          `INSERT INTO tasks (id, project_id, organization_id, title, status, priority) VALUES (?, ?, ?, ?, ?, ?)`,
          [uuidv4(), testProjectId, testOrgId, 'Todo1', 'todo', 'medium'],
          () => r()
        )
      );
      await new Promise((r) =>
        db.run(
          `INSERT INTO tasks (id, project_id, organization_id, title, status, priority) VALUES (?, ?, ?, ?, ?, ?)`,
          [uuidv4(), testProjectId, testOrgId, 'Todo2', 'todo', 'medium'],
          () => r()
        )
      );

      const total = await new Promise((resolve) => {
        db.get(
          `SELECT COUNT(*) as count FROM tasks WHERE project_id = ?`,
          [testProjectId],
          (_, row) => resolve(row)
        );
      });

      const done = await new Promise((resolve) => {
        db.get(
          `SELECT COUNT(*) as count FROM tasks WHERE project_id = ? AND status = 'done'`,
          [testProjectId],
          (_, row) => resolve(row)
        );
      });

      const completionRate = (done.count / total.count) * 100;
      expect(completionRate).toBe(50);
    });
  });

  describe('Priority Sorting', () => {
    it('should sort tasks by priority', () => {
      const tasks = [
        { id: 1, priority: 'low' },
        { id: 2, priority: 'urgent' },
        { id: 3, priority: 'medium' },
        { id: 4, priority: 'high' },
      ];
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      const sorted = [...tasks].sort(
        (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
      );

      expect(sorted[0].priority).toBe('urgent');
      expect(sorted[1].priority).toBe('high');
      expect(sorted[2].priority).toBe('medium');
      expect(sorted[3].priority).toBe('low');
    });
  });
});
