/**
 * AuditReportDocumentView — U5 pełny widok treści raportu audytu (ekran-
 * artefakt SPEC-A, archetyp B „Dokument").
 *
 * R1 (panel powtórny DEC-117, NAJCIĘŻSZY blokier): poprzednia wersja tego
 * pliku WYRZUCAŁA `getReport(reportId)`'s payload i renderowała WYŁĄCZNIE
 * `GET /audits/reports/:id/presentation` — czyli zawsze 8-sekcyjny deck
 * (`reportRenderer.renderPresentationView`, `reportRenderer.ts:688`),
 * NIEZALEŻNIE od tego, jaki dokument faktycznie leży w `audit_reports.payload`
 * i jest objęty `content_hash`em (`reportService.ts:165`,
 * `outputService.computeOutputHash`). Zatwierdzający czytał deck, a zatwierdzał
 * (przyciskiem w TYM SAMYM widoku) zupełnie inny, zaplombowany dokument —
 * dokładnie ten błąd metody, który DEC-117 nazwał „niewłaściwy dokument".
 *
 * Trzy renderery istnieją w `reportRenderer.ts` (`server/src/services/audits/`):
 *   - `renderAuditReport` (:428) — 13 sekcji z macierzą traceability. TEN jest
 *     zapisywany w `audit_reports.payload` dla `reportKind==='audit_report'`
 *     (`reportService.generateReport`, :148) i zwracany 1:1 przez
 *     `GET /audits/reports/:id` (`reportService.getReport`, :239 →
 *     `mapReportRow`, payload = `parseJson(row.payload)`).
 *   - `renderRemediationProgressReport` (:575) — 6-sekcyjny snapshot postępu
 *     naprawy (`reportKind==='remediation_progress'`), TAKŻE zapisywany w
 *     `payload` i zwracany tą samą trasą — ten widok renderuje go też (kinds
 *     keyValue/list/group/table, ta sama maszyneria co audit_report), choć R1
 *     skupia się na audit_report (dominujący przypadek — Zatwierdź/Opublikuj).
 *   - `renderPresentationView` (:688) — 8-sekcyjny deck, renderowany NA ŻYWO
 *     przez `GET /audits/reports/:id/presentation`
 *     (`reportService.renderReportPresentation`, :395) — NIC nie zapisuje,
 *     zawsze `reportKind:'presentation'`, niezależnie od `report.reportKind`.
 *     To jest DRUGI, jawnie nazwany tryb „Widok dla zarządu" — przełącznik w
 *     kebabie Menu 1 (`extraOverflowItems`, patrz nota przy `header` niżej —
 *     `secondaryActions` byłby bardziej widoczny, ale jest martwym propem w
 *     `NModeHeader.tsx`, poza zakresem tej naprawy), NIGDY domyślny widok.
 *
 * NAPRAWIONE: domyślnie renderowany jest `report.payload` (pełny dokument,
 * DOKŁADNIE ten sam, który `content_hash` plombuje i który `POST
 * /reports/:id/approve|publish` zatwierdza) — użytkownik czyta i zatwierdza
 * TEN SAM byt. „Widok dla zarządu" jest DRUGI, jawnie nazwany, ładowany
 * leniwie (dopiero po przełączeniu — `getReportPresentation` renderuje na
 * żywo z Outputu, nie ma sensu płacić za to przy każdym otwarciu ekranu).
 * Zatwierdź/Opublikuj żyje w nagłówku Menu 1 NIEZALEŻNIE od trybu (nie znika
 * po przełączeniu na deck) — ale domyślny widok, w którym użytkownik LĄDUJE,
 * jest zawsze pełnym dokumentem. Etykieta „Rodzaj" w prawym panelu czyta
 * `reportKind` AKTYWNIE WYŚWIETLANEGO dokumentu (`activeDocument`), nie
 * `report.reportKind` — więc mówi prawdę: „Raport audytu" w trybie pełnym,
 * „Widok prezentacyjny" po przełączeniu, nigdy jedno pod maską drugiego.
 *
 * Sekcje `group`/`keyValue` (których poprzedni widok w ogóle nie umiał
 * renderować — `renderSectionContent`'s `switch` nie miał dla nich gałęzi,
 * pokazywały „—") mają teraz obsługę: ID-świadomą dla znanych sekcji
 * `audit_report`/`presentation`/`remediation_progress` (patrz stałe
 * `KNOWN_SECTION_IDS` niżej — 21 rozpoznanych identyfikatorów), i generyczną
 * (`renderGeneric*` — humanizacja klucza, format daty/bool/tablicy) dla
 * KAŻDEGO nierozpoznanego `id`, żeby żaden przyszły rodzaj raportu nie
 * wylądował z pustą sekcją.
 *
 * Powłoka wspólna SPEC-A (§10.2/§11.2, `consultify-artefakty`): Menu 1 =
 * `ArtifactBreadcrumb` + `NModeShell`'s header (tytuł, status lifecycle,
 * przełącznik trybu w kebabie + JEDEN primary — Zatwierdź/Opublikuj, te
 * same bramkowane endpointy co kebab listy `AuditReportsTab`). Centrum =
 * `NModeShell`'s left-nav + sekcje aktywnego dokumentu. Prawy panel =
 * `ArtifactRightPanel`, WYŁĄCZNIE sekcje mające zastosowanie (Akcje,
 * Właściwości) — Powiązania/Komentarze/Historia pominięte (brak danych z
 * backendu = brak sekcji, nigdy atrapa).
 *
 * Zero surowych ID na twarzy: `criterionId`/`ownerUserId`/`objectiveEvidence`/
 * `findingId` (same ID w payloadzie) są rozwiązywane do tytułów/nazw przez
 * dodatkowe, REALNE odczyty — `listProgramCriteria`/`listEvidence`/
 * `getProgram`/`Api.getUsers()` — oraz przez `findingLabelById`, zbudowaną z
 * samego dokumentu (sekcje z ustaleniami niosą już `statement`/`referenceCode`
 * — żaden dodatkowy request).
 *
 * FIX-187: eksport PDF (`GET /reports/:id/export.pdf`, strukturalny
 * bliźniak `.docx` — ten sam aktor/walidacja/kontekst/schemat, różnica
 * tylko renderer+Content-Type, zero nowej flagi) ma teraz realny przycisk
 * „Pobierz PDF" obok „Pobierz DOCX" w sekcji Akcje prawego panelu — ten sam
 * wzorzec pobierania (fetch → blob → `<a download>` → revoke), ta sama
 * bramka `reportChainEnabled`. Wyszarzały wiersz „Planowane" usunięty.
 */
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileSearch,
  FileText,
  GitBranch,
  Layers,
  Lightbulb,
  ListChecks,
  Loader2,
  Paperclip,
  Presentation as PresentationIcon,
  Send,
  ShieldAlert,
  ShieldCheck,
  Target,
  Users,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ArtifactBreadcrumb } from '@/components/standard/ArtifactBreadcrumb';
import { ArtifactPropertiesTable, type ArtifactPropertyRow } from '@/components/standard/ArtifactPropertiesTable';
import {
  ARTIFACT_PANEL_CARD_CLASS_DOCKED,
  ArtifactRightPanel,
  type ArtifactRightPanelSection,
} from '@/components/standard/ArtifactRightPanel';
import { NModeShell } from '@/components/shared/NModeLayout/NModeShell';
import type { NModeHeaderConfig, NModeSection } from '@/components/shared/NModeLayout/types';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states';
import { StatusChip } from '@/components/ui/primitives/chips';
import { Api } from '@/services/api';
import { formatListDate } from '@/utils/listDateFormat';
import { isAuditsReportChainEnabled } from '@/utils/auditsReportChainFlag';

