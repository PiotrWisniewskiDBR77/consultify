/**
 * Invitation Service
 * 
 * Enterprise-grade invitation system for B2B SaaS platform.
 * Supports organization and project-level invitations with full audit trail.
 * 
 * Security Features:
 * - Cryptographically secure tokens (32-byte random)
 * - Single-use token enforcement
 * - Email binding validation
 * - Seat limit enforcement for Trial orgs
 * - Demo org invitation restrictions
 * 
 * Fully migrated from server/services/invitationService.js to TypeScript
 */

import type { IDatabase } from '../database/IDatabase.js';
import { getDatabase } from '../database/Database.js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import logger from '../utils/Logger.js';

// ==========================================
// TYPE DEFINITIONS
// ==========================================

export const INVITATION_EXPIRY_DAYS = 7;
export const TOKEN_LENGTH_BYTES = 32; // 64 hex characters
export const MAX_RESEND_COUNT = 3;
export const RESEND_COOLDOWN_MINUTES = 5;

export const INVITATION_TYPES = {
    ORG: 'ORG',
    PROJECT: 'PROJECT'
} as const;

export const INVITATION_STATUS = {
    PENDING: 'pending',
    ACCEPTED: 'accepted',
    EXPIRED: 'expired',
    REVOKED: 'revoked'
} as const;

export const INVITATION_EVENT_TYPES = {
    CREATED: 'created',
    SENT: 'sent',
    RESENT: 'resent',
    ACCEPTED: 'accepted',
    EXPIRED: 'expired',
    REVOKED: 'revoked'
} as const;

export type InvitationType = typeof INVITATION_TYPES[keyof typeof INVITATION_TYPES];
export type InvitationStatus = typeof INVITATION_STATUS[keyof typeof INVITATION_STATUS];
export type InvitationEventType = typeof INVITATION_EVENT_TYPES[keyof typeof INVITATION_EVENT_TYPES];

export interface RequestInfo {
    ipAddress?: string;
    userAgent?: string;
}

export interface CreateOrgInvitationParams {
    organizationId: string;
    email: string;
    role?: string;
    invitedByUserId: string;
    metadata?: Record<string, unknown>;
}

export interface CreateProjectInvitationParams {
    organizationId: string;
    projectId: string;
    email: string;
    projectRole?: string;
    orgRole?: string;
    invitedByUserId: string;
    metadata?: Record<string, unknown>;
}

export interface AcceptInvitationParams {
    token: string;
    email: string;
    firstName: string;
    lastName: string;
    password: string;
}

export interface InvitationRecord {
    id: string;
    organization_id: string;
    project_id?: string | null;
    email: string;
    role: string;
    role_to_assign?: string | null;
    token?: string | null;
    token_hash: string;
    status: InvitationStatus | string;
    invited_by?: string | null;
    expires_at: string;
    invitation_type: InvitationType | string;
    metadata?: string | null;
    accepted_at?: string | null;
    accepted_by_user_id?: string | null;
    resend_count?: number | null;
    last_resent_at?: string | null;
    created_at?: string;
    organization_name?: string;
    project_name?: string;
}

export interface InvitationEventRecord {
    id: string;
    invitation_id: string;
    event_type: InvitationEventType | string;
    performed_by_user_id?: string | null;
    ip_address?: string | null;
    user_agent?: string | null;
    metadata?: string | null;
    created_at?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
}

export interface InvitePermissionResult {
    allowed: boolean;
    reasonCode?: string;
    reason?: string;
    seatsRemaining?: number;
    maxSeats?: number;
    currentSeats?: number;
}

export interface ListInvitationsOptions {
    status?: InvitationStatus | string;
    invitationType?: InvitationType | string;
    limit?: number;
    offset?: number;
}

// Dynamic imports for services that may still be wrappers
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

// Dependency injection interface for testing
export interface InvitationServiceDependencies {
    db: IDatabase;
    uuidv4: () => string;
    crypto: typeof crypto;
    bcrypt: typeof bcrypt;
}

// ==========================================
// SERVICE IMPLEMENTATION
// ==========================================

class InvitationServiceClass {
    private deps: InvitationServiceDependencies;

