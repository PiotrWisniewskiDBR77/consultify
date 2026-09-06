/**
 * AuditOutputsTab — U7 Outputs surface: zatwierdzone, NIEZMIENNE wyniki audytu
 * (`AuditOutput`, powstaje przy finalizacji programu — `finalizedAt`/`hash`).
 *
 * Uczciwy stan pusty: dopóki żaden program nie doszedł do finalizacji, ta
 * lista JEST pusta z definicji — EmptyState mówi to wprost zamiast udawać
 * błąd ładowania.
 *
 * Hash treści (`contentHash`) NIE jest informacją pierwszego rzutu oka —
 * dowód integralności czyta się przy weryfikacji, nie przy skanowaniu listy.
 * Żyje wyłącznie w panelu podglądu (klik wiersza / kebab „Podgląd").
 */
import { FileText, Package, Wrench } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

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
import { Button } from '@/components/ui/primitives/Button';
import { Modal } from '@/components/ui/primitives/Modal';
import { formatListDate } from '@/utils/listDateFormat';

import {
  generateReport,
  listOutputs,
  type AuditOutputSummary,
  type AuditReportSummary,
} from '../auditsMethodApi';

export interface AuditOutputsTabProps {
  isPolish: boolean;
  /**
   * `programId`/`userId` → display name — `/api/audits/outputs` never sends
   * `programName`/`finalizedByName` (`outputService.ts` mapping has no such
   * fields, only the raw ids), so the frontend type declaring them always
   * rendered „—". Resolved here from data the Hub already loaded, same fix
   * pattern as `AuditProcessesTab`.
   */
  programNameById?: Map<string, string>;
  userNameById?: Map<string, string>;
  onReportCreated?: (report: AuditReportSummary) => void;
  /**
   * DEC-417b (1.1-A2): filtr statusu wybrany w Menu 3 / dropdownie Menu 2
   * Huba. `all` = bez filtra; `current`/`superseded` = oś `supersededBy`,
   * ta sama, którą pokazuje kolumna „Status".
   */
  statusFilter?: 'all' | 'current' | 'superseded';
  /** Rozkład statusów dla liczników chipów/dropdownu Menu 2 (Hub rysuje). */
  onCountsChange?: (counts: Record<string, number>) => void;
  /** Wymuszone przeładowanie po wygenerowaniu wyniku z CTA Menu 2. */
  reloadToken?: number;
}

const EMPTY_MAP = new Map<string, string>();

