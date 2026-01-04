/**
 * Dependency Service - Initiative dependency management
 * Step 3: PMO Objects, Statuses & Stage Gates
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Dependency injection container
 */
const deps = {
    _db: null,
    _uuidv4: uuidv4,

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
        const { default: dbInstance } = await import('../src/database/Database.ts');
        deps._db = dbInstance;
    }
}

class DependencyService {
    constructor() {
        this._db = null;
    }

    get db() {
        if (!this._db) {
            throw new Error('DependencyService: Database not initialized. Call init() first.');
        }
        return this._db;
    }

    /**
     * Initialize service dependencies
     */
    async init() {
        await initDeps();
        this._db = deps.db;
        return this;
    }

    /**
     * Set dependencies for testing
     */
    setDependencies(mockDeps) {
        Object.assign(deps, mockDeps);
        this._db = deps.db;
    }

    /**
     * Add a dependency between initiatives
     * @param {string} fromInitiativeId - The initiative that must complete first
     * @param {string} toInitiativeId - The dependent initiative
     * @param {string} type - FINISH_TO_START or SOFT
     */
    async addDependency(fromInitiativeId, toInitiativeId, type = 'FINISH_TO_START') {
        await this.init();
        if (fromInitiativeId === toInitiativeId) throw new Error('Self-dependency not allowed');

        return new Promise((resolve, reject) => {
            const id = deps.uuidv4();
            const sql = `INSERT INTO initiative_dependencies (id, from_initiative_id, to_initiative_id, type, is_satisfied, created_at)
                         VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP)`;

            this.db.run(sql, [id, fromInitiativeId, toInitiativeId, type], function (err) {
                if (err) return reject(err);
                resolve({ id, fromInitiativeId, toInitiativeId, type });
            });
        });
    }

    /**
     * Remove a dependency
     */
    async removeDependency(dependencyId) {
        await this.init();
        return new Promise((resolve, reject) => {
            this.db.run(`DELETE FROM initiative_dependencies WHERE id = ?`, [dependencyId], function (err) {
                if (err) return reject(err);
                resolve({ deleted: this.changes > 0 });
            });
        });
    }

    /**
     * Get all dependencies for an initiative
     */
    async getDependencies(initiativeId) {
        await this.init();
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT d.*, 
                       i1.title as from_name, i1.status as from_status,
                       i2.title as to_name, i2.status as to_status
                FROM initiative_dependencies d
                LEFT JOIN initiatives i1 ON d.from_initiative_id = i1.id
                LEFT JOIN initiatives i2 ON d.to_initiative_id = i2.id
                WHERE d.from_initiative_id = ? OR d.to_initiative_id = ?
            `;

            this.db.all(sql, [initiativeId, initiativeId], (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });
    }

    /**
     * Build dependency graph for a project
     */
    async buildDependencyGraph(projectId) {
        await this.init();
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT d.*, 
                       i1.title as from_name, i1.status as from_status,
                       i2.title as to_name, i2.status as to_status
                FROM initiative_dependencies d
                JOIN initiatives i1 ON d.from_initiative_id = i1.id
                JOIN initiatives i2 ON d.to_initiative_id = i2.id
                WHERE i1.project_id = ?
            `;

            this.db.all(sql, [projectId], (err, rows) => {
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
    }

    /**
     * Detect circular dependencies (deadlocks)
     */
    async detectDeadlocks(projectId) {
        const { graph, nodes } = await this.buildDependencyGraph(projectId);

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
    }

    /**
     * Check if an initiative can start (all hard dependencies satisfied)
     */
    async canStart(initiativeId) {
        await this.init();
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT d.id, i.status, i.title as name
                FROM initiative_dependencies d
                JOIN initiatives i ON d.from_initiative_id = i.id
                WHERE d.to_initiative_id = ? 
                  AND d.type = 'FINISH_TO_START'
                  AND i.status NOT IN ('DONE', 'CANCELLED')
            `;

            this.db.all(sql, [initiativeId], (err, rows) => {
                if (err) return reject(err);

                const blockers = rows || [];
                resolve({
                    canStart: blockers.length === 0,
                    blockedBy: blockers.map(b => ({ id: b.id, name: b.name, status: b.status }))
                });
            });
        });
    }

    /**
     * Update dependency satisfaction status
     */
    async updateSatisfaction(fromInitiativeId) {
        await this.init();
        return new Promise((resolve, reject) => {
            this.db.run(`UPDATE initiative_dependencies SET is_satisfied = 1 
                    WHERE from_initiative_id = ? AND type = 'FINISH_TO_START'`,
                [fromInitiativeId], function (err) {
                    if (err) return reject(err);
                    resolve({ updated: this.changes });
                });
        });
    }
}

const dependencyServiceInstance = new DependencyService();
export default dependencyServiceInstance;
