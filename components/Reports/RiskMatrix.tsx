/**
 * RiskMatrix
 * 
 * 2x2 quadrant risk matrix (Impact x Probability):
 * - Watch / Mitigate / Contingency / Avoid quadrants
 * - Draggable items between quadrants
 * - Color-coded severity
 */

import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AlertTriangle,
    Shield,
    Eye,
    Zap,
    X,
    GripVertical,
    Plus
} from 'lucide-react';

interface RiskItem {
    id: string;
    title: string;
    titlePl?: string;
    description?: string;
    descriptionPl?: string;
    impact: 'low' | 'high';
    probability: 'low' | 'high';
    axis?: string;
}

interface RiskMatrixProps {
    risks?: RiskItem[];
    editable?: boolean;
    onRiskMove?: (riskId: string, newImpact: 'low' | 'high', newProbability: 'low' | 'high') => void;
    onRiskAdd?: (risk: Omit<RiskItem, 'id'>) => void;
    onRiskRemove?: (riskId: string) => void;
    className?: string;
}

// Quadrant configuration
const QUADRANTS = {
    watch: {
        impact: 'low' as const,
        probability: 'low' as const,
        label: 'Watch',
        labelPl: 'Monitoruj',
        description: 'Low impact, low probability',
        descriptionPl: 'Niski wpływ, niskie prawdopodobieństwo',
        color: '#10b981',
        bgColor: '#d1fae5',
        darkBgColor: 'rgba(16, 185, 129, 0.1)',
        icon: Eye
    },
    mitigate: {
        impact: 'low' as const,
        probability: 'high' as const,
        label: 'Mitigate',
        labelPl: 'Łagodź',
        description: 'Low impact, high probability',
        descriptionPl: 'Niski wpływ, wysokie prawdopodobieństwo',
        color: '#f59e0b',
        bgColor: '#fef3c7',
        darkBgColor: 'rgba(245, 158, 11, 0.1)',
        icon: Shield
    },
    contingency: {
        impact: 'high' as const,
        probability: 'low' as const,
        label: 'Contingency',
        labelPl: 'Plan awaryjny',
        description: 'High impact, low probability',
        descriptionPl: 'Wysoki wpływ, niskie prawdopodobieństwo',
        color: '#8b5cf6',
        bgColor: '#ede9fe',
        darkBgColor: 'rgba(139, 92, 246, 0.1)',
        icon: Zap
    },
    avoid: {
        impact: 'high' as const,
        probability: 'high' as const,
        label: 'Avoid',
        labelPl: 'Unikaj',
        description: 'High impact, high probability',
        descriptionPl: 'Wysoki wpływ, wysokie prawdopodobieństwo',
        color: '#ef4444',
        bgColor: '#fee2e2',
        darkBgColor: 'rgba(239, 68, 68, 0.1)',
        icon: AlertTriangle
    }
};

// Default transformation risks
const DEFAULT_RISKS: RiskItem[] = [
    {
        id: 'r1',
        title: 'Data Quality Issues',
        titlePl: 'Problemy z jakością danych',
        description: 'Incomplete or inconsistent data may affect AI initiatives',
        descriptionPl: 'Niekompletne lub niespójne dane mogą wpłynąć na inicjatywy AI',
        impact: 'high',
        probability: 'high',
        axis: 'dataManagement'
    },
    {
        id: 'r2',
        title: 'Change Resistance',
        titlePl: 'Opór przed zmianą',
        description: 'Employees may resist new digital processes',
        descriptionPl: 'Pracownicy mogą opierać się nowym procesom cyfrowym',
        impact: 'high',
        probability: 'high',
        axis: 'culture'
    },
    {
        id: 'r3',
        title: 'Cybersecurity Breach',
        titlePl: 'Naruszenie cyberbezpieczeństwa',
        description: 'Potential security vulnerabilities during transformation',
        descriptionPl: 'Potencjalne luki w zabezpieczeniach podczas transformacji',
        impact: 'high',
        probability: 'low',
        axis: 'cybersecurity'
    },
    {
        id: 'r4',
        title: 'Skill Gaps',
        titlePl: 'Luki kompetencyjne',
        description: 'Lack of digital skills in the workforce',
        descriptionPl: 'Brak umiejętności cyfrowych wśród pracowników',
        impact: 'low',
        probability: 'high',
        axis: 'culture'
    },
    {
        id: 'r5',
        title: 'Technology Lock-in',
        titlePl: 'Uzależnienie od technologii',
        description: 'Vendor dependency limiting future flexibility',
        descriptionPl: 'Zależność od dostawcy ograniczająca przyszłą elastyczność',
        impact: 'low',
        probability: 'low',
        axis: 'processes'
    }
];

