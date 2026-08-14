/**
 * correctiveActionService — testy przeciw realnej Postgres (baza U4).
 *
 * Uruchamianie (z korzenia worktree, NIE z `server/`):
 *   NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 MOCK_DB=false POSTGRES_SKIP_INIT_IN_TEST=1 \
 *   DATABASE_URL="postgresql://piotrwisniewski@127.0.0.1:5439/consultify_audits_u4" \
 *   npx vitest run server/src/services/audits/__tests__/correctiveActionService.test.ts
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  approveAction,
  linkToInitiative,
  linkToTask,
  listActions,
  markOverdueActions,
  proposeAction,
  rejectAction,
  reportImplementation,
} from '../correctiveActionService.js';
import { createFinding } from '../findingService.js';
import type { AuditActor } from '../types.js';
import {
  actorFor,
  addMember,
  cleanupFixture,
  createFixture,
  requireRealPg,
  type TestFixture,
  uid,
} from './testHelpers.js';

requireRealPg();

describe('correctiveActionService', () => {
  let fx: TestFixture;
  let leadAuditor: AuditActor;
  let auditee: AuditActor;
  let findingId: string;

  beforeEach(async () => {
    fx = await createFixture();
    const leadUserId = uid('user');
    const auditeeUserId = uid('user');
    await addMember(fx.organizationId, fx.programId, leadUserId, 'lead_auditor');
    await addMember(fx.organizationId, fx.programId, auditeeUserId, 'auditee');
    leadAuditor = actorFor(fx.organizationId, leadUserId);
    auditee = actorFor(fx.organizationId, auditeeUserId);

    const finding = await createFinding(fx.organizationId, leadAuditor, {
      programId: fx.programId,
      criterionId: fx.criterionId,
      statement: 'Brak zatwierdzonej procedury zakupowej',
      classification: 'nonconforming',
      objectiveEvidence: [fx.evidenceId],
    });
    findingId = finding.id;
  });

  afterEach(async () => {
    await cleanupFixture(fx.organizationId);
  });

  it('auditee proponuje działanie (auditee ma action.propose)', async () => {
    const action = await proposeAction(fx.organizationId, auditee, findingId, {
      actionKind: 'correction',
      title: 'Wycofać błędne faktury',
    });
    expect(action.status).toBe('proposed');
    expect(action.actionKind).toBe('correction');
  });

  // -------------------------------------------------------------------------
  // TWARDA REGUŁA: plan złożony wyłącznie z correction/containment nie
  // przechodzi zatwierdzenia dla ustalenia oznaczającego niezgodność.
  // -------------------------------------------------------------------------

  it('nie zatwierdza planu złożonego wyłącznie z korekcji/działań doraźnych dla niezgodności', async () => {
    const correction = await proposeAction(fx.organizationId, auditee, findingId, {
      actionKind: 'correction',
      title: 'Anulować błędną fakturę',
    });
    const containment = await proposeAction(fx.organizationId, auditee, findingId, {
      actionKind: 'containment',
      title: 'Wstrzymać dalsze zakupy do wyjaśnienia',
    });

    await expect(approveAction(fx.organizationId, leadAuditor, correction.id)).rejects.toThrow(
      /korekcja usuwa SKUTEK/
    );
    await expect(approveAction(fx.organizationId, leadAuditor, containment.id)).rejects.toThrow(
      /co najmniej.*corrective_action/
    );
  });

  it('zatwierdza plan zawierający co najmniej jedno corrective_action', async () => {
    await proposeAction(fx.organizationId, auditee, findingId, {
      actionKind: 'containment',
      title: 'Wstrzymać dalsze zakupy do wyjaśnienia',
    });
    const rootFix = await proposeAction(fx.organizationId, auditee, findingId, {
      actionKind: 'corrective_action',
      title: 'Wdrożyć zatwierdzoną procedurę zakupową',
      ownerUserId: auditee.userId,
      dueDate: '2026-09-01',
    });

    const approved = await approveAction(fx.organizationId, leadAuditor, rootFix.id);
    expect(approved.status).toBe('approved');
    expect(approved.approvedBy).toBe(leadAuditor.userId);
  });

  it('nie wymaga corrective_action dla ustalenia nieoznaczającego niezgodności (observation)', async () => {
    const observation = await createFinding(fx.organizationId, leadAuditor, {
      programId: fx.programId,
      criterionId: null,
      statement: 'Warto rozważyć automatyzację',
      classification: 'observation',
      objectiveEvidence: [],
    });
    const suggestion = await proposeAction(fx.organizationId, auditee, observation.id, {
      actionKind: 'preventive_action',
      title: 'Zbadać możliwość automatyzacji',
    });
    const approved = await approveAction(fx.organizationId, leadAuditor, suggestion.id);
    expect(approved.status).toBe('approved');
  });

  // -------------------------------------------------------------------------
  // Odrzucenie, wdrożenie, powiązania
  // -------------------------------------------------------------------------

  it('odrzucenie działania wymaga powodu i ustawia status rejected', async () => {
    const action = await proposeAction(fx.organizationId, auditee, findingId, {
      actionKind: 'corrective_action',
      title: 'Propozycja do odrzucenia',
    });
    await expect(rejectAction(fx.organizationId, leadAuditor, action.id, '')).rejects.toThrow(
      /wymaga podania powodu/
    );
    const rejected = await rejectAction(
      fx.organizationId,
      leadAuditor,
      action.id,
      'Nieadekwatne do przyczyny'
    );
    expect(rejected.status).toBe('rejected');
    expect(rejected.rejectedReason).toBe('Nieadekwatne do przyczyny');
  });

  it('reportImplementation wymaga statusu zatwierdzonego i zapisuje wykonawcę', async () => {
    const action = await proposeAction(fx.organizationId, auditee, findingId, {
      actionKind: 'corrective_action',
      title: 'Wdrożyć procedurę',
    });
    await expect(
      reportImplementation(fx.organizationId, auditee, action.id, { note: 'Za wcześnie' })
    ).rejects.toThrow(/zatwierdzonego lub w toku/);

    await approveAction(fx.organizationId, leadAuditor, action.id);
    const implemented = await reportImplementation(fx.organizationId, auditee, action.id, {
      evidenceId: fx.evidenceId,
      note: 'Procedura wdrożona i rozesłana zespołowi',
    });
    expect(implemented.status).toBe('implemented');
    expect(implemented.implementedBy).toBe(auditee.userId);
    expect(implemented.implementationEvidenceId).toBe(fx.evidenceId);
  });

  it('linkToTask i linkToInitiative zapisują read-back bez tworzenia obiektów', async () => {
    const action = await proposeAction(fx.organizationId, auditee, findingId, {
      actionKind: 'corrective_action',
      title: 'Działanie do powiązania',
    });
    const linkedTask = await linkToTask(fx.organizationId, auditee, action.id, 'task_external_123');
    expect(linkedTask.taskId).toBe('task_external_123');

    const linkedInitiative = await linkToInitiative(
      fx.organizationId,
      auditee,
      action.id,
      'init_external_456'
    );
    expect(linkedInitiative.initiativeId).toBe('init_external_456');
  });

  it('markOverdueActions oznacza przeterminowane działania i zostawia resztę bez zmian', async () => {
    const overdueAction = await proposeAction(fx.organizationId, auditee, findingId, {
      actionKind: 'corrective_action',
      title: 'Dawno przeterminowane działanie',
      dueDate: '2020-01-01',
    });
    await approveAction(fx.organizationId, leadAuditor, overdueAction.id);

    const futureAction = await proposeAction(fx.organizationId, auditee, findingId, {
      actionKind: 'containment',
      title: 'Działanie z terminem w przyszłości',
      dueDate: '2099-01-01',
    });
    await approveAction(fx.organizationId, leadAuditor, futureAction.id);

    const result = await markOverdueActions(fx.organizationId);
    expect(result.updatedIds).toContain(overdueAction.id);
    expect(result.updatedIds).not.toContain(futureAction.id);

    const list = await listActions(fx.organizationId, { programId: fx.programId });
    const overdueRow = list.items.find((a) => a.id === overdueAction.id);
    const futureRow = list.items.find((a) => a.id === futureAction.id);
    expect(overdueRow?.status).toBe('overdue');
    expect(futureRow?.status).toBe('approved');
  });

  // -------------------------------------------------------------------------
  // Izolacja organizacji
  // -------------------------------------------------------------------------

  it('izoluje działania korygujące między organizacjami', async () => {
    const other = await createFixture();
    const otherLeadId = uid('user');
    const otherAuditeeId = uid('user');
    await addMember(other.organizationId, other.programId, otherLeadId, 'lead_auditor');
    await addMember(other.organizationId, other.programId, otherAuditeeId, 'auditee');
    const otherLead = actorFor(other.organizationId, otherLeadId);
    const otherAuditee = actorFor(other.organizationId, otherAuditeeId);

    try {
      const otherFinding = await createFinding(other.organizationId, otherLead, {
        programId: other.programId,
        criterionId: other.criterionId,
        statement: 'Ustalenie innej organizacji',
        classification: 'nonconforming',
        objectiveEvidence: [other.evidenceId],
      });
      const otherAction = await proposeAction(other.organizationId, otherAuditee, otherFinding.id, {
        actionKind: 'corrective_action',
        title: 'Działanie innej organizacji',
      });

      const listA = await listActions(fx.organizationId, { programId: fx.programId });
      expect(listA.items.find((a) => a.id === otherAction.id)).toBeUndefined();

      // Próba zatwierdzenia cudzego działania w kontekście organizacji A nie
      // znajduje wiersza (brak przecieku między dzierżawcami).
      await expect(approveAction(fx.organizationId, leadAuditor, otherAction.id)).rejects.toThrow(
        /nie został znaleziony/
      );
    } finally {
      await cleanupFixture(other.organizationId);
    }
  });
});
