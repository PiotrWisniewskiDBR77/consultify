/**
 * NotificationDetailPanel - Expandable panel with full notification details
 * Shows project context, full message, related object preview, and quick actions
 */

import React from 'react';
import { motion } from 'framer-motion';
import {
    ExternalLink,
    Clock,
    Folder,
    CheckSquare,
    Target,
    FileText,
    AlertCircle,
    Sparkles,
    ChevronRight
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NotificationQuickActions } from './NotificationQuickActions';

export interface NotificationData {
    id: string;
    type: string;
    severity: 'INFO' | 'WARNING' | 'CRITICAL';
    title: string;
    message: string;
    isRead: boolean;
    createdAt: string;
    projectId?: string;
    projectName?: string;
    relatedObjectType?: 'TASK' | 'INITIATIVE' | 'DECISION' | 'PROJECT' | 'GATE' | string;
    relatedObjectId?: string;
    isActionable?: boolean;
    actionUrl?: string;
}

interface NotificationDetailPanelProps {
    notification: NotificationData;
    onNavigate: () => void;
    onMarkRead: () => void;
    onDelete: () => void;
    onSnooze?: (hours: number) => void;
    canNavigate: boolean;
    navigationLabel: string;
}

/**
 * Get icon for related object type
 */
const getRelatedObjectIcon = (type?: string) => {
    switch (type) {
        case 'TASK':
            return <CheckSquare size={14} className="text-blue-500" />;
        case 'INITIATIVE':
            return <Target size={14} className="text-purple-500" />;
        case 'DECISION':
            return <AlertCircle size={14} className="text-amber-500" />;
        case 'GATE':
            return <FileText size={14} className="text-green-500" />;
        case 'PROJECT':
            return <Folder size={14} className="text-slate-500" />;
        default:
            return <Sparkles size={14} className="text-indigo-500" />;
    }
};

/**
 * Get severity color classes
 */
const getSeverityColors = (severity: string) => {
    switch (severity) {
        case 'CRITICAL':
            return {
                bg: 'bg-red-50 dark:bg-red-900/20',
                border: 'border-red-200 dark:border-red-800/50',
                badge: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
            };
        case 'WARNING':
            return {
                bg: 'bg-amber-50 dark:bg-amber-900/20',
                border: 'border-amber-200 dark:border-amber-800/50',
                badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
            };
        default:
            return {
                bg: 'bg-slate-50 dark:bg-slate-800/50',
                border: 'border-slate-200 dark:border-slate-700',
                badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
            };
    }
};

/**
 * Format related object type for display
 */
const formatObjectType = (type?: string): string => {
    if (!type) return 'Item';
    return type.charAt(0) + type.slice(1).toLowerCase();
};

export const NotificationDetailPanel: React.FC<NotificationDetailPanelProps> = ({
    notification,
    onNavigate,
    onMarkRead,
    onDelete,
    onSnooze,
    canNavigate,
    navigationLabel
}) => {
    const { t } = useTranslation();
    const severityColors = getSeverityColors(notification.severity);

    return (
        <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className={`overflow-hidden border-t border-slate-100 dark:border-white/5`}
        >
            <div className={`p-4 ${severityColors.bg}`}>
                {/* Project Context */}
                {notification.projectName && (
                    <div className={`mb-3 p-2 rounded-lg ${severityColors.border} border bg-white/50 dark:bg-navy-900/50`}>
                        <div className="flex items-center gap-2 text-xs">
                            <Folder size={12} className="text-slate-400" />
                            <span className="font-medium text-navy-900 dark:text-white">
                                {notification.projectName}
                            </span>
                            {notification.relatedObjectType && (
                                <>
                                    <ChevronRight size={10} className="text-slate-300" />
                                    <span className={`px-1.5 py-0.5 rounded ${severityColors.badge} text-[10px] font-medium`}>
                                        {formatObjectType(notification.relatedObjectType)}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Full Message */}
                <div className="mb-4">
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                        {notification.message}
                    </p>
                </div>

                {/* Related Object Card */}
                {notification.relatedObjectType && notification.relatedObjectId && (
                    <div className="mb-4">
                        <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1.5 font-medium">
                            {t('notifications.relatedObject', 'Related')} {formatObjectType(notification.relatedObjectType)}
                        </div>
                        <button
                            onClick={onNavigate}
                            className={`
                                w-full p-3 rounded-lg border ${severityColors.border}
                                bg-white dark:bg-navy-900 
                                hover:bg-slate-50 dark:hover:bg-navy-800
                                transition-colors text-left group
                            `}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    {getRelatedObjectIcon(notification.relatedObjectType)}
                                    <span className="text-sm font-medium text-navy-900 dark:text-white">
                                        {notification.title}
                                    </span>
                                </div>
                                <ExternalLink 
                                    size={14} 
                                    className="text-slate-400 group-hover:text-blue-500 transition-colors" 
                                />
                            </div>
                            <div className="mt-1 text-xs text-slate-500 flex items-center gap-2">
                                <Clock size={10} />
                                <span>ID: {notification.relatedObjectId.slice(0, 8)}...</span>
                            </div>
                        </button>
                    </div>
                )}

                {/* Quick Actions */}
                <NotificationQuickActions
                    notification={notification}
                    onNavigate={onNavigate}
                    onMarkRead={onMarkRead}
                    onDelete={onDelete}
                    onSnooze={onSnooze}
                    canNavigate={canNavigate}
                    navigationLabel={navigationLabel}
                />
            </div>
        </motion.div>
    );
};

export default NotificationDetailPanel;



