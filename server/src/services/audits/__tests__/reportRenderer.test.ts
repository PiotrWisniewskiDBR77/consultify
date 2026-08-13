/**
 * reportRenderer.test — czysto jednostkowy (BEZ bazy). Sprawdza, że renderer
 * jest deterministyczny, że macierz traceability nie gubi żadnego ustalenia,
 * że raport bez ustaleń mówi to wprost (a nie milczy pustą sekcją), że
 * grupowania po istotności/obszarze działają, że raport realizacji poprawnie
 * liczy opóźnienia względem `asOfDate`, i że widok prezentacyjny nie gubi
 * ustaleń krytycznych.
 */
import { describe, expect, it } from 'vitest';

import type {
  AuditOutputPayload,
  OutputCorrectiveAction,
  OutputCriterionWork,
  OutputEvidenceEntry,
  OutputFinding,
  RemediationActionInput,
  RemediationVerificationInput,
} from '../reportRenderer.js';
import {
  renderAuditReport,
  renderPresentationView,
  renderRemediationProgressReport,
} from '../reportRenderer.js';

function criterion(overrides: Partial<OutputCriterionWork> = {}): OutputCriterionWork {
  return {
    id: 'crit_1',
    refCode: 'A.1',
    title: 'Kontrola dostępu',
    requirementText: 'Dostęp jest nadawany na podstawie roli',
    procedurePerformed: 'Przegląd listy uprawnień',
    sampleDescription: '10 kont',
    testPerformed: 'Porównanie z macierzą ról',
    testResult: 'fail',
    auditorNote: 'Znaleziono konto z nadmiarowym dostępem',
    auditorConclusion: 'Niezgodność potwierdzona',
    conformityStatus: 'nonconforming',
    concludedBy: 'auditor_1',
    concludedAt: '2026-08-01T10:00:00.000Z',
    ...overrides,
  };
}

function evidence(overrides: Partial<OutputEvidenceEntry> = {}): OutputEvidenceEntry {
  return {
    id: 'ev_1',
    title: 'Eksport uprawnień z AD',
    evidenceKind: 'system_export',
    criterionId: 'crit_1',
    materialId: 'mat_1',
    materialVersion: 'v3',
    contentHash: 'sha256:abc123',
    sourceSystem: 'Active Directory',
    sufficiency: 'sufficient',
    reliability: 'reliable',
    supportsConformity: false,
    ...overrides,
  };
}

function finding(overrides: Partial<OutputFinding> = {}): OutputFinding {
  return {
    id: 'find_1',
    referenceCode: 'F-001',
    statement: 'Konto serwisowe ma dostęp administracyjny bez uzasadnienia biznesowego',
    criterionId: 'crit_1',
    classification: 'nonconforming',
    severity: 'high',
    objectiveEvidence: ['ev_1'],
    contradictingEvidence: [],
    status: 'confirmed',
    rootCause: 'Brak okresowego przeglądu uprawnień',
    rootCauseConfirmed: true,
    residualRisk: 'Możliwy nieautoryzowany dostęp do danych finansowych',
    ownerUserId: 'owner_1',
    ...overrides,
  };
}

function action(overrides: Partial<OutputCorrectiveAction> = {}): OutputCorrectiveAction {
  return {
    id: 'act_1',
    findingId: 'find_1',
    actionKind: 'corrective_action',
    title: 'Wdrożyć kwartalny przegląd uprawnień',
    ownerUserId: 'owner_1',
    dueDate: '2026-09-01',
    status: 'in_progress',
    ...overrides,
  };
}

function basePayload(overrides: Partial<AuditOutputPayload> = {}): AuditOutputPayload {
  return {
    meta: {
      programId: 'prog_1',
      programName: 'Audyt kontroli dostępu Q3',
      organizationId: 'org_1',
      generatedAt: '2026-08-13T09:00:00.000Z',
      generatedBy: 'lead_1',
      packId: 'pack_1',
      packVersion: 2,
      packClassification: 'INTERNAL_FRAMEWORK',
      packSourceId: null,
      packSourceTitle: null,
    },
    scope: {
      scopeText: 'Systemy finansowe i katalog AD',
      scopeJson: { systems: ['ERP', 'AD'] },
      objectives: 'Potwierdzić zgodność zarządzania dostępem z polityką wewnętrzną',
    },
    team: [
      { id: 'mem_1', userId: 'lead_1', role: 'lead_auditor', independenceDeclared: true, assignedAt: '2026-07-01T00:00:00.000Z' },
    ],
    evidence: [evidence()],
    criteriaWork: [criterion()],
    findings: [finding()],
    systemicConclusions: [
      {
        theme: 'Brak okresowego przeglądu uprawnień',
        findingIds: ['find_1'],
        description: 'Potwierdzona przyczyna źródłowa powtarza się w 1 ustaleniach.',
      },
    ],
    managementResponses: [],
    correctiveActionPlan: [action()],
    residualRisk: [
      { findingId: 'find_1', residualRisk: 'Możliwy nieautoryzowany dostęp', acceptedBy: null, acceptedAt: null, note: null },
    ],
    verificationPlan: [
      {
        id: 'ver_1',
        correctiveActionId: 'act_1',
        findingId: 'find_1',
        verificationKind: 'effectiveness',
        method: 'resample',
        plannedDate: '2026-10-01',
        performedAt: null,
        result: null,
      },
    ],
    approvalTrail: [{ who: 'lead_1', when: '2026-08-05T00:00:00.000Z', what: 'Przegląd ustalenia find_1' }],
    provenance: { builtAt: '2026-08-13T09:00:00.000Z', builtBy: 'lead_1', sourceTables: {} },
    ...overrides,
  };
}

