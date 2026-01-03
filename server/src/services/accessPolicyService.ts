/**
 * Access Policy Service
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Migrated from server/services/accessPolicyService.js (CommonJS) to TypeScript (ES Modules)
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

import { v4 as uuidv4 } from 'uuid';
import type { IDatabase } from '../database/IDatabase.js';
import { getDatabase } from '../database/Database.js';
import * as DbPromise from '../utils/DbPromise.js';

// ==========================================
// CONSTANTS
// ==========================================

export const ORG_TYPES = {
    DEMO: 'DEMO',
    TRIAL: 'TRIAL',
    PAID: 'PAID'
} as const;

export type OrgType = typeof ORG_TYPES[keyof typeof ORG_TYPES];

export const DEFAULT_TRIAL_LIMITS = {
    max_projects: 3,
    max_users: 4, // Owner + 3 invites
    max_ai_calls_per_day: 50, // Soft limit, hard limit is token budget
    max_initiatives: 5,
    max_storage_mb: 100,
    max_total_tokens: 100000,
    ai_roles_enabled_json: '["ADVISOR"]'
} as const;

export const DEFAULT_DEMO_LIMITS = {
    max_projects: 1,
    max_users: 1,
    max_ai_calls_per_day: 10,
    max_initiatives: 5,
    max_storage_mb: 10,
    ai_roles_enabled_json: '["ADVISOR"]'
} as const;

export const TRIAL_DURATION_DAYS = 14;

// ==========================================
// TYPES
// ==========================================

interface OrganizationType {
    id: string;
    name: string;
    organizationType: OrgType;
    trialStartedAt?: string | null;
    trialExpiresAt?: string | null;
    isActive: boolean;
    plan?: string | null;
    status?: string | null;
}

interface OrganizationLimits {
    id?: string;
    organizationId: string;
    maxProjects: number;
    maxUsers: number;
    maxAICallsPerDay: number;
    maxInitiatives: number;
    maxStorageMb: number;
    maxTotalTokens: number;
    aiRolesEnabled: string[];
}

interface TrialStatus {
    expired: boolean;
    daysRemaining: number;
    warningLevel: 'none' | 'warning' | 'critical' | 'expired';
}

interface DailyUsage {
    id?: string;
    organizationId: string;
    counterDate: string;
    aiCallsCount: number;
    projectsCount: number;
    usersCount: number;
    initiativesCount: number;
    storageUsedMb: number;
}

interface TrialUsage {
    tokensUsed: number;
}

interface CheckAccessResult {
    allowed: boolean;
    reason?: string;
    errorCode?: string;
}

interface IsAIRoleAllowedResult {
    allowed: boolean;
    reason?: string;
}

interface AIAccessContext {
    organizationType: OrgType;
    isDemo: boolean;
    isTrial: boolean;
    isPaid: boolean;
    trialStatus: TrialStatus;
    allowedAIRoles: string[];
    dailyAIUsage: {
        used: number;
        limit: number;
        remaining: number;
    };
    canExecuteAIActions: boolean;
    aiResponseBadge: string | null;
}

interface PolicySnapshot {
    orgType: OrgType;
    isDemo: boolean;
    isTrial: boolean;
    isPaid: boolean;
    trialStartedAt?: string | null;
    trialExpiresAt?: string | null;
    trialDaysLeft: number;
    isTrialExpired: boolean;
    warningLevel: 'none' | 'warning' | 'critical' | 'expired';
    limits: {
        maxProjects: number;
        maxUsers: number;
        maxAICallsPerDay: number;
        maxInitiatives: number;
        maxStorageMb: number;
        aiRolesEnabled: string[];
    } | null;
    usageToday: {
        aiCalls: number;
        projects: number;
        users: number;
    };
    blockedFeatures: string[];
    blockedActions: string[];
    upgradeCtas: {
        primaryAction: string;
        urlOrRoute: string;
    };
    messages: {
        bannerText: string | null;
        modalText: string | null;
    };
}

interface CanInviteUsersResult {
    allowed: boolean;
    reasonCode: string;
}

interface SeatAvailability {
    maxSeats: number;
    currentSeats: number;
    seatsRemaining: number;
}

interface SeatAvailabilityEnhanced extends SeatAvailability {
    utilizationPercent: number;
    baseSeatsIncluded: number;
    additionalSeatsPurchased: number;
    autoAddEnabled: boolean;
}

interface OrganizationRow {
    id: string;
    name: string;
    organization_type?: string | null;
    trial_started_at?: string | null;
    trial_expires_at?: string | null;
    is_active: number;
    plan?: string | null;
    status?: string | null;
    trial_tokens_used?: number;
}

interface OrganizationLimitsRow {
    id: string;
    organization_id: string;
    max_projects: number;
    max_users: number;
    max_ai_calls_per_day: number;
    max_initiatives: number;
    max_storage_mb: number;
    max_total_tokens?: number | null;
    ai_roles_enabled_json?: string | null;
}

interface UsageCountersRow {
    id: string;
    organization_id: string;
    counter_date: string;
    ai_calls_count: number;
    projects_count: number;
    users_count: number;
    initiatives_count: number;
    storage_used_mb: number;
}

interface CountRow {
    count: number;
}

// ==========================================
// SERVICE
// ==========================================

let db: IDatabase = getDatabase();
let SeatManagementService: any;

async function initDeps(): Promise<void> {
    if (!SeatManagementService) {
        const seatModule = await import('./seatManagementService.js');
        SeatManagementService = seatModule.default || seatModule;
    }
}

/**
 * Set dependencies (for testing)
 */
