import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { listReportRuns } from '@/services/initiatives-execution/runtimeApi';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; count: number }
  | { kind: 'error'; message: string };

const reportRunsFrom = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  const record = payload as Record<string, unknown>;
  for (const key of ['items', 'data', 'reportRuns', 'runs']) {
    if (Array.isArray(record[key])) return record[key] as unknown[];
  }
  return [];
};

export function ExecutionReportsIntelligenceEntry(): React.ReactElement {
  const { t } = useTranslation();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  useEffect(() => {
    let active = true;
    void listReportRuns().then(
      (payload) => {
        if (active) setState({ kind: 'ready', count: reportRunsFrom(payload).length });
      },
      (error: unknown) => {
        if (active) {
          setState({
            kind: 'error',
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    );
    return () => {
      active = false;
    };
  }, []);

  return (
    <main
      className="min-h-0 flex-1 overflow-auto bg-c-surface p-6 text-c-text"
      data-testid="execution-reports-intelligence"
    >
      <div className="mx-auto max-w-5xl rounded-xl border border-c-border bg-c-surface-raised p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-c-text-muted">
          {t('execution.reports.intelligence.eyebrow', 'Management report')}
        </p>
        <h1 className="mt-2 text-2xl font-semibold">
          {t('execution.reports.intelligence.workTitle', 'Work Intelligence Report')}
        </h1>
        <p className="mt-2 text-sm text-c-text-secondary">
          {t(
            'execution.reports.intelligence.ssot',
            'Published snapshots are read from the governed runtime-v1 report register.'
          )}
        </p>

        <section aria-live="polite" className="mt-6 rounded-lg border border-c-border-subtle p-4">
          {state.kind === 'loading' ? (
            <p>{t('execution.reports.intelligence.loading', 'Loading report register…')}</p>
          ) : state.kind === 'error' ? (
            <div role="alert">
              <p className="font-medium">
                {t('execution.reports.intelligence.loadError', 'Report register is unavailable')}
              </p>
              <p className="mt-1 text-sm text-c-text-muted">{state.message}</p>
            </div>
          ) : state.count === 0 ? (
            <p>{t('execution.reports.intelligence.empty', 'No governed report runs found.')}</p>
          ) : (
            <p>
              {t('execution.reports.intelligence.runCount', '{{count}} governed report runs', {
                count: state.count,
              })}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
