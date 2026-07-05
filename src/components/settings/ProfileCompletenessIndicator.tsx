/**
 * ProfileCompletenessIndicator - Simple progress bar showing profile completion
 *
 * Features:
 * - Progress bar (0-100%)
 * - Completion percentage display
 * - Quick action to complete profile
 */

import { CheckCircle2, Circle, TrendingUp } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { User } from '../../types';

interface ProfileCompletenessIndicatorProps {
  currentUser: User;
  onNavigate?: (tab: string) => void;
  showDetails?: boolean;
}

// Profile completion criteria (simplified version)
const COMPLETION_ITEMS = [
  { id: 'avatar', weight: 15, isComplete: (user: User) => !!user.avatarUrl },
  { id: 'name', weight: 20, isComplete: (user: User) => !!(user.firstName && user.lastName) },
  { id: 'jobTitle', weight: 15, isComplete: (user: User) => !!(user as any).jobTitle },
  { id: 'phone', weight: 10, isComplete: (user: User) => !!user.phone },
  {
    id: 'timezone',
    weight: 10,
    isComplete: (user: User) => !!user.timezone && user.timezone !== 'UTC',
  },
  { id: 'bio', weight: 10, isComplete: (user: User) => !!user.bio },
  {
    id: 'skills',
    weight: 10,
    isComplete: (user: User) => !!(user.skills && user.skills.length > 0),
  },
  { id: 'mfa', weight: 10, isComplete: (user: User) => !!user.mfaEnabled },
];

export const ProfileCompletenessIndicator: React.FC<ProfileCompletenessIndicatorProps> = ({
  currentUser,
  onNavigate,
  showDetails = false,
}) => {
  const { t } = useTranslation();

  const completionData = useMemo(() => {
    const completed = COMPLETION_ITEMS.filter((item) => item.isComplete(currentUser));
    const totalWeight = COMPLETION_ITEMS.reduce((sum, item) => sum + item.weight, 0);
    const completedWeight = completed.reduce((sum, item) => sum + item.weight, 0);
    const percentage = Math.round((completedWeight / totalWeight) * 100);

    const incomplete = COMPLETION_ITEMS.filter((item) => !item.isComplete(currentUser));

    return {
      percentage,
      completed: completed.length,
      total: COMPLETION_ITEMS.length,
      incomplete,
    };
  }, [currentUser]);

  const getColorClass = (percentage: number) => {
    if (percentage >= 100) return 'bg-green-500';
    if (percentage >= 75) return 'bg-blue-500';
    if (percentage >= 50) return 'bg-yellow-500';
    if (percentage >= 25) return 'bg-amber-500';
    return 'bg-danger-500';
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-c-text-muted" />
          <span className="text-sm font-medium text-c-text-secondary">
            {t('settings.profile.completeness.title', 'Profile Completion')}
          </span>
        </div>
        <span
          className={`text-sm font-bold ${
            completionData.percentage >= 100
              ? 'text-green-600 dark:text-green-400'
              : 'text-c-text-secondary'
          }`}
        >
          {completionData.percentage}%
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2 bg-c-surface-raised rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${getColorClass(completionData.percentage)}`}
          style={{ width: `${completionData.percentage}%` }}
        />
      </div>

      {/* Details */}
      {showDetails && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-c-text-muted">
            <span>
              {completionData.completed} / {completionData.total}{' '}
              {t('settings.profile.completeness.items', 'items completed')}
            </span>
          </div>

          {completionData.incomplete.length > 0 && (
            <div className="pt-2 border-t border-c-border-subtle dark:border-navy-700">
              <p className="text-xs text-c-text-muted mb-2">
                {t('settings.profile.completeness.missing', 'Missing items')}:
              </p>
              <div className="flex flex-wrap gap-1">
                {completionData.incomplete.map((item) => (
                  <span
                    key={item.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-c-surface-raised text-c-text-secondary rounded text-xs"
                  >
                    <Circle size={10} />
                    {t(`settings.profile.completeness.${item.id}`, item.id)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProfileCompletenessIndicator;
