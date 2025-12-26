/**
 * InitiativesReportSection
 * 
 * Displays initiatives as a report section:
 * - Fetches initiatives from the backend
 * - Groups by priority (Quick Win / Strategic)
 * - Shows effort/impact matrix
 * - Read-only display in report context
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Lightbulb,
    Zap,
    Target,
    Clock,
    TrendingUp,
    DollarSign,
    Users,
    CheckCircle,
    AlertCircle,
    ExternalLink,
    Loader2
} from 'lucide-react';

interface Initiative {
    id: string;
    name: string;
    description?: string;
    status: string;
    priority: 'high' | 'medium' | 'low';
    effort: 'low' | 'medium' | 'high';
    impact: 'low' | 'medium' | 'high';
    timeframe?: string;
    estimatedCost?: number;
    businessValue?: string;
    axis?: string;
    axisId?: string;
    tags?: string[];
}

interface InitiativesReportSectionProps {
    projectId: string;
    maxItems?: number;
    showDetails?: boolean;
}

// Effort/Impact labels
const EFFORT_LABELS: Record<string, { en: string; pl: string; color: string }> = {
    low: { en: 'Low', pl: 'Niski', color: 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-500/20' },
    medium: { en: 'Medium', pl: 'Średni', color: 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-500/20' },
    high: { en: 'High', pl: 'Wysoki', color: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-500/20' }
};

const IMPACT_LABELS: Record<string, { en: string; pl: string; color: string }> = {
    low: { en: 'Low', pl: 'Niski', color: 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-500/20' },
    medium: { en: 'Medium', pl: 'Średni', color: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-500/20' },
    high: { en: 'High', pl: 'Wysoki', color: 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-500/20' }
};

const PRIORITY_LABELS: Record<string, { en: string; pl: string; icon: React.ComponentType<{ className?: string }> }> = {
    high: { en: 'High Priority', pl: 'Wysoki Priorytet', icon: AlertCircle },
    medium: { en: 'Medium Priority', pl: 'Średni Priorytet', icon: Target },
    low: { en: 'Low Priority', pl: 'Niski Priorytet', icon: Clock }
};

// Initiative card component
const InitiativeCard: React.FC<{ initiative: Initiative; isPolish: boolean; showDetails: boolean }> = ({ 
    initiative, 
    isPolish,
    showDetails 
}) => {
    const effortConfig = EFFORT_LABELS[initiative.effort] || EFFORT_LABELS.medium;
    const impactConfig = IMPACT_LABELS[initiative.impact] || IMPACT_LABELS.medium;
    const priorityConfig = PRIORITY_LABELS[initiative.priority] || PRIORITY_LABELS.medium;
    const PriorityIcon = priorityConfig.icon;

    // Determine if this is a Quick Win (low effort, high impact)
    const isQuickWin = initiative.effort === 'low' && initiative.impact === 'high';

    return (
        <div className={`
            bg-white dark:bg-navy-900 rounded-lg border p-4 transition-all
            ${isQuickWin 
                ? 'border-green-200 dark:border-green-500/30 ring-1 ring-green-500/20' 
                : 'border-slate-200 dark:border-white/10'
            }
        `}>
            <div className="flex items-start gap-3">
                {/* Icon */}
                <div className={`
                    p-2 rounded-lg flex-shrink-0
                    ${isQuickWin 
                        ? 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400'
                        : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400'
                    }
                `}>
                    {isQuickWin ? <Zap className="w-5 h-5" /> : <Lightbulb className="w-5 h-5" />}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium text-navy-900 dark:text-white">
                            {initiative.name}
                        </h4>
                        {isQuickWin && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 rounded-full">
                                <Zap className="w-3 h-3" />
                                Quick Win
                            </span>
                        )}
                    </div>

                    {showDetails && initiative.description && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                            {initiative.description}
                        </p>
                    )}

                    {/* Metrics */}
                    <div className="flex items-center gap-3 mt-3 flex-wrap">
                        {/* Effort */}
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded ${effortConfig.color}`}>
                            <Clock className="w-3 h-3" />
                            {isPolish ? `Wysiłek: ${effortConfig.pl}` : `Effort: ${effortConfig.en}`}
                        </span>

                        {/* Impact */}
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded ${impactConfig.color}`}>
                            <TrendingUp className="w-3 h-3" />
                            {isPolish ? `Wpływ: ${impactConfig.pl}` : `Impact: ${impactConfig.en}`}
                        </span>

                        {/* Timeframe */}
                        {initiative.timeframe && (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                                <Clock className="w-3 h-3" />
                                {initiative.timeframe}
                            </span>
                        )}

                        {/* Axis */}
                        {initiative.axis && (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                                <Target className="w-3 h-3" />
                                {initiative.axis}
                            </span>
                        )}
                    </div>
                </div>

                {/* Priority */}
                <div className="flex-shrink-0">
                    <PriorityIcon className={`w-5 h-5 ${
                        initiative.priority === 'high' ? 'text-red-500' :
                        initiative.priority === 'medium' ? 'text-yellow-500' :
                        'text-slate-400'
                    }`} />
                </div>
            </div>
        </div>
    );
};

