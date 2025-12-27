/**
 * Inbox Service - Inbox Zero methodology for task triage
 * Part of My Work Module PMO Upgrade
 * 
 * Features:
 * - Inbox item aggregation
 * - Triage actions
 * - Bulk operations
 * - Urgency classification
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const BaseService = require('./BaseService');

const INBOX_ITEM_TYPES = {
    NEW_ASSIGNMENT: 'new_assignment',
    MENTION: 'mention',
    ESCALATION: 'escalation',
    REVIEW_REQUEST: 'review_request',
    DECISION_REQUEST: 'decision_request',
    AI_SUGGESTION: 'ai_suggestion'
};

const TRIAGE_ACTIONS = {
    ACCEPT_TODAY: 'accept_today',
    SCHEDULE: 'schedule',
    DELEGATE: 'delegate',
    ARCHIVE: 'archive',
    REJECT: 'reject'
};

const InboxService = Object.assign({}, BaseService, {
    INBOX_ITEM_TYPES,
    TRIAGE_ACTIONS,

    /**
     * Get inbox items for a user
     * @param {string} userId - User ID
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Inbox data with summary and items
     */
    getInbox: async function(userId, options = {}) {
        const { includeTriaged = false, limit = 50 } = options;
        
        // Build query for inbox items
        let sql = `
            SELECT 
                ii.id,
                ii.type,
                ii.title,
                ii.description,
                ii.source_type as sourceType,
                ii.source_user_id as sourceUserId,
                ii.urgency,
                ii.linked_task_id as linkedTaskId,
                ii.linked_initiative_id as linkedInitiativeId,
                ii.linked_decision_id as linkedDecisionId,
                ii.triaged,
                ii.triaged_at as triagedAt,
                ii.triage_action as triageAction,
                ii.created_at as receivedAt,
                u.first_name || ' ' || u.last_name as sourceUserName,
                u.avatar_url as sourceAvatarUrl,
                t.title as taskTitle,
                t.status as taskStatus,
                t.priority as taskPriority,
                t.due_date as taskDueDate
            FROM inbox_items ii
            LEFT JOIN users u ON ii.source_user_id = u.id
            LEFT JOIN tasks t ON ii.linked_task_id = t.id
            WHERE ii.user_id = ?
        `;
        
        if (!includeTriaged) {
            sql += ` AND ii.triaged = 0`;
        }
        
        sql += ` ORDER BY 
            CASE ii.urgency 
                WHEN 'critical' THEN 1 
                WHEN 'high' THEN 2 
                WHEN 'normal' THEN 3 
                WHEN 'low' THEN 4 
            END,
            ii.created_at DESC
            LIMIT ?`;
        
        const items = await this.queryAll(sql, [userId, limit]);
        
        // Transform to response format
        const transformedItems = items.map(item => ({
            id: item.id,
            type: item.type,
            title: item.title,
            description: item.description,
            source: {
                type: item.sourceType || 'user',
                userId: item.sourceUserId,
                userName: item.sourceUserName,
                avatarUrl: item.sourceAvatarUrl
            },
            receivedAt: item.receivedAt,
            urgency: item.urgency || 'normal',
            linkedTaskId: item.linkedTaskId,
            linkedTask: item.linkedTaskId ? {
                id: item.linkedTaskId,
                title: item.taskTitle,
                status: item.taskStatus,
                priority: item.taskPriority,
                dueDate: item.taskDueDate
            } : null,
            linkedInitiativeId: item.linkedInitiativeId,
            linkedDecisionId: item.linkedDecisionId,
            triaged: !!item.triaged,
            triagedAt: item.triagedAt,
            triageAction: item.triageAction
        }));
        
        // Calculate summary
        const untriaged = transformedItems.filter(i => !i.triaged);
        const today = new Date().toISOString().split('T')[0];
        
        const summary = {
            total: untriaged.length,
            critical: untriaged.filter(i => i.urgency === 'critical').length,
            newToday: untriaged.filter(i => i.receivedAt?.startsWith(today)).length,
            groups: {
                urgent: untriaged.filter(i => ['critical', 'high'].includes(i.urgency)),
                new_assignments: untriaged.filter(i => i.type === INBOX_ITEM_TYPES.NEW_ASSIGNMENT),
                mentions: untriaged.filter(i => i.type === INBOX_ITEM_TYPES.MENTION),
                review_requests: untriaged.filter(i => i.type === INBOX_ITEM_TYPES.REVIEW_REQUEST),
                other: untriaged.filter(i => !['new_assignment', 'mention', 'review_request'].includes(i.type) && !['critical', 'high'].includes(i.urgency))
            }
        };
        
        return {
            summary,
            items: transformedItems
        };
    },

    /**
     * Create a new inbox item
     * @param {Object} item - Inbox item data
     * @returns {Promise<Object>} Created item
     */
    createInboxItem: async function(item) {
        const {
            userId,
            type,
            title,
            description,
            sourceType = 'user',
            sourceUserId,
            urgency = 'normal',
            linkedTaskId,
            linkedInitiativeId,
            linkedDecisionId
        } = item;
        
        const id = uuidv4();
        
        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO inbox_items 
                (id, user_id, type, title, description, source_type, source_user_id, 
                 urgency, linked_task_id, linked_initiative_id, linked_decision_id, triaged)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
                [id, userId, type, title, description, sourceType, sourceUserId,
                 urgency, linkedTaskId, linkedInitiativeId, linkedDecisionId],
                (err) => {
                    if (err) return reject(err);
                    resolve({ id, ...item, triaged: false });
                }
            );
        });
    },

    /**
     * Triage an inbox item
     * @param {string} userId - User ID (for authorization)
     * @param {string} itemId - Inbox item ID
     * @param {string} action - Triage action
     * @param {Object} params - Action parameters
     * @returns {Promise<Object>} Triaged item
     */
    triageItem: async function(userId, itemId, action, params = {}) {
        // Validate action
        if (!Object.values(TRIAGE_ACTIONS).includes(action)) {
            throw new Error('Invalid triage action');
        }
        
        // Get the item first
        const item = await this.queryOne(
            `SELECT * FROM inbox_items WHERE id = ? AND user_id = ?`,
            [itemId, userId]
        );
        
        if (!item) {
            throw new Error('Inbox item not found');
        }
        
        if (item.triaged) {
            throw new Error('Item already triaged');
        }
        
        const now = new Date().toISOString();
        
        // Perform triage action
        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE inbox_items 
                 SET triaged = 1, triaged_at = ?, triage_action = ?, triage_params = ?
                 WHERE id = ?`,
                [now, action, JSON.stringify(params), itemId],
                (err) => {
                    if (err) return reject(err);
                    resolve();
                }
            );
        });
        
        // Execute action-specific logic
        switch (action) {
            case TRIAGE_ACTIONS.ACCEPT_TODAY:
                if (item.linked_task_id) {
                    // Add to today's focus
                    const FocusService = require('./focusService');
                    const today = new Date().toISOString().split('T')[0];
                    await FocusService.addToFocus(userId, item.linked_task_id, today, 'morning');
                }
                break;
                
            case TRIAGE_ACTIONS.SCHEDULE:
                if (item.linked_task_id && params.date) {
                    // Update task due date
                    await new Promise((resolve, reject) => {
                        db.run(
                            `UPDATE tasks SET due_date = ? WHERE id = ?`,
                            [params.date, item.linked_task_id],
                            (err) => err ? reject(err) : resolve()
                        );
                    });
                    
                    // Optionally add to focus for that date
                    if (params.addToFocus) {
                        const FocusService = require('./focusService');
                        await FocusService.addToFocus(userId, item.linked_task_id, params.date, params.timeBlock || 'morning');
                    }
                }
                break;
                
            case TRIAGE_ACTIONS.DELEGATE:
                if (item.linked_task_id && params.userId) {
                    // Reassign task
                    await new Promise((resolve, reject) => {
                        db.run(
                            `UPDATE tasks SET assignee_id = ? WHERE id = ?`,
                            [params.userId, item.linked_task_id],
                            (err) => err ? reject(err) : resolve()
                        );
                    });
                    
                    // Create inbox item for new assignee
                    await this.createInboxItem({
                        userId: params.userId,
                        type: INBOX_ITEM_TYPES.NEW_ASSIGNMENT,
                        title: `Delegated task: ${item.title}`,
                        description: params.message || 'A task has been delegated to you',
                        sourceType: 'user',
                        sourceUserId: userId,
                        urgency: 'normal',
                        linkedTaskId: item.linked_task_id
                    });
                }
                break;
                
            case TRIAGE_ACTIONS.REJECT:
                // Just mark as triaged with rejection reason stored in params
                break;
                
            case TRIAGE_ACTIONS.ARCHIVE:
                // Just mark as triaged
                break;
        }
        
        return {
            id: itemId,
            triaged: true,
            triagedAt: now,
            triageAction: action
        };
    },

    /**
     * Bulk triage multiple items
     * @param {string} userId - User ID
     * @param {Array<string>} itemIds - Item IDs to triage
     * @param {string} action - Triage action
     * @param {Object} params - Action parameters
     * @returns {Promise<Object>} Result summary
     */
    bulkTriage: async function(userId, itemIds, action, params = {}) {
        const results = await Promise.allSettled(
            itemIds.map(id => this.triageItem(userId, id, action, params))
        );
        
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        
        return {
            success: true,
            triaged: successful,
            failed,
            items: results
                .filter(r => r.status === 'fulfilled')
                .map(r => r.value)
        };
    },

    /**
     * Get inbox counts for badge display
     * @param {string} userId - User ID
     * @returns {Promise<Object>} Count summary
     */
    getInboxCounts: async function(userId) {
        const sql = `
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN urgency = 'critical' THEN 1 ELSE 0 END) as critical,
                SUM(CASE WHEN urgency = 'high' THEN 1 ELSE 0 END) as high
            FROM inbox_items
            WHERE user_id = ? AND triaged = 0
        `;
        
        const result = await this.queryOne(sql, [userId]);
        
        return {
            total: result?.total || 0,
            critical: result?.critical || 0,
            high: result?.high || 0
        };
    },

    /**
     * Sync tasks to inbox (for new assignments, mentions, etc.)
     * Called when a task is assigned or updated
     * @param {Object} event - Task event data
     */
    syncTaskToInbox: async function(event) {
        const { type, task, actorUserId, targetUserId, message } = event;
        
        // Determine urgency based on task properties
        let urgency = 'normal';
        if (task.priority === 'urgent') {
            urgency = 'critical';
        } else if (task.priority === 'high') {
            urgency = 'high';
        } else if (task.dueDate) {
            const dueDate = new Date(task.dueDate);
            const now = new Date();
            const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
            if (hoursUntilDue <= 24) {
                urgency = 'critical';
            } else if (hoursUntilDue <= 48) {
                urgency = 'high';
            }
        }
        
        // Create inbox item based on event type
        let inboxItem = {
            userId: targetUserId,
            type,
            title: task.title,
            description: message || '',
            sourceType: 'user',
            sourceUserId: actorUserId,
            urgency,
            linkedTaskId: task.id,
            linkedInitiativeId: task.initiativeId
        };
        
        await this.createInboxItem(inboxItem);
    }
});

module.exports = InboxService;



