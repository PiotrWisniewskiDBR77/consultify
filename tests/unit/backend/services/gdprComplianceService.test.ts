/**
 * GDPR Compliance Service Tests
 * FLOW-GDPR-001: GDPR & Data Compliance
 *
 * Tests for DSAR requests, consent management, data retention
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('GDPRComplianceService', () => {
  let db: sqlite3.Database;

  beforeAll(async () => {
    db = new sqlite3.Database(':memory:');

    await new Promise<void>((resolve, reject) => {
      db.serialize(() => {
        // Prerequisites
        db.run(`CREATE TABLE IF NOT EXISTS organizations (id TEXT PRIMARY KEY, name TEXT)`);
        db.run(
          `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT, organization_id TEXT)`
        );

        // Data Subject Requests (DSAR)
        db.run(`
                    CREATE TABLE IF NOT EXISTS data_subject_requests (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        user_id TEXT,
                        request_type TEXT NOT NULL,
                        email TEXT NOT NULL,
                        status TEXT DEFAULT 'pending',
                        due_date DATE NOT NULL,
                        completed_at TIMESTAMP,
                        completed_by TEXT,
                        notes TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);

        // DSAR Activity Log
        db.run(`
                    CREATE TABLE IF NOT EXISTS dsar_activity_log (
                        id TEXT PRIMARY KEY,
                        request_id TEXT NOT NULL,
                        action TEXT NOT NULL,
                        action_by TEXT NOT NULL,
                        details TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);

        // Consent Records
        db.run(`
                    CREATE TABLE IF NOT EXISTS consent_records (
                        id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        consent_type TEXT NOT NULL,
                        is_granted INTEGER DEFAULT 0,
                        granted_at TIMESTAMP,
                        revoked_at TIMESTAMP,
                        ip_address TEXT,
                        user_agent TEXT,
                        version TEXT DEFAULT '1.0',
                        UNIQUE(user_id, consent_type)
                    )
                `);

        // Retention Policies
        db.run(`
                    CREATE TABLE IF NOT EXISTS retention_policies (
                        id TEXT PRIMARY KEY,
                        data_category TEXT NOT NULL UNIQUE,
                        retention_days INTEGER NOT NULL,
                        description TEXT,
                        legal_basis TEXT,
                        is_active INTEGER DEFAULT 1
                    )
                `);

        // Data Deletion Log
        db.run(`
                    CREATE TABLE IF NOT EXISTS data_deletion_log (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT,
                        user_id TEXT,
                        data_type TEXT NOT NULL,
                        record_count INTEGER DEFAULT 0,
                        deletion_reason TEXT NOT NULL,
                        deleted_by TEXT NOT NULL,
                        deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);

        // Sub-processors
        db.run(`
                    CREATE TABLE IF NOT EXISTS sub_processors (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        purpose TEXT NOT NULL,
                        data_types TEXT NOT NULL,
                        location TEXT NOT NULL,
                        dpa_signed INTEGER DEFAULT 0,
                        is_active INTEGER DEFAULT 1,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);

        // Legal Holds
        db.run(`
                    CREATE TABLE IF NOT EXISTS legal_holds (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        hold_name TEXT NOT NULL,
                        reason TEXT NOT NULL,
                        affected_data TEXT NOT NULL,
                        start_date DATE NOT NULL,
                        end_date DATE,
                        status TEXT DEFAULT 'active',
                        created_by TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);

        // Seed data
        db.run(`INSERT INTO organizations (id, name) VALUES ('org-1', 'Test Org')`);
        db.run(
          `INSERT INTO users (id, email, organization_id) VALUES ('user-1', 'test@example.com', 'org-1')`,
          (err) => (err ? reject(err) : resolve())
        );
      });
    });
  });

  afterAll(() => db.close());

  beforeEach(async () => {
    await new Promise<void>((resolve) => {
      db.serialize(() => {
        db.run('DELETE FROM data_subject_requests');
        db.run('DELETE FROM dsar_activity_log');
        db.run('DELETE FROM consent_records');
        db.run('DELETE FROM retention_policies');
        db.run('DELETE FROM data_deletion_log');
        db.run('DELETE FROM sub_processors');
        db.run('DELETE FROM legal_holds', () => resolve());
      });
    });
  });

  // ==========================================
  // DATA SUBJECT REQUESTS (DSAR)
  // ==========================================

  describe('Data Subject Requests', () => {
    it('should create DSAR request', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `
                    INSERT INTO data_subject_requests (id, organization_id, user_id, request_type, email, due_date)
                    VALUES (?, ?, ?, ?, ?, ?)
                `,
          ['dsar-1', 'org-1', 'user-1', 'access', 'test@example.com', '2026-02-10'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const request = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM data_subject_requests WHERE id = ?', ['dsar-1'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(request).toBeDefined();
      expect(request.request_type).toBe('access');
      expect(request.status).toBe('pending');
    });

    it('should support different request types', async () => {
      const requestTypes = ['access', 'erasure', 'rectification', 'portability', 'restriction'];

      for (let i = 0; i < requestTypes.length; i++) {
        await new Promise<void>((resolve, reject) => {
          db.run(
            `INSERT INTO data_subject_requests (id, organization_id, request_type, email, due_date) VALUES (?, ?, ?, ?, ?)`,
            [`dsar-type-${i}`, 'org-1', requestTypes[i], 'test@example.com', '2026-02-10'],
            (err) => (err ? reject(err) : resolve())
          );
        });
      }

      const requests = await new Promise<any[]>((resolve, reject) => {
        db.all('SELECT request_type FROM data_subject_requests', [], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      expect(requests).toHaveLength(5);
      expect(requests.map((r) => r.request_type)).toEqual(expect.arrayContaining(requestTypes));
    });

    it('should update DSAR status', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `INSERT INTO data_subject_requests (id, organization_id, request_type, email, due_date, status) VALUES (?, ?, ?, ?, ?, ?)`,
          ['dsar-2', 'org-1', 'erasure', 'test@example.com', '2026-02-10', 'pending'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run(
          `UPDATE data_subject_requests SET status = ?, completed_at = ?, completed_by = ? WHERE id = ?`,
          ['completed', new Date().toISOString(), 'admin-1', 'dsar-2'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const request = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM data_subject_requests WHERE id = ?', ['dsar-2'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(request.status).toBe('completed');
      expect(request.completed_by).toBe('admin-1');
    });

    it('should log DSAR activity', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `INSERT INTO data_subject_requests (id, organization_id, request_type, email, due_date) VALUES (?, ?, ?, ?, ?)`,
          ['dsar-3', 'org-1', 'access', 'test@example.com', '2026-02-10'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run(
            `INSERT INTO dsar_activity_log (id, request_id, action, action_by, details) VALUES (?, ?, ?, ?, ?)`,
            ['log-1', 'dsar-3', 'created', 'system', 'Request submitted via web form']
          );
          db.run(
            `INSERT INTO dsar_activity_log (id, request_id, action, action_by, details) VALUES (?, ?, ?, ?, ?)`,
            ['log-2', 'dsar-3', 'assigned', 'admin-1', 'Assigned to DPO']
          );
          db.run(
            `INSERT INTO dsar_activity_log (id, request_id, action, action_by, details) VALUES (?, ?, ?, ?, ?)`,
            ['log-3', 'dsar-3', 'completed', 'admin-1', 'Data export sent'],
            (err) => (err ? reject(err) : resolve())
          );
        });
      });

      const logs = await new Promise<any[]>((resolve, reject) => {
        db.all(
          'SELECT * FROM dsar_activity_log WHERE request_id = ? ORDER BY created_at',
          ['dsar-3'],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      expect(logs).toHaveLength(3);
      expect(logs[0].action).toBe('created');
      expect(logs[2].action).toBe('completed');
    });
  });

  // ==========================================
  // CONSENT MANAGEMENT
  // ==========================================

  describe('Consent Management', () => {
    it('should record consent', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `
                    INSERT INTO consent_records (id, user_id, consent_type, is_granted, granted_at, ip_address)
                    VALUES (?, ?, ?, ?, ?, ?)
                `,
          ['consent-1', 'user-1', 'marketing', 1, new Date().toISOString(), '192.168.1.1'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const consent = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM consent_records WHERE id = ?', ['consent-1'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(consent).toBeDefined();
      expect(consent.is_granted).toBe(1);
      expect(consent.consent_type).toBe('marketing');
    });

    it('should enforce unique consent per user per type', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `INSERT INTO consent_records (id, user_id, consent_type, is_granted) VALUES (?, ?, ?, ?)`,
          ['consent-2', 'user-1', 'analytics', 1],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const result = await new Promise<boolean>((resolve) => {
        db.run(
          `INSERT INTO consent_records (id, user_id, consent_type, is_granted) VALUES (?, ?, ?, ?)`,
          ['consent-3', 'user-1', 'analytics', 0],
          (err) => {
            resolve(!!err);
          }
        );
      });

      expect(result).toBe(true); // Should fail due to unique constraint
    });

    it('should revoke consent', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `INSERT INTO consent_records (id, user_id, consent_type, is_granted, granted_at) VALUES (?, ?, ?, ?, ?)`,
          ['consent-4', 'user-1', 'newsletter', 1, '2026-01-01'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run(
          `UPDATE consent_records SET is_granted = 0, revoked_at = ? WHERE id = ?`,
          [new Date().toISOString(), 'consent-4'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const consent = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM consent_records WHERE id = ?', ['consent-4'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(consent.is_granted).toBe(0);
      expect(consent.revoked_at).not.toBeNull();
    });
  });

  // ==========================================
  // RETENTION POLICIES
  // ==========================================

  describe('Retention Policies', () => {
    it('should create retention policy', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `
                    INSERT INTO retention_policies (id, data_category, retention_days, description, legal_basis)
                    VALUES (?, ?, ?, ?, ?)
                `,
          ['policy-1', 'user_data', 365, 'User profile data', 'Contract performance'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const policy = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM retention_policies WHERE id = ?', ['policy-1'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(policy).toBeDefined();
      expect(policy.retention_days).toBe(365);
      expect(policy.legal_basis).toBe('Contract performance');
    });

    it('should seed default retention policies', async () => {
      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run(
            `INSERT INTO retention_policies (id, data_category, retention_days, description) VALUES (?, ?, ?, ?)`,
            ['rp-1', 'audit_logs', 2555, '7 years for audit logs']
          );
          db.run(
            `INSERT INTO retention_policies (id, data_category, retention_days, description) VALUES (?, ?, ?, ?)`,
            ['rp-2', 'session_data', 30, '30 days for session data']
          );
          db.run(
            `INSERT INTO retention_policies (id, data_category, retention_days, description) VALUES (?, ?, ?, ?)`,
            ['rp-3', 'inactive_accounts', 730, '2 years for inactive accounts'],
            (err) => (err ? reject(err) : resolve())
          );
        });
      });

      const policies = await new Promise<any[]>((resolve, reject) => {
        db.all('SELECT * FROM retention_policies ORDER BY retention_days', [], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      expect(policies).toHaveLength(3);
      expect(policies[0].data_category).toBe('session_data');
      expect(policies[2].data_category).toBe('audit_logs');
    });
  });

  // ==========================================
  // DATA DELETION
  // ==========================================

  describe('Data Deletion', () => {
    it('should log data deletion', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `
                    INSERT INTO data_deletion_log (id, organization_id, user_id, data_type, record_count, deletion_reason, deleted_by)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `,
          ['del-1', 'org-1', 'user-1', 'messages', 150, 'DSAR erasure request', 'admin-1'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const log = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM data_deletion_log WHERE id = ?', ['del-1'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(log).toBeDefined();
      expect(log.record_count).toBe(150);
      expect(log.deletion_reason).toBe('DSAR erasure request');
    });
  });

  // ==========================================
  // SUB-PROCESSORS
  // ==========================================

  describe('Sub-processors', () => {
    it('should register sub-processor', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `
                    INSERT INTO sub_processors (id, name, purpose, data_types, location, dpa_signed)
                    VALUES (?, ?, ?, ?, ?, ?)
                `,
          ['sp-1', 'AWS', 'Cloud hosting', 'All data', 'EU (Frankfurt)', 1],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const processor = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM sub_processors WHERE id = ?', ['sp-1'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(processor).toBeDefined();
      expect(processor.name).toBe('AWS');
      expect(processor.dpa_signed).toBe(1);
    });
  });

  // ==========================================
  // LEGAL HOLDS
  // ==========================================

  describe('Legal Holds', () => {
    it('should create legal hold', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `
                    INSERT INTO legal_holds (id, organization_id, hold_name, reason, affected_data, start_date, created_by)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `,
          [
            'hold-1',
            'org-1',
            'Litigation Hold 2026',
            'Pending lawsuit',
            'All user communications',
            '2026-01-15',
            'legal-1',
          ],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const hold = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM legal_holds WHERE id = ?', ['hold-1'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(hold).toBeDefined();
      expect(hold.status).toBe('active');
      expect(hold.hold_name).toBe('Litigation Hold 2026');
    });

    it('should release legal hold', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `INSERT INTO legal_holds (id, organization_id, hold_name, reason, affected_data, start_date, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            'hold-2',
            'org-1',
            'Audit Hold',
            'Tax audit',
            'Financial records',
            '2026-01-01',
            'legal-1',
          ],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run(
          `UPDATE legal_holds SET status = 'released', end_date = ? WHERE id = ?`,
          ['2026-06-30', 'hold-2'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const hold = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM legal_holds WHERE id = ?', ['hold-2'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(hold.status).toBe('released');
      expect(hold.end_date).toBe('2026-06-30');
    });
  });
});
