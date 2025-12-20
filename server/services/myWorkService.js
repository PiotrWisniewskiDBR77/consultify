// My Work Service - Execution hub aggregation
// Step 5: Execution Control, My Work & Notifications

const db = require('../database');

const MyWorkService = {
    /**
     * Get aggregated My Work view for a user
     */
    getMyWork: async (userId, organizationId) => {
        const result = {
            userId,
            generatedAt: new Date().toISOString(),
            myTasks: await MyWorkService._getMyTasks(userId),
            myInitiatives: null,
            myDecisions: null,
            myAlerts: await MyWorkService._getMyAlerts(userId)
        };

        // Check if user is an initiative owner or PM
        const hasInitiatives = await MyWorkService._isInitiativeOwnerOrPM(userId);
        if (hasInitiatives) {
            result.myInitiatives = await MyWorkService._getMyInitiatives(userId);
        }

        // Check if user is a decision owner
        const hasDecisions = await MyWorkService._isDecisionOwner(userId);
        if (hasDecisions) {
            result.myDecisions = await MyWorkService._getMyDecisions(userId);
        }

        return result;
    },

    /**
     * Get user's tasks
     */
    _getMyTasks: async (userId) => {
        return new Promise((resolve, reject) => {
            const today = new Date().toISOString().split('T')[0];

            const sql = `
                SELECT t.*, i.name as initiative_name, p.name as project_name
                FROM tasks t
                LEFT JOIN initiatives i ON t.initiative_id = i.id
                LEFT JOIN projects p ON t.project_id = p.id
                WHERE t.assignee_id = ? AND t.status NOT IN ('done', 'DONE')
                ORDER BY t.due_date ASC, t.priority DESC
            `;

            db.all(sql, [userId], (err, rows) => {
                if (err) return reject(err);

                const tasks = rows || [];
                const overdue = tasks.filter(t => t.due_date && t.due_date < today).length;
                const dueToday = tasks.filter(t => t.due_date && t.due_date.startsWith(today)).length;
                const blocked = tasks.filter(t => t.status === 'blocked' || t.status === 'BLOCKED').length;

                resolve({
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
                });
            });
        });
    },

    /**
     * Get initiatives owned by user
     */
    _getMyInitiatives: async (userId) => {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT i.*, p.name as project_name,
                    (SELECT COUNT(*) FROM decisions d WHERE d.related_object_id = i.id AND d.status = 'PENDING') as pending_decisions
                FROM initiatives i
                LEFT JOIN projects p ON i.project_id = p.id
                WHERE i.owner_business_id = ? AND i.status NOT IN ('COMPLETED', 'CANCELLED')
                ORDER BY i.updated_at DESC
            `;

            db.all(sql, [userId], (err, rows) => {
                if (err) return reject(err);

                const initiatives = rows || [];
                const atRisk = initiatives.filter(i =>
                    i.status === 'BLOCKED' || (i.progress || 0) < 30
                ).length;

                resolve({
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
                });
            });
        });
    },

    /**
     * Get decisions awaiting user
     */
    _getMyDecisions: async (userId) => {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT d.*, p.name as project_name
                FROM decisions d
                LEFT JOIN projects p ON d.project_id = p.id
                WHERE d.decision_owner_id = ? AND d.status = 'PENDING'
                ORDER BY d.created_at ASC
            `;

            db.all(sql, [userId], (err, rows) => {
                if (err) return reject(err);

                const decisions = rows || [];
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

                const overdue = decisions.filter(d =>
                    new Date(d.created_at) < sevenDaysAgo
                ).length;

                resolve({
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
                });
            });
        });
    },

    /**
     * Get alerts for user
     */
    _getMyAlerts: async (userId) => {
        return new Promise((resolve, reject) => {
            db.all(`SELECT * FROM notifications 
                    WHERE user_id = ? AND is_read = 0 
                    ORDER BY severity DESC, created_at DESC 
                    LIMIT 20`, [userId], (err, rows) => {
                if (err) return reject(err);

                const alerts = rows || [];
                const critical = alerts.filter(a => a.severity === 'CRITICAL').length;

                resolve({
                    total: alerts.length,
                    critical,
                    items: alerts
                });
            });
        });
    },

    /**
     * Check if user is initiative owner or PM
     */
    _isInitiativeOwnerOrPM: async (userId) => {
        return new Promise((resolve) => {
            db.get(`SELECT id FROM initiatives WHERE owner_business_id = ? LIMIT 1`, [userId], (err, row) => {
                if (row) return resolve(true);

                db.get(`SELECT role FROM users WHERE id = ?`, [userId], (err2, user) => {
                    resolve(user && (user.role === 'PROJECT_MANAGER' || user.role === 'ADMIN' || user.role === 'SUPERADMIN'));
                });
            });
        });
    },

    /**
     * Check if user is decision owner
     */
    _isDecisionOwner: async (userId) => {
        return new Promise((resolve) => {
            db.get(`SELECT id FROM decisions WHERE decision_owner_id = ? AND status = 'PENDING' LIMIT 1`,
                [userId], (err, row) => {
                    resolve(!!row);
                });
        });
    }
};

module.exports = MyWorkService;
