export default complianceServiceInstance;
declare const complianceServiceInstance: ComplianceService;
declare class ComplianceService {
    /**
     * Create a compliance record
     */
    createRecord(recordData: any): Promise<any>;
    /**
     * Get compliance records
     */
    getRecords(filters?: {}): Promise<any>;
    /**
     * Get compliance record by ID
     */
    getRecordById(id: any): Promise<any>;
    /**
     * Update compliance record
     */
    updateRecord(id: any, updates: any): Promise<any>;
    /**
     * Get compliance report for a framework
     */
    getFrameworkReport(framework: any): Promise<any>;
    /**
     * Get all supported frameworks
     */
    getSupportedFrameworks(): {
        id: string;
        name: string;
        description: string;
    }[];
}
//# sourceMappingURL=complianceService.d.ts.map