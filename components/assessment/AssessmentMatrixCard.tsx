import React from 'react';
import { ArrowRight, Trophy, AlertCircle, Target, CheckCircle2 } from 'lucide-react';
import { DRDArea } from '../../services/drdStructure';
import { getMatrixCellClasses, getScoreBadgeClasses, getLegendDotClasses } from '../../utils/assessmentColors';

interface AssessmentMatrixCardProps {
    title: string;
    icon?: React.ReactNode;
    areas: DRDArea[];
    scores?: Record<string, number[]>; // areaId -> [actual, target]
    actual: number; // Avg for header
    target: number; // Avg for header
    onNavigate?: () => void;
}

export const AssessmentMatrixCard: React.FC<AssessmentMatrixCardProps> = ({
    title,
    icon,
    areas,
    scores = {},
    actual,
    target,
    onNavigate
}) => {
    // Calculate total gap for this axis
    const gap = Math.max(0, target - actual);

    // Determine max level for this axis (usually 5, but check areas)
    // If any area has a level 7 defined, use 7.
    // We can check the first area's levels length or assume standard 5 unless it's specific axes.
    // For safety, let's find the max level defined in the structure for these areas.
    const maxLevel = React.useMemo(() => {
        let max = 5;
        areas.forEach(a => {
            if (a.levels.some(l => l.level > 5)) max = 7;
        });
        return max;
    }, [areas]);

    // Generate rows in descending order (e.g. 5, 4, 3, 2, 1)
    const rows = Array.from({ length: maxLevel }, (_, i) => maxLevel - i);

    return (
        <div className="bg-white dark:bg-navy-950/30 border border-slate-200 dark:border-white/5 rounded-xl p-6 hover:shadow-md dark:hover:bg-navy-950/50 transition-all flex flex-col h-full group">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    {icon && <div className="p-2 bg-slate-100 dark:bg-white/5 rounded-lg text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{icon}</div>}
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-lg font-bold text-navy-900 dark:text-white leading-none">{title}</h3>
                            <div className="px-2 py-0.5 rounded bg-blue-600 text-white text-xs font-bold shadow-[0_0_10px_rgba(37,99,235,0.3)]">
                                {actual.toFixed(1)}
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span>Gap Points:</span>
                            <span className={`font-bold ${gap > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                {gap > 0 ? `-${gap.toFixed(1)}` : 'Optimized'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-400">Avg Actual</span>
                        <div className={getScoreBadgeClasses('actual')}>
                            {actual.toFixed(1)}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-500 dark:text-slate-400">Target</span>
                        <div className={getScoreBadgeClasses('target')}>
                            {target.toFixed(1)}
                        </div>
                    </div>
                </div>
            </div>

            {/* Matrix Table */}
            <div className="overflow-x-auto pb-2">
                <div
                    className="grid gap-2 min-w-[800px]"
                    style={{
                        gridTemplateColumns: `auto repeat(${areas.length}, minmax(140px, 1fr))`
                    }}
                >
                    {/* Header Row (Optional - maybe just Area names at bottom is better as per design? 
                        Design shows Side Labels (Levels) and Bottom Labels (Areas). 
                        Let's render the grid content first.
                    */}

                    {rows.map(level => (
                        <React.Fragment key={level}>
                            {/* Level Label Column */}
                            <div className="flex items-center justify-start px-4 py-2 bg-purple-100 dark:bg-purple-900/40 border border-purple-200 dark:border-purple-500/30 rounded text-xs font-bold text-purple-800 dark:text-white min-h-[60px]">
                                {level}. Poziom {level === 5 ? 'ekspert' : level === 4 ? 'interaktywny' : level === 3 ? 'zaawansowany' : level === 2 ? 'średni' : 'podstawowy'}
                                {/* Note: We should probably map these generic names or use data if available. For now hardcoded polish mapping relative to standard 1-5 */}
                            </div>

                            {/* Area Cells for this Level */}
                            {areas.map(area => {
                                const areaId = area.id;
                                const areaActual = scores?.[areaId]?.[0] || 0;
                                const areaTarget = scores?.[areaId]?.[1] || 0;

                                // Bitwise check for level presence
                                const levelBit = 1 << (level - 1);
                                const isActual = (areaActual & levelBit) !== 0;
                                const isTarget = (areaTarget & levelBit) !== 0;

                                // Find title for this level from area data
                                const levelInfo = area.levels.find(l => l.level === level);

                                return (
                                    <div
                                        key={`${areaId}-${level}`}
                                        className={`relative p-3 rounded border text-[10px] flex items-center justify-center text-center transition-all ${getMatrixCellClasses(isActual, isTarget)}`}
                                    >
                                        <span className="line-clamp-4 font-medium leading-tight">
                                            {levelInfo?.title || "Brak opisu"}
                                        </span>

                                        {/* Markers */}
                                        {isActual && (
                                            <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-white shadow-sm" title="Obecny poziom" />
                                        )}
                                        {isTarget && !isActual && (
                                            <div className="absolute top-1 right-1 w-2 h-2 rounded-full border border-purple-400" title="Cel" />
                                        )}
                                    </div>
                                );
                            })}
                        </React.Fragment>
                    ))}

                    {/* Bottom Header: Area Names */}
                    {/* Empty cell for Y-axis column */}
                    <div className="p-4 flex items-center justify-center font-bold text-sm text-purple-900 dark:text-white bg-purple-200 dark:bg-purple-900/80 rounded border border-purple-300 dark:border-purple-500/50">
                        Poziom
                    </div>
                    {/* Area Headers */}
                    {areas.map(area => (
                        <div key={`header-${area.id}`} className="bg-purple-100 dark:bg-purple-900/60 border border-purple-200 dark:border-purple-500/30 p-2 rounded flex flex-col items-center justify-center min-h-[50px]">
                            <span className="text-[10px] font-bold text-purple-500 dark:text-slate-300 mb-1">{area.id}</span>
                            <span className="text-xs font-bold text-purple-900 dark:text-white text-center leading-tight">{area.name}</span>
                        </div>
                    ))}
                </div>

                {/* Footer Action */}
                <div className="mt-8 pt-4 border-t border-slate-200 dark:border-white/5 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                            {areas.length} Areas Evaluated
                        </span>
                        {/* Legend */}
                        <div className="flex gap-3 text-[10px]">
                            <div className="flex items-center gap-1.5">
                                <span className={getLegendDotClasses('actual')}></span>
                                <span className="text-slate-500 dark:text-slate-300">Aktualny</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className={getLegendDotClasses('target')}></span>
                                <span className="text-slate-500 dark:text-slate-300">Cel</span>
                            </div>
                        </div>
                    </div>

                    {onNavigate && (
                        <button
                            onClick={onNavigate}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-white flex items-center gap-1 transition-colors group/btn font-medium"
                        >
                            Deep Dive <ArrowRight size={12} className="group-hover/btn:translate-x-0.5 transition-transform" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

