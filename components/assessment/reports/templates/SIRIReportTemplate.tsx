/**
 * SIRI Report Template
 *
 * Smart Industry Readiness Index report visualization:
 * - 3 Building Blocks overview
 * - 8 Dimensions detail
 * - Prioritisation Matrix heatmap
 * - Gap analysis and recommendations
 * - Legal notice
 */

import { AlertTriangle, BarChart3, ChevronRight, Cpu, Settings, Target, TrendingUp, Users } from 'lucide-react';
import React from 'react';

import {
    SIRI_BUILDING_BLOCKS,
    SIRI_DIMENSIONS,
    SIRI_MATURITY_LEVELS,
    SIRI_PRIORITISATION_AREAS,
} from '../../../../services/siriStructure';
import { SIRIAssessmentData } from '../../../../types';

// ============================================
// COLOR CLASSES HELPER (Tailwind requires full class names)
// ============================================

type ColorKey = 'blue' | 'green' | 'purple' | 'red' | 'orange' | 'yellow';

interface ColorClasses {
    bg50: string;
    bg100: string;
    bg500: string;
    bg900_20: string;
    bg900_30: string;
    text400: string;
    text600: string;
    text600_70: string;
}

const COLOR_CLASSES: Record<ColorKey, ColorClasses> = {
    blue: {
        bg50: 'bg-blue-50 dark:bg-blue-900/20',
        bg100: 'bg-blue-100 dark:bg-blue-900/30',
        bg500: 'bg-blue-500',
        bg900_20: 'bg-blue-900/20',
        bg900_30: 'bg-blue-900/30',
        text400: 'text-blue-400',
        text600: 'text-blue-600 dark:text-blue-400',
        text600_70: 'text-blue-600/70',
    },
    green: {
        bg50: 'bg-green-50 dark:bg-green-900/20',
        bg100: 'bg-green-100 dark:bg-green-900/30',
        bg500: 'bg-green-500',
        bg900_20: 'bg-green-900/20',
        bg900_30: 'bg-green-900/30',
        text400: 'text-green-400',
        text600: 'text-green-600 dark:text-green-400',
        text600_70: 'text-green-600/70',
    },
    purple: {
        bg50: 'bg-purple-50 dark:bg-purple-900/20',
        bg100: 'bg-purple-100 dark:bg-purple-900/30',
        bg500: 'bg-purple-500',
        bg900_20: 'bg-purple-900/20',
        bg900_30: 'bg-purple-900/30',
        text400: 'text-purple-400',
        text600: 'text-purple-600 dark:text-purple-400',
        text600_70: 'text-purple-600/70',
    },
    red: {
        bg50: 'bg-red-50 dark:bg-red-900/20',
        bg100: 'bg-red-100 dark:bg-red-900/30',
        bg500: 'bg-red-500',
        bg900_20: 'bg-red-900/20',
        bg900_30: 'bg-red-900/30',
        text400: 'text-red-400',
        text600: 'text-red-600 dark:text-red-400',
        text600_70: 'text-red-600/70',
    },
    orange: {
        bg50: 'bg-orange-50 dark:bg-orange-900/20',
        bg100: 'bg-orange-100 dark:bg-orange-900/30',
        bg500: 'bg-orange-500',
        bg900_20: 'bg-orange-900/20',
        bg900_30: 'bg-orange-900/30',
        text400: 'text-orange-400',
        text600: 'text-orange-600 dark:text-orange-400',
        text600_70: 'text-orange-600/70',
    },
    yellow: {
        bg50: 'bg-yellow-50 dark:bg-yellow-900/20',
        bg100: 'bg-yellow-100 dark:bg-yellow-900/30',
        bg500: 'bg-yellow-500',
        bg900_20: 'bg-yellow-900/20',
        bg900_30: 'bg-yellow-900/30',
        text400: 'text-yellow-400',
        text600: 'text-yellow-600 dark:text-yellow-400',
        text600_70: 'text-yellow-600/70',
    },
};

const getColorClasses = (color: string): ColorClasses => {
    return COLOR_CLASSES[color as ColorKey] || COLOR_CLASSES.blue;
};

