/**
 * RuntimeModeSelector
 *
 * V3-D02: Interview runtime mode decision UI.
 * Lets the interviewer choose between Single Question Mode and Task List Mode.
 *
 * - Two prominent cards with icon, title, description, pros/cons
 * - Radio selection (one mode at a time)
 * - "Recommended" badge on AI-suggested mode
 * - Compact inline variant for already-started interviews
 *
 * @see docs/ui-standards/00-foundation/color-system.md
 * @see docs/ui-standards/00-foundation/visual-language.md
 */

import { Check, ChevronRight, ClipboardList, MessageSquare, Sparkles } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

// ── Types ───────────────────────────────────────────────────────────────────

export type RuntimeMode = 'single_question' | 'task_list';

export interface RuntimeModeSelectorProps {
  /** Currently selected mode (null = not yet chosen) */
  currentMode: RuntimeMode | null;
  /** AI-suggested mode for "Recommended" badge */
  recommendedMode?: RuntimeMode | null;
  /** Mode selection callback */
  onModeSelect: (mode: RuntimeMode) => void;
  /** Compact variant for already-started interviews */
  compact?: boolean;
  /** Read-only mode */
  locked?: boolean;
}

// ── Mode config ──────────────────────────────────────────────────────────────

const MODE_CONFIG: Record<
  RuntimeMode,
  {
    icon: typeof MessageSquare;
    titleKey: string;
    descKey: string;
    prosKey: string;
    consKey: string;
  }
> = {
  single_question: {
    icon: MessageSquare,
    titleKey: 'interview.runtimeMode.singleQuestion.title',
    descKey: 'interview.runtimeMode.singleQuestion.description',
    prosKey: 'interview.runtimeMode.singleQuestion.pros',
    consKey: 'interview.runtimeMode.singleQuestion.cons',
  },
  task_list: {
    icon: ClipboardList,
    titleKey: 'interview.runtimeMode.taskList.title',
    descKey: 'interview.runtimeMode.taskList.description',
    prosKey: 'interview.runtimeMode.taskList.pros',
    consKey: 'interview.runtimeMode.taskList.cons',
  },
};

// ── Component ───────────────────────────────────────────────────────────────

export const RuntimeModeSelector: React.FC<RuntimeModeSelectorProps> = ({
  currentMode,
  recommendedMode,
  onModeSelect,
  compact = false,
  locked = false,
}) => {
  const { t } = useTranslation();

  if (compact && currentMode) {
    return (
      <div className="flex items-center gap-3 rounded-lg bg-slate-50/50 dark:bg-navy-900/50 px-3 py-2">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {t('interview.runtimeMode.label')}:
        </span>
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {currentMode === 'single_question'
            ? t('interview.runtimeMode.singleQuestion.title')
            : t('interview.runtimeMode.taskList.title')}
        </span>
        {!locked && (
          <button
            type="button"
            onClick={() =>
              onModeSelect(currentMode === 'single_question' ? 'task_list' : 'single_question')
            }
            className="flex items-center gap-1 text-xs font-medium text-primary-500 hover:text-primary-600 transition-colors"
          >
            <ChevronRight size={14} className="rotate-90" />
            {t('interview.runtimeMode.switch')}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {t('interview.runtimeMode.chooseTitle')}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(['single_question', 'task_list'] as const).map((mode) => {
          const config = MODE_CONFIG[mode];
          const Icon = config.icon;
          const isSelected = currentMode === mode;
          const isRecommended = recommendedMode === mode;

          return (
            <button
              key={mode}
              type="button"
              onClick={() => !locked && onModeSelect(mode)}
              disabled={locked}
              className={`relative flex flex-col items-start gap-3 p-4 rounded-xl text-left transition-all ${
                isSelected
                  ? 'bg-primary-500/10 dark:bg-primary-500/15 ring-1 ring-primary-500/40'
                  : 'bg-slate-50 dark:bg-navy-900/50 hover:bg-slate-100 dark:hover:bg-navy-800/50'
              } ${locked ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
            >
              {isRecommended && (
                <span className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary-500/20 text-primary-600 dark:text-primary-400">
                  <Sparkles size={10} />
                  {t('interview.runtimeMode.recommended')}
                </span>
              )}
              <div className="flex items-start gap-3 w-full">
                <div
                  className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                    isSelected
                      ? 'bg-primary-500/20 text-primary-600 dark:text-primary-400'
                      : 'bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Icon size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {t(config.titleKey)}
                  </h4>
                  <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {t(config.descKey)}
                  </p>
                </div>
                <div
                  className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center border-2 ${
                    isSelected
                      ? 'border-primary-500 bg-primary-500'
                      : 'border-slate-300 dark:border-navy-600'
                  }`}
                >
                  {isSelected && <Check size={12} className="text-white" strokeWidth={3} />}
                </div>
              </div>
              <div className="flex gap-4 text-[11px] w-full">
                <div className="flex-1">
                  <span className="font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    {t('interview.runtimeMode.pros')}
                  </span>
                  <p className="mt-0.5 text-slate-600 dark:text-slate-400">{t(config.prosKey)}</p>
                </div>
                <div className="flex-1">
                  <span className="font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    {t('interview.runtimeMode.cons')}
                  </span>
                  <p className="mt-0.5 text-slate-600 dark:text-slate-400">{t(config.consKey)}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default RuntimeModeSelector;
