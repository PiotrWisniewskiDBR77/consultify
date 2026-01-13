/**
 * Sandbox Project Service Tests
 * FLOW-SANDBOX-001: Sandbox Project
 *
 * Tests for sandbox projects, templates, exports
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('SandboxProjectService', () => {
  let db: sqlite3.Database;

  beforeAll(async () => {
    db = new sqlite3.Database(':memory:');

    await new Promise<void>((resolve, reject) => {
      db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS organizations (id TEXT PRIMARY KEY, name TEXT)`);
        db.run(
          `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT, organization_id TEXT)`
        );
        db.run(
          `CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, organization_id TEXT, name TEXT)`
        );

        // Sandbox Projects
        db.run(`
                    CREATE TABLE IF NOT EXISTS sandbox_projects (
                        id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        template_id TEXT,
                        name TEXT NOT NULL,
                        description TEXT,
                        status TEXT DEFAULT 'active',
                        expires_at TIMESTAMP,
                        data_snapshot TEXT,
                        reset_count INTEGER DEFAULT 0,
                        last_reset_at TIMESTAMP,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);

        // Sandbox Templates
        db.run(`
                    CREATE TABLE IF NOT EXISTS sandbox_templates (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL UNIQUE,
                        display_name TEXT NOT NULL,
                        description TEXT,
                        category TEXT NOT NULL,
                        complexity TEXT DEFAULT 'basic',
                        includes_tasks INTEGER DEFAULT 0,
                        includes_initiatives INTEGER DEFAULT 0,
                        includes_assessment INTEGER DEFAULT 0,
                        includes_reports INTEGER DEFAULT 0,
                        sample_data TEXT,
                        is_active INTEGER DEFAULT 1,
                        sort_order INTEGER DEFAULT 0,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);

        // Sandbox Exports
        db.run(`
                    CREATE TABLE IF NOT EXISTS sandbox_exports (
                        id TEXT PRIMARY KEY,
                        sandbox_id TEXT NOT NULL,
                        target_project_id TEXT,
                        export_type TEXT NOT NULL,
                        exported_items TEXT,
                        status TEXT DEFAULT 'pending',
                        completed_at TIMESTAMP,
                        exported_by TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);

        // Sandbox Activity
        db.run(`
                    CREATE TABLE IF NOT EXISTS sandbox_activity (
                        id TEXT PRIMARY KEY,
                        sandbox_id TEXT NOT NULL,
                        user_id TEXT NOT NULL,
                        action_type TEXT NOT NULL,
                        action_data TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);

        // Seed data
        db.run(`INSERT INTO organizations (id, name) VALUES ('org-1', 'Test Org')`);
        db.run(
          `INSERT INTO users (id, email, organization_id) VALUES ('user-1', 'test@example.com', 'org-1')`
        );
        db.run(
          `INSERT INTO projects (id, organization_id, name) VALUES ('proj-1', 'org-1', 'Real Project')`,
          (err) => (err ? reject(err) : resolve())
        );
      });
    });
  });

  afterAll(() => db.close());

  beforeEach(async () => {
    await new Promise<void>((resolve) => {
      db.serialize(() => {
        db.run('DELETE FROM sandbox_projects');
        db.run('DELETE FROM sandbox_templates');
        db.run('DELETE FROM sandbox_exports');
        db.run('DELETE FROM sandbox_activity', () => resolve());
      });
    });
  });

  // ==========================================
  // SANDBOX TEMPLATES
  // ==========================================

  describe('Sandbox Templates', () => {
    it('should create a template', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `
                    INSERT INTO sandbox_templates (id, name, display_name, description, category, complexity, includes_tasks, includes_initiatives)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `,
          [
            'tpl-1',
            'lean_transformation',
            'Lean Transformation',
            'Learn Lean principles with sample data',
            'transformation',
            'intermediate',
            1,
            1,
          ],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const template = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM sandbox_templates WHERE id = ?', ['tpl-1'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(template).toBeDefined();
      expect(template.name).toBe('lean_transformation');
      expect(template.includes_tasks).toBe(1);
      expect(template.includes_initiatives).toBe(1);
    });

    it('should seed default templates', async () => {
      const templates = [
        {
          id: 'tpl-empty',
          name: 'empty',
          display: 'Empty Sandbox',
          category: 'basic',
          complexity: 'basic',
        },
        {
          id: 'tpl-lean',
          name: 'lean_basic',
          display: 'Lean Basics',
          category: 'transformation',
          complexity: 'basic',
        },
        {
          id: 'tpl-digi',
          name: 'digital_transformation',
          display: 'Digital Transformation',
          category: 'transformation',
          complexity: 'advanced',
        },
        {
          id: 'tpl-pmo',
          name: 'pmo_project',
          display: 'PMO Project',
          category: 'pmo',
          complexity: 'intermediate',
        },
        {
          id: 'tpl-assess',
          name: 'assessment_demo',
          display: 'Assessment Demo',
          category: 'assessment',
          complexity: 'basic',
        },
      ];

      for (const t of templates) {
        await new Promise<void>((resolve, reject) => {
          db.run(
            `INSERT INTO sandbox_templates (id, name, display_name, category, complexity) VALUES (?, ?, ?, ?, ?)`,
            [t.id, t.name, t.display, t.category, t.complexity],
            (err) => (err ? reject(err) : resolve())
          );
        });
      }

      const all = await new Promise<any[]>((resolve, reject) => {
        db.all('SELECT * FROM sandbox_templates ORDER BY sort_order', [], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      expect(all).toHaveLength(5);
    });

    it('should enforce unique template names', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `INSERT INTO sandbox_templates (id, name, display_name, category) VALUES (?, ?, ?, ?)`,
          ['tpl-u1', 'unique_name', 'Unique', 'basic'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const result = await new Promise<boolean>((resolve) => {
        db.run(
          `INSERT INTO sandbox_templates (id, name, display_name, category) VALUES (?, ?, ?, ?)`,
          ['tpl-u2', 'unique_name', 'Unique 2', 'basic'],
          (err) => {
            resolve(!!err);
          }
        );
      });

      expect(result).toBe(true);
    });
  });

  // ==========================================
  // SANDBOX PROJECTS
  // ==========================================

  describe('Sandbox Projects', () => {
    beforeEach(async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `INSERT INTO sandbox_templates (id, name, display_name, category) VALUES (?, ?, ?, ?)`,
          ['tpl-test', 'test_template', 'Test Template', 'basic'],
          (err) => (err ? reject(err) : resolve())
        );
      });
    });

    it('should create sandbox project', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `
                    INSERT INTO sandbox_projects (id, user_id, template_id, name, description)
                    VALUES (?, ?, ?, ?, ?)
                `,
          ['sandbox-1', 'user-1', 'tpl-test', 'My Sandbox', 'Learning project'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const sandbox = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM sandbox_projects WHERE id = ?', ['sandbox-1'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(sandbox).toBeDefined();
      expect(sandbox.name).toBe('My Sandbox');
      expect(sandbox.status).toBe('active');
      expect(sandbox.reset_count).toBe(0);
    });

    it('should reset sandbox', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `INSERT INTO sandbox_projects (id, user_id, name, reset_count) VALUES (?, ?, ?, ?)`,
          ['sandbox-2', 'user-1', 'Resettable', 0],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run(
          `UPDATE sandbox_projects SET reset_count = reset_count + 1, last_reset_at = ? WHERE id = ?`,
          [new Date().toISOString(), 'sandbox-2'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const sandbox = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM sandbox_projects WHERE id = ?', ['sandbox-2'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(sandbox.reset_count).toBe(1);
      expect(sandbox.last_reset_at).not.toBeNull();
    });

    it('should expire sandbox', async () => {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

      await new Promise<void>((resolve, reject) => {
        db.run(
          `INSERT INTO sandbox_projects (id, user_id, name, expires_at) VALUES (?, ?, ?, ?)`,
          ['sandbox-3', 'user-1', 'Expiring', expiresAt],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const sandbox = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM sandbox_projects WHERE id = ?', ['sandbox-3'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(sandbox.expires_at).toBe(expiresAt);
    });

    it('should list user sandboxes', async () => {
      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run(`INSERT INTO sandbox_projects (id, user_id, name) VALUES (?, ?, ?)`, [
            'sb-1',
            'user-1',
            'Sandbox 1',
          ]);
          db.run(`INSERT INTO sandbox_projects (id, user_id, name) VALUES (?, ?, ?)`, [
            'sb-2',
            'user-1',
            'Sandbox 2',
          ]);
          db.run(
            `INSERT INTO sandbox_projects (id, user_id, name, status) VALUES (?, ?, ?, ?)`,
            ['sb-3', 'user-1', 'Archived', 'archived'],
            (err) => (err ? reject(err) : resolve())
          );
        });
      });

      const activeSandboxes = await new Promise<any[]>((resolve, reject) => {
        db.all(
          `SELECT * FROM sandbox_projects WHERE user_id = ? AND status = 'active'`,
          ['user-1'],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      expect(activeSandboxes).toHaveLength(2);
    });
  });

  // ==========================================
  // SANDBOX EXPORTS
  // ==========================================

  describe('Sandbox Exports', () => {
    beforeEach(async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `INSERT INTO sandbox_projects (id, user_id, name) VALUES (?, ?, ?)`,
          ['sandbox-export', 'user-1', 'Export Test'],
          (err) => (err ? reject(err) : resolve())
        );
      });
    });

    it('should create export request', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `
                    INSERT INTO sandbox_exports (id, sandbox_id, target_project_id, export_type, exported_by)
                    VALUES (?, ?, ?, ?, ?)
                `,
          ['export-1', 'sandbox-export', 'proj-1', 'full', 'user-1'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const exportReq = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM sandbox_exports WHERE id = ?', ['export-1'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(exportReq).toBeDefined();
      expect(exportReq.export_type).toBe('full');
      expect(exportReq.status).toBe('pending');
    });

    it('should complete export', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `INSERT INTO sandbox_exports (id, sandbox_id, export_type, exported_by) VALUES (?, ?, ?, ?)`,
          ['export-2', 'sandbox-export', 'initiatives_only', 'user-1'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run(
          `UPDATE sandbox_exports SET status = 'completed', exported_items = ?, completed_at = ? WHERE id = ?`,
          ['{"initiatives":5,"tasks":12}', new Date().toISOString(), 'export-2'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const exportReq = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM sandbox_exports WHERE id = ?', ['export-2'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(exportReq.status).toBe('completed');
      expect(exportReq.exported_items).toContain('initiatives');
    });

    it('should support different export types', async () => {
      const exportTypes = ['full', 'initiatives_only', 'tasks_only', 'structure_only'];

      for (let i = 0; i < exportTypes.length; i++) {
        await new Promise<void>((resolve, reject) => {
          db.run(
            `INSERT INTO sandbox_exports (id, sandbox_id, export_type, exported_by) VALUES (?, ?, ?, ?)`,
            [`export-type-${i}`, 'sandbox-export', exportTypes[i], 'user-1'],
            (err) => (err ? reject(err) : resolve())
          );
        });
      }

      const exports = await new Promise<any[]>((resolve, reject) => {
        db.all('SELECT export_type FROM sandbox_exports', [], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      expect(exports).toHaveLength(4);
      expect(exports.map((e) => e.export_type)).toEqual(expect.arrayContaining(exportTypes));
    });
  });

  // ==========================================
  // SANDBOX ACTIVITY
  // ==========================================

  describe('Sandbox Activity', () => {
    beforeEach(async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `INSERT INTO sandbox_projects (id, user_id, name) VALUES (?, ?, ?)`,
          ['sandbox-activity', 'user-1', 'Activity Test'],
          (err) => (err ? reject(err) : resolve())
        );
      });
    });

    it('should log activity', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `
                    INSERT INTO sandbox_activity (id, sandbox_id, user_id, action_type, action_data)
                    VALUES (?, ?, ?, ?, ?)
                `,
          [
            'activity-1',
            'sandbox-activity',
            'user-1',
            'task_created',
            '{"task_id":"t-1","title":"New Task"}',
          ],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const activity = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM sandbox_activity WHERE id = ?', ['activity-1'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(activity).toBeDefined();
      expect(activity.action_type).toBe('task_created');
    });

    it('should track activity history', async () => {
      const actions = [
        'sandbox_created',
        'task_created',
        'initiative_added',
        'assessment_started',
        'sandbox_reset',
      ];

      for (let i = 0; i < actions.length; i++) {
        await new Promise<void>((resolve, reject) => {
          db.run(
            `INSERT INTO sandbox_activity (id, sandbox_id, user_id, action_type) VALUES (?, ?, ?, ?)`,
            [`act-${i}`, 'sandbox-activity', 'user-1', actions[i]],
            (err) => (err ? reject(err) : resolve())
          );
        });
      }

      const history = await new Promise<any[]>((resolve, reject) => {
        db.all(
          `SELECT * FROM sandbox_activity WHERE sandbox_id = ? ORDER BY created_at`,
          ['sandbox-activity'],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      expect(history).toHaveLength(5);
      expect(history[0].action_type).toBe('sandbox_created');
      expect(history[4].action_type).toBe('sandbox_reset');
    });
  });
});
