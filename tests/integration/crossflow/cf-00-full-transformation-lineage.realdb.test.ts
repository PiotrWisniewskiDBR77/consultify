/**
 * FLOW-TRANSFORM-MVP-001 — one durable lineage, beginning at an APPROVED SWOT.
 *
 * This suite is intentionally built from the source boundary forward.  Every
 * newly added leg must retain the IDs read here; a collection of unrelated
 * green module fixtures is not a full transformation lineage.
 */
import {
  ALL_ACTORS,
  ALL_TENANTS,
  TENANT_A,
  bearer,
  coldRead,
  createApprovedSwotInitiative,
  dbReachable,
  dropTenants,
  newClient,
  provisionRoiGovernedVisibilityPolicy,
  purgeFixture,
  purgeImmutableLifecycleGateFixture,
  purgeResultsLineageFixture,
  provisionSyntheticRoiVisibilityPolicy,
  seedTransformationContextForInitiative,
  seedTenants,
} from './flowFixture.js';

import type pg from 'pg';
import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let client: pg.Client;
let app: Express;

process.env.FLOW_CLOSURE_ROI_BINDING_ENABLED = 'true';

beforeAll(async () => {
  if (!(await dbReachable())) {
    throw new Error('FLOW full-lineage suite requires its disposable real PostgreSQL');
  }
  client = newClient();
  await client.connect();
  await seedTenants(client);
  await expect(
    provisionSyntheticRoiVisibilityPolicy(client, TENANT_A.admin, 'foreign-tenant')
  ).rejects.toThrow('same-tenant ADMIN');
  const policy = await provisionSyntheticRoiVisibilityPolicy(client, TENANT_A.admin, TENANT_A.id);
  expect(policy.fixtureKind).toBe('SYNTHETIC_TEST_ONLY');

  // AMD-FLOW-ROI-VISIBILITY-002 — the REAL governed policy, published
  // through the same command the route layer calls (publishRoiGovernedVisibilityPolicy),
  // NOT a raw insert. This is what GET /cases and GET /cases/:caseId below
  // actually check (resolveRoiGovernedVisibility) — replacing the synthetic
  // OPEN_ORG fixture above as the thing THIS suite's read path depends on.
  // The synthetic fixture above remains ONLY because createRoiCase (via
  // closureReceiptRoiCaseAdapter.ts, invoked by the closure-delivery worker
  // below) still depends on the SEPARATE, still-unresolved legacy
  // domain='roi' policy — see flowFixture.ts's doc comment on
  // provisionSyntheticRoiVisibilityPolicy for why that is OWNER DECISION
  // REQUIRED, not something this packet resolves.
  await expect(provisionRoiGovernedVisibilityPolicy(TENANT_A.owner, 'foreign-tenant')).rejects.toThrow(
    'same-tenant ACTIVE OWNER or ADMIN'
  );
  const governedPolicy = await provisionRoiGovernedVisibilityPolicy(TENANT_A.owner, TENANT_A.id);
  expect(governedPolicy.outcome).toBe('applied');
  const initiativesRouter = (await import('../../../server/src/routes/pmo/initiatives.routes.js')).default;
  const proposalsRouter = (await import('../../../server/src/routes/v8/agent-proposals.routes.js')).default;
  const roiRouter = (await import('../../../server/src/routes/resultsVnext/roi.routes.js')).default;
  const { verifyToken } = await import('../../../server/src/middleware/auth.middleware.js');
  const { attachV8Context } = await import('../../../server/src/middleware/v8Auth.middleware.js');
  app = express();
  app.use(express.json());
  app.use('/api/initiatives', initiativesRouter);
  app.use('/api/v8/agent-proposals', verifyToken, attachV8Context, proposalsRouter);
  app.use('/api/vnext/results/roi', verifyToken, attachV8Context, roiRouter);
});

