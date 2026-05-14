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
}> = ({ initiative, detailsExpanded, onToggleDetailsExpanded, onSummarize }) => {
  const { i18n, t } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const [internalExpanded, setInternalExpanded] = useState(false);

  // Reset internal state when switching items.
  useEffect(() => {
    setInternalExpanded(false);
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
      toast.success(isPolish ? 'Skopiowano' : 'Copied');
    } catch {
      toast.error(isPolish ? 'Nie udało się skopiować' : 'Copy failed');
    }
  }, [detailsText, initiative.name, initiative.title, isPolish]);

  const metaPills = useMemo((): MetaPill[] => {
    const pillClass = 'bg-slate-500/10 text-slate-700 dark:text-slate-200';
    const pills: MetaPill[] = [
      { label: isPolish ? 'Inicjatywa' : 'Initiative', className: pillClass },
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
        label: `${isPolish ? 'Oś' : 'Axis'}: ${axis}`,
        className: pillClass,
      });
    }
    if (priority) {
      pills.push({
        label: `${isPolish ? 'Pilność' : 'Priority'}: ${priority}`,
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
        label: expanded ? (isPolish ? 'Zwiń' : 'Collapse') : isPolish ? 'Rozwiń' : 'Expand',
        onClick: toggleExpanded,
      },
      {
        id: 'summarize',
        label: isPolish ? 'Podsumuj' : 'Summarize',
        onClick: async () => {
          await onSummarize?.();
        },
      },
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
        label: isPolish ? 'Kopiuj jako Markdown' : 'Copy as Markdown',
        onClick: () =>
          void copyAsMarkdown({ title, status, description: detailsText }, isPolish ? 'pl' : 'en'),
      },
      {
        id: 'copy-slack',
        label: isPolish ? 'Kopiuj dla Slack' : 'Copy for Slack',
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
    onSummarize,
    status,
    t,
  ]);

  return (
    <div className="space-y-4">
      <PreviewMetaCard pills={metaPills}>
        <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
          <div>
            <div className="text-slate-500 dark:text-slate-400">
              {isPolish ? 'Utworzono' : 'Created'}
            </div>
            <div className="text-slate-900 dark:text-white">{createdAt}</div>
          </div>
          <div className="text-right">
            <div className="text-slate-500 dark:text-slate-400">
              {isPolish ? 'Ostatnia zmiana' : 'Last modified'}
            </div>
            <div className="text-slate-900 dark:text-white">{updatedAt}</div>
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
    </div>
  );
};

const FinancialAnalysisCard: React.FC<{ initiativeId: string }> = ({ initiativeId }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isPolish = i18n.language === 'pl';

  return (
    <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] p-3">
      <div className="flex items-center gap-2 mb-2">
        <Calculator size={14} className="text-slate-500 dark:text-slate-400" />
        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          {t('initiatives.preview.financialAnalysis', 'Financial Analysis')}
        </span>
      </div>
      <div className="space-y-1.5">
        <button
          onClick={() => navigate(`/economics?tab=analysis&initiativeId=${initiativeId}`)}
          className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition"
        >
          <ExternalLink size={12} className="text-purple-500 shrink-0" />
          {isPolish ? 'Analiza wskaźnikowa' : 'Ratio Analysis'}
        </button>
        <button
          onClick={() => navigate(`/economics?tab=valuation&initiativeId=${initiativeId}`)}
          className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition"
        >
          <ExternalLink size={12} className="text-purple-500 shrink-0" />
          {isPolish ? 'Wycena przedsiębiorstwa' : 'Company Valuation'}
        </button>
        <button
          onClick={() => navigate(`/economics?tab=prediction&initiativeId=${initiativeId}`)}
          className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition"
        >
          <ExternalLink size={12} className="text-purple-500 shrink-0" />
          {isPolish ? 'Budżet i predykcja' : 'Budget & Prediction'}
        </button>
        <button
          onClick={() =>
            navigate(
              `${ROUTES.BENEFITS}?tab=results_reports&rmode=reports&initiativeId=${encodeURIComponent(initiativeId)}`
            )
          }
          className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition"
        >
          <ExternalLink size={12} className="text-purple-500 shrink-0" />
          {isPolish ? 'Wyniki i raporty KPI' : 'Results & KPI reports'}
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
        tone: 'text-slate-600 dark:text-slate-300',
      },
    ];
    if (typeof tasksCount === 'number') {
      items.push({
        label: `${isPolish ? 'Zadania' : 'Tasks'}: ${tasksCount}`,
        tone: 'text-slate-600 dark:text-slate-300',
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
      <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-slate-50/60 dark:bg-white/[0.03] p-2.5">
        <PreviewAIHintStrip
          hints={aiHintLabels}
          onRunHint={handleRunHint}
          onRegenerate={handleRegenerate}
          disabled={!onOpenChat}
        />
      </div>

      <div className="border-t border-slate-200/50 dark:border-white/[0.06] my-3" />

      <PreviewRelations items={relationItems} />

      <div className="border-t border-slate-200/50 dark:border-white/[0.06] my-3" />

      {extraActionsSlot ? extraActionsSlot : <PreviewActionBar rows={actionRows} />}
      {extraActionsAfterSlot ? extraActionsAfterSlot : null}
    </div>
  );
};

export default InitiativePreviewV3Body;
