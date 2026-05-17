/**
 * Consultify Document Studio — Brand Voice Profile Service (Epic E7, Slice 7.1).
 *
 * Brand Voice Profiles let each tenant ship its own lexicon on top of the
 * global banned-phrase catalogue baked into `documentQaService.runBrandQa`:
 *
 *   - banned phrases (additive)        e.g. competitor names, deprecated brand
 *   - disabled global banned phrases   tenant escape-hatch
 *   - preferred phrases                soft scoring of tenant vocabulary
 *   - glossary entries                 directed (avoid → prefer) suggestions
 *   - required keywords                must-appear terms (e.g. legal name)
 *   - register override                pin documents to a stricter register
 *   - language scope                   pl / en / all
 *
 * Lifecycle: draft → active → archived. At most one ACTIVE profile per
 * organization at any moment in time. Activating a draft auto-archives
 * the previous active row and records a `profile_superseded` audit
 * entry on the outgoing profile so the takeover is auditable from
 * either side.
 *
 * Design contract (mirrors `documentSourcePackService.ts` /
 * `documentTemplateService.ts`):
 *
 *   - The in-process `Map<key, BrandVoiceProfile>` is the synchronous
 *     source of truth. Persistence is best-effort write-through to the
 *     DAO and lazy hydration on the first read per organization.
 *   - The public surface stays synchronous-friendly: every mutation is
 *     a synchronous function that records audit + writes through to
 *     the DAO via `void persistX().catch(...)` so the caller never has
 *     to await persistence.
 *   - `ensureBrandVoiceRegistryHydrated(organizationId)` is awaited by
 *     the route layer before reads so a cold-start process serves the
 *     persisted catalogue rather than an empty cache.
 *
 * Tenant boundary: every operation accepts and validates
 * `organizationId`; cross-tenant reads return `null` /
 * `'profile_not_found'` deny-by-default.
 */

import {
  __resetBrandVoiceRegistryDaoForTests,
  loadAuditForProfile,
  loadBrandVoiceProfileById,
  loadBrandVoiceProfilesForOrg,
  persistBrandVoiceProfile,
  persistBrandVoiceProfileAuditEntry,
} from './documentBrandVoiceRegistryDao.js';
import type {
  BrandVoiceGlossaryEntry,
  BrandVoiceProfile,
  BrandVoiceProfileAuditAction,
  BrandVoiceProfileAuditEntry,
  BrandVoiceProfileDraftInput,
  BrandVoiceProfileLanguageScope,
  BrandVoiceProfileStatus,
  BrandVoiceProfileUpdateInput,
  CommunicationRegister,
} from './documentStudioTypes.js';

// =============================================================================
// Errors
// =============================================================================

export type BrandVoiceProfileErrorCode =
  | 'invalid_input'
  | 'profile_not_found'
  | 'profile_archived'
  | 'profile_already_active'
  | 'profile_already_archived'
  | 'forbidden';

export class BrandVoiceProfileError extends Error {
  readonly code: BrandVoiceProfileErrorCode;
  constructor(code: BrandVoiceProfileErrorCode, message: string) {
    super(message);
    this.name = 'BrandVoiceProfileError';
    this.code = code;
  }
}

// =============================================================================
// In-process registry + write-through
// =============================================================================

const registryStore = new Map<string, BrandVoiceProfile>();
const auditStore = new Map<string, BrandVoiceProfileAuditEntry[]>();
const hydratedOrgs = new Set<string>();
const hydrationInflight = new Map<string, Promise<void>>();

function profileKey(organizationId: string, profileId: string): string {
  return `${organizationId}::${profileId}`;
}

function makeId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${random}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function clone(profile: BrandVoiceProfile): BrandVoiceProfile {
  return {
    ...profile,
    bannedPhrases: [...profile.bannedPhrases],
    disabledGlobalBannedPhrases: [...profile.disabledGlobalBannedPhrases],
    preferredPhrases: [...profile.preferredPhrases],
    glossaryEntries: profile.glossaryEntries.map((entry) => ({ ...entry })),
    requiredKeywords: [...profile.requiredKeywords],
  };
}

