#!/usr/bin/env tsx
/**
 * ASM-008 acceptance — accepted-output -> canonical Candidate handoff,
 * REAL Postgres.
 *
 * Run:
 *   node tests/acceptance/run.mjs                                        # full stack (docker pg + schema + seed + all *.e2e tests)
 *   DATABASE_URL=postgres://consultinity:consultinity@localhost:5442/consultinity \
 *     NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *     npx tsx tests/acceptance/asm-008-candidate-handoff.mjs                # standalone, against an already-running local pg
 *   (first apply the new migration to that pg if not already applied:
 *     DATABASE_URL=... node tests/acceptance/schema.mjs)
 *
 * Proves, against the REAL v8 assessment router + REAL auth middleware +
 * REAL Postgres (zero business-logic mocks), the ASM-08 golden flow
 * end-to-end for one org:
 *
 *   1) Full ASM-05/06/07 setup (create DRD assessment, fill all 39 areas,
 *      one evidence row per axis, accept) -> one APPROVED assessment with a
 *      current row in `assessment_accepted_snapshots`.
 *   2) GET /:assessmentId/candidate BEFORE any handoff -> 404
 *      NO_CANDIDATE_HANDOFF.
 *   3) POST /:assessmentId/candidate -> 201, created:true, capture
 *      candidate.id + handoff.id.
 *   4) A real row landed in `initiative_candidates` with
 *      source_type='assessment_accepted_output' (NOT the plain 'assessment'
 *      source_type the F2 auto-scan uses -> no dedup-key collision),
 *      source_id=<assessmentId>, status='pending'.
 *   5) POST again (retry-after-success) -> 200, created:false, SAME
 *      candidate.id. Exactly one row in initiative_candidates and exactly
 *      one row in assessment_candidate_handoffs for this assessment.
 *   6) GET /:assessmentId/candidate -> 200, matches the receipt, initiativeId
 *      null (nothing has promoted this candidate to an Initiative yet).
 *   7) Draft/returned output rejected: a second, separately-accepted
 *      assessment is reopened via POST /review {action:'return'} (status ->
 *      DRAFT, accepted snapshot NOT deleted) -> POST /candidate -> 409
 *      OUTPUT_NOT_ACCEPTED, details.assessmentStatus==='DRAFT',
 *      details.hasCurrentSnapshot===true. A third, never-accepted-at-all
 *      fresh DRAFT assessment -> 409 OUTPUT_NOT_ACCEPTED,
 *      details.hasCurrentSnapshot===false.
 *   8) Concurrency: a fourth freshly-accepted assessment gets TWO concurrent
 *      POST /candidate requests via Promise.all (real HTTP-level
 *      concurrency) -> the FOR UPDATE lock on `assessments` serializes them;
 *      both responses succeed, exactly one reports created:true, both report
 *      the SAME candidate.id, and exactly one row lands in each of
 *      initiative_candidates / assessment_candidate_handoffs.
 *   9) Retry-after-failure is safe: a fifth freshly-accepted assessment gets
 *      a fault injected at the 'receipt-inserted' stage (thrown AFTER the
 *      candidate insert, before the transaction's implicit COMMIT) -> the
 *      call fails, and BOTH the candidate insert and the receipt insert are
 *      rolled back (zero rows in either table). Clearing the injector and
 *      retrying the SAME call then succeeds cleanly (201, created:true,
 *      exactly one row each) -- no orphan/partial state blocks the retry.
 *
 * Writes ONLY to the LOCAL Postgres (guarded by harness.requireLocalDbUrl),
 * under the reversible `asm008--` id prefix, and cleans up its own rows in a
 * `finally` block regardless of pass/fail.
 */
import assert from 'node:assert/strict';

import bcrypt from 'bcryptjs';
import express from 'express';
import request from 'supertest';

import { assertAuthHermetic, mintToken, pgClient, requireLocalDbUrl } from './harness.js';

requireLocalDbUrl();

const PREFIX = 'asm008--';
const ORG_A = `${PREFIX}org-a`;
const USER_A = `${PREFIX}user-a`;
const HARNESS_PASSWORD = 'Asm008!Harness123';

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

