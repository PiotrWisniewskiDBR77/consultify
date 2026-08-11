import { AlertTriangle, Eye, Loader2, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';
import { StandardPreview } from '@/components/standard/StandardPreview';
import { StandardTable, type TableRow } from '@/components/standard/StandardTable';
import {
  acceptResourceCommitment,
  decideResourceCommitment,
  listCapacityOptions,
  listCapacityScenarioRegister,
  readCapacityScenario,
  requestResourceCommitment,
  RuntimeApiError,
  selectCapacityOption,
  writeCapacityScenario,
} from '@/services/initiatives-execution/runtimeApi';

import { type CanonicalMenu3Contract, countPresets } from './canonicalMenu3';

type K = 'KNOWN' | 'ESTIMATED' | 'UNKNOWN' | 'UNCONFIRMED';
type Range = {
  knowledgeState: K;
  low: number | null;
  base: number | null;
  high: number | null;
  sourceRef: string | null;
  sourceVersion: number | null;
  asOf: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  ownerId: string;
  reason: string | null;
};
type Scenario = {
  scenarioId: string;
  scenarioVersion: number;
  status: 'DRAFT' | 'PUBLISHED' | 'SUPERSEDED';
  planScenarioId: string;
  planScenarioVersion: number;
  windowUnit: string;
  timezone: string;
  periods: Array<{ periodId: string; start: string; end: string; demand: Range; supply: Range }>;
  constraints: Array<{ constraintId: string; state: K; detail: string; ownerId: string }>;
  proposedAssignments: Array<{
    assignmentId: string;
    initiativeId: string;
    resourceOrRoleId: string;
    periodIds: string[];
    demand: Range;
    rationale: string;
  }>;
  createdBy: string;
  updatedBy: string;
  publishedBy: string | null;
  publishedAt: string | null;
};
type OptionRange = {
  low: number | null;
  base: number | null;
  high: number | null;
  unit: string;
  knowledgeState: K;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  sourceRefs: Array<{ ref: string; version: number }>;
};
type CapacityOption = {
  optionId: string;
  kind: 'RESEQUENCE' | 'SCOPE_SPLIT' | 'ADD_CAPACITY';
  assumptions: Array<{
    assumption: string;
    ownerId: string;
    sourceRef: { ref: string; version: number };
    knowledgeState: K;
  }>;
  affectedMemberships: Array<{ initiativeId: string; membershipVersion: number }>;
  affectedPeriods: string[];
  affectedResources: Array<{ resourceRef: string; version: number }>;
  impact: { date: OptionRange; scope: OptionRange; cost: OptionRange; risk: OptionRange };
  rationale: string;
};
type CapacityComparison = {
  version: number;
  comparisonId: string;
  planRef: { scenarioId: string; version: number };
  capacityRef: { scenarioId: string; version: number };
  status: 'DRAFT' | 'SELECTED';
  options: CapacityOption[];
  selectedOptionId: string | null;
  nextGovernedInput: {
    kind: 'MATERIAL_CHANGE' | 'SCHEDULE_DECISION';
    optionId: string;
    comparisonId: string;
    comparisonVersion: number;
  } | null;
};
interface Row extends TableRow {
  id: string;
  title: string;
  state: string;
  plan: string;
  window: string;
  knowledge: string;
  updatedAt: string;
  version: number;
}
interface CapacityRegisterItem {
  id: string;
  name: string;
  state: string;
  planRef: { scenarioId: string; scenarioVersion: number };
  window: { start: string | null; end: string | null };
  knowledgeSummary: { known: number; estimated: number; unknown: number; unconfirmed: number };
  updatedAt: string;
  version: number;
}
const capacityPresets = [
  'all',
  'critical',
  'unknown-supply',
  'missing-demand',
  'skill-gaps',
  'management-load',
  'budget-envelope',
  'unconfirmed',
  'resolved',
] as const;
export const CapacityScenarioSurface: React.FC<CanonicalMenu3Contract> = ({
  activePreset,
  onCountsChange,
}) => {
  const [state, setState] = useState<'LOADING' | 'READY' | 'ERROR'>('LOADING'),
    [rows, setRows] = useState<Row[]>([]),
    [selectedId, setSelectedId] = useState<string | null>(null),
    [selectedConstraintId, setSelectedConstraintId] = useState<string | null>(null),
    [workspaceOpen, setWorkspaceOpen] = useState(false),
    [scenario, setScenario] = useState<Scenario | null>(null),
    [comparisons, setComparisons] = useState<CapacityComparison[]>([]),
    [aggregateVersion, setAggregateVersion] = useState(0),
    [writeState, setWriteState] = useState<'IDLE' | 'SAVING' | 'CONFLICT' | 'FAILED'>('IDLE');
  const [nextInputKind, setNextInputKind] = useState<'MATERIAL_CHANGE' | 'SCHEDULE_DECISION'>(
    'MATERIAL_CHANGE'
  );
  const constraintRows = useMemo(() => {
    if (!scenario) return [];
    const periods = scenario.periods.map((period) => ({
      id: `period:${period.periodId}`,
      title: period.periodId,
      kind: 'PERIOD',
      demand: period.demand.knowledgeState,
      supply: period.supply.knowledgeState,
      gap:
        period.demand.base != null && period.supply.base != null
          ? period.supply.base - period.demand.base
          : 'UNKNOWN',
      confidence:
        period.demand.confidence === 'UNKNOWN' || period.supply.confidence === 'UNKNOWN'
          ? 'UNKNOWN'
          : period.demand.confidence,
      criticality:
        period.supply.knowledgeState === 'UNKNOWN' || period.demand.knowledgeState === 'UNKNOWN'
          ? 'UNKNOWN'
          : 'KNOWN',
      owner: period.supply.ownerId || 'UNKNOWN',
      detail: '',
    }));
    const constraints = scenario.constraints.map((constraint) => ({
      id: `constraint:${constraint.constraintId}`,
      title: constraint.constraintId,
      kind: 'CONSTRAINT',
      demand: 'UNKNOWN',
      supply: constraint.state,
      gap: 'UNKNOWN',
      confidence: 'UNKNOWN',
      criticality: constraint.state === 'UNKNOWN' ? 'UNKNOWN' : 'KNOWN',
      owner: constraint.ownerId || 'UNKNOWN',
      detail: constraint.detail,
    }));
    return [...periods, ...constraints];
  }, [scenario]);
  const matchesCapacityPreset = (row: (typeof constraintRows)[number], preset: string) =>
    preset === 'all'
      ? true
      : preset === 'critical'
        ? row.criticality === 'UNKNOWN'
        : preset === 'unknown-supply'
          ? row.supply === 'UNKNOWN'
          : preset === 'missing-demand'
            ? row.demand === 'UNKNOWN'
            : preset === 'unconfirmed'
              ? row.supply === 'UNCONFIRMED'
              : preset === 'resolved'
                ? row.criticality === 'KNOWN'
                : preset === 'skill-gaps'
                  ? /skill/i.test(row.detail)
                  : preset === 'management-load'
                    ? /management|manager/i.test(row.detail)
                    : preset === 'budget-envelope'
                      ? /budget|cost/i.test(row.detail)
                      : false;
  const visibleConstraintRows = constraintRows.filter((row) =>
    matchesCapacityPreset(row, activePreset || 'all')
  );
  useEffect(
    () => onCountsChange?.(countPresets(constraintRows, capacityPresets, matchesCapacityPreset)),
    [constraintRows, onCountsChange]
  );
  const [commitment, setCommitment] = useState({
    assignmentId: '',
    initiativeId: '',
    resourceManagerId: '',
    assigneeId: '',
    expiresAt: '',
    commitmentId: '',
    version: '1',
    conditions: '',
    rationale: '',
  });
  const [commitmentWrite, setCommitmentWrite] = useState<{
    state: 'IDLE' | 'PENDING' | 'APPLIED' | 'FAILED';
    message: string;
  }>({ state: 'IDLE', message: '' });
  const ids = useRef(new Map<string, string>());
  const load = useCallback(async () => {
    setState('LOADING');
    try {
      const [body, optionBody] = (await Promise.all([
        listCapacityScenarioRegister(),
        listCapacityOptions(),
      ])) as [{ scenarios?: CapacityRegisterItem[] }, { items?: CapacityComparison[] }];
      const nextRows = (body.scenarios ?? []).map((x) => ({
        id: x.id,
        title: x.name,
        state: x.state,
        plan: `${x.planRef.scenarioId} v${x.planRef.scenarioVersion}`,
        window: `${x.window.start ?? '—'} → ${x.window.end ?? '—'}`,
        knowledge: `K ${x.knowledgeSummary.known} · E ${x.knowledgeSummary.estimated} · U ${x.knowledgeSummary.unknown} · UC ${x.knowledgeSummary.unconfirmed}`,
        updatedAt: x.updatedAt,
        version: x.version,
      }));
      setRows(nextRows);
      if (nextRows.length) {
        const initial = nextRows.find((item) => item.state === 'PUBLISHED') ?? nextRows[0];
        setSelectedId(initial.id);
        const loaded = (await readCapacityScenario(initial.id)) as {
          version: number;
          scenario: Scenario;
        };
        setAggregateVersion(loaded.version);
        setScenario(loaded.scenario);
      }
      setComparisons(optionBody.items ?? []);
      setState('READY');
    } catch {
      setState('ERROR');
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const open = async (id: string) => {
    setSelectedId(id);
    setWorkspaceOpen(true);
    try {
      const body = (await readCapacityScenario(id)) as { version: number; scenario: Scenario };
      setAggregateVersion(body.version);
      setScenario(body.scenario);
      setWriteState('IDLE');
    } catch {
      setWriteState('FAILED');
    }
  };
  const showWorkspace = () => {
    if (scenario && selectedId) setWorkspaceOpen(true);
  };
  const commandId = (key: string) => {
    const value = ids.current.get(key) ?? crypto.randomUUID();
    ids.current.set(key, value);
    return value;
  };
  const write = async (operation: 'UPDATE' | 'PUBLISH') => {
    if (!scenario) return;
    setWriteState('SAVING');
    try {
      await writeCapacityScenario(scenario.scenarioId, {
        expectedVersion: aggregateVersion,
        clientRequestId: commandId(`${scenario.scenarioId}:${aggregateVersion}:${operation}`),
        operation,
        scenario,
      });
      await open(scenario.scenarioId);
      await load();
      setWriteState('IDLE');
    } catch (e) {
      setWriteState(e instanceof RuntimeApiError && e.status === 409 ? 'CONFLICT' : 'FAILED');
    }
  };
  const request = async () => {
    if (!scenario || scenario.status !== 'PUBLISHED' || commitmentWrite.state === 'PENDING') return;
    const c = commitment;
    const commitmentId = c.commitmentId || crypto.randomUUID();
    setCommitmentWrite({ state: 'PENDING', message: 'Requesting commitment…' });
    try {
      const receipt = (await requestResourceCommitment(commitmentId, {
        expectedVersion: 0,
        clientRequestId: crypto.randomUUID(),
        capacityScenarioId: scenario.scenarioId,
        capacityScenarioVersion: scenario.scenarioVersion,
        assignmentId: c.assignmentId,
        initiativeId: c.initiativeId,
        resourceManagerId: c.resourceManagerId,
        assigneeId: c.assigneeId,
        expiresAt: new Date(c.expiresAt).toISOString(),
      })) as { aggregateVersion?: number };
      const version = String(receipt.aggregateVersion ?? 1);
      setCommitment((value) => ({ ...value, commitmentId, version }));
      setCommitmentWrite({ state: 'APPLIED', message: `Commitment requested · v${version}` });
    } catch {
      setCommitmentWrite({ state: 'FAILED', message: 'Commitment request failed; retry.' });
    }
  };
  const accept = async () => {
    if (!commitment.commitmentId || commitmentWrite.state === 'PENDING') return;
    setCommitmentWrite({ state: 'PENDING', message: 'Recording assignee acceptance…' });
    try {
      const receipt = (await acceptResourceCommitment(commitment.commitmentId, {
        expectedVersion: Number(commitment.version),
        clientRequestId: crypto.randomUUID(),
      })) as { aggregateVersion?: number };
      const version = String(receipt.aggregateVersion ?? Number(commitment.version) + 1);
      setCommitment((value) => ({ ...value, version }));
      setCommitmentWrite({ state: 'APPLIED', message: `Assignee accepted · v${version}` });
    } catch {
      setCommitmentWrite({ state: 'FAILED', message: 'Assignee acceptance failed; retry.' });
    }
  };
  const decide = async (outcome: 'CONFIRMED' | 'CONDITIONALLY_CONFIRMED' | 'DECLINED') => {
    if (!commitment.commitmentId || commitmentWrite.state === 'PENDING') return;
    setCommitmentWrite({ state: 'PENDING', message: 'Recording resource-manager decision…' });
    try {
      const receipt = (await decideResourceCommitment(commitment.commitmentId, {
        expectedVersion: Number(commitment.version),
        clientRequestId: crypto.randomUUID(),
        outcome,
        conditions: commitment.conditions.split('\n').filter(Boolean),
        rationale: commitment.rationale,
        policyOverrideDecisionId: null,
      })) as { aggregateVersion?: number };
      const version = String(receipt.aggregateVersion ?? Number(commitment.version) + 1);
      setCommitment((value) => ({ ...value, version }));
      setCommitmentWrite({ state: 'APPLIED', message: `${outcome} · v${version}` });
    } catch {
      setCommitmentWrite({ state: 'FAILED', message: 'Resource-manager decision failed; retry.' });
    }
  };
  const selectOption = async (comparison: CapacityComparison, optionId: string) => {
    setWriteState('SAVING');
    try {
      await selectCapacityOption(comparison.comparisonId, {
        expectedVersion: comparison.version,
        clientRequestId: commandId(
          `${comparison.comparisonId}:${comparison.version}:SELECT:${optionId}:${nextInputKind}`
        ),
        optionId,
        nextKind: nextInputKind,
      });
      await load();
      setWriteState('IDLE');
    } catch (error) {
      setWriteState(
        error instanceof RuntimeApiError && error.status === 409 ? 'CONFLICT' : 'FAILED'
      );
    }
  };
  if (state === 'LOADING')
    return (
      <div role="status" className="p-6">
        <Loader2 className="inline animate-spin" size={16} /> Loading Capacity scenarios
      </div>
    );
  if (state === 'ERROR')
    return (
      <div role="alert" className="p-6 text-c-danger">
        <AlertTriangle className="inline" size={16} /> Capacity register unavailable. No local
        shadow was created.{' '}
        <button className="btn-secondary" onClick={() => void load()}>
          Retry
        </button>
      </div>
    );
  return (
    <section aria-label="Capacity scenarios" className="p-4">
      <header className="mb-3">
        <h2 className="font-semibold">Capacity / Obciążenie</h2>
        <p className="text-xs text-c-text-muted">
          Scenario ranges are evidence states, not utilization or operational allocation.
        </p>
      </header>
      <div className="mb-3 flex min-w-0 flex-wrap items-center gap-2">
        <label className="w-full min-w-0 text-xs text-c-text-muted sm:w-auto">
          Aktywny wariant obciążenia
          <select
            aria-label="Active Capacity Scenario"
            className="mt-1 block w-full min-w-0 max-w-full rounded border border-c-border bg-c-surface px-2 py-1 text-sm sm:ml-2 sm:mt-0 sm:inline-block sm:w-auto"
            value={selectedId ?? ''}
            onChange={(event) => {
              const id = event.target.value;
              setSelectedConstraintId(null);
              setWorkspaceOpen(false);
              void open(id).then(() => setWorkspaceOpen(false));
            }}
          >
            {rows.map((row) => (
              <option key={row.id} value={row.id}>
                {row.title} · {row.state} · v{row.version}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="btn-secondary sm:ml-auto"
          disabled={!selectedId}
          onClick={showWorkspace}
        >
          <Eye size={15} /> Otwórz narzędzia obciążenia
        </button>
      </div>
      <TableWithPreviewLayout<(typeof constraintRows)[number]>
        selectedId={selectedConstraintId}
        selectedItem={visibleConstraintRows.find((row) => row.id === selectedConstraintId) ?? null}
        onSelect={setSelectedConstraintId}
        onOpenFull={showWorkspace}
        itemIds={visibleConstraintRows.map((row) => row.id)}
        getItemById={(id) => visibleConstraintRows.find((row) => row.id === id) ?? null}
        renderPreview={(row) => (
          <StandardPreview
            embedded
            title={row.title}
            onClose={() => setSelectedConstraintId(null)}
            onOpenFull={showWorkspace}
            meta={{
              pills: [
                { label: row.kind, tone: 'neutral' },
                { label: row.criticality, tone: 'neutral' },
                { label: row.confidence, tone: 'neutral' },
              ],
              trailing: <span>{row.owner}</span>,
            }}
            details={{
              label: 'Capacity constraint or period',
              text: row.detail || 'Evidence ranges only; UNKNOWN is not zero or utilization.',
              properties: [
                { id: 'demand', label: 'Demand knowledge', value: row.demand },
                { id: 'supply', label: 'Supply knowledge', value: row.supply },
                { id: 'gap', label: 'Gap', value: row.gap },
                { id: 'owner', label: 'Owner', value: row.owner },
              ],
            }}
            ai={{
              hints: ['Challenge assumptions', 'Compare options'],
              disabled: true,
              disabledTooltip: 'AI suggestions require an explicit governed analysis request.',
            }}
            relations={[
              {
                id: scenario?.planScenarioId ?? 'UNKNOWN',
                label: `Plan ${scenario?.planScenarioId ?? 'UNKNOWN'}:v${scenario?.planScenarioVersion ?? 'UNKNOWN'}`,
                type: 'plan',
              },
            ]}
            actions={{
              informational: [
                {
                  id: 'open-workspace',
                  variant: 'neutral',
                  label: 'Open workspace',
                  icon: Eye,
                  shortcut: 'O',
                  onClick: showWorkspace,
                },
              ],
            }}
          />
        )}
      >
        <StandardTable
          columns={[
            { id: 'title', label: 'Period / constraint', sortable: true, width: '240px' },
            { id: 'kind', label: 'Type', sortable: true, filterable: true },
            { id: 'demand', label: 'Demand knowledge', sortable: true, filterable: true },
            { id: 'supply', label: 'Supply knowledge', sortable: true, filterable: true },
            { id: 'gap', label: 'Gap', sortable: true },
            { id: 'confidence', label: 'Confidence', sortable: true, filterable: true },
            { id: 'criticality', label: 'Criticality', sortable: true, filterable: true },
            { id: 'owner', label: 'Owner', sortable: true, filterable: true },
          ]}
          data={visibleConstraintRows}
          selectedRowId={selectedConstraintId}
          onRowClick={(row) => setSelectedConstraintId(String(row.id))}
          onRowDoubleClick={showWorkspace}
          rowMenu={(row) => ({
            primary: [
              {
                id: 'open-workspace',
                label: 'Open workspace',
                icon: Eye,
                onClick: showWorkspace,
              },
            ],
            universalHandlers: {
              preview: () => setSelectedConstraintId(String(row.id)),
              edit: showWorkspace,
              archiveNote: 'Published capacity history is immutable',
            },
            destructive: { note: 'Capacity scenarios are superseded, not deleted' },
          })}
          persistKey="initiatives.capacity-constraints.v2"
          empty={{
            title: 'Brak danych obciążenia w tym zakresie',
            description: 'Zmień filtr albo otwórz narzędzia aktywnego wariantu obciążenia.',
          }}
        />
      </TableWithPreviewLayout>
      {scenario && workspaceOpen && (
        <section
          aria-label="Capacity Scenario Workbench"
          className="mt-4 rounded-md border border-c-border p-4"
        >
          <div className="flex flex-wrap justify-between gap-3">
            <div>
              <h3 className="font-semibold">Capacity Scenario Workbench</h3>
              <p className="text-xs">
                Exact Plan {scenario.planScenarioId} v{scenario.planScenarioVersion} ·{' '}
                {scenario.windowUnit} · {scenario.timezone}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-ghost"
                aria-label="Zamknij narzędzia obciążenia"
                onClick={() => setWorkspaceOpen(false)}
              >
                <X size={15} /> Zamknij
              </button>
              <button
                className="btn-secondary"
                disabled={scenario.status !== 'DRAFT' || writeState === 'SAVING'}
                onClick={() => void write('UPDATE')}
              >
                Save draft
              </button>
              <button
                className="btn-primary"
                disabled={scenario.status !== 'DRAFT' || writeState === 'SAVING'}
                onClick={() => void write('PUBLISH')}
              >
                Publish
              </button>
            </div>
          </div>
          <div className="mt-4">
            <StandardTable
              columns={[
                { id: 'title', label: 'Period / constraint', sortable: true },
                { id: 'kind', label: 'Type', sortable: true },
                { id: 'demand', label: 'Demand knowledge', sortable: true },
                { id: 'supply', label: 'Supply knowledge', sortable: true },
                { id: 'gap', label: 'Gap', sortable: true },
                { id: 'confidence', label: 'Confidence', sortable: true },
                { id: 'criticality', label: 'Criticality', sortable: true },
                { id: 'owner', label: 'Owner', sortable: true },
              ]}
              data={visibleConstraintRows}
              persistKey="initiatives.capacity-constraints.v1"
              empty={{
                title: 'No matching capacity records',
                description: 'No constraint or period matches this preset.',
              }}
            />
          </div>
          {(writeState === 'CONFLICT' || writeState === 'FAILED') && (
            <p role="alert" className="text-c-danger">
              {writeState === 'CONFLICT'
                ? 'Scenario changed; reload required.'
                : 'No change was saved.'}
            </p>
          )}
          <div className="mt-4 space-y-3">
            {scenario.periods.map((p) => (
              <article key={p.periodId} className="rounded border border-c-border p-3">
                <strong>{p.periodId}</strong> {p.start} → {p.end}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <RangeView label="Demand" value={p.demand} />
                  <RangeView label="Supply" value={p.supply} />
                </div>
              </article>
            ))}
            <div>
              <h4 className="font-medium">Constraints</h4>
              {scenario.constraints.map((c) => (
                <p key={c.constraintId}>
                  {c.state} · {c.detail} · owner {c.ownerId}
                </p>
              ))}
            </div>
            <div>
              <h4 className="font-medium">Proposed assignments</h4>
              {scenario.proposedAssignments.map((a) => (
                <button
                  key={a.assignmentId}
                  className="block w-full text-left"
                  onClick={() =>
                    setCommitment((v) => ({
                      ...v,
                      assignmentId: a.assignmentId,
                      initiativeId: a.initiativeId,
                    }))
                  }
                >
                  {a.assignmentId} · {a.initiativeId} · {a.resourceOrRoleId} ·{' '}
                  {a.demand.knowledgeState}
                </button>
              ))}
            </div>
            <CapacityOptionsPanel
              comparisons={comparisons.filter(
                (comparison) => comparison.capacityRef.scenarioId === scenario.scenarioId
              )}
              nextInputKind={nextInputKind}
              onNextInputKind={setNextInputKind}
              onSelect={(comparison, optionId) => void selectOption(comparison, optionId)}
              saving={writeState === 'SAVING'}
            />
            <div className="grid grid-cols-1 gap-2 border-t border-c-border pt-3 sm:grid-cols-2">
              {(
                [
                  'commitmentId',
                  'assignmentId',
                  'initiativeId',
                  'resourceManagerId',
                  'assigneeId',
                  'expiresAt',
                  'version',
                ] as const
              ).map((k) => (
                <label key={k} className="text-xs">
                  {k}
                  <input
                    aria-label={`Capacity ${k}`}
                    type={k === 'expiresAt' ? 'datetime-local' : 'text'}
                    className="block w-full rounded border border-c-border bg-c-background p-2"
                    value={commitment[k]}
                    onChange={(e) => setCommitment((v) => ({ ...v, [k]: e.target.value }))}
                  />
                </label>
              ))}
              <label className="text-xs">
                conditions
                <textarea
                  aria-label="Capacity commitment conditions"
                  className="block w-full rounded border border-c-border bg-c-background p-2"
                  value={commitment.conditions}
                  onChange={(e) => setCommitment((v) => ({ ...v, conditions: e.target.value }))}
                />
              </label>
              <label className="text-xs">
                rationale
                <textarea
                  aria-label="Capacity commitment rationale"
                  className="block w-full rounded border border-c-border bg-c-background p-2"
                  value={commitment.rationale}
                  onChange={(e) => setCommitment((v) => ({ ...v, rationale: e.target.value }))}
                />
              </label>
              <div className="col-span-2 flex flex-wrap gap-2">
                <button
                  className="btn-secondary"
                  disabled={commitmentWrite.state === 'PENDING'}
                  onClick={() => void request()}
                >
                  Request commitment
                </button>
                <button
                  className="btn-secondary"
                  disabled={commitmentWrite.state === 'PENDING'}
                  onClick={() => void accept()}
                >
                  Assignee accept
                </button>
                <button
                  className="btn-secondary"
                  disabled={commitmentWrite.state === 'PENDING'}
                  onClick={() => void decide('CONFIRMED')}
                >
                  RM confirm
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => void decide('CONDITIONALLY_CONFIRMED')}
                >
                  RM conditional
                </button>
                <button className="btn-secondary" onClick={() => void decide('DECLINED')}>
                  RM decline
                </button>
              </div>
              {commitmentWrite.message ? (
                <p
                  className="col-span-2 text-xs text-c-text-muted"
                  role={commitmentWrite.state === 'FAILED' ? 'alert' : 'status'}
                >
                  {commitmentWrite.message}
                </p>
              ) : null}
            </div>
          </div>
        </section>
      )}
    </section>
  );
};
const RangeView = ({ label, value }: { label: string; value: Range }) => (
  <div>
    <h5>
      {label}: {value.knowledgeState}
    </h5>
    <p>
      {value.knowledgeState === 'UNKNOWN'
        ? 'UNKNOWN — no numeric value'
        : `${value.low} / ${value.base} / ${value.high}`}
    </p>
    <p className="text-xs text-c-text-muted">
      {value.sourceRef ? `${value.sourceRef} v${value.sourceVersion}` : value.reason} ·{' '}
      {value.confidence} · owner {value.ownerId}
    </p>
  </div>
);

const optionLabels: Record<CapacityOption['kind'], string> = {
  RESEQUENCE: 'Resequence',
  SCOPE_SPLIT: 'Split scope',
  ADD_CAPACITY: 'Add capacity',
};

const OptionImpact = ({ label, value }: { label: string; value: OptionRange }) => (
  <div className="rounded border border-c-border p-2">
    <dt className="text-xs font-medium">{label}</dt>
    <dd className="text-sm">
      {value.knowledgeState === 'UNKNOWN' || value.knowledgeState === 'UNCONFIRMED'
        ? `${value.knowledgeState} — no numeric value`
        : `${value.low} / ${value.base} / ${value.high} ${value.unit}`}
    </dd>
    <dd className="text-xs text-c-text-muted">
      {value.confidence} ·{' '}
      {value.sourceRefs.length
        ? value.sourceRefs.map((source) => `${source.ref} v${source.version}`).join(', ')
        : 'EVIDENCE_MISSING'}
    </dd>
  </div>
);

const CapacityOptionsPanel = ({
  comparisons,
  nextInputKind,
  onNextInputKind,
  onSelect,
  saving,
}: {
  comparisons: CapacityComparison[];
  nextInputKind: 'MATERIAL_CHANGE' | 'SCHEDULE_DECISION';
  onNextInputKind: (value: 'MATERIAL_CHANGE' | 'SCHEDULE_DECISION') => void;
  onSelect: (comparison: CapacityComparison, optionId: string) => void;
  saving: boolean;
}) => (
  <section aria-label="Capacity options comparison" className="border-t border-c-border pt-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h4 className="font-medium">Capacity options</h4>
        <p className="text-xs text-c-text-muted">
          Comparison only. Selection creates a governed next input; it does not change Plan,
          baseline, allocation or commitment.
        </p>
      </div>
      <label className="text-xs">
        Governed next input
        <select
          aria-label="Capacity governed next input"
          className="ml-2 rounded border border-c-border bg-c-background p-2"
          value={nextInputKind}
          onChange={(event) =>
            onNextInputKind(event.target.value as 'MATERIAL_CHANGE' | 'SCHEDULE_DECISION')
          }
        >
          <option value="MATERIAL_CHANGE">Material Change</option>
          <option value="SCHEDULE_DECISION">Schedule Decision</option>
        </select>
      </label>
    </div>
    {comparisons.length === 0 ? (
      <p className="mt-3 text-sm text-c-text-muted">No persisted comparison for this scenario.</p>
    ) : (
      comparisons.map((comparison) => (
        <article key={comparison.comparisonId} className="mt-3 rounded border border-c-border p-3">
          <div className="flex justify-between text-xs">
            <span>
              {comparison.comparisonId} · v{comparison.version} · {comparison.status}
            </span>
            <span>
              Plan {comparison.planRef.scenarioId} v{comparison.planRef.version} · Capacity v
              {comparison.capacityRef.version}
            </span>
          </div>
          <div className="mt-3 grid gap-3 xl:grid-cols-3">
            {comparison.options.map((option) => (
              <section
                key={option.optionId}
                aria-label={`Capacity option ${optionLabels[option.kind]}`}
                className={`rounded border p-3 ${comparison.selectedOptionId === option.optionId ? 'border-c-focus-solid' : 'border-c-border'}`}
              >
                <h5 className="font-semibold">{optionLabels[option.kind]}</h5>
                <p className="text-xs text-c-text-muted">{option.rationale}</p>
                <dl className="mt-2 grid grid-cols-2 gap-2">
                  <OptionImpact label="Date" value={option.impact.date} />
                  <OptionImpact label="Scope" value={option.impact.scope} />
                  <OptionImpact label="Cost" value={option.impact.cost} />
                  <OptionImpact label="Risk" value={option.impact.risk} />
                </dl>
                <div className="mt-2 text-xs">
                  <strong>Assumptions</strong>
                  {option.assumptions.map((assumption) => (
                    <p key={`${option.optionId}:${assumption.assumption}`}>
                      {assumption.knowledgeState} · {assumption.assumption} · owner{' '}
                      {assumption.ownerId} · {assumption.sourceRef.ref} v
                      {assumption.sourceRef.version}
                    </p>
                  ))}
                  <p>
                    Memberships:{' '}
                    {option.affectedMemberships
                      .map((item) => `${item.initiativeId} v${item.membershipVersion}`)
                      .join(', ') || 'none'}
                  </p>
                  <p>Periods: {option.affectedPeriods.join(', ') || 'none'}</p>
                  <p>
                    Resources:{' '}
                    {option.affectedResources
                      .map((item) => `${item.resourceRef} v${item.version}`)
                      .join(', ') || 'none'}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-secondary mt-3 w-full"
                  disabled={comparison.status !== 'DRAFT' || saving}
                  onClick={() => onSelect(comparison, option.optionId)}
                >
                  {comparison.selectedOptionId === option.optionId
                    ? 'Selected governed input'
                    : 'Select as governed input'}
                </button>
              </section>
            ))}
          </div>
          {comparison.nextGovernedInput && (
            <p role="status" className="mt-3 text-xs">
              Governed input: {comparison.nextGovernedInput.kind} · option{' '}
              {comparison.nextGovernedInput.optionId} · comparison v
              {comparison.nextGovernedInput.comparisonVersion}
            </p>
          )}
        </article>
      ))
    )}
  </section>
);
