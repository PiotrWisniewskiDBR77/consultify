/**
 * NotificationDetailView
 * Full-page notification detail view for dynamic tabs
 * ClickUp-style design following Golden Standard
 */

// framer-motion used across MyWork; keep import minimal here
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  BellOff,
  Calendar,
  CheckSquare,
  ChevronLeft,
  Clock,
  ExternalLink,
  Flag,
  FolderOpen,
  Info,
  Loader2,
  Mail,
  MailOpen,
  Scale,
  Target,
  Trash2,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { buildNotificationContent } from '@/components/Notifications/notificationContent';

import { Api } from '../../services/api';

interface NotificationDetailViewProps {
  notificationId: string;
  onClose: () => void;
  onNavigateToSource?: (type: string, id: string) => void;
}

interface NotificationData {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  category: 'ai' | 'task' | 'system' | 'decision' | 'project' | 'initiative';
  isRead: boolean;
  isActionable: boolean;
  createdAt: string;
  readAt?: string;
  expiresAt?: string;
  actionLabel?: string;
  actionUrl?: string;
  relatedObjectId?: string;
  relatedObjectType?: 'TASK' | 'INITIATIVE' | 'DECISION' | 'PROJECT' | 'GATE';
  projectId?: string;
  projectName?: string;
  data?: Record<string, any>;
}

// Severity configuration
const SEVERITY_CONFIG = {
  INFO: {
    label: { en: 'Info', pl: 'Informacja' },
    color: 'bg-blue-500',
    textColor: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    icon: Info,
  },
  WARNING: {
    label: { en: 'Warning', pl: 'Ostrzeżenie' },
    color: 'bg-amber-500',
    textColor: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    icon: AlertTriangle,
  },
  CRITICAL: {
    label: { en: 'Critical', pl: 'Krytyczne' },
    color: 'bg-red-500',
    textColor: 'text-red-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    icon: AlertCircle,
  },
};

// Type icons
const TYPE_ICONS: Record<string, { icon: React.ElementType; color: string }> = {
  TASK_ASSIGNED: { icon: CheckSquare, color: 'text-blue-400' },
  TASK_OVERDUE: { icon: Clock, color: 'text-red-400' },
  TASK_BLOCKED: { icon: AlertCircle, color: 'text-red-400' },
  DECISION_REQUIRED: { icon: Scale, color: 'text-purple-400' },
  DECISION_OVERDUE: { icon: Scale, color: 'text-red-400' },
  INITIATIVE_STARTED: { icon: Target, color: 'text-emerald-400' },
  INITIATIVE_STALLED: { icon: Target, color: 'text-amber-400' },
  INITIATIVE_COMPLETED: { icon: Target, color: 'text-emerald-400' },
  AI_RISK_DETECTED: { icon: AlertTriangle, color: 'text-amber-400' },
  AI_RECOMMENDATION: { icon: Info, color: 'text-purple-400' },
  SYSTEM_ALERT: { icon: Bell, color: 'text-slate-400' },
};

