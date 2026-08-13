import { AlertTriangle, Loader2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';
import {
  StandardTable,
  type TableColumn,
  type TableRow,
} from '@/components/standard/StandardTable';
import {
  decidePortfolioDecision,
  listMyPortfolioDecisions,
  RuntimeApiError,
} from '@/services/initiatives-execution/runtimeApi';

import { useGateSignoffGuard } from './gateSignoffProjection';

type PortfolioOutcome =
  | 'APPROVED'
  | 'CONDITIONALLY_APPROVED'
  | 'RETURNED'
  | 'DEFERRED'
  | 'REJECTED'
  | 'MERGED';

interface PendingPortfolioDecision {
  version: number;
  decisionId: string;
  initiativeId: string;
  status: 'PENDING';
  requesterId: string;
  authorityId: string;
  scenarioId: string;
  scenarioVersion: number;
  initiativeVersion: number;
  cardVersions: Record<string, number>;
  membershipSnapshot: Record<string, unknown>;
  requestedAt: string;
  dueAt: string;
  policy?: { policyId: string; policyVersion: number };
}

interface PortfolioRow extends TableRow {
  id: string;
  title: string;
  initiativeId: string;
  scenario: string;
  disposition: string;
  dueAt: string;
  source: PendingPortfolioDecision;
}

const columns: TableColumn[] = [
  { id: 'title', label: 'Decision', sortable: true, width: '26%' },
  { id: 'initiativeId', label: 'Initiative', sortable: true },
  { id: 'scenario', label: 'Scenario snapshot', sortable: true },
  { id: 'disposition', label: 'Proposed disposition', sortable: true, filterable: true },
  { id: 'dueAt', label: 'Due', sortable: true },
];

function normalizeList(body: unknown): PendingPortfolioDecision[] {
  if (Array.isArray(body)) return body as PendingPortfolioDecision[];
  if (
    body &&
    typeof body === 'object' &&
    Array.isArray((body as { decisions?: unknown }).decisions)
  )
    return (body as { decisions: PendingPortfolioDecision[] }).decisions;
  return [];
}

function text(value: unknown) {
  return value === null || value === undefined || value === '' ? 'UNKNOWN' : String(value);
}

export const PortfolioDecisionQueue: React.FC = () => {
  const [state, setState] = useState<'LOADING' | 'READY' | 'ERROR'>('LOADING');
  const [decisions, setDecisions] = useState<PendingPortfolioDecision[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<PortfolioOutcome>('APPROVED');
  const [rationale, setRationale] = useState('');
  const [conditions, setConditions] = useState('');
  const [mergeTarget, setMergeTarget] = useState('');
  const [writeState, setWriteState] = useState<'IDLE' | 'SAVING' | 'CONFLICT' | 'FAILED'>('IDLE');
  const [receipt, setReceipt] = useState<string | null>(null);
  const commandIds = useRef(new Map<string, string>());

  const load = useCallback(async () => {
    setState('LOADING');
    try {
      const next = normalizeList(await listMyPortfolioDecisions());
      setDecisions(next);
      setSelectedId((current) =>
        current && next.some((item) => item.decisionId === current) ? current : null
      );
      setState('READY');
    } catch {
      setState('ERROR');
    }
  }, []);

  useEffect(() => void load(), [load]);

  const rows = useMemo<PortfolioRow[]>(
    () =>
      decisions.map((decision) => ({
        id: decision.decisionId,
        title: 'Portfolio Decision',
        initiativeId: decision.initiativeId,
        scenario: `${decision.scenarioId} · v${decision.scenarioVersion}`,
        disposition: text(decision.membershipSnapshot.disposition),
        dueAt: decision.dueAt,
        source: decision,
      })),
    [decisions]
  );
  const selected = rows.find((row) => row.id === selectedId) ?? null;
  const gateGuard = useGateSignoffGuard('PORTFOLIO', selectedId);
  const quorumRef = gateGuard.quorumRef;
  const parsedConditions = conditions
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
  const outcomeValid = outcome !== 'CONDITIONALLY_APPROVED' || parsedConditions.length > 0;
  const mergeValid = outcome !== 'MERGED' || Boolean(mergeTarget.trim());

  const decide = async () => {
    if (
      !selected ||
      !rationale.trim() ||
      !outcomeValid ||
      !mergeValid ||
      !gateGuard.ready ||
      writeState === 'SAVING'
    )
      return;
    setWriteState('SAVING');
    setReceipt(null);
    const key = `${selected.id}:${selected.version}:${outcome}`;
    const clientRequestId = commandIds.current.get(key) ?? crypto.randomUUID();
    commandIds.current.set(key, clientRequestId);
    try {
      const result = (await decidePortfolioDecision(selected.initiativeId, {
        expectedVersion: selected.source.initiativeVersion + 1,
        clientRequestId,
        decisionId: selected.id,
        outcome,
        rationale: rationale.trim(),
        conditions: outcome === 'CONDITIONALLY_APPROVED' ? parsedConditions : [],
        mergeTargetInitiativeId: outcome === 'MERGED' ? mergeTarget.trim() : null,
        ...(quorumRef ? { governanceQuorumRef: quorumRef } : {}),
      })) as { response?: { status?: string }; mutation?: { lifecycleState?: string } };
      const approved = outcome === 'APPROVED' || outcome === 'CONDITIONALLY_APPROVED';
      setReceipt(
        approved
          ? `${result.response?.status ?? outcome} · lifecycle readback ${result.mutation?.lifecycleState ?? 'APPROVED_BACKLOG'}`
          : `${result.response?.status ?? outcome} · lifecycle remains READY_FOR_DECISION`
      );
      setRationale('');
      setConditions('');
      setMergeTarget('');
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
      <section aria-label="Portfolio decisions" className="p-4">
        <div role="status" className="flex items-center gap-2 text-sm text-c-text-muted">
          <Loader2 aria-hidden="true" className="animate-spin" size={16} /> Loading Portfolio
          decisions
        </div>
      </section>
    );
  if (state === 'ERROR')
    return (
      <section aria-label="Portfolio decisions" className="p-4">
        <div role="alert" className="flex items-center justify-between gap-3 text-sm text-c-danger">
          <span className="flex items-center gap-2">
            <AlertTriangle aria-hidden="true" size={16} /> Portfolio decisions are unavailable.
          </span>
          <button type="button" className="btn-secondary" onClick={() => void load()}>
            Retry
          </button>
        </div>
      </section>
    );
  if (!rows.length && !receipt) return null;

  return (
    <section aria-label="Portfolio decisions" className="border-b border-c-border">
      <div className="px-4 pt-3">
        <h3 className="font-semibold text-c-text-primary">Portfolio decisions waiting on you</h3>
        <p className="text-xs text-c-text-muted">
          One Initiative and one frozen Portfolio Scenario snapshot per independent decision.
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
            ? 'The Initiative or Portfolio Scenario changed. Reload before deciding.'
            : 'The Portfolio Decision was not changed.'}
        </div>
      )}
      <TableWithPreviewLayout<PortfolioRow>
        selectedId={selectedId}
        selectedItem={selected}
        onSelect={setSelectedId}
        onOpenFull={(id) => setSelectedId(id)}
        itemIds={rows.map((row) => row.id)}
        getItemById={(id) => rows.find((row) => row.id === id) ?? null}
        renderPreview={(row) => {
          const membership = row.source.membershipSnapshot;
          return (
            <div className="space-y-4 p-4 text-sm">
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-c-text-muted">Canonical Decision ID</dt>
                  <dd>{row.id}</dd>
                </div>
                <div>
                  <dt className="text-c-text-muted">Initiative snapshot</dt>
                  <dd>
                    {row.initiativeId} · v{row.source.initiativeVersion}
                  </dd>
                </div>
                <div>
                  <dt className="text-c-text-muted">Scenario snapshot</dt>
                  <dd>{row.scenario}</dd>
                </div>
                <div>
                  <dt className="text-c-text-muted">Due / requester</dt>
                  <dd>
                    {row.dueAt} · {row.source.requesterId}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-c-text-muted">Frozen Card versions</dt>
                  <dd className="break-all">{JSON.stringify(row.source.cardVersions)}</dd>
                </div>
              </dl>
              <section
                aria-label="Membership snapshot"
                className="rounded-md border border-c-border p-3"
              >
                <h4 className="font-medium">Frozen membership snapshot</h4>
                <dl className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {['disposition', 'rank', 'rankOverride', 'confidence', 'rationale'].map((key) => (
                    <div key={key}>
                      <dt className="text-c-text-muted">{key}</dt>
                      <dd>{text(membership[key])}</dd>
                    </div>
                  ))}
                </dl>
                <details className="mt-3">
                  <summary>Exact snapshot JSON</summary>
                  <pre className="mt-2 overflow-auto whitespace-pre-wrap text-xs">
                    {JSON.stringify(membership, null, 2)}
                  </pre>
                </details>
              </section>
              {gateGuard.state === 'ERROR' ? (
                <div
                  role="alert"
                  className="rounded-md border border-c-warning/40 bg-c-warning/10 p-3 text-c-warning"
                >
                  Governance projection is unavailable. Decision is fail-closed.
                </div>
              ) : !quorumRef ? (
                <div
                  role="alert"
                  className="rounded-md border border-c-warning/40 bg-c-warning/10 p-3 text-c-warning"
                >
                  Required Gate Signoff quorum is not satisfied.
                </div>
              ) : quorumRef ? (
                <div className="rounded-md border border-c-border p-3">
                  Satisfied quorum: {quorumRef.quorumId} · v{quorumRef.version}
                </div>
              ) : null}
              <label className="block">
                <span className="mb-1 block text-c-text-muted">Portfolio outcome</span>
                <select
                  aria-label="Portfolio outcome"
                  className="w-full rounded-md border border-c-border bg-c-surface p-2"
                  value={outcome}
                  onChange={(event) => setOutcome(event.target.value as PortfolioOutcome)}
                >
                  {[
                    'APPROVED',
                    'CONDITIONALLY_APPROVED',
                    'RETURNED',
                    'DEFERRED',
                    'REJECTED',
                    'MERGED',
                  ].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              {outcome === 'CONDITIONALLY_APPROVED' && (
                <label className="block">
                  <span className="mb-1 block text-c-text-muted">Conditions (one per line)</span>
                  <textarea
                    aria-label="Portfolio conditions"
                    className="min-h-20 w-full rounded-md border border-c-border bg-c-surface p-2"
                    value={conditions}
                    onChange={(event) => setConditions(event.target.value)}
                  />
                </label>
              )}
              {outcome === 'MERGED' && (
                <label className="block">
                  <span className="mb-1 block text-c-text-muted">Merge target Initiative ID</span>
                  <input
                    aria-label="Merge target Initiative ID"
                    className="w-full rounded-md border border-c-border bg-c-surface p-2"
                    value={mergeTarget}
                    onChange={(event) => setMergeTarget(event.target.value)}
                  />
                </label>
              )}
              <label className="block">
                <span className="mb-1 block text-c-text-muted">Portfolio Decision rationale</span>
                <textarea
                  aria-label="Portfolio Decision rationale"
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
              disabled={
                !rationale.trim() ||
                !outcomeValid ||
                !mergeValid ||
                !gateGuard.ready ||
                writeState === 'SAVING'
              }
              onClick={() => void decide()}
            >
              Record Portfolio Decision
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
          persistKey="my-work.portfolio-decisions.v1"
        />
      </TableWithPreviewLayout>
    </section>
  );
};
