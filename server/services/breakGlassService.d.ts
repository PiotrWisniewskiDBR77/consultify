export default BreakGlassService;
declare namespace BreakGlassService {
    export { BREAK_GLASS_SCOPES as SCOPES };
    export { DEFAULT_DURATION_MINUTES };
    export { MAX_DURATION_MINUTES };
    export function setDependencies(newDeps?: {}): void;
    export function startSession({ actorId, actorRole, orgId, reason, scope, durationMinutes }: {
        actorId: string;
        actorRole: string;
        orgId: string;
        reason: string;
        scope: string;
        durationMinutes?: number | undefined;
    }): Promise<Object>;
    export function closeSession(sessionId: string, actorId: string, actorRole: string): Promise<Object>;
    export function getActiveSessions(orgId: string): Promise<any[]>;
    export function getActiveSession(orgId: string, scope: string): Promise<Object | null>;
    export function isBreakGlassActive(orgId: string, scope: string): Promise<boolean>;
    export function getAllActiveSessions(): Promise<any[]>;
}
declare namespace BREAK_GLASS_SCOPES {
    let POLICY_ENGINE_DISABLED: string;
    let APPROVAL_BYPASS: string;
    let RATE_LIMIT_BYPASS: string;
    let AUDIT_BYPASS: string;
    let EMERGENCY_ACCESS: string;
}
declare const DEFAULT_DURATION_MINUTES: 120;
declare const MAX_DURATION_MINUTES: 1440;
//# sourceMappingURL=breakGlassService.d.ts.map