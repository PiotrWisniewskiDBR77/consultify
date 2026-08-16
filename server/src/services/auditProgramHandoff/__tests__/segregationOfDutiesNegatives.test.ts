/**
 * segregationOfDutiesNegatives — AUD-MVP-LIFECYCLE-001 DoD item 5.
 *
 * Independent corroboration of the four SoD guards in
 * server/src/services/audits/permissions.ts (read-only for this lane — the
 * kernel already has its own, more extensive
 * server/src/services/audits/__tests__/segregationOfDuties.test.ts, which
 * this file does NOT replace or modify). One test per guard, asserting the
 * EXACT denial message, plus a positive control proving the action succeeds
 * once performed by someone else.
 *
 * Run (from repo root):
 *   DATABASE_URL=postgresql://... DB_TYPE=postgres CI=true RUN_DB_TESTS=1 MOCK_DB=false \
 *   npx vitest run server/src/services/auditProgramHandoff/__tests__/segregationOfDutiesNegatives.test.ts \
 *     --no-file-parallelism --maxWorkers=1 --maxConcurrency=2 --retry=0
 */
import { afterEach, describe, expect, it } from 'vitest';

import { actorFor, addMember, cleanupOrg, insertCriterion, insertEvidence, insertFinding, makeProgram, REAL_PG, requireRealPg, uid } from './helpers.js';

const describeDb = REAL_PG ? describe : describe.skip;
if (REAL_PG) requireRealPg();

