/**
 * Initiative Status Service
 * Handles status transitions, validation, and audit logging
 * Integrates with StatusMachine for transition rules
 */

// Dependency injection for testing
const deps = {
    _db: null,
    _uuidv4: null,
    _StatusMachine: null,
    _queryHelpers: null,

    get db() { return this._db; },
    set db(val) { this._db = val; },

    get uuidv4() { return this._uuidv4; },
    set uuidv4(val) { this._uuidv4 = val; },

    get StatusMachine() { return this._StatusMachine; },
    set StatusMachine(val) { this._StatusMachine = val; },

    get queryHelpers() { return this._queryHelpers; },
    set queryHelpers(val) { this._queryHelpers = val; }
};

/**
 * Initialize dependencies lazily
 */
async function initDeps() {
    if (!deps._db) {
        const { default: db } = await import('../database.js');
        deps._db = db;
    }
    if (!deps._uuidv4) {
        const { v4 } = await import('uuid');
        deps._uuidv4 = v4;
    }
    if (!deps._StatusMachine) {
        const { default: StatusMachine } = await import('./statusMachine.js');
        deps._StatusMachine = StatusMachine;
    }
    if (!deps._queryHelpers) {
        const queryHelpers = await import('../utils/queryHelpers.js');
        deps._queryHelpers = queryHelpers;
    }
}

/**
 * Calculate charter completeness percentage
 * @param {object} initiative - Initiative object
 * @returns {number} Completeness percentage (0-100)
 */
const calculateCharterCompleteness = (initiative) => {
    const requiredFields = [
        { field: 'name', weight: 10 },
        { field: 'summary', weight: 10 },
        { field: 'problem_statement', weight: 15 },
        { field: 'hypothesis', weight: 10 },
        { field: 'business_value', weight: 10 },
        { field: 'cost_capex', weight: 5 },
        { field: 'cost_opex', weight: 5 },
        { field: 'expected_roi', weight: 5 },
        { field: 'owner_business_id', weight: 10 },
        { field: 'owner_execution_id', weight: 5 },
        { field: 'planned_start_date', weight: 5 },
        { field: 'planned_end_date', weight: 5 },
    ];

    const arrayFields = [
        { field: 'deliverables', weight: 5 },
        { field: 'success_criteria', weight: 5 },
        { field: 'key_risks', weight: 5 },
    ];

    let totalWeight = 0;
    let completedWeight = 0;

    // Check required fields
    requiredFields.forEach(({ field, weight }) => {
        totalWeight += weight;
        const value = initiative[field];
        if (value !== null && value !== undefined && value !== '' && value !== 0) {
            completedWeight += weight;
        }
    });

    // Check array fields (JSON strings in DB)
    arrayFields.forEach(({ field, weight }) => {
        totalWeight += weight;
        let value = initiative[field];
        
        // Parse JSON if string
        if (typeof value === 'string') {
            try {
                value = JSON.parse(value);
            } catch (e) {
                value = [];
            }
        }

        if (Array.isArray(value) && value.length > 0) {
            completedWeight += weight;
        }
    });

    return Math.round((completedWeight / totalWeight) * 100);
};

/**
 * Get task statistics for initiative
 * @param {string} initiativeId 
 * @returns {Promise<{total: number, done: number, pending: number, blocked: number}>}
 */
const getTaskStats = async (initiativeId) => {
    try {
        const sql = `
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'DONE' THEN 1 ELSE 0 END) as done,
                SUM(CASE WHEN status IN ('TODO', 'IN_PROGRESS') THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'BLOCKED' THEN 1 ELSE 0 END) as blocked
            FROM tasks 
            WHERE initiative_id = ?
        `;
        const result = await queryHelpers.queryOne(sql, [initiativeId]);
        return {
            total: result?.total || 0,
            done: result?.done || 0,
            pending: result?.pending || 0,
            blocked: result?.blocked || 0
        };
    } catch (e) {
        return { total: 0, done: 0, pending: 0, blocked: 0 };
    }
};

/**
 * Get pending decisions for initiative
 * @param {string} initiativeId 
 * @returns {Promise<number>}
 */
