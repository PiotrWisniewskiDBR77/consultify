/**
 * „Raport z pracy" (P1) — lista przebiegów + kreator.
 *
 * KANON (przejazd RP1b, 14.09): lista to `StandardTable` OSADZONY w
 * `TableWithPreviewLayout`, a pojedynczy przebieg otwiera się w
 * `StandardPreview` (6 bloków). Do 14.09 klik w wiersz NIC nie robił —
 * jedynym wyjściem były dwa przyciski w kolumnie „Akcje", a status doręczenia
 * per adresat nie był widoczny NIGDZIE, mimo że silnik go trzyma
 * (`reportRun.deliveryAttempts`) i `GET /report-runs` go zwraca.
 *
 * ZERO własnej tabeli, zero własnej stopki, zero `primary-*` (crimson).
 * Etykiety statusów/kadencji: `workReportLabels.ts` (kanon §7.3 — żadnych
 * surowych kodów UPPER_SNAKE na ekranie; surowy kod zostaje w `title`).
 */
import { CheckCircle2, ChevronDown, ChevronRight, FileText, Mail, RefreshCw } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { StandardPreview, StandardTable, type TableColumn } from '@/components/standard';
import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';
import { SelectField } from '@/components/ui/primitives';
import { readMemberId, readMemberLabel } from '@/hooks/useOrganizationMemberNames';
import { OrganizationApi } from '@/services/api/organizations.api';
import { isAdminOwnerOrSuperAdminRole } from '@/utils/roleGuards';
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

import type { WorkReportDelivery } from './workReportLabels';
import {
  failedWorkReportDeliveryCount,
  flattenWorkReportDeliveries,
  workReportCadenceLabel,
  workReportRecipientStatusLabel,
  workReportRecipientStatusTone,
  workReportRunStatusLabel,
  workReportRunStatusTone,
  workReportTemplateLabel,
} from './workReportLabels';

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

