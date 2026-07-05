import { Check } from 'lucide-react';
import React from 'react';

import { useDeviceType } from '../../hooks/useDeviceType';
import { MaturityLevel } from '../../types';
import { getAssessmentButtonClasses, getLevelBubbleClasses } from '../../utils/assessmentColors';

interface LevelSelectorProps {
  levels: Record<string, string>; // "1": "Description"
  actual: number | undefined;
  target: number | undefined;
  onSelect: (type: 'actual' | 'target', level: number) => void;
  readOnly?: boolean;
}

export const LevelSelector: React.FC<LevelSelectorProps> = ({
  levels,
  actual,
  target,
  onSelect,
  readOnly = false,
}) => {
  const { isTablet, isMobile, isTouchDevice } = useDeviceType();
  const isCompact = isTablet || isMobile;

  return (
    <div className="space-y-3 relative">
      {/* Connecting Line - hidden on mobile for cleaner look */}
      <div
        className={`absolute left-[27px] top-4 bottom-4 w-0.5 bg-slate-50 dark:bg-white/5 -z-0 ${isCompact ? 'hidden' : ''}`}
      ></div>

      {Object.entries(levels).map(([key, desc]) => {
        const levelNum = parseInt(key, 10);
        const isActual = actual === levelNum;
        const isTarget = target === levelNum;

        // Gap highlighting
        const isInGap = actual && target && levelNum > actual && levelNum < target;

        return (
          <div
            key={key}
            className={`
                            relative group rounded-xl border transition-all
                            ${isCompact ? 'p-3' : 'flex items-start gap-4 p-3'}
                            ${
                              isActual || isTarget
                                ? 'bg-white dark:bg-navy-900 border-slate-200 dark:border-white/10 shadow-lg'
                                : isInGap
                                  ? 'bg-navy-900/40 border-primary-500/10'
                                  : 'bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-navy-800/20 active:bg-white/10'
                            }
                        `}
          >
            {/* Mobile/Tablet Layout */}
            {isCompact ? (
              <div className="space-y-3">
                {/* Header Row */}
                <div className="flex items-center gap-3">
                  {/* Number Bubble - smaller on mobile */}
                  <div
                    className={`shrink-0 w-10 h-10 rounded-full border-2 flex items-center justify-center text-base font-bold bg-slate-50 dark:bg-navy-950 z-10 transition-colors ${getLevelBubbleClasses(isActual, isTarget, !!isInGap)}`}
                  >
                    {levelNum}
                  </div>

                  {/* Description */}
                  <div
                    className={`flex-1 text-sm font-medium transition-colors ${isActual || isTarget ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 dark:text-slate-500'}`}
                  >
                    {desc}
                  </div>
                </div>

                {/* Touch-friendly Buttons Row */}
                {!readOnly && (
                  <div className="grid grid-cols-2 gap-2">
                    {/* Actual Button - Touch optimized */}
                    <button
                      onClick={() => onSelect('actual', levelNum)}
                      disabled={readOnly}
                      className={`
                                                touch-target touch-ripple flex items-center justify-center gap-2
                                                px-4 py-3 text-xs font-bold rounded-xl border transition-all
                                                ${
                                                  isActual
                                                    ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20'
                                                    : 'bg-slate-50 dark:bg-navy-950 border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 dark:text-slate-500 active:bg-blue-600/20 active:border-blue-500/50'
                                                }
                                            `}
                    >
                      {isActual && <Check size={14} />}
                      ACTUAL
                    </button>

                    {/* Target Button - Touch optimized */}
                    <button
                      onClick={() => onSelect('target', levelNum)}
                      disabled={readOnly}
                      className={`
                                                touch-target touch-ripple flex items-center justify-center gap-2
                                                px-4 py-3 text-xs font-bold rounded-xl border transition-all
                                                ${
                                                  isTarget
                                                    ? 'bg-c-text border-c-text text-c-bg shadow-lg shadow-black/10'
                                                    : 'bg-slate-50 dark:bg-navy-950 border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 dark:text-slate-500 active:bg-primary-600/20 active:border-primary-500/50'
                                                }
                                            `}
                    >
                      {isTarget && <Check size={14} />}
                      TARGET
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* Desktop Layout */
              <>
                {/* Number Bubble */}
                <div
                  className={`shrink-0 w-14 h-14 rounded-full border-2 flex items-center justify-center text-xl font-bold bg-slate-50 dark:bg-navy-950 z-10 transition-colors ${getLevelBubbleClasses(isActual, isTarget, !!isInGap)}`}
                >
                  {levelNum}
                </div>

                {/* Content */}
                <div className="flex-1 pt-1 min-w-0">
                  <div
                    className={`text-lg font-medium transition-colors ${isActual || isTarget ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 dark:text-slate-500 group-hover:text-slate-200'}`}
                  >
                    {desc}
                  </div>
                </div>

                {/* Selection Controls - hidden in readOnly mode */}
                {!readOnly && (
                  <div className="flex flex-col gap-2 shrink-0 pt-1">
                    {/* Actual Button */}
                    <button
                      onClick={() => onSelect('actual', levelNum)}
                      disabled={readOnly}
                      className={`px-3 py-1 text-xs font-bold rounded-full border transition-all flex items-center gap-1 ${isActual ? getAssessmentButtonClasses('actual', true).replace('px-6 py-3', 'px-3 py-1').replace('text-sm', 'text-xs') : 'bg-slate-50 dark:bg-navy-950 border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:border-blue-500/50 hover:text-blue-400 opacity-0 group-hover:opacity-100'}`}
                    >
                      {isActual && <Check size={12} />}
                      ACTUAL
                    </button>

                    {/* Target Button */}
                    <button
                      onClick={() => onSelect('target', levelNum)}
                      disabled={readOnly}
                      className={`px-3 py-1 text-xs font-bold rounded-full border transition-all flex items-center gap-1 ${isTarget ? getAssessmentButtonClasses('target', true).replace('px-6 py-3', 'px-3 py-1').replace('text-sm', 'text-xs') : 'bg-slate-50 dark:bg-navy-950 border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:border-primary-500/50 hover:text-primary-400 opacity-0 group-hover:opacity-100'}`}
                    >
                      {isTarget && <Check size={12} />}
                      TARGET
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};
