/**
 * AI Role Guard
 *
 * Real implementation backed by `project_ai_settings`.
 * This avoids "fake success" role/capability payloads and makes behavior deterministic.
 */

<<<<<<< Updated upstream
const AiRoleGuard = {
  getRoleConfig: async (projectId: string) => {
    const role = 'ADVISOR';
    return {
      role,
      activeRole: role,
      capabilities: {
        canAnalyze: true,
        canSuggest: true,
        canCreateDrafts: true,
        canExecuteActions: false,
      },
      roleDescription: 'Provides expert analysis and recommendations but does not take action.',
      roleHierarchy: ['ADVISOR', 'MANAGER', 'OPERATOR'],
    };
=======
import { getDatabaseAsync } from '../database/Database.js';

type AIRole = 'ADVISOR' | 'MANAGER' | 'OPERATOR';

const ROLE_HIERARCHY: AIRole[] = ['ADVISOR', 'MANAGER', 'OPERATOR'];

const ROLE_DESCRIPTIONS: Record<AIRole, string> = {
  ADVISOR: 'Provides expert analysis and recommendations but does not take action.',
  MANAGER: 'Can draft work products and prepare plans, but does not execute irreversible actions.',
  OPERATOR: 'Can execute approved actions and generate work products.',
};

const ROLE_CAPABILITIES: Record<
  AIRole,
  {
    canAnalyze: boolean;
    canSuggest: boolean;
    canCreateDrafts: boolean;
    canExecuteActions: boolean;
  }
> = {
  ADVISOR: { canAnalyze: true, canSuggest: true, canCreateDrafts: false, canExecuteActions: false },
  MANAGER: { canAnalyze: true, canSuggest: true, canCreateDrafts: true, canExecuteActions: false },
  OPERATOR: { canAnalyze: true, canSuggest: true, canCreateDrafts: true, canExecuteActions: true },
};

function normalizeRole(role: unknown): AIRole {
  const r = String(role || 'ADVISOR').toUpperCase();
  if (r === 'MANAGER' || r === 'OPERATOR' || r === 'ADVISOR') return r;
  return 'ADVISOR';
}

async function getStoredRole(projectId: string): Promise<AIRole> {
  const db = await getDatabaseAsync();
  const result = await (db as any).query(
    `SELECT ai_role FROM project_ai_settings WHERE project_id = ? LIMIT 1`,
    [projectId]
  );
  const row = (result?.rows || [])[0] as any;
  return normalizeRole(row?.ai_role);
}

const AIRoleGuard = {
  async getProjectRole(projectId: string): Promise<AIRole> {
    return await getStoredRole(projectId);
>>>>>>> Stashed changes
  },

  getRoleCapabilities(role: string) {
    const r = normalizeRole(role);
    return ROLE_CAPABILITIES[r];
  },

  getRoleDescription(role: string) {
    const r = normalizeRole(role);
    return ROLE_DESCRIPTIONS[r];
  },

  async setProjectRole(projectId: string, role: string, _userId?: string) {
    const db = await getDatabaseAsync();
    const r = normalizeRole(role);
    await (db as any).query(
      `
        INSERT INTO project_ai_settings (project_id, ai_role, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(project_id) DO UPDATE SET
          ai_role = excluded.ai_role,
          updated_at = CURRENT_TIMESTAMP
      `,
      [projectId, r]
    );
    return { success: true };
  },

  async getRoleConfig(projectId: string) {
    const activeRole = await getStoredRole(projectId);
    return {
      activeRole,
      capabilities: ROLE_CAPABILITIES[activeRole],
      roleDescription: ROLE_DESCRIPTIONS[activeRole],
      roleHierarchy: ROLE_HIERARCHY,
    };
  },

  async isActionBlocked(projectId: string, actionType: string) {
    const currentRole = await getStoredRole(projectId);
    const caps = ROLE_CAPABILITIES[currentRole];

    const type = String(actionType || '').toUpperCase();
    const requiresDrafts =
      type.startsWith('CREATE_DRAFT_') || type === 'GENERATE_REPORT' || type === 'PREPARE_DECISION_SUMMARY';
    const requiresExecute = type === 'SUGGEST_ROADMAP_CHANGE';

    if (requiresExecute && !caps.canExecuteActions) {
      return {
        blocked: true,
        reason: `Action requires OPERATOR role`,
        currentRole,
        roleRequired: 'OPERATOR',
        requiresApproval: false,
        suggestion: 'Ask an admin to set project AI role to OPERATOR.',
      };
    }

    if (requiresDrafts && !caps.canCreateDrafts) {
      return {
        blocked: true,
        reason: `Action requires MANAGER role`,
        currentRole,
        roleRequired: 'MANAGER',
        requiresApproval: false,
        suggestion: 'Ask an admin to set project AI role to MANAGER or OPERATOR.',
      };
    }

    return { blocked: false, currentRole, requiresApproval: false };
  },
};

export default AIRoleGuard;
