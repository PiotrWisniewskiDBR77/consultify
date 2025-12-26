/**
 * GeneratedInitiativeCard
 * 
 * Card component for displaying a generated initiative with edit/remove actions.
 */

import React, { useState } from 'react';
import {
    ChevronDown,
    ChevronUp,
    Edit,
    Trash2,
    TrendingUp,
    DollarSign,
    Clock,
    Target,
    AlertTriangle,
    Sparkles
} from 'lucide-react';
import { GeneratedInitiative, DRDAxis } from '../../types';

interface GeneratedInitiativeCardProps {
    initiative: GeneratedInitiative;
    onEdit: () => void;
    onRemove: () => void;
    isSelected?: boolean;
    onSelect?: (selected: boolean) => void;
}

const AXIS_LABELS: Record<DRDAxis, string> = {
    processes: 'Processes',
    digitalProducts: 'Digital Products',
    businessModels: 'Business Models',
    dataManagement: 'Data Management',
    culture: 'Organizational Culture',
    cybersecurity: 'Cybersecurity',
    aiMaturity: 'AI Maturity'
};

const AXIS_COLORS: Record<DRDAxis, string> = {
    processes: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    digitalProducts: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    businessModels: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    dataManagement: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
    culture: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    cybersecurity: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    aiMaturity: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400'
};

export const GeneratedInitiativeCard: React.FC<GeneratedInitiativeCardProps> = ({
    initiative,
    onEdit,
    onRemove,
    isSelected,
    onSelect
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const getRiskColor = (risk: string) => {
        switch (risk) {
            case 'HIGH':
                return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
            case 'MEDIUM':
                return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
            case 'LOW':
                return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
            default:
                return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
        }
    };

    const getROIColor = (roi: number) => {
        if (roi >= 2.5) return 'text-green-600 dark:text-green-400';
        if (roi >= 1.5) return 'text-amber-600 dark:text-amber-400';
        return 'text-red-600 dark:text-red-400';
    };

    return (
        <div className={`
            rounded-xl border-2 overflow-hidden transition-all
            ${isSelected 
                ? 'border-purple-500 shadow-lg shadow-purple-500/10' 
                : 'border-slate-200 dark:border-white/10'
            }
        `}>
            {/* Header */}
            <div className="p-4 bg-white dark:bg-navy-900">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                            {initiative.aiGenerated && (
                                <span className="flex items-center gap-1 px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded text-xs font-medium">
                                    <Sparkles size={10} />
                                    AI
                                </span>
                            )}
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${AXIS_COLORS[initiative.sourceAxisId]}`}>
                                {AXIS_LABELS[initiative.sourceAxisId]}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getRiskColor(initiative.riskLevel)}`}>
                                {initiative.riskLevel} Risk
                            </span>
                        </div>

                        <h3 className="text-lg font-semibold text-navy-900 dark:text-white mb-1">
                            {initiative.name}
                        </h3>

                        <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">
                            {initiative.description}
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                        <button
                            onClick={onEdit}
                            className="p-2 text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                            title="Edit"
                        >
                            <Edit size={18} />
                        </button>
                        <button
                            onClick={onRemove}
                            className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Remove"
                        >
                            <Trash2 size={18} />
                        </button>
                    </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-4 gap-4 mt-4">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-green-100 dark:bg-green-900/30 rounded">
                            <TrendingUp size={14} className="text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">ROI</p>
                            <p className={`text-sm font-bold ${getROIColor(initiative.estimatedROI)}`}>
                                {initiative.estimatedROI}x
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded">
                            <DollarSign size={14} className="text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Budget</p>
                            <p className="text-sm font-bold text-navy-900 dark:text-white">
                                {(initiative.estimatedBudget / 1000).toFixed(0)}k
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-amber-100 dark:bg-amber-900/30 rounded">
                            <Clock size={14} className="text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Timeline</p>
                            <p className="text-sm font-bold text-navy-900 dark:text-white">
                                {initiative.timeline}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-purple-100 dark:bg-purple-900/30 rounded">
                            <Target size={14} className="text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Priority</p>
                            <p className="text-sm font-bold text-navy-900 dark:text-white">
                                #{initiative.priority}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Expandable Details */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-navy-950 flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
            >
                {isExpanded ? (
                    <>Hide Details <ChevronUp size={16} /></>
                ) : (
                    <>Show Details <ChevronDown size={16} /></>
                )}
            </button>

            {isExpanded && (
                <div className="px-4 py-3 bg-slate-50 dark:bg-navy-950 border-t border-slate-200 dark:border-white/10">
                    <h4 className="text-sm font-medium text-navy-900 dark:text-white mb-2">
                        Objectives
                    </h4>
                    {initiative.objectives && initiative.objectives.length > 0 ? (
                        <ul className="space-y-1.5">
                            {initiative.objectives.map((obj, idx) => (
                                <li 
                                    key={idx}
                                    className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400"
                                >
                                    <span className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-xs font-medium text-purple-600 dark:text-purple-400 shrink-0 mt-0.5">
                                        {idx + 1}
                                    </span>
                                    {obj}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-sm text-slate-400 italic">No objectives defined</p>
                    )}

                    {initiative.riskLevel === 'HIGH' && (
                        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-500/20 flex items-start gap-2">
                            <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-red-600 dark:text-red-400">
                                High-risk initiative. Ensure proper governance and risk mitigation strategies are in place.
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

