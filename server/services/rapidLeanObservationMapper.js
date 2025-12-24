/**
 * RapidLean Observation Mapper Service
 * Maps production floor observations to RapidLean questionnaire scores
 * Converts operator observations into structured assessment data
 */

const { OBSERVATION_TO_SCORE_MAPPING, getTemplateById } = require('../data/rapidLeanObservationTemplates');

class RapidLeanObservationMapper {
    /**
     * Convert observations to RapidLean questionnaire responses
     * @param {Array} observations - Array of observation data from templates
     * @returns {Object} RapidLean questionnaire responses (questionId -> score)
     */
    static mapObservationsToResponses(observations) {
        const responses = {};

        // Process each observation template
        observations.forEach(obs => {
            const dimension = this.getDimensionFromTemplate(obs.templateId);
            const dimensionMapping = OBSERVATION_TO_SCORE_MAPPING[dimension] || {};

            // Map each answer to a score
            Object.keys(obs.answers).forEach(itemId => {
                const answer = obs.answers[itemId];
                const mappingKey = `${itemId}_${answer}`;
                
                if (dimensionMapping[mappingKey] !== undefined) {
                    // Map to corresponding RapidLean question
                    const questionId = this.mapToQuestionId(dimension, itemId);
                    if (questionId) {
                        // Average if multiple observations map to same question
                        if (responses[questionId]) {
                            responses[questionId] = (responses[questionId] + dimensionMapping[mappingKey]) / 2;
                        } else {
                            responses[questionId] = dimensionMapping[mappingKey];
                        }
                    }
                }
            });

            // Use AI to analyze notes/photos for additional scoring (optional enhancement)
            // For now, we'll use rule-based scoring from yes/no answers
        });

        // Ensure all 18 questions have scores (default to 2 if missing)
        const allQuestionIds = this.getAllQuestionIds();
        allQuestionIds.forEach(qId => {
            if (!responses[qId]) {
                responses[qId] = 2; // Default: Emerging level
            }
        });

        return responses;
    }

    /**
     * Get dimension from template ID
     * @param {string} templateId - Template ID
     * @returns {string} Dimension name
     */
    static getDimensionFromTemplate(templateId) {
        const mapping = {
            'value_stream_template': 'value_stream',
            'waste_template': 'waste_elimination',
            'flow_pull_template': 'flow_pull',
            'quality_template': 'quality_source',
            'ci_template': 'continuous_improvement',
            'visual_template': 'visual_management'
        };
        return mapping[templateId] || '';
    }

    /**
     * Map observation item to RapidLean question ID
     * @param {string} dimension - Lean dimension
     * @param {string} itemId - Observation item ID
     * @returns {string|null} RapidLean question ID
     */
    static mapToQuestionId(dimension, itemId) {
        // Map observation item to RapidLean question
        const mappings = {
            'value_stream': {
                'vs_1': 'value_stream_1',
                'vs_2': 'value_stream_2',
                'vs_4': 'value_stream_3'
            },
            'waste_elimination': {
                'waste_1': 'waste_elimination_1',
                'waste_2': 'waste_elimination_1',
                'waste_3': 'waste_elimination_1',
                'waste_4': 'waste_elimination_2',
                'waste_5': 'waste_elimination_2',
                'waste_6': 'waste_elimination_2',
                'waste_7': 'waste_elimination_3',
                'waste_8': 'waste_elimination_3'
            },
            'flow_pull': {
                'flow_1': 'flow_pull_1',
                'flow_2': 'flow_pull_2',
                'flow_4': 'flow_pull_3'
            },
            'quality_source': {
                'qual_1': 'quality_source_1',
                'qual_2': 'quality_source_2',
                'qual_3': 'quality_source_3'
            },
            'continuous_improvement': {
                'ci_1': 'continuous_improvement_1',
                'ci_2': 'continuous_improvement_2'
            },
            'visual_management': {
                'vis_1': 'visual_management_1',
                'vis_2': 'visual_management_2',
                'vis_3': 'visual_management_3'
            }
        };
        return mappings[dimension]?.[itemId] || null;
    }

