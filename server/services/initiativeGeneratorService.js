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

    // =====================================================
    // NEW METHODS: Enhanced Initiative Generator (Assessment Menu Plan)
    // =====================================================

    /**
     * Generate initiatives from a single approved assessment
     * @param {string} assessmentId - Assessment ID
     * @param {Object} constraints - Generation constraints
     * @returns {Promise<Array>} Generated initiatives
     */
    static async generateFromAssessment(assessmentId, constraints = {}) {
        try {
            // Fetch assessment data
            const assessment = await this.getAssessmentById(assessmentId);
            if (!assessment) {
                throw new Error(`Assessment not found: ${assessmentId}`);
            }

            // Extract gaps for selected axes
            const gaps = this.extractGapsFromAssessment(assessment, constraints.focusAreas);

            // Filter by selected gaps if provided
            const selectedGaps = constraints.selectedGaps 
                ? gaps.filter(g => constraints.selectedGaps.includes(g.axisId))
                : gaps;

            // Generate initiatives with AI
            const initiatives = await this.generateWithAI(selectedGaps, constraints, {
                industry: assessment.industry,
                companySize: assessment.company_size,
                assessmentId: assessment.id
            });

            return initiatives;
        } catch (error) {
            console.error('[InitiativeGenerator] generateFromAssessment error:', error.message);
            throw error;
        }
    }

    /**
     * Get assessment by ID
     * @param {string} assessmentId - Assessment ID
     * @returns {Promise<Object>} Assessment data
     */
    static async getAssessmentById(assessmentId) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT a.*, p.name as project_name, p.organization_id
                FROM maturity_assessments a
                LEFT JOIN projects p ON a.project_id = p.id
                WHERE a.id = ?
            `;

            db.get(sql, [assessmentId], (err, row) => {
                if (err) return reject(err);
                if (!row) return resolve(null);

                row.axis_scores = JSON.parse(row.axis_scores || '[]');
                row.prioritized_gaps = JSON.parse(row.prioritized_gaps || '[]');
                resolve(row);
            });
        });
    }

    /**
     * Extract gaps from assessment
     * @param {Object} assessment - Assessment data
     * @param {Array} focusAreas - Optional axes to focus on
     * @returns {Array} Gaps data
     */
    static extractGapsFromAssessment(assessment, focusAreas = null) {
        const gaps = [];
        const axisScores = assessment.axis_scores || [];

        axisScores.forEach(axis => {
            // Skip if not in focus areas
            if (focusAreas && focusAreas.length > 0 && !focusAreas.includes(axis.axis)) {
                return;
            }

            const gap = (axis.toBe || axis.target || 5) - (axis.asIs || axis.current || 1);
            
            if (gap > 0) {
                gaps.push({
                    axisId: axis.axis,
                    axisName: this.getAxisName(axis.axis),
                    currentScore: axis.asIs || axis.current || 1,
                    targetScore: axis.toBe || axis.target || 5,
                    gap: gap,
                    priority: this.calculateGapPriorityLevel(gap),
                    justification: axis.justification || ''
                });
            }
        });

        // Sort by gap size (largest first)
        gaps.sort((a, b) => b.gap - a.gap);

        return gaps;
    }

    /**
     * Get axis name
     * @param {string} axisId - Axis ID
     * @returns {string} Axis name
     */
    static getAxisName(axisId) {
        const names = {
            processes: 'Processes',
            digitalProducts: 'Digital Products',
            businessModels: 'Business Models',
            dataManagement: 'Data Management',
            culture: 'Organizational Culture',
            cybersecurity: 'Cybersecurity',
            aiMaturity: 'AI Maturity'
        };
        return names[axisId] || axisId;
    }

    /**
     * Calculate gap priority level
     * @param {number} gap - Gap size
     * @returns {string} Priority level
     */
    static calculateGapPriorityLevel(gap) {
        if (gap >= 4) return 'CRITICAL';
        if (gap >= 3) return 'HIGH';
        if (gap >= 2) return 'MEDIUM';
        return 'LOW';
    }

    /**
     * Generate initiatives with AI
     * @param {Array} gaps - Gaps to address
     * @param {Object} constraints - Generation constraints
     * @param {Object} context - Assessment context
     * @returns {Promise<Array>} AI-generated initiatives
     */
    static async generateWithAI(gaps, constraints = {}, context = {}) {
        const initiatives = [];

        // For each gap, generate an initiative
        for (const gap of gaps) {
            const initiative = this.createEnhancedInitiative(gap, constraints, context);
            initiatives.push(initiative);
        }

        // Apply budget constraints - adjust if needed
        if (constraints.maxBudget) {
            let totalBudget = initiatives.reduce((sum, i) => sum + i.estimatedBudget, 0);
            if (totalBudget > constraints.maxBudget) {
                // Scale down budgets proportionally
                const scaleFactor = constraints.maxBudget / totalBudget;
                initiatives.forEach(i => {
                    i.estimatedBudget = Math.round(i.estimatedBudget * scaleFactor);
                });
            }
        }

        // Apply timeline constraints
        if (constraints.maxTimeline) {
            initiatives.forEach(i => {
                i.timeline = constraints.maxTimeline;
            });
        }

        // Adjust risk based on appetite
        if (constraints.riskAppetite) {
            initiatives.forEach(i => {
                if (constraints.riskAppetite === 'conservative' && i.riskLevel === 'HIGH') {
                    i.riskLevel = 'MEDIUM';
                    i.estimatedBudget = Math.round(i.estimatedBudget * 0.8);
                } else if (constraints.riskAppetite === 'aggressive' && i.riskLevel === 'LOW') {
                    i.riskLevel = 'MEDIUM';
                    i.estimatedBudget = Math.round(i.estimatedBudget * 1.2);
                    i.estimatedROI = Math.round((i.estimatedROI + 0.5) * 10) / 10;
                }
            });
        }

        return initiatives;
    }

    /**
     * Create enhanced initiative from gap
     * @param {Object} gap - Gap data
     * @param {Object} constraints - Constraints
     * @param {Object} context - Context
     * @returns {Object} Initiative
     */
    static createEnhancedInitiative(gap, constraints = {}, context = {}) {
        const id = uuidv4();
        
        // Calculate budget based on gap size
        const baseBudget = gap.gap * 50000; // 50k per gap point
        const adjustedBudget = constraints.teamSize === '1-5' ? baseBudget * 0.6 :
                               constraints.teamSize === '5-10' ? baseBudget :
                               constraints.teamSize === '10-20' ? baseBudget * 1.3 :
                               baseBudget * 1.5;

        // Calculate timeline
        const baseMonths = Math.ceil(gap.gap * 1.5);
        const timeline = `${baseMonths}-${baseMonths + 2} months`;

        // Calculate ROI based on gap and priority
        const baseROI = gap.gap * 0.4 + 0.5;
        const adjustedROI = gap.priority === 'CRITICAL' ? baseROI * 1.3 :
                           gap.priority === 'HIGH' ? baseROI * 1.1 :
                           baseROI;

        // Determine risk level
        const riskLevel = gap.gap >= 4 ? 'HIGH' : gap.gap >= 2 ? 'MEDIUM' : 'LOW';

        return {
            id,
            assessmentId: context.assessmentId,
            sourceAxisId: gap.axisId,
            name: this.generateSmartInitiativeName(gap),
            description: this.generateInitiativeDescription(gap, context),
            objectives: this.generateObjectives(gap),
            estimatedROI: Math.round(adjustedROI * 10) / 10,
            estimatedBudget: Math.round(adjustedBudget / 1000) * 1000, // Round to nearest 1000
            timeline,
            riskLevel,
            priority: gap.gap >= 3 ? 10 - gap.gap : gap.gap + 3,
            status: 'DRAFT',
            aiGenerated: true,
            createdAt: new Date()
        };
    }

    /**
     * Generate smart initiative name based on axis
     * @param {Object} gap - Gap data
     * @returns {string} Initiative name
     */
    static generateSmartInitiativeName(gap) {
        const templates = {
            processes: [
                'Process Automation Platform',
                'End-to-End Workflow Digitalization',
                'Intelligent Process Mining Initiative'
            ],
            digitalProducts: [
                'Digital Product Acceleration Program',
                'IoT/Digital Twin Implementation',
                'Smart Product Portfolio Expansion'
            ],
            businessModels: [
                'Digital Business Model Innovation',
                'Platform Economy Transition',
                'Value Proposition Digitalization'
            ],
            dataManagement: [
                'Enterprise Data Lake Implementation',
                'Master Data Management Platform',
                'Analytics & BI Modernization'
            ],
            culture: [
                'Digital Culture Transformation',
                'Agile Organization Transition',
                'Innovation Mindset Program'
            ],
            cybersecurity: [
                'Enterprise Security Enhancement',
                'Zero Trust Architecture Implementation',
                'Cyber Resilience Program'
            ],
            aiMaturity: [
                'AI/ML Center of Excellence',
                'Intelligent Automation Platform',
                'AI-First Strategy Implementation'
            ]
        };

        const options = templates[gap.axisId] || [`${gap.axisName} Improvement Initiative`];
        const index = gap.gap >= 4 ? 0 : gap.gap >= 3 ? 1 : 2;
        
        return options[Math.min(index, options.length - 1)];
    }

    /**
     * Generate initiative description
     * @param {Object} gap - Gap data
     * @param {Object} context - Context
     * @returns {string} Description
     */
    static generateInitiativeDescription(gap, context) {
        return `Strategic initiative to close the ${gap.axisName} maturity gap from level ${gap.currentScore} to target level ${gap.targetScore}. ` +
               `This ${gap.priority.toLowerCase()}-priority initiative addresses ${gap.gap.toFixed(1)} point gap ` +
               `in digital transformation readiness, enabling accelerated organizational capability building.`;
    }

    /**
     * Generate objectives for initiative
     * @param {Object} gap - Gap data
     * @returns {Array<string>} Objectives
     */
    static generateObjectives(gap) {
        const objectives = [];

        // Primary objective - close the gap
        objectives.push(`Increase ${gap.axisName} maturity from level ${gap.currentScore} to level ${gap.targetScore}`);

        // Secondary objectives based on axis
        const axisObjectives = {
            processes: [
                'Implement end-to-end process visibility',
                'Reduce manual touchpoints by 60%',
                'Enable real-time process monitoring'
            ],
            digitalProducts: [
                'Launch digital product MVP within 6 months',
                'Establish product analytics capability',
                'Build digital customer journey'
            ],
            businessModels: [
                'Develop new revenue streams',
                'Enable platform-based offerings',
                'Create digital value propositions'
            ],
            dataManagement: [
                'Establish single source of truth',
                'Enable self-service analytics',
                'Implement data governance framework'
            ],
            culture: [
                'Deploy agile transformation program',
                'Establish innovation labs',
                'Create continuous learning culture'
            ],
            cybersecurity: [
                'Achieve security compliance certification',
                'Implement threat detection capability',
                'Establish incident response procedures'
            ],
            aiMaturity: [
                'Build AI/ML capability center',
                'Deploy pilot AI use cases',
                'Establish AI governance framework'
            ]
        };

        const specific = axisObjectives[gap.axisId] || [];
        objectives.push(...specific.slice(0, 2));

        return objectives;
    }

    /**
     * Validate initiative before approval
     * @param {Object} initiative - Initiative to validate
     * @returns {Object} Validation result
     */
    static async validateInitiative(initiative) {
        const errors = [];
        const warnings = [];

        // Required fields
        if (!initiative.name || initiative.name.length < 5) {
            errors.push('Initiative name is required and must be at least 5 characters');
        }

        if (!initiative.description || initiative.description.length < 20) {
            errors.push('Initiative description must be at least 20 characters');
        }

        if (!initiative.estimatedBudget || initiative.estimatedBudget <= 0) {
            errors.push('Estimated budget must be a positive number');
        }

        if (!initiative.timeline) {
            errors.push('Timeline is required');
        }

        if (!initiative.objectives || initiative.objectives.length === 0) {
            warnings.push('At least one objective is recommended');
        }

        // Business logic validations
        if (initiative.estimatedROI < 1) {
            warnings.push('ROI is below 1x - consider revising the initiative');
        }

        if (initiative.riskLevel === 'HIGH' && initiative.estimatedBudget > 500000) {
            warnings.push('High-risk initiative with large budget - review recommended');
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Approve and transfer initiatives to Module 3
     * @param {Array} initiatives - Initiatives to approve
     * @param {string} projectId - Project ID
     * @param {string} userId - User ID
     * @returns {Promise<Object>} Transfer result
     */
    static async approveAndTransfer(initiatives, projectId, userId) {
        const results = {
            transferred: [],
            failed: [],
            total: initiatives.length
        };

        for (const initiative of initiatives) {
            try {
                // Validate first
                const validation = await this.validateInitiative(initiative);
                if (!validation.valid) {
                    results.failed.push({
                        id: initiative.id,
                        name: initiative.name,
                        errors: validation.errors
                    });
                    continue;
                }

                // Insert into initiatives table
                const sql = `
                    INSERT INTO initiatives (
                        id, project_id, name, summary, hypothesis,
                        axis, priority, business_value, status,
                        derived_from_assessments, gap_justification,
                        created_from, created_by, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                `;

                await new Promise((resolve, reject) => {
                    db.run(sql, [
                        initiative.id,
                        projectId,
                        initiative.name,
                        initiative.description,
                        initiative.objectives?.join('; ') || '',
                        initiative.sourceAxisId,
                        initiative.riskLevel === 'HIGH' ? 'Critical' :
                        initiative.riskLevel === 'MEDIUM' ? 'High' : 'Medium',
                        initiative.estimatedROI > 2 ? 'High' :
                        initiative.estimatedROI > 1 ? 'Medium' : 'Low',
                        'APPROVED',
                        JSON.stringify({
                            assessmentId: initiative.assessmentId,
                            sourceAxis: initiative.sourceAxisId,
                            estimatedROI: initiative.estimatedROI,
                            estimatedBudget: initiative.estimatedBudget
                        }),
                        `AI-generated from ${initiative.sourceAxisId} gap analysis`,
                        'AI_ASSESSMENT',
                        userId
                    ], function(err) {
                        if (err) return reject(err);
                        resolve();
                    });
                });

                // Link initiative to assessment
                await this.linkInitiativeToAssessment(initiative.id, initiative.assessmentId);

                results.transferred.push({
                    id: initiative.id,
                    name: initiative.name
                });

            } catch (error) {
                console.error(`[InitiativeGenerator] Transfer failed for ${initiative.name}:`, error.message);
                results.failed.push({
                    id: initiative.id,
                    name: initiative.name,
                    errors: [error.message]
                });
            }
        }

        // Mark assessment as having generated initiatives
        if (initiatives.length > 0 && initiatives[0].assessmentId) {
            await this.markAssessmentInitiativesGenerated(initiatives[0].assessmentId);
        }

        return results;
    }

    /**
     * Link initiative to assessment
     * @param {string} initiativeId - Initiative ID
     * @param {string} assessmentId - Assessment ID
     */
    static async linkInitiativeToAssessment(initiativeId, assessmentId) {
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT OR IGNORE INTO assessment_initiatives (
                    assessment_id, initiative_id, created_at
                ) VALUES (?, ?, datetime('now'))
            `;

            db.run(sql, [assessmentId, initiativeId], (err) => {
                if (err) return reject(err);
                resolve();
            });
        });
    }

    /**
     * Mark assessment as having initiatives generated
     * @param {string} assessmentId - Assessment ID
     */
    static async markAssessmentInitiativesGenerated(assessmentId) {
        return new Promise((resolve, reject) => {
            const sql = `
                UPDATE maturity_assessments 
                SET initiatives_generated = 1, 
                    initiatives_generated_at = datetime('now')
                WHERE id = ?
            `;

            db.run(sql, [assessmentId], (err) => {
                if (err) return reject(err);
                resolve();
            });
        });
    }

    /**
     * Save draft initiatives (not yet approved)
     * @param {string} assessmentId - Assessment ID
     * @param {Array} initiatives - Draft initiatives
     * @returns {Promise<boolean>} Success
     */
    static async saveDraft(assessmentId, initiatives) {
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT OR REPLACE INTO initiative_drafts (
                    assessment_id, initiatives_json, updated_at
                ) VALUES (?, ?, datetime('now'))
            `;

            db.run(sql, [assessmentId, JSON.stringify(initiatives)], (err) => {
                if (err) return reject(err);
                resolve(true);
            });
        });
    }

    /**
     * Get draft initiatives for assessment
     * @param {string} assessmentId - Assessment ID
     * @returns {Promise<Array>} Draft initiatives
     */
    static async getDraftInitiatives(assessmentId) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT initiatives_json, updated_at 
                FROM initiative_drafts 
                WHERE assessment_id = ?
            `;

            db.get(sql, [assessmentId], (err, row) => {
                if (err) return reject(err);
                if (!row) return resolve([]);

                try {
                    const initiatives = JSON.parse(row.initiatives_json);
                    resolve(initiatives);
                } catch (e) {
                    resolve([]);
                }
            });
        });
    }
}

module.exports = InitiativeGeneratorService;
