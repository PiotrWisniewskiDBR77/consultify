/**
 * Persistent Session Store
 * Manages conversation history persistence for AI sessions
 */

import { aiLogger } from './logger.js';

export class PersistentSessionStore {
    constructor(db) {
        this.db = db;
    }

    /**
     * Get recent conversation context for a user
     * @param {string} userId - User ID
     * @param {number} limit - Maximum number of messages to retrieve
     * @returns {Promise<Array>} Array of formatted messages
     */
    async getRecentContext(userId, limit = 10) {
        return new Promise((resolve) => {
            const sql = `
                SELECT role, content, created_at, metadata
                FROM conversation_history
                WHERE user_id = ?
                ORDER BY created_at DESC
                LIMIT ?
            `;

            this.db.all(sql, [userId, limit], (err, rows) => {
                if (err) {
                    aiLogger.error('Error fetching conversation history:', err);
                    resolve([]);
                    return;
                }

                // Reverse to get chronological order (oldest first)
                const messages = (rows || []).reverse().map(row => ({
                    role: row.role,
                    content: row.content,
                    timestamp: row.created_at,
                    metadata: row.metadata ? JSON.parse(row.metadata) : {}
                }));

                resolve(messages);
            });
        });
    }

    /**
     * Add a message to conversation history
     * @param {string} userId - User ID
     * @param {Object} message - Message object with role and content
     * @returns {Promise<void>}
     */
    async addMessage(userId, message) {
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO conversation_history (user_id, role, content, metadata, created_at)
                VALUES (?, ?, ?, ?, datetime('now'))
            `;

            const metadata = JSON.stringify(message.metadata || {});

            this.db.run(sql, [userId, message.role, message.content, metadata], (err) => {
                if (err) {
                    aiLogger.error('Error adding message to conversation history:', err);
                    reject(err);
                    return;
                }

                aiLogger.info(`Added ${message.role} message to conversation history for user ${userId}`);
                resolve();
            });
        });
    }

    /**
     * Clear conversation history for a user
     * @param {string} userId - User ID
     * @returns {Promise<void>}
     */
    async clearHistory(userId) {
        return new Promise((resolve, reject) => {
            const sql = 'DELETE FROM conversation_history WHERE user_id = ?';

            this.db.run(sql, [userId], (err) => {
                if (err) {
                    aiLogger.error('Error clearing conversation history:', err);
                    reject(err);
                    return;
                }

                aiLogger.info(`Cleared conversation history for user ${userId}`);
                resolve();
            });
        });
    }

    /**
     * Get conversation statistics for a user
     * @param {string} userId - User ID
     * @returns {Promise<Object>} Statistics object
     */
    async getStats(userId) {
        return new Promise((resolve) => {
            const sql = `
                SELECT 
                    COUNT(*) as total_messages,
                    SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) as user_messages,
                    SUM(CASE WHEN role = 'assistant' THEN 1 ELSE 0 END) as assistant_messages,
                    MIN(created_at) as first_message_at,
                    MAX(created_at) as last_message_at
                FROM conversation_history
                WHERE user_id = ?
            `;

            this.db.all(sql, [userId], (err, rows) => {
                if (err) {
                    aiLogger.error('Error fetching conversation stats:', err);
                    resolve({
                        total_messages: 0,
                        user_messages: 0,
                        assistant_messages: 0,
                        first_message_at: null,
                        last_message_at: null
                    });
                    return;
                }

                resolve(rows[0] || {
                    total_messages: 0,
                    user_messages: 0,
                    assistant_messages: 0,
                    first_message_at: null,
                    last_message_at: null
                });
            });
        });
    }
}

// Export default instance (will be initialized with actual DB in production)
export default PersistentSessionStore;
