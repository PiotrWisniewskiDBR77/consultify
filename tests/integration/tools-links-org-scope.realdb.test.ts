/**
 * TASK 2 (C14) — `tool_initiative_links` organization scope.
 *
 * `tool_initiative_links` had NO `organization_id` column; isolation was
 * only INDIRECT, via a join to `tool_sessions.organization_id`. Migration
 * `server/migrations/948_tool_promotion_tenant_idempotency.sql`
 * (`tool_initiative_links_set_organization_id()` /
 * `trg_tool_initiative_links_set_org_id`) adds a nullable `organization_id`,
 * backfills it deterministically from the linked `tool_sessions` row, adds
 * organization_id-first indexes, and adds a trigger that derives
 * `organization_id` for every future INSERT/UPDATE from the row's parent
 * `tool_sessions`, rejecting any write whose explicit `organization_id`
 * disagrees with that parent.
 *
 * PORTED (2026-08-13, S6 integration) from
 * `codex/tools-wt-bootstrap-20260813` @ `5d5646b3e3`, where this same
 * behavior was originally delivered by a standalone
 * `949_tool_initiative_links_org_scope.sql`. Per the integration task's
 * explicit instruction, 949 was NOT reintroduced — its logic is fully
 * consolidated into 948 by this branch's own `codex/mig948-consolidate-*`
 * work (see docs/program/METHOD_TOOLS_2026-08-13/MIGRATION_GRAPH.md,
 * "Not kept" section). Trigger name, function name, and the exact
 * exception message this suite asserts against (`RAISE EXCEPTION
 * 'tool_initiative_links.organization_id (%) does not match
 * tool_sessions.organization_id (%) ...'`) were verified byte-identical in
 * 948 before porting — this suite's assertions did not need to change,
 * only the doc comments and the helper import (see below).
 *
 * Also adapted: points at the canonical `./_helpers/assertRealPostgres.js`
 * (async, no-arg call) instead of the worktree-local `bootstrapHelpers.ts`,
 * which never merged and does not exist on this branch.
 *
 * This suite proves, against a REAL Postgres database (no mocks):
 *   1. cross-org read is blocked (a direct, no-join query scoped to org A
 *      never returns org B's rows)
 *   2. cross-org write is blocked (the trigger rejects an INSERT whose
 *      organization_id disagrees with the parent tool_session's org)
 *   3. direct read of the link WITHOUT a join to tool_sessions is
 *      org-scoped (the entire point of the migration — this was
 *      structurally impossible before it)
 *   4. identical business identifiers in two different organizations do
 *      not collide — `batch_id` is not globally unique (every org's
 *      'initiative' promotions share the literal string
 *      'promote-initiative', see `ToolController.promoteToOutput`
 *      `promoteBatchId`), so a query scoped only by organization_id must
 *      not conflate org A's and org B's rows that share that batch_id.
 *
 * HOW TO RUN LOCALLY (this workstream's disposable container):
 *   RUN_DB_TESTS=1 MOCK_DB=false \
 *     DATABASE_URL=postgres://consultinity:test@localhost:56505/consultinity \
 *     npx vitest run tests/integration/tools-links-org-scope.realdb.test.ts
 */

import { randomUUID } from 'node:crypto';

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from './_helpers/assertRealPostgres.js';

process.env.DB_TYPE = 'postgres';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

