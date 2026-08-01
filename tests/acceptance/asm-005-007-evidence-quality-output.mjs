#!/usr/bin/env tsx
/**
 * ASM-005/006/007 acceptance — golden flow, REAL Postgres.
 *
 * Run:
 *   node tests/acceptance/run.mjs                                        # full stack (docker pg + schema + seed + all *.e2e tests)
 *   DATABASE_URL=postgres://consultinity:consultinity@localhost:5442/consultinity \
 *     NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *     npx tsx tests/acceptance/asm-005-007-evidence-quality-output.mjs      # standalone, against an already-running local pg
 *   (first apply the new migration to that pg if not already applied:
 *     DATABASE_URL=... node tests/acceptance/schema.mjs)
 *
 * Proves, against the REAL v8 assessment router + REAL auth middleware +
 * REAL Postgres (zero business-logic mocks), the ASM-005/006/007 golden
 * flow end-to-end for one org / one DRD assessment:
 *
 *   1) Evidence + quality-review negative gates BEFORE the assessment is
 *      ready: REVIEW_RATIONALE_REQUIRED (both actions), ASSESSMENT_INCOMPLETE
 *      (accept attempted below 100% completion).
 *   2) PUT answers.drd.areas until computeDrdCompletion reads 100% (all 39
 *      DRD_STRUCTURE areas across the 7 axes).
 *   3) accept attempted with 100% completion but ZERO evidence -> 409
 *      MISSING_EVIDENCE, axesMissingEvidence lists all 7 axes.
 *   4) One evidence row per axis (7 POSTs) -> GET /evidence shows
 *      axesMissingEvidence empty, evidenceCoverage 100.
 *   5) accept succeeds (201), assessment flips to APPROVED, response
 *      includes a snapshot.
 *   6) GET /report returns the accepted snapshot — isCurrent true,
 *      provenance.reviewId matches the review just created.
 *   7) A draft PUT edit AFTER acceptance does NOT change what /report
 *      returns — the accepted snapshot is immutable (byte-identical
 *      before/after the edit).
 *   8) return reopens the assessment (status -> DRAFT) but does NOT touch
 *      the accepted snapshot — /report still returns the exact same
 *      snapshot from step 6/7 (the "reopen/report returns the same output"
 *      requirement).
 *   9) GET /review-history shows exactly 2 rows (accept then return, newest
 *      first per the service's ORDER BY created_at DESC), each with
 *      actor/timestamp/rationale populated.
 *
 * Writes ONLY to the LOCAL Postgres (guarded by harness.requireLocalDbUrl),
 * under the reversible `asm005007--` id prefix, and cleans up its own rows
 * in a `finally` block regardless of pass/fail.
 */
import assert from 'node:assert/strict';

import bcrypt from 'bcryptjs';
import express from 'express';
import request from 'supertest';

import { assertAuthHermetic, mintToken, pgClient, requireLocalDbUrl } from './harness.js';

requireLocalDbUrl();

