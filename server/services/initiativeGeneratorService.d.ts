export default InitiativeGeneratorService;
declare class InitiativeGeneratorService {
    /**
     * Generate initiatives from consolidated assessment gaps
     * @param {Object} params - Generation parameters
     * @returns {Promise<Array>} Generated initiative drafts
     */
    static generateInitiativesFromAssessments({ organizationId, projectId, drdAssessmentId, leanAssessmentId, externalAssessmentIds, userId }: Object): Promise<any[]>;
    /**
     * Gather data from all assessments
     * @param {Object} params - Assessment IDs
     * @returns {Promise<Object>} Consolidated assessment data
     */
    static gatherAssessmentData({ organizationId, projectId, drdAssessmentId, leanAssessmentId, externalAssessmentIds }: Object): Promise<Object>;
    /**
     * Get DRD assessment from maturity_assessments table
     * @param {string} projectId - Project ID
     * @returns {Promise<Object>} DRD assessment data
     */
    static getDRDAssessment(projectId: string): Promise<Object>;
    /**
     * Consolidate gaps from all assessment sources
     * REFACTORED: Only includes gaps where Target > Actual
     * @param {Object} assessmentData - All assessment data
     * @returns {Array} Prioritized gaps
     */
    static consolidateGaps(assessmentData: Object): any[];
    /**
     * Calculate gap priority score
     * @param {number} gap - Gap size
     * @param {string} source - Assessment source
     * @returns {number} Priority score (0-100)
     */
    static calculateGapPriority(gap: number, source: string): number;
    /**
     * Get max level for DRD axis
     * @param {string} axis - Axis name
     * @returns {number} Max level
     */
    static _getAxisMaxLevel(axis: string): number;
    /**
     * Calculate complexity based on gap characteristics
     * @param {number} gap - Gap size
     * @param {number} actual - Current level
     * @param {number} target - Target level
     * @returns {string} Complexity level
     */
    static _calculateComplexity(gap: number, actual: number, target: number): string;
    /**
     * Estimate duration based on gap
     * @param {number} gap - Gap size
     * @returns {string} Estimated duration
     */
    static _estimateDuration(gap: number): string;
    /**
     * Generate initiative drafts from gaps
     * @param {Array} gaps - Consolidated gaps
     * @param {Object} assessmentData - Original assessment data
     * @returns {Array} Initiative drafts
     */
    static generateInitiativeDrafts(gaps: any[], assessmentData: Object): any[];
    /**
     * Group gaps by thematic area
     * @param {Array} gaps - All gaps
     * @returns {Object} Gaps grouped by theme
     */
    static groupGapsByTheme(gaps: any[]): Object;
    /**
     * Create initiative from gap group
     * ENHANCED: Adds sourceGaps, axisMapping, estimatedDuration, complexity, quickWin
     * @param {string} theme - Theme name
     * @param {Array} gaps - Gaps in this theme
     * @param {Object} assessmentData - Assessment data
     * @returns {Object} Initiative draft
     */
    static createInitiativeFromGaps(theme: string, gaps: any[], assessmentData: Object): Object;
    /**
     * Merge duration estimates (take longest)
     * @param {Array} durations - Duration strings
     * @returns {string} Merged duration
     */
    static _mergeEstimatedDurations(durations: any[]): string;
    /**
     * Generate initiative name
     * @param {string} theme - Theme
     * @param {Array} gaps - Gaps
     * @returns {string} Initiative name
     */
    static generateInitiativeName(theme: string, gaps: any[]): string;
    /**
     * Generate initiative summary
     * @param {string} theme - Theme
     * @param {Array} gaps - Gaps
     * @returns {string} Summary
     */
    static generateInitiativeSummary(theme: string, gaps: any[]): string;
    /**
     * Generate gap justification
     * @param {string} theme - Theme
     * @param {Array} gaps - Gaps
     * @returns {string} Justification
     */
    static generateGapJustification(theme: string, gaps: any[]): string;
    /**
     * Map theme to DRD axis
     * @param {string} theme - Theme name
     * @returns {string} DRD axis
     */
    static mapThemeToDRDAxis(theme: string): string;
    /**
     * Enrich initiatives with AI (placeholder for full AI integration)
     * @param {Array} initiatives - Initiative drafts
     * @param {Array} gaps - Gaps
     * @returns {Promise<Array>} Enriched initiatives
     */
    static enrichWithAI(initiatives: any[], gaps: any[]): Promise<any[]>;
    /**
     * Save generated initiatives to database
     * @param {Array} initiatives - Initiative drafts
     * @param {string} organizationId - Organization ID
     * @param {string} projectId - Project ID
     * @returns {Promise<Array>} Saved initiative IDs
     */
    static saveInitiatives(initiatives: any[], organizationId: string, projectId: string): Promise<any[]>;
    /**
     * Generate initiatives from a single approved assessment
     * @param {string} assessmentId - Assessment ID
     * @param {Object} constraints - Generation constraints
     * @returns {Promise<Array>} Generated initiatives
     */
    static generateFromAssessment(assessmentId: string, constraints?: Object): Promise<any[]>;
    /**
     * Get assessment by ID
     * @param {string} assessmentId - Assessment ID
     * @returns {Promise<Object>} Assessment data
     */
    static getAssessmentById(assessmentId: string): Promise<Object>;
    /**
     * Extract gaps from assessment
     * @param {Object} assessment - Assessment data
     * @param {Array} focusAreas - Optional axes to focus on
     * @returns {Array} Gaps data
     */
    static extractGapsFromAssessment(assessment: Object, focusAreas?: any[]): any[];
    /**
     * Get axis name
     * @param {string} axisId - Axis ID
     * @returns {string} Axis name
     */
    static getAxisName(axisId: string): string;
    /**
     * Calculate gap priority level
     * @param {number} gap - Gap size
     * @returns {string} Priority level
     */
    static calculateGapPriorityLevel(gap: number): string;
    /**
     * Generate initiatives with AI
     * @param {Array} gaps - Gaps to address
     * @param {Object} constraints - Generation constraints
     * @param {Object} context - Assessment context
     * @returns {Promise<Array>} AI-generated initiatives
     */
    static generateWithAI(gaps: any[], constraints?: Object, context?: Object): Promise<any[]>;
    /**
     * Create enhanced initiative from gap
     * @param {Object} gap - Gap data
     * @param {Object} constraints - Constraints
     * @param {Object} context - Context
     * @returns {Object} Initiative
     */
    static createEnhancedInitiative(gap: Object, constraints?: Object, context?: Object): Object;
    /**
     * Generate smart initiative name based on axis
     * @param {Object} gap - Gap data
     * @returns {string} Initiative name
     */
    static generateSmartInitiativeName(gap: Object): string;
    /**
     * Generate initiative description
     * @param {Object} gap - Gap data
     * @param {Object} context - Context
     * @returns {string} Description
     */
    static generateInitiativeDescription(gap: Object, context: Object): string;
    /**
     * Generate objectives for initiative
     * @param {Object} gap - Gap data
     * @returns {Array<string>} Objectives
     */
    static generateObjectives(gap: Object): Array<string>;
    /**
     * Validate initiative before approval
     * @param {Object} initiative - Initiative to validate
     * @returns {Object} Validation result
     */
    static validateInitiative(initiative: Object): Object;
    /**
     * Approve and transfer initiatives to Module 3
     * @param {Array} initiatives - Initiatives to approve
     * @param {string} projectId - Project ID
     * @param {string} userId - User ID
     * @param {string} organizationId - Organization ID (REQUIRED for initiatives table)
     * @returns {Promise<Object>} Transfer result
     */
    static approveAndTransfer(initiatives: any[], projectId: string, userId: string, organizationId: string): Promise<Object>;
    /**
     * Link initiative to assessment
     * @param {string} initiativeId - Initiative ID
     * @param {string} assessmentId - Assessment ID
     */
    static linkInitiativeToAssessment(initiativeId: string, assessmentId: string): Promise<any>;
    /**
     * Mark assessment as having initiatives generated
     * @param {string} assessmentId - Assessment ID
     */
    static markAssessmentInitiativesGenerated(assessmentId: string): Promise<any>;
    /**
     * Save draft initiatives (not yet approved)
     * @param {string} assessmentId - Assessment ID
     * @param {Array} initiatives - Draft initiatives
     * @returns {Promise<boolean>} Success
     */
    static saveDraft(assessmentId: string, initiatives: any[]): Promise<boolean>;
    /**
     * Get draft initiatives for assessment
     * @param {string} assessmentId - Assessment ID
     * @returns {Promise<Array>} Draft initiatives
     */
    static getDraftInitiatives(assessmentId: string): Promise<any[]>;
    /**
     * Generate initiatives from multi-framework assessment
     * @param {Object} params - Generation parameters
     * @returns {Promise<Array>} Generated initiatives
     */
    static generateFromMultiFramework({ assessmentId, framework, projectId, organizationId, userId }: Object): Promise<any[]>;
    /**
     * Generate initiatives specifically from SIRI assessment
     */
    static generateFromSIRI(assessmentId: any, projectId: any, organizationId: any, userId: any): Promise<any[]>;
    /**
     * Generate initiatives specifically from ADMA assessment
     */
    static generateFromADMA(assessmentId: any, projectId: any, organizationId: any, userId: any): Promise<any[]>;
    /**
     * Generate initiatives specifically from CMMI assessment
     */
    static generateFromCMMI(assessmentId: any, projectId: any, organizationId: any, userId: any): Promise<any[]>;
    /**
     * Generate initiatives specifically from Lean 4.0 assessment
     */
    static generateFromLean(assessmentId: any, projectId: any, organizationId: any, userId: any): Promise<any[]>;
    /**
     * Deduplicate similar initiatives
     */
    static deduplicateInitiatives(initiatives: any): any;
    /**
     * Save multi-framework initiative to database
     */
    static saveMultiFrameworkInitiative(initiative: any, projectId: any, organizationId: any, userId: any): Promise<any>;
    /**
     * Get initiatives for multi-framework assessment
     */
    static getMultiFrameworkInitiatives(assessmentId: any): Promise<any>;
    /**
     * Consolidate gaps from all frameworks for a project
     */
    static consolidateAllFrameworkGaps(projectId: any): Promise<any[]>;
}
//# sourceMappingURL=initiativeGeneratorService.d.ts.map