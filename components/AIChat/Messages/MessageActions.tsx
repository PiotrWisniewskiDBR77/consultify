/**
 * MessageActions - Hover actions for chat messages
 * User messages: Edit, Delete
 * AI messages: Regenerate, Copy, Feedback (thumbs up/down), Report, Download
 */

import {
    AlertTriangle,
    Bookmark,
    Check,
    Copy,
    Download,
    FileCode,
    Flag,
    MoreHorizontal,
    Pencil,
    RefreshCw,
    Share,
    ThumbsDown,
    ThumbsUp,
    Trash2,
    Volume2,
} from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ChatMessage, MessageFeedback } from '../../../types';

interface MessageActionsProps {
    message: ChatMessage;
    onEdit?: (messageId: string) => void;
    onDelete?: (messageId: string) => void;
    onRegenerate?: (messageId: string) => void;
    onCopy?: (content: string) => void;
    onFeedback?: (messageId: string, feedback: MessageFeedback) => void;
    onReport?: (messageId: string, reason: string) => void;
    onDownload?: (messageId: string, content: string) => void;
    onViewArtifacts?: (messageId: string) => void;
    onSpeak?: (content: string) => void;
    showAlwaysVisible?: boolean; // Show core actions always, not just on hover
    className?: string;
}

export const MessageActions: React.FC<MessageActionsProps> = ({
    message,
    onEdit,
    onDelete,
    onRegenerate,
    onCopy,
    onFeedback,
    onReport,
    onDownload,
    onViewArtifacts,
    onSpeak,
    showAlwaysVisible = false,
    className = '',
}) => {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);
    const [showMore, setShowMore] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportReason, setReportReason] = useState('');

    const isUserMessage = message.role === 'user';
    const isAIMessage = message.role === 'ai';
    const hasArtifacts = message.artifacts && message.artifacts.length > 0;
    const hasFeedback = message.feedback !== undefined;

    const handleCopy = useCallback(async () => {
        if (!onCopy) {
            try {
                await navigator.clipboard.writeText(message.content);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            } catch (err) {
                console.error('Failed to copy:', err);
            }
        } else {
            onCopy(message.content);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    }, [message.content, onCopy]);

    const handleFeedback = useCallback(
        (rating: 'positive' | 'negative') => {
            if (onFeedback) {
                onFeedback(message.id, {
                    rating,
                    timestamp: new Date(),
                });
            }
        },
        [message.id, onFeedback],
    );

    const handleDownload = useCallback(() => {
        // Create a downloadable text file
        const blob = new Blob([message.content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ai-response-${new Date().toISOString().slice(0, 10)}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        if (onDownload) {
            onDownload(message.id, message.content);
        }
    }, [message.id, message.content, onDownload]);

    const handleReport = useCallback(() => {
        if (onReport && reportReason.trim()) {
            onReport(message.id, reportReason.trim());
            setShowReportModal(false);
            setReportReason('');
        }
    }, [message.id, reportReason, onReport]);

    return (
        <div className={`flex items-center gap-0.5 ${className}`}>
            {/* User Message Actions */}
            {isUserMessage && (
                <>
                    {message.canEdit && onEdit && (
                        <ActionButton
                            icon={<Pencil size={14} />}
                            label={t('chat.actions.edit', 'Edit')}
                            onClick={() => onEdit(message.id)}
                        />
                    )}
                    {onDelete && (
                        <ActionButton
                            icon={<Trash2 size={14} />}
                            label={t('chat.actions.delete', 'Delete')}
                            onClick={() => onDelete(message.id)}
                            variant="danger"
                        />
                    )}
                </>
            )}

            {/* AI Message Actions */}
            {isAIMessage && (
                <>
                    {/* Copy */}
                    <ActionButton
                        icon={copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                        label={copied ? t('chat.actions.copied', 'Copied!') : t('chat.actions.copy', 'Copy')}
                        onClick={handleCopy}
                    />

                    {/* Download */}
                    <ActionButton
                        icon={<Download size={14} />}
                        label={t('chat.actions.download', 'Download')}
                        onClick={handleDownload}
                    />

                    {/* Feedback - always show */}
                    {!hasFeedback ? (
                        <>
                            <ActionButton
                                icon={<ThumbsUp size={14} />}
                                label={t('chat.actions.helpful', 'Helpful')}
                                onClick={() => handleFeedback('positive')}
                            />
                            <ActionButton
                                icon={<ThumbsDown size={14} />}
                                label={t('chat.actions.notHelpful', 'Not helpful')}
                                onClick={() => handleFeedback('negative')}
                            />
                        </>
                    ) : (
                        <span
                            className={`px-1.5 py-0.5 rounded text-xs ${
                                message.feedback?.rating === 'positive'
                                    ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                                    : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                            }`}
                        >
                            {message.feedback?.rating === 'positive' ? '👍' : '👎'}
                        </span>
                    )}

                    {/* Report Problem */}
                    <ActionButton
                        icon={<Flag size={14} />}
                        label={t('chat.actions.report', 'Report issue')}
                        onClick={() => setShowReportModal(true)}
                        variant="danger"
                    />

                    {/* Regenerate */}
                    {onRegenerate && (
                        <ActionButton
                            icon={<RefreshCw size={14} />}
                            label={t('chat.actions.regenerate', 'Regenerate')}
                            onClick={() => onRegenerate(message.id)}
                        />
                    )}

                    {/* View Artifacts */}
                    {hasArtifacts && onViewArtifacts && (
                        <ActionButton
                            icon={<FileCode size={14} />}
                            label={t('chat.actions.viewArtifacts', 'View Artifacts')}
                            onClick={() => onViewArtifacts(message.id)}
                            highlight
                        />
                    )}

                    {/* Speak */}
                    {onSpeak && (
                        <ActionButton
                            icon={<Volume2 size={14} />}
                            label={t('chat.actions.speak', 'Speak')}
                            onClick={() => onSpeak(message.content)}
                        />
                    )}

                    {/* More menu */}
                    <div className="relative">
                        <ActionButton
                            icon={<MoreHorizontal size={14} />}
                            label={t('chat.actions.more', 'More')}
                            onClick={() => setShowMore(!showMore)}
                        />

                        {showMore && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setShowMore(false)} />
                                <div className="absolute right-0 top-full mt-1 py-1 bg-white dark:bg-navy-800 rounded-lg shadow-lg border border-slate-200 dark:border-navy-700 z-20 min-w-[160px]">
                                    <DropdownItem
                                        icon={<Share size={14} />}
                                        label={t('chat.actions.share', 'Share')}
                                        onClick={() => {
                                            // Share functionality
                                            setShowMore(false);
                                        }}
                                    />
                                    <DropdownItem
                                        icon={<Bookmark size={14} />}
                                        label={t('chat.actions.bookmark', 'Bookmark')}
                                        onClick={() => {
                                            // Bookmark functionality
                                            setShowMore(false);
                                        }}
                                    />
                                </div>
                            </>
                        )}
                    </div>
                </>
            )}

            {/* Report Modal */}
            {showReportModal && (
                <>
                    <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setShowReportModal(false)} />
                    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md p-6 bg-white dark:bg-navy-900 rounded-2xl shadow-2xl">
                        <div className="flex items-center gap-2 mb-4 text-red-600 dark:text-red-400">
                            <AlertTriangle size={20} />
                            <h3 className="font-semibold text-lg">{t('chat.report.title', 'Report an issue')}</h3>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                            {t('chat.report.description', 'Let us know what went wrong with this response.')}
                        </p>
                        <div className="space-y-3 mb-4">
                            {[
                                { key: 'harmful', label: t('chat.report.harmful', 'Harmful or unsafe content') },
                                { key: 'incorrect', label: t('chat.report.incorrect', 'Factually incorrect') },
                                { key: 'unhelpful', label: t('chat.report.unhelpful', 'Not helpful or relevant') },
                                { key: 'other', label: t('chat.report.other', 'Other issue') },
                            ].map((option) => (
                                <button
                                    key={option.key}
                                    onClick={() => setReportReason(option.key)}
                                    className={`w-full px-4 py-2 text-left rounded-lg border transition-colors ${
                                        reportReason === option.key
                                            ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                                            : 'border-slate-200 dark:border-navy-700 hover:bg-slate-50 dark:hover:bg-navy-800'
                                    }`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                        {reportReason === 'other' && (
                            <textarea
                                placeholder={t('chat.report.otherPlaceholder', 'Describe the issue...')}
                                className="w-full px-3 py-2 mb-4 rounded-lg border border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-800 resize-none"
                                rows={3}
                                onChange={(e) => setReportReason(`other: ${e.target.value}`)}
                            />
                        )}
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowReportModal(false);
                                    setReportReason('');
                                }}
                                className="flex-1 px-4 py-2 rounded-lg border border-slate-300 dark:border-navy-700 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
                            >
                                {t('common.cancel', 'Cancel')}
                            </button>
                            <button
                                onClick={handleReport}
                                disabled={!reportReason}
                                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {t('chat.report.submit', 'Report')}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

// ==================== Sub-components ====================

interface ActionButtonProps {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    variant?: 'default' | 'danger';
    highlight?: boolean;
}

const ActionButton: React.FC<ActionButtonProps> = ({
    icon,
    label,
    onClick,
    variant = 'default',
    highlight = false,
}) => {
    const baseClasses = 'p-1.5 rounded-md transition-colors';
    const variantClasses = {
        default: highlight
            ? 'text-brand hover:bg-brand/10 dark:text-brand-light dark:hover:bg-brand/20'
            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-700',
        danger: 'text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20',
    };

    return (
        <button onClick={onClick} className={`${baseClasses} ${variantClasses[variant]}`} title={label}>
            {icon}
        </button>
    );
};

interface DropdownItemProps {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
}

const DropdownItem: React.FC<DropdownItemProps> = ({ icon, label, onClick }) => (
    <button
        onClick={onClick}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
    >
        {icon}
        {label}
    </button>
);

export default MessageActions;