describeDb('segregation of duties — independent negative controls (real Postgres)', () => {
  let pool: InstanceType<typeof import('pg').Pool>;
  let criterionService: typeof import('../../audits/criterionService.js');
  let findingService: typeof import('../../audits/findingService.js');
  let correctiveActionService: typeof import('../../audits/correctiveActionService.js');
  let verificationService: typeof import('../../audits/verificationService.js');

  const orgIds: string[] = [];

  async function setup() {
    if (!pool) {
      const { Pool } = await import('pg');
      pool = new Pool({ connectionString: process.env.DATABASE_URL });
      criterionService = await import('../../audits/criterionService.js');
      findingService = await import('../../audits/findingService.js');
      correctiveActionService = await import('../../audits/correctiveActionService.js');
      verificationService = await import('../../audits/verificationService.js');
    }
    const organizationId = uid('org-sod');
    orgIds.push(organizationId);
    const programId = await makeProgram(pool, organizationId, uid('user'));
    return { organizationId, programId };
  }

  afterEach(async () => {
    if (!pool) return;
    while (orgIds.length) {
      const orgId = orgIds.pop()!;
      await cleanupOrg(pool, orgId);
    }
  });

  it('1. the SAME actor cannot conclude a criterion they answered as auditee', async () => {
    const { organizationId, programId } = await setup();
    const userId = uid('user');
    const otherId = uid('user');
    await addMember(pool, organizationId, programId, userId, 'auditee');
    await addMember(pool, organizationId, programId, userId, 'lead_auditor');
    await addMember(pool, organizationId, programId, otherId, 'lead_auditor');
    const criterionId = await insertCriterion(pool, organizationId, programId);

    await criterionService.submitAuditeeResponse(
      organizationId,
      actorFor(organizationId, userId),
      criterionId,
      'Odpowiedź audytowanego — SoD test',
    );
    // concludeCriterion requires a recorded test result regardless of actor —
    // unrelated to the SoD guard under test, but a precondition for it.
    await criterionService.recordTest(organizationId, actorFor(organizationId, otherId), criterionId, {
      procedurePerformed: 'Procedura testowa — SoD test',
      testPerformed: 'Test wykonany przez osobę trzecią',
      testResult: 'pass',
    });

    await expect(
      criterionService.concludeCriterion(organizationId, actorFor(organizationId, userId), criterionId, {
        auditorConclusion: 'Próba wniosku przez tę samą osobę',
        conformityStatus: 'nonconforming',
      }),
    ).rejects.toThrow(/Nie możesz wyciągnąć wniosku audytowego dla kryterium, na które sam odpowiadałeś jako strona audytowana/);

    // Positive control: a different lead_auditor CAN conclude it.
    // ('nonconforming', not 'conforming' — the latter additionally requires at
    // least one accepted evidence row, an unrelated precondition this test
    // does not need in order to prove the SoD guard.)
    const concluded = await criterionService.concludeCriterion(
      organizationId,
      actorFor(organizationId, otherId),
      criterionId,
      { auditorConclusion: 'Wniosek przez osobę trzecią', conformityStatus: 'nonconforming' },
    );
    expect(concluded.conformityStatus).toBe('nonconforming');
  });

  it('2. the SAME actor (owner of the finding) cannot close their own finding', async () => {
    const { organizationId, programId } = await setup();
    const criterionId = await insertCriterion(pool, organizationId, programId);
    const ownerId = uid('user');
    const authorId = uid('user');
    const thirdPartyId = uid('user');
    await addMember(pool, organizationId, programId, ownerId, 'lead_auditor');
    await addMember(pool, organizationId, programId, authorId, 'lead_auditor');
    await addMember(pool, organizationId, programId, thirdPartyId, 'lead_auditor');
    await addMember(pool, organizationId, programId, thirdPartyId, 'reviewer');

    const finding = await findingService.createFinding(organizationId, actorFor(organizationId, authorId), {
      programId,
      criterionId,
      statement: 'SoD test — właściciel nie zamyka sam',
      classification: 'observation',
      objectiveEvidence: [],
      ownerUserId: ownerId,
    });
    await findingService.reviewFinding(organizationId, actorFor(organizationId, thirdPartyId), finding.id, {
      decision: 'confirm',
    });

    await expect(
      findingService.closeFinding(organizationId, actorFor(organizationId, ownerId), finding.id, {
        note: 'Próba zamknięcia przez właściciela',
      }),
    ).rejects.toThrow(/Właściciel ustalenia nie może go sam zamknąć/);

    const closed = await findingService.closeFinding(organizationId, actorFor(organizationId, thirdPartyId), finding.id, {
      note: 'Zamknięte przez osobę trzecią',
    });
    expect(closed.status).toBe('closed');
  });

  it('3. the SAME actor (author of the finding) cannot review their own finding', async () => {
    const { organizationId, programId } = await setup();
    const criterionId = await insertCriterion(pool, organizationId, programId);
    const authorId = uid('user');
    await addMember(pool, organizationId, programId, authorId, 'lead_auditor');
    await addMember(pool, organizationId, programId, authorId, 'reviewer');

    const finding = await findingService.createFinding(organizationId, actorFor(organizationId, authorId), {
      programId,
      criterionId,
      statement: 'SoD test — autor nie recenzuje sam',
      classification: 'observation',
      objectiveEvidence: [],
    });

    await expect(
      findingService.reviewFinding(organizationId, actorFor(organizationId, authorId), finding.id, {
        decision: 'confirm',
      }),
    ).rejects.toThrow(/Autor ustalenia nie może być jego recenzentem/);

    const reviewerId = uid('user');
    await addMember(pool, organizationId, programId, reviewerId, 'reviewer');
    const reviewed = await findingService.reviewFinding(organizationId, actorFor(organizationId, reviewerId), finding.id, {
      decision: 'confirm',
    });
    expect(reviewed.status).toBe('confirmed');
  });

  it('4. the SAME actor (owner/implementer of a corrective action) cannot verify its own effectiveness', async () => {
    const { organizationId, programId } = await setup();
    const criterionId = await insertCriterion(pool, organizationId, programId);
    const evidenceId = await insertEvidence(pool, organizationId, programId, criterionId);
    const ownerId = uid('user');
    const leadId = uid('user');
    await addMember(pool, organizationId, programId, ownerId, 'auditee');
    await addMember(pool, organizationId, programId, ownerId, 'lead_auditor');
    await addMember(pool, organizationId, programId, leadId, 'lead_auditor');

    const finding = await findingService.createFinding(organizationId, actorFor(organizationId, leadId), {
      programId,
      criterionId,
      statement: 'SoD test — właściciel działania nie weryfikuje sam',
      classification: 'nonconforming',
      severity: 'medium',
      objectiveEvidence: [evidenceId],
      ownerUserId: ownerId,
    });

    const action = await correctiveActionService.proposeAction(organizationId, actorFor(organizationId, ownerId), finding.id, {
      actionKind: 'corrective_action',
      title: 'SoD test — działanie korygujące',
      ownerUserId: ownerId,
      dueDate: '2026-12-01',
    });
    await correctiveActionService.approveAction(organizationId, actorFor(organizationId, leadId), action.id);
    await correctiveActionService.reportImplementation(organizationId, actorFor(organizationId, ownerId), action.id, {
      evidenceId,
      note: 'Wdrożone przez właściciela',
    });

    const planned = await verificationService.planVerification(organizationId, actorFor(organizationId, leadId), {
      findingId: finding.id,
      correctiveActionId: action.id,
      verificationKind: 'effectiveness',
      method: 'resample',
      plannedDate: '2026-12-15',
    });

    await expect(
      verificationService.performVerification(organizationId, actorFor(organizationId, ownerId), planned.id, {
        result: 'effective',
        note: 'Próba weryfikacji przez właściciela działania',
        evidenceId,
      }),
    ).rejects.toThrow(/Weryfikację skuteczności musi wykonać osoba inna niż właściciel lub wykonawca działania/);

    const verified = await verificationService.performVerification(organizationId, actorFor(organizationId, leadId), planned.id, {
      result: 'effective',
      note: 'Weryfikacja przez audytora wiodącego',
      evidenceId,
    });
    expect(verified.result).toBe('effective');
  });
});
