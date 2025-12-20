// Reporting Service - Executive-grade reports
// Step 6: Stabilization, Reporting & Economics

const db = require('../database');
const StabilizationService = require('./stabilizationService');
const EconomicsService = require('./economicsService');

const ReportingService = {
    /**
     * Generate Executive Overview
     */
    generateExecutiveOverview: async (organizationId, userId) => {
        // Portfolio health
        const portfolioHealth = await new Promise((resolve, reject) => {
            db.get(`SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN is_closed = 0 THEN 1 ELSE 0 END) as active,
                    SUM(CASE WHEN status = 'ACTIVE' AND progress >= 50 THEN 1 ELSE 0 END) as onTrack,
                    SUM(CASE WHEN status = 'ACTIVE' AND progress < 30 THEN 1 ELSE 0 END) as atRisk,
                    SUM(CASE WHEN status = 'ON_HOLD' THEN 1 ELSE 0 END) as blocked
                    FROM projects WHERE organization_id = ?`,
                [organizationId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row || { total: 0, active: 0, onTrack: 0, atRisk: 0, blocked: 0 });
                });
        });

        // Phase distribution
        const phaseDistribution = await new Promise((resolve, reject) => {
            db.all(`SELECT current_phase as phase, COUNT(*) as count 
                    FROM projects WHERE organization_id = ? AND is_closed = 0 
                    GROUP BY current_phase`,
                [organizationId], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                });
        });

        // Pending decisions
        const decisionStats = await new Promise((resolve, reject) => {
            db.get(`SELECT 
                    COUNT(*) as pending,
                    SUM(CASE WHEN created_at < datetime('now', '-7 days') THEN 1 ELSE 0 END) as overdue
                    FROM decisions d
                    JOIN projects p ON d.project_id = p.id
                    WHERE p.organization_id = ? AND d.status = 'PENDING'`,
                [organizationId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row || { pending: 0, overdue: 0 });
                });
        });

        // Initiative variance
        const varianceStats = await new Promise((resolve, reject) => {
            db.get(`SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status IN ('COMPLETED', 'IN_EXECUTION') THEN 1 ELSE 0 END) as onTrack,
                    SUM(CASE WHEN status = 'BLOCKED' THEN 1 ELSE 0 END) as delayed
                    FROM initiatives i
                    JOIN projects p ON i.project_id = p.id
                    WHERE p.organization_id = ? AND p.is_closed = 0`,
                [organizationId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row || { total: 0, onTrack: 0, delayed: 0 });
                });
        });

        // Top risks
        const topRisks = [];
        if (decisionStats.overdue > 0) {
            topRisks.push(`${decisionStats.overdue} decisions overdue`);
        }
        if (portfolioHealth.atRisk > 0) {
            topRisks.push(`${portfolioHealth.atRisk} project(s) at risk`);
        }
        if (varianceStats.delayed > 0) {
            topRisks.push(`${varianceStats.delayed} initiative(s) blocked`);
        }

        // AI Narrative
        const aiNarrative = ReportingService._generateNarrative(portfolioHealth, decisionStats, topRisks);

        return {
            reportType: 'EXECUTIVE_OVERVIEW',
            generatedAt: new Date().toISOString(),
            generatedBy: userId,
            portfolioHealth: {
                totalProjects: portfolioHealth.total,
                activeProjects: portfolioHealth.active,
                onTrack: portfolioHealth.onTrack,
                atRisk: portfolioHealth.atRisk,
                blocked: portfolioHealth.blocked
            },
            phaseDistribution,
            topRisks,
            pendingDecisions: decisionStats.pending,
            overdueDecisions: decisionStats.overdue,
            initiativesOnTrack: varianceStats.onTrack,
            initiativesDelayed: varianceStats.delayed,
            aiNarrative,
            changesSinceLastReview: []
        };
    },

    /**
     * Generate Project Health Report
     */
    generateProjectHealthReport: async (projectId, userId) => {
        // Initiative distribution
        const initiativeDistribution = await new Promise((resolve, reject) => {
            db.all(`SELECT status, COUNT(*) as count FROM initiatives 
                    WHERE project_id = ? GROUP BY status`,
                [projectId], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                });
        });

        // Decision latency
        const decisionLatency = await new Promise((resolve, reject) => {
            db.get(`SELECT 
                    AVG(julianday(decided_at) - julianday(created_at)) as avg_days
                    FROM decisions WHERE project_id = ? AND decided_at IS NOT NULL`,
                [projectId], (err, row) => {
                    if (err) reject(err);
                    else resolve(Math.round(row?.avg_days || 0));
                });
        });

        // Blocked items
        const blockedItems = await new Promise((resolve, reject) => {
            db.all(`SELECT id, name, blocked_reason FROM initiatives 
                    WHERE project_id = ? AND status = 'BLOCKED'`,
                [projectId], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                });
        });

        // Capacity stress (users with >100% utilization)
        const capacityStress = await new Promise((resolve, reject) => {
            db.get(`SELECT COUNT(DISTINCT assignee_id) as overloaded FROM tasks 
                    WHERE project_id = ? AND status NOT IN ('done', 'DONE')
                    GROUP BY assignee_id HAVING COUNT(*) > 10`,
                [projectId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row?.overloaded || 0);
                });
        });

        // Stabilization summary
        const stabilizationSummary = await StabilizationService.getStabilizationSummary(projectId);

        return {
            reportType: 'PROJECT_HEALTH',
            projectId,
            generatedAt: new Date().toISOString(),
            generatedBy: userId,
            initiativeDistribution,
            decisionLatencyDays: decisionLatency,
            blockedItems,
            capacityStressedUsers: capacityStress,
            stabilizationSummary
        };
    },

    /**
     * Generate Governance Report
     */
    generateGovernanceReport: async (projectId, userId) => {
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
    _generateNarrative: (portfolioHealth, decisionStats, risks) => {
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
    }
};

module.exports = ReportingService;