import { auditRoleLabel } from './auditRoleLabels';
import {
  actionKindLabel,
  actionStatusLabel,
  actionStatusTone,
  findingClassificationLabel,
  findingClassificationTone,
  findingSeverityLabel,
  findingSeverityTone,
  findingStatusLabel,
  reportStatusLabel,
} from './auditStatusTones';
import {
  approveReport,
  getProgram,
  getReport,
  getReportPresentation,
  listEvidence,
  listProgramCriteria,
  publishReport,
  type AuditCriterionSummary,
  type AuditEvidenceSummary,
  type AuditReportDocument,
  type AuditReportDocumentSection,
  type AuditReportStatus,
  type AuditReportSummary,
} from './auditsMethodApi';

export interface AuditReportDocumentViewProps {
  reportId?: string;
}

const EVIDENCE_KIND_LABEL: Record<string, { pl: string; en: string }> = {
  document: { pl: 'Dokument', en: 'Document' },
  interview_answer: { pl: 'Odpowiedź z wywiadu', en: 'Interview answer' },
  interview_statement: { pl: 'Oświadczenie z wywiadu', en: 'Interview statement' },
  observation: { pl: 'Obserwacja', en: 'Observation' },
  system_export: { pl: 'Eksport systemowy', en: 'System export' },
  screenshot: { pl: 'Zrzut ekranu', en: 'Screenshot' },
  note: { pl: 'Notatka', en: 'Note' },
  sample: { pl: 'Próbka', en: 'Sample' },
};

const REPORT_KIND_LABEL: Record<string, { pl: string; en: string }> = {
  audit_report: { pl: 'Raport audytu', en: 'Audit report' },
  remediation_progress: { pl: 'Postęp naprawy', en: 'Remediation progress' },
  presentation: { pl: 'Widok prezentacyjny', en: 'Presentation view' },
};

const TEST_RESULT_LABEL: Record<string, { pl: string; en: string }> = {
  pass: { pl: 'Pozytywny', en: 'Pass' },
  fail: { pl: 'Negatywny', en: 'Fail' },
  partial: { pl: 'Częściowy', en: 'Partial' },
  inconclusive: { pl: 'Nierozstrzygający', en: 'Inconclusive' },
};

const VERIFICATION_KIND_LABEL: Record<string, { pl: string; en: string }> = {
  implementation: { pl: 'Weryfikacja wdrożenia', en: 'Implementation verification' },
  effectiveness: { pl: 'Weryfikacja skuteczności', en: 'Effectiveness verification' },
};

const VERIFICATION_RESULT_LABEL: Record<string, { pl: string; en: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  effective: { pl: 'Skuteczne', en: 'Effective', tone: 'success' },
  partially_effective: { pl: 'Częściowo skuteczne', en: 'Partially effective', tone: 'warning' },
  not_effective: { pl: 'Nieskuteczne', en: 'Not effective', tone: 'danger' },
  inconclusive: { pl: 'Nierozstrzygające', en: 'Inconclusive', tone: 'neutral' },
};

const SUFFICIENCY_LABEL: Record<string, { pl: string; en: string }> = {
  sufficient: { pl: 'Wystarczający', en: 'Sufficient' },
  insufficient: { pl: 'Niewystarczający', en: 'Insufficient' },
  unknown: { pl: 'Nieustalona', en: 'Unknown' },
};

const RELIABILITY_LABEL: Record<string, { pl: string; en: string }> = {
  reliable: { pl: 'Wiarygodny', en: 'Reliable' },
  questionable: { pl: 'Zastrzeżona', en: 'Questionable' },
  unknown: { pl: 'Nieustalona', en: 'Unknown' },
};

/** Mirror NModeHeaderConfig's tone union (distinct from `StatusTone` — no `info`/`danger`/`success`, only draft/review/approved/rejected/neutral). */
function headerStatusTone(status: AuditReportStatus): 'draft' | 'review' | 'approved' | 'rejected' | 'neutral' {
  if (status === 'draft') return 'draft';
  if (status === 'in_review') return 'review';
  if (status === 'approved' || status === 'published') return 'approved';
  return 'neutral';
}

// -----------------------------------------------------------------------
// Kształty sekcji obu dokumentów (`renderAuditReport`/`renderPresentationView`/
// `renderRemediationProgressReport`, `reportRenderer.ts`) — mirror pól JSON,
// WYŁĄCZNIE te odczytywane tutaj. Jeden `FindingLike` obsługuje obie
// (audit_report ma więcej pól niż presentation — opcjonalne tu, obecne tam).
// -----------------------------------------------------------------------

interface FindingLike {
  id: string;
  referenceCode: string | null;
  statement: string;
  criterionId: string | null;
  classification: string;
  severity: string | null;
  objectiveEvidence: string[];
  ownerUserId: string | null;
  contradictingEvidence?: string[];
  status?: string;
  rootCause?: string | null;
  rootCauseConfirmed?: boolean;
  residualRisk?: string | null;
}
interface EvidenceLike {
  id: string;
  title: string;
  evidenceKind: string;
  criterionId: string | null;
}
interface ActionLike {
  id: string;
  findingId: string;
  actionKind: string;
  title: string;
  ownerUserId: string | null;
  dueDate: string | null;
  status: string;
}
interface SystemicConclusion {
  theme: string;
  findingIds: string[];
  description: string;
}
interface SeverityCount {
  severity: string;
  count: number;
}
interface Accountability {
  ownerUserId: string;
  findingIds: string[];
  actionIds: string[];
}
interface GroupEntry<T> {
  key: string;
  items: T[];
}
interface EvidenceReferenceRow {
  findingId: string;
  evidenceIds: string[];
  evidenceTitles: string[];
}
interface VerificationPlanEntry {
  id: string;
  correctiveActionId: string | null;
  findingId: string;
  verificationKind: string;
  method: string | null;
  plannedDate: string | null;
  performedAt: string | null;
  result: string | null;
}
interface AppendicesTeamMember {
  id: string;
  userId: string;
  role: string;
  independenceDeclared: boolean;
  assignedAt: string | null;
}
interface AppendicesEvidenceEntry {
  id: string;
  title: string;
  evidenceKind: string;
  criterionId: string | null;
  sufficiency: string | null;
  reliability: string | null;
  supportsConformity: boolean | null;
}
interface AppendicesContent {
  team: AppendicesTeamMember[];
  evidenceRegister: AppendicesEvidenceEntry[];
}
interface TraceabilityRow {
  id: string;
  criterionId: string | null;
  criterionRef: string | null;
  criterionTitle: string | null;
  evidenceTitles: string[];
  testPerformed: string | null;
  testResult: string | null;
  auditorConclusion: string | null;
  findingId: string;
  findingStatement: string;
  actionTitles: string[];
  verificationResults: Array<string | null>;
}
interface ScopeContent {
  scopeText: string | null;
  scopeJson: Record<string, unknown> | null;
  objectives: string | null;
}

/** Identifiers explicitly handled below — every other id falls back to the generic-by-kind renderer. */
const KNOWN_SECTION_IDS = new Set([
  // audit_report (renderAuditReport, reportRenderer.ts:428)
  'executive_summary', 'scope', 'methodology', 'limitations', 'overall_conclusion',
  'findings_by_severity', 'findings_by_area', 'objective_evidence_references',
  'systemic_conclusions', 'corrective_action_plan', 'verification_plan',
  'appendices', 'traceability_matrix',
  // presentation (renderPresentationView, reportRenderer.ts:688)
  'conclusion', 'systemic_themes', 'findings_distribution', 'critical_findings',
  'critical_evidence', 'remediation_priorities', 'timeline', 'accountabilities',
]);

