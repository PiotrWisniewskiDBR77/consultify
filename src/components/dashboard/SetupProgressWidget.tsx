// @ts-nocheck
/**
 * SetupProgressWidget
 *
 * A dashboard widget showing onboarding/setup progress.
 * Shows next recommended actions and overall completion.
 */

import { ArrowRight, Check, ChevronRight, Rocket, Sparkles } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAppStore } from '../../store/useAppStore';
import { AppView } from '../../types';

interface QuickAction {
  id: string;
  titleKey: string;
  descriptionKey: string;
  icon: React.ReactNode;
  targetView: AppView;
  isCompleted: () => boolean;
  gradient: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'chat',
    titleKey: 'dashboard.setup.actions.chat.title',
    descriptionKey: 'dashboard.setup.actions.chat.description',
    icon: <Sparkles size={18} />,
    targetView: AppView.AI_CHAT,
    isCompleted: () => localStorage.getItem('consultinity_first_chat_done') === 'true',
    gradient: 'from-violet-500 to-purple-600',
  },
  {
    id: 'assessment',
    titleKey: 'dashboard.setup.actions.assessment.title',
    descriptionKey: 'dashboard.setup.actions.assessment.description',
    icon: <Check size={18} />,
    targetView: AppView.ASSESSMENT_HUB,
    isCompleted: () => useAppStore.getState().fullSessionData.step1Completed,
    gradient: 'from-emerald-500 to-teal-600',
  },
  {
    id: 'roadmap',
    titleKey: 'dashboard.setup.actions.roadmap.title',
    descriptionKey: 'dashboard.setup.actions.roadmap.description',
    icon: <ArrowRight size={18} />,
    targetView: AppView.ROADMAP,
    isCompleted: () => localStorage.getItem('consultinity_roadmap_visited') === 'true',
    gradient: 'from-blue-500 to-indigo-600',
  },
];

export const SetupProgressWidget: React.FC = () => {
  const { t } = useTranslation();
  const { setCurrentView } = useAppStore();
  const [completedCount, setCompletedCount] = useState(0);

  useEffect(() => {
    const count = QUICK_ACTIONS.filter((a) => a.isCompleted()).length;
    setCompletedCount(count);
  }, []);

  const progressPercent = Math.round((completedCount / QUICK_ACTIONS.length) * 100);
  const isAllComplete = completedCount === QUICK_ACTIONS.length;

  // Don't show if all complete
  if (isAllComplete) return null;

  const nextAction = QUICK_ACTIONS.find((a) => !a.isCompleted());

  return (
    <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Rocket size={20} className="text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-navy-900 dark:text-white">
              {t('dashboard.setup.title', 'Quick Start')}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('dashboard.setup.subtitle', 'Get the most out of Consultinity')}
            </p>
          </div>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center gap-2">
          <div className="w-24 h-2 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {completedCount}/{QUICK_ACTIONS.length}
          </span>
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {QUICK_ACTIONS.map((action) => {
          const completed = action.isCompleted();
          const isNext = action.id === nextAction?.id;

          return (
            <button
              key={action.id}
              onClick={() => setCurrentView(action.targetView)}
              disabled={completed}
              className={`
                                group relative p-4 rounded-xl text-left transition-all duration-200
                                ${
                                  completed
                                    ? 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20'
                                    : isNext
                                      ? 'bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-500/10 dark:to-purple-500/10 border border-indigo-200 dark:border-indigo-500/30 hover:shadow-lg hover:scale-[1.02]'
                                      : 'bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-navy-700 hover:bg-slate-100 dark:hover:bg-white/10'
                                }
                            `}
            >
              {/* Icon */}
              <div
                className={`
                                w-9 h-9 rounded-lg flex items-center justify-center mb-3
                                ${
                                  completed
                                    ? 'bg-emerald-500 text-white'
                                    : `bg-gradient-to-br ${action.gradient} text-white`
                                }
                            `}
              >
                {completed ? <Check size={18} /> : action.icon}
              </div>

              {/* Content */}
              <h4
                className={`
                                font-medium text-sm mb-1
                                ${
                                  completed
                                    ? 'text-emerald-700 dark:text-emerald-400 line-through opacity-60'
                                    : 'text-navy-900 dark:text-white'
                                }
                            `}
              >
                {t(action.titleKey, action.id)}
              </h4>
              <p
                className={`
                                text-xs
                                ${
                                  completed
                                    ? 'text-emerald-600/60 dark:text-emerald-400/60'
                                    : 'text-slate-500 dark:text-slate-400'
                                }
                            `}
              >
                {t(action.descriptionKey, '')}
              </p>

              {/* Arrow for incomplete */}
              {!completed && (
                <ChevronRight
                  size={16}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all"
                />
              )}

              {/* Completed badge */}
              {completed && (
                <div className="absolute top-3 right-3">
                  <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/20 px-2 py-0.5 rounded-full">
                    {t('dashboard.setup.done', 'Done')}
                  </span>
                </div>
              )}

              {/* Next badge */}
              {isNext && !completed && (
                <div className="absolute top-3 right-3">
                  <span className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-500/20 px-2 py-0.5 rounded-full animate-pulse">
                    {t('dashboard.setup.next', 'Next')}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SetupProgressWidget;
