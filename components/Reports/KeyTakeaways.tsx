/**
 * KeyTakeaways
 * 
 * Summary box component for each major section:
 * - 3-5 bullet points in highlighted box
 * - Left border accent
 * - Lightbulb or star indicator
 * - Collapsible on mobile
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Lightbulb, 
    Star, 
    ChevronDown, 
    ChevronUp,
    TrendingUp,
    AlertTriangle,
    CheckCircle,
    Target
} from 'lucide-react';

interface Takeaway {
    text: string;
    type?: 'insight' | 'warning' | 'success' | 'action';
    metric?: string;
}

interface KeyTakeawaysProps {
    title?: string;
    takeaways: Takeaway[];
    variant?: 'default' | 'compact' | 'card';
    accentColor?: 'blue' | 'purple' | 'green' | 'amber';
    collapsible?: boolean;
    defaultExpanded?: boolean;
    className?: string;
}

const ACCENT_COLORS = {
    blue: {
        bg: 'bg-blue-50 dark:bg-blue-500/10',
        border: 'border-blue-500',
        iconBg: 'bg-blue-100 dark:bg-blue-500/20',
        iconColor: 'text-blue-600 dark:text-blue-400',
        textColor: 'text-blue-900 dark:text-blue-100'
    },
    purple: {
        bg: 'bg-purple-50 dark:bg-purple-500/10',
        border: 'border-purple-500',
        iconBg: 'bg-purple-100 dark:bg-purple-500/20',
        iconColor: 'text-purple-600 dark:text-purple-400',
        textColor: 'text-purple-900 dark:text-purple-100'
    },
    green: {
        bg: 'bg-green-50 dark:bg-green-500/10',
        border: 'border-green-500',
        iconBg: 'bg-green-100 dark:bg-green-500/20',
        iconColor: 'text-green-600 dark:text-green-400',
        textColor: 'text-green-900 dark:text-green-100'
    },
    amber: {
        bg: 'bg-amber-50 dark:bg-amber-500/10',
        border: 'border-amber-500',
        iconBg: 'bg-amber-100 dark:bg-amber-500/20',
        iconColor: 'text-amber-600 dark:text-amber-400',
        textColor: 'text-amber-900 dark:text-amber-100'
    }
};

const TAKEAWAY_ICONS = {
    insight: Lightbulb,
    warning: AlertTriangle,
    success: CheckCircle,
    action: Target
};

const TAKEAWAY_COLORS = {
    insight: 'text-blue-500',
    warning: 'text-amber-500',
    success: 'text-green-500',
    action: 'text-purple-500'
};

export const KeyTakeaways: React.FC<KeyTakeawaysProps> = ({
    title,
    takeaways,
    variant = 'default',
    accentColor = 'blue',
    collapsible = false,
    defaultExpanded = true,
    className = ''
}) => {
    const { t, i18n } = useTranslation();
    const isPolish = i18n.language === 'pl';
    
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);
    const colors = ACCENT_COLORS[accentColor];

    const defaultTitle = isPolish ? 'Kluczowe wnioski' : 'Key Takeaways';

    if (variant === 'compact') {
        return (
            <div className={`flex items-start gap-3 ${className}`}>
                <div className={`p-2 rounded-lg ${colors.iconBg}`}>
                    <Lightbulb className={`w-4 h-4 ${colors.iconColor}`} />
                </div>
                <ul className="space-y-1 text-sm">
                    {takeaways.slice(0, 3).map((takeaway, index) => (
                        <li key={index} className="flex items-start gap-2 text-slate-600 dark:text-slate-400">
                            <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                takeaway.type ? TAKEAWAY_COLORS[takeaway.type] : 'bg-slate-400'
                            }`} />
                            <span>{takeaway.text}</span>
                        </li>
                    ))}
                </ul>
            </div>
        );
    }

    if (variant === 'card') {
        return (
            <div className={`bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden ${className}`}>
                <div className={`px-4 py-3 ${colors.bg} border-b border-slate-200 dark:border-white/10`}>
                    <div className="flex items-center gap-2">
                        <Star className={`w-5 h-5 ${colors.iconColor}`} />
                        <h4 className={`font-semibold ${colors.textColor}`}>
                            {title || defaultTitle}
                        </h4>
                    </div>
                </div>
                <div className="p-4">
                    <ul className="space-y-3">
                        {takeaways.map((takeaway, index) => {
                            const Icon = takeaway.type ? TAKEAWAY_ICONS[takeaway.type] : Lightbulb;
                            const iconColor = takeaway.type ? TAKEAWAY_COLORS[takeaway.type] : colors.iconColor;

                            return (
                                <motion.li
                                    key={index}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                    className="flex items-start gap-3"
                                >
                                    <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${iconColor}`} />
                                    <div>
                                        <p className="text-sm text-navy-900 dark:text-white">
                                            {takeaway.text}
                                        </p>
                                        {takeaway.metric && (
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                                                <TrendingUp className="w-3 h-3" />
                                                {takeaway.metric}
                                            </p>
                                        )}
                                    </div>
                                </motion.li>
                            );
                        })}
                    </ul>
                </div>
            </div>
        );
    }

    // Default variant
    return (
        <div 
            className={`
                ${colors.bg} rounded-xl border-l-4 ${colors.border} overflow-hidden
                ${className}
            `}
        >
            {/* Header */}
            <div 
                className={`
                    px-4 py-3 flex items-center justify-between
                    ${collapsible ? 'cursor-pointer hover:bg-white/30 dark:hover:bg-white/5 transition-colors' : ''}
                `}
                onClick={collapsible ? () => setIsExpanded(!isExpanded) : undefined}
            >
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${colors.iconBg}`}>
                        <Lightbulb className={`w-5 h-5 ${colors.iconColor}`} />
                    </div>
                    <h4 className={`font-semibold ${colors.textColor}`}>
                        {title || defaultTitle}
                    </h4>
                    <span className="text-xs text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-white/10 px-2 py-0.5 rounded-full">
                        {takeaways.length} {isPolish ? 'punktów' : 'points'}
                    </span>
                </div>
                
                {collapsible && (
                    <button className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                )}
            </div>

            {/* Content */}
            <AnimatePresence initial={false}>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <ul className="px-4 pb-4 space-y-3">
                            {takeaways.map((takeaway, index) => {
                                const Icon = takeaway.type ? TAKEAWAY_ICONS[takeaway.type] : null;
                                const iconColor = takeaway.type ? TAKEAWAY_COLORS[takeaway.type] : '';

                                return (
                                    <motion.li
                                        key={index}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        className="flex items-start gap-3"
                                    >
                                        {Icon ? (
                                            <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${iconColor}`} />
                                        ) : (
                                            <span className="w-2 h-2 mt-2 rounded-full bg-slate-400 flex-shrink-0" />
                                        )}
                                        <div className="flex-1">
                                            <p className="text-sm text-navy-900 dark:text-white leading-relaxed">
                                                {takeaway.text}
                                            </p>
                                            {takeaway.metric && (
                                                <div className="mt-1 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                                                    <TrendingUp className="w-3 h-3" />
                                                    <span className="font-medium">{takeaway.metric}</span>
                                                </div>
                                            )}
                                        </div>
                                    </motion.li>
                                );
                            })}
                        </ul>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// Quick stats version
export const QuickStats: React.FC<{
    stats: Array<{
        label: string;
        value: string | number;
        change?: number;
        trend?: 'up' | 'down' | 'neutral';
    }>;
    className?: string;
}> = ({ stats, className = '' }) => {
    return (
        <div className={`grid grid-cols-2 sm:grid-cols-4 gap-4 ${className}`}>
            {stats.map((stat, index) => (
                <div 
                    key={index}
                    className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 p-4"
                >
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                        {stat.label}
                    </p>
                    <p className="text-2xl font-bold text-navy-900 dark:text-white">
                        {stat.value}
                    </p>
                    {stat.change !== undefined && (
                        <p className={`text-xs mt-1 flex items-center gap-1 ${
                            stat.trend === 'up' ? 'text-green-500' : 
                            stat.trend === 'down' ? 'text-red-500' : 'text-slate-500'
                        }`}>
                            {stat.trend === 'up' ? '↑' : stat.trend === 'down' ? '↓' : '→'}
                            {Math.abs(stat.change)}%
                        </p>
                    )}
                </div>
            ))}
        </div>
    );
};

export default KeyTakeaways;

