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
  decideDefinition,
  listMyDefinitionDecisions,
  type PendingDefinitionDecisionReadModel,
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
  source: PendingDefinitionDecisionReadModel;
}

export const DefinitionDecisionQueue: React.FC = () => {
  const { t } = useTranslation();
  const columns: TableColumn[] = [
    { id: 'title', label: t('myWork.definitionDecisionQueue.decision', 'Decision'), sortable: true, width: '240px' },
    { id: 'initiativeId', label: t('myWork.definitionDecisionQueue.initiative', 'Initiative'), sortable: true },
    { id: 'gate', label: t('myWork.definitionDecisionQueue.gate', 'Gate'), sortable: true, filterable: true },
    { id: 'requesterId', label: t('myWork.definitionDecisionQueue.requestedBy', 'Requested by'), sortable: true },
    { id: 'dueAt', label: t('myWork.definitionDecisionQueue.due', 'Due'), sortable: true },
  ];
  const [state, setState] = useState<'LOADING' | 'READY' | 'ERROR'>('LOADING');
  const [decisions, setDecisions] = useState<PendingDefinitionDecisionReadModel[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rationale, setRationale] = useState('');
  const [writeState, setWriteState] = useState<'IDLE' | 'SAVING' | 'CONFLICT' | 'FAILED'>('IDLE');
  const commandIds = useRef(new Map<string, string>());

  const load = useCallback(async () => {
    setState('LOADING');
    try {
      const next = await listMyDefinitionDecisions();
      setDecisions(next);
      setSelectedId((current) =>
        current && next.some((decision) => decision.decisionId === current) ? current : null
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
        title: t('myWork.definitionDecisionQueue.rowTitle', 'Definition Decision'),
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
  const gateGuard = useGateSignoffGuard('DEFINITION', selectedId);

  const decide = async (outcome: 'APPROVED' | 'RETURNED') => {
    if (!selected || !rationale.trim() || !gateGuard.ready || writeState === 'SAVING') return;
    setWriteState('SAVING');
    const key = `${selected.id}:${selected.version}:${outcome}`;
    const clientRequestId = commandIds.current.get(key) ?? crypto.randomUUID();
    commandIds.current.set(key, clientRequestId);
    try {
      await decideDefinition(selected.initiativeId, {
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

  if (state === 'LOADING') {
    return (
      <section aria-label={t('myWork.definitionDecisionQueue.sectionLabel', 'Definition decisions')} className="p-4">
        <div role="status" className="flex items-center gap-2 text-sm text-c-text-muted">
          <Loader2 aria-hidden="true" className="animate-spin" size={16} /> {t('myWork.definitionDecisionQueue.loading', 'Loading Definition decisions')}
        </div>
      </section>
    );
  }
  if (state === 'ERROR') {
    return (
      <section aria-label={t('myWork.definitionDecisionQueue.sectionLabel', 'Definition decisions')} className="p-4">
        <div role="alert" className="flex items-center justify-between gap-3 text-sm text-c-danger">
          <span className="flex items-center gap-2">
            <AlertTriangle aria-hidden="true" size={16} /> {t('myWork.definitionDecisionQueue.unavailable', 'Definition decisions are unavailable.')}
          </span>
          <button type="button" className="btn-secondary" onClick={() => void load()}>
            {t('myWork.definitionDecisionQueue.retry', 'Retry')}
          </button>
        </div>
      </section>
    );
  }
  if (rows.length === 0) return null;

  return (
    <section aria-label={t('myWork.definitionDecisionQueue.sectionLabel', 'Definition decisions')} className="border-b border-c-border">
      <div className="px-4 pt-3">
        <h3 className="font-semibold text-c-text-primary">{t('myWork.definitionDecisionQueue.title', 'Definition decisions waiting on you')}</h3>
        <p className="text-xs text-c-text-muted">
          {t('myWork.definitionDecisionQueue.subtitle', 'Canonical gate decisions; approve or return with a human rationale.')}
        </p>
      </div>
      {(writeState === 'CONFLICT' || writeState === 'FAILED') && (
        <div role="alert" className="mx-4 mt-2 text-sm text-c-danger">
          {writeState === 'CONFLICT'
            ? t('myWork.definitionDecisionQueue.conflict', 'This Decision changed. Reload before deciding again.')
            : t('myWork.definitionDecisionQueue.failed', 'The Decision was not changed. Retry or inspect the Initiative.')}
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
                <dt className="text-c-text-muted">{t('myWork.definitionDecisionQueue.initiative', 'Initiative')}</dt>
                <dd>{row.initiativeId}</dd>
              </div>
              <div>
                <dt className="text-c-text-muted">{t('myWork.definitionDecisionQueue.due', 'Due')}</dt>
                <dd>{row.dueAt}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-c-text-muted">{t('myWork.definitionDecisionQueue.frozenCardVersions', 'Frozen card versions')}</dt>
                <dd>{JSON.stringify(row.source.cardVersions)}</dd>
              </div>
            </dl>
            <label className="block">
              <span className="mb-1 block text-c-text-muted">{t('myWork.definitionDecisionQueue.decisionRationale', 'Decision rationale')}</span>
              <textarea
                className="min-h-24 w-full rounded-md border border-c-border bg-c-surface p-2"
                value={rationale}
                onChange={(event) => setRationale(event.target.value)}
              />
            </label>
            {!gateGuard.ready && (
              <div role="alert" className="text-c-warning">
                {t('myWork.definitionDecisionQueue.failClosed', 'Definition decision is fail-closed until its exact Gate Sign-off quorum is satisfied.')}
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
              {t('myWork.definitionDecisionQueue.return', 'Return')}
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={!rationale.trim() || !gateGuard.ready || writeState === 'SAVING'}
              onClick={() => void decide('APPROVED')}
            >
              {t('myWork.definitionDecisionQueue.approveDefinition', 'Approve Definition')}
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
          persistKey="my-work.definition-decisions.v1"
        />
      </TableWithPreviewLayout>
    </section>
  );
};
