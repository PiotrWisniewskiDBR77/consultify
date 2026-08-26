/**
 * AuditReportDocumentView — U5 pełny widok treści raportu audytu (ekran-
 * artefakt SPEC-A, archetyp B „Dokument").
 *
 * NAPRAWA 2 (panel ekspercki 2026-08-26, moduł Audyty 6,0/10): podglądu
 * raportu w `AuditReportsTab` nie dało się przeczytać — pokazywał wyłącznie
 * tytuł, status i pigułkę właściwości (`StandardPreview`). Pełny widok
 * `DRDAuditReportView` (inny silnik, `GET /assessment-reports/:id/full`) jest
 * za osobną flagą OFF i przekierowuje do listy — to NIE jest ten sam kontrakt.
 *
 * Backend GOTOWY i nieużywany: `GET /audits/reports/:id/presentation`
 * (`server/src/routes/audits/reports.routes.ts:44`) renderuje LIVE, z
 * Outputu powiązanego z raportem, przez czysty, deterministyczny
 * `reportRenderer.renderPresentationView` (`reportRenderer.ts:661`) — zwraca
 * ZAWSZE `reportKind: 'presentation'`, osiem sekcji o stałych `id`
 * (conclusion/systemic_themes/findings_distribution/critical_findings/
 * critical_evidence/remediation_priorities/timeline/accountabilities),
 * niezależnie od `reportKind` samego raportu. Ten widok renderuje TĘ
 * strukturę — nic więcej nie zgaduje.
 *
 * Powłoka wspólna SPEC-A (§10.2/§11.2, `consultify-artefakty`): Menu 1 =
 * `ArtifactBreadcrumb` + `NModeShell`'s header (tytuł, status lifecycle,
 * JEDEN primary — Zatwierdź/Opublikuj, te same bramkowane endpointy co kebab
 * listy `AuditReportsTab`). Centrum = `NModeShell`'s left-nav + osiem sekcji
 * dokumentu. Prawy panel = `ArtifactRightPanel`, WYŁĄCZNIE sekcje mające
 * zastosowanie (Akcje, Właściwości) — Powiązania/Komentarze/Historia pominięte
 * (brak danych z backendu = brak sekcji, nigdy atrapa).
 *
 * Zero surowych ID na twarzy: `criterionId`/`ownerUserId`/`objectiveEvidence`
 * (same ID w payloadzie) są rozwiązywane do tytułów/nazw przez dodatkowe,
 * REALNE odczyty — `listProgramCriteria`/`listEvidence`/`getProgram`/
 * `Api.getUsers()` — dokładnie ten sam wzorzec co `AuditFindingsTab`.
 *
 * Eksport PDF ŚWIADOMIE pominięty (osobny, droższy blok — poza zakresem tej
 * naprawy) — widoczny jako wyszarzały wiersz z notatką „Planowane" w sekcji
 * Akcje prawego panelu, NIGDY jako działający przycisk.
 */
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Lightbulb,
  ListChecks,
  Send,
  ShieldAlert,
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

