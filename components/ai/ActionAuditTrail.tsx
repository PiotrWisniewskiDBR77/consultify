import React from 'react';
import { History, CheckCircle2, XCircle, RotateCcw, User, Calendar, MessageSquare, Download, FileJson, FileSpreadsheet } from 'lucide-react';

export interface AuditRecord {
    id: string;
    proposal_id: string;
    decision: 'APPROVED' | 'REJECTED' | 'MODIFIED';
    decided_by_user_id: string;
    decision_reason: string;
    created_at: string;
    user_email?: string;
    first_name?: string;
    last_name?: string;
    policy_rule_id?: string;
}

interface ActionAuditTrailProps {
    records: AuditRecord[];
    loading?: boolean;
    onExport?: (format: 'json' | 'csv') => void;
}

export const ActionAuditTrail: React.FC<ActionAuditTrailProps> = ({ records, loading, onExport }) => {
    const getDecisionStyles = (decision: string) => {
        switch (decision) {
            case 'APPROVED': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
            case 'REJECTED': return 'text-red-500 bg-red-500/10 border-red-500/20';
            case 'MODIFIED': return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
            default: return 'text-slate-500 bg-slate-500/10 border-slate-500/20';
        }
    };

    const getDecisionIcon = (decision: string) => {
        switch (decision) {
            case 'APPROVED': return <CheckCircle2 size={14} />;
            case 'REJECTED': return <XCircle size={14} />;
            case 'MODIFIED': return <RotateCcw size={14} />;
            default: return <History size={14} />;
        }
    };

    if (loading) {
        return (
            <div className="space-y-4 animate-pulse">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-24 bg-slate-100 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10" />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Export Buttons - Step 9.7 */}
            {onExport && records.length > 0 && (
                <div className="flex gap-2 mb-4">
                    <button
                        onClick={() => onExport('csv')}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl transition-all shadow-sm hover:shadow-md"
                    >
                        <FileSpreadsheet size={16} />
                        Export CSV
                    </button>
                    <button
                        onClick={() => onExport('json')}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl transition-all shadow-sm hover:shadow-md"
                    >
                        <FileJson size={16} />
                        Export JSON
                    </button>
                </div>
            )}

            {records.length === 0 ? (
                <div className="text-center py-12 opacity-50 border border-dashed border-slate-200 dark:border-white/5 rounded-xl">
                    <p className="text-sm">No decisions have been recorded yet.</p>
                </div>
            ) : (
                records.map((record) => (
                    <div key={record.id} className="p-4 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/5 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className={`flex items-center gap-2 px-2 py-1 rounded text-[10px] font-bold border ${getDecisionStyles(record.decision)}`}>
                                    {getDecisionIcon(record.decision)}
                                    {record.decision}
                                </div>
                                {/* Policy Engine Badge */}
                                {record.decided_by_user_id === 'SYSTEM_POLICY_ENGINE' && (
                                    <div className="flex items-center gap-1 px-2 py-1 rounded bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 text-[10px] font-bold border border-violet-200 dark:border-violet-500/20">
                                        <CheckCircle2 size={10} />
                                        AUTO-APPROVED (Policy)
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                                <Calendar size={12} />
                                {new Date(record.created_at).toLocaleString()}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-start gap-2">
                                <User size={14} className="text-slate-400 mt-0.5 shrink-0" />
                                <div className="text-sm">
                                    <span className="font-bold text-navy-900 dark:text-white">
                                        {record.decided_by_user_id === 'SYSTEM_POLICY_ENGINE'
                                            ? 'Policy Engine (Automated)'
                                            : (record.first_name ? `${record.first_name} ${record.last_name}` : record.decided_by_user_id)
                                        }
                                    </span>
                                    <span className="text-slate-500 ml-2 text-xs">
                                        ({record.decided_by_user_id === 'SYSTEM_POLICY_ENGINE'
                                            ? 'System'
                                            : (record.user_email || 'Manual Approval')
                                        })
                                    </span>
                                </div>
                            </div>

                            {record.decision_reason && (
                                <div className="p-3 bg-slate-50 dark:bg-navy-950 rounded-lg flex items-start gap-3">
                                    <MessageSquare size={14} className="text-indigo-400 mt-1 shrink-0" />
                                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed italic">
                                        "{record.decision_reason}"
                                    </p>
                                </div>
                            )}

                            <div className="flex gap-4 text-[10px] text-slate-400 font-mono">
                                <span>PROPOSAL ID: {record.proposal_id}</span>
                                {record.policy_rule_id && (
                                    <span className="text-violet-400">RULE ID: {record.policy_rule_id}</span>
                                )}
                            </div>
                        </div>
                    </div>
                ))
            )}
        </div>
    );
};
