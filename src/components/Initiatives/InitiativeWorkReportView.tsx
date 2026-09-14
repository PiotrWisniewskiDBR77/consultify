import { Download, Mail, RefreshCw } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { StandardTable, type TableColumn } from '@/components/standard';
import { readMemberId, readMemberLabel } from '@/hooks/useOrganizationMemberNames';
import { OrganizationApi } from '@/services/api/organizations.api';
import {
  createReportDefinition,
  createReportRun,
  deliverInitiativeWorkReport,
  downloadInitiativeWorkReportPdf,
  getReportDefinition,
  listReportDefinitions,
  listReportRuns,
  previewInitiativeWorkReport,
  scheduleInitiativeWorkReport,
  transitionReportDefinition,
  transitionReportRun,
} from '@/services/initiatives-execution/runtimeApi';

type TemplateId =
  | 'EXECUTIVE_SUMMARY'
  | 'PORTFOLIO_STATUS'
  | 'DECISION_BACKLOG'
  | 'DELIVERY_RISKS'
  | 'WEEKLY_TEAM_UPDATE';
type ReportContent = {
  generatedAt: string;
  title: string;
  templateId: TemplateId;
  summary: {
    initiatives: number;
    pendingDecisions: number;
    overdueDecisions: number;
    byStatus: Record<string, number>;
  };
  initiatives: Array<{
    id: string;
    title: string;
    status: string;
    projectId: string | null;
    ownerId: string | null;
    updatedAt: string;
  }>;
  decisionDebtors: Array<{
    authorityId: string;
    authorityName: string;
    pending: number;
    overdue: number;
    oldestDueAt: string | null;
  }>;
};

const itemsAt = (payload: any): any[] =>
  Array.isArray(payload?.items) ? payload.items : Array.isArray(payload) ? payload : [];

