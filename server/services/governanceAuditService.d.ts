export default GovernanceAuditService;
declare namespace GovernanceAuditService {
    export { AUDIT_ACTIONS };
    export { RESOURCE_TYPES };
    export function logAudit({ actorId, actorRole, orgId, action, resourceType, resourceId, before, after, correlationId }: {
        actorId: string;
        actorRole: string;
        orgId: string;
        action: string;
        resourceType: string;
        resourceId?: string | undefined;
        before?: Object | undefined;
        after?: Object | undefined;
        correlationId?: string | undefined;
    }): Promise<Object>;
    export function getAuditLog({ orgId, superadminBypass, action, resourceType, resourceId, actorId, startDate, endDate, limit, offset }: {
        orgId: string;
        superadminBypass?: boolean | undefined;
        action?: string | undefined;
        resourceType?: string | undefined;
        resourceId?: string | undefined;
        actorId?: string | undefined;
        startDate?: string | undefined;
        endDate?: string | undefined;
        limit?: number | undefined;
        offset?: number | undefined;
    }): Promise<any[]>;
    export function exportAuditLog({ orgId, format, superadminBypass, startDate, endDate }: {
        orgId: string;
        format?: string | undefined;
        superadminBypass?: boolean | undefined;
    }): Promise<Object>;
    export function verifyHashChain(orgId: string): Promise<Object>;
}
declare namespace AUDIT_ACTIONS {
    let CREATE: string;
    let UPDATE: string;
    let DELETE: string;
    let PUBLISH: string;
    let TOGGLE: string;
    let DELETE_SOFT: string;
    let GRANT_PERMISSION: string;
    let REVOKE_PERMISSION: string;
    let BREAK_GLASS_START: string;
    let BREAK_GLASS_CLOSE: string;
}
declare namespace RESOURCE_TYPES {
    let POLICY_RULE: string;
    let PLAYBOOK_TEMPLATE: string;
    let CONNECTOR: string;
    let PERMISSION: string;
    let USER: string;
    let ORGANIZATION: string;
    let BREAK_GLASS_SESSION: string;
    let GLOBAL_TOGGLE: string;
    let DIGITIZATION_ANALYSIS: string;
    let DIGITIZATION_SCORE: string;
    let DIGITIZATION_VERSION: string;
    let DIGITIZATION_EVIDENCE: string;
    let DIGITIZATION_COMPARISON: string;
    let DIGITIZATION_EXPORT: string;
}
//# sourceMappingURL=governanceAuditService.d.ts.map