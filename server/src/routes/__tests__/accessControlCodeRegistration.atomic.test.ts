import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type StoredState = {
  organizationStatus: string;
  creatorHasMembership: boolean;
  codeExpired: boolean;
  codeRole: string;
  currentUses: number;
  usesCount: number;
  users: Array<Record<string, unknown>>;
  memberships: Array<Record<string, unknown>>;
  usages: Array<Record<string, unknown>>;
};

let state: StoredState;
let failMembership: boolean;
let failUsage: boolean;

function resetState() {
  state = {
    organizationStatus: 'active',
    creatorHasMembership: true,
    codeExpired: false,
    codeRole: 'ADMIN',
    currentUses: 0,
    usesCount: 0,
    users: [],
    memberships: [],
    usages: [],
  };
  failMembership = false;
  failUsage = false;
}

function copyState(): StoredState {
  return JSON.parse(JSON.stringify(state));
}

async function queryOne(sql: string, params: unknown[] = []) {
  if (sql.includes('FROM access_codes ac')) {
    if (params[0] !== 'JOIN-A') return null;
    return {
      id: 'code-a',
      code: 'JOIN-A',
      organization_id: 'org-a',
      role: state.codeRole,
      max_uses: 1,
      current_uses: state.currentUses,
      uses_count: state.usesCount,
      expires_at: '2099-01-01T00:00:00.000Z',
      is_expired: state.codeExpired,
      is_active: 1,
      created_by: 'owner-a',
      created_by_user_id: 'owner-a',
      org_id: 'org-a',
      org_name: 'Alpha',
      org_status: state.organizationStatus,
    };
  }
  if (sql.includes('FROM users WHERE LOWER(email)') || sql.includes('FROM users WHERE email')) {
    return state.users.find((row) => row.email === params[0]) || null;
  }
  if (sql.includes('FROM users WHERE id')) return { id: 'owner-a', role: 'OWNER' };
  if (sql.includes('FROM organization_members')) {
    return state.creatorHasMembership ? { id: 'owner-membership' } : null;
  }
  return null;
}

async function queryRun(sql: string, params: unknown[] = []) {
  if (sql.includes('INSERT INTO users')) {
    state.users.push({
      id: params[0],
      organization_id: params[1],
      email: params[2],
      password: params[3],
      role: params[6],
      status: 'active',
    });
    return { changes: 1, success: true };
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
    return { changes: 1, success: true };
  }
  if (sql.includes('UPDATE access_codes')) {
    if (state.currentUses >= 1 || state.usesCount >= 1) return { changes: 0, success: false };
    state.currentUses += 1;
    state.usesCount += 1;
    return { changes: 1, success: true };
  }
  if (sql.includes('INSERT INTO access_code_usage')) {
    if (failUsage) throw new Error('usage receipt insert failed');
    state.usages.push({ id: params[0], code_id: params[1], user_id: params[2] });
    return { changes: 1, success: true };
  }
  return { changes: 1, success: true };
}

vi.mock('../../database/PostgresDatabase.js', async (loadOriginal) => {
  const original = await loadOriginal<typeof import('../../database/PostgresDatabase.js')>();
  return {
    ...original,
    withPinnedPostgresTransaction: async <T>(work: (tx: unknown) => Promise<T>) => {
      const before = copyState();
      try {
        return await work({ queryOne, queryRun });
      } catch (error) {
        state = before;
        throw error;
      }
    },
  };
});
vi.mock('../../utils/DbPromise.js', () => ({
  all: vi.fn(),
  get: (sql: string, params?: unknown[]) => queryOne(sql, params),
  run: (sql: string, params?: unknown[]) => queryRun(sql, params),
}));
vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock('../../middleware/admin.middleware.js', () => ({
  verifyAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock('../../middleware/superAdmin.middleware.js', () => ({
  verifySuperAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock('../../middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock('../../services/accessCodeService.js', () => ({ default: {} }));

async function app() {
  const { default: router } = await import('../access-control.routes.js');
  const instance = express();
  instance.use(express.json());
  instance.use('/api/access-control', router);
  return instance;
}

async function register(email: string) {
  return request(await app())
    .post('/api/access-control/codes/register')
    .send({
      code: 'JOIN-A',
      email,
      password: 'Reviewer-pass-1!',
      firstName: 'Review',
      lastName: 'Admin',
    });
}

describe('POST /access-control/codes/register atomic membership contract', () => {
  beforeEach(resetState);

  it('creates the ACTIVE same-org membership required by the login guard', async () => {
    const response = await register('reviewer@example.test');

    expect(response.status).toBe(200);
    expect(state.memberships).toEqual([
      expect.objectContaining({
        organization_id: 'org-a',
        user_id: response.body.user.id,
        role: 'ADMIN',
        status: 'ACTIVE',
      }),
    ]);
    expect(
      state.memberships.some(
        (row) =>
          row.user_id === response.body.user.id &&
          row.organization_id === 'org-a' &&
          row.status === 'ACTIVE'
      )
    ).toBe(true);
  });

  it('rolls back the user and code consumption when membership creation fails', async () => {
    const before = copyState();
    failMembership = true;

    const response = await register('rollback@example.test');

    expect(response.status).toBe(500);
    expect(state).toEqual(before);
  });

  it('rolls back the user, membership, and consumed code when the usage receipt fails', async () => {
    const before = copyState();
    failUsage = true;

    const response = await register('usage-rollback@example.test');

    expect(response.status).toBe(500);
    expect(state).toEqual(before);
  });

  it('does not onboard into a suspended organization', async () => {
    state.organizationStatus = 'suspended';
    const before = copyState();

    const response = await register('suspended@example.test');

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('ORG_SUSPENDED');
    expect(state).toEqual(before);
  });

  it('preserves expiry refusal without consuming the code', async () => {
    state.codeExpired = true;
    const before = copyState();

    const response = await register('expired@example.test');

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('This access code has expired');
    expect(state).toEqual(before);
  });

  it('does not honor an org-bound code whose creator lost same-org membership', async () => {
    state.creatorHasMembership = false;
    const before = copyState();

    const response = await register('foreign@example.test');

    expect(response.status).toBe(400);
    expect(response.body.errorCode).toBe('ACCESS_CODE_ORG_MISMATCH');
    expect(state).toEqual(before);
  });

  it('does not create a user from a code carrying a role outside the membership domain', async () => {
    state.codeRole = 'SUPERADMIN';
    const before = copyState();

    const response = await register('invalid-role@example.test');

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('This access code has an invalid organization role');
    expect(state).toEqual(before);
  });

  it('preserves single-use behavior without creating a second account', async () => {
    expect((await register('first@example.test')).status).toBe(200);
    const response = await register('second@example.test');

    expect(response.status).toBe(400);
    expect(state.currentUses).toBe(1);
    expect(state.users).toHaveLength(1);
    expect(state.usages).toHaveLength(1);
  });

  it('refuses a code already consumed through the hash-model counter', async () => {
    state.usesCount = 1;
    const before = copyState();

    const response = await register('dual-counter@example.test');

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('This access code has reached its usage limit');
    expect(state).toEqual(before);
  });
});
