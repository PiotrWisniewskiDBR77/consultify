import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { StandardPreview } from '@/components/standard/StandardPreview';
import { initiativeStatusLabel } from '@/components/Initiatives/initiativeStatusLabels';
import {
  memberNameOrUnknown,
  type MemberNameResolver,
} from '@/hooks/useOrganizationMemberNames';
import {
  StandardTable,
  type TableColumn,
  type TableRow,
} from '@/components/standard/StandardTable';
import {
  listExecutionCases,
  readExecutionMilestones,
  readExecutionWork,
} from '@/services/initiatives-execution/runtimeApi';
import {
  V8ExecutionControlApi,
  type V8ManagerProblemRow,
} from '@/services/api/v8/execution-control';
import { generateExecutionWorkAnalysis } from '@/services/executionReports/executionReportsApi';

import { buildWorkReportModel, type WorkReportItem } from './workReportModel';
import {
  buildExecutionWorkAnalysis,
  type ExecutionWorkAnalysis,
  type ExecutionWorkAnalysisItem,
  type WorkAnalysisWindow,
} from './workAnalysisModel';

interface Props {
  analysisEnabled?: boolean;
  resolveOwnerName?: MemberNameResolver;
  onOpenDocument?: (row: {
    id: string;
    title: string;
    kind: 'TASK' | 'DECISION';
    status: string;
    executionCaseId: string;
  }) => void;
}

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; items: WorkReportItem[]; failedCases: number; syncedAt: string };

type ManagerProblemBinding = V8ManagerProblemRow & { laneId: string };

const arrayAt = (payload: unknown, key: string): Array<Record<string, unknown>> => {
  if (!payload || typeof payload !== 'object') return [];
  const value = (payload as Record<string, unknown>)[key];
  return Array.isArray(value) ? value : [];
};

/** Keep compatibility with the legacy ApiGateway `{ data }` envelope. */
const unwrapApiPayload = <T extends object>(response: T): T => {
  const candidate = response as T & { data?: unknown };
  return candidate.data && typeof candidate.data === 'object' ? (candidate.data as T) : response;
};

const sections = [
  'context',
  'pulse',
  'hurts',
  'approaching',
  'stake',
  'why',
  'trend',
  'actions',
  'register',
] as const;

// Polish pass item 3: severity as a canonical semantic badge. Crimson
// (c-danger) is reserved for genuinely critical (red) states only — amber
// uses c-warning, unknown/neutral use muted text. Never `primary-*` (the
// Tailwind `primary` token in this codebase IS crimson; see CLAUDE.md trap
// #3), and never color implies a value the data does not support.
// Polish pass item 2: bucket keys are internal ids, not copy — translate
// each to an honest human label (falls back to English when no PL/EN
// resource bundle key is registered yet).
const BUCKET_LABEL_FALLBACK: Record<string, string> = {
  '1_7': '1–7 days',
  '8_14': '8–14 days',
  '15_30': '15–30 days',
  '31_90': '31–90 days',
  over90: 'Over 90 days',
  noDue: 'No due date',
};

// Polish pass item 5: one shared section shell (SPEC-A "Document centre"
// rhythm) for sections 1-8, instead of only the Context section having a
// card border while the rest sat bare against the page background.
const SECTION_SHELL_CLASS = 'rounded-xl border border-c-border bg-c-surface-raised p-4';

// axe `color-contrast` (odbiór G06, 06_EXECUTION): plaskie tokeny sygnalowe
// na wlasnym 14%-owym tinted tle nie miesza sie z 4,5:1 — zmierzone:
// text-c-danger 3.5:1 (light) / 4.0:1 (dark) na tym tle, text-c-warning
// 4.31:1 (light). Naprawa lokalna, wazna TYLKO dla tego badge'a (nie ruszamy
// globalnych --c-danger/--c-warning, ktore maja dziesiatki innych wywolan):
// danger-700 (skala Tailwind) w light, danger-300 w dark (obie >5:1 na tym
// tle); amber: literal #8a4517 w light (5.64:1), dark zostaje bo juz przechodzi.
const SEVERITY_BADGE_CLASS: Record<string, string> = {
  red: 'bg-[color-mix(in_srgb,var(--c-danger)_14%,transparent)] text-danger-700 dark:text-danger-300',
  amber:
    'bg-[color-mix(in_srgb,var(--c-warning)_14%,transparent)] text-[#8a4517] dark:text-c-warning',
  neutral: 'bg-c-surface-raised text-c-text-secondary',
  unknown: 'bg-c-surface-raised text-c-text-muted',
};

