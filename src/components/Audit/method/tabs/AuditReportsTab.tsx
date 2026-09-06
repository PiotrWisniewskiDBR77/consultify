/**
 * AuditReportsTab — U7 Reports surface: raporty audytu (`AuditReport`) —
 * `audit_report`/`remediation_progress`, wersjonowane, wystawiane z Outputu.
 *
 * DEC-2026-08-25-66 (Piotr, werdykt partii D, uwaga 2): tabela nie miała
 * prawego kebaba wiersza w ogóle (brak propu `rowMenu` → `StandardTable`
 * renderuje `hideRowActions`, patrz `StandardTable.tsx` #576). Dodano
 * kanoniczny kebab (kontrakt `StandardRowMenu`, wzór z `AuditLibraryTab`/
 * Tools) z REALNYMI przejściami stanu — `POST /reports/:id/approve` i
 * `POST /reports/:id/publish` istnieją i są bramkowane na backendzie
 * (`reportService.approveReport`/`publishReport`) — plus podgląd
 * (StandardPreview, wzorem Outputs) i uczciwie disabled Edit/Archive/Delete
 * z powodem (raport jest wersjonowanym renderem Outputu — nie ma API do
 * ręcznej edycji/archiwizacji/usunięcia pojedynczego wiersza; poprawka to
 * zawsze NOWA wersja, `reportService.supersedeReport`, poza zakresem
 * pojedynczego wiersza tej listy).
 */
import { CheckCircle2, FileText, Send } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  type StandardRowMenu,
  StandardPreview,
  StandardTable,
  type TableColumn,
  type TableRow,
} from '@/components/standard';
import { JedenPrawyPanel } from '@/components/shared/PreviewPane/JedenPrawyPanel';
import type { ArtifactPropertyRow } from '@/components/standard/ArtifactPropertiesTable';
import { ErrorState } from '@/components/shared/states';
import { StatusChip } from '@/components/ui/primitives/chips';
import { isAuditsFindingsAndReportViewEnabled } from '@/utils/auditsFindingsAndReportViewFlag';
import { formatListDate } from '@/utils/listDateFormat';

import { reportStatusLabel, reportStatusTone } from '../auditStatusTones';
import {
  approveReport,
  AUDIT_REPORT_STATUSES,
  listReports,
  publishReport,
  type AuditReportSummary,
} from '../auditsMethodApi';

export interface AuditReportsTabProps {
  isPolish: boolean;
  /**
   * `programId` → nazwa programu — `/api/audits/reports` nie wysyła
   * `programName` (`reportService.ts` mapowanie ma tylko `program_id`), więc
   * pole frontendowe zawsze renderowało się jako „—". Rozwiązywane tutaj z
   * danych, które Hub już wczytał (`programsAll`).
   */
  programNameById?: Map<string, string>;
  reloadToken?: number;
  /**
   * DEC-417b (1.1-A2): filtr statusu wybrany w Menu 3 / dropdownie Menu 2
   * Huba (`all` albo jedna z `AUDIT_REPORT_STATUSES`).
   */
  statusFilter?: string;
  /** Rozkład statusów dla liczników chipów/dropdownu Menu 2 (Hub rysuje). */
  onCountsChange?: (counts: Record<string, number>) => void;
}

const EMPTY_MAP = new Map<string, string>();

const REPORT_KIND_LABEL: Record<string, { pl: string; en: string }> = {
  audit_report: { pl: 'Raport audytu', en: 'Audit report' },
  remediation_progress: { pl: 'Postęp naprawy', en: 'Remediation progress' },
};

