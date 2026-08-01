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
 * Faults are injected through the saga's dependency seam. No production fault
 * switch, no environment backdoor.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEMO_SIGNUP_ROLE,
  type ProvisionDeps,
  provisionPublicDemoAccount,
  sessionOrgIdPrefix,
} from '../../../../server/src/services/demo/demoSignupProvisioning.js';

const BASE_ORG = 'demo-org';

/**
 * Minimal stand-in for the rows the saga writes. `deleteRows`/`countRows` are
 * matched on table name, which is safe because the SQL strings are authored by
 * the module under test and are fixed.
 */
class FakeStore {
  users = new Set<string>();
  memberships = new Set<string>();
  legal = new Set<string>();
  preferences = new Set<string>();
  sessions = new Set<string>();
  sessionTenants = new Set<string>();
  activeTokens = new Set<string>();
  sessionOrgs = new Set<string>();

  isEmptyFor(userId: string): boolean {
    return (
      !this.users.has(userId) &&
      !this.memberships.has(userId) &&
      !this.legal.has(userId) &&
      !this.preferences.has(userId) &&
      !this.sessions.has(userId) &&
      !this.sessionTenants.has(userId) &&
      !this.activeTokens.has(userId) &&
      this.sessionOrgs.size === 0
    );
  }
}

function tableOf(sql: string): string {
  return /FROM\s+([a-z_]+)/i.exec(sql)?.[1] || '';
}

function makeDeps(store: FakeStore, overrides: Partial<ProvisionDeps> = {}): Partial<ProvisionDeps> {
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

  const base: Partial<ProvisionDeps> = {
    ensureDemoOrg: vi.fn(async () => {}),
    insertUser: vi.fn(async ({ userId }) => {
      store.users.add(userId);
    }),
    insertMembership: vi.fn(async ({ userId }) => {
      store.memberships.add(userId);
    }),
    recordLegalAcceptance: vi.fn(async ({ userId }) => {
      store.legal.add(userId);
    }),
    setDemoPreferences: vi.fn(async (userId) => {
      store.preferences.add(userId);
    }),
    startSession: vi.fn(async (userId) => {
      const sessionOrgId = `${sessionOrgIdPrefix(userId, BASE_ORG)}abc`;
      store.sessionOrgs.add(sessionOrgId);
      store.sessions.add(userId);
      store.sessionTenants.add(userId);
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
    issueTokens: vi.fn(async ({ id }) => {
      store.activeTokens.add(id);
      return { accessToken: 'access', refreshToken: 'refresh' };
    }),
    readUser: vi.fn(async (userId) => (store.users.has(userId) ? { id: userId } : null)),
    countRows: vi.fn(async (sql, params) => {
      const target = setFor(tableOf(sql));
      const userId = String(params?.[0] ?? '');
      return target?.has(userId) ? 1 : 0;
    }),
    deleteRows: vi.fn(async (sql, params) => {
      const target = setFor(tableOf(sql) || /DELETE\s+FROM\s+([a-z_]+)/i.exec(sql)?.[1] || '');
      target?.delete(String(params?.[0] ?? ''));
    }),
    deleteSessionTenant: vi.fn(async (organizationId) => {
      store.sessionOrgs.delete(organizationId);
    }),
    findSessionOrgIds: vi.fn(async (userId) =>
      [...store.sessionOrgs].filter((id) => id.startsWith(sessionOrgIdPrefix(userId, BASE_ORG)))
    ),
    revokeTokens: vi.fn(async (userId) => {
      store.activeTokens.delete(userId);
    }),
  };

  return { ...base, ...overrides };
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
    expect(store.users.size).toBe(0);
    expect(store.memberships.size).toBe(0);
    expect(store.preferences.size).toBe(0);
    expect(store.legal.size).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // (b) org created, then failure before the demo_sessions row exists
  // ---------------------------------------------------------------------------
  it('b) an orphan session org created before the demo_sessions row is still swept', async () => {
    // This is the case a return-value-based compensation cannot reach: the tenant
    // org exists, but startSession threw before anything named it.
    const result = await provisionPublicDemoAccount(
      INPUT,
      makeDeps(store, {
        startSession: vi.fn(async (userId: string) => {
          store.sessionOrgs.add(`${sessionOrgIdPrefix(userId, BASE_ORG)}orphan`);
          throw new Error('failed after seeding the tenant org');
        }),
      })
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failedStep).toBe('start_demo_session');
    expect(store.sessionOrgs.size).toBe(0);
    expect(result.compensation.complete).toBe(true);
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
      makeDeps(store, override as Partial<ProvisionDeps>)
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
        order.push(tableOf(sql) || /DELETE\s+FROM\s+([a-z_]+)/i.exec(sql)?.[1] || '?');
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
