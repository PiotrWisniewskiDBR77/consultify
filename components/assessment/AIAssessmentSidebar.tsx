/**
 * AIAssessmentSidebar
 * Kontekstowy panel AI dla modułu Assessment
 * Pokazuje insighty, sugestie i szybkie akcje AI
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
    Sparkles, 
    Brain, 
    TrendingUp, 
    AlertTriangle, 
    CheckCircle2, 
    ChevronRight,
    ChevronDown,
    Lightbulb,
    Target,
    FileText,
    BarChart3,
    RefreshCw,
    Loader2,
    X,
    Zap,
    ArrowUpRight,
    MessageSquare
} from 'lucide-react';
import { useAssessmentAI, AIInsight, AIGapAnalysis } from '../../hooks/useAssessmentAI';
import { DRDAxis } from '../../types';

interface AIAssessmentSidebarProps {
    projectId: string;
    currentAxis?: DRDAxis;
    currentScore?: number;
    targetScore?: number;
    isOpen: boolean;
    onClose: () => void;
    onApplySuggestion?: (suggestion: string) => void;
    onNavigateToAxis?: (axisId: string) => void;
}

// Insight type icons and colors
const insightConfig: Record<string, { icon: React.ReactNode; color: string; bgColor: string }> = {
    STRENGTH: { 
        icon: <CheckCircle2 size={16} />, 
        color: 'text-green-600 dark:text-green-400',
        bgColor: 'bg-green-50 dark:bg-green-900/20'
    },
    PRIORITY_GAP: { 
        icon: <AlertTriangle size={16} />, 
        color: 'text-amber-600 dark:text-amber-400',
        bgColor: 'bg-amber-50 dark:bg-amber-900/20'
    },
    RISK: { 
        icon: <AlertTriangle size={16} />, 
        color: 'text-red-600 dark:text-red-400',
        bgColor: 'bg-red-50 dark:bg-red-900/20'
    },
    OPPORTUNITY: { 
        icon: <Lightbulb size={16} />, 
        color: 'text-blue-600 dark:text-blue-400',
        bgColor: 'bg-blue-50 dark:bg-blue-900/20'
    },
    SUMMARY: { 
        icon: <BarChart3 size={16} />, 
        color: 'text-purple-600 dark:text-purple-400',
        bgColor: 'bg-purple-50 dark:bg-purple-900/20'
    }
};

export const AIAssessmentSidebar: React.FC<AIAssessmentSidebarProps> = ({
    projectId,
    currentAxis,
    currentScore,
    targetScore,
    isOpen,
    onClose,
    onApplySuggestion,
    onNavigateToAxis
}) => {
    const ai = useAssessmentAI(projectId);
    
    // State
    const [activeTab, setActiveTab] = useState<'insights' | 'suggestions' | 'gap'>('insights');
    const [insights, setInsights] = useState<AIInsight[]>([]);
    const [gapAnalysis, setGapAnalysis] = useState<AIGapAnalysis | null>(null);
    const [expandedInsight, setExpandedInsight] = useState<number | null>(null);
    const [suggestion, setSuggestion] = useState<string | null>(null);
    const [isLoadingInsights, setIsLoadingInsights] = useState(false);
    const [isLoadingGap, setIsLoadingGap] = useState(false);
    const [isLoadingSuggestion, setIsLoadingSuggestion] = useState(false);

    // Load insights on mount
    useEffect(() => {
        if (isOpen && projectId) {
            loadInsights();
        }
    }, [isOpen, projectId]);

    // Load gap analysis when axis changes
    useEffect(() => {
        if (isOpen && currentAxis && currentScore && targetScore && targetScore > currentScore) {
            loadGapAnalysis();
        }
    }, [isOpen, currentAxis, currentScore, targetScore]);

    const loadInsights = useCallback(async () => {
        setIsLoadingInsights(true);
        try {
            const result = await ai.getInsights();
            setInsights(result);
        } catch (err) {
            console.error('Failed to load insights:', err);
        } finally {
            setIsLoadingInsights(false);
        }
    }, [ai]);

    const loadGapAnalysis = useCallback(async () => {
        if (!currentAxis || !currentScore || !targetScore) return;
        
        setIsLoadingGap(true);
        try {
            const result = await ai.generateGapAnalysis(currentAxis, currentScore, targetScore);
            setGapAnalysis(result);
        } catch (err) {
            console.error('Failed to load gap analysis:', err);
        } finally {
            setIsLoadingGap(false);
        }
    }, [ai, currentAxis, currentScore, targetScore]);

    const handleSuggestJustification = useCallback(async () => {
        if (!currentAxis || !currentScore) return;
        
        setIsLoadingSuggestion(true);
        try {
            const result = await ai.suggestJustification(currentAxis, currentScore);
            if (result.suggestion) {
                setSuggestion(result.suggestion);
                setActiveTab('suggestions');
            }
        } catch (err) {
            console.error('Failed to get suggestion:', err);
        } finally {
            setIsLoadingSuggestion(false);
        }
    }, [ai, currentAxis, currentScore]);

    const handleApplySuggestion = useCallback(() => {
        if (suggestion && onApplySuggestion) {
            onApplySuggestion(suggestion);
            setSuggestion(null);
        }
    }, [suggestion, onApplySuggestion]);

    if (!isOpen) return null;

    return (
        <div className="w-80 h-full bg-white dark:bg-navy-900 border-l border-slate-200 dark:border-white/10 flex flex-col shadow-xl">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                        <Brain size={18} className="text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                        <h3 className="font-bold text-navy-900 dark:text-white text-sm">AI Assistant</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Assessment Partner</p>
                    </div>
                </div>
                <button 
                    onClick={onClose}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                >
                    <X size={16} className="text-slate-400" />
                </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 dark:border-white/10">
                {[
                    { id: 'insights', label: 'Insighty', icon: <Lightbulb size={14} /> },
                    { id: 'suggestions', label: 'Sugestie', icon: <Sparkles size={14} /> },
                    { id: 'gap', label: 'Gap', icon: <TrendingUp size={14} /> }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as typeof activeTab)}
                        className={`flex-1 py-2.5 px-3 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                            activeTab === tab.id
                                ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400 bg-purple-50/50 dark:bg-purple-900/10'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                {/* Insights Tab */}
                {activeTab === 'insights' && (
                    <div className="p-4 space-y-3">
                        {isLoadingInsights ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 size={24} className="text-purple-500 animate-spin" />
                            </div>
                        ) : insights.length === 0 ? (
                            <div className="text-center py-8">
                                <Lightbulb size={32} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Brak insightów do wyświetlenia
                                </p>
                                <button
                                    onClick={loadInsights}
                                    className="mt-3 text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 mx-auto"
                                >
                                    <RefreshCw size={12} />
                                    Odśwież
                                </button>
                            </div>
                        ) : (
                            insights.map((insight, idx) => {
                                const config = insightConfig[insight.type] || insightConfig.SUMMARY;
                                const isExpanded = expandedInsight === idx;
                                
                                return (
                                    <div
                                        key={idx}
                                        className={`rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden ${config.bgColor}`}
                                    >
                                        <button
                                            onClick={() => setExpandedInsight(isExpanded ? null : idx)}
                                            className="w-full p-3 flex items-start gap-3 text-left"
                                        >
                                            <div className={config.color}>
                                                {config.icon}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-navy-900 dark:text-white line-clamp-2">
                                                    {insight.title}
                                                </p>
                                                {!isExpanded && (
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                                                        {insight.description}
                                                    </p>
                                                )}
                                            </div>
                                            {isExpanded ? (
                                                <ChevronDown size={14} className="text-slate-400 shrink-0" />
                                            ) : (
                                                <ChevronRight size={14} className="text-slate-400 shrink-0" />
                                            )}
                                        </button>
                                        
                                        {isExpanded && (
                                            <div className="px-3 pb-3 pt-0">
                                                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                                                    {insight.description}
                                                </p>
                                                {insight.axis && onNavigateToAxis && (
                                                    <button
                                                        onClick={() => onNavigateToAxis(insight.axis!)}
                                                        className="mt-2 text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                                                    >
                                                        Przejdź do osi
                                                        <ArrowUpRight size={12} />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                        
                        {insights.length > 0 && (
                            <button
                                onClick={loadInsights}
                                disabled={isLoadingInsights}
                                className="w-full py-2 text-xs text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 flex items-center justify-center gap-1"
                            >
                                {isLoadingInsights ? (
                                    <Loader2 size={12} className="animate-spin" />
                                ) : (
                                    <RefreshCw size={12} />
                                )}
                                Odśwież insighty
                            </button>
                        )}
                    </div>
                )}

                {/* Suggestions Tab */}
                {activeTab === 'suggestions' && (
                    <div className="p-4 space-y-4">
                        {/* Quick Actions */}
                        <div>
                            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                                Szybkie akcje
                            </h4>
                            <div className="space-y-2">
                                <button
                                    onClick={handleSuggestJustification}
                                    disabled={!currentAxis || !currentScore || isLoadingSuggestion}
                                    className="w-full p-3 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 border border-purple-200 dark:border-purple-500/30 rounded-xl text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <div className="flex items-center gap-3">
                                        {isLoadingSuggestion ? (
                                            <Loader2 size={18} className="text-purple-500 animate-spin" />
                                        ) : (
                                            <Sparkles size={18} className="text-purple-500" />
                                        )}
                                        <div>
                                            <p className="text-sm font-medium text-purple-700 dark:text-purple-300">
                                                Zasugeruj uzasadnienie
                                            </p>
                                            <p className="text-xs text-purple-600/70 dark:text-purple-400/70">
                                                AI wygeneruje treść dla obecnej oceny
                                            </p>
                                        </div>
                                    </div>
                                </button>

                                <button
                                    onClick={() => currentAxis && currentScore && ai.suggestEvidence(currentAxis, currentScore)}
                                    disabled={!currentAxis || !currentScore}
                                    className="w-full p-3 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 border border-blue-200 dark:border-blue-500/30 rounded-xl text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <div className="flex items-center gap-3">
                                        <FileText size={18} className="text-blue-500" />
                                        <div>
                                            <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                                                Zasugeruj dowody
                                            </p>
                                            <p className="text-xs text-blue-600/70 dark:text-blue-400/70">
                                                Lista dokumentów i metryk
                                            </p>
                                        </div>
                                    </div>
                                </button>

                                <button
                                    onClick={() => currentAxis && currentScore && ai.suggestTarget(currentAxis, currentScore)}
                                    disabled={!currentAxis || !currentScore}
                                    className="w-full p-3 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 border border-green-200 dark:border-green-500/30 rounded-xl text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <div className="flex items-center gap-3">
                                        <Target size={18} className="text-green-500" />
                                        <div>
                                            <p className="text-sm font-medium text-green-700 dark:text-green-300">
                                                Zasugeruj cel
                                            </p>
                                            <p className="text-xs text-green-600/70 dark:text-green-400/70">
                                                Rekomendowany target score
                                            </p>
                                        </div>
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* Current Suggestion */}
                        {suggestion && (
                            <div className="border-t border-slate-200 dark:border-white/10 pt-4">
                                <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                                    Sugestia AI
                                </h4>
                                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-500/30 rounded-xl p-4">
                                    <p className="text-sm text-purple-800 dark:text-purple-200 leading-relaxed">
                                        {suggestion}
                                    </p>
                                    <div className="flex gap-2 mt-4">
                                        <button
                                            onClick={handleApplySuggestion}
                                            className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium rounded-lg transition-colors"
                                        >
                                            Zastosuj
                                        </button>
                                        <button
                                            onClick={() => setSuggestion(null)}
                                            className="px-4 py-2 bg-purple-100 dark:bg-purple-800/50 hover:bg-purple-200 dark:hover:bg-purple-700/50 text-purple-700 dark:text-purple-300 text-xs font-medium rounded-lg transition-colors"
                                        >
                                            Odrzuć
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Context Info */}
                        {currentAxis && currentScore && (
                            <div className="border-t border-slate-200 dark:border-white/10 pt-4">
                                <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                                    Kontekst
                                </h4>
                                <div className="bg-slate-50 dark:bg-navy-950/50 rounded-xl p-3 space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500 dark:text-slate-400">Oś:</span>
                                        <span className="font-medium text-navy-900 dark:text-white capitalize">{currentAxis}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500 dark:text-slate-400">Ocena:</span>
                                        <span className="font-medium text-navy-900 dark:text-white">{currentScore}/7</span>
                                    </div>
                                    {targetScore && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-500 dark:text-slate-400">Cel:</span>
                                            <span className="font-medium text-navy-900 dark:text-white">{targetScore}/7</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Gap Analysis Tab */}
                {activeTab === 'gap' && (
                    <div className="p-4 space-y-4">
                        {!currentAxis || !currentScore || !targetScore ? (
                            <div className="text-center py-8">
                                <TrendingUp size={32} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Wybierz ocenę i cel, aby zobaczyć analizę luki
                                </p>
                            </div>
                        ) : isLoadingGap ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 size={24} className="text-purple-500 animate-spin" />
                            </div>
                        ) : gapAnalysis ? (
                            <>
                                {/* Gap Overview */}
                                <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl p-4 border border-purple-200 dark:border-purple-500/30">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                            Gap Summary
                                        </span>
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                            gapAnalysis.gapSeverity === 'LOW' 
                                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                : gapAnalysis.gapSeverity === 'MEDIUM'
                                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                        }`}>
                                            {gapAnalysis.gapSeverity}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-center">
                                            <p className="text-2xl font-bold text-navy-900 dark:text-white">{gapAnalysis.currentScore}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">Obecny</p>
                                        </div>
                                        <div className="flex-1 flex items-center">
                                            <div className="flex-1 h-2 bg-slate-200 dark:bg-navy-800 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-gradient-to-r from-purple-500 to-blue-500"
                                                    style={{ width: `${(gapAnalysis.currentScore / 7) * 100}%` }}
                                                />
                                            </div>
                                            <ChevronRight size={16} className="text-slate-400 mx-2" />
                                            <div className="flex-1 h-2 bg-slate-200 dark:bg-navy-800 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-gradient-to-r from-green-400 to-green-500"
                                                    style={{ width: `${(gapAnalysis.targetScore / 7) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-2xl font-bold text-navy-900 dark:text-white">{gapAnalysis.targetScore}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">Cel</p>
                                        </div>
                                    </div>
                                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-3">
                                        Szacowany czas: <span className="font-semibold">{gapAnalysis.estimatedTotalMonths} miesięcy</span>
                                    </p>
                                </div>

                                {/* Pathway */}
                                {gapAnalysis.pathway && gapAnalysis.pathway.length > 0 && (
                                    <div>
                                        <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                                            Ścieżka rozwoju
                                        </h4>
                                        <div className="space-y-3">
                                            {gapAnalysis.pathway.map((step, idx) => (
                                                <div 
                                                    key={idx}
                                                    className="bg-slate-50 dark:bg-navy-950/50 rounded-xl p-3 border border-slate-200 dark:border-white/10"
                                                >
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <span className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-xs font-bold flex items-center justify-center">
                                                            {step.level}
                                                        </span>
                                                        <p className="text-sm font-medium text-navy-900 dark:text-white flex-1">
                                                            {step.description}
                                                        </p>
                                                        <span className="text-xs text-slate-500 dark:text-slate-400">
                                                            ~{step.estimatedMonths}m
                                                        </span>
                                                    </div>
                                                    {step.keyActivities && step.keyActivities.length > 0 && (
                                                        <ul className="ml-9 space-y-1">
                                                            {step.keyActivities.map((activity, aIdx) => (
                                                                <li key={aIdx} className="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-1.5">
                                                                    <span className="text-purple-400">•</span>
                                                                    {activity}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* AI Recommendations */}
                                {gapAnalysis.aiRecommendations && gapAnalysis.aiRecommendations.length > 0 && (
                                    <div>
                                        <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                                            Rekomendacje AI
                                        </h4>
                                        <div className="space-y-2">
                                            {gapAnalysis.aiRecommendations.map((rec, idx) => (
                                                <div 
                                                    key={idx}
                                                    className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-500/30"
                                                >
                                                    <div className="flex items-start gap-2">
                                                        <Zap size={14} className="text-blue-500 mt-0.5 shrink-0" />
                                                        <div>
                                                            <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                                                                {rec.title}
                                                            </p>
                                                            <p className="text-xs text-blue-600/80 dark:text-blue-300/80 mt-1">
                                                                {rec.description}
                                                            </p>
                                                            <div className="flex gap-2 mt-2">
                                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                                                    rec.priority === 'HIGH' 
                                                                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                                        : rec.priority === 'MEDIUM'
                                                                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                                            : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                                }`}>
                                                                    {rec.priority}
                                                                </span>
                                                                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                                                    {rec.timeframe}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <button
                                    onClick={loadGapAnalysis}
                                    disabled={isLoadingGap}
                                    className="w-full py-2 text-xs text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 flex items-center justify-center gap-1"
                                >
                                    {isLoadingGap ? (
                                        <Loader2 size={12} className="animate-spin" />
                                    ) : (
                                        <RefreshCw size={12} />
                                    )}
                                    Przelicz analizę
                                </button>
                            </>
                        ) : (
                            <div className="text-center py-8">
                                <AlertTriangle size={32} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Nie udało się wczytać analizy
                                </p>
                                <button
                                    onClick={loadGapAnalysis}
                                    className="mt-3 text-xs text-purple-600 dark:text-purple-400 hover:underline"
                                >
                                    Spróbuj ponownie
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-navy-950/50">
                <button
                    onClick={() => {
                        // Open full chat with assessment context
                        // This would trigger opening ChatPanel with assessment mode
                    }}
                    className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                    <MessageSquare size={16} />
                    Otwórz pełny chat AI
                </button>
            </div>
        </div>
    );
};

export default AIAssessmentSidebar;

