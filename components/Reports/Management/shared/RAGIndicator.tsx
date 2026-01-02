/**
 * RAG Indicator Component
 * Red/Amber/Green traffic light status indicator
 * PRINCE2 Standard: Progress Theme
 */

import React from 'react';
import { RAGStatus } from '../../../../types';

interface RAGIndicatorProps {
    status: RAGStatus;
    size?: 'sm' | 'md' | 'lg';
    showLabel?: boolean;
    className?: string;
}

const statusConfig = {
    GREEN: {
        bg: 'bg-emerald-500',
        text: 'text-emerald-500',
        label: 'On Track',
        ring: 'ring-emerald-500/30'
    },
    AMBER: {
        bg: 'bg-amber-500',
        text: 'text-amber-500',
        label: 'At Risk',
        ring: 'ring-amber-500/30'
    },
    RED: {
        bg: 'bg-red-500',
        text: 'text-red-500',
        label: 'Off Track',
        ring: 'ring-red-500/30'
    },
    GREY: {
        bg: 'bg-slate-400',
        text: 'text-slate-400',
        label: 'Not Started',
        ring: 'ring-slate-400/30'
    }
};

const sizeConfig = {
    sm: { dot: 'w-2 h-2', text: 'text-xs', pill: 'px-2 py-0.5' },
    md: { dot: 'w-3 h-3', text: 'text-sm', pill: 'px-3 py-1' },
    lg: { dot: 'w-4 h-4', text: 'text-base', pill: 'px-4 py-1.5' }
};

export const RAGIndicator: React.FC<RAGIndicatorProps> = ({
    status,
    size = 'md',
    showLabel = false,
    className = ''
}) => {
    const config = statusConfig[status] || statusConfig.GREY;
    const sizes = sizeConfig[size];

    if (showLabel) {
        return (
            <span className={`inline-flex items-center gap-2 ${sizes.pill} rounded-full ${config.bg} bg-opacity-10 ${config.text} ${className}`}>
                <span className={`${sizes.dot} rounded-full ${config.bg}`} />
                <span className={`font-medium ${sizes.text}`}>{config.label}</span>
            </span>
        );
    }

    return (
        <span 
            className={`inline-block ${sizes.dot} rounded-full ${config.bg} ring-4 ${config.ring} ${className}`}
            title={config.label}
        />
    );
};

/**
 * RAG Status Grid - 4 indicators in a row
 */
interface RAGStatusGridProps {
    schedule: RAGStatus;
    budget: RAGStatus;
    scope: RAGStatus;
    risk: RAGStatus;
    className?: string;
}

export const RAGStatusGrid: React.FC<RAGStatusGridProps> = ({
    schedule,
    budget,
    scope,
    risk,
    className = ''
}) => {
    const items = [
        { label: 'Schedule', status: schedule },
        { label: 'Budget', status: budget },
        { label: 'Scope', status: scope },
        { label: 'Risk', status: risk }
    ];

    return (
        <div className={`grid grid-cols-4 gap-4 ${className}`}>
            {items.map(item => (
                <div 
                    key={item.label}
                    className="flex flex-col items-center p-4 bg-slate-50 dark:bg-navy-800/50 rounded-xl"
                >
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
                        {item.label}
                    </span>
                    <RAGIndicator status={item.status} size="lg" />
                    <span className={`mt-2 text-sm font-semibold ${statusConfig[item.status]?.text || 'text-slate-400'}`}>
                        {statusConfig[item.status]?.label || 'N/A'}
                    </span>
                </div>
            ))}
        </div>
    );
};

export default RAGIndicator;