async function seedOrgAndUser(client, orgId, userId, email) {
  const now = new Date().toISOString();
  const passwordHash = bcrypt.hashSync(HARNESS_PASSWORD, 10);

  await client.query(
    `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
     VALUES ($1, $2, 'enterprise', 'active', 1, $3)
     ON CONFLICT (id) DO NOTHING`,
    [orgId, `ASM-008 Harness ${orgId}`, now]
  );

  await client.query(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
     VALUES ($1, $2, $3, $4, 'OWNER', 'active', 'Asm008', 'Harness', $5)
     ON CONFLICT (id) DO NOTHING`,
    [userId, orgId, email, passwordHash, now]
  );

  await client.query(
    `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
     SELECT $5, $1, $2, $3, 'ACTIVE', $4
     WHERE NOT EXISTS (
       SELECT 1 FROM organization_members WHERE organization_id = $1 AND user_id = $2
     )`,
    [orgId, userId, 'OWNER', now, `${PREFIX}mem-${userId}`]
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
  await client.query(`DELETE FROM organization_members WHERE organization_id = $1`, [ORG_A]);
  await client.query(`DELETE FROM users WHERE id = $1`, [USER_A]);
  await client.query(`DELETE FROM organizations WHERE id = $1`, [ORG_A]);
}

/** Builds an answers.drd.areas map that reaches exactly 100% completion:
 * every area across every axis gets an achievedLevel/targetLevel, which is
 * the "answered" heuristic in drdCompletion.ts's isAreaAnswered. */
function buildFullDrdAreas(DRD_STRUCTURE) {
  const areas = {};
  for (const axis of DRD_STRUCTURE) {
    for (const area of axis.areas) {
      areas[area.id] = { achievedLevel: 3, targetLevel: 4 };
    }
  }
  return areas;
}

/** Creates a DRD assessment, fills all 39 areas to 100% completion, posts one
 * evidence row per axis, and accepts it -> returns {assessmentId, reviewId}
 * for an assessment that is APPROVED with a current accepted snapshot. */
async function setupApprovedAssessment(app, token, name, DRD_STRUCTURE) {
  const createRes = await request(app)
    .post('/api/v8/assessment')
    .set('Authorization', `Bearer ${token}`)
    .send({ assessmentType: 'DRD', name });
  assert.equal(createRes.status, 201, `create assessment "${name}" must succeed`);
  const assessmentId = createRes.body?.data?.id;
  assert.ok(assessmentId, `create assessment "${name}" must return an id`);

  const areas = buildFullDrdAreas(DRD_STRUCTURE);
  const putRes = await request(app)
    .put(`/api/v8/assessment/${assessmentId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ answers: { drd: { areas } } });
  assert.equal(putRes.status, 200, `PUT full areas for "${name}" must succeed`);
  assert.equal(putRes.body.data.completionPercent, 100);

  for (const axis of DRD_STRUCTURE) {
    const axisId = String(axis.id);
    const areaId = axis.areas[0].id;
    const evRes = await request(app)
      .post(`/api/v8/assessment/${assessmentId}/evidence`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        axisId,
        areaId,
        evidenceType: 'note',
        title: `Evidence for axis ${axisId}`,
      });
    assert.equal(evRes.status, 201, `evidence POST for axis ${axisId} ("${name}") must succeed`);
  }

  const acceptRes = await request(app)
    .post(`/api/v8/assessment/${assessmentId}/review`)
    .set('Authorization', `Bearer ${token}`)
    .send({ action: 'accept', rationale: `Accepting "${name}": complete and fully evidenced.` });
  assert.equal(acceptRes.status, 201, `accept for "${name}" must succeed`);
  assert.equal(acceptRes.body.data.review.newStatus, 'APPROVED');
  const reviewId = acceptRes.body.data.review.id;
  assert.ok(reviewId);

  return { assessmentId, reviewId };
}

