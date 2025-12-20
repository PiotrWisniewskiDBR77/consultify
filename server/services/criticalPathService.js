
// Critical Path Service - Dependency-aware sequencing
// Step 4: Roadmap, Sequencing & Capacity

let db = require('../database');
const DependencyService = require('./dependencyService');

const CriticalPathService = {
    /**
     * Calculate critical path for a project
     * Critical path = longest sequence of dependent initiatives
     */
    calculateCriticalPath: async (projectId) => {
        // Get all initiatives with dates
        const initiatives = await new Promise((resolve, reject) => {
            db.all(`SELECT id, name, planned_start_date, planned_end_date, status
                    FROM initiatives WHERE project_id = ? AND status != 'CANCELLED'`,
                [projectId], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                });
        });

        if (initiatives.length === 0) {
            return { criticalPath: [], totalDuration: 0 };
        }

        // Get dependency graph
        const deps = await DependencyService.buildDependencyGraph(projectId);

        // Build adjacency list and in-degree
        const adj = {};
        const inDegree = {};
        const durations = {};

        initiatives.forEach(init => {
            adj[init.id] = [];
            inDegree[init.id] = 0;
            const start = new Date(init.planned_start_date);
            const end = new Date(init.planned_end_date);
            durations[init.id] = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
        });

        deps.edges.forEach(edge => {
            if (edge.type === 'FINISH_TO_START' && adj[edge.from_initiative_id] && inDegree[edge.to_initiative_id] !== undefined) {
                adj[edge.from_initiative_id].push(edge.to_initiative_id);
                inDegree[edge.to_initiative_id]++;
            }
        });

        // Topological sort with longest path
        const earliestStart = {};
        const earliestFinish = {};
        const queue = [];

        initiatives.forEach(init => {
            if (inDegree[init.id] === 0) {
                queue.push(init.id);
                earliestStart[init.id] = 0;
            }
        });

        while (queue.length > 0) {
            const current = queue.shift();
            earliestFinish[current] = (earliestStart[current] || 0) + durations[current];

            for (const next of adj[current]) {
                earliestStart[next] = Math.max(earliestStart[next] || 0, earliestFinish[current]);
                inDegree[next]--;
                if (inDegree[next] === 0) {
                    queue.push(next);
                }
            }
        }

        // Find longest path (critical path)
        let maxFinish = 0;
        let criticalEnd = null;

        initiatives.forEach(init => {
            if ((earliestFinish[init.id] || 0) > maxFinish) {
                maxFinish = earliestFinish[init.id];
                criticalEnd = init.id;
            }
        });

        // Trace back critical path
        const criticalPath = [];
        const onCriticalPath = new Set();

        // Mark initiatives with maximum slack = 0 as critical
        initiatives.forEach(init => {
            const latestFinish = maxFinish;
            const latestStart = latestFinish - durations[init.id];
            const slack = latestStart - (earliestStart[init.id] || 0);

            if (slack <= 0) {
                onCriticalPath.add(init.id);
                criticalPath.push({
                    id: init.id,
                    name: init.name,
                    duration: durations[init.id],
                    earliestStart: earliestStart[init.id] || 0,
                    earliestFinish: earliestFinish[init.id] || 0
                });
            }
        });

        // Sort by earliest start
        criticalPath.sort((a, b) => a.earliestStart - b.earliestStart);

        // Update DB to mark critical path
        for (const init of initiatives) {
            const isCritical = onCriticalPath.has(init.id) ? 1 : 0;
            await new Promise((resolve) => {
                db.run(`UPDATE initiatives SET is_critical_path = ? WHERE id = ?`, [isCritical, init.id], resolve);
            });
        }

        return {
            criticalPath,
            totalDuration: maxFinish,
            criticalInitiativeCount: criticalPath.length,
            nonCriticalCount: initiatives.length - criticalPath.length
        };
    },

    /**
     * Detect scheduling conflicts
     */
    detectSchedulingConflicts: async (projectId) => {
        const conflicts = [];

        // Get dependencies
        const deps = await DependencyService.buildDependencyGraph(projectId);

        // Get initiatives
        const initiatives = await new Promise((resolve, reject) => {
            db.all(`SELECT id, name, planned_start_date, planned_end_date FROM initiatives 
                    WHERE project_id = ? AND status != 'CANCELLED'`, [projectId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        const initMap = {};
        initiatives.forEach(i => { initMap[i.id] = i; });

        // Check each hard dependency
        for (const edge of deps.edges) {
            if (edge.type !== 'FINISH_TO_START') continue;

            const predecessor = initMap[edge.from_initiative_id];
            const successor = initMap[edge.to_initiative_id];

            if (!predecessor || !successor) continue;

            const predEnd = new Date(predecessor.planned_end_date);
            const succStart = new Date(successor.planned_start_date);

            if (succStart < predEnd) {
                conflicts.push({
                    type: 'DEPENDENCY_VIOLATION',
                    predecessorId: predecessor.id,
                    predecessorName: predecessor.name,
                    successorId: successor.id,
                    successorName: successor.name,
                    message: `${successor.name} is scheduled to start before ${predecessor.name} completes`,
                    gapDays: Math.round((predEnd - succStart) / (1000 * 60 * 60 * 24))
                });
            }
        }

        // Check for circular dependencies
        const deadlocks = await DependencyService.detectDeadlocks(projectId);
        if (deadlocks.hasDeadlocks) {
            conflicts.push({
                type: 'CIRCULAR_DEPENDENCY',
                message: 'Circular dependencies detected in initiative graph',
                cycles: deadlocks.cycles
            });
        }

        return {
            projectId,
            hasConflicts: conflicts.length > 0,
            conflictCount: conflicts.length,
            conflicts
        };
    },

    /**
     * AI-assisted schedule analysis
     */
    analyzeScheduleRisks: async (projectId) => {
        const criticalPath = await CriticalPathService.calculateCriticalPath(projectId);
        const conflicts = await CriticalPathService.detectSchedulingConflicts(projectId);

        const risks = [];
        const recommendations = [];

        // Risk: Long critical path
        if (criticalPath.totalDuration > 365) {
            risks.push({
                level: 'HIGH',
                type: 'LONG_CRITICAL_PATH',
                message: `Critical path spans ${criticalPath.totalDuration} days (over 1 year)`
            });
            recommendations.push('Consider parallelizing work or splitting large initiatives');
        }

        // Risk: Too many critical initiatives
        if (criticalPath.criticalPath.length > 5) {
            risks.push({
                level: 'MEDIUM',
                type: 'MANY_CRITICAL_INITIATIVES',
                message: `${criticalPath.criticalPath.length} initiatives are on the critical path`
            });
            recommendations.push('Any delay to critical path initiatives will delay the entire project');
        }

        // Risk: Conflicts
        if (conflicts.hasConflicts) {
            risks.push({
                level: 'HIGH',
                type: 'SCHEDULING_CONFLICTS',
                message: `${conflicts.conflictCount} scheduling conflicts detected`
            });
            recommendations.push('Resolve dependency violations before proceeding');
        }

        return {
            projectId,
            criticalPath: criticalPath.criticalPath.map(c => c.name),
            totalDuration: criticalPath.totalDuration,
            risks,
            recommendations,
            overallRisk: risks.some(r => r.level === 'HIGH') ? 'HIGH' : (risks.length > 0 ? 'MEDIUM' : 'LOW')
        };
    },

    // Test helper to inject mock DB
    _setDb: (mockDb) => { db = mockDb; }
};

module.exports = CriticalPathService;
