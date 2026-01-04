export const ALLOWED_ACTIONS: string[];
export const BLOCKED_ACTIONS: string[];
export const FORBIDDEN_VERBS: string[];
export const ADVISORY_PHRASES: string[];
export namespace RegulatoryModeGuard {
    export { ALLOWED_ACTIONS };
    export { BLOCKED_ACTIONS };
    export { FORBIDDEN_VERBS };
    export { ADVISORY_PHRASES };
    export function setDependencies(newDeps?: {}): void;
    export function isEnabled(projectId: string): Promise<boolean>;
    export function setEnabled(projectId: string, enabled: boolean): Promise<{
        success: boolean;
    }>;
    export function isActionAllowed(actionType: string): boolean;
    export function enforceRegulatoryMode(context: Object, attemptedAction: string): Promise<{
        blocked: boolean;
        reason?: string;
    }>;
    export function logBlockedAttempt(context: Object, attemptedAction: string, reason: string): Promise<void>;
    export function filterPrompt(prompt: string): string;
    export function canPerformAction(projectId: string, action: string): Promise<boolean>;
    export function getRegulatoryPrompt(): string;
    export function getStatus(projectId: string): Promise<Object>;
}
export default RegulatoryModeGuard;
//# sourceMappingURL=regulatoryModeGuard.d.ts.map