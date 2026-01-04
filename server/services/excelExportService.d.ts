export default ExcelExportService;
declare namespace ExcelExportService {
    function exportReportToExcel(report: Object, options?: Object): Promise<string>;
    function exportDigitizationAnalysis(analysis: Object, options?: Object): Promise<string>;
    function exportInitiativesToExcel(initiatives: any, options?: {}): Promise<string>;
}
//# sourceMappingURL=excelExportService.d.ts.map