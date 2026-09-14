import { CheckCircle2, Download, Mail, RefreshCw } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { readMemberId, readMemberLabel } from '@/hooks/useOrganizationMemberNames';
import { OrganizationApi } from '@/services/api/organizations.api';
import {
  createReportRun,
  createExecutionReportSchedule,
  deliverExecutionReportProfile,
  downloadExecutionReportProfilePdf,
  getReportDefinition,
  listReportDefinitions,
  listReportRuns,
  transitionReportRun,
} from '@/services/initiatives-execution/runtimeApi';
import {
  createExecutionReportRun,
  listExecutionReportDefinitions,
  type ExecutionReportDefinitionDto,
} from '@/services/executionReports/executionReportsApi';
import { isAdminOwnerOrSuperAdminRole } from '@/utils/roleGuards';
import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';
import {
  StandardPreview,
  StandardTable,
  type TableColumn,
  type TableRow,
} from '@/components/standard';
import { Menu2PresetDropdown } from '@/components/standard/Menu2PresetDropdown';

import type { ExecutionMenu3Contract, ExecutionSurfacePrimaryCta } from './canonicalMenu3';

type DetailLevel = 'EXECUTIVE' | 'MANAGEMENT' | 'DETAILED';
type Cadence = 'ON_DEMAND' | 'WEEKLY' | 'MONTHLY';

interface ReportRow extends TableRow {
  id: string;
  title: string;
  template: string;
  templateId: string;
  detail: string;
  cadence: string;
  status: string;
  rawStatus: string;
  period: string;
  source: any;
}

const itemsAt = (value: any): any[] => (Array.isArray(value?.items) ? value.items : []);
const isoDay = (value: Date) => value.toISOString().slice(0, 10);

export const executionReportE4Enabled =
  typeof import.meta !== 'undefined' && import.meta.env.VITE_EXECUTION_REPORT_E4 === 'true';

export function isEligibleExecutionReportApprover(
  member: Record<string, unknown>,
  currentUserId: string
) {
  const id = readMemberId(member);
  const role = String(member.role ?? member.organizationRole ?? member.organization_role ?? '');
  const status = String(member.status ?? 'active').toLowerCase();
  return (
    Boolean(id) && id !== currentUserId && status === 'active' && isAdminOwnerOrSuperAdminRole(role)
  );
}

