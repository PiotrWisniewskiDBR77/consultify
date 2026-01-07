/**
 * Push and Real-time Notification Tests
 * Tests for push, email, and in-app notifications
 * 
 * @module tests/notifications/notification-push.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Push notification manager
const createPushManager = () => {
    const subscriptions = new Map(); // userId -> subscription[]
    const sentPushes = [];

    return {
        subscribe: (userId, subscription) => {
            const subs = subscriptions.get(userId) || [];
            subs.push({
                id: crypto.randomUUID(),
                ...subscription,
                subscribedAt: Date.now(),
            });
            subscriptions.set(userId, subs);
        },

        unsubscribe: (userId, subscriptionId) => {
            const subs = subscriptions.get(userId) || [];
            const index = subs.findIndex(s => s.id === subscriptionId);
            if (index !== -1) {
                subs.splice(index, 1);
                return true;
            }
            return false;
        },

        getSubscriptions: (userId) => {
            return subscriptions.get(userId) || [];
        },

        send: async (userId, payload) => {
            const subs = subscriptions.get(userId) || [];

            const results = [];
            for (const sub of subs) {
                const result = {
                    subscriptionId: sub.id,
                    success: true,
                    sentAt: Date.now(),
                };
                results.push(result);
                sentPushes.push({ userId, subscription: sub, payload, ...result });
            }

            return results;
        },

        getSentPushes: () => [...sentPushes],
    };
};

// Email notification handler
const createEmailHandler = () => {
    const sentEmails = [];

    return {
        send: async (to, subject, body, options = {}) => {
            const email = {
                id: crypto.randomUUID(),
                to,
                subject,
                body,
                html: options.html || null,
                from: options.from || 'noreply@example.com',
                sentAt: Date.now(),
            };

            sentEmails.push(email);
            return email;
        },

        getSentEmails: () => [...sentEmails],

        getEmailsTo: (address) => sentEmails.filter(e => e.to === address),
    };
};

// In-app notification feed
const createNotificationFeed = () => {
    const feeds = new Map();
    const listeners = new Map();

    return {
        push: (userId, notification) => {
            const feed = feeds.get(userId) || [];
            const item = {
                id: crypto.randomUUID(),
                ...notification,
                createdAt: Date.now(),
                read: false,
            };
            feed.unshift(item);
            feeds.set(userId, feed);

            const userListeners = listeners.get(userId) || [];
            userListeners.forEach(fn => fn(item));

            return item;
        },

        getFeed: (userId, limit = 20) => {
            const feed = feeds.get(userId) || [];
            return feed.slice(0, limit);
        },

        subscribe: (userId, callback) => {
            const userListeners = listeners.get(userId) || [];
            userListeners.push(callback);
            listeners.set(userId, userListeners);

            return () => {
                const idx = userListeners.indexOf(callback);
                if (idx !== -1) userListeners.splice(idx, 1);
            };
        },

        markRead: (userId, notificationId) => {
            const feed = feeds.get(userId) || [];
            const notification = feed.find(n => n.id === notificationId);
            if (notification) {
                notification.read = true;
                return true;
            }
            return false;
        },
    };
};

describe('Push Manager Tests', () => {
    let pushManager;

    beforeEach(() => {
        pushManager = createPushManager();
    });

    it('should subscribe device', () => {
        pushManager.subscribe('user-1', { endpoint: 'https://fcm.example.com/...' });
        expect(pushManager.getSubscriptions('user-1')).toHaveLength(1);
    });

    it('should unsubscribe device', () => {
        pushManager.subscribe('user-1', { endpoint: 'test' });
        const subs = pushManager.getSubscriptions('user-1');
        pushManager.unsubscribe('user-1', subs[0].id);
        expect(pushManager.getSubscriptions('user-1')).toHaveLength(0);
    });

    it('should send to all subscriptions', async () => {
        pushManager.subscribe('user-1', { endpoint: 'device1' });
        pushManager.subscribe('user-1', { endpoint: 'device2' });
        const results = await pushManager.send('user-1', { title: 'Test' });
        expect(results).toHaveLength(2);
    });
});

describe('Email Handler Tests', () => {
    let emailHandler;

    beforeEach(() => {
        emailHandler = createEmailHandler();
    });

    it('should send email', async () => {
        const result = await emailHandler.send('user@example.com', 'Welcome', 'Hello!');
        expect(result.to).toBe('user@example.com');
    });

    it('should track sent emails', async () => {
        await emailHandler.send('a@test.com', 'A', '');
        await emailHandler.send('b@test.com', 'B', '');
        expect(emailHandler.getSentEmails()).toHaveLength(2);
    });
});

describe('Notification Feed Tests', () => {
    let feed;

    beforeEach(() => {
        feed = createNotificationFeed();
    });

    it('should push notification', () => {
        const item = feed.push('user-1', { title: 'New message' });
        expect(item.id).toBeTruthy();
    });

    it('should get feed', () => {
        feed.push('user-1', { title: 'A' });
        feed.push('user-1', { title: 'B' });
        const items = feed.getFeed('user-1');
        expect(items).toHaveLength(2);
        expect(items[0].title).toBe('B');
    });

    it('should notify subscribers', () => {
        const handler = vi.fn();
        feed.subscribe('user-1', handler);
        feed.push('user-1', { title: 'Real-time' });
        expect(handler).toHaveBeenCalled();
    });
});
