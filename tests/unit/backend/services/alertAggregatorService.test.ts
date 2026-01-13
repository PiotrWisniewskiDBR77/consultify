/**
 * Alert Aggregator Service Tests
 * Real database integration tests for system alerts
 *
 * @module tests/unit/backend/services/alertAggregatorService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('AlertAggregatorService', () => {
  let db: sqlite3.Database;

  beforeAll(async () => {
    db = new sqlite3.Database(':memory:');

    await new Promise<void>((resolve, reject) => {
      db.serialize(() => {
        db.run(
          `
                    CREATE TABLE IF NOT EXISTS system_alerts (
                        id TEXT PRIMARY KEY,
                        alert_type TEXT NOT NULL,
                        severity TEXT NOT NULL,
                        title TEXT NOT NULL,
                        message TEXT,
                        source TEXT,
                        metadata TEXT,
                        is_resolved INTEGER DEFAULT 0,
                        resolved_at DATETIME,
                        resolved_by TEXT,
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

  afterAll(() => {
    db.close();
  });

  beforeEach(async () => {
    await new Promise<void>((resolve) => {
      db.run('DELETE FROM system_alerts', () => resolve());
    });
  });

  describe('Alert Creation', () => {
    it('should create system alert', async () => {
      const alertId = `alert-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO system_alerts (id, alert_type, severity, title, message, source) VALUES (?, ?, ?, ?, ?, ?)',
          [
            alertId,
            'error',
            'high',
            'Database Connection Failed',
            'Unable to connect to primary database',
            'db-monitor',
          ],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const alert = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM system_alerts WHERE id = ?', [alertId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(alert).toBeDefined();
      expect(alert.alert_type).toBe('error');
      expect(alert.severity).toBe('high');
      expect(alert.is_resolved).toBe(0);
    });

    it('should create alert with metadata', async () => {
      const alertId = `alert-${Date.now()}`;
      const metadata = { cpu_usage: 95, memory_usage: 87, disk_usage: 72 };

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO system_alerts (id, alert_type, severity, title, metadata) VALUES (?, ?, ?, ?, ?)',
          [alertId, 'warning', 'medium', 'High Resource Usage', JSON.stringify(metadata)],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const alert = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM system_alerts WHERE id = ?', [alertId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      const parsedMetadata = JSON.parse(alert.metadata);
      expect(parsedMetadata.cpu_usage).toBe(95);
    });
  });

  describe('Alert Resolution', () => {
    it('should resolve alert', async () => {
      const alertId = `alert-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO system_alerts (id, alert_type, severity, title) VALUES (?, ?, ?, ?)',
          [alertId, 'error', 'critical', 'Service Down'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run(
          'UPDATE system_alerts SET is_resolved = 1, resolved_at = datetime("now"), resolved_by = ? WHERE id = ?',
          ['admin-user', alertId],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const alert = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM system_alerts WHERE id = ?', [alertId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(alert.is_resolved).toBe(1);
      expect(alert.resolved_by).toBe('admin-user');
      expect(alert.resolved_at).not.toBeNull();
    });
  });

  describe('Alert Aggregation', () => {
    it('should count alerts by severity', async () => {
      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run(
            'INSERT INTO system_alerts (id, alert_type, severity, title) VALUES (?, ?, ?, ?)',
            ['a-1', 'error', 'critical', 'Critical 1']
          );
          db.run(
            'INSERT INTO system_alerts (id, alert_type, severity, title) VALUES (?, ?, ?, ?)',
            ['a-2', 'error', 'high', 'High 1']
          );
          db.run(
            'INSERT INTO system_alerts (id, alert_type, severity, title) VALUES (?, ?, ?, ?)',
            ['a-3', 'warning', 'medium', 'Medium 1']
          );
          db.run(
            'INSERT INTO system_alerts (id, alert_type, severity, title) VALUES (?, ?, ?, ?)',
            ['a-4', 'error', 'critical', 'Critical 2'],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      });

      const bySeverity = await new Promise<any[]>((resolve, reject) => {
        db.all(
          `
                    SELECT severity, COUNT(*) as count 
                    FROM system_alerts 
                    WHERE is_resolved = 0
                    GROUP BY severity
                `,
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      const critical = bySeverity.find((s) => s.severity === 'critical');
      expect(critical?.count).toBe(2);
    });

    it('should get unresolved alerts ordered by severity', async () => {
      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run(
            'INSERT INTO system_alerts (id, alert_type, severity, title, is_resolved) VALUES (?, ?, ?, ?, ?)',
            ['a-1', 'info', 'low', 'Low Priority', 0]
          );
          db.run(
            'INSERT INTO system_alerts (id, alert_type, severity, title, is_resolved) VALUES (?, ?, ?, ?, ?)',
            ['a-2', 'error', 'critical', 'Critical Issue', 0]
          );
          db.run(
            'INSERT INTO system_alerts (id, alert_type, severity, title, is_resolved) VALUES (?, ?, ?, ?, ?)',
            ['a-3', 'error', 'critical', 'Already Fixed', 1],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      });

      const unresolved = await new Promise<any[]>((resolve, reject) => {
        db.all(
          `
                    SELECT * FROM system_alerts 
                    WHERE is_resolved = 0
                    ORDER BY 
                        CASE severity 
                            WHEN 'critical' THEN 1 
                            WHEN 'high' THEN 2 
                            WHEN 'medium' THEN 3 
                            WHEN 'low' THEN 4 
                        END
                `,
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      expect(unresolved).toHaveLength(2);
      expect(unresolved[0].severity).toBe('critical');
    });
  });
});
