import { AlertTriangle, Loader2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation, type TFunction } from 'react-i18next';

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

const buildColumns = (t: TFunction): TableColumn[] => [
  {
    id: 'title',
    label: t('myWork.gateSignoffQueue.columnSignOff', 'Sign-off'),
    sortable: true,
    width: '220px',
  },
  {
    id: 'gate',
    label: t('myWork.gateSignoffQueue.columnGate', 'Gate'),
    sortable: true,
    filterable: true,
  },
  {
    id: 'initiativeId',
    label: t('myWork.gateSignoffQueue.columnInitiative', 'Initiative'),
    sortable: true,
  },
  {
    id: 'profile',
    label: t('myWork.gateSignoffQueue.columnPolicyProfile', 'Policy profile'),
    sortable: true,
    filterable: true,
  },
  { id: 'quorum', label: t('myWork.gateSignoffQueue.columnQuorum', 'Quorum'), sortable: true },
  {
    id: 'sla',
    label: t('myWork.gateSignoffQueue.columnSla', 'SLA'),
    sortable: true,
    filterable: true,
  },
];

export const GateSignoffQueue: React.FC = () => {
  const { t } = useTranslation();
  const columns = useMemo(() => buildColumns(t), [t]);
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
        title: t('myWork.gateSignoffQueue.rowTitle', 'Gate Sign-off'),
        gate: item.gate,
        initiativeId: item.initiativeId,
        profile: item.effectivePolicy.profile,
        quorum: `${item.quorum.signoffs.length}/${item.effectivePolicy.rule.quorum} · ${item.quorum.status}`,
        sla: `${item.sla.state} · ${item.sla.hours}h`,
        source: item,
      })),
    [items, t]
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
        t(
          'myWork.gateSignoffQueue.receipt',
          '{{outcome}} recorded for {{gate}}:{{decisionId}}. Quorum readback requested.',
          {
            outcome,
            gate: selected.source.gate,
            decisionId: selected.source.decisionId,
          }
        )
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

  const gateSignoffsLabel = t('myWork.gateSignoffQueue.title', 'Gate sign-offs');

  if (state === 'LOADING')
    return (
      <section aria-label={gateSignoffsLabel} className="p-4">
        <div role="status" className="flex items-center gap-2 text-sm text-c-text-muted">
          <Loader2 aria-hidden="true" className="animate-spin" size={16} />{' '}
          {t('myWork.gateSignoffQueue.loading', 'Loading Gate Sign-offs')}
        </div>
      </section>
    );
  if (state === 'ERROR')
    return (
      <section aria-label={gateSignoffsLabel} className="p-4">
        <div role="alert" className="flex items-center justify-between gap-3 text-sm text-c-danger">
          <span className="flex items-center gap-2">
            <AlertTriangle aria-hidden="true" size={16} />{' '}
            {t('myWork.gateSignoffQueue.unavailable', 'Gate Sign-offs are unavailable.')}
          </span>
          <button type="button" className="btn-secondary" onClick={() => void load()}>
            {t('myWork.gateSignoffQueue.retry', 'Retry')}
          </button>
        </div>
      </section>
    );
  if (!rows.length && !receipt) return null;

  return (
    <section aria-label={gateSignoffsLabel} className="border-b border-c-border">
      <div className="px-4 pt-3">
        <h3 className="font-semibold text-c-text-primary">
          {t('myWork.gateSignoffQueue.waitingOnYou', 'Gate Sign-offs waiting on you')}
        </h3>
        <p className="text-xs text-c-text-muted">
          {t(
            'myWork.gateSignoffQueue.subtitle',
            'Actor-owned sign-off tasks. This is not a mutable approvals list.'
          )}
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
            ? t('myWork.gateSignoffQueue.conflict', 'Quorum changed. Reload before signing again.')
            : t('myWork.gateSignoffQueue.failed', 'Sign-off was not recorded.')}
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
                  <dt className="text-c-text-muted">
                    {t('myWork.gateSignoffQueue.decisionInitiative', 'Decision / Initiative')}
                  </dt>
                  <dd>
                    {item.decisionId} · {item.initiativeId}
                  </dd>
                </div>
                <div>
                  <dt className="text-c-text-muted">
                    {t('myWork.gateSignoffQueue.gateSla', 'Gate / SLA')}
                  </dt>
                  <dd>
                    {item.gate} · {item.sla.state} · {item.sla.hours}h
                  </dd>
                </div>
                <div>
                  <dt className="text-c-text-muted">
                    {t('myWork.gateSignoffQueue.policySnapshot', 'Policy snapshot')}
                  </dt>
                  <dd>
                    {item.effectivePolicy.policyId} · v{item.effectivePolicy.policyVersion}
                  </dd>
                </div>
                <div>
                  <dt className="text-c-text-muted">
                    {t('myWork.gateSignoffQueue.profileSource', 'Profile / source')}
                  </dt>
                  <dd>
                    {item.effectivePolicy.profile} · {item.effectivePolicy.source}
                  </dd>
                </div>
                <div>
                  <dt className="text-c-text-muted">
                    {t('myWork.gateSignoffQueue.requiredQuorum', 'Required quorum')}
                  </dt>
                  <dd>
                    {t('myWork.gateSignoffQueue.requiredQuorumValue', '{{quorum}}; roles: {{roles}}', {
                      quorum: rule.quorum,
                      roles: rule.requiredRoles.length
                        ? rule.requiredRoles.join(', ')
                        : t('myWork.gateSignoffQueue.anyBoundRole', 'any bound role'),
                    })}
                  </dd>
                </div>
                <div>
                  <dt className="text-c-text-muted">
                    {t('myWork.gateSignoffQueue.separation', 'Separation')}
                  </dt>
                  <dd>
                    {rule.separation
                      ? t('myWork.gateSignoffQueue.requesterCannotSign', 'Requester cannot sign')
                      : t('myWork.gateSignoffQueue.notRequired', 'Not required')}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-c-text-muted">
                    {t('myWork.gateSignoffQueue.quorumReadback', 'Quorum readback')}
                  </dt>
                  <dd>
                    {item.quorum.quorumId} · v{item.quorum.version} · {item.quorum.status}
                    {item.quorum.receiptId
                      ? t('myWork.gateSignoffQueue.quorumReceiptSuffix', ' · receipt {{receiptId}}', {
                          receiptId: item.quorum.receiptId,
                        })
                      : ''}
                  </dd>
                </div>
              </dl>
              <div className="rounded-md border border-c-border p-3">
                <strong>{t('myWork.gateSignoffQueue.recordedProgress', 'Recorded progress:')}</strong>{' '}
                {t(
                  'myWork.gateSignoffQueue.recordedProgressValue',
                  '{{signed}}/{{quorum}}. Individual approvals are immutable audit evidence and are not editable here.',
                  { signed: item.quorum.signoffs.length, quorum: rule.quorum }
                )}
              </div>
              {!item.actorEligible && (
                <div role="alert" className="text-c-warning">
                  {t(
                    'myWork.gateSignoffQueue.noEligibleBinding',
                    'You have no eligible business-role binding for this sign-off.'
                  )}
                </div>
              )}
              <label className="block">
                <span className="mb-1 block text-c-text-muted">
                  {t('myWork.gateSignoffQueue.signingRole', 'Signing role')}
                </span>
                <select
                  aria-label={t('myWork.gateSignoffQueue.signingRoleAriaLabel', 'Signing role')}
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
                  {t(
                    'myWork.gateSignoffQueue.exactDelegation',
                    'Exact delegation: {{ref}} · v{{version}} · from {{delegatedFrom}}',
                    {
                      ref: selectedBinding.delegationProof?.delegationRef,
                      version: selectedBinding.delegationProof?.version,
                      delegatedFrom: selectedBinding.delegatedFrom,
                    }
                  )}
                </div>
              )}
              <fieldset>
                <legend className="mb-1 text-c-text-muted">
                  {t('myWork.gateSignoffQueue.yourSignOff', 'Your sign-off')}
                </legend>
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
                <span className="mb-1 block text-c-text-muted">
                  {t('myWork.gateSignoffQueue.signOffRationale', 'Sign-off rationale')}
                </span>
                <textarea
                  aria-label={t(
                    'myWork.gateSignoffQueue.signOffRationaleAriaLabel',
                    'Sign-off rationale'
                  )}
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
              {t('myWork.gateSignoffQueue.recordSignOff', 'Record my sign-off')}
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