function pushAudit(entry: BrandVoiceProfileAuditEntry): void {
  const key = profileKey(entry.organizationId, entry.profileId);
  const current = auditStore.get(key) ?? [];
  current.push(entry);
  auditStore.set(key, current);
  void persistBrandVoiceProfileAuditEntry(entry).catch(() => undefined);
}

function recordMutation(
  profileId: string,
  organizationId: string,
  action: BrandVoiceProfileAuditAction,
  actorId: string,
  details?: Record<string, unknown>
): void {
  pushAudit({
    auditId: makeId('brand-voice-audit'),
    profileId,
    organizationId,
    action,
    actorId,
    occurredAt: nowIso(),
    details,
  });
}

async function ensureHydrated(organizationId: string): Promise<void> {
  if (hydratedOrgs.has(organizationId)) return;
  const inflight = hydrationInflight.get(organizationId);
  if (inflight) return inflight;
  const promise = (async () => {
    try {
      const tenantProfiles = await loadBrandVoiceProfilesForOrg(organizationId);
      for (const profile of tenantProfiles) {
        registryStore.set(profileKey(profile.organizationId, profile.profileId), profile);
        const audit = await loadAuditForProfile(profile.profileId, profile.organizationId);
        if (audit.length > 0) {
          auditStore.set(profileKey(profile.organizationId, profile.profileId), audit);
        }
      }
    } catch {
      // Persistence offline → cache stays empty; subsequent writes still
      // attempt write-through and the in-process state remains operational.
    }
    hydratedOrgs.add(organizationId);
  })();
  hydrationInflight.set(organizationId, promise);
  try {
    await promise;
  } finally {
    hydrationInflight.delete(organizationId);
  }
}

/**
 * Public hydration trigger used by route handlers before list/get/audit
 * reads so a cold-start process always serves the persisted catalogue.
 * Idempotent per organization; subsequent calls are no-ops.
 */
export async function ensureBrandVoiceRegistryHydrated(organizationId: string): Promise<void> {
  return ensureHydrated(organizationId);
}

// =============================================================================
// Input validation helpers
// =============================================================================

const VALID_LANGUAGE_SCOPES: ReadonlySet<BrandVoiceProfileLanguageScope> = new Set([
  'pl',
  'en',
  'all',
]);

const VALID_REGISTERS: ReadonlySet<CommunicationRegister> = new Set([
  'executive',
  'professional',
  'narrative',
]);

function normalizePhraseList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (trimmed.length === 0) continue;
    const dedupKey = trimmed.toLowerCase();
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);
    out.push(trimmed);
  }
  return out;
}

