/**
 * OPS-DEMO-002 — fault injection over the public demo signup saga.
 *
 * Every step that can fail is made to fail in turn, and each case asserts the
 * same two properties: the database is left with nothing the signup created, and
 * the same address can be registered again afterwards. That second property is
 * the one that matters operationally — a half-rollback leaves the account row
 * behind, so every retry is rejected as a duplicate and the prospect is locked
 * out of the demo permanently.
 *
 * Two shapes of fault are covered:
 *   - a step that throws having written NOTHING;
 *   - a step that writes something and THEN throws (legalService writes one row
 *     per document; the preferences step writes `demo:enabled`, `demo:started_at`
 *     and three markers as separate statements; seeding creates the tenant org
 *     before the `demo_sessions` row exists). Those are the cases a compensation
 *     registered after the forward call cannot reach at all.
 *
 * Faults are injected through the saga's dependency seam. No production fault
 * switch, no environment backdoor.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEMO_SIGNUP_ROLE,
  type ProvisionDeps,
  provisionPublicDemoAccount,
} from '../../../../server/src/services/demo/demoSignupProvisioning.js';

const BASE_ORG = 'demo-org';

/**
 * The id shape the saga USED to sweep for: `<base>-session-<first 10
 * alphanumerics of the user id>-<ts>`.
 */
function legacyPrefix(userId: string): string {
  const normalized = String(userId).replace(/[^a-zA-Z0-9]/g, '').slice(0, 10) || 'user';
  return `${BASE_ORG}-session-${normalized}-`;
}

/**
 * Mirror of `demoSignupProvisioning.makeProvisionTenantOrgId`.
 *
 * Mirrored rather than imported ON PURPOSE: a named import of a symbol the
 * pre-fix module does not export is an ESM link error, which would make this
 * whole file fail to load during the negative control and turn "the concurrency
 * case fails without the fix" into "nothing ran". With the mirror the file loads
 * against both revisions and the failure is the assertion, not the loader.
 * The happy-path case asserts the mirror still agrees with the real derivation.
 */
function tenantOrgIdFor(runId: string): string {
  const compact = String(runId).replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'run';
  return `${BASE_ORG}-session-run-${compact}`;
}

/**
 * Minimal stand-in for the rows the saga writes.
 *
 * User-scoped tables are keyed by user id; `sessionOrgs` and `sessionTenants`
 * are keyed by TENANT ORG ID, because that is the identity the fixed
 * compensation uses and the whole point of the concurrency case is that one
 * run's rollback must not touch another run's org.
 */
class FakeStore {
  users = new Set<string>();
  memberships = new Set<string>();
  legal = new Set<string>();
  preferences = new Set<string>();
  sessions = new Set<string>();
  /** tenant org id -> present */
  sessionTenants = new Set<string>();
  activeTokens = new Set<string>();
  /** tenant org id -> present */
  sessionOrgs = new Set<string>();

  isEmptyFor(userId: string): boolean {
    return (
      !this.users.has(userId) &&
      !this.memberships.has(userId) &&
      !this.legal.has(userId) &&
      !this.preferences.has(userId) &&
      !this.sessions.has(userId) &&
      !this.activeTokens.has(userId)
    );
  }
}

function tableOf(sql: string): string {
  return (
    /FROM\s+([a-z_]+)/i.exec(sql)?.[1] || /DELETE\s+FROM\s+([a-z_]+)/i.exec(sql)?.[1] || ''
  );
}

/**
 * Fake dependency set.
 *
 * Deliberately tolerant of BOTH dependency shapes — the fixed one
 * (`startSession(userId, locale, tenantOrgId)`, `setDemoPreferences({userId,…})`,
 * `orgExists`) and the pre-fix one (`startSession(userId, locale)`,
 * `setDemoPreferences(userId)`, `findSessionOrgIds`). That lets the concurrency
 * case act as a genuine negative control: the same test body runs against the
 * old prefix-sweeping module and fails there.
 */
