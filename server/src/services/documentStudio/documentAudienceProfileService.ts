/**
 * Consultify Document Studio — Audience Profile Service (Epic E9, Slice 9.2).
 *
 * Audience Profiles let each tenant maintain a catalogue of audience-driven
 * variants the projector uses to derive board / client / engineering / pmo
 * (or fully custom) renditions of the same source DocumentSchema. The
 * projector itself is `documentAudienceProjector.ts`; this service owns
 * the catalogue and lifecycle.
 *
 * Differences from `documentBrandVoiceService.ts` (the closest sibling):
 *
 *   - MULTIPLE active profiles per organization. Brand Voice has at most
 *     one active profile because it controls Brand QA scoring; Audience
 *     Profiles describe orthogonal output renditions (board / client /
 *     engineering / pmo) and a tenant may have several active variants
 *     at once.
 *   - SYSTEM seeds. The four `'system'`-org default profiles
 *     (`SYSTEM_AUDIENCE_PROFILES`) are exposed in every list / get
 *     response without persisting them — they are immutable, queryable,
 *     and can be projected against any tenant's documents.
 *
 * Lifecycle (tenant profiles only): draft → active → archived. Archived
 * profiles are immutable but stay queryable for audit. Activating a
 * draft does NOT auto-archive other actives.
 *
 * Design contract (mirrors `documentBrandVoiceService.ts`):
 *
 *   - The in-process `Map<key, AudienceProfile>` is the synchronous
 *     source of truth. Persistence is best-effort write-through to the
 *     DAO and lazy hydration on the first read per organization.
 *   - The public surface stays synchronous-friendly: every mutation is
 *     a synchronous function that records audit + writes through to
 *     the DAO via `void persistX().catch(...)` so the caller never has
 *     to await persistence.
 *   - `ensureAudienceProfileRegistryHydrated(organizationId)` is awaited
 *     by the route layer before reads so a cold-start process serves the
 *     persisted catalogue rather than an empty cache.
 *
 * Tenant boundary: every operation accepts and validates
 * `organizationId`; cross-tenant reads return `null` /
 * `'profile_not_found'` deny-by-default. The four `'system'` seeds are
 * the single exception — they are visible to every tenant for read /
 * project but never mutable.
 */

import {
  __resetAudienceProfileRegistryDaoForTests,
  loadAudienceProfileById,
  loadAudienceProfilesForOrg,
  loadAuditForProfile,
  persistAudienceProfile,
  persistAudienceProfileAuditEntry,
} from './documentAudienceProfileRegistryDao.js';
import {
  getSystemAudienceProfile,
  isSystemAudienceProfileId,
  SYSTEM_AUDIENCE_PROFILES,
} from './documentAudienceProfileSeeds.js';
import type {
  AudienceProfile,
  AudienceProfileAppendixPolicy,
  AudienceProfileAuditAction,
  AudienceProfileAuditEntry,
  AudienceProfileDraftInput,
  AudienceProfileExecutiveSummaryPolicy,
  AudienceProfileJargonPolicy,
  AudienceProfileStatus,
  AudienceProfileTagFilter,
  AudienceProfileUpdateInput,
  CommunicationRegister,
  DocumentDensity,
  DocumentLanguageStyle,
} from './documentStudioTypes.js';

// =============================================================================
// Errors
// =============================================================================

export type AudienceProfileErrorCode =
  | 'invalid_input'
  | 'profile_not_found'
  | 'profile_archived'
  | 'profile_already_active'
  | 'profile_already_archived'
  | 'system_profile_immutable'
  | 'forbidden';

export class AudienceProfileError extends Error {
  readonly code: AudienceProfileErrorCode;
  constructor(code: AudienceProfileErrorCode, message: string) {
    super(message);
    this.name = 'AudienceProfileError';
    this.code = code;
  }
}

// =============================================================================
// In-process registry + write-through
// =============================================================================

const registryStore = new Map<string, AudienceProfile>();
const auditStore = new Map<string, AudienceProfileAuditEntry[]>();
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

function cloneFilter(filter: AudienceProfileTagFilter): AudienceProfileTagFilter {
  return {
    include: filter.include ? [...filter.include] : undefined,
    exclude: filter.exclude ? [...filter.exclude] : undefined,
  };
}

function clone(profile: AudienceProfile): AudienceProfile {
  return {
    ...profile,
    audienceLabels: [...profile.audienceLabels],
    sectionFilters: cloneFilter(profile.sectionFilters),
    blockFilters: cloneFilter(profile.blockFilters),
  };
}

