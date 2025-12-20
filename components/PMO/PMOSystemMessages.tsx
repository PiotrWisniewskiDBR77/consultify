import React from 'react';
import { usePMOContext } from '../../hooks/usePMOContext';
import {
    AlertTriangle,
    XCircle,
    Info,
    User,
    Calendar,
    FileQuestion,
    Target
} from 'lucide-react';

interface PMOSystemMessagesProps {
    variant?: 'banner' | 'inline' | 'toast';
    maxMessages?: number;
}

/**
 * PMO System Messages - Displays system-level warnings (not AI)
 * Shows critical issues: missing owners, decisions, deadlines, overdue tasks
 */
export const PMOSystemMessages: React.FC<PMOSystemMessagesProps> = ({
    variant = 'banner',
    maxMessages = 3
}) => {
    const {
        systemMessages,
        blockingIssues,
        getCriticalMessages,
        getWarningMessages
    } = usePMOContext();

    const criticalMessages = getCriticalMessages();
    const warningMessages = getWarningMessages();

    // Don't render if no messages
    if (criticalMessages.length === 0 && warningMessages.length === 0 && blockingIssues.length === 0) {
        return null;
    }

    // Get icon for message code
    const getMessageIcon = (code: string) => {
        if (code.includes('OWNER') || code.includes('USER')) return <User size={14} />;
        if (code.includes('DEADLINE') || code.includes('DATE') || code.includes('OVERDUE')) return <Calendar size={14} />;
        if (code.includes('DECISION')) return <FileQuestion size={14} />;
        if (code.includes('TASK')) return <Target size={14} />;
        return <AlertTriangle size={14} />;
    };

    // Banner variant - horizontal strip at top
    if (variant === 'banner') {
        const allMessages = [...criticalMessages, ...warningMessages].slice(0, maxMessages);

        if (allMessages.length === 0) return null;

        return (
            <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2">
                <div className="flex items-center gap-4 overflow-x-auto">
                    {allMessages.map((msg, idx) => (
                        <div
                            key={idx}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium shrink-0
                                ${msg.severity === 'critical'
                                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                }`}
                        >
                            {msg.severity === 'critical' ? <XCircle size={12} /> : <AlertTriangle size={12} />}
                            <span>{msg.message}</span>
                        </div>
                    ))}
                    {(criticalMessages.length + warningMessages.length) > maxMessages && (
                        <span className="text-xs text-slate-400 shrink-0">
                            +{(criticalMessages.length + warningMessages.length) - maxMessages} more
                        </span>
                    )}
                </div>
            </div>
        );
    }

    // Inline variant - compact list for sidebars
    if (variant === 'inline') {
        return (
            <div className="space-y-2">
                {criticalMessages.slice(0, maxMessages).map((msg, idx) => (
                    <div
                        key={`crit-${idx}`}
                        className="flex items-start gap-2 p-2 bg-red-500/10 rounded border border-red-500/20"
                    >
                        <XCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                            <p className="text-xs text-red-400 font-medium">{msg.message}</p>
                        </div>
                    </div>
                ))}
                {warningMessages.slice(0, maxMessages - criticalMessages.length).map((msg, idx) => (
                    <div
                        key={`warn-${idx}`}
                        className="flex items-start gap-2 p-2 bg-amber-500/10 rounded border border-amber-500/20"
                    >
                        <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                            <p className="text-xs text-amber-400">{msg.message}</p>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return null;
};

/**
 * Compact PMO Warning Badge - For use in cards/headers
 */
export const PMOWarningBadge: React.FC = () => {
    const { blockingIssues, getCriticalMessages } = usePMOContext();
    const criticalCount = getCriticalMessages().length + blockingIssues.length;

    if (criticalCount === 0) return null;

    return (
        <span className="flex items-center gap-1 px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-xs font-medium border border-red-500/30">
            <AlertTriangle size={10} />
            {criticalCount} {criticalCount === 1 ? 'Issue' : 'Issues'}
        </span>
    );
};

export default PMOSystemMessages;
