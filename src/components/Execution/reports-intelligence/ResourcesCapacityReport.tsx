import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { StandardTable, type TableColumn } from '@/components/standard/StandardTable';
import {
  listExecutionCases,
  readOperationalAllocations,
} from '@/services/initiatives-execution/runtimeApi';

interface AllocationRow {
  id: string;
  personId: string;
  person: string;
  initiativeId: string;
  project: string;
  role: string;
  week: string;
  availability: string;
  demand: string;
  saturation: string;
  confidence: string;
  conflict: string;
  skill: string;
  sourceVersion: string;
}
type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; rows: AllocationRow[]; failedCases: number };
const known = (value: any): string => {
  if (!value || value.knowledgeState === 'UNKNOWN') return 'UNKNOWN';
  const amount = value.base ?? value.value ?? value.committed ?? value.estimated;
  return amount === undefined || amount === null
    ? String(value.knowledgeState ?? 'UNKNOWN')
    : String(amount);
};

export function ResourcesCapacityReport(): React.ReactElement {
  const { t } = useTranslation();
  const [state, setState] = useState<State>({ kind: 'loading' });
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const payload = (await listExecutionCases()) as any;
        const cases = Array.isArray(payload?.cases) ? payload.cases : [];
        const results = await Promise.allSettled(
          cases.map(async (executionCase: any) => {
            const response = (await readOperationalAllocations(
              executionCase.executionCaseId
            )) as any;
            return (Array.isArray(response?.items) ? response.items : []).map(
              (item: any): AllocationRow => {
                const availability = known(item.availability ?? item.supply);
                const demand = known(item.demand);
                const low = item.load?.low;
                const high = item.load?.high;
                return {
                  id: String(item.allocationId),
                  personId: String(item.assigneeId || item.personId || item.roleId || 'UNKNOWN'),
                  person: String(
                    item.assigneeName ||
                      item.personName ||
                      item.roleName ||
                      item.assigneeId ||
                      'UNKNOWN'
                  ),
                  initiativeId: String(executionCase.initiativeId || 'UNKNOWN'),
                  project: String(
                    executionCase.initiativeTitle ||
                      executionCase.title ||
                      executionCase.initiativeId ||
                      'UNKNOWN'
                  ),
                  role: String(item.roleName || item.roleId || 'UNKNOWN'),
                  week: String(item.timeBasis?.weekStart || item.timeBasis?.window || 'UNKNOWN'),
                  availability,
                  demand,
                  saturation:
                    availability === 'UNKNOWN' ||
                    demand === 'UNKNOWN' ||
                    low == null ||
                    high == null
                      ? 'UNKNOWN'
                      : `${low}–${high}`,
                  confidence: String(
                    item.confidence || item.availabilityRef?.knowledgeState || 'UNKNOWN'
                  ),
                  conflict: String(
                    item.conflict?.state || item.assessment?.state || 'NOT_VERIFIED'
                  ),
                  skill: String(item.skillMatch?.label || item.skillMatch?.state || 'UNKNOWN'),
                  sourceVersion: String(item.version ?? 'UNKNOWN'),
                };
              }
            );
          })
        );
        if (!active) return;
        const ok = results.filter(
          (result): result is PromiseFulfilledResult<AllocationRow[]> =>
            result.status === 'fulfilled'
        );
        setState({
          kind: 'ready',
          rows: ok.flatMap((result) => result.value),
          failedCases: results.length - ok.length,
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
  const people = useMemo(
    () =>
      state.kind === 'ready'
        ? Array.from(new Map(state.rows.map((row) => [row.personId, row])).values())
        : [],
    [state]
  );
  const unknownCapacity =
    state.kind === 'ready' ? state.rows.filter((row) => row.availability === 'UNKNOWN').length : 0;
  const columns: TableColumn[] = [
    { id: 'person', label: t('execution.reports.intelligence.resources.person', 'Person / role') },
    { id: 'project', label: t('execution.reports.intelligence.resources.project', 'Project') },
    { id: 'week', label: t('execution.reports.intelligence.resources.week', 'Week') },
    {
      id: 'availability',
      label: t('execution.reports.intelligence.resources.availability', 'Availability'),
    },
    { id: 'demand', label: t('execution.reports.intelligence.resources.demand', 'Demand') },
    {
      id: 'saturation',
      label: t('execution.reports.intelligence.resources.saturation', 'Saturation range'),
    },
    {
      id: 'confidence',
      label: t('execution.reports.intelligence.resources.confidence', 'Confidence'),
    },
  ];
  if (state.kind === 'loading')
    return (
      <div role="status">
        {t('execution.reports.intelligence.resources.loading', 'Loading resources report…')}
      </div>
    );
  if (state.kind === 'error')
    return (
      <div role="alert">
        {t('execution.reports.intelligence.resources.error', 'Resources report is unavailable')}:{' '}
        {state.message}
      </div>
    );
  return (
    <main
      className="min-h-0 flex-1 overflow-auto bg-c-surface p-4 text-c-text"
      data-testid="resources-capacity-report"
    >
      <div className="mx-auto max-w-7xl space-y-5">
        <header>
          <p className="text-xs font-semibold uppercase text-c-text-muted">
            FACT · runtime-v1 allocations
          </p>
          <h1 className="text-2xl font-semibold">
            {t('execution.reports.intelligence.resources.title', 'People Capacity Intelligence')}
          </h1>
          <p className="text-sm text-c-text-secondary">
            {t(
              'execution.reports.intelligence.resources.horizon',
              'Base week and 4/8/12/26-week horizon'
            )}
          </p>
        </header>
        {state.failedCases ? (
          <p role="alert">
            {t(
              'execution.reports.intelligence.partialCases',
              '{{count}} source cases unavailable',
              { count: state.failedCases }
            )}
          </p>
        ) : null}
        <section
          aria-label={t('execution.reports.intelligence.resources.kpi', 'Capacity summary')}
          className="grid gap-3 sm:grid-cols-3"
        >
          <div className="rounded-xl border border-c-border p-4">
            <strong>{people.length}</strong>
            <span className="block text-sm text-c-text-muted">
              {t(
                'execution.reports.intelligence.resources.inScopePeople',
                'People / roles in scope'
              )}
            </span>
          </div>
          <div className="rounded-xl border border-c-border p-4">
            <strong>{unknownCapacity}</strong>
            <span className="block text-sm text-c-text-muted">
              {t(
                'execution.reports.intelligence.resources.unknownCapacity',
                'UNKNOWN availability'
              )}
            </span>
          </div>
          <div className="rounded-xl border border-c-border p-4">
            <strong>UNKNOWN</strong>
            <span className="block text-sm text-c-text-muted">
              {t('execution.reports.intelligence.resources.buffer', 'Operating buffer')}
            </span>
          </div>
        </section>
        {/* F8 polish pass, item 8: the previous "heatmap" section rendered
            the exact same rows (person/week/saturation) as the People view
            table below, with no pivot or aggregation — a literal duplicate
            under a misleading name (see Day 11 report "Korekta odbiorcza",
            item 1). Removed rather than dressed up: a real person×week
            matrix is a rebuild, out of scope for this pass; the People view
            table already carries every field this section repeated. */}
        <section>
          <h2 className="font-semibold">
            {t('execution.reports.intelligence.resources.peopleView', 'People view')}
          </h2>
          {state.rows.length ? (
            <StandardTable
              columns={columns}
              data={state.rows as any}
              density="compact"
              empty={{
                title: t(
                  'execution.reports.intelligence.resources.empty',
                  'No allocations in scope'
                ),
              }}
            />
          ) : (
            <p>{t('execution.reports.intelligence.resources.empty', 'No allocations in scope')}</p>
          )}
        </section>
        <section>
          <h2 className="font-semibold">
            {t('execution.reports.intelligence.resources.projectView', 'Project view')}
          </h2>
          <ul className="mt-2 space-y-1 text-sm">
            {Array.from(new Set(state.rows.map((row) => row.project))).map((project) => (
              <li key={project} className="rounded-lg border border-c-border-subtle px-3 py-2">
                {project} ·{' '}
                {t(
                  'execution.reports.intelligence.resources.coverageUnknown',
                  'role/skill coverage UNKNOWN'
                )}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="font-semibold">
            {t(
              'execution.reports.intelligence.resources.registers',
              'Conflict and missing-data registers'
            )}
          </h2>
          <ul className="mt-2 space-y-1 text-sm">
            {state.rows
              .filter(
                (row) =>
                  row.conflict !== 'NOT_VERIFIED' ||
                  row.skill === 'UNKNOWN' ||
                  row.availability === 'UNKNOWN'
              )
              .map((row) => (
                <li
                  key={row.id}
                  className="rounded-lg border border-c-border-subtle px-3 py-2 font-mono text-xs"
                >
                  {row.person} · {row.conflict} · {row.skill} · {row.availability} · SOURCE v
                  {row.sourceVersion}
                </li>
              ))}
          </ul>
        </section>
        <section>
          <h2 className="font-semibold">
            {t('execution.reports.intelligence.resources.recommendations', 'Recommendations')}
          </h2>
          <p>
            RECOMMENDATION ·{' '}
            {t(
              'execution.reports.intelligence.resources.noRecommendation',
              'No rebalancing proposal is issued while capacity or thresholds are UNKNOWN.'
            )}
          </p>
        </section>
      </div>
    </main>
  );
}
