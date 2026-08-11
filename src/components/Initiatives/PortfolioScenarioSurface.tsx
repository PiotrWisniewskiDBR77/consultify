import { AlertTriangle, Eye, Loader2, Plus, Save, Send, X } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';
import { StandardPreview } from '@/components/standard/StandardPreview';
import { StandardTable, type TableRow } from '@/components/standard/StandardTable';
import {
  listPortfolioScenarioRegister,
  readPortfolioScenario,
  readPortfolioScenarioDiff,
  requestPortfolioDecision,
  RuntimeApiError,
  writePortfolioScenario,
} from '@/services/initiatives-execution/runtimeApi';

import { type CanonicalMenu3Contract, countPresets } from './canonicalMenu3';

type TriState<T> =
  | { state: 'KNOWN' | 'ESTIMATED'; value: T; basis: string }
  | { state: 'UNKNOWN'; value: null; reason: string };
type Disposition = 'INCLUDED' | 'CONDITIONAL' | 'DEFERRED' | 'EXCLUDED';
interface Membership {
  initiativeId: string;
  initiativeVersion: number;
  disposition: Disposition;
  scoreDecomposition: Record<string, number | null>;
  rank: number | null;
  rankOverride: null;
  coverage: TriState<number>;
  overlap: TriState<string[]>;
  roughDemand: TriState<{ unit: string; low: number; base: number; high: number }>;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  rationale: string;
}
interface Scenario {
  scenarioId: string;
  scenarioVersion: number;
  status: 'DRAFT' | 'PUBLISHED' | 'SUPERSEDED';
  scope: { portfolioId: string; goalIds: string[]; asOf: string };
  model: { modelId: string; version: number };
  memberships: Membership[];
  decompositionKeys: string[];
  createdBy: string;
  updatedBy: string;
  publishedBy: string | null;
  publishedAt: string | null;
  previousPublishedVersion: number | null;
}
interface InitiativeOption {
  id: string;
  name: string;
}
interface ScenarioRow extends TableRow {
  id: string;
  title: string;
  status: string;
  version: number;
  members: number;
  confidence: string;
  updated: string;
  scenario: Scenario;
  aggregateVersion: number;
}
interface Props extends CanonicalMenu3Contract {
  portfolioId: string | null;
  initiatives: InitiativeOption[];
}

const unknown = <T,>(reason: string): TriState<T> => ({ state: 'UNKNOWN', value: null, reason });
const emptyScenario = (scenarioId: string, portfolioId: string): Scenario => ({
  scenarioId,
  scenarioVersion: 0,
  status: 'DRAFT',
  scope: { portfolioId, goalIds: [], asOf: new Date().toISOString() },
  model: { modelId: 'human-portfolio-v1', version: 1 },
  memberships: [],
  decompositionKeys: ['value', 'risk', 'fit'],
  createdBy: '',
  updatedBy: '',
  publishedBy: null,
  publishedAt: null,
  previousPublishedVersion: null,
});

const portfolioPresets = [
  'current',
  'unassigned',
  'included',
  'conditional',
  'deferred',
  'excluded',
  'mandatory',
  'low-confidence',
  'coverage-gaps',
  'duplicates',
] as const;

