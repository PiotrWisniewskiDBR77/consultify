/**
 * Consultify Document Studio — Audience Profile Registry DAO
 * (Epic E9, Slice 9.2 → wave5 layer-2 persistence).
 *
 * Postgres-backed persistence layer behind the in-process Map cache in
 * `documentAudienceProfileService.ts`. Mirrors `documentApprovalRegistryDao.ts`:
 *
 *   - Best-effort write-through: every operation resolves to `{ ok: false }` /
 *     `null` / `[]` on any error and does NOT throw — the service falls back
 *     to its in-process Map cache when persistence is unavailable.
 *   - Reads (`loadAudienceProfilesForOrg`, `loadAudienceProfileById`,
 *     `loadAuditForProfile`) hydrate the cache lazily once per organization
 *     on cold start.
 *   - Tenant safety: every query carries `organization_id` in the WHERE
 *     clause; cross-tenant reads are deny-by-default. The four built-in
 *     `'system'` audience seeds are NOT stored here — they live in
 *     `documentAudienceProfileSeeds.ts` and the service overlays them into
 *     list / get results.
 *
 * Storage backing: tables `document_audience_profiles` +
 * `document_audience_audit` (migration 781). The canonical object (incl.
 * nested audienceLabels[]/sectionFilters/blockFilters) is stored in
 * `payload_json`; scalar columns mirror the fields used for WHERE/ordering.
 */

import { all as dbAll, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import type { AudienceProfile, AudienceProfileAuditEntry } from './documentStudioTypes.js';

interface ProfileRow {
  profile_id: string;
  payload_json: unknown;
}

interface AuditRow {
  audit_id: string;
  payload_json: unknown;
}

function parseJson<T>(raw: unknown, fallback: T): T {
  if (raw == null) return fallback;
  if (typeof raw === 'object') return raw as T;
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    return fallback;
  }
}

function rowToProfile(row: ProfileRow): AudienceProfile | null {
  const profile = parseJson<AudienceProfile | null>(row.payload_json, null);
  if (!profile || !profile.profileId) return null;
  // Defensive: ensure nested array/object shapes survive a malformed payload.
  profile.audienceLabels = Array.isArray(profile.audienceLabels) ? profile.audienceLabels : [];
  profile.sectionFilters = profile.sectionFilters ?? {};
  profile.blockFilters = profile.blockFilters ?? {};
  return profile;
}

function rowToAudit(row: AuditRow): AudienceProfileAuditEntry | null {
  const entry = parseJson<AudienceProfileAuditEntry | null>(row.payload_json, null);
  if (!entry || !entry.auditId) return null;
  return entry;
}

/**
 * Load every profile visible to a tenant. Resolves to `[]` on any failure
 * so the service degrades to its in-process Map.
 */
