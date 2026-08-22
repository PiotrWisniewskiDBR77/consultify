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
import type { ArtifactPropertyRow } from '@/components/standard/ArtifactPropertiesTable';
import { ErrorState } from '@/components/shared/states';
import { StatusChip } from '@/components/ui/primitives/chips';
import { formatListDate } from '@/utils/listDateFormat';

import { auditRoleLabel } from '../auditRoleLabels';
import { programLifecycleLabel, programLifecycleTone } from '../auditStatusTones';
import {
  AUDIT_LIFECYCLE_STATES,
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
} from '../auditsMethodApi';

export interface AuditProcessesTabProps {
  programs: AuditProgramSummary[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  isPolish: boolean;
  /** Called after a lifecycle transition succeeds, so the Hub can refresh the list. */
  onProgramChanged: () => void;
  initialSelectedId?: string | null;
}

export const AuditProcessesTab: React.FC<AuditProcessesTabProps> = ({
  programs,
  loading,
  error,
  onRetry,
  isPolish,
  onProgramChanged,
  initialSelectedId = null,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [detail, setDetail] = useState<AuditProgramDetail | null>(null);
  const [coverage, setCoverage] = useState<AuditProgramCoverage | null>(null);
  const [lifecycle, setLifecycle] = useState<AuditProgramLifecycle | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [transitioning, setTransitioning] = useState<string | null>(null);
  const [criteria, setCriteria] = useState<AuditCriterionSummary[]>([]);
  const [criteriaError, setCriteriaError] = useState<string | null>(null);

  useEffect(() => {
    if (initialSelectedId) setSelectedId(initialSelectedId);
  }, [initialSelectedId]);

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
    Promise.all([getProgram(selectedId), getProgramCoverage(selectedId), getProgramLifecycle(selectedId), listProgramCriteria(selectedId)])
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
          setCriteriaError(isPolish ? 'Nie udało się wczytać kryteriów.' : 'Could not load criteria.');
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
      render: (row: AuditProgramSummary) => (
        <span className="text-xs text-c-text-secondary truncate block max-w-[160px]">
          {row.packTitle ? `${row.packTitle}${row.packVersion ? ` v${row.packVersion}` : ''}` : '—'}
        </span>
      ),
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
      render: (row: AuditProgramSummary) => (
        <span className="text-sm text-c-text truncate">
          {row.leadAuditorName || <span className="text-slate-400">—</span>}
        </span>
      ),
    },
    {
      id: 'plannedEnd',
      label: isPolish ? 'Termin' : 'Due',
      width: '120px',
      sortable: true,
      render: (row: AuditProgramSummary) => (
        <span className="text-xs text-c-text-secondary tabular-nums">{formatListDate(row.plannedEnd)}</span>
      ),
    },
    {
      id: 'updatedAt',
      label: isPolish ? 'Zaktualizowano' : 'Updated',
      width: '140px',
      sortable: true,
      render: (row: AuditProgramSummary) => (
        <span className="text-xs text-c-text-secondary tabular-nums">{formatListDate(row.updatedAt)}</span>
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
          title={isPolish ? 'Nie udało się wczytać programów audytowych' : 'Could not load audit programs'}
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
              ? 'Programy powstają z Library — otwórz pakiet i użyj „Rozpocznij audyt".'
              : 'Programs are created from the Library — open a pack and use "Start audit".',
          }}
        />
      </div>
      {selectedProgram ? (
        <div className="w-[380px] shrink-0 border-l border-c-border-subtle">
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
                  {isPolish ? 'Brak dalszych przejść z tego etapu.' : 'No further transitions from this stage.'}
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
            <div className="rounded-xl border border-c-border-subtle bg-c-surface-raised p-2.5" data-testid="audit-criteria-navigator">
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-c-text-muted">
                {isPolish ? 'Kryteria — otwórz warsztat' : 'Criteria — open workspace'}
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
                        {item.refCode ? `${item.refCode} · ` : ''}{item.title}
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
        </div>
      ) : null}
    </div>
  );
};

export default AuditProcessesTab;
