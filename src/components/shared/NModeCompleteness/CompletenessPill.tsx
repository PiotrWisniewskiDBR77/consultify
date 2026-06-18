/**
 * CompletenessPill — N-mode completeness indicator
 *
 * Shows score + missing count. Click opens missing items popover.
 * DBR77: rounded-full, h-7, text-xs. Colors: emerald (100%), amber (50-99%), red (<50%).
 *
 * @see V3-K01: N-mode required sections/fields + completeness + AI assist
 */

import { AlertCircle, Check, Circle } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { MissingItemsList } from './MissingItemsList';
import type { CompletenessResult, MissingItem } from './types';

interface CompletenessPillProps {
  result: CompletenessResult;
  compact?: boolean;
  onScrollToField?: (fieldPath: string, sectionId: string) => void;
  onAIFill?: (item: MissingItem) => void;
  onAIFillAll?: () => void;
  disabled?: boolean;
}

function getScoreColor(score: number): string {
  if (score >= 100) return 'text-emerald-500 dark:text-emerald-400';
  if (score >= 50) return 'text-amber-500 dark:text-amber-400';
  return 'text-danger-500 dark:text-danger-400';
}

function getScoreBgColor(score: number): string {
  if (score >= 100) return 'bg-emerald-500/10 dark:bg-emerald-500/10';
  if (score >= 50) return 'bg-amber-500/10 dark:bg-amber-500/10';
  return 'bg-danger-500/10 dark:bg-danger-500/10';
}

export const CompletenessPill: React.FC<CompletenessPillProps> = ({
  result,
  compact = false,
  onScrollToField,
  onAIFill,
  onAIFillAll,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const { score, missingItems } = result;
  const missingCount = missingItems.length;
  const colorClass = getScoreColor(score);
  const bgClass = getScoreBgColor(score);

  const tooltipText =
    missingCount > 0
      ? t('nmodeCompleteness.pillMissing', { count: missingCount })
      : t('nmodeCompleteness.pillComplete');

  const pillContent = compact ? (
    <span className="flex items-center justify-center" title={tooltipText}>
      {score >= 100 ? (
        <Check size={14} className={colorClass} />
      ) : (
        <Circle
          size={14}
          className={colorClass}
          fill={score >= 50 ? 'currentColor' : undefined}
          fillOpacity={score >= 50 ? 0.2 : 0}
        />
      )}
    </span>
  ) : (
    <span className={`flex items-center gap-1.5 ${colorClass}`}>
      {score >= 100 ? (
        <Check size={14} className="shrink-0" />
      ) : (
        <AlertCircle size={14} className="shrink-0" />
      )}
      <span>{score}%</span>
      {missingCount > 0 && (
        <span className="text-slate-500 dark:text-slate-400">
          · {missingCount} {t('nmodeCompleteness.missing')}
        </span>
      )}
    </span>
  );

  const trigger = (
    <button
      type="button"
      disabled={disabled}
      className={`
        inline-flex h-7 items-center justify-center rounded-full px-3 text-xs font-medium
        transition-all duration-150
        ${bgClass}
        hover:opacity-90
        disabled:cursor-not-allowed disabled:opacity-50
      `}
      title={tooltipText}
    >
      {pillContent}
    </button>
  );

  if (missingCount === 0 && compact) {
    return (
      <span
        className={`inline-flex h-7 items-center justify-center rounded-full px-2 ${bgClass}`}
        title={tooltipText}
      >
        {pillContent}
      </span>
    );
  }

  if (missingCount === 0) {
    return (
      <span
        className={`inline-flex h-7 items-center justify-center rounded-full px-3 text-xs font-medium ${bgClass} ${colorClass}`}
        title={tooltipText}
      >
        {pillContent}
      </span>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-80 max-h-[320px] overflow-hidden p-0 rounded-xl shadow-hig-xl border-slate-200/60 dark:border-navy-600/40 bg-white dark:bg-navy-900"
      >
        <MissingItemsList
          missingItems={result.missingItems}
          criticalMissing={result.criticalMissing}
          onScrollToField={onScrollToField}
          onAIFill={onAIFill}
          onAIFillAll={onAIFillAll}
          onClose={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
};

export default CompletenessPill;
