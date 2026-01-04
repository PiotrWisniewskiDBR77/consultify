export default InboxService;
declare const InboxService: typeof BaseService & {
    INBOX_ITEM_TYPES: {
        NEW_ASSIGNMENT: string;
        MENTION: string;
        ESCALATION: string;
        REVIEW_REQUEST: string;
        DECISION_REQUEST: string;
        AI_SUGGESTION: string;
    };
    TRIAGE_ACTIONS: {
        ACCEPT_TODAY: string;
        SCHEDULE: string;
        DELEGATE: string;
        ARCHIVE: string;
        REJECT: string;
    };
    /**
     * Get inbox items for a user
     * @param {string} userId - User ID
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Inbox data with summary and items
     */
    getInbox: (userId: string, options?: Object) => Promise<Object>;
    /**
     * Create a new inbox item
     * @param {Object} item - Inbox item data
     * @returns {Promise<Object>} Created item
     */
    createInboxItem: (item: Object) => Promise<Object>;
    /**
     * Triage an inbox item
     * @param {string} userId - User ID (for authorization)
     * @param {string} itemId - Inbox item ID
     * @param {string} action - Triage action
     * @param {Object} params - Action parameters
     * @returns {Promise<Object>} Triaged item
     */
    triageItem: (userId: string, itemId: string, action: string, params?: Object) => Promise<Object>;
    /**
     * Bulk triage multiple items
     * @param {string} userId - User ID
     * @param {Array<string>} itemIds - Item IDs to triage
     * @param {string} action - Triage action
     * @param {Object} params - Action parameters
     * @returns {Promise<Object>} Result summary
     */
    bulkTriage: (userId: string, itemIds: Array<string>, action: string, params?: Object) => Promise<Object>;
    /**
     * Get inbox counts for badge display
     * @param {string} userId - User ID
     * @returns {Promise<Object>} Count summary
     */
    getInboxCounts: (userId: string) => Promise<Object>;
    /**
     * Sync tasks to inbox (for new assignments, mentions, etc.)
     * Called when a task is assigned or updated
     * @param {Object} event - Task event data
     */
    syncTaskToInbox: (event: Object) => Promise<void>;
};
import BaseService from './BaseService.js';
//# sourceMappingURL=inboxService.d.ts.map