import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ApiGateway } from '../../../server/src/Gateway.js';
import { assertDay42Preconditions, restoreDay42FixtureColumns } from './day42SchemaResilience.js';

const DATABASE_URL = String(process.env.DATABASE_URL || '');
// Z31 detektor 2026-08-31: unpinned from a hardcoded '/cx_day42' database-name
// substring, which silently skipped this security suite (exit 0) on any other
// disposable database name. assertDay42Preconditions() below still refuses
// LOUD (throws DAY42_PRECONDITION_SCHEMA_DAMAGED) if a destructive sibling in
// this directory dropped the required fixture tables, so the directory-wide
// hazard this pin was guarding against is still caught -- just not silently.
const RUN =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres');
const describeReal = RUN ? describe : describe.skip;
const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-min-32-chars-long-for-validation';

/**
 * Day 42 FIX-1 — security/contract suites in this duty are never retried; see
 * partner-tenant-isolation.day42.realpg.test.ts for the mutational proof.
 */
const NO_RETRY = { retry: 0 } as const;

/**
 * D.5 — envelope honesty (`meta.dataFidelity`), the position the duty stopped on.
 *
 * The stop was raised on `server/src/services/partnerEconomicsPolicy.ts`, which
 * the duty licence never covered — and which §D.5 explicitly requires to stay
 * UNTOUCHED, because the `410 PARTNER_ECONOMICS_POLICY_DISABLED` envelope is the
 * contract. The licensed work is in `server/src/routes/v8/partner.routes.ts`
 * (additive `meta` fields only). This suite checks all four DoD cases plus the
 * proof that the policy envelope was not touched.
 */
