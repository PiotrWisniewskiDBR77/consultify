/**
 * ROI-E005 — AC-02 proof: MyWork obligations survive Initiative closure,
 * against a REAL Postgres.
 *
 * Design: docs/product/results-vnext/ROI_E005_DESIGN.md §0/Decision D5.
 *
 * THIS IS THE EPIC'S KEY TEST. Decision D5 (confirmed by independently
 * reading `initiativeClosureService.ts` — see that file: zero references to
 * any `rvn_*` table, zero writes to `rvn_platform_obligations`, zero calls
 * into anything under `services/resultsVnext/`) already establishes that
 * AC-02 is STRUCTURALLY satisfied — there is no bug to fix, no guard to add.
 * This test's entire job is to PROVE that by actually driving:
 *
 *   1. A real ROI Case through `createRoiCase` (-> `start_roi_study`
 *      obligation) -> the full E001-E003 approval chain -> `approved` ->
 *      `startRoiCaseTracking` (-> `track_roi_forecast_actuals` obligation)
 *      -> `startRoiCaseBenefitsRealization` (-> `confirm_benefits_realization`
 *      obligation), all linked to ONE Initiative.
 *
 *   2. That SAME Initiative through the REAL, PRODUCTION legacy closure
 *      workflow — `createClosureRequest` -> `addEvidence` x2 ->
 *      `submitClosureRequest` -> `approveClosureRequest` (the exact same
 *      exported functions `initiativeClosure.routes.ts`'s HTTP layer calls,
 *      invoked directly here rather than through Express/supertest — this
 *      is still the real production code path, not a hand-rolled shortcut
 *      UPDATE of `initiatives.status`) — all the way to `initiatives.status
 *      = 'DONE'`.
 *
 *   3. Then asserts all THREE ROI obligations are still `status = 'open'` in
 *      `rvn_platform_obligations` — nothing about closing the Initiative
 *      touched them.
 *
 * Harness preconditions mirror `execution-closure-evidence-gate.golden-flow
 * .realdb.test.ts` (EXE-08) exactly — see that file's own header for the
 * full rationale (gate readiness requires owner + planned dates; the
 * approver-role gate reads `users.role`/`owner_business_id` from the DB, not
 * a JWT; evidence must be a real, terminal, initiative-owned row).
 *
 * SKIP POLICY: same convention as every other `*.realdb.test.ts` in this
 * program — silent no-op without a configured database, `beforeAll` throws
 * if configured-but-unreachable.
 */
import { randomUUID } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

function buildClientConfig(): ClientConfig | null {
  const raw = process.env.DATABASE_URL;
  const url = typeof raw === 'string' && raw.trim() && !raw.includes('${{') ? raw.trim() : null;
  if (url) {
    return { connectionString: url, connectionTimeoutMillis: 5_000, statement_timeout: 30_000 };
  }
  const host = process.env.PGHOST || process.env.DB_HOST;
  if (!host) return null;
  return {
    host,
    port: Number(process.env.PGPORT || process.env.DB_PORT || 5432),
    database: process.env.PGDATABASE || process.env.DB_NAME || 'postgres',
    user: process.env.PGUSER || process.env.DB_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD || '',
    connectionTimeoutMillis: 5_000,
    statement_timeout: 30_000,
  };
}

const DB_CONFIGURED = buildClientConfig() !== null;

