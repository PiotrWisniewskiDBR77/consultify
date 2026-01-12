export default ReferralService;
declare namespace ReferralService {
    export function generateCode(userId: string, userState: string, expiresInDays?: number): Promise<Object>;
    export function validateCode(code: string): Promise<Object | null>;
    export function recordUsage(code: string, usedByUserId: string, resultedInOrgId?: string): Promise<Object>;
    export function getUserReferrals(userId: string): Promise<any[]>;
    export function getEcosystemStats(): Promise<Object>;
    export { setDependencies };
}
/**
 * Set dependencies (for testing)
 */
declare function setDependencies(newDeps?: {}): void;
//# sourceMappingURL=referralService.d.ts.map