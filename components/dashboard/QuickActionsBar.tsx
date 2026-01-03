/**
 * QuickActionsBar - Pasek szybkich akcji dla Dashboard
 * Umożliwia szybki dostęp do najważniejszych funkcji PMO
 */

import React from 'react';
import { Plus, Calendar, Target, Zap, AlertTriangle, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface QuickActionsBarProps {
    onCreateTask: () => void;
    onViewCalendar?: () => void;
    onOpenInitiatives?: () => void;
    overdueCount?: number;
    urgentCount?: number;
}

export const QuickActionsBar: React.FC<QuickActionsBarProps> = ({
    onCreateTask,
    onViewCalendar,
    onOpenInitiatives,
    overdueCount = 0,
    urgentCount = 0
}) => {
    const { t } = useTranslation();
    const totalAttention = overdueCount + urgentCount;

    return (
        <div className="bg-gradient-to-r from-navy-900 via-navy-800 to-purple-900/80 dark:from-navy-950 dark:via-navy-900 dark:to-purple-950/80 rounded-xl p-4 mb-4 flex items-center justify-between shadow-lg border border-white/5">
            {/* Left Side - Status Indicators */}
            <div className="flex items-center gap-3">
                {/* Urgent Items Counter */}
                {totalAttention > 0 ? (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 border border-red-500/30 rounded-lg animate-pulse">
                        <Zap size={16} className="text-red-400" />
                        <span className="text-red-300 text-sm font-medium">
                            {totalAttention} {t('dashboard.quickActions.needAttention', 'wymaga uwagi')}
                        </span>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/30 rounded-lg">
                        <Clock size={16} className="text-emerald-400" />
                        <span className="text-emerald-300 text-sm font-medium">
                            {t('dashboard.quickActions.allClear', 'Wszystko pod kontrolą')}
                        </span>
                    </div>
                )}

                {/* Overdue Badge */}
                {overdueCount > 0 && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 border border-amber-500/30 rounded-lg">
                        <AlertTriangle size={14} className="text-amber-400" />
                        <span className="text-amber-300 text-xs font-medium">
                            {overdueCount} {t('dashboard.quickActions.overdue', 'przeterminowanych')}
                        </span>
                    </div>
                )}
            </div>
            
            {/* Right Side - Quick Actions */}
            <div className="flex items-center gap-2">
                {/* New Task Button - Primary */}
                <button
                    onClick={onCreateTask}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium text-sm transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-105"
                >
                    <Plus size={16} />
                    {t('dashboard.quickActions.newTask', 'Nowe Zadanie')}
                </button>

                {/* Calendar Button */}
                {onViewCalendar && (
                    <button
                        onClick={onViewCalendar}
                        className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all hover:scale-105"
                        title={t('dashboard.quickActions.calendar', 'Kalendarz')}
                    >
                        <Calendar size={18} />
                    </button>
                )}

                {/* Initiatives Button */}
                {onOpenInitiatives && (
                    <button
                        onClick={onOpenInitiatives}
                        className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all hover:scale-105"
                        title={t('dashboard.quickActions.initiatives', 'Inicjatywy')}
                    >
                        <Target size={18} />
                    </button>
                )}
            </div>
        </div>
    );
};

export default QuickActionsBar;






