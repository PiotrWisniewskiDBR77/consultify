// Escalation Service - Escalation workflows
// Step 5: Execution Control, My Work & Notifications

// Dependency injection container (for deterministic unit tests)
const deps = {
    db: require('../database'),
    uuidv4: require('uuid').v4,
    NotificationService: require('./notificationService')
};

const EscalationService = {
    // For testing: allow overriding dependencies
    setDependencies: (newDeps = {}) => {
        Object.assign(deps, newDeps);
    },

    /**
     * Create an escalation
     */
    createEscalation: async (escalation) => {
        const {
            projectId, sourceType, sourceId, fromUserId,
            toUserId, toRole, reason, triggerType, daysOverdue
        } = escalation;

        const id = deps.uuidv4();

        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO escalations 
                (id, project_id, source_type, source_id, from_user_id, to_user_id, to_role, reason, trigger_type, days_overdue)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

            deps.db.run(sql, [id, projectId, sourceType, sourceId, fromUserId, toUserId, toRole, reason, triggerType, daysOverdue || 0],
                async function (err) {
                    if (err) return reject(err);

                    // Notify escalation target
                    const orgId = await EscalationService._getOrgId(projectId);
                    await deps.NotificationService.create({
                        userId: toUserId,
                        organizationId: orgId,
                        projectId,
                        type: 'AI_RISK_DETECTED',
                        severity: 'CRITICAL',
                        title: 'Escalation Received',
                        message: reason,
                        relatedObjectType: sourceType,
                        relatedObjectId: sourceId,
                        isActionable: true
                    });

                    resolve({ id, projectId, toUserId, reason });
                });
        });
    },

    /**
     * Get escalations for a project
     */
    getEscalations: async (projectId, status = null) => {
        return new Promise((resolve, reject) => {
            let sql = `SELECT e.*, 
                       u1.first_name as from_first, u1.last_name as from_last,
                       u2.first_name as to_first, u2.last_name as to_last
                       FROM escalations e
                       LEFT JOIN users u1 ON e.from_user_id = u1.id
                       LEFT JOIN users u2 ON e.to_user_id = u2.id
                       WHERE e.project_id = ?`;
            const params = [projectId];

            if (status) {
                sql += ` AND e.status = ?`;
                params.push(status);
            }

            sql += ` ORDER BY e.created_at DESC`;

            deps.db.all(sql, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });
    },

    /**
     * Acknowledge an escalation
     */
    acknowledgeEscalation: async (escalationId, userId) => {
        return new Promise((resolve, reject) => {
            deps.db.run(`UPDATE escalations SET status = 'ACKNOWLEDGED', acknowledged_at = CURRENT_TIMESTAMP 
                    WHERE id = ? AND to_user_id = ?`, [escalationId, userId], function (err) {
                if (err) return reject(err);
                resolve({ updated: this.changes > 0 });
            });
        });
    },

    /**
     * Resolve an escalation
     */
    resolveEscalation: async (escalationId) => {
        return new Promise((resolve, reject) => {
            deps.db.run(`UPDATE escalations SET status = 'RESOLVED', resolved_at = CURRENT_TIMESTAMP 
                    WHERE id = ?`, [escalationId], function (err) {
                if (err) return reject(err);
                resolve({ updated: this.changes > 0 });
            });
        });
    },

    /**
     * Auto-escalate based on rules
     */
    runAutoEscalation: async (projectId) => {
        const escalations = [];

        // Get project settings
        const project = await new Promise((resolve, reject) => {
            deps.db.get(`SELECT p.*, u.id as sponsor_id FROM projects p
                    LEFT JOIN users u ON p.sponsor_id = u.id
                    WHERE p.id = ?`, [projectId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!project) return { escalations: [], error: 'Project not found' };

        // 1. Escalate overdue decisions to sponsor
        const overdueDecisions = await new Promise((resolve, reject) => {
            deps.db.all(`SELECT * FROM decisions 
                    WHERE project_id = ? AND status = 'PENDING'
                    AND created_at < datetime('now', '-14 days')`, [projectId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        for (const decision of overdueDecisions) {
            if (project.sponsor_id && decision.decision_owner_id !== project.sponsor_id) {
                // Check if already escalated
                const existing = await new Promise((resolve) => {
                    deps.db.get(`SELECT id FROM escalations WHERE source_id = ? AND status != 'RESOLVED'`,
                        [decision.id], (err, row) => resolve(row));
                });

                if (!existing) {
                    const esc = await EscalationService.createEscalation({
                        projectId,
                        sourceType: 'DECISION',
                        sourceId: decision.id,
                        fromUserId: decision.decision_owner_id,
                        toUserId: project.sponsor_id,
                        toRole: 'SPONSOR',
                        reason: `Decision "${decision.title}" has been pending for 14+ days`,
                        triggerType: 'OVERDUE',
                        daysOverdue: 14
                    });
                    escalations.push(esc);
                }
            }
        }

        // 2. Escalate stalled initiatives
        const stalledInitiatives = await new Promise((resolve, reject) => {
            deps.db.all(`SELECT * FROM initiatives
                    WHERE project_id = ? 
                    AND status IN ('IN_EXECUTION', 'APPROVED')
                    AND updated_at < datetime('now', '-14 days')`, [projectId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        // Get PM for project
        const pm = await new Promise((resolve) => {
            deps.db.get(`SELECT id FROM users WHERE role = 'PROJECT_MANAGER' LIMIT 1`, [], (err, row) => resolve(row));
        });

        for (const init of stalledInitiatives) {
            if (pm && init.owner_business_id !== pm.id) {
                const existing = await new Promise((resolve) => {
                    deps.db.get(`SELECT id FROM escalations WHERE source_id = ? AND status != 'RESOLVED'`,
                        [init.id], (err, row) => resolve(row));
                });

                if (!existing) {
                    const esc = await EscalationService.createEscalation({
                        projectId,
                        sourceType: 'INITIATIVE',
                        sourceId: init.id,
                        fromUserId: init.owner_business_id,
                        toUserId: pm.id,
                        toRole: 'PROJECT_MANAGER',
                        reason: `Initiative "${init.name}" has been stalled for 14+ days`,
                        triggerType: 'STALLED',
                        daysOverdue: 14
                    });
                    escalations.push(esc);
                }
            }
        }

        return {
            projectId,
            escalationsCreated: escalations.length,
            escalations
        };
    },

    /**
     * Helper: Get org ID from project
     */
    _getOrgId: async (projectId) => {
        return new Promise((resolve) => {
            deps.db.get(`SELECT organization_id FROM projects WHERE id = ?`, [projectId], (err, row) => {
                resolve(row?.organization_id || 'unknown');
            });
        });
    }
};

module.exports = EscalationService;
