import React, { useState, useEffect } from 'react';
import { Api } from '../../services/api';
import { usePMOStore } from '../../store/usePMOStore';
import { CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronUp, ArrowRight, Loader2 } from 'lucide-react';

/**
 * PMO Gate Status - Shows why user can't proceed to next phase
 * GAP-02: Gate blocking reasons must be visible
 */

interface GateCriterion {
    criterion: string;
    isMet: boolean;
    evidence?: string;
}

interface GateEvaluation {
    gateType: string;
    status: 'READY' | 'NOT_READY';
    completionCriteria: GateCriterion[];
    missingElements: string[];
    currentPhase?: string;
    nextPhase?: string;
}

interface GateStatusProps {
    projectId: string;
    compact?: boolean;
    onProceed?: () => void;
}

export const GateStatus: React.FC<GateStatusProps> = ({ projectId, compact = false, onProceed }) => {
    const [evaluation, setEvaluation] = useState<GateEvaluation | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { currentPhase, gateStatus, missingCriteria, fetchPMOContext } = usePMOStore();

    useEffect(() => {
        if (projectId) {
            fetchGateStatus();
        }
    }, [projectId]);

    const fetchGateStatus = async () => {
        if (!projectId) return;
        setIsLoading(true);
        setError(null);

        try {
            const res = await fetch(`/api/stage-gates/${projectId}/current`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!res.ok) throw new Error('Failed to fetch gate status');

            const data = await res.json();
            setEvaluation(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center gap-2 text-slate-500 text-sm p-3">
                <Loader2 size={16} className="animate-spin" />
                <span>Checking gate status...</span>
            </div>
        );
    }

    if (error || !evaluation) {
        return null;
    }

    const isReady = evaluation.status === 'READY';
    const metCriteria = evaluation.completionCriteria?.filter(c => c.isMet) || [];
    const unmetCriteria = evaluation.completionCriteria?.filter(c => !c.isMet) || [];
    const progress = evaluation.completionCriteria?.length
        ? Math.round((metCriteria.length / evaluation.completionCriteria.length) * 100)
        : 0;

    if (compact) {
        return (
            <div
                className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${isReady
                        ? 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/30'
                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                    }`}
                onClick={() => setIsExpanded(!isExpanded)}
                title={isReady ? 'Ready to proceed' : `${unmetCriteria.length} items missing`}
            >
                {isReady ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                <span className="text-sm font-medium">
                    {isReady ? 'Gate Ready' : `${unmetCriteria.length} Missing`}
                </span>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden">
            {/* Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isReady ? 'bg-green-500/10' : 'bg-amber-500/10'
                        }`}>
                        {isReady
                            ? <CheckCircle2 size={20} className="text-green-500" />
                            : <AlertTriangle size={20} className="text-amber-500" />
                        }
                    </div>
                    <div className="text-left">
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                            {evaluation.gateType?.replace(/_/g, ' ') || 'Next Gate'}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                            {evaluation.currentPhase} → {evaluation.nextPhase}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Progress */}
                    <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                            <div
                                className={`h-full transition-all ${isReady ? 'bg-green-500' : 'bg-amber-500'}`}
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            {progress}%
                        </span>
                    </div>

                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
            </button>

            {/* Expanded Content */}
            {isExpanded && (
                <div className="border-t border-slate-200 dark:border-white/10 divide-y divide-slate-100 dark:divide-white/5">
                    {/* Missing Items */}
                    {unmetCriteria.length > 0 && (
                        <div className="p-4">
                            <div className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-2">
                                Missing ({unmetCriteria.length})
                            </div>
                            <ul className="space-y-2">
                                {unmetCriteria.map((criterion, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm">
                                        <XCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                                        <span className="text-slate-700 dark:text-slate-300">
                                            {criterion.criterion}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Completed Items */}
                    {metCriteria.length > 0 && (
                        <div className="p-4">
                            <div className="text-xs font-semibold uppercase tracking-wider text-green-600 dark:text-green-400 mb-2">
                                Completed ({metCriteria.length})
                            </div>
                            <ul className="space-y-2">
                                {metCriteria.map((criterion, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm">
                                        <CheckCircle2 size={16} className="text-green-500 shrink-0 mt-0.5" />
                                        <span className="text-slate-600 dark:text-slate-400">
                                            {criterion.criterion}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Action Button */}
                    {isReady && onProceed && (
                        <div className="p-4 bg-slate-50 dark:bg-white/5">
                            <button
                                onClick={onProceed}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                            >
                                <span>Proceed to {evaluation.nextPhase}</span>
                                <ArrowRight size={18} />
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default GateStatus;
