/**
 * ROI Service
 * Step 18: Outcomes, ROI & Continuous Learning Loop
 * 
 * Calculates Return on Investment metrics from outcome measurements:
 * - Time saved estimation
 * - Cost reduction calculation
 * - ROI model management
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');

/**
 * Default ROI model assumptions
 */
const DEFAULT_ASSUMPTIONS = {
    hourly_cost: 75,          // Average hourly cost of employee
    downtime_cost_per_hour: 500,
    task_avg_time_mins: 30,   // Average time to complete a task
    meeting_avg_cost: 150,    // Average cost of a meeting
    overhead_multiplier: 1.3  // Overhead factor for indirect costs
};

const ROIService = {
    /**
     * Get or create default ROI model for an organization.
     * @param {string} orgId - Organization ID
     * @returns {Promise<Object>} ROI model
     */
    getDefaultModel: async (orgId) => {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM roi_models WHERE org_id = ? AND is_default = 1`,
                [orgId],
                (err, row) => {
                    if (err) return reject(err);
                    if (row) {
                        return resolve({
                            ...row,
                            assumptions: JSON.parse(row.assumptions || '{}'),
                            metric_mappings: JSON.parse(row.metric_mappings || '{}')
                        });
                    }

                    // Create default model
                    const id = `roi-${uuidv4()}`;
                    const defaultMappings = {
                        time_saved_mins: { formula: 'value * (hourly_cost / 60)', label: 'Time Saved' },
                        tasks_completed: { formula: 'value * task_avg_time_mins * (hourly_cost / 60)', label: 'Tasks Completed' },
                        tasks_blocked: { formula: 'value * -1 * downtime_cost_per_hour', label: 'Blocked Tasks (Cost)' }
                    };

                    db.run(
                        `INSERT INTO roi_models (id, org_id, name, description, assumptions, metric_mappings, is_default)
                         VALUES (?, ?, ?, ?, ?, ?, 1)`,
                        [id, orgId, 'Default ROI Model', 'Standard ROI calculation model', JSON.stringify(DEFAULT_ASSUMPTIONS), JSON.stringify(defaultMappings)],
                        function (err) {
                            if (err) return reject(err);
                            resolve({
                                id,
                                org_id: orgId,
                                name: 'Default ROI Model',
                                assumptions: DEFAULT_ASSUMPTIONS,
                                metric_mappings: defaultMappings,
                                is_default: 1
                            });
                        }
                    );
                }
            );
        });
    },

    /**
     * Calculate ROI from a set of measurements.
     * @param {string} orgId - Organization ID
     * @param {Array} measurements - Outcome measurements
     * @param {string} [modelId] - Optional specific model ID
     * @returns {Promise<Object>} ROI calculation result
     */
    calculateROI: async (orgId, measurements, modelId = null) => {
        let model;
        if (modelId) {
            model = await new Promise((resolve, reject) => {
                db.get(`SELECT * FROM roi_models WHERE id = ? AND org_id = ?`, [modelId, orgId], (err, row) => {
                    if (err) return reject(err);
                    resolve(row ? {
                        ...row,
                        assumptions: JSON.parse(row.assumptions || '{}'),
                        metric_mappings: JSON.parse(row.metric_mappings || '{}')
                    } : null);
                });
            });
        }

        if (!model) {
            model = await ROIService.getDefaultModel(orgId);
        }

        const { assumptions, metric_mappings } = model;
        let totalValue = 0;
        const breakdown = {};

        for (const measurement of measurements) {
            const delta = typeof measurement.delta_json === 'string'
                ? JSON.parse(measurement.delta_json)
                : measurement.delta_json;

            for (const [metric, deltaValue] of Object.entries(delta)) {
                const mapping = metric_mappings[metric];
                if (mapping && mapping.formula) {
                    const value = ROIService._evaluateFormula(mapping.formula, deltaValue, assumptions);
                    totalValue += value;

                    if (!breakdown[metric]) {
                        breakdown[metric] = { label: mapping.label || metric, value: 0, count: 0 };
                    }
                    breakdown[metric].value += value;
                    breakdown[metric].count += 1;
                }
            }
        }

        return {
            model_id: model.id,
            model_name: model.name,
            total_value: Math.round(totalValue * 100) / 100,
            currency: 'USD',
            breakdown,
            measurements_count: measurements.length,
            calculated_at: new Date().toISOString()
        };
    },

    /**
     * Estimate hours saved for an organization within a date range.
     * @param {string} orgId - Organization ID
     * @param {Object} dateRange - { from, to }
     * @returns {Promise<Object>} Hours saved estimation
     */
    estimateHoursSaved: async (orgId, dateRange = {}) => {
        const { from, to } = dateRange;
        const model = await ROIService.getDefaultModel(orgId);

        return new Promise((resolve, reject) => {
            let sql = `
                SELECT 
                    SUM(json_extract(delta_json, '$.tasks_completed')) as tasks_delta,
                    SUM(json_extract(delta_json, '$.time_saved_mins')) as time_saved_mins,
                    COUNT(*) as measurement_count
                FROM outcome_measurements
                WHERE org_id = ? AND computed_at IS NOT NULL
            `;
            const params = [orgId];

            if (from) {
                sql += ` AND computed_at >= ?`;
                params.push(from);
            }
            if (to) {
                sql += ` AND computed_at <= ?`;
                params.push(to);
            }

            db.get(sql, params, (err, row) => {
                if (err) return reject(err);

                const tasksDelta = row?.tasks_delta || 0;
                const directTimeSaved = row?.time_saved_mins || 0;

                // Tasks → Time: each task = avg time
                const taskTimeSaved = tasksDelta * (model.assumptions.task_avg_time_mins || 30);
                const totalMinutes = directTimeSaved + taskTimeSaved;
                const totalHours = Math.round(totalMinutes / 60 * 100) / 100;

                resolve({
                    hours_saved: totalHours,
                    minutes_saved: Math.round(totalMinutes),
                    from_tasks: Math.round(taskTimeSaved),
                    from_direct: Math.round(directTimeSaved),
                    measurement_count: row?.measurement_count || 0,
                    assumptions: {
                        task_avg_time_mins: model.assumptions.task_avg_time_mins
                    }
                });
            });
        });
    },

    /**
     * Estimate cost reduction for an organization.
     * @param {string} orgId - Organization ID
     * @param {Object} dateRange - { from, to }
     * @returns {Promise<Object>} Cost reduction estimation
     */
    estimateCostReduction: async (orgId, dateRange = {}) => {
        const hoursSaved = await ROIService.estimateHoursSaved(orgId, dateRange);
        const model = await ROIService.getDefaultModel(orgId);

        const hourlyCost = model.assumptions.hourly_cost || 75;
        const directCostSaved = hoursSaved.hours_saved * hourlyCost;
        const overheadMultiplier = model.assumptions.overhead_multiplier || 1.3;
        const totalSaved = directCostSaved * overheadMultiplier;

        return {
            cost_saved: Math.round(totalSaved * 100) / 100,
            direct_labor_saved: Math.round(directCostSaved * 100) / 100,
            overhead_savings: Math.round((totalSaved - directCostSaved) * 100) / 100,
            hours_saved: hoursSaved.hours_saved,
            currency: 'USD',
            assumptions: {
                hourly_cost: hourlyCost,
                overhead_multiplier: overheadMultiplier
            }
        };
    },

    /**
     * Get all ROI models for an organization.
     */
    getModels: async (orgId) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM roi_models WHERE org_id = ? ORDER BY is_default DESC, created_at DESC`,
                [orgId],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve((rows || []).map(r => ({
                        ...r,
                        assumptions: JSON.parse(r.assumptions || '{}'),
                        metric_mappings: JSON.parse(r.metric_mappings || '{}')
                    })));
                }
            );
        });
    },

    /**
     * Update ROI model assumptions.
     */
    updateModel: async (orgId, modelId, updates) => {
        const { name, description, assumptions, metric_mappings } = updates;

        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE roi_models SET 
                    name = COALESCE(?, name),
                    description = COALESCE(?, description),
                    assumptions = COALESCE(?, assumptions),
                    metric_mappings = COALESCE(?, metric_mappings),
                    updated_at = CURRENT_TIMESTAMP
                 WHERE id = ? AND org_id = ?`,
                [
                    name || null,
                    description || null,
                    assumptions ? JSON.stringify(assumptions) : null,
                    metric_mappings ? JSON.stringify(metric_mappings) : null,
                    modelId,
                    orgId
                ],
                function (err) {
                    if (err) return reject(err);
                    resolve({ updated: this.changes > 0 });
                }
            );
        });
    },

    // ==========================================
    // INTERNAL HELPERS
    // ==========================================

    /**
     * Evaluate a formula with given value and assumptions.
     * Formulas like "value * (hourly_cost / 60)"
     */
    _evaluateFormula: (formula, value, assumptions) => {
        try {
            // Build context with value and all assumptions
            const context = { value, ...assumptions };

            // Replace variable names with values
            let expr = formula;
            for (const [key, val] of Object.entries(context)) {
                expr = expr.replace(new RegExp(`\\b${key}\\b`, 'g'), val);
            }

            // Safe eval using Function constructor (no access to global scope)
            const fn = new Function(`return (${expr})`);
            return fn() || 0;
        } catch (e) {
            console.warn('[ROIService] Formula evaluation failed:', formula, e.message);
            return 0;
        }
    }
};

module.exports = ROIService;