function pushAudit(entry: AudienceProfileAuditEntry): void {
  const key = profileKey(entry.organizationId, entry.profileId);
  const current = auditStore.get(key) ?? [];
  current.push(entry);
  auditStore.set(key, current);
  void persistAudienceProfileAuditEntry(entry).catch(() => undefined);
}

function recordMutation(
  profileId: string,
  organizationId: string,
  action: AudienceProfileAuditAction,
  actorId: string,
  details?: Record<string, unknown>
): void {
  pushAudit({
    auditId: makeId('audience-profile-audit'),
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
      const tenantProfiles = await loadAudienceProfilesForOrg(organizationId);
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
 * Public hydration trigger used by route handlers before list / get / audit
 * reads so a cold-start process always serves the persisted catalogue.
 * Idempotent per organization; subsequent calls are no-ops.
 */
export async function ensureAudienceProfileRegistryHydrated(organizationId: string): Promise<void> {
  return ensureHydrated(organizationId);
}

// =============================================================================
// Input validation helpers
// =============================================================================

const VALID_REGISTERS: ReadonlySet<CommunicationRegister> = new Set([
  'executive',
  'professional',
  'technical',
  'narrative',
]);

const VALID_DENSITIES: ReadonlySet<DocumentDensity> = new Set([
  'concise',
  'standard',
  'detailed',
  'comprehensive',
]);

const VALID_LANGUAGE_STYLES: ReadonlySet<DocumentLanguageStyle> = new Set([
  'formal',
  'consulting',
  'legal',
  'narrative',
]);

const VALID_EXECUTIVE_SUMMARY_POLICIES: ReadonlySet<AudienceProfileExecutiveSummaryPolicy> =
  new Set(['preserve', 'expand', 'drop']);

const VALID_APPENDIX_POLICIES: ReadonlySet<AudienceProfileAppendixPolicy> = new Set([
  'preserve',
  'drop',
]);

const VALID_JARGON_POLICIES: ReadonlySet<AudienceProfileJargonPolicy> = new Set([
  'as_is',
  'plain_language',
]);

function normalizeTagList(input: unknown): string[] {
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

function normalizeTagFilter(input: AudienceProfileTagFilter | undefined): AudienceProfileTagFilter {
  if (!input || typeof input !== 'object') return {};
  const include = normalizeTagList(input.include);
  const exclude = normalizeTagList(input.exclude);
  return {
    include: include.length > 0 ? include : undefined,
    exclude: exclude.length > 0 ? exclude : undefined,
  };
}

function bumpVersion(current: string): string {
  const num = Number.parseInt(current.replace(/^v/i, ''), 10);
  if (Number.isFinite(num) && num >= 0) return `v${num + 1}`;
  return 'v1';
}

function ensureMutable(profile: AudienceProfile): void {
  if (profile.organizationId === 'system' || isSystemAudienceProfileId(profile.profileId)) {
    throw new AudienceProfileError(
      'system_profile_immutable',
      `system audience profile cannot be mutated: ${profile.profileId}`
    );
  }
}

// =============================================================================
// Draft / update / activate / archive
// =============================================================================

export interface DraftAudienceProfileParams {
  organizationId: string;
  userId: string;
  input: AudienceProfileDraftInput;
}

export function draftAudienceProfile(params: DraftAudienceProfileParams): AudienceProfile {
  if (!params.organizationId) {
    throw new AudienceProfileError('invalid_input', 'organizationId is required');
  }
  if (params.organizationId === 'system') {
    throw new AudienceProfileError(
      'forbidden',
      "tenants cannot draft profiles in the 'system' organization"
    );
  }
  if (!params.userId) {
    throw new AudienceProfileError('invalid_input', 'userId is required');
  }
  if (!params.input || !params.input.name || params.input.name.trim().length === 0) {
    throw new AudienceProfileError('invalid_input', 'profile name is required');
  }

  const registerOverride = params.input.registerOverride;
  if (
    registerOverride !== undefined &&
    registerOverride !== null &&
    !VALID_REGISTERS.has(registerOverride)
  ) {
    throw new AudienceProfileError(
      'invalid_input',
      `unsupported registerOverride: ${registerOverride}`
    );
  }
  const densityOverride = params.input.densityOverride;
  if (
    densityOverride !== undefined &&
    densityOverride !== null &&
    !VALID_DENSITIES.has(densityOverride)
  ) {
    throw new AudienceProfileError(
      'invalid_input',
      `unsupported densityOverride: ${densityOverride}`
    );
  }
  const languageStyleOverride = params.input.languageStyleOverride;
  if (
    languageStyleOverride !== undefined &&
    languageStyleOverride !== null &&
    !VALID_LANGUAGE_STYLES.has(languageStyleOverride)
  ) {
    throw new AudienceProfileError(
      'invalid_input',
      `unsupported languageStyleOverride: ${languageStyleOverride}`
    );
  }
  const executiveSummaryPolicy: AudienceProfileExecutiveSummaryPolicy =
    params.input.executiveSummaryPolicy &&
    VALID_EXECUTIVE_SUMMARY_POLICIES.has(params.input.executiveSummaryPolicy)
      ? params.input.executiveSummaryPolicy
      : 'preserve';
  const appendixPolicy: AudienceProfileAppendixPolicy =
    params.input.appendixPolicy && VALID_APPENDIX_POLICIES.has(params.input.appendixPolicy)
      ? params.input.appendixPolicy
      : 'preserve';
  const jargonPolicy: AudienceProfileJargonPolicy =
    params.input.jargonPolicy && VALID_JARGON_POLICIES.has(params.input.jargonPolicy)
      ? params.input.jargonPolicy
      : 'as_is';

  const now = nowIso();
  const profile: AudienceProfile = {
    profileId: makeId('audience-profile'),
    organizationId: params.organizationId,
    name: params.input.name.trim(),
    description: params.input.description?.trim() || undefined,
    status: 'draft',
    version: 'v1',
    audienceLabels: normalizeTagList(params.input.audienceLabels),
    registerOverride: registerOverride ?? undefined,
    densityOverride: densityOverride ?? undefined,
    languageStyleOverride: languageStyleOverride ?? undefined,
    sectionFilters: normalizeTagFilter(params.input.sectionFilters),
    blockFilters: normalizeTagFilter(params.input.blockFilters),
    executiveSummaryPolicy,
    appendixPolicy,
    jargonPolicy,
    notes: params.input.notes?.trim() || undefined,
    createdBy: params.userId,
    createdAt: now,
    updatedAt: now,
  };

  registryStore.set(profileKey(params.organizationId, profile.profileId), profile);
  void persistAudienceProfile(profile).catch(() => undefined);

  recordMutation(profile.profileId, profile.organizationId, 'profile_drafted', params.userId, {
    name: profile.name,
    audienceLabelCount: profile.audienceLabels.length,
    appendixPolicy: profile.appendixPolicy,
    executiveSummaryPolicy: profile.executiveSummaryPolicy,
  });

  return clone(profile);
}

export interface UpdateAudienceProfileParams {
  organizationId: string;
  userId: string;
  profileId: string;
  input: AudienceProfileUpdateInput;
}

/**
 * Mutate any field of a draft OR active profile. Archived profiles and
 * system seeds are immutable. Bumps the `version` string on every
 * successful update so downstream consumers can detect lexicon churn.
 */
export function updateAudienceProfile(params: UpdateAudienceProfileParams): AudienceProfile {
  if (!params.organizationId) {
    throw new AudienceProfileError('invalid_input', 'organizationId is required');
  }
  if (!params.userId) {
    throw new AudienceProfileError('invalid_input', 'userId is required');
  }
  const existing = registryStore.get(profileKey(params.organizationId, params.profileId));
  if (!existing) {
    throw new AudienceProfileError(
      'profile_not_found',
      `audience profile not found: ${params.profileId}`
    );
  }
  ensureMutable(existing);
  if (existing.status === 'archived') {
    throw new AudienceProfileError(
      'profile_archived',
      `audience profile is archived: ${params.profileId}`
    );
  }
  if (
    params.input.registerOverride !== undefined &&
    params.input.registerOverride !== null &&
    !VALID_REGISTERS.has(params.input.registerOverride)
  ) {
    throw new AudienceProfileError(
      'invalid_input',
      `unsupported registerOverride: ${params.input.registerOverride}`
    );
  }
  if (
    params.input.densityOverride !== undefined &&
    params.input.densityOverride !== null &&
    !VALID_DENSITIES.has(params.input.densityOverride)
  ) {
    throw new AudienceProfileError(
      'invalid_input',
      `unsupported densityOverride: ${params.input.densityOverride}`
    );
  }
  if (
    params.input.languageStyleOverride !== undefined &&
    params.input.languageStyleOverride !== null &&
    !VALID_LANGUAGE_STYLES.has(params.input.languageStyleOverride)
  ) {
    throw new AudienceProfileError(
      'invalid_input',
      `unsupported languageStyleOverride: ${params.input.languageStyleOverride}`
    );
  }
  if (
    params.input.executiveSummaryPolicy !== undefined &&
    !VALID_EXECUTIVE_SUMMARY_POLICIES.has(params.input.executiveSummaryPolicy)
  ) {
    throw new AudienceProfileError(
      'invalid_input',
      `unsupported executiveSummaryPolicy: ${params.input.executiveSummaryPolicy}`
    );
  }
  if (
    params.input.appendixPolicy !== undefined &&
    !VALID_APPENDIX_POLICIES.has(params.input.appendixPolicy)
  ) {
    throw new AudienceProfileError(
      'invalid_input',
      `unsupported appendixPolicy: ${params.input.appendixPolicy}`
    );
  }
  if (
    params.input.jargonPolicy !== undefined &&
    !VALID_JARGON_POLICIES.has(params.input.jargonPolicy)
  ) {
    throw new AudienceProfileError(
      'invalid_input',
      `unsupported jargonPolicy: ${params.input.jargonPolicy}`
    );
  }

  const now = nowIso();
  const next: AudienceProfile = {
    ...existing,
    name:
      params.input.name !== undefined && params.input.name.trim().length > 0
        ? params.input.name.trim()
        : existing.name,
    description:
      params.input.description === null
        ? undefined
        : params.input.description !== undefined
          ? params.input.description.trim() || undefined
          : existing.description,
    audienceLabels:
      params.input.audienceLabels !== undefined
        ? normalizeTagList(params.input.audienceLabels)
        : existing.audienceLabels,
    registerOverride:
      params.input.registerOverride === null
        ? undefined
        : params.input.registerOverride !== undefined
          ? params.input.registerOverride
          : existing.registerOverride,
    densityOverride:
      params.input.densityOverride === null
        ? undefined
        : params.input.densityOverride !== undefined
          ? params.input.densityOverride
          : existing.densityOverride,
    languageStyleOverride:
      params.input.languageStyleOverride === null
        ? undefined
        : params.input.languageStyleOverride !== undefined
          ? params.input.languageStyleOverride
          : existing.languageStyleOverride,
    sectionFilters:
      params.input.sectionFilters !== undefined
        ? normalizeTagFilter(params.input.sectionFilters)
        : existing.sectionFilters,
    blockFilters:
      params.input.blockFilters !== undefined
        ? normalizeTagFilter(params.input.blockFilters)
        : existing.blockFilters,
    executiveSummaryPolicy:
      params.input.executiveSummaryPolicy !== undefined
        ? params.input.executiveSummaryPolicy
        : existing.executiveSummaryPolicy,
    appendixPolicy:
      params.input.appendixPolicy !== undefined
        ? params.input.appendixPolicy
        : existing.appendixPolicy,
    jargonPolicy:
      params.input.jargonPolicy !== undefined ? params.input.jargonPolicy : existing.jargonPolicy,
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
  void persistAudienceProfile(next).catch(() => undefined);

  recordMutation(next.profileId, next.organizationId, 'profile_updated', params.userId, {
    fromVersion: existing.version,
    toVersion: next.version,
  });

  return clone(next);
}

export interface ActivateAudienceProfileParams {
  organizationId: string;
  userId: string;
  profileId: string;
}

/**
 * Promote a profile to `active`. Multiple actives are allowed per tenant
 * (different audiences are not mutually exclusive). Idempotent guard:
 * re-activating an already-active profile throws
 * `profile_already_active` so accidental UI double-clicks are caught.
 */
export function activateAudienceProfile(params: ActivateAudienceProfileParams): AudienceProfile {
  if (!params.organizationId) {
    throw new AudienceProfileError('invalid_input', 'organizationId is required');
  }
  if (!params.userId) {
    throw new AudienceProfileError('invalid_input', 'userId is required');
  }
  const target = registryStore.get(profileKey(params.organizationId, params.profileId));
  if (!target) {
    throw new AudienceProfileError(
      'profile_not_found',
      `audience profile not found: ${params.profileId}`
    );
  }
  ensureMutable(target);
  if (target.status === 'archived') {
    throw new AudienceProfileError(
      'profile_archived',
      `cannot activate an archived profile: ${params.profileId}`
    );
  }
  if (target.status === 'active') {
    throw new AudienceProfileError(
      'profile_already_active',
      `profile is already active: ${params.profileId}`
    );
  }

  const now = nowIso();
  const next: AudienceProfile = {
    ...target,
    status: 'active',
    activatedBy: params.userId,
    activatedAt: now,
    updatedAt: now,
  };
  registryStore.set(profileKey(next.organizationId, next.profileId), next);
  void persistAudienceProfile(next).catch(() => undefined);

  recordMutation(next.profileId, next.organizationId, 'profile_activated', params.userId, {
    version: next.version,
  });

  return clone(next);
}

export interface ArchiveAudienceProfileParams {
  organizationId: string;
  userId: string;
  profileId: string;
  reason?: string;
}

export function archiveAudienceProfile(params: ArchiveAudienceProfileParams): AudienceProfile {
  if (!params.organizationId) {
    throw new AudienceProfileError('invalid_input', 'organizationId is required');
  }
  if (!params.userId) {
    throw new AudienceProfileError('invalid_input', 'userId is required');
  }
  const target = registryStore.get(profileKey(params.organizationId, params.profileId));
  if (!target) {
    throw new AudienceProfileError(
      'profile_not_found',
      `audience profile not found: ${params.profileId}`
    );
  }
  ensureMutable(target);
  if (target.status === 'archived') {
    throw new AudienceProfileError(
      'profile_already_archived',
      `profile is already archived: ${params.profileId}`
    );
  }

  const now = nowIso();
  const next: AudienceProfile = {
    ...target,
    status: 'archived',
    archivedBy: params.userId,
    archivedAt: now,
    updatedAt: now,
  };
  registryStore.set(profileKey(next.organizationId, next.profileId), next);
  void persistAudienceProfile(next).catch(() => undefined);

  recordMutation(next.profileId, next.organizationId, 'profile_archived', params.userId, {
    reason: params.reason?.trim() || undefined,
    fromStatus: target.status,
  });

  return clone(next);
}

// =============================================================================
// Reads
// =============================================================================

/**
 * Resolve an audience profile by id. Looks up tenant-owned profiles first,
 * falls back to the four immutable system seeds — system profiles are
 * visible to every tenant.
 */
export function getAudienceProfile(
  profileId: string,
  organizationId: string
): AudienceProfile | null {
  if (!profileId || !organizationId) return null;
  const tenantProfile = registryStore.get(profileKey(organizationId, profileId));
  if (tenantProfile) return clone(tenantProfile);
  const systemProfile = getSystemAudienceProfile(profileId);
  return systemProfile ? clone(systemProfile) : null;
}

export interface ListAudienceProfilesOptions {
  status?: AudienceProfileStatus;
  /** When true (default false), include archived profiles in the result. */
  includeArchived?: boolean;
  /** When true (default true), include the four system-default profiles. */
  includeSystem?: boolean;
}

export function listAudienceProfiles(
  organizationId: string,
  options: ListAudienceProfilesOptions = {}
): AudienceProfile[] {
  if (!organizationId) return [];
  const includeArchived = options.includeArchived === true;
  const includeSystem = options.includeSystem !== false;
  const prefix = `${organizationId}::`;
  const out: AudienceProfile[] = [];
  for (const [key, profile] of registryStore.entries()) {
    if (!key.startsWith(prefix)) continue;
    if (options.status && profile.status !== options.status) continue;
    if (!includeArchived && !options.status && profile.status === 'archived') continue;
    out.push(clone(profile));
  }
  if (includeSystem) {
    for (const profile of SYSTEM_AUDIENCE_PROFILES) {
      if (options.status && profile.status !== options.status) continue;
      out.push(clone(profile));
    }
  }
  return out.sort((a, b) => {
    if (a.organizationId === 'system' && b.organizationId !== 'system') return 1;
    if (b.organizationId === 'system' && a.organizationId !== 'system') return -1;
    return b.createdAt > a.createdAt ? 1 : -1;
  });
}

/**
 * Resolve every active profile for a tenant — used by export workflows
 * that fan out a single document into all configured audience variants.
 * Includes the four immutable system seeds when `includeSystem !== false`.
 */
export function listActiveAudienceProfiles(
  organizationId: string,
  options: { includeSystem?: boolean } = {}
): AudienceProfile[] {
  return listAudienceProfiles(organizationId, {
    status: 'active',
    includeSystem: options.includeSystem,
  });
}

export function listAudienceProfileAuditEntries(
  profileId: string,
  organizationId: string
): AudienceProfileAuditEntry[] {
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
export function __resetAudienceProfileServiceForTests(): void {
  registryStore.clear();
  auditStore.clear();
  hydratedOrgs.clear();
  hydrationInflight.clear();
}

/** @internal */
export async function __resetAudienceProfileServiceAndPersistenceForTests(): Promise<void> {
  __resetAudienceProfileServiceForTests();
  await __resetAudienceProfileRegistryDaoForTests();
}

/** @internal */
export async function __loadAudienceProfileByIdForTests(
  profileId: string,
  organizationId: string
): Promise<AudienceProfile | null> {
  return loadAudienceProfileById(profileId, organizationId);
}
