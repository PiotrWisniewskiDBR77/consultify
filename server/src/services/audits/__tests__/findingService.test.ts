/**
 * findingService — testy przeciw realnej Postgres (baza U4).
 *
 * Uruchamianie (z korzenia worktree, NIE z `server/`):
 *   NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 MOCK_DB=false POSTGRES_SKIP_INIT_IN_TEST=1 \
 *   DATABASE_URL="postgresql://piotrwisniewski@127.0.0.1:5439/consultify_audits_u4" \
 *   npx vitest run server/src/services/audits/__tests__/findingService.test.ts
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AuditStateError } from '../auditsDb.js';
import {
  acceptResidualRisk,
  closeFinding,
  createFinding,
  detectSystemicFindings,
  getFinding,
  getFindingStatistics,
  listFindings,
  reviewFinding,
  reviewManagementResponse,
  submitManagementResponse,
  updateFinding,
} from '../findingService.js';
import type { AuditActor } from '../types.js';
import {
  actorFor,
  addEvidence,
  addMember,
  cleanupFixture,
  createFixture,
  requireRealPg,
  type TestFixture,
  uid,
} from './testHelpers.js';

requireRealPg();

describe('findingService', () => {
  let fx: TestFixture;
  let leadAuditor: AuditActor;
  let programOwner: AuditActor;
  let reviewer: AuditActor;
  let leadUserId: string;
  let ownerUserId: string;
  let reviewerUserId: string;

  beforeEach(async () => {
    fx = await createFixture();
    leadUserId = uid('user');
    ownerUserId = uid('user');
    reviewerUserId = uid('user');
    await addMember(fx.organizationId, fx.programId, leadUserId, 'lead_auditor');
    await addMember(fx.organizationId, fx.programId, ownerUserId, 'program_owner');
    // Recenzent MUSI być inną osobą niż autor ustalenia (leadAuditor tworzy
    // ustalenia w tych testach) — inaczej assertNotReviewingOwnFinding odrzuci
    // przegląd, a to nie jest scenariusz, który tu sprawdzamy.
    await addMember(fx.organizationId, fx.programId, reviewerUserId, 'reviewer');
    leadAuditor = actorFor(fx.organizationId, leadUserId);
    programOwner = actorFor(fx.organizationId, ownerUserId);
    reviewer = actorFor(fx.organizationId, reviewerUserId);
  });

  afterEach(async () => {
    await cleanupFixture(fx.organizationId);
  });

  // -------------------------------------------------------------------------
  // Twarda reguła 1: niezgodność wymaga kryterium i dowodu
  // -------------------------------------------------------------------------

  it('odrzuca ustalenie niezgodności bez wskazanego kryterium', async () => {
    await expect(
      createFinding(fx.organizationId, leadAuditor, {
        programId: fx.programId,
        criterionId: null,
        statement: 'Brak procedury',
        classification: 'nonconforming',
        objectiveEvidence: [fx.evidenceId],
      }),
    ).rejects.toThrow(/wskazywać wymaganie i dowód/);
  });

  it('odrzuca ustalenie niezgodności bez dowodu obiektywnego', async () => {
    await expect(
      createFinding(fx.organizationId, leadAuditor, {
        programId: fx.programId,
        criterionId: fx.criterionId,
        statement: 'Brak procedury',
        classification: 'nonconforming',
        objectiveEvidence: [],
      }),
    ).rejects.toThrow(/evidence_insufficient.*observation/);
  });

  it('przyjmuje ustalenie niezgodności z kryterium i dowodem', async () => {
    const finding = await createFinding(fx.organizationId, leadAuditor, {
      programId: fx.programId,
      criterionId: fx.criterionId,
      statement: 'Brak zatwierdzonej procedury zakupowej',
      classification: 'nonconforming',
      objectiveEvidence: [fx.evidenceId],
    });
    expect(finding.status).toBe('draft');
    expect(finding.classification).toBe('nonconforming');
    expect(finding.referenceCode).toBe('F-1');
  });

  // -------------------------------------------------------------------------
  // Twarda reguła 2: brak dowodu -> tylko evidence_insufficient/observation
  // -------------------------------------------------------------------------

  it('brak dowodu daje wyłącznie evidence_insufficient lub observation, nigdy niezgodność automatem', async () => {
    await expect(
      createFinding(fx.organizationId, leadAuditor, {
        programId: fx.programId,
        criterionId: fx.criterionId,
        statement: 'Nie dostarczono dokumentacji',
        classification: 'opportunity_for_improvement',
        objectiveEvidence: [],
      }),
    ).rejects.toThrow(AuditStateError);

    const insufficient = await createFinding(fx.organizationId, leadAuditor, {
      programId: fx.programId,
      criterionId: fx.criterionId,
      statement: 'Nie dostarczono dokumentacji na czas',
      classification: 'evidence_insufficient',
      objectiveEvidence: [],
    });
    expect(insufficient.classification).toBe('evidence_insufficient');
    expect(insufficient.objectiveEvidence).toEqual([]);

    const observation = await createFinding(fx.organizationId, leadAuditor, {
      programId: fx.programId,
      criterionId: null,
      statement: 'Warto rozważyć automatyzację',
      classification: 'observation',
      objectiveEvidence: [],
    });
    expect(observation.classification).toBe('observation');
  });

  it('evidence_insufficient wciąż wymaga wskazanego kryterium', async () => {
    await expect(
      createFinding(fx.organizationId, leadAuditor, {
        programId: fx.programId,
        criterionId: null,
        statement: 'Nie dostarczono dokumentacji',
        classification: 'evidence_insufficient',
        objectiveEvidence: [],
      }),
    ).rejects.toThrow(/wskazywać wymaganie i dowód/);
  });

  // -------------------------------------------------------------------------
  // reference_code kolejny, nie losowy
  // -------------------------------------------------------------------------

  it('nadaje reference_code kolejno (F-1, F-2, F-3), nie losowo', async () => {
    const f1 = await createFinding(fx.organizationId, leadAuditor, {
      programId: fx.programId,
      criterionId: fx.criterionId,
      statement: 'Ustalenie 1',
      classification: 'observation',
      objectiveEvidence: [],
    });
    const f2 = await createFinding(fx.organizationId, leadAuditor, {
      programId: fx.programId,
      criterionId: fx.criterionId,
      statement: 'Ustalenie 2',
      classification: 'observation',
      objectiveEvidence: [],
    });
    const f3 = await createFinding(fx.organizationId, leadAuditor, {
      programId: fx.programId,
      criterionId: fx.criterionId,
      statement: 'Ustalenie 3',
      classification: 'observation',
      objectiveEvidence: [],
    });
    expect([f1.referenceCode, f2.referenceCode, f3.referenceCode]).toEqual(['F-1', 'F-2', 'F-3']);
  });

  // -------------------------------------------------------------------------
  // updateFinding — blokada klasyfikacji/istotności po zamknięciu
  // -------------------------------------------------------------------------

  it('blokuje zmianę klasyfikacji i istotności po zamknięciu ustalenia', async () => {
    const evidenceId2 = await addEvidence(fx.organizationId, fx.programId, fx.criterionId);
    const finding = await createFinding(fx.organizationId, leadAuditor, {
      programId: fx.programId,
      criterionId: fx.criterionId,
      statement: 'Do zamknięcia',
      classification: 'observation',
      objectiveEvidence: [evidenceId2],
    });
    await reviewFinding(fx.organizationId, reviewer, finding.id, { decision: 'confirm' });
    const closed = await closeWithoutActions(fx, finding.id);
    expect(closed.status).toBe('closed');

    await expect(
      updateFinding(fx.organizationId, leadAuditor, finding.id, { classification: 'nonconforming' }),
    ).rejects.toThrow(/nie można zmienić klasyfikacji/i);

    // Inne pola pozostają edytowalne mimo zamknięcia.
    const updated = await updateFinding(fx.organizationId, leadAuditor, finding.id, {
      recommendation: 'Uzupełniona rekomendacja po zamknięciu',
    });
    expect(updated.recommendation).toBe('Uzupełniona rekomendacja po zamknięciu');
  });

  // -------------------------------------------------------------------------
  // Przegląd, odpowiedź właściciela, akceptacja ryzyka
  // -------------------------------------------------------------------------

  it('przechodzi pełny cykl: confirm -> odpowiedź właściciela -> przegląd odpowiedzi', async () => {
    const finding = await createFinding(fx.organizationId, leadAuditor, {
      programId: fx.programId,
      criterionId: fx.criterionId,
      statement: 'Niekompletna rejestracja incydentów',
      classification: 'nonconforming',
      objectiveEvidence: [fx.evidenceId],
    });

    const auditeeId = uid('user');
    await addMember(fx.organizationId, fx.programId, auditeeId, 'auditee');
    const auditee = actorFor(fx.organizationId, auditeeId);

    const confirmed = await reviewFinding(fx.organizationId, reviewer, finding.id, { decision: 'confirm' });
    expect(confirmed.status).toBe('confirmed');

    const response = await submitManagementResponse(fx.organizationId, auditee, finding.id, {
      position: 'accept',
      statement: 'Zgadzamy się, wdrożymy poprawkę procedury',
    });
    expect(response.status).toBe('submitted');

    const detail = await getFinding(fx.organizationId, finding.id);
    expect(detail.status).toBe('remediation_in_progress');
    expect(detail.managementResponses).toHaveLength(1);

    const reviewed = await reviewManagementResponse(fx.organizationId, leadAuditor, response.id, {
      accepted: true,
      note: 'OK',
    });
    expect(reviewed.status).toBe('accepted');
  });

  it('send_back i reject wymagają podania powodu', async () => {
    const finding = await createFinding(fx.organizationId, leadAuditor, {
      programId: fx.programId,
      criterionId: fx.criterionId,
      statement: 'Do odesłania',
      classification: 'nonconforming',
      objectiveEvidence: [fx.evidenceId],
    });
    await expect(
      reviewFinding(fx.organizationId, reviewer, finding.id, { decision: 'send_back', note: '' }),
    ).rejects.toThrow(/wymaga podania powodu/);

    const sentBack = await reviewFinding(fx.organizationId, reviewer, finding.id, {
      decision: 'send_back',
      note: 'Doprecyzuj gap_text',
    });
    expect(sentBack.status).toBe('draft');
    expect(sentBack.sendBackReason).toBe('Doprecyzuj gap_text');
  });

  it('akceptacja ryzyka rezydualnego wymaga notatki i ustawia risk_accepted', async () => {
    const finding = await createFinding(fx.organizationId, leadAuditor, {
      programId: fx.programId,
      criterionId: fx.criterionId,
      statement: 'Ryzyko akceptowane biznesowo',
      classification: 'nonconforming',
      objectiveEvidence: [fx.evidenceId],
    });
    await reviewFinding(fx.organizationId, reviewer, finding.id, { decision: 'confirm' });

    await expect(
      acceptResidualRisk(fx.organizationId, programOwner, finding.id, { note: '' }),
    ).rejects.toThrow(/wymaga notatki/);

    const accepted = await acceptResidualRisk(fx.organizationId, programOwner, finding.id, {
      note: 'Koszt naprawy przewyższa ryzyko, akceptujemy',
    });
    expect(accepted.status).toBe('risk_accepted');
    expect(accepted.closureDecision).toBe('risk_accepted');
  });

  // -------------------------------------------------------------------------
  // Statystyki i wykrywanie systemowych ustaleń
  // -------------------------------------------------------------------------

  it('getFindingStatistics agreguje po klasyfikacji, istotności i statusie jednym zapytaniem', async () => {
    await createFinding(fx.organizationId, leadAuditor, {
      programId: fx.programId,
      criterionId: fx.criterionId,
      statement: 'A',
      classification: 'nonconforming',
      severity: 'high',
      objectiveEvidence: [fx.evidenceId],
    });
    await createFinding(fx.organizationId, leadAuditor, {
      programId: fx.programId,
      criterionId: null,
      statement: 'B',
      classification: 'observation',
      severity: 'low',
      objectiveEvidence: [],
    });

    const stats = await getFindingStatistics(fx.organizationId, fx.programId);
    expect(stats.total).toBe(2);
    expect(stats.byClassification.nonconforming).toBe(1);
    expect(stats.byClassification.observation).toBe(1);
    expect(stats.bySeverity.high).toBe(1);
    expect(stats.byStatus.draft).toBe(2);
  });

  it('detectSystemicFindings grupuje potwierdzone ustalenia po znormalizowanej przyczynie', async () => {
    const evidenceB = await addEvidence(fx.organizationId, fx.programId, fx.criterionId);
    const evidenceC = await addEvidence(fx.organizationId, fx.programId, fx.criterionId);

    const f1 = await createFinding(fx.organizationId, leadAuditor, {
      programId: fx.programId,
      criterionId: fx.criterionId,
      statement: 'A',
      classification: 'nonconforming',
      objectiveEvidence: [fx.evidenceId],
    });
    const f2 = await createFinding(fx.organizationId, leadAuditor, {
      programId: fx.programId,
      criterionId: fx.criterionId,
      statement: 'B',
      classification: 'nonconforming',
      objectiveEvidence: [evidenceB],
    });
    const f3 = await createFinding(fx.organizationId, leadAuditor, {
      programId: fx.programId,
      criterionId: fx.criterionId,
      statement: 'C — nie ma wspólnej przyczyny',
      classification: 'nonconforming',
      objectiveEvidence: [evidenceC],
    });

    await updateFinding(fx.organizationId, leadAuditor, f1.id, { rootCause: '  Brak Szkolenia  ' });
    await updateFinding(fx.organizationId, leadAuditor, f2.id, { rootCause: 'brak szkolenia' });
    await updateFinding(fx.organizationId, leadAuditor, f3.id, { rootCause: 'inna przyczyna' });

    for (const f of [f1, f2, f3]) {
      await reviewFinding(fx.organizationId, reviewer, f.id, { decision: 'confirm' });
    }

    const groups = await detectSystemicFindings(fx.organizationId, fx.programId);
    const rootCauseGroup = groups.find((g) => g.groupKind === 'root_cause' && g.key === 'brak szkolenia');
    expect(rootCauseGroup).toBeTruthy();
    expect(rootCauseGroup?.findingIds.sort()).toEqual([f1.id, f2.id].sort());
    expect(groups.every((g) => g.count >= 2)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Izolacja organizacji
  // -------------------------------------------------------------------------

  it('izoluje ustalenia między organizacjami', async () => {
    const other = await createFixture();
    const otherUserId = uid('user');
    await addMember(other.organizationId, other.programId, otherUserId, 'lead_auditor');
    const otherActor = actorFor(other.organizationId, otherUserId);

    try {
      await createFinding(fx.organizationId, leadAuditor, {
        programId: fx.programId,
        criterionId: fx.criterionId,
        statement: 'Ustalenie organizacji A',
        classification: 'observation',
        objectiveEvidence: [],
      });
      const otherFinding = await createFinding(other.organizationId, otherActor, {
        programId: other.programId,
        criterionId: other.criterionId,
        statement: 'Ustalenie organizacji B',
        classification: 'observation',
        objectiveEvidence: [],
      });

      const listA = await listFindings(fx.organizationId, { programId: fx.programId });
      expect(listA.items.every((f) => f.organizationId === fx.organizationId)).toBe(true);
      expect(listA.items.find((f) => f.id === otherFinding.id)).toBeUndefined();

      // Odczyt cudzego ustalenia pod niewłaściwym organizationId nie znajduje wiersza.
      await expect(getFinding(fx.organizationId, otherFinding.id)).rejects.toThrow(/nie został znaleziony/);
    } finally {
      await cleanupFixture(other.organizationId);
    }
  });
});

// ---------------------------------------------------------------------------
// Pomoc lokalna: zamknięcie ustalenia bez żadnych działań (przypadek "vacuous")
// ---------------------------------------------------------------------------

async function closeWithoutActions(fx: TestFixture, findingId: string) {
  const owner = actorFor(fx.organizationId, uid('closer'));
  await addMember(fx.organizationId, fx.programId, owner.userId, 'lead_auditor');
  return closeFinding(fx.organizationId, owner, findingId, { note: 'Brak działań — obserwacja zamknięta' });
}
