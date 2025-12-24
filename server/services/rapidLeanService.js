/**
 * RapidLean Assessment Service
 * 
 * Handles RapidLean operational excellence assessments with 6 core dimensions:
 * 1. Value Stream Efficiency
 * 2. Waste Elimination (7+1 wastes)
 * 3. Flow & Pull Systems
 * 4. Quality at Source
 * 5. Continuous Improvement Culture
 * 6. Visual Management
 * 
 * Scoring: 1 (Ad-hoc) - 5 (World-Class)
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');

class RapidLeanService {
    /**
     * Dimension weights for overall score calculation
     * Critical areas (Value Stream, Waste) carry 2x weight
     */
    static DIMENSION_WEIGHTS = {
        value_stream: 2.0,
        waste_elimination: 2.0,
        flow_pull: 1.0,
        quality_source: 1.0,
        continuous_improvement: 1.0,
        visual_management: 1.0
    };

    /**
     * Industry baseline scores (avg overall score)
     * Data sourced from Lean Enterprise Institute 2023 benchmarks
     */
    static INDUSTRY_BENCHMARKS = {
        MANUFACTURING: 3.8,
        AUTOMOTIVE: 4.2,
        HEALTHCARE: 3.5,
        SERVICES: 3.2,
        FINANCIAL: 2.9,
        TECHNOLOGY: 3.0,
        RETAIL: 3.4,
        DEFAULT: 3.3
    };

    /**
     * DRD Axis Mapping
     * Maps Lean dimensions to DRD axes for cross-framework analysis
     */
    static DRD_MAPPING = {
        value_stream: 'processes',
        waste_elimination: 'processes',
        flow_pull: 'processes',
        quality_source: 'processes',
        continuous_improvement: 'culture',
        visual_management: 'culture'
    };

    /**
     * Create a new RapidLean assessment
     * @param {Object} params - Assessment parameters
     * @param {string} params.organizationId - Organization ID
     * @param {string} params.projectId - Optional project ID
     * @param {Object} params.responses - Questionnaire responses (key-value pairs)
     * @param {string} params.userId - User creating the assessment
     * @returns {Promise<Object>} Created assessment with scores
     */
    static async createAssessment({ organizationId, projectId, responses, userId }) {
        try {
            // Calculate scores from responses
            const scores = this.calculateScores(responses);

            // Get industry benchmark
            const industry = await this.getOrganizationIndustry(organizationId);
            const benchmark = this.INDUSTRY_BENCHMARKS[industry] || this.INDUSTRY_BENCHMARKS.DEFAULT;

            // Generate AI recommendations
            const recommendations = await this.generateRecommendations(scores, benchmark);
            const topGaps = this.identifyTopGaps(scores, benchmark);

            const assessmentId = uuidv4();
            const sql = `
                INSERT INTO rapid_lean_assessments (
                    id, organization_id, project_id,
                    value_stream_score, waste_elimination_score, flow_pull_score,
                    quality_source_score, continuous_improvement_score, visual_management_score,
                    overall_score, industry_benchmark,
                    ai_recommendations, top_gaps, questionnaire_responses,
                    created_by, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            `;

            return new Promise((resolve, reject) => {
                db.run(sql, [
                    assessmentId,
                    organizationId,
                    projectId || null,
                    scores.value_stream,
                    scores.waste_elimination,
                    scores.flow_pull,
                    scores.quality_source,
                    scores.continuous_improvement,
                    scores.visual_management,
                    scores.overall,
                    benchmark,
                    JSON.stringify(recommendations),
                    JSON.stringify(topGaps),
                    JSON.stringify(responses),
                    userId
                ], function (err) {
                    if (err) {
                        console.error('[RapidLean] Error creating assessment:', err.message);
                        return reject(err);
                    }

                    console.log(`[RapidLean] Assessment created: ${assessmentId}`);
                    resolve({
                        id: assessmentId,
                        scores,
                        benchmark,
                        recommendations,
                        topGaps
                    });
                });
            });
        } catch (error) {
            console.error('[RapidLean] createAssessment error:', error);
            throw error;
        }
    }

    /**
     * Calculate scores from questionnaire responses
     * @param {Object} responses - Raw questionnaire responses
     * @returns {Object} Calculated scores for each dimension + overall
     */
    static calculateScores(responses) {
        // Extract dimension scores (assuming responses contain scored questions per dimension)
        const dimensionScores = {
            value_stream: this.calculateDimensionScore(responses, 'value_stream'),
            waste_elimination: this.calculateDimensionScore(responses, 'waste_elimination'),
            flow_pull: this.calculateDimensionScore(responses, 'flow_pull'),
            quality_source: this.calculateDimensionScore(responses, 'quality_source'),
            continuous_improvement: this.calculateDimensionScore(responses, 'continuous_improvement'),
            visual_management: this.calculateDimensionScore(responses, 'visual_management')
        };

        // Calculate weighted overall score
        const overallScore = this.calculateWeightedScore(dimensionScores);

        return {
            ...dimensionScores,
            overall: overallScore
        };
    }

    /**
     * Calculate score for a single dimension
     * @param {Object} responses - All responses
     * @param {string} dimension - Dimension name
     * @returns {number} Average score for dimension (1-5)
     */
    static calculateDimensionScore(responses, dimension) {
        const dimensionResponses = Object.keys(responses)
            .filter(key => key.startsWith(dimension))
            .map(key => responses[key]);

        if (dimensionResponses.length === 0) return 0;

        const sum = dimensionResponses.reduce((acc, val) => acc + parseFloat(val), 0);
        return Math.round((sum / dimensionResponses.length) * 10) / 10;
    }

    /**
     * Calculate weighted overall score
     * @param {Object} scores - Dimension scores
     * @returns {number} Weighted average (1-5)
     */
    static calculateWeightedScore(scores) {
        const totalWeight = Object.values(this.DIMENSION_WEIGHTS).reduce((a, b) => a + b, 0);

        const weightedSum = Object.keys(this.DIMENSION_WEIGHTS).reduce((sum, key) => {
            const scoreKey = key;  // e.g., 'value_stream'
            return sum + (scores[scoreKey] || 0) * this.DIMENSION_WEIGHTS[key];
        }, 0);

        return Math.round((weightedSum / totalWeight) * 10) / 10;
    }

    /**
     * Get assessment by ID
     * @param {string} assessmentId - Assessment ID
     * @param {string} organizationId - Organization ID (for security)
     * @returns {Promise<Object>} Assessment data
     */
    static async getAssessment(assessmentId, organizationId) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM rapid_lean_assessments WHERE id = ? AND organization_id = ?`;

            db.get(sql, [assessmentId, organizationId], (err, row) => {
                if (err) {
                    console.error('[RapidLean] Error fetching assessment:', err.message);
                    return reject(err);
                }

                if (!row) {
                    return reject(new Error('Assessment not found'));
                }

                // Parse JSON fields
                row.ai_recommendations = JSON.parse(row.ai_recommendations || '[]');
                row.top_gaps = JSON.parse(row.top_gaps || '[]');
                row.questionnaire_responses = JSON.parse(row.questionnaire_responses || '{}');

                resolve(row);
            });
        });
    }

    /**
     * Get all assessments for a project
     * @param {string} projectId - Project ID
     * @param {string} organizationId - Organization ID
     * @returns {Promise<Array>} List of assessments
     */
    static async getProjectAssessments(projectId, organizationId) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT id, assessment_date, overall_score, industry_benchmark, created_by
                FROM rapid_lean_assessments
                WHERE project_id = ? AND organization_id = ?
                ORDER BY assessment_date DESC
            `;

            db.all(sql, [projectId, organizationId], (err, rows) => {
                if (err) {
                    console.error('[RapidLean] Error fetching assessments:', err.message);
                    return reject(err);
                }

                resolve(rows || []);
            });
        });
    }

    /**
     * Get organization industry type
     * @param {string} organizationId - Organization ID
     * @returns {Promise<string>} Industry code
     */
    static async getOrganizationIndustry(organizationId) {
        return new Promise((resolve, reject) => {
            db.get('SELECT name FROM organizations WHERE id = ?', [organizationId], (err, row) => {
                if (err) return reject(err);

                // TODO: Implement proper industry detection
                // For now, return DEFAULT
                resolve('DEFAULT');
            });
        });
    }

    /**
     * Generate AI-powered recommendations
     * @param {Object} scores - Dimension scores
     * @param {number} benchmark - Industry benchmark
     * @returns {Promise<Array>} Recommendations
     */
    static async generateRecommendations(scores, benchmark) {
        // TODO: Integrate with aiService for advanced recommendations
        // For now, return rule-based recommendations

        const recommendations = [];

        if (scores.waste_elimination < 3) {
            recommendations.push({
                dimension: 'waste_elimination',
                priority: 'HIGH',
                recommendation: 'Implement 5S methodology and conduct value stream mapping to identify and eliminate the 7+1 wastes',
                expectedImpact: 'Reduce non-value-added time by 20-30%'
            });
        }

        if (scores.continuous_improvement < 3) {
            recommendations.push({
                dimension: 'continuous_improvement',
                priority: 'HIGH',
                recommendation: 'Establish monthly Kaizen events and implement employee suggestion system',
                expectedImpact: 'Increase improvement ideas by 40-50%'
            });
        }

        if (scores.value_stream < benchmark) {
            recommendations.push({
                dimension: 'value_stream',
                priority: 'MEDIUM',
                recommendation: 'Map current-state value stream and identify bottlenecks causing delays',
                expectedImpact: 'Reduce cycle time by 15-25%'
            });
        }

        if (scores.visual_management < 3) {
            recommendations.push({
                dimension: 'visual_management',
                priority: 'MEDIUM',
                recommendation: 'Deploy visual KPI boards at production floor level and implement Andon system',
                expectedImpact: 'Improve problem visibility by 60%'
            });
        }

        return recommendations;
    }

    /**
     * Identify top 3 gaps compared to benchmark
     * @param {Object} scores - Dimension scores
     * @param {number} benchmark - Industry benchmark
     * @returns {Array} Top gaps
     */
    static identifyTopGaps(scores, benchmark) {
        const gaps = Object.keys(scores)
            .filter(key => key !== 'overall')
            .map(dimension => ({
                dimension,
                score: scores[dimension],
                gap: benchmark - scores[dimension]
            }))
            .filter(item => item.gap > 0)
            .sort((a, b) => b.gap - a.gap)
            .slice(0, 3)
            .map(item => item.dimension);

        return gaps;
    }

    /**
     * Map Lean assessment to DRD axes
     * @param {Object} assessment - RapidLean assessment
     * @param {Array} observations - Optional observations for enhanced mapping
     * @returns {Object} DRD axis scores
     */
    static async mapToDRD(assessment, observations = null) {
        const drdScores = {};

        Object.keys(this.DRD_MAPPING).forEach(leanDimension => {
            const drdAxis = this.DRD_MAPPING[leanDimension];
            const leanScore = assessment[`${leanDimension}_score`];

            // Convert 1-5 Lean scale to 1-7 DRD scale
            const baseScore = this.convertScaleToDRD(leanScore);

            // Enhance with observation-based evidence if available
            let finalScore = baseScore;
            if (observations && observations.length > 0) {
                const observationEvidence = this.analyzeObservationsForDRD(
                    observations,
                    leanDimension,
                    drdAxis
                );
                if (observationEvidence) {
                    finalScore = this.combineScores(baseScore, observationEvidence);
                }
            }

            if (!drdScores[drdAxis]) {
                drdScores[drdAxis] = [];
            }
            drdScores[drdAxis].push(finalScore);
        });

        // Average scores for each DRD axis
        const averagedScores = {};
        Object.keys(drdScores).forEach(axis => {
            const scores = drdScores[axis];
            averagedScores[axis] = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
        });

        return averagedScores;
    }

    /**
     * Convert Lean 1-5 scale to DRD 1-7 scale
     * @param {number} leanScore - Score on 1-5 scale
     * @returns {number} Score on 1-7 scale
     */
    static convertScaleToDRD(leanScore) {
        // Linear interpolation: (leanScore - 1) / 4 * 6 + 1
        return Math.round(((leanScore - 1) / 4 * 6 + 1) * 10) / 10;
    }

    /**
     * Get observations for an assessment
     * @param {string} assessmentId - Assessment ID
     * @returns {Promise<Array>} Observations array
     */
    static async getObservations(assessmentId) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT * FROM rapid_lean_observations
                WHERE assessment_id = ?
                ORDER BY timestamp ASC
            `;

            db.all(sql, [assessmentId], (err, rows) => {
                if (err) {
                    console.error('[RapidLean] Error fetching observations:', err.message);
                    return reject(err);
                }

                // Parse JSON fields
                const parsed = (rows || []).map(row => ({
                    ...row,
                    answers: JSON.parse(row.answers || '{}'),
                    photos: JSON.parse(row.photos || '[]')
                }));

                resolve(parsed);
            });
        });
    }

    /**
     * Analyze observations for DRD mapping
     * @param {Array} observations - Observations array
     * @param {string} leanDimension - Lean dimension name
     * @param {string} drdAxis - DRD axis name
     * @returns {number|null} Evidence-based score adjustment or null
     */
    static analyzeObservationsForDRD(observations, leanDimension, drdAxis) {
        const { OBSERVATION_TO_DRD_MAPPING } = require('../data/rapidLeanObservationTemplates');
        const dimensionMapping = OBSERVATION_TO_DRD_MAPPING[leanDimension] || {};

        let evidenceScores = [];

        observations.forEach(obs => {
            if (obs.templateId && obs.templateId.includes(leanDimension)) {
                Object.keys(obs.answers).forEach(itemId => {
                    const answer = obs.answers[itemId];
                    const mappingKey = `${itemId}_${answer}`;
                    
                    if (dimensionMapping[mappingKey]) {
                        const drdLevel = dimensionMapping[mappingKey].level;
                        if (drdLevel && dimensionMapping[mappingKey].axis === (drdAxis === 'processes' ? 1 : 5)) {
                            evidenceScores.push(drdLevel);
                        }
                    }
                });
            }
        });

        if (evidenceScores.length === 0) return null;

        // Average evidence scores
        const avgEvidence = evidenceScores.reduce((a, b) => a + b, 0) / evidenceScores.length;
        return Math.round(avgEvidence * 10) / 10;
    }

    /**
     * Combine base score with evidence-based adjustment
     * @param {number} baseScore - Base score from questionnaire
     * @param {number} evidenceScore - Evidence-based score from observations
     * @returns {number} Combined score
     */
    static combineScores(baseScore, evidenceScore) {
        // Weighted average: 70% base score, 30% evidence
        return Math.round((baseScore * 0.7 + evidenceScore * 0.3) * 10) / 10;
    }

    /**
     * Calculate DRD gaps
     * @param {Object} drdMapping - DRD axis scores
     * @param {Object} targetLevels - Target DRD levels (optional)
     * @returns {Object} Gap analysis
     */
    static calculateDRDGaps(drdMapping, targetLevels = null) {
        const gaps = {};

        Object.keys(drdMapping).forEach(axis => {
            const current = drdMapping[axis];
            const target = targetLevels?.[axis] || 7; // Default target is level 7
            gaps[axis] = {
                current,
                target,
                gap: target - current,
                priority: target - current > 2 ? 'HIGH' : target - current > 1 ? 'MEDIUM' : 'LOW'
            };
        });

        return gaps;
    }

    /**
     * Generate pathways to target DRD levels
     * @param {Object} drdMapping - Current DRD scores
     * @param {Object} targetLevels - Target DRD levels
     * @returns {Object} Pathways for each axis
     */
    static generatePathways(drdMapping, targetLevels = null) {
        const pathways = {};

        Object.keys(drdMapping).forEach(axis => {
            const current = drdMapping[axis];
            const target = targetLevels?.[axis] || 7;
            const steps = [];

            for (let level = Math.ceil(current); level < target; level++) {
                steps.push({
                    from: level,
                    to: level + 1,
                    description: `Move from DRD Level ${level} to Level ${level + 1} for ${axis}`
                });
            }

            pathways[axis] = {
                current,
                target,
                steps,
                estimatedTime: steps.length * 3 // 3 months per level
            };
        });

        return pathways;
    }

    /**
     * Generate DRD-aligned recommendations
     * @param {Object} assessment - Assessment data
     * @param {Object} drdMapping - DRD mapping
     * @param {Object} projectContext - Project context (optional)
     * @returns {Promise<Array>} DRD-aligned recommendations
     */
    static async generateDRDRecommendations(assessment, drdMapping, projectContext = null) {
        const recommendations = [];
        const gaps = this.calculateDRDGaps(drdMapping, projectContext?.targetLevels);

        // Generate recommendations based on DRD gaps
        Object.keys(gaps).forEach(axis => {
            const gap = gaps[axis];
            if (gap.gap > 1) {
                recommendations.push({
                    axis,
                    priority: gap.priority,
                    recommendation: `Improve ${axis} maturity from ${gap.current.toFixed(1)} to ${gap.target.toFixed(1)}`,
                    expectedImpact: `Addresses ${gap.gap.toFixed(1)} point gap in DRD ${axis} axis`,
                    drdLevel: gap.current
                });
            }
        });

        return recommendations;
    }

    /**
     * Get project context for DRD recommendations
     * @param {string} organizationId - Organization ID
     * @returns {Promise<Object>} Project context
     */
    static async getProjectContext(organizationId) {
        // TODO: Fetch actual project context from database
        // For now, return default structure
        return {
            targetLevels: {
                processes: 7,
                culture: 7
            }
        };
    }
}

module.exports = RapidLeanService;
