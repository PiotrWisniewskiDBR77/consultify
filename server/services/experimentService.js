/**
 * Experiment Service (A/B Testing)
 * 
 * Manages feature flags and experiment assignments.
 */

const { v4: uuidv4 } = require('uuid');

// Lazy-loaded database
let db = null;
const getDb = () => {
    if (!db) {
        try {
            db = require('../db/sqliteAsync');
        } catch (e) {
            db = require('../database');
        }
    }
    return db;
};

// Defined Experiments
const EXPERIMENTS = {
    'new_onboarding_flow': {
        variants: ['A', 'B'],
        weights: [0.5, 0.5],
        description: 'New guided onboarding vs classic checklist'
    },
    'gamification_v1': {
        variants: ['control', 'active'],
        weights: [0.2, 0.8],
        description: 'Enable gamification features'
    }
};

const ExperimentService = {
    /**
     * Get user variant for an experiment.
     * Assigns one if not present.
     */
    async getUserVariant(userId, experimentId) {
        const config = EXPERIMENTS[experimentId];
        if (!config) throw new Error(`Unknown experiment: ${experimentId}`);

        const db = getDb();

        // Check existing assignment
        const existing = await new Promise((resolve) => {
            db.get(
                `SELECT variant FROM user_experiments WHERE user_id = ? AND experiment_id = ?`,
                [userId, experimentId],
                (err, row) => resolve(row ? row.variant : null)
            );
        });

        if (existing) return existing;

        // Assign new variant
        const variant = this.assignVariant(config.variants, config.weights);
        const id = uuidv4();

        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO user_experiments (id, user_id, experiment_id, variant, assigned_at)
                 VALUES (?, ?, ?, ?, datetime('now'))`,
                [id, userId, experimentId, variant],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        return variant;
    },

    assignVariant(variants, weights) {
        const random = Math.random();
        let sum = 0;
        for (let i = 0; i < variants.length; i++) {
            sum += weights[i];
            if (random < sum) return variants[i];
        }
        return variants[0];
    },

    /**
     * Get all active experiments for user
     */
    async getAllUserExperiments(userId) {
        const results = {};
        for (const expId of Object.keys(EXPERIMENTS)) {
            results[expId] = await this.getUserVariant(userId, expId);
        }
        return results;
    }
};

module.exports = ExperimentService;
