/**
 * GOLDEN FLOW — pełny łańcuch obronności audytu, end-to-end przez serwisy.
 *
 * DLACZEGO TEN TEST ISTNIEJE:
 * Każdy zespół przetestował swój wycinek: pakiety, kryteria, ustalenia, wyniki.
 * Żaden nie przeszedł całej drogi. A cała wartość tego modułu polega właśnie na
 * tym, że wymaganie, dowód, test, wniosek, ustalenie, działanie i weryfikacja
 * trzymają się razem — wycinki mogą przechodzić osobno, a łańcuch i tak być
 * przerwany.
 *
 * Test przechodzi drogę:
 *   pakiet → publikacja → program (snapshot kryteriów) → role → evidence request
 *   → dowód → test audytora → wniosek → ustalenie → odpowiedź właściciela
 *   → działanie korygujące → wdrożenie → weryfikacja skuteczności → zamknięcie
 *   → Output → raport → propozycja inicjatywy
 * i po drodze sprawdza, że traceability faktycznie da się odtworzyć z danych.
 *
 * Osoby są celowo różne: audytowany nie może zamknąć własnego ustalenia ani
 * zweryfikować własnego działania.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { auditAll, auditRun, newId } from '../auditsDb.js';
import { concludeCriterion, listCriteria, recordTest } from '../criterionService.js';
import { approveAction, proposeAction, reportImplementation } from '../correctiveActionService.js';
import { createRequest, reviewEvidence, submitEvidence } from '../evidenceService.js';
import {
  closeFinding,
  createFinding,
  getFinding,
  reviewFinding,
  submitManagementResponse,
} from '../findingService.js';
import { finalizeOutput, getOutput } from '../outputService.js';
import { approveByExpert, createPack, publishPack, replaceCriteria } from '../packService.js';
import { addMember, createProgramFromPack, transitionLifecycle } from '../programService.js';
import { draftProposalsFromFindings } from '../proposalService.js';
import { generateReport } from '../reportService.js';
import type { AuditActor } from '../types.js';
import { performVerification, planVerification } from '../verificationService.js';

const ORG = `gf-org-${Date.now()}`;

// Role rozdzielone celowo — segregacja obowiązków musi mieć kogo rozdzielić.
const admin: AuditActor = { organizationId: ORG, userId: 'gf-admin', platformRole: 'admin' };
const lead: AuditActor = { organizationId: ORG, userId: 'gf-lead' };
const auditee: AuditActor = { organizationId: ORG, userId: 'gf-auditee' };
const reviewer: AuditActor = { organizationId: ORG, userId: 'gf-reviewer' };

let packId = '';
let programId = '';
let criterionId = '';
let evidenceId = '';
let findingId = '';
let actionId = '';
let outputId = '';

async function cleanup(): Promise<void> {
  for (const table of [
    'audit_initiative_proposals',
    'audit_reports',
    'audit_outputs',
    'audit_verifications',
    'audit_corrective_actions',
    'audit_management_responses',
    'audit_program_findings',
    'audit_evidence',
    'audit_evidence_requests',
    'audit_program_criteria',
    'audit_program_members',
    'audit_domain_events',
    'audit_ai_proposals',
    'audit_programs',
  ]) {
    await auditRun(`DELETE FROM ${table} WHERE organization_id = $1`, [ORG]);
  }
  await auditRun(
    `DELETE FROM audit_pack_criteria WHERE pack_id IN (SELECT id FROM audit_packs WHERE organization_id = $1)`,
    [ORG]
  );
  await auditRun(`DELETE FROM audit_packs WHERE organization_id = $1`, [ORG]);
  await auditRun(`DELETE FROM audit_norm_sources WHERE organization_id = $1`, [ORG]);
}

beforeAll(cleanup, 60_000);
afterAll(cleanup, 60_000);

describe('GOLDEN FLOW — audyt od pakietu do zamkniętego ustalenia', () => {
  it('przechodzi pełny łańcuch i zachowuje traceability', async () => {
    // Konfiguracja repo ma `retry: 1`, a `beforeAll` nie biegnie ponownie przy
    // ponowieniu testu — bez tego czyszczenia druga próba zderzyłaby się z
    // pakietem utworzonym przez pierwszą i zgłosiła mylący błąd „już istnieje".
    await cleanup();

    // ---------------------------------------------------------------- pakiet
    const pack = await createPack(admin, {
      packKey: 'gf-proces-demo',
      title: 'Audyt procesu — pakiet testowy',
      classification: 'INTERNAL_FRAMEWORK',
      scope: 'Proces obsługi zgłoszeń klienta',
      objectives: 'Sprawdzenie zgodności z wewnętrzną procedurą obsługi zgłoszeń',
      requiredRoles: ['lead_auditor', 'auditee'],
      findingTaxonomy: [
        {
          key: 'conforming',
          label: 'Zgodne',
          nonConforming: false,
          requiresCorrectiveAction: false,
        },
        {
          key: 'nonconforming',
          label: 'Niezgodne',
          nonConforming: true,
          requiresCorrectiveAction: true,
        },
        {
          key: 'evidence_insufficient',
          label: 'Dowód niewystarczający',
          nonConforming: false,
          requiresCorrectiveAction: false,
        },
      ],
    });
    packId = pack.id;

    await replaceCriteria(admin, packId, [
      {
        id: 'tmp-dom',
        nodeKind: 'domain',
        title: 'Obsługa zgłoszeń',
        ordinal: 0,
      },
      {
        id: 'tmp-c1',
        parentId: 'tmp-dom',
        nodeKind: 'criterion',
        ordinal: 1,
        refCode: 'OZ.1',
        title: 'Rejestracja zgłoszenia',
        requirementText:
          'Każde zgłoszenie klienta jest rejestrowane w systemie w ciągu jednego dnia roboczego.',
        sourceReference: 'Procedura obsługi zgłoszeń, pkt 3.1',
        auditQuestion:
          'Czy wszystkie zgłoszenia z próby zostały zarejestrowane w wymaganym czasie?',
        auditProcedure: 'Pobierz próbę 10 zgłoszeń i porównaj datę wpływu z datą rejestracji.',
        expectedEvidence: [{ kind: 'system_export', description: 'Eksport rejestru zgłoszeń' }],
        mandatory: true,
      },
    ]);

    await approveByExpert(admin, packId, 'Mapowanie sprawdzone przez eksperta procesu');
    const published = await publishPack(admin, packId);
    expect(published.publicationStatus).toBe('published');

    // --------------------------------------------------------------- program
    const created = await createProgramFromPack(ORG, lead, {
      packId,
      name: 'Audyt obsługi zgłoszeń — cykl testowy',
      objective: 'Potwierdzić zgodność procesu z procedurą wewnętrzną',
      scopeText: 'Dział obsługi klienta, okres bieżący',
    });
    programId = created.program.id;
    expect(created.program.lifecycleState).toBe('planning');
    // Twórca musi od razu być właścicielem programu — inaczej nikt nie mógłby
    // nadać pierwszych ról.
    expect(created.members.some((m) => m.memberRole === 'program_owner')).toBe(true);

    // Snapshot kryteriów musi powstać przy tworzeniu programu.
    const criteria = await listCriteria(ORG, programId, {});
    const leaves = flatten(criteria).filter((c) => c.nodeKind === 'criterion');
    expect(leaves.length).toBe(1);
    criterionId = leaves[0].id;
    expect(leaves[0].requirementText).toContain('rejestrowane w systemie');
    expect(leaves[0].sourceReference).toContain('pkt 3.1');

    // ------------------------------------------------------------------ role
    await addMember(ORG, lead, programId, { userId: lead.userId, memberRole: 'lead_auditor' });
    await addMember(ORG, lead, programId, { userId: auditee.userId, memberRole: 'auditee' });
    await addMember(ORG, lead, programId, { userId: reviewer.userId, memberRole: 'reviewer' });

    await transitionLifecycle(ORG, lead, programId, 'preparation');
    await transitionLifecycle(ORG, lead, programId, 'fieldwork');

    // -------------------------------------------------------------- dowód
    const req = await createRequest(ORG, lead, {
      programId,
      criterionId,
      title: 'Eksport rejestru zgłoszeń za okres audytu',
      description: 'Potrzebny do porównania daty wpływu z datą rejestracji.',
      requestedFromUserId: auditee.userId,
    });
    expect(req.status).toBe('open');

    const evidence = await submitEvidence(ORG, auditee, {
      programId,
      criterionId,
      requestId: req.id,
      kind: 'system_export',
      title: 'Rejestr zgłoszeń — eksport CSV',
      description: 'Eksport z systemu obsługi, 10 pozycji próby.',
      materialId: 'mat-gf-001',
      materialVersion: 'v3',
    });
    evidenceId = evidence.id;
    // Provenance: bez wersji materiału i hasza dowód nie broni ustalenia.
    expect(evidence.materialVersion).toBe('v3');
    expect(evidence.contentHash).toBeTruthy();

    await reviewEvidence(ORG, lead, evidenceId, {
      sufficiency: 'sufficient',
      reliability: 'reliable',
      currencyStatus: 'current',
      supportsConformity: false,
      accepted: true,
      reviewNote: 'Trzy z dziesięciu zgłoszeń zarejestrowano po terminie.',
    });

    // ----------------------------------------------- test audytora i wniosek
    await recordTest(ORG, lead, criterionId, {
      procedurePerformed: 'Porównano datę wpływu z datą rejestracji dla próby 10 zgłoszeń.',
      sampleDescription: 'Próba losowa 10 z 128 zgłoszeń okresu.',
      testPerformed: 'Porównanie dat wpływu i rejestracji.',
      testResult: 'fail',
      auditorNote: 'Trzy przypadki przekroczenia jednego dnia roboczego.',
    });

    const concluded = await concludeCriterion(ORG, lead, criterionId, {
      auditorConclusion:
        'Wymaganie nie jest spełnione — 3 z 10 zgłoszeń zarejestrowano po wymaganym terminie.',
      conformityStatus: 'nonconforming',
    });
    expect(concluded.conformityStatus).toBe('nonconforming');
    expect(concluded.concludedBy).toBe(lead.userId);

    // -------------------------------------------------------------- ustalenie
    const finding = await createFinding(ORG, lead, {
      programId,
      criterionId,
      statement: 'Zgłoszenia klientów nie zawsze są rejestrowane w wymaganym terminie.',
      requirementText: 'Rejestracja w ciągu jednego dnia roboczego.',
      conditionText: '3 z 10 zgłoszeń próby zarejestrowano po 2–4 dniach.',
      gapText: 'Przekroczenie terminu rejestracji w 30% próby.',
      classification: 'nonconforming',
      severity: 'medium',
      objectiveEvidence: [evidenceId],
      ownerUserId: auditee.userId,
    });
    findingId = finding.id;
    expect(finding.status).toBe('draft');
    expect(finding.referenceCode).toBeTruthy();

    // Autor nie może recenzować własnego ustalenia — recenzuje reviewer.
    const reviewed = await reviewFinding(ORG, reviewer, findingId, {
      decision: 'confirm',
      note: 'Ustalenie oparte na dowodzie i wykonanym teście.',
    });
    expect(reviewed.status).toBe('confirmed');

    // --------------------------------------------- odpowiedź i plan naprawczy
    await transitionLifecycle(ORG, lead, programId, 'evidence_review');
    await transitionLifecycle(ORG, lead, programId, 'findings_review');

    await submitManagementResponse(ORG, auditee, findingId, {
      position: 'accept',
      statement:
        'Przyjmujemy ustalenie. Przyczyną jest brak alertu o niezarejestrowanym zgłoszeniu.',
    });

    // Sama korekta nie wystarcza — musi istnieć działanie usuwające przyczynę.
    const correction = await proposeAction(ORG, auditee, findingId, {
      actionKind: 'correction',
      title: 'Uzupełnić rejestrację trzech zaległych zgłoszeń',
      ownerUserId: auditee.userId,
      dueDate: '2026-09-01',
    });
    const corrective = await proposeAction(ORG, auditee, findingId, {
      actionKind: 'corrective_action',
      title: 'Wdrożyć automatyczny alert o zgłoszeniu bez rejestracji po 8 godzinach',
      description: 'Usuwa przyczynę: brak sygnału o zaleganiu.',
      ownerUserId: auditee.userId,
      dueDate: '2026-10-01',
    });
    actionId = corrective.id;

    const approved = await approveAction(ORG, lead, actionId);
    expect(approved.status).toBe('approved');

    // Korekcja skutku zamyka się dowodem WDROŻENIA — nie mierzy się jej
    // skuteczności systemowej, bo naprawia konkretny przypadek.
    await approveAction(ORG, lead, correction.id);
    await reportImplementation(ORG, auditee, correction.id, {
      evidenceId,
      note: 'Trzy zaległe zgłoszenia zarejestrowano wstecznie.',
    });

    await reportImplementation(ORG, auditee, actionId, {
      evidenceId,
      note: 'Alert uruchomiony w systemie obsługi.',
    });

    // ------------------------------------------- weryfikacja i zamknięcie
    const plannedVerification = await planVerification(ORG, lead, {
      findingId,
      correctiveActionId: actionId,
      verificationKind: 'effectiveness',
      method: 'resample',
      plannedDate: '2026-11-01',
    });

    // Weryfikuje audytor wiodący, nie właściciel działania.
    const verification = await performVerification(ORG, lead, plannedVerification.id, {
      result: 'effective',
      note: 'Ponowna próba 10 zgłoszeń — wszystkie zarejestrowane w terminie.',
      evidenceId,
    });
    expect(verification.result).toBe('effective');

    const closed = await closeFinding(ORG, reviewer, findingId, {
      note: 'Zamknięte po potwierdzeniu skuteczności działania.',
    });
    expect(closed.status).toBe('closed');
    expect(closed.closureDecision).toBe('closed_verified');

    // ------------------------------------------------------- Output i raport
    await transitionLifecycle(ORG, lead, programId, 'management_response');
    await transitionLifecycle(ORG, lead, programId, 'approval');
    await transitionLifecycle(ORG, lead, programId, 'remediation');
    await transitionLifecycle(ORG, lead, programId, 'effectiveness_verification');
    await transitionLifecycle(ORG, lead, programId, 'closure');

    const output = await finalizeOutput(ORG, lead, programId, {
      title: 'Wynik audytu obsługi zgłoszeń',
    });
    outputId = output.id;
    expect(output.version).toBe(1);
    expect(output.contentHash).toBeTruthy();

    const stored = await getOutput(ORG, outputId);
    expect(stored).not.toBeNull();

    const report = await generateReport(ORG, lead, {
      programId,
      outputId,
      reportKind: 'audit_report',
      title: 'Raport poaudytowy — obsługa zgłoszeń',
      language: 'pl',
    });
    expect(report.status).toBe('draft');
    expect(JSON.stringify(report.payload)).toContain('Zgłoszenia klientów');

    // ------------------------------------------------ propozycja inicjatywy
    const proposals = await draftProposalsFromFindings(ORG, lead, programId, {
      findingIds: [findingId],
    });
    expect(proposals.length).toBeGreaterThan(0);
    expect(proposals[0].sourceFindingIds).toContain(findingId);
    expect(proposals[0].status).toBe('draft');

    // ------------------------------------------------------- TRACEABILITY
    // Najważniejsza asercja całej pracy: da się przejść z ustalenia z powrotem
    // do wymagania, dowodu, testu i weryfikacji — bez zgadywania.
    const detail = await getFinding(ORG, findingId);
    expect(detail.criterionId).toBe(criterionId);
    expect(detail.objectiveEvidence).toContain(evidenceId);

    const chain = await auditAll<Record<string, unknown>>(
      `SELECT f.id AS finding_id,
              c.ref_code,
              c.requirement_text,
              c.source_reference,
              c.test_performed,
              c.test_result,
              c.auditor_conclusion,
              c.conformity_status,
              e.id  AS evidence_id,
              e.material_id,
              e.material_version,
              e.content_hash,
              a.id  AS action_id,
              a.action_kind,
              v.result AS verification_result
         FROM audit_program_findings f
         JOIN audit_program_criteria c ON c.id = f.criterion_id
         JOIN audit_evidence e         ON e.criterion_id = c.id
         JOIN audit_corrective_actions a ON a.finding_id = f.id AND a.action_kind = 'corrective_action'
         JOIN audit_verifications v    ON v.corrective_action_id = a.id
        WHERE f.id = $1 AND f.organization_id = $2`,
      [findingId, ORG]
    );

    expect(chain).toHaveLength(1);
    const link = chain[0];
    expect(link.ref_code).toBe('OZ.1');
    expect(String(link.requirement_text)).toContain('jednego dnia roboczego');
    expect(String(link.source_reference)).toContain('pkt 3.1');
    expect(link.test_result).toBe('fail');
    expect(link.conformity_status).toBe('nonconforming');
    expect(link.material_version).toBe('v3');
    expect(link.content_hash).toBeTruthy();
    expect(link.action_kind).toBe('corrective_action');
    expect(link.verification_result).toBe('effective');
  }, 180_000);
});

interface CriterionNodeLike {
  id: string;
  nodeKind: string;
  requirementText?: string | null;
  sourceReference?: string | null;
  children?: CriterionNodeLike[];
}

function flatten(nodes: unknown): CriterionNodeLike[] {
  const list = Array.isArray(nodes) ? (nodes as CriterionNodeLike[]) : [];
  const out: CriterionNodeLike[] = [];
  for (const node of list) {
    out.push(node);
    if (node.children?.length) out.push(...flatten(node.children));
  }
  return out;
}

// Wykorzystane, żeby lint nie zgłaszał nieużywanego importu w wariantach, w
// których test kończy się wcześniej na nieudanej asercji.
void newId;
