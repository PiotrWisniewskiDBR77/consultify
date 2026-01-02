/**
 * InlineApprovalButtons Component
 * 
 * Displays inline approval/rejection buttons in chat messages
 * when AI mentions pending proposals.
 * 
 * Features:
 * - Approve/Reject buttons with loading states
 * - "Always approve similar" checkbox for pattern learning
 * - Pattern info display (shows if similar to previous decisions)
 * - Voice command hints
 */

import React, { useState } from 'react';
import { CheckCircle, XCircle, Repeat, Info, Loader2, Brain } from 'lucide-react';
import api from '../../services/api';

export interface PendingAction {
    id: string;
    actionType: string;
    title: string;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    patternInfo?: {
        message: string;
        decisionCount: number;
        decision: string;
        confidence: number;
    };
}

interface InlineApprovalButtonsProps {
    action: PendingAction;
    onApprove?: (actionId: string, patternLearned: boolean) => void;
    onReject?: (actionId: string, patternLearned: boolean) => void;
    onSkip?: () => void;
    compact?: boolean;
    showVoiceHints?: boolean;
    language?: 'en' | 'pl';
}

const RISK_COLORS = {
    LOW: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    MEDIUM: 'text-amber-600 bg-amber-50 border-amber-200',
    HIGH: 'text-red-600 bg-red-50 border-red-200'
};

