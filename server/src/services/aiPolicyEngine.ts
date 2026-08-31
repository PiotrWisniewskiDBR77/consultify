/**
 * AI Policy Engine - Controls what AI is allowed to do
 * AI Core Layer — Enterprise PMO Brain
 */

import { v4 as uuidv4 } from 'uuid';

import { get as dbGetOrig, run as dbRunOrig } from '../utils/DbPromise.js';
import { AppError } from '../utils/ErrorHandler.js';
import logger from '../utils/Logger.js';
import { flagOn } from '../utils/pgFlags.js';

// Mutable dependency references for injection
let dbGet = dbGetOrig;
let dbRun = dbRunOrig;

// Types and Enums
export type PolicyLevel = 'ADVISORY' | 'ASSISTED' | 'PROACTIVE' | 'AUTOPILOT';

export const POLICY_LEVELS: Record<string, PolicyLevel> = {
  ADVISORY: 'ADVISORY',
  ASSISTED: 'ASSISTED',
  PROACTIVE: 'PROACTIVE',
  AUTOPILOT: 'AUTOPILOT',
};

export const POLICY_HIERARCHY: PolicyLevel[] = ['ADVISORY', 'ASSISTED', 'PROACTIVE', 'AUTOPILOT'];

export type AIRole = 'ADVISOR' | 'PMO_MANAGER' | 'EXECUTOR' | 'EDUCATOR';

export const AI_ROLES: Record<string, AIRole> = {
  ADVISOR: 'ADVISOR',
  PMO_MANAGER: 'PMO_MANAGER',
  EXECUTOR: 'EXECUTOR',
  EDUCATOR: 'EDUCATOR',
};

export const ACTION_POLICY_REQUIREMENTS: Record<string, PolicyLevel> = {
  EXPLAIN_CONTEXT: 'ADVISORY',
  ANALYZE_RISKS: 'ADVISORY',
  PREPARE_DECISION_SUMMARY: 'ADVISORY',
  CREATE_DRAFT_TASK: 'ASSISTED',
  CREATE_DRAFT_INITIATIVE: 'ASSISTED',
  SUGGEST_ROADMAP_CHANGE: 'ASSISTED',
  GENERATE_REPORT: 'ASSISTED',
};

export interface PolicySummary {
  currentLevel: PolicyLevel;
  description: string;
  capabilities: {
    canExplain: boolean;
    canAnalyze: boolean;
    canCreateDrafts: boolean;
    canExecuteActions: boolean;
  };
  internetEnabled: boolean;
  auditRequired: boolean;
}

export interface EffectivePolicy {
  policyLevel: PolicyLevel;
  maxPolicyLevel: PolicyLevel;
  internetEnabled: boolean;
  auditRequired: boolean;
  defaultRole: string;
  activeRoles: string[];
  userTone: string;
  educationMode: boolean;
  projectAIRole: string;
  roleCapabilities: any;
  roleDescription: string;
  regulatoryModeEnabled?: boolean;
  regulatoryModePrompt?: string;
}

// Lazy-load dependencies to avoid circular dependencies
let _aiRoleGuard: any = null;
let _aiRoleGuardLoadError: string | null = null;
async function getAIRoleGuard() {
  if (!_aiRoleGuard) {
    try {
      const mod = (await import('./aiRoleGuard.js')) as any;
      _aiRoleGuard = mod.default || mod.AIRoleGuard || mod.aiRoleGuard || mod;
    } catch (e: unknown) {
      const msg = (e as Error)?.message || String(e);
      _aiRoleGuardLoadError = msg;
      logger.warn('[AIPolicyEngine] aiRoleGuard not available:', msg);
      _aiRoleGuard = null;
    }
  }
  return _aiRoleGuard;
}

