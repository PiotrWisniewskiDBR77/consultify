export default PDFExportService;
declare namespace PDFExportService {
    /**
     * Generate Status Report PDF
     * @param {Object} report - Status report data
     * @returns {Promise<Buffer>} - PDF buffer
     */
    function generateStatusReportPdf(report: Object): Promise<Buffer>;
}
//# sourceMappingURL=pdfExportService.d.ts.map