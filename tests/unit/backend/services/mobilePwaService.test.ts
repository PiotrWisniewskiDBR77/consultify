/**
 * Mobile & PWA Service Tests
 * FLOW-MOBILE-001: Mobile & PWA
 *
 * Tests for mobile devices, preferences, offline sync
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('MobilePwaService', () => {
  let db: sqlite3.Database;

  beforeAll(async () => {
    db = new sqlite3.Database(':memory:');

    await new Promise<void>((resolve, reject) => {
      db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT)`);

        // Mobile Devices
        db.run(`
                    CREATE TABLE IF NOT EXISTS mobile_devices (
                        id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        device_type TEXT NOT NULL,
                        device_name TEXT,
                        os_name TEXT,
                        os_version TEXT,
                        app_version TEXT,
                        push_token TEXT,
                        push_enabled INTEGER DEFAULT 1,
                        last_active_at TIMESTAMP,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);

        // Mobile Preferences
        db.run(`
                    CREATE TABLE IF NOT EXISTS mobile_preferences (
                        id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL UNIQUE,
                        offline_mode_enabled INTEGER DEFAULT 1,
                        auto_sync_enabled INTEGER DEFAULT 1,
                        sync_on_wifi_only INTEGER DEFAULT 0,
                        notification_sound INTEGER DEFAULT 1,
                        notification_vibration INTEGER DEFAULT 1,
                        theme TEXT DEFAULT 'system',
                        language TEXT DEFAULT 'en',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);

        // Offline Sync Queue
        db.run(`
                    CREATE TABLE IF NOT EXISTS offline_sync_queue (
                        id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        device_id TEXT NOT NULL,
                        action_type TEXT NOT NULL,
                        entity_type TEXT NOT NULL,
                        entity_id TEXT NOT NULL,
                        payload TEXT NOT NULL,
                        priority INTEGER DEFAULT 5,
                        status TEXT DEFAULT 'pending',
                        retry_count INTEGER DEFAULT 0,
                        max_retries INTEGER DEFAULT 3,
                        error_message TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        synced_at TIMESTAMP
                    )
                `);

        // Push Notification Log
        db.run(`
                    CREATE TABLE IF NOT EXISTS push_notification_log (
                        id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        device_id TEXT,
                        notification_type TEXT NOT NULL,
                        title TEXT NOT NULL,
                        body TEXT,
                        data TEXT,
                        status TEXT DEFAULT 'sent',
                        delivered_at TIMESTAMP,
                        opened_at TIMESTAMP,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);

        // Seed data
        db.run(`INSERT INTO users (id, email) VALUES ('user-1', 'test@example.com')`, (err) =>
          err ? reject(err) : resolve()
        );
      });
    });
  });

  afterAll(() => db.close());

  beforeEach(async () => {
    await new Promise<void>((resolve) => {
      db.serialize(() => {
        db.run('DELETE FROM mobile_devices');
        db.run('DELETE FROM mobile_preferences');
        db.run('DELETE FROM offline_sync_queue');
        db.run('DELETE FROM push_notification_log', () => resolve());
      });
    });
  });

  // ==========================================
  // MOBILE DEVICES
  // ==========================================

  describe('Mobile Devices', () => {
    it('should register mobile device', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `
                    INSERT INTO mobile_devices (id, user_id, device_type, device_name, os_name, os_version, push_token)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `,
          ['device-1', 'user-1', 'smartphone', 'iPhone 15', 'iOS', '17.2', 'apns-token-xyz'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const device = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM mobile_devices WHERE id = ?', ['device-1'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(device).toBeDefined();
      expect(device.device_type).toBe('smartphone');
      expect(device.os_name).toBe('iOS');
    });

    it('should track multiple devices per user', async () => {
      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run(
            `INSERT INTO mobile_devices (id, user_id, device_type, device_name, os_name) VALUES (?, ?, ?, ?, ?)`,
            ['device-2', 'user-1', 'smartphone', 'iPhone', 'iOS']
          );
          db.run(
            `INSERT INTO mobile_devices (id, user_id, device_type, device_name, os_name) VALUES (?, ?, ?, ?, ?)`,
            ['device-3', 'user-1', 'tablet', 'iPad', 'iPadOS']
          );
          db.run(
            `INSERT INTO mobile_devices (id, user_id, device_type, device_name, os_name) VALUES (?, ?, ?, ?, ?)`,
            ['device-4', 'user-1', 'smartphone', 'Pixel 8', 'Android'],
            (err) => (err ? reject(err) : resolve())
          );
        });
      });

      const devices = await new Promise<any[]>((resolve, reject) => {
        db.all('SELECT * FROM mobile_devices WHERE user_id = ?', ['user-1'], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      expect(devices).toHaveLength(3);
    });

    it('should update last active timestamp', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `INSERT INTO mobile_devices (id, user_id, device_type, device_name) VALUES (?, ?, ?, ?)`,
          ['device-5', 'user-1', 'smartphone', 'Test Device'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const timestamp = new Date().toISOString();
      await new Promise<void>((resolve, reject) => {
        db.run(
          `UPDATE mobile_devices SET last_active_at = ? WHERE id = ?`,
          [timestamp, 'device-5'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const device = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM mobile_devices WHERE id = ?', ['device-5'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(device.last_active_at).toBe(timestamp);
    });
  });

  // ==========================================
  // MOBILE PREFERENCES
  // ==========================================

  describe('Mobile Preferences', () => {
    it('should create user preferences', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `
                    INSERT INTO mobile_preferences (id, user_id, offline_mode_enabled, auto_sync_enabled, theme, language)
                    VALUES (?, ?, ?, ?, ?, ?)
                `,
          ['pref-1', 'user-1', 1, 1, 'dark', 'pl'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const prefs = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM mobile_preferences WHERE user_id = ?', ['user-1'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(prefs).toBeDefined();
      expect(prefs.theme).toBe('dark');
      expect(prefs.language).toBe('pl');
    });

    it('should enforce one preference set per user', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `INSERT INTO mobile_preferences (id, user_id) VALUES (?, ?)`,
          ['pref-2', 'user-1'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const result = await new Promise<boolean>((resolve) => {
        db.run(
          `INSERT INTO mobile_preferences (id, user_id) VALUES (?, ?)`,
          ['pref-3', 'user-1'],
          (err) => {
            resolve(!!err);
          }
        );
      });

      expect(result).toBe(true);
    });

    it('should update preferences', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `INSERT INTO mobile_preferences (id, user_id, sync_on_wifi_only, notification_sound) VALUES (?, ?, ?, ?)`,
          ['pref-4', 'user-1', 0, 1],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run(
          `UPDATE mobile_preferences SET sync_on_wifi_only = 1, notification_sound = 0 WHERE user_id = ?`,
          ['user-1'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const prefs = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM mobile_preferences WHERE user_id = ?', ['user-1'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(prefs.sync_on_wifi_only).toBe(1);
      expect(prefs.notification_sound).toBe(0);
    });
  });

  // ==========================================
  // OFFLINE SYNC QUEUE
  // ==========================================

  describe('Offline Sync Queue', () => {
    it('should queue offline action', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `
                    INSERT INTO offline_sync_queue (id, user_id, device_id, action_type, entity_type, entity_id, payload, priority)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `,
          ['sync-1', 'user-1', 'device-1', 'update', 'task', 'task-123', '{"status":"done"}', 10],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const syncItem = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM offline_sync_queue WHERE id = ?', ['sync-1'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(syncItem).toBeDefined();
      expect(syncItem.action_type).toBe('update');
      expect(syncItem.priority).toBe(10);
    });

    it('should process sync queue by priority', async () => {
      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run(
            `INSERT INTO offline_sync_queue (id, user_id, device_id, action_type, entity_type, entity_id, payload, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            ['sync-2', 'user-1', 'device-1', 'create', 'comment', 'c-1', '{}', 5]
          );
          db.run(
            `INSERT INTO offline_sync_queue (id, user_id, device_id, action_type, entity_type, entity_id, payload, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            ['sync-3', 'user-1', 'device-1', 'delete', 'task', 't-1', '{}', 1]
          );
          db.run(
            `INSERT INTO offline_sync_queue (id, user_id, device_id, action_type, entity_type, entity_id, payload, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            ['sync-4', 'user-1', 'device-1', 'update', 'task', 't-2', '{}', 10],
            (err) => (err ? reject(err) : resolve())
          );
        });
      });

      const queue = await new Promise<any[]>((resolve, reject) => {
        db.all(
          `SELECT * FROM offline_sync_queue WHERE status = 'pending' ORDER BY priority DESC, created_at ASC`,
          [],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      expect(queue).toHaveLength(3);
      expect(queue[0].priority).toBe(10); // Highest priority first
      expect(queue[2].priority).toBe(1); // Lowest priority last
    });

    it('should mark sync as completed', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `INSERT INTO offline_sync_queue (id, user_id, device_id, action_type, entity_type, entity_id, payload) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          ['sync-5', 'user-1', 'device-1', 'update', 'task', 't-3', '{}'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run(
          `UPDATE offline_sync_queue SET status = 'completed', synced_at = ? WHERE id = ?`,
          [new Date().toISOString(), 'sync-5'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const syncItem = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM offline_sync_queue WHERE id = ?', ['sync-5'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(syncItem.status).toBe('completed');
      expect(syncItem.synced_at).not.toBeNull();
    });

    it('should handle sync failures', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `INSERT INTO offline_sync_queue (id, user_id, device_id, action_type, entity_type, entity_id, payload, retry_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          ['sync-6', 'user-1', 'device-1', 'update', 'task', 't-4', '{}', 0],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run(
          `UPDATE offline_sync_queue SET status = 'failed', retry_count = retry_count + 1, error_message = ? WHERE id = ?`,
          ['Network timeout', 'sync-6'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const syncItem = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM offline_sync_queue WHERE id = ?', ['sync-6'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(syncItem.status).toBe('failed');
      expect(syncItem.retry_count).toBe(1);
      expect(syncItem.error_message).toBe('Network timeout');
    });
  });

  // ==========================================
  // PUSH NOTIFICATIONS
  // ==========================================

  describe('Push Notifications', () => {
    it('should log push notification', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `
                    INSERT INTO push_notification_log (id, user_id, device_id, notification_type, title, body, data)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `,
          [
            'push-1',
            'user-1',
            'device-1',
            'task_assigned',
            'New Task',
            'You have been assigned a new task',
            '{"task_id":"t-1"}',
          ],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const notification = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM push_notification_log WHERE id = ?', ['push-1'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(notification).toBeDefined();
      expect(notification.notification_type).toBe('task_assigned');
      expect(notification.title).toBe('New Task');
    });

    it('should track notification delivery', async () => {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `INSERT INTO push_notification_log (id, user_id, notification_type, title, status) VALUES (?, ?, ?, ?, ?)`,
          ['push-2', 'user-1', 'reminder', 'Task Due', 'sent'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run(
          `UPDATE push_notification_log SET status = 'delivered', delivered_at = ? WHERE id = ?`,
          [new Date().toISOString(), 'push-2'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const notification = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM push_notification_log WHERE id = ?', ['push-2'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(notification.status).toBe('delivered');
      expect(notification.delivered_at).not.toBeNull();
    });
  });
});
