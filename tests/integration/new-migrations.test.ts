/**
 * New Migrations Tests (260-267)
 * Tests for Sprint 5 & 6 migrations
 *
 * Verifies that migration SQL files create correct tables and constraints
 */

import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import sqlite3 from 'sqlite3';
import * as fs from 'fs';
import * as path from 'path';

describe('New Migrations (260-267)', () => {
  let db: sqlite3.Database;
  const migrationsPath = path.join(__dirname, '../../server/migrations');

  // Helper to run SQL
  const runSQL = (sql: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      db.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  };

  // Helper to query
  const query = <T>(sql: string, params: any[] = []): Promise<T[]> => {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as T[]);
      });
    });
  };

  // Helper to get single row
  const getOne = <T>(sql: string, params: any[] = []): Promise<T | undefined> => {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row as T | undefined);
      });
    });
  };

  beforeAll(async () => {
    // Create in-memory database
    db = new sqlite3.Database(':memory:');

    // Enable foreign keys
    await runSQL('PRAGMA foreign_keys = ON');

    // Create prerequisite tables
    await runSQL(`
            CREATE TABLE IF NOT EXISTS organizations (id TEXT PRIMARY KEY, name TEXT);
            CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT, organization_id TEXT);
            CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, organization_id TEXT, name TEXT);
            CREATE TABLE IF NOT EXISTS initiatives (id TEXT PRIMARY KEY, organization_id TEXT, project_id TEXT);
            INSERT INTO organizations (id, name) VALUES ('org-test-1', 'Test Org');
        `);
  });

  afterAll(() => {
    db.close();
  });

  // Helper to run migration file
  const runMigration = async (filename: string) => {
    const filePath = path.join(migrationsPath, filename);
    if (fs.existsSync(filePath)) {
      const sql = fs.readFileSync(filePath, 'utf-8');
      // Split by semicolon and run each statement
      const statements = sql.split(';').filter((s) => s.trim() && !s.trim().startsWith('--'));
      for (const statement of statements) {
        if (statement.trim()) {
          try {
            await runSQL(statement);
          } catch (err: any) {
            // Ignore "already exists" errors
            if (!err.message.includes('already exists')) {
              console.warn(`Warning in ${filename}:`, err.message.slice(0, 100));
            }
          }
        }
      }
    } else {
      console.warn(`Migration file not found: ${filename}`);
    }
  };

  // ==========================================
  // MIGRATION 260: Enterprise Features
  // ==========================================

  describe('260_enterprise_features.sql', () => {
    beforeAll(async () => {
      await runMigration('260_enterprise_features.sql');
    });

    it('should create enterprise_contracts table', async () => {
      const tables = await query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='enterprise_contracts'"
      );
      expect(tables.length).toBe(1);
    });

    it('should create data_residency table', async () => {
      const tables = await query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='data_residency'"
      );
      expect(tables.length).toBe(1);
    });

    it('should create white_label_config table', async () => {
      const tables = await query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='white_label_config'"
      );
      expect(tables.length).toBe(1);
    });

    it('should create sla_tracking table', async () => {
      const tables = await query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='sla_tracking'"
      );
      expect(tables.length).toBe(1);
    });

    it('should allow inserting enterprise contract', async () => {
      await runSQL(`
                INSERT INTO enterprise_contracts (
                    id, organization_id, contract_type, start_date, sla_level, uptime_guarantee, status
                ) VALUES ('contract-1', 'org-test-1', 'enterprise', '2026-01-01', 'enterprise', 99.9, 'active')
            `);

      const contract = await getOne<any>('SELECT * FROM enterprise_contracts WHERE id = ?', [
        'contract-1',
      ]);
      expect(contract).toBeDefined();
      expect(contract?.contract_type).toBe('enterprise');
    });
  });

  // ==========================================
  // MIGRATION 261: Analytics System
  // ==========================================

  describe('261_analytics_system.sql', () => {
    beforeAll(async () => {
      await runMigration('261_analytics_system.sql');
    });

    it('should create analytics_snapshots table', async () => {
      const tables = await query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='analytics_snapshots'"
      );
      expect(tables.length).toBe(1);
    });

    it('should create custom_dashboards table', async () => {
      const tables = await query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='custom_dashboards'"
      );
      expect(tables.length).toBe(1);
    });

    it('should seed default widgets', async () => {
      const widgets = await query<any>('SELECT COUNT(*) as count FROM dashboard_widgets');
      expect(widgets[0]?.count).toBeGreaterThan(0);
    });
  });

  // ==========================================
  // MIGRATION 262: Benefits Tracking
  // ==========================================

  describe('262_benefits_tracking.sql', () => {
    beforeAll(async () => {
      await runMigration('262_benefits_tracking.sql');
    });

    it('should create kpi_definitions table', async () => {
      const tables = await query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='kpi_definitions'"
      );
      expect(tables.length).toBe(1);
    });

    it('should create initiative_benefits table', async () => {
      const tables = await query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='initiative_benefits'"
      );
      expect(tables.length).toBe(1);
    });

    it('should seed default KPIs', async () => {
      const kpis = await query<any>('SELECT COUNT(*) as count FROM kpi_definitions');
      expect(kpis[0]?.count).toBeGreaterThan(0);
    });
  });

  // ==========================================
  // MIGRATION 263: GDPR Compliance
  // ==========================================

  describe('263_gdpr_compliance.sql', () => {
    beforeAll(async () => {
      await runMigration('263_gdpr_compliance.sql');
    });

    it('should create data_subject_requests table', async () => {
      const tables = await query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='data_subject_requests'"
      );
      expect(tables.length).toBe(1);
    });

    it('should create consent_records table', async () => {
      const tables = await query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='consent_records'"
      );
      expect(tables.length).toBe(1);
    });

    it('should create retention_policies table', async () => {
      const tables = await query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='retention_policies'"
      );
      expect(tables.length).toBe(1);
    });

    it('should seed default retention policies', async () => {
      const policies = await query<any>('SELECT COUNT(*) as count FROM retention_policies');
      expect(policies[0]?.count).toBeGreaterThan(0);
    });

    it('should seed sub_processors', async () => {
      const processors = await query<any>('SELECT COUNT(*) as count FROM sub_processors');
      expect(processors[0]?.count).toBeGreaterThan(0);
    });
  });

  // ==========================================
  // MIGRATION 264: White-label Extended
  // ==========================================

  describe('264_whitelabel_extended.sql', () => {
    beforeAll(async () => {
      await runMigration('264_whitelabel_extended.sql');
    });

    it('should create white_label_assets table', async () => {
      const tables = await query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='white_label_assets'"
      );
      expect(tables.length).toBe(1);
    });

    it('should create domain_verifications table', async () => {
      const tables = await query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='domain_verifications'"
      );
      expect(tables.length).toBe(1);
    });

    it('should seed white_label_themes', async () => {
      const themes = await query<any>('SELECT COUNT(*) as count FROM white_label_themes');
      expect(themes[0]?.count).toBeGreaterThanOrEqual(5);
    });
  });

  // ==========================================
  // MIGRATION 265: Mobile PWA
  // ==========================================

  describe('265_mobile_pwa.sql', () => {
    beforeAll(async () => {
      await runMigration('265_mobile_pwa.sql');
    });

    it('should create mobile_devices table', async () => {
      const tables = await query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='mobile_devices'"
      );
      expect(tables.length).toBe(1);
    });

    it('should create mobile_preferences table', async () => {
      const tables = await query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='mobile_preferences'"
      );
      expect(tables.length).toBe(1);
    });

    it('should create offline_sync_queue table', async () => {
      const tables = await query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='offline_sync_queue'"
      );
      expect(tables.length).toBe(1);
    });
  });

  // ==========================================
  // MIGRATION 266: Knowledge RAG
  // ==========================================

  describe('266_knowledge_rag.sql', () => {
    beforeAll(async () => {
      await runMigration('266_knowledge_rag.sql');
    });

    it('should create knowledge_documents table', async () => {
      const tables = await query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='knowledge_documents'"
      );
      expect(tables.length).toBe(1);
    });

    it('should create knowledge_chunks table', async () => {
      const tables = await query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='knowledge_chunks'"
      );
      expect(tables.length).toBe(1);
    });

    it('should create knowledge_queries table', async () => {
      const tables = await query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='knowledge_queries'"
      );
      expect(tables.length).toBe(1);
    });
  });

  // ==========================================
  // MIGRATION 267: Sandbox Project
  // ==========================================

  describe('267_sandbox_project.sql', () => {
    beforeAll(async () => {
      await runMigration('267_sandbox_project.sql');
    });

    it('should create sandbox_projects table', async () => {
      const tables = await query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='sandbox_projects'"
      );
      expect(tables.length).toBe(1);
    });

    it('should seed sandbox_templates', async () => {
      const templates = await query<any>('SELECT COUNT(*) as count FROM sandbox_templates');
      expect(templates[0]?.count).toBeGreaterThanOrEqual(5);
    });

    it('should create sandbox_exports table', async () => {
      const tables = await query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='sandbox_exports'"
      );
      expect(tables.length).toBe(1);
    });
  });

  // ==========================================
  // SUMMARY TEST
  // ==========================================

  describe('Migration Summary', () => {
    it('should have all core tables created', async () => {
      const expectedTables = [
        'enterprise_contracts',
        'data_residency',
        'white_label_config',
        'sla_tracking',
        'analytics_snapshots',
        'custom_dashboards',
        'kpi_definitions',
        'data_subject_requests',
        'mobile_devices',
        'knowledge_documents',
        'sandbox_projects',
      ];

      for (const tableName of expectedTables) {
        const tables = await query<{ name: string }>(
          `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
          [tableName]
        );
        expect(tables.length).toBe(1);
      }
    });
  });
});
