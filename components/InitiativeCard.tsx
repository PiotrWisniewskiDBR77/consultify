import React, { useState } from 'react';
import { Initiative, InitiativeStatus } from '../types';

import {
    Target, Users, DollarSign, TrendingUp,
    CheckCircle, Clock,
    MoreHorizontal, ChevronRight, Globe,
    Zap, Layers, Anchor, ArrowUpCircle, RefreshCw
} from 'lucide-react';

interface InitiativeCardProps {
    initiative: Initiative;
    onClick: () => void;
    onEnrich?: (id: string) => Promise<void>;

}

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

    // Helpers for Strategic Intent Colors
    const getIntentColor = (intent?: string) => {
        switch (intent) {
            case 'Grow': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
            case 'Fix': return 'bg-red-500/10 text-red-500 border-red-500/20';
            case 'Stabilize': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
            case 'De-risk': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
            case 'Build Capability': return 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20';
            default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
        }
    };

    // Helper for Strategic Role Icon
    const getRoleIcon = (role?: string) => {
        switch (role) {
            case 'Foundation': return <Anchor size={12} />;
            case 'Enabler': return <Layers size={12} />;
            case 'Accelerator': return <Zap size={12} />;
            case 'Scaling': return <ArrowUpCircle size={12} />;
            default: return null;
        }
    };

    const getRoleColor = (role?: string) => {
        switch (role) {
            case 'Foundation': return 'text-slate-500 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700';
            case 'Enabler': return 'text-blue-500 bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-900/30';
            case 'Accelerator': return 'text-amber-500 bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-900/30';
            case 'Scaling': return 'text-purple-500 bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-900/30';
            default: return 'hidden';
        }

    }

    // Is High Change?
    const isHighChange = (initiative.effortProfile?.change || 0) >= 4;


    // Helper for AI Confidence
    const getConfidenceIndicator = (confidence?: string) => {
        switch (confidence) {
            case 'High': return { color: 'bg-green-500', label: 'High Confidence' };
            case 'Medium': return { color: 'bg-yellow-500', label: 'Review Needed' };
            case 'Low': return { color: 'bg-red-500', label: 'Not Decision Ready' };
            default: return { color: 'bg-slate-300', label: 'Not Analyzed' };
        }
    };

    const aiStatus = getConfidenceIndicator(initiative.aiConfidence);

    return (
        <div
            onClick={onClick}
            className="group bg-white dark:bg-navy-800/50 hover:bg-slate-50 dark:hover:bg-navy-800 border border-slate-200 dark:border-white/5 hover:border-blue-500/30 rounded-xl p-5 transition-all cursor-pointer shadow-sm hover:shadow-md dark:shadow-blue-900/10 relative overflow-hidden"
        >
            {/* Decorative Gradient */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl -mr-16 -mt-16 group-hover:bg-blue-500/10 transition-colors"></div>

            {/* AI Confidence Indicator (Top Right) */}
            <div className="absolute top-3 right-3 flex items-center gap-1.5 z-20">
                {isHighChange && (
                    <div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-900/20 text-rose-500 px-1.5 py-0.5 rounded border border-rose-100 dark:border-rose-900/30" title="High Change Effort">
                        <RefreshCw size={10} className="animate-spin-slow" />
                    </div>
                )}

                {initiative.aiConfidence && (
                    <div className="flex items-center gap-1.5" title={`AI Analysis: ${aiStatus.label}`}>
                        <div className={`w-2 h-2 rounded-full ${aiStatus.color} shadow-sm animate-pulse`}></div>
                        {initiative.aiConfidence === 'Low' && (
                            <span className="text-[9px] font-bold text-red-500 uppercase tracking-wider border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded">
                                Not Ready
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Header */}
            <div className="flex justify-between items-start mb-3 relative z-10 pr-16">
                <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        {/* Strategic ROLE Badge (New) */}
                        {initiative.strategicRole && (
                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border flex items-center gap-1 ${getRoleColor(initiative.strategicRole)}`}>
                                {getRoleIcon(initiative.strategicRole)}
                                {initiative.strategicRole}
                            </span>
                        )}

                        {/* Strategic Intent Badge (Primary) */}
                        {initiative.strategicIntent ? (
                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${getIntentColor(initiative.strategicIntent)}`}>
                                {initiative.strategicIntent}
                            </span>
                        ) : (
                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${getStatusColor(initiative.status)}`}>
                                {getStatusLabel(initiative.status)}
                            </span>
                        )}

                        {initiative.axis && (
                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded border bg-navy-900 text-slate-400 border-white/10">
                                Axis {initiative.axis}
                            </span>
                        )}
                    </div>
                    <h3 className="text-lg font-semibold text-navy-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-100 transition-colors leading-tight">
                        {initiative.name}
                    </h3>
                </div>
            </div>

            {/* Summary */}
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 line-clamp-2 min-h-[2.5rem]">
                {initiative.summary || initiative.description || "No description provided."}
            </p>

            {/* Hover Preview: Effort & Reason (Expanded) */}
            <div className="max-h-0 overflow-hidden group-hover:max-h-60 transition-all duration-500 ease-in-out">
                {/* Footer / Metrics */}
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/5 flex justify-between items-center relative z-20">
                    <div className="flex gap-2 text-[10px] text-slate-400">
                        <span>{initiative.effortProfile ? `${(initiative.effortProfile.analytical || 0) + (initiative.effortProfile.operational || 0) + (initiative.effortProfile.change || 0)}pts` : 'Est. Effort'}</span>
                        <span>•</span>
                        <span>{initiative.businessValue ? `$${initiative.businessValue}k` : 'No Value'}</span>
                    </div>

                    {/* C2: INLINE AI ACTIONS */}
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-1 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-[9px] font-bold px-1.5" title="Why is this placed here?">
                            Why here?
                        </button>
                        <button className="p-1 rounded bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10" title="Suggest better placement">
                            <RefreshCw size={10} />
                        </button>
                    </div>
                </div>
                <div className="pb-4 space-y-3 border-t border-slate-100 dark:border-white/5 pt-3 mt-2">
                    {/* PRO MAX: Effort Profile Bars */}
                    {initiative.effortProfile && (
                        <div className="space-y-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Effort Profile</span>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[9px] text-slate-500"><span>Analytic</span><span>{initiative.effortProfile.analytical}/5</span></div>
                                    <div className="h-1 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-500" style={{ width: `${(initiative.effortProfile.analytical / 5) * 100}%` }}></div>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[9px] text-slate-500"><span>Ops</span><span>{initiative.effortProfile.operational}/5</span></div>
                                    <div className="h-1 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                                        <div className="h-full bg-emerald-500" style={{ width: `${(initiative.effortProfile.operational / 5) * 100}%` }}></div>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[9px] text-slate-500"><span>Change</span><span>{initiative.effortProfile.change}/5</span></div>
                                    <div className="h-1 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                                        <div className="h-full bg-rose-500" style={{ width: `${(initiative.effortProfile.change / 5) * 100}%` }}></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Placement Reason */}
                    {initiative.placementReason && (
                        <div className="flex gap-2">
                            <div className="min-w-[4px] w-1 bg-indigo-400/50 rounded-full h-auto"></div>
                            <div>
                                <span className="text-[10px] font-bold text-indigo-400 uppercase">Why Here?</span>
                                <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">{initiative.placementReason}</p>
                            </div>
                        </div>
                    )}

                    {initiative.problemStatement && (
                        <div className="flex gap-2">
                            <div className="min-w-[4px] w-1 bg-red-400/50 rounded-full h-auto"></div>
                            <div>
                                <span className="text-[10px] font-bold text-red-400 uppercase">Problem</span>
                                <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">{initiative.problemStatement}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Logic Link (PRO MAX) */}
            {initiative.relatedGap && (
                <div className="mb-4 bg-purple-50 dark:bg-purple-900/10 p-2.5 rounded-lg border border-purple-200 dark:border-purple-500/20 flex items-center gap-2.5">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-purple-500 shrink-0">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                    </svg>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-700 dark:text-slate-300 truncate">
                            Gap: <span className="font-semibold italic">"{initiative.relatedGap}"</span>
                        </p>
                    </div>
                </div>
            )}

            {/* Metrics Grid */}
            <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-slate-50 dark:bg-navy-900/50 rounded-lg p-2 border border-slate-100 dark:border-white/5">
                    <div className="flex items-center gap-1.5 text-slate-500 mb-0.5">
                        <DollarSign size={10} />
                        <span className="text-[9px] uppercase font-bold tracking-wide">Budget</span>
                    </div>
                    <div className="text-xs font-semibold text-navy-900 dark:text-slate-200">
                        {initiative.costCapex || initiative.costOpex ?
                            `$${((initiative.costCapex || 0) + (initiative.costOpex || 0)) / 1000}k` : '-'}
                    </div>
                </div>

                <div className="bg-slate-50 dark:bg-navy-900/50 rounded-lg p-2 border border-slate-100 dark:border-white/5">
                    <div className="flex items-center gap-1.5 text-slate-500 mb-0.5">
                        <TrendingUp size={10} />
                        <span className="text-[9px] uppercase font-bold tracking-wide">ROI</span>
                    </div>
                    <div className="text-xs font-semibold text-green-600 dark:text-green-400">
                        {initiative.expectedRoi ? `${initiative.expectedRoi}x` : '-'}
                    </div>
                </div>

                <div className="bg-slate-50 dark:bg-navy-900/50 rounded-lg p-2 border border-slate-100 dark:border-white/5">
                    <div className="flex items-center gap-1.5 text-slate-500 mb-0.5">
                        <Users size={10} />
                        <span className="text-[9px] uppercase font-bold tracking-wide">Team</span>
                    </div>
                    <div className="flex -space-x-1.5 mt-0.5">
                        {/* Placeholder Avatars or Initials */}
                        <div className="w-4 h-4 rounded-full bg-blue-500 border border-white dark:border-navy-900 flex items-center justify-center text-[6px] text-white">B</div>
                        <div className="w-4 h-4 rounded-full bg-purple-500 border border-white dark:border-navy-900 flex items-center justify-center text-[6px] text-white">E</div>
                    </div>
                </div>
            </div>

            {/* Progress Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-white/5">
                <div className="flex items-center gap-3 text-[10px] text-slate-500 font-medium">
                    <div className={`flex items-center gap-1 ${initiative.status !== 'step3' ? 'text-blue-500' : ''}`}>
                        <CheckCircle size={12} />
                        <span>Plan</span>
                    </div>
                    <div className={`flex items-center gap-1 ${initiative.status === 'step4' ? 'text-blue-500' : ''}`}>
                        <Clock size={12} />
                        <span>Pilot</span>
                    </div>
                    <div className={`flex items-center gap-1 ${initiative.status === 'step5' ? 'text-blue-500' : ''}`}>
                        <Target size={12} />
                        <span>Scale</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {onEnrich && !initiative.aiConfidence && (
                        <button
                            onClick={handleEnrich}
                            disabled={isEnriching}
                            className={`text-[10px] px-2 py-1 rounded border transition-colors flex items-center gap-1 ${isEnriching ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10 hover:text-white'}`}
                        >
                            {isEnriching ? <span className="animate-spin">⟳</span> : <Globe size={10} />}
                            {isEnriching ? 'AI Analyzing...' : 'Analyze'}
                        </button>
                    )}
                    <button className="text-slate-400 hover:text-blue-400 transition-colors">
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};
