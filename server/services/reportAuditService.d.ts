export default ReportAuditService;
declare namespace ReportAuditService {
    export { AUDIT_ACTIONS };
    export function log(reportId: string, action: string, actorId: string, details?: Object, req?: Object): Promise<Object>;
    export function getAuditLog(reportId: string, filters?: Object): Promise<Object>;
    export function exportAuditLog(reportId: string, format?: string, filters?: Object): Promise<string | Object>;
    export function getActivitySummary(reportId: string): Promise<Object>;
    export function getShareViewLog(reportId: string): Promise<any[]>;
    export function logShareView(reportId: string, shareToken: string, req: Object): Promise<Object>;
    export function searchAuditLogs(orgId: string, filters?: Object): Promise<Object>;
}
declare namespace AUDIT_ACTIONS {
    let CREATED: string;
    let UPDATED: string;
    let VERSION_CREATED: string;
    let SUBMITTED_FOR_APPROVAL: string;
    let APPROVED: string;
    let REJECTED: string;
    let FINALIZED: string;
    let UNLOCKED: string;
    let SHARED: string;
    let SHARE_VIEWED: string;
    let EXPORTED_PDF: string;
    let EXPORTED_PPTX: string;
    let COMMENT_ADDED: string;
    let COMMENT_RESOLVED: string;
    let COMMENT_DELETED: string;
    let SCHEDULE_CREATED: string;
    let EMAIL_SENT: string;
}
//# sourceMappingURL=reportAuditService.d.ts.map