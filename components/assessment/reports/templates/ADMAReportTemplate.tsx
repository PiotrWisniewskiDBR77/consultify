/**
 * ADMA 2.0 Report Template
 * 
 * Advanced Digital Maturity Assessment report visualization:
 * - 5 Pillars overview (Pentagon radar chart)
 * - 12 Dimensions detail
 * - Gap analysis and recommendations
 * - Legal notice (European Commission / Digital Innovation Hubs)
 */

import React from 'react';
import {
    Target,
    Cpu,
    Settings,
    Truck,
    Database,
    TrendingUp,
    AlertTriangle,
    BarChart3,
    CheckCircle,
    ArrowRight
} from 'lucide-react';
import { ADMAAssessmentData, ADMAPillarId } from '../../../../types';
import {
    ADMA_PILLARS,
    ADMA_DIMENSIONS,
    ADMA_MATURITY_LEVELS,
    ADMAPillarConfig
} from '../../../../services/admaStructure';

interface ADMAReportTemplateProps {
    data: ADMAAssessmentData;
    organizationName?: string;
    assessmentDate?: string;
    showLegalNotice?: boolean;
}

const getPillarIcon = (pillarId: ADMAPillarId) => {
    const icons: Record<ADMAPillarId, React.FC<{ className?: string; size?: number }>> = {
        strategy: Target,
        smart_products: Cpu,
        smart_operations: Settings,
        smart_supply: Truck,
        data_driven: Database,
    };
    return icons[pillarId] || Target;
};

const getLevelColor = (level: number): string => {
    if (level <= 1) return 'red';
    if (level <= 2) return 'orange';
    if (level <= 3) return 'yellow';
    if (level <= 4) return 'blue';
    return 'green';
};

const getLevelName = (level: number): string => {
    const maturityLevel = ADMA_MATURITY_LEVELS.find(l => l.level === Math.floor(level));
    return maturityLevel?.title || 'N/A';
};

export const ADMAReportTemplate: React.FC<ADMAReportTemplateProps> = ({
    data,
    organizationName = 'Organization',
    assessmentDate,
    showLegalNotice = true,
}) => {
    // Calculate pillar scores
    const pillarScores = (Object.keys(ADMA_PILLARS) as ADMAPillarId[]).map(pillarId => ({
        id: pillarId,
        config: ADMA_PILLARS[pillarId],
        score: data.pillars[pillarId]?.current || 0,
        target: data.pillars[pillarId]?.target || 0,
        gap: data.pillars[pillarId]?.gap || 0,
    }));

    // Get dimensions with gaps sorted by gap size
    const dimensionsWithGaps = ADMA_DIMENSIONS.map(dim => ({
        ...dim,
        current: data.dimensions[dim.id]?.current || 0,
        target: data.dimensions[dim.id]?.target || 0,
        gap: data.dimensions[dim.id]?.gap || 0,
    })).sort((a, b) => b.gap - a.gap);

    // Top priorities
    const topPriorities = dimensionsWithGaps.filter(d => d.gap >= 1).slice(0, 5);

    return (
        <div className="bg-white dark:bg-navy-950 min-h-full p-8 print:p-0">
            {/* Header */}
            <div className="border-b border-slate-200 dark:border-white/10 pb-8 mb-8">
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-navy-900 dark:text-white mb-2">
                            ADMA 2.0 Assessment Report
                        </h1>
                        <p className="text-lg text-slate-500">
                            Advanced Digital Maturity Assessment
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-lg font-semibold text-navy-900 dark:text-white">{organizationName}</p>
                        <p className="text-sm text-slate-500">
                            {assessmentDate || new Date().toLocaleDateString('pl-PL')}
                        </p>
                    </div>
                </div>
            </div>

            {/* Legal Notice */}
            {showLegalNotice && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-500/30 rounded-lg p-4 mb-8 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-800 dark:text-blue-200">
                        <strong>ADMA (Advanced Digital Maturity Assessment)</strong> jest narzędziem opracowanym przez{' '}
                        <strong>European Commission</strong> w ramach programu <strong>Digital Innovation Hubs</strong>.
                        Wykorzystanie w celach edukacyjnych. Oficjalna ocena wymaga współpracy z autoryzowanym DIH.
                    </div>
                </div>
            )}

            {/* Executive Summary */}
            <section className="mb-8">
                <h2 className="text-xl font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
                    <Target size={20} />
                    Podsumowanie Wykonawcze
                </h2>
                <div className="grid grid-cols-6 gap-4">
                    {/* Overall Score */}
                    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl p-4 text-center">
                        <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                            {data.overallMaturity?.toFixed(1) || '0.0'}
                        </div>
                        <div className="text-sm text-indigo-600/70">Overall / 5</div>
                        <div className="text-xs text-slate-500 mt-1">{getLevelName(data.overallMaturity || 0)}</div>
                    </div>
                    
                    {/* Pillar Scores */}
                    {pillarScores.map(pillar => {
                        const IconComponent = getPillarIcon(pillar.id);
                        return (
                            <div
                                key={pillar.id}
                                className={`bg-${pillar.config.color}-50 dark:bg-${pillar.config.color}-900/20 rounded-xl p-4 text-center`}
                            >
                                <div className={`w-8 h-8 mx-auto mb-2 rounded-lg bg-${pillar.config.color}-100 dark:bg-${pillar.config.color}-900/30 flex items-center justify-center`}>
                                    <IconComponent className={`w-4 h-4 text-${pillar.config.color}-600 dark:text-${pillar.config.color}-400`} size={16} />
                                </div>
                                <div className={`text-2xl font-bold text-${pillar.config.color}-600 dark:text-${pillar.config.color}-400`}>
                                    {pillar.score.toFixed(1)}
                                </div>
                                <div className={`text-xs text-${pillar.config.color}-600/70 truncate`}>{pillar.config.namePL}</div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* Five Pillars Detail */}
            <section className="mb-8">
                <h2 className="text-xl font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
                    <BarChart3 size={20} />
                    Ocena Pięciu Filarów
                </h2>
                <div className="space-y-4">
                    {pillarScores.map(pillar => {
                        const pillarDimensions = ADMA_DIMENSIONS.filter(d => d.pillar === pillar.id);
                        const IconComponent = getPillarIcon(pillar.id);
                        
                        return (
                            <div key={pillar.id} className="bg-slate-50 dark:bg-navy-900/50 rounded-xl p-4">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className={`w-10 h-10 rounded-lg bg-${pillar.config.color}-100 dark:bg-${pillar.config.color}-900/30 flex items-center justify-center`}>
                                        <IconComponent className={`w-5 h-5 text-${pillar.config.color}-600 dark:text-${pillar.config.color}-400`} />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-bold text-navy-900 dark:text-white">{pillar.config.name}</h3>
                                        <p className="text-xs text-slate-500">{pillar.config.namePL}</p>
                                    </div>
                                    <div className="text-right">
                                        <span className={`text-2xl font-bold text-${pillar.config.color}-600 dark:text-${pillar.config.color}-400`}>
                                            {pillar.score.toFixed(1)}
                                        </span>
                                        <span className="text-sm text-slate-400">/5</span>
                                    </div>
                                </div>
                                
                                {/* Progress bar */}
                                <div className="h-2 bg-slate-200 dark:bg-navy-800 rounded-full overflow-hidden mb-4">
                                    <div
                                        className={`h-full bg-${pillar.config.color}-500 rounded-full transition-all`}
                                        style={{ width: `${(pillar.score / 5) * 100}%` }}
                                    />
                                </div>
                                
                                {/* Dimensions for this pillar */}
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {pillarDimensions.map(dim => {
                                        const dimScore = data.dimensions[dim.id];
                                        return (
                                            <div key={dim.id} className="bg-white dark:bg-navy-950 rounded-lg p-3">
                                                <div className="text-sm font-medium text-navy-900 dark:text-white mb-1 truncate">
                                                    {dim.namePL}
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className={`text-lg font-bold text-${getLevelColor(dimScore?.current || 0)}-600`}>
                                                        {dimScore?.current || 0}
                                                    </span>
                                                    <span className="text-xs text-slate-500">
                                                        {getLevelName(dimScore?.current || 0)}
                                                    </span>
                                                </div>
                                                <div className="mt-2 h-1.5 bg-slate-200 dark:bg-navy-800 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full bg-${pillar.config.color}-500 rounded-full`}
                                                        style={{ width: `${((dimScore?.current || 0) / 5) * 100}%` }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* Gap Analysis */}
            <section className="mb-8">
                <h2 className="text-xl font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
                    <TrendingUp size={20} />
                    Analiza Luk - Top Priorytety
                </h2>
                <div className="bg-slate-50 dark:bg-navy-900/50 rounded-xl overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-slate-100 dark:bg-navy-800">
                                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Wymiar</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Filar</th>
                                <th className="text-center px-4 py-3 text-xs font-medium text-slate-500">Aktualny</th>
                                <th className="text-center px-4 py-3 text-xs font-medium text-slate-500">Cel</th>
                                <th className="text-center px-4 py-3 text-xs font-medium text-slate-500">Luka</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                            {dimensionsWithGaps.filter(d => d.gap > 0).slice(0, 10).map(dim => {
                                const pillarConfig = ADMA_PILLARS[dim.pillar];
                                return (
                                    <tr key={dim.id}>
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-navy-900 dark:text-white">{dim.namePL}</div>
                                            <div className="text-xs text-slate-500">{dim.name}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 text-xs rounded bg-${pillarConfig.color}-100 dark:bg-${pillarConfig.color}-900/30 text-${pillarConfig.color}-700 dark:text-${pillarConfig.color}-300`}>
                                                {pillarConfig.namePL}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`font-bold text-${getLevelColor(dim.current)}-600`}>
                                                {dim.current}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center text-slate-500">{dim.target}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded font-bold text-sm">
                                                -{dim.gap}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Recommendations */}
            <section className="mb-8">
                <h2 className="text-xl font-bold text-navy-900 dark:text-white mb-4">
                    Rekomendacje Transformacyjne
                </h2>
                <div className="space-y-3">
                    {topPriorities.map((dim, idx) => {
                        const pillarConfig = ADMA_PILLARS[dim.pillar];
                        const currentLevel = ADMA_MATURITY_LEVELS.find(l => l.level === Math.floor(dim.current));
                        const targetLevel = ADMA_MATURITY_LEVELS.find(l => l.level === Math.ceil(dim.target));
                        
                        return (
                            <div key={dim.id} className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-navy-900/50 rounded-lg">
                                <div className={`w-8 h-8 rounded-full bg-${pillarConfig.color}-100 dark:bg-${pillarConfig.color}-900/30 flex items-center justify-center shrink-0`}>
                                    <span className={`text-sm font-bold text-${pillarConfig.color}-600`}>{idx + 1}</span>
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-medium text-navy-900 dark:text-white flex items-center gap-2">
                                        {dim.namePL}
                                        <span className={`px-2 py-0.5 text-xs rounded bg-${pillarConfig.color}-100 text-${pillarConfig.color}-700`}>
                                            {pillarConfig.namePL}
                                        </span>
                                    </h4>
                                    <p className="text-sm text-slate-500 mt-1">
                                        <span className="inline-flex items-center gap-1">
                                            <span className={`font-medium text-${getLevelColor(dim.current)}-600`}>
                                                {currentLevel?.title || 'N/A'}
                                            </span>
                                            <ArrowRight size={14} className="text-slate-400" />
                                            <span className="font-medium text-green-600">
                                                {targetLevel?.title || 'N/A'}
                                            </span>
                                        </span>
                                    </p>
                                    {targetLevel?.characteristics && (
                                        <div className="mt-2 flex flex-wrap gap-1">
                                            {targetLevel.characteristics.slice(0, 3).map((char, i) => (
                                                <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded">
                                                    <CheckCircle size={10} />
                                                    {char}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-slate-400">Luka</div>
                                    <div className="text-lg font-bold text-red-600">-{dim.gap}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* Maturity Level Legend */}
            <section className="mb-8">
                <h2 className="text-xl font-bold text-navy-900 dark:text-white mb-4">
                    Poziomy Dojrzałości ADMA
                </h2>
                <div className="grid grid-cols-5 gap-2">
                    {ADMA_MATURITY_LEVELS.map(level => (
                        <div key={level.level} className="bg-slate-50 dark:bg-navy-900/50 rounded-lg p-3 text-center">
                            <div className={`text-2xl font-bold text-${getLevelColor(level.level)}-600 mb-1`}>
                                {level.level}
                            </div>
                            <div className="text-sm font-medium text-navy-900 dark:text-white mb-1">
                                {level.title}
                            </div>
                            <div className="text-xs text-slate-500 line-clamp-2">
                                {level.description}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-slate-200 dark:border-white/10 pt-4 text-center text-xs text-slate-400">
                <p>Raport wygenerowany przez Consultify • {new Date().toLocaleDateString('pl-PL')}</p>
                <p className="mt-1">ADMA 2.0 Assessment • {organizationName}</p>
            </footer>
        </div>
    );
};

export default ADMAReportTemplate;