let _regulatoryModeGuard: any = null;
let _regulatoryModeGuardLoadError: string | null = null;
async function getRegulatoryModeGuard() {
  if (!_regulatoryModeGuard) {
    try {
      const mod = (await import('./regulatoryModeGuard.js')) as any;
      _regulatoryModeGuard =
        mod.default || mod.RegulatoryModeGuard || mod.regulatoryModeGuard || mod;
    } catch (e: unknown) {
      const msg = (e as Error)?.message || String(e);
      _regulatoryModeGuardLoadError = msg;
      logger.warn('[AIPolicyEngine] regulatoryModeGuard not available:', msg);
      _regulatoryModeGuard = null;
    }
  }
  return _regulatoryModeGuard;
}

const AIPolicyEngine = {
  POLICY_LEVELS,
  AI_ROLES,

  /**
   * Set dependencies for testing
   */
  setDependencies(deps: any) {
    if (deps.db) {
      if (deps.db.get) dbGet = deps.db.get;
      if (deps.db.run) dbRun = deps.db.run;
    }
    if (deps.RegulatoryModeGuard) _regulatoryModeGuard = deps.RegulatoryModeGuard;
    if (deps.AIRoleGuard) _aiRoleGuard = deps.AIRoleGuard;
  },

  /**
   * Get effective policy for a context
   */
  getEffectivePolicy: async (
    organizationId: string,
    projectId: string | null = null,
    userId: string | null = null
  ): Promise<EffectivePolicy> => {
    const safeDbGet = async <T>(sql: string, params: unknown[], fallback: T): Promise<T> => {
      try {
        return ((await dbGet(sql, params)) as T) || fallback;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(`[AIPolicyEngine] Falling back due to schema mismatch: ${message}`);
        return fallback;
      }
    };

    const RegulatoryModeGuard = await getRegulatoryModeGuard();
    const AIRoleGuard = await getAIRoleGuard();

    if (projectId && (!RegulatoryModeGuard || !AIRoleGuard)) {
      throw new AppError('AI policy guards are unavailable', 503, 'FEATURE_UNAVAILABLE', {
        organizationId,
        projectId,
        aiRoleGuard: AIRoleGuard ? 'ok' : 'missing',
        regulatoryModeGuard: RegulatoryModeGuard ? 'ok' : 'missing',
        aiRoleGuardError: _aiRoleGuardLoadError || undefined,
        regulatoryModeGuardError: _regulatoryModeGuardLoadError || undefined,
      });
    }

    // 0. REGULATORY MODE CHECK - Highest priority override
    if (projectId && RegulatoryModeGuard) {
      const regulatoryModeEnabled = await RegulatoryModeGuard.isEnabled(projectId);
      if (regulatoryModeEnabled) {
        return {
          policyLevel: 'ADVISORY',
          maxPolicyLevel: 'ADVISORY',
          internetEnabled: false,
          auditRequired: true,
          defaultRole: 'ADVISOR',
          activeRoles: ['ADVISOR'],
          userTone: 'EXPERT',
          educationMode: false,
          projectAIRole: 'ADVISOR',
          roleCapabilities: AIRoleGuard ? AIRoleGuard.getRoleCapabilities('ADVISOR') : {},
          roleDescription: 'Regulatory Mode: Advisory-only',
          regulatoryModeEnabled: true,
          regulatoryModePrompt: await RegulatoryModeGuard.getRegulatoryPrompt(),
        };
      }
    }

    // 1. Get organization (tenant) policy
    const orgPolicy: any = await safeDbGet(
      `SELECT * FROM ai_policies WHERE organization_id = ?`,
      [organizationId],
      {}
    );

    let effectiveLevel: PolicyLevel = (orgPolicy.policy_level as PolicyLevel) || 'ADVISORY';
    const maxLevel: PolicyLevel = (orgPolicy.max_policy_level as PolicyLevel) || 'ASSISTED';

    // 2. Check project-level override if exists
    if (projectId) {
      // FIX-207 pkt 3 (ODBIOR_207.md): restored after commit c637cc2bde
      // reverted this to a bare dbGet, which throws (instead of falling
      // back to {}) whenever `projects.governance_settings` is missing on a
      // schema-drifted project/org.
      const project: any = await safeDbGet(
        `SELECT governance_settings FROM projects WHERE id = ?`,
        [projectId],
        {}
      );

      try {
        const settings = JSON.parse(project.governance_settings || '{}');
        if (settings.aiPolicyOverride) {
          const overrideIndex = POLICY_HIERARCHY.indexOf(settings.aiPolicyOverride);
          const currentIndex = POLICY_HIERARCHY.indexOf(effectiveLevel);
          if (overrideIndex < currentIndex) {
            effectiveLevel = settings.aiPolicyOverride;
          }
        }
      } catch {}
    }

    // 3. Check user preferences
    let userPreferences: any = {};
    if (userId) {
      userPreferences = await safeDbGet(
        `SELECT * FROM ai_user_preferences WHERE user_id = ?`,
        [userId],
        {}
      );
    }

    // Ensure we don't exceed max level
    const effectiveIndex = POLICY_HIERARCHY.indexOf(effectiveLevel);
    const maxIndex = POLICY_HIERARCHY.indexOf(maxLevel);
    if (maxIndex !== -1 && effectiveIndex > maxIndex) {
      effectiveLevel = maxLevel;
    }

    // 4. Get project AI role (AI Roles Model)
    let projectAIRole = 'ADVISOR';
    let roleCapabilities = AIRoleGuard ? AIRoleGuard.getRoleCapabilities('ADVISOR') : {};
    if (projectId && AIRoleGuard) {
      projectAIRole = await AIRoleGuard.getProjectRole(projectId);
      roleCapabilities = AIRoleGuard.getRoleCapabilities(projectAIRole);
    }

    return {
      policyLevel: effectiveLevel,
      maxPolicyLevel: maxLevel,
      // Factory default: internet is enabled unless explicitly disabled (0).
      // This is still overridden by Regulatory Mode and by missing web-search credentials
      // (handled in webSearchGovernance).
      internetEnabled:
        orgPolicy.internet_enabled === 0 ? false : orgPolicy.internet_enabled === 1 ? true : true,
      auditRequired: orgPolicy.audit_required !== 0,
      defaultRole: orgPolicy.default_ai_role || 'ADVISOR',
      activeRoles: JSON.parse(
        orgPolicy.active_roles || '["ADVISOR","PMO_MANAGER","EXECUTOR","EDUCATOR"]'
      ),
      userTone: userPreferences.preferred_tone || 'EXPERT',
      educationMode: flagOn(userPreferences.education_mode),
      projectAIRole,
      roleCapabilities,
      roleDescription: AIRoleGuard ? AIRoleGuard.getRoleDescription(projectAIRole) : '',
    };
  },

  /**
   * Check if an action is allowed
   */
  canPerformAction: async (
    actionType: string,
    organizationId: string,
    projectId: string | null = null,
    userId: string | null = null
  ) => {
    const policy = await AIPolicyEngine.getEffectivePolicy(organizationId, projectId, userId);
    const requiredLevel = ACTION_POLICY_REQUIREMENTS[actionType] || 'ADVISORY';

    const requiredIndex = POLICY_HIERARCHY.indexOf(requiredLevel);
    const currentIndex = POLICY_HIERARCHY.indexOf(policy.policyLevel);

    const isAllowed = currentIndex >= requiredIndex;
    const requiresApproval =
      policy.policyLevel !== 'AUTOPILOT' &&
      (actionType.startsWith('CREATE_') || actionType.startsWith('SUGGEST_'));

    if (policy.regulatoryModeEnabled && requiredLevel !== 'ADVISORY') {
      return {
        allowed: false,
        requiresApproval: false,
        requiredLevel,
        currentLevel: policy.policyLevel,
        reason: `Action blocked by Regulatory Mode - only advisory actions allowed`,
      };
    }

    return {
      allowed: isAllowed,
      requiresApproval: requiresApproval,
      requiredLevel,
      currentLevel: policy.policyLevel,
      reason: isAllowed
        ? `Action permitted at ${policy.policyLevel} level`
        : `Action requires ${requiredLevel} policy level, but current is ${policy.policyLevel}`,
    };
  },

  /**
   * Get the required policy level for an action
   */
  getPolicyLevelForAction: (actionType: string): PolicyLevel => {
    return ACTION_POLICY_REQUIREMENTS[actionType] || 'ADVISORY';
  },

  /**
   * Check if a role is active
   */
  isRoleActive: async (role: string, organizationId: string) => {
    const policy = await AIPolicyEngine.getEffectivePolicy(organizationId);
    return policy.activeRoles.includes(role);
  },

  /**
   * Update organization policy (Admin only)
   */
  updatePolicy: async (organizationId: string, updates: any): Promise<any> => {
    const {
      policyLevel,
      internetEnabled,
      auditRequired,
      maxPolicyLevel,
      defaultRole,
      activeRoles,
    } = updates;

    if (policyLevel && !POLICY_HIERARCHY.includes(policyLevel)) {
      throw new Error(`Invalid policy level: ${policyLevel}`);
    }

    // Upsert. `id` has no DB default and is NOT NULL, so a fresh row needs one minted
    // here; the ON CONFLICT target relies on the unique index added in migration
    // 20260720_fala4_kpi_snap_milestone_deps_ai_policies.sql (organization_id previously
    // had no unique/exclusion constraint, so this upsert always 42P10'd — see
    // idx_ai_policies_organization_id_unique).
    return dbRun(
      `INSERT INTO ai_policies (id, organization_id, policy_level, internet_enabled, audit_required, max_policy_level, default_ai_role, active_roles, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(organization_id) DO UPDATE SET
                policy_level = COALESCE(?, policy_level),
                internet_enabled = COALESCE(?, internet_enabled),
                audit_required = COALESCE(?, audit_required),
                max_policy_level = COALESCE(?, max_policy_level),
                default_ai_role = COALESCE(?, default_ai_role),
                active_roles = COALESCE(?, active_roles),
                updated_at = CURRENT_TIMESTAMP`,
      [
        uuidv4(),
        organizationId,
        policyLevel,
        internetEnabled ? 1 : 0,
        auditRequired ? 1 : 0,
        maxPolicyLevel,
        defaultRole,
        JSON.stringify(activeRoles || []),
        policyLevel,
        internetEnabled !== undefined ? (internetEnabled ? 1 : 0) : null,
        auditRequired !== undefined ? (auditRequired ? 1 : 0) : null,
        maxPolicyLevel,
        defaultRole,
        activeRoles ? JSON.stringify(activeRoles) : null,
      ]
    );
  },

  /**
   * Get policy summary for display
   */
  getPolicySummary: async (organizationId: string): Promise<PolicySummary> => {
    const policy = await AIPolicyEngine.getEffectivePolicy(organizationId);

    const descriptions: Record<PolicyLevel, string> = {
      ADVISORY: 'AI provides suggestions and explanations only',
      ASSISTED: 'AI can create drafts that require your approval',
      PROACTIVE: 'AI can execute low-risk actions automatically',
      AUTOPILOT: 'AI operates autonomously within governance rules',
    };

    return {
      currentLevel: policy.policyLevel,
      description: descriptions[policy.policyLevel],
      capabilities: {
        canExplain: true,
        canAnalyze: true,
        canCreateDrafts: POLICY_HIERARCHY.indexOf(policy.policyLevel) >= 1,
        canExecuteActions: POLICY_HIERARCHY.indexOf(policy.policyLevel) >= 2,
      },
      internetEnabled: policy.internetEnabled,
      auditRequired: policy.auditRequired,
    };
  },
};

export default AIPolicyEngine;
