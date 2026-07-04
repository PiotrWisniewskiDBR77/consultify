import { Check, Circle, Play } from 'lucide-react';
import React from 'react';

import { CATEGORY_CONFIG, type InsightCategory } from './CategoryIcon';

interface InterviewProgressProps {
  completed: InsightCategory[];
  current: InsightCategory | null;
  remaining: InsightCategory[];
  onCategoryClick?: (category: InsightCategory) => void;
}

const ALL_CATEGORIES: InsightCategory[] = [
  'objective',
  'stakeholder',
  'risk',
  'assumption',
  'constraint',
  'decision',
  'dependency',
  'success_criteria',
];

export function InterviewProgress({
  completed,
  current,
  remaining,
  onCategoryClick,
}: InterviewProgressProps) {
  const getStatus = (category: InsightCategory): 'completed' | 'current' | 'remaining' => {
    if (completed.includes(category)) return 'completed';
    if (category === current) return 'current';
    return 'remaining';
  };

  return (
    <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
        <Play size={16} className="text-primary-500" />
        Interview Progress
      </h3>

      <div className="space-y-1">
        {ALL_CATEGORIES.map((category, index) => {
          const config = CATEGORY_CONFIG[category];
          const status = getStatus(category);
          const IconComponent = config.icon;

          return (
            <button
              key={category}
              onClick={() => onCategoryClick?.(category)}
              disabled={!onCategoryClick}
              className={`
                w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all
                ${
                  status === 'current'
                    ? 'bg-primary-50 dark:bg-primary-900/20 ring-1 ring-c-info dark:ring-c-info'
                    : 'hover:bg-slate-50 dark:hover:bg-white/5'
                }
                ${!onCategoryClick ? 'cursor-default' : 'cursor-pointer'}
              `}
            >
              {/* Status Indicator */}
              <div
                className={`
                w-6 h-6 rounded-full flex items-center justify-center shrink-0
                ${
                  status === 'completed'
                    ? 'bg-emerald-100 dark:bg-emerald-900/30'
                    : status === 'current'
                      ? 'bg-primary-100 dark:bg-primary-900/30 animate-pulse'
                      : 'bg-slate-100 dark:bg-slate-800'
                }
              `}
              >
                {status === 'completed' ? (
                  <Check size={14} className="text-emerald-600 dark:text-emerald-400" />
                ) : status === 'current' ? (
                  <Circle
                    size={14}
                    className="text-primary-600 dark:text-primary-400 fill-current"
                  />
                ) : (
                  <Circle size={14} className="text-slate-600 dark:text-slate-500" />
                )}
              </div>

              {/* Category Icon & Label */}
              <IconComponent
                size={16}
                className={`
                  shrink-0
                  ${
                    status === 'completed'
                      ? config.color
                      : status === 'current'
                        ? 'text-primary-600 dark:text-primary-400'
                        : 'text-slate-600 dark:text-slate-500'
                  }
                `}
              />

              <span
                className={`
                text-sm font-medium flex-1
                ${
                  status === 'completed'
                    ? 'text-slate-700 dark:text-slate-300'
                    : status === 'current'
                      ? 'text-primary-700 dark:text-primary-300'
                      : 'text-slate-600 dark:text-slate-500'
                }
              `}
              >
                {config.label}
              </span>

              {/* Progress line */}
              {index < ALL_CATEGORIES.length - 1 && (
                <div className="absolute left-[30px] top-[calc(100%+2px)] w-0.5 h-2 bg-slate-200 dark:bg-slate-700" />
              )}
            </button>
          );
        })}
      </div>

      {/* Progress Stats */}
      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-navy-700">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400">Progress</span>
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            {completed.length} / {ALL_CATEGORIES.length} complete
          </span>
        </div>
        <div className="mt-2 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary-500 to-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${(completed.length / ALL_CATEGORIES.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
