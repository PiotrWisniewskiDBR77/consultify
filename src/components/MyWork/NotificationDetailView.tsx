/**
 * NotificationDetailView
 * Full-page notification detail view with N / C presentation modes.
 * N mode: NModeHeader + PropertiesStrip + ActionBar + LeftNav (8 sections) + Canvas
 * C mode: Classic accordion-style cards layout (legacy D presentation)
 *
 * @see docs/ui-standards/01-shell-layout/presentation-modes.md
 */
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  BellOff,
  BookOpen,
  Bot,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  Clock,
  Copy,
  CreditCard,
  ExternalLink,
  FileText,
  Flag,
  FolderOpen,
  History,
  Info,
  Loader2,
  MailOpen,
  Megaphone,
  MessageCircle,
  MessageSquare,
  Monitor,
  Scale,
  Sparkles,
  Target,
  Trash2,
  Users,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import {
  buildNotificationContent,
  type SuggestedChecklistItem,
} from '@/components/Notifications/notificationContent';
import { AIFieldEnhancer } from '@/components/shared/AIFieldEnhancer';
import { Callout } from '@/components/shared/NModeBlocks';
import { LoadingState } from '@/components/ui/primitives';
import { usePresentationMode } from '@/hooks/usePresentationMode';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useAppStore } from '@/store/useAppStore';
import { useConversationStore } from '@/store/useConversationStore';
import { AppView } from '@/types';
import { muteNotificationTypeForSession } from '@/utils/notificationMuteSession';

import { Api } from '../../services/api';
import { NModeCanvas } from '../shared/NModeLayout/NModeCanvas';
import { NModeHeader } from '../shared/NModeLayout/NModeHeader';
import { NModeLeftNav } from '../shared/NModeLayout/NModeLeftNav';
import { NModePropertiesStrip } from '../shared/NModeLayout/NModePropertiesStrip';
import type { NModePropertyField, NModeSection } from '../shared/NModeLayout/types';
import TeresaMark from '../shared/TeresaMark';
import { PresentationModeSwitcher } from './shared/PresentationModeSwitcher';

// ── Types ────────────────────────────────────────────────────────────────────

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
  category:
    | 'ai'
    | 'task'
    | 'system'
    | 'decision'
    | 'project'
    | 'initiative'
    | 'billing'
    | 'dbr77'
    | 'feedback';
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

// ── Severity configuration ───────────────────────────────────────────────────

const SEVERITY_CONFIG = {
  INFO: {
    label: { en: 'Info', pl: 'Informacja' },
    color: 'bg-blue-500',
    textColor: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    icon: Info,
    dotColor: 'bg-blue-400',
  },
  WARNING: {
    label: { en: 'Warning', pl: 'Ostrzeżenie' },
    color: 'bg-amber-500',
    textColor: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    icon: AlertTriangle,
    dotColor: 'bg-amber-400',
  },
  CRITICAL: {
    label: { en: 'Critical', pl: 'Krytyczne' },
    color: 'bg-danger-500',
    textColor: 'text-danger-500',
    bgColor: 'bg-danger-500/10',
    borderColor: 'border-danger-500/30',
    icon: AlertCircle,
    dotColor: 'bg-danger-500',
  },
};

// ── Type icons ───────────────────────────────────────────────────────────────

const TYPE_ICONS: Record<string, { icon: React.ElementType; color: string }> = {
  TASK_ASSIGNED: { icon: CheckSquare, color: 'text-blue-400' },
  TASK_OVERDUE: { icon: Clock, color: 'text-danger-400' },
  TASK_BLOCKED: { icon: AlertCircle, color: 'text-danger-400' },
  DECISION_REQUIRED: { icon: Scale, color: 'text-primary-400' },
  DECISION_OVERDUE: { icon: Scale, color: 'text-danger-400' },
  INITIATIVE_STARTED: { icon: Target, color: 'text-emerald-400' },
  INITIATIVE_STALLED: { icon: Target, color: 'text-amber-400' },
  INITIATIVE_COMPLETED: { icon: Target, color: 'text-emerald-400' },
  AI_RISK_DETECTED: { icon: AlertTriangle, color: 'text-amber-400' },
  AI_RECOMMENDATION: { icon: Info, color: 'text-primary-400' },
  AI_OVERLOAD_DETECTED: { icon: AlertTriangle, color: 'text-danger-400' },
  AI_DEPENDENCY_CONFLICT: { icon: AlertCircle, color: 'text-amber-400' },
  SYSTEM_ALERT: { icon: Bell, color: 'text-slate-600' },
  // App / billing comms
  PAYMENT_FAILED: { icon: CreditCard, color: 'text-danger-400' },
  USAGE_ALERT: { icon: AlertTriangle, color: 'text-amber-400' },
  SUBSCRIPTION_CHANGE: { icon: CreditCard, color: 'text-indigo-400' },
  BILLING_LIMIT_WARNING: { icon: AlertTriangle, color: 'text-amber-400' },
  BILLING_LIMIT_REACHED: { icon: AlertCircle, color: 'text-danger-400' },
  INVOICE_READY: { icon: CreditCard, color: 'text-emerald-400' },
  // DBR77 comms
  DBR77_UPDATE: { icon: Megaphone, color: 'text-primary-400' },
  DBR77_RELEASE_NOTES: { icon: Megaphone, color: 'text-indigo-400' },
  DBR77_KB_NEW: { icon: BookOpen, color: 'text-emerald-400' },
  DBR77_INSTRUCTION: { icon: BookOpen, color: 'text-amber-400' },
};

// ── Component ────────────────────────────────────────────────────────────────

