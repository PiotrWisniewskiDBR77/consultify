/**
 * Persistent Session Store (Layer 1)
 * 
 * Database-backed implementation of session memory for AI context.
 * Replaces the ephemeral in-memory map to ensure context survives server restarts.
 */

import { getDatabase } from '../../src/database/Database.ts';
const db = getDatabase();
import { v4 as uuidv4 } from 'uuid';
import { aiLogger } from './logger.js';

class PersistentSessionStore {
    constructor(database = db) {
        this.db = database;
        // TTL is handled by cleanup query, default 2 hours for active context focus
        // But we keep history longer in DB for audit/history features
        this.activeContextLimit = 50;
    }

    /**
     * Get recent context for a user from the database
     * @param {string} userId - User ID to fetch context for
     * @param {number} limit - Number of recent messages to retrieve
     * @returns {Promise<Array>} Array of formatted context chunks
     */
    async getRecentContext(userId, limit = 10) {
        return new Promise((resolve, reject) => {
            // Get most recent conversation_id for this user
            // In a more complex system, we'd pass conversationId explicitly.
            // For now, we assume the latest active thread.
            const sql = `
                SELECT role, content, CreateD_at, metadata
                FROM conversation_history 
                WHERE user_id = ? 
                ORDER BY created_at DESC 
                LIMIT ?
            `;

            this.db.all(sql, [userId, limit], (err, rows) => {
                if (err) {
                    aiLogger.error('PersistentSessionStore', `Error fetching context: ${err.message}`);
                    return resolve([]); // Fail gracefully with empty context
                }

                if (!rows || rows.length === 0) return resolve([]);

                // Reverse to chronological order for the AI context window
                const context = rows.reverse().map(row => ({
                    content: `[${row.role}] ${row.content}`,
                    source: 'session',
                    relevance: 0.9, // High relevance for immediate history
                    metadata: {
                        timestamp: row.created_at,
                        ...this._parseJSON(row.metadata)
                    }
                }));

                resolve(context);
            });
        });
    }

    /**
     * Add a message to the conversation history
     * @param {string} userId - User ID
     * @param {Object} message - Message object { role, content, ... }
     * @param {string} conversationId - Optional explicit conversation ID
     */
    async addMessage(userId, message, conversationId = null) {
        return new Promise((resolve, reject) => {
            const id = uuidv4();
            // If no conversationId provided, find the latest active one or create new (implied logic)
            // For simplicity in this drop-in replacement, we will use a "default-thread-{userId}" 
            // if not provided, or better, generated one.
            // ACTUALLY: To keep it strictly compatible with previous usage which didn't track conversation IDs,
            // we will generate one or reuse 'latest'.

            // For now, let's use a day-bucketed conversation ID if not passed, 
            // to group daily sessions roughly.
            const finalConvId = conversationId || `daily-${userId}-${new Date().toISOString().slice(0, 10)}`;

            const metadata = {
                timestamp: message.timestamp || new Date().toISOString()
            };

            const sql = `
                INSERT INTO conversation_history (id, conversation_id, user_id, role, content, metadata) 
                VALUES (?, ?, ?, ?, ?, ?)
            `;

            this.db.run(sql, [
                id,
                finalConvId,
                userId,
                message.role,
                message.content,
                JSON.stringify(metadata)
            ], (err) => {
                if (err) {
                    aiLogger.error('PersistentSessionStore', `Error saving message: ${err.message}`);
                    reject(err);
                } else {
                    resolve({ id });
                }
            });
        });
    }

    /**
     * Clear session history (e.g. user requests "New Chat")
     */
    async clearSession(userId) {
        return new Promise((resolve, reject) => {
            // We soft-delete or just ignore previous messages by generating a new conversation ID in logic.
            // But strict "clear" might mean deleting for privacy.
            // For now, let's just delete recent history to effectively clear context.
            // A better approach for "New Chat" is to just rotate the Conversation ID.

            // NOTE: The previous in-memory store deleted data. To maintain parity:
            this.db.run(`DELETE FROM conversation_history WHERE user_id = ?`, [userId], (err) => {
                if (err) {
                    aiLogger.error('PersistentSessionStore', `Error clearing session: ${err.message}`);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * Cleanup old sessions (e.g. older than 30 days)
     */
    cleanup() {
        const daysToKeep = 30;
        this.db.run(
            `DELETE FROM conversation_history WHERE created_at < datetime('now', '-' || ? || ' days')`,
            [daysToKeep],
            (err) => {
                if (err) aiLogger.warn('PersistentSessionStore', `Cleanup error: ${err.message}`);
                else aiLogger.info('PersistentSessionStore', `Cleaned up messages older than ${daysToKeep} days`);
            }
        );
    }

    _parseJSON(str) {
        try {
            return JSON.parse(str);
        } catch {
            return {};
        }
    }
}

export {
PersistentSessionStore
};

export default { PersistentSessionStore };
