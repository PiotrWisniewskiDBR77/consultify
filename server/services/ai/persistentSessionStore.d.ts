declare namespace _default {
    export { PersistentSessionStore };
}
export default _default;
export class PersistentSessionStore {
    constructor(database?: any);
    db: any;
    activeContextLimit: number;
    /**
     * Get recent context for a user from the database
     * @param {string} userId - User ID to fetch context for
     * @param {number} limit - Number of recent messages to retrieve
     * @returns {Promise<Array>} Array of formatted context chunks
     */
    getRecentContext(userId: string, limit?: number): Promise<any[]>;
    /**
     * Add a message to the conversation history
     * @param {string} userId - User ID
     * @param {Object} message - Message object { role, content, ... }
     * @param {string} conversationId - Optional explicit conversation ID
     */
    addMessage(userId: string, message: Object, conversationId?: string): Promise<any>;
    /**
     * Clear session history (e.g. user requests "New Chat")
     */
    clearSession(userId: any): Promise<any>;
    /**
     * Cleanup old sessions (e.g. older than 30 days)
     */
    cleanup(): void;
    _parseJSON(str: any): any;
}
//# sourceMappingURL=persistentSessionStore.d.ts.map