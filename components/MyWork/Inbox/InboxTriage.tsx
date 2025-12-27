/**
 * InboxTriage - Inbox Zero methodology for task management
 * Part of My Work Module PMO Upgrade
 * 
 * Features:
 * - Urgency-based grouping
 * - Quick triage actions
 * - Bulk operations
 * - Swipe gestures (mobile)
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Inbox,
    CheckCircle,
    Calendar,
    UserPlus,
    Archive,
    XCircle,
    ChevronDown,
    ChevronUp,
    Loader2,
    Filter,
    CheckSquare,
    Square,
    Bell,
    AtSign,
    FileCheck,
    AlertTriangle,
    Sparkles
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { 
    InboxItem, 
    InboxItemType, 
    TriageAction, 
    InboxTriageProps,
    TriageParams 
} from '../../../types/myWork';
import { PMOPriorityBadge, getPMOCategory } from '../shared/PMOPriorityBadge';
import { DueDateIndicator } from '../shared/DueDateIndicator';
import { EmptyState } from '../shared/EmptyState';
import { Api } from '../../../services/api';
import toast from 'react-hot-toast';

interface ExtendedInboxTriageProps extends Partial<InboxTriageProps> {
    onItemClick?: (item: InboxItem) => void;
}

/**
 * Urgency configuration
 */
const urgencyConfig = {
    critical: {
        label: 'Krytyczne',
        className: 'inbox-critical',
        icon: <AlertTriangle size={14} />,
        color: 'text-red-500'
    },
    high: {
        label: 'Wysokie',
        className: 'inbox-high',
        icon: <Bell size={14} />,
        color: 'text-orange-500'
    },
    normal: {
        label: 'Normalne',
        className: 'inbox-normal',
        icon: <Inbox size={14} />,
        color: 'text-slate-500'
    },
    low: {
        label: 'Niskie',
        className: 'inbox-low',
        icon: <Archive size={14} />,
        color: 'text-slate-400'
    }
};

/**
 * Item type icons
 */
const itemTypeIcons: Record<InboxItemType, React.ReactNode> = {
    new_assignment: <CheckSquare size={14} />,
    mention: <AtSign size={14} />,
    escalation: <AlertTriangle size={14} />,
    review_request: <FileCheck size={14} />,
    decision_request: <Calendar size={14} />,
    ai_suggestion: <Sparkles size={14} />
};

/**
 * Triage action buttons config
 */
const triageActions: Array<{
    action: TriageAction;
    label: string;
    icon: React.ReactNode;
    className: string;
    shortcut: string;
}> = [
    {
        action: 'accept_today',
        label: 'Dziś',
        icon: <CheckCircle size={14} />,
        className: 'triage-accept',
        shortcut: 'T'
    },
    {
        action: 'schedule',
        label: 'Zaplanuj',
        icon: <Calendar size={14} />,
        className: 'triage-schedule',
        shortcut: 'S'
    },
    {
        action: 'delegate',
        label: 'Deleguj',
        icon: <UserPlus size={14} />,
        className: 'triage-delegate',
        shortcut: 'D'
    },
    {
        action: 'archive',
        label: 'Archiwum',
        icon: <Archive size={14} />,
        className: 'triage-archive',
        shortcut: 'A'
    },
    {
        action: 'reject',
        label: 'Odrzuć',
        icon: <XCircle size={14} />,
        className: 'triage-reject',
        shortcut: 'X'
    }
];

/**
 * Single inbox item card
 */
