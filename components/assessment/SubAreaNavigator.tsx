
import React from 'react';
import { CheckCircle2, Circle } from 'lucide-react';

interface SubAreaNavigatorProps {
    areas: Record<string, { title: string }>;
    currentAreaKey: string;
    onSelect: (key: string) => void;
    scores: Record<string, number[]>; // [actual, target] for each area
}

export const SubAreaNavigator: React.FC<SubAreaNavigatorProps> = ({
    areas,
    currentAreaKey,
    onSelect,
    scores
}) => {
    return (
        <div className="w-64 bg-navy-950/30 border-r border-white/5 flex flex-col h-full shrink-0">
            <div className="p-4 border-b border-white/5">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Focus Areas</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {Object.entries(areas).map(([key, area]) => {
                    const areaScores = scores[key] || [0, 0];
                    const isCompleted = areaScores[0] > 0 && areaScores[1] > 0;
                    const isActive = key === currentAreaKey;

                    return (
                        <button
                            key={key}
                            onClick={() => onSelect(key)}
                            className={`w-full text-left px-3 py-3 rounded-lg flex items-center gap-3 transition-all ${isActive
                                    ? 'bg-blue-600/20 border border-blue-500/30 text-white'
                                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                                }`}
                        >
                            <div className={`shrink-0 ${isActive ? 'text-blue-400' : isCompleted ? 'text-green-500' : 'text-slate-600'
                                }`}>
                                {isCompleted ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className={`text-sm font-medium truncate ${isActive ? 'text-blue-100' : ''}`}>
                                    {area.title}
                                </div>
                                {isCompleted && !isActive && (
                                    <div className="text-[10px] text-green-500/80">Completed</div>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
