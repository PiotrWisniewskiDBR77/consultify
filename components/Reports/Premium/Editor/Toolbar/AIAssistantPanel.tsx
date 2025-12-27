/**
 * AIAssistantPanel
 * 
 * Side panel for AI-powered content generation with section-specific prompts
 * and one-click generation for report sections.
 */

import React, { useState } from 'react';
import {
    X,
    Sparkles,
    FileText,
    Target,
    Lightbulb,
    Map,
    TrendingUp,
    AlertTriangle,
    Loader2,
    ChevronRight,
    Wand2
} from 'lucide-react';

interface AIAssistantPanelProps {
    assessmentId?: string;
    onGenerate: (prompt: string, targetSection?: string) => Promise<void>;
    onInsertBlock: (blockType: string, data?: Record<string, unknown>) => void;
    onClose: () => void;
}

interface QuickAction {
    id: string;
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    sectionType: string;
}

const QUICK_ACTIONS: QuickAction[] = [
    {
        id: 'executive-summary',
        label: 'Executive Summary',
        description: 'Podsumowanie dla zarządu z kluczowymi wnioskami',
        icon: FileText,
        sectionType: 'executiveSummary'
    },
    {
        id: 'gap-analysis',
        label: 'Analiza Luk',
        description: 'Szczegółowa analiza luk w dojrzałości',
        icon: Target,
        sectionType: 'gapAnalysis'
    },
    {
        id: 'recommendations',
        label: 'Rekomendacje',
        description: 'Top 10 rekomendacji z priorytyzacją',
        icon: Lightbulb,
        sectionType: 'recommendations'
    },
    {
        id: 'roadmap',
        label: 'Roadmapa Transformacji',
        description: 'Plan wdrożenia w fazach',
        icon: Map,
        sectionType: 'roadmap'
    },
    {
        id: 'roi-analysis',
        label: 'Analiza ROI',
        description: 'Szacowany zwrot z inwestycji',
        icon: TrendingUp,
        sectionType: 'roiAnalysis'
    },
    {
        id: 'risk-assessment',
        label: 'Ocena Ryzyka',
        description: 'Identyfikacja i mitygacja ryzyk',
        icon: AlertTriangle,
        sectionType: 'riskAssessment'
    }
];

export const AIAssistantPanel: React.FC<AIAssistantPanelProps> = ({
    assessmentId,
    onGenerate,
    onInsertBlock,
    onClose
}) => {
    const [customPrompt, setCustomPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'quick' | 'custom'>('quick');

    const handleQuickAction = async (action: QuickAction) => {
        if (!assessmentId) return;

        setIsGenerating(action.id);
        try {
            await onGenerate('', action.sectionType);
        } finally {
            setIsGenerating(null);
        }
    };

    const handleCustomGenerate = async () => {
        if (!customPrompt.trim()) return;

        setIsGenerating('custom');
        try {
            await onGenerate(customPrompt);
            setCustomPrompt('');
        } finally {
            setIsGenerating(null);
        }
    };

    return (
        <div className="fixed right-0 top-0 bottom-0 w-96 bg-white dark:bg-navy-900 shadow-2xl border-l border-slate-200 dark:border-slate-700 z-50 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg">
                        <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="font-semibold text-slate-900 dark:text-white">
                            Asystent AI
                        </h2>
                        <p className="text-xs text-slate-500">
                            Generuj treści klasy McKinsey
                        </p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-700">
                <button
                    onClick={() => setActiveTab('quick')}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'quick'
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                >
                    Szybkie akcje
                </button>
                <button
                    onClick={() => setActiveTab('custom')}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'custom'
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                >
                    Custom prompt
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                {activeTab === 'quick' ? (
                    <div className="p-4 space-y-3">
                        {!assessmentId && (
                            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-amber-700 dark:text-amber-400 text-sm">
                                Wybierz assessment, aby generować treści.
                            </div>
                        )}

                        {QUICK_ACTIONS.map((action) => {
                            const Icon = action.icon;
                            const isLoading = isGenerating === action.id;

                            return (
                                <button
                                    key={action.id}
                                    onClick={() => handleQuickAction(action)}
                                    disabled={!assessmentId || isGenerating !== null}
                                    className={`
                    w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left
                    ${isLoading
                                            ? 'border-blue-300 bg-blue-50 dark:bg-blue-900/20'
                                            : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md'
                                        }
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                                >
                                    <div className={`
                    p-3 rounded-lg
                    ${isLoading
                                            ? 'bg-blue-500 text-white'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                                        }
                  `}>
                                        {isLoading ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : (
                                            <Icon className="w-5 h-5" />
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-medium text-slate-900 dark:text-white">
                                            {action.label}
                                        </div>
                                        <div className="text-sm text-slate-500 dark:text-slate-400">
                                            {action.description}
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <div className="p-4 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Twój prompt
                            </label>
                            <textarea
                                value={customPrompt}
                                onChange={(e) => setCustomPrompt(e.target.value)}
                                placeholder="Opisz, jaką treść chcesz wygenerować...

Przykłady:
• Napisz sekcję o kluczowych wyzwaniach w obszarze cyberbezpieczeństwa
• Stwórz porównanie z benchmarkiem branżowym
• Zaproponuj KPI dla planu transformacji"
                                className="w-full h-48 px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-navy-800 text-slate-900 dark:text-white resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <button
                            onClick={handleCustomGenerate}
                            disabled={!customPrompt.trim() || isGenerating !== null}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                        >
                            {isGenerating === 'custom' ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Generuję...
                                </>
                            ) : (
                                <>
                                    <Wand2 className="w-5 h-5" />
                                    Generuj treść
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>

            {/* Footer Tips */}
            <div className="p-4 bg-slate-50 dark:bg-navy-800 border-t border-slate-200 dark:border-slate-700">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                    <strong className="text-slate-700 dark:text-slate-300">Pro tip:</strong> AI generuje treści
                    w stylu raportów konsultingowych Big 4 (McKinsey, BCG) z użyciem Pyramid Principle.
                </div>
            </div>
        </div>
    );
};

export default AIAssistantPanel;
