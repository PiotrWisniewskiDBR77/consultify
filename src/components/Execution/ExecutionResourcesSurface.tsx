import { ArrowRight, Eye } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';
import { StandardPreview, StandardTable, type TableColumn } from '@/components/standard';
import { persistentCommandId } from '@/services/initiatives-execution/persistentCommandId';
import {
  listExecutionCases,
  proposeOperationalAllocation,
  readExecutionCase,
  readExecutionWork,
  readOperationalAllocations,
  simulateOperationalAllocation,
  transitionOperationalAllocation,
} from '@/services/initiatives-execution/runtimeApi';

import { countExecutionPresets, type ExecutionMenu3Contract } from './canonicalMenu3';
const resourcePresets = [
  'all',
  'overallocated',
  'unassigned',
  'skill-gaps',
  'unconfirmed',
  'unknown',
  'cost-risk',
  'needs-decision',
  'team',
  'initiative',
] as const;
const allocationSourceSummary = (item: any) => {
  const refs = [
    ['Dostępność', item.availabilityRef],
    ['Kalendarz', item.calendarRef],
    ['Pozostała praca', item.remainingEstimateRef],
  ]
    .filter(([, source]) => source?.ref)
    .map(
      ([label, source]) =>
        `${label}: ${source.ref}@v${source.version ?? 'UNKNOWN'} · ${source.knowledgeState ?? 'UNKNOWN'}`
    );
  if (item.costRef?.ref)
    refs.push(`Koszt: ${item.costRef.ref}@v${item.costRef.version ?? 'UNKNOWN'}`);
  return refs.length ? refs.join(' · ') : 'EVIDENCE_MISSING';
};
export const ExecutionResourcesSurface = ({
  activePreset,
  onCountsChange,
}: ExecutionMenu3Contract) => {
  const [cases, setCases] = useState<any[]>([]),
    [caseId, setCaseId] = useState(''),
    [caseVersion, setCaseVersion] = useState(1),
    [taskVersion, setTaskVersion] = useState(1),
    [items, setItems] = useState<any[]>([]),
    [selected, setSelected] = useState<any | null>(null),
    [showWorkspace, setShowWorkspace] = useState(false),
    [json, setJson] = useState(''),
    [showProposal, setShowProposal] = useState(false),
    [assessment, setAssessment] = useState<any | null>(null),
    [rationale, setRationale] = useState(''),
    [conditions, setConditions] = useState(''),
    [state, setState] = useState<'LOADING' | 'READY' | 'ERROR'>('LOADING');
  const loadCases = useCallback(async () => {
    setState('LOADING');
    try {
      const body = (await listExecutionCases()) as any;
      const nextCases = body.cases ?? [];
      setCases(nextCases);
      const allocationSets = await Promise.all(
        nextCases.map(async (executionCase: any) => {
          const [result, work] = (await Promise.all([
            readOperationalAllocations(executionCase.executionCaseId),
            readExecutionWork(executionCase.executionCaseId),
          ])) as any[];
          return (result.items ?? []).map((item: any) => ({
            ...item,
            executionCaseId: executionCase.executionCaseId,
            taskTitle: (work.tasks ?? []).find((task: any) => task.taskId === item.taskId)?.title,
          }));
        })
      );
      setItems(allocationSets.flat());
      setState('READY');
    } catch {
      setState('ERROR');
    }
  }, []);
  useEffect(() => {
    void loadCases();
  }, [loadCases]);
  const load = async (id: string, focusAllocationId?: string) => {
    setCaseId(id);
    setState('LOADING');
    try {
      const [c, a, work] = (await Promise.all([
        readExecutionCase(id),
        readOperationalAllocations(id),
        readExecutionWork(id),
      ])) as any[];
      setCaseVersion(c.version);
      const nextItems = (a.items ?? []).map((item: any) => ({ ...item, executionCaseId: id }));
      setItems(nextItems);
      const selectedAllocationId = focusAllocationId ?? selected?.allocationId;
      if (selectedAllocationId) {
        const nextSelected = nextItems.find(
          (item: any) => item.allocationId === selectedAllocationId
        );
        setSelected(nextSelected ?? null);
        const task = nextSelected
          ? (work.tasks ?? []).find((item: any) => item.taskId === nextSelected.taskId)
          : null;
        if (task) setTaskVersion(task.version);
      }
      setState('READY');
    } catch {
      setState('ERROR');
    }
  };
  const columns: TableColumn[] = [
    { id: 'assigneeId', label: 'Osoba', sortable: true, width: '220px' },
    { id: 'taskTitle', label: 'Zadanie', sortable: true, width: '280px' },
    { id: 'status', label: 'Status', sortable: true, filterable: true, width: '160px' },
    { id: 'periodLabel', label: 'Okres', width: '180px' },
    { id: 'demandLabel', label: 'Zapotrzebowanie', width: '150px' },
    { id: 'evidenceLabel', label: 'Dane', width: '140px' },
  ];
  const tableItems = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        id: item.allocationId,
        title: item.assigneeId || 'Nieprzypisana osoba',
        description: item.taskTitle || `Zadanie ${String(item.taskId || '').slice(-8)}`,
        taskTitle: item.taskTitle || `Zadanie · ${String(item.taskId || '').slice(-8)}`,
        periodLabel: item.timeBasis?.window || item.timeBasis?.windowUnit || '—',
        demandLabel:
          item.demand?.knowledgeState === 'UNKNOWN'
            ? 'Brak danych'
            : (item.demand?.base ?? item.demand?.value ?? '—'),
        evidenceLabel: item.demand?.knowledgeState || '—',
      })),
    [items]
  );
  const matches = useCallback((row: any, preset: string) => {
    if (preset === 'all') return true;
    if (preset === 'overallocated')
      return row.assessment?.state === 'OVERALLOCATED' || row.load?.high > 1;
    if (preset === 'unassigned') return !row.assigneeId;
    if (preset === 'skill-gaps') return row.skillMatch?.state === 'GAP';
    if (preset === 'unconfirmed')
      return !['CONFIRMED', 'ACTIVE'].includes(String(row.status).toUpperCase());
    if (preset === 'unknown')
      return (
        row.availability?.knowledgeState === 'UNKNOWN' || row.demand?.knowledgeState === 'UNKNOWN'
      );
    if (preset === 'cost-risk')
      return row.cost?.knowledgeState === 'UNKNOWN' || row.cost?.risk === true;
    if (preset === 'needs-decision')
      return ['REQUESTED', 'ACCEPTED', 'CONDITIONAL'].includes(String(row.status).toUpperCase());
    if (preset === 'team') return Boolean(row.teamId);
    if (preset === 'initiative') return Boolean(row.initiativeId);
    return false;
  }, []);
  const visibleItems = useMemo(
    () => tableItems.filter((row) => matches(row, activePreset ?? 'all')),
    [activePreset, matches, tableItems]
  );
  useEffect(
    () => onCountsChange?.(countExecutionPresets(tableItems, resourcePresets, matches)),
    [matches, onCountsChange, tableItems]
  );
  const propose = async () => {
    const p = JSON.parse(json),
      work = (await readExecutionWork(caseId)) as any;
    const task = work.tasks.find((t: any) => t.taskId === p.taskId);
    setTaskVersion(task.version);
    await proposeOperationalAllocation(caseId, p.taskId, p.allocationId, {
      ...p,
      expectedVersion: 0,
      expectedCaseVersion: caseVersion,
      expectedTaskVersion: task.version,
      clientRequestId: persistentCommandId(
        'execution-resources',
        `${caseId}:${caseVersion}:${task.version}:propose:${p.allocationId}:${json}`
      ),
    });
    await load(caseId, p.allocationId);
  };
  const simulate = async () => {
    const p = JSON.parse(json);
    setAssessment(
      await simulateOperationalAllocation({ allocation: p, expectedTimeBasis: p.timeBasis })
    );
  };
  const transition = async (action: string) => {
    if (!selected) return;
    const result = (await transitionOperationalAllocation(selected.allocationId, {
      expectedVersion: selected.version,
      expectedCaseVersion: caseVersion,
      expectedTaskVersion: taskVersion,
      clientRequestId: persistentCommandId(
        'execution-resources',
        `${selected.allocationId}:${selected.version}:${caseVersion}:${taskVersion}:${action}:${rationale}:${conditions}`
      ),
      action,
      rationale,
      conditions: conditions.split('\n').filter(Boolean),
      expectedTimeBasis: selected.timeBasis,
    })) as any;
    setAssessment(result.response?.assessment ?? assessment);
    await load(caseId, selected.allocationId);
  };
  const openWorkspace = async (item: any) => {
    if (caseId !== item.executionCaseId) await load(item.executionCaseId, item.allocationId);
    setSelected(item);
    setShowWorkspace(true);
  };
  if (state === 'ERROR')
    return (
      <div role="alert" className="m-4 rounded-xl border border-c-danger/40 p-4 text-sm">
        <p>Nie udało się załadować rejestru zasobów.</p>
        <button
          type="button"
          className="btn-secondary mt-3"
          onClick={() => (caseId ? void load(caseId) : void loadCases())}
        >
          Spróbuj ponownie
        </button>
      </div>
    );
  return (
    <section aria-label="Execution Resources" className="p-4">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-semibold">Zasoby</h2>
          <p className="text-sm text-c-text-muted">
            Przydziały ze wszystkich dostępnych realizacji; wybór realizacji zawęża listę.
          </p>
        </div>
        {caseId && (
          <button className="btn-secondary" onClick={() => setShowProposal(true)}>
            Zaproponuj przydział
          </button>
        )}
      </div>
      <label className="block max-w-md text-xs font-medium text-c-text-muted">
        Filtr realizacji
        <select
          aria-label="Execution Case for resources"
          value={caseId}
          onChange={(e) => {
            const nextCaseId = e.target.value;
            if (nextCaseId) void load(nextCaseId);
            else {
              setCaseId('');
              setSelected(null);
              setShowWorkspace(false);
              void loadCases();
            }
          }}
          className="mt-1 block w-full rounded-lg border border-c-border bg-c-surface px-3 py-2 text-sm"
        >
          <option value="">Wszystkie realizacje</option>
          {cases.map((c) => (
            <option key={c.executionCaseId} value={c.executionCaseId}>
              {c.initiativeTitle ||
                c.title ||
                `Realizacja · ${String(c.executionCaseId).slice(-8)}`}
            </option>
          ))}
        </select>
      </label>
      {state === 'READY' && items.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-c-border p-8 text-center text-sm text-c-text-muted">
          Brak kanonicznych przydziałów zasobów w dostępnych realizacjach.
        </div>
      ) : state === 'READY' ? (
        <div className="mt-4">
          <TableWithPreviewLayout<any>
            selectedId={selected?.allocationId ?? null}
            selectedItem={selected}
            onSelect={(id) => {
              setSelected(items.find((item) => item.allocationId === id) ?? null);
              setShowWorkspace(false);
            }}
            onOpenFull={(id) => {
              const item = items.find((candidate) => candidate.allocationId === id);
              if (item) void openWorkspace(item);
            }}
            itemIds={items.map((item) => item.allocationId)}
            getItemById={(id) => items.find((item) => item.allocationId === id) ?? null}
            previewOpen={!showWorkspace && Boolean(selected)}
            renderPreview={(item) => (
              <StandardPreview
                embedded
                title={item.assigneeId || 'Nieprzypisana osoba'}
                onClose={() => setSelected(null)}
                onOpenFull={() => void openWorkspace(item)}
                openLabel="Otwórz przydział"
                meta={{
                  pills: [
                    { label: item.status, tone: item.status === 'CONFIRMED' ? 'success' : 'info' },
                    { label: item.demand?.knowledgeState || 'UNKNOWN', tone: 'neutral' },
                  ],
                  trailing: <span className="text-xs">v{item.version}</span>,
                  recommendation: item.nextAction ?? 'Zweryfikuj dostępność i akceptację.',
                }}
                details={{
                  label: 'Szczegóły przydziału',
                  text: item.rationale || 'Brak dodatkowego opisu.',
                  properties: [
                    {
                      id: 'task',
                      label: 'Zadanie',
                      value: item.taskTitle || item.taskId || 'UNKNOWN',
                    },
                    {
                      id: 'period',
                      label: 'Okres',
                      value: item.timeBasis?.window || item.timeBasis?.windowUnit || 'UNKNOWN',
                    },
                    {
                      id: 'demand',
                      label: 'Zapotrzebowanie',
                      value:
                        item.demand?.knowledgeState === 'UNKNOWN'
                          ? 'UNKNOWN'
                          : String(item.demand?.base ?? item.demand?.value ?? 'UNKNOWN'),
                    },
                    {
                      id: 'evidence',
                      label: 'Źródła',
                      value: allocationSourceSummary(item),
                    },
                  ],
                  onCopy: () => void navigator.clipboard?.writeText(item.allocationId),
                }}
                relations={[
                  { label: `Realizacja · ${item.executionCaseId}`, onClick: () => undefined },
                  { label: `Zadanie · ${item.taskId || 'UNKNOWN'}`, onClick: () => undefined },
                ]}
                relationsEmptyLabel="Brak powiązań"
                actions={{
                  informational: [
                    {
                      id: 'open',
                      label: 'Otwórz przydział',
                      variant: 'positive',
                      icon: Eye,
                      shortcut: 'O',
                      onClick: () => void openWorkspace(item),
                    },
                  ],
                }}
              />
            )}
          >
            <StandardTable
              columns={columns}
              data={visibleItems}
              selectedRowId={selected?.allocationId ?? null}
              onRowClick={async (row) => {
                const item = items.find((candidate) => candidate.allocationId === row.id) ?? null;
                setSelected(item);
                setShowWorkspace(false);
                const work = (await readExecutionWork(item?.executionCaseId)) as any;
                const task = (work.tasks ?? []).find(
                  (candidate: any) => candidate.taskId === item?.taskId
                );
                if (task) setTaskVersion(task.version);
              }}
              onRowDoubleClick={(row) => {
                const item = items.find((candidate) => candidate.allocationId === row.id);
                if (item) void openWorkspace(item);
              }}
              rowMenu={(row) => ({
                primary: [
                  {
                    id: 'open',
                    label: 'Otwórz przydział',
                    icon: ArrowRight,
                    onClick: () => {
                      const item = items.find((candidate) => candidate.allocationId === row.id);
                      if (item) void openWorkspace(item);
                    },
                  },
                ],
                universalHandlers: {
                  preview: () => {
                    setSelected(items.find((item) => item.allocationId === row.id) ?? null);
                    setShowWorkspace(false);
                  },
                  archiveNote: 'Przydział pozostaje częścią audytowalnej realizacji.',
                },
                destructive: {
                  label: 'Usuń',
                  note: 'Kanoniczny przydział nie może zostać usunięty.',
                },
              })}
              persistKey="execution.resources.canonical-register.v3"
            />
          </TableWithPreviewLayout>
        </div>
      ) : null}
      {showWorkspace && selected && (
        <section
          aria-label="Operational Allocation workspace"
          className="mt-4 rounded border border-c-border p-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Przydział {selected.allocationId}</h3>
              <p className="text-xs text-c-text-muted">
                {selected.status} · {selected.assigneeId || 'UNKNOWN'}
              </p>
            </div>
            <button className="btn-secondary" onClick={() => setShowWorkspace(false)}>
              Zamknij workspace
            </button>
          </div>
          <p className="mt-3 text-sm">Zadanie {selected.taskTitle || selected.taskId}</p>
          <p className="text-sm">
            Dane {selected.demand?.knowledgeState || 'UNKNOWN'} · okres{' '}
            {selected.timeBasis?.window || selected.timeBasis?.windowUnit || 'UNKNOWN'}
          </p>
        </section>
      )}
      {showProposal && caseId && (
        <section
          aria-label="Operational Allocation Workbench"
          className="mt-4 rounded border border-c-border p-4"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">Propozycja przydziału</h3>
              <p className="text-xs text-c-text-muted">
                Najpierw symulacja, potem zatwierdzany przydział.
              </p>
            </div>
            <button className="btn-secondary" onClick={() => setShowProposal(false)}>
              Zamknij
            </button>
          </div>
          <details>
            <summary className="cursor-pointer text-sm font-medium">Dane zaawansowane</summary>
            <textarea
              aria-label="Operational Allocation proposal JSON"
              className="min-h-40 w-full rounded border border-c-border bg-c-surface p-2 font-mono text-xs"
              value={json}
              onChange={(e) => setJson(e.target.value)}
            />
          </details>
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" onClick={() => void simulate()}>
              Symuluj
            </button>
            <button className="btn-secondary" onClick={() => void propose()}>
              Zapisz propozycję
            </button>
          </div>
          {assessment && (
            <div role="status">
              <strong>{assessment.state}</strong>
              <p>{assessment.findings?.join(', ') || 'READY'}</p>
            </div>
          )}
          <textarea
            aria-label="Allocation rationale"
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
          />
          <textarea
            aria-label="Allocation conditions"
            value={conditions}
            onChange={(e) => setConditions(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            {[
              'REQUEST',
              'ASSIGNEE_ACCEPT',
              'ASSIGNEE_DECLINE',
              'RM_CONFIRM',
              'RM_CONDITIONAL',
              'RM_DECLINE',
            ].map((a) => (
              <button key={a} className="btn-secondary" onClick={() => void transition(a)}>
                {
                  {
                    REQUEST: 'Przekaż do akceptacji',
                    ASSIGNEE_ACCEPT: 'Akceptuj przydział',
                    ASSIGNEE_DECLINE: 'Odrzuć przydział',
                    RM_CONFIRM: 'Potwierdź',
                    RM_CONDITIONAL: 'Potwierdź warunkowo',
                    RM_DECLINE: 'Odrzuć',
                  }[a]
                }
              </button>
            ))}
          </div>
          {assessment?.state === 'EVIDENCE_MISSING' && (
            <p role="alert">EVIDENCE_MISSING — activation remains blocked.</p>
          )}
        </section>
      )}
    </section>
  );
};
