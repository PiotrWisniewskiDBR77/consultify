/**
 * ProfileCompleteness - Visual indicator of profile completion
 * 
 * Features:
 * - Progress bar showing completion percentage
 * - Breakdown of completed/incomplete items
 * - Actionable suggestions to complete profile
 * - Animated progress updates
 */

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
    CheckCircle2, 
    Circle, 
    User as UserIcon, 
    Briefcase, 
    Phone, 
    Clock, 
    Shield, 
    Image,
    Link2,
    ChevronRight,
    Sparkles
} from 'lucide-react';
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
        actionLabel: 'Upload photo'
    },
    {
        id: 'name',
        label: 'Full Name',
        icon: UserIcon,
        weight: 20,
        isComplete: (user) => !!(user.firstName && user.lastName),
        action: 'personal',
        actionLabel: 'Add name'
    },
    {
        id: 'jobTitle',
        label: 'Job Title',
        icon: Briefcase,
        weight: 15,
        isComplete: (user) => !!(user as any).jobTitle,
        action: 'personal',
        actionLabel: 'Add job title'
    },
    {
        id: 'phone',
        label: 'Phone Number',
        icon: Phone,
        weight: 10,
        isComplete: (user) => !!user.phone,
        action: 'personal',
        actionLabel: 'Add phone'
    },
    {
        id: 'timezone',
        label: 'Timezone',
        icon: Clock,
        weight: 10,
        isComplete: (user) => !!user.timezone && user.timezone !== 'UTC',
        action: 'personal',
        actionLabel: 'Set timezone'
    },
    {
        id: 'connectedAccounts',
        label: 'Connected Account',
        icon: Link2,
        weight: 15,
        isComplete: (user) => {
            const accounts = user.linkedAccounts || {};
            return !!(accounts.google || accounts.linkedin);
        },
        action: 'connected',
        actionLabel: 'Connect account'
    },
    {
        id: 'mfa',
        label: 'Two-Factor Auth',
        icon: Shield,
        weight: 15,
        isComplete: (user) => !!user.mfaEnabled,
        action: 'personal',
        actionLabel: 'Enable 2FA'
    }
];

// Get completion level label and color
const getCompletionLevel = (percentage: number): { label: string; color: string; bgColor: string } => {
    if (percentage >= 100) return { label: 'Complete', color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-500' };
    if (percentage >= 75) return { label: 'Almost There', color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-500' };
    if (percentage >= 50) return { label: 'Halfway', color: 'text-yellow-600 dark:text-yellow-400', bgColor: 'bg-yellow-500' };
    if (percentage >= 25) return { label: 'Getting Started', color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-500' };
    return { label: 'Just Beginning', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-500' };
};

export const ProfileCompleteness: React.FC<ProfileCompletenessProps> = ({ 
    currentUser, 
    onNavigate,
    compact = false 
}) => {
    const { t } = useTranslation();

    // Calculate completion
    const { percentage, completedItems, incompleteItems } = useMemo(() => {
        let totalWeight = 0;
        let completedWeight = 0;
        const completed: CompletionItem[] = [];
        const incomplete: CompletionItem[] = [];

        COMPLETION_ITEMS.forEach(item => {
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
            incompleteItems: incomplete
        };
    }, [currentUser]);

    const level = getCompletionLevel(percentage);

    // Compact version for sidebar or card display
    if (compact) {
        return (
            <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-500/10 dark:to-indigo-500/10 rounded-lg border border-purple-100 dark:border-purple-500/20">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        Profile Completion
                    </span>
                    <span className={`text-sm font-bold ${level.color}`}>
                        {percentage}%
                    </span>
                </div>
                <div className="h-2 bg-white dark:bg-white/10 rounded-full overflow-hidden">
                    <div 
                        className={`h-full ${level.bgColor} transition-all duration-500 ease-out`}
                        style={{ width: `${percentage}%` }}
                    />
                </div>
                {percentage < 100 && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                        {incompleteItems.length} item{incompleteItems.length !== 1 ? 's' : ''} remaining
                    </p>
                )}
            </div>
        );
    }

    // Full version
    return (
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden">
            {/* Header with Progress */}
            <div className="p-6 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-500/10 dark:to-indigo-500/10 border-b border-purple-100 dark:border-purple-500/20">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                            {percentage === 100 && <Sparkles size={20} className="text-yellow-500" />}
                            Profile Completeness
                        </h3>
                        <p className={`text-sm font-medium mt-1 ${level.color}`}>
                            {level.label}
                        </p>
                    </div>
                    <div className="text-right">
                        <div className="text-3xl font-bold text-slate-900 dark:text-white">
                            {percentage}%
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            {completedItems.length}/{COMPLETION_ITEMS.length} items
                        </p>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="h-3 bg-white dark:bg-white/10 rounded-full overflow-hidden shadow-inner">
                    <div 
                        className={`h-full ${level.bgColor} transition-all duration-700 ease-out rounded-full`}
                        style={{ width: `${percentage}%` }}
                    />
                </div>
            </div>

            {/* Items List */}
            <div className="divide-y divide-slate-100 dark:divide-white/5">
                {/* Incomplete Items First */}
                {incompleteItems.map((item) => {
                    const Icon = item.icon;
                    return (
                        <div 
                            key={item.id}
                            className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-400">
                                    <Icon size={18} />
                                </div>
                                <div>
                                    <p className="font-medium text-slate-700 dark:text-slate-200">
                                        {item.label}
                                    </p>
                                    <p className="text-xs text-slate-400">
                                        +{item.weight}% completion
                                    </p>
                                </div>
                            </div>
                            {item.action && onNavigate && (
                                <button
                                    onClick={() => onNavigate(item.action!)}
                                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                >
                                    {item.actionLabel}
                                    <ChevronRight size={14} />
                                </button>
                            )}
                        </div>
                    );
                })}

                {/* Completed Items */}
                {completedItems.map((item) => {
                    const Icon = item.icon;
                    return (
                        <div 
                            key={item.id}
                            className="px-6 py-4 flex items-center justify-between opacity-60"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400">
                                    <Icon size={18} />
                                </div>
                                <div>
                                    <p className="font-medium text-slate-700 dark:text-slate-200">
                                        {item.label}
                                    </p>
                                    <p className="text-xs text-green-600 dark:text-green-400">
                                        Completed
                                    </p>
                                </div>
                            </div>
                            <CheckCircle2 size={20} className="text-green-500" />
                        </div>
                    );
                })}
            </div>

            {/* Footer Message */}
            {percentage === 100 ? (
                <div className="px-6 py-4 bg-green-50 dark:bg-green-500/10 border-t border-green-100 dark:border-green-500/20">
                    <div className="flex items-center gap-3">
                        <Sparkles className="text-green-500" size={20} />
                        <p className="text-sm text-green-700 dark:text-green-300">
                            <span className="font-medium">Congratulations!</span> Your profile is complete. 
                            You're getting the most out of Consultify.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="px-6 py-4 bg-slate-50 dark:bg-white/5 border-t border-slate-100 dark:border-white/5">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Complete your profile to unlock all features and get personalized recommendations.
                    </p>
                </div>
            )}
        </div>
    );
};

export default ProfileCompleteness;