describe('tool_initiative_links organization scope (C14, real Postgres)', () => {
  const suffix = randomUUID();
  const orgA = `org-c14-a-${suffix}`;
  const orgB = `org-c14-b-${suffix}`;
  const userA = `user-c14-a-${suffix}`;
  const userB = `user-c14-b-${suffix}`;
  const sessionA = `tool-c14-a-${suffix}`;
  const sessionB = `tool-c14-b-${suffix}`;
  // Deliberately the SAME batch_id in both orgs — mirrors
  // `promoteBatchId = 'promote-' + outputType` in ToolController, which is
  // not org-namespaced and collides across every organization that has
  // ever promoted an 'initiative' output.
  const sharedBatchId = 'promote-initiative';
  const linkA = `link-c14-a-${suffix}`;
  const linkB = `link-c14-b-${suffix}`;
  const initiativeA = `initiative-c14-a-${suffix}`;
  const initiativeB = `initiative-c14-b-${suffix}`;

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  // Guards afterAll below: if beforeAll throws before `client.connect()`
  // runs (the expected outcome when preconditions are missing — see
  // assertRealPostgresTestEnvironment()), an unconnected pg.Client hangs
  // for the full hookTimeout on any `.query()`/`.end()` call instead of
  // failing fast.
  let connected = false;

  beforeAll(async () => {
    // ABSOLUTE RULE for this workstream: fail, never skip, never mock.
    await assertRealPostgresTestEnvironment();
    await client.connect();
    connected = true;

    for (const [id, name] of [
      [orgA, 'C14 org A'],
      [orgB, 'C14 org B'],
    ]) {
      await client.query(
        `INSERT INTO organizations (id, name, plan, status) VALUES ($1,$2,'enterprise','active')
         ON CONFLICT (id) DO NOTHING`,
        [id, name]
      );
    }
    for (const [uid, oid] of [
      [userA, orgA],
      [userB, orgB],
    ]) {
      await client.query(
        `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
         VALUES ($1,$2,$3,'x','ADMIN','active','C14','Tester')
         ON CONFLICT (id) DO NOTHING`,
        [uid, oid, `${uid}@local.test`]
      );
    }
    for (const [sid, oid, uid] of [
      [sessionA, orgA, userA],
      [sessionB, orgB, userB],
    ]) {
      await client.query(
        `INSERT INTO tool_sessions (
           id, organization_id, tool_type, name, status,
           completion_percent, confidence_avg, created_by, created_at, updated_at
         ) VALUES ($1,$2,'SWOT','C14 fixture session','APPROVED',100,5,$3,NOW(),NOW())`,
        [sid, oid, uid]
      );
    }
    for (const [iid, oid] of [
      [initiativeA, orgA],
      [initiativeB, orgB],
    ]) {
      await client.query(
        `INSERT INTO initiatives (id, organization_id, name, status, created_at, updated_at)
         VALUES ($1,$2,'C14 fixture initiative','DRAFT',NOW(),NOW())`,
        [iid, oid]
      );
    }

    // Two links, same batch_id, one per org — organization_id is NOT
    // supplied here: the trigger must derive it from tool_session_id.
    // output_type/idempotency_key/source_revision are required NOT NULL
    // columns added after this suite was originally written (this
    // branch's C15/C16 tenant-idempotency ledger, migration 948 — see
    // this file's header) — supplied here with values consistent with
    // `sharedBatchId = 'promote-initiative'`.
    await client.query(
      `INSERT INTO tool_initiative_links (id, tool_session_id, batch_id, initiative_id, output_type, source_revision, idempotency_key, created_at)
       VALUES ($1,$2,$3,$4,'initiative',1,$5,NOW())`,
      [linkA, sessionA, sharedBatchId, initiativeA, `${linkA}-idem`]
    );
    await client.query(
      `INSERT INTO tool_initiative_links (id, tool_session_id, batch_id, initiative_id, output_type, source_revision, idempotency_key, created_at)
       VALUES ($1,$2,$3,$4,'initiative',1,$5,NOW())`,
      [linkB, sessionB, sharedBatchId, initiativeB, `${linkB}-idem`]
    );
  });

  afterAll(async () => {
    if (!connected) return; // beforeAll threw before connecting — nothing to clean up.
    await client
      .query(`DELETE FROM tool_initiative_links WHERE tool_session_id = ANY($1)`, [[sessionA, sessionB]])
      .catch(() => {});
    await client.query(`DELETE FROM initiatives WHERE id = ANY($1)`, [[initiativeA, initiativeB]]).catch(() => {});
    await client.query(`DELETE FROM tool_sessions WHERE id = ANY($1)`, [[sessionA, sessionB]]).catch(() => {});
    await client.query(`DELETE FROM users WHERE id = ANY($1)`, [[userA, userB]]).catch(() => {});
    await client.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[orgA, orgB]]).catch(() => {});
    await client.end();
  });

  it('backfill/trigger populated organization_id from the parent tool_session for both fixture rows', async () => {
    const { rows } = await client.query(
      `SELECT id, organization_id FROM tool_initiative_links WHERE id = ANY($1) ORDER BY id`,
      [[linkA, linkB]]
    );
    expect(rows).toHaveLength(2);
    const byId = Object.fromEntries(rows.map((r: any) => [r.id, r.organization_id]));
    expect(byId[linkA]).toBe(orgA);
    expect(byId[linkB]).toBe(orgB);
  });

  // ── 3. direct read WITHOUT a join is org-scoped ──────────────────────────
  it('a direct read of tool_initiative_links (no join to tool_sessions) is org-scoped', async () => {
    const { rows: rowsA } = await client.query(
      `SELECT id, batch_id, initiative_id FROM tool_initiative_links WHERE organization_id = $1`,
      [orgA]
    );
    expect(rowsA.map((r: any) => r.id)).toEqual([linkA]);
    expect(rowsA.map((r: any) => r.id)).not.toContain(linkB);

    const { rows: rowsB } = await client.query(
      `SELECT id, batch_id, initiative_id FROM tool_initiative_links WHERE organization_id = $1`,
      [orgB]
    );
    expect(rowsB.map((r: any) => r.id)).toEqual([linkB]);
    expect(rowsB.map((r: any) => r.id)).not.toContain(linkA);
  });

  // ── 1. cross-org read is blocked ─────────────────────────────────────────
  it('cross-org read is blocked: org A cannot read org B by id when scoped', async () => {
    const { rows } = await client.query(
      `SELECT id FROM tool_initiative_links WHERE id = $1 AND organization_id = $2`,
      [linkB, orgA]
    );
    expect(rows).toEqual([]);

    // Sanity: the row genuinely exists (proves the empty result above is
    // the org filter working, not a fixture-setup mistake).
    const { rows: unscoped } = await client.query(
      `SELECT id FROM tool_initiative_links WHERE id = $1`,
      [linkB]
    );
    expect(unscoped).toHaveLength(1);
  });

  // ── 4. identical business identifiers in two orgs do not collide ────────
  it('identical batch_id in two organizations does not collide under org-scoped read', async () => {
    const { rows: bothOrgsShareBatchId } = await client.query(
      `SELECT organization_id, initiative_id FROM tool_initiative_links WHERE batch_id = $1 ORDER BY organization_id`,
      [sharedBatchId]
    );
    // Precondition: the collision is real (both orgs really do use the
    // same batch_id) — otherwise this test would prove nothing.
    expect(bothOrgsShareBatchId.map((r: any) => r.organization_id).sort()).toEqual([orgA, orgB].sort());

    const { rows: scopedToA } = await client.query(
      `SELECT initiative_id FROM tool_initiative_links WHERE organization_id = $1 AND batch_id = $2`,
      [orgA, sharedBatchId]
    );
    expect(scopedToA).toEqual([{ initiative_id: initiativeA }]);

    const { rows: scopedToB } = await client.query(
      `SELECT initiative_id FROM tool_initiative_links WHERE organization_id = $1 AND batch_id = $2`,
      [orgB, sharedBatchId]
    );
    expect(scopedToB).toEqual([{ initiative_id: initiativeB }]);
  });

  // ── 2. cross-org write is blocked ────────────────────────────────────────
  describe('cross-org write is blocked (trigger enforcement)', () => {
    it('rejects an INSERT whose explicit organization_id disagrees with the parent tool_session', async () => {
      const rogueId = `link-c14-rogue-${suffix}`;
      // output_type/source_revision/idempotency_key omitted deliberately:
      // the BEFORE INSERT trigger runs (and RAISE EXCEPTIONs) before
      // Postgres ever reaches NOT NULL constraint checking on this row, so
      // this INSERT must fail with the org-mismatch error regardless of
      // those other columns being unset.
      await expect(
        client.query(
          `INSERT INTO tool_initiative_links (id, tool_session_id, batch_id, initiative_id, organization_id, created_at)
           VALUES ($1,$2,$3,$4,$5,NOW())`,
          [rogueId, sessionA, sharedBatchId, initiativeA, orgB]
        )
      ).rejects.toThrow(/does not match tool_sessions\.organization_id/);

      const { rows } = await client.query(`SELECT id FROM tool_initiative_links WHERE id = $1`, [rogueId]);
      expect(rows).toEqual([]);
    });

    it('rejects an UPDATE that tries to re-point organization_id away from the parent session', async () => {
      await expect(
        client.query(`UPDATE tool_initiative_links SET organization_id = $1 WHERE id = $2`, [orgB, linkA])
      ).rejects.toThrow(/does not match tool_sessions\.organization_id/);

      // Row is unchanged.
      const { rows } = await client.query(
        `SELECT organization_id FROM tool_initiative_links WHERE id = $1`,
        [linkA]
      );
      expect(rows[0].organization_id).toBe(orgA);
    });

    it('auto-derives organization_id for a write that omits it, regardless of caller intent', async () => {
      const deriveId = `link-c14-derive-${suffix}`;
      await client.query(
        `INSERT INTO tool_initiative_links (id, tool_session_id, batch_id, initiative_id, output_type, source_revision, idempotency_key, created_at)
         VALUES ($1,$2,$3,$4,'report',1,$5,NOW())`,
        [deriveId, sessionB, 'promote-report', initiativeB, `${deriveId}-idem`]
      );
      const { rows } = await client.query(
        `SELECT organization_id FROM tool_initiative_links WHERE id = $1`,
        [deriveId]
      );
      expect(rows[0].organization_id).toBe(orgB);
      await client.query(`DELETE FROM tool_initiative_links WHERE id = $1`, [deriveId]);
    });
  });
});
