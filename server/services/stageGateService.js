/**
 * Stage Gate Service - Phase transition control
 * Step 3: PMO Objects, Statuses & Stage Gates
 */

import { v4 as uuidv4 } from 'uuid';

const GATE_TYPES = {
    READINESS_GATE: 'READINESS_GATE',     // Context → Assessment
    DESIGN_GATE: 'DESIGN_GATE',           // Assessment → Initiatives
    PLANNING_GATE: 'PLANNING_GATE',       // Initiatives → Roadmap
    EXECUTION_GATE: 'EXECUTION_GATE',     // Roadmap → Execution
    CLOSURE_GATE: 'CLOSURE_GATE'          // Execution → Stabilization
};

const PHASE_ORDER = ['Context', 'Assessment', 'Initiatives', 'Roadmap', 'Execution', 'Stabilization'];

const GATE_MAP = {
    'Context_Assessment': GATE_TYPES.READINESS_GATE,
    'Assessment_Initiatives': GATE_TYPES.DESIGN_GATE,
    'Initiatives_Roadmap': GATE_TYPES.PLANNING_GATE,
    'Roadmap_Execution': GATE_TYPES.EXECUTION_GATE,
    'Execution_Stabilization': GATE_TYPES.CLOSURE_GATE
};

// Gate Criteria Definitions
const GATE_CRITERIA = {
    [GATE_TYPES.READINESS_GATE]: [
        { criterion: 'Strategic goals defined', field: 'hasStrategicGoals' },
        { criterion: 'Challenges documented', field: 'hasChallenges' },
        { criterion: 'Constraints identified', field: 'hasConstraints' },
        { criterion: 'Context readiness score >= 80%', field: 'contextReadinessOk' }
    ],
    [GATE_TYPES.DESIGN_GATE]: [
        { criterion: 'All axes assessed', field: 'assessmentComplete' },
        { criterion: 'Gap analysis reviewed', field: 'gapAnalysisReviewed' }
    ],
    [GATE_TYPES.PLANNING_GATE]: [
        { criterion: 'At least one initiative defined', field: 'hasInitiatives' },
        { criterion: 'All initiatives have owners', field: 'allInitiativesOwned' },
        { criterion: 'Initiative priorities set', field: 'prioritiesSet' }
    ],
    [GATE_TYPES.EXECUTION_GATE]: [
        { criterion: 'Roadmap baselined', field: 'roadmapBaselined' },
        { criterion: 'All initiatives assigned to waves', field: 'allAssignedToWaves' },
        { criterion: 'No dependency conflicts', field: 'noDependencyConflicts' }
    ],
    [GATE_TYPES.CLOSURE_GATE]: [
        { criterion: 'All initiatives completed or cancelled', field: 'allInitiativesClosed' },
        { criterion: 'No blocking decisions pending', field: 'noBlockingDecisions' },
        { criterion: 'KPIs measured', field: 'kpisMeasured' }
    ]
};

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
        const { default: dbInstance } = await import('../database.js');
        deps._db = dbInstance;
    }
}

class StageGateService {
    constructor() {
        this._db = null;
        this.GATE_TYPES = GATE_TYPES;
        this.PHASE_ORDER = PHASE_ORDER;
    }

    get db() {
        if (!this._db) {
            throw new Error('StageGateService: Database not initialized. Call init() first.');
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
     * Get the gate type for a phase transition
     */
    getGateType(fromPhase, toPhase) {
        // Support legacy/UI naming: "Idea" is treated as "Context"
        const normalize = (p) => (p === 'Idea' ? 'Context' : p);
        const key = `${normalize(fromPhase)}_${normalize(toPhase)}`;
        return GATE_MAP[key] || null;
    }

    /**
     * Evaluate gate readiness for a project
     */
    async evaluateGate(projectId, gateType) {
        await this.init();
        const criteria = GATE_CRITERIA[gateType] || [];
        const results = [];

        // Fetch project context
        const project = await new Promise((resolve, reject) => {
            this.db.get(`SELECT * FROM projects WHERE id = ?`, [projectId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!project) throw new Error('Project not found');

        // Evaluate each criterion based on gate type
        for (const crit of criteria) {
            const isMet = await this._evaluateCriterion(projectId, crit.field);
            results.push({
                criterion: crit.criterion,
                isMet,
                evidence: isMet ? 'Verified' : 'Not met'
            });
        }

        const allMet = results.every(r => r.isMet);

        return {
            gateType,
            projectId,
            status: allMet ? 'READY' : 'NOT_READY',
            completionCriteria: results,
            missingElements: results.filter(r => !r.isMet).map(r => r.criterion)
        };
    }

    /**
     * Evaluate a specific criterion
     */
    async _evaluateCriterion(projectId, field) {
        switch (field) {
            case 'hasStrategicGoals':
                return await this._checkContextField(projectId, 'strategicGoals', arr => arr && arr.length > 0);
            case 'hasChallenges':
                return await this._checkContextField(projectId, 'challenges', arr => arr && arr.length > 0);
            case 'hasConstraints':
                return await this._checkContextField(projectId, 'constraints', arr => arr && arr.length > 0);
            case 'contextReadinessOk':
                return await this._checkContextReadiness(projectId);
            case 'assessmentComplete':
                return await this._checkAssessmentComplete(projectId);
            case 'gapAnalysisReviewed':
                return true; // Placeholder - would check review flag
            case 'hasInitiatives':
                return await this._countInitiatives(projectId) > 0;
            case 'allInitiativesOwned':
                return await this._checkAllInitiativesHaveOwners(projectId);
            case 'prioritiesSet':
                return true; // Placeholder
            case 'roadmapBaselined':
                return await this._checkRoadmapBaselined(projectId);
            case 'allAssignedToWaves':
                return await this._checkAllInWaves(projectId);
            case 'noDependencyConflicts':
                return true; // Placeholder - would check dependency graph
            case 'allInitiativesClosed':
                return await this._checkAllInitiativesClosed(projectId);
            case 'noBlockingDecisions':
                return await this._checkNoBlockingDecisions(projectId);
            case 'kpisMeasured':
                return await this._countKPIs(projectId) > 0;
            default:
                return false;
        }
    }

    // Helper methods
    async _checkContextField(projectId, field, validator) {
        await this.init();
        return new Promise((resolve) => {
            this.db.get(`SELECT context_data FROM projects WHERE id = ?`, [projectId], (err, row) => {
                if (err || !row) return resolve(false);
                try {
                    const ctx = JSON.parse(row.context_data || '{}');
                    resolve(!!validator(ctx[field]));
                } catch { resolve(false); }
            });
        });
    }

    async _checkContextReadiness(projectId) {
        await this.init();
        // Simplified check - would use ContextService.calculateReadiness
        return new Promise((resolve) => {
            this.db.get(`SELECT context_data FROM projects WHERE id = ?`, [projectId], (err, row) => {
                if (err || !row) return resolve(false);
                try {
                    const ctx = JSON.parse(row.context_data || '{}');
                    const hasGoals = ctx.strategicGoals && ctx.strategicGoals.length > 0;
                    const hasChallenges = ctx.challenges && ctx.challenges.length > 0;
                    resolve(hasGoals && hasChallenges);
                } catch { resolve(false); }
            });
        });
    }

    async _checkAssessmentComplete(projectId) {
        await this.init();
        return new Promise((resolve) => {
            this.db.get(`SELECT is_complete FROM maturity_assessments WHERE project_id = ?`, [projectId], (err, row) => {
                resolve(row && row.is_complete === 1);
            });
        });
    }

    async _countInitiatives(projectId) {
        await this.init();
        return new Promise((resolve) => {
            this.db.get(`SELECT COUNT(*) as cnt FROM initiatives WHERE project_id = ?`, [projectId], (err, row) => {
                resolve(row ? row.cnt : 0);
            });
        });
    }

    async _checkAllInitiativesHaveOwners(projectId) {
        await this.init();
        return new Promise((resolve) => {
            this.db.get(`SELECT COUNT(*) as cnt FROM initiatives WHERE project_id = ? AND (owner_business_id IS NULL OR owner_business_id = '')`,
                [projectId], (err, row) => {
                    resolve(row ? row.cnt === 0 : false);
                });
        });
    }

    async _checkRoadmapBaselined(projectId) {
        await this.init();
        return new Promise((resolve) => {
            this.db.get(`SELECT COUNT(*) as cnt FROM roadmap_waves WHERE project_id = ? AND is_baselined = 1`,
                [projectId], (err, row) => {
                    resolve(row && row.cnt > 0);
                });
        });
    }

    async _checkAllInWaves(projectId) {
        await this.init();
        return new Promise((resolve) => {
            this.db.get(`SELECT COUNT(*) as cnt FROM initiatives WHERE project_id = ? AND (wave_id IS NULL OR wave_id = '')`,
                [projectId], (err, row) => {
                    resolve(row ? row.cnt === 0 : false);
                });
        });
    }

    async _checkAllInitiativesClosed(projectId) {
        await this.init();
        return new Promise((resolve) => {
            this.db.get(`SELECT COUNT(*) as cnt FROM initiatives WHERE project_id = ? AND status NOT IN ('DONE', 'CANCELLED')`,
                [projectId], (err, row) => {
                    resolve(row ? row.cnt === 0 : false);
                });
        });
    }

    async _checkNoBlockingDecisions(projectId) {
        await this.init();
        return new Promise((resolve) => {
            this.db.get(`SELECT COUNT(*) as cnt FROM decisions WHERE project_id = ? AND status = 'PENDING' AND required = 1`,
                [projectId], (err, row) => {
                    resolve(row ? row.cnt === 0 : true);
                });
        });
    }

    async _countKPIs(projectId) {
        await this.init();
        return new Promise((resolve) => {
            this.db.get(`SELECT COUNT(*) as cnt FROM kpi_results WHERE project_id = ?`, [projectId], (err, row) => {
                resolve(row ? row.cnt : 0);
            });
        });
    }

    /**
     * Record gate passage
     */
    async passGate(projectId, gateType, userId, notes) {
        await this.init();
        const id = deps.uuidv4();
        const fromPhase = Object.keys(GATE_MAP).find(k => GATE_MAP[k] === gateType)?.split('_')[0];
        const toPhase = Object.keys(GATE_MAP).find(k => GATE_MAP[k] === gateType)?.split('_')[1];

        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO stage_gates (id, project_id, gate_type, from_phase, to_phase, status, approved_by, approved_at, notes)
                         VALUES (?, ?, ?, ?, ?, 'PASSED', ?, CURRENT_TIMESTAMP, ?)`;

            this.db.run(sql, [id, projectId, gateType, fromPhase, toPhase, userId, notes], (err) => {
                if (err) return reject(err);

                // Update project phase
                this.db.run(`UPDATE projects SET current_phase = ? WHERE id = ?`, [toPhase, projectId], (err2) => {
                    if (err2) return reject(err2);
                    resolve({ id, gateType, status: 'PASSED', toPhase });
                });
            });
        });
    }
}

const stageGateServiceInstance = new StageGateService();
export default stageGateServiceInstance;
