import { AlertTriangle, Loader2 } from 'lucide-react';
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

const buildColumns = (t: TFunction): TableColumn[] => [
  {
    id: 'title',
    label: t('myWork.portfolioDecisionQueue.columnDecision', 'Decision'),
    sortable: true,
    width: '220px',
  },
  {
    id: 'initiativeId',
    label: t('myWork.portfolioDecisionQueue.columnInitiative', 'Initiative'),
    sortable: true,
  },
  {
    id: 'scenario',
    label: t('myWork.portfolioDecisionQueue.columnScenarioSnapshot', 'Scenario snapshot'),
    sortable: true,
  },
  {
    id: 'disposition',
    label: t('myWork.portfolioDecisionQueue.columnProposedDisposition', 'Proposed disposition'),
    sortable: true,
    filterable: true,
  },
  { id: 'dueAt', label: t('myWork.portfolioDecisionQueue.columnDue', 'Due'), sortable: true },
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
  const { t } = useTranslation();
  const columns = useMemo(() => buildColumns(t), [t]);
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
        title: t('myWork.portfolioDecisionQueue.rowTitle', 'Portfolio Decision'),
        initiativeId: decision.initiativeId,
        scenario: `${decision.scenarioId} · v${decision.scenarioVersion}`,
        disposition: text(decision.membershipSnapshot.disposition),
        dueAt: decision.dueAt,
        source: decision,
      })),
    [decisions, t]
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
          ? t(
              'myWork.portfolioDecisionQueue.receiptApproved',
              '{{status}} · lifecycle readback {{lifecycleState}}',
              {
                status: result.response?.status ?? outcome,
                lifecycleState: result.mutation?.lifecycleState ?? 'APPROVED_BACKLOG',
              }
            )
          : t(
              'myWork.portfolioDecisionQueue.receiptOther',
              '{{status}} · lifecycle remains READY_FOR_DECISION',
              { status: result.response?.status ?? outcome }
            )
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

  const portfolioDecisionsLabel = t(
    'myWork.portfolioDecisionQueue.title',
    'Portfolio decisions'
  );

  if (state === 'LOADING')
    return (
      <section aria-label={portfolioDecisionsLabel} className="p-4">
        <div role="status" className="flex items-center gap-2 text-sm text-c-text-muted">
          <Loader2 aria-hidden="true" className="animate-spin" size={16} />{' '}
          {t('myWork.portfolioDecisionQueue.loading', 'Loading Portfolio decisions')}
        </div>
      </section>
    );
  if (state === 'ERROR')
    return (
      <section aria-label={portfolioDecisionsLabel} className="p-4">
        <div role="alert" className="flex items-center justify-between gap-3 text-sm text-c-danger">
          <span className="flex items-center gap-2">
            <AlertTriangle aria-hidden="true" size={16} />{' '}
            {t('myWork.portfolioDecisionQueue.unavailable', 'Portfolio decisions are unavailable.')}
          </span>
          <button type="button" className="btn-secondary" onClick={() => void load()}>
            {t('myWork.portfolioDecisionQueue.retry', 'Retry')}
          </button>
        </div>
      </section>
    );
  if (!rows.length && !receipt) return null;

  return (
    <section aria-label={portfolioDecisionsLabel} className="border-b border-c-border">
      <div className="px-4 pt-3">
        <h3 className="font-semibold text-c-text-primary">
          {t('myWork.portfolioDecisionQueue.waitingOnYou', 'Portfolio decisions waiting on you')}
        </h3>
        <p className="text-xs text-c-text-muted">
          {t(
            'myWork.portfolioDecisionQueue.subtitle',
            'One Initiative and one frozen Portfolio Scenario snapshot per independent decision.'
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
            ? t(
                'myWork.portfolioDecisionQueue.conflict',
                'The Initiative or Portfolio Scenario changed. Reload before deciding.'
              )
            : t(
                'myWork.portfolioDecisionQueue.failed',
                'The Portfolio Decision was not changed.'
              )}
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
                  <dt className="text-c-text-muted">
                    {t('myWork.portfolioDecisionQueue.canonicalDecisionId', 'Canonical Decision ID')}
                  </dt>
                  <dd>{row.id}</dd>
                </div>
                <div>
                  <dt className="text-c-text-muted">
                    {t('myWork.portfolioDecisionQueue.initiativeSnapshot', 'Initiative snapshot')}
                  </dt>
                  <dd>
                    {row.initiativeId} · v{row.source.initiativeVersion}
                  </dd>
                </div>
                <div>
                  <dt className="text-c-text-muted">
                    {t('myWork.portfolioDecisionQueue.scenarioSnapshot', 'Scenario snapshot')}
                  </dt>
                  <dd>{row.scenario}</dd>
                </div>
                <div>
                  <dt className="text-c-text-muted">
                    {t('myWork.portfolioDecisionQueue.dueRequester', 'Due / requester')}
                  </dt>
                  <dd>
                    {row.dueAt} · {row.source.requesterId}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-c-text-muted">
                    {t('myWork.portfolioDecisionQueue.frozenCardVersions', 'Frozen Card versions')}
                  </dt>
                  <dd className="break-all">{JSON.stringify(row.source.cardVersions)}</dd>
                </div>
              </dl>
              <section
                aria-label={t(
                  'myWork.portfolioDecisionQueue.membershipSnapshotAriaLabel',
                  'Membership snapshot'
                )}
                className="rounded-md border border-c-border p-3"
              >
                <h4 className="font-medium">
                  {t(
                    'myWork.portfolioDecisionQueue.frozenMembershipSnapshot',
                    'Frozen membership snapshot'
                  )}
                </h4>
                <dl className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {['disposition', 'rank', 'rankOverride', 'confidence', 'rationale'].map((key) => (
                    <div key={key}>
                      <dt className="text-c-text-muted">{key}</dt>
                      <dd>{text(membership[key])}</dd>
                    </div>
                  ))}
                </dl>
                <details className="mt-3">
                  <summary>
                    {t('myWork.portfolioDecisionQueue.exactSnapshotJson', 'Exact snapshot JSON')}
                  </summary>
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
                  {t(
                    'myWork.portfolioDecisionQueue.governanceUnavailable',
                    'Governance projection is unavailable. Decision is fail-closed.'
                  )}
                </div>
              ) : !quorumRef ? (
                <div
                  role="alert"
                  className="rounded-md border border-c-warning/40 bg-c-warning/10 p-3 text-c-warning"
                >
                  {t(
                    'myWork.portfolioDecisionQueue.quorumNotSatisfied',
                    'Required Gate Signoff quorum is not satisfied.'
                  )}
                </div>
              ) : quorumRef ? (
                <div className="rounded-md border border-c-border p-3">
                  {t(
                    'myWork.portfolioDecisionQueue.satisfiedQuorum',
                    'Satisfied quorum: {{quorumId}} · v{{version}}',
                    { quorumId: quorumRef.quorumId, version: quorumRef.version }
                  )}
                </div>
              ) : null}
              <label className="block">
                <span className="mb-1 block text-c-text-muted">
                  {t('myWork.portfolioDecisionQueue.portfolioOutcome', 'Portfolio outcome')}
                </span>
                <select
                  aria-label={t(
                    'myWork.portfolioDecisionQueue.portfolioOutcomeAriaLabel',
                    'Portfolio outcome'
                  )}
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
                  <span className="mb-1 block text-c-text-muted">
                    {t(
                      'myWork.portfolioDecisionQueue.conditionsOnePerLine',
                      'Conditions (one per line)'
                    )}
                  </span>
                  <textarea
                    aria-label={t(
                      'myWork.portfolioDecisionQueue.portfolioConditionsAriaLabel',
                      'Portfolio conditions'
                    )}
                    className="min-h-20 w-full rounded-md border border-c-border bg-c-surface p-2"
                    value={conditions}
                    onChange={(event) => setConditions(event.target.value)}
                  />
                </label>
              )}
              {outcome === 'MERGED' && (
                <label className="block">
                  <span className="mb-1 block text-c-text-muted">
                    {t(
                      'myWork.portfolioDecisionQueue.mergeTargetInitiativeId',
                      'Merge target Initiative ID'
                    )}
                  </span>
                  <input
                    aria-label={t(
                      'myWork.portfolioDecisionQueue.mergeTargetInitiativeIdAriaLabel',
                      'Merge target Initiative ID'
                    )}
                    className="w-full rounded-md border border-c-border bg-c-surface p-2"
                    value={mergeTarget}
                    onChange={(event) => setMergeTarget(event.target.value)}
                  />
                </label>
              )}
              <label className="block">
                <span className="mb-1 block text-c-text-muted">
                  {t(
                    'myWork.portfolioDecisionQueue.portfolioDecisionRationale',
                    'Portfolio Decision rationale'
                  )}
                </span>
                <textarea
                  aria-label={t(
                    'myWork.portfolioDecisionQueue.portfolioDecisionRationaleAriaLabel',
                    'Portfolio Decision rationale'
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
              disabled={
                !rationale.trim() ||
                !outcomeValid ||
                !mergeValid ||
                !gateGuard.ready ||
                writeState === 'SAVING'
              }
              onClick={() => void decide()}
            >
              {t('myWork.portfolioDecisionQueue.recordDecision', 'Record Portfolio Decision')}
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
