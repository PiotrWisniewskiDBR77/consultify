import React from 'react';
import { UserPlus, MessageSquare, TrendingUp, Sparkles } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { AppView } from '../../types';

/**
 * TeamExpansionTrigger — Phase F Natural Expansion Prompts
 * 
 * ENTERPRISE SPEC COMPLIANCE:
 * - EPIC-F1: Natural Triggers for Expansion
 * - Shows contextual prompts when team expansion would add value
 * - Non-intrusive, value-focused messaging
 * 
 * TRIGGER CONDITIONS:
 * 1. Decision requires perspective from absent stakeholder
 * 2. Multiple viewpoints would enrich analysis
 * 3. Workload suggests delegation opportunity
 */

interface TeamExpansionTriggerProps {
    type: 'missing_perspective' | 'multiple_views' | 'delegation' | 'general';
    context?: {
        missingRole?: string;
        topicArea?: string;
        workloadType?: string;
    };
    onDismiss?: () => void;
    className?: string;
}

const TRIGGER_CONTENT = {
    missing_perspective: {
        icon: MessageSquare,
        title: 'Brakująca perspektywa',
        getMessage: (ctx?: { missingRole?: string }) =>
            ctx?.missingRole
                ? `Ta decyzja mogłaby skorzystać z perspektywy ${ctx.missingRole}.`
                : 'Ta decyzja mogłaby skorzystać z innych perspektyw.',
        actionLabel: 'Zaproś członka zespołu',
    },
    multiple_views: {
        icon: TrendingUp,
        title: 'Wieloperspektywiczność',
        getMessage: (ctx?: { topicArea?: string }) =>
            ctx?.topicArea
                ? `Analiza ${ctx.topicArea} byłaby bogatsza z wieloma punktami widzenia.`
                : 'Analiza byłaby bogatsza z wieloma punktami widzenia.',
        actionLabel: 'Rozszerz zespół',
    },
    delegation: {
        icon: UserPlus,
        title: 'Możliwość delegacji',
        getMessage: (ctx?: { workloadType?: string }) =>
            ctx?.workloadType
                ? `Część pracy nad ${ctx.workloadType} można przekazać współpracownikom.`
                : 'Część pracy można przekazać współpracownikom.',
        actionLabel: 'Zaproś do projektu',
    },
    general: {
        icon: Sparkles,
        title: 'Rozważ rozszerzenie zespołu',
        getMessage: (_ctx?: { missingRole?: string; topicArea?: string; workloadType?: string }) =>
            'System przynosi największą wartość, gdy pracuje z nim cały zespół decyzyjny.',
        actionLabel: 'Zaproś kogoś',
    },
};

export const TeamExpansionTrigger: React.FC<TeamExpansionTriggerProps> = ({
    type,
    context,
    onDismiss,
    className = '',
}) => {
    const { setCurrentView } = useAppStore();

    const content = TRIGGER_CONTENT[type];
    const Icon = content.icon;
    const message = content.getMessage(context);

    const handleInvite = () => {
        setCurrentView(AppView.CONSULTANT_INVITES);
    };

    return (
        <div className={`
            bg-gradient-to-r from-purple-50 to-blue-50 
            dark:from-purple-900/20 dark:to-blue-900/20
            border border-purple-200 dark:border-purple-500/30
            rounded-xl p-4
            ${className}
        `}>
            <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                    <Icon className="text-purple-600 dark:text-purple-400" size={20} />
                </div>

                <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-navy-900 dark:text-white text-sm mb-1">
                        {content.title}
                    </h4>
                    <p className="text-slate-600 dark:text-slate-400 text-sm mb-3">
                        {message}
                    </p>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleInvite}
                            className="
                                inline-flex items-center gap-2 
                                px-3 py-1.5 rounded-lg 
                                bg-purple-600 hover:bg-purple-500 
                                text-white text-sm font-medium
                                transition-colors
                            "
                        >
                            <UserPlus size={14} />
                            {content.actionLabel}
                        </button>

                        {onDismiss && (
                            <button
                                onClick={onDismiss}
                                className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                            >
                                Później
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

/**
 * TeamExpansionBanner — Persistent but dismissible banner for Phase F
 */
export const TeamExpansionBanner: React.FC<{
    memberCount?: number;
    onDismiss?: () => void;
}> = ({ memberCount = 1, onDismiss }) => {
    const { setCurrentView } = useAppStore();

    if (memberCount >= 3) return null; // Don't show if team is already growing

    return (
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <UserPlus size={18} />
                <span className="text-sm font-medium">
                    {memberCount === 1
                        ? 'Pracujesz sam. System daje największą wartość z zespołem.'
                        : 'Rozważ dodanie kluczowych decydentów do organizacji.'
                    }
                </span>
            </div>

            <div className="flex items-center gap-2">
                <button
                    onClick={() => setCurrentView(AppView.CONSULTANT_INVITES)}
                    className="px-3 py-1 rounded bg-white/20 hover:bg-white/30 text-sm font-medium transition-colors"
                >
                    Zaproś
                </button>
                {onDismiss && (
                    <button
                        onClick={onDismiss}
                        className="px-2 py-1 hover:bg-white/10 rounded transition-colors text-white/70 hover:text-white"
                    >
                        ×
                    </button>
                )}
            </div>
        </div>
    );
};

export default TeamExpansionTrigger;
