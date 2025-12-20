// PMO Context Routes - Consolidated PMO awareness endpoint
// Exposes phase, gate, and execution status in a single call for UI behavior

const express = require('express');
const router = express.Router();
const db = require('../database');
const verifyToken = require('../middleware/authMiddleware');
const StageGateService = require('../services/stageGateService');
const ExecutionMonitorService = require('../services/executionMonitorService');

/**
 * Phase-specific allowed actions mapping
 */
const PHASE_ACTIONS = {
    'Context': ['edit_context', 'view_assessment'],
    'Assessment': ['edit_assessment', 'view_initiatives'],
    'Initiatives': ['create_initiative', 'edit_initiative', 'assign_owner', 'set_priority'],
    'Roadmap': ['assign_wave', 'set_dates', 'baseline_schedule', 'create_task'],
    'Execution': ['create_task', 'update_task', 'complete_task', 'block_task', 'create_decision'],
    'Stabilization': ['validate_kpi', 'close_initiative', 'generate_report']
};

/**
 * Phase-specific system messages based on conditions
 */
const getPhaseMessages = async (projectId, currentPhase, monitorResult) => {
    const messages = [];

    // Phase-specific guidance messages
    switch (currentPhase) {
        case 'Context':
            messages.push({
                severity: 'info',
                code: 'PHASE_CONTEXT',
                message: 'Define strategic goals and challenges before proceeding to assessment.'
            });
            break;
        case 'Assessment':
            messages.push({
                severity: 'info',
                code: 'PHASE_ASSESSMENT',
                message: 'Complete maturity assessment across all axes to identify gaps.'
            });
            break;
        case 'Initiatives':
            messages.push({
                severity: 'info',
                code: 'PHASE_INITIATIVES',
                message: 'Initiatives are being defined. Finalize owners and priorities before roadmap.'
            });
            break;
        case 'Roadmap':
            messages.push({
                severity: 'info',
                code: 'PHASE_ROADMAP',
                message: 'Plan timeline and dependencies. Baseline schedule before execution.'
            });
            break;
        case 'Execution':
            // Execution-specific warnings from monitor
            if (monitorResult) {
                for (const issue of monitorResult.issues) {
                    switch (issue.type) {
                        case 'STALLED_TASKS':
                            messages.push({
                                severity: 'warning',
                                code: 'STALLED_TASKS',
                                message: `${issue.count} task(s) have not been updated in 7+ days.`
                            });
                            break;
                        case 'OVERDUE_TASKS':
                            messages.push({
                                severity: 'warning',
                                code: 'OVERDUE_TASKS',
                                message: `${issue.count} task(s) are overdue.`
                            });
                            break;
                        case 'DECISION_INERTIA':
                            messages.push({
                                severity: 'critical',
                                code: 'DECISION_INERTIA',
                                message: `${issue.count} decision(s) pending 7+ days - may be blocking progress.`
                            });
                            break;
                        case 'SILENT_BLOCKERS':
                            messages.push({
                                severity: 'warning',
                                code: 'SILENT_BLOCKERS',
                                message: `${issue.count} item(s) are blocked without documented reason.`
                            });
                            break;
                    }
                }
            }
            break;
        case 'Stabilization':
            messages.push({
                severity: 'info',
                code: 'PHASE_STABILIZATION',
                message: 'Validate outcomes and document lessons learned for closure.'
            });
            break;
    }

    // Check for missing owners
    const unownedTasks = await new Promise((resolve) => {
        db.get(
            `SELECT COUNT(*) as cnt FROM tasks 
             WHERE project_id = ? AND assignee_id IS NULL AND status NOT IN ('done', 'DONE', 'cancelled', 'CANCELLED')`,
            [projectId],
            (err, row) => resolve(row?.cnt || 0)
        );
    });

    if (unownedTasks > 0) {
        messages.push({
            severity: 'warning',
            code: 'UNOWNED_TASKS',
            message: `${unownedTasks} task(s) have no assigned owner.`
        });
    }

    // Check for missing deadlines in Execution
    if (currentPhase === 'Execution') {
        const noDeadline = await new Promise((resolve) => {
            db.get(
                `SELECT COUNT(*) as cnt FROM tasks 
                 WHERE project_id = ? AND due_date IS NULL AND status NOT IN ('done', 'DONE', 'cancelled', 'CANCELLED')`,
                [projectId],
                (err, row) => resolve(row?.cnt || 0)
            );
        });

        if (noDeadline > 0) {
            messages.push({
                severity: 'warning',
                code: 'MISSING_DEADLINES',
                message: `${noDeadline} task(s) have no deadline set.`
            });
        }
    }

    return messages;
};

/**
 * Get blocking issues that prevent phase progress
 */
