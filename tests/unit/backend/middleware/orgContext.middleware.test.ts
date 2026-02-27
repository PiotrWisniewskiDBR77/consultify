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
      DELETE FROM organization_members;
      DELETE FROM consultant_org_links;
      DELETE FROM organizations;
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
      ['m1', 'org1', 'u1', 'ADMIN', 'ACTIVE', JSON.stringify({ a: 1 })]
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

  it('returns 500 when permission_scope JSON is invalid', async () => {
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
    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
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
});
