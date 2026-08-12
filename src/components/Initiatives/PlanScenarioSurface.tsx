import { AlertTriangle, ArrowDown, ArrowUp, Eye, Loader2, Plus, Save, Send, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';
import { StandardPreview } from '@/components/standard/StandardPreview';
import { StandardTable, type TableRow } from '@/components/standard/StandardTable';
import {
  listPlanScenarioRegister,
  readPlanScenario,
  readPlanScenarioDiff,
  RuntimeApiError,
  writePlanScenario,
} from '@/services/initiatives-execution/runtimeApi';

import { type CanonicalMenu3Contract, countPresets } from './canonicalMenu3';

interface WindowDraft {
  initiativeId: string;
  initiativeVersion: number;
  earliest: string | null;
  target: string | null;
  latest: string | null;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  rationale: string;
  dependencySnapshot: string[];
  constraintSnapshot: Array<{ constraintId: string; state: 'KNOWN' | 'UNKNOWN'; detail: string }>;
}
interface PlanScenario {
  scenarioId: string;
  scenarioVersion: number;
  status: 'DRAFT' | 'PUBLISHED' | 'SUPERSEDED';
  portfolioScenarioId: string;
  portfolioScenarioVersion: number;
  windowUnit: string;
  timezone: string;
  periods: Array<{ periodId: string; start: string; end: string }>;
  windows: WindowDraft[];
  assumptions: string[];
  createdBy: string;
  updatedBy: string;
  publishedBy: string | null;
  publishedAt: string | null;
}
interface RegisterRow extends TableRow {
  id: string;
  title: string;
  state: string;
  version: number;
  portfolio: string;
  earliest: string;
  latest: string;
  updatedAt: string;
  timeBasisState: 'KNOWN' | 'UNKNOWN';
}
interface Props extends CanonicalMenu3Contract {
  initiatives: Array<{ id: string; name: string }>;
}
const formatDate = (value: string | null) => {
  if (!value) return 'UNKNOWN';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'UNKNOWN';
  return new Intl.DateTimeFormat('pl-PL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
};

const toInput = (value: string | null) => (value ? value.slice(0, 16) : '');
const toIso = (value: string) => (value ? new Date(value).toISOString() : null);
const parsePeriods = (value: string) => {
  try {
    const parsed = JSON.parse(value) as Array<{ periodId: string; start: string; end: string }>;
    if (!Array.isArray(parsed) || !parsed.length) return null;
    let previousEnd: string | null = null;
    const ids = new Set<string>();
    for (const period of parsed) {
      if (
        !period.periodId?.trim() ||
        ids.has(period.periodId) ||
        !Number.isFinite(Date.parse(period.start)) ||
        !Number.isFinite(Date.parse(period.end)) ||
        period.start >= period.end ||
        (previousEnd !== null && previousEnd > period.start)
      )
        return null;
      ids.add(period.periodId);
      previousEnd = period.end;
    }
    return parsed;
  } catch {
    return null;
  }
};
const knownTimeBasis = (scenario: PlanScenario | null) =>
  Boolean(
    scenario?.windowUnit?.trim() &&
    scenario.timezone?.trim() &&
    Array.isArray(scenario.periods) &&
    scenario.periods.length
  );

const planPresets = [
  'unscheduled',
  'now',
  'next',
  'later',
  'conflicted',
  'missing-dependencies',
  'needs-capacity',
  'ready',
  'published',
] as const;
export const PlanScenarioSurface: React.FC<Props> = ({
  initiatives,
  activePreset,
  onCountsChange,
}) => {
  const [rows, setRows] = useState<RegisterRow[]>([]);
  const [state, setState] = useState<'LOADING' | 'READY' | 'ERROR'>('LOADING');
  const [writeState, setWriteState] = useState<'IDLE' | 'SAVING' | 'CONFLICT' | 'ERROR'>('IDLE');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedWindowId, setSelectedWindowId] = useState<string | null>(null);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [draft, setDraft] = useState<PlanScenario | null>(null);
  const [aggregateVersion, setAggregateVersion] = useState(0);
  const [diff, setDiff] = useState<
    Array<{ initiativeId: string; before: WindowDraft | null; after: WindowDraft | null }>
  >([]);
  const [newId, setNewId] = useState('');
  const [portfolioId, setPortfolioId] = useState('');
  const [portfolioVersion, setPortfolioVersion] = useState(1);
  const [newWindowUnit, setNewWindowUnit] = useState('WEEK');
  const [newTimezone, setNewTimezone] = useState('Europe/Warsaw');
  const [newPeriods, setNewPeriods] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const commandIds = useRef(new Map<string, string>());

  const loadRegister = useCallback(async () => {
    setState('LOADING');
    try {
      const result = (await listPlanScenarioRegister()) as {
        scenarios?: Array<{
          id: string;
          name: string;
          state: string;
          version: number;
          portfolioRef: { scenarioId: string; scenarioVersion: number };
          window: { earliest: string | null; latest: string | null };
          updatedAt: string;
          timeBasis?: {
            windowUnit: string;
            timezone: string;
            periods: Array<{ periodId: string; start: string; end: string }>;
            knowledgeState: 'KNOWN' | 'UNKNOWN';
          };
        }>;
      };
      const nextRows = (result.scenarios ?? []).map((item) => ({
        id: item.id,
        title: item.name,
        state: item.state,
        version: item.version,
        portfolio: `${item.portfolioRef.scenarioId}:v${item.portfolioRef.scenarioVersion}`,
        earliest: item.window.earliest ?? 'Unknown',
        latest: item.window.latest ?? 'Unknown',
        updatedAt: item.updatedAt,
        timeBasisState: item.timeBasis?.knowledgeState ?? 'UNKNOWN',
      }));
      setRows(nextRows);
      if (nextRows.length) {
        const initial = nextRows.find((item) => item.state === 'PUBLISHED') ?? nextRows[0];
        setSelectedId(initial.id);
        const loaded = (await readPlanScenario(initial.id)) as {
          version: number;
          scenario: PlanScenario;
        };
        setAggregateVersion(loaded.version);
        setDraft(
          structuredClone({
            ...loaded.scenario,
            windowUnit: loaded.scenario.windowUnit ?? '',
            timezone: loaded.scenario.timezone ?? '',
            periods: loaded.scenario.periods ?? [],
          })
        );
      }
      setState('READY');
    } catch {
      setState('ERROR');
    }
  }, []);
  useEffect(() => {
    void loadRegister();
  }, [loadRegister]);
  const planWindowRows = useMemo(() => {
    const names = new Map(initiatives.map((item) => [item.id, item.name]));
    return (draft?.windows ?? []).map((window) => {
      const periodIndex =
        draft?.periods.findIndex(
          (period) => window.target && window.target >= period.start && window.target < period.end
        ) ?? -1;
      const unknownConstraint = window.constraintSnapshot.some(
        (constraint) => constraint.state === 'UNKNOWN'
      );
      return {
        id: window.initiativeId,
        title: names.get(window.initiativeId) ?? window.initiativeId,
        target: formatDate(window.target),
        band:
          periodIndex < 0
            ? 'UNSCHEDULED'
            : periodIndex === 0
              ? 'NOW'
              : periodIndex === 1
                ? 'NEXT'
                : 'LATER',
        dependency: window.dependencySnapshot.length ? 'KNOWN' : 'UNKNOWN',
        capacity: unknownConstraint ? 'UNKNOWN' : 'KNOWN',
        confidence: window.confidence,
        conflict: unknownConstraint ? 'UNKNOWN' : 'NONE',
        published: draft?.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
      };
    });
  }, [draft, initiatives]);
  const matchesPlanPreset = (row: (typeof planWindowRows)[number], preset: string) =>
    preset === 'all'
      ? true
      : preset === 'unscheduled'
        ? row.band === 'UNSCHEDULED'
        : preset === 'now'
          ? row.band === 'NOW'
          : preset === 'next'
            ? row.band === 'NEXT'
            : preset === 'later'
              ? row.band === 'LATER'
              : preset === 'conflicted'
                ? row.conflict !== 'NONE'
                : preset === 'missing-dependencies'
                  ? row.dependency === 'UNKNOWN'
                  : preset === 'needs-capacity'
                    ? row.capacity === 'UNKNOWN'
                    : preset === 'ready'
                      ? row.band !== 'UNSCHEDULED' &&
                        row.dependency === 'KNOWN' &&
                        row.capacity === 'KNOWN'
                      : preset === 'published'
                        ? row.published === 'PUBLISHED'
                        : false;
  const effectivePreset = activePreset || 'all';
  const visiblePlanWindows = planWindowRows.filter((row) =>
    matchesPlanPreset(row, effectivePreset)
  );
  useEffect(
    () => onCountsChange?.(countPresets(planWindowRows, planPresets, matchesPlanPreset)),
    [planWindowRows, onCountsChange]
  );

  const open = async (id: string) => {
    setSelectedId(id);
    setWorkspaceOpen(true);
    setWriteState('IDLE');
    try {
      const result = (await readPlanScenario(id)) as { version: number; scenario: PlanScenario };
      setAggregateVersion(result.version);
      setDraft(
        structuredClone({
          ...result.scenario,
          windowUnit: result.scenario.windowUnit ?? '',
          timezone: result.scenario.timezone ?? '',
          periods: result.scenario.periods ?? [],
        })
      );
    } catch {
      setWriteState('ERROR');
    }
  };
  const showWorkspace = () => {
    if (draft && selectedId) setWorkspaceOpen(true);
  };
  const create = () => {
    const periods = parsePeriods(newPeriods);
    if (
      !newId.trim() ||
      !portfolioId.trim() ||
      portfolioVersion < 1 ||
      !newWindowUnit.trim() ||
      !newTimezone.trim() ||
      !periods
    )
      return;
    const scenario: PlanScenario = {
      scenarioId: newId.trim(),
      scenarioVersion: 0,
      status: 'DRAFT',
      portfolioScenarioId: portfolioId.trim(),
      portfolioScenarioVersion: portfolioVersion,
      windowUnit: newWindowUnit.trim(),
      timezone: newTimezone.trim(),
      periods,
      windows: [],
      assumptions: [],
      createdBy: '',
      updatedBy: '',
      publishedBy: null,
      publishedAt: null,
    };
    setSelectedId(scenario.scenarioId);
    setAggregateVersion(0);
    setDraft(scenario);
    setDiff([]);
    setWorkspaceOpen(true);
  };
  const write = async (operation: 'CREATE' | 'UPDATE' | 'PUBLISH') => {
    if (!draft || !knownTimeBasis(draft) || writeState === 'SAVING') {
      if (draft && !knownTimeBasis(draft)) setWriteState('ERROR');
      return;
    }
    setWriteState('SAVING');
    const key = `${draft.scenarioId}:${aggregateVersion}:${operation}`;
    const clientRequestId = commandIds.current.get(key) ?? crypto.randomUUID();
    commandIds.current.set(key, clientRequestId);
    try {
      const result = (await writePlanScenario(draft.scenarioId, {
        expectedVersion: aggregateVersion,
        clientRequestId,
        operation,
        scenario: draft,
      })) as { aggregateVersion: number; response: PlanScenario };
      setAggregateVersion(result.aggregateVersion);
      setDraft(result.response);
      setWriteState('IDLE');
      await loadRegister();
      setSelectedId(result.response.scenarioId);
      if (result.response.scenarioVersion > 1) {
        const d = (await readPlanScenarioDiff(
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
  const updateWindow = (initiativeId: string, patch: Partial<WindowDraft>) =>
    setDraft((current) =>
      current
        ? {
            ...current,
            windows: current.windows.map((window) =>
              window.initiativeId === initiativeId ? { ...window, ...patch } : window
            ),
          }
        : current
    );
  const addWindow = (initiativeId: string) =>
    setDraft((current) =>
      !current || current.windows.some((window) => window.initiativeId === initiativeId)
        ? current
        : {
            ...current,
            windows: [
              ...current.windows,
              {
                initiativeId,
                initiativeVersion: 1,
                earliest: null,
                target: null,
                latest: null,
                confidence: 'UNKNOWN',
                rationale: 'Draft window requires validation',
                dependencySnapshot: [],
                constraintSnapshot: [],
              },
            ],
          }
    );
  const move = (index: number, delta: -1 | 1) =>
    setDraft((current) => {
      if (!current) return current;
      const target = index + delta;
      if (target < 0 || target >= current.windows.length) return current;
      const windows = [...current.windows];
      [windows[index], windows[target]] = [windows[target], windows[index]];
      return { ...current, windows };
    });
  const available = useMemo(
    () =>
      initiatives.filter(
        (item) => !draft?.windows.some((window) => window.initiativeId === item.id)
      ),
    [draft, initiatives]
  );

  if (state === 'LOADING')
    return (
      <div role="status" className="flex items-center gap-2 p-6">
        <Loader2 className="animate-spin" size={16} /> Loading Plan Scenario register
      </div>
    );
  if (state === 'ERROR')
    return (
      <div role="alert" className="m-4 flex items-center justify-between text-c-danger">
        <span>
          <AlertTriangle size={16} className="inline" /> Persistent Plan register is unavailable.
        </span>
        <button type="button" className="btn-secondary" onClick={() => void loadRegister()}>
          Retry
        </button>
      </div>
    );
  return (
    <section aria-label="Plan scenarios" className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-c-border p-3">
        <div>
          <h2 className="font-semibold">Plan inicjatyw</h2>
          <p className="text-sm text-c-text-muted">
            Kolejność, okna czasowe i zależności zatwierdzonego portfela.
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={15} /> Nowy plan
        </button>
      </div>
      {showCreate && (
        <div className="flex flex-wrap items-end gap-2 border-b border-c-border p-3">
          <label className="text-xs">
            Scenario ID
            <input
              aria-label="Plan Scenario ID"
              className="mt-1 block bg-c-surface p-2"
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
            />
          </label>
          <label className="text-xs">
            Published Portfolio Scenario
            <input
              aria-label="Portfolio Scenario ID"
              className="mt-1 block bg-c-surface p-2"
              value={portfolioId}
              onChange={(e) => setPortfolioId(e.target.value)}
            />
          </label>
          <label className="text-xs">
            Exact version
            <input
              aria-label="Portfolio Scenario version"
              className="mt-1 block w-20 bg-c-surface p-2"
              type="number"
              min={1}
              value={portfolioVersion}
              onChange={(e) => setPortfolioVersion(Number(e.target.value))}
            />
          </label>
          <label className="text-xs">
            Window unit
            <input
              aria-label="Plan window unit"
              className="mt-1 block w-24 bg-c-surface p-2"
              value={newWindowUnit}
              onChange={(event) => setNewWindowUnit(event.target.value)}
            />
          </label>
          <label className="text-xs">
            Timezone
            <input
              aria-label="Plan timezone"
              className="mt-1 block min-w-40 bg-c-surface p-2"
              value={newTimezone}
              onChange={(event) => setNewTimezone(event.target.value)}
            />
          </label>
          <label className="min-w-64 flex-1 text-xs">
            Ordered periods JSON
            <textarea
              aria-label="Plan ordered periods"
              className="mt-1 block min-h-16 w-full bg-c-surface p-2 font-mono"
              placeholder='[{"periodId":"2026-W40","start":"...","end":"..."}]'
              value={newPeriods}
              onChange={(event) => setNewPeriods(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn-primary"
            disabled={
              !newId.trim() ||
              !portfolioId.trim() ||
              !newWindowUnit.trim() ||
              !newTimezone.trim() ||
              !parsePeriods(newPeriods)
            }
            onClick={create}
          >
            <Plus size={15} /> Utwórz plan
          </button>
          <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>
            Anuluj
          </button>
        </div>
      )}
      {(writeState === 'ERROR' || writeState === 'CONFLICT') && (
        <div role="alert" className="m-3 text-sm text-c-danger">
          {writeState === 'CONFLICT'
            ? 'Plan changed or its Portfolio basis is stale. Reopen before retrying.'
            : 'Plan operation failed; no Initiative or task date changed.'}
        </div>
      )}
      <div className="flex min-w-0 flex-wrap items-center gap-2 border-b border-c-border px-3 py-2">
        <label className="w-full min-w-0 text-xs text-c-text-muted sm:w-auto">
          Aktywny plan
          <select
            aria-label="Active Plan Scenario"
            className="mt-1 block w-full min-w-0 max-w-full rounded border border-c-border bg-c-surface px-2 py-1 text-sm sm:ml-2 sm:mt-0 sm:inline-block sm:w-auto"
            value={selectedId ?? ''}
            onChange={(event) => {
              const id = event.target.value;
              setSelectedWindowId(null);
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
          <Eye size={15} /> Otwórz narzędzia planu
        </button>
      </div>
      <TableWithPreviewLayout<(typeof planWindowRows)[number]>
        selectedId={selectedWindowId}
        selectedItem={visiblePlanWindows.find((row) => row.id === selectedWindowId) ?? null}
        onSelect={setSelectedWindowId}
        onOpenFull={showWorkspace}
        itemIds={visiblePlanWindows.map((row) => row.id)}
        getItemById={(id) => visiblePlanWindows.find((row) => row.id === id) ?? null}
        previewOpen={!workspaceOpen && Boolean(selectedWindowId)}
        renderPreview={(row) => (
          <StandardPreview
            embedded
            title={row.title}
            onClose={() => setSelectedWindowId(null)}
            onOpenFull={showWorkspace}
            meta={{
              pills: [
                { label: row.band, tone: 'neutral' },
                { label: row.confidence, tone: 'neutral' },
                { label: row.published, tone: 'neutral' },
              ],
              trailing: <span>{row.target}</span>,
            }}
            details={{
              label: 'Plan initiative window',
              text: 'Tentative sequencing only. Opening the tool edits the Plan draft, never Initiative dates.',
              properties: [
                { id: 'window', label: 'Window', value: row.band },
                { id: 'target', label: 'Proposed target', value: row.target },
                { id: 'dependencies', label: 'Dependencies', value: row.dependency },
                { id: 'capacity', label: 'Capacity', value: row.capacity },
                { id: 'conflict', label: 'Conflict', value: row.conflict },
              ],
            }}
            ai={{
              hints: ['Challenge dependencies', 'Compare sequencing'],
              disabled: true,
              disabledTooltip: 'AI suggestions require an explicit governed analysis request.',
            }}
            relations={[
              { id: row.id, label: row.id, type: 'initiative' },
              {
                id: draft?.portfolioScenarioId ?? 'UNKNOWN',
                label: `Portfolio ${draft?.portfolioScenarioId ?? 'UNKNOWN'}:v${draft?.portfolioScenarioVersion ?? 'UNKNOWN'}`,
                type: 'portfolio',
              },
            ]}
            actions={{
              informational: [
                {
                  id: 'open-workspace',
                  variant: 'neutral',
                  label: 'Otwórz narzędzia planu',
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
            { id: 'title', label: 'Initiative', sortable: true, width: '240px' },
            { id: 'band', label: 'Window', sortable: true, filterable: true },
            { id: 'target', label: 'Proposed target', sortable: true },
            { id: 'dependency', label: 'Dependencies', sortable: true, filterable: true },
            { id: 'capacity', label: 'Capacity', sortable: true, filterable: true },
            { id: 'confidence', label: 'Confidence', sortable: true, filterable: true },
            { id: 'conflict', label: 'Conflict', sortable: true, filterable: true },
          ]}
          data={visiblePlanWindows}
          selectedRowId={selectedWindowId}
          onRowClick={(row) => setSelectedWindowId(String(row.id))}
          onRowDoubleClick={showWorkspace}
          rowMenu={(row) => ({
            primary: [
              {
                id: 'open-workspace',
                label: 'Otwórz narzędzia planu',
                icon: Eye,
                onClick: showWorkspace,
              },
            ],
            universalHandlers: {
              preview: () => setSelectedWindowId(String(row.id)),
              edit: showWorkspace,
              archiveNote: 'Published plan history is immutable',
            },
            destructive: { note: 'Plans are superseded, not deleted' },
          })}
          persistKey="initiatives.plan-windows.v2"
          empty={{
            title: 'Brak inicjatyw w tym zakresie',
            description: 'Zmień filtr albo dodaj inicjatywę w narzędziach aktywnego planu.',
          }}
        />
      </TableWithPreviewLayout>
      {draft && workspaceOpen && (
        <section
          aria-label="Plan Scenario Workbench"
          className="min-h-0 border-t border-c-border p-4"
        >
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">
              Plan Workbench · {draft.scenarioId}:v{draft.scenarioVersion}
            </h3>
            <span className="text-xs text-c-text-muted">
              Portfolio {draft.portfolioScenarioId}:v{draft.portfolioScenarioVersion}
            </span>
            <div className="flex w-full flex-wrap gap-2 sm:ml-auto sm:w-auto">
              <button
                type="button"
                className="btn-ghost"
                aria-label="Zamknij narzędzia planu"
                onClick={() => setWorkspaceOpen(false)}
              >
                <X size={15} /> Zamknij
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={
                  draft.status !== 'DRAFT' || !knownTimeBasis(draft) || writeState === 'SAVING'
                }
                onClick={() => void write(aggregateVersion ? 'UPDATE' : 'CREATE')}
              >
                {writeState === 'SAVING' ? (
                  <Loader2 className="animate-spin" size={15} />
                ) : (
                  <Save size={15} />
                )}{' '}
                Save draft
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={
                  !aggregateVersion ||
                  draft.status !== 'DRAFT' ||
                  !knownTimeBasis(draft) ||
                  writeState === 'SAVING'
                }
                onClick={() => void write('PUBLISH')}
              >
                <Send size={15} /> Publish Plan Scenario
              </button>
            </div>
          </div>
          <div className="mb-4">
            <StandardTable
              columns={[
                { id: 'title', label: 'Initiative', sortable: true },
                { id: 'band', label: 'Window', sortable: true },
                { id: 'target', label: 'Proposed window', sortable: true },
                { id: 'dependency', label: 'Dependencies', sortable: true },
                { id: 'capacity', label: 'Capacity', sortable: true },
                { id: 'confidence', label: 'Confidence', sortable: true },
                { id: 'conflict', label: 'Conflict', sortable: true },
              ]}
              data={visiblePlanWindows}
              persistKey="initiatives.plan-windows.v1"
              empty={{
                title: 'No matching plan windows',
                description: 'No initiative matches this preset.',
              }}
            />
          </div>
          <fieldset className="mb-4 grid grid-cols-1 gap-3 rounded-md border border-c-border p-3 sm:grid-cols-2 xl:grid-cols-[10rem_16rem_minmax(0,1fr)]">
            <legend className="px-1 text-sm font-medium">Canonical time basis</legend>
            <label className="text-xs">
              Window unit
              <input
                aria-label="Workbench Plan window unit"
                className="mt-1 block w-full bg-c-surface p-2"
                value={draft.windowUnit}
                onChange={(event) =>
                  setDraft((current) =>
                    current ? { ...current, windowUnit: event.target.value } : current
                  )
                }
              />
            </label>
            <label className="text-xs">
              Timezone
              <input
                aria-label="Workbench Plan timezone"
                className="mt-1 block w-full bg-c-surface p-2"
                value={draft.timezone}
                onChange={(event) =>
                  setDraft((current) =>
                    current ? { ...current, timezone: event.target.value } : current
                  )
                }
              />
            </label>
            <label className="text-xs">
              Ordered periods JSON
              <textarea
                aria-label="Workbench Plan ordered periods"
                className="mt-1 block min-h-20 w-full bg-c-surface p-2 font-mono"
                value={JSON.stringify(draft.periods, null, 2)}
                onChange={(event) => {
                  const periods = parsePeriods(event.target.value);
                  if (periods) setDraft((current) => (current ? { ...current, periods } : current));
                }}
              />
            </label>
          </fieldset>
          {!knownTimeBasis(draft) && (
            <p role="alert" className="mb-4 text-sm text-c-danger">
              UNKNOWN time basis — exact window unit, timezone and ordered periods are required;
              save and publish remain blocked.
            </p>
          )}
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="overflow-x-auto">
              <StandardTable
                persistKey="initiatives.plan-workbench-windows.v1"
                data={draft.windows.map((window, index) => ({
                  ...window,
                  id: window.initiativeId,
                  order: index,
                }))}
                empty={{ title: 'No initiatives in this plan' }}
                columns={[
                  {
                    id: 'order',
                    label: 'Order / Initiative snapshot',
                    render: (row) => {
                      const window = row as WindowDraft & TableRow & { order: number };
                      const index = window.order;
                      return (
                        <div className="p-2">
                          <div className="flex gap-1">
                            <button
                              aria-label={`Move ${window.initiativeId} up`}
                              type="button"
                              onClick={() => move(index, -1)}
                            >
                              <ArrowUp size={14} />
                            </button>
                            <button
                              aria-label={`Move ${window.initiativeId} down`}
                              type="button"
                              onClick={() => move(index, 1)}
                            >
                              <ArrowDown size={14} />
                            </button>
                          </div>
                          {initiatives.find((item) => item.id === window.initiativeId)?.name ??
                            window.initiativeId}
                          <input
                            aria-label={`Initiative version ${window.initiativeId}`}
                            className="mt-1 block w-20 bg-c-surface p-1"
                            type="number"
                            min={1}
                            value={window.initiativeVersion}
                            onChange={(e) =>
                              updateWindow(window.initiativeId, {
                                initiativeVersion: Number(e.target.value),
                              })
                            }
                          />
                        </div>
                      );
                    },
                  },
                  {
                    id: 'target',
                    label: 'Draft window earliest / target / latest',
                    render: (row) => {
                      const window = row as WindowDraft & TableRow;
                      return (
                        <div className="p-2">
                          {(['earliest', 'target', 'latest'] as const).map((key) => (
                            <input
                              key={key}
                              aria-label={`${key} ${window.initiativeId}`}
                              className="mb-1 block bg-c-surface p-1"
                              type="datetime-local"
                              value={toInput(window[key])}
                              onChange={(e) =>
                                updateWindow(window.initiativeId, { [key]: toIso(e.target.value) })
                              }
                            />
                          ))}
                        </div>
                      );
                    },
                  },
                  {
                    id: 'confidence',
                    label: 'Confidence / rationale',
                    render: (row) => {
                      const window = row as WindowDraft & TableRow;
                      return (
                        <div>
                          <select
                            aria-label={`Confidence ${window.initiativeId}`}
                            value={window.confidence}
                            onChange={(e) =>
                              updateWindow(window.initiativeId, {
                                confidence: e.target.value as WindowDraft['confidence'],
                              })
                            }
                          >
                            <option>UNKNOWN</option>
                            <option>LOW</option>
                            <option>MEDIUM</option>
                            <option>HIGH</option>
                          </select>
                          <textarea
                            aria-label={`Window rationale ${window.initiativeId}`}
                            className="mt-1 block bg-c-surface p-1"
                            value={window.rationale}
                            onChange={(e) =>
                              updateWindow(window.initiativeId, { rationale: e.target.value })
                            }
                          />
                        </div>
                      );
                    },
                  },
                  {
                    id: 'dependencySnapshot',
                    label: 'Dependencies',
                    render: (row) => {
                      const window = row as WindowDraft & TableRow;
                      return (
                        <textarea
                          aria-label={`Dependencies ${window.initiativeId}`}
                          className="bg-c-surface p-1"
                          value={window.dependencySnapshot.join('\n')}
                          onChange={(e) =>
                            updateWindow(window.initiativeId, {
                              dependencySnapshot: e.target.value
                                .split('\n')
                                .map((v) => v.trim())
                                .filter(Boolean),
                            })
                          }
                        />
                      );
                    },
                  },
                  {
                    id: 'constraintSnapshot',
                    label: 'Constraints',
                    render: (row) => {
                      const window = row as WindowDraft & TableRow;
                      return (
                        <div>
                          {window.constraintSnapshot.map((constraint) => (
                            <div key={constraint.constraintId} className="text-xs">
                              {constraint.state}: {constraint.detail}
                            </div>
                          ))}
                          <button
                            type="button"
                            className="btn-secondary mt-1"
                            onClick={() =>
                              updateWindow(window.initiativeId, {
                                constraintSnapshot: [
                                  ...window.constraintSnapshot,
                                  {
                                    constraintId: crypto.randomUUID(),
                                    state: 'UNKNOWN',
                                    detail: 'Constraint requires validation',
                                  },
                                ],
                              })
                            }
                          >
                            Add constraint
                          </button>
                        </div>
                      );
                    },
                  },
                ]}
              />
            </div>
            <aside className="space-y-3">
              <h4 className="font-medium">Scenario controls</h4>
              <select
                aria-label="Add Plan Initiative"
                className="w-full bg-c-surface p-2"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) addWindow(e.target.value);
                  e.target.value = '';
                }}
              >
                <option value="">Add approved Initiative…</option>
                {available.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <label className="block text-xs">
                Assumptions
                <textarea
                  aria-label="Plan assumptions"
                  className="mt-1 min-h-24 w-full bg-c-surface p-2"
                  value={draft.assumptions.join('\n')}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      assumptions: e.target.value
                        .split('\n')
                        .map((v) => v.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </label>
              <section aria-label="Plan diff">
                <h4 className="font-medium">Latest diff ({diff.length})</h4>
                {diff.map((change) => (
                  <div
                    key={change.initiativeId}
                    className="mt-1 rounded border border-c-border p-2 text-xs"
                  >
                    {change.initiativeId}: {change.before?.target ?? '—'} →{' '}
                    {change.after?.target ?? '—'}
                  </div>
                ))}
              </section>
              <p className="text-xs text-c-text-muted">
                Move only reorders this draft. Publish creates governed Plan Scenario truth; it
                never baselines or writes Initiative/task dates.
              </p>
            </aside>
          </div>
        </section>
      )}
    </section>
  );
};
