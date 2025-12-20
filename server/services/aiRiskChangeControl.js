/**
 * AI Risk & Change Control Service
 * 
 * Monitors and detects risks proactively. Tracks scope changes.
 * AI warns before escalation, never auto-reprioritizes.
 * 
 * "Transformations don't fail from lack of tasks, but from:
 *  - Hidden risks
 *  - Scope creep  
 *  - People overload
 *  - Lack of response to signals"
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');

// Risk types that PMO must monitor
const RISK_TYPES = {
    DELIVERY: 'delivery',           // Timeline slippage, delays
    CAPACITY: 'capacity',           // Resource overload
    DEPENDENCY: 'dependency',       // Blocked by external factors
    DECISION: 'decision',           // Pending approvals
    CHANGE_FATIGUE: 'change_fatigue' // Too much change simultaneously
};

// Risk severity levels
const RISK_SEVERITY = {
    LOW: 'low',           // Minor impact, can be managed
    MEDIUM: 'medium',     // Moderate impact, needs attention
    HIGH: 'high',         // Significant impact, requires action
    CRITICAL: 'critical'  // Project-threatening, immediate action
};

// Change types for scope tracking
const CHANGE_TYPES = {
    ADD: 'add',           // New scope added
    REMOVE: 'remove',     // Scope removed
    MODIFY: 'modify',     // Existing scope changed
    EXPAND: 'expand',     // Scope grown larger
    REDUCE: 'reduce'      // Scope made smaller
};

const AIRiskChangeControl = {
    RISK_TYPES,
    RISK_SEVERITY,
    CHANGE_TYPES,

    // ==========================================
    // RISK DETECTION
    // ==========================================

    /**
     * Comprehensive risk detection for a project
     */
    detectRisks: async (projectId) => {
        const risks = [];
        const orgId = await AIRiskChangeControl._getOrgId(projectId);

        // 1. DELIVERY RISKS - Check for delays
        const deliveryRisks = await AIRiskChangeControl._detectDeliveryRisks(projectId);
        risks.push(...deliveryRisks);

        // 2. CAPACITY RISKS - Check for overload
        const capacityRisks = await AIRiskChangeControl._detectCapacityRisks(projectId);
        risks.push(...capacityRisks);

        // 3. DEPENDENCY RISKS - Check for blocked items
        const dependencyRisks = await AIRiskChangeControl._detectDependencyRisks(projectId);
        risks.push(...dependencyRisks);

        // 4. DECISION RISKS - Check for pending decisions
        const decisionRisks = await AIRiskChangeControl._detectDecisionRisks(projectId);
        risks.push(...decisionRisks);

        // 5. CHANGE FATIGUE - Check for too much change
        const fatigueRisks = await AIRiskChangeControl._detectChangeFatigueRisks(projectId);
        risks.push(...fatigueRisks);

        // Store new risks in register
        for (const risk of risks) {
            await AIRiskChangeControl._registerRisk({
                ...risk,
                projectId,
                organizationId: orgId
            });
        }

        return {
            projectId,
            risksDetected: risks.length,
            bySeverity: {
                critical: risks.filter(r => r.severity === RISK_SEVERITY.CRITICAL).length,
                high: risks.filter(r => r.severity === RISK_SEVERITY.HIGH).length,
                medium: risks.filter(r => r.severity === RISK_SEVERITY.MEDIUM).length,
                low: risks.filter(r => r.severity === RISK_SEVERITY.LOW).length
            },
            byType: Object.values(RISK_TYPES).reduce((acc, type) => {
                acc[type] = risks.filter(r => r.riskType === type).length;
                return acc;
            }, {}),
            risks,
            requiresEscalation: risks.some(r => r.severity === RISK_SEVERITY.CRITICAL)
        };
    },

    /**
     * Detect delivery/timeline risks
     */
    _detectDeliveryRisks: async (projectId) => {
        const risks = [];

        // Check overdue tasks
        const overdueTasks = await new Promise((resolve) => {
            db.all(`
                SELECT t.*, i.name as initiative_name
                FROM tasks t
                LEFT JOIN initiatives i ON t.initiative_id = i.id
                WHERE t.project_id = ?
                AND t.status NOT IN ('done', 'DONE', 'cancelled')
                AND t.due_date < date('now')
            `, [projectId], (err, rows) => resolve(rows || []));
        });

        if (overdueTasks.length > 0) {
            const avgDaysOverdue = overdueTasks.reduce((sum, t) => {
                return sum + Math.floor((Date.now() - new Date(t.due_date).getTime()) / (1000 * 60 * 60 * 24));
            }, 0) / overdueTasks.length;

            risks.push({
                riskType: RISK_TYPES.DELIVERY,
                severity: overdueTasks.length > 5 ? RISK_SEVERITY.HIGH : RISK_SEVERITY.MEDIUM,
                title: `${overdueTasks.length} overdue tasks detected`,
                description: `Average ${Math.round(avgDaysOverdue)} days overdue`,
                triggerConditions: `${overdueTasks.length} tasks past due date`,
                affectedEntities: overdueTasks.map(t => ({ type: 'task', id: t.id, name: t.title }))
            });
        }

        // Check stalled initiatives
        const stalledInitiatives = await new Promise((resolve) => {
            db.all(`
                SELECT * FROM initiatives
                WHERE project_id = ?
                AND status IN ('IN_EXECUTION', 'APPROVED')
                AND updated_at < datetime('now', '-14 days')
            `, [projectId], (err, rows) => resolve(rows || []));
        });

        if (stalledInitiatives.length > 0) {
            risks.push({
                riskType: RISK_TYPES.DELIVERY,
                severity: RISK_SEVERITY.MEDIUM,
                title: `${stalledInitiatives.length} stalled initiatives`,
                description: 'Initiatives with no updates for 14+ days',
                triggerConditions: 'No status updates in 14 days',
                affectedEntities: stalledInitiatives.map(i => ({ type: 'initiative', id: i.id, name: i.name }))
            });
        }

        return risks;
    },

    /**
     * Detect capacity/overload risks
     */
    _detectCapacityRisks: async (projectId) => {
        const risks = [];

        // Check for users with too many tasks
        const overloadedUsers = await new Promise((resolve) => {
            db.all(`
                SELECT u.id, u.first_name, u.last_name, COUNT(t.id) as task_count
                FROM tasks t
                JOIN users u ON t.assignee_id = u.id
                WHERE t.project_id = ?
                AND t.status NOT IN ('done', 'DONE', 'cancelled')
                GROUP BY u.id
                HAVING task_count > 10
            `, [projectId], (err, rows) => resolve(rows || []));
        });

        if (overloadedUsers.length > 0) {
            risks.push({
                riskType: RISK_TYPES.CAPACITY,
                severity: overloadedUsers.some(u => u.task_count > 20) ? RISK_SEVERITY.HIGH : RISK_SEVERITY.MEDIUM,
                title: `${overloadedUsers.length} team members potentially overloaded`,
                description: `Users with 10+ active tasks assigned`,
                triggerConditions: 'Task count exceeds healthy threshold',
                affectedEntities: overloadedUsers.map(u => ({
                    type: 'user',
                    id: u.id,
                    name: `${u.first_name} ${u.last_name} (${u.task_count} tasks)`
                }))
            });
        }

        return risks;
    },

    /**
     * Detect dependency/blocking risks
     */
    _detectDependencyRisks: async (projectId) => {
        const risks = [];

        // Check blocked tasks
        const blockedTasks = await new Promise((resolve) => {
            db.all(`
                SELECT * FROM tasks
                WHERE project_id = ?
                AND status = 'BLOCKED'
            `, [projectId], (err, rows) => resolve(rows || []));
        });

        if (blockedTasks.length > 0) {
            risks.push({
                riskType: RISK_TYPES.DEPENDENCY,
                severity: blockedTasks.length > 3 ? RISK_SEVERITY.HIGH : RISK_SEVERITY.MEDIUM,
                title: `${blockedTasks.length} tasks blocked`,
                description: 'Tasks waiting on dependencies or decisions',
                triggerConditions: 'Task status = BLOCKED',
                affectedEntities: blockedTasks.map(t => ({ type: 'task', id: t.id, name: t.title }))
            });
        }

        // Check unsatisfied initiative dependencies
        const blockedDeps = await new Promise((resolve) => {
            db.all(`
                SELECT id.*, 
                    fi.name as from_name, ti.name as to_name
                FROM initiative_dependencies id
                JOIN initiatives fi ON id.from_initiative_id = fi.id
                JOIN initiatives ti ON id.to_initiative_id = ti.id
                WHERE ti.project_id = ?
                AND id.is_satisfied = 0
                AND ti.status IN ('IN_EXECUTION', 'APPROVED')
            `, [projectId], (err, rows) => resolve(rows || []));
        });

        if (blockedDeps.length > 0) {
            risks.push({
                riskType: RISK_TYPES.DEPENDENCY,
                severity: RISK_SEVERITY.MEDIUM,
                title: `${blockedDeps.length} unsatisfied initiative dependencies`,
                description: 'Initiatives waiting on predecessor completion',
                triggerConditions: 'Dependency not satisfied',
                affectedEntities: blockedDeps.map(d => ({
                    type: 'dependency',
                    id: d.id,
                    name: `${d.to_name} waiting on ${d.from_name}`
                }))
            });
        }

        return risks;
    },

    /**
     * Detect decision-related risks
     */
    _detectDecisionRisks: async (projectId) => {
        const risks = [];

        // Check old pending decisions
        const pendingDecisions = await new Promise((resolve) => {
            db.all(`
                SELECT * FROM decisions
                WHERE project_id = ?
                AND status = 'PENDING'
                AND created_at < datetime('now', '-7 days')
            `, [projectId], (err, rows) => resolve(rows || []));
        });

        if (pendingDecisions.length > 0) {
            const avgDays = pendingDecisions.reduce((sum, d) => {
                return sum + Math.floor((Date.now() - new Date(d.created_at).getTime()) / (1000 * 60 * 60 * 24));
            }, 0) / pendingDecisions.length;

            risks.push({
                riskType: RISK_TYPES.DECISION,
                severity: avgDays > 14 ? RISK_SEVERITY.HIGH : RISK_SEVERITY.MEDIUM,
                title: `${pendingDecisions.length} decisions pending 7+ days`,
                description: `Average wait: ${Math.round(avgDays)} days. Decision debt accumulating.`,
                triggerConditions: 'Decision pending > 7 days',
                affectedEntities: pendingDecisions.map(d => ({ type: 'decision', id: d.id, name: d.title }))
            });
        }

        return risks;
    },

    /**
     * Detect change fatigue risks
     */
    _detectChangeFatigueRisks: async (projectId) => {
        const risks = [];

        // Check for too many active initiatives simultaneously
        const activeInitiatives = await new Promise((resolve) => {
            db.get(`
                SELECT COUNT(*) as count FROM initiatives
                WHERE project_id = ?
                AND status IN ('IN_EXECUTION', 'APPROVED')
            `, [projectId], (err, row) => resolve(row?.count || 0));
        });

        if (activeInitiatives > 10) {
            risks.push({
                riskType: RISK_TYPES.CHANGE_FATIGUE,
                severity: activeInitiatives > 15 ? RISK_SEVERITY.HIGH : RISK_SEVERITY.MEDIUM,
                title: `High change volume: ${activeInitiatives} active initiatives`,
                description: 'Too many simultaneous changes may overwhelm the organization',
                triggerConditions: 'Active initiatives > 10',
                affectedEntities: []
            });
        }

        // Check for frequent scope changes
        const recentChanges = await new Promise((resolve) => {
            db.get(`
                SELECT COUNT(*) as count FROM scope_change_log
                WHERE project_id = ?
                AND changed_at > datetime('now', '-7 days')
            `, [projectId], (err, row) => resolve(row?.count || 0));
        });

        if (recentChanges > 20) {
            risks.push({
                riskType: RISK_TYPES.CHANGE_FATIGUE,
                severity: RISK_SEVERITY.MEDIUM,
                title: `High scope volatility: ${recentChanges} changes in 7 days`,
                description: 'Frequent scope changes may indicate instability',
                triggerConditions: 'Scope changes > 20 per week',
                affectedEntities: []
            });
        }

        return risks;
    },

    // ==========================================
    // RISK MANAGEMENT
    // ==========================================

    /**
     * Register a new risk
     */
    _registerRisk: async (risk) => {
        // Check if similar risk already exists (not resolved)
        const existing = await new Promise((resolve) => {
            db.get(`
                SELECT id FROM risk_register
                WHERE project_id = ? AND risk_type = ? AND title = ? AND status NOT IN ('resolved', 'accepted')
            `, [risk.projectId, risk.riskType, risk.title], (err, row) => resolve(row));
        });

        if (existing) {
            return existing; // Don't duplicate
        }

        const id = uuidv4();

        return new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO risk_register 
                (id, project_id, organization_id, risk_type, severity, title, description, trigger_conditions, affected_entities)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                id, risk.projectId, risk.organizationId, risk.riskType, risk.severity,
                risk.title, risk.description, risk.triggerConditions, JSON.stringify(risk.affectedEntities)
            ], function (err) {
                if (err) reject(err);
                else resolve({ id, ...risk });
            });
        });
    },

    /**
     * Explain why a risk exists
     */
    explainRisk: async (riskId) => {
        const risk = await new Promise((resolve) => {
            db.get(`SELECT * FROM risk_register WHERE id = ?`, [riskId], (err, row) => resolve(row));
        });

        if (!risk) {
            throw new Error('Risk not found');
        }

        const affectedEntities = JSON.parse(risk.affected_entities || '[]');

        return {
            riskId,
            type: risk.risk_type,
            severity: risk.severity,
            title: risk.title,
            explanation: {
                what: risk.description,
                why: risk.trigger_conditions,
                impact: `Affects ${affectedEntities.length} items`,
                affectedItems: affectedEntities.slice(0, 5), // Top 5
                suggestedAction: AIRiskChangeControl._suggestMitigation(risk.risk_type, risk.severity)
            },
            detectedAt: risk.detected_at,
            status: risk.status
        };
    },

    /**
     * Suggest mitigation based on risk type
     */
    _suggestMitigation: (riskType, severity) => {
        const mitigations = {
            [RISK_TYPES.DELIVERY]: 'Review task priorities and consider scope adjustment',
            [RISK_TYPES.CAPACITY]: 'Consider task reassignment or timeline extension',
            [RISK_TYPES.DEPENDENCY]: 'Escalate blocked dependencies to decision owners',
            [RISK_TYPES.DECISION]: 'Review decision backlog with governance team',
            [RISK_TYPES.CHANGE_FATIGUE]: 'Consider phasing initiatives to reduce parallel change'
        };

        return mitigations[riskType] || 'Review risk details and consult with project team';
    },

    /**
     * Pre-escalation warning
     */
    preEscalationWarning: async (riskId) => {
        const risk = await new Promise((resolve) => {
            db.get(`SELECT * FROM risk_register WHERE id = ?`, [riskId], (err, row) => resolve(row));
        });

        if (!risk || risk.status === 'escalated') {
            return null;
        }

        // Check if escalation is warranted
        const daysSinceDetection = Math.floor((Date.now() - new Date(risk.detected_at).getTime()) / (1000 * 60 * 60 * 24));
        const shouldEscalate = (risk.severity === RISK_SEVERITY.CRITICAL) ||
            (risk.severity === RISK_SEVERITY.HIGH && daysSinceDetection > 3) ||
            (risk.severity === RISK_SEVERITY.MEDIUM && daysSinceDetection > 7);

        if (!shouldEscalate) {
            return {
                riskId,
                warningIssued: false,
                message: 'Risk does not yet require escalation'
            };
        }

        return {
            riskId,
            warningIssued: true,
            message: `Risk "${risk.title}" requires attention. Will escalate if not addressed within 48 hours.`,
            severity: risk.severity,
            daysSinceDetection,
            suggestedAction: 'Acknowledge risk and assign mitigation owner',
            escalationDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
        };
    },

    // ==========================================
    // SCOPE CHANGE TRACKING
    // ==========================================

    /**
     * Track a scope change
     */
    trackScopeChange: async ({ projectId, entityType, entityId, changeType, summary, field, previousValue, newValue, isControlled, reason, changedBy, approvedBy }) => {
        const id = uuidv4();
        const orgId = await AIRiskChangeControl._getOrgId(projectId);

        return new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO scope_change_log 
                (id, project_id, organization_id, entity_type, entity_id, change_type, change_summary, field_changed, previous_value, new_value, is_controlled, change_reason, changed_by, approved_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                id, projectId, orgId, entityType, entityId, changeType,
                summary, field, previousValue, newValue, isControlled ? 1 : 0,
                reason, changedBy, approvedBy
            ], function (err) {
                if (err) reject(err);
                else resolve({ id, projectId, entityType, entityId, changeType, isControlled });
            });
        });
    },

    /**
     * Detect uncontrolled scope changes
     */
    detectUncontrolledChanges: async (projectId, days = 7) => {
        return new Promise((resolve, reject) => {
            db.all(`
                SELECT * FROM scope_change_log
                WHERE project_id = ?
                AND is_controlled = 0
                AND changed_at > datetime('now', '-${days} days')
                ORDER BY changed_at DESC
            `, [projectId], (err, rows) => {
                if (err) reject(err);
                else {
                    const changes = rows || [];
                    resolve({
                        projectId,
                        uncontrolledChanges: changes.length,
                        changes,
                        scopeCreepWarning: changes.length > 5,
                        message: changes.length > 5
                            ? `⚠️ ${changes.length} uncontrolled scope changes detected in last ${days} days`
                            : 'Scope changes within normal parameters'
                    });
                }
            });
        });
    },

    /**
     * Get scope change summary
     */
    getScopeChangeSummary: async (projectId, days = 30) => {
        return new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    entity_type,
                    change_type,
                    COUNT(*) as count,
                    SUM(CASE WHEN is_controlled = 0 THEN 1 ELSE 0 END) as uncontrolled
                FROM scope_change_log
                WHERE project_id = ?
                AND changed_at > datetime('now', '-${days} days')
                GROUP BY entity_type, change_type
            `, [projectId], (err, rows) => {
                if (err) reject(err);
                else {
                    const summary = {
                        projectId,
                        periodDays: days,
                        totalChanges: 0,
                        totalUncontrolled: 0,
                        byEntityType: {},
                        byChangeType: {}
                    };

                    for (const row of (rows || [])) {
                        summary.totalChanges += row.count;
                        summary.totalUncontrolled += row.uncontrolled;

                        summary.byEntityType[row.entity_type] = (summary.byEntityType[row.entity_type] || 0) + row.count;
                        summary.byChangeType[row.change_type] = (summary.byChangeType[row.change_type] || 0) + row.count;
                    }

                    summary.controlRate = summary.totalChanges > 0
                        ? Math.round(((summary.totalChanges - summary.totalUncontrolled) / summary.totalChanges) * 100)
                        : 100;

                    resolve(summary);
                }
            });
        });
    },

    // ==========================================
    // RISK REGISTER QUERIES
    // ==========================================

    /**
     * Get open risks for a project
     */
    getOpenRisks: async (projectId) => {
        return new Promise((resolve, reject) => {
            db.all(`
                SELECT r.*, u.first_name as owner_first, u.last_name as owner_last
                FROM risk_register r
                LEFT JOIN users u ON r.owner_id = u.id
                WHERE r.project_id = ?
                AND r.status NOT IN ('resolved', 'accepted')
                ORDER BY 
                    CASE r.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
                    r.detected_at ASC
            `, [projectId], (err, rows) => {
                if (err) reject(err);
                else {
                    resolve((rows || []).map(row => ({
                        ...row,
                        affected_entities: JSON.parse(row.affected_entities || '[]'),
                        ownerName: row.owner_first ? `${row.owner_first} ${row.owner_last}` : 'Unassigned'
                    })));
                }
            });
        });
    },

    /**
     * Update risk status
     */
    updateRiskStatus: async (riskId, { status, notes, ownerId }) => {
        return new Promise((resolve, reject) => {
            let sql = `UPDATE risk_register SET status = ?`;
            const params = [status];

            if (notes) {
                sql += `, resolution_notes = ?`;
                params.push(notes);
            }
            if (ownerId) {
                sql += `, owner_id = ?`;
                params.push(ownerId);
            }
            if (status === 'resolved') {
                sql += `, resolved_at = CURRENT_TIMESTAMP`;
            }
            if (status === 'escalated') {
                sql += `, escalated_at = CURRENT_TIMESTAMP`;
            }

            sql += ` WHERE id = ?`;
            params.push(riskId);

            db.run(sql, params, function (err) {
                if (err) reject(err);
                else resolve({ riskId, status, updated: this.changes > 0 });
            });
        });
    },

    // ==========================================
    // HELPER
    // ==========================================

    _getOrgId: async (projectId) => {
        return new Promise((resolve) => {
            db.get(`SELECT organization_id FROM projects WHERE id = ?`, [projectId], (err, row) => {
                resolve(row?.organization_id || null);
            });
        });
    }
};

module.exports = AIRiskChangeControl;
