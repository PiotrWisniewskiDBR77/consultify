#!/usr/bin/env tsx
/**
 * ASM-001A Codex FIX_REQUIRED #2 — capability enforcement negative controls,
 * REAL Postgres, REAL v8 assessment router, REAL auth middleware. No
 * business-logic mocks.
 *
 * Discovery (Fala 1/3) confirmed POST /api/v8/assessment (create) and
 * PUT /:assessmentId (edit) had NO capability check at all — any
 * authenticated org member, including a viewer/read-only role, could create
 * or edit assessments. This test proves the fix from
 * server/src/routes/v8/assessment.routes.ts:
 *   - a viewer/read-only org role gets 403 on create, zero row inserted;
 *   - a viewer/read-only org role gets 403 on edit, the row is byte-for-byte
 *     unchanged (SQL diff before/after);
 *   - an allowed role (OWNER) gets 201 on create and 200 on edit;
 *   - cross-tenant PUT (org B token, org A's assessmentId) still 404s, NOT
 *     403 — the capability check must run AFTER the org-scope check, or a
 *     403 would leak that the resource exists in a foreign org. Zero
 *     mutation on the rejected cross-tenant PUT.
 *
 * Writes ONLY to the LOCAL Postgres (guarded by harness.requireLocalDbUrl),
 * under the reversible `asm001acap--` id prefix, cleaned up in `finally`.
 */
import assert from 'node:assert/strict';

import bcrypt from 'bcryptjs';
import express from 'express';
import request from 'supertest';

import { assertAuthHermetic, mintToken, pgClient, requireLocalDbUrl } from './harness.js';

requireLocalDbUrl();

const PREFIX = 'asm001acap--';
const ORG_A = `${PREFIX}org-a`;
const ORG_B = `${PREFIX}org-b`;
const USER_OWNER_A = `${PREFIX}user-owner-a`;
// NOTE: 'VIEWER' is NOT a legal organization_members.role in this schema —
// discovered live via the DB CHECK constraint
// organization_members_role_check, which only permits
// ('OWNER','ADMIN','MEMBER','CONSULTANT','USER','GUEST'). GUEST is the
// actual read-only/viewer-semantics role at the org-member level (matches
// server/src/utils/roleNormalization.ts's ApplicationRole.GUEST bucket,
// which folds VIEWER/CLIENT/GUEST together) — so this is the real
// read-only role, not a synthetic one.
const USER_VIEWER_A = `${PREFIX}user-guest-a`;
const USER_OWNER_B = `${PREFIX}user-owner-b`;
const HARNESS_PASSWORD = 'Asm001aCap!Harness123';

let passCount = 0;
let failCount = 0;

async function step(name, fn) {
  try {
    await fn();
    passCount += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failCount += 1;
    console.error(`  ✗ ${name}`);
    console.error(err instanceof Error ? err.stack || err.message : err);
  }
}

