/**
 * DEC-91 / TRI-MUST-12 — the EIGHTH front door: public invitation acceptance.
 *
 * ===========================================================================
 * WHY THIS SUITE EXISTS
 * ===========================================================================
 * `POST /api/invitations/accept` is deliberately PUBLIC — `Gateway.ts` excludes
 * it from both `verifyToken` and `trialEntryGuard`, because the person
 * accepting an invitation does not yet have an account. Every DEC-91 gate built
 * before this one lives in a middleware that this path therefore never touches,
 * and `invitationService.acceptInvitation` itself never read
 * `organizations.status`.
 *
 * The result: a SUSPENDED tenant could keep onboarding. Accepting an invitation
 * INSERTed a `users` row and an `organization_members` row bound to
 * `invitation.organization_id` and incremented seat usage — for a tenant that is
 * supposed to be cut off. The new member was then refused by every OTHER
 * DEC-91 gate on their first real request.
 *
 * ===========================================================================
 * WHAT MAKES THESE ASSERTIONS FALSIFIABLE
 * ===========================================================================
 * The suite drives the REAL `acceptInvitation` with an injected database
 * double, and asserts the refusal by ABSENCE OF THE THREE SIDE EFFECTS that
 * matter, not merely by a thrown error:
 *
 *   1. no `INSERT INTO users`
 *   2. no `INSERT INTO organization_members`
 *   3. the invitation is NOT consumed (`markAsAccepted` never called)
 *
 * (3) is the one that pins the gate to the right PLACE. A gate added later in
 * the method would still throw, and would still have burned the invitation —
 * leaving the invitee unable to join even after the tenant is reactivated.
 *
 * The ACTIVE tenant taking the identical path is the negative control.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InvitationServiceClass } from '../invitationService.js';
import { __testing__ } from '../organizationSuspensionGuard.js';

const ORG_STATUS: Record<string, string> = {
  'org-suspended': 'suspended',
  'org-active': 'active',
};

/** Every write the service attempted, in order. */
let writes: string[] = [];

const makeInvitation = (organizationId: string) => ({
  id: `inv-of-${organizationId}`,
  organization_id: organizationId,
  project_id: null,
  email: 'invitee@example.com',
  role: 'MEMBER',
  role_to_assign: null,
  status: 'pending',
  invitation_type: 'org',
  metadata: '{}',
  expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
});

/** Truthy: the real one reports whether the row was actually consumed. */
const markAsAccepted = vi.fn(async () => true);
const markAsExpired = vi.fn(async () => undefined);
const logEvent = vi.fn(async () => undefined);

const buildService = (organizationId: string) => {
  const db = {
    get: vi.fn(async (sql: string, params?: unknown[]) => {
      const text = String(sql).replace(/\s+/g, ' ');
      const first = String((params || [])[0] ?? '');
      if (text.includes('FROM organizations')) {
        const status = ORG_STATUS[first];
        return status ? { status } : null;
      }
      // No pre-existing account for the invitee, so the happy path takes its
      // "create new user" branch and really does try to INSERT.
      if (text.includes('FROM users')) return null;
      return null;
    }),
    run: vi.fn(async (sql: string) => {
      writes.push(String(sql).replace(/\s+/g, ' ').trim());
      return undefined;
    }),
    all: vi.fn(async () => []),
  };

  const service = new InvitationServiceClass({
    db: db as never,
    uuidv4: (() => 'generated-id') as never,
    bcrypt: { hashSync: () => 'hashed' } as never,
    tokenService: {
      isCanonicalInvitationRawToken: () => true,
      hashToken: (t: string) => `hash-of-${t}`,
    } as never,
    dataService: {
      getInvitationByTokenHash: async () => makeInvitation(organizationId),
      markAsAccepted,
      markAsExpired,
      logEvent,
    } as never,
  });

  return { service, db };
};

const acceptFor = async (organizationId: string) => {
  const { service, db } = buildService(organizationId);
  let error: (Error & { code?: string }) | null = null;
  let result: unknown = null;
  try {
    result = await service.acceptInvitation({
      token: 'inv_tok_whatever',
      email: 'invitee@example.com',
      firstName: 'In',
      lastName: 'Vitee',
      password: 'correct horse battery staple',
    } as never);
  } catch (e) {
    error = e as Error & { code?: string };
  }
  return { error, result, db };
};

const wroteMatching = (pattern: RegExp): boolean => writes.some((sql) => pattern.test(sql));

describe('DEC-91 — a suspended tenant cannot onboard through invitation accept', () => {
  beforeEach(() => {
    writes = [];
    markAsAccepted.mockClear();
    markAsExpired.mockClear();
    logEvent.mockClear();
    __testing__.reset();
  });

  it('refuses the acceptance with the DEC-91 code', async () => {
    const { error } = await acceptFor('org-suspended');

    expect(error).not.toBeNull();
    expect(error?.code).toBe('ORG_SUSPENDED');
  });

  it('writes NOTHING — no users row and no organization_members row', async () => {
    await acceptFor('org-suspended');

    expect(wroteMatching(/INSERT INTO users/i)).toBe(false);
    expect(wroteMatching(/INSERT INTO organization_members/i)).toBe(false);
    expect(writes).toEqual([]);
  });

  it('leaves the invitation UNCONSUMED, so it still works once the tenant is reactivated', async () => {
    // This is what pins the gate to the right PLACE rather than merely to the
    // right OUTCOME: a gate further down would also throw, having already
    // burned the invitation and stranded the invitee permanently.
    await acceptFor('org-suspended');

    expect(markAsAccepted).not.toHaveBeenCalled();
    expect(markAsExpired).not.toHaveBeenCalled();
  });

  it('NEGATIVE CONTROL: the identical acceptance for an ACTIVE tenant succeeds and writes', async () => {
    const { error, result } = await acceptFor('org-active');

    expect(error).toBeNull();
    expect(result).toMatchObject({ success: true, organizationId: 'org-active' });
    expect(wroteMatching(/INSERT INTO users/i)).toBe(true);
    expect(wroteMatching(/INSERT INTO organization_members/i)).toBe(true);
    expect(markAsAccepted).toHaveBeenCalled();
  });

  it('an UNKNOWN organization is not invented into a suspension', async () => {
    // Absent `organizations` row => the guard says "not suspended"; it never
    // INFERS one. Proves the refusal above comes from the STATUS VALUE and not
    // from the lookup simply returning nothing.
    const { error } = await acceptFor('org-not-in-table');

    expect(error).toBeNull();
    expect(wroteMatching(/INSERT INTO users/i)).toBe(true);
  });
});
