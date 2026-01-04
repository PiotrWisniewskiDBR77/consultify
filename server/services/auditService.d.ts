declare namespace _default {
    export { ACTOR_TYPES };
    export { ACTION_TYPES };
    export { logEvent };
    export { logFromRequest };
    export { logSystemEvent };
    export { logAIEvent };
    export { logSecurityEvent };
    export { getEvents };
    export { getCSVExport };
    export { sanitizeMetadata };
}
export default _default;
export namespace ACTOR_TYPES {
    let USER: string;
    let CONSULTANT: string;
    let SYSTEM: string;
    let AI: string;
}
export namespace ACTION_TYPES {
    let INVITE_CREATED: string;
    let INVITE_ACCEPTED: string;
    let INVITE_REVOKED: string;
    let TRIAL_STARTED: string;
    let TRIAL_EXPIRED: string;
    let TRIAL_CONVERTED: string;
    let ORG_CREATED: string;
    let ORG_ACTIVATED: string;
    let ORG_DEACTIVATED: string;
    let ROLE_CHANGED: string;
    let PERMISSION_GRANTED: string;
    let PERMISSION_REVOKED: string;
    let MEMBER_ADDED: string;
    let MEMBER_REMOVED: string;
    let CONSULTANT_LINKED: string;
    let CONSULTANT_UNLINKED: string;
    let TOKEN_CREDITED: string;
    let TOKEN_DEBITED: string;
    let INITIATIVE_CREATED: string;
    let INITIATIVE_UPDATED: string;
    let INITIATIVE_DELETED: string;
    let TASK_CREATED: string;
    let TASK_UPDATED: string;
    let TASK_DELETED: string;
    let AI_PROPOSAL_CREATED: string;
    let AI_ACTION_EXECUTED: string;
    let AI_ACTION_REJECTED: string;
    let USER_LOGIN: string;
    let USER_LOGOUT: string;
    let USER_REGISTERED: string;
    let ACCESS_DENIED: string;
    let TENANT_HOPPING_ATTEMPT: string;
    let ENTITY_VIEWED: string;
    let ENTITY_EXPORTED: string;
    let ONBOARDING_CONTEXT_SAVED: string;
    let ONBOARDING_PLAN_GENERATED: string;
    let ONBOARDING_PLAN_ACCEPTED: string;
}
/**
 * Log an audit event to the database.
 *
 * @param {Object} params - Audit event parameters
 * @returns {Promise<Object>} The created audit event result
 */
export function logEvent({ actorUserId, actorType, orgId, actionType, entityType, entityId, metadata, ip, userAgent }: Object): Promise<Object>;
/**
 * Log from Express request context.
 * Automatically extracts user, org, IP, and user-agent.
 */
export function logFromRequest(req: any, actionType: any, entityType: any, entityId: any, metadata?: {}): Promise<Object>;
/**
 * Log a SYSTEM event (no user actor).
 */
export function logSystemEvent(actionType: any, entityType: any, entityId: any, orgId?: null, metadata?: {}): Promise<Object>;
/**
 * Log an AI event.
 */
export function logAIEvent(actionType: any, entityType: any, entityId: any, orgId?: null, metadata?: {}): Promise<Object>;
/**
 * Log a security event (access denied, tenant hopping, etc.)
 */
export function logSecurityEvent(req: any, actionType: any, metadata?: {}): Promise<Object>;
/**
 * Query audit events with filters.
 */
export function getEvents({ orgId, actorUserId, actionType, entityType, entityId, limit, offset }: {
    orgId: any;
    actorUserId: any;
    actionType: any;
    entityType: any;
    entityId: any;
    limit?: number | undefined;
    offset?: number | undefined;
}): Promise<any>;
/**
 * Generate CSV content for audit events.
 */
export function getCSVExport({ orgId, limit }: {
    orgId: any;
    limit?: number | undefined;
}): Promise<string>;
/**
 * Recursively sanitize metadata object, redacting sensitive fields.
 * @param {Object|Array|any} obj - Data to sanitize
 * @param {number} depth - Current recursion depth (max 10)
 * @returns {Object|Array|any} Sanitized data
 */
export function sanitizeMetadata(obj: Object | any[] | any, depth?: number): Object | any[] | any;
//# sourceMappingURL=auditService.d.ts.map