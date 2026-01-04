export default ConsultantService;
declare namespace ConsultantService {
    export { CONSULTANT_INVITE_TYPES as INVITE_TYPES };
    export function getConsultantProfile(userId: string): Promise<Object | null>;
    export function registerConsultant(userId: string, displayName: string): Promise<Object>;
    export function getLinkedOrganizations(consultantId: string): Promise<any[]>;
    export function verifyAccess(consultantId: string, organizationId: string): Promise<Object | null>;
    export function _generateCode(): string;
    export function createInvite({ consultantId, type, targetEmail, targetCompanyName, maxUses, expiresInDays }: {
        consultantId: any;
        type: any;
        targetEmail: any;
        targetCompanyName: any;
        maxUses?: number | undefined;
        expiresInDays?: number | undefined;
    }): Promise<{
        id: string;
        code: string;
        type: any;
        invite_type: any;
        expiresAt: string;
        maxUses: number;
    }>;
    export function validateInvite(code: any): Promise<{
        invite_code: any;
        invite_type: any;
        consultant_id: any;
        status: string;
        expires_at: null;
        max_uses: null;
        uses_count: null;
        metadata: any;
    }>;
    export function recordInviteUsage(code: any): Promise<void>;
    export function getConsultantInvites(consultantId: any): Promise<any>;
    export function ensureLink(consultantId: any, organizationId: any, createdByUserId: any, permissions?: {}): Promise<any>;
    export function acceptInvite(inviteCode: any, userId: any, targetOrganizationId?: null): Promise<{
        success: boolean;
        type: any;
        consultantId: any;
    }>;
    export function updateLinkPermissions(linkId: any, permissions: any): Promise<any>;
    export function revokeLink(linkId: any): Promise<any>;
    export { setDependencies };
}
declare namespace CONSULTANT_INVITE_TYPES {
    let TRIAL_ORG: string;
    let TRIAL_USER: string;
    let ORG_ADD_CONSULTANT: string;
}
/**
 * Set dependencies (for testing)
 */
declare function setDependencies(newDeps?: {}): void;
//# sourceMappingURL=consultantService.d.ts.map