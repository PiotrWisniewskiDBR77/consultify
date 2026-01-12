/**
 * Outcome Service
 * Step 18: Outcomes, ROI & Continuous Learning Loop
 * 
 * Handles outcome tracking for AI actions and playbooks:
 * - Captures baseline state before action/playbook execution
 * - Captures after state when measurement window expires
 * - Computes deltas and success criteria
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');

/**
 * Default metrics to track per entity type
 */
const DEFAULT_METRICS = {
    'ACTION_TYPE': {
        'TASK_CREATE': { tasks_completed: true, time_to_completion_mins: true },
        'TASK_UPDATE': { status_changes: true },
        'PLAYBOOK_ASSIGN': { playbook_completion: true },
        'NOTIFICATION_SEND': { response_rate: true }
    },
    'PLAYBOOK_TEMPLATE': {
        'DEFAULT': { steps_completed: true, time_to_resolution_mins: true }
    }
};

const OutcomeService = {
    /**
     * Get or create an outcome definition for an entity.
     * @param {string} orgId - Organization ID
     * @param {string} entityType - ACTION_TYPE | PLAYBOOK_TEMPLATE
     * @param {string} entityKey - e.g., 'TASK_CREATE' or playbook key
     * @returns {Promise<Object>} Outcome definition
     */
    getOrCreateDefinition: async (orgId, entityType, entityKey) => {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM outcome_definitions WHERE org_id = ? AND entity_type = ? AND entity_key = ?`,
                [orgId, entityType, entityKey],
                (err, row) => {
                    if (err) return reject(err);
                    if (row) {
                        return resolve({
                            ...row,
                            metrics_tracked: JSON.parse(row.metrics_tracked || '{}'),
                            success_criteria: JSON.parse(row.success_criteria || '{}')
                        });
                    }

                    // Create default definition
                    const id = `odef-${uuidv4()}`;
                    const defaultMetrics = DEFAULT_METRICS[entityType]?.[entityKey] ||
                        DEFAULT_METRICS[entityType]?.['DEFAULT'] || {};

                    db.run(
                        `INSERT INTO outcome_definitions (id, org_id, entity_type, entity_key, metrics_tracked)
                         VALUES (?, ?, ?, ?, ?)`,
                        [id, orgId, entityType, entityKey, JSON.stringify(defaultMetrics)],
                        function (err) {
                            if (err) return reject(err);
                            resolve({
                                id,
                                org_id: orgId,
                                entity_type: entityType,
                                entity_key: entityKey,
                                metrics_tracked: defaultMetrics,
                                measurement_window_days: 7,
                                success_criteria: {}
                            });
                        }
                    );
                }
            );
        });
    },

    /**
     * Capture baseline state before action/playbook execution.
     * @param {string} orgId - Organization ID
     * @param {string} entityType - ACTION_TYPE | PLAYBOOK_TEMPLATE
     * @param {string} entityKey - e.g., 'TASK_CREATE'
     * @param {Object} options - { runId?, executionId?, baselineData? }
     * @returns {Promise<Object>} Created measurement record
     */
    captureBaseline: async (orgId, entityType, entityKey, options = {}) => {
        const { runId, executionId, baselineData } = options;

        // Get definition
        const definition = await OutcomeService.getOrCreateDefinition(orgId, entityType, entityKey);

        // Build baseline JSON
        let baseline = baselineData || {};

        // If no explicit baseline, compute from current org state
        if (!baselineData) {
            baseline = await OutcomeService._computeOrgMetricsSnapshot(orgId, definition.metrics_tracked);
        }

        const id = `omeas-${uuidv4()}`;
        const now = new Date().toISOString();

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO outcome_measurements 
                    (id, org_id, definition_id, run_id, execution_id, entity_type, entity_key, baseline_json, baseline_captured_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [id, orgId, definition.id, runId || null, executionId || null, entityType, entityKey, JSON.stringify(baseline), now],
                function (err) {
                    if (err) return reject(err);
                    resolve({
                        id,
                        org_id: orgId,
                        definition_id: definition.id,
                        entity_type: entityType,
                        entity_key: entityKey,
                        baseline_json: baseline,
                        baseline_captured_at: now,
                        measurement_window_days: definition.measurement_window_days
                    });
                }
            );
        });
    },

    /**
     * Capture after-state for a measurement.
     * @param {string} measurementId - Measurement ID
     * @returns {Promise<Object>} Updated measurement
     */
    captureAfter: async (measurementId) => {
        return new Promise((resolve, reject) => {
            db.get(`SELECT * FROM outcome_measurements WHERE id = ?`, [measurementId], async (err, measurement) => {
                if (err) return reject(err);
                if (!measurement) return reject(new Error('Measurement not found'));

                // Get definition for metrics
                db.get(`SELECT * FROM outcome_definitions WHERE id = ?`, [measurement.definition_id], async (err, definition) => {
                    if (err) return reject(err);

                    const metricsTracked = JSON.parse(definition?.metrics_tracked || '{}');
                    const afterData = await OutcomeService._computeOrgMetricsSnapshot(measurement.org_id, metricsTracked);
                    const now = new Date().toISOString();

                    // Compute delta
                    const baseline = JSON.parse(measurement.baseline_json || '{}');
                    const delta = OutcomeService._computeDelta(baseline, afterData);

                    // Evaluate success
                    const successCriteria = JSON.parse(definition?.success_criteria || '{}');
                    const isSuccess = OutcomeService._evaluateSuccess(delta, successCriteria);

                    db.run(
                        `UPDATE outcome_measurements 
                         SET after_json = ?, delta_json = ?, is_success = ?, after_captured_at = ?, computed_at = ?
                         WHERE id = ?`,
                        [JSON.stringify(afterData), JSON.stringify(delta), isSuccess ? 1 : 0, now, now, measurementId],
                        function (err) {
                            if (err) return reject(err);
                            resolve({
                                id: measurementId,
                                baseline_json: baseline,
                                after_json: afterData,
                                delta_json: delta,
                                is_success: isSuccess,
                                computed_at: now
                            });
                        }
                    );
                });
            });
        });
    },

    /**
     * Get measurements by playbook run ID.
     */
    getByRun: async (runId) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM outcome_measurements WHERE run_id = ? ORDER BY created_at DESC`,
                [runId],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve((rows || []).map(r => ({
                        ...r,
                        baseline_json: JSON.parse(r.baseline_json || '{}'),
                        after_json: JSON.parse(r.after_json || '{}'),
                        delta_json: JSON.parse(r.delta_json || '{}')
                    })));
                }
            );
        });
    },

    /**
     * Get measurements by execution ID.
     */
    getByExecution: async (executionId) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM outcome_measurements WHERE execution_id = ? ORDER BY created_at DESC`,
                [executionId],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve((rows || []).map(r => ({
                        ...r,
                        baseline_json: JSON.parse(r.baseline_json || '{}'),
                        after_json: JSON.parse(r.after_json || '{}'),
                        delta_json: JSON.parse(r.delta_json || '{}')
                    })));
                }
            );
        });
    },

    /**
     * Get pending measurements that need after-capture.
     * @param {number} limit - Max results
     */
    getPendingMeasurements: async (limit = 100) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT m.*, d.measurement_window_days 
                 FROM outcome_measurements m
                 JOIN outcome_definitions d ON m.definition_id = d.id
                 WHERE m.after_captured_at IS NULL
                 AND datetime(m.baseline_captured_at, '+' || d.measurement_window_days || ' days') <= datetime('now')
                 LIMIT ?`,
                [limit],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });
    },

    /**
     * Recompute measurements for a date range.
     */
    recompute: async (orgId, fromDate, toDate) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT id FROM outcome_measurements 
                 WHERE org_id = ? 
                 AND baseline_captured_at >= ? 
                 AND baseline_captured_at <= ?
                 AND after_captured_at IS NULL`,
                [orgId, fromDate, toDate],
                async (err, rows) => {
                    if (err) return reject(err);

                    const results = [];
                    for (const row of rows || []) {
                        try {
                            const result = await OutcomeService.captureAfter(row.id);
                            results.push({ id: row.id, success: true, result });
                        } catch (e) {
                            results.push({ id: row.id, success: false, error: e.message });
                        }
                    }
                    resolve({ processed: results.length, results });
                }
            );
        });
    },

    // ==========================================
    // INTERNAL HELPERS
    // ==========================================

    /**
     * Compute org metrics snapshot based on tracked metrics.
     */
    _computeOrgMetricsSnapshot: async (orgId, metricsTracked) => {
        const snapshot = {};

        // Tasks metrics
        if (metricsTracked.tasks_completed) {
            const count = await new Promise((resolve) => {
                db.get(
                    `SELECT COUNT(*) as count FROM tasks WHERE organization_id = ? AND status = 'done'`,
                    [orgId],
                    (err, row) => resolve(row?.count || 0)
                );
            });
            snapshot.tasks_completed = count;
        }

        // Blocked tasks
        if (metricsTracked.tasks_blocked) {
            const count = await new Promise((resolve) => {
                db.get(
                    `SELECT COUNT(*) as count FROM tasks WHERE organization_id = ? AND status = 'blocked'`,
                    [orgId],
                    (err, row) => resolve(row?.count || 0)
                );
            });
            snapshot.tasks_blocked = count;
        }

        // Playbook completions
        if (metricsTracked.playbook_completion) {
            const count = await new Promise((resolve) => {
                db.get(
                    `SELECT COUNT(*) as count FROM ai_playbook_runs WHERE organization_id = ? AND status = 'COMPLETED'`,
                    [orgId],
                    (err, row) => resolve(row?.count || 0)
                );
            });
            snapshot.playbook_completion = count;
        }

        return snapshot;
    },

    /**
     * Compute delta between baseline and after.
     */
    _computeDelta: (baseline, after) => {
        const delta = {};
        const allKeys = new Set([...Object.keys(baseline), ...Object.keys(after)]);

        for (const key of allKeys) {
            const before = baseline[key] ?? 0;
            const afterVal = after[key] ?? 0;
            delta[key] = afterVal - before;
        }

        return delta;
    },

    /**
     * Evaluate if outcome is successful based on criteria.
     */
    _evaluateSuccess: (delta, criteria) => {
        if (!criteria || Object.keys(criteria).length === 0) {
            // Default: any positive delta is success
            return Object.values(delta).some(v => v > 0);
        }

        // Evaluate each criterion
        for (const [metric, condition] of Object.entries(criteria)) {
            const value = delta[metric] ?? 0;

            // Parse conditions like "> 0", ">= 5", "== 1"
            const match = String(condition).match(/^([<>=!]+)\s*(-?\d+(?:\.\d+)?)$/);
            if (match) {
                const [, operator, target] = match;
                const targetNum = parseFloat(target);

                switch (operator) {
                    case '>': if (!(value > targetNum)) return false; break;
                    case '>=': if (!(value >= targetNum)) return false; break;
                    case '<': if (!(value < targetNum)) return false; break;
                    case '<=': if (!(value <= targetNum)) return false; break;
                    case '==': if (!(value === targetNum)) return false; break;
                    case '!=': if (!(value !== targetNum)) return false; break;
                }
            }
        }

        return true;
    }
};

module.exports = OutcomeService;
