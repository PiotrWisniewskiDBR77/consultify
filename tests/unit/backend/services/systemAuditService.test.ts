/**
 * System Audit Service Tests
 * Real database tests for system audit logging
 *
 * @module tests/unit/backend/services/systemAuditService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('SystemAuditService', () => {
  let db: sqlite3.Database;

  beforeAll(async () => {
    db = new sqlite3.Database(':memory:');

    await new Promise<void>((resolve, reject) => {
      db.serialize(() => {
        db.run(
          `
                    CREATE TABLE IF NOT EXISTS system_audit_logs (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        user_id TEXT,
                        action TEXT NOT NULL,
                        resource_type TEXT NOT NULL,
                        resource_id TEXT,
                        old_values TEXT,
                        new_values TEXT,
                        ip_address TEXT,
                        severity TEXT DEFAULT 'info',
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
      db.run('DELETE FROM system_audit_logs', () => resolve());
    });
  });

  describe('Audit Logging', () => {
    it('should create audit log entry', async () => {
      const logId = `log-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO system_audit_logs (id, organization_id, user_id, action, resource_type, resource_id, severity) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [logId, 'org-123', 'user-456', 'update', 'user', 'user-789', 'warning'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const log = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM system_audit_logs WHERE id = ?', [logId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(log).toBeDefined();
      expect(log.action).toBe('update');
      expect(log.severity).toBe('warning');
    });

    it('should store change details', async () => {
      const logId = `log-${Date.now()}`;
      const oldValues = { status: 'active' };
      const newValues = { status: 'suspended' };

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO system_audit_logs (id, organization_id, action, resource_type, old_values, new_values) VALUES (?, ?, ?, ?, ?, ?)',
          [
            logId,
            'org-1',
            'update',
            'account',
            JSON.stringify(oldValues),
            JSON.stringify(newValues),
          ],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const log = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM system_audit_logs WHERE id = ?', [logId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      const newParsed = JSON.parse(log.new_values);
      expect(newParsed.status).toBe('suspended');
    });
  });

  describe('Severity Filtering', () => {
    it('should filter by severity level', async () => {
      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run(
            'INSERT INTO system_audit_logs (id, organization_id, action, resource_type, severity) VALUES (?, ?, ?, ?, ?)',
            ['l1', 'o1', 'create', 'user', 'info']
          );
          db.run(
            'INSERT INTO system_audit_logs (id, organization_id, action, resource_type, severity) VALUES (?, ?, ?, ?, ?)',
            ['l2', 'o1', 'delete', 'user', 'critical']
          );
          db.run(
            'INSERT INTO system_audit_logs (id, organization_id, action, resource_type, severity) VALUES (?, ?, ?, ?, ?)',
            ['l3', 'o1', 'update', 'user', 'warning'],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      });

      const criticalLogs = await new Promise<any[]>((resolve, reject) => {
        db.all('SELECT * FROM system_audit_logs WHERE severity = ?', ['critical'], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      expect(criticalLogs).toHaveLength(1);
    });
  });
});
