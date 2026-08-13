import { AlertTriangle, Loader2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';
import {
  StandardTable,
  type TableColumn,
  type TableRow,
} from '@/components/standard/StandardTable';
import {
  decideScheduleDecision,
  listMyScheduleDecisions,
  readHandoffPackage,
  RuntimeApiError,
} from '@/services/initiatives-execution/runtimeApi';

import { useGateSignoffGuard } from './gateSignoffProjection';

type ScheduleOutcome = 'APPROVED' | 'CONDITIONALLY_APPROVED' | 'RETURNED' | 'HELD';
interface PendingScheduleDecision {
  version: number;
  decisionId: string;
  initiativeId: string;
  status: 'PENDING';
  requesterId: string;
  authorityId: string;
  executionManagerId: string;
  initiativeVersion: number;
  dueAt: string;
  portfolio: { id: string; version: number };
  plan: {
    id: string;
    version: number;
    windowUnit: string;
    timezone: string;
    window: { earliest: string | null; target: string | null; latest: string | null };
  };
  capacity: { id: string; version: number };
  commitmentVersions: Record<string, number>;
  criticalPeriodIds: string[];
  criticalDependencies: Array<{
    dependencyId: string;
    state: 'RESOLVED' | 'UNRESOLVED';
    critical: boolean;
  }>;
}
interface DecisionRow extends TableRow {
  id: string;
  title: string;
  initiativeId: string;
  dueAt: string;
  plan: string;
  capacity: string;
  version: number;
  source: PendingScheduleDecision;
}

const columns: TableColumn[] = [
  { id: 'title', label: 'Decision', sortable: true, width: '26%' },
  { id: 'initiativeId', label: 'Initiative', sortable: true },
  { id: 'plan', label: 'Plan', sortable: true },
  { id: 'capacity', label: 'Capacity', sortable: true },
  { id: 'dueAt', label: 'Due', sortable: true },
];

export const ScheduleDecisionQueue: React.FC = () => {
  const [state, setState] = useState<'LOADING' | 'READY' | 'ERROR'>('LOADING');
  const [decisions, setDecisions] = useState<PendingScheduleDecision[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rationale, setRationale] = useState('');
  const [conditions, setConditions] = useState('');
  const [writeState, setWriteState] = useState<'IDLE' | 'SAVING' | 'CONFLICT' | 'FAILED'>('IDLE');
  const [receipt, setReceipt] = useState<{
    lifecycleState: string;
    handoffPackageId: string;
    handoffPackageVersion: number;
  } | null>(null);
  const commandIds = useRef(new Map<string, string>());

  const load = useCallback(async () => {
    setState('LOADING');
    try {
      const body = (await listMyScheduleDecisions()) as { decisions?: PendingScheduleDecision[] };
      const next = Array.isArray(body.decisions) ? body.decisions : [];
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
        title: 'Schedule Decision',
        initiativeId: decision.initiativeId,
        dueAt: decision.dueAt,
        plan: `${decision.plan.id} v${decision.plan.version}`,
        capacity: `${decision.capacity.id} v${decision.capacity.version}`,
        version: decision.version,
        source: decision,
      })),
    [decisions]
  );
  const selected = rows.find((row) => row.id === selectedId) ?? null;
  const gateGuard = useGateSignoffGuard('SCHEDULE', selectedId);

  const decide = async (outcome: ScheduleOutcome) => {
    if (!selected || !rationale.trim() || !gateGuard.ready || writeState === 'SAVING') return;
    const parsedConditions = conditions
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
    if (outcome === 'CONDITIONALLY_APPROVED' && !parsedConditions.length) return;
    setWriteState('SAVING');
    const key = `${selected.id}:${selected.version}:${outcome}`;
    const clientRequestId = commandIds.current.get(key) ?? crypto.randomUUID();
    commandIds.current.set(key, clientRequestId);
    try {
      const result = (await decideScheduleDecision(selected.initiativeId, {
        expectedVersion: selected.source.initiativeVersion + 1,
        clientRequestId,
        decisionId: selected.id,
        outcome,
        rationale: rationale.trim(),
        conditions: parsedConditions,
        governanceQuorumRef: gateGuard.quorumRef,
      })) as { aggregateVersion?: number; response?: { handoffPackageId?: string | null } };
      const handoffPackageId = result.response?.handoffPackageId ?? null;
      if (handoffPackageId) {
        const pack = (await readHandoffPackage(handoffPackageId)) as {
          version: number;
          handoffPackageId: string;
        };
        setReceipt({
          lifecycleState: 'SCHEDULED',
          handoffPackageId: pack.handoffPackageId,
          handoffPackageVersion: pack.version,
        });
      } else setReceipt(null);
      setRationale('');
      setConditions('');
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
      <section aria-label="Schedule decisions" className="p-4">
        <div role="status" className="flex items-center gap-2 text-sm text-c-text-muted">
          <Loader2 aria-hidden="true" className="animate-spin" size={16} /> Loading Schedule
          decisions
        </div>
      </section>
    );
  if (state === 'ERROR')
    return (
      <section aria-label="Schedule decisions" className="p-4">
        <div role="alert" className="flex items-center justify-between gap-3 text-sm text-c-danger">
          <span className="flex items-center gap-2">
            <AlertTriangle aria-hidden="true" size={16} /> Schedule decisions are unavailable.
          </span>
          <button type="button" className="btn-secondary" onClick={() => void load()}>
            Retry
          </button>
        </div>
      </section>
    );
  if (!rows.length && !receipt) return null;

  return (
    <section aria-label="Schedule decisions" className="border-b border-c-border">
      <div className="px-4 pt-3">
        <h3 className="font-semibold text-c-text-primary">Schedule decisions waiting on you</h3>
        <p className="text-xs text-c-text-muted">
          Canonical gate queue. Approval schedules the Initiative and freezes a Handoff Package; it
          does not start Execution.
        </p>
      </div>
      {receipt && (
        <div role="status" className="mx-4 mt-3 rounded-md border border-c-success/40 p-3 text-sm">
          <strong>{receipt.lifecycleState}</strong> · frozen Handoff Package{' '}
          <span className="break-all">{receipt.handoffPackageId}</span> v
          {receipt.handoffPackageVersion}
        </div>
      )}
      {(writeState === 'CONFLICT' || writeState === 'FAILED') && (
        <div role="alert" className="mx-4 mt-2 text-sm text-c-danger">
          {writeState === 'CONFLICT'
            ? 'This Schedule Decision changed. Reload before deciding.'
            : 'The Schedule Decision was not changed.'}
        </div>
      )}
      {rows.length > 0 && (
        <TableWithPreviewLayout<DecisionRow>
          selectedId={selectedId}
          selectedItem={selected}
          onSelect={setSelectedId}
          onOpenFull={setSelectedId}
          itemIds={rows.map((row) => row.id)}
          getItemById={(id) => rows.find((row) => row.id === id) ?? null}
          renderPreview={(row) => (
            <div className="space-y-3 p-4 text-sm">
              <dl className="grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-c-text-muted">Canonical Decision ID</dt>
                  <dd className="break-all">{row.id}</dd>
                </div>
                <div>
                  <dt className="text-c-text-muted">Initiative</dt>
                  <dd>{row.initiativeId}</dd>
                </div>
                <div>
                  <dt className="text-c-text-muted">Portfolio</dt>
                  <dd>
                    {row.source.portfolio.id} v{row.source.portfolio.version}
                  </dd>
                </div>
                <div>
                  <dt className="text-c-text-muted">Plan</dt>
                  <dd>{row.plan}</dd>
                </div>
                <div>
                  <dt className="text-c-text-muted">Capacity</dt>
                  <dd>{row.capacity}</dd>
                </div>
                <div>
                  <dt className="text-c-text-muted">Commitments</dt>
                  <dd>
                    {Object.entries(row.source.commitmentVersions)
                      .map(([id, version]) => `${id} v${version}`)
                      .join(', ') || 'None'}
                  </dd>
                </div>
                <div>
                  <dt className="text-c-text-muted">Window</dt>
                  <dd>
                    {row.source.plan.window.earliest ?? '—'} →{' '}
                    {row.source.plan.window.latest ?? '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-c-text-muted">Critical periods</dt>
                  <dd>{row.source.criticalPeriodIds.join(', ') || 'None'}</dd>
                </div>
                <div>
                  <dt className="text-c-text-muted">Critical dependencies</dt>
                  <dd>
                    {row.source.criticalDependencies
                      .map((item) => `${item.dependencyId}: ${item.state}`)
                      .join(', ') || 'None'}
                  </dd>
                </div>
              </dl>
              <label className="block">
                <span className="mb-1 block text-c-text-muted">Decision rationale</span>
                <textarea
                  aria-label="Schedule Decision rationale"
                  className="min-h-20 w-full rounded-md border border-c-border bg-c-surface p-2"
                  value={rationale}
                  onChange={(event) => setRationale(event.target.value)}
                />
              </label>
              {!gateGuard.ready && (
                <div role="alert" className="text-c-warning">
                  Schedule decision is fail-closed until its exact Gate Sign-off quorum is
                  satisfied.
                </div>
              )}
              <label className="block">
                <span className="mb-1 block text-c-text-muted">Conditions, one per line</span>
                <textarea
                  aria-label="Schedule Decision conditions"
                  className="min-h-16 w-full rounded-md border border-c-border bg-c-surface p-2"
                  value={conditions}
                  onChange={(event) => setConditions(event.target.value)}
                />
              </label>
            </div>
          )}
          renderPreviewFooter={() => (
            <div className="flex w-full flex-wrap justify-end gap-2 p-3">
              <button
                type="button"
                className="btn-secondary"
                disabled={!rationale.trim() || !gateGuard.ready || writeState === 'SAVING'}
                onClick={() => void decide('HELD')}
              >
                Hold
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={!rationale.trim() || !gateGuard.ready || writeState === 'SAVING'}
                onClick={() => void decide('RETURNED')}
              >
                Return
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={
                  !rationale.trim() ||
                  !conditions.trim() ||
                  !gateGuard.ready ||
                  writeState === 'SAVING'
                }
                onClick={() => void decide('CONDITIONALLY_APPROVED')}
              >
                Approve conditionally
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={!rationale.trim() || !gateGuard.ready || writeState === 'SAVING'}
                onClick={() => void decide('APPROVED')}
              >
                Approve schedule
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
            persistKey="my-work.schedule-decisions.v1"
          />
        </TableWithPreviewLayout>
      )}
    </section>
  );
};
