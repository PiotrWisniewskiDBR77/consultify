/**
 * PRESENTATIONS-AUTH-WALL-001 — authorization wall, proven against a real
 * PostgreSQL database with the real router mounted and real signed JWTs.
 *
 * =============================================================================
 * HOW TO RUN (this suite refuses to run against anything else)
 * =============================================================================
 *   createdb pres_authwall_<stamp>            # disposable, throwaway database
 *   RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
 *   PRESENTATIONS_AUTH_WALL_REALDB=1 \
 *   DATABASE_URL=postgres://<user>@localhost:5432/pres_authwall_<stamp> \
 *   npx vitest run --config vitest.config.ts \
 *     src/routes/__tests__/presentations.authorization-wall.realdb.test.ts
 *
 * Without all four env vars the whole block is SKIPPED, never silently mocked:
 * `Database.ts:80-89` swaps in a mock DB whenever NODE_ENV==='test' and
 * RUN_DB_TESTS!=='1', and a suite that "passes" against that mock proves
 * nothing about the wall.
 *
 * PLUS a namespace guard in beforeAll: `SELECT current_database()` must equal
 * the database parsed out of DATABASE_URL, and BOTH must match
 * /^pres_authwall_/. Never weaken this — it is what stops this suite from
 * writing into a database it was not explicitly handed.
 *
 * What is proven here (each maps to one `it`):
 *  - a VIEWER is denied on every writer class (submit/approve/reject/delete/
 *    autosave/restore) — the capability wall;
 *  - an ADMIN is allowed, so the wall is not a blanket deny;
 *  - a member revoked AFTER the token was minted is denied on the very next
 *    request with that SAME token — no cache may hold a stale ALLOW;
 *  - an identity with no `organization_members` row at all is denied;
 *  - a foreign-tenant token cannot reach another tenant's deck;
 *  - a client-supplied `organizationId`/`userId` in the body changes nothing;
 *  - a membership-lookup failure denies (fail CLOSED), it does not fail open;
 *  - every denial above leaves EXACTLY zero business, version, approval,
 *    analytics and audit rows behind.
 */

import { randomUUID } from 'crypto';
import type { Express } from 'express';
import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool, type PoolClient } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DATABASE_URL = process.env.DATABASE_URL || '';
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  process.env.PRESENTATIONS_AUTH_WALL_REALDB === '1' &&
  DATABASE_URL.startsWith('postgres');

const AUTH_WALL_LOCK_KEY = 'consultify:presentations-auth-wall-001';
const DB_NAMESPACE = /^pres_authwall_/;

