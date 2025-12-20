// Dependency Service - Initiative dependency management
// Step 3: PMO Objects, Statuses & Stage Gates

const db = require('../database');
const { v4: uuidv4 } = require('uuid');

const DependencyService = {
    /**
     * Add a dependency between initiatives
     * @param {string} fromInitiativeId - The initiative that must complete first
     * @param {string} toInitiativeId - The dependent initiative
     * @param {string} type - FINISH_TO_START or SOFT
     */
    addDependency: (fromInitiativeId, toInitiativeId, type = 'FINISH_TO_START') => {
        return new Promise((resolve, reject) => {
            const id = uuidv4();
            const sql = `INSERT INTO initiative_dependencies (id, from_initiative_id, to_initiative_id, type, is_satisfied, created_at)
                         VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP)`;

            db.run(sql, [id, fromInitiativeId, toInitiativeId, type], function (err) {
                if (err) return reject(err);
                resolve({ id, fromInitiativeId, toInitiativeId, type });
            });
        });
    },

    /**
     * Remove a dependency
     */
    removeDependency: (dependencyId) => {
        return new Promise((resolve, reject) => {
            db.run(`DELETE FROM initiative_dependencies WHERE id = ?`, [dependencyId], function (err) {
                if (err) return reject(err);
                resolve({ deleted: this.changes > 0 });
            });
        });
    },

    /**
     * Get all dependencies for an initiative
     */
    getDependencies: (initiativeId) => {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT d.*, 
                       i1.name as from_name, i1.status as from_status,
                       i2.name as to_name, i2.status as to_status
                FROM initiative_dependencies d
                LEFT JOIN initiatives i1 ON d.from_initiative_id = i1.id
                LEFT JOIN initiatives i2 ON d.to_initiative_id = i2.id
                WHERE d.from_initiative_id = ? OR d.to_initiative_id = ?
            `;

            db.all(sql, [initiativeId, initiativeId], (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });
    },

    /**
     * Build dependency graph for a project
     */
    buildDependencyGraph: (projectId) => {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT d.*, 
                       i1.name as from_name, i1.status as from_status,
                       i2.name as to_name, i2.status as to_status
                FROM initiative_dependencies d
                JOIN initiatives i1 ON d.from_initiative_id = i1.id
                JOIN initiatives i2 ON d.to_initiative_id = i2.id
                WHERE i1.project_id = ?
            `;

            db.all(sql, [projectId], (err, rows) => {
                if (err) return reject(err);

                // Build adjacency list
                const graph = {};
                const nodes = new Set();

                (rows || []).forEach(row => {
                    nodes.add(row.from_initiative_id);
                    nodes.add(row.to_initiative_id);

                    if (!graph[row.from_initiative_id]) {
                        graph[row.from_initiative_id] = [];
                    }
                    graph[row.from_initiative_id].push({
                        to: row.to_initiative_id,
                        type: row.type,
                        fromName: row.from_name,
                        toName: row.to_name
                    });
                });

                resolve({ graph, nodes: Array.from(nodes), edges: rows || [] });
            });
        });
    },

    /**
     * Detect circular dependencies (deadlocks)
     */
    detectDeadlocks: async (projectId) => {
        const { graph, nodes } = await DependencyService.buildDependencyGraph(projectId);

        const visited = new Set();
        const recStack = new Set();
        const cycles = [];

        const dfs = (node, path) => {
            visited.add(node);
            recStack.add(node);

            const neighbors = graph[node] || [];
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor.to)) {
                    const result = dfs(neighbor.to, [...path, neighbor.to]);
                    if (result) return result;
                } else if (recStack.has(neighbor.to)) {
                    // Found cycle
                    cycles.push([...path, neighbor.to]);
                }
            }

            recStack.delete(node);
            return null;
        };

        for (const node of nodes) {
            if (!visited.has(node)) {
                dfs(node, [node]);
            }
        }

        return {
            hasDeadlocks: cycles.length > 0,
            cycles
        };
    },

    /**
     * Check if an initiative can start (all hard dependencies satisfied)
     */
    canStart: async (initiativeId) => {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT d.id, i.status, i.name
                FROM initiative_dependencies d
                JOIN initiatives i ON d.from_initiative_id = i.id
                WHERE d.to_initiative_id = ? 
                  AND d.type = 'FINISH_TO_START'
                  AND i.status NOT IN ('COMPLETED', 'CANCELLED')
            `;

            db.all(sql, [initiativeId], (err, rows) => {
                if (err) return reject(err);

                const blockers = rows || [];
                resolve({
                    canStart: blockers.length === 0,
                    blockedBy: blockers.map(b => ({ id: b.id, name: b.name, status: b.status }))
                });
            });
        });
    },

    /**
     * Update dependency satisfaction status
     */
    updateSatisfaction: async (fromInitiativeId) => {
        return new Promise((resolve, reject) => {
            db.run(`UPDATE initiative_dependencies SET is_satisfied = 1 
                    WHERE from_initiative_id = ? AND type = 'FINISH_TO_START'`,
                [fromInitiativeId], function (err) {
                    if (err) return reject(err);
                    resolve({ updated: this.changes });
                });
        });
    }
};

module.exports = DependencyService;
