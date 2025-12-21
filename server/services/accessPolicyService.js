/**
 * Access Policy Service
 * 
 * Central enforcement layer for Demo/Trial/Paid access restrictions.
 * All resource limits and feature gates are checked through this service.
 * 
 * Error Codes:
 * - TRIAL_EXPIRED: Trial period has ended
 * - AI_LIMIT_REACHED: Daily AI call limit exceeded
 * - PROJECT_LIMIT_REACHED: Max projects for tier exceeded
 * - USER_LIMIT_REACHED: Max users for tier exceeded
 * - INITIATIVE_LIMIT_REACHED: Max initiatives for tier exceeded
 * - FEATURE_NOT_AVAILABLE_IN_TRIAL: Feature not available in current plan
 * - DEMO_READ_ONLY: Demo mode is read-only
 */

// Dependency injection container (for deterministic unit tests)
const deps = {
    db: require('../database'),
    uuidv4: require('uuid').v4
};

// Organization types
const ORG_TYPES = {
    DEMO: 'DEMO',
    TRIAL: 'TRIAL',
    PAID: 'PAID'
};

// Default limits for Trial organizations
const DEFAULT_TRIAL_LIMITS = {
    max_projects: 3,
    max_users: 4, // Owner + 3 invites
    max_ai_calls_per_day: 50, // Soft limit, hard limit is token budget
    max_initiatives: 5,
    max_storage_mb: 100,
    max_total_tokens: 100000,
    ai_roles_enabled_json: '["ADVISOR"]'
};

// Default limits for Demo organizations (more restrictive)
const DEFAULT_DEMO_LIMITS = {
    max_projects: 1,
    max_users: 1,
    max_ai_calls_per_day: 10,
    max_initiatives: 5,
    max_storage_mb: 10,
    ai_roles_enabled_json: '["ADVISOR"]'
};

// Trial duration in days
const TRIAL_DURATION_DAYS = 14;