describe('reportRenderer — renderAuditReport', () => {
  it('jest deterministyczny — dwa wywołania na tym samym wejściu dają identyczny wynik', () => {
    const output = basePayload();
    const a = renderAuditReport(output, { generatedAt: '2026-08-13T12:00:00.000Z' });
    const b = renderAuditReport(output, { generatedAt: '2026-08-13T12:00:00.000Z' });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('macierz traceability zawiera pełny łańcuch kryterium→dowód→test→wniosek→ustalenie→działanie→weryfikację dla KAŻDEGO ustalenia', () => {
    const output = basePayload();
    const doc = renderAuditReport(output, { generatedAt: '2026-08-13T12:00:00.000Z' });
    const matrix = doc.sections.find((s) => s.id === 'traceability_matrix')!;
    const rows = matrix.content as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(output.findings.length);
    const row = rows[0];
    expect(row.criterionId).toBe('crit_1');
    expect(row.criterionRef).toBe('A.1');
    expect(row.evidenceIds).toEqual(['ev_1']);
    expect(row.testPerformed).toBe('Porównanie z macierzą ról');
    expect(row.testResult).toBe('fail');
    expect(row.auditorConclusion).toBe('Niezgodność potwierdzona');
    expect(row.findingId).toBe('find_1');
    expect(row.actionIds).toEqual(['act_1']);
    expect(row.verificationIds).toEqual(['ver_1']);
  });

  it('raport bez ustaleń renderuje uczciwy wniosek „brak niezgodności", nie pustą sekcję', () => {
    const output = basePayload({ findings: [] });
    const doc = renderAuditReport(output, { generatedAt: '2026-08-13T12:00:00.000Z' });
    const conclusion = doc.sections.find((s) => s.id === 'overall_conclusion')!;
    expect(typeof conclusion.content).toBe('string');
    expect(String(conclusion.content).length).toBeGreaterThan(0);
    expect(String(conclusion.content)).toMatch(/nie zidentyfikował żadnych niezgodności/i);
    // Macierz traceability jest pusta (brak ustaleń), ale to jawna pusta tablica, nie undefined.
    const matrix = doc.sections.find((s) => s.id === 'traceability_matrix')!;
    expect(matrix.content).toEqual([]);
  });

  it('raport z ustaleniami podaje w konkluzji liczbę i istotność ustaleń', () => {
    const output = basePayload();
    const doc = renderAuditReport(output, { generatedAt: '2026-08-13T12:00:00.000Z' });
    const conclusion = String(doc.sections.find((s) => s.id === 'overall_conclusion')!.content);
    expect(conclusion).toMatch(/1 ustaleń/);
    expect(conclusion).toMatch(/wysoka/);
  });

  it('ustalenia grupują się po istotności', () => {
    const output = basePayload({
      findings: [finding({ id: 'find_1', severity: 'critical' }), finding({ id: 'find_2', severity: 'low' })],
    });
    const doc = renderAuditReport(output, { generatedAt: '2026-08-13T12:00:00.000Z' });
    const bySeverity = doc.sections.find((s) => s.id === 'findings_by_severity')!;
    const groups = bySeverity.content as Array<{ key: string; items: unknown[] }>;
    const keys = groups.map((g) => g.key);
    expect(keys).toContain('critical');
    expect(keys).toContain('low');
    // critical (wyższa ranga) musi wystąpić przed low w deterministycznym porządku.
    expect(keys.indexOf('critical')).toBeLessThan(keys.indexOf('low'));
  });

  it('ustalenia grupują się po obszarze/procesie (tytule kryterium)', () => {
    const output = basePayload({
      criteriaWork: [criterion({ id: 'crit_1', title: 'Kontrola dostępu' }), criterion({ id: 'crit_2', title: 'Backup' })],
      findings: [
        finding({ id: 'find_1', criterionId: 'crit_1' }),
        finding({ id: 'find_2', criterionId: 'crit_2', objectiveEvidence: [] }),
      ],
    });
    const doc = renderAuditReport(output, { generatedAt: '2026-08-13T12:00:00.000Z' });
    const byArea = doc.sections.find((s) => s.id === 'findings_by_area')!;
    const groups = byArea.content as Array<{ key: string; items: unknown[] }>;
    const keys = groups.map((g) => g.key);
    expect(keys).toContain('Kontrola dostępu');
    expect(keys).toContain('Backup');
  });

  it('ustalenie bez przypisanego kryterium trafia do jawnej grupy „Bez przypisanego obszaru"', () => {
    const output = basePayload({ findings: [finding({ criterionId: null, objectiveEvidence: [] })] });
    const doc = renderAuditReport(output, { generatedAt: '2026-08-13T12:00:00.000Z' });
    const byArea = doc.sections.find((s) => s.id === 'findings_by_area')!;
    const groups = byArea.content as Array<{ key: string }>;
    expect(groups.map((g) => g.key)).toContain('Bez przypisanego obszaru');
  });
});

describe('reportRenderer — renderRemediationProgressReport', () => {
  const baseActions: RemediationActionInput[] = [
    {
      id: 'act_due_past',
      findingId: 'find_1',
      title: 'Działanie po terminie',
      actionKind: 'corrective_action',
      ownerUserId: 'owner_1',
      dueDate: '2026-01-01',
      status: 'in_progress',
      implementationEvidenceId: null,
      implementedAt: null,
    },
    {
      id: 'act_due_future',
      findingId: 'find_2',
      title: 'Działanie w terminie',
      actionKind: 'corrective_action',
      ownerUserId: 'owner_2',
      dueDate: '2026-12-01',
      status: 'in_progress',
      implementationEvidenceId: null,
      implementedAt: null,
    },
    {
      id: 'act_done',
      findingId: 'find_3',
      title: 'Działanie zakończone',
      actionKind: 'correction',
      ownerUserId: 'owner_3',
      dueDate: '2026-01-01',
      status: 'implemented',
      implementationEvidenceId: 'ev_done',
      implementedAt: '2026-02-01T00:00:00.000Z',
    },
  ];
  const verifications: RemediationVerificationInput[] = [
    {
      id: 'ver_1',
      correctiveActionId: 'act_done',
      findingId: 'find_3',
      verificationKind: 'effectiveness',
      result: 'effective',
      performedAt: '2026-03-01T00:00:00.000Z',
      plannedDate: '2026-02-15',
    },
  ];

  it('poprawnie liczy opóźnienia względem asOfDate — tylko przeterminowane i niedokończone są „delayed"', () => {
    const output = basePayload();
    const doc = renderRemediationProgressReport(output, baseActions, verifications, '2026-06-01');
    const summary = doc.sections.find((s) => s.id === 'progress_summary')!.content as Record<string, unknown>;
    expect(summary.delayedCount).toBe(1);

    const delayedGroup = doc.sections.find((s) => s.id === 'delayed_rejected_reopened')!.content as {
      delayed: Array<{ id: string }>;
    };
    expect(delayedGroup.delayed.map((a) => a.id)).toEqual(['act_due_past']);
  });

  it('przy wcześniejszym asOfDate (przed żadnym terminem) nic nie jest jeszcze opóźnione', () => {
    const output = basePayload();
    const doc = renderRemediationProgressReport(output, baseActions, verifications, '2025-06-01');
    const summary = doc.sections.find((s) => s.id === 'progress_summary')!.content as Record<string, unknown>;
    expect(summary.delayedCount).toBe(0);
  });

  it('jest deterministyczny na tym samym wejściu', () => {
    const output = basePayload();
    const a = renderRemediationProgressReport(output, baseActions, verifications, '2026-06-01');
    const b = renderRemediationProgressReport(output, baseActions, verifications, '2026-06-01');
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('zapisuje asOfDate na dokumencie, nie czyta zegara systemowego', () => {
    const output = basePayload();
    const doc = renderRemediationProgressReport(output, baseActions, verifications, '2026-06-01');
    expect(doc.asOfDate).toBe('2026-06-01');
    expect(doc.generatedAt).toBeNull();
  });
});

describe('reportRenderer — renderPresentationView', () => {
  it('nie gubi ustaleń krytycznych — sekcja dedykowana wylicza je wszystkie', () => {
    const output = basePayload({
      findings: [
        finding({ id: 'find_crit_1', severity: 'critical' }),
        finding({ id: 'find_crit_2', severity: 'critical', objectiveEvidence: [] }),
        finding({ id: 'find_low', severity: 'low', objectiveEvidence: [] }),
      ],
    });
    const doc = renderPresentationView(output);
    const critical = doc.sections.find((s) => s.id === 'critical_findings')!.content as Array<{ id: string }>;
    expect(critical.map((f) => f.id).sort()).toEqual(['find_crit_1', 'find_crit_2']);
  });

  it('jest deterministyczny na tym samym wejściu', () => {
    const output = basePayload();
    const a = renderPresentationView(output);
    const b = renderPresentationView(output);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
