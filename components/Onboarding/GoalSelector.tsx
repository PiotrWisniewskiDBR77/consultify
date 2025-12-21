import React, { useState, useEffect } from 'react';
import { Target, Users, Presentation, Compass, ChevronRight, CheckCircle2, Clock } from 'lucide-react';
import { Api } from '../../services/api';
import { useTour } from './TourProvider';
import { FIRST_VALUE_TOUR } from '../../config/tours/firstValueTour';
import { TEAM_TOUR } from '../../config/tours/teamTour';

/**
 * GoalSelector — Phase E Entry
 * 
 * Allows user to select their primary goal.
 * Personalizes the onboarding experience based on selection.
 */

export interface UserGoal {
    id: string;
    title: string;
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
        title: 'Zrozumieć kluczową decyzję',
        description: 'Mam konkretną decyzję strategiczną do przeanalizowania i chcę ją ustrukturyzować.',
        icon: Target,
        suggestedActions: ['create_axis', 'add_position', 'generate_snapshot'],
        tourId: 'first_value',
        estimatedTime: '30-45 min',
        color: 'purple',
    },
    {
        id: 'team_alignment',
        title: 'Ustrukturyzować wiedzę zespołu',
        description: 'Chcę zebrać różne perspektywy mojego zespołu w jednym miejscu i wykryć rozbieżności.',
        icon: Users,
        suggestedActions: ['create_axis', 'invite_team', 'multi_perspective'],
        tourId: 'team_expansion',
        estimatedTime: '1-2 godz',
        color: 'blue',
    },
    {
        id: 'executive_prep',
        title: 'Przygotować materiał dla zarządu',
        description: 'Potrzebuję ustrukturyzowanej analizy do prezentacji decydentom.',
        icon: Presentation,
        suggestedActions: ['create_axis', 'document_positions', 'generate_report'],
        estimatedTime: '2-3 godz',
        color: 'emerald',
    },
    {
        id: 'explore',
        title: 'Eksploruję możliwości',
        description: 'Chcę zobaczyć jak system może pomóc mojej organizacji bez konkretnego celu.',
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
    const [selectedGoalId, setSelectedGoalId] = useState<string | null>(initialGoalId || null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { startTour } = useTour();

    const handleSelect = (goal: UserGoal) => {
        setSelectedGoalId(goal.id);
    };

    const handleConfirm = async () => {
        if (!selectedGoalId) return;

        const goal = USER_GOALS.find(g => g.id === selectedGoalId);
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
            } catch { /* ignore */ }

            // Trigger appropriate tour
            if (goal.tourId === 'first_value') {
                startTour(FIRST_VALUE_TOUR);
            } else if (goal.tourId === 'team_expansion') {
                startTour(TEAM_TOUR);
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
        const exploreGoal = USER_GOALS.find(g => g.id === 'explore')!;
        onGoalSelected(exploreGoal);
    };

    const colorClasses: Record<string, { bg: string; border: string; text: string }> = {
        purple: {
            bg: 'bg-purple-50 dark:bg-purple-900/20',
            border: 'border-purple-500',
            text: 'text-purple-600 dark:text-purple-400',
        },
        blue: {
            bg: 'bg-blue-50 dark:bg-blue-900/20',
            border: 'border-blue-500',
            text: 'text-blue-600 dark:text-blue-400',
        },
        emerald: {
            bg: 'bg-emerald-50 dark:bg-emerald-900/20',
            border: 'border-emerald-500',
            text: 'text-emerald-600 dark:text-emerald-400',
        },
        amber: {
            bg: 'bg-amber-50 dark:bg-amber-900/20',
            border: 'border-amber-500',
            text: 'text-amber-600 dark:text-amber-400',
        },
    };

    return (
        <div className="max-w-3xl mx-auto p-8">
            {/* Header */}
            <div className="text-center mb-10">
                <h1 className="text-2xl font-bold text-navy-900 dark:text-white mb-3">
                    Co chcesz dziś osiągnąć?
                </h1>
                <p className="text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
                    Twój wybór pomoże nam dostosować doświadczenie i zaproponować
                    najlepsze następne kroki.
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
                                ${isSelected
                                    ? `${colors.bg} ${colors.border} shadow-lg`
                                    : 'bg-white dark:bg-navy-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
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
                            <div className={`
                                w-12 h-12 rounded-xl flex items-center justify-center mb-4
                                ${isSelected ? colors.bg : 'bg-slate-100 dark:bg-navy-900'}
                            `}>
                                <Icon
                                    size={24}
                                    className={isSelected ? colors.text : 'text-slate-400 dark:text-slate-500'}
                                />
                            </div>

                            {/* Content */}
                            <h3 className={`
                                font-semibold mb-2
                                ${isSelected ? 'text-navy-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}
                            `}>
                                {goal.title}
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                                {goal.description}
                            </p>

                            {/* Time estimate */}
                            <div className="flex items-center gap-1.5 text-xs text-slate-400">
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
                        className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                    >
                        Pomiń na razie
                    </button>
                )}
                <div className="flex-1" />
                <button
                    onClick={handleConfirm}
                    disabled={!selectedGoalId || isSubmitting}
                    className={`
                        flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all
                        ${selectedGoalId
                            ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-900/20'
                            : 'bg-slate-100 dark:bg-navy-900 text-slate-400 cursor-not-allowed'
                        }
                    `}
                >
                    {isSubmitting ? 'Zapisuję...' : 'Kontynuuj'}
                    <ChevronRight size={16} />
                </button>
            </div>
        </div>
    );
};

export default GoalSelector;
