/**
 * Notification Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Facade for Notification System
 */

import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';

interface NotificationPayload {
    userId: string;
    organizationId?: string;
    projectId?: string;
    type: string;
    severity?: 'INFO' | 'WARNING' | 'CRITICAL' | 'SUCCESS';
    title: string;
    message: string;
    relatedObjectType?: string;
    relatedObjectId?: string;
    isActionable?: boolean;
    actionUrl?: string;
    metadata?: Record<string, unknown>;
}

class NotificationService {
    async create(payload: NotificationPayload): Promise<any> {
        console.log('[NotificationService] Creating notification:', payload.title);
        const id = uuidv4();

        try {
            const sql = `INSERT INTO notifications (
                        id, user_id, type, title, message, data, is_read, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, 0, ?)`;
            
            const result = await dbRun(sql, [
                id,
                payload.userId,
                payload.type,
                payload.title,
                payload.message || '',
                payload.metadata ? JSON.stringify(payload.metadata) : null,
                new Date().toISOString(),
            ]);

            if (!result.success) {
                console.error('[NotificationService] Failed to insert notification:', result.error);
            }
            
            return { id, ...payload };
        } catch (error: any) {
            console.error('[NotificationService] Error in create:', error.message, error);
            return null;
        }
    }

    async getForUser(
        userId: string,
        options: { unreadOnly?: boolean; limit?: number; projectId?: string } = {},
    ): Promise<any[]> {
        console.log('[NotificationService] Getting notifications for user:', userId);
        const { unreadOnly = false, limit = 50, projectId } = options;

        try {
            let sql = `SELECT * FROM notifications WHERE user_id = ?`;
            const params: any[] = [userId];

            if (unreadOnly) {
                sql += ` AND is_read = 0`;
            }

            sql += ` ORDER BY created_at DESC LIMIT ?`;
            params.push(limit);

            console.log('[NotificationService] Executing SQL:', sql, params);
            const rows = await dbAll<any>(sql, params);
            console.log('[NotificationService] Found rows:', rows?.length);
            
            if (!rows) return [];

            return rows.map((row) => ({
                ...row,
                data: row.data ? JSON.parse(row.data) : null,
                read: Boolean(row.read || row.is_read),
            }));
        } catch (error: any) {
            console.error('[NotificationService] Error in getForUser:', error.message, error);
            throw error; // Rethrow to be caught by route handler
        }
    }

    async getCounts(userId: string): Promise<{ total: number; unread: number }> {
        console.log('[NotificationService] Getting counts for user:', userId);
        try {
            const sql = `SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread
                    FROM notifications 
                    WHERE user_id = ?`;
            
            const row = await dbGet<any>(sql, [userId]);
            console.log('[NotificationService] Counts row:', row);
            
            return {
                total: row?.total || 0,
                unread: row?.unread || 0,
            };
        } catch (error: any) {
            console.error('[NotificationService] Error in getCounts:', error.message, error);
            return { total: 0, unread: 0 };
        }
    }

    async markRead(notificationId: string, userId: string): Promise<{ success: boolean }> {
        try {
            const sql = `UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`;
            const result = await dbRun(sql, [notificationId, userId]);
            return { success: result.success && (result as any).changes > 0 };
        } catch (error: any) {
            console.error('[NotificationService] Error in markRead:', error.message);
            return { success: false };
        }
    }

    async markAllRead(userId: string): Promise<{ success: boolean; count: number }> {
        try {
            const sql = `UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0`;
            const result = await dbRun(sql, [userId]);
            return {
                success: result.success,
                count: (result as any).changes || 0,
            };
        } catch (error: any) {
            console.error('[NotificationService] Error in markAllRead:', error.message);
            return { success: false, count: 0 };
        }
    }

    async delete(notificationId: string, userId: string): Promise<{ success: boolean }> {
        try {
            const sql = `DELETE FROM notifications WHERE id = ? AND user_id = ?`;
            const result = await dbRun(sql, [notificationId, userId]);
            return { success: result.success && (result as any).changes > 0 };
        } catch (error: any) {
            console.error('[NotificationService] Error in delete:', error.message);
            return { success: false };
        }
    }
}

export default new NotificationService();