// Odbiór grafiki 07-realizacja (2026-08-30, kontynuacja "Polish pass" powyżej):
// epistemiczne etykiety (FACT/RECOMMENDATION/CALCULATED), severity badge
// (RED/AMBER/NEUTRAL) i kody przyczyn (NO_API_*) renderowały się jako
// surowe stałe wprost w JSX — nigdy nie przeszły przez t(), mimo że reszta
// sekcji już jest po polsku. Klucze fallback poniżej idą tym samym wzorcem
// t(key, fallback) co reszta pliku.
const SEVERITY_LABEL_KEY: Record<string, [string, string]> = {
  red: ['execution.reports.intelligence.severity.red', 'Critical'],
  amber: ['execution.reports.intelligence.severity.amber', 'Warning'],
  neutral: ['execution.reports.intelligence.severity.neutral', 'Neutral'],
  unknown: ['execution.reports.intelligence.severity.unknown', 'Unknown'],
};
const REASON_LABEL_KEY: Record<string, [string, string]> = {
  NO_API_HISTORY: [
    'execution.reports.intelligence.reasons.noApiHistory',
    'No history API available',
  ],
  NO_API_BSC: [
    'execution.reports.intelligence.reasons.noApiBsc',
    'No objective-mapping API available',
  ],
};
const EPISTEMIC_LABEL_KEY: Record<
  'fact' | 'recommendation' | 'unknown' | 'calculated',
  [string, string]
> = {
  fact: ['execution.reports.intelligence.epistemic.fact', 'FACT'],
  recommendation: ['execution.reports.intelligence.epistemic.recommendation', 'RECOMMENDATION'],
  unknown: ['execution.reports.intelligence.epistemic.unknown', 'UNKNOWN'],
  calculated: ['execution.reports.intelligence.epistemic.calculated', 'CALCULATED'],
};
// Małe opakowanie, żeby nie rozkładać krotki [key, fallback] przez spread w
// wywołaniach t() (i18next ma przeciążone sygnatury — spread gubi typy).
const trPair = (t: (key: string, fallback: string) => string, pair: [string, string]): string =>
  t(pair[0], pair[1]);
// Kolumna TYP w rejestrze renderowała row.kind ('TASK'/'DECISION'/'MILESTONE')
// bez żadnego mapowania — ten sam znany defekt co wyżej.
const KIND_LABEL_KEY: Record<string, [string, string]> = {
  TASK: ['execution.reports.intelligence.kinds.task', 'Task'],
  DECISION: ['execution.reports.intelligence.kinds.decision', 'Decision'],
  MILESTONE: ['execution.reports.intelligence.kinds.milestone', 'Milestone'],
};
const ATTENTION_REASON_FALLBACK: Record<string, string> = {
  BLOCKED: 'Blocked',
  OVERDUE: 'Overdue',
  UNASSIGNED: 'Unassigned',
  NO_DUE_DATE: 'No due date',
};

const humanizeCode = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/^\p{L}/u, (letter) => letter.toUpperCase());

const badgeClass = (value: string): string => {
  const normalized = value.toUpperCase();
  if (['DONE', 'COMPLETED', 'DECIDED', 'APPROVED'].includes(normalized))
    return 'bg-c-success/10 text-c-success';
  if (['BLOCKED', 'OVERDUE', 'CRITICAL'].includes(normalized))
    return 'bg-c-danger/10 text-danger-700 dark:text-danger-300';
  if (['HIGH', 'IN_PROGRESS', 'IN_EXECUTION', 'PENDING'].includes(normalized))
    return 'bg-c-warning/10 text-[#8a4517] dark:text-c-warning';
  return 'bg-c-surface-subtle text-c-text-secondary';
};

