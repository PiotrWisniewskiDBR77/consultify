export default AuditExportService;
declare namespace AuditExportService {
    function exportDecisions(options: {
        organizationId: string;
        format?: string | undefined;
        includeArchived?: boolean | undefined;
    }): Promise<{
        data: any[] | string;
        format: string;
    }>;
    function exportExecutions(options: {
        organizationId: string;
        format?: string | undefined;
        includeArchived?: boolean | undefined;
    }): Promise<{
        data: any[] | string;
        format: string;
    }>;
    function _toCSV(rows: any): string;
}
//# sourceMappingURL=auditExport.d.ts.map