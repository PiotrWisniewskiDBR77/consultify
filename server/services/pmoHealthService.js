/**
 * PMO Health Service - Single Source of Truth
 * Step A: Canonical PMOHealthSnapshot for UI and AI context
 * 
 * This service provides a canonical snapshot of PMO health for a project,
 * used by both UI and AI context builder to ensure consistency.
 */

const db = require('../database');
const StageGateService = require('./stageGateService');

const PMOHealthService = {
    /**
     * Get PMOHealthSnapshot for a project
     * Returns a canonical snapshot of project health status
     * 
     * @param {string} projectId - The project ID
     * @returns {Promise<PMOHealthSnapshot>}
     */
    getHealthSnapshot: async (projectId) => {
        const startTime = Date.now();

        // 1. Get project and current phase
        const project = await new Promise((resolve, reject) => {
            db.get(`SELECT * FROM projects WHERE id = ?`, [projectId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!project) {
            throw new Error('Project not found');
        }

        const currentPhase = project.current_phase || 'Context';
        const phaseNumber = StageGateService.PHASE_ORDER.indexOf(currentPhase) + 1;

        // 2. Evaluate stage gate
        let stageGate = {
            gateType: null,
            isReady: false,
            missingCriteria: [],
            metCriteria: []
        };

        if (phaseNumber < StageGateService.PHASE_ORDER.length) {
            const nextPhase = StageGateService.PHASE_ORDER[phaseNumber];
            const gateType = StageGateService.getGateType(currentPhase, nextPhase);

            if (gateType) {
                const evaluation = await StageGateService.evaluateGate(projectId, gateType);
                stageGate = {
                    gateType,
                    isReady: evaluation.status === 'READY',
                    missingCriteria: (evaluation.completionCriteria || [])
                        .filter(c => !c.isMet)
                        .map(c => ({ criterion: c.criterion, evidence: c.evidence })),
                    metCriteria: (evaluation.completionCriteria || [])
                        .filter(c => c.isMet)
                        .map(c => ({ criterion: c.criterion, evidence: c.evidence }))
                };
            }
        }

        // 3. Get task counts with efficient SQL
        const taskCounts = await PMOHealthService._getTaskCounts(projectId);

        // 4. Get decision counts
        const decisionCounts = await PMOHealthService._getDecisionCounts(projectId);

        // 5. Get initiative counts
        const initiativeCounts = await PMOHealthService._getInitiativeCounts(projectId);

        // 6. Get blockers
        const blockers = await PMOHealthService._getBlockers(projectId);

        const duration = Date.now() - startTime;
        console.log(`[PMOHealthService] Snapshot generated in ${duration}ms for project ${projectId}`);

        return {
            projectId,
            projectName: project.name,
            phase: {
                number: phaseNumber,
                name: currentPhase
            },
            stageGate,
            blockers,
            tasks: taskCounts,
            decisions: decisionCounts,
            initiatives: initiativeCounts,
            updatedAt: new Date().toISOString()
        };
    },

    /**
     * Get task counts efficiently
     */
    _getTaskCounts: async (projectId) => {
        const today = new Date().toISOString().split('T')[0];
        const dueSoonDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        return new Promise((resolve) => {
            db.get(`
                SELECT 
                    SUM(CASE WHEN due_date < ? AND status NOT IN ('done', 'DONE', 'cancelled', 'CANCELLED') THEN 1 ELSE 0 END) as overdueCount,
                    SUM(CASE WHEN due_date >= ? AND due_date <= ? AND status NOT IN ('done', 'DONE', 'cancelled', 'CANCELLED') THEN 1 ELSE 0 END) as dueSoonCount,
                    SUM(CASE WHEN status IN ('blocked', 'BLOCKED') THEN 1 ELSE 0 END) as blockedCount
                FROM tasks 
                WHERE project_id = ?
            `, [today, today, dueSoonDate, projectId], (err, row) => {
                if (err) {
                    console.error('[PMOHealthService] Task count error:', err);
                    resolve({ overdueCount: 0, dueSoonCount: 0, blockedCount: 0 });
                } else {
                    resolve({
                        overdueCount: row?.overdueCount || 0,
                        dueSoonCount: row?.dueSoonCount || 0,
                        blockedCount: row?.blockedCount || 0
                    });
                }
            });
        });
    },

    /**
     * Get decision counts efficiently
     */
    _getDecisionCounts: async (projectId) => {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        return new Promise((resolve) => {
            db.get(`
                SELECT 
                    SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pendingCount,
                    SUM(CASE WHEN status = 'PENDING' AND created_at < ? THEN 1 ELSE 0 END) as overdueCount
                FROM decisions 
                WHERE project_id = ?
            `, [sevenDaysAgo, projectId], (err, row) => {
                if (err) {
                    console.error('[PMOHealthService] Decision count error:', err);
                    resolve({ pendingCount: 0, overdueCount: 0 });
                } else {
                    resolve({
                        pendingCount: row?.pendingCount || 0,
                        overdueCount: row?.overdueCount || 0
                    });
                }
            });
        });
    },

    /**
     * Get initiative counts efficiently
     */
    _getInitiativeCounts: async (projectId) => {
        return new Promise((resolve) => {
            db.get(`
                SELECT 
                    SUM(CASE WHEN risk_level = 'HIGH' OR status = 'AT_RISK' THEN 1 ELSE 0 END) as atRiskCount,
                    SUM(CASE WHEN status IN ('blocked', 'BLOCKED') THEN 1 ELSE 0 END) as blockedCount
                FROM initiatives 
                WHERE project_id = ?
            `, [projectId], (err, row) => {
                if (err) {
                    console.error('[PMOHealthService] Initiative count error:', err);
                    resolve({ atRiskCount: 0, blockedCount: 0 });
                } else {
                    resolve({
                        atRiskCount: row?.atRiskCount || 0,
                        blockedCount: row?.blockedCount || 0
                    });
                }
            });
        });
    },

    /**
     * Get blockers across all types
     */
    _getBlockers: async (projectId) => {
        const blockers = [];
        const today = new Date().toISOString().split('T')[0];
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        // Overdue tasks
        const overdueTasks = await new Promise((resolve) => {
            db.all(`
                SELECT id, title FROM tasks 
                WHERE project_id = ? AND due_date < ? AND status NOT IN ('done', 'DONE', 'cancelled', 'CANCELLED')
                LIMIT 5
            `, [projectId, today], (err, rows) => resolve(rows || []));
        });

        for (const task of overdueTasks) {
            blockers.push({
                type: 'TASK',
                message: `Overdue: ${task.title}`,
                ref: { entityType: 'task', entityId: task.id }
            });
        }

        // Pending decisions (7+ days)
        const pendingDecisions = await new Promise((resolve) => {
            db.all(`
                SELECT id, title FROM decisions 
                WHERE project_id = ? AND status = 'PENDING' AND created_at < ?
                LIMIT 5
            `, [projectId, sevenDaysAgo], (err, rows) => resolve(rows || []));
        });

        for (const decision of pendingDecisions) {
            blockers.push({
                type: 'DECISION',
                message: `Pending decision: ${decision.title}`,
                ref: { entityType: 'decision', entityId: decision.id }
            });
        }

        // Stage gate blockers (missing criteria)
        const phaseNumber = StageGateService.PHASE_ORDER.indexOf(
            await PMOHealthService._getCurrentPhase(projectId)
        ) + 1;

        if (phaseNumber < StageGateService.PHASE_ORDER.length) {
            const nextPhase = StageGateService.PHASE_ORDER[phaseNumber];
            const currentPhase = StageGateService.PHASE_ORDER[phaseNumber - 1];
            const gateType = StageGateService.getGateType(currentPhase, nextPhase);

            if (gateType) {
                const evaluation = await StageGateService.evaluateGate(projectId, gateType);
                const missing = (evaluation.completionCriteria || []).filter(c => !c.isMet);

                if (missing.length > 0) {
                    blockers.push({
                        type: 'GATE',
                        message: `Gate ${gateType}: ${missing.length} criteria not met`,
                        ref: { entityType: 'gate', entityId: gateType }
                    });
                }
            }
        }

        return blockers;
    },

    /**
     * Get current phase for a project
     */
    _getCurrentPhase: async (projectId) => {
        return new Promise((resolve) => {
            db.get(`SELECT current_phase FROM projects WHERE id = ?`, [projectId], (err, row) => {
                resolve(row?.current_phase || 'Context');
            });
        });
    }
};

module.exports = PMOHealthService;
