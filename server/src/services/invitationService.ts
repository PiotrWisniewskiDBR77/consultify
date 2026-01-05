import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import logger from '../utils/Logger.js';
import { InvitationDataService } from './invitation/InvitationDataService.js';
import { InvitationSendingService } from './invitation/InvitationSendingService.js';
import { InvitationTokenService } from './invitation/InvitationTokenService.js';
import {
    AcceptInvitationParams,
    CreateOrgInvitationParams,
    CreateProjectInvitationParams,
    INVITATION_EVENT_TYPES,
    INVITATION_STATUS,
    INVITATION_TYPES,
    InvitationRecord,
    InvitationStatus,
    InvitationType,
    InvitePermissionResult,
    ListInvitationsOptions,
    MAX_RESEND_COUNT,
    RequestInfo,
    RESEND_COOLDOWN_MINUTES,
} from './invitation/InvitationTypes.js';

// Dynamic imports
let AccessPolicyService: any = null;
let AttributionService: any = null;
let MetricsCollector: any = null;
let SeatManagementService: any = null;

async function getAccessPolicyService() {
    if (!AccessPolicyService) {
        const module = await import('./accessPolicyService.js');
        AccessPolicyService = module.default || module;
    }
    return AccessPolicyService;
}

async function getAttributionService() {
    if (!AttributionService) {
        const module = await import('./attributionService.js');
        AttributionService = module.default || module;
    }
    return AttributionService;
}

async function getMetricsCollector() {
    if (!MetricsCollector) {
        const module = await import('./metricsCollector.js');
        MetricsCollector = module.default || module;
    }
    return MetricsCollector;
}

async function getSeatManagementService() {
    if (!SeatManagementService) {
        const module = await import('./seatManagementService.js');
        SeatManagementService = module.default || module;
    }
    return SeatManagementService;
}

export interface InvitationServiceDependencies {
    db: IDatabase;
    uuidv4: () => string;
    crypto: typeof crypto;
    bcrypt: typeof bcrypt;
    tokenService: InvitationTokenService;
    dataService: InvitationDataService;
    sendingService: InvitationSendingService;
}

export class InvitationServiceClass {
    private deps: InvitationServiceDependencies;

    constructor(deps?: Partial<InvitationServiceDependencies>) {
        // Initialize sub-services
        const tokenService = deps?.tokenService ?? new InvitationTokenService({ crypto: deps?.crypto });
        const dataService = deps?.dataService ?? new InvitationDataService({ db: deps?.db, uuidv4: deps?.uuidv4 });
        const sendingService = deps?.sendingService ?? new InvitationSendingService();

        this.deps = {
            db: deps?.db ?? getDatabase(),
            uuidv4: deps?.uuidv4 ?? uuidv4,
            crypto: deps?.crypto ?? crypto,
            bcrypt: deps?.bcrypt ?? bcrypt,
            tokenService,
            dataService,
            sendingService,
        };
    }

    setDependencies(newDeps: Partial<InvitationServiceDependencies>): void {
        this.deps = { ...this.deps, ...newDeps };
        // Propagate to sub-services if they were not explicitly passed
        // Note: Ideally, we should recreate sub-services or have them support setDeps
    }

    // --- Delegation to Sub-Services (or Orchestration) ---

    generateSecureToken(): string {
        return this.deps.tokenService.generateSecureToken();
    }

    hashToken(token: string): string {
        return this.deps.tokenService.hashToken(token);
    }

    calculateExpiryDate(days?: number): string {
        return this.deps.tokenService.calculateExpiryDate(days);
    }

    async logEvent(
        invitationId: string,
        eventType: string,
        performedByUserId: string | null = null,
        metadata: Record<string, unknown> = {},
        requestInfo: RequestInfo = {},
    ) {
        return this.deps.dataService.logEvent(invitationId, eventType, performedByUserId, metadata, requestInfo);
    }

