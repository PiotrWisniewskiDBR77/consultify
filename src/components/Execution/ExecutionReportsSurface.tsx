import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';
import { StandardPreview } from '@/components/standard';
import {
  StandardTable,
  type TableColumn,
  type TableRow,
} from '@/components/standard/StandardTable';
import {
  createExecutionTask,
  createReportDefinition,
  createReportRun,
  getReportDefinition,
  listExecutionCases,
  listReportDefinitions,
  listReportRuns,
  readExecutionCase,
  transitionReportDefinition,
  transitionReportRun,
} from '@/services/initiatives-execution/runtimeApi';

import { countExecutionPresets, type ExecutionMenu3Contract } from './canonicalMenu3';
interface Row extends TableRow {
  id: string;
  title: string;
  status: string;
  rawStatus: string;
  definition: string;
  period: string;
  asOf: string;
  version: number;
  source: any;
}
interface DefinitionRow extends TableRow {
  id: string;
  title: string;
  state: string;
  rawState: string;
  currentVersion: number;
  aggregateVersion: number;
  owner: string;
  approver: string;
  updatedAt: string;
  definition: any;
}
const formatDate = (value: unknown) => {
  if (!value) return 'UNKNOWN';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return 'UNKNOWN';
  return new Intl.DateTimeFormat('pl-PL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

const reportStatusLabel = (value: string) =>
  ({
    DRAFT: 'Szkic',
    VALIDATED: 'Zweryfikowany',
    FROZEN: 'Zamrożony',
    APPROVED: 'Zatwierdzony',
    PUBLISHED: 'Opublikowany',
    RETURNED: 'Zwrócony',
    FAILED: 'Błąd',
    SUPERSEDED: 'Zastąpiony',
  })[value] ||
  value ||
  'UNKNOWN';

const columns: TableColumn[] = [
  { id: 'title', label: 'Raport', sortable: true, width: '280px' },
  { id: 'status', label: 'Status', sortable: true, filterable: true, width: '180px' },
  { id: 'definition', label: 'Definicja', sortable: true, width: '300px' },
  { id: 'period', label: 'Okres', sortable: true, width: '240px' },
  { id: 'asOf', label: 'Stan danych na', sortable: true, width: '180px' },
];
const definitionColumns: TableColumn[] = [
  { id: 'title', label: 'Definicja raportu', sortable: true, width: '260px' },
  { id: 'state', label: 'Status', sortable: true, filterable: true },
  { id: 'currentVersion', label: 'Wersja', sortable: true },
  { id: 'owner', label: 'Właściciel', sortable: true },
  { id: 'approver', label: 'Niezależny zatwierdzający', sortable: true },
  { id: 'updatedAt', label: 'Aktualizacja', sortable: true },
];
const reportPresets = [
  'all',
  'weekly',
  'monthly',
  'on-demand',
  'sponsor',
  'needs-generation',
  'needs-review',
  'partial-stale',
  'published',
  'failed',
  'recent',
] as const;
const distributionLabels: Record<string, string> = {
  receiptId: 'Identyfikator dystrybucji',
  audience: 'Odbiorcy',
  distributedAt: 'Data dystrybucji',
};
const followUpLabels: Record<string, string> = {
  executionCaseId: 'Realizacja',
  taskId: 'Identyfikator zadania',
  title: 'Tytuł',
  description: 'Opis',
  assigneeId: 'Wykonawca',
  ownerId: 'Właściciel',
  dueAt: 'Termin',
  slaAt: 'SLA',
  evidenceRefs: 'Dowody',
};
const definitionBusinessLabels: Record<string, string> = {
  purpose: 'Cel raportu',
  audience: 'Odbiorcy (jeden w wierszu)',
  cadence: 'Częstotliwość',
  ownerId: 'Właściciel definicji',
  approverId: 'Niezależny zatwierdzający',
};
export const ExecutionReportsSurface = ({
  activePreset,
  onCountsChange,
}: ExecutionMenu3Contract) => {
  const [state, setState] = useState<'LOADING' | 'READY' | 'ERROR'>('LOADING'),
    [rows, setRows] = useState<Row[]>([]),
    [definitions, setDefinitions] = useState<DefinitionRow[]>([]),
    [registerMode, setRegisterMode] = useState<'RUNS' | 'DEFINITIONS'>('RUNS'),
    [selectedDefinitionId, setSelectedDefinitionId] = useState<string | null>(null),
    [showDefinitionEditor, setShowDefinitionEditor] = useState(false),
    [showRunEditor, setShowRunEditor] = useState(false),
    [definitionId, setDefinitionId] = useState(''),
    [definitionJson, setDefinitionJson] = useState(''),
    [advancedDefinitionContract, setAdvancedDefinitionContract] = useState(false),
    [definitionBusiness, setDefinitionBusiness] = useState({
      purpose: '',
      audience: '',
      cadence: '',
      ownerId: '',
      approverId: '',
    }),
    [scopeProjectIds, setScopeProjectIds] = useState(''),
    [generalBacklogAllowed, setGeneralBacklogAllowed] = useState(false),
    [definitionRationale, setDefinitionRationale] = useState(''),
    [publishedDefinitionRef, setPublishedDefinitionRef] = useState(''),
    [executionCases, setExecutionCases] = useState<any[]>([]),
    [selectedId, setSelectedId] = useState<string | null>(null),
    [draftJson, setDraftJson] = useState(''),
    [advancedRunContract, setAdvancedRunContract] = useState(false),
    [refreshEditorOpen, setRefreshEditorOpen] = useState(false),
    [runDraft, setRunDraft] = useState({
      reportRunId: '',
      audience: '',
      scopeRefs: '',
      periodStart: '',
      periodEnd: '',
      asOf: '',
    }),
    [rationale, setRationale] = useState(''),
    [distribution, setDistribution] = useState({ receiptId: '', audience: '', distributedAt: '' }),
    [followUp, setFollowUp] = useState({
      executionCaseId: '',
      taskId: '',
      title: '',
      description: '',
      assigneeId: '',
      ownerId: '',
      dueAt: '',
      slaAt: '',
      evidenceRefs: '',
    }),
    [receipt, setReceipt] = useState<any | null>(null),
    [write, setWrite] = useState<'IDLE' | 'FAILED'>('IDLE');
  const ids = useRef(new Map<string, string>());
  const load = useCallback(async () => {
    setState('LOADING');
    try {
      const [b, definitionList, c] = (await Promise.all([
        listReportRuns(),
        listReportDefinitions(),
        listExecutionCases(),
      ])) as Array<{ items?: any[]; cases?: any[] }>;
      const definitionDetails = await Promise.all(
        (definitionList.items ?? []).map((item) => getReportDefinition(item.definitionId))
      );
      const definitionNames = new Map(
        definitionDetails.map((definition: any) => {
          const current = definition.versions?.find(
            (version: any) => version.definitionVersion === definition.currentVersion
          );
          return [definition.definitionId, current?.name ?? definition.definitionId];
        })
      );
      setRows(
        (b.items ?? []).map((x) => ({
          id: x.reportRunId,
          title: `${definitionNames.get(x.definitionRef.definitionId) ?? 'Raport'} · ${formatDate(x.asOf)}`,
          status: reportStatusLabel(x.status),
          rawStatus: x.status,
          definition: `${definitionNames.get(x.definitionRef.definitionId) ?? x.definitionRef.definitionId} · v${x.definitionRef.version}`,
          period: `${formatDate(x.period.start)} – ${formatDate(x.period.end)}`,
          asOf: formatDate(x.asOf),
          version: x.version,
          source: x,
        }))
      );
      setDefinitions(
        definitionDetails.map((definition: any) => {
          const current = definition.versions?.find(
            (version: any) => version.definitionVersion === definition.currentVersion
          );
          return {
            id: definition.definitionId,
            title: current?.name ?? definition.definitionId,
            state: reportStatusLabel(current?.state ?? 'UNKNOWN'),
            rawState: current?.state ?? 'UNKNOWN',
            currentVersion: definition.currentVersion,
            aggregateVersion: definition.version,
            owner: current?.ownerId ?? 'UNKNOWN',
            approver: current?.approverId ?? 'UNKNOWN',
            updatedAt: definition.updatedAt,
            definition,
          };
        })
      );
      setExecutionCases(c.cases ?? []);
      setState('READY');
    } catch {
      setState('ERROR');
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);
  const selectedDefinition = useMemo(
    () => definitions.find((row) => row.id === selectedDefinitionId) ?? null,
    [definitions, selectedDefinitionId]
  );
  const reportItems = useMemo(
    () => [
      ...definitions.map((row) => ({ kind: 'DEFINITION' as const, row })),
      ...rows.map((row) => ({ kind: 'RUN' as const, row })),
    ],
    [definitions, rows]
  );
  const matches = useCallback((item: (typeof reportItems)[number], preset: string) => {
    const raw = item.row as any;
    const source = item.kind === 'RUN' ? raw.source : raw.definition;
    const version =
      source?.versions?.find((entry: any) => entry.version === source.currentVersion) ?? source;
    const cadence = String(version?.cadence ?? source?.cadence ?? '').toUpperCase();
    const status = String(
      item.kind === 'RUN' ? (raw.rawStatus ?? raw.status) : (raw.rawState ?? raw.state)
    ).toUpperCase();
    if (preset === 'all') return true;
    if (preset === 'weekly') return cadence === 'WEEKLY';
    if (preset === 'monthly') return cadence === 'MONTHLY';
    if (preset === 'on-demand') return cadence === 'ON_DEMAND';
    if (preset === 'sponsor')
      return (version?.audience ?? []).some((value: string) => /sponsor/i.test(value));
    if (preset === 'needs-generation') return item.kind === 'DEFINITION' && status === 'PUBLISHED';
    if (preset === 'needs-review') return ['FROZEN', 'VALIDATED'].includes(status);
    if (preset === 'partial-stale')
      return source?.knowledgeState === 'PARTIAL' || source?.freshness === 'STALE';
    if (preset === 'published') return status === 'PUBLISHED';
    if (preset === 'failed') return status === 'FAILED';
    if (preset === 'recent')
      return (
        item.kind === 'RUN' &&
        Number.isFinite(Date.parse(raw.source?.updatedAt ?? raw.asOf)) &&
        Date.parse(raw.source?.updatedAt ?? raw.asOf) >= Date.now() - 30 * 86400000
      );
    return false;
  }, []);
  const visibleDefinitions = definitions.filter((row) =>
    matches({ kind: 'DEFINITION', row }, activePreset ?? 'all')
  );
  const visibleRuns = rows.filter((row) => matches({ kind: 'RUN', row }, activePreset ?? 'all'));
  useEffect(
    () => onCountsChange?.(countExecutionPresets(reportItems, reportPresets, matches)),
    [matches, onCountsChange, reportItems]
  );
  const cid = (key: string) => {
    const value = ids.current.get(key) ?? crypto.randomUUID();
    ids.current.set(key, value);
    return value;
  };
  const create = async () => {
    const p = advancedRunContract
      ? JSON.parse(draftJson)
      : {
          reportRunId: runDraft.reportRunId.trim(),
          parentRunRef:
            selected?.source?.status === 'PUBLISHED'
              ? { reportRunId: selected.id, version: selected.version }
              : null,
          audience: runDraft.audience
            .split('\n')
            .map((value) => value.trim())
            .filter(Boolean),
          scopeRefs: runDraft.scopeRefs
            .split('\n')
            .map((value) => value.trim())
            .filter(Boolean),
          period: {
            start: new Date(runDraft.periodStart).toISOString(),
            end: new Date(runDraft.periodEnd).toISOString(),
          },
          asOf: new Date(runDraft.asOf).toISOString(),
          sources: [],
        };
    const [definitionRefId, versionText] = publishedDefinitionRef.split('@');
    const definition = definitions.find((row) => row.id === definitionRefId);
    const version = Number(versionText);
    const published = definition?.definition.versions?.find(
      (item: any) => item.definitionVersion === version && item.state === 'PUBLISHED'
    );
    if (!published) throw new Error('Exact PUBLISHED Report Definition version required');
    await createReportRun(p.reportRunId, {
      ...p,
      definitionRef: { definitionId: definitionRefId, version },
      expectedVersion: 0,
      clientRequestId: cid(`create:${p.reportRunId}`),
    });
    setAdvancedRunContract(false);
    setRefreshEditorOpen(false);
    await load();
  };
  const definitionContent = () => {
    const content = JSON.parse(definitionJson);
    const projectIds = scopeProjectIds
      .split('\n')
      .map((value) => value.trim())
      .filter(Boolean);
    if (!projectIds.length && !generalBacklogAllowed)
      throw new Error('Explicit authorized project scope required');
    return {
      ...content,
      ...(definitionBusiness.purpose.trim() ? { purpose: definitionBusiness.purpose.trim() } : {}),
      ...(definitionBusiness.audience.trim()
        ? {
            audience: definitionBusiness.audience
              .split('\n')
              .map((value) => value.trim())
              .filter(Boolean),
          }
        : {}),
      ...(definitionBusiness.cadence.trim() ? { cadence: definitionBusiness.cadence.trim() } : {}),
      ...(definitionBusiness.ownerId.trim() ? { ownerId: definitionBusiness.ownerId.trim() } : {}),
      ...(definitionBusiness.approverId.trim()
        ? { approverId: definitionBusiness.approverId.trim() }
        : {}),
      scope: { ...(content.scope ?? {}), projectIds, generalBacklogAllowed },
    };
  };
  const createDefinition = async () => {
    try {
      await createReportDefinition(definitionId, {
        ...definitionContent(),
        expectedVersion: 0,
        clientRequestId: cid(`definition:create:${definitionId}`),
      });
      setWrite('IDLE');
      await load();
    } catch {
      setWrite('FAILED');
    }
  };
  const definitionAction = async (action: string) => {
    if (!selectedDefinition) return;
    try {
      const command: any = {
        expectedVersion: selectedDefinition.aggregateVersion,
        clientRequestId: cid(
          `definition:${selectedDefinition.id}:${selectedDefinition.aggregateVersion}:${action}`
        ),
        action,
      };
      if (action === 'UPDATE_DRAFT' || action === 'CREATE_VERSION')
        command.patch = definitionContent();
      if (action === 'PUBLISH') command.rationale = definitionRationale;
      await transitionReportDefinition(selectedDefinition.id, command);
      setWrite('IDLE');
      await load();
    } catch {
      setWrite('FAILED');
    }
  };
  const transition = async (action: string, outcome?: string) => {
    if (!selected) return;
    try {
      let command: any = {
        expectedVersion: selected.version,
        clientRequestId: cid(`${selected.id}:${selected.version}:${action}:${outcome ?? ''}`),
        action,
      };
      if (action === 'DECIDE') command = { ...command, outcome, rationale };
      if (action === 'PUBLISH')
        command = {
          ...command,
          distribution: {
            ...distribution,
            distributedAt: new Date(distribution.distributedAt).toISOString(),
          },
        };
      const result = (await transitionReportRun(selected.id, command)) as any;
      setReceipt(result.response);
      setWrite('IDLE');
      await load();
    } catch {
      setWrite('FAILED');
    }
  };
  const createAndLinkFollowUp = async () => {
    if (!selected) return;
    try {
      const caseReadback = (await readExecutionCase(followUp.executionCaseId)) as any;
      const taskReceiptClientRequestId = cid(
        `report:${selected.id}:follow-up:${followUp.executionCaseId}:${followUp.taskId}`
      );
      const task = (await createExecutionTask(followUp.executionCaseId, followUp.taskId, {
        expectedVersion: 0,
        expectedCaseVersion: caseReadback.version,
        clientRequestId: taskReceiptClientRequestId,
        executionCaseId: followUp.executionCaseId,
        initiativeId: caseReadback.detail.initiativeId,
        title: followUp.title,
        description: followUp.description,
        assigneeId: followUp.assigneeId,
        ownerId: followUp.ownerId,
        dueAt: new Date(followUp.dueAt).toISOString(),
        slaAt: new Date(followUp.slaAt).toISOString(),
        evidenceRefs: followUp.evidenceRefs
          .split('\n')
          .map((x) => x.trim())
          .filter(Boolean),
        blockerDecisionIds: [],
        dependencyTaskIds: [],
        milestoneIds: [],
      })) as any;
      const linked = (await transitionReportRun(selected.id, {
        expectedVersion: selected.version,
        clientRequestId: cid(`${selected.id}:${selected.version}:LINK_FOLLOW_UP`),
        action: 'LINK_FOLLOW_UP',
        taskReceiptClientRequestId,
        taskId: followUp.taskId,
        taskVersion: task.aggregateVersion,
      })) as any;
      setReceipt(linked.response);
      setWrite('IDLE');
      await load();
    } catch {
      setWrite('FAILED');
    }
  };
  if (state === 'ERROR')
    return (
      <div role="alert" className="m-4 rounded-xl border border-c-danger/40 p-4 text-sm">
        <p>Nie udało się załadować kanonicznego rejestru raportów.</p>
        <button type="button" className="btn-secondary mt-3" onClick={() => void load()}>
          Spróbuj ponownie
        </button>
      </div>
    );
  return (
    <section aria-label="Execution Reports" className="p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-semibold">Raporty</h2>
          <p className="text-sm text-c-text-muted">
            Zatwierdzone, odtwarzalne migawki danych z realizacji.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="btn-secondary"
            onClick={() => {
              setRegisterMode('DEFINITIONS');
              setShowDefinitionEditor(true);
            }}
          >
            Nowa definicja
          </button>
          <button
            className="btn-secondary"
            onClick={() => {
              setRegisterMode('RUNS');
              setShowRunEditor(true);
            }}
          >
            Nowy raport
          </button>
        </div>
      </div>
      <div className="mt-3 inline-flex rounded-full border border-c-border p-1" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={registerMode === 'RUNS'}
          className={`rounded-full px-4 py-2 text-sm ${registerMode === 'RUNS' ? 'bg-c-surface-raised font-semibold text-c-text' : 'text-c-text-muted'}`}
          onClick={() => setRegisterMode('RUNS')}
        >
          Raporty
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={registerMode === 'DEFINITIONS'}
          className={`rounded-full px-4 py-2 text-sm ${registerMode === 'DEFINITIONS' ? 'bg-c-surface-raised font-semibold text-c-text' : 'text-c-text-muted'}`}
          onClick={() => setRegisterMode('DEFINITIONS')}
        >
          Definicje
        </button>
      </div>
      {state === 'LOADING' && <p role="status">Ładowanie raportów…</p>}
      {registerMode === 'DEFINITIONS' && (
        <section aria-label="Report Definitions" className="mt-4">
          <h3 className="font-semibold">Definicje raportów</h3>
          <TableWithPreviewLayout<DefinitionRow>
            selectedId={selectedDefinitionId}
            selectedItem={selectedDefinition}
            onSelect={setSelectedDefinitionId}
            onOpenFull={(id) => {
              setSelectedDefinitionId(id);
              setShowDefinitionEditor(true);
            }}
            itemIds={definitions.map((row) => row.id)}
            getItemById={(id) => definitions.find((row) => row.id === id) ?? null}
            previewOpen={!showDefinitionEditor && Boolean(selectedDefinitionId)}
            renderPreview={(row) => {
              const version = row.definition.versions?.find(
                (item: any) => item.definitionVersion === row.currentVersion
              );
              return (
                <StandardPreview
                  embedded
                  title={row.title}
                  onClose={() => setSelectedDefinitionId(null)}
                  onOpenFull={() => setShowDefinitionEditor(true)}
                  openLabel="Otwórz definicję"
                  meta={{
                    pills: [
                      {
                        label: row.state,
                        tone: row.rawState === 'PUBLISHED' ? 'success' : 'neutral',
                      },
                    ],
                    trailing: (
                      <span className="text-xs text-c-text-muted">v{row.currentVersion}</span>
                    ),
                    recommendation:
                      row.rawState === 'PUBLISHED'
                        ? 'Gotowa do użycia'
                        : 'Dokończ walidację i zatwierdzenie',
                  }}
                  details={{
                    label: 'Kontrakt raportu',
                    text: version?.purpose || 'UNKNOWN',
                    properties: [
                      { id: 'owner', label: 'Właściciel', value: version?.ownerId || 'UNASSIGNED' },
                      {
                        id: 'approver',
                        label: 'Zatwierdzający',
                        value: version?.approverId || 'UNKNOWN',
                      },
                      {
                        id: 'audience',
                        label: 'Odbiorcy',
                        value: version?.audience?.join(', ') || 'UNKNOWN',
                      },
                      {
                        id: 'cadence',
                        label: 'Częstotliwość',
                        value: version?.cadence || 'UNKNOWN',
                      },
                      {
                        id: 'scope',
                        label: 'Zakres projektów',
                        value: version?.scope?.projectIds?.join(', ') || 'UNKNOWN',
                      },
                    ],
                  }}
                  relations={(version?.sourceBindings ?? []).map((source: any) => ({
                    label: `${source.sourceType ?? 'Źródło'} · ${source.sourceId ?? 'UNKNOWN'}`,
                  }))}
                  relationsEmptyLabel="Brak źródeł definicji"
                />
              );
            }}
          >
            <StandardTable
              columns={definitionColumns}
              data={visibleDefinitions}
              selectedRowId={selectedDefinitionId}
              onRowClick={(row) => setSelectedDefinitionId(row.id)}
              onRowDoubleClick={(row) => {
                setSelectedDefinitionId(row.id);
                setShowDefinitionEditor(true);
              }}
              rowMenu={(row) => ({
                primary: [
                  {
                    id: 'open-definition',
                    label: 'Otwórz definicję',
                    onClick: () => {
                      setSelectedDefinitionId(row.id);
                      setShowDefinitionEditor(true);
                    },
                  },
                ],
                universalHandlers: { preview: () => setSelectedDefinitionId(row.id) },
              })}
              persistKey="execution.report-definitions.v1"
              empty={{
                title: 'Brak definicji raportów',
                description: 'Utwórz wersjonowaną definicję z odbiorcami, zakresem i źródłami.',
              }}
            />
          </TableWithPreviewLayout>
          {showDefinitionEditor && (
            <section
              aria-label="Report Definition Workbench"
              className="mt-3 rounded border border-c-border p-4"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="font-semibold">Edytor definicji raportu</h3>
                <button className="btn-secondary" onClick={() => setShowDefinitionEditor(false)}>
                  Zamknij
                </button>
              </div>
              <label className="text-xs">
                Nazwa techniczna
                <input
                  aria-label="Report Definition ID"
                  value={definitionId}
                  onChange={(event) => setDefinitionId(event.target.value)}
                  className="block w-full rounded border border-c-border bg-c-surface p-2"
                />
              </label>
              <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                {Object.entries(definitionBusiness).map(([key, value]) => (
                  <label key={key} className="text-xs">
                    {definitionBusinessLabels[key] ?? key}
                    {key === 'purpose' || key === 'audience' ? (
                      <textarea
                        aria-label={`Report Definition business ${key}`}
                        value={value}
                        onChange={(event) =>
                          setDefinitionBusiness((current) => ({
                            ...current,
                            [key]: event.target.value,
                          }))
                        }
                        className="block min-h-20 w-full rounded border border-c-border bg-c-surface p-2"
                      />
                    ) : (
                      <input
                        aria-label={`Report Definition business ${key}`}
                        value={value}
                        onChange={(event) =>
                          setDefinitionBusiness((current) => ({
                            ...current,
                            [key]: event.target.value,
                          }))
                        }
                        className="block w-full rounded border border-c-border bg-c-surface p-2"
                      />
                    )}
                  </label>
                ))}
              </div>
              <label className="mt-3 flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  aria-label="Zaawansowany kontrakt definicji"
                  checked={advancedDefinitionContract}
                  onChange={(event) => setAdvancedDefinitionContract(event.target.checked)}
                />
                Pokaż kontrakt źródeł, formuł i dostępu (tryb zaawansowany)
              </label>
              {advancedDefinitionContract && (
                <label className="mt-2 block text-xs">
                  Kontrakt źródeł, formuł i dostępu
                  <textarea
                    aria-label="Report Definition contract JSON"
                    value={definitionJson}
                    onChange={(event) => setDefinitionJson(event.target.value)}
                    className="block min-h-40 w-full rounded border border-c-border bg-c-surface p-2 font-mono text-xs"
                  />
                </label>
              )}
              <label className="mt-2 block text-xs">
                Dozwolone projekty (jeden identyfikator w wierszu)
                <textarea
                  aria-label="Report Definition project IDs"
                  value={scopeProjectIds}
                  onChange={(event) => setScopeProjectIds(event.target.value)}
                  className="block min-h-20 w-full rounded border border-c-border bg-c-surface p-2"
                />
              </label>
              <label className="mt-2 flex items-center gap-2 text-xs">
                <input
                  aria-label="Allow General Backlog scope"
                  type="checkbox"
                  checked={generalBacklogAllowed}
                  onChange={(event) => setGeneralBacklogAllowed(event.target.checked)}
                />
                Uwzględnij jawnie backlog ogólny
              </label>
              {!scopeProjectIds.trim() && !generalBacklogAllowed && (
                <p role="alert" className="mt-2 text-c-warning">
                  Wymagany jest jawny zakres projektów. Domyślny zakres całej organizacji jest
                  niedozwolony.
                </p>
              )}
              <label className="mt-2 block text-xs">
                Uzasadnienie niezależnego zatwierdzenia
                <textarea
                  aria-label="Report Definition publish rationale"
                  value={definitionRationale}
                  onChange={(event) => setDefinitionRationale(event.target.value)}
                  className="block w-full rounded border border-c-border bg-c-surface p-2"
                />
              </label>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className="btn-secondary"
                  disabled={!scopeProjectIds.trim() && !generalBacklogAllowed}
                  onClick={() => void createDefinition()}
                >
                  Utwórz definicję
                </button>
                <button
                  className="btn-secondary"
                  disabled={
                    (!scopeProjectIds.trim() && !generalBacklogAllowed) ||
                    !selectedDefinition?.definition.versions?.find(
                      (v: any) => v.definitionVersion === selectedDefinition.currentVersion
                    )?.scope?.projectIds
                  }
                  onClick={() => void definitionAction('UPDATE_DRAFT')}
                >
                  Zapisz szkic
                </button>
                <button
                  className="btn-secondary"
                  disabled={
                    !selectedDefinition?.definition.versions?.find(
                      (v: any) => v.definitionVersion === selectedDefinition.currentVersion
                    )?.scope?.projectIds
                  }
                  onClick={() => void definitionAction('VALIDATE')}
                >
                  Zweryfikuj definicję
                </button>
                <button
                  className="btn-secondary"
                  disabled={
                    !selectedDefinition?.definition.versions?.find(
                      (v: any) => v.definitionVersion === selectedDefinition.currentVersion
                    )?.scope?.projectIds
                  }
                  onClick={() => void definitionAction('PUBLISH')}
                >
                  Opublikuj definicję
                </button>
                <button
                  className="btn-secondary"
                  disabled={
                    (!scopeProjectIds.trim() && !generalBacklogAllowed) ||
                    !selectedDefinition?.definition.versions?.find(
                      (v: any) => v.definitionVersion === selectedDefinition.currentVersion
                    )?.scope?.projectIds
                  }
                  onClick={() => void definitionAction('CREATE_VERSION')}
                >
                  Utwórz kolejną wersję
                </button>
              </div>
              {write === 'FAILED' && (
                <p role="alert" className="mt-2 text-c-danger">
                  Zakres jest pusty, nieaktualny albo niedozwolony. Definicja nie została zmieniona.
                </p>
              )}
            </section>
          )}
        </section>
      )}
      {registerMode === 'RUNS' && (
        <TableWithPreviewLayout<Row>
          selectedId={selectedId}
          selectedItem={selected}
          onSelect={setSelectedId}
          onOpenFull={(id) => {
            setSelectedId(id);
            setShowRunEditor(true);
          }}
          itemIds={rows.map((r) => r.id)}
          getItemById={(id) => rows.find((r) => r.id === id) ?? null}
          previewOpen={!showRunEditor && Boolean(selectedId)}
          renderPreview={(r) => (
            <StandardPreview
              embedded
              title={r.title}
              onClose={() => setSelectedId(null)}
              onOpenFull={() => setShowRunEditor(true)}
              openLabel="Otwórz raport"
              meta={{
                pills: [
                  {
                    label: reportStatusLabel(r.status),
                    tone: r.source.status === 'PUBLISHED' ? 'success' : 'neutral',
                  },
                ],
                trailing: <span className="text-xs text-c-text-muted">v{r.version}</span>,
                recommendation:
                  r.source.status === 'PUBLISHED'
                    ? 'Przejrzyj lub odśwież raport'
                    : 'Dokończ przygotowanie raportu',
              }}
              details={{
                label: 'Zakres raportu',
                text: `${r.period} · stan danych na ${r.asOf}`,
                properties: [
                  { id: 'definition', label: 'Definicja', value: r.definition },
                  {
                    id: 'audience',
                    label: 'Odbiorcy',
                    value: r.source.audience?.join(', ') || 'UNKNOWN',
                  },
                  {
                    id: 'scope',
                    label: 'Zakres',
                    value: r.source.scopeRefs?.join(', ') || 'UNKNOWN',
                  },
                  ...(r.source.parentRunRef
                    ? [
                        {
                          id: 'parent',
                          label: 'Rodzic',
                          value: `Parent ${r.source.parentRunRef.reportRunId} v${r.source.parentRunRef.version}`,
                        },
                      ]
                    : []),
                  {
                    id: 'hash',
                    label: 'Hash migawki',
                    value: r.source.contentHash || 'NOT_FROZEN',
                  },
                  { id: 'sources', label: 'Źródła', value: String(r.source.sources?.length ?? 0) },
                ],
              }}
              relations={(r.source.sources ?? []).map((source: any) => ({
                label: `${source.sourceType} · ${source.sourceId} · v${source.version}`,
                value: `${source.freshness ?? 'UNKNOWN'} · ${source.accessState ?? 'UNKNOWN'} · confidence ${source.confidence ?? 'UNKNOWN'}`,
                onClick: () => undefined,
              }))}
              relationsEmptyLabel="Brak źródeł"
            />
          )}
        >
          <StandardTable
            columns={columns}
            data={visibleRuns}
            selectedRowId={selectedId}
            onRowClick={(r) => setSelectedId(r.id)}
            onRowDoubleClick={(r) => {
              setSelectedId(r.id);
              setShowRunEditor(true);
            }}
            rowMenu={(r) => ({
              primary: [
                {
                  id: 'open-report',
                  label: 'Otwórz raport',
                  onClick: () => {
                    setSelectedId(r.id);
                    setShowRunEditor(true);
                  },
                },
              ],
              universalHandlers: { preview: () => setSelectedId(r.id) },
            })}
            persistKey="execution.report-runs.v1"
            empty={{
              title: 'Brak uruchomień raportów',
              description: 'Utwórz raport z opublikowanej definicji i jawnego okresu danych.',
            }}
          />
        </TableWithPreviewLayout>
      )}
      {registerMode === 'RUNS' && showRunEditor && (
        <section
          aria-label="ReportRun Workbench"
          className="mt-4 rounded border border-c-border p-4"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="font-semibold">Generator raportu</h3>
            <button className="btn-secondary" onClick={() => setShowRunEditor(false)}>
              Zamknij
            </button>
          </div>
          {selected?.source.status === 'PUBLISHED' && !refreshEditorOpen && (
            <button className="btn-primary mb-3" onClick={() => setRefreshEditorOpen(true)}>
              Odśwież jako nowy szkic
            </button>
          )}
          {(!selected || selected.source.status !== 'PUBLISHED' || refreshEditorOpen) && (
            <>
              <label className="mb-2 block text-xs">
                Opublikowana definicja raportu
                <select
                  aria-label="ReportRun published Definition version"
                  value={publishedDefinitionRef}
                  onChange={(event) => setPublishedDefinitionRef(event.target.value)}
                  className="block w-full rounded border border-c-border bg-c-surface p-2"
                >
                  <option value="">Wybierz opublikowaną definicję</option>
                  {definitions.flatMap((definition) =>
                    (definition.definition.versions ?? [])
                      .filter((version: any) => version.state === 'PUBLISHED')
                      .filter((version: any) => version.scope?.projectIds)
                      .map((version: any) => (
                        <option
                          key={`${definition.id}@${version.definitionVersion}`}
                          value={`${definition.id}@${version.definitionVersion}`}
                        >
                          {definition.title} · {definition.id} v{version.definitionVersion}
                        </option>
                      ))
                  )}
                </select>
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {[
                  ['reportRunId', 'Identyfikator raportu', 'text'],
                  ['periodStart', 'Początek okresu', 'datetime-local'],
                  ['periodEnd', 'Koniec okresu', 'datetime-local'],
                  ['asOf', 'Stan danych na', 'datetime-local'],
                ].map(([key, label, type]) => (
                  <label key={key} className="text-xs">
                    {label}
                    <input
                      aria-label={`ReportRun ${key}`}
                      type={type}
                      value={runDraft[key as keyof typeof runDraft]}
                      onChange={(event) =>
                        setRunDraft((current) => ({ ...current, [key]: event.target.value }))
                      }
                      className="block w-full rounded border border-c-border bg-c-surface p-2"
                    />
                  </label>
                ))}
                <label className="text-xs sm:col-span-2">
                  Odbiorcy — jedna grupa w wierszu
                  <textarea
                    aria-label="ReportRun audience"
                    value={runDraft.audience}
                    onChange={(event) =>
                      setRunDraft((current) => ({ ...current, audience: event.target.value }))
                    }
                    className="block min-h-20 w-full rounded border border-c-border bg-c-surface p-2"
                  />
                </label>
                <label className="text-xs sm:col-span-2 xl:col-span-1">
                  Zakres — jedna referencja w wierszu
                  <textarea
                    aria-label="ReportRun scope refs"
                    value={runDraft.scopeRefs}
                    onChange={(event) =>
                      setRunDraft((current) => ({ ...current, scopeRefs: event.target.value }))
                    }
                    className="block min-h-20 w-full rounded border border-c-border bg-c-surface p-2"
                  />
                </label>
              </div>
              <label className="mt-3 flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={advancedRunContract}
                  onChange={(event) => setAdvancedRunContract(event.target.checked)}
                />
                Zaawansowany kontrakt JSON
              </label>
              {advancedRunContract && (
                <textarea
                  aria-label="ReportRun draft JSON"
                  value={draftJson}
                  onChange={(e) => setDraftJson(e.target.value)}
                  className="mt-2 min-h-36 w-full rounded border border-c-border bg-c-surface p-2 font-mono text-xs"
                />
              )}
              <button
                className="btn-primary mt-3"
                disabled={
                  !publishedDefinitionRef ||
                  (!advancedRunContract &&
                    (!runDraft.reportRunId ||
                      !runDraft.periodStart ||
                      !runDraft.periodEnd ||
                      !runDraft.asOf))
                }
                onClick={() => void create()}
              >
                Utwórz lub odśwież raport
              </button>
              <div className="mt-3 grid grid-cols-1 items-start gap-2 lg:grid-cols-2">
                <button className="btn-secondary" onClick={() => void transition('VALIDATE')}>
                  Zweryfikuj źródła
                </button>
                <button className="btn-secondary" onClick={() => void transition('FREEZE')}>
                  Zamroź migawkę
                </button>
                <textarea
                  aria-label="Report approval rationale"
                  value={rationale}
                  onChange={(e) => setRationale(e.target.value)}
                  className="min-h-20 w-full rounded border border-c-border bg-c-surface p-2"
                />
                <button
                  className="btn-secondary"
                  onClick={() => void transition('DECIDE', 'APPROVED')}
                >
                  Zatwierdź niezależnie
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => void transition('DECIDE', 'RETURNED')}
                >
                  Zwróć raport
                </button>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {Object.keys(distribution).map((k) => (
                  <label key={k} className="min-w-0 text-xs">
                    {distributionLabels[k] ?? k}
                    <input
                      aria-label={`Report distribution ${k}`}
                      type={k === 'distributedAt' ? 'datetime-local' : 'text'}
                      value={(distribution as any)[k]}
                      onChange={(e) => setDistribution((v) => ({ ...v, [k]: e.target.value }))}
                      className="block w-full min-w-0 rounded border border-c-border bg-c-surface p-2"
                    />
                  </label>
                ))}
              </div>
              <button
                className="btn-primary"
                disabled={selected?.source.status !== 'APPROVED'}
                onClick={() => void transition('PUBLISH')}
              >
                Opublikuj zatwierdzoną migawkę
              </button>
            </>
          )}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {Object.keys(followUp).map((k) => (
              <label key={k} className="min-w-0 text-xs">
                {followUpLabels[k] ?? k}
                {k === 'executionCaseId' ? (
                  <select
                    aria-label="Report follow-up executionCaseId"
                    value={followUp.executionCaseId}
                    onChange={(e) =>
                      setFollowUp((v) => ({ ...v, executionCaseId: e.target.value }))
                    }
                    className="block w-full rounded border border-c-border bg-c-surface p-2"
                  >
                    <option value="">Wybierz realizację</option>
                    {executionCases.map((item) => (
                      <option key={item.executionCaseId}>{item.executionCaseId}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    aria-label={`Report follow-up ${k}`}
                    type={k === 'dueAt' || k === 'slaAt' ? 'datetime-local' : 'text'}
                    value={followUp[k as keyof typeof followUp]}
                    onChange={(e) => setFollowUp((v) => ({ ...v, [k]: e.target.value }))}
                    className="block w-full rounded border border-c-border bg-c-surface p-2"
                  />
                )}
              </label>
            ))}
          </div>
          <button
            className="btn-secondary"
            disabled={!['APPROVED', 'PUBLISHED'].includes(selected?.source.status ?? '')}
            onClick={() => void createAndLinkFollowUp()}
          >
            Utwórz i powiąż zadanie następcze
          </button>
          {write === 'FAILED' && <p role="alert">Nie zapisano zmiany raportu.</p>}
          {receipt && (
            <div role="status" className="rounded border border-c-success/40 p-3">
              <strong>{reportStatusLabel(receipt.status)}</strong>
              <p>Hash migawki: {receipt.contentHash ?? 'Jeszcze nie zamrożono'}</p>
              {receipt.exportPackage && (
                <p>Zamrożony pakiet pozostaje w kanonicznym raporcie i jest odtwarzalny.</p>
              )}
              {receipt.distributionReceipts?.map((d: any) => (
                <p key={d.receiptId}>
                  Dystrybucja {d.receiptId} · {d.audience} · hash {d.contentHash}
                </p>
              ))}
              {receipt.followUpTaskRef && (
                <p>
                  Zadanie następcze {receipt.followUpTaskRef.taskId} v
                  {receipt.followUpTaskRef.version} · potwierdzenie{' '}
                  {receipt.followUpTaskRef.receiptClientRequestId}
                </p>
              )}
            </div>
          )}
        </section>
      )}
    </section>
  );
};
