/**
 * HP-25 B1 — Governance-sync role unification tests.
 *
 * Covers:
 *  - projectRoleCanon.ts reverse maps (canonical -> projectMemberService /
 *    core.ts role key) are total (round-trip completeness guard).
 *  - scimRoleTranslation.ts translates known internal_role strings to the
 *    correct canonical role.
 *  - Unknown/garbage internal_role strings fail CLOSED (null / rejected),
 *    never an implicit/elevated grant.
 *
 * @module tests/unit/backend/services/scimRoleTranslation.test.ts
 */
import { describe, it, expect } from 'vitest';

import {
  CanonicalProjectRole,
  CANONICAL_TO_PROJECT_MEMBER_ROLE,
  CANONICAL_TO_CORE_PROJECT_ROLE,
  canonicalToProjectMemberRole,
  canonicalToCoreProjectRole,
  mapToCanonicalProjectRole,
} from '../../../../server/src/services/projectRoleCanon.js';
import { PROJECT_ROLES } from '../../../../server/src/services/projectMemberService.js';
import {
  mapScimInternalRoleToCanonicalProjectRole,
  resolveScimRoleGrant,
} from '../../../../server/src/services/scimRoleTranslation.js';

const ALL_CANONICAL_ROLES = Object.values(CanonicalProjectRole);

describe('projectRoleCanon reverse maps (B1 unification)', () => {
  it('has a projectMemberService role for every canonical role (no gaps)', () => {
    for (const role of ALL_CANONICAL_ROLES) {
      const mapped = CANONICAL_TO_PROJECT_MEMBER_ROLE[role];
      expect(mapped, `missing PROJECT_MEMBER mapping for ${role}`).toBeTruthy();
      expect(Object.values(PROJECT_ROLES)).toContain(mapped);
    }
  });

  it('has a core.ts ProjectRole for every canonical role (no gaps)', () => {
    for (const role of ALL_CANONICAL_ROLES) {
      const mapped = CANONICAL_TO_CORE_PROJECT_ROLE[role];
      expect(mapped, `missing CORE mapping for ${role}`).toBeTruthy();
    }
  });

  it('canonicalToProjectMemberRole / canonicalToCoreProjectRole fail closed on null/undefined', () => {
    expect(canonicalToProjectMemberRole(null)).toBeNull();
    expect(canonicalToProjectMemberRole(undefined)).toBeNull();
    expect(canonicalToCoreProjectRole(null)).toBeNull();
    expect(canonicalToCoreProjectRole(undefined)).toBeNull();
  });

  it('round-trips every canonical role through its own name via mapToCanonicalProjectRole', () => {
    for (const role of ALL_CANONICAL_ROLES) {
      expect(mapToCanonicalProjectRole(role)).toBe(role);
      // Direct match must also be case-insensitive (real inputs are free text from DB/UI)
      expect(mapToCanonicalProjectRole(role.toLowerCase())).toBe(role);
    }
  });
});

describe('mapScimInternalRoleToCanonicalProjectRole', () => {
  it.each([
    ['admin', CanonicalProjectRole.PROJECT_LEADER],
    ['Admin', CanonicalProjectRole.PROJECT_LEADER],
    ['ADMINISTRATOR', CanonicalProjectRole.PROJECT_LEADER],
    ['project_manager', CanonicalProjectRole.PROJECT_LEADER],
    ['member', CanonicalProjectRole.TASK_ASSIGNEE],
    ['  Member  ', CanonicalProjectRole.TASK_ASSIGNEE],
    ['viewer', CanonicalProjectRole.OBSERVER],
  ])('maps known SCIM application role %s -> %s', (input, expected) => {
    expect(mapScimInternalRoleToCanonicalProjectRole(input)).toBe(expected);
  });

  it.each([
    ['SPONSOR', CanonicalProjectRole.PROJECT_SPONSOR],
    ['PROJECT_EXECUTIVE', CanonicalProjectRole.PROJECT_SPONSOR],
    ['PMO_LEAD', CanonicalProjectRole.PMO],
    ['sme', CanonicalProjectRole.SME],
    ['consultant', CanonicalProjectRole.CONSULTANT],
    ['workstream_owner', CanonicalProjectRole.WORKSTREAM_OWNER],
  ])(
    'also accepts a canonical/legacy role string stored directly in internal_role: %s -> %s',
    (input, expected) => {
      expect(mapScimInternalRoleToCanonicalProjectRole(input)).toBe(expected);
    }
  );

  it.each([
    [''],
    ['   '],
    [null],
    [undefined],
    ['owner'], // application-role but NOT in our explicit SCIM allow-list
    ['superadmin'],
    ['finance-approvers'], // a raw AD group *name*, not a role — must not be treated as a role
    ["'; DROP TABLE scim_group_mappings; --"],
    ['<script>alert(1)</script>'],
    ['random_unmapped_string_123'],
  ])('fails CLOSED (returns null) for unknown/unsafe input: %j', (input) => {
    expect(mapScimInternalRoleToCanonicalProjectRole(input as unknown)).toBeNull();
  });
});

describe('resolveScimRoleGrant (full pipeline, no DB access)', () => {
  it('resolves a known internal_role to canonical role + project-member role + non-empty permissions', () => {
    const result = resolveScimRoleGrant('admin');
    expect(result.rejected).toBe(false);
    if (!result.rejected) {
      expect(result.canonicalRole).toBe(CanonicalProjectRole.PROJECT_LEADER);
      expect(result.projectMemberRoleKey).toBe(PROJECT_ROLES.PMO_LEAD);
      expect(result.permissions).toBeTruthy();
      expect(typeof result.permissions.canViewProject).toBe('boolean');
    }
  });

  it('resolves every canonical role to a permissions object with no undefined leakage', () => {
    for (const role of ALL_CANONICAL_ROLES) {
      const result = resolveScimRoleGrant(role);
      expect(result.rejected, `role ${role} should resolve`).toBe(false);
      if (!result.rejected) {
        expect(result.permissions).toBeTruthy();
      }
    }
  });

  it.each([[''], [null], [undefined], ['garbage_role'], ['owner'], ['DROP TABLE users']])(
    'rejects unknown internal_role %j with an explicit reason, never a silent default grant',
    (input) => {
      const result = resolveScimRoleGrant(input as unknown);
      expect(result.rejected).toBe(true);
      if (result.rejected) {
        expect(typeof result.reason).toBe('string');
        expect(result.reason.length).toBeGreaterThan(0);
      }
    }
  );

  it('never throws on hostile input (fail closed, not fail crash)', () => {
    const hostileInputs: unknown[] = [
      {},
      [],
      123,
      true,
      Symbol('x'),
      new Array(10000).fill('A').join(''), // pathological length
    ];
    for (const input of hostileInputs) {
      expect(() => resolveScimRoleGrant(input)).not.toThrow();
      const result = resolveScimRoleGrant(input);
      expect(result.rejected).toBe(true);
    }
  });
});
