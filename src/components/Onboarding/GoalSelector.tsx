import {
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  Presentation,
  Target,
  Users,
} from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FIRST_VALUE_TOUR } from '../../config/tours/firstValueTour';
import { TEAM_TOUR } from '../../config/tours/teamTour';
import { Api } from '../../services/api';
import { useTour } from './TourProvider';

/**
 * GoalSelector — Phase E Entry
 *
 * Allows user to select their primary goal.
 * Personalizes the onboarding experience based on selection.
 */

export interface UserGoal {
  id: string;
  /** i18n key suffix under `firstRun.goals.*` */
  i18nKey: string;
  /** English fallback title (shown if no translation present) */
  title: string;
  /** English fallback description */
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  suggestedActions: string[];
  tourId?: string;
  estimatedTime: string;
  color: string;
}

export const USER_GOALS: UserGoal[] = [
  {
    id: 'strategic_decision',
    i18nKey: 'strategic',
    title: 'Understand a key decision',
    description: 'I have a specific strategic decision to analyze and I want to structure it.',
    icon: Target,
    suggestedActions: ['create_axis', 'add_position', 'generate_snapshot'],
    tourId: 'first_value',
    estimatedTime: '30-45 min',
    color: 'purple',
  },
  {
    id: 'team_alignment',
    i18nKey: 'team',
    title: 'Structure team knowledge',
    description:
      'I want to gather my team’s different perspectives in one place and surface divergences.',
    icon: Users,
    suggestedActions: ['create_axis', 'invite_team', 'multi_perspective'],
    tourId: 'team_expansion',
    estimatedTime: '1-2 h',
    color: 'blue',
  },
  {
    id: 'executive_prep',
    i18nKey: 'executive',
    title: 'Prepare material for the board',
    description: 'I need a structured analysis to present to decision-makers.',
    icon: Presentation,
    suggestedActions: ['create_axis', 'document_positions', 'generate_report'],
    estimatedTime: '2-3 h',
    color: 'emerald',
  },
  {
    id: 'explore',
    i18nKey: 'explore',
    title: 'Exploring the possibilities',
    description: 'I want to see how the system can help my organization without a specific goal.',
    icon: Compass,
    suggestedActions: ['browse_demo', 'read_methodology'],
    estimatedTime: '15-30 min',
    color: 'amber',
  },
];

interface GoalSelectorProps {
  onGoalSelected: (goal: UserGoal) => void;
  initialGoalId?: string;
  showSkip?: boolean;
}