    async checkInvitePermission(organizationId: string, requestingUserId: string): Promise<InvitePermissionResult> {
        const accessPolicyService = await getAccessPolicyService();
        const policyResult = await accessPolicyService.canInviteUsers(organizationId, requestingUserId);

        if (!policyResult.allowed) {
            const reasonMessages: Record<string, string> = {
                ORG_NOT_FOUND: 'Organization not found',
                DEMO_READ_ONLY: 'Demo organizations cannot invite new members',
                DEMO_INVITES_DISABLED: 'Demo organizations cannot invite new members',
                TRIAL_EXPIRED: 'Trial has expired. Please upgrade to invite new members.',
                USER_LIMIT_REACHED: 'Organization has reached maximum seats. Please upgrade to add more members.',
            };

            return {
                allowed: false,
                reasonCode: policyResult.reasonCode,
                reason: reasonMessages[policyResult.reasonCode || ''] || 'Cannot invite users at this time',
            };
        }

        const seatInfo = await accessPolicyService.getSeatAvailability(organizationId);

        return {
            allowed: true,
            reasonCode: 'OK',
            seatsRemaining: seatInfo.seatsRemaining,
            maxSeats: seatInfo.maxSeats,
            currentSeats: seatInfo.currentSeats,
        };
    }

    // --- Orchestration Methods ---

    async createOrgInvitation(
        params: CreateOrgInvitationParams,
        requestInfo: RequestInfo = {},
    ): Promise<{
        id: string;
        invitationType: InvitationType;
        organizationId: string;
        email: string;
        role: string;
        token: string;
        status: InvitationStatus;
        expiresAt: string;
        invitedByUserId: string;
    }> {
        const { organizationId, email, role = 'USER', invitedByUserId, metadata = {} } = params;

        // Validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw new Error('Invalid email format');
        }

        const permissionCheck = await this.checkInvitePermission(organizationId, invitedByUserId);
        if (!permissionCheck.allowed) {
            const error = new Error(permissionCheck.reason || 'Cannot invite users');
            (error as Error & { reasonCode?: string }).reasonCode = permissionCheck.reasonCode;
            throw error;
        }

        const existingInvite = await this.deps.dataService.getPendingInvitationByEmail(organizationId, email);
        if (existingInvite) {
            throw new Error('A pending invitation already exists for this email');
        }

        // Check user existence
        const existingUser = await this.deps.db.get<{ id: string }>(
            `SELECT id FROM users WHERE email = ? AND organization_id = ?`,
            [email.toLowerCase(), organizationId],
        );
        if (existingUser) {
            throw new Error('User is already a member of this organization');
        }

        // Seat check
        try {
            const seatManagementService = await getSeatManagementService();
            const canAdd = await seatManagementService.canAddUser(organizationId);
            if (!canAdd) {
                const autoAddResult = await seatManagementService.autoAddSeatOnInvite(organizationId, invitedByUserId);
                if (!autoAddResult.autoAdded) {
                    const canAddAfterAuto = await seatManagementService.canAddUser(organizationId);
                    if (!canAddAfterAuto) {
                        throw new Error(
                            'No available seats. Please purchase additional seats or contact your administrator.',
                        );
                    }
                }
            }
        } catch (seatErr) {
            logger.warn('[InvitationService] Seat check failed:', seatErr as Error);
        }

        // Creation
        const id = this.deps.uuidv4();
        const token = this.deps.tokenService.generateSecureToken();
        const tokenHash = this.deps.tokenService.hashToken(token);
        const expiresAt = this.deps.tokenService.calculateExpiryDate();

        await this.deps.dataService.createInvitation({
            id,
            organizationId,
            email,
            role,
            roleToAssign: role,
            tokenHash,
            invitedByUserId,
            expiresAt,
            invitationType: INVITATION_TYPES.ORG,
            metadata,
        });

        await this.deps.dataService.logEvent(
            id,
            INVITATION_EVENT_TYPES.CREATED,
            invitedByUserId,
            { role },
            requestInfo,
        );

        // Sending
        const inviteLink = await this.deps.sendingService.sendOrgInvitation(email, token);

        await this.deps.dataService.logEvent(
            id,
            INVITATION_EVENT_TYPES.SENT,
            invitedByUserId,
            { inviteLink },
            requestInfo,
        );

        // Metrics
        try {
            const metricsCollector = await getMetricsCollector();
            await metricsCollector.recordEvent(metricsCollector.EVENT_TYPES.INVITE_SENT, {
                userId: invitedByUserId,
                organizationId,
                source: metricsCollector.SOURCE_TYPES.INVITATION,
                context: { email: email.toLowerCase(), role, invitationType: INVITATION_TYPES.ORG },
            });
        } catch (metricsErr) {
            logger.warn('[InvitationService] Metrics recording failed:', metricsErr as Error);
        }

