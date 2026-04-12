/**
 * EnterpriseService Unit Tests
 * FLOW-ENTERPRISE-001: Enterprise features management
 *
 * Uses in-memory SQLite database for testing
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('EnterpriseService', () => {
  let db: sqlite3.Database;

  beforeAll(async () => {
    // Create in-memory database
    db = new sqlite3.Database(':memory:');

    await new Promise<void>((resolve, reject) => {
      db.serialize(() => {
        // Organizations table
        db.run(`
                    CREATE TABLE IF NOT EXISTS organizations (
                        id TEXT PRIMARY KEY,
                        name TEXT
                    )
                `);

        // Enterprise contracts
        db.run(`
                    CREATE TABLE IF NOT EXISTS enterprise_contracts (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        contract_type TEXT NOT NULL DEFAULT 'standard',
                        contract_number TEXT UNIQUE,
                        start_date DATE NOT NULL,
                        end_date DATE,
                        sla_level TEXT DEFAULT 'standard',
                        uptime_guarantee REAL DEFAULT 99.9,
                        status TEXT DEFAULT 'active',
                        max_users INTEGER,
                        max_projects INTEGER,
                        account_manager_name TEXT,
                        account_manager_email TEXT,
                        created_by TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);

        // Data residency
        db.run(`
                    CREATE TABLE IF NOT EXISTS data_residency (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL UNIQUE,
                        region TEXT NOT NULL DEFAULT 'eu',
                        region_locked INTEGER DEFAULT 0,
                        data_sovereignty_required INTEGER DEFAULT 0,
                        cross_border_transfer_allowed INTEGER DEFAULT 1,
                        ai_processing_region TEXT DEFAULT 'same',
                        configured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        configured_by TEXT
                    )
                `);

        // White-label config
        db.run(`
                    CREATE TABLE IF NOT EXISTS white_label_config (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL UNIQUE,
                        logo_light_url TEXT,
                        logo_dark_url TEXT,
                        favicon_url TEXT,
                        color_primary TEXT,
                        color_secondary TEXT,
                        custom_domain TEXT,
                        custom_domain_status TEXT DEFAULT 'pending',
                        email_from_name TEXT,
                        email_from_address TEXT,
                        hide_consultinity_branding INTEGER DEFAULT 0,
                        is_enabled INTEGER DEFAULT 0,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);

        // SLA tracking
        db.run(`
                    CREATE TABLE IF NOT EXISTS sla_tracking (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        month DATE NOT NULL,
                        uptime_percentage REAL,
                        sla_target REAL,
                        sla_met INTEGER DEFAULT 1,
                        incidents_total INTEGER DEFAULT 0,
                        tickets_total INTEGER DEFAULT 0,
                        tickets_within_sla INTEGER DEFAULT 0,
                        avg_first_response_minutes INTEGER,
                        credit_amount REAL DEFAULT 0,
                        UNIQUE(organization_id, month)
                    )
                `);

        // Seed test org
        db.run(
          `INSERT INTO organizations (id, name) VALUES ('org-test-1', 'Test Organization')`,
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
        db.run('DELETE FROM enterprise_contracts');
        db.run('DELETE FROM data_residency');
        db.run('DELETE FROM white_label_config');
        db.run('DELETE FROM sla_tracking', () => resolve());
      });
    });
  });

  // ==========================================
  // CONTRACT TESTS
  // ==========================================

  describe('Enterprise Contracts', () => {
    it('should create a new contract', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `
                    INSERT INTO enterprise_contracts (
                        id, organization_id, contract_type, contract_number, 
                        start_date, sla_level, uptime_guarantee, status, created_by
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
          [
            'contract-1',
            'org-test-1',
            'enterprise',
            'ENT-001',
            '2026-01-01',
            'enterprise',
            99.9,
            'active',
            'admin-1',
          ],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const contract = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM enterprise_contracts WHERE id = ?', ['contract-1'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(contract).toBeDefined();
      expect(contract.organization_id).toBe('org-test-1');
      expect(contract.contract_type).toBe('enterprise');
      expect(contract.uptime_guarantee).toBe(99.9);
    });

    it('should update existing contract', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `
                    INSERT INTO enterprise_contracts (id, organization_id, contract_type, contract_number, start_date, max_users)
                    VALUES (?, ?, ?, ?, ?, ?)
                `,
          ['contract-2', 'org-test-1', 'standard', 'ENT-002', '2026-01-01', 50],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run(
          'UPDATE enterprise_contracts SET max_users = ?, contract_type = ? WHERE id = ?',
          [100, 'enterprise', 'contract-2'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const contract = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM enterprise_contracts WHERE id = ?', ['contract-2'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(contract.max_users).toBe(100);
      expect(contract.contract_type).toBe('enterprise');
    });

    it('should retrieve contract by organization', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `
                    INSERT INTO enterprise_contracts (id, organization_id, contract_type, start_date, status)
                    VALUES (?, ?, ?, ?, ?)
                `,
          ['contract-3', 'org-test-1', 'enterprise', '2026-01-01', 'active'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const contract = await new Promise<any>((resolve, reject) => {
        db.get(
          `
                    SELECT * FROM enterprise_contracts WHERE organization_id = ? AND status = 'active'
                `,
          ['org-test-1'],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      expect(contract).toBeDefined();
      expect(contract.id).toBe('contract-3');
    });
  });

  // ==========================================
  // DATA RESIDENCY TESTS
  // ==========================================

  describe('Data Residency', () => {
    it('should create data residency config', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `
                    INSERT INTO data_residency (id, organization_id, region, data_sovereignty_required, configured_by)
                    VALUES (?, ?, ?, ?, ?)
                `,
          ['residency-1', 'org-test-1', 'eu', 1, 'admin-1'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const config = await new Promise<any>((resolve, reject) => {
        db.get(
          'SELECT * FROM data_residency WHERE organization_id = ?',
          ['org-test-1'],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      expect(config).toBeDefined();
      expect(config.region).toBe('eu');
      expect(config.data_sovereignty_required).toBe(1);
    });

    it('should store region lock status', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `
                    INSERT INTO data_residency (id, organization_id, region, region_locked)
                    VALUES (?, ?, ?, ?)
                `,
          ['residency-4', 'org-test-1', 'eu', 1],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const config = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM data_residency WHERE id = ?', ['residency-4'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(config.region_locked).toBe(1);
    });
  });

  // ==========================================
  // WHITE-LABEL TESTS
  // ==========================================

  describe('White-label Config', () => {
    it('should create white-label config', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `
                    INSERT INTO white_label_config (
                        id, organization_id, logo_light_url, color_primary, is_enabled
                    ) VALUES (?, ?, ?, ?, ?)
                `,
          ['wl-1', 'org-test-1', 'https://example.com/logo.png', '#3B82F6', 1],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const config = await new Promise<any>((resolve, reject) => {
        db.get(
          'SELECT * FROM white_label_config WHERE organization_id = ?',
          ['org-test-1'],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      expect(config).toBeDefined();
      expect(config.logo_light_url).toBe('https://example.com/logo.png');
      expect(config.color_primary).toBe('#3B82F6');
      expect(config.is_enabled).toBe(1);
    });

    it('should store custom domain with status', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `
                    INSERT INTO white_label_config (id, organization_id, custom_domain, custom_domain_status)
                    VALUES (?, ?, ?, ?)
                `,
          ['wl-2', 'org-test-1', 'app.example.com', 'verified'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const config = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM white_label_config WHERE id = ?', ['wl-2'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(config.custom_domain).toBe('app.example.com');
      expect(config.custom_domain_status).toBe('verified');
    });
  });

  // ==========================================
  // SLA TRACKING TESTS
  // ==========================================

  describe('SLA Tracking', () => {
    it('should record SLA metrics', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `
                    INSERT INTO sla_tracking (
                        id, organization_id, month, uptime_percentage, sla_target, sla_met, incidents_total
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                `,
          ['sla-1', 'org-test-1', '2026-01-01', 99.95, 99.9, 1, 2],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const metrics = await new Promise<any>((resolve, reject) => {
        db.get(
          'SELECT * FROM sla_tracking WHERE organization_id = ?',
          ['org-test-1'],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      expect(metrics).toBeDefined();
      expect(metrics.uptime_percentage).toBe(99.95);
      expect(metrics.sla_met).toBe(1);
    });

    it('should track SLA breach with credit', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `
                    INSERT INTO sla_tracking (
                        id, organization_id, month, uptime_percentage, sla_target, sla_met, credit_amount
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                `,
          ['sla-2', 'org-test-1', '2025-12-01', 99.5, 99.9, 0, 150.0],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const metrics = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM sla_tracking WHERE id = ?', ['sla-2'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(metrics.sla_met).toBe(0);
      expect(metrics.credit_amount).toBe(150.0);
    });

    it('should retrieve multiple months of SLA data', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `INSERT INTO sla_tracking (id, organization_id, month, uptime_percentage) VALUES (?, ?, ?, ?)`,
          ['sla-5', 'org-test-1', '2026-01-01', 99.95],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run(
          `INSERT INTO sla_tracking (id, organization_id, month, uptime_percentage) VALUES (?, ?, ?, ?)`,
          ['sla-6', 'org-test-1', '2025-12-01', 99.85],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const metrics = await new Promise<any[]>((resolve, reject) => {
        db.all(
          `
                    SELECT * FROM sla_tracking 
                    WHERE organization_id = ? 
                    ORDER BY month DESC LIMIT 6
                `,
          ['org-test-1'],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      expect(metrics).toHaveLength(2);
      expect(metrics[0].month).toBe('2026-01-01');
      expect(metrics[1].month).toBe('2025-12-01');
    });
  });
});
