/**
 * Document Studio — Audience Profile Service tests (Epic E9, Slice 9.2).
 *
 * Covers the per-tenant Audience Profile data plane:
 *
 *   - draft → activate → archive lifecycle (multiple actives ALLOWED, unlike Brand Voice);
 *   - update bumps version, rejects archived + system seeds, validates enums;
 *   - audience-tag list / filter normalization (trim, dedupe, drop empties);
 *   - tenant isolation (cross-tenant reads return null/[]);
 *   - system seeds visible to every tenant via list/get + protected from mutation;
 *   - hydration loads persisted profiles on cold start;
 *   - audit trail records every transition with stable action codes.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { persistAudienceProfile } from '../documentAudienceProfileRegistryDao.js';
import { SYSTEM_AUDIENCE_PROFILES } from '../documentAudienceProfileSeeds.js';
import {
  __loadAudienceProfileByIdForTests,
  __resetAudienceProfileServiceAndPersistenceForTests,
  activateAudienceProfile,
  archiveAudienceProfile,
  AudienceProfileError,
  draftAudienceProfile,
  ensureAudienceProfileRegistryHydrated,
  getAudienceProfile,
  listActiveAudienceProfiles,
  listAudienceProfileAuditEntries,
  listAudienceProfiles,
  updateAudienceProfile,
} from '../documentAudienceProfileService.js';

const ORG_A = 'org-A';
const ORG_B = 'org-B';
const USER = 'user-1';
const USER_2 = 'user-2';

beforeEach(async () => {
  await __resetAudienceProfileServiceAndPersistenceForTests();
});

afterEach(async () => {
  await __resetAudienceProfileServiceAndPersistenceForTests();
});

describe('Audience Profile Service — draft', () => {
  it('drafts a profile with normalized tag filters, defaults, and version v1', () => {
    const profile = draftAudienceProfile({
      organizationId: ORG_A,
      userId: USER,
      input: {
        name: '  Custom Board  ',
        description: 'Tenant-specific board variant',
        audienceLabels: ['  Board  ', 'CEO', 'CFO', 'CFO', '', 'ceo'],
        registerOverride: 'executive',
        densityOverride: 'concise',
        sectionFilters: { exclude: ['  engineering_only ', 'engineering_only', ''] },
      },
    });

    expect(profile.profileId).toMatch(/^audience-profile-/);
    expect(profile.organizationId).toBe(ORG_A);
    expect(profile.name).toBe('Custom Board');
    expect(profile.status).toBe('draft');
    expect(profile.version).toBe('v1');
    expect(profile.audienceLabels).toEqual(['Board', 'CEO', 'CFO']);
    expect(profile.registerOverride).toBe('executive');
    expect(profile.densityOverride).toBe('concise');
    expect(profile.languageStyleOverride).toBeUndefined();
    expect(profile.sectionFilters).toEqual({ exclude: ['engineering_only'] });
    expect(profile.blockFilters).toEqual({});
    expect(profile.executiveSummaryPolicy).toBe('preserve');
    expect(profile.appendixPolicy).toBe('preserve');
    expect(profile.jargonPolicy).toBe('as_is');
    expect(profile.createdBy).toBe(USER);
    expect(profile.createdAt).toBeDefined();
  });

  it('rejects empty input fields with invalid_input', () => {
    expect(() =>
      draftAudienceProfile({ organizationId: '', userId: USER, input: { name: 'x' } })
    ).toThrow(AudienceProfileError);
    expect(() =>
      draftAudienceProfile({ organizationId: ORG_A, userId: '', input: { name: 'x' } })
    ).toThrow(AudienceProfileError);
    expect(() =>
      draftAudienceProfile({ organizationId: ORG_A, userId: USER, input: { name: '   ' } })
    ).toThrow(AudienceProfileError);
  });

  it("forbids drafting under the 'system' organization", () => {
    expect(() =>
      draftAudienceProfile({
        organizationId: 'system',
        userId: USER,
        input: { name: 'Forbidden' },
      })
    ).toThrow(AudienceProfileError);
  });

  it('rejects unsupported scalar overrides', () => {
    expect(() =>
      draftAudienceProfile({
        organizationId: ORG_A,
        userId: USER,
        input: { name: 'X', registerOverride: 'whatever' as never },
      })
    ).toThrow(AudienceProfileError);
    expect(() =>
      draftAudienceProfile({
        organizationId: ORG_A,
        userId: USER,
        input: { name: 'X', densityOverride: 'bogus' as never },
      })
    ).toThrow(AudienceProfileError);
    expect(() =>
      draftAudienceProfile({
        organizationId: ORG_A,
        userId: USER,
        input: { name: 'X', languageStyleOverride: 'bogus' as never },
      })
    ).toThrow(AudienceProfileError);
  });

  it('writes through to persistence on draft', async () => {
    const profile = draftAudienceProfile({
      organizationId: ORG_A,
      userId: USER,
      input: { name: 'Persisted', appendixPolicy: 'drop' },
    });

    const persisted = await __loadAudienceProfileByIdForTests(profile.profileId, ORG_A);
    expect(persisted).not.toBeNull();
    expect(persisted!.name).toBe('Persisted');
    expect(persisted!.appendixPolicy).toBe('drop');
  });
});

describe('Audience Profile Service — update', () => {
  it('updates fields and bumps version', () => {
    const drafted = draftAudienceProfile({
      organizationId: ORG_A,
      userId: USER,
      input: { name: 'Original', densityOverride: 'standard' },
    });
    const updated = updateAudienceProfile({
      organizationId: ORG_A,
      userId: USER_2,
      profileId: drafted.profileId,
      input: {
        name: 'Renamed',
        densityOverride: 'detailed',
        executiveSummaryPolicy: 'drop',
      },
    });

    expect(updated.name).toBe('Renamed');
    expect(updated.densityOverride).toBe('detailed');
    expect(updated.executiveSummaryPolicy).toBe('drop');
    expect(updated.version).toBe('v2');
  });

  it('clears nullable scalar overrides when input is null', () => {
    const drafted = draftAudienceProfile({
      organizationId: ORG_A,
      userId: USER,
      input: { name: 'X', registerOverride: 'executive', densityOverride: 'concise' },
    });
    const cleared = updateAudienceProfile({
      organizationId: ORG_A,
      userId: USER,
      profileId: drafted.profileId,
      input: { registerOverride: null, densityOverride: null },
    });

    expect(cleared.registerOverride).toBeUndefined();
    expect(cleared.densityOverride).toBeUndefined();
  });

  it('rejects updates to archived profiles with profile_archived', () => {
    const drafted = draftAudienceProfile({
      organizationId: ORG_A,
      userId: USER,
      input: { name: 'X' },
    });
    archiveAudienceProfile({
      organizationId: ORG_A,
      userId: USER,
      profileId: drafted.profileId,
    });

    expect(() =>
      updateAudienceProfile({
        organizationId: ORG_A,
        userId: USER,
        profileId: drafted.profileId,
        input: { name: 'Y' },
      })
    ).toThrow(/archived/);
  });

  it('rejects updates to system seeds with system_profile_immutable', () => {
    const seedId = SYSTEM_AUDIENCE_PROFILES[0]!.profileId;
    expect(() =>
      updateAudienceProfile({
        organizationId: ORG_A,
        userId: USER,
        profileId: seedId,
        input: { name: 'Forbidden' },
      })
    ).toThrow(AudienceProfileError);
  });

  it('returns profile_not_found when id does not exist for tenant', () => {
    expect(() =>
      updateAudienceProfile({
        organizationId: ORG_A,
        userId: USER,
        profileId: 'does-not-exist',
        input: { name: 'X' },
      })
    ).toThrow(/profile_not_found|not found/i);
  });
});

describe('Audience Profile Service — activate / archive', () => {
  it('promotes a draft to active and stamps activatedBy/At', () => {
    const drafted = draftAudienceProfile({
      organizationId: ORG_A,
      userId: USER,
      input: { name: 'X' },
    });
    const activated = activateAudienceProfile({
      organizationId: ORG_A,
      userId: USER_2,
      profileId: drafted.profileId,
    });

    expect(activated.status).toBe('active');
    expect(activated.activatedBy).toBe(USER_2);
    expect(activated.activatedAt).toBeDefined();
  });

  it('allows multiple active profiles per tenant (no auto-supersede)', () => {
    const a = draftAudienceProfile({
      organizationId: ORG_A,
      userId: USER,
      input: { name: 'A' },
    });
    const b = draftAudienceProfile({
      organizationId: ORG_A,
      userId: USER,
      input: { name: 'B' },
    });
    activateAudienceProfile({ organizationId: ORG_A, userId: USER, profileId: a.profileId });
    activateAudienceProfile({ organizationId: ORG_A, userId: USER, profileId: b.profileId });

    const actives = listActiveAudienceProfiles(ORG_A, { includeSystem: false });
    const ids = actives.map((p) => p.profileId).sort();
    expect(ids).toEqual([a.profileId, b.profileId].sort());
  });

  it('throws profile_already_active on repeated activation', () => {
    const drafted = draftAudienceProfile({
      organizationId: ORG_A,
      userId: USER,
      input: { name: 'X' },
    });
    activateAudienceProfile({ organizationId: ORG_A, userId: USER, profileId: drafted.profileId });
    expect(() =>
      activateAudienceProfile({
        organizationId: ORG_A,
        userId: USER,
        profileId: drafted.profileId,
      })
    ).toThrow(/already active/i);
  });

  it('archives a profile and rejects re-archive', () => {
    const drafted = draftAudienceProfile({
      organizationId: ORG_A,
      userId: USER,
      input: { name: 'X' },
    });
    const archived = archiveAudienceProfile({
      organizationId: ORG_A,
      userId: USER,
      profileId: drafted.profileId,
      reason: 'no longer relevant',
    });

    expect(archived.status).toBe('archived');
    expect(archived.archivedBy).toBe(USER);

    expect(() =>
      archiveAudienceProfile({
        organizationId: ORG_A,
        userId: USER,
        profileId: drafted.profileId,
      })
    ).toThrow(/already archived/i);
  });

  it('refuses to archive system seeds', () => {
    const seedId = SYSTEM_AUDIENCE_PROFILES[0]!.profileId;
    expect(() =>
      archiveAudienceProfile({
        organizationId: ORG_A,
        userId: USER,
        profileId: seedId,
      })
    ).toThrow(AudienceProfileError);
  });
});

describe('Audience Profile Service — reads', () => {
  it('returns null on cross-tenant read', () => {
    const drafted = draftAudienceProfile({
      organizationId: ORG_A,
      userId: USER,
      input: { name: 'A-only' },
    });
    expect(getAudienceProfile(drafted.profileId, ORG_B)).toBeNull();
  });

  it('lists tenant profiles + system seeds by default', () => {
    draftAudienceProfile({ organizationId: ORG_A, userId: USER, input: { name: 'Custom' } });
    const profiles = listAudienceProfiles(ORG_A);
    const tenantProfiles = profiles.filter((p) => p.organizationId !== 'system');
    const systemProfiles = profiles.filter((p) => p.organizationId === 'system');
    expect(tenantProfiles.map((p) => p.name)).toContain('Custom');
    expect(systemProfiles).toHaveLength(SYSTEM_AUDIENCE_PROFILES.length);
  });

  it('omits system seeds when includeSystem === false', () => {
    draftAudienceProfile({ organizationId: ORG_A, userId: USER, input: { name: 'Custom' } });
    const profiles = listAudienceProfiles(ORG_A, { includeSystem: false });
    expect(profiles.every((p) => p.organizationId === ORG_A)).toBe(true);
  });

  it('omits archived tenant profiles unless includeArchived is set', () => {
    const drafted = draftAudienceProfile({
      organizationId: ORG_A,
      userId: USER,
      input: { name: 'X' },
    });
    archiveAudienceProfile({
      organizationId: ORG_A,
      userId: USER,
      profileId: drafted.profileId,
    });

    const without = listAudienceProfiles(ORG_A, { includeSystem: false });
    expect(without).toHaveLength(0);

    const withArchived = listAudienceProfiles(ORG_A, {
      includeSystem: false,
      includeArchived: true,
    });
    expect(withArchived).toHaveLength(1);
    expect(withArchived[0]!.status).toBe('archived');
  });

  it('looks up system seeds by id from any tenant', () => {
    const seedId = SYSTEM_AUDIENCE_PROFILES[0]!.profileId;
    expect(getAudienceProfile(seedId, ORG_A)).not.toBeNull();
    expect(getAudienceProfile(seedId, ORG_B)).not.toBeNull();
  });
});

describe('Audience Profile Service — hydration', () => {
  it('hydrates persisted profiles on cold start', async () => {
    await persistAudienceProfile({
      profileId: 'pre-existing-profile',
      organizationId: ORG_A,
      name: 'Pre-existing',
      status: 'active',
      version: 'v3',
      audienceLabels: ['Board'],
      sectionFilters: {},
      blockFilters: {},
      executiveSummaryPolicy: 'preserve',
      appendixPolicy: 'preserve',
      jargonPolicy: 'as_is',
      createdBy: USER,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    await ensureAudienceProfileRegistryHydrated(ORG_A);
    const profile = getAudienceProfile('pre-existing-profile', ORG_A);
    expect(profile).not.toBeNull();
    expect(profile!.version).toBe('v3');
  });
});

describe('Audience Profile Service — audit trail', () => {
  it('records draft, update, activate, archive transitions with stable action codes', () => {
    const drafted = draftAudienceProfile({
      organizationId: ORG_A,
      userId: USER,
      input: { name: 'Audited' },
    });
    updateAudienceProfile({
      organizationId: ORG_A,
      userId: USER_2,
      profileId: drafted.profileId,
      input: { name: 'Audited 2' },
    });
    activateAudienceProfile({
      organizationId: ORG_A,
      userId: USER_2,
      profileId: drafted.profileId,
    });
    archiveAudienceProfile({
      organizationId: ORG_A,
      userId: USER,
      profileId: drafted.profileId,
      reason: 'cleanup',
    });

    const audit = listAudienceProfileAuditEntries(drafted.profileId, ORG_A);
    expect(audit.map((entry) => entry.action)).toEqual([
      'profile_drafted',
      'profile_updated',
      'profile_activated',
      'profile_archived',
    ]);
    expect(audit[3]!.details).toMatchObject({ reason: 'cleanup', fromStatus: 'active' });
  });
});
