/**
 * ADKAR Scoring Service
 * Change Readiness Assessment scoring and analysis
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');

class ADKARService {
    /**
     * Calculate ADKAR scores
     * @param {Object} responses - Question responses (1-5 scale)
     * @returns {Object} Calculated scores
     */
    static calculateScores(responses) {
        const dimensionScores = {
            awareness: [],
            desire: [],
            knowledge: [],
            ability: [],
            reinforcement: []
        };

        // Group responses by dimension
        Object.keys(responses).forEach(questionId => {
            const dimension = questionId.split('_')[0]; // e.g., "awareness_1" -> "awareness"
            if (dimensionScores[dimension]) {
                dimensionScores[dimension].push(responses[questionId]);
            }
        });

        // Calculate averages
        const scores = {};
        let totalSum = 0;
        let dimensionCount = 0;

        Object.keys(dimensionScores).forEach(dimension => {
            const dimScores = dimensionScores[dimension];
            if (dimScores.length > 0) {
                const avg = dimScores.reduce((sum, score) => sum + score, 0) / dimScores.length;
                scores[`${dimension}_score`] = avg;
                totalSum += avg;
                dimensionCount++;
            }
        });

        scores.overall_score = dimensionCount > 0 ? totalSum / dimensionCount : 0;

        return scores;
    }

    /**
     * Identify weakest dimensions (change readiness gaps)
     * @param {Object} scores - Dimension scores
     * @param {number} threshold - Gap threshold
     * @returns {Array} Weakest dimensions
     */
    static identifyGaps(scores, threshold = 3.0) {
        const gaps = [];

        ['awareness', 'desire', 'knowledge', 'ability', 'reinforcement'].forEach(dim => {
            const score = scores[`${dim}_score`];
            if (score && score < threshold) {
                gaps.push({
                    dimension: dim,
                    score,
                    gap: threshold - score
                });
            }
        });

        return gaps.sort((a, b) => b.gap - a.gap);
    }

    /**
     * Generate change readiness recommendations
     * @param {Object} scores - Assessment scores
     * @returns {Array} Recommendations
     */
    static generateRecommendations(scores) {
        const gaps = this.identifyGaps(scores);
        const recommendations = [];

        gaps.forEach(gap => {
            let recommendation = '';

            switch (gap.dimension) {
                case 'awareness':
                    recommendation = 'Increase communication about WHY change is needed. Share business case and urgency.';
                    break;
                case 'desire':
                    recommendation = 'Build personal motivation through leadership buy-in and WIIFM (What\'s In It For Me) messaging.';
                    break;
                case 'knowledge':
                    recommendation = 'Provide comprehensive training programs and accessible documentation.';
                    break;
                case 'ability':
                    recommendation = 'Offer hands-on practice, coaching, and support resources to build skills.';
                    break;
                case 'reinforcement':
                    recommendation = 'Implement recognition programs, celebrate wins, and address backsliding promptly.';
                    break;
            }

            recommendations.push({
                dimension: gap.dimension,
                score: gap.score,
                recommendation,
                priority: gap.gap > 1.5 ? 'High' : 'Medium'
            });
        });

        return recommendations;
    }

    /**
     * Create ADKAR assessment
     * @param {Object} data - Assessment data
     * @returns {Promise<Object>} Created assessment
     */
    static async createAssessment(data) {
        const { organizationId, projectId, responses, userId } = data;

        const scores = this.calculateScores(responses);
        const recommendations = this.generateRecommendations(scores);

        const assessmentId = uuidv4();

        const sql = `
            INSERT INTO adkar_assessments (
                id, organization_id, project_id,
                awareness_score, desire_score, knowledge_score, ability_score, reinforcement_score,
                overall_score, questionnaire_responses, ai_recommendations,
                created_by, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `;

        await new Promise((resolve, reject) => {
            db.run(sql, [
                assessmentId,
                organizationId,
                projectId,
                scores.awareness_score,
                scores.desire_score,
                scores.knowledge_score,
                scores.ability_score,
                scores.reinforcement_score,
                scores.overall_score,
                JSON.stringify(responses),
                JSON.stringify(recommendations),
                userId
            ], function (err) {
                if (err) return reject(err);
                resolve();
            });
        });

        return {
            id: assessmentId,
            ...scores,
            recommendations
        };
    }

    /**
     * Get ADKAR assessment by ID
     */
    static async getAssessment(assessmentId) {
        return new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM adkar_assessments WHERE id = ?',
                [assessmentId],
                (err, row) => {
                    if (err) return reject(err);
                    if (row) {
                        row.questionnaire_responses = JSON.parse(row.questionnaire_responses || '{}');
                        row.ai_recommendations = JSON.parse(row.ai_recommendations || '[]');
                    }
                    resolve(row);
                }
            );
        });
    }
}

module.exports = ADKARService;