function makeDeps(store: FakeStore, overrides: Record<string, unknown> = {}): Partial<ProvisionDeps> {
  const setFor = (table: string): Set<string> | null => {
    switch (table) {
      case 'users':
        return store.users;
      case 'organization_members':
        return store.memberships;
      case 'legal_document_acceptances':
        return store.legal;
      case 'user_preferences':
        return store.preferences;
      case 'demo_sessions':
        return store.sessions;
      case 'demo_session_tenants':
        return store.sessionTenants;
      case 'refresh_tokens':
        return store.activeTokens;
      default:
        return null;
    }
  };

  const base: Record<string, unknown> = {
    ensureDemoOrg: vi.fn(async () => {}),
    insertUser: vi.fn(async ({ userId }: { userId: string }) => {
      store.users.add(userId);
    }),
    insertMembership: vi.fn(async ({ userId }: { userId: string }) => {
      store.memberships.add(userId);
    }),
    recordLegalAcceptance: vi.fn(async ({ userId }: { userId: string }) => {
      store.legal.add(userId);
    }),
    setDemoPreferences: vi.fn(async (arg: string | { userId: string }) => {
      store.preferences.add(typeof arg === 'string' ? arg : arg.userId);
    }),
    startSession: vi.fn(async (userId: string, _locale: string, tenantOrgId?: string) => {
      const sessionOrgId = tenantOrgId || `${legacyPrefix(userId)}abc`;
      store.sessionOrgs.add(sessionOrgId);
      store.sessions.add(userId);
      store.sessionTenants.add(sessionOrgId);
      return {
        id: `session-${userId}`,
        user_id: userId,
        base_org_id: BASE_ORG,
        session_org_id: sessionOrgId,
        locale: 'en' as const,
        source: 'register_demo',
        status: 'active' as const,
        anchor_date: '2026-08-01T00:00:00.000Z',
        expires_at: '2026-08-02T00:00:00.000Z',
      };
    }),
    issueTokens: vi.fn(async ({ id }: { id: string }) => {
      store.activeTokens.add(id);
      return { accessToken: 'access', refreshToken: 'refresh' };
    }),
    readUser: vi.fn(async (userId: string) => (store.users.has(userId) ? { id: userId } : null)),
    orgExists: vi.fn(async (organizationId: string) => store.sessionOrgs.has(organizationId)),
    countRows: vi.fn(async (sql: string, params: unknown[]) => {
      const target = setFor(tableOf(sql));
      const key = String(params?.[0] ?? '');
      return target?.has(key) ? 1 : 0;
    }),
    deleteRows: vi.fn(async (sql: string, params: unknown[]) => {
      const target = setFor(tableOf(sql));
      target?.delete(String(params?.[0] ?? ''));
    }),
    deleteSessionTenant: vi.fn(async (organizationId: string) => {
      store.sessionOrgs.delete(organizationId);
    }),
    // Pre-fix seam, unused by the current implementation. Kept so the negative
    // control exercises the real prefix sweep instead of hitting the live DB.
    findSessionOrgIds: vi.fn(async (userId: string) =>
      [...store.sessionOrgs].filter((id) => id.startsWith(legacyPrefix(userId)))
    ),
    revokeTokens: vi.fn(async (userId: string) => {
      store.activeTokens.delete(userId);
    }),
  };

  return { ...base, ...overrides } as Partial<ProvisionDeps>;
}

const INPUT = {
  normalizedEmail: 'ops-demo-002+saga@fixture.invalid',
  hashedPassword: 'not-a-real-hash',
  firstName: 'Fixture',
  acceptedLegalDocs: ['TOS', 'PRIVACY'],
  locale: 'en',
  ipAddress: '203.0.113.7',
  userAgent: 'vitest',
};