function normalizeGlossaryEntries(input: unknown): BrandVoiceGlossaryEntry[] {
  if (!Array.isArray(input)) return [];
  const out: BrandVoiceGlossaryEntry[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const candidate = raw as Partial<BrandVoiceGlossaryEntry>;
    const avoid = typeof candidate.avoid === 'string' ? candidate.avoid.trim() : '';
    const prefer = typeof candidate.prefer === 'string' ? candidate.prefer.trim() : '';
    if (!avoid || !prefer) continue;
    const dedupKey = `${avoid.toLowerCase()}::${prefer.toLowerCase()}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);
    const note = typeof candidate.note === 'string' ? candidate.note.trim() : '';
    out.push({ avoid, prefer, note: note.length > 0 ? note : undefined });
  }
  return out;
}

function bumpVersion(current: string): string {
  const num = Number.parseInt(current.replace(/^v/i, ''), 10);
  if (Number.isFinite(num) && num >= 0) return `v${num + 1}`;
  return 'v1';
}

// =============================================================================
// Draft / update / activate / archive
// =============================================================================

export interface DraftBrandVoiceProfileParams {
  organizationId: string;
  userId: string;
  input: BrandVoiceProfileDraftInput;
}

export function draftBrandVoiceProfile(params: DraftBrandVoiceProfileParams): BrandVoiceProfile {
  if (!params.organizationId) {
    throw new BrandVoiceProfileError('invalid_input', 'organizationId is required');
  }
  if (!params.userId) {
    throw new BrandVoiceProfileError('invalid_input', 'userId is required');
  }
  if (!params.input || !params.input.name || params.input.name.trim().length === 0) {
    throw new BrandVoiceProfileError('invalid_input', 'profile name is required');
  }
  const languageScope: BrandVoiceProfileLanguageScope =
    params.input.languageScope && VALID_LANGUAGE_SCOPES.has(params.input.languageScope)
      ? params.input.languageScope
      : 'all';
  if (
    params.input.registerOverride !== undefined &&
    params.input.registerOverride !== null &&
    !VALID_REGISTERS.has(params.input.registerOverride)
  ) {
    throw new BrandVoiceProfileError(
      'invalid_input',
      `unsupported registerOverride: ${params.input.registerOverride}`
    );
  }

  const now = nowIso();
  const profile: BrandVoiceProfile = {
    profileId: makeId('brand-voice'),
    organizationId: params.organizationId,
    name: params.input.name.trim(),
    description: params.input.description?.trim() || undefined,
    status: 'draft',
    version: 'v1',
    languageScope,
    bannedPhrases: normalizePhraseList(params.input.bannedPhrases),
    disabledGlobalBannedPhrases: normalizePhraseList(params.input.disabledGlobalBannedPhrases),
    preferredPhrases: normalizePhraseList(params.input.preferredPhrases),
    glossaryEntries: normalizeGlossaryEntries(params.input.glossaryEntries),
    requiredKeywords: normalizePhraseList(params.input.requiredKeywords),
    registerOverride: params.input.registerOverride ?? undefined,
    notes: params.input.notes?.trim() || undefined,
    createdBy: params.userId,
    createdAt: now,
    updatedAt: now,
  };

  registryStore.set(profileKey(params.organizationId, profile.profileId), profile);
  void persistBrandVoiceProfile(profile).catch(() => undefined);

  recordMutation(profile.profileId, profile.organizationId, 'profile_drafted', params.userId, {
    name: profile.name,
    languageScope: profile.languageScope,
    bannedPhraseCount: profile.bannedPhrases.length,
    glossaryEntryCount: profile.glossaryEntries.length,
    requiredKeywordCount: profile.requiredKeywords.length,
  });

  return clone(profile);
}

export interface UpdateBrandVoiceProfileParams {
  organizationId: string;
  userId: string;
  profileId: string;
  input: BrandVoiceProfileUpdateInput;
}

/**
 * Mutate any field of a draft OR active profile. Archived profiles are
 * immutable. Bumps the `version` string on every successful update so
 * downstream consumers can detect lexicon churn.
 */
export function updateBrandVoiceProfile(params: UpdateBrandVoiceProfileParams): BrandVoiceProfile {
  if (!params.organizationId) {
    throw new BrandVoiceProfileError('invalid_input', 'organizationId is required');
  }
  if (!params.userId) {
    throw new BrandVoiceProfileError('invalid_input', 'userId is required');
  }
  const existing = registryStore.get(profileKey(params.organizationId, params.profileId));
  if (!existing) {
    throw new BrandVoiceProfileError(
      'profile_not_found',
      `brand voice profile not found: ${params.profileId}`
    );
  }
  if (existing.status === 'archived') {
    throw new BrandVoiceProfileError(
      'profile_archived',
      `brand voice profile is archived: ${params.profileId}`
    );
  }
  if (
    params.input.registerOverride !== undefined &&
    params.input.registerOverride !== null &&
    !VALID_REGISTERS.has(params.input.registerOverride)
  ) {
    throw new BrandVoiceProfileError(
      'invalid_input',
      `unsupported registerOverride: ${params.input.registerOverride}`
    );
  }

  const now = nowIso();
  const next: BrandVoiceProfile = {
    ...existing,
    name:
      params.input.name !== undefined && params.input.name.trim().length > 0
        ? params.input.name.trim()
        : existing.name,
    description:
      params.input.description !== undefined
        ? params.input.description.trim() || undefined
        : existing.description,
    languageScope:
      params.input.languageScope && VALID_LANGUAGE_SCOPES.has(params.input.languageScope)
        ? params.input.languageScope
        : existing.languageScope,
    bannedPhrases:
      params.input.bannedPhrases !== undefined
        ? normalizePhraseList(params.input.bannedPhrases)
        : existing.bannedPhrases,
    disabledGlobalBannedPhrases:
      params.input.disabledGlobalBannedPhrases !== undefined
        ? normalizePhraseList(params.input.disabledGlobalBannedPhrases)
        : existing.disabledGlobalBannedPhrases,
    preferredPhrases:
      params.input.preferredPhrases !== undefined
        ? normalizePhraseList(params.input.preferredPhrases)
        : existing.preferredPhrases,
    glossaryEntries:
      params.input.glossaryEntries !== undefined
        ? normalizeGlossaryEntries(params.input.glossaryEntries)
        : existing.glossaryEntries,
    requiredKeywords:
      params.input.requiredKeywords !== undefined
        ? normalizePhraseList(params.input.requiredKeywords)
        : existing.requiredKeywords,
    registerOverride:
      params.input.registerOverride === null
        ? undefined
        : params.input.registerOverride !== undefined
          ? params.input.registerOverride
          : existing.registerOverride,
    notes:
      params.input.notes === null
        ? undefined
        : params.input.notes !== undefined
          ? params.input.notes.trim() || undefined
          : existing.notes,
    version: bumpVersion(existing.version),
    updatedAt: now,
  };

  registryStore.set(profileKey(params.organizationId, next.profileId), next);
  void persistBrandVoiceProfile(next).catch(() => undefined);

  recordMutation(next.profileId, next.organizationId, 'profile_updated', params.userId, {
    fromVersion: existing.version,
    toVersion: next.version,
  });

  return clone(next);
}

export interface ActivateBrandVoiceProfileParams {
  organizationId: string;
  userId: string;
  profileId: string;
}

/**
 * Promote a profile to `active`. At most one active profile per tenant —
 * activating a new profile auto-archives the previous active row and
 * stamps a `profile_superseded` audit entry on it. Idempotent: re-
 * activating an already-active profile throws `profile_already_active`
 * so accidental UI double-clicks are caught.
 */
export function activateBrandVoiceProfile(
  params: ActivateBrandVoiceProfileParams
): BrandVoiceProfile {
  if (!params.organizationId) {
    throw new BrandVoiceProfileError('invalid_input', 'organizationId is required');
  }
  if (!params.userId) {
    throw new BrandVoiceProfileError('invalid_input', 'userId is required');
  }
  const target = registryStore.get(profileKey(params.organizationId, params.profileId));
  if (!target) {
    throw new BrandVoiceProfileError(
      'profile_not_found',
      `brand voice profile not found: ${params.profileId}`
    );
  }
  if (target.status === 'archived') {
    throw new BrandVoiceProfileError(
      'profile_archived',
      `cannot activate an archived profile: ${params.profileId}`
    );
  }
  if (target.status === 'active') {
    throw new BrandVoiceProfileError(
      'profile_already_active',
      `profile is already active: ${params.profileId}`
    );
  }

  const now = nowIso();
  const previousActive = findActiveProfileSync(params.organizationId);
  if (previousActive) {
    const supersededNext: BrandVoiceProfile = {
      ...previousActive,
      status: 'archived',
      archivedBy: params.userId,
      archivedAt: now,
      updatedAt: now,
    };
    registryStore.set(
      profileKey(supersededNext.organizationId, supersededNext.profileId),
      supersededNext
    );
    void persistBrandVoiceProfile(supersededNext).catch(() => undefined);
    recordMutation(
      supersededNext.profileId,
      supersededNext.organizationId,
      'profile_superseded',
      params.userId,
      { supersededBy: target.profileId }
    );
  }

  const next: BrandVoiceProfile = {
    ...target,
    status: 'active',
    activatedBy: params.userId,
    activatedAt: now,
    updatedAt: now,
  };
  registryStore.set(profileKey(next.organizationId, next.profileId), next);
  void persistBrandVoiceProfile(next).catch(() => undefined);

  recordMutation(next.profileId, next.organizationId, 'profile_activated', params.userId, {
    supersededProfileId: previousActive?.profileId,
    version: next.version,
  });

  return clone(next);
}

export interface ArchiveBrandVoiceProfileParams {
  organizationId: string;
  userId: string;
  profileId: string;
  reason?: string;
}

export function archiveBrandVoiceProfile(
  params: ArchiveBrandVoiceProfileParams
): BrandVoiceProfile {
  if (!params.organizationId) {
    throw new BrandVoiceProfileError('invalid_input', 'organizationId is required');
  }
  if (!params.userId) {
    throw new BrandVoiceProfileError('invalid_input', 'userId is required');
  }
  const target = registryStore.get(profileKey(params.organizationId, params.profileId));
  if (!target) {
    throw new BrandVoiceProfileError(
      'profile_not_found',
      `brand voice profile not found: ${params.profileId}`
    );
  }
  if (target.status === 'archived') {
    throw new BrandVoiceProfileError(
      'profile_already_archived',
      `profile is already archived: ${params.profileId}`
    );
  }

  const now = nowIso();
  const next: BrandVoiceProfile = {
    ...target,
    status: 'archived',
    archivedBy: params.userId,
    archivedAt: now,
    updatedAt: now,
  };
  registryStore.set(profileKey(next.organizationId, next.profileId), next);
  void persistBrandVoiceProfile(next).catch(() => undefined);

  recordMutation(next.profileId, next.organizationId, 'profile_archived', params.userId, {
    reason: params.reason?.trim() || undefined,
    fromStatus: target.status,
  });

  return clone(next);
}

// =============================================================================
// Reads
// =============================================================================

function findActiveProfileSync(organizationId: string): BrandVoiceProfile | null {
  const prefix = `${organizationId}::`;
  for (const [key, profile] of registryStore.entries()) {
    if (!key.startsWith(prefix)) continue;
    if (profile.status === 'active') return profile;
  }
  return null;
}

export function getBrandVoiceProfile(
  profileId: string,
  organizationId: string
): BrandVoiceProfile | null {
  if (!profileId || !organizationId) return null;
  const profile = registryStore.get(profileKey(organizationId, profileId));
  return profile ? clone(profile) : null;
}

export interface ListBrandVoiceProfilesOptions {
  status?: BrandVoiceProfileStatus;
  /** When true (default false), include archived profiles in the result. */
  includeArchived?: boolean;
}

export function listBrandVoiceProfiles(
  organizationId: string,
  options: ListBrandVoiceProfilesOptions = {}
): BrandVoiceProfile[] {
  if (!organizationId) return [];
  const prefix = `${organizationId}::`;
  const out: BrandVoiceProfile[] = [];
  for (const [key, profile] of registryStore.entries()) {
    if (!key.startsWith(prefix)) continue;
    if (options.status && profile.status !== options.status) continue;
    if (!options.includeArchived && !options.status && profile.status === 'archived') continue;
    out.push(clone(profile));
  }
  return out.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
}

/**
 * Resolve the single active profile for a tenant. Returns `null` when
 * the tenant has not activated any profile yet — callers fall back to
 * the global brand-voice catalogue baked into `documentQaService`.
 */
export function getActiveBrandVoiceProfile(organizationId: string): BrandVoiceProfile | null {
  if (!organizationId) return null;
  const active = findActiveProfileSync(organizationId);
  return active ? clone(active) : null;
}

export function listBrandVoiceProfileAuditEntries(
  profileId: string,
  organizationId: string
): BrandVoiceProfileAuditEntry[] {
  if (!profileId || !organizationId) return [];
  const entries = auditStore.get(profileKey(organizationId, profileId));
  return entries
    ? entries.map((entry) => ({
        ...entry,
        details: entry.details ? { ...entry.details } : undefined,
      }))
    : [];
}

// =============================================================================
// Test-only helpers
// =============================================================================

/** @internal */
export function __resetBrandVoiceServiceForTests(): void {
  registryStore.clear();
  auditStore.clear();
  hydratedOrgs.clear();
  hydrationInflight.clear();
}

/** @internal */
export async function __resetBrandVoiceServiceAndPersistenceForTests(): Promise<void> {
  __resetBrandVoiceServiceForTests();
  await __resetBrandVoiceRegistryDaoForTests();
}

/** @internal */
export async function __loadBrandVoiceProfileByIdForTests(
  profileId: string,
  organizationId: string
): Promise<BrandVoiceProfile | null> {
  return loadBrandVoiceProfileById(profileId, organizationId);
}