const tag = `${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
const ORG_ID = `roi-e005-ac02-org-${tag}`;
const USER_OWNER = `roi-e005-ac02-owner-${tag}`; // grants INITIATIVE_OWNER via owner_business_id
const USER_APPROVER = `roi-e005-ac02-approver-${tag}`; // distinct ROI approver — approveRoiCase denies self-approval
const PROJECT_ID = `roi-e005-ac02-project-${tag}`;
const INITIATIVE_ID = `roi-e005-ac02-init-${tag}`;

let client: Client;
let reachable = false;

type CaseCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCaseCommands.js');
type BaselineCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiBaselineCommands.js');
type CostLineCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCostLineCommands.js');
type BenefitLineCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiBenefitLineCommands.js');
type CalcRunCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCalculationRunCommands.js');
type ApprovalCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCaseApprovalCommands.js');
type TrackingCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiTrackingCommands.js');
type BenefitsRealizationCommandsModule =
  typeof import('../../../server/src/services/resultsVnext/roi/roiBenefitsRealizationCommands.js');
type InitiativeClosureServiceModule = typeof import('../../../server/src/services/initiative/initiativeClosureService.js');

let createRoiCase: CaseCommandsModule['createRoiCase'];
let startModeling: CaseCommandsModule['startModeling'];
let markReadyForReview: CaseCommandsModule['markReadyForReview'];
let captureOrUpdateBaseline: BaselineCommandsModule['captureOrUpdateBaseline'];
let addCostLine: CostLineCommandsModule['addCostLine'];
let addBenefitLine: BenefitLineCommandsModule['addBenefitLine'];
let createRoiCalculationRun: CalcRunCommandsModule['createRoiCalculationRun'];
let submitRoiCaseForApproval: ApprovalCommandsModule['submitRoiCaseForApproval'];
let approveRoiCase: ApprovalCommandsModule['approveRoiCase'];
let startRoiCaseTracking: TrackingCommandsModule['startRoiCaseTracking'];
let startRoiCaseBenefitsRealization: BenefitsRealizationCommandsModule['startRoiCaseBenefitsRealization'];
let createClosureRequest: InitiativeClosureServiceModule['createClosureRequest'];
let addEvidence: InitiativeClosureServiceModule['addEvidence'];
let submitClosureRequest: InitiativeClosureServiceModule['submitClosureRequest'];
let approveClosureRequest: InitiativeClosureServiceModule['approveClosureRequest'];
let closePgPool: (() => Promise<void>) | undefined;

/**
 * A GATE UNRELATED TO ROI-E005, DISCOVERED WHILE WRITING THIS TEST, NOT THE
 * DESIGN DOC'S FAULT — `initiativeTransitionService.ts`'s EXECUTING->DONE
 * branch now ALSO requires a current, approved `initiative_lifecycle_gate_
 * decisions` row for `pmoDomain='CLOSURE'` (`hasApprovedGateDecision`,
 * `CLOSURE_GATE_DECISION_REQUIRED`) — a T01/A05 governance mechanism that
 * landed on this branch AFTER `execution-closure-evidence-gate.golden-flow
 * .realdb.test.ts` (EXE-08) was written; that file's own header explicitly
 * documents "EXECUTING->DONE does NOT call hasApprovedGateDecision", which
 * was true when written and is no longer true on this branch. Going through
 * the REAL `recordInitiativeLifecycleGateDecision` API would additionally
 * require a full T01 transformation-case + A05 proposal/scope-review chain
 * (`transformation_case_artifact_links`, canonical-run lineage, etc.) —
 * entirely orthogonal machinery this epic has no business standing up.
 * Seeded directly by SQL instead (same "frozen: no [governance] endpoint
 * call" convention the EXE-08 harness itself uses for `initiatives` rows) —
 * this is a TEST-FIXTURE deviation, not a production-code "fix" for a gate
 * this epic does not own.
 */
async function seedApprovedClosureGateDecision(
  orgId: string,
  initiativeId: string,
  humanActorUserId: string
): Promise<void> {
  const caseId = `tc_${randomUUID()}`;
  await client.query(
    `INSERT INTO transformation_cases
       (transformation_case_id, organization_id, initiated_by_user_id, mandate, lineage_id, idempotency_key)
     VALUES ($1, $2, $3, 'ROI-E005 AC-02 test-fixture mandate', $4, $5)`,
    [caseId, orgId, humanActorUserId, `lineage_${caseId}`, `idem_${caseId}`]
  );

  const proposalVersionId = `pv_${randomUUID()}`;
  await client.query(
    `INSERT INTO v8_agent_proposal_versions
       (proposal_version_id, proposal_id, organization_id, canonical_run_id, proposal_version, plan_version,
        context_digest, before_json, after_json, approval_scopes_json, reviewer_authority_json,
        expires_at, status, created_by_user_id)
     VALUES ($1, $2, $3, $4, 1, 1, $5, '{}'::jsonb, '{}'::jsonb, '[]'::jsonb, '{}'::jsonb,
             now() + interval '1 day', 'approved', $6)`,
    [
      proposalVersionId,
      `proposal_${proposalVersionId}`,
      orgId,
      `run_${proposalVersionId}`,
      'a'.repeat(64),
      humanActorUserId,
    ]
  );

  const reviewId = `review_${randomUUID()}`;
  await client.query(
    `INSERT INTO v8_agent_proposal_scope_reviews
       (review_id, proposal_version_id, scope_key, decision, reason, reviewed_by_user_id)
     VALUES ($1, $2, 'CLOSURE', 'approved', 'ROI-E005 AC-02 test-fixture review', $3)`,
    [reviewId, proposalVersionId, humanActorUserId]
  );

  await client.query(
    `INSERT INTO initiative_lifecycle_gate_decisions
       (decision_id, organization_id, initiative_id, transformation_case_id, pmo_domain, version,
        decision_status, source_digest, source_case_version, baseline_refs_json, a05_proposal_version_id,
        a05_approval_receipt_ref, human_actor_user_id, human_authority_ref, rationale, deadline_at,
        idempotency_key, input_digest)
     VALUES ($1, $2, $3, $4, 'CLOSURE', 1, 'approved', $5, 1, $6::jsonb, $7, $8, $9,
             'ROI-E005 AC-02 test-fixture authority', 'ROI-E005 AC-02 test-fixture closure gate decision',
             now() + interval '1 day', $10, $11)`,
    [
      `decision_${randomUUID()}`,
      orgId,
      initiativeId,
      caseId,
      'b'.repeat(64),
      JSON.stringify(['ROI-E005 AC-02 test-fixture baseline ref']),
      proposalVersionId,
      reviewId,
      humanActorUserId,
      `idem_gate_${randomUUID()}`,
      'c'.repeat(64),
    ]
  );
}

async function insertVisibilityPolicy(domain: string, mode: string, createdBy: string): Promise<void> {
  await client.query(
    `INSERT INTO rvn_platform_visibility_policies
       (organization_id, domain, policy_version, visibility_mode, is_active, created_by)
     VALUES ($1, $2, 1, $3, true, $4)`,
    [ORG_ID, domain, mode, createdBy]
  );
}

describe('ROI-E005 AC-02 — ROI obligations survive a REAL Initiative closure (real Postgres)', () => {
  let taskId: string;
  let milestoneId: string;

  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — ROI-E005 AC-02 obligations-survive-closure realdb test did NOT run. This run is not evidence.');
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM rvn_platform_obligations LIMIT 0');
      await client.query('SELECT 1 FROM initiative_closure_requests LIMIT 0');
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable (or missing the required schema — both the ' +
          'resultsVnext ROI/platform migrations AND the EXE-08 closure-gate migrations must be applied); ' +
          'refusing to report a green run. ' +
          String(error)
      );
    }
    reachable = true;

    const caseCommands: CaseCommandsModule = await import('../../../server/src/services/resultsVnext/roi/roiCaseCommands.js');
    createRoiCase = caseCommands.createRoiCase;
    startModeling = caseCommands.startModeling;
    markReadyForReview = caseCommands.markReadyForReview;
    const baselineCommands: BaselineCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiBaselineCommands.js'
    );
    captureOrUpdateBaseline = baselineCommands.captureOrUpdateBaseline;
    const costLineCommands: CostLineCommandsModule = await import('../../../server/src/services/resultsVnext/roi/roiCostLineCommands.js');
    addCostLine = costLineCommands.addCostLine;
    const benefitLineCommands: BenefitLineCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiBenefitLineCommands.js'
    );
    addBenefitLine = benefitLineCommands.addBenefitLine;
    const calcRunCommands: CalcRunCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiCalculationRunCommands.js'
    );
    createRoiCalculationRun = calcRunCommands.createRoiCalculationRun;
    const approvalCommands: ApprovalCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiCaseApprovalCommands.js'
    );
    submitRoiCaseForApproval = approvalCommands.submitRoiCaseForApproval;
    approveRoiCase = approvalCommands.approveRoiCase;
    const trackingCommands: TrackingCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiTrackingCommands.js'
    );
    startRoiCaseTracking = trackingCommands.startRoiCaseTracking;
    const benefitsRealizationCommands: BenefitsRealizationCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiBenefitsRealizationCommands.js'
    );
    startRoiCaseBenefitsRealization = benefitsRealizationCommands.startRoiCaseBenefitsRealization;

    const closureService: InitiativeClosureServiceModule = await import(
      '../../../server/src/services/initiative/initiativeClosureService.js'
    );
    createClosureRequest = closureService.createClosureRequest;
    addEvidence = closureService.addEvidence;
    submitClosureRequest = closureService.submitClosureRequest;
    approveClosureRequest = closureService.approveClosureRequest;

    const pgModule = await import('../../../server/src/database/PostgresDatabase.js');
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;

    // ---- Harness: mirrors execution-closure-evidence-gate.golden-flow
    // .realdb.test.ts's own setupHarness exactly (see that file's header for
    // the full rationale of each choice below). ----
    await client.query(
      `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'ROI-E005 AC-02 RealDB Org', 'enterprise', 'active')
       ON CONFLICT (id) DO NOTHING`,
      [ORG_ID]
    );
    // role='MEMBER' (never ADMIN/PMO) — this user's authority to approve the
    // closure comes ONLY from being owner_business_id on the initiative
    // below (grants INITIATIVE_OWNER via resolveInitiativeAccessContext),
    // proving the real authorization path rather than an ADMIN-role bypass.
    await client.query(
      `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
       VALUES ($1, $2, $3, 'e2e-not-used', 'MEMBER', 'active', 'ROIE005', 'AC02Owner')
       ON CONFLICT (id) DO NOTHING`,
      [USER_OWNER, ORG_ID, `${USER_OWNER}@local.test`]
    );
    // Distinct ROI approver identity — approveRoiCase denies self-approval
    // (submitted_by/created_by match), unrelated to the closure-approver
    // role gate this test also exercises with USER_OWNER.
    await client.query(
      `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
       VALUES ($1, $2, $3, 'e2e-not-used', 'MEMBER', 'active', 'ROIE005', 'AC02Approver')
       ON CONFLICT (id) DO NOTHING`,
      [USER_APPROVER, ORG_ID, `${USER_APPROVER}@local.test`]
    );
    await client.query(
      `INSERT INTO projects (id, organization_id, name, status, owner_id)
       VALUES ($1, $2, 'ROI-E005 AC-02 RealDB Project', 'active', $3)`,
      [PROJECT_ID, ORG_ID, USER_OWNER]
    );
    // EXECUTING, owner_business_id=USER_OWNER, planned_start/end_date set —
    // required by getBlockingReadinessItems for any SCHEDULED_ONWARD status
    // (EXECUTING is one), same precondition EXE-08's own harness documents.
    await client.query(
      `INSERT INTO initiatives
        (id, organization_id, project_id, name, status, progress, owner_business_id,
         planned_start_date, planned_end_date)
       VALUES ($1, $2, $3, 'ROI-E005 AC-02 Initiative', 'EXECUTING', 0, $4, '2026-01-01', '2026-12-31')`,
      [INITIATIVE_ID, ORG_ID, PROJECT_ID, USER_OWNER]
    );
    // Evidence pair — a terminal task (done) + milestone (COMPLETED),
    // attached to THIS initiative (assertEvidenceRefBelongsToInitiative
    // requires both org AND initiative ownership AND terminal status).
    taskId = `task_roi_e005_ac02_${tag}`;
    await client.query(
      `INSERT INTO tasks (id, organization_id, initiative_id, title, status)
       VALUES ($1, $2, $3, 'ROI-E005 AC-02 evidence task (done)', 'done')`,
      [taskId, ORG_ID, INITIATIVE_ID]
    );
    milestoneId = `milestone_roi_e005_ac02_${tag}`;
    await client.query(
      `INSERT INTO initiative_milestones (id, initiative_id, organization_id, name, status)
       VALUES ($1, $2, $3, 'ROI-E005 AC-02 evidence milestone (completed)', 'COMPLETED')`,
      [milestoneId, INITIATIVE_ID, ORG_ID]
    );

    await insertVisibilityPolicy('roi', 'OPEN_ORG', USER_OWNER);
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    await client.query(
      `UPDATE rvn_roi_cases SET current_forecast_version_id = NULL, current_actual_snapshot_id = NULL
        WHERE organization_id = $1`,
      [ORG_ID]
    );
    await client.query(`DELETE FROM rvn_roi_variance_causes WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_variances WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_actual_snapshots WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_actual_entries WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_forecast_versions WHERE organization_id = $1`, [ORG_ID]);
    await client.query(
      `UPDATE rvn_roi_cases SET original_approved_snapshot_id = NULL, latest_approved_snapshot_id = NULL,
              decision_calculation_run_id = NULL
        WHERE organization_id = $1`,
      [ORG_ID]
    );
    await client.query(`DELETE FROM rvn_roi_approval_snapshots WHERE organization_id = $1`, [ORG_ID]);
    await client.query(
      `DELETE FROM rvn_platform_resource_acl
        WHERE resource_type = 'roi_case'
          AND resource_id IN (SELECT case_id::text FROM rvn_roi_cases WHERE organization_id = $1)`,
      [ORG_ID]
    );
    await client.query(`DELETE FROM rvn_platform_obligations WHERE organization_id = $1`, [ORG_ID]);
    await client.query(
      `DELETE FROM rvn_platform_outbox WHERE event_id IN (SELECT event_id FROM rvn_platform_events WHERE organization_id = $1)`,
      [ORG_ID]
    );
    await client.query(`DELETE FROM rvn_platform_events WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_calculation_runs WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_benefit_lines WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_cost_lines WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_calculation_policy WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_baselines WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_cases WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_resource_visibility WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_visibility_policies WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM initiative_closure_evidence WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM initiative_closure_requests WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM initiative_history WHERE initiative_id = $1`, [INITIATIVE_ID]);
    // NOT cleaned up: `initiative_lifecycle_gate_decisions` is immutable BY
    // DESIGN — `BEFORE UPDATE OR DELETE` trigger `reject_initiative_
    // lifecycle_gate_decision_mutation` (20260810_t01_initiative_lifecycle_
    // gate_decisions.sql) rejects even a DELETE, not just an UPDATE. Its
    // supporting fixture rows (`v8_agent_proposal_versions`,
    // `v8_agent_proposal_scope_reviews`, `transformation_cases`) are
    // therefore also left in place — the gate-decision row's FKs to them
    // would block deleting the parents anyway even if the gate-decision
    // row itself could be removed. All four are tagged with this run's
    // unique `tag`-suffixed ids and never referenced by anything outside
    // this suite, so they cause no interference with other tests — an
    // accepted, permanent, by-design residue, not a leak this test can fix.
    await client.query(`DELETE FROM tasks WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM initiative_milestones WHERE organization_id = $1`, [ORG_ID]);
    // NOT deleted, for the same reason: `initiative_lifecycle_gate_decisions
    // .initiative_id`/`.human_actor_user_id` are plain (non-CASCADE) FKs to
    // `initiatives`/`users` — deleting either would fail with the same
    // 23503/immutability error transitively (and deleting `organizations`
    // would fail too, since `initiatives.organization_id` cascades INTO the
    // blocked initiative delete). `initiatives`/`projects`/`users`/
    // `organizations` for this run's uniquely-tagged org are therefore left
    // in place alongside the gate-decision chain above — same accepted,
    // permanent, by-design residue.
    await client.query(`DELETE FROM organization_members WHERE organization_id = $1`, [ORG_ID]);
    await client.end();
    if (closePgPool) await closePgPool();
  }, 30_000);

  const itDB = (name: string, fn: () => Promise<void>, timeoutMs = 30_000) =>
    it(
      name,
      async () => {
        if (!reachable) return;
        await fn();
      },
      timeoutMs
    );

  itDB(
    'creates a ROI case (start_roi_study), starts tracking (track_roi_forecast_actuals), starts benefits realization (confirm_benefits_realization), drives the LINKED Initiative through the REAL initiativeClosureService workflow to DONE, and finds all three obligations still open',
    async () => {
      // ---- 1) ROI case chain: draft -> ... -> approved -> tracking ->
      // benefits_realization, three obligations created along the way. ----
      const createOutcome = await createRoiCase({
        organizationId: ORG_ID,
        initiativeId: INITIATIVE_ID,
        title: 'ROI-E005 AC-02 case',
        ownerUserId: USER_OWNER,
        currency: 'USD',
        analysisStart: '2026-01-01',
        analysisEnd: '2026-12-31',
        createdBy: USER_OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `create-${randomUUID()}`,
      });
      const caseId = createOutcome.result.case.caseId;
      expect(createOutcome.result.created).toBe(true);

      const startOutcome = await startModeling({
        caseId,
        organizationId: ORG_ID,
        expectedVersion: createOutcome.result.case.rowVersion,
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `start-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      await captureOrUpdateBaseline({
        organizationId: ORG_ID,
        caseId,
        expectedVersion: createOutcome.result.baseline.rowVersion,
        currentMeasuredValue: 100,
        baselinePeriodStart: '2026-01-01',
        baselinePeriodEnd: '2026-01-31',
        actorId: USER_OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `baseline-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      await addCostLine({
        caseId,
        organizationId: ORG_ID,
        category: 'implementation',
        label: 'Setup',
        amount: 1000,
        currency: 'USD',
        timingType: 'one_time',
        oneTimePeriodDate: '2026-01-15',
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `cost-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      await addBenefitLine({
        caseId,
        organizationId: ORG_ID,
        category: 'revenue',
        label: 'New revenue',
        isFinancial: true,
        amount: 2000,
        currency: 'USD',
        timingType: 'one_time',
        oneTimePeriodDate: '2026-02-15',
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `benefit-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      await createRoiCalculationRun({
        organizationId: ORG_ID,
        caseId,
        scenarioId: null,
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `run-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      const readyOutcome = await markReadyForReview({
        caseId,
        organizationId: ORG_ID,
        expectedVersion: startOutcome.resultingVersion,
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `ready-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      const submitRoiOutcome = await submitRoiCaseForApproval({
        caseId,
        organizationId: ORG_ID,
        expectedVersion: readyOutcome.resultingVersion,
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `submit-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      const approveRoiOutcome = await approveRoiCase({
        caseId,
        organizationId: ORG_ID,
        expectedVersion: submitRoiOutcome.resultingVersion,
        approverId: USER_APPROVER,
        actorEffectiveRole: 'admin',
        idempotencyKey: `approve-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      const trackingOutcome = await startRoiCaseTracking({
        caseId,
        organizationId: ORG_ID,
        expectedVersion: approveRoiOutcome.resultingVersion,
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `tracking-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      const benefitsRealizationOutcome = await startRoiCaseBenefitsRealization({
        caseId,
        organizationId: ORG_ID,
        expectedVersion: trackingOutcome.resultingVersion,
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `br-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      expect(benefitsRealizationOutcome.outcome).toBe('applied');
      expect(benefitsRealizationOutcome.result.status).toBe('benefits_realization');

      const obligationsBeforeClosure = await client.query<{ obligation_type: string; status: string }>(
        `SELECT obligation_type, status FROM rvn_platform_obligations
          WHERE organization_id = $1 AND reference_type = 'roi_case' AND reference_id = $2
          ORDER BY obligation_type`,
        [ORG_ID, caseId]
      );
      expect(obligationsBeforeClosure.rows.map((r) => r.obligation_type).sort()).toEqual(
        ['confirm_benefits_realization', 'start_roi_study', 'track_roi_forecast_actuals'].sort()
      );
      for (const row of obligationsBeforeClosure.rows) {
        expect(row.status).toBe('open');
      }

      // ---- 2) Drive the LINKED Initiative through the REAL, PRODUCTION
      // legacy closure workflow — the same exported functions
      // initiativeClosure.routes.ts's HTTP layer calls, invoked directly. ----
      const createClosureResult = await createClosureRequest({
        orgId: ORG_ID,
        initiativeId: INITIATIVE_ID,
        actorId: USER_OWNER,
      });
      const closureRequestId = createClosureResult.id;
      expect(closureRequestId).toBeTruthy();

      const ev1 = await addEvidence({
        orgId: ORG_ID,
        initiativeId: INITIATIVE_ID,
        closureRequestId,
        actorId: USER_OWNER,
        evidenceType: 'task',
        evidenceRefId: taskId,
      });
      expect(ev1.idempotent).toBe(false);
      const ev2 = await addEvidence({
        orgId: ORG_ID,
        initiativeId: INITIATIVE_ID,
        closureRequestId,
        actorId: USER_OWNER,
        evidenceType: 'milestone',
        evidenceRefId: milestoneId,
      });
      expect(ev2.idempotent).toBe(false);

      const submitResult = await submitClosureRequest({
        orgId: ORG_ID,
        initiativeId: INITIATIVE_ID,
        closureRequestId,
        actorId: USER_OWNER,
        closureRationale: 'ROI-E005 AC-02 proof rationale',
        outcomeSummary: 'ROI-E005 AC-02 proof outcome',
      });
      expect(submitResult.status).toBe('submitted');

      // See seedApprovedClosureGateDecision's own doc comment — an
      // unrelated T01/A05 gate this branch added after EXE-08's own test
      // was written; satisfied here via direct SQL fixture, not a
      // production-code change.
      await seedApprovedClosureGateDecision(ORG_ID, INITIATIVE_ID, USER_OWNER);

      const approveResult = await approveClosureRequest({
        orgId: ORG_ID,
        initiativeId: INITIATIVE_ID,
        closureRequestId,
        actorId: USER_OWNER,
      });
      expect(approveResult.ok).toBe(true);
      expect(approveResult.idempotent).toBe(false);
      expect(approveResult.status).toBe('done');

      // Confirm the Initiative genuinely reached DONE via the real engine —
      // this is not a hand-rolled shortcut UPDATE; the assertion below reads
      // back the SAME row the canonical transition engine wrote.
      const initiativeRow = await client.query<{ status: string }>(
        `SELECT status FROM initiatives WHERE id = $1 AND organization_id = $2`,
        [INITIATIVE_ID, ORG_ID]
      );
      expect(initiativeRow.rows[0]!.status).toBe('DONE');

      // ---- 3) THE PROOF: all three ROI obligations remain 'open'. ----
      const obligationsAfterClosure = await client.query<{
        obligation_type: string;
        status: string;
        completed_at: string | null;
        completed_via_command: string | null;
      }>(
        `SELECT obligation_type, status, completed_at, completed_via_command FROM rvn_platform_obligations
          WHERE organization_id = $1 AND reference_type = 'roi_case' AND reference_id = $2
          ORDER BY obligation_type`,
        [ORG_ID, caseId]
      );
      expect(obligationsAfterClosure.rows).toHaveLength(3);
      expect(obligationsAfterClosure.rows.map((r) => r.obligation_type).sort()).toEqual(
        ['confirm_benefits_realization', 'start_roi_study', 'track_roi_forecast_actuals'].sort()
      );
      for (const row of obligationsAfterClosure.rows) {
        expect(row.status).toBe('open');
        expect(row.completed_at).toBeNull();
        expect(row.completed_via_command).toBeNull();
      }
    },
    60_000
  );
});