describe('public demo signup saga', () => {
  let store: FakeStore;

  beforeEach(() => {
    store = new FakeStore();
    process.env.DEMO_ORG_ID = BASE_ORG;
  });

  it('happy path leaves every artefact in place', async () => {
    const result = await provisionPublicDemoAccount(INPUT, makeDeps(store));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(store.users.has(result.userId)).toBe(true);
    expect(store.memberships.has(result.userId)).toBe(true);
    expect(store.sessions.has(result.userId)).toBe(true);
    expect(store.activeTokens.has(result.userId)).toBe(true);
    expect(result.session.session_org_id).not.toBe(BASE_ORG);
    expect(result.tokens.accessToken).toBeTruthy();

    // The run owns its tenant by name: the id carries the full run id, so it can
    // be matched with `=` and can never collide with another run.
    expect(result.runId).toBeTruthy();
    expect(result.tenantOrgId).toBe(tenantOrgIdFor(result.runId));
    expect(result.session.session_org_id).toBe(result.tenantOrgId);
  });

  // ---------------------------------------------------------------------------
  // (a) failure during the seed
  // ---------------------------------------------------------------------------
  it('a) seed failure unwinds everything and reports complete compensation', async () => {
    const result = await provisionPublicDemoAccount(
      INPUT,
      makeDeps(store, {
        startSession: vi.fn(async () => {
          throw new Error('seed exploded');
        }),
      })
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failedStep).toBe('start_demo_session');
    expect(result.compensation.complete).toBe(true);
    expect(result.retrySafe).toBe(true);
    expect(store.users.size).toBe(0);
    expect(store.memberships.size).toBe(0);
    expect(store.preferences.size).toBe(0);
    expect(store.legal.size).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // (b) org created, then failure before the demo_sessions row exists
  // ---------------------------------------------------------------------------
  it('b) an orphan session org created before the demo_sessions row is deleted by exact id', async () => {
    // This is the case a return-value-based compensation cannot reach: the tenant
    // org exists, but startSession threw before anything returned its id. It is
    // reachable now because the saga chose the id itself.
    const deleted: string[] = [];
    const result = await provisionPublicDemoAccount(
      INPUT,
      makeDeps(store, {
        startSession: vi.fn(async (_userId: string, _locale: string, tenantOrgId?: string) => {
          store.sessionOrgs.add(tenantOrgId || `${legacyPrefix(_userId)}orphan`);
          throw new Error('failed after seeding the tenant org');
        }),
        deleteSessionTenant: vi.fn(async (organizationId: string) => {
          deleted.push(organizationId);
          store.sessionOrgs.delete(organizationId);
        }),
      })
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failedStep).toBe('start_demo_session');
    expect(store.sessionOrgs.size).toBe(0);
    expect(result.compensation.complete).toBe(true);

    // Exact identity, not a prefix sweep: one delete, for the id this run owns.
    expect(deleted).toEqual([result.tenantOrgId]);
    expect(result.tenantOrgId).toBe(tenantOrgIdFor(result.runId));
  });

  // ---------------------------------------------------------------------------
  // (c) failure while writing preferences
  // ---------------------------------------------------------------------------
  it('c) preferences failure unwinds the user and membership', async () => {
    const result = await provisionPublicDemoAccount(
      INPUT,
      makeDeps(store, {
        setDemoPreferences: vi.fn(async () => {
          throw new Error('preference storage unavailable');
        }),
      })
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failedStep).toBe('set_demo_preferences');
    expect(result.compensation.complete).toBe(true);
    expect(store.users.size).toBe(0);
    expect(store.memberships.size).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // (d) failure while issuing tokens
  // ---------------------------------------------------------------------------
  it('d) token failure unwinds the seeded tenant as well', async () => {
    const result = await provisionPublicDemoAccount(
      INPUT,
      makeDeps(store, {
        issueTokens: vi.fn(async () => {
          throw new Error('token signing failed');
        }),
      })
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failedStep).toBe('issue_tokens');
    expect(result.compensation.complete).toBe(true);
    expect(store.sessions.size).toBe(0);
    expect(store.sessionOrgs.size).toBe(0);
    expect(store.users.size).toBe(0);
  });

  it('membership failure unwinds the user', async () => {
    const result = await provisionPublicDemoAccount(
      INPUT,
      makeDeps(store, {
        insertMembership: vi.fn(async () => {
          throw new Error('CHECK constraint violated');
        }),
      })
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failedStep).toBe('insert_membership');
    expect(store.users.size).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // Partial write, THEN throw. The compensation is registered before the forward
  // call precisely so these cases are reachable.
  // ---------------------------------------------------------------------------
  it('legal acceptance that writes a row and then throws is still unwound', async () => {
    // legalService.acceptDocuments writes one acceptance per document, so failing
    // on the second leaves the first behind. The step is non-fatal, so the row
    // has to be unwound by a LATER failure — here, token issuance.
    const result = await provisionPublicDemoAccount(
      INPUT,
      makeDeps(store, {
        recordLegalAcceptance: vi.fn(async ({ userId }: { userId: string }) => {
          store.legal.add(userId); // first document committed
          throw new Error('legal service died on the second document');
        }),
        issueTokens: vi.fn(async () => {
          throw new Error('token signing failed');
        }),
      })
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failedStep).toBe('issue_tokens');
    expect(store.legal.size).toBe(0);
    const legalStep = result.compensation.steps.find((s) => s.step === 'record_legal_acceptance');
    expect(legalStep?.ok).toBe(true);
    expect(legalStep?.verified).toBe(true);
    expect(result.compensation.complete).toBe(true);
    expect(result.retrySafe).toBe(true);
  });

  it('preferences that write demo:enabled and then throw before the marker are unwound', async () => {
    const result = await provisionPublicDemoAccount(
      INPUT,
      makeDeps(store, {
        setDemoPreferences: vi.fn(async (arg: string | { userId: string }) => {
          const userId = typeof arg === 'string' ? arg : arg.userId;
          store.preferences.add(userId); // demo:enabled committed
          throw new Error('marker write failed after demo:enabled');
        }),
      })
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failedStep).toBe('set_demo_preferences');
    expect(store.preferences.size).toBe(0);
    const prefStep = result.compensation.steps.find((s) => s.step === 'set_demo_preferences');
    expect(prefStep?.ok).toBe(true);
    expect(prefStep?.verified).toBe(true);
    expect(result.compensation.complete).toBe(true);
    expect(store.isEmptyFor(result.userId)).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Concurrency: one run's rollback must never touch another run's tenant.
  // ---------------------------------------------------------------------------
  it('a concurrent signup\'s tenant survives this run\'s rollback', async () => {
    // The bug this proves gone: the compensation swept
    // `<base>-session-<first 10 alphanumerics of the user id>-%`, so any other
    // live tenant whose owner shares those 10 characters was deleted too.
    //
    // The other signup is modelled as an already-provisioned tenant sitting in
    // the store under BOTH shapes of id: a legacy-derived one that collides with
    // the failing run on its 10-character prefix, and the id a second saga run
    // would own today. Neither may be touched.
    const failing = await provisionPublicDemoAccount(
      INPUT,
      makeDeps(store, {
        startSession: vi.fn(async (userId: string, _locale: string, tenantOrgId?: string) => {
          // A concurrent signup that has already seeded its own tenant. Its user
          // id shares the first 10 alphanumerics with ours — that is all the old
          // prefix sweep needed to delete it.
          store.sessionOrgs.add(`${legacyPrefix(userId)}neighbour`);
          store.sessionOrgs.add(tenantOrgIdFor('ffffffff-ffff-4fff-8fff-ffffffffffff'));
          // …and then our own tenant is seeded, and the step dies.
          store.sessionOrgs.add(tenantOrgId || `${legacyPrefix(userId)}mine`);
          throw new Error('failed after seeding the tenant org');
        }),
      })
    );

    expect(failing.ok).toBe(false);
    if (failing.ok) return;

    // Our tenant is gone…
    expect(store.sessionOrgs.has(failing.tenantOrgId)).toBe(false);
    // …and the neighbour's two tenants are untouched.
    expect(store.sessionOrgs.size).toBe(2);
    expect(
      [...store.sessionOrgs].some((id) => id.endsWith('neighbour'))
    ).toBe(true);
    expect(
      store.sessionOrgs.has(tenantOrgIdFor('ffffffff-ffff-4fff-8fff-ffffffffffff'))
    ).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Retry after every failure
  // ---------------------------------------------------------------------------
  it.each([
    ['start_demo_session', { startSession: () => Promise.reject(new Error('boom')) }],
    ['set_demo_preferences', { setDemoPreferences: () => Promise.reject(new Error('boom')) }],
    ['issue_tokens', { issueTokens: () => Promise.reject(new Error('boom')) }],
    ['insert_membership', { insertMembership: () => Promise.reject(new Error('boom')) }],
  ])('after a %s failure the same address can register again', async (_step, override) => {
    const failed = await provisionPublicDemoAccount(
      INPUT,
      makeDeps(store, override as Record<string, unknown>)
    );
    expect(failed.ok).toBe(false);

    // Nothing left behind means the duplicate check will not reject the retry.
    expect(store.users.size).toBe(0);
    expect(store.sessionOrgs.size).toBe(0);

    const retry = await provisionPublicDemoAccount(INPUT, makeDeps(store));
    expect(retry.ok).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Incomplete compensation must be reported, never assumed
  // ---------------------------------------------------------------------------
  it('reports incomplete compensation when an undo silently does nothing', async () => {
    const result = await provisionPublicDemoAccount(
      INPUT,
      makeDeps(store, {
        issueTokens: vi.fn(async () => {
          throw new Error('token signing failed');
        }),
        // The delete "succeeds" but removes nothing — the exact shape of a
        // half-rollback that used to pass unnoticed.
        deleteRows: vi.fn(async () => {}),
      })
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.compensation.complete).toBe(false);
    expect(result.retrySafe).toBe(false);
    const userStep = result.compensation.steps.find((s) => s.step === 'insert_user');
    expect(userStep?.ok).toBe(false);
    expect(userStep?.verified).toBe(false);
    expect(userStep?.error).toBeTruthy();
  });

  it('reports incomplete compensation when an undo throws', async () => {
    const result = await provisionPublicDemoAccount(
      INPUT,
      makeDeps(store, {
        issueTokens: vi.fn(async () => {
          throw new Error('token signing failed');
        }),
        deleteSessionTenant: vi.fn(async () => {
          throw new Error('tenant delete failed');
        }),
      })
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.compensation.complete).toBe(false);
    expect(result.retrySafe).toBe(false);
    const sessionStep = result.compensation.steps.find((s) => s.step === 'start_demo_session');
    expect(sessionStep?.ok).toBe(false);
    expect(sessionStep?.error).toContain('tenant delete failed');
  });

  it('unwinds in reverse order', async () => {
    const order: string[] = [];
    const store2 = new FakeStore();
    const deps = makeDeps(store2, {
      issueTokens: vi.fn(async () => {
        throw new Error('token signing failed');
      }),
    });
    const result = await provisionPublicDemoAccount(INPUT, {
      ...deps,
      deleteRows: vi.fn(async (sql: string, params: unknown[]) => {
        order.push(tableOf(sql) || '?');
        await deps.deleteRows!(sql, params);
      }),
    });

    expect(result.ok).toBe(false);
    // demo_sessions before user_preferences before organization_members before users.
    expect(order.indexOf('demo_sessions')).toBeLessThan(order.indexOf('user_preferences'));
    expect(order.indexOf('user_preferences')).toBeLessThan(order.indexOf('organization_members'));
    expect(order.indexOf('organization_members')).toBeLessThan(order.indexOf('users'));
  });

  it('a legal-acceptance failure is non-fatal and does not abort the signup', async () => {
    const result = await provisionPublicDemoAccount(
      INPUT,
      makeDeps(store, {
        recordLegalAcceptance: vi.fn(async () => {
          throw new Error('legal service down');
        }),
      })
    );
    expect(result.ok).toBe(true);
  });

  it('never assigns a privileged role', () => {
    expect(['SUPERADMIN', 'SUPER_ADMIN', 'OWNER', 'ADMIN']).not.toContain(DEMO_SIGNUP_ROLE);
  });
});
