/**
 * segregationOfDuties — U4 — dowód deny-path dla każdego z sześciu zakazów
 * segregacji obowiązków wymienionych w zadaniu, przeciw realnej Postgres.
 *
 * Każdy test tworzy dokładnie tę sytuację, w której naruszenie MOGŁOBY się
 * zdarzyć, i sprawdza, że serwis ją blokuje — nie że blokuje "coś w ogóle".
 *
 * Uruchamianie (z korzenia worktree, NIE z `server/`):
 *   NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 MOCK_DB=false POSTGRES_SKIP_INIT_IN_TEST=1 \
 *   DATABASE_URL="postgresql://piotrwisniewski@127.0.0.1:5439/consultify_audits_u4" \
 *   npx vitest run server/src/services/audits/__tests__/segregationOfDuties.test.ts
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { approveAction, proposeAction, reportImplementation } from '../correctiveActionService.js';
import {
  acceptResidualRisk,
  closeFinding,
  createFinding,
  reviewFinding,
  updateFinding,
} from '../findingService.js';
import { performVerification, planVerification } from '../verificationService.js';
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

describe('segregationOfDuties — U4', () => {
  let fx: TestFixture;

  afterEach(async () => {
    await cleanupFixture(fx.organizationId);
  });

  // -------------------------------------------------------------------------
  // 1. Audytowany (owner ustalenia) nie zamyka własnego ustalenia.
  // -------------------------------------------------------------------------

  it('1. właściciel ustalenia nie może sam go zamknąć — nawet mając rolę lead_auditor', async () => {
    fx = await createFixture();
    const authorId = uid('user');
    const ownerId = uid('user'); // "audytowany" / właściciel ustalenia
    const thirdPartyId = uid('user'); // recenzent i finalny "zamykający"
    await addMember(fx.organizationId, fx.programId, authorId, 'lead_auditor');
    // Właściciel ustalenia dostaje też rolę lead_auditor — segregacja MUSI
    // zadziałać mimo posiadania roli, która co do zasady ma prawo zamykać.
    await addMember(fx.organizationId, fx.programId, ownerId, 'lead_auditor');
    await addMember(fx.organizationId, fx.programId, thirdPartyId, 'reviewer');
    await addMember(fx.organizationId, fx.programId, thirdPartyId, 'lead_auditor');
    const author = actorFor(fx.organizationId, authorId);
    const owner = actorFor(fx.organizationId, ownerId);
    const thirdParty = actorFor(fx.organizationId, thirdPartyId);

    const finding = await createFinding(fx.organizationId, author, {
      programId: fx.programId,
      criterionId: fx.criterionId,
      statement: 'Ustalenie z jawnym właścicielem',
      classification: 'observation',
      objectiveEvidence: [],
      ownerUserId: ownerId,
    });
    // Recenzja przez osobę trzecią (autor nie może recenzować własnego ustalenia).
    await reviewFinding(fx.organizationId, thirdParty, finding.id, { decision: 'confirm' });

    await expect(
      closeFinding(fx.organizationId, owner, finding.id, { note: 'Zamykam sam siebie' })
    ).rejects.toThrow(/Właściciel ustalenia nie może go sam zamknąć/);

    // Kontrola pozytywna: inna osoba z rolą lead_auditor zamyka bez przeszkód.
    const closed = await closeFinding(fx.organizationId, thirdParty, finding.id, {
      note: 'Zamknięte przez osobę trzecią',
    });
    expect(closed.status).toBe('closed');
  });

  // -------------------------------------------------------------------------
  // 2. Autor ustalenia nie jest jego recenzentem.
  // -------------------------------------------------------------------------

  it('2. autor ustalenia nie może być jego recenzentem — nawet mając rolę reviewer', async () => {
    fx = await createFixture();
    const authorId = uid('user');
    await addMember(fx.organizationId, fx.programId, authorId, 'lead_auditor');
    // Ta sama osoba dostaje DODATKOWO rolę reviewer — segregacja musi
    // zablokować mimo posiadania odpowiedniej roli.
    await addMember(fx.organizationId, fx.programId, authorId, 'reviewer');
    const author = actorFor(fx.organizationId, authorId);

    const finding = await createFinding(fx.organizationId, author, {
      programId: fx.programId,
      criterionId: fx.criterionId,
      statement: 'Ustalenie recenzowane przez autora?',
      classification: 'observation',
      objectiveEvidence: [],
    });

    await expect(
      reviewFinding(fx.organizationId, author, finding.id, { decision: 'confirm' })
    ).rejects.toThrow(/Autor ustalenia nie może być jego recenzentem/);

    const otherReviewerId = uid('user');
    await addMember(fx.organizationId, fx.programId, otherReviewerId, 'reviewer');
    const confirmed = await reviewFinding(
      fx.organizationId,
      actorFor(fx.organizationId, otherReviewerId),
      finding.id,
      {
        decision: 'confirm',
      }
    );
    expect(confirmed.status).toBe('confirmed');
  });

  // -------------------------------------------------------------------------
  // 3. Właściciel działania nie weryfikuje sam skuteczności własnego działania.
  // -------------------------------------------------------------------------

  it('3. wykonawca działania nie weryfikuje sam skuteczności — nawet mając rolę auditor', async () => {
    fx = await createFixture();
    const leadId = uid('user');
    const executorId = uid('user');
    await addMember(fx.organizationId, fx.programId, leadId, 'lead_auditor');
    await addMember(fx.organizationId, fx.programId, executorId, 'auditee');
    // Wykonawca dostaje DODATKOWO rolę auditor (ma capability verification.perform)
    // — segregacja musi i tak zablokować weryfikację WŁASNEGO działania.
    await addMember(fx.organizationId, fx.programId, executorId, 'auditor');
    const lead = actorFor(fx.organizationId, leadId);
    const executor = actorFor(fx.organizationId, executorId);

    const finding = await createFinding(fx.organizationId, lead, {
      programId: fx.programId,
      criterionId: fx.criterionId,
      statement: 'Wymaga działania korygującego',
      classification: 'nonconforming',
      objectiveEvidence: [fx.evidenceId],
    });
    const action = await proposeAction(fx.organizationId, executor, finding.id, {
      actionKind: 'corrective_action',
      title: 'Wdrożyć procedurę',
      ownerUserId: executorId,
    });
    await approveAction(fx.organizationId, lead, action.id);
    await reportImplementation(fx.organizationId, executor, action.id, {
      evidenceId: fx.evidenceId,
      note: 'Wdrożono osobiście',
    });

    const verification = await planVerification(fx.organizationId, lead, {
      findingId: finding.id,
      correctiveActionId: action.id,
      verificationKind: 'effectiveness',
    });

    await expect(
      performVerification(fx.organizationId, executor, verification.id, {
        result: 'effective',
        evidenceId: fx.evidenceId,
      })
    ).rejects.toThrow(
      /Weryfikację skuteczności musi wykonać osoba inna niż właściciel lub wykonawca działania/
    );

    const independent = await performVerification(fx.organizationId, lead, verification.id, {
      result: 'effective',
      evidenceId: fx.evidenceId,
    });
    expect(independent.result).toBe('effective');
  });

  // -------------------------------------------------------------------------
  // 4. Osoba bez roli nie zmienia ustalenia.
  // -------------------------------------------------------------------------

  it('4. członek organizacji bez roli audytowej w programie nie może zmienić ustalenia', async () => {
    fx = await createFixture();
    const leadId = uid('user');
    await addMember(fx.organizationId, fx.programId, leadId, 'lead_auditor');
    const lead = actorFor(fx.organizationId, leadId);

    const finding = await createFinding(fx.organizationId, lead, {
      programId: fx.programId,
      criterionId: fx.criterionId,
      statement: 'Ustalenie chronione przed edycją przez outsidera',
      classification: 'observation',
      objectiveEvidence: [],
    });

    // Ten aktor NIGDY nie dostał żadnej roli w audit_program_members.
    const outsider = actorFor(fx.organizationId, uid('outsider'));

    await expect(
      updateFinding(fx.organizationId, outsider, finding.id, {
        recommendation: 'Nieautoryzowana zmiana',
      })
    ).rejects.toThrow(/wymaga roli audytowej/);

    await expect(
      createFinding(fx.organizationId, outsider, {
        programId: fx.programId,
        criterionId: fx.criterionId,
        statement: 'Próba utworzenia bez roli',
        classification: 'observation',
        objectiveEvidence: [],
      })
    ).rejects.toThrow(/wymaga roli audytowej/);
  });

  // -------------------------------------------------------------------------
  // 5. Akceptacja ryzyka rezydualnego przez osobę bez wskazanej roli jest
  //    odrzucana.
  // -------------------------------------------------------------------------

  it('5. akceptacja ryzyka rezydualnego wymaga roli program_owner (domyślna reguła pakietu)', async () => {
    fx = await createFixture(); // brak decisionRules.riskAcceptanceRoles -> domyślnie ['program_owner']
    const leadId = uid('user');
    await addMember(fx.organizationId, fx.programId, leadId, 'lead_auditor');
    const lead = actorFor(fx.organizationId, leadId);

    const finding = await createFinding(fx.organizationId, lead, {
      programId: fx.programId,
      criterionId: fx.criterionId,
      statement: 'Ryzyko do akceptacji',
      classification: 'nonconforming',
      objectiveEvidence: [fx.evidenceId],
    });
    const reviewerId = uid('user');
    await addMember(fx.organizationId, fx.programId, reviewerId, 'reviewer');
    await reviewFinding(fx.organizationId, actorFor(fx.organizationId, reviewerId), finding.id, {
      decision: 'confirm',
    });

    // lead_auditor nie jest w domyślnej liście ról uprawnionych do akceptacji ryzyka.
    await expect(
      acceptResidualRisk(fx.organizationId, lead, finding.id, { note: 'Próba akceptacji bez roli' })
    ).rejects.toThrow(/Akceptacja ryzyka rezydualnego wymaga roli/);

    const ownerId = uid('user');
    await addMember(fx.organizationId, fx.programId, ownerId, 'program_owner');
    const accepted = await acceptResidualRisk(
      fx.organizationId,
      actorFor(fx.organizationId, ownerId),
      finding.id,
      {
        note: 'Program owner akceptuje ryzyko rezydualne',
      }
    );
    expect(accepted.status).toBe('risk_accepted');
  });

  it('5b. reguła decyzyjna pakietu może rozszerzyć akceptację ryzyka o dodatkową rolę', async () => {
    fx = await createFixture({ decisionRules: { riskAcceptanceRoles: ['lead_auditor'] } });
    const leadId = uid('user');
    await addMember(fx.organizationId, fx.programId, leadId, 'lead_auditor');
    const lead = actorFor(fx.organizationId, leadId);

    const finding = await createFinding(fx.organizationId, lead, {
      programId: fx.programId,
      criterionId: fx.criterionId,
      statement: 'Ryzyko do akceptacji wg reguły pakietu',
      classification: 'nonconforming',
      objectiveEvidence: [fx.evidenceId],
    });
    const reviewerId = uid('user');
    await addMember(fx.organizationId, fx.programId, reviewerId, 'reviewer');
    await reviewFinding(fx.organizationId, actorFor(fx.organizationId, reviewerId), finding.id, {
      decision: 'confirm',
    });

    // Domyślny program_owner z INNEGO fixture nie istnieje tu wcale — a mimo to
    // lead_auditor jest teraz dozwolony, bo tak mówi decisionRules pakietu.
    const accepted = await acceptResidualRisk(fx.organizationId, lead, finding.id, {
      note: 'Lead auditor akceptuje zgodnie z regułą pakietu',
    });
    expect(accepted.status).toBe('risk_accepted');
  });

  // -------------------------------------------------------------------------
  // 6. Zamknięcie ustalenia bez weryfikacji skuteczności jest odrzucane.
  // -------------------------------------------------------------------------

  it('6. nie można zamknąć ustalenia, jeśli jego działanie korygujące nie ma weryfikacji skuteczności', async () => {
    fx = await createFixture();
    const leadId = uid('user');
    const auditeeId = uid('user');
    await addMember(fx.organizationId, fx.programId, leadId, 'lead_auditor');
    await addMember(fx.organizationId, fx.programId, auditeeId, 'auditee');
    const lead = actorFor(fx.organizationId, leadId);
    const auditee = actorFor(fx.organizationId, auditeeId);

    const finding = await createFinding(fx.organizationId, lead, {
      programId: fx.programId,
      criterionId: fx.criterionId,
      statement: 'Wymaga zweryfikowanego działania przed zamknięciem',
      classification: 'nonconforming',
      objectiveEvidence: [fx.evidenceId],
    });
    const reviewerId = uid('user');
    await addMember(fx.organizationId, fx.programId, reviewerId, 'reviewer');
    await reviewFinding(fx.organizationId, actorFor(fx.organizationId, reviewerId), finding.id, {
      decision: 'confirm',
    });

    const action = await proposeAction(fx.organizationId, auditee, finding.id, {
      actionKind: 'corrective_action',
      title: 'Wdrożyć procedurę zakupową',
      ownerUserId: auditeeId,
    });
    await approveAction(fx.organizationId, lead, action.id);

    // Wykonawca DEKLARUJE wdrożenie — to celowo NIE wystarcza do zamknięcia.
    await reportImplementation(fx.organizationId, auditee, action.id, {
      evidenceId: fx.evidenceId,
      note: 'Zrobione (deklaracja wykonawcy)',
    });

    await expect(
      closeFinding(fx.organizationId, lead, finding.id, {
        note: 'Próba zamknięcia bez weryfikacji',
      })
    ).rejects.toThrow(/brakuje weryfikacji skuteczności/);

    const verification = await planVerification(fx.organizationId, lead, {
      findingId: finding.id,
      correctiveActionId: action.id,
      verificationKind: 'effectiveness',
    });
    await performVerification(fx.organizationId, lead, verification.id, {
      result: 'effective',
      evidenceId: fx.evidenceId,
    });

    const closed = await closeFinding(fx.organizationId, lead, finding.id, {
      note: 'Zamykam po potwierdzonej weryfikacji skuteczności',
    });
    expect(closed.status).toBe('closed');
  });
});
