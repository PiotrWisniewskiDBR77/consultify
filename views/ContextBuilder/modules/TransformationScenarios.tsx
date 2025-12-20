
import React, { useState, useEffect } from 'react';
import { SCENARIOS, recommendScenario } from '../../../data/transformationScenarios';
import { ScenarioCard } from '../../../components/Strategy/ScenarioCard';
import { DeepDivePanel } from '../../../components/Strategy/DeepDivePanel';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../../store/useAppStore';
import { useContextBuilderStore } from '../../../store/useContextBuilderStore';
import { BrainCircuit, X, ArrowRight } from 'lucide-react';

interface TransformationScenariosProps {
    onSelectScenario: (scenarioId: string) => void;
    currentScenarioId?: string;
}

export const TransformationScenarios: React.FC<TransformationScenariosProps> = ({
    onSelectScenario,
    currentScenarioId
}) => {
    const { fullSessionData, currentUser } = useAppStore();

    // Derived State
    const { synthesis, challenges, companyProfile } = useContextBuilderStore();
    const { t: translate } = useTranslation();
    const t = translate('transformationScenarios', { returnObjects: true }) as any;

    const recommendedId = recommendScenario(challenges.declaredChallenges, companyProfile);

    // State for viewing details (Modal)
    const [viewedScenarioId, setViewedScenarioId] = useState<string | null>(null);

    const [selectedId, setSelectedId] = useState<string | null>(currentScenarioId || null);

    // Update selection if prop changes
    useEffect(() => {
        if (currentScenarioId) {
            setSelectedId(currentScenarioId);
        }
    }, [currentScenarioId]);

    const viewedScenario = SCENARIOS.find(s => s.id === viewedScenarioId);

    // Translation helper
    const getScenarioText = (id: string, field: 'name' | 'narrative') => {
        const sTexts = t.scenarios[id as keyof typeof t.scenarios];
        if (!sTexts) return '';

        return sTexts[field];
    };

    const handleConfirm = (id: string) => {
        setSelectedId(id);
        onSelectScenario(id);
        setViewedScenarioId(null); // Close modal
    };

    const recName = recommendedId ? getScenarioText(recommendedId, 'name') : '';

    return (
        <div className="flex flex-col h-full space-y-6 pb-20">
            {/* Top Banner: AI Recommendation */}
            <div className="relative z-20 bg-gradient-to-r from-purple-50 to-white dark:from-purple-900/10 dark:to-navy-900 p-6 rounded-2xl border border-purple-100 dark:border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 shadow-sm">
                <div className="flex gap-4 items-center">
                    <div className="w-12 h-12 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-lg shadow-purple-900/20">
                        <BrainCircuit size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-navy-900 dark:text-white text-lg">
                            {t.banner.title}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-2xl mt-1">
                            {t.banner.subtitle.replace('{count}', challenges.declaredChallenges.length.toString()).replace('{name}', recName)}
                            <strong className="text-purple-600 dark:text-purple-400 ml-1">
                                {recName}
                            </strong>
                        </p>
                    </div>
                </div>
            </div>

            {/* Main Grid Content */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {SCENARIOS.map(scenario => (
                    <ScenarioCard
                        key={scenario.id}
                        scenario={scenario}
                        isRecommended={scenario.id === recommendedId}
                        isSelected={scenario.id === selectedId}
                        onClick={() => setViewedScenarioId(scenario.id)}
                    />
                ))}
            </div>

            {/* Detail Modal */}
            {viewedScenarioId && viewedScenario && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-navy-900 w-full max-w-5xl h-[85vh] rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">

                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
                            <div>
                                <h2 className="text-2xl font-bold text-navy-900 dark:text-white flex items-center gap-3">
                                    {getScenarioText(viewedScenario.id, 'name')}
                                    {viewedScenario.id === recommendedId && (
                                        <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-600 text-xs font-bold uppercase rounded-full border border-purple-200 dark:border-purple-500/30">
                                            {t.recommended}
                                        </span>
                                    )}
                                </h2>
                                <p className="text-slate-500 italic mt-1">"{getScenarioText(viewedScenario.id, 'narrative')}"</p>
                            </div>
                            <button
                                onClick={() => setViewedScenarioId(null)}
                                className="p-2 hover:bg-slate-200 dark:hover:bg-white/10 rounded-full transition-colors text-slate-500"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Modal Body (Deep Dive) */}
                        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-navy-950">
                            <div className="max-w-4xl mx-auto py-8 px-6">
                                <DeepDivePanel
                                    scenario={viewedScenario}
                                    isRecommended={viewedScenario.id === recommendedId}
                                />
                            </div>
                        </div>

                        {/* Modal Footer (Actions) */}
                        <div className="p-6 border-t border-slate-100 dark:border-white/5 bg-white dark:bg-navy-900 flex justify-end gap-4">
                            <button
                                onClick={() => setViewedScenarioId(null)}
                                className="px-6 py-3 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors"
                            >
                                {t.cancel}
                            </button>
                            <button
                                onClick={() => handleConfirm(viewedScenario.id)}
                                className="group flex items-center gap-2 px-8 py-3 bg-navy-900 dark:bg-purple-600 text-white rounded-xl hover:bg-navy-800 dark:hover:bg-purple-500 transition-all font-bold shadow-lg shadow-navy-900/20 dark:shadow-purple-900/40"
                            >
                                {selectedId === viewedScenario.id ? t.selected : t.select}
                                {selectedId !== viewedScenario.id && <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
