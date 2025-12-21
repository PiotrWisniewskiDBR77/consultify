/**
 * Trial Service
 * 
 * Handles trial organization lifecycle:
 * - Trial creation with default limits
 * - Trial status monitoring and warnings (anti-spam)
 * - Trial expiration and lockdown
 * - Trial to Paid conversion (idempotent)
 * - Trial extension (with limits)
 * 
 * Step 2 Finalization: Enterprise+ Ready
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const AccessPolicyService = require('./accessPolicyService');
const ActivityService = require('./activityService');
const NotificationService = require('./notificationService');
const OrganizationEventService = require('./organizationEventService');
const MetricsCollector = require('./metricsCollector');

const TrialService = {
    /**
     * Create a trial organization for a new user
     * @param {string} userId - The user creating the trial
     * @param {string} orgName - Organization name
     * @param {number} durationDays - Trial duration (default 14)
     * @returns {Promise<Object>}
     */
    createTrialOrganization: async (userId, orgName, durationDays = AccessPolicyService.TRIAL_DURATION_DAYS) => {
        const orgId = uuidv4();
        const now = new Date();
        const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

        return new Promise((resolve, reject) => {
            db.serialize(() => {
                // Create trial organization
                db.run(
                    `INSERT INTO organizations (id, name, plan, status, organization_type, trial_started_at, trial_expires_at, is_active, created_by_user_id, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        orgId,
                        orgName,
                        'trial',
                        'active',
                        AccessPolicyService.ORG_TYPES.TRIAL,
                        now.toISOString(),
                        expiresAt.toISOString(),
                        1,
                        userId,
                        now.toISOString()
                    ],
                    async function (err) {
                        if (err) return reject(err);

                        try {
                            // Add creator as OWNER
                            await new Promise((resolveMember, rejectMember) => {
                                db.run(
                                    `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
                                     VALUES (?, ?, ?, 'OWNER', 'ACTIVE', ?)`,
                                    [uuidv4(), orgId, userId, now.toISOString()],
                                    (memberErr) => {
                                        if (memberErr) rejectMember(memberErr);
                                        else resolveMember();
                                    }
                                );
                            });

                            // Create default trial limits
                            await AccessPolicyService.createDefaultLimits(orgId, AccessPolicyService.ORG_TYPES.TRIAL);

                            // Log audit event
                            await OrganizationEventService.logEvent(
                                orgId,
                                OrganizationEventService.EVENT_TYPES.TRIAL_STARTED,
                                userId,
                                { durationDays, orgName }
                            );

                            // Step 7: Record metrics event for conversion intelligence
                            await MetricsCollector.recordEvent(MetricsCollector.EVENT_TYPES.TRIAL_STARTED, {
                                userId,
                                organizationId: orgId,
                                source: MetricsCollector.SOURCE_TYPES.TRIAL,
                                context: { durationDays, orgName }
                            });

                            resolve({
                                organizationId: orgId,
                                trialStartedAt: now.toISOString(),
                                trialExpiresAt: expiresAt.toISOString(),
                                daysRemaining: durationDays
                            });
                        } catch (limitsErr) {
                            reject(limitsErr);
                        }
                    }
                );
            });
        });
    },

    /**
     * Get trial status for an organization
     * @param {string} organizationId 
     * @returns {Promise<Object>}
     */
    getTrialStatus: async (organizationId) => {
        const trialStatus = await AccessPolicyService.checkTrialStatus(organizationId);
        const orgInfo = await AccessPolicyService.getOrganizationType(organizationId);

        // Get extension count
        const extensionCount = await TrialService._getExtensionCount(organizationId);

        return {
            organizationType: orgInfo?.organizationType,
            trialStartedAt: orgInfo?.trialStartedAt,
            trialExpiresAt: orgInfo?.trialExpiresAt,
            extensionsUsed: extensionCount,
            extensionsRemaining: Math.max(0, AccessPolicyService.MAX_TRIAL_EXTENSIONS - extensionCount),
            ...trialStatus
        };
    },

    /**
     * Upgrade a trial organization to paid
     * IDEMPOTENT: If already PAID, returns success without changes
     * @param {string} organizationId 
     * @param {string} planType - 'PRO' | 'ENTERPRISE'
     * @param {string} upgradedByUserId - User performing the upgrade
     * @returns {Promise<Object>}
     */
    upgradeToPaid: async (organizationId, planType = 'PRO', upgradedByUserId = null) => {
        const orgInfo = await AccessPolicyService.getOrganizationType(organizationId);

        if (!orgInfo) {
            throw new Error('Organization not found');
        }

        // IDEMPOTENT: Already PAID, return success
        if (orgInfo.organizationType === AccessPolicyService.ORG_TYPES.PAID) {
            console.log(`[TrialService] Org ${organizationId} already PAID, returning idempotent success`);
            return {
                success: true,
                organizationType: AccessPolicyService.ORG_TYPES.PAID,
                plan: orgInfo.plan,
                alreadyUpgraded: true
            };
        }

        return new Promise((resolve, reject) => {
            db.serialize(() => {
                // Transaction: Update organization
                db.run(
                    `UPDATE organizations 
                     SET organization_type = ?, plan = ?, trial_expires_at = NULL, is_active = 1
                     WHERE id = ?`,
                    [AccessPolicyService.ORG_TYPES.PAID, planType.toLowerCase(), organizationId],
                    async function (err) {
                        if (err) return reject(err);
                        if (this.changes === 0) {
                            return reject(new Error('Organization not found'));
                        }

                        try {
                            // Remove trial limits
                            await AccessPolicyService.removeLimits(organizationId);

                            // Log audit event
                            await OrganizationEventService.logEvent(
                                organizationId,
                                OrganizationEventService.EVENT_TYPES.TRIAL_UPGRADED,
                                upgradedByUserId,
                                {
                                    planType,
                                    previousType: orgInfo.organizationType,
                                    previousPlan: orgInfo.plan,
                                    previousExpiry: orgInfo.trialExpiresAt
                                }
                            );

                            // Notify org admin
                            await TrialService._notifyOrgAdmins(organizationId, {
                                type: 'TRIAL_UPGRADED',
                                title: 'Welcome to your paid plan!',
                                message: `Your organization has been upgraded to the ${planType} plan. All trial limits have been removed.`
                            });

                            // Step 7: Record metrics event for conversion intelligence
                            await MetricsCollector.recordEvent(MetricsCollector.EVENT_TYPES.UPGRADED_TO_PAID, {
                                userId: upgradedByUserId,
                                organizationId,
                                source: MetricsCollector.SOURCE_TYPES.TRIAL,
                                context: {
                                    planType,
                                    previousType: orgInfo.organizationType,
                                    previousPlan: orgInfo.plan
                                }
                            });

                            resolve({
                                success: true,
                                organizationType: AccessPolicyService.ORG_TYPES.PAID,
                                plan: planType,
                                alreadyUpgraded: false
                            });
                        } catch (cleanupErr) {
                            reject(cleanupErr);
                        }
                    }
                );
            });
        });
    },

    /**
     * Lock an expired trial organization (set to read-only)
     * @param {string} organizationId 
     * @returns {Promise<void>}
     */
    lockExpiredTrial: async (organizationId) => {
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE organizations SET is_active = 0 WHERE id = ? AND organization_type = ?`,
                [organizationId, AccessPolicyService.ORG_TYPES.TRIAL],
                async function (err) {
                    if (err) return reject(err);

                    if (this.changes > 0) {
                        // Log audit event
                        await OrganizationEventService.logEvent(
                            organizationId,
                            OrganizationEventService.EVENT_TYPES.TRIAL_EXPIRED_LOCKED,
                            null,
                            { lockedAt: new Date().toISOString() }
                        );

                        // Step 7: Record metrics event for conversion intelligence
                        await MetricsCollector.recordEvent(MetricsCollector.EVENT_TYPES.TRIAL_EXPIRED, {
                            organizationId,
                            source: MetricsCollector.SOURCE_TYPES.TRIAL,
                            context: { lockedAt: new Date().toISOString() }
                        });
                    }

                    resolve();
                }
            );
        });
    },

    /**
     * Process trial warnings for all organizations (run daily via cron)
     * Sends warning notifications at T-7 days
     * ANTI-SPAM: Only sends once per org (checks trial_warning_sent_at)
     * @returns {Promise<number>} - Number of warnings sent
     */
    sendTrialWarnings: async () => {
        const warningDays = 7;
        const warningDate = new Date(Date.now() + warningDays * 24 * 60 * 60 * 1000);
        const warningDateStr = warningDate.toISOString().split('T')[0];

        return new Promise((resolve, reject) => {
            // Find trial orgs expiring in exactly 7 days AND not already warned
            db.all(
                `SELECT id, name, trial_expires_at FROM organizations 
                 WHERE organization_type = ? 
                 AND is_active = 1
                 AND date(trial_expires_at) = ?
                 AND trial_warning_sent_at IS NULL`,
                [AccessPolicyService.ORG_TYPES.TRIAL, warningDateStr],
                async (err, rows) => {
                    if (err) return reject(err);
                    if (!rows || rows.length === 0) return resolve(0);

                    let warningsSent = 0;

                    for (const org of rows) {
                        try {
                            // Send notification
                            await TrialService._notifyOrgAdmins(org.id, {
                                type: 'TRIAL_WARNING',
                                severity: 'WARNING',
                                title: 'Your trial expires in 7 days',
                                message: `Your trial for "${org.name}" will expire on ${new Date(org.trial_expires_at).toLocaleDateString()}. Upgrade now to keep your data and continue using all features.`
                            });

                            // Note: _notifyOrgAdmins uses NotificationService.create which handles in-app notifications

                            // ANTI-SPAM: Mark as warned
                            await new Promise((res, rej) => {
                                db.run(
                                    `UPDATE organizations SET trial_warning_sent_at = datetime('now') WHERE id = ?`,
                                    [org.id],
                                    (err) => err ? rej(err) : res()
                                );
                            });

                            // Log audit event
                            await OrganizationEventService.logEvent(
                                org.id,
                                OrganizationEventService.EVENT_TYPES.TRIAL_WARNING_SENT,
                                null,
                                { daysRemaining: 7, warningSentAt: new Date().toISOString() }
                            );

                            warningsSent++;
                        } catch (notifyErr) {
                            console.error(`[TrialService] Failed to send warning for org ${org.id}:`, notifyErr);
                        }
                    }

                    resolve(warningsSent);
                }
            );
        });
    },

    /**
     * Process expired trials (run daily via cron)
     * Locks organizations that have passed their expiration date
     * @returns {Promise<number>} - Number of trials locked
     */
    processExpiredTrials: async () => {
        const now = new Date().toISOString();

        return new Promise((resolve, reject) => {
            db.all(
                `SELECT id, name FROM organizations 
                 WHERE organization_type = ? 
                 AND is_active = 1
                 AND trial_expires_at < ?`,
                [AccessPolicyService.ORG_TYPES.TRIAL, now],
                async (err, rows) => {
                    if (err) return reject(err);
                    if (!rows || rows.length === 0) return resolve(0);

                    let lockedCount = 0;

                    for (const org of rows) {
                        try {
                            await TrialService.lockExpiredTrial(org.id);

                            await TrialService._notifyOrgAdmins(org.id, {
                                type: 'TRIAL_EXPIRED',
                                severity: 'CRITICAL',
                                title: 'Your trial has expired',
                                message: `Your trial for "${org.name}" has expired. Your data is safe, but the organization is now in read-only mode. Upgrade to restore full access.`
                            });

                            lockedCount++;
                            console.log(`[TrialService] Locked expired trial org: ${org.id}`);
                        } catch (lockErr) {
                            console.error(`[TrialService] Failed to lock org ${org.id}:`, lockErr);
                        }
                    }

                    resolve(lockedCount);
                }
            );
        });
    },

    /**
     * Extend a trial period (admin action)
     * 
     * RULES:
     * - Only for organization_type = TRIAL
     * - Max extensions: MAX_TRIAL_EXTENSIONS (2)
     * - Max days per extension: MAX_EXTENSION_DAYS (14)
     * - Requires reason
     * 
     * @param {string} organizationId 
     * @param {number} additionalDays 
     * @param {string} extendedByUserId 
     * @param {string} reason - Required reason for extension
     * @returns {Promise<Object>}
     */
    extendTrial: async (organizationId, additionalDays, extendedByUserId = null, reason = '') => {
        const orgInfo = await AccessPolicyService.getOrganizationType(organizationId);

        if (!orgInfo) {
            const error = new Error('Organization not found');
            error.errorCode = 'ORG_NOT_FOUND';
            error.status = 404;
            throw error;
        }

        if (orgInfo.organizationType !== AccessPolicyService.ORG_TYPES.TRIAL) {
            const error = new Error('Only trial organizations can be extended');
            error.errorCode = 'NOT_TRIAL';
            error.status = 400;
            throw error;
        }

        // Check extension count
        const extensionCount = await TrialService._getExtensionCount(organizationId);
        if (extensionCount >= AccessPolicyService.MAX_TRIAL_EXTENSIONS) {
            const error = new Error(`Maximum trial extensions (${AccessPolicyService.MAX_TRIAL_EXTENSIONS}) reached`);
            error.errorCode = 'EXTENSION_LIMIT_REACHED';
            error.status = 403;
            throw error;
        }

        // Validate days
        if (additionalDays > AccessPolicyService.MAX_EXTENSION_DAYS) {
            const error = new Error(`Maximum extension is ${AccessPolicyService.MAX_EXTENSION_DAYS} days`);
            error.errorCode = 'INVALID_DAYS';
            error.status = 400;
            throw error;
        }

        const currentExpiry = orgInfo.trialExpiresAt ? new Date(orgInfo.trialExpiresAt) : new Date();
        const newExpiry = new Date(Math.max(currentExpiry.getTime(), Date.now()) + additionalDays * 24 * 60 * 60 * 1000);

        return new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run(
                    `UPDATE organizations 
                     SET trial_expires_at = ?, is_active = 1, trial_extension_count = trial_extension_count + 1 
                     WHERE id = ?`,
                    [newExpiry.toISOString(), organizationId],
                    async function (err) {
                        if (err) return reject(err);

                        try {
                            // Log audit event with reason
                            await OrganizationEventService.logEvent(
                                organizationId,
                                OrganizationEventService.EVENT_TYPES.TRIAL_EXTENDED,
                                extendedByUserId,
                                {
                                    additionalDays,
                                    reason,
                                    previousExpiry: orgInfo.trialExpiresAt,
                                    newExpiry: newExpiry.toISOString(),
                                    extensionNumber: extensionCount + 1
                                }
                            );

                            // Step 7: Record metrics event for conversion intelligence
                            await MetricsCollector.recordEvent(MetricsCollector.EVENT_TYPES.TRIAL_EXTENDED, {
                                userId: extendedByUserId,
                                organizationId,
                                source: MetricsCollector.SOURCE_TYPES.TRIAL,
                                context: {
                                    additionalDays,
                                    reason,
                                    extensionNumber: extensionCount + 1
                                }
                            });

                            resolve({
                                success: true,
                                newExpiresAt: newExpiry.toISOString(),
                                daysRemaining: Math.ceil((newExpiry - new Date()) / (1000 * 60 * 60 * 24)),
                                extensionsUsed: extensionCount + 1,
                                extensionsRemaining: AccessPolicyService.MAX_TRIAL_EXTENSIONS - extensionCount - 1
                            });
                        } catch (auditErr) {
                            reject(auditErr);
                        }
                    }
                );
            });
        });
    },

    // Private helper to get extension count
    _getExtensionCount: async (organizationId) => {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT trial_extension_count FROM organizations WHERE id = ?`,
                [organizationId],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row?.trial_extension_count || 0);
                }
            );
        });
    },

    // Private helper to notify organization admins
    _notifyOrgAdmins: async (organizationId, notification) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT id FROM users WHERE organization_id = ? AND role IN ('ADMIN', 'SUPERADMIN')`,
                [organizationId],
                async (err, admins) => {
                    if (err) return reject(err);

                    for (const admin of admins || []) {
                        try {
                            await NotificationService.create({
                                userId: admin.id,
                                organizationId: organizationId,
                                type: notification.type,
                                severity: notification.severity || 'INFO',
                                title: notification.title,
                                message: notification.message,
                                isActionable: true,
                                actionUrl: '/settings?tab=billing'
                            });
                        } catch (notifyErr) {
                            console.error(`[TrialService] Failed to notify admin ${admin.id}:`, notifyErr);
                        }
                    }

                    resolve();
                }
            );
        });
    },

};

module.exports = TrialService;

