export default assessmentOverviewServiceInstance;
declare const assessmentOverviewServiceInstance: AssessmentOverviewService;
declare class AssessmentOverviewService {
    db: any;
    /**
     * Inject dependencies for testing
     * @param {Object} deps
     */
    setDependencies(deps: Object): void;
    /**
     * Get comprehensive assessment overview for organization/project
     * @param {string} organizationId - Organization ID
     * @param {string} projectId - Project ID (optional)
     * @returns {Promise<Object>} Assessment overview
     */
    getAssessmentOverview(organizationId: string, projectId?: string): Promise<Object>;
    /**
     * Get DRD assessment summary
     * @param {string} organizationId - Organization ID
     * @param {string} projectId - Project ID
     * @returns {Promise<Object>} DRD summary
     */
    getDRDSummary(organizationId: string, projectId: string): Promise<Object>;
    /**
     * Get RapidLean summary
     * @param {string} organizationId - Organization ID
     * @param {string} projectId - Project ID
     * @returns {Promise<Object>} RapidLean summary
     */
    getRapidLeanSummary(organizationId: string, projectId: string): Promise<Object>;
    /**
     * Get external digital assessments summary
     * @param {string} organizationId - Organization ID
     * @param {string} projectId - Project ID
     * @returns {Promise<Object>} External assessments summary
     */
    getExternalDigitalSummary(organizationId: string, projectId: string): Promise<Object>;
    /**
     * Get generic reports summary
     * @param {string} organizationId - Organization ID
     * @param {string} projectId - Project ID
     * @returns {Promise<Object>} Reports summary
     */
    getGenericReportsSummary(organizationId: string, projectId: string): Promise<Object>;
    /**
     * Calculate consolidated metrics across all assessment types
     * @param {Object} overview - Overview data from all sources
     * @returns {Object} Consolidated metrics
     */
    calculateConsolidatedMetrics(overview: Object): Object;
    /**
     * Get list of assessments for AssessmentTable component
     * @param {string} organizationId - Organization ID
     * @param {string} projectId - Project ID (optional)
     * @param {string} currentUserId - Current user ID for review detection
     * @returns {Promise<Array>} List of assessments
     */
    getAssessmentsList(organizationId: string, projectId: string, currentUserId?: string): Promise<any[]>;
    /**
     * Get list of reports for ReportsTable component
     * @param {string} organizationId - Organization ID
     * @param {string} projectId - Project ID
     * @returns {Promise<Array>} List of reports
     */
    getReportsList(organizationId: string, projectId: string): Promise<any[]>;
    /**
     * Get full assessment details for Map view
     * @param {string} assessmentId - Assessment ID (from assessment_workflows)
     * @returns {Promise<Object|null>} Full assessment details or null
     */
    getAssessmentDetails(assessmentId: string): Promise<Object | null>;
    /**
     * Convert DB axis_scores format to frontend AxisAssessment format
     * @param {Array|Object} scores - Axis scores from DB
     * @returns {Object} Frontend-compatible axis data
     */
    convertAxisScoresToFrontendFormat(scores: any[] | Object): Object;
}
//# sourceMappingURL=assessmentOverviewService.d.ts.map