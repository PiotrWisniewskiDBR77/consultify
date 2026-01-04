/**
 * Proactive Suggestions Component
 *
 * Displays AI-generated proactive suggestions based on:
 * - Current context
 * - User patterns
 * - Project state
 *
 * Part of UX Excellence - Phase 4.3
 */

import {
    AlertTriangle,
    ArrowRight,
    ChevronDown,
    ChevronUp,
    HelpCircle,
    Lightbulb,
    Sparkles,
    TrendingUp,
    X,
    Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { cn } from '../../utils/cn';

interface Suggestion {
    id: string;
    type: 'quick_action' | 'did_you_mean' | 'next_step' | 'insight' | 'warning' | 'optimization' | 'learning';
    title: string;
    description: string;
    action: {
        type: 'navigate' | 'ai_query' | 'continue_assessment' | 'custom';
        target?: string;
        prompt?: string;
    };
    priority: number;
    trigger?: string;
}

interface ProactiveSuggestionsProps {
    projectId?: string;
    organizationId?: string;
    screenContext?: {
        screenId: string;
        data?: any;
    };
    onSuggestionClick: (suggestion: Suggestion) => void;
    onQuerySuggestion?: (prompt: string) => void;
    className?: string;
    compact?: boolean;
    maxSuggestions?: number;
}

const SUGGESTION_ICONS: Record<string, React.FC<{ size?: number; className?: string }>> = {
    quick_action: Zap,
    did_you_mean: HelpCircle,
    next_step: ArrowRight,
    insight: Lightbulb,
    warning: AlertTriangle,
    optimization: TrendingUp,
    learning: Sparkles,
};

const SUGGESTION_COLORS: Record<string, { bg: string; border: string; text: string; icon: string }> = {
    quick_action: {
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        border: 'border-blue-200 dark:border-blue-800',
        text: 'text-blue-800 dark:text-blue-200',
        icon: 'text-blue-600 dark:text-blue-400',
    },
    did_you_mean: {
        bg: 'bg-purple-50 dark:bg-purple-900/20',
        border: 'border-purple-200 dark:border-purple-800',
        text: 'text-purple-800 dark:text-purple-200',
        icon: 'text-purple-600 dark:text-purple-400',
    },
    next_step: {
        bg: 'bg-green-50 dark:bg-green-900/20',
        border: 'border-green-200 dark:border-green-800',
        text: 'text-green-800 dark:text-green-200',
        icon: 'text-green-600 dark:text-green-400',
    },
    insight: {
        bg: 'bg-amber-50 dark:bg-amber-900/20',
        border: 'border-amber-200 dark:border-amber-800',
        text: 'text-amber-800 dark:text-amber-200',
        icon: 'text-amber-600 dark:text-amber-400',
    },
    warning: {
        bg: 'bg-red-50 dark:bg-red-900/20',
        border: 'border-red-200 dark:border-red-800',
        text: 'text-red-800 dark:text-red-200',
        icon: 'text-red-600 dark:text-red-400',
    },
    optimization: {
        bg: 'bg-cyan-50 dark:bg-cyan-900/20',
        border: 'border-cyan-200 dark:border-cyan-800',
        text: 'text-cyan-800 dark:text-cyan-200',
        icon: 'text-cyan-600 dark:text-cyan-400',
    },
    learning: {
        bg: 'bg-indigo-50 dark:bg-indigo-900/20',
        border: 'border-indigo-200 dark:border-indigo-800',
        text: 'text-indigo-800 dark:text-indigo-200',
        icon: 'text-indigo-600 dark:text-indigo-400',
    },
};

export const ProactiveSuggestions: React.FC<ProactiveSuggestionsProps> = ({
    projectId,
    organizationId,
    screenContext,
    onSuggestionClick,
    onQuerySuggestion,
    className = '',
    compact = false,
    maxSuggestions = 3,
}) => {
    const { t } = useTranslation();
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(!compact);
    const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

    // Fetch suggestions
    const fetchSuggestions = useCallback(async () => {
        try {
            setLoading(true);
            const response = await Api.getProactiveSuggestions({
                projectId,
                organizationId,
                screenContext,
            });
            setSuggestions(response.suggestions || []);
        } catch (error) {
            console.error('[ProactiveSuggestions] Failed to fetch:', error);
            setSuggestions([]);
        } finally {
            setLoading(false);
        }
    }, [projectId, organizationId, screenContext]);

    useEffect(() => {
        fetchSuggestions();
        // Refresh suggestions periodically
        const interval = setInterval(fetchSuggestions, 60000);
        return () => clearInterval(interval);
    }, [fetchSuggestions]);

    const handleSuggestionClick = useCallback(
        async (suggestion: Suggestion) => {
            // Record acceptance
            try {
                await Api.recordSuggestionAction(suggestion.id, 'accepted');
            } catch (error) {
                console.error('[ProactiveSuggestions] Failed to record action:', error);
            }

            // Handle different action types
            if (suggestion.action.type === 'ai_query' && suggestion.action.prompt && onQuerySuggestion) {
                onQuerySuggestion(suggestion.action.prompt);
            } else {
                onSuggestionClick(suggestion);
            }
        },
        [onSuggestionClick, onQuerySuggestion],
    );

    const handleDismiss = useCallback(async (suggestion: Suggestion, e: React.MouseEvent) => {
        e.stopPropagation();
        setDismissedIds((prev) => new Set([...prev, suggestion.id]));

        try {
            await Api.recordSuggestionAction(suggestion.id, 'dismissed');
        } catch (error) {
            console.error('[ProactiveSuggestions] Failed to record dismissal:', error);
        }
    }, []);

    // Filter out dismissed suggestions
    const visibleSuggestions = suggestions.filter((s) => !dismissedIds.has(s.id)).slice(0, maxSuggestions);

    if (loading && suggestions.length === 0) {
        return (
            <div className={cn('animate-pulse space-y-2 p-3', className)}>
                <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-12 w-full bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
        );
    }

    if (visibleSuggestions.length === 0) {
        return null;
    }

    return (
        <div className={cn('', className)}>
            {/* Header */}
            <div
                className="flex items-center justify-between px-3 py-2 cursor-pointer"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-primary-500" />
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                        {t('suggestions.title', 'Suggestions for you')}
                    </span>
                    {!expanded && <span className="text-xs text-gray-400">({visibleSuggestions.length})</span>}
                </div>
                <button
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    aria-label={expanded ? t('common.collapse', 'Collapse') : t('common.expand', 'Expand')}
                >
                    {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
            </div>

            {/* Suggestions list */}
            {expanded && (
                <div className="px-3 pb-3 space-y-2">
                    {visibleSuggestions.map((suggestion) => {
                        const Icon = SUGGESTION_ICONS[suggestion.type] || Lightbulb;
                        const colors = SUGGESTION_COLORS[suggestion.type] || SUGGESTION_COLORS.insight;

                        return (
                            <div
                                key={suggestion.id}
                                className={cn(
                                    'group relative rounded-lg border cursor-pointer transition-all duration-200',
                                    'hover:shadow-sm hover:scale-[1.01]',
                                    colors.bg,
                                    colors.border,
                                )}
                                onClick={() => handleSuggestionClick(suggestion)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        handleSuggestionClick(suggestion);
                                    }
                                }}
                            >
                                <div className="p-3 pr-8">
                                    <div className="flex items-start gap-2">
                                        <Icon size={16} className={cn('shrink-0 mt-0.5', colors.icon)} />
                                        <div className="min-w-0">
                                            <h4 className={cn('text-sm font-medium', colors.text)}>
                                                {suggestion.title}
                                            </h4>
                                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-2">
                                                {suggestion.description}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Dismiss button */}
                                <button
                                    onClick={(e) => handleDismiss(suggestion, e)}
                                    className={cn(
                                        'absolute top-2 right-2 p-1 rounded-full',
                                        'opacity-0 group-hover:opacity-100 transition-opacity',
                                        'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300',
                                        'hover:bg-white/50 dark:hover:bg-black/20',
                                    )}
                                    aria-label={t('common.dismiss', 'Dismiss')}
                                >
                                    <X size={12} />
                                </button>

                                {/* Action indicator */}
                                <div
                                    className={cn(
                                        'absolute bottom-2 right-2',
                                        'opacity-0 group-hover:opacity-100 transition-opacity',
                                        colors.icon,
                                    )}
                                >
                                    <ArrowRight size={14} />
                                </div>
                            </div>
                        );
                    })}

                    {/* Show more link if there are hidden suggestions */}
                    {suggestions.length > maxSuggestions && (
                        <button
                            className="w-full text-center text-xs text-primary-600 dark:text-primary-400 hover:underline py-1"
                            onClick={() => {
                                // Could open a modal with all suggestions
                            }}
                        >
                            {t('suggestions.showMore', 'Show {{count}} more suggestions', {
                                count: suggestions.length - maxSuggestions,
                            })}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default ProactiveSuggestions;