const getLevelColorClasses = (level: number): ColorClasses => {
    if (level <= 1) return COLOR_CLASSES.red;
    if (level <= 2) return COLOR_CLASSES.orange;
    if (level <= 3) return COLOR_CLASSES.yellow;
    if (level <= 4) return COLOR_CLASSES.blue;
    return COLOR_CLASSES.green;
};

interface SIRIReportTemplateProps {
    data: SIRIAssessmentData;
    organizationName?: string;
    assessmentDate?: string;
    showLegalNotice?: boolean;
}

export const SIRIReportTemplate: React.FC<SIRIReportTemplateProps> = ({
    data,
    organizationName = 'Organization',
    assessmentDate,
    showLegalNotice = true,
}) => {
    // Calculate building block scores
    const blockScores = ['PROCESS', 'TECHNOLOGY', 'ORGANIZATION'].map((block) => ({
        id: block,
        config: SIRI_BUILDING_BLOCKS[block as keyof typeof SIRI_BUILDING_BLOCKS],
        score: data.buildingBlocks[block as keyof typeof data.buildingBlocks]?.score || 0,
        colorClasses: getColorClasses(SIRI_BUILDING_BLOCKS[block as keyof typeof SIRI_BUILDING_BLOCKS].color),
    }));

    // Get dimensions with gaps
    const dimensionsWithGaps = SIRI_DIMENSIONS.map((dim) => ({
        ...dim,
        current: data.dimensions[dim.id]?.current || 0,
        target: data.dimensions[dim.id]?.target || 0,
        gap: data.dimensions[dim.id]?.gap || 0,
    })).sort((a, b) => b.gap - a.gap);

    // Top priority areas
    const topPriorities = Object.entries(data.prioritisationMatrix || {})
        .sort(([, a], [, b]) => (b || 0) - (a || 0))
        .slice(0, 5);

    return (
        <div className="bg-white dark:bg-navy-950 min-h-full p-8 print:p-0">
            {/* Header */}
            <div className="border-b border-slate-200 dark:border-white/10 pb-8 mb-8">
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-navy-900 dark:text-white mb-2">
                            SIRI Assessment Report
                        </h1>
                        <p className="text-lg text-slate-500">Smart Industry Readiness Index</p>
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
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-500/30 rounded-lg p-4 mb-8 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-800 dark:text-amber-200">
                        <strong>SIRI (Smart Industry Readiness Index)</strong> jest narzędziem opracowanym przez{' '}
                        <strong>Singapore Economic Development Board (EDB)</strong> we współpracy z{' '}
                        <strong>TÜV SÜD</strong>. Wykorzystanie w celach edukacyjnych. Oficjalna certyfikacja wymaga
                        akredytowanego audytora.
                    </div>
                </div>
            )}

            {/* Executive Summary */}
            <section className="mb-8">
                <h2 className="text-xl font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
                    <Target size={20} />
                    Podsumowanie Wykonawcze
                </h2>
                <div className="grid grid-cols-4 gap-4">
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-center">
                        <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                            {data.overallScore?.toFixed(1) || '0.0'}
                        </div>
                        <div className="text-sm text-blue-600/70">Overall Score / 5</div>
                    </div>
                    {blockScores.map((block) => (
                        <div key={block.id} className={`${block.colorClasses.bg50} rounded-xl p-4 text-center`}>
                            <div className={`text-2xl font-bold ${block.colorClasses.text600}`}>
                                {block.score.toFixed(1)}
                            </div>
                            <div className={block.colorClasses.text600_70}>{block.config.name}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Building Blocks Detail */}
            <section className="mb-8">
                <h2 className="text-xl font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
                    <BarChart3 size={20} />
                    Building Blocks Assessment
                </h2>
                <div className="space-y-4">
                    {(['PROCESS', 'TECHNOLOGY', 'ORGANIZATION'] as const).map((blockId) => {
                        const config = SIRI_BUILDING_BLOCKS[blockId];
                        const colorClasses = getColorClasses(config.color);
                        const dims = SIRI_DIMENSIONS.filter((d) => d.buildingBlock === blockId);
                        const IconComponent = blockId === 'PROCESS' ? Settings : blockId === 'TECHNOLOGY' ? Cpu : Users;

                        return (
                            <div key={blockId} className="bg-slate-50 dark:bg-navy-900/50 rounded-xl p-4">
                                <div className="flex items-center gap-3 mb-4">
                                    <div
                                        className={`w-10 h-10 rounded-lg ${colorClasses.bg100} flex items-center justify-center`}
                                    >
                                        <IconComponent className={`w-5 h-5 ${colorClasses.text600}`} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-navy-900 dark:text-white">{config.name}</h3>
                                        <p className="text-xs text-slate-500">{config.namePL}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    {dims.map((dim) => {
                                        const score = data.dimensions[dim.id];
                                        const level = SIRI_MATURITY_LEVELS[Math.floor(score?.current || 0)];
                                        const levelColors = getLevelColorClasses(score?.current || 0);
                                        return (
                                            <div key={dim.id} className="bg-white dark:bg-navy-950 rounded-lg p-3">
                                                <div className="text-sm font-medium text-navy-900 dark:text-white mb-1">
                                                    {dim.name}
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className={`text-lg font-bold ${levelColors.text600}`}>
                                                        {score?.current || 0}
                                                    </span>
                                                    <span className="text-xs text-slate-500">{level?.title}</span>
                                                </div>
                                                <div className="mt-2 h-1.5 bg-slate-200 dark:bg-navy-800 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full ${colorClasses.bg500} rounded-full`}
                                                        style={{ width: `${((score?.current || 0) / 5) * 100}%` }}
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
                    Gap Analysis - Top Priorities
                </h2>
                <div className="bg-slate-50 dark:bg-navy-900/50 rounded-xl overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-slate-100 dark:bg-navy-800">
                                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Dimension</th>
                                <th className="text-center px-4 py-3 text-xs font-medium text-slate-500">Current</th>
                                <th className="text-center px-4 py-3 text-xs font-medium text-slate-500">Target</th>
                                <th className="text-center px-4 py-3 text-xs font-medium text-slate-500">Gap</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">
                                    Building Block
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                            {dimensionsWithGaps
                                .filter((d) => d.gap > 0)
                                .slice(0, 8)
                                .map((dim) => {
                                    const levelColors = getLevelColorClasses(dim.current);
                                    return (
                                        <tr key={dim.id}>
                                            <td className="px-4 py-3 font-medium text-navy-900 dark:text-white">
                                                {dim.name}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`${levelColors.text600} font-bold`}>
                                                    {dim.current}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center text-slate-500">{dim.target}</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded font-bold text-sm">
                                                    -{dim.gap}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-500">{dim.buildingBlock}</td>
                                        </tr>
                                    );
                                })}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Recommendations */}
            <section className="mb-8">
                <h2 className="text-xl font-bold text-navy-900 dark:text-white mb-4">Rekomendacje</h2>
                <div className="space-y-3">
                    {dimensionsWithGaps
                        .filter((d) => d.gap >= 2)
                        .slice(0, 5)
                        .map((dim, idx) => (
                            <div
                                key={dim.id}
                                className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-navy-900/50 rounded-lg"
                            >
                                <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                                    <span className="text-sm font-bold text-purple-600">{idx + 1}</span>
                                </div>
                                <div>
                                    <h4 className="font-medium text-navy-900 dark:text-white">Poprawa {dim.name}</h4>
                                    <p className="text-sm text-slate-500 mt-1">
                                        Aktualne poziom: {dim.current}/5 (Level:{' '}
                                        {SIRI_MATURITY_LEVELS[dim.current]?.title}). Rekomendowany cel: poziom{' '}
                                        {dim.target} ({SIRI_MATURITY_LEVELS[dim.target]?.title}).
                                    </p>
                                </div>
                            </div>
                        ))}
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-slate-200 dark:border-white/10 pt-4 text-center text-xs text-slate-400">
                <p>Raport wygenerowany przez Consultify • {new Date().toLocaleDateString('pl-PL')}</p>
                <p className="mt-1">SIRI Assessment • {organizationName}</p>
            </footer>
        </div>
    );
};

export default SIRIReportTemplate;
