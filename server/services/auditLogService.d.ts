export default auditLogServiceInstance;
declare const auditLogServiceInstance: AuditLogService;
declare class AuditLogService {
    /**
     * Create an audit log entry
     */
    createLog(logData: any): Promise<any>;
    /**
     * Get audit logs with filtering and pagination
     */
    getLogs(filters?: {}, pagination?: {
        page: number;
        pageSize: number;
    }): Promise<any>;
    /**
     * Get total count of logs matching filters
     */
    getLogsCount(filters?: {}): Promise<any>;
    /**
     * Get audit log by ID
     */
    getLogById(id: any): Promise<any>;
    /**
     * Get audit log statistics
     */
    getStats(filters?: {}): Promise<any>;
    /**
     * Export audit logs to CSV format
     */
    exportToCSV(filters?: {}): Promise<string>;
    /**
     * Get compliance report for a specific framework
     */
    getComplianceReport(framework: any, filters?: {}): Promise<any>;
}
//# sourceMappingURL=auditLogService.d.ts.map