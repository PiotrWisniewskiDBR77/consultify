/**
 * Idempotency Tests
 * Enterprise SaaS Architecture - Integration Testing
 *
 * Tests for ensuring operations are idempotent - safe to retry
 * without causing duplicate side effects.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { getDatabase, resetConnection } from '../../server/src/database/Database.js';
import { initializeDatabase } from '../../server/src/database/DatabaseInitializer.js';
import { initTestDb, cleanAllTestTables } from '../helpers/dbHelper.cjs';

vi.hoisted(() => {
  const path = require('path');
  const workerId = process.env.VITEST_WORKER_ID || 'idemp';
  process.env.SQLITE_PATH = path.resolve(__dirname, `idempotency-${workerId}.integration.db`);
  process.env.MOCK_DB = 'false';
  process.env.ENABLE_TEST_AUTH_BYPASS = 'true';
});

describe('Idempotency', () => {
  let db;
  const workerId = process.env.VITEST_WORKER_ID || 'idemp';
  const orgId = `test-org-idemp-${workerId}`;
  const userId = `user-idemp-${workerId}`;

  beforeAll(async () => {
    await resetConnection();
    await initTestDb();
    db = getDatabase();

    // Force reset and re-init
    process.env.RESET_DB = 'true';
    await initializeDatabase();
    process.env.RESET_DB = 'false';

    await db.initPromise;

    // Seed test data
    try {
      await db.run("INSERT INTO organizations (id, name) VALUES (?, 'Test Org')", [orgId]);
      await db.run(
        `INSERT INTO users (id, email, organization_id, role) VALUES (?, 'idemp@test.com', ?, 'USER')`,
        [userId, orgId]
      );
    } catch (e) {
      // Ignore if already exists
    }
  }, 60000);

  afterAll(async () => {
    if (db) {
      try {
        await cleanAllTestTables();
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }, 30000);

  describe('Idempotent Creates', () => {
    it('should handle duplicate create requests with same ID', async () => {
      const projectId = 'proj-idemp-' + Date.now();

      try {
        await db.run(`INSERT INTO projects (id, name, organization_id) VALUES (?, 'Project', ?)`, [
          projectId,
          orgId,
        ]);

        try {
          await db.run(
            `INSERT INTO projects (id, name, organization_id) VALUES (?, 'Project 2', ?)`,
            [projectId, orgId]
          );
          expect(true).toBe(false); // Should not reach here
        } catch (error) {
          expect(error).toBeDefined();
        }

        const projects = await db.all('SELECT * FROM projects WHERE id = ?', [projectId]);
        expect(projects.length).toBe(1);
        expect(projects[0].name).toBe('Project');
      } finally {
        await db.run('DELETE FROM projects WHERE id = ?', [projectId]);
      }
    });

    it('should support idempotent create with check', async () => {
      const projectId = 'proj-idemp-key-' + Date.now();

      const existing = await db.get('SELECT * FROM projects WHERE id = ?', [projectId]);
      if (!existing) {
        await db.run(`INSERT INTO projects (id, name, organization_id) VALUES (?, 'Project', ?)`, [
          projectId,
          orgId,
        ]);
      }

      const existing2 = await db.get('SELECT * FROM projects WHERE id = ?', [projectId]);
      if (!existing2) {
        await db.run(`INSERT INTO projects (id, name, organization_id) VALUES (?, 'Project', ?)`, [
          projectId,
          orgId,
        ]);
      }

      const projects = await db.all('SELECT * FROM projects WHERE id = ?', [projectId]);
      expect(projects.length).toBe(1);

      await db.run('DELETE FROM projects WHERE id = ?', [projectId]);
    });
  });

  describe('Idempotent Updates', () => {
    it('should handle duplicate update requests', async () => {
      const projectId = 'proj-update-idemp-' + Date.now();

      try {
        await db.run(`INSERT INTO projects (id, name, organization_id) VALUES (?, 'Original', ?)`, [
          projectId,
          orgId,
        ]);

        await db.run('UPDATE projects SET name = ? WHERE id = ?', ['Updated', projectId]);
        await db.run('UPDATE projects SET name = ? WHERE id = ?', ['Updated', projectId]);

        const project = await db.get('SELECT * FROM projects WHERE id = ?', [projectId]);
        expect(project.name).toBe('Updated');
      } finally {
        await db.run('DELETE FROM projects WHERE id = ?', [projectId]);
      }
    });

    it('should handle concurrent updates safely', async () => {
      const projectId = 'proj-concurrent-update-' + Date.now();

      try {
        await db.run(`INSERT INTO projects (id, name, organization_id) VALUES (?, 'Original', ?)`, [
          projectId,
          orgId,
        ]);

        const updates = [
          db.run('UPDATE projects SET name = ? WHERE id = ?', ['Update 1', projectId]),
          db.run('UPDATE projects SET name = ? WHERE id = ?', ['Update 2', projectId]),
          db.run('UPDATE projects SET name = ? WHERE id = ?', ['Update 3', projectId]),
        ];

        await Promise.all(updates);

        const project = await db.get('SELECT * FROM projects WHERE id = ?', [projectId]);
        expect(project).toBeTruthy();
        expect(['Update 1', 'Update 2', 'Update 3']).toContain(project.name);
      } finally {
        await db.run('DELETE FROM projects WHERE id = ?', [projectId]);
      }
    });
  });

  describe('Retry Safety', () => {
    it('should be safe to retry failed operations', async () => {
      const projectId = 'proj-retry-' + Date.now();

      let success = false;
      for (let attempts = 0; attempts < 3 && !success; attempts++) {
        try {
          await db.run(
            `INSERT INTO projects (id, name, organization_id) VALUES (?, 'Project', ?)`,
            [projectId, orgId]
          );
          success = true;
        } catch (error) {
          if (error.message?.includes('UNIQUE constraint')) {
            success = true;
          }
        }
      }

      const project = await db.get('SELECT * FROM projects WHERE id = ?', [projectId]);
      expect(project).toBeTruthy();

      await db.run('DELETE FROM projects WHERE id = ?', [projectId]);
    });

    it('should handle partial failures gracefully', async () => {
      const projectId = 'proj-partial-' + Date.now();
      const taskId = 'task-partial-' + Date.now();

      try {
        await db.run(`INSERT INTO projects (id, name, organization_id) VALUES (?, 'Project', ?)`, [
          projectId,
          orgId,
        ]);

        try {
          await db.run(
            `INSERT INTO tasks (id, title, project_id, organization_id) VALUES (?, 'Task', ?, ?)`,
            [taskId, projectId, orgId]
          );
        } catch (error) {
          if (!error.message?.includes('UNIQUE constraint')) {
            throw error;
          }
        }
      } finally {
        await db.run('DELETE FROM tasks WHERE id = ?', [taskId]);
        await db.run('DELETE FROM projects WHERE id = ?', [projectId]);
      }
    });
  });

  describe('State Verification', () => {
    it('should verify state before applying operation', async () => {
      const projectId = 'proj-state-' + Date.now();

      const before = await db.get('SELECT * FROM projects WHERE id = ?', [projectId]);
      expect(before).toBeFalsy();

      await db.run(`INSERT INTO projects (id, name, organization_id) VALUES (?, 'Project', ?)`, [
        projectId,
        orgId,
      ]);

      const after = await db.get('SELECT * FROM projects WHERE id = ?', [projectId]);
      expect(after).toBeTruthy();

      await db.run('DELETE FROM projects WHERE id = ?', [projectId]);
    });

    it('should maintain consistent state across retries', async () => {
      const projectId = 'proj-consistent-' + Date.now();

      const results = [];
      for (let i = 0; i < 3; i++) {
        try {
          await db.run(
            `INSERT INTO projects (id, name, organization_id) VALUES (?, 'Project', ?)`,
            [projectId, orgId]
          );
          results.push('created');
        } catch (error) {
          if (error.message?.includes('UNIQUE constraint')) {
            results.push('exists');
          } else {
            results.push('error');
          }
        }
      }

      expect(results[0]).toBe('created');
      expect(results.slice(1).every((r) => r === 'exists')).toBe(true);

      await db.run('DELETE FROM projects WHERE id = ?', [projectId]);
    });
  });
});