describeReal('Day 42 Partner envelope fidelity (D.5) through the real ApiGateway', NO_RETRY, () => {
  let sql: Client;
  let app: Express;

  /**
   * FIX-7: this file flips a PROCESS-WIDE env flag, and the original teardown
   * left `ENABLE_V8_GLOBAL='true'` behind for every file that ran afterwards in
   * the same worker. Capture the entry value and put it back exactly, including
   * the "was not set at all" case.
   */
  const originalEnableV8Global = process.env.ENABLE_V8_GLOBAL;
  const restoreEnableV8Global = () => {
    if (originalEnableV8Global === undefined) delete process.env.ENABLE_V8_GLOBAL;
    else process.env.ENABLE_V8_GLOBAL = originalEnableV8Global;
  };
  const prefix = `day42fid_${randomUUID().replaceAll('-', '')}`;
  const orgA = randomUUID();
  const ownerA = randomUUID();
  const partnerA = randomUUID();

  const token = (userId: string, organizationId: string, role = 'OWNER') =>
    jwt.sign({ id: userId, email: `${userId}@day42.local`, organizationId, role }, JWT_SECRET, {
      expiresIn: '1h',
    });

  const auth = (userId: string, organizationId: string, role = 'OWNER') => ({
    Authorization: `Bearer ${token(userId, organizationId, role)}`,
    'x-org-context': organizationId,
  });

  beforeAll(async () => {
    process.env.ENABLE_V8_GLOBAL = 'true';
    sql = new Client({ connectionString: DATABASE_URL });
    await sql.connect();
    // Z31 detektor 2026-08-31: redundant inner pin to the literal 'cx_day42'
    // name removed (duplicated the outer RUN gate). Only require a real name.
    const target = await sql.query<{ name: string }>('SELECT current_database() AS name');
    if (!target.rows[0]?.name) {
      throw new Error('DAY42_NO_REAL_DATABASE');
    }
    // FIX-7: survive destructive neighbours in a whole-directory run.
    await assertDay42Preconditions(sql);
    await restoreDay42FixtureColumns(sql);

    await sql.query(
      `INSERT INTO organizations (id, name, plan, status) VALUES ($1, $2, 'enterprise', 'active')`,
      [orgA, `${prefix}_org`]
    );
    await sql.query(
      `INSERT INTO users (id, organization_id, email, password, role, status)
       VALUES ($1, $2, $3, 'x', 'OWNER', 'active')`,
      [ownerA, orgA, `${ownerA}@day42.local`]
    );
    await sql.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
       VALUES ($1, $2, $3, 'OWNER', 'ACTIVE')`,
      [`${prefix}_${ownerA}`, orgA, ownerA]
    );
    await sql.query(
      `INSERT INTO partner_organizations (id, name, contact_email, status, owner_organization_id)
       VALUES ($1, 'Fidelity Partner', 'f@day42.local', 'active', $2)`,
      [partnerA, orgA]
    );
    await sql.query(
      `INSERT INTO partner_users (partner_org_id, user_id, role, status)
       VALUES ($1, $2, 'owner', 'active')`,
      [partnerA, ownerA]
    );

    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
  });

  afterAll(async () => {
    restoreEnableV8Global();
    if (!sql) return;
    await sql.query('DELETE FROM partner_campaign_links WHERE partner_org_id::text = $1', [
      partnerA,
    ]);
    await sql.query('DELETE FROM partner_program_ledger WHERE partner_org_id::text = $1', [
      partnerA,
    ]);
    await sql.query('DELETE FROM partner_program_runtime WHERE partner_org_id::text = $1', [
      partnerA,
    ]);
    await sql.query('DELETE FROM partner_users WHERE user_id::text = $1', [ownerA]);
    await sql.query('DELETE FROM partner_organizations WHERE id::text = $1', [partnerA]);
    await sql.query('DELETE FROM organization_members WHERE id LIKE $1', [`${prefix}%`]);
    await sql.query('DELETE FROM users WHERE id::text = $1', [ownerA]);
    await sql.query('DELETE FROM organizations WHERE id::text = $1', [orgA]);
    await sql.end();
  });

  it('D.5-1 a REALNE read declares dataFidelity real and carries no reason', async () => {
    const response = await request(app).get('/api/v8/partner/clients').set(auth(ownerA, orgA));
    expect(response.status).toBe(200);
    expect(response.body.meta.dataFidelity).toBe('real');
    expect(response.body.meta.dataFidelityReason).toBeUndefined();
    // existing envelope fields must survive untouched
    expect(response.body.meta).toMatchObject({
      version: 'v8',
      contract: 'partner_runtime_read_v1',
      partnerOrgId: partnerA,
      v8TenantOrganizationId: orgA,
    });
  });

  it('D.5-2 a REALNE_Z_SYNTEZA read on an empty partner declares synthesized plus the mechanism', async () => {
    const tools = await request(app).get('/api/v8/partner/referral-tools').set(auth(ownerA, orgA));
    expect(tools.status).toBe(200);
    expect(tools.body.data.tools.referralCode).toBeTruthy();
    expect(tools.body.meta.dataFidelity).toBe('synthesized');
    expect(tools.body.meta.dataFidelityReason).toContain('organization name');
    expect(tools.body.meta.partnerOrgId).toBe(partnerA);

    const status = await request(app).get('/api/v8/partner/program/status').set(auth(ownerA, orgA));
    expect(status.status).toBe(200);
    expect(status.body.meta.dataFidelity).toBe('synthesized');
    expect(status.body.meta.dataFidelityReason).toContain('getOrCreateRuntime');
    // the economics policy projection that already lived in this envelope stays
    expect(status.body.meta.policyUnavailable.code).toBe('PARTNER_ECONOMICS_POLICY_DISABLED');
  });

  it('D.5-3 a 503 stub declares dataFidelity unavailable next to its capability', async () => {
    for (const [path, capability] of [
      ['/api/v8/partner/clients', 'partner_client_creation'],
      ['/api/v8/partner/employees', 'partner_employee_creation'],
      ['/api/v8/partner/access-links', 'partner_access_link_creation'],
      ['/api/v8/partner/licenses/order', 'partner_license_order'],
    ]) {
      const response = await request(app).post(path).set(auth(ownerA, orgA)).send({});
      expect({ path, status: response.status, code: response.body?.code }).toEqual({
        path,
        status: 503,
        code: 'FEATURE_NOT_AVAILABLE',
      });
      expect(response.body.capability, path).toBe(capability);
      expect(response.body.meta.dataFidelity, path).toBe('unavailable');
      expect(response.body.meta.dataFidelityReason, path).toContain(capability);
      // untouched original fields
      expect(response.body.success, path).toBe(false);
      expect(response.body.message, path).toBe('This Partner capability is not available yet.');
    }
  });

  it('D.5-4 the 410 policy envelope is byte-shape identical and carries no meta at all', async () => {
    const cases: Array<{ method: 'post' | 'put'; path: string; operation: string }> = [
      { method: 'put', path: '/api/v8/partner/payout-settings', operation: 'PAYOUT_SETTINGS' },
      { method: 'post', path: '/api/v8/partner/payouts/request', operation: 'PAYOUT_REQUEST' },
      {
        method: 'post',
        path: '/api/v8/partner/program/lifecycle/request-payout-phase',
        operation: 'PAYOUT_LIFECYCLE',
      },
    ];
    for (const probe of cases) {
      const response = await request(app)
        [probe.method](probe.path)
        .set(auth(ownerA, orgA))
        .send({});
      expect(response.status, probe.path).toBe(410);
      expect(response.body.code, probe.path).toBe('PARTNER_ECONOMICS_POLICY_DISABLED');
      expect(response.body.decision, probe.path).toBe('AMD-PRT-ECONOMICS-002');
      expect(response.body.success, probe.path).toBe(false);
      expect(response.body.policyUnavailable?.historicalReadOnly, probe.path).toBe(true);
      // D.5 forbids adding anything to the policy envelope: no `meta`, and the
      // exact same top-level key set the guard has always produced.
      expect(response.body.meta, probe.path).toBeUndefined();
      expect(Object.keys(response.body).sort(), probe.path).toEqual([
        'code',
        'decision',
        'message',
        'operation',
        'policyUnavailable',
        'success',
      ]);
    }
  });

  it('D.5-4b statically proves the shared policy body builder was never given a fidelity field', () => {
    const policySource = readFileSync('server/src/services/partnerEconomicsPolicy.ts', 'utf8');
    expect(policySource).toContain('export function partnerEconomicsPolicyBody(');
    // The guard is mounted on four surfaces (v8/partner.routes.ts:121,
    // partners.routes.ts:277, :2491, :2966), so any edit here would also change
    // legacy and two superadmin surfaces. It must stay clean.
    expect(policySource).not.toContain('dataFidelity');
  });
});
