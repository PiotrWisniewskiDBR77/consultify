/**
 * Consultify Document Studio — Brand Voice Profile Registry DAO (Epic E7, Slice 7.1).
 *
 * Mirrors the `documentSourcePackRegistryDao.ts` design contract:
 *
 *   - Acts as the persistence layer behind the in-process Map cache in
 *     `documentBrandVoiceService.ts`. The service public API stays
 *     synchronous; persistence is best-effort write-through.
 *   - Every operation is failure-tolerant: a missing migration, a DB
 *     outage, or any other error path resolves to `{ ok: false }` /
 *     `null` / `[]` and does NOT throw. The service falls back to the
 *     in-process Map when persistence is unavailable.
 *   - Reads (`loadBrandVoiceProfilesForOrg`, `loadAuditForProfile`)
 *     hydrate the cache lazily once per organization on cold start.
 *
 * Tenant safety: every query carries `organization_id` in the WHERE
 * clause; cross-tenant reads are deny-by-default.
 *
 * Storage backing (Epic E7, Slice 7.1): in-memory until the wave5
 * persistence migration ships in a follow-up slice. The service treats
 * the DAO as authoritative and writes through every state mutation, so
 * the Postgres swap is a mechanical replacement of the maps below
 * without changes to the public function signatures.
 */

import type { BrandVoiceProfile, BrandVoiceProfileAuditEntry } from './documentStudioTypes.js';

const profileStore = new Map<string, BrandVoiceProfile>();
const auditStore = new Map<string, BrandVoiceProfileAuditEntry[]>();

function key(organizationId: string, profileId: string): string {
  return `${organizationId}::${profileId}`;
}

function cloneProfile(profile: BrandVoiceProfile): BrandVoiceProfile {
  return {
    ...profile,
    bannedPhrases: [...profile.bannedPhrases],
    disabledGlobalBannedPhrases: [...profile.disabledGlobalBannedPhrases],
    preferredPhrases: [...profile.preferredPhrases],
    glossaryEntries: profile.glossaryEntries.map((entry) => ({ ...entry })),
    requiredKeywords: [...profile.requiredKeywords],
  };
}

/**
 * Load every profile visible to a tenant. Cross-tenant rows are filtered
 * by the key prefix. Resolves to `[]` on any failure path.
 */
export async function loadBrandVoiceProfilesForOrg(
  organizationId: string
): Promise<BrandVoiceProfile[]> {
  if (!organizationId) return [];
  const prefix = `${organizationId}::`;
  const out: BrandVoiceProfile[] = [];
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
export async function loadBrandVoiceProfileById(
  profileId: string,
  organizationId: string
): Promise<BrandVoiceProfile | null> {
  if (!profileId || !organizationId) return null;
  const profile = profileStore.get(key(organizationId, profileId));
  return profile ? cloneProfile(profile) : null;
}

/**
 * Upsert a profile. Best-effort; never throws. Returns `{ ok: false }` on
 * an empty input so the service can choose to degrade silently.
 */
export async function persistBrandVoiceProfile(
  profile: BrandVoiceProfile
): Promise<{ ok: boolean }> {
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
): Promise<BrandVoiceProfileAuditEntry[]> {
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
export async function persistBrandVoiceProfileAuditEntry(
  entry: BrandVoiceProfileAuditEntry
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
export async function __resetBrandVoiceRegistryDaoForTests(): Promise<void> {
  profileStore.clear();
  auditStore.clear();
}
