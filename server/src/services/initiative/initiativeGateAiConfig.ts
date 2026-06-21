/**
 * Initiative Gate AI — per-org rollout flag + threshold (M13 Depth · G1).
 *
 * SSOT spec: docs/product/INITIATIVE_GATE_AI_SPEC.md §0/§7.
 *
 * Rollout safety (mirrors v8 featureFlagService, but FAIL-SAFE OFF):
 *   - The feature is OFF for every org unless an explicit `enabled` row exists.
 *   - A missing table (migration not yet applied) → OFF. So shipping this code
 *     ahead of the migration changes nothing for live clients.
 *   - This guarantees VTS/Apator/Elkomtech see zero behavior change until the
 *     flag is deliberately switched on for a demo/internal org.
 */
import { DEFAULT_GATE_AI_THRESHOLD } from '../../constants/initiativeGateAi.js';
import { all as dbAll, run as dbRun, tableExists } from '../../utils/DbPromise.js';
import Logger from '../../utils/Logger.js';
import { flagOn } from '../../utils/pgFlags.js';

const LOG_PREFIX = '[initiative:gateAi]';
const FLAG_KEY = 'gate_ai';
const TABLE = 'initiative_feature_flags';
const CACHE_TTL_MS = 60_000;

interface GateAiConfig {
  enabled: boolean;
  threshold: number;
}

const cache = new Map<string, { value: GateAiConfig; expiresAt: number }>();

function getCached(orgId: string): GateAiConfig | null {
  const entry = cache.get(orgId);
  if (entry && entry.expiresAt > Date.now()) return entry.value;
  if (entry) cache.delete(orgId);
  return null;
}

function setCached(orgId: string, value: GateAiConfig): void {
  cache.set(orgId, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function clearGateAiConfigCache(orgId?: string): void {
  if (orgId) cache.delete(orgId);
  else cache.clear();
}

/** Read (enabled, threshold) for an org. Fail-safe OFF + default threshold. */
export async function getGateAiConfig(organizationId: string): Promise<GateAiConfig> {
  const orgId = String(organizationId || '').trim();
  if (!orgId) return { enabled: false, threshold: DEFAULT_GATE_AI_THRESHOLD };

  const cached = getCached(orgId);
  if (cached) return cached;

  let value: GateAiConfig = { enabled: false, threshold: DEFAULT_GATE_AI_THRESHOLD };
  try {
    const exists = await tableExists(TABLE);
    if (exists) {
      const rows = await dbAll<{ enabled: unknown; threshold: unknown }>(
        `SELECT enabled, threshold FROM ${TABLE} WHERE organization_id = $1 AND flag_key = $2 LIMIT 1`,
        [orgId, FLAG_KEY]
      );
      const row = rows[0];
      if (row) {
        const threshold = Number(row.threshold);
        value = {
          enabled: flagOn(row.enabled),
          threshold:
            Number.isFinite(threshold) && threshold > 0 ? threshold : DEFAULT_GATE_AI_THRESHOLD,
        };
      }
    }
  } catch (e: any) {
    // Fail-safe: any read error → feature OFF (never block a transition on a
    // flag-store hiccup). Not cached, so it self-heals on the next call.
    Logger.warn(`${LOG_PREFIX} config read failed, defaulting OFF:`, e?.message);
    return { enabled: false, threshold: DEFAULT_GATE_AI_THRESHOLD };
  }

  setCached(orgId, value);
  return value;
}

/** True only when the org has an explicit enabled flag row. */
export async function isInitiativeGateAiEnabled(organizationId: string): Promise<boolean> {
  return (await getGateAiConfig(organizationId)).enabled;
}

/** Resolve the per-org readiness threshold (default 75). */
export async function getGateAiThreshold(organizationId: string): Promise<number> {
  return (await getGateAiConfig(organizationId)).threshold;
}

/** Enable/disable + optionally set threshold for an org (admin/rollout op). */
export async function setInitiativeGateAiFlag(
  organizationId: string,
  enabled: boolean,
  opts?: { threshold?: number; updatedBy?: string }
): Promise<void> {
  const orgId = String(organizationId || '').trim();
  if (!orgId) throw new Error(`${LOG_PREFIX} organizationId required`);

  const exists = await tableExists(TABLE);
  if (!exists) {
    throw new Error(`${LOG_PREFIX} ${TABLE} table missing — run the gate-ai migration first.`);
  }

  const threshold =
    opts?.threshold && Number.isFinite(opts.threshold) && opts.threshold > 0
      ? Math.round(opts.threshold)
      : DEFAULT_GATE_AI_THRESHOLD;

  await dbRun(
    `INSERT INTO ${TABLE} (organization_id, flag_key, enabled, threshold, updated_at, updated_by)
       VALUES ($1, $2, $3, $4, NOW(), $5)
     ON CONFLICT (organization_id, flag_key)
       DO UPDATE SET enabled = $3, threshold = $4, updated_at = NOW(), updated_by = $5`,
    [orgId, FLAG_KEY, enabled ? 1 : 0, threshold, opts?.updatedBy || null]
  );

  clearGateAiConfigCache(orgId);
  Logger.info(
    `${LOG_PREFIX} flag ${FLAG_KEY} set enabled=${enabled} threshold=${threshold} for ${orgId}`
  );
}
