#!/usr/bin/env tsx
/**
 * Normalize llm_providers + llm_tier_assignments state.
 *
 * Goal:
 * - keep one deterministic default active provider
 * - archive stale inactive provider rows without deleting history
 * - disable tier assignments for inactive provider rows
 * - ensure each active provider has an active assignment for its declared tier
 *
 * Usage:
 *   npx tsx server/scripts/normalize-llm-providers.ts
 *   npx tsx server/scripts/normalize-llm-providers.ts --apply
 *   ENV_FILE=.env.staging.local npx tsx server/scripts/normalize-llm-providers.ts --apply
 *
 * Notes:
 * - Dry-run by default. Use --apply to persist changes.
 * - Never prints API keys.
 * - Postgres only.
 */

import crypto from 'crypto';
import path from 'path';

import dotenv from 'dotenv';
import { Pool } from 'pg';

type Args = {
  apply?: boolean;
  'default-provider'?: string;
};

type ProviderRow = {
  id: string;
  provider: string;
  model_id?: string | null;
  name?: string | null;
  is_active?: boolean | number | string | null;
  is_default?: boolean | number | string | null;
  tier?: string | null;
  health_status?: string | null;
};

type TierAssignmentRow = {
  id: string;
  provider_id: string;
  tier: string;
  priority?: number | null;
  is_active?: boolean | number | string | null;
};

type ProviderUpdate = {
  id: string;
  provider: string;
  changes: Record<string, unknown>;
  reason: string;
};

type TierUpsert = {
  id: string;
  provider_id: string;
  provider: string;
  tier: string;
  priority: number;
  reason: string;
};

type TierDeactivate = {
  provider_id: string;
  provider: string;
  tier: string;
  reason: string;
};

const TIER_PRIORITY: Record<string, number> = {
  REASONING: 5,
  PREMIUM: 4,
  STANDARD: 3,
  BUDGET: 2,
  FREE: 1,
};

function parseArgs(argv: string[]): Args {
  const args: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const raw = argv[i];
    if (!raw?.startsWith('--')) continue;
    const key = raw.slice(2);
    if (key === 'apply') {
      args.apply = true;
      continue;
    }
    const value = argv[i + 1];
    if (value && !value.startsWith('--')) {
      args[key] = value;
      i += 1;
    } else {
      args[key] = true;
    }
  }
  return args as Args;
}

function loadEnv(): void {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });
  const extraEnv = String(process.env.ENV_FILE || '').trim();
  if (extraEnv) {
    dotenv.config({ path: path.resolve(process.cwd(), extraEnv), override: true });
  }
}

function asBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  return ['1', 'true', 't', 'yes', 'y', 'on'].includes(normalized);
}

function normalizeTier(value: unknown): string {
  const tier = String(value || 'STANDARD')
    .trim()
    .toUpperCase();
  return TIER_PRIORITY[tier] ? tier : 'STANDARD';
}

function makeAssignmentId(providerId: string, tier: string): string {
  return `${providerId}-${tier}-${crypto.createHash('md5').update(`${providerId}:${tier}`).digest('hex').slice(0, 8)}`;
}

function preferredDefaultProvider(
  activeProviders: ProviderRow[],
  configuredDefaultProvider: string
): ProviderRow | null {
  if (activeProviders.length === 0) return null;
  return (
    activeProviders.find((row) => row.provider === configuredDefaultProvider) ||
    activeProviders.find((row) => asBool(row.is_default)) ||
    activeProviders[0] ||
    null
  );
}

function shouldPreserveInactiveHealthStatus(row: ProviderRow): boolean {
  const status = String(row.health_status || '').trim().toLowerCase();
  return status.startsWith('disabled_');
}

function buildPlan(
  providers: ProviderRow[],
  assignments: TierAssignmentRow[],
  configuredDefaultProvider: string
): {
  providerUpdates: ProviderUpdate[];
  tierUpserts: TierUpsert[];
  tierDeactivations: TierDeactivate[];
  preferredDefaultId: string | null;
} {
  const providerUpdates: ProviderUpdate[] = [];
  const tierUpserts: TierUpsert[] = [];
  const tierDeactivations: TierDeactivate[] = [];

  const activeProviders = providers.filter((row) => asBool(row.is_active));
  const inactiveProviders = providers.filter((row) => !asBool(row.is_active));
  const preferredDefault = preferredDefaultProvider(activeProviders, configuredDefaultProvider);
  const preferredDefaultId = preferredDefault?.id || null;

  const assignmentByProviderAndTier = new Map<string, TierAssignmentRow>();
  for (const assignment of assignments) {
    assignmentByProviderAndTier.set(
      `${assignment.provider_id}:${normalizeTier(assignment.tier)}`,
      assignment
    );
  }

  for (const row of providers) {
    const isActive = asBool(row.is_active);
    const isDefault = asBool(row.is_default);
    const nextDefault = isActive && preferredDefaultId === row.id;
    const changes: Record<string, unknown> = {};
    const reasons: string[] = [];

    if (isDefault !== nextDefault) {
      changes.is_default = nextDefault;
      reasons.push(nextDefault ? 'promote deterministic default' : 'clear non-default row');
    }

    if (!isActive && !shouldPreserveInactiveHealthStatus(row)) {
      const nextStatus = 'archived_stale_inactive';
      if (String(row.health_status || '') !== nextStatus) {
        changes.health_status = nextStatus;
        reasons.push('archive inactive provider row');
      }
    }

    if (Object.keys(changes).length > 0) {
      providerUpdates.push({
        id: row.id,
        provider: row.provider,
        changes,
        reason: reasons.join('; '),
      });
    }
  }

  for (const row of activeProviders) {
    const tier = normalizeTier(row.tier);
    const priority = TIER_PRIORITY[tier] || TIER_PRIORITY.STANDARD;
    const existing = assignmentByProviderAndTier.get(`${row.id}:${tier}`);
    if (!existing || !asBool(existing.is_active) || Number(existing.priority ?? priority) !== priority) {
      tierUpserts.push({
        id: existing?.id || makeAssignmentId(row.id, tier),
        provider_id: row.id,
        provider: row.provider,
        tier,
        priority,
        reason: existing ? 'reactivate or normalize active tier assignment' : 'create missing active tier assignment',
      });
    }
  }

  for (const row of inactiveProviders) {
    for (const assignment of assignments) {
      if (assignment.provider_id !== row.id) continue;
      if (!asBool(assignment.is_active)) continue;
      tierDeactivations.push({
        provider_id: row.id,
        provider: row.provider,
        tier: normalizeTier(assignment.tier),
        reason: 'disable tier assignment for inactive provider row',
      });
    }
  }

  return { providerUpdates, tierUpserts, tierDeactivations, preferredDefaultId };
}