export function isEligibleWorkReportApprover(
  member: Record<string, unknown>,
  currentUserId: string
): boolean {
  const memberId = readMemberId(member);
  const role = String(member.role ?? member.organizationRole ?? member.organization_role ?? '');
  const status = String(member.status ?? 'active')
    .trim()
    .toLowerCase();
  return (
    Boolean(memberId) &&
    memberId !== currentUserId &&
    status === 'active' &&
    isAdminOwnerOrSuperAdminRole(role)
  );
}

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
  /** Wiersz otwarty w `StandardPreview` (single-click) — skaza 1 przejazdu Z-29. */
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  /**
   * Kreator ZWINIĘTY domyślnie (skaza 6 przejazdu Z-29). Kanon: ekran listowy
   * ma na górze LISTĘ, a tworzenie jest akcją — do 14.09 kreator zajmował całe
   * pierwsze okno, a tabela przebiegów była pod nim, poza kadrem.
   */
  const [creatorOpen, setCreatorOpen] = useState(false);
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
        .filter((member) => isEligibleWorkReportApprover(member, currentUserId))
        .map((member) => ({ id: readMemberId(member), label: readMemberLabel(member) || '' }))
        .filter((member) => member.id && member.label);
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
        asOf: new Date().toISOString(),
        workReport: {
          title: form.title.trim(),
          templateId: form.templateId,
          cadence: form.cadence,
          projectIds,
        },
        sources: [],
        ownerId: selectedDefinition.ownerId,
        approverId: selectedDefinition.approverId,
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
      profile: 'initiative_work_report',
      outcome: 'APPROVED',
      rationale: t('initiatives.workReport.approvalRationale', 'Approved for distribution'),
      expectedVersion: run.version,
      clientRequestId: crypto.randomUUID(),
    });
    toast.success(t('initiatives.workReport.approved', 'Report approved.'));
    await load();
  };
  const locale = i18n.resolvedLanguage === 'pl' ? 'pl-PL' : 'en-US';
  const dateTimeLabel = (value: unknown): string => {
    const date = new Date(String(value ?? ''));
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString(locale);
  };

  /**
   * Model wiersza LICZONY RAZ i współdzielony przez tabelę, kebab i podgląd —
   * żeby kolumna Status, plakietka podglądu i etykieta pozycji kebaba nie
   * mogły się rozjechać (dokładnie ten rozjazd był skazą 2 i 3).
   */
  const rows = useMemo(
    () =>
      runs.map((run) => {
        const rawStatus = String(run.status ?? '');
        const rawCadence = String(run.workReport?.cadence ?? 'ON_DEMAND');
        const rawTemplate = String(run.workReport?.templateId ?? '');
        const deliveries = flattenWorkReportDeliveries(run);
        const projectIds: string[] = Array.isArray(run.workReport?.projectIds)
          ? run.workReport.projectIds
          : [];
        return {
          ...run,
          id: String(run.reportRunId),
          title: String(run.workReport?.title || run.reportRunId),
          rawStatus,
          rawCadence,
          statusLabel: workReportRunStatusLabel(t, rawStatus),
          statusTone: workReportRunStatusTone(rawStatus),
          cadenceLabel: workReportCadenceLabel(t, rawCadence),
          templateLabel: rawTemplate ? workReportTemplateLabel(t, rawTemplate) : '—',
          rawTemplate,
          updatedLabel: dateTimeLabel(run.updatedAt),
          periodLabel:
            run.period?.start && run.period?.end
              ? `${dateTimeLabel(run.period.start)} – ${dateTimeLabel(run.period.end)}`
              : '—',
          scopeLabel: projectIds.length
            ? t('initiatives.workReport.scopeProjects', 'Selected projects ({{count}})', {
                count: projectIds.length,
              })
            : t('initiatives.workReport.scopeOrganization', 'Whole organization'),
          deliveries,
          failedCount: failedWorkReportDeliveryCount(deliveries),
          canDownload: ['FROZEN', 'APPROVED', 'PUBLISHED'].includes(rawStatus),
          canApprove: rawStatus === 'FROZEN' && run.approverId === currentUserId,
          canDeliver:
            ['APPROVED', 'PUBLISHED'].includes(rawStatus) && run.approverId === currentUserId,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [runs, t, locale, currentUserId]
  );

  type WorkReportRow = (typeof rows)[number];

  const selectedRun = useMemo(
    () => rows.find((row) => row.id === selectedRunId) ?? null,
    [rows, selectedRunId]
  );

  /** Etykieta akcji wysyłki — „Wyślij" za pierwszym razem, „Ponów" po błędzie. */
  const sendLabel = (row: WorkReportRow) =>
    row.failedCount > 0
      ? t('initiatives.workReport.retry', 'Retry delivery')
      : t('initiatives.workReport.send', 'Send');

  const columns: TableColumn[] = [
    {
      id: 'title',
      label: t('initiatives.workReport.columns.title', 'Title'),
      width: '280px',
      sortable: true,
      render: (row) => <span className="font-semibold">{String((row as any).title)}</span>,
    },
    /*
     * Status i kadencja BEZ własnego `render` — celowo. `FilterableTable`
     * zakłada wielokropek i `title` (CELL_TEXT_CLAMP_CLASS) TYLKO tekstowi,
     * który dostaje jako czysty string; własny `<span>` traktuje jak element
     * (popover/menu) i zostawia nietknięty — zmierzone na zrzucie 01 z 14.09:
     * „Opublikowany" ucięte w połowie słowa pod sąsiednią kolumną. Surowy kod
     * silnika nie znika — stoi w tooltipie tabeli właściwości podglądu.
     */
    {
      id: 'statusLabel',
      label: t('initiatives.workReport.columns.status', 'Status'),
      width: '190px',
      sortable: true,
    },
    {
      id: 'cadenceLabel',
      label: t('initiatives.workReport.columns.cadence', 'Cadence'),
      width: '150px',
      sortable: true,
    },
    {
      id: 'updatedLabel',
      label: t('initiatives.workReport.columns.updated', 'Updated'),
      width: '190px',
      sortable: true,
    },
  ];

  /**
   * MUST #6 triady — kebab wiersza zamiast dwóch przycisków w komórce.
   * Zawartość jest KONTEKSTOWA (blokada niesie powód w `note`), więc wiersz,
   * którego nie wolno wysłać, mówi dlaczego, zamiast pokazywać wyszarzony
   * przycisk bez wyjaśnienia.
   */
  const rowMenu = (row: any) => {
    const reportRow = row as WorkReportRow;
    return {
      primary: [
        {
          id: 'pdf',
          label: t('initiatives.workReport.openPdf', 'Open PDF'),
          icon: FileText,
          disabled: !reportRow.canDownload,
          note: reportRow.canDownload
            ? undefined
            : t('initiatives.workReport.needsFrozenNote', 'The PDF appears once the run is frozen.'),
          onClick: () => void download(reportRow),
        },
        ...(reportRow.canApprove
          ? [
              {
                id: 'approve',
                label: t('initiatives.workReport.approve', 'Approve'),
                icon: CheckCircle2,
                onClick: () => void approve(reportRow),
              },
            ]
          : []),
        {
          id: 'deliver',
          label: sendLabel(reportRow),
          icon: Mail,
          disabled: !reportRow.canDeliver,
          note: reportRow.canDeliver
            ? undefined
            : t(
                'initiatives.workReport.needsApproverNote',
                'Only the named approver can approve and deliver this run.'
              ),
          onClick: () => void deliver(reportRow),
        },
      ],
      universalHandlers: {
        preview: () => setSelectedRunId(reportRow.id),
      },
    };
  };

  return (
    <section
      className="flex h-full min-h-0 flex-col overflow-y-auto p-4 text-c-text"
      aria-label={t('initiatives.workReport.title', 'Work report creator')}
      data-testid="initiatives-work-report"
    >
      {/* `min-h-0` na kolumnie — bez tego `flex-1` tabeli rozpycha rodzica
          zamiast oddać podglądowi wysokość (ta sama pułapka co w H1b). */}
      <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col gap-5">
        <header className="flex shrink-0 items-start justify-between gap-4">
          <div>
            {/* Nagłówek opisuje TO, CO WIDAĆ: listę przebiegów. Do 14.09
                pisał „Kreator raportu z pracy" nad tabelą przebiegów —
                a kreator jest teraz akcją, nie treścią ekranu. */}
            <h2 className="text-xl font-semibold">
              {t('initiatives.workReport.listTitle', 'Work reports')}
            </h2>
            <p className="text-sm text-c-text-muted">
              {t(
                'initiatives.workReport.listDescription',
                'Frozen report runs with their approval and delivery status.'
              )}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {/* Skaza 6 — tworzenie jest AKCJĄ w pasku, nie blokiem zajmującym
                pierwsze okno nad listą. */}
            <button
              type="button"
              aria-expanded={creatorOpen}
              aria-controls="work-report-creator"
              data-testid="work-report-creator-toggle"
              className="inline-flex items-center gap-1.5 rounded-full border border-c-border-strong bg-c-surface-raised px-3 py-2 text-sm font-medium text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              onClick={() => setCreatorOpen((open) => !open)}
            >
              {creatorOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              {creatorOpen
                ? t('initiatives.workReport.creatorHide', 'Hide the form')
                : t('initiatives.workReport.creatorShow', 'New report')}
            </button>
            <button
              type="button"
              className="rounded-full border border-c-border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              onClick={() => void load()}
            >
              <RefreshCw size={15} className="inline" /> {t('common.refresh', 'Refresh')}
            </button>
          </div>
        </header>
        {/* LISTA NA GÓRZE — kanon: ekran listowy zaczyna się od listy.
            `min-h-0 flex-1` oddaje podglądowi pełną wysokość kolumny. */}
        {/* Rozwinięty kreator NIE zostawia pustej dziury pod tabelą: lista
            dostaje wtedy stałe okno, a `flex-1` wraca po zwinięciu. */}
        <div className={creatorOpen ? 'h-[420px] shrink-0' : 'min-h-0 flex-1'}>
          <TableWithPreviewLayout<WorkReportRow>
            selectedId={selectedRunId}
            selectedItem={selectedRun}
            onSelect={setSelectedRunId}
            itemIds={rows.map((row) => row.id)}
            previewOpen={Boolean(selectedRun)}
            /* Przebieg nie ma własnego ekranu — zamrożoną treścią JEST PDF.
               Kanon FIX-1: powiedz to wprost zamiast milczeć o przycisku. */
            openDisabledReason={t(
              'initiatives.workReport.openDisabled',
              'A report run has no screen of its own — the frozen content is the PDF.'
            )}
            renderPreview={(row) => (
              <StandardPreview
                embedded
                title={row.title}
                onClose={() => setSelectedRunId(null)}
                openDisabledReason={t(
                  'initiatives.workReport.openDisabled',
                  'A report run has no screen of its own — the frozen content is the PDF.'
                )}
                meta={{
                  /* DWA chipy, nie trzy: nazwa szablonu („Tygodniowa
                     aktualizacja zespołu") łamała pigułkę na trzy linie
                     i rozpychała kartę meta — szablon ma własny wiersz
                     w tabeli właściwości. */
                  pills: [
                    { label: row.statusLabel, tone: row.statusTone },
                    { label: row.cadenceLabel, tone: 'neutral' },
                  ],
                  trailing: row.updatedLabel,
                  recommendation:
                    row.failedCount > 0
                      ? t(
                          'initiatives.workReport.retryHint',
                          'Retry delivery to {{count}} recipient(s)',
                          { count: row.failedCount }
                        )
                      : undefined,
                }}
                details={{
                  label: t('initiatives.workReport.previewWhy', 'Why this report'),
                  text: t(
                    'initiatives.workReport.previewWhyText',
                    'A frozen snapshot of initiative and decision data for the period below. The content cannot change after freezing — only the delivery status does.'
                  ),
                  propertyLabel: t('standardPreview.property', 'Property'),
                  valueLabel: t('standardPreview.value', 'Value'),
                  properties: [
                    {
                      id: 'template',
                      label: t('initiatives.workReport.previewProperties.template', 'Template'),
                      value: <span title={row.rawTemplate}>{row.templateLabel}</span>,
                    },
                    {
                      id: 'cadence',
                      label: t('initiatives.workReport.previewProperties.cadence', 'Cadence'),
                      value: <span title={row.rawCadence}>{row.cadenceLabel}</span>,
                    },
                    {
                      id: 'scope',
                      label: t('initiatives.workReport.previewProperties.scope', 'Scope'),
                      value: row.scopeLabel,
                    },
                    {
                      id: 'approver',
                      label: t('initiatives.workReport.previewProperties.approver', 'Approver'),
                      value:
                        members.find((member) => member.id === row.approverId)?.label ||
                        String(row.approverId ?? '—'),
                    },
                    {
                      id: 'period',
                      label: t('initiatives.workReport.previewProperties.period', 'Period'),
                      value: row.periodLabel,
                    },
                    {
                      id: 'recipients',
                      label: t('initiatives.workReport.previewProperties.recipients', 'Recipients'),
                      value: String(row.deliveries.length),
                    },
                    {
                      id: 'updated',
                      label: t('initiatives.workReport.previewProperties.updated', 'Last change'),
                      value: row.updatedLabel,
                    },
                  ],
                }}
                actions={{
                  resolutions: row.canApprove
                    ? [
                        {
                          id: 'approve',
                          variant: 'positive',
                          label: t('initiatives.workReport.approve', 'Approve'),
                          icon: CheckCircle2,
                          shortcut: 'A',
                          onClick: () => void approve(row),
                        },
                      ]
                    : undefined,
                  informational: [
                    {
                      id: 'pdf',
                      variant: 'neutral',
                      label: t('initiatives.workReport.openPdf', 'Open PDF'),
                      icon: FileText,
                      disabled: !row.canDownload,
                      onClick: () => void download(row),
                    },
                    {
                      id: 'deliver',
                      variant: 'primary',
                      label: sendLabel(row),
                      icon: Mail,
                      disabled: !row.canDeliver,
                      onClick: () => void deliver(row),
                    },
                  ],
                }}
              >
                {/* Blok „Adresaci i doręczenia" — jedyne miejsce w produkcie,
                    które pokazuje `deliveryAttempts` silnika. Bez tabeli status
                    „Opublikowany" nie mówił, KTO faktycznie dostał raport. */}
                <section
                  className="rounded-lg border border-c-border bg-c-surface p-3"
                  data-testid="work-report-preview-deliveries"
                >
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-c-text-muted">
                    {t('initiatives.workReport.previewDeliveriesLabel', 'Recipients and deliveries')}
                  </h4>
                  {row.deliveries.length === 0 ? (
                    <p className="text-sm text-c-text-muted">
                      {t(
                        'initiatives.workReport.previewNoDeliveries',
                        'No delivery has been attempted yet.'
                      )}
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {row.deliveries.map((delivery: WorkReportDelivery) => {
                        const tone = workReportRecipientStatusTone(delivery.status);
                        return (
                          <li
                            key={delivery.address}
                            className="border-t border-c-border-subtle pt-2 first:border-t-0 first:pt-0"
                          >
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="min-w-0 truncate text-sm text-c-text">
                                {delivery.address}
                              </span>
                              <span
                                title={String(delivery.status)}
                                className={
                                  'shrink-0 text-xs font-medium ' +
                                  (tone === 'success'
                                    ? 'text-c-success'
                                    : tone === 'danger'
                                      ? 'text-c-danger'
                                      : 'text-c-text-muted')
                                }
                              >
                                {workReportRecipientStatusLabel(t, delivery.status)}
                              </span>
                            </div>
                            <div className="mt-0.5 text-xs text-c-text-muted">
                              {t('initiatives.workReport.previewDeliveryTime', 'Last attempt')}:{' '}
                              {delivery.lastAttemptAt ? dateTimeLabel(delivery.lastAttemptAt) : '—'}
                            </div>
                            {delivery.lastError ? (
                              <div className="mt-0.5 text-xs text-c-danger">
                                {t('initiatives.workReport.previewDeliveryError', 'Error')}:{' '}
                                {delivery.lastError}
                              </div>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              </StandardPreview>
            )}
          >
            <StandardTable
              columns={columns}
              data={rows as any}
              loading={loading}
              error={error}
              onRetry={() => void load()}
              persistKey="initiatives-work-report-runs-v1"
              minTableWidth="columns"
              selectedRowId={selectedRunId}
              onRowClick={(row) => setSelectedRunId(String((row as any).id))}
              rowMenu={rowMenu}
              empty={{
                title: t('initiatives.workReport.empty', 'No work reports yet'),
                description: t(
                  'initiatives.workReport.emptyDescription',
                  'Create the first report from current organization data.'
                ),
              }}
            />
          </TableWithPreviewLayout>
        </div>

        {/* KREATOR POD LISTĄ, domyślnie ZWINIĘTY (skaza 6): tworzenie jest
            akcją z paska, a nie blokiem zajmującym pierwsze okno nad tabelą. */}
        {creatorOpen ? (
          <div id="work-report-creator" className="shrink-0 space-y-4">
            <h3 className="text-sm font-semibold text-c-text">
              {t('initiatives.workReport.creatorTitle', 'New work report')}
            </h3>
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
              <SelectField
                label={t('initiatives.workReport.fields.template', 'Template')}
                value={form.templateId}
                onChange={(value) => setForm({ ...form, templateId: value as TemplateId })}
                options={templates.map(([id, label]) => ({ value: id, label }))}
              />
              <SelectField
                label={t('initiatives.workReport.fields.cadence', 'Cadence')}
                value={form.cadence}
                onChange={(value) => setForm({ ...form, cadence: value as any })}
                options={(['ON_DEMAND', 'WEEKLY', 'MONTHLY'] as const).map((code) => ({
                  value: code,
                  label: workReportCadenceLabel(t, code),
                }))}
              />
              <SelectField
                label={t('initiatives.workReport.fields.definition', 'Published report definition')}
                value={form.definition}
                onChange={(value) => setForm({ ...form, definition: value })}
                placeholder={t('initiatives.workReport.noDefinition', 'No published definition')}
                options={definitions.map((item) => ({
                  value: `${item.id}@${item.version}`,
                  label: `${item.name} · v${item.version}`,
                }))}
              />
              <SelectField
                label={t('initiatives.workReport.fields.scope', 'Project scope')}
                value={form.projectScope}
                onChange={(value) => setForm({ ...form, projectScope: value })}
                options={[
                  { value: 'ALL', label: t('initiatives.workReport.scope.all', 'All initiatives') },
                  ...(currentProjectId
                    ? [
                        {
                          value: 'CURRENT',
                          label: t('initiatives.workReport.scope.current', 'Current project'),
                        },
                      ]
                    : []),
                ]}
              />
              <SelectField
                label={t('initiatives.workReport.fields.approver', 'Independent approver')}
                value={form.approverId}
                onChange={(value) => setForm({ ...form, approverId: value })}
                placeholder={t(
                  'initiatives.workReport.selectApprover',
                  'Select another organization member'
                )}
                options={members.map((member) => ({ value: member.id, label: member.label }))}
                hint={
                  members.length === 0
                    ? t(
                        'initiatives.workReport.noEligibleApprover',
                        'No other active administrator can approve and deliver this report.'
                      )
                    : undefined
                }
              />
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
          </div>
        ) : null}
      </div>
    </section>
  );
}
