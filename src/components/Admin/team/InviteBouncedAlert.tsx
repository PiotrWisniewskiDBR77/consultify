/**
 * InviteBouncedAlert - Invite bounced detection and alerts component
 *
 * Features:
 * - Bounced invitation list
 * - Bounce reason indicators
 * - Resend or cancel options
 * - Bulk actions
 * - Email validation suggestions
 *
 * Design: Alert banner with expandable list
 */

import {
    AlertCircle,
    AlertTriangle,
    Check,
    ChevronDown,
    ChevronRight,
    Clock,
    Mail,
    MailWarning,
    RefreshCw,
    Trash2,
    X,
} from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../../utils/cn';
import { Button } from '../../ui/primitives/Button';
import { Tooltip } from '../../ui/primitives/Tooltip';

// Bounce reason
export type BounceReason =
    | 'invalid_email'
    | 'mailbox_full'
    | 'domain_not_found'
    | 'rejected'
    | 'timeout'
    | 'spam_blocked'
    | 'unknown';

// Bounced invitation
export interface BouncedInvitation {
    id: string;
    email: string;
    invitedBy: string;
    invitedAt: string;
    bouncedAt: string;
    bounceReason: BounceReason;
    attempts: number;
    suggestedEmail?: string;
}

interface InviteBouncedAlertProps {
    bouncedInvitations: BouncedInvitation[];
    onResend?: (invitationId: string, email?: string) => void;
    onResendAll?: (invitationIds: string[]) => void;
    onCancel?: (invitationId: string) => void;
    onCancelAll?: (invitationIds: string[]) => void;
    onDismiss?: () => void;
    className?: string;
}

