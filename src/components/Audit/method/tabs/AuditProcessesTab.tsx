/**
 * AuditProcessesTab — U7 Processes surface: programy audytowe (`AuditProgram`).
 *
 * Prezentacyjny komponent — listę i filtr etapu lifecycle dostaje z
 * `AuditsMethodHub`. Przy zaznaczeniu wiersza dociąga sam dwa dodatkowe
 * widoki: pokrycie (`GET /:id/coverage`) i bramki następnego etapu
 * (`GET /:id/lifecycle`) — oba są per-program, więc nie mają sensu w
 * kolumnach tabeli.
 *
 * Kebab: kontrakt `StandardRowMenu` (context → manage → danger,
 * `docs/ui-standards/03-modules/KEBAB_MENU_STANDARD.md`). Puste strefy
 * znikają — przejścia lifecycle żyją w panelu podglądu (wymagają
 * asynchronicznych bramek `GET /:id/lifecycle`, których kebab per-wiersz nie
 * może dociągnąć synchronicznie bez N+1 zapytań na każde otwarcie menu).
 */
import { ArrowRight, ClipboardList } from 'lucide-react';
import React, { useEffect, useState } from 'react';
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
import { DueChip, StatusChip } from '@/components/ui/primitives/chips';
import { isAuditsScaleAndPolishEnabled } from '@/utils/auditsScaleAndPolishFlag';
import { formatListDate } from '@/utils/listDateFormat';

import { auditRoleLabel } from '../auditRoleLabels';
import { programLifecycleLabel, programLifecycleTone } from '../auditStatusTones';
import {
  AUDIT_LIFECYCLE_STATES,
  finalizeOutput,
  getProgram,
  getProgramCoverage,
  getProgramLifecycle,
  listProgramCriteria,
  transitionProgram,
  type AuditProgramCoverage,
  type AuditProgramDetail,
  type AuditProgramLifecycle,
  type AuditProgramSummary,
  type AuditCriterionSummary,
  type AuditOutputSummary,
} from '../auditsMethodApi';
import { AuditCriteriaBrowser } from './AuditCriteriaBrowser';

