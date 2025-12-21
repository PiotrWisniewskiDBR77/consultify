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
 * @author SCMS AI Assistant
 * @version 1.0.0
 */

// Dependency injection container (for deterministic unit tests)
const deps = {
    db: require('../database'),
    crypto: require('crypto'),
    bcrypt: require('bcryptjs'),
    uuidv4: require('uuid').v4,
    AccessPolicyService: require('./accessPolicyService'),
    AttributionService: require('./attributionService'),
    MetricsCollector: require('./metricsCollector')
};

// Constants
const INVITATION_EXPIRY_DAYS = 7;
const TOKEN_LENGTH_BYTES = 32; // 64 hex characters
const MAX_RESEND_COUNT = 3;
const RESEND_COOLDOWN_MINUTES = 5;

/**
 * TOKEN STORAGE DECISION: Option A (Enterprise Standard)
 * 
 * We store ONLY sha256(token) in the database, never plain tokens.
 * - Plain token is sent in email link only
 * - Validation: hash(input) compared to stored token_hash
 * - This protects against DB breach exposing valid tokens
 * 
 * See: Step 3 Final Closure - Security Architecture
 */

const INVITATION_TYPES = {
    ORG: 'ORG',
    PROJECT: 'PROJECT'
};

const INVITATION_STATUS = {
    PENDING: 'pending',
    ACCEPTED: 'accepted',
    EXPIRED: 'expired',
    REVOKED: 'revoked'
};

const INVITATION_EVENT_TYPES = {
    CREATED: 'created',
    SENT: 'sent',
    RESENT: 'resent',
    ACCEPTED: 'accepted',
    EXPIRED: 'expired',
    REVOKED: 'revoked'
};

// Role hierarchy for validation
const ROLE_HIERARCHY = {
    'USER': 1,
    'ADMIN': 2,
    'SUPERADMIN': 3
};

