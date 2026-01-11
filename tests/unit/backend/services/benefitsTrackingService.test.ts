/**
 * Benefits Tracking Service Tests
 * FLOW-BENEFITS-001: Benefits Tracking & KPIs
 *
 * Tests for initiative benefits, KPI definitions, and measurements
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('BenefitsTrackingService', () => {
  let db: sqlite3.Database;

  beforeAll(async () => {
    db = new sqlite3.Database(':memory:');

    await new Promise<void>((resolve, reject) => {
      db.serialize(() => {
        // Organizations & Initiatives
        db.run(`CREATE TABLE IF NOT EXISTS organizations (id TEXT PRIMARY KEY, name TEXT)`);
        db.run(
          `CREATE TABLE IF NOT EXISTS initiatives (id TEXT PRIMARY KEY, organization_id TEXT, name TEXT, status TEXT)`
        );

        // KPI Definitions
        db.run(`
                    CREATE TABLE IF NOT EXISTS kpi_definitions (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT,
                        name TEXT NOT NULL,
                        description TEXT,
                        category TEXT NOT NULL,
                        unit TEXT NOT NULL,
                        calculation_method TEXT DEFAULT 'manual',
                        target_direction TEXT DEFAULT 'increase',
                        is_system_defined INTEGER DEFAULT 0,
                        is_active INTEGER DEFAULT 1,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);

        // Initiative Benefits
        db.run(`
                    CREATE TABLE IF NOT EXISTS initiative_benefits (
                        id TEXT PRIMARY KEY,
                        initiative_id TEXT NOT NULL,
                        kpi_id TEXT NOT NULL,
                        benefit_type TEXT NOT NULL,
                        baseline_value REAL,
                        target_value REAL NOT NULL,
                        current_value REAL,
                        target_date DATE,
                        status TEXT DEFAULT 'tracking',
                        confidence_level TEXT DEFAULT 'medium',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(initiative_id, kpi_id)
                    )
                `);

        // Benefit Measurements
        db.run(`
                    CREATE TABLE IF NOT EXISTS benefit_measurements (
                        id TEXT PRIMARY KEY,
                        benefit_id TEXT NOT NULL,
                        measured_value REAL NOT NULL,
                        measurement_date DATE NOT NULL,
                        notes TEXT,
                        measured_by TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);

        // Benefit Targets
        db.run(`
                    CREATE TABLE IF NOT EXISTS benefit_targets (
                        id TEXT PRIMARY KEY,
                        benefit_id TEXT NOT NULL,
                        target_date DATE NOT NULL,
                        target_value REAL NOT NULL,
                        is_milestone INTEGER DEFAULT 0,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);

        // Seed data
        db.run(`INSERT INTO organizations (id, name) VALUES ('org-1', 'Test Org')`);
        db.run(
          `INSERT INTO initiatives (id, organization_id, name, status) VALUES ('init-1', 'org-1', 'Test Initiative', 'executing')`,
          (err) => (err ? reject(err) : resolve())
        );
      });
    });
  });

  afterAll(() => db.close());

  beforeEach(async () => {
    await new Promise<void>((resolve) => {
      db.serialize(() => {
        db.run('DELETE FROM kpi_definitions');
        db.run('DELETE FROM initiative_benefits');
        db.run('DELETE FROM benefit_measurements');
        db.run('DELETE FROM benefit_targets', () => resolve());
      });
    });
  });

  // ==========================================
  // KPI DEFINITIONS
  // ==========================================

  describe('KPI Definitions', () => {
    it('should create a KPI definition', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `
                    INSERT INTO kpi_definitions (id, organization_id, name, description, category, unit, target_direction)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `,
          [
            'kpi-1',
            'org-1',
            'Cost Reduction',
            'Reduction in operational costs',
            'financial',
            'USD',
            'decrease',
          ],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const kpi = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM kpi_definitions WHERE id = ?', ['kpi-1'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(kpi).toBeDefined();
      expect(kpi.name).toBe('Cost Reduction');
      expect(kpi.category).toBe('financial');
      expect(kpi.target_direction).toBe('decrease');
    });

    it('should create system-defined KPIs', async () => {
      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run(
            `INSERT INTO kpi_definitions (id, name, category, unit, is_system_defined) VALUES (?, ?, ?, ?, ?)`,
            ['kpi-sys-1', 'Cycle Time', 'operational', 'days', 1]
          );
          db.run(
            `INSERT INTO kpi_definitions (id, name, category, unit, is_system_defined) VALUES (?, ?, ?, ?, ?)`,
            ['kpi-sys-2', 'Quality Score', 'quality', 'percent', 1],
            (err) => (err ? reject(err) : resolve())
          );
        });
      });

      const systemKpis = await new Promise<any[]>((resolve, reject) => {
        db.all('SELECT * FROM kpi_definitions WHERE is_system_defined = 1', [], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      expect(systemKpis).toHaveLength(2);
    });

    it('should list KPIs by category', async () => {
      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run(
            `INSERT INTO kpi_definitions (id, organization_id, name, category, unit) VALUES (?, ?, ?, ?, ?)`,
            ['kpi-f1', 'org-1', 'Revenue', 'financial', 'USD']
          );
          db.run(
            `INSERT INTO kpi_definitions (id, organization_id, name, category, unit) VALUES (?, ?, ?, ?, ?)`,
            ['kpi-f2', 'org-1', 'ROI', 'financial', 'percent']
          );
          db.run(
            `INSERT INTO kpi_definitions (id, organization_id, name, category, unit) VALUES (?, ?, ?, ?, ?)`,
            ['kpi-o1', 'org-1', 'Efficiency', 'operational', 'percent'],
            (err) => (err ? reject(err) : resolve())
          );
        });
      });

      const financialKpis = await new Promise<any[]>((resolve, reject) => {
        db.all(
          `SELECT * FROM kpi_definitions WHERE organization_id = ? AND category = ?`,
          ['org-1', 'financial'],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      expect(financialKpis).toHaveLength(2);
    });
  });

  // ==========================================
  // INITIATIVE BENEFITS
  // ==========================================

  describe('Initiative Benefits', () => {
    beforeEach(async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `INSERT INTO kpi_definitions (id, organization_id, name, category, unit) VALUES (?, ?, ?, ?, ?)`,
          ['kpi-test', 'org-1', 'Test KPI', 'financial', 'USD'],
          (err) => (err ? reject(err) : resolve())
        );
      });
    });

    it('should link benefit to initiative', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `
                    INSERT INTO initiative_benefits (id, initiative_id, kpi_id, benefit_type, baseline_value, target_value, target_date)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `,
          ['benefit-1', 'init-1', 'kpi-test', 'cost_savings', 100000, 80000, '2026-12-31'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const benefit = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM initiative_benefits WHERE id = ?', ['benefit-1'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(benefit).toBeDefined();
      expect(benefit.initiative_id).toBe('init-1');
      expect(benefit.baseline_value).toBe(100000);
      expect(benefit.target_value).toBe(80000);
    });

    it('should enforce unique KPI per initiative', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `INSERT INTO initiative_benefits (id, initiative_id, kpi_id, benefit_type, target_value) VALUES (?, ?, ?, ?, ?)`,
          ['benefit-2', 'init-1', 'kpi-test', 'cost_savings', 50000],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const result = await new Promise<boolean>((resolve) => {
        db.run(
          `INSERT INTO initiative_benefits (id, initiative_id, kpi_id, benefit_type, target_value) VALUES (?, ?, ?, ?, ?)`,
          ['benefit-3', 'init-1', 'kpi-test', 'revenue', 60000],
          (err) => {
            resolve(!!err);
          }
        );
      });

      expect(result).toBe(true); // Should fail due to unique constraint
    });

    it('should track benefit status', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `INSERT INTO initiative_benefits (id, initiative_id, kpi_id, benefit_type, target_value, status) VALUES (?, ?, ?, ?, ?, ?)`,
          ['benefit-4', 'init-1', 'kpi-test', 'efficiency', 95, 'on_track'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run(
          `UPDATE initiative_benefits SET status = ?, current_value = ? WHERE id = ?`,
          ['achieved', 96, 'benefit-4'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const benefit = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM initiative_benefits WHERE id = ?', ['benefit-4'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(benefit.status).toBe('achieved');
      expect(benefit.current_value).toBe(96);
    });
  });

  // ==========================================
  // BENEFIT MEASUREMENTS
  // ==========================================

  describe('Benefit Measurements', () => {
    beforeEach(async () => {
      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run(
            `INSERT INTO kpi_definitions (id, organization_id, name, category, unit) VALUES (?, ?, ?, ?, ?)`,
            ['kpi-m', 'org-1', 'Measurement KPI', 'operational', 'hours']
          );
          db.run(
            `INSERT INTO initiative_benefits (id, initiative_id, kpi_id, benefit_type, target_value) VALUES (?, ?, ?, ?, ?)`,
            ['benefit-m', 'init-1', 'kpi-m', 'time_savings', 100],
            (err) => (err ? reject(err) : resolve())
          );
        });
      });
    });

    it('should record measurement', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `
                    INSERT INTO benefit_measurements (id, benefit_id, measured_value, measurement_date, notes, measured_by)
                    VALUES (?, ?, ?, ?, ?, ?)
                `,
          ['meas-1', 'benefit-m', 75, '2026-01-10', 'Q1 measurement', 'user-1'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const measurement = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM benefit_measurements WHERE id = ?', ['meas-1'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(measurement).toBeDefined();
      expect(measurement.measured_value).toBe(75);
      expect(measurement.notes).toBe('Q1 measurement');
    });

    it('should track measurement history', async () => {
      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run(
            `INSERT INTO benefit_measurements (id, benefit_id, measured_value, measurement_date) VALUES (?, ?, ?, ?)`,
            ['meas-h1', 'benefit-m', 50, '2026-01-01']
          );
          db.run(
            `INSERT INTO benefit_measurements (id, benefit_id, measured_value, measurement_date) VALUES (?, ?, ?, ?)`,
            ['meas-h2', 'benefit-m', 65, '2026-02-01']
          );
          db.run(
            `INSERT INTO benefit_measurements (id, benefit_id, measured_value, measurement_date) VALUES (?, ?, ?, ?)`,
            ['meas-h3', 'benefit-m', 80, '2026-03-01'],
            (err) => (err ? reject(err) : resolve())
          );
        });
      });

      const history = await new Promise<any[]>((resolve, reject) => {
        db.all(
          `SELECT * FROM benefit_measurements WHERE benefit_id = ? ORDER BY measurement_date ASC`,
          ['benefit-m'],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      expect(history).toHaveLength(3);
      expect(history[0].measured_value).toBe(50);
      expect(history[2].measured_value).toBe(80);
    });
  });

  // ==========================================
  // BENEFIT TARGETS
  // ==========================================

  describe('Benefit Targets', () => {
    beforeEach(async () => {
      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run(
            `INSERT INTO kpi_definitions (id, organization_id, name, category, unit) VALUES (?, ?, ?, ?, ?)`,
            ['kpi-t', 'org-1', 'Target KPI', 'financial', 'USD']
          );
          db.run(
            `INSERT INTO initiative_benefits (id, initiative_id, kpi_id, benefit_type, target_value) VALUES (?, ?, ?, ?, ?)`,
            ['benefit-t', 'init-1', 'kpi-t', 'revenue', 100000],
            (err) => (err ? reject(err) : resolve())
          );
        });
      });
    });

    it('should set milestone targets', async () => {
      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run(
            `INSERT INTO benefit_targets (id, benefit_id, target_date, target_value, is_milestone) VALUES (?, ?, ?, ?, ?)`,
            ['target-1', 'benefit-t', '2026-03-31', 25000, 1]
          );
          db.run(
            `INSERT INTO benefit_targets (id, benefit_id, target_date, target_value, is_milestone) VALUES (?, ?, ?, ?, ?)`,
            ['target-2', 'benefit-t', '2026-06-30', 50000, 1]
          );
          db.run(
            `INSERT INTO benefit_targets (id, benefit_id, target_date, target_value, is_milestone) VALUES (?, ?, ?, ?, ?)`,
            ['target-3', 'benefit-t', '2026-12-31', 100000, 1],
            (err) => (err ? reject(err) : resolve())
          );
        });
      });

      const milestones = await new Promise<any[]>((resolve, reject) => {
        db.all(
          `SELECT * FROM benefit_targets WHERE benefit_id = ? AND is_milestone = 1 ORDER BY target_date`,
          ['benefit-t'],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      expect(milestones).toHaveLength(3);
      expect(milestones[0].target_value).toBe(25000);
      expect(milestones[2].target_value).toBe(100000);
    });
  });
});
