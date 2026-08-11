import { ArrowRight, Eye } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { CanonicalWorkHardeningPanel } from '@/components/shared/CanonicalWorkHardeningPanel';
import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';
import { TaskMilestoneBlastRadius } from '@/components/shared/TaskMilestoneBlastRadius';
import { StandardPreview } from '@/components/standard/StandardPreview';
import {
  StandardTable,
  type TableColumn,
  type TableRow,
} from '@/components/standard/StandardTable';
import { persistentCommandId } from '@/services/initiatives-execution/persistentCommandId';
import {
  completeExecutionTask,
  createExecutionDecision,
  createExecutionMilestone,
  createExecutionTask,
  decideExecutionDecision,
  listExecutionCases,
  readExecutionCase,
  readExecutionMilestones,
  readExecutionWork,
  requestExecutionDecision,
  updateExecutionTask,
} from '@/services/initiatives-execution/runtimeApi';
import { useAppStore } from '@/store/useAppStore';

import { countExecutionPresets, type ExecutionMenu3Contract } from './canonicalMenu3';
type WorkKind = 'TASK' | 'DECISION';
interface Row extends TableRow {
  id: string;
  title: string;
  kind: WorkKind;
  status: string;
  owner: string;
  dueAt: string;
  rawDueAt: string | null;
  version: number;
  executionCaseId: string;
  initiativeId: string;
  source: any;
}
interface Milestone {
  milestoneId: string;
  version: number;
  executionCaseId: string;
  initiativeId: string;
  baselineRef: { ref: string; version: number };
  title: string;
  ownerId: string;
  targetAt: string | null;
  forecastAt: string | null;
  status: string;
  readiness: string;
  forecastVarianceDays: number | null;
  evidenceRefs: string[];
  sourceVersions: { executionCaseVersion: number; baselineVersion: number };
}
const cols: TableColumn[] = [
  { id: 'title', label: 'Work item', sortable: true, width: '240px' },
  { id: 'kind', label: 'Type', sortable: true, filterable: true },
  { id: 'status', label: 'Status', sortable: true },
  { id: 'owner', label: 'Owner / authority', sortable: true },
  { id: 'dueAt', label: 'Due / SLA', sortable: true },
];
const workPresets = [
  'all',
  'tasks',
  'decisions',
  'blocked',
  'overdue',
  'due-soon',
  'missing-owner',
  'missing-evidence',
  'waiting',
  'mine',
  'team',
] as const;
const formatDateTime = (value: string | null | undefined) => {
  if (!value) return 'UNKNOWN';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'UNKNOWN';
  return new Intl.DateTimeFormat('pl-PL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
};
export const ExecutionWorkSurface = ({ activePreset, onCountsChange }: ExecutionMenu3Contract) => {
  const actorId = useAppStore((store) => store.currentUser?.id ?? null);
  const [cases, setCases] = useState<Array<any>>([]),
    [caseId, setCaseId] = useState(''),
    [caseVersion, setCaseVersion] = useState(1),
    [initiativeId, setInitiativeId] = useState(''),
    [baselineRef, setBaselineRef] = useState({ ref: '', version: 0 }),
    [milestones, setMilestones] = useState<Milestone[]>([]),
    [milestoneForm, setMilestoneForm] = useState({
      id: '',
      title: '',
      ownerId: '',
      targetAt: '',
      forecastAt: '',
      evidenceRefs: '',
    }),
    [rows, setRows] = useState<Row[]>([]),
    [selectedId, setSelectedId] = useState<string | null>(null),
    [showWorkspace, setShowWorkspace] = useState(false),
    [toolMode, setToolMode] = useState<'NONE' | 'MILESTONE' | 'TASK' | 'DECISION'>('NONE'),
    [form, setForm] = useState({
      id: '',
      title: '',
      description: '',
      assigneeId: '',
      ownerId: '',
      authorityId: '',
      dueAt: '',
      slaAt: '',
      evidenceRefs: '',
      blockers: '',
      dependencies: '',
      milestoneIds: '',
      rationale: '',
      conditions: '',
    }),
    [state, setState] = useState<'READY' | 'LOADING' | 'ERROR'>('LOADING');
  const loadCases = useCallback(async () => {
    setState('LOADING');
    try {
      const body = (await listExecutionCases()) as any;
      const nextCases = body.cases ?? [];
      setCases(nextCases);
      const workSets = await Promise.all(
        nextCases.map(async (executionCase: any) => {
          const work = (await readExecutionWork(executionCase.executionCaseId)) as any;
          return [
            ...(work.tasks ?? []).map((item: any) => ({
              id: item.taskId,
              title: item.title,
              kind: 'TASK' as const,
              status: item.status,
              owner: item.assigneeId,
              dueAt: `${formatDateTime(item.dueAt)} · SLA ${formatDateTime(item.slaAt)}`,
              rawDueAt: item.dueAt ?? null,
              version: item.version,
              executionCaseId: executionCase.executionCaseId,
              initiativeId: executionCase.initiativeId,
              source: item,
            })),
            ...(work.decisions ?? []).map((item: any) => ({
              id: item.decisionId,
              title: item.title,
              kind: 'DECISION' as const,
              status: item.status,
              owner: item.authorityId,
              dueAt: formatDateTime(item.dueAt),
              rawDueAt: item.dueAt ?? null,
              version: item.version,
              executionCaseId: executionCase.executionCaseId,
              initiativeId: executionCase.initiativeId,
              source: item,
            })),
          ];
        })
      );
      setRows(workSets.flat());
      setState('READY');
    } catch {
      setState('ERROR');
    }
  }, []);
  useEffect(() => {
    void loadCases();
  }, [loadCases]);
  const load = async (id: string) => {
    setCaseId(id);
    setState('LOADING');
    try {
      const [c, w, m] = (await Promise.all([
        readExecutionCase(id),
        readExecutionWork(id),
        readExecutionMilestones(id),
      ])) as any[];
      setCaseVersion(c.version);
      setInitiativeId(c.detail.initiativeId);
      setBaselineRef({
        ref: c.detail.handoffPackageId ?? '',
        version: Number(c.detail.handoffPackageVersion ?? 0),
      });
      setMilestones(m.items ?? []);
      setRows([
        ...(w.tasks ?? []).map((x: any) => ({
          id: x.taskId,
          title: x.title,
          kind: 'TASK',
          status: x.status,
          owner: x.assigneeId,
          dueAt: `${formatDateTime(x.dueAt)} · SLA ${formatDateTime(x.slaAt)}`,
          rawDueAt: x.dueAt ?? null,
          version: x.version,
          executionCaseId: id,
          initiativeId: c.detail.initiativeId,
          source: x,
        })),
        ...(w.decisions ?? []).map((x: any) => ({
          id: x.decisionId,
          title: x.title,
          kind: 'DECISION',
          status: x.status,
          owner: x.authorityId,
          dueAt: formatDateTime(x.dueAt),
          rawDueAt: x.dueAt ?? null,
          version: x.version,
          executionCaseId: id,
          initiativeId: c.detail.initiativeId,
          source: x,
        })),
      ]);
      setState('READY');
    } catch {
      setState('ERROR');
    }
  };
  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);
  const formFromRow = (row: Row) => {
    const source = row.source ?? {};
    return {
      id: row.id,
      title: source.title ?? row.title ?? '',
      description: source.description ?? '',
      assigneeId: source.assigneeId ?? '',
      ownerId: source.ownerId ?? '',
      authorityId: source.authorityId ?? '',
      dueAt: source.dueAt ?? '',
      slaAt: source.slaAt ?? '',
      evidenceRefs: (source.evidenceRefs ?? []).join('\n'),
      blockers: (source.blockerDecisionIds ?? source.blockers ?? []).join('\n'),
      dependencies: (source.dependencyTaskIds ?? source.dependencies ?? []).join('\n'),
      milestoneIds: (source.milestoneIds ?? []).join('\n'),
      rationale: source.rationale ?? '',
      conditions: (source.conditions ?? []).join('\n'),
    };
  };
  const openWorkspace = async (row: Row) => {
    if (caseId !== row.executionCaseId) await load(row.executionCaseId);
    setSelectedId(row.id);
    setShowWorkspace(true);
    setToolMode(row.kind);
    setForm(formFromRow(row));
  };
  useEffect(() => {
    if (!showWorkspace || !selected) return;
    setToolMode(selected.kind);
    setForm(formFromRow(selected));
  }, [selected?.id, selected?.version, showWorkspace]);
  const matches = useCallback(
    (row: Row, preset: string) => {
      const due = row.rawDueAt ? Date.parse(row.rawDueAt) : NaN;
      const now = Date.now();
      if (preset === 'all') return true;
      if (preset === 'tasks') return row.kind === 'TASK';
      if (preset === 'decisions') return row.kind === 'DECISION';
      if (preset === 'blocked')
        return row.status === 'BLOCKED' || (row.source.blockers?.length ?? 0) > 0;
      if (preset === 'overdue')
        return (
          Number.isFinite(due) &&
          due < now &&
          !['COMPLETED', 'DECIDED', 'CANCELLED'].includes(row.status)
        );
      if (preset === 'due-soon')
        return Number.isFinite(due) && due >= now && due <= now + 7 * 86400000;
      if (preset === 'missing-owner') return !row.owner;
      if (preset === 'missing-evidence')
        return !(row.source.evidenceRefs?.length || row.source.definitionOfDone);
      if (preset === 'waiting') return (row.source.dependencies?.length ?? 0) > 0;
      if (preset === 'mine') return Boolean(actorId) && row.owner === actorId;
      if (preset === 'team') return Boolean(row.source.teamId);
      return false;
    },
    [actorId]
  );
  const visibleRows = useMemo(
    () => rows.filter((row) => matches(row, activePreset ?? 'all')),
    [activePreset, matches, rows]
  );
  useEffect(
    () => onCountsChange?.(countExecutionPresets(rows, workPresets, matches)),
    [matches, onCountsChange, rows]
  );
  const lines = (v: string) =>
    v
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean);
  const base = (expectedVersion: number, action: string, fingerprint = '') => ({
    expectedVersion,
    expectedCaseVersion: caseVersion,
    clientRequestId: persistentCommandId(
      'execution-work',
      `${caseId}:${caseVersion}:${expectedVersion}:${action}:${fingerprint}`
    ),
  });
  const createTask = async () => {
    const fingerprint = JSON.stringify(form);
    const taskId =
      form.id ||
      `task-${persistentCommandId('execution-work-entity', `${caseId}:task:${fingerprint}`)}`;
    await createExecutionTask(caseId, taskId, {
      ...base(0, 'create-task', fingerprint),
      executionCaseId: caseId,
      initiativeId,
      title: form.title,
      description: form.description,
      assigneeId: form.assigneeId,
      ownerId: form.ownerId,
      dueAt: new Date(form.dueAt).toISOString(),
      slaAt: new Date(form.slaAt).toISOString(),
      evidenceRefs: lines(form.evidenceRefs),
      blockerDecisionIds: lines(form.blockers),
      dependencyTaskIds: lines(form.dependencies),
      milestoneIds: lines(form.milestoneIds),
    });
    await load(caseId);
  };
  const createDecision = async () => {
    const fingerprint = JSON.stringify(form);
    const decisionId =
      form.id ||
      `decision-${persistentCommandId('execution-work-entity', `${caseId}:decision:${fingerprint}`)}`;
    await createExecutionDecision(caseId, decisionId, {
      ...base(0, 'create-decision', fingerprint),
      executionCaseId: caseId,
      initiativeId,
      title: form.title,
      options: [
        { optionId: 'approve', label: 'Approve' },
        { optionId: 'return', label: 'Return' },
      ],
      authorityId: form.authorityId,
      dueAt: new Date(form.dueAt).toISOString(),
    });
    await load(caseId);
  };
  const act = async (action: string) => {
    if (!selected) return;
    if (selected.kind === 'TASK') {
      if (action === 'update')
        await updateExecutionTask(caseId, selected.id, {
          ...base(selected.version, 'update-task', JSON.stringify(form)),
          patch: {
            title: form.title || selected.title,
            evidenceRefs: lines(form.evidenceRefs),
            blockerDecisionIds: lines(form.blockers),
            dependencyTaskIds: lines(form.dependencies),
            milestoneIds: lines(form.milestoneIds),
          },
        });
      else
        await completeExecutionTask(caseId, selected.id, {
          ...base(selected.version, 'complete-task', form.evidenceRefs),
          evidenceRefs: lines(form.evidenceRefs),
        });
    } else {
      if (action === 'request')
        await requestExecutionDecision(caseId, selected.id, {
          ...base(selected.version, 'request-decision'),
        });
      else
        await decideExecutionDecision(caseId, selected.id, {
          ...base(selected.version, `decide:${action}`, JSON.stringify(form)),
          outcome: action,
          rationale: form.rationale,
          conditions: lines(form.conditions),
          followUpTask:
            action === 'CONDITIONALLY_APPROVED'
              ? {
                  taskId: `follow-up:${selected.id}`,
                  title: 'Conditional follow-up',
                  description: form.description,
                  assigneeId: form.assigneeId,
                  ownerId: form.ownerId,
                  dueAt: new Date(form.dueAt).toISOString(),
                  slaAt: new Date(form.slaAt).toISOString(),
                  evidenceRefs: lines(form.evidenceRefs),
                  dependencyTaskIds: [selected.id],
                }
              : null,
        });
    }
    await load(caseId);
  };
  const createMilestone = async () => {
    if (!caseId || !baselineRef.ref || baselineRef.version < 1) return;
    await createExecutionMilestone(caseId, milestoneForm.id, {
      ...base(0, 'create-milestone', JSON.stringify(milestoneForm)),
      executionCaseId: caseId,
      initiativeId,
      baselineRef,
      title: milestoneForm.title,
      ownerId: milestoneForm.ownerId,
      targetAt: milestoneForm.targetAt ? new Date(milestoneForm.targetAt).toISOString() : null,
      forecastAt: milestoneForm.forecastAt
        ? new Date(milestoneForm.forecastAt).toISOString()
        : null,
      evidenceRefs: lines(milestoneForm.evidenceRefs),
      sourceVersions: {
        executionCaseVersion: caseVersion,
        baselineVersion: baselineRef.version,
      },
    });
    await load(caseId);
  };
  if (state === 'ERROR')
    return (
      <div role="alert" className="m-4 rounded-xl border border-c-danger/40 p-4 text-sm">
        <p>Nie udało się załadować kanonicznego rejestru pracy.</p>
        <button
          type="button"
          className="btn-secondary mt-3"
          onClick={() => (caseId ? void load(caseId) : void loadCases())}
        >
          Spróbuj ponownie
        </button>
      </div>
    );
  const fieldLabels: Record<string, string> = {
    title: 'Tytuł',
    description: 'Opis i oczekiwany rezultat',
    assigneeId: 'Osoba realizująca',
    ownerId: 'Właściciel',
    authorityId: 'Osoba decyzyjna',
    dueAt: 'Termin',
    slaAt: 'Termin reakcji (SLA)',
    evidenceRefs: 'Dowody / załączniki',
    blockers: 'Blokujące decyzje',
    dependencies: 'Zależności',
    milestoneIds: 'Powiązane kamienie milowe',
    rationale: 'Uzasadnienie',
    conditions: 'Warunki decyzji',
  };
  const visibleFields =
    toolMode === 'TASK'
      ? [
          'title',
          'description',
          'assigneeId',
          'ownerId',
          'dueAt',
          'slaAt',
          'evidenceRefs',
          'blockers',
          'dependencies',
          'milestoneIds',
        ]
      : [
          'title',
          'description',
          'authorityId',
          'dueAt',
          'rationale',
          'conditions',
          ...(selected?.kind === 'DECISION' && selected.status === 'PENDING'
            ? (['assigneeId', 'ownerId', 'slaAt', 'evidenceRefs'] as const)
            : []),
        ];
  return (
    <section aria-label="Execution Work" className="p-4">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-semibold">Praca</h2>
          <p className="text-sm text-c-text-muted">
            Zadania i decyzje ze wszystkich dostępnych realizacji; wybór realizacji zawęża listę.
          </p>
        </div>
        {caseId && (
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" onClick={() => setToolMode('TASK')}>
              Nowe zadanie
            </button>
            <button className="btn-secondary" onClick={() => setToolMode('DECISION')}>
              Nowa decyzja
            </button>
            <button className="btn-secondary" onClick={() => setToolMode('MILESTONE')}>
              Nowy kamień milowy
            </button>
          </div>
        )}
      </div>
      <label className="mb-4 block max-w-md text-xs font-medium text-c-text-muted">
        Filtr realizacji
        <select
          aria-label="Execution Case for work"
          value={caseId}
          className="mt-1 block w-full rounded-lg border border-c-border bg-c-surface px-3 py-2 text-sm"
          onChange={(e) => {
            const nextCaseId = e.target.value;
            if (nextCaseId) void load(nextCaseId);
            else {
              setCaseId('');
              setSelectedId(null);
              setShowWorkspace(false);
              void loadCases();
            }
          }}
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
      {state === 'LOADING' && <p role="status">Loading canonical work</p>}
      {!caseId && state === 'READY' && rows.length === 0 && (
        <div className="rounded-xl border border-dashed border-c-border p-8 text-center text-sm text-c-text-muted">
          Brak kanonicznych zadań i decyzji w dostępnych realizacjach.
        </div>
      )}
      {state === 'READY' && rows.length > 0 && (
        <TableWithPreviewLayout<Row>
          selectedId={selectedId}
          selectedItem={selected}
          onSelect={(id) => {
            setSelectedId(id);
            setShowWorkspace(false);
          }}
          onOpenFull={(id) => {
            const row = rows.find((candidate) => candidate.id === id);
            if (row) void openWorkspace(row);
          }}
          itemIds={rows.map((r) => r.id)}
          getItemById={(id) => rows.find((r) => r.id === id) ?? null}
          renderPreview={(r) => (
            <StandardPreview
              embedded
              title={r.title}
              onClose={() => setSelectedId(null)}
              onOpenFull={() => void openWorkspace(r)}
              openLabel="Otwórz element pracy"
              meta={{
                pills: [
                  { label: r.kind, tone: 'neutral' },
                  { label: r.status, tone: r.status === 'COMPLETED' ? 'success' : 'info' },
                ],
                trailing: <span className="text-xs">v{r.version}</span>,
                recommendation: r.source.nextAction ?? 'Sprawdź kompletność i następny krok.',
              }}
              details={{
                label: 'Szczegóły pracy',
                text: r.source.description || 'Brak dodatkowego opisu.',
                properties: [
                  { id: 'owner', label: 'Odpowiedzialny', value: r.owner || 'UNKNOWN' },
                  { id: 'due', label: 'Termin / SLA', value: r.dueAt || 'UNKNOWN' },
                  { id: 'case', label: 'Realizacja', value: r.executionCaseId },
                  {
                    id: 'evidence',
                    label: 'Dowody',
                    value: r.source.evidenceRefs?.join(', ') || 'EVIDENCE_MISSING',
                  },
                ],
                onCopy: () => void navigator.clipboard?.writeText(r.title),
              }}
              relations={[
                { label: `Realizacja · ${r.executionCaseId}`, onClick: () => undefined },
                { label: `Inicjatywa · ${r.initiativeId}`, onClick: () => undefined },
              ]}
              relationsEmptyLabel="Brak powiązań"
              actions={{
                informational: [
                  {
                    id: 'open',
                    label: 'Otwórz element pracy',
                    variant: 'positive',
                    icon: Eye,
                    shortcut: 'O',
                    onClick: () => void openWorkspace(r),
                  },
                ],
              }}
            />
          )}
        >
          <StandardTable
            columns={cols}
            data={visibleRows}
            selectedRowId={selectedId}
            onRowClick={(r) => {
              setSelectedId(r.id);
              setShowWorkspace(false);
            }}
            onRowDoubleClick={(r) => {
              void openWorkspace(r as Row);
            }}
            rowMenu={(row) => ({
              primary: [
                {
                  id: 'open',
                  label: 'Otwórz element pracy',
                  icon: ArrowRight,
                  onClick: () => {
                    void openWorkspace(row as Row);
                  },
                },
              ],
              universalHandlers: {
                preview: () => {
                  setSelectedId(String(row.id));
                  setShowWorkspace(false);
                },
                archiveNote: 'Elementy pracy podlegają retencji Execution Case.',
              },
              destructive: {
                label: 'Usuń',
                note: 'Kanoniczny element pracy nie może zostać usunięty.',
              },
            })}
            persistKey="execution.work.canonical-register.v2"
          />
        </TableWithPreviewLayout>
      )}
      {showWorkspace && selected && (
        <section
          aria-label="Execution Work item workspace"
          className="mt-4 rounded border border-c-border p-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{selected.title}</h3>
            <button className="btn-secondary" onClick={() => setShowWorkspace(false)}>
              Zamknij workspace
            </button>
          </div>
          <CanonicalWorkHardeningPanel
            item={selected.source}
            actorId={actorId}
            onReadback={(next, version) =>
              setRows((current) =>
                current.map((item) =>
                  item.id === selected.id
                    ? { ...item, status: next.status, version, source: { ...next, version } }
                    : item
                )
              )
            }
          />
          {selected.kind === 'TASK' && <TaskMilestoneBlastRadius task={selected.source} />}
        </section>
      )}
      {caseId && (
        <section
          aria-label="Execution Milestones"
          className="mt-4 rounded border border-c-border p-4"
        >
          <h3 className="font-semibold">Milestones</h3>
          <p className="text-xs text-c-text-muted">
            Exact Case v{caseVersion || 'UNKNOWN'} · Handoff baseline {baselineRef.ref || 'UNKNOWN'}{' '}
            v{baselineRef.version || 'UNKNOWN'}
          </p>
          {milestones.length === 0 ? (
            <p role="status" className="mt-2 text-sm text-c-text-muted">
              No canonical Milestones.
            </p>
          ) : (
            <ul className="mt-2 grid gap-2 md:grid-cols-2">
              {milestones.map((m) => (
                <li key={m.milestoneId} className="rounded border border-c-border p-3 text-sm">
                  <strong>{m.title}</strong> · {m.milestoneId} v{m.version}
                  <div>
                    {m.status} · readiness {m.readiness}
                  </div>
                  <div>Owner {m.ownerId}</div>
                  <div>
                    Target {m.targetAt ?? 'UNKNOWN'} · forecast {m.forecastAt ?? 'UNKNOWN'}
                  </div>
                  <div>
                    Variance{' '}
                    {m.forecastVarianceDays === null ? 'UNKNOWN' : `${m.forecastVarianceDays} days`}
                  </div>
                  <div>
                    Evidence {m.evidenceRefs.length ? m.evidenceRefs.join(', ') : 'UNKNOWN'}
                  </div>
                  <div className="text-xs text-c-text-muted">
                    Case v{m.sourceVersions.executionCaseVersion} · baseline {m.baselineRef.ref} v
                    {m.sourceVersions.baselineVersion}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {toolMode === 'MILESTONE' && (
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {Object.keys(milestoneForm).map((key) => (
                <label key={key} className="text-xs">
                  {key}
                  <input
                    aria-label={`Milestone ${key}`}
                    type={key === 'targetAt' || key === 'forecastAt' ? 'datetime-local' : 'text'}
                    value={milestoneForm[key as keyof typeof milestoneForm]}
                    onChange={(event) =>
                      setMilestoneForm((current) => ({ ...current, [key]: event.target.value }))
                    }
                    className="block w-full rounded border border-c-border bg-c-surface p-2"
                  />
                </label>
              ))}
            </div>
          )}
          {toolMode === 'MILESTONE' && (
            <button
              type="button"
              className="btn-secondary mt-3"
              disabled={!caseId || !baselineRef.ref || baselineRef.version < 1}
              onClick={() => void createMilestone()}
            >
              Utwórz kamień milowy
            </button>
          )}
        </section>
      )}
      {caseId && (toolMode === 'TASK' || toolMode === 'DECISION') && (
        <section
          aria-label="Execution Workbench"
          className="mt-4 rounded border border-c-border p-4"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">
                {toolMode === 'TASK' ? 'Edytor zadania' : 'Edytor decyzji'}
              </h3>
              <p className="text-xs text-c-text-muted">
                Uzupełnij dane biznesowe; identyfikatory techniczne są nadawane przez system.
              </p>
            </div>
            <button className="btn-secondary" onClick={() => setToolMode('NONE')}>
              Zamknij
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {visibleFields.map((k) => (
              <label key={k} className="text-xs">
                {fieldLabels[k]}
                <textarea
                  aria-label={`Work ${k}`}
                  value={(form as any)[k]}
                  onChange={(e) => setForm((v) => ({ ...v, [k]: e.target.value }))}
                  className="block w-full rounded border border-c-border bg-c-surface p-2"
                />
              </label>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {toolMode === 'TASK' && (
              <>
                <button className="btn-secondary" onClick={() => void createTask()}>
                  Utwórz zadanie
                </button>
                {selected?.kind === 'TASK' && (
                  <>
                    <button className="btn-secondary" onClick={() => void act('update')}>
                      Zapisz zmiany
                    </button>
                    <button className="btn-secondary" onClick={() => void act('complete')}>
                      Oznacz jako wykonane
                    </button>
                  </>
                )}
              </>
            )}
            {toolMode === 'DECISION' && (
              <>
                <button className="btn-secondary" onClick={() => void createDecision()}>
                  Utwórz decyzję
                </button>
                {selected?.kind === 'DECISION' && (
                  <>
                    {selected.status === 'DRAFT' && (
                      <button className="btn-secondary" onClick={() => void act('request')}>
                        Przekaż do decyzji
                      </button>
                    )}
                    {selected.status === 'PENDING' && (
                      <>
                        <button className="btn-secondary" onClick={() => void act('APPROVED')}>
                          APPROVED
                        </button>
                        <button
                          className="btn-secondary"
                          onClick={() => void act('CONDITIONALLY_APPROVED')}
                        >
                          CONDITIONALLY_APPROVED
                        </button>
                        <button className="btn-secondary" onClick={() => void act('RETURNED')}>
                          RETURNED
                        </button>
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </section>
      )}
    </section>
  );
};
