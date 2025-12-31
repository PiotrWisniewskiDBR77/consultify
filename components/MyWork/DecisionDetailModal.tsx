/**
 * DecisionDetailModal - Context-aware decision making modal
 * Shows full context, related objects, and requires rationale for decisions
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    Scale,
    Target,
    CheckSquare,
    Clock,
    User,
    Calendar,
    AlertCircle,
    Check,
    XCircle,
    Loader2,
    ExternalLink,
    History,
    Sparkles,
    FileText
} from 'lucide-react';
import { Api } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';
import toast from 'react-hot-toast';
import { Decision } from './DecisionsList';
import RelatedObjectPreview from './RelatedObjectPreview';

interface DecisionDetail extends Decision {
    auditTrail?: AuditEntry[];
    impacts?: DecisionImpact[];
    aiBrief?: AIBrief;
}

interface AuditEntry {
    action: string;
    by: string;
    byName?: string;
    at: string;
    notes?: string;
}

interface DecisionImpact {
    id: string;
    impactedType: string;
    impactedId: string;
    impactDescription: string;
    isBlocker: boolean;
}

interface AIBrief {
    contextSummary: string;
    options?: { label: string; pros: string[]; cons: string[] }[];
    risks?: { description: string; severity: string }[];
    aiRecommendation?: string;
    recommendationRationale?: string;
    recommendationConfidence?: number;
}

interface DecisionDetailModalProps {
    decisionId: string;
    onClose: () => void;
    onDecisionMade?: () => void;
    onNavigateToObject?: (type: string, id: string) => void;
}

// Priority badge styles
const getPriorityStyle = (priority?: string) => {
    switch (priority?.toUpperCase()) {
        case 'CRITICAL':
            return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
        case 'HIGH':
            return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300';
        case 'MEDIUM':
            return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300';
        default:
            return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400';
    }
};

// Type label mapping
const getTypeLabel = (type: string): string => {
    const types: Record<string, string> = {
        'INITIATIVE_APPROVAL': 'Initiative Approval',
        'PHASE_TRANSITION': 'Phase Transition',
        'TASK_UNBLOCK': 'Unblock Task',
        'UNBLOCK': 'Unblock',
        'BUDGET': 'Budget Approval',
        'SCOPE_CHANGE': 'Scope Change',
        'RESOURCE_ALLOCATION': 'Resource Allocation',
        'EXCEPTION': 'Exception',
        'GENERAL': 'General Decision'
    };
    return types[type] || type.replace(/_/g, ' ');
};

// Format date for display
const formatDateTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

// Section component
const Section: React.FC<{ title: string; icon?: React.ReactNode; children: React.ReactNode }> = ({
    title,
    icon,
    children
}) => (
    <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            {icon}
            {title}
        </div>
        {children}
    </div>
);

export const DecisionDetailModal: React.FC<DecisionDetailModalProps> = ({
    decisionId,
    onClose,
    onDecisionMade,
    onNavigateToObject
}) => {
    const { t } = useTranslation();
    const [decision, setDecision] = useState<DecisionDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [outcome, setOutcome] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [confirmAction, setConfirmAction] = useState<'approve' | 'reject' | null>(null);

    const currentUserId = useAppStore(state => state.user?.id);
    const isOwner = decision?.decisionOwnerId === currentUserId;

    // Fetch decision details
    useEffect(() => {
        const fetchDecision = async () => {
            try {
                setLoading(true);
                const data = await Api.get(`/decisions/${decisionId}`);
                
                // Parse audit trail if string
                if (typeof data.audit_trail === 'string') {
                    try {
                        data.auditTrail = JSON.parse(data.audit_trail);
                    } catch {
                        data.auditTrail = [];
                    }
                } else if (data.auditTrail) {
                    // Already parsed
                } else {
                    data.auditTrail = [];
                }

                // Map snake_case to camelCase
                setDecision({
                    id: data.id,
                    title: data.title,
                    description: data.description,
                    decisionType: data.decision_type || data.decisionType,
                    status: data.status,
                    priority: data.priority,
                    decisionOwnerId: data.decision_owner_id || data.decisionOwnerId,
                    ownerName: data.owner_name || data.ownerName,
                    requestedById: data.requested_by_id || data.requestedById,
                    requestedByName: data.requested_by_name || data.requestedByName,
                    createdAt: data.created_at || data.createdAt,
                    dueDate: data.due_date || data.dueDate,
                    relatedObjectType: data.related_object_type || data.relatedObjectType,
                    relatedObjectId: data.related_object_id || data.relatedObjectId,
                    relatedObjectName: data.related_object_name || data.relatedObjectName,
                    auditTrail: data.auditTrail,
                    impacts: data.impacts || [],
                    aiBrief: data.aiBrief
                });
            } catch (error) {
                console.error('Failed to fetch decision:', error);
                toast.error(t('decisions.fetchError', 'Failed to load decision'));
            } finally {
                setLoading(false);
            }
        };

        fetchDecision();
    }, [decisionId, t]);

    // Handle decision submission
    const handleDecision = async (status: 'APPROVED' | 'REJECTED') => {
        if (!outcome.trim()) {
            toast.error(t('decisions.rationaleRequired', 'Please provide a rationale for your decision'));
            return;
        }

        try {
            setSubmitting(true);
            await Api.put(`/decisions/${decisionId}/decide`, { 
                status, 
                outcome: outcome.trim() 
            });
            
            toast.success(
                status === 'APPROVED' 
                    ? t('decisions.approved', 'Decision approved') 
                    : t('decisions.rejected', 'Decision rejected')
            );
            
            onDecisionMade?.();
            onClose();
        } catch (error) {
            console.error('Failed to submit decision:', error);
            toast.error(t('decisions.submitError', 'Failed to submit decision'));
        } finally {
            setSubmitting(false);
            setConfirmAction(null);
        }
    };

    // Close on escape
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    transition={{ duration: 0.2 }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-2xl max-h-[85vh] bg-white dark:bg-navy-900 rounded-xl shadow-2xl overflow-hidden flex flex-col"
                >
                    {loading ? (
                        <div className="flex-1 flex items-center justify-center p-12">
                            <Loader2 className="animate-spin text-purple-500" size={32} />
                        </div>
                    ) : decision ? (
                        <>
                            {/* Header */}
                            <div className="shrink-0 p-4 border-b border-slate-200 dark:border-white/10">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="space-y-2">
                                        {/* Type + Priority badges */}
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-medium">
                                                {getTypeLabel(decision.decisionType)}
                                            </span>
                                            {decision.priority && (
                                                <span className={`text-xs px-2 py-0.5 rounded font-medium ${getPriorityStyle(decision.priority)}`}>
                                                    {decision.priority}
                                                </span>
                                            )}
                                            {decision.status !== 'PENDING' && (
                                                <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                                                    decision.status === 'APPROVED' 
                                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                                        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                                }`}>
                                                    {decision.status}
                                                </span>
                                            )}
                                        </div>
                                        
                                        {/* Title */}
                                        <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                                            {decision.title}
                                        </h2>
                                    </div>
                                    
                                    <button
                                        onClick={onClose}
                                        className="shrink-0 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-5">
                                {/* Request Details */}
                                {decision.description && (
                                    <Section title={t('decisions.requestDetails', 'Request Details')} icon={<FileText size={14} />}>
                                        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                            {decision.description}
                                        </p>
                                    </Section>
                                )}

                                {/* Related Object Preview */}
                                {decision.relatedObjectType && decision.relatedObjectId && (
                                    <Section title={t('decisions.relatedItem', 'Related Item')} icon={<Target size={14} />}>
                                        <RelatedObjectPreview
                                            type={decision.relatedObjectType}
                                            id={decision.relatedObjectId}
                                            onNavigate={onNavigateToObject}
                                        />
                                    </Section>
                                )}

                                {/* AI Brief */}
                                {decision.aiBrief && (
                                    <Section title={t('decisions.aiBrief', 'AI Analysis')} icon={<Sparkles size={14} />}>
                                        <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-100 dark:border-purple-800/30">
                                            <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
                                                {decision.aiBrief.contextSummary}
                                            </p>
                                            
                                            {decision.aiBrief.aiRecommendation && (
                                                <div className="pt-2 border-t border-purple-200 dark:border-purple-700/30">
                                                    <span className="text-xs font-medium text-purple-600 dark:text-purple-400">
                                                        AI Recommendation:
                                                    </span>
                                                    <p className="text-sm text-slate-700 dark:text-slate-200 mt-1">
                                                        {decision.aiBrief.aiRecommendation}
                                                    </p>
                                                    {decision.aiBrief.recommendationConfidence && (
                                                        <span className="text-xs text-slate-500 mt-1">
                                                            Confidence: {Math.round(decision.aiBrief.recommendationConfidence * 100)}%
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </Section>
                                )}

                                {/* Impacts */}
                                {decision.impacts && decision.impacts.length > 0 && (
                                    <Section title={t('decisions.impacts', 'Impact Analysis')} icon={<AlertCircle size={14} />}>
                                        <div className="space-y-2">
                                            {decision.impacts.map((impact, idx) => (
                                                <div 
                                                    key={impact.id || idx}
                                                    className={`p-2 rounded-lg text-sm ${
                                                        impact.isBlocker 
                                                            ? 'bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30'
                                                            : 'bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        {impact.isBlocker && (
                                                            <span className="text-xs px-1.5 py-0.5 bg-red-100 dark:bg-red-800/50 text-red-600 dark:text-red-300 rounded font-medium">
                                                                Blocking
                                                            </span>
                                                        )}
                                                        <span className="text-xs text-slate-500 dark:text-slate-400">
                                                            {impact.impactedType}
                                                        </span>
                                                    </div>
                                                    <p className="text-slate-600 dark:text-slate-300 mt-1">
                                                        {impact.impactDescription}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </Section>
                                )}

                                {/* Meta Information */}
                                <Section title={t('decisions.details', 'Details')} icon={<Calendar size={14} />}>
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div>
                                            <span className="text-xs text-slate-400 dark:text-slate-500">Owner</span>
                                            <p className="text-slate-700 dark:text-slate-200">
                                                {decision.ownerName || 'Unassigned'}
                                            </p>
                                        </div>
                                        <div>
                                            <span className="text-xs text-slate-400 dark:text-slate-500">Requested by</span>
                                            <p className="text-slate-700 dark:text-slate-200">
                                                {decision.requestedByName || 'Unknown'}
                                            </p>
                                        </div>
                                        <div>
                                            <span className="text-xs text-slate-400 dark:text-slate-500">Created</span>
                                            <p className="text-slate-700 dark:text-slate-200">
                                                {formatDateTime(decision.createdAt)}
                                            </p>
                                        </div>
                                        {decision.dueDate && (
                                            <div>
                                                <span className="text-xs text-slate-400 dark:text-slate-500">Due Date</span>
                                                <p className="text-slate-700 dark:text-slate-200">
                                                    {formatDateTime(decision.dueDate)}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </Section>

                                {/* Audit Trail */}
                                {decision.auditTrail && decision.auditTrail.length > 0 && (
                                    <Section title={t('decisions.history', 'History')} icon={<History size={14} />}>
                                        <div className="space-y-2">
                                            {decision.auditTrail.map((entry, idx) => (
                                                <div 
                                                    key={idx}
                                                    className="flex items-start gap-2 text-sm"
                                                >
                                                    <div className="shrink-0 w-2 h-2 mt-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                                                    <div className="flex-1">
                                                        <span className="font-medium text-slate-700 dark:text-slate-200">
                                                            {entry.action}
                                                        </span>
                                                        {entry.byName && (
                                                            <span className="text-slate-500 dark:text-slate-400">
                                                                {' '}by {entry.byName}
                                                            </span>
                                                        )}
                                                        <span className="text-xs text-slate-400 dark:text-slate-500 ml-2">
                                                            {formatDateTime(entry.at)}
                                                        </span>
                                                        {entry.notes && (
                                                            <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                                                                "{entry.notes}"
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </Section>
                                )}
                            </div>

                            {/* Footer - Decision Actions (only for owner and pending status) */}
                            {isOwner && decision.status === 'PENDING' && (
                                <div className="shrink-0 p-4 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-navy-800/50 space-y-3">
                                    {/* Outcome textarea */}
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                            {t('decisions.rationale', 'Decision Rationale')} *
                                        </label>
                                        <textarea
                                            value={outcome}
                                            onChange={(e) => setOutcome(e.target.value)}
                                            placeholder={t('decisions.rationalePlaceholder', 'Explain your decision...')}
                                            className="w-full p-3 text-sm bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg resize-none h-20 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                        />
                                    </div>

                                    {/* Action buttons */}
                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            onClick={onClose}
                                            className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                                        >
                                            {t('common.cancel', 'Cancel')}
                                        </button>
                                        
                                        <button
                                            onClick={() => handleDecision('REJECTED')}
                                            disabled={submitting || !outcome.trim()}
                                            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 hover:border-red-300 dark:hover:border-red-500/50 hover:text-red-600 dark:hover:text-red-400 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            <span className="flex items-center gap-1.5">
                                                <XCircle size={14} />
                                                {t('decisions.reject', 'Reject')}
                                            </span>
                                        </button>
                                        
                                        <button
                                            onClick={() => handleDecision('APPROVED')}
                                            disabled={submitting || !outcome.trim()}
                                            className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                                        >
                                            {submitting ? (
                                                <Loader2 size={14} className="animate-spin" />
                                            ) : (
                                                <Check size={14} />
                                            )}
                                            {t('decisions.approve', 'Approve')}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Read-only footer for non-owners */}
                            {(!isOwner || decision.status !== 'PENDING') && (
                                <div className="shrink-0 p-4 border-t border-slate-200 dark:border-white/10 flex justify-end">
                                    <button
                                        onClick={onClose}
                                        className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                                    >
                                        {t('common.close', 'Close')}
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center p-12">
                            <p className="text-slate-500 dark:text-slate-400">
                                {t('decisions.notFound', 'Decision not found')}
                            </p>
                        </div>
                    )}
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default DecisionDetailModal;

