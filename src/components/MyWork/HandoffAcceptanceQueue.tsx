import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';
import {
  StandardTable,
  type TableColumn,
  type TableRow,
} from '@/components/standard/StandardTable';
import {
  decideHandoffAcceptance,
  listMyHandoffAcceptances,
  readExecutionCase,
  readHandoffPackage,
  readRegisteredInitiative,
  RuntimeApiError,
} from '@/services/initiatives-execution/runtimeApi';

import { useGateSignoffGuard } from './gateSignoffProjection';
type Item = { itemId: string; description: string; ownerId: string; dueAt: string };
type D = {
  version: number;
  decisionId: string;
  initiativeId: string;
  handoffPackageId: string;
  handoffPackageVersion: number;
  executionCaseId: string;
  requesterId: string;
  authorityId: string;
  status: 'PENDING';
  dueAt: string;
  rolloutChildren: { pilot: Array<Record<string, unknown>>; waves: Array<Record<string, unknown>> };
};
interface Row extends TableRow {
  id: string;
  title: string;
  initiativeId: string;
  pack: string;
  caseId: string;
  dueAt: string;
  source: D;
}
const cols: TableColumn[] = [
  { id: 'title', label: 'Handoff', sortable: true },
  { id: 'initiativeId', label: 'Initiative', sortable: true },
  { id: 'pack', label: 'Frozen package', sortable: true },
  { id: 'caseId', label: 'Execution Case', sortable: true },
  { id: 'dueAt', label: 'Due', sortable: true },
];
export const HandoffAcceptanceQueue = () => {
  const [state, setState] = useState<'LOADING' | 'READY' | 'ERROR'>('LOADING'),
    [items, setItems] = useState<D[]>([]),
    [selectedId, setSelectedId] = useState<string | null>(null),
    [rationale, setRationale] = useState(''),
    [gap, setGap] = useState<Item>({ itemId: '', description: '', ownerId: '', dueAt: '' }),
    [write, setWrite] = useState<'IDLE' | 'SAVING' | 'CONFLICT' | 'FAILED'>('IDLE'),
    [receipt, setReceipt] = useState<{ caseId: string; state: string } | null>(null);
  const ids = useRef(new Map<string, string>());
  const load = useCallback(async () => {
    setState('LOADING');
    try {
      const b = (await listMyHandoffAcceptances()) as { decisions?: D[] };
      setItems(b.decisions ?? []);
      setState('READY');
    } catch {
      setState('ERROR');
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const rows = useMemo<Row[]>(
    () =>
      items.map((d) => ({
        id: d.decisionId,
        title: 'Handoff Acceptance',
        initiativeId: d.initiativeId,
        pack: `${d.handoffPackageId} v${d.handoffPackageVersion}`,
        caseId: d.executionCaseId,
        dueAt: d.dueAt,
        source: d,
      })),
    [items]
  );
  const selected = rows.find((r) => r.id === selectedId) ?? null;
  const gateGuard = useGateSignoffGuard('HANDOFF', selectedId);
  const decide = async (
    outcome: 'ACCEPT' | 'ACCEPT_WITH_EXPLICIT_GAPS' | 'RETURN_WITH_BLOCKERS'
  ) => {
    if (!selected || !rationale.trim() || !gateGuard.ready) return;
    setWrite('SAVING');
    try {
      const initiative = (await readRegisteredInitiative(selected.initiativeId)) as {
        version: number;
      };
      await readHandoffPackage(selected.source.handoffPackageId);
      const key = `${selected.id}:${initiative.version}:${outcome}`,
        clientRequestId = ids.current.get(key) ?? crypto.randomUUID();
      ids.current.set(key, clientRequestId);
      const accountable =
        gap.itemId && gap.description && gap.ownerId && gap.dueAt
          ? [{ ...gap, dueAt: new Date(gap.dueAt).toISOString() }]
          : [];
      await decideHandoffAcceptance(selected.initiativeId, {
        expectedVersion: initiative.version,
        clientRequestId,
        decisionId: selected.id,
        outcome,
        gaps: outcome === 'ACCEPT_WITH_EXPLICIT_GAPS' ? accountable : [],
        blockers: outcome === 'RETURN_WITH_BLOCKERS' ? accountable : [],
        rationale: rationale.trim(),
        governanceQuorumRef: gateGuard.quorumRef,
      });
      if (outcome !== 'RETURN_WITH_BLOCKERS') {
        const c = (await readExecutionCase(selected.source.executionCaseId)) as {
          detail?: { state?: string };
          executionCaseId: string;
        };
        setReceipt({ caseId: c.executionCaseId, state: c.detail?.state ?? 'ACTIVE' });
      }
      setRationale('');
      await load();
      setWrite('IDLE');
    } catch (e) {
      setWrite(e instanceof RuntimeApiError && e.status === 409 ? 'CONFLICT' : 'FAILED');
    }
  };
  if (state === 'LOADING')
    return (
      <section aria-label="Handoff acceptances" className="p-4" role="status">
        Loading Handoff acceptances
      </section>
    );
  if (state === 'ERROR')
    return (
      <section aria-label="Handoff acceptances" className="p-4" role="alert">
        Handoff queue unavailable.{' '}
        <button className="btn-secondary" onClick={() => void load()}>
          Retry
        </button>
      </section>
    );
  if (!rows.length && !receipt) return null;
  return (
    <section aria-label="Handoff acceptances" className="border-b border-c-border p-4">
      <h3 className="font-semibold">Handoff acceptances waiting on you</h3>
      <p className="text-xs text-c-text-muted">
        Exact frozen package only. Acceptance creates the canonical Execution Case.
      </p>
      {receipt && (
        <p role="status" className="rounded border border-c-success/40 p-3">
          Execution Case {receipt.caseId} · {receipt.state}
        </p>
      )}
      {(write === 'CONFLICT' || write === 'FAILED') && (
        <p role="alert" className="text-c-danger">
          {write === 'CONFLICT'
            ? 'Initiative or package changed; reload required.'
            : 'No decision was saved.'}
        </p>
      )}
      {rows.length > 0 && (
        <TableWithPreviewLayout<Row>
          selectedId={selectedId}
          selectedItem={selected}
          onSelect={setSelectedId}
          onOpenFull={setSelectedId}
          itemIds={rows.map((r) => r.id)}
          getItemById={(id) => rows.find((r) => r.id === id) ?? null}
          renderPreview={(r) => (
            <div className="space-y-2 p-4 text-sm">
              <p>Canonical ID {r.id}</p>
              <p>{r.pack}</p>
              <p>Case {r.caseId}</p>
              <p>
                Rollout: {r.source.rolloutChildren.pilot.length} pilot ·{' '}
                {r.source.rolloutChildren.waves.length} waves
              </p>
              <textarea
                aria-label="Handoff rationale"
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                className="w-full rounded border border-c-border bg-c-surface p-2"
              />
              {!gateGuard.ready && (
                <div role="alert" className="text-c-warning">
                  Handoff decision is fail-closed until its exact Gate Sign-off quorum is satisfied.
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                {(['itemId', 'description', 'ownerId', 'dueAt'] as const).map((k) => (
                  <label key={k}>
                    {k}
                    <input
                      aria-label={`Handoff ${k}`}
                      type={k === 'dueAt' ? 'datetime-local' : 'text'}
                      value={gap[k]}
                      onChange={(e) => setGap((v) => ({ ...v, [k]: e.target.value }))}
                      className="block w-full rounded border border-c-border bg-c-surface p-2"
                    />
                  </label>
                ))}
              </div>
            </div>
          )}
          renderPreviewFooter={() => (
            <div className="flex gap-2 p-3">
              <button
                className="btn-secondary"
                disabled={!rationale.trim() || !gateGuard.ready || write === 'SAVING'}
                onClick={() => void decide('RETURN_WITH_BLOCKERS')}
              >
                Return with blockers
              </button>
              <button
                className="btn-secondary"
                disabled={!rationale.trim() || !gateGuard.ready || write === 'SAVING'}
                onClick={() => void decide('ACCEPT_WITH_EXPLICIT_GAPS')}
              >
                Accept conditionally
              </button>
              <button
                className="btn-primary"
                disabled={!rationale.trim() || !gateGuard.ready || write === 'SAVING'}
                onClick={() => void decide('ACCEPT')}
              >
                Accept handoff
              </button>
            </div>
          )}
        >
          <StandardTable
            columns={cols}
            data={rows}
            selectedRowId={selectedId}
            onRowClick={(r) => setSelectedId(r.id)}
            persistKey="my-work.handoff.v1"
          />
        </TableWithPreviewLayout>
      )}
    </section>
  );
};
