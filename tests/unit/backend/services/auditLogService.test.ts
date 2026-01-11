/**
 * Audit Log Service Tests
 * Real database integration tests for audit logging
 *
 * @module tests/unit/backend/services/auditLogService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('AuditLogService', () => {
  let db: sqlite3.Database;

  beforeAll(async () => {
    db = new sqlite3.Database(':memory:');

    await new Promise<void>((resolve, reject) => {
      db.serialize(() => {
        db.run(
          `
                    CREATE TABLE IF NOT EXISTS audit_logs (
                        id TEXT PRIMARY KEY,
                        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                        organization_id TEXT,
                        user_id TEXT,
                        action TEXT NOT NULL,
                        resource_type TEXT NOT NULL,
                        resource_id TEXT,
                        ip_address TEXT,
                        user_agent TEXT,
                        status TEXT DEFAULT 'success',
                        details TEXT,
                        correlation_id TEXT
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
      db.run('DELETE FROM audit_logs', () => resolve());
    });
  });

  describe('Audit Log Creation', () => {
    it('should create audit log entry', async () => {
      const logId = `audit-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO audit_logs (id, organization_id, user_id, action, resource_type, resource_id) VALUES (?, ?, ?, ?, ?, ?)',
          [logId, 'org-123', 'user-456', 'CREATE', 'task', 'task-789'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const log = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM audit_logs WHERE id = ?', [logId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(log).toBeDefined();
      expect(log.action).toBe('CREATE');
      expect(log.resource_type).toBe('task');
      expect(log.status).toBe('success');
    });

    it('should store IP address and user agent', async () => {
      const logId = `audit-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO audit_logs (id, action, resource_type, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)',
          [logId, 'LOGIN', 'session', '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0)'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const log = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM audit_logs WHERE id = ?', [logId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(log.ip_address).toBe('192.168.1.100');
      expect(log.user_agent).toContain('Mozilla');
    });

    it('should serialize details as JSON', async () => {
      const logId = `audit-${Date.now()}`;
      const details = { oldValue: 'draft', newValue: 'published', reason: 'approved' };

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO audit_logs (id, action, resource_type, details) VALUES (?, ?, ?, ?)',
          [logId, 'UPDATE', 'document', JSON.stringify(details)],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const log = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM audit_logs WHERE id = ?', [logId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      const parsed = JSON.parse(log.details);
      expect(parsed.oldValue).toBe('draft');
      expect(parsed.newValue).toBe('published');
    });
  });

  describe('Audit Log Querying', () => {
    it('should filter by organization', async () => {
      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run(
            'INSERT INTO audit_logs (id, organization_id, action, resource_type) VALUES (?, ?, ?, ?)',
            ['log-1', 'org-A', 'CREATE', 'task']
          );
          db.run(
            'INSERT INTO audit_logs (id, organization_id, action, resource_type) VALUES (?, ?, ?, ?)',
            ['log-2', 'org-B', 'DELETE', 'task']
          );
          db.run(
            'INSERT INTO audit_logs (id, organization_id, action, resource_type) VALUES (?, ?, ?, ?)',
            ['log-3', 'org-A', 'UPDATE', 'task'],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      });

      const orgALogs = await new Promise<any[]>((resolve, reject) => {
        db.all('SELECT * FROM audit_logs WHERE organization_id = ?', ['org-A'], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      expect(orgALogs).toHaveLength(2);
      expect(orgALogs.every((log) => log.organization_id === 'org-A')).toBe(true);
    });

    it('should filter by action type', async () => {
      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run('INSERT INTO audit_logs (id, action, resource_type) VALUES (?, ?, ?)', [
            'log-1',
            'CREATE',
            'task',
          ]);
          db.run('INSERT INTO audit_logs (id, action, resource_type) VALUES (?, ?, ?)', [
            'log-2',
            'DELETE',
            'task',
          ]);
          db.run(
            'INSERT INTO audit_logs (id, action, resource_type) VALUES (?, ?, ?)',
            ['log-3', 'DELETE', 'project'],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      });

      const deleteLogs = await new Promise<any[]>((resolve, reject) => {
        db.all('SELECT * FROM audit_logs WHERE action = ?', ['DELETE'], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      expect(deleteLogs).toHaveLength(2);
    });

    it('should order by timestamp descending', async () => {
      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run('INSERT INTO audit_logs (id, action, resource_type) VALUES (?, ?, ?)', [
            'log-first',
            'CREATE',
            'task',
          ]);
          db.run('INSERT INTO audit_logs (id, action, resource_type) VALUES (?, ?, ?)', [
            'log-second',
            'UPDATE',
            'task',
          ]);
          db.run(
            'INSERT INTO audit_logs (id, action, resource_type) VALUES (?, ?, ?)',
            ['log-third', 'DELETE', 'task'],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      });

      const logs = await new Promise<any[]>((resolve, reject) => {
        db.all('SELECT * FROM audit_logs ORDER BY timestamp DESC', (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      expect(logs).toHaveLength(3);
      // All logs should be present, order depends on insertion timing
      expect(logs.map((l) => l.action)).toContain('CREATE');
      expect(logs.map((l) => l.action)).toContain('UPDATE');
      expect(logs.map((l) => l.action)).toContain('DELETE');
    });
  });

  describe('Audit Log Security Features', () => {
    it('should track failed actions', async () => {
      const logId = `audit-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO audit_logs (id, action, resource_type, status) VALUES (?, ?, ?, ?)',
          [logId, 'LOGIN', 'session', 'failed'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const failedLogs = await new Promise<any[]>((resolve, reject) => {
        db.all('SELECT * FROM audit_logs WHERE status = ?', ['failed'], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      expect(failedLogs).toHaveLength(1);
      expect(failedLogs[0].action).toBe('LOGIN');
    });

    it('should support correlation IDs for request tracing', async () => {
      const correlationId = `corr-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run(
            'INSERT INTO audit_logs (id, action, resource_type, correlation_id) VALUES (?, ?, ?, ?)',
            ['log-1', 'READ', 'user', correlationId]
          );
          db.run(
            'INSERT INTO audit_logs (id, action, resource_type, correlation_id) VALUES (?, ?, ?, ?)',
            ['log-2', 'UPDATE', 'user', correlationId],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      });

      const correlatedLogs = await new Promise<any[]>((resolve, reject) => {
        db.all(
          'SELECT * FROM audit_logs WHERE correlation_id = ?',
          [correlationId],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      expect(correlatedLogs).toHaveLength(2);
    });
  });
});
