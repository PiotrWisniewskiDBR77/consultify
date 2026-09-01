import type { TFunction } from 'i18next';
import { Calculator, ChevronRight, Copy, ExternalLink, Link2, MessageSquare } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import {
  type ActionRow,
  type DetailsAction,
  type MetaPill,
  PreviewActionBar,
  PreviewAIHintStrip,
  PreviewDetailsSection,
  PreviewMetaCard,
  PreviewRelations,
  type RelationItem,
} from '@/components/shared/PreviewPane';
import { statusChipTone } from '@/components/ui/primitives/chips/EntityStatusChip';
import { ROUTES } from '@/routes/routeConfig';
import { type ArtifactConversion, ConclusionsApi } from '@/services/api/conclusions.api';
import { InitiativeApi, type InitiativeEconomicsLink } from '@/services/api/initiatives.api';
import { copyAsMarkdown, copyForSlack } from '@/utils/clipboard';

import { getSourceDisplayLabel } from './InitiativeSourceLink';

export type InitiativePreviewV3Model = {
  id: string;
  name?: string;
  title?: string;
  status?: string;
  axis?: string;
  priority?: string;
  progress?: number | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
  summary?: string | null;
  description?: string | null;
  plannedStartDate?: string | null;
  plannedEndDate?: string | null;
  ownerBusiness?: { firstName?: string; lastName?: string } | null;
  ownerExecution?: { firstName?: string; lastName?: string } | null;
  sourceType?: string | null;
  sourceId?: string | null;
};

