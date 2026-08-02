#!/usr/bin/env tsx
/**
 * ASM-008 negative controls — tenant + role isolation, REAL Postgres.
 * Mirrors the structure of tests/acceptance/asm-005-007-negative-controls.mjs.
 *
 * Run:
 *   node tests/acceptance/run.mjs
 *   DATABASE_URL=postgres://consultinity:consultinity@localhost:5442/consultinity \
 *     NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *     npx tsx tests/acceptance/asm-008-negative-controls.mjs
 *
 * Covers:
 *   - Setup: org A creates + fully accepts a DRD assessment (ASM-05/06/07
 *     flow -> APPROVED with a current snapshot) and calls
 *     POST /:assessmentId/candidate once successfully, so there is a real
 *     handoff + candidate to probe against.
 *   - Cross-org: org B's token against org A's assessment id -> both
 *     POST /:assessmentId/candidate and GET /:assessmentId/candidate -> 404
 *     ASSESSMENT_NOT_FOUND, never 403 (a foreign-org caller must not be able
 *     to distinguish "doesn't exist" from "exists but not yours"). Verifies
 *     the rejected cross-org POST created no new row in initiative_candidates
 *     or assessment_candidate_handoffs.
 *   - Role: a same-org, non-owner user with only default-viewer permission
 *     (canView=true, canEdit=false, canApprove=false; 'MEMBER' org role, no
 *     explicit assessment_roles row) -> POST /:assessmentId/candidate -> 403
 *     P28_PERMISSION_DENIED (same ensureWorkbenchPermission('canApprove')
 *     gate as accept/return), and writes nothing. GET /:assessmentId/candidate
 *     as that same viewer -> 200 (canView=true is enough to read — proves the
 *     403 above is permission-specific, not a blanket lockout).
 *
 * Writes ONLY to the LOCAL Postgres (guarded by harness.requireLocalDbUrl),
 * under the reversible `asm008neg--` id prefix, cleaned up in `finally`.
 */
import assert from 'node:assert/strict';

import bcrypt from 'bcryptjs';
import express from 'express';
import request from 'supertest';

import { assertAuthHermetic, mintToken, pgClient, requireLocalDbUrl } from './harness.js';

requireLocalDbUrl();

