/**
 * PMO Priority Badge - Strategic priority visualization
 * Part of My Work Module PMO Upgrade
 */

import React from 'react';
import { 
    AlertCircle, 
    AlertTriangle, 
    Clock, 
    Target, 
    CheckCircle,
    Zap,
    FileQuestion
} from 'lucide-react';
import type { PMOCategory, PMOCategoryConfig } from '../../../types/myWork';

interface PMOPriorityBadgeProps {
    category: PMOCategory;
    size?: 'sm' | 'md' | 'lg';
    showLabel?: boolean;
    showIcon?: boolean;
    className?: string;
}

/**
 * PMO Category configurations with colors and labels
 */
export const PMO_CATEGORY_CONFIG: Record<PMOCategory, PMOCategoryConfig> = {
    blocking_phase: {
        key: 'blocking_phase',
        label: 'Blokujące Fazę',
        emoji: '🔴',
        color: {
            border: 'border-red-500',
            bg: 'bg-red-100 dark:bg-red-900/30',
            text: 'text-red-700 dark:text-red-300',
            icon: 'text-red-500'
        },
        priority: 1
    },
    blocking_initiative: {
        key: 'blocking_initiative',
        label: 'Blokujące Inicjatywę',
        emoji: '🟠',
        color: {
            border: 'border-orange-500',
            bg: 'bg-orange-100 dark:bg-orange-900/30',
            text: 'text-orange-700 dark:text-orange-300',
            icon: 'text-orange-500'
        },
        priority: 2
    },
    decision_required: {
        key: 'decision_required',
        label: 'Oczekuje Decyzji',
        emoji: '🟡',
        color: {
            border: 'border-amber-500',
            bg: 'bg-amber-100 dark:bg-amber-900/30',
            text: 'text-amber-700 dark:text-amber-300',
            icon: 'text-amber-500'
        },
        priority: 3
    },
    deadline_critical: {
        key: 'deadline_critical',
        label: 'Termin Krytyczny',
        emoji: '⚫',
        color: {
            border: 'border-slate-700',
            bg: 'bg-slate-100 dark:bg-slate-800',
            text: 'text-slate-700 dark:text-slate-300',
            icon: 'text-slate-700 dark:text-slate-300'
        },
        priority: 4
    },
    high_strategic: {
        key: 'high_strategic',
        label: 'Wysoki Priorytet Strategiczny',
        emoji: '🔵',
        color: {
            border: 'border-blue-500',
            bg: 'bg-blue-100 dark:bg-blue-900/30',
            text: 'text-blue-700 dark:text-blue-300',
            icon: 'text-blue-500'
        },
        priority: 5
    },
    routine: {
        key: 'routine',
        label: 'Standardowe',
        emoji: '⚪',
        color: {
            border: 'border-green-500',
            bg: 'bg-green-100 dark:bg-green-900/30',
            text: 'text-green-700 dark:text-green-300',
            icon: 'text-green-500'
        },
        priority: 6
    }
};

/**
 * Get icon component for PMO category
 */
const getCategoryIcon = (category: PMOCategory, size: number) => {
    const iconProps = { size, className: 'shrink-0' };
    
    switch (category) {
        case 'blocking_phase':
            return <AlertCircle {...iconProps} />;
        case 'blocking_initiative':
            return <AlertTriangle {...iconProps} />;
        case 'decision_required':
            return <FileQuestion {...iconProps} />;
        case 'deadline_critical':
            return <Clock {...iconProps} />;
        case 'high_strategic':
            return <Target {...iconProps} />;
        case 'routine':
            return <CheckCircle {...iconProps} />;
        default:
            return <Zap {...iconProps} />;
    }
};

/**
 * PMOPriorityBadge Component
 * 
 * Displays a badge indicating the PMO priority category of a task.
 * Used throughout the My Work module to provide consistent priority visualization.
 */
export const PMOPriorityBadge: React.FC<PMOPriorityBadgeProps> = ({
    category,
    size = 'sm',
    showLabel = true,
    showIcon = true,
    className = ''
}) => {
    const config = PMO_CATEGORY_CONFIG[category];
    
    if (!config) {
        return null;
    }

    const sizeClasses = {
        sm: 'text-[10px] px-1.5 py-0.5 gap-1',
        md: 'text-xs px-2 py-1 gap-1.5',
        lg: 'text-sm px-3 py-1.5 gap-2'
    };

    const iconSizes = {
        sm: 10,
        md: 12,
        lg: 14
    };

    return (
        <span
            className={`
                inline-flex items-center font-medium rounded-md border
                ${config.color.bg} 
                ${config.color.text} 
                ${config.color.border}
                ${sizeClasses[size]}
                ${className}
            `}
            title={config.label}
        >
            {showIcon && (
                <span className={config.color.icon}>
                    {getCategoryIcon(category, iconSizes[size])}
                </span>
            )}
            {showLabel && (
                <span className="truncate max-w-[120px]">
                    {config.label}
                </span>
            )}
            {!showLabel && !showIcon && (
                <span>{config.emoji}</span>
            )}
        </span>
    );
};

/**
 * Compact dot indicator for category
 */
export const PMOCategoryDot: React.FC<{ category: PMOCategory; className?: string }> = ({ 
    category, 
    className = '' 
}) => {
    const config = PMO_CATEGORY_CONFIG[category];
    
    if (!config) return null;

    return (
        <span 
            className={`w-2 h-2 rounded-full ${config.color.bg} ${config.color.border} border ${className}`}
            title={config.label}
        />
    );
};

/**
 * Helper function to determine PMO category from task data
 */
export const getPMOCategory = (task: {
    isBlockingPhase?: boolean;
    isBlockingInitiative?: boolean;
    awaitingDecision?: boolean;
    dueDate?: string | Date;
    priority?: string;
    labels?: Array<{ code: string }>;
}): PMOCategory => {
    // Check for explicit blocking flags
    if (task.isBlockingPhase) return 'blocking_phase';
    if (task.isBlockingInitiative) return 'blocking_initiative';
    if (task.awaitingDecision) return 'decision_required';

    // Check labels
    const labelCodes = task.labels?.map(l => l.code) || [];
    if (labelCodes.includes('BLOCKING_PHASE') || labelCodes.includes('GATE_BLOCKER')) {
        return 'blocking_phase';
    }
    if (labelCodes.includes('BLOCKING_INITIATIVE') || labelCodes.includes('BLOCKING_PROGRESS')) {
        return 'blocking_initiative';
    }
    if (labelCodes.includes('AWAITING_DECISION') || labelCodes.includes('DECISION_REQUIRED')) {
        return 'decision_required';
    }

    // Check deadline criticality (within 48 hours)
    if (task.dueDate) {
        const due = new Date(task.dueDate);
        const now = new Date();
        const hoursUntilDue = (due.getTime() - now.getTime()) / (1000 * 60 * 60);
        if (hoursUntilDue > 0 && hoursUntilDue <= 48) {
            return 'deadline_critical';
        }
    }

    // Check priority
    if (task.priority?.toLowerCase() === 'urgent' || task.priority?.toLowerCase() === 'high') {
        return 'high_strategic';
    }

    return 'routine';
};

export default PMOPriorityBadge;



