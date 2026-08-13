/**
 * reportRenderer — deterministyczny renderer raportów zbudowany WYŁĄCZNIE nad
 * Outputem.
 *
 * TWARDA GRANICA: ten plik nie wykonuje zapytań do bazy, nie wywołuje AI i nie
 * czyta zegara systemowego (`Date.now()` / `new Date()` bez argumentu) ani
 * `Math.random()`. Każda funkcja renderująca jest czystą transformacją:
 * to samo wejście → identyczny wynik, zawsze — dlatego datę „teraz" zawsze
 * dostarcza wołający (options.generatedAt / asOfDate), nigdy renderer sam.
 * Raport jest deterministycznym rendererem Outputu, nigdy zrzutem ekranu.
 *
 * Ten plik definiuje też `AuditOutputPayload` — kontrakt struktury, który
 * `outputService.finalizeOutput()` musi wypełnić. Kontrakt mieszka tutaj, bo
 * renderer jest jego jedynym konsumentem strukturalnym; outputService go
 * tylko implementuje (import type, bez zależności od bazy w drugą stronę).
 */

import type {
  ActionKind,
  ActionStatus,
  ConformityStatus,
  FindingSeverity,
  ResponsePosition,
  VerificationKind,
  VerificationResult,
} from './types.js';
import { FINDING_SEVERITIES } from './types.js';

// ---------------------------------------------------------------------------
// Kontrakt Outputu (payload) — konsumowany przez wszystkie funkcje poniżej
// ---------------------------------------------------------------------------

export interface OutputTeamMember {
  id: string;
  userId: string;
  role: string;
  independenceDeclared: boolean;
  assignedAt: string | null;
}

export interface OutputEvidenceEntry {
  id: string;
  title: string;
  evidenceKind: string;
  criterionId: string | null;
  materialId: string | null;
  materialVersion: string | null;
  contentHash: string | null;
  sourceSystem: string | null;
  sufficiency: string | null;
  reliability: string | null;
  supportsConformity: boolean | null;
}

export interface OutputCriterionWork {
  id: string;
  refCode: string | null;
  title: string;
  requirementText: string | null;
  procedurePerformed: string | null;
  sampleDescription: string | null;
  testPerformed: string | null;
  testResult: string | null;
  auditorNote: string | null;
  auditorConclusion: string | null;
  conformityStatus: ConformityStatus;
  concludedBy: string | null;
  concludedAt: string | null;
}

export interface OutputFinding {
  id: string;
  referenceCode: string | null;
  statement: string;
  criterionId: string | null;
  classification: string;
  severity: FindingSeverity | null;
  objectiveEvidence: string[];
  contradictingEvidence: string[];
  status: string;
  rootCause: string | null;
  rootCauseConfirmed: boolean;
  residualRisk: string | null;
  ownerUserId: string | null;
}

export interface OutputManagementResponse {
  id: string;
  findingId: string;
  position: ResponsePosition;
  statement: string;
  respondedBy: string | null;
  respondedAt: string | null;
  status: string;
}

export interface OutputCorrectiveAction {
  id: string;
  findingId: string;
  actionKind: ActionKind;
  title: string;
  ownerUserId: string | null;
  dueDate: string | null;
  status: ActionStatus;
}

export interface OutputResidualRisk {
  findingId: string;
  residualRisk: string | null;
  acceptedBy: string | null;
  acceptedAt: string | null;
  note: string | null;
}

export interface OutputVerificationPlanEntry {
  id: string;
  correctiveActionId: string | null;
  findingId: string;
  verificationKind: VerificationKind;
  method: string | null;
  plannedDate: string | null;
  performedAt: string | null;
  result: VerificationResult | null;
}

export interface OutputApprovalTrailEntry {
  who: string | null;
  when: string | null;
  what: string;
}

export interface OutputSystemicConclusion {
  theme: string;
  findingIds: string[];
  description: string;
}

