/**
 * verificationService — testy przeciw realnej Postgres (baza U4).
 *
 * Uruchamianie (z korzenia worktree, NIE z `server/`):
 *   NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 MOCK_DB=false POSTGRES_SKIP_INIT_IN_TEST=1 \
 *   DATABASE_URL="postgresql://piotrwisniewski@127.0.0.1:5439/consultify_audits_u4" \
 *   npx vitest run server/src/services/audits/__tests__/verificationService.test.ts
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { approveAction, proposeAction, reportImplementation } from '../correctiveActionService.js';
import { createFinding, reviewFinding } from '../findingService.js';
import {
  getVerificationReadiness,
  listVerifications,
  performVerification,
  planVerification,
} from '../verificationService.js';
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

describe('verificationService', () => {
  let fx: TestFixture;
  let leadAuditor: AuditActor;
  let auditee: AuditActor;
  let reviewer: AuditActor;
  let findingId: string;
  let actionId: string;

  beforeEach(async () => {
    fx = await createFixture();
    const leadUserId = uid('user');
    const auditeeUserId = uid('user');
    const reviewerUserId = uid('user');
    await addMember(fx.organizationId, fx.programId, leadUserId, 'lead_auditor');
    await addMember(fx.organizationId, fx.programId, auditeeUserId, 'auditee');
    await addMember(fx.organizationId, fx.programId, reviewerUserId, 'reviewer');
    leadAuditor = actorFor(fx.organizationId, leadUserId);
    auditee = actorFor(fx.organizationId, auditeeUserId);
    reviewer = actorFor(fx.organizationId, reviewerUserId);

    const finding = await createFinding(fx.organizationId, leadAuditor, {
      programId: fx.programId,
      criterionId: fx.criterionId,
      statement: 'Brak zatwierdzonej procedury zakupowej',
      classification: 'nonconforming',
      objectiveEvidence: [fx.evidenceId],
    });
    findingId = finding.id;
    // findingsReadyToClose w getVerificationReadiness świadomie wyklucza status
    // 'draft' (ustalenie jeszcze nie przeszło przeglądu) — potwierdzamy je, żeby
    // test sprawdzał właściwy scenariusz „po weryfikacji gotowe do zamknięcia".
    await reviewFinding(fx.organizationId, reviewer, findingId, { decision: 'confirm' });

    const action = await proposeAction(fx.organizationId, auditee, findingId, {
      actionKind: 'corrective_action',
      title: 'Wdrożyć zatwierdzoną procedurę zakupową',
      ownerUserId: auditee.userId,
    });
    await approveAction(fx.organizationId, leadAuditor, action.id);
    await reportImplementation(fx.organizationId, auditee, action.id, {
      evidenceId: fx.evidenceId,
      note: 'Wdrożono',
    });
    actionId = action.id;
  });

  afterEach(async () => {
    await cleanupFixture(fx.organizationId);
  });

  it('planVerification tworzy weryfikację w stanie zaplanowanym', async () => {
    const verification = await planVerification(fx.organizationId, leadAuditor, {
      findingId,
      correctiveActionId: actionId,
      verificationKind: 'effectiveness',
      method: 'document_review',
      plannedDate: '2026-09-15',
    });
    expect(verification.performedAt).toBeNull();
    expect(verification.result).toBeNull();
    expect(verification.verificationKind).toBe('effectiveness');
  });

  // -------------------------------------------------------------------------
  // TWARDA REGUŁA: skuteczność ('effective') bez dowodu jest odrzucana
  // -------------------------------------------------------------------------

  it('odrzuca wynik effective bez wskazanego dowodu', async () => {
    const verification = await planVerification(fx.organizationId, leadAuditor, {
      findingId,
      correctiveActionId: actionId,
      verificationKind: 'effectiveness',
    });

    // Weryfikujący MUSI być inny niż właściciel/wykonawca działania (auditee) —
    // używamy leadAuditor, który nie jest właścicielem ani wykonawcą.
    await expect(
      performVerification(fx.organizationId, leadAuditor, verification.id, { result: 'effective' }),
    ).rejects.toThrow(/skuteczność musi opierać się na dowodzie/i);

    const performed = await performVerification(fx.organizationId, leadAuditor, verification.id, {
      result: 'effective',
      evidenceId: fx.evidenceId,
      note: 'Procedura stosowana w praktyce, potwierdzone próbką dokumentów',
    });
    expect(performed.result).toBe('effective');
    expect(performed.evidenceId).toBe(fx.evidenceId);
    expect(performed.independenceOk).toBe(true);
  });

  it('nie wymaga dowodu dla wyników innych niż effective', async () => {
    const verification = await planVerification(fx.organizationId, leadAuditor, {
      findingId,
      correctiveActionId: actionId,
      verificationKind: 'effectiveness',
    });
    const performed = await performVerification(fx.organizationId, leadAuditor, verification.id, {
      result: 'not_effective',
      note: 'Procedura wciąż nie jest stosowana',
    });
    expect(performed.result).toBe('not_effective');
  });

  // -------------------------------------------------------------------------
  // getVerificationReadiness
  // -------------------------------------------------------------------------

  it('getVerificationReadiness widzi działanie wdrożone bez weryfikacji i finding gotowy po jej wykonaniu', async () => {
    const before = await getVerificationReadiness(fx.organizationId, fx.programId);
    expect(before.implementedWithoutVerification.some((r) => r.actionId === actionId)).toBe(true);

    const verification = await planVerification(fx.organizationId, leadAuditor, {
      findingId,
      correctiveActionId: actionId,
      verificationKind: 'effectiveness',
    });
    await performVerification(fx.organizationId, leadAuditor, verification.id, {
      result: 'effective',
      evidenceId: fx.evidenceId,
    });

    const after = await getVerificationReadiness(fx.organizationId, fx.programId);
    expect(after.implementedWithoutVerification.some((r) => r.actionId === actionId)).toBe(false);
    expect(after.findingsReadyToClose.some((f) => f.findingId === findingId)).toBe(true);
  });

  it('listVerifications filtruje po ustaleniu i rodzaju', async () => {
    await planVerification(fx.organizationId, leadAuditor, {
      findingId,
      correctiveActionId: actionId,
      verificationKind: 'implementation',
    });
    await planVerification(fx.organizationId, leadAuditor, {
      findingId,
      correctiveActionId: actionId,
      verificationKind: 'effectiveness',
    });

    const onlyEffectiveness = await listVerifications(fx.organizationId, { findingId, kind: 'effectiveness' });
    expect(onlyEffectiveness).toHaveLength(1);
    expect(onlyEffectiveness[0].verificationKind).toBe('effectiveness');
  });

  // -------------------------------------------------------------------------
  // Izolacja organizacji
  // -------------------------------------------------------------------------

  it('izoluje weryfikacje między organizacjami', async () => {
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
      const otherVerification = await planVerification(other.organizationId, otherLead, {
        findingId: otherFinding.id,
        correctiveActionId: otherAction.id,
        verificationKind: 'effectiveness',
      });

      const listA = await listVerifications(fx.organizationId, { programId: fx.programId });
      expect(listA.find((v) => v.id === otherVerification.id)).toBeUndefined();

      await expect(
        performVerification(fx.organizationId, leadAuditor, otherVerification.id, {
          result: 'effective',
          evidenceId: fx.evidenceId,
        }),
      ).rejects.toThrow(/nie został znaleziony/);
    } finally {
      await cleanupFixture(other.organizationId);
    }
  });
});