const InboxItemCard: React.FC<{
    item: InboxItem;
    isSelected: boolean;
    onSelect: (id: string) => void;
    onTriage: (action: TriageAction) => void;
    onClick: () => void;
}> = ({ item, isSelected, onSelect, onTriage, onClick }) => {
    const { t } = useTranslation();
    const [showActions, setShowActions] = useState(false);

    const config = urgencyConfig[item.urgency];
    const typeIcon = itemTypeIcons[item.type];

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -50, height: 0 }}
            className={`
                group relative rounded-xl transition-all duration-200
                ${config.className}
                ${isSelected ? 'ring-2 ring-brand' : ''}
                ${item.triaged ? 'opacity-50' : ''}
            `}
            onMouseEnter={() => setShowActions(true)}
            onMouseLeave={() => setShowActions(false)}
        >
            <div className="flex items-start gap-3 p-4">
                {/* Selection Checkbox */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onSelect(item.id);
                    }}
                    className="shrink-0 mt-0.5"
                >
                    {isSelected ? (
                        <CheckSquare size={18} className="text-brand" />
                    ) : (
                        <Square size={18} className="text-slate-300 hover:text-brand transition-colors" />
                    )}
                </button>

                {/* Content */}
                <div 
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={onClick}
                >
                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                            <span className={config.color}>{typeIcon}</span>
                            <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                                {t(`myWork.inbox.type.${item.type}`, item.type.replace('_', ' '))}
                            </span>
                        </div>
                        <span className="text-[10px] text-slate-400">
                            {new Date(item.receivedAt).toLocaleTimeString('pl-PL', {
                                hour: '2-digit',
                                minute: '2-digit'
                            })}
                        </span>
                    </div>

                    {/* Title */}
                    <h4 className="text-sm font-semibold text-navy-900 dark:text-white mb-1 truncate">
                        {item.title}
                    </h4>

                    {/* Description */}
                    {item.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-2">
                            {item.description}
                        </p>
                    )}

                    {/* Source & Meta */}
                    <div className="flex items-center gap-3 text-[10px] text-slate-400">
                        {item.source.userName && (
                            <span className="flex items-center gap-1">
                                {item.source.avatarUrl ? (
                                    <img 
                                        src={item.source.avatarUrl} 
                                        alt="" 
                                        className="w-4 h-4 rounded-full"
                                    />
                                ) : (
                                    <div className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700" />
                                )}
                                {item.source.userName}
                            </span>
                        )}
                        {item.linkedTask && (
                            <DueDateIndicator 
                                dueDate={item.linkedTask.dueDate} 
                                size="sm"
                            />
                        )}
                    </div>
                </div>

                {/* Triage Actions */}
                <AnimatePresence>
                    {showActions && !item.triaged && (
                        <motion.div
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            className="shrink-0 flex items-center gap-1"
                        >
                            {triageActions.slice(0, 3).map((ta) => (
                                <button
                                    key={ta.action}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onTriage(ta.action);
                                    }}
                                    className={`p-2 rounded-lg transition-colors ${ta.className}`}
                                    title={`${ta.label} (${ta.shortcut})`}
                                >
                                    {ta.icon}
                                </button>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
};

/**
 * Urgency section header
 */
const UrgencySection: React.FC<{
    urgency: keyof typeof urgencyConfig;
    count: number;
    isExpanded: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}> = ({ urgency, count, isExpanded, onToggle, children }) => {
    const { t } = useTranslation();
    const config = urgencyConfig[urgency];

    if (count === 0) return null;

    return (
        <div className="space-y-2">
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <span className={config.color}>{config.icon}</span>
                    <span className="font-semibold text-navy-900 dark:text-white">
                        {t(`myWork.inbox.urgency.${urgency}`, config.label)}
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-white/10 rounded-full text-slate-600 dark:text-slate-300">
                        {count}
                    </span>
                </div>
                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="space-y-2 overflow-hidden"
                    >
                        {children}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

/**
 * InboxTriage Component - Main Export
 */
export const InboxTriage: React.FC<ExtendedInboxTriageProps> = ({
    onTriage,
    onBulkTriage,
    onItemClick
}) => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState<InboxItem[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [expandedSections, setExpandedSections] = useState<Set<string>>(
        new Set(['critical', 'high', 'normal'])
    );
    const [filter, setFilter] = useState<'all' | InboxItemType>('all');

    // Load inbox items
    const loadInbox = useCallback(async () => {
        try {
            setLoading(true);
            const res = await Api.get('/my-work/inbox');
            if (res?.items) {
                setItems(res.items.filter((i: InboxItem) => !i.triaged));
            }
        } catch (error) {
            console.error('Failed to load inbox:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadInbox();
    }, [loadInbox]);

    // Group items by urgency
    const groupedItems = useMemo(() => {
        const filtered = filter === 'all' 
            ? items 
            : items.filter(i => i.type === filter);

        return {
            critical: filtered.filter(i => i.urgency === 'critical'),
            high: filtered.filter(i => i.urgency === 'high'),
            normal: filtered.filter(i => i.urgency === 'normal'),
            low: filtered.filter(i => i.urgency === 'low')
        };
    }, [items, filter]);

    // Toggle selection
    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    // Select all
    const selectAll = () => {
        setSelectedIds(new Set(items.map(i => i.id)));
    };

    // Clear selection
    const clearSelection = () => {
        setSelectedIds(new Set());
    };

    // Toggle section
    const toggleSection = (section: string) => {
        setExpandedSections(prev => {
            const next = new Set(prev);
            if (next.has(section)) {
                next.delete(section);
            } else {
                next.add(section);
            }
            return next;
        });
    };

    // Handle triage action
    const handleTriage = async (itemId: string, action: TriageAction, params?: TriageParams[TriageAction]) => {
        try {
            // Optimistic update
            setItems(prev => prev.filter(i => i.id !== itemId));

            await Api.post(`/my-work/inbox/${itemId}/triage`, { action, params });
            
            onTriage?.(itemId, action, params);
            toast.success(t('myWork.inbox.triaged', 'Item processed'));
        } catch (error) {
            console.error('Failed to triage:', error);
            loadInbox(); // Revert
            toast.error(t('myWork.inbox.error', 'Failed to process'));
        }
    };

    // Handle bulk triage
    const handleBulkTriage = async (action: TriageAction) => {
        if (selectedIds.size === 0) return;

        try {
            const ids = Array.from(selectedIds);
            
            // Optimistic update
            setItems(prev => prev.filter(i => !selectedIds.has(i.id)));
            setSelectedIds(new Set());

            await Api.post('/my-work/inbox/bulk-triage', {
                itemIds: ids,
                action
            });

            onBulkTriage?.(ids, action);
            toast.success(t('myWork.inbox.bulkTriaged', `${ids.length} items processed`));
        } catch (error) {
            console.error('Failed to bulk triage:', error);
            loadInbox();
            toast.error(t('myWork.inbox.error', 'Failed to process'));
        }
    };

    const totalItems = items.length;
    const criticalCount = groupedItems.critical.length;

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 size={32} className="animate-spin text-brand" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-xl shadow-lg shadow-blue-500/25">
                        <Inbox size={22} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-navy-900 dark:text-white">
                            {t('myWork.inbox.title', 'Inbox')}
                        </h2>
                        <p className="text-xs text-slate-500">
                            {totalItems} {t('myWork.inbox.items', 'items')}
                            {criticalCount > 0 && (
                                <span className="text-red-500 ml-1">
                                    ({criticalCount} {t('myWork.inbox.critical', 'critical')})
                                </span>
                            )}
                        </p>
                    </div>
                </div>

                {/* Filter */}
                <div className="flex items-center gap-2">
                    <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value as typeof filter)}
                        className="text-sm bg-white dark:bg-navy-800 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5"
                    >
                        <option value="all">{t('myWork.inbox.filter.all', 'All types')}</option>
                        <option value="new_assignment">{t('myWork.inbox.filter.assignment', 'Assignments')}</option>
                        <option value="mention">{t('myWork.inbox.filter.mention', 'Mentions')}</option>
                        <option value="review_request">{t('myWork.inbox.filter.review', 'Reviews')}</option>
                        <option value="escalation">{t('myWork.inbox.filter.escalation', 'Escalations')}</option>
                    </select>
                </div>
            </div>

            {/* Bulk Actions Bar */}
            {selectedIds.size > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between p-3 bg-brand/10 dark:bg-brand/20 border border-brand/20 rounded-xl"
                >
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-brand">
                            {selectedIds.size} {t('myWork.inbox.selected', 'selected')}
                        </span>
                        <button 
                            onClick={selectAll}
                            className="text-xs text-brand hover:underline"
                        >
                            {t('myWork.inbox.selectAll', 'Select all')}
                        </button>
                        <button 
                            onClick={clearSelection}
                            className="text-xs text-slate-500 hover:underline"
                        >
                            {t('myWork.inbox.clearSelection', 'Clear')}
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        {triageActions.map((ta) => (
                            <button
                                key={ta.action}
                                onClick={() => handleBulkTriage(ta.action)}
                                className={`p-2 rounded-lg transition-colors ${ta.className}`}
                                title={ta.label}
                            >
                                {ta.icon}
                            </button>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* Items by Urgency */}
            {totalItems > 0 ? (
                <div className="space-y-4">
                    {(['critical', 'high', 'normal', 'low'] as const).map((urgency) => (
                        <UrgencySection
                            key={urgency}
                            urgency={urgency}
                            count={groupedItems[urgency].length}
                            isExpanded={expandedSections.has(urgency)}
                            onToggle={() => toggleSection(urgency)}
                        >
                            {groupedItems[urgency].map((item) => (
                                <InboxItemCard
                                    key={item.id}
                                    item={item}
                                    isSelected={selectedIds.has(item.id)}
                                    onSelect={toggleSelect}
                                    onTriage={(action) => handleTriage(item.id, action)}
                                    onClick={() => onItemClick?.(item)}
                                />
                            ))}
                        </UrgencySection>
                    ))}
                </div>
            ) : (
                <EmptyState
                    type="inbox"
                    description={t('myWork.inbox.empty', "You've processed all items. Great job!")}
                />
            )}
        </div>
    );
};

export default InboxTriage;



