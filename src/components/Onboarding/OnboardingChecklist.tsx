// @ts-nocheck
/**
 * OnboardingChecklist
 *
 * A compact checklist shown in sidebar for new users.
 * Tracks onboarding progress and guides users through setup.
 * Disappears once onboarding is complete.
 */

import { Check, ChevronDown, ChevronRight, Circle, Rocket, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAppStore } from '../../store/useAppStore';
import { AppView } from '../../types';

interface OnboardingStep {
  id: string;
  titleKey: string;
  descriptionKey: string;
  targetView?: AppView;
  checkFn: () => boolean;
  priority: number;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'profile',
    titleKey: 'onboarding.checklist.profile.title',
    descriptionKey: 'onboarding.checklist.profile.description',
    targetView: AppView.SETTINGS_PROFILE,
    checkFn: () => {
      const user = useAppStore.getState().currentUser;
      return !!(user?.firstName && user?.lastName && user?.companyName);
    },
    priority: 1,
  },
  {
    id: 'first_chat',
    titleKey: 'onboarding.checklist.firstChat.title',
    descriptionKey: 'onboarding.checklist.firstChat.description',
    targetView: AppView.AI_CHAT,
    checkFn: () => {
      // Check if user has sent at least one message
      const hasChats = localStorage.getItem('consultinity_first_chat_done') === 'true';
      return hasChats;
    },
    priority: 2,
  },
  {
    id: 'first_assessment',
    titleKey: 'onboarding.checklist.firstAssessment.title',
    descriptionKey: 'onboarding.checklist.firstAssessment.description',
    targetView: AppView.ASSESSMENT_SUMMARY,
    checkFn: () => {
      const { fullSessionData } = useAppStore.getState();
      return fullSessionData.step1Completed;
    },
    priority: 3,
  },
  {
    id: 'first_initiative',
    titleKey: 'onboarding.checklist.firstInitiative.title',
    descriptionKey: 'onboarding.checklist.firstInitiative.description',
    targetView: AppView.FULL_STEP2_INITIATIVES,
    checkFn: () => {
      const { fullSessionData } = useAppStore.getState();
      return fullSessionData.step2Completed;
    },
    priority: 4,
  },
  {
    id: 'explore_roadmap',
    titleKey: 'onboarding.checklist.roadmap.title',
    descriptionKey: 'onboarding.checklist.roadmap.description',
    targetView: AppView.PORTFOLIO_ROADMAP,
    checkFn: () => {
      return localStorage.getItem('consultinity_roadmap_visited') === 'true';
    },
    priority: 5,
  },
];

// Admin-specific steps
const ADMIN_ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'invite_team',
    titleKey: 'onboarding.checklist.inviteTeam.title',
    descriptionKey: 'onboarding.checklist.inviteTeam.description',
    targetView: AppView.ADMIN_TEAMS,
    checkFn: () => {
      return localStorage.getItem('consultinity_team_invited') === 'true';
    },
    priority: 2,
  },
  {
    id: 'setup_billing',
    titleKey: 'onboarding.checklist.billing.title',
    descriptionKey: 'onboarding.checklist.billing.description',
    targetView: AppView.SETTINGS_BILLING,
    checkFn: () => {
      return localStorage.getItem('consultinity_billing_setup') === 'true';
    },
    priority: 3,
  },
];

