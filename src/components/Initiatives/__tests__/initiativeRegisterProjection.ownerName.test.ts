import { describe, expect, it } from 'vitest';

import type { RegisteredInitiativeReadModel } from '@/services/initiatives-execution/runtimeApi';

import { toCanonicalInitiativeRegisterItem } from '../initiativeRegisterProjection';

/**
 * D4b (2026-09-07/08) — regression for the defect measured on the Northwind
 * demo data: the "Owner" column of the Initiatives register rendered the
 * raw Polish literal "Przypisany właściciel" instead of a name for every
 * runtime-v1 (registered) row — 8 of 13 rows on that fixture — because
 * `toCanonicalInitiativeRegisterItem` only knew how to resolve the owner
 * against the currently logged-in actor or a non-UUID slug; any other real
 * UUID fell through to the hardcoded literal
 * (`initiativeRegisterProjection.ts:336` pre-fix).
 *
 * The fix threads the same `userId -> label` resolver the rest of the app
 * uses (`useOrganizationMemberNames`, wired in `InitiativesHub.tsx`) through
 * an optional third parameter. Unresolved owners must render "—" via
 * `ownerBusiness` staying `undefined` (see `CanonicalInitiativeRegister.tsx`
 * column: `ownerBusiness?.firstName || ownerExecution?.firstName || '—'`) —
 * never the literal, never the raw UUID.
 */
const baseRecord = (overrides: Partial<RegisteredInitiativeReadModel['initiative']> = {}) =>
  ({
    version: 1,
    updatedAt: '2026-09-01T00:00:00.000Z',
    initiative: {
      initiativeId: 'init-1',
      lifecycleState: 'IN_EXECUTION',
      title: 'Przykładowa inicjatywa',
      projectId: 'project-1',
      readiness: 'NOT_EVALUATED',
      initiativeOwnerId: '3f2a9c10-9b1e-4e3a-8f2b-1a2b3c4d5e6f',
      ...overrides,
    },
  }) as RegisteredInitiativeReadModel;

describe('toCanonicalInitiativeRegisterItem — owner name resolution (D4b)', () => {
  it('resolves a real UUID owner to a name via the org member map when the owner is not the logged-in actor', () => {
    const record = baseRecord();
    const resolveMemberName = (userId: string) =>
      userId === '3f2a9c10-9b1e-4e3a-8f2b-1a2b3c4d5e6f' ? 'Jan Kowalski' : null;

    const row = toCanonicalInitiativeRegisterItem(record, undefined, resolveMemberName);

    expect(row.ownerBusiness?.firstName).toBe('Jan Kowalski');
  });

  it('never falls back to the "Przypisany właściciel" literal for an unresolved UUID owner', () => {
    const record = baseRecord();
    const resolveMemberName = () => null; // member catalog does not know this id

    const row = toCanonicalInitiativeRegisterItem(record, undefined, resolveMemberName);

    expect(row.ownerBusiness?.firstName).not.toBe('Przypisany właściciel');
    // Honest "no match": leave ownerBusiness unset so the column renders "—".
    expect(row.ownerBusiness).toBeUndefined();
  });

  it('never renders the literal even without a resolver at all (pre-fix regression guard)', () => {
    const record = baseRecord();

    const row = toCanonicalInitiativeRegisterItem(record);

    expect(row.ownerBusiness?.firstName).not.toBe('Przypisany właściciel');
    expect(row.ownerBusiness).toBeUndefined();
  });

  it('still prefers the logged-in actor display name when the owner is the current user', () => {
    const record = baseRecord({ initiativeOwnerId: 'actor-1' });
    const resolveMemberName = () => 'Powinno Nie Wygrać';

    const row = toCanonicalInitiativeRegisterItem(
      record,
      { id: 'actor-1', displayName: 'Piotr Wiśniewski' },
      resolveMemberName
    );

    expect(row.ownerBusiness?.firstName).toBe('Piotr Wiśniewski');
  });

  it('keeps the legacy non-UUID slug formatting behavior untouched', () => {
    const record = baseRecord({ initiativeOwnerId: 'demo-story-owner' });

    const row = toCanonicalInitiativeRegisterItem(record);

    expect(row.ownerBusiness?.firstName).toBe('Demo Story Owner');
  });

  it('leaves ownerBusiness undefined when there is no owner at all', () => {
    const record = baseRecord({ initiativeOwnerId: undefined });

    const row = toCanonicalInitiativeRegisterItem(record);

    expect(row.ownerBusiness).toBeUndefined();
  });
});
