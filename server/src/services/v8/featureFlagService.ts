import { z } from 'zod';

import { featureFlags } from '../../config/FeatureFlags.js';
import { get as dbGet, all as dbAll, run as dbRun, tableExists } from '../../utils/DbPromise.js';
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

const OrgIdSchema = z.string().uuid();
const ModuleSchema = z.enum(V8_MODULES);

// ---------------------------------------------------------------------------
// In-memory cache with TTL
// ---------------------------------------------------------------------------

const flagCache = new Map<string, { flags: Record<string, boolean>; expiresAt: number }>();
const CACHE_TTL_MS = 60_000;

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
  OrgIdSchema.parse(organizationId);

  if (!featureFlags.ENABLE_V8_GLOBAL) return false;

  const hasTable = await flagTableExists();
  if (!hasTable) return false;

  const flags = await getV8Flags(organizationId);

  if (module) {
    return flags[module] === true;
  }

  return Object.values(flags).some((v) => v === true);
}

export async function getV8Flags(organizationId: string): Promise<Record<string, boolean>> {
  OrgIdSchema.parse(organizationId);

  const cached = getCached(organizationId);
  if (cached) return cached;

  const hasTable = await flagTableExists();
  if (!hasTable) return {};

  const rows = await dbAll<{ module: string; enabled: number }>(
    `SELECT module, enabled FROM v8.v8_feature_flags WHERE organization_id = $1`,
    [organizationId],
  );

  const flags: Record<string, boolean> = {};
  for (const row of rows) {
    flags[row.module] = row.enabled === 1;
  }

  setCache(organizationId, flags);
  return flags;
}

export async function setV8OrgFlag(
  organizationId: string,
  module: string,
  enabled: boolean,
  updatedBy?: string,
): Promise<void> {
  OrgIdSchema.parse(organizationId);
  ModuleSchema.parse(module);

  const hasTable = await flagTableExists();
  if (!hasTable) {
    throw new Error(`${LOG_PREFIX} v8_feature_flags table does not exist. Run V8 migrations first.`);
  }

  const now = new Date().toISOString();
  const flagId = `${organizationId}:${module}`;

  await dbRun(
    `INSERT INTO v8.v8_feature_flags (flag_id, organization_id, module, enabled, updated_at, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (organization_id, module)
     DO UPDATE SET enabled = $4, updated_at = $5, updated_by = $6`,
    [flagId, organizationId, module, enabled ? 1 : 0, now, updatedBy || null],
  );

  clearFlagCache(organizationId);
  Logger.info(`${LOG_PREFIX} Flag ${module} set to ${enabled} for org ${organizationId}`);
}

export async function isV8ShadowMode(organizationId: string): Promise<boolean> {
  OrgIdSchema.parse(organizationId);

  if (!featureFlags.ENABLE_V8_SHADOW_MODE) return false;

  const hasTable = await flagTableExists();
  if (!hasTable) return false;

  const row = await dbGet<{ enabled: number }>(
    `SELECT enabled FROM v8.v8_feature_flags WHERE organization_id = $1 AND module = 'shadow_mode'`,
    [organizationId],
  );

  return row?.enabled === 1;
}

export async function getAllOrgFlags(): Promise<
  Array<{ organizationId: string; module: string; enabled: boolean; updatedAt: string }>
> {
  const hasTable = await flagTableExists();
  if (!hasTable) return [];

  const rows = await dbAll<{
    organization_id: string;
    module: string;
    enabled: number;
    updated_at: string;
  }>(`SELECT organization_id, module, enabled, updated_at FROM v8.v8_feature_flags ORDER BY organization_id, module`);

  return rows.map((r) => ({
    organizationId: r.organization_id,
    module: r.module,
    enabled: r.enabled === 1,
    updatedAt: r.updated_at,
  }));
}

export { V8_MODULES, type V8Module };
