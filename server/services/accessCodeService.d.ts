export default AccessCodeService;
declare namespace AccessCodeService {
    export { CODE_TYPES };
    export { CODE_STATUS };
    export function generateCode({ type, createdByUserId, createdByConsultantId, organizationId, targetEmail, maxUses, expiresInDays, metadata }: {
        type: any;
        createdByUserId?: null | undefined;
        createdByConsultantId?: null | undefined;
        organizationId?: null | undefined;
        targetEmail?: null | undefined;
        maxUses?: number | undefined;
        expiresInDays?: number | undefined;
        metadata?: {} | undefined;
    }): Promise<{
        id: string;
        code: string;
        type: any;
        expiresAt: string;
        maxUses: number;
    }>;
    export function validatePublic(code: string): object;
    export function validateCode(code: string): object;
    export function acceptCode({ code, actorUserId, providedEmail, actorIp }: {
        code: string;
        actorUserId: string;
        providedEmail?: string | undefined;
        actorIp?: string | undefined;
    }): object;
    export function listCodes(userId: any, userIdType?: string): Promise<any>;
    export function revokeCode(codeId: any): Promise<void>;
}
declare namespace CODE_TYPES {
    let REFERRAL: string;
    let INVITE: string;
    let CONSULTANT: string;
    let TRIAL: string;
}
declare namespace CODE_STATUS {
    let ACTIVE: string;
    let REVOKED: string;
    let EXPIRED: string;
}
//# sourceMappingURL=accessCodeService.d.ts.map