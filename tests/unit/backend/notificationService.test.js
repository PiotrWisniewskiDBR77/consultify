/**
 * Notification Service Unit Tests
 * Tests notification creation, delivery, and management
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { getDatabase } from '../../../server/src/database/Database.js';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';
import { v4 as uuidv4 } from 'uuid';

const RUN_DB_TESTS = process.env.RUN_DB_TESTS === '1';
const describeIfDb = RUN_DB_TESTS ? describe : describe.skip;

vi.hoisted(() => {
  if (process.env.RUN_DB_TESTS !== '1') return;
  process.env.MOCK_DB = 'false';
  const workerId = process.env.VITEST_WORKER_ID || '0';
  process.env.SQLITE_PATH = `./test-notification-${workerId}.db`;
});

describeIfDb('NotificationService', () => {
  const db = getDatabase();
  let testOrgId;
  let testUserId;
  let createdNotificationIds = [];

  beforeAll(async () => {
    await initializeDatabase();

    // Create test organization
    testOrgId = uuidv4();
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`,
        [testOrgId, 'Notification Test Org', 'pro', 'active'],
        (err) => (err ? reject(err) : resolve())
      );
    });

    // Create test user
    testUserId = uuidv4();
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO users (id, organization_id, email, password, role, status) VALUES (?, ?, ?, ?, ?, ?)`,
        [testUserId, testOrgId, `notif-${Date.now()}@test.com`, 'hash', 'ADMIN', 'active'],
        (err) => (err ? reject(err) : resolve())
      );
    });
  });

  afterAll(async () => {
    await new Promise((r) =>
      db.run(`DELETE FROM notifications WHERE user_id = ?`, [testUserId], () => r())
    );
    await new Promise((r) => db.run(`DELETE FROM users WHERE id = ?`, [testUserId], () => r()));
    await new Promise((r) =>
      db.run(`DELETE FROM organizations WHERE id = ?`, [testOrgId], () => r())
    );
  });

  beforeEach(async () => {
    await new Promise((r) =>
      db.run(`DELETE FROM notifications WHERE user_id = ?`, [testUserId], () => r())
    );
    createdNotificationIds = [];
  });

  describe('Notification CRUD', () => {
    it('should create notification', async () => {
      const notifId = uuidv4();
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO notifications (id, user_id, organization_id, type, title, message, read, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
          [notifId, testUserId, testOrgId, 'info', 'Test Title', 'Test Message', 0],
          (err) => (err ? reject(err) : resolve())
        );
      });
      createdNotificationIds.push(notifId);

      const notif = await new Promise((resolve) => {
        db.get(`SELECT * FROM notifications WHERE id = ?`, [notifId], (_, row) => resolve(row));
      });

      expect(notif).toBeDefined();
      expect(notif.title).toBe('Test Title');
      expect(notif.read).toBe(0);
    });

    it('should list user notifications', async () => {
      // Create multiple notifications
      for (let i = 0; i < 3; i++) {
        const notifId = uuidv4();
        await new Promise((resolve) => {
          db.run(
            `INSERT INTO notifications (id, user_id, organization_id, type, title, message, read, created_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
            [notifId, testUserId, testOrgId, 'info', `Notif ${i}`, `Message ${i}`, 0],
            () => resolve()
          );
        });
        createdNotificationIds.push(notifId);
      }

      const notifications = await new Promise((resolve) => {
        db.all(`SELECT * FROM notifications WHERE user_id = ?`, [testUserId], (_, rows) =>
          resolve(rows)
        );
      });

      expect(notifications.length).toBe(3);
    });

    it('should mark notification as read', async () => {
      const notifId = uuidv4();
      await new Promise((resolve) => {
        db.run(
          `INSERT INTO notifications (id, user_id, organization_id, type, title, message, read, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
          [notifId, testUserId, testOrgId, 'info', 'Unread', 'Message', 0],
          () => resolve()
        );
      });
      createdNotificationIds.push(notifId);

      await new Promise((resolve) => {
        db.run(`UPDATE notifications SET read = 1 WHERE id = ?`, [notifId], () => resolve());
      });

      const notif = await new Promise((resolve) => {
        db.get(`SELECT * FROM notifications WHERE id = ?`, [notifId], (_, row) => resolve(row));
      });

      expect(notif.read).toBe(1);
    });

    it('should delete notification', async () => {
      const notifId = uuidv4();
      await new Promise((resolve) => {
        db.run(
          `INSERT INTO notifications (id, user_id, organization_id, type, title, message, read, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
          [notifId, testUserId, testOrgId, 'info', 'Delete Me', 'Message', 0],
          () => resolve()
        );
      });

      await new Promise((resolve) => {
        db.run(`DELETE FROM notifications WHERE id = ?`, [notifId], () => resolve());
      });

      const notif = await new Promise((resolve) => {
        db.get(`SELECT * FROM notifications WHERE id = ?`, [notifId], (_, row) => resolve(row));
      });

      expect(notif).toBeNull();
    });
  });

  describe('Notification Types', () => {
    const types = ['info', 'warning', 'error', 'success', 'task', 'mention'];

    it.each(types)('should support %s notification type', async (type) => {
      const notifId = uuidv4();
      await new Promise((resolve) => {
        db.run(
          `INSERT INTO notifications (id, user_id, organization_id, type, title, message, read, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
          [notifId, testUserId, testOrgId, type, `${type} title`, `${type} message`, 0],
          () => resolve()
        );
      });
      createdNotificationIds.push(notifId);

      const notif = await new Promise((resolve) => {
        db.get(`SELECT * FROM notifications WHERE id = ?`, [notifId], (_, row) => resolve(row));
      });

      expect(notif.type).toBe(type);
    });
  });

  describe('Unread Count', () => {
    it('should count unread notifications', async () => {
      // Create mix of read and unread
      await new Promise((r) =>
        db.run(
          `INSERT INTO notifications (id, user_id, organization_id, type, title, message, read) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [uuidv4(), testUserId, testOrgId, 'info', 'Unread 1', 'msg', 0],
          () => r()
        )
      );
      await new Promise((r) =>
        db.run(
          `INSERT INTO notifications (id, user_id, organization_id, type, title, message, read) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [uuidv4(), testUserId, testOrgId, 'info', 'Unread 2', 'msg', 0],
          () => r()
        )
      );
      await new Promise((r) =>
        db.run(
          `INSERT INTO notifications (id, user_id, organization_id, type, title, message, read) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [uuidv4(), testUserId, testOrgId, 'info', 'Read 1', 'msg', 1],
          () => r()
        )
      );

      const result = await new Promise((resolve) => {
        db.get(
          `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0`,
          [testUserId],
          (_, row) => resolve(row)
        );
      });

      expect(Number(result.count)).toBe(2);
    });
  });

  describe('Mark All Read', () => {
    it('should mark all notifications as read', async () => {
      // Create unread notifications
      for (let i = 0; i < 5; i++) {
        await new Promise((r) =>
          db.run(
            `INSERT INTO notifications (id, user_id, organization_id, type, title, message, read) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [uuidv4(), testUserId, testOrgId, 'info', `Notif ${i}`, 'msg', 0],
            () => r()
          )
        );
      }

      await new Promise((resolve) => {
        db.run(`UPDATE notifications SET read = 1 WHERE user_id = ?`, [testUserId], () =>
          resolve()
        );
      });

      const unreadCount = await new Promise((resolve) => {
        db.get(
          `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0`,
          [testUserId],
          (_, row) => resolve(row)
        );
      });

      expect(Number(unreadCount.count)).toBe(0);
    });
  });
});
