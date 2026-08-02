import { z } from 'zod';

import { featureFlags } from '../../config/FeatureFlags.js';
import { all as dbAll, get as dbGet, run as dbRun, tableExists } from '../../utils/DbPromise.js';
import Logger from '../../utils/Logger.js';

const LOG_PREFIX = '[v8:featureFlags]';

const V8_MODULES = [
  'chat',
  'ai_core',
  'multiplayer',
  'workspace',
  'lifecycle',
  'pm_sync',
  'outputs',
  'finance',
  'results',
] as const;
type V8Module = (typeof V8_MODULES)[number];

const OrgIdSchema = z.string().trim().min(1);
const ModuleSchema = z.enum(V8_MODULES);

// ---------------------------------------------------------------------------
// In-memory cache with TTL
// ---------------------------------------------------------------------------

const flagCache = new Map<string, { flags: Record<string, boolean>; expiresAt: number }>();
const CACHE_TTL_MS = 60_000;

function allowImplicitOrgRowsFallback(): boolean {
  return process.env.NODE_ENV !== 'production';
}

function cacheKey(orgId: string): string {
  return `v8flags:${orgId}`;
}

function getCached(orgId: string): Record<string, boolean> | null {
  const entry = flagCache.get(cacheKey(orgId));
  if (entry && entry.expiresAt > Date.now()) return entry.flags;
  if (entry) flagCache.delete(cacheKey(orgId));
  return null;
}

function setCache(orgId: string, flags: Record<string, boolean>): void {
  flagCache.set(cacheKey(orgId), { flags, expiresAt: Date.now() + CACHE_TTL_MS });
}

function isNamespacedFlagTableMissing(error: unknown): boolean {
  const message = String((error as { message?: unknown })?.message || error || '').toLowerCase();
  return (
    message.includes('schema "v8" does not exist') ||
    message.includes('relation "v8.v8_feature_flags" does not exist') ||
    message.includes('no such table: v8.v8_feature_flags')
  );
}

async function readOrgFlagRows(orgId: string): Promise<Array<{ module: string; enabled: number }>> {
  try {
    return await dbAll<{ module: string; enabled: number }>(
      `SELECT module, enabled FROM v8.v8_feature_flags WHERE organization_id = $1`,
      [orgId],
      { fallback: false }
    );
  } catch (error) {
    if (!isNamespacedFlagTableMissing(error)) throw error;
    return dbAll<{ module: string; enabled: number }>(
      `SELECT module, enabled FROM v8_feature_flags WHERE organization_id = $1`,
      [orgId],
      { fallback: false }
    );
  }
}

export function clearFlagCache(orgId?: string): void {
  if (orgId) flagCache.delete(cacheKey(orgId));
  else flagCache.clear();
}

// ---------------------------------------------------------------------------
// Table existence guard
// ---------------------------------------------------------------------------

