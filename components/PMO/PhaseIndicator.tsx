import React from 'react';
import { usePMOStore } from '../../store/usePMOStore';
import { AlertTriangle, CheckCircle2, Target } from 'lucide-react';

/**
 * PMO Phase Indicator - Shows current project phase in sidebar/header
 * GAP-01: Phase must be ALWAYS visible as the PMO "anchor"
 */

interface PhaseIndicatorProps {
    compact?: boolean;
}

export const PhaseIndicator: React.FC<PhaseIndicatorProps> = ({ compact = false }) => {
    const { currentPhase, phaseNumber, totalPhases, gateStatus, isLoading, projectName } = usePMOStore();

    // Show loading skeleton while fetching
    if (isLoading) {
        return compact ? (
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 animate-pulse">
                <div className="w-4 h-4 rounded-full bg-slate-300 dark:bg-slate-600" />
            </div>
        ) : (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 animate-pulse">
                <div className="w-4 h-4 rounded-full bg-slate-300 dark:bg-slate-600" />
                <div className="flex flex-col gap-1">
                    <div className="h-2 w-12 bg-slate-300 dark:bg-slate-600 rounded" />
                    <div className="h-3 w-16 bg-slate-300 dark:bg-slate-600 rounded" />
                </div>
            </div>
        );
    }

    // Show empty state when no project context
    if (!currentPhase) {
        return compact ? null : (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <Target size={14} className="text-slate-400" />
                <span className="text-xs text-slate-400">No project selected</span>
            </div>
        );
    }

    const phases = ['Context', 'Assessment', 'Initiatives', 'Roadmap', 'Execution', 'Stabilization'];
    const phaseIndex = phases.indexOf(currentPhase);

    const getPhaseColor = () => {
        if (gateStatus === 'NOT_READY') return 'text-amber-500 dark:text-amber-400';
        if (phaseIndex >= 4) return 'text-green-500 dark:text-green-400'; // Execution or later
        return 'text-purple-500 dark:text-purple-400';
    };

    const getBgColor = () => {
        if (gateStatus === 'NOT_READY') return 'bg-amber-500/10 dark:bg-amber-500/20 border-amber-500/30';
        if (phaseIndex >= 4) return 'bg-green-500/10 dark:bg-green-500/20 border-green-500/30';
        return 'bg-purple-500/10 dark:bg-purple-500/20 border-purple-500/30';
    };

    const getStatusIcon = () => {
        if (gateStatus === 'NOT_READY') {
            return <AlertTriangle size={14} className="text-amber-500" />;
        }
        if (phaseIndex >= 4) {
            return <CheckCircle2 size={14} className="text-green-500" />;
        }
        return <Target size={14} className="text-purple-500" />;
    };

    if (compact) {
        return (
            <div
                className={`flex items-center justify-center w-8 h-8 rounded-lg ${getBgColor()} border`}
                title={`Phase ${phaseNumber}/${totalPhases}: ${currentPhase}`}
            >
                <span className={`text-xs font-bold ${getPhaseColor()}`}>
                    {phaseNumber}
                </span>
            </div>
        );
    }

    return (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${getBgColor()} border transition-all`}>
            {getStatusIcon()}
            <div className="flex flex-col min-w-0">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-medium">
                    Phase {phaseNumber}/{totalPhases}
                </span>
                <span className={`text-sm font-semibold ${getPhaseColor()} truncate`}>
                    {currentPhase}
                </span>
            </div>
            {/* Progress dots */}
            <div className="hidden sm:flex items-center gap-0.5 ml-auto">
                {phases.map((_, i) => (
                    <div
                        key={i}
                        className={`w-1.5 h-1.5 rounded-full transition-colors ${i < phaseIndex
                            ? 'bg-green-500'
                            : i === phaseIndex
                                ? 'bg-purple-500 ring-2 ring-purple-500/30'
                                : 'bg-slate-300 dark:bg-slate-600'
                            }`}
                    />
                ))}
            </div>
        </div>
    );
};

export default PhaseIndicator;
