/**
 * Alert Service Unit Tests
 * Tests alert creation, notification delivery, and management
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Alert service implementation
const createAlertService = () => {
  const alerts = new Map();
  const notifications = [];

  return {
    create: (level, message, options = {}) => {
      const id = `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const alert = {
        id,
        level,
        message,
        userId: options.userId,
        organizationId: options.organizationId,
        resourceType: options.resourceType,
        resourceId: options.resourceId,
        read: false,
        createdAt: new Date(),
        expiresAt: options.expiresAt,
        ...options,
      };
      alerts.set(id, alert);
      return alert;
    },

    get: (id) => alerts.get(id) || null,

    list: (filters = {}) => {
      let result = Array.from(alerts.values());

      if (filters.userId) {
        result = result.filter((a) => a.userId === filters.userId);
      }
      if (filters.level) {
        result = result.filter((a) => a.level === filters.level);
      }
      if (filters.unreadOnly) {
        result = result.filter((a) => !a.read);
      }

      return result.sort((a, b) => b.createdAt - a.createdAt);
    },

    markAsRead: (id) => {
      const alert = alerts.get(id);
      if (alert) {
        alert.read = true;
        alert.readAt = new Date();
      }
      return alert;
    },

    markAllAsRead: (userId) => {
      let count = 0;
      for (const alert of alerts.values()) {
        if (alert.userId === userId && !alert.read) {
          alert.read = true;
          alert.readAt = new Date();
          count++;
        }
      }
      return count;
    },

    delete: (id) => alerts.delete(id),

    notify: async (alertId, channels = ['app']) => {
      const alert = alerts.get(alertId);
      if (!alert) throw new Error('Alert not found');

      const notificationResults = channels.map((channel) => ({
        alertId,
        channel,
        sent: true,
        sentAt: new Date(),
      }));

      notifications.push(...notificationResults);
      return notificationResults;
    },

    getNotificationHistory: (alertId) => {
      return notifications.filter((n) => n.alertId === alertId);
    },

    getUnreadCount: (userId) => {
      return Array.from(alerts.values()).filter((a) => a.userId === userId && !a.read).length;
    },
  };
};

describe('AlertService', () => {
  let alertService;

  beforeEach(() => {
    alertService = createAlertService();
  });

  describe('Alert Creation', () => {
    it('should create alert', () => {
      const alert = alertService.create('warning', 'Test alert message', {
        userId: 'user-1',
      });

      expect(alert.id).toBeDefined();
      expect(alert.level).toBe('warning');
      expect(alert.message).toBe('Test alert message');
    });

    it('should support different levels', () => {
      const levels = ['info', 'warning', 'error', 'critical'];

      for (const level of levels) {
        const alert = alertService.create(level, 'Test');
        expect(alert.level).toBe(level);
      }
    });

    it('should set read status to false initially', () => {
      const alert = alertService.create('info', 'New alert');
      expect(alert.read).toBe(false);
    });
  });

  describe('Alert Listing', () => {
    it('should list all alerts', () => {
      alertService.create('info', 'Alert 1');
      alertService.create('warning', 'Alert 2');

      const alerts = alertService.list();
      expect(alerts).toHaveLength(2);
    });

    it('should filter by user', () => {
      alertService.create('info', 'Alert 1', { userId: 'user-1' });
      alertService.create('info', 'Alert 2', { userId: 'user-2' });

      const userAlerts = alertService.list({ userId: 'user-1' });
      expect(userAlerts).toHaveLength(1);
    });

    it('should filter by level', () => {
      alertService.create('info', 'Info alert');
      alertService.create('error', 'Error alert');

      const errorAlerts = alertService.list({ level: 'error' });
      expect(errorAlerts).toHaveLength(1);
    });

    it('should filter unread only', () => {
      const alert1 = alertService.create('info', 'Alert 1');
      alertService.create('info', 'Alert 2');
      alertService.markAsRead(alert1.id);

      const unread = alertService.list({ unreadOnly: true });
      expect(unread).toHaveLength(1);
    });
  });

  describe('Read Status', () => {
    it('should mark alert as read', () => {
      const alert = alertService.create('info', 'Test');
      alertService.markAsRead(alert.id);

      expect(alertService.get(alert.id).read).toBe(true);
    });

    it('should mark all as read for user', () => {
      alertService.create('info', 'Alert 1', { userId: 'user-1' });
      alertService.create('info', 'Alert 2', { userId: 'user-1' });
      alertService.create('info', 'Alert 3', { userId: 'user-2' });

      const count = alertService.markAllAsRead('user-1');
      expect(count).toBe(2);
    });

    it('should track unread count', () => {
      alertService.create('info', 'Alert 1', { userId: 'user-1' });
      alertService.create('info', 'Alert 2', { userId: 'user-1' });

      expect(alertService.getUnreadCount('user-1')).toBe(2);
    });
  });

  describe('Notifications', () => {
    it('should send notification', async () => {
      const alert = alertService.create('warning', 'Important alert');
      const results = await alertService.notify(alert.id, ['email', 'app']);

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.sent)).toBe(true);
    });

    it('should track notification history', async () => {
      const alert = alertService.create('error', 'Critical');
      await alertService.notify(alert.id, ['email']);

      const history = alertService.getNotificationHistory(alert.id);
      expect(history).toHaveLength(1);
    });
  });
});
