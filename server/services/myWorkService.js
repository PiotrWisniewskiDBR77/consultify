// My Work Service - Execution hub aggregation
// Step 5: Execution Control, My Work & Notifications
// REFACTORED: Uses BaseService for common functionality

const BaseService = require('./BaseService');
const queryHelpers = require('../utils/queryHelpers');

const MyWorkService = Object.assign({}, BaseService, {
    /**
     * Get aggregated My Work view for a user
     * REFACTORED: Uses BaseService caching
     */
    getMyWork: async function(userId, organizationId) {
        const cacheKey = this.cache.CacheKeys.userDashboard(userId, organizationId);
        
        return await this.cache.getCached(cacheKey, async () => {
            // Execute all queries in parallel for better performance
            const [myTasks, myAlerts, hasInitiatives, hasDecisions] = await Promise.all([
                this._getMyTasks(userId),
                this._getMyAlerts(userId),
                this._isInitiativeOwnerOrPM(userId),
                this._isDecisionOwner(userId)
            ]);

            const result = {
                userId,
                generatedAt: new Date().toISOString(),
                myTasks,
                myInitiatives: null,
                myDecisions: null,
                myAlerts
            };

            if (hasInitiatives) {
                result.myInitiatives = await this._getMyInitiatives(userId);
            }

            if (hasDecisions) {
                result.myDecisions = await this._getMyDecisions(userId);
            }

            return result;
        }, this.cache.DEFAULT_TTL.SHORT); // Cache for 1 minute
    },

    /**
     * Get user's tasks
     * REFACTORED: Uses BaseService query helpers
     */
    _getMyTasks: async function(userId, locationIds = null) {
        const today = new Date().toISOString().split('T')[0];

        let sql = `
            SELECT t.*, i.name as initiative_name, p.name as project_name
            FROM tasks t
            LEFT JOIN initiatives i ON t.initiative_id = i.id
            LEFT JOIN projects p ON t.project_id = p.id
            WHERE t.assignee_id = ? AND t.status NOT IN ('done', 'DONE')
        `;
        const params = [userId];

        // GAP-04: Filter by location if provided
        if (locationIds && locationIds.length > 0) {
            const placeholders = queryHelpers.buildInPlaceholders(locationIds);
            sql += ` AND (i.id IN (
                SELECT il.initiative_id FROM initiative_locations il WHERE il.location_id IN (${placeholders})
            ) OR t.initiative_id IS NULL)`;
            params.push(...locationIds);
        }

        sql += ` ORDER BY t.due_date ASC, t.priority DESC`;

        const tasks = await this.queryAll(sql, params);

        const overdue = tasks.filter(t => t.due_date && t.due_date < today).length;
        const dueToday = tasks.filter(t => t.due_date && t.due_date.startsWith(today)).length;
        const blocked = tasks.filter(t => t.status === 'blocked' || t.status === 'BLOCKED').length;

        return {
            total: tasks.length,
            overdue,
            dueToday,
            blocked,
            items: tasks.map(t => ({
                id: t.id,
                title: t.title,
                initiativeName: t.initiative_name || 'Unassigned',
                projectName: t.project_name || 'Unknown',
                dueDate: t.due_date,
                status: t.status,
                priority: t.priority || 'MEDIUM',
                blockedReason: t.blocked_reason
            }))
        };
    },

    /**
     * Get initiatives owned by user
     * REFACTORED: Uses BaseService query helpers
     */
    _getMyInitiatives: async function(userId) {
        const sql = `
            SELECT i.*, p.name as project_name,
                (SELECT COUNT(*) FROM decisions d WHERE d.related_object_id = i.id AND d.status = 'PENDING') as pending_decisions
            FROM initiatives i
            LEFT JOIN projects p ON i.project_id = p.id
            WHERE i.owner_business_id = ? AND i.status NOT IN ('COMPLETED', 'CANCELLED')
            ORDER BY i.updated_at DESC
        `;

        const initiatives = await this.queryAll(sql, [userId]);
        const atRisk = initiatives.filter(i =>
            i.status === 'BLOCKED' || (i.progress || 0) < 30
        ).length;

        return {
            total: initiatives.length,
            atRisk,
            items: initiatives.map(i => ({
                id: i.id,
                name: i.name,
                projectName: i.project_name || 'Unknown',
                status: i.status || 'DRAFT',
                progress: i.progress || 0,
                blockers: i.blocked_reason ? [i.blocked_reason] : [],
                pendingDecisions: i.pending_decisions || 0
            }))
        };
    },

    /**
     * Get decisions awaiting user
     * REFACTORED: Uses BaseService query helpers
     */
    _getMyDecisions: async function(userId) {
        const sql = `
            SELECT d.*, p.name as project_name
            FROM decisions d
            LEFT JOIN projects p ON d.project_id = p.id
            WHERE d.decision_owner_id = ? AND d.status = 'PENDING'
            ORDER BY d.created_at ASC
        `;

        const decisions = await this.queryAll(sql, [userId]);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const overdue = decisions.filter(d =>
            new Date(d.created_at) < sevenDaysAgo
        ).length;

        return {
            total: decisions.length,
            overdue,
            items: decisions.map(d => ({
                id: d.id,
                title: d.title,
                projectName: d.project_name || 'Unknown',
                decisionType: d.decision_type,
                createdAt: d.created_at,
                isOverdue: new Date(d.created_at) < sevenDaysAgo
            }))
        };
    },

    /**
     * Get alerts for user
     * REFACTORED: Uses BaseService query helpers
     */
    _getMyAlerts: async function(userId) {
        const sql = `SELECT * FROM notifications 
                     WHERE user_id = ? AND is_read = 0 
                     ORDER BY severity DESC, created_at DESC 
                     LIMIT 20`;
        
        const alerts = await this.queryAll(sql, [userId]);
        const critical = alerts.filter(a => a.severity === 'CRITICAL').length;

        return {
            total: alerts.length,
            critical,
            items: alerts
        };
    },

    /**
     * Check if user is initiative owner or PM
     * REFACTORED: Uses BaseService query helpers
     */
    _isInitiativeOwnerOrPM: async function(userId) {
        const sql = `
            SELECT 
                CASE 
                    WHEN EXISTS(SELECT 1 FROM initiatives WHERE owner_business_id = ? LIMIT 1) THEN 1
                    WHEN EXISTS(
                        SELECT 1 FROM users 
                        WHERE id = ? 
                        AND role IN ('PROJECT_MANAGER', 'ADMIN', 'SUPERADMIN')
                    ) THEN 1
                    ELSE 0
                END as has_access
        `;
        
        const row = await this.queryOne(sql, [userId, userId]);
        return row && row.has_access === 1;
    },

    /**
     * Check if user is decision owner
     * REFACTORED: Uses BaseService query helpers
     */
    _isDecisionOwner: async function(userId) {
        const sql = `SELECT id FROM decisions WHERE decision_owner_id = ? AND status = 'PENDING' LIMIT 1`;
        const row = await this.queryOne(sql, [userId]);
        return !!row;
    }
});

module.exports = MyWorkService;
