export default GenericReportService;
declare class GenericReportService {
    /**
     * Upload generic report
     * @param {Object} params - Upload parameters
     * @returns {Promise<Object>} Created report with AI summary
     */
    static uploadReport({ organizationId, projectId, reportType, title, consultantName, reportDate, filePath, fileName, fileSize, fileType, tags, userId }: Object): Promise<Object>;
    /**
     * Process report file (extract text, generate summary)
     * @param {string} reportId - Report ID
     * @param {string} filePath - File path
     * @param {string} fileType - File type
     */
    static processReport(reportId: string, filePath: string, fileType: string): Promise<void>;
    /**
     * Generate simple AI summary (placeholder)
     * TODO: Integrate with aiService for GPT-powered summaries
     * @param {string} text - Extracted text
     * @returns {string} Summary
     */
    static generateSimpleSummary(text: string): string;
    /**
     * Suggest tags based on content
     * @param {string} text - Extracted text
     * @returns {Array} Suggested tags
     */
    static suggestTags(text: string): any[];
    /**
     * Update processing status
     * @param {string} reportId - Report ID
     * @param {string} status - New status
     * @param {string} error - Error message (optional)
     */
    static updateProcessingStatus(reportId: string, status: string, error?: string): Promise<any>;
    /**
     * Update report content after processing
     * @param {string} reportId - Report ID
     * @param {Object} data - Content data
     */
    static updateReportContent(reportId: string, { ocrText, aiSummary, keyFindings, suggestedTags }: Object): Promise<any>;
    /**
     * Get report by ID
     * @param {string} reportId - Report ID
     * @param {string} organizationId - Organization ID
     * @returns {Promise<Object>} Report data
     */
    static getReport(reportId: string, organizationId: string): Promise<Object>;
    /**
     * Search reports
     * @param {Object} params - Search parameters
     * @returns {Promise<Array>} Search results
     */
    static searchReports({ organizationId, query, reportType, sortBy }: Object): Promise<any[]>;
    /**
     * Link report to initiative
     * @param {string} reportId - Report ID
     * @param {string} initiativeId - Initiative ID
     * @param {string} organizationId - Organization ID
     */
    static linkToInitiative(reportId: string, initiativeId: string, organizationId: string): Promise<any>;
}
//# sourceMappingURL=genericReportService.d.ts.map