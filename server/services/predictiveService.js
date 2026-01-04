/**
 * Predictive Analytics Service
 * 
 * Provides predictive capabilities for:
 * - Project success/failure prediction
 * - Early warning signal detection
 * - ROI prediction based on company profile
 * - Risk probability forecasting
 * - Resource constraint prediction
 * - Timeline slip detection
 */

// Dependency injection for testing
const deps = {
    _db: null,
    _uuidv4: null,

    get db() { return this._db; },
    set db(val) { this._db = val; },

    get uuidv4() { return this._uuidv4; },
    set uuidv4(val) { this._uuidv4 = val; }
};

/**
 * Initialize dependencies lazily
 */
async function initDeps() {
    if (!deps._db) {
        const { default: db } = await import('../src/database/Database.ts');
        deps._db = db;
    }
    if (!deps._uuidv4) {
        const { v4 } = await import('uuid');
        deps._uuidv4 = v4;
    }
}

// Thresholds for warnings
const THRESHOLDS = {
    CRITICAL: 0.8,      // High probability of issue
    WARNING: 0.6,       // Moderate concern
    ATTENTION: 0.4,     // Worth monitoring
    HEALTHY: 0.2        // Low risk
};

// Early warning signal types
const SIGNAL_TYPES = {
    SCHEDULE_SLIP: 'schedule_slip',
    BUDGET_OVERRUN: 'budget_overrun',
    SCOPE_CREEP: 'scope_creep',
    RESOURCE_CONSTRAINT: 'resource_constraint',
    STAKEHOLDER_DISENGAGEMENT: 'stakeholder_disengagement',
    QUALITY_DEGRADATION: 'quality_degradation',
    ADOPTION_RISK: 'adoption_risk',
    DEPENDENCY_FAILURE: 'dependency_failure',
    TEAM_BURNOUT: 'team_burnout',
    TECHNICAL_DEBT: 'technical_debt'
};

// Prediction models (simplified rule-based; production would use ML)
const PREDICTION_MODELS = {
    PROJECT_SUCCESS: 'project_success',
    TIMELINE_COMPLETION: 'timeline_completion',
    ROI_ACHIEVEMENT: 'roi_achievement',
    ADOPTION_RATE: 'adoption_rate'
};

