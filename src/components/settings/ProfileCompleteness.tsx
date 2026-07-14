/**
 * ProfileCompleteness - Visual indicator of profile completion
 *
 * Features:
 * - Progress bar showing completion percentage
 * - Breakdown of completed/incomplete items
 * - Actionable suggestions to complete profile
 * - Animated progress updates
 */

import {
  AlertCircle,
  Award,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock,
  Image,
  Lightbulb,
  Link2,
  Loader2,
  Phone,
  Shield,
  Sparkles,
  User as UserIcon,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { User } from '../../types';

interface ProfileCompletenessProps {
  currentUser: User;
  onNavigate?: (tab: string) => void;
  compact?: boolean;
}

// Profile completion criteria
interface CompletionItem {
  id: string;
  label: string;
  icon: React.ElementType;
  weight: number; // Percentage weight
  isComplete: (user: User) => boolean;
  action?: string; // Tab to navigate to
  actionLabel?: string;
}

const COMPLETION_ITEMS: CompletionItem[] = [
  {
    id: 'avatar',
    label: 'Profile Photo',
    icon: Image,
    weight: 15,
    isComplete: (user) => !!user.avatarUrl,
    action: 'avatar',
    actionLabel: 'Upload photo',
  },
  {
    id: 'name',
    label: 'Full Name',
    icon: UserIcon,
    weight: 20,
    isComplete: (user) => !!(user.firstName && user.lastName),
    action: 'personal',
    actionLabel: 'Add name',
  },
  {
    id: 'jobTitle',
    label: 'Job Title',
    icon: Briefcase,
    weight: 15,
    isComplete: (user) => !!(user as any).jobTitle,
    action: 'personal',
    actionLabel: 'Add job title',
  },
  {
    id: 'phone',
    label: 'Phone Number',
    icon: Phone,
    weight: 10,
    isComplete: (user) => !!user.phone,
    action: 'personal',
    actionLabel: 'Add phone',
  },
  {
    id: 'timezone',
    label: 'Timezone',
    icon: Clock,
    weight: 10,
    isComplete: (user) => !!user.timezone && user.timezone !== 'UTC',
    action: 'personal',
    actionLabel: 'Set timezone',
  },
  {
    id: 'connectedAccounts',
    label: 'Connected Account',
    icon: Link2,
    weight: 15,
    isComplete: (user) => {
      const accounts = (user as any).linkedAccounts || {};
      return !!(accounts.google || accounts.linkedin);
    },
    action: 'connected',
    actionLabel: 'Connect account',
  },
  {
    id: 'mfa',
    label: 'Two-Factor Auth',
    icon: Shield,
    weight: 15,
    isComplete: (user) => !!user.mfaEnabled,
    action: 'personal',
    actionLabel: 'Enable 2FA',
  },
];

// Get completion level label and color
const getCompletionLevel = (
  percentage: number
): { label: string; color: string; bgColor: string } => {
  if (percentage >= 100)
    return {
      label: 'Complete',
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-500',
    };
  if (percentage >= 75)
    return {
      label: 'Almost There',
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-500',
    };
  if (percentage >= 50)
    return {
      label: 'Halfway',
      color: 'text-yellow-600 dark:text-yellow-400',
      bgColor: 'bg-yellow-500',
    };
  if (percentage >= 25)
    return {
      label: 'Getting Started',
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-500',
    };
  return {
    label: 'Just Beginning',
    color: 'text-danger-600 dark:text-danger-400',
    bgColor: 'bg-danger-500',
  };
};

interface Achievement {
  achievement_type: string;
  unlocked_at: string;
  metadata?: any;
}

interface Suggestion {
  type: string;
  priority: 'high' | 'medium' | 'low';
  message: string;
  action?: string;
  actionLabel?: string;
}

export const ProfileCompleteness: React.FC<ProfileCompletenessProps> = ({
  currentUser,
  onNavigate,
  compact = false,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [apiData, setApiData] = useState<any>(null);

  useEffect(() => {
    loadCompletenessData();
  }, [currentUser.id]);

  const loadCompletenessData = async () => {
    try {
      setLoading(true);
      const data = await (Api as any).get('/api/user/profile-completeness');
      if (data.success && data.data) {
        setApiData(data.data);
        setAchievements(data.data.achievements || []);
        setSuggestions(data.data.suggestions || []);
      }
    } catch (error) {
      console.error('Failed to load profile completeness:', error);
    } finally {
      setLoading(false);
    }
  };

  // Use API data if available, otherwise calculate locally
  const { percentage, completedItems, incompleteItems } = useMemo(() => {
    if (apiData) {
      // Use API data
      const items = apiData.items || [];
      return {
        percentage: apiData.percentage || 0,
        completedItems: items.filter((i: any) => i.isComplete),
        incompleteItems: items.filter((i: any) => !i.isComplete),
      };
    }

    // Fallback to local calculation
    let totalWeight = 0;
    let completedWeight = 0;
    const completed: CompletionItem[] = [];
    const incomplete: CompletionItem[] = [];

    COMPLETION_ITEMS.forEach((item) => {
      totalWeight += item.weight;
      if (item.isComplete(currentUser)) {
        completedWeight += item.weight;
        completed.push(item);
      } else {
        incomplete.push(item);
      }
    });

    return {
      percentage: Math.round((completedWeight / totalWeight) * 100),
      completedItems: completed,
      incompleteItems: incomplete,
    };
  }, [currentUser, apiData]);

  const level = getCompletionLevel(percentage);

  // Get milestone badges
  const milestoneBadges = useMemo(() => {
    const badges = [];
    if (percentage >= 25)
      badges.push({ type: 'PROFILE_COMPLETE_25', label: '25% Complete', icon: Award });
    if (percentage >= 50)
      badges.push({ type: 'PROFILE_COMPLETE_50', label: '50% Complete', icon: Award });
    if (percentage >= 75)
      badges.push({ type: 'PROFILE_COMPLETE_75', label: '75% Complete', icon: Award });
    if (percentage >= 100)
      badges.push({ type: 'PROFILE_COMPLETE_100', label: '100% Complete', icon: Sparkles });
    return badges;
  }, [percentage]);

  // Compact version for sidebar or card display
  if (compact) {
    return (
      <div className="p-4 bg-gradient-to-r from-c-accent-soft to-c-accent  rounded-lg border border-c-accent dark:border-c-accent">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-c-text-secondary">Profile Completion</span>
          <div className="flex items-center gap-2">
            {milestoneBadges.length > 0 && (
              <div className="flex gap-1">
                {milestoneBadges.map((badge, idx) => {
                  const Icon = badge.icon;
                  return <Icon key={idx} size={14} className="text-yellow-500" />;
                })}
              </div>
            )}
            <span className={`text-sm font-bold ${level.color}`}>{percentage}%</span>
          </div>
        </div>
        <div className="h-2 bg-c-surface rounded-full overflow-hidden">
          <div
            className={`h-full ${level.bgColor} transition-all duration-500 ease-out`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        {percentage < 100 && (
          <p className="text-xs text-c-text-muted mt-2">
            {incompleteItems.length} item{incompleteItems.length !== 1 ? 's' : ''} remaining
          </p>
        )}
      </div>
    );
  }

  // Full version
  return (
    <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl overflow-hidden">
      {/* Header with Progress */}
      <div className="p-6 bg-gradient-to-r from-c-accent-soft to-c-accent  border-b border-c-accent dark:border-c-accent">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-c-text flex items-center gap-2">
              {percentage === 100 && <Sparkles size={20} className="text-yellow-500" />}
              Profile Completeness
            </h3>
            <p className={`text-sm font-medium mt-1 ${level.color}`}>{level.label}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-c-text">{percentage}%</div>
            <p className="text-xs text-c-text-muted">
              {completedItems.length}/{COMPLETION_ITEMS.length} items
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-3 bg-c-surface rounded-full overflow-hidden shadow-inner">
          <div
            className={`h-full ${level.bgColor} transition-all duration-700 ease-out rounded-full`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Items List */}
      <div className="divide-y divide-c-border-subtle dark:divide-white/5">
        {/* Incomplete Items First */}
        {incompleteItems.map((item: any) => {
          const Icon = item.icon || Circle;
          return (
            <div
              key={item.id}
              className="px-6 py-4 flex items-center justify-between hover:bg-c-surface-raised dark:hover:bg-c-surface-raised transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-c-surface-raised text-c-text-secondary">
                  <Icon size={18} />
                </div>
                <div>
                  <p className="font-medium text-c-text-secondary">{item.label}</p>
                  <p className="text-xs text-c-text-secondary">+{item.weight}% completion</p>
                </div>
              </div>
              {item.action && onNavigate && (
                <button
                  onClick={() => onNavigate(item.action!)}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-c-accent hover:bg-c-accent-soft dark:hover:bg-c-accent-soft rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                >
                  {item.actionLabel}
                  <ChevronRight size={14} />
                </button>
              )}
            </div>
          );
        })}

        {/* Completed Items */}
        {completedItems.map((item: any) => {
          const Icon = item.icon || CheckCircle2;
          return (
            <div key={item.id} className="px-6 py-4 flex items-center justify-between opacity-60">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400">
                  <Icon size={18} />
                </div>
                <div>
                  <p className="font-medium text-c-text-secondary">{item.label}</p>
                  <p className="text-xs text-green-600 dark:text-green-400">Completed</p>
                </div>
              </div>
              <CheckCircle2 size={20} className="text-green-500" />
            </div>
          );
        })}
      </div>

      {/* Achievements Section */}
      {achievements.length > 0 && (
        <div className="px-6 py-4 bg-yellow-50 dark:bg-yellow-500/10 border-t border-yellow-100 dark:border-yellow-500/20">
          <h4 className="text-sm font-semibold text-c-text mb-2 flex items-center gap-2">
            <Award size={16} className="text-yellow-500" />
            {t('settings.completeness.achievements', 'Achievements')}
          </h4>
          <div className="flex flex-wrap gap-2">
            {achievements.map((achievement, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 rounded text-xs font-medium"
              >
                <Award size={12} />
                {achievement.achievement_type.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Role-based Suggestions */}
      {suggestions.length > 0 && (
        <div className="px-6 py-4 bg-blue-50 dark:bg-blue-500/10 border-t border-blue-100 dark:border-blue-500/20">
          <h4 className="text-sm font-semibold text-c-text mb-2 flex items-center gap-2">
            <Lightbulb size={16} className="text-blue-500" />
            {t('settings.completeness.suggestions', 'Suggestions')}
          </h4>
          <div className="space-y-2">
            {suggestions.map((suggestion, idx) => (
              <div key={idx} className="flex items-start gap-2 p-2 bg-c-surface rounded-lg">
                <AlertCircle
                  size={16}
                  className={`mt-0.5 ${
                    suggestion.priority === 'high'
                      ? 'text-danger-500'
                      : suggestion.priority === 'medium'
                        ? 'text-yellow-500'
                        : 'text-blue-500'
                  }`}
                />
                <div className="flex-1">
                  <p className="text-sm text-c-text-secondary">{suggestion.message}</p>
                  {suggestion.action && onNavigate && (
                    <button
                      onClick={() => onNavigate(suggestion.action!)}
                      className="mt-1 text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                    >
                      {suggestion.actionLabel}
                      <ChevronRight size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer Message */}
      {percentage === 100 ? (
        <div className="px-6 py-4 bg-green-50 dark:bg-green-500/10 border-t border-green-100 dark:border-green-500/20">
          <div className="flex items-center gap-3">
            <Sparkles className="text-green-500" size={20} />
            <p className="text-sm text-green-700 dark:text-green-300">
              <span className="font-medium">Congratulations!</span> Your profile is complete. You're
              getting the most out of Consultify.
            </p>
          </div>
        </div>
      ) : (
        <div className="px-6 py-4 bg-c-surface-raised border-t border-c-border-subtle dark:border-navy-700">
          <p className="text-sm text-c-text-muted">
            Complete your profile to unlock all features and get personalized recommendations.
          </p>
        </div>
      )}
    </div>
  );
};

export default ProfileCompleteness;