export function setDependencies(newDeps: { db?: IDatabase; SeatManagementService?: any } = {}): void {
    if (newDeps.db) {
        db = newDeps.db;
    }
    if (newDeps.SeatManagementService) {
        SeatManagementService = newDeps.SeatManagementService;
    }
}

/**
 * Get organization type and basic info
 */
export async function getOrganizationType(organizationId: string): Promise<OrganizationType | null> {
    const row = await DbPromise.get<OrganizationRow>(
        db,
        `SELECT id, name, organization_type, trial_started_at, trial_expires_at, is_active, plan, status 
         FROM organizations WHERE id = ?`,
        [organizationId]
    );

    if (!row) return null;

    return {
        id: row.id,
        name: row.name,
        organizationType: (row.organization_type || ORG_TYPES.TRIAL) as OrgType,
        trialStartedAt: row.trial_started_at || null,
        trialExpiresAt: row.trial_expires_at || null,
        isActive: row.is_active === 1,
        plan: row.plan || null,
        status: row.status || null
    };
}

/**
 * Get organization limits
 */
export async function getOrganizationLimits(organizationId: string): Promise<OrganizationLimits | null> {
    const row = await DbPromise.get<OrganizationLimitsRow>(
        db,
        `SELECT * FROM organization_limits WHERE organization_id = ?`,
        [organizationId]
    );

    if (!row) {
        // Get org type to determine default limits
        const orgInfo = await getOrganizationType(organizationId);
        if (!orgInfo) return null;

        const defaults = orgInfo.organizationType === ORG_TYPES.DEMO
            ? DEFAULT_DEMO_LIMITS
            : DEFAULT_TRIAL_LIMITS;

        return {
            organizationId,
            maxProjects: defaults.max_projects,
            maxUsers: defaults.max_users,
            maxAICallsPerDay: defaults.max_ai_calls_per_day,
            maxInitiatives: defaults.max_initiatives,
            maxStorageMb: defaults.max_storage_mb,
            maxTotalTokens: defaults.max_total_tokens,
            aiRolesEnabled: JSON.parse(defaults.ai_roles_enabled_json)
        };
    }

    return {
        id: row.id,
        organizationId: row.organization_id,
        maxProjects: row.max_projects,
        maxUsers: row.max_users,
        maxAICallsPerDay: row.max_ai_calls_per_day,
        maxInitiatives: row.max_initiatives,
        maxStorageMb: row.max_storage_mb,
        maxTotalTokens: row.max_total_tokens || DEFAULT_TRIAL_LIMITS.max_total_tokens,
        aiRolesEnabled: JSON.parse(row.ai_roles_enabled_json || '["ADVISOR"]')
    };
}