// Effort/Impact Matrix visualization
const EffortImpactMatrix: React.FC<{ initiatives: Initiative[]; isPolish: boolean }> = ({ initiatives, isPolish }) => {
    // Group initiatives by effort/impact
    const matrix = useMemo(() => {
        const groups: Record<string, Initiative[]> = {
            'low-high': [],    // Quick Wins
            'medium-high': [], // Major Projects
            'high-high': [],   // Strategic
            'low-medium': [],  // Fill-ins
            'medium-medium': [], // Standard
            'high-medium': [], // Hard Slog
            'low-low': [],     // Optional
            'medium-low': [],  // Questionable
            'high-low': []     // Avoid
        };

        initiatives.forEach(i => {
            const key = `${i.effort}-${i.impact}`;
            if (groups[key]) {
                groups[key].push(i);
            }
        });

        return groups;
    }, [initiatives]);

    const cellLabels: Record<string, { en: string; pl: string; color: string }> = {
        'low-high': { en: 'Quick Wins', pl: 'Quick Wins', color: 'bg-green-100 dark:bg-green-500/20 border-green-200 dark:border-green-500/30' },
        'medium-high': { en: 'Major Projects', pl: 'Duże Projekty', color: 'bg-blue-100 dark:bg-blue-500/20 border-blue-200 dark:border-blue-500/30' },
        'high-high': { en: 'Strategic', pl: 'Strategiczne', color: 'bg-purple-100 dark:bg-purple-500/20 border-purple-200 dark:border-purple-500/30' },
        'low-medium': { en: 'Fill-ins', pl: 'Uzupełnienia', color: 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10' },
        'medium-medium': { en: 'Standard', pl: 'Standardowe', color: 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10' },
        'high-medium': { en: 'Hard Slog', pl: 'Trudne', color: 'bg-yellow-50 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/20' },
        'low-low': { en: 'Optional', pl: 'Opcjonalne', color: 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10' },
        'medium-low': { en: 'Questionable', pl: 'Wątpliwe', color: 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10' },
        'high-low': { en: 'Avoid', pl: 'Unikaj', color: 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20' }
    };

    return (
        <div className="bg-slate-50 dark:bg-navy-800/50 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-navy-900 dark:text-white mb-4">
                {isPolish ? 'Macierz Wysiłek/Wpływ' : 'Effort/Impact Matrix'}
            </h4>

            <div className="overflow-x-auto">
                <div className="min-w-[400px]">
                    {/* Header row */}
                    <div className="grid grid-cols-4 gap-2 mb-2">
                        <div></div>
                        <div className="text-center text-xs font-medium text-slate-500 dark:text-slate-400">
                            {isPolish ? 'Niski wysiłek' : 'Low effort'}
                        </div>
                        <div className="text-center text-xs font-medium text-slate-500 dark:text-slate-400">
                            {isPolish ? 'Średni wysiłek' : 'Medium effort'}
                        </div>
                        <div className="text-center text-xs font-medium text-slate-500 dark:text-slate-400">
                            {isPolish ? 'Wysoki wysiłek' : 'High effort'}
                        </div>
                    </div>

                    {/* Matrix rows */}
                    {['high', 'medium', 'low'].map((impact) => (
                        <div key={impact} className="grid grid-cols-4 gap-2 mb-2">
                            <div className="flex items-center text-xs font-medium text-slate-500 dark:text-slate-400">
                                {impact === 'high' ? (isPolish ? 'Wysoki wpływ' : 'High impact') :
                                 impact === 'medium' ? (isPolish ? 'Średni wpływ' : 'Medium impact') :
                                 (isPolish ? 'Niski wpływ' : 'Low impact')}
                            </div>
                            {['low', 'medium', 'high'].map((effort) => {
                                const key = `${effort}-${impact}`;
                                const items = matrix[key] || [];
                                const cellConfig = cellLabels[key];
                                
                                return (
                                    <div 
                                        key={key}
                                        className={`p-2 rounded-lg border min-h-[60px] ${cellConfig.color}`}
                                    >
                                        <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                            {isPolish ? cellConfig.pl : cellConfig.en}
                                        </div>
                                        {items.length > 0 && (
                                            <div className="text-lg font-bold text-navy-900 dark:text-white">
                                                {items.length}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// Main component
export const InitiativesReportSection: React.FC<InitiativesReportSectionProps> = ({
    projectId,
    maxItems = 10,
    showDetails = true
}) => {
    const { t, i18n } = useTranslation();
    const isPolish = i18n.language === 'pl';

    const [initiatives, setInitiatives] = useState<Initiative[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch initiatives
    useEffect(() => {
        const fetchInitiatives = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const response = await fetch(`/api/initiatives?projectId=${projectId}&limit=${maxItems}`, {
                    credentials: 'include'
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch initiatives');
                }

                const data = await response.json();
                setInitiatives(data.initiatives || data || []);
            } catch (err) {
                console.error('[InitiativesReportSection] Fetch error:', err);
                setError(isPolish ? 'Nie udało się pobrać inicjatyw' : 'Failed to load initiatives');
            } finally {
                setIsLoading(false);
            }
        };

        if (projectId) {
            fetchInitiatives();
        }
    }, [projectId, maxItems, isPolish]);

    // Group initiatives
    const { quickWins, strategic, other } = useMemo(() => {
        const quickWins: Initiative[] = [];
        const strategic: Initiative[] = [];
        const other: Initiative[] = [];

        initiatives.forEach(i => {
            if (i.effort === 'low' && i.impact === 'high') {
                quickWins.push(i);
            } else if (i.impact === 'high') {
                strategic.push(i);
            } else {
                other.push(i);
            }
        });

        return { quickWins, strategic, other };
    }, [initiatives]);

    // Loading state
    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="bg-red-50 dark:bg-red-500/10 rounded-lg p-4 text-center">
                <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
        );
    }

    // Empty state
    if (initiatives.length === 0) {
        return (
            <div className="bg-slate-50 dark:bg-navy-800/50 rounded-lg p-8 text-center">
                <Lightbulb className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                <p className="text-slate-600 dark:text-slate-400">
                    {isPolish ? 'Brak inicjatyw do wyświetlenia' : 'No initiatives to display'}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-green-50 dark:bg-green-500/10 rounded-lg p-4 text-center">
                    <Zap className="w-6 h-6 text-green-600 dark:text-green-400 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                        {quickWins.length}
                    </div>
                    <div className="text-xs text-green-600 dark:text-green-400">
                        Quick Wins
                    </div>
                </div>
                <div className="bg-purple-50 dark:bg-purple-500/10 rounded-lg p-4 text-center">
                    <Target className="w-6 h-6 text-purple-600 dark:text-purple-400 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-purple-700 dark:text-purple-400">
                        {strategic.length}
                    </div>
                    <div className="text-xs text-purple-600 dark:text-purple-400">
                        {isPolish ? 'Strategiczne' : 'Strategic'}
                    </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-500/10 rounded-lg p-4 text-center">
                    <Lightbulb className="w-6 h-6 text-slate-600 dark:text-slate-400 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-slate-700 dark:text-slate-400">
                        {initiatives.length}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                        {isPolish ? 'Łącznie' : 'Total'}
                    </div>
                </div>
            </div>

            {/* Effort/Impact Matrix */}
            <EffortImpactMatrix initiatives={initiatives} isPolish={isPolish} />

            {/* Quick Wins section */}
            {quickWins.length > 0 && (
                <div>
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-navy-900 dark:text-white mb-3">
                        <Zap className="w-4 h-4 text-green-500" />
                        Quick Wins ({quickWins.length})
                    </h4>
                    <div className="space-y-3">
                        {quickWins.map(initiative => (
                            <InitiativeCard 
                                key={initiative.id} 
                                initiative={initiative} 
                                isPolish={isPolish}
                                showDetails={showDetails}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Strategic section */}
            {strategic.length > 0 && (
                <div>
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-navy-900 dark:text-white mb-3">
                        <Target className="w-4 h-4 text-purple-500" />
                        {isPolish ? 'Inicjatywy Strategiczne' : 'Strategic Initiatives'} ({strategic.length})
                    </h4>
                    <div className="space-y-3">
                        {strategic.map(initiative => (
                            <InitiativeCard 
                                key={initiative.id} 
                                initiative={initiative} 
                                isPolish={isPolish}
                                showDetails={showDetails}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Other initiatives */}
            {other.length > 0 && (
                <div>
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-navy-900 dark:text-white mb-3">
                        <Lightbulb className="w-4 h-4 text-slate-500" />
                        {isPolish ? 'Pozostałe Inicjatywy' : 'Other Initiatives'} ({other.length})
                    </h4>
                    <div className="space-y-3">
                        {other.slice(0, 5).map(initiative => (
                            <InitiativeCard 
                                key={initiative.id} 
                                initiative={initiative} 
                                isPolish={isPolish}
                                showDetails={showDetails}
                            />
                        ))}
                        {other.length > 5 && (
                            <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-2">
                                {isPolish 
                                    ? `+ ${other.length - 5} więcej inicjatyw`
                                    : `+ ${other.length - 5} more initiatives`
                                }
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default InitiativesReportSection;