const PredictiveService = {
    SIGNAL_TYPES,
    THRESHOLDS,
    PREDICTION_MODELS,

    /**
     * Analyze a project for early warning signals
     * @param {string} projectId - Project to analyze
     * @returns {object} Early warning signals and predictions
     */
    analyzeProject: async (projectId) => {
        const projectData = await PredictiveService.getProjectData(projectId);
        
        if (!projectData) {
            return { error: 'Project not found', signals: [], predictions: {} };
        }

        const signals = [];
        const predictions = {};

        // 1. Schedule Analysis
        const scheduleSignal = await PredictiveService.analyzeSchedule(projectData);
        if (scheduleSignal) signals.push(scheduleSignal);

        // 2. Budget Analysis
        const budgetSignal = await PredictiveService.analyzeBudget(projectData);
        if (budgetSignal) signals.push(budgetSignal);

        // 3. Resource Analysis
        const resourceSignal = await PredictiveService.analyzeResources(projectData);
        if (resourceSignal) signals.push(resourceSignal);

        // 4. Stakeholder Engagement
        const stakeholderSignal = await PredictiveService.analyzeStakeholderEngagement(projectData);
        if (stakeholderSignal) signals.push(stakeholderSignal);

        // 5. Adoption Risk
        const adoptionSignal = await PredictiveService.analyzeAdoptionRisk(projectData);
        if (adoptionSignal) signals.push(adoptionSignal);

        // 6. Dependency Analysis
        const dependencySignal = await PredictiveService.analyzeDependencies(projectData);
        if (dependencySignal) signals.push(dependencySignal);

        // 7. Team Health
        const teamSignal = await PredictiveService.analyzeTeamHealth(projectData);
        if (teamSignal) signals.push(teamSignal);

        // Generate predictions
        predictions.projectSuccess = PredictiveService.predictProjectSuccess(projectData, signals);
        predictions.timelineCompletion = PredictiveService.predictTimelineCompletion(projectData);
        predictions.roiAchievement = PredictiveService.predictROIAchievement(projectData);

        // Sort signals by severity
        signals.sort((a, b) => b.probability - a.probability);

        // Store analysis in database
        await PredictiveService.storeAnalysis(projectId, { signals, predictions });

        return {
            projectId,
            analyzedAt: new Date().toISOString(),
            signals,
            predictions,
            overallRisk: PredictiveService.calculateOverallRisk(signals),
            recommendations: PredictiveService.generateRecommendations(signals, predictions)
        };
    },

    /**
     * Get project data for analysis
     */
    getProjectData: async (projectId) => {
        return new Promise((resolve, reject) => {
            db.get(`SELECT * FROM projects WHERE id = ?`, [projectId], async (err, project) => {
                if (err || !project) return resolve(null);

                // Get related data
                const [initiatives, tasks, milestones, resources, activities] = await Promise.all([
                    PredictiveService.getInitiatives(projectId),
                    PredictiveService.getTasks(projectId),
                    PredictiveService.getMilestones(projectId),
                    PredictiveService.getResources(projectId),
                    PredictiveService.getRecentActivities(projectId)
                ]);

                resolve({
                    ...project,
                    initiatives,
                    tasks,
                    milestones,
                    resources,
                    activities,
                    createdAt: new Date(project.created_at),
                    updatedAt: project.updated_at ? new Date(project.updated_at) : null
                });
            });
        });
    },

    getInitiatives: (projectId) => {
        return new Promise((resolve) => {
            deps.db.all(`SELECT * FROM initiatives WHERE project_id = ?`, [projectId], (err, rows) => {
                resolve(rows || []);
            });
        });
    },

    getTasks: (projectId) => {
        return new Promise((resolve) => {
            deps.db.all(`SELECT * FROM tasks WHERE project_id = ?`, [projectId], (err, rows) => {
                resolve(rows || []);
            });
        });
    },

    getMilestones: (projectId) => {
        return new Promise((resolve) => {
            deps.db.all(`SELECT * FROM milestones WHERE project_id = ?`, [projectId], (err, rows) => {
                resolve(rows || []);
            });
        });
    },

    getResources: (projectId) => {
        return new Promise((resolve) => {
            deps.db.all(`
                SELECT pm.*, u.first_name, u.last_name, u.email
                FROM project_members pm
                JOIN users u ON pm.user_id = u.id
                WHERE pm.project_id = ?
            `, [projectId], (err, rows) => {
                resolve(rows || []);
            });
        });
    },

    getRecentActivities: (projectId) => {
        return new Promise((resolve) => {
            deps.db.all(`
                SELECT * FROM activity_logs 
                WHERE entity_id = ? OR new_value LIKE ?
                ORDER BY created_at DESC
                LIMIT 100
            `, [projectId, `%${projectId}%`], (err, rows) => {
                resolve(rows || []);
            });
        });
    },

    /**
     * Analyze schedule for potential slips
     */
    analyzeSchedule: async (projectData) => {
        const { tasks = [], milestones = [] } = projectData;
        const now = new Date();
        
        // Check overdue tasks
        const overdueTasks = tasks.filter(t => 
            t.due_date && new Date(t.due_date) < now && t.status !== 'completed'
        );
        
        // Check overdue milestones
        const overdueMilestones = milestones.filter(m =>
            m.target_date && new Date(m.target_date) < now && m.status !== 'completed'
        );

        // Check velocity (tasks completed vs planned)
        const completedTasks = tasks.filter(t => t.status === 'completed').length;
        const totalTasks = tasks.length;
        const completionRate = totalTasks > 0 ? completedTasks / totalTasks : 0;

        // Calculate probability
        let probability = 0;
        if (overdueMilestones.length > 0) probability += 0.4;
        if (overdueTasks.length > 5) probability += 0.3;
        else if (overdueTasks.length > 0) probability += overdueTasks.length * 0.05;
        if (completionRate < 0.3 && totalTasks > 10) probability += 0.2;

        probability = Math.min(probability, 1);

        if (probability >= THRESHOLDS.ATTENTION) {
            return {
                id: uuidv4(),
                type: SIGNAL_TYPES.SCHEDULE_SLIP,
                probability,
                severity: PredictiveService.getSeverity(probability),
                title: 'Schedule Slip Risk',
                description: `${overdueTasks.length} overdue tasks, ${overdueMilestones.length} overdue milestones`,
                indicators: [
                    { name: 'Overdue Tasks', value: overdueTasks.length },
                    { name: 'Overdue Milestones', value: overdueMilestones.length },
                    { name: 'Completion Rate', value: `${Math.round(completionRate * 100)}%` }
                ],
                recommendations: [
                    'Review and reprioritize overdue items',
                    'Consider scope reduction if resources are constrained',
                    'Update stakeholders on timeline adjustments'
                ]
            };
        }

        return null;
    },

    /**
     * Analyze budget for overrun risk
     */
    analyzeBudget: async (projectData) => {
        // Simplified - in production, integrate with actual financial data
        const budgetData = projectData.budget ? JSON.parse(projectData.budget) : null;
        
        if (!budgetData || !budgetData.allocated) return null;

        const { allocated, spent = 0, forecasted = 0 } = budgetData;
        const burnRate = spent / allocated;
        const forecastOverrun = forecasted > allocated;

        let probability = 0;
        if (burnRate > 0.8 && projectData.progress < 80) probability += 0.4;
        if (burnRate > 1.0) probability += 0.3;
        if (forecastOverrun) probability += 0.2;

        probability = Math.min(probability, 1);

        if (probability >= THRESHOLDS.ATTENTION) {
            return {
                id: uuidv4(),
                type: SIGNAL_TYPES.BUDGET_OVERRUN,
                probability,
                severity: PredictiveService.getSeverity(probability),
                title: 'Budget Overrun Risk',
                description: `Current burn rate: ${Math.round(burnRate * 100)}% with ${Math.round(projectData.progress || 0)}% completion`,
                indicators: [
                    { name: 'Budget Used', value: `${Math.round(burnRate * 100)}%` },
                    { name: 'Project Progress', value: `${Math.round(projectData.progress || 0)}%` },
                    { name: 'Forecast Variance', value: forecastOverrun ? 'Over Budget' : 'On Track' }
                ],
                recommendations: [
                    'Review and optimize resource allocation',
                    'Identify cost reduction opportunities',
                    'Consider scope adjustments to stay within budget'
                ]
            };
        }

        return null;
    },

    /**
     * Analyze resource constraints
     */
    analyzeResources: async (projectData) => {
        const { resources = [], tasks = [] } = projectData;
        
        if (resources.length === 0) return null;

        // Calculate workload per resource
        const workload = {};
        for (const task of tasks.filter(t => t.status !== 'completed' && t.assignee_id)) {
            workload[task.assignee_id] = (workload[task.assignee_id] || 0) + 1;
        }

        const avgWorkload = Object.values(workload).length > 0
            ? Object.values(workload).reduce((a, b) => a + b, 0) / Object.values(workload).length
            : 0;
        
        const overloadedResources = Object.entries(workload).filter(([_, count]) => count > 10);
        const unassignedTasks = tasks.filter(t => !t.assignee_id && t.status !== 'completed');

        let probability = 0;
        if (overloadedResources.length > 0) probability += 0.3;
        if (unassignedTasks.length > 5) probability += 0.2;
        if (avgWorkload > 8) probability += 0.2;

        probability = Math.min(probability, 1);

        if (probability >= THRESHOLDS.ATTENTION) {
            return {
                id: uuidv4(),
                type: SIGNAL_TYPES.RESOURCE_CONSTRAINT,
                probability,
                severity: PredictiveService.getSeverity(probability),
                title: 'Resource Constraint Risk',
                description: `${overloadedResources.length} overloaded team members, ${unassignedTasks.length} unassigned tasks`,
                indicators: [
                    { name: 'Overloaded Resources', value: overloadedResources.length },
                    { name: 'Unassigned Tasks', value: unassignedTasks.length },
                    { name: 'Avg Tasks per Person', value: Math.round(avgWorkload) }
                ],
                recommendations: [
                    'Redistribute workload across team',
                    'Consider bringing in additional resources',
                    'Prioritize and defer non-critical tasks'
                ]
            };
        }

        return null;
    },

    /**
     * Analyze stakeholder engagement
     */
    analyzeStakeholderEngagement: async (projectData) => {
        const { activities = [] } = projectData;
        const now = new Date();
        const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

        // Check activity frequency
        const recentActivities = activities.filter(a => 
            new Date(a.created_at) > thirtyDaysAgo
        );

        // Check for decision activities (approvals, reviews)
        const decisionActivities = recentActivities.filter(a =>
            a.action === 'approved' || a.action === 'reviewed' || a.action === 'decision'
        );

        let probability = 0;
        if (recentActivities.length < 10) probability += 0.3;
        if (decisionActivities.length === 0) probability += 0.3;
        if (recentActivities.length === 0) probability += 0.3;

        probability = Math.min(probability, 1);

        if (probability >= THRESHOLDS.ATTENTION) {
            return {
                id: uuidv4(),
                type: SIGNAL_TYPES.STAKEHOLDER_DISENGAGEMENT,
                probability,
                severity: PredictiveService.getSeverity(probability),
                title: 'Stakeholder Disengagement Risk',
                description: `Low activity in last 30 days. ${recentActivities.length} activities, ${decisionActivities.length} decisions.`,
                indicators: [
                    { name: 'Recent Activities', value: recentActivities.length },
                    { name: 'Decisions Made', value: decisionActivities.length },
                    { name: 'Days Since Last Activity', value: recentActivities.length > 0 
                        ? Math.floor((now - new Date(recentActivities[0].created_at)) / (24 * 60 * 60 * 1000))
                        : 'N/A' }
                ],
                recommendations: [
                    'Schedule stakeholder check-in meeting',
                    'Send progress update communication',
                    'Identify and address potential concerns'
                ]
            };
        }

        return null;
    },

    /**
     * Analyze adoption risk
     */
    analyzeAdoptionRisk: async (projectData) => {
        const { initiatives = [] } = projectData;
        
        // Check change management initiatives
        const changeInitiatives = initiatives.filter(i =>
            i.category === 'change_management' || 
            i.name?.toLowerCase().includes('training') ||
            i.name?.toLowerCase().includes('adoption')
        );

        const hasChangeManagement = changeInitiatives.length > 0;
        const changeProgress = changeInitiatives.length > 0
            ? changeInitiatives.reduce((sum, i) => sum + (i.progress || 0), 0) / changeInitiatives.length
            : 0;

        let probability = 0;
        if (!hasChangeManagement) probability += 0.5;
        else if (changeProgress < 30) probability += 0.3;

        probability = Math.min(probability, 1);

        if (probability >= THRESHOLDS.ATTENTION) {
            return {
                id: uuidv4(),
                type: SIGNAL_TYPES.ADOPTION_RISK,
                probability,
                severity: PredictiveService.getSeverity(probability),
                title: 'User Adoption Risk',
                description: hasChangeManagement 
                    ? `Change management at ${Math.round(changeProgress)}% progress`
                    : 'No change management initiatives identified',
                indicators: [
                    { name: 'Change Initiatives', value: changeInitiatives.length },
                    { name: 'Change Progress', value: `${Math.round(changeProgress)}%` },
                    { name: 'Has Training Plan', value: hasChangeManagement ? 'Yes' : 'No' }
                ],
                recommendations: [
                    'Develop comprehensive change management plan',
                    'Identify change champions in affected teams',
                    'Plan user training and communication'
                ]
            };
        }

        return null;
    },

    /**
     * Analyze dependencies
     */
    analyzeDependencies: async (projectData) => {
        const { initiatives = [] } = projectData;
        
        // Check for blocked initiatives
        const blockedInitiatives = initiatives.filter(i => 
            i.status === 'blocked' || i.is_blocked
        );

        // Check external dependencies
        const externalDeps = initiatives.filter(i =>
            i.dependencies && JSON.parse(i.dependencies || '[]').some(d => d.external)
        );

        let probability = 0;
        if (blockedInitiatives.length > 0) probability += 0.3 * blockedInitiatives.length;
        if (externalDeps.length > 3) probability += 0.2;

        probability = Math.min(probability, 1);

        if (probability >= THRESHOLDS.ATTENTION) {
            return {
                id: uuidv4(),
                type: SIGNAL_TYPES.DEPENDENCY_FAILURE,
                probability,
                severity: PredictiveService.getSeverity(probability),
                title: 'Dependency Risk',
                description: `${blockedInitiatives.length} blocked initiatives, ${externalDeps.length} external dependencies`,
                indicators: [
                    { name: 'Blocked Items', value: blockedInitiatives.length },
                    { name: 'External Dependencies', value: externalDeps.length }
                ],
                recommendations: [
                    'Escalate and resolve blocked items',
                    'Review external dependency timelines',
                    'Develop contingency plans for critical dependencies'
                ]
            };
        }

        return null;
    },

    /**
     * Analyze team health
     */
    analyzeTeamHealth: async (projectData) => {
        const { resources = [], activities = [] } = projectData;
        const now = new Date();
        const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

        // Check activity per team member
        const memberActivity = {};
        for (const activity of activities.filter(a => new Date(a.created_at) > weekAgo)) {
            if (activity.user_id) {
                memberActivity[activity.user_id] = (memberActivity[activity.user_id] || 0) + 1;
            }
        }

        const inactiveMembers = resources.filter(r => !memberActivity[r.user_id]);
        
        let probability = 0;
        if (inactiveMembers.length > resources.length * 0.5) probability += 0.4;
        if (resources.length > 0 && Object.keys(memberActivity).length < resources.length * 0.3) probability += 0.3;

        probability = Math.min(probability, 1);

        if (probability >= THRESHOLDS.ATTENTION) {
            return {
                id: uuidv4(),
                type: SIGNAL_TYPES.TEAM_BURNOUT,
                probability,
                severity: PredictiveService.getSeverity(probability),
                title: 'Team Health Concern',
                description: `${inactiveMembers.length} team members with no recent activity`,
                indicators: [
                    { name: 'Inactive Members', value: inactiveMembers.length },
                    { name: 'Total Team Size', value: resources.length },
                    { name: 'Active This Week', value: Object.keys(memberActivity).length }
                ],
                recommendations: [
                    'Check in with inactive team members',
                    'Review workload distribution',
                    'Consider team capacity and wellbeing'
                ]
            };
        }

        return null;
    },

    /**
     * Predict project success
     */
    predictProjectSuccess: (projectData, signals) => {
        // Base success rate
        let successProbability = 0.7;

        // Adjust based on signals
        for (const signal of signals) {
            successProbability -= signal.probability * 0.1;
        }

        // Adjust based on progress
        const progress = projectData.progress || 0;
        if (progress > 50) successProbability += 0.1;
        if (progress > 80) successProbability += 0.1;

        // Clamp
        successProbability = Math.max(0.1, Math.min(0.95, successProbability));

        return {
            probability: successProbability,
            confidence: 0.7, // Model confidence
            factors: {
                activeSignals: signals.length,
                progress,
                baseRate: 0.7
            }
        };
    },

    /**
     * Predict timeline completion
     */
    predictTimelineCompletion: (projectData) => {
        const { tasks = [], progress = 0 } = projectData;
        const now = new Date();
        const endDate = projectData.target_end_date ? new Date(projectData.target_end_date) : null;
        
        if (!endDate) {
            return { onTrack: 'unknown', confidence: 0.3 };
        }

        const daysRemaining = Math.ceil((endDate - now) / (24 * 60 * 60 * 1000));
        const remainingProgress = 100 - progress;
        
        // Simple linear projection
        const requiredDailyProgress = remainingProgress / Math.max(daysRemaining, 1);
        
        // Historical daily progress (simplified)
        const historicalDailyProgress = progress / Math.max(
            Math.ceil((now - new Date(projectData.created_at)) / (24 * 60 * 60 * 1000)),
            1
        );

        const onTrack = historicalDailyProgress >= requiredDailyProgress;
        const projectedDelay = onTrack ? 0 : Math.ceil(remainingProgress / historicalDailyProgress) - daysRemaining;

        return {
            onTrack,
            daysRemaining,
            projectedDelay: Math.max(0, projectedDelay),
            requiredDailyProgress,
            historicalDailyProgress,
            confidence: 0.6
        };
    },

    /**
     * Predict ROI achievement
     */
    predictROIAchievement: (projectData) => {
        // Simplified - would integrate with economics data in production
        const progress = projectData.progress || 0;
        const hasROIData = projectData.expected_roi != null;

        if (!hasROIData) {
            return { achievable: 'unknown', confidence: 0.3 };
        }

        const expectedROI = projectData.expected_roi;
        const adjustedROI = expectedROI * (progress / 100) * 0.8; // Conservative adjustment

        return {
            expectedROI,
            projectedROI: adjustedROI,
            achievable: adjustedROI >= expectedROI * 0.7, // 70% of expected is considered success
            confidence: 0.5
        };
    },

    /**
     * Calculate overall risk level
     */
    calculateOverallRisk: (signals) => {
        if (signals.length === 0) return { level: 'low', score: 0 };

        const avgProbability = signals.reduce((sum, s) => sum + s.probability, 0) / signals.length;
        const maxProbability = Math.max(...signals.map(s => s.probability));

        // Weighted combination
        const score = avgProbability * 0.6 + maxProbability * 0.4;

        let level;
        if (score >= THRESHOLDS.CRITICAL) level = 'critical';
        else if (score >= THRESHOLDS.WARNING) level = 'high';
        else if (score >= THRESHOLDS.ATTENTION) level = 'medium';
        else level = 'low';

        return { level, score, signalCount: signals.length };
    },

    /**
     * Get severity label from probability
     */
    getSeverity: (probability) => {
        if (probability >= THRESHOLDS.CRITICAL) return 'critical';
        if (probability >= THRESHOLDS.WARNING) return 'high';
        if (probability >= THRESHOLDS.ATTENTION) return 'medium';
        return 'low';
    },

    /**
     * Generate actionable recommendations
     */
    generateRecommendations: (signals, predictions) => {
        const recommendations = [];

        // Priority recommendations based on signals
        for (const signal of signals.slice(0, 3)) {
            recommendations.push({
                priority: signal.severity === 'critical' ? 1 : signal.severity === 'high' ? 2 : 3,
                area: signal.type,
                action: signal.recommendations?.[0] || 'Review and address this risk',
                rationale: signal.description
            });
        }

        // Add prediction-based recommendations
        if (predictions.projectSuccess?.probability < 0.5) {
            recommendations.push({
                priority: 1,
                area: 'overall',
                action: 'Conduct project health review with leadership',
                rationale: `Project success probability at ${Math.round(predictions.projectSuccess.probability * 100)}%`
            });
        }

        // Sort by priority
        recommendations.sort((a, b) => a.priority - b.priority);

        return recommendations.slice(0, 5);
    },

    /**
     * Store analysis in database
     */
    storeAnalysis: async (projectId, analysis) => {
        return new Promise((resolve, reject) => {
            deps.db.run(`
                INSERT INTO predictive_analyses (id, project_id, signals, predictions, overall_risk, analyzed_at)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `, [
                uuidv4(),
                projectId,
                JSON.stringify(analysis.signals),
                JSON.stringify(analysis.predictions),
                JSON.stringify(analysis.overallRisk || {})
            ], function(err) {
                if (err) {
                    console.error('[Predictive] Store analysis error:', err);
                }
                resolve();
            });
        });
    },

    /**
     * Get historical analyses for a project
     */
    getHistoricalAnalyses: async (projectId, limit = 10) => {
        return new Promise((resolve) => {
            deps.db.all(`
                SELECT * FROM predictive_analyses 
                WHERE project_id = ?
                ORDER BY analyzed_at DESC
                LIMIT ?
            `, [projectId, limit], (err, rows) => {
                if (err) return resolve([]);
                resolve((rows || []).map(r => ({
                    ...r,
                    signals: JSON.parse(r.signals || '[]'),
                    predictions: JSON.parse(r.predictions || '{}'),
                    overallRisk: JSON.parse(r.overall_risk || '{}')
                })));
            });
        });
    },

    /**
     * Initialize database tables
     */
    initialize: async () => {
        return new Promise((resolve, reject) => {
            deps.db.run(`
                CREATE TABLE IF NOT EXISTS predictive_analyses (
                    id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL,
                    signals TEXT,
                    predictions TEXT,
                    overall_risk TEXT,
                    analyzed_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) return reject(err);
                deps.db.run(`CREATE INDEX IF NOT EXISTS idx_pa_project ON predictive_analyses(project_id)`, resolve);
            });
        });
    }
};

export default PredictiveService;






