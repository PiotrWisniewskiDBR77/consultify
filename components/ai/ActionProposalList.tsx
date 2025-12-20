import React from 'react';
import { AlertTriangle, CheckCircle, Info, Sparkles, ChevronRight, User, Briefcase, Users, Calendar } from 'lucide-react';

export interface ActionProposal {
    proposal_id: string;
    origin_signal: string;
    origin_recommendation: string;
    title: string;
    action_type: string;
    scope: string;
    payload_preview: any;
    risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
    expected_impact: string;
    simulation: {
        assumptions: string[];
        expected_direction: 'positive' | 'neutral' | 'negative';
    };
    requires_approval: boolean;
}

interface ActionProposalListProps {
    proposals: ActionProposal[];
    onSelect: (proposal: ActionProposal) => void;
    selectedId?: string;
}

export const ActionProposalList: React.FC<ActionProposalListProps> = ({ proposals, onSelect, selectedId }) => {
    const getIcon = (type: string) => {
        switch (type) {
            case 'TASK_CREATE': return <Briefcase size={16} />;
            case 'PLAYBOOK_ASSIGN': return <CheckCircle size={16} />;
            case 'MEETING_SCHEDULE': return <Calendar size={16} />;
            case 'ROLE_SUGGESTION': return <Users size={16} />;
            default: return <Info size={16} />;
        }
    };

    const getRiskColor = (risk: string) => {
        switch (risk) {
            case 'HIGH': return 'text-red-500 bg-red-500/10 border-red-500/20';
            case 'MEDIUM': return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
            case 'LOW': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
            default: return 'text-slate-500 bg-slate-500/10 border-slate-500/20';
        }
    };

    return (
        <div className="space-y-3">
            {proposals.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-navy-900 rounded-xl border border-dashed border-slate-200 dark:border-white/5">
                    <div className="w-12 h-12 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
                        <Sparkles size={24} />
                    </div>
                    <p className="text-slate-500 text-sm">No pending action proposals found.</p>
                </div>
            ) : (
                proposals.map((proposal) => (
                    <button
                        key={proposal.proposal_id}
                        onClick={() => onSelect(proposal)}
                        className={`w-full text-left p-4 rounded-xl border transition-all duration-200 group relative overflow-hidden ${selectedId === proposal.proposal_id
                                ? 'bg-indigo-600 border-indigo-500 shadow-lg shadow-indigo-500/20'
                                : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-white/5 hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:bg-slate-50 dark:hover:bg-white/5'
                            }`}
                    >
                        {/* Shimmer Effect on selected */}
                        {selectedId === proposal.proposal_id && (
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-shimmer" />
                        )}

                        <div className="flex items-start gap-4">
                            <div className={`p-2.5 rounded-lg shrink-0 ${selectedId === proposal.proposal_id
                                    ? 'bg-white/20 text-white'
                                    : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/50'
                                }`}>
                                {getIcon(proposal.action_type)}
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${selectedId === proposal.proposal_id ? 'text-indigo-200' : 'text-slate-400'
                                        }`}>
                                        {proposal.action_type.replace('_', ' ')}
                                    </span>
                                    <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold border ${selectedId === proposal.proposal_id ? 'bg-white/10 text-white border-white/20' : getRiskColor(proposal.risk_level)
                                        }`}>
                                        {proposal.risk_level} RISK
                                    </span>
                                </div>
                                <h4 className={`font-bold mb-1 truncate ${selectedId === proposal.proposal_id ? 'text-white' : 'text-navy-900 dark:text-white'
                                    }`}>
                                    {proposal.title}
                                </h4>
                                <div className="flex items-center gap-2">
                                    <span className={`text-xs ${selectedId === proposal.proposal_id ? 'text-indigo-200' : 'text-slate-500'
                                        }`}>
                                        Signal: <span className="font-semibold">{proposal.origin_signal}</span>
                                    </span>
                                </div>
                            </div>

                            <div className={`shrink-0 transition-transform ${selectedId === proposal.proposal_id ? 'text-white' : 'text-slate-300 group-hover:translate-x-1'
                                }`}>
                                <ChevronRight size={18} />
                            </div>
                        </div>
                    </button>
                ))
            )}
        </div>
    );
};
