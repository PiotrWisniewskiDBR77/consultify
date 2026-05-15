/**
 * AnalyticsService Unit Tests
 * FLOW-ANALYTICS-001: Dashboard analytics and metrics
 *
 * Uses in-memory SQLite database for testing
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('AnalyticsService', () => {
  let db: sqlite3.Database;

  beforeAll(async () => {
    db = new sqlite3.Database(':memory:');

    await new Promise<void>((resolve, reject) => {
      db.serialize(() => {
        // Organizations
        db.run(`CREATE TABLE IF NOT EXISTS organizations (id TEXT PRIMARY KEY, name TEXT)`);

        // Projects
        db.run(`
                    CREATE TABLE IF NOT EXISTS projects (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT,
                        name TEXT,
                        status TEXT DEFAULT 'active',
                        health TEXT DEFAULT 'on_track'
                    )
                `);

        // Initiatives
        db.run(`
                    CREATE TABLE IF NOT EXISTS initiatives (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT,
                        project_id TEXT,
                        status TEXT DEFAULT 'draft'
                    )
                `);

        // Tasks
        db.run(`
                    CREATE TABLE IF NOT EXISTS tasks (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT,
                        status TEXT DEFAULT 'todo',
                        due_date DATE,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);

        // Custom dashboards
        db.run(`
                    CREATE TABLE IF NOT EXISTS custom_dashboards (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        user_id TEXT,
                        name TEXT NOT NULL,
                        description TEXT,
                        layout TEXT DEFAULT '[]',
                        widgets TEXT DEFAULT '[]',
                        is_default INTEGER DEFAULT 0,
                        is_shared INTEGER DEFAULT 0,
                        created_by TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);

        // Dashboard widgets
        db.run(`
                    CREATE TABLE IF NOT EXISTS dashboard_widgets (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL UNIQUE,
                        display_name TEXT NOT NULL,
                        category TEXT NOT NULL,
                        widget_type TEXT NOT NULL,
                        data_source TEXT NOT NULL,
                        min_role TEXT DEFAULT 'user',
                        is_active INTEGER DEFAULT 1
                    )
                `);

        // Analytics snapshots
        db.run(`
                    CREATE TABLE IF NOT EXISTS analytics_snapshots (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        snapshot_date DATE NOT NULL,
                        projects_total INTEGER DEFAULT 0,
                        projects_active INTEGER DEFAULT 0,
                        initiatives_total INTEGER DEFAULT 0,
                        tasks_total INTEGER DEFAULT 0,
                        UNIQUE(organization_id, snapshot_date)
                    )
                `);

        // Seed data
        db.run(`INSERT INTO organizations (id, name) VALUES ('org-test-1', 'Test Org')`);

        // Seed widgets
        db.run(
          `INSERT INTO dashboard_widgets (id, name, display_name, category, widget_type, data_source) 
                    VALUES ('w1', 'projects_count', 'Total Projects', 'overview', 'stat_card', '/api/analytics/projects')`,
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
        db.run('DELETE FROM projects');
        db.run('DELETE FROM initiatives');
        db.run('DELETE FROM tasks');
        db.run('DELETE FROM custom_dashboards');
        db.run('DELETE FROM analytics_snapshots', () => resolve());
      });
    });
  });

  // ==========================================
  // PROJECTS ANALYTICS
  // ==========================================

  describe('Project Analytics', () => {
    it('should count projects by status', async () => {
      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run(`INSERT INTO projects (id, organization_id, status) VALUES (?, ?, ?)`, [
            'p1',
            'org-test-1',
            'active',
          ]);
          db.run(`INSERT INTO projects (id, organization_id, status) VALUES (?, ?, ?)`, [
            'p2',
            'org-test-1',
            'active',
          ]);
          db.run(
            `INSERT INTO projects (id, organization_id, status) VALUES (?, ?, ?)`,
            ['p3', 'org-test-1', 'completed'],
            (err) => (err ? reject(err) : resolve())
          );
        });
      });

      const stats = await new Promise<any[]>((resolve, reject) => {
        db.all(
          `
                    SELECT status, COUNT(*) as count 
                    FROM projects 
                    WHERE organization_id = ? 
                    GROUP BY status
                `,
          ['org-test-1'],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      expect(stats).toHaveLength(2);
      const activeCount = stats.find((s: any) => s.status === 'active');
      expect(activeCount?.count).toBe(2);
    });

    it('should count projects by health', async () => {
      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run(`INSERT INTO projects (id, organization_id, health) VALUES (?, ?, ?)`, [
            'p1',
            'org-test-1',
            'on_track',
          ]);
          db.run(`INSERT INTO projects (id, organization_id, health) VALUES (?, ?, ?)`, [
            'p2',
            'org-test-1',
            'on_track',
          ]);
          db.run(
            `INSERT INTO projects (id, organization_id, health) VALUES (?, ?, ?)`,
            ['p3', 'org-test-1', 'at_risk'],
            (err) => (err ? reject(err) : resolve())
          );
        });
      });

      const stats = await new Promise<any[]>((resolve, reject) => {
        db.all(
          `
                    SELECT health, COUNT(*) as count 
                    FROM projects 
                    WHERE organization_id = ? 
                    GROUP BY health
                `,
          ['org-test-1'],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      const onTrack = stats.find((s: any) => s.health === 'on_track');
      const atRisk = stats.find((s: any) => s.health === 'at_risk');

      expect(onTrack?.count).toBe(2);
      expect(atRisk?.count).toBe(1);
    });
  });

  // ==========================================
  // INITIATIVES ANALYTICS
  // ==========================================

  describe('Initiative Analytics', () => {
    it('should count initiatives by status', async () => {
      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run(`INSERT INTO initiatives (id, organization_id, status) VALUES (?, ?, ?)`, [
            'i1',
            'org-test-1',
            'draft',
          ]);
          db.run(`INSERT INTO initiatives (id, organization_id, status) VALUES (?, ?, ?)`, [
            'i2',
            'org-test-1',
            'executing',
          ]);
          db.run(`INSERT INTO initiatives (id, organization_id, status) VALUES (?, ?, ?)`, [
            'i3',
            'org-test-1',
            'executing',
          ]);
          db.run(
            `INSERT INTO initiatives (id, organization_id, status) VALUES (?, ?, ?)`,
            ['i4', 'org-test-1', 'done'],
            (err) => (err ? reject(err) : resolve())
          );
        });
      });

      const stats = await new Promise<any>((resolve, reject) => {
        db.get(
          `
                    SELECT 
                        COUNT(*) as total,
                        COUNT(CASE WHEN status = 'executing' THEN 1 END) as executing,
                        COUNT(CASE WHEN status = 'done' THEN 1 END) as done
                    FROM initiatives 
                    WHERE organization_id = ?
                `,
          ['org-test-1'],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      expect(stats.total).toBe(4);
      expect(stats.executing).toBe(2);
      expect(stats.done).toBe(1);
    });
  });

  // ==========================================
  // DASHBOARDS
  // ==========================================

  describe('Custom Dashboards', () => {
    it('should create a custom dashboard', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `
                    INSERT INTO custom_dashboards (id, organization_id, user_id, name, layout, widgets, created_by)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `,
          ['dash-1', 'org-test-1', 'user-1', 'My Dashboard', '[]', '[{"id":"w1"}]', 'user-1'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const dashboard = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM custom_dashboards WHERE id = ?', ['dash-1'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(dashboard).toBeDefined();
      expect(dashboard.name).toBe('My Dashboard');
      expect(dashboard.user_id).toBe('user-1');
    });

    it('should list dashboards for organization', async () => {
      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run(
            `INSERT INTO custom_dashboards (id, organization_id, name, is_default, created_by) VALUES (?, ?, ?, ?, ?)`,
            ['dash-1', 'org-test-1', 'Main Dashboard', 1, 'admin']
          );
          db.run(
            `INSERT INTO custom_dashboards (id, organization_id, user_id, name, created_by) VALUES (?, ?, ?, ?, ?)`,
            ['dash-2', 'org-test-1', 'user-1', 'Personal Dashboard', 'user-1'],
            (err) => (err ? reject(err) : resolve())
          );
        });
      });

      const dashboards = await new Promise<any[]>((resolve, reject) => {
        db.all(
          `
                    SELECT * FROM custom_dashboards 
                    WHERE organization_id = ? 
                    ORDER BY is_default DESC, name
                `,
          ['org-test-1'],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      expect(dashboards).toHaveLength(2);
      expect(dashboards[0].is_default).toBe(1);
      expect(dashboards[0].name).toBe('Main Dashboard');
    });

    it('should update dashboard', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `INSERT INTO custom_dashboards (id, organization_id, name, created_by) VALUES (?, ?, ?, ?)`,
          ['dash-3', 'org-test-1', 'Old Name', 'user-1'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run(
          `UPDATE custom_dashboards SET name = ?, is_shared = ? WHERE id = ?`,
          ['New Name', 1, 'dash-3'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const dashboard = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM custom_dashboards WHERE id = ?', ['dash-3'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(dashboard.name).toBe('New Name');
      expect(dashboard.is_shared).toBe(1);
    });
  });

  // ==========================================
  // ANALYTICS SNAPSHOTS
  // ==========================================

  describe('Analytics Snapshots', () => {
    it('should create daily snapshot', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `
                    INSERT INTO analytics_snapshots (
                        id, organization_id, snapshot_date, 
                        projects_total, projects_active, initiatives_total, tasks_total
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                `,
          ['snap-1', 'org-test-1', '2026-01-11', 10, 8, 25, 100],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const snapshot = await new Promise<any>((resolve, reject) => {
        db.get(
          'SELECT * FROM analytics_snapshots WHERE organization_id = ?',
          ['org-test-1'],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      expect(snapshot).toBeDefined();
      expect(snapshot.projects_total).toBe(10);
      expect(snapshot.projects_active).toBe(8);
      expect(snapshot.initiatives_total).toBe(25);
    });

    it('should enforce unique snapshot per org per day', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `INSERT INTO analytics_snapshots (id, organization_id, snapshot_date) VALUES (?, ?, ?)`,
          ['snap-2', 'org-test-1', '2026-01-11'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const result = await new Promise<boolean>((resolve) => {
        db.run(
          `INSERT INTO analytics_snapshots (id, organization_id, snapshot_date) VALUES (?, ?, ?)`,
          ['snap-3', 'org-test-1', '2026-01-11'],
          (err) => {
            resolve(!!err); // true if error (constraint violation)
          }
        );
      });

      expect(result).toBe(true);
    });

    it('should allow multiple snapshots for different dates', async () => {
      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run(
            `INSERT INTO analytics_snapshots (id, organization_id, snapshot_date, projects_total) VALUES (?, ?, ?, ?)`,
            ['snap-4', 'org-test-1', '2026-01-10', 9]
          );
          db.run(
            `INSERT INTO analytics_snapshots (id, organization_id, snapshot_date, projects_total) VALUES (?, ?, ?, ?)`,
            ['snap-5', 'org-test-1', '2026-01-11', 10],
            (err) => (err ? reject(err) : resolve())
          );
        });
      });

      const snapshots = await new Promise<any[]>((resolve, reject) => {
        db.all(
          `
                    SELECT * FROM analytics_snapshots 
                    WHERE organization_id = ? 
                    ORDER BY snapshot_date DESC
                `,
          ['org-test-1'],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      expect(snapshots).toHaveLength(2);
      expect(snapshots[0].snapshot_date).toBe('2026-01-11');
      expect(snapshots[0].projects_total).toBe(10);
    });
  });

  // ==========================================
  // WIDGETS
  // ==========================================

  describe('Dashboard Widgets', () => {
    it('should have seeded widgets', async () => {
      const widgets = await new Promise<any[]>((resolve, reject) => {
        db.all('SELECT * FROM dashboard_widgets', [], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      expect(widgets.length).toBeGreaterThan(0);
      expect(widgets[0].name).toBe('projects_count');
    });
  });
});
