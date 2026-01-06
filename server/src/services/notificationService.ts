/**
 * Notification Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Facade for Notification System
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';

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
        const db = getDatabase();
        const id = uuidv4();

        try {
            await new Promise<void>((resolve, reject) => {
                db.run(
                    `INSERT INTO notifications (
                        id, user_id, type, title, message, data, read, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
                    [
                        id,
                        payload.userId,
                        payload.type,
                        payload.title,
                        payload.message || '',
                        payload.metadata ? JSON.stringify(payload.metadata) : null,
                        new Date().toISOString(),
                    ],
                    (err) => {
                        if (err) {
                            console.warn('[NotificationService] Failed to insert notification:', err.message);
                            resolve();
                        } else {
                            resolve();
                        }
                    },
                );
            });
            return { id, ...payload };
        } catch (error) {
            console.error('[NotificationService] Error:', error);
            return null;
        }
    }

    async getForUser(
        userId: string,
        options: { unreadOnly?: boolean; limit?: number; projectId?: string } = {},
    ): Promise<any[]> {
        const db = getDatabase();
        const { unreadOnly = false, limit = 50, projectId } = options;

        try {
            return await new Promise<any[]>((resolve, reject) => {
                let sql = `SELECT * FROM notifications WHERE user_id = ?`;
                const params: any[] = [userId];

                if (unreadOnly) {
                    sql += ` AND read = 0`;
                }

                // Note: projectId filtering would require additional schema changes
                // For now, we'll ignore it to match the existing schema

                sql += ` ORDER BY created_at DESC LIMIT ?`;
                params.push(limit);

                db.all(sql, params, (err, rows: any[]) => {
                    if (err) {
                        console.warn('[NotificationService] Failed to fetch notifications:', err.message);
                        resolve([]);
                    } else {
                        // Parse JSON data field if present
                        const notifications = rows.map((row) => ({
                            ...row,
                            data: row.data ? JSON.parse(row.data) : null,
                            read: Boolean(row.read),
                        }));
                        resolve(notifications);
                    }
                });
            });
        } catch (error) {
            console.error('[NotificationService] Error in getForUser:', error);
            return [];
        }
    }

    async getCounts(userId: string): Promise<{ total: number; unread: number }> {
        const db = getDatabase();

        try {
            return await new Promise<{ total: number; unread: number }>((resolve, reject) => {
                db.get(
                    `SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN read = 0 THEN 1 ELSE 0 END) as unread
                    FROM notifications 
                    WHERE user_id = ?`,
                    [userId],
                    (err, row: any) => {
                        if (err) {
                            console.warn('[NotificationService] Failed to get counts:', err.message);
                            resolve({ total: 0, unread: 0 });
                        } else {
                            resolve({
                                total: row?.total || 0,
                                unread: row?.unread || 0,
                            });
                        }
                    },
                );
            });
        } catch (error) {
            console.error('[NotificationService] Error in getCounts:', error);
            return { total: 0, unread: 0 };
        }
    }

    async markRead(notificationId: string, userId: string): Promise<{ success: boolean }> {
        const db = getDatabase();

        try {
            return await new Promise<{ success: boolean }>((resolve, reject) => {
                db.run(
                    `UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?`,
                    [notificationId, userId],
                    function (err) {
                        if (err) {
                            console.warn('[NotificationService] Failed to mark as read:', err.message);
                            resolve({ success: false });
                        } else {
                            resolve({ success: (this as any).changes > 0 });
                        }
                    },
                );
            });
        } catch (error) {
            console.error('[NotificationService] Error in markRead:', error);
            return { success: false };
        }
    }

    async markAllRead(userId: string): Promise<{ success: boolean; count: number }> {
        const db = getDatabase();

        try {
            return await new Promise<{ success: boolean; count: number }>((resolve, reject) => {
                db.run(`UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0`, [userId], function (err) {
                    if (err) {
                        console.warn('[NotificationService] Failed to mark all as read:', err.message);
                        resolve({ success: false, count: 0 });
                    } else {
                        resolve({
                            success: true,
                            count: (this as any).changes || 0,
                        });
                    }
                });
            });
        } catch (error) {
            console.error('[NotificationService] Error in markAllRead:', error);
            return { success: false, count: 0 };
        }
    }

    async delete(notificationId: string, userId: string): Promise<{ success: boolean }> {
        const db = getDatabase();

        try {
            return await new Promise<{ success: boolean }>((resolve, reject) => {
                db.run(
                    `DELETE FROM notifications WHERE id = ? AND user_id = ?`,
                    [notificationId, userId],
                    function (err) {
                        if (err) {
                            console.warn('[NotificationService] Failed to delete notification:', err.message);
                            resolve({ success: false });
                        } else {
                            resolve({ success: (this as any).changes > 0 });
                        }
                    },
                );
            });
        } catch (error) {
            console.error('[NotificationService] Error in delete:', error);
            return { success: false };
        }
    }
}

export default new NotificationService();