export const GoalSelector: React.FC<GoalSelectorProps> = ({
  onGoalSelected,
  initialGoalId,
  showSkip = true,
}) => {
  const { t } = useTranslation();
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(initialGoalId || null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { startTour } = useTour();

  const handleSelect = (goal: UserGoal) => {
    setSelectedGoalId(goal.id);
  };

  const handleConfirm = async () => {
    if (!selectedGoalId) return;

    const goal = USER_GOALS.find((g) => g.id === selectedGoalId);
    if (!goal) return;

    setIsSubmitting(true);

    try {
      // Save goal to backend
      await Api.post('/user/goals', { goalId: goal.id });

      // Track milestone
      try {
        await Api.post('/analytics/journey/track', {
          eventType: 'milestone',
          eventName: 'goal_selected',
          metadata: { goalId: goal.id },
        });
      } catch {
        /* ignore */
      }

      // Trigger appropriate tour
      if (goal.tourId === 'first_value') {
        startTour(FIRST_VALUE_TOUR as any);
      } else if (goal.tourId === 'team_expansion') {
        startTour(TEAM_TOUR as any);
      }

      onGoalSelected(goal);
    } catch (error) {
      console.error('Failed to save goal:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    // Default to explore mode
    const exploreGoal = USER_GOALS.find((g) => g.id === 'explore')!;
    onGoalSelected(exploreGoal);
  };

  const colorClasses: Record<string, { bg: string; border: string; text: string }> = {
    purple: {
      bg: 'bg-[color-mix(in_srgb,var(--c-tag-3)_12%,transparent)]',
      border: 'border-c-tag-3',
      text: 'text-c-tag-3',
    },
    blue: {
      bg: 'bg-[color-mix(in_srgb,var(--c-tag-1)_12%,transparent)]',
      border: 'border-c-tag-1',
      text: 'text-c-tag-1',
    },
    emerald: {
      bg: 'bg-[color-mix(in_srgb,var(--c-tag-6)_12%,transparent)]',
      border: 'border-c-tag-6',
      text: 'text-c-tag-6',
    },
    amber: {
      bg: 'bg-[color-mix(in_srgb,var(--c-tag-9)_12%,transparent)]',
      border: 'border-c-tag-9',
      text: 'text-c-tag-9',
    },
  };

  return (
    <div className="max-w-3xl mx-auto p-8">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-2xl font-bold text-c-text mb-3">
          {t('firstRun.goals.title', 'What do you want to achieve today?')}
        </h1>
        <p className="text-c-text-muted max-w-xl mx-auto">
          {t(
            'firstRun.goals.subtitle',
            'Your choice helps us tailor the experience and suggest the best next steps.'
          )}
        </p>
      </div>

      {/* Goal Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {USER_GOALS.map((goal) => {
          const isSelected = selectedGoalId === goal.id;
          const colors = colorClasses[goal.color];
          const Icon = goal.icon;

          return (
            <button
              key={goal.id}
              onClick={() => handleSelect(goal)}
              className={`
                                relative p-6 rounded-xl border-2 text-left transition-all duration-200
                                ${
                                  isSelected
                                    ? `${colors.bg} ${colors.border} shadow-lg`
                                    : 'bg-c-surface-raised border-c-border-subtle hover:border-c-border-subtle dark:hover:border-c-border-strong'
                                }
                            `}
            >
              {/* Selected indicator */}
              {isSelected && (
                <div className={`absolute top-3 right-3 ${colors.text}`}>
                  <CheckCircle2 size={20} />
                </div>
              )}

              {/* Icon */}
              <div
                className={`
                                w-12 h-12 rounded-xl flex items-center justify-center mb-4
                                ${isSelected ? colors.bg : 'bg-c-surface-raised dark:bg-c-surface'}
                            `}
              >
                <Icon
                  size={24}
                  className={
                    isSelected ? colors.text : 'text-c-text-secondary dark:text-c-text-muted'
                  }
                />
              </div>

              {/* Content */}
              <h3
                className={`
                                font-semibold mb-2
                                ${isSelected ? 'text-c-text' : 'text-c-text-secondary'}
                            `}
              >
                {t(`firstRun.goals.${goal.i18nKey}.title`, goal.title)}
              </h3>
              <p className="text-sm text-c-text-muted mb-3">
                {t(`firstRun.goals.${goal.i18nKey}.description`, goal.description)}
              </p>

              {/* Time estimate */}
              <div className="flex items-center gap-1.5 text-xs text-c-text-secondary dark:text-c-text-muted">
                <Clock size={12} />
                <span>{goal.estimatedTime}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        {showSkip && (
          <button
            onClick={handleSkip}
            className="text-sm text-c-text-muted hover:text-c-text-secondary dark:hover:text-c-text-muted transition-colors"
          >
            {t('firstRun.goals.skip', 'Skip for now')}
          </button>
        )}
        <div className="flex-1" />
        <button
          onClick={handleConfirm}
          disabled={!selectedGoalId || isSubmitting}
          className={`
                        flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all
                        ${
                          selectedGoalId
                            ? 'bg-c-text text-c-surface hover:opacity-90 shadow-lg'
                            : 'bg-c-surface-raised dark:bg-c-surface text-c-text-secondary dark:text-c-text-muted cursor-not-allowed'
                        }
                    `}
        >
          {isSubmitting
            ? t('firstRun.goals.saving', 'Saving…')
            : t('firstRun.goals.continue', 'Continue')}
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

export default GoalSelector;