export async function loadAudienceProfilesForOrg(
  organizationId: string
): Promise<AudienceProfile[]> {
  if (!organizationId) return [];
  try {
    const rows = await dbAll<ProfileRow>(
      `SELECT profile_id, payload_json FROM document_audience_profiles
         WHERE organization_id = $1
         ORDER BY created_at ASC`,
      [organizationId]
    );
    if (!Array.isArray(rows) || rows.length === 0) return [];
    return rows.map(rowToProfile).filter((p): p is AudienceProfile => p !== null);
  } catch (err) {
    logger.warn('[DocumentStudio][AudienceDao] loadAudienceProfilesForOrg failed', {
      organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/**
 * Single-profile lookup. Cross-tenant reads return `null` even when the
 * profile id exists under a different tenant (organization_id in WHERE).
 */
export async function loadAudienceProfileById(
  profileId: string,
  organizationId: string
): Promise<AudienceProfile | null> {
  if (!profileId || !organizationId) return null;
  try {
    const rows = await dbAll<ProfileRow>(
      `SELECT profile_id, payload_json FROM document_audience_profiles
         WHERE profile_id = $1 AND organization_id = $2
         LIMIT 1`,
      [profileId, organizationId]
    );
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return rowToProfile(rows[0]);
  } catch (err) {
    logger.warn('[DocumentStudio][AudienceDao] loadAudienceProfileById failed', {
      profileId,
      organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Upsert a profile. Best-effort; never throws. Profiles mutate (status/version
 * change) so this is ON CONFLICT DO UPDATE, not DO NOTHING.
 */
export async function persistAudienceProfile(profile: AudienceProfile): Promise<{ ok: boolean }> {
  if (!profile || !profile.profileId || !profile.organizationId) return { ok: false };
  try {
    const result = await dbRun(
      `INSERT INTO document_audience_profiles (
         profile_id, organization_id, status, created_at, updated_at, payload_json
       ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       ON CONFLICT (profile_id) DO UPDATE SET
         organization_id = EXCLUDED.organization_id,
         status = EXCLUDED.status,
         created_at = EXCLUDED.created_at,
         updated_at = EXCLUDED.updated_at,
         payload_json = EXCLUDED.payload_json`,
      [
        profile.profileId,
        profile.organizationId,
        profile.status ?? null,
        profile.createdAt ?? null,
        profile.updatedAt ?? null,
        JSON.stringify(profile),
      ]
    );
    return { ok: result.success === true };
  } catch (err) {
    logger.warn('[DocumentStudio][AudienceDao] persistAudienceProfile failed', {
      profileId: profile.profileId,
      organizationId: profile.organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return { ok: false };
  }
}

/**
 * Load the full audit trail for a profile, oldest-first. Returns `[]` on any
 * failure or cross-tenant attempt.
 */
export async function loadAuditForProfile(
  profileId: string,
  organizationId: string
): Promise<AudienceProfileAuditEntry[]> {
  if (!profileId || !organizationId) return [];
  try {
    const rows = await dbAll<AuditRow>(
      `SELECT audit_id, payload_json FROM document_audience_audit
         WHERE profile_id = $1 AND organization_id = $2
         ORDER BY occurred_at ASC`,
      [profileId, organizationId]
    );
    if (!Array.isArray(rows) || rows.length === 0) return [];
    return rows.map(rowToAudit).filter((e): e is AudienceProfileAuditEntry => e !== null);
  } catch (err) {
    logger.warn('[DocumentStudio][AudienceDao] loadAuditForProfile failed', {
      profileId,
      organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/**
 * Append/replace a single audit entry. Idempotent on duplicate `auditId`
 * (ON CONFLICT DO UPDATE) so retries don't double-count.
 */
export async function persistAudienceProfileAuditEntry(
  entry: AudienceProfileAuditEntry
): Promise<{ ok: boolean }> {
  if (!entry || !entry.auditId || !entry.profileId || !entry.organizationId) {
    return { ok: false };
  }
  try {
    const result = await dbRun(
      `INSERT INTO document_audience_audit (
         audit_id, profile_id, organization_id, action, actor_id,
         occurred_at, payload_json
       ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
       ON CONFLICT (audit_id) DO UPDATE SET
         profile_id = EXCLUDED.profile_id,
         organization_id = EXCLUDED.organization_id,
         action = EXCLUDED.action,
         actor_id = EXCLUDED.actor_id,
         occurred_at = EXCLUDED.occurred_at,
         payload_json = EXCLUDED.payload_json`,
      [
        entry.auditId,
        entry.profileId,
        entry.organizationId,
        entry.action ?? null,
        entry.actorId ?? null,
        entry.occurredAt ?? null,
        JSON.stringify(entry),
      ]
    );
    return { ok: result.success === true };
  } catch (err) {
    logger.warn('[DocumentStudio][AudienceDao] persistAudienceProfileAuditEntry failed', {
      auditId: entry.auditId,
      organizationId: entry.organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return { ok: false };
  }
}

/** @internal Test-only reset — best-effort DELETE of both tables. */
export async function __resetAudienceProfileRegistryDaoForTests(): Promise<void> {
  try {
    await dbRun('DELETE FROM document_audience_audit', []);
    await dbRun('DELETE FROM document_audience_profiles', []);
  } catch {
    /* best-effort: table may not exist in a unit-test sandbox */
  }
}