/**
 * Check if trial is expired
 */
export async function checkTrialStatus(organizationId: string): Promise<TrialStatus> {
    const orgInfo = await getOrganizationType(organizationId);

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
        const hoursElapsed = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60);
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
    const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    let warningLevel: 'none' | 'warning' | 'critical' | 'expired' = 'none';
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
}

/**
 * Get today's usage counters for an organization
 */
export async function getDailyUsage(organizationId: string): Promise<DailyUsage> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const row = await DbPromise.get<UsageCountersRow>(
        db,
        `SELECT * FROM usage_counters WHERE organization_id = ? AND counter_date = ?`,
        [organizationId, today]
    );

    if (!row) {
        return {
            organizationId,
            counterDate: today,
            aiCallsCount: 0,
            projectsCount: 0,
            usersCount: 0,
            initiativesCount: 0,
            storageUsedMb: 0
        };
    }

    return {
        id: row.id,
        organizationId: row.organization_id,
        counterDate: row.counter_date,
        aiCallsCount: row.ai_calls_count,
        projectsCount: row.projects_count,
        usersCount: row.users_count,
        initiativesCount: row.initiatives_count,
        storageUsedMb: row.storage_used_mb
    };
}

/**
 * Increment a usage counter
 */
export async function incrementUsage(organizationId: string, counterType: 'ai_calls' | 'projects' | 'users' | 'initiatives' | 'storage', amount: number = 1): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const columnMap: Record<string, string> = {
        'ai_calls': 'ai_calls_count',
        'projects': 'projects_count',
        'users': 'users_count',
        'initiatives': 'initiatives_count',
        'storage': 'storage_used_mb'
    };

    const column = columnMap[counterType];
    if (!column) throw new Error(`Invalid counter type: ${counterType}`);

    // Upsert pattern for SQLite
    await DbPromise.run(
        db,
        `INSERT INTO usage_counters (id, organization_id, counter_date, ${column})
         VALUES (?, ?, ?, ?)
         ON CONFLICT(organization_id, counter_date) 
         DO UPDATE SET ${column} = ${column} + ?`,
        [`usage-${uuidv4()}`, organizationId, today, amount, amount]
    );
}

/**
 * Track token usage for trial budget
 */
export async function trackTokenUsage(organizationId: string, tokens: number): Promise<void> {
    await DbPromise.run(
        db,
        `UPDATE organizations SET trial_tokens_used = COALESCE(trial_tokens_used, 0) + ? WHERE id = ?`,
        [tokens, organizationId]
    );
}

/**
 * Get trial usage stats
 */
export async function getTrialUsage(organizationId: string): Promise<TrialUsage> {
    const row = await DbPromise.get<OrganizationRow>(
        db,
        `SELECT trial_tokens_used FROM organizations WHERE id = ?`,
        [organizationId]
    );

    return { tokensUsed: row?.trial_tokens_used || 0 };
}

/**
 * Check if an action is allowed based on organization type and limits
 */