export const InviteBouncedAlert: React.FC<InviteBouncedAlertProps> = ({
    bouncedInvitations,
    onResend,
    onResendAll,
    onCancel,
    onCancelAll,
    onDismiss,
    className,
}) => {
    const { t } = useTranslation();
    const [isExpanded, setIsExpanded] = useState(false);
    const [selectedInvitations, setSelectedInvitations] = useState<Set<string>>(new Set());
    const [editingEmail, setEditingEmail] = useState<string | null>(null);
    const [correctedEmail, setCorrectedEmail] = useState('');

    // Get bounce reason label and severity
    const getBounceInfo = (reason: BounceReason) => {
        switch (reason) {
            case 'invalid_email':
                return {
                    label: t('admin.team.bounced.invalidEmail', 'Invalid email address'),
                    severity: 'error' as const,
                    canRetry: false,
                };
            case 'mailbox_full':
                return {
                    label: t('admin.team.bounced.mailboxFull', 'Mailbox full'),
                    severity: 'warning' as const,
                    canRetry: true,
                };
            case 'domain_not_found':
                return {
                    label: t('admin.team.bounced.domainNotFound', 'Domain not found'),
                    severity: 'error' as const,
                    canRetry: false,
                };
            case 'rejected':
                return {
                    label: t('admin.team.bounced.rejected', 'Email rejected'),
                    severity: 'error' as const,
                    canRetry: true,
                };
            case 'timeout':
                return {
                    label: t('admin.team.bounced.timeout', 'Delivery timeout'),
                    severity: 'warning' as const,
                    canRetry: true,
                };
            case 'spam_blocked':
                return {
                    label: t('admin.team.bounced.spamBlocked', 'Blocked as spam'),
                    severity: 'warning' as const,
                    canRetry: true,
                };
            default:
                return {
                    label: t('admin.team.bounced.unknown', 'Unknown error'),
                    severity: 'warning' as const,
                    canRetry: true,
                };
        }
    };

    // Toggle selection
    const toggleSelection = useCallback((id: string) => {
        setSelectedInvitations((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }, []);

    // Handle resend with corrected email
    const handleResendWithCorrection = useCallback(
        (invitationId: string) => {
            if (correctedEmail && onResend) {
                onResend(invitationId, correctedEmail);
            }
            setEditingEmail(null);
            setCorrectedEmail('');
        },
        [correctedEmail, onResend],
    );

    // Get retryable invitations
    const retryableInvitations = bouncedInvitations.filter((inv) => getBounceInfo(inv.bounceReason).canRetry);

    if (bouncedInvitations.length === 0) {
        return null;
    }

    return (
        <div
            className={cn(
                'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl overflow-hidden',
                className,
            )}
        >
            {/* Header */}
            <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                    <MailWarning size={20} className="text-amber-600 dark:text-amber-400" />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h4 className="font-medium text-amber-800 dark:text-amber-200">
                            {t('admin.team.bounced.title', 'Bounced Invitations')}
                        </h4>
                        <span className="px-2 py-0.5 text-xs font-medium bg-amber-200 dark:bg-amber-800 text-amber-700 dark:text-amber-300 rounded-full">
                            {bouncedInvitations.length}
                        </span>
                    </div>
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                        {t('admin.team.bounced.description', 'Some invitation emails could not be delivered')}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    {onDismiss && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDismiss();
                            }}
                            className="h-8 w-8 p-0 text-amber-600 hover:text-amber-700"
                        >
                            <X size={16} />
                        </Button>
                    )}
                    <span className="text-amber-600 dark:text-amber-400">
                        {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    </span>
                </div>
            </div>

            {/* Expanded Content */}
            {isExpanded && (
                <div className="px-4 pb-4 border-t border-amber-200 dark:border-amber-800">
                    {/* Bulk Actions */}
                    {selectedInvitations.size > 0 && (
                        <div className="flex items-center gap-3 py-3">
                            <span className="text-sm text-amber-700 dark:text-amber-300">
                                {t('admin.team.bounced.selected', '{{count}} selected', {
                                    count: selectedInvitations.size,
                                })}
                            </span>
                            {onResendAll && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onResendAll(Array.from(selectedInvitations))}
                                    icon={<RefreshCw size={14} />}
                                    className="text-amber-700 border-amber-300 hover:bg-amber-100"
                                >
                                    {t('admin.team.bounced.resendSelected', 'Resend')}
                                </Button>
                            )}
                            {onCancelAll && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onCancelAll(Array.from(selectedInvitations))}
                                    icon={<Trash2 size={14} />}
                                    className="text-rose-600 hover:bg-rose-50"
                                >
                                    {t('admin.team.bounced.cancelSelected', 'Cancel')}
                                </Button>
                            )}
                        </div>
                    )}

                    {/* Invitation List */}
                    <div className="space-y-2 pt-3">
                        {bouncedInvitations.map((invitation) => {
                            const bounceInfo = getBounceInfo(invitation.bounceReason);
                            const isEditing = editingEmail === invitation.id;

                            return (
                                <div
                                    key={invitation.id}
                                    className={cn(
                                        'flex items-center gap-3 p-3 bg-white dark:bg-navy-800 rounded-lg border',
                                        selectedInvitations.has(invitation.id)
                                            ? 'border-amber-400 dark:border-amber-600'
                                            : 'border-slate-200 dark:border-navy-700',
                                    )}
                                >
                                    {/* Selection */}
                                    <input
                                        type="checkbox"
                                        checked={selectedInvitations.has(invitation.id)}
                                        onChange={() => toggleSelection(invitation.id)}
                                        className="rounded border-slate-300"
                                    />

                                    {/* Status Icon */}
                                    <div
                                        className={cn(
                                            'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                                            bounceInfo.severity === 'error'
                                                ? 'bg-rose-100 dark:bg-rose-900/30'
                                                : 'bg-amber-100 dark:bg-amber-900/30',
                                        )}
                                    >
                                        {bounceInfo.severity === 'error' ? (
                                            <AlertCircle size={16} className="text-rose-600 dark:text-rose-400" />
                                        ) : (
                                            <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400" />
                                        )}
                                    </div>

                                    {/* Email & Details */}
                                    <div className="flex-1 min-w-0">
                                        {isEditing ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="email"
                                                    value={correctedEmail}
                                                    onChange={(e) => setCorrectedEmail(e.target.value)}
                                                    placeholder={invitation.email}
                                                    className="flex-1 px-2 py-1 text-sm bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded"
                                                    autoFocus
                                                />
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleResendWithCorrection(invitation.id)}
                                                    className="h-7 w-7 p-0 text-emerald-600"
                                                >
                                                    <Check size={14} />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                        setEditingEmail(null);
                                                        setCorrectedEmail('');
                                                    }}
                                                    className="h-7 w-7 p-0 text-slate-500"
                                                >
                                                    <X size={14} />
                                                </Button>
                                            </div>
                                        ) : (
                                            <>
                                                <p className="font-medium text-navy-900 dark:text-white truncate">
                                                    {invitation.email}
                                                </p>
                                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                                    <span>{bounceInfo.label}</span>
                                                    <span>•</span>
                                                    <span>
                                                        {t('admin.team.bounced.attempts', '{{count}} attempts', {
                                                            count: invitation.attempts,
                                                        })}
                                                    </span>
                                                </div>
                                            </>
                                        )}

                                        {/* Suggested Email */}
                                        {invitation.suggestedEmail && !isEditing && (
                                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                                {t('admin.team.bounced.suggestion', 'Did you mean:')}{' '}
                                                <button
                                                    onClick={() => {
                                                        setEditingEmail(invitation.id);
                                                        setCorrectedEmail(invitation.suggestedEmail || '');
                                                    }}
                                                    className="font-medium underline hover:no-underline"
                                                >
                                                    {invitation.suggestedEmail}
                                                </button>
                                            </p>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    {!isEditing && (
                                        <div className="flex items-center gap-1">
                                            {bounceInfo.canRetry && onResend && (
                                                <Tooltip content={t('admin.team.bounced.resend', 'Resend invitation')}>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => onResend(invitation.id)}
                                                        className="h-8 w-8 p-0"
                                                    >
                                                        <RefreshCw size={14} />
                                                    </Button>
                                                </Tooltip>
                                            )}
                                            {!bounceInfo.canRetry && (
                                                <Tooltip
                                                    content={t(
                                                        'admin.team.bounced.editAndResend',
                                                        'Edit email and resend',
                                                    )}
                                                >
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => {
                                                            setEditingEmail(invitation.id);
                                                            setCorrectedEmail(
                                                                invitation.suggestedEmail || invitation.email,
                                                            );
                                                        }}
                                                        className="h-8 w-8 p-0"
                                                    >
                                                        <Mail size={14} />
                                                    </Button>
                                                </Tooltip>
                                            )}
                                            {onCancel && (
                                                <Tooltip content={t('admin.team.bounced.cancel', 'Cancel invitation')}>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => onCancel(invitation.id)}
                                                        className="h-8 w-8 p-0 text-rose-500 hover:text-rose-600"
                                                    >
                                                        <Trash2 size={14} />
                                                    </Button>
                                                </Tooltip>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Info Footer */}
                    <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                            {t(
                                'admin.team.bounced.tip',
                                'Tip: For invalid emails, try correcting the address. For temporary issues like mailbox full, you can retry after some time.',
                            )}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InviteBouncedAlert;

