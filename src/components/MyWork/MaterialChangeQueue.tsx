import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';
import {
  StandardTable,
  type TableColumn,
  type TableRow,
} from '@/components/standard/StandardTable';
import {
  listMyMaterialChangeWork,
  RuntimeApiError,
  transitionMaterialChange,
} from '@/services/initiatives-execution/runtimeApi';

type Impact = { knowledgeState: string; refs: Array<{ ref: string; version: number }> };
type Change = {
  version: number;
  proposalId: string;
  target: {
    kind: 'INITIATIVE_CARD' | 'PLANNING_BASELINE' | 'EXECUTION_BASELINE';
    initiativeId?: string;
    cardKey?: string;
    aggregateId?: string;
    version: number;
  };
  oldSnapshot: Record<string, unknown>;
  newSnapshot: Record<string, unknown>;
  oldHash: string;
  newHash: string;
  diff: Array<{ path: string; oldValue: unknown; newValue: unknown }>;
  classification: string;
  tolerance: {
    policyRef: string;
    policyVersion: number;
    withinTolerance: boolean;
    rationale: string;
  };
  blastRadius: Record<string, Impact>;
  reversibility: string;
  ownerId: string;
  authorityId: string;
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'CONDITIONALLY_APPROVED';
  conditions: string[];
  publishedTargetVersion: number | null;
};
interface Row extends TableRow {
  id: string;
  title: string;
  target: string;
  classification: string;
  authority: string;
  status: string;
  source: Change;
}
const columns: TableColumn[] = [
  { id: 'target', label: 'Versioned target', sortable: true },
  { id: 'classification', label: 'Classification', sortable: true },
  { id: 'authority', label: 'Authority', sortable: true },
  { id: 'status', label: 'Status', sortable: true },
];
export const MaterialChangeQueue = () => {
  const [state, setState] = useState<'LOADING' | 'READY' | 'ERROR'>('LOADING'),
    [items, setItems] = useState<Change[]>([]),
    [selectedId, setSelectedId] = useState<string | null>(null),
    [rationale, setRationale] = useState(''),
    [conditions, setConditions] = useState(''),
    [write, setWrite] = useState<'IDLE' | 'SAVING' | 'CONFLICT' | 'FAILED'>('IDLE'),
    [receipt, setReceipt] = useState<Record<string, unknown> | null>(null);
  const ids = useRef(new Map<string, string>());
  const load = useCallback(async () => {
    setState('LOADING');
    try {
      const r = (await listMyMaterialChangeWork()) as { items?: Change[] };
      setItems(r.items ?? []);
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
      items.map((x) => ({
        id: x.proposalId,
        title: `Material Change ${x.proposalId}`,
        target: `${x.target.kind} · ${x.target.initiativeId ?? x.target.aggregateId}:${x.target.cardKey ?? ''} v${x.target.version}`,
        classification: x.classification,
        authority: x.authorityId,
        status: x.status,
        source: x,
      })),
    [items]
  );
  const selected = rows.find((x) => x.id === selectedId) ?? null;
  const act = async (
    action: 'REQUEST' | 'PUBLISH' | 'DECIDE',
    outcome?: 'APPROVE' | 'CONDITIONAL' | 'RETURN' | 'REJECT'
  ) => {
    if (!selected) return;
    setWrite('SAVING');
    try {
      const key = `${selected.id}:${selected.source.version}:${action}:${outcome ?? ''}`,
        clientRequestId = ids.current.get(key) ?? crypto.randomUUID();
      ids.current.set(key, clientRequestId);
      await transitionMaterialChange(selected.id, {
        expectedVersion: selected.source.version,
        clientRequestId,
        action,
        ...(action === 'DECIDE'
          ? {
              outcome,
              conditions: outcome === 'CONDITIONAL' ? conditions.split('\n').filter(Boolean) : [],
              rationale: rationale.trim(),
            }
          : {}),
      });
      setReceipt({
        proposalId: selected.id,
        action,
        targetVersion: action === 'PUBLISH' ? selected.source.target.version + 1 : undefined,
        oldVersion: selected.source.target.version,
      });
      await load();
      setWrite('IDLE');
    } catch (e) {
      setWrite(e instanceof RuntimeApiError && e.status === 409 ? 'CONFLICT' : 'FAILED');
    }
  };
  if (state === 'LOADING')
    return (
      <section aria-label="Material Changes" role="status" className="p-4">
        Loading material changes
      </section>
    );
  if (state === 'ERROR')
    return (
      <section aria-label="Material Changes" role="alert" className="p-4">
        Material changes unavailable.{' '}
        <button className="btn-secondary" onClick={() => void load()}>
          Retry
        </button>
      </section>
    );
  if (!rows.length && !receipt) return null;
  return (
    <section aria-label="Material Changes" className="border-b border-c-border p-4">
      <h3 className="font-semibold">Material Change decisions</h3>
      <p className="text-xs text-c-text-muted">
        Approved truth and baselines change only through exact, independently reviewed proposals.
      </p>
      {receipt && (
        <p role="status" className="my-2 rounded border border-c-success/40 p-3">
          Proposal {String(receipt.proposalId)} · {String(receipt.action)}
          {receipt.targetVersion
            ? ` · published v${String(receipt.targetVersion)}; previous v${String(receipt.oldVersion)} remains in history`
            : ''}
        </p>
      )}
      {(write === 'CONFLICT' || write === 'FAILED') && (
        <p role="alert" className="text-c-danger">
          {write === 'CONFLICT'
            ? 'Target is stale. Reload; publishing is blocked.'
            : 'No transition was saved.'}
        </p>
      )}
      {rows.length > 0 && (
        <TableWithPreviewLayout<Row>
          selectedId={selectedId}
          selectedItem={selected}
          onSelect={setSelectedId}
          onOpenFull={setSelectedId}
          itemIds={rows.map((x) => x.id)}
          getItemById={(id) => rows.find((x) => x.id === id) ?? null}
          renderPreview={(row) => (
            <div className="space-y-3 p-4 text-sm" aria-label="Material Change Workbench">
              <p>Proposal {row.id}</p>
              <p>{row.target}</p>
              <p>
                Old hash <code>{row.source.oldHash}</code>
              </p>
              <p>
                New hash <code>{row.source.newHash}</code>
              </p>
              <p>
                Tolerance {row.source.tolerance.policyRef} v{row.source.tolerance.policyVersion} ·{' '}
                {row.source.tolerance.withinTolerance ? 'within' : 'outside'} ·{' '}
                {row.source.tolerance.rationale}
              </p>
              <p>Reversibility {row.source.reversibility}</p>
              <section>
                <h4 className="font-medium">Exact old → proposed truth</h4>
                {row.source.diff.map((d) => (
                  <div
                    key={d.path}
                    className="grid grid-cols-3 gap-2 border-t border-c-border py-1"
                  >
                    <code>{d.path}</code>
                    <span>{JSON.stringify(d.oldValue)}</span>
                    <span>{JSON.stringify(d.newValue)}</span>
                  </div>
                ))}
              </section>
              <section>
                <h4 className="font-medium">Complete blast radius</h4>
                {Object.entries(row.source.blastRadius).map(([kind, impact]) => (
                  <p key={kind}>
                    {kind}: {impact.knowledgeState} ·{' '}
                    {impact.refs.map((r) => `${r.ref} v${r.version}`).join(', ') ||
                      'EVIDENCE_MISSING'}
                  </p>
                ))}
              </section>
              {row.source.target.kind !== 'INITIATIVE_CARD' && (
                <p>
                  Context: open canonical{' '}
                  {row.source.target.kind === 'PLANNING_BASELINE' ? 'Plan' : 'Execution Case'}{' '}
                  workspace. This queue never shadow-edits its baseline.
                </p>
              )}
              {row.source.status === 'PENDING' && (
                <>
                  <label className="block">
                    Decision rationale
                    <textarea
                      aria-label="Material change rationale"
                      value={rationale}
                      onChange={(e) => setRationale(e.target.value)}
                      className="block w-full rounded border border-c-border bg-c-surface p-2"
                    />
                  </label>
                  <label className="block">
                    Conditions
                    <textarea
                      aria-label="Material change conditions"
                      value={conditions}
                      onChange={(e) => setConditions(e.target.value)}
                      className="block w-full rounded border border-c-border bg-c-surface p-2"
                    />
                  </label>
                </>
              )}
            </div>
          )}
          renderPreviewFooter={(row) => (
            <div className="flex flex-wrap gap-2 p-3">
              {row.source.status === 'DRAFT' && (
                <button className="btn-primary" onClick={() => void act('REQUEST')}>
                  Request independent review
                </button>
              )}
              {row.source.status === 'PENDING' && (
                <>
                  <button className="btn-secondary" onClick={() => void act('DECIDE', 'REJECT')}>
                    Reject
                  </button>
                  <button className="btn-secondary" onClick={() => void act('DECIDE', 'RETURN')}>
                    Return
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => void act('DECIDE', 'CONDITIONAL')}
                  >
                    Approve conditionally
                  </button>
                  <button className="btn-primary" onClick={() => void act('DECIDE', 'APPROVE')}>
                    Approve
                  </button>
                </>
              )}
              {['APPROVED', 'CONDITIONALLY_APPROVED'].includes(row.source.status) && (
                <button className="btn-primary" onClick={() => void act('PUBLISH')}>
                  Publish approved change
                </button>
              )}
            </div>
          )}
        >
          <StandardTable
            columns={columns}
            data={rows}
            selectedRowId={selectedId}
            onRowClick={(x) => setSelectedId(x.id)}
            persistKey="my-work.material-change.v1"
          />
        </TableWithPreviewLayout>
      )}
    </section>
  );
};
