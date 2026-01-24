/**
 * Admin Alert Service Tests
 * Real database tests for admin alerts
 *
 * @module tests/unit/backend/services/adminAlertService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('AdminAlertService', () => {
  let db: sqlite3.Database;

  beforeAll(async () => {
    db = new sqlite3.Database(':memory:');

    await new Promise<void>((resolve, reject) => {
      db.serialize(() => {
        db.run(
          `
                    CREATE TABLE IF NOT EXISTS admin_alerts (
                        id TEXT PRIMARY KEY,
                        alert_type TEXT NOT NULL,
                        severity TEXT NOT NULL,
                        title TEXT NOT NULL,
                        message TEXT,
                        target_admins TEXT,
                        is_read INTEGER DEFAULT 0,
                        is_dismissed INTEGER DEFAULT 0,
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
      db.run('DELETE FROM admin_alerts', () => resolve());
    });
  });

  describe('Alert CRUD', () => {
    it('should create admin alert', async () => {
      const alertId = `alert-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO admin_alerts (id, alert_type, severity, title, message) VALUES (?, ?, ?, ?, ?)',
          [
            alertId,
            'security',
            'high',
            'Suspicious Activity',
            'Multiple failed login attempts detected',
          ],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const alert = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM admin_alerts WHERE id = ?', [alertId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(alert).toBeDefined();
      expect(alert.severity).toBe('high');
      expect(alert.is_read).toBe(0);
    });

    it('should mark alert as read', async () => {
      const alertId = `alert-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO admin_alerts (id, alert_type, severity, title) VALUES (?, ?, ?, ?)',
          [alertId, 'system', 'medium', 'Disk Space Warning'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run('UPDATE admin_alerts SET is_read = 1 WHERE id = ?', [alertId], (err) =>
          err ? reject(err) : resolve()
        );
      });

      const alert = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM admin_alerts WHERE id = ?', [alertId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(alert.is_read).toBe(1);
    });
  });

  describe('Alert Queries', () => {
    it('should get unread alerts', async () => {
      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run(
            'INSERT INTO admin_alerts (id, alert_type, severity, title, is_read) VALUES (?, ?, ?, ?, ?)',
            ['a1', 'system', 'low', 'Alert 1', 0]
          );
          db.run(
            'INSERT INTO admin_alerts (id, alert_type, severity, title, is_read) VALUES (?, ?, ?, ?, ?)',
            ['a2', 'security', 'high', 'Alert 2', 0]
          );
          db.run(
            'INSERT INTO admin_alerts (id, alert_type, severity, title, is_read) VALUES (?, ?, ?, ?, ?)',
            ['a3', 'billing', 'medium', 'Alert 3', 1],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      });

      const unread = await new Promise<any[]>((resolve, reject) => {
        db.all('SELECT * FROM admin_alerts WHERE is_read = 0', (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      expect(unread).toHaveLength(2);
    });
  });
});
