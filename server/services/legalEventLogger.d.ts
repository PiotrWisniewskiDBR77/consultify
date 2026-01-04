export namespace EVENT_TYPES {
    let PUBLISH: string;
    let ACTIVATE: string;
    let DEACTIVATE: string;
    let ROLLBACK: string;
    let ACCEPT: string;
    let ORG_ACCEPT_COMPLETE: string;
    let REJECT: string;
    let FORCE_REACCEPT: string;
    let SCOPE_CHANGE: string;
    let LIFECYCLE_UPDATE: string;
}
export namespace LegalEventLogger {
    function setDependencies(newDeps: any): void;
    function log({ eventType, documentId, documentVersion, userId, organizationId, performedBy, metadata }: {
        eventType: any;
        documentId: any;
        documentVersion: any;
        userId: any;
        organizationId: any;
        performedBy: any;
        metadata?: {} | undefined;
    }): Promise<any>;
    function logPublish(documentId: any, documentVersion: any, performedBy: any, metadata?: {}): Promise<any>;
    function logActivate(documentId: any, documentVersion: any, performedBy: any, metadata?: {}): Promise<any>;
    function logDeactivate(documentId: any, documentVersion: any, performedBy: any, metadata?: {}): Promise<any>;
    function logAccept(documentId: any, documentVersion: any, userId: any, organizationId: any, performedBy: any, metadata?: {}): Promise<any>;
    function logOrgAcceptComplete(documentId: any, documentVersion: any, organizationId: any, performedBy: any, metadata?: {}): Promise<any>;
    function logForceReaccept(documentId: any, documentVersion: any, performedBy: any, reacceptFrom: any, metadata?: {}): Promise<any>;
    function getEvents({ organizationId, userId, documentId, eventTypes, dateFrom, dateTo, limit }: {
        organizationId: any;
        userId: any;
        documentId: any;
        eventTypes: any;
        dateFrom: any;
        dateTo: any;
        limit?: number | undefined;
    }): Promise<any>;
    function getEventStats(organizationId?: null, days?: number): Promise<any>;
}
export default LegalEventLogger;
//# sourceMappingURL=legalEventLogger.d.ts.map