export const OnboardingChecklist: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser, setCurrentView, isSidebarCollapsed } = useAppStore();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);

  // Determine which steps to show based on user role
  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'OWNER';
  const steps = React.useMemo(() => {
    return isAdmin
      ? [...ONBOARDING_STEPS.slice(0, 2), ...ADMIN_ONBOARDING_STEPS, ...ONBOARDING_STEPS.slice(2)]
      : ONBOARDING_STEPS;
  }, [isAdmin]);

  // Check completion status
  useEffect(() => {
    const checkCompletion = () => {
      const completed = steps.filter((step) => step.checkFn()).map((step) => step.id);
      setCompletedSteps((prev) => {
        if (prev.length === completed.length && prev.every((id, idx) => id === completed[idx])) {
          return prev;
        }
        return completed;
      });
    };

    checkCompletion();
    // Re-check periodically
    const interval = setInterval(checkCompletion, 5000);
    return () => clearInterval(interval);
  }, [steps]);

  // Check if dismissed
  useEffect(() => {
    const dismissed = localStorage.getItem('consultinity_onboarding_dismissed') === 'true';
    setIsDismissed(dismissed);
  }, []);

  // Calculate progress
  const totalSteps = steps.length;
  const completedCount = completedSteps.length;
  const progressPercent = Math.round((completedCount / totalSteps) * 100);
  const isComplete = completedCount === totalSteps;

  // Don't show if dismissed or complete
  if (isDismissed || isComplete) return null;

  // Don't show in collapsed mode (too narrow)
  if (isSidebarCollapsed) return null;

  const handleStepClick = (step: OnboardingStep) => {
    if (step.targetView) {
      setCurrentView(step.targetView);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('consultinity_onboarding_dismissed', 'true');
    setIsDismissed(true);
  };

  const nextStep = steps.find((step) => !completedSteps.includes(step.id));

  return (
    <div className="mx-3 mb-4">
      <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 dark:from-indigo-500/20 dark:to-purple-500/20 rounded-xl border border-indigo-500/20 dark:border-indigo-400/20 overflow-hidden">
        {/* Header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-navy-800/20 transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Rocket size={14} className="text-white" />
            </div>
            <div className="text-left">
              <div className="text-xs font-semibold text-navy-900 dark:text-white">
                {t('onboarding.checklist.title', 'Getting Started')}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                {completedCount}/{totalSteps} {t('onboarding.checklist.completed', 'completed')}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Progress ring */}
            <div className="relative w-8 h-8">
              <svg className="w-8 h-8 transform -rotate-90">
                <circle
                  cx="16"
                  cy="16"
                  r="12"
                  stroke="currentColor"
                  strokeWidth="3"
                  fill="none"
                  className="text-slate-200 dark:text-white/10"
                />
                <circle
                  cx="16"
                  cy="16"
                  r="12"
                  stroke="currentColor"
                  strokeWidth="3"
                  fill="none"
                  strokeDasharray={75.4}
                  strokeDashoffset={75.4 - (75.4 * progressPercent) / 100}
                  className="text-indigo-500 transition-all duration-500"
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-indigo-600 dark:text-indigo-400">
                {progressPercent}%
              </span>
            </div>
            {isExpanded ? (
              <ChevronDown size={14} className="text-slate-400 dark:text-slate-500" />
            ) : (
              <ChevronRight size={14} className="text-slate-400 dark:text-slate-500" />
            )}
          </div>
        </button>

        {/* Steps list */}
        {isExpanded && (
          <div className="px-3 pb-3 space-y-1">
            {steps.slice(0, 5).map((step) => {
              const isCompleted = completedSteps.includes(step.id);
              const isNext = nextStep?.id === step.id;

              return (
                <button
                  key={step.id}
                  onClick={() => handleStepClick(step)}
                  disabled={isCompleted}
                  className={`
                                        w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all
                                        ${
                                          isCompleted
                                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                            : isNext
                                              ? 'bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 ring-1 ring-indigo-500/30'
                                              : 'hover:bg-white/10 text-slate-600 dark:text-slate-400'
                                        }
                                    `}
                >
                  <div
                    className={`
                                        w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0
                                        ${
                                          isCompleted
                                            ? 'bg-emerald-500 text-white'
                                            : isNext
                                              ? 'border-2 border-indigo-500 text-indigo-500'
                                              : 'border border-slate-300 dark:border-slate-600'
                                        }
                                    `}
                  >
                    {isCompleted ? (
                      <Check size={12} />
                    ) : isNext ? (
                      <Circle size={8} className="fill-current" />
                    ) : null}
                  </div>
                  <span
                    className={`text-xs font-medium truncate ${isCompleted ? 'line-through opacity-60' : ''}`}
                  >
                    {t(step.titleKey, step.id)}
                  </span>
                </button>
              );
            })}

            {/* Show more if > 5 steps */}
            {steps.length > 5 && (
              <div className="text-[10px] text-center text-slate-400 dark:text-slate-500 pt-1">
                +{steps.length - 5} {t('onboarding.checklist.more', 'more steps')}
              </div>
            )}

            {/* Dismiss button */}
            <button
              onClick={handleDismiss}
              className="w-full mt-2 flex items-center justify-center gap-1 px-2 py-1.5 text-[10px] text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300 transition-colors"
            >
              <X size={10} />
              {t('onboarding.checklist.dismiss', "I'll explore on my own")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OnboardingChecklist;
