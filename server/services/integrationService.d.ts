export default integrationServiceInstance;
declare const integrationServiceInstance: IntegrationService;
declare class IntegrationService {
    /**
     * Get all integrations for an organization
     */
    getIntegrations(organizationId: any, filters?: {}): Promise<any>;
    /**
     * Get integration by ID
     */
    getIntegrationById(id: any): Promise<any>;
    /**
     * Create a new integration
     */
    createIntegration(integrationData: any): Promise<any>;
    /**
     * Update an integration
     */
    updateIntegration(id: any, updates: any): Promise<any>;
    /**
     * Delete an integration
     */
    deleteIntegration(id: any): Promise<any>;
    /**
     * Trigger a sync for an integration
     */
    syncIntegration(id: any, syncType?: string): Promise<any>;
    /**
     * Perform actual sync (placeholder - implement per integration type)
     */
    performSync(integration: any, syncType: any): Promise<{
        recordsProcessed: number;
        message: string;
    }>;
    /**
     * Update sync log
     */
    updateSyncLog(syncLogId: any, updates: any): Promise<any>;
    /**
     * Get sync logs for an integration
     */
    getSyncLogs(integrationId: any, limit?: number): Promise<any>;
    /**
     * Check integration health
     */
    checkHealth(id: any): Promise<{
        status: string;
        lastSync: any;
        lastSyncStatus: any;
        error?: undefined;
    } | {
        status: string;
        error: any;
        lastSync?: undefined;
        lastSyncStatus?: undefined;
    }>;
    /**
     * Get available integration types
     */
    getAvailableTypes(): {
        id: string;
        name: string;
        description: string;
    }[];
}
//# sourceMappingURL=integrationService.d.ts.map