import { AlertTriangle, FileText, RefreshCw, Save, Sparkles } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';
import { Menu2PresetDropdown } from '@/components/standard/Menu2PresetDropdown';
import { StandardPreview } from '@/components/standard/StandardPreview';
import {
  StandardTable,
  type StandardRowMenu,
  type TableColumn,
  type TableRow,
} from '@/components/standard/StandardTable';
import {
  proposeInitiativeWorkloadMoves,
  readInitiativeWorkload,
  updateInitiativeWorkloadAvailability,
  type InitiativeWorkloadProposal,
  type InitiativeWorkloadResponse,
  type InitiativeWorkloadRow,
} from '@/services/initiatives/initiativeWorkloadApi';
import {
  createReportRun,
  getReportDefinition,
  listReportDefinitions,
  transitionReportRun,
} from '@/services/initiatives-execution/runtimeApi';
import type { ResourcePlanPerson } from '@/services/execution/resourcePlanApi';
import { InitiativeStatus } from '../../../packages/shared/src/constants/initiativeStatuses.generated';

import { initiativeStatusLabel } from './initiativeStatusLabels';

type InitiativeScopeRow = {
  id: string;
  name?: string;
  projectId?: string | null;
  projectName?: string | null;
  status?: string | null;
};

interface WorkloadTableRow extends TableRow {
  id: string;
  title: string;
  role: string;
  weeklyCapacityHours: number;
  availabilityPercent: number;
  supplySource: 'PROFIL' | 'DOMYSLNA';
  cells: Record<string, InitiativeWorkloadRow | undefined>;
}

export const workloadBand = (utilizationPercent: number): 'green' | 'amber' | 'red' => {
  if (utilizationPercent < 85) return 'green';
  if (utilizationPercent <= 100) return 'amber';
  return 'red';
};

const bandClass: Record<ReturnType<typeof workloadBand>, string> = {
  green: 'border-c-success/30 bg-c-success/10 text-c-success',
  amber: 'border-c-warning/30 bg-c-warning/10 text-c-warning',
  red: 'border-c-danger/30 bg-c-danger/10 text-c-danger',
};

const toTableRow = (
  person: ResourcePlanPerson,
  rows: InitiativeWorkloadRow[]
): WorkloadTableRow => ({
  id: person.userId,
  title: person.name,
  description: person.role || undefined,
  role: person.role,
  weeklyCapacityHours: person.weeklyCapacityHours,
  availabilityPercent: person.availabilityPercent,
  supplySource: person.supplySource,
  cells: Object.fromEntries(
    rows.filter((row) => row.userId === person.userId).map((row) => [row.weekStart, row])
  ),
});

type WorkloadDefinition = {
  id: string;
  version: number;
  ownerId: string;
  approverId: string;
  audience: string[];
  name: string;
};

const itemsAt = (payload: any): any[] =>
  Array.isArray(payload?.items) ? payload.items : Array.isArray(payload) ? payload : [];