export function ExecutionReportE4Surface({
  activePreset,
  onCountsChange,
  onRegisterFilterControl,
  onRegisterPrimaryCta,
  onRegisterMenu3Control,
  currentUserId,
  currentOrganizationId,
}: ExecutionMenu3Contract & {
  onRegisterFilterControl?: (node: React.ReactNode) => void;
  onRegisterPrimaryCta?: (cta: ExecutionSurfacePrimaryCta | null) => void;
  onRegisterMenu3Control?: (node: React.ReactNode) => void;
  currentUserId: string;
  currentOrganizationId: string;
}) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [definitions, setDefinitions] = useState<ExecutionReportDefinitionDto[]>([]);
  const [runtimeDefinitions, setRuntimeDefinitions] = useState<any[]>([]);
  const [approvers, setApprovers] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  // Kanon TRIADA: Menu 3 ma NAJWYŻEJ 3 pigułki. „Report templates" nie jest
  // filtrem statusu, więc schodzi z Menu 3 do dropdownu Menu 2 (wzorzec
  // Materiałów DEC-420 / „Po terminie" z ExecutionControlSurface) — działa
  // dodatkowo w każdym z trzech widoków statusu, nie zamiast nich.
  const [templateFilter, setTemplateFilter] = useState<string>('all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const now = new Date();
  const [form, setForm] = useState({
    title: '',
    recipients: '',
    templateId: '',
    definitionRef: '',
    approverId: '',
    detailLevel: 'MANAGEMENT' as DetailLevel,
    cadence: 'ON_DEMAND' as Cadence,
    periodStart: isoDay(new Date(now.getTime() - 6 * 86400000)),
    periodEnd: isoDay(now),
  });

  const statusLabel = useCallback(
    (status: string) => t(`executionReports.status.${status.toLowerCase()}`, status),
    [t]
  );
  const detailLabel = useCallback(
    (detail: string) => t(`executionReports.e4.detail.${detail.toLowerCase()}`, detail),
    [t]
  );
  const cadenceLabel = useCallback(
    (cadence: string) => t(`executionReports.e4.cadence.${cadence.toLowerCase()}`, cadence),
    [t]
  );

  const load = useCallback(async () => {
    setError(null);
    try {
      const [catalog, definitionList, runList, memberList] = await Promise.all([
        listExecutionReportDefinitions(),
        listReportDefinitions(),
        listReportRuns(),
        OrganizationApi.getOrganizationMembers(currentOrganizationId),
      ]);
      const details = await Promise.all(
        itemsAt(definitionList).map((item) => getReportDefinition(item.definitionId))
      );
      const published = details.flatMap((definition: any) =>
        (definition.versions ?? [])
          .filter(
            (version: any) => version.state === 'PUBLISHED' && version.ownerId === currentUserId
          )
          .map((version: any) => ({
            id: definition.definitionId,
            version: version.definitionVersion,
            name: version.name,
            ownerId: version.ownerId,
            approverId: version.approverId,
          }))
      );
      const readableApprovers = (memberList as unknown as Array<Record<string, unknown>>)
        .filter((member) => isEligibleExecutionReportApprover(member, currentUserId))
        .map((member) => ({
          id: readMemberId(member),
          label: readMemberLabel(member) || readMemberId(member),
        }));
      const catalogDefinitions = catalog.definitions.filter((definition) => definition.mvp);
      setDefinitions(catalogDefinitions);
      setRuntimeDefinitions(published);
      setApprovers(readableApprovers);
      setForm((current) => ({
        ...current,
        templateId: current.templateId || catalogDefinitions[0]?.key || '',
        definitionRef:
          current.definitionRef ||
          (published[0] ? `${published[0].id}@${published[0].version}` : ''),
        approverId:
          current.approverId ||
          (readableApprovers.some((item) => item.id === published[0]?.approverId)
            ? published[0].approverId
            : ''),
      }));
      setRows(
        itemsAt(runList)
          .filter((run) => run.workReport?.profile === 'execution_report')
          .map((run) => ({
            id: run.reportRunId,
            title: run.workReport.title,
            // tsc: `t()` z kluczem-szablonem zwraca unię ze `$SpecialObject`;
            // `String()` jest no-opem w runtime (fallback jest stringiem).
            template: String(
              t(
                `executionReports.definitions.${run.workReport.templateId}.name`,
                run.workReport.templateId
              )
            ),
            templateId: String(run.workReport.templateId ?? ''),
            detail: detailLabel(run.workReport.detailLevel || 'MANAGEMENT'),
            cadence: cadenceLabel(run.workReport.cadence),
            status: statusLabel(run.status),
            rawStatus: run.status,
            period: `${String(run.period.start).slice(0, 10)} – ${String(run.period.end).slice(0, 10)}`,
            source: run,
          }))
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, [cadenceLabel, currentOrganizationId, currentUserId, detailLabel, statusLabel, t]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    onCountsChange?.({
      all: rows.length,
      'needs-review': rows.filter((row) => ['FROZEN', 'APPROVED'].includes(row.rawStatus)).length,
      published: rows.filter((row) => row.rawStatus === 'PUBLISHED').length,
    });
  }, [onCountsChange, rows]);
  useEffect(() => {
    onRegisterMenu3Control?.(null);
    return () => onRegisterMenu3Control?.(null);
  }, [onRegisterMenu3Control]);

  const detailOptions = useMemo(
    () =>
      (['EXECUTIVE', 'MANAGEMENT', 'DETAILED'] as DetailLevel[]).map((id) => ({
        id,
        label: detailLabel(id),
      })),
    [detailLabel]
  );
  const templateOptions = useMemo(
    () => [
      { id: 'all', label: String(t('common.all', 'All')) },
      ...definitions.map((item) => ({
        id: item.key,
        label: String(t(`executionReports.definitions.${item.key}.name`, item.name)),
      })),
    ],
    [definitions, t]
  );
  const cadenceOptions = useMemo(
    () =>
      (['ON_DEMAND', 'WEEKLY', 'MONTHLY'] as Cadence[]).map((id) => ({
        id,
        label: cadenceLabel(id),
      })),
    [cadenceLabel]
  );
  useEffect(() => {
    onRegisterFilterControl?.(
      <div className="flex items-center gap-2">
        <Menu2PresetDropdown
          label={t('executionReports.e4.detail.label', 'Detail')}
          options={detailOptions}
          value={form.detailLevel}
          onChange={(id) => setForm((current) => ({ ...current, detailLevel: id as DetailLevel }))}
          compact
        />
        <Menu2PresetDropdown
          label={t('executionReports.columns.cadence', 'Cadence')}
          options={cadenceOptions}
          value={form.cadence}
          onChange={(id) => setForm((current) => ({ ...current, cadence: id as Cadence }))}
          compact
        />
        <Menu2PresetDropdown
          label={t('executionReports.columns.definition', 'Report template')}
          options={templateOptions}
          value={templateFilter}
          onChange={setTemplateFilter}
          compact
        />
      </div>
    );
    return () => onRegisterFilterControl?.(null);
  }, [
    cadenceOptions,
    detailOptions,
    form.cadence,
    form.detailLevel,
    onRegisterFilterControl,
    t,
    templateFilter,
    templateOptions,
  ]);
  useEffect(() => {
    onRegisterPrimaryCta?.({
      label: t('executionReports.menu2.addReport', 'New report'),
      testId: 'execution-report-e4-new',
      onClick: () => setWizardOpen(true),
    });
    return () => onRegisterPrimaryCta?.(null);
  }, [onRegisterPrimaryCta, t]);

  const create = async () => {
    const [definitionId, versionText] = form.definitionRef.split('@');
    const recipients = form.recipients
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
    if (
      !form.title ||
      !definitionId ||
      !versionText ||
      !form.approverId ||
      !form.templateId ||
      recipients.length === 0
    ) {
      setError(
        t(
          'executionReports.e4.errors.required',
          'Complete the report title, recipients, template, definition and approver.'
        )
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const definition = definitions.find((item) => item.key === form.templateId);
      if (!definition) throw new Error('REPORT_TEMPLATE_REQUIRED');
      const inputs = await import('./executionReportModel').then((module) =>
        module.fetchExecutionReportInputs()
      );
      const snapshot = await import('./executionReportModel').then((module) =>
        module.buildExecutionReportSnapshot({
          definitionKey: definition.key,
          definitionName: t(`executionReports.definitions.${definition.key}.name`, definition.name),
          period: {
            start: new Date(`${form.periodStart}T00:00:00.000Z`).toISOString(),
            end: new Date(`${form.periodEnd}T23:59:59.000Z`).toISOString(),
          },
          asOf: new Date().toISOString(),
          inputs,
          t: (key: string, fallback: string, options?: unknown) =>
            String(t(key, fallback, options as never)),
        })
      );
      const persisted = await createExecutionReportRun({ ...snapshot, title: form.title });
      const reportRunId = crypto.randomUUID();
      const created: any = await createReportRun(reportRunId, {
        expectedVersion: 0,
        clientRequestId: crypto.randomUUID(),
        definitionRef: { definitionId, version: Number(versionText) },
        parentRunRef: null,
        audience: recipients,
        scopeRefs: ['organization'],
        period: snapshot.period,
        asOf: snapshot.asOf,
        sources: [],
        ownerId: currentUserId,
        approverId: form.approverId,
        workReport: {
          profile: 'execution_report',
          title: form.title,
          templateId: form.templateId,
          cadence: form.cadence,
          projectIds: [],
          detailLevel: form.detailLevel,
          snapshotId: persisted.id,
        },
      });
      let version = Number(created.aggregateVersion ?? 1);
      const validated: any = await transitionReportRun(reportRunId, {
        expectedVersion: version,
        clientRequestId: crypto.randomUUID(),
        profile: 'execution_report',
        action: 'VALIDATE',
      });
      version = Number(validated.aggregateVersion ?? version + 1);
      await transitionReportRun(reportRunId, {
        expectedVersion: version,
        clientRequestId: crypto.randomUUID(),
        profile: 'execution_report',
        action: 'FREEZE',
      });
      if (form.cadence !== 'ON_DEMAND') {
        await createExecutionReportSchedule({
          title: form.title,
          templateId: form.templateId,
          cadence: form.cadence,
          definitionId,
          definitionVersion: Number(versionText),
          projectIds: [],
          ownerId: currentUserId,
          approverId: form.approverId,
          recipients,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
          detailLevel: form.detailLevel,
          snapshotId: persisted.id,
        });
      }
      setWizardOpen(false);
      toast.success(t('executionReports.e4.created', 'Execution report frozen for approval.'));
      await load();
      setSelectedId(reportRunId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  const approve = async (row: ReportRow) => {
    setBusy(true);
    try {
      await transitionReportRun(row.id, {
        expectedVersion: row.source.version,
        clientRequestId: crypto.randomUUID(),
        profile: 'execution_report',
        action: 'DECIDE',
        outcome: 'APPROVED',
        rationale: 'EXECUTION_REPORT_APPROVED',
      });
      await load();
    } finally {
      setBusy(false);
    }
  };
  const download = async (row: ReportRow) => {
    const blob = await downloadExecutionReportProfilePdf(row.id);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `execution-report-${row.id}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const deliver = async (row: ReportRow) => {
    setBusy(true);
    try {
      await deliverExecutionReportProfile(row.id, {
        expectedVersion: row.source.version,
        clientRequestId: crypto.randomUUID(),
        recipients: row.source.frozenSnapshot?.audience ?? row.source.audience,
      });
      await load();
      toast.success(t('executionReports.e4.delivered', 'The report was delivered.'));
    } finally {
      setBusy(false);
    }
  };

  const filtered = useMemo(
    () =>
      rows.filter(
        (row) =>
          (templateFilter === 'all' || row.templateId === templateFilter) &&
          (activePreset === 'all' ||
            (activePreset === 'published'
              ? row.rawStatus === 'PUBLISHED'
              : ['FROZEN', 'APPROVED'].includes(row.rawStatus)))
      ),
    [activePreset, rows, templateFilter]
  );
  const selected = filtered.find((row) => row.id === selectedId) ?? null;
  const columns: TableColumn[] = [
    { id: 'title', label: t('executionReports.columns.title', 'Report'), width: '280px' },
    {
      id: 'template',
      label: t('executionReports.columns.definition', 'Report template'),
      width: '220px',
    },
    {
      id: 'detail',
      label: t('executionReports.e4.detail.label', 'Detail'),
      width: '150px',
      dataType: 'status',
    },
    {
      id: 'cadence',
      label: t('executionReports.columns.cadence', 'Cadence'),
      width: '150px',
      dataType: 'status',
    },
    {
      id: 'status',
      label: t('executionReports.columns.status', 'Status'),
      width: '140px',
      dataType: 'status',
    },
    {
      id: 'period',
      label: t('executionReports.columns.period', 'Period'),
      width: '210px',
      dataType: 'date',
    },
  ];

  return (
    <section
      className="flex h-full min-h-0 flex-col p-4"
      aria-label={t('executionReports.e4.title', 'Execution reports')}
    >
      {wizardOpen ? (
        <div
          className="mb-3 rounded-xl border border-c-border bg-c-surface-raised p-4"
          data-testid="execution-report-e4-wizard"
        >
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs">
              {t('executionReports.e4.fields.title', 'Report title')}
              <input
                className="mt-1 h-9 w-full rounded-lg border border-c-border-subtle bg-c-surface px-3"
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({ ...current, title: event.target.value }))
                }
              />
            </label>
            <label className="text-xs">
              {t('executionReports.e4.fields.recipients', 'Recipients')}
              <input
                className="mt-1 h-9 w-full rounded-lg border border-c-border-subtle bg-c-surface px-3"
                value={form.recipients}
                onChange={(event) =>
                  setForm((current) => ({ ...current, recipients: event.target.value }))
                }
                placeholder="name@example.com"
              />
            </label>
            <Menu2PresetDropdown
              label={t('executionReports.e4.fields.template', 'Template')}
              options={definitions.map((item) => ({
                id: item.key,
                label: t(`executionReports.definitions.${item.key}.name`, item.name),
              }))}
              value={form.templateId}
              onChange={(id) => setForm((current) => ({ ...current, templateId: id }))}
            />
            <Menu2PresetDropdown
              label={t('executionReports.e4.fields.definition', 'Governed definition')}
              options={runtimeDefinitions.map((item) => ({
                id: `${item.id}@${item.version}`,
                label: item.name,
              }))}
              value={form.definitionRef}
              onChange={(id) => {
                const [definitionId, version] = id.split('@');
                const selected = runtimeDefinitions.find(
                  (item) => item.id === definitionId && String(item.version) === version
                );
                setForm((current) => ({
                  ...current,
                  definitionRef: id,
                  approverId: selected?.approverId ?? '',
                }));
              }}
            />
            <Menu2PresetDropdown
              label={t('executionReports.e4.fields.approver', 'Approver')}
              options={approvers.map((item) => ({ id: item.id, label: item.label }))}
              value={form.approverId}
              onChange={(id) => setForm((current) => ({ ...current, approverId: id }))}
            />
            <div className="flex gap-2">
              <input
                aria-label={t('executionReports.wizard.periodStart', 'Period from')}
                type="date"
                className="h-9 rounded-lg border border-c-border-subtle bg-c-surface px-2"
                value={form.periodStart}
                onChange={(event) =>
                  setForm((current) => ({ ...current, periodStart: event.target.value }))
                }
              />
              <input
                aria-label={t('executionReports.wizard.periodEnd', 'Period to')}
                type="date"
                className="h-9 rounded-lg border border-c-border-subtle bg-c-surface px-2"
                value={form.periodEnd}
                onChange={(event) =>
                  setForm((current) => ({ ...current, periodEnd: event.target.value }))
                }
              />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              className="rounded-lg bg-c-text px-4 py-2 text-sm font-medium text-c-surface transition-opacity hover:opacity-90 disabled:opacity-50"
              disabled={busy}
              onClick={() => void create()}
            >
              {t('executionReports.wizard.generate', 'Generate snapshot')}
            </button>
            <button className="btn-secondary" onClick={() => setWizardOpen(false)}>
              {t('common.cancel', 'Cancel')}
            </button>
          </div>
        </div>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="mb-3 rounded-lg border border-c-danger/40 p-3 text-sm text-c-danger"
        >
          {error}
        </p>
      ) : null}
      <TableWithPreviewLayout<ReportRow>
        selectedId={selectedId}
        selectedItem={selected}
        onSelect={setSelectedId}
        itemIds={filtered.map((row) => row.id)}
        getItemById={(id) => filtered.find((row) => row.id === id) ?? null}
        previewOpen={Boolean(selected)}
        onOpenFull={(id) => setSelectedId(id)}
        renderPreview={(row) => (
          <StandardPreview
            embedded
            title={row.title}
            onClose={() => setSelectedId(null)}
            meta={{
              pills: [
                {
                  label: row.status,
                  tone:
                    row.rawStatus === 'PUBLISHED'
                      ? 'success'
                      : row.rawStatus === 'APPROVED'
                        ? 'info'
                        : 'neutral',
                },
                { label: row.detail, tone: 'neutral' },
              ],
              trailing: row.period,
            }}
            details={{
              label: t('executionReports.preview.contract', 'Report contents'),
              text: row.template,
              properties: [
                {
                  id: 'cadence',
                  label: t('executionReports.columns.cadence', 'Cadence'),
                  value: row.cadence,
                },
                {
                  id: 'recipients',
                  label: t('executionReports.columns.audience', 'Audience'),
                  value:
                    (row.source.frozenSnapshot?.audience ?? row.source.audience ?? []).join(', ') ||
                    '—',
                },
              ],
              onDownload: () => void download(row),
              downloadLabel: t('executionReports.e4.downloadPdf', 'Download PDF'),
            }}
            relations={(row.source.sources ?? []).map((source: any) => ({
              label: t(
                `executionReports.e4.sourceTypes.${String(source.sourceType).toLowerCase()}`,
                t('executionReports.e4.sourceTypes.evidence', 'Report evidence')
              ),
            }))}
            relationsEmptyLabel={t('executionReports.e4.noSources', 'No evidence sources')}
            whatsNext={{
              items: [
                {
                  id: 'refresh',
                  label: t('common.refresh', 'Refresh'),
                  icon: RefreshCw,
                  onClick: () => void load(),
                },
              ],
            }}
            actions={{
              resolutions: [
                {
                  id: 'approve',
                  label: t('executionReports.e4.approve', 'Approve'),
                  icon: CheckCircle2,
                  variant: 'positive',
                  onClick: () => void approve(row),
                  disabled: row.rawStatus !== 'FROZEN' || row.source.approverId !== currentUserId,
                },
              ],
              informational: [
                {
                  id: 'pdf',
                  label: t('executionReports.e4.downloadPdf', 'Download PDF'),
                  icon: Download,
                  variant: 'neutral',
                  onClick: () => void download(row),
                  disabled: !['FROZEN', 'APPROVED', 'PUBLISHED'].includes(row.rawStatus),
                },
                {
                  id: 'send',
                  label: t('executionReports.e4.send', 'Send by email'),
                  icon: Mail,
                  variant: 'neutral',
                  onClick: () => void deliver(row),
                  disabled: row.rawStatus !== 'APPROVED' || row.source.approverId !== currentUserId,
                },
              ],
            }}
          />
        )}
      >
        <StandardTable
          columns={columns}
          data={filtered}
          selectedRowId={selectedId}
          onRowClick={(row) => setSelectedId(String(row.id))}
          rowActions={(row) => [
            {
              id: 'context',
              kind: 'context',
              actions: [
                {
                  id: 'open',
                  label: t('common.open', 'Open'),
                  onClick: () => setSelectedId(String(row.id)),
                },
                {
                  id: 'pdf',
                  label: t('executionReports.e4.downloadPdf', 'Download PDF'),
                  onClick: () => void download(row as ReportRow),
                  disabled: !['FROZEN', 'APPROVED', 'PUBLISHED'].includes(
                    (row as ReportRow).rawStatus
                  ),
                },
              ],
            },
            {
              id: 'manage',
              kind: 'manage',
              actions: [
                {
                  id: 'approve',
                  label: t('executionReports.e4.approve', 'Approve'),
                  onClick: () => void approve(row as ReportRow),
                  disabled:
                    (row as ReportRow).rawStatus !== 'FROZEN' ||
                    (row as ReportRow).source.approverId !== currentUserId,
                },
                {
                  id: 'send',
                  label: t('executionReports.e4.send', 'Send by email'),
                  onClick: () => void deliver(row as ReportRow),
                  disabled:
                    (row as ReportRow).rawStatus !== 'APPROVED' ||
                    (row as ReportRow).source.approverId !== currentUserId,
                },
              ],
            },
          ]}
          empty={{
            title: t('executionReports.e4.empty', 'No execution reports yet'),
            description: t(
              'executionReports.e4.emptyHint',
              'Create the first governed report from current delivery data and KPI results.'
            ),
            // StandardTableEmpty (StandardTable.tsx:396-401) przyjmuje
            // `actionLabel` + `onAction`; `primaryAction` było ciche — pusta
            // zakładka nie miała ŻADNEGO przycisku.
            actionLabel: String(t('executionReports.menu2.addReport', 'New report')),
            onAction: () => setWizardOpen(true),
          }}
        />
      </TableWithPreviewLayout>
    </section>
  );
}