export async function checkAccess(organizationId: string, action: 'create_project' | 'create_initiative' | 'invite_user' | 'ai_call' | 'upload' | 'write'): Promise<CheckAccessResult> {
    try {
        // Get org info and trial status
        const [orgInfo, trialStatus, limits, usage, trialUsage] = await Promise.all([
            getOrganizationType(organizationId),
            checkTrialStatus(organizationId),
            getOrganizationLimits(organizationId),
            getDailyUsage(organizationId),
            getTrialUsage(organizationId)
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
                const projectCount = await countOrgProjects(organizationId);
                if (projectCount >= limits.maxProjects) {
                    return {
                        allowed: false,
                        reason: `Project limit reached (${limits.maxProjects}). Upgrade to create more projects.`,
                        errorCode: 'PROJECT_LIMIT_REACHED'
                    };
                }
                break;

            case 'create_initiative':
                const initiativeCount = await countOrgInitiatives(organizationId);
                if (initiativeCount >= limits.maxInitiatives) {
                    return {
                        allowed: false,
                        reason: `Initiative limit reached (${limits.maxInitiatives}). Upgrade to create more initiatives.`,
                        errorCode: 'INITIATIVE_LIMIT_REACHED'
                    };
                }
                break;

            case 'invite_user':
                const userCount = await countOrgUsers(organizationId);
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
}

/**
 * Check if an AI role is allowed for the organization
 */
export async function isAIRoleAllowed(organizationId: string, aiRole: string): Promise<IsAIRoleAllowedResult> {
    const limits = await getOrganizationLimits(organizationId);

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
}

/**
 * Get access context for AI operations
 * Returns all information needed by AI orchestrator
 */
export async function getAIAccessContext(organizationId: string): Promise<AIAccessContext> {
    const [orgInfo, trialStatus, limits, usage] = await Promise.all([
        getOrganizationType(organizationId),
        checkTrialStatus(organizationId),
        getOrganizationLimits(organizationId),
        getDailyUsage(organizationId)
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
}

/**
 * Create default limits for a new organization
 */
export async function createDefaultLimits(organizationId: string, orgType: OrgType = ORG_TYPES.TRIAL): Promise<void> {
    const defaults = orgType === ORG_TYPES.DEMO ? DEFAULT_DEMO_LIMITS : DEFAULT_TRIAL_LIMITS;

    await DbPromise.run(
        db,
        `INSERT OR REPLACE INTO organization_limits 
         (id, organization_id, max_projects, max_users, max_ai_calls_per_day, max_initiatives, max_storage_mb, ai_roles_enabled_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            `limit-${uuidv4()}`,
            organizationId,
            defaults.max_projects,
            defaults.max_users,
            defaults.max_ai_calls_per_day,
            defaults.max_initiatives,
            defaults.max_storage_mb,
            defaults.ai_roles_enabled_json
        ]
    );
}

/**
 * Remove limits for a paid organization
 */
export async function removeLimits(organizationId: string): Promise<void> {
    await DbPromise.run(
        db,
        `DELETE FROM organization_limits WHERE organization_id = ?`,
        [organizationId]
    );
}

// Private helper methods
async function countOrgProjects(organizationId: string): Promise<number> {
    const row = await DbPromise.get<CountRow>(
        db,
        `SELECT COUNT(*) as count FROM projects WHERE organization_id = ?`,
        [organizationId]
    );
    return row?.count || 0;
}

async function countOrgInitiatives(organizationId: string): Promise<number> {
    const row = await DbPromise.get<CountRow>(
        db,
        `SELECT count(*) as count FROM initiatives WHERE organization_id = ?`,
        [organizationId]
    );
    return row?.count || 0;
}

async function countOrgUsers(organizationId: string): Promise<number> {
    const row = await DbPromise.get<CountRow>(
        db,
        `SELECT COUNT(*) as count FROM users WHERE organization_id = ?`,
        [organizationId]
    );
    return row?.count || 0;
}

/**
 * Build unified Policy Snapshot for UI consumption
 * UI should ONLY use this - no local gating logic
 */
export async function buildPolicySnapshot(organizationId: string): Promise<PolicySnapshot | null> {
    const [orgInfo, trialStatus, limits, usage] = await Promise.all([
        getOrganizationType(organizationId),
        checkTrialStatus(organizationId),
        getOrganizationLimits(organizationId),
        getDailyUsage(organizationId)
    ]);

    if (!orgInfo) {
        return null;
    }

    const isDemo = orgInfo.organizationType === ORG_TYPES.DEMO;
    const isTrial = orgInfo.organizationType === ORG_TYPES.TRIAL;
    const isPaid = orgInfo.organizationType === ORG_TYPES.PAID;

    // Determine blocked features based on org type
    const blockedFeatures: string[] = [];
    const blockedActions: string[] = [];

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
        const projectCount = await countOrgProjects(organizationId);
        const userCount = await countOrgUsers(organizationId);

        if (projectCount >= limits.maxProjects) blockedActions.push('CREATE_PROJECT');
        if (userCount >= limits.maxUsers) blockedActions.push('INVITES');
        if (usage.aiCallsCount >= limits.maxAICallsPerDay) blockedActions.push('AI_CALL');
    }

    // Build messages
    let bannerText: string | null = null;
    let modalText: string | null = null;

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
            projects: await countOrgProjects(organizationId),
            users: await countOrgUsers(organizationId)
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
}

/**
 * Check if user can invite more users to the organization
 */
export async function canInviteUsers(organizationId: string, requestingUserId: string): Promise<CanInviteUsersResult> {
    await initDeps();
    const [orgInfo, trialStatus, limits] = await Promise.all([
        getOrganizationType(organizationId),
        checkTrialStatus(organizationId),
        getOrganizationLimits(organizationId)
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

    // Check seat limit using SeatManagementService
    try {
        const canAdd = await SeatManagementService.canAddUser(organizationId);
        if (!canAdd) {
            return { allowed: false, reasonCode: 'USER_LIMIT_REACHED' };
        }
    } catch (seatErr) {
        // Fallback to old limit check if seat service fails
        const error = seatErr as Error;
        console.warn('[AccessPolicyService] Seat check failed, using fallback:', error.message);
        if (limits) {
            const currentUsers = await countOrgUsers(organizationId);
            if (currentUsers >= limits.maxUsers) {
                return { allowed: false, reasonCode: 'USER_LIMIT_REACHED' };
            }
        }
    }

    // PAID orgs have no limits
    return { allowed: true, reasonCode: 'OK' };
}

/**
 * Get seat availability for an organization
 */
export async function getSeatAvailability(organizationId: string): Promise<SeatAvailability> {
    const [orgInfo, limits] = await Promise.all([
        getOrganizationType(organizationId),
        getOrganizationLimits(organizationId)
    ]);

    const currentSeats = await countOrgUsers(organizationId);

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

/**
 * Get seat availability using SeatManagementService (enhanced version)
 */
export async function getSeatAvailabilityEnhanced(organizationId: string): Promise<SeatAvailabilityEnhanced> {
    await initDeps();
    try {
        // Try to get seat configuration from SeatManagementService
        const seatConfig = await SeatManagementService.getSeatConfiguration(organizationId);
        return {
            maxSeats: seatConfig.total_seats_available || -1,
            currentSeats: seatConfig.seats_used || 0,
            seatsRemaining: seatConfig.seats_remaining || 0,
            utilizationPercent: parseFloat(seatConfig.utilization_percent || '0'),
            baseSeatsIncluded: seatConfig.base_seats_included || 0,
            additionalSeatsPurchased: seatConfig.additional_seats_purchased || 0,
            autoAddEnabled: seatConfig.auto_add_seats_on_invite === 1
        };
    } catch (seatErr) {
        // Fallback to old method
        const error = seatErr as Error;
        console.warn('[AccessPolicyService] Seat config failed, using fallback:', error.message);
        const basic = await getSeatAvailability(organizationId);
        return {
            ...basic,
            utilizationPercent: 0,
            baseSeatsIncluded: 0,
            additionalSeatsPurchased: 0,
            autoAddEnabled: false
        };
    }
}

// Default export for backward compatibility
const AccessPolicyService = {
    ORG_TYPES,
    DEFAULT_TRIAL_LIMITS,
    DEFAULT_DEMO_LIMITS,
    setDependencies,
    getOrganizationType,
    getOrganizationLimits,
    checkTrialStatus,
    getDailyUsage,
    incrementUsage,
    trackTokenUsage,
    getTrialUsage,
    checkAccess,
    isAIRoleAllowed,
    getAIAccessContext,
    createDefaultLimits,
    removeLimits,
    buildPolicySnapshot,
    canInviteUsers,
    getSeatAvailability,
    getSeatAvailabilityEnhanced
};

export default AccessPolicyService;
