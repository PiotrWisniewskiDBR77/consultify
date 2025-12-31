/**
 * SmartSuggestions
 * 
 * Displays context-aware suggestions based on user's PMO state.
 * Supports two variants:
 * - 'full': Rich suggestions with icons, colors, and dismiss buttons
 * - 'minimal': 3 short, subtle text prompts for welcome screen
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
    Sparkles, 
    ChevronRight, 
    Target, 
    Lightbulb, 
    Map,
    Clock,
    MessageSquare,
    X
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { AppView } from '../../types';

interface Suggestion {
    id: string;
    type: 'continue' | 'action' | 'insight' | 'followup' | 'expand';
    text: string;
    priority: number;
    context: string[];
    action?: {
        type: 'navigate' | 'chat' | 'execute';
        view?: string;
        prompt?: string;
        data?: Record<string, unknown>;
    };
}

interface SmartSuggestionsProps {
    projectId?: string;
    onSuggestionClick: (suggestion: Suggestion) => void;
    className?: string;
    variant?: 'full' | 'minimal';
}

const SUGGESTION_ICONS: Record<string, React.ElementType> = {
    continue: Clock,
    action: Target,
    insight: Lightbulb,
    followup: MessageSquare,
    expand: Map
};

const SUGGESTION_COLORS: Record<string, string> = {
    continue: 'from-blue-500/10 to-blue-600/5 border-blue-200/50 dark:border-blue-800/50',
    action: 'from-primary-500/10 to-primary-600/5 border-primary-200/50 dark:border-primary-800/50',
    insight: 'from-amber-500/10 to-amber-600/5 border-amber-200/50 dark:border-amber-800/50',
    followup: 'from-green-500/10 to-green-600/5 border-green-200/50 dark:border-green-800/50',
    expand: 'from-purple-500/10 to-purple-600/5 border-purple-200/50 dark:border-purple-800/50'
};

// Minimal static suggestions for welcome screen
const MINIMAL_SUGGESTIONS = [
    { id: 'brief', text: 'Dzienny brief', prompt: '__DAILY_BRIEF__' },
    { id: 'week', text: 'Zaplanuj tydzień', prompt: 'Pomóż mi zaplanować priorytety na najbliższy tydzień' },
    { id: 'risks', text: 'Przeanalizuj ryzyka', prompt: 'Przeanalizuj główne ryzyka w moich inicjatywach' }
];

export const SmartSuggestions: React.FC<SmartSuggestionsProps> = ({
    projectId,
    onSuggestionClick,
    className = '',
    variant = 'full'
}) => {
    const { t } = useTranslation();
    const { setCurrentView } = useAppStore();
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [dismissed, setDismissed] = useState<Set<string>>(new Set());

    // Fetch suggestions on mount and when projectId changes (only for full variant)
    useEffect(() => {
        if (variant === 'full') {
            fetchSuggestions();
        }
    }, [projectId, variant]);

    const fetchSuggestions = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/ai/suggestions${projectId ? `?projectId=${projectId}` : ''}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                setSuggestions(data.suggestions || []);
            }
        } catch (err) {
            console.error('[SmartSuggestions] Fetch error:', err);
            setSuggestions([
                {
                    id: 'start-assessment',
                    type: 'action',
                    text: t('aiChat.suggestions.startAssessment', 'Start your digital maturity assessment'),
                    priority: 95,
                    context: ['fallback'],
                    action: { type: 'navigate', view: 'ASSESSMENT_OVERVIEW' }
                }
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClick = (suggestion: Suggestion) => {
        if (suggestion.action?.type === 'navigate' && suggestion.action.view) {
            setCurrentView(suggestion.action.view as AppView);
        } else {
            onSuggestionClick(suggestion);
        }
    };

    const handleMinimalClick = (prompt: string) => {
        onSuggestionClick({
            id: 'minimal',
            type: 'action',
            text: prompt,
            priority: 100,
            context: ['minimal'],
            action: { type: 'chat', prompt }
        });
    };

    const handleDismiss = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setDismissed(prev => new Set(prev).add(id));
    };

    // Minimal variant - 3 subtle text suggestions
    if (variant === 'minimal') {
        return (
            <div className={`flex items-center justify-center gap-4 ${className}`}>
                {MINIMAL_SUGGESTIONS.map((item, idx) => (
                    <React.Fragment key={item.id}>
                        {idx > 0 && (
                            <span className="text-slate-300 dark:text-slate-700">·</span>
                        )}
                        <button
                            onClick={() => handleMinimalClick(item.prompt)}
                            className="
                                text-xs text-slate-400 dark:text-slate-500
                                hover:text-slate-600 dark:hover:text-slate-300
                                transition-colors duration-200
                            "
                        >
                            {item.text}
                        </button>
                    </React.Fragment>
                ))}
            </div>
        );
    }

    // Full variant - rich suggestions
    const visibleSuggestions = suggestions.filter(s => !dismissed.has(s.id));

    if (isLoading || visibleSuggestions.length === 0) {
        return null;
    }

    return (
        <div className={`${className}`}>
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
                <Sparkles size={14} className="text-primary-500" />
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {t('aiChat.suggestions.title', 'Suggested for you')}
                </span>
            </div>

            {/* Suggestions List */}
            <div className="flex flex-wrap gap-2">
                {visibleSuggestions.map(suggestion => {
                    const Icon = SUGGESTION_ICONS[suggestion.type] || Sparkles;
                    const colorClass = SUGGESTION_COLORS[suggestion.type] || SUGGESTION_COLORS.action;

                    return (
                        <button
                            key={suggestion.id}
                            onClick={() => handleClick(suggestion)}
                            className={`
                                group relative flex items-center gap-2 px-3 py-2
                                bg-gradient-to-r ${colorClass}
                                border rounded-xl
                                text-sm text-navy-700 dark:text-slate-200
                                hover:shadow-md hover:scale-[1.02]
                                transition-all duration-200
                            `}
                        >
                            <Icon size={14} className="shrink-0 text-current opacity-70" />
                            <span>{suggestion.text}</span>
                            <ChevronRight size={14} className="shrink-0 opacity-0 group-hover:opacity-70 transition-opacity" />

                            {/* Dismiss button */}
                            <button
                                onClick={(e) => handleDismiss(suggestion.id, e)}
                                className="
                                    absolute -top-1 -right-1 p-0.5
                                    bg-slate-200 dark:bg-navy-700
                                    rounded-full opacity-0 group-hover:opacity-100
                                    transition-opacity
                                "
                            >
                                <X size={10} className="text-slate-500 dark:text-slate-400" />
                            </button>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

/**
 * Compact inline suggestion chip
 */
interface SuggestionChipProps {
    suggestion: Suggestion;
    onClick: () => void;
}

export const SuggestionChip: React.FC<SuggestionChipProps> = ({
    suggestion,
    onClick
}) => {
    const Icon = SUGGESTION_ICONS[suggestion.type] || Sparkles;

    return (
        <button
            onClick={onClick}
            className="
                inline-flex items-center gap-1.5 px-2.5 py-1
                bg-slate-100 dark:bg-navy-800
                hover:bg-primary-100 dark:hover:bg-primary-900/30
                border border-slate-200 dark:border-navy-700
                hover:border-primary-300 dark:hover:border-primary-700
                rounded-full text-xs
                text-slate-600 dark:text-slate-300
                hover:text-primary-700 dark:hover:text-primary-300
                transition-all duration-200
            "
        >
            <Icon size={12} />
            {suggestion.text}
        </button>
    );
};

export default SmartSuggestions;