/**
 * §27-exempt (DOKTRYNA_TABELA_NIE_EXCEL.md): NOT a "LISTA" table (TRIADA §1).
 * This renders static, read-only sections of the report DOCUMENT payload
 * (`AuditReportDocument.sections[].content` — table-kind sections like
 * "Rozkład ustaleń"/"Priorytety naprawy") — no row click, no preview-open, no
 * kebab, no StandardModuleBar, no sort/filter. It is report BODY content
 * (the same role a table plays inside a printed report), not a record list
 * to browse — so `StandardTable`'s list contract does not apply here.
 */
function SimpleTable({
  head,
  rows,
}: {
  head: string[];
  rows: React.ReactNode[][];
}): React.ReactElement {
  return (
    <div className="overflow-x-auto rounded-lg border border-c-border-subtle">
      <table className="w-full text-sm"> {/* §27-exempt */}
        <thead> {/* §27-exempt */}
          <tr className="border-b border-c-border-subtle bg-c-surface-raised">
            {head.map((h) => (
              <th key={h} className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody> {/* §27-exempt */}
          {rows.map((cells, i) => (
            <tr key={i} className="border-b border-c-border-subtle last:border-b-0">
              {cells.map((c, j) => (
                <td key={j} className="px-3 py-2 align-top text-c-text-secondary">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// -----------------------------------------------------------------------
// Generic-by-kind fallback — covers `remediation_progress` (6 further ids:
// progress_summary/items_missing_owner_or_evidence/delayed_rejected_reopened/
// verification_effectiveness_results/residual_risk_change/closure_forecast,
// `renderRemediationProgressReport`, reportRenderer.ts:575) and any FUTURE
// report kind, so an unrecognised section id renders honestly (real fields,
// humanised keys) instead of a blank "—". Deliberately WITHOUT the
// id-resolution the named renderers below get (no criterion/user/evidence
// lookup) — that level of polish is scoped to the two report kinds R1 covers
// (audit_report/presentation); a future remediation_progress polish pass can
// promote specific ids out of this fallback the same way this file already
// promotes 21 of them.
// -----------------------------------------------------------------------

function humanizeKey(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
  return spaced.length ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : spaced;
}

function formatGenericPrimitive(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Tak' : 'Nie';
  if (Array.isArray(value)) return value.length ? value.map((v) => String(v)).join('; ') : '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function renderGenericKeyValue(content: unknown): React.ReactNode {
  const entries = content && typeof content === 'object' ? Object.entries(content as Record<string, unknown>) : [];
  if (!entries.length) return <p className="text-sm text-c-text-muted">—</p>;
  return <SimpleTable head={['Pole', 'Wartość']} rows={entries.map(([k, v]) => [humanizeKey(k), formatGenericPrimitive(v)])} />;
}

function renderGenericList(content: unknown): React.ReactNode {
  if (!Array.isArray(content) || content.length === 0) {
    return <p className="text-sm text-c-text-muted">Brak pozycji.</p>;
  }
  if (typeof content[0] !== 'object' || content[0] === null) {
    return (
      <ul className="list-disc space-y-1 pl-5 text-sm text-c-text">
        {content.map((v, i) => (
          <li key={i}>{formatGenericPrimitive(v)}</li>
        ))}
      </ul>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {(content as Record<string, unknown>[]).map((item, i) => (
        <div key={i} className="rounded-lg border border-c-border-subtle p-3 text-xs text-c-text-secondary">
          {Object.entries(item)
            .filter(([k]) => k !== 'id')
            .map(([k, v]) => (
              <div key={k}>
                <span className="font-medium text-c-text">{humanizeKey(k)}: </span>
                {formatGenericPrimitive(v)}
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}

function isGroupEntryArray(content: unknown): content is GroupEntry<unknown>[] {
  return (
    Array.isArray(content) &&
    content.length > 0 &&
    typeof content[0] === 'object' &&
    content[0] !== null &&
    'key' in (content[0] as object) &&
    'items' in (content[0] as object)
  );
}

function renderGenericGroup(content: unknown): React.ReactNode {
  if (isGroupEntryArray(content)) {
    return (
      <div className="flex flex-col gap-4">
        {content.map((g, i) => (
          <div key={i}>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-c-text-muted">
              {String(g.key)} · {g.items.length}
            </div>
            {renderGenericList(g.items)}
          </div>
        ))}
      </div>
    );
  }
  if (Array.isArray(content)) return renderGenericList(content);
  if (content && typeof content === 'object') {
    return (
      <div className="flex flex-col gap-4">
        {Object.entries(content as Record<string, unknown>).map(([k, v]) => (
          <div key={k}>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-c-text-muted">{humanizeKey(k)}</div>
            {Array.isArray(v) ? renderGenericList(v) : renderGenericKeyValue(v)}
          </div>
        ))}
      </div>
    );
  }
  return <p className="text-sm text-c-text-muted">—</p>;
}

function renderGenericTable(content: unknown): React.ReactNode {
  if (!Array.isArray(content) || content.length === 0) return <p className="text-sm text-c-text-muted">Brak pozycji.</p>;
  const keys = Array.from(
    new Set(content.flatMap((row) => (row && typeof row === 'object' ? Object.keys(row as object) : [])))
  );
  return (
    <SimpleTable
      head={keys.map(humanizeKey)}
      rows={content.map((row) => keys.map((k) => formatGenericPrimitive((row as Record<string, unknown> | null)?.[k])))}
    />
  );
}

function renderGenericByKind(s: AuditReportDocumentSection): React.ReactNode {
  switch (s.kind) {
    case 'text':
      return <p className="text-sm leading-relaxed text-c-text">{formatGenericPrimitive(s.content)}</p>;
    case 'keyValue':
      return renderGenericKeyValue(s.content);
    case 'list':
      return renderGenericList(s.content);
    case 'group':
      return renderGenericGroup(s.content);
    case 'table':
      return renderGenericTable(s.content);
    default:
      return <p className="text-sm text-c-text-muted">—</p>;
  }
}

/** Recursively walks a document's sections looking for finding-shaped objects — no extra API call needed, the document already carries them. */
function collectFindingLabels(sections: AuditReportDocumentSection[] | undefined): Map<string, { referenceCode: string | null; statement: string }> {
  const map = new Map<string, { referenceCode: string | null; statement: string }>();
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (node && typeof node === 'object') {
      const obj = node as Record<string, unknown>;
      if (typeof obj.id === 'string' && typeof obj.statement === 'string' && typeof obj.classification === 'string') {
        map.set(obj.id, { referenceCode: (obj.referenceCode as string) ?? null, statement: obj.statement as string });
      }
      if (Array.isArray(obj.items)) visit(obj.items);
    }
  };
  for (const s of sections ?? []) visit(s.content);
  return map;
}

export const AuditReportDocumentView: React.FC<AuditReportDocumentViewProps> = ({ reportId }) => {
  const navigate = useNavigate();
  const isPolish = true; // treść dokumentu (reportRenderer.ts) jest ZAWSZE PL — chrom ekranu podąża za tym

  const [report, setReport] = useState<AuditReportSummary | null>(null);
  const [fullDocument, setFullDocument] = useState<AuditReportDocument | null>(null);
  const [programName, setProgramName] = useState<string | null>(null);
  const [criteria, setCriteria] = useState<AuditCriterionSummary[]>([]);
  const [evidence, setEvidence] = useState<AuditEvidenceSummary[]>([]);
  const [userNameById, setUserNameById] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string>('executive_summary');
  const [transitioning, setTransitioning] = useState<'approve' | 'publish' | null>(null);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const reportChainEnabled = useMemo(() => isAuditsReportChainEnabled(), []);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  /** R1: DRUGI, jawnie nazwany tryb — domyślnie OFF, ładowany leniwie na żądanie (patrz `switchToPresentation`). */
  const [viewMode, setViewMode] = useState<'full' | 'presentation'>('full');
  const [presentationDocument, setPresentationDocument] = useState<AuditReportDocument | null>(null);
  const [presentationLoading, setPresentationLoading] = useState(false);
  const [presentationError, setPresentationError] = useState<string | null>(null);

  const goBack = useCallback(() => navigate('/audit-programs?tab=reports'), [navigate]);

  const downloadDocx = useCallback(async () => {
    if (!reportId || exportingDocx) return;
    setExportingDocx(true);
    setExportError(null);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/audits/reports/${encodeURIComponent(reportId)}/export.docx`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || (isPolish ? 'Nie udało się pobrać DOCX.' : 'Could not download DOCX.'));
      }
      const blobUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `audit-report-${reportId}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (downloadError) {
      setExportError(
        downloadError instanceof Error
          ? downloadError.message
          : isPolish
            ? 'Nie udało się pobrać DOCX.'
            : 'Could not download DOCX.'
      );
    } finally {
      setExportingDocx(false);
    }
  }, [exportingDocx, isPolish, reportId]);

  /**
   * FIX-187: bliźniak `downloadDocx` — trasa `.pdf` jest strukturalnym
   * bliźniakiem `.docx` (ten sam aktor/walidacja/kontekst/schemat, różnica
   * tylko renderer+Content-Type), więc wzorzec pobierania jest identyczny
   * (fetch → blob → tymczasowy `<a download>` → revoke), zero nowej flagi.
   */
  const downloadPdf = useCallback(async () => {
    if (!reportId || exportingPdf) return;
    setExportingPdf(true);
    setExportError(null);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/audits/reports/${encodeURIComponent(reportId)}/export.pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || (isPolish ? 'Nie udało się pobrać PDF.' : 'Could not download PDF.'));
      }
      const blobUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `audit-report-${reportId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (downloadError) {
      setExportError(
        downloadError instanceof Error
          ? downloadError.message
          : isPolish
            ? 'Nie udało się pobrać PDF.'
            : 'Could not download PDF.'
      );
    } finally {
      setExportingPdf(false);
    }
  }, [exportingPdf, isPolish, reportId]);

  const load = useCallback(() => {
    if (!reportId) {
      setError(isPolish ? 'Brak identyfikatora raportu w adresie.' : 'Missing report id in the URL.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setViewMode('full');
    setPresentationDocument(null);
    setPresentationError(null);
    getReport(reportId)
      .then(async (reportResult) => {
        if (!reportResult) throw new Error(isPolish ? 'Raport nie został znaleziony.' : 'Report not found.');
        const payload = reportResult.payload as unknown as AuditReportDocument | undefined;
        if (!payload || !Array.isArray(payload.sections)) {
          throw new Error(
            isPolish
              ? 'Raport nie ma poprawnej treści (payload) — nie można wyświetlić dokumentu.'
              : 'The report has no valid content (payload) — cannot display the document.'
          );
        }
        setReport(reportResult);
        setFullDocument(payload);
        setActiveSection(payload.sections[0]?.id ?? 'executive_summary');
        const [program, criteriaResult, evidenceResult, users] = await Promise.all([
          getProgram(reportResult.programId).catch(() => null),
          listProgramCriteria(reportResult.programId).catch(() => []),
          listEvidence(reportResult.programId).catch(() => []),
          Api.getUsers().catch(() => []),
        ]);
        setProgramName(program?.name ?? null);
        setCriteria(criteriaResult);
        setEvidence(evidenceResult);
        const map = new Map<string, string>();
        for (const u of users || []) map.set(u.id, `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.id);
        setUserNameById(map);
      })
      .catch((e: any) => {
        const message =
          e?.status === 403
            ? isPolish
              ? 'Brak uprawnień do tego raportu w tej organizacji.'
              : 'You do not have permission to view this report.'
            : e?.message || (isPolish ? 'Nie udało się wczytać raportu' : 'Failed to load the report');
        setError(message);
      })
      .finally(() => setLoading(false));
  }, [reportId, isPolish]);

  useEffect(() => {
    load();
  }, [load]);

  /** R1: przełącznik trybów Menu 1 — leniwe ładowanie `/presentation` dopiero przy pierwszym przełączeniu. */
  const switchToPresentation = useCallback(() => {
    setViewMode('presentation');
    if (presentationDocument) {
      setActiveSection(presentationDocument.sections[0]?.id ?? 'conclusion');
      return;
    }
    if (!reportId || presentationLoading) return;
    setPresentationLoading(true);
    setPresentationError(null);
    getReportPresentation(reportId)
      .then((doc) => {
        setPresentationDocument(doc);
        setActiveSection(doc.sections[0]?.id ?? 'conclusion');
      })
      .catch((e: any) =>
        setPresentationError(
          e?.message || (isPolish ? 'Nie udało się wczytać widoku dla zarządu' : 'Failed to load the executive view')
        )
      )
      .finally(() => setPresentationLoading(false));
  }, [presentationDocument, presentationLoading, reportId, isPolish]);

  const switchToFull = useCallback(() => {
    setViewMode('full');
    setActiveSection(fullDocument?.sections[0]?.id ?? 'executive_summary');
  }, [fullDocument]);

  const activeDocument = viewMode === 'presentation' ? presentationDocument : fullDocument;

  const criterionTitleById = useMemo(() => {
    const map = new Map<string, string>();
    const walk = (list: AuditCriterionSummary[]) => {
      for (const c of list) {
        map.set(c.id, c.refCode ? `${c.refCode} — ${c.title}` : c.title);
        if (c.children?.length) walk(c.children);
      }
    };
    walk(criteria);
    return map;
  }, [criteria]);

  const evidenceTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of evidence) map.set(e.id, e.title);
    return map;
  }, [evidence]);

  /** R1: resolves `findingId` references (corrective actions, verification plan, evidence references) to a real label — built from the document itself, no extra request. */
  const findingLabelById = useMemo(() => collectFindingLabels(activeDocument?.sections), [activeDocument]);
  const findingLabel = useCallback(
    (id: string | null): string => {
      if (!id) return '—';
      const entry = findingLabelById.get(id);
      if (!entry) return id;
      return entry.referenceCode ? `${entry.referenceCode} — ${entry.statement}` : entry.statement;
    },
    [findingLabelById]
  );

  const runTransition = useCallback(
    async (action: 'approve' | 'publish') => {
      if (!report) return;
      setTransitioning(action);
      setTransitionError(null);
      try {
        const updated = action === 'approve' ? await approveReport(report.id) : await publishReport(report.id);
        if (updated) setReport(updated);
        else load();
      } catch (e: any) {
        setTransitionError(
          e?.message || (isPolish ? 'Nie udało się zmienić statusu raportu' : 'Failed to change the report status')
        );
      } finally {
        setTransitioning(null);
      }
    },
    [report, isPolish, load]
  );

  const section = (id: string): AuditReportDocumentSection | undefined => activeDocument?.sections.find((s) => s.id === id);

  // -----------------------------------------------------------------------
  // Named, ID-resolved renderers — the 21 identifiers `KNOWN_SECTION_IDS`
  // lists (13 audit_report + 8 presentation).
  // -----------------------------------------------------------------------

  const renderFindingCard = useCallback(
    (f: FindingLike): React.ReactNode => (
      <div key={f.id} className="rounded-lg border border-c-border-subtle p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-mono text-c-text-muted">{f.referenceCode || f.id}</span>
          <StatusChip label={findingClassificationLabel(f.classification, isPolish)} tone={findingClassificationTone(f.classification)} />
          {f.severity ? (
            <StatusChip label={findingSeverityLabel(f.severity as any, isPolish)} tone={findingSeverityTone(f.severity as any)} />
          ) : null}
        </div>
        <p className="mt-1 text-sm text-c-text">{f.statement}</p>
        <dl className="mt-2 grid grid-cols-1 gap-1 text-[11px] text-c-text-muted sm:grid-cols-3">
          <div>
            <dt className="inline font-medium">{isPolish ? 'Kryterium: ' : 'Criterion: '}</dt>
            <dd className="inline">{(f.criterionId && criterionTitleById.get(f.criterionId)) || '—'}</dd>
          </div>
          <div>
            <dt className="inline font-medium">{isPolish ? 'Właściciel: ' : 'Owner: '}</dt>
            <dd className="inline">{(f.ownerUserId && userNameById.get(f.ownerUserId)) || (isPolish ? 'Nieprzypisany' : 'Unassigned')}</dd>
          </div>
          <div>
            <dt className="inline font-medium">{isPolish ? 'Dowody: ' : 'Evidence: '}</dt>
            <dd className="inline">
              {f.objectiveEvidence.length ? f.objectiveEvidence.map((id) => evidenceTitleById.get(id) || id).join('; ') : '—'}
            </dd>
          </div>
          {f.status ? (
            <div>
              <dt className="inline font-medium">{'Status: '}</dt>
              <dd className="inline">{findingStatusLabel(f.status as any, isPolish)}</dd>
            </div>
          ) : null}
          {f.rootCause ? (
            <div className="sm:col-span-2">
              <dt className="inline font-medium">{isPolish ? 'Przyczyna źródłowa: ' : 'Root cause: '}</dt>
              <dd className="inline">
                {f.rootCause} {f.rootCauseConfirmed ? (isPolish ? '(potwierdzona)' : '(confirmed)') : ''}
              </dd>
            </div>
          ) : null}
          {f.residualRisk ? (
            <div className="sm:col-span-3">
              <dt className="inline font-medium">{isPolish ? 'Ryzyko rezydualne: ' : 'Residual risk: '}</dt>
              <dd className="inline">{f.residualRisk}</dd>
            </div>
          ) : null}
        </dl>
      </div>
    ),
    [criterionTitleById, evidenceTitleById, userNameById]
  );

  const renderFindingGroups = useCallback(
    (entries: GroupEntry<FindingLike>[], headerFor: (key: string) => string): React.ReactNode => {
      if (!entries.length) {
        return <p className="text-sm text-c-text-muted">{isPolish ? 'Brak ustaleń.' : 'No findings.'}</p>;
      }
      return (
        <div className="flex flex-col gap-4">
          {entries.map((g) => (
            <div key={g.key}>
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-c-text-muted">{headerFor(g.key)}</span>
                <span className="text-[11px] text-c-text-muted">· {g.items.length}</span>
              </div>
              <div className="flex flex-col gap-2">{g.items.map((f) => renderFindingCard(f))}</div>
            </div>
          ))}
        </div>
      );
    },
    [isPolish, renderFindingCard]
  );

  const renderEvidenceList = useCallback(
    (items: EvidenceLike[]): React.ReactNode => {
      if (!items.length) {
        return <p className="text-sm text-c-text-muted">{isPolish ? 'Brak dowodów przeczących zgodności.' : 'No evidence contradicting conformity.'}</p>;
      }
      return (
        <SimpleTable
          head={[isPolish ? 'Dowód' : 'Evidence', isPolish ? 'Rodzaj' : 'Kind', isPolish ? 'Kryterium' : 'Criterion']}
          rows={items.map((e) => [
            e.title,
            (EVIDENCE_KIND_LABEL[e.evidenceKind] && (isPolish ? EVIDENCE_KIND_LABEL[e.evidenceKind].pl : EVIDENCE_KIND_LABEL[e.evidenceKind].en)) ||
              e.evidenceKind,
            (e.criterionId && criterionTitleById.get(e.criterionId)) || '—',
          ])}
        />
      );
    },
    [isPolish, criterionTitleById]
  );

  const renderActionsTable = useCallback(
    (items: ActionLike[]): React.ReactNode => {
      if (!items.length) {
        return <p className="text-sm text-c-text-muted">{isPolish ? 'Brak działań do pokazania.' : 'No actions to show.'}</p>;
      }
      const showFindingColumn = findingLabelById.size > 0;
      return (
        <SimpleTable
          head={[
            isPolish ? 'Działanie' : 'Action',
            isPolish ? 'Rodzaj' : 'Kind',
            ...(showFindingColumn ? [isPolish ? 'Ustalenie' : 'Finding'] : []),
            isPolish ? 'Właściciel' : 'Owner',
            isPolish ? 'Termin' : 'Due date',
            'Status',
          ]}
          rows={items.map((a) => [
            a.title,
            actionKindLabel(a.actionKind as any, isPolish),
            ...(showFindingColumn ? [findingLabel(a.findingId)] : []),
            (a.ownerUserId && userNameById.get(a.ownerUserId)) || (isPolish ? 'Nieprzypisany' : 'Unassigned'),
            <span key="due" className="tabular-nums">
              {a.dueDate ? formatListDate(a.dueDate) : '—'}
            </span>,
            <StatusChip key="status" label={actionStatusLabel(a.status as any, isPolish)} tone={actionStatusTone(a.status as any)} />,
          ])}
        />
      );
    },
    [isPolish, findingLabelById, findingLabel, userNameById]
  );

  const renderVerificationTable = useCallback(
    (items: VerificationPlanEntry[]): React.ReactNode => {
      if (!items.length) {
        return <p className="text-sm text-c-text-muted">{isPolish ? 'Brak zaplanowanych weryfikacji.' : 'No verifications planned.'}</p>;
      }
      return (
        <SimpleTable
          head={[
            isPolish ? 'Ustalenie' : 'Finding',
            isPolish ? 'Rodzaj weryfikacji' : 'Verification kind',
            isPolish ? 'Metoda' : 'Method',
            isPolish ? 'Planowana data' : 'Planned date',
            isPolish ? 'Data wykonania' : 'Performed at',
            isPolish ? 'Wynik' : 'Result',
          ]}
          rows={items.map((v) => [
            findingLabel(v.findingId),
            (VERIFICATION_KIND_LABEL[v.verificationKind] && (isPolish ? VERIFICATION_KIND_LABEL[v.verificationKind].pl : VERIFICATION_KIND_LABEL[v.verificationKind].en)) ||
              v.verificationKind,
            v.method || '—',
            <span key="planned" className="tabular-nums">
              {v.plannedDate ? formatListDate(v.plannedDate) : '—'}
            </span>,
            <span key="performed" className="tabular-nums">
              {v.performedAt ? formatListDate(v.performedAt) : '—'}
            </span>,
            v.result ? (
              <StatusChip
                key="result"
                label={isPolish ? VERIFICATION_RESULT_LABEL[v.result]?.pl ?? v.result : VERIFICATION_RESULT_LABEL[v.result]?.en ?? v.result}
                tone={VERIFICATION_RESULT_LABEL[v.result]?.tone ?? 'neutral'}
              />
            ) : (
              '—'
            ),
          ])}
        />
      );
    },
    [isPolish, findingLabel]
  );

  const renderSectionContent = useCallback(
    (id: string): React.ReactNode => {
      const s = section(id);
      if (!s) return null;
      switch (id) {
        // ---- audit_report (renderAuditReport, reportRenderer.ts:428) ----
        case 'executive_summary':
        case 'methodology':
        case 'overall_conclusion':
        case 'conclusion': {
          return <p className="text-sm leading-relaxed text-c-text">{String(s.content)}</p>;
        }
        case 'scope': {
          const c = s.content as ScopeContent;
          return (
            <div className="flex flex-col gap-3 text-sm">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-c-text-muted">{isPolish ? 'Zakres' : 'Scope'}</div>
                <p className="mt-1 text-c-text">{c.scopeText || '—'}</p>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-c-text-muted">{isPolish ? 'Cele' : 'Objectives'}</div>
                <p className="mt-1 text-c-text">{c.objectives || '—'}</p>
              </div>
              {c.scopeJson && Object.keys(c.scopeJson).length > 0 ? (
                <div>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-c-text-muted">
                    {isPolish ? 'Zakres (dane strukturalne)' : 'Scope (structured data)'}
                  </div>
                  {renderGenericKeyValue(c.scopeJson)}
                </div>
              ) : null}
            </div>
          );
        }
        case 'limitations': {
          const items = s.content as string[];
          if (!items.length) return <p className="text-sm text-c-text-muted">{isPolish ? 'Brak ograniczeń.' : 'No limitations.'}</p>;
          return (
            <ul className="list-disc space-y-1 pl-5 text-sm text-c-text">
              {items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          );
        }
        case 'findings_by_severity': {
          const entries = s.content as GroupEntry<FindingLike>[];
          return renderFindingGroups(entries, (key) =>
            key === 'unclassified' ? (isPolish ? 'Nieokreślona' : 'Unspecified') : findingSeverityLabel(key as any, isPolish)
          );
        }
        case 'findings_by_area': {
          const entries = s.content as GroupEntry<FindingLike>[];
          return renderFindingGroups(entries, (key) => key);
        }
        case 'objective_evidence_references': {
          const rows = s.content as EvidenceReferenceRow[];
          if (!rows.length) return <p className="text-sm text-c-text-muted">{isPolish ? 'Brak odniesień do dowodów.' : 'No evidence references.'}</p>;
          return (
            <SimpleTable
              head={[isPolish ? 'Ustalenie' : 'Finding', isPolish ? 'Dowody' : 'Evidence']}
              rows={rows.map((r) => [findingLabel(r.findingId), r.evidenceTitles.length ? r.evidenceTitles.join('; ') : '—'])}
            />
          );
        }
        case 'systemic_conclusions':
        case 'systemic_themes': {
          const items = s.content as SystemicConclusion[];
          if (!items.length) {
            return <p className="text-sm text-c-text-muted">{isPolish ? 'Nie wykryto tematów systemowych.' : 'No systemic themes detected.'}</p>;
          }
          return (
            <div className="flex flex-col gap-3">
              {items.map((item, i) => (
                <div key={i} className="rounded-lg border border-c-border-subtle p-3">
                  <div className="text-sm font-semibold text-c-text">{item.theme}</div>
                  <p className="mt-1 text-xs text-c-text-secondary">{item.description}</p>
                  <div className="mt-1 text-[11px] text-c-text-muted">
                    {item.findingIds.length
                      ? `${isPolish ? 'Obejmuje: ' : 'Covers: '}${item.findingIds.map((id) => findingLabel(id)).join('; ')}`
                      : isPolish
                        ? 'Brak powiązanych ustaleń'
                        : 'No linked findings'}
                  </div>
                </div>
              ))}
            </div>
          );
        }
        case 'corrective_action_plan':
        case 'remediation_priorities':
        case 'timeline': {
          return renderActionsTable(s.content as ActionLike[]);
        }
        case 'verification_plan': {
          return renderVerificationTable(s.content as VerificationPlanEntry[]);
        }
        case 'appendices': {
          const c = s.content as AppendicesContent;
          return (
            <div className="flex flex-col gap-4">
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-c-text-muted">{isPolish ? 'Zespół audytowy' : 'Audit team'}</div>
                {c.team.length ? (
                  <SimpleTable
                    head={[isPolish ? 'Osoba' : 'Person', isPolish ? 'Rola' : 'Role', isPolish ? 'Niezależność zadeklarowana' : 'Independence declared', isPolish ? 'Przypisano' : 'Assigned']}
                    rows={c.team.map((m) => [
                      userNameById.get(m.userId) || m.userId,
                      auditRoleLabel(m.role, isPolish),
                      m.independenceDeclared ? (isPolish ? 'Tak' : 'Yes') : (isPolish ? 'Nie' : 'No'),
                      <span key="assigned" className="tabular-nums">
                        {m.assignedAt ? formatListDate(m.assignedAt) : '—'}
                      </span>,
                    ])}
                  />
                ) : (
                  <p className="text-sm text-c-text-muted">{isPolish ? 'Brak przypisanego zespołu.' : 'No team assigned.'}</p>
                )}
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-c-text-muted">{isPolish ? 'Rejestr dowodów' : 'Evidence register'}</div>
                {c.evidenceRegister.length ? (
                  <SimpleTable
                    head={[
                      isPolish ? 'Dowód' : 'Evidence',
                      isPolish ? 'Rodzaj' : 'Kind',
                      isPolish ? 'Kryterium' : 'Criterion',
                      isPolish ? 'Wystarczalność' : 'Sufficiency',
                      isPolish ? 'Wiarygodność' : 'Reliability',
                    ]}
                    rows={c.evidenceRegister.map((e) => [
                      e.title,
                      (EVIDENCE_KIND_LABEL[e.evidenceKind] && (isPolish ? EVIDENCE_KIND_LABEL[e.evidenceKind].pl : EVIDENCE_KIND_LABEL[e.evidenceKind].en)) ||
                        e.evidenceKind,
                      (e.criterionId && criterionTitleById.get(e.criterionId)) || '—',
                      (e.sufficiency && (isPolish ? SUFFICIENCY_LABEL[e.sufficiency]?.pl : SUFFICIENCY_LABEL[e.sufficiency]?.en)) || e.sufficiency || '—',
                      (e.reliability && (isPolish ? RELIABILITY_LABEL[e.reliability]?.pl : RELIABILITY_LABEL[e.reliability]?.en)) || e.reliability || '—',
                    ])}
                  />
                ) : (
                  <p className="text-sm text-c-text-muted">{isPolish ? 'Rejestr dowodów jest pusty.' : 'The evidence register is empty.'}</p>
                )}
              </div>
            </div>
          );
        }
        case 'traceability_matrix': {
          const rows = s.content as TraceabilityRow[];
          if (!rows.length) return <p className="text-sm text-c-text-muted">{isPolish ? 'Brak wierszy macierzy.' : 'No matrix rows.'}</p>;
          return (
            <SimpleTable
              head={[
                isPolish ? 'Kryterium' : 'Criterion',
                isPolish ? 'Dowody' : 'Evidence',
                isPolish ? 'Wynik testu' : 'Test result',
                isPolish ? 'Wniosek audytora' : "Auditor's conclusion",
                isPolish ? 'Ustalenie' : 'Finding',
                isPolish ? 'Działania' : 'Actions',
                isPolish ? 'Weryfikacje' : 'Verifications',
              ]}
              rows={rows.map((r) => [
                r.criterionRef || r.criterionTitle ? `${r.criterionRef ? `${r.criterionRef} — ` : ''}${r.criterionTitle || ''}` : '—',
                r.evidenceTitles.length ? r.evidenceTitles.join('; ') : '—',
                (r.testResult && (isPolish ? TEST_RESULT_LABEL[r.testResult]?.pl : TEST_RESULT_LABEL[r.testResult]?.en)) || r.testResult || '—',
                r.auditorConclusion || '—',
                r.findingStatement,
                r.actionTitles.length ? r.actionTitles.join('; ') : '—',
                r.verificationResults.length
                  ? r.verificationResults
                      .map((res) => (res ? (isPolish ? VERIFICATION_RESULT_LABEL[res]?.pl : VERIFICATION_RESULT_LABEL[res]?.en) ?? res : isPolish ? 'W toku' : 'Pending'))
                      .join('; ')
                  : '—',
              ])}
            />
          );
        }
        // ---- presentation (renderPresentationView, reportRenderer.ts:688) ----
        case 'findings_distribution': {
          const rows = s.content as SeverityCount[];
          return (
            <SimpleTable
              head={[isPolish ? 'Istotność' : 'Severity', isPolish ? 'Liczba' : 'Count']}
              rows={rows.map((r) => [
                <StatusChip key="sev" label={findingSeverityLabel(r.severity as any, isPolish)} tone={findingSeverityTone(r.severity as any)} />,
                <span key="count" className="tabular-nums">
                  {r.count}
                </span>,
              ])}
            />
          );
        }
        case 'critical_findings': {
          const items = s.content as FindingLike[];
          if (!items.length) return <p className="text-sm text-c-text-muted">{isPolish ? 'Brak ustaleń krytycznych.' : 'No critical findings.'}</p>;
          return <div className="flex flex-col gap-3">{items.map((f) => renderFindingCard(f))}</div>;
        }
        case 'critical_evidence': {
          return renderEvidenceList(s.content as EvidenceLike[]);
        }
        case 'accountabilities': {
          const items = s.content as Accountability[];
          if (!items.length) return <p className="text-sm text-c-text-muted">{isPolish ? 'Brak przypisanych odpowiedzialności.' : 'No assigned accountabilities.'}</p>;
          return (
            <SimpleTable
              head={[isPolish ? 'Właściciel' : 'Owner', isPolish ? 'Ustalenia' : 'Findings', isPolish ? 'Działania' : 'Actions']}
              rows={items.map((a) => [
                userNameById.get(a.ownerUserId) || (isPolish ? 'Nieprzypisany' : 'Unassigned'),
                <span key="f" className="tabular-nums">
                  {a.findingIds.length}
                </span>,
                <span key="a" className="tabular-nums">
                  {a.actionIds.length}
                </span>,
              ])}
            />
          );
        }
        default:
          // Unrecognised id (e.g. remediation_progress's 6 sections, or a
          // future report kind) — render honestly by `kind` instead of "—".
          return renderGenericByKind(s);
      }
    },
    [
      section,
      isPolish,
      renderFindingGroups,
      renderFindingCard,
      renderEvidenceList,
      renderActionsTable,
      renderVerificationTable,
      findingLabel,
      criterionTitleById,
      userNameById,
    ]
  );

  const SECTION_ICON: Record<string, React.FC<{ size?: number; className?: string }>> = {
    executive_summary: FileText,
    scope: Target,
    methodology: BookOpen,
    limitations: AlertTriangle,
    overall_conclusion: CheckCircle2,
    findings_by_severity: BarChart3,
    findings_by_area: Layers,
    objective_evidence_references: FileSearch,
    systemic_conclusions: Lightbulb,
    corrective_action_plan: ListChecks,
    verification_plan: ShieldCheck,
    appendices: Paperclip,
    traceability_matrix: GitBranch,
    conclusion: FileText,
    systemic_themes: Lightbulb,
    findings_distribution: BarChart3,
    critical_findings: AlertTriangle,
    critical_evidence: ShieldAlert,
    remediation_priorities: ListChecks,
    timeline: Clock,
    accountabilities: Users,
  };

  const sections: NModeSection[] = useMemo(
    () =>
      (activeDocument?.sections ?? []).map((s) => ({
        id: s.id,
        icon: SECTION_ICON[s.id] ?? (KNOWN_SECTION_IDS.has(s.id) ? FileText : FileSearch),
        label: { pl: s.title, en: s.title },
        alwaysShow: true,
        component: renderSectionContent(s.id),
      })),
    [activeDocument, renderSectionContent]
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <LoadingState template="panel" label={isPolish ? 'Wczytywanie raportu…' : 'Loading report…'} />
      </div>
    );
  }

  if (error || !report || !fullDocument) {
    return (
      <div className="p-6">
        <ErrorState
          title={isPolish ? 'Nie udało się wczytać raportu' : 'Could not load the report'}
          description={error || undefined}
          onRetry={load}
          onBack={goBack}
          backLabel={isPolish ? 'Wróć do listy raportów' : 'Back to reports'}
        />
      </div>
    );
  }

  const canApprove = report.status === 'draft' || report.status === 'in_review';
  const canPublish = report.status === 'approved';
  const activeReportKind = activeDocument?.reportKind ?? report.reportKind;

  const header: NModeHeaderConfig = {
    title: report.title,
    onTitleChange: () => {},
    titleReadOnly: true,
    artifactType: 'report',
    artifactId: report.id,
    onSave: () => {},
    saveState: 'saved',
    onClose: goBack,
    statusLabel: reportStatusLabel(report.status, isPolish),
    statusTone: headerStatusTone(report.status),
    primaryAction: canApprove
      ? {
          label: { pl: 'Zatwierdź', en: 'Approve' },
          icon: CheckCircle2,
          onClick: () => void runTransition('approve'),
          disabled: transitioning !== null,
        }
      : canPublish
        ? {
            label: { pl: 'Opublikuj', en: 'Publish' },
            icon: Send,
            onClick: () => void runTransition('publish'),
            disabled: transitioning !== null,
          }
        : undefined,
    // R1: przełącznik trybu — kebab Menu 1 (`secondaryActions` na
    // `NModeHeaderConfig` istnieje w typie, ale `NModeHeader.tsx` go
    // destrukturyzuje i NIGDY nie renderuje — martwy prop, potwierdzone
    // niezależnym, PRZEDISTNIEJĄCYM czerwonym testem
    // `NModeLayout/__tests__/NModeHeader.ownerActions.test.tsx`, dług spoza
    // zakresu tej naprawy. `extraOverflowItems` NIE ma tej wady — realnie
    // renderuje `HeaderOverflowMenu`, sam zarządza swoim stanem otwarcia).
    extraOverflowItems: [
      viewMode === 'full'
        ? {
            id: 'switch-to-presentation',
            label: isPolish ? 'Przełącz na widok dla zarządu' : 'Switch to executive view',
            icon: PresentationIcon,
            onClick: switchToPresentation,
          }
        : {
            id: 'switch-to-full',
            label: isPolish ? 'Przełącz na pełny raport' : 'Switch to full report',
            icon: FileText,
            onClick: switchToFull,
          },
      {
        id: 'open-reports-list',
        label: isPolish ? 'Otwórz listę raportów' : 'Open reports list',
        icon: ExternalLink,
        onClick: goBack,
      },
    ],
  };

  const propertyRows: ArtifactPropertyRow[] = [
    { id: 'program', label: 'Program', value: programName || report.programName || '—' },
    {
      id: 'reportKind',
      // R1: mówi prawdę PER TRYB — treść aktywnie wyświetlanego dokumentu, nie report.reportKind.
      label: isPolish ? 'Rodzaj' : 'Kind',
      value:
        (REPORT_KIND_LABEL[activeReportKind] && (isPolish ? REPORT_KIND_LABEL[activeReportKind].pl : REPORT_KIND_LABEL[activeReportKind].en)) ||
        activeReportKind,
    },
    { id: 'version', label: isPolish ? 'Wersja' : 'Version', value: String(report.version), mono: true },
    {
      id: 'status',
      label: 'Status',
      value: <StatusChip label={reportStatusLabel(report.status, isPolish)} tone={headerStatusTone(report.status) === 'approved' ? 'success' : headerStatusTone(report.status) === 'review' ? 'warning' : headerStatusTone(report.status) === 'rejected' ? 'danger' : 'neutral'} />,
    },
    { id: 'language', label: isPolish ? 'Język' : 'Language', value: report.language?.toUpperCase() || '—' },
    { id: 'audience', label: isPolish ? 'Odbiorca' : 'Audience', value: report.audience || '—' },
    { id: 'confidentiality', label: isPolish ? 'Poufność' : 'Confidentiality', value: report.confidentiality || '—' },
    { id: 'approvedAt', label: isPolish ? 'Data zatwierdzenia' : 'Approved at', value: formatListDate(report.approvedAt), mono: true },
    { id: 'publishedAt', label: isPolish ? 'Data publikacji' : 'Published at', value: formatListDate(report.publishedAt), mono: true },
    { id: 'updatedAt', label: isPolish ? 'Zaktualizowano' : 'Updated', value: formatListDate(report.updatedAt), mono: true },
  ];

  const rightPanelSections: ArtifactRightPanelSection[] = [
    {
      id: 'actions',
      label: isPolish ? 'Akcje' : 'Actions',
      defaultOpen: true,
      children: (
        <div className="flex flex-col gap-2">
          {transitionError ? (
            <div className="rounded-lg border border-c-danger/30 bg-c-danger/5 px-3 py-2 text-xs text-c-danger">
              {transitionError}
            </div>
          ) : null}
          {exportError ? (
            <div className="rounded-lg border border-c-danger/30 bg-c-danger/5 px-3 py-2 text-xs text-c-danger" role="alert">
              {exportError}
            </div>
          ) : null}
          <button
            type="button"
            disabled={!canApprove || transitioning !== null}
            onClick={() => void runTransition('approve')}
            className="flex items-center justify-center gap-2 rounded-lg border border-c-border px-3 py-2 text-xs font-medium text-c-text transition-colors hover:bg-c-surface-raised disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            <CheckCircle2 size={14} />
            {isPolish ? 'Zatwierdź' : 'Approve'}
          </button>
          {!canApprove ? (
            <p className="text-[11px] text-c-text-muted">
              {isPolish
                ? `Wymagany status „szkic” lub „w przeglądzie” (obecny: ${reportStatusLabel(report.status, true)}).`
                : `Requires draft or in-review status (current: ${reportStatusLabel(report.status, false)}).`}
            </p>
          ) : null}
          <button
            type="button"
            disabled={!canPublish || transitioning !== null}
            onClick={() => void runTransition('publish')}
            className="flex items-center justify-center gap-2 rounded-lg border border-c-border px-3 py-2 text-xs font-medium text-c-text transition-colors hover:bg-c-surface-raised disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            <Send size={14} />
            {isPolish ? 'Opublikuj' : 'Publish'}
          </button>
          {!canPublish ? (
            <p className="text-[11px] text-c-text-muted">
              {isPolish
                ? `Wymagany status „zatwierdzony” (obecny: ${reportStatusLabel(report.status, true)}).`
                : `Requires approved status (current: ${reportStatusLabel(report.status, false)}).`}
            </p>
          ) : null}
          {reportChainEnabled ? (
            <button
              type="button"
              disabled={exportingDocx}
              onClick={() => void downloadDocx()}
              className="flex items-center justify-center gap-2 rounded-lg border border-c-border px-3 py-2 text-xs font-medium text-c-text transition-colors hover:bg-c-surface-raised disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            >
              {exportingDocx ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {isPolish ? 'Pobierz DOCX' : 'Download DOCX'}
            </button>
          ) : null}
          {reportChainEnabled ? (
            <button
              type="button"
              disabled={exportingPdf}
              onClick={() => void downloadPdf()}
              className="flex items-center justify-center gap-2 rounded-lg border border-c-border px-3 py-2 text-xs font-medium text-c-text transition-colors hover:bg-c-surface-raised disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            >
              {exportingPdf ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {isPolish ? 'Pobierz PDF' : 'Download PDF'}
            </button>
          ) : null}
        </div>
      ),
    },
    {
      id: 'properties',
      label: isPolish ? 'Właściwości' : 'Properties',
      defaultOpen: true,
      children: (
        <ArtifactPropertiesTable
          rows={propertyRows}
          propertyLabel={isPolish ? 'Właściwość' : 'Property'}
          valueLabel={isPolish ? 'Wartość' : 'Value'}
        />
      ),
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="audit-report-document-view">
      <ArtifactBreadcrumb
        items={[
          { label: isPolish ? 'Audyty' : 'Audits', onClick: goBack },
          { label: isPolish ? 'Raporty' : 'Reports', onClick: goBack },
          { label: report.title },
        ]}
      />
      <div className="min-h-0 flex-1">
        {sections.length === 0 ? (
          <div className="p-6">
            {viewMode === 'presentation' && presentationLoading ? (
              <LoadingState template="panel" label={isPolish ? 'Wczytywanie widoku dla zarządu…' : 'Loading the executive view…'} />
            ) : viewMode === 'presentation' && presentationError ? (
              <ErrorState
                title={isPolish ? 'Nie udało się wczytać widoku dla zarządu' : 'Could not load the executive view'}
                description={presentationError}
                onRetry={switchToPresentation}
              />
            ) : (
              <EmptyState
                variant="new"
                icon={FileText}
                title={isPolish ? 'Dokument raportu jest pusty' : 'The report document is empty'}
                description={
                  isPolish
                    ? 'Aktywny dokument nie zwrócił żadnej sekcji dla tego raportu.'
                    : 'The active document returned no sections for this report.'
                }
              />
            )}
          </div>
        ) : (
          <NModeShell
            header={header}
            sections={sections}
            activeSection={activeSection}
            onSectionChange={setActiveSection}
            presentationMode="n"
            onPresentationModeChange={() => {}}
            showModeSwitcher={false}
            rightPanel={
              // DEC-419 (06.09.2026): przycisk „Zapytaj Teresę o ten raport audytu"
              // usunięty z sekcji Akcje — wejście do Teresy jest w Menu 1 (DEC-404).
              <ArtifactRightPanel
                sections={rightPanelSections}
                ariaLabel={isPolish ? 'Panel raportu' : 'Report panel'}
                className={ARTIFACT_PANEL_CARD_CLASS_DOCKED}
              />
            }
          />
        )}
      </div>
    </div>
  );
};

export default AuditReportDocumentView;
