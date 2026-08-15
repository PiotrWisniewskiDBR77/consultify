import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';
import {
  StandardTable,
  type TableColumn,
  type TableRow,
} from '@/components/standard/StandardTable';
import {
  decideDeliveryAcceptance,
  decideDeliveryEvidence,
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
type Evidence = {
  version: number;
  evidenceId: string;
  initiativeId: string;
  executionCaseId: string;
  taskId: string | null;
  evidenceRefs: Ref[];
  submitterId: string;
  status: 'SUBMITTED';
};
type Queue = { evidence?: Evidence[]; delivery?: Delivery[]; results?: Results[] };
interface AcceptanceRow extends TableRow {
  id: string;
  title: string;
  gate: string;
  initiative: string;
  exactSource: string;
  status: string;
  source: Evidence | Delivery | Results;
}

const columns: TableColumn[] = [
  { id: 'gate', label: 'Acceptance gate', sortable: true },
  { id: 'initiative', label: 'Initiative', sortable: true },
  { id: 'exactSource', label: 'Exact source', sortable: true },
  { id: 'status', label: 'Status', sortable: true },
];
const refs = (items: Ref[]) =>
  items.length ? items.map((x) => `${x.ref} v${x.version}`).join(', ') : 'None';

export const DeliveryResultsAcceptanceQueue = () => {
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
  const rows = useMemo<AcceptanceRow[]>(
    () => [
      ...(queue.evidence ?? []).map((x) => ({
        id: `evidence:${x.evidenceId}`,
        title: 'Delivery Evidence Review',
        gate: 'Evidence Review',
        initiative: x.initiativeId,
        exactSource: `${x.executionCaseId}${x.taskId ? ` · ${x.taskId}` : ''}`,
        status: x.status,
        source: x,
      })),
      ...(queue.delivery ?? []).map((x) => ({
        id: `delivery:${x.decisionId}`,
        title: 'Delivery Acceptance',
        gate: 'Delivery Acceptance',
        initiative: `${x.initiativeId} v${x.initiativeVersion}`,
        exactSource: `${x.executionCaseId} v${x.executionCaseVersion}`,
        status: x.status,
        source: x,
      })),
      ...(queue.results ?? []).map((x) => ({
        id: `results:${x.resultsCaseId}`,
        title: 'Results Acceptance',
        gate: 'Results Acceptance',
        initiative: x.initiativeId,
        exactSource: `${x.packId} v${x.packVersion}`,
        status: x.status,
        source: x,
      })),
    ],
    [queue]
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
  const decideEvidence = async (outcome: 'APPROVE' | 'RETURN') => {
    if (!selected || !selected.id.startsWith('evidence:') || !rationale.trim()) return;
    const evidence = selected.source as Evidence;
    setWrite('SAVING');
    try {
      const resultsSignalId = `delivery-results-${evidence.evidenceId}`;
      await decideDeliveryEvidence(evidence.evidenceId, {
        expectedVersion: evidence.version,
        clientRequestId: commandId(`${evidence.evidenceId}:${evidence.version}:${outcome}`),
        outcome,
        rationale: rationale.trim(),
        resultsSignalId,
      });
      setReceipt({
        type: 'EVIDENCE',
        lifecycle: outcome === 'APPROVE' ? 'RESULTS_SIGNAL_APPENDED' : 'RETURNED',
        evidenceId: evidence.evidenceId,
        ...(outcome === 'APPROVE' ? { resultsSignalId } : {}),
      });
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
  if (state === 'LOADING')
    return (
      <section aria-label="Delivery and Results Acceptance" className="p-4" role="status">
        Loading acceptance work
      </section>
    );
  if (state === 'ERROR')
    return (
      <section aria-label="Delivery and Results Acceptance" className="p-4" role="alert">
        Acceptance work unavailable.{' '}
        <button className="btn-secondary" onClick={() => void load()}>
          Retry
        </button>
      </section>
    );
  if (!rows.length && !receipt) return null;
  return (
    <section aria-label="Delivery and Results Acceptance" className="border-b border-c-border p-4">
      <h3 className="font-semibold">Delivery and Results Acceptance</h3>
      <p className="text-xs text-c-text-muted">
        Independent decisions over exact, versioned execution evidence. No completion shortcut.
      </p>
      {receipt && (
        <div role="status" className="my-3 rounded border border-c-success/40 p-3 text-sm">
          <strong>
            {String(receipt.type)} receipt · {String(receipt.lifecycle)}
          </strong>
          {'resultsCaseId' in receipt && <div>Results Case {String(receipt.resultsCaseId)}</div>}
          {'packId' in receipt && (
            <div>
              Immutable Benefits Handoff Pack {String(receipt.packId)} v
              {String(receipt.version ?? receipt.packVersion)}
            </div>
          )}
        </div>
      )}
      {(write === 'CONFLICT' || write === 'FAILED') && (
        <p role="alert" className="text-c-danger">
          {write === 'CONFLICT'
            ? 'Evidence version changed. Reload before deciding.'
            : 'Decision was not saved.'}
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
            const evidence = row.id.startsWith('evidence:') ? (row.source as Evidence) : null;
            const delivery = row.id.startsWith('delivery:') ? (row.source as Delivery) : null;
            const results = row.id.startsWith('results:') ? (row.source as Results) : null;
            return (
              <div className="space-y-3 p-4 text-sm" aria-label={`${row.gate} Workbench`}>
                <div>
                  <strong>Canonical ID</strong>{' '}
                  {evidence?.evidenceId ?? delivery?.decisionId ?? results?.resultsCaseId}
                </div>
                {evidence && (
                  <div className="grid gap-2 md:grid-cols-2">
                    <p>Initiative {evidence.initiativeId}</p>
                    <p>Execution Case {evidence.executionCaseId}</p>
                    <p>Task {evidence.taskId ?? 'Independent of Task'}</p>
                    <p>Submitted by {evidence.submitterId}</p>
                    <p>Evidence: {refs(evidence.evidenceRefs)}</p>
                  </div>
                )}
                {delivery && (
                  <div className="grid gap-2 md:grid-cols-2">
                    <p>
                      Initiative {delivery.initiativeId} v{delivery.initiativeVersion}
                    </p>
                    <p>
                      Execution Case {delivery.executionCaseId} v{delivery.executionCaseVersion}
                    </p>
                    <p>
                      Baseline {delivery.baselineRef.ref} v{delivery.baselineRef.version}
                    </p>
                    <p>
                      Scope {delivery.scopeRef.ref} v{delivery.scopeRef.version}
                    </p>
                    <p>Deliverables: {refs(delivery.deliverableRefs)}</p>
                    <p>Milestones: {refs(delivery.milestoneRefs)}</p>
                    <p>
                      Open Tasks:{' '}
                      {delivery.openTaskRefs
                        .map(
                          (x) =>
                            `${x.taskId} v${x.version} · owner ${x.ownerId ?? 'UNKNOWN'} · evidence ${x.evidenceRefs.join(', ') || 'EVIDENCE_MISSING'}`
                        )
                        .join('; ') || 'None'}
                    </p>
                    <p>
                      Open Decisions:{' '}
                      {delivery.openDecisionRefs
                        .map(
                          (x) =>
                            `${x.decisionId} v${x.version} · owner ${x.ownerId ?? 'UNKNOWN'} · evidence ${x.evidenceRefs.join(', ') || 'EVIDENCE_MISSING'}`
                        )
                        .join('; ') || 'None'}
                    </p>
                    <p>
                      Residual risks:{' '}
                      {delivery.riskResiduals
                        .map(
                          (x) =>
                            `${x.residualId} · ${x.ownerId ?? 'UNKNOWN'} · ${x.evidenceRefs.join(', ') || 'EVIDENCE_MISSING'}`
                        )
                        .join('; ') || 'None'}
                    </p>
                    <p>Finance: {refs(delivery.financeActualRefs)}</p>
                    <p>
                      Operational handover {delivery.operationalHandoverRef.ref} v
                      {delivery.operationalHandoverRef.version}
                    </p>
                    <p>Benefit Owner {delivery.benefitOwnerId}</p>
                    <p>KPI contracts: {refs(delivery.kpiMeasurementContractRefs)}</p>
                  </div>
                )}
                {results && (
                  <div>
                    <p>
                      Immutable Benefits Handoff Pack {results.packId} v{results.packVersion}
                    </p>
                    <p>Initiative {results.initiativeId} must remain DELIVERED until accepted.</p>
                  </div>
                )}
                <label className="block">
                  Rationale
                  <textarea
                    aria-label="Acceptance rationale"
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
                          aria-label={`Results ${key}`}
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
            row.id.startsWith('evidence:') ? (
              <div className="flex flex-wrap gap-2 p-3">
                <button className="btn-secondary" onClick={() => void decideEvidence('RETURN')}>
                  Return evidence
                </button>
                <button className="btn-primary" onClick={() => void decideEvidence('APPROVE')}>
                  Approve and append Results signal
                </button>
              </div>
            ) : row.id.startsWith('delivery:') ? (
              <div className="flex flex-wrap gap-2 p-3">
                <button className="btn-secondary" onClick={() => void decideDelivery('STOP')}>
                  Stop
                </button>
                <button className="btn-secondary" onClick={() => void decideDelivery('RETURN')}>
                  Return
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => void decideDelivery('ACCEPT_WITH_RESIDUALS')}
                >
                  Accept with residuals
                </button>
                <button className="btn-primary" onClick={() => void decideDelivery('ACCEPT')}>
                  Accept delivery
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 p-3">
                <button
                  className="btn-secondary"
                  onClick={() => void decideResults('REJECT_WITH_BLOCKERS')}
                >
                  Reject with blockers
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => void decideResults('ACCEPT_WITH_GAPS')}
                >
                  Accept with gaps
                </button>
                <button className="btn-primary" onClick={() => void decideResults('ACCEPT')}>
                  Accept results
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