async function main() {
  console.log('[asm-008-candidate-handoff] connecting to local Postgres...');
  const client = pgClient();
  await client.connect();

  const createdAssessmentIds = [];
  let app;

  try {
    await seedOrgAndUser(client, ORG_A, USER_A, 'asm008-a@acceptance.local');

    const { verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
    const { attachV8Context } = await import('../../server/src/middleware/v8Auth.middleware.js');
    const assessmentRouter = (await import('../../server/src/routes/v8/assessment.routes.js'))
      .default;
    const { setCandidateHandoffFaultInjectorForTests } = await import(
      '../../server/src/services/assessment/drdCandidateHandoff.js'
    );
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

    // -----------------------------------------------------------------
    // Scenario 1: setup — full ASM-05/06/07 flow -> APPROVED assessment.
    // -----------------------------------------------------------------
    let assessmentId;
    await step('setup: full ASM-05/06/07 flow -> APPROVED assessment with current snapshot', async () => {
      const { assessmentId: id } = await setupApprovedAssessment(
        app,
        tokenA,
        'ASM-008 golden flow',
        DRD_STRUCTURE
      );
      assessmentId = id;
      createdAssessmentIds.push(assessmentId);
    });

    // -----------------------------------------------------------------
    // Scenario 2: GET /candidate before any handoff -> 404.
    // -----------------------------------------------------------------
    await step('GET /candidate before any handoff -> 404 NO_CANDIDATE_HANDOFF', async () => {
      const res = await request(app)
        .get(`/api/v8/assessment/${assessmentId}/candidate`)
        .set('Authorization', `Bearer ${tokenA}`);
      assert.equal(res.status, 404);
      assert.equal(res.body.code, 'NO_CANDIDATE_HANDOFF');
    });

    // -----------------------------------------------------------------
    // Scenario 3: POST /candidate -> 201, created:true.
    // -----------------------------------------------------------------
    let candidateId;
    let handoffId;
    await step('POST /candidate -> 201, created:true, candidate + handoff captured', async () => {
      const res = await request(app)
        .post(`/api/v8/assessment/${assessmentId}/candidate`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({});
      assert.equal(res.status, 201);
      assert.equal(res.body.data.created, true);
      assert.ok(res.body.data.candidate?.id);
      assert.ok(res.body.data.handoff?.id);
      assert.equal(res.body.data.candidate.status, 'pending');
      candidateId = res.body.data.candidate.id;
      handoffId = res.body.data.handoff.id;
    });

    // -----------------------------------------------------------------
    // Scenario 4: verify a real row landed in initiative_candidates with
    // the distinct source_type (no F2 auto-scan collision).
    // -----------------------------------------------------------------
    await step(
      'DB: initiative_candidates row exists with source_type=assessment_accepted_output (NOT plain "assessment"), status=pending',
      async () => {
        const { rows } = await client.query(
          `SELECT id, organization_id, source_type, source_id, status
           FROM initiative_candidates WHERE id = $1`,
          [candidateId]
        );
        assert.equal(rows.length, 1);
        const row = rows[0];
        assert.equal(row.organization_id, ORG_A);
        assert.equal(row.source_type, 'assessment_accepted_output');
        assert.notEqual(
          row.source_type,
          'assessment',
          'must NOT reuse the plain "assessment" source_type F2 auto-scan writes (dedup-key collision)'
        );
        assert.equal(row.source_id, assessmentId);
        assert.equal(row.status, 'pending');
      }
    );

    // -----------------------------------------------------------------
    // Scenario 5: retry-after-success -> 200, created:false, SAME id.
    // -----------------------------------------------------------------
    await step(
      'POST /candidate again (retry) -> 200, created:false, SAME candidate.id; no duplicates',
      async () => {
        const res = await request(app)
          .post(`/api/v8/assessment/${assessmentId}/candidate`)
          .set('Authorization', `Bearer ${tokenA}`)
          .send({});
        assert.equal(res.status, 200);
        assert.equal(res.body.data.created, false);
        assert.equal(res.body.data.candidate.id, candidateId);
        assert.equal(res.body.data.handoff.id, handoffId);

        const candidateRows = await client.query(
          `SELECT id FROM initiative_candidates
           WHERE organization_id = $1 AND source_type = 'assessment_accepted_output' AND source_id = $2`,
          [ORG_A, assessmentId]
        );
        assert.equal(candidateRows.rowCount, 1, 'exactly ONE initiative_candidates row for this assessment');

        const handoffRows = await client.query(
          `SELECT id FROM assessment_candidate_handoffs WHERE organization_id = $1 AND assessment_id = $2`,
          [ORG_A, assessmentId]
        );
        assert.equal(handoffRows.rowCount, 1, 'exactly ONE handoff row for this assessment');
      }
    );

    // -----------------------------------------------------------------
    // Scenario 6: GET /candidate -> matches receipt, initiativeId null.
    // -----------------------------------------------------------------
    await step(
      'GET /candidate -> 200, matches receipt from step 3/5, initiativeId null',
      async () => {
        const res = await request(app)
          .get(`/api/v8/assessment/${assessmentId}/candidate`)
          .set('Authorization', `Bearer ${tokenA}`);
        assert.equal(res.status, 200);
        assert.equal(res.body.data.id, handoffId);
        assert.equal(res.body.data.candidateId, candidateId);
        assert.equal(res.body.data.assessmentId, assessmentId);
        assert.equal(res.body.data.organizationId, ORG_A);
        assert.equal(res.body.data.sourceType, 'assessment_accepted_output');
        assert.equal(res.body.data.createdBy, USER_A);
        assert.ok(res.body.data.createdAt);
        assert.equal(res.body.data.initiativeId, null);
      }
    );

    // -----------------------------------------------------------------
    // Scenario 7a: draft/returned output rejected (accepted, then returned).
    // -----------------------------------------------------------------
    await step(
      'returned output: accept then return -> POST /candidate -> 409 OUTPUT_NOT_ACCEPTED, assessmentStatus DRAFT, hasCurrentSnapshot true',
      async () => {
        const { assessmentId: returnedId } = await setupApprovedAssessment(
          app,
          tokenA,
          'ASM-008 returned-output',
          DRD_STRUCTURE
        );
        createdAssessmentIds.push(returnedId);

        const returnRes = await request(app)
          .post(`/api/v8/assessment/${returnedId}/review`)
          .set('Authorization', `Bearer ${tokenA}`)
          .send({ action: 'return', rationale: 'Please re-check axis evidence quality.' });
        assert.equal(returnRes.status, 200);
        assert.equal(returnRes.body.data.review.newStatus, 'DRAFT');

        const res = await request(app)
          .post(`/api/v8/assessment/${returnedId}/candidate`)
          .set('Authorization', `Bearer ${tokenA}`)
          .send({});
        assert.equal(res.status, 409);
        assert.equal(res.body.code, 'OUTPUT_NOT_ACCEPTED');
        assert.equal(res.body.details?.assessmentStatus, 'DRAFT');
        assert.equal(res.body.details?.hasCurrentSnapshot, true);

        const rows = await client.query(
          `SELECT id FROM assessment_candidate_handoffs WHERE assessment_id = $1`,
          [returnedId]
        );
        assert.equal(rows.rowCount, 0, 'no handoff must be created for a rejected returned-output attempt');
      }
    );

    // -----------------------------------------------------------------
    // Scenario 7b: never-accepted-at-all fresh DRAFT assessment.
    // -----------------------------------------------------------------
    await step(
      'never-accepted: fresh DRAFT assessment -> POST /candidate -> 409 OUTPUT_NOT_ACCEPTED, hasCurrentSnapshot false',
      async () => {
        const createRes = await request(app)
          .post('/api/v8/assessment')
          .set('Authorization', `Bearer ${tokenA}`)
          .send({ assessmentType: 'DRD', name: 'ASM-008 never-accepted' });
        assert.equal(createRes.status, 201);
        const freshId = createRes.body?.data?.id;
        assert.ok(freshId);
        createdAssessmentIds.push(freshId);

        const res = await request(app)
          .post(`/api/v8/assessment/${freshId}/candidate`)
          .set('Authorization', `Bearer ${tokenA}`)
          .send({});
        assert.equal(res.status, 409);
        assert.equal(res.body.code, 'OUTPUT_NOT_ACCEPTED');
        assert.equal(res.body.details?.assessmentStatus, 'DRAFT');
        assert.equal(res.body.details?.hasCurrentSnapshot, false);
      }
    );

    // -----------------------------------------------------------------
    // Scenario 8: concurrency, no duplicate.
    // -----------------------------------------------------------------
    await step(
      'concurrency: two concurrent POST /candidate for the same freshly-accepted assessment serialize to one candidate',
      async () => {
        const { assessmentId: concurrentId } = await setupApprovedAssessment(
          app,
          tokenA,
          'ASM-008 concurrency',
          DRD_STRUCTURE
        );
        createdAssessmentIds.push(concurrentId);

        const post = () =>
          request(app)
            .post(`/api/v8/assessment/${concurrentId}/candidate`)
            .set('Authorization', `Bearer ${tokenA}`)
            .send({});
        const [resA, resB] = await Promise.all([post(), post()]);

        for (const res of [resA, resB]) {
          assert.ok(
            [200, 201].includes(res.status),
            `both concurrent calls must succeed, got ${res.status}: ${JSON.stringify(res.body)}`
          );
        }

        const createdFlags = [resA.body.data.created, resB.body.data.created];
        assert.equal(
          createdFlags.filter(Boolean).length,
          1,
          'exactly ONE of the two concurrent calls must report created:true'
        );
        assert.equal(
          resA.body.data.candidate.id,
          resB.body.data.candidate.id,
          'both concurrent calls must report the SAME candidate.id'
        );

        const candidateRows = await client.query(
          `SELECT id FROM initiative_candidates
           WHERE organization_id = $1 AND source_type = 'assessment_accepted_output' AND source_id = $2`,
          [ORG_A, concurrentId]
        );
        assert.equal(candidateRows.rowCount, 1, 'exactly ONE initiative_candidates row after concurrency');

        const handoffRows = await client.query(
          `SELECT id FROM assessment_candidate_handoffs WHERE organization_id = $1 AND assessment_id = $2`,
          [ORG_A, concurrentId]
        );
        assert.equal(handoffRows.rowCount, 1, 'exactly ONE handoff row after concurrency');
      }
    );

    // -----------------------------------------------------------------
    // Scenario 9: retry-after-failure is safe (atomic rollback).
    // -----------------------------------------------------------------
    await step(
      'retry-after-failure: fault at receipt-inserted rolls back atomically, then a clean retry succeeds',
      async () => {
        const { assessmentId: faultId } = await setupApprovedAssessment(
          app,
          tokenA,
          'ASM-008 fault-injection',
          DRD_STRUCTURE
        );
        createdAssessmentIds.push(faultId);

        setCandidateHandoffFaultInjectorForTests((stage) => {
          if (stage === 'receipt-inserted') throw new Error('ASM008_FAULT_AFTER_RECEIPT_INSERT');
        });

        let failedRes;
        try {
          failedRes = await request(app)
            .post(`/api/v8/assessment/${faultId}/candidate`)
            .set('Authorization', `Bearer ${tokenA}`)
            .send({});
        } finally {
          setCandidateHandoffFaultInjectorForTests(null);
        }

        assert.ok(
          failedRes.status >= 500,
          `fault-injected call must fail (5xx), got ${failedRes.status}: ${JSON.stringify(failedRes.body)}`
        );

        const candidateRowsAfterFault = await client.query(
          `SELECT id FROM initiative_candidates
           WHERE organization_id = $1 AND source_type = 'assessment_accepted_output' AND source_id = $2`,
          [ORG_A, faultId]
        );
        assert.equal(
          candidateRowsAfterFault.rowCount,
          0,
          'ZERO initiative_candidates rows after a rolled-back fault injection (no orphan candidate)'
        );

        const handoffRowsAfterFault = await client.query(
          `SELECT id FROM assessment_candidate_handoffs WHERE organization_id = $1 AND assessment_id = $2`,
          [ORG_A, faultId]
        );
        assert.equal(
          handoffRowsAfterFault.rowCount,
          0,
          'ZERO assessment_candidate_handoffs rows after a rolled-back fault injection'
        );

        // Retry the SAME call, this time cleanly.
        const retryRes = await request(app)
          .post(`/api/v8/assessment/${faultId}/candidate`)
          .set('Authorization', `Bearer ${tokenA}`)
          .send({});
        assert.equal(retryRes.status, 201);
        assert.equal(retryRes.body.data.created, true);

        const candidateRowsAfterRetry = await client.query(
          `SELECT id FROM initiative_candidates
           WHERE organization_id = $1 AND source_type = 'assessment_accepted_output' AND source_id = $2`,
          [ORG_A, faultId]
        );
        assert.equal(candidateRowsAfterRetry.rowCount, 1, 'exactly ONE row after the clean retry');

        const handoffRowsAfterRetry = await client.query(
          `SELECT id FROM assessment_candidate_handoffs WHERE organization_id = $1 AND assessment_id = $2`,
          [ORG_A, faultId]
        );
        assert.equal(handoffRowsAfterRetry.rowCount, 1, 'exactly ONE handoff row after the clean retry');
      }
    );
  } finally {
    try {
      await cleanup(client, createdAssessmentIds);
      console.log('[asm-008-candidate-handoff] cleanup OK (asm008-- rows removed)');
    } finally {
      await client.end();
    }
  }

  console.log(`\n[asm-008-candidate-handoff] ${passCount} passed, ${failCount} failed`);
  if (failCount > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('[asm-008-candidate-handoff] FATAL', err);
  process.exitCode = 1;
});