function parseDatabaseNameFromUrl(url: string): string {
  try {
    return new URL(url).pathname.replace(/^\//, '');
  } catch {
    return '';
  }
}

type Actor = { id: string; email: string; token: string; memberId?: string };

const describeRealPg = REAL_PG ? describe : describe.skip;

describeRealPg('PRESENTATIONS-AUTH-WALL-001 — writer authorization wall (real PG)', () => {
  let pool: Pool;
  let lockClient: PoolClient;
  let app: Express;
  let jwtSecret: string;

  let orgA = '';
  let orgB = '';
  let ownerA: Actor;
  let adminA: Actor;
  let viewerA: Actor;
  let revokedA: Actor;
  let ghostA: Actor;
  let ownerB: Actor;

  let deckId = '';
  let versionId = '';

  const createdUserIds: string[] = [];
  const createdMemberIds: string[] = [];
  const createdOrgIds: string[] = [];
  const createdDeckIds: string[] = [];

  function signToken(payload: Record<string, unknown>): string {
    return jwt.sign(payload, jwtSecret, { expiresIn: '30m' });
  }

  async function seedOrg(name: string): Promise<string> {
    const id = randomUUID();
    await pool.query(
      `INSERT INTO organizations (id, name, plan, status) VALUES ($1, $2, 'enterprise', 'active')`,
      [id, name]
    );
    createdOrgIds.push(id);
    return id;
  }

  async function seedUser(orgId: string, label: string): Promise<{ id: string; email: string }> {
    const id = randomUUID();
    const email = `${label}-${id}@authwall.test`;
    await pool.query(
      `INSERT INTO users (id, organization_id, email, password, role, status)
       VALUES ($1, $2, $3, 'unused', 'MEMBER', 'active')`,
      [id, orgId, email]
    );
    createdUserIds.push(id);
    return { id, email };
  }

  /**
   * `orgRole` is the tenancy role written to `organization_members` (CHECK
   * constraint: OWNER/ADMIN/MEMBER/CONSULTANT). `tokenRole` is the PLATFORM
   * role carried in the JWT and read by the capability matrix
   * (presentationAccessPolicyService.ts). They are two different vocabularies
   * and are deliberately set independently here — that split is exactly what
   * lets a VIEWER hold an ACTIVE membership.
   */
  async function seedActor(
    orgId: string,
    label: string,
    orgRole: 'OWNER' | 'ADMIN' | 'MEMBER' | 'CONSULTANT',
    status: 'ACTIVE' | 'REVOKED',
    tokenRole: string
  ): Promise<Actor> {
    const { id, email } = await seedUser(orgId, label);
    const memberId = randomUUID();
    await pool.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [memberId, orgId, id, orgRole, status]
    );
    createdMemberIds.push(memberId);
    return { id, email, memberId, token: signToken({ id, email, organizationId: orgId, role: tokenRole }) };
  }

  /** An identity with a user row but NO membership row anywhere. */
  async function seedGhost(orgId: string, label: string, tokenRole: string): Promise<Actor> {
    const { id, email } = await seedUser(orgId, label);
    return { id, email, token: signToken({ id, email, organizationId: orgId, role: tokenRole }) };
  }

  async function seedDeck(orgId: string, title: string): Promise<string> {
    const id = randomUUID();
    await pool.query(
      `INSERT INTO presentation_decks
         (id, organization_id, title, template_id, deck_json, version, status)
       VALUES ($1, $2, $3, 'default', $4, 1, 'draft')`,
      [id, orgId, title, JSON.stringify({ cards: [{ id: 'c1', title: 'original' }] })]
    );
    createdDeckIds.push(id);
    return id;
  }

  async function seedDeckVersion(deck: string): Promise<string> {
    const id = randomUUID();
    await pool.query(
      `INSERT INTO presentation_deck_versions
         (id, deck_id, version, deck_json_snapshot, slide_count, created_by)
       VALUES ($1, $2, 1, $3, 1, 'fixture')`,
      [id, deck, JSON.stringify({ cards: [{ id: 'c1', title: 'snapshot' }] })]
    );
    return id;
  }

  /**
   * Everything a denial must leave untouched. Counts are scoped to this run's
   * fixtures so unrelated rows in the disposable database cannot mask a write.
   */
  async function snapshotState() {
    const [deck, versions, approvals, analytics, audits] = await Promise.all([
      pool.query(`SELECT version, deck_json, status FROM presentation_decks WHERE id = $1`, [deckId]),
      pool.query(`SELECT count(*)::int AS c FROM presentation_deck_versions WHERE deck_id = $1`, [deckId]),
      pool.query(`SELECT count(*)::int AS c FROM approval_assignments WHERE artifact_id = $1 OR proposal_id = $1`, [deckId]),
      pool.query(`SELECT count(*)::int AS c FROM presentation_analytics WHERE deck_id = $1`, [deckId]),
      pool.query(`SELECT count(*)::int AS c FROM audit_events WHERE org_id = $1 OR resource_id = $2 OR entity_id = $2`, [orgA, deckId]),
    ]);
    return {
      deckRow: deck.rows[0] ?? null,
      deckRows: deck.rowCount,
      versions: versions.rows[0].c as number,
      approvals: approvals.rows[0].c as number,
      analytics: analytics.rows[0].c as number,
      audits: audits.rows[0].c as number,
    };
  }

  /** Every writer class the wall must cover, as callable probes. */
  function writerProbes(token: string, body: Record<string, unknown> = {}) {
    const auth = { Authorization: `Bearer ${token}` };
    return {
      submit: () =>
        request(app)
          .post(`/api/presentations/decks/${deckId}/approval/submit`)
          .set(auth)
          .send({ assignedToUserId: ownerA.id, ...body }),
      approve: () =>
        request(app).post(`/api/presentations/decks/${deckId}/approval/approve`).set(auth).send(body),
      reject: () =>
        request(app)
          .post(`/api/presentations/decks/${deckId}/approval/reject`)
          .set(auth)
          .send({ reason: 'nope', ...body }),
      delete: () => request(app).delete(`/api/presentations/decks/${deckId}`).set(auth).send(body),
      autosave: () =>
        request(app)
          .put(`/api/presentations/decks/${deckId}/autosave`)
          .set(auth)
          .send({ title: 'MUTATED BY TEST', cards: [], ...body }),
      restore: () =>
        request(app)
          .post(`/api/presentations/decks/${deckId}/versions/${versionId}/restore`)
          .set(auth)
          .send({ expectedVersion: 1, ...body }),
    };
  }

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL });

    // Namespace guard (never weaken): two independent readings of "which
    // database am I touching" must agree, and both must look disposable.
    const expectedDbName = parseDatabaseNameFromUrl(DATABASE_URL);
    const actual = await pool.query<{ name: string }>('SELECT current_database() AS name');
    const actualDbName = String(actual.rows[0]?.name || '');
    if (
      !expectedDbName ||
      actualDbName !== expectedDbName ||
      !DB_NAMESPACE.test(actualDbName) ||
      !DB_NAMESPACE.test(expectedDbName)
    ) {
      throw new Error(
        `PRESENTATIONS-AUTH-WALL-001 namespace guard refused this database: ` +
          `current_database()=${JSON.stringify(actualDbName)} ` +
          `DATABASE_URL database=${JSON.stringify(expectedDbName)} ` +
          `(both must match and start with "pres_authwall_")`
      );
    }

    // Held for the whole run on its own connection, released and VERIFIED
    // released in afterAll.
    lockClient = await pool.connect();
    await lockClient.query('SELECT pg_advisory_lock(hashtext($1))', [AUTH_WALL_LOCK_KEY]);

    const configModule = (await import('../../config/Config.js')) as {
      config?: { JWT_SECRET: string };
      default?: { JWT_SECRET: string };
    };
    jwtSecret = configModule.config?.JWT_SECRET || configModule.default?.JWT_SECRET || '';
    if (!jwtSecret) throw new Error('Real Config.js did not yield a JWT_SECRET — cannot sign real tokens');

    const routesModule = await import('../presentations.routes.js');
    app = express();
    app.use(express.json({ limit: '20mb' }));
    app.use('/api/presentations', routesModule.default);

    orgA = await seedOrg('AUTH-WALL tenant A');
    orgB = await seedOrg('AUTH-WALL tenant B');

    ownerA = await seedActor(orgA, 'owner-a', 'OWNER', 'ACTIVE', 'OWNER');
    adminA = await seedActor(orgA, 'admin-a', 'ADMIN', 'ACTIVE', 'ADMIN');
    // ACTIVE member of the tenant, but a VIEWER on the platform.
    viewerA = await seedActor(orgA, 'viewer-a', 'MEMBER', 'ACTIVE', 'VIEWER');
    // Starts ACTIVE and ADMIN so its token is unimpeachable; revoked mid-suite.
    revokedA = await seedActor(orgA, 'revoked-a', 'ADMIN', 'ACTIVE', 'ADMIN');
    ghostA = await seedGhost(orgA, 'ghost-a', 'ADMIN');
    ownerB = await seedActor(orgB, 'owner-b', 'OWNER', 'ACTIVE', 'OWNER');

    deckId = await seedDeck(orgA, 'AUTH-WALL fixture deck');
    versionId = await seedDeckVersion(deckId);
  }, 60_000);

  afterAll(async () => {
    if (!pool) return;
    try {
      // ---- residue: this run must leave nothing behind ----
      await pool.query(`DELETE FROM presentation_analytics WHERE deck_id = ANY($1::text[])`, [createdDeckIds]);
      await pool.query(`DELETE FROM presentation_deck_versions WHERE deck_id = ANY($1::text[])`, [createdDeckIds]);
      await pool.query(`DELETE FROM approval_assignments WHERE artifact_id = ANY($1::text[]) OR proposal_id = ANY($1::text[])`, [createdDeckIds]);
      await pool.query(`DELETE FROM presentation_decks WHERE id = ANY($1::text[])`, [createdDeckIds]);
      await pool.query(`DELETE FROM audit_events WHERE org_id = ANY($1::text[]) OR resource_id = ANY($2::text[]) OR entity_id = ANY($2::text[])`, [createdOrgIds, createdDeckIds]);
      await pool.query(`DELETE FROM organization_members WHERE id = ANY($1::text[])`, [createdMemberIds]);
      await pool.query(`DELETE FROM users WHERE id = ANY($1::text[])`, [createdUserIds]);
      await pool.query(`DELETE FROM organizations WHERE id = ANY($1::text[])`, [createdOrgIds]);

      const residue = await pool.query(
        `SELECT
           (SELECT count(*)::int FROM presentation_decks WHERE id = ANY($1::text[])) AS decks,
           (SELECT count(*)::int FROM presentation_deck_versions WHERE deck_id = ANY($1::text[])) AS versions,
           (SELECT count(*)::int FROM presentation_analytics WHERE deck_id = ANY($1::text[])) AS analytics,
           (SELECT count(*)::int FROM approval_assignments WHERE artifact_id = ANY($1::text[])) AS approvals,
           (SELECT count(*)::int FROM organization_members WHERE id = ANY($2::text[])) AS members,
           (SELECT count(*)::int FROM users WHERE id = ANY($3::text[])) AS users,
           (SELECT count(*)::int FROM organizations WHERE id = ANY($4::text[])) AS orgs`,
        [createdDeckIds, createdMemberIds, createdUserIds, createdOrgIds]
      );
      expect(residue.rows[0]).toEqual({
        decks: 0,
        versions: 0,
        analytics: 0,
        approvals: 0,
        members: 0,
        users: 0,
        orgs: 0,
      });

      // ---- triggers: the suite must not have disabled any (all 'O' = origin) ----
      const triggers = await pool.query<{ tgenabled: string }>(
        `SELECT t.tgenabled
           FROM pg_trigger t
           JOIN pg_class c ON c.oid = t.tgrelid
          WHERE NOT t.tgisinternal
            AND c.relname IN ('presentation_decks','presentation_deck_versions','organization_members','audit_events')`
      );
      for (const row of triggers.rows) expect(row.tgenabled).toBe('O');

      // ---- locks: released, and none left held by this backend ----
      const unlocked = await lockClient.query<{ ok: boolean }>(
        'SELECT pg_advisory_unlock(hashtext($1)) AS ok',
        [AUTH_WALL_LOCK_KEY]
      );
      expect(unlocked.rows[0]?.ok).toBe(true);
      const held = await lockClient.query<{ count: string }>(
        `SELECT count(*) AS count FROM pg_locks WHERE locktype = 'advisory' AND pid = pg_backend_pid()`
      );
      expect(Number(held.rows[0]?.count ?? 0)).toBe(0);
    } finally {
      lockClient?.release();
      await pool.end();
    }
  }, 60_000);

  // ===========================================================================
  // 1. VIEWER is denied on EVERY writer class
  // ===========================================================================
  it('denies a VIEWER on every writer class, with zero business/event/receipt deltas', async () => {
    const before = await snapshotState();
    const probes = writerProbes(viewerA.token);

    for (const [name, probe] of Object.entries(probes)) {
      const res = await probe();
      expect(res.status, `${name} must be denied for VIEWER`).toBe(403);
      expect(res.body.code, `${name} denial code`).toBe('PERMISSION_DENIED');
    }

    expect(await snapshotState()).toEqual(before);
  }, 60_000);

  // ===========================================================================
  // 2. the wall is not a blanket deny — an ADMIN still writes
  // ===========================================================================
  it('allows an ACTIVE ADMIN to write (wall is not a blanket deny)', async () => {
    const res = await writerProbes(adminA.token).autosave();
    expect(res.status).toBe(200);

    const after = await pool.query(`SELECT version FROM presentation_decks WHERE id = $1`, [deckId]);
    expect(Number(after.rows[0].version)).toBeGreaterThan(1);

    // Put the fixture back to a known state for the remaining cases.
    await pool.query(
      `UPDATE presentation_decks SET version = 1, deck_json = $2 WHERE id = $1`,
      [deckId, JSON.stringify({ cards: [{ id: 'c1', title: 'original' }] })]
    );
    await pool.query(`DELETE FROM presentation_deck_versions WHERE deck_id = $1 AND id <> $2`, [deckId, versionId]);
  }, 60_000);

  // ===========================================================================
  // 3. revocation bites on the FIRST request with the SAME already-issued token
  // ===========================================================================
  it('denies a revoked member on the next request with the same token (no stale cache)', async () => {
    // Request #1 proves the token itself is good while the membership is ACTIVE.
    const allowed = await writerProbes(revokedA.token).autosave();
    expect(allowed.status).toBe(200);
    await pool.query(
      `UPDATE presentation_decks SET version = 1, deck_json = $2 WHERE id = $1`,
      [deckId, JSON.stringify({ cards: [{ id: 'c1', title: 'original' }] })]
    );
    await pool.query(`DELETE FROM presentation_deck_versions WHERE deck_id = $1 AND id <> $2`, [deckId, versionId]);

    // Revoke, then reuse the SAME token immediately.
    await pool.query(`UPDATE organization_members SET status = 'REVOKED' WHERE id = $1`, [revokedA.memberId]);

    const before = await snapshotState();
    const denied = await writerProbes(revokedA.token).autosave();
    expect(denied.status).toBe(403);
    expect(denied.body.code).toBe('ORG_MEMBERSHIP_REVOKED');
    expect(await snapshotState()).toEqual(before);
  }, 60_000);

  // ===========================================================================
  // 4. no membership row at all
  // ===========================================================================
  it('denies an identity with no organization_members row, whatever its token claims', async () => {
    const before = await snapshotState();
    const res = await writerProbes(ghostA.token).autosave();
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ORG_MEMBERSHIP_REVOKED');
    expect(await snapshotState()).toEqual(before);
  }, 60_000);

  // ===========================================================================
  // 5. foreign tenant
  // ===========================================================================
  it('does not let a foreign-tenant owner touch another tenant deck', async () => {
    const before = await snapshotState();
    const res = await writerProbes(ownerB.token).autosave();
    // OWNER of org B holds the capability and an ACTIVE membership in ITS OWN
    // tenant, so the wall passes it through — and the org-scoped lookup then
    // refuses to find org A's deck. Either way: no cross-tenant write.
    expect(res.status).toBe(404);
    expect(await snapshotState()).toEqual(before);
  }, 60_000);

  // ===========================================================================
  // 6. client-supplied tenant/actor in the body is inert
  // ===========================================================================
  it('ignores organizationId/userId supplied in the request body', async () => {
    const before = await snapshotState();

    // A VIEWER claiming to be the owner of another org stays a VIEWER.
    const spoofed = await writerProbes(viewerA.token, {
      organizationId: orgB,
      organization_id: orgB,
      userId: ownerA.id,
      role: 'OWNER',
    }).autosave();
    expect(spoofed.status).toBe(403);
    expect(spoofed.body.code).toBe('PERMISSION_DENIED');

    // A ghost claiming a tenant it has no membership in stays a ghost.
    const ghostSpoof = await writerProbes(ghostA.token, { organizationId: orgA, role: 'OWNER' }).autosave();
    expect(ghostSpoof.status).toBe(403);
    expect(ghostSpoof.body.code).toBe('ORG_MEMBERSHIP_REVOKED');

    expect(await snapshotState()).toEqual(before);
  }, 60_000);

  // ===========================================================================
  // 7. membership lookup failure must fail CLOSED
  // ===========================================================================
  it('fails closed when the membership lookup itself errors', async () => {
    const before = await snapshotState();
    // Make the lookup query fail for real by taking the table out from under
    // it. Restored in `finally` — this is a disposable database, but the
    // suite still must not depend on teardown for correctness.
    await pool.query(`ALTER TABLE organization_members RENAME TO organization_members__authwall_hidden`);
    try {
      const res = await writerProbes(adminA.token).autosave();
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('ORG_MEMBERSHIP_LOOKUP_FAILED');
    } finally {
      await pool.query(`ALTER TABLE organization_members__authwall_hidden RENAME TO organization_members`);
    }
    expect(await snapshotState()).toEqual(before);
  }, 60_000);

  // ===========================================================================
  // 8. reads stay reachable — the wall is writer-scoped
  // ===========================================================================
  it('leaves reads unchanged for the same VIEWER that every writer denies', async () => {
    const res = await request(app)
      .get(`/api/presentations/decks/${deckId}`)
      .set({ Authorization: `Bearer ${viewerA.token}` });
    expect(res.status).toBe(200);
  }, 60_000);
});
