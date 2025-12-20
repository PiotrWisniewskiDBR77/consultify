import React, { useEffect, useState } from 'react';
import {
    FileQuestion,
    CheckCircle2,
    XCircle,
    Clock,
    User,
    AlertTriangle,
    ChevronRight,
    Loader2
} from 'lucide-react';
import { Api } from '../../services/api';
import toast from 'react-hot-toast';
import { useAppStore } from '../../store/useAppStore';

interface Decision {
    id: string;
    title: string;
    description?: string;
    decisionType: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'DEFERRED';
    decisionOwnerId?: string;
    ownerName?: string;
    projectName?: string;
    createdAt: string;
    daysWaiting?: number;
    blockedItemsCount?: number;
}

interface DecisionsPanelProps {
    onDecisionClick?: (id: string) => void;
}

/**
 * Decisions Panel - Shows pending decisions for the user
 * Part of PMO execution engine - surfaces decision debt
 */
export const DecisionsPanel: React.FC<DecisionsPanelProps> = ({ onDecisionClick }) => {
    const [decisions, setDecisions] = useState<Decision[]>([]);
    const [loading, setLoading] = useState(true);
    const currentProjectId = useAppStore(state => state.currentProjectId);

    useEffect(() => {
        fetchDecisions();
    }, [currentProjectId]);

    const fetchDecisions = async () => {
        try {
            setLoading(true);
            const url = currentProjectId
                ? `/decisions?projectId=${currentProjectId}`
                : `/decisions`;
            const data = await Api.get(url);
            setDecisions(data || []);
        } catch (error) {
            console.error('Failed to fetch decisions:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDecide = async (id: string, status: 'APPROVED' | 'REJECTED', e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await Api.put(`/decisions/${id}/decide`, { status, outcome: '' });
            toast.success(`Decision ${status.toLowerCase()}`);
            fetchDecisions();
        } catch (error) {
            console.error('Failed to decide:', error);
            toast.error('Failed to update decision');
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'INITIATIVE_APPROVAL': return '🎯';
            case 'PHASE_TRANSITION': return '🚀';
            case 'UNBLOCK': return '🔓';
            case 'CANCEL': return '❌';
            default: return '📋';
        }
    };

    const getUrgencyColor = (daysWaiting: number = 0) => {
        if (daysWaiting > 14) return 'border-red-500 bg-red-50 dark:bg-red-900/10';
        if (daysWaiting > 7) return 'border-orange-500 bg-orange-50 dark:bg-orange-900/10';
        return 'border-slate-200 dark:border-white/10 bg-white dark:bg-navy-900';
    };

    const pendingDecisions = decisions.filter(d => d.status === 'PENDING');
    const recentDecisions = decisions.filter(d => d.status !== 'PENDING').slice(0, 5);

    if (loading) {
        return (
            <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-white/10 p-8 flex items-center justify-center">
                <Loader2 className="animate-spin text-purple-500" size={24} />
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm h-full flex flex-col">
            {/* Header */}
            <div className="p-5 border-b border-slate-200 dark:border-white/5">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-600 text-white rounded-lg shadow-sm">
                        <FileQuestion size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-navy-900 dark:text-white">Decisions</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            {pendingDecisions.length} pending • {recentDecisions.length} recent
                        </p>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
                {/* Pending Decisions */}
                {pendingDecisions.length > 0 && (
                    <div className="space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">
                            Awaiting Your Decision
                        </h4>
                        {pendingDecisions.map(decision => (
                            <div
                                key={decision.id}
                                onClick={() => onDecisionClick?.(decision.id)}
                                className={`p-4 rounded-xl border-l-4 ${getUrgencyColor(decision.daysWaiting)} cursor-pointer hover:shadow-md transition-all`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span>{getTypeIcon(decision.decisionType)}</span>
                                            <h4 className="text-sm font-semibold text-navy-900 dark:text-white truncate">
                                                {decision.title}
                                            </h4>
                                        </div>
                                        {decision.description && (
                                            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-2">
                                                {decision.description}
                                            </p>
                                        )}
                                        <div className="flex items-center gap-3 text-[10px] text-slate-400">
                                            {decision.projectName && (
                                                <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">
                                                    {decision.projectName}
                                                </span>
                                            )}
                                            <span className="flex items-center gap-1">
                                                <Clock size={10} />
                                                {decision.daysWaiting || 0} days
                                            </span>
                                            {(decision.blockedItemsCount || 0) > 0 && (
                                                <span className="flex items-center gap-1 text-red-500">
                                                    <AlertTriangle size={10} />
                                                    Blocks {decision.blockedItemsCount} items
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex gap-2 shrink-0">
                                        <button
                                            onClick={(e) => handleDecide(decision.id, 'APPROVED', e)}
                                            className="p-2 rounded-lg bg-green-100 text-green-600 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50 transition-colors"
                                            title="Approve"
                                        >
                                            <CheckCircle2 size={16} />
                                        </button>
                                        <button
                                            onClick={(e) => handleDecide(decision.id, 'REJECTED', e)}
                                            className="p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 transition-colors"
                                            title="Reject"
                                        >
                                            <XCircle size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* No Pending Decisions */}
                {pendingDecisions.length === 0 && (
                    <div className="text-center p-8 text-slate-400">
                        <CheckCircle2 size={32} className="mx-auto mb-2 text-green-500" />
                        <p className="text-sm font-medium">No pending decisions</p>
                        <p className="text-xs">All caught up!</p>
                    </div>
                )}

                {/* Recent Decisions */}
                {recentDecisions.length > 0 && (
                    <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-white/5">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">
                            Recent Decisions
                        </h4>
                        {recentDecisions.map(decision => (
                            <div
                                key={decision.id}
                                className="p-3 rounded-lg bg-slate-50 dark:bg-navy-800/50 flex items-center gap-3"
                            >
                                {decision.status === 'APPROVED' ? (
                                    <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                                ) : (
                                    <XCircle size={16} className="text-red-500 shrink-0" />
                                )}
                                <span className="text-sm text-slate-600 dark:text-slate-300 truncate flex-1">
                                    {decision.title}
                                </span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${decision.status === 'APPROVED'
                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                    }`}>
                                    {decision.status}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DecisionsPanel;
