import { describe, expect, it, beforeAll, afterAll, beforeEach, vi } from 'vitest';

type DbHandle = {
  exec: (sql: string) => Promise<unknown>;
  run: (sql: string, params?: unknown[]) => Promise<unknown>;
};

const RUN_DB_TESTS = process.env.RUN_DB_TESTS === '1';
const describeIfDb = RUN_DB_TESTS ? describe : describe.skip;

describeIfDb('orgContext.middleware (L1)', () => {
  const prevEnv = { ...process.env };
  const workerId = process.env.VITEST_WORKER_ID || '0';
  const sqlitePath = `./test-org-context-${workerId}.db`;

  let db: DbHandle;
  let resetConnection: () => Promise<void>;
  let orgContextMiddleware: any;
  let getUserOrganizations: any;
  let resolveUserOrgAccess: any;

  beforeAll(async () => {
    process.env.MOCK_DB = 'false';
    process.env.SQLITE_PATH = sqlitePath;
    process.env.NODE_ENV = 'test';

    vi.resetModules();

    const dbMod = await import('../../../../server/src/database/Database.js');
    resetConnection = dbMod.resetConnection;
    await resetConnection();
    db = dbMod.getDatabase();

    await db.exec(`
      CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        plan TEXT,
        status TEXT,
        is_active INTEGER DEFAULT 1
      );
      CREATE TABLE IF NOT EXISTS organization_members (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL,
        status TEXT NOT NULL,
        permission_scope TEXT
      );
      CREATE TABLE IF NOT EXISTS consultant_org_links (
        id TEXT PRIMARY KEY,
        consultant_id TEXT NOT NULL,
        organization_id TEXT NOT NULL,
        status TEXT NOT NULL,
        permission_scope TEXT
      );
    `);

    const mod = await import('../../../../server/src/middleware/orgContext.middleware.ts');
    orgContextMiddleware = mod.default;
    getUserOrganizations = mod.getUserOrganizations;
    resolveUserOrgAccess = mod.resolveUserOrgAccess;
  });

  afterAll(async () => {
    try {
      await resetConnection?.();
    } finally {
      process.env = prevEnv;
    }
  });

  beforeEach(async () => {
    await db.exec(`
      DELETE FROM organization_members
      WHERE organization_id NOT IN (
        SELECT organization_id FROM users WHERE organization_id IS NOT NULL
      );
      DELETE FROM consultant_org_links
      WHERE organization_id NOT IN (
        SELECT organization_id FROM users WHERE organization_id IS NOT NULL
      );
      DELETE FROM organizations AS organization
      WHERE NOT EXISTS (
        SELECT 1 FROM users WHERE users.organization_id = organization.id
      );
    `);
  });

  it('returns 401 when user missing and required=true', async () => {
    const mw = orgContextMiddleware();
    const req: any = { method: 'GET', params: {}, headers: {}, user: undefined };
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();
    await mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('no-ops when user missing and required=false (sets req.org=null)', async () => {
    const mw = orgContextMiddleware({ required: false });
    const req: any = { method: 'GET', params: {}, headers: {}, user: undefined };
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();
    await mw(req, res, next);
    expect(req.org).toBeNull();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('returns 401 when user id accessor throws and required=true', async () => {
    const mw = orgContextMiddleware({ required: true });
    const user: Record<string, unknown> = {};
    Object.defineProperty(user, 'id', {
      enumerable: true,
      get: () => {
        throw new Error('user id getter failed');
      },
    });
    const req: any = {
      method: 'GET',
      params: { orgId: 'org1' },
      headers: {},
      user,
    };
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();
    await mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when user id exceeds safety limit and required=true', async () => {
    const mw = orgContextMiddleware({ required: true });
    const req: any = {
      method: 'GET',
      params: { orgId: 'org1' },
      headers: {},
      user: { id: 'u'.repeat(129) },
    };
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();

    await mw(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when user id contains control characters and required=true', async () => {
    const mw = orgContextMiddleware({ required: true });
    const req: any = {
      method: 'GET',
      params: { orgId: 'org1' },
      headers: {},
      user: { id: 'u1\u0000x' },
    };
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();

    await mw(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when req.user accessor throws and required=true', async () => {
    const mw = orgContextMiddleware({ required: true });
    const req: any = {
      method: 'GET',
      params: { orgId: 'org1' },
      headers: {},
    };
    Object.defineProperty(req, 'user', {
      configurable: true,
      get: () => {
        throw new Error('user accessor failed');
      },
    });
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();
    await mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('requires explicit orgId for write when strictWrite=true', async () => {
    const mw = orgContextMiddleware({ strictWrite: true, allowHeader: false });
    const req: any = {
      method: 'POST',
      params: {},
      headers: {},
      user: { id: 'u1', organizationId: '' },
    };
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();
    await mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('denies access when user is not a member/consultant (403)', async () => {
    await db.run(`INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`, [
      'org1',
      'Org 1',
      'pro',
      'active',
    ]);

    const mw = orgContextMiddleware({ required: true, strictWrite: true });
    const req: any = {
      method: 'GET',
      params: { orgId: 'org1' },
      headers: {},
      user: { id: 'u1', organizationId: '' },
    };
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();
    await mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Access denied' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches org context for ACTIVE membership (url param)', async () => {
    await db.run(`INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`, [
      'org1',
      'Org 1',
      'pro',
      'active',
    ]);
    await db.run(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status, permission_scope)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['m1', 'org1', 'u1', 'ADMIN', 'ACTIVE', JSON.stringify({ a: { b: 1 } })]
    );

    const mw = orgContextMiddleware();
    const req: any = {
      method: 'GET',
      params: { orgId: 'org1' },
      headers: {},
      user: { id: 'u1', organizationId: '' },
    };
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();
    await mw(req, res, next);

    expect(req.org).toEqual(
      expect.objectContaining({
        id: 'org1',
        isMember: true,
        isConsultant: false,
        role: 'ADMIN',
        membershipId: 'm1',
      })
    );
    expect(req.orgContext).toEqual(req.org);
    expect(Object.isFrozen(req.org)).toBe(true);
    expect(Object.isFrozen(req.orgContext)).toBe(true);
    expect(Object.isFrozen(req.org?.permissionScope)).toBe(true);
    expect(Object.isFrozen(req.org?.permissionScope?.a as object)).toBe(true);
    expect((req.org?.permissionScope as any)?.a?.b).toBe(1);
    expect(() => {
      'use strict';
      (req.org?.permissionScope as any).a.b = 2;
    }).toThrow();
    expect((req.org?.permissionScope as any)?.a?.b).toBe(1);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('ignores unsafe user default org id and returns 400 when required context is missing', async () => {
    const mw = orgContextMiddleware({ allowHeader: false, strictWrite: true, required: true });
    const req: any = {
      method: 'GET',
      params: {},
      headers: {},
      user: { id: 'u1', organizationId: 'org with-space' },
    };
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();

    await mw(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Organization context required',
      })
    );
    expect(req.org).toBeNull();
    expect(req.orgContext).toBeNull();
    expect(next).not.toHaveBeenCalled();
  });

  it('sanitizes whitespace-padded membership role before attaching org context', async () => {
    await db.run(`INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`, [
      'orgRoleTrim',
      'Org Role Trim',
      'pro',
      'active',
    ]);
    await db.run(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
       VALUES (?, ?, ?, ?, ?)`,
      ['mRoleTrim', 'orgRoleTrim', 'u1', '  ADMIN  ', 'ACTIVE']
    );

    const mw = orgContextMiddleware();
    const req: any = {
      method: 'GET',
      params: { orgId: 'orgRoleTrim' },
      headers: {},
      user: { id: 'u1', organizationId: '' },
    };
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();
    await mw(req, res, next);

    expect(req.org?.role).toBe('ADMIN');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('falls back to MEMBER role when membership role contains control characters', async () => {
    await db.run(`INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`, [
      'orgRoleCtrl',
      'Org Role Ctrl',
      'pro',
      'active',
    ]);
    await db.run(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
       VALUES (?, ?, ?, ?, ?)`,
      ['mRoleCtrl', 'orgRoleCtrl', 'u1', 'ADMIN\u0007', 'ACTIVE']
    );

    const mw = orgContextMiddleware();
    const req: any = {
      method: 'GET',
      params: { orgId: 'orgRoleCtrl' },
      headers: {},
      user: { id: 'u1', organizationId: '' },
    };
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();
    await mw(req, res, next);

    expect(req.org?.role).toBe('MEMBER');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('supports consultant access via consultant_org_links', async () => {
    await db.run(`INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`, [
      'org2',
      'Org 2',
      'pro',
      'active',
    ]);
    await db.run(
      `INSERT INTO consultant_org_links (id, consultant_id, organization_id, status, permission_scope)
       VALUES (?, ?, ?, ?, ?)`,
      ['l1', 'u1', 'org2', 'ACTIVE', JSON.stringify({ scope: 'read' })]
    );

    const mw = orgContextMiddleware();
    const req: any = {
      method: 'GET',
      params: { orgId: 'org2' },
      headers: {},
      user: { id: 'u1', organizationId: '' },
    };
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();
    await mw(req, res, next);

    expect(req.org).toEqual(
      expect.objectContaining({
        id: 'org2',
        isMember: false,
        isConsultant: true,
        role: 'CONSULTANT',
        membershipId: 'l1',
      })
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('supports allowHeader=true to read orgId from header', async () => {
    await db.run(`INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`, [
      'org3',
      'Org 3',
      'pro',
      'active',
    ]);
    await db.run(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
       VALUES (?, ?, ?, ?, ?)`,
      ['m3', 'org3', 'u1', 'ADMIN', 'ACTIVE']
    );

    const mw = orgContextMiddleware({ allowHeader: true });
    const req: any = {
      method: 'GET',
      params: {},
      headers: { 'x-org-id': 'org3' },
      user: { id: 'u1', organizationId: '' },
    };
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();
    await mw(req, res, next);
    expect(req.org?.id).toBe('org3');
    expect(req.org?.source).toBe('header');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('resolves header org when custom headerName uses mixed case', async () => {
    await db.run(`INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`, [
      'orgCase',
      'Org Case',
      'pro',
      'active',
    ]);
    await db.run(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
       VALUES (?, ?, ?, ?, ?)`,
      ['mCase', 'orgCase', 'u1', 'ADMIN', 'ACTIVE']
    );

    const mw = orgContextMiddleware({ allowHeader: true, headerName: 'X-Org-Id' });
    const req: any = {
      method: 'GET',
      params: {},
      headers: { 'x-org-id': 'orgCase' },
      user: { id: 'u1', organizationId: '' },
    };
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();

    await mw(req, res, next);

    expect(req.org?.id).toBe('orgCase');
    expect(req.org?.source).toBe('header');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('uses first header value when header is an array', async () => {
    await db.run(`INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`, [
      'orgArr',
      'Org Arr',
      'pro',
      'active',
    ]);
    await db.run(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
       VALUES (?, ?, ?, ?, ?)`,
      ['mArr', 'orgArr', 'u1', 'ADMIN', 'ACTIVE']
    );

    const mw = orgContextMiddleware({ allowHeader: true });
    const req: any = {
      method: 'GET',
      params: {},
      headers: { 'x-org-id': ['orgArr', 'orgOther'] },
      user: { id: 'u1', organizationId: '' },
    };
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();
    await mw(req, res, next);
    expect(req.org?.id).toBe('orgArr');
    expect(req.org?.source).toBe('header');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('returns 400 when header array contains conflicting org ids', async () => {
    await db.run(`INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`, [
      'orgArr',
      'Org Arr',
      'pro',
      'active',
    ]);
    await db.run(`INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`, [
      'orgOther',
      'Org Other',
      'pro',
      'active',
    ]);
    await db.run(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
       VALUES (?, ?, ?, ?, ?)`,
      ['mArr', 'orgArr', 'u1', 'ADMIN', 'ACTIVE']
    );
    await db.run(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
       VALUES (?, ?, ?, ?, ?)`,
      ['mOther', 'orgOther', 'u1', 'ADMIN', 'ACTIVE']
    );

    const mw = orgContextMiddleware({ allowHeader: true });
    const req: any = {
      method: 'GET',
      params: {},
      headers: { 'x-org-id': ['orgArr', 'orgOther'] },
      user: { id: 'u1', organizationId: '' },
    };
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();
    await mw(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Invalid organization id',
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 400 when URL org and header org conflict under allowHeader=true', async () => {
    await db.run(`INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`, [
      'orgA',
      'Org A',
      'pro',
      'active',
    ]);
    await db.run(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
       VALUES (?, ?, ?, ?, ?)`,
      ['mA', 'orgA', 'u1', 'ADMIN', 'ACTIVE']
    );

    const mw = orgContextMiddleware({ allowHeader: true });
    const req: any = {
      method: 'GET',
      params: { orgId: 'orgA' },
      headers: { 'x-org-id': 'orgB' },
      user: { id: 'u1', organizationId: '' },
    };
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();

    await mw(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Organization context conflict',
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 400 invalid organization id when URL org is malformed even if header conflicts', async () => {
    await db.run(`INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`, [
      'orgGood',
      'Org Good',
      'pro',
      'active',
    ]);
    await db.run(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
       VALUES (?, ?, ?, ?, ?)`,
      ['mGood', 'orgGood', 'u1', 'ADMIN', 'ACTIVE']
    );

    const mw = orgContextMiddleware({ allowHeader: true });
    const req: any = {
      method: 'GET',
      params: { orgId: 'o'.repeat(129) },
      headers: { 'x-org-id': 'orgGood' },
      user: { id: 'u1', organizationId: '' },
    };
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();

    await mw(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Invalid organization id',
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('falls back to user default org when header accessor throws and strictWrite=false', async () => {
    await db.run(`INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`, [
      'orgFallback',
      'Org Fallback',
      'pro',
      'active',
    ]);
    await db.run(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
       VALUES (?, ?, ?, ?, ?)`,
      ['mFallback', 'orgFallback', 'u1', 'ADMIN', 'ACTIVE']
    );

    const mw = orgContextMiddleware({ allowHeader: true, strictWrite: false });
    const req: any = {
      method: 'GET',
      params: {},
      user: { id: 'u1', organizationId: 'orgFallback' },
    };
    Object.defineProperty(req, 'headers', {
      configurable: true,
      get: () => {
        throw new Error('headers getter failed');
      },
    });
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();
    await mw(req, res, next);
    expect(req.org?.id).toBe('orgFallback');
    expect(req.org?.source).toBe('user_default');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('falls back to user default org when x-org-id header value accessor throws and strictWrite=false', async () => {
    await db.run(`INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`, [
      'orgFallback2',
      'Org Fallback 2',
      'pro',
      'active',
    ]);
    await db.run(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
       VALUES (?, ?, ?, ?, ?)`,
      ['mFallback2', 'orgFallback2', 'u1', 'ADMIN', 'ACTIVE']
    );

    const mw = orgContextMiddleware({ allowHeader: true, strictWrite: false });
    const headersProxy = new Proxy({} as Record<string, unknown>, {
      get: (_target, prop) => {
        if (prop === 'x-org-id') {
          throw new Error('header value getter failed');
        }
        return undefined;
      },
    });
    const req: any = {
      method: 'GET',
      params: {},
      headers: headersProxy,
      user: { id: 'u1', organizationId: 'orgFallback2' },
    };
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();

    await mw(req, res, next);

    expect(req.org?.id).toBe('orgFallback2');
    expect(req.org?.source).toBe('user_default');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('returns 400 for write strict mode when method accessor throws and org is missing', async () => {
    const mw = orgContextMiddleware({ required: true, strictWrite: true });
    const req: any = {
      params: {},
      headers: {},
      user: { id: 'u1', organizationId: '' },
    };
    Object.defineProperty(req, 'method', {
      configurable: true,
      get: () => {
        throw new Error('method getter failed');
      },
    });
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();

    await mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('ignores header when allowHeader=false and uses user default org for reads', async () => {
    await db.run(`INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`, [
      'orgDefault',
      'Org Default',
      'pro',
      'active',
    ]);
    await db.run(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
       VALUES (?, ?, ?, ?, ?)`,
      ['mDef', 'orgDefault', 'u1', 'ADMIN', 'ACTIVE']
    );

    const mw = orgContextMiddleware({ allowHeader: false });
    const req: any = {
      method: 'GET',
      params: {},
      headers: { 'x-org-id': 'orgIgnored' },
      user: { id: 'u1', organizationId: 'orgDefault' },
    };
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();
    await mw(req, res, next);
    expect(req.org?.id).toBe('orgDefault');
    expect(req.org?.source).toBe('user_default');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('uses last_selected_org fallback when organizationId is missing', async () => {
    await db.run(`INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`, [
      'orgLast',
      'Org Last',
      'pro',
      'active',
    ]);
    await db.run(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
       VALUES (?, ?, ?, ?, ?)`,
      ['mLast', 'orgLast', 'u1', 'ADMIN', 'ACTIVE']
    );

    const mw = orgContextMiddleware({ allowHeader: false });
    const req: any = {
      method: 'GET',
      params: {},
      headers: {},
      user: { id: 'u1', organizationId: '', last_selected_org: 'orgLast' },
    };
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();
    await mw(req, res, next);
    expect(req.org?.id).toBe('orgLast');
    expect(req.org?.source).toBe('user_default');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('uses legacy organization_id fallback when organizationId is missing', async () => {
    await db.run(`INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`, [
      'orgLegacy',
      'Org Legacy',
      'pro',
      'active',
    ]);
    await db.run(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
       VALUES (?, ?, ?, ?, ?)`,
      ['mLegacy', 'orgLegacy', 'u1', 'ADMIN', 'ACTIVE']
    );

    const mw = orgContextMiddleware({ allowHeader: false });
    const req: any = {
      method: 'GET',
      params: {},
      headers: {},
      user: { id: 'u1', organizationId: '', organization_id: 'orgLegacy' },
    };
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();
    await mw(req, res, next);
    expect(req.org?.id).toBe('orgLegacy');
    expect(req.org?.source).toBe('user_default');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('returns 400 when org is missing for reads and required=true', async () => {
    const mw = orgContextMiddleware({ required: true, strictWrite: true });
    const req: any = {
      method: 'GET',
      params: {},
      headers: {},
      user: { id: 'u1', organizationId: '' },
    };
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();
    await mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 400 when orgId exceeds safety limit', async () => {
    const mw = orgContextMiddleware({ required: true, strictWrite: true });
    const req: any = {
      method: 'GET',
      params: { orgId: 'o'.repeat(129) },
      headers: {},
      user: { id: 'u1', organizationId: '' },
    };
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();

    await mw(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Invalid organization id',
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 400 when orgId contains traversal-like segments', async () => {
    const mw = orgContextMiddleware({ required: true, strictWrite: true });
    const req: any = {
      method: 'GET',
      params: { orgId: 'org/../x' },
      headers: {},
      user: { id: 'u1', organizationId: '' },
    };
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();

    await mw(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Invalid organization id',
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 400 when orgId contains whitespace characters', async () => {
    const mw = orgContextMiddleware({ required: true, strictWrite: true });
    const req: any = {
      method: 'GET',
      params: { orgId: 'org with-space' },
      headers: {},
      user: { id: 'u1', organizationId: '' },
    };
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();

    await mw(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Invalid organization id',
      })
    );
    expect(next).not.toHaveBeenCalled();
    expect(req.org).toBeNull();
    expect(req.orgContext).toBeNull();
  });

  it('returns 400 when orgId contains delimiter characters', async () => {
    const mw = orgContextMiddleware({ required: true, strictWrite: true });
    const req: any = {
      method: 'GET',
      params: { orgId: 'org1,org2' },
      headers: {},
      user: { id: 'u1', organizationId: '' },
    };
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();

    await mw(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Invalid organization id',
      })
    );
    expect(next).not.toHaveBeenCalled();
    expect(req.org).toBeNull();
    expect(req.orgContext).toBeNull();
  });

  it('no-ops when org is missing for reads and required=false', async () => {
    const mw = orgContextMiddleware({ required: false, strictWrite: true });
    const req: any = {
      method: 'GET',
      params: {},
      headers: {},
      user: { id: 'u1', organizationId: '' },
    };
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();
    await mw(req, res, next);
    expect(req.org).toBeNull();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('clears stale org context before returning 403 access denied', async () => {
    await db.run(`INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`, [
      'orgDenied',
      'Org Denied',
      'pro',
      'active',
    ]);

    const mw = orgContextMiddleware({ required: true, strictWrite: true });
    const staleOrg = {
      id: 'stale-org',
      source: 'user_default',
      isMember: true,
      isConsultant: false,
      role: 'ADMIN',
    };
    const req: any = {
      method: 'GET',
      params: { orgId: 'orgDenied' },
      headers: {},
      user: { id: 'u1', organizationId: '' },
      org: staleOrg,
      orgContext: staleOrg,
    };
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();

    await mw(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
    expect(req.org).toBeNull();
    expect(req.orgContext).toBeNull();
  });

  it('allows write fallback when strictWrite=false (uses user default)', async () => {
    await db.run(`INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`, [
      'orgWrite',
      'Org Write',
      'pro',
      'active',
    ]);
    await db.run(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
       VALUES (?, ?, ?, ?, ?)`,
      ['mWrite', 'orgWrite', 'u1', 'ADMIN', 'ACTIVE']
    );

    const mw = orgContextMiddleware({ strictWrite: false });
    const req: any = {
      method: 'POST',
      params: {},
      headers: {},
      user: { id: 'u1', organizationId: 'orgWrite' },
    };
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();
    await mw(req, res, next);
    expect(req.org?.id).toBe('orgWrite');
    expect(req.org?.source).toBe('user_default');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('returns 403 when membership permission_scope JSON is invalid', async () => {
    await db.run(`INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`, [
      'org4',
      'Org 4',
      'pro',
      'active',
    ]);
    await db.run(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status, permission_scope)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['m4', 'org4', 'u1', 'ADMIN', 'ACTIVE', '{not-json']
    );

    const mw = orgContextMiddleware();
    const req: any = {
      method: 'GET',
      params: { orgId: 'org4' },
      headers: {},
      user: { id: 'u1', organizationId: '' },
    };
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();
    await mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Access denied',
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when membership permission_scope contains disallowed object keys', async () => {
    await db.run(`INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`, [
      'org4badkey',
      'Org 4 Bad Key',
      'pro',
      'active',
    ]);
    await db.run(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status, permission_scope)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['m4badkey', 'org4badkey', 'u1', 'ADMIN', 'ACTIVE', JSON.stringify({ constructor: { x: 1 } })]
    );

    const mw = orgContextMiddleware();
    const req: any = {
      method: 'GET',
      params: { orgId: 'org4badkey' },
      headers: {},
      user: { id: 'u1', organizationId: '' },
    };
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();
    await mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Access denied',
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when membership permission_scope JSON exceeds max safety length', async () => {
    await db.run(`INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`, [
      'org4big',
      'Org 4big',
      'pro',
      'active',
    ]);
    await db.run(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status, permission_scope)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['m4big', 'org4big', 'u1', 'ADMIN', 'ACTIVE', JSON.stringify({ blob: 'x'.repeat(70_000) })]
    );

    const mw = orgContextMiddleware();
    const req: any = {
      method: 'GET',
      params: { orgId: 'org4big' },
      headers: {},
      user: { id: 'u1', organizationId: '' },
    };
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();
    await mw(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Access denied',
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when consultant permission_scope JSON is invalid', async () => {
    await db.run(`INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`, [
      'org4c',
      'Org 4c',
      'pro',
      'active',
    ]);
    await db.run(
      `INSERT INTO consultant_org_links (id, consultant_id, organization_id, status, permission_scope)
       VALUES (?, ?, ?, ?, ?)`,
      ['l4c', 'u1', 'org4c', 'ACTIVE', '{not-json']
    );

    const mw = orgContextMiddleware();
    const req: any = {
      method: 'GET',
      params: { orgId: 'org4c' },
      headers: {},
      user: { id: 'u1', organizationId: '' },
    };
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();

    await mw(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Access denied',
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('does not attempt catch-path 500 write when headers are already sent', async () => {
    const dbPromise = await import('../../../../server/src/utils/DbPromise.js');
    const getSpy = vi.spyOn(dbPromise, 'get').mockRejectedValueOnce(new Error('simulated db failure'));

    const mw = orgContextMiddleware();
    const req: any = {
      method: 'GET',
      params: { orgId: 'orgX' },
      headers: {},
      user: { id: 'u1', organizationId: '' },
    };
    const res: any = {
      headersSent: true,
      status: vi.fn(() => res),
      json: vi.fn(() => res),
    };
    const next = vi.fn();

    await expect(mw(req, res, next)).resolves.toBeUndefined();

    expect(getSpy).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
    getSpy.mockRestore();
  });

  it('getUserOrganizations returns unique orgs with access types', async () => {
    await db.run(`INSERT INTO organizations (id, name, plan, status, is_active) VALUES (?, ?, ?, ?, ?)`, [
      'orgA',
      'Org A',
      'pro',
      'active',
      1,
    ]);
    await db.run(`INSERT INTO organizations (id, name, plan, status, is_active) VALUES (?, ?, ?, ?, ?)`, [
      'orgB',
      'Org B',
      'pro',
      'active',
      1,
    ]);
    await db.run(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
       VALUES (?, ?, ?, ?, ?)`,
      ['mA', 'orgA', 'u1', 'ADMIN', 'ACTIVE']
    );
    await db.run(
      `INSERT INTO consultant_org_links (id, consultant_id, organization_id, status)
       VALUES (?, ?, ?, ?)`,
      ['lB', 'u1', 'orgB', 'ACTIVE']
    );

    const orgs = await getUserOrganizations('u1');
    expect(orgs.map((o: any) => o.id).sort()).toEqual(['orgA', 'orgB']);
    const byId = Object.fromEntries(orgs.map((o: any) => [o.id, o]));
    expect(byId.orgA.access_type).toBe('MEMBER');
    expect(byId.orgB.access_type).toBe('CONSULTANT');
  });

  it('resolveUserOrgAccess returns allowed=false when inputs missing', async () => {
    await expect(resolveUserOrgAccess('', 'org')).resolves.toEqual({ allowed: false });
    await expect(resolveUserOrgAccess('u', '')).resolves.toEqual({ allowed: false });
  });

  it('resolveUserOrgAccess returns allowed=false for malformed user/org identifiers', async () => {
    await expect(resolveUserOrgAccess('u'.repeat(129), 'orgM')).resolves.toEqual({ allowed: false });
    await expect(resolveUserOrgAccess('u1', 'o'.repeat(129))).resolves.toEqual({ allowed: false });
  });

  it('getUserOrganizations returns empty list for malformed user identifier', async () => {
    await expect(getUserOrganizations('u'.repeat(129))).resolves.toEqual([]);
  });

  it('resolveUserOrgAccess returns membership access when ACTIVE member exists', async () => {
    await db.run(`INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`, [
      'orgM',
      'Org M',
      'pro',
      'active',
    ]);
    await db.run(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status, permission_scope)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['mM', 'orgM', 'u1', 'ADMIN', 'ACTIVE', JSON.stringify({ ok: true })]
    );

    await expect(resolveUserOrgAccess('u1', 'orgM')).resolves.toEqual(
      expect.objectContaining({
        allowed: true,
        isMember: true,
        isConsultant: false,
        role: 'ADMIN',
        membershipId: 'mM',
      })
    );
  });

  it('resolveUserOrgAccess returns consultant access when ACTIVE link exists', async () => {
    await db.run(`INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`, [
      'orgC',
      'Org C',
      'pro',
      'active',
    ]);
    await db.run(
      `INSERT INTO consultant_org_links (id, consultant_id, organization_id, status, permission_scope)
       VALUES (?, ?, ?, ?, ?)`,
      ['lC', 'u1', 'orgC', 'ACTIVE', JSON.stringify({ c: 1 })]
    );

    await expect(resolveUserOrgAccess('u1', 'orgC')).resolves.toEqual(
      expect.objectContaining({
        allowed: true,
        isMember: false,
        isConsultant: true,
        role: 'CONSULTANT',
        linkId: 'lC',
      })
    );
  });

  it('ignores inherited orgId in req.params prototype and requires explicit own param', async () => {
    await db.run(`INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`, [
      'orgProto',
      'Org Proto',
      'pro',
      'active',
    ]);
    await db.run(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
       VALUES (?, ?, ?, ?, ?)`,
      ['mProto', 'orgProto', 'u1', 'ADMIN', 'ACTIVE']
    );

    const mw = orgContextMiddleware({ required: true, strictWrite: true });
    const params = Object.create({ orgId: 'orgProto' });
    const req: any = {
      method: 'GET',
      params,
      headers: {},
      user: { id: 'u1', organizationId: '' },
    };
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    const next = vi.fn();

    await mw(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Organization context required',
      })
    );
    expect(next).not.toHaveBeenCalled();
    expect(req.org).toBeNull();
    expect(req.orgContext).toBeNull();
  });
});

describe('orgContext.middleware options validation', () => {
  it('throws when paramName is empty', async () => {
    const { default: orgContextMiddleware } = await import(
      '../../../../server/src/middleware/orgContext.middleware.ts'
    );

    expect(() => orgContextMiddleware({ paramName: '' })).toThrow('Invalid paramName');
  });

  it('throws when paramName contains path separators', async () => {
    const { default: orgContextMiddleware } = await import(
      '../../../../server/src/middleware/orgContext.middleware.ts'
    );

    expect(() => orgContextMiddleware({ paramName: 'org/../id' })).toThrow('Invalid paramName');
  });

  it('throws when allowHeader=true and headerName contains newline characters', async () => {
    const { default: orgContextMiddleware } = await import(
      '../../../../server/src/middleware/orgContext.middleware.ts'
    );

    expect(() =>
      orgContextMiddleware({
        allowHeader: true,
        headerName: 'x-org-id\r\nx-inject:1',
      })
    ).toThrow('Invalid headerName');
  });
});
