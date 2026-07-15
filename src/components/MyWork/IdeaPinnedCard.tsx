/**
 * IdeaPinnedCard — V5-IDEA-13: Pinned Idea Card summary surface.
 *
 * A compact, always-visible orientation anchor on the workspace canvas.
 * Shows the idea's formal identity: title, summary, stage, problem/opportunity,
 * risks, evidence, and next best action.
 *
 * Per V5 SSOT §9.4: "The workspace should support a pinned summary card,
 * visible in the canvas as a stable orientation anchor."
 */
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileText,
  Lightbulb,
  Sparkles,
  Target,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  IDEA_STAGE_COLORS,
  IDEA_STAGE_LABELS,
  IDEA_STAGES_V5,
  type IdeaStageV5,
  normalizeStageToV5,
} from './ideaEntryTypes';

export interface IdeaPinnedCardData {
  title: string;
  summary?: string;
  problem?: string;
  opportunity?: string;
  currentState?: string;
  desiredOutcome?: string;
  whyNow?: string;
  assumptions?: string;
  risks?: string;
  evidence?: string;
  nextBestAction?: string;
}

interface IdeaPinnedCardProps {
  stage: string;
  data: IdeaPinnedCardData;
  evidenceCount?: number;
  nodeCount?: number;
  onEdit?: () => void;
  onAISummarize?: () => void;
  onStageChange?: (newStage: IdeaStageV5) => void;
  className?: string;
}

