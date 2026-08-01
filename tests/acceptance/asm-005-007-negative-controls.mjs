#!/usr/bin/env tsx
/**
 * ASM-005/006/007 negative controls — tenant + role isolation, REAL Postgres.
 * Mirrors the structure of tests/acceptance/asm-001a-negative-controls.mjs
 * and tests/acceptance/asm-001a-capability-negative-controls.mjs.
 *
 * Run:
 *   node tests/acceptance/run.mjs
 *   DATABASE_URL=postgres://consultinity:consultinity@localhost:5442/consultinity \
 *     NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *     npx tsx tests/acceptance/asm-005-007-negative-controls.mjs
 *
 * Covers:
 *   - Cross-org: org A creates an assessment; org B's user hits every one of
 *     the 5 new endpoints (POST/GET evidence, POST review, GET review-history,
 *     GET report) against org A's assessment id -> all 404 ASSESSMENT_NOT_FOUND
 *     (never 403 — a foreign-org caller must not be able to distinguish
 *     "doesn't exist" from "exists but not yours").
 *   - Role: a same-org user with only default view-level permission (not the
 *     assessment creator/owner, no explicit assessment_roles row -> defaults
 *     to 'viewer' per AssessmentPermissionService.getUserRole: canView=true,
 *     canEdit=false, canApprove=false) attempts POST /evidence -> 403, and
 *     POST /review -> 403 P28_PERMISSION_DENIED. The same user's GET
 *     endpoints (canView=true) are also probed to prove the denial is
 *     specific to canEdit/canApprove, not a blanket lockout.
 *   - Belt-and-braces: confirms the denied POSTs wrote nothing to the DB.
 *
 * Writes ONLY to the LOCAL Postgres (guarded by harness.requireLocalDbUrl),
 * under the reversible `asm005007neg--` id prefix, cleaned up in `finally`.
 */
import assert from 'node:assert/strict';

import bcrypt from 'bcryptjs';
import express from 'express';
import request from 'supertest';

import { assertAuthHermetic, mintToken, pgClient, requireLocalDbUrl } from './harness.js';

requireLocalDbUrl();

