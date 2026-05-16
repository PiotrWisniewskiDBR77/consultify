/**
 * Consultify Document Studio — Audience Profile Registry DAO (Epic E9, Slice 9.2).
 *
 * Mirrors the `documentBrandVoiceRegistryDao.ts` design contract:
 *
 *   - Acts as the persistence layer behind the in-process Map cache in
 *     `documentAudienceProfileService.ts`. The service public API stays
 *     synchronous; persistence is best-effort write-through.
 *   - Every operation is failure-tolerant: a missing migration, a DB
 *     outage, or any other error path resolves to `{ ok: false }` /
 *     `null` / `[]` and does NOT throw. The service falls back to the
 *     in-process Map when persistence is unavailable.
 *   - Reads (`loadAudienceProfilesForOrg`, `loadAuditForProfile`)
 *     hydrate the cache lazily once per organization on cold start.
 *
 * Tenant safety: every query carries `organization_id` in the WHERE
 * clause; cross-tenant reads are deny-by-default. The four built-in
 * `'system'` audience seeds (Board / Client / Engineering / PMO) are
 * NOT stored here — they live in `documentAudienceProfileSeeds.ts`
 * and the service overlays them into list / get results so they survive
 * an empty registry on cold start.
 *
 * Storage backing (Slice 9.2): in-memory only; the wave5 persistence
 * migration ships in a follow-up. Public function signatures match the
 * Postgres-backed shape so the swap is mechanical.
 */

import type { AudienceProfile, AudienceProfileAuditEntry } from './documentStudioTypes.js';

const profileStore = new Map<string, AudienceProfile>();
const auditStore = new Map<string, AudienceProfileAuditEntry[]>();

function key(organizationId: string, profileId: string): string {
  return `${organizationId}::${profileId}`;
}

function cloneProfile(profile: AudienceProfile): AudienceProfile {
  return {
    ...profile,
    audienceLabels: [...profile.audienceLabels],
    sectionFilters: {
      include: profile.sectionFilters.include ? [...profile.sectionFilters.include] : undefined,
      exclude: profile.sectionFilters.exclude ? [...profile.sectionFilters.exclude] : undefined,
    },
    blockFilters: {
      include: profile.blockFilters.include ? [...profile.blockFilters.include] : undefined,
      exclude: profile.blockFilters.exclude ? [...profile.blockFilters.exclude] : undefined,
    },
  };
}

/**
 * Load every profile visible to a tenant. Cross-tenant rows are filtered
 * by the key prefix. Resolves to `[]` on any failure path.
 */
export async function loadAudienceProfilesForOrg(
  organizationId: string
): Promise<AudienceProfile[]> {
  if (!organizationId) return [];
  const prefix = `${organizationId}::`;
  const out: AudienceProfile[] = [];
  for (const [k, profile] of profileStore.entries()) {
    if (!k.startsWith(prefix)) continue;
    out.push(cloneProfile(profile));
  }
  return out;
}

/**
 * Single-profile lookup. Cross-tenant reads return `null` even when the
 * profile id exists under a different tenant.
 */
export async function loadAudienceProfileById(
  profileId: string,
  organizationId: string
): Promise<AudienceProfile | null> {
  if (!profileId || !organizationId) return null;
  const profile = profileStore.get(key(organizationId, profileId));
  return profile ? cloneProfile(profile) : null;
}

/**
 * Upsert a profile. Best-effort; never throws. Returns `{ ok: false }` on
 * an empty input so the service can choose to degrade silently.
 */
export async function persistAudienceProfile(profile: AudienceProfile): Promise<{ ok: boolean }> {
  if (!profile || !profile.profileId || !profile.organizationId) return { ok: false };
  profileStore.set(key(profile.organizationId, profile.profileId), cloneProfile(profile));
  return { ok: true };
}

/**
 * Load the full audit trail for a profile. Returns `[]` on any failure
 * or cross-tenant attempt.
 */
export async function loadAuditForProfile(
  profileId: string,
  organizationId: string
): Promise<AudienceProfileAuditEntry[]> {
  if (!profileId || !organizationId) return [];
  const entries = auditStore.get(key(organizationId, profileId));
  return entries
    ? entries.map((entry) => ({
        ...entry,
        details: entry.details ? { ...entry.details } : undefined,
      }))
    : [];
}

/**
 * Append a single audit entry. Idempotent on duplicate `auditId` — a
 * second persist with the same id replaces the previous row so retries
 * don't double-count.
 */
export async function persistAudienceProfileAuditEntry(
  entry: AudienceProfileAuditEntry
): Promise<{ ok: boolean }> {
  if (!entry || !entry.auditId || !entry.profileId || !entry.organizationId) {
    return { ok: false };
  }
  const k = key(entry.organizationId, entry.profileId);
  const current = auditStore.get(k) ?? [];
  const filtered = current.filter((existing) => existing.auditId !== entry.auditId);
  filtered.push({
    ...entry,
    details: entry.details ? { ...entry.details } : undefined,
  });
  auditStore.set(k, filtered);
  return { ok: true };
}

/** @internal Test-only reset of both in-memory stores. */
export async function __resetAudienceProfileRegistryDaoForTests(): Promise<void> {
  profileStore.clear();
  auditStore.clear();
}
