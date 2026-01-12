/**
 * Notifications API Module
 * Enterprise SaaS Architecture - User Notifications
 */

import { API_URL, fetchWithRetry, getHeaders, handleResponse } from './baseClient';

export interface Notification {
    id: string;
    userId: string;
    type: string;
    title: string;
    message: string;
    priority: 'high' | 'normal' | 'low';
    category: 'ai' | 'task' | 'system' | 'billing';
    isRead: boolean;
    createdAt: string;
    actionLabel?: string;
    link?: string;
    metadata?: Record<string, unknown>;
}

export interface NotificationPreferences {
    email: boolean;
    push: boolean;
    inApp: boolean;
    categories: Record<string, boolean>;
}

export const NotificationApi = {
    // ==========================================
    // NOTIFICATIONS
    // ==========================================

    fetchNotifications: async (): Promise<Notification[]> => {
        const res = await fetchWithRetry(`${API_URL}/notifications`, { headers: getHeaders() });
        return handleResponse(res, 'Failed to fetch notifications');
    },

    getNotifications: async (unreadOnly = false, limit = 50): Promise<Notification[]> => {
        const params = new URLSearchParams();
        if (unreadOnly) params.append('unreadOnly', 'true');
        params.append('limit', limit.toString());
        const res = await fetch(`${API_URL}/notifications?${params.toString()}`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch notifications');
        return res.json();
    },

    getUnreadNotificationCount: async (): Promise<number> => {
        const res = await fetch(`${API_URL}/notifications/unread-count`, { headers: getHeaders() });
        if (!res.ok) return 0;
        const data = await res.json();
        return data.count;
    },

    markNotificationRead: async (id: string): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/notifications/${id}/read`, {
            method: 'PATCH',
            headers: getHeaders(),
        });
        if (!res.ok) throw new Error('Failed to mark notification as read');
    },

    markAllNotificationsRead: async (): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/notifications/mark-all-read`, {
            method: 'POST',
            headers: getHeaders(),
        });
        if (!res.ok) throw new Error('Failed to mark all notifications as read');
    },

    deleteNotification: async (id: string): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/notifications/${id}`, {
            method: 'DELETE',
            headers: getHeaders(),
        });
        if (!res.ok) throw new Error('Failed to delete notification');
    },

    deleteReadNotifications: async (): Promise<void> => {
        const res = await fetch(`${API_URL}/notifications`, {
            method: 'DELETE',
            headers: getHeaders(),
        });
        if (!res.ok) throw new Error('Failed to delete read notifications');
    },

    createNotification: async (notification: {
        userId?: string;
        type: string;
        title: string;
        message: string;
        priority?: 'high' | 'normal' | 'low';
        category?: 'ai' | 'task' | 'system';
        actionLabel?: string;
        link?: string;
    }): Promise<void> => {
        const res = await fetch(`${API_URL}/notifications`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(notification),
        });
        if (!res.ok) throw new Error('Failed to create notification');
    },

    // ==========================================
    // NOTIFICATION PREFERENCES
    // ==========================================

    getNotificationPreferences: async (userId: string): Promise<NotificationPreferences> => {
        const res = await fetchWithRetry(`${API_URL}/settings/notifications?userId=${userId}`, {
            headers: getHeaders(),
        });
        if (!res.ok) return { email: true, push: true, inApp: true, categories: {} };
        return res.json();
    },

    saveNotificationPreferences: async (userId: string, preferences: NotificationPreferences): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/settings/notifications`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ userId, preferences }),
        });
        if (!res.ok) throw new Error('Failed to save notification preferences');
    },
};
