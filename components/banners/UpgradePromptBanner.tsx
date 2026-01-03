import React, { useState } from 'react';
import { TrendingUp, X, Rocket, Users, Database, Brain, ChevronRight, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../store/useAppStore';
import { AppView } from '../../types';

type LimitType = 'projects' | 'users' | 'storage' | 'ai_calls' | 'tokens' | 'general';

interface UpgradePromptBannerProps {
    limitType: LimitType;
    currentUsage?: number;
    maxLimit?: number;
    className?: string;
    variant?: 'banner' | 'inline' | 'card';
    onDismiss?: () => void;
    dismissible?: boolean;
}

const LIMIT_CONFIG: Record<LimitType, {
    icon: React.ReactNode;
    title: string;
    description: string;
    upgradeFeature: string;
    color: string;
}> = {
    projects: {
        icon: <Rocket className="w-5 h-5" />,
        title: 'upgrade.projectLimit.title',
        description: 'upgrade.projectLimit.description',
        upgradeFeature: 'Unlimited projects',
        color: 'from-blue-500 to-indigo-500'
    },
    users: {
        icon: <Users className="w-5 h-5" />,
        title: 'upgrade.userLimit.title',
        description: 'upgrade.userLimit.description',
        upgradeFeature: 'Unlimited team members',
        color: 'from-purple-500 to-pink-500'
    },
    storage: {
        icon: <Database className="w-5 h-5" />,
        title: 'upgrade.storageLimit.title',
        description: 'upgrade.storageLimit.description',
        upgradeFeature: 'Expanded storage',
        color: 'from-emerald-500 to-teal-500'
    },
    ai_calls: {
        icon: <Brain className="w-5 h-5" />,
        title: 'upgrade.aiLimit.title',
        description: 'upgrade.aiLimit.description',
        upgradeFeature: 'Unlimited AI calls',
        color: 'from-amber-500 to-orange-500'
    },
    tokens: {
        icon: <Sparkles className="w-5 h-5" />,
        title: 'upgrade.tokenLimit.title',
        description: 'upgrade.tokenLimit.description',
        upgradeFeature: 'More tokens',
        color: 'from-rose-500 to-red-500'
    },
    general: {
        icon: <TrendingUp className="w-5 h-5" />,
        title: 'upgrade.general.title',
        description: 'upgrade.general.description',
        upgradeFeature: 'Premium features',
        color: 'from-violet-500 to-purple-500'
    }
};

export const UpgradePromptBanner: React.FC<UpgradePromptBannerProps> = ({
    limitType,
    currentUsage,
    maxLimit,
    className = '',
    variant = 'banner',
    onDismiss,
    dismissible = true
}) => {
    const { t } = useTranslation();
    const { setCurrentView } = useAppStore();
    const [isDismissed, setIsDismissed] = useState(false);

    if (isDismissed) return null;

    const config = LIMIT_CONFIG[limitType];
    const percentage = currentUsage && maxLimit ? Math.round((currentUsage / maxLimit) * 100) : null;

    const handleUpgrade = () => {
        setCurrentView(AppView.SETTINGS_BILLING);
    };

    const handleDismiss = () => {
        setIsDismissed(true);
        onDismiss?.();
    };

    if (variant === 'inline') {
        return (
            <div className={`flex items-center justify-between p-3 rounded-lg bg-gradient-to-r ${config.color} bg-opacity-10 border border-current/20 ${className}`}>
                <div className="flex items-center gap-2 text-sm">
                    {config.icon}
                    <span className="font-medium">{t(config.title, 'Limit reached')}</span>
                    {percentage !== null && (
                        <span className="text-xs opacity-75">({percentage}% used)</span>
                    )}
                </div>
                <button
                    onClick={handleUpgrade}
                    className="text-sm font-medium hover:underline flex items-center gap-1"
                >
                    {t('common.upgrade', 'Upgrade')}
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
        );
    }

    if (variant === 'card') {
        return (
            <div className={`bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden ${className}`}>
                <div className={`h-1.5 bg-gradient-to-r ${config.color}`} />
                <div className="p-6">
                    <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${config.color} flex items-center justify-center text-white flex-shrink-0`}>
                            {config.icon}
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-slate-900 dark:text-white">
                                {t(config.title, 'Approaching limit')}
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                {t(config.description, 'Upgrade to unlock more.')}
                            </p>
                            {percentage !== null && (
                                <div className="mt-3">
                                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                                        <span>{currentUsage} / {maxLimit}</span>
                                        <span>{percentage}%</span>
                                    </div>
                                    <div className="w-full bg-slate-100 dark:bg-navy-800 rounded-full h-2">
                                        <div
                                            className={`h-full rounded-full bg-gradient-to-r ${config.color} transition-all`}
                                            style={{ width: `${Math.min(100, percentage)}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                            <button
                                onClick={handleUpgrade}
                                className={`mt-4 px-4 py-2 rounded-lg bg-gradient-to-r ${config.color} text-white text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2`}
                            >
                                <TrendingUp className="w-4 h-4" />
                                {t('common.upgradeNow', 'Upgrade Now')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Default: banner variant
    return (
        <div className={`relative overflow-hidden rounded-xl border border-slate-200 dark:border-white/10 ${className}`}>
            <div className={`absolute inset-0 bg-gradient-to-r ${config.color} opacity-5`} />
            <div className="relative flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${config.color} flex items-center justify-center text-white`}>
                        {config.icon}
                    </div>
                    <div>
                        <p className="font-medium text-slate-900 dark:text-white">
                            {t(config.title, 'Approaching limit')}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {t(config.description, 'Upgrade to get more.')}
                            {percentage !== null && ` (${percentage}% used)`}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleUpgrade}
                        className={`px-4 py-2 rounded-lg bg-gradient-to-r ${config.color} text-white text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2 shadow-lg`}
                    >
                        <TrendingUp className="w-4 h-4" />
                        {t('common.upgrade', 'Upgrade')}
                    </button>
                    {dismissible && (
                        <button
                            onClick={handleDismiss}
                            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                        >
                            <X className="w-4 h-4 text-slate-500" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UpgradePromptBanner;









