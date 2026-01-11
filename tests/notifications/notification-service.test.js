/**
 * Notification Service Tests
 * Tests for notification delivery and management
 *
 * @module tests/notifications/notification-service.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock notification service
const createNotificationService = () => {
  const notifications = [];
  const subscribers = new Map();
  let unreadCount = 0;

  return {
    getAll: () => [...notifications],
    getUnread: () => notifications.filter((n) => !n.read),
    getUnreadCount: () => unreadCount,

    create: (notification) => {
      const newNotification = {
        id: `notif-${notifications.length + 1}`,
        createdAt: new Date().toISOString(),
        read: false,
        ...notification,
      };
      notifications.unshift(newNotification);
      unreadCount++;

      // Notify subscribers
      const typeSubscribers = subscribers.get(notification.type) || [];
      typeSubscribers.forEach((callback) => callback(newNotification));

      const allSubscribers = subscribers.get('*') || [];
      allSubscribers.forEach((callback) => callback(newNotification));

      return newNotification;
    },

    markAsRead: (id) => {
      const notification = notifications.find((n) => n.id === id);
      if (notification && !notification.read) {
        notification.read = true;
        notification.readAt = new Date().toISOString();
        unreadCount--;
        return true;
      }
      return false;
    },

    markAllAsRead: () => {
      let count = 0;
      notifications.forEach((n) => {
        if (!n.read) {
          n.read = true;
          n.readAt = new Date().toISOString();
          count++;
        }
      });
      unreadCount = 0;
      return count;
    },

    delete: (id) => {
      const index = notifications.findIndex((n) => n.id === id);
      if (index !== -1) {
        const [removed] = notifications.splice(index, 1);
        if (!removed.read) unreadCount--;
        return true;
      }
      return false;
    },

    deleteAll: () => {
      const count = notifications.length;
      notifications.length = 0;
      unreadCount = 0;
      return count;
    },

    subscribe: (type, callback) => {
      if (!subscribers.has(type)) {
        subscribers.set(type, []);
      }
      subscribers.get(type).push(callback);

      return () => {
        const callbacks = subscribers.get(type);
        const index = callbacks.indexOf(callback);
        if (index !== -1) callbacks.splice(index, 1);
      };
    },

    getByType: (type) => notifications.filter((n) => n.type === type),

    getRecent: (limit = 10) => notifications.slice(0, limit),

    search: (query) => {
      const q = query.toLowerCase();
      return notifications.filter(
        (n) => n.title?.toLowerCase().includes(q) || n.message?.toLowerCase().includes(q)
      );
    },

    reset: () => {
      notifications.length = 0;
      subscribers.clear();
      unreadCount = 0;
    },
  };
};

describe('Notification Service Tests', () => {
  let service;

  beforeEach(() => {
    service = createNotificationService();
  });

  // ═══════════════════════════════════════════════════════════════════
  // CREATE
  // ═══════════════════════════════════════════════════════════════════

  describe('Create Notification', () => {
    it('should create notification', () => {
      const notif = service.create({
        type: 'info',
        title: 'Test',
        message: 'Test message',
      });

      expect(notif.id).toBeDefined();
      expect(notif.createdAt).toBeDefined();
      expect(notif.read).toBe(false);
    });

    it('should increment unread count', () => {
      service.create({ type: 'info', title: 'Test' });
      service.create({ type: 'info', title: 'Test 2' });

      expect(service.getUnreadCount()).toBe(2);
    });

    it('should add to beginning of list', () => {
      service.create({ type: 'info', title: 'First' });
      service.create({ type: 'info', title: 'Second' });

      expect(service.getAll()[0].title).toBe('Second');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // MARK AS READ
  // ═══════════════════════════════════════════════════════════════════

  describe('Mark As Read', () => {
    it('should mark notification as read', () => {
      const notif = service.create({ type: 'info', title: 'Test' });

      const result = service.markAsRead(notif.id);

      expect(result).toBe(true);
      expect(service.getUnreadCount()).toBe(0);
    });

    it('should add readAt timestamp', () => {
      const notif = service.create({ type: 'info', title: 'Test' });
      service.markAsRead(notif.id);

      const updated = service.getAll().find((n) => n.id === notif.id);
      expect(updated.readAt).toBeDefined();
    });

    it('should return false for already read', () => {
      const notif = service.create({ type: 'info', title: 'Test' });
      service.markAsRead(notif.id);

      const result = service.markAsRead(notif.id);
      expect(result).toBe(false);
    });

    it('should return false for invalid id', () => {
      expect(service.markAsRead('invalid')).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // MARK ALL AS READ
  // ═══════════════════════════════════════════════════════════════════

  describe('Mark All As Read', () => {
    it('should mark all as read', () => {
      service.create({ type: 'info', title: 'Test 1' });
      service.create({ type: 'info', title: 'Test 2' });
      service.create({ type: 'info', title: 'Test 3' });

      const count = service.markAllAsRead();

      expect(count).toBe(3);
      expect(service.getUnreadCount()).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // DELETE
  // ═══════════════════════════════════════════════════════════════════

  describe('Delete', () => {
    it('should delete notification', () => {
      const notif = service.create({ type: 'info', title: 'Test' });

      const result = service.delete(notif.id);

      expect(result).toBe(true);
      expect(service.getAll().length).toBe(0);
    });

    it('should update unread count on delete', () => {
      const notif = service.create({ type: 'info', title: 'Test' });
      service.delete(notif.id);

      expect(service.getUnreadCount()).toBe(0);
    });

    it('should return false for invalid id', () => {
      expect(service.delete('invalid')).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // DELETE ALL
  // ═══════════════════════════════════════════════════════════════════

  describe('Delete All', () => {
    it('should delete all notifications', () => {
      service.create({ type: 'info', title: 'Test 1' });
      service.create({ type: 'info', title: 'Test 2' });

      const count = service.deleteAll();

      expect(count).toBe(2);
      expect(service.getAll().length).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // SUBSCRIBE
  // ═══════════════════════════════════════════════════════════════════

  describe('Subscribe', () => {
    it('should notify subscribers on create', () => {
      const callback = vi.fn();
      service.subscribe('info', callback);

      service.create({ type: 'info', title: 'Test' });

      expect(callback).toHaveBeenCalled();
    });

    it('should not notify for different type', () => {
      const callback = vi.fn();
      service.subscribe('error', callback);

      service.create({ type: 'info', title: 'Test' });

      expect(callback).not.toHaveBeenCalled();
    });

    it('should notify wildcard subscribers', () => {
      const callback = vi.fn();
      service.subscribe('*', callback);

      service.create({ type: 'info', title: 'Test' });
      service.create({ type: 'error', title: 'Error' });

      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('should return unsubscribe function', () => {
      const callback = vi.fn();
      const unsubscribe = service.subscribe('info', callback);

      unsubscribe();
      service.create({ type: 'info', title: 'Test' });

      expect(callback).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // QUERIES
  // ═══════════════════════════════════════════════════════════════════

  describe('Queries', () => {
    beforeEach(() => {
      service.create({ type: 'info', title: 'Info 1', message: 'Message 1' });
      service.create({ type: 'error', title: 'Error 1', message: 'Failed' });
      service.create({ type: 'info', title: 'Info 2', message: 'Message 2' });
    });

    it('should get by type', () => {
      const infos = service.getByType('info');
      expect(infos.length).toBe(2);
    });

    it('should get recent', () => {
      const recent = service.getRecent(2);
      expect(recent.length).toBe(2);
    });

    it('should search by title', () => {
      const results = service.search('Error');
      expect(results.length).toBe(1);
    });

    it('should search by message', () => {
      const results = service.search('Failed');
      expect(results.length).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // GET UNREAD
  // ═══════════════════════════════════════════════════════════════════

  describe('Get Unread', () => {
    it('should get only unread', () => {
      const notif1 = service.create({ type: 'info', title: 'Test 1' });
      service.create({ type: 'info', title: 'Test 2' });
      service.markAsRead(notif1.id);

      expect(service.getUnread().length).toBe(1);
    });
  });
});