afterAll(async () => {
  if (!client) return;
  await purgeImmutableLifecycleGateFixture(client);
  await purgeResultsLineageFixture(client);
  await client.query(
    `UPDATE transformation_cases SET active_plan_id=NULL WHERE organization_id=ANY($1::text[])`,
    [[TENANT_A.id]]
  );
  await purgeFixture(client, [
    'v8_agent_proposal_governance_events',
    'v8_agent_proposal_scope_reviews',
    'v8_agent_proposal_versions',
    'transformation_case_artifact_links',
    'v8_agent_run_identities',
    'transformation_cases',
    'transformation_plans',
    'v8_execution_runs',
    'v8_context_snapshots',
    'initiative_milestones',
    'initiative_status_history',
    'project_members',
    'initiative_card_values',
    'initiative_cards',
    'initiative_candidates',
    'initiatives',
    'swot_candidate_handoffs',
    'tool_decisions',
    'tool_sessions',
    'projects',
  ]);
  // AMD-FLOW-ROI-VISIBILITY-002 — CORRECTION to an earlier version of this
  // teardown (closure-b F2): the packet lead's initial framing ("zero
  // residue for an append-only-ledger-referenced org is structurally
  // impossible short of dropping the database") was right about the
  // trigger — a plain DELETE, and even DELETE-via-ON-DELETE-CASCADE, both
  // still fire a BEFORE DELETE FOR EACH ROW trigger and both get rejected,
  // verified empirically. It was wrong about there being NO sanctioned way
  // around that HERE specifically: `purgeResultsLineageFixture` above
  // already carries a transaction-scoped `SET LOCAL session_replication_role=
  // 'replica'` escape hatch (flowFixture.ts), gated behind
  // FLOW_ALLOW_IMMUTABLE_FIXTURE_CLEANUP=1 and a `flow_*`-prefixed
  // disposable-database name check — built for, and already used on,
  // `rvn_finance_reconciliation_grant_events` (the pre-existing sibling
  // table this suite's own finance-owner-grants step above already
  // populates for TENANT_A). `replica` mode suppresses ordinary (non-ALWAYS)
  // triggers for the duration of the transaction only, auto-reverting at
  // COMMIT/ROLLBACK — NOT a persistent `ALTER TABLE ... DISABLE TRIGGER`,
  // so it does not "publish the claim that the guard is liftable" the way a
  // permanent disable would.
  //
  // `rvn_roi_visibility_governance` (this packet's own table) is now added
  // to `purgeResultsLineageFixture`'s table list (flowFixture.ts), so it is
  // cleaned the SAME sanctioned way, in the SAME already-open transaction,
  // BEFORE `dropTenants()` runs below — verified empirically (closure-b F2)
  // that after this cleanup, `organizations` for TENANT_A deletes with zero
  // FK violation, exactly like TENANT_B always has. `dropTenants()` itself
  // (the SHARED helper) is therefore called completely unmodified, and the
  // residue assertion below is a REAL, MEASURED zero — not an accepted
  // permanent non-zero — because zero turned out to be reachable after all.
  await dropTenants(client);
  const postCommit = await client.query<{ residue: string; triggers_enabled: string; advisory: string }>(
    `SELECT (
       (SELECT count(*) FROM organizations WHERE id=ANY($1::text[])) +
       (SELECT count(*) FROM users WHERE id=ANY($2::text[])) +
       (SELECT count(*) FROM organization_members WHERE organization_id=ANY($1::text[])) +
       (SELECT count(*) FROM initiatives WHERE organization_id=ANY($1::text[])) +
       (SELECT count(*) FROM initiative_lifecycle_gate_decisions WHERE organization_id=ANY($1::text[])) +
       (SELECT count(*) FROM v8_agent_proposal_versions WHERE organization_id=ANY($1::text[])) +
       (SELECT count(*) FROM rvn_roi_cases WHERE organization_id=ANY($1::text[])) +
       (SELECT count(*) FROM rvn_platform_events WHERE organization_id=ANY($1::text[])) +
       (SELECT count(*) FROM rvn_finance_reconciliation_grant_events WHERE organization_id=ANY($1::text[])) +
       (SELECT count(*) FROM rvn_roi_visibility_governance WHERE organization_id=ANY($1::text[]))
     )::text residue,
     (SELECT count(*)::text FROM pg_trigger WHERE NOT tgisinternal AND tgenabled='O'
       AND tgname=ANY($3::text[])) triggers_enabled,
     (SELECT count(*)::text FROM pg_locks WHERE locktype='advisory' AND pid=pg_backend_pid()) advisory`,
    [
      ALL_TENANTS.map((tenant) => tenant.id),
      ALL_ACTORS.map((actor) => actor.id),
      [
        'initiative_lifecycle_gate_decisions_immutable',
        'trg_rvn_fin_reconciliation_grant_insert_guard',
        'trg_rvn_fin_reconciliation_decision_append_only',
        'trg_rvn_fin_reconciliation_grant_append_only',
        'trg_rvn_roi_visibility_governance_append_only',
      ],
    ]
  );
  expect(postCommit.rows[0]).toEqual({ residue: '0', triggers_enabled: '5', advisory: '0' });
  await client.end();
});