    /**
     * Get all RapidLean question IDs
     * @returns {Array} All question IDs
     */
    static getAllQuestionIds() {
        return [
            'value_stream_1', 'value_stream_2', 'value_stream_3',
            'waste_elimination_1', 'waste_elimination_2', 'waste_elimination_3',
            'flow_pull_1', 'flow_pull_2', 'flow_pull_3',
            'quality_source_1', 'quality_source_2', 'quality_source_3',
            'continuous_improvement_1', 'continuous_improvement_2', 'continuous_improvement_3',
            'visual_management_1', 'visual_management_2', 'visual_management_3'
        ];
    }

    /**
     * Generate comprehensive report from observations
     * @param {Array} observations - All observations
     * @param {Object} assessment - Generated RapidLean assessment
     * @returns {Object} Report data
     */
    static generateObservationReport(observations, assessment) {
        return {
            summary: {
                totalObservations: observations.length,
                locations: [...new Set(observations.map(o => o.location))],
                dateRange: {
                    start: observations[0]?.timestamp,
                    end: observations[observations.length - 1]?.timestamp
                },
                photosCount: observations.reduce((sum, o) => sum + (o.photos?.length || 0), 0)
            },
            observations: observations.map(obs => ({
                template: obs.templateId,
                location: obs.location,
                timestamp: obs.timestamp,
                keyFindings: this.extractKeyFindings(obs),
                photos: obs.photos
            })),
            assessment: {
                overallScore: assessment.overall_score,
                dimensionScores: {
                    value_stream: assessment.value_stream_score,
                    waste_elimination: assessment.waste_elimination_score,
                    flow_pull: assessment.flow_pull_score,
                    quality_source: assessment.quality_source_score,
                    continuous_improvement: assessment.continuous_improvement_score,
                    visual_management: assessment.visual_management_score
                },
                recommendations: assessment.ai_recommendations || []
            },
            insights: this.generateInsights(observations, assessment)
        };
    }

    /**
     * Extract key findings from observation
     * @param {Object} observation - Observation data
     * @returns {Array} Key findings
     */
    static extractKeyFindings(observation) {
        const findings = [];
        Object.keys(observation.answers).forEach(key => {
            const answer = observation.answers[key];
            if (answer === false || answer === 'no' || answer === 0) {
                findings.push(`Missing: ${key}`);
            } else if (answer === true || answer === 'yes') {
                findings.push(`Present: ${key}`);
            }
        });
        return findings;
    }

    /**
     * Generate insights from observations and assessment
     * @param {Array} observations - All observations
     * @param {Object} assessment - Assessment data
     * @returns {Object} Insights
     */
    static generateInsights(observations, assessment) {
        const strengths = [];
        const weaknesses = [];
        const opportunities = [];

        // Analyze observations for patterns
        observations.forEach(obs => {
            const template = getTemplateById(obs.templateId);
            if (!template) return;

            // Count positive vs negative answers
            let positiveCount = 0;
            let negativeCount = 0;

            Object.values(obs.answers).forEach(answer => {
                if (answer === true || answer === 'yes' || (typeof answer === 'number' && answer > 0)) {
                    positiveCount++;
                } else if (answer === false || answer === 'no' || answer === 0) {
                    negativeCount++;
                }
            });

            if (positiveCount > negativeCount) {
                strengths.push(template.name);
            } else if (negativeCount > positiveCount) {
                weaknesses.push(template.name);
                opportunities.push(`Improve ${template.name} practices`);
            }
        });

        return {
            strengths,
            weaknesses,
            opportunities
        };
    }

    /**
     * Analyze notes and photos for additional scoring (AI-powered, optional)
     * @param {string} notes - Observation notes
     * @param {Array} photos - Photo URLs
     * @param {string} dimension - Lean dimension
     * @returns {number|null} Additional score (1-5) or null if not analyzed
     */
    static async analyzeNotesAndPhotos(notes, photos, dimension) {
        // TODO: Integrate with AI service for advanced analysis
        // For now, return null (rule-based scoring from yes/no answers is used)
        return null;
    }
}

module.exports = RapidLeanObservationMapper;