import {
  actionKindLabel,
  actionStatusLabel,
  actionStatusTone,
  findingClassificationLabel,
  findingClassificationTone,
  findingSeverityLabel,
  findingSeverityTone,
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

/** Mirror NModeHeaderConfig's tone union (distinct from `StatusTone` — no `info`/`danger`/`success`, only draft/review/approved/rejected/neutral). */
function headerStatusTone(status: AuditReportStatus): 'draft' | 'review' | 'approved' | 'rejected' | 'neutral' {
  if (status === 'draft') return 'draft';
  if (status === 'in_review') return 'review';
  if (status === 'approved' || status === 'published') return 'approved';
  return 'neutral';
}

// -----------------------------------------------------------------------
// Kształty sekcji `renderPresentationView` (`reportRenderer.ts:661`) —
// mirror pól JSON, WYŁĄCZNIE te odczytywane tutaj.
// -----------------------------------------------------------------------

interface PresentationFinding {
  id: string;
  referenceCode: string | null;
  statement: string;
  criterionId: string | null;
  classification: string;
  severity: string | null;
  objectiveEvidence: string[];
  ownerUserId: string | null;
}
interface PresentationEvidence {
  id: string;
  title: string;
  evidenceKind: string;
  criterionId: string | null;
}
interface PresentationAction {
  id: string;
  findingId: string;
  actionKind: string;
  title: string;
  ownerUserId: string | null;
  dueDate: string | null;
  status: string;
}
interface PresentationSystemic {
  theme: string;
  findingIds: string[];
  description: string;
}
interface PresentationSeverityCount {
  severity: string;
  count: number;
}
interface PresentationAccountability {
  ownerUserId: string;
  findingIds: string[];
  actionIds: string[];
}

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

export const AuditReportDocumentView: React.FC<AuditReportDocumentViewProps> = ({ reportId }) => {
  const navigate = useNavigate();
  const isPolish = true; // treść dokumentu (reportRenderer.ts) jest ZAWSZE PL — chrom ekranu podąża za tym

  const [report, setReport] = useState<AuditReportSummary | null>(null);
  const [reportDocument, setReportDocument] = useState<AuditReportDocument | null>(null);
  const [programName, setProgramName] = useState<string | null>(null);
  const [criteria, setCriteria] = useState<AuditCriterionSummary[]>([]);
  const [evidence, setEvidence] = useState<AuditEvidenceSummary[]>([]);
  const [userNameById, setUserNameById] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string>('conclusion');
  const [transitioning, setTransitioning] = useState<'approve' | 'publish' | null>(null);
  const [transitionError, setTransitionError] = useState<string | null>(null);

  const goBack = useCallback(() => navigate('/audit-programs?tab=reports'), [navigate]);

  const load = useCallback(() => {
    if (!reportId) {
      setError(isPolish ? 'Brak identyfikatora raportu w adresie.' : 'Missing report id in the URL.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    Promise.all([getReport(reportId), getReportPresentation(reportId)])
      .then(async ([reportResult, doc]) => {
        if (!reportResult) throw new Error(isPolish ? 'Raport nie został znaleziony.' : 'Report not found.');
        setReport(reportResult);
        setReportDocument(doc);
        setActiveSection(doc.sections[0]?.id ?? 'conclusion');
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

  const section = (id: string): AuditReportDocumentSection | undefined => reportDocument?.sections.find((s) => s.id === id);

  const renderSectionContent = useCallback(
    (id: string): React.ReactNode => {
      const s = section(id);
      if (!s) return null;
      switch (id) {
        case 'conclusion': {
          return <p className="text-sm leading-relaxed text-c-text">{String(s.content)}</p>;
        }
        case 'systemic_themes': {
          const items = s.content as PresentationSystemic[];
          if (!items.length) {
            return (
              <p className="text-sm text-c-text-muted">
                {isPolish ? 'Nie wykryto tematów systemowych.' : 'No systemic themes detected.'}
              </p>
            );
          }
          return (
            <div className="flex flex-col gap-3">
              {items.map((item, i) => (
                <div key={i} className="rounded-lg border border-c-border-subtle p-3">
                  <div className="text-sm font-semibold text-c-text">{item.theme}</div>
                  <p className="mt-1 text-xs text-c-text-secondary">{item.description}</p>
                  <div className="mt-1 text-[11px] text-c-text-muted">
                    {isPolish ? `Obejmuje ${item.findingIds.length} ustaleń` : `Covers ${item.findingIds.length} findings`}
                  </div>
                </div>
              ))}
            </div>
          );
        }
        case 'findings_distribution': {
          const rows = s.content as PresentationSeverityCount[];
          return (
            <SimpleTable
              head={[isPolish ? 'Istotność' : 'Severity', isPolish ? 'Liczba' : 'Count']}
              rows={rows.map((r) => [
                <StatusChip
                  key="sev"
                  label={findingSeverityLabel(r.severity as any, isPolish)}
                  tone={findingSeverityTone(r.severity as any)}
                />,
                <span key="count" className="tabular-nums">
                  {r.count}
                </span>,
              ])}
            />
          );
        }
        case 'critical_findings': {
          const items = s.content as PresentationFinding[];
          if (!items.length) {
            return (
              <p className="text-sm text-c-text-muted">
                {isPolish ? 'Brak ustaleń krytycznych.' : 'No critical findings.'}
              </p>
            );
          }
          return (
            <div className="flex flex-col gap-3">
              {items.map((f) => (
                <div key={f.id} className="rounded-lg border border-c-border-subtle p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-mono text-c-text-muted">{f.referenceCode || f.id}</span>
                    <StatusChip label={findingClassificationLabel(f.classification, isPolish)} tone={findingClassificationTone(f.classification)} />
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
                        {f.objectiveEvidence.length
                          ? f.objectiveEvidence.map((id) => evidenceTitleById.get(id) || id).join('; ')
                          : '—'}
                      </dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
          );
        }
        case 'critical_evidence': {
          const items = s.content as PresentationEvidence[];
          if (!items.length) {
            return (
              <p className="text-sm text-c-text-muted">
                {isPolish ? 'Brak dowodów przeczących zgodności.' : 'No evidence contradicting conformity.'}
              </p>
            );
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
        }
        case 'remediation_priorities':
        case 'timeline': {
          const items = s.content as PresentationAction[];
          if (!items.length) {
            return (
              <p className="text-sm text-c-text-muted">
                {isPolish ? 'Brak działań do pokazania.' : 'No actions to show.'}
              </p>
            );
          }
          return (
            <SimpleTable
              head={[
                isPolish ? 'Działanie' : 'Action',
                isPolish ? 'Rodzaj' : 'Kind',
                isPolish ? 'Właściciel' : 'Owner',
                isPolish ? 'Termin' : 'Due date',
                isPolish ? 'Status' : 'Status',
              ]}
              rows={items.map((a) => [
                a.title,
                actionKindLabel(a.actionKind as any, isPolish),
                (a.ownerUserId && userNameById.get(a.ownerUserId)) || (isPolish ? 'Nieprzypisany' : 'Unassigned'),
                <span key="due" className="tabular-nums">
                  {a.dueDate ? formatListDate(a.dueDate) : '—'}
                </span>,
                <StatusChip key="status" label={actionStatusLabel(a.status as any, isPolish)} tone={actionStatusTone(a.status as any)} />,
              ])}
            />
          );
        }
        case 'accountabilities': {
          const items = s.content as PresentationAccountability[];
          if (!items.length) {
            return (
              <p className="text-sm text-c-text-muted">
                {isPolish ? 'Brak przypisanych odpowiedzialności.' : 'No assigned accountabilities.'}
              </p>
            );
          }
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
          return <p className="text-sm text-c-text-muted">—</p>;
      }
    },
    [reportDocument, isPolish, criterionTitleById, evidenceTitleById, userNameById]
  );

  const SECTION_ICON: Record<string, React.FC<{ size?: number; className?: string }>> = {
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
      (reportDocument?.sections ?? []).map((s) => ({
        id: s.id,
        icon: SECTION_ICON[s.id] ?? FileText,
        label: { pl: s.title, en: s.title },
        alwaysShow: true,
        component: renderSectionContent(s.id),
      })),
    [reportDocument, renderSectionContent]
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <LoadingState template="panel" label={isPolish ? 'Wczytywanie raportu…' : 'Loading report…'} />
      </div>
    );
  }

  if (error || !report || !reportDocument) {
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
    extraOverflowItems: [
      {
        id: 'open-reports-list',
        label: isPolish ? 'Otwórz listę raportów' : 'Open reports list',
        icon: ExternalLink,
        onClick: goBack,
      },
    ],
  };

  const propertyRows: ArtifactPropertyRow[] = [
    { id: 'program', label: isPolish ? 'Program' : 'Program', value: programName || report.programName || '—' },
    {
      id: 'reportKind',
      label: isPolish ? 'Rodzaj' : 'Kind',
      value:
        (REPORT_KIND_LABEL[report.reportKind] && (isPolish ? REPORT_KIND_LABEL[report.reportKind].pl : REPORT_KIND_LABEL[report.reportKind].en)) ||
        report.reportKind,
    },
    { id: 'version', label: isPolish ? 'Wersja' : 'Version', value: String(report.version), mono: true },
    {
      id: 'status',
      label: isPolish ? 'Status' : 'Status',
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
          <div className="mt-1 flex items-center justify-between rounded-lg border border-c-border-subtle px-3 py-2 opacity-60">
            <span className="text-xs text-c-text-muted">{isPolish ? 'Eksport PDF' : 'PDF export'}</span>
            <span className="text-[10px] font-medium text-c-text-muted">{isPolish ? 'Planowane' : 'Planned'}</span>
          </div>
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
            <EmptyState
              variant="new"
              icon={FileText}
              title={isPolish ? 'Dokument raportu jest pusty' : 'The report document is empty'}
              description={
                isPolish
                  ? 'Widok prezentacyjny nie zwrócił żadnej sekcji dla tego raportu.'
                  : 'The presentation view returned no sections for this report.'
              }
            />
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
