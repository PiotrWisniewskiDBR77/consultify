/**
 * Management Reports Service
 * 
 * Main service for generating management reports:
 * - Team Meeting Reports (Weekly)
 * - Steering Committee Reports (Monthly/Gate-based)
 * 
 * PMO Standards Compliance:
 * - ISO 21500:2021 - Project Performance Measurement (Clause 4.4.22)
 * - PMBOK 7 - Measurement Performance Domain
 * - PRINCE2 - Highlight Report / Progress Theme
 * 
 * AI Transparency: AI NEVER hides bad news
 */

import db from '../database.js';
import PMOHealthService from './pmoHealthService.js';
import AIExecutiveReporting from './aiExecutiveReporting.js';
import { v4 as uuidv4 } from 'uuid';

// Report type constants
const REPORT_TYPES = {
    TEAM_MEETING: 'TEAM_MEETING',
    STEERING_COMMITTEE: 'STEERING_COMMITTEE'
};

const REPORT_SCOPES = {
    PROJECT: 'PROJECT',
    PORTFOLIO: 'PORTFOLIO'
};

const ManagementReportsService = {
    REPORT_TYPES,
    REPORT_SCOPES,

    // ==========================================
    // TEAM MEETING REPORT GENERATION
    // ==========================================

    /**
     * Generate Team Meeting Report for a single project
     * @param {string} projectId - Project ID
     * @param {Object} options - Generation options
     * @returns {Promise<Object>} Generated report
     */
    generateTeamMeetingReport: async (projectId, options = {}) => {
        const {
            periodDays = 7,
            customPeriodStart,
            customPeriodEnd,
            userId,
            aiEnhancement = true
        } = options;

        const periodEnd = customPeriodEnd ? new Date(customPeriodEnd) : new Date();
        const periodStart = customPeriodStart
            ? new Date(customPeriodStart)
            : new Date(periodEnd.getTime() - periodDays * 24 * 60 * 60 * 1000);

        // Get project info
        const project = await ManagementReportsService._getProject(projectId);
        if (!project) {
            throw new Error('Project not found');
        }

        // Aggregate data
        const [
            statusSummary,
            completedWork,
            workInProgress,
            blockers,
            pendingDecisions,
            nextPeriodPlan
        ] = await Promise.all([
            ManagementReportsService._getStatusSummary(projectId, periodStart, periodEnd),
            ManagementReportsService._getCompletedWork(projectId, periodStart, periodEnd),
            ManagementReportsService._getWorkInProgress(projectId),
            ManagementReportsService._getBlockers(projectId),
            ManagementReportsService._getPendingDecisions(projectId),
            ManagementReportsService._getNextPeriodPlan(projectId, periodDays)
        ]);

        // Generate AI insights with graceful degradation
        let aiHighlights = [];
        let aiConcerns = [];
        let aiNarrative = '';
        let aiError = null;

        if (aiEnhancement) {
            try {
                const aiData = {
                    statusSummary,
                    completedCount: completedWork.length,
                    inProgressCount: workInProgress.length,
                    blockersCount: blockers.length,
                    pendingDecisionsCount: pendingDecisions.length
                };
                aiNarrative = AIExecutiveReporting.translateToNarrative(aiData, 'team');
                aiHighlights = ManagementReportsService._generateHighlights(completedWork, statusSummary);
                aiConcerns = ManagementReportsService._generateConcerns(blockers, statusSummary);
            } catch (err) {
                console.warn('[ManagementReports] AI enhancement failed, continuing without:', err.message);
                aiNarrative = 'AI narrative unavailable - report generated with raw data only.';
                aiHighlights = [];
                aiConcerns = [];
                aiError = err.message;
            }
        }

        const content = {
            statusSummary,
            completedWork,
            workInProgress,
            blockers,
            pendingDecisions,
            nextPeriodPlan,
            aiHighlights,
            aiConcerns,
            aiError
        };

        // Create report record
        const reportId = uuidv4();
        const report = {
            id: reportId,
            organizationId: project.organization_id,
            projectId,
            reportType: REPORT_TYPES.TEAM_MEETING,
            scope: REPORT_SCOPES.PROJECT,
            title: `Team Meeting Report - ${project.name}`,
            periodStart: periodStart.toISOString().split('T')[0],
            periodEnd: periodEnd.toISOString().split('T')[0],
            status: 'DRAFT',
            generatedBy: userId,
            content,
            aiNarrative,
            aiWarnings: aiConcerns,
            createdAt: new Date().toISOString()
        };

        // Save to database
        await ManagementReportsService._saveReport(report);

        return report;
    },

    /**
     * Generate Portfolio Team Meeting Report (all projects)
     * @param {string} organizationId - Organization ID
     * @param {Object} options - Generation options
     * @returns {Promise<Object>} Generated report
     */
    generatePortfolioTeamReport: async (organizationId, options = {}) => {
        const {
            periodDays = 7,
            customPeriodStart,
            customPeriodEnd,
            userId,
            aiEnhancement = true
        } = options;

        const periodEnd = customPeriodEnd ? new Date(customPeriodEnd) : new Date();
        const periodStart = customPeriodStart
            ? new Date(customPeriodStart)
            : new Date(periodEnd.getTime() - periodDays * 24 * 60 * 60 * 1000);

        // Get all active projects
        const projects = await ManagementReportsService._getActiveProjects(organizationId);

        // Aggregate across all projects
        const allCompleted = [];
        const allInProgress = [];
        const allBlockers = [];
        const allDecisions = [];
        const allPlanned = [];
        const projectBreakdown = [];

        let totalTasks = 0;
        let completedTasks = 0;
        let blockedTasks = 0;
        let overdueTasks = 0;
        let totalInitiatives = 0;
        let initiativesOnTrack = 0;

        for (const project of projects) {
            const [completed, inProgress, blockers, decisions, planned, summary] = await Promise.all([
                ManagementReportsService._getCompletedWork(project.id, periodStart, periodEnd),
                ManagementReportsService._getWorkInProgress(project.id),
                ManagementReportsService._getBlockers(project.id),
                ManagementReportsService._getPendingDecisions(project.id),
                ManagementReportsService._getNextPeriodPlan(project.id, periodDays),
                ManagementReportsService._getStatusSummary(project.id, periodStart, periodEnd)
            ]);

            // Add project context to items
            completed.forEach(item => {
                item.projectId = project.id;
                item.projectName = project.name;
                allCompleted.push(item);
            });

            inProgress.forEach(item => {
                item.projectId = project.id;
                item.projectName = project.name;
                allInProgress.push(item);
            });

            blockers.forEach(item => {
                item.projectId = project.id;
                item.projectName = project.name;
                allBlockers.push(item);
            });

            decisions.forEach(item => {
                item.projectId = project.id;
                item.projectName = project.name;
                allDecisions.push(item);
            });

            planned.forEach(item => {
                item.projectId = project.id;
                item.projectName = project.name;
                allPlanned.push(item);
            });

            // Accumulate totals
            totalTasks += summary.tasksTotal;
            completedTasks += summary.tasksCompleted;
            blockedTasks += summary.tasksBlocked;
            overdueTasks += summary.tasksOverdue;
            totalInitiatives += summary.initiativesTotal;
            initiativesOnTrack += summary.initiativesOnTrack;

            // Project breakdown
            projectBreakdown.push({
                projectId: project.id,
                projectName: project.name,
                status: ManagementReportsService._calculateRAGStatus(summary),
                tasksCompleted: summary.tasksCompleted,
                tasksTotal: summary.tasksTotal,
                blockers: blockers.length,
                highlights: completed.slice(0, 2).map(c => c.title)
            });
        }

        const statusSummary = {
            progressPercent: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
            healthStatus: ManagementReportsService._calculateOverallHealth(projectBreakdown),
            tasksTotal: totalTasks,
            tasksCompleted: completedTasks,
            tasksInProgress: allInProgress.length,
            tasksBlocked: blockedTasks,
            tasksOverdue: overdueTasks,
            initiativesTotal: totalInitiatives,
            initiativesOnTrack: initiativesOnTrack,
            initiativesAtRisk: totalInitiatives - initiativesOnTrack,
            decisionsApproved: 0,
            decisionsPending: allDecisions.length
        };

        // Generate AI insights with graceful degradation
        let aiNarrative = '';
        let aiHighlights = [];
        let aiConcerns = [];
        let aiError = null;

        if (aiEnhancement) {
            try {
                aiNarrative = AIExecutiveReporting.translateToNarrative({
                    summary: { totalProjects: projects.length, ...statusSummary },
                    projects: projectBreakdown
                }, 'team');
                aiHighlights = ManagementReportsService._generateHighlights(allCompleted, statusSummary);
                aiConcerns = ManagementReportsService._generateConcerns(allBlockers, statusSummary);
            } catch (err) {
                console.warn('[ManagementReports] AI enhancement failed for portfolio team report:', err.message);
                aiNarrative = 'AI narrative unavailable - report generated with raw data only.';
                aiHighlights = [];
                aiConcerns = [];
                aiError = err.message;
            }
        }

        const content = {
            statusSummary,
            completedWork: allCompleted.slice(0, 20), // Top 20
            workInProgress: allInProgress.slice(0, 20),
            blockers: allBlockers,
            pendingDecisions: allDecisions,
            nextPeriodPlan: allPlanned.slice(0, 20),
            projectBreakdown,
            aiHighlights,
            aiConcerns,
            aiError
        };

        const reportId = uuidv4();
        const report = {
            id: reportId,
            organizationId,
            projectId: null,
            reportType: REPORT_TYPES.TEAM_MEETING,
            scope: REPORT_SCOPES.PORTFOLIO,
            title: `Portfolio Team Meeting Report`,
            periodStart: periodStart.toISOString().split('T')[0],
            periodEnd: periodEnd.toISOString().split('T')[0],
            status: 'DRAFT',
            generatedBy: userId,
            content,
            aiNarrative,
            aiWarnings: aiConcerns,
            createdAt: new Date().toISOString()
        };

        await ManagementReportsService._saveReport(report);
        return report;
    },

    // ==========================================
    // STEERING COMMITTEE REPORT GENERATION
    // ==========================================

    /**
     * Generate Steering Committee Report for a single project
     * @param {string} projectId - Project ID
     * @param {Object} options - Generation options
     * @returns {Promise<Object>} Generated report
     */
    generateSteeringCommitteeReport: async (projectId, options = {}) => {
        const {
            periodDays = 30,
            customPeriodStart,
            customPeriodEnd,
            userId,
            aiEnhancement = true
        } = options;

        const periodEnd = customPeriodEnd ? new Date(customPeriodEnd) : new Date();
        const periodStart = customPeriodStart
            ? new Date(customPeriodStart)
            : new Date(periodEnd.getTime() - periodDays * 24 * 60 * 60 * 1000);

        const project = await ManagementReportsService._getProject(projectId);
        if (!project) {
            throw new Error('Project not found');
        }

        // Get PMO Health snapshot
        let healthSnapshot = null;
        try {
            healthSnapshot = await PMOHealthService.getPMOHealthSnapshot(projectId);
        } catch (e) {
            console.warn('[ManagementReports] PMOHealthService unavailable:', e.message);
        }

        // Aggregate steering committee data
        const [
            overallStatus,
            kpis,
            risksAndIssues,
            decisionsRequired,
            forecast
        ] = await Promise.all([
            ManagementReportsService._getOverallRAGStatus(projectId, healthSnapshot),
            ManagementReportsService._getKPIs(projectId),
            ManagementReportsService._getRisksAndIssues(projectId),
            ManagementReportsService._getDecisionsForBoard(projectId),
            ManagementReportsService._getForecast(projectId)
        ]);

        // Generate executive summary (AI) with graceful degradation
        let executiveSummary = '';
        let warnings = [];
        let aiError = null;

        if (aiEnhancement) {
            try {
                const reportData = await AIExecutiveReporting.generateReport(
                    AIExecutiveReporting.REPORT_TYPES.PROJECT_STATUS,
                    { projectId },
                    {}
                );
                executiveSummary = reportData.narrative || '';
                warnings = reportData.warnings?.map(w => w.message) || [];
            } catch (err) {
                console.warn('[ManagementReports] AI executive summary failed:', err.message);
                executiveSummary = 'AI-generated executive summary unavailable. Report contains raw data metrics.';
                aiError = err.message;
            }
        }

        // Ensure transparency - AI NEVER hides bad news
        if (risksAndIssues.filter(r => r.severity === 'CRITICAL').length > 0) {
            warnings.push(`${risksAndIssues.filter(r => r.severity === 'CRITICAL').length} critical risk(s) require immediate attention`);
        }
        if (decisionsRequired.filter(d => d.daysUntilDeadline < 0).length > 0) {
            warnings.push(`${decisionsRequired.filter(d => d.daysUntilDeadline < 0).length} decision(s) are overdue`);
        }

        // Build audit trail
        const auditTrail = {
            reportId: uuidv4(),
            generatedAt: new Date().toISOString(),
            generatedBy: userId,
            generatedByName: '',
            version: '1.0',
            pmoDomain: 'PERFORMANCE_MONITORING',
            iso21500Mapping: 'Project Performance Measurement (Clause 4.4.22)',
            pmbokMapping: 'Measurement Performance Domain',
            prince2Mapping: 'Highlight Report / Progress Theme',
            dataSnapshot: {
                projectsIncluded: 1,
                tasksAnalyzed: healthSnapshot?.tasks?.total || 0,
                initiativesAnalyzed: healthSnapshot?.initiatives?.total || 0,
                decisionsAnalyzed: decisionsRequired.length,
                risksAnalyzed: risksAndIssues.length,
                dataAsOf: new Date().toISOString()
            }
        };

        const content = {
            executiveSummary,
            overallStatus,
            kpis,
            risksAndIssues,
            decisionsRequired,
            forecast,
            warnings,
            auditTrail,
            aiError
        };

        const reportId = uuidv4();
        const report = {
            id: reportId,
            organizationId: project.organization_id,
            projectId,
            reportType: REPORT_TYPES.STEERING_COMMITTEE,
            scope: REPORT_SCOPES.PROJECT,
            title: `Steering Committee Report - ${project.name}`,
            periodStart: periodStart.toISOString().split('T')[0],
            periodEnd: periodEnd.toISOString().split('T')[0],
            status: 'DRAFT',
            generatedBy: userId,
            content,
            aiNarrative: executiveSummary,
            aiWarnings: warnings,
            createdAt: new Date().toISOString()
        };

        await ManagementReportsService._saveReport(report);
        return report;
    },

    /**
     * Generate Portfolio Steering Committee Report
     * @param {string} organizationId - Organization ID
     * @param {Object} options - Generation options
     * @returns {Promise<Object>} Generated report
     */
    generatePortfolioSteeringReport: async (organizationId, options = {}) => {
        const {
            periodDays = 30,
            customPeriodStart,
            customPeriodEnd,
            userId,
            aiEnhancement = true
        } = options;

        const periodEnd = customPeriodEnd ? new Date(customPeriodEnd) : new Date();
        const periodStart = customPeriodStart
            ? new Date(customPeriodStart)
            : new Date(periodEnd.getTime() - periodDays * 24 * 60 * 60 * 1000);

        const projects = await ManagementReportsService._getActiveProjects(organizationId);

        const allRisks = [];
        const allDecisions = [];
        const allKPIs = [];
        const projectStatuses = [];

        for (const project of projects) {
            const [status, risks, decisions, kpis] = await Promise.all([
                ManagementReportsService._getOverallRAGStatus(project.id, null),
                ManagementReportsService._getRisksAndIssues(project.id),
                ManagementReportsService._getDecisionsForBoard(project.id),
                ManagementReportsService._getKPIs(project.id)
            ]);

            risks.forEach(r => {
                r.projectId = project.id;
                r.projectName = project.name;
                allRisks.push(r);
            });

            decisions.forEach(d => {
                d.projectId = project.id;
                d.projectName = project.name;
                allDecisions.push(d);
            });

            projectStatuses.push({
                projectId: project.id,
                projectName: project.name,
                owner: project.owner_name || 'Unassigned',
                phase: project.current_phase || 'Unknown',
                status,
                keyIssues: risks.filter(r => r.severity === 'CRITICAL' || r.severity === 'HIGH').map(r => r.title).slice(0, 3)
            });
        }

        // Portfolio-level aggregation
        const portfolioStatus = ManagementReportsService._aggregatePortfolioStatus(projectStatuses);

        // Generate AI summary with graceful degradation
        let executiveSummary = '';
        let warnings = [];
        let aiError = null;

        if (aiEnhancement) {
            try {
                const portfolioData = await AIExecutiveReporting.generateReport(
                    AIExecutiveReporting.REPORT_TYPES.PORTFOLIO_OVERVIEW,
                    { organizationId },
                    {}
                );
                executiveSummary = portfolioData.narrative || '';
                warnings = AIExecutiveReporting._extractBadNews(portfolioData, { risks: { critical: allRisks.filter(r => r.severity === 'CRITICAL').length }, decisions: { overdue: allDecisions.filter(d => d.daysUntilDeadline < 0).length } });
            } catch (err) {
                console.warn('[ManagementReports] AI portfolio summary failed:', err.message);
                executiveSummary = 'AI-generated portfolio summary unavailable. Report contains raw data metrics.';
                aiError = err.message;
            }
        }

        // Build audit trail
        const auditTrail = {
            reportId: uuidv4(),
            generatedAt: new Date().toISOString(),
            generatedBy: userId,
            generatedByName: '',
            version: '1.0',
            pmoDomain: 'PERFORMANCE_MONITORING',
            iso21500Mapping: 'Project Performance Measurement (Clause 4.4.22)',
            pmbokMapping: 'Measurement Performance Domain',
            prince2Mapping: 'Highlight Report / Progress Theme',
            dataSnapshot: {
                projectsIncluded: projects.length,
                tasksAnalyzed: 0,
                initiativesAnalyzed: 0,
                decisionsAnalyzed: allDecisions.length,
                risksAnalyzed: allRisks.length,
                dataAsOf: new Date().toISOString()
            }
        };

        const content = {
            executiveSummary,
            overallStatus: portfolioStatus,
            kpis: allKPIs,
            risksAndIssues: allRisks.sort((a, b) => {
                const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
                return (severityOrder[a.severity] || 4) - (severityOrder[b.severity] || 4);
            }).slice(0, 15),
            decisionsRequired: allDecisions.slice(0, 10),
            forecast: {
                nextMilestones: [],
                nextGates: [],
                forecastNarrative: ''
            },
            projectStatuses,
            warnings,
            auditTrail,
            aiError
        };

        const reportId = uuidv4();
        const report = {
            id: reportId,
            organizationId,
            projectId: null,
            reportType: REPORT_TYPES.STEERING_COMMITTEE,
            scope: REPORT_SCOPES.PORTFOLIO,
            title: 'Portfolio Steering Committee Report',
            periodStart: periodStart.toISOString().split('T')[0],
            periodEnd: periodEnd.toISOString().split('T')[0],
            status: 'DRAFT',
            generatedBy: userId,
            content,
            aiNarrative: executiveSummary,
            aiWarnings: warnings,
            createdAt: new Date().toISOString()
        };

        await ManagementReportsService._saveReport(report);
        return report;
    },

    // ==========================================
    // REPORT RETRIEVAL & MANAGEMENT
    // ==========================================

    /**
     * Get report by ID
     */
    getReport: async (reportId) => {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM management_reports WHERE id = ?`,
                [reportId],
                (err, row) => {
                    if (err) reject(err);
                    else if (row) {
                        row.content = row.content ? JSON.parse(row.content) : null;
                        row.aiWarnings = row.ai_warnings ? JSON.parse(row.ai_warnings) : [];
                        resolve(row);
                    } else {
                        resolve(null);
                    }
                }
            );
        });
    },

    /**
     * Get report history
     */
    getReportHistory: async (filters = {}) => {
        const {
            organizationId,
            projectId,
            reportType,
            scope,
            status,
            fromDate,
            toDate,
            limit = 20,
            offset = 0
        } = filters;

        // Build WHERE clause
        let whereClause = 'WHERE mr.organization_id = ?';
        const params = [organizationId];

        if (projectId) {
            whereClause += ` AND mr.project_id = ?`;
            params.push(projectId);
        }
        if (reportType) {
            whereClause += ` AND mr.report_type = ?`;
            params.push(reportType);
        }
        if (scope) {
            whereClause += ` AND mr.scope = ?`;
            params.push(scope);
        }
        if (status) {
            whereClause += ` AND mr.status = ?`;
            params.push(status);
        }
        if (fromDate) {
            whereClause += ` AND mr.created_at >= ?`;
            params.push(fromDate);
        }
        if (toDate) {
            whereClause += ` AND mr.created_at <= ?`;
            params.push(toDate);
        }

        // Get total count
        const countQuery = `SELECT COUNT(*) as total FROM management_reports mr ${whereClause}`;

        // Get paginated data
        const dataQuery = `
            SELECT mr.*, u.first_name, u.last_name, u.email,
                   p.name as project_name
            FROM management_reports mr
            LEFT JOIN users u ON mr.generated_by = u.id
            LEFT JOIN projects p ON mr.project_id = p.id
            ${whereClause}
            ORDER BY mr.created_at DESC LIMIT ? OFFSET ?
        `;
        const dataParams = [...params, limit, offset];

        return new Promise((resolve, reject) => {
            // Get count first
            db.get(countQuery, params, (err, countRow) => {
                if (err) return reject(err);

                const total = countRow?.total || 0;

                // Then get data
                db.all(dataQuery, dataParams, (err, rows) => {
                    if (err) return reject(err);

                    const reports = (rows || []).map(row => ({
                        ...row,
                        generatedByName: row.first_name ? `${row.first_name} ${row.last_name}` : row.email,
                        content: null // Don't include full content in list
                    }));

                    resolve({ reports, total });
                });
            });
        });
    },

    /**
     * Update report status
     */
    updateReportStatus: async (reportId, status) => {
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE management_reports SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [status, reportId],
                (err) => {
                    if (err) reject(err);
                    else resolve({ success: true });
                }
            );
        });
    },

    /**
     * Create share link for report
     */
    createShareLink: async (reportId, expiresInDays = 7) => {
        const shareToken = uuidv4();
        const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE management_reports SET share_token = ?, share_expires_at = ? WHERE id = ?`,
                [shareToken, expiresAt, reportId],
                (err) => {
                    if (err) reject(err);
                    else resolve({ shareToken, expiresAt });
                }
            );
        });
    },

    /**
     * Get report by share token
     */
    getReportByShareToken: async (shareToken) => {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM management_reports 
                 WHERE share_token = ? AND (share_expires_at IS NULL OR share_expires_at > datetime('now'))`,
                [shareToken],
                (err, row) => {
                    if (err) reject(err);
                    else if (row) {
                        row.content = row.content ? JSON.parse(row.content) : null;
                        resolve(row);
                    } else {
                        resolve(null);
                    }
                }
            );
        });
    },

    // ==========================================
    // PRIVATE HELPER METHODS
    // ==========================================

    _getProject: async (projectId) => {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT p.*, u.first_name || ' ' || u.last_name as owner_name
                 FROM projects p
                 LEFT JOIN users u ON p.owner_id = u.id
                 WHERE p.id = ?`,
                [projectId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    },

    _getActiveProjects: async (organizationId) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT p.*, u.first_name || ' ' || u.last_name as owner_name
                 FROM projects p
                 LEFT JOIN users u ON p.owner_id = u.id
                 WHERE p.organization_id = ? AND (p.is_closed = 0 OR p.is_closed IS NULL)
                 ORDER BY p.name`,
                [organizationId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });
    },

    _getStatusSummary: async (projectId, periodStart, periodEnd) => {
        const [taskStats, initiativeStats, decisionStats] = await Promise.all([
            new Promise((resolve, reject) => {
                db.get(`
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN status = 'DONE' THEN 1 ELSE 0 END) as completed,
                        SUM(CASE WHEN status = 'IN_PROGRESS' THEN 1 ELSE 0 END) as inProgress,
                        SUM(CASE WHEN status = 'BLOCKED' THEN 1 ELSE 0 END) as blocked,
                        SUM(CASE WHEN due_date < date('now') AND status != 'DONE' THEN 1 ELSE 0 END) as overdue
                    FROM tasks WHERE project_id = ?
                `, [projectId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row || { total: 0, completed: 0, inProgress: 0, blocked: 0, overdue: 0 });
                });
            }),
            new Promise((resolve, reject) => {
                db.get(`
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN status IN ('EXECUTING', 'DONE') THEN 1 ELSE 0 END) as onTrack,
                        SUM(CASE WHEN status = 'BLOCKED' THEN 1 ELSE 0 END) as atRisk
                    FROM initiatives WHERE project_id = ?
                `, [projectId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row || { total: 0, onTrack: 0, atRisk: 0 });
                });
            }),
            new Promise((resolve, reject) => {
                db.get(`
                    SELECT 
                        SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END) as approved,
                        SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending
                    FROM decisions WHERE project_id = ?
                `, [projectId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row || { approved: 0, pending: 0 });
                });
            })
        ]);

        const progressPercent = taskStats.total > 0
            ? Math.round((taskStats.completed / taskStats.total) * 100)
            : 0;

        return {
            progressPercent,
            healthStatus: ManagementReportsService._calculateRAGStatus({
                tasksBlocked: taskStats.blocked,
                tasksOverdue: taskStats.overdue,
                tasksTotal: taskStats.total
            }),
            tasksTotal: taskStats.total,
            tasksCompleted: taskStats.completed,
            tasksInProgress: taskStats.inProgress,
            tasksBlocked: taskStats.blocked,
            tasksOverdue: taskStats.overdue,
            initiativesTotal: initiativeStats.total,
            initiativesOnTrack: initiativeStats.onTrack,
            initiativesAtRisk: initiativeStats.atRisk,
            decisionsApproved: decisionStats.approved,
            decisionsPending: decisionStats.pending
        };
    },

    _getCompletedWork: async (projectId, periodStart, periodEnd) => {
        return new Promise((resolve, reject) => {
            db.all(`
                SELECT t.id, t.title, t.updated_at as completedAt, 
                       u.id as completedById, u.first_name || ' ' || u.last_name as completedByName,
                       i.id as initiativeId, i.title as initiativeTitle
                FROM tasks t
                LEFT JOIN users u ON t.assignee_id = u.id
                LEFT JOIN initiatives i ON t.initiative_id = i.id
                WHERE t.project_id = ? 
                  AND t.status = 'DONE'
                  AND t.updated_at >= ? AND t.updated_at <= ?
                ORDER BY t.updated_at DESC
                LIMIT 30
            `, [projectId, periodStart.toISOString(), periodEnd.toISOString()], (err, rows) => {
                if (err) reject(err);
                else resolve((rows || []).map(row => ({
                    id: row.id,
                    type: 'TASK',
                    title: row.title,
                    completedAt: row.completedAt,
                    completedBy: row.completedById,
                    completedByName: row.completedByName || 'Unknown',
                    initiativeId: row.initiativeId,
                    initiativeTitle: row.initiativeTitle
                })));
            });
        });
    },

    _getWorkInProgress: async (projectId) => {
        return new Promise((resolve, reject) => {
            db.all(`
                SELECT t.id, t.title, t.progress, t.due_date,
                       u.id as assigneeId, u.first_name || ' ' || u.last_name as assigneeName
                FROM tasks t
                LEFT JOIN users u ON t.assignee_id = u.id
                WHERE t.project_id = ? AND t.status = 'IN_PROGRESS'
                ORDER BY t.due_date ASC
                LIMIT 30
            `, [projectId], (err, rows) => {
                if (err) reject(err);
                else resolve((rows || []).map(row => {
                    const daysUntilDue = row.due_date
                        ? Math.ceil((new Date(row.due_date) - new Date()) / (1000 * 60 * 60 * 24))
                        : null;
                    return {
                        id: row.id,
                        type: 'TASK',
                        title: row.title,
                        assigneeId: row.assigneeId,
                        assigneeName: row.assigneeName || 'Unassigned',
                        progressPercent: row.progress || 0,
                        dueDate: row.due_date,
                        daysUntilDue,
                        status: daysUntilDue !== null && daysUntilDue < 0 ? 'RED' : daysUntilDue !== null && daysUntilDue <= 2 ? 'AMBER' : 'GREEN'
                    };
                }));
            });
        });
    },

    _getBlockers: async (projectId) => {
        return new Promise((resolve, reject) => {
            db.all(`
                SELECT t.id, t.title, t.blocked_reason, t.updated_at,
                       u.id as ownerId, u.first_name || ' ' || u.last_name as ownerName
                FROM tasks t
                LEFT JOIN users u ON t.assignee_id = u.id
                WHERE t.project_id = ? AND t.status = 'BLOCKED'
                ORDER BY t.updated_at ASC
            `, [projectId], (err, rows) => {
                if (err) reject(err);
                else resolve((rows || []).map(row => {
                    const daysBlocked = Math.ceil((new Date() - new Date(row.updated_at)) / (1000 * 60 * 60 * 24));
                    return {
                        id: row.id,
                        type: 'TASK',
                        title: row.title,
                        blockedReason: row.blocked_reason || 'No reason specified',
                        blockedSince: row.updated_at,
                        daysBlocked,
                        ownerId: row.ownerId,
                        ownerName: row.ownerName || 'Unassigned',
                        severity: daysBlocked > 7 ? 'HIGH' : daysBlocked > 3 ? 'MEDIUM' : 'LOW'
                    };
                }));
            });
        });
    },

    _getPendingDecisions: async (projectId) => {
        return new Promise((resolve, reject) => {
            db.all(`
                SELECT d.id, d.title, d.description, d.decision_type, d.status, d.created_at,
                       u.id as ownerId, u.first_name || ' ' || u.last_name as ownerName
                FROM decisions d
                LEFT JOIN users u ON d.decision_owner_id = u.id
                WHERE d.project_id = ? AND d.status = 'PENDING'
                ORDER BY d.created_at ASC
            `, [projectId], (err, rows) => {
                if (err) reject(err);
                else resolve((rows || []).map(row => {
                    const daysWaiting = Math.ceil((new Date() - new Date(row.created_at)) / (1000 * 60 * 60 * 24));
                    return {
                        id: row.id,
                        title: row.title,
                        description: row.description,
                        decisionType: row.decision_type,
                        status: row.status,
                        ownerId: row.ownerId,
                        ownerName: row.ownerName || 'Unassigned',
                        createdAt: row.created_at,
                        daysWaiting,
                        urgency: daysWaiting > 14 ? 'URGENT' : daysWaiting > 7 ? 'HIGH' : 'MEDIUM'
                    };
                }));
            });
        });
    },

    _getNextPeriodPlan: async (projectId, periodDays) => {
        const futureDate = new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        return new Promise((resolve, reject) => {
            db.all(`
                SELECT t.id, t.title, t.due_date, t.priority,
                       u.id as assigneeId, u.first_name || ' ' || u.last_name as assigneeName
                FROM tasks t
                LEFT JOIN users u ON t.assignee_id = u.id
                WHERE t.project_id = ? 
                  AND t.status IN ('TODO', 'IN_PROGRESS')
                  AND t.due_date <= ?
                ORDER BY t.due_date ASC
                LIMIT 20
            `, [projectId, futureDate], (err, rows) => {
                if (err) reject(err);
                else resolve((rows || []).map(row => ({
                    id: row.id,
                    type: 'TASK',
                    title: row.title,
                    plannedDate: row.due_date,
                    assigneeId: row.assigneeId,
                    assigneeName: row.assigneeName || 'Unassigned',
                    priority: row.priority || 'MEDIUM'
                })));
            });
        });
    },

    _getOverallRAGStatus: async (projectId, healthSnapshot) => {
        // Get schedule, budget, scope, risk statuses
        const [taskMetrics, riskMetrics, budgetMetrics] = await Promise.all([
            new Promise((resolve, reject) => {
                db.get(`
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN status = 'DONE' THEN 1 ELSE 0 END) as completed,
                        SUM(CASE WHEN status != 'DONE' AND due_date < date('now') THEN 1 ELSE 0 END) as overdue,
                        SUM(CASE WHEN status = 'BLOCKED' THEN 1 ELSE 0 END) as blocked
                    FROM tasks WHERE project_id = ?
                `, [projectId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row || {});
                });
            }),
            new Promise((resolve, reject) => {
                db.get(`
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN severity IN ('critical', 'CRITICAL') THEN 1 ELSE 0 END) as critical,
                        SUM(CASE WHEN severity IN ('high', 'HIGH') THEN 1 ELSE 0 END) as high
                    FROM risk_register WHERE project_id = ? AND status NOT IN ('resolved', 'accepted')
                `, [projectId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row || {});
                });
            }),
            ManagementReportsService._getBudgetStatus(projectId)
        ]);

        const overduePercent = taskMetrics.total > 0 ? (taskMetrics.overdue / taskMetrics.total) * 100 : 0;
        const completionPercent = taskMetrics.total > 0 ? (taskMetrics.completed / taskMetrics.total) * 100 : 0;

        const scheduleStatus = overduePercent > 20 ? 'RED' : overduePercent > 10 ? 'AMBER' : 'GREEN';
        const riskStatus = riskMetrics.critical > 0 ? 'RED' : riskMetrics.high > 2 ? 'AMBER' : 'GREEN';

        return {
            schedule: {
                category: 'SCHEDULE',
                status: scheduleStatus,
                trend: 'STABLE',
                summary: `${taskMetrics.overdue || 0} tasks overdue of ${taskMetrics.total || 0} total`
            },
            budget: budgetMetrics,
            scope: {
                category: 'SCOPE',
                status: taskMetrics.blocked > 5 ? 'AMBER' : 'GREEN',
                trend: 'STABLE',
                summary: `${taskMetrics.blocked || 0} blocked items`
            },
            risk: {
                category: 'RISK',
                status: riskStatus,
                trend: 'STABLE',
                summary: `${riskMetrics.critical || 0} critical, ${riskMetrics.high || 0} high risks`
            },
            overallHealth: ManagementReportsService._worstStatus([scheduleStatus, riskStatus]),
            lastUpdated: new Date().toISOString()
        };
    },

    _getKPIs: async (projectId) => {
        // First try to get KPIs from the project_kpis table
        const customKPIs = await new Promise((resolve, reject) => {
            db.all(`
                SELECT pk.*, u.first_name || ' ' || u.last_name as owner_name
                FROM project_kpis pk
                LEFT JOIN users u ON pk.owner_id = u.id
                WHERE pk.project_id = ? AND pk.status = 'ACTIVE'
                ORDER BY pk.display_order, pk.category, pk.name
            `, [projectId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        // If custom KPIs exist, use them
        if (customKPIs.length > 0) {
            return customKPIs.map(kpi => {
                // Parse historical values for sparkline
                let sparklineData = [];
                try {
                    sparklineData = kpi.historical_values ? JSON.parse(kpi.historical_values) : [];
                } catch (e) {
                    sparklineData = [];
                }

                // Calculate RAG status based on thresholds
                let status = 'GREY';
                if (kpi.current_value !== null && kpi.target_value !== null) {
                    const isHigherBetter = kpi.threshold_direction !== 'LOWER_IS_BETTER';
                    const value = kpi.current_value;
                    const green = kpi.green_threshold ?? (isHigherBetter ? kpi.target_value * 0.9 : kpi.target_value * 1.1);
                    const amber = kpi.amber_threshold ?? (isHigherBetter ? kpi.target_value * 0.7 : kpi.target_value * 1.3);

                    if (isHigherBetter) {
                        status = value >= green ? 'GREEN' : value >= amber ? 'AMBER' : 'RED';
                    } else {
                        status = value <= green ? 'GREEN' : value <= amber ? 'AMBER' : 'RED';
                    }
                }

                return {
                    id: kpi.id,
                    name: kpi.name,
                    category: kpi.category,
                    description: kpi.description,
                    currentValue: kpi.current_value,
                    targetValue: kpi.target_value,
                    baselineValue: kpi.baseline_value,
                    unit: kpi.unit,
                    trend: kpi.trend || 'STABLE',
                    status,
                    sparklineData,
                    showSparkline: kpi.show_sparkline === 1,
                    showTarget: kpi.show_target === 1,
                    ownerName: kpi.owner_name,
                    lastUpdated: kpi.last_updated_at
                };
            });
        }

        // Fallback: Basic KPIs from task data if no custom KPIs defined
        const metrics = await new Promise((resolve, reject) => {
            db.get(`
                SELECT 
                    COUNT(*) as totalTasks,
                    SUM(CASE WHEN status = 'DONE' THEN 1 ELSE 0 END) as completedTasks,
                    AVG(progress) as avgProgress,
                    SUM(CASE WHEN due_date < date('now') AND status != 'DONE' THEN 1 ELSE 0 END) as overdueTasks
                FROM tasks WHERE project_id = ?
            `, [projectId], (err, row) => {
                if (err) reject(err);
                else resolve(row || {});
            });
        });

        const completionRate = metrics.totalTasks > 0 ? Math.round((metrics.completedTasks / metrics.totalTasks) * 100) : 0;
        const avgProgress = Math.round(metrics.avgProgress || 0);

        return [
            {
                id: 'task_completion',
                name: 'Task Completion Rate',
                category: 'SCHEDULE',
                description: 'Percentage of tasks completed',
                currentValue: completionRate,
                targetValue: 100,
                unit: '%',
                trend: 'STABLE',
                status: completionRate >= 70 ? 'GREEN' : completionRate >= 50 ? 'AMBER' : 'RED',
                sparklineData: [],
                showSparkline: true,
                showTarget: true
            },
            {
                id: 'avg_progress',
                name: 'Average Task Progress',
                category: 'SCHEDULE',
                description: 'Mean progress across all active tasks',
                currentValue: avgProgress,
                targetValue: 100,
                unit: '%',
                trend: 'STABLE',
                status: avgProgress >= 60 ? 'GREEN' : avgProgress >= 40 ? 'AMBER' : 'RED',
                sparklineData: [],
                showSparkline: true,
                showTarget: true
            },
            {
                id: 'on_time_delivery',
                name: 'On-Time Delivery',
                category: 'SCHEDULE',
                description: 'Percentage of tasks not overdue',
                currentValue: metrics.totalTasks > 0 ? Math.round(((metrics.totalTasks - metrics.overdueTasks) / metrics.totalTasks) * 100) : 100,
                targetValue: 95,
                unit: '%',
                trend: 'STABLE',
                status: metrics.overdueTasks === 0 ? 'GREEN' : metrics.overdueTasks <= 3 ? 'AMBER' : 'RED',
                sparklineData: [],
                showSparkline: true,
                showTarget: true
            }
        ];
    },

    _getRisksAndIssues: async (projectId) => {
        return new Promise((resolve, reject) => {
            db.all(`
                SELECT r.*, u.first_name || ' ' || u.last_name as ownerName
                FROM risk_register r
                LEFT JOIN users u ON r.owner_id = u.id
                WHERE r.project_id = ? AND r.status NOT IN ('resolved', 'accepted')
                ORDER BY 
                    CASE r.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
            `, [projectId], (err, rows) => {
                if (err) reject(err);
                else resolve((rows || []).map(row => ({
                    id: row.id,
                    type: row.risk_type === 'issue' ? 'ISSUE' : 'RISK',
                    title: row.title,
                    description: row.description,
                    severity: (row.severity || 'medium').toUpperCase(),
                    probability: (row.probability || 'medium').toUpperCase(),
                    impact: row.impact || '',
                    owner: row.owner_id,
                    ownerName: row.ownerName || 'Unassigned',
                    status: row.status,
                    detectedAt: row.detected_at || row.created_at,
                    daysOpen: Math.ceil((new Date() - new Date(row.detected_at || row.created_at)) / (1000 * 60 * 60 * 24)),
                    mitigationPlan: row.mitigation_plan,
                    requiresEscalation: row.severity === 'critical' || row.severity === 'CRITICAL'
                })));
            });
        });
    },

    _getDecisionsForBoard: async (projectId) => {
        return new Promise((resolve, reject) => {
            db.all(`
                SELECT d.*, u.first_name || ' ' || u.last_name as requestedByName
                FROM decisions d
                LEFT JOIN users u ON d.requested_by = u.id
                WHERE d.project_id = ? 
                  AND d.status = 'PENDING'
                  AND (d.escalation_level >= 2 OR d.decision_type IN ('BUDGET', 'SCOPE', 'STRATEGIC'))
                ORDER BY d.created_at ASC
            `, [projectId], (err, rows) => {
                if (err) reject(err);
                else resolve((rows || []).map(row => {
                    const deadline = row.deadline ? new Date(row.deadline) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
                    return {
                        id: row.id,
                        title: row.title,
                        description: row.description,
                        decisionType: row.decision_type || 'STRATEGIC',
                        requestedBy: row.requested_by,
                        requestedByName: row.requestedByName || 'Unknown',
                        deadline: deadline.toISOString(),
                        daysUntilDeadline: Math.ceil((deadline - new Date()) / (1000 * 60 * 60 * 24)),
                        impact: row.impact || '',
                        options: row.options ? JSON.parse(row.options) : []
                    };
                }));
            });
        });
    },

    _getForecast: async (projectId) => {
        const [milestones, gates] = await Promise.all([
            new Promise((resolve, reject) => {
                db.all(`
                    SELECT id, title as name, due_date as plannedDate, status
                    FROM initiatives
                    WHERE project_id = ? AND is_milestone = 1 AND status != 'DONE'
                    ORDER BY due_date ASC
                    LIMIT 5
                `, [projectId], (err, rows) => {
                    if (err) reject(err);
                    else resolve((rows || []).map(row => ({
                        ...row,
                        status: row.status === 'BLOCKED' ? 'RED' : row.status === 'AT_RISK' ? 'AMBER' : 'GREEN'
                    })));
                });
            }),
            new Promise((resolve, reject) => {
                db.all(`
                    SELECT id, gate_type as name, gate_type as gateType, target_date as plannedDate, status
                    FROM stage_gates
                    WHERE project_id = ? AND status != 'PASSED'
                    ORDER BY target_date ASC
                    LIMIT 3
                `, [projectId], (err, rows) => {
                    if (err) reject(err);
                    else resolve((rows || []).map(row => ({
                        ...row,
                        readiness: row.status === 'READY' ? 'GREEN' : row.status === 'BLOCKED' ? 'RED' : 'AMBER',
                        missingCriteria: []
                    })));
                });
            })
        ]);

        return {
            nextMilestones: milestones,
            nextGates: gates,
            forecastNarrative: milestones.length > 0
                ? `Next milestone: ${milestones[0].name} planned for ${milestones[0].plannedDate}`
                : 'No upcoming milestones defined'
        };
    },

    _saveReport: async (report) => {
        return new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO management_reports 
                (id, organization_id, project_id, report_type, scope, title, period_start, period_end, 
                 status, generated_by, content, ai_narrative, ai_warnings, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                report.id,
                report.organizationId,
                report.projectId,
                report.reportType,
                report.scope,
                report.title,
                report.periodStart,
                report.periodEnd,
                report.status,
                report.generatedBy,
                JSON.stringify(report.content),
                report.aiNarrative,
                JSON.stringify(report.aiWarnings || []),
                report.createdAt,
                report.createdAt
            ], (err) => {
                if (err) reject(err);
                else resolve({ success: true, id: report.id });
            });
        });
    },

    _calculateRAGStatus: (summary) => {
        const blockedPercent = summary.tasksTotal > 0 ? (summary.tasksBlocked / summary.tasksTotal) * 100 : 0;
        const overduePercent = summary.tasksTotal > 0 ? (summary.tasksOverdue / summary.tasksTotal) * 100 : 0;

        if (blockedPercent > 20 || overduePercent > 20) return 'RED';
        if (blockedPercent > 10 || overduePercent > 10) return 'AMBER';
        return 'GREEN';
    },

    _calculateOverallHealth: (projectBreakdown) => {
        const redCount = projectBreakdown.filter(p => p.status === 'RED').length;
        const amberCount = projectBreakdown.filter(p => p.status === 'AMBER').length;

        if (redCount > 0) return 'RED';
        if (amberCount > projectBreakdown.length / 2) return 'AMBER';
        return 'GREEN';
    },

    _worstStatus: (statuses) => {
        if (statuses.includes('RED')) return 'RED';
        if (statuses.includes('AMBER')) return 'AMBER';
        return 'GREEN';
    },

    _aggregatePortfolioStatus: (projectStatuses) => {
        const scheduleStatuses = projectStatuses.map(p => p.status.schedule?.status || 'GREEN');
        const riskStatuses = projectStatuses.map(p => p.status.risk?.status || 'GREEN');

        return {
            schedule: {
                category: 'SCHEDULE',
                status: ManagementReportsService._worstStatus(scheduleStatuses),
                trend: 'STABLE',
                summary: `${projectStatuses.length} projects analyzed`
            },
            budget: {
                category: 'BUDGET',
                status: 'GREEN',
                trend: 'STABLE',
                summary: 'Budget tracking pending'
            },
            scope: {
                category: 'SCOPE',
                status: 'GREEN',
                trend: 'STABLE',
                summary: ''
            },
            risk: {
                category: 'RISK',
                status: ManagementReportsService._worstStatus(riskStatuses),
                trend: 'STABLE',
                summary: ''
            },
            overallHealth: ManagementReportsService._worstStatus([...scheduleStatuses, ...riskStatuses]),
            lastUpdated: new Date().toISOString()
        };
    },

    /**
     * Get budget status for a project
     * Queries project_budgets table for actual vs planned spend
     */
    _getBudgetStatus: async (projectId) => {
        return new Promise((resolve, reject) => {
            db.get(`
                SELECT 
                    planned_budget,
                    actual_spend,
                    forecast_at_completion,
                    variance_percent,
                    CASE 
                        WHEN planned_budget IS NULL OR planned_budget = 0 THEN 'NOT_TRACKED'
                        ELSE 'TRACKED'
                    END as tracking_status
                FROM project_budgets 
                WHERE project_id = ?
            `, [projectId], (err, row) => {
                if (err) {
                    console.warn('[ManagementReports] Budget query error:', err.message);
                    resolve({
                        category: 'BUDGET',
                        status: 'GREY',
                        trend: 'UNKNOWN',
                        summary: 'Budget data unavailable'
                    });
                    return;
                }

                if (!row || row.tracking_status === 'NOT_TRACKED' || !row.planned_budget) {
                    resolve({
                        category: 'BUDGET',
                        status: 'GREY',
                        trend: 'UNKNOWN',
                        summary: 'Budget not tracked',
                        plannedBudget: null,
                        actualSpend: null,
                        spendPercent: null
                    });
                    return;
                }

                const spendPercent = (row.actual_spend / row.planned_budget) * 100;
                const variance = row.variance_percent || (spendPercent - 100);

                let status = 'GREEN';
                if (variance > 15 || spendPercent > 110) {
                    status = 'RED';
                } else if (variance > 5 || spendPercent > 95) {
                    status = 'AMBER';
                }

                // Determine trend based on variance
                let trend = 'STABLE';
                if (variance > 10) trend = 'DECLINING';
                else if (variance < -5) trend = 'IMPROVING';

                resolve({
                    category: 'BUDGET',
                    status,
                    trend,
                    summary: `${Math.round(spendPercent)}% of budget used (${variance > 0 ? '+' : ''}${Math.round(variance)}% variance)`,
                    plannedBudget: row.planned_budget,
                    actualSpend: row.actual_spend,
                    spendPercent: Math.round(spendPercent),
                    forecastAtCompletion: row.forecast_at_completion,
                    variancePercent: Math.round(variance)
                });
            });
        });
    },

    /**
     * Calculate confidence level for forecast
     * Based on health snapshot, blockers, risks, and gate status
     */
    _calculateConfidence: (milestones, gates, healthSnapshot, blockers) => {
        let confidence = 'HIGH';
        let reasons = [];

        // Check blockers
        if (blockers && blockers.length > 3) {
            confidence = 'MEDIUM';
            reasons.push(`${blockers.length} active blockers`);
        }
        if (blockers && blockers.length > 6) {
            confidence = 'LOW';
        }

        // Check critical risks from health snapshot
        if (healthSnapshot?.risks?.critical > 0) {
            confidence = 'LOW';
            reasons.push(`${healthSnapshot.risks.critical} critical risk(s)`);
        } else if (healthSnapshot?.risks?.high > 3) {
            if (confidence !== 'LOW') confidence = 'MEDIUM';
            reasons.push(`${healthSnapshot.risks.high} high risks`);
        }

        // Check gates status
        if (gates && gates.some(g => g.status === 'BLOCKED' || g.decision === 'STOP')) {
            confidence = 'LOW';
            reasons.push('Stage gate blocked');
        } else if (gates && gates.some(g => g.status === 'AT_RISK')) {
            if (confidence !== 'LOW') confidence = 'MEDIUM';
            reasons.push('Stage gate at risk');
        }

        // Check overdue milestones
        const overdueMilestones = milestones?.filter(m =>
            new Date(m.dueDate) < new Date() && m.status !== 'DONE'
        ) || [];
        if (overdueMilestones.length > 2) {
            confidence = 'LOW';
            reasons.push(`${overdueMilestones.length} overdue milestones`);
        } else if (overdueMilestones.length > 0) {
            if (confidence !== 'LOW') confidence = 'MEDIUM';
            reasons.push(`${overdueMilestones.length} overdue milestone(s)`);
        }

        return {
            level: confidence,
            reasons,
            score: confidence === 'HIGH' ? 85 : confidence === 'MEDIUM' ? 60 : 35
        };
    },

    _generateHighlights: (completedWork, statusSummary) => {
        const highlights = [];

        if (completedWork.length > 0) {
            highlights.push(`${completedWork.length} tasks completed this period`);
        }
        if (statusSummary.progressPercent >= 75) {
            highlights.push(`Strong progress: ${statusSummary.progressPercent}% complete`);
        }
        if (statusSummary.tasksBlocked === 0) {
            highlights.push('No blocked tasks - execution flowing smoothly');
        }

        return highlights;
    },

    _generateConcerns: (blockers, statusSummary) => {
        const concerns = [];

        if (blockers.length > 0) {
            concerns.push(`${blockers.length} blocked item(s) require attention`);
        }
        if (statusSummary.tasksOverdue > 0) {
            concerns.push(`${statusSummary.tasksOverdue} task(s) are overdue`);
        }
        if (statusSummary.decisionsPending > 3) {
            concerns.push(`${statusSummary.decisionsPending} decisions pending - may cause delays`);
        }

        return concerns;
    },

    // ==========================================
    // LOCK / FINALIZE MECHANISM
    // ==========================================

    /**
     * Calculate integrity hash for report content
     * Used to verify report has not been tampered with after finalization
     * @private
     */
    _calculateIntegrityHash: (report) => {
        const crypto = require('crypto');
        const content = JSON.stringify({
            content: report.content,
            title: report.title,
            periodStart: report.period_start || report.periodStart,
            periodEnd: report.period_end || report.periodEnd,
            aiNarrative: report.ai_narrative || report.aiNarrative
        });
        return crypto.createHash('sha256').update(content).digest('hex');
    },

    /**
     * Finalize a report - locks it from further edits
     * Requires APPROVED status if requires_approval is true
     * 
     * @param {string} reportId - Report ID
     * @param {string} userId - User finalizing
     * @returns {Promise<Object>} Finalized report
     */
    finalizeReport: async (reportId, userId) => {
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM management_reports WHERE id = ?', [reportId], async (err, report) => {
                if (err) return reject(err);
                if (!report) return reject(new Error('Report not found'));

                // Check if already finalized
                if (report.locked_at) {
                    return reject(new Error('Report is already finalized'));
                }

                // Check approval status if required
                if (report.requires_approval && report.approval_status !== 'APPROVED') {
                    return reject(new Error('Report requires approval before finalization'));
                }

                // Calculate integrity hash
                const content = report.content ? JSON.parse(report.content) : {};
                const integrityHash = ManagementReportsService._calculateIntegrityHash({
                    ...report,
                    content
                });

                // Update report
                db.run(`
                    UPDATE management_reports 
                    SET status = 'FINAL',
                        locked_at = CURRENT_TIMESTAMP,
                        locked_by = ?,
                        finalized_at = CURRENT_TIMESTAMP,
                        finalized_by = ?,
                        integrity_hash = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `, [userId, userId, integrityHash, reportId], async function (err) {
                    if (err) return reject(err);

                    // Create final version snapshot
                    try {
                        const ReportVersionService = require('./reportVersionService');
                        await ReportVersionService.createVersion(
                            reportId,
                            content,
                            userId,
                            'Report finalized',
                            { versionType: 'major' }
                        );
                    } catch (e) {
                        console.warn('[ManagementReports] Failed to create final version:', e.message);
                    }

                    // Log audit
                    try {
                        const ReportAuditService = require('./reportAuditService');
                        await ReportAuditService.log(reportId, 'FINALIZED', userId, {
                            integrityHash
                        });
                    } catch (e) {
                        console.warn('[ManagementReports] Failed to log finalization:', e.message);
                    }

                    resolve({
                        id: reportId,
                        status: 'FINAL',
                        lockedAt: new Date().toISOString(),
                        lockedBy: userId,
                        integrityHash
                    });
                });
            });
        });
    },

    /**
     * Unlock a finalized report (admin function)
     * Creates audit trail for compliance
     * 
     * @param {string} reportId - Report ID
     * @param {string} userId - Admin user ID
     * @param {string} reason - Reason for unlocking (required)
     * @returns {Promise<Object>} Unlocked report
     */
    unlockReport: async (reportId, userId, reason) => {
        if (!reason) {
            throw new Error('Reason is required to unlock a finalized report');
        }

        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM management_reports WHERE id = ?', [reportId], async (err, report) => {
                if (err) return reject(err);
                if (!report) return reject(new Error('Report not found'));

                if (!report.locked_at) {
                    return reject(new Error('Report is not locked'));
                }

                // Store old lock info for audit
                const previousLock = {
                    lockedAt: report.locked_at,
                    lockedBy: report.locked_by,
                    integrityHash: report.integrity_hash
                };

                // Update report
                db.run(`
                    UPDATE management_reports 
                    SET status = 'DRAFT',
                        locked_at = NULL,
                        locked_by = NULL,
                        approval_status = 'NONE',
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `, [reportId], async function (err) {
                    if (err) return reject(err);

                    // Log audit
                    try {
                        const ReportAuditService = require('./reportAuditService');
                        await ReportAuditService.log(reportId, 'UNLOCKED', userId, {
                            reason,
                            previousLock
                        });
                    } catch (e) {
                        console.warn('[ManagementReports] Failed to log unlock:', e.message);
                    }

                    resolve({
                        id: reportId,
                        status: 'DRAFT',
                        unlockedAt: new Date().toISOString(),
                        unlockedBy: userId,
                        reason
                    });
                });
            });
        });
    },

    /**
     * Verify report integrity
     * Checks if content matches the integrity hash
     * 
     * @param {string} reportId - Report ID
     * @returns {Promise<Object>} Verification result
     */
    verifyIntegrity: async (reportId) => {
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM management_reports WHERE id = ?', [reportId], (err, report) => {
                if (err) return reject(err);
                if (!report) return reject(new Error('Report not found'));

                if (!report.integrity_hash) {
                    return resolve({
                        reportId,
                        verified: false,
                        reason: 'Report has no integrity hash (not finalized)'
                    });
                }

                const content = report.content ? JSON.parse(report.content) : {};
                const currentHash = ManagementReportsService._calculateIntegrityHash({
                    ...report,
                    content
                });

                const isValid = currentHash === report.integrity_hash;

                resolve({
                    reportId,
                    verified: isValid,
                    storedHash: report.integrity_hash,
                    currentHash,
                    reason: isValid
                        ? 'Report integrity verified - content has not been modified'
                        : 'INTEGRITY VIOLATION - Report content has been modified after finalization'
                });
            });
        });
    },

    /**
     * Check if report is locked
     * 
     * @param {string} reportId - Report ID
     * @returns {Promise<Object>} Lock status
     */
    isLocked: async (reportId) => {
        return new Promise((resolve, reject) => {
            db.get(
                'SELECT locked_at, locked_by, status FROM management_reports WHERE id = ?',
                [reportId],
                (err, report) => {
                    if (err) return reject(err);
                    if (!report) return reject(new Error('Report not found'));

                    resolve({
                        reportId,
                        isLocked: !!report.locked_at,
                        lockedAt: report.locked_at,
                        lockedBy: report.locked_by,
                        status: report.status
                    });
                }
            );
        });
    },

    // ==========================================
    // COMMENTS SYSTEM
    // ==========================================

    /**
     * Add a comment to a report section
     * 
     * @param {string} reportId - Report ID
     * @param {string} sectionId - Section ID (e.g., 'executiveSummary', 'kpis')
     * @param {string} content - Comment content
     * @param {string} userId - User ID
     * @param {Object} options - Additional options (mentions, parentCommentId)
     * @returns {Promise<Object>} Created comment
     */
    addComment: async (reportId, sectionId, content, userId, options = {}) => {
        const { mentions = [], parentCommentId = null } = options;
        const commentId = uuidv4();

        // Get current version ID
        const version = await new Promise((resolve, reject) => {
            db.get(
                'SELECT id FROM management_report_versions WHERE report_id = ? ORDER BY version_number DESC LIMIT 1',
                [reportId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        return new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO management_report_comments 
                (id, report_id, version_id, section_id, parent_comment_id, content, mentions, created_by, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `, [
                commentId,
                reportId,
                version?.id || null,
                sectionId,
                parentCommentId,
                content,
                JSON.stringify(mentions),
                userId
            ], async function (err) {
                if (err) return reject(err);

                // Log audit
                try {
                    const ReportAuditService = require('./reportAuditService');
                    await ReportAuditService.log(reportId, 'COMMENT_ADDED', userId, {
                        commentId,
                        sectionId,
                        isReply: !!parentCommentId,
                        mentionCount: mentions.length
                    });
                } catch (e) {
                    console.warn('[ManagementReports] Failed to log comment:', e.message);
                }

                // Get user info for response
                db.get(
                    'SELECT first_name, last_name, email FROM users WHERE id = ?',
                    [userId],
                    (err, user) => {
                        resolve({
                            id: commentId,
                            reportId,
                            versionId: version?.id,
                            sectionId,
                            parentCommentId,
                            content,
                            mentions,
                            isResolved: false,
                            createdBy: userId,
                            createdByName: user ? `${user.first_name} ${user.last_name}` : null,
                            createdAt: new Date().toISOString()
                        });
                    }
                );
            });
        });
    },

    /**
     * Get comments for a report
     * 
     * @param {string} reportId - Report ID
     * @param {string} sectionId - Optional section filter
     * @returns {Promise<Array>} Comments list
     */
    getComments: async (reportId, sectionId = null) => {
        return new Promise((resolve, reject) => {
            let query = `
                SELECT c.*, 
                       u.first_name, u.last_name, u.email,
                       ru.first_name as resolved_first_name, ru.last_name as resolved_last_name
                FROM management_report_comments c
                LEFT JOIN users u ON c.created_by = u.id
                LEFT JOIN users ru ON c.resolved_by = ru.id
                WHERE c.report_id = ?
            `;
            const params = [reportId];

            if (sectionId) {
                query += ' AND c.section_id = ?';
                params.push(sectionId);
            }

            query += ' ORDER BY c.created_at ASC';

            db.all(query, params, (err, rows) => {
                if (err) return reject(err);

                // Build threaded structure
                const commentsMap = {};
                const rootComments = [];

                (rows || []).forEach(row => {
                    const comment = {
                        id: row.id,
                        reportId: row.report_id,
                        versionId: row.version_id,
                        sectionId: row.section_id,
                        parentCommentId: row.parent_comment_id,
                        content: row.content,
                        mentions: row.mentions ? JSON.parse(row.mentions) : [],
                        isResolved: !!row.is_resolved,
                        resolvedBy: row.resolved_by,
                        resolvedByName: row.resolved_first_name
                            ? `${row.resolved_first_name} ${row.resolved_last_name}`
                            : null,
                        resolvedAt: row.resolved_at,
                        createdBy: row.created_by,
                        createdByName: row.first_name
                            ? `${row.first_name} ${row.last_name}`
                            : row.email,
                        createdAt: row.created_at,
                        updatedAt: row.updated_at,
                        replies: []
                    };
                    commentsMap[row.id] = comment;

                    if (!row.parent_comment_id) {
                        rootComments.push(comment);
                    }
                });

                // Attach replies to parents
                Object.values(commentsMap).forEach(comment => {
                    if (comment.parentCommentId && commentsMap[comment.parentCommentId]) {
                        commentsMap[comment.parentCommentId].replies.push(comment);
                    }
                });

                resolve(rootComments);
            });
        });
    },

    /**
     * Resolve a comment
     * 
     * @param {string} commentId - Comment ID
     * @param {string} userId - User resolving
     * @returns {Promise<Object>} Updated comment
     */
    resolveComment: async (commentId, userId) => {
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM management_report_comments WHERE id = ?', [commentId], async (err, comment) => {
                if (err) return reject(err);
                if (!comment) return reject(new Error('Comment not found'));

                db.run(`
                    UPDATE management_report_comments 
                    SET is_resolved = 1, resolved_by = ?, resolved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `, [userId, commentId], async function (err) {
                    if (err) return reject(err);

                    // Log audit
                    try {
                        const ReportAuditService = require('./reportAuditService');
                        await ReportAuditService.log(comment.report_id, 'COMMENT_RESOLVED', userId, {
                            commentId,
                            sectionId: comment.section_id
                        });
                    } catch (e) {
                        console.warn('[ManagementReports] Failed to log comment resolution:', e.message);
                    }

                    resolve({
                        id: commentId,
                        isResolved: true,
                        resolvedBy: userId,
                        resolvedAt: new Date().toISOString()
                    });
                });
            });
        });
    },

    /**
     * Delete a comment
     * 
     * @param {string} commentId - Comment ID
     * @param {string} userId - User deleting (must be comment author or admin)
     * @returns {Promise<Object>} Deletion result
     */
    deleteComment: async (commentId, userId) => {
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM management_report_comments WHERE id = ?', [commentId], async (err, comment) => {
                if (err) return reject(err);
                if (!comment) return reject(new Error('Comment not found'));

                // Check permission (author or admin)
                if (comment.created_by !== userId) {
                    const user = await new Promise((res, rej) => {
                        db.get('SELECT role FROM users WHERE id = ?', [userId], (err, row) => {
                            if (err) rej(err);
                            else res(row);
                        });
                    });
                    if (!user || !['ADMIN', 'SUPERADMIN', 'admin'].includes(user.role)) {
                        return reject(new Error('Not authorized to delete this comment'));
                    }
                }

                db.run('DELETE FROM management_report_comments WHERE id = ?', [commentId], async function (err) {
                    if (err) return reject(err);

                    // Log audit
                    try {
                        const ReportAuditService = require('./reportAuditService');
                        await ReportAuditService.log(comment.report_id, 'COMMENT_DELETED', userId, {
                            commentId,
                            sectionId: comment.section_id,
                            deletedContent: comment.content.substring(0, 100)
                        });
                    } catch (e) {
                        console.warn('[ManagementReports] Failed to log comment deletion:', e.message);
                    }

                    resolve({
                        deleted: true,
                        commentId
                    });
                });
            });
        });
    }
};

export default ManagementReportsService;

