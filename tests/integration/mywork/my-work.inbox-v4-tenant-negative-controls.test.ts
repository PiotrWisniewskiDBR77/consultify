/**
 * M02-006 — tenant negative controls for the live Inbox list surface.
 *
 * Why this file exists: `InboxContent.tsx` loads the Inbox table from
 * `GET /api/inbox-v4/table` (src/services/api.ts `inboxGetTable`), i.e. the
 * inbox-enterprise router — NOT the v8 canonical router covered by
 * my-work.golden-flow-inbox-task.test.ts. That router resolved the tenant with
 * a client-supplied fallback:
 *
 *   req.user?.organizationId || req.organizationId
 *     || req.headers['x-organization-id'] || req.query.organizationId
 *
 * `verifyToken` (server/src/middleware/auth.middleware.ts) already accepts an
 * `x-organization-id` / `x-org-context` header ONLY after confirming an ACTIVE
 * `organization_members` row for the caller. Re-reading the raw header in the
 * route therefore re-admitted precisely the values verifyToken had rejected.
 *
 * These are REAL routers + REAL verifyToken + REAL Postgres. Nothing about
 * auth, tenancy or the org fallback is mocked.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import express, { type Express } from 'express';

import { mintToken, pgClient, requireLocalDbUrl } from '../../acceptance/harness.js';

const P = 'mwinbv4';
const ORG_VICTIM = `${P}-org-victim`;
const ORG_HOME = `${P}-org-home`;
const USER_MEMBER = `${P}-user-member`; // ACTIVE member of ORG_HOME only
const USER_ORPHAN = `${P}-user-orphan`; // NO active membership anywhere
const VICTIM_ITEM = `${P}-item-victim`;

let app: Express;
let client: ReturnType<typeof pgClient>;

async function buildInboxV4App(): Promise<Express> {
  const { default: inboxEnterpriseRoutes } = await import(
    '../../../server/src/routes/inbox-enterprise.routes.js'
  );
  const a = express();
  a.use(express.json());
  // Mirrors server/src/Gateway.ts: app.use('/api/inbox-v4', inboxEnterpriseRoutes).
  // The router applies verifyToken itself, so mounting it directly reproduces
  // the real production middleware chain.
  a.use('/api/inbox-v4', inboxEnterpriseRoutes);
  return a;
}

beforeAll(async () => {
  requireLocalDbUrl();
  client = pgClient();
  await client.connect();

  for (const [id, name] of [
    [ORG_VICTIM, 'Victim Org'],
    [ORG_HOME, 'Home Org'],
  ] as const) {
    await client.query(
      `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
       VALUES ($1, $2, 'enterprise', 'active', 1, now())
       ON CONFLICT (id) DO NOTHING`,
      [id, name]
    );
  }

  for (const [id, org] of [
    [USER_MEMBER, ORG_HOME],
    [USER_ORPHAN, null],
  ] as const) {
    await client.query(
      `INSERT INTO users (id, organization_id, email, password, first_name, last_name, role, status, created_at)
       VALUES ($1, $2, $3, 'x', 'MW', 'InbV4', 'MEMBER', 'active', now())
       ON CONFLICT (id) DO NOTHING`,
      [id, org, `${id}@mwinbv4.test`]
    );
  }

  // USER_MEMBER is an ACTIVE member of ORG_HOME. USER_ORPHAN is a member of
  // nothing — that is the whole point of the second control.
  await client.query(
    `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
     VALUES ($1, $2, $3, 'USER', 'ACTIVE', now())
     ON CONFLICT (organization_id, user_id) DO NOTHING`,
    [`${P}-mem-1`, ORG_HOME, USER_MEMBER]
  );

  // One inbox row that belongs to the victim tenant. If any control below
  // leaks, this row is what leaks.
  await client.query(
    `INSERT INTO canonical_inbox_items
       (id, user_id, organization_id, item_type, source_entity_type, source_entity_id,
        title, priority, section, status, created_at, updated_at)
     VALUES ($1, $2, $3, 'signal', 'task', $4, 'VICTIM TENANT SECRET', 'high',
             'assigned_tasks', 'pending', now(), now())
     ON CONFLICT DO NOTHING`,
    [VICTIM_ITEM, USER_MEMBER, ORG_VICTIM, `${P}-src-1`]
  );

  app = await buildInboxV4App();
});

afterAll(async () => {
  await client.query(`DELETE FROM canonical_inbox_items WHERE id LIKE $1`, [`${P}-%`]);
  await client.query(`DELETE FROM organization_members WHERE id LIKE $1`, [`${P}-%`]);
  await client.query(`DELETE FROM users WHERE id LIKE $1`, [`${P}-%`]);
  await client.query(`DELETE FROM organizations WHERE id LIKE $1`, [`${P}-%`]);
  await client.end();
});

describe('M02-006 inbox-v4 tenant negative controls (real router, real verifyToken, real PG)', () => {
  it('a caller with NO active membership cannot name a tenant via x-organization-id', async () => {
    const token = mintToken({
      id: USER_ORPHAN,
      email: `${USER_ORPHAN}@mwinbv4.test`,
      organizationId: undefined,
      organization_id: undefined,
      role: 'USER',
    });

    const res = await request(app)
      .get('/api/inbox-v4/table')
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', ORG_VICTIM);

    // Fail closed. Before the fix this returned 200 scoped to ORG_VICTIM.
    expect(res.status).toBe(401);
    expect(JSON.stringify(res.body)).not.toContain('VICTIM TENANT SECRET');
  });

  it('the same caller cannot name a tenant via ?organizationId= either', async () => {
    const token = mintToken({
      id: USER_ORPHAN,
      email: `${USER_ORPHAN}@mwinbv4.test`,
      organizationId: undefined,
      organization_id: undefined,
      role: 'USER',
    });

    const res = await request(app)
      .get('/api/inbox-v4/table')
      .query({ organizationId: ORG_VICTIM })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(JSON.stringify(res.body)).not.toContain('VICTIM TENANT SECRET');
  });

  it('a real member of one org cannot widen scope to another org via the header', async () => {
    const token = mintToken({
      id: USER_MEMBER,
      email: `${USER_MEMBER}@mwinbv4.test`,
      organizationId: ORG_HOME,
      organization_id: ORG_HOME,
      role: 'USER',
    });

    const res = await request(app)
      .get('/api/inbox-v4/table')
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', ORG_VICTIM);

    // verifyToken refuses to switch to an org the user is not an ACTIVE member
    // of, so the request stays scoped to ORG_HOME and the victim row is absent.
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain('VICTIM TENANT SECRET');
  });

  it('positive control: the victim tenant\'s own member does see the row (the fixture is real)', async () => {
    await client.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
       VALUES ($1, $2, $3, 'USER', 'ACTIVE', now())
       ON CONFLICT (organization_id, user_id) DO NOTHING`,
      [`${P}-mem-2`, ORG_VICTIM, USER_MEMBER]
    );

    const token = mintToken({
      id: USER_MEMBER,
      email: `${USER_MEMBER}@mwinbv4.test`,
      organizationId: ORG_VICTIM,
      organization_id: ORG_VICTIM,
      role: 'USER',
    });

    const res = await request(app)
      .get('/api/inbox-v4/table')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // Without this assertion the three controls above would also pass against
    // an empty table — i.e. they would prove nothing.
    expect(JSON.stringify(res.body)).toContain('VICTIM TENANT SECRET');
  });
});
