/**
 * NotificationDetailView
 * Full-page notification detail view for dynamic tabs
 * Following Task Detail View Golden Standard with purple gradient header
 * Enhanced with AI Analysis, Related Items, Action Checklist, Comments, Activity Log
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  BellOff,
  Bot,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  Clock,
  ExternalLink,
  Flag,
  FolderOpen,
  History,
  Info,
  Link2,
  Loader2,
  MailOpen,
  MessageCircle,
  MessageSquare,
  Scale,
  Sparkles,
  Target,
  Trash2,
  Users,
  Zap,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { buildNotificationContent } from '@/components/Notifications/notificationContent';
import { useAppStore } from '@/store/useAppStore';
import { useConversationStore } from '@/store/useConversationStore';
import { AppView } from '@/types';

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
  const { isChatCollapsed, toggleChatCollapse } = useAppStore();
  const { updateWorkspaceFromView } = useConversationStore();
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<NotificationData | null>(null);
  const [sourceEntity, setSourceEntity] = useState<Record<string, any> | null>(null);
  const [sourceEntityLoading, setSourceEntityLoading] = useState(false);

  // Expanded sections state
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['whats-happening', 'ai-analysis', 'expected-action', 'source-entity', 'control'])
  );

  // Action checklist state
  const [actionChecklist, setActionChecklist] = useState<
    { id: string; text: string; completed: boolean }[]
  >([]);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

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
        const notifData = {
          ...found,
          severity: found.severity || 'INFO',
          category: found.category || 'system',
        };
        setNotification(notifData);

        // Load checklist from backend if persisted, otherwise generate
        if (found.checklist && Array.isArray(found.checklist)) {
          setActionChecklist(found.checklist);
        } else {
          generateActionChecklist(found);
        }

        // Load source entity
        loadSourceEntity();
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

  const loadSourceEntity = async () => {
    try {
      setSourceEntityLoading(true);
      const entity = await Api.getNotificationSourceEntity(notificationId);
      setSourceEntity(entity);
    } catch (error) {
      console.error('Failed to load source entity', error);
    } finally {
      setSourceEntityLoading(false);
    }
  };

  const generateActionChecklist = (notif: any) => {
    const type = notif.type?.toUpperCase() || '';
    let items: { id: string; text: string; completed: boolean }[] = [];

    if (type.includes('TASK')) {
      items = [
        {
          id: '1',
          text: isPolish ? 'Przejrzyj szczegóły zadania' : 'Review task details',
          completed: false,
        },
        {
          id: '2',
          text: isPolish ? 'Zaktualizuj status lub termin' : 'Update status or deadline',
          completed: false,
        },
        {
          id: '3',
          text: isPolish ? 'Powiadom interesariuszy' : 'Notify stakeholders',
          completed: false,
        },
      ];
    } else if (type.includes('DECISION')) {
      items = [
        {
          id: '1',
          text: isPolish ? 'Przeanalizuj kontekst decyzji' : 'Analyze decision context',
          completed: false,
        },
        {
          id: '2',
          text: isPolish ? 'Skonsultuj z zespołem' : 'Consult with team',
          completed: false,
        },
        {
          id: '3',
          text: isPolish ? 'Podejmij decyzję lub deleguj' : 'Make decision or delegate',
          completed: false,
        },
      ];
    } else if (type.includes('AI')) {
      items = [
        {
          id: '1',
          text: isPolish ? 'Przejrzyj rekomendację AI' : 'Review AI recommendation',
          completed: false,
        },
        {
          id: '2',
          text: isPolish ? 'Zweryfikuj dane wejściowe' : 'Verify input data',
          completed: false,
        },
        { id: '3', text: isPolish ? 'Zastosuj lub odrzuć' : 'Apply or dismiss', completed: false },
      ];
    } else {
      items = [
        {
          id: '1',
          text: isPolish ? 'Przejrzyj powiadomienie' : 'Review notification',
          completed: false,
        },
        {
          id: '2',
          text: isPolish ? 'Podejmij odpowiednią akcję' : 'Take appropriate action',
          completed: false,
        },
      ];
    }

    setActionChecklist(items);
  };

  const toggleChecklistItem = (id: string) => {
    setActionChecklist((prev) => {
      const updated = prev.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      );
      // Persist to backend
      Api.updateNotificationChecklist(notificationId, updated).catch((err) =>
        console.error('Failed to persist checklist', err)
      );
      return updated;
    });
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
    toast.success(isPolish ? 'Podobne powiadomienia wyciszone' : 'Similar notifications muted');
  };

  const handleMarkRead = async () => {
    if (!notification) return;
    try {
      await Api.markNotificationRead(notificationId);
      setNotification({ ...notification, isRead: true, readAt: new Date().toISOString() });
      toast.success(isPolish ? 'Oznaczono jako przeczytane' : 'Marked as read');
    } catch (error) {
      console.error('Failed to mark as read', error);
      toast.error(isPolish ? 'Nie udało się oznaczyć jako przeczytane' : 'Failed to mark as read');
    }
  };

  const handleOpenChat = () => {
    if (!notification) return;

    if (isChatCollapsed) {
      toggleChatCollapse();
    }

    updateWorkspaceFromView(AppView.MY_WORK, notificationId, {
      type: 'notification',
      id: notificationId,
      notificationType: notification.type,
      severity: notification.severity,
      title: notification.title,
      message: notification.message,
      relatedEntity:
        notification.relatedObjectType && notification.relatedObjectId
          ? {
              type: notification.relatedObjectType,
              id: notification.relatedObjectId,
            }
          : null,
      projectId: notification.projectId || null,
      projectName: notification.projectName || null,
    });

    toast.success(isPolish ? 'Otwarto czat' : 'Chat opened');
  };

  const handleAskAI = () => {
    handleOpenChat();
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

  // Generate AI analysis based on notification data (enriched) + type fallback
  const generateAIAnalysis = () => {
    if (!notification) return null;

    const type = notification.type?.toUpperCase() || '';
    const data = notification.data || {};

    // Priority mapping: use enriched data if available, otherwise compute from type
    const priorityMap: Record<string, { en: string; pl: string }> = {
      CRITICAL: { en: 'CRITICAL', pl: 'KRYTYCZNY' },
      HIGH: { en: 'HIGH', pl: 'WYSOKI' },
      MEDIUM: { en: 'MEDIUM', pl: 'ŚREDNI' },
      LOW: { en: 'LOW', pl: 'NISKI' },
    };

    // Use enriched riskLevel from data if available (from AI triggers)
    const enrichedRiskLevel = (data.riskLevel as string) || '';
    const enrichedRecommendation = (data.recommendation as string) || '';
    const enrichedImpact = (data.impact as string) || '';
    const enrichedConfidence = data.confidence ? `${data.confidence}%` : '';

    // Compute priority from notification severity or enriched data
    let computedPriority = 'MEDIUM';
    let computedRiskLevel = 'medium';
    if (notification.severity === 'CRITICAL' || enrichedRiskLevel === 'critical') {
      computedPriority = 'CRITICAL';
      computedRiskLevel = 'critical';
    } else if (notification.severity === 'WARNING' || enrichedRiskLevel === 'high') {
      computedPriority = 'HIGH';
      computedRiskLevel = 'high';
    } else if (enrichedRiskLevel === 'medium') {
      computedPriority = 'MEDIUM';
      computedRiskLevel = 'medium';
    }

    // Build impact text from enriched data or infer from type
    let impact: string;
    if (enrichedImpact) {
      impact = enrichedImpact;
    } else if (type.includes('OVERDUE')) {
      const daysOverdue = Number(data.days_overdue || data.daysOverdue || 0);
      const blockingCount = Number(data.blocking_count || 0);
      impact = isPolish
        ? `To opóźnienie${daysOverdue > 0 ? ` (${daysOverdue} dni)` : ''} może wpłynąć na powiązane zadania${blockingCount > 0 ? ` i blokuje ${blockingCount} innych zadań` : ''}.`
        : `This delay${daysOverdue > 0 ? ` (${daysOverdue} days)` : ''} may impact related tasks${blockingCount > 0 ? ` and blocks ${blockingCount} other task(s)` : ''}.`;
    } else if (type.includes('BLOCKED')) {
      impact = isPolish
        ? 'Zablokowane zadanie wstrzymuje postęp w projekcie.'
        : 'Blocked task is halting project progress.';
    } else if (type.includes('DECISION')) {
      const deadlineDays = Number(data.deadline_days || 0);
      impact = isPolish
        ? `Decyzja jest wymagana${deadlineDays > 0 ? ` w ciągu ${deadlineDays} dni` : ''} do kontynuowania prac.`
        : `Decision is required${deadlineDays > 0 ? ` within ${deadlineDays} days` : ''} to continue work.`;
    } else if (type.includes('AI_RISK')) {
      impact = isPolish
        ? 'AI wykryło potencjalne ryzyko wymagające uwagi.'
        : 'AI detected a potential risk that requires attention.';
    } else if (type.includes('AI_RECOMMENDATION')) {
      const savings = data.savings_annual as string;
      impact = savings
        ? isPolish
          ? `AI zidentyfikowało potencjalne oszczędności: ${savings}/rok.`
          : `AI identified potential savings of ${savings}/year.`
        : isPolish
          ? 'AI ma rekomendację optymalizacji.'
          : 'AI has an optimization recommendation.';
    } else {
      impact = isPolish
        ? 'To powiadomienie wymaga Twojej uwagi.'
        : 'This notification requires your attention.';
    }

    // Build recommendation text
    let recommendation: string;
    if (enrichedRecommendation) {
      recommendation = enrichedRecommendation;
    } else if (type.includes('OVERDUE')) {
      recommendation = isPolish
        ? 'Zalecane: Natychmiast zaktualizuj status lub deleguj zadanie.'
        : 'Recommended: Immediately update status or delegate the task.';
    } else if (type.includes('BLOCKED')) {
      recommendation = isPolish
        ? 'Zalecane: Rozwiąż blokadę lub eskaluj do przełożonego.'
        : 'Recommended: Resolve blocker or escalate to manager.';
    } else if (type.includes('DECISION')) {
      recommendation = isPolish
        ? 'Zalecane: Przeanalizuj opcje i podejmij decyzję.'
        : 'Recommended: Analyze options and make a decision.';
    } else if (type.includes('AI')) {
      recommendation = isPolish
        ? 'Zalecane: Przejrzyj rekomendację AI i zdecyduj.'
        : 'Recommended: Review AI recommendation and decide.';
    } else {
      recommendation = isPolish
        ? 'Zalecane: Przejrzyj i podejmij odpowiednią akcję.'
        : 'Recommended: Review and take appropriate action.';
    }

    const priLabel = priorityMap[computedPriority] || priorityMap.MEDIUM;

    return {
      priority: isPolish ? priLabel.pl : priLabel.en,
      impact,
      recommendation,
      riskLevel: computedRiskLevel,
      confidence: enrichedConfidence,
      aiGenerated: !!data.aiGenerated,
    };
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
  const aiAnalysis = generateAIAnalysis();

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-navy-950 overflow-auto">
      <div className="flex-1 p-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Header - Full width */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-3 bg-gradient-to-r from-white/80 via-purple-50/30 to-white/80 dark:from-navy-900/80 dark:via-purple-900/20 dark:to-navy-900/80 backdrop-blur-xl rounded-2xl border border-purple-200/40 dark:border-purple-500/20 shadow-lg shadow-purple-500/10 dark:shadow-purple-500/20 overflow-hidden ring-1 ring-purple-500/10 dark:ring-purple-400/10"
          >
            <div className="flex items-center gap-4 px-5 py-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onClose}
                className="p-2 -ml-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-navy-800/80 transition-all"
              >
                <ChevronLeft size={20} />
              </motion.button>

              <div className="flex-1 flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${severityConfig.color} shadow-lg`} />
                <h1 className="flex-1 text-xl font-bold text-slate-900 dark:text-white truncate">
                  {notification.title || (isPolish ? 'Powiadomienie' : 'Notification')}
                </h1>
              </div>

              <div className="flex items-center gap-2">
                {/* Primary CTA — most important action, prominent in header */}
                {contract.primaryCta.kind === 'open_task' ? (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() =>
                      onNavigateToSource?.(
                        'task',
                        (contract.primaryCta as { kind: 'open_task'; id: string; label: string }).id
                      )
                    }
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-sm font-semibold transition-all shadow-sm"
                  >
                    <CheckSquare size={16} />
                    <span>{contract.primaryCta.label}</span>
                  </motion.button>
                ) : contract.primaryCta.kind === 'open_decision' ? (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() =>
                      onNavigateToSource?.(
                        'decision',
                        (
                          contract.primaryCta as {
                            kind: 'open_decision';
                            id: string;
                            label: string;
                          }
                        ).id
                      )
                    }
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 text-white hover:bg-purple-700 text-sm font-semibold transition-all shadow-sm"
                  >
                    <Scale size={16} />
                    <span>{contract.primaryCta.label}</span>
                  </motion.button>
                ) : contract.primaryCta.kind === 'open_project' ? (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() =>
                      onNavigateToSource?.(
                        'project',
                        (
                          contract.primaryCta as {
                            kind: 'open_project';
                            id: string;
                            label: string;
                          }
                        ).id
                      )
                    }
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-semibold transition-all shadow-sm"
                  >
                    <FolderOpen size={16} />
                    <span>{contract.primaryCta.label}</span>
                  </motion.button>
                ) : null}

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleMarkRead}
                  disabled={notification.isRead}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/70 dark:bg-navy-900/50 border border-blue-500/40 dark:border-blue-400/30 text-blue-700 dark:text-blue-300 hover:bg-blue-500/10 dark:hover:bg-blue-500/10 text-sm font-semibold transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <MailOpen size={16} />
                  <span>{isPolish ? 'Przeczytane' : 'Mark Read'}</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleOpenChat}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/70 dark:bg-navy-900/50 border border-purple-500/40 dark:border-purple-400/30 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10 dark:hover:bg-purple-500/10 text-sm font-semibold transition-all shadow-sm"
                >
                  <MessageSquare size={16} />
                  <span>{isPolish ? 'Czat' : 'Chat'}</span>
                </motion.button>
              </div>
            </div>
          </motion.div>

          {/* Left Column - 2/3 width */}
          <div className="lg:col-span-2 space-y-4 order-2 lg:order-1">
            {/* What's Happening */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200/60 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 overflow-hidden"
            >
              <button
                onClick={() => toggleSection('whats-happening')}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 dark:from-blue-500/20 dark:to-cyan-500/20">
                    <Info size={18} className="text-blue-500 dark:text-blue-400" />
                  </div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {isPolish ? 'Co się dzieje' : "What's happening"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${severityConfig.bgColor} ${severityConfig.textColor}`}
                  >
                    <SeverityIcon size={10} />
                    {isPolish ? severityConfig.label.pl : severityConfig.label.en}
                  </span>
                  <motion.div
                    animate={{ rotate: expandedSections.has('whats-happening') ? 180 : 0 }}
                  >
                    <ChevronDown size={18} className="text-slate-400" />
                  </motion.div>
                </div>
              </button>
              <AnimatePresence>
                {expandedSections.has('whats-happening') && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="border-t border-slate-200 dark:border-navy-700 overflow-hidden"
                  >
                    <div className="p-5 space-y-4">
                      <div className="text-lg font-semibold text-slate-900 dark:text-white">
                        {contract.what}
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-1">
                          {isPolish ? 'Dlaczego to ważne' : 'Why it matters'}
                        </div>
                        <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                          {contract.whyImportant}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-1">
                          {isPolish ? 'Co jest blokowane' : 'What is blocked'}
                        </div>
                        <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                          {contract.blocked}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* AI Analysis */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200/60 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 overflow-hidden"
            >
              <button
                onClick={() => toggleSection('ai-analysis')}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/10 to-indigo-500/10 dark:from-purple-500/20 dark:to-indigo-500/20">
                    <Bot size={18} className="text-purple-500 dark:text-purple-400" />
                  </div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {isPolish ? 'Analiza AI' : 'AI Analysis'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-purple-400" />
                  <motion.div animate={{ rotate: expandedSections.has('ai-analysis') ? 180 : 0 }}>
                    <ChevronDown size={18} className="text-slate-400" />
                  </motion.div>
                </div>
              </button>
              <AnimatePresence>
                {expandedSections.has('ai-analysis') && aiAnalysis && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="border-t border-slate-200 dark:border-navy-700 overflow-hidden"
                  >
                    <div className="p-5 space-y-4">
                      <div className="flex items-center gap-3">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            aiAnalysis.riskLevel === 'critical'
                              ? 'bg-red-500/10 text-red-500'
                              : aiAnalysis.riskLevel === 'high'
                                ? 'bg-amber-500/10 text-amber-500'
                                : aiAnalysis.riskLevel === 'medium'
                                  ? 'bg-blue-500/10 text-blue-500'
                                  : 'bg-slate-500/10 text-slate-500'
                          }`}
                        >
                          {isPolish ? 'Priorytet' : 'Priority'}: {aiAnalysis.priority}
                        </span>
                        {aiAnalysis.confidence && (
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-500/10 text-purple-500">
                            {isPolish ? 'Pewność' : 'Confidence'}: {aiAnalysis.confidence}
                          </span>
                        )}
                        {aiAnalysis.aiGenerated && (
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-500">
                            AI Generated
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                        {aiAnalysis.impact}
                      </div>
                      <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20">
                        <div className="flex items-start gap-2">
                          <Zap size={16} className="text-purple-500 mt-0.5 shrink-0" />
                          <div className="text-sm text-purple-700 dark:text-purple-300">
                            {aiAnalysis.recommendation}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={handleAskAI}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 transition-colors text-sm font-medium"
                      >
                        <MessageSquare size={14} />
                        {isPolish ? 'Zapytaj AI o więcej szczegółów' : 'Ask AI for more details'}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Expected Action / Checklist */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200/60 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 overflow-hidden"
            >
              <button
                onClick={() => toggleSection('expected-action')}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/20 dark:to-teal-500/20">
                    <CheckSquare size={18} className="text-emerald-500 dark:text-emerald-400" />
                  </div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {isPolish ? 'Oczekiwana akcja' : 'Expected Action'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">
                    {actionChecklist.filter((i) => i.completed).length}/{actionChecklist.length}
                  </span>
                  <motion.div
                    animate={{ rotate: expandedSections.has('expected-action') ? 180 : 0 }}
                  >
                    <ChevronDown size={18} className="text-slate-400" />
                  </motion.div>
                </div>
              </button>
              <AnimatePresence>
                {expandedSections.has('expected-action') && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="border-t border-slate-200 dark:border-navy-700 overflow-hidden"
                  >
                    <div className="p-5 space-y-3">
                      <div className="text-sm text-slate-700 dark:text-slate-300 mb-3">
                        {contract.expectedAction}
                      </div>
                      <div className="space-y-2">
                        {actionChecklist.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => toggleChecklistItem(item.id)}
                            className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-navy-800 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors text-left"
                          >
                            <div
                              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                                item.completed
                                  ? 'bg-emerald-500 border-emerald-500'
                                  : 'border-slate-300 dark:border-navy-600'
                              }`}
                            >
                              {item.completed && <Check size={12} className="text-white" />}
                            </div>
                            <span
                              className={`text-sm ${
                                item.completed
                                  ? 'text-slate-400 line-through'
                                  : 'text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {item.text}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Source Entity Preview */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200/60 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 overflow-hidden"
            >
              <button
                onClick={() => toggleSection('source-entity')}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500/10 to-blue-500/10 dark:from-indigo-500/20 dark:to-blue-500/20">
                    <Link2 size={18} className="text-indigo-500 dark:text-indigo-400" />
                  </div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {isPolish ? 'Źródło' : 'Source Entity'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {sourceEntity && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-navy-800 text-slate-500 capitalize">
                      {sourceEntity.type}
                    </span>
                  )}
                  <motion.div animate={{ rotate: expandedSections.has('source-entity') ? 180 : 0 }}>
                    <ChevronDown size={18} className="text-slate-400" />
                  </motion.div>
                </div>
              </button>
              <AnimatePresence>
                {expandedSections.has('source-entity') && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="border-t border-slate-200 dark:border-navy-700 overflow-hidden"
                  >
                    <div className="p-5 space-y-3">
                      {sourceEntityLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 size={20} className="animate-spin text-slate-400" />
                        </div>
                      ) : sourceEntity && sourceEntity.title ? (
                        <>
                          {/* Entity card */}
                          <button
                            onClick={() => onNavigateToSource?.(sourceEntity.type, sourceEntity.id)}
                            className="w-full text-left p-4 rounded-xl bg-slate-50 dark:bg-navy-800 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors group border border-slate-200/60 dark:border-navy-600/60"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                {getRelatedObjectIcon(sourceEntity.type?.toUpperCase())}
                                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                                  {getRelatedObjectLabel(sourceEntity.type?.toUpperCase())}
                                </span>
                              </div>
                              <ExternalLink
                                size={14}
                                className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"
                              />
                            </div>
                            <p className="text-sm font-semibold text-slate-800 dark:text-white mb-2">
                              {sourceEntity.title}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {sourceEntity.status && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium capitalize">
                                  {sourceEntity.status}
                                </span>
                              )}
                              {sourceEntity.priority && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium capitalize">
                                  {sourceEntity.priority}
                                </span>
                              )}
                              {(sourceEntity.assignee || sourceEntity.decider) && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-medium">
                                  {sourceEntity.assignee || sourceEntity.decider}
                                </span>
                              )}
                              {sourceEntity.dueDate && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-600 dark:text-slate-400 font-medium">
                                  {isPolish ? 'Termin' : 'Due'}:{' '}
                                  {new Date(sourceEntity.dueDate).toLocaleDateString()}
                                </span>
                              )}
                              {sourceEntity.progress !== undefined &&
                                sourceEntity.progress !== null && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
                                    {sourceEntity.progress}%
                                  </span>
                                )}
                            </div>
                            {sourceEntity.description && (
                              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                                {sourceEntity.description}
                              </p>
                            )}
                          </button>

                          {/* Project context */}
                          {notification.projectName && (
                            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-navy-800">
                              <FolderOpen size={16} className="text-indigo-400" />
                              <div>
                                <p className="text-xs text-slate-400">
                                  {isPolish ? 'Projekt' : 'Project'}
                                </p>
                                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                  {notification.projectName}
                                </p>
                              </div>
                            </div>
                          )}
                        </>
                      ) : notification.relatedObjectType && notification.relatedObjectId ? (
                        <button
                          onClick={() =>
                            onNavigateToSource?.(
                              notification.relatedObjectType!.toLowerCase(),
                              notification.relatedObjectId!
                            )
                          }
                          className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-navy-800 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors group"
                        >
                          <div className="flex items-center gap-3">
                            {getRelatedObjectIcon(notification.relatedObjectType)}
                            <div className="text-left">
                              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                {getRelatedObjectLabel(notification.relatedObjectType)}
                              </p>
                              <p className="text-xs text-slate-400 font-mono">
                                #{notification.relatedObjectId.slice(0, 8)}
                              </p>
                            </div>
                          </div>
                          <ExternalLink
                            size={14}
                            className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          />
                        </button>
                      ) : (
                        <p className="text-sm text-slate-400 text-center py-4">
                          {isPolish ? 'Brak powiązanej encji' : 'No linked entity'}
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Comments */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200/60 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 overflow-hidden"
            >
              <button
                onClick={() => toggleSection('comments')}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/20">
                    <MessageCircle size={18} className="text-amber-500 dark:text-amber-400" />
                  </div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {isPolish ? 'Komentarze' : 'Comments'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-navy-800 text-slate-500">
                    0
                  </span>
                  <motion.div animate={{ rotate: expandedSections.has('comments') ? 180 : 0 }}>
                    <ChevronDown size={18} className="text-slate-400" />
                  </motion.div>
                </div>
              </button>
              <AnimatePresence>
                {expandedSections.has('comments') && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="border-t border-slate-200 dark:border-navy-700 overflow-hidden"
                  >
                    <div className="p-5 space-y-3">
                      {sourceEntity?.type && (
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          {isPolish
                            ? `Komentarze dla powiązanej encji (${getRelatedObjectLabel(sourceEntity.type?.toUpperCase())})`
                            : `Comments for linked ${sourceEntity.type}`}
                        </p>
                      )}
                      <p className="text-sm text-slate-400 text-center py-3">
                        {isPolish ? 'Brak komentarzy' : 'No comments yet'}
                      </p>
                      <button
                        onClick={handleOpenChat}
                        className="w-full px-4 py-2.5 rounded-xl border border-dashed border-purple-300 dark:border-purple-500/30 text-purple-600 dark:text-purple-400 hover:border-purple-400 dark:hover:border-purple-400/50 hover:bg-purple-50/50 dark:hover:bg-purple-500/5 transition-colors text-sm flex items-center justify-center gap-2"
                      >
                        <MessageSquare size={14} />
                        {isPolish ? 'Otwórz czat z kontekstem' : 'Open contextual chat'}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Activity Log */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200/60 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 overflow-hidden"
            >
              <button
                onClick={() => toggleSection('activity-log')}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-slate-500/10 to-gray-500/10 dark:from-slate-500/20 dark:to-gray-500/20">
                    <History size={18} className="text-slate-500 dark:text-slate-400" />
                  </div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {isPolish ? 'Historia aktywności' : 'Activity Log'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-navy-800 text-slate-500">
                    1
                  </span>
                  <motion.div animate={{ rotate: expandedSections.has('activity-log') ? 180 : 0 }}>
                    <ChevronDown size={18} className="text-slate-400" />
                  </motion.div>
                </div>
              </button>
              <AnimatePresence>
                {expandedSections.has('activity-log') && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="border-t border-slate-200 dark:border-navy-700 overflow-hidden"
                  >
                    <div className="p-5 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-navy-800 flex items-center justify-center shrink-0">
                          <Bell size={14} className="text-slate-400" />
                        </div>
                        <div>
                          <p className="text-sm text-slate-700 dark:text-slate-300">
                            {isPolish ? 'Powiadomienie utworzone' : 'Notification created'}
                          </p>
                          <p className="text-xs text-slate-400">
                            {formatDate(notification.createdAt)}
                          </p>
                        </div>
                      </div>
                      {notification.readAt && (
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center shrink-0">
                            <MailOpen size={14} className="text-emerald-500" />
                          </div>
                          <div>
                            <p className="text-sm text-slate-700 dark:text-slate-300">
                              {isPolish ? 'Oznaczono jako przeczytane' : 'Marked as read'}
                            </p>
                            <p className="text-xs text-slate-400">
                              {formatDate(notification.readAt)}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>

          {/* Right Column - 1/3 width */}
          <div className="space-y-4 lg:sticky lg:top-6 self-start order-1 lg:order-2">
            {/* Control Panel */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200/60 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 overflow-hidden"
            >
              <motion.button
                whileHover={{ backgroundColor: 'rgba(148, 163, 184, 0.1)' }}
                whileTap={{ scale: 0.98 }}
                onClick={() => toggleSection('control')}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/10 to-indigo-500/10 dark:from-purple-500/20 dark:to-indigo-500/20">
                    <Flag size={18} className="text-purple-500 dark:text-purple-400" />
                  </div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Control
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 bg-slate-100/80 dark:bg-navy-800/80 px-2 py-0.5 rounded-lg">
                    #notif-{notificationId.slice(0, 8)}
                  </span>
                  <motion.div animate={{ rotate: expandedSections.has('control') ? 180 : 0 }}>
                    <ChevronDown size={18} className="text-slate-400" />
                  </motion.div>
                </div>
              </motion.button>

              <AnimatePresence>
                {expandedSections.has('control') && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="border-t border-slate-200 dark:border-navy-700 overflow-hidden"
                  >
                    <div className="p-4 space-y-3">
                      {/* Type */}
                      <div>
                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                          {isPolish ? 'Typ' : 'Type'}
                        </label>
                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600">
                          <TypeIcon size={14} className={typeConfig.color} />
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            {notification.type.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </div>

                      {/* Severity */}
                      <div>
                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                          {isPolish ? 'Priorytet' : 'Severity'}
                        </label>
                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600">
                          <div className={`w-2.5 h-2.5 rounded-full ${severityConfig.color}`} />
                          <span className={`text-sm font-medium ${severityConfig.textColor}`}>
                            {isPolish ? severityConfig.label.pl : severityConfig.label.en}
                          </span>
                        </div>
                      </div>

                      {/* Category */}
                      <div>
                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                          {isPolish ? 'Kategoria' : 'Category'}
                        </label>
                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600">
                          <TypeIcon size={14} className={typeConfig.color} />
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300 capitalize">
                            {notification.category}
                          </span>
                        </div>
                      </div>

                      {/* Project */}
                      {(notification.projectName || (notification.data as any)?.projectName) && (
                        <div>
                          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                            {isPolish ? 'Projekt' : 'Project'}
                          </label>
                          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600">
                            <FolderOpen size={14} className="text-indigo-400" />
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                              {notification.projectName || (notification.data as any)?.projectName}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Created */}
                      <div>
                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                          {isPolish ? 'Utworzono' : 'Created'}
                        </label>
                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600">
                          <Clock size={14} className="text-slate-400" />
                          <span className="text-sm text-slate-700 dark:text-slate-300">
                            {formatDate(notification.createdAt)}
                          </span>
                        </div>
                      </div>

                      {/* Read status */}
                      {notification.readAt && (
                        <div>
                          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                            {isPolish ? 'Przeczytano' : 'Read at'}
                          </label>
                          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600">
                            <MailOpen size={14} className="text-emerald-500" />
                            <span className="text-sm text-slate-700 dark:text-slate-300">
                              {formatDate(notification.readAt)}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="pt-2 border-t border-slate-200 dark:border-navy-700 space-y-2">
                        {/* Primary CTA */}
                        {contract.primaryCta.kind === 'open_task' ? (
                          <button
                            onClick={() =>
                              onNavigateToSource?.(
                                'task',
                                (
                                  contract.primaryCta as {
                                    kind: 'open_task';
                                    label: string;
                                    id: string;
                                  }
                                ).id
                              )
                            }
                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium text-sm"
                          >
                            <CheckSquare size={14} />
                            {contract.primaryCta.label}
                          </button>
                        ) : contract.primaryCta.kind === 'open_decision' ? (
                          <button
                            onClick={() =>
                              onNavigateToSource?.(
                                'decision',
                                (
                                  contract.primaryCta as {
                                    kind: 'open_decision';
                                    label: string;
                                    id: string;
                                  }
                                ).id
                              )
                            }
                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition-colors font-medium text-sm"
                          >
                            <Scale size={14} />
                            {contract.primaryCta.label}
                          </button>
                        ) : contract.primaryCta.kind === 'open_link' ? (
                          <a
                            href={contract.primaryCta.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 text-white hover:bg-primary-700 transition-colors font-medium text-sm"
                          >
                            {contract.primaryCta.label}
                            <ExternalLink size={14} />
                          </a>
                        ) : notification.relatedObjectType && notification.relatedObjectId ? (
                          <button
                            onClick={() =>
                              onNavigateToSource?.(
                                notification.relatedObjectType!.toLowerCase(),
                                notification.relatedObjectId!
                              )
                            }
                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-600 text-white hover:bg-slate-700 transition-colors font-medium text-sm"
                          >
                            <ExternalLink size={14} />
                            {isPolish ? 'Otwórz źródło' : 'Open Source'}
                          </button>
                        ) : null}

                        {/* Secondary actions */}
                        <div className="flex gap-2">
                          <button
                            onClick={handleMuteSimilar}
                            className="flex-1 px-3 py-2 rounded-lg bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors flex items-center justify-center gap-2 text-sm"
                          >
                            <BellOff size={14} />
                            <span>{isPolish ? 'Wycisz' : 'Mute'}</span>
                          </button>
                          <button
                            onClick={handleDelete}
                            className="flex-1 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2 text-sm"
                          >
                            <Trash2 size={14} />
                            <span>{isPolish ? 'Usuń' : 'Delete'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Stakeholders */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200/60 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 overflow-hidden"
            >
              <button
                onClick={() => toggleSection('stakeholders')}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 dark:from-cyan-500/20 dark:to-blue-500/20">
                    <Users size={18} className="text-cyan-500 dark:text-cyan-400" />
                  </div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {isPolish ? 'Interesariusze' : 'Stakeholders'}
                  </span>
                </div>
                <motion.div animate={{ rotate: expandedSections.has('stakeholders') ? 180 : 0 }}>
                  <ChevronDown size={18} className="text-slate-400" />
                </motion.div>
              </button>
              <AnimatePresence>
                {expandedSections.has('stakeholders') && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="border-t border-slate-200 dark:border-navy-700 overflow-hidden"
                  >
                    <div className="p-4 space-y-2">
                      {/* Show stakeholders from source entity and notification data */}
                      {sourceEntity?.assignee && (
                        <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-navy-800">
                          <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-xs font-bold text-blue-500">
                            {String(sourceEntity.assignee).charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                              {sourceEntity.assignee}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {isPolish ? 'Przypisany' : 'Assignee'}
                            </p>
                          </div>
                        </div>
                      )}
                      {sourceEntity?.decider && (
                        <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-navy-800">
                          <div className="w-7 h-7 rounded-full bg-purple-500/20 flex items-center justify-center text-xs font-bold text-purple-500">
                            {String(sourceEntity.decider).charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                              {sourceEntity.decider}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {isPolish ? 'Decydent' : 'Decider'}
                            </p>
                          </div>
                        </div>
                      )}
                      {sourceEntity?.owner && (
                        <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-navy-800">
                          <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs font-bold text-emerald-500">
                            {String(sourceEntity.owner).charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                              {sourceEntity.owner}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {isPolish ? 'Właściciel' : 'Owner'}
                            </p>
                          </div>
                        </div>
                      )}
                      {notification.data?.assignee &&
                        !sourceEntity?.assignee &&
                        !sourceEntity?.decider && (
                          <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-navy-800">
                            <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-xs font-bold text-blue-500">
                              {String(notification.data.assignee).charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                {String(notification.data.assignee)}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {isPolish ? 'Przypisany' : 'Assignee'}
                              </p>
                            </div>
                          </div>
                        )}
                      {notification.data?.assigned_by && (
                        <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-navy-800">
                          <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center text-xs font-bold text-amber-500">
                            {String(notification.data.assigned_by).charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                              {String(notification.data.assigned_by)}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {isPolish ? 'Przydzielony przez' : 'Assigned by'}
                            </p>
                          </div>
                        </div>
                      )}
                      {!sourceEntity?.assignee &&
                        !sourceEntity?.decider &&
                        !sourceEntity?.owner &&
                        !notification.data?.assignee &&
                        !notification.data?.assigned_by && (
                          <p className="text-sm text-slate-400 text-center py-2">
                            {isPolish
                              ? 'Brak przypisanych interesariuszy'
                              : 'No stakeholders assigned'}
                          </p>
                        )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Why You Got It */}
            {(contract.whyYouGotIt || notification.data?.whyYouGotIt) && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 }}
                className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200/60 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 overflow-hidden"
              >
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/20">
                      <Info size={18} className="text-amber-500 dark:text-amber-400" />
                    </div>
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {isPolish ? 'Dlaczego to dostałeś' : 'Why you got it'}
                    </span>
                  </div>
                </div>
                <div className="border-t border-slate-200 dark:border-navy-700 p-4">
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                    {contract.whyYouGotIt || String(notification.data?.whyYouGotIt || '')}
                  </p>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationDetailView;