async function flagTableExists(): Promise<boolean> {
  try {
    return await tableExists('v8_feature_flags');
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function isV8Enabled(organizationId: string, module?: string): Promise<boolean> {
  const orgId = OrgIdSchema.parse(organizationId);

  if (!featureFlags.ENABLE_V8_GLOBAL) {
    Logger.warn(`${LOG_PREFIX} V8 disabled by global flag`, { organizationId: orgId, module });
    return false;
  }

  const hasTable = await flagTableExists();
  if (!hasTable) {
    Logger.warn(`${LOG_PREFIX} V8 feature flag table missing`, { organizationId: orgId, module });
    return false;
  }

  const flags = await getV8Flags(orgId);

  // Non-production environments may bootstrap V8 before org rows are materialized.
  // Production must require explicit rows so phased rollout cannot drift into
  // implicit broad enablement for new tenants.
  if (Object.keys(flags).length === 0) {
    return allowImplicitOrgRowsFallback();
  }

  if (module) {
    const enabled = flags[module] === true;
    if (!enabled) {
      Logger.warn(`${LOG_PREFIX} V8 module disabled for org`, {
        organizationId: orgId,
        module,
        flags,
      });
    }
    return enabled;
  }

  const enabled = Object.values(flags).some((v) => v === true);
  if (!enabled) {
    Logger.warn(`${LOG_PREFIX} V8 org disabled by flags`, {
      organizationId: orgId,
      module,
      flags,
    });
  }
  return enabled;
}

export async function getV8Flags(organizationId: string): Promise<Record<string, boolean>> {
  const orgId = OrgIdSchema.parse(organizationId);

  const cached = getCached(orgId);
  if (cached) return cached;

  const hasTable = await flagTableExists();
  if (!hasTable) return {};

  const rows = await readOrgFlagRows(orgId);

  const flags: Record<string, boolean> = {};
  for (const row of rows) {
    flags[row.module] = row.enabled === 1;
  }

  setCache(orgId, flags);
  return flags;
}

export async function setV8OrgFlag(
  organizationId: string,
  module: string,
  enabled: boolean,
  updatedBy?: string
): Promise<void> {
  const orgId = OrgIdSchema.parse(organizationId);
  ModuleSchema.parse(module);

  const hasTable = await flagTableExists();
  if (!hasTable) {
    throw new Error(
      `${LOG_PREFIX} v8_feature_flags table does not exist. Run V8 migrations first.`
    );
  }

  const now = new Date().toISOString();
  const flagId = `${orgId}:${module}`;

  const params = [flagId, orgId, module, enabled ? 1 : 0, now, updatedBy || null];
  const upsert = (table: string) =>
    dbRun(
      `INSERT INTO ${table} (flag_id, organization_id, module, enabled, updated_at, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (organization_id, module)
       DO UPDATE SET enabled = $4, updated_at = $5, updated_by = $6`,
      params,
      { fallback: false }
    );
  try {
    await upsert('v8.v8_feature_flags');
  } catch (error) {
    if (!isNamespacedFlagTableMissing(error)) throw error;
    await upsert('v8_feature_flags');
  }

  clearFlagCache(orgId);
  Logger.info(`${LOG_PREFIX} Flag ${module} set to ${enabled} for org ${orgId}`);
}

export async function isV8ShadowMode(organizationId: string): Promise<boolean> {
  const orgId = OrgIdSchema.parse(organizationId);

  if (!featureFlags.ENABLE_V8_SHADOW_MODE) return false;

  // When ENABLE_V8_SHADOW_MODE env var is set, shadow mode is active for
  // all V8-enabled orgs by default. A per-org shadow_mode=0 flag can opt out.
  const hasTable = await flagTableExists();
  if (!hasTable) return allowImplicitOrgRowsFallback();

  let row: { enabled: number } | null;
  try {
    row = await dbGet<{ enabled: number }>(
      `SELECT enabled FROM v8.v8_feature_flags WHERE organization_id = $1 AND module = 'shadow_mode'`,
      [orgId],
      { fallback: false }
    );
  } catch (error) {
    if (!isNamespacedFlagTableMissing(error)) throw error;
    row = await dbGet<{ enabled: number }>(
      `SELECT enabled FROM v8_feature_flags WHERE organization_id = $1 AND module = 'shadow_mode'`,
      [orgId],
      { fallback: false }
    );
  }

  // Non-production may default to enabled while bootstrapping; production requires
  // an explicit row so shadow mode cannot implicitly reactivate for new tenants.
  return row === null ? allowImplicitOrgRowsFallback() : row.enabled === 1;
}

export async function getAllOrgFlags(): Promise<
  Array<{ organizationId: string; module: string; enabled: boolean; updatedAt: string }>
> {
  const hasTable = await flagTableExists();
  if (!hasTable) return [];

  let rows: Array<{
    organization_id: string;
    module: string;
    enabled: number;
    updated_at: string;
  }>;
  try {
    rows = await dbAll(
      `SELECT organization_id, module, enabled, updated_at FROM v8.v8_feature_flags ORDER BY organization_id, module`,
      [],
      { fallback: false }
    );
  } catch (error) {
    if (!isNamespacedFlagTableMissing(error)) throw error;
    rows = await dbAll(
      `SELECT organization_id, module, enabled, updated_at FROM v8_feature_flags ORDER BY organization_id, module`,
      [],
      { fallback: false }
    );
  }

  return rows.map((r) => ({
    organizationId: r.organization_id,
    module: r.module,
    enabled: r.enabled === 1,
    updatedAt: r.updated_at,
  }));
}

export { V8_MODULES, type V8Module };