const PREFIX = 'asm005007--';
const ORG_A = `${PREFIX}org-a`;
const USER_A = `${PREFIX}user-a`;
const HARNESS_PASSWORD = 'Asm005007!Harness123';

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
    [orgId, `ASM-005/007 Harness ${orgId}`, now]
  );

  await client.query(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
     VALUES ($1, $2, $3, $4, 'OWNER', 'active', 'Asm005007', 'Harness', $5)
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

async function main() {
  console.log('[asm-005-007-evidence-quality-output] connecting to local Postgres...');
  const client = pgClient();
  await client.connect();

  const createdAssessmentIds = [];
  let app;

  try {
    await seedOrgAndUser(client, ORG_A, USER_A, 'asm005007-a@acceptance.local');

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

    const allAxisIds = DRD_STRUCTURE.map((axis) => String(axis.id)).sort();
    assert.equal(allAxisIds.length, 7, 'sanity: DRD_STRUCTURE must have 7 axes');
    const totalAreaCount = DRD_STRUCTURE.reduce((acc, axis) => acc + axis.areas.length, 0);
    assert.equal(totalAreaCount, 39, 'sanity: DRD_STRUCTURE must have 39 areas total');

    let assessmentId;

    await step('setup: create a DRD assessment in org A', async () => {
      const res = await request(app)
        .post('/api/v8/assessment')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ assessmentType: 'DRD', name: 'ASM-005/007 golden flow' });
      assert.equal(res.status, 201);
      assessmentId = res.body?.data?.id;
      assert.ok(assessmentId);
      createdAssessmentIds.push(assessmentId);
    });

    // ---------------------------------------------------------------------
    // Negative gates BEFORE the assessment is ready.
    // ---------------------------------------------------------------------
    await step(
      'REVIEW_RATIONALE_REQUIRED: POST /review accept with empty rationale -> 400',
      async () => {
        const res = await request(app)
          .post(`/api/v8/assessment/${assessmentId}/review`)
          .set('Authorization', `Bearer ${tokenA}`)
          .send({ action: 'accept', rationale: '' });
        assert.equal(res.status, 400);
        assert.equal(res.body.code, 'REVIEW_RATIONALE_REQUIRED');
      }
    );

    await step(
      'REVIEW_RATIONALE_REQUIRED: POST /review return with a too-short (trimmed) rationale -> 400',
      async () => {
        const res = await request(app)
          .post(`/api/v8/assessment/${assessmentId}/review`)
          .set('Authorization', `Bearer ${tokenA}`)
          .send({ action: 'return', rationale: '  ab  ' });
        assert.equal(res.status, 400);
        assert.equal(res.body.code, 'REVIEW_RATIONALE_REQUIRED');
      }
    );

    await step(
      'ASSESSMENT_INCOMPLETE: accept attempted on a fresh (0%) assessment -> 409, details.completionPercent === 0',
      async () => {
        const res = await request(app)
          .post(`/api/v8/assessment/${assessmentId}/review`)
          .set('Authorization', `Bearer ${tokenA}`)
          .send({ action: 'accept', rationale: 'attempting accept far too early' });
        assert.equal(res.status, 409);
        assert.equal(res.body.code, 'ASSESSMENT_INCOMPLETE');
        assert.equal(res.body.details?.completionPercent, 0);
      }
    );

    // ---------------------------------------------------------------------
    // Step 1: reach 100% completion.
    // ---------------------------------------------------------------------
    await step('PUT answers.drd.areas for all 39 areas -> completionPercent 100', async () => {
      const areas = buildFullDrdAreas(DRD_STRUCTURE);
      const res = await request(app)
        .put(`/api/v8/assessment/${assessmentId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ answers: { drd: { areas } } });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.completionPercent, 100);
    });

    // ---------------------------------------------------------------------
    // Step 2: accept before any evidence -> MISSING_EVIDENCE, all 7 axes.
    // ---------------------------------------------------------------------
    await step(
      'MISSING_EVIDENCE: accept at 100% completion but zero evidence -> 409, all 7 axes listed',
      async () => {
        const res = await request(app)
          .post(`/api/v8/assessment/${assessmentId}/review`)
          .set('Authorization', `Bearer ${tokenA}`)
          .send({ action: 'accept', rationale: 'attempting accept with no evidence yet' });
        assert.equal(res.status, 409);
        assert.equal(res.body.code, 'MISSING_EVIDENCE');
        assert.deepEqual(
          [...res.body.details.axesMissingEvidence].sort(),
          allAxisIds,
          'every one of the 7 axes must be listed as missing evidence'
        );
      }
    );

    // ---------------------------------------------------------------------
    // Step 3: one evidence row per axis (7 POSTs).
    // ---------------------------------------------------------------------
    await step('POST /evidence once per axis (7 calls)', async () => {
      for (const axis of DRD_STRUCTURE) {
        const axisId = String(axis.id);
        const areaId = axis.areas[0].id;
        const res = await request(app)
          .post(`/api/v8/assessment/${assessmentId}/evidence`)
          .set('Authorization', `Bearer ${tokenA}`)
          .send({
            axisId,
            areaId,
            evidenceType: 'note',
            title: `Evidence for axis ${axisId}`,
            description: `Supporting note for axis ${axisId} / area ${areaId}`,
          });
        assert.equal(res.status, 201, `evidence POST for axis ${axisId} must succeed`);
        assert.equal(res.body.data.evidence.axisId, axisId);
        assert.equal(res.body.data.evidence.areaId, areaId);
      }
    });

    // ---------------------------------------------------------------------
    // Step 4: GET /evidence -> full coverage.
    // ---------------------------------------------------------------------
    await step(
      'GET /evidence -> scoring.axesMissingEvidence empty, evidenceCoverage 100',
      async () => {
        const res = await request(app)
          .get(`/api/v8/assessment/${assessmentId}/evidence`)
          .set('Authorization', `Bearer ${tokenA}`);
        assert.equal(res.status, 200);
        assert.equal(res.body.data.evidence.length, 7);
        assert.deepEqual(res.body.data.scoring.axesMissingEvidence, []);
        assert.equal(res.body.data.scoring.evidenceCoverage, 100);
        assert.equal(res.body.data.scoring.completionPercent, 100);
      }
    );

    // ---------------------------------------------------------------------
    // Step 5: accept succeeds.
    // ---------------------------------------------------------------------
    let acceptReviewId;
    await step('POST /review accept -> 201, status APPROVED, response includes a snapshot', async () => {
      const res = await request(app)
        .post(`/api/v8/assessment/${assessmentId}/review`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ action: 'accept', rationale: 'Accepting: complete and fully evidenced.' });
      assert.equal(res.status, 201);
      assert.equal(res.body.data.review.action, 'accept');
      assert.equal(res.body.data.review.newStatus, 'APPROVED');
      assert.ok(res.body.data.snapshot, 'expected a snapshot in the accept response');
      assert.equal(res.body.data.snapshot.isCurrent, true);
      acceptReviewId = res.body.data.review.id;
      assert.ok(acceptReviewId);

      const getRes = await request(app)
        .get(`/api/v8/assessment/${assessmentId}`)
        .set('Authorization', `Bearer ${tokenA}`);
      assert.equal(getRes.status, 200);
      assert.equal(getRes.body.data.assessment.backendStatus, 'APPROVED');
      assert.equal(getRes.body.data.assessment.status, 'APPROVED');
    });

    // ---------------------------------------------------------------------
    // Step 6: GET /report -> the accepted snapshot.
    // ---------------------------------------------------------------------
    let reportAfterAccept;
    await step(
      'GET /report -> isCurrent true, snapshot/provenance present, provenance.reviewId matches',
      async () => {
        const res = await request(app)
          .get(`/api/v8/assessment/${assessmentId}/report`)
          .set('Authorization', `Bearer ${tokenA}`);
        assert.equal(res.status, 200);
        assert.equal(res.body.data.isCurrent, true);
        assert.ok(res.body.data.snapshot);
        assert.ok(res.body.data.provenance);
        assert.equal(res.body.data.provenance.reviewId, acceptReviewId);
        reportAfterAccept = res.body.data;
      }
    );

    // ---------------------------------------------------------------------
    // Step 7: a draft edit AFTER acceptance must NOT change /report.
    // ---------------------------------------------------------------------
    await step(
      'PUT after acceptance (simulated draft edit) -> GET /report is byte-identical to step 6 (immutability)',
      async () => {
        const editedAreas = buildFullDrdAreas(DRD_STRUCTURE);
        const firstAreaId = DRD_STRUCTURE[0].areas[0].id;
        editedAreas[firstAreaId] = { achievedLevel: 7, targetLevel: 7 };

        const putRes = await request(app)
          .put(`/api/v8/assessment/${assessmentId}`)
          .set('Authorization', `Bearer ${tokenA}`)
          .send({ answers: { drd: { areas: editedAreas } } });
        assert.equal(putRes.status, 200);

        // Confirm the draft edit actually landed on the live row (otherwise
        // "the report didn't change" would be a tautology).
        const getRes = await request(app)
          .get(`/api/v8/assessment/${assessmentId}`)
          .set('Authorization', `Bearer ${tokenA}`);
        assert.equal(
          getRes.body.data.assessment.answers.drd.areas[firstAreaId].achievedLevel,
          7,
          'sanity: the post-accept draft edit must actually be persisted on the live row'
        );

        const reportRes = await request(app)
          .get(`/api/v8/assessment/${assessmentId}/report`)
          .set('Authorization', `Bearer ${tokenA}`);
        assert.equal(reportRes.status, 200);
        assert.deepEqual(
          reportRes.body.data.snapshot,
          reportAfterAccept.snapshot,
          'accepted snapshot must be BYTE-IDENTICAL to the one captured at accept time — a later draft edit must never leak into it'
        );
        assert.deepEqual(
          reportRes.body.data.provenance,
          reportAfterAccept.provenance,
          'provenance must also stay byte-identical'
        );
        assert.equal(reportRes.body.data.isCurrent, true);

        // Extra-explicit: the snapshot's own embedded answers must still
        // carry the ORIGINAL achievedLevel (3), never the post-accept edit (7).
        assert.equal(
          reportRes.body.data.snapshot.answers.drd.areas[firstAreaId].achievedLevel,
          3,
          'the snapshot payload itself must retain the pre-edit achievedLevel'
        );
      }
    );

    // ---------------------------------------------------------------------
    // Step 8: return reopens the draft but does not touch the snapshot.
    // ---------------------------------------------------------------------
    let returnReviewId;
    await step('POST /review return -> 200, status DRAFT', async () => {
      const res = await request(app)
        .post(`/api/v8/assessment/${assessmentId}/review`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ action: 'return', rationale: 'Please double-check axis 3 evidence quality.' });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.review.action, 'return');
      assert.equal(res.body.data.review.newStatus, 'DRAFT');
      returnReviewId = res.body.data.review.id;
      assert.ok(returnReviewId);
      assert.notEqual(returnReviewId, acceptReviewId);

      const getRes = await request(app)
        .get(`/api/v8/assessment/${assessmentId}`)
        .set('Authorization', `Bearer ${tokenA}`);
      assert.equal(getRes.status, 200);
      assert.equal(getRes.body.data.assessment.backendStatus, 'DRAFT');
      assert.equal(getRes.body.data.assessment.status, 'DRAFT');
    });

    await step(
      'GET /report after return -> STILL the exact same snapshot from step 6 ("reopen/report returns the same output")',
      async () => {
        const res = await request(app)
          .get(`/api/v8/assessment/${assessmentId}/report`)
          .set('Authorization', `Bearer ${tokenA}`);
        assert.equal(res.status, 200);
        assert.equal(res.body.data.isCurrent, true);
        assert.deepEqual(res.body.data.snapshot, reportAfterAccept.snapshot);
        assert.deepEqual(res.body.data.provenance, reportAfterAccept.provenance);
        assert.equal(res.body.data.provenance.reviewId, acceptReviewId);
      }
    );

    // ---------------------------------------------------------------------
    // Step 9: review history — 2 rows, accept then return, newest first.
    // ---------------------------------------------------------------------
    await step(
      'GET /review-history -> 2 rows (newest first: return, accept), actor/timestamp/rationale populated',
      async () => {
        const res = await request(app)
          .get(`/api/v8/assessment/${assessmentId}/review-history`)
          .set('Authorization', `Bearer ${tokenA}`);
        assert.equal(res.status, 200);
        const reviews = res.body.data.reviews;
        assert.equal(reviews.length, 2);

        // Service orders `ORDER BY created_at DESC` — newest (return) first.
        const [first, second] = reviews;
        assert.equal(first.action, 'return');
        assert.equal(first.id, returnReviewId);
        assert.equal(second.action, 'accept');
        assert.equal(second.id, acceptReviewId);

        for (const rev of reviews) {
          assert.equal(rev.actorId, USER_A);
          assert.ok(rev.createdAt);
          assert.ok(rev.rationale && rev.rationale.trim().length >= 3);
        }
      }
    );
  } finally {
    try {
      await cleanup(client, createdAssessmentIds);
      console.log('[asm-005-007-evidence-quality-output] cleanup OK (asm005007-- rows removed)');
    } finally {
      await client.end();
    }
  }

  console.log(`\n[asm-005-007-evidence-quality-output] ${passCount} passed, ${failCount} failed`);
  if (failCount > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('[asm-005-007-evidence-quality-output] FATAL', err);
  process.exitCode = 1;
});
