import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';
import {
  StandardTable,
  type TableColumn,
  type TableRow,
} from '@/components/standard/StandardTable';
import {
  decideDeliveryAcceptance,
  decideResultsAcceptance,
  getBenefitsHandoffPack,
  listMyAcceptanceWork,
  RuntimeApiError,
} from '@/services/initiatives-execution/runtimeApi';

type Ref = { ref: string; version: number };
type Accountable = { description: string; ownerId: string; dueAt: string };
type Delivery = {
  version: number;
  decisionId: string;
  initiativeId: string;
  executionCaseId: string;
  initiativeVersion: number;
  executionCaseVersion: number;
  status: 'PENDING';
  baselineRef: Ref;
  scopeRef: Ref;
  deliverableRefs: Ref[];
  milestoneRefs: Ref[];
  openTaskRefs: Array<{
    taskId: string;
    version: number;
    ownerId: string | null;
    evidenceRefs: string[];
  }>;
  openDecisionRefs: Array<{
    decisionId: string;
    version: number;
    ownerId: string | null;
    evidenceRefs: string[];
  }>;
  riskResiduals: Array<{
    residualId: string;
    description: string;
    ownerId: string | null;
    dueAt: string;
    evidenceRefs: string[];
  }>;
  financeActualRefs: Ref[];
  operationalHandoverRef: Ref;
  benefitOwnerId: string;
  kpiMeasurementContractRefs: Ref[];
};
type Results = {
  version: number;
  resultsCaseId: string;
  packId: string;
  packVersion: number;
  initiativeId: string;
  status: 'PENDING';
};
type Queue = { delivery?: Delivery[]; results?: Results[] };
interface AcceptanceRow extends TableRow {
  id: string;
  title: string;
  gate: string;
  initiative: string;
  exactSource: string;
  status: string;
  source: Delivery | Results;
}

const buildColumns = (t: TFunction): TableColumn[] => [
  {
    id: 'gate',
    label: t('myWork.deliveryResultsAcceptanceQueue.columnAcceptanceGate', 'Acceptance gate'),
    sortable: true,
  },
  {
    id: 'initiative',
    label: t('myWork.deliveryResultsAcceptanceQueue.columnInitiative', 'Initiative'),
    sortable: true,
  },
  {
    id: 'exactSource',
    label: t('myWork.deliveryResultsAcceptanceQueue.columnExactSource', 'Exact source'),
    sortable: true,
  },
  {
    id: 'status',
    label: t('myWork.deliveryResultsAcceptanceQueue.columnStatus', 'Status'),
    sortable: true,
  },
];