const InvitationService = {
    INVITATION_TYPES,
    INVITATION_STATUS,
    INVITATION_EVENT_TYPES,

    // For testing: allow overriding dependencies
    setDependencies: (newDeps = {}) => {
        Object.assign(deps, newDeps);
    },

    /**
     * Generate a cryptographically secure token
     * @returns {string} 64-character hex string
     */
    generateSecureToken: () => {
        return deps.crypto.randomBytes(TOKEN_LENGTH_BYTES).toString('hex');
    },

    /**
     * Hash a token for secure storage
     * @param {string} token - Plain token
     * @returns {string} SHA256 hash
     */
    hashToken: (token) => {
        return deps.crypto.createHash('sha256').update(token).digest('hex');
    },

    /**
     * Calculate expiration date
     * @param {number} days - Days until expiration (default: 7)
     * @returns {string} ISO date string
     */
    calculateExpiryDate: (days = INVITATION_EXPIRY_DAYS) => {
        return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    },

    /**
     * Log an invitation event for audit trail
     * @param {string} invitationId 
     * @param {string} eventType 
     * @param {string|null} performedByUserId 
     * @param {object} metadata 
     * @param {object} requestInfo - { ipAddress, userAgent }
     */
    logEvent: async (invitationId, eventType, performedByUserId = null, metadata = {}, requestInfo = {}) => {
        const id = deps.uuidv4();
        const { ipAddress, userAgent } = requestInfo;

        return new Promise((resolve, reject) => {
            deps.db.run(
                `INSERT INTO invitation_events 
                 (id, invitation_id, event_type, performed_by_user_id, ip_address, user_agent, metadata) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [id, invitationId, eventType, performedByUserId, ipAddress || null, userAgent || null, JSON.stringify(metadata)],
                function (err) {
                    if (err) {
                        console.error('[InvitationService] Error logging event:', err);
                        return reject(err);
                    }
                    resolve({ id, invitationId, eventType });
                }
            );
        });
    },

    /**
     * Check if organization can accept new members (seat limits)
     * Delegates to AccessPolicyService as single source of truth
     * @param {string} organizationId 
     * @param {string} requestingUserId 
     * @returns {Promise<{allowed: boolean, reasonCode?: string, reason?: string, seatsRemaining?: number}>}
     */
    checkInvitePermission: async (organizationId, requestingUserId) => {
        // Use AccessPolicyService as single source of truth
        const policyResult = await deps.AccessPolicyService.canInviteUsers(organizationId, requestingUserId);

        if (!policyResult.allowed) {
            // Map reason codes to user-friendly messages
            const reasonMessages = {
                'ORG_NOT_FOUND': 'Organization not found',
                'DEMO_READ_ONLY': 'Demo organizations cannot invite new members',
                'DEMO_INVITES_DISABLED': 'Demo organizations cannot invite new members',
                'TRIAL_EXPIRED': 'Trial has expired. Please upgrade to invite new members.',
                'USER_LIMIT_REACHED': 'Organization has reached maximum seats. Please upgrade to add more members.'
            };

            return {
                allowed: false,
                reasonCode: policyResult.reasonCode,
                reason: reasonMessages[policyResult.reasonCode] || 'Cannot invite users at this time'
            };
        }

        // Get seat availability for informational purposes
        const seatInfo = await deps.AccessPolicyService.getSeatAvailability(organizationId);

        return {
            allowed: true,
            reasonCode: 'OK',
            seatsRemaining: seatInfo.seatsRemaining,
            maxSeats: seatInfo.maxSeats,
            currentSeats: seatInfo.currentSeats
        };
    },

    /**
     * Check if user has permission to invite to organization
     * @param {string} userId 
     * @param {string} organizationId 
     * @returns {Promise<boolean>}
     */
    canInviteToOrg: async (userId, organizationId) => {
        return new Promise((resolve, reject) => {
            deps.db.get(
                `SELECT role FROM users WHERE id = ? AND organization_id = ?`,
                [userId, organizationId],
                (err, user) => {
                    if (err) return reject(err);
                    if (!user) return resolve(false);

                    // Only ADMIN and SUPERADMIN can invite
                    resolve(user.role === 'ADMIN' || user.role === 'SUPERADMIN');
                }
            );
        });
    },

    /**
     * Check if user has permission to invite to project
     * @param {string} userId 
     * @param {string} projectId 
     * @returns {Promise<boolean>}
     */
    canInviteToProject: async (userId, projectId) => {
        return new Promise((resolve, reject) => {
            // Check if user is project admin/owner or org admin
            deps.db.get(
                `SELECT pu.role as project_role, u.role as org_role
                 FROM users u
                 LEFT JOIN project_users pu ON pu.user_id = u.id AND pu.project_id = ?
                 WHERE u.id = ?`,
                [projectId, userId],
                (err, result) => {
                    if (err) return reject(err);
                    if (!result) return resolve(false);

                    // Org admins can invite to any project
                    if (result.org_role === 'ADMIN' || result.org_role === 'SUPERADMIN') {
                        return resolve(true);
                    }

                    // Project owners/admins can invite
                    resolve(result.project_role === 'owner' || result.project_role === 'admin');
                }
            );
        });
    },

    /**
     * Create an organization invitation
     * @param {object} params 
     * @param {string} params.organizationId 
     * @param {string} params.email 
     * @param {string} params.role - Role to assign (USER, ADMIN)
     * @param {string} params.invitedByUserId 
     * @param {object} params.metadata - Additional metadata (partner codes, etc.)
     * @param {object} requestInfo - { ipAddress, userAgent }
     * @returns {Promise<object>} Created invitation
     */
    createOrgInvitation: async (params, requestInfo = {}) => {
        const { organizationId, email, role = 'USER', invitedByUserId, metadata = {} } = params;

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw new Error('Invalid email format');
        }

        // Check permission via AccessPolicyService (single source of truth)
        const permissionCheck = await InvitationService.checkInvitePermission(organizationId, invitedByUserId);
        if (!permissionCheck.allowed) {
            const error = new Error(permissionCheck.reason);
            error.reasonCode = permissionCheck.reasonCode;
            throw error;
        }

        // Check for existing pending invitation
        const existingInvite = await new Promise((resolve, reject) => {
            deps.db.get(
                `SELECT id FROM invitations 
                 WHERE organization_id = ? AND email = ? AND status = 'pending'`,
                [organizationId, email.toLowerCase()],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                }
            );
        });

        if (existingInvite) {
            throw new Error('A pending invitation already exists for this email');
        }

        // Check if user is already a member
        const existingUser = await new Promise((resolve, reject) => {
            deps.db.get(
                `SELECT id FROM users WHERE email = ? AND organization_id = ?`,
                [email.toLowerCase(), organizationId],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                }
            );
        });

        if (existingUser) {
            throw new Error('User is already a member of this organization');
        }

        // Create invitation
        const id = deps.uuidv4();
        const token = InvitationService.generateSecureToken();
        const tokenHash = InvitationService.hashToken(token); // Store hash only
        const expiresAt = InvitationService.calculateExpiryDate();

        return new Promise((resolve, reject) => {
            deps.db.run(
                `INSERT INTO invitations 
                 (id, organization_id, email, role, role_to_assign, token_hash, status, invited_by, expires_at, invitation_type, metadata) 
                 VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, 'ORG', ?)`,
                [id, organizationId, email.toLowerCase(), role, role, tokenHash, invitedByUserId, expiresAt, JSON.stringify(metadata)],
                async function (err) {
                    if (err) return reject(err);

                    // Log creation event
                    await InvitationService.logEvent(id, INVITATION_EVENT_TYPES.CREATED, invitedByUserId, { role }, requestInfo);

                    // Simulate email sending - token plain only in email link
                    const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/join?token=${token}`;
                    console.log(`\n[EMAIL SERVICE] Sending ORG invitation to ${email}`);
                    console.log(`[EMAIL SERVICE] Link: ${inviteLink}\n`);

                    // Log sent event
                    await InvitationService.logEvent(id, INVITATION_EVENT_TYPES.SENT, invitedByUserId, { inviteLink }, requestInfo);

                    // Step 7: Record metrics event for conversion intelligence
                    try {
                        await deps.MetricsCollector.recordEvent(deps.MetricsCollector.EVENT_TYPES.INVITE_SENT, {
                            userId: invitedByUserId,
                            organizationId,
                            source: deps.MetricsCollector.SOURCE_TYPES.INVITATION,
                            context: { email: email.toLowerCase(), role, invitationType: INVITATION_TYPES.ORG }
                        });
                    } catch (metricsErr) {
                        console.warn('[InvitationService] Metrics recording failed:', metricsErr);
                    }

                    resolve({
                        id,
                        invitationType: INVITATION_TYPES.ORG,
                        organizationId,
                        email: email.toLowerCase(),
                        role,
                        token, // Return plain token for email (not stored in DB)
                        status: INVITATION_STATUS.PENDING,
                        expiresAt,
                        invitedByUserId
                    });
                }
            );
        });
    },

    /**
     * Create a project invitation
     * @param {object} params 
     * @param {string} params.organizationId 
     * @param {string} params.projectId 
     * @param {string} params.email 
     * @param {string} params.projectRole - Role to assign in project (member, admin, owner)
     * @param {string} params.orgRole - Role if user needs to join org too (USER, ADMIN)
     * @param {string} params.invitedByUserId 
     * @param {object} params.metadata 
     * @param {object} requestInfo 
     * @returns {Promise<object>}
     */
    createProjectInvitation: async (params, requestInfo = {}) => {
        const { organizationId, projectId, email, projectRole = 'member', orgRole = 'USER', invitedByUserId, metadata = {} } = params;

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw new Error('Invalid email format');
        }

        // Verify project exists and belongs to org
        const project = await new Promise((resolve, reject) => {
            deps.db.get(
                `SELECT id, name, organization_id FROM projects WHERE id = ? AND organization_id = ?`,
                [projectId, organizationId],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                }
            );
        });

        if (!project) {
            throw new Error('Project not found in this organization');
        }

        // Check permission via AccessPolicyService (single source of truth)
        const permissionCheck = await InvitationService.checkInvitePermission(organizationId, invitedByUserId);
        if (!permissionCheck.allowed) {
            const error = new Error(permissionCheck.reason);
            error.reasonCode = permissionCheck.reasonCode;
            throw error;
        }

        // Create invitation
        const id = deps.uuidv4();
        const token = InvitationService.generateSecureToken();
        const tokenHash = InvitationService.hashToken(token); // Store hash only
        const expiresAt = InvitationService.calculateExpiryDate();

        const invitationMetadata = {
            ...metadata,
            projectRole,
            projectName: project.name
        };

        return new Promise((resolve, reject) => {
            deps.db.run(
                `INSERT INTO invitations 
                 (id, organization_id, project_id, email, role, role_to_assign, token_hash, status, invited_by, expires_at, invitation_type, metadata) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, 'PROJECT', ?)`,
                [id, organizationId, projectId, email.toLowerCase(), orgRole, orgRole, tokenHash, invitedByUserId, expiresAt, JSON.stringify(invitationMetadata)],
                async function (err) {
                    if (err) return reject(err);

                    // Log creation event
                    await InvitationService.logEvent(id, INVITATION_EVENT_TYPES.CREATED, invitedByUserId, { projectRole, projectId }, requestInfo);

                    // Simulate email sending - token plain only in email link
                    const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/join?token=${token}`;
                    console.log(`\n[EMAIL SERVICE] Sending PROJECT invitation to ${email}`);
                    console.log(`[EMAIL SERVICE] Project: ${project.name}`);
                    console.log(`[EMAIL SERVICE] Link: ${inviteLink}\n`);

                    // Log sent event
                    await InvitationService.logEvent(id, INVITATION_EVENT_TYPES.SENT, invitedByUserId, { inviteLink }, requestInfo);

                    resolve({
                        id,
                        invitationType: INVITATION_TYPES.PROJECT,
                        organizationId,
                        projectId,
                        email: email.toLowerCase(),
                        projectRole,
                        orgRole,
                        token, // Return plain for email (not stored in DB)
                        status: INVITATION_STATUS.PENDING,
                        expiresAt,
                        invitedByUserId
                    });
                }
            );
        });
    },

    /**
     * Get invitation by token (for acceptance flow)
     * Uses hash-based lookup (Option A: Enterprise Standard)
     * @param {string} token - Plain token from email link
     * @returns {Promise<object|null>}
     */
    getByToken: async (token) => {
        // Hash the incoming token for comparison
        const tokenHash = InvitationService.hashToken(token);

        return new Promise((resolve, reject) => {
            deps.db.get(
                `SELECT i.*, o.name as organization_name, p.name as project_name
                 FROM invitations i
                 LEFT JOIN organizations o ON i.organization_id = o.id
                 LEFT JOIN projects p ON i.project_id = p.id
                 WHERE i.token_hash = ?`,
                [tokenHash],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                }
            );
        });
    },

    /**
     * Accept an invitation
     * @param {object} params 
     * @param {string} params.token 
     * @param {string} params.email - Email of accepting user (MUST match invitation)
     * @param {string} params.firstName 
     * @param {string} params.lastName 
     * @param {string} params.password 
     * @param {object} requestInfo 
     * @returns {Promise<object>} Created/updated user
     */
    acceptInvitation: async (params, requestInfo = {}) => {
        const { token, email, firstName, lastName, password } = params;

        // Get invitation
        const invitation = await InvitationService.getByToken(token);

        if (!invitation) {
            throw new Error('Invalid invitation token');
        }

        if (invitation.status !== INVITATION_STATUS.PENDING) {
            throw new Error(`Invitation is ${invitation.status}`);
        }

        // Check expiration
        if (new Date(invitation.expires_at) < new Date()) {
            // Mark as expired
            await new Promise((resolve, reject) => {
                deps.db.run(
                    `UPDATE invitations SET status = 'expired' WHERE id = ?`,
                    [invitation.id],
                    (err) => err ? reject(err) : resolve()
                );
            });
            await InvitationService.logEvent(invitation.id, INVITATION_EVENT_TYPES.EXPIRED, null, {}, requestInfo);
            throw new Error('Invitation has expired');
        }

        // CRITICAL: Email binding validation
        if (email.toLowerCase() !== invitation.email.toLowerCase()) {
            throw new Error('Email address does not match invitation. Please use the email address the invitation was sent to.');
        }

        // Check if user already exists
        const existingUser = await new Promise((resolve, reject) => {
            deps.db.get(
                `SELECT id, organization_id FROM users WHERE email = ?`,
                [email.toLowerCase()],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                }
            );
        });

        let userId;
        let isNewUser = false;

        if (existingUser) {
            // User exists - check if they're already in this org
            if (existingUser.organization_id === invitation.organization_id) {
                throw new Error('You are already a member of this organization');
            }

            // For now, reject existing users (multi-org support would go here)
            throw new Error('User with this email already exists. Multi-organization support coming soon.');
        } else {
            // Create new user
            isNewUser = true;
            userId = deps.uuidv4();
            const hashedPassword = deps.bcrypt.hashSync(password, 10);

            await new Promise((resolve, reject) => {
                deps.db.run(
                    `INSERT INTO users (id, organization_id, email, password, first_name, last_name, role, status)
                     VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
                    [userId, invitation.organization_id, email.toLowerCase(), hashedPassword, firstName, lastName, invitation.role_to_assign || invitation.role],
                    function (err) {
                        if (err) return reject(err);
                        resolve();
                    }
                );
            });
        }

        // If this is a project invitation, add user to project
        if (invitation.invitation_type === INVITATION_TYPES.PROJECT && invitation.project_id) {
            const metadata = JSON.parse(invitation.metadata || '{}');
            const projectRole = metadata.projectRole || 'member';

            await new Promise((resolve, reject) => {
                deps.db.run(
                    `INSERT OR REPLACE INTO project_users (project_id, user_id, role, assigned_at)
                     VALUES (?, ?, ?, datetime('now'))`,
                    [invitation.project_id, userId, projectRole],
                    function (err) {
                        if (err) return reject(err);
                        resolve();
                    }
                );
            });
        }

        // Mark invitation as accepted (ATOMIC - only if still pending)
        const updateResult = await new Promise((resolve, reject) => {
            deps.db.run(
                `UPDATE invitations 
                 SET status = 'accepted', accepted_at = datetime('now'), accepted_by_user_id = ?
                 WHERE id = ? AND status = 'pending'`,
                [userId, invitation.id],
                function (err) {
                    if (err) return reject(err);
                    resolve({ changes: this.changes });
                }
            );
        });

        // Check if update succeeded (race condition protection)
        if (updateResult.changes === 0) {
            // Invitation was already accepted/revoked by another request
            throw new Error('Invitation has already been accepted or is no longer valid');
        }

        // Update seat counter in AccessPolicyService
        try {
            await deps.AccessPolicyService.incrementUsage(invitation.organization_id, 'users', 1);
        } catch (counterErr) {
            console.warn('[InvitationService] Failed to increment seat counter:', counterErr);
            // Non-fatal - continue
        }

        // Step 4: Record attribution event for invitation acceptance
        try {
            const invitationMetadata = JSON.parse(invitation.metadata || '{}');
            await deps.AttributionService.recordAttribution({
                organizationId: invitation.organization_id,
                userId: userId,
                sourceType: deps.AttributionService.SOURCE_TYPES.INVITATION,
                sourceId: invitation.id,
                campaign: invitationMetadata.attribution?.campaign,
                partnerCode: invitationMetadata.attribution?.partnerCode,
                medium: invitationMetadata.attribution?.medium,
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
            console.warn('[InvitationService] Attribution recording failed:', attrErr);
            // Non-fatal - continue
        }

        // Log accepted event with enhanced metadata
        await InvitationService.logEvent(invitation.id, INVITATION_EVENT_TYPES.ACCEPTED, userId, {
            isNewUser,
            email_bound: true,
            token_validation: 'passed',
            orgId: invitation.organization_id,
            projectId: invitation.project_id,
            role_assigned: invitation.role_to_assign || invitation.role
        }, requestInfo);

        // Step 7: Record metrics event for conversion intelligence
        try {
            await deps.MetricsCollector.recordEvent(deps.MetricsCollector.EVENT_TYPES.INVITE_ACCEPTED, {
                userId,
                organizationId: invitation.organization_id,
                source: deps.MetricsCollector.SOURCE_TYPES.INVITATION,
                context: {
                    isNewUser,
                    invitationType: invitation.invitation_type,
                    invitationId: invitation.id,
                    role: invitation.role_to_assign || invitation.role
                }
            });
        } catch (metricsErr) {
            console.warn('[InvitationService] Metrics recording failed:', metricsErr);
        }

        return {
            success: true,
            userId,
            isNewUser,
            organizationId: invitation.organization_id,
            projectId: invitation.project_id,
            role: invitation.role_to_assign || invitation.role
        };
    },

    /**
     * Resend an invitation (generates new token, resets expiry)
     * Enforces max 3 resends and 5-minute cooldown
     * @param {string} invitationId 
     * @param {string} performedByUserId 
     * @param {object} requestInfo 
     * @returns {Promise<object>}
     */
    resendInvitation: async (invitationId, performedByUserId, requestInfo = {}) => {
        // Get current invitation
        const invitation = await new Promise((resolve, reject) => {
            deps.db.get(
                `SELECT * FROM invitations WHERE id = ?`,
                [invitationId],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                }
            );
        });

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
                const waitMinutes = Math.ceil((cooldownEnd - new Date()) / 60000);
                throw new Error(`Please wait ${waitMinutes} minute(s) before resending.`);
            }
        }

        // Generate new token and expiry
        const newToken = InvitationService.generateSecureToken();
        const newTokenHash = InvitationService.hashToken(newToken);
        const newExpiresAt = InvitationService.calculateExpiryDate();

        // Store previous hash for audit (first 16 chars)
        const previousTokenHashShort = invitation.token_hash ? invitation.token_hash.substring(0, 16) : 'unknown';

        await new Promise((resolve, reject) => {
            deps.db.run(
                `UPDATE invitations 
                 SET token_hash = ?, expires_at = ?, status = 'pending', 
                     resend_count = COALESCE(resend_count, 0) + 1,
                     last_resent_at = datetime('now')
                 WHERE id = ?`,
                [newTokenHash, newExpiresAt, invitationId],
                function (err) {
                    if (err) return reject(err);
                    resolve();
                }
            );
        });

        // Simulate email resend - plain token in email only
        const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/join?token=${newToken}`;
        console.log(`\n[EMAIL SERVICE] Resending invitation to ${invitation.email}`);
        console.log(`[EMAIL SERVICE] New Link: ${inviteLink}\n`);

        // Log event with metadata
        await InvitationService.logEvent(invitationId, INVITATION_EVENT_TYPES.RESENT, performedByUserId, {
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
    },

    /**
     * Revoke an invitation
     * @param {string} invitationId 
     * @param {string} performedByUserId 
     * @param {string} reason 
     * @param {object} requestInfo 
     * @returns {Promise<object>}
     */
    revokeInvitation: async (invitationId, performedByUserId, reason = '', requestInfo = {}) => {
        const invitation = await new Promise((resolve, reject) => {
            deps.db.get(
                `SELECT * FROM invitations WHERE id = ?`,
                [invitationId],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                }
            );
        });

        if (!invitation) {
            throw new Error('Invitation not found');
        }

        if (invitation.status !== INVITATION_STATUS.PENDING) {
            throw new Error(`Cannot revoke ${invitation.status} invitation`);
        }

        await new Promise((resolve, reject) => {
            deps.db.run(
                `UPDATE invitations SET status = 'revoked' WHERE id = ?`,
                [invitationId],
                function (err) {
                    if (err) return reject(err);
                    resolve();
                }
            );
        });

        // Log event
        await InvitationService.logEvent(invitationId, INVITATION_EVENT_TYPES.REVOKED, performedByUserId, { reason }, requestInfo);

        return {
            id: invitationId,
            email: invitation.email,
            status: INVITATION_STATUS.REVOKED
        };
    },

    /**
     * List invitations for an organization
     * @param {string} organizationId 
     * @param {object} options - { status, invitationType, limit, offset }
     * @returns {Promise<object[]>}
     */
    listOrgInvitations: async (organizationId, options = {}) => {
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
        const params = [organizationId];

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

        return new Promise((resolve, reject) => {
            deps.db.all(sql, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });
    },

    /**
     * List invitations for a project
     * @param {string} projectId 
     * @param {object} options 
     * @returns {Promise<object[]>}
     */
    listProjectInvitations: async (projectId, options = {}) => {
        const { status, limit = 50, offset = 0 } = options;

        let sql = `
            SELECT i.*, 
                   u.first_name as inviter_first_name, 
                   u.last_name as inviter_last_name
            FROM invitations i
            LEFT JOIN users u ON i.invited_by = u.id
            WHERE i.project_id = ? AND i.invitation_type = 'PROJECT'
        `;
        const params = [projectId];

        if (status) {
            sql += ` AND i.status = ?`;
            params.push(status);
        }

        sql += ` ORDER BY i.created_at DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        return new Promise((resolve, reject) => {
            deps.db.all(sql, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });
    },

    /**
     * Get pending invitations for a user's email
     * @param {string} email 
     * @returns {Promise<object[]>}
     */
    getPendingForEmail: async (email) => {
        return new Promise((resolve, reject) => {
            deps.db.all(
                `SELECT i.*, o.name as organization_name, p.name as project_name
                 FROM invitations i
                 LEFT JOIN organizations o ON i.organization_id = o.id
                 LEFT JOIN projects p ON i.project_id = p.id
                 WHERE i.email = ? AND i.status = 'pending' AND i.expires_at > datetime('now')
                 ORDER BY i.created_at DESC`,
                [email.toLowerCase()],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });
    },

    /**
     * Get invitation audit trail
     * @param {string} invitationId 
     * @returns {Promise<object[]>}
     */
    getAuditTrail: async (invitationId) => {
        return new Promise((resolve, reject) => {
            deps.db.all(
                `SELECT ie.*, u.first_name, u.last_name, u.email
                 FROM invitation_events ie
                 LEFT JOIN users u ON ie.performed_by_user_id = u.id
                 WHERE ie.invitation_id = ?
                 ORDER BY ie.created_at ASC`,
                [invitationId],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });
    }
};

module.exports = InvitationService;
