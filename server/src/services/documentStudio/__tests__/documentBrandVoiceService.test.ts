/**
 * Document Studio — Brand Voice Profile Service tests (Epic E7, Slice 7.1).
 *
 * Covers the per-tenant Brand Voice profile data plane:
 *
 *   - draft → activate → archive lifecycle, with auto-supersede of the
 *     previous active profile on a fresh activation,
 *   - update bumps version, never touches archived rows,
 *   - phrase / glossary normalization (trim, dedupe, drop empties),
 *   - tenant isolation (cross-tenant reads return null/[]),
 *   - hydration loads persisted profiles on cold start,
 *   - audit trail records every transition (drafted, updated, activated,
 *     superseded, archived) with stable action codes.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  __loadBrandVoiceProfileByIdForTests,
  __resetBrandVoiceServiceAndPersistenceForTests,
  __resetBrandVoiceServiceForTests,
  activateBrandVoiceProfile,
  archiveBrandVoiceProfile,
  BrandVoiceProfileError,
  draftBrandVoiceProfile,
  ensureBrandVoiceRegistryHydrated,
  getActiveBrandVoiceProfile,
  getBrandVoiceProfile,
  listBrandVoiceProfileAuditEntries,
  listBrandVoiceProfiles,
  updateBrandVoiceProfile,
} from '../documentBrandVoiceService.js';

const ORG_A = 'org-A';
const ORG_B = 'org-B';
const USER = 'user-1';
const USER_2 = 'user-2';

beforeEach(async () => {
  await __resetBrandVoiceServiceAndPersistenceForTests();
});

afterEach(async () => {
  await __resetBrandVoiceServiceAndPersistenceForTests();
});

describe('Brand Voice Profile Service — draft', () => {
  it('drafts a profile with normalized phrase lists, language scope, and version v1', () => {
    const profile = draftBrandVoiceProfile({
      organizationId: ORG_A,
      userId: USER,
      input: {
        name: '  Acme — corporate voice  ',
        description: '  Default tone for client deliverables. ',
        languageScope: 'pl',
        bannedPhrases: ['Synergia', '  synergia ', '', 'absolutnie najlepszy'],
        disabledGlobalBannedPhrases: ['rewolucyjny'],
        preferredPhrases: ['  współpracujemy  ', 'współpracujemy'],
        glossaryEntries: [
          { avoid: 'synergia', prefer: 'wspólne wartości' },
          { avoid: '   ', prefer: 'noop' },
          { avoid: 'synergia', prefer: 'wspólne wartości' },
        ],
        requiredKeywords: ['Acme'],
        registerOverride: 'executive',
        notes: 'Approved by CMO.',
      },
    });

    expect(profile.name).toBe('Acme — corporate voice');
    expect(profile.description).toBe('Default tone for client deliverables.');
    expect(profile.status).toBe('draft');
    expect(profile.version).toBe('v1');
    expect(profile.languageScope).toBe('pl');
    expect(profile.bannedPhrases).toEqual(['Synergia', 'absolutnie najlepszy']);
    expect(profile.disabledGlobalBannedPhrases).toEqual(['rewolucyjny']);
    expect(profile.preferredPhrases).toEqual(['współpracujemy']);
    expect(profile.glossaryEntries).toEqual([
      { avoid: 'synergia', prefer: 'wspólne wartości', note: undefined },
    ]);
    expect(profile.requiredKeywords).toEqual(['Acme']);
    expect(profile.registerOverride).toBe('executive');
    expect(profile.notes).toBe('Approved by CMO.');
    expect(profile.createdBy).toBe(USER);
    expect(profile.activatedAt).toBeUndefined();
    expect(profile.archivedAt).toBeUndefined();

    const audit = listBrandVoiceProfileAuditEntries(profile.profileId, ORG_A);
    expect(audit).toHaveLength(1);
    expect(audit[0]!.action).toBe('profile_drafted');
    expect(audit[0]!.actorId).toBe(USER);
    expect(audit[0]!.details).toMatchObject({
      languageScope: 'pl',
      bannedPhraseCount: 2,
      glossaryEntryCount: 1,
      requiredKeywordCount: 1,
    });
  });

  it('defaults languageScope to "all" and rejects an unknown registerOverride', () => {
    const profile = draftBrandVoiceProfile({
      organizationId: ORG_A,
      userId: USER,
      input: { name: 'Default voice' },
    });
    expect(profile.languageScope).toBe('all');
    expect(profile.registerOverride).toBeUndefined();

    expect(() =>
      draftBrandVoiceProfile({
        organizationId: ORG_A,
        userId: USER,
        input: {
          name: 'Bad register',
          registerOverride: 'casual' as never,
        },
      })
    ).toThrow(BrandVoiceProfileError);
  });

  it('rejects empty input', () => {
    expect(() =>
      draftBrandVoiceProfile({
        organizationId: '',
        userId: USER,
        input: { name: 'no org' },
      })
    ).toThrow(/organizationId/);
    expect(() =>
      draftBrandVoiceProfile({
        organizationId: ORG_A,
        userId: USER,
        input: { name: '   ' },
      })
    ).toThrow(/profile name/);
  });
});

describe('Brand Voice Profile Service — update', () => {
  it('mutates fields, bumps version, records profile_updated audit', () => {
    const initial = draftBrandVoiceProfile({
      organizationId: ORG_A,
      userId: USER,
      input: { name: 'v1 voice', bannedPhrases: ['foo'] },
    });
    const updated = updateBrandVoiceProfile({
      organizationId: ORG_A,
      userId: USER_2,
      profileId: initial.profileId,
      input: {
        bannedPhrases: ['bar', 'baz'],
        glossaryEntries: [{ avoid: 'utilize', prefer: 'use' }],
        notes: '   ',
      },
    });
    expect(updated.version).toBe('v2');
    expect(updated.bannedPhrases).toEqual(['bar', 'baz']);
    expect(updated.glossaryEntries).toEqual([{ avoid: 'utilize', prefer: 'use', note: undefined }]);
    expect(updated.notes).toBeUndefined();

    const audit = listBrandVoiceProfileAuditEntries(initial.profileId, ORG_A);
    const updates = audit.filter((entry) => entry.action === 'profile_updated');
    expect(updates).toHaveLength(1);
    expect(updates[0]!.details).toMatchObject({ fromVersion: 'v1', toVersion: 'v2' });
  });

  it('clears registerOverride when input registerOverride is null', () => {
    const initial = draftBrandVoiceProfile({
      organizationId: ORG_A,
      userId: USER,
      input: { name: 'voice', registerOverride: 'executive' },
    });
    const cleared = updateBrandVoiceProfile({
      organizationId: ORG_A,
      userId: USER,
      profileId: initial.profileId,
      input: { registerOverride: null },
    });
    expect(cleared.registerOverride).toBeUndefined();
  });

  it('rejects updates on archived profiles', () => {
    const profile = draftBrandVoiceProfile({
      organizationId: ORG_A,
      userId: USER,
      input: { name: 'voice' },
    });
    archiveBrandVoiceProfile({
      organizationId: ORG_A,
      userId: USER,
      profileId: profile.profileId,
    });
    expect(() =>
      updateBrandVoiceProfile({
        organizationId: ORG_A,
        userId: USER,
        profileId: profile.profileId,
        input: { name: 'noop' },
      })
    ).toThrow(BrandVoiceProfileError);
  });

  it('returns profile_not_found when the id is unknown', () => {
    let caught: unknown;
    try {
      updateBrandVoiceProfile({
        organizationId: ORG_A,
        userId: USER,
        profileId: 'missing',
        input: { name: 'noop' },
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(BrandVoiceProfileError);
    expect((caught as BrandVoiceProfileError).code).toBe('profile_not_found');
  });
});

describe('Brand Voice Profile Service — activate / archive', () => {
  it('activates a draft, then auto-archives the previous active when a new one activates', () => {
    const first = draftBrandVoiceProfile({
      organizationId: ORG_A,
      userId: USER,
      input: { name: 'voice 1' },
    });
    const activated1 = activateBrandVoiceProfile({
      organizationId: ORG_A,
      userId: USER,
      profileId: first.profileId,
    });
    expect(activated1.status).toBe('active');
    expect(activated1.activatedBy).toBe(USER);

    const second = draftBrandVoiceProfile({
      organizationId: ORG_A,
      userId: USER,
      input: { name: 'voice 2' },
    });
    const activated2 = activateBrandVoiceProfile({
      organizationId: ORG_A,
      userId: USER_2,
      profileId: second.profileId,
    });
    expect(activated2.status).toBe('active');

    const previousNow = getBrandVoiceProfile(first.profileId, ORG_A);
    expect(previousNow!.status).toBe('archived');
    expect(previousNow!.archivedBy).toBe(USER_2);

    const audit1 = listBrandVoiceProfileAuditEntries(first.profileId, ORG_A);
    const supersededRow = audit1.find((entry) => entry.action === 'profile_superseded');
    expect(supersededRow).toBeDefined();
    expect(supersededRow!.details).toMatchObject({ supersededBy: second.profileId });

    const audit2 = listBrandVoiceProfileAuditEntries(second.profileId, ORG_A);
    const activatedRow = audit2.find((entry) => entry.action === 'profile_activated');
    expect(activatedRow).toBeDefined();
    expect(activatedRow!.details).toMatchObject({ supersededProfileId: first.profileId });

    expect(getActiveBrandVoiceProfile(ORG_A)!.profileId).toBe(second.profileId);
  });

  it('rejects activating an archived profile and rejects activating an already-active profile', () => {
    const profile = draftBrandVoiceProfile({
      organizationId: ORG_A,
      userId: USER,
      input: { name: 'voice' },
    });
    activateBrandVoiceProfile({
      organizationId: ORG_A,
      userId: USER,
      profileId: profile.profileId,
    });
    expect(() =>
      activateBrandVoiceProfile({
        organizationId: ORG_A,
        userId: USER,
        profileId: profile.profileId,
      })
    ).toThrow(BrandVoiceProfileError);

    archiveBrandVoiceProfile({
      organizationId: ORG_A,
      userId: USER,
      profileId: profile.profileId,
    });
    expect(() =>
      activateBrandVoiceProfile({
        organizationId: ORG_A,
        userId: USER,
        profileId: profile.profileId,
      })
    ).toThrow(BrandVoiceProfileError);
  });

  it('archive records reason in audit and is idempotent on re-archive (throws)', () => {
    const profile = draftBrandVoiceProfile({
      organizationId: ORG_A,
      userId: USER,
      input: { name: 'voice' },
    });
    archiveBrandVoiceProfile({
      organizationId: ORG_A,
      userId: USER,
      profileId: profile.profileId,
      reason: 'replaced by template-driven voice',
    });
    const audit = listBrandVoiceProfileAuditEntries(profile.profileId, ORG_A);
    const archived = audit.find((entry) => entry.action === 'profile_archived');
    expect(archived).toBeDefined();
    expect(archived!.details).toMatchObject({
      reason: 'replaced by template-driven voice',
      fromStatus: 'draft',
    });

    let caught: unknown;
    try {
      archiveBrandVoiceProfile({
        organizationId: ORG_A,
        userId: USER,
        profileId: profile.profileId,
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(BrandVoiceProfileError);
    expect((caught as BrandVoiceProfileError).code).toBe('profile_already_archived');
  });
});

describe('Brand Voice Profile Service — read surface', () => {
  it('listBrandVoiceProfiles excludes archived by default but includes when status filter or includeArchived is set', () => {
    const draft = draftBrandVoiceProfile({
      organizationId: ORG_A,
      userId: USER,
      input: { name: 'draft voice' },
    });
    const active = draftBrandVoiceProfile({
      organizationId: ORG_A,
      userId: USER,
      input: { name: 'active voice' },
    });
    activateBrandVoiceProfile({
      organizationId: ORG_A,
      userId: USER,
      profileId: active.profileId,
    });
    const stale = draftBrandVoiceProfile({
      organizationId: ORG_A,
      userId: USER,
      input: { name: 'stale voice' },
    });
    archiveBrandVoiceProfile({
      organizationId: ORG_A,
      userId: USER,
      profileId: stale.profileId,
    });

    const visible = listBrandVoiceProfiles(ORG_A);
    const visibleIds = visible.map((p) => p.profileId).sort();
    expect(visibleIds).toEqual([draft.profileId, active.profileId].sort());

    const archivedOnly = listBrandVoiceProfiles(ORG_A, { status: 'archived' });
    expect(archivedOnly.map((p) => p.profileId)).toEqual([stale.profileId]);

    const allVisible = listBrandVoiceProfiles(ORG_A, { includeArchived: true });
    expect(allVisible.length).toBe(3);
  });

  it('getActiveBrandVoiceProfile returns null when no active profile exists', () => {
    expect(getActiveBrandVoiceProfile(ORG_A)).toBeNull();
    draftBrandVoiceProfile({
      organizationId: ORG_A,
      userId: USER,
      input: { name: 'draft' },
    });
    expect(getActiveBrandVoiceProfile(ORG_A)).toBeNull();
  });
});

describe('Brand Voice Profile Service — tenant isolation', () => {
  it('cross-tenant reads return null and never leak existence', () => {
    const profile = draftBrandVoiceProfile({
      organizationId: ORG_A,
      userId: USER,
      input: { name: 'A voice' },
    });
    expect(getBrandVoiceProfile(profile.profileId, ORG_B)).toBeNull();
    expect(listBrandVoiceProfiles(ORG_B)).toEqual([]);
    expect(getActiveBrandVoiceProfile(ORG_B)).toBeNull();
    expect(listBrandVoiceProfileAuditEntries(profile.profileId, ORG_B)).toEqual([]);
  });

  it('updates targeting another tenant raise profile_not_found rather than mutating', () => {
    const profile = draftBrandVoiceProfile({
      organizationId: ORG_A,
      userId: USER,
      input: { name: 'A voice' },
    });
    let caught: unknown;
    try {
      updateBrandVoiceProfile({
        organizationId: ORG_B,
        userId: USER,
        profileId: profile.profileId,
        input: { name: 'evil' },
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(BrandVoiceProfileError);
    expect((caught as BrandVoiceProfileError).code).toBe('profile_not_found');
    expect(getBrandVoiceProfile(profile.profileId, ORG_A)!.name).toBe('A voice');
  });
});

describe('Brand Voice Profile Service — hydration', () => {
  it('hydrates persisted profiles on cold start without losing audit rows', async () => {
    const profile = draftBrandVoiceProfile({
      organizationId: ORG_A,
      userId: USER,
      input: { name: 'voice', bannedPhrases: ['x'] },
    });
    activateBrandVoiceProfile({
      organizationId: ORG_A,
      userId: USER,
      profileId: profile.profileId,
    });
    expect(await __loadBrandVoiceProfileByIdForTests(profile.profileId, ORG_A)).not.toBeNull();

    __resetBrandVoiceServiceForTests();
    expect(getBrandVoiceProfile(profile.profileId, ORG_A)).toBeNull();

    await ensureBrandVoiceRegistryHydrated(ORG_A);
    const rehydrated = getBrandVoiceProfile(profile.profileId, ORG_A);
    expect(rehydrated).not.toBeNull();
    expect(rehydrated!.status).toBe('active');

    const audit = listBrandVoiceProfileAuditEntries(profile.profileId, ORG_A);
    expect(audit.map((entry) => entry.action)).toEqual(['profile_drafted', 'profile_activated']);
  });
});
