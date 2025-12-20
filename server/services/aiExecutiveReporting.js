/**
 * AI Executive Reporting Service
 * 
 * Generates board-ready reports with AI translation to executive narrative.
 * AI never hides bad news - transparency is mandatory.
 * 
 * "CEOs and boards don't read tasks - they read:
 *  - Status
 *  - Risks
 *  - Decisions
 *  - Forecasts"
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');

// Report types
const REPORT_TYPES = {
    PROJECT_STATUS: 'project_status',
    PORTFOLIO_OVERVIEW: 'portfolio_overview',
    RISK_DECISION: 'risk_decision',
    EXECUTIVE_BRIEF: 'executive_brief'
};

// Status indicators for executive view
const STATUS_INDICATORS = {
    GREEN: { color: 'green', label: 'On Track', icon: '🟢' },
    YELLOW: { color: 'yellow', label: 'At Risk', icon: '🟡' },
    RED: { color: 'red', label: 'Off Track', icon: '🔴' },
    GREY: { color: 'grey', label: 'Not Started', icon: '⚪' }
};

const AIExecutiveReporting = {
    REPORT_TYPES,
    STATUS_INDICATORS,

    // ==========================================
    // REPORT GENERATION
    // ==========================================

    /**
     * Generate a report of specified type
     */
    generateReport: async (reportType, scope, options = {}) => {
        switch (reportType) {
            case REPORT_TYPES.PROJECT_STATUS:
                return AIExecutiveReporting._generateProjectStatusReport(scope.projectId, options);
            case REPORT_TYPES.PORTFOLIO_OVERVIEW:
                return AIExecutiveReporting._generatePortfolioOverview(scope.organizationId, options);
            case REPORT_TYPES.RISK_DECISION:
                return AIExecutiveReporting._generateRiskDecisionReport(scope.projectId || scope.organizationId, options);
            case REPORT_TYPES.EXECUTIVE_BRIEF:
                return AIExecutiveReporting._generateExecutiveBrief(scope.projectId || scope.organizationId, options);
            default:
                throw new Error(`Unknown report type: ${reportType}`);
        }
    },

    /**
     * Generate Project Status Report
     */
    _generateProjectStatusReport: async (projectId, options) => {
        // Get project details
        const project = await new Promise((resolve) => {
            db.get(`
                SELECT p.*, u.first_name as owner_first, u.last_name as owner_last
                FROM projects p
                LEFT JOIN users u ON p.owner_id = u.id
                WHERE p.id = ?
            `, [projectId], (err, row) => resolve(row));
        });

        if (!project) throw new Error('Project not found');

        // Get initiatives status
        const initiatives = await new Promise((resolve) => {
            db.all(`
                SELECT status, COUNT(*) as count
                FROM initiatives WHERE project_id = ?
                GROUP BY status
            `, [projectId], (err, rows) => {
                const result = { total: 0, statusBreakdown: {} };
                (rows || []).forEach(r => {
                    result.statusBreakdown[r.status] = r.count;
                    result.total += r.count;
                });
                resolve(result);
            });
        });

        // Get task metrics
        const taskMetrics = await new Promise((resolve) => {
            db.get(`
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status IN ('done', 'DONE') THEN 1 ELSE 0 END) as completed,
                    SUM(CASE WHEN status = 'BLOCKED' THEN 1 ELSE 0 END) as blocked,
                    SUM(CASE WHEN due_date < date('now') AND status NOT IN ('done', 'DONE') THEN 1 ELSE 0 END) as overdue
                FROM tasks WHERE project_id = ?
            `, [projectId], (err, row) => resolve(row || { total: 0, completed: 0, blocked: 0, overdue: 0 }));
        });

        // Get pending decisions
        const pendingDecisions = await new Promise((resolve) => {
            db.get(`
                SELECT COUNT(*) as count
                FROM decisions WHERE project_id = ? AND status = 'PENDING'
            `, [projectId], (err, row) => resolve(row?.count || 0));
        });

        // Get open risks
        const openRisks = await new Promise((resolve) => {
            db.all(`
                SELECT severity, COUNT(*) as count
                FROM risk_register WHERE project_id = ? AND status NOT IN ('resolved', 'accepted')
                GROUP BY severity
            `, [projectId], (err, rows) => {
                const result = { total: 0, bySeverity: {} };
                (rows || []).forEach(r => {
                    result.bySeverity[r.severity] = r.count;
                    result.total += r.count;
                });
                resolve(result);
            });
        });

        // Calculate overall status
        const overallStatus = AIExecutiveReporting._calculateProjectStatus(taskMetrics, pendingDecisions, openRisks);

        // Generate executive narrative
        const narrative = AIExecutiveReporting.translateToNarrative({
            project,
            initiatives,
            taskMetrics,
            pendingDecisions,
            risksOpen: openRisks.total,
            overallStatus
        }, 'executive');

        return {
            reportType: REPORT_TYPES.PROJECT_STATUS,
            generatedAt: new Date().toISOString(),
            project: {
                id: project.id,
                name: project.name,
                owner: project.owner_first ? `${project.owner_first} ${project.owner_last}` : 'Unassigned',
                status: project.status
            },
            overallStatus,
            summary: {
                initiatives: {
                    total: initiatives.total,
                    inExecution: initiatives.statusBreakdown['IN_EXECUTION'] || 0,
                    completed: initiatives.statusBreakdown['COMPLETED'] || 0
                },
                tasks: {
                    total: taskMetrics.total,
                    completed: taskMetrics.completed,
                    completionRate: taskMetrics.total > 0 ? Math.round((taskMetrics.completed / taskMetrics.total) * 100) : 0,
                    blocked: taskMetrics.blocked,
                    overdue: taskMetrics.overdue
                },
                decisions: {
                    pending: pendingDecisions
                },
                risks: openRisks
            },
            deviations: AIExecutiveReporting.extractDeviations(projectId, taskMetrics, openRisks),
            narrative,
            // AI NEVER HIDES BAD NEWS
            warnings: AIExecutiveReporting._ensureTransparency({ taskMetrics, pendingDecisions, openRisks })
        };
    },

    /**
     * Generate Portfolio Overview
     */
    _generatePortfolioOverview: async (organizationId, options) => {
        // Get all projects in organization
        const projects = await new Promise((resolve) => {
            db.all(`
                SELECT p.*, u.first_name as owner_first, u.last_name as owner_last,
                    (SELECT COUNT(*) FROM initiatives WHERE project_id = p.id) as initiative_count,
                    (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status NOT IN ('done', 'DONE')) as active_tasks,
                    (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'BLOCKED') as blocked_tasks,
                    (SELECT COUNT(*) FROM decisions WHERE project_id = p.id AND status = 'PENDING') as pending_decisions,
                    (SELECT COUNT(*) FROM risk_register WHERE project_id = p.id AND status NOT IN ('resolved', 'accepted') AND severity IN ('high', 'critical')) as critical_risks
                FROM projects p
                LEFT JOIN users u ON p.owner_id = u.id
                WHERE p.organization_id = ?
                ORDER BY p.name
            `, [organizationId], (err, rows) => resolve(rows || []));
        });

        // Calculate status for each project
        const projectStatuses = projects.map(p => ({
            id: p.id,
            name: p.name,
            owner: p.owner_first ? `${p.owner_first} ${p.owner_last}` : 'Unassigned',
            initiatives: p.initiative_count,
            activeTasks: p.active_tasks,
            blockedTasks: p.blocked_tasks,
            pendingDecisions: p.pending_decisions,
            criticalRisks: p.critical_risks,
            status: AIExecutiveReporting._quickProjectStatus(p)
        }));

        // Portfolio summary
        const summary = {
            totalProjects: projects.length,
            onTrack: projectStatuses.filter(p => p.status.color === 'green').length,
            atRisk: projectStatuses.filter(p => p.status.color === 'yellow').length,
            offTrack: projectStatuses.filter(p => p.status.color === 'red').length,
            totalInitiatives: projects.reduce((sum, p) => sum + p.initiative_count, 0),
            totalActiveTasks: projects.reduce((sum, p) => sum + p.active_tasks, 0),
            totalBlockedTasks: projects.reduce((sum, p) => sum + p.blocked_tasks, 0),
            totalPendingDecisions: projects.reduce((sum, p) => sum + p.pending_decisions, 0),
            totalCriticalRisks: projects.reduce((sum, p) => sum + p.critical_risks, 0)
        };

        // Portfolio health
        const healthScore = summary.totalProjects > 0
            ? Math.round((summary.onTrack / summary.totalProjects) * 100)
            : 100;

        return {
            reportType: REPORT_TYPES.PORTFOLIO_OVERVIEW,
            generatedAt: new Date().toISOString(),
            organizationId,
            summary,
            healthScore,
            healthStatus: healthScore >= 70 ? '🟢 Healthy' : healthScore >= 40 ? '🟡 Needs Attention' : '🔴 Critical',
            projects: projectStatuses,
            topConcerns: AIExecutiveReporting._identifyTopConcerns(projectStatuses),
            narrative: AIExecutiveReporting.translateToNarrative({ summary, projects: projectStatuses }, 'executive')
        };
    },

    /**
     * Generate Risk & Decision Report
     */
    _generateRiskDecisionReport: async (scopeId, options) => {
        const isProject = !!scopeId.startsWith('project');
        const whereClause = isProject ? 'project_id = ?' : 'organization_id = ?';

        // Get open risks
        const risks = await new Promise((resolve) => {
            const sql = isProject
                ? `SELECT * FROM risk_register WHERE project_id = ? AND status NOT IN ('resolved', 'accepted') ORDER BY 
                    CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END`
                : `SELECT r.*, p.name as project_name FROM risk_register r 
                   JOIN projects p ON r.project_id = p.id 
                   WHERE p.organization_id = ? AND r.status NOT IN ('resolved', 'accepted')
                   ORDER BY CASE r.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END`;
            db.all(sql, [scopeId], (err, rows) => resolve(rows || []));
        });

        // Get pending decisions
        const decisions = await new Promise((resolve) => {
            const sql = isProject
                ? `SELECT d.*, u.first_name, u.last_name FROM decisions d 
                   LEFT JOIN users u ON d.decision_owner_id = u.id
                   WHERE d.project_id = ? AND d.status = 'PENDING'
                   ORDER BY d.created_at ASC`
                : `SELECT d.*, u.first_name, u.last_name, p.name as project_name FROM decisions d 
                   LEFT JOIN users u ON d.decision_owner_id = u.id
                   JOIN projects p ON d.project_id = p.id
                   WHERE p.organization_id = ? AND d.status = 'PENDING'
                   ORDER BY d.created_at ASC`;
            db.all(sql, [scopeId], (err, rows) => resolve(rows || []));
        });

        // Process risks
        const processedRisks = risks.map(r => ({
            id: r.id,
            title: r.title,
            type: r.risk_type,
            severity: r.severity,
            severityIcon: r.severity === 'critical' ? '🔴' : r.severity === 'high' ? '🟠' : '🟡',
            description: r.description,
            detectedDaysAgo: Math.floor((Date.now() - new Date(r.detected_at)) / (1000 * 60 * 60 * 24)),
            status: r.status,
            projectName: r.project_name
        }));

        // Process decisions
        const processedDecisions = decisions.map(d => ({
            id: d.id,
            title: d.title,
            type: d.decision_type,
            owner: d.first_name ? `${d.first_name} ${d.last_name}` : 'Unassigned',
            waitingDays: Math.floor((Date.now() - new Date(d.created_at)) / (1000 * 60 * 60 * 24)),
            urgency: AIExecutiveReporting._calculateDecisionUrgency(d),
            projectName: d.project_name
        }));

        return {
            reportType: REPORT_TYPES.RISK_DECISION,
            generatedAt: new Date().toISOString(),
            scope: scopeId,
            risks: {
                total: risks.length,
                critical: risks.filter(r => r.severity === 'critical').length,
                high: risks.filter(r => r.severity === 'high').length,
                items: processedRisks.slice(0, 10) // Top 10
            },
            decisions: {
                total: decisions.length,
                urgent: processedDecisions.filter(d => d.urgency === 'urgent').length,
                overdue: processedDecisions.filter(d => d.waitingDays > 14).length,
                items: processedDecisions.slice(0, 10) // Top 10
            },
            // ACTION REQUIRED section
            actionRequired: {
                criticalRisks: processedRisks.filter(r => r.severity === 'critical'),
                overdueDecisions: processedDecisions.filter(d => d.waitingDays > 14)
            },
            narrative: AIExecutiveReporting.translateToNarrative({ risks: processedRisks, decisions: processedDecisions }, 'executive')
        };
    },

    /**
     * Generate 1-page Executive Brief
     */
    _generateExecutiveBrief: async (scopeId, options) => {
        // Determine scope
        const isProject = scopeId.startsWith('project');

        // Get core metrics
        let status, riskDecision;
        if (isProject) {
            status = await AIExecutiveReporting._generateProjectStatusReport(scopeId, options);
            riskDecision = await AIExecutiveReporting._generateRiskDecisionReport(scopeId, options);
        } else {
            status = await AIExecutiveReporting._generatePortfolioOverview(scopeId, options);
            riskDecision = await AIExecutiveReporting._generateRiskDecisionReport(scopeId, options);
        }

        // Create 1-page format
        const brief = {
            reportType: REPORT_TYPES.EXECUTIVE_BRIEF,
            generatedAt: new Date().toISOString(),
            scope: scopeId,
            format: 'one_page',

            // SECTION 1: Overall Status (1 line)
            statusLine: {
                indicator: isProject ? status.overallStatus : status.healthStatus,
                summary: isProject
                    ? `${status.project.name}: ${status.summary.tasks.completionRate}% complete, ${status.summary.risks.total} risks, ${status.summary.decisions.pending} pending decisions`
                    : `Portfolio: ${status.summary.onTrack}/${status.summary.totalProjects} on track, ${status.summary.totalCriticalRisks} critical risks`
            },

            // SECTION 2: Key Metrics (4 numbers)
            keyMetrics: isProject ? [
                { label: 'Progress', value: `${status.summary.tasks.completionRate}%`, status: status.summary.tasks.completionRate >= 50 ? 'good' : 'warning' },
                { label: 'Blocked', value: status.summary.tasks.blocked, status: status.summary.tasks.blocked > 5 ? 'bad' : 'good' },
                { label: 'Decisions', value: status.summary.decisions.pending, status: status.summary.decisions.pending > 3 ? 'warning' : 'good' },
                { label: 'Risks', value: status.summary.risks.total, status: status.summary.risks.bySeverity?.critical > 0 ? 'bad' : 'good' }
            ] : [
                { label: 'On Track', value: `${status.summary.onTrack}/${status.summary.totalProjects}`, status: 'neutral' },
                { label: 'At Risk', value: status.summary.atRisk, status: status.summary.atRisk > 0 ? 'warning' : 'good' },
                { label: 'Off Track', value: status.summary.offTrack, status: status.summary.offTrack > 0 ? 'bad' : 'good' },
                { label: 'Critical Risks', value: status.summary.totalCriticalRisks, status: status.summary.totalCriticalRisks > 0 ? 'bad' : 'good' }
            ],

            // SECTION 3: Top Issues (max 3)
            topIssues: [
                ...riskDecision.actionRequired.criticalRisks.slice(0, 2).map(r => ({
                    type: 'RISK',
                    icon: '⚠️',
                    title: r.title,
                    detail: `${r.severity} severity, ${r.detectedDaysAgo} days`
                })),
                ...riskDecision.actionRequired.overdueDecisions.slice(0, 1).map(d => ({
                    type: 'DECISION',
                    icon: '❓',
                    title: d.title,
                    detail: `Waiting ${d.waitingDays} days for ${d.owner}`
                }))
            ].slice(0, 3),

            // SECTION 4: Recommendation
            recommendation: AIExecutiveReporting._generateExecRecommendation(status, riskDecision),

            // TRANSPARENCY: Bad news section
            badNews: AIExecutiveReporting._extractBadNews(status, riskDecision)
        };

        return brief;
    },

    // ==========================================
    // NARRATIVE TRANSLATION
    // ==========================================

    /**
     * Translate data to executive narrative
     */
    translateToNarrative: (data, audience = 'executive') => {
        const parts = [];

        if (data.project) {
            parts.push(`**${data.project.name}** is ${data.overallStatus?.label?.toLowerCase() || 'in progress'}.`);
        }

        if (data.summary) {
            if (data.summary.totalProjects) {
                parts.push(`The portfolio contains ${data.summary.totalProjects} projects: ${data.summary.onTrack} on track, ${data.summary.atRisk} at risk, ${data.summary.offTrack} off track.`);
            } else if (data.summary.tasks) {
                parts.push(`Overall progress is ${data.summary.tasks.completionRate}% (${data.summary.tasks.completed}/${data.summary.tasks.total} tasks).`);
            }
        }

        if (data.risksOpen > 0 || data.summary?.risks?.total > 0) {
            const riskCount = data.risksOpen || data.summary?.risks?.total || 0;
            parts.push(`There are ${riskCount} active risks requiring attention.`);
        }

        if (data.pendingDecisions > 0 || data.summary?.decisions?.pending > 0) {
            const decisionCount = data.pendingDecisions || data.summary?.decisions?.pending || 0;
            parts.push(`${decisionCount} decision(s) are pending and may be blocking progress.`);
        }

        if (data.taskMetrics?.overdue > 0 || data.summary?.tasks?.overdue > 0) {
            const overdueCount = data.taskMetrics?.overdue || data.summary?.tasks?.overdue || 0;
            parts.push(`⚠️ ${overdueCount} tasks are overdue and require immediate attention.`);
        }

        return parts.join(' ');
    },

    // ==========================================
    // DEVIATION EXTRACTION
    // ==========================================

    /**
     * Extract deviations (highlight what's different, not raw data)
     */
    extractDeviations: async (projectId, taskMetrics, openRisks) => {
        const deviations = [];

        // Overdue deviation
        if (taskMetrics.overdue > 0) {
            deviations.push({
                type: 'SCHEDULE',
                severity: taskMetrics.overdue > 5 ? 'high' : 'medium',
                description: `${taskMetrics.overdue} tasks are past due date`,
                impact: 'May delay dependent work'
            });
        }

        // Blocked deviation
        if (taskMetrics.blocked > 0) {
            const blockedRatio = taskMetrics.blocked / taskMetrics.total;
            if (blockedRatio > 0.1) {
                deviations.push({
                    type: 'EXECUTION',
                    severity: blockedRatio > 0.2 ? 'high' : 'medium',
                    description: `${Math.round(blockedRatio * 100)}% of tasks are blocked`,
                    impact: 'Execution velocity reduced'
                });
            }
        }

        // Risk deviation
        if (openRisks.bySeverity?.critical > 0) {
            deviations.push({
                type: 'RISK',
                severity: 'high',
                description: `${openRisks.bySeverity.critical} critical risk(s) identified`,
                impact: 'Project success may be threatened'
            });
        }

        return deviations;
    },

    // ==========================================
    // TRANSPARENCY (AI NEVER HIDES BAD NEWS)
    // ==========================================

    /**
     * Ensure transparency - flag any bad news
     */
    _ensureTransparency: ({ taskMetrics, pendingDecisions, openRisks }) => {
        const warnings = [];

        if (taskMetrics.overdue > 3) {
            warnings.push({
                severity: 'warning',
                message: `Attention: ${taskMetrics.overdue} overdue tasks affecting delivery`
            });
        }

        if (taskMetrics.blocked > 5) {
            warnings.push({
                severity: 'warning',
                message: `Attention: ${taskMetrics.blocked} blocked tasks need unblocking`
            });
        }

        if (pendingDecisions > 3) {
            warnings.push({
                severity: 'warning',
                message: `Attention: ${pendingDecisions} decisions awaiting action`
            });
        }

        if (openRisks.bySeverity?.critical > 0) {
            warnings.push({
                severity: 'critical',
                message: `⚠️ CRITICAL: ${openRisks.bySeverity.critical} critical risk(s) require immediate attention`
            });
        }

        return warnings;
    },

    /**
     * Extract bad news for executive brief
     */
    _extractBadNews: (status, riskDecision) => {
        const badNews = [];

        if (riskDecision.risks.critical > 0) {
            badNews.push(`${riskDecision.risks.critical} critical risks require board attention`);
        }

        if (riskDecision.decisions.overdue > 0) {
            badNews.push(`${riskDecision.decisions.overdue} decisions pending 14+ days, blocking progress`);
        }

        if (status.summary?.tasks?.overdue > 5) {
            badNews.push(`${status.summary.tasks.overdue} overdue tasks affecting timeline`);
        }

        return badNews.length > 0 ? badNews : ['No critical issues to report'];
    },

    // ==========================================
    // HELPER FUNCTIONS
    // ==========================================

    _calculateProjectStatus: (taskMetrics, pendingDecisions, openRisks) => {
        const criticalRisks = openRisks.bySeverity?.critical || 0;
        const highRisks = openRisks.bySeverity?.high || 0;

        if (criticalRisks > 0 || taskMetrics.overdue > 10) {
            return STATUS_INDICATORS.RED;
        }
        if (highRisks > 2 || pendingDecisions > 5 || taskMetrics.blocked > 5) {
            return STATUS_INDICATORS.YELLOW;
        }
        if (taskMetrics.total === 0) {
            return STATUS_INDICATORS.GREY;
        }
        return STATUS_INDICATORS.GREEN;
    },

    _quickProjectStatus: (project) => {
        if (project.critical_risks > 0) return STATUS_INDICATORS.RED;
        if (project.blocked_tasks > 5 || project.pending_decisions > 3) return STATUS_INDICATORS.YELLOW;
        if (project.active_tasks === 0 && project.initiative_count === 0) return STATUS_INDICATORS.GREY;
        return STATUS_INDICATORS.GREEN;
    },

    _identifyTopConcerns: (projectStatuses) => {
        const concerns = [];

        const offTrack = projectStatuses.filter(p => p.status.color === 'red');
        if (offTrack.length > 0) {
            concerns.push({
                type: 'OFF_TRACK_PROJECTS',
                count: offTrack.length,
                projects: offTrack.map(p => p.name).slice(0, 3)
            });
        }

        const highBlocked = projectStatuses.filter(p => p.blockedTasks > 5);
        if (highBlocked.length > 0) {
            concerns.push({
                type: 'BLOCKED_WORK',
                count: highBlocked.reduce((sum, p) => sum + p.blockedTasks, 0),
                projects: highBlocked.map(p => p.name).slice(0, 3)
            });
        }

        return concerns;
    },

    _calculateDecisionUrgency: (decision) => {
        const days = Math.floor((Date.now() - new Date(decision.created_at)) / (1000 * 60 * 60 * 24));
        if (days > 14) return 'overdue';
        if (days > 7) return 'urgent';
        return 'normal';
    },

    _generateExecRecommendation: (status, riskDecision) => {
        if (riskDecision.actionRequired.criticalRisks.length > 0) {
            return 'Immediate attention required on critical risks. Recommend risk review meeting within 48 hours.';
        }
        if (riskDecision.actionRequired.overdueDecisions.length > 0) {
            return 'Decision backlog needs clearing. Recommend decision-making session to unblock progress.';
        }
        if (status.summary?.atRisk > 0 || status.summary?.tasks?.blocked > 5) {
            return 'Some projects need attention. Continue monitoring and address blockers proactively.';
        }
        return 'Operations normal. Maintain current trajectory and focus on execution.';
    },

    /**
     * Format report for executive audience
     */
    formatForExecutive: (report) => {
        // Simplify language, remove jargon
        return {
            ...report,
            executiveFormat: true,
            lastUpdated: new Date().toISOString()
        };
    }
};

module.exports = AIExecutiveReporting;
