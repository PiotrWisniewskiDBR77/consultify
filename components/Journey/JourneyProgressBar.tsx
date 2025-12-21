import React from 'react';
import { CheckCircle2, Circle, ChevronRight, Loader2 } from 'lucide-react';
import { useJourneyProgress, PhaseProgress } from '../../hooks/useJourneyProgress';

/**
 * JourneyProgressBar — Global progress indicator
 * 
 * Shows user's progress through phases A-F
 * with next action suggestion.
 */

const PHASE_ORDER = ['A', 'B', 'C', 'D', 'E', 'F'];

interface PhaseNodeProps {
    phase: PhaseProgress;
    isCurrent: boolean;
    isLast: boolean;
}

const PhaseNode: React.FC<PhaseNodeProps> = ({ phase, isCurrent, isLast }) => {
    const getStatusClasses = () => {
        if (phase.isActivated) {
            return {
                ring: 'bg-green-500',
                text: 'text-green-600 dark:text-green-400',
                line: 'bg-green-500',
            };
        }
        if (isCurrent) {
            return {
                ring: 'bg-purple-500 ring-4 ring-purple-200 dark:ring-purple-900/50',
                text: 'text-purple-600 dark:text-purple-400',
                line: 'bg-slate-200 dark:bg-slate-700',
            };
        }
        return {
            ring: 'bg-slate-300 dark:bg-slate-600',
            text: 'text-slate-400',
            line: 'bg-slate-200 dark:bg-slate-700',
        };
    };

    const classes = getStatusClasses();

    return (
        <div className="flex items-center">
            <div className="relative flex flex-col items-center">
                {/* Node */}
                <div
                    className={`
                        w-8 h-8 rounded-full flex items-center justify-center transition-all
                        ${classes.ring}
                    `}
                >
                    {phase.isActivated ? (
                        <CheckCircle2 size={16} className="text-white" />
                    ) : (
                        <span className="text-xs font-bold text-white">{phase.phase}</span>
                    )}
                </div>

                {/* Label */}
                <span className={`text-[10px] font-medium mt-1.5 ${classes.text}`}>
                    {phase.phaseName}
                </span>

                {/* Progress indicator for current phase */}
                {isCurrent && phase.progress > 0 && phase.progress < 100 && (
                    <div className="absolute -bottom-3 w-12 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-purple-500 rounded-full transition-all duration-500"
                            style={{ width: `${phase.progress}%` }}
                        />
                    </div>
                )}
            </div>

            {/* Connector line */}
            {!isLast && (
                <div className={`w-8 h-0.5 mx-1 ${classes.line} transition-colors`} />
            )}
        </div>
    );
};

interface JourneyProgressBarProps {
    compact?: boolean;
    showNextAction?: boolean;
    className?: string;
}

export const JourneyProgressBar: React.FC<JourneyProgressBarProps> = ({
    compact = false,
    showNextAction = true,
    className = '',
}) => {
    const { progress, isLoading, error } = useJourneyProgress();

    if (isLoading) {
        return (
            <div className={`flex items-center justify-center py-4 ${className}`}>
                <Loader2 size={20} className="animate-spin text-purple-500" />
            </div>
        );
    }

    if (error || !progress) {
        return null;
    }

    if (compact) {
        // Compact mode: just show current phase and progress
        const currentPhaseData = progress.phases[progress.currentPhase];
        return (
            <div className={`flex items-center gap-3 ${className}`}>
                <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center">
                        <span className="text-xs font-bold text-white">{progress.currentPhase}</span>
                    </div>
                    <span className="text-xs font-medium text-navy-900 dark:text-white">
                        {currentPhaseData?.phaseName}
                    </span>
                </div>
                <div className="w-20 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-purple-500 rounded-full transition-all duration-500"
                        style={{ width: `${progress.overallProgress}%` }}
                    />
                </div>
                <span className="text-xs text-slate-500">{progress.overallProgress}%</span>
            </div>
        );
    }

    return (
        <div className={`bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 ${className}`}>
            {/* Phase timeline */}
            <div className="flex items-start justify-between mb-4">
                {PHASE_ORDER.map((phaseKey, index) => (
                    <PhaseNode
                        key={phaseKey}
                        phase={progress.phases[phaseKey] || {
                            phase: phaseKey,
                            phaseName: phaseKey,
                            isCompleted: false,
                            isActivated: false,
                            completedMilestones: [],
                            totalMilestones: 0,
                            progress: 0,
                        }}
                        isCurrent={progress.currentPhase === phaseKey}
                        isLast={index === PHASE_ORDER.length - 1}
                    />
                ))}
            </div>

            {/* Next action */}
            {showNextAction && progress.nextAction && (
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-2">
                        <Circle size={8} className="text-purple-500 fill-purple-500" />
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                            Następny krok:
                        </span>
                        <span className="text-xs font-medium text-navy-900 dark:text-white">
                            {progress.nextAction.label}
                        </span>
                    </div>
                    <button className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 font-medium transition-colors">
                        Wykonaj
                        <ChevronRight size={14} />
                    </button>
                </div>
            )}
        </div>
    );
};

export default JourneyProgressBar;
