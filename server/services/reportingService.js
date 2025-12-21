// Reporting Service - Executive-grade reports
// Step 6: Stabilization, Reporting & Economics
// REFACTORED: Uses BaseService for common functionality

const BaseService = require('./BaseService');
const queryHelpers = require('../utils/queryHelpers');
const db = require('../database');
const StabilizationService = require('./stabilizationService');
const EconomicsService = require('./economicsService');

const ReportingService = Object.assign({}, BaseService, {
    /**
     * Generate Executive Overview
     * REFACTORED: Uses BaseService query helpers and parallel queries
     */
    generateExecutiveOverview: async function (organizationId, userId) {
        try {
            // OPTIMIZED: Execute all queries in parallel for better performance
            const [
                portfolioHealth,
                phaseDistribution,
                decisionStats,
                varianceStats
            ] = await Promise.all([
                // Portfolio health
                this.queryOne(`SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN is_closed = 0 THEN 1 ELSE 0 END) as active,
                    SUM(CASE WHEN status = 'ACTIVE' AND progress >= 50 THEN 1 ELSE 0 END) as onTrack,
                    SUM(CASE WHEN status = 'ACTIVE' AND progress < 30 THEN 1 ELSE 0 END) as atRisk,
                    SUM(CASE WHEN status = 'ON_HOLD' THEN 1 ELSE 0 END) as blocked
                    FROM projects WHERE organization_id = ?`, [organizationId]),

                // Phase distribution
                this.queryAll(`SELECT current_phase as phase, COUNT(*) as count 
                    FROM projects WHERE organization_id = ? AND is_closed = 0 
                    GROUP BY current_phase`, [organizationId]),

                // Pending decisions
                this.queryOne(`SELECT 
                    COUNT(*) as pending,
                    SUM(CASE WHEN created_at < datetime('now', '-7 days') THEN 1 ELSE 0 END) as overdue
                    FROM decisions d
                    JOIN projects p ON d.project_id = p.id
                    WHERE p.organization_id = ? AND d.status = 'PENDING'`, [organizationId]),

                // Initiative variance
                this.queryOne(`SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status IN ('COMPLETED', 'IN_EXECUTION') THEN 1 ELSE 0 END) as onTrack,
                    SUM(CASE WHEN status = 'BLOCKED' THEN 1 ELSE 0 END) as delayed
                    FROM initiatives i
                    JOIN projects p ON i.project_id = p.id
                    WHERE p.organization_id = ? AND p.is_closed = 0`, [organizationId])
            ]);

            // Default values if null
            const portfolio = portfolioHealth || { total: 0, active: 0, onTrack: 0, atRisk: 0, blocked: 0 };
            const decisions = decisionStats || { pending: 0, overdue: 0 };
            const variance = varianceStats || { total: 0, onTrack: 0, delayed: 0 };

            // Top risks
            const topRisks = [];
            if (decisions.overdue > 0) {
                topRisks.push(`${decisions.overdue} decisions overdue`);
            }
            if (portfolio.atRisk > 0) {
                topRisks.push(`${portfolio.atRisk} project(s) at risk`);
            }
            if (variance.delayed > 0) {
                topRisks.push(`${variance.delayed} initiative(s) blocked`);
            }

            // AI Narrative
            const aiNarrative = ReportingService._generateNarrative(portfolio, decisions, topRisks);

            return {
                reportType: 'EXECUTIVE_OVERVIEW',
                generatedAt: new Date().toISOString(),
                generatedBy: userId,
                portfolioHealth: {
                    totalProjects: portfolio.total,
                    activeProjects: portfolio.active,
                    onTrack: portfolio.onTrack,
                    atRisk: portfolio.atRisk,
                    blocked: portfolio.blocked
                },
                phaseDistribution: phaseDistribution || [],
                topRisks,
                pendingDecisions: decisions.pending,
                overdueDecisions: decisions.overdue,
                initiativesOnTrack: variance.onTrack,
                initiativesDelayed: variance.delayed,
                aiNarrative,
                changesSinceLastReview: []
            };
        } catch (error) {
            this.logError('Error generating executive overview', error);
            throw error;
        }
    },

    /**
     * Generate Project Health Report
     * REFACTORED: Uses BaseService query helpers and parallel queries
     */
    generateProjectHealthReport: async function (projectId, userId) {
        try {
            // OPTIMIZED: Execute all queries in parallel
            const [
                initiativeDistribution,
                decisionLatencyRow,
                blockedItems,
                capacityStressRow
            ] = await Promise.all([
                // Initiative distribution
                this.queryAll(`SELECT status, COUNT(*) as count FROM initiatives 
                    WHERE project_id = ? GROUP BY status`, [projectId]),

                // Decision latency
                this.queryOne(`SELECT 
                    AVG(julianday(decided_at) - julianday(created_at)) as avg_days
                    FROM decisions WHERE project_id = ? AND decided_at IS NOT NULL`, [projectId]),

                // Blocked items
                this.queryAll(`SELECT id, name, blocked_reason FROM initiatives 
                    WHERE project_id = ? AND status = 'BLOCKED'`, [projectId]),

                // Capacity stress (users with >100% utilization)
                this.queryOne(`SELECT COUNT(DISTINCT assignee_id) as overloaded FROM tasks 
                    WHERE project_id = ? AND status NOT IN ('done', 'DONE')
                    GROUP BY assignee_id HAVING COUNT(*) > 10`, [projectId])
            ]);

            const decisionLatency = Math.round(decisionLatencyRow?.avg_days || 0);
            const capacityStress = capacityStressRow?.overloaded || 0;

            // Stabilization summary
            const stabilizationSummary = await StabilizationService.getStabilizationSummary(projectId);

            return {
                reportType: 'PROJECT_HEALTH',
                projectId,
                generatedAt: new Date().toISOString(),
                generatedBy: userId,
                initiativeDistribution: initiativeDistribution || [],
                decisionLatencyDays: decisionLatency,
                blockedItems: blockedItems || [],
                capacityStressedUsers: capacityStress,
                stabilizationSummary
            };
        } catch (error) {
            this.logError('Error generating project health report', error);
            throw error;
        }
    },

    /**
     * Generate Governance Report
     */
    generateGovernanceReport: async function (projectId, userId) {
        // Decisions taken
        const decisions = await new Promise((resolve, reject) => {
            db.all(`SELECT id, title, decision_type, status, created_at, decided_at 
                    FROM decisions WHERE project_id = ? ORDER BY created_at DESC LIMIT 20`,
                [projectId], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                });
        });

        // Escalations
        const escalations = await new Promise((resolve, reject) => {
            db.all(`SELECT * FROM escalations WHERE project_id = ? ORDER BY created_at DESC LIMIT 10`,
                [projectId], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                });
        });

        // Baseline changes (stage gates passed)
        const gatesPassed = await new Promise((resolve, reject) => {
            db.all(`SELECT * FROM stage_gates WHERE project_id = ? AND status = 'PASSED' ORDER BY approved_at DESC`,
                [projectId], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                });
        });

        return {
            reportType: 'GOVERNANCE',
            projectId,
            generatedAt: new Date().toISOString(),
            generatedBy: userId,
            decisionsTaken: decisions.filter(d => d.status !== 'PENDING').length,
            decisionsPending: decisions.filter(d => d.status === 'PENDING').length,
            recentDecisions: decisions.slice(0, 10),
            escalations,
            gatesPassed
        };
    },

    /**
     * Generate AI narrative for executive summary
     */
    _generateNarrative: function (portfolioHealth, decisionStats, risks) {
        const lines = [];

        if (portfolioHealth.total === 0) {
            return 'No active transformation projects in portfolio.';
        }

        lines.push(`Portfolio Overview: ${portfolioHealth.active} active project(s) out of ${portfolioHealth.total} total.`);

        if (portfolioHealth.onTrack > 0) {
            lines.push(`${portfolioHealth.onTrack} project(s) are progressing well.`);
        }

        if (risks.length > 0) {
            lines.push(`Attention Required: ${risks.join('; ')}.`);
        } else {
            lines.push('No critical risks identified at this time.');
        }

        if (decisionStats.pending > 0) {
            lines.push(`${decisionStats.pending} decision(s) await resolution.`);
        }

        return lines.join(' ');
    },

    /**
     * Generate Organization Overview Report
     * For shareable reports - contains summary info without sensitive details
     */
    generateOrganizationOverviewReport: async function (organizationId) {
        // Organization details
        const org = await new Promise((resolve, reject) => {
            db.get(`SELECT id, name, billing_status, organization_type, created_at FROM organizations WHERE id = ?`,
                [organizationId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
        });

        if (!org) {
            throw new Error('Organization not found');
        }

        // Transformation context
        const transformationGoals = await new Promise((resolve, reject) => {
            db.get(`SELECT goals, digital_maturity, transformation_type FROM organization_context WHERE organization_id = ?`,
                [organizationId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
        });

        // Initiatives summary
        const initiativesSummary = await new Promise((resolve, reject) => {
            db.all(`SELECT 
                        i.id, i.title, i.status, i.priority, i.progress, i.due_date,
                        u.name as owner_name
                    FROM initiatives i
                    LEFT JOIN users u ON i.owner_id = u.id
                    WHERE i.org_id = ?
                    ORDER BY 
                        CASE i.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
                        i.created_at DESC
                    LIMIT 20`,
                [organizationId], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                });
        });

        // Calculate overall progress
        const totalProgress = initiativesSummary.length > 0
            ? Math.round(initiativesSummary.reduce((sum, i) => sum + (i.progress || 0), 0) / initiativesSummary.length)
            : 0;

        // Blockers
        const blockers = await new Promise((resolve, reject) => {
            db.all(`SELECT i.title as initiative, t.title as task, t.blocked_reason
                    FROM tasks t
                    JOIN initiatives i ON t.initiative_id = i.id
                    WHERE i.org_id = ? AND t.status = 'blocked'
                    LIMIT 10`,
                [organizationId], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                });
        });

        // Next steps (upcoming tasks)
        const nextSteps = await new Promise((resolve, reject) => {
            db.all(`SELECT t.title, t.due_date, i.title as initiative
                    FROM tasks t
                    JOIN initiatives i ON t.initiative_id = i.id
                    WHERE i.org_id = ? AND t.status IN ('todo', 'in_progress')
                    ORDER BY t.due_date ASC
                    LIMIT 10`,
                [organizationId], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                });
        });

        return {
            reportType: 'ORGANIZATION_OVERVIEW',
            generatedAt: new Date().toISOString(),
            organization: {
                name: org.name,
                type: org.organization_type || 'ORGANIZATION',
                status: org.billing_status,
                memberSince: org.created_at
            },
            transformationContext: transformationGoals || {},
            overallProgress: totalProgress,
            initiativesSummary: initiativesSummary.map(i => ({
                id: i.id,
                title: i.title,
                status: i.status,
                priority: i.priority,
                progress: i.progress || 0,
                dueDate: i.due_date,
                owner: i.owner_name
            })),
            activeBlockers: blockers,
            upcomingTasks: nextSteps
        };
    },

    /**
     * Generate Initiative Execution Report
     * Detailed view of a single initiative for sharing
     */
    generateInitiativeExecutionReport: async function (initiativeId, organizationId) {
        // Initiative details
        const initiative = await new Promise((resolve, reject) => {
            db.get(`SELECT i.*, u.name as owner_name, u.email as owner_email
                    FROM initiatives i
                    LEFT JOIN users u ON i.owner_id = u.id
                    WHERE i.id = ? AND i.org_id = ?`,
                [initiativeId, organizationId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
        });

        if (!initiative) {
            throw new Error('Initiative not found');
        }

        // Tasks
        const tasks = await new Promise((resolve, reject) => {
            db.all(`SELECT t.id, t.title, t.description, t.status, t.priority, 
                           t.due_date, t.progress, t.blocked_reason,
                           u.name as assignee_name
                    FROM tasks t
                    LEFT JOIN users u ON t.assignee_id = u.id
                    WHERE t.initiative_id = ?
                    ORDER BY 
                        CASE t.status WHEN 'blocked' THEN 1 WHEN 'in_progress' THEN 2 WHEN 'todo' THEN 3 ELSE 4 END,
                        t.due_date ASC`,
                [initiativeId], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                });
        });

        // Calculate stats
        const taskStats = {
            total: tasks.length,
            completed: tasks.filter(t => t.status === 'done').length,
            inProgress: tasks.filter(t => t.status === 'in_progress').length,
            blocked: tasks.filter(t => t.status === 'blocked').length,
            todo: tasks.filter(t => t.status === 'todo').length
        };

        const progress = taskStats.total > 0
            ? Math.round((taskStats.completed / taskStats.total) * 100)
            : 0;

        // Blockers
        const blockers = tasks
            .filter(t => t.status === 'blocked')
            .map(t => ({ task: t.title, reason: t.blocked_reason }));

        // Upcoming deadlines
        const upcomingDeadlines = tasks
            .filter(t => t.due_date && t.status !== 'done')
            .slice(0, 5)
            .map(t => ({ task: t.title, dueDate: t.due_date, assignee: t.assignee_name }));

        return {
            reportType: 'INITIATIVE_EXECUTION',
            generatedAt: new Date().toISOString(),
            initiative: {
                id: initiative.id,
                title: initiative.title,
                description: initiative.description,
                status: initiative.status,
                priority: initiative.priority,
                dueDate: initiative.due_date,
                owner: initiative.owner_name
            },
            progress,
            taskStats,
            tasks: tasks.map(t => ({
                id: t.id,
                title: t.title,
                status: t.status,
                priority: t.priority,
                dueDate: t.due_date,
                progress: t.progress || 0,
                assignee: t.assignee_name,
                blockedReason: t.blocked_reason
            })),
            blockers,
            upcomingDeadlines
        };
    }
});

module.exports = ReportingService;

