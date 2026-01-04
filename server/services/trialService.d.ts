export default TrialService;
declare namespace TrialService {
    export function createTrialOrganization(userId: string, orgName: string, durationDays: number): Promise<Object>;
    export function getTrialStatus(organizationId: string): Promise<Object>;
    export function upgradeToPaid(organizationId: string, planType?: string, upgradedByUserId?: string): Promise<Object>;
    export function lockExpiredTrial(organizationId: string): Promise<void>;
    export function sendTrialWarnings(): Promise<number>;
    export function processExpiredTrials(): Promise<number>;
    export function extendTrial(organizationId: string, additionalDays: number, extendedByUserId?: string, reason?: string): Promise<Object>;
    export function _getExtensionCount(organizationId: any): Promise<any>;
    export function _notifyOrgAdmins(organizationId: any, notification: any): Promise<any>;
    export function convertTrialToOrg(trialOrgId: string, userId: string, newOrgName: string): Promise<Object>;
    export function enterTrialPhase(userId: string, accessCodeData?: object): Promise<Object>;
    export function getTrialEntryStatus(userId: string): Promise<Object>;
    export function promoteToTrialOrg(userId: string, orgName: string): Promise<Object>;
    export { setDependencies };
}
/**
 * Set dependencies (for testing)
 */
declare function setDependencies(newDeps?: {}): void;
//# sourceMappingURL=trialService.d.ts.map