    constructor(deps?: Partial<InvitationServiceDependencies>) {
        this.deps = {
            db: deps?.db ?? getDatabase(),
            uuidv4: deps?.uuidv4 ?? uuidv4,
            crypto: deps?.crypto ?? crypto,
            bcrypt: deps?.bcrypt ?? bcrypt
        };
    }

    /**
     * Set dependencies (for testing)
     */
    setDependencies(newDeps: Partial<InvitationServiceDependencies>): void {
        this.deps = { ...this.deps, ...newDeps };
    }

    /**
     * Generate a cryptographically secure token
     */
    generateSecureToken(): string {
        return this.deps.crypto.randomBytes(TOKEN_LENGTH_BYTES).toString('hex');
    }

    /**
     * Hash a token for secure storage
     */
    hashToken(token: string): string {
        return this.deps.crypto.createHash('sha256').update(token).digest('hex');
    }

    /**
     * Calculate expiration date
     */
    calculateExpiryDate(days: number = INVITATION_EXPIRY_DAYS): string {
        return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    }

    /**
     * Log an invitation event for audit trail
     */
    async logEvent(
        invitationId: string,
        eventType: InvitationEventType | string,
        performedByUserId: string | null = null,
        metadata: Record<string, unknown> = {},
        requestInfo: RequestInfo = {}
    ): Promise<{ id: string; invitationId: string; eventType: string }> {
        const id = this.deps.uuidv4();
        const { ipAddress, userAgent } = requestInfo;

        await this.deps.db.run(
            `INSERT INTO invitation_events 
             (id, invitation_id, event_type, performed_by_user_id, ip_address, user_agent, metadata) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [id, invitationId, eventType, performedByUserId, ipAddress || null, userAgent || null, JSON.stringify(metadata)]
        );

        return { id, invitationId, eventType };
    }

    /**
     * Check if organization can accept new members (seat limits)
     */
    async checkInvitePermission(organizationId: string, requestingUserId: string): Promise<InvitePermissionResult> {
        const accessPolicyService = await getAccessPolicyService();
        const policyResult = await accessPolicyService.canInviteUsers(organizationId, requestingUserId);

        if (!policyResult.allowed) {
            const reasonMessages: Record<string, string> = {
                'ORG_NOT_FOUND': 'Organization not found',
                'DEMO_READ_ONLY': 'Demo organizations cannot invite new members',
                'DEMO_INVITES_DISABLED': 'Demo organizations cannot invite new members',
                'TRIAL_EXPIRED': 'Trial has expired. Please upgrade to invite new members.',
                'USER_LIMIT_REACHED': 'Organization has reached maximum seats. Please upgrade to add more members.'
            };

            return {
                allowed: false,
                reasonCode: policyResult.reasonCode,
                reason: reasonMessages[policyResult.reasonCode || ''] || 'Cannot invite users at this time'
            };
        }

        const seatInfo = await accessPolicyService.getSeatAvailability(organizationId);

        return {
            allowed: true,
            reasonCode: 'OK',
            seatsRemaining: seatInfo.seatsRemaining,
            maxSeats: seatInfo.maxSeats,
            currentSeats: seatInfo.currentSeats
        };
    }

    /**
     * Check if user has permission to invite to organization
     */
    async canInviteToOrg(userId: string, organizationId: string): Promise<boolean> {
        const user = await this.deps.db.get<{ role: string }>(
            `SELECT role FROM users WHERE id = ? AND organization_id = ?`,
            [userId, organizationId]
        ) as { role: string } | null;

        if (!user) return false;

        // Only ADMIN and SUPERADMIN can invite
        return user.role === 'ADMIN' || user.role === 'SUPERADMIN';
    }

    /**
     * Check if user has permission to invite to project
     */
    async canInviteToProject(userId: string, projectId: string): Promise<boolean> {
        const result = await this.deps.db.get<{ project_role?: string; org_role?: string }>(
            `SELECT pu.role as project_role, u.role as org_role
             FROM users u
             LEFT JOIN project_users pu ON pu.user_id = u.id AND pu.project_id = ?
             WHERE u.id = ?`,
            [projectId, userId]
        ) as { project_role?: string; org_role?: string } | null;

        if (!result) return false;

        // Org admins can invite to any project
        if (result.org_role === 'ADMIN' || result.org_role === 'SUPERADMIN') {
            return true;
        }

        // Project owners/admins can invite
        return result.project_role === 'owner' || result.project_role === 'admin';
    }

    /**
     * Create an organization invitation
     */
    async createOrgInvitation(params: CreateOrgInvitationParams, requestInfo: RequestInfo = {}): Promise<{
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

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw new Error('Invalid email format');
        }

        // Check permission via AccessPolicyService
        const permissionCheck = await this.checkInvitePermission(organizationId, invitedByUserId);
        if (!permissionCheck.allowed) {
            const error = new Error(permissionCheck.reason || 'Cannot invite users');
            (error as Error & { reasonCode?: string }).reasonCode = permissionCheck.reasonCode;
            throw error;
        }

        // Check for existing pending invitation
        const existingInvite = await this.deps.db.get<{ id: string }>(
            `SELECT id FROM invitations 
             WHERE organization_id = ? AND email = ? AND status = 'pending'`,
            [organizationId, email.toLowerCase()]
        ) as { id: string } | null;

        if (existingInvite) {
            throw new Error('A pending invitation already exists for this email');
        }

        // Check if user is already a member
        const existingUser = await this.deps.db.get<{ id: string }>(
            `SELECT id FROM users WHERE email = ? AND organization_id = ?`,
            [email.toLowerCase(), organizationId]
        ) as { id: string } | null;

        if (existingUser) {
            throw new Error('User is already a member of this organization');
        }

        // Check seat limits and auto-add if needed
        try {
            const seatManagementService = await getSeatManagementService();
            const canAdd = await seatManagementService.canAddUser(organizationId);
            if (!canAdd) {
                const autoAddResult = await seatManagementService.autoAddSeatOnInvite(organizationId, invitedByUserId);
                if (!autoAddResult.autoAdded) {
                    const canAddAfterAuto = await seatManagementService.canAddUser(organizationId);
                    if (!canAddAfterAuto) {
                        throw new Error('No available seats. Please purchase additional seats or contact your administrator.');
                    }
                }
            }
        } catch (seatErr) {
            logger.warn('[InvitationService] Seat check failed:', seatErr as Error);
        }

        // Create invitation
        const id = this.deps.uuidv4();
        const token = this.generateSecureToken();
        const tokenHash = this.hashToken(token);
        const expiresAt = this.calculateExpiryDate();

        await this.deps.db.run(
            `INSERT INTO invitations 
             (id, organization_id, email, role, role_to_assign, token, token_hash, status, invited_by, expires_at, invitation_type, metadata) 
             VALUES (?, ?, ?, ?, ?, NULL, ?, 'pending', ?, ?, 'ORG', ?)`,
            [id, organizationId, email.toLowerCase(), role, role, tokenHash, invitedByUserId, expiresAt, JSON.stringify(metadata)]
        );

        // Log creation event
        await this.logEvent(id, INVITATION_EVENT_TYPES.CREATED, invitedByUserId, { role }, requestInfo);

        // Simulate email sending
        const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/join?token=${token}`;
        logger.info(`[EMAIL SERVICE] Sending ORG invitation to ${email}`);
        logger.info(`[EMAIL SERVICE] Link: ${inviteLink}`);

        // Log sent event
        await this.logEvent(id, INVITATION_EVENT_TYPES.SENT, invitedByUserId, { inviteLink }, requestInfo);

        // Record metrics event
        try {
            const metricsCollector = await getMetricsCollector();
            await metricsCollector.recordEvent(metricsCollector.EVENT_TYPES.INVITE_SENT, {
                userId: invitedByUserId,
                organizationId,
                source: metricsCollector.SOURCE_TYPES.INVITATION,
                context: { email: email.toLowerCase(), role, invitationType: INVITATION_TYPES.ORG }
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
            invitedByUserId
        };
    }

    /**
     * Create a project invitation
     */
    async createProjectInvitation(params: CreateProjectInvitationParams, requestInfo: RequestInfo = {}): Promise<{
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
        const { organizationId, projectId, email, projectRole = 'member', orgRole = 'USER', invitedByUserId, metadata = {} } = params;

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw new Error('Invalid email format');
        }

        // Verify project exists and belongs to org
        const project = await this.deps.db.get<{ id: string; name: string; organization_id: string }>(
            `SELECT id, name, organization_id FROM projects WHERE id = ? AND organization_id = ?`,
            [projectId, organizationId]
        ) as { id: string; name: string; organization_id: string } | null;

        if (!project) {
            throw new Error('Project not found in this organization');
        }

        // Check permission
        const permissionCheck = await this.checkInvitePermission(organizationId, invitedByUserId);
        if (!permissionCheck.allowed) {
            const error = new Error(permissionCheck.reason || 'Cannot invite users');
            (error as Error & { reasonCode?: string }).reasonCode = permissionCheck.reasonCode;
            throw error;
        }

        // Create invitation
        const id = this.deps.uuidv4();
        const token = this.generateSecureToken();
        const tokenHash = this.hashToken(token);
        const expiresAt = this.calculateExpiryDate();

        const invitationMetadata = {
            ...metadata,
            projectRole,
            projectName: project.name
        };

        await this.deps.db.run(
            `INSERT INTO invitations 
             (id, organization_id, project_id, email, role, role_to_assign, token, token_hash, status, invited_by, expires_at, invitation_type, metadata) 
             VALUES (?, ?, ?, ?, ?, ?, NULL, ?, 'pending', ?, ?, 'PROJECT', ?)`,
            [id, organizationId, projectId, email.toLowerCase(), orgRole, orgRole, tokenHash, invitedByUserId, expiresAt, JSON.stringify(invitationMetadata)]
        );

        // Log creation event
        await this.logEvent(id, INVITATION_EVENT_TYPES.CREATED, invitedByUserId, { projectRole, projectId }, requestInfo);

        // Simulate email sending
        const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/join?token=${token}`;
        logger.info(`[EMAIL SERVICE] Sending PROJECT invitation to ${email}`);
        logger.info(`[EMAIL SERVICE] Project: ${project.name}`);
        logger.info(`[EMAIL SERVICE] Link: ${inviteLink}`);

        // Log sent event
        await this.logEvent(id, INVITATION_EVENT_TYPES.SENT, invitedByUserId, { inviteLink }, requestInfo);

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
            invitedByUserId
        };
    }

    /**
     * Get invitation by token (for acceptance flow)
     */
    async getByToken(token: string): Promise<InvitationRecord | null> {
        const tokenHash = this.hashToken(token);

        const invitation = await this.deps.db.get<InvitationRecord>(
            `SELECT i.*, o.name as organization_name, p.name as project_name
             FROM invitations i
             LEFT JOIN organizations o ON i.organization_id = o.id
             LEFT JOIN projects p ON i.project_id = p.id
             WHERE i.token_hash = ?`,
            [tokenHash]
        ) as InvitationRecord | null;

        return invitation;
    }

    /**
     * Accept an invitation
     */
    async acceptInvitation(params: AcceptInvitationParams, requestInfo: RequestInfo = {}): Promise<{
        success: boolean;
        userId: string;
        isNewUser: boolean;
        organizationId: string;
        projectId?: string | null;
        role: string;
    }> {
        const { token, email, firstName, lastName, password } = params;

        // Get invitation
        const invitation = await this.getByToken(token);

        if (!invitation) {
            throw new Error('Invalid invitation token');
        }

        if (invitation.status !== INVITATION_STATUS.PENDING) {
            throw new Error(`Invitation is ${invitation.status}`);
        }

        // Check expiration
        if (new Date(invitation.expires_at) < new Date()) {
            await this.deps.db.run(
                `UPDATE invitations SET status = 'expired' WHERE id = ?`,
                [invitation.id]
            );
            await this.logEvent(invitation.id, INVITATION_EVENT_TYPES.EXPIRED, null, {}, requestInfo);
            throw new Error('Invitation has expired');
        }

        // Email binding validation
        if (email.toLowerCase() !== invitation.email.toLowerCase()) {
            throw new Error('Email address does not match invitation. Please use the email address the invitation was sent to.');
        }

        // Check if user already exists
        const existingUser = await this.deps.db.get<{ id: string; organization_id: string }>(
            `SELECT id, organization_id FROM users WHERE email = ?`,
            [email.toLowerCase()]
        ) as { id: string; organization_id: string } | null;

        let userId: string;
        let isNewUser = false;

        if (existingUser) {
            if (existingUser.organization_id === invitation.organization_id) {
                throw new Error('You are already a member of this organization');
            }
            throw new Error('User with this email already exists. Multi-organization support coming soon.');
        } else {
            // Create new user
            isNewUser = true;
            userId = this.deps.uuidv4();
            const hashedPassword = this.deps.bcrypt.hashSync(password, 10);

            await this.deps.db.run(
                `INSERT INTO users (id, organization_id, email, password, first_name, last_name, role, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
                [userId, invitation.organization_id, email.toLowerCase(), hashedPassword, firstName, lastName, invitation.role_to_assign || invitation.role]
            );
        }

        // If this is a project invitation, add user to project
        if (invitation.invitation_type === INVITATION_TYPES.PROJECT && invitation.project_id) {
            const metadata = JSON.parse(invitation.metadata || '{}') as { projectRole?: string };
            const projectRole = metadata.projectRole || 'member';

            await this.deps.db.run(
                `INSERT OR REPLACE INTO project_users (project_id, user_id, role, assigned_at)
                 VALUES (?, ?, ?, datetime('now'))`,
                [invitation.project_id, userId, projectRole]
            );
        }

        // Mark invitation as accepted (ATOMIC)
        const updateResult = await this.deps.db.run(
            `UPDATE invitations 
             SET status = 'accepted', accepted_at = datetime('now'), accepted_by_user_id = ?
             WHERE id = ? AND status = 'pending'`,
            [userId, invitation.id]
        );

        if (updateResult.changes === 0) {
            throw new Error('Invitation has already been accepted or is no longer valid');
        }

        // Update seat counter
        try {
            const accessPolicyService = await getAccessPolicyService();
            await accessPolicyService.incrementUsage(invitation.organization_id, 'users', 1);
        } catch (counterErr) {
            logger.warn('[InvitationService] Failed to increment seat counter:', counterErr as Error);
        }

        // Record attribution event
        try {
            const attributionService = await getAttributionService();
            const invitationMetadata = JSON.parse(invitation.metadata || '{}') as { attribution?: Record<string, unknown> };
            await attributionService.recordAttribution({
                organizationId: invitation.organization_id,
                userId: userId,
                sourceType: attributionService.SOURCE_TYPES.INVITATION,
                sourceId: invitation.id,
                campaign: invitationMetadata.attribution?.campaign as string | undefined,
                partnerCode: invitationMetadata.attribution?.partnerCode as string | undefined,
                medium: invitationMetadata.attribution?.medium as string | undefined,
                metadata: {
                    invitedBy: invitation.invited_by,
                    email: email,
                    role: invitation.role_to_assign || invitation.role,
                    invitationType: invitation.invitation_type,
                    projectId: invitation.project_id,
                    entryPoint: 'invitation_accept'
                }
            });
        } catch (attrErr) {
            logger.warn('[InvitationService] Attribution recording failed:', attrErr as Error);
        }

        // Log accepted event
        await this.logEvent(invitation.id, INVITATION_EVENT_TYPES.ACCEPTED, userId, {
            isNewUser,
            email_bound: true,
            token_validation: 'passed',
            orgId: invitation.organization_id,
            projectId: invitation.project_id,
            role_assigned: invitation.role_to_assign || invitation.role
        }, requestInfo);

        // Record metrics event
        try {
            const metricsCollector = await getMetricsCollector();
            await metricsCollector.recordEvent(metricsCollector.EVENT_TYPES.INVITE_ACCEPTED, {
                userId,
                organizationId: invitation.organization_id,
                source: metricsCollector.SOURCE_TYPES.INVITATION,
                context: {
                    isNewUser,
                    invitationType: invitation.invitation_type,
                    invitationId: invitation.id,
                    role: invitation.role_to_assign || invitation.role
                }
            });
        } catch (metricsErr) {
            logger.warn('[InvitationService] Metrics recording failed:', metricsErr as Error);
        }

        return {
            success: true,
            userId,
            isNewUser,
            organizationId: invitation.organization_id,
            projectId: invitation.project_id || undefined,
            role: invitation.role_to_assign || invitation.role
        };
    }

    /**
     * Resend an invitation
     */
    async resendInvitation(invitationId: string, performedByUserId: string, requestInfo: RequestInfo = {}): Promise<{
        id: string;
        email: string;
        token: string;
        expiresAt: string;
        status: InvitationStatus;
    }> {
        const invitation = await this.deps.db.get<InvitationRecord>(
            `SELECT * FROM invitations WHERE id = ?`,
            [invitationId]
        ) as InvitationRecord | null;

        if (!invitation) {
            throw new Error('Invitation not found');
        }

        if (invitation.status !== INVITATION_STATUS.PENDING && invitation.status !== INVITATION_STATUS.EXPIRED) {
            throw new Error(`Cannot resend ${invitation.status} invitation`);
        }

        // Check resend limits
        const resendCount = invitation.resend_count || 0;
        if (resendCount >= MAX_RESEND_COUNT) {
            throw new Error(`Maximum resend limit (${MAX_RESEND_COUNT}) reached. Please revoke and create a new invitation.`);
        }

        // Check cooldown
        if (invitation.last_resent_at) {
            const lastResent = new Date(invitation.last_resent_at);
            const cooldownEnd = new Date(lastResent.getTime() + RESEND_COOLDOWN_MINUTES * 60 * 1000);
            if (new Date() < cooldownEnd) {
                const waitMinutes = Math.ceil((cooldownEnd.getTime() - Date.now()) / 60000);
                throw new Error(`Please wait ${waitMinutes} minute(s) before resending.`);
            }
        }

        // Generate new token and expiry
        const newToken = this.generateSecureToken();
        const newTokenHash = this.hashToken(newToken);
        const newExpiresAt = this.calculateExpiryDate();

        const previousTokenHashShort = invitation.token_hash ? invitation.token_hash.substring(0, 16) : 'unknown';

        await this.deps.db.run(
            `UPDATE invitations 
             SET token_hash = ?, expires_at = ?, status = 'pending', 
                 resend_count = COALESCE(resend_count, 0) + 1,
                 last_resent_at = datetime('now')
             WHERE id = ?`,
            [newTokenHash, newExpiresAt, invitationId]
        );

        // Simulate email resend
        const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/join?token=${newToken}`;
        logger.info(`[EMAIL SERVICE] Resending invitation to ${invitation.email}`);
        logger.info(`[EMAIL SERVICE] New Link: ${inviteLink}`);

        // Log event
        await this.logEvent(invitationId, INVITATION_EVENT_TYPES.RESENT, performedByUserId, {
            newExpiresAt,
            resendCount: resendCount + 1,
            previousTokenHash: previousTokenHashShort
        }, requestInfo);

        return {
            id: invitationId,
            email: invitation.email,
            token: newToken,
            expiresAt: newExpiresAt,
            status: INVITATION_STATUS.PENDING
        };
    }

    /**
     * Revoke an invitation
     */
    async revokeInvitation(invitationId: string, performedByUserId: string, reason: string = '', requestInfo: RequestInfo = {}): Promise<{
        id: string;
        email: string;
        status: InvitationStatus;
    }> {
        const invitation = await this.deps.db.get<InvitationRecord>(
            `SELECT * FROM invitations WHERE id = ?`,
            [invitationId]
        ) as InvitationRecord | null;

        if (!invitation) {
            throw new Error('Invitation not found');
        }

        if (invitation.status !== INVITATION_STATUS.PENDING) {
            throw new Error(`Cannot revoke ${invitation.status} invitation`);
        }

        await this.deps.db.run(
            `UPDATE invitations SET status = 'revoked' WHERE id = ?`,
            [invitationId]
        );

        // Log event
        await this.logEvent(invitationId, INVITATION_EVENT_TYPES.REVOKED, performedByUserId, { reason }, requestInfo);

        return {
            id: invitationId,
            email: invitation.email,
            status: INVITATION_STATUS.REVOKED
        };
    }

    /**
     * List invitations for an organization
     */
    async listOrgInvitations(organizationId: string, options: ListInvitationsOptions = {}): Promise<InvitationRecord[]> {
        const { status, invitationType, limit = 50, offset = 0 } = options;

        let sql = `
            SELECT i.*, 
                   u.first_name as inviter_first_name, 
                   u.last_name as inviter_last_name,
                   p.name as project_name
            FROM invitations i
            LEFT JOIN users u ON i.invited_by = u.id
            LEFT JOIN projects p ON i.project_id = p.id
            WHERE i.organization_id = ?
        `;
        const params: unknown[] = [organizationId];

        if (status) {
            sql += ` AND i.status = ?`;
            params.push(status);
        }

        if (invitationType) {
            sql += ` AND i.invitation_type = ?`;
            params.push(invitationType);
        }

        sql += ` ORDER BY i.created_at DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const rows = await this.deps.db.all<InvitationRecord>(sql, params) as InvitationRecord[];
        return rows || [];
    }

    /**
     * List invitations for a project
     */
    async listProjectInvitations(projectId: string, options: ListInvitationsOptions = {}): Promise<InvitationRecord[]> {
        const { status, limit = 50, offset = 0 } = options;

        let sql = `
            SELECT i.*, 
                   u.first_name as inviter_first_name, 
                   u.last_name as inviter_last_name
            FROM invitations i
            LEFT JOIN users u ON i.invited_by = u.id
            WHERE i.project_id = ? AND i.invitation_type = 'PROJECT'
        `;
        const params: unknown[] = [projectId];

        if (status) {
            sql += ` AND i.status = ?`;
            params.push(status);
        }

        sql += ` ORDER BY i.created_at DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const rows = await this.deps.db.all<InvitationRecord>(sql, params) as InvitationRecord[];
        return rows || [];
    }

    /**
     * Get pending invitations for a user's email
     */
    async getPendingForEmail(email: string): Promise<InvitationRecord[]> {
        const rows = await this.deps.db.all<InvitationRecord>(
            `SELECT i.*, o.name as organization_name, p.name as project_name
             FROM invitations i
             LEFT JOIN organizations o ON i.organization_id = o.id
             LEFT JOIN projects p ON i.project_id = p.id
             WHERE i.email = ? AND i.status = 'pending' AND i.expires_at > datetime('now')
             ORDER BY i.created_at DESC`,
            [email.toLowerCase()]
        ) as InvitationRecord[];

        return rows || [];
    }

    /**
     * Get invitation audit trail
     */
    async getAuditTrail(invitationId: string): Promise<InvitationEventRecord[]> {
        const rows = await this.deps.db.all<InvitationEventRecord>(
            `SELECT ie.*, u.first_name, u.last_name, u.email
             FROM invitation_events ie
             LEFT JOIN users u ON ie.performed_by_user_id = u.id
             WHERE ie.invitation_id = ?
             ORDER BY ie.created_at ASC`,
            [invitationId]
        ) as InvitationEventRecord[];

        return rows || [];
    }

    // ==========================================
    // ALIAS METHODS for backward compatibility
    // ==========================================

    /**
     * Alias for listOrgInvitations (used by controllers)
     */
    async getInvitations(organizationId: string, options?: ListInvitationsOptions): Promise<InvitationRecord[]> {
        return this.listOrgInvitations(organizationId, options);
    }

    /**
     * Alias for createOrgInvitation (used by controllers)
     */
    async createInvitation(params: {
        email: string;
        role?: string;
        organizationId: string;
        invitedById: string;
        message?: string;
    }, requestInfo?: RequestInfo): Promise<ReturnType<typeof this.createOrgInvitation>> {
        return this.createOrgInvitation({
            organizationId: params.organizationId,
            email: params.email,
            role: params.role,
            invitedByUserId: params.invitedById,
            metadata: params.message ? { message: params.message } : {}
        }, requestInfo);
    }

    /**
     * Alias for revokeInvitation (used by controllers as cancelInvitation)
     */
    async cancelInvitation(invitationId: string, performedByUserId?: string, requestInfo?: RequestInfo): Promise<ReturnType<typeof this.revokeInvitation>> {
        return this.revokeInvitation(invitationId, performedByUserId || '', '', requestInfo);
    }
}

// Create singleton instance
const invitationServiceInstance = new InvitationServiceClass();

// Export constants
export { INVITATION_TYPES, INVITATION_STATUS, INVITATION_EVENT_TYPES };

// Export individual functions for backward compatibility
export const setDependencies = (newDeps: Partial<InvitationServiceDependencies>) => {
    invitationServiceInstance.setDependencies(newDeps);
};

export const generateSecureToken = () => invitationServiceInstance.generateSecureToken();
export const hashToken = (token: string) => invitationServiceInstance.hashToken(token);
export const calculateExpiryDate = (days?: number) => invitationServiceInstance.calculateExpiryDate(days);
export const logEvent = (invitationId: string, eventType: InvitationEventType | string, performedByUserId?: string | null, metadata?: Record<string, unknown>, requestInfo?: RequestInfo) =>
    invitationServiceInstance.logEvent(invitationId, eventType, performedByUserId || null, metadata || {}, requestInfo || {});
export const checkInvitePermission = (organizationId: string, requestingUserId: string) =>
    invitationServiceInstance.checkInvitePermission(organizationId, requestingUserId);
export const canInviteToOrg = (userId: string, organizationId: string) =>
    invitationServiceInstance.canInviteToOrg(userId, organizationId);
export const canInviteToProject = (userId: string, projectId: string) =>
    invitationServiceInstance.canInviteToProject(userId, projectId);
export const createOrgInvitation = (params: CreateOrgInvitationParams, requestInfo?: RequestInfo) =>
    invitationServiceInstance.createOrgInvitation(params, requestInfo);
export const createProjectInvitation = (params: CreateProjectInvitationParams, requestInfo?: RequestInfo) =>
    invitationServiceInstance.createProjectInvitation(params, requestInfo);
export const getByToken = (token: string) => invitationServiceInstance.getByToken(token);
export const acceptInvitation = (params: AcceptInvitationParams, requestInfo?: RequestInfo) =>
    invitationServiceInstance.acceptInvitation(params, requestInfo);
export const resendInvitation = (invitationId: string, performedByUserId: string, requestInfo?: RequestInfo) =>
    invitationServiceInstance.resendInvitation(invitationId, performedByUserId, requestInfo);
export const revokeInvitation = (invitationId: string, performedByUserId: string, reason?: string, requestInfo?: RequestInfo) =>
    invitationServiceInstance.revokeInvitation(invitationId, performedByUserId, reason, requestInfo);
export const listOrgInvitations = (organizationId: string, options?: ListInvitationsOptions) =>
    invitationServiceInstance.listOrgInvitations(organizationId, options);
export const listProjectInvitations = (projectId: string, options?: ListInvitationsOptions) =>
    invitationServiceInstance.listProjectInvitations(projectId, options);
export const getPendingForEmail = (email: string) => invitationServiceInstance.getPendingForEmail(email);
export const getAuditTrail = (invitationId: string) => invitationServiceInstance.getAuditTrail(invitationId);

// Alias exports for backward compatibility
export const getInvitations = (organizationId: string, options?: ListInvitationsOptions) =>
    invitationServiceInstance.getInvitations(organizationId, options);
export const createInvitation = (params: {
    email: string;
    role?: string;
    organizationId: string;
    invitedById: string;
    message?: string;
}, requestInfo?: RequestInfo) => invitationServiceInstance.createInvitation(params, requestInfo);
export const cancelInvitation = (invitationId: string, performedByUserId?: string, requestInfo?: RequestInfo) =>
    invitationServiceInstance.cancelInvitation(invitationId, performedByUserId, requestInfo);

// Default export for backward compatibility
const invitationService = {
    INVITATION_TYPES,
    INVITATION_STATUS,
    INVITATION_EVENT_TYPES,
    setDependencies,
    generateSecureToken,
    hashToken,
    calculateExpiryDate,
    logEvent,
    checkInvitePermission,
    canInviteToOrg,
    canInviteToProject,
    createOrgInvitation,
    createProjectInvitation,
    getByToken,
    acceptInvitation,
    resendInvitation,
    revokeInvitation,
    listOrgInvitations,
    listProjectInvitations,
    getPendingForEmail,
    getAuditTrail,
    // Aliases
    getInvitations,
    createInvitation,
    cancelInvitation
};

export default invitationService;
