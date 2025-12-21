import React from 'react';
import { HelpCircle, Play } from 'lucide-react';
import { useTour, Tour } from './TourProvider';

/**
 * TourTrigger — Button to manually start a tour
 */

interface TourTriggerProps {
    tour: Tour;
    label?: string;
    variant?: 'button' | 'link' | 'icon';
    className?: string;
}

export const TourTrigger: React.FC<TourTriggerProps> = ({
    tour,
    label = 'Pokaż przewodnik',
    variant = 'button',
    className = '',
}) => {
    const { startTour, isTourCompleted } = useTour();
    const completed = isTourCompleted(tour.id);

    const handleClick = () => {
        startTour({ ...tour, triggerCondition: 'manual' });
    };

    if (variant === 'icon') {
        return (
            <button
                onClick={handleClick}
                className={`p-2 rounded-lg text-slate-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors ${className}`}
                title={label}
            >
                <HelpCircle size={18} />
            </button>
        );
    }

    if (variant === 'link') {
        return (
            <button
                onClick={handleClick}
                className={`flex items-center gap-1.5 text-sm text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 transition-colors ${className}`}
            >
                <Play size={14} />
                <span>{label}</span>
                {completed && (
                    <span className="text-xs text-slate-400">(ukończony)</span>
                )}
            </button>
        );
    }

    return (
        <button
            onClick={handleClick}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:hover:bg-purple-900/30 rounded-lg transition-colors ${className}`}
        >
            <Play size={16} />
            <span>{label}</span>
        </button>
    );
};

export default TourTrigger;