describe('FLOW full transformation lineage (real PostgreSQL)', () => {
  it('starts through mounted signed auth at one APPROVED SWOT and persists the accepted Initiative identity', async () => {
    const lineage = await createApprovedSwotInitiative(client, 'primary');

    const persisted = await coldRead(async (cold) => {
      const source = await cold.query<{
        status: string;
        approved_at: Date | null;
      }>(`SELECT status, approved_at FROM tool_sessions WHERE id=$1 AND organization_id=$2`, [
        lineage.toolSessionId,
        TENANT_A.id,
      ]);
      const candidate = await cold.query<{
        status: string;
        initiative_id: string | null;
      }>(
        `SELECT status, initiative_id FROM initiative_candidates
          WHERE id=$1 AND organization_id=$2`,
        [lineage.candidateId, TENANT_A.id]
      );
      const initiative = await cold.query<{
        status: string;
        source_type: string | null;
      }>(`SELECT status, source_type FROM initiatives WHERE id=$1 AND organization_id=$2`, [
        lineage.initiativeId,
        TENANT_A.id,
      ]);
      return {
        source: source.rows[0],
        candidate: candidate.rows[0],
        initiative: initiative.rows[0],
      };
    });

    expect(persisted.source?.status).toBe('APPROVED');
    expect(persisted.source?.approved_at).toBeInstanceOf(Date);
    expect(persisted.candidate).toEqual({
      status: 'accepted',
      initiative_id: lineage.initiativeId,
    });
    expect(persisted.initiative).toEqual({
      status: 'DRAFT',
      source_type: 'swot_recommendation',
    });
  });

  it('uses distinct signed humans for explicit A05 approval before PROMOTED and PLANNING', async () => {
    const lineage = await createApprovedSwotInitiative(client, 'governed-lifecycle');
    const context = await seedTransformationContextForInitiative(client, lineage.initiativeId);

    const owned = await request(app)
      .put(`/api/initiatives/${lineage.initiativeId}`)
      .set('Authorization', bearer(TENANT_A.owner))
      .send({
        ownerBusinessId: TENANT_A.owner.id,
        plannedStartDate: '2026-09-01',
        plannedEndDate: '2026-12-15',
        expectedRoi: 125000,
      });
    expect(owned.status, JSON.stringify(owned.body)).toBe(200);

    for (const status of ['PENDING_REVIEW', 'REVIEW']) {
      const moved = await request(app)
        .patch(`/api/initiatives/${lineage.initiativeId}/status`)
        .set('Authorization', bearer(TENANT_A.owner))
        .send({ status, reason: `Explicit ${status} step` });
      expect(moved.status, JSON.stringify(moved.body)).toBe(200);
    }

    const runGoverned = async (targetStatus: 'PROMOTED' | 'PLANNING') => {
      const arbitraryActiveReviewer = await request(app)
        .post(`/api/initiatives/${lineage.initiativeId}/lifecycle-transition-proposals`)
        .set('Authorization', bearer(TENANT_A.owner))
        .send({
          transformationCaseId: context.transformationCaseId,
          reviewerUserId: TENANT_A.member.id,
          targetStatus,
          reason: `Reject arbitrary ACTIVE reviewer for ${targetStatus}`,
        });
      expect(arbitraryActiveReviewer.status).toBe(403);
      const proposed = await request(app)
        .post(`/api/initiatives/${lineage.initiativeId}/lifecycle-transition-proposals`)
        .set('Authorization', bearer(TENANT_A.owner))
        .send({
          transformationCaseId: context.transformationCaseId,
          reviewerUserId: TENANT_A.admin.id,
          targetStatus,
          reason: `Propose ${targetStatus}`,
        });
      expect(proposed.status, JSON.stringify(proposed.body)).toBe(201);
      const proposalVersionId = String(proposed.body.proposal.proposalVersionId);
      const scopeKey = String(proposed.body.proposal.scopeKey);

      const selfReview = await request(app)
        .post(`/api/v8/agent-proposals/${proposalVersionId}/scopes/${scopeKey}/review`)
        .set('Authorization', bearer(TENANT_A.owner))
        .send({ decision: 'approved', reason: 'Self-review must be denied' });
      expect(selfReview.status).toBe(403);

      const reviewed = await request(app)
        .post(`/api/v8/agent-proposals/${proposalVersionId}/scopes/${scopeKey}/review`)
        .set('Authorization', bearer(TENANT_A.admin))
        .send({ decision: 'approved', reason: `Independent ${targetStatus} review` });
      expect(reviewed.status, JSON.stringify(reviewed.body)).toBe(200);

      if (targetStatus === 'PROMOTED') {
        await client.query(
          `UPDATE project_members SET project_role='TEAM_MEMBER'
            WHERE project_id=(SELECT project_id FROM initiatives WHERE id=$1 AND organization_id=$2)
              AND user_id=$3`,
          [lineage.initiativeId, TENANT_A.id, TENANT_A.admin.id]
        );
        const staleAuthority = await request(app)
          .post(`/api/initiatives/${lineage.initiativeId}/lifecycle-transition-executions`)
          .set('Authorization', bearer(TENANT_A.admin))
          .send({ proposalVersionId, reason: 'An approved review cannot outlive reviewer project authority' });
        expect(staleAuthority.status).toBe(403);
        await client.query(
          `UPDATE project_members SET project_role='PROJECT_SPONSOR'
            WHERE project_id=(SELECT project_id FROM initiatives WHERE id=$1 AND organization_id=$2)
              AND user_id=$3`,
          [lineage.initiativeId, TENANT_A.id, TENANT_A.admin.id]
        );
      }

      const executions = await Promise.all(Array.from({ length: 2 }, () => request(app)
        .post(`/api/initiatives/${lineage.initiativeId}/lifecycle-transition-executions`)
        .set('Authorization', bearer(TENANT_A.admin))
        .send({ proposalVersionId, reason: `Execute approved ${targetStatus}` })));
      const winners = executions.filter((result) => result.status === 200 || result.status === 201);
      expect(winners, executions.map((result) => ({ status: result.status, body: result.body }))).toHaveLength(1);
      expect(executions.filter((result) => result.status === 409)).toHaveLength(1);
    };

    await runGoverned('PROMOTED');
    await runGoverned('PLANNING');

    const approved = await request(app)
      .patch(`/api/initiatives/${lineage.initiativeId}/status`)
      .set('Authorization', bearer(TENANT_A.owner))
      .send({ status: 'APPROVED', reason: 'Explicit business approval before scheduling' });
    expect(approved.status, JSON.stringify(approved.body)).toBe(200);
    const milestone = await request(app)
      .post(`/api/initiatives/${lineage.initiativeId}/milestones`)
      .set('Authorization', bearer(TENANT_A.owner))
      .send({
        name: 'Full-lineage delivery gate',
        targetDate: '2026-10-15',
        isGate: true,
        idempotencyKey: `flow-milestone:${lineage.initiativeId}`,
      });
    expect([200, 201], JSON.stringify(milestone.body)).toContain(milestone.status);
    await runGoverned('SCHEDULED');
    await runGoverned('EXECUTING');
    const milestoneId = String(milestone.body?.milestone?.id ?? milestone.body?.id ?? '');
    expect(milestoneId).not.toBe('');
    const completedMilestone = await request(app)
      .put(`/api/initiatives/${lineage.initiativeId}/milestones/${milestoneId}`)
      .set('Authorization', bearer(TENANT_A.owner))
      .send({ status: 'COMPLETED' });
    expect(completedMilestone.status, JSON.stringify(completedMilestone.body)).toBe(200);
    await runGoverned('DONE');
    const proof = await coldRead((cold) =>
      cold.query<{ status: string; decisions: string }>(
        `SELECT i.status,
                (SELECT COUNT(*)::text FROM initiative_lifecycle_gate_decisions d
                  WHERE d.organization_id=i.organization_id AND d.initiative_id=i.id) decisions
           FROM initiatives i WHERE i.id=$1 AND i.organization_id=$2`,
        [lineage.initiativeId, TENANT_A.id]
      )
    );
    expect(proof.rows[0]).toEqual({ status: 'DONE', decisions: '5' });

    let receipt!: Awaited<ReturnType<typeof coldRead<{
      rows: Array<{ id: string; results_status: string; finance_status: string; finance_payload: { roiCaseId?: string } }>;
    }>>>;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      receipt = await coldRead((cold) =>
        cold.query<{ id: string; results_status: string; finance_status: string; finance_payload: { roiCaseId?: string } }>(
          `SELECT id,results_status,finance_status,finance_payload FROM closure_delivery_receipts
            WHERE organization_id=$1 AND initiative_id=$2 ORDER BY created_at DESC LIMIT 1`,
          [TENANT_A.id, lineage.initiativeId]
        )
      );
      if (receipt.rows[0]?.results_status === 'DELIVERED' && receipt.rows[0]?.finance_status === 'NEEDS_DECISION' && receipt.rows[0]?.finance_payload?.roiCaseId) break;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(receipt.rows[0]?.results_status).toBe('DELIVERED');
    expect(receipt.rows[0]?.finance_status).toBe('NEEDS_DECISION');
    expect(receipt.rows[0]?.finance_payload?.roiCaseId).toBeTruthy();
    const roiCaseId = String(receipt.rows[0]?.finance_payload?.roiCaseId);

    const getRoiCase = async () => {
      const response = await request(app)
        .get(`/api/vnext/results/roi/cases/${roiCaseId}`)
        .set('Authorization', bearer(TENANT_A.owner));
      expect(response.status, JSON.stringify(response.body)).toBe(200);
      return response.body.case as { rowVersion: number; status: string };
    };
    let roiCase = await getRoiCase();
    expect(roiCase.status).toBe('draft');

    const analysisWindow = await request(app)
      .patch(`/api/vnext/results/roi/cases/${roiCaseId}`)
      .set('Authorization', bearer(TENANT_A.owner))
      .send({
        expectedVersion: roiCase.rowVersion,
        analysisStart: '2026-01-01',
        analysisEnd: '2026-12-31',
        idempotencyKey: `flow-analysis-window:${roiCaseId}`,
        reason: 'Synthetic test-only analysis window prerequisite',
      });
    expect(analysisWindow.status, JSON.stringify(analysisWindow.body)).toBe(200);
    roiCase = analysisWindow.body.case;

    const baseline = await request(app)
      .put(`/api/vnext/results/roi/cases/${roiCaseId}/baseline`)
      .set('Authorization', bearer(TENANT_A.owner))
      .send({
        expectedVersion: 1,
        baselinePeriodStart: '2026-01-01',
        baselinePeriodEnd: '2026-06-30',
        currentMeasuredValue: 100,
        currentMeasuredUnit: 'index',
        currentMeasuredAsOf: '2026-06-30',
        source: 'synthetic-test-only full-lineage baseline',
        confidence: 'high',
        ownerUserId: TENANT_A.owner.id,
        idempotencyKey: `flow-baseline:${roiCaseId}`,
      });
    expect(baseline.status, JSON.stringify(baseline.body)).toBe(200);

    const startModeling = await request(app)
      .post(`/api/vnext/results/roi/cases/${roiCaseId}/transitions/start-modeling`)
      .set('Authorization', bearer(TENANT_A.owner))
      .send({ expectedVersion: roiCase.rowVersion, idempotencyKey: `flow-model:${roiCaseId}` });
    expect(startModeling.status, JSON.stringify(startModeling.body)).toBe(200);
    roiCase = startModeling.body.case;

    const calculation = await request(app)
      .post(`/api/vnext/results/roi/cases/${roiCaseId}/calculation-runs`)
      .set('Authorization', bearer(TENANT_A.owner))
      .send({ idempotencyKey: `flow-calc:${roiCaseId}`, reason: 'Synthetic test-only deterministic calculation' });
    expect([200, 201], JSON.stringify(calculation.body)).toContain(calculation.status);

    const ready = await request(app)
      .post(`/api/vnext/results/roi/cases/${roiCaseId}/transitions/ready-for-review`)
      .set('Authorization', bearer(TENANT_A.owner))
      .send({ expectedVersion: roiCase.rowVersion, idempotencyKey: `flow-ready:${roiCaseId}` });
    expect(ready.status, JSON.stringify(ready.body)).toBe(200);
    roiCase = ready.body.case;

    const financeLink = await request(app)
      .post(`/api/vnext/results/roi/cases/${roiCaseId}/finance-links`)
      .set('Authorization', bearer(TENANT_A.owner))
      .send({
        financeArtifactType: 'closure_delivery_receipt',
        financeArtifactId: receipt.rows[0]?.id,
        financeVersionId: 'receipt-v1',
        mappingVersion: 1,
        source: 'synthetic-test-only receipt reconciliation fixture',
        asOf: '2026-07-31',
        semanticUnit: 'PLN',
        currency: 'PLN',
        linkPurpose: 'post-closure reconciliation mechanics proof',
        idempotencyKey: `flow-finance-link:${roiCaseId}`,
      });
    expect([200, 201], JSON.stringify(financeLink.body)).toContain(financeLink.status);
    const financeLinkId = String(financeLink.body.financeLink?.linkId);
    expect(financeLinkId).not.toBe('');

    const submitted = await request(app)
      .post(`/api/vnext/results/roi/cases/${roiCaseId}/transitions/submit-for-approval`)
      .set('Authorization', bearer(TENANT_A.owner))
      .send({ expectedVersion: roiCase.rowVersion, idempotencyKey: `flow-submit:${roiCaseId}` });
    expect(submitted.status, JSON.stringify(submitted.body)).toBe(200);
    roiCase = submitted.body.case;

    const selfApproval = await request(app)
      .post(`/api/vnext/results/roi/cases/${roiCaseId}/transitions/approve`)
      .set('Authorization', bearer(TENANT_A.owner))
      .send({ expectedVersion: roiCase.rowVersion, idempotencyKey: `flow-self-approve:${roiCaseId}` });
    expect(selfApproval.status).toBe(403);
    const approvedRoi = await request(app)
      .post(`/api/vnext/results/roi/cases/${roiCaseId}/transitions/approve`)
      .set('Authorization', bearer(TENANT_A.reviewer))
      .send({ expectedVersion: roiCase.rowVersion, idempotencyKey: `flow-approve:${roiCaseId}` });
    expect(approvedRoi.status, JSON.stringify(approvedRoi.body)).toBe(200);
    roiCase = approvedRoi.body.case;

    const reconciliation = await request(app)
      .post(`/api/vnext/results/roi/cases/${roiCaseId}/finance-reconciliations`)
      .set('Authorization', bearer(TENANT_A.owner))
      .send({
        financeLinkId,
        reconciliationKind: 'dispute',
        roiValue: 112,
        financeValue: 100,
        divergenceReason: 'Synthetic test-only mechanics variance',
        idempotencyKey: `flow-reconciliation:${roiCaseId}`,
      });
    expect([200, 201], JSON.stringify(reconciliation.body)).toContain(reconciliation.status);
    const reconciliationRow = reconciliation.body.financeReconciliation as {
      reconciliationId: string;
      rowVersion: number;
    };
    const selfResolve = await request(app)
      .patch(`/api/vnext/results/roi/cases/${roiCaseId}/finance-reconciliations/${reconciliationRow.reconciliationId}`)
      .set('Authorization', bearer(TENANT_A.owner))
      .send({
        expectedVersion: reconciliationRow.rowVersion,
        status: 'resolved',
        resolutionNotes: 'Self-resolution must be rejected',
        idempotencyKey: `flow-reconcile-self:${roiCaseId}`,
      });
    expect(selfResolve.status).toBe(409);
    expect(selfResolve.body.code).toBe('FINANCE_OWNER_GRANT_REQUIRED');

    const grant = await request(app)
      .post('/api/vnext/results/roi/finance-owner-grants')
      .set('Authorization', bearer(TENANT_A.owner))
      .send({ userId: TENANT_A.reviewer.id, action: 'granted', idempotencyKey: `flow-finance-grant:${roiCaseId}` });
    expect(grant.status, JSON.stringify(grant.body)).toBe(201);
    const grantReplay = await request(app)
      .post('/api/vnext/results/roi/finance-owner-grants')
      .set('Authorization', bearer(TENANT_A.owner))
      .send({ userId: TENANT_A.reviewer.id, action: 'granted', idempotencyKey: `flow-finance-grant:${roiCaseId}` });
    expect(grantReplay.status).toBe(200);
    expect(grantReplay.body.grant.receiptId).toBe(grant.body.grant.receiptId);
    const resolved = await request(app)
      .patch(`/api/vnext/results/roi/cases/${roiCaseId}/finance-reconciliations/${reconciliationRow.reconciliationId}`)
      .set('Authorization', bearer(TENANT_A.reviewer))
      .send({
        expectedVersion: reconciliationRow.rowVersion,
        status: 'resolved',
        resolutionNotes: 'Distinct ADMIN resolved synthetic mechanics variance',
        idempotencyKey: `flow-reconcile-admin:${roiCaseId}`,
      });
    expect(resolved.status, JSON.stringify(resolved.body)).toBe(200);

    const tracking = await request(app)
      .post(`/api/vnext/results/roi/cases/${roiCaseId}/transitions/start-tracking`)
      .set('Authorization', bearer(TENANT_A.owner))
      .send({ expectedVersion: roiCase.rowVersion, idempotencyKey: `flow-track:${roiCaseId}` });
    expect(tracking.status, JSON.stringify(tracking.body)).toBe(200);

    const actual = await request(app)
      .post(`/api/vnext/results/roi/cases/${roiCaseId}/actuals`)
      .set('Authorization', bearer(TENANT_A.owner))
      .send({
        entryType: 'observation',
        periodStart: '2026-07-01',
        periodEnd: '2026-07-31',
        amount: 112,
        currency: 'PLN',
        source: 'synthetic-test-only observed actual',
        evidenceRefs: [{ receiptId: receipt.rows[0]?.id }],
        idempotencyKey: `flow-actual:${roiCaseId}`,
      });
    expect([200, 201], JSON.stringify(actual.body)).toContain(actual.status);

    roiCase = await getRoiCase();
    const benefits = await request(app)
      .post(`/api/vnext/results/roi/cases/${roiCaseId}/transitions/start-benefits-realization`)
      .set('Authorization', bearer(TENANT_A.owner))
      .send({ expectedVersion: roiCase.rowVersion, idempotencyKey: `flow-benefits:${roiCaseId}` });
    expect(benefits.status, JSON.stringify(benefits.body)).toBe(200);
    roiCase = benefits.body.case;
    const scheduledPir = await request(app)
      .put(`/api/vnext/results/roi/cases/${roiCaseId}/post-investment-review-schedule`)
      .set('Authorization', bearer(TENANT_A.owner))
      .send({
        expectedVersion: roiCase.rowVersion,
        nextReviewAt: '2026-08-17T00:00:00.000Z',
        idempotencyKey: `flow-pir-schedule:${roiCaseId}`,
      });
    expect(scheduledPir.status, JSON.stringify(scheduledPir.body)).toBe(200);
    roiCase = scheduledPir.body.case;
    const due = await request(app)
      .post(`/api/vnext/results/roi/cases/${roiCaseId}/transitions/mark-pir-due`)
      .set('Authorization', bearer(TENANT_A.owner))
      .send({ expectedVersion: roiCase.rowVersion, idempotencyKey: `flow-pir-due:${roiCaseId}` });
    expect(due.status, JSON.stringify(due.body)).toBe(200);
    roiCase = due.body.case;
    const startedPir = await request(app)
      .post(`/api/vnext/results/roi/cases/${roiCaseId}/transitions/start-pir`)
      .set('Authorization', bearer(TENANT_A.owner))
      .send({ expectedVersion: roiCase.rowVersion, idempotencyKey: `flow-pir-start:${roiCaseId}` });
    expect(startedPir.status, JSON.stringify(startedPir.body)).toBe(200);
    const pir = startedPir.body.pir as { pirId: string; rowVersion: number };
    const drafted = await request(app)
      .patch(`/api/vnext/results/roi/cases/${roiCaseId}/post-investment-reviews/${pir.pirId}`)
      .set('Authorization', bearer(TENANT_A.owner))
      .send({
        expectedVersion: pir.rowVersion,
        outcome: 'benefits_partially_realized',
        lessonsLearned: 'Synthetic test-only mechanics lesson; no human acceptance claimed.',
        recommendation: 'Require owner review outside this repository gate.',
        idempotencyKey: `flow-pir-draft:${roiCaseId}`,
      });
    expect(drafted.status, JSON.stringify(drafted.body)).toBe(200);
    const closeSelf = await request(app)
      .post(`/api/vnext/results/roi/cases/${roiCaseId}/transitions/close`)
      .set('Authorization', bearer(TENANT_A.owner))
      .send({ expectedVersion: startedPir.body.case.rowVersion, idempotencyKey: `flow-pir-close-self:${roiCaseId}` });
    expect(closeSelf.status).toBe(403);
    const latestBeforeClose = await getRoiCase();
    const closed = await request(app)
      .post(`/api/vnext/results/roi/cases/${roiCaseId}/transitions/close`)
      .set('Authorization', bearer(TENANT_A.reviewer))
      .send({ expectedVersion: latestBeforeClose.rowVersion, idempotencyKey: `flow-pir-close-admin:${roiCaseId}` });
    expect(closed.status, JSON.stringify(closed.body)).toBe(200);
    expect(closed.body.case.status).toBe('closed');
  });
});
