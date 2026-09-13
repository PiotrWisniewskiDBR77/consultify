import bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  AccessCodeRegistrationError,
  type AccessCodeRegistrationTransaction,
  registerWithAccessCode,
} from '../accessCodeRegistrationService.js';

type State = {
  organization: { id: string; name: string; status: string };
  creator: { id: string; role: string };
  creatorMembership: { organizationId: string; userId: string; status: string } | null;
  code: {
    id: string;
    code: string;
    organization_id: string;
    role: string;
    max_uses: number;
    current_uses: number;
    uses_count: number;
    expires_at: string | null;
    is_active: number;
    created_by: string;
    created_by_user_id: string | null;
  };
  users: Array<Record<string, unknown>>;
  memberships: Array<Record<string, unknown>>;
  usages: Array<Record<string, unknown>>;
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function fixture(overrides: Partial<State> = {}) {
  const state: State = {
    organization: { id: 'org-a', name: 'Alpha', status: 'active' },
    creator: { id: 'owner-a', role: 'OWNER' },
    creatorMembership: { organizationId: 'org-a', userId: 'owner-a', status: 'ACTIVE' },
    code: {
      id: 'code-a',
      code: 'JOIN-A',
      organization_id: 'org-a',
      role: 'ADMIN',
      max_uses: 1,
      current_uses: 0,
      uses_count: 0,
      expires_at: '2099-01-01T00:00:00.000Z',
      is_active: 1,
      created_by: 'owner-a',
      created_by_user_id: 'owner-a',
    },
    users: [],
    memberships: [],
    usages: [],
    ...overrides,
  };
  let failMembership = false;
  let failUsage = false;

  const transaction = async <T>(work: (tx: AccessCodeRegistrationTransaction) => Promise<T>) => {
    const before = clone(state);
    const tx: AccessCodeRegistrationTransaction = {
      queryOne: async (sql, params = []) => {
        if (sql.includes('FROM access_codes ac')) {
          if (params[0] !== state.code.code) return null;
          return {
            ...state.code,
            org_id: state.organization.id,
            org_name: state.organization.name,
            org_status: state.organization.status,
            is_expired: false,
          } as never;
        }
        if (sql.includes('FROM users WHERE LOWER(email)')) {
          return (state.users.find((row) => row.email === params[0]) || null) as never;
        }
        if (sql.includes('FROM users WHERE id')) {
          return (params[0] === state.creator.id ? state.creator : null) as never;
        }
        if (sql.includes('FROM organization_members')) {
          const membership = state.creatorMembership;
          return (
            membership &&
            membership.userId === params[0] &&
            membership.organizationId === params[1] &&
            membership.status === 'ACTIVE'
              ? { id: 'creator-membership' }
              : null
          ) as never;
        }
        return null;
      },
      queryRun: async (sql, params = []) => {
        if (sql.includes('INSERT INTO users')) {
          state.users.push({
            id: params[0],
            organization_id: params[1],
            email: params[2],
            password: params[3],
            first_name: params[4],
            last_name: params[5],
            role: params[6],
            status: 'active',
          });
          return { changes: 1 };
        }
        if (sql.includes('INSERT INTO organization_members')) {
          if (failMembership) throw new Error('membership insert failed');
          state.memberships.push({
            id: params[0],
            organization_id: params[1],
            user_id: params[2],
            role: params[3],
            status: 'ACTIVE',
          });
          return { changes: 1 };
        }
        if (sql.includes('UPDATE access_codes')) {
          if (
            state.code.current_uses >= state.code.max_uses ||
            state.code.uses_count >= state.code.max_uses
          )
            return { changes: 0 };
          state.code.current_uses += 1;
          state.code.uses_count += 1;
          return { changes: 1 };
        }
        if (sql.includes('INSERT INTO access_code_usage')) {
          if (failUsage) throw new Error('usage receipt insert failed');
          state.usages.push({ id: params[0], code_id: params[1], user_id: params[2] });
          return { changes: 1 };
        }
        return { changes: 1 };
      },
    };
    try {
      return await work(tx);
    } catch (error) {
      Object.assign(state, before);
      throw error;
    }
  };

  return {
    state,
    transaction,
    failMembership() {
      failMembership = true;
    },
    failUsage() {
      failUsage = true;
    },
  };
}

describe('access-code registration atomic membership contract', () => {
  let sequence: number;

  beforeEach(() => {
    sequence = 0;
  });

  function ids() {
    sequence += 1;
    return `generated-${sequence}`;
  }

  it('creates a same-organization ACTIVE membership with the code role and a login-compatible password', async () => {
    const db = fixture();
    const result = await registerWithAccessCode(
      {
        code: 'JOIN-A',
        email: 'reviewer@example.test',
        password: 'Reviewer-pass-1!',
        firstName: 'Review',
        lastName: 'Admin',
      },
      { transaction: db.transaction, createId: ids, now: () => new Date('2026-09-13T12:00:00Z') }
    );

    expect(result).toMatchObject({ organizationId: 'org-a', role: 'ADMIN' });
    expect(db.state.memberships).toEqual([
      expect.objectContaining({
        organization_id: 'org-a',
        user_id: result.userId,
        role: 'ADMIN',
        status: 'ACTIVE',
      }),
    ]);
    expect(bcrypt.compareSync('Reviewer-pass-1!', String(db.state.users[0]?.password))).toBe(true);
    expect(db.state.code.current_uses).toBe(1);
    expect(db.state.usages).toEqual([
      expect.objectContaining({ code_id: 'code-a', user_id: result.userId }),
    ]);
  });

  it('rolls back the user, membership, usage, and code consumption when membership persistence fails', async () => {
    const db = fixture();
    const before = clone(db.state);
    db.failMembership();

    await expect(
      registerWithAccessCode(
        {
          code: 'JOIN-A',
          email: 'rollback@example.test',
          password: 'Reviewer-pass-1!',
          firstName: 'Roll',
          lastName: 'Back',
        },
        { transaction: db.transaction, createId: ids, now: () => new Date('2026-09-13T12:00:00Z') }
      )
    ).rejects.toThrow('membership insert failed');
    expect(db.state).toEqual(before);
  });

  it('rolls back the user, membership, and consumed code when usage receipt persistence fails', async () => {
    const db = fixture();
    const before = clone(db.state);
    db.failUsage();

    await expect(
      registerWithAccessCode(
        {
          code: 'JOIN-A',
          email: 'usage-rollback@example.test',
          password: 'Reviewer-pass-1!',
          firstName: 'Usage',
          lastName: 'Rollback',
        },
        { transaction: db.transaction, createId: ids, now: () => new Date('2026-09-13T12:00:00Z') }
      )
    ).rejects.toThrow('usage receipt insert failed');
    expect(db.state).toEqual(before);
  });

  it('refuses a blocking organization before creating or consuming anything', async () => {
    const db = fixture({ organization: { id: 'org-a', name: 'Alpha', status: 'suspended' } });
    const before = clone(db.state);

    await expect(
      registerWithAccessCode(
        {
          code: 'JOIN-A',
          email: 'suspended@example.test',
          password: 'Reviewer-pass-1!',
          firstName: 'Suspended',
          lastName: 'User',
        },
        { transaction: db.transaction, createId: ids, now: () => new Date('2026-09-13T12:00:00Z') }
      )
    ).rejects.toMatchObject<Partial<AccessCodeRegistrationError>>({
      reason: 'ORGANIZATION_BLOCKED',
      blockingStatus: 'suspended',
    });
    expect(db.state).toEqual(before);
  });

  it('refuses a code whose creator is not an active member of its bound organization', async () => {
    const db = fixture({ creatorMembership: null });
    const before = clone(db.state);

    await expect(
      registerWithAccessCode(
        {
          code: 'JOIN-A',
          email: 'foreign@example.test',
          password: 'Reviewer-pass-1!',
          firstName: 'Foreign',
          lastName: 'User',
        },
        { transaction: db.transaction, createId: ids, now: () => new Date('2026-09-13T12:00:00Z') }
      )
    ).rejects.toMatchObject<Partial<AccessCodeRegistrationError>>({
      reason: 'CODE_ORG_MISMATCH',
    });
    expect(db.state).toEqual(before);
  });

  it('preserves single-use semantics under the locked transactional state', async () => {
    const db = fixture();
    const deps = {
      transaction: db.transaction,
      createId: ids,
      now: () => new Date('2026-09-13T12:00:00Z'),
    };
    await registerWithAccessCode(
      {
        code: 'JOIN-A',
        email: 'first@example.test',
        password: 'Reviewer-pass-1!',
        firstName: 'First',
        lastName: 'User',
      },
      deps
    );

    await expect(
      registerWithAccessCode(
        {
          code: 'JOIN-A',
          email: 'second@example.test',
          password: 'Reviewer-pass-1!',
          firstName: 'Second',
          lastName: 'User',
        },
        deps
      )
    ).rejects.toMatchObject<Partial<AccessCodeRegistrationError>>({ reason: 'CODE_EXHAUSTED' });
    expect(db.state.users).toHaveLength(1);
    expect(db.state.memberships).toHaveLength(1);
    expect(db.state.usages).toHaveLength(1);
  });

  it('refuses consumption already recorded by the hash-model counter', async () => {
    const db = fixture();
    db.state.code.uses_count = 1;
    const before = clone(db.state);

    await expect(
      registerWithAccessCode(
        {
          code: 'JOIN-A',
          email: 'dual-counter@example.test',
          password: 'Reviewer-pass-1!',
          firstName: 'Dual',
          lastName: 'Counter',
        },
        { transaction: db.transaction, createId: ids, now: () => new Date('2026-09-13T12:00:00Z') }
      )
    ).rejects.toMatchObject<Partial<AccessCodeRegistrationError>>({ reason: 'CODE_EXHAUSTED' });
    expect(db.state).toEqual(before);
  });
});