export function WorkIntelligenceReport({
  analysisEnabled = false,
  resolveOwnerName,
  onOpenDocument,
}: Props): React.ReactElement {
  const { t, i18n } = useTranslation();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [drilldownId, setDrilldownId] = useState<string | null>(null);
  const [selectedWeek, setSelectedWeek] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedWindow, setSelectedWindow] =
    useState<keyof ExecutionWorkAnalysis['windows']>('nextWeek');
  const [managerProblems, setManagerProblems] = useState<ManagerProblemBinding[]>([]);
  const [generation, setGeneration] = useState<{ id: string; created: boolean; asOf: string } | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [selectedAttentionId, setSelectedAttentionId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { cases } = await listExecutionCases();
        const results = await Promise.allSettled(
          cases.map(async (executionCase) => {
            const caseId = String(executionCase.executionCaseId);
            const [work, milestones] = await Promise.all([
              readExecutionWork(caseId),
              readExecutionMilestones(caseId),
            ]);
            const common = {
              executionCaseId: caseId,
              initiativeId: String(executionCase.initiativeId || ''),
              projectId: executionCase.projectId ? String(executionCase.projectId) : null,
              projectTitle: executionCase.projectTitle
                ? String(executionCase.projectTitle)
                : executionCase.projectId
                  ? String(executionCase.projectId)
                  : null,
            };
            const tasks: WorkReportItem[] = arrayAt(work, 'tasks').map((item) => ({
              ...common,
              id: String(item.taskId),
              title: String(item.title || item.taskId),
              kind: 'TASK',
              status: String(item.status || 'UNKNOWN'),
              priority: item.priority ? String(item.priority) : null,
              ownerId: item.assigneeId ? String(item.assigneeId) : null,
              dueAt: item.dueAt ? String(item.dueAt) : null,
              completedAt: item.completedAt ? String(item.completedAt) : null,
              slaAt: item.slaAt ? String(item.slaAt) : null,
              dependencies: Array.isArray(item.dependencies) ? item.dependencies : [],
              evidenceRefs: Array.isArray(item.evidenceRefs) ? item.evidenceRefs : [],
              definitionOfDone: item.definitionOfDone ? String(item.definitionOfDone) : null,
              sourceVersion: Number.isFinite(Number(item.version)) ? Number(item.version) : null,
            }));
            const decisions: WorkReportItem[] = arrayAt(work, 'decisions').map((item) => ({
              ...common,
              id: String(item.decisionId),
              title: String(item.title || item.decisionId),
              kind: 'DECISION',
              status: String(item.status || 'UNKNOWN'),
              priority: item.priority ? String(item.priority) : null,
              ownerId: item.authorityId ? String(item.authorityId) : null,
              dueAt: item.dueAt ? String(item.dueAt) : null,
              completedAt: item.decidedAt ? String(item.decidedAt) : null,
              slaAt: item.slaAt ? String(item.slaAt) : null,
              dependencies: Array.isArray(item.dependencies) ? item.dependencies : [],
              evidenceRefs: Array.isArray(item.evidenceRefs) ? item.evidenceRefs : [],
              definitionOfDone: item.successCriteria ? String(item.successCriteria) : null,
              sourceVersion: Number.isFinite(Number(item.version)) ? Number(item.version) : null,
            }));
            const milestoneItems: WorkReportItem[] = arrayAt(milestones, 'items').map(
              (item) => ({
                ...common,
                id: String(item.milestoneId),
                title: String(item.title || item.milestoneId),
                kind: 'MILESTONE',
                status: String(item.status || 'UNKNOWN'),
                priority: item.priority ? String(item.priority) : null,
                ownerId: item.ownerId ? String(item.ownerId) : null,
                dueAt: item.targetAt ? String(item.targetAt) : null,
                completedAt: item.completedAt ? String(item.completedAt) : null,
                slaAt: null,
                dependencies: [],
                evidenceRefs: Array.isArray(item.evidenceRefs) ? item.evidenceRefs : [],
                definitionOfDone: null,
                sourceVersion: Number.isFinite(Number(item.version)) ? Number(item.version) : null,
              })
            );
            return [...tasks, ...decisions, ...milestoneItems];
          })
        );
        if (!active) return;
        const fulfilled = results.filter(
          (result): result is PromiseFulfilledResult<WorkReportItem[]> =>
            result.status === 'fulfilled'
        );
        setState({
          kind: 'ready',
          items: fulfilled.flatMap((result) => result.value),
          failedCases: results.length - fulfilled.length,
          syncedAt: new Date().toISOString(),
        });
        if (analysisEnabled) {
          const lanes = ['action-queue', 'blockers', 'workload'];
          const problemResults = await Promise.allSettled(
            lanes.map(async (laneId) => {
              const response = await V8ExecutionControlApi.getManagerProblems(laneId);
              return unwrapApiPayload(response).problems.map((problem) => ({
                ...problem,
                laneId,
              }));
            })
          );
          if (active) {
            setManagerProblems(
              problemResults.flatMap((result) => result.status === 'fulfilled' ? result.value : [])
            );
          }
        }
      } catch (error) {
        if (active)
          setState({
            kind: 'error',
            message: error instanceof Error ? error.message : String(error),
          });
      }
    })();
    return () => {
      active = false;
    };
  }, [analysisEnabled]);

  const model = useMemo(
    () =>
      state.kind === 'ready' ? buildWorkReportModel(state.items, new Date(state.syncedAt)) : null,
    [state]
  );
  const analysis = useMemo(
    () =>
      state.kind === 'ready' && analysisEnabled
        ? buildExecutionWorkAnalysis(
            state.items as ExecutionWorkAnalysisItem[],
            new Date(`${selectedWeek}T12:00:00.000Z`)
          )
        : null,
    [analysisEnabled, selectedWeek, state]
  );
  const selectedMetric = model?.metrics.find((metric) => metric.id === drilldownId) ?? null;
  const registerItems = selectedMetric ? selectedMetric.drilldown : (model?.items ?? []);
  const columns: TableColumn[] = [
    {
      id: 'title',
      label: t('execution.reports.intelligence.columns.title', 'Record'),
      sortable: true,
      primary: true,
      dataType: 'text',
    },
    ...(analysisEnabled
      ? [
          {
            id: 'projectTitle',
            label: t('execution.workAnalysis.columns.project', 'Project'),
            sortable: true,
            dataType: 'text' as const,
          },
          {
            id: 'priority',
            label: t('execution.workAnalysis.columns.priority', 'Priority'),
            sortable: true,
            render: (row: TableRow) => {
              const code = String(row.priority || 'UNSET');
              return (
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${badgeClass(code)}`}>
                  {t(`execution.workAnalysis.priority.${code.toLowerCase()}`, humanizeCode(code))}
                </span>
              );
            },
          },
        ]
      : []),
    {
      id: 'kind',
      label: t('execution.reports.intelligence.columns.kind', 'Type'),
      sortable: true,
      render: (row: TableRow) => {
        const code = String(row.kind || 'UNKNOWN');
        return trPair(t, KIND_LABEL_KEY[code] ?? [code, humanizeCode(code)]);
      },
    },
    {
      id: 'status',
      label: t('execution.reports.intelligence.columns.status', 'Status'),
      sortable: true,
      render: (row: TableRow) => {
        const code = String(row.status || 'UNKNOWN');
        return (
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${badgeClass(code)}`}>
            {initiativeStatusLabel(t, code)}
          </span>
        );
      },
    },
    {
      id: 'ownerId',
      label: t('execution.reports.intelligence.columns.owner', 'Owner'),
      sortable: true,
      render: (row: TableRow) =>
        memberNameOrUnknown(
          resolveOwnerName,
          String(row.ownerId || ''),
          i18n.language.startsWith('pl')
        ),
    },
    { id: 'dueAt', label: t('execution.reports.intelligence.columns.due', 'Due'), sortable: true },
    {
      id: 'sourceVersion',
      label: t('execution.reports.intelligence.columns.version', 'Source version'),
    },
  ];

  if (state.kind === 'loading')
    return (
      <div role="status">
        {t('execution.reports.intelligence.loadingWork', 'Loading work report…')}
      </div>
    );
  if (state.kind === 'error')
    return (
      <div role="alert">
        {t('execution.reports.intelligence.workError', 'Work report is unavailable')}:{' '}
        {state.message}
      </div>
    );
  if (!model)
    return (
      <div role="alert">
        {t('execution.reports.intelligence.workError', 'Work report is unavailable')}
      </div>
    );

  const windowEntries: Array<{
    id: keyof ExecutionWorkAnalysis['windows'];
    label: string;
    value: WorkAnalysisWindow;
  }> = analysis
    ? [
        {
          id: 'previousWeek',
          label: t('execution.workAnalysis.windows.previousWeek', 'Previous week'),
          value: analysis.windows.previousWeek,
        },
        {
          id: 'nextWeek',
          label: t('execution.workAnalysis.windows.nextWeek', 'Next week'),
          value: analysis.windows.nextWeek,
        },
        {
          id: 'nextMonth',
          label: t('execution.workAnalysis.windows.nextMonth', 'Next month'),
          value: analysis.windows.nextMonth,
        },
      ]
    : [];
  const selectedAnalysisWindow = analysis?.windows[selectedWindow] ?? null;
  const attentionRows = (analysis?.attention ?? []).map(({ item, reasons }) => ({
    ...item,
    reasons,
    managerBindings: managerProblems.filter((problem) => problem.sourceEntityId === item.id),
  }));
  const runManagerAction = async (
    row: (typeof attentionRows)[number],
    actionId: 'escalate' | 'reassign' | 'set_capacity'
  ) => {
    const binding = row.managerBindings.find((problem) =>
      problem.actions.some((action) => action.id === actionId)
    );
    if (!binding) return;
    const key = `${binding.id}:${actionId}`;
    setBusyAction(key);
    setActionMessage(null);
    try {
      const response = await V8ExecutionControlApi.executeManagerProblemAction(
        binding.laneId,
        { problemId: binding.id, actionId },
        row.projectId ?? undefined
      );
      const result = unwrapApiPayload(response);
      setActionMessage(
        result.message || t('execution.workAnalysis.actionDone', 'Management action completed.')
      );
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : t('execution.workAnalysis.actionFailed', 'Management action failed.'));
    } finally {
      setBusyAction(null);
    }
  };
  const managerActionsFor = (row: (typeof attentionRows)[number]) =>
    ([
      ['escalate', t('execution.workAnalysis.actions.escalate', 'Escalate')],
      ['reassign', t('execution.workAnalysis.actions.delegate', 'Delegate')],
      ['set_capacity', t('execution.workAnalysis.actions.resources', 'Change resources')],
    ] as const).flatMap(([actionId, label]) => {
      const binding = row.managerBindings.find((problem) =>
        problem.actions.some((action) => action.id === actionId)
      );
      return binding ? [{ actionId, label, binding }] : [];
    });
  const selectedAttentionRow =
    attentionRows.find((row) => row.id === selectedAttentionId) ?? null;
  const canOpenSourceRecord = (row: (typeof attentionRows)[number]) =>
    (row.kind === 'TASK' || row.kind === 'DECISION') && Boolean(onOpenDocument);
  const openSourceRecord = (row: (typeof attentionRows)[number]) => {
    if (!canOpenSourceRecord(row) || !onOpenDocument) return;
    onOpenDocument({
      id: row.id,
      title: row.title,
      kind: row.kind as 'TASK' | 'DECISION',
      status: row.status,
      executionCaseId: row.executionCaseId,
    });
  };
  const attentionColumns: TableColumn[] = [
    { id: 'title', label: t('execution.workAnalysis.columns.record', 'Attention record'), primary: true, dataType: 'text' },
    {
      id: 'reasons',
      label: t('execution.workAnalysis.columns.reason', 'Reason'),
      render: (row: TableRow) => ((row.reasons as string[]) || []).map((reason) =>
        t(
          `execution.workAnalysis.reasons.${String(reason).toLowerCase()}`,
          ATTENTION_REASON_FALLBACK[reason] ?? humanizeCode(reason)
        )
      ).join(', '),
    },
    { id: 'projectTitle', label: t('execution.workAnalysis.columns.project', 'Project'), dataType: 'text' },
  ];

  return (
    <main
      className="min-h-0 flex-1 overflow-auto bg-c-surface p-4 text-c-text"
      data-testid="work-intelligence-report"
    >
      <div className="mx-auto max-w-7xl space-y-4">
        <header>
          <p className="text-xs font-semibold uppercase tracking-wide text-c-text-muted">
            {t('execution.reports.intelligence.operationalLabel', 'Operational backlog report')}
          </p>
          <h1 className="text-2xl font-semibold">
            {t('execution.reports.intelligence.workTitle', 'Work Intelligence Report')}
          </h1>
        </header>

        {analysis ? (
          <section aria-labelledby="work-analysis-title" className={SECTION_SHELL_CLASS}>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-c-text-muted">
                  {t('execution.workAnalysis.label', 'Weekly management analysis')}
                </p>
                <h2 id="work-analysis-title" className="font-semibold">
                  {t('execution.workAnalysis.title', 'Work across three time windows')}
                </h2>
              </div>
              <label className="text-sm text-c-text-secondary">
                {t('execution.workAnalysis.weekOf', 'Week of')}
                <input
                  aria-label={t('execution.workAnalysis.weekOf', 'Week of')}
                  className="ml-2 rounded-lg border border-c-border bg-c-surface px-3 py-2 text-c-text"
                  type="date"
                  value={selectedWeek}
                  onChange={(event) => setSelectedWeek(event.target.value)}
                />
              </label>
              <button
                type="button"
                onClick={() => void (async () => {
                  setActionMessage(null);
                  try {
                    const result = await generateExecutionWorkAnalysis(selectedWeek);
                    setGeneration({ id: result.id, created: result.created, asOf: result.asOf });
                  } catch (error) {
                    setActionMessage(error instanceof Error ? error.message : t('execution.workAnalysis.generateFailed', 'The analysis could not be generated.'));
                  }
                })()}
                className="rounded-lg border border-c-border px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
              >
                {t('execution.workAnalysis.generate', 'Generate for this week')}
              </button>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {windowEntries.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  aria-pressed={selectedWindow === entry.id}
                  onClick={() => setSelectedWindow(entry.id)}
                  className="rounded-xl border border-c-border bg-c-surface p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
                >
                  <span className="block text-sm font-semibold">{entry.label}</span>
                  <strong className="mt-1 block text-2xl">{entry.value.items.length}</strong>
                  <span className="text-xs text-c-text-muted">
                    {t('execution.workAnalysis.completed', 'Completed')}:{' '}
                    {entry.value.completed.numerator}/{entry.value.completed.denominator}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-sm text-c-text-secondary">
              {t('execution.workAnalysis.attention', 'Requires management attention')}:{' '}
              <strong>{analysis.attention.length}</strong>
            </p>
            {generation ? (
              <p className="mt-2 text-xs text-c-text-muted" data-testid="work-analysis-receipt">
                {t('execution.workAnalysis.savedReceipt', 'Saved report {{id}} · {{state}}', {
                  id: generation.id,
                  state: generation.created
                    ? t('execution.workAnalysis.savedNew', 'created')
                    : t('execution.workAnalysis.savedExisting', 'already generated'),
                })}
              </p>
            ) : null}
            {actionMessage ? <p role="status" className="mt-2 text-sm text-c-text-secondary">{actionMessage}</p> : null}
            <div className="mt-3 min-h-[360px]">
              <div className="flex min-h-0 gap-3">
                <div className="min-w-0 flex-1">
                  <StandardTable
                    columns={attentionColumns}
                    data={attentionRows}
                    density="compact"
                    selectedRowId={selectedAttentionId}
                    onRowClick={(row) => setSelectedAttentionId(String(row.id))}
                    rowMenu={(tableRow) => {
                      const row = tableRow as unknown as (typeof attentionRows)[number];
                      return {
                        primary: [
                          ...(canOpenSourceRecord(row)
                            ? [
                                {
                                  id: 'open-source',
                                  label: t(
                                    'execution.workAnalysis.preview.openSource',
                                    'Open source record'
                                  ),
                                  onClick: () => openSourceRecord(row),
                                },
                              ]
                            : []),
                          ...managerActionsFor(row).map(({ actionId, label }) => ({
                            id: actionId,
                            label,
                            onClick: () => void runManagerAction(row, actionId),
                            disabled: busyAction !== null,
                          })),
                        ],
                        universalHandlers: {
                          preview: () => setSelectedAttentionId(row.id),
                        },
                        // Runtime work rows expose no edit/archive/delete mutation.
                        // Those capabilities remain N/D instead of becoming dead placeholders.
                      };
                    }}
                    empty={{ title: t('execution.workAnalysis.noAttention', 'No records require management attention') }}
                  />
                </div>
                {selectedAttentionRow ? (() => {
                  const row = selectedAttentionRow;
                  const actions = managerActionsFor(selectedAttentionRow);
                  const canOpen = canOpenSourceRecord(row);
                  return (
                    <aside className="w-[min(420px,42%)] shrink-0 overflow-hidden rounded-xl border border-c-border bg-c-surface">
                      <StandardPreview
                        title={row.title}
                        onClose={() => setSelectedAttentionId(null)}
                        onOpenFull={canOpen ? () => openSourceRecord(row) : undefined}
                        openDisabledReason={
                          canOpen
                            ? undefined
                            : t(
                                'execution.workAnalysis.preview.openDisabled',
                                'This work item has no available source route.'
                              )
                        }
                        meta={{
                        pills: [
                          {
                            label: initiativeStatusLabel(t, row.status),
                            tone: row.status === 'BLOCKED' ? 'danger' : 'neutral',
                          },
                          {
                            label: trPair(
                              t,
                              KIND_LABEL_KEY[row.kind] ?? [row.kind, humanizeCode(row.kind)]
                            ),
                            tone: 'neutral',
                          },
                        ],
                        trailing: row.dueAt
                          ? new Date(row.dueAt).toLocaleDateString(i18n.language)
                          : t('execution.workAnalysis.preview.noDueDate', 'No due date'),
                      }}
                        details={{
                        label: t('execution.workAnalysis.preview.details', 'Work details'),
                        text:
                          row.definitionOfDone ||
                          t(
                            'execution.workAnalysis.preview.noDefinition',
                            'No definition of done has been recorded.'
                          ),
                        properties: [
                          {
                            id: 'reason',
                            label: t('execution.workAnalysis.columns.reason', 'Reason'),
                            value: row.reasons
                              .map((reason) =>
                                t(
                                  `execution.workAnalysis.reasons.${reason.toLowerCase()}`,
                                  ATTENTION_REASON_FALLBACK[reason] ?? humanizeCode(reason)
                                )
                              )
                              .join(', '),
                          },
                          {
                            id: 'project',
                            label: t('execution.workAnalysis.columns.project', 'Project'),
                            value:
                              row.projectTitle ||
                              t('execution.workAnalysis.preview.noProject', 'No project assigned'),
                          },
                          {
                            id: 'owner',
                            label: t('execution.reports.intelligence.columns.owner', 'Owner'),
                            value:
                              row.ownerId
                                ? memberNameOrUnknown(
                                    resolveOwnerName,
                                    row.ownerId,
                                    i18n.language.startsWith('pl')
                                  )
                                : t(
                                    'execution.workAnalysis.preview.noOwner',
                                    'No owner assigned'
                                  ),
                          },
                        ],
                        propertyLabel: t('standardPreview.property', 'Property'),
                        valueLabel: t('standardPreview.value', 'Value'),
                        onCopy: () => void navigator.clipboard?.writeText(row.title),
                      }}
                        relations={
                        row.projectTitle
                          ? [
                              {
                                id: row.projectId ?? undefined,
                                label: row.projectTitle,
                                type: 'project',
                              },
                            ]
                          : []
                      }
                        actions={{
                        informational: actions.map(({ actionId, label, binding }) => ({
                          id: actionId,
                          variant: actionId === 'escalate' ? 'warning' : 'neutral',
                          label:
                            busyAction === `${binding.id}:${actionId}`
                              ? t('execution.workAnalysis.actions.running', 'Working…')
                              : label,
                          disabled: busyAction !== null,
                          onClick: () => void runManagerAction(row, actionId),
                        })),
                      }}
                        whatsNext={{
                        items: [
                          {
                            id: 'open-source',
                            label: t(
                              'execution.workAnalysis.preview.openSource',
                              'Open source record'
                            ),
                            disabled: !canOpen,
                            onClick: () => openSourceRecord(row),
                          },
                        ],
                      }}
                      />
                    </aside>
                  );
                })() : null}
              </div>
            </div>
          </section>
        ) : null}

        <section
          data-section-order={sections[0]}
          aria-labelledby="work-context-title"
          className="rounded-xl border border-c-border bg-c-surface-raised p-4"
        >
          <h2 id="work-context-title" className="font-semibold">
            {t('execution.reports.intelligence.sections.context', 'Context and trust')}
          </h2>
          <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-c-text-muted">
                {t('execution.reports.intelligence.stateDate', 'State date')}
              </dt>
              <dd>{new Date(model.stateDate).toLocaleDateString(i18n.language)}</dd>
            </div>
            <div>
              <dt className="text-c-text-muted">
                {t('execution.reports.intelligence.lastSync', 'Last synchronization')}
              </dt>
              {/* Polish pass item 1: one shared, locally-formatted timestamp
                  under the trust strip, instead of a raw ISO string here and
                  the same instant repeated (also as raw ISO) on every one of
                  the eight KPI cards below. */}
              <dd>
                {new Date(state.syncedAt).toLocaleString(i18n.language, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </dd>
            </div>
            <div>
              <dt className="text-c-text-muted">
                {t('execution.reports.intelligence.scope', 'Scope')}
              </dt>
              <dd>
                {t(
                  'execution.reports.intelligence.allExecutionCases',
                  'All accessible Execution cases'
                )}
              </dd>
            </div>
          </dl>
          {state.failedCases > 0 ? (
            <p role="alert" className="mt-3 text-sm">
              {t(
                'execution.reports.intelligence.partialCases',
                '{{count}} source cases unavailable',
                { count: state.failedCases }
              )}
            </p>
          ) : null}
        </section>

        <section
          data-section-order={sections[1]}
          aria-labelledby="work-pulse-title"
          className={SECTION_SHELL_CLASS}
        >
          <h2 id="work-pulse-title" className="font-semibold">
            {t('execution.reports.intelligence.sections.pulse', 'Executive Pulse')}
          </h2>
          <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {model.metrics.map((metric) => (
              <button
                key={metric.id}
                type="button"
                onClick={() => setDrilldownId(metric.id)}
                className="rounded-xl border border-c-border bg-c-surface-raised p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
                aria-label={t(`execution.reports.intelligence.metrics.${metric.id}`, metric.id)}
              >
                <span className="text-xs font-semibold uppercase text-c-text-muted">
                  {t(`execution.reports.intelligence.metrics.${metric.id}`, metric.id)}
                </span>
                {metric.value.kind === 'UNKNOWN' ? (
                  // Polish pass item 6: match the two-line layout of the
                  // CALCULATED branch below (value line + muted detail line)
                  // so the "CZAS DECYZJI" (decisionLatency) card does not
                  // collapse to a shorter height and break the grid row.
                  <>
                    <strong className="mt-2 block text-2xl">
                      {trPair(t, EPISTEMIC_LABEL_KEY.unknown)}
                    </strong>
                    <span className="text-xs text-c-text-muted">
                      {trPair(
                        t,
                        REASON_LABEL_KEY[metric.value.reason] ?? [
                          metric.value.reason,
                          metric.value.reason,
                        ]
                      )}
                    </span>
                  </>
                ) : (
                  <>
                    <strong className="mt-2 block text-2xl">
                      {metric.id === 'dataCompleteness'
                        ? `${metric.value.value}%`
                        : metric.value.value}
                    </strong>
                    <span className="text-xs text-c-text-muted">
                      {metric.value.numerator}/{metric.value.denominator} ·{' '}
                      {trPair(t, EPISTEMIC_LABEL_KEY.calculated)}
                    </span>
                  </>
                )}
                {' '}
                <span
                  className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                    SEVERITY_BADGE_CLASS[metric.severity] ?? SEVERITY_BADGE_CLASS.unknown
                  }`}
                >
                  {trPair(t, SEVERITY_LABEL_KEY[metric.severity] ?? SEVERITY_LABEL_KEY.unknown)}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section data-section-order={sections[2]} className={SECTION_SHELL_CLASS}>
          <h2 className="font-semibold">
            {t('execution.reports.intelligence.sections.hurts', 'What hurts today')}
          </h2>
          <p className="text-sm text-c-text-secondary">
            {trPair(t, EPISTEMIC_LABEL_KEY.fact)} ·{' '}
            {t(
              'execution.reports.intelligence.hurtsBody',
              'Overdue, due-today, blocked and undated records are derived from the exact register below.'
            )}
          </p>
        </section>
        <section data-section-order={sections[3]} className={SECTION_SHELL_CLASS}>
          <h2 className="font-semibold">
            {t('execution.reports.intelligence.sections.approaching', 'What is approaching')}
          </h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(model.buckets).map(([bucket, items]) => (
              <span key={bucket} className="rounded-full border border-c-border px-3 py-1 text-sm">
                {t(
                  `execution.reports.intelligence.buckets.${bucket}`,
                  BUCKET_LABEL_FALLBACK[bucket] ?? bucket
                )}
                : {items.length}
              </span>
            ))}
          </div>
        </section>
        <section data-section-order={sections[4]} className={SECTION_SHELL_CLASS}>
          <h2 className="font-semibold">
            {t('execution.reports.intelligence.sections.stake', 'What is at stake')}
          </h2>
          <p className="text-sm text-c-text-secondary">
            {trPair(t, EPISTEMIC_LABEL_KEY.unknown)} · {trPair(t, REASON_LABEL_KEY.NO_API_BSC)} ·{' '}
            {t(
              'execution.reports.intelligence.operationalOnly',
              'Objective mappings are unavailable; this remains an operational report, not a strategy report.'
            )}
          </p>
        </section>
        <section data-section-order={sections[5]} className={SECTION_SHELL_CLASS}>
          <h2 className="font-semibold">
            {t('execution.reports.intelligence.sections.why', 'Why it is happening')}
          </h2>
          <p className="text-sm text-c-text-secondary">
            {trPair(t, EPISTEMIC_LABEL_KEY.fact)} ·{' '}
            {t(
              'execution.reports.intelligence.whyBody',
              'Blocked records and declared dependencies are shown without inferring unverified causes.'
            )}
          </p>
        </section>
        <section data-section-order={sections[6]} className={SECTION_SHELL_CLASS}>
          <h2 className="font-semibold">
            {t('execution.reports.intelligence.sections.trend', 'How the system is changing')}
          </h2>
          <p className="text-sm text-c-text-secondary">
            {trPair(t, EPISTEMIC_LABEL_KEY.unknown)} · {trPair(t, REASON_LABEL_KEY.NO_API_HISTORY)}
          </p>
        </section>
        <section data-section-order={sections[7]} className={SECTION_SHELL_CLASS}>
          <h2 className="font-semibold">
            {t('execution.reports.intelligence.sections.actions', 'What management should do')}
          </h2>
          <p className="text-sm text-c-text-secondary">
            {trPair(t, EPISTEMIC_LABEL_KEY.recommendation)} ·{' '}
            {t(
              'execution.reports.intelligence.actionsUnavailable',
              'No recommendation is issued without verified impact weights and evidence.'
            )}
          </p>
        </section>
        <section
          data-section-order={sections[8]}
          aria-labelledby="work-register-title"
          className={SECTION_SHELL_CLASS}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="work-register-title" className="font-semibold">
              {t('execution.reports.intelligence.sections.register', 'Auditable register')}
            </h2>
            {selectedMetric ? (
              <button
                type="button"
                onClick={() => setDrilldownId(null)}
                className="rounded-lg border border-c-border px-3 py-1 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
              >
                {t('execution.reports.intelligence.showAllRecords', 'Show all records')} (
                {t(
                  `execution.reports.intelligence.metrics.${selectedMetric.id}`,
                  selectedMetric.id
                )}{' '}
                → {model.items.length})
              </button>
            ) : null}
          </div>
          {(
            analysisEnabled ? selectedAnalysisWindow?.items.length === 0 : state.items.length === 0
          ) ? (
            <p className="mt-2 text-sm text-c-text-muted">
              {t(
                'execution.reports.intelligence.workEmpty',
                'No work records are available for the selected scope.'
              )}
            </p>
          ) : (
            <StandardTable
              columns={columns}
              data={analysisEnabled ? (selectedAnalysisWindow?.items ?? []) : registerItems}
              density="compact"
              empty={{
                title: t(
                  'execution.reports.intelligence.noContributors',
                  'No contributing records'
                ),
              }}
              onRowDoubleClick={(row) => {
                const item = row as unknown as WorkReportItem;
                if ((item.kind === 'TASK' || item.kind === 'DECISION') && onOpenDocument)
                  onOpenDocument({
                    id: item.id,
                    title: item.title,
                    kind: item.kind,
                    status: item.status,
                    executionCaseId: item.executionCaseId,
                  });
              }}
            />
          )}
        </section>
      </div>
    </main>
  );
}