export function InitiativeWorkReportView({
  currentProjectId,
  currentUserId,
  currentOrganizationId,
}: {
  currentProjectId?: string | null;
  currentUserId: string;
  currentOrganizationId: string;
}) {
  const { t, i18n } = useTranslation();
  const templates = useMemo(
    () =>
      [
        ['EXECUTIVE_SUMMARY', t('initiatives.workReport.templates.executive', 'Executive summary')],
        ['PORTFOLIO_STATUS', t('initiatives.workReport.templates.portfolio', 'Portfolio status')],
        ['DECISION_BACKLOG', t('initiatives.workReport.templates.decisions', 'Decision backlog')],
        ['DELIVERY_RISKS', t('initiatives.workReport.templates.risks', 'Delivery risks')],
        ['WEEKLY_TEAM_UPDATE', t('initiatives.workReport.templates.weekly', 'Weekly team update')],
      ] as Array<[TemplateId, string]>,
    [t]
  );
  const [definitions, setDefinitions] = useState<any[]>([]);
  const [definitionStates, setDefinitionStates] = useState<any[]>([]);
  const [members, setMembers] = useState<Array<{ id: string; label: string }>>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ReportContent | null>(null);
  const [form, setForm] = useState({
    title: '',
    recipients: '',
    cadence: 'ON_DEMAND' as 'ON_DEMAND' | 'WEEKLY' | 'MONTHLY',
    templateId: 'EXECUTIVE_SUMMARY' as TemplateId,
    definition: '',
    approverId: '',
    projectScope: currentProjectId ? 'CURRENT' : 'ALL',
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [definitionList, runList, memberList] = await Promise.all([
        listReportDefinitions(),
        listReportRuns(),
        currentOrganizationId
          ? OrganizationApi.getOrganizationMembers(currentOrganizationId).catch(() => [])
          : Promise.resolve([]),
      ]);
      const details = await Promise.all(
        itemsAt(definitionList).map((item) => getReportDefinition(String(item.definitionId)))
      );
      const published = details.flatMap((definition: any) =>
        (definition.versions || [])
          .filter((version: any) => version.state === 'PUBLISHED')
          .map((version: any) => ({
            id: definition.definitionId,
            version: version.definitionVersion,
            name: version.name,
            ownerId: version.ownerId,
            approverId: version.approverId,
          }))
      );
      setDefinitions(published);
      setDefinitionStates(
        details.map((definition: any) => {
          const current = (definition.versions || []).find(
            (version: any) => version.definitionVersion === definition.currentVersion
          );
          return {
            id: definition.definitionId,
            aggregateVersion: definition.version,
            definitionVersion: definition.currentVersion,
            ...current,
          };
        })
      );
      const readableMembers = (memberList as unknown as Array<Record<string, unknown>>)
        .map((member) => ({ id: readMemberId(member), label: readMemberLabel(member) || '' }))
        .filter((member) => member.id && member.label && member.id !== currentUserId);
      setMembers(readableMembers);
      setRuns(itemsAt(runList).filter((run) => run.workReport));
      setForm((current) => ({
        ...current,
        definition:
          current.definition || (published[0] ? `${published[0].id}@${published[0].version}` : ''),
        approverId: current.approverId || readableMembers[0]?.id || '',
      }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, [currentOrganizationId]);

  const recipients = form.recipients
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const selectedDefinition = definitions.find(
    (definition) => `${definition.id}@${definition.version}` === form.definition
  );
  const projectIds = form.projectScope === 'CURRENT' && currentProjectId ? [currentProjectId] : [];
  const canCreate = Boolean(
    form.title.trim() &&
    recipients.length &&
    selectedDefinition &&
    currentUserId === selectedDefinition.ownerId
  );

  const createDefinition = async () => {
    if (!form.title.trim() || !form.approverId || form.approverId === currentUserId) return;
    setBusy(true);
    try {
      const definitionId = crypto.randomUUID();
      await createReportDefinition(definitionId, {
        name: form.title.trim(),
        purpose: `Initiative work report · ${form.templateId}`,
        audience: recipients.length ? recipients : ['internal'],
        cadence: form.cadence,
        scope: {
          type: projectIds.length ? 'PROJECT' : 'ORGANIZATION',
          refs: projectIds.map((id) => `project:${id}`),
          projectIds,
          generalBacklogAllowed: projectIds.length === 0,
        },
        outputSchema: { kind: 'initiative_work_report', templateId: form.templateId },
        sections: [
          { sectionId: 'PORTFOLIO', title: 'Portfolio summary', mandatory: true },
          { sectionId: 'INITIATIVES', title: 'Initiatives', mandatory: true },
          { sectionId: 'DECISIONS', title: 'Decision owners', mandatory: true },
        ],
        sourceBindings: [
          { bindingId: 'initiatives', sourceType: 'initiative', required: true, scope: 'tenant' },
          { bindingId: 'decisions', sourceType: 'decision', required: false, scope: 'tenant' },
        ],
        formulas: [],
        units: [],
        currencies: [],
        windows: [
          {
            windowId: 'reporting-window',
            duration: form.cadence === 'MONTHLY' ? 'P1M' : 'P7D',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
          },
        ],
        access: { audienceRoles: ['OWNER', 'ADMIN'], classification: 'INTERNAL' },
        redaction: { rules: ['TENANT_BOUND'], defaultState: 'FULL' },
        freshnessThresholdMinutes: 60,
        confidenceThreshold: 'MEDIUM',
        ownerId: currentUserId,
        approverId: form.approverId,
        expectedVersion: 0,
        clientRequestId: crypto.randomUUID(),
      });
      await transitionReportDefinition(definitionId, {
        action: 'VALIDATE',
        expectedVersion: 1,
        clientRequestId: crypto.randomUUID(),
      });
      toast.success(
        t(
          'initiatives.workReport.definitionValidated',
          'Definition validated and sent for independent publication.'
        )
      );
      await load();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  const publishDefinition = async (definition: any) => {
    await transitionReportDefinition(definition.id, {
      action: 'PUBLISH',
      rationale: t(
        'initiatives.workReport.definitionPublishRationale',
        'Approved report definition'
      ),
      expectedVersion: definition.aggregateVersion,
      clientRequestId: crypto.randomUUID(),
    });
    toast.success(t('initiatives.workReport.definitionPublished', 'Definition published.'));
    await load();
  };

  const create = async () => {
    if (!canCreate) return;
    setBusy(true);
    try {
      const captured = (await previewInitiativeWorkReport({
        title: form.title.trim(),
        templateId: form.templateId,
        projectIds,
      })) as any;
      const reportRunId = crypto.randomUUID();
      await createReportRun(reportRunId, {
        definitionRef: { definitionId: selectedDefinition.id, version: selectedDefinition.version },
        parentRunRef: null,
        audience: recipients,
        scopeRefs: projectIds.length ? projectIds.map((id) => `project:${id}`) : ['organization'],
        period: {
          start: new Date(Date.now() - 7 * 86400000).toISOString(),
          end: new Date().toISOString(),
        },
        asOf: captured.content.generatedAt,
        workReport: {
          title: form.title.trim(),
          templateId: form.templateId,
          cadence: form.cadence,
          content: captured.content,
        },
        sources: captured.sources,
        ownerId: selectedDefinition.ownerId,
        approverId: selectedDefinition.approverId,
        expectedVersion: 0,
        clientRequestId: crypto.randomUUID(),
      });
      await transitionReportRun(reportRunId, {
        action: 'VALIDATE',
        expectedVersion: 1,
        clientRequestId: crypto.randomUUID(),
      });
      await transitionReportRun(reportRunId, {
        action: 'FREEZE',
        expectedVersion: 2,
        clientRequestId: crypto.randomUUID(),
      });
      if (form.cadence !== 'ON_DEMAND') {
        await scheduleInitiativeWorkReport({
          title: form.title.trim(),
          templateId: form.templateId,
          cadence: form.cadence,
          definitionId: selectedDefinition.id,
          definitionVersion: selectedDefinition.version,
          projectIds,
          ownerId: selectedDefinition.ownerId,
          approverId: selectedDefinition.approverId,
          recipients,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        });
      }
      setPreview(captured.content);
      toast.success(
        t('initiatives.workReport.saved', 'Report run was saved and frozen for approval.')
      );
      await load();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };
  const download = async (run: any) => {
    const blob = await downloadInitiativeWorkReportPdf(run.reportRunId);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `work-report-${run.reportRunId}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const deliver = async (run: any) => {
    const frozenRecipients = Array.isArray(run.audience) ? run.audience.map(String) : [];
    if (!frozenRecipients.length) return;
    await deliverInitiativeWorkReport(run.reportRunId, {
      recipients: frozenRecipients,
      expectedVersion: run.version,
      clientRequestId: crypto.randomUUID(),
    });
    toast.success(t('initiatives.workReport.delivered', 'The SMTP provider accepted the report.'));
    await load();
  };
  const approve = async (run: any) => {
    await transitionReportRun(run.reportRunId, {
      action: 'DECIDE',
      outcome: 'APPROVED',
      rationale: t('initiatives.workReport.approvalRationale', 'Approved for distribution'),
      expectedVersion: run.version,
      clientRequestId: crypto.randomUUID(),
    });
    toast.success(t('initiatives.workReport.approved', 'Report approved.'));
    await load();
  };
  const columns: TableColumn[] = [
    {
      id: 'title',
      label: t('initiatives.workReport.columns.title', 'Title'),
      width: '260px',
      render: (row) => (
        <span className="font-semibold">
          {String((row as any).workReport?.title || (row as any).reportRunId)}
        </span>
      ),
    },
    {
      id: 'status',
      label: t('initiatives.workReport.columns.status', 'Status'),
      width: '130px',
      render: (row) => String((row as any).status),
    },
    {
      id: 'cadence',
      label: t('initiatives.workReport.columns.cadence', 'Cadence'),
      width: '130px',
      render: (row) => String((row as any).workReport?.cadence || 'ON_DEMAND'),
    },
    {
      id: 'updatedAt',
      label: t('initiatives.workReport.columns.updated', 'Updated'),
      width: '180px',
      render: (row) =>
        new Date(String((row as any).updatedAt)).toLocaleString(
          i18n.resolvedLanguage === 'pl' ? 'pl-PL' : 'en-US'
        ),
    },
    {
      id: 'actions',
      label: t('common.actions', 'Actions'),
      width: '210px',
      render: (row) => {
        const run = row as any;
        return (
          <div className="flex gap-2">
            <button
              className="rounded-full border border-c-border px-3 py-1 text-xs"
              disabled={!['FROZEN', 'APPROVED', 'PUBLISHED'].includes(run.status)}
              onClick={(event) => {
                event.stopPropagation();
                void download(run);
              }}
            >
              <Download size={14} className="inline" />{' '}
              {t('initiatives.workReport.download', 'PDF')}
            </button>
            {run.status === 'FROZEN' && run.approverId === currentUserId && (
              <button
                className="rounded-full border border-c-border px-3 py-1 text-xs"
                onClick={(event) => {
                  event.stopPropagation();
                  void approve(run);
                }}
              >
                {t('initiatives.workReport.approve', 'Approve')}
              </button>
            )}
            <button
              className="rounded-full border border-c-border px-3 py-1 text-xs disabled:opacity-50"
              disabled={run.status !== 'APPROVED' || run.approverId !== currentUserId}
              onClick={(event) => {
                event.stopPropagation();
                void deliver(run);
              }}
            >
              <Mail size={14} className="inline" /> {t('initiatives.workReport.send', 'Send')}
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <section
      className="h-full overflow-auto p-4 text-c-text"
      aria-label={t('initiatives.workReport.title', 'Work report creator')}
    >
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">
              {t('initiatives.workReport.title', 'Work report creator')}
            </h2>
            <p className="text-sm text-c-text-muted">
              {t(
                'initiatives.workReport.description',
                'Create a frozen report from current initiative and decision data.'
              )}
            </p>
          </div>
          <button
            className="rounded-full border border-c-border px-3 py-2 text-sm"
            onClick={() => void load()}
          >
            <RefreshCw size={15} className="inline" /> {t('common.refresh', 'Refresh')}
          </button>
        </header>
        <div className="grid gap-4 rounded-xl border border-c-border p-4 md:grid-cols-2">
          <label className="text-sm">
            {t('initiatives.workReport.fields.title', 'Title')}
            <input
              className="mt-1 w-full rounded-lg border border-c-border bg-c-surface p-2"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
          <label className="text-sm">
            {t(
              'initiatives.workReport.fields.recipients',
              'Recipients (comma-separated email addresses)'
            )}
            <input
              className="mt-1 w-full rounded-lg border border-c-border bg-c-surface p-2"
              value={form.recipients}
              onChange={(e) => setForm({ ...form, recipients: e.target.value })}
            />
          </label>
          <label className="text-sm">
            {t('initiatives.workReport.fields.template', 'Template')}
            <select
              className="mt-1 w-full rounded-lg border border-c-border bg-c-surface p-2"
              value={form.templateId}
              onChange={(e) => setForm({ ...form, templateId: e.target.value as TemplateId })}
            >
              {templates.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            {t('initiatives.workReport.fields.cadence', 'Cadence')}
            <select
              className="mt-1 w-full rounded-lg border border-c-border bg-c-surface p-2"
              value={form.cadence}
              onChange={(e) => setForm({ ...form, cadence: e.target.value as any })}
            >
              <option value="ON_DEMAND">
                {t('initiatives.workReport.cadence.onDemand', 'On demand')}
              </option>
              <option value="WEEKLY">{t('initiatives.workReport.cadence.weekly', 'Weekly')}</option>
              <option value="MONTHLY">
                {t('initiatives.workReport.cadence.monthly', 'Monthly')}
              </option>
            </select>
          </label>
          <label className="text-sm">
            {t('initiatives.workReport.fields.definition', 'Published report definition')}
            <select
              className="mt-1 w-full rounded-lg border border-c-border bg-c-surface p-2"
              value={form.definition}
              onChange={(e) => setForm({ ...form, definition: e.target.value })}
            >
              <option value="">
                {t('initiatives.workReport.noDefinition', 'No published definition')}
              </option>
              {definitions.map((item) => (
                <option key={`${item.id}@${item.version}`} value={`${item.id}@${item.version}`}>
                  {item.name} · v{item.version}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            {t('initiatives.workReport.fields.scope', 'Project scope')}
            <select
              className="mt-1 w-full rounded-lg border border-c-border bg-c-surface p-2"
              value={form.projectScope}
              onChange={(e) => setForm({ ...form, projectScope: e.target.value })}
            >
              <option value="ALL">
                {t('initiatives.workReport.scope.all', 'All initiatives')}
              </option>
              {currentProjectId && (
                <option value="CURRENT">
                  {t('initiatives.workReport.scope.current', 'Current project')}
                </option>
              )}
            </select>
          </label>
          <label className="text-sm">
            {t('initiatives.workReport.fields.approver', 'Independent approver')}
            <select
              className="mt-1 w-full rounded-lg border border-c-border bg-c-surface p-2"
              value={form.approverId}
              onChange={(e) => setForm({ ...form, approverId: e.target.value })}
            >
              <option value="">
                {t('initiatives.workReport.selectApprover', 'Select another organization member')}
              </option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2 md:col-span-2">
            <button
              disabled={!form.title.trim() || !form.approverId || busy}
              className="rounded-full border border-c-border px-4 py-2 font-semibold disabled:opacity-50"
              onClick={() => void createDefinition()}
            >
              {t('initiatives.workReport.createDefinition', 'Create definition')}
            </button>
            <button
              disabled={!canCreate || busy}
              className="rounded-full border border-c-border-strong bg-c-surface-raised px-4 py-2 font-semibold disabled:opacity-50"
              onClick={() => void create()}
            >
              {busy
                ? t('initiatives.workReport.creating', 'Creating…')
                : t('initiatives.workReport.create', 'Create and freeze')}
            </button>
            {selectedDefinition && currentUserId !== selectedDefinition.ownerId && (
              <p className="mt-2 text-sm text-c-text-muted">
                {t(
                  'initiatives.workReport.ownerRequired',
                  'The definition owner must create and freeze this report.'
                )}
              </p>
            )}
          </div>
        </div>
        {definitionStates.some((definition) => definition.state === 'VALIDATED') && (
          <div className="rounded-xl border border-c-border p-4">
            <h3 className="mb-2 font-semibold">
              {t('initiatives.workReport.awaitingDefinitions', 'Definitions awaiting publication')}
            </h3>
            {definitionStates
              .filter((definition) => definition.state === 'VALIDATED')
              .map((definition) => (
                <div
                  key={definition.id}
                  className="flex items-center justify-between gap-3 border-t border-c-border-subtle py-2"
                >
                  <span>{definition.name}</span>
                  <button
                    disabled={definition.approverId !== currentUserId}
                    className="rounded-full border border-c-border px-3 py-1 text-sm disabled:opacity-50"
                    onClick={() => void publishDefinition(definition)}
                  >
                    {t('initiatives.workReport.publishDefinition', 'Publish definition')}
                  </button>
                </div>
              ))}
          </div>
        )}
        {preview && (
          <div className="rounded-xl border border-c-border p-4">
            <h3 className="font-semibold">{preview.title}</h3>
            <p className="text-sm text-c-text-muted">
              {preview.summary.initiatives} ·{' '}
              {t('initiatives.workReport.pendingDecisions', 'pending decisions')}:{' '}
              {preview.summary.pendingDecisions} ·{' '}
              {t('initiatives.workReport.overdueDecisions', 'overdue')}:{' '}
              {preview.summary.overdueDecisions}
            </p>
          </div>
        )}
        <StandardTable
          columns={columns}
          data={runs.map((run) => ({ ...run, id: run.reportRunId }))}
          loading={loading}
          error={error}
          onRetry={() => void load()}
          persistKey="initiatives-work-report-runs-v1"
          minTableWidth="columns"
          empty={{
            title: t('initiatives.workReport.empty', 'No work reports yet'),
            description: t(
              'initiatives.workReport.emptyDescription',
              'Create the first report from current organization data.'
            ),
          }}
        />
      </div>
    </section>
  );
}
