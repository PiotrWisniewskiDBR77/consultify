import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { StandardTable, type TableColumn } from '@/components/standard/StandardTable';
import {
  listInterventions,
  listManagementSignals,
} from '@/services/initiatives-execution/runtimeApi';

interface ControlRow {
  id: string;
  kind: 'SIGNAL' | 'INTERVENTION';
  title: string;
  status: string;
  severity: string;
  owner: string;
  decisionId: string;
  workItemId: string;
  verification: string;
  sourceVersion: string;
  source: unknown;
}
type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; rows: ControlRow[]; syncedAt: string };
const rowsAt = (payload: any, keys: string[]) => {
  for (const key of keys) if (Array.isArray(payload?.[key])) return payload[key];
  return Array.isArray(payload) ? payload : [];
};

export function ControlLoopReport(): React.ReactElement {
  const { t } = useTranslation();
  const [state, setState] = useState<State>({ kind: 'loading' });
  useEffect(() => {
    let active = true;
    void Promise.all([listManagementSignals(), listInterventions()]).then(
      ([signalPayload, interventionPayload]: any[]) => {
        if (!active) return;
        const signals: ControlRow[] = rowsAt(signalPayload, ['items', 'signals', 'data']).map(
          (item: any) => ({
            id: String(item.signalId || item.id),
            kind: 'SIGNAL',
            title: String(
              item.title || item.summary || item.signalType || item.signalId || 'UNKNOWN'
            ),
            status: String(item.status || 'UNKNOWN'),
            severity: String(item.severity || 'DECISION_REQUIRED'),
            owner: String(item.ownerId || item.analysisOwnerId || 'OWNER_MISSING'),
            decisionId: String(item.decisionId || 'UNKNOWN'),
            workItemId: String(item.taskId || item.workItemId || 'UNKNOWN'),
            verification: String(item.verificationState || 'NOT_VERIFIED'),
            sourceVersion: String(item.version ?? 'UNKNOWN'),
            source: item,
          })
        );
        const interventions: ControlRow[] = rowsAt(interventionPayload, [
          'items',
          'interventions',
          'data',
        ]).map((item: any) => {
          const hasEvidence = Array.isArray(item.evidenceRefs) && item.evidenceRefs.length > 0;
          const closed = ['RESOLVED', 'CLOSED', 'COMPLETED'].includes(
            String(item.status).toUpperCase()
          );
          return {
            id: String(item.interventionId || item.id),
            kind: 'INTERVENTION',
            title: String(item.title || item.interventionType || item.interventionId || 'UNKNOWN'),
            status: String(item.status || 'UNKNOWN'),
            severity: String(item.severity || 'DECISION_REQUIRED'),
            owner: String(item.ownerId || 'OWNER_MISSING'),
            decisionId: String(item.decisionId || 'UNKNOWN'),
            workItemId: String(item.taskId || item.workItemId || 'UNKNOWN'),
            verification:
              closed && !hasEvidence
                ? 'NOT_VERIFIED'
                : String(item.verificationState || (hasEvidence ? 'VERIFIED' : 'NOT_VERIFIED')),
            sourceVersion: String(item.version ?? 'UNKNOWN'),
            source: item,
          };
        });
        setState({
          kind: 'ready',
          rows: [...signals, ...interventions],
          syncedAt: new Date().toISOString(),
        });
      },
      (error: unknown) => {
        if (active)
          setState({
            kind: 'error',
            message: error instanceof Error ? error.message : String(error),
          });
      }
    );
    return () => {
      active = false;
    };
  }, []);
  const metrics = useMemo(() => {
    const rows = state.kind === 'ready' ? state.rows : [];
    const signals = rows.filter((row) => row.kind === 'SIGNAL');
    const interventions = rows.filter((row) => row.kind === 'INTERVENTION');
    return [
      { id: 'signals', items: signals },
      { id: 'decisions', items: rows.filter((row) => row.decisionId !== 'UNKNOWN') },
      { id: 'interventions', items: interventions },
      {
        id: 'notVerified',
        items: interventions.filter((row) => row.verification === 'NOT_VERIFIED'),
      },
    ];
  }, [state]);
  const columns: TableColumn[] = [
    { id: 'kind', label: t('execution.reports.intelligence.control.kind', 'Type') },
    {
      id: 'title',
      label: t('execution.reports.intelligence.control.record', 'Signal / intervention'),
    },
    { id: 'status', label: t('execution.reports.intelligence.control.status', 'Status') },
    { id: 'severity', label: t('execution.reports.intelligence.control.severity', 'Severity') },
    { id: 'owner', label: t('execution.reports.intelligence.control.owner', 'Owner') },
    {
      id: 'verification',
      label: t('execution.reports.intelligence.control.verification', 'Verification'),
    },
    {
      id: 'sourceVersion',
      label: t('execution.reports.intelligence.columns.version', 'Source version'),
    },
  ];
  if (state.kind === 'loading')
    return (
      <div role="status">
        {t('execution.reports.intelligence.control.loading', 'Loading control report…')}
      </div>
    );
  if (state.kind === 'error')
    return (
      <div role="alert">
        {t('execution.reports.intelligence.control.error', 'Control report is unavailable')}:{' '}
        {state.message}
      </div>
    );
  return (
    <main
      className="min-h-0 flex-1 overflow-auto bg-c-surface p-4 text-c-text"
      data-testid="control-loop-report"
    >
      <div className="mx-auto max-w-7xl space-y-5">
        <header>
          <p className="text-xs font-semibold uppercase text-c-text-muted">
            FACT · runtime-v1 signals/interventions · {state.syncedAt}
          </p>
          <h1 className="text-2xl font-semibold">
            {t('execution.reports.intelligence.control.title', 'Management Control Loop')}
          </h1>
          <p className="text-sm text-c-text-secondary">
            signal → qualification → analysis → human decision → intervention → execution task →
            verification → resolve/escalate/reopen
          </p>
        </header>
        <section className="grid gap-3 sm:grid-cols-4">
          {metrics.map((metric) => (
            <div key={metric.id} className="rounded-xl border border-c-border p-4">
              <strong>{metric.items.length}</strong>
              <span className="block text-sm text-c-text-muted">
                {t(`execution.reports.intelligence.control.metrics.${metric.id}`, metric.id)} ·{' '}
                {metric.items.length}/{state.rows.length} · CALCULATED
              </span>
            </div>
          ))}
        </section>
        <section>
          <h2 className="font-semibold">
            {t(
              'execution.reports.intelligence.control.register',
              'Unified signal and intervention register'
            )}
          </h2>
          {state.rows.length ? (
            <StandardTable
              columns={columns}
              data={state.rows as any}
              density="compact"
              empty={{
                title: t('execution.reports.intelligence.control.empty', 'No control records'),
              }}
            />
          ) : (
            <p>{t('execution.reports.intelligence.control.empty', 'No control records')}</p>
          )}
        </section>
        <section>
          <h2 className="font-semibold">
            {t(
              'execution.reports.intelligence.control.lineage',
              'Causal and bidirectional lineage'
            )}
          </h2>
          <ul>
            {state.rows.map((row) => (
              <li key={row.id}>
                FACT · {row.kind}:{row.id} → decision:{row.decisionId} → work:{row.workItemId} →
                verification:{row.verification} · SOURCE v{row.sourceVersion}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="font-semibold">
            {t('execution.reports.intelligence.control.scenarios', 'Forward scenarios')}
          </h2>
          <p>
            INFERENCE · base: UNKNOWN · optimistic: UNKNOWN · pessimistic: UNKNOWN ·
            BRAK_API_FORECAST
          </p>
        </section>
        <section>
          <h2 className="font-semibold">
            {t(
              'execution.reports.intelligence.control.summary',
              'Executive summary and evidence annex'
            )}
          </h2>
          <p>
            RECOMMENDATION ·{' '}
            {t(
              'execution.reports.intelligence.control.noRecommendation',
              'No intervention is recommended without an approved severity taxonomy, reaction SLA and verified evidence.'
            )}
          </p>
        </section>
      </div>
    </main>
  );
}