async function fetchProviders(pool: Pool): Promise<ProviderRow[]> {
  const result = await pool.query<ProviderRow>(
    `SELECT id, provider, model_id, name, is_active, is_default, tier, health_status
     FROM llm_providers
     ORDER BY provider ASC, is_active DESC, updated_at DESC NULLS LAST, created_at DESC NULLS LAST`
  );
  return result.rows || [];
}

async function fetchAssignments(pool: Pool): Promise<TierAssignmentRow[]> {
  const result = await pool.query<TierAssignmentRow>(
    `SELECT id, provider_id, tier, priority, is_active
     FROM llm_tier_assignments`
  );
  return result.rows || [];
}

async function applyPlan(
  pool: Pool,
  plan: ReturnType<typeof buildPlan>
): Promise<void> {
  await pool.query('BEGIN');
  try {
    for (const update of plan.providerUpdates) {
      const columns = Object.keys(update.changes);
      const values = columns.map((column) => update.changes[column]);
      const setters = columns.map((column, index) => `${column} = $${index + 2}`);
      setters.push(`updated_at = CURRENT_TIMESTAMP`);
      await pool.query(`UPDATE llm_providers SET ${setters.join(', ')} WHERE id = $1`, [
        update.id,
        ...values,
      ]);
    }

    for (const upsert of plan.tierUpserts) {
      await pool.query(
        `INSERT INTO llm_tier_assignments (
           id, provider_id, tier, priority, is_active, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (provider_id, tier) DO UPDATE SET
           priority = EXCLUDED.priority,
           is_active = TRUE,
           updated_at = CURRENT_TIMESTAMP`,
        [upsert.id, upsert.provider_id, upsert.tier, upsert.priority]
      );
    }

    for (const deactivate of plan.tierDeactivations) {
      await pool.query(
        `UPDATE llm_tier_assignments
         SET is_active = FALSE,
             updated_at = CURRENT_TIMESTAMP
         WHERE provider_id = $1
           AND tier = $2
           AND COALESCE(is_active, TRUE) = TRUE`,
        [deactivate.provider_id, deactivate.tier]
      );
    }

    await pool.query('COMMIT');
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  }
}

function printPlan(
  plan: ReturnType<typeof buildPlan>,
  providers: ProviderRow[],
  apply: boolean,
  configuredDefaultProvider: string
): void {
  const activeProviders = providers.filter((row) => asBool(row.is_active));
  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    activeProviders: activeProviders.map((row) => ({
      id: row.id,
      provider: row.provider,
      tier: normalizeTier(row.tier),
    })),
    configuredDefaultProvider,
    preferredDefaultId: plan.preferredDefaultId,
    providerUpdates: plan.providerUpdates.map((item) => ({
      id: item.id,
      provider: item.provider,
      changes: item.changes,
      reason: item.reason,
    })),
    tierUpserts: plan.tierUpserts,
    tierDeactivations: plan.tierDeactivations,
  };

  console.log(JSON.stringify(summary, null, 2));
}

async function main(): Promise<void> {
  loadEnv();
  const args = parseArgs(process.argv.slice(2));
  const apply = Boolean(args.apply);
  const configuredDefaultProvider = String(args['default-provider'] || 'openrouter')
    .trim()
    .toLowerCase();
  const databaseUrl = String(process.env.DATABASE_URL || '').trim();

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }
  if ((process.env.DB_TYPE || 'postgres').toLowerCase() !== 'postgres') {
    throw new Error('normalize-llm-providers.ts is supported only for Postgres');
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    statement_timeout: 60_000,
  });

  try {
    const providers = await fetchProviders(pool);
    if (providers.length === 0) {
      throw new Error('No rows found in llm_providers');
    }

    const assignments = await fetchAssignments(pool);
    const plan = buildPlan(providers, assignments, configuredDefaultProvider);

    printPlan(plan, providers, apply, configuredDefaultProvider);

    if (!apply) {
      console.log('\n[normalize-llm-providers] Dry run only. Re-run with --apply to persist changes.');
      return;
    }

    await applyPlan(pool, plan);
    console.log('\n[normalize-llm-providers] Changes applied successfully.');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('[normalize-llm-providers] Failed:', (error as Error)?.message || error);
  process.exit(1);
});
