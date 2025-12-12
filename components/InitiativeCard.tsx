import React from 'react';
import { Initiative, InitiativeStatus } from '../types';

import {
    Target, Users, DollarSign, TrendingUp,
    CheckCircle, Clock,
    MoreHorizontal, ChevronRight, Globe
} from 'lucide-react';

interface InitiativeCardProps {
    initiative: Initiative;
    onClick: () => void;
    onEnrich?: (id: string) => Promise<void>;

}

import { useState } from 'react';

export const InitiativeCard: React.FC<InitiativeCardProps> = ({ initiative, onClick, onEnrich }) => {
    const [isEnriching, setIsEnriching] = useState(false);

    const handleEnrich = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onEnrich) {
            setIsEnriching(true);
            try {
                await onEnrich(initiative.id);
            } finally {
                setIsEnriching(false);
            }
        }
    };

    // Helpers for Status Colors
    const getStatusColor = (status: InitiativeStatus) => {
        switch (status) {
            case 'step3': return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
            case 'step4': return 'bg-blue-500/10 text-blue-400 border-blue-500/20'; // Pilot
            case 'step5': return 'bg-purple-500/10 text-purple-400 border-purple-500/20'; // Full
            case 'completed': return 'bg-green-500/10 text-green-400 border-green-500/20';
            case 'on_hold': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
            default: return 'bg-slate-500/10 text-slate-400';
        }
    };

    const getStatusLabel = (status: InitiativeStatus) => {
        const labels: Record<string, string> = {
            'step3': 'Initiative List (Step 3)',
            'step4': 'Pilot Execution (Step 4)',
            'step5': 'Full Rollout (Step 5)',
            'completed': 'Done & Verified',
            'on_hold': 'On Hold'
        };
        return labels[status] || status;
    };

    return (
        <div
            onClick={onClick}
            className="group bg-white dark:bg-navy-800/50 hover:bg-slate-50 dark:hover:bg-navy-800 border border-slate-200 dark:border-white/5 hover:border-blue-500/30 rounded-xl p-5 transition-all cursor-pointer shadow-sm hover:shadow-md dark:shadow-blue-900/10 relative overflow-hidden"
        >
            {/* Decorative Gradient */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl -mr-16 -mt-16 group-hover:bg-blue-500/10 transition-colors"></div>

            {/* Header */}
            <div className="flex justify-between items-start mb-4 relative z-10">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${getStatusColor(initiative.status)}`}>
                            {getStatusLabel(initiative.status)}
                        </span>
                        {initiative.axis && (
                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded border bg-navy-900 text-slate-400 border-white/10">
                                Axis {initiative.axis}
                            </span>
                        )}
                    </div>
                    <h3 className="text-lg font-semibold text-navy-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-100 transition-colors">
                        {initiative.name}
                    </h3>
                </div>
                <button className="text-slate-500 hover:text-white transition-colors">
                    <MoreHorizontal size={20} />
                </button>
            </div>

            {/* Summary */}
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 line-clamp-2 h-10">
                {initiative.summary || initiative.description || "No description provided."}
            </p>

            {/* Logic Link (PRO MAX) */}
            {initiative.relatedGap && (
                <div className="mb-4 bg-purple-50 dark:bg-purple-900/10 p-3 rounded-lg border border-purple-200 dark:border-purple-500/20 flex items-start gap-3">
                    <div className="mt-0.5">
                        {/* Chain/Link Icon */}
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-500">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                        </svg>
                    </div>
                    <div>
                        <div className="text-[10px] uppercase font-bold text-purple-600 dark:text-purple-400 mb-0.5">Strategy Logic</div>
                        <p className="text-xs text-slate-700 dark:text-slate-300">
                            Addresses Gap: <span className="font-semibold italic">"{initiative.relatedGap}"</span>
                        </p>
                    </div>
                </div>
            )}

            {/* Market Context Section */}
            {initiative.marketContext && (
                <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-500/20">
                    <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 mb-1 text-[10px] uppercase font-bold">
                        <Globe size={10} />
                        Market Insights
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed">
                        {initiative.marketContext}
                    </p>
                </div>
            )}

            {/* Metrics Grid */}
            <div className="grid grid-cols-3 gap-2 mb-6">
                <div className="bg-slate-50 dark:bg-navy-900/50 rounded-lg p-2 border border-slate-100 dark:border-white/5">
                    <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                        <DollarSign size={12} />
                        <span className="text-[10px] uppercase font-semibold">Budget</span>
                    </div>
                    <div className="text-sm font-medium text-navy-900 dark:text-slate-200">
                        {initiative.costCapex || initiative.costOpex ?
                            `$${((initiative.costCapex || 0) + (initiative.costOpex || 0)) / 1000}k` : '-'}
                    </div>
                </div>

                <div className="bg-slate-50 dark:bg-navy-900/50 rounded-lg p-2 border border-slate-100 dark:border-white/5">
                    <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                        <TrendingUp size={12} />
                        <span className="text-[10px] uppercase font-semibold">ROI</span>
                    </div>
                    <div className="text-sm font-medium text-green-600 dark:text-green-400">
                        {initiative.expectedRoi ? `${initiative.expectedRoi}x` : '-'}
                    </div>
                </div>

                <div className="bg-slate-50 dark:bg-navy-900/50 rounded-lg p-2 border border-slate-100 dark:border-white/5">
                    <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                        <Users size={12} />
                        <span className="text-[10px] uppercase font-semibold">Team</span>
                    </div>
                    <div className="flex -space-x-1.5 mt-0.5">
                        {/* Placeholders for avatars */}
                        <div className="w-5 h-5 rounded-full bg-blue-500 border border-white dark:border-navy-900 flex items-center justify-center text-[8px] text-white">B</div>
                        <div className="w-5 h-5 rounded-full bg-purple-500 border border-white dark:border-navy-900 flex items-center justify-center text-[8px] text-white">E</div>
                    </div>
                </div>
            </div>

            {/* Progress Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-white/5">
                <div className="flex items-center gap-4 text-xs text-slate-500">
                    <div className="flex items-center gap-1">
                        <CheckCircle size={14} className={initiative.status !== 'step3' ? 'text-blue-500' : ''} />
                        <span>Plan</span>
                    </div>
                    <div className="w-4 h-px bg-white/10"></div>
                    <div className="flex items-center gap-1">
                        <Clock size={14} className={initiative.status === 'step4' ? 'text-blue-500' : ''} />
                        <span>Pilot</span>
                    </div>
                    <div className="w-4 h-px bg-white/10"></div>
                    <div className="flex items-center gap-1">
                        <Target size={14} className={initiative.status === 'step5' ? 'text-blue-500' : ''} />
                        <span>Scale</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {onEnrich && !initiative.marketContext && (
                        <button
                            onClick={handleEnrich}
                            disabled={isEnriching}
                            className={`text-xs px-2 py-1 rounded border transition-colors flex items-center gap-1 ${isEnriching ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10 hover:text-white'}`}
                        >
                            {isEnriching ? <span className="animate-spin">⟳</span> : <Globe size={12} />}
                            {isEnriching ? 'Researching...' : 'Enrich'}
                        </button>
                    )}
                    <div className="flex items-center gap-1 text-xs font-semibold text-blue-400 group-hover:translate-x-1 transition-transform">
                        Details <ChevronRight size={14} />
                    </div>
                </div>
            </div>
        </div>
    );
};