const getPendingDecisions = async (initiativeId) => {
    try {
        const sql = `
            SELECT COUNT(*) as count 
            FROM decisions 
            WHERE initiative_id = ? AND status = 'PENDING' AND is_blocking = 1
        `;
        const result = await queryHelpers.queryOne(sql, [initiativeId]);
        return result?.count || 0;
    } catch (e) {
        return 0;
    }
};

/**
 * Get pending reviews for initiative
 * @param {string} initiativeId 
 * @returns {Promise<number>}
 */
const getPendingReviews = async (initiativeId) => {
    try {
        const sql = `
            SELECT COUNT(*) as count 
            FROM initiative_reviews 
            WHERE initiative_id = ? AND status = 'PENDING'
        `;
        const result = await queryHelpers.queryOne(sql, [initiativeId]);
        return result?.count || 0;
    } catch (e) {
        return 0;
    }
};

const InitiativeStatusService = {
    // For testing
    setDependencies: (newDeps = {}) => {
        Object.assign(deps, newDeps);
    },

    /**
     * Get initiative with full status context
     */
    getInitiativeWithContext: async (initiativeId, orgId) => {
        const sql = `
            SELECT i.*, 
                p.name as project_name,
                l.name as location_name
            FROM initiatives i
            LEFT JOIN projects p ON i.project_id = p.id
            LEFT JOIN locations l ON i.location_id = l.id
            WHERE i.id = ? AND i.organization_id = ?
        `;
        
        const initiative = await queryHelpers.queryOne(sql, [initiativeId, orgId]);
        if (!initiative) return null;

        // Calculate charter completeness
        const charterCompleteness = calculateCharterCompleteness(initiative);
        
        // Get task stats
        const taskStats = await getTaskStats(initiativeId);
        
        // Get pending decisions
        const blockingDecisions = await getPendingDecisions(initiativeId);
        
        // Get pending reviews
        const pendingReviews = await getPendingReviews(initiativeId);

        return {
            ...initiative,
            charterCompleteness,
            taskStats,
            blockingDecisions,
            pendingReviews,
            hasBlockingDecisions: blockingDecisions > 0
        };
    },

    /**
     * Validate and perform status transition
     * @param {string} initiativeId 
     * @param {string} orgId 
     * @param {string} userId 
     * @param {string} newStatus 
     * @param {object} transitionContext - Additional context (reason, etc.)
     * @returns {Promise<{success: boolean, error?: string, initiative?: object}>}
     */
    transitionStatus: async (initiativeId, orgId, userId, newStatus, transitionContext = {}) => {
        // Get current initiative with full context
        const initiative = await InitiativeStatusService.getInitiativeWithContext(initiativeId, orgId);
        
        if (!initiative) {
            return { success: false, error: 'Initiative not found' };
        }

        const currentStatus = initiative.status || 'DRAFT';
        
        // Build validation context
        const validationContext = {
            charterCompleteness: initiative.charterCompleteness,
            pendingTasks: initiative.taskStats.pending,
            hasBlockingDecisions: initiative.hasBlockingDecisions,
            pendingReviews: initiative.pendingReviews,
            blockedReason: transitionContext.reason,
            requiresApproval: false, // Could be based on org settings
            isApproved: true, // Simplified - in real app check approval workflow
            requiresScheduling: false, // Could be based on org settings
            isScheduled: !!(initiative.planned_start_date && initiative.planned_end_date)
        };

        // Validate transition
        const validation = StatusMachine.validateInitiativeTransition(
            currentStatus, 
            newStatus, 
            validationContext
        );

        if (!validation.valid) {
            return { success: false, error: validation.reason };
        }

        // Check module transition
        const moduleTransition = StatusMachine.isModuleTransition(currentStatus, newStatus);

        const now = new Date().toISOString();
        
        // Build update query based on new status
        const updates = ['status = ?', 'updated_at = ?', 'charter_completeness = ?'];
        const params = [newStatus, now, initiative.charterCompleteness];

        // Status-specific updates
        if (newStatus === 'BLOCKED') {
            updates.push('blocked_reason = ?', 'blocked_at = ?');
            params.push(transitionContext.reason || 'No reason provided', now);
        } else if (newStatus === 'DONE') {
            updates.push('completed_at = ?');
            params.push(now);
        } else if (newStatus === 'CANCELLED') {
            updates.push('cancelled_reason = ?', 'cancelled_at = ?');
            params.push(transitionContext.reason || 'No reason provided', now);
        } else if (newStatus === 'ARCHIVED') {
            updates.push('archived_at = ?');
            params.push(now);
        } else if (newStatus === 'REVIEW') {
            updates.push('review_submitted_at = ?', 'review_submitted_by = ?');
            params.push(now, userId);
        } else if (newStatus === 'APPROVED') {
            updates.push('approved_at = ?', 'approved_by = ?');
            params.push(now, userId);
        } else if (newStatus === 'EXECUTING') {
            updates.push('execution_started_at = ?', 'actual_start_date = ?');
            params.push(now, now);
        }

        // Clear blocked reason when unblocking
        if (currentStatus === 'BLOCKED' && newStatus === 'EXECUTING') {
            updates.push('blocked_reason = NULL', 'blocked_at = NULL');
        }

        params.push(initiativeId, orgId);

        const updateSql = `
            UPDATE initiatives 
            SET ${updates.join(', ')} 
            WHERE id = ? AND organization_id = ?
        `;

        await queryHelpers.queryRun(updateSql, params);

        // Log status change in history
        const historyId = deps.uuidv4();
        const historySql = `
            INSERT INTO initiative_status_history 
            (id, initiative_id, from_status, to_status, changed_by, reason, context_json, changed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        try {
            await queryHelpers.queryRun(historySql, [
                historyId,
                initiativeId,
                currentStatus,
                newStatus,
                userId,
                transitionContext.reason || null,
                JSON.stringify(validationContext),
                now
            ]);
        } catch (e) {
            console.warn('[InitiativeStatusService] Failed to log status history:', e.message);
        }

        return { 
            success: true, 
            initiative: {
                id: initiativeId,
                previousStatus: currentStatus,
                status: newStatus,
                charterCompleteness: initiative.charterCompleteness,
                moduleTransition
            }
        };
    },

    /**
     * Get status history for initiative
     */
    getStatusHistory: async (initiativeId) => {
        const sql = `
            SELECT h.*, 
                u.first_name, u.last_name, u.email, u.avatar_url
            FROM initiative_status_history h
            LEFT JOIN users u ON h.changed_by = u.id
            WHERE h.initiative_id = ?
            ORDER BY h.changed_at DESC
        `;
        
        try {
            const rows = await queryHelpers.queryAll(sql, [initiativeId]);
            return rows.map(row => ({
                id: row.id,
                fromStatus: row.from_status,
                toStatus: row.to_status,
                reason: row.reason,
                context: row.context_json ? JSON.parse(row.context_json) : null,
                changedAt: row.changed_at,
                changedBy: row.changed_by ? {
                    id: row.changed_by,
                    firstName: row.first_name,
                    lastName: row.last_name,
                    email: row.email,
                    avatarUrl: row.avatar_url
                } : null
            }));
        } catch (e) {
            return [];
        }
    },

    /**
     * Get allowed transitions for current status with labels
     */
    getAllowedTransitions: (currentStatus) => {
        const allowed = StatusMachine.getAllowedInitiativeTransitions(currentStatus);
        return allowed.map(status => ({
            status,
            label: StatusMachine.getStatusLabel(status),
            module: StatusMachine.getInitiativeModule(status),
            requiresReason: ['BLOCKED', 'CANCELLED'].includes(status),
            requiresConfirmation: ['DONE', 'CANCELLED', 'ARCHIVED'].includes(status)
        }));
    },

    /**
     * Calculate completeness for initiative
     */
    calculateCompleteness: calculateCharterCompleteness,

    /**
     * Update charter completeness (can be called after any initiative update)
     */
    updateCompleteness: async (initiativeId, orgId) => {
        const sql = `SELECT * FROM initiatives WHERE id = ? AND organization_id = ?`;
        const initiative = await queryHelpers.queryOne(sql, [initiativeId, orgId]);
        
        if (!initiative) return null;

        const completeness = calculateCharterCompleteness(initiative);
        
        await queryHelpers.queryRun(
            `UPDATE initiatives SET charter_completeness = ?, updated_at = ? WHERE id = ?`,
            [completeness, new Date().toISOString(), initiativeId]
        );

        return completeness;
    }
};

export default InitiativeStatusService;






