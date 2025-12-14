
import React from 'react';
import { BrainCircuit, Check } from 'lucide-react';
import { ScenarioArchetype } from '../../data/transformationScenarios';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from 'react-i18next';

interface ScenarioCardProps {
    scenario: ScenarioArchetype;
    isRecommended: boolean;
    isSelected: boolean;
    onClick: () => void;
}

const VisualScale = ({ value, colorClass }: { value: number; colorClass: string }) => (
    <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
            <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full ${i <= value ? colorClass : 'bg-slate-200 dark:bg-white/10'}`}
            />
        ))}
    </div>
);

export const ScenarioCard: React.FC<ScenarioCardProps> = ({ scenario, isRecommended, isSelected, onClick }) => {
    const Icon = scenario.icon;
    const { t: translate } = useTranslation();
    const t = translate('transformationScenarios', { returnObjects: true }) as any;

    //@ts-ignore
    const name = t.scenarios[scenario.id]?.name || scenario.name;
    //@ts-ignore
    const narrative = t.scenarios[scenario.id]?.narrative || scenario.narrative;
    const recommendedText = t.recommended;

    return (
        <div
            onClick={onClick}
            className={`
                relative p-5 rounded-2xl border-2 transition-all duration-300 cursor-pointer group min-w-[280px] w-[280px] snap-center
                flex flex-col justify-between h-[380px]
                ${isSelected
                    ? 'border-purple-600 bg-white dark:bg-navy-800 shadow-xl shadow-purple-900/20 scale-105 z-10'
                    : 'border-slate-200 dark:border-white/5 bg-white/50 dark:bg-navy-900/50 hover:border-slate-300 dark:hover:border-white/20 hover:bg-white dark:hover:bg-navy-800 hover:shadow-lg opacity-80 hover:opacity-100 scale-100'}
            `}
        >
            {isRecommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-purple-600 text-white text-[10px] font-bold uppercase tracking-wide rounded-full shadow-lg shadow-purple-900/40 flex items-center gap-1 z-20 whitespace-nowrap border border-purple-400">
                    <BrainCircuit size={12} />
                    {recommendedText}
                </div>
            )}

            <div>
                <div className="flex justify-center mb-6 mt-4">
                    <div className={`
                        w-16 h-16 rounded-2xl flex items-center justify-center transition-colors duration-300
                        ${isSelected
                            ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300'
                            : 'bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400 group-hover:bg-purple-50 group-hover:text-purple-600 dark:group-hover:bg-purple-900/20 dark:group-hover:text-purple-300'}
                    `}>
                        <Icon size={32} />
                    </div>
                </div>

                <div className="text-center mb-4">
                    <h4 className={`font-bold text-lg mb-2 leading-tight transition-colors ${isSelected ? 'text-navy-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                        {name}
                    </h4>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 italic min-h-[40px] px-2">
                        "{narrative}"
                    </p>
                </div>

                <div className="flex flex-wrap justify-center gap-1.5 mb-2">
                    {scenario.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="px-2 py-1 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 text-slate-500 dark:text-slate-400 text-[9px] font-bold uppercase tracking-wider rounded-md">
                            {tag}
                        </span>
                    ))}
                </div>
            </div>

            <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5 -mx-5 -mb-5 px-5 py-3 rounded-b-2xl">
                <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-bold text-[10px] uppercase">Tempo</span>
                    <VisualScale value={scenario.tempo} colorClass={isSelected ? "bg-purple-500" : "bg-slate-400"} />
                </div>
                <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-bold text-[10px] uppercase">Ambition</span>
                    <VisualScale value={scenario.ambition} colorClass={isSelected ? "bg-purple-500" : "bg-slate-400"} />
                </div>
                <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-bold text-[10px] uppercase">Risk</span>
                    <VisualScale value={scenario.risk} colorClass={isSelected ? "bg-purple-500" : "bg-slate-400"} />
                </div>
            </div>

            {isSelected && (
                <div className="absolute top-3 right-3 text-purple-600 dark:text-purple-400 animate-in fade-in zoom-in duration-300">
                    <div className="bg-white dark:bg-navy-900 rounded-full p-1 shadow-sm">
                        <Check size={16} />
                    </div>
                </div>
            )}
        </div>
    );
};
