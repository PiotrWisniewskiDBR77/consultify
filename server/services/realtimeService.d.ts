export default realtimeServiceSimpleInstance;
declare const realtimeServiceSimpleInstance: RealtimeServiceSimple;
declare class RealtimeServiceSimple {
    clients: Map<any, any>;
    presence: Map<any, any>;
    initializeSimple(server: any): void;
    parseFrame(buffer: any): any;
    createFrame(data: any): Buffer<ArrayBuffer>;
    sendMessage(socket: any, data: any): void;
    handleMessage(userId: any, organizationId: any, data: any): void;
    broadcastToOrganization(organizationId: any, message: any, excludeUserId?: null): void;
    broadcastPresence(organizationId: any): void;
    handleDisconnect(userId: any, organizationId: any): void;
    getGlobalStats(): {
        total_active_connections: number;
        active_organizations: number;
        organization_breakdown: {};
    };
    notifyUpdate(organizationId: any, eventType: any, data: any): void;
    broadcastCostUpdate(userId: any, organizationId: any, costData: any): void;
    broadcastBudgetAlert(organizationId: any, alertData: any): void;
    sendCostSummary(userId: any, summaryData: any): void;
    broadcastSLAAlert(alertData: any): void;
}
//# sourceMappingURL=realtimeService.d.ts.map