        return {
            id,
            invitationType: INVITATION_TYPES.ORG,
            organizationId,
            email: email.toLowerCase(),
            role,
            token,
            status: INVITATION_STATUS.PENDING,
            expiresAt,
            invitedByUserId,
        };
    }

    async createProjectInvitation(
        params: CreateProjectInvitationParams,
        requestInfo: RequestInfo = {},
    ): Promise<{
        id: string;
        invitationType: InvitationType;
        organizationId: string;
        projectId: string;
        email: string;
        projectRole: string;
        orgRole: string;
        token: string;
        status: InvitationStatus;
        expiresAt: string;
        invitedByUserId: string;
    }> {
        const {
            organizationId,
            projectId,
            email,
            projectRole = 'member',
            orgRole = 'USER',
            invitedByUserId,
            metadata = {},
        } = params;

        // Validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw new Error('Invalid email format');
        }

        const project = await this.deps.db.get<{ id: string; name: string }>(
            `SELECT id, name FROM projects WHERE id = ? AND organization_id = ?`,
            [projectId, organizationId],
        );
        if (!project) throw new Error('Project not found in this organization');

        const permissionCheck = await this.checkInvitePermission(organizationId, invitedByUserId);
        if (!permissionCheck.allowed) {
            const error = new Error(permissionCheck.reason || 'Cannot invite users');
            (error as Error & { reasonCode?: string }).reasonCode = permissionCheck.reasonCode;
            throw error;
        }

        // Creation
        const id = this.deps.uuidv4();
        const token = this.deps.tokenService.generateSecureToken();
        const tokenHash = this.deps.tokenService.hashToken(token);
        const expiresAt = this.deps.tokenService.calculateExpiryDate();

        const invitationMetadata = {
            ...metadata,
            projectRole,
            projectName: project.name,
        };

        await this.deps.dataService.createInvitation({
            id,
            organizationId,
            projectId,
            email,
            role: orgRole,
            roleToAssign: orgRole,
            tokenHash,
            invitedByUserId,
            expiresAt,
            invitationType: INVITATION_TYPES.PROJECT,
            metadata: invitationMetadata,
        });

        await this.deps.dataService.logEvent(
            id,
            INVITATION_EVENT_TYPES.CREATED,
            invitedByUserId,
            { projectRole, projectId },
            requestInfo,
        );

        // Sending
        const inviteLink = await this.deps.sendingService.sendProjectInvitation(email, project.name, token);

        await this.deps.dataService.logEvent(
            id,
            INVITATION_EVENT_TYPES.SENT,
            invitedByUserId,
            { inviteLink },
            requestInfo,
        );

        return {
            id,
            invitationType: INVITATION_TYPES.PROJECT,
            organizationId,
            projectId,
            email: email.toLowerCase(),
            projectRole,
            orgRole,
            token,
            status: INVITATION_STATUS.PENDING,
            expiresAt,
            invitedByUserId,
        };
    }

    async getByToken(token: string): Promise<InvitationRecord | null> {
        const tokenHash = this.deps.tokenService.hashToken(token);
        return this.deps.dataService.getInvitationByTokenHash(tokenHash);
    }

    async acceptInvitation(
        params: AcceptInvitationParams,
        requestInfo: RequestInfo = {},
    ): Promise<{
        success: boolean;
        userId: string;
        isNewUser: boolean;
        organizationId: string;
        projectId?: string | null;
        role: string;
    }> {
        const { token, email, firstName, lastName, password } = params;

        const invitation = await this.getByToken(token);
        if (!invitation) throw new Error('Invalid invitation token');

        if (invitation.status !== INVITATION_STATUS.PENDING) {
            throw new Error(`Invitation is ${invitation.status}`);
        }

        if (new Date(invitation.expires_at) < new Date()) {
            await this.deps.dataService.markAsExpired(invitation.id);
            await this.deps.dataService.logEvent(invitation.id, INVITATION_EVENT_TYPES.EXPIRED, null, {}, requestInfo);
            throw new Error('Invitation has expired');
        }

        // Email binding
        if (email.toLowerCase() !== invitation.email.toLowerCase()) {
            throw new Error(
                'Email address does not match invitation. Please use the email address the invitation was sent to.',
            );
        }

        // Check user
        const existingUser = await this.deps.db.get<{ id: string; organization_id: string }>(
            `SELECT id, organization_id FROM users WHERE email = ?`,
            [email.toLowerCase()],
        );

        if (existingUser) {
            if (existingUser.organization_id === invitation.organization_id) {
                throw new Error('You are already a member of this organization');
            }
            throw new Error('User with this email already exists. Multi-organization support coming soon.');
        }

        // Create new user (should ideally be in UserService, but kept here for now for consistency)
        const userId = this.deps.uuidv4();
        const hashedPassword = this.deps.bcrypt.hashSync(password, 10);
        const role = invitation.role_to_assign || invitation.role;

        await this.deps.db.run(
            `INSERT INTO users (id, organization_id, email, password, first_name, last_name, role, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
            [userId, invitation.organization_id, email.toLowerCase(), hashedPassword, firstName, lastName, role],
        );

        // Add to project
        if (invitation.invitation_type === INVITATION_TYPES.PROJECT && invitation.project_id) {
            const metadata = JSON.parse(invitation.metadata || '{}') as { projectRole?: string };
            const projectRole = metadata.projectRole || 'member';

            await this.deps.db.run(
                `INSERT OR REPLACE INTO project_users (project_id, user_id, role, assigned_at)
                 VALUES (?, ?, ?, datetime('now'))`,
                [invitation.project_id, userId, projectRole],
            );
        }

        // Mark accepted
        const accepted = await this.deps.dataService.markAsAccepted(invitation.id, userId);
        if (!accepted) {
            throw new Error('Invitation has already been accepted or is no longer valid');
        }

        // Seat increment
        try {
            const accessPolicyService = await getAccessPolicyService();
            await accessPolicyService.incrementUsage(invitation.organization_id, 'users', 1);
        } catch (counterErr) {
            logger.warn('[InvitationService] Failed to increment seat counter:', counterErr);
        }

        // Attribution
        try {
            const attributionService = await getAttributionService();
            const invitationMetadata = JSON.parse(invitation.metadata || '{}') as {
                attribution?: Record<string, unknown>;
            };
            await attributionService.recordAttribution({
                organizationId: invitation.organization_id,
                userId,
                sourceType: attributionService.SOURCE_TYPES.INVITATION,
                sourceId: invitation.id,
                campaign: invitationMetadata.attribution?.campaign as string | undefined,
                partnerCode: invitationMetadata.attribution?.partnerCode as string | undefined,
                medium: invitationMetadata.attribution?.medium as string | undefined,
                metadata: {
                    invitedBy: invitation.invited_by,
                    email: email,
                    role,
                    invitationType: invitation.invitation_type,
                    projectId: invitation.project_id,
                    entryPoint: 'invitation_accept',
                },
            });
        } catch (attrErr) {
            logger.warn('[InvitationService] Attribution recording failed:', attrErr);
        }

        await this.deps.dataService.logEvent(
            invitation.id,
            INVITATION_EVENT_TYPES.ACCEPTED,
            userId,
            {
                isNewUser: true,
                email_bound: true,
                token_validation: 'passed',
                orgId: invitation.organization_id,
                projectId: invitation.project_id,
                role_assigned: role,
            },
            requestInfo,
        );

        // Metrics
        try {
            const metricsCollector = await getMetricsCollector();
            await metricsCollector.recordEvent(metricsCollector.EVENT_TYPES.INVITE_ACCEPTED, {
                userId,
                organizationId: invitation.organization_id,
                source: metricsCollector.SOURCE_TYPES.INVITATION,
                context: {
                    isNewUser: true,
                    invitationType: invitation.invitation_type,
                    invitationId: invitation.id,
                    role,
                },
            });
        } catch (metricsErr) {
            logger.warn('[InvitationService] Metrics recording failed:', metricsErr);
        }

        return {
            success: true,
            userId,
            isNewUser: true,
            organizationId: invitation.organization_id,
            projectId: invitation.project_id || undefined,
            role,
        };
    }

    async resendInvitation(
        invitationId: string,
        performedByUserId: string,
        requestInfo: RequestInfo = {},
    ): Promise<{
        id: string;
        email: string;
        token: string;
        expiresAt: string;
        status: InvitationStatus;
    }> {
        const invitation = await this.deps.dataService.getInvitationById(invitationId);
        if (!invitation) throw new Error('Invitation not found');

        if (invitation.status !== INVITATION_STATUS.PENDING && invitation.status !== INVITATION_STATUS.EXPIRED) {
            throw new Error(`Cannot resend ${invitation.status} invitation`);
        }

        const resendCount = invitation.resend_count || 0;
        if (resendCount >= MAX_RESEND_COUNT) {
            throw new Error(
                `Maximum resend limit (${MAX_RESEND_COUNT}) reached. Please revoke and create a new invitation.`,
            );
        }

        if (invitation.last_resent_at) {
            const lastResent = new Date(invitation.last_resent_at);
            const cooldownEnd = new Date(lastResent.getTime() + RESEND_COOLDOWN_MINUTES * 60 * 1000);
            if (new Date() < cooldownEnd) {
                const waitMinutes = Math.ceil((cooldownEnd.getTime() - Date.now()) / 60000);
                throw new Error(`Please wait ${waitMinutes} minute(s) before resending.`);
            }
        }

        const newToken = this.deps.tokenService.generateSecureToken();
        const newTokenHash = this.deps.tokenService.hashToken(newToken);
        const newExpiresAt = this.deps.tokenService.calculateExpiryDate();

        await this.deps.dataService.updateForResend(invitationId, newTokenHash, newExpiresAt);

        const link = await this.deps.sendingService.sendResentInvitation(invitation.email, newToken);

        await this.deps.dataService.logEvent(
            invitationId,
            INVITATION_EVENT_TYPES.RESENT,
            performedByUserId,
            {
                newExpiresAt,
                resendCount: resendCount + 1,
                previousTokenHash: invitation.token_hash ? invitation.token_hash.substring(0, 16) : 'unknown',
            },
            requestInfo,
        );

        return {
            id: invitationId,
            email: invitation.email,
            token: newToken,
            expiresAt: newExpiresAt,
            status: INVITATION_STATUS.PENDING,
        };
    }

    async revokeInvitation(
        invitationId: string,
        performedByUserId: string,
        reason: string = '',
        requestInfo: RequestInfo = {},
    ): Promise<{
        id: string;
        email: string;
        status: InvitationStatus;
    }> {
        const invitation = await this.deps.dataService.getInvitationById(invitationId);
        if (!invitation) throw new Error('Invitation not found');

        await this.deps.dataService.markAsRevoked(invitationId);

        await this.deps.dataService.logEvent(
            invitationId,
            INVITATION_EVENT_TYPES.REVOKED,
            performedByUserId,
            { reason },
            requestInfo,
        );

        return {
            id: invitationId,
            email: invitation.email,
            status: INVITATION_STATUS.REVOKED,
        };
    }

    async listOrgInvitations(
        organizationId: string,
        options: ListInvitationsOptions = {},
    ): Promise<InvitationRecord[]> {
        return this.deps.dataService.listInvitations(organizationId, options);
    }

    // ==========================================
    // BACKWARD COMPATIBILITY METHODS
    // ==========================================

    async getInvitations(organizationId: string): Promise<InvitationRecord[]> {
        return this.listOrgInvitations(organizationId);
    }

    async createInvitation(params: CreateOrgInvitationParams, requestInfo: RequestInfo = {}): Promise<any> {
        return this.createOrgInvitation(params, requestInfo);
    }

    async cancelInvitation(invitationId: string, performedByUserId: string): Promise<any> {
        return this.revokeInvitation(invitationId, performedByUserId);
    }
}

const instance = new InvitationServiceClass();
export default instance;

// Named exports for backward compatibility
export const acceptInvitation = (params: any) => instance.acceptInvitation(params);
export const createInvitation = (params: any) => instance.createInvitation(params);
export const resendInvitation = (id: string, userId: string) => instance.resendInvitation(id, userId);
export const cancelInvitation = (id: string, userId: string) => instance.cancelInvitation(id, userId);
export const getInvitations = (orgId: string) => instance.getInvitations(orgId);
