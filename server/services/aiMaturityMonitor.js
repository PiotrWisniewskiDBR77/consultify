/**
 * AI Maturity Monitor Service
 * 
 * Monitors PMO maturity and discipline patterns over time.
 * Provides descriptive feedback (not judgmental).
 * Organization learns while executing.
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');

// Maturity dimensions based on PMO best practices
const MATURITY_DIMENSIONS = {
    PLANNING: 'planning_discipline',
    DECISION: 'decision_timeliness',
    EXECUTION: 'execution_predictability',
    GOVERNANCE: 'governance_clarity',
    ADOPTION: 'change_adoption'
};

// Maturity levels (1-5 scale like CMMI)
const MATURITY_LEVELS = {
    INITIAL: { level: 1, name: 'Initial', description: 'Ad hoc, unpredictable' },
    DEVELOPING: { level: 2, name: 'Developing', description: 'Some structure emerging' },
    DEFINED: { level: 3, name: 'Defined', description: 'Standard processes' },
    MANAGED: { level: 4, name: 'Managed', description: 'Measured and controlled' },
    OPTIMIZING: { level: 5, name: 'Optimizing', description: 'Continuous improvement' }
};

// Discipline event types to track
const DISCIPLINE_EVENTS = {
    MISSED_DEADLINE: 'missed_deadline',
    LATE_DECISION: 'late_decision',
    SCOPE_CREEP: 'scope_creep',
    BLOCKED_TASK: 'blocked_task',
    STALLED_INITIATIVE: 'stalled_initiative',
    UNCONTROLLED_CHANGE: 'uncontrolled_change',
    ESCALATION: 'escalation'
};

const AIMaturityMonitor = {
    MATURITY_DIMENSIONS,
    MATURITY_LEVELS,
    DISCIPLINE_EVENTS,

    // ==========================================
    // MATURITY ASSESSMENT
    // ==========================================

    /**
     * Assess current maturity level for a project or organization
     */
    assessMaturity: async (projectId = null, organizationId = null) => {
        if (!projectId && !organizationId) {
            throw new Error('Either projectId or organizationId required');
        }

        const scope = projectId ? { projectId, type: 'project' } : { organizationId, type: 'organization' };

        // Collect metrics for each dimension
        const planningScore = await AIMaturityMonitor._assessPlanningDiscipline(scope);
        const decisionScore = await AIMaturityMonitor._assessDecisionTimeliness(scope);
        const executionScore = await AIMaturityMonitor._assessExecutionPredictability(scope);
        const governanceScore = await AIMaturityMonitor._assessGovernanceClarity(scope);
        const adoptionScore = await AIMaturityMonitor._assessChangeAdoption(scope);

        // Calculate overall
        const scores = [planningScore, decisionScore, executionScore, governanceScore, adoptionScore];
        const overallScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        const overallLevel = AIMaturityMonitor._scoreToLevel(overallScore);

        // Generate insights
        const insights = AIMaturityMonitor._generateInsights({
            planning: planningScore,
            decision: decisionScore,
            execution: executionScore,
            governance: governanceScore,
            adoption: adoptionScore
        });

        // Generate recommendations
        const recommendations = AIMaturityMonitor._generateRecommendations({
            planning: planningScore,
            decision: decisionScore,
            execution: executionScore,
            governance: governanceScore,
            adoption: adoptionScore
        });

        // Store assessment
        const assessmentId = uuidv4();
        await new Promise((resolve) => {
            db.run(`
                INSERT INTO maturity_assessments 
                (id, project_id, organization_id, assessment_date, planning_score, decision_score, 
                 execution_score, governance_score, adoption_score, overall_score, overall_level, insights, recommendations)
                VALUES (?, ?, ?, date('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                assessmentId, projectId, organizationId,
                planningScore, decisionScore, executionScore, governanceScore, adoptionScore,
                overallScore, overallLevel.level, JSON.stringify(insights), JSON.stringify(recommendations)
            ], resolve);
        });

        return {
            assessmentId,
            scope,
            date: new Date().toISOString().split('T')[0],
            dimensions: {
                planning: { score: planningScore, level: AIMaturityMonitor._scoreToLevel(planningScore).name },
                decision: { score: decisionScore, level: AIMaturityMonitor._scoreToLevel(decisionScore).name },
                execution: { score: executionScore, level: AIMaturityMonitor._scoreToLevel(executionScore).name },
                governance: { score: governanceScore, level: AIMaturityMonitor._scoreToLevel(governanceScore).name },
                adoption: { score: adoptionScore, level: AIMaturityMonitor._scoreToLevel(adoptionScore).name }
            },
            overall: {
                score: Math.round(overallScore * 10) / 10,
                level: overallLevel.level,
                name: overallLevel.name,
                description: overallLevel.description
            },
            insights,
            recommendations
        };
    },

    /**
     * Convert score (0-5) to maturity level
     */
    _scoreToLevel: (score) => {
        if (score >= 4.5) return MATURITY_LEVELS.OPTIMIZING;
        if (score >= 3.5) return MATURITY_LEVELS.MANAGED;
        if (score >= 2.5) return MATURITY_LEVELS.DEFINED;
        if (score >= 1.5) return MATURITY_LEVELS.DEVELOPING;
        return MATURITY_LEVELS.INITIAL;
    },

    // ==========================================
    // DIMENSION ASSESSMENTS
    // ==========================================

    /**
     * Assess planning discipline
     */
    _assessPlanningDiscipline: async (scope) => {
        const whereClause = scope.projectId ? 'project_id = ?' : 'organization_id = ?';
        const param = scope.projectId || scope.organizationId;

        // Check initiatives with proper planning data
        const initiatives = await new Promise((resolve) => {
            const sql = scope.projectId
                ? `SELECT * FROM initiatives WHERE project_id = ?`
                : `SELECT i.* FROM initiatives i JOIN projects p ON i.project_id = p.id WHERE p.organization_id = ?`;
            db.all(sql, [param], (err, rows) => resolve(rows || []));
        });

        if (initiatives.length === 0) return 2.5; // Neutral if no data

        let score = 5;

        // Check target dates
        const withTargetDates = initiatives.filter(i => i.target_date).length;
        const targetDateRatio = withTargetDates / initiatives.length;
        if (targetDateRatio < 0.8) score -= 1;

        // Check descriptions
        const withDescriptions = initiatives.filter(i => i.description && i.description.length > 50).length;
        const descriptionRatio = withDescriptions / initiatives.length;
        if (descriptionRatio < 0.6) score -= 0.5;

        // Check for dependencies defined
        const deps = await new Promise((resolve) => {
            db.get(`SELECT COUNT(*) as count FROM initiative_dependencies`, [], (err, row) => resolve(row?.count || 0));
        });
        if (deps === 0 && initiatives.length > 5) score -= 0.5;

        return Math.max(1, score);
    },

    /**
     * Assess decision timeliness
     */
    _assessDecisionTimeliness: async (scope) => {
        const whereClause = scope.projectId ? 'd.project_id = ?' : 'p.organization_id = ?';
        const param = scope.projectId || scope.organizationId;

        const sql = scope.projectId
            ? `SELECT * FROM decisions WHERE project_id = ?`
            : `SELECT d.* FROM decisions d JOIN projects p ON d.project_id = p.id WHERE p.organization_id = ?`;

        const decisions = await new Promise((resolve) => {
            db.all(sql, [param], (err, rows) => resolve(rows || []));
        });

        if (decisions.length === 0) return 3; // Neutral

        let score = 5;

        // Calculate average decision time
        const decidedDecisions = decisions.filter(d => d.decided_at);
        if (decidedDecisions.length > 0) {
            const avgDays = decidedDecisions.reduce((sum, d) => {
                const days = Math.floor((new Date(d.decided_at) - new Date(d.created_at)) / (1000 * 60 * 60 * 24));
                return sum + days;
            }, 0) / decidedDecisions.length;

            if (avgDays > 14) score -= 2;
            else if (avgDays > 7) score -= 1;
        }

        // Check pending decisions
        const pending = decisions.filter(d => d.status === 'PENDING');
        if (pending.length > 5) score -= 1;

        // Check for overdue (7+ days pending)
        const overdue = pending.filter(d => {
            const days = Math.floor((Date.now() - new Date(d.created_at)) / (1000 * 60 * 60 * 24));
            return days > 7;
        });
        if (overdue.length > 0) score -= 0.5;

        return Math.max(1, score);
    },

    /**
     * Assess execution predictability
     */
    _assessExecutionPredictability: async (scope) => {
        const param = scope.projectId || scope.organizationId;

        const sql = scope.projectId
            ? `SELECT * FROM tasks WHERE project_id = ?`
            : `SELECT t.* FROM tasks t JOIN projects p ON t.project_id = p.id WHERE p.organization_id = ?`;

        const tasks = await new Promise((resolve) => {
            db.all(sql, [param], (err, rows) => resolve(rows || []));
        });

        if (tasks.length === 0) return 3;

        let score = 5;

        // On-time completion rate
        const completedTasks = tasks.filter(t => t.status === 'done' || t.status === 'DONE');
        const onTime = completedTasks.filter(t => {
            if (!t.due_date || !t.updated_at) return true;
            return new Date(t.updated_at) <= new Date(t.due_date);
        });
        const onTimeRate = completedTasks.length > 0 ? onTime.length / completedTasks.length : 1;

        if (onTimeRate < 0.5) score -= 2;
        else if (onTimeRate < 0.7) score -= 1;
        else if (onTimeRate < 0.85) score -= 0.5;

        // Blocked tasks ratio
        const blocked = tasks.filter(t => t.status === 'BLOCKED').length;
        const blockedRatio = blocked / tasks.length;
        if (blockedRatio > 0.2) score -= 1;
        else if (blockedRatio > 0.1) score -= 0.5;

        return Math.max(1, score);
    },

    /**
     * Assess governance clarity
     */
    _assessGovernanceClarity: async (scope) => {
        const param = scope.projectId || scope.organizationId;

        let score = 5;

        // Check for defined roles
        if (scope.projectId) {
            const project = await new Promise((resolve) => {
                db.get(`SELECT * FROM projects WHERE id = ?`, [param], (err, row) => resolve(row));
            });

            if (!project?.sponsor_id) score -= 0.5;
            if (!project?.owner_id) score -= 0.5;
        }

        // Check for stage gates
        const gates = await new Promise((resolve) => {
            const sql = scope.projectId
                ? `SELECT COUNT(*) as count FROM stage_gates WHERE project_id = ?`
                : `SELECT COUNT(*) as count FROM stage_gates sg JOIN projects p ON sg.project_id = p.id WHERE p.organization_id = ?`;
            db.get(sql, [param], (err, row) => resolve(row?.count || 0));
        });

        if (gates === 0) score -= 1;

        // Check for escalations (having escalation process is good)
        const escalations = await new Promise((resolve) => {
            const sql = scope.projectId
                ? `SELECT COUNT(*) as count FROM escalations WHERE project_id = ?`
                : `SELECT COUNT(*) as count FROM escalations e JOIN projects p ON e.project_id = p.id WHERE p.organization_id = ?`;
            db.get(sql, [param], (err, row) => resolve(row?.count || 0));
        });

        // Some escalations are expected and healthy
        // Too many might indicate issues
        if (escalations > 20) score -= 0.5;

        return Math.max(1, score);
    },

    /**
     * Assess change adoption consistency
     */
    _assessChangeAdoption: async (scope) => {
        const param = scope.projectId || scope.organizationId;

        let score = 5;

        // Check initiative completion rate
        const sql = scope.projectId
            ? `SELECT status, COUNT(*) as count FROM initiatives WHERE project_id = ? GROUP BY status`
            : `SELECT i.status, COUNT(*) as count FROM initiatives i JOIN projects p ON i.project_id = p.id WHERE p.organization_id = ? GROUP BY i.status`;

        const statusCounts = await new Promise((resolve) => {
            db.all(sql, [param], (err, rows) => {
                const counts = {};
                (rows || []).forEach(r => { counts[r.status] = r.count; });
                resolve(counts);
            });
        });

        const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);
        const completed = (statusCounts['COMPLETED'] || 0) + (statusCounts['CLOSED'] || 0);
        const cancelled = statusCounts['CANCELLED'] || 0;

        if (total > 0) {
            const successRate = (completed / total) * 100;
            const cancelRate = (cancelled / total) * 100;

            if (successRate < 30) score -= 1.5;
            else if (successRate < 50) score -= 1;

            if (cancelRate > 30) score -= 1;
            else if (cancelRate > 15) score -= 0.5;
        }

        return Math.max(1, score);
    },

    // ==========================================
    // INSIGHTS & RECOMMENDATIONS
    // ==========================================

    /**
     * Generate descriptive insights (not judgmental)
     */
    _generateInsights: (scores) => {
        const insights = [];

        // Strongest dimension
        const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
        insights.push({
            type: 'strength',
            dimension: sorted[0][0],
            message: `${sorted[0][0].charAt(0).toUpperCase() + sorted[0][0].slice(1)} is the strongest area (${sorted[0][1].toFixed(1)}/5)`
        });

        // Weakest dimension (if significant gap)
        if (sorted[sorted.length - 1][1] < 3) {
            insights.push({
                type: 'opportunity',
                dimension: sorted[sorted.length - 1][0],
                message: `${sorted[sorted.length - 1][0].charAt(0).toUpperCase() + sorted[sorted.length - 1][0].slice(1)} has room for improvement (${sorted[sorted.length - 1][1].toFixed(1)}/5)`
            });
        }

        // Balance observation
        const range = sorted[0][1] - sorted[sorted.length - 1][1];
        if (range < 1) {
            insights.push({
                type: 'balance',
                message: 'Maturity is balanced across dimensions'
            });
        } else if (range > 2) {
            insights.push({
                type: 'imbalance',
                message: 'Significant variation between dimensions - consider focused improvement'
            });
        }

        return insights;
    },

    /**
     * Generate recommendations for improvement
     */
    _generateRecommendations: (scores) => {
        const recommendations = [];

        if (scores.planning < 3) {
            recommendations.push({
                dimension: 'planning',
                priority: 'high',
                action: 'Improve initiative planning completeness',
                suggestion: 'Ensure all initiatives have target dates, descriptions, and defined dependencies'
            });
        }

        if (scores.decision < 3) {
            recommendations.push({
                dimension: 'decision',
                priority: 'high',
                action: 'Reduce decision cycle time',
                suggestion: 'Implement decision SLAs and regular decision review meetings'
            });
        }

        if (scores.execution < 3) {
            recommendations.push({
                dimension: 'execution',
                priority: 'high',
                action: 'Improve delivery predictability',
                suggestion: 'Review estimation practices and address blockers proactively'
            });
        }

        if (scores.governance < 3) {
            recommendations.push({
                dimension: 'governance',
                priority: 'medium',
                action: 'Strengthen governance structure',
                suggestion: 'Define clear roles, implement stage gates, and establish escalation paths'
            });
        }

        if (scores.adoption < 3) {
            recommendations.push({
                dimension: 'adoption',
                priority: 'medium',
                action: 'Improve change adoption',
                suggestion: 'Review initiative success factors and address cancellation root causes'
            });
        }

        return recommendations;
    },

    // ==========================================
    // MATURITY TRENDS
    // ==========================================

    /**
     * Get maturity trend over time
     */
    getMaturityTrend: async (projectId = null, organizationId = null, months = 3) => {
        const param = projectId || organizationId;
        const whereClause = projectId ? 'project_id = ?' : 'organization_id = ?';

        const assessments = await new Promise((resolve, reject) => {
            db.all(`
                SELECT * FROM maturity_assessments
                WHERE ${whereClause}
                AND assessment_date >= date('now', '-${months} months')
                ORDER BY assessment_date ASC
            `, [param], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        if (assessments.length < 2) {
            return {
                hasTrend: false,
                message: 'Insufficient data for trend analysis. Need at least 2 assessments.',
                assessments
            };
        }

        const first = assessments[0];
        const last = assessments[assessments.length - 1];

        const dimensionTrends = {
            planning: last.planning_score - first.planning_score,
            decision: last.decision_score - first.decision_score,
            execution: last.execution_score - first.execution_score,
            governance: last.governance_score - first.governance_score,
            adoption: last.adoption_score - first.adoption_score
        };

        const overallTrend = last.overall_score - first.overall_score;

        return {
            hasTrend: true,
            periodMonths: months,
            assessmentCount: assessments.length,
            overall: {
                startScore: first.overall_score,
                endScore: last.overall_score,
                change: overallTrend,
                direction: overallTrend > 0.3 ? 'improving' : overallTrend < -0.3 ? 'declining' : 'stable'
            },
            dimensions: dimensionTrends,
            bestImprovement: Object.entries(dimensionTrends).sort((a, b) => b[1] - a[1])[0],
            needsAttention: Object.entries(dimensionTrends).filter(([k, v]) => v < -0.3).map(([k]) => k),
            assessments: assessments.map(a => ({
                date: a.assessment_date,
                overall: a.overall_score,
                level: a.overall_level
            }))
        };
    },

    // ==========================================
    // DISCIPLINE EVENT TRACKING
    // ==========================================

    /**
     * Log a discipline event for pattern detection
     */
    logDisciplineEvent: async ({ projectId, organizationId, eventType, entityType, entityId, description, severity = 'medium' }) => {
        const id = uuidv4();

        return new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO discipline_events 
                (id, project_id, organization_id, event_type, severity, entity_type, entity_id, description)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [id, projectId, organizationId, eventType, severity, entityType, entityId, description], function (err) {
                if (err) reject(err);
                else resolve({ id, eventType, severity });
            });
        });
    },

    /**
     * Get discipline event patterns
     */
    getDisciplinePatterns: async (projectId = null, organizationId = null, days = 30) => {
        const param = projectId || organizationId;
        const whereClause = projectId ? 'project_id = ?' : 'organization_id = ?';

        const events = await new Promise((resolve, reject) => {
            db.all(`
                SELECT event_type, severity, COUNT(*) as count
                FROM discipline_events
                WHERE ${whereClause}
                AND occurred_at >= datetime('now', '-${days} days')
                GROUP BY event_type, severity
                ORDER BY count DESC
            `, [param], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        const patterns = {
            totalEvents: events.reduce((sum, e) => sum + e.count, 0),
            byType: {},
            bySeverity: { low: 0, medium: 0, high: 0 },
            topIssue: null
        };

        for (const event of events) {
            patterns.byType[event.event_type] = (patterns.byType[event.event_type] || 0) + event.count;
            patterns.bySeverity[event.severity] = (patterns.bySeverity[event.severity] || 0) + event.count;
        }

        if (events.length > 0) {
            const topType = Object.entries(patterns.byType).sort((a, b) => b[1] - a[1])[0];
            patterns.topIssue = { type: topType[0], count: topType[1] };
        }

        return patterns;
    },

    // ==========================================
    // BENCHMARK COMPARISON
    // ==========================================

    /**
     * Compare project against best practices / benchmarks
     */
    benchmarkAgainstPractices: async (projectId) => {
        const assessment = await AIMaturityMonitor.assessMaturity(projectId);

        // Define best practice thresholds
        const benchmarks = {
            planning: { target: 4, industryAvg: 3.2 },
            decision: { target: 4.5, industryAvg: 2.8 },
            execution: { target: 4, industryAvg: 3.0 },
            governance: { target: 4, industryAvg: 2.5 },
            adoption: { target: 3.5, industryAvg: 2.7 }
        };

        const comparison = {};
        for (const [dim, scores] of Object.entries(assessment.dimensions)) {
            const benchmark = benchmarks[dim];
            comparison[dim] = {
                current: scores.score,
                target: benchmark.target,
                industryAvg: benchmark.industryAvg,
                vsTarget: scores.score - benchmark.target,
                vsIndustry: scores.score - benchmark.industryAvg,
                status: scores.score >= benchmark.target ? 'above_target' :
                    scores.score >= benchmark.industryAvg ? 'above_average' : 'below_average'
            };
        }

        return {
            projectId,
            currentLevel: assessment.overall,
            comparison,
            summary: {
                aboveTarget: Object.values(comparison).filter(c => c.status === 'above_target').length,
                aboveAverage: Object.values(comparison).filter(c => c.status === 'above_average').length,
                belowAverage: Object.values(comparison).filter(c => c.status === 'below_average').length
            }
        };
    }
};

module.exports = AIMaturityMonitor;
