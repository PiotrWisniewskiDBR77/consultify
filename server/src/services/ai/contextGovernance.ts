/**
 * Organization Context Governance (T119)
 * SSOT policy per org controlling what AI can see.
 */
import { get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

export class ContextGovernancePersistenceError extends Error {
  code = 'CONTEXT_POLICY_PERSIST_FAILED' as const;
  constructor(message = 'Context policy could not be saved') {
    super(message);
    this.name = 'ContextGovernancePersistenceError';
  }
}

export type ContextCategory =
  | 'ORG_PROFILE'
  | 'ORG_TERMINOLOGY'
  | 'ORG_PATTERNS'
  | 'ORG_STRATEGY'
  | 'ORG_SECURITY_POSTURE'
  | 'ORG_FINANCIAL_SUMMARY'
  | 'ORG_DOCUMENTS';

export interface OrgContextPolicy {
  categories: Record<ContextCategory, boolean>;
  piiRedaction: 'inherit' | 'off' | 'on';
  retention: 'standard' | 'strict';
}

const DEFAULT_POLICY: OrgContextPolicy = {
  categories: {
    ORG_PROFILE: true,
    ORG_TERMINOLOGY: true,
    ORG_PATTERNS: false,
    ORG_STRATEGY: true,
    ORG_SECURITY_POSTURE: false,
    ORG_FINANCIAL_SUMMARY: false,
    ORG_DOCUMENTS: true,
  },
  piiRedaction: 'inherit',
  retention: 'standard',
};

export async function getOrgContextPolicy(organizationId: string): Promise<OrgContextPolicy> {
  try {
    const row = (await dbGet(
      `SELECT context_policy_json FROM organization_ai_settings WHERE organization_id = ? LIMIT 1`,
      [organizationId]
    )) as { context_policy_json?: string } | undefined;
    if (row?.context_policy_json) {
      try {
        const parsed =
          typeof row.context_policy_json === 'string'
            ? JSON.parse(row.context_policy_json)
            : row.context_policy_json;
        return {
          ...DEFAULT_POLICY,
          ...parsed,
          categories: { ...DEFAULT_POLICY.categories, ...parsed?.categories },
        };
      } catch (err) {
        logger.warn('[ContextGov] Invalid context policy JSON in store');
        throw err;
      }
    }
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw error;
    }
    logger.debug('[ContextGov] Failed to load org context policy — using defaults');
  }
  return { ...DEFAULT_POLICY };
}

export async function updateOrgContextPolicy(
  organizationId: string,
  policy: Partial<OrgContextPolicy>
): Promise<void> {
  const current = await getOrgContextPolicy(organizationId);
  const merged: OrgContextPolicy = {
    ...current,
    ...policy,
    categories: { ...current.categories, ...(policy.categories || {}) },
  };
  try {
    await dbRun(
      `UPDATE organization_ai_settings SET context_policy_json = ?, updated_at = datetime('now') WHERE organization_id = ?`,
      [JSON.stringify(merged), organizationId]
    );
  } catch {
    try {
      await dbRun(
        `INSERT INTO organization_ai_settings (organization_id, context_policy_json, created_at, updated_at) VALUES (?, ?, datetime('now'), datetime('now'))`,
        [organizationId, JSON.stringify(merged)]
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`[ContextGov] Failed to save context policy: ${msg}`);
      throw new ContextGovernancePersistenceError();
    }
  }
}

export function isCategoryAllowed(policy: OrgContextPolicy, category: ContextCategory): boolean {
  return policy.categories[category] ?? DEFAULT_POLICY.categories[category] ?? false;
}

export function filterContextByPolicy(
  context: Record<string, unknown>,
  policy: OrgContextPolicy
): Record<string, unknown> {
  const filtered = { ...context };
  const org = filtered.organization as Record<string, unknown> | undefined;
  const knowledge = filtered.knowledge as Record<string, unknown> | undefined;

  if (!isCategoryAllowed(policy, 'ORG_PATTERNS') && org) {
    delete org.topPatterns;
    delete org.orgPatterns;
  }
  if (!isCategoryAllowed(policy, 'ORG_TERMINOLOGY') && org) {
    delete org.terminology;
    delete org.terminologyPl;
    delete org.terminologyEn;
  }
  if (!isCategoryAllowed(policy, 'ORG_STRATEGY') && knowledge) {
    delete knowledge.strategicDirections;
  }
  if (!isCategoryAllowed(policy, 'ORG_FINANCIAL_SUMMARY')) {
    delete filtered.financialData;
  }
  if (!isCategoryAllowed(policy, 'ORG_DOCUMENTS') && knowledge) {
    knowledge.projectDocuments = [];
  }
  if (!isCategoryAllowed(policy, 'ORG_SECURITY_POSTURE')) {
    delete filtered.securityPosture;
  }
  return filtered;
}

export default {
  getOrgContextPolicy,
  updateOrgContextPolicy,
  isCategoryAllowed,
  filterContextByPolicy,
};
