/**
 * Notification Service Proxy
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Standardized PascalCase wrapper for NotificationService
 */

import { createCachedLazyService } from '../utils/lazyServiceLoader.js';

// Lazy load the JS service module
const loadNotificationService = createCachedLazyService('../../services/notificationService.js');

/**
 * Export a proxy object that awaits the service on each call.
 * This ensures that methods are only called once the service is loaded.
 */
const NotificationService = {
    create: async (notification: any) => {
        const service = await loadNotificationService();
        return (service as any).create(notification);
    },
    getForUser: async (userId: string, options: any = {}) => {
        const service = await loadNotificationService();
        return (service as any).getForUser(userId, options);
    },
    markRead: async (notificationId: string, userId: string) => {
        const service = await loadNotificationService();
        return (service as any).markRead(notificationId, userId);
    },
    markAllRead: async (userId: string) => {
        const service = await loadNotificationService();
        return (service as any).markAllRead(userId);
    },
    delete: async (notificationId: string, userId: string) => {
        const service = await loadNotificationService();
        return (service as any).delete(notificationId, userId);
    },
    getCounts: async (userId: string) => {
        const service = await loadNotificationService();
        return (service as any).getCounts(userId);
    },
    deliverNotification: async (userId: string, notification: any) => {
        const service = await loadNotificationService();
        return (service as any).deliverNotification(userId, notification);
    },
    notifyTaskAssigned: async (userId: string, orgId: string, projectId: string, taskId: string, taskTitle: string) => {
        const service = await loadNotificationService();
        return (service as any).notifyTaskAssigned(userId, orgId, projectId, taskId, taskTitle);
    }
};

export default NotificationService;