export const InlineApprovalButtons: React.FC<InlineApprovalButtonsProps> = ({
    action,
    onApprove,
    onReject,
    onSkip,
    compact = false,
    showVoiceHints = false,
    language = 'pl'
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [loadingAction, setLoadingAction] = useState<'approve' | 'reject' | null>(null);
    const [alwaysApply, setAlwaysApply] = useState(false);
    const [completed, setCompleted] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

    const handleApprove = async () => {
        setIsLoading(true);
        setLoadingAction('approve');
        
        try {
            const response = await api.post(`/ai/actions/${action.id}/approve`, {
                alwaysApprove: alwaysApply
            });
            
            if (response.data?.success) {
                setResult({
                    success: true,
                    message: language === 'pl' 
                        ? `Zatwierdzono${response.data?.patternLearned ? '. Wzorzec zapamiętany.' : '.'}`
                        : `Approved${response.data?.patternLearned ? '. Pattern learned.' : '.'}`
                });
                setCompleted(true);
                onApprove?.(action.id, response.data?.patternLearned);
            } else {
                setResult({
                    success: false,
                    message: response.data?.error || 'Failed to approve'
                });
            }
        } catch (error: any) {
            setResult({
                success: false,
                message: error.message || 'Failed to approve'
            });
        } finally {
            setIsLoading(false);
            setLoadingAction(null);
        }
    };

    const handleReject = async () => {
        setIsLoading(true);
        setLoadingAction('reject');
        
        try {
            const response = await api.post(`/ai/actions/${action.id}/reject`, {
                alwaysReject: alwaysApply
            });
            
            if (response.data?.success) {
                setResult({
                    success: true,
                    message: language === 'pl' 
                        ? `Odrzucono${response.data?.patternLearned ? '. Wzorzec zapamiętany.' : '.'}`
                        : `Rejected${response.data?.patternLearned ? '. Pattern learned.' : '.'}`
                });
                setCompleted(true);
                onReject?.(action.id, response.data?.patternLearned);
            } else {
                setResult({
                    success: false,
                    message: response.data?.error || 'Failed to reject'
                });
            }
        } catch (error: any) {
            setResult({
                success: false,
                message: error.message || 'Failed to reject'
            });
        } finally {
            setIsLoading(false);
            setLoadingAction(null);
        }
    };

    if (completed && result) {
        return (
            <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg ${
                result.success 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                    : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
                {result.success ? <CheckCircle size={16} /> : <XCircle size={16} />}
                <span className="text-sm font-medium">{result.message}</span>
            </div>
        );
    }

    return (
        <div className={`${compact ? 'inline-flex items-center gap-2' : 'flex flex-col gap-3'} p-3 bg-slate-50 dark:bg-navy-900/50 rounded-lg border border-slate-200 dark:border-white/10`}>
            {/* Action Info */}
            <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${RISK_COLORS[action.riskLevel]}`}>
                    {action.riskLevel}
                </span>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {action.title || action.actionType.replace(/_/g, ' ')}
                </span>
            </div>

            {/* Pattern Info (if exists) */}
            {action.patternInfo && !compact && (
                <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded">
                    <Brain size={14} />
                    <span>{action.patternInfo.message}</span>
                </div>
            )}

            {/* Buttons */}
            <div className="flex items-center gap-2">
                <button
                    onClick={handleApprove}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                    {loadingAction === 'approve' ? (
                        <Loader2 size={14} className="animate-spin" />
                    ) : (
                        <CheckCircle size={14} />
                    )}
                    {language === 'pl' ? 'Akceptuj' : 'Approve'}
                </button>

                <button
                    onClick={handleReject}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 dark:bg-navy-700 hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-700 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                    {loadingAction === 'reject' ? (
                        <Loader2 size={14} className="animate-spin" />
                    ) : (
                        <XCircle size={14} />
                    )}
                    {language === 'pl' ? 'Odrzuć' : 'Reject'}
                </button>

                {onSkip && (
                    <button
                        onClick={onSkip}
                        disabled={isLoading}
                        className="px-2 py-1.5 text-slate-500 hover:text-slate-700 text-sm transition-colors disabled:opacity-50"
                    >
                        {language === 'pl' ? 'Pomiń' : 'Skip'}
                    </button>
                )}
            </div>

            {/* Always Apply Checkbox */}
            {!compact && (
                <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 cursor-pointer group">
                    <input
                        type="checkbox"
                        checked={alwaysApply}
                        onChange={(e) => setAlwaysApply(e.target.checked)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <Repeat size={12} className="group-hover:text-indigo-500" />
                    <span className="group-hover:text-slate-700 dark:group-hover:text-slate-300">
                        {language === 'pl' 
                            ? 'Zawsze tak postępuj z podobnymi' 
                            : 'Always handle similar this way'}
                    </span>
                </label>
            )}

            {/* Voice Hints */}
            {showVoiceHints && !compact && (
                <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-1">
                    <Info size={10} />
                    <span>
                        {language === 'pl' 
                            ? 'Powiedz: "akceptuj", "odrzuć" lub "zawsze akceptuj takie"' 
                            : 'Say: "approve", "reject" or "always approve this"'}
                    </span>
                </div>
            )}
        </div>
    );
};

/**
 * PendingApprovalsNotice Component
 * 
 * Displays a notice about pending approvals in chat
 */
interface PendingApprovalsNoticeProps {
    count: number;
    firstAction?: PendingAction;
    onShowDetails?: () => void;
    onApprove?: (actionId: string, patternLearned: boolean) => void;
    onReject?: (actionId: string, patternLearned: boolean) => void;
    language?: 'en' | 'pl';
}

export const PendingApprovalsNotice: React.FC<PendingApprovalsNoticeProps> = ({
    count,
    firstAction,
    onShowDetails,
    onApprove,
    onReject,
    language = 'pl'
}) => {
    if (count === 0) return null;

    return (
        <div className="space-y-3 p-4 bg-indigo-50/50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-500/20">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                        <Brain size={16} className="text-white" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                            {language === 'pl' 
                                ? `${count} ${count === 1 ? 'propozycja AI' : 'propozycji AI'} do zatwierdzenia`
                                : `${count} AI ${count === 1 ? 'proposal' : 'proposals'} pending approval`}
                        </p>
                        <p className="text-xs text-slate-500">
                            {language === 'pl' 
                                ? 'Powiedz "akceptuj" lub "odrzuć" aby kontynuować'
                                : 'Say "approve" or "reject" to continue'}
                        </p>
                    </div>
                </div>
                
                {onShowDetails && (
                    <button
                        onClick={onShowDetails}
                        className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                        {language === 'pl' ? 'Pokaż wszystkie' : 'Show all'}
                    </button>
                )}
            </div>

            {firstAction && (
                <InlineApprovalButtons
                    action={firstAction}
                    onApprove={onApprove}
                    onReject={onReject}
                    showVoiceHints
                    language={language}
                />
            )}
        </div>
    );
};

export default InlineApprovalButtons;



