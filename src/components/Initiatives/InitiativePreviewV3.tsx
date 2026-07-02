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
import { ROUTES } from '@/routes/routeConfig';
import { type ArtifactConversion, ConclusionsApi } from '@/services/api/conclusions.api';
import { type InitiativeEconomicsLink, InitiativeApi } from '@/services/api/initiatives.api';
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

export const InitiativePreviewV3Body: React.FC<{
  initiative: InitiativePreviewV3Model;
  detailsExpanded?: boolean;
  onToggleDetailsExpanded?: () => void;
  onSummarize?: () => Promise<void> | void;
  /** B1 (deliverables): generuje dokument ugruntowany w tej inicjatywie (czat). */
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
    const pills: MetaPill[] = [
      { label: t('initiatives.initiative2'), className: pillClass },
      { label: status.replace(/_/g, ' '), className: pillClass },
    ];
    if (progress != null) {
      pills.push({
        label: `${t('preview.progress', 'Progress')}: ${progress}%`,
        className: pillClass,
      });
    }
    if (axis) {
      pills.push({
        label: `${t('initiatives.axis3')}: ${axis}`,
        className: pillClass,
      });
    }
    if (priority) {
      pills.push({
        label: `${t('initiatives.priority4')}: ${priority}`,
        className: pillClass,
      });
    }
    return pills;
  }, [axis, isPolish, priority, progress, status, t]);

  const detailsCustomActions = useMemo((): DetailsAction[] => {
    const title = String(initiative.name || initiative.title || '').trim();
    const actions: DetailsAction[] = [
      {
        id: 'toggle',
        label: expanded ? (t('initiatives.collapse2')) : t('initiatives.expand2'),
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
        label: isPolish ? 'Kopiuj' : t('common.copy', 'Copy'),
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
            <div className="text-c-text-muted">
              {t('initiatives.created2')}
            </div>
            <div className="text-c-text">{createdAt}</div>
          </div>
          <div className="text-right">
            <div className="text-c-text-muted">
              {t('initiatives.lastModified2')}
            </div>
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
        <div className="rounded-xl border border-c-border bg-c-surface-raised p-3">
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
  isPolish: boolean
): { label: string; tone: string } {
  switch (status) {
    case 'linked_to_finance_model':
      return {
        label: isPolish ? 'Powiązano z modelem' : 'Linked to model',
        tone: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      };
    case 'linked_to_finance_scenario':
      return {
        label: isPolish ? 'Powiązano ze scenariuszem' : 'Linked to scenario',
        tone: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      };
    case 'linked_to_roi_tracking':
      return {
        label: isPolish ? 'Śledzenie ROI' : 'ROI tracking',
        tone: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      };
    case 'stale_vs_finance_model':
      return {
        label: isPolish ? 'Nieaktualne vs model' : 'Stale vs model',
        tone: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      };
    case 'local_only':
      return {
        label: isPolish ? 'Tylko lokalnie' : 'Local only',
        tone: 'bg-c-surface-raised text-c-text-muted',
      };
    default:
      return {
        label: isPolish ? 'Nie rozpoczęto' : 'Not started',
        tone: 'bg-c-surface-raised text-c-text-muted',
      };
  }
}

function getLinkageTypeLabel(
  type: InitiativeEconomicsLink['linkageType'],
  isPolish: boolean
): string {
  const map: Record<InitiativeEconomicsLink['linkageType'], [string, string]> = {
    budget: ['Budżet', 'Budget'],
    forecast: ['Prognoza', 'Forecast'],
    actual: ['Wykonanie', 'Actual'],
    variance: ['Odchylenie', 'Variance'],
  };
  const pair = map[type];
  return pair ? (isPolish ? pair[0] : pair[1]) : type;
}

/**
 * Inline "Powiązane modele finansowe / Linked finance models" list.
 * Reads the M16-written economics linkages for this initiative (org-scoped on the
 * server) and renders name (finance model ref) + type + status, with an action to
 * open the model in /economics. Renders nothing when there are no linkages so the
 * card stays clean for initiatives without a finance link.
 */
const LinkedFinanceModels: React.FC<{ initiativeId: string }> = ({ initiativeId }) => {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const isPolish = i18n.language === 'pl';
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
          {isPolish ? 'Powiązane modele finansowe' : 'Linked finance models'}
        </span>
        <span className="text-[10px] text-c-text-muted">({links.length})</span>
      </div>
      <div className="space-y-1.5">
        {links.map((link) => {
          const statusMeta = getLinkageStatusMeta(link.status, isPolish);
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
              title={isPolish ? 'Otwórz w module Finanse' : 'Open in Finance'}
            >
              <ExternalLink size={12} className="text-c-info shrink-0" />
              <span className="flex-1 min-w-0">
                <span className="block text-xs font-medium text-c-text-secondary truncate">
                  {link.financeModelRef}
                </span>
                <span className="block text-[10px] text-c-text-muted">
                  {getLinkageTypeLabel(link.linkageType, isPolish)}
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
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isPolish = i18n.language === 'pl';

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
              `${ROUTES.BENEFITS}?tab=results_reports&rmode=reports&initiativeId=${encodeURIComponent(initiativeId)}`
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
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const sourceType = String(initiative.sourceType || '').trim();
  const sourceId = String(initiative.sourceId || '').trim();
  const sourceDisplayType = sourceType ? getSourceDisplayLabel(sourceType, isPolish) : '';
  const sourceLabel = sourceDisplayType
    ? sourceId
      ? `${sourceDisplayType} · ${sourceId.slice(0, 8)}…`
      : sourceDisplayType
    : '—';

  const aiHintsWithPrompts = isPolish
    ? [
        { label: 'Kolejne kroki', prompt: 'Zaproponuj 3 kolejne kroki dla tej inicjatywy.' },
        { label: 'Ryzyka', prompt: 'Wypisz 5 ryzyk i propozycje mitigacji dla tej inicjatywy.' },
        { label: 'Zakres', prompt: 'Ułóż krótki zakres i kryteria sukcesu dla tej inicjatywy.' },
      ]
    : [
        { label: 'Next steps', prompt: 'Propose 3 next steps for this initiative.' },
        { label: 'Risks', prompt: 'List 5 risks and mitigations for this initiative.' },
        { label: 'Scope', prompt: 'Draft a short scope and success criteria for this initiative.' },
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
    () =>
      onOpenChat?.(
        isPolish
          ? 'Wygeneruj 3 szybkie hinty (co zrobić / na co uważać / jak mierzyć).'
          : 'Generate 3 quick hints (what to do / risks / how to measure).'
      ),
    [isPolish, onOpenChat]
  );

  const relationItems: RelationItem[] = useMemo(() => {
    const items: RelationItem[] = [
      {
        label: `${isPolish ? 'Źródło' : 'Source'}: ${sourceLabel}`,
        tone: 'text-c-text-secondary',
      },
    ];
    if (typeof tasksCount === 'number') {
      items.push({
        label: `${isPolish ? 'Zadania' : 'Tasks'}: ${tasksCount}`,
        tone: 'text-c-text-secondary',
      });
    }
    return items;
  }, [isPolish, sourceLabel, tasksCount]);

  const chatPrompt = isPolish
    ? 'Pomóż mi dopracować tę inicjatywę: brakujące pola, ryzyka, KPI i następne kroki.'
    : 'Help me refine this initiative: missing fields, risks, KPIs, and next steps.';

  const actionRows: ActionRow[] = useMemo(() => {
    if (extraActionsSlot) return [];
    const buttons: ActionRow['buttons'] = [
      ...(onOpenFull
        ? [
            {
              label: isPolish ? 'Otwórz' : 'Open',
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
              label: isPolish ? 'W module' : 'In module',
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
              label: isPolish ? 'Czat' : 'Chat',
              icon: MessageSquare,
              onClick: () => onOpenChat(chatPrompt),
              colorScheme: 'neutral' as const,
              shortcut: 'C',
            },
          ]
        : []),
      ...(onCopyLink
        ? [
            {
              label: isPolish ? 'Kopiuj link' : 'Copy link',
              icon: Link2,
              onClick: async () => onCopyLink(),
              colorScheme: 'neutral' as const,
            },
          ]
        : []),
    ];
    return [{ buttons }];
  }, [chatPrompt, extraActionsSlot, isPolish, onCopyLink, onOpenChat, onOpenFull, onOpenInModule]);

  return (
    <div className="space-y-0">
      <div className="rounded-xl border border-c-border-subtle bg-c-surface-raised p-2.5">
        <PreviewAIHintStrip
          hints={aiHintLabels}
          onRunHint={handleRunHint}
          onRegenerate={handleRegenerate}
          disabled={!onOpenChat}
        />
      </div>

      <div className="border-t border-c-border-subtle my-3" />

      <PreviewRelations items={relationItems} />

      <div className="border-t border-c-border-subtle my-3" />

      {extraActionsSlot ? extraActionsSlot : <PreviewActionBar rows={actionRows} />}
      {extraActionsAfterSlot ? extraActionsAfterSlot : null}
    </div>
  );
};

export default InitiativePreviewV3Body;