export const AuditReportsTab: React.FC<AuditReportsTabProps> = ({
  isPolish,
  programNameById = EMPTY_MAP,
  reloadToken = 0,
  statusFilter = 'all',
  onCountsChange,
}) => {
  const navigate = useNavigate();
  const [items, setItems] = useState<AuditReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState<string | null>(null);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [exportingFormat, setExportingFormat] = useState<'docx' | 'pdf' | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listReports()
      .then((result) => setItems(result.items))
      .catch((e: any) =>
        setError(
          e?.message || (isPolish ? 'Nie udało się wczytać raportów' : 'Failed to load reports')
        )
      )
      .finally(() => setLoading(false));
  }, [isPolish]);

  useEffect(() => {
    load();
  }, [load, reloadToken]);

  // Liczniki dla Menu 3/Menu 2 — z TEJ SAMEJ listy, którą widać w tabeli.
  useEffect(() => {
    const counts: Record<string, number> = { all: items.length };
    for (const status of AUDIT_REPORT_STATUSES) {
      counts[status] = items.filter((r) => r.status === status).length;
    }
    onCountsChange?.(counts);
  }, [items, onCountsChange]);

  const visibleItems = useMemo(
    () => (statusFilter === 'all' ? items : items.filter((r) => r.status === statusFilter)),
    [items, statusFilter]
  );

  const runTransition = useCallback(
    async (id: string, action: 'approve' | 'publish') => {
      setTransitioning(`${id}:${action}`);
      setTransitionError(null);
      try {
        const updated = action === 'approve' ? await approveReport(id) : await publishReport(id);
        if (updated) {
          setItems((prev) => prev.map((r) => (r.id === id ? updated : r)));
        } else {
          await load();
        }
      } catch (e: any) {
        setTransitionError(
          e?.message ||
            (isPolish
              ? 'Nie udało się zmienić statusu raportu'
              : 'Failed to change the report status')
        );
      } finally {
        setTransitioning(null);
      }
    },
    [isPolish, load]
  );

  /**
   * FIX-1 (dyżur 41, odbiór): `GET /reports/:id/export.docx` istniało od
   * dawna i renderowało realny DOCX (`renderDocumentSchemaToDocxBuffer`),
   * ale `grep -rn "export.docx" src/` dawał 0 trafień — żaden ekran nie
   * miał wołacza. Wzorzec pobierania (blob → tymczasowy `<a download>` →
   * revoke) skopiowany z `AuditReportDocumentView.tsx` (D.9), która ma tę
   * samą trasę spiętą w pełnym widoku raportu; tu dopinamy DRUGIE miejsce —
   * kanoniczny slot `⋮ Pobierz` w kebabie bloku Details podglądu
   * (`StandardPreviewDetails.onDownload`, patrz `StandardPreview.tsx`) —
   * żeby ścieżka istniała też z samej listy, bez otwierania pełnego widoku.
   */
  const downloadReportDocx = useCallback(
    async (report: AuditReportSummary) => {
      if (exportingId) return;
      setExportingId(report.id);
      setExportingFormat('docx');
      setExportError(null);
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(
          `/api/audits/reports/${encodeURIComponent(report.id)}/export.docx`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        );
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(
            payload.error ||
              (isPolish ? 'Nie udało się pobrać DOCX.' : 'Could not download the DOCX.')
          );
        }
        const blobUrl = URL.createObjectURL(await response.blob());
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `audit-report-${report.id}.docx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      } catch (e: any) {
        setExportError(
          e?.message || (isPolish ? 'Nie udało się pobrać DOCX.' : 'Could not download the DOCX.')
        );
      } finally {
        setExportingId(null);
        setExportingFormat(null);
      }
    },
    [exportingId, isPolish]
  );

  /**
   * FIX-187: bliźniak `downloadReportDocx` — trasa `.pdf` jest strukturalnym
   * bliźniakiem `.docx` (ten sam aktor/walidacja/kontekst/schemat, różnica
   * tylko renderer+Content-Type), więc wzorzec pobierania jest identyczny.
   * Kanoniczny slot na drugą pozycję kebaba: `details.extraActions`
   * (patrz `StandardPreview.tsx` — pozycje PO standardowych Copy/Export/Pobierz).
   */
  const downloadReportPdf = useCallback(
    async (report: AuditReportSummary) => {
      if (exportingId) return;
      setExportingId(report.id);
      setExportingFormat('pdf');
      setExportError(null);
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(
          `/api/audits/reports/${encodeURIComponent(report.id)}/export.pdf`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        );
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(
            payload.error ||
              (isPolish ? 'Nie udało się pobrać PDF.' : 'Could not download the PDF.')
          );
        }
        const blobUrl = URL.createObjectURL(await response.blob());
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `audit-report-${report.id}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      } catch (e: any) {
        setExportError(
          e?.message || (isPolish ? 'Nie udało się pobrać PDF.' : 'Could not download the PDF.')
        );
      } finally {
        setExportingId(null);
        setExportingFormat(null);
      }
    },
    [exportingId, isPolish]
  );

  const columns: TableColumn[] = [
    {
      id: 'title',
      label: isPolish ? 'Tytuł' : 'Title',
      render: (row: AuditReportSummary) => (
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-c-text">{row.title}</span>
          {/* PRZEWODY ODBIORU 2026-09-03: `text-c-text-muted` (#64748b) na
              11 px daje 4,02:1 na tle ZAZNACZONEGO wiersza (bg-state-selected,
              #ebecec) — poniżej progu WCAG AA 4,5:1 (axe, jeden węzeł, motyw
              jasny). Na tle niezaznaczonym przechodziło, więc defekt ujawniał
              się dopiero po kliknięciu wiersza. `text-c-text-secondary` to ten
              sam rejestr wizualny o stopień ciemniejszy — zdaje w obu stanach. */}
          <span className="text-[11px] text-c-text-secondary">
            {programNameById.get(row.programId) || row.programName || '—'}
          </span>
        </div>
      ),
    },
    {
      id: 'reportKind',
      label: isPolish ? 'Rodzaj' : 'Kind',
      width: '140px',
      dataType: 'status',
      render: (row: AuditReportSummary) => {
        const entry = REPORT_KIND_LABEL[row.reportKind];
        return (
          <span className="text-xs text-c-text-secondary">
            {entry ? (isPolish ? entry.pl : entry.en) : row.reportKind}
          </span>
        );
      },
    },
    { id: 'version', label: isPolish ? 'Wersja' : 'Version', width: '90px', dataType: 'status' },
    {
      id: 'status',
      label: 'Status',
      width: '130px',
      dataType: 'status',
      filterable: true,
      filterOptions: AUDIT_REPORT_STATUSES.map((value) => ({
        value,
        label: reportStatusLabel(value, isPolish),
      })),
      render: (row: AuditReportSummary) => (
        <StatusChip
          label={reportStatusLabel(row.status, isPolish)}
          tone={reportStatusTone(row.status)}
        />
      ),
    },
    {
      id: 'language',
      label: isPolish ? 'Język' : 'Language',
      width: '90px',
      dataType: 'status',
      render: (row: AuditReportSummary) => (
        <span className="text-xs text-c-text-secondary">{row.language?.toUpperCase() || '—'}</span>
      ),
    },
    {
      id: 'audience',
      label: isPolish ? 'Odbiorca' : 'Audience',
      width: '130px',
      dataType: 'status',
      render: (row: AuditReportSummary) => (
        <span
          className="text-xs text-c-text-secondary truncate block max-w-[130px]"
          title={row.audience || undefined}
        >
          {row.audience || '—'}
        </span>
      ),
    },
    {
      id: 'confidentiality',
      label: isPolish ? 'Poufność' : 'Confidentiality',
      width: '120px',
      dataType: 'status',
      render: (row: AuditReportSummary) => (
        <span
          className="text-xs text-c-text-secondary truncate block max-w-[120px]"
          title={row.confidentiality || undefined}
        >
          {row.confidentiality || '—'}
        </span>
      ),
    },
    {
      id: 'publishedAt',
      label: isPolish ? 'Data publikacji' : 'Published at',
      width: '180px',
      dataType: 'date',
      sortable: true,
      render: (row: AuditReportSummary) => (
        <span className="text-xs text-c-text-secondary tabular-nums">
          {formatListDate(row.publishedAt)}
        </span>
      ),
    },
    {
      id: 'updatedAt',
      label: isPolish ? 'Zaktualizowano' : 'Updated',
      width: '200px',
      dataType: 'date',
      sortable: true,
      render: (row: AuditReportSummary) => (
        <span className="text-xs text-c-text-secondary tabular-nums">
          {formatListDate(row.updatedAt)}
        </span>
      ),
    },
  ];

  // Kebab: kontrakt `StandardRowMenu` (context → manage → danger). Blok 2
  // (przejścia stanu) niesie WYŁĄCZNIE realne, bramkowane na backendzie
  // akcje — poza zakresem gate'u pokazujemy disabled z prawdziwym powodem
  // (`reportService.approveReport`/`publishReport`), nigdy nie ukrywamy.
  const rowMenu = (rawRow: TableRow): StandardRowMenu => {
    const row = rawRow as unknown as AuditReportSummary;
    const canApprove = row.status === 'draft' || row.status === 'in_review';
    const canPublish = row.status === 'approved';
    return {
      statusTransitions: [
        {
          id: 'approve',
          label: isPolish ? 'Zatwierdź' : 'Approve',
          icon: CheckCircle2,
          onClick: canApprove ? () => void runTransition(row.id, 'approve') : undefined,
          disabled: !canApprove || transitioning === `${row.id}:approve`,
          note: canApprove
            ? undefined
            : isPolish
              ? `Wymagany status „szkic” lub „w przeglądzie” (obecny: ${reportStatusLabel(row.status, true)})`
              : `Requires draft or in-review status (current: ${reportStatusLabel(row.status, false)})`,
        },
        {
          id: 'publish',
          label: isPolish ? 'Opublikuj' : 'Publish',
          icon: Send,
          onClick: canPublish ? () => void runTransition(row.id, 'publish') : undefined,
          disabled: !canPublish || transitioning === `${row.id}:publish`,
          note: canPublish
            ? undefined
            : isPolish
              ? `Wymagany status „zatwierdzony” (obecny: ${reportStatusLabel(row.status, true)})`
              : `Requires approved status (current: ${reportStatusLabel(row.status, false)})`,
        },
      ],
      universalHandlers: {
        preview: () => setSelectedId(row.id),
        editNote: isPolish
          ? 'Raport jest renderem Outputu — poprawka to nowa wersja, nie edycja tego wiersza.'
          : 'A report is a render of an Output — a correction is a new version, not an edit of this row.',
        archiveNote: isPolish
          ? 'Brak archiwizacji pojedynczego raportu — historia wersji jest już pełnym zapisem.'
          : 'No per-row archive — the version history is already the full record.',
      },
      destructive: {
        note: isPolish
          ? 'Raporty są nieusuwalne — ślad audytu.'
          : 'Reports cannot be deleted — immutable audit trail.',
      },
    };
  };

  const selected = items.find((r) => r.id === selectedId) || null;
  const selectedProperties: ArtifactPropertyRow[] | undefined = selected
    ? [
        {
          id: 'program',
          label: 'Program',
          value: programNameById.get(selected.programId) || selected.programName || '—',
        },
        {
          id: 'reportKind',
          label: isPolish ? 'Rodzaj' : 'Kind',
          value:
            (REPORT_KIND_LABEL[selected.reportKind] &&
              (isPolish
                ? REPORT_KIND_LABEL[selected.reportKind].pl
                : REPORT_KIND_LABEL[selected.reportKind].en)) ||
            selected.reportKind,
        },
        {
          id: 'version',
          label: isPolish ? 'Wersja' : 'Version',
          value: String(selected.version),
          mono: true,
        },
        {
          id: 'language',
          label: isPolish ? 'Język' : 'Language',
          value: selected.language?.toUpperCase() || '—',
        },
        {
          id: 'audience',
          label: isPolish ? 'Odbiorca' : 'Audience',
          value: selected.audience || '—',
        },
        {
          id: 'confidentiality',
          label: isPolish ? 'Poufność' : 'Confidentiality',
          value: selected.confidentiality || '—',
        },
        {
          id: 'approvedAt',
          label: isPolish ? 'Data zatwierdzenia' : 'Approved at',
          value: formatListDate(selected.approvedAt),
        },
        {
          id: 'publishedAt',
          label: isPolish ? 'Data publikacji' : 'Published at',
          value: formatListDate(selected.publishedAt),
        },
      ]
    : undefined;

  if (error) {
    return (
      <div className="p-4">
        <ErrorState
          title={isPolish ? 'Nie udało się wczytać raportów' : 'Could not load reports'}
          description={error}
          onRetry={load}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="flex-1 min-w-0 overflow-auto p-4">
        {transitionError ? (
          <div className="mb-2 rounded-lg border border-c-danger/30 bg-c-danger/5 px-3 py-2 text-xs text-c-danger">
            {transitionError}
          </div>
        ) : null}
        <StandardTable
          columns={columns}
          data={visibleItems}
          loading={loading}
          rowMenu={rowMenu}
          onRowClick={(row) => setSelectedId(String(row.id))}
          selectedRowId={selectedId}
          persistKey="audits.method.reports"
          // DEC-417d: opis mówi PRAWDĘ o dzisiejszej drodze — CTA „Nowy
          // raport" w Menu 2 (wynik → typ → Generuj) tworzy raport przez ten
          // sam generator, którego kebab tej tabeli używa do eksportu.
          empty={{
            icon: FileText,
            title: isPolish ? 'Brak raportów' : 'No reports yet',
            description: isPolish
              ? 'Raport poaudytowy powstaje z zatwierdzonego wyniku audytu. Zacznij od przycisku „Nowy raport” w pasku modułu.'
              : 'A post-audit report is generated from an approved audit output. Start with “New report” in the module bar.',
          }}
        />
      </div>
      <JedenPrawyPanel
        className="border-l border-c-border-subtle"
        rekord={selected ? (
          <StandardPreview
            title={selected.title}
            onClose={() => setSelectedId(null)}
            // NAPRAWA 2 (2026-08-26): pełny widok treści raportu
            // (`AuditReportDocumentView`, `/audit-programs/reports/:id`) —
            // flag-gated (`ff_auditsFindingsAndReportView`, default ON since 2026-08-27 owner accept).
            // Widoczne WYŁĄCZNIE gdy flaga ON, żeby nie pokazywać przycisku
            // wiodącego donikąd (route sam i tak przekierowuje, ale ukrycie
            // jest uczciwsze niż martwy klik).
            onOpenFull={
              isAuditsFindingsAndReportViewEnabled()
                ? () => navigate(`/audit-programs/reports/${encodeURIComponent(selected.id)}`)
                : undefined
            }
            openLabel={isPolish ? 'Otwórz pełny raport' : 'Open full report'}
            meta={{
              pills: [
                {
                  label: 'Status',
                  value: reportStatusLabel(selected.status, isPolish),
                  tone: reportStatusTone(selected.status),
                },
              ],
            }}
            details={{
              properties: selectedProperties,
              label: isPolish ? 'Szczegóły' : 'Details',
              propertyLabel: isPolish ? 'Właściwość' : 'Property',
              valueLabel: isPolish ? 'Wartość' : 'Value',
              // FIX-1 (dyżur 41, odbiór): kanoniczny slot „⋮ Pobierz".
              onDownload: () => void downloadReportDocx(selected),
              downloadLabel:
                exportingId === selected.id && exportingFormat === 'docx'
                  ? isPolish
                    ? 'Pobieranie…'
                    : 'Downloading…'
                  : isPolish
                    ? 'Pobierz DOCX'
                    : 'Download DOCX',
              // FIX-187: bliźniak powyższego slotu — druga pozycja kebaba,
              // kanoniczny `extraActions` (patrz `StandardPreview.tsx`,
              // renderowane PO standardowych Copy/Export/Pobierz).
              extraActions: [
                {
                  id: 'download-pdf',
                  label:
                    exportingId === selected.id && exportingFormat === 'pdf'
                      ? isPolish
                        ? 'Pobieranie…'
                        : 'Downloading…'
                      : isPolish
                        ? 'Pobierz PDF'
                        : 'Download PDF',
                  onClick: () => void downloadReportPdf(selected),
                  disabled: exportingId === selected.id && exportingFormat === 'pdf',
                },
              ],
            }}
          >
            {exportError ? (
              <div className="rounded-lg border border-c-danger/30 bg-c-danger/5 px-3 py-2 text-xs text-c-danger" role="alert">
                {exportError}
              </div>
            ) : null}
          </StandardPreview>
        ) : null}
      />
    </div>
  );
};

export default AuditReportsTab;
