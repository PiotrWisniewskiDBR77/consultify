import { AlertTriangle, Loader2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';
import {
  StandardTable,
  type TableColumn,
  type TableRow,
} from '@/components/standard/StandardTable';
import {
  decideAnalysis,
  listMyAnalysisDecisions,
  type PendingAnalysisDecisionReadModel,
  RuntimeApiError,
} from '@/services/initiatives-execution/runtimeApi';

import { useGateSignoffGuard } from './gateSignoffProjection';

interface DecisionRow extends TableRow {
  id: string;
  title: string;
  initiativeId: string;
  gate: string;
  requesterId: string;
  dueAt: string;
  version: number;
  source: PendingAnalysisDecisionReadModel;
}

export const AnalysisDecisionQueue: React.FC = () => {
  const { t } = useTranslation();
  const columns: TableColumn[] = [
    { id: 'title', label: t('myWork.analysisDecisionQueue.decision', 'Decision'), sortable: true, width: '240px' },
    { id: 'initiativeId', label: t('myWork.analysisDecisionQueue.initiative', 'Initiative'), sortable: true },
    { id: 'gate', label: t('myWork.analysisDecisionQueue.gate', 'Gate'), sortable: true, filterable: true },
    { id: 'requesterId', label: t('myWork.analysisDecisionQueue.requestedBy', 'Requested by'), sortable: true },
    { id: 'dueAt', label: t('myWork.analysisDecisionQueue.due', 'Due'), sortable: true },
  ];
  const [state, setState] = useState<'LOADING' | 'READY' | 'ERROR'>('LOADING');
  const [decisions, setDecisions] = useState<PendingAnalysisDecisionReadModel[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rationale, setRationale] = useState('');
  const [writeState, setWriteState] = useState<'IDLE' | 'SAVING' | 'CONFLICT' | 'FAILED'>('IDLE');
  const commandIds = useRef(new Map<string, string>());

  const load = useCallback(async () => {
    setState('LOADING');
    try {
      const next = await listMyAnalysisDecisions();
      setDecisions(next);
      setSelectedId((current) =>
        current && next.some((item) => item.decisionId === current) ? current : null
      );
      setState('READY');
    } catch {
      setState('ERROR');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo<DecisionRow[]>(
    () =>
      decisions.map((decision) => ({
        id: decision.decisionId,
        title: t('myWork.analysisDecisionQueue.rowTitle', 'Analysis Decision'),
        initiativeId: decision.initiativeId,
        gate: decision.gate,
        requesterId: decision.requesterId,
        dueAt: decision.dueAt,
        version: decision.version,
        source: decision,
      })),
    [decisions]
  );
  const selected = rows.find((row) => row.id === selectedId) ?? null;
  const gateGuard = useGateSignoffGuard('ANALYSIS', selectedId);

  const decide = async (outcome: 'APPROVED' | 'RETURNED') => {
    if (!selected || !rationale.trim() || !gateGuard.ready || writeState === 'SAVING') return;
    setWriteState('SAVING');
    const key = `${selected.id}:${selected.version}:${outcome}`;
    const clientRequestId = commandIds.current.get(key) ?? crypto.randomUUID();
    commandIds.current.set(key, clientRequestId);
    try {
      await decideAnalysis(selected.initiativeId, {
        expectedVersion: selected.version,
        clientRequestId,
        decisionId: selected.id,
        outcome,
        rationale: rationale.trim(),
        ...(gateGuard.quorumRef ? { governanceQuorumRef: gateGuard.quorumRef } : {}),
      });
      setRationale('');
      setWriteState('IDLE');
      await load();
    } catch (error) {
      setWriteState(
        error instanceof RuntimeApiError && error.status === 409 ? 'CONFLICT' : 'FAILED'
      );
    }
  };

  if (state === 'LOADING')
    return (
      <section aria-label={t('myWork.analysisDecisionQueue.sectionLabel', 'Analysis decisions')} className="p-4">
        <div role="status" className="flex items-center gap-2 text-sm text-c-text-muted">
          <Loader2 aria-hidden="true" className="animate-spin" size={16} /> {t('myWork.analysisDecisionQueue.loading', 'Loading Analysis decisions')}
        </div>
      </section>
    );
  if (state === 'ERROR')
    return (
      <section aria-label={t('myWork.analysisDecisionQueue.sectionLabel', 'Analysis decisions')} className="p-4">
        <div role="alert" className="flex items-center justify-between gap-3 text-sm text-c-danger">
          <span className="flex items-center gap-2">
            <AlertTriangle aria-hidden="true" size={16} /> {t('myWork.analysisDecisionQueue.unavailable', 'Analysis decisions are unavailable.')}
          </span>
          <button type="button" className="btn-secondary" onClick={() => void load()}>
            {t('myWork.analysisDecisionQueue.retry', 'Retry')}
          </button>
        </div>
      </section>
    );
  if (!rows.length) return null;

  return (
    <section aria-label={t('myWork.analysisDecisionQueue.sectionLabel', 'Analysis decisions')} className="border-b border-c-border">
      <div className="px-4 pt-3">
        <h3 className="font-semibold text-c-text-primary">{t('myWork.analysisDecisionQueue.title', 'Analysis decisions waiting on you')}</h3>
        <p className="text-xs text-c-text-muted">
          {t('myWork.analysisDecisionQueue.subtitle', 'Dedicated canonical Analysis gate queue; it does not open the legacy Decision detail.')}
        </p>
      </div>
      {(writeState === 'CONFLICT' || writeState === 'FAILED') && (
        <div role="alert" className="mx-4 mt-2 text-sm text-c-danger">
          {writeState === 'CONFLICT'
            ? t('myWork.analysisDecisionQueue.conflict', 'This Analysis Decision changed. Reload before deciding again.')
            : t('myWork.analysisDecisionQueue.failed', 'The Analysis Decision was not changed.')}
        </div>
      )}
      <TableWithPreviewLayout<DecisionRow>
        selectedId={selectedId}
        selectedItem={selected}
        onSelect={setSelectedId}
        onOpenFull={(id) => setSelectedId(id)}
        itemIds={rows.map((row) => row.id)}
        getItemById={(id) => rows.find((row) => row.id === id) ?? null}
        renderPreview={(row) => (
          <div className="space-y-3 p-4 text-sm">
            <dl className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-c-text-muted">{t('myWork.analysisDecisionQueue.canonicalDecisionId', 'Canonical Decision ID')}</dt>
                <dd>{row.id}</dd>
              </div>
              <div>
                <dt className="text-c-text-muted">{t('myWork.analysisDecisionQueue.initiative', 'Initiative')}</dt>
                <dd>{row.initiativeId}</dd>
              </div>
              <div>
                <dt className="text-c-text-muted">{t('myWork.analysisDecisionQueue.due', 'Due')}</dt>
                <dd>{row.dueAt}</dd>
              </div>
              <div>
                <dt className="text-c-text-muted">{t('myWork.analysisDecisionQueue.frozenAnalysisCards', 'Frozen analysis cards')}</dt>
                <dd>{Object.keys(row.source.cardVersions).length}/10</dd>
              </div>
            </dl>
            <label className="block">
              <span className="mb-1 block text-c-text-muted">{t('myWork.analysisDecisionQueue.decisionRationale', 'Decision rationale')}</span>
              <textarea
                aria-label={t('myWork.analysisDecisionQueue.rationaleAriaLabel', 'Analysis Decision rationale')}
                className="min-h-24 w-full rounded-md border border-c-border bg-c-surface p-2"
                value={rationale}
                onChange={(event) => setRationale(event.target.value)}
              />
            </label>
            {!gateGuard.ready && (
              <div role="alert" className="text-c-warning">
                {t('myWork.analysisDecisionQueue.failClosed', 'Analysis decision is fail-closed until its exact Gate Sign-off quorum is satisfied.')}
              </div>
            )}
          </div>
        )}
        renderPreviewFooter={() => (
          <div className="flex w-full justify-end gap-2 p-3">
            <button
              type="button"
              className="btn-secondary"
              disabled={!rationale.trim() || !gateGuard.ready || writeState === 'SAVING'}
              onClick={() => void decide('RETURNED')}
            >
              {t('myWork.analysisDecisionQueue.returnAnalysis', 'Return analysis')}
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={!rationale.trim() || !gateGuard.ready || writeState === 'SAVING'}
              onClick={() => void decide('APPROVED')}
            >
              {t('myWork.analysisDecisionQueue.approveAnalysis', 'Approve analysis')}
            </button>
          </div>
        )}
      >
        <StandardTable
          columns={columns}
          data={rows}
          selectedRowId={selectedId}
          onRowClick={(row) => setSelectedId(row.id)}
          onRowDoubleClick={(row) => setSelectedId(row.id)}
          persistKey="my-work.analysis-decisions.v1"
        />
      </TableWithPreviewLayout>
    </section>
  );
};
