export default LegalExportService;
declare namespace LegalExportService {
    function exportAcceptances({ organizationId, userId, docType, dateFrom, dateTo, format }: {
        organizationId?: string | undefined;
        userId?: string | undefined;
        docType?: string | undefined;
        dateFrom?: string | undefined;
        dateTo?: string | undefined;
        format?: string | undefined;
    }): Promise<Object>;
    function exportAuditLog({ organizationId, userId, documentId, eventTypes, dateFrom, dateTo, format }: Object): Promise<Object>;
    function toCSV(rows: any[], columns: any[]): Object;
    function getComplianceSummary(organizationId: string): Promise<Object>;
}
//# sourceMappingURL=legalExportService.d.ts.map