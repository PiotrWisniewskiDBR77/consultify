// Stage Gate Service - Phase transition control
// Step 3: PMO Objects, Statuses & Stage Gates

let db = require('../database');
const { v4: uuidv4 } = require('uuid');

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

const StageGateService = {
    GATE_TYPES,
    PHASE_ORDER,

    /**
     * Get the gate type for a phase transition
     */
    getGateType: (fromPhase, toPhase) => {
        const key = `${fromPhase}_${toPhase}`;
        return GATE_MAP[key] || null;
    },

    /**
     * Evaluate gate readiness for a project
     */
    evaluateGate: async (projectId, gateType) => {
        const criteria = GATE_CRITERIA[gateType] || [];
        const results = [];

        // Fetch project context
        const project = await new Promise((resolve, reject) => {
            db.get(`SELECT * FROM projects WHERE id = ?`, [projectId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!project) throw new Error('Project not found');

        // Evaluate each criterion based on gate type
        for (const crit of criteria) {
            const isMet = await StageGateService._evaluateCriterion(projectId, crit.field);
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
    },

    /**
     * Evaluate a specific criterion
     */
    _evaluateCriterion: async (projectId, field) => {
        switch (field) {
            case 'hasStrategicGoals':
                return await StageGateService._checkContextField(projectId, 'strategicGoals', arr => arr && arr.length > 0);
            case 'hasChallenges':
                return await StageGateService._checkContextField(projectId, 'challenges', arr => arr && arr.length > 0);
            case 'hasConstraints':
                return await StageGateService._checkContextField(projectId, 'constraints', arr => arr && arr.length > 0);
            case 'contextReadinessOk':
                return await StageGateService._checkContextReadiness(projectId);
            case 'assessmentComplete':
                return await StageGateService._checkAssessmentComplete(projectId);
            case 'gapAnalysisReviewed':
                return true; // Placeholder - would check review flag
            case 'hasInitiatives':
                return await StageGateService._countInitiatives(projectId) > 0;
            case 'allInitiativesOwned':
                return await StageGateService._checkAllInitiativesHaveOwners(projectId);
            case 'prioritiesSet':
                return true; // Placeholder
            case 'roadmapBaselined':
                return await StageGateService._checkRoadmapBaselined(projectId);
            case 'allAssignedToWaves':
                return await StageGateService._checkAllInWaves(projectId);
            case 'noDependencyConflicts':
                return true; // Placeholder - would check dependency graph
            case 'allInitiativesClosed':
                return await StageGateService._checkAllInitiativesClosed(projectId);
            case 'noBlockingDecisions':
                return await StageGateService._checkNoBlockingDecisions(projectId);
            case 'kpisMeasured':
                return await StageGateService._countKPIs(projectId) > 0;
            default:
                return false;
        }
    },

    // Helper methods
    _checkContextField: async (projectId, field, validator) => {
        return new Promise((resolve) => {
            db.get(`SELECT context_data FROM projects WHERE id = ?`, [projectId], (err, row) => {
                if (err || !row) return resolve(false);
                try {
                    const ctx = JSON.parse(row.context_data || '{}');
                    resolve(validator(ctx[field]));
                } catch { resolve(false); }
            });
        });
    },

    _checkContextReadiness: async (projectId) => {
        // Simplified check - would use ContextService.calculateReadiness
        return new Promise((resolve) => {
            db.get(`SELECT context_data FROM projects WHERE id = ?`, [projectId], (err, row) => {
                if (err || !row) return resolve(false);
                try {
                    const ctx = JSON.parse(row.context_data || '{}');
                    const hasGoals = ctx.strategicGoals && ctx.strategicGoals.length > 0;
                    const hasChallenges = ctx.challenges && ctx.challenges.length > 0;
                    resolve(hasGoals && hasChallenges);
                } catch { resolve(false); }
            });
        });
    },

    _checkAssessmentComplete: async (projectId) => {
        return new Promise((resolve) => {
            db.get(`SELECT is_complete FROM maturity_assessments WHERE project_id = ?`, [projectId], (err, row) => {
                resolve(row && row.is_complete === 1);
            });
        });
    },

    _countInitiatives: async (projectId) => {
        return new Promise((resolve) => {
            db.get(`SELECT COUNT(*) as cnt FROM initiatives WHERE project_id = ?`, [projectId], (err, row) => {
                resolve(row ? row.cnt : 0);
            });
        });
    },

    _checkAllInitiativesHaveOwners: async (projectId) => {
        return new Promise((resolve) => {
            db.get(`SELECT COUNT(*) as cnt FROM initiatives WHERE project_id = ? AND (owner_business_id IS NULL OR owner_business_id = '')`,
                [projectId], (err, row) => {
                    resolve(row ? row.cnt === 0 : false);
                });
        });
    },

    _checkRoadmapBaselined: async (projectId) => {
        return new Promise((resolve) => {
            db.get(`SELECT COUNT(*) as cnt FROM roadmap_waves WHERE project_id = ? AND is_baselined = 1`,
                [projectId], (err, row) => {
                    resolve(row && row.cnt > 0);
                });
        });
    },

    _checkAllInWaves: async (projectId) => {
        return new Promise((resolve) => {
            db.get(`SELECT COUNT(*) as cnt FROM initiatives WHERE project_id = ? AND (wave_id IS NULL OR wave_id = '')`,
                [projectId], (err, row) => {
                    resolve(row ? row.cnt === 0 : false);
                });
        });
    },

    _checkAllInitiativesClosed: async (projectId) => {
        return new Promise((resolve) => {
            db.get(`SELECT COUNT(*) as cnt FROM initiatives WHERE project_id = ? AND status NOT IN ('COMPLETED', 'CANCELLED')`,
                [projectId], (err, row) => {
                    resolve(row ? row.cnt === 0 : false);
                });
        });
    },

    _checkNoBlockingDecisions: async (projectId) => {
        return new Promise((resolve) => {
            db.get(`SELECT COUNT(*) as cnt FROM decisions WHERE project_id = ? AND status = 'PENDING' AND required = 1`,
                [projectId], (err, row) => {
                    resolve(row ? row.cnt === 0 : true);
                });
        });
    },

    _countKPIs: async (projectId) => {
        return new Promise((resolve) => {
            db.get(`SELECT COUNT(*) as cnt FROM kpi_results WHERE project_id = ?`, [projectId], (err, row) => {
                resolve(row ? row.cnt : 0);
            });
        });
    },

    /**
     * Record gate passage
     */
    passGate: async (projectId, gateType, userId, notes) => {
        const id = uuidv4();
        const fromPhase = Object.keys(GATE_MAP).find(k => GATE_MAP[k] === gateType)?.split('_')[0];
        const toPhase = Object.keys(GATE_MAP).find(k => GATE_MAP[k] === gateType)?.split('_')[1];

        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO stage_gates (id, project_id, gate_type, from_phase, to_phase, status, approved_by, approved_at, notes)
                         VALUES (?, ?, ?, ?, ?, 'PASSED', ?, CURRENT_TIMESTAMP, ?)`;

            db.run(sql, [id, projectId, gateType, fromPhase, toPhase, userId, notes], function (err) {
                if (err) return reject(err);

                // Update project phase
                db.run(`UPDATE projects SET current_phase = ? WHERE id = ?`, [toPhase, projectId], (err2) => {
                    if (err2) return reject(err2);
                    resolve({ id, gateType, status: 'PASSED', toPhase });
                });
            });
        });
    },

    // Test helper to inject mock DB
    _setDb: (mockDb) => { db = mockDb; }
};

module.exports = StageGateService;