export const NotificationDetailView: React.FC<NotificationDetailViewProps> = ({
  notificationId,
  onClose,
  onNavigateToSource,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const { isChatCollapsed, toggleChatCollapse } = useAppStore();
  const { updateWorkspaceFromView } = useConversationStore();

  // ── Presentation Mode (N = page-first / C = legacy accordion) ────────────
  const { mode: presentationMode, setMode: setPresentationMode } = usePresentationMode({
    entityType: 'notification',
    syncURL: true,
  });
  const reducedMotion = useReducedMotion();
  const motionDuration = reducedMotion ? 0 : 0.22;

  useEffect(() => {
    if (presentationMode === 'c' && import.meta.env.VITE_ENABLE_LEGACY_C_MODE !== 'true') {
      setPresentationMode('n');
    }
  }, [presentationMode, setPresentationMode]);

  // ── State ────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<NotificationData | null>(null);
  const [sourceEntity, setSourceEntity] = useState<Record<string, any> | null>(null);
  const [sourceEntityLoading, setSourceEntityLoading] = useState(false);
  const [worksheetSaving, setWorksheetSaving] = useState(false);
  const [lastSavedWorksheetSnapshot, setLastSavedWorksheetSnapshot] = useState<string>('');
  const [lastWorksheetSavedAt, setLastWorksheetSavedAt] = useState<string | null>(null);

  // N-mode active section
  const [activeNSection, setActiveNSection] = useState('whats-happening');

  // Expanded sections state (C-mode accordion)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['whats-happening', 'ai-analysis', 'expected-action', 'source-entity', 'control'])
  );

  // Action checklist state (urgency: 'critical' | 'normal' | 'optional')
  const [actionChecklist, setActionChecklist] = useState<
    { id: string; text: string; completed: boolean; urgency?: string }[]
  >([]);

  // Expected action draft (editable locally; AI refines this text)
  const [expectedActionDraft, setExpectedActionDraft] = useState('');

  // "What's Happening" field drafts (editable locally, styled like Task Description & Scope)
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [whyImportantDraft, setWhyImportantDraft] = useState('');
  const [blockedDraft, setBlockedDraft] = useState('');

  // ── Comments state ──────────────────────────────────────────────────────
  const [comments, setComments] = useState<
    {
      id: string;
      notificationId: string;
      userId: string;
      user: { id: string; firstName: string; lastName: string; avatarUrl?: string };
      content: string;
      priority?: string;
      createdAt: string;
      updatedAt: string;
    }[]
  >([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsCount, setCommentsCount] = useState<number>(0);
  const [newCommentText, setNewCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  // ── Activity log state ──────────────────────────────────────────────────
  const [activityLog, setActivityLog] = useState<
    {
      id: string;
      notificationId: string;
      userId: string;
      userName?: string;
      action: string;
      description: string;
      createdAt: string;
    }[]
  >([]);
  const [activityLogLoading, setActivityLogLoading] = useState(false);
  const [activityCount, setActivityCount] = useState<number>(0);

  // ── Snooze state ────────────────────────────────────────────────────────
  const [showSnoozeMenu, setShowSnoozeMenu] = useState(false);
  const [isSnoozed, setIsSnoozed] = useState(false);
  const [snoozedUntil, setSnoozedUntil] = useState<string | null>(null);

  // Mute dropdown
  const [showMuteMenu, setShowMuteMenu] = useState(false);

  // Save as note
  const [savingAsNote, setSavingAsNote] = useState(false);

  // Worksheet analysis (AI fills the notification "sheet" fields)
  const [isAnalyzingWorksheet, setIsAnalyzingWorksheet] = useState(false);

  const worksheetDraft = useMemo(
    () => ({
      description: descriptionDraft,
      whyImportant: whyImportantDraft,
      blocked: blockedDraft,
      expectedAction: expectedActionDraft,
    }),
    [descriptionDraft, whyImportantDraft, blockedDraft, expectedActionDraft]
  );

  const worksheetSnapshot = useMemo(() => {
    try {
      return JSON.stringify(worksheetDraft);
    } catch {
      return '';
    }
  }, [worksheetDraft]);

  const worksheetIsDirty = useMemo(() => {
    if (!notificationId) return false;
    if (!lastSavedWorksheetSnapshot) return false;
    return worksheetSnapshot !== lastSavedWorksheetSnapshot;
  }, [notificationId, worksheetSnapshot, lastSavedWorksheetSnapshot]);

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

  // ── Data loading ─────────────────────────────────────────────────────────

  useEffect(() => {
    loadNotification();
    markAsRead();
  }, [notificationId]);

  // Load comments & activity log when the section is activated (lazy)
  useEffect(() => {
    if (activeNSection === 'comments' && comments.length === 0 && !commentsLoading) {
      loadComments();
    }
    if (activeNSection === 'activity-log' && activityLog.length === 0 && !activityLogLoading) {
      loadActivityLog();
    }
  }, [activeNSection]);

  const loadNotification = async () => {
    try {
      setLoading(true);
      // Try direct API first, then fallback to fetch-all + filter
      let found: any = null;
      try {
        found = await Api.getNotificationById(notificationId);
      } catch {
        // direct endpoint failed — will try fallback below
      }

      // Fallback: if direct fetch returned null/undefined, fetch all and filter
      if (!found) {
        try {
          const notifications = await Api.getNotifications();
          found = notifications.find((n: any) => n.id === notificationId);
        } catch {
          // fallback also failed
        }
      }

      if (found) {
        const notifData = {
          ...found,
          severity: found.severity || 'INFO',
          category: found.category || 'system',
        };
        setNotification(notifData);

        // Lightweight counts (avoid loading big lists unless needed)
        setCommentsCount(
          Number((found as any).commentsCount || (found as any).comments_count || 0)
        );
        setActivityCount(
          Number((found as any).activityCount || (found as any).activity_count || 0)
        );

        // Snooze state
        if (found.snoozedUntil) {
          setIsSnoozed(new Date(found.snoozedUntil) > new Date());
          setSnoozedUntil(found.snoozedUntil);
        }

        if (found.checklist && Array.isArray(found.checklist)) {
          setActionChecklist(found.checklist);
        } else {
          generateActionChecklist(found);
        }

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

  const loadComments = async () => {
    try {
      setCommentsLoading(true);
      const data = await Api.getNotificationComments(notificationId);
      setComments(data);
      setCommentsCount(data.length);
    } catch (error) {
      console.error('Failed to load comments', error);
    } finally {
      setCommentsLoading(false);
    }
  };

  const loadActivityLog = async () => {
    try {
      setActivityLogLoading(true);
      const data = await Api.getNotificationActivityLog(notificationId);
      setActivityLog(data);
      setActivityCount(data.length);
    } catch (error) {
      console.error('Failed to load activity log', error);
    } finally {
      setActivityLogLoading(false);
    }
  };

  const generateActionChecklist = (notif: any) => {
    // Use the enriched rule-engine checklist from notificationContent contract
    const notifContract = buildNotificationContent(notif, t);
    const suggested: SuggestedChecklistItem[] = notifContract.suggestedChecklist || [];

    if (suggested.length > 0) {
      const items = suggested.map((s, idx) => ({
        id: String(idx + 1),
        text: s.text,
        completed: false,
        urgency: s.urgency || 'normal',
      }));
      setActionChecklist(items);
      return;
    }

    // Fallback — should not happen since inferChecklist always returns items
    setActionChecklist([
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
    ]);
  };

  const toggleChecklistItem = (id: string) => {
    setActionChecklist((prev) => {
      const updated = prev.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      );
      Api.updateNotificationChecklist(notificationId, updated).catch((err) =>
        console.error('Failed to persist checklist', err)
      );
      return updated;
    });
  };

  const handleSaveWorksheet = useCallback(
    async (silent = false) => {
      if (!notificationId) return;
      if (!worksheetIsDirty) return;
      try {
        setWorksheetSaving(true);
        await Api.updateNotificationWorksheet(notificationId, worksheetDraft);
        setLastSavedWorksheetSnapshot(worksheetSnapshot);
        setLastWorksheetSavedAt(new Date().toISOString());
        if (!silent) {
          toast.success(isPolish ? 'Zapisano' : 'Saved');
        }
      } catch (e: any) {
        if (!silent) {
          toast.error(isPolish ? 'Nie udało się zapisać' : 'Failed to save');
        }
      } finally {
        setWorksheetSaving(false);
      }
    },
    [notificationId, worksheetIsDirty, worksheetDraft, worksheetSnapshot, isPolish]
  );

  const worksheetAutosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!notificationId) return;
    if (!worksheetIsDirty) return;
    if (worksheetSaving) return;
    if (loading) return;

    if (worksheetAutosaveTimerRef.current) clearTimeout(worksheetAutosaveTimerRef.current);
    worksheetAutosaveTimerRef.current = setTimeout(() => {
      handleSaveWorksheet(true);
    }, 1200);

    return () => {
      if (worksheetAutosaveTimerRef.current) clearTimeout(worksheetAutosaveTimerRef.current);
    };
  }, [
    notificationId,
    worksheetIsDirty,
    worksheetSaving,
    loading,
    worksheetSnapshot,
    handleSaveWorksheet,
  ]);

  const applyChecklistFromAIText = useCallback(
    (text: string) => {
      const rawLines = String(text || '')
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);

      const normalize = (line: string) =>
        line
          .replace(/^\[(?:x|X| )\]\s*/g, '')
          .replace(/^(?:[-*•]\s+|\d+[.)]\s+)/g, '')
          .trim();

      const lines = rawLines.map(normalize).filter(Boolean);
      if (lines.length === 0) return;

      const prev = actionChecklist;
      const used = new Set<string>();

      const next = lines.slice(0, 12).map((line, idx) => {
        const matchIdx = prev.findIndex(
          (p, i) =>
            !used.has(String(i)) &&
            String(p.text || '')
              .trim()
              .toLowerCase() === line.toLowerCase()
        );

        if (matchIdx >= 0) {
          used.add(String(matchIdx));
          return { ...prev[matchIdx], text: line };
        }

        const id =
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? (crypto.randomUUID as any)()
            : `${Date.now()}-${idx}`;
        return { id, text: line, completed: false };
      });

      setActionChecklist(next);
      Api.updateNotificationChecklist(notificationId, next).catch((err) =>
        console.error('Failed to persist checklist', err)
      );
    },
    [actionChecklist, notificationId]
  );

  // ── Handlers ─────────────────────────────────────────────────────────────

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
    )
      return;
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

  const handleMuteThis = async () => {
    try {
      await Api.dismissNotification(notificationId);
      toast.success(isPolish ? 'Wyciszono powiadomienie' : 'Notification muted');
      onClose();
    } catch (error) {
      console.error('Failed to dismiss notification', error);
      toast.error(isPolish ? 'Nie udało się wyciszyć' : 'Failed to mute');
    }
  };

  const handleMuteSimilar = async () => {
    if (!notification?.type) return;
    const typeKey = String(notification.type).toUpperCase();
    try {
      muteNotificationTypeForSession(typeKey);
      toast.success(
        isPolish
          ? `Wyciszono typ (sesja): ${typeKey.replace(/_/g, ' ')}`
          : `Muted type (session): ${typeKey.replace(/_/g, ' ')}`
      );
      setShowMuteMenu(false);
      onClose();
    } catch (error) {
      console.error('Failed to mute type', error);
      toast.error(isPolish ? 'Nie udało się wyciszyć typu' : 'Failed to mute type');
    }
  };

  const handleSaveAsNote = async () => {
    if (!notification) return;
    try {
      setSavingAsNote(true);
      const title = notification.title || 'Notification';
      const body = notification.message || (notification as any).body || '';
      await Api.createNotebookPage({
        title,
        contentText: title + '\n\n' + body,
        tags: ['from-notification'],
        status: 'inbox',
      });
      toast.success(isPolish ? 'Zapisano jako notatkę' : 'Saved as note');
    } catch (error) {
      console.error('Failed to save as note', error);
      toast.error(isPolish ? 'Nie udało się zapisać jako notatkę' : 'Failed to save as note');
    } finally {
      setSavingAsNote(false);
    }
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
    if (isChatCollapsed) toggleChatCollapse();

    updateWorkspaceFromView(AppView.MY_WORK, notificationId, {
      type: 'notification',
      id: notificationId,
      notificationType: notification.type,
      severity: notification.severity,
      title: notification.title,
      message: notification.message,
      relatedEntity:
        notification.relatedObjectType && notification.relatedObjectId
          ? { type: notification.relatedObjectType, id: notification.relatedObjectId }
          : null,
      projectId: notification.projectId || null,
      projectName: notification.projectName || null,
    });
    toast.success(isPolish ? 'Otwarto czat' : 'Chat opened');
  };

  const handleAskAI = () => {
    handleOpenChat();
  };

  /**
   * AI-powered contextual worksheet generator.
   * Fills ALL fields: description, whyImportant, blocked, expectedAction, checklist.
   * Content is contextual — not a copy of other screens, but specific to what
   * the user needs to know and do about THIS notification.
   *
   * @param silent If true, no toast on success (used for auto-trigger on load)
   */
  const handleAnalyzeWithAI = useCallback(
    async (silent = false) => {
      if (!notification || isAnalyzingWorksheet) return;
      setIsAnalyzingWorksheet(true);

      try {
        const checklistSnapshot = actionChecklist
          .map((i) => `${i.completed ? '[x]' : '[ ]'} ${String(i.text || '').trim()}`)
          .filter((l) => l.replace(/\[.\]\s*/g, '').trim().length > 0)
          .join('\n');

        const sourceSummary =
          sourceEntity && sourceEntity.title
            ? `${String(sourceEntity.type || '')} — ${String(sourceEntity.title || '')}${sourceEntity.status ? ` (status: ${sourceEntity.status})` : ''}${sourceEntity.priority ? ` (priority: ${sourceEntity.priority})` : ''}`
            : notification.relatedObjectType && notification.relatedObjectId
              ? `${notification.relatedObjectType}:${notification.relatedObjectId}`
              : '';

        // Gather all available data context
        const dataFields = Object.entries(notification.data || {})
          .filter(([, v]) => v !== null && v !== undefined && v !== '')
          .map(([k, v]) => `  ${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
          .join('\n');

        const prompt = isPolish
          ? [
              'Jesteś asystentem PMO. Analizujesz powiadomienie i tworzysz KONTEKSTOWY briefing dla użytkownika.',
              '',
              'CEL: Każde pole musi odpowiadać na konkretne pytanie użytkownika:',
              '- description: CO się wydarzyło? (nie kopiuj tytułu — wyjaśnij SYTUACJĘ: co, gdzie, kiedy, kto jest zaangażowany)',
              '- whyImportant: DLACZEGO to ważne? (konkretny wpływ: na co to wpływa, jakie są konsekwencje ignorowania, kto ucierpi)',
              '- blocked: CO jest zablokowane/zagrożone? (co nie może się wydarzyć dopóki problem nie zostanie rozwiązany)',
              '- expectedAction: CO użytkownik powinien ZROBIĆ? (precyzyjna instrukcja działania, nie "otwórz dokument")',
              '- checklist: KROKI do wykonania (3-6, operacyjne, z uwzględnieniem pilności)',
              '',
              'ZASADY:',
              '- Pisz konkretnie — używaj nazw, dat, osób z danych powiadomienia',
              '- NIE kopiuj tytułu do opisu — opis ma ROZWIJAĆ i WYJAŚNIAĆ sytuację',
              '- Każde pole ma inną funkcję — nie powtarzaj treści między polami',
              '- Jeśli brakuje danych, napisz co wiadomo i co trzeba sprawdzić',
              '- Użyj języka polskiego',
              '',
              'Zwróć WYŁĄCZNIE poprawny JSON:',
              '{"description":"...","whyImportant":"...","blocked":"...","expectedAction":"...","checklist":["...","..."]}',
              '',
              '=== DANE POWIADOMIENIA ===',
              `title: ${notification.title}`,
              `type: ${notification.type}`,
              `severity: ${notification.severity}`,
              `category: ${notification.category}`,
              `message: ${notification.message}`,
              sourceSummary ? `source: ${sourceSummary}` : '',
              notification.projectName ? `project: ${notification.projectName}` : '',
              dataFields ? `data:\n${dataFields}` : '',
            ]
              .filter(Boolean)
              .join('\n')
          : [
              'You are a PMO assistant. Analyze this notification and create a CONTEXTUAL briefing for the user.',
              '',
              'GOAL: Each field answers a specific user question:',
              "- description: WHAT happened? (don't copy the title — explain the SITUATION: what, where, when, who is involved)",
              '- whyImportant: WHY does it matter? (specific impact: what it affects, consequences of ignoring, who suffers)',
              "- blocked: WHAT is blocked/at risk? (what can't happen until this is resolved)",
              '- expectedAction: WHAT should the user DO? (precise action instruction, not "open document")',
              '- checklist: STEPS to execute (3-6, operational, urgency-aware)',
              '',
              'RULES:',
              '- Be specific — use names, dates, people from notification data',
              '- Do NOT copy the title into description — description should EXPAND and EXPLAIN the situation',
              '- Each field has a different function — do not repeat content across fields',
              '- If data is missing, state what is known and what needs to be checked',
              '- Use English language',
              '',
              'Return ONLY valid JSON:',
              '{"description":"...","whyImportant":"...","blocked":"...","expectedAction":"...","checklist":["...","..."]}',
              '',
              '=== NOTIFICATION DATA ===',
              `title: ${notification.title}`,
              `type: ${notification.type}`,
              `severity: ${notification.severity}`,
              `category: ${notification.category}`,
              `message: ${notification.message}`,
              sourceSummary ? `source: ${sourceSummary}` : '',
              notification.projectName ? `project: ${notification.projectName}` : '',
              dataFields ? `data:\n${dataFields}` : '',
            ]
              .filter(Boolean)
              .join('\n');

        const aiRes = await Api.post('/ai/chat', {
          message: prompt,
          history: [],
          systemInstruction: isPolish
            ? 'Jesteś asystentem PMO. Zwróć tylko poprawny JSON. Bez komentarzy, bez markdown. Pisz kontekstowo — nie generycznie.'
            : 'You are a PMO assistant. Return only valid JSON. No commentary, no markdown. Write contextually — not generically.',
          roleName: 'Notification Context Builder',
        });

        const raw = String(aiRes?.text || aiRes?.content || '').trim();
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('AI returned no JSON');

        const parsed = JSON.parse(jsonMatch[0]) as any;

        // Apply all fields
        if (typeof parsed.description === 'string' && parsed.description.trim()) {
          setDescriptionDraft(parsed.description.trim());
        }
        if (typeof parsed.whyImportant === 'string' && parsed.whyImportant.trim()) {
          setWhyImportantDraft(parsed.whyImportant.trim());
        }
        if (typeof parsed.blocked === 'string' && parsed.blocked.trim()) {
          setBlockedDraft(parsed.blocked.trim());
        }
        if (typeof parsed.expectedAction === 'string' && parsed.expectedAction.trim()) {
          setExpectedActionDraft(parsed.expectedAction.trim());
        }

        const nextChecklist = Array.isArray(parsed.checklist)
          ? parsed.checklist
              .filter((x: any) => typeof x === 'string')
              .map((x: string) => x.trim())
              .filter(Boolean)
          : [];
        if (nextChecklist.length > 0) {
          applyChecklistFromAIText(nextChecklist.map((x: string) => `- ${x}`).join('\n'));
        }

        if (!silent) {
          setActiveNSection('whats-happening');
          toast.success(
            isPolish ? 'AI wypełniło kontekst powiadomienia' : 'AI filled notification context'
          );
        }
      } catch (err) {
        console.error('[NotificationDetailView] Analyze with AI failed:', err);
        if (!silent) {
          toast.error(
            isPolish
              ? 'Nie udało się wypełnić kontekstu przez AI'
              : 'Failed to fill context with AI'
          );
        }
      } finally {
        setIsAnalyzingWorksheet(false);
      }
    },
    [
      notification,
      isAnalyzingWorksheet,
      isPolish,
      actionChecklist,
      sourceEntity,
      applyChecklistFromAIText,
      setActiveNSection,
    ]
  );

  // ── Comment handlers ────────────────────────────────────────────────────

  const handleAddComment = useCallback(async () => {
    const text = newCommentText.trim();
    if (!text || submittingComment) return;
    try {
      setSubmittingComment(true);
      const comment = await Api.addNotificationComment(notificationId, text);
      setComments((prev) => [...prev, comment]);
      setCommentsCount((prev) => prev + 1);
      setNewCommentText('');
      commentInputRef.current?.focus();
      toast.success(isPolish ? 'Komentarz dodany' : 'Comment added');
    } catch (error) {
      console.error('Failed to add comment', error);
      toast.error(isPolish ? 'Nie udało się dodać komentarza' : 'Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  }, [newCommentText, notificationId, submittingComment, isPolish]);

  const handleDeleteComment = useCallback(
    async (commentId: string) => {
      if (!confirm(isPolish ? 'Usunąć ten komentarz?' : 'Delete this comment?')) return;
      try {
        await Api.deleteNotificationComment(notificationId, commentId);
        setComments((prev) => prev.filter((c) => c.id !== commentId));
        setCommentsCount((prev) => Math.max(0, prev - 1));
        toast.success(isPolish ? 'Komentarz usunięty' : 'Comment deleted');
      } catch (error) {
        console.error('Failed to delete comment', error);
        toast.error(isPolish ? 'Nie udało się usunąć komentarza' : 'Failed to delete comment');
      }
    },
    [notificationId, isPolish]
  );

  // ── Snooze handler ──────────────────────────────────────────────────────

  const handleSnooze = useCallback(
    async (preset: string) => {
      try {
        const result = await Api.snoozeNotification(notificationId, preset);
        setIsSnoozed(true);
        setSnoozedUntil(result.snoozedUntil);
        setShowSnoozeMenu(false);
        toast.success(
          isPolish
            ? `Odłożono do ${new Date(result.snoozedUntil).toLocaleString('pl-PL')}`
            : `Snoozed until ${new Date(result.snoozedUntil).toLocaleString('en-US')}`
        );
      } catch (error) {
        console.error('Failed to snooze', error);
        toast.error(isPolish ? 'Nie udało się odłożyć' : 'Failed to snooze');
      }
    },
    [notificationId, isPolish]
  );

  // ── Keyboard shortcuts ──────────────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when typing in input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          if (showSnoozeMenu) {
            setShowSnoozeMenu(false);
          } else if (showMuteMenu) {
            setShowMuteMenu(false);
          } else {
            onClose();
          }
          break;
        case 'm':
        case 'M':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            handleMarkRead();
          }
          break;
        case 'd':
        case 'D':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            handleDelete();
          }
          break;
      }
    };

    // Close snooze menu on click outside
    const handleClickOutside = () => {
      if (showSnoozeMenu) setShowSnoozeMenu(false);
      if (showMuteMenu) setShowMuteMenu(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('click', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('click', handleClickOutside);
    };
  }, [notification, showSnoozeMenu, showMuteMenu]);

  // ── Helpers ──────────────────────────────────────────────────────────────

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
        return <CheckSquare size={14} className="text-blue-400" />;
      case 'DECISION':
        return <Scale size={14} className="text-primary-400" />;
      case 'INITIATIVE':
        return <Target size={14} className="text-emerald-400" />;
      case 'PROJECT':
        return <FolderOpen size={14} className="text-indigo-400" />;
      case 'GATE':
        return <Flag size={14} className="text-amber-400" />;
      default:
        return <Bell size={14} className="text-slate-600" />;
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

  // ── AI Analysis computation ──────────────────────────────────────────────

  const generateAIAnalysis = () => {
    if (!notification) return null;

    const type = notification.type?.toUpperCase() || '';
    const data = notification.data || {};

    const priorityMap: Record<string, { en: string; pl: string }> = {
      CRITICAL: { en: 'CRITICAL', pl: 'KRYTYCZNY' },
      HIGH: { en: 'HIGH', pl: 'WYSOKI' },
      MEDIUM: { en: 'MEDIUM', pl: 'ŚREDNI' },
      LOW: { en: 'LOW', pl: 'NISKI' },
    };

    const enrichedRiskLevel = (data.riskLevel as string) || '';
    const enrichedRecommendation = (data.recommendation as string) || '';
    const enrichedImpact = (data.impact as string) || '';
    const enrichedConfidence = data.confidence ? `${data.confidence}%` : '';

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

  // ── Derived data (safe even when notification is null) ───────────────────

  const severityConfig = notification
    ? SEVERITY_CONFIG[notification.severity]
    : SEVERITY_CONFIG.INFO;
  const SeverityIcon = severityConfig.icon;
  const typeKey = (notification?.type || '').toUpperCase();
  const typeConfig = notification
    ? TYPE_ICONS[typeKey] || { icon: Bell, color: 'text-slate-600' }
    : { icon: Bell, color: 'text-slate-600' };
  const TypeIcon = typeConfig.icon;
  const contract = notification ? buildNotificationContent(notification as any, t) : null;
  const aiAnalysis = generateAIAnalysis();

  // Keep expected action draft in sync with loaded notification (and language)
  useEffect(() => {
    const ws = (notification as any)?.data?.worksheet;
    const persisted = ws && typeof ws === 'object' ? (ws as any).expectedAction : undefined;
    setExpectedActionDraft(String(persisted ?? contract?.expectedAction ?? ''));
  }, [notificationId, contract?.expectedAction, notification]);

  // Keep "What's Happening" field drafts in sync
  useEffect(() => {
    const ws = (notification as any)?.data?.worksheet;
    const persistedWhat = ws && typeof ws === 'object' ? (ws as any).description : undefined;
    const persistedWhy = ws && typeof ws === 'object' ? (ws as any).whyImportant : undefined;
    const persistedBlocked = ws && typeof ws === 'object' ? (ws as any).blocked : undefined;
    setDescriptionDraft(String(persistedWhat ?? contract?.what ?? notification?.message ?? ''));
    setWhyImportantDraft(String(persistedWhy ?? contract?.whyImportant ?? ''));
    setBlockedDraft(String(persistedBlocked ?? contract?.blocked ?? ''));
  }, [
    notificationId,
    contract?.what,
    contract?.whyImportant,
    contract?.blocked,
    notification?.message,
    notification,
  ]);

  // Initialize worksheet baseline snapshot once per notification (for Save/dirty + autosave).
  const worksheetBaselineRef = useRef<string | null>(null);
  useEffect(() => {
    if (!notification) return;
    if (worksheetBaselineRef.current === notificationId) return;

    const ws = (notification as any)?.data?.worksheet;
    const baseline = {
      description: String((ws as any)?.description ?? contract?.what ?? notification.message ?? ''),
      whyImportant: String((ws as any)?.whyImportant ?? contract?.whyImportant ?? ''),
      blocked: String((ws as any)?.blocked ?? contract?.blocked ?? ''),
      expectedAction: String((ws as any)?.expectedAction ?? contract?.expectedAction ?? ''),
    };

    try {
      const snap = JSON.stringify(baseline);
      setLastSavedWorksheetSnapshot(snap);
      setLastWorksheetSavedAt(new Date().toISOString());
      worksheetBaselineRef.current = notificationId;
    } catch {
      // ignore
    }
  }, [
    notificationId,
    notification,
    contract?.what,
    contract?.whyImportant,
    contract?.blocked,
    contract?.expectedAction,
  ]);

  // ── Auto-trigger AI context enrichment on load ────────────────────────────
  // Runs once per notification after data is loaded. Silently enriches all fields.
  const aiAutoTriggeredRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      !notification ||
      loading ||
      sourceEntityLoading ||
      isAnalyzingWorksheet ||
      aiAutoTriggeredRef.current === notificationId
    ) {
      return;
    }
    // Mark as triggered for this notification
    aiAutoTriggeredRef.current = notificationId;
    // Small delay to let rule-engine defaults render first
    const timer = setTimeout(() => {
      handleAnalyzeWithAI(true);
    }, 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notificationId, notification, loading, sourceEntityLoading]);

  const expectedActionValue = (
    expectedActionDraft ||
    contract?.expectedAction ||
    notification?.message ||
    ''
  ).trim();
  const canExpectedActionAI = Boolean(expectedActionValue);

  const checklistAiValue = useMemo(() => {
    const lines = actionChecklist
      .map((i) => String(i.text || '').trim())
      .filter(Boolean)
      .map((t) => `- ${t}`);
    if (lines.length > 0) return lines.join('\n');

    const seed = (
      expectedActionDraft ||
      contract?.expectedAction ||
      notification?.message ||
      ''
    ).trim();
    return seed ? `- ${seed}` : '';
  }, [actionChecklist, expectedActionDraft, contract?.expectedAction, notification?.message]);
  const canChecklistAI = Boolean(checklistAiValue.trim());

  // ── N-mode section definitions (MUST be before early returns — Rules of Hooks) ──

  const nModeSections: NModeSection[] = useMemo(() => {
    const typeUpper = (notification?.type || '').toUpperCase();
    const d = (notification?.data || {}) as Record<string, any>;
    const hasAIContext =
      typeUpper.includes('AI') ||
      Boolean(d.aiGenerated) ||
      Boolean(d.riskLevel || d.risk_level) ||
      Boolean(d.recommendation) ||
      Boolean(d.impact) ||
      Boolean(d.confidence) ||
      Boolean(d.savings_annual);

    const sections: NModeSection[] = [
      {
        id: 'whats-happening',
        icon: Info,
        label: { en: "What's Happening", pl: 'Co się dzieje' },
        component: null,
      },
      ...(hasAIContext
        ? [
            {
              id: 'ai-analysis',
              icon: Bot,
              label: { en: 'AI Analysis', pl: 'Analiza AI' },
              component: null,
            } as NModeSection,
          ]
        : []),
      {
        id: 'expected-action',
        icon: CheckSquare,
        label: { en: 'Expected Action', pl: 'Oczekiwana akcja' },
        badge: actionChecklist.filter((i) => i.completed).length,
        component: null,
      },
      // Supporting (optional) — keep light by default
      ...(commentsCount > 0
        ? [
            {
              id: 'comments',
              icon: MessageSquare,
              label: { en: 'Comments', pl: 'Komentarze' },
              badge: commentsCount,
              component: null,
            } as NModeSection,
          ]
        : []),
      ...(activityCount > 0
        ? [
            {
              id: 'activity-log',
              icon: History,
              label: { en: 'Activity Log', pl: 'Historia aktywności' },
              badge: activityCount,
              component: null,
            } as NModeSection,
          ]
        : []),
    ];

    return sections;
  }, [notification?.type, notification?.data, actionChecklist, commentsCount, activityCount]);

  // Ensure active section is always valid (e.g. AI section may be hidden)
  useEffect(() => {
    if (!nModeSections.some((s) => s.id === activeNSection)) {
      setActiveNSection(nModeSections[0]?.id || 'whats-happening');
    }
  }, [nModeSections, activeNSection]);

  // ── N-mode sections with content ─────────────────────────────────────────

  const nModeSectionsWithContent: NModeSection[] = useMemo(() => {
    // Guard: if notification/contract not yet loaded, return sections with null components
    if (!notification || !contract) return nModeSections;

    return nModeSections.map((section) => {
      let component: React.ReactNode = null;

      switch (section.id) {
        // ── 1. What's Happening (layout mirrors Task "Description & Scope") ──
        case 'whats-happening': {
          // Build "Related to" items from source entity + context
          const relatedNotifItems: { id: string; type: string; title: string }[] = [];
          if (sourceEntity && sourceEntity.title) {
            relatedNotifItems.push({
              id: sourceEntity.id || notification.relatedObjectId || '',
              type: isPolish
                ? sourceEntity.type === 'task'
                  ? 'Zadanie'
                  : sourceEntity.type === 'decision'
                    ? 'Decyzja'
                    : sourceEntity.type || 'Źródło'
                : sourceEntity.type || 'Source',
              title: String(sourceEntity.title),
            });
          } else if (notification.relatedObjectType && notification.relatedObjectId) {
            relatedNotifItems.push({
              id: notification.relatedObjectId,
              type: notification.relatedObjectType,
              title: notification.relatedObjectId,
            });
          }
          if (notification.projectName && notification.projectId) {
            relatedNotifItems.push({
              id: notification.projectId,
              type: isPolish ? 'Projekt' : 'Project',
              title: notification.projectName,
            });
          }
          // Context line → merge into Related To as extra item
          if (contract.contextLine) {
            relatedNotifItems.push({
              id: '_ctx',
              type: isPolish ? 'Kontekst' : 'Context',
              title: contract.contextLine,
            });
          }

          // Determine creator: AI / System / User
          const typeUpper = (notification.type || '').toUpperCase();
          const category = notification.category;
          const isAICreated =
            typeUpper.startsWith('AI_') ||
            category === 'ai' ||
            Boolean(notification.data?.aiGenerated);
          const isSystemCreated =
            !isAICreated &&
            (category === 'system' ||
              category === 'billing' ||
              category === 'dbr77' ||
              typeUpper === 'SYSTEM_ALERT' ||
              typeUpper.startsWith('BILLING_') ||
              typeUpper.startsWith('DBR77_') ||
              typeUpper.startsWith('PAYMENT_') ||
              typeUpper.startsWith('USAGE_') ||
              typeUpper.startsWith('SUBSCRIPTION_') ||
              typeUpper.startsWith('INVOICE_'));
          const creatorLabel = isAICreated
            ? 'AI'
            : isSystemCreated
              ? 'System'
              : notification.data?.createdByName || (isPolish ? 'Użytkownik' : 'User');
          const CreatorIcon = isAICreated ? Bot : isSystemCreated ? Monitor : Users;
          const creatorColor = isAICreated
            ? 'text-primary-500 bg-primary-500/10 border-primary-400/40'
            : isSystemCreated
              ? 'text-slate-500 bg-slate-500/10 border-slate-400/40'
              : 'text-blue-500 bg-blue-500/10 border-blue-400/40';

          // Severity border color for left accent
          const severityBorderAccent =
            notification.severity === 'CRITICAL'
              ? 'border-l-danger-500'
              : notification.severity === 'WARNING'
                ? 'border-l-amber-500'
                : 'border-l-blue-400';

          component = (
            <div className={`space-y-5 border-l-[3px] ${severityBorderAccent} pl-4`}>
              {/* Section header: title + severity + creator badges */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                    {isPolish ? 'Co się dzieje' : "What's Happening"}
                  </h2>
                  {isAnalyzingWorksheet && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-primary-500 dark:text-primary-400 animate-pulse">
                      <Loader2 size={12} className="animate-spin" />
                      {isPolish ? 'AI analizuje...' : 'AI analyzing...'}
                    </span>
                  )}
                </div>
                {/* Badge row: severity + creator */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${severityConfig.bgColor} ${severityConfig.textColor}`}
                  >
                    <SeverityIcon size={10} />
                    {isPolish ? severityConfig.label.pl : severityConfig.label.en}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${creatorColor}`}
                  >
                    <CreatorIcon size={11} />
                    {creatorLabel}
                  </span>
                </div>
              </div>

              {/* 1) Related to — source entity, project, context (clickable) */}
              <div className="space-y-2">
                <label className="text-[11px] uppercase tracking-wide text-slate-600 dark:text-slate-500">
                  {isPolish ? 'Wynika z' : 'Related to'}
                </label>
                {relatedNotifItems.length === 0 ? (
                  <div className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border border-amber-400/60 text-amber-600 dark:text-amber-300 bg-amber-500/10">
                    {isPolish
                      ? 'Brak powiązania — powiadomienie systemowe'
                      : 'No linked source — system notification'}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {relatedNotifItems.map((item) => {
                      const isClickable = item.id !== '_ctx' && onNavigateToSource;
                      const itemType = item.type.toLowerCase();
                      return (
                        <div
                          key={item.id}
                          className={`group flex items-center justify-between gap-3 text-sm text-slate-700 dark:text-slate-300 rounded-md px-1 py-0.5 -mx-1 transition-colors ${
                            isClickable ? 'hover:bg-primary-500/5 cursor-pointer' : ''
                          }`}
                          onClick={
                            isClickable ? () => onNavigateToSource!(itemType, item.id) : undefined
                          }
                          role={isClickable ? 'button' : undefined}
                          tabIndex={isClickable ? 0 : undefined}
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium border border-primary-400/50 text-primary-600 dark:text-primary-300 bg-primary-500/10 uppercase">
                              {item.type}
                            </span>
                            <span
                              className={`truncate ${isClickable ? 'group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors' : ''}`}
                            >
                              {item.title}
                            </span>
                          </div>
                          {item.id !== '_ctx' && (
                            <button
                              className="shrink-0 inline-flex items-center gap-1 text-[11px] font-mono text-slate-500/70 dark:text-slate-500/70 hover:text-primary-500 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(item.id);
                                toast.success(isPolish ? 'Skopiowano ID' : 'ID copied');
                              }}
                              title={isPolish ? 'Kopiuj ID' : 'Copy ID'}
                            >
                              {String(item.id).length > 24
                                ? `${String(item.id).slice(0, 24)}...`
                                : item.id}
                              <Copy
                                size={10}
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                              />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 2) Description — click-to-edit with AI enhancer */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] uppercase tracking-wide text-slate-600 dark:text-slate-500">
                    {isPolish ? 'Opis' : 'Description'}
                  </label>
                  <AIFieldEnhancer
                    fieldKey="notif-description"
                    sectionLabel={isPolish ? 'Opis' : 'Description'}
                    currentValue={descriptionDraft}
                    onApply={setDescriptionDraft}
                    artifactContext={{
                      title: notification.title,
                      status: notification.isRead ? 'read' : 'unread',
                      priority: notification.severity || '',
                      type: 'notification',
                    }}
                    iconOnly
                  />
                </div>
                <textarea
                  value={descriptionDraft}
                  onChange={(e) => setDescriptionDraft(e.target.value)}
                  rows={3}
                  className="w-full px-0 py-2 bg-transparent text-sm leading-relaxed text-slate-700 dark:text-slate-300 focus:outline-none placeholder-slate-400 dark:placeholder-slate-600 resize-y border-b border-slate-200 dark:border-navy-700/40 focus:border-primary-400 transition-colors min-h-[48px]"
                  placeholder={
                    isPolish
                      ? 'Opis powiadomienia — co się wydarzyło...'
                      : 'What happened — describe the notification event...'
                  }
                />
              </div>

              {/* 3) Why it matters — with AI enhancer */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] uppercase tracking-wide text-slate-600 dark:text-slate-500">
                    {isPolish ? 'Dlaczego to ważne' : 'Why it matters'}
                  </label>
                  <AIFieldEnhancer
                    fieldKey="notif-why-important"
                    sectionLabel={isPolish ? 'Dlaczego to ważne' : 'Why It Matters'}
                    currentValue={whyImportantDraft}
                    onApply={setWhyImportantDraft}
                    artifactContext={{
                      title: notification.title,
                      status: notification.isRead ? 'read' : 'unread',
                      priority: notification.severity || '',
                      type: 'notification',
                    }}
                    iconOnly
                  />
                </div>
                <textarea
                  value={whyImportantDraft}
                  onChange={(e) => setWhyImportantDraft(e.target.value)}
                  rows={2}
                  className="w-full px-0 py-2 bg-transparent text-sm leading-relaxed text-slate-700 dark:text-slate-300 focus:outline-none placeholder-slate-400 dark:placeholder-slate-600 resize-y border-b border-slate-200 dark:border-navy-700/40 focus:border-primary-400 transition-colors min-h-[36px]"
                  placeholder={
                    isPolish
                      ? 'Wyjaśnij wpływ i konsekwencje...'
                      : 'Explain the impact and consequences...'
                  }
                />
              </div>

              {/* 4) What is blocked — compact */}
              {blockedDraft.trim() && (
                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-wide text-slate-600 dark:text-slate-500">
                    {isPolish ? 'Co jest blokowane' : 'What is blocked'}
                  </label>
                  <textarea
                    value={blockedDraft}
                    onChange={(e) => setBlockedDraft(e.target.value)}
                    rows={2}
                    className="w-full px-0 py-2 bg-transparent text-sm leading-relaxed text-slate-700 dark:text-slate-300 focus:outline-none placeholder-slate-400 dark:placeholder-slate-600 resize-y border-b border-slate-200 dark:border-navy-700/40 focus:border-primary-400 transition-colors min-h-[36px]"
                    placeholder={
                      isPolish
                        ? 'Co jest blokowane przez ten problem...'
                        : 'What is blocked by this issue...'
                    }
                  />
                </div>
              )}

              {/* 5) Why You Got It — subtle info line */}
              {(contract.whyYouGotIt || notification.data?.whyYouGotIt) && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50/50 dark:bg-amber-500/5 border border-amber-200/40 dark:border-amber-500/20">
                  <Info size={13} className="text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                    {contract.whyYouGotIt || String(notification.data?.whyYouGotIt || '')}
                  </p>
                </div>
              )}
            </div>
          );
          break;
        }

        // ── 2. AI Analysis ────────────────────────────────────────────────
        case 'ai-analysis': {
          component = (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                  {isPolish ? 'Analiza AI' : 'AI Analysis'}
                </h2>
                <button
                  onClick={handleAskAI}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary-500 dark:text-primary-400 hover:bg-primary-500/10 transition-colors"
                >
                  <Sparkles size={13} />
                  {isPolish ? 'Zapytaj AI' : 'Ask AI'}
                </button>
              </div>

              {aiAnalysis && (
                <>
                  {/* Priority & confidence badges */}
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        aiAnalysis.riskLevel === 'critical'
                          ? 'bg-danger-500/10 text-danger-500'
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
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-primary-500/10 text-primary-500">
                        {isPolish ? 'Pewność' : 'Confidence'}: {aiAnalysis.confidence}
                      </span>
                    )}
                    {aiAnalysis.aiGenerated && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-500">
                        AI Generated
                      </span>
                    )}
                  </div>

                  {/* Impact */}
                  <div className="space-y-2">
                    <label className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-500">
                      {isPolish ? 'Wpływ' : 'Impact'}
                    </label>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                      {aiAnalysis.impact}
                    </p>
                  </div>

                  {/* Recommendation callout */}
                  <div className="space-y-2">
                    <label className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-500">
                      {isPolish ? 'Rekomendacja' : 'Recommendation'}
                    </label>
                    <div className="p-3 rounded-xl bg-primary-50/50 dark:bg-primary-500/10 border border-primary-200/40 dark:border-primary-500/20">
                      <div className="flex items-start gap-2">
                        <Zap size={14} className="text-primary-500 mt-0.5 shrink-0" />
                        <p className="text-sm text-primary-700 dark:text-primary-300 leading-relaxed">
                          {aiAnalysis.recommendation}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* AI chat CTA */}
                  <button
                    onClick={handleAskAI}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-500/10 text-primary-600 dark:text-primary-400 hover:bg-primary-500/20 transition-colors text-sm font-medium"
                  >
                    <MessageSquare size={14} />
                    {isPolish ? 'Zapytaj AI o więcej szczegółów' : 'Ask AI for more details'}
                  </button>
                </>
              )}

              {!aiAnalysis && (
                <div className="py-10 text-center">
                  <TeresaMark
                    size={28}
                    className="mx-auto mb-2 text-slate-600 dark:text-slate-400"
                  />
                  <p className="text-sm text-slate-600 dark:text-slate-500">
                    {isPolish ? 'Brak danych do analizy' : 'No data for analysis'}
                  </p>
                </div>
              )}
            </div>
          );
          break;
        }

        // ── 3. Expected Action / Checklist ────────────────────────────────
        case 'expected-action': {
          const completedCount = actionChecklist.filter((c) => c.completed).length;
          const totalCount = actionChecklist.length;

          component = (
            <div className="space-y-6">
              {/* Section title */}
              <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                {isPolish ? 'Oczekiwana akcja' : 'Expected Action'}
              </h2>

              {/* Expected action text — label + AI right-aligned */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] uppercase tracking-wide text-slate-600 dark:text-slate-500">
                    {isPolish ? 'Co należy zrobić' : 'What needs to be done'}
                  </label>
                  <AIFieldEnhancer
                    fieldKey="notification-expected-action"
                    sectionLabel="Expected Action"
                    currentValue={expectedActionValue || ' '}
                    onApply={setExpectedActionDraft}
                    artifactContext={{
                      title: notification.title,
                      status: notification.isRead ? 'read' : 'unread',
                      priority: aiAnalysis?.priority || 'medium',
                      type: 'notification',
                    }}
                    iconOnly
                    disabled={!canExpectedActionAI}
                  />
                </div>
                <textarea
                  value={expectedActionDraft}
                  onChange={(e) => setExpectedActionDraft(e.target.value)}
                  rows={2}
                  className="w-full px-0 py-2 bg-transparent text-sm leading-relaxed text-slate-700 dark:text-slate-300 focus:outline-none placeholder-slate-400 dark:placeholder-slate-600 resize-y border-b border-slate-200 dark:border-navy-700/40 focus:border-primary-400 transition-colors min-h-[36px]"
                  placeholder={isPolish ? 'Oczekiwana akcja...' : 'Expected action...'}
                />
              </div>

              {/* Checklist — label + AI right-aligned, count below */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] uppercase tracking-wide text-slate-600 dark:text-slate-500">
                    {isPolish ? 'Lista kontrolna' : 'Checklist'}
                  </label>
                  <AIFieldEnhancer
                    fieldKey="notification-checklist"
                    sectionLabel="Checklist"
                    currentValue={checklistAiValue || ' '}
                    onApply={applyChecklistFromAIText}
                    artifactContext={{
                      title: notification.title,
                      status: notification.isRead ? 'read' : 'unread',
                      priority: aiAnalysis?.priority || 'medium',
                      type: 'notification',
                    }}
                    iconOnly
                    disabled={!canChecklistAI}
                  />
                </div>

                {/* Progress bar */}
                {totalCount > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-slate-200/60 dark:bg-navy-700/50 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                        style={{
                          width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <span className="text-[11px] font-medium text-slate-600 dark:text-slate-500 tabular-nums shrink-0">
                      {completedCount}/{totalCount}
                    </span>
                  </div>
                )}

                {/* Checklist items — urgency-aware */}
                {totalCount === 0 ? (
                  <div className="py-8 text-center">
                    <CheckSquare
                      size={24}
                      className="mx-auto mb-2 text-slate-600 dark:text-slate-400"
                    />
                    <p className="text-xs text-slate-600 dark:text-slate-500">
                      {isPolish
                        ? 'Brak kroków — kliknij AI, aby wygenerować checklistę'
                        : 'No steps — click AI to generate a checklist'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {actionChecklist.map((item, idx) => {
                      const done = item.completed;
                      const urgency = item.urgency || 'normal';
                      // Urgency-based left accent
                      const urgencyBorder =
                        urgency === 'critical'
                          ? 'border-l-2 border-l-danger-400/70'
                          : urgency === 'optional'
                            ? 'border-l-2 border-l-slate-200/50 dark:border-l-navy-700/50'
                            : '';
                      const urgencyText =
                        urgency === 'critical' && !done
                          ? 'text-danger-600 dark:text-danger-400 font-medium'
                          : urgency === 'optional' && !done
                            ? 'text-slate-500 dark:text-slate-400'
                            : done
                              ? 'line-through text-slate-600 dark:text-slate-500'
                              : 'text-slate-700 dark:text-slate-300';

                      return (
                        <div
                          key={item.id}
                          className={`group flex items-start gap-3 px-3 py-2 rounded-lg transition-all duration-200 ${urgencyBorder} ${
                            done
                              ? 'opacity-50 hover:opacity-70'
                              : 'hover:bg-slate-50/60 dark:hover:bg-navy-800/40'
                          }`}
                        >
                          <button
                            onClick={() => toggleChecklistItem(item.id)}
                            className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200 ${
                              done
                                ? 'bg-emerald-500 border-emerald-500 text-white'
                                : urgency === 'critical'
                                  ? 'border-danger-300 dark:border-danger-500/50 hover:border-danger-400'
                                  : 'border-slate-300 dark:border-navy-600 hover:border-emerald-400 dark:hover:border-emerald-500'
                            }`}
                          >
                            {done && (
                              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                <path
                                  d="M2.5 6L5 8.5L9.5 3.5"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            )}
                          </button>
                          <span
                            className={`text-[11px] font-medium mt-0.5 mr-0.5 tabular-nums select-none ${done ? 'text-slate-600 dark:text-slate-400' : 'text-slate-600 dark:text-slate-500'}`}
                          >
                            {idx + 1}.
                          </span>
                          <span className={`flex-1 text-sm leading-snug ${urgencyText}`}>
                            {item.text}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
          break;
        }

        // ── 4. Comments (real CRUD) ──────────────────────────────────────
        case 'comments': {
          component = (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                  {isPolish ? 'Komentarze' : 'Comments'}
                  {comments.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">
                      ({comments.length})
                    </span>
                  )}
                </h2>
                <button
                  onClick={handleAskAI}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary-500 dark:text-primary-400 hover:bg-primary-500/10 transition-colors"
                >
                  <Sparkles size={13} />
                  {isPolish ? 'AI komentarz' : 'AI comment'}
                </button>
              </div>

              {/* Comment input */}
              <div className="space-y-2">
                <textarea
                  ref={commentInputRef}
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleAddComment();
                    }
                  }}
                  placeholder={
                    isPolish
                      ? 'Napisz komentarz... (Cmd+Enter aby wysłać)'
                      : 'Write a comment... (Cmd+Enter to send)'
                  }
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-navy-700/60 bg-white/70 dark:bg-navy-900/70 text-sm text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 dark:focus:border-primary-500 transition-all"
                  rows={3}
                />
                <div className="flex justify-end">
                  <button
                    onClick={handleAddComment}
                    disabled={!newCommentText.trim() || submittingComment}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {submittingComment ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <MessageSquare size={12} />
                    )}
                    {isPolish ? 'Dodaj' : 'Add'}
                  </button>
                </div>
              </div>

              {/* Comments list */}
              {commentsLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 size={20} className="animate-spin text-slate-600" />
                </div>
              ) : comments.length === 0 ? (
                <div className="py-10 text-center">
                  <MessageCircle
                    size={28}
                    className="mx-auto mb-2 text-slate-600 dark:text-slate-400"
                  />
                  <p className="text-sm text-slate-600 dark:text-slate-500 mb-4">
                    {isPolish ? 'Brak komentarzy' : 'No comments yet'}
                  </p>
                  <button
                    onClick={handleOpenChat}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-primary-300 dark:border-primary-500/30 text-primary-600 dark:text-primary-400 hover:border-primary-400 dark:hover:border-primary-400/50 hover:bg-primary-50/50 dark:hover:bg-primary-500/5 transition-colors text-sm font-medium"
                  >
                    <MessageSquare size={14} />
                    {isPolish ? 'Otwórz czat z kontekstem' : 'Open contextual chat'}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {comments.map((comment) => (
                    <div
                      key={comment.id}
                      className="group px-4 py-3 rounded-xl border border-slate-200 dark:border-navy-700/40 hover:border-slate-300/60 dark:hover:border-navy-600/60 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        {/* Avatar */}
                        <div className="w-7 h-7 rounded-full bg-primary-500/20 text-primary-600 dark:text-primary-400 flex items-center justify-center text-xs font-bold shrink-0">
                          {(comment.user?.firstName || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          {/* Header row */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                                {comment.user?.firstName} {comment.user?.lastName}
                              </span>
                              <span className="text-[10px] text-slate-600 dark:text-slate-500">
                                {formatDate(comment.createdAt)}
                              </span>
                            </div>
                            <button
                              onClick={() => handleDeleteComment(comment.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-danger-50 dark:hover:bg-danger-500/10 transition-all"
                              title={isPolish ? 'Usuń' : 'Delete'}
                            >
                              <Trash2 size={12} className="text-danger-400" />
                            </button>
                          </div>
                          {/* Body */}
                          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mt-1 whitespace-pre-wrap">
                            {comment.content}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
          break;
        }

        // ── 6. Activity Log (real data + fallback) ────────────────────────
        case 'activity-log': {
          // Build merged entries: real API entries + fallback local entries
          const actionIcons: Record<string, { icon: React.ReactNode; bg: string }> = {
            marked_read: {
              icon: <MailOpen size={14} className="text-emerald-500" />,
              bg: 'bg-emerald-100 dark:bg-emerald-500/20',
            },
            snoozed: {
              icon: <Clock size={14} className="text-amber-500" />,
              bg: 'bg-amber-100 dark:bg-amber-500/20',
            },
            comment_added: {
              icon: <MessageSquare size={14} className="text-blue-500" />,
              bg: 'bg-blue-100 dark:bg-blue-500/20',
            },
            comment_deleted: {
              icon: <Trash2 size={14} className="text-danger-400" />,
              bg: 'bg-danger-100 dark:bg-danger-500/20',
            },
          };
          const defaultIcon = {
            icon: <Bell size={14} className="text-slate-600" />,
            bg: 'bg-slate-100 dark:bg-navy-800',
          };

          const realEntries = activityLog.map((entry) => {
            const iconConfig = actionIcons[entry.action] || defaultIcon;
            return {
              id: entry.id,
              description: entry.userName
                ? `${entry.userName}: ${entry.description}`
                : entry.description,
              timestamp: entry.createdAt,
              icon: iconConfig.icon,
              iconBg: iconConfig.bg,
            };
          });

          // If no real API entries yet, show fallback local data
          const fallbackEntries: typeof realEntries = [];
          if (realEntries.length === 0 && !activityLogLoading) {
            fallbackEntries.push({
              id: 'created',
              description: isPolish ? 'Powiadomienie utworzone' : 'Notification created',
              timestamp: notification.createdAt,
              icon: <Bell size={14} className="text-slate-600" />,
              iconBg: 'bg-slate-100 dark:bg-navy-800',
            });
            if (notification.readAt) {
              fallbackEntries.push({
                id: 'read',
                description: isPolish ? 'Oznaczono jako przeczytane' : 'Marked as read',
                timestamp: notification.readAt,
                icon: <MailOpen size={14} className="text-emerald-500" />,
                iconBg: 'bg-emerald-100 dark:bg-emerald-500/20',
              });
            }
            const completedItems = actionChecklist.filter((i) => i.completed);
            if (completedItems.length > 0) {
              fallbackEntries.push({
                id: 'checklist-progress',
                description: isPolish
                  ? `Ukończono ${completedItems.length}/${actionChecklist.length} kroków`
                  : `Completed ${completedItems.length}/${actionChecklist.length} steps`,
                timestamp: new Date().toISOString(),
                icon: <CheckSquare size={14} className="text-emerald-500" />,
                iconBg: 'bg-emerald-100 dark:bg-emerald-500/20',
              });
            }
          }

          const allEntries = realEntries.length > 0 ? realEntries : fallbackEntries;

          component = (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                  {isPolish ? 'Historia aktywności' : 'Activity Log'}
                  {allEntries.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">
                      ({allEntries.length})
                    </span>
                  )}
                </h2>
                <button
                  onClick={loadActivityLog}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                >
                  <History size={13} />
                  {isPolish ? 'Odśwież' : 'Refresh'}
                </button>
              </div>

              {/* Stat cards — compact */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-slate-200 dark:border-navy-700/60 bg-white/70 dark:bg-navy-900/70 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-500">
                    {isPolish ? 'Wpisy' : 'Entries'}
                  </p>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {allEntries.length}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-navy-700/60 bg-white/70 dark:bg-navy-900/70 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-500">
                    {isPolish ? 'Komentarze' : 'Comments'}
                  </p>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {comments.length}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-navy-700/60 bg-white/70 dark:bg-navy-900/70 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-500">
                    {isPolish ? 'Status' : 'Status'}
                  </p>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {isSnoozed
                      ? isPolish
                        ? 'Odłożone'
                        : 'Snoozed'
                      : notification.isRead
                        ? isPolish
                          ? 'Przeczytane'
                          : 'Read'
                        : isPolish
                          ? 'Nowe'
                          : 'New'}
                  </p>
                </div>
              </div>

              {/* Activity feed */}
              {activityLogLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 size={20} className="animate-spin text-slate-600" />
                </div>
              ) : allEntries.length === 0 ? (
                <div className="py-10 text-center">
                  <History size={28} className="mx-auto mb-2 text-slate-600 dark:text-slate-400" />
                  <p className="text-sm text-slate-600 dark:text-slate-500">
                    {isPolish ? 'Brak aktywności' : 'No activity yet'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {allEntries.map((entry) => (
                    <div key={entry.id} className="flex items-start gap-3">
                      <div
                        className={`w-8 h-8 rounded-full ${entry.iconBg} flex items-center justify-center shrink-0`}
                      >
                        {entry.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-700 dark:text-slate-300">
                          {entry.description}
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-500">
                          {formatDate(entry.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
          break;
        }
      }

      return { ...section, component };
    });
  }, [
    nModeSections,
    isPolish,
    notification,
    contract,
    aiAnalysis,
    severityConfig,
    typeConfig,
    actionChecklist,
    expectedActionDraft,
    expectedActionValue,
    canExpectedActionAI,
    checklistAiValue,
    canChecklistAI,
    applyChecklistFromAIText,
    sourceEntity,
    sourceEntityLoading,
    comments,
    commentsLoading,
    newCommentText,
    submittingComment,
    activityLog,
    activityLogLoading,
    isSnoozed,
  ]);

  // ── Loading / 404 guards (AFTER all hooks to respect Rules of Hooks) ────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-white dark:bg-navy-950">
        <LoadingState variant="spinner" />
      </div>
    );
  }

  if (!notification || !contract) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 dark:text-slate-400 bg-white dark:bg-navy-950">
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

  // ── N-mode properties strip fields (after guards — notification is guaranteed) ──

  const propertiesFields: NModePropertyField[] = [
    {
      id: 'type',
      label: { en: 'Type', pl: 'Typ' },
      type: 'custom' as const,
      value: notification.type,
      onChange: () => {},
      readOnly: true,
      render: () => (
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600/60 text-slate-700 dark:text-slate-200">
          <TypeIcon size={12} className={typeConfig.color} />
          <span className="truncate">{notification.type.replace(/_/g, ' ')}</span>
        </div>
      ),
    },
    {
      id: 'severity',
      label: { en: 'Severity', pl: 'Priorytet' },
      type: 'custom' as const,
      value: notification.severity,
      onChange: () => {},
      readOnly: true,
      render: () => (
        <div
          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium ${severityConfig.bgColor} border ${severityConfig.borderColor}`}
        >
          <div className={`w-2 h-2 rounded-full ${severityConfig.color}`} />
          <span className={severityConfig.textColor}>
            {isPolish ? severityConfig.label.pl : severityConfig.label.en}
          </span>
        </div>
      ),
    },
    {
      id: 'category',
      label: { en: 'Category', pl: 'Kategoria' },
      type: 'text' as const,
      value: notification.category,
      onChange: () => {},
      readOnly: true,
    },
    {
      id: 'project',
      label: { en: 'Project', pl: 'Projekt' },
      type: 'text' as const,
      value: notification.projectName || (notification.data as any)?.projectName || '—',
      onChange: () => {},
      readOnly: true,
    },
    {
      id: 'created',
      label: { en: 'Created', pl: 'Utworzono' },
      type: 'text' as const,
      value: formatDate(notification.createdAt),
      onChange: () => {},
      readOnly: true,
    },
    {
      id: 'status',
      label: { en: 'Status', pl: 'Status' },
      type: 'custom' as const,
      value: isSnoozed ? 'snoozed' : notification.isRead ? 'read' : 'unread',
      onChange: () => {},
      readOnly: true,
      render: () => (
        <div
          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium border ${
            isSnoozed
              ? 'bg-amber-500/10 border-amber-400/30 text-amber-600 dark:text-amber-400'
              : notification.isRead
                ? 'bg-emerald-500/10 border-emerald-400/30 text-emerald-600 dark:text-emerald-400'
                : 'bg-blue-500/10 border-blue-400/30 text-blue-600 dark:text-blue-400'
          }`}
        >
          {isSnoozed ? (
            <Clock size={12} />
          ) : notification.isRead ? (
            <MailOpen size={12} />
          ) : (
            <Bell size={12} />
          )}
          {isSnoozed
            ? isPolish
              ? 'Odłożone'
              : 'Snoozed'
            : notification.isRead
              ? isPolish
                ? 'Przeczytane'
                : 'Read'
              : isPolish
                ? 'Nowe'
                : 'Unread'}
        </div>
      ),
    },
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  // ── RENDER ──────────────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-navy-950 dark:via-navy-900 dark:to-navy-950">
      <div className="p-6">
        <div className="max-w-6xl mx-auto space-y-0">
          {/* ── Header — shared NModeHeader ─────────────────────────────── */}
          <NModeHeader
            title={notification.title || (isPolish ? 'Powiadomienie' : 'Notification')}
            onTitleChange={() => {}}
            titleReadOnly={true}
            artifactId={notificationId}
            artifactType="notification"
            onSave={handleSaveWorksheet}
            saving={worksheetSaving}
            isDirty={worksheetIsDirty}
            draftSavedLabel={
              lastWorksheetSavedAt
                ? isPolish
                  ? `Zapisano ${new Date(lastWorksheetSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  : `Saved ${new Date(lastWorksheetSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : undefined
            }
            onChat={handleOpenChat}
            onClose={onClose}
            statusDotColor={severityConfig.dotColor}
            presentationMode={presentationMode}
            onPresentationModeChange={setPresentationMode}
          />

          {/* ═══════════ N MODE ═══════════════════════════════════════════
               Layout: PropertiesStrip → ActionBar → 2-Pane (LeftNav + Canvas)
               ═══════════════════════════════════════════════════════════════ */}
          {presentationMode === 'n' && (
            <div className="col-span-full space-y-4 mt-4">
              {/* ── PropertiesStrip ─────────────────────────────────────── */}
              <NModePropertiesStrip fields={propertiesFields} maxColumns={6} />

              {/* ── ActionBar ──────────────────────────────────────────── */}
              <div className="px-4 py-3 rounded-2xl bg-white/80 dark:bg-navy-900/80 backdrop-blur-xl border border-slate-200 dark:border-navy-700/60">
                <div className="flex items-center gap-2">
                  {/* Primary CTA */}
                  {contract.primaryCta.kind === 'open_task' && (
                    <button
                      onClick={() => onNavigateToSource?.('task', (contract.primaryCta as any).id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-blue-400/50 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 transition-colors"
                    >
                      <CheckSquare size={13} />
                      {contract.primaryCta.label}
                    </button>
                  )}
                  {contract.primaryCta.kind === 'open_decision' && (
                    <button
                      onClick={() =>
                        onNavigateToSource?.('decision', (contract.primaryCta as any).id)
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-primary-400/50 text-primary-600 dark:text-primary-400 hover:bg-primary-500/10 transition-colors"
                    >
                      <Scale size={13} />
                      {contract.primaryCta.label}
                    </button>
                  )}
                  {contract.primaryCta.kind === 'open_project' && (
                    <button
                      onClick={() =>
                        onNavigateToSource?.('project', (contract.primaryCta as any).id)
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-indigo-400/50 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                    >
                      <FolderOpen size={13} />
                      {contract.primaryCta.label}
                    </button>
                  )}
                  {contract.primaryCta.kind === 'open_link' && (
                    <a
                      href={(contract.primaryCta as any).href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-primary-400/50 text-primary-600 dark:text-primary-400 hover:bg-primary-500/10 transition-colors"
                    >
                      <ExternalLink size={13} />
                      {contract.primaryCta.label}
                    </a>
                  )}

                  {/* Mark Read */}
                  <button
                    onClick={handleMarkRead}
                    disabled={notification.isRead}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-emerald-400/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <MailOpen size={13} />
                    {isPolish ? 'Przeczytane' : 'Mark Read'}
                  </button>

                  {/* Save as note */}
                  <button
                    onClick={handleSaveAsNote}
                    disabled={savingAsNote}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300/60 dark:border-navy-600/60 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {savingAsNote ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <FileText size={13} />
                    )}
                    {isPolish ? 'Zapisz jako notatkę' : 'Save as note'}
                  </button>

                  {/* Snooze */}
                  <div className="relative" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setShowSnoozeMenu(!showSnoozeMenu)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        isSnoozed
                          ? 'border-amber-400/50 text-amber-600 dark:text-amber-400 bg-amber-500/10'
                          : 'border-amber-300/50 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10'
                      }`}
                    >
                      <Clock size={13} />
                      {isSnoozed
                        ? isPolish
                          ? 'Odłożone'
                          : 'Snoozed'
                        : isPolish
                          ? 'Odłóż'
                          : 'Snooze'}
                    </button>

                    {/* Snooze dropdown */}
                    {showSnoozeMenu && (
                      <div className="absolute top-full left-0 mt-1 w-48 rounded-xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700/60 shadow-xl z-50 py-1">
                        {[
                          { preset: '1h', label: isPolish ? '1 godzinę' : '1 hour' },
                          { preset: '4h', label: isPolish ? '4 godziny' : '4 hours' },
                          { preset: '1d', label: isPolish ? '1 dzień' : '1 day' },
                          { preset: '3d', label: isPolish ? '3 dni' : '3 days' },
                        ].map((option) => (
                          <button
                            key={option.preset}
                            onClick={() => handleSnooze(option.preset)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
                          >
                            <Clock size={12} className="text-amber-500 shrink-0" />
                            {option.label}
                          </button>
                        ))}
                        {isSnoozed && snoozedUntil && (
                          <div className="px-3 py-2 border-t border-slate-200 dark:border-navy-700/40">
                            <p className="text-[10px] text-slate-600 dark:text-slate-500">
                              {isPolish ? 'Odłożono do' : 'Snoozed until'}:{' '}
                              {new Date(snoozedUntil).toLocaleString(isPolish ? 'pl-PL' : 'en-US')}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Mute (dropdown) */}
                  <div className="relative" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setShowMuteMenu(!showMuteMenu)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300/60 dark:border-navy-600/60 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                    >
                      <BellOff size={13} />
                      {isPolish ? 'Wycisz' : 'Mute'}
                      <ChevronDown size={13} className="opacity-70" />
                    </button>

                    {showMuteMenu && (
                      <div className="absolute top-full left-0 mt-1 w-52 rounded-xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700/60 shadow-xl z-50 py-1">
                        <button
                          onClick={() => {
                            setShowMuteMenu(false);
                            handleMuteThis();
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
                        >
                          <BellOff size={12} className="text-slate-600 shrink-0" />
                          {isPolish ? 'Wycisz to' : 'Mute this'}
                        </button>
                        <button
                          onClick={() => {
                            setShowMuteMenu(false);
                            handleMuteSimilar();
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
                        >
                          <BellOff size={12} className="text-slate-600 shrink-0" />
                          {isPolish ? 'Wycisz podobne (typ)' : 'Mute similar (type)'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Delete */}
                  <button
                    onClick={handleDelete}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-danger-400/50 text-danger-600 dark:text-danger-400 hover:bg-danger-500/10 transition-colors"
                  >
                    <Trash2 size={13} />
                    {isPolish ? 'Usuń' : 'Delete'}
                  </button>

                  {/* Section-specific AI actions */}
                  {(activeNSection === 'ai-analysis' ||
                    activeNSection === 'whats-happening' ||
                    activeNSection === 'expected-action') && (
                    <button
                      onClick={() => handleAnalyzeWithAI(false)}
                      disabled={isAnalyzingWorksheet}
                      className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-primary-400/50 text-primary-600 dark:text-primary-300 bg-primary-500/10 hover:bg-primary-500/15 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isAnalyzingWorksheet ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Sparkles size={13} />
                      )}
                      {isPolish ? 'Analizuj z AI' : 'Analyze with AI'}
                    </button>
                  )}
                </div>
              </div>

              {/* ── 2-Pane: LeftNav + Canvas ───────────────────────────── */}
              <div className="flex gap-0 min-h-[60vh]">
                <NModeLeftNav
                  sections={nModeSectionsWithContent}
                  activeSection={activeNSection}
                  onSectionChange={setActiveNSection}
                />
                <NModeCanvas
                  sections={nModeSectionsWithContent}
                  activeSection={activeNSection}
                  reducedMotion={reducedMotion}
                  motionDuration={motionDuration}
                />
              </div>
            </div>
          )}

          {/* ═══════════ C MODE (legacy accordion / D-style) ═══════════════
               Preserved for backward compatibility — full accordion layout.
               ═══════════════════════════════════════════════════════════════ */}
          {presentationMode === 'c' && import.meta.env.VITE_ENABLE_LEGACY_C_MODE === 'true' && (
            <div className="mt-6">
              <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - 2/3 width */}
                <div className="lg:col-span-2 space-y-4 order-2 lg:order-1">
                  {/* What's Happening */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 overflow-hidden"
                  >
                    <button
                      onClick={() => toggleSection('whats-happening')}
                      className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-500/10 dark:from-blue-500/20 dark:to-blue-500/20">
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
                          <ChevronDown size={18} className="text-slate-600" />
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
                              <div className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-500 mb-1">
                                {isPolish ? 'Dlaczego to ważne' : 'Why it matters'}
                              </div>
                              <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                                {contract.whyImportant}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-500 mb-1">
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
                    className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 overflow-hidden"
                  >
                    <button
                      onClick={() => toggleSection('ai-analysis')}
                      className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-primary-500/10 to-crimson-500/10 dark:from-primary-500/20 dark:to-crimson-500/20">
                          <TeresaMark
                            size={18}
                            className="text-primary-500 dark:text-primary-400"
                          />
                        </div>
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                          {isPolish ? 'Analiza AI' : 'AI Analysis'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Sparkles size={14} className="text-primary-400" />
                        <motion.div
                          animate={{ rotate: expandedSections.has('ai-analysis') ? 180 : 0 }}
                        >
                          <ChevronDown size={18} className="text-slate-600" />
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
                                className={`px-2.5 py-1 rounded-full text-xs font-bold ${aiAnalysis.riskLevel === 'critical' ? 'bg-danger-500/10 text-danger-500' : aiAnalysis.riskLevel === 'high' ? 'bg-amber-500/10 text-amber-500' : aiAnalysis.riskLevel === 'medium' ? 'bg-blue-500/10 text-blue-500' : 'bg-slate-500/10 text-slate-500'}`}
                              >
                                {isPolish ? 'Priorytet' : 'Priority'}: {aiAnalysis.priority}
                              </span>
                              {aiAnalysis.confidence && (
                                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-primary-500/10 text-primary-500">
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
                            <div className="p-3 rounded-xl bg-primary-50 dark:bg-primary-500/10 border border-primary-200 dark:border-primary-500/20">
                              <div className="flex items-start gap-2">
                                <Zap size={16} className="text-primary-500 mt-0.5 shrink-0" />
                                <div className="text-sm text-primary-700 dark:text-primary-300">
                                  {aiAnalysis.recommendation}
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={handleAskAI}
                              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-500/10 text-primary-600 dark:text-primary-400 hover:bg-primary-500/20 transition-colors text-sm font-medium"
                            >
                              <MessageSquare size={14} />
                              {isPolish
                                ? 'Zapytaj AI o więcej szczegółów'
                                : 'Ask AI for more details'}
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
                    className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 overflow-hidden"
                  >
                    <button
                      onClick={() => toggleSection('expected-action')}
                      className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500/10 to-blue-500/10 dark:from-emerald-500/20 dark:to-blue-500/20">
                          <CheckSquare
                            size={18}
                            className="text-emerald-500 dark:text-emerald-400"
                          />
                        </div>
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                          {isPolish ? 'Oczekiwana akcja' : 'Expected Action'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {actionChecklist.filter((i) => i.completed).length}/
                          {actionChecklist.length}
                        </span>
                        <motion.div
                          animate={{ rotate: expandedSections.has('expected-action') ? 180 : 0 }}
                        >
                          <ChevronDown size={18} className="text-slate-600" />
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
                          <div className="p-5 space-y-4">
                            <div className="flex items-center justify-between">
                              <label className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-500">
                                {isPolish ? 'Co należy zrobić' : 'What needs to be done'}
                              </label>
                              <AIFieldEnhancer
                                fieldKey="c-notification-expected-action"
                                sectionLabel="Expected Action"
                                currentValue={expectedActionValue || ' '}
                                onApply={setExpectedActionDraft}
                                artifactContext={{
                                  title: notification.title,
                                  status: notification.isRead ? 'read' : 'unread',
                                  priority: aiAnalysis?.priority || 'medium',
                                  type: 'notification',
                                }}
                                iconOnly
                                disabled={!canExpectedActionAI}
                              />
                            </div>

                            <textarea
                              value={expectedActionDraft}
                              onChange={(e) => setExpectedActionDraft(e.target.value)}
                              rows={3}
                              className="w-full px-0 py-2 bg-transparent text-sm leading-relaxed text-slate-700 dark:text-slate-300 focus:outline-none placeholder-slate-400 dark:placeholder-slate-600 resize-y border-b border-slate-200 dark:border-navy-700/40 focus:border-primary-400 transition-colors"
                              placeholder={isPolish ? 'Oczekiwana akcja...' : 'Expected action...'}
                            />

                            <div className="flex items-center justify-between pt-1">
                              <label className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-500">
                                {isPolish ? 'Lista kontrolna' : 'Checklist'}
                              </label>
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-medium text-slate-600 dark:text-slate-500 tabular-nums">
                                  {actionChecklist.filter((i) => i.completed).length}/
                                  {actionChecklist.length}
                                </span>
                                <AIFieldEnhancer
                                  fieldKey="c-notification-checklist"
                                  sectionLabel="Checklist"
                                  currentValue={checklistAiValue || ' '}
                                  onApply={applyChecklistFromAIText}
                                  artifactContext={{
                                    title: notification.title,
                                    status: notification.isRead ? 'read' : 'unread',
                                    priority: aiAnalysis?.priority || 'medium',
                                    type: 'notification',
                                  }}
                                  iconOnly
                                  disabled={!canChecklistAI}
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              {actionChecklist.map((item) => (
                                <button
                                  key={item.id}
                                  onClick={() => toggleChecklistItem(item.id)}
                                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-navy-800 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors text-left"
                                >
                                  <div
                                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${item.completed ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 dark:border-navy-600'}`}
                                  >
                                    {item.completed && <Check size={12} className="text-white" />}
                                  </div>
                                  <span
                                    className={`text-sm ${item.completed ? 'text-slate-500 dark:text-slate-400 line-through' : 'text-slate-700 dark:text-slate-300'}`}
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

                  {/* Comments */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 overflow-hidden"
                  >
                    <button
                      onClick={() => toggleSection('comments')}
                      className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/10 to-amber-500/10 dark:from-amber-500/20 dark:to-amber-500/20">
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
                        <motion.div
                          animate={{ rotate: expandedSections.has('comments') ? 180 : 0 }}
                        >
                          <ChevronDown size={18} className="text-slate-600" />
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
                            <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-3">
                              {isPolish ? 'Brak komentarzy' : 'No comments yet'}
                            </p>
                            <button
                              onClick={handleOpenChat}
                              className="w-full px-4 py-2.5 rounded-xl border border-dashed border-primary-300 dark:border-primary-500/30 text-primary-600 dark:text-primary-400 hover:border-primary-400 dark:hover:border-primary-400/50 hover:bg-primary-50/50 dark:hover:bg-primary-500/5 transition-colors text-sm flex items-center justify-center gap-2"
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
                    className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 overflow-hidden"
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
                        <motion.div
                          animate={{ rotate: expandedSections.has('activity-log') ? 180 : 0 }}
                        >
                          <ChevronDown size={18} className="text-slate-600" />
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
                                <Bell size={14} className="text-slate-600" />
                              </div>
                              <div>
                                <p className="text-sm text-slate-700 dark:text-slate-300">
                                  {isPolish ? 'Powiadomienie utworzone' : 'Notification created'}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
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
                                  <p className="text-xs text-slate-500 dark:text-slate-400">
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
                    className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 overflow-hidden"
                  >
                    <button
                      onClick={() => toggleSection('control')}
                      className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-primary-500/10 to-crimson-500/10 dark:from-primary-500/20 dark:to-crimson-500/20">
                          <Flag size={18} className="text-primary-500 dark:text-primary-400" />
                        </div>
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                          Control
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-slate-600 dark:text-slate-500 bg-slate-100/80 dark:bg-navy-800/80 px-2 py-0.5 rounded-lg">
                          #notif-{notificationId.slice(0, 8)}
                        </span>
                        <motion.div animate={{ rotate: expandedSections.has('control') ? 180 : 0 }}>
                          <ChevronDown size={18} className="text-slate-600" />
                        </motion.div>
                      </div>
                    </button>
                    <AnimatePresence>
                      {expandedSections.has('control') && (
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: 'auto' }}
                          exit={{ height: 0 }}
                          className="border-t border-slate-200 dark:border-navy-700 overflow-hidden"
                        >
                          <div className="p-4 space-y-3">
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
                            <div>
                              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                                {isPolish ? 'Priorytet' : 'Severity'}
                              </label>
                              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600">
                                <div
                                  className={`w-2.5 h-2.5 rounded-full ${severityConfig.color}`}
                                />
                                <span className={`text-sm font-medium ${severityConfig.textColor}`}>
                                  {isPolish ? severityConfig.label.pl : severityConfig.label.en}
                                </span>
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                                {isPolish ? 'Kategoria' : 'Category'}
                              </label>
                              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600">
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 capitalize">
                                  {notification.category}
                                </span>
                              </div>
                            </div>
                            {(notification.projectName ||
                              (notification.data as any)?.projectName) && (
                              <div>
                                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                                  {isPolish ? 'Projekt' : 'Project'}
                                </label>
                                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600">
                                  <FolderOpen size={14} className="text-indigo-400" />
                                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    {notification.projectName ||
                                      (notification.data as any)?.projectName}
                                  </span>
                                </div>
                              </div>
                            )}
                            <div>
                              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                                {isPolish ? 'Utworzono' : 'Created'}
                              </label>
                              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600">
                                <Clock size={14} className="text-slate-600" />
                                <span className="text-sm text-slate-700 dark:text-slate-300">
                                  {formatDate(notification.createdAt)}
                                </span>
                              </div>
                            </div>
                            <div className="pt-2 border-t border-slate-200 dark:border-navy-700 space-y-2">
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
                                  className="flex-1 px-3 py-2 rounded-lg bg-danger-50 dark:bg-danger-500/10 text-danger-600 dark:text-danger-400 hover:bg-danger-100 dark:hover:bg-danger-500/20 transition-colors flex items-center justify-center gap-2 text-sm"
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
                    className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 overflow-hidden"
                  >
                    <button
                      onClick={() => toggleSection('stakeholders')}
                      className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-500/10 dark:from-blue-500/20 dark:to-blue-500/20">
                          <Users size={18} className="text-blue-500 dark:text-blue-400" />
                        </div>
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                          {isPolish ? 'Interesariusze' : 'Stakeholders'}
                        </span>
                      </div>
                      <motion.div
                        animate={{ rotate: expandedSections.has('stakeholders') ? 180 : 0 }}
                      >
                        <ChevronDown size={18} className="text-slate-600" />
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
                            {sourceEntity?.assignee && (
                              <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-navy-800">
                                <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-xs font-bold text-blue-500">
                                  {String(sourceEntity.assignee).charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                    {sourceEntity.assignee}
                                  </p>
                                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                    {isPolish ? 'Przypisany' : 'Assignee'}
                                  </p>
                                </div>
                              </div>
                            )}
                            {sourceEntity?.decider && (
                              <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-navy-800">
                                <div className="w-7 h-7 rounded-full bg-primary-500/20 flex items-center justify-center text-xs font-bold text-primary-500">
                                  {String(sourceEntity.decider).charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                    {sourceEntity.decider}
                                  </p>
                                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                    {isPolish ? 'Decydent' : 'Decider'}
                                  </p>
                                </div>
                              </div>
                            )}
                            {!sourceEntity?.assignee && !sourceEntity?.decider && (
                              <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-2">
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
                      className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 overflow-hidden"
                    >
                      <div className="flex items-center justify-between px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/10 to-amber-500/10 dark:from-amber-500/20 dark:to-amber-500/20">
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
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationDetailView;
