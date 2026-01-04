/**
 * Consultant Service
 *
 * Manages the "Consultant Mode" features:
 * - Consultant identity & status
 * - Multi-organization access (links)
 * - Consultant-generated invites (Trial & Add-to-Org)
 *
 * Fully migrated from server/services/consultantService.js to TypeScript
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import _logger from '../utils/Logger.js';

// Dynamic import for AccessCodeService (may still be a wrapper)
let AccessCodeService: any = null;

async function getAccessCodeService() {
    if (!AccessCodeService) {
        const module = await import('../../services/accessCodeService.js');
        AccessCodeService = module.default || module;
    }
    return AccessCodeService;
}

// ==========================================
// CONSTANTS
// ==========================================

export const CONSULTANT_INVITE_TYPES = {
    TRIAL_ORG: 'TRIAL_ORG',
    TRIAL_USER: 'TRIAL_USER',
    ORG_ADD_CONSULTANT: 'ORG_ADD_CONSULTANT',
} as const;

export type ConsultantInviteType = (typeof CONSULTANT_INVITE_TYPES)[keyof typeof CONSULTANT_INVITE_TYPES];

// ==========================================
// TYPE DEFINITIONS
// ==========================================

export interface ConsultantRecord {
    id: string;
    display_name: string;
    status: string;
    created_at?: string;
    updated_at?: string;
}

export interface ConsultantProfile {
    id: string;
    displayName: string;
    status: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface LinkedOrganization {
    id: string;
    name: string;
    status: string;
    billing_status?: string;
    trial_expires_at?: string | null;
    link_id: string;
    permission_scope: Record<string, unknown>;
    link_status: string;
    linked_at: string;
}

export interface ConsultantOrgLink {
    id: string;
    consultant_id: string;
    organization_id: string;
    created_by_user_id?: string | null;
    permission_scope: string;
    status: string;
    created_at?: string;
}

export interface CreateInviteParams {
    consultantId: string;
    type: ConsultantInviteType;
    targetEmail?: string | null;
    targetCompanyName?: string | null;
    maxUses?: number;
    expiresInDays?: number;
}

export interface ConsultantInvite {
    id: string;
    code: string;
    type: ConsultantInviteType;
    invite_type: ConsultantInviteType;
    expiresAt: string;
    maxUses: number;
}

export interface ValidateInviteResult {
    invite_code: string;
    invite_type: ConsultantInviteType;
    consultant_id: string;
    status: string;
    expires_at: string | null;
    max_uses: number | null;
    uses_count: number | null;
    metadata: Record<string, unknown>;
}

export interface AcceptInviteResult {
    success: boolean;
    type: string;
    consultantId: string;
}

export interface EnsureLinkResult {
    id: string;
    status: string;
}

// Dependency injection interface for testing
export interface ConsultantServiceDependencies {
    db: IDatabase;
    uuidv4: () => string;
}

// ==========================================
// SERVICE IMPLEMENTATION
// ==========================================

class ConsultantServiceClass {
    private deps: ConsultantServiceDependencies;

    constructor(deps?: Partial<ConsultantServiceDependencies>) {
        this.deps = {
            db: deps?.db ?? getDatabase(),
            uuidv4: deps?.uuidv4 ?? uuidv4,
        };
    }

    /**
     * Set dependencies (for testing)
     */
    setDependencies(newDeps: Partial<ConsultantServiceDependencies>): void {
        this.deps = { ...this.deps, ...newDeps };
    }

    /**
     * Check if a user is a registered consultant
     */
    async getConsultantProfile(userId: string): Promise<ConsultantProfile | null> {
        const row = (await this.deps.db.get<ConsultantRecord>(`SELECT * FROM consultants WHERE id = ?`, [
            userId,
        ])) as ConsultantRecord | null;

        if (!row) return null;

        return {
            id: row.id,
            displayName: row.display_name,
            status: row.status,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }

    /**
     * Register a user as a consultant (Internal/Admin use)
     */
    async registerConsultant(
        userId: string,
        displayName: string,
    ): Promise<{ id: string; displayName: string; status: string }> {
        await this.deps.db.run(
            `INSERT INTO consultants (id, display_name, status) VALUES (?, ?, 'ACTIVE')
             ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name`,
            [userId, displayName],
        );

        return { id: userId, displayName, status: 'ACTIVE' };
    }

    /**
     * Get all organizations linked to a consultant
     */
    async getLinkedOrganizations(consultantId: string): Promise<LinkedOrganization[]> {
        const rows = (await this.deps.db.all<LinkedOrganization & { permission_scope: string }>(
            `SELECT 
                o.id, o.name, o.status, o.billing_status, o.trial_expires_at,
                l.id as link_id, l.permission_scope, l.status as link_status, l.created_at as linked_at
             FROM consultant_org_links l
             JOIN organizations o ON l.organization_id = o.id
             WHERE l.consultant_id = ? AND l.status = 'ACTIVE'
             ORDER BY l.created_at DESC`,
            [consultantId],
        )) as Array<LinkedOrganization & { permission_scope: string }>;

        return rows.map((row) => {
            const parsed = row.permission_scope ? (JSON.parse(row.permission_scope) as Record<string, unknown>) : {};
            return {
                ...row,
                permission_scope: parsed,
            } as LinkedOrganization;
        });
    }

    /**
     * Verify if a consultant has access to a specific organization
     */
    async verifyAccess(
        consultantId: string,
        organizationId: string,
    ): Promise<(Omit<ConsultantOrgLink, 'permission_scope'> & { permission_scope: Record<string, unknown> }) | null> {
        const row = (await this.deps.db.get<ConsultantOrgLink>(
            `SELECT * FROM consultant_org_links 
             WHERE consultant_id = ? AND organization_id = ? AND status = 'ACTIVE'`,
            [consultantId, organizationId],
        )) as ConsultantOrgLink | null;

        if (!row) return null;

        const parsed = row.permission_scope ? (JSON.parse(row.permission_scope) as Record<string, unknown>) : {};
        return {
            ...row,
            permission_scope: parsed,
        };
    }

    /**
     * Generate a short, human-friendly invite code
     * @private
     */
    private _generateCode(): string {
        const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
        let result = '';
        for (let i = 0; i < 8; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    /**
     * Create a consultant invite code
     * Uses unified AccessCodeService
     */
    async createInvite(params: CreateInviteParams): Promise<ConsultantInvite> {
        const { consultantId, type, targetEmail, targetCompanyName, maxUses = 1, expiresInDays = 30 } = params;

        if (!Object.values(CONSULTANT_INVITE_TYPES).includes(type)) {
            throw new Error('Invalid invite type');
        }

        const accessCodeService = await getAccessCodeService();

        // Map Consultant types to AccessCode types
        const accessCodeType = type === 'ORG_ADD_CONSULTANT' ? 'CONSULTANT' : 'TRIAL';

        const metadata = {
            subtype: type,
            targetEmail,
            targetCompanyName,
            source: 'CONSULTANT_DASHBOARD',
        };

        const result = await accessCodeService.generateCode({
            type: accessCodeType,
            createdByConsultantId: consultantId,
            maxUses,
            expiresInDays,
            metadata,
        });

        return {
            id: result.id,
            code: result.code,
            type: type,
            invite_type: type,
            expiresAt: result.expiresAt,
            maxUses: result.maxUses,
        };
    }

    /**
     * Validate an invite code
     * Uses unified AccessCodeService
     */
    async validateInvite(code: string): Promise<ValidateInviteResult> {
        try {
            const accessCodeService = await getAccessCodeService();
            const result = await accessCodeService.validateCode(code);

            return {
                invite_code: result.code,
                invite_type:
                    (result.metadata?.subtype as ConsultantInviteType) ||
                    (result.type === 'CONSULTANT' ? 'ORG_ADD_CONSULTANT' : 'TRIAL_ORG'),
                consultant_id: result.createdByConsultantId,
                status: 'valid',
                expires_at: null,
                max_uses: null,
                uses_count: null,
                metadata: result.metadata as Record<string, unknown>,
            };
        } catch (err: unknown) {
            throw new Error('Invalid or expired invite code');
        }
    }

    /**
     * Record usage of an invite code
     * DEPRECATED: AccessCodeService handles usage
     */
    async recordInviteUsage(_code: string): Promise<void> {
        // No-op, handled by AccessCodeService.acceptCode
        return;
    }

    /**
     * List invites created by a consultant
     * Uses AccessCodeService
     */
    async getConsultantInvites(consultantId: string): Promise<
        Array<{
            id: string;
            invite_code: string;
            invite_type: string;
            created_at: string;
            expires_at: string;
            uses_count: number;
            max_uses: number;
            target_email?: string | null;
            target_company_name?: string | null;
        }>
    > {
        const accessCodeService = await getAccessCodeService();
        const codes = await accessCodeService.listCodes(consultantId, 'CONSULTANT');

        return codes.map((c: any) => ({
            id: c.id,
            invite_code: c.code,
            invite_type: c.metadata?.subtype || c.type,
            created_at: c.created_at,
            expires_at: c.expires_at,
            uses_count: c.uses_count,
            max_uses: c.max_uses,
            target_email: c.metadata?.targetEmail,
            target_company_name: c.metadata?.targetCompanyName,
        }));
    }

    /**
     * Ensure link exists between consultant and organization
     */
    async ensureLink(
        consultantId: string,
        organizationId: string,
        createdByUserId: string,
        permissions: Record<string, unknown> = {},
    ): Promise<EnsureLinkResult> {
        const id = this.deps.uuidv4();
        const permissionJson = JSON.stringify(permissions);

        const existing = (await this.deps.db.get<{ id: string }>(
            `SELECT id FROM consultant_org_links WHERE consultant_id = ? AND organization_id = ?`,
            [consultantId, organizationId],
        )) as { id: string } | null;

        if (existing) {
            await this.deps.db.run(
                `UPDATE consultant_org_links 
                 SET status = 'ACTIVE', permission_scope = ? 
                 WHERE id = ?`,
                [permissionJson, existing.id],
            );
            return { id: existing.id, status: 'ACTIVE' };
        } else {
            await this.deps.db.run(
                `INSERT INTO consultant_org_links 
                 (id, consultant_id, organization_id, created_by_user_id, permission_scope, status)
                 VALUES (?, ?, ?, ?, ?, 'ACTIVE')`,
                [id, consultantId, organizationId, createdByUserId, permissionJson],
            );
            return { id, status: 'ACTIVE' };
        }
    }

    /**
     * Accept an invite code
     */
    async acceptInvite(
        inviteCode: string,
        userId: string,
        targetOrganizationId: string | null = null,
    ): Promise<AcceptInviteResult> {
        const accessCodeService = await getAccessCodeService();
        const acceptedCode = await accessCodeService.acceptCode({
            code: inviteCode,
            actorUserId: userId,
        });

        if (!acceptedCode.ok) {
            throw new Error(acceptedCode.error || 'Failed to accept code');
        }

        const inviteType = acceptedCode.metadata?.subtype || acceptedCode.type;
        const consultantId = acceptedCode.consultantId;

        // Perform specific logic based on invite type
        if (inviteType === 'TRIAL_ORG' || inviteType === 'TRIAL') {
            await this.deps.db.run(
                "UPDATE users SET attribution_source = 'CONSULTANT_INVITE', attribution_data = ? WHERE id = ?",
                [JSON.stringify({ consultantId, code: inviteCode }), userId],
            );
        } else if (inviteType === 'ORG_ADD_CONSULTANT' || inviteType === 'CONSULTANT') {
            const orgId = targetOrganizationId || acceptedCode.organizationId;

            if (!orgId) {
                if (!targetOrganizationId) throw new Error('Organization context required to link consultant');
            }

            await this.ensureLink(consultantId, orgId || targetOrganizationId || '', userId, {
                role: 'CONSULTANT',
                permissions: ['VIEW_ALL', 'COMMENT'],
            });
        }

        return { success: true, type: inviteType, consultantId };
    }

    /**
     * Update permissions for a consultant link
     */
    async updateLinkPermissions(linkId: string, permissions: Record<string, unknown>): Promise<void> {
        await this.deps.db.run(`UPDATE consultant_org_links SET permission_scope = ? WHERE id = ?`, [
            JSON.stringify(permissions),
            linkId,
        ]);
    }

    /**
     * Revoke consultant access
     */
    async revokeLink(linkId: string): Promise<void> {
        await this.deps.db.run(`UPDATE consultant_org_links SET status = 'REVOKED' WHERE id = ?`, [linkId]);
    }
}

// Create singleton instance
const consultantServiceInstance = new ConsultantServiceClass();

// Export individual functions for backward compatibility
export const getConsultantProfile = (userId: string) => consultantServiceInstance.getConsultantProfile(userId);
export const registerConsultant = (userId: string, displayName: string) =>
    consultantServiceInstance.registerConsultant(userId, displayName);
export const getLinkedOrganizations = (consultantId: string) =>
    consultantServiceInstance.getLinkedOrganizations(consultantId);
export const verifyAccess = (consultantId: string, organizationId: string) =>
    consultantServiceInstance.verifyAccess(consultantId, organizationId);
export const createInvite = (params: CreateInviteParams) => consultantServiceInstance.createInvite(params);
export const validateInvite = (code: string) => consultantServiceInstance.validateInvite(code);
export const recordInviteUsage = (code: string) => consultantServiceInstance.recordInviteUsage(code);
export const getConsultantInvites = (consultantId: string) =>
    consultantServiceInstance.getConsultantInvites(consultantId);
export const ensureLink = (
    consultantId: string,
    organizationId: string,
    createdByUserId: string,
    permissions?: Record<string, unknown>,
) => consultantServiceInstance.ensureLink(consultantId, organizationId, createdByUserId, permissions);
export const acceptInvite = (inviteCode: string, userId: string, targetOrganizationId?: string | null) =>
    consultantServiceInstance.acceptInvite(inviteCode, userId, targetOrganizationId);
export const updateLinkPermissions = (linkId: string, permissions: Record<string, unknown>) =>
    consultantServiceInstance.updateLinkPermissions(linkId, permissions);
export const revokeLink = (linkId: string) => consultantServiceInstance.revokeLink(linkId);

// Default export for backward compatibility
const consultantService = {
    INVITE_TYPES: CONSULTANT_INVITE_TYPES,
    getConsultantProfile,
    registerConsultant,
    getLinkedOrganizations,
    verifyAccess,
    createInvite,
    validateInvite,
    recordInviteUsage,
    getConsultantInvites,
    ensureLink,
    acceptInvite,
    updateLinkPermissions,
    revokeLink,
    setDependencies: (newDeps: Partial<ConsultantServiceDependencies>) =>
        consultantServiceInstance.setDependencies(newDeps),
};

export default consultantService;