const getBlockingIssues = async (projectId, monitorResult) => {
    const blocking = [];

    if (!monitorResult) return blocking;

    // Overdue tasks that belong to active initiatives
    for (const issue of monitorResult.issues) {
        if (issue.type === 'OVERDUE_TASKS') {
            for (const task of issue.items.slice(0, 10)) { // Limit to 10
                blocking.push({
                    type: 'TASK',
                    id: task.id,
                    title: task.title,
                    reason: 'overdue',
                    label: 'Blocking phase progress',
                    initiativeId: task.initiative_id,
                    dueDate: task.due_date
                });
            }
        }

        if (issue.type === 'DECISION_INERTIA') {
            for (const decision of issue.items.slice(0, 5)) {
                blocking.push({
                    type: 'DECISION',
                    id: decision.id,
                    title: decision.title,
                    reason: 'pending_decision',
                    label: 'Waiting for decision',
                    createdAt: decision.created_at
                });
            }
        }

        if (issue.type === 'STALLED_INITIATIVES') {
            for (const init of issue.items.slice(0, 5)) {
                blocking.push({
                    type: 'INITIATIVE',
                    id: init.id,
                    title: init.name,
                    reason: 'stalled',
                    label: 'Stalled initiative',
                    lastUpdated: init.updated_at
                });
            }
        }

        if (issue.type === 'SILENT_BLOCKERS') {
            for (const item of issue.items.slice(0, 5)) {
                blocking.push({
                    type: item.type,
                    id: item.id,
                    title: item.title,
                    reason: 'blocked_no_reason',
                    label: 'Blocked without explanation'
                });
            }
        }
    }

    return blocking;
};

/**
 * GET /api/pmo-context/:projectId
 * Returns consolidated PMO context for UI behavior
 */
router.get('/:projectId', verifyToken, async (req, res) => {
    try {
        const { projectId } = req.params;

        // 1. Get project and current phase
        const project = await new Promise((resolve, reject) => {
            db.get(`SELECT * FROM projects WHERE id = ?`, [projectId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const currentPhase = project.current_phase || 'Context';
        const phaseNumber = StageGateService.PHASE_ORDER.indexOf(currentPhase) + 1;

        // 2. Get gate evaluation
        let nextGate = null;
        let gateStatus = null;
        let missingCriteria = [];

        if (phaseNumber < StageGateService.PHASE_ORDER.length) {
            const nextPhase = StageGateService.PHASE_ORDER[phaseNumber];
            const gateType = StageGateService.getGateType(currentPhase, nextPhase);

            if (gateType) {
                const evaluation = await StageGateService.evaluateGate(projectId, gateType);
                nextGate = gateType;
                gateStatus = evaluation.status;
                missingCriteria = evaluation.missingElements || [];
            }
        }

        // 3. Run execution monitor (for Execution phase primarily, but useful data for all)
        const monitorResult = await ExecutionMonitorService.runDailyMonitor(projectId);

        // 4. Build system messages based on phase and conditions
        const systemMessages = await getPhaseMessages(projectId, currentPhase, monitorResult);

        // 5. Get blocking issues
        const blockingIssues = await getBlockingIssues(projectId, monitorResult);

        // 6. Determine allowed actions
        const allowedActions = PHASE_ACTIONS[currentPhase] || [];

        res.json({
            projectId,
            projectName: project.name,
            currentPhase,
            phaseNumber,
            totalPhases: 6,
            nextGate,
            gateStatus,
            missingCriteria,
            allowedActions,
            systemMessages,
            blockingIssues,
            issueCount: monitorResult.issueCount,
            generatedAt: new Date().toISOString()
        });

    } catch (err) {
        console.error('PMO Context error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/pmo-context/:projectId/task-labels
 * Returns PMO labels for specific tasks (for batch labeling in UI)
 */
router.get('/:projectId/task-labels', verifyToken, async (req, res) => {
    try {
        const { projectId } = req.params;

        // Get all active tasks with their blocking status
        const tasks = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    t.id,
                    t.title,
                    t.status,
                    t.due_date,
                    t.blocked_reason,
                    t.assignee_id,
                    t.initiative_id,
                    i.name as initiative_name,
                    i.status as initiative_status
                FROM tasks t
                LEFT JOIN initiatives i ON t.initiative_id = i.id
                WHERE t.project_id = ? AND t.status NOT IN ('done', 'DONE', 'cancelled', 'CANCELLED')
            `, [projectId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        const today = new Date().toISOString().split('T')[0];
        const taskLabels = {};

        for (const task of tasks) {
            const labels = [];

            // Check if overdue
            if (task.due_date && task.due_date < today) {
                labels.push({
                    code: 'OVERDUE',
                    text: task.initiative_name
                        ? `Overdue – impacts ${task.initiative_name}`
                        : 'Overdue',
                    severity: 'critical'
                });
            }

            // Check if blocked
            if (task.status === 'blocked' || task.status === 'BLOCKED') {
                labels.push({
                    code: 'BLOCKED',
                    text: task.blocked_reason ? 'Blocked' : 'Blocked without explanation',
                    severity: task.blocked_reason ? 'warning' : 'critical'
                });
            }

            // Check if blocking initiative progress (task is overdue or blocked and has initiative)
            if (task.initiative_id && (task.status === 'blocked' || task.status === 'BLOCKED' || (task.due_date && task.due_date < today))) {
                labels.push({
                    code: 'BLOCKING_PROGRESS',
                    text: 'Blocking phase progress',
                    severity: 'critical'
                });
            }

            // Check if unassigned
            if (!task.assignee_id) {
                labels.push({
                    code: 'UNASSIGNED',
                    text: 'No owner assigned',
                    severity: 'warning'
                });
            }

            if (labels.length > 0) {
                taskLabels[task.id] = labels;
            }
        }

        res.json({ taskLabels });

    } catch (err) {
        console.error('Task labels error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