export interface AuditOutputPayload {
  meta: {
    programId: string;
    programName: string;
    organizationId: string;
    generatedAt: string;
    generatedBy: string | null;
    packId: string | null;
    packVersion: number | null;
    packClassification: string | null;
    packSourceId: string | null;
    packSourceTitle: string | null;
  };
  scope: {
    scopeText: string | null;
    scopeJson: Record<string, unknown> | null;
    objectives: string | null;
  };
  team: OutputTeamMember[];
  evidence: OutputEvidenceEntry[];
  criteriaWork: OutputCriterionWork[];
  findings: OutputFinding[];
  systemicConclusions: OutputSystemicConclusion[];
  managementResponses: OutputManagementResponse[];
  correctiveActionPlan: OutputCorrectiveAction[];
  residualRisk: OutputResidualRisk[];
  verificationPlan: OutputVerificationPlanEntry[];
  approvalTrail: OutputApprovalTrailEntry[];
  provenance: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Dokument raportu — struktura danych, NIE HTML/PDF
// ---------------------------------------------------------------------------

export type ReportSectionKind = 'text' | 'list' | 'table' | 'keyValue' | 'group';

export interface ReportSection<T = unknown> {
  id: string;
  title: string;
  kind: ReportSectionKind;
  content: T;
}

export type AuditReportKind = 'audit_report' | 'remediation_progress' | 'presentation';

export interface AuditReportDocument {
  reportKind: AuditReportKind;
  /** Wstrzyknięte przez wołającego. `null` gdy renderer nie zależy od daty (np. widok prezentacyjny). */
  generatedAt: string | null;
  /** Tylko dla raportów typu snapshot-na-datę (remediation_progress). */
  asOfDate?: string | null;
  sections: ReportSection[];
}

// ---------------------------------------------------------------------------
// Pomocnicze — czyste, bez zależności zewnętrznych
// ---------------------------------------------------------------------------

const SEVERITY_LABELS: Record<FindingSeverity, string> = {
  informational: 'informacyjne',
  low: 'niska',
  medium: 'średnia',
  high: 'wysoka',
  critical: 'krytyczna',
};

function severityLabel(severity: string | null): string {
  if (severity && severity in SEVERITY_LABELS) {
    return SEVERITY_LABELS[severity as FindingSeverity];
  }
  return 'nieokreślona';
}

function severityRank(severity: string | null): number {
  const idx = severity ? FINDING_SEVERITIES.indexOf(severity as FindingSeverity) : -1;
  return idx === -1 ? -1 : idx;
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return map;
}

/** Zamienia grupę na tablicę {key, items}, posortowaną deterministycznie po kluczu. */
function groupEntries<T>(
  map: Map<string, T[]>,
  order?: (key: string) => number,
): Array<{ key: string; items: T[] }> {
  const entries = Array.from(map.entries()).map(([key, items]) => ({ key, items }));
  entries.sort((a, b) => {
    if (order) {
      const ra = order(a.key);
      const rb = order(b.key);
      if (ra !== rb) return rb - ra; // wyższy rangą (np. critical) pierwszy
    }
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  });
  return entries;
}

function resolveAreaForFinding(output: AuditOutputPayload, finding: OutputFinding): string {
  if (!finding.criterionId) return 'Bez przypisanego obszaru';
  const criterion = output.criteriaWork.find((c) => c.id === finding.criterionId);
  return criterion?.title || 'Bez przypisanego obszaru';
}

function countBySeverity(findings: OutputFinding[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const f of findings) {
    const key = f.severity ?? 'unclassified';
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function buildOverallConclusion(output: AuditOutputPayload): string {
  const total = output.findings.length;
  if (total === 0) {
    return (
      'Audyt nie zidentyfikował żadnych niezgodności w zbadanym zakresie — wszystkie ' +
      'zbadane kryteria zostały ocenione jako zgodne lub niedotyczące.'
    );
  }
  const counts = countBySeverity(output.findings);
  const parts = FINDING_SEVERITIES.slice()
    .reverse()
    .map((sev) => (counts[sev] ? `${counts[sev]} o istotności ${severityLabel(sev)}` : null))
    .filter((x): x is string => Boolean(x));
  if (counts.unclassified) {
    parts.push(`${counts.unclassified} bez określonej istotności`);
  }
  return `Audyt zidentyfikował ${total} ustaleń: ${parts.join(', ')}.`;
}

function buildMethodology(output: AuditOutputPayload): string {
  const teamSize = output.team.length;
  const packInfo = output.meta.packId
    ? `pakiet audytowy (klasyfikacja: ${output.meta.packClassification ?? 'nieznana'}${
        output.meta.packSourceTitle ? `, źródło: ${output.meta.packSourceTitle}` : ''
      })`
    : 'pakiet audytowy niewskazany';
  const criteriaCount = output.criteriaWork.length;
  return (
    `Audyt wykonano wg ${packInfo}, obejmując ${criteriaCount} kryteriów. ` +
    `Zespół audytowy liczył ${teamSize} ${teamSize === 1 ? 'osobę' : 'osoby/osób'}.`
  );
}

function buildLimitations(output: AuditOutputPayload): string[] {
  const limitations: string[] = [];
  const insufficientEvidence = output.evidence.filter((e) => e.sufficiency === 'insufficient');
  if (insufficientEvidence.length > 0) {
    limitations.push(
      `${insufficientEvidence.length} dowodów oceniono jako niewystarczające do pełnego potwierdzenia wniosku.`,
    );
  }
  const questionable = output.evidence.filter((e) => e.reliability === 'questionable');
  if (questionable.length > 0) {
    limitations.push(`${questionable.length} dowodów ma zastrzeżoną wiarygodność.`);
  }
  const insufficientCriteria = output.criteriaWork.filter(
    (c) => c.conformityStatus === 'evidence_insufficient',
  );
  if (insufficientCriteria.length > 0) {
    limitations.push(
      `${insufficientCriteria.length} kryteriów pozostaje bez rozstrzygnięcia z powodu niewystarczających dowodów.`,
    );
  }
  if (limitations.length === 0) {
    limitations.push('Nie zidentyfikowano istotnych ograniczeń zakresu ani dostępu do dowodów.');
  }
  return limitations;
}

function buildEvidenceReferences(
  output: AuditOutputPayload,
): Array<{ findingId: string; evidenceIds: string[]; evidenceTitles: string[] }> {
  const evidenceById = new Map(output.evidence.map((e) => [e.id, e]));
  return output.findings.map((f) => {
    const entries = f.objectiveEvidence.map((id) => evidenceById.get(id)).filter(Boolean) as OutputEvidenceEntry[];
    return {
      findingId: f.id,
      evidenceIds: entries.map((e) => e.id),
      evidenceTitles: entries.map((e) => e.title),
    };
  });
}

interface TraceabilityRow {
  id: string;
  criterionId: string | null;
  criterionRef: string | null;
  criterionTitle: string | null;
  evidenceIds: string[];
  evidenceTitles: string[];
  testPerformed: string | null;
  testResult: string | null;
  auditorConclusion: string | null;
  findingId: string;
  findingStatement: string;
  actionIds: string[];
  actionTitles: string[];
  verificationIds: string[];
  verificationResults: Array<string | null>;
}

/**
 * Macierz traceability: kryterium → dowód → test → wniosek → ustalenie →
 * działanie → weryfikacja. Zakotwiczona na USTALENIACH (nie na kryteriach),
 * żeby gwarantować, że KAŻDE ustalenie ma pełny, sprawdzalny łańcuch — o to
 * właśnie pyta test determinizmu/kompletności macierzy.
 */
function buildTraceabilityMatrix(output: AuditOutputPayload): TraceabilityRow[] {
  const criterionById = new Map(output.criteriaWork.map((c) => [c.id, c]));
  const evidenceById = new Map(output.evidence.map((e) => [e.id, e]));

  return output.findings.map((f) => {
    const criterion = f.criterionId ? criterionById.get(f.criterionId) ?? null : null;
    const evidenceEntries = f.objectiveEvidence
      .map((id) => evidenceById.get(id))
      .filter(Boolean) as OutputEvidenceEntry[];
    const actions = output.correctiveActionPlan.filter((a) => a.findingId === f.id);
    const actionIds = new Set(actions.map((a) => a.id));
    const verifications = output.verificationPlan.filter(
      (v) => v.findingId === f.id || (v.correctiveActionId && actionIds.has(v.correctiveActionId)),
    );

    return {
      id: `trace_${f.id}`,
      criterionId: f.criterionId,
      criterionRef: criterion?.refCode ?? null,
      criterionTitle: criterion?.title ?? null,
      evidenceIds: evidenceEntries.map((e) => e.id),
      evidenceTitles: evidenceEntries.map((e) => e.title),
      testPerformed: criterion?.testPerformed ?? null,
      testResult: criterion?.testResult ?? null,
      auditorConclusion: criterion?.auditorConclusion ?? null,
      findingId: f.id,
      findingStatement: f.statement,
      actionIds: actions.map((a) => a.id),
      actionTitles: actions.map((a) => a.title),
      verificationIds: verifications.map((v) => v.id),
      verificationResults: verifications.map((v) => v.result),
    };
  });
}

// ---------------------------------------------------------------------------
// A. Raport poaudytowy
// ---------------------------------------------------------------------------

export interface RenderAuditReportOptions {
  /** Data wygenerowania — wstrzykiwana przez wołającego, renderer nigdy nie czyta zegara. */
  generatedAt: string;
  title?: string;
}

export function renderAuditReport(
  output: AuditOutputPayload,
  options: RenderAuditReportOptions,
): AuditReportDocument {
  const bySeverity = groupBy(output.findings, (f) => f.severity ?? 'unclassified');
  const byArea = groupBy(output.findings, (f) => resolveAreaForFinding(output, f));

  const sections: ReportSection[] = [
    {
      id: 'executive_summary',
      title: 'Streszczenie zarządcze',
      kind: 'text',
      content: `${buildOverallConclusion(output)} ${buildMethodology(output)}`,
    },
    {
      id: 'scope',
      title: 'Zakres i cele',
      kind: 'keyValue',
      content: {
        scopeText: output.scope.scopeText,
        scopeJson: output.scope.scopeJson,
        objectives: output.scope.objectives,
      },
    },
    { id: 'methodology', title: 'Metodyka', kind: 'text', content: buildMethodology(output) },
    { id: 'limitations', title: 'Ograniczenia', kind: 'list', content: buildLimitations(output) },
    {
      id: 'overall_conclusion',
      title: 'Wniosek ogólny',
      kind: 'text',
      content: buildOverallConclusion(output),
    },
    {
      id: 'findings_by_severity',
      title: 'Ustalenia wg istotności',
      kind: 'group',
      content: groupEntries(bySeverity, severityRank),
    },
    {
      id: 'findings_by_area',
      title: 'Ustalenia wg obszaru/procesu',
      kind: 'group',
      content: groupEntries(byArea),
    },
    {
      id: 'objective_evidence_references',
      title: 'Odniesienia do obiektywnych dowodów',
      kind: 'table',
      content: buildEvidenceReferences(output),
    },
    {
      id: 'systemic_conclusions',
      title: 'Wnioski systemowe',
      kind: 'list',
      content: output.systemicConclusions,
    },
    {
      id: 'corrective_action_plan',
      title: 'Plan działań korygujących',
      kind: 'table',
      content: output.correctiveActionPlan,
    },
    {
      id: 'verification_plan',
      title: 'Plan weryfikacji',
      kind: 'table',
      content: output.verificationPlan,
    },
    {
      id: 'appendices',
      title: 'Załączniki',
      kind: 'group',
      content: { team: output.team, evidenceRegister: output.evidence },
    },
    {
      id: 'traceability_matrix',
      title: 'Macierz traceability',
      kind: 'table',
      content: buildTraceabilityMatrix(output),
    },
  ];

  return { reportKind: 'audit_report', generatedAt: options.generatedAt, sections };
}

// ---------------------------------------------------------------------------
// B. Raport realizacji (remediation progress) — snapshot na `asOfDate`
// ---------------------------------------------------------------------------

export interface RemediationActionInput {
  id: string;
  findingId: string;
  title: string;
  actionKind: string;
  ownerUserId: string | null;
  dueDate: string | null;
  status: string;
  implementationEvidenceId: string | null;
  implementedAt: string | null;
}

export interface RemediationVerificationInput {
  id: string;
  correctiveActionId: string | null;
  findingId: string;
  verificationKind: string;
  result: string | null;
  performedAt: string | null;
  plannedDate: string | null;
}

const COMPLETED_ACTION_STATUSES = new Set(['implemented', 'verified']);

function isActionLate(action: RemediationActionInput, asOfTime: number): boolean {
  if (!action.dueDate) return false;
  if (COMPLETED_ACTION_STATUSES.has(action.status)) return false;
  const due = Date.parse(action.dueDate);
  return Number.isFinite(due) && Number.isFinite(asOfTime) && due < asOfTime;
}

function closureForecastNote(percentComplete: number, remaining: number): string {
  if (remaining === 0) return 'Wszystkie działania naprawcze zostały wdrożone.';
  if (percentComplete >= 75) return 'Zamknięcie bliskie — większość działań została wdrożona.';
  if (percentComplete >= 40) return 'Realizacja w toku — istotna część działań pozostaje otwarta.';
  return 'Wczesny etap realizacji — większość działań wciąż jest otwarta.';
}

function buildResidualRiskChange(
  output: AuditOutputPayload,
  verifications: RemediationVerificationInput[],
): Array<{ findingId: string; baselineResidualRisk: string | null; note: string }> {
  return output.residualRisk.map((r) => {
    const related = verifications.filter((v) => v.findingId === r.findingId);
    let note = 'Brak przeprowadzonej weryfikacji skuteczności — zmiana ryzyka nieoceniona.';
    if (related.some((v) => v.result === 'effective')) {
      note = 'Weryfikacja potwierdza skuteczność działania — ryzyko rezydualne zredukowane.';
    } else if (related.some((v) => v.result === 'not_effective')) {
      note = 'Weryfikacja wykazała brak skuteczności — ryzyko rezydualne utrzymuje się.';
    } else if (related.some((v) => v.result === 'partially_effective')) {
      note = 'Weryfikacja wykazała częściową skuteczność — ryzyko rezydualne częściowo zredukowane.';
    } else if (related.length > 0) {
      note = 'Weryfikacja w toku — wynik nierozstrzygający.';
    }
    return { findingId: r.findingId, baselineResidualRisk: r.residualRisk, note };
  });
}

export function renderRemediationProgressReport(
  output: AuditOutputPayload,
  actions: RemediationActionInput[],
  verifications: RemediationVerificationInput[],
  asOfDate: string,
): AuditReportDocument {
  const asOfTime = Date.parse(asOfDate);
  const total = actions.length;
  const completed = actions.filter((a) => COMPLETED_ACTION_STATUSES.has(a.status)).length;
  const percentComplete = total === 0 ? 100 : Math.round((completed / total) * 1000) / 10;

  const delayed = actions.filter((a) => isActionLate(a, asOfTime));
  const rejected = actions.filter((a) => a.status === 'rejected');
  const overdueFlagged = actions.filter((a) => a.status === 'overdue');

  const withoutOwner = actions.filter((a) => !a.ownerUserId);
  const withoutEvidence = actions.filter(
    (a) => COMPLETED_ACTION_STATUSES.has(a.status) && !a.implementationEvidenceId,
  );
  const missingOwnerOrEvidenceById = new Map(
    [...withoutOwner, ...withoutEvidence].map((a) => [a.id, a]),
  );

  const sections: ReportSection[] = [
    {
      id: 'progress_summary',
      title: 'Postęp i terminowość',
      kind: 'keyValue',
      content: {
        totalActions: total,
        completedActions: completed,
        percentComplete,
        delayedCount: delayed.length,
        overdueFlaggedCount: overdueFlagged.length,
      },
    },
    {
      id: 'items_missing_owner_or_evidence',
      title: 'Pozycje bez właściciela lub dowodu',
      kind: 'list',
      content: Array.from(missingOwnerOrEvidenceById.values()),
    },
    {
      id: 'delayed_rejected_reopened',
      title: 'Działania opóźnione / odrzucone / ponownie otwarte',
      kind: 'group',
      content: { delayed, rejected, overdueFlagged },
    },
    {
      id: 'verification_effectiveness_results',
      title: 'Wynik weryfikacji skuteczności',
      kind: 'table',
      content: verifications,
    },
    {
      id: 'residual_risk_change',
      title: 'Zmiana ryzyka rezydualnego',
      kind: 'table',
      content: buildResidualRiskChange(output, verifications),
    },
    {
      id: 'closure_forecast',
      title: 'Prognoza zamknięcia',
      kind: 'keyValue',
      content: {
        totalActions: total,
        completedActions: completed,
        remainingActions: total - completed,
        percentComplete,
        note: closureForecastNote(percentComplete, total - completed),
      },
    },
  ];

  return { reportKind: 'remediation_progress', generatedAt: null, asOfDate, sections };
}

// ---------------------------------------------------------------------------
// C. Widok prezentacyjny (zarząd)
// ---------------------------------------------------------------------------

function byDueDateThenId(
  a: { dueDate: string | null; id: string },
  b: { dueDate: string | null; id: string },
): number {
  if (a.dueDate && b.dueDate) {
    const cmp = a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0;
    if (cmp !== 0) return cmp;
  } else if (a.dueDate && !b.dueDate) {
    return -1;
  } else if (!a.dueDate && b.dueDate) {
    return 1;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function buildAccountabilities(
  output: AuditOutputPayload,
): Array<{ ownerUserId: string; findingIds: string[]; actionIds: string[] }> {
  const byOwner = new Map<string, { findingIds: string[]; actionIds: string[] }>();
  const ensure = (owner: string) => {
    if (!byOwner.has(owner)) byOwner.set(owner, { findingIds: [], actionIds: [] });
    return byOwner.get(owner)!;
  };
  for (const f of output.findings) {
    if (f.ownerUserId) ensure(f.ownerUserId).findingIds.push(f.id);
  }
  for (const a of output.correctiveActionPlan) {
    if (a.ownerUserId) ensure(a.ownerUserId).actionIds.push(a.id);
  }
  return Array.from(byOwner.entries()).map(([ownerUserId, data]) => ({ ownerUserId, ...data }));
}

export function renderPresentationView(output: AuditOutputPayload): AuditReportDocument {
  const distribution = countBySeverity(output.findings);
  const criticalFindings = output.findings.filter((f) => f.severity === 'critical');
  const criticalEvidence = output.evidence.filter((e) => e.supportsConformity === false);
  const priorities = output.correctiveActionPlan.slice().sort(byDueDateThenId);
  const timeline = output.correctiveActionPlan.filter((a) => a.dueDate).slice().sort(byDueDateThenId);

  const sections: ReportSection[] = [
    { id: 'conclusion', title: 'Konkluzja', kind: 'text', content: buildOverallConclusion(output) },
    {
      id: 'systemic_themes',
      title: 'Tematy systemowe',
      kind: 'list',
      content: output.systemicConclusions,
    },
    {
      id: 'findings_distribution',
      title: 'Rozkład ustaleń',
      kind: 'table',
      content: FINDING_SEVERITIES.map((sev) => ({ severity: sev, count: distribution[sev] ?? 0 })),
    },
    {
      // Sekcja NIGDY nie jest pusta przez pomyłkę — jawnie wylicza WSZYSTKIE
      // ustalenia krytyczne, żeby żadne nie zginęło w agregacjach powyżej.
      id: 'critical_findings',
      title: 'Ustalenia krytyczne',
      kind: 'list',
      content: criticalFindings,
    },
    { id: 'critical_evidence', title: 'Dowody krytyczne', kind: 'list', content: criticalEvidence },
    {
      id: 'remediation_priorities',
      title: 'Priorytety naprawy',
      kind: 'table',
      content: priorities,
    },
    { id: 'timeline', title: 'Oś czasu', kind: 'table', content: timeline },
    {
      id: 'accountabilities',
      title: 'Odpowiedzialności',
      kind: 'table',
      content: buildAccountabilities(output),
    },
  ];

  return { reportKind: 'presentation', generatedAt: null, sections };
}