const PREFIX = 'asm008neg--';
const ORG_A = `${PREFIX}org-a`;
const ORG_B = `${PREFIX}org-b`;
const USER_A = `${PREFIX}user-owner-a`;
// Same-org, NOT the assessment creator, NO explicit assessment_roles row ->
// AssessmentPermissionService.getUserRole defaults to 'viewer'
// (canView=true, canEdit=false, canApprove=false). 'MEMBER' is a legal
// organization_members.role and is NOT one of the isGlobalAdminRole buckets
// (ADMIN/ADMINISTRATOR/OWNER/SUPERADMIN/SUPER_ADMIN), so it exercises the
// real per-assessment permission lookup rather than the admin-bypass
// short-circuit.
const USER_C = `${PREFIX}user-member-a`;
const USER_B = `${PREFIX}user-owner-b`;
const HARNESS_PASSWORD = 'Asm008Neg!Harness123';

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
    [orgId, `ASM-008 Neg Harness ${orgId}`, now]
  );

  await client.query(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
     VALUES ($1, $2, $3, $4, $5, 'active', 'Asm008Neg', 'Harness', $6)
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
    await client.query(
      `DELETE FROM assessment_candidate_handoffs WHERE assessment_id = ANY($1)`,
      [createdAssessmentIds]
    );
    await client.query(
      `DELETE FROM initiative_candidates
       WHERE source_type = 'assessment_accepted_output' AND source_id = ANY($1)`,
      [createdAssessmentIds]
    );
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

/** Builds an answers.drd.areas map that reaches exactly 100% completion. */
function buildFullDrdAreas(DRD_STRUCTURE) {
  const areas = {};
  for (const axis of DRD_STRUCTURE) {
    for (const area of axis.areas) {
      areas[area.id] = { achievedLevel: 3, targetLevel: 4 };
    }
  }
  return areas;
}

async function main() {
  console.log('[asm-008-negative-controls] connecting to local Postgres...');
  const client = pgClient();
  await client.connect();

  const createdAssessmentIds = [];
  let app;

  try {
    await seedOrgAndUser(client, ORG_A, USER_A, 'asm008neg-owner-a@acceptance.local', 'OWNER');
    await seedOrgAndUser(client, ORG_A, USER_C, 'asm008neg-member-a@acceptance.local', 'MEMBER');
    await seedOrgAndUser(client, ORG_B, USER_B, 'asm008neg-owner-b@acceptance.local', 'OWNER');

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

    // -----------------------------------------------------------------
    // Setup: org A creates + fully accepts a DRD assessment, then hands it
    // off to a candidate once successfully.
    // -----------------------------------------------------------------
    let assessmentId;
    let candidateId;
    await step(
      'setup: org A creates + fully accepts a DRD assessment, then a successful POST /candidate',
      async () => {
        const createRes = await request(app)
          .post('/api/v8/assessment')
          .set('Authorization', `Bearer ${tokenA}`)
          .send({ assessmentType: 'DRD', name: 'ASM-008 neg-controls base' });
        assert.equal(createRes.status, 201);
        assessmentId = createRes.body?.data?.id;
        assert.ok(assessmentId);
        createdAssessmentIds.push(assessmentId);

        const areas = buildFullDrdAreas(DRD_STRUCTURE);
        const putRes = await request(app)
          .put(`/api/v8/assessment/${assessmentId}`)
          .set('Authorization', `Bearer ${tokenA}`)
          .send({ answers: { drd: { areas } } });
        assert.equal(putRes.status, 200);
        assert.equal(putRes.body.data.completionPercent, 100);

        for (const axis of DRD_STRUCTURE) {
          const axisId = String(axis.id);
          const areaId = axis.areas[0].id;
          const evRes = await request(app)
            .post(`/api/v8/assessment/${assessmentId}/evidence`)
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ axisId, areaId, evidenceType: 'note', title: `Evidence for axis ${axisId}` });
          assert.equal(evRes.status, 201);
        }

        const acceptRes = await request(app)
          .post(`/api/v8/assessment/${assessmentId}/review`)
          .set('Authorization', `Bearer ${tokenA}`)
          .send({ action: 'accept', rationale: 'Accepting: complete and fully evidenced.' });
        assert.equal(acceptRes.status, 201);
        assert.equal(acceptRes.body.data.review.newStatus, 'APPROVED');

        const handoffRes = await request(app)
          .post(`/api/v8/assessment/${assessmentId}/candidate`)
          .set('Authorization', `Bearer ${tokenA}`)
          .send({});
        assert.equal(handoffRes.status, 201);
        assert.equal(handoffRes.body.data.created, true);
        candidateId = handoffRes.body.data.candidate.id;
        assert.ok(candidateId);
      }
    );

    // -----------------------------------------------------------------
    // Cross-org: org B token + org A assessment id -> 404 on both
    // endpoints, never 403.
    // -----------------------------------------------------------------
    await step(
      'cross-org: POST /candidate with org B token + org A assessment id -> 404 ASSESSMENT_NOT_FOUND',
      async () => {
        const res = await request(app)
          .post(`/api/v8/assessment/${assessmentId}/candidate`)
          .set('Authorization', `Bearer ${tokenB}`)
          .send({});
        assert.equal(res.status, 404);
        assert.equal(res.body.code, 'ASSESSMENT_NOT_FOUND');
        assert.notEqual(res.status, 403);
      }
    );

    await step(
      'cross-org: GET /candidate with org B token + org A assessment id -> 404 ASSESSMENT_NOT_FOUND',
      async () => {
        const res = await request(app)
          .get(`/api/v8/assessment/${assessmentId}/candidate`)
          .set('Authorization', `Bearer ${tokenB}`);
        assert.equal(res.status, 404);
        assert.equal(res.body.code, 'ASSESSMENT_NOT_FOUND');
        assert.notEqual(res.status, 403);
      }
    );

    await step(
      'verify: the rejected cross-org POST /candidate created no new row anywhere for org B',
      async () => {
        const candidateRows = await client.query(
          `SELECT id FROM initiative_candidates
           WHERE organization_id = $1 AND source_type = 'assessment_accepted_output' AND source_id = $2`,
          [ORG_A, assessmentId]
        );
        assert.equal(candidateRows.rowCount, 1, 'still exactly the ONE legitimate org A candidate row');
        assert.equal(candidateRows.rows[0].id, candidateId);

        const orgBCandidateRows = await client.query(
          `SELECT id FROM initiative_candidates WHERE organization_id = $1`,
          [ORG_B]
        );
        assert.equal(orgBCandidateRows.rowCount, 0, 'no initiative_candidates row for org B');

        const handoffRows = await client.query(
          `SELECT id, organization_id FROM assessment_candidate_handoffs WHERE assessment_id = $1`,
          [assessmentId]
        );
        assert.equal(handoffRows.rowCount, 1, 'still exactly the ONE legitimate org A handoff row');
        assert.equal(handoffRows.rows[0].organization_id, ORG_A);
      }
    );

    // -----------------------------------------------------------------
    // Role: same-org, default-viewer user (canView=true, canEdit=false,
    // canApprove=false) -> 403 on POST, 200 on GET.
    // -----------------------------------------------------------------
    await step(
      'role: POST /candidate as default-viewer (no canApprove) -> 403 P28_PERMISSION_DENIED',
      async () => {
        const res = await request(app)
          .post(`/api/v8/assessment/${assessmentId}/candidate`)
          .set('Authorization', `Bearer ${tokenC}`)
          .send({});
        assert.equal(res.status, 403);
        assert.equal(res.body.code, 'P28_PERMISSION_DENIED');

        const candidateRows = await client.query(
          `SELECT id FROM initiative_candidates
           WHERE organization_id = $1 AND source_type = 'assessment_accepted_output' AND source_id = $2`,
          [ORG_A, assessmentId]
        );
        assert.equal(candidateRows.rowCount, 1, 'still exactly the ONE legitimate candidate row (no new row from the 403-denied POST)');

        const handoffRows = await client.query(
          `SELECT id FROM assessment_candidate_handoffs WHERE assessment_id = $1`,
          [assessmentId]
        );
        assert.equal(handoffRows.rowCount, 1, 'still exactly the ONE legitimate handoff row');
      }
    );

    await step(
      'role: GET /candidate as default-viewer (canView=true) still succeeds -> 200 (proves the 403 above is permission-specific, not a blanket lockout)',
      async () => {
        const res = await request(app)
          .get(`/api/v8/assessment/${assessmentId}/candidate`)
          .set('Authorization', `Bearer ${tokenC}`);
        assert.equal(res.status, 200);
        assert.equal(res.body.data.candidateId, candidateId);
        assert.equal(res.body.data.assessmentId, assessmentId);
      }
    );
  } finally {
    try {
      await cleanup(client, createdAssessmentIds);
      console.log('[asm-008-negative-controls] cleanup OK (asm008neg-- rows removed)');
    } finally {
      await client.end();
    }
  }

  console.log(`\n[asm-008-negative-controls] ${passCount} passed, ${failCount} failed`);
  if (failCount > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('[asm-008-negative-controls] FATAL', err);
  process.exitCode = 1;
});
