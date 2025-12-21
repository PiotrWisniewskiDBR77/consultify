import React from 'react';

interface ConfidenceBadgeProps {
    confidence: number; // 0-1
    showLabel?: boolean;
    size?: 'sm' | 'md' | 'lg';
}

/**
 * ConfidenceBadge Component
 * 
 * Displays AI confidence score with color coding:
 * - Red: < 0.4 (Low confidence)
 * - Amber: 0.4 - 0.7 (Medium confidence)
 * - Green: > 0.7 (High confidence)
 */
const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({
    confidence,
    showLabel = true,
    size = 'md'
}) => {
    // Normalize confidence to 0-1 range
    const normalizedConfidence = Math.max(0, Math.min(1, confidence));
    const percentage = Math.round(normalizedConfidence * 100);

    // Determine color based on confidence level
    const getColorClasses = () => {
        if (normalizedConfidence < 0.4) {
            return {
                bg: 'bg-red-100 dark:bg-red-900/30',
                text: 'text-red-700 dark:text-red-400',
                ring: 'ring-red-600/20 dark:ring-red-500/30',
                dot: 'bg-red-500'
            };
        } else if (normalizedConfidence <= 0.7) {
            return {
                bg: 'bg-amber-100 dark:bg-amber-900/30',
                text: 'text-amber-700 dark:text-amber-400',
                ring: 'ring-amber-600/20 dark:ring-amber-500/30',
                dot: 'bg-amber-500'
            };
        } else {
            return {
                bg: 'bg-green-100 dark:bg-green-900/30',
                text: 'text-green-700 dark:text-green-400',
                ring: 'ring-green-600/20 dark:ring-green-500/30',
                dot: 'bg-green-500'
            };
        }
    };

    const getConfidenceLabel = () => {
        if (normalizedConfidence < 0.4) return 'Low';
        if (normalizedConfidence <= 0.7) return 'Medium';
        return 'High';
    };

    const sizeClasses = {
        sm: 'text-xs px-2 py-0.5',
        md: 'text-sm px-2.5 py-1',
        lg: 'text-base px-3 py-1.5'
    };

    const dotSizes = {
        sm: 'w-1.5 h-1.5',
        md: 'w-2 h-2',
        lg: 'w-2.5 h-2.5'
    };

    const colors = getColorClasses();
    const label = getConfidenceLabel();

    const tooltipText = "Confidence score based on evidence consistency and reasoning strength. This is not a prediction accuracy metric.";

    return (
        <div className="relative group inline-flex">
            <span
                className={`
                    inline-flex items-center gap-1.5 font-medium rounded-full ring-1 ring-inset
                    ${colors.bg} ${colors.text} ${colors.ring} ${sizeClasses[size]}
                    cursor-help transition-all duration-200
                `}
            >
                <span className={`${dotSizes[size]} rounded-full ${colors.dot}`} />
                {showLabel && <span>{label}</span>}
                <span className="font-semibold">{percentage}%</span>
            </span>

            {/* Tooltip */}
            <div className="
                absolute bottom-full left-1/2 -translate-x-1/2 mb-2
                px-3 py-2 text-xs text-white bg-gray-900 dark:bg-gray-700 
                rounded-lg shadow-lg
                opacity-0 invisible group-hover:opacity-100 group-hover:visible
                transition-all duration-200 z-50
                w-64 text-center
                pointer-events-none
            ">
                {tooltipText}
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
                    <div className="border-4 border-transparent border-t-gray-900 dark:border-t-gray-700" />
                </div>
            </div>
        </div>
    );
};

export default ConfidenceBadge;