export const NotificationDetailView: React.FC<NotificationDetailViewProps> = ({
  notificationId,
  onClose,
  onNavigateToSource,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<NotificationData | null>(null);

  useEffect(() => {
    loadNotification();
    markAsRead();
  }, [notificationId]);

  const loadNotification = async () => {
    try {
      setLoading(true);
      const notifications = await Api.getNotifications();
      const found = notifications.find((n: any) => n.id === notificationId);
      if (found) {
        setNotification({
          ...found,
          severity: found.severity || 'INFO',
          category: found.category || 'system',
        });
      } else {
        toast.error(isPolish ? 'Nie znaleziono powiadomienia' : 'Notification not found');
      }
    } catch (error) {
      console.error('Failed to load notification', error);
      toast.error(
        isPolish ? 'Nie udało się załadować powiadomienia' : 'Failed to load notification'
      );
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async () => {
    try {
      await Api.markNotificationRead(notificationId);
    } catch (error) {
      console.error('Failed to mark as read', error);
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        isPolish
          ? 'Czy na pewno chcesz usunąć to powiadomienie?'
          : 'Are you sure you want to delete this notification?'
      )
    ) {
      return;
    }
    try {
      await Api.deleteNotification(notificationId);
      toast.success(isPolish ? 'Powiadomienie usunięte' : 'Notification deleted');
      onClose();
    } catch (error) {
      console.error('Failed to delete notification', error);
      toast.error(
        isPolish ? 'Nie udało się usunąć powiadomienia' : 'Failed to delete notification'
      );
    }
  };

  const handleMuteSimilar = async () => {
    // TODO: Implement mute similar notifications
    toast.success(isPolish ? 'Podobne powiadomienia wyciszone' : 'Similar notifications muted');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return isPolish ? 'Przed chwilą' : 'Just now';
    if (diffMins < 60) return isPolish ? `${diffMins} min temu` : `${diffMins}m ago`;
    if (diffHours < 24) return isPolish ? `${diffHours} godz. temu` : `${diffHours}h ago`;
    if (diffDays < 7) return isPolish ? `${diffDays} dni temu` : `${diffDays}d ago`;

    return date.toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRelatedObjectIcon = (type?: string) => {
    switch (type) {
      case 'TASK':
        return <CheckSquare size={16} className="text-blue-400" />;
      case 'DECISION':
        return <Scale size={16} className="text-purple-400" />;
      case 'INITIATIVE':
        return <Target size={16} className="text-emerald-400" />;
      case 'PROJECT':
        return <FolderOpen size={16} className="text-indigo-400" />;
      case 'GATE':
        return <Flag size={16} className="text-amber-400" />;
      default:
        return <Bell size={16} className="text-slate-400" />;
    }
  };

  const getRelatedObjectLabel = (type?: string) => {
    const labels: Record<string, { en: string; pl: string }> = {
      TASK: { en: 'Task', pl: 'Zadanie' },
      DECISION: { en: 'Decision', pl: 'Decyzja' },
      INITIATIVE: { en: 'Initiative', pl: 'Inicjatywa' },
      PROJECT: { en: 'Project', pl: 'Projekt' },
      GATE: { en: 'Gate', pl: 'Bramka' },
    };
    return type && labels[type] ? (isPolish ? labels[type].pl : labels[type].en) : '';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-white dark:bg-navy-950">
        <Loader2 className="animate-spin text-primary-500" size={32} />
      </div>
    );
  }

  if (!notification) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 bg-white dark:bg-navy-950">
        <Bell size={48} className="mb-4 opacity-50" />
        <p>{isPolish ? 'Nie znaleziono powiadomienia' : 'Notification not found'}</p>
        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 rounded-lg bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-white hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors"
        >
          {isPolish ? 'Wróć' : 'Go Back'}
        </button>
      </div>
    );
  }

  const severityConfig = SEVERITY_CONFIG[notification.severity];
  const SeverityIcon = severityConfig.icon;
  const typeConfig = TYPE_ICONS[notification.type] || { icon: Bell, color: 'text-slate-400' };
  const TypeIcon = typeConfig.icon;
  const contract = buildNotificationContent(notification as any, isPolish);

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-navy-950">
      {/* Header */}
      <div className="bg-white dark:bg-navy-900 border-b border-slate-200 dark:border-navy-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl ${severityConfig.bgColor} ${severityConfig.borderColor} border flex items-center justify-center`}
              >
                <SeverityIcon size={20} className={severityConfig.textColor} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold text-slate-800 dark:text-white">
                    {isPolish ? 'Powiadomienie' : 'Notification'}
                  </h1>
                  {/* Read status */}
                  {notification.isRead ? (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-slate-100 dark:bg-navy-700 text-slate-500 dark:text-slate-400">
                      <MailOpen size={10} />
                      {isPolish ? 'Przeczytane' : 'Read'}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-primary-500/10 text-primary-500">
                      <Mail size={10} />
                      {isPolish ? 'Nowe' : 'New'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <Calendar size={12} />
                  <span>{formatDate(notification.createdAt)}</span>
                  <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300">
                    {contract.priority}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleMuteSimilar}
              className="px-3 py-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors flex items-center gap-2"
              title={isPolish ? 'Wycisz podobne' : 'Mute similar'}
            >
              <BellOff size={16} />
              <span className="hidden sm:inline">{isPolish ? 'Wycisz' : 'Mute'}</span>
            </button>
            <button
              onClick={handleDelete}
              className="px-3 py-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex items-center gap-2"
            >
              <Trash2 size={16} />
              <span className="hidden sm:inline">{isPolish ? 'Usuń' : 'Delete'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6">
          {/* Left = merytoryka (kanon 4-liniowy) */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-navy-700 overflow-hidden">
              <div className="p-6">
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${severityConfig.bgColor} ${severityConfig.textColor} border ${severityConfig.borderColor}`}
                  >
                    <SeverityIcon size={12} />
                    {isPolish ? severityConfig.label.pl : severityConfig.label.en}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-navy-700">
                    <TypeIcon size={12} className={typeConfig.color} />
                    {notification.type.replace(/_/g, ' ')}
                  </span>
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-navy-700 capitalize">
                    {notification.category}
                  </span>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      {isPolish ? 'Co się dzieje' : 'What’s happening'}
                    </div>
                    <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                      {contract.what}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      {isPolish ? 'Dlaczego to ważne' : 'Why it matters'}
                    </div>
                    <div className="mt-1 text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {contract.whyImportant}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      {isPolish ? 'Co jest blokowane' : 'What is blocked'}
                    </div>
                    <div className="mt-1 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                      {contract.blocked}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      {isPolish ? 'Oczekiwana akcja' : 'Expected action'}
                    </div>
                    <div className="mt-1 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                      {contract.expectedAction}
                    </div>
                  </div>
                </div>

                {notification.data && Object.keys(notification.data).length > 0 ? (
                  <details className="mt-6 group">
                    <summary className="cursor-pointer text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
                      {isPolish ? 'Dane techniczne' : 'Technical data'}
                    </summary>
                    <pre className="mt-3 text-xs whitespace-pre-wrap break-words bg-slate-50 dark:bg-navy-950/40 border border-slate-200 dark:border-navy-700 rounded-xl p-3 text-slate-700 dark:text-slate-200">
                      {JSON.stringify(notification.data, null, 2)}
                    </pre>
                  </details>
                ) : null}
              </div>
            </div>
          </div>

          {/* Right = sterowanie + metryki */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-navy-700 p-5">
              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                {isPolish ? 'Control' : 'Control'}
              </div>
              <div className="mt-4 space-y-2">
                {contract.primaryCta.kind === 'open_link' ? (
                  <a
                    href={contract.primaryCta.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary-600 text-white hover:bg-primary-700 transition-colors font-medium"
                  >
                    {contract.primaryCta.label}
                    <ExternalLink size={16} />
                  </a>
                ) : contract.primaryCta.kind === 'open_task' ? (
                  <button
                    onClick={() => onNavigateToSource?.('task', contract.primaryCta.id)}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary-600 text-white hover:bg-primary-700 transition-colors font-medium"
                  >
                    {contract.primaryCta.label}
                    <ExternalLink size={16} />
                  </button>
                ) : contract.primaryCta.kind === 'open_decision' ? (
                  <button
                    onClick={() => onNavigateToSource?.('decision', contract.primaryCta.id)}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary-600 text-white hover:bg-primary-700 transition-colors font-medium"
                  >
                    {contract.primaryCta.label}
                    <ExternalLink size={16} />
                  </button>
                ) : (
                  <button
                    onClick={() =>
                      notification.relatedObjectType && notification.relatedObjectId
                        ? onNavigateToSource?.(
                            notification.relatedObjectType.toLowerCase(),
                            notification.relatedObjectId
                          )
                        : onClose()
                    }
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors font-medium"
                  >
                    {isPolish ? 'Otwórz kontekst' : 'Open context'}
                    <ExternalLink size={16} />
                  </button>
                )}
              </div>
            </div>

            {(notification.relatedObjectType || notification.projectName) && (
              <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-navy-700 p-5">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  {isPolish ? 'Kontekst' : 'Context'}
                </div>
                <div className="mt-4 space-y-2">
                  {notification.relatedObjectType && notification.relatedObjectId ? (
                    <button
                      onClick={() =>
                        onNavigateToSource?.(
                          notification.relatedObjectType!.toLowerCase(),
                          notification.relatedObjectId!
                        )
                      }
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-navy-800 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors group border border-slate-200 dark:border-navy-700"
                    >
                      <div className="flex items-center gap-3">
                        {getRelatedObjectIcon(notification.relatedObjectType)}
                        <div className="text-left">
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                            {getRelatedObjectLabel(notification.relatedObjectType)}
                          </p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                            {notification.relatedObjectId.slice(0, 12)}...
                          </p>
                        </div>
                      </div>
                      <ExternalLink
                        size={14}
                        className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      />
                    </button>
                  ) : null}

                  {notification.projectName ? (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
                      <FolderOpen size={16} className="text-indigo-400" />
                      <div>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          {isPolish ? 'Projekt' : 'Project'}
                        </p>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                          {notification.projectName}
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-navy-700 p-5">
              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                {isPolish ? 'Metryki' : 'Metrics'}
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">
                    {isPolish ? 'Utworzono' : 'Created'}
                  </span>
                  <span className="font-medium text-slate-900 dark:text-white">
                    {new Date(notification.createdAt).toLocaleString(isPolish ? 'pl-PL' : 'en-US')}
                  </span>
                </div>
                {notification.readAt ? (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">
                      {isPolish ? 'Przeczytano' : 'Read at'}
                    </span>
                    <span className="font-medium text-slate-900 dark:text-white">
                      {new Date(notification.readAt).toLocaleString(isPolish ? 'pl-PL' : 'en-US')}
                    </span>
                  </div>
                ) : null}
                {notification.expiresAt ? (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">
                      {isPolish ? 'Wygasa' : 'Expires'}
                    </span>
                    <span className="font-medium text-slate-900 dark:text-white">
                      {new Date(notification.expiresAt).toLocaleString(
                        isPolish ? 'pl-PL' : 'en-US'
                      )}
                    </span>
                  </div>
                ) : null}

                {contract.whyYouGotIt ? (
                  <div className="pt-3 border-t border-slate-200 dark:border-navy-700">
                    <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      {isPolish ? 'Dlaczego to dostałeś' : 'Why you got it'}
                    </div>
                    <div className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                      {contract.whyYouGotIt}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationDetailView;
