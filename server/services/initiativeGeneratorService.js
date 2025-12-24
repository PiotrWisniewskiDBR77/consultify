/**
 * Initiative Generator Service
 * 
 * AI-powered initiative generation from consolidated assessment gaps.
 * Converts multi-source assessment data (DRD, Lean, SIRI/ADMA) into actionable initiatives.
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const RapidLeanService = require('./rapidLeanService');
const ExternalAssessmentService = require('./externalAssessmentService');

class InitiativeGeneratorService {
    /**
     * Generate initiatives from consolidated assessment gaps
     * @param {Object} params - Generation parameters
     * @returns {Promise<Array>} Generated initiative drafts
     */
    static async generateInitiativesFromAssessments({
        organizationId,
        projectId,
        drdAssessmentId = null,
        leanAssessmentId = null,
        externalAssessmentIds = [],
        userId
    }) {
        try {
            // Gather all assessment data
            const assessmentData = await this.gatherAssessmentData({
                organizationId,
                projectId,
                drdAssessmentId,
                leanAssessmentId,
                externalAssessmentIds
            });

            // Identify consolidated gaps
            const gaps = this.consolidateGaps(assessmentData);

            // Generate initiative drafts
            const initiatives = this.generateInitiativeDrafts(gaps, assessmentData);

            // Enrich with AI recommendations (TODO: integrate aiService)
            const enrichedInitiatives = await this.enrichWithAI(initiatives, gaps);

            return enrichedInitiatives;
        } catch (error) {
            console.error('[InitiativeGenerator] Error:', error.message);
            throw error;
        }
    }

    /**
     * Gather data from all assessments
     * @param {Object} params - Assessment IDs
     * @returns {Promise<Object>} Consolidated assessment data
     */
    static async gatherAssessmentData({
        organizationId,
        projectId,
        drdAssessmentId,
        leanAssessmentId,
        externalAssessmentIds
    }) {
        const data = {
            drd: null,
            lean: null,
            external: [],
            gaps: []
        };

        // Fetch DRD assessment
        if (projectId) {
            data.drd = await this.getDRDAssessment(projectId);
        }

        // Fetch RapidLean assessment
        if (leanAssessmentId) {
            data.lean = await RapidLeanService.getAssessment(leanAssessmentId, organizationId);
        }

        // Fetch External assessments
        for (const externalId of externalAssessmentIds) {
            try {
                const external = await ExternalAssessmentService.getAssessment(externalId, organizationId);
                data.external.push(external);
            } catch (err) {
                console.warn(`[InitiativeGenerator] Failed to fetch external assessment ${externalId}`);
            }
        }

        return data;
    }

    /**
     * Get DRD assessment from maturity_assessments table
     * @param {string} projectId - Project ID
     * @returns {Promise<Object>} DRD assessment data
     */
    static async getDRDAssessment(projectId) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM maturity_assessments WHERE project_id = ? LIMIT 1`;

            db.get(sql, [projectId], (err, row) => {
                if (err) return reject(err);
                if (!row) return resolve(null);

                // Parse JSON fields
                row.axis_scores = JSON.parse(row.axis_scores || '[]');
                row.prioritized_gaps = JSON.parse(row.prioritized_gaps || '[]');

                resolve(row);
            });
        });
    }

    /**
     * Consolidate gaps from all assessment sources
     * @param {Object} assessmentData - All assessment data
     * @returns {Array} Prioritized gaps
     */
    static consolidateGaps(assessmentData) {
        const gaps = [];

        // DRD gaps
        if (assessmentData.drd && assessmentData.drd.axis_scores) {
            assessmentData.drd.axis_scores.forEach(axisScore => {
                if (axisScore.gap && axisScore.gap > 2) { // Only significant gaps
                    gaps.push({
                        source: 'DRD',
                        sourceId: assessmentData.drd.id,
                        dimension: axisScore.axis,
                        asIs: axisScore.asIs,
                        toBe: axisScore.toBe,
                        gap: axisScore.gap,
                        priority: this.calculateGapPriority(axisScore.gap, 'DRD')
                    });
                }
            });
        }

        // Lean gaps
        if (assessmentData.lean) {
            const leanGaps = assessmentData.lean.top_gaps || [];
            leanGaps.forEach(dimension => {
                const score = assessmentData.lean[`${dimension}_score`];
                const benchmark = assessmentData.lean.industry_benchmark;

                gaps.push({
                    source: 'LEAN',
                    sourceId: assessmentData.lean.id,
                    dimension,
                    score,
                    benchmark,
                    gap: benchmark - score,
                    priority: this.calculateGapPriority(benchmark - score, 'LEAN')
                });
            });
        }

        // External assessment gaps
        assessmentData.external.forEach(external => {
            const drdMapping = external.drd_axis_mapping || {};
            Object.keys(drdMapping).forEach(drdAxis => {
                const score = drdMapping[drdAxis];
                if (score < 4) { // Scores below 4/7 are gaps
                    gaps.push({
                        source: external.framework_type,
                        sourceId: external.id,
                        dimension: drdAxis,
                        score,
                        gap: 7 - score,
                        priority: this.calculateGapPriority(7 - score, external.framework_type)
                    });
                }
            });
        });

        // Sort by priority (highest first)
        gaps.sort((a, b) => b.priority - a.priority);

        return gaps;
    }

    /**
     * Calculate gap priority score
     * @param {number} gap - Gap size
     * @param {string} source - Assessment source
     * @returns {number} Priority score (0-100)
     */
    static calculateGapPriority(gap, source) {
        // Base priority from gap size
        let priority = gap * 10;

        // Boost DRD gaps (our primary framework)
        if (source === 'DRD') priority *= 1.2;

        // Boost Lean waste/value stream gaps (critical)
        if (source === 'LEAN') priority *= 1.1;

        return Math.min(Math.round(priority), 100);
    }

    /**
     * Generate initiative drafts from gaps
     * @param {Array} gaps - Consolidated gaps
     * @param {Object} assessmentData - Original assessment data
     * @returns {Array} Initiative drafts
     */
    static generateInitiativeDrafts(gaps, assessmentData) {
        const initiatives = [];

        // Group gaps by theme (e.g., all data-related gaps)
        const groupedGaps = this.groupGapsByTheme(gaps);

        Object.keys(groupedGaps).forEach(theme => {
            const themeGaps = groupedGaps[theme];

            // Generate one initiative per theme (combining multiple gaps)
            const initiative = this.createInitiativeFromGaps(theme, themeGaps, assessmentData);
            initiatives.push(initiative);
        });

        return initiatives;
    }

    /**
     * Group gaps by thematic area
     * @param {Array} gaps - All gaps
     * @returns {Object} Gaps grouped by theme
     */
    static groupGapsByTheme(gaps) {
        const themes = {
            'Data Management': [],
            'Process Digitalization': [],
            'Operational Excellence': [],
            'Digital Products': [],
            'Organizational Culture': [],
            'Cybersecurity': [],
            'Technology Infrastructure': []
        };

        gaps.forEach(gap => {
            // Map dimensions to themes
            if (gap.dimension === 'dataManagement' || gap.dimension === 'Data Governance') {
                themes['Data Management'].push(gap);
            } else if (gap.dimension === 'processes' || gap.dimension === 'value_stream' || gap.dimension === 'Process Digitalization') {
                themes['Process Digitalization'].push(gap);
            } else if (gap.dimension === 'waste_elimination' || gap.dimension === 'flow_pull' || gap.dimension === 'quality_source') {
                themes['Operational Excellence'].push(gap);
            } else if (gap.dimension === 'digitalProducts' || gap.dimension === 'Digital Infrastructure') {
                themes['Digital Products'].push(gap);
            } else if (gap.dimension === 'culture' || gap.dimension === 'continuous_improvement') {
                themes['Organizational Culture'].push(gap);
            } else if (gap.dimension === 'cybersecurity' || gap.dimension === 'Cybersecurity') {
                themes['Cybersecurity'].push(gap);
            } else {
                themes['Technology Infrastructure'].push(gap);
            }
        });

        // Remove empty themes
        Object.keys(themes).forEach(theme => {
            if (themes[theme].length === 0) delete themes[theme];
        });

        return themes;
    }

    /**
     * Create initiative from gap group
     * @param {string} theme - Theme name
     * @param {Array} gaps - Gaps in this theme
     * @param {Object} assessmentData - Assessment data
     * @returns {Object} Initiative draft
     */
    static createInitiativeFromGaps(theme, gaps, assessmentData) {
        const avgGap = gaps.reduce((sum, g) => sum + g.gap, 0) / gaps.length;
        const avgPriority = gaps.reduce((sum, g) => sum + g.priority, 0) / gaps.length;

        // Generate initiative based on theme
        const initiative = {
            id: uuidv4(),
            name: this.generateInitiativeName(theme, gaps),
            summary: this.generateInitiativeSummary(theme, gaps),
            hypothesis: `Addressing critical ${theme.toLowerCase()} gaps will improve organizational readiness and accelerate transformation.`,

            // Map to DRD axis (for compatibility)
            axis: this.mapThemeToDRDAxis(theme),

            // Priority based on gap severity
            priority: avgPriority > 70 ? 'Critical' : avgPriority > 50 ? 'High' : avgPriority > 30 ? 'Medium' : 'Low',

            // Business value estimation
            business_value: avgGap > 4 ? 'High' : avgGap > 2.5 ? 'Medium' : 'Low',

            // Traceability
            derived_from_assessments: gaps.map(g => ({
                source: g.source,
                sourceId: g.sourceId,
                dimension: g.dimension,
                gap: g.gap,
                score: g.score || g.asIs,
                priority: g.priority
            })),

            gap_justification: this.generateGapJustification(theme, gaps),

            assessment_traceability: {
                drd_id: assessmentData.drd?.id || null,
                lean_id: assessmentData.lean?.id || null,
                external_ids: assessmentData.external.map(e => e.id),
                generated_at: new Date().toISOString(),
                auto_generated: true
            },

            created_from: 'AI_ASSESSMENT',
            status: 'DRAFT'
        };

        return initiative;
    }

    /**
     * Generate initiative name
     * @param {string} theme - Theme
     * @param {Array} gaps - Gaps
     * @returns {string} Initiative name
     */
    static generateInitiativeName(theme, gaps) {
        const templates = {
            'Data Management': 'Master Data Management Platform',
            'Process Digitalization': 'End-to-End Process Digitalization Program',
            'Operational Excellence': 'Lean Transformation Initiative',
            'Digital Products': 'Digital Product Portfolio Expansion',
            'Organizational Culture': 'Continuous Improvement Culture Program',
            'Cybersecurity': 'Enterprise Cybersecurity Enhancement',
            'Technology Infrastructure': 'Cloud Infrastructure Modernization'
        };

        return templates[theme] || `${theme} Improvement Initiative`;
    }

    /**
     * Generate initiative summary
     * @param {string} theme - Theme
     * @param {Array} gaps - Gaps
     * @returns {string} Summary
     */
    static generateInitiativeSummary(theme, gaps) {
        const gapCount = gaps.length;
        const sources = [...new Set(gaps.map(g => g.source))].join(', ');

        return `Initiative addresses ${gapCount} critical gap(s) identified across ${sources} assessment(s) in ${theme}.`;
    }

    /**
     * Generate gap justification
     * @param {string} theme - Theme
     * @param {Array} gaps - Gaps
     * @returns {string} Justification
     */
    static generateGapJustification(theme, gaps) {
        const gapDetails = gaps.map(g =>
            `${g.source} ${g.dimension}: gap of ${g.gap.toFixed(1)}`
        ).join('; ');

        return `This initiative directly addresses critical gaps identified in ${theme}: ${gapDetails}. Closing these gaps is essential for transformation readiness.`;
    }

    /**
     * Map theme to DRD axis
     * @param {string} theme - Theme name
     * @returns {string} DRD axis
     */
    static mapThemeToDRDAxis(theme) {
        const mapping = {
            'Data Management': 'dataManagement',
            'Process Digitalization': 'processes',
            'Operational Excellence': 'processes',
            'Digital Products': 'digitalProducts',
            'Organizational Culture': 'culture',
            'Cybersecurity': 'cybersecurity',
            'Technology Infrastructure': 'digitalProducts'
        };

        return mapping[theme] || 'processes';
    }

    /**
     * Enrich initiatives with AI (placeholder for full AI integration)
     * @param {Array} initiatives - Initiative drafts
     * @param {Array} gaps - Gaps
     * @returns {Promise<Array>} Enriched initiatives
     */
    static async enrichWithAI(initiatives, gaps) {
        // TODO: Integrate with aiService for:
        // - More sophisticated name generation
        // - Detailed hypothesis
        // - Expected ROI calculation
        // - Risk assessment
        // - Recommended competencies

        return initiatives; // For now, return as-is
    }

    /**
     * Save generated initiatives to database
     * @param {Array} initiatives - Initiative drafts
     * @param {string} organizationId - Organization ID
     * @param {string} projectId - Project ID
     * @returns {Promise<Array>} Saved initiative IDs
     */
    static async saveInitiatives(initiatives, organizationId, projectId) {
        const savedIds = [];

        for (const initiative of initiatives) {
            try {
                const sql = `
                    INSERT INTO initiatives (
                        id, organization_id, project_id, name, summary, hypothesis,
                        axis, priority, business_value, status,
                        derived_from_assessments, gap_justification, assessment_traceability,
                        created_from, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                `;

                await new Promise((resolve, reject) => {
                    db.run(sql, [
                        initiative.id,
                        organizationId,
                        projectId,
                        initiative.name,
                        initiative.summary,
                        initiative.hypothesis,
                        initiative.axis,
                        initiative.priority,
                        initiative.business_value,
                        initiative.status,
                        JSON.stringify(initiative.derived_from_assessments),
                        initiative.gap_justification,
                        JSON.stringify(initiative.assessment_traceability),
                        initiative.created_from
                    ], function (err) {
                        if (err) return reject(err);
                        resolve();
                    });
                });

                savedIds.push(initiative.id);
                console.log(`[InitiativeGenerator] Saved initiative: ${initiative.name}`);
            } catch (error) {
                console.error(`[InitiativeGenerator] Error saving initiative:`, error.message);
            }
        }

        return savedIds;
    }
}

module.exports = InitiativeGeneratorService;
