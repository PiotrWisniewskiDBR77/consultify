// Scenario Service - What-if analysis
// Step 4: Roadmap, Sequencing & Capacity

// Dependency injection for testing
const deps = {
    db: require('../database'),
    uuidv4: require('uuid').v4,
    DependencyService: require('./dependencyService')
};

const ScenarioService = {
    /**
     * Allow dependency injection for testing
     */
    setDependencies: (newDeps = {}) => {
        Object.assign(deps, newDeps);
    },
    /**
     * Create a what-if scenario (non-persistent by default)
     */
    createScenario: async (projectId, name, proposedChanges, userId, persist = false) => {
        const id = deps.uuidv4();

        // Analyze impact
        const impact = await ScenarioService.analyzeImpact(projectId, proposedChanges);

        if (persist) {
            return new Promise((resolve, reject) => {
                const sql = `INSERT INTO scenarios (id, project_id, name, proposed_changes, impact_analysis, created_by)
                             VALUES (?, ?, ?, ?, ?, ?)`;

                deps.db.run(sql, [id, projectId, name, JSON.stringify(proposedChanges), JSON.stringify(impact), userId], function (err) {
                    if (err) return reject(err);
                    resolve({ id, projectId, name, proposedChanges, impactAnalysis: impact, persisted: true });
                });
            });
        }

        // Non-persistent (just return analysis)
        return { id, projectId, name, proposedChanges, impactAnalysis: impact, persisted: false };
    },

    /**
     * Analyze the impact of proposed changes
     */
    analyzeImpact: async (projectId, proposedChanges) => {
        const affectedInitiatives = [];
        const dependencyBreaks = [];
        const capacityOverloads = [];
        let totalDelayDays = 0;

        // Get current initiative data
        const initiatives = await new Promise((resolve, reject) => {
            deps.db.all(`SELECT i.id, i.name, i.planned_start_date, i.planned_end_date, i.owner_business_id
                    FROM initiatives i WHERE i.project_id = ?`, [projectId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        const initMap = {};
        initiatives.forEach(i => { initMap[i.id] = i; });

        // Get dependencies
        const dependencyGraph = await deps.DependencyService.buildDependencyGraph(projectId);

        for (const change of proposedChanges) {
            const init = initMap[change.initiativeId];
            if (!init) continue;

            affectedInitiatives.push(change.initiativeId);

            if (change.field === 'plannedEndDate') {
                const originalEnd = new Date(init.planned_end_date);
                const newEnd = new Date(change.newValue);
                const delayDays = Math.round((newEnd - originalEnd) / (1000 * 60 * 60 * 24));

                if (delayDays > 0) {
                    totalDelayDays += delayDays;

                    // Check if this breaks dependencies
                    const dependents = (dependencyGraph.edges || []).filter(e => e.from_initiative_id === change.initiativeId);
                    for (const dep of dependents) {
                        const dependent = initMap[dep.to_initiative_id];
                        if (dependent && new Date(dependent.planned_start_date) < newEnd) {
                            dependencyBreaks.push(`${init.name} → ${dependent.name}: New end date conflicts with dependent start`);
                        }
                    }
                }
            }

            if (change.field === 'plannedStartDate') {
                // Check if moving start violates dependencies
                const predecessors = (dependencyGraph.edges || []).filter(e => e.to_initiative_id === change.initiativeId);
                for (const pred of predecessors) {
                    if (pred.type === 'FINISH_TO_START') {
                        const predecessor = initMap[pred.from_initiative_id];
                        if (predecessor && new Date(predecessor.planned_end_date) > new Date(change.newValue)) {
                            dependencyBreaks.push(`Cannot start ${init.name} before ${predecessor.name} completes`);
                        }
                    }
                }
            }
        }

        return {
            affectedInitiatives,
            dependencyBreaks,
            capacityOverloads, // Would need CapacityService integration
            delayedByDays: totalDelayDays,
            isValid: dependencyBreaks.length === 0,
            warnings: dependencyBreaks.length > 0 ? dependencyBreaks : []
        };
    },

    /**
     * Get saved scenarios
     */
    getScenarios: async (projectId) => {
        return new Promise((resolve, reject) => {
            deps.db.all(`SELECT * FROM scenarios WHERE project_id = ? ORDER BY created_at DESC`,
                [projectId], (err, rows) => {
                    if (err) return reject(err);

                    const result = (rows || []).map(row => {
                        try {
                            row.proposedChanges = JSON.parse(row.proposed_changes);
                            row.impactAnalysis = JSON.parse(row.impact_analysis);
                        } catch { }
                        return row;
                    });

                    resolve(result);
                });
        });
    },

    /**
     * Compare two scenarios
     */
    compareScenarios: (scenario1, scenario2) => {
        return {
            scenario1: { name: scenario1.name, delayDays: scenario1.impactAnalysis?.delayedByDays || 0 },
            scenario2: { name: scenario2.name, delayDays: scenario2.impactAnalysis?.delayedByDays || 0 },
            recommendation: (scenario1.impactAnalysis?.delayedByDays || 0) <= (scenario2.impactAnalysis?.delayedByDays || 0)
                ? `${scenario1.name} has less schedule impact`
                : `${scenario2.name} has less schedule impact`
        };
    }
};

module.exports = ScenarioService;