const formatDate = (value: unknown): string => {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

/** Humanize an unknown enum key (never surface a raw UPPER_SNAKE key). */
const humanizeKey = (raw: string): string => {
  const spaced = raw.trim().replace(/[_-]+/g, ' ').trim().toLowerCase();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : '';
};

/**
 * Localized initiative status label — canon §7.3: no raw enum keys in preview.
 * Tone stays owned by statusChipTone(); this only supplies the text.
 */
const initiativeStatusLabel = (t: TFunction, raw: string): string => {
  const key = raw
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  const map: Record<string, string> = {
    draft: t('preview.statuses.draft', 'Draft'),
    pending_review: t('initiatives.status.pendingReview', 'Pending review'),
    review: t('preview.statuses.review', 'In review'),
    promoted: t('initiatives.status.promoted', 'Promoted'),
    planning: t('initiatives.status.planning', 'Planning'),
    approved: t('preview.statuses.approved', 'Approved'),
    scheduled: t('initiatives.status.scheduled', 'Scheduled'),
    executing: t('initiatives.status.executing', 'Executing'),
    blocked: t('initiatives.status.blocked', 'Blocked'),
    done: t('initiatives.status.done', 'Done'),
    tracking: t('initiatives.status.tracking', 'Tracking'),
    cancelled: t('initiatives.status.cancelled', 'Cancelled'),
    archived: t('initiatives.status.archived', 'Archived'),
  };
  return map[key] ?? humanizeKey(raw);
};

/** Localized initiative priority label. */
const initiativePriorityLabel = (t: TFunction, raw: string): string => {
  const key = raw.trim().toLowerCase();
  const map: Record<string, string> = {
    critical: t('initiatives.priorityLevels.critical', 'Critical'),
    high: t('initiatives.priorityLevels.high', 'High'),
    medium: t('initiatives.priorityLevels.medium', 'Medium'),
    low: t('initiatives.priorityLevels.low', 'Low'),
    p1: t('initiatives.priorityLevels.critical', 'Critical'),
    p2: t('initiatives.priorityLevels.high', 'High'),
    p3: t('initiatives.priorityLevels.medium', 'Medium'),
    p4: t('initiatives.priorityLevels.low', 'Low'),
  };
  return map[key] ?? humanizeKey(raw);
};

export const InitiativePreviewV3Body: React.FC<{
  initiative: InitiativePreviewV3Model;
  detailsExpanded?: boolean;
  onToggleDetailsExpanded?: () => void;
  onSummarize?: () => Promise<void> | void;
  /** B1 (deliverables): generates a document grounded in this initiative (chat). */
  onMakeDocument?: () => Promise<void> | void;
}> = ({ initiative, detailsExpanded, onToggleDetailsExpanded, onSummarize, onMakeDocument }) => {
  const { i18n, t } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [lineage, setLineage] = useState<ArtifactConversion[]>([]);

  // Reset internal state when switching items.
  useEffect(() => {
    setInternalExpanded(false);
  }, [initiative.id]);

  useEffect(() => {
    if (!initiative.id) return;
    ConclusionsApi.listConversions({
      targetArtifactType: 'initiative',
      targetArtifactId: initiative.id,
    })
      .then((res) => setLineage(res.conversions || []))
      .catch(() => setLineage([]));
  }, [initiative.id]);

  const expanded = detailsExpanded ?? internalExpanded;
  const toggleExpanded = () => {
    if (onToggleDetailsExpanded) onToggleDetailsExpanded();
    else setInternalExpanded((v) => !v);
  };

  const status = String(initiative.status || '').toUpperCase() || '—';
  const axis = String(initiative.axis || '').trim();
  const priority = String(initiative.priority || '').trim();
  const progress =
    initiative.progress == null || Number.isNaN(Number(initiative.progress))
      ? null
      : Math.max(0, Math.min(100, Number(initiative.progress)));

  const createdAt = formatDate(initiative.createdAt);
  const updatedAt = formatDate(initiative.updatedAt);

  const detailsText = String(initiative.summary || initiative.description || '').trim();

  const handleCopy = useCallback(async () => {
    try {
      const title = String(initiative.name || initiative.title || '').trim();
      await navigator.clipboard.writeText([title, '', detailsText].filter(Boolean).join('\n'));
      toast.success(t('initiatives.copied2'));
    } catch {
      toast.error(t('initiatives.copyFailed2'));
    }
  }, [detailsText, initiative.name, initiative.title, isPolish]);

  const metaPills = useMemo((): MetaPill[] => {
    const pillClass = 'bg-c-surface-raised text-c-text-secondary';
    // Canon §4.1: status carries a semantic tone (dot); label is localized —
    // never the raw UPPER_SNAKE enum. Other meta stay neutral.
    const statusTone = statusChipTone(status) as MetaPill['tone'];
    const pills: MetaPill[] = [
      { label: t('initiatives.initiative2'), className: pillClass },
      { label: initiativeStatusLabel(t, status), tone: statusTone },
    ];
    if (progress != null) {
      pills.push({
        label: t('preview.progress', 'Progress'),
        value: `${progress}%`,
        className: pillClass,
      });
    }
    if (axis) {
      pills.push({
        label: t('initiatives.axis3'),
        value: axis,
        className: pillClass,
      });
    }
    if (priority) {
      pills.push({
        label: t('initiatives.priority4'),
        value: initiativePriorityLabel(t, priority),
        className: pillClass,
      });
    }
    return pills;
  }, [axis, priority, progress, status, t]);

  const detailsCustomActions = useMemo((): DetailsAction[] => {
    const title = String(initiative.name || initiative.title || '').trim();
    const actions: DetailsAction[] = [
      {
        id: 'toggle',
        label: expanded ? t('initiatives.collapse2') : t('initiatives.expand2'),
        onClick: toggleExpanded,
      },
      {
        id: 'summarize',
        label: t('initiatives.summarize2'),
        onClick: async () => {
          await onSummarize?.();
        },
      },
      ...(onMakeDocument
        ? [
            {
              id: 'make-document',
              label: t('initiatives.makeADocumentFromThis2'),
              onClick: async () => {
                await onMakeDocument();
              },
            } satisfies DetailsAction,
          ]
        : []),
      {
        id: 'copy',
        label: t('common.copy', 'Copy'),
        icon: Copy,
        onClick: async () => {
          await handleCopy();
        },
      },
      {
        id: 'copy-md',
        label: t('initiatives.copyAsMarkdown2'),
        onClick: () =>
          void copyAsMarkdown({ title, status, description: detailsText }, isPolish ? 'pl' : 'en'),
      },
      {
        id: 'copy-slack',
        label: t('initiatives.copyForSlack2'),
        onClick: () =>
          void copyForSlack({ title, status, description: detailsText }, isPolish ? 'pl' : 'en'),
      },
    ];
    return actions;
  }, [
    detailsText,
    expanded,
    handleCopy,
    initiative.name,
    initiative.title,
    isPolish,
    onMakeDocument,
    onSummarize,
    status,
    t,
  ]);

  return (
    <div className="space-y-4">
      <PreviewMetaCard pills={metaPills}>
        <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
          <div>
            <div className="text-c-text-muted">{t('initiatives.created2')}</div>
            <div className="text-c-text">{createdAt}</div>
          </div>
          <div className="text-right">
            <div className="text-c-text-muted">{t('initiatives.lastModified2')}</div>
            <div className="text-c-text">{updatedAt}</div>
          </div>
        </div>
      </PreviewMetaCard>

      <PreviewDetailsSection
        text={detailsText}
        expanded={expanded}
        onToggleExpanded={toggleExpanded}
        customActions={detailsCustomActions}
      />

      {/* Financial Analysis Card (V3 position 4, 19.3) */}
      <FinancialAnalysisCard initiativeId={initiative.id} />

      {(['interview_insight', 'insight', 'interview', 'conclusion'].includes(
        String(initiative.sourceType || '').toLowerCase()
      ) ||
        lineage.length > 0) && (
        <div className="rounded-xl border border-c-border-subtle bg-c-surface-raised p-3">
          <div className="flex items-center gap-2 mb-2">
            <Link2 size={14} className="text-c-info" />
            <span className="text-[11px] font-semibold text-c-info uppercase tracking-wider">
              {t('initiatives.interviewInsightLineage2')}
            </span>
          </div>
          <div className="space-y-1.5 text-xs text-c-text-secondary">
            {initiative.sourceId ? (
              <button
                type="button"
                onClick={() =>
                  window.location.assign(
                    `/interview?insightId=${encodeURIComponent(String(initiative.sourceId))}`
                  )
                }
                className="flex items-center gap-2 hover:underline"
              >
                <ExternalLink size={12} />
                {t('initiatives.openSourceInsight2')}
              </button>
            ) : null}
            {lineage.map((item) => (
              <div key={item.id}>
                {item.sourceArtifactTitle || item.conversionIntent} • {item.conversionStatus}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/** Human label + chip tone for a linkage status (M16 Finance vocabulary). */
function getLinkageStatusMeta(
  status: InitiativeEconomicsLink['status'],
  t: TFunction
): { label: string; tone: string } {
  switch (status) {
    case 'linked_to_finance_model':
      return {
        label: t('initiatives.initiativePreviewV3.linkageStatus.linkedToModel'),
        tone: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      };
    case 'linked_to_finance_scenario':
      return {
        label: t('initiatives.initiativePreviewV3.linkageStatus.linkedToScenario'),
        tone: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      };
    case 'linked_to_roi_tracking':
      return {
        label: t('initiatives.initiativePreviewV3.linkageStatus.roiTracking'),
        tone: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      };
    case 'stale_vs_finance_model':
      return {
        label: t('initiatives.initiativePreviewV3.linkageStatus.staleVsModel'),
        tone: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      };
    case 'local_only':
      return {
        label: t('initiatives.initiativePreviewV3.linkageStatus.localOnly'),
        tone: 'bg-c-surface-raised text-c-text-muted',
      };
    default:
      return {
        label: t('initiatives.initiativePreviewV3.linkageStatus.notStarted'),
        tone: 'bg-c-surface-raised text-c-text-muted',
      };
  }
}

function getLinkageTypeLabel(type: InitiativeEconomicsLink['linkageType'], t: TFunction): string {
  const map: Record<InitiativeEconomicsLink['linkageType'], string> = {
    budget: t('initiatives.initiativePreviewV3.linkageType.budget'),
    forecast: t('initiatives.initiativePreviewV3.linkageType.forecast'),
    actual: t('initiatives.initiativePreviewV3.linkageType.actual'),
    variance: t('initiatives.initiativePreviewV3.linkageType.variance'),
  };
  return map[type] ?? type;
}

/**
 * Inline "Linked finance models" list.
 * Reads the M16-written economics linkages for this initiative (org-scoped on the
 * server) and renders name (finance model ref) + type + status, with an action to
 * open the model in /economics. Renders nothing when there are no linkages so the
 * card stays clean for initiatives without a finance link.
 */
const LinkedFinanceModels: React.FC<{ initiativeId: string }> = ({ initiativeId }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [links, setLinks] = useState<InitiativeEconomicsLink[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    InitiativeApi.getEconomicsLinks(initiativeId)
      .then((rows) => {
        if (!cancelled) setLinks(rows);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [initiativeId]);

  // Quiet states: nothing to show until we have at least one linkage.
  if (loading || links.length === 0) return null;

  return (
    <div className="mb-3 pb-3 border-b border-c-border-subtle">
      <div className="flex items-center gap-2 mb-2">
        <Link2 size={12} className="text-c-text-muted shrink-0" />
        <span className="text-[10px] font-semibold text-c-text-muted uppercase tracking-wider">
          {t('initiatives.initiativePreviewV3.linkedFinanceModels')}
        </span>
        <span className="text-[10px] text-c-text-muted">({links.length})</span>
      </div>
      <div className="space-y-1.5">
        {links.map((link) => {
          const statusMeta = getLinkageStatusMeta(link.status, t);
          return (
            <button
              key={link.linkageId}
              onClick={() =>
                navigate(
                  `/economics?tab=analysis&initiativeId=${encodeURIComponent(
                    initiativeId
                  )}&modelRef=${encodeURIComponent(link.financeModelRef)}`
                )
              }
              className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-c-surface-raised transition group"
              title={t('initiatives.initiativePreviewV3.openInFinance')}
            >
              <ExternalLink size={12} className="text-c-info shrink-0" />
              <span className="flex-1 min-w-0">
                <span className="block text-xs font-medium text-c-text-secondary truncate">
                  {link.financeModelRef}
                </span>
                <span className="block text-[10px] text-c-text-muted">
                  {getLinkageTypeLabel(link.linkageType, t)}
                </span>
              </span>
              <span
                className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-md font-medium ${statusMeta.tone}`}
              >
                {statusMeta.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const FinancialAnalysisCard: React.FC<{ initiativeId: string }> = ({ initiativeId }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="rounded-xl border border-c-border-subtle bg-white/70 dark:bg-white/[0.04] p-3">
      <div className="flex items-center gap-2 mb-2">
        <Calculator size={14} className="text-c-text-muted" />
        <span className="text-[11px] font-semibold text-c-text-muted uppercase tracking-wider">
          {t('initiatives.preview.financialAnalysis', 'Financial Analysis')}
        </span>
      </div>
      <LinkedFinanceModels initiativeId={initiativeId} />
      <div className="space-y-1.5">
        <button
          onClick={() => navigate(`/economics?tab=analysis&initiativeId=${initiativeId}`)}
          className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-c-text-secondary hover:bg-c-surface-raised transition"
        >
          <ExternalLink size={12} className="text-c-info shrink-0" />
          {t('initiatives.ratioAnalysis2')}
        </button>
        <button
          onClick={() => navigate(`/economics?tab=valuation&initiativeId=${initiativeId}`)}
          className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-c-text-secondary hover:bg-c-surface-raised transition"
        >
          <ExternalLink size={12} className="text-c-info shrink-0" />
          {t('initiatives.companyValuation2')}
        </button>
        <button
          onClick={() => navigate(`/economics?tab=prediction&initiativeId=${initiativeId}`)}
          className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-c-text-secondary hover:bg-c-surface-raised transition"
        >
          <ExternalLink size={12} className="text-c-info shrink-0" />
          {t('initiatives.budgetPrediction2')}
        </button>
        <button
          onClick={() =>
            navigate(
              `${ROUTES.RESULTS}?tab=results_reports&rmode=reports&initiativeId=${encodeURIComponent(initiativeId)}`
            )
          }
          className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-c-text-secondary hover:bg-c-surface-raised transition"
        >
          <ExternalLink size={12} className="text-c-info shrink-0" />
          {t('initiatives.resultsKpiReports2')}
        </button>
      </div>
    </div>
  );
};

export const InitiativePreviewV3Footer: React.FC<{
  initiative: InitiativePreviewV3Model;
  tasksCount?: number;
  onOpenFull?: () => void;
  onOpenInModule?: () => void;
  onOpenChat?: (prompt: string) => Promise<void> | void;
  onCopyLink?: () => Promise<void> | void;
  extraActionsSlot?: React.ReactNode;
  extraActionsAfterSlot?: React.ReactNode;
}> = ({
  initiative,
  tasksCount,
  onOpenFull,
  onOpenInModule,
  onOpenChat,
  onCopyLink,
  extraActionsSlot,
  extraActionsAfterSlot,
}) => {
  const { t } = useTranslation();
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const sourceType = String(initiative.sourceType || '').trim();
  const sourceId = String(initiative.sourceId || '').trim();
  const sourceDisplayType = sourceType ? getSourceDisplayLabel(sourceType) : '';
  const sourceLabel = sourceDisplayType
    ? sourceId
      ? `${sourceDisplayType} · ${sourceId.slice(0, 8)}…`
      : sourceDisplayType
    : '—';

  const aiHintsWithPrompts = [
    {
      label: t('initiatives.initiativePreviewV3.aiHints.nextStepsLabel'),
      prompt: t('initiatives.initiativePreviewV3.aiHints.nextStepsPrompt'),
    },
    {
      label: t('initiatives.initiativePreviewV3.aiHints.risksLabel'),
      prompt: t('initiatives.initiativePreviewV3.aiHints.risksPrompt'),
    },
    {
      label: t('initiatives.initiativePreviewV3.aiHints.scopeLabel'),
      prompt: t('initiatives.initiativePreviewV3.aiHints.scopePrompt'),
    },
  ];

  const aiHintLabels = aiHintsWithPrompts.map((h) => h.label);
  const handleRunHint = useCallback(
    (hint: string) => {
      const h = aiHintsWithPrompts.find((x) => x.label === hint);
      if (h) onOpenChat?.(h.prompt);
    },
    [aiHintsWithPrompts, onOpenChat]
  );

  const handleRegenerate = useCallback(
    () => onOpenChat?.(t('initiatives.initiativePreviewV3.generate3QuickHintsWhatTo')),
    [isPolish, onOpenChat]
  );

  const relationItems: RelationItem[] = useMemo(() => {
    const items: RelationItem[] = [
      {
        label: `${t('initiatives.initiativePreviewV3.source')}: ${sourceLabel}`,
        tone: 'text-c-text-secondary',
      },
    ];
    if (typeof tasksCount === 'number') {
      items.push({
        label: `${t('initiatives.initiativePreviewV3.tasks')}: ${tasksCount}`,
        tone: 'text-c-text-secondary',
      });
    }
    return items;
  }, [isPolish, sourceLabel, tasksCount]);

  const chatPrompt = t('initiatives.initiativePreviewV3.helpMeRefineThisInitiativeMissing');

  const actionRows: ActionRow[] = useMemo(() => {
    if (extraActionsSlot) return [];
    const buttons: ActionRow['buttons'] = [
      ...(onOpenFull
        ? [
            {
              label: t('initiatives.initiativePreviewV3.open'),
              icon: ExternalLink,
              onClick: onOpenFull,
              colorScheme: 'primary' as const,
              shortcut: 'O',
            },
          ]
        : []),
      ...(onOpenInModule
        ? [
            {
              label: t('initiatives.initiativePreviewV3.inModule'),
              icon: ChevronRight,
              onClick: onOpenInModule,
              colorScheme: 'neutral' as const,
              shortcut: 'M',
            },
          ]
        : []),
      ...(onOpenChat
        ? [
            {
              label: t('initiatives.initiativePreviewV3.chat'),
              icon: MessageSquare,
              onClick: () => onOpenChat(chatPrompt),
              colorScheme: 'neutral' as const,
              shortcut: 'C',
            },
          ]
        : []),
    ];
    return [{ buttons }];
  }, [chatPrompt, extraActionsSlot, isPolish, onOpenChat, onOpenFull, onOpenInModule]);

  /**
   * N-81 (przegląd 128 zrzutów): `Copy link` stało w stopce obok akcji
   * biznesowych — a przy okazji obok `Delete`. Przegląd zebrał trzy takie
   * przypadki (Interview → Sessions, Interview → Initiatives, tu) i nazwał je
   * „akcją techniczną w stopce".
   *
   * Nie znika — bywa potrzebne, gdy trzeba komuś podesłać odnośnik. Przenosi
   * się pod „…", żeby stopka niosła to, po co użytkownik tu przyszedł.
   */
  const overflowActions = useMemo(
    () =>
      onCopyLink
        ? [
            {
              label: t('initiatives.initiativePreviewV3.copyLink'),
              icon: Link2,
              onClick: async () => onCopyLink(),
              colorScheme: 'neutral' as const,
            },
          ]
        : [],
    [onCopyLink, t]
  );

  return (
    <div className="space-y-0">
      {/* Ramkę bloku 4 rysuje sam `PreviewAIHintStrip` — bez opakowania. */}
      <PreviewAIHintStrip
        hints={aiHintLabels}
        onRunHint={handleRunHint}
        onRegenerate={handleRegenerate}
        disabled={!onOpenChat}
      />

      <div className="border-t border-c-border-subtle my-3" />

      <PreviewRelations items={relationItems} />

      <div className="border-t border-c-border-subtle my-3" />

      {extraActionsSlot ? (
        extraActionsSlot
      ) : (
        <PreviewActionBar rows={actionRows} overflowActions={overflowActions} />
      )}
      {extraActionsAfterSlot ? extraActionsAfterSlot : null}
    </div>
  );
};

export default InitiativePreviewV3Body;
