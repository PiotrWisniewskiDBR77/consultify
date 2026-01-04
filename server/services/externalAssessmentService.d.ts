export default ExternalAssessmentService;
declare class ExternalAssessmentService {
    /**
     * Framework-to-DRD axis mapping
     * Maps external framework dimensions to DRD axes
     */
    static FRAMEWORK_MAPPINGS: {
        SIRI: {
            'Process Digitalization': string;
            Automation: string;
            Integration: string;
            Interoperability: string;
            'Smart Manufacturing': string;
            'Industrial Internet': string;
            Strategy: string;
            Governance: string;
            'Skills & People': string;
        };
        ADMA: {
            'Digital Infrastructure': string;
            'Digital Literacy': string;
            'Digital Innovation': string;
            'Digital Government': string;
            'Digital Business': string;
            Cybersecurity: string;
            'Data Governance': string;
            'Digital Trust': string;
        };
    };
    /**
     * Upload and process external assessment
     * @param {Object} params - Upload parameters
     * @returns {Promise<Object>} Created assessment
     */
    static uploadAssessment({ organizationId, projectId, frameworkType, frameworkVersion, assessmentDate, filePath, fileName, fileSize, uploadMethod, userId }: Object): Promise<Object>;
    /**
     * Process assessment file (async)
     * @param {string} assessmentId - Assessment ID
     * @param {string} filePath - Path to PDF file
     * @param {string} frameworkType - Framework type
     */
    static processAssessmentFile(assessmentId: string, filePath: string, frameworkType: string): Promise<void>;
    /**
     * Normalize scores from framework scale to DRD 1-7 scale
     * @param {Object} rawScores - Framework-specific scores
     * @param {string} frameworkType - Framework type
     * @returns {Object} Normalized scores (1-7 scale)
     */
    static normalizeScores(rawScores: Object, frameworkType: string): Object;
    /**
     * Map framework dimensions to DRD axes
     * @param {Object} rawScores - Framework scores
     * @param {string} frameworkType - Framework type
     * @returns {Object} DRD axis mapping
     */
    static mapToDRDAxes(rawScores: Object, frameworkType: string): Object;
    /**
     * Calculate mapping confidence
     * @param {Object} rawScores - Framework scores
     * @returns {number} Confidence score (0-1)
     */
    static calculateMappingConfidence(rawScores: Object): number;
    /**
     * Update processing status
     * @param {string} assessmentId - Assessment ID
     * @param {string} status - New status
     * @param {string} error - Error message (optional)
     */
    static updateProcessingStatus(assessmentId: string, status: string, error?: string): Promise<any>;
    /**
     * Update assessment scores after processing
     * @param {string} assessmentId - Assessment ID
     * @param {Object} data - Score data
     */
    static updateAssessmentScores(assessmentId: string, { rawScores, normalizedScores, drdMapping, confidence }: Object): Promise<any>;
    /**
     * Get assessment by ID
     * @param {string} assessmentId - Assessment ID
     * @param {string} organizationId - Organization ID
     * @returns {Promise<Object>} Assessment data
     */
    static getAssessment(assessmentId: string, organizationId: string): Promise<Object>;
    /**
     * Detect inconsistencies with DRD assessment
     * @param {string} organizationId - Organization ID
     * @param {string} projectId - Project ID
     * @param {Object} externalAssessment - External assessment data
     * @returns {Array} Detected inconsistencies
     */
    static detectInconsistencies(organizationId: string, projectId: string, externalAssessment: Object): any[];
}
//# sourceMappingURL=externalAssessmentService.d.ts.map