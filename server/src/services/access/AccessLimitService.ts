import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../../database/Database.js';
import type { IDatabase } from '../../database/IDatabase.js';
import * as DbPromise from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import {
  DEFAULT_DEMO_LIMITS,
  DEFAULT_TRIAL_LIMITS,
  ORG_TYPES,
  OrganizationLimits,
  OrganizationLimitsRow,
  OrganizationRow,
  OrganizationType,
  OrgType,
} from './AccessTypes.js';

const AI_ROLES_FALLBACK: string[] = ['ADVISOR'];

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

/**
 * Odporny parser kolumny organization_limits.ai_roles_enabled_json.
 *
 * Powod (awaria stagingu 14.09 04:44 UTC): jeden zepsuty znak w kolumnie
 * (wartosc zapisana jako podwojnie zaescapowany JSON, np. [\"ADVISOR\"...])
 * wywalal wyjatek z JSON.parse i kladl CALY czat AI organizacji.
 * Teraz: 1) normalny parse, 2) jedna proba odescapowania, 3) fallback ['ADVISOR'].
 */
export function parseAiRolesEnabled(raw: unknown, organizationId?: string): string[] {
  if (isStringArray(raw)) return raw;
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) return [...AI_ROLES_FALLBACK];

  try {
    const parsed = JSON.parse(text);
    if (isStringArray(parsed)) return parsed;
  } catch {
    // idziemy dalej — proba odescapowania ponizej
  }

  try {
    const unescaped = JSON.parse(`"${text}"`);
    if (typeof unescaped === 'string') {
      const parsed = JSON.parse(unescaped);
      if (isStringArray(parsed)) {
        logger.warn('[AccessLimitService] ai_roles_enabled_json bylo zaescapowane — odzyskano', {
          organization_id: organizationId,
        });
        return parsed;
      }
    }
  } catch {
    // nie da sie odzyskac — fallback ponizej
  }

  logger.warn('[AccessLimitService] ai_roles_enabled_json nie do sparsowania — fallback ADVISOR', {
    organization_id: organizationId,
    raw_sample: text.slice(0, 120),
  });
  return [...AI_ROLES_FALLBACK];
}

export class AccessLimitService {
  private db: IDatabase;

  constructor(dbOrNull?: IDatabase) {
    this.db = dbOrNull || getDatabase();
  }

  setDependencies(deps: { db?: IDatabase }) {
    if (deps.db) {
      this.db = deps.db;
    }
  }

  /**
   * Get organization type and basic info
   */
  async getOrganizationType(organizationId: string): Promise<OrganizationType | null> {
    const row = await DbPromise.get<OrganizationRow>(
      this.db,
      `SELECT id, name, organization_type, trial_started_at, trial_expires_at, is_active, plan, status 
             FROM organizations WHERE id = ?`,
      [organizationId],
      { fallback: false }
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
      status: row.status || null,
    };
  }

  /**
   * Get organization limits
   */
  async getOrganizationLimits(organizationId: string): Promise<OrganizationLimits | null> {
    const row = await DbPromise.get<OrganizationLimitsRow>(
      this.db,
      `SELECT * FROM organization_limits WHERE organization_id = ?`,
      [organizationId],
      { fallback: false }
    );

    if (!row) {
      // Get org type to determine default limits
      const orgInfo = await this.getOrganizationType(organizationId);
      if (!orgInfo) return null;

      const defaults =
        orgInfo.organizationType === ORG_TYPES.DEMO ? DEFAULT_DEMO_LIMITS : DEFAULT_TRIAL_LIMITS;

      return {
        organizationId,
        maxProjects: defaults.max_projects,
        maxUsers: defaults.max_users,
        maxAICallsPerDay: defaults.max_ai_calls_per_day,
        maxInitiatives: defaults.max_initiatives,
        maxStorageMb: defaults.max_storage_mb,
        maxTotalTokens: defaults.max_total_tokens,
        aiRolesEnabled: parseAiRolesEnabled(defaults.ai_roles_enabled_json, organizationId),
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
      aiRolesEnabled: parseAiRolesEnabled(row.ai_roles_enabled_json, organizationId),
    };
  }

  /**
   * Create default limits for a new organization
   */
  async createDefaultLimits(
    organizationId: string,
    orgType: OrgType = ORG_TYPES.TRIAL
  ): Promise<void> {
    const defaults = orgType === ORG_TYPES.DEMO ? DEFAULT_DEMO_LIMITS : DEFAULT_TRIAL_LIMITS;

    await DbPromise.run(
      this.db,
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
        defaults.ai_roles_enabled_json,
      ]
    );
  }

  /**
   * Remove limits for a paid organization
   */
  async removeLimits(organizationId: string): Promise<void> {
    await DbPromise.run(this.db, `DELETE FROM organization_limits WHERE organization_id = ?`, [
      organizationId,
    ]);
  }
}