export interface AuditProcessesTabProps {
  programs: AuditProgramSummary[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  isPolish: boolean;
  /** Called after a lifecycle transition succeeds, so the Hub can refresh the list. */
  onProgramChanged: () => void;
  initialSelectedId?: string | null;
  /**
   * `packId` → `"Title vN"`, built by the Hub from `packsAll` (already
   * loaded for Library). `AuditProgramSummary.packTitle` is a frontend-only
   * field the backend never populates (`programService.ts` mapping has no
   * `pack_title`) — resolving it here from real, already-fetched data closes
   * that gap without touching the server.
   */
  packTitleById?: Map<string, string>;
  /** `userId` → display name, same gap/fix pattern for `leadAuditorName`. */
  userNameById?: Map<string, string>;
}

const EMPTY_MAP = new Map<string, string>();

export const AuditProcessesTab: React.FC<AuditProcessesTabProps> = ({
  programs,
  loading,
  error,
  onRetry,
  isPolish,
  onProgramChanged,
  initialSelectedId = null,
  packTitleById = EMPTY_MAP,
  userNameById = EMPTY_MAP,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [detail, setDetail] = useState<AuditProgramDetail | null>(null);
  const [coverage, setCoverage] = useState<AuditProgramCoverage | null>(null);
  const [lifecycle, setLifecycle] = useState<AuditProgramLifecycle | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [transitioning, setTransitioning] = useState<string | null>(null);
  const [criteria, setCriteria] = useState<AuditCriterionSummary[]>([]);
  const [criteriaError, setCriteriaError] = useState<string | null>(null);
  const scaleAndPolishEnabled = React.useMemo(() => isAuditsScaleAndPolishEnabled(), []);
  const [criteriaBrowserOpen, setCriteriaBrowserOpen] = useState(false);
  const [finalizingOutput, setFinalizingOutput] = useState(false);
  const [finalizeResult, setFinalizeResult] = useState<AuditOutputSummary | null>(null);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);

  useEffect(() => {
    if (initialSelectedId) setSelectedId(initialSelectedId);
  }, [initialSelectedId]);

  useEffect(() => {
    setCriteriaBrowserOpen(false);
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setCoverage(null);
      setLifecycle(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setCriteriaError(null);
    Promise.all([
      getProgram(selectedId),
      getProgramCoverage(selectedId),
      getProgramLifecycle(selectedId),
      listProgramCriteria(selectedId),
    ])
      .then(([programResult, coverageResult, lifecycleResult, criteriaResult]) => {
        if (cancelled) return;
        setDetail(programResult);
        setCoverage(coverageResult);
        setLifecycle(lifecycleResult);
        setCriteria(criteriaResult);
      })
      .catch(() => {
        if (!cancelled) {
          setDetail(null);
          setCoverage(null);
          setLifecycle(null);
          setCriteria([]);
          setCriteriaError(
            isPolish ? 'Nie udało się wczytać kryteriów.' : 'Could not load criteria.'
          );
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const selectedProgram = programs.find((p) => p.id === selectedId) || null;
  const flatCriteria = criteria.flatMap(function flatten(item): AuditCriterionSummary[] {
    return [item, ...item.children.flatMap(flatten)];
  });

  const handleTransition = async (targetState: string) => {
    if (!selectedId) return;
    setTransitioning(targetState);
    try {
      await transitionProgram(selectedId, targetState as (typeof AUDIT_LIFECYCLE_STATES)[number]);
      onProgramChanged();
      const refreshed = await getProgramLifecycle(selectedId);
      setLifecycle(refreshed);
    } finally {
      setTransitioning(null);
    }
  };

  const handleFinalizeOutput = async () => {
    if (!selectedId || finalizingOutput) return;
    setFinalizingOutput(true);
    setFinalizeError(null);
    try {
      const output = await finalizeOutput(selectedId);
      setFinalizeResult(output);
      onProgramChanged();
    } catch (error: any) {
      const status = error?.response?.status ?? error?.status;
      if (status === 403) {
        setFinalizeError(
          isPolish
            ? 'Brak wymaganego uprawnienia: output.finalize.'
            : 'Missing required permission: output.finalize.'
        );
      } else {
        setFinalizeError(
          error?.response?.data?.error ||
            error?.message ||
            (isPolish ? 'Nie udało się sfinalizować Outputu.' : 'Could not finalize the Output.')
        );
      }
    } finally {
      setFinalizingOutput(false);
    }
  };

  const columns: TableColumn[] = [
    {
      id: 'name',
      label: isPolish ? 'Nazwa' : 'Name',
      render: (row: AuditProgramSummary) => (
        <span className="text-sm font-semibold text-c-text">{row.name}</span>
      ),
    },
    {
      id: 'pack',
      label: isPolish ? 'Pakiet' : 'Pack',
      width: '180px',
      render: (row: AuditProgramSummary) => {
        const packTitle =
          packTitleById.get(row.packId) ||
            (row.packTitle
              ? `${row.packTitle}${row.packVersion ? ` v${row.packVersion}` : ''}`
              : '—');
        return (
          <span
            className="text-xs text-c-text-secondary truncate block max-w-[160px]"
            title={packTitle === '—' ? undefined : packTitle}
          >
            {packTitle}
          </span>
        );
      },
    },
    {
      id: 'lifecycleState',
      label: isPolish ? 'Etap' : 'Stage',
      width: '190px',
      filterable: true,
      filterOptions: AUDIT_LIFECYCLE_STATES.map((value) => ({
        value,
        label: programLifecycleLabel(value, isPolish),
      })),
      render: (row: AuditProgramSummary) => (
        <StatusChip
          label={programLifecycleLabel(row.lifecycleState, isPolish)}
          tone={programLifecycleTone(row.lifecycleState)}
        />
      ),
    },
    {
      id: 'progress',
      label: isPolish ? 'Postęp' : 'Progress',
      width: '120px',
      align: 'right',
      render: (row: AuditProgramSummary) => (
        <span className="text-xs text-c-text-secondary tabular-nums">
          {row.concludedCriteria}/{row.applicableCriteria}
        </span>
      ),
    },
    {
      id: 'openFindings',
      label: isPolish ? 'Ustalenia otwarte' : 'Open findings',
      width: '140px',
      align: 'right',
      render: (row: AuditProgramSummary) => (
        <span className="text-xs text-c-text-secondary tabular-nums">{row.openFindings}</span>
      ),
    },
    {
      id: 'leadAuditor',
      label: isPolish ? 'Audytor wiodący' : 'Lead auditor',
      width: '160px',
      render: (row: AuditProgramSummary) => {
        const name =
          (row.leadAuditorId && userNameById.get(row.leadAuditorId)) || row.leadAuditorName;
        // NAPRAWA (2026-09-01): `truncate` bez `block`+`max-w-[…]` nie tnie
        // nic na inline `span` — FilterableTable świadomie NIE stawia
        // `overflow-hidden` na `<td>` (żeby nie ucinać popoverów/menu, patrz
        // `CELL_TEXT_CLAMP_CLASS` w FilterableTable.tsx), więc długie
        // nazwisko (np. "Aleksandra Dąbrowska") wchodziło w kolumnę „Start".
        // Wzorem sąsiedniej kolumny „pack" (max-w = deklarowana szerokość −
        // wewnętrzny padding) — działa dla KAŻDEGO nazwiska, nie tylko tego
        // najdłuższego w dzisiejszych danych demo.
        return (
          <span
            className="text-sm text-c-text truncate block max-w-[140px]"
            title={name || undefined}
          >
            {name || <span className="text-slate-400">—</span>}
          </span>
        );
      },
    },
    {
      id: 'plannedStart',
      label: isPolish ? 'Początek' : 'Start',
      width: '110px',
      sortable: true,
      render: (row: AuditProgramSummary) => (
        <span className="text-xs text-c-text-secondary tabular-nums">
          {formatListDate(row.plannedStart)}
        </span>
      ),
    },
    {
      id: 'plannedEnd',
      label: isPolish ? 'Termin' : 'Due',
      width: '120px',
      sortable: true,
      render: (row: AuditProgramSummary) => {
        // Gap pack 2026-08-26 (item 4): three of six demo sessions were past
        // `plannedEnd` with nothing signaling it. `DueChip` already carries
        // the canon rule "color only for risk/passed deadline" (§N) — a
        // closed program's own past due date is not a risk anymore, so it's
        // suppressed (`due={null}`) exactly like Execution's deadline column
        // does for terminal rows.
        if (!scaleAndPolishEnabled) {
          return (
            <span className="text-xs text-c-text-secondary tabular-nums">
              {formatListDate(row.plannedEnd)}
            </span>
          );
        }
        const isTerminal = row.lifecycleState === 'closed';
        const effectiveDue = isTerminal ? null : row.plannedEnd;
        const overdue =
          !isTerminal && !!row.plannedEnd && new Date(row.plannedEnd).getTime() < Date.now();
        return (
          <DueChip
            label={
              overdue ? (isPolish ? 'Po terminie' : 'Overdue') : formatListDate(row.plannedEnd)
            }
            due={effectiveDue}
            showIcon
            title={overdue ? formatListDate(row.plannedEnd) : undefined}
          />
        );
      },
    },
    {
      id: 'updatedAt',
      label: isPolish ? 'Zaktualizowano' : 'Updated',
      width: '200px',
      dataType: 'date',
      sortable: true,
      render: (row: AuditProgramSummary) => (
        <span className="text-xs text-c-text-secondary tabular-nums">
          {formatListDate(row.updatedAt)}
        </span>
      ),
    },
  ];

  // Jak w Library: StandardTable podaje ogólny `TableRow`, a dane pochodzą z
  // `programs` — zawężenie w jednym miejscu zamiast rzutowania w każdej akcji.
  const rowMenu = (rawRow: TableRow): StandardRowMenu => ({
    universalHandlers: {
      preview: () => setSelectedId(String(rawRow.id)),
    },
  });

  if (error) {
    return (
      <div className="p-4">
        <ErrorState
          title={
            isPolish
              ? 'Nie udało się wczytać programów audytowych'
              : 'Could not load audit programs'
          }
          description={error}
          onRetry={onRetry}
        />
      </div>
    );
  }

  const detailProperties: ArtifactPropertyRow[] | undefined = detail
    ? [
        {
          id: 'scope',
          label: isPolish ? 'Zakres' : 'Scope',
          value: detail.scopeText || (isPolish ? '— nie podano —' : '— not provided —'),
        },
        {
          id: 'objective',
          label: isPolish ? 'Cele' : 'Objective',
          value: detail.objective || (isPolish ? '— nie podano —' : '— not provided —'),
        },
        {
          id: 'coverage',
          label: isPolish ? 'Pokrycie' : 'Coverage',
          value: coverage
            ? `${coverage.concludedCriteria}/${coverage.applicableCriteria}`
            : isPolish
              ? 'Ładowanie…'
              : 'Loading…',
          mono: true,
        },
        {
          id: 'insufficientEvidence',
          label: isPolish ? 'Dowód niewystarczający' : 'Insufficient evidence',
          value: coverage ? String(coverage.insufficientEvidenceCriteria) : '—',
          mono: true,
        },
      ]
    : undefined;

  if (scaleAndPolishEnabled && criteriaBrowserOpen && selectedProgram) {
    return (
      <AuditCriteriaBrowser
        programId={selectedProgram.id}
        programName={selectedProgram.name}
        criteria={flatCriteria}
        loading={detailLoading}
        error={criteriaError}
        isPolish={isPolish}
        onBack={() => setCriteriaBrowserOpen(false)}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="flex-1 min-w-0 overflow-auto p-4">
        <StandardTable
          columns={columns}
          data={programs}
          loading={loading}
          rowMenu={rowMenu}
          onRowClick={(row) => setSelectedId(String(row.id))}
          selectedRowId={selectedId}
          persistKey="audits.method.processes"
          empty={{
            icon: ClipboardList,
            title: isPolish ? 'Brak programów audytowych' : 'No audit programs yet',
            description: isPolish
              ? 'Programy powstają z Biblioteki — otwórz pakiet i użyj „Rozpocznij audyt".'
              : 'Programs are created from the Library — open a pack and use "Start audit".',
          }}
        />
      </div>
      <JedenPrawyPanel
        className="border-l border-c-border-subtle"
        rekord={selectedProgram ? (
          <StandardPreview
            title={selectedProgram.name}
            onClose={() => setSelectedId(null)}
            loading={detailLoading}
            meta={{
              pills: [
                {
                  label: isPolish ? 'Etap' : 'Stage',
                  value: programLifecycleLabel(selectedProgram.lifecycleState, isPolish),
                  tone: programLifecycleTone(selectedProgram.lifecycleState),
                },
              ],
            }}
            details={{
              properties: detailProperties,
              label: isPolish ? 'Szczegóły' : 'Details',
              propertyLabel: isPolish ? 'Właściwość' : 'Property',
              valueLabel: isPolish ? 'Wartość' : 'Value',
            }}
            relations={
              detail?.members?.map((member) => ({
                id: member.userId,
                label: member.name || member.userId,
                value: auditRoleLabel(member.memberRole, isPolish),
              })) ?? []
            }
            relationsEmptyLabel={isPolish ? 'Brak przypisanego zespołu' : 'No team assigned'}
          >
            <div
              className="rounded-xl border border-c-border-subtle bg-c-surface-raised p-2.5"
              data-testid="audit-finalize-output-control"
            >
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-c-text-muted">
                {isPolish ? 'Output programu' : 'Program Output'}
              </div>
              <button
                type="button"
                disabled={finalizingOutput}
                onClick={() => void handleFinalizeOutput()}
                className="inline-flex h-8 items-center rounded-full border border-c-border bg-c-surface px-3 text-xs font-medium text-c-text transition-colors hover:bg-c-surface-raised disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              >
                {finalizingOutput
                  ? isPolish
                    ? 'Finalizowanie…'
                    : 'Finalizing…'
                  : isPolish
                    ? 'Sfinalizuj Output'
                    : 'Finalize Output'}
              </button>
              {finalizeResult ? (
                <p className="mt-2 text-xs text-c-text-secondary" role="status">
                  {isPolish ? 'Utworzono Output' : 'Output created'} v{finalizeResult.version} ·{' '}
                  <span className="font-mono">
                    {(finalizeResult.contentHash || '—').slice(0, 12)}
                  </span>
                </p>
              ) : null}
              {finalizeError ? (
                <p className="mt-2 text-xs text-c-danger" role="alert">
                  {finalizeError}
                </p>
              ) : null}
            </div>
            <div className="rounded-xl border border-c-border-subtle bg-c-surface-raised p-2.5">
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-c-text-muted">
                {isPolish ? 'Bramki następnego etapu' : 'Next-stage gates'}
              </div>
              {!lifecycle ? (
                <div className="text-xs text-c-text-muted">
                  {isPolish ? 'Ładowanie…' : 'Loading…'}
                </div>
              ) : lifecycle.allowed.length === 0 ? (
                <div className="text-xs text-c-text-muted">
                  {isPolish
                    ? 'Brak dalszych przejść z tego etapu.'
                    : 'No further transitions from this stage.'}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {lifecycle.allowed.map((gate) => (
                    <div key={gate.state} className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-c-text">
                          {programLifecycleLabel(gate.state, isPolish)}
                        </div>
                        {gate.blockers.length > 0 ? (
                          <div className="mt-0.5 text-[11px] text-c-text-muted">
                            {gate.blockers.join('; ')}
                          </div>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        disabled={gate.blockers.length > 0 || transitioning === gate.state}
                        onClick={() => void handleTransition(gate.state)}
                        className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full border border-c-border bg-c-surface px-2.5 text-[11px] font-medium text-c-text-secondary transition-colors hover:bg-c-surface-raised disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                      >
                        <ArrowRight size={11} />
                        {isPolish ? 'Przejdź' : 'Move'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div
              className="rounded-xl border border-c-border-subtle bg-c-surface-raised p-2.5"
              data-testid="audit-criteria-navigator"
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-c-text-muted">
                  {isPolish ? 'Kryteria — otwórz warsztat' : 'Criteria — open workspace'}
                </div>
                {scaleAndPolishEnabled && flatCriteria.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setCriteriaBrowserOpen(true)}
                    data-testid="open-criteria-browser"
                    className="shrink-0 text-[11px] font-medium text-c-text-secondary underline decoration-c-border-subtle underline-offset-2 hover:text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus rounded"
                  >
                    {isPolish ? 'Zobacz wszystkie' : 'View all'} ({flatCriteria.length})
                  </button>
                ) : null}
              </div>
              {criteriaError ? (
                <p className="text-xs text-c-danger">{criteriaError}</p>
              ) : flatCriteria.length === 0 ? (
                <p className="text-xs text-c-text-muted">
                  {isPolish ? 'Brak kryteriów w tym programie.' : 'This program has no criteria.'}
                </p>
              ) : (
                <div className="max-h-52 space-y-1 overflow-auto">
                  {flatCriteria.map((item) => (
                    <Link
                      key={item.id}
                      to={`/audit-programs/${selectedId}/criteria/${item.id}`}
                      className="flex w-full items-center justify-between gap-2 rounded-lg border border-c-border-subtle bg-c-surface px-2 py-1.5 text-left hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                    >
                      <span className="min-w-0 truncate text-xs font-medium text-c-text">
                        {item.refCode ? `${item.refCode} · ` : ''}
                        {item.title}
                      </span>
                      <span className="shrink-0 text-[10px] text-c-text-muted">
                        {item.evidenceCount} / {item.findingCount}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </StandardPreview>
        ) : null}
      />
    </div>
  );
};

export default AuditProcessesTab;
