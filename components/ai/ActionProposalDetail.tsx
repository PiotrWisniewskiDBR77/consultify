import React from 'react';
import { ActionProposal } from './ActionProposalList';
import { Brain, Target, Shield, AlertTriangle, TrendingUp, CheckCircle2, XCircle, Terminal, HelpCircle, Activity, Info } from 'lucide-react';

interface ActionProposalDetailProps {
    proposal: ActionProposal | null;
    onApprove: () => void;
    onReject: () => void;
    onModify?: () => void;
}

export const ActionProposalDetail: React.FC<ActionProposalDetailProps> = ({ proposal, onApprove, onReject, onModify }) => {
    if (!proposal) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 bg-slate-50/50 dark:bg-navy-950/30 rounded-2xl border border-dashed border-slate-200 dark:border-white/5">
                <Brain size={48} className="mb-4 opacity-20" />
                <h3 className="text-lg font-semibold text-navy-900 dark:text-white mb-2">Select a Proposal</h3>
                <p className="max-w-xs mx-auto text-sm">Review AI-generated suggestions to optimize your digital transformation flow.</p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm overflow-hidden flex flex-col h-full">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-navy-950/50">
                <div className="flex items-center gap-2 mb-4">
                    <div className="px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold uppercase tracking-widest">
                        Draft Action
                    </div>
                </div>
                <h2 className="text-2xl font-bold text-navy-900 dark:text-white mb-2">{proposal.title}</h2>
                <div className="flex flex-wrap gap-4 mt-4">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-navy-800 border border-slate-200 dark:border-white/10 rounded-lg shadow-sm">
                        <Activity size={14} className="text-indigo-500" />
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Action: {proposal.action_type}</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-navy-800 border border-slate-200 dark:border-white/10 rounded-lg shadow-sm">
                        <Shield size={14} className={proposal.risk_level === 'LOW' ? 'text-emerald-500' : proposal.risk_level === 'MEDIUM' ? 'text-amber-500' : 'text-red-500'} />
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Risk: {proposal.risk_level}</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-navy-800 border border-slate-200 dark:border-white/10 rounded-lg shadow-sm">
                        <Target size={14} className="text-purple-500" />
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Scope: {proposal.scope}</span>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* Reasoning Section */}
                <section>
                    <h3 className="flex items-center gap-2 text-sm font-bold text-navy-900 dark:text-white uppercase tracking-wider mb-4">
                        <Brain size={16} className="text-indigo-500" />
                        Reasoning & Recommendation
                    </h3>
                    <div className="p-4 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-500/20 rounded-xl">
                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed italic border-l-2 border-indigo-400 pl-4 mb-4">
                            "{proposal.origin_recommendation}"
                        </p>
                        <div className="bg-white dark:bg-navy-950 p-3 rounded-lg border border-indigo-100 dark:border-indigo-500/10 flex items-start gap-3">
                            <Info size={16} className="text-indigo-400 mt-0.5 shrink-0" />
                            <div>
                                <h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-1 uppercase">Origin Signal</h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{proposal.origin_signal}: Detected organization friction patterns.</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Simulation & Impact */}
                <section>
                    <h3 className="flex items-center gap-2 text-sm font-bold text-navy-900 dark:text-white uppercase tracking-wider mb-4">
                        <TrendingUp size={16} className="text-emerald-500" />
                        Simulation Strategy
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-50 dark:bg-navy-950 border border-slate-100 dark:border-white/5 rounded-xl">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <Activity size={14} /> Expected Direction
                            </h4>
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${proposal.simulation.expected_direction === 'positive' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-slate-500/20 text-slate-500'
                                    }`}>
                                    <TrendingUp size={20} />
                                </div>
                                <div>
                                    <span className={`text-sm font-bold capitalize ${proposal.simulation.expected_direction === 'positive' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'
                                        }`}>
                                        {proposal.simulation.expected_direction} Impact
                                    </span>
                                    <p className="text-xs text-slate-500">Based on algorithmic projection</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-navy-950 border border-slate-100 dark:border-white/5 rounded-xl">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <Terminal size={14} /> Execution Assumptions
                            </h4>
                            <ul className="space-y-2">
                                {proposal.simulation.assumptions.length > 0 ? (
                                    proposal.simulation.assumptions.map((item, i) => (
                                        <li key={i} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
                                            <div className="w-1 h-1 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                                            {item}
                                        </li>
                                    ))
                                ) : (
                                    <li className="text-xs text-slate-400 italic">No explicit assumptions provided.</li>
                                )}
                            </ul>
                        </div>
                    </div>
                </section>

                {/* Narrative Summary */}
                <section className="bg-emerald-500/5 dark:bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-5">
                    <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-2">Narrative Projection</h4>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                        {proposal.expected_impact}
                    </p>
                </section>

                {/* Technical Payload (Hidden by default or in a collapse) */}
                <section>
                    <details className="group border border-slate-100 dark:border-white/5 rounded-xl overflow-hidden">
                        <summary className="p-3 bg-slate-50 dark:bg-navy-950 cursor-pointer list-none flex items-center justify-between group-open:bg-white dark:group-open:bg-navy-900 transition-colors">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-tighter flex items-center gap-2">
                                <Terminal size={14} /> Technical Payload Preview
                            </span>
                            <ChevronRight size={14} className="text-slate-400 transition-transform group-open:rotate-90" />
                        </summary>
                        <div className="p-4 bg-navy-950 text-emerald-400/90 font-mono text-xs overflow-x-auto">
                            <pre>{JSON.stringify(proposal.payload_preview, null, 2)}</pre>
                        </div>
                    </details>
                </section>
            </div>

            {/* Footer Actions */}
            <div className="p-6 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-navy-950/50 flex items-center justify-between">
                <button
                    onClick={onReject}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white dark:bg-navy-800 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-500/30 transition-all"
                >
                    <XCircle size={18} />
                    Reject Proposal
                </button>
                <div className="flex gap-3">
                    {onModify && (
                        <button
                            onClick={onModify}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white dark:bg-navy-800 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 font-bold text-sm hover:border-indigo-400 transition-all"
                        >
                            Modify
                        </button>
                    )}
                    <button
                        onClick={onApprove}
                        className="flex items-center gap-2 px-8 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-500 shadow-lg shadow-indigo-500/30 transition-all transform active:scale-95"
                    >
                        <CheckCircle2 size={18} />
                        Approve & Execute
                    </button>
                </div>
            </div>
        </div>
    );
};

// Internal icon component if needed, otherwise use Chevron from lucide-react
const ChevronRight = ({ size, className }: { size?: number, className?: string }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <path d="m9 18 6-6-6-6" />
    </svg>
);
