import { AlertTriangle, Loader2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';
import {
  StandardTable,
  type TableColumn,
  type TableRow,
} from '@/components/standard/StandardTable';
import {
  getMyGateSignoffs,
  RuntimeApiError,
  submitGateSignoff,
} from '@/services/initiatives-execution/runtimeApi';

import { type GateSignoffProjection, normalizeGateSignoffs } from './gateSignoffProjection';

interface GateRow extends TableRow {
  id: string;
  title: string;
  gate: string;
  initiativeId: string;
  profile: string;
  quorum: string;
  sla: string;
  source: GateSignoffProjection;
}

const columns: TableColumn[] = [
  { id: 'title', label: 'Sign-off', sortable: true, width: '25%' },
  { id: 'gate', label: 'Gate', sortable: true, filterable: true },
  { id: 'initiativeId', label: 'Initiative', sortable: true },
  { id: 'profile', label: 'Policy profile', sortable: true, filterable: true },
  { id: 'quorum', label: 'Quorum', sortable: true },
  { id: 'sla', label: 'SLA', sortable: true, filterable: true },
];

export const GateSignoffQueue: React.FC = () => {
  const [state, setState] = useState<'LOADING' | 'READY' | 'ERROR'>('LOADING');
  const [items, setItems] = useState<GateSignoffProjection[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [roleKey, setRoleKey] = useState('');
  const [outcome, setOutcome] = useState<'APPROVE' | 'REJECT' | 'ABSTAIN'>('APPROVE');
  const [rationale, setRationale] = useState('');
  const [writeState, setWriteState] = useState<'IDLE' | 'SAVING' | 'CONFLICT' | 'FAILED'>('IDLE');
  const [receipt, setReceipt] = useState<string | null>(null);
  const commandIds = useRef(new Map<string, string>());

  const load = useCallback(async () => {
    setState('LOADING');
    try {
      const next = normalizeGateSignoffs(await getMyGateSignoffs());
      setItems(next);
      setSelectedId((current) =>
        current && next.some((item) => `${item.gate}:${item.decisionId}` === current)
          ? current
          : null
      );
      setState('READY');
    } catch {
      setState('ERROR');
    }
  }, []);
  useEffect(() => void load(), [load]);

  const rows = useMemo<GateRow[]>(
    () =>
      items.map((item) => ({
        id: `${item.gate}:${item.decisionId}`,
        title: 'Gate Sign-off',
        gate: item.gate,
        initiativeId: item.initiativeId,
        profile: item.effectivePolicy.profile,
        quorum: `${item.quorum.signoffs.length}/${item.effectivePolicy.rule.quorum} · ${item.quorum.status}`,
        sla: `${item.sla.state} · ${item.sla.hours}h`,
        source: item,
      })),
    [items]
  );
  const selected = rows.find((row) => row.id === selectedId) ?? null;
  const eligibleBindings =
    selected?.source.actorBindings.filter((binding) => binding.eligible) ?? [];
  const selectedBinding = eligibleBindings.find((binding) => binding.roleKey === roleKey) ?? null;

  useEffect(() => {
    setRoleKey(eligibleBindings[0]?.roleKey ?? '');
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const sign = async () => {
    if (!selected || !selectedBinding || !rationale.trim() || writeState === 'SAVING') return;
    setWriteState('SAVING');
    setReceipt(null);
    const key = `${selected.id}:${selected.source.quorum.version}:${roleKey}:${outcome}`;
    const clientRequestId = commandIds.current.get(key) ?? crypto.randomUUID();
    commandIds.current.set(key, clientRequestId);
    try {
      await submitGateSignoff(selected.source.initiativeId, {
        expectedVersion: 0,
        expectedQuorumVersion: selected.source.quorum.version,
        clientRequestId,
        gate: selected.source.gate,
        decisionId: selected.source.decisionId,
        requesterId: selected.source.requesterId,
        roleKey,
        outcome,
        delegationProof: selectedBinding.delegationProof,
        rationale: rationale.trim(),
      });
      setReceipt(
        `${outcome} recorded for ${selected.source.gate}:${selected.source.decisionId}. Quorum readback requested.`
      );
      setRationale('');
      setWriteState('IDLE');
      await load();
      window.dispatchEvent(new Event('canonical-gate-signoff-updated'));
    } catch (error) {
      setWriteState(
        error instanceof RuntimeApiError && error.status === 409 ? 'CONFLICT' : 'FAILED'
      );
    }
  };

  if (state === 'LOADING')
    return (
      <section aria-label="Gate sign-offs" className="p-4">
        <div role="status" className="flex items-center gap-2 text-sm text-c-text-muted">
          <Loader2 aria-hidden="true" className="animate-spin" size={16} /> Loading Gate Sign-offs
        </div>
      </section>
    );
  if (state === 'ERROR')
    return (
      <section aria-label="Gate sign-offs" className="p-4">
        <div role="alert" className="flex items-center justify-between gap-3 text-sm text-c-danger">
          <span className="flex items-center gap-2">
            <AlertTriangle aria-hidden="true" size={16} /> Gate Sign-offs are unavailable.
          </span>
          <button type="button" className="btn-secondary" onClick={() => void load()}>
            Retry
          </button>
        </div>
      </section>
    );
  if (!rows.length && !receipt) return null;

  return (
    <section aria-label="Gate sign-offs" className="border-b border-c-border">
      <div className="px-4 pt-3">
        <h3 className="font-semibold text-c-text-primary">Gate Sign-offs waiting on you</h3>
        <p className="text-xs text-c-text-muted">
          Actor-owned sign-off tasks. This is not a mutable approvals list.
        </p>
      </div>
      {receipt && (
        <div role="status" className="mx-4 mt-2 text-sm text-c-success">
          {receipt}
        </div>
      )}
      {(writeState === 'CONFLICT' || writeState === 'FAILED') && (
        <div role="alert" className="mx-4 mt-2 text-sm text-c-danger">
          {writeState === 'CONFLICT'
            ? 'Quorum changed. Reload before signing again.'
            : 'Sign-off was not recorded.'}
        </div>
      )}
      <TableWithPreviewLayout<GateRow>
        selectedId={selectedId}
        selectedItem={selected}
        onSelect={setSelectedId}
        onOpenFull={setSelectedId}
        itemIds={rows.map((row) => row.id)}
        getItemById={(id) => rows.find((row) => row.id === id) ?? null}
        renderPreview={(row) => {
          const item = row.source,
            rule = item.effectivePolicy.rule;
          return (
            <div className="space-y-4 p-4 text-sm">
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-c-text-muted">Decision / Initiative</dt>
                  <dd>
                    {item.decisionId} · {item.initiativeId}
                  </dd>
                </div>
                <div>
                  <dt className="text-c-text-muted">Gate / SLA</dt>
                  <dd>
                    {item.gate} · {item.sla.state} · {item.sla.hours}h
                  </dd>
                </div>
                <div>
                  <dt className="text-c-text-muted">Policy snapshot</dt>
                  <dd>
                    {item.effectivePolicy.policyId} · v{item.effectivePolicy.policyVersion}
                  </dd>
                </div>
                <div>
                  <dt className="text-c-text-muted">Profile / source</dt>
                  <dd>
                    {item.effectivePolicy.profile} · {item.effectivePolicy.source}
                  </dd>
                </div>
                <div>
                  <dt className="text-c-text-muted">Required quorum</dt>
                  <dd>
                    {rule.quorum}; roles:{' '}
                    {rule.requiredRoles.length ? rule.requiredRoles.join(', ') : 'any bound role'}
                  </dd>
                </div>
                <div>
                  <dt className="text-c-text-muted">Separation</dt>
                  <dd>{rule.separation ? 'Requester cannot sign' : 'Not required'}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-c-text-muted">Quorum readback</dt>
                  <dd>
                    {item.quorum.quorumId} · v{item.quorum.version} · {item.quorum.status}
                    {item.quorum.receiptId ? ` · receipt ${item.quorum.receiptId}` : ''}
                  </dd>
                </div>
              </dl>
              <div className="rounded-md border border-c-border p-3">
                <strong>Recorded progress:</strong> {item.quorum.signoffs.length}/{rule.quorum}.
                Individual approvals are immutable audit evidence and are not editable here.
              </div>
              {!item.actorEligible && (
                <div role="alert" className="text-c-warning">
                  You have no eligible business-role binding for this sign-off.
                </div>
              )}
              <label className="block">
                <span className="mb-1 block text-c-text-muted">Signing role</span>
                <select
                  aria-label="Signing role"
                  className="w-full rounded-md border border-c-border bg-c-surface p-2"
                  value={roleKey}
                  onChange={(event) => setRoleKey(event.target.value)}
                >
                  {eligibleBindings.map((binding) => (
                    <option key={binding.roleKey} value={binding.roleKey}>
                      {binding.roleKey} · {binding.mode}
                    </option>
                  ))}
                </select>
              </label>
              {selectedBinding?.mode === 'DELEGATED' && (
                <div className="rounded-md border border-c-border p-3">
                  Exact delegation: {selectedBinding.delegationProof?.delegationRef} · v
                  {selectedBinding.delegationProof?.version} · from {selectedBinding.delegatedFrom}
                </div>
              )}
              <fieldset>
                <legend className="mb-1 text-c-text-muted">Your sign-off</legend>
                <div className="flex flex-wrap gap-3">
                  {(['APPROVE', 'REJECT', 'ABSTAIN'] as const).map((value) => (
                    <label key={value} className="flex items-center gap-1">
                      <input
                        type="radio"
                        name="gate-outcome"
                        value={value}
                        checked={outcome === value}
                        onChange={() => setOutcome(value)}
                      />
                      {value}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="block">
                <span className="mb-1 block text-c-text-muted">Sign-off rationale</span>
                <textarea
                  aria-label="Sign-off rationale"
                  className="min-h-24 w-full rounded-md border border-c-border bg-c-surface p-2"
                  value={rationale}
                  onChange={(event) => setRationale(event.target.value)}
                />
              </label>
            </div>
          );
        }}
        renderPreviewFooter={() => (
          <div className="flex w-full justify-end p-3">
            <button
              type="button"
              className="btn-primary"
              disabled={!selectedBinding || !rationale.trim() || writeState === 'SAVING'}
              onClick={() => void sign()}
            >
              Record my sign-off
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
          persistKey="my-work.gate-signoffs.v1"
        />
      </TableWithPreviewLayout>
    </section>
  );
};