export const DeliveryResultsAcceptanceQueue = () => {
  const { t } = useTranslation();
  const columns = useMemo(() => buildColumns(t), [t]);
  const none = t('myWork.deliveryResultsAcceptanceQueue.none', 'None');
  const refs = useCallback(
    (items: Ref[]) => (items.length ? items.map((x) => `${x.ref} v${x.version}`).join(', ') : none),
    [none]
  );
  const [state, setState] = useState<'LOADING' | 'READY' | 'ERROR'>('LOADING');
  const [queue, setQueue] = useState<Queue>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rationale, setRationale] = useState('');
  const [accountable, setAccountable] = useState<Accountable>({
    description: '',
    ownerId: '',
    dueAt: '',
  });
  const [write, setWrite] = useState<'IDLE' | 'SAVING' | 'CONFLICT' | 'FAILED'>('IDLE');
  const [receipt, setReceipt] = useState<Record<string, unknown> | null>(null);
  const ids = useRef(new Map<string, string>());
  const load = useCallback(async () => {
    setState('LOADING');
    try {
      setQueue((await listMyAcceptanceWork()) as Queue);
      setState('READY');
    } catch {
      setState('ERROR');
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const deliveryAcceptanceLabel = t(
    'myWork.deliveryResultsAcceptanceQueue.deliveryAcceptance',
    'Delivery Acceptance'
  );
  const resultsAcceptanceLabel = t(
    'myWork.deliveryResultsAcceptanceQueue.resultsAcceptance',
    'Results Acceptance'
  );
  const rows = useMemo<AcceptanceRow[]>(
    () => [
      ...(queue.delivery ?? []).map((x) => ({
        id: `delivery:${x.decisionId}`,
        title: deliveryAcceptanceLabel,
        gate: deliveryAcceptanceLabel,
        initiative: `${x.initiativeId} v${x.initiativeVersion}`,
        exactSource: `${x.executionCaseId} v${x.executionCaseVersion}`,
        status: x.status,
        source: x,
      })),
      ...(queue.results ?? []).map((x) => ({
        id: `results:${x.resultsCaseId}`,
        title: resultsAcceptanceLabel,
        gate: resultsAcceptanceLabel,
        initiative: x.initiativeId,
        exactSource: `${x.packId} v${x.packVersion}`,
        status: x.status,
        source: x,
      })),
    ],
    [queue, deliveryAcceptanceLabel, resultsAcceptanceLabel]
  );
  const selected = rows.find((x) => x.id === selectedId) ?? null;
  const commandId = (key: string) => {
    const found = ids.current.get(key);
    if (found) return found;
    const id = crypto.randomUUID();
    ids.current.set(key, id);
    return id;
  };
  const decideDelivery = async (
    outcome: 'ACCEPT' | 'ACCEPT_WITH_RESIDUALS' | 'RETURN' | 'STOP'
  ) => {
    if (!selected || !selected.id.startsWith('delivery:') || !rationale.trim()) return;
    const d = selected.source as Delivery,
      packId = `benefits-${d.decisionId}`;
    setWrite('SAVING');
    try {
      await decideDeliveryAcceptance(d.decisionId, {
        expectedVersion: d.version,
        clientRequestId: commandId(`${d.decisionId}:${d.version}:${outcome}`),
        outcome,
        rationale: rationale.trim(),
        packId,
      });
      if (outcome === 'ACCEPT' || outcome === 'ACCEPT_WITH_RESIDUALS') {
        const pack = (await getBenefitsHandoffPack(packId)) as Record<string, unknown>;
        setReceipt({ type: 'DELIVERY', lifecycle: 'DELIVERED', ...pack });
      } else setReceipt({ type: 'DELIVERY', decisionId: d.decisionId, outcome });
      setRationale('');
      await load();
      setWrite('IDLE');
    } catch (e) {
      setWrite(e instanceof RuntimeApiError && e.status === 409 ? 'CONFLICT' : 'FAILED');
    }
  };
  const decideResults = async (outcome: 'ACCEPT' | 'ACCEPT_WITH_GAPS' | 'REJECT_WITH_BLOCKERS') => {
    if (!selected || !selected.id.startsWith('results:') || !rationale.trim()) return;
    const r = selected.source as Results;
    const item =
      accountable.description && accountable.ownerId && accountable.dueAt
        ? [{ ...accountable, dueAt: new Date(accountable.dueAt).toISOString() }]
        : [];
    setWrite('SAVING');
    try {
      await decideResultsAcceptance(r.resultsCaseId, {
        expectedVersion: r.version,
        clientRequestId: commandId(`${r.resultsCaseId}:${r.version}:${outcome}`),
        outcome,
        rationale: rationale.trim(),
        gaps: outcome === 'ACCEPT_WITH_GAPS' ? item : [],
        blockers: outcome === 'REJECT_WITH_BLOCKERS' ? item : [],
      });
      setReceipt({
        type: 'RESULTS',
        resultsCaseId: r.resultsCaseId,
        outcome,
        lifecycle: outcome === 'REJECT_WITH_BLOCKERS' ? 'DELIVERED' : 'BENEFITS_TRACKING',
        packId: r.packId,
        packVersion: r.packVersion,
      });
      setRationale('');
      await load();
      setWrite('IDLE');
    } catch (e) {
      setWrite(e instanceof RuntimeApiError && e.status === 409 ? 'CONFLICT' : 'FAILED');
    }
  };

  const acceptanceLabel = t(
    'myWork.deliveryResultsAcceptanceQueue.title',
    'Delivery and Results Acceptance'
  );

  if (state === 'LOADING')
    return (
      <section aria-label={acceptanceLabel} className="p-4" role="status">
        {t('myWork.deliveryResultsAcceptanceQueue.loading', 'Loading acceptance work')}
      </section>
    );
  if (state === 'ERROR')
    return (
      <section aria-label={acceptanceLabel} className="p-4" role="alert">
        {t('myWork.deliveryResultsAcceptanceQueue.unavailable', 'Acceptance work unavailable.')}{' '}
        <button className="btn-secondary" onClick={() => void load()}>
          {t('myWork.deliveryResultsAcceptanceQueue.retry', 'Retry')}
        </button>
      </section>
    );
  if (!rows.length && !receipt) return null;
  return (
    <section aria-label={acceptanceLabel} className="border-b border-c-border p-4">
      <h3 className="font-semibold">{acceptanceLabel}</h3>
      <p className="text-xs text-c-text-muted">
        {t(
          'myWork.deliveryResultsAcceptanceQueue.subtitle',
          'Independent decisions over exact, versioned execution evidence. No completion shortcut.'
        )}
      </p>
      {receipt && (
        <div role="status" className="my-3 rounded border border-c-success/40 p-3 text-sm">
          <strong>
            {t('myWork.deliveryResultsAcceptanceQueue.receiptHeading', '{{type}} receipt · {{lifecycle}}', {
              type: String(receipt.type),
              lifecycle: String(receipt.lifecycle),
            })}
          </strong>
          {'resultsCaseId' in receipt && (
            <div>
              {t('myWork.deliveryResultsAcceptanceQueue.resultsCase', 'Results Case {{id}}', {
                id: String(receipt.resultsCaseId),
              })}
            </div>
          )}
          {'packId' in receipt && (
            <div>
              {t(
                'myWork.deliveryResultsAcceptanceQueue.immutableBenefitsHandoffPack',
                'Immutable Benefits Handoff Pack {{packId}} v{{version}}',
                {
                  packId: String(receipt.packId),
                  version: String(receipt.version ?? receipt.packVersion),
                }
              )}
            </div>
          )}
        </div>
      )}
      {(write === 'CONFLICT' || write === 'FAILED') && (
        <p role="alert" className="text-c-danger">
          {write === 'CONFLICT'
            ? t(
                'myWork.deliveryResultsAcceptanceQueue.conflict',
                'Evidence version changed. Reload before deciding.'
              )
            : t('myWork.deliveryResultsAcceptanceQueue.failed', 'Decision was not saved.')}
        </p>
      )}
      {rows.length > 0 && (
        <TableWithPreviewLayout<AcceptanceRow>
          selectedId={selectedId}
          selectedItem={selected}
          onSelect={setSelectedId}
          onOpenFull={setSelectedId}
          itemIds={rows.map((x) => x.id)}
          getItemById={(id) => rows.find((x) => x.id === id) ?? null}
          renderPreview={(row) => {
            const delivery = row.id.startsWith('delivery:') ? (row.source as Delivery) : null;
            const results = row.id.startsWith('results:') ? (row.source as Results) : null;
            return (
              <div
                className="space-y-3 p-4 text-sm"
                aria-label={t(
                  'myWork.deliveryResultsAcceptanceQueue.workbenchAriaLabel',
                  '{{gate}} Workbench',
                  { gate: row.gate }
                )}
              >
                <div>
                  <strong>{t('myWork.deliveryResultsAcceptanceQueue.canonicalId', 'Canonical ID')}</strong>{' '}
                  {delivery?.decisionId ?? results?.resultsCaseId}
                </div>
                {delivery && (
                  <div className="grid gap-2 md:grid-cols-2">
                    <p>
                      {t('myWork.deliveryResultsAcceptanceQueue.initiative', 'Initiative {{id}} v{{version}}', {
                        id: delivery.initiativeId,
                        version: delivery.initiativeVersion,
                      })}
                    </p>
                    <p>
                      {t(
                        'myWork.deliveryResultsAcceptanceQueue.executionCase',
                        'Execution Case {{id}} v{{version}}',
                        { id: delivery.executionCaseId, version: delivery.executionCaseVersion }
                      )}
                    </p>
                    <p>
                      {t('myWork.deliveryResultsAcceptanceQueue.baseline', 'Baseline {{ref}} v{{version}}', {
                        ref: delivery.baselineRef.ref,
                        version: delivery.baselineRef.version,
                      })}
                    </p>
                    <p>
                      {t('myWork.deliveryResultsAcceptanceQueue.scope', 'Scope {{ref}} v{{version}}', {
                        ref: delivery.scopeRef.ref,
                        version: delivery.scopeRef.version,
                      })}
                    </p>
                    <p>
                      {t('myWork.deliveryResultsAcceptanceQueue.deliverables', 'Deliverables: {{refs}}', {
                        refs: refs(delivery.deliverableRefs),
                      })}
                    </p>
                    <p>
                      {t('myWork.deliveryResultsAcceptanceQueue.milestones', 'Milestones: {{refs}}', {
                        refs: refs(delivery.milestoneRefs),
                      })}
                    </p>
                    <p>
                      {t('myWork.deliveryResultsAcceptanceQueue.openTasks', 'Open Tasks: {{value}}', {
                        value:
                          delivery.openTaskRefs
                            .map(
                              (x) =>
                                `${x.taskId} v${x.version} · owner ${x.ownerId ?? 'UNKNOWN'} · evidence ${x.evidenceRefs.join(', ') || 'EVIDENCE_MISSING'}`
                            )
                            .join('; ') || none,
                      })}
                    </p>
                    <p>
                      {t('myWork.deliveryResultsAcceptanceQueue.openDecisions', 'Open Decisions: {{value}}', {
                        value:
                          delivery.openDecisionRefs
                            .map(
                              (x) =>
                                `${x.decisionId} v${x.version} · owner ${x.ownerId ?? 'UNKNOWN'} · evidence ${x.evidenceRefs.join(', ') || 'EVIDENCE_MISSING'}`
                            )
                            .join('; ') || none,
                      })}
                    </p>
                    <p>
                      {t('myWork.deliveryResultsAcceptanceQueue.residualRisks', 'Residual risks: {{value}}', {
                        value:
                          delivery.riskResiduals
                            .map(
                              (x) =>
                                `${x.residualId} · ${x.ownerId ?? 'UNKNOWN'} · ${x.evidenceRefs.join(', ') || 'EVIDENCE_MISSING'}`
                            )
                            .join('; ') || none,
                      })}
                    </p>
                    <p>
                      {t('myWork.deliveryResultsAcceptanceQueue.finance', 'Finance: {{refs}}', {
                        refs: refs(delivery.financeActualRefs),
                      })}
                    </p>
                    <p>
                      {t(
                        'myWork.deliveryResultsAcceptanceQueue.operationalHandover',
                        'Operational handover {{ref}} v{{version}}',
                        {
                          ref: delivery.operationalHandoverRef.ref,
                          version: delivery.operationalHandoverRef.version,
                        }
                      )}
                    </p>
                    <p>
                      {t('myWork.deliveryResultsAcceptanceQueue.benefitOwner', 'Benefit Owner {{id}}', {
                        id: delivery.benefitOwnerId,
                      })}
                    </p>
                    <p>
                      {t('myWork.deliveryResultsAcceptanceQueue.kpiContracts', 'KPI contracts: {{refs}}', {
                        refs: refs(delivery.kpiMeasurementContractRefs),
                      })}
                    </p>
                  </div>
                )}
                {results && (
                  <div>
                    <p>
                      {t(
                        'myWork.deliveryResultsAcceptanceQueue.immutableBenefitsHandoffPackShort',
                        'Immutable Benefits Handoff Pack {{packId}} v{{version}}',
                        { packId: results.packId, version: results.packVersion }
                      )}
                    </p>
                    <p>
                      {t(
                        'myWork.deliveryResultsAcceptanceQueue.mustRemainDelivered',
                        'Initiative {{id}} must remain DELIVERED until accepted.',
                        { id: results.initiativeId }
                      )}
                    </p>
                  </div>
                )}
                <label className="block">
                  {t('myWork.deliveryResultsAcceptanceQueue.rationale', 'Rationale')}
                  <textarea
                    aria-label={t(
                      'myWork.deliveryResultsAcceptanceQueue.rationaleAriaLabel',
                      'Acceptance rationale'
                    )}
                    value={rationale}
                    onChange={(e) => setRationale(e.target.value)}
                    className="block w-full rounded border border-c-border bg-c-surface p-2"
                  />
                </label>
                {results && (
                  <div className="grid gap-2 md:grid-cols-3">
                    {(['description', 'ownerId', 'dueAt'] as const).map((key) => (
                      <label key={key}>
                        {key}
                        <input
                          aria-label={t(
                            'myWork.deliveryResultsAcceptanceQueue.resultsFieldAriaLabel',
                            'Results {{field}}',
                            { field: key }
                          )}
                          type={key === 'dueAt' ? 'datetime-local' : 'text'}
                          value={accountable[key]}
                          onChange={(e) => setAccountable((x) => ({ ...x, [key]: e.target.value }))}
                          className="block w-full rounded border border-c-border bg-c-surface p-2"
                        />
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          }}
          renderPreviewFooter={(row) =>
            row.id.startsWith('delivery:') ? (
              <div className="flex flex-wrap gap-2 p-3">
                <button className="btn-secondary" onClick={() => void decideDelivery('STOP')}>
                  {t('myWork.deliveryResultsAcceptanceQueue.stop', 'Stop')}
                </button>
                <button className="btn-secondary" onClick={() => void decideDelivery('RETURN')}>
                  {t('myWork.deliveryResultsAcceptanceQueue.return', 'Return')}
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => void decideDelivery('ACCEPT_WITH_RESIDUALS')}
                >
                  {t('myWork.deliveryResultsAcceptanceQueue.acceptWithResiduals', 'Accept with residuals')}
                </button>
                <button className="btn-primary" onClick={() => void decideDelivery('ACCEPT')}>
                  {t('myWork.deliveryResultsAcceptanceQueue.acceptDelivery', 'Accept delivery')}
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 p-3">
                <button
                  className="btn-secondary"
                  onClick={() => void decideResults('REJECT_WITH_BLOCKERS')}
                >
                  {t('myWork.deliveryResultsAcceptanceQueue.rejectWithBlockers', 'Reject with blockers')}
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => void decideResults('ACCEPT_WITH_GAPS')}
                >
                  {t('myWork.deliveryResultsAcceptanceQueue.acceptWithGaps', 'Accept with gaps')}
                </button>
                <button className="btn-primary" onClick={() => void decideResults('ACCEPT')}>
                  {t('myWork.deliveryResultsAcceptanceQueue.acceptResults', 'Accept results')}
                </button>
              </div>
            )
          }
        >
          <StandardTable
            columns={columns}
            data={rows}
            selectedRowId={selectedId}
            onRowClick={(x) => setSelectedId(x.id)}
            persistKey="my-work.delivery-results-acceptance.v1"
          />
        </TableWithPreviewLayout>
      )}
    </section>
  );
};