const PREFIX = 'asm005007neg--';
const ORG_A = `${PREFIX}org-a`;
const ORG_B = `${PREFIX}org-b`;
const USER_A = `${PREFIX}user-owner-a`;
// Same-org, NOT the assessment creator, NO explicit assessment_roles row ->
// AssessmentPermissionService.getUserRole defaults to 'viewer'
// (canView=true, canEdit=false, canApprove=false). 'MEMBER' is a legal
// organization_members.role (see organization_members_role_check) and is
// NOT one of the isGlobalAdminRole buckets (ADMIN/ADMINISTRATOR/OWNER/
// SUPERADMIN/SUPER_ADMIN), so it exercises the real per-assessment
// permission lookup rather than the admin-bypass short-circuit.
const USER_C = `${PREFIX}user-member-a`;
const USER_B = `${PREFIX}user-owner-b`;
const HARNESS_PASSWORD = 'Asm005007Neg!Harness123';

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
    [orgId, `ASM-005/007 Neg Harness ${orgId}`, now]
  );

  await client.query(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
     VALUES ($1, $2, $3, $4, $5, 'active', 'Asm005007Neg', 'Harness', $6)
     ON CONFLICT (id) DO NOTHING`,
    [userId, orgId, email, passwordHash, membershipRole, now]
  );

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
    await client.query(`DELETE FROM assessment_accepted_snapshots WHERE assessment_id = ANY($1)`, [
      createdAssessmentIds,
    ]);
    await client.query(`DELETE FROM assessment_quality_reviews WHERE assessment_id = ANY($1)`, [
      createdAssessmentIds,
    ]);
    await client.query(`DELETE FROM assessment_axis_evidence WHERE assessment_id = ANY($1)`, [
      createdAssessmentIds,
    ]);
    await client.query(`DELETE FROM assessment_sessions WHERE assessment_id = ANY($1)`, [
      createdAssessmentIds,
    ]);
    await client.query(`DELETE FROM assessments WHERE id = ANY($1)`, [createdAssessmentIds]);
  }
  await client.query(`DELETE FROM organization_members WHERE organization_id = ANY($1)`, [
    [ORG_A, ORG_B],
  ]);
  await client.query(`DELETE FROM users WHERE id = ANY($1)`, [[USER_A, USER_C, USER_B]]);
  await client.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[ORG_A, ORG_B]]);
}

async function main() {
  console.log('[asm-005-007-negative-controls] connecting to local Postgres...');
  const client = pgClient();
  await client.connect();

  const createdAssessmentIds = [];
  let app;

  try {
    await seedOrgAndUser(client, ORG_A, USER_A, 'asm005007neg-owner-a@acceptance.local', 'OWNER');
    await seedOrgAndUser(client, ORG_A, USER_C, 'asm005007neg-member-a@acceptance.local', 'MEMBER');
    await seedOrgAndUser(client, ORG_B, USER_B, 'asm005007neg-owner-b@acceptance.local', 'OWNER');

    const { verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
    const { attachV8Context } = await import('../../server/src/middleware/v8Auth.middleware.js');
    const assessmentRouter = (
      await import('../../server/src/routes/v8/assessment.routes.js')
    ).default;
    const { DRD_STRUCTURE } = await import('../../server/src/data/drdStructure.js');

    app = express();
    app.use(express.json({ limit: '1mb' }));
    app.use('/api/v8/assessment', verifyToken, attachV8Context, assessmentRouter);

    await assertAuthHermetic(app, '/api/v8/assessment');
    console.log('  ✓ FAIL-FAST: harness JWT_SECRET matches the mounted verifyToken middleware');

    const tokenA = mintToken({
      id: USER_A,
      organizationId: ORG_A,
      organization_id: ORG_A,
      role: 'OWNER',
    });
    const tokenC = mintToken({
      id: USER_C,
      organizationId: ORG_A,
      organization_id: ORG_A,
      role: 'MEMBER',
    });
    const tokenB = mintToken({
      id: USER_B,
      organizationId: ORG_B,
      organization_id: ORG_B,
      role: 'OWNER',
    });

    const axisId = String(DRD_STRUCTURE[0].id);
    const areaId = DRD_STRUCTURE[0].areas[0].id;

    let assessmentId;
    await step('setup: create a DRD assessment in org A (owned by user A)', async () => {
      const res = await request(app)
        .post('/api/v8/assessment')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ assessmentType: 'DRD', name: 'ASM-005/007 neg-controls base' });
      assert.equal(res.status, 201);
      assessmentId = res.body?.data?.id;
      assert.ok(assessmentId);
      createdAssessmentIds.push(assessmentId);
    });

    // ---------------------------------------------------------------------
    // Cross-org: org B token + org A assessment id -> 404 on all 5 new
    // endpoints, never 403.
    // ---------------------------------------------------------------------
    await step(
      'cross-org: POST /evidence with org B token + org A assessment id -> 404 ASSESSMENT_NOT_FOUND',
      async () => {
        const res = await request(app)
          .post(`/api/v8/assessment/${assessmentId}/evidence`)
          .set('Authorization', `Bearer ${tokenB}`)
          .send({ axisId, areaId, evidenceType: 'note', title: 'cross-org write attempt' });
        assert.equal(res.status, 404);
        assert.equal(res.body.code, 'ASSESSMENT_NOT_FOUND');
        assert.notEqual(res.status, 403);
      }
    );

    await step(
      'cross-org: GET /evidence with org B token + org A assessment id -> 404 ASSESSMENT_NOT_FOUND',
      async () => {
        const res = await request(app)
          .get(`/api/v8/assessment/${assessmentId}/evidence`)
          .set('Authorization', `Bearer ${tokenB}`);
        assert.equal(res.status, 404);
        assert.equal(res.body.code, 'ASSESSMENT_NOT_FOUND');
        assert.notEqual(res.status, 403);
      }
    );

    await step(
      'cross-org: POST /review with org B token + org A assessment id -> 404 ASSESSMENT_NOT_FOUND',
      async () => {
        const res = await request(app)
          .post(`/api/v8/assessment/${assessmentId}/review`)
          .set('Authorization', `Bearer ${tokenB}`)
          .send({ action: 'accept', rationale: 'cross-org accept attempt' });
        assert.equal(res.status, 404);
        assert.equal(res.body.code, 'ASSESSMENT_NOT_FOUND');
        assert.notEqual(res.status, 403);
      }
    );

    await step(
      'cross-org: GET /review-history with org B token + org A assessment id -> 404 ASSESSMENT_NOT_FOUND',
      async () => {
        const res = await request(app)
          .get(`/api/v8/assessment/${assessmentId}/review-history`)
          .set('Authorization', `Bearer ${tokenB}`);
        assert.equal(res.status, 404);
        assert.equal(res.body.code, 'ASSESSMENT_NOT_FOUND');
        assert.notEqual(res.status, 403);
      }
    );

    await step(
      'cross-org: GET /report with org B token + org A assessment id -> 404 ASSESSMENT_NOT_FOUND',
      async () => {
        const res = await request(app)
          .get(`/api/v8/assessment/${assessmentId}/report`)
          .set('Authorization', `Bearer ${tokenB}`);
        assert.equal(res.status, 404);
        assert.equal(res.body.code, 'ASSESSMENT_NOT_FOUND');
        assert.notEqual(res.status, 403);
      }
    );

    await step(
      'verify: the rejected cross-org POST /evidence wrote nothing to the DB',
      async () => {
        const { rows } = await client.query(
          `SELECT id FROM assessment_axis_evidence WHERE assessment_id = $1`,
          [assessmentId]
        );
        assert.equal(rows.length, 0, 'no evidence row should exist after the 404-rejected cross-org POST');
      }
    );

    await step(
      'verify: the rejected cross-org POST /review wrote nothing to the DB',
      async () => {
        const { rows } = await client.query(
          `SELECT id FROM assessment_quality_reviews WHERE assessment_id = $1`,
          [assessmentId]
        );
        assert.equal(rows.length, 0, 'no review row should exist after the 404-rejected cross-org POST');
      }
    );

    // ---------------------------------------------------------------------
    // Role: same-org, default-viewer user (canView=true, canEdit=false,
    // canApprove=false) -> 403 on the mutating endpoints, 200 on the reads.
    // ---------------------------------------------------------------------
    await step(
      'role: GET /evidence as default-viewer (canView=true) still succeeds -> 200 (proves the later 403s are permission-specific, not a blanket lockout)',
      async () => {
        const res = await request(app)
          .get(`/api/v8/assessment/${assessmentId}/evidence`)
          .set('Authorization', `Bearer ${tokenC}`);
        assert.equal(res.status, 200);
      }
    );

    await step(
      'role: POST /evidence as default-viewer (no canEdit) -> 403',
      async () => {
        const res = await request(app)
          .post(`/api/v8/assessment/${assessmentId}/evidence`)
          .set('Authorization', `Bearer ${tokenC}`)
          .send({ axisId, areaId, evidenceType: 'note', title: 'viewer should not be able to add this' });
        assert.equal(res.status, 403);

        const { rows } = await client.query(
          `SELECT id FROM assessment_axis_evidence WHERE assessment_id = $1`,
          [assessmentId]
        );
        assert.equal(rows.length, 0, 'no evidence row should exist after the 403-denied POST');
      }
    );

    await step(
      'role: POST /review as default-viewer (no canApprove) -> 403 P28_PERMISSION_DENIED',
      async () => {
        const res = await request(app)
          .post(`/api/v8/assessment/${assessmentId}/review`)
          .set('Authorization', `Bearer ${tokenC}`)
          .send({ action: 'accept', rationale: 'viewer should not be able to approve this' });
        assert.equal(res.status, 403);
        assert.equal(res.body.code, 'P28_PERMISSION_DENIED');

        const { rows } = await client.query(
          `SELECT id FROM assessment_quality_reviews WHERE assessment_id = $1`,
          [assessmentId]
        );
        assert.equal(rows.length, 0, 'no review row should exist after the 403-denied POST');
      }
    );

    await step(
      'role: POST /review return as default-viewer (no canApprove) -> 403 P28_PERMISSION_DENIED',
      async () => {
        const res = await request(app)
          .post(`/api/v8/assessment/${assessmentId}/review`)
          .set('Authorization', `Bearer ${tokenC}`)
          .send({ action: 'return', rationale: 'viewer should not be able to return this either' });
        assert.equal(res.status, 403);
        assert.equal(res.body.code, 'P28_PERMISSION_DENIED');
      }
    );

    await step(
      'role: GET /review-history as default-viewer (canView=true) still succeeds -> 200, empty',
      async () => {
        const res = await request(app)
          .get(`/api/v8/assessment/${assessmentId}/review-history`)
          .set('Authorization', `Bearer ${tokenC}`);
        assert.equal(res.status, 200);
        assert.deepEqual(res.body.data.reviews, []);
      }
    );

    await step(
      'role: GET /report as default-viewer (canView=true) still succeeds -> 404 NO_ACCEPTED_OUTPUT (not 403 — never accepted yet)',
      async () => {
        const res = await request(app)
          .get(`/api/v8/assessment/${assessmentId}/report`)
          .set('Authorization', `Bearer ${tokenC}`);
        assert.equal(res.status, 404);
        assert.equal(res.body.code, 'NO_ACCEPTED_OUTPUT');
      }
    );
  } finally {
    try {
      await cleanup(client, createdAssessmentIds);
      console.log('[asm-005-007-negative-controls] cleanup OK (asm005007neg-- rows removed)');
    } finally {
      await client.end();
    }
  }

  console.log(`\n[asm-005-007-negative-controls] ${passCount} passed, ${failCount} failed`);
  if (failCount > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('[asm-005-007-negative-controls] FATAL', err);
  process.exitCode = 1;
});
