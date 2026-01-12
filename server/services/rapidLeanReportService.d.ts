export default RapidLeanReportService;
declare class RapidLeanReportService {
    /**
     * Generate comprehensive report after assessment completion
     * @param {string} assessmentId - Assessment ID
     * @param {string} organizationId - Organization ID
     * @param {Object} options - Report options
     * @returns {Promise<Object>} Report data with file URL
     */
    static generateReport(assessmentId: string, organizationId: string, options?: Object): Promise<Object>;
    /**
     * Get status based on score vs benchmark
     * @param {number} score - Dimension score
     * @param {number} benchmark - Industry benchmark
     * @returns {string} Status
     */
    static getStatus(score: number, benchmark: number): string;
    /**
     * Calculate trends from previous assessments
     * @param {Object} current - Current assessment
     * @param {Array} previous - Previous assessments
     * @returns {Object} Trend data
     */
    static calculateTrends(current: Object, previous: any[]): Object;
    /**
     * Calculate improvement rate
     * @param {Object} current - Current assessment
     * @param {Array} previous - Previous assessments
     * @returns {number} Improvement rate percentage
     */
    static calculateImprovementRate(current: Object, previous: any[]): number;
    /**
     * Prepare charts data for report
     * @param {Object} assessment - Current assessment
     * @param {Array} previous - Previous assessments
     * @returns {Object} Charts data
     */
    static prepareChartsData(assessment: Object, previous: any[]): Object;
    /**
     * Generate PDF report using pdfkit
     * @param {Object} reportData - Report data structure
     * @param {string} organizationId - Organization ID
     * @returns {Promise<string>} File URL
     */
    static generatePDF(reportData: Object, organizationId: string): Promise<string>;
    /**
     * Add section header to PDF
     */
    static addSectionHeader(doc: any, title: any): void;
    /**
     * Format dimension name for display
     */
    static formatDimensionName(name: any): any;
    /**
     * Generate Excel report using exceljs
     * @param {Object} reportData - Report data structure
     * @param {string} organizationId - Organization ID
     * @returns {Promise<string>} File URL
     */
    static generateExcel(reportData: Object, organizationId: string): Promise<string>;
    /**
     * Generate PowerPoint report
     * @param {Object} reportData - Report data structure
     * @param {string} organizationId - Organization ID
     * @returns {Promise<string>} File URL
     */
    static generatePowerPoint(reportData: Object, organizationId: string): Promise<string>;
    /**
     * Get previous assessments for comparison
     * @param {string} organizationId - Organization ID
     * @param {string} projectId - Project ID
     * @param {string} excludeId - Assessment ID to exclude
     * @returns {Promise<Array>} Previous assessments
     */
    static getPreviousAssessments(organizationId: string, projectId: string, excludeId: string): Promise<any[]>;
    /**
     * Save report metadata to database
     * @param {Object} reportData - Report data
     * @param {string} fileUrl - File URL
     * @param {string} organizationId - Organization ID
     * @returns {Promise<void>}
     */
    static saveReportMetadata(reportData: Object, fileUrl: string, organizationId: string): Promise<void>;
}
//# sourceMappingURL=rapidLeanReportService.d.ts.map