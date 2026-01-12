export default assessmentReportServiceInstance;
declare const assessmentReportServiceInstance: AssessmentReportService;
declare class AssessmentReportService {
    uploadsDir: string;
    _ensureUploadsDir(): void;
    /**
     * Generate comprehensive PDF report
     */
    generatePDFReport(assessmentId: any, options?: {}): Promise<any>;
    /**
     * Generate Excel export with detailed data
     */
    generateExcelReport(assessmentId: any, options?: {}): Promise<{
        reportId: string;
        fileName: string;
        filePath: string;
        fileUrl: string;
        generatedAt: string;
    }>;
    _addCoverPage(doc: any, assessment: any, options: any): Promise<void>;
    _addExecutiveSummary(doc: any, assessment: any): Promise<void>;
    _addMaturityOverview(doc: any, assessment: any): Promise<void>;
    _addAxisDetails(doc: any, assessment: any): Promise<void>;
    _addGapAnalysis(doc: any, assessment: any): Promise<void>;
    _addRecommendations(doc: any, assessment: any): Promise<void>;
    _addAppendix(doc: any, assessment: any): Promise<void>;
    _addSectionHeader(doc: any, title: any): void;
    _addMetricBox(doc: any, x: any, y: any, width: any, height: any, label: any, value: any, color: any): void;
    _addSummarySheet(workbook: any, assessment: any): Promise<void>;
    _addAxisSheet(workbook: any, assessment: any): Promise<void>;
    _addGapSheet(workbook: any, assessment: any): Promise<void>;
    _addRecommendationsSheet(workbook: any, assessment: any): Promise<void>;
    _addRawDataSheet(workbook: any, assessment: any): Promise<void>;
    _getAssessmentData(assessmentId: any): Promise<any>;
}
//# sourceMappingURL=assessmentReportService.d.ts.map