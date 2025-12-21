/**
 * AI Workload Intelligence Service
 * 
 * Portfolio-wide workload visibility and capacity management.
 * AI suggests rebalancing but NEVER reassigns automatically.
 * 
 * "This is the killer feature traditional PMO tools don't have."
 */

// Dependency injection container (for deterministic unit tests)
const deps = {
    db: require('../database'),
    uuidv4: require('uuid').v4
};

// Workload status levels
const WORKLOAD_STATUS = {
    UNDERUTILIZED: 'underutilized',   // < 50%
    OPTIMAL: 'optimal',               // 50-80%
    HIGH: 'high',                     // 80-100%
    OVERLOADED: 'overloaded',         // 100-120%
    CRITICAL: 'critical'              // > 120%
};

// Burnout risk levels
const BURNOUT_RISK = {
    LOW: 'low',
    MODERATE: 'moderate',
    HIGH: 'high',
    CRITICAL: 'critical'
};

const AIWorkloadIntelligence = {
    WORKLOAD_STATUS,
    BURNOUT_RISK,

    // For testing: allow overriding dependencies
    setDependencies: (newDeps = {}) => {
        Object.assign(deps, newDeps);
    },

    // ==========================================
    // PORTFOLIO-WIDE WORKLOAD
    // ==========================================

    /**
     * Get organization-wide workload overview
     */
    getPortfolioWorkload: async (organizationId) => {
        // Get all users in organization with their task counts
        const users = await new Promise((resolve, reject) => {
            deps.db.all(`
                SELECT 
                    u.id, u.first_name, u.last_name, u.role,
                    COUNT(DISTINCT t.id) as active_tasks,
                    COUNT(DISTINCT i.id) as active_initiatives,
                    SUM(CASE WHEN t.status = 'BLOCKED' THEN 1 ELSE 0 END) as blocked_tasks,
                    SUM(CASE WHEN t.due_date < date('now') AND t.status NOT IN ('done', 'DONE') THEN 1 ELSE 0 END) as overdue_tasks
                FROM users u
                LEFT JOIN tasks t ON u.id = t.assignee_id AND t.status NOT IN ('done', 'DONE', 'cancelled')
                LEFT JOIN initiatives i ON u.id = i.owner_business_id AND i.status IN ('IN_EXECUTION', 'APPROVED')
                WHERE u.organization_id = ?
                GROUP BY u.id
            `, [organizationId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        // Get capacity profiles
        const capacityProfiles = await new Promise((resolve) => {
            deps.db.all(`SELECT * FROM user_capacity_profile WHERE organization_id = ?`, [organizationId], (err, rows) => {
                resolve((rows || []).reduce((acc, p) => { acc[p.user_id] = p; return acc; }, {}));
            });
        });

        // Calculate workload for each user
        const userWorkloads = users.map(user => {
            const profile = capacityProfiles[user.id] || { default_weekly_hours: 40 };
            const estimatedHours = (user.active_tasks * 4) + (user.active_initiatives * 2); // Simple estimation
            const utilization = Math.round((estimatedHours / profile.default_weekly_hours) * 100);

            return {
                userId: user.id,
                userName: `${user.first_name} ${user.last_name}`,
                role: user.role,
                activeTasks: user.active_tasks,
                activeInitiatives: user.active_initiatives,
                blockedTasks: user.blocked_tasks,
                overdueTasks: user.overdue_tasks,
                estimatedHoursPerWeek: estimatedHours,
                availableHours: profile.default_weekly_hours,
                utilizationPercent: utilization,
                status: AIWorkloadIntelligence._getWorkloadStatus(utilization),
                burnoutRisk: AIWorkloadIntelligence._calculateBurnoutRisk(utilization, user.overdue_tasks, user.blocked_tasks)
            };
        });

        // Summary statistics
        const summary = {
            totalUsers: userWorkloads.length,
            overloaded: userWorkloads.filter(u => u.status === WORKLOAD_STATUS.OVERLOADED || u.status === WORKLOAD_STATUS.CRITICAL).length,
            underutilized: userWorkloads.filter(u => u.status === WORKLOAD_STATUS.UNDERUTILIZED).length,
            optimal: userWorkloads.filter(u => u.status === WORKLOAD_STATUS.OPTIMAL).length,
            highBurnoutRisk: userWorkloads.filter(u => u.burnoutRisk === BURNOUT_RISK.HIGH || u.burnoutRisk === BURNOUT_RISK.CRITICAL).length,
            avgUtilization: Math.round(userWorkloads.reduce((sum, u) => sum + u.utilizationPercent, 0) / (userWorkloads.length || 1))
        };

        return {
            organizationId,
            summary,
            users: userWorkloads,
            alerts: AIWorkloadIntelligence._generateWorkloadAlerts(userWorkloads)
        };
    },

    /**
     * Get workload status label
     */
    _getWorkloadStatus: (utilizationPercent) => {
        if (utilizationPercent < 50) return WORKLOAD_STATUS.UNDERUTILIZED;
        if (utilizationPercent <= 80) return WORKLOAD_STATUS.OPTIMAL;
        if (utilizationPercent <= 100) return WORKLOAD_STATUS.HIGH;
        if (utilizationPercent <= 120) return WORKLOAD_STATUS.OVERLOADED;
        return WORKLOAD_STATUS.CRITICAL;
    },

    /**
     * Calculate burnout risk score
     */
    _calculateBurnoutRisk: (utilization, overdueTasks, blockedTasks) => {
        let riskScore = 0;

        // Utilization factor
        if (utilization > 120) riskScore += 40;
        else if (utilization > 100) riskScore += 25;
        else if (utilization > 90) riskScore += 10;

        // Overdue factor (stress from missed deadlines)
        riskScore += Math.min(30, overdueTasks * 5);

        // Blocked factor (frustration from obstacles)
        riskScore += Math.min(20, blockedTasks * 4);

        if (riskScore >= 60) return BURNOUT_RISK.CRITICAL;
        if (riskScore >= 40) return BURNOUT_RISK.HIGH;
        if (riskScore >= 20) return BURNOUT_RISK.MODERATE;
        return BURNOUT_RISK.LOW;
    },

    /**
     * Generate workload alerts
     */
    _generateWorkloadAlerts: (userWorkloads) => {
        const alerts = [];

        const critical = userWorkloads.filter(u => u.status === WORKLOAD_STATUS.CRITICAL);
        if (critical.length > 0) {
            alerts.push({
                severity: 'critical',
                message: `${critical.length} team member(s) at critical workload levels`,
                users: critical.map(u => u.userName)
            });
        }

        const highBurnout = userWorkloads.filter(u => u.burnoutRisk === BURNOUT_RISK.HIGH || u.burnoutRisk === BURNOUT_RISK.CRITICAL);
        if (highBurnout.length > 0) {
            alerts.push({
                severity: 'warning',
                message: `${highBurnout.length} team member(s) at elevated burnout risk`,
                users: highBurnout.map(u => u.userName)
            });
        }

        const underutilized = userWorkloads.filter(u => u.status === WORKLOAD_STATUS.UNDERUTILIZED);
        if (underutilized.length > 2) {
            alerts.push({
                severity: 'info',
                message: `${underutilized.length} team member(s) may have capacity for more work`,
                users: underutilized.map(u => u.userName)
            });
        }

        return alerts;
    },

    // ==========================================
    // OVER-ALLOCATION DETECTION
    // ==========================================

    /**
     * Detect over-allocation patterns in a project
     * OPTIMIZED: Eliminated N+1 queries by using batch operations
     */
    detectOverAllocation: async (projectId) => {
        // Get users with tasks in project
        const projectUsers = await new Promise((resolve, reject) => {
            deps.db.all(`
                SELECT DISTINCT 
                    u.id, u.first_name, u.last_name,
                    COUNT(t.id) as task_count
                FROM tasks t
                JOIN users u ON t.assignee_id = u.id
                WHERE t.project_id = ?
                AND t.status NOT IN ('done', 'DONE', 'cancelled')
                GROUP BY u.id
            `, [projectId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        if (projectUsers.length === 0) {
            return {
                projectId,
                usersAnalyzed: 0,
                overAllocatedUsers: [],
                hasOverAllocation: false,
                severity: 'low'
            };
        }

        const userIds = projectUsers.map(u => u.id);
        const placeholders = userIds.map(() => '?').join(',');

        // OPTIMIZATION: Batch fetch all weekly tasks for all users in one query
        const allWeeklyTasks = await new Promise((resolve, reject) => {
            deps.db.all(`
                SELECT 
                    assignee_id,
                    strftime('%Y-%W', due_date) as week,
                    SUM(effort_estimate) as effort
                FROM tasks
                WHERE assignee_id IN (${placeholders})
                AND project_id = ?
                AND status NOT IN ('done', 'DONE', 'cancelled')
                AND due_date IS NOT NULL
                GROUP BY assignee_id, strftime('%Y-%W', due_date)
            `, [...userIds, projectId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        // OPTIMIZATION: Batch fetch all capacity profiles in one query
        const allProfiles = await new Promise((resolve, reject) => {
            deps.db.all(`
                SELECT user_id, default_weekly_hours 
                FROM user_capacity_profile 
                WHERE user_id IN (${placeholders})
            `, userIds, (err, rows) => {
                if (err) reject(err);
                else {
                    // Create a map for quick lookup
                    const profileMap = {};
                    (rows || []).forEach(row => {
                        profileMap[row.user_id] = row.default_weekly_hours || 40;
                    });
                    // Fill in defaults for users without profiles
                    userIds.forEach(id => {
                        if (!profileMap[id]) {
                            profileMap[id] = 40;
                        }
                    });
                    resolve(profileMap);
                }
            });
        });

        // Group weekly tasks by user
        const weeklyTasksByUser = {};
        allWeeklyTasks.forEach(wt => {
            if (!weeklyTasksByUser[wt.assignee_id]) {
                weeklyTasksByUser[wt.assignee_id] = [];
            }
            weeklyTasksByUser[wt.assignee_id].push({
                week: wt.week,
                effort: wt.effort || 0
            });
        });

        // Process each user
        const overAllocated = [];
        for (const user of projectUsers) {
            const weeklyTasks = weeklyTasksByUser[user.id] || [];
            const weeklyCapacity = allProfiles[user.id] || 40;

            const overloadedWeeks = weeklyTasks.filter(w => w.effort > weeklyCapacity);

            if (overloadedWeeks.length > 0) {
                overAllocated.push({
                    userId: user.id,
                    userName: `${user.first_name} ${user.last_name}`,
                    totalTasks: user.task_count,
                    totalEffort: 0, // Could be calculated if needed
                    weeklyCapacity: weeklyCapacity,
                    overloadedWeeks: overloadedWeeks.length,
                    worstWeek: overloadedWeeks.reduce((max, w) => w.effort > (max.effort || 0) ? w : max, {})
                });
            }
        }

        return {
            projectId,
            usersAnalyzed: projectUsers.length,
            overAllocatedUsers: overAllocated,
            hasOverAllocation: overAllocated.length > 0,
            severity: overAllocated.length > 3 ? 'high' : overAllocated.length > 0 ? 'medium' : 'low'
        };
    },

    // ==========================================
    // REBALANCING SUGGESTIONS
    // ==========================================

    /**
     * Suggest rebalancing options (AI suggests, never reassigns)
     */
    suggestRebalancing: async (projectId) => {
        const overAllocation = await AIWorkloadIntelligence.detectOverAllocation(projectId);

        if (!overAllocation.hasOverAllocation) {
            return {
                projectId,
                suggestionsNeeded: false,
                message: 'No rebalancing needed - workload is balanced'
            };
        }

        // Find users with capacity
        const usersWithCapacity = await new Promise((resolve) => {
            deps.db.all(`
                SELECT 
                    u.id, u.first_name, u.last_name,
                    COUNT(t.id) as task_count,
                    COALESCE(ucp.default_weekly_hours, 40) as capacity
                FROM users u
                JOIN tasks t2 ON t2.project_id = ?
                LEFT JOIN tasks t ON u.id = t.assignee_id AND t.status NOT IN ('done', 'DONE', 'cancelled')
                LEFT JOIN user_capacity_profile ucp ON u.id = ucp.user_id
                WHERE u.id IN (SELECT DISTINCT assignee_id FROM tasks WHERE project_id = ?)
                GROUP BY u.id
                HAVING (COUNT(t.id) * 4) < (COALESCE(ucp.default_weekly_hours, 40) * 0.7)
            `, [projectId, projectId], (err, rows) => resolve(rows || []));
        });

        const suggestions = [];

        for (const overloaded of overAllocation.overAllocatedUsers) {
            // Get tasks that could be reassigned
            const reassignableTasks = await new Promise((resolve) => {
                deps.db.all(`
                    SELECT id, title, priority, effort_estimate, due_date
                    FROM tasks
                    WHERE assignee_id = ? AND project_id = ?
                    AND status NOT IN ('done', 'DONE', 'cancelled', 'in_progress')
                    ORDER BY priority DESC, due_date ASC
                    LIMIT 5
                `, [overloaded.userId, projectId], (err, rows) => resolve(rows || []));
            });

            for (const task of reassignableTasks) {
                const candidates = usersWithCapacity
                    .filter(u => u.id !== overloaded.userId)
                    .slice(0, 3);

                if (candidates.length > 0) {
                    suggestions.push({
                        type: 'reassign',
                        task: {
                            id: task.id,
                            title: task.title,
                            effort: task.effort_estimate
                        },
                        from: {
                            id: overloaded.userId,
                            name: overloaded.userName,
                            currentLoad: `${overloaded.totalTasks} tasks`
                        },
                        to: candidates.map(c => ({
                            id: c.id,
                            name: `${c.first_name} ${c.last_name}`,
                            currentLoad: `${c.task_count} tasks`
                        })),
                        reason: `${overloaded.userName} is overloaded with ${overloaded.overloadedWeeks} weeks above capacity`
                    });
                }
            }
        }

        return {
            projectId,
            suggestionsNeeded: true,
            overloadedUsers: overAllocation.overAllocatedUsers.length,
            usersWithCapacity: usersWithCapacity.length,
            suggestions,
            disclaimer: 'These are AI suggestions only. Reassignment requires human approval.',
            canAutoReassign: false // AI NEVER reassigns automatically
        };
    },

    // ==========================================
    // UNREALISTIC TIMELINE DETECTION
    // ==========================================

    /**
     * Flag unrealistic timelines
     */
    detectUnrealisticTimelines: async (projectId) => {
        const issues = [];

        // 1. Check for compressed timelines (too much work in short period)
        const upcomingWork = await new Promise((resolve) => {
            deps.db.all(`
                SELECT 
                    strftime('%Y-%W', due_date) as week,
                    COUNT(*) as task_count,
                    SUM(effort_estimate) as total_effort,
                    COUNT(DISTINCT assignee_id) as assignees
                FROM tasks
                WHERE project_id = ?
                AND status NOT IN ('done', 'DONE', 'cancelled')
                AND due_date BETWEEN date('now') AND date('now', '+14 days')
                GROUP BY strftime('%Y-%W', due_date)
            `, [projectId], (err, rows) => resolve(rows || []));
        });

        for (const week of upcomingWork) {
            const avgEffortPerPerson = week.total_effort / (week.assignees || 1);
            if (avgEffortPerPerson > 50) { // More than 50 hours per person per week
                issues.push({
                    type: 'compressed_timeline',
                    week: week.week,
                    severity: avgEffortPerPerson > 80 ? 'critical' : 'high',
                    message: `Week ${week.week}: ${week.task_count} tasks, ${Math.round(avgEffortPerPerson)}h/person average`,
                    suggestion: 'Consider spreading tasks or adding resources'
                });
            }
        }

        // 2. Check for tasks with no effort estimate but tight deadlines
        const underestimated = await new Promise((resolve) => {
            deps.db.all(`
                SELECT id, title, due_date
                FROM tasks
                WHERE project_id = ?
                AND (effort_estimate IS NULL OR effort_estimate = 0)
                AND due_date BETWEEN date('now') AND date('now', '+7 days')
                AND status NOT IN ('done', 'DONE', 'cancelled')
            `, [projectId], (err, rows) => resolve(rows || []));
        });

        if (underestimated.length > 0) {
            issues.push({
                type: 'missing_estimates',
                severity: 'medium',
                message: `${underestimated.length} tasks due within 7 days have no effort estimate`,
                tasks: underestimated.map(t => ({ id: t.id, title: t.title })),
                suggestion: 'Add effort estimates to improve capacity planning'
            });
        }

        // 3. Check for milestone compression
        const milestones = await new Promise((resolve) => {
            deps.db.all(`
                SELECT i.id, i.name, i.target_date, 
                    COUNT(t.id) as remaining_tasks,
                    SUM(t.effort_estimate) as remaining_effort
                FROM initiatives i
                LEFT JOIN tasks t ON i.id = t.initiative_id AND t.status NOT IN ('done', 'DONE', 'cancelled')
                WHERE i.project_id = ?
                AND i.target_date < date('now', '+30 days')
                AND i.status IN ('IN_EXECUTION', 'APPROVED')
                GROUP BY i.id
            `, [projectId], (err, rows) => resolve(rows || []));
        });

        for (const milestone of milestones) {
            if (!milestone.target_date) continue;

            const daysRemaining = Math.max(1, Math.floor((new Date(milestone.target_date) - Date.now()) / (1000 * 60 * 60 * 24)));
            const effortPerDay = (milestone.remaining_effort || 0) / daysRemaining;

            if (effortPerDay > 16) { // More than 2 full days of work per calendar day
                issues.push({
                    type: 'milestone_risk',
                    severity: effortPerDay > 40 ? 'critical' : 'high',
                    initiative: milestone.name,
                    targetDate: milestone.target_date,
                    daysRemaining,
                    remainingTasks: milestone.remaining_tasks,
                    message: `Initiative "${milestone.name}" requires ${Math.round(effortPerDay)}h/day to meet deadline`,
                    suggestion: 'Review scope or extend timeline'
                });
            }
        }

        return {
            projectId,
            unrealisticCount: issues.length,
            issues,
            overallAssessment: issues.some(i => i.severity === 'critical') ? 'critical' :
                issues.some(i => i.severity === 'high') ? 'at_risk' : 'feasible'
        };
    },

    // ==========================================
    // WORKLOAD SNAPSHOTS
    // ==========================================

    /**
     * Take workload snapshot for trend analysis
     */
    takeSnapshot: async (userId, projectId = null) => {
        // Calculate current workload
        const workload = await new Promise((resolve) => {
            let sql = `
                SELECT 
                    COUNT(*) as task_count,
                    SUM(effort_estimate) as total_effort,
                    COUNT(DISTINCT initiative_id) as initiative_count
                FROM tasks
                WHERE assignee_id = ?
                AND status NOT IN ('done', 'DONE', 'cancelled')
            `;
            const params = [userId];

            if (projectId) {
                sql += ` AND project_id = ?`;
                params.push(projectId);
            }

            db.get(sql, params, (err, row) => resolve(row || { task_count: 0, total_effort: 0, initiative_count: 0 }));
        });

        // Get capacity profile
        const profile = await new Promise((resolve) => {
            deps.db.get(`SELECT * FROM user_capacity_profile WHERE user_id = ?`, [userId], (err, row) => {
                resolve(row || { default_weekly_hours: 40 });
            });
        });

        const allocatedHours = workload.total_effort || (workload.task_count * 4);
        const availableHours = profile.default_weekly_hours;
        const utilization = Math.round((allocatedHours / availableHours) * 100);
        const burnoutRisk = AIWorkloadIntelligence._calculateBurnoutRisk(utilization, 0, 0);

        // Get previous snapshot for trend
        const previous = await new Promise((resolve) => {
            deps.db.get(`
                SELECT utilization_percent FROM workload_snapshots
                WHERE user_id = ? ${projectId ? 'AND project_id = ?' : ''}
                ORDER BY snapshot_date DESC LIMIT 1
            `, projectId ? [userId, projectId] : [userId], (err, row) => resolve(row));
        });

        const trend = previous
            ? (utilization > previous.utilization_percent + 10 ? 'worsening' :
                utilization < previous.utilization_percent - 10 ? 'improving' : 'stable')
            : 'stable';

        const id = uuidv4();
        const snapshotDate = new Date().toISOString().split('T')[0];

        await new Promise((resolve) => {
            db.run(`
                INSERT INTO workload_snapshots 
                (id, user_id, project_id, snapshot_date, allocated_hours, available_hours, utilization_percent, 
                 task_count, initiative_count, burnout_risk_score, is_overloaded, trend_direction)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                id, userId, projectId, snapshotDate, allocatedHours, availableHours, utilization,
                workload.task_count, workload.initiative_count,
                burnoutRisk === BURNOUT_RISK.CRITICAL ? 80 : burnoutRisk === BURNOUT_RISK.HIGH ? 60 : burnoutRisk === BURNOUT_RISK.MODERATE ? 40 : 20,
                utilization > 100 ? 1 : 0, trend
            ], resolve);
        });

        return {
            id,
            userId,
            projectId,
            snapshotDate,
            allocatedHours,
            availableHours,
            utilizationPercent: utilization,
            status: AIWorkloadIntelligence._getWorkloadStatus(utilization),
            burnoutRisk,
            trend
        };
    },

    /**
     * Get workload trend for a user
     */
    getWorkloadTrend: async (userId, days = 30) => {
        return new Promise((resolve, reject) => {
            deps.db.all(`
                SELECT * FROM workload_snapshots
                WHERE user_id = ?
                AND snapshot_date > date('now', '-${days} days')
                ORDER BY snapshot_date ASC
            `, [userId], (err, rows) => {
                if (err) reject(err);
                else {
                    const snapshots = rows || [];
                    const avgUtilization = snapshots.length > 0
                        ? Math.round(snapshots.reduce((sum, s) => sum + s.utilization_percent, 0) / snapshots.length)
                        : 0;

                    resolve({
                        userId,
                        periodDays: days,
                        snapshotCount: snapshots.length,
                        averageUtilization: avgUtilization,
                        trend: snapshots.length >= 2
                            ? (snapshots[snapshots.length - 1].utilization_percent > snapshots[0].utilization_percent + 15 ? 'increasing' :
                                snapshots[snapshots.length - 1].utilization_percent < snapshots[0].utilization_percent - 15 ? 'decreasing' : 'stable')
                            : 'insufficient_data',
                        snapshots
                    });
                }
            });
        });
    }
};

module.exports = AIWorkloadIntelligence;
