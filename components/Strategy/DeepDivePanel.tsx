
import React from 'react';
import { Target, ShieldAlert, Zap, TrendingUp, AlertTriangle } from 'lucide-react';
import { ScenarioArchetype } from '../../data/transformationScenarios';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from 'react-i18next';

interface DeepDivePanelProps {
    scenario: ScenarioArchetype;
    isRecommended: boolean;
}

export const DeepDivePanel: React.FC<DeepDivePanelProps> = ({ scenario, isRecommended }) => {
    const { t: translate } = useTranslation();
    const t = translate('transformationScenarios', { returnObjects: true }) as any;

    //@ts-ignore
    const sTexts = t.scenarios[scenario.id];

    // Helpers to fallback to english or default
    const getName = () => sTexts?.name || scenario.name;
    const getDesc = () => sTexts?.description || scenario.description;
    const getGains = () => (sTexts?.gains || scenario.gains) as string[];
    const getSacrifices = () => (sTexts?.sacrifices || scenario.sacrifices) as string[];

    return (
        <div className="h-full flex flex-col bg-white dark:bg-navy-800 rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden shadow-2xl shadow-slate-200/50 dark:shadow-black/20">
            {/* Header - Sticky */}
            <div className="p-6 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5 backdrop-blur-md">
                <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-xl font-bold text-navy-900 dark:text-white">{t.deepDive.title}</h3>
                    {isRecommended && (
                        <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 text-[10px] font-bold uppercase rounded-full tracking-wide border border-purple-200 dark:border-purple-500/30">
                            {t.recommended}
                        </span>
                    )}
                </div>
                <p className="text-slate-500 text-sm line-clamp-1">
                    {(t.deepDive.subtitle)?.replace('{name}', getName())}
                </p>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
                {/* 1. What it means */}
                <section>
                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Target size={16} /> {t.deepDive.definition}
                    </h4>
                    <div className="bg-white dark:bg-navy-800 p-4 rounded-xl border border-slate-200 dark:border-white/5 shadow-sm">
                        <p className="text-navy-900 dark:text-slate-200 leading-relaxed text-sm text-justify">
                            {getDesc()}
                        </p>
                    </div>
                </section>

                {/* 2. AI Explainability (If recommended) */}
                {isRecommended && (
                    <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <h4 className="text-sm font-bold text-purple-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <Zap size={16} /> {t.deepDive.aiReasoning}
                        </h4>
                        <div className="bg-purple-50 dark:bg-purple-900/10 p-4 rounded-xl border border-purple-100 dark:border-purple-900/20 space-y-3">
                            <div className="flex gap-3">
                                <ShieldAlert size={18} className="text-purple-400 shrink-0 mt-0.5" />
                                <p className="text-sm text-slate-600 dark:text-slate-300">
                                    Addresses key hidden risks related to <strong className="text-purple-700 dark:text-purple-300">process fragmentation</strong> and <strong className="text-purple-700 dark:text-purple-300">compliance</strong> found in your profile.
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <TrendingUp size={18} className="text-purple-400 shrink-0 mt-0.5" />
                                <p className="text-sm text-slate-600 dark:text-slate-300">
                                    Leverages your organizational strength in <strong className="text-purple-700 dark:text-purple-300">engineering culture</strong> to drive the change via the core team.
                                </p>
                            </div>
                        </div>
                    </section>
                )}

                {/* 3. Trade-offs */}
                <section>
                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <AlertTriangle size={16} /> {t.deepDive.tradeoffs}
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-green-50 dark:bg-green-900/10 p-4 rounded-xl border border-green-100 dark:border-green-900/20">
                            <div className="text-xs font-bold text-green-700 dark:text-green-400 mb-2 uppercase">{t.deepDive.gains}</div>
                            <ul className="space-y-2">
                                {getGains().map((gain, i) => (
                                    <li key={i} className="flex gap-2 text-xs text-navy-900 dark:text-white">
                                        <span className="text-green-500 font-bold">+</span>
                                        {gain}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border border-red-100 dark:border-red-900/20">
                            <div className="text-xs font-bold text-red-700 dark:text-red-400 mb-2 uppercase">{t.deepDive.sacrifices}</div>
                            <ul className="space-y-2">
                                {getSacrifices().map((sac, i) => (
                                    <li key={i} className="flex gap-2 text-xs text-navy-900 dark:text-white">
                                        <span className="text-red-500 font-bold">-</span>
                                        {sac}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </section>

                {/* 4. Organizational Impact */}
                <section>
                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">{t.deepDive.impact}</h4>
                    <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-white/5 divide-y divide-slate-100 dark:divide-white/5">
                        {Object.entries(scenario.impact).map(([domain, impact]) => (
                            <div key={domain} className="p-3 flex justify-between items-center text-sm">
                                <span className="text-slate-500 capitalize">{domain}</span>
                                <span className="font-medium text-navy-900 dark:text-white">{impact}</span>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
};
