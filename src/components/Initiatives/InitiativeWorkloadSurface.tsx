import { AlertTriangle, RefreshCw } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';
import { StandardPreview } from '@/components/standard/StandardPreview';
import {
  StandardTable,
  type TableColumn,
  type TableRow,
} from '@/components/standard/StandardTable';
import {
  readInitiativeWorkload,
  type InitiativeWorkloadResponse,
  type InitiativeWorkloadRow,
} from '@/services/initiatives/initiativeWorkloadApi';
import type {
  ResourcePlanPerson,
} from '@/services/execution/resourcePlanApi';
import { getLocalizedStatusLabel } from '@/services/initiativeLifecycle';
import {
  InitiativeStatus,
  type InitiativeStatus as InitiativeStatusCode,
} from '../../../packages/shared/src/constants/initiativeStatuses.generated';

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

const toTableRow = (person: ResourcePlanPerson, rows: InitiativeWorkloadRow[]): WorkloadTableRow => ({
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

export const InitiativeWorkloadSurface: React.FC<{ initiatives: InitiativeScopeRow[] }> = ({
  initiatives,
}) => {
  const { t, i18n } = useTranslation();
  const [projectId, setProjectId] = useState('');
  const [initiativeStatus, setInitiativeStatus] = useState('');
  const [weeks, setWeeks] = useState(8);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [result, setResult] = useState<InitiativeWorkloadResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

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

  return (
    <section
      aria-label={t('initiatives.workload.aria', 'Initiatives workload')}
      className="flex h-full min-h-0 flex-col gap-3 p-4"
    >
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-c-border-subtle bg-c-surface px-3 py-2">
        <label className="text-xs font-medium text-c-text-secondary">
          {t('initiatives.workload.projectScope', 'Project scope')}
          <select
            aria-label={t('initiatives.workload.projectScope', 'Project scope')}
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
            className="mt-1 block h-9 min-w-44 rounded-lg border border-c-border bg-c-surface-raised px-3 text-sm text-c-text focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            <option value="">{t('initiatives.workload.allProjects', 'All projects')}</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-c-text-secondary">
          {t('initiatives.workload.initiativeStatus', 'Initiative status')}
          <select
            aria-label={t('initiatives.workload.initiativeStatus', 'Initiative status')}
            value={initiativeStatus}
            onChange={(event) => setInitiativeStatus(event.target.value)}
            className="mt-1 block h-9 min-w-40 rounded-lg border border-c-border bg-c-surface-raised px-3 text-sm text-c-text focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            <option value="">{t('common.all', 'All')}</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {getLocalizedStatusLabel(status as InitiativeStatusCode, (key) => t(key))}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-c-text-secondary">
          {t('initiatives.workload.horizon', 'Horizon')}
          <select
            aria-label={t('initiatives.workload.horizon', 'Horizon')}
            value={weeks}
            onChange={(event) => setWeeks(Number(event.target.value))}
            className="mt-1 block h-9 rounded-lg border border-c-border bg-c-surface-raised px-3 text-sm text-c-text focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            {[4, 8, 12, 26].map((value) => (
              <option key={value} value={value}>
                {value} {t('initiatives.workload.weeks', 'weeks')}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => setRefreshKey((value) => value + 1)}
          className="ml-auto inline-flex h-9 items-center gap-2 rounded-full border border-c-border px-3 text-sm text-c-text-secondary hover:bg-c-surface-raised focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          <RefreshCw size={15} /> {t('common.refresh', 'Refresh')}
        </button>
      </div>

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
                }}
              />
            )}
          >
            <StandardTable
              columns={columns}
              data={tableRows}
              selectedRowId={selectedId}
              onRowClick={(row) => setSelectedId(String(row.id))}
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