export const PortfolioScenarioSurface: React.FC<Props> = ({
  portfolioId,
  initiatives,
  activePreset,
  onCountsChange,
}) => {
  const [rows, setRows] = useState<ScenarioRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedMembershipId, setSelectedMembershipId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Scenario | null>(null);
  const [scenarioIdInput, setScenarioIdInput] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [writeState, setWriteState] = useState<
    'IDLE' | 'LOADING' | 'SAVING' | 'CONFLICT' | 'ERROR'
  >('IDLE');
  const [diff, setDiff] = useState<
    Array<{ initiativeId: string; before: Membership | null; after: Membership | null }>
  >([]);
  const [authorityId, setAuthorityId] = useState('');
  const [decisionDueAt, setDecisionDueAt] = useState('');
  const [decisionStatus, setDecisionStatus] = useState<Record<string, string>>({});
  const commandIds = useRef(new Map<string, string>());
  const selected = rows.find((row) => row.id === selectedId) ?? null;
  const activeScenario =
    draft ??
    selected?.scenario ??
    rows.find((row) => row.status === 'PUBLISHED')?.scenario ??
    rows[0]?.scenario ??
    null;
  const membershipRows = useMemo(() => {
    const names = new Map(initiatives.map((item) => [item.id, item.name]));
    return (activeScenario?.memberships ?? []).map((membership) => ({
      id: membership.initiativeId,
      title: names.get(membership.initiativeId) ?? membership.initiativeId,
      disposition: membership.disposition,
      rank: membership.rank ?? 'UNKNOWN',
      confidence: membership.confidence,
      coverage: membership.coverage.state,
      overlap: membership.overlap.state === 'UNKNOWN' ? 'UNKNOWN' : membership.overlap.value.length,
      demand: membership.roughDemand.state,
      decision: decisionStatus[membership.initiativeId] ?? 'NOT_REQUESTED',
      scenario: activeScenario?.scenarioId ?? 'UNKNOWN',
      scenarioVersion: activeScenario?.scenarioVersion ?? 0,
      membership,
    }));
  }, [activeScenario, decisionStatus, initiatives]);
  const matchesMembershipPreset = (row: (typeof membershipRows)[number], preset: string) => {
    if (preset === 'current') return true;
    if (preset === 'unassigned' || preset === 'mandatory') return false;
    if (['included', 'conditional', 'deferred', 'excluded'].includes(preset))
      return row.disposition === preset.toUpperCase();
    if (preset === 'low-confidence')
      return row.confidence === 'LOW' || row.confidence === 'UNKNOWN';
    if (preset === 'coverage-gaps') return row.coverage !== 'KNOWN';
    if (preset === 'duplicates') return row.overlap !== 'UNKNOWN' && Number(row.overlap) > 0;
    return false;
  };
  const effectivePreset = activePreset || 'current';
  const visibleMembershipRows = membershipRows.filter((row) =>
    matchesMembershipPreset(row, effectivePreset)
  );
  useEffect(
    () => onCountsChange?.(countPresets(membershipRows, portfolioPresets, matchesMembershipPreset)),
    [membershipRows, onCountsChange]
  );
  const openWorkspace = (row: ScenarioRow) => {
    setSelectedId(row.id);
    setDraft(structuredClone(row.scenario));
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const register = (await listPortfolioScenarioRegister()) as {
          scenarios?: Array<{ id: string }>;
        };
        const hydrated = await Promise.all(
          (register.scenarios ?? []).map(async ({ id }) => {
            const result = (await readPortfolioScenario(id)) as {
              version: number;
              scenario: Scenario;
            };
            const confidences = new Set(
              result.scenario.memberships.map((member) => member.confidence)
            );
            return {
              id: result.scenario.scenarioId,
              title: result.scenario.scenarioId,
              status: result.scenario.status,
              version: result.scenario.scenarioVersion,
              members: result.scenario.memberships.length,
              confidence: confidences.size === 1 ? ([...confidences][0] ?? 'UNKNOWN') : 'MIXED',
              updated: result.scenario.scope.asOf,
              scenario: result.scenario,
              aggregateVersion: result.version,
            } satisfies ScenarioRow;
          })
        );
        if (!cancelled) {
          setRows(hydrated);
          setSelectedId((current) => {
            if (current && hydrated.some((row) => row.id === current)) return current;
            return (
              hydrated.find((row) => row.status === 'PUBLISHED')?.id ?? hydrated[0]?.id ?? null
            );
          });
        }
      } catch {
        if (!cancelled) setWriteState('ERROR');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const upsert = (scenario: Scenario, aggregateVersion: number) => {
    const confidences = new Set(scenario.memberships.map((member) => member.confidence));
    const row: ScenarioRow = {
      id: scenario.scenarioId,
      title: scenario.scenarioId,
      status: scenario.status,
      version: scenario.scenarioVersion,
      members: scenario.memberships.length,
      confidence: confidences.size === 1 ? ([...confidences][0] ?? 'UNKNOWN') : 'MIXED',
      updated: scenario.scope.asOf,
      scenario,
      aggregateVersion,
    };
    setRows((current) => [...current.filter((item) => item.id !== row.id), row]);
    setSelectedId(row.id);
    setDraft(structuredClone(scenario));
  };

  const createDraft = () => {
    if (!portfolioId) return;
    const id = scenarioIdInput.trim() || crypto.randomUUID();
    const scenario = emptyScenario(id, portfolioId);
    setScenarioIdInput(id);
    setSelectedId(id);
    setDraft(scenario);
  };
  const write = async (operation: 'CREATE' | 'UPDATE' | 'PUBLISH') => {
    if (!draft || !portfolioId || writeState === 'SAVING') return;
    setWriteState('SAVING');
    const existing = rows.find((row) => row.id === draft.scenarioId);
    const key = `${draft.scenarioId}:${existing?.aggregateVersion ?? 0}:${operation}`;
    const clientRequestId = commandIds.current.get(key) ?? crypto.randomUUID();
    commandIds.current.set(key, clientRequestId);
    try {
      const result = (await writePortfolioScenario(draft.scenarioId, {
        expectedVersion: existing?.aggregateVersion ?? 0,
        clientRequestId,
        operation,
        scenario: { ...draft, scope: { ...draft.scope, asOf: new Date().toISOString() } },
      })) as { aggregateVersion: number; response: Scenario };
      upsert(result.response, result.aggregateVersion);
      setWriteState('IDLE');
      if (result.response.scenarioVersion > 1) {
        const d = (await readPortfolioScenarioDiff(
          result.response.scenarioId,
          result.response.scenarioVersion - 1,
          result.response.scenarioVersion
        )) as { changes: typeof diff };
        setDiff(d.changes);
      }
    } catch (error) {
      setWriteState(
        error instanceof RuntimeApiError && error.status === 409 ? 'CONFLICT' : 'ERROR'
      );
    }
  };

  const addMembership = (initiativeId: string) => {
    if (!draft || draft.memberships.some((item) => item.initiativeId === initiativeId)) return;
    setDraft({
      ...draft,
      memberships: [
        ...draft.memberships,
        {
          initiativeId,
          initiativeVersion: 1,
          disposition: 'INCLUDED',
          scoreDecomposition: { value: null, risk: null, fit: null },
          rank: null,
          rankOverride: null,
          coverage: unknown('Not assessed'),
          overlap: unknown('Not assessed'),
          roughDemand: unknown('Rough demand not estimated'),
          confidence: 'UNKNOWN',
          rationale: 'Awaiting portfolio rationale',
        },
      ],
    });
  };
  const updateMembership = (initiativeId: string, patch: Partial<Membership>) =>
    setDraft((current) =>
      current
        ? {
            ...current,
            memberships: current.memberships.map((item) =>
              item.initiativeId === initiativeId ? { ...item, ...patch } : item
            ),
          }
        : current
    );
  const requestDecision = async (member: Membership) => {
    if (!draft || draft.status !== 'PUBLISHED' || !authorityId.trim() || !decisionDueAt) return;
    const decisionId = crypto.randomUUID();
    setDecisionStatus((current) => ({ ...current, [member.initiativeId]: 'REQUESTING' }));
    try {
      await requestPortfolioDecision(member.initiativeId, {
        expectedVersion: member.initiativeVersion,
        clientRequestId: crypto.randomUUID(),
        decisionId,
        authorityId: authorityId.trim(),
        scenarioId: draft.scenarioId,
        scenarioVersion: draft.scenarioVersion,
        dueAt: new Date(decisionDueAt).toISOString(),
      });
      setDecisionStatus((current) => ({
        ...current,
        [member.initiativeId]: `PENDING · ${decisionId}`,
      }));
    } catch {
      setDecisionStatus((current) => ({ ...current, [member.initiativeId]: 'FAILED' }));
    }
  };

  const available = useMemo(
    () =>
      initiatives.filter(
        (item) => !draft?.memberships.some((member) => member.initiativeId === item.id)
      ),
    [draft, initiatives]
  );
  return (
    <section aria-label="Portfolio scenarios" className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-c-border p-3">
        <div>
          <h2 className="font-semibold">Portfel inicjatyw</h2>
          <p className="text-sm text-c-text-muted">
            Porównuj warianty, zakres i kolejność inicjatyw.
          </p>
        </div>
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto">
          <label className="w-full min-w-0 text-xs text-c-text-muted sm:w-auto">
            Aktywny wariant
            <select
              aria-label="Active Portfolio Scenario"
              className="mt-1 block w-full min-w-0 max-w-full rounded-md border border-c-border bg-c-surface px-2 py-1.5 text-sm text-c-text sm:ml-2 sm:mt-0 sm:inline-block sm:w-auto"
              value={draft?.scenarioId ?? selectedId ?? ''}
              onChange={(event) => {
                setDraft(null);
                setSelectedId(event.target.value || null);
                setSelectedMembershipId(null);
              }}
            >
              {!rows.length && <option value="">Brak wariantu</option>}
              {rows.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.title} · {row.status} · v{row.version}
                </option>
              ))}
            </select>
          </label>
          {selected && !draft && (
            <button type="button" className="btn-secondary" onClick={() => openWorkspace(selected)}>
              <Eye size={15} /> Otwórz narzędzia wariantu
            </button>
          )}
          <button
            type="button"
            className="btn-primary"
            disabled={!portfolioId}
            onClick={() => setShowCreate(true)}
          >
            <Plus size={15} /> Nowy wariant
          </button>
        </div>
      </div>
      {showCreate && (
        <div className="flex flex-wrap items-center gap-2 border-b border-c-border p-3">
          <input
            aria-label="Scenario ID"
            className="min-w-0 flex-1 rounded-md border border-c-border bg-c-surface px-3 py-2 text-sm sm:min-w-64"
            placeholder="Nazwa wariantu"
            value={scenarioIdInput}
            onChange={(event) => setScenarioIdInput(event.target.value)}
          />
          <button
            type="button"
            className="btn-primary"
            disabled={!portfolioId}
            onClick={createDraft}
          >
            Utwórz wariant
          </button>
          <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>
            Anuluj
          </button>
        </div>
      )}
      {(writeState === 'ERROR' || writeState === 'CONFLICT') && (
        <div role="alert" className="m-3 flex flex-wrap items-center gap-2 text-sm text-c-danger">
          <AlertTriangle size={15} />
          <span>
            {writeState === 'CONFLICT'
              ? 'Scenario changed. Reopen before retrying.'
              : 'Scenario operation failed; canonical truth was not changed.'}
          </span>
          {writeState === 'ERROR' ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => window.location.reload()}
            >
              Spróbuj ponownie
            </button>
          ) : null}
        </div>
      )}
      <TableWithPreviewLayout<(typeof membershipRows)[number]>
        selectedId={selectedMembershipId}
        selectedItem={visibleMembershipRows.find((row) => row.id === selectedMembershipId) ?? null}
        onSelect={setSelectedMembershipId}
        onOpenFull={() => {
          if (selected) openWorkspace(selected);
        }}
        itemIds={visibleMembershipRows.map((row) => row.id)}
        getItemById={(id) => visibleMembershipRows.find((row) => row.id === id) ?? null}
        renderPreview={(row) => (
          <StandardPreview
            embedded
            title={row.title}
            onClose={() => setSelectedMembershipId(null)}
            onOpenFull={() => {
              if (selected) openWorkspace(selected);
            }}
            meta={{
              pills: [
                { label: row.disposition, tone: 'neutral' },
                { label: `Rank ${row.rank}`, tone: 'neutral' },
                { label: row.confidence, tone: 'neutral' },
              ],
              trailing: (
                <span>
                  {row.scenario}:v{row.scenarioVersion}
                </span>
              ),
            }}
            details={{
              label: 'Portfolio membership',
              text: row.membership.rationale,
              properties: [
                { id: 'coverage', label: 'Coverage', value: String(row.coverage) },
                { id: 'overlap', label: 'Overlap', value: String(row.overlap) },
                { id: 'demand', label: 'Rough demand', value: String(row.demand) },
                { id: 'decision', label: 'Decision', value: row.decision },
              ],
            }}
            ai={{
              hints: ['Challenge ranking', 'Find overlap'],
              disabled: true,
              disabledTooltip: 'AI suggestions require an explicit governed analysis request.',
            }}
            relations={[
              { id: row.id, label: `Initiative ${row.id}`, type: 'initiative' },
              { id: row.scenario, label: `Scenario ${row.scenario}`, type: 'portfolio' },
            ]}
            actions={{
              informational: [
                {
                  id: 'open-workspace',
                  variant: 'neutral',
                  label: 'Otwórz narzędzia portfela',
                  icon: Eye,
                  shortcut: 'O',
                  onClick: () => {
                    if (selected) openWorkspace(selected);
                  },
                },
              ],
            }}
          />
        )}
      >
        <StandardTable
          columns={[
            { id: 'title', label: 'Initiative', sortable: true, width: '28%' },
            { id: 'disposition', label: 'Include state', sortable: true, filterable: true },
            { id: 'rank', label: 'Rank', sortable: true },
            { id: 'confidence', label: 'Confidence', sortable: true, filterable: true },
            { id: 'coverage', label: 'Coverage', sortable: true },
            { id: 'overlap', label: 'Overlap', sortable: true },
            { id: 'demand', label: 'Rough demand', sortable: true },
            { id: 'decision', label: 'Decision', sortable: true },
          ]}
          data={visibleMembershipRows}
          selectedRowId={selectedMembershipId}
          onRowClick={(row) => setSelectedMembershipId(String(row.id))}
          onRowDoubleClick={() => {
            if (selected) openWorkspace(selected);
          }}
          rowMenu={(row) => ({
            primary: [
              {
                id: 'open-workspace',
                label: 'Otwórz narzędzia portfela',
                icon: Eye,
                onClick: () => {
                  if (selected) openWorkspace(selected);
                },
              },
            ],
            universalHandlers: {
              edit: () => {
                if (selected) openWorkspace(selected);
              },
              archiveNote: 'Scenario history is immutable',
            },
            destructive: { note: 'Membership is changed only inside a draft scenario' },
          })}
          persistKey="initiatives.portfolio-memberships.v2"
          empty={{
            title: rows.length ? 'Brak inicjatyw w tym zakresie' : 'Brak wariantów portfela',
            description: rows.length
              ? 'Zmień preset albo otwórz narzędzia wariantu, aby dodać inicjatywy.'
              : 'Utwórz pierwszy wariant, aby zbudować listę inicjatyw portfela.',
          }}
        />
      </TableWithPreviewLayout>
      {draft && (
        <section
          aria-label="Portfolio Scenario Workbench"
          className="min-h-0 border-t border-c-border p-4"
        >
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">
              Scenario Workbench · {draft.scenarioId} v{draft.scenarioVersion}
            </h3>
            <span className="text-xs text-c-text-muted">{draft.status}</span>
            <div className="ml-auto flex gap-2">
              <button
                className="btn-ghost"
                type="button"
                aria-label="Zamknij narzędzia portfela"
                onClick={() => setDraft(null)}
              >
                <X size={15} /> Zamknij
              </button>
              <button
                className="btn-secondary"
                type="button"
                disabled={writeState === 'SAVING' || draft.status !== 'DRAFT'}
                onClick={() =>
                  void write(rows.some((row) => row.id === draft.scenarioId) ? 'UPDATE' : 'CREATE')
                }
              >
                {writeState === 'SAVING' ? (
                  <Loader2 className="animate-spin" size={15} />
                ) : (
                  <Save size={15} />
                )}{' '}
                Save draft
              </button>
              <button
                className="btn-primary"
                type="button"
                disabled={
                  writeState === 'SAVING' ||
                  draft.status !== 'DRAFT' ||
                  !rows.some((row) => row.id === draft.scenarioId)
                }
                onClick={() => void write('PUBLISH')}
              >
                <Send size={15} /> Publish scenario
              </button>
            </div>
          </div>
          <div className="mb-4">
            <StandardTable
              columns={[
                { id: 'title', label: 'Initiative', sortable: true },
                { id: 'disposition', label: 'Include state', sortable: true },
                { id: 'rank', label: 'Rank', sortable: true },
                { id: 'confidence', label: 'Confidence', sortable: true },
                { id: 'coverage', label: 'Coverage', sortable: true },
                { id: 'overlap', label: 'Overlap', sortable: true },
                { id: 'demand', label: 'Rough demand', sortable: true },
              ]}
              data={visibleMembershipRows}
              persistKey="initiatives.portfolio-memberships.v1"
              empty={{
                title: 'No matching initiatives',
                description: 'No initiative matches this preset.',
              }}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="overflow-x-auto">
              <StandardTable
                persistKey="initiatives.portfolio-workbench-memberships.v1"
                data={draft.memberships.map((member) => ({ ...member, id: member.initiativeId }))}
                empty={{ title: 'No initiatives in this scenario' }}
                columns={[
                  {
                    id: 'initiativeId',
                    label: 'Initiative / snapshot',
                    render: (row) => {
                      const member = row as Membership & TableRow;
                      return (
                        <div className="p-2">
                          {initiatives.find((item) => item.id === member.initiativeId)?.name ??
                            member.initiativeId}
                          <input
                            aria-label={`Version ${member.initiativeId}`}
                            className="mt-1 w-20 bg-c-surface p-1"
                            type="number"
                            min={1}
                            value={member.initiativeVersion}
                            onChange={(e) =>
                              updateMembership(member.initiativeId, {
                                initiativeVersion: Number(e.target.value),
                              })
                            }
                          />
                        </div>
                      );
                    },
                  },
                  {
                    id: 'disposition',
                    label: 'Disposition',
                    render: (row) => {
                      const member = row as Membership & TableRow;
                      return (
                        <select
                          aria-label={`Disposition ${member.initiativeId}`}
                          value={member.disposition}
                          onChange={(e) =>
                            updateMembership(member.initiativeId, {
                              disposition: e.target.value as Disposition,
                            })
                          }
                        >
                          <option>INCLUDED</option>
                          <option>CONDITIONAL</option>
                          <option>DEFERRED</option>
                          <option>EXCLUDED</option>
                        </select>
                      );
                    },
                  },
                  {
                    id: 'rank',
                    label: 'Rank',
                    render: (row) => {
                      const member = row as Membership & TableRow;
                      return (
                        <input
                          aria-label={`Rank ${member.initiativeId}`}
                          className="w-16 bg-c-surface p-1"
                          type="number"
                          value={member.rank ?? ''}
                          onChange={(e) =>
                            updateMembership(member.initiativeId, {
                              rank: e.target.value ? Number(e.target.value) : null,
                            })
                          }
                        />
                      );
                    },
                  },
                  {
                    id: 'scoreDecomposition',
                    label: 'Decomposition',
                    render: (row) => {
                      const member = row as Membership & TableRow;
                      return (
                        <div className="text-xs">
                          {Object.entries(member.scoreDecomposition).map(([k, v]) => (
                            <div key={k}>
                              {k}: {v ?? 'Unknown'}
                            </div>
                          ))}
                        </div>
                      );
                    },
                  },
                  {
                    id: 'coverage',
                    label: 'Coverage / overlap',
                    render: (row) => {
                      const member = row as Membership & TableRow;
                      return (
                        <div className="text-xs">
                          {member.coverage.state}
                          <br />
                          {member.overlap.state}
                        </div>
                      );
                    },
                  },
                  {
                    id: 'roughDemand',
                    label: 'Rough demand',
                    render: (row) => {
                      const member = row as Membership & TableRow;
                      return (
                        <div className="text-xs">
                          {member.roughDemand.state === 'UNKNOWN'
                            ? 'Unknown'
                            : `${member.roughDemand.value.low}/${member.roughDemand.value.base}/${member.roughDemand.value.high} ${member.roughDemand.value.unit}`}
                        </div>
                      );
                    },
                  },
                  {
                    id: 'confidence',
                    label: 'Confidence',
                    render: (row) => {
                      const member = row as Membership & TableRow;
                      return (
                        <div>
                          <select
                            aria-label={`Confidence ${member.initiativeId}`}
                            value={member.confidence}
                            onChange={(e) =>
                              updateMembership(member.initiativeId, {
                                confidence: e.target.value as Membership['confidence'],
                              })
                            }
                          >
                            <option>UNKNOWN</option>
                            <option>LOW</option>
                            <option>MEDIUM</option>
                            <option>HIGH</option>
                          </select>
                          <textarea
                            aria-label={`Rationale ${member.initiativeId}`}
                            className="mt-1 w-40 bg-c-surface p-1"
                            value={member.rationale}
                            onChange={(e) =>
                              updateMembership(member.initiativeId, { rationale: e.target.value })
                            }
                          />
                        </div>
                      );
                    },
                  },
                  {
                    id: 'decision',
                    label: 'Decision',
                    render: (row) => {
                      const member = row as Membership & TableRow;
                      return (
                        <div>
                          <button
                            type="button"
                            className="btn-secondary"
                            disabled={
                              draft.status !== 'PUBLISHED' ||
                              !authorityId ||
                              !decisionDueAt ||
                              decisionStatus[member.initiativeId]?.startsWith('PENDING')
                            }
                            onClick={() => void requestDecision(member)}
                          >
                            Request
                          </button>
                          <div className="max-w-32 break-all text-xs">
                            {decisionStatus[member.initiativeId] ?? 'Not requested'}
                          </div>
                        </div>
                      );
                    },
                  },
                ]}
              />
            </div>
            <aside className="space-y-3">
              <h4 className="font-medium">Add / compare</h4>
              <select
                aria-label="Add Initiative"
                className="w-full bg-c-surface p-2"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) addMembership(e.target.value);
                  e.target.value = '';
                }}
              >
                <option value="">Add Initiative…</option>
                {available.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <label className="block text-xs">
                Decision authority
                <input
                  className="mt-1 w-full bg-c-surface p-2"
                  value={authorityId}
                  onChange={(e) => setAuthorityId(e.target.value)}
                />
              </label>
              <label className="block text-xs">
                Decision due
                <input
                  className="mt-1 w-full bg-c-surface p-2"
                  type="datetime-local"
                  value={decisionDueAt}
                  onChange={(e) => setDecisionDueAt(e.target.value)}
                />
              </label>
              <section aria-label="Scenario diff">
                <h4 className="font-medium">Latest diff ({diff.length})</h4>
                {diff.map((change) => (
                  <div
                    key={change.initiativeId}
                    className="mt-1 rounded border border-c-border p-2 text-xs"
                  >
                    {change.initiativeId}: {change.before?.disposition ?? '—'} →{' '}
                    {change.after?.disposition ?? '—'}
                  </div>
                ))}
              </section>
            </aside>
          </div>
        </section>
      )}
    </section>
  );
};
