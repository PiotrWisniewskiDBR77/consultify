// Capacity Service - User workload management
// Step 4: Roadmap, Sequencing & Capacity

// Dependency injection container (for deterministic unit tests)
const deps = {
    db: require('../database'),
    uuidv4: require('uuid').v4
};

const CapacityService = {
    // For testing: allow overriding dependencies
    setDependencies: (newDeps = {}) => {
        Object.assign(deps, newDeps);
    },

    /**
     * Get user capacity for a week
     */
    getUserCapacity: async (userId, weekStart) => {
        return new Promise((resolve, reject) => {
            deps.db.get(`SELECT * FROM user_capacity WHERE user_id = ? AND week_start = ?`,
                [userId, weekStart], (err, row) => {
                    if (err) return reject(err);
                    if (!row) {
                        return resolve({
                            userId,
                            weekStart,
                            allocatedHours: 0,
                            availableHours: 40,
                            utilizationPercent: 0,
                            initiativeAllocations: [],
                            isOverloaded: false
                        });
                    }
                    try {
                        row.initiativeAllocations = JSON.parse(row.initiative_allocations || '[]');
                    } catch { row.initiativeAllocations = []; }
                    resolve(row);
                });
        });
    },

    /**
     * Calculate capacity from tasks
     */
    calculateUserCapacity: async (userId, projectId = null) => {
        // Get all active tasks for user in next 4 weeks
        const fourWeeksLater = new Date();
        fourWeeksLater.setDate(fourWeeksLater.getDate() + 28);

        const sql = `
            SELECT t.id, t.title, t.effort_estimate, t.due_date, t.initiative_id, i.name as initiative_name
            FROM tasks t
            LEFT JOIN initiatives i ON t.initiative_id = i.id
            WHERE t.assignee_id = ? 
              AND t.status NOT IN ('done', 'DONE')
              ${projectId ? 'AND t.project_id = ?' : ''}
        `;

        const params = projectId ? [userId, projectId] : [userId];

        return new Promise((resolve, reject) => {
            deps.db.all(sql, params, (err, tasks) => {
                if (err) return reject(err);

                // Group by week
                const weeklyCapacity = {};
                const today = new Date();
                const mondayThisWeek = new Date(today);
                mondayThisWeek.setDate(today.getDate() - today.getDay() + 1);
                mondayThisWeek.setHours(0, 0, 0, 0);

                // Initialize 4 weeks
                for (let i = 0; i < 4; i++) {
                    const weekStart = new Date(mondayThisWeek);
                    weekStart.setDate(weekStart.getDate() + (i * 7));
                    const key = weekStart.toISOString().split('T')[0];
                    weeklyCapacity[key] = {
                        weekStart: key,
                        allocatedHours: 0,
                        availableHours: 40,
                        initiativeAllocations: {},
                        tasks: []
                    };
                }

                // Distribute task effort across weeks
                (tasks || []).forEach(task => {
                    const effort = task.effort_estimate || 4; // Default 4 hours
                    const dueDate = task.due_date ? new Date(task.due_date) : new Date();

                    // Find which week this falls in
                    const weekKey = Object.keys(weeklyCapacity).find(wk => {
                        const ws = new Date(wk);
                        const we = new Date(ws);
                        we.setDate(we.getDate() + 7);
                        return dueDate >= ws && dueDate < we;
                    }) || Object.keys(weeklyCapacity)[0];

                    if (weeklyCapacity[weekKey]) {
                        weeklyCapacity[weekKey].allocatedHours += effort;
                        weeklyCapacity[weekKey].tasks.push(task.id);

                        // Track by initiative
                        const initId = task.initiative_id || 'unassigned';
                        if (!weeklyCapacity[weekKey].initiativeAllocations[initId]) {
                            weeklyCapacity[weekKey].initiativeAllocations[initId] = 0;
                        }
                        weeklyCapacity[weekKey].initiativeAllocations[initId] += effort;
                    }
                });

                // Calculate utilization and overload
                const result = Object.values(weeklyCapacity).map(week => ({
                    userId,
                    weekStart: week.weekStart,
                    allocatedHours: week.allocatedHours,
                    availableHours: week.availableHours,
                    utilizationPercent: Math.round((week.allocatedHours / week.availableHours) * 100),
                    initiativeAllocations: Object.entries(week.initiativeAllocations).map(([id, hours]) => ({ initiativeId: id, hours })),
                    isOverloaded: week.allocatedHours > week.availableHours * 1.2, // 120% threshold
                    taskCount: week.tasks.length
                }));

                resolve(result);
            });
        });
    },

    /**
     * Detect overloaded users in a project
     */
    detectOverloads: async (projectId) => {
        // Get all users with tasks in project
        const usersWithTasks = await new Promise((resolve, reject) => {
            deps.db.all(`SELECT DISTINCT assignee_id FROM tasks WHERE project_id = ? AND assignee_id IS NOT NULL`,
                [projectId], (err, rows) => {
                    if (err) reject(err);
                    else resolve((rows || []).map(r => r.assignee_id));
                });
        });

        const overloads = [];

        for (const userId of usersWithTasks) {
            const capacity = await CapacityService.calculateUserCapacity(userId, projectId);
            const overloadedWeeks = capacity.filter(w => w.isOverloaded);

            if (overloadedWeeks.length > 0) {
                // Get user name
                const user = await new Promise((resolve, reject) => {
                    deps.db.get(`SELECT first_name, last_name FROM users WHERE id = ?`, [userId], (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    });
                });

                overloads.push({
                    userId,
                    userName: user ? `${user.first_name} ${user.last_name}` : 'Unknown',
                    overloadedWeeks: overloadedWeeks.map(w => ({
                        weekStart: w.weekStart,
                        allocatedHours: w.allocatedHours,
                        utilizationPercent: w.utilizationPercent
                    })),
                    sustainedOverload: overloadedWeeks.length >= 2
                });
            }
        }

        return {
            projectId,
            totalUsersAnalyzed: usersWithTasks.length,
            overloadedUsers: overloads,
            hasOverloads: overloads.length > 0,
            sustainedOverloads: overloads.filter(o => o.sustainedOverload).length
        };
    },

    /**
     * AI recommendation for overload resolution
     */
    suggestResolutions: (overloads) => {
        const suggestions = [];

        overloads.overloadedUsers.forEach(user => {
            if (user.sustainedOverload) {
                suggestions.push({
                    userId: user.userId,
                    type: 'REASSIGN',
                    message: `${user.userName} is overloaded for ${user.overloadedWeeks.length} consecutive weeks. Consider reassigning tasks.`
                });
            } else {
                suggestions.push({
                    userId: user.userId,
                    type: 'RESEQUENCE',
                    message: `${user.userName} has peak overload. Consider spreading tasks across weeks.`
                });
            }
        });

        return suggestions;
    }
};

module.exports = CapacityService;
