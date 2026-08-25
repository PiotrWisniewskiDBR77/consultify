import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { StandardTable, type TableColumn } from '@/components/standard/StandardTable';
import {
  listExecutionCases,
  readExecutionMilestones,
  readExecutionWork,
} from '@/services/initiatives-execution/runtimeApi';

import { buildWorkReportModel, type WorkReportItem } from './workReportModel';

interface Props {
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

const arrayAt = (payload: unknown, key: string): any[] => {
  if (!payload || typeof payload !== 'object') return [];
  const value = (payload as Record<string, unknown>)[key];
  return Array.isArray(value) ? value : [];
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

export function WorkIntelligenceReport({ onOpenDocument }: Props): React.ReactElement {
  const { t, i18n } = useTranslation();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [drilldownId, setDrilldownId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const casesPayload = (await listExecutionCases()) as Record<string, unknown>;
        const cases = arrayAt(casesPayload, 'cases');
        const results = await Promise.allSettled(
          cases.map(async (executionCase: any) => {
            const caseId = String(executionCase.executionCaseId);
            const [work, milestones] = (await Promise.all([
              readExecutionWork(caseId),
              readExecutionMilestones(caseId),
            ])) as any[];
            const common = {
              executionCaseId: caseId,
              initiativeId: String(executionCase.initiativeId || ''),
            };
            const tasks: WorkReportItem[] = arrayAt(work, 'tasks').map((item: any) => ({
              ...common,
              id: String(item.taskId),
              title: String(item.title || item.taskId),
              kind: 'TASK',
              status: String(item.status || 'UNKNOWN'),
              ownerId: item.assigneeId ? String(item.assigneeId) : null,
              dueAt: item.dueAt ? String(item.dueAt) : null,
              slaAt: item.slaAt ? String(item.slaAt) : null,
              dependencies: Array.isArray(item.dependencies) ? item.dependencies : [],
              evidenceRefs: Array.isArray(item.evidenceRefs) ? item.evidenceRefs : [],
              definitionOfDone: item.definitionOfDone ? String(item.definitionOfDone) : null,
              sourceVersion: Number.isFinite(Number(item.version)) ? Number(item.version) : null,
            }));
            const decisions: WorkReportItem[] = arrayAt(work, 'decisions').map((item: any) => ({
              ...common,
              id: String(item.decisionId),
              title: String(item.title || item.decisionId),
              kind: 'DECISION',
              status: String(item.status || 'UNKNOWN'),
              ownerId: item.authorityId ? String(item.authorityId) : null,
              dueAt: item.dueAt ? String(item.dueAt) : null,
              slaAt: item.slaAt ? String(item.slaAt) : null,
              dependencies: Array.isArray(item.dependencies) ? item.dependencies : [],
              evidenceRefs: Array.isArray(item.evidenceRefs) ? item.evidenceRefs : [],
              definitionOfDone: item.successCriteria ? String(item.successCriteria) : null,
              sourceVersion: Number.isFinite(Number(item.version)) ? Number(item.version) : null,
            }));
            const milestoneItems: WorkReportItem[] = arrayAt(milestones, 'items').map(
              (item: any) => ({
                ...common,
                id: String(item.milestoneId),
                title: String(item.title || item.milestoneId),
                kind: 'MILESTONE',
                status: String(item.status || 'UNKNOWN'),
                ownerId: item.ownerId ? String(item.ownerId) : null,
                dueAt: item.targetAt ? String(item.targetAt) : null,
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
  }, []);

  const model = useMemo(
    () =>
      state.kind === 'ready' ? buildWorkReportModel(state.items, new Date(state.syncedAt)) : null,
    [state]
  );
  const selectedMetric = model?.metrics.find((metric) => metric.id === drilldownId) ?? null;
  const registerItems = selectedMetric ? selectedMetric.drilldown : (model?.items ?? []);
  const columns: TableColumn[] = [
    {
      id: 'title',
      label: t('execution.reports.intelligence.columns.title', 'Record'),
      sortable: true,
    },
    { id: 'kind', label: t('execution.reports.intelligence.columns.kind', 'Type'), sortable: true },
    {
      id: 'status',
      label: t('execution.reports.intelligence.columns.status', 'Status'),
      sortable: true,
    },
    {
      id: 'ownerId',
      label: t('execution.reports.intelligence.columns.owner', 'Owner'),
      sortable: true,
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
              <dd>{state.syncedAt}</dd>
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

        <section data-section-order={sections[1]} aria-labelledby="work-pulse-title">
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
                  <strong className="mt-2 block">UNKNOWN</strong>
                ) : (
                  <>
                    <strong className="mt-2 block text-2xl">
                      {metric.id === 'dataCompleteness'
                        ? `${metric.value.value}%`
                        : metric.value.value}
                    </strong>
                    <span className="text-xs text-c-text-muted">
                      {metric.value.numerator}/{metric.value.denominator} · CALCULATED ·{' '}
                      {model.calculatedAt}
                    </span>
                  </>
                )}
                <span className="mt-2 block text-xs">{metric.severity.toUpperCase()}</span>
              </button>
            ))}
          </div>
        </section>

        <section data-section-order={sections[2]}>
          <h2 className="font-semibold">
            {t('execution.reports.intelligence.sections.hurts', 'What hurts today')}
          </h2>
          <p className="text-sm text-c-text-secondary">
            FACT ·{' '}
            {t(
              'execution.reports.intelligence.hurtsBody',
              'Overdue, due-today, blocked and undated records are derived from the exact register below.'
            )}
          </p>
        </section>
        <section data-section-order={sections[3]}>
          <h2 className="font-semibold">
            {t('execution.reports.intelligence.sections.approaching', 'What is approaching')}
          </h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(model.buckets).map(([bucket, items]) => (
              <span key={bucket} className="rounded-full border border-c-border px-3 py-1 text-sm">
                {bucket}: {items.length}
              </span>
            ))}
          </div>
        </section>
        <section data-section-order={sections[4]}>
          <h2 className="font-semibold">
            {t('execution.reports.intelligence.sections.stake', 'What is at stake')}
          </h2>
          <p className="text-sm text-c-text-secondary">
            UNKNOWN · BRAK_API_BSC ·{' '}
            {t(
              'execution.reports.intelligence.operationalOnly',
              'Objective mappings are unavailable; this remains an operational report, not a strategy report.'
            )}
          </p>
        </section>
        <section data-section-order={sections[5]}>
          <h2 className="font-semibold">
            {t('execution.reports.intelligence.sections.why', 'Why it is happening')}
          </h2>
          <p className="text-sm text-c-text-secondary">
            FACT ·{' '}
            {t(
              'execution.reports.intelligence.whyBody',
              'Blocked records and declared dependencies are shown without inferring unverified causes.'
            )}
          </p>
        </section>
        <section data-section-order={sections[6]}>
          <h2 className="font-semibold">
            {t('execution.reports.intelligence.sections.trend', 'How the system is changing')}
          </h2>
          <p className="text-sm text-c-text-secondary">UNKNOWN · BRAK_API_HISTORY</p>
        </section>
        <section data-section-order={sections[7]}>
          <h2 className="font-semibold">
            {t('execution.reports.intelligence.sections.actions', 'What management should do')}
          </h2>
          <p className="text-sm text-c-text-secondary">
            RECOMMENDATION ·{' '}
            {t(
              'execution.reports.intelligence.actionsUnavailable',
              'No recommendation is issued without verified impact weights and evidence.'
            )}
          </p>
        </section>
        <section data-section-order={sections[8]} aria-labelledby="work-register-title">
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
                {t(`execution.reports.intelligence.metrics.${selectedMetric.id}`, selectedMetric.id)}{' '}
                → {model.items.length})
              </button>
            ) : null}
          </div>
          {state.items.length === 0 ? (
            <p className="mt-2 text-sm text-c-text-muted">
              {t(
                'execution.reports.intelligence.workEmpty',
                'No work records are available for the selected scope.'
              )}
            </p>
          ) : (
            <StandardTable
              columns={columns}
              data={registerItems as any}
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