export const InitiativeWorkloadSurface: React.FC<{
  initiatives: InitiativeScopeRow[];
  currentUserId: string;
  proposalRequestId?: number;
}> = ({ initiatives, currentUserId, proposalRequestId = 0 }) => {
  const { t, i18n } = useTranslation();
  const [projectId, setProjectId] = useState('');
  const [initiativeStatus, setInitiativeStatus] = useState('');
  const [weeks, setWeeks] = useState(8);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [result, setResult] = useState<InitiativeWorkloadResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [capacityDraft, setCapacityDraft] = useState({ hours: 40, percent: 100 });
  const [savingCapacity, setSavingCapacity] = useState(false);
  const [proposals, setProposals] = useState<InitiativeWorkloadProposal[]>([]);
  const [proposalBusy, setProposalBusy] = useState(false);
  const [definitions, setDefinitions] = useState<WorkloadDefinition[]>([]);
  const [definitionRef, setDefinitionRef] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const [reportReceipt, setReportReceipt] = useState<string | null>(null);
  const workReportEnabled = import.meta.env.VITE_INITIATIVES_WORK_REPORT === 'true';

  const projects = useMemo(() => {
    const byId = new Map<string, string>();
    initiatives.forEach((initiative) => {
      const id = String(initiative.projectId || '').trim();
      if (id) byId.set(id, String(initiative.projectName || id));
    });
    return Array.from(byId, ([id, label]) => ({ id, label })).sort((a, b) =>
      a.label.localeCompare(b.label)
    );
  }, [initiatives]);
  const statuses = useMemo(() => Object.values(InitiativeStatus), []);

  const load = useCallback(
    async (signal: AbortSignal) => {
      setState('loading');
      try {
        const response = await readInitiativeWorkload(
          {
            weeks,
            projectId: projectId || undefined,
            initiativeStatuses: initiativeStatus ? [initiativeStatus] : undefined,
          },
          signal
        );
        if (signal.aborted) return;
        setResult(response);
        setSelectedId((current) =>
          current && response.people.some((person) => person.userId === current) ? current : null
        );
        setState('ready');
      } catch {
        if (!signal.aborted) setState('error');
      }
    },
    [initiativeStatus, projectId, weeks]
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, refreshKey]);

  const tableRows = useMemo(
    () => (result ? result.people.map((person) => toTableRow(person, result.rows)) : []),
    [result]
  );
  const selected = tableRows.find((row) => row.id === selectedId) ?? null;
  useEffect(() => {
    if (!selected) return;
    setCapacityDraft({
      hours: selected.weeklyCapacityHours,
      percent: selected.availabilityPercent,
    });
  }, [selected]);

  useEffect(() => {
    if (!workReportEnabled || !currentUserId) return;
    let cancelled = false;
    void (async () => {
      try {
        const list = await listReportDefinitions();
        const details = await Promise.all(
          itemsAt(list).map((item) => getReportDefinition(String(item.definitionId)))
        );
        const compatible = details.flatMap((definition: any) =>
          (definition.versions || [])
            .filter(
              (version: any) =>
                version.state === 'PUBLISHED' &&
                version.ownerId === currentUserId &&
                (version.outputSchema?.kind === 'initiative_workload_report' ||
                  (version.sourceBindings || []).some(
                    (binding: any) => binding.sourceType === 'initiative_workload'
                  ))
            )
            .map((version: any) => ({
              id: String(definition.definitionId),
              version: Number(version.definitionVersion),
              ownerId: String(version.ownerId),
              approverId: String(version.approverId),
              audience: Array.isArray(version.audience) ? version.audience.map(String) : [],
              name: String(version.name || definition.definitionId),
            }))
        );
        if (!cancelled) {
          setDefinitions(compatible);
          setDefinitionRef(
            (current) =>
              current || (compatible[0] ? `${compatible[0].id}@${compatible[0].version}` : '')
          );
        }
      } catch {
        if (!cancelled) setDefinitions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUserId, workReportEnabled]);

  const saveCapacity = async () => {
    if (!selected || selected.id !== currentUserId) return;
    setSavingCapacity(true);
    try {
      await updateInitiativeWorkloadAvailability(selected.id, {
        weeklyCapacityHours: capacityDraft.hours,
        availabilityPercent: capacityDraft.percent,
      });
      setRefreshKey((value) => value + 1);
    } finally {
      setSavingCapacity(false);
    }
  };

  const proposeMoves = useCallback(async () => {
    setProposalBusy(true);
    try {
      const response = await proposeInitiativeWorkloadMoves({
        weeks,
        projectId: projectId || undefined,
        initiativeStatuses: initiativeStatus ? [initiativeStatus] : undefined,
      });
      setProposals(response.proposals);
    } finally {
      setProposalBusy(false);
    }
  }, [initiativeStatus, projectId, weeks]);

  useEffect(() => {
    if (proposalRequestId > 0) void proposeMoves();
  }, [proposalRequestId, proposeMoves]);

  const generateReport = async () => {
    const definition = definitions.find((item) => `${item.id}@${item.version}` === definitionRef);
    if (!definition) return;
    setReportBusy(true);
    try {
      const reportRunId = crypto.randomUUID();
      const now = new Date();
      await createReportRun(reportRunId, {
        definitionRef: { definitionId: definition.id, version: definition.version },
        parentRunRef: null,
        audience: definition.audience.length ? definition.audience : ['internal'],
        scopeRefs: projectId ? [`project:${projectId}`] : ['organization'],
        period: {
          start: new Date(now.getTime() - weeks * 7 * 86_400_000).toISOString(),
          end: now.toISOString(),
        },
        asOf: now.toISOString(),
        workReport: {
          title: t('initiatives.workload.reportTitle', 'Initiatives workload report'),
          templateId: 'WORKLOAD_CAPACITY',
          cadence: 'ON_DEMAND',
          projectIds: projectId ? [projectId] : [],
        },
        sources: [],
        ownerId: definition.ownerId,
        approverId: definition.approverId,
        expectedVersion: 0,
        clientRequestId: crypto.randomUUID(),
      });
      await transitionReportRun(reportRunId, {
        action: 'VALIDATE',
        profile: 'initiative_work_report',
        expectedVersion: 1,
        clientRequestId: crypto.randomUUID(),
      });
      await transitionReportRun(reportRunId, {
        action: 'FREEZE',
        profile: 'initiative_work_report',
        expectedVersion: 2,
        clientRequestId: crypto.randomUUID(),
      });
      setReportReceipt(reportRunId);
    } finally {
      setReportBusy(false);
    }
  };
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language === 'pl' ? 'pl-PL' : 'en-US', {
        month: 'short',
        day: 'numeric',
      }),
    [i18n.language]
  );

  const columns = useMemo<TableColumn[]>(() => {
    const base: TableColumn[] = [
      {
        id: 'title',
        label: t('initiatives.workload.person', 'Team member'),
        sortable: true,
      },
      {
        id: 'weeklyCapacityHours',
        label: t('initiatives.workload.capacity', 'Weekly capacity'),
        sortable: true,
        render: (row) => `${(row as WorkloadTableRow).weeklyCapacityHours} h`,
      },
      {
        id: 'availabilityPercent',
        label: t('initiatives.workload.availability', 'Availability'),
        sortable: true,
        render: (row) => `${(row as WorkloadTableRow).availabilityPercent}%`,
      },
    ];
    return [
      ...base,
      ...(result?.weeks || []).map(
        (weekStart): TableColumn => ({
          id: `week:${weekStart}`,
          label: dateFormatter.format(new Date(`${weekStart}T12:00:00`)),
          render: (rawRow) => {
            const row = rawRow as WorkloadTableRow;
            const cell = row.cells[weekStart];
            const percent = cell?.utilizationPercent ?? 0;
            const band = cell?.capacityExceeded ? 'red' : workloadBand(percent);
            return (
              <span
                data-testid={`workload-${row.id}-${weekStart}`}
                data-workload-band={band}
                title={t('initiatives.workload.cellHint', {
                  defaultValue: '{{demand}} h demand / {{supply}} h capacity',
                  demand: cell?.demandHours ?? 0,
                  supply: cell?.supplyHours ?? 0,
                })}
                className={`inline-flex min-w-14 items-center justify-end rounded-md border px-2 py-1 text-xs font-semibold ${bandClass[band]}`}
              >
                {cell?.capacityExceeded
                  ? t('initiatives.workload.noCapacity', 'No capacity')
                  : `${percent}%`}
              </span>
            );
          },
        })
      ),
    ];
  }, [dateFormatter, result?.weeks, t]);
  const proposalColumns = useMemo<TableColumn[]>(
    () => [
      {
        id: 'taskTitle',
        label: t('initiatives.workload.proposalTask', 'Planned task'),
      },
      {
        id: 'move',
        label: t('initiatives.workload.proposalMove', 'Suggested move'),
        render: (row) => {
          const proposal = row as unknown as InitiativeWorkloadProposal;
          return `${proposal.fromUserName} → ${proposal.toUserName}`;
        },
      },
      {
        id: 'proposedHours',
        label: t('initiatives.workload.proposalHours', 'Hours'),
        render: (row) => `${(row as unknown as InitiativeWorkloadProposal).proposedHours} h`,
      },
      {
        id: 'weekStart',
        label: t('initiatives.workload.proposalWeek', 'Week'),
      },
    ],
    [t]
  );
  const workloadRowMenu = (row: TableRow): StandardRowMenu => ({
    primary: [
      {
        id: 'preview',
        label: t('common.preview', 'Preview'),
        onClick: () => setSelectedId(String(row.id)),
      },
    ],
    universalHandlers: {
      edit: () => setSelectedId(String(row.id)),
    },
  });

  return (
    <section
      aria-label={t('initiatives.workload.aria', 'Initiatives workload')}
      className="flex h-full min-h-0 flex-col gap-3 p-4"
    >
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-c-border-subtle bg-c-surface px-3 py-2">
        <Menu2PresetDropdown
          label={t('initiatives.workload.projectScope', 'Project scope')}
          value={projectId}
          onChange={setProjectId}
          options={[
            { id: '', label: t('initiatives.workload.allProjects', 'All projects') },
            ...projects,
          ]}
          data-testid="workload-project-filter"
        />
        <Menu2PresetDropdown
          label={t('initiatives.workload.initiativeStatus', 'Initiative status')}
          value={initiativeStatus}
          onChange={setInitiativeStatus}
          options={[
            { id: '', label: t('common.all', 'All') },
            ...statuses.map((status) => ({
              id: status,
              label: initiativeStatusLabel(t, status),
            })),
          ]}
          data-testid="workload-status-filter"
        />
        <Menu2PresetDropdown
          label={t('initiatives.workload.horizon', 'Horizon')}
          value={String(weeks)}
          onChange={(value) => setWeeks(Number(value))}
          options={[4, 8, 12, 26].map((value) => ({
            id: String(value),
            label: `${value} ${t('initiatives.workload.weeks', 'weeks')}`,
          }))}
          data-testid="workload-horizon-filter"
        />
        <button
          type="button"
          onClick={() => setRefreshKey((value) => value + 1)}
          className="ml-auto inline-flex h-9 items-center gap-2 rounded-full border border-c-border px-3 text-sm text-c-text-secondary hover:bg-c-surface-raised focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          <RefreshCw size={15} /> {t('common.refresh', 'Refresh')}
        </button>
        {proposalBusy && (
          <span className="inline-flex h-9 items-center gap-2 px-3 text-sm text-c-text-secondary">
            <Sparkles size={15} />
            {t('initiatives.workload.proposing', 'Analyzing…')}
          </span>
        )}
      </div>

      {selected && selected.id === currentUserId && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-c-border-subtle bg-c-surface px-3 py-2">
          <div className="mr-2 text-sm font-semibold text-c-text">{selected.title}</div>
          <label className="text-xs font-medium text-c-text-secondary">
            {t('initiatives.workload.weeklyHours', 'Hours per week')}
            <input
              aria-label={t('initiatives.workload.weeklyHours', 'Hours per week')}
              type="number"
              min={0}
              max={80}
              value={capacityDraft.hours}
              onChange={(event) =>
                setCapacityDraft((current) => ({ ...current, hours: Number(event.target.value) }))
              }
              className="mt-1 block h-9 w-28 rounded-lg border border-c-border bg-c-surface-raised px-3 text-sm text-c-text focus-visible:ring-2 focus-visible:ring-c-focus"
            />
          </label>
          <label className="text-xs font-medium text-c-text-secondary">
            {t('initiatives.workload.availabilityPercent', 'Availability percent')}
            <input
              aria-label={t('initiatives.workload.availabilityPercent', 'Availability percent')}
              type="number"
              min={0}
              max={100}
              value={capacityDraft.percent}
              onChange={(event) =>
                setCapacityDraft((current) => ({ ...current, percent: Number(event.target.value) }))
              }
              className="mt-1 block h-9 w-28 rounded-lg border border-c-border bg-c-surface-raised px-3 text-sm text-c-text focus-visible:ring-2 focus-visible:ring-c-focus"
            />
          </label>
          <button
            type="button"
            onClick={() => void saveCapacity()}
            disabled={
              savingCapacity ||
              capacityDraft.hours < 0 ||
              capacityDraft.hours > 80 ||
              capacityDraft.percent < 0 ||
              capacityDraft.percent > 100
            }
            className="inline-flex h-9 items-center gap-2 rounded-full bg-c-text px-3 text-sm font-semibold text-c-bg focus-visible:ring-2 focus-visible:ring-c-focus disabled:opacity-50"
          >
            <Save size={15} />
            {savingCapacity
              ? t('common.saving', 'Saving…')
              : t('initiatives.workload.saveAvailability', 'Save availability')}
          </button>
        </div>
      )}

      {workReportEnabled && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-c-border-subtle bg-c-surface px-3 py-2">
          <Menu2PresetDropdown
            className="min-w-64 flex-1"
            label={t(
              'initiatives.workload.reportDefinition',
              'Published workload report definition'
            )}
            value={definitionRef}
            onChange={setDefinitionRef}
            options={[
              {
                id: '',
                label: t(
                  'initiatives.workload.noReportDefinition',
                  'No compatible published definition'
                ),
              },
              ...definitions.map((definition) => ({
                id: `${definition.id}@${definition.version}`,
                label: `${definition.name} · v${definition.version}`,
              })),
            ]}
            data-testid="workload-report-definition"
          />
          <button
            type="button"
            onClick={() => void generateReport()}
            disabled={reportBusy || !definitionRef}
            className="inline-flex h-9 items-center gap-2 rounded-full border border-c-border px-3 text-sm font-semibold text-c-text focus-visible:ring-2 focus-visible:ring-c-focus disabled:opacity-50"
          >
            <FileText size={15} />
            {reportBusy
              ? t('initiatives.workload.generatingReport', 'Generating…')
              : t('initiatives.workload.generateReport', 'Generate workload report')}
          </button>
          {reportReceipt && (
            <span className="text-xs text-c-success">
              {t('initiatives.workload.reportFrozen', 'Report frozen for approval')} ·{' '}
              {reportReceipt.slice(0, 8)}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-4 text-xs text-c-text-muted">
        <span>
          <i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-c-success" />
          {t('initiatives.workload.green', 'Below 85%')}
        </span>
        <span>
          <i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-c-warning" />
          {t('initiatives.workload.amber', '85–100%')}
        </span>
        <span>
          <i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-c-danger" />
          {t('initiatives.workload.red', 'Above 100%')}
        </span>
      </div>

      {proposals.length > 0 && (
        <div className="rounded-lg border border-c-border-subtle bg-c-surface p-3">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-c-text">
                {t('initiatives.workload.proposalsTitle', 'Planning proposals')}
              </h3>
              <p className="text-xs text-c-text-muted">
                {t(
                  'initiatives.workload.proposalsDisclaimer',
                  'Suggestions require human approval and do not change running assignments.'
                )}
              </p>
            </div>
          </div>
          <StandardTable
            columns={proposalColumns}
            data={proposals.map((proposal) => ({ ...proposal, id: proposal.proposalId }))}
            persistKey="initiatives.workload.proposals.v1"
            emptyMessage={t('initiatives.workload.noProposals', 'No safe planning move was found.')}
          />
        </div>
      )}

      {state === 'loading' ? (
        <div role="status" className="p-6 text-sm text-c-text-muted">
          {t('common.loading', 'Loading…')}
        </div>
      ) : state === 'error' ? (
        <div role="alert" className="flex items-center gap-2 p-6 text-sm text-c-danger">
          <AlertTriangle size={16} />{' '}
          {t('initiatives.workload.error', 'Workload data could not be loaded.')}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-hidden">
          <TableWithPreviewLayout<WorkloadTableRow>
            selectedId={selectedId}
            selectedItem={selected}
            onSelect={setSelectedId}
            onOpenFull={() => undefined}
            itemIds={tableRows.map((row) => row.id)}
            getItemById={(id) => tableRows.find((row) => row.id === id) ?? null}
            previewOpen={Boolean(selected)}
            renderPreview={(row) => (
              <StandardPreview
                embedded
                title={row.title}
                onClose={() => setSelectedId(null)}
                meta={{
                  pills: [
                    { label: row.role || t('common.unassigned', 'Unassigned'), tone: 'neutral' },
                  ],
                }}
                details={{
                  properties: [
                    {
                      id: 'capacity',
                      label: t('initiatives.workload.capacity', 'Weekly capacity'),
                      value: `${row.weeklyCapacityHours} h`,
                    },
                    {
                      id: 'availability',
                      label: t('initiatives.workload.availability', 'Availability'),
                      value: `${row.availabilityPercent}%`,
                    },
                    {
                      id: 'source',
                      label: t('initiatives.workload.source', 'Capacity source'),
                      value:
                        row.supplySource === 'PROFIL'
                          ? t('initiatives.workload.profile', 'Person profile')
                          : t('initiatives.workload.default', 'Default policy'),
                    },
                  ],
                  onCopy: () => {
                    void navigator.clipboard?.writeText(
                      `${row.title}: ${row.weeklyCapacityHours} h, ${row.availabilityPercent}%`
                    );
                  },
                }}
                ai={{
                  hints: [
                    t(
                      'initiatives.workload.aiHint',
                      'Ask for planning proposals when a future week exceeds available capacity.'
                    ),
                  ],
                  disabled: false,
                }}
                relations={
                  projectId
                    ? [
                        {
                          id: projectId,
                          label:
                            projects.find((project) => project.id === projectId)?.label ||
                            projectId,
                          type: 'project',
                        },
                      ]
                    : []
                }
                relationsEmptyLabel={t(
                  'initiatives.workload.allProjectsRelation',
                  'Organization-wide workload scope'
                )}
                actions={
                  row.id === currentUserId
                    ? {
                        informational: [
                          {
                            id: 'save-availability',
                            variant: 'neutral',
                            label: t('initiatives.workload.saveAvailability', 'Save availability'),
                            icon: Save,
                            shortcut: 'S',
                            onClick: () => void saveCapacity(),
                          },
                        ],
                      }
                    : undefined
                }
                whatsNext={{
                  items: [
                    {
                      id: 'propose-plan-moves',
                      label: t('initiatives.workload.propose', 'Propose plan moves'),
                      icon: Sparkles,
                      onClick: () => void proposeMoves(),
                    },
                  ],
                  note: t(
                    'initiatives.workload.proposalsDisclaimer',
                    'Suggestions require human approval and do not change running assignments.'
                  ),
                }}
              />
            )}
          >
            <StandardTable
              columns={columns}
              data={tableRows}
              selectedRowId={selectedId}
              onRowClick={(row) => setSelectedId(String(row.id))}
              rowMenu={workloadRowMenu}
              persistKey="initiatives.workload.e1.v1"
              emptyMessage={t(
                'initiatives.workload.empty',
                'No scheduled workload matches this scope.'
              )}
            />
          </TableWithPreviewLayout>
        </div>
      )}
    </section>
  );
};

export default InitiativeWorkloadSurface;
