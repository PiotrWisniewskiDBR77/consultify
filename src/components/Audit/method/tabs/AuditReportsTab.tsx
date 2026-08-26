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
import React, { useCallback, useEffect, useState } from 'react';

import {
  type StandardRowMenu,
  StandardPreview,
  StandardTable,
  type TableColumn,
  type TableRow,
} from '@/components/standard';
import type { ArtifactPropertyRow } from '@/components/standard/ArtifactPropertiesTable';
import { ErrorState } from '@/components/shared/states';
import { StatusChip } from '@/components/ui/primitives/chips';
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
}

const EMPTY_MAP = new Map<string, string>();

const REPORT_KIND_LABEL: Record<string, { pl: string; en: string }> = {
  audit_report: { pl: 'Raport audytu', en: 'Audit report' },
  remediation_progress: { pl: 'Postęp naprawy', en: 'Remediation progress' },
};

export const AuditReportsTab: React.FC<AuditReportsTabProps> = ({
  isPolish,
  programNameById = EMPTY_MAP,
}) => {
  const [items, setItems] = useState<AuditReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState<string | null>(null);
  const [transitionError, setTransitionError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listReports()
      .then((result) => setItems(result.items))
      .catch((e: any) => setError(e?.message || (isPolish ? 'Nie udało się wczytać raportów' : 'Failed to load reports')))
      .finally(() => setLoading(false));
  }, [isPolish]);

  useEffect(() => {
    load();
  }, [load]);

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
            (isPolish ? 'Nie udało się zmienić statusu raportu' : 'Failed to change the report status')
        );
      } finally {
        setTransitioning(null);
      }
    },
    [isPolish, load]
  );

  const columns: TableColumn[] = [
    {
      id: 'title',
      label: isPolish ? 'Tytuł' : 'Title',
      render: (row: AuditReportSummary) => (
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-c-text">{row.title}</span>
          <span className="text-[11px] text-c-text-muted">
            {programNameById.get(row.programId) || row.programName || '—'}
          </span>
        </div>
      ),
    },
    {
      id: 'reportKind',
      label: isPolish ? 'Rodzaj' : 'Kind',
      width: '170px',
      render: (row: AuditReportSummary) => {
        const entry = REPORT_KIND_LABEL[row.reportKind];
        return <span className="text-xs text-c-text-secondary">{entry ? (isPolish ? entry.pl : entry.en) : row.reportKind}</span>;
      },
    },
    { id: 'version', label: isPolish ? 'Wersja' : 'Version', width: '90px' },
    {
      id: 'status',
      label: isPolish ? 'Status' : 'Status',
      width: '150px',
      filterable: true,
      filterOptions: AUDIT_REPORT_STATUSES.map((value) => ({
        value,
        label: reportStatusLabel(value, isPolish),
      })),
      render: (row: AuditReportSummary) => (
        <StatusChip label={reportStatusLabel(row.status, isPolish)} tone={reportStatusTone(row.status)} />
      ),
    },
    {
      id: 'language',
      label: isPolish ? 'Język' : 'Language',
      width: '90px',
      render: (row: AuditReportSummary) => (
        <span className="text-xs text-c-text-secondary">{row.language?.toUpperCase() || '—'}</span>
      ),
    },
    {
      id: 'audience',
      label: isPolish ? 'Odbiorca' : 'Audience',
      width: '140px',
      render: (row: AuditReportSummary) => (
        <span className="text-xs text-c-text-secondary truncate block max-w-[130px]">{row.audience || '—'}</span>
      ),
    },
    {
      id: 'confidentiality',
      label: isPolish ? 'Poufność' : 'Confidentiality',
      width: '130px',
      render: (row: AuditReportSummary) => (
        <span className="text-xs text-c-text-secondary truncate block max-w-[120px]">
          {row.confidentiality || '—'}
        </span>
      ),
    },
    {
      id: 'publishedAt',
      label: isPolish ? 'Data publikacji' : 'Published at',
      width: '150px',
      sortable: true,
      render: (row: AuditReportSummary) => (
        <span className="text-xs text-c-text-secondary tabular-nums">{formatListDate(row.publishedAt)}</span>
      ),
    },
    {
      id: 'updatedAt',
      label: isPolish ? 'Zaktualizowano' : 'Updated',
      width: '140px',
      sortable: true,
      render: (row: AuditReportSummary) => (
        <span className="text-xs text-c-text-secondary tabular-nums">{formatListDate(row.updatedAt)}</span>
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
          label: isPolish ? 'Program' : 'Program',
          value: programNameById.get(selected.programId) || selected.programName || '—',
        },
        {
          id: 'reportKind',
          label: isPolish ? 'Rodzaj' : 'Kind',
          value:
            (REPORT_KIND_LABEL[selected.reportKind] &&
              (isPolish ? REPORT_KIND_LABEL[selected.reportKind].pl : REPORT_KIND_LABEL[selected.reportKind].en)) ||
            selected.reportKind,
        },
        { id: 'version', label: isPolish ? 'Wersja' : 'Version', value: String(selected.version), mono: true },
        { id: 'language', label: isPolish ? 'Język' : 'Language', value: selected.language?.toUpperCase() || '—' },
        { id: 'audience', label: isPolish ? 'Odbiorca' : 'Audience', value: selected.audience || '—' },
        {
          id: 'confidentiality',
          label: isPolish ? 'Poufność' : 'Confidentiality',
          value: selected.confidentiality || '—',
        },
        { id: 'approvedAt', label: isPolish ? 'Data zatwierdzenia' : 'Approved at', value: formatListDate(selected.approvedAt) },
        { id: 'publishedAt', label: isPolish ? 'Data publikacji' : 'Published at', value: formatListDate(selected.publishedAt) },
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
          data={items}
          loading={loading}
          rowMenu={rowMenu}
          onRowClick={(row) => setSelectedId(String(row.id))}
          selectedRowId={selectedId}
          persistKey="audits.method.reports"
          empty={{
            icon: FileText,
            title: isPolish ? 'Brak raportów' : 'No reports yet',
            description: isPolish
              ? 'Raport powstaje z Outputu programu audytowego. Sfinalizuj program, żeby móc wystawić pierwszy raport.'
              : 'A report is issued from a program Output. Finalize a program to issue the first report.',
          }}
        />
      </div>
      {selected ? (
        <div className="w-[380px] shrink-0 border-l border-c-border-subtle" data-testid="audit-report-preview">
          <StandardPreview
            title={selected.title}
            onClose={() => setSelectedId(null)}
            meta={{
              pills: [
                {
                  label: isPolish ? 'Status' : 'Status',
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
            }}
          />
        </div>
      ) : null}
    </div>
  );
};

export default AuditReportsTab;