export const IdeaPinnedCard: React.FC<IdeaPinnedCardProps> = ({
  stage,
  data,
  evidenceCount = 0,
  nodeCount = 0,
  onEdit,
  onAISummarize,
  onStageChange,
  className = '',
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const [expanded, setExpanded] = useState(false);

  const v5Stage = normalizeStageToV5(stage);
  const stageLabel = isPl ? IDEA_STAGE_LABELS[v5Stage].pl : IDEA_STAGE_LABELS[v5Stage].en;
  const stageColor = IDEA_STAGE_COLORS[v5Stage];

  const hasDetails = useMemo(
    () =>
      Boolean(
        data.problem ||
        data.opportunity ||
        data.currentState ||
        data.desiredOutcome ||
        data.whyNow ||
        data.assumptions ||
        data.risks
      ),
    [data]
  );

  const toggleExpanded = useCallback(() => setExpanded((v) => !v), []);

  const stageIdx = IDEA_STAGES_V5.indexOf(v5Stage);
  const canAdvance = stageIdx >= 0 && stageIdx < IDEA_STAGES_V5.length - 1;
  const canRevert = stageIdx > 0;

  const advanceBlocked = useMemo(() => {
    if (v5Stage === 'spark' && !data.title?.trim()) return t('myWorkIdeas.pinnedCard.addTitle');
    if (v5Stage === 'exploring' && nodeCount < 2) return t('myWorkIdeas.pinnedCard.addNodesFirst');
    if (v5Stage === 'validating' && evidenceCount < 1)
      return t('myWorkIdeas.pinnedCard.addEvidence');
    return null;
  }, [v5Stage, data.title, nodeCount, evidenceCount, isPl]);

  const handleAdvance = useCallback(() => {
    if (!canAdvance || advanceBlocked || !onStageChange) return;
    onStageChange(IDEA_STAGES_V5[stageIdx + 1]);
  }, [canAdvance, advanceBlocked, onStageChange, stageIdx]);

  const handleRevert = useCallback(() => {
    if (!canRevert || !onStageChange) return;
    onStageChange(IDEA_STAGES_V5[stageIdx - 1]);
  }, [canRevert, onStageChange, stageIdx]);

  const DetailRow: React.FC<{ label: string; value?: string; icon?: React.ReactNode }> = ({
    label,
    value,
    icon,
  }) => {
    if (!value?.trim()) return null;
    return (
      <div className="flex gap-2 py-1.5">
        <div className="shrink-0 mt-0.5 text-slate-600 dark:text-slate-500">{icon}</div>
        <div className="min-w-0">
          <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-500 mb-0.5">
            {label}
          </div>
          <div className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
            {value}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className={`rounded-2xl border border-slate-200/60 dark:border-white/[0.06] bg-white/95 dark:bg-navy-900/95 backdrop-blur-xl shadow-lg shadow-black/[0.04] dark:shadow-black/20 transition-all duration-200 ${className}`}
      style={{ maxWidth: 340, minWidth: 260 }}
    >
      {/* Header */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="flex-1 min-w-0">
            <h3 className="text-[13px] font-bold text-slate-800 dark:text-slate-100 leading-snug truncate">
              {data.title || t('myWorkIdeas.pinnedCard.untitled')}
            </h3>
            {data.summary && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mt-0.5 line-clamp-2">
                {data.summary}
              </p>
            )}
          </div>
          <span
            className={`shrink-0 inline-flex items-center gap-1 rounded-lg bg-gradient-to-r ${stageColor} px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide`}
          >
            <span className="w-1 h-1 rounded-full bg-current opacity-70" />
            {stageLabel}
          </span>
        </div>

        {/* Quick stats row */}
        <div className="flex items-center gap-3 mt-1">
          {evidenceCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] text-slate-600 dark:text-slate-500">
              <FileText size={10} />
              {evidenceCount} {t('myWorkIdeas.pinnedCard.evidence')}
            </span>
          )}
          {data.nextBestAction && (
            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium truncate max-w-[180px]">
              <Target size={10} />
              {data.nextBestAction}
            </span>
          )}
        </div>
      </div>

      {/* Expand/collapse toggle */}
      {hasDetails && (
        <button
          onClick={toggleExpanded}
          aria-expanded={expanded}
          className="w-full flex items-center justify-center gap-1 py-1.5 text-[10px] font-semibold text-slate-600 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors border-t border-slate-200/40 dark:border-white/[0.04]"
        >
          {expanded
            ? t('myWorkIdeas.pinnedCard.collapse')
            : t('myWorkIdeas.pinnedCard.showDetails')}
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      )}

      {/* Expanded details */}
      {expanded && hasDetails && (
        <div className="px-4 pb-3 space-y-0.5 border-t border-slate-200/40 dark:border-white/[0.04]">
          <DetailRow
            label={t('myWorkIdeas.pinnedCard.problemOpportunity')}
            value={data.problem || data.opportunity}
            icon={<Lightbulb size={12} />}
          />
          <DetailRow
            label={t('myWorkIdeas.pinnedCard.currentState')}
            value={data.currentState}
            icon={<FileText size={12} />}
          />
          <DetailRow
            label={t('myWorkIdeas.pinnedCard.desiredOutcome')}
            value={data.desiredOutcome}
            icon={<Target size={12} />}
          />
          <DetailRow
            label={t('myWorkIdeas.pinnedCard.whyNow')}
            value={data.whyNow}
            icon={<Sparkles size={12} />}
          />
          <DetailRow
            label={t('myWorkIdeas.pinnedCard.assumptions')}
            value={data.assumptions}
            icon={<FileText size={12} />}
          />
          <DetailRow
            label={t('myWorkIdeas.pinnedCard.risks')}
            value={data.risks}
            icon={<AlertTriangle size={12} />}
          />
        </div>
      )}

      {/* Stage transition */}
      {onStageChange && v5Stage !== 'converted' && (
        <div className="px-4 py-2 flex items-center gap-2 border-t border-slate-200/40 dark:border-white/[0.04]">
          {canRevert && (
            <button
              onClick={handleRevert}
              className="text-[10px] font-semibold text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              ←{' '}
              {isPl
                ? IDEA_STAGE_LABELS[IDEA_STAGES_V5[stageIdx - 1]].pl
                : IDEA_STAGE_LABELS[IDEA_STAGES_V5[stageIdx - 1]].en}
            </button>
          )}
          <div className="flex-1" />
          {canAdvance && (
            <button
              onClick={handleAdvance}
              disabled={!!advanceBlocked}
              title={advanceBlocked || undefined}
              className={`text-[10px] font-bold transition-colors ${
                advanceBlocked
                  ? 'text-slate-600 dark:text-slate-400 cursor-not-allowed'
                  : 'text-c-info hover:text-c-info/80'
              }`}
            >
              {isPl
                ? IDEA_STAGE_LABELS[IDEA_STAGES_V5[stageIdx + 1]].pl
                : IDEA_STAGE_LABELS[IDEA_STAGES_V5[stageIdx + 1]].en}{' '}
              →
            </button>
          )}
        </div>
      )}

      {/* Actions footer */}
      {(onEdit || onAISummarize) && (
        <div className="px-4 py-2 flex items-center gap-2 border-t border-slate-200/40 dark:border-white/[0.04]">
          {onEdit && (
            <button
              onClick={onEdit}
              className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 hover:text-c-info transition-colors"
            >
              {t('myWorkIdeas.pinnedCard.editCard')}
            </button>
          )}
          {onAISummarize && (
            <button
              onClick={onAISummarize}
              className="inline-flex items-center gap-1 text-[10px] font-semibold text-c-info hover:text-c-info/80 transition-colors"
            >
              <Sparkles size={10} />
              {t('myWorkIdeas.pinnedCard.aiSummarize')}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default IdeaPinnedCard;
