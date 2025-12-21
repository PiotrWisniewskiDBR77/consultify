import React from 'react';
import { Shield, AlertTriangle, Clock, X } from 'lucide-react';

interface BreakGlassSession {
    id: string;
    scope: string;
    reason: string;
    expiresAt: string;
    createdAt: string;
    actorId?: string;
}

interface BreakGlassBannerProps {
    sessions: BreakGlassSession[];
    onClose?: (sessionId: string) => void;
    canClose?: boolean;
}

const scopeLabels: Record<string, string> = {
    policy_engine_disabled: 'Policy Engine Disabled',
    approval_bypass: 'Approval Bypass Active',
    rate_limit_bypass: 'Rate Limiting Bypassed',
    audit_bypass: 'Reduced Audit Logging',
    emergency_access: 'Emergency Access Mode'
};

const scopeColors: Record<string, string> = {
    policy_engine_disabled: 'bg-orange-500',
    approval_bypass: 'bg-red-500',
    rate_limit_bypass: 'bg-yellow-500',
    audit_bypass: 'bg-purple-500',
    emergency_access: 'bg-red-600'
};

export const BreakGlassBanner: React.FC<BreakGlassBannerProps> = ({
    sessions,
    onClose,
    canClose = false
}) => {
    if (!sessions || sessions.length === 0) return null;

    const formatTimeRemaining = (expiresAt: string) => {
        const now = new Date();
        const expires = new Date(expiresAt);
        const diffMs = expires.getTime() - now.getTime();

        if (diffMs <= 0) return 'Expired';

        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const remainingMins = diffMins % 60;

        if (diffHours > 0) {
            return `${diffHours}h ${remainingMins}m remaining`;
        }
        return `${diffMins}m remaining`;
    };

    return (
        <div className="fixed top-0 left-0 right-0 z-50">
            {sessions.map((session) => (
                <div
                    key={session.id}
                    className={`${scopeColors[session.scope] || 'bg-red-500'} text-white px-4 py-2`}
                >
                    <div className="max-w-7xl mx-auto flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Shield className="w-5 h-5 animate-pulse" />
                            <AlertTriangle className="w-5 h-5" />
                            <span className="font-semibold">
                                BREAK-GLASS ACTIVE: {scopeLabels[session.scope] || session.scope}
                            </span>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 text-sm opacity-90">
                                <Clock className="w-4 h-4" />
                                <span>{formatTimeRemaining(session.expiresAt)}</span>
                            </div>

                            <div className="text-sm opacity-75 max-w-xs truncate">
                                Reason: {session.reason}
                            </div>

                            {canClose && onClose && (
                                <button
                                    onClick={() => onClose(session.id)}
                                    className="p-1 hover:bg-white/20 rounded transition-colors"
                                    title="Close break-glass session"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default BreakGlassBanner;
