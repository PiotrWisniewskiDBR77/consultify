import React from 'react';
import { Users, UserPlus, MessageSquare, Eye, Shield, CheckCircle2 } from 'lucide-react';
import { EmptyStateWithActions } from './EmptyStateWithActions';

/**
 * TeamEmptyState — Empty state for Team view
 * 
 * Encourages team invitation with benefits explanation.
 */

const TEAM_BENEFITS = [
    {
        icon: Eye,
        title: 'Różne perspektywy',
        description: 'Każda osoba wnosi swój punkt widzenia',
    },
    {
        icon: MessageSquare,
        title: 'Lepsze decyzje',
        description: 'Dyskusja ujawnia ślepe punkty',
    },
    {
        icon: Shield,
        title: 'Większe buy-in',
        description: 'Wspólnie wypracowane decyzje są lepiej akceptowane',
    },
];

interface TeamEmptyStateProps {
    onInvite: () => void;
    onLearnMore?: () => void;
}

export const TeamEmptyState: React.FC<TeamEmptyStateProps> = ({
    onInvite,
    onLearnMore,
}) => {
    return (
        <div className="flex flex-col items-center justify-center py-12 px-6">
            {/* Icon */}
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 flex items-center justify-center mb-6">
                <Users size={40} className="text-blue-500 dark:text-blue-400" />
            </div>

            {/* Title */}
            <h3 className="text-xl font-bold text-navy-900 dark:text-white mb-2">
                Pracujesz sam?
            </h3>

            {/* Description */}
            <p className="text-slate-500 dark:text-slate-400 max-w-md text-center mb-8 leading-relaxed">
                Niektóre decyzje wymagają wielu perspektyw. Zaproś członków zespołu,
                aby wnieśli swoje punkty widzenia.
            </p>

            {/* Benefits */}
            <div className="grid grid-cols-3 gap-4 mb-8 w-full max-w-lg">
                {TEAM_BENEFITS.map((benefit, index) => {
                    const Icon = benefit.icon;
                    return (
                        <div key={index} className="flex flex-col items-center text-center p-4 rounded-xl bg-slate-50 dark:bg-navy-900">
                            <div className="w-10 h-10 rounded-lg bg-white dark:bg-navy-800 flex items-center justify-center mb-2 shadow-sm">
                                <Icon size={20} className="text-blue-500" />
                            </div>
                            <p className="text-xs font-medium text-navy-900 dark:text-white mb-1">
                                {benefit.title}
                            </p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                {benefit.description}
                            </p>
                        </div>
                    );
                })}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
                <button
                    onClick={onInvite}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-900/20 transition-all"
                >
                    <UserPlus size={16} />
                    Zaproś do zespołu
                </button>
                {onLearnMore && (
                    <button
                        onClick={onLearnMore}
                        className="px-5 py-3 rounded-xl font-medium text-sm text-slate-600 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-900 transition-all"
                    >
                        Dowiedz się więcej
                    </button>
                )}
            </div>

            {/* Trust note */}
            <div className="flex items-center gap-2 mt-6 text-xs text-slate-400">
                <CheckCircle2 size={14} />
                <span>Każda osoba dostaje indywidualne zaproszenie z własnym dostępem</span>
            </div>
        </div>
    );
};

export default TeamEmptyState;
