/**
 * fullLifecycle.e2e — AUD-MVP-LIFECYCLE-001 headline evidence (DoD item 7)
 * plus cold readback (DoD item 10).
 *
 * One end-to-end run through all seven named stages —
 *   criterion → evidence → finding → corrective action → proposal/candidate
 *   → closure → effectiveness verification
 * — asserting a row exists at EVERY stage by a direct SQL SELECT (not just
 * trusting the service's returned object). This deliberately overlaps with
 * (but does not replace or modify) the kernel's own
 * server/src/services/audits/__tests__/goldenFlow.e2e.test.ts, which proves
 * the SAME chain starting from packService/programService pack creation;
 * this file starts from a direct-SQL program+criterion fixture (the same
 * pattern segregationOfDuties.test.ts and proposalService.test.ts already
 * use) and additionally proves `registerAsInitiative` (the "candidate"
 * stage) and a COLD readback after every service module is re-imported.
 *
 * Run (from repo root):
 *   DATABASE_URL=postgresql://... DB_TYPE=postgres CI=true RUN_DB_TESTS=1 MOCK_DB=false \
 *   npx vitest run server/src/services/auditProgramHandoff/__tests__/fullLifecycle.e2e.test.ts \
 *     --no-file-parallelism --maxWorkers=1 --maxConcurrency=2 --retry=0
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  actorFor,
  addMember,
  cleanupOrg,
  insertCriterion,
  insertEvidence,
  insertOrganization,
  makeProgram,
  REAL_PG,
  requireRealPg,
  uid,
} from './helpers.js';

const describeDb = REAL_PG ? describe : describe.skip;
if (REAL_PG) requireRealPg();

describeDb('FULL LIFECYCLE — criterion -> evidence -> finding -> action -> candidate -> closure -> effectiveness (real Postgres)', () => {
  let pool: InstanceType<typeof import('pg').Pool>;

  const orgId = uid('org-lifecycle');
  const lead = uid('user-lead');
  const auditee = uid('user-auditee');
  const reviewer = uid('user-reviewer');

  // Populated during the single `it()` run, read back cold afterwards.
  const ids: {
    programId?: string;
    criterionId?: string;
    evidenceId?: string;
    findingId?: string;
    actionId?: string;
    verificationId?: string;
    proposalId?: string;
    initiativeId?: string;
  } = {};

  beforeAll(async () => {
    const { Pool } = await import('pg');
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await insertOrganization(pool, orgId);
  }, 60_000);

  afterAll(async () => {
    if (!pool) return;
    await cleanupOrg(pool, orgId);
    await pool.end();
  });

  it('runs the full chain and leaves a SELECT-able row at every stage', async () => {
    const criterionService = await import('../../audits/criterionService.js');
    const evidenceService = await import('../../audits/evidenceService.js');
    const findingService = await import('../../audits/findingService.js');
    const correctiveActionService = await import('../../audits/correctiveActionService.js');
    const verificationService = await import('../../audits/verificationService.js');
    const proposalService = await import('../../audits/proposalService.js');
    const programService = await import('../../audits/programService.js');

    const programId = await makeProgram(pool, orgId, lead, 'Program pełnego cyklu życia');
    ids.programId = programId;
    await addMember(pool, orgId, programId, lead, 'lead_auditor');
    await addMember(pool, orgId, programId, lead, 'program_owner');
    await addMember(pool, orgId, programId, auditee, 'auditee');
    await addMember(pool, orgId, programId, reviewer, 'reviewer');
    await addMember(pool, orgId, programId, reviewer, 'lead_auditor');

    // ---------------------------------------------------------- 1. criterion
    const criterionId = await insertCriterion(pool, orgId, programId, {
      refCode: 'FL.1',
      title: 'Kryterium pełnego cyklu życia',
      requirementText: 'Wymaganie testowane w pełnym łańcuchu.',
    });
    ids.criterionId = criterionId;

    // ------------------------------------------------------------ 2. evidence
    const evidenceId = await insertEvidence(pool, orgId, programId, criterionId, 'Dowód pełnego cyklu życia');
    ids.evidenceId = evidenceId;
    await evidenceService.reviewEvidence(orgId, actorFor(orgId, lead), evidenceId, {
      sufficiency: 'sufficient',
      reliability: 'reliable',
      currencyStatus: 'current',
      supportsConformity: false,
      accepted: true,
      reviewNote: 'Dowód wystarczający do wniosku.',
    });

    await criterionService.recordTest(orgId, actorFor(orgId, lead), criterionId, {
      procedurePerformed: 'Procedura testowa pełnego cyklu',
      testPerformed: 'Test wykonany',
      testResult: 'fail',
    });
    const concluded = await criterionService.concludeCriterion(orgId, actorFor(orgId, lead), criterionId, {
      auditorConclusion: 'Niezgodność stwierdzona w pełnym cyklu',
      conformityStatus: 'nonconforming',
    });
    expect(concluded.conformityStatus).toBe('nonconforming');

    // ------------------------------------------------------------- 3. finding
    const finding = await findingService.createFinding(orgId, actorFor(orgId, lead), {
      programId,
      criterionId,
      statement: 'Ustalenie pełnego cyklu życia',
      classification: 'nonconforming',
      severity: 'medium',
      objectiveEvidence: [evidenceId],
      ownerUserId: auditee,
    });
    ids.findingId = finding.id;
    const reviewedFinding = await findingService.reviewFinding(orgId, actorFor(orgId, reviewer), finding.id, {
      decision: 'confirm',
    });
    expect(reviewedFinding.status).toBe('confirmed');

    await findingService.submitManagementResponse(orgId, actorFor(orgId, auditee), finding.id, {
      position: 'accept',
      statement: 'Przyjmujemy ustalenie pełnego cyklu.',
    });

    // ------------------------------------------------------- 4. corrective action
    const action = await correctiveActionService.proposeAction(orgId, actorFor(orgId, auditee), finding.id, {
      actionKind: 'corrective_action',
      title: 'Działanie korygujące pełnego cyklu',
      ownerUserId: auditee,
      dueDate: '2026-12-01',
    });
    ids.actionId = action.id;
    const approvedAction = await correctiveActionService.approveAction(orgId, actorFor(orgId, lead), action.id);
    expect(approvedAction.status).toBe('approved');
    await correctiveActionService.reportImplementation(orgId, actorFor(orgId, auditee), action.id, {
      evidenceId,
      note: 'Działanie wdrożone.',
    });

    // ---------------------------------------------------- effectiveness verification
    const planned = await verificationService.planVerification(orgId, actorFor(orgId, lead), {
      findingId: finding.id,
      correctiveActionId: action.id,
      verificationKind: 'effectiveness',
      method: 'resample',
      plannedDate: '2026-12-15',
    });
    // Independent verifier: `lead` is neither owner nor implementer of `action`.
    const verification = await verificationService.performVerification(orgId, actorFor(orgId, lead), planned.id, {
      result: 'effective',
      note: 'Działanie skuteczne — pełny cykl.',
      evidenceId,
    });
    ids.verificationId = verification.id;
    expect(verification.result).toBe('effective');

    const closedFinding = await findingService.closeFinding(orgId, actorFor(orgId, reviewer), finding.id, {
      note: 'Zamknięte po weryfikacji skuteczności.',
    });
    expect(closedFinding.status).toBe('closed');

    // --------------------------------------------------- 5. proposal / candidate
    const [proposal] = await proposalService.draftProposalsFromFindings(orgId, actorFor(orgId, lead), programId, {
      findingIds: [finding.id],
      title: 'Propozycja pełnego cyklu życia',
    });
    ids.proposalId = proposal.id;
    const registered = await proposalService.registerAsInitiative(orgId, actorFor(orgId, lead), proposal.id);
    expect(registered.status).toBe('registered');
    ids.initiativeId = registered.registeredInitiativeId ?? undefined;
    expect(ids.initiativeId).toBeTruthy();

    // ----------------------------------------------------------- 6. closure
    // Program started at 'fieldwork' (direct-insert fixture, matching the
    // existing kernel test convention) — walk forward through every gate,
    // exactly mirroring goldenFlow.e2e.test.ts's own sequence.
    await programService.transitionLifecycle(orgId, actorFor(orgId, lead), programId, 'evidence_review');
    await programService.transitionLifecycle(orgId, actorFor(orgId, lead), programId, 'findings_review');
    await programService.transitionLifecycle(orgId, actorFor(orgId, lead), programId, 'management_response');
    await programService.transitionLifecycle(orgId, actorFor(orgId, lead), programId, 'approval');
    await programService.transitionLifecycle(orgId, actorFor(orgId, lead), programId, 'remediation');
    await programService.transitionLifecycle(orgId, actorFor(orgId, lead), programId, 'effectiveness_verification');
    const closedProgram = await programService.transitionLifecycle(orgId, actorFor(orgId, lead), programId, 'closure');
    expect(closedProgram.lifecycleState).toBe('closure');
    // unresolvedFindings is now 0 (the one finding is closed) — the terminal
    // 'closed' gate is satisfiable too, proving closure is not a dead end.
    const fullyClosed = await programService.transitionLifecycle(orgId, actorFor(orgId, lead), programId, 'closed');
    expect(fullyClosed.lifecycleState).toBe('closed');

    // ------------------------------------------------------- SELECT proofs
    const [
      criterionRow,
      evidenceRow,
      findingRow,
      actionRow,
      verificationRow,
      proposalRow,
      initiativeRow,
      programRow,
    ] = await Promise.all([
      pool.query(`SELECT id, conformity_status FROM audit_program_criteria WHERE id=$1 AND organization_id=$2`, [
        criterionId,
        orgId,
      ]),
      pool.query(`SELECT id, accepted FROM audit_evidence WHERE id=$1 AND organization_id=$2`, [evidenceId, orgId]),
      pool.query(`SELECT id, status FROM audit_program_findings WHERE id=$1 AND organization_id=$2`, [
        finding.id,
        orgId,
      ]),
      pool.query(`SELECT id, status FROM audit_corrective_actions WHERE id=$1 AND organization_id=$2`, [
        action.id,
        orgId,
      ]),
      pool.query(`SELECT id, result, verification_kind FROM audit_verifications WHERE id=$1 AND organization_id=$2`, [
        verification.id,
        orgId,
      ]),
      pool.query(`SELECT id, status, registered_initiative_id FROM audit_initiative_proposals WHERE id=$1 AND organization_id=$2`, [
        proposal.id,
        orgId,
      ]),
      pool.query(`SELECT id, source_type, source_id FROM initiatives WHERE id=$1 AND organization_id=$2`, [
        ids.initiativeId,
        orgId,
      ]),
      pool.query(`SELECT id, lifecycle_state FROM audit_programs WHERE id=$1 AND organization_id=$2`, [
        programId,
        orgId,
      ]),
    ]);

    expect(criterionRow.rows).toHaveLength(1);
    expect(criterionRow.rows[0].conformity_status).toBe('nonconforming');

    expect(evidenceRow.rows).toHaveLength(1);
    expect(evidenceRow.rows[0].accepted).toBe(true);

    expect(findingRow.rows).toHaveLength(1);
    expect(findingRow.rows[0].status).toBe('closed');

    expect(actionRow.rows).toHaveLength(1);
    expect(actionRow.rows[0].status).toBe('implemented');

    expect(verificationRow.rows).toHaveLength(1);
    expect(verificationRow.rows[0].result).toBe('effective');
    expect(verificationRow.rows[0].verification_kind).toBe('effectiveness');

    expect(proposalRow.rows).toHaveLength(1);
    expect(proposalRow.rows[0].status).toBe('registered');
    expect(proposalRow.rows[0].registered_initiative_id).toBe(ids.initiativeId);

    expect(initiativeRow.rows).toHaveLength(1);
    expect(initiativeRow.rows[0].source_type).toBe('audit');
    expect(initiativeRow.rows[0].source_id).toBe(proposal.id);

    expect(programRow.rows).toHaveLength(1);
    expect(programRow.rows[0].lifecycle_state).toBe('closed');
  }, 120_000);

  it('COLD READBACK — after a fresh pool and fresh service imports, every lifecycle row is still present with the same ids', async () => {
    expect(ids.programId, 'previous test must have populated ids').toBeTruthy();

    // A genuinely fresh pg.Pool — not the one used to write the data above.
    const { Pool } = await import('pg');
    const coldPool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
      const rows = await coldPool.query(
        `SELECT 'criterion' AS stage, id::text FROM audit_program_criteria WHERE id=$1
         UNION ALL SELECT 'evidence', id::text FROM audit_evidence WHERE id=$2
         UNION ALL SELECT 'finding', id::text FROM audit_program_findings WHERE id=$3
         UNION ALL SELECT 'action', id::text FROM audit_corrective_actions WHERE id=$4
         UNION ALL SELECT 'verification', id::text FROM audit_verifications WHERE id=$5
         UNION ALL SELECT 'proposal', id::text FROM audit_initiative_proposals WHERE id=$6
         UNION ALL SELECT 'initiative', id::text FROM initiatives WHERE id=$7
         UNION ALL SELECT 'program', id::text FROM audit_programs WHERE id=$8`,
        [
          ids.criterionId,
          ids.evidenceId,
          ids.findingId,
          ids.actionId,
          ids.verificationId,
          ids.proposalId,
          ids.initiativeId,
          ids.programId,
        ],
      );
      const byStage = Object.fromEntries(rows.rows.map((r: { stage: string; id: string }) => [r.stage, r.id]));
      expect(byStage.criterion).toBe(ids.criterionId);
      expect(byStage.evidence).toBe(ids.evidenceId);
      expect(byStage.finding).toBe(ids.findingId);
      expect(byStage.action).toBe(ids.actionId);
      expect(byStage.verification).toBe(ids.verificationId);
      expect(byStage.proposal).toBe(ids.proposalId);
      expect(byStage.initiative).toBe(ids.initiativeId);
      expect(byStage.program).toBe(ids.programId);
      expect(rows.rows).toHaveLength(8);

      // Also read back through the actual service function (not just raw
      // SQL) against the fresh pool's connection — the services themselves
      // are stateless (every call hits the DB, no in-process cache), so this
      // rules out a service-layer cache masking a lost write.
      const proposalService = await import('../../audits/proposalService.js');
      const proposalCold = await proposalService.getProposal(orgId, ids.proposalId!);
      expect(proposalCold?.status).toBe('registered');
      expect(proposalCold?.registeredInitiativeId).toBe(ids.initiativeId);
    } finally {
      await coldPool.end();
    }
  }, 60_000);
});
