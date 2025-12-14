
import React from 'react';
import { MaturityLevel } from '../../types';
import { Check } from 'lucide-react';

interface LevelSelectorProps {
    levels: Record<string, string>; // "1": "Description"
    actual: number | undefined;
    target: number | undefined;
    onSelect: (type: 'actual' | 'target', level: number) => void;
}

export const LevelSelector: React.FC<LevelSelectorProps> = ({
    levels,
    actual,
    target,
    onSelect
}) => {
    return (
        <div className="space-y-3 relative">
            {/* Connecting Line */}
            <div className="absolute left-[27px] top-4 bottom-4 w-0.5 bg-white/5 -z-0"></div>

            {Object.entries(levels).map(([key, desc]) => {
                const levelNum = parseInt(key, 10);
                const isActual = actual === levelNum;
                const isTarget = target === levelNum;

                // Gap highlighting
                const isInGap = actual && target && levelNum > actual && levelNum < target;

                return (
                    <div
                        key={key}
                        className={`relative group flex items-start gap-4 p-3 rounded-xl border transition-all ${isActual || isTarget
                                ? 'bg-navy-900 border-white/10 shadow-lg'
                                : isInGap
                                    ? 'bg-navy-900/40 border-purple-500/10'
                                    : 'bg-transparent border-transparent hover:bg-white/5'
                            }`}
                    >
                        {/* Number Bubble */}
                        <div className={`shrink-0 w-14 h-14 rounded-full border-2 flex items-center justify-center text-xl font-bold bg-navy-950 z-10 transition-colors ${isActual
                                ? 'border-blue-500 text-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]'
                                : isTarget
                                    ? 'border-purple-500 text-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.5)]'
                                    : isInGap
                                        ? 'border-purple-500/30 text-purple-200/50'
                                        : 'border-white/10 text-slate-600'
                            }`}>
                            {levelNum}
                        </div>

                        {/* Content */}
                        <div className="flex-1 pt-1 min-w-0">
                            <div className={`text-lg font-medium transition-colors ${isActual || isTarget ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                                }`}>
                                {desc}
                            </div>
                        </div>

                        {/* Selection Controls */}
                        <div className="flex flex-col gap-2 shrink-0 pt-1">
                            {/* Actual Button */}
                            <button
                                onClick={() => onSelect('actual', levelNum)}
                                className={`px-3 py-1 text-xs font-bold rounded-full border transition-all flex items-center gap-1 ${isActual
                                        ? 'bg-blue-600 border-blue-500 text-white'
                                        : 'bg-navy-950 border-white/10 text-slate-500 hover:border-blue-500/50 hover:text-blue-400 opacity-0 group-hover:opacity-100'
                                    }`}
                            >
                                {isActual && <Check size={12} />}
                                ACTUAL
                            </button>

                            {/* Target Button */}
                            <button
                                onClick={() => onSelect('target', levelNum)}
                                className={`px-3 py-1 text-xs font-bold rounded-full border transition-all flex items-center gap-1 ${isTarget
                                        ? 'bg-purple-600 border-purple-500 text-white'
                                        : 'bg-navy-950 border-white/10 text-slate-500 hover:border-purple-500/50 hover:text-purple-400 opacity-0 group-hover:opacity-100'
                                    }`}
                            >
                                {isTarget && <Check size={12} />}
                                TARGET
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