const AccessPolicyService = {
    // For testing: allow overriding dependencies
    setDependencies: (newDeps = {}) => {
        Object.assign(deps, newDeps);
    },

    /**
     * Get organization type and basic info
     * @param {string} organizationId 
     * @returns {Promise<Object>}
     */
    getOrganizationType: async (organizationId) => {
        return new Promise((resolve, reject) => {
            deps.db.get(
                `SELECT id, name, organization_type, trial_started_at, trial_expires_at, is_active, plan, status 
                 FROM organizations WHERE id = ?`,
                [organizationId],
                (err, row) => {
                    if (err) return reject(err);
                    if (!row) return resolve(null);
                    resolve({
                        id: row.id,
                        name: row.name,
                        organizationType: row.organization_type || ORG_TYPES.TRIAL,
                        trialStartedAt: row.trial_started_at,
                        trialExpiresAt: row.trial_expires_at,
                        isActive: row.is_active === 1,
                        plan: row.plan,
                        status: row.status
                    });
                }
            );
        });
    },

    /**
     * Get organization limits
     * @param {string} organizationId 
     * @returns {Promise<Object>}
     */
    getOrganizationLimits: async (organizationId) => {
        return new Promise((resolve, reject) => {
            deps.db.get(
                `SELECT * FROM organization_limits WHERE organization_id = ?`,
                [organizationId],
                async (err, row) => {
                    if (err) return reject(err);

                    if (!row) {
                        // Get org type to determine default limits
                        const orgInfo = await AccessPolicyService.getOrganizationType(organizationId);
                        if (!orgInfo) return resolve(null);

                        const defaults = orgInfo.organizationType === ORG_TYPES.DEMO
                            ? DEFAULT_DEMO_LIMITS
                            : DEFAULT_TRIAL_LIMITS;

                        return resolve({
                            organizationId,
                            maxProjects: defaults.max_projects,
                            maxUsers: defaults.max_users,
                            maxAICallsPerDay: defaults.max_ai_calls_per_day,
                            maxInitiatives: defaults.max_initiatives,
                            maxStorageMb: defaults.max_storage_mb,
                            maxTotalTokens: defaults.max_total_tokens,
                            aiRolesEnabled: JSON.parse(defaults.ai_roles_enabled_json)
                        });
                    }

                    resolve({
                        id: row.id,
                        organizationId: row.organization_id,
                        maxProjects: row.max_projects,
                        maxUsers: row.max_users,
                        maxAICallsPerDay: row.max_ai_calls_per_day,
                        maxInitiatives: row.max_initiatives,
                        maxStorageMb: row.max_storage_mb,
                        maxTotalTokens: row.max_total_tokens || DEFAULT_TRIAL_LIMITS.max_total_tokens,
                        aiRolesEnabled: JSON.parse(row.ai_roles_enabled_json || '["ADVISOR"]')
                    });
                }
            );
        });
    },

    /**
     * Check if trial is expired
     * @param {string} organizationId 
     * @returns {Promise<{expired: boolean, daysRemaining: number, warningLevel: string}>}
     */
    checkTrialStatus: async (organizationId) => {
        const orgInfo = await AccessPolicyService.getOrganizationType(organizationId);

        if (!orgInfo) {
            return { expired: true, daysRemaining: 0, warningLevel: 'none' };
        }

        // PAID orgs never expire
        if (orgInfo.organizationType === ORG_TYPES.PAID) {
            return { expired: false, daysRemaining: -1, warningLevel: 'none' };
        }

        // DEMO orgs expire after 24 hours
        if (orgInfo.organizationType === ORG_TYPES.DEMO) {
            if (!orgInfo.trialStartedAt) {
                return { expired: false, daysRemaining: 1, warningLevel: 'none' };
            }
            const startDate = new Date(orgInfo.trialStartedAt);
            const now = new Date();
            const hoursElapsed = (now - startDate) / (1000 * 60 * 60);
            const expired = hoursElapsed >= 24;
            return {
                expired,
                daysRemaining: expired ? 0 : 1,
                warningLevel: 'none'
            };
        }

        // TRIAL orgs check trial_expires_at
        if (!orgInfo.trialExpiresAt) {
            return { expired: false, daysRemaining: TRIAL_DURATION_DAYS, warningLevel: 'none' };
        }

        const expiresAt = new Date(orgInfo.trialExpiresAt);
        const now = new Date();
        const daysRemaining = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));

        let warningLevel = 'none';
        if (daysRemaining <= 0) {
            warningLevel = 'expired';
        } else if (daysRemaining <= 3) {
            warningLevel = 'critical';
        } else if (daysRemaining <= 7) {
            warningLevel = 'warning';
        }

        return {
            expired: daysRemaining <= 0,
            daysRemaining: Math.max(0, daysRemaining),
            warningLevel
        };
    },

    /**
     * Get today's usage counters for an organization
     * @param {string} organizationId 
     * @returns {Promise<Object>}
     */
    getDailyUsage: async (organizationId) => {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        return new Promise((resolve, reject) => {
            deps.db.get(
                `SELECT * FROM usage_counters WHERE organization_id = ? AND counter_date = ?`,
                [organizationId, today],
                (err, row) => {
                    if (err) return reject(err);

                    if (!row) {
                        return resolve({
                            organizationId,
                            counterDate: today,
                            aiCallsCount: 0,
                            projectsCount: 0,
                            usersCount: 0,
                            initiativesCount: 0,
                            storageUsedMb: 0
                        });
                    }

                    resolve({
                        id: row.id,
                        organizationId: row.organization_id,
                        counterDate: row.counter_date,
                        aiCallsCount: row.ai_calls_count,
                        projectsCount: row.projects_count,
                        usersCount: row.users_count,
                        initiativesCount: row.initiatives_count,
                        storageUsedMb: row.storage_used_mb
                    });
                }
            );
        });
    },

    /**
     * Increment a usage counter
     * @param {string} organizationId 
     * @param {string} counterType - 'ai_calls' | 'projects' | 'users' | 'initiatives' | 'storage'
     * @param {number} amount - Amount to increment (default 1)
     * @returns {Promise<void>}
     */
    incrementUsage: async (organizationId, counterType, amount = 1) => {
        const today = new Date().toISOString().split('T')[0];
        const columnMap = {
            'ai_calls': 'ai_calls_count',
            'projects': 'projects_count',
            'users': 'users_count',
            'initiatives': 'initiatives_count',
            'storage': 'storage_used_mb'
        };

        const column = columnMap[counterType];
        if (!column) throw new Error(`Invalid counter type: ${counterType}`);

        return new Promise((resolve, reject) => {
            // Upsert pattern for SQLite
            deps.db.run(
                `INSERT INTO usage_counters (id, organization_id, counter_date, ${column})
                 VALUES (?, ?, ?, ?)
                 ON CONFLICT(organization_id, counter_date) 
                 DO UPDATE SET ${column} = ${column} + ?`,
                [uuidv4(), organizationId, today, amount, amount],
                (err) => {
                    if (err) return reject(err);
                    resolve();
                }
            );
        });
    },

    /**
     * Track token usage for trial budget
     * @param {string} organizationId
     * @param {number} tokens
     * @returns {Promise<void>}
     */
    trackTokenUsage: async (organizationId, tokens) => {
        return new Promise((resolve, reject) => {
            deps.db.run(
                `UPDATE organizations SET trial_tokens_used = COALESCE(trial_tokens_used, 0) + ? WHERE id = ?`,
                [tokens, organizationId],
                (err) => {
                    if (err) return reject(err);
                    resolve();
                }
            );
        });
    },

    /**
     * Get trial usage stats
     * @param {string} organizationId
     * @returns {Promise<{tokensUsed: number}>}
     */
    getTrialUsage: async (organizationId) => {
        return new Promise((resolve, reject) => {
            deps.db.get(
                `SELECT trial_tokens_used FROM organizations WHERE id = ?`,
                [organizationId],
                (err, row) => {
                    if (err) return reject(err);
                    resolve({ tokensUsed: row?.trial_tokens_used || 0 });
                }
            );
        });
    },

    /**
     * Check if an action is allowed based on organization type and limits
     * @param {string} organizationId 
     * @param {string} action - 'create_project' | 'create_initiative' | 'invite_user' | 'ai_call' | 'upload' | 'write'
     * @returns {Promise<{allowed: boolean, reason?: string, errorCode?: string}>}
     */
    checkAccess: async (organizationId, action) => {
        try {
            // Get org info and trial status
            const [orgInfo, trialStatus, limits, usage, trialUsage] = await Promise.all([
                AccessPolicyService.getOrganizationType(organizationId),
                AccessPolicyService.checkTrialStatus(organizationId),
                AccessPolicyService.getOrganizationLimits(organizationId),
                AccessPolicyService.getDailyUsage(organizationId),
                AccessPolicyService.getTrialUsage(organizationId)
            ]);

            if (!orgInfo) {
                return { allowed: false, reason: 'Organization not found', errorCode: 'ORG_NOT_FOUND' };
            }

            // Check if org is active
            if (!orgInfo.isActive) {
                return { allowed: false, reason: 'Organization is inactive', errorCode: 'ORG_INACTIVE' };
            }

            // Check trial expiration (blocks all write actions)
            if (trialStatus.expired && orgInfo.organizationType !== ORG_TYPES.PAID) {
                return {
                    allowed: false,
                    reason: 'Trial period has expired. Please upgrade to continue.',
                    errorCode: 'TRIAL_EXPIRED'
                };
            }

            // DEMO mode is read-only for all write actions
            if (orgInfo.organizationType === ORG_TYPES.DEMO) {
                const writeActions = ['create_project', 'create_initiative', 'invite_user', 'upload', 'write'];
                if (writeActions.includes(action)) {
                    return {
                        allowed: false,
                        reason: 'Demo mode is read-only. Start a free trial to create your own data.',
                        errorCode: 'DEMO_READ_ONLY'
                    };
                }
            }

            // PAID orgs have no limits
            if (orgInfo.organizationType === ORG_TYPES.PAID) {
                return { allowed: true };
            }

            // Check specific limits for TRIAL orgs
            if (!limits) {
                return { allowed: true }; // No limits configured, allow
            }

            switch (action) {
                case 'create_project':
                    // Count current projects
                    const projectCount = await AccessPolicyService._countOrgProjects(organizationId);
                    if (projectCount >= limits.maxProjects) {
                        return {
                            allowed: false,
                            reason: `Project limit reached (${limits.maxProjects}). Upgrade to create more projects.`,
                            errorCode: 'PROJECT_LIMIT_REACHED'
                        };
                    }
                    break;

                case 'create_initiative':
                    const initiativeCount = await AccessPolicyService._countOrgInitiatives(organizationId);
                    if (initiativeCount >= limits.maxInitiatives) {
                        return {
                            allowed: false,
                            reason: `Initiative limit reached (${limits.maxInitiatives}). Upgrade to create more initiatives.`,
                            errorCode: 'INITIATIVE_LIMIT_REACHED'
                        };
                    }
                    break;

                case 'invite_user':
                    const userCount = await AccessPolicyService._countOrgUsers(organizationId);
                    if (userCount >= limits.maxUsers) {
                        return {
                            allowed: false,
                            reason: `User limit reached (${limits.maxUsers}). Upgrade to invite more users.`,
                            errorCode: 'USER_LIMIT_REACHED'
                        };
                    }
                    break;

                case 'ai_call':
                    // Check daily limit (soft limiter for velocity)
                    if (usage.aiCallsCount >= limits.maxAICallsPerDay) {
                        return {
                            allowed: false,
                            reason: `Daily AI call limit reached (${limits.maxAICallsPerDay}). Upgrade for unlimited AI access.`,
                            errorCode: 'AI_LIMIT_REACHED'
                        };
                    }
                    // Check Total Token Budget (Hard Limit for Phase C)
                    if (limits.maxTotalTokens && trialUsage.tokensUsed >= limits.maxTotalTokens) {
                        return {
                            allowed: false,
                            reason: `Trial AI token budget exceeded (${limits.maxTotalTokens}). Upgrade to continue using AI features.`,
                            errorCode: 'AI_TOKEN_BUDGET_EXCEEDED'
                        };
                    }
                    break;

                case 'upload':
                    if (usage.storageUsedMb >= limits.maxStorageMb) {
                        return {
                            allowed: false,
                            reason: `Storage limit reached (${limits.maxStorageMb}MB). Upgrade for more storage.`,
                            errorCode: 'STORAGE_LIMIT_REACHED'
                        };
                    }
                    break;
            }

            return { allowed: true };

        } catch (error) {
            console.error('[AccessPolicyService] Error checking access:', error);
            // Fail open for system errors to avoid blocking legitimate users
            return { allowed: true };
        }
    },

    /**
     * Check if an AI role is allowed for the organization
     * @param {string} organizationId 
     * @param {string} aiRole - The AI role to check (ADVISOR, MANAGER, OPERATOR)
     * @returns {Promise<{allowed: boolean, reason?: string}>}
     */
    isAIRoleAllowed: async (organizationId, aiRole) => {
        const limits = await AccessPolicyService.getOrganizationLimits(organizationId);

        if (!limits || !limits.aiRolesEnabled) {
            // Default to ADVISOR only
            return {
                allowed: aiRole === 'ADVISOR',
                reason: aiRole !== 'ADVISOR' ? 'Only ADVISOR role is available in trial mode.' : undefined
            };
        }

        const allowed = limits.aiRolesEnabled.includes(aiRole);
        return {
            allowed,
            reason: allowed ? undefined : `${aiRole} role is not available in your current plan. Upgrade to unlock additional AI capabilities.`
        };
    },

    /**
     * Get access context for AI operations
     * Returns all information needed by AI orchestrator
     * @param {string} organizationId 
     * @returns {Promise<Object>}
     */
    getAIAccessContext: async (organizationId) => {
        const [orgInfo, trialStatus, limits, usage] = await Promise.all([
            AccessPolicyService.getOrganizationType(organizationId),
            AccessPolicyService.checkTrialStatus(organizationId),
            AccessPolicyService.getOrganizationLimits(organizationId),
            AccessPolicyService.getDailyUsage(organizationId)
        ]);

        return {
            organizationType: orgInfo?.organizationType || ORG_TYPES.TRIAL,
            isDemo: orgInfo?.organizationType === ORG_TYPES.DEMO,
            isTrial: orgInfo?.organizationType === ORG_TYPES.TRIAL,
            isPaid: orgInfo?.organizationType === ORG_TYPES.PAID,
            trialStatus,
            allowedAIRoles: limits?.aiRolesEnabled || ['ADVISOR'],
            dailyAIUsage: {
                used: usage?.aiCallsCount || 0,
                limit: limits?.maxAICallsPerDay || 50,
                remaining: Math.max(0, (limits?.maxAICallsPerDay || 50) - (usage?.aiCallsCount || 0))
            },
            canExecuteAIActions: orgInfo?.organizationType === ORG_TYPES.PAID,
            aiResponseBadge: orgInfo?.organizationType === ORG_TYPES.DEMO
                ? '🎯 Demo AI'
                : (orgInfo?.organizationType === ORG_TYPES.TRIAL ? '🔬 Trial AI' : null)
        };
    },

    /**
     * Create default limits for a new organization
     * @param {string} organizationId 
     * @param {string} orgType - DEMO | TRIAL | PAID
     * @returns {Promise<void>}
     */
    createDefaultLimits: async (organizationId, orgType = ORG_TYPES.TRIAL) => {
        const defaults = orgType === ORG_TYPES.DEMO ? DEFAULT_DEMO_LIMITS : DEFAULT_TRIAL_LIMITS;

        return new Promise((resolve, reject) => {
            deps.db.run(
                `INSERT OR REPLACE INTO organization_limits 
                 (id, organization_id, max_projects, max_users, max_ai_calls_per_day, max_initiatives, max_storage_mb, ai_roles_enabled_json)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    deps.uuidv4(),
                    organizationId,
                    defaults.max_projects,
                    defaults.max_users,
                    defaults.max_ai_calls_per_day,
                    defaults.max_initiatives,
                    defaults.max_storage_mb,
                    defaults.ai_roles_enabled_json
                ],
                (err) => {
                    if (err) return reject(err);
                    resolve();
                }
            );
        });
    },

    /**
     * Remove limits for a paid organization
     * @param {string} organizationId 
     * @returns {Promise<void>}
     */
    removeLimits: async (organizationId) => {
        return new Promise((resolve, reject) => {
            deps.db.run(
                `DELETE FROM organization_limits WHERE organization_id = ?`,
                [organizationId],
                (err) => {
                    if (err) return reject(err);
                    resolve();
                }
            );
        });
    },

    // Private helper methods
    _countOrgProjects: async (organizationId) => {
        return new Promise((resolve, reject) => {
            deps.db.get(
                `SELECT COUNT(*) as count FROM projects WHERE organization_id = ?`,
                [organizationId],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row?.count || 0);
                }
            );
        });
    },

    _countOrgInitiatives: async (organizationId) => {
        return new Promise((resolve, reject) => {
            deps.db.get(
                `SELECT count(*) as count FROM initiatives WHERE organization_id = ?`,
                [organizationId],
                (err, row) => {
                    if (err) return reject(err);
                    const count = row ? row.count : 0;
                    resolve(count);
                }
            );
        });
    },

    _countOrgUsers: async (organizationId) => {
        return new Promise((resolve, reject) => {
            deps.db.get(
                `SELECT COUNT(*) as count FROM users WHERE organization_id = ?`,
                [organizationId],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row?.count || 0);
                }
            );
        });
    },

    // ==========================================
    // STEP 2 FINALIZATION: Policy Snapshot (Single Source of Truth)
    // ==========================================

    /**
     * Build unified Policy Snapshot for UI consumption
     * UI should ONLY use this - no local gating logic
     * @param {string} organizationId 
     * @returns {Promise<Object>}
     */
    buildPolicySnapshot: async (organizationId) => {
        const [orgInfo, trialStatus, limits, usage] = await Promise.all([
            AccessPolicyService.getOrganizationType(organizationId),
            AccessPolicyService.checkTrialStatus(organizationId),
            AccessPolicyService.getOrganizationLimits(organizationId),
            AccessPolicyService.getDailyUsage(organizationId)
        ]);

        if (!orgInfo) {
            return null;
        }

        const isDemo = orgInfo.organizationType === ORG_TYPES.DEMO;
        const isTrial = orgInfo.organizationType === ORG_TYPES.TRIAL;
        const isPaid = orgInfo.organizationType === ORG_TYPES.PAID;

        // Determine blocked features based on org type
        const blockedFeatures = [];
        const blockedActions = [];

        if (isDemo) {
            blockedFeatures.push('ADVANCED_ANALYTICS', 'EXPORT_PDF', 'CUSTOM_INTEGRATIONS', 'SSO');
            blockedActions.push('AI_DO_ACTIONS', 'INVITES', 'EXPORT', 'CREATE_PROJECT', 'CREATE_INITIATIVE');
        } else if (isTrial) {
            blockedFeatures.push('ADVANCED_ANALYTICS', 'CUSTOM_INTEGRATIONS', 'SSO', 'DEDICATED_SUPPORT');
            if (trialStatus.expired) {
                blockedActions.push('AI_DO_ACTIONS', 'INVITES', 'EXPORT', 'CREATE_PROJECT', 'CREATE_INITIATIVE', 'WRITE');
            }
        }

        // Check limit-based blocks
        if (isTrial && limits) {
            const projectCount = await AccessPolicyService._countOrgProjects(organizationId);
            const userCount = await AccessPolicyService._countOrgUsers(organizationId);

            if (projectCount >= limits.maxProjects) blockedActions.push('CREATE_PROJECT');
            if (userCount >= limits.maxUsers) blockedActions.push('INVITES');
            if (usage.aiCallsCount >= limits.maxAICallsPerDay) blockedActions.push('AI_CALL');
        }

        // Build messages
        let bannerText = null;
        let modalText = null;

        if (isDemo) {
            bannerText = 'You are viewing a demo environment (read-only)';
        } else if (isTrial && trialStatus.expired) {
            bannerText = 'Your trial has expired. Upgrade to continue.';
            modalText = 'Your trial period has ended. Your data is safe, but your organization is now in read-only mode. Upgrade to restore full access.';
        } else if (isTrial && trialStatus.warningLevel !== 'none') {
            bannerText = `Trial: ${trialStatus.daysRemaining} day${trialStatus.daysRemaining !== 1 ? 's' : ''} remaining`;
        }

        return {
            orgType: orgInfo.organizationType,
            isDemo,
            isTrial,
            isPaid,
            trialStartedAt: orgInfo.trialStartedAt,
            trialExpiresAt: orgInfo.trialExpiresAt,
            trialDaysLeft: trialStatus.daysRemaining,
            isTrialExpired: trialStatus.expired,
            warningLevel: trialStatus.warningLevel,
            limits: limits ? {
                maxProjects: limits.maxProjects,
                maxUsers: limits.maxUsers,
                maxAICallsPerDay: limits.maxAICallsPerDay,
                maxInitiatives: limits.maxInitiatives,
                maxStorageMb: limits.maxStorageMb,
                aiRolesEnabled: limits.aiRolesEnabled
            } : null,
            usageToday: {
                aiCalls: usage?.aiCallsCount || 0,
                projects: await AccessPolicyService._countOrgProjects(organizationId),
                users: await AccessPolicyService._countOrgUsers(organizationId)
            },
            blockedFeatures: [...new Set(blockedFeatures)],
            blockedActions: [...new Set(blockedActions)],
            upgradeCtas: {
                primaryAction: trialStatus.expired ? 'Upgrade Now' : 'Upgrade Plan',
                urlOrRoute: '/settings?tab=billing'
            },
            messages: {
                bannerText,
                modalText
            }
        };
    },

    // ==========================================
    // STEP 3 HOOKS: Invitation Readiness
    // ==========================================

    /**
     * Check if user can invite more users to the organization
     * @param {string} organizationId 
     * @param {string} requestingUserId - User attempting the invite
     * @returns {Promise<{allowed: boolean, reasonCode: string}>}
     */
    canInviteUsers: async (organizationId, requestingUserId) => {
        const [orgInfo, trialStatus, limits] = await Promise.all([
            AccessPolicyService.getOrganizationType(organizationId),
            AccessPolicyService.checkTrialStatus(organizationId),
            AccessPolicyService.getOrganizationLimits(organizationId)
        ]);

        if (!orgInfo) {
            return { allowed: false, reasonCode: 'ORG_NOT_FOUND' };
        }

        // Demo orgs cannot invite
        if (orgInfo.organizationType === ORG_TYPES.DEMO) {
            return { allowed: false, reasonCode: 'DEMO_READ_ONLY' };
        }

        // Expired trials cannot invite
        if (trialStatus.expired && orgInfo.organizationType !== ORG_TYPES.PAID) {
            return { allowed: false, reasonCode: 'TRIAL_EXPIRED' };
        }

        // Check seat limit
        if (limits) {
            const currentUsers = await AccessPolicyService._countOrgUsers(organizationId);
            if (currentUsers >= limits.maxUsers) {
                return { allowed: false, reasonCode: 'USER_LIMIT_REACHED' };
            }
        }

        // PAID orgs have no limits
        return { allowed: true, reasonCode: 'OK' };
    },

    /**
     * Get seat availability for an organization
     * @param {string} organizationId 
     * @returns {Promise<{maxSeats: number, currentSeats: number, seatsRemaining: number}>}
     */
    getSeatAvailability: async (organizationId) => {
        const [orgInfo, limits] = await Promise.all([
            AccessPolicyService.getOrganizationType(organizationId),
            AccessPolicyService.getOrganizationLimits(organizationId)
        ]);

        const currentSeats = await AccessPolicyService._countOrgUsers(organizationId);

        // PAID orgs have unlimited seats (represented as -1)
        if (orgInfo?.organizationType === ORG_TYPES.PAID || !limits) {
            return {
                maxSeats: -1,
                currentSeats,
                seatsRemaining: -1
            };
        }

        return {
            maxSeats: limits.maxUsers,
            currentSeats,
            seatsRemaining: Math.max(0, limits.maxUsers - currentSeats)
        };
    }
};

// Export constants
AccessPolicyService.ORG_TYPES = ORG_TYPES;
AccessPolicyService.DEFAULT_TRIAL_LIMITS = DEFAULT_TRIAL_LIMITS;
AccessPolicyService.DEFAULT_DEMO_LIMITS = DEFAULT_DEMO_LIMITS;
AccessPolicyService.TRIAL_DURATION_DAYS = TRIAL_DURATION_DAYS;

// Step 2 Finalization: Extend-trial limits
AccessPolicyService.MAX_TRIAL_EXTENSIONS = 2;
AccessPolicyService.MAX_EXTENSION_DAYS = 14;

module.exports = AccessPolicyService;

