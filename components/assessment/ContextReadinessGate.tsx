/**
 * ContextReadinessGate Component
 * 
 * Displays context readiness status and blocks assessment finalization
 * when context score is below required threshold.
 * BCG/McKinsey-level context validation.
 */

import React, { useEffect, useState } from 'react';
import { 
    AlertCircle, 
    CheckCircle2, 
    AlertTriangle, 
    ChevronRight, 
    Building2,
    Target,
    Sparkles,
    Loader2,
    Info
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Helper to get auth token from localStorage
const getAuthToken = () => localStorage.getItem('token');

interface ContextGap {
    key: string;
    label: string;
    weight: number;
    category: string;
    required?: boolean;
}

interface CategoryScore {
    score: number;
    total: number;
}

interface Recommendation {
    priority: string;
    message: string;
    fields?: string[];
    action?: string;
}

interface ReadinessData {
    score: number;
    level: string;
    levelDescription: string;
    canFinalize: boolean;
    canGenerateReport: boolean;
    gaps: ContextGap[];
    optionalGaps?: ContextGap[];
    filledFields: ContextGap[];
    byCategory: {
        organization: CategoryScore;
        strategy: CategoryScore;
        transformation: CategoryScore;
    };
    recommendations: Recommendation[];
    requiredThreshold: number;
}

interface ContextReadinessGateProps {
    projectId: string;
    onReadinessChange?: (canFinalize: boolean, score: number) => void;
    onNavigateToContext?: () => void;
    compact?: boolean;
    showRecommendations?: boolean;
}

const LEVEL_COLORS = {
    'Insufficient': { bg: 'bg-red-50 dark:bg-red-500/10', border: 'border-red-200 dark:border-red-500/30', text: 'text-red-700 dark:text-red-400', icon: AlertCircle },
    'Minimal': { bg: 'bg-orange-50 dark:bg-orange-500/10', border: 'border-orange-200 dark:border-orange-500/30', text: 'text-orange-700 dark:text-orange-400', icon: AlertTriangle },
    'Standard': { bg: 'bg-blue-50 dark:bg-blue-500/10', border: 'border-blue-200 dark:border-blue-500/30', text: 'text-blue-700 dark:text-blue-400', icon: CheckCircle2 },
    'Complete': { bg: 'bg-green-50 dark:bg-green-500/10', border: 'border-green-200 dark:border-green-500/30', text: 'text-green-700 dark:text-green-400', icon: Sparkles }
};

const CATEGORY_ICONS = {
    organization: Building2,
    strategy: Target,
    transformation: Sparkles
};

const CATEGORY_LABELS = {
    organization: 'Organization Profile',
    strategy: 'Strategic Context',
    transformation: 'Transformation Details'
};

export const ContextReadinessGate: React.FC<ContextReadinessGateProps> = ({
    projectId,
    onReadinessChange,
    onNavigateToContext,
    compact = false,
    showRecommendations = true
}) => {
    const { t } = useTranslation();
    const token = getAuthToken();
    const [readiness, setReadiness] = useState<ReadinessData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

    useEffect(() => {
        fetchReadiness();
    }, [projectId]);

    const fetchReadiness = async () => {
        if (!projectId) return;
        
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/context/${projectId}/finalization-check`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch context readiness');
            }

            const data = await response.json();
            
            // Fetch full readiness data
            const contextResponse = await fetch(`/api/context/${projectId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (contextResponse.ok) {
                const contextData = await contextResponse.json();
                setReadiness(contextData.readiness);
                onReadinessChange?.(contextData.readiness.canFinalize, contextData.readiness.score);
            }
        } catch (err) {
            console.error('[ContextReadinessGate] Error:', err);
            setError('Failed to check context readiness');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-4">
                <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                <span className="ml-2 text-sm text-slate-500">Checking context readiness...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg">
                <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                    <AlertCircle className="w-5 h-5" />
                    <span>{error}</span>
                </div>
            </div>
        );
    }

    if (!readiness) {
        return null;
    }

    const levelStyle = LEVEL_COLORS[readiness.level as keyof typeof LEVEL_COLORS] || LEVEL_COLORS['Insufficient'];
    const LevelIcon = levelStyle.icon;

    // Compact view for sidebar/header
    if (compact) {
        return (
            <div 
                className={`p-3 rounded-lg border ${levelStyle.bg} ${levelStyle.border} cursor-pointer hover:opacity-90 transition-opacity`}
                onClick={onNavigateToContext}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <LevelIcon className={`w-4 h-4 ${levelStyle.text}`} />
                        <span className={`text-sm font-medium ${levelStyle.text}`}>
                            Context: {readiness.score}%
                        </span>
                    </div>
                    {!readiness.canFinalize && (
                        <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                            Required: {readiness.requiredThreshold}%
                        </span>
                    )}
                </div>
            </div>
        );
    }

    // Full view with details
    return (
        <div className={`rounded-xl border ${levelStyle.border} ${levelStyle.bg} overflow-hidden`}>
            {/* Header */}
            <div className="p-4 border-b border-inherit">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${levelStyle.bg}`}>
                            <LevelIcon className={`w-6 h-6 ${levelStyle.text}`} />
                        </div>
                        <div>
                            <h3 className={`font-semibold ${levelStyle.text}`}>
                                Context Readiness: {readiness.level}
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {readiness.levelDescription}
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className={`text-2xl font-bold ${levelStyle.text}`}>
                            {readiness.score}%
                        </div>
                        <div className="text-xs text-slate-500">
                            Required: {readiness.requiredThreshold}%
                        </div>
                    </div>
                </div>

                {/* Progress bar */}
                <div className="mt-4">
                    <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div 
                            className={`h-full transition-all duration-500 ${
                                readiness.canFinalize 
                                    ? 'bg-green-500' 
                                    : readiness.score >= 40 
                                        ? 'bg-orange-500' 
                                        : 'bg-red-500'
                            }`}
                            style={{ width: `${readiness.score}%` }}
                        />
                    </div>
                    <div className="flex justify-between mt-1 text-xs text-slate-400">
                        <span>0%</span>
                        <span className={readiness.score >= 40 ? 'text-orange-500' : ''}>40% Minimal</span>
                        <span className={readiness.score >= 70 ? 'text-blue-500' : ''}>70% Standard</span>
                        <span className={readiness.score >= 90 ? 'text-green-500' : ''}>90% Complete</span>
                    </div>
                </div>
            </div>

            {/* Category breakdown */}
            <div className="p-4 space-y-3">
                <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Context Categories
                </h4>
                {Object.entries(readiness.byCategory).map(([category, scores]) => {
                    const CategoryIcon = CATEGORY_ICONS[category as keyof typeof CATEGORY_ICONS];
                    const categoryLabel = CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS];
                    const percentage = scores.total > 0 ? Math.round((scores.score / scores.total) * 100) : 0;
                    const isExpanded = expandedCategory === category;
                    const categoryGaps = readiness.gaps.filter(g => g.category === category);

                    return (
                        <div key={category} className="bg-white/50 dark:bg-white/5 rounded-lg border border-slate-200 dark:border-slate-700">
                            <button
                                className="w-full p-3 flex items-center justify-between"
                                onClick={() => setExpandedCategory(isExpanded ? null : category)}
                            >
                                <div className="flex items-center gap-2">
                                    <CategoryIcon className="w-4 h-4 text-slate-500" />
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                        {categoryLabel}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`text-sm font-medium ${
                                        percentage >= 80 ? 'text-green-600' : 
                                        percentage >= 50 ? 'text-orange-600' : 'text-red-600'
                                    }`}>
                                        {scores.score}/{scores.total}pts
                                    </span>
                                    <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                </div>
                            </button>
                            
                            {isExpanded && categoryGaps.length > 0 && (
                                <div className="px-3 pb-3 border-t border-slate-200 dark:border-slate-700">
                                    <div className="pt-2 space-y-1">
                                        {categoryGaps.map(gap => (
                                            <div 
                                                key={gap.key}
                                                className="flex items-center justify-between text-sm py-1"
                                            >
                                                <span className="text-slate-600 dark:text-slate-400">
                                                    {gap.label}
                                                </span>
                                                <span className="text-red-500 font-medium">
                                                    -{gap.weight}pts
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Recommendations */}
            {showRecommendations && readiness.recommendations && readiness.recommendations.length > 0 && (
                <div className="p-4 border-t border-inherit">
                    <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                        <Info className="w-4 h-4" />
                        Recommendations
                    </h4>
                    <div className="space-y-2">
                        {readiness.recommendations.map((rec, idx) => (
                            <div 
                                key={idx}
                                className={`p-3 rounded-lg text-sm ${
                                    rec.priority === 'HIGH' 
                                        ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400'
                                        : 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400'
                                }`}
                            >
                                <p>{rec.message}</p>
                                {rec.fields && rec.fields.length > 0 && (
                                    <p className="mt-1 text-xs opacity-75">
                                        Fields: {rec.fields.join(', ')}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Action buttons */}
            <div className="p-4 border-t border-inherit bg-white/30 dark:bg-black/10">
                {!readiness.canFinalize ? (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                            <AlertCircle className="w-5 h-5" />
                            <span className="text-sm font-medium">
                                Cannot finalize assessment - context score below {readiness.requiredThreshold}%
                            </span>
                        </div>
                        <button
                            onClick={onNavigateToContext}
                            className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            <Building2 className="w-4 h-4" />
                            Complete Organization Profile
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                        <CheckCircle2 className="w-5 h-5" />
                        <span className="text-sm font-medium">
                            Ready to finalize assessment and generate report
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ContextReadinessGate;

