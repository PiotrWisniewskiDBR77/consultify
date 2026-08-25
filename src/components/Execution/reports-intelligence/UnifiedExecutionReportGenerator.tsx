import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  createReportRun,
  getReportDefinition,
  listReportDefinitions,
  listReportRuns,
} from '@/services/initiatives-execution/runtimeApi';

interface DefinitionOption {
  id: string;
  version: number;
  name: string;
  ownerId: string;
  approverId: string;
}
type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; definitions: DefinitionOption[]; runs: any[] };
const itemsAt = (payload: any) =>
  Array.isArray(payload?.items) ? payload.items : Array.isArray(payload) ? payload : [];

export function UnifiedExecutionReportGenerator(): React.ReactElement {
  const { t } = useTranslation();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [selectedRunIds, setSelectedRunIds] = useState<string[]>([]);
  const [form, setForm] = useState({
    reportRunId: '',
    definition: '',
    purpose: '',
    audience: '',
    periodStart: '',
    periodEnd: '',
    asOf: '',
    reportWeek: '',
    forecastHorizon: '4',
    timezone: 'Europe/Warsaw',
    scopeRef: '',
    sections: ['WORK', 'PEOPLE', 'CONTROL', 'FORECAST', 'DATA_ANNEX'],
  });
  const [write, setWrite] = useState<'IDLE' | 'SAVING' | 'ERROR'>('IDLE');

  const load = async () => {
    setState({ kind: 'loading' });
    try {
      const [definitionsPayload, runsPayload] = (await Promise.all([
        listReportDefinitions(),
        listReportRuns(),
      ])) as any[];
      const details = await Promise.all(
        itemsAt(definitionsPayload).map((item: any) => getReportDefinition(item.definitionId))
      );
      const definitions = details.flatMap((definition: any): DefinitionOption[] => {
        const published = (Array.isArray(definition.versions) ? definition.versions : []).filter(
          (version: any) => version.state === 'PUBLISHED'
        );
        return published.map((version: any) => ({
          id: String(definition.definitionId),
          version: Number(version.definitionVersion),
          name: String(version.name || definition.definitionId),
          ownerId: String(version.ownerId || 'UNKNOWN'),
          approverId: String(version.approverId || 'UNKNOWN'),
        }));
      });
      setState({ kind: 'ready', definitions, runs: itemsAt(runsPayload) });
    } catch (error) {
      setState({ kind: 'error', message: error instanceof Error ? error.message : String(error) });
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const selectedDefinition = useMemo(
    () =>
      state.kind === 'ready'
        ? state.definitions.find((item) => `${item.id}@${item.version}` === form.definition)
        : undefined,
    [form.definition, state]
  );
  const valid = Boolean(
    selectedDefinition &&
    form.reportRunId &&
    form.purpose &&
    form.audience &&
    form.periodStart &&
    form.periodEnd &&
    form.asOf &&
    form.reportWeek &&
    form.scopeRef
  );
  const create = async () => {
    if (!valid || !selectedDefinition) return;
    setWrite('SAVING');
    try {
      await createReportRun(form.reportRunId, {
        definitionRef: { definitionId: selectedDefinition.id, version: selectedDefinition.version },
        parentRunRef: null,
        audience: form.audience
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
        scopeRefs: [form.scopeRef],
        period: {
          start: new Date(form.periodStart).toISOString(),
          end: new Date(form.periodEnd).toISOString(),
        },
        asOf: new Date(form.asOf).toISOString(),
        sources: [],
        ownerId: selectedDefinition.ownerId,
        approverId: selectedDefinition.approverId,
        expectedVersion: 0,
        clientRequestId: crypto.randomUUID(),
      });
      setWrite('IDLE');
      await load();
    } catch {
      setWrite('ERROR');
    }
  };
  if (state.kind === 'loading')
    return (
      <div role="status">
        {t('execution.reports.intelligence.generator.loading', 'Loading report generator…')}
      </div>
    );
  if (state.kind === 'error')
    return (
      <div role="alert">
        {t('execution.reports.intelligence.generator.error', 'Report generator is unavailable')}:{' '}
        {state.message}
      </div>
    );
  return (
    <main
      className="min-h-0 flex-1 overflow-auto bg-c-surface p-4 text-c-text"
      data-testid="unified-execution-report-generator"
    >
      <div className="mx-auto max-w-6xl space-y-5">
        <header>
          <p className="text-xs font-semibold uppercase text-c-text-muted">
            runtime-v1 report-runs · SSOT
          </p>
          <h1 className="text-2xl font-semibold">
            {t('execution.reports.intelligence.generator.title', 'Create Execution report')}
          </h1>
        </header>
        <section
          aria-label={t('execution.reports.intelligence.generator.context', 'Report context')}
          className="grid gap-3 rounded-xl border border-c-border p-4 sm:grid-cols-2"
        >
          <label>
            {t('execution.reports.intelligence.generator.runId', 'Report run ID')}
            <input
              value={form.reportRunId}
              onChange={(event) => setForm({ ...form, reportRunId: event.target.value })}
              className="mt-1 w-full rounded-lg border border-c-border bg-c-surface p-2"
            />
          </label>
          <label>
            {t('execution.reports.intelligence.generator.definition', 'Published definition')}
            <select
              value={form.definition}
              onChange={(event) => setForm({ ...form, definition: event.target.value })}
              className="mt-1 w-full rounded-lg border border-c-border bg-c-surface p-2"
            >
              <option value="">
                {t('execution.reports.intelligence.generator.select', 'Select')}
              </option>
              {state.definitions.map((item) => (
                <option key={`${item.id}@${item.version}`} value={`${item.id}@${item.version}`}>
                  {item.name} · v{item.version}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('execution.reports.intelligence.generator.purpose', 'Purpose')}
            <input
              value={form.purpose}
              onChange={(event) => setForm({ ...form, purpose: event.target.value })}
              className="mt-1 w-full rounded-lg border border-c-border bg-c-surface p-2"
            />
          </label>
          <label>
            {t('execution.reports.intelligence.generator.audience', 'Audience')}
            <input
              value={form.audience}
              onChange={(event) => setForm({ ...form, audience: event.target.value })}
              className="mt-1 w-full rounded-lg border border-c-border bg-c-surface p-2"
            />
          </label>
          <label>
            {t('execution.reports.intelligence.generator.historyStart', 'Historical period start')}
            <input
              type="date"
              value={form.periodStart}
              onChange={(event) => setForm({ ...form, periodStart: event.target.value })}
              className="mt-1 w-full rounded-lg border border-c-border bg-c-surface p-2"
            />
          </label>
          <label>
            {t('execution.reports.intelligence.generator.historyEnd', 'Historical period end')}
            <input
              type="date"
              value={form.periodEnd}
              onChange={(event) => setForm({ ...form, periodEnd: event.target.value })}
              className="mt-1 w-full rounded-lg border border-c-border bg-c-surface p-2"
            />
          </label>
          <label>
            {t('execution.reports.intelligence.generator.asOf', 'Separate as-of timestamp')}
            <input
              type="datetime-local"
              value={form.asOf}
              onChange={(event) => setForm({ ...form, asOf: event.target.value })}
              className="mt-1 w-full rounded-lg border border-c-border bg-c-surface p-2"
            />
          </label>
          <label>
            {t('execution.reports.intelligence.generator.reportWeek', 'Reporting week')}
            <input
              type="week"
              value={form.reportWeek}
              onChange={(event) => setForm({ ...form, reportWeek: event.target.value })}
              className="mt-1 w-full rounded-lg border border-c-border bg-c-surface p-2"
            />
          </label>
          <label>
            {t('execution.reports.intelligence.generator.forecast', 'Forecast horizon (weeks)')}
            <select
              value={form.forecastHorizon}
              onChange={(event) => setForm({ ...form, forecastHorizon: event.target.value })}
              className="mt-1 w-full rounded-lg border border-c-border bg-c-surface p-2"
            >
              {[4, 8, 12, 26].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            {t('execution.reports.intelligence.generator.scope', 'Authorized scope reference')}
            <input
              value={form.scopeRef}
              onChange={(event) => setForm({ ...form, scopeRef: event.target.value })}
              className="mt-1 w-full rounded-lg border border-c-border bg-c-surface p-2"
            />
          </label>
          <p className="sm:col-span-2">
            {t('execution.reports.intelligence.generator.validation', 'Validation')}:{' '}
            {valid ? 'READY_TO_CREATE_DRAFT' : 'INCOMPLETE'} ·{' '}
            {t(
              'execution.reports.intelligence.generator.sourcesWarning',
              'Source evidence is attached by the governed runtime workflow; an empty source set cannot validate or publish. Reporting week, forecast horizon and section selection are preflight context only because runtime-v1 has no contract fields for them (BRAK_API).'
            )}
          </p>
          <button
            type="button"
            disabled={!valid || write === 'SAVING'}
            onClick={() => void create()}
            className="rounded-lg bg-c-text px-4 py-2 text-c-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)] disabled:opacity-50"
          >
            {t('execution.reports.intelligence.generator.createDraft', 'Create governed draft')}
          </button>
          {write === 'ERROR' ? (
            <p role="alert">
              {t('execution.reports.intelligence.generator.createError', 'Draft creation failed')}
            </p>
          ) : null}
        </section>
        <section>
          <h2 className="font-semibold">
            {t('execution.reports.intelligence.generator.openReports', 'Open reports')}
          </h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {state.runs.map((run: any) => {
              const id = String(run.reportRunId);
              const published = run.status === 'PUBLISHED';
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() =>
                    setSelectedRunIds((current) =>
                      current.includes(id)
                        ? current.filter((value) => value !== id)
                        : [...current, id]
                    )
                  }
                  className="rounded-lg border border-c-border px-3 py-2 focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
                >
                  {id} · {run.status} ·{' '}
                  {published ? `contentHash:${run.contentHash || 'UNKNOWN'}` : 'DYNAMIC_DRAFT'}
                </button>
              );
            })}
          </div>
          <p>
            {t('execution.reports.intelligence.generator.openCount', 'Open report tabs')}:{' '}
            {selectedRunIds.length}
          </p>
        </section>
        <section>
          <h2 className="font-semibold">
            {t('execution.reports.intelligence.generator.export', 'Export')}
          </h2>
          <p>PDF: management-reports pipeline · XLSX: BRAK_API · runtime-v1 package: JSON</p>
        </section>
      </div>
    </main>
  );
}
