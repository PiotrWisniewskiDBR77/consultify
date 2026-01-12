export default RapidLeanService;
declare class RapidLeanService {
    /**
     * Dimension weights for overall score calculation
     * Critical areas (Value Stream, Waste) carry 2x weight
     */
    static DIMENSION_WEIGHTS: {
        value_stream: number;
        waste_elimination: number;
        flow_pull: number;
        quality_source: number;
        continuous_improvement: number;
        visual_management: number;
    };
    /**
     * Industry baseline scores (avg overall score)
     * Data sourced from Lean Enterprise Institute 2023 benchmarks
     */
    static INDUSTRY_BENCHMARKS: {
        MANUFACTURING: number;
        AUTOMOTIVE: number;
        HEALTHCARE: number;
        SERVICES: number;
        FINANCIAL: number;
        TECHNOLOGY: number;
        RETAIL: number;
        DEFAULT: number;
    };
    /**
     * DRD Axis Mapping
     * Maps Lean dimensions to DRD axes for cross-framework analysis
     */
    static DRD_MAPPING: {
        value_stream: string;
        waste_elimination: string;
        flow_pull: string;
        quality_source: string;
        continuous_improvement: string;
        visual_management: string;
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
    static createAssessment({ organizationId, projectId, responses, userId }: {
        organizationId: string;
        projectId: string;
        responses: Object;
        userId: string;
    }): Promise<Object>;
    /**
     * Calculate scores from questionnaire responses
     * @param {Object} responses - Raw questionnaire responses
     * @returns {Object} Calculated scores for each dimension + overall
     */
    static calculateScores(responses: Object): Object;
    /**
     * Calculate score for a single dimension
     * @param {Object} responses - All responses
     * @param {string} dimension - Dimension name
     * @returns {number} Average score for dimension (1-5)
     */
    static calculateDimensionScore(responses: Object, dimension: string): number;
    /**
     * Calculate weighted overall score
     * @param {Object} scores - Dimension scores
     * @returns {number} Weighted average (1-5)
     */
    static calculateWeightedScore(scores: Object): number;
    /**
     * Get assessment by ID
     * @param {string} assessmentId - Assessment ID
     * @param {string} organizationId - Organization ID (for security)
     * @returns {Promise<Object>} Assessment data
     */
    static getAssessment(assessmentId: string, organizationId: string): Promise<Object>;
    /**
     * Get all assessments for a project
     * @param {string} projectId - Project ID
     * @param {string} organizationId - Organization ID
     * @returns {Promise<Array>} List of assessments
     */
    static getProjectAssessments(projectId: string, organizationId: string): Promise<any[]>;
    /**
     * Get organization industry type
     * @param {string} organizationId - Organization ID
     * @returns {Promise<string>} Industry code
     */
    static getOrganizationIndustry(organizationId: string): Promise<string>;
    /**
     * Generate AI-powered recommendations
     * @param {Object} scores - Dimension scores
     * @param {number} benchmark - Industry benchmark
     * @returns {Promise<Array>} Recommendations
     */
    static generateRecommendations(scores: Object, benchmark: number): Promise<any[]>;
    /**
     * Identify top 3 gaps compared to benchmark
     * @param {Object} scores - Dimension scores
     * @param {number} benchmark - Industry benchmark
     * @returns {Array} Top gaps
     */
    static identifyTopGaps(scores: Object, benchmark: number): any[];
    /**
     * Map Lean assessment to DRD axes
     * @param {Object} assessment - RapidLean assessment
     * @param {Array} observations - Optional observations for enhanced mapping
     * @returns {Object} DRD axis scores
     */
    static mapToDRD(assessment: Object, observations?: any[]): Object;
    /**
     * Convert Lean 1-5 scale to DRD 1-7 scale
     * @param {number} leanScore - Score on 1-5 scale
     * @returns {number} Score on 1-7 scale
     */
    static convertScaleToDRD(leanScore: number): number;
    /**
     * Get observations for an assessment
     * @param {string} assessmentId - Assessment ID
     * @returns {Promise<Array>} Observations array
     */
    static getObservations(assessmentId: string): Promise<any[]>;
    /**
     * Analyze observations for DRD mapping
     * @param {Array} observations - Observations array
     * @param {string} leanDimension - Lean dimension name
     * @param {string} drdAxis - DRD axis name
     * @returns {number|null} Evidence-based score adjustment or null
     */
    static analyzeObservationsForDRD(observations: any[], leanDimension: string, drdAxis: string): number | null;
    /**
     * Combine base score with evidence-based adjustment
     * @param {number} baseScore - Base score from questionnaire
     * @param {number} evidenceScore - Evidence-based score from observations
     * @returns {number} Combined score
     */
    static combineScores(baseScore: number, evidenceScore: number): number;
    /**
     * Calculate DRD gaps
     * @param {Object} drdMapping - DRD axis scores
     * @param {Object} targetLevels - Target DRD levels (optional)
     * @returns {Object} Gap analysis
     */
    static calculateDRDGaps(drdMapping: Object, targetLevels?: Object): Object;
    /**
     * Generate pathways to target DRD levels
     * @param {Object} drdMapping - Current DRD scores
     * @param {Object} targetLevels - Target DRD levels
     * @returns {Object} Pathways for each axis
     */
    static generatePathways(drdMapping: Object, targetLevels?: Object): Object;
    /**
     * Generate DRD-aligned recommendations
     * @param {Object} assessment - Assessment data
     * @param {Object} drdMapping - DRD mapping
     * @param {Object} projectContext - Project context (optional)
     * @returns {Promise<Array>} DRD-aligned recommendations
     */
    static generateDRDRecommendations(assessment: Object, drdMapping: Object, projectContext?: Object): Promise<any[]>;
    /**
     * Get project context for DRD recommendations
     * @param {string} organizationId - Organization ID
     * @returns {Promise<Object>} Project context
     */
    static getProjectContext(organizationId: string): Promise<Object>;
}
//# sourceMappingURL=rapidLeanService.d.ts.map