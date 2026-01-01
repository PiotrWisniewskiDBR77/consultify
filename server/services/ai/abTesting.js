/**
 * A/B Testing Framework for AI Prompts
 * 
 * Features:
 * - Variant assignment and tracking
 * - Statistical analysis
 * - Automatic winner selection
 * - Gradual rollout
 */

const { queryRun, queryOne, queryAll } = require('../../utils/queryHelpers');
const { aiLogger } = require('./logger');

class ABTestingService {
    constructor() {
        this.activeExperiments = new Map();
        this.cacheRefreshInterval = 60000; // 1 minute
        this.lastRefresh = 0;
    }

    /**
     * Create a new A/B test experiment
     */
    async createExperiment(config) {
        const {
            name,
            description,
            promptId,
            variants,
            trafficSplit = [50, 50],
            minSampleSize = 100,
            confidenceLevel = 0.95,
            primaryMetric = 'user_satisfaction',
            createdBy
        } = config;

        if (!name || !promptId || !variants || variants.length < 2) {
            throw new Error('Invalid experiment configuration');
        }

        const id = require('crypto').randomUUID();

        await queryRun(`
            INSERT INTO ai_ab_experiments 
            (id, name, description, prompt_id, variants, traffic_split, 
             min_sample_size, confidence_level, primary_metric, 
             status, created_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, datetime('now'))
        `, [
            id, name, description, promptId,
            JSON.stringify(variants),
            JSON.stringify(trafficSplit),
            minSampleSize, confidenceLevel, primaryMetric, createdBy
        ]);

        aiLogger.info('ABTesting', `Created experiment: ${name} (${id})`);

        return { id, name, status: 'draft' };
    }

    /**
     * Start an experiment
     */
    async startExperiment(experimentId, userId) {
        const experiment = await this.getExperiment(experimentId);
        if (!experiment) {
            throw new Error('Experiment not found');
        }

        if (experiment.status !== 'draft') {
            throw new Error(`Cannot start experiment with status: ${experiment.status}`);
        }

        await queryRun(`
            UPDATE ai_ab_experiments 
            SET status = 'running', started_at = datetime('now')
            WHERE id = ?
        `, [experimentId]);

        // Invalidate cache
        this.activeExperiments.delete(experimentId);
        this.lastRefresh = 0;

        aiLogger.info('ABTesting', `Started experiment: ${experimentId}`);

        return { success: true };
    }

    /**
     * Stop an experiment
     */
    async stopExperiment(experimentId, reason = 'manual') {
        await queryRun(`
            UPDATE ai_ab_experiments 
            SET status = 'stopped', ended_at = datetime('now'), stop_reason = ?
            WHERE id = ?
        `, [reason, experimentId]);

        this.activeExperiments.delete(experimentId);
        this.lastRefresh = 0;

        aiLogger.info('ABTesting', `Stopped experiment: ${experimentId} (${reason})`);

        return { success: true };
    }

    /**
     * Get variant for a user/session
     */
    async getVariant(promptId, userId) {
        await this.refreshActiveExperiments();

        // Find active experiment for this prompt
        for (const [expId, exp] of this.activeExperiments) {
            if (exp.prompt_id === promptId && exp.status === 'running') {
                // Deterministic assignment based on user ID
                const variant = this.assignVariant(userId, exp);
                
                // Record assignment
                await this.recordAssignment(expId, userId, variant.index);
                
                return {
                    experimentId: expId,
                    variantIndex: variant.index,
                    variant: variant.data
                };
            }
        }

        return null; // No active experiment
    }

    /**
     * Deterministic variant assignment
     */
    assignVariant(userId, experiment) {
        const variants = JSON.parse(experiment.variants);
        const trafficSplit = JSON.parse(experiment.traffic_split);
        
        // Create hash from user ID + experiment ID
        const hash = this.simpleHash(`${userId}-${experiment.id}`);
        const bucket = hash % 100;

        // Find variant based on traffic split
        let cumulative = 0;
        for (let i = 0; i < variants.length; i++) {
            cumulative += trafficSplit[i];
            if (bucket < cumulative) {
                return { index: i, data: variants[i] };
            }
        }

        return { index: 0, data: variants[0] };
    }

    /**
     * Simple hash function
     */
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }

    /**
     * Record variant assignment
     */
    async recordAssignment(experimentId, userId, variantIndex) {
        try {
            await queryRun(`
                INSERT OR IGNORE INTO ai_ab_assignments 
                (id, experiment_id, user_id, variant_index, assigned_at)
                VALUES (?, ?, ?, ?, datetime('now'))
            `, [require('crypto').randomUUID(), experimentId, userId, variantIndex]);
        } catch (error) {
            // Ignore duplicate assignment errors
            aiLogger.debug('ABTesting', `Assignment recorded or exists for ${userId}`);
        }
    }

    /**
     * Record experiment outcome/event
     */
    async recordOutcome(experimentId, userId, metric, value) {
        try {
            // Get user's variant
            const assignment = await queryOne(`
                SELECT variant_index FROM ai_ab_assignments
                WHERE experiment_id = ? AND user_id = ?
            `, [experimentId, userId]);

            if (!assignment) {
                aiLogger.warn('ABTesting', `No assignment found for user ${userId} in experiment ${experimentId}`);
                return;
            }

            await queryRun(`
                INSERT INTO ai_ab_outcomes 
                (id, experiment_id, user_id, variant_index, metric, value, recorded_at)
                VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
            `, [
                require('crypto').randomUUID(),
                experimentId, userId, assignment.variant_index,
                metric, value
            ]);

            aiLogger.debug('ABTesting', `Recorded outcome: ${metric}=${value} for variant ${assignment.variant_index}`);

            // Check if we should stop the experiment
            await this.checkExperimentConclusion(experimentId);
        } catch (error) {
            aiLogger.error('ABTesting', `Error recording outcome: ${error.message}`);
        }
    }

    /**
     * Get experiment statistics
     */
    async getExperimentStats(experimentId) {
        const experiment = await this.getExperiment(experimentId);
        if (!experiment) {
            throw new Error('Experiment not found');
        }

        const variants = JSON.parse(experiment.variants);

        // Get sample sizes
        const sampleSizes = await queryAll(`
            SELECT variant_index, COUNT(*) as count
            FROM ai_ab_assignments
            WHERE experiment_id = ?
            GROUP BY variant_index
        `, [experimentId]);

        // Get outcome stats for primary metric
        const outcomes = await queryAll(`
            SELECT variant_index, 
                   AVG(value) as mean, 
                   COUNT(*) as count,
                   MIN(value) as min,
                   MAX(value) as max
            FROM ai_ab_outcomes
            WHERE experiment_id = ? AND metric = ?
            GROUP BY variant_index
        `, [experimentId, experiment.primary_metric]);

        // Calculate statistical significance
        const stats = this.calculateStats(outcomes, experiment.confidence_level);

        return {
            experiment: {
                id: experiment.id,
                name: experiment.name,
                status: experiment.status,
                startedAt: experiment.started_at,
                primaryMetric: experiment.primary_metric
            },
            variants: variants.map((v, i) => {
                const sample = sampleSizes.find(s => s.variant_index === i) || { count: 0 };
                const outcome = outcomes.find(o => o.variant_index === i) || { mean: 0, count: 0 };
                return {
                    index: i,
                    name: v.name || `Variant ${i}`,
                    sampleSize: sample.count,
                    outcomeCount: outcome.count,
                    mean: outcome.mean,
                    min: outcome.min,
                    max: outcome.max
                };
            }),
            analysis: stats,
            minSampleSize: experiment.min_sample_size,
            totalSamples: sampleSizes.reduce((a, b) => a + b.count, 0)
        };
    }

    /**
     * Calculate statistical significance
     */
    calculateStats(outcomes, confidenceLevel) {
        if (outcomes.length < 2) {
            return { 
                isSignificant: false, 
                message: 'Insufficient variants with data' 
            };
        }

        const control = outcomes.find(o => o.variant_index === 0);
        const treatment = outcomes.find(o => o.variant_index === 1);

        if (!control || !treatment || control.count < 10 || treatment.count < 10) {
            return { 
                isSignificant: false, 
                message: 'Insufficient sample size',
                controlMean: control?.mean || 0,
                treatmentMean: treatment?.mean || 0
            };
        }

        // Simplified significance test (would use proper t-test in production)
        const diff = Math.abs(treatment.mean - control.mean);
        const pooledStd = Math.sqrt(
            ((control.mean * 0.1) ** 2 / control.count) + 
            ((treatment.mean * 0.1) ** 2 / treatment.count)
        );

        const zScore = pooledStd > 0 ? diff / pooledStd : 0;
        const requiredZ = confidenceLevel === 0.95 ? 1.96 : 2.58;

        const isSignificant = zScore > requiredZ;
        const winner = treatment.mean > control.mean ? 1 : 0;
        const lift = control.mean > 0 
            ? ((treatment.mean - control.mean) / control.mean * 100)
            : 0;

        return {
            isSignificant,
            zScore: Math.round(zScore * 100) / 100,
            requiredZ,
            controlMean: control.mean,
            treatmentMean: treatment.mean,
            lift: Math.round(lift * 100) / 100,
            winner: isSignificant ? winner : null,
            message: isSignificant 
                ? `Variant ${winner} is statistically better with ${lift.toFixed(1)}% lift`
                : 'No significant difference yet'
        };
    }

    /**
     * Check if experiment should be concluded
     */
    async checkExperimentConclusion(experimentId) {
        const stats = await this.getExperimentStats(experimentId);

        // Check minimum sample size
        if (stats.totalSamples < stats.minSampleSize) {
            return false;
        }

        // Check if significant
        if (stats.analysis.isSignificant) {
            await this.stopExperiment(experimentId, 'significant_result');
            aiLogger.info('ABTesting', 
                `Experiment ${experimentId} concluded: Variant ${stats.analysis.winner} wins`);
            return true;
        }

        // Check if too many samples without significance
        if (stats.totalSamples > stats.minSampleSize * 5) {
            await this.stopExperiment(experimentId, 'no_significant_difference');
            aiLogger.info('ABTesting', 
                `Experiment ${experimentId} stopped: No significant difference after ${stats.totalSamples} samples`);
            return true;
        }

        return false;
    }

    /**
     * Get single experiment
     */
    async getExperiment(experimentId) {
        return await queryOne(`SELECT * FROM ai_ab_experiments WHERE id = ?`, [experimentId]);
    }

    /**
     * List experiments
     */
    async listExperiments(filters = {}) {
        let query = `SELECT * FROM ai_ab_experiments WHERE 1=1`;
        const params = [];

        if (filters.status) {
            query += ` AND status = ?`;
            params.push(filters.status);
        }

        if (filters.promptId) {
            query += ` AND prompt_id = ?`;
            params.push(filters.promptId);
        }

        query += ` ORDER BY created_at DESC`;

        return await queryAll(query, params);
    }

    /**
     * Refresh active experiments cache
     */
    async refreshActiveExperiments() {
        if (Date.now() - this.lastRefresh < this.cacheRefreshInterval) {
            return;
        }

        const experiments = await queryAll(`
            SELECT * FROM ai_ab_experiments WHERE status = 'running'
        `);

        this.activeExperiments.clear();
        for (const exp of experiments) {
            this.activeExperiments.set(exp.id, exp);
        }

        this.lastRefresh = Date.now();
    }
}

// Singleton instance
const abTestingService = new ABTestingService();

module.exports = {
    ABTestingService,
    abTestingService,
    abTesting: abTestingService // Alias for API routes
};
