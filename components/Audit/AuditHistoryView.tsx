import React, { useState, useEffect } from 'react';
import { History, User, ChevronDown, ChevronUp, Clock, Edit, Plus, Trash, Eye, FileText } from 'lucide-react';
import { Api } from '../../services/api';

/**
 * AuditHistoryView — Phase F: Team Expansion
 * 
 * ENTERPRISE SPEC COMPLIANCE:
 * - EPIC-F4: History of changes readable
 * - Shows who did what, when
 * - Audit trail for accountability
 */

interface AuditEvent {
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    entityName?: string;
    userId: string;
    userName?: string;
    userEmail?: string;
    metadata?: Record<string, any>;
    createdAt: string;
}

interface AuditHistoryViewProps {
    organizationId: string;
    entityType?: string;
    entityId?: string;
    limit?: number;
    className?: string;
}

const ACTION_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
    'create': Plus,
    'created': Plus,
    'update': Edit,
    'updated': Edit,
    'delete': Trash,
    'deleted': Trash,
    'view': Eye,
    'viewed': Eye,
    'default': FileText,
};

const ACTION_LABELS: Record<string, string> = {
    'initiative_created': 'Utworzono inicjatywę',
    'initiative_updated': 'Zaktualizowano inicjatywę',
    'task_created': 'Utworzono zadanie',
    'task_updated': 'Zaktualizowano zadanie',
    'task_assigned': 'Przypisano zadanie',
    'user_invited': 'Zaproszono użytkownika',
    'user_joined': 'Użytkownik dołączył',
    'plan_generated': 'Wygenerowano plan',
    'plan_accepted': 'Zaakceptowano plan',
    'context_saved': 'Zapisano kontekst',
    'demo_created': 'Utworzono demo',
    'org_created': 'Utworzono organizację',
    'default': 'Akcja',
};

const getActionIcon = (action: string) => {
    const parts = action.toLowerCase().split('_');
    for (const part of parts) {
        if (ACTION_ICONS[part]) return ACTION_ICONS[part];
    }
    return ACTION_ICONS['default'];
};

const getActionLabel = (action: string) => {
    return ACTION_LABELS[action] || ACTION_LABELS['default'];
};

const AuditEventCard: React.FC<{ event: AuditEvent }> = ({ event }) => {
    const Icon = getActionIcon(event.action);
    const label = getActionLabel(event.action);

    const formattedTime = new Date(event.createdAt).toLocaleString('pl-PL', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });

    return (
        <div className="flex items-start gap-3 py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
            <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                <Icon size={14} className="text-purple-600 dark:text-purple-400" />
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-navy-900 dark:text-white text-sm">
                        {label}
                    </span>
                    {event.entityName && (
                        <span className="text-sm text-slate-600 dark:text-slate-400 truncate">
                            — {event.entityName}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1">
                        <User size={10} />
                        <span>{event.userName || event.userEmail || 'System'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Clock size={10} />
                        <span>{formattedTime}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const AuditHistoryView: React.FC<AuditHistoryViewProps> = ({
    organizationId,
    entityType,
    entityId,
    limit = 20,
    className = '',
}) => {
    const [events, setEvents] = useState<AuditEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isExpanded, setIsExpanded] = useState(true);

    useEffect(() => {
        const fetchAuditEvents = async () => {
            try {
                setIsLoading(true);
                const params = new URLSearchParams({
                    organizationId,
                    limit: limit.toString(),
                });
                if (entityType) params.append('entityType', entityType);
                if (entityId) params.append('entityId', entityId);

                const response = await Api.get(`/audit?${params.toString()}`);
                setEvents(response.data?.events || []);
            } catch (error) {
                console.error('Failed to fetch audit events:', error);
                setEvents([]);
            } finally {
                setIsLoading(false);
            }
        };

        if (organizationId) {
            fetchAuditEvents();
        }
    }, [organizationId, entityType, entityId, limit]);

    return (
        <div className={`border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden ${className}`}>
            {/* Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-navy-800 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <History size={18} className="text-purple-500" />
                    <div className="text-left">
                        <h3 className="font-semibold text-navy-900 dark:text-white">
                            Historia zmian
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {events.length} ostatnich akcji
                        </p>
                    </div>
                </div>

                {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>

            {/* Events List */}
            {isExpanded && (
                <div className="p-4">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : events.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                            <History size={32} className="mx-auto mb-2 opacity-50" />
                            <p>Brak zapisanych akcji.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {events.map((event) => (
                                <AuditEventCard key={event.id} event={event} />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

/**
 * AuditHistoryCompact — Inline summary for headers
 */
export const AuditHistoryCompact: React.FC<{
    lastEvent?: AuditEvent;
    onClick?: () => void;
}> = ({ lastEvent, onClick }) => {
    if (!lastEvent) return null;

    const formattedTime = new Date(lastEvent.createdAt).toLocaleString('pl-PL', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });

    return (
        <button
            onClick={onClick}
            className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
        >
            <History size={12} />
            <span>Ostatnia zmiana: {formattedTime}</span>
        </button>
    );
};

export default AuditHistoryView;