export const RiskMatrix: React.FC<RiskMatrixProps> = ({
    risks = DEFAULT_RISKS,
    editable = false,
    onRiskMove,
    onRiskAdd,
    onRiskRemove,
    className = ''
}) => {
    const { i18n } = useTranslation();
    const isPolish = i18n.language === 'pl';

    const [draggedRisk, setDraggedRisk] = useState<string | null>(null);
    const [selectedRisk, setSelectedRisk] = useState<RiskItem | null>(null);

    // Group risks by quadrant
    const risksByQuadrant = useMemo(() => {
        const grouped: Record<string, RiskItem[]> = {
            watch: [],
            mitigate: [],
            contingency: [],
            avoid: []
        };

        risks.forEach(risk => {
            const quadrantKey = Object.entries(QUADRANTS).find(
                ([_, config]) => config.impact === risk.impact && config.probability === risk.probability
            )?.[0];
            if (quadrantKey) {
                grouped[quadrantKey].push(risk);
            }
        });

        return grouped;
    }, [risks]);

    // Summary stats
    const stats = useMemo(() => ({
        total: risks.length,
        critical: risksByQuadrant.avoid.length,
        high: risksByQuadrant.mitigate.length + risksByQuadrant.contingency.length,
        low: risksByQuadrant.watch.length
    }), [risks, risksByQuadrant]);

    // Handle drag start
    const handleDragStart = (riskId: string) => {
        if (!editable) return;
        setDraggedRisk(riskId);
    };

    // Handle drop
    const handleDrop = (impact: 'low' | 'high', probability: 'low' | 'high') => {
        if (!editable || !draggedRisk) return;
        onRiskMove?.(draggedRisk, impact, probability);
        setDraggedRisk(null);
    };

    return (
        <div className={`space-y-6 ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-navy-900 dark:text-white">
                        {isPolish ? 'Macierz Ryzyk Transformacji' : 'Transformation Risk Matrix'}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        {isPolish ? 'Wpływ vs Prawdopodobieństwo' : 'Impact vs Probability'}
                    </p>
                </div>

                {/* Summary badges */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 dark:bg-red-500/20 rounded-full">
                        <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                        <span className="text-sm font-medium text-red-700 dark:text-red-300">
                            {stats.critical} {isPolish ? 'krytycznych' : 'critical'}
                        </span>
                    </div>
                    <div className="px-3 py-1.5 bg-slate-100 dark:bg-white/5 rounded-full">
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                            {stats.total} {isPolish ? 'ryzyk' : 'risks'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Matrix grid */}
            <div className="relative">
                {/* Axis labels */}
                <div className="absolute -left-20 top-1/2 -translate-y-1/2 -rotate-90 text-sm font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {isPolish ? 'WPŁYW →' : 'IMPACT →'}
                </div>
                <div className="absolute left-1/2 -bottom-8 -translate-x-1/2 text-sm font-medium text-slate-500 dark:text-slate-400">
                    {isPolish ? 'PRAWDOPODOBIEŃSTWO →' : 'PROBABILITY →'}
                </div>

                {/* Grid */}
                <div className="grid grid-cols-2 gap-2 ml-8">
                    {/* High Impact row */}
                    {(['contingency', 'avoid'] as const).map((quadrantKey) => {
                        const config = QUADRANTS[quadrantKey];
                        const quadrantRisks = risksByQuadrant[quadrantKey];
                        const Icon = config.icon;

                        return (
                            <div
                                key={quadrantKey}
                                className={`
                                    min-h-[200px] p-4 rounded-xl border-2 transition-all
                                    ${draggedRisk ? 'border-dashed' : 'border-solid'}
                                `}
                                style={{ 
                                    backgroundColor: config.bgColor,
                                    borderColor: config.color + '40'
                                }}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={() => handleDrop(config.impact, config.probability)}
                            >
                                {/* Quadrant header */}
                                <div className="flex items-center gap-2 mb-3">
                                    <Icon className="w-5 h-5" style={{ color: config.color }} />
                                    <span className="font-semibold" style={{ color: config.color }}>
                                        {isPolish ? config.labelPl : config.label}
                                    </span>
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/50 dark:bg-white/10" style={{ color: config.color }}>
                                        {quadrantRisks.length}
                                    </span>
                                </div>

                                {/* Risk items */}
                                <div className="space-y-2">
                                    {quadrantRisks.map((risk) => (
                                        <motion.div
                                            key={risk.id}
                                            layoutId={risk.id}
                                            draggable={editable}
                                            onDragStart={() => handleDragStart(risk.id)}
                                            onClick={() => setSelectedRisk(risk)}
                                            className={`
                                                p-3 bg-white dark:bg-navy-800 rounded-lg shadow-sm 
                                                cursor-pointer hover:shadow-md transition-shadow
                                                ${draggedRisk === risk.id ? 'opacity-50' : ''}
                                            `}
                                        >
                                            <div className="flex items-start gap-2">
                                                {editable && (
                                                    <GripVertical className="w-4 h-4 text-slate-400 mt-0.5 cursor-grab" />
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-navy-900 dark:text-white truncate">
                                                        {isPolish && risk.titlePl ? risk.titlePl : risk.title}
                                                    </p>
                                                    {risk.axis && (
                                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                                            {risk.axis}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>

                                {/* Empty state */}
                                {quadrantRisks.length === 0 && (
                                    <div className="flex items-center justify-center h-20 text-sm text-slate-400 dark:text-slate-500">
                                        {editable ? (isPolish ? 'Przeciągnij tutaj' : 'Drop here') : (isPolish ? 'Brak ryzyk' : 'No risks')}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Low Impact row */}
                    {(['watch', 'mitigate'] as const).map((quadrantKey) => {
                        const config = QUADRANTS[quadrantKey];
                        const quadrantRisks = risksByQuadrant[quadrantKey];
                        const Icon = config.icon;

                        return (
                            <div
                                key={quadrantKey}
                                className={`
                                    min-h-[200px] p-4 rounded-xl border-2 transition-all
                                    ${draggedRisk ? 'border-dashed' : 'border-solid'}
                                `}
                                style={{ 
                                    backgroundColor: config.bgColor,
                                    borderColor: config.color + '40'
                                }}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={() => handleDrop(config.impact, config.probability)}
                            >
                                {/* Quadrant header */}
                                <div className="flex items-center gap-2 mb-3">
                                    <Icon className="w-5 h-5" style={{ color: config.color }} />
                                    <span className="font-semibold" style={{ color: config.color }}>
                                        {isPolish ? config.labelPl : config.label}
                                    </span>
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/50 dark:bg-white/10" style={{ color: config.color }}>
                                        {quadrantRisks.length}
                                    </span>
                                </div>

                                {/* Risk items */}
                                <div className="space-y-2">
                                    {quadrantRisks.map((risk) => (
                                        <motion.div
                                            key={risk.id}
                                            layoutId={risk.id}
                                            draggable={editable}
                                            onDragStart={() => handleDragStart(risk.id)}
                                            onClick={() => setSelectedRisk(risk)}
                                            className={`
                                                p-3 bg-white dark:bg-navy-800 rounded-lg shadow-sm 
                                                cursor-pointer hover:shadow-md transition-shadow
                                                ${draggedRisk === risk.id ? 'opacity-50' : ''}
                                            `}
                                        >
                                            <div className="flex items-start gap-2">
                                                {editable && (
                                                    <GripVertical className="w-4 h-4 text-slate-400 mt-0.5 cursor-grab" />
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-navy-900 dark:text-white truncate">
                                                        {isPolish && risk.titlePl ? risk.titlePl : risk.title}
                                                    </p>
                                                    {risk.axis && (
                                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                                            {risk.axis}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>

                                {/* Empty state */}
                                {quadrantRisks.length === 0 && (
                                    <div className="flex items-center justify-center h-20 text-sm text-slate-400 dark:text-slate-500">
                                        {editable ? (isPolish ? 'Przeciągnij tutaj' : 'Drop here') : (isPolish ? 'Brak ryzyk' : 'No risks')}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Axis arrows */}
                <div className="absolute left-0 top-0 bottom-0 w-8 flex flex-col justify-between py-4 text-xs text-slate-400">
                    <span>{isPolish ? 'Wysoki' : 'High'}</span>
                    <span>{isPolish ? 'Niski' : 'Low'}</span>
                </div>
                <div className="absolute left-8 right-0 -bottom-6 flex justify-between text-xs text-slate-400">
                    <span>{isPolish ? 'Niskie' : 'Low'}</span>
                    <span>{isPolish ? 'Wysokie' : 'High'}</span>
                </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm pt-4">
                {Object.entries(QUADRANTS).map(([key, config]) => {
                    const Icon = config.icon;
                    return (
                        <div key={key} className="flex items-center gap-2">
                            <div 
                                className="w-4 h-4 rounded-full flex items-center justify-center"
                                style={{ backgroundColor: config.bgColor }}
                            >
                                <Icon className="w-2.5 h-2.5" style={{ color: config.color }} />
                            </div>
                            <span className="text-slate-600 dark:text-slate-400">
                                {isPolish ? config.labelPl : config.label}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Risk detail modal */}
            <AnimatePresence>
                {selectedRisk && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                        onClick={() => setSelectedRisk(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white dark:bg-navy-800 rounded-2xl shadow-2xl max-w-md w-full p-6"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <h3 className="text-lg font-bold text-navy-900 dark:text-white">
                                        {isPolish && selectedRisk.titlePl ? selectedRisk.titlePl : selectedRisk.title}
                                    </h3>
                                    {selectedRisk.axis && (
                                        <p className="text-sm text-slate-500 dark:text-slate-400">
                                            {selectedRisk.axis}
                                        </p>
                                    )}
                                </div>
                                <button
                                    onClick={() => setSelectedRisk(null)}
                                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {(selectedRisk.description || selectedRisk.descriptionPl) && (
                                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                                    {isPolish && selectedRisk.descriptionPl ? selectedRisk.descriptionPl : selectedRisk.description}
                                </p>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div className={`p-3 rounded-lg ${
                                    selectedRisk.impact === 'high' ? 'bg-red-50 dark:bg-red-500/10' : 'bg-green-50 dark:bg-green-500/10'
                                }`}>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                                        {isPolish ? 'Wpływ' : 'Impact'}
                                    </p>
                                    <p className={`font-semibold ${
                                        selectedRisk.impact === 'high' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                                    }`}>
                                        {selectedRisk.impact === 'high' ? (isPolish ? 'Wysoki' : 'High') : (isPolish ? 'Niski' : 'Low')}
                                    </p>
                                </div>
                                <div className={`p-3 rounded-lg ${
                                    selectedRisk.probability === 'high' ? 'bg-amber-50 dark:bg-amber-500/10' : 'bg-blue-50 dark:bg-blue-500/10'
                                }`}>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                                        {isPolish ? 'Prawdopodobieństwo' : 'Probability'}
                                    </p>
                                    <p className={`font-semibold ${
                                        selectedRisk.probability === 'high' ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'
                                    }`}>
                                        {selectedRisk.probability === 'high' ? (isPolish ? 'Wysokie' : 'High') : (isPolish ? 'Niskie' : 'Low')}
                                    </p>
                                </div>
                            </div>

                            {editable && onRiskRemove && (
                                <button
                                    onClick={() => {
                                        onRiskRemove(selectedRisk.id);
                                        setSelectedRisk(null);
                                    }}
                                    className="w-full mt-4 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                                >
                                    {isPolish ? 'Usuń ryzyko' : 'Remove risk'}
                                </button>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default RiskMatrix;