async function seedOrgAndUser(client, orgId, userId, email, membershipRole) {
  const now = new Date().toISOString();
  const passwordHash = bcrypt.hashSync(HARNESS_PASSWORD, 10);

  await client.query(
    `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
     VALUES ($1, $2, 'enterprise', 'active', 1, $3)
     ON CONFLICT (id) DO NOTHING`,
    [orgId, `ASM-001A Cap Harness ${orgId}`, now]
  );

  await client.query(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
     VALUES ($1, $2, $3, $4, $5, 'active', 'Asm001aCap', 'Harness', $6)
     ON CONFLICT (id) DO NOTHING`,
    [userId, orgId, email, passwordHash, membershipRole, now]
  );

  // Membership must be ACTIVE — auth.middleware resolves org via
  // organization_members (same requirement documented in
  // tests/acceptance/seed.mjs). The membership role is what
  // canCreateOrEditAssessment() and ensureWorkbenchPermission() actually
  // gate on via req.userRole.
  await client.query(
    `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
     SELECT $5, $1, $2, $3, 'ACTIVE', $4
     WHERE NOT EXISTS (
       SELECT 1 FROM organization_members WHERE organization_id = $1 AND user_id = $2
     )`,
    [orgId, userId, membershipRole, now, `${PREFIX}mem-${userId}`]
  );
}

async function cleanup(client, createdAssessmentIds) {
  if (createdAssessmentIds.length > 0) {
    await client.query(`DELETE FROM assessment_sessions WHERE assessment_id = ANY($1)`, [
      createdAssessmentIds,
    ]);
    await client.query(`DELETE FROM assessments WHERE id = ANY($1)`, [createdAssessmentIds]);
  }
  // Belt-and-braces: also sweep by name prefix in case a denied POST
  // somehow slipped a row in despite the assertion (would indicate the fix
  // is broken, but cleanup must not depend on that not happening).
  await client.query(`DELETE FROM assessments WHERE name LIKE $1`, [`${PREFIX}%`]);
  await client.query(`DELETE FROM organization_members WHERE organization_id = ANY($1)`, [
    [ORG_A, ORG_B],
  ]);
  await client.query(`DELETE FROM users WHERE id = ANY($1)`, [
    [USER_OWNER_A, USER_VIEWER_A, USER_OWNER_B],
  ]);
  await client.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[ORG_A, ORG_B]]);
}

async function main() {
  console.log('[asm-001a-capability-negative-controls] connecting to local Postgres...');
  const client = pgClient();
  await client.connect();

  const createdAssessmentIds = [];
  let app;

  try {
    await seedOrgAndUser(
      client,
      ORG_A,
      USER_OWNER_A,
      'asm001acap-owner-a@acceptance.local',
      'OWNER'
    );
    await seedOrgAndUser(
      client,
      ORG_A,
      USER_VIEWER_A,
      'asm001acap-guest-a@acceptance.local',
      'GUEST'
    );
    await seedOrgAndUser(
      client,
      ORG_B,
      USER_OWNER_B,
      'asm001acap-owner-b@acceptance.local',
      'OWNER'
    );

    const { verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
    const { attachV8Context } = await import('../../server/src/middleware/v8Auth.middleware.js');
    const assessmentRouter = (
      await import('../../server/src/routes/v8/assessment.routes.js')
    ).default;

    app = express();
    app.use(express.json({ limit: '1mb' }));
    app.use('/api/v8/assessment', verifyToken, attachV8Context, assessmentRouter);

    // Deliberately NOT wrapped in step() — see harness.ts's assertAuthHermetic
    // doc comment: must abort the whole run with ONE clear diagnostic instead
    // of being swallowed into "N of M steps failed" alongside a wall of
    // confusing downstream 401s that all share the same root cause.
    await assertAuthHermetic(app, '/api/v8/assessment');
    console.log('  ✓ FAIL-FAST: harness JWT_SECRET matches the mounted verifyToken middleware');

    const tokenOwnerA = mintToken({
      id: USER_OWNER_A,
      organizationId: ORG_A,
      organization_id: ORG_A,
      role: 'OWNER',
    });
    const tokenViewerA = mintToken({
      id: USER_VIEWER_A,
      organizationId: ORG_A,
      organization_id: ORG_A,
      role: 'GUEST',
    });
    const tokenOwnerB = mintToken({
      id: USER_OWNER_B,
      organizationId: ORG_B,
      organization_id: ORG_B,
      role: 'OWNER',
    });

    // -----------------------------------------------------------------
    // (a) viewer/read-only token -> POST -> 403, zero row inserted.
    // -----------------------------------------------------------------
    const viewerCreateAttemptName = `${PREFIX}viewer-create-attempt`;
    await step('(a) POST as GUEST (read-only org role) -> 403 INSUFFICIENT_ROLE, zero row inserted', async () => {
      const res = await request(app)
        .post('/api/v8/assessment')
        .set('Authorization', `Bearer ${tokenViewerA}`)
        .send({ assessmentType: 'DRD', name: viewerCreateAttemptName });

      assert.equal(res.status, 403);
      assert.equal(res.body.code, 'INSUFFICIENT_ROLE');

      const { rows } = await client.query(
        `SELECT id FROM assessments WHERE organization_id = $1 AND name = $2`,
        [ORG_A, viewerCreateAttemptName]
      );
      assert.equal(rows.length, 0, 'the denied POST must not have inserted any row');
    });

    // -----------------------------------------------------------------
    // (c) allowed role (OWNER) -> POST -> 201.
    // -----------------------------------------------------------------
    let assessmentId;
    await step('(c) POST as OWNER (allowed role) -> 201', async () => {
      const res = await request(app)
        .post('/api/v8/assessment')
        .set('Authorization', `Bearer ${tokenOwnerA}`)
        .send({ assessmentType: 'DRD', name: `${PREFIX}base-assessment` });

      assert.equal(res.status, 201);
      assessmentId = res.body?.data?.id;
      assert.ok(assessmentId);
      createdAssessmentIds.push(assessmentId);
    });

    // -----------------------------------------------------------------
    // (b) viewer/read-only token -> PUT on an existing assessment -> 403,
    // row byte-for-byte unchanged (SQL diff before/after).
    // -----------------------------------------------------------------
    await step(
      '(b) PUT as GUEST (read-only org role) on an existing assessment -> 403, row unchanged (SQL diff before/after)',
      async () => {
        const { rows: beforeRows } = await client.query(
          `SELECT name, answers_json, completion_percent, updated_at FROM assessments WHERE id = $1`,
          [assessmentId]
        );
        assert.equal(beforeRows.length, 1);
        const before = beforeRows[0];

        const res = await request(app)
          .put(`/api/v8/assessment/${assessmentId}`)
          .set('Authorization', `Bearer ${tokenViewerA}`)
          .send({
            name: 'GUEST SHOULD NOT BE ABLE TO SET THIS',
            answers: { drd: { areas: { 'malicious-write': { achievedLevel: 5 } } } },
            completionPercent: 999,
          });

        assert.equal(res.status, 403);
        assert.equal(res.body.code, 'P28_PERMISSION_DENIED');

        const { rows: afterRows } = await client.query(
          `SELECT name, answers_json, completion_percent, updated_at FROM assessments WHERE id = $1`,
          [assessmentId]
        );
        assert.equal(afterRows.length, 1);
        const after = afterRows[0];

        assert.deepEqual(
          after,
          before,
          'the row must be byte-for-byte identical after a denied PUT — no partial writes'
        );
      }
    );

    // -----------------------------------------------------------------
    // (c) allowed role (OWNER, the creator/owner of the assessment) -> PUT
    // -> 200.
    // -----------------------------------------------------------------
    await step('(c) PUT as OWNER (allowed role, assessment owner) -> 200', async () => {
      const res = await request(app)
        .put(`/api/v8/assessment/${assessmentId}`)
        .set('Authorization', `Bearer ${tokenOwnerA}`)
        .send({ name: `${PREFIX}base-assessment-renamed` });

      assert.equal(res.status, 200);

      const { rows } = await client.query(`SELECT name FROM assessments WHERE id = $1`, [
        assessmentId,
      ]);
      assert.equal(rows[0].name, `${PREFIX}base-assessment-renamed`);
    });

    // -----------------------------------------------------------------
    // (d) cross-tenant PUT (org B token, org A's assessmentId) -> 404, NOT
    // 403 — regression guard. Zero mutation.
    // -----------------------------------------------------------------
    await step(
      '(d) PUT with org B token + org A assessmentId -> 404 ASSESSMENT_NOT_FOUND (not 403), zero mutation',
      async () => {
        const { rows: beforeRows } = await client.query(
          `SELECT name, answers_json, completion_percent, updated_at FROM assessments WHERE id = $1`,
          [assessmentId]
        );
        const before = beforeRows[0];

        const res = await request(app)
          .put(`/api/v8/assessment/${assessmentId}`)
          .set('Authorization', `Bearer ${tokenOwnerB}`)
          .send({ name: 'CROSS-TENANT WRITE ATTEMPT' });

        assert.equal(res.status, 404);
        assert.equal(res.body.code, 'ASSESSMENT_NOT_FOUND');
        assert.notEqual(
          res.status,
          403,
          'cross-tenant PUT must never be 403 — that would leak that the resource exists in a foreign org'
        );

        const { rows: afterRows } = await client.query(
          `SELECT name, answers_json, completion_percent, updated_at FROM assessments WHERE id = $1`,
          [assessmentId]
        );
        assert.deepEqual(
          afterRows[0],
          before,
          'the row must be unchanged after the rejected cross-tenant PUT'
        );
      }
    );

    // Also prove cross-tenant CREATE-path capability check does not
    // interfere with org scoping: org B (allowed role) creating in its own
    // org still works normally.
    await step('(d) verify: org B (allowed role) can still create in its OWN org -> 201', async () => {
      const res = await request(app)
        .post('/api/v8/assessment')
        .set('Authorization', `Bearer ${tokenOwnerB}`)
        .send({ assessmentType: 'DRD', name: `${PREFIX}org-b-own-assessment` });

      assert.equal(res.status, 201);
      const orgBAssessmentId = res.body?.data?.id;
      assert.ok(orgBAssessmentId);
      createdAssessmentIds.push(orgBAssessmentId);
    });
  } finally {
    try {
      await cleanup(client, createdAssessmentIds);
      console.log(
        '[asm-001a-capability-negative-controls] cleanup OK (asm001acap-- rows removed)'
      );
    } finally {
      await client.end();
    }
  }

  console.log(`\n[asm-001a-capability-negative-controls] ${passCount} passed, ${failCount} failed`);
  if (failCount > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('[asm-001a-capability-negative-controls] FATAL', err);
  process.exitCode = 1;
});