export const AuditOutputsTab: React.FC<AuditOutputsTabProps> = ({
  isPolish,
  programNameById = EMPTY_MAP,
  userNameById = EMPTY_MAP,
  onReportCreated,
  statusFilter = 'all',
  onCountsChange,
  reloadToken = 0,
}) => {
  const [items, setItems] = useState<AuditOutputSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creatingReport, setCreatingReport] = useState<string | null>(null);
  const [createdReport, setCreatedReport] = useState<AuditReportSummary | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [remediationOutput, setRemediationOutput] = useState<AuditOutputSummary | null>(null);
  const [asOfDate, setAsOfDate] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listOutputs()
      .then((result) => setItems(result.items))
      .catch((e: any) =>
        setError(
          e?.message || (isPolish ? 'Nie udało się wczytać Outputów' : 'Failed to load Outputs')
        )
      )
      .finally(() => setLoading(false));
  }, [isPolish]);

  useEffect(() => {
    load();
  }, [load, reloadToken]);

  // Liczniki dla Menu 3/Menu 2 — liczone z TEJ SAMEJ listy, którą widać
  // w tabeli (żadnego drugiego pobrania).
  useEffect(() => {
    onCountsChange?.({
      all: items.length,
      current: items.filter((o) => !o.supersededBy).length,
      superseded: items.filter((o) => !!o.supersededBy).length,
    });
  }, [items, onCountsChange]);

  const visibleItems = useMemo(
    () =>
      statusFilter === 'all'
        ? items
        : items.filter((o) => (statusFilter === 'superseded' ? !!o.supersededBy : !o.supersededBy)),
    [items, statusFilter]
  );

  const createReport = useCallback(
    async (
      output: AuditOutputSummary,
      reportKind: 'audit_report' | 'remediation_progress',
      date?: string
    ) => {
      if (creatingReport || output.supersededBy) return;
      setCreatingReport(`${output.id}:${reportKind}`);
      setReportError(null);
      try {
        const report = await generateReport({
          programId: output.programId,
          outputId: output.id,
          reportKind,
          ...(date ? { asOfDate: date } : {}),
        });
        setCreatedReport(report);
        onReportCreated?.(report);
        setRemediationOutput(null);
        setAsOfDate('');
      } catch (e: any) {
        setReportError(
          e?.response?.data?.error ||
            e?.message ||
            (isPolish ? 'Nie udało się wygenerować raportu.' : 'Could not generate the report.')
        );
      } finally {
        setCreatingReport(null);
      }
    },
    [creatingReport, isPolish, onReportCreated]
  );

  const columns: TableColumn[] = [
    {
      id: 'title',
      label: isPolish ? 'Tytuł' : 'Title',
      render: (row: AuditOutputSummary) => (
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-c-text">{row.title}</span>
          <span className="text-[11px] text-c-text-muted">
            {programNameById.get(row.programId) || row.programName || '—'}
          </span>
        </div>
      ),
    },
    {
      id: 'status',
      label: 'Status',
      width: '130px',
      render: (row: AuditOutputSummary) =>
        row.supersededBy ? (
          <StatusChip label={isPolish ? 'Zastąpiony' : 'Superseded'} tone="neutral" />
        ) : (
          <StatusChip label={isPolish ? 'Aktualny' : 'Current'} tone="success" />
        ),
    },
    { id: 'version', label: isPolish ? 'Wersja' : 'Version', width: '90px' },
    {
      id: 'packVersion',
      label: isPolish ? 'Wersja pakietu' : 'Pack version',
      width: '110px',
      render: (row: AuditOutputSummary) => (
        <span className="text-xs text-c-text-secondary tabular-nums">
          {row.packVersion != null ? `v${row.packVersion}` : '—'}
        </span>
      ),
    },
    {
      id: 'finalizedAt',
      label: isPolish ? 'Data finalizacji' : 'Finalized at',
      width: '160px',
      sortable: true,
      render: (row: AuditOutputSummary) => (
        <span className="text-xs text-c-text-secondary tabular-nums">
          {formatListDate(row.finalizedAt)}
        </span>
      ),
    },
    {
      id: 'finalizedByName',
      label: isPolish ? 'Kto' : 'By',
      width: '160px',
      render: (row: AuditOutputSummary) => {
        const name = (row.finalizedBy && userNameById.get(row.finalizedBy)) || row.finalizedByName;
        // Same class of bug as AuditProcessesTab's "leadAuditor" column
        // (2026-09-01, reguła 20 — sprawdzenie rodziny): `truncate` na
        // inline `span` bez `block`+`max-w-[…]` nie tnie nic, bo
        // FilterableTable nie stawia `overflow-hidden` na `<td>` (żeby nie
        // ucinać popoverów/menu). Długie nazwisko wchodziło w kolejną
        // kolumnę (kebab akcji).
        return (
          <span className="text-sm text-c-text truncate block max-w-[140px]">
            {name || <span className="text-slate-400">—</span>}
          </span>
        );
      },
    },
  ];

  // Podgląd (klik wiersza / kebab) — to tu, a NIE w kolumnie, żyje `contentHash`
  // (§C6: hash treści nie jest informacją pierwszego rzutu oka).
  const rowMenu = (rawRow: TableRow): StandardRowMenu => {
    const row = rawRow as unknown as AuditOutputSummary;
    const current = !row.supersededBy;
    const disabledReason = isPolish
      ? 'Raport można wygenerować tylko z aktualnej wersji Outputu.'
      : 'A report can only be generated from the current Output version.';
    return {
      statusTransitions: [
        {
          id: 'generate-audit-report',
          label: isPolish ? 'Generuj raport audytu' : 'Generate audit report',
          icon: FileText,
          onClick: current ? () => void createReport(row, 'audit_report') : undefined,
          disabled: !current || creatingReport !== null,
          note: current ? undefined : disabledReason,
        },
        {
          id: 'generate-remediation-report',
          label: isPolish ? 'Generuj raport naprawczy' : 'Generate remediation report',
          icon: Wrench,
          onClick: current ? () => setRemediationOutput(row) : undefined,
          disabled: !current || creatingReport !== null,
          note: current ? undefined : disabledReason,
        },
      ],
      universalHandlers: { preview: () => setSelectedId(row.id) },
    };
  };

  const selected = items.find((o) => o.id === selectedId) || null;
  const selectedProperties: ArtifactPropertyRow[] | undefined = selected
    ? [
        {
          id: 'program',
          label: 'Program',
          value: programNameById.get(selected.programId) || selected.programName || '—',
        },
        {
          id: 'version',
          label: isPolish ? 'Wersja' : 'Version',
          value: String(selected.version),
          mono: true,
        },
        {
          id: 'packVersion',
          label: isPolish ? 'Wersja pakietu' : 'Pack version',
          value: selected.packVersion != null ? `v${selected.packVersion}` : '—',
          mono: true,
        },
        {
          id: 'finalizedAt',
          label: isPolish ? 'Data finalizacji' : 'Finalized at',
          value: formatListDate(selected.finalizedAt),
        },
        {
          id: 'finalizedBy',
          label: isPolish ? 'Kto' : 'By',
          value:
            (selected.finalizedBy && userNameById.get(selected.finalizedBy)) ||
            selected.finalizedByName ||
            '—',
        },
        {
          id: 'status',
          label: 'Status',
          value: selected.supersededBy
            ? isPolish
              ? 'Zastąpiony nowszą wersją'
              : 'Superseded by a newer version'
            : isPolish
              ? 'Aktualny'
              : 'Current',
        },
        {
          id: 'contentHash',
          label: isPolish ? 'Hash treści' : 'Content hash',
          value: (
            <span className="font-mono text-[11px] text-c-text-muted break-all">
              {selected.contentHash || '—'}
            </span>
          ),
        },
      ]
    : undefined;

  if (error) {
    return (
      <div className="p-4">
        <ErrorState
          title={isPolish ? 'Nie udało się wczytać Outputów' : 'Could not load Outputs'}
          description={error}
          onRetry={load}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="flex-1 min-w-0 overflow-auto p-4">
        {(createdReport || reportError) ? (
          <div className="mb-3 rounded-xl border border-c-border-subtle bg-c-surface-raised p-3 text-xs">
            {createdReport ? (
              <p className="text-c-text" role="status">
                {isPolish ? 'Utworzono' : 'Created'} {createdReport.reportKind} v
                {createdReport.version}.{' '}
                <Link
                  to={`/audit-programs/reports/${encodeURIComponent(createdReport.id)}`}
                  className="font-medium text-c-focus-solid underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                >
                  {isPolish ? 'Otwórz raport' : 'Open report'}
                </Link>
              </p>
            ) : null}
            {reportError ? (
              <p className="text-c-danger" role="alert">
                {reportError}
              </p>
            ) : null}
          </div>
        ) : null}
        <StandardTable
          columns={columns}
          data={visibleItems}
          loading={loading}
          rowMenu={rowMenu}
          onRowClick={(row) => setSelectedId(String(row.id))}
          selectedRowId={selectedId}
          persistKey="audits.method.outputs"
          // DEC-417d: opis mówi PRAWDĘ o dzisiejszej drodze — CTA „Nowy
          // wynik" w Menu 2 tworzy Output przez finalizację sesji audytowej,
          // niezależnie od kebaba raportów w tej tabeli.
          empty={{
            icon: Package,
            title: isPolish ? 'Brak wyników' : 'No outputs yet',
            description: isPolish
              ? 'Wynik audytu powstaje przez osobną, jawną finalizację sesji audytowej. Zacznij od przycisku „Nowy wynik” w pasku modułu.'
              : 'An audit output is created by a separate, explicit audit-session finalization. Start with “New output” in the module bar.',
          }}
        />
      </div>
      <JedenPrawyPanel
        className="border-l border-c-border-subtle"
        rekord={selected ? (
          <StandardPreview
            title={selected.title}
            onClose={() => setSelectedId(null)}
            details={{
              properties: selectedProperties,
              label: isPolish ? 'Szczegóły' : 'Details',
              propertyLabel: isPolish ? 'Właściwość' : 'Property',
              valueLabel: isPolish ? 'Wartość' : 'Value',
            }}
          >
            <div className="rounded-xl border border-c-border-subtle bg-c-surface-raised p-2.5">
              <p className="text-xs text-c-text-secondary">
                {isPolish
                  ? 'Raporty utworzysz z menu wiersza (⋮).'
                  : 'Create reports from the row menu (⋮).'}
              </p>
              {createdReport ? (
                <p className="mt-2 text-xs text-c-text" role="status">
                  {isPolish ? 'Utworzono' : 'Created'} {createdReport.reportKind} v
                  {createdReport.version}
                </p>
              ) : null}
            </div>
          </StandardPreview>
        ) : null}
      />
      <Modal
        open={remediationOutput !== null}
        onClose={() => {
          if (!creatingReport) setRemediationOutput(null);
        }}
        title={isPolish ? 'Generuj raport naprawczy' : 'Generate remediation report'}
        description={
          isPolish
            ? 'Data stanu jest opcjonalna. Puste pole oznacza dzisiejszą datę po stronie serwera.'
            : "The as-of date is optional. Empty means today's date on the server."
        }
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              disabled={creatingReport !== null}
              onClick={() => setRemediationOutput(null)}
            >
              {isPolish ? 'Anuluj' : 'Cancel'}
            </Button>
            <Button
              variant="primary"
              loading={creatingReport !== null}
              disabled={!remediationOutput || creatingReport !== null}
              onClick={() =>
                remediationOutput &&
                void createReport(remediationOutput, 'remediation_progress', asOfDate)
              }
            >
              {isPolish ? 'Generuj' : 'Generate'}
            </Button>
          </div>
        }
      >
        <label className="flex flex-col gap-1.5 text-sm text-c-text">
          <span>{isPolish ? 'Stan na dzień (opcjonalnie)' : 'As-of date (optional)'}</span>
          <input
            type="date"
            value={asOfDate}
            onChange={(event) => setAsOfDate(event.target.value)}
            disabled={creatingReport !== null}
            className="rounded-lg border border-c-border-subtle bg-c-surface px-3 py-2 focus:outline-none focus:ring-2 focus:ring-c-focus"
          />
        </label>
      </Modal>
    </div>
  );
};

export default AuditOutputsTab;
