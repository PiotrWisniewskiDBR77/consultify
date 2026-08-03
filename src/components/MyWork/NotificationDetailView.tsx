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
  Link2,
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
import { ArtifactPropertiesTable } from '@/components/standard/ArtifactPropertiesTable';
import { LoadingState } from '@/components/ui/primitives';
import { usePresentationMode } from '@/hooks/usePresentationMode';
import { useReducedMotion } from '@/hooks/useReducedMotion';
// ETAP 3 standardu n-Type — „Analizuj z AI" (silnik + panel wyników).
import type { CardAnalysisChange, CardAnalysisField } from '@/services/cardAnalysis';
import { mergeChangeValue } from '@/services/cardAnalysis';
import { useAppStore } from '@/store/useAppStore';
import { useConversationStore } from '@/store/useConversationStore';
import { AppView } from '@/types';
import {
  linkedTypeLabel,
  notificationCategoryLabel,
  notificationTypeLabel,
} from '@/utils/enumLabels';
import { muteNotificationTypeForSession } from '@/utils/notificationMuteSession';

import { Api } from '../../services/api';
import { AutoFitTextarea } from '../shared/AutoFitTextarea';
import type { NModeArtifactType } from '../shared/NModeLayout/cardSets';
import { NCardAIAnalysisPanel } from '../shared/NModeLayout/NCardAIAnalysisPanel';
import { NModeCanvas } from '../shared/NModeLayout/NModeCanvas';
// ETAP 1.2: menu 2 niesie SAM picker „Sekcje" — „+ Nowa karta" zdjęte.
import { SectionsManagerMenu } from '../shared/NModeLayout/NModeCardManager';
import { NModeHeader } from '../shared/NModeLayout/NModeHeader';
import { NModeLeftNav } from '../shared/NModeLayout/NModeLeftNav';
import { Menu2AIButton, NModeMenu2 } from '../shared/NModeLayout/NModeMenu2';
import type { NModePropertyField, NModeSection } from '../shared/NModeLayout/types';
import { useCardAIAnalysis } from '../shared/NModeLayout/useCardAIAnalysis';
import { type CardLayout, useCardLayout } from '../shared/NModeLayout/useCardLayout';
// SPEC-N §2.2 — prawy panel artefaktu (Akcje·Wlasciwosci·Powiazania·Komentarze·Historia).
// Tu w wariancie SKROCONYM: Wlasciwosci + Historia (decyzja wlasciciela K2).
// `NModePropertiesStrip` przestal byc importowany — 6 pol metadanych przenioslo sie
// z poziomego paska pod naglowkiem do sekcji Wlasciwosci tego panelu.
import { PreviewActionBar } from '../shared/PreviewPane/PreviewActionBar';
import TeresaMark from '../shared/TeresaMark';
import {
  ARTIFACT_PANEL_CARD_CLASS_STICKY,
  ArtifactRightPanel,
  type ArtifactRightPanelSection,
} from '../standard/ArtifactRightPanel';
// MIGRACJA (D-8): kompozycja kart Notification wyprowadzona z WIĄŻĄCEGO kontraktu
// karty (cardContract.types.ts) zamiast zahardkodowanego nModeSections — patrz
// notificationCardContract.ts. Za flagą (default OFF), wzorzec = POC Decision.
import { NOTIFICATION_CARD_RENDER_IDS, NOTIFICATION_CARD_SPEC } from './notificationCardContract';
// ETAP 1.1 n-Type: `PresentationModeSwitcher` NIE jest importowany — karta N ma
// JEDEN widok, przelacznik N/C znika z naglowka (`showModeSwitcher={false}`).
// `ReadEditToggle` tez nie wprost — przelacznik Edycja|Podglad renderuje wspolny
// `NModeMenu2` (strefa srodkowa), karmiony `readMode` / `onReadModeChange`.

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
  DECISION_REQUIRED: { icon: Scale, color: 'text-c-text-muted' },
  DECISION_OVERDUE: { icon: Scale, color: 'text-danger-400' },
  INITIATIVE_STARTED: { icon: Target, color: 'text-emerald-400' },
  INITIATIVE_STALLED: { icon: Target, color: 'text-amber-400' },
  INITIATIVE_COMPLETED: { icon: Target, color: 'text-emerald-400' },
  AI_RISK_DETECTED: { icon: AlertTriangle, color: 'text-amber-400' },
  AI_RECOMMENDATION: { icon: Info, color: 'text-c-text-muted' },
  AI_OVERLOAD_DETECTED: { icon: AlertTriangle, color: 'text-danger-400' },
  AI_DEPENDENCY_CONFLICT: { icon: AlertCircle, color: 'text-amber-400' },
  SYSTEM_ALERT: { icon: Bell, color: 'text-c-text-muted' },
  // App / billing comms
  PAYMENT_FAILED: { icon: CreditCard, color: 'text-danger-400' },
  USAGE_ALERT: { icon: AlertTriangle, color: 'text-amber-400' },
  SUBSCRIPTION_CHANGE: { icon: CreditCard, color: 'text-indigo-400' },
  BILLING_LIMIT_WARNING: { icon: AlertTriangle, color: 'text-amber-400' },
  BILLING_LIMIT_REACHED: { icon: AlertCircle, color: 'text-danger-400' },
  INVOICE_READY: { icon: CreditCard, color: 'text-emerald-400' },
  // DBR77 comms
  DBR77_UPDATE: { icon: Megaphone, color: 'text-c-text-muted' },
  DBR77_RELEASE_NOTES: { icon: Megaphone, color: 'text-indigo-400' },
  DBR77_KB_NEW: { icon: BookOpen, color: 'text-emerald-400' },
  DBR77_INSTRUCTION: { icon: BookOpen, color: 'text-amber-400' },
};

// ── Formatowanie pewności ────────────────────────────────────────────────────

/**
 * Zamienia surową „pewność" z danych powiadomienia na etykietę procentową.
 *
 * Producenci nie są spójni: silniki AI zwracają UŁAMEK (0.82), reguły
 * biznesowe — punkty procentowe (82), a treści autorskie potrafią przysłać
 * gotowy string („82%"). Do 2026-07-23 karta doklejała gołe „%" do wartości
 * wprost, więc 0.82 renderowało się jako „0.82%" (defekt R2 #2). Jedna
 * funkcja = jedno miejsce, w którym ta konwersja może się zepsuć.
 *
 * Umowa: wartość z przedziału (0, 1] traktujemy jako ułamek i mnożymy ×100;
 * powyżej 1 traktujemy jako punkty procentowe. 0 / brak / śmieci → ''.
 */
export function formatConfidencePercent(raw: unknown): string {
  if (raw === null || raw === undefined || raw === '') return '';

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return '';
    // Już sformatowane („82%", „82 %") — nie ruszamy, tylko normalizujemy odstęp.
    if (trimmed.endsWith('%')) return trimmed.replace(/\s+%$/, '%');
    const parsed = Number(trimmed.replace(',', '.'));
    if (!Number.isFinite(parsed)) return trimmed;
    return formatConfidencePercent(parsed);
  }

  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return '';

  const percent = raw <= 1 ? raw * 100 : raw;
  // Bez sztucznej precyzji: 82 zamiast „82.0", ale 82,5 nie znika.
  const rounded = Math.round(percent * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}%`;
}

// ── Component ────────────────────────────────────────────────────────────────

// MIGRACJA — kompozycja kart Notification przez WIĄŻĄCY kontrakt karty (D-8).
// Default OFF (zero regresji na demo). Opt-in URL `?cardContract=1` oraz localStorage
// `ff.cardContract` działają TAKŻE na produkcji (bez DEV guardu) — żeby Piotr mógł
// włączyć kontrakt tylko sobie jednym linkiem. Kolejność: URL → localStorage → env →
// OFF. Wzór: isInitiativeCardContractEnabled.
function parseCardContractFlag(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null;
  const v = String(raw).trim().toLowerCase();
  if (v === '1' || v === 'true' || v === 'on') return true;
  if (v === '0' || v === 'false' || v === 'off') return false;
  return null;
}

function useNotificationCardContractEnabled(): boolean {
  return useMemo(() => {
    if (typeof window !== 'undefined' && window.location) {
      try {
        const q = parseCardContractFlag(
          new URLSearchParams(window.location.search).get('cardContract')
        );
        if (q !== null) {
          try {
            window.localStorage.setItem('ff.cardContract', q ? '1' : '0');
          } catch {
            /* ignore */
          }
          return q;
        }
      } catch {
        /* ignore */
      }
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const ls = parseCardContractFlag(window.localStorage.getItem('ff.cardContract'));
        if (ls !== null) return ls;
      } catch {
        /* ignore */
      }
    }
    if (import.meta.env.VITE_VF1_NOTIFICATION_CARD_CONTRACT === 'true') return true;
    return false;
  }, []);
}

// ★ 2026-07-23 — rzutowanie `as unknown as NModeArtifactType` USUNIETE.
// 'notification' jest teraz pelnoprawnym czlonkiem uniona (shared cardSets.ts),
// wiec typ jest sprawdzany naprawde, a nie obchodzony. Pole `artifactType`
// pozostaje INERTNE w runtime, bo `spec` (NOTIFICATION_CARD_SPEC) zawsze
// zastepuje DEFAULT_CARD_SETS (useCardLayout.ts:148-151).
const NOTIFICATION_ARTIFACT_TYPE: NModeArtifactType = 'notification';

export const NotificationDetailView: React.FC<NotificationDetailViewProps> = ({
  notificationId,
  onClose,
  onNavigateToSource,
}) => {
  const { t, i18n, ready: i18nReady } = useTranslation();
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
  // Ostatni zapis sie NIE powiodl. Wskaznik w naglowku musi wtedy powiedziec
  // "Blad zapisu", a nie "Zapisano" — inaczej karta klamie o trwalosci tresci.
  const [worksheetSaveFailed, setWorksheetSaveFailed] = useState(false);

  // N-mode active section
  const [activeNSection, setActiveNSection] = useState('whats-happening');

  // ETAP 1.2 — tryb Edycja | Podgląd (menu 2). Powiadomienie jako JEDYNA karta N
  // nie miało tego przełącznika (zgłoszenie właściciela pkt 5). Podgląd = „do
  // pokazania klientowi": pola arkusza tylko do odczytu, afordancje AI przy
  // polach wygaszone. Domyślnie EDYCJA — powiadomienie to arkusz do wypełnienia
  // (decyzja D-A, komentarz przy `titleReadOnly` niżej).
  //
  // ETAP 2.1 (scalenie 2026-07-23): ten sam stan obsługuje pola `AutoFitTextarea`
  // — w trybie Podgląd znikają uchwyt wysokości i sloty AI. Wzorzec i komponent
  // przełącznika = `MyWork/shared/ReadEditToggle` (ten sam, którego używają Task
  // i Decision). JEDNA deklaracja na cały widok — nie duplikować niżej.
  const [readMode, setReadMode] = useState(false);

  // Expanded sections state (C-mode accordion)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['whats-happening', 'ai-analysis', 'expected-action', 'source-entity', 'control'])
  );

  // Action checklist state (urgency: 'critical' | 'normal' | 'optional')
  const [actionChecklist, setActionChecklist] = useState<
    { id: string; text: string; completed: boolean; urgency?: string }[]
  >([]);
  // Z-2.1 (fix i18n wyscigu) — czy biezaca checklista pochodzi z auto-generacji
  // (generateActionChecklist), w odroznieniu od checklisty pobranej z serwera
  // (found.checklist) albo nadpisanej przez AI (applyChecklistFromAIText).
  // Uzywane, zeby efekt przeliczajacy tlumaczenie NIE nadpisywal tresci,
  // ktora nie pochodzi z tego generatora.
  const isAutoChecklistRef = useRef(true);

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

  // Tryb Edycja / Podglad (ETAP 2.1) — stan `readMode` zadeklarowany WYZEJ
  // razem z ETAP 1.2 (menu 2). Byly dwie deklaracje po scaleniu fali menu2 i
  // fali powiadomienia; zostala jedna.

  // Mute dropdown (uzywany juz TYLKO przez stary tryb 'c'; w trybie N pozycje
  // "Wycisz to" / "Wycisz podobne" przeniesione do menu przepelnienia "…")
  const [showMuteMenu, setShowMuteMenu] = useState(false);

  // Save as note
  const [savingAsNote, setSavingAsNote] = useState(false);

  // Worksheet analysis (AI fills the notification "sheet" fields)
  const [isAnalyzingWorksheet, setIsAnalyzingWorksheet] = useState(false);
  // ★ 2026-07-23 — nieudana analiza AI musi byc WIDOCZNA rowniez w trybie
  // auto (silent). Wczesniej auto-wywolanie po wejsciu w kartę gaslo w catch
  // i konsultant nie wiedzial, ze pola po prostu nie zostaly wypelnione.
  const [aiAnalysisError, setAiAnalysisError] = useState<string | null>(null);

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

  // Lustro biezacych szkicow w ref — potrzebne, zeby asynchroniczna odpowiedz AI
  // mogla porownac stan pola SPRZED zapytania z tym, co jest w polu TERAZ.
  // Bez tego closure AI widzi wartosci z chwili startu zapytania (stale) i nadpisuje
  // to, co konsultant wpisal w miedzyczasie.
  const worksheetDraftRef = useRef(worksheetDraft);
  useEffect(() => {
    worksheetDraftRef.current = worksheetDraft;
  }, [worksheetDraft]);

  // Snapshot tresci, ktora ostatnio NIE zapisala sie — blokada petli autozapisu.
  const lastFailedWorksheetSnapshotRef = useRef<string | null>(null);

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

  // SPEC-N §2.1/§2.2 — Historia zyje teraz w PRAWYM PANELU, a nie w lewej nawigacji,
  // wiec nie ma juz momentu "user kliknal sekcje activity-log", ktory ja doladowywal.
  // Panel jest widoczny zawsze -> dane ciagniemy raz, po wczytaniu powiadomienia.
  // (Komentarze: sekcja usunieta calkowicie wg K2 — lazy-load zostaje wylacznie
  // dla starego trybu 'c', ktory ma wlasny akordeon komentarzy.)
  useEffect(() => {
    if (!notification) return;
    if (activityLog.length === 0 && !activityLogLoading) {
      loadActivityLog();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notification?.id]);

  useEffect(() => {
    if (activeNSection === 'comments' && comments.length === 0 && !commentsLoading) {
      loadComments();
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
          isAutoChecklistRef.current = false;
          setActionChecklist(found.checklist);
        } else {
          generateActionChecklist(found);
        }

        loadSourceEntity();
      } else {
        toast.error(t('myWork.notificationDetail.toastError', 'Notification not found'));
      }
    } catch (error) {
      console.error('Failed to load notification', error);
      toast.error(
        t('myWork.notificationDetail.failedToLoadNotification', 'Failed to load notification')
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

  // Z-2.1 — buduje liste itemow checklisty z biezacego tlumaczenia `t`. Funkcja
  // CZYSTA (bez setState), zeby mogla byc wywolana zarowno przy pierwszym
  // zaladowaniu notyfikacji, jak i przez efekt przeliczajacy ponizej (gdy
  // paczka i18n doladuje sie PO pierwszym renderze i pierwsze wywolanie `t()`
  // zwrocilo angielski fallback).
  const buildActionChecklistItems = (
    notif: any
  ): { id: string; text: string; completed: boolean; urgency?: string }[] => {
    // Use the enriched rule-engine checklist from notificationContent contract
    const notifContract = buildNotificationContent(notif, t);
    const suggested: SuggestedChecklistItem[] = notifContract.suggestedChecklist || [];

    if (suggested.length > 0) {
      return suggested.map((s, idx) => ({
        id: String(idx + 1),
        text: s.text,
        completed: false,
        urgency: s.urgency || 'normal',
      }));
    }

    // Fallback — should not happen since inferChecklist always returns items
    return [
      {
        id: '1',
        text: t('myWork.notificationDetail.text', 'Review notification'),
        completed: false,
      },
      {
        id: '2',
        text: t('myWork.notificationDetail.text2', 'Take appropriate action'),
        completed: false,
      },
    ];
  };

  const generateActionChecklist = (notif: any) => {
    isAutoChecklistRef.current = true;
    setActionChecklist(buildActionChecklistItems(notif));
  };

  // Z-2.1 — BUG: „Oczekiwana akcja" renderowala sie po angielsku mimo istniejacego
  // PL, bo `generateActionChecklist` wolal `t()` RAZ przy zaladowaniu i zapisywal
  // WYNIK (string) w stanie React. Jesli paczka i18n (pl.json) jeszcze nie
  // doczytala sie w tym momencie (wyscig przy mount, `HttpBackend` laduje
  // asynchronicznie), `t()` zwracal angielski fallback i ten string zamrazal
  // sie na stale — nic pozniej go nie przeliczalo, mimo ze paczka i tak sie
  // doladowywala chwile potem.
  // NAPRAWA (wariant mniej inwazyjny): gdy `i18nReady`/`i18n.language` sie
  // zmienia, przelicz teksty checklisty z aktualnego `t` — ale TYLKO gdy
  // biezaca checklista jest auto-wygenerowana (nie nadpisuj checklisty
  // pobranej z serwera ani edytowanej przez AI) i TYLKO gdy tekst faktycznie
  // sie zmienil (zeby nie tworzyc zbednych re-renderow), z zachowaniem stanu
  // `completed` per pozycja.
  useEffect(() => {
    if (!notification || !i18nReady || !isAutoChecklistRef.current) return;
    setActionChecklist((prev) => {
      if (prev.length === 0) return prev;
      const regenerated = buildActionChecklistItems(notification);
      if (regenerated.length !== prev.length) return prev;
      const changed = regenerated.some((item, idx) => item.text !== prev[idx]?.text);
      if (!changed) return prev;
      return regenerated.map((item, idx) => ({
        ...item,
        completed: prev[idx]?.completed ?? item.completed,
      }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18nReady, i18n.language, notification]);

  const toggleChecklistItem = (id: string) => {
    setActionChecklist((prev) => {
      const updated = prev.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      );
      // ★ 2026-07-23 — nieudany zapis MUSI byc widoczny. Backend odrzuca teraz
      // zly ksztalt (400) i cudze/nieistniejace id (404) zamiast udawac sukces;
      // sam console.error zostawialby konsultanta z odhaczona pozycja, ktorej
      // nikt nie zapisal.
      Api.updateNotificationChecklist(notificationId, updated).catch((err) => {
        console.error('Failed to persist checklist', err);
        toast.error(t('myWork.notificationDetail.toastError2', 'Failed to save'));
      });
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
        setWorksheetSaveFailed(false);
        lastFailedWorksheetSnapshotRef.current = null;
        if (!silent) {
          toast.success(t('myWork.notificationDetail.toastSuccess', 'Saved'));
        }
      } catch (e: any) {
        // Nieudany zapis MUSI byc widoczny. Autozapis (silent) tez — inaczej
        // konsultant pracuje w przekonaniu, ze tresc jest bezpieczna.
        console.error('[NotificationDetailView] Worksheet save failed:', e);
        setWorksheetSaveFailed(true);
        lastFailedWorksheetSnapshotRef.current = worksheetSnapshot;
        toast.error(t('myWork.notificationDetail.toastError2', 'Failed to save'));
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
    // Ta sama tresc juz raz nie przeszla — nie mlocimy backendu co 1,2 s.
    // Kolejna proba dopiero po zmianie tresci albo po recznym kliknieciu "Zapisz".
    if (lastFailedWorksheetSnapshotRef.current === worksheetSnapshot) return;

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

      isAutoChecklistRef.current = false;
      setActionChecklist(next);
      // ★ 2026-07-23 — jak wyzej: bez toastu nieudany zapis checklisty z AI
      // znikal w konsoli, a ekran pokazywal tresc, ktorej nie ma w bazie.
      Api.updateNotificationChecklist(notificationId, next).catch((err) => {
        console.error('Failed to persist checklist', err);
        toast.error(t('myWork.notificationDetail.toastError2', 'Failed to save'));
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [actionChecklist, notificationId, t]
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
        t(
          'myWork.notificationDetail.areYouSureYou',
          'Are you sure you want to delete this notification?'
        )
      )
    )
      return;
    try {
      await Api.deleteNotification(notificationId);
      toast.success(t('myWork.notificationDetail.toastSuccess2', 'Notification deleted'));
      onClose();
    } catch (error) {
      console.error('Failed to delete notification', error);
      toast.error(
        t('myWork.notificationDetail.failedToDeleteNotification', 'Failed to delete notification')
      );
    }
  };

  const handleMuteThis = async () => {
    try {
      await Api.dismissNotification(notificationId);
      toast.success(t('myWork.notificationDetail.toastSuccess3', 'Notification muted'));
      onClose();
    } catch (error) {
      console.error('Failed to dismiss notification', error);
      toast.error(t('myWork.notificationDetail.toastError3', 'Failed to mute'));
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
      toast.error(t('myWork.notificationDetail.toastError4', 'Failed to mute type'));
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
      toast.success(t('myWork.notificationDetail.toastSuccess4', 'Saved as note'));
    } catch (error) {
      console.error('Failed to save as note', error);
      toast.error(t('myWork.notificationDetail.toastError5', 'Failed to save as note'));
    } finally {
      setSavingAsNote(false);
    }
  };

  const handleMarkRead = async () => {
    if (!notification) return;
    try {
      await Api.markNotificationRead(notificationId);
      setNotification({ ...notification, isRead: true, readAt: new Date().toISOString() });
      toast.success(t('myWork.notificationDetail.toastSuccess5', 'Marked as read'));
    } catch (error) {
      console.error('Failed to mark as read', error);
      toast.error(t('myWork.notificationDetail.toastError6', 'Failed to mark as read'));
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
    toast.success(t('myWork.notificationDetail.toastSuccess6', 'Chat opened'));
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
      setAiAnalysisError(null);

      // Stan pol w chwili WYSLANIA zapytania. Odpowiedz AI wraca po kilku-kilkunastu
      // sekundach; w tym czasie konsultant moze juz pisac. Pole, ktore zmienilo sie
      // od startu zapytania, jest jego praca — AI go NIE nadpisuje.
      const draftAtRequestStart = worksheetDraftRef.current;
      const skippedFields: string[] = [];
      const applyIfUntouched = (
        field: keyof typeof draftAtRequestStart,
        value: string,
        setDraft: (v: string) => void
      ) => {
        if (worksheetDraftRef.current[field] !== draftAtRequestStart[field]) {
          skippedFields.push(field);
          return;
        }
        setDraft(value);
      };

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

        // ★ 2026-07-23 — NAPRAWA MARTWEGO WYWOLANIA AI.
        // Bylo: POST /ai/chat — orkiestrator zwraca {role,intent,prompt,...},
        // nigdy `text`/`content`. `raw` bylo zawsze puste => rzucalo
        // 'AI returned no JSON' i (w trybie silent) gaslo bez sladu.
        // Jest: POST /ai/generate — jedyny endpoint zwracajacy {text}.
        const aiRes = await Api.post('/ai/generate', {
          message: prompt,
          systemInstruction: t(
            'myWork.notificationDetail.systemInstruction',
            'You are a PMO assistant. Return only valid JSON. No commentary, no markdown. Write contextually — not generically.'
          ),
          roleName: 'Notification Context Builder',
        });

        const raw = String(aiRes?.text ?? '').trim();
        if (!raw) throw new Error('EMPTY_LLM_RESPONSE');
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('AI returned no JSON');

        const parsed = JSON.parse(jsonMatch[0]) as any;

        // Apply all fields — z pominieciem tych, ktore uzytkownik edytowal w trakcie.
        if (typeof parsed.description === 'string' && parsed.description.trim()) {
          applyIfUntouched('description', parsed.description.trim(), setDescriptionDraft);
        }
        if (typeof parsed.whyImportant === 'string' && parsed.whyImportant.trim()) {
          applyIfUntouched('whyImportant', parsed.whyImportant.trim(), setWhyImportantDraft);
        }
        if (typeof parsed.blocked === 'string' && parsed.blocked.trim()) {
          applyIfUntouched('blocked', parsed.blocked.trim(), setBlockedDraft);
        }
        if (typeof parsed.expectedAction === 'string' && parsed.expectedAction.trim()) {
          applyIfUntouched('expectedAction', parsed.expectedAction.trim(), setExpectedActionDraft);
        }

        if (skippedFields.length > 0) {
          // Uczciwy komunikat zamiast cichego nadpisania: mowimy, ze AI odpuscilo pola.
          toast(
            t(
              'myWork.notificationDetail.aiSkippedEditedFields',
              'AI did not overwrite fields you were editing'
            ),
            { icon: 'ℹ️' }
          );
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
            t(
              'myWork.notificationDetail.aIFilledNotificationContext',
              'AI filled notification context'
            )
          );
        }
      } catch (err) {
        console.error('[NotificationDetailView] Analyze with AI failed:', err);
        // ★ Uczciwy stan: „AI niedostepne" JEST poprawnym wynikiem, cisza nie
        // jest. Toast tylko przy kliknieciu (silent=false, zeby auto-wejscie w
        // karte nie sypalo toastami), ale INLINE komunikat pokazujemy zawsze.
        const serverCode =
          (err as { code?: string })?.code ??
          (err as { response?: { data?: { code?: string } } })?.response?.data?.code ??
          (err as Error)?.message;
        const base = t(
          'myWork.notificationDetail.failedToFillContext',
          'Failed to fill context with AI'
        );
        setAiAnalysisError(serverCode ? `${base} (${serverCode})` : base);
        if (!silent) {
          toast.error(base);
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
      toast.success(t('myWork.notificationDetail.toastSuccess7', 'Comment added'));
    } catch (error) {
      console.error('Failed to add comment', error);
      toast.error(t('myWork.notificationDetail.toastError7', 'Failed to add comment'));
    } finally {
      setSubmittingComment(false);
    }
  }, [newCommentText, notificationId, submittingComment, isPolish]);

  const handleDeleteComment = useCallback(
    async (commentId: string) => {
      if (!confirm(t('myWork.notificationDetail.confirm', 'Delete this comment?'))) return;
      try {
        await Api.deleteNotificationComment(notificationId, commentId);
        setComments((prev) => prev.filter((c) => c.id !== commentId));
        setCommentsCount((prev) => Math.max(0, prev - 1));
        toast.success(t('myWork.notificationDetail.toastSuccess8', 'Comment deleted'));
      } catch (error) {
        console.error('Failed to delete comment', error);
        toast.error(t('myWork.notificationDetail.toastError8', 'Failed to delete comment'));
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
        toast.error(t('myWork.notificationDetail.toastError9', 'Failed to snooze'));
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

    if (diffMins < 1) return t('myWork.notificationDetail.justNow', 'Just now');
    if (diffMins < 60) return t('myWork.notificationDetail.minutesAgo', { count: diffMins });
    if (diffHours < 24) return t('myWork.notificationDetail.hoursAgo', { count: diffHours });
    if (diffDays < 7) return t('myWork.notificationDetail.daysAgo', { count: diffDays });

    return date.toLocaleDateString(t('myWork.notificationDetail.dateToLocaleDateString', 'en-US'), {
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
        return <Scale size={14} className="text-c-text-muted" />;
      case 'INITIATIVE':
        return <Target size={14} className="text-emerald-400" />;
      case 'PROJECT':
        return <FolderOpen size={14} className="text-indigo-400" />;
      case 'GATE':
        return <Flag size={14} className="text-amber-400" />;
      default:
        return <Bell size={14} className="text-c-text-muted" />;
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
    // R2/defekt #2 (2026-07-23): `confidence` przychodzi z silnika jako UŁAMEK
    // (0.82), a doklejaliśmy gołe „%" → karta pokazywała „Pewność: 0.82%”
    // zamiast „82%”. Producenci nie są spójni (0..1 z modeli, 0..100 z reguł,
    // czasem string „82%”), więc normalizujemy w JEDNYM miejscu — obie karty
    // (nagłówek i sekcja analizy) czytają ten sam wynik.
    const enrichedConfidence = formatConfidencePercent(data.confidence);

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
      impact = t(
        'myWork.notificationDetail.blockedTaskIsHalting',
        'Blocked task is halting project progress.'
      );
    } else if (type.includes('DECISION')) {
      const deadlineDays = Number(data.deadline_days || 0);
      impact = isPolish
        ? `Decyzja jest wymagana${deadlineDays > 0 ? ` w ciągu ${deadlineDays} dni` : ''} do kontynuowania prac.`
        : `Decision is required${deadlineDays > 0 ? ` within ${deadlineDays} days` : ''} to continue work.`;
    } else if (type.includes('AI_RISK')) {
      impact = t(
        'myWork.notificationDetail.aIDetectedAPotential',
        'AI detected a potential risk that requires attention.'
      );
    } else if (type.includes('AI_RECOMMENDATION')) {
      const savings = data.savings_annual as string;
      impact = savings
        ? isPolish
          ? `AI zidentyfikowało potencjalne oszczędności: ${savings}/rok.`
          : `AI identified potential savings of ${savings}/year.`
        : t(
            'myWork.notificationDetail.aIHasAnOptimization',
            'AI has an optimization recommendation.'
          );
    } else {
      impact = t(
        'myWork.notificationDetail.thisNotificationRequiresYour',
        'This notification requires your attention.'
      );
    }

    let recommendation: string;
    if (enrichedRecommendation) {
      recommendation = enrichedRecommendation;
    } else if (type.includes('OVERDUE')) {
      recommendation = t(
        'myWork.notificationDetail.recommendedImmediatelyUpdateStatus',
        'Recommended: Immediately update status or delegate the task.'
      );
    } else if (type.includes('BLOCKED')) {
      recommendation = t(
        'myWork.notificationDetail.recommendedResolveBlockerOr',
        'Recommended: Resolve blocker or escalate to manager.'
      );
    } else if (type.includes('DECISION')) {
      recommendation = t(
        'myWork.notificationDetail.recommendedAnalyzeOptionsAnd',
        'Recommended: Analyze options and make a decision.'
      );
    } else if (type.includes('AI')) {
      recommendation = t(
        'myWork.notificationDetail.recommendedReviewAIRecommendation',
        'Recommended: Review AI recommendation and decide.'
      );
    } else {
      recommendation = t(
        'myWork.notificationDetail.recommendedReviewAndTake',
        'Recommended: Review and take appropriate action.'
      );
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
    ? TYPE_ICONS[typeKey] || { icon: Bell, color: 'text-c-text-muted' }
    : { icon: Bell, color: 'text-c-text-muted' };
  const TypeIcon = typeConfig.icon;
  const contract = notification ? buildNotificationContent(notification as any, t) : null;
  const aiAnalysis = generateAIAnalysis();

  // ★ Klucz TRESCI zapisanego arkusza (nie tozsamosc obiektu `notification`).
  //
  // Efekty ponizej resetuja szkice pol do wartosci z serwera. Mialy w tablicy
  // zaleznosci caly obiekt `notification` — a `handleMarkRead` robi
  // `setNotification({ ...notification, isRead: true })`, czyli tworzy NOWY obiekt
  // o tej samej tresci. Skutek zmierzony w harnessie: konsultant wpisywal tresc,
  // klikal "Przeczytane" i pola natychmiast wracaly do tekstu z powiadomienia,
  // po czym autozapis utrwalal ten powrot i naglowek pokazywal "Zapisano".
  // Klucz tresciowy sprawia, ze reset nastepuje TYLKO gdy realnie zmieni sie
  // zapisany arkusz — a nie przy kazdej podmianie obiektu w stanie.
  const persistedWorksheetKey = useMemo(() => {
    const ws = (notification as any)?.data?.worksheet;
    try {
      return JSON.stringify(ws ?? null);
    } catch {
      return '';
    }
  }, [notification]);

  // Keep expected action draft in sync with loaded notification (and language)
  useEffect(() => {
    const ws = (notification as any)?.data?.worksheet;
    const persisted = ws && typeof ws === 'object' ? (ws as any).expectedAction : undefined;
    setExpectedActionDraft(String(persisted ?? contract?.expectedAction ?? ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notificationId, contract?.expectedAction, persistedWorksheetKey]);

  // Keep "What's Happening" field drafts in sync
  useEffect(() => {
    const ws = (notification as any)?.data?.worksheet;
    const persistedWhat = ws && typeof ws === 'object' ? (ws as any).description : undefined;
    const persistedWhy = ws && typeof ws === 'object' ? (ws as any).whyImportant : undefined;
    const persistedBlocked = ws && typeof ws === 'object' ? (ws as any).blocked : undefined;
    setDescriptionDraft(String(persistedWhat ?? contract?.what ?? notification?.message ?? ''));
    setWhyImportantDraft(String(persistedWhy ?? contract?.whyImportant ?? ''));
    setBlockedDraft(String(persistedBlocked ?? contract?.blocked ?? ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    notificationId,
    contract?.what,
    contract?.whyImportant,
    contract?.blocked,
    notification?.message,
    persistedWorksheetKey,
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

  // ── AI context enrichment is USER-INITIATED ONLY ──────────────────────────
  // ★ 2026-07-24 — REGRESJA R2: usunieto auto-wywolanie AI przy montowaniu
  // ekranu. Wczesniej useEffect odpalal handleAnalyzeWithAI(true) po 600ms od
  // zaladowania powiadomienia => KAZDE wejscie w karte generowalo wywolanie AI
  // (i EMPTY_LLM_RESPONSE w konsoli) bez akcji uzytkownika. Analiza startuje
  // teraz WYLACZNIE z klikniecia „Analizuj z AI" (handleAnalyzeWithAI(false)).

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

  // ── POWIAZANIA + ZRODLO — jedna deklaracja, dwoje odbiorcow ───────────────
  // ETAP 2.1: „Wynika z" (zrodlo/projekt) i „Dlaczego to dostales" zyly w
  // CENTRUM sekcji „Co sie dzieje". Kanon panelu (ARTIFACT_ANATOMY §11.2) mowi,
  // ze relacje i zrodla/zalozenia to sekcje PRAWEGO PANELU, a centrum to pola
  // opisowe. Liczymy je raz, tutaj (przed guardami — Rules of Hooks), zeby
  // panel mial dane, a centrum ich juz nie dublowalo (§2.6 anty-duplikacja).
  // ★ `type` trzyma SUROWY typ obiektu ('task' | 'decision' | 'project' | …) —
  //   bo ta sama wartosc jedzie do `onNavigateToSource(type, id)`. Etykiete PL
  //   robi `linkedTypeLabel` dopiero w renderze (2026-07-24). Wczesniej pole
  //   niosło juz PRZETLUMACZONA nazwe, wiec nawigacja w PL dostawala 'zadanie'
  //   zamiast 'task' — a wariant bez `sourceEntity` pokazywal surowe 'DECISION'
  //   i identyfikator podstawiony pod tytul.
  const notifRelationItems = useMemo(() => {
    const items: { id: string; type: string; title: string }[] = [];
    if (!notification) return items;
    if (sourceEntity && sourceEntity.title) {
      items.push({
        id: sourceEntity.id || notification.relatedObjectId || '',
        type: String(sourceEntity.type || ''),
        title: String(sourceEntity.title),
      });
    } else if (notification.relatedObjectType && notification.relatedObjectId) {
      // Tytulu NIE MA — nie podstawiamy pod niego id (to nie nazwa obiektu).
      items.push({
        id: notification.relatedObjectId,
        type: String(notification.relatedObjectType),
        title: '',
      });
    }
    if (notification.projectName && notification.projectId) {
      items.push({
        id: notification.projectId,
        type: 'project',
        title: notification.projectName,
      });
    }
    return items;
  }, [notification, sourceEntity]);

  // Zrodlo powiadomienia (kto/co je wygenerowalo) — wiersz „Zrodlo" w tabeli
  // Wlasciwosci. Wczesniej ta sama logika stala w centrum jako pigulka-badge.
  const notifCreator = useMemo(() => {
    const typeUpper = (notification?.type || '').toUpperCase();
    const category = notification?.category;
    const isAICreated =
      typeUpper.startsWith('AI_') || category === 'ai' || Boolean(notification?.data?.aiGenerated);
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
    return {
      label: isAICreated
        ? 'AI'
        : isSystemCreated
          ? 'System'
          : notification?.data?.createdByName || t('myWork.notificationDetail.user', 'User'),
      icon: (isAICreated ? Bot : isSystemCreated ? Monitor : Users) as React.FC<{
        size?: number;
        className?: string;
      }>,
    };
  }, [notification, t]);

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
      // SPEC-N §2.1 — identyfikatory `comments` / `history` / `activity-log` sa
      // ZAREZERWOWANE dla prawego panelu i NIE MOGA byc sekcja lewej nawigacji.
      // Byly tu obie (comments + activity-log). Rozstrzygniecie wlasciciela (K2
      // planu wdrozenia): powiadomienie to wiadomosc systemowa, a nie artefakt
      // wspolpracy — sekcja Komentarzy znika CALKOWICIE (nie wedruje do panelu),
      // a Historia aktywnosci trafia do prawego panelu (sekcja `history`).
      // Bloki `case 'comments'` / `case 'activity-log'` nizej w
      // `nModeSectionsWithContent` sa od teraz nieosiagalne — zostaja swiadomie:
      // usuwanie martwego kodu to osobna fala PO migracjach (SPEC-N §7, P3),
      // zeby diff tej zmiany dalo sie odebrac na zrzutach.
    ];

    return sections;
  }, [notification?.type, notification?.data, actionChecklist]);

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
          // ETAP 2.1 — CENTRUM = POLA n-Type, nie statyczny opis.
          // Co STAD WYSZLO (do prawego panelu, kanon §11.2 — zero duplikatow §2.6):
          //   • „Wynika z" (zrodlo/projekt)      → sekcja Powiazania
          //   • „Dlaczego to dostales" (callout) → sekcja Zrodla i zalozenia
          //   • pigulki Priorytet / Zrodlo       → tabela Wlasciwosci
          // Co ZOSTALO: trzy POLA opisowe (`AutoFitTextarea`) — kazde ma nazwe,
          // przycisk AI w prawym gornym rogu, tryb edycji, auto-fit wysokosci
          // i uchwyt zmiany wysokosci; w trybie Podglad kontrolki znikaja.
          // Lewy akcent koloru = severity (sygnal wagi, nie zdublowane pole).
          const severityBorderAccent =
            notification.severity === 'CRITICAL'
              ? 'border-l-danger-500'
              : notification.severity === 'WARNING'
                ? 'border-l-amber-500'
                : 'border-l-blue-400';

          const notifAiContext = {
            title: notification.title,
            status: notification.isRead ? 'read' : 'unread',
            priority: notification.severity || '',
            type: 'notification',
          };

          component = (
            <div className={`space-y-5 border-l-[3px] ${severityBorderAccent} pl-4`}>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-c-text">
                    {t('myWork.notificationDetail.whatSHappening', "What's Happening")}
                  </h2>
                  {isAnalyzingWorksheet && (
                    <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] text-c-info animate-pulse">
                      <Loader2 size={12} className="animate-spin" />
                      {t('myWork.notificationDetail.aIAnalyzing', 'AI analyzing...')}
                    </span>
                  )}
                </div>
                {/* Uczciwy stan „AI niedostepne" — WLASNY wiersz pod naglowkiem,
                    zeby dlugi komunikat z kodem serwera nie lamal tytulu sekcji. */}
                {!isAnalyzingWorksheet && aiAnalysisError && (
                  <div
                    role="status"
                    className="flex items-start gap-2 rounded-md border border-c-danger/40 bg-c-danger/10 px-2.5 py-1.5 text-[11px] text-c-danger"
                  >
                    <AlertTriangle size={12} className="mt-px shrink-0" />
                    <span className="flex-1">{aiAnalysisError}</span>
                    {/* PODGLĄD = TYLKO CZYTANIE (2026-07-24): „Ponów" wywołuje
                        `handleAnalyzeWithAI(false)`, które NADPISUJE pięć pól
                        karty. Sam komunikat o błędzie zostaje (to uczciwa
                        informacja, czyste czytanie) — znika tylko przycisk,
                        który by zapisał. */}
                    {!readMode && (
                      <button
                        type="button"
                        onClick={() => handleAnalyzeWithAI(false)}
                        className="shrink-0 underline underline-offset-2 hover:opacity-80"
                      >
                        {t('myWork.notificationDetail.retry', 'Retry')}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* 1) Opis — pole tekstowe standardu n-Type (§6.2/§6.3):
                  auto-fit + ręczny resize z pamięcią + tryb Podgląd. */}
              <AutoFitTextarea
                id="notif-field-description"
                value={descriptionDraft}
                onValueChange={setDescriptionDraft}
                previewMode={readMode}
                minRows={3}
                containerClassName="space-y-1.5"
                label={
                  <span className="text-[11px] uppercase tracking-wide text-c-text-muted">
                    {t('myWork.notificationDetail.description', 'Description')}
                  </span>
                }
                aiSlot={
                  <AIFieldEnhancer
                    fieldKey="notif-description"
                    sectionLabel={t('myWork.notificationDetail.sectionLabel', 'Description')}
                    currentValue={descriptionDraft}
                    onApply={setDescriptionDraft}
                    artifactContext={notifAiContext}
                    iconOnly
                  />
                }
                autoFitLabel={t('common.backToAutoFit', 'Back to auto-fit')}
                className="w-full px-0 py-2 bg-transparent text-sm leading-relaxed text-c-text-secondary focus:outline-none placeholder-c-text-muted"
                editClassName="border-b border-c-border focus:border-c-focus focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)] transition-colors"
                placeholder={t(
                  'myWork.notificationDetail.whatHappenedDescribeThe',
                  'What happened — describe the notification event...'
                )}
              />

              {/* 2) Dlaczego to wazne — pole tekstowe standardu n-Type (§6.2/§6.3). */}
              <AutoFitTextarea
                id="notif-field-why"
                value={whyImportantDraft}
                onValueChange={setWhyImportantDraft}
                previewMode={readMode}
                minRows={2}
                containerClassName="space-y-1.5"
                label={
                  <span className="text-[11px] uppercase tracking-wide text-c-text-muted">
                    {t('myWork.notificationDetail.whyItMatters', 'Why it matters')}
                  </span>
                }
                aiSlot={
                  <AIFieldEnhancer
                    fieldKey="notif-why-important"
                    sectionLabel={t('myWork.notificationDetail.sectionLabel2', 'Why It Matters')}
                    currentValue={whyImportantDraft}
                    onApply={setWhyImportantDraft}
                    artifactContext={notifAiContext}
                    iconOnly
                  />
                }
                autoFitLabel={t('common.backToAutoFit', 'Back to auto-fit')}
                className="w-full px-0 py-2 bg-transparent text-sm leading-relaxed text-c-text-secondary focus:outline-none placeholder-c-text-muted"
                editClassName="border-b border-c-border focus:border-c-focus focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)] transition-colors"
                placeholder={t(
                  'myWork.notificationDetail.explainTheImpactAnd',
                  'Explain the impact and consequences...'
                )}
              />

              {/* 3) Co jest blokowane — pole pelnoprawne (bylo bez AI i tylko
                   gdy niepuste, wiec w praktyce nie do wypelnienia recznie).
                   W Podgladzie puste pole sie nie renderuje (nie pokazujemy
                   klientowi pustego miejsca). */}
              {(!readMode || blockedDraft.trim()) && (
                <AutoFitTextarea
                  id="notif-field-blocked"
                  value={blockedDraft}
                  onValueChange={setBlockedDraft}
                  previewMode={readMode}
                  minRows={2}
                  containerClassName="space-y-1.5"
                  label={
                    <span className="text-[11px] uppercase tracking-wide text-c-text-muted">
                      {t('myWork.notificationDetail.whatIsBlocked', 'What is blocked')}
                    </span>
                  }
                  aiSlot={
                    <AIFieldEnhancer
                      fieldKey="notif-blocked"
                      sectionLabel={t('myWork.notificationDetail.whatIsBlocked', 'What is blocked')}
                      currentValue={blockedDraft}
                      onApply={setBlockedDraft}
                      artifactContext={notifAiContext}
                      iconOnly
                    />
                  }
                  autoFitLabel={t('common.backToAutoFit', 'Back to auto-fit')}
                  className="w-full px-0 py-2 bg-transparent text-sm leading-relaxed text-c-text-secondary focus:outline-none placeholder-c-text-muted"
                  editClassName="border-b border-c-border focus:border-c-focus focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)] transition-colors"
                  placeholder={t(
                    'myWork.notificationDetail.whatIsBlockedBy',
                    'What is blocked by this issue...'
                  )}
                />
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
                <h2 className="text-lg font-semibold text-c-text">
                  {t('myWork.notificationDetail.aIAnalysis', 'AI Analysis')}
                </h2>
                <button
                  onClick={handleAskAI}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-c-info hover:bg-c-info/10 transition-colors"
                >
                  <Sparkles size={13} />
                  {t('myWork.notificationDetail.askAI', 'Ask AI')}
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
                            ? 'bg-c-warning/10 text-c-warning'
                            : aiAnalysis.riskLevel === 'medium'
                              ? 'bg-blue-500/10 text-blue-500'
                              : 'bg-c-surface-raised text-c-text-secondary'
                      }`}
                    >
                      {t('myWork.notificationDetail.priority', 'Priority')}: {aiAnalysis.priority}
                    </span>
                    {aiAnalysis.confidence && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-c-info/10 text-c-info">
                        {t('myWork.notificationDetail.confidence', 'Confidence')}:{' '}
                        {aiAnalysis.confidence}
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
                    <label className="text-[11px] uppercase tracking-wide text-c-text-muted">
                      {t('myWork.notificationDetail.impact', 'Impact')}
                    </label>
                    <p className="text-sm text-c-text-secondary leading-relaxed">
                      {aiAnalysis.impact}
                    </p>
                  </div>

                  {/* Recommendation callout */}
                  <div className="space-y-2">
                    <label className="text-[11px] uppercase tracking-wide text-c-text-muted">
                      {t('myWork.notificationDetail.recommendation', 'Recommendation')}
                    </label>
                    <div className="p-3 rounded-xl bg-c-info/10 border border-c-info/20">
                      <div className="flex items-start gap-2">
                        <Zap size={14} className="text-c-info mt-0.5 shrink-0" />
                        <p className="text-sm text-c-info leading-relaxed">
                          {aiAnalysis.recommendation}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* AI chat CTA */}
                  <button
                    onClick={handleAskAI}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-c-info/10 text-c-info hover:bg-c-info/20 transition-colors text-sm font-medium"
                  >
                    <MessageSquare size={14} />
                    {t('myWork.notificationDetail.askAIForMore', 'Ask AI for more details')}
                  </button>
                </>
              )}

              {!aiAnalysis && (
                <div className="py-10 text-center">
                  <TeresaMark size={28} className="mx-auto mb-2 text-c-text-muted" />
                  <p className="text-sm text-c-text-muted">
                    {t('myWork.notificationDetail.noDataForAnalysis', 'No data for analysis')}
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
              <h2 className="text-lg font-semibold text-c-text">
                {t('myWork.notificationDetail.expectedAction', 'Expected Action')}
              </h2>

              {/* Oczekiwana akcja — pole tekstowe standardu n-Type (§6.2/§6.3). */}
              <AutoFitTextarea
                id="notif-field-expected-action"
                value={expectedActionDraft}
                onValueChange={setExpectedActionDraft}
                previewMode={readMode}
                minRows={2}
                containerClassName="space-y-1.5"
                label={
                  <span className="text-[11px] uppercase tracking-wide text-c-text-muted">
                    {t('myWork.notificationDetail.whatNeedsToBe', 'What needs to be done')}
                  </span>
                }
                aiSlot={
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
                }
                autoFitLabel={t('common.backToAutoFit', 'Back to auto-fit')}
                className="w-full px-0 py-2 bg-transparent text-sm leading-relaxed text-c-text-secondary focus:outline-none placeholder-c-text-muted"
                editClassName="border-b border-c-border focus:border-c-focus focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)] transition-colors"
                placeholder={t('myWork.notificationDetail.placeholder', 'Expected action...')}
              />

              {/* Checklist — label + AI right-aligned, count below */}
              <div className="space-y-2">
                <div className="flex items-center justify-between min-h-[22px]">
                  <label className="text-[11px] uppercase tracking-wide text-c-text-muted">
                    {t('myWork.notificationDetail.checklist', 'Checklist')}
                  </label>
                  {!readMode && (
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
                  )}
                </div>

                {/* Progress bar */}
                {totalCount > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-c-border-subtle overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                        style={{
                          width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <span className="text-[11px] font-medium text-c-text-muted tabular-nums shrink-0">
                      {completedCount}/{totalCount}
                    </span>
                  </div>
                )}

                {/* Checklist items — urgency-aware */}
                {totalCount === 0 ? (
                  <div className="py-8 text-center">
                    <CheckSquare size={24} className="mx-auto mb-2 text-c-text-muted" />
                    <p className="text-xs text-c-text-muted">
                      {readMode
                        ? t('myWork.notificationDetail.noStepsYet', 'No steps yet')
                        : t(
                            'myWork.notificationDetail.noStepsClickAI',
                            'No steps — click AI to generate a checklist'
                          )}
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
                            ? 'border-l-2 border-l-c-border-subtle'
                            : '';
                      const urgencyText =
                        urgency === 'critical' && !done
                          ? 'text-danger-600 dark:text-danger-400 font-medium'
                          : urgency === 'optional' && !done
                            ? 'text-c-text-secondary'
                            : done
                              ? 'line-through text-c-text-muted'
                              : 'text-c-text-secondary';

                      return (
                        <div
                          key={item.id}
                          className={`group flex items-start gap-3 px-3 py-2 rounded-lg transition-all duration-200 ${urgencyBorder} ${
                            done ? 'opacity-50 hover:opacity-70' : 'hover:bg-c-surface-raised'
                          }`}
                        >
                          <button
                            onClick={() => !readMode && toggleChecklistItem(item.id)}
                            disabled={readMode}
                            className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200 disabled:cursor-default ${
                              done
                                ? 'bg-emerald-500 border-emerald-500 text-white'
                                : urgency === 'critical'
                                  ? 'border-danger-300 dark:border-danger-500/50 hover:border-danger-400'
                                  : 'border-c-border hover:border-emerald-400 dark:hover:border-emerald-500'
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
                            className={`text-[11px] font-medium mt-0.5 mr-0.5 tabular-nums select-none ${done ? 'text-c-text-muted' : 'text-c-text-muted'}`}
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
                <h2 className="text-lg font-semibold text-c-text">
                  {t('myWork.notificationDetail.comments', 'Comments')}
                  {comments.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-c-text-muted">
                      ({comments.length})
                    </span>
                  )}
                </h2>
                <button
                  onClick={handleAskAI}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-c-info hover:bg-c-info/10 transition-colors"
                >
                  <Sparkles size={13} />
                  {t('myWork.notificationDetail.aIComment', 'AI comment')}
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
                  placeholder={t(
                    'myWork.notificationDetail.writeACommentCmd',
                    'Write a comment... (Cmd+Enter to send)'
                  )}
                  className="w-full px-3 py-2.5 rounded-xl border border-c-border bg-white/70 dark:bg-c-surface/70 text-sm text-c-text-secondary placeholder-c-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-c-focus/30 focus:border-c-focus transition-all"
                  rows={3}
                />
                <div className="flex justify-end">
                  <button
                    onClick={handleAddComment}
                    disabled={!newCommentText.trim() || submittingComment}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-c-text text-c-bg hover:bg-c-text-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {submittingComment ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <MessageSquare size={12} />
                    )}
                    {t('myWork.notificationDetail.add', 'Add')}
                  </button>
                </div>
              </div>

              {/* Comments list */}
              {commentsLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 size={20} className="animate-spin text-c-text-muted" />
                </div>
              ) : comments.length === 0 ? (
                <div className="py-10 text-center">
                  <MessageCircle size={28} className="mx-auto mb-2 text-c-text-muted" />
                  <p className="text-sm text-c-text-muted mb-4">
                    {t('myWork.notificationDetail.noCommentsYet', 'No comments yet')}
                  </p>
                  <button
                    onClick={handleOpenChat}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-c-info/30 text-c-info hover:border-c-info/50 hover:bg-c-info/5 transition-colors text-sm font-medium"
                  >
                    <MessageSquare size={14} />
                    {t('myWork.notificationDetail.openContextualChat', 'Open contextual chat')}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {comments.map((comment) => (
                    <div
                      key={comment.id}
                      className="group px-4 py-3 rounded-xl border border-c-border hover:border-c-border-strong transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        {/* Avatar */}
                        <div className="w-7 h-7 rounded-full bg-c-info/20 text-c-info flex items-center justify-center text-xs font-bold shrink-0">
                          {(comment.user?.firstName || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          {/* Header row */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-c-text-secondary">
                                {comment.user?.firstName} {comment.user?.lastName}
                              </span>
                              <span className="text-[10px] text-c-text-muted">
                                {formatDate(comment.createdAt)}
                              </span>
                            </div>
                            <button
                              onClick={() => handleDeleteComment(comment.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-danger-50 dark:hover:bg-danger-500/10 transition-all"
                              title={t('myWork.notificationDetail.title2', 'Delete')}
                            >
                              <Trash2 size={12} className="text-danger-400" />
                            </button>
                          </div>
                          {/* Body */}
                          <p className="text-sm text-c-text-secondary leading-relaxed mt-1 whitespace-pre-wrap">
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
            icon: <Bell size={14} className="text-c-text-muted" />,
            bg: 'bg-c-surface-raised',
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
              description: t('myWork.notificationDetail.description2', 'Notification created'),
              timestamp: notification.createdAt,
              icon: <Bell size={14} className="text-c-text-muted" />,
              iconBg: 'bg-c-surface-raised',
            });
            if (notification.readAt) {
              fallbackEntries.push({
                id: 'read',
                description: t('myWork.notificationDetail.description3', 'Marked as read'),
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
                <h2 className="text-lg font-semibold text-c-text">
                  {t('myWork.notificationDetail.activityLog', 'Activity Log')}
                  {allEntries.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-c-text-muted">
                      ({allEntries.length})
                    </span>
                  )}
                </h2>
                <button
                  onClick={loadActivityLog}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-c-text-muted hover:text-c-text-secondary hover:bg-c-surface-raised transition-colors"
                >
                  <History size={13} />
                  {t('myWork.notificationDetail.refresh', 'Refresh')}
                </button>
              </div>

              {/* Stat cards — compact */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-c-border bg-white/70 dark:bg-c-surface/70 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-c-text-muted">
                    {t('myWork.notificationDetail.entries', 'Entries')}
                  </p>
                  <p className="text-sm font-semibold text-c-text-secondary">{allEntries.length}</p>
                </div>
                <div className="rounded-xl border border-c-border bg-white/70 dark:bg-c-surface/70 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-c-text-muted">
                    {t('myWork.notificationDetail.comments2', 'Comments')}
                  </p>
                  <p className="text-sm font-semibold text-c-text-secondary">{comments.length}</p>
                </div>
                <div className="rounded-xl border border-c-border bg-white/70 dark:bg-c-surface/70 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-c-text-muted">
                    {t('myWork.notificationDetail.status', 'Status')}
                  </p>
                  <p className="text-sm font-semibold text-c-text-secondary">
                    {isSnoozed
                      ? t('myWork.notificationDetail.snoozed', 'Snoozed')
                      : notification.isRead
                        ? t('myWork.notificationDetail.read', 'Read')
                        : t('myWork.notificationDetail.new', 'New')}
                  </p>
                </div>
              </div>

              {/* Activity feed */}
              {activityLogLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 size={20} className="animate-spin text-c-text-muted" />
                </div>
              ) : allEntries.length === 0 ? (
                <div className="py-10 text-center">
                  <History size={28} className="mx-auto mb-2 text-c-text-muted" />
                  <p className="text-sm text-c-text-muted">
                    {t('myWork.notificationDetail.noActivityYet', 'No activity yet')}
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
                        <p className="text-sm text-c-text-secondary">{entry.description}</p>
                        <p className="text-xs text-c-text-muted">{formatDate(entry.timestamp)}</p>
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
    // ETAP 2.1 — pola opisowe centrum + tryb Podglad. Bez tych zaleznosci memo
    // zwracalo stary komponent i pole „zamarzalo" na pierwszej wartosci.
    readMode,
    descriptionDraft,
    whyImportantDraft,
    blockedDraft,
    isAnalyzingWorksheet,
    /* + widoczny stan bledu AI (2026-07-23) — bez tego banner „AI niedostepne" nigdy sie nie pokaze */
    aiAnalysisError,
    handleAnalyzeWithAI,
    /* + t: tlumaczenia ladowane async — bez tego memo zwraca surowy klucz na stale (2026-07-21) */ t,
  ]);

  // ── MIGRACJA (D-8): layout kart lewej nawigacji z WIĄŻĄCEGO kontraktu karty ──
  // Za flagą (default OFF). Gdy ON: katalog + zestawy płyną z NOTIFICATION_CARD_SPEC
  // (rdzeń nieusuwalny przez typ, węższy zestaw domyślny, picker „Sekcje"/„+ Nowa
  // karta"). Gdy OFF: applyToSections/manager nie są używane ⇒ zachowanie bez zmian.
  const notificationCardContractEnabled = useNotificationCardContractEnabled();
  // Osobny namespace klucza (v2-contract) — węższy domyślny nie hydratuje się nad
  // stary układ, a wyłączenie flagi wraca do dawnej ścieżki bez utraty stanu.
  const notificationCardLayoutStorageKey = `notification:nmode:card-layout:v2-contract:${notificationId ?? 'new'}`;
  const initialNotificationCardLayout = useMemo<CardLayout | null>(() => {
    if (!notificationCardContractEnabled) return null;
    try {
      const raw = localStorage.getItem(notificationCardLayoutStorageKey);
      if (!raw) return null;
      // ★ 2026-07-23 — WALIDACJA KSZTALTU (wzorzec: TaskDetailView.tsx).
      // Bylo: `JSON.parse(raw) as CardLayout` — samo rzutowanie, zero kontroli.
      // Skazony wpis (np. tablica stringow z innej wersji/rozszerzenia) przechodzil
      // przez `.length > 0`, a `applyToSections` wycinalo WSZYSTKIE sekcje =>
      // pusty ekran bez zadnego bledu. Teraz wpis nie-pasujacy do kontraktu jest
      // odrzucany i karta wraca do domyslnego ukladu.
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return null;
      const cleaned = parsed.filter(
        (c: unknown): c is { id: string; visible: boolean; order: number } =>
          !!c &&
          typeof (c as { id?: unknown }).id === 'string' &&
          typeof (c as { visible?: unknown }).visible === 'boolean' &&
          typeof (c as { order?: unknown }).order === 'number'
      );
      return cleaned.length > 0 ? cleaned : null;
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notificationCardLayoutStorageKey, notificationCardContractEnabled]);
  const persistNotificationCardLayout = useCallback(
    (next: CardLayout) => {
      if (!notificationCardContractEnabled) return;
      try {
        localStorage.setItem(notificationCardLayoutStorageKey, JSON.stringify(next));
      } catch {
        /* localStorage niedostępny — layout pozostaje w pamięci sesji */
      }
    },
    [notificationCardLayoutStorageKey, notificationCardContractEnabled]
  );

  const notificationCardLayout = useCardLayout({
    // INERTNE gdy `spec` podany (patrz NOTIFICATION_ARTIFACT_TYPE wyżej).
    artifactType: NOTIFICATION_ARTIFACT_TYPE,
    spec: NOTIFICATION_CARD_SPEC,
    initialLayout: initialNotificationCardLayout,
    onLayoutChange: persistNotificationCardLayout,
  });

  // Sekcje przekazywane do LeftNav/Canvas: gdy flaga ON, filtruj+porządkuj przez
  // layout (węższy domyślny; `ai-analysis` dodawalne z pickera); gdy OFF, surowe.
  const orderedNModeSections = useMemo<NModeSection[]>(
    () =>
      notificationCardContractEnabled
        ? notificationCardLayout.applyToSections(nModeSectionsWithContent)
        : nModeSectionsWithContent,
    [notificationCardContractEnabled, notificationCardLayout, nModeSectionsWithContent]
  );

  // Gdy flaga ON i aktywna sekcja została ukryta w pickerze — przeskocz na pierwszą widoczną.
  useEffect(() => {
    if (!notificationCardContractEnabled) return;
    const visibleIds = notificationCardLayout.visibleOrderedIds;
    if (visibleIds.length > 0 && !visibleIds.includes(activeNSection)) {
      setActiveNSection(visibleIds[0]);
    }
  }, [notificationCardContractEnabled, notificationCardLayout.visibleOrderedIds, activeNSection]);

  // R2 (KONTRAKT §9): każda sekcja nav renderowana przez Notification ma wpis w
  // katalogu kanonicznym. Cichy dev-only sygnał rozjazdu id kod↔katalog.
  useEffect(() => {
    if (!import.meta.env.DEV || !notificationCardContractEnabled) return;
    const missing = nModeSections
      .map((s) => s.id)
      .filter((id) => !NOTIFICATION_CARD_RENDER_IDS.includes(id));
    if (missing.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        '[notificationCardContract] sekcje lewej nawigacji bez wpisu w katalogu:',
        missing
      );
    }
  }, [notificationCardContractEnabled, nModeSections]);

  // ── ETAP 3 standardu n-Type: „Analizuj z AI" AKTYWNEJ KARTY ────────────────
  // Kontrakt właściciela dla Powiadomienia: „treść aktywnej karty względem jej
  // celu — braki, ryzyka, proponowane poprawki". Cel karty i standard treści
  // silnik czyta z kanonu (NOTIFICATION_CARDS); tu deklarujemy tylko ZAWARTOŚĆ
  // aktywnej karty i to, gdzie wolno zapisać.
  //
  // ★ ZMIANA ZACHOWANIA PRZYCISKU (świadoma): dotąd „Analizuj z AI" wołało
  //   `handleAnalyzeWithAI(false)`, które NADPISYWAŁO pięć pól bez pytania —
  //   dokładnie to, czego kontrakt zabrania („AI NIE nadpisuje treści bez
  //   potwierdzenia"). Generator zostaje żywy jako auto-uzupełnienie pustego
  //   arkusza przy wczytaniu (efekt wyżej), przycisk przechodzi na ANALIZĘ.
  const notificationAnalysisFields = useMemo<CardAnalysisField[]>(() => {
    switch (activeNSection) {
      case 'whats-happening':
        return [
          {
            id: 'description',
            label: isPolish ? 'Co się wydarzyło' : 'What happened',
            value: descriptionDraft,
            kind: 'text',
            writable: true,
          },
          {
            id: 'whyImportant',
            label: isPolish ? 'Dlaczego to ważne' : 'Why it matters',
            value: whyImportantDraft,
            kind: 'text',
            writable: true,
          },
          {
            id: 'blocked',
            label: isPolish ? 'Co jest zablokowane' : 'What is blocked',
            value: blockedDraft,
            kind: 'text',
            writable: true,
          },
        ];

      case 'expected-action':
        return [
          {
            id: 'expectedAction',
            label: isPolish ? 'Co należy zrobić' : 'What needs to be done',
            value: expectedActionDraft,
            kind: 'text',
            writable: true,
          },
          {
            id: 'checklist',
            label: isPolish ? 'Lista kontrolna' : 'Checklist',
            value: actionChecklist
              .map((i) => `${i.completed ? '[x]' : '[ ]'} ${String(i.text || '').trim()}`)
              .join('\n'),
            kind: 'list',
            writable: true,
          },
        ];

      case 'ai-analysis':
        // Karta czyta `notification.data` (ryzyko/rekomendacja/pewność) — to są
        // FAKTY przysłane przez system, nie pole edytowalne. Deklarujemy je jako
        // kontekst tylko-do-odczytu: AI może wskazać braki i ryzyka, ale panel
        // nie da „Zastosuj", bo nie ma dokąd zapisać. Uczciwiej niż udawać zapis.
        return [
          {
            id: 'ai-analysis-readonly',
            label: isPolish ? 'Analiza AI (dane systemowe)' : 'AI analysis (system data)',
            value: JSON.stringify(notification?.data ?? {}, null, 2),
            kind: 'text',
            writable: false,
          },
        ];

      default:
        return [];
    }
  }, [
    activeNSection,
    isPolish,
    descriptionDraft,
    whyImportantDraft,
    blockedDraft,
    expectedActionDraft,
    actionChecklist,
    notification?.data,
  ]);

  const notificationWritableFieldIds = useMemo(
    () => notificationAnalysisFields.filter((f) => f.writable).map((f) => f.id),
    [notificationAnalysisFields]
  );

  const buildNotificationAnalysisInput = useCallback(() => {
    const ctx = [
      `${isPolish ? 'Typ' : 'Type'}: ${notification?.type ?? '—'}`,
      `${isPolish ? 'Waga' : 'Severity'}: ${notification?.severity ?? '—'}`,
      `${isPolish ? 'Kategoria' : 'Category'}: ${notification?.category ?? '—'}`,
      `${isPolish ? 'Wiadomość' : 'Message'}: ${notification?.message ?? '—'}`,
      notification?.projectName
        ? `${isPolish ? 'Projekt' : 'Project'}: ${notification.projectName}`
        : '',
      sourceEntity?.title
        ? `${isPolish ? 'Źródło' : 'Source'}: ${sourceEntity.type ?? ''} — ${sourceEntity.title}`
        : '',
      // Pozostałe karty jako kontekst — po to, żeby AI wykryło NIESPÓJNOŚĆ
      // między kartami, a nie tylko brak w jednej.
      activeNSection !== 'whats-happening'
        ? `${isPolish ? 'Karta „Co się dzieje"' : 'Card "What is happening"'}: ${descriptionDraft} | ${whyImportantDraft} | ${blockedDraft}`
        : '',
      activeNSection !== 'expected-action'
        ? `${isPolish ? 'Karta „Oczekiwana akcja"' : 'Card "Expected action"'}: ${expectedActionDraft}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    return {
      artifactType: 'notification' as const,
      cardId: activeNSection,
      artifactTitle: notification?.title ?? '',
      artifactContext: ctx,
      fields: notificationAnalysisFields,
      isPolish,
    };
  }, [
    activeNSection,
    isPolish,
    notification,
    sourceEntity,
    descriptionDraft,
    whyImportantDraft,
    blockedDraft,
    expectedActionDraft,
    notificationAnalysisFields,
  ]);

  const applyNotificationAnalysisChange = useCallback(
    (change: CardAnalysisChange): boolean => {
      // Tryb Podglądu = zero zapisu (panel też blokuje przycisk; to drugi zamek).
      if (readMode) return false;

      switch (change.fieldId) {
        case 'description':
          setDescriptionDraft((prev) => mergeChangeValue(change, prev));
          return true;
        case 'whyImportant':
          setWhyImportantDraft((prev) => mergeChangeValue(change, prev));
          return true;
        case 'blocked':
          setBlockedDraft((prev) => mergeChangeValue(change, prev));
          return true;
        case 'expectedAction':
          setExpectedActionDraft((prev) => mergeChangeValue(change, prev));
          return true;
        case 'checklist': {
          // `applyChecklistFromAIText` PODMIENIA całą listę, więc dla trybu
          // „append" scalamy ręcznie z bieżącą listą — inaczej dopisanie jednej
          // pozycji skasowałoby resztę (i odhaczenia).
          const current = actionChecklist
            .map((i) => `${i.completed ? '[x]' : '[ ]'} ${String(i.text || '').trim()}`)
            .join('\n');
          const merged = mergeChangeValue(change, current);
          applyChecklistFromAIText(merged);
          return true;
        }
        default:
          // Nieznane pole — NIE zgadujemy celu. Panel pokaże „nie udało się".
          return false;
      }
    },
    [readMode, actionChecklist, applyChecklistFromAIText]
  );

  const notificationCardAnalysis = useCardAIAnalysis({
    activeCardId: activeNSection,
    buildInput: buildNotificationAnalysisInput,
    applyChange: applyNotificationAnalysisChange,
  });

  // ── Loading / 404 guards (AFTER all hooks to respect Rules of Hooks) ────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-white dark:bg-c-bg">
        <LoadingState variant="spinner" />
      </div>
    );
  }

  if (!notification || !contract) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-c-text-muted bg-white dark:bg-c-bg">
        <Bell size={48} className="mb-4 opacity-50" />
        <p>{t('myWork.notificationDetail.notificationNotFound', 'Notification not found')}</p>
        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 rounded-lg bg-c-surface-raised text-c-text-secondary dark:text-white hover:bg-c-surface-raised transition-colors"
        >
          {t('myWork.notificationDetail.goBack', 'Go Back')}
        </button>
      </div>
    );
  }

  // ── N-mode properties strip fields (after guards — notification is guaranteed) ──

  const propertiesFields: NModePropertyField[] = [
    // ETAP 2.1 — KOLEJNOSC KANONICZNA tabeli Wlasciwosci karty n-Type:
    // Status · Priorytet/Waga · Zrodlo · Typ powiadomienia · Termin/data ·
    // Wlasciciel (gdy wystepuje). „Projekt" zszedl do sekcji Powiazania (to
    // relacja, nie wlasciwosc); „Kategoria" zostaje jako uszczegolowienie typu.
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
            ? t('myWork.notificationDetail.snoozed2', 'Snoozed')
            : notification.isRead
              ? t('myWork.notificationDetail.read2', 'Read')
              : t('myWork.notificationDetail.unread', 'Unread')}
        </div>
      ),
    },
    {
      id: 'severity',
      label: { en: 'Priority', pl: 'Priorytet' },
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
      id: 'source',
      label: { en: 'Source', pl: 'Źródło' },
      type: 'custom' as const,
      value: notifCreator.label,
      onChange: () => {},
      readOnly: true,
      render: () => {
        const CreatorIcon = notifCreator.icon;
        return (
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-c-surface-raised border border-c-border text-c-text-secondary">
            <CreatorIcon size={12} className="text-c-text-muted" />
            <span className="truncate">{notifCreator.label}</span>
          </div>
        );
      },
    },
    {
      id: 'type',
      label: { en: 'Notification type', pl: 'Typ powiadomienia' },
      type: 'custom' as const,
      value: notification.type,
      onChange: () => {},
      readOnly: true,
      render: () => (
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-c-surface-raised border border-c-border text-c-text-secondary">
          <TypeIcon size={12} className={typeConfig.color} />
          {/* Było: `notification.type.replace(/_/g,' ')` → „AI RISK DETECTED".
              To surowy enum bazy, a nie język produktu (2026-07-24). */}
          <span className="truncate">{notificationTypeLabel(notification.type, isPolish)}</span>
        </div>
      ),
    },
    {
      id: 'category',
      label: { en: 'Category', pl: 'Kategoria' },
      type: 'text' as const,
      // Było: gołe `ai` / `task` / `pmo` wprost z kolumny bazy.
      value: notificationCategoryLabel(notification.category, isPolish),
      onChange: () => {},
      readOnly: true,
    },
    {
      id: 'created',
      label: { en: 'Date', pl: 'Data' },
      type: 'text' as const,
      value: formatDate(notification.createdAt),
      onChange: () => {},
      readOnly: true,
    },
    // Wlasciciel — TYLKO gdy dane go niosa. Powiadomienie systemowe wlasciciela
    // nie ma; pusty wiersz „Wlasciciel: —" bylby ceremonia, nie informacja.
    ...((notification.data as any)?.ownerName || (notification.data as any)?.createdByName
      ? [
          {
            id: 'owner',
            label: { en: 'Owner', pl: 'Właściciel' },
            type: 'text' as const,
            value: String(
              (notification.data as any)?.ownerName ||
                (notification.data as any)?.createdByName ||
                ''
            ),
            onChange: () => {},
            readOnly: true,
          } as NModePropertyField,
        ]
      : []),
  ];

  // ── SPEC-N §2.3 — DOKLADNIE JEDEN primary, i to w Menu 1 ────────────────────
  // Karta miala ZERO primary: cztery warianty CTA zrodla renderowaly sie w pasku
  // akcji jako zwykle outline'y, rownorzednie z "Wycisz" czy "Zapisz jako notatke".
  // Regula wyboru wg pakietu M2 pkt 3: jest zrodlo → "Otworz <zrodlo>"; brak
  // zrodla → "Oznacz przeczytane". Slot primary jest JEDYNYM miejscem solid-CTA
  // (klasa MENU_1_PRIMARY_CTA w NModeHeader), wiec akcja promowana tutaj NIE
  // renderuje sie juz drugi raz w pasku akcji (§2.6 anty-duplikacja).
  const hasSourceCta = contract.primaryCta.kind !== 'none';

  const openPrimarySource = () => {
    const cta = contract.primaryCta;
    switch (cta.kind) {
      case 'open_task':
        onNavigateToSource?.('task', cta.id);
        break;
      case 'open_decision':
        onNavigateToSource?.('decision', cta.id);
        break;
      case 'open_project':
        onNavigateToSource?.('project', cta.id);
        break;
      case 'open_link':
        window.open(cta.href, '_blank', 'noopener,noreferrer');
        break;
      default:
        break;
    }
  };

  const primarySourceIcon = (
    contract.primaryCta.kind === 'open_task'
      ? CheckSquare
      : contract.primaryCta.kind === 'open_decision'
        ? Scale
        : contract.primaryCta.kind === 'open_project'
          ? FolderOpen
          : ExternalLink
  ) as React.FC<{ size?: number; className?: string }>;

  // SPEC-N §2.8 — skrot musi byc odkrywalny. `M`/`D` mialy ZERO podpowiedzi na
  // ekranie; `D` kasowal powiadomienie. Po ETAPIE 2.1 badge `M` renderuje sie
  // przy akcji „Oznacz przeczytane" w sekcji AKCJE prawego panelu, a badge `D`
  // przy pozycji „Usun" w menu `⋮`; ponizszy tooltip dubluje `D` dla czytnika
  // ekranu. (Tooltip `M` zniknal razem z paskowym przyciskiem — badge zostal.)
  const deleteShortcutTitle = isPolish
    ? 'Usuń powiadomienie (skrót: D — zapyta o potwierdzenie)'
    : 'Delete notification (shortcut: D — asks for confirmation)';

  // PODGLĄD = TYLKO CZYTANIE (2026-07-24). Rozgraniczenie w tym slocie:
  //   · „Otwórz źródło/dokument" = NAWIGACJA do powiązanego obiektu, niczego
  //     nie zapisuje → ZOSTAJE także w Podglądzie (jak „Kopiuj link" w kebabie);
  //   · „Oznacz jako przeczytane" = ZAPIS `isRead` na rekordzie → w Podglądzie
  //     znika (ten sam handler zniknął też z sekcji „Akcje" panelu).
  const headerPrimaryAction = hasSourceCta
    ? {
        label: {
          en: contract.primaryCta.label || 'Open source',
          pl: contract.primaryCta.label || 'Otwórz źródło',
        },
        icon: primarySourceIcon,
        onClick: openPrimarySource,
      }
    : readMode
      ? undefined
      : {
          // Osobny klucz od paskowego `markRead` ("Przeczytane" w pl to status,
          // nie czasownik — slot primary musi mowic, co sie stanie po kliknieciu).
          label: {
            en: t('myWork.notificationDetail.primaryMarkRead', 'Mark as read'),
            pl: t('myWork.notificationDetail.primaryMarkRead', 'Mark as read'),
          },
          icon: MailOpen as React.FC<{ size?: number; className?: string }>,
          onClick: handleMarkRead,
          disabled: notification.isRead,
          title: {
            en: 'Mark as read (shortcut: M)',
            pl: 'Oznacz jako przeczytane (skrót: M)',
          },
        };

  // ── SPEC-N §2.2 — prawy panel (wariant SKROCONY wg decyzji K2) ──────────────
  // Wlasciwosci + Historia. BEZ Komentarzy (wiadomosc systemowa nie jest
  // artefaktem wspolpracy — sekcja skasowana, nie przeniesiona) i BEZ Powiazan
  // (powiadomienie nie ma realnych relacji; zrodlo pokazuje sekcja "Co sie dzieje").
  //
  // Odstepstwo od §2.2 ("wszystko zwiniete poza Akcjami") swiadome i nazwane:
  // ten wariant nie ma sekcji Akcje (akcje zyja w pasku i w Menu 1), wiec przy
  // domyslnym zwinieciu wszystkiego panel bylby po otwarciu pusty. Otwarte
  // startowo sa Wlasciwosci; Historia zwinieta.
  const historyEntries: {
    id: string;
    description: string;
    timestamp: string;
  }[] =
    activityLog.length > 0
      ? activityLog.map((entry) => ({
          id: entry.id,
          description: entry.userName
            ? `${entry.userName}: ${entry.description}`
            : entry.description,
          timestamp: entry.createdAt,
        }))
      : [
          {
            id: 'created',
            description: t('myWork.notificationDetail.description2', 'Notification created'),
            timestamp: notification.createdAt,
          },
          ...(notification.readAt
            ? [
                {
                  id: 'read',
                  description: t('myWork.notificationDetail.description3', 'Marked as read'),
                  timestamp: notification.readAt,
                },
              ]
            : []),
        ];

  // ── Menu trzech kropek Menu 1 (standard n-Type §3.5) ─────────────────────
  // Dzialania TECHNICZNE i ADMINISTRACYJNE artefaktu. „Usun" na koncu, jako
  // destrukcyjne (separator + ton c-danger rysuje powloka). Karta NIE rysuje
  // juz wlasnego drugiego kebaba w pasku pod naglowkiem.
  //
  // PODGLĄD = TYLKO CZYTANIE (decyzja właściciela 2026-07-24): wszystkie trzy
  // pozycje ZMIENIAJĄ STAN („Wycisz to" / „Wycisz podobne" zapisują regułę
  // wyciszenia, „Usuń" kasuje rekord), więc w Podglądzie kebab zostaje z samym
  // czytaniem, które dokłada powłoka („Skopiuj kod obiektu" / „Kopiuj link").
  const headerOverflowItems = readMode
    ? []
    : [
        {
          id: 'mute-this',
          label: t('myWork.notificationDetail.muteThis', 'Mute this'),
          icon: BellOff as React.FC<{ size?: number; className?: string }>,
          onClick: () => void handleMuteThis(),
        },
        {
          id: 'mute-similar',
          label: t('myWork.notificationDetail.muteSimilarType', 'Mute similar (type)'),
          icon: BellOff as React.FC<{ size?: number; className?: string }>,
          onClick: () => void handleMuteSimilar(),
        },
        {
          id: 'delete',
          label: t('myWork.notificationDetail.delete', 'Delete'),
          icon: Trash2 as React.FC<{ size?: number; className?: string }>,
          onClick: () => void handleDelete(),
          title: deleteShortcutTitle,
          danger: true,
        },
      ];

  // Zrodla i zalozenia — dlaczego ta karta w ogole powstala. Tresc: „Dlaczego
  // to dostales" (regula silnika) + linia kontekstu z kontraktu. Oba wyszly
  // z centrum (byly amber-calloutem i wierszem w „Wynika z").
  const notifWhyYouGotIt =
    contract.whyYouGotIt || String((notification.data as any)?.whyYouGotIt || '');
  const notifContextLine = contract.contextLine || '';
  const hasSourcesSection = Boolean(notifWhyYouGotIt || notifContextLine);

  // ── Sekcja AKCJE (ETAP 2.1) ────────────────────────────────────────────────
  // Wymaganie wlasciciela: „Przeczytane" i „Odloz" zjezdzaja z naglowka do
  // prawego panelu — pionowo, pelna szerokosc, glowna wyrozniona. „Usun" idzie
  // do menu trzech kropek (dzialanie destrukcyjne), a w naglowku zostaje JEDNA
  // rekomendowana akcja (slot primary `NModeHeader.primaryAction`).
  //
  // Anty-duplikacja (§2.6): gdy powiadomienie NIE ma zrodla, slotem primary w
  // naglowku jest wlasnie „Oznacz przeczytane" — wtedy panel go NIE powtarza.
  // Wyrozniona (`colorScheme:'primary'` = neutralny wysoki kontrast, nigdy
  // crimson) jest zawsze PIERWSZA akcja na liscie.
  const showMarkReadInPanel = hasSourceCta;
  const panelActionButtons = [
    ...(showMarkReadInPanel
      ? [
          {
            label: t('myWork.notificationDetail.primaryMarkRead', 'Mark as read'),
            icon: MailOpen,
            colorScheme: 'primary' as const,
            onClick: handleMarkRead,
            disabled: notification.isRead,
            shortcut: 'M',
          },
        ]
      : []),
    {
      label: isSnoozed
        ? t('myWork.notificationDetail.snoozed3', 'Snoozed')
        : t('myWork.notificationDetail.snooze', 'Snooze'),
      icon: Clock,
      colorScheme: (showMarkReadInPanel ? 'neutral' : 'primary') as 'neutral' | 'primary',
      onClick: () => setShowSnoozeMenu((v) => !v),
    },
  ];

  const rightPanelSections: ArtifactRightPanelSection[] = [
    // KOLEJNOSC KANONICZNA (standard n-Type §7.2): Akcje → Wlasciwosci →
    // Powiazania → Zrodla i zalozenia → Rezultaty → [Komentarze] → Historia.
    // Domyslnie rozwiniete TYLKO Akcje i Wlasciwosci (§8).
    //   • „Komentarze" — sekcja skasowana wczesniejsza decyzja wlasciciela K2
    //     („wiadomosc systemowa nie jest artefaktem wspolpracy"). Standard
    //     n-Type §7.8 ja przewiduje → KOLIZJA DWOCH USTALEN. NIE wskrzeszam
    //     jej samowolnie; zgloszone do decyzji w raporcie ETAPU 2.1.
    {
      id: 'actions',
      label: t('myWork.notificationDetail.panelActions', 'Actions'),
      icon: Zap,
      // ── PODGLĄD = TYLKO CZYTANIE (decyzja właściciela 2026-07-24) ──
      // „Oznacz przeczytane" zapisuje `isRead`, „Odłóż" zapisuje `snoozedUntil`
      // — obie zmieniają stan rekordu. Sekcja pustoszeje dokładnie tak jak
      // w Zadaniu i Decyzji. Etap 4 gridu n-Type
      // (_GRID_STABILIZATION_COMMAND_2026-07-24.md): w Podglądzie sekcja jest
      // ZWINIĘTA z licznikiem 0, bez komunikatu opisowego (był tu tekst
      // „Actions are hidden in preview mode" — SSOT go zakazuje wprost).
      defaultOpen: !readMode,
      isEmpty: readMode,
      badge: readMode ? 0 : undefined,
      showZeroBadge: true,
      children: readMode ? null : (
        // stopPropagation: globalny `click` na window zamyka rozwiniete presety
        // odlozenia (patrz `handleClickOutside`). Bez tego kliknięcie „Odloz"
        // otwieraloby i natychmiast zamykalo liste.
        <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
          {/* Pionowo, pelna szerokosc: kazdy przycisk w osobnym wierszu. */}
          <PreviewActionBar rows={panelActionButtons.map((b) => ({ buttons: [b] }))} />

          {/* Presety odlozenia — rozwijane pod „Odloz", bez dropdownu
              nachodzacego na waski panel. */}
          {showSnoozeMenu && (
            <div className="space-y-1.5 rounded-lg border border-c-border-subtle bg-c-surface p-2">
              {[
                { preset: '1h', label: t('myWork.notificationDetail.label', '1 hour') },
                { preset: '4h', label: t('myWork.notificationDetail.label2', '4 hours') },
                { preset: '1d', label: t('myWork.notificationDetail.label3', '1 day') },
                { preset: '3d', label: t('myWork.notificationDetail.label4', '3 days') },
              ].map((option) => (
                <button
                  key={option.preset}
                  onClick={() => handleSnooze(option.preset)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-c-text-secondary hover:bg-c-surface-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                >
                  <Clock size={12} className="shrink-0 text-c-text-muted" />
                  {option.label}
                </button>
              ))}
              {isSnoozed && snoozedUntil && (
                <p className="px-2 pt-1 text-[10px] text-c-text-muted border-t border-c-border-subtle">
                  {t('myWork.notificationDetail.snoozedUntil', 'Snoozed until')}:{' '}
                  {new Date(snoozedUntil).toLocaleString(
                    t('myWork.notificationDetail.toLocaleString', 'en-US')
                  )}
                </p>
              )}
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'properties',
      label: t('myWork.notificationDetail.panelProperties', 'Properties'),
      icon: Info,
      defaultOpen: true,
      children: (
        // Tabela Wlasciwosc/Wartosc — wspolny komponent ArtifactPropertiesTable,
        // ten sam ksztalt co Task/Decision/Insight (wzorzec wskazany przez
        // wlasciciela 2026-07-21, standaryzacja 2026-07-22). Wiersze deklarujemy
        // z `propertiesFields` (render() zachowuje pigulki Typ/Priorytet/Status).
        <ArtifactPropertiesTable
          propertyLabel={t('myWork.notificationDetail.property', 'Property')}
          valueLabel={t('myWork.notificationDetail.value', 'Value')}
          rows={propertiesFields.map((field) => ({
            id: field.id,
            label: isPolish ? field.label.pl : field.label.en,
            value: field.render ? field.render() : field.value || '—',
            mono: field.id === 'created',
          }))}
        />
      ),
    },
    {
      id: 'relations',
      label: t('myWork.notificationDetail.panelRelations', 'Relations'),
      icon: Link2,
      defaultOpen: false,
      badge: notifRelationItems.length,
      isEmpty: notifRelationItems.length === 0,
      emptyLabel: t(
        'myWork.notificationDetail.noLinkedSourceSystem',
        'No linked source — system notification'
      ),
      children: (
        <div className="space-y-1.5">
          {notifRelationItems.map((item) => {
            const isClickable = Boolean(onNavigateToSource);
            const itemType = item.type.toLowerCase();
            return (
              <div
                key={item.id}
                className={`group flex flex-col gap-1 rounded-md px-1 py-1 -mx-1 transition-colors ${
                  isClickable ? 'hover:bg-c-surface-raised cursor-pointer' : ''
                }`}
                onClick={isClickable ? () => onNavigateToSource!(itemType, item.id) : undefined}
                role={isClickable ? 'button' : undefined}
                tabIndex={isClickable ? 0 : undefined}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium border border-c-border text-c-text-muted bg-c-surface-raised shrink-0">
                    {linkedTypeLabel(item.type, isPolish)}
                  </span>
                  {item.title ? (
                    <span className="truncate text-xs text-c-text">{item.title}</span>
                  ) : null}
                </div>
                {/* Wiersz DRUKOWAŁ surowy identyfikator („decision-dbr77-demo-1")
                    tylko po to, żeby dało się go skopiować. Funkcja zostaje —
                    znika WYPISANY na ekranie identyfikator deweloperski
                    (2026-07-24). */}
                <button
                  className="self-start inline-flex items-center gap-1 text-[10px] text-c-text-muted hover:text-c-info transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(item.id);
                    toast.success(t('myWork.notificationDetail.toastSuccess9', 'ID copied'));
                  }}
                  title={t('myWork.notificationDetail.title', 'Copy ID')}
                >
                  <Copy size={10} />
                  {t('myWork.notificationDetail.title', 'Copy ID')}
                </button>
              </div>
            );
          })}
        </div>
      ),
    },
    {
      id: 'sources',
      label: t('myWork.notificationDetail.panelSources', 'Sources & assumptions'),
      icon: BookOpen,
      defaultOpen: false,
      isEmpty: !hasSourcesSection,
      emptyLabel: t('myWork.notificationDetail.noSources', 'No source information'),
      children: (
        <div className="space-y-3">
          {notifWhyYouGotIt && (
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-wide text-c-text-muted">
                {t('myWork.notificationDetail.whyYouGotIt', 'Why you got it')}
              </p>
              <p className="text-xs leading-relaxed text-c-text-secondary">{notifWhyYouGotIt}</p>
            </div>
          )}
          {notifContextLine && (
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-wide text-c-text-muted">
                {t('myWork.notificationDetail.type2', 'Context')}
              </p>
              <p className="text-xs leading-relaxed text-c-text-secondary">{notifContextLine}</p>
            </div>
          )}
        </div>
      ),
    },
    {
      // REZULTATY (§7.7) — sekcja warunkowa: „dzialania wynikowe", ktore
      // TWORZA lub WYSYLAJA efekt artefaktu (w odroznieniu od Akcji, ktore
      // zmieniaja jego stan). Powiadomienie ma dokladnie jedno takie dzialanie:
      // „Zapisz jako notatke" = utworz kolejny artefakt. Nic wiecej NIE
      // dopisuje — czego dane nie niosa, tego nie wymyslam.
      id: 'results',
      label: t('myWork.notificationDetail.panelResults', 'Results'),
      icon: FileText,
      defaultOpen: false,
      // PODGLĄD = TYLKO CZYTANIE (2026-07-24): „Zapisz jako notatkę" TWORZY
      // nowy artefakt — to nie jest wyjątek od reguły tylko dlatego, że siedzi
      // w „Rezultatach" zamiast w „Akcjach". Ta sama bramka co przy kafelkach
      // tworzenia w Insighcie. Etap 4 gridu n-Type: licznik 0 zamiast
      // komunikatu opisowego (był tu ten sam zakazany tekst co w „Akcjach").
      isEmpty: readMode,
      badge: readMode ? 0 : undefined,
      showZeroBadge: true,
      children: (
        <PreviewActionBar
          rows={[
            {
              buttons: [
                {
                  label: t('myWork.notificationDetail.saveAsNote', 'Save as note'),
                  icon: FileText,
                  colorScheme: 'neutral' as const,
                  onClick: () => void handleSaveAsNote(),
                  disabled: savingAsNote,
                },
              ],
            },
          ]}
        />
      ),
    },
    {
      // KOMENTARZE (Etap 4 gridu n-Type, _GRID_STABILIZATION_COMMAND_2026-07-24.md
      // §Prawy panel: „nie usuwać losowo Comments i History z wybranych kart").
      // Sekcja BYŁA usunięta wcześniejszą decyzją K2 („wiadomość systemowa nie
      // jest artefaktem współpracy") — realny powód wciąż stoi: powiadomienie
      // nie ma wątku komentarzy w bazie (`notification_comments` nie istnieje),
      // więc kompozytor komentarzy byłby atrapą bez zapisu. Rozstrzygnięcie CTO
      // 2026-07-24: sekcja zostaje WIDOCZNA (przewidywalność kanonu wygrywa),
      // ale ZWINIĘTA z licznikiem 0 — zero nowego wywołania backendu, zero
      // nowej trasy API, zero kompozytora.
      id: 'comments',
      label: t('myWork.notificationDetail.panelComments', 'Comments'),
      icon: MessageSquare,
      defaultOpen: false,
      isEmpty: true,
      badge: 0,
      showZeroBadge: true,
      emptyLabel: t(
        'myWork.notificationDetail.commentsNotApplicable',
        'System notifications do not carry a comment thread.'
      ),
      children: null,
    },
    {
      id: 'history',
      label: t('myWork.notificationDetail.panelHistory', 'History'),
      icon: History,
      defaultOpen: false,
      badge: historyEntries.length,
      isEmpty: !activityLogLoading && historyEntries.length === 0,
      emptyLabel: t('myWork.notificationDetail.noActivityYet', 'No activity yet'),
      children: activityLogLoading ? (
        <div className="flex items-center gap-2 py-2 text-xs text-c-text-muted">
          <Loader2 size={13} className="animate-spin" />
          {t('myWork.notificationDetail.loading', 'Loading…')}
        </div>
      ) : (
        <ol className="space-y-2.5">
          {historyEntries.map((entry) => (
            <li key={entry.id} className="flex flex-col gap-0.5">
              <span className="text-xs text-c-text">{entry.description}</span>
              <span className="text-[11px] text-c-text-muted">{formatDate(entry.timestamp)}</span>
            </li>
          ))}
        </ol>
      ),
    },
  ];

  // ── Menu 1 status pill (D-B) — etykieta z tekstem, nie naga kropka ──────────
  // Stan-domenowy powiadomienia w naglowku = jego cykl zycia odbioru
  // (nieprzeczytane → przeczytane → odlozone), a nie severity: severity ma
  // wlasne pole w prawym panelu (Wlasciwosci → „Priorytet", linia ~2313) i nie
  // mapuje sie na palete tonow pigulki (amber nie ma tokenu c-*). Tony biore te,
  // ktore ta karta juz stosuje dla tych stanow w pasku Wlasciwosci:
  //   nieprzeczytane = niebieski (c-info → 'review'),
  //   przeczytane   = zielony    (c-success → 'approved'),
  //   odlozone      = wyciszony  ('neutral'; amber celowo poza paleta).
  // Klucze i18n reuzywane z sekcji Status (bez nowych: read2/unread/snoozed2).
  const notifLifecycle = isSnoozed ? 'snoozed' : notification.isRead ? 'read' : 'unread';
  const notifStatusLabel =
    notifLifecycle === 'snoozed'
      ? t('myWork.notificationDetail.snoozed2', 'Snoozed')
      : notifLifecycle === 'read'
        ? t('myWork.notificationDetail.read2', 'Read')
        : t('myWork.notificationDetail.unread', 'Unread');
  const notifStatusTone: 'review' | 'approved' | 'neutral' =
    notifLifecycle === 'unread' ? 'review' : notifLifecycle === 'read' ? 'approved' : 'neutral';

  // ═══════════════════════════════════════════════════════════════════════════
  // ── RENDER ──────────────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-gradient-to-br from-c-surface-raised via-c-surface to-c-surface-raised dark:from-c-bg dark:to-c-bg">
      {/* ── GEOMETRIA CHROMU (2026-07-24) ──────────────────────────────────
          `pt-4` (nie `pt-6`) = ten sam odstęp od góry co w powłoce
          `NModeShell` (:153) — Menu 1 wszystkich sześciu kart N stoi teraz
          na 16 px, nie 16/24 zależnie od karty.
          Wiersz flex z prawym panelem obejmuje RÓWNIEŻ Menu 1 i Menu 2
          (było: panel siedział w wierszu 3-pane POD menu, więc oba menu biegły
          na całe 1152 px NAD panelem, a panel startował 148 px od góry).
          Teraz karta ma tę samą geometrię co Decyzja/Zadanie/Inicjatywa.
          GRID ETAP 6 (2026-07-24, naprawa P0-2): `max-w-6xl` (1152px stałe)
          zamrażał centrum na ~592px, martwe marginesy na 1920px. Wzorzec
          z Zadania (TaskDetailView.tsx:5306-5311) — token
          `--ntype-content-document-max-width` zamiast stałej. Ta karta nie
          gatuje wiersza za `xl:` (panel zawsze widoczny, patrz komentarz
          niżej przy prawym panelu) — `flex` zostaje bez prefiksu. */}
      <div className="px-6 pt-4 pb-6">
        <div
          className="mx-auto flex gap-6 items-start space-y-0"
          style={{
            maxWidth:
              'calc(var(--ntype-left-panel-width) + var(--ntype-column-gap) + var(--ntype-content-document-max-width) + var(--ntype-column-gap) + var(--ntype-right-panel-width))',
          }}
        >
          <div className="flex-1 min-w-0 space-y-0">
            {/* ── Header — shared NModeHeader ───────────────────────────────
                 SPEC-N §2.3/§2.7 — USUNIETO prop `draftSavedLabel`. Jego typ mowi
                 wprost "Do not use for persistence state", a ta karta uzywala go do
                 live-timestampu zapisu ("Zapisano 14:32"). Powiadomienie jest
                 read-only (tytul ma `titleReadOnly`), wiec wskaznik zapisu w naglowku
                 wprowadzal w blad — zwlaszcza obok osobnego statusu cyklu zycia.
                 Edytowalna checklista ma wlasny, poprawny kanal: `isDirty`/`saving`.
                 `lastWorksheetSavedAt` nadal jest ustawiany w logice zapisu — nie
                 renderujemy go tylko w powloce. */}
            <NModeHeader
              title={
                notification.title || t('myWork.notificationDetail.notification', 'Notification')
              }
              onTitleChange={() => {}}
              // D-A (tryb otwarcia): powiadomienie = arkusz do wypelnienia → karta
              // otwiera sie w EDYCJI. Powierzchnia edycji to worksheet/checklista
              // (edytowalna od razu, autozapis onBlur — kanaly `isDirty`/`saving`
              // ponizej), a NIE tytul: tytul powiadomienia to naglowek generowany
              // przez silnik ryzyka, bez kanalu utrwalenia (onTitleChange to no-op),
              // wiec zostaje read-only. Edytowalny tytul udawalby zapis, ktorego nie ma.
              titleReadOnly={true}
              artifactId={notificationId}
              artifactType="notification"
              onSave={handleSaveWorksheet}
              saving={worksheetSaving}
              isDirty={worksheetIsDirty}
              // Gdy ostatni zapis padl, wskaznik ma mowic "Blad zapisu" (klikalny,
              // ponawia) zamiast "Zapisano". Karta nie moze twierdzic, ze utrwalila
              // tresc, ktorej backend nie przyjal.
              saveState={
                worksheetSaving
                  ? 'saving'
                  : worksheetSaveFailed
                    ? 'error'
                    : worksheetIsDirty
                      ? 'dirty'
                      : 'saved'
              }
              onChat={handleOpenChat}
              onClose={onClose}
              // D-B: status = etykieta-pigulka z tekstem + ton c-* (nie naga kropka).
              // statusDotColor USUNIETY (@deprecated, nie renderowany).
              statusLabel={notifStatusLabel}
              statusTone={notifStatusTone}
              presentationMode={presentationMode}
              onPresentationModeChange={setPresentationMode}
              // ETAP 1.1 n-Type: karta N ma JEDEN widok — bez przełącznika N/C.
              showModeSwitcher={false}
              primaryAction={headerPrimaryAction}
              // Standard n-Type §3.5 — JEDNO menu trzech kropek na ekranie,
              // w Menu 1, na dzialania techniczne i administracyjne. Karta
              // dokleja tu swoje pozycje zamiast rysowac wlasny drugi kebab.
              extraOverflowItems={headerOverflowItems}
            />

            {/* ═══════════ N MODE ═══════════════════════════════════════════
                 Uklad: ActionBar → 3-Pane (LeftNav + Canvas + PRAWY PANEL).

                 SPEC-N §2.2 — prawy panel jest czescia OBOWIAZKOWA powloki, a ta
                 karta nie miala go w ogole (jedna z 5 na 8). Wariant SKROCONY wg
                 decyzji wlasciciela (K2 planu wdrozenia): wiadomosc systemowa nie
                 jest artefaktem wspolpracy, wiec panel ma tylko Wlasciwosci
                 + Historie — bez Komentarzy (sekcja skasowana, nie przeniesiona)
                 i bez Powiazan (powiadomienie nie ma realnych relacji; pusta sekcja
                 "Powiazania" bylaby ceremonia, nie informacja — zrodlo pokazujemy
                 w tresci sekcji "Co sie dzieje").

                 SPEC-N §2.6 (anty-duplikacja) — poziomy `NModePropertiesStrip`
                 (6 pol pod naglowkiem) ZNIKA z trybu N. Te same 6 pol zyje teraz
                 w sekcji Wlasciwosci prawego panelu, ktory jest widoczny ZAWSZE.
                 To dokladnie defekt, ktory §2.2 wytyka Initiative ("poziomа siatka
                 7 pol pod naglowkiem" zamiast panelu). `propertiesFields` zostaje
                 jako jedyna deklaracja tych pol — karmi teraz sekcje Wlasciwosci
                 panelu (stary tryb 'c' ma wlasny akordeon, nie uzywal tego paska),
                 dlatego import `NModePropertiesStrip` znika z tego pliku.
                 ═══════════════════════════════════════════════════════════════ */}
            {presentationMode === 'n' && (
              <div className="col-span-full space-y-4 pt-4">
                {/* RYTM PIONOWY (2026-07-24): `pt-4` = 16 px między Menu 1 a Menu 2 —
                    tyle, ile daje powłoka `NModeShell` (mt-2 na pasku + py-2 w środku)
                    Wnioskowi i Narzędziu. `mt-*` tu NIE DZIAŁA: rodzic ma `space-y-0`,
                    które nadpisuje margin-top dzieci (wyższa specyficzność selektora
                    `.space-y-0 > * ~ *`). Dlatego padding, nie margines. */}
                {/* ── MENU 2 (pasek pod naglowkiem) — standard n-Type §4.2 ────
                     BYLO: „Przeczytane" + „Odloz" + „Usun" + „…" + AI — lista
                     dzialan zamiast jednej rekomendowanej akcji (zarzut
                     wlasciciela 2026-07-23), plus DRUGIE menu trzech kropek obok
                     kebaba Menu 1.
                     JEST — taksonomia akcji ze standardu §3.5:
                       • naglowek (Menu 1)   → JEDNA rekomendowana akcja (slot primary);
                       • panel / Akcje       → „Przeczytane", „Odloz" (biznes/workflow);
                       • panel / Rezultaty   → „Zapisz jako notatke" (tworzy efekt);
                       • kebab `⋮` Menu 1    → „Wycisz", „Usun" (techniczne/administracyjne)
                                               — przez `extraOverflowItems`, jedno menu na ekranie.
                     Ten pasek trzyma juz WYLACZNIE rzeczy nie-bedace akcjami
                     artefaktu, w trzech strefach (§4.2): lewo = „Sekcje",
                     srodek = „Edycja | Podglad", prawo = „Analizuj z AI".
                     Skroty `M`/`D` dzialaja dalej (badge `M` przy akcji w panelu,
                     badge `D` przy „Usun" w kebabie).


                     SCALENIE 2026-07-23 (fala menu2 + fala powiadomienia) — pasek
                     akcji ZNIKA STAD W CALOSCI, a menu 2 to juz nie bespoke <div>,
                     tylko WSPOLNY komponent `NModeMenu2` (renderowany nizej). Dwie
                     intencje zlozone razem:
                       • fala powiadomienia — „Oznacz przeczytane / Odloz / Usun /
                         Zapisz jako notatke / Wycisz" zeszly do prawego panelu
                         (Akcje · Rezultaty) i do kebaba Menu 1 (`extraOverflowItems`),
                         wiec bespoke pasek akcji nie ma juz czego trzymac;
                       • fala menu2 — trzy strefy (Sekcje | Edycja·Podglad | AI) daje
                         `NModeMenu2`, ten sam we wszystkich 6 kartach N, zamiast
                         recznej siatki `grid-cols-3` z lokalnymi klasami slate/navy.
                     Tym samym znika tez DLUG „pasek jest bespoke" — jest wspolny. */}

                {/* ── MENU 2 (ETAP 1.2 standardu n-Type) ──────────────────────
                    Trzy strefy narzucone przez wspólny `NModeMenu2`:
                      LEWA   — Sekcje (było po PRAWEJ, `ml-auto` — zgłoszenie
                               właściciela pkt 4),
                      ŚRODEK — Edycja | Podgląd (karta NIE MIAŁA przełącznika
                               w ogóle — zgłoszenie pkt 5),
                      PRAWA  — Analizuj z AI (fiolet). Wcześniej ten przycisk
                               pokazywał się tylko na 3 z 6 sekcji, choć
                               `handleAnalyzeWithAI` wypełnia CAŁY arkusz —
                               teraz jest wejściem na poziomie karty.
                    „+ Nowa karta" zdjęte — karty są predefiniowane. */}
                <NModeMenu2
                  isPolish={isPolish}
                  sectionsMenu={
                    notificationCardContractEnabled ? (
                      <SectionsManagerMenu layout={notificationCardLayout} isPolish={isPolish} />
                    ) : undefined
                  }
                  readMode={readMode}
                  onReadModeChange={setReadMode}
                  aiButton={
                    // ETAP 3: przycisk ANALIZUJE aktywną kartę i otwiera panel
                    // wyników. Nie pisze do pól — zapis wyłącznie przez „Zastosuj".
                    <Menu2AIButton
                      isPolish={isPolish}
                      busy={notificationCardAnalysis.loading}
                      aria-expanded={notificationCardAnalysis.open}
                      onClick={notificationCardAnalysis.run}
                    />
                  }
                />

                {/* ── 3-Pane: LeftNav + Canvas + prawy panel (SPEC-N §2.2) ── */}
                <div className="flex gap-0 min-h-[60vh]">
                  <NModeLeftNav
                    sections={orderedNModeSections}
                    activeSection={activeNSection}
                    onSectionChange={setActiveNSection}
                  />
                  <div
                    className="flex-1 min-w-0"
                    style={{ maxWidth: 'var(--ntype-content-document-max-width)' }}
                  >
                    <NModeCanvas
                      sections={orderedNModeSections}
                      activeSection={activeNSection}
                      reducedMotion={reducedMotion}
                      motionDuration={motionDuration}
                    />
                  </div>
                </div>

                {/* ── ETAP 3: panel wyników „Analizuj z AI" ──────────────────
                    Slide-over przy prawej krawędzi (nie modal, nie przyciemnia).
                    Renderowany tylko przy `open` — komponent sam się chowa. */}
                <NCardAIAnalysisPanel
                  open={notificationCardAnalysis.open}
                  onClose={notificationCardAnalysis.close}
                  loading={notificationCardAnalysis.loading}
                  result={notificationCardAnalysis.result}
                  errorCode={notificationCardAnalysis.errorCode}
                  serverErrorCode={notificationCardAnalysis.serverErrorCode}
                  onRerun={notificationCardAnalysis.rerun}
                  onApplyChange={notificationCardAnalysis.applyChange}
                  writableFieldIds={notificationWritableFieldIds}
                  readMode={readMode}
                  isPolish={isPolish}
                />
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
                      className="bg-c-surface/70 backdrop-blur-xl rounded-2xl border border-c-border shadow-lg shadow-c-border/50 overflow-hidden"
                    >
                      <button
                        onClick={() => toggleSection('whats-happening')}
                        className="w-full flex items-center justify-between px-5 py-4 hover:bg-c-surface-raised/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-500/10 dark:from-blue-500/20 dark:to-blue-500/20">
                            <Info size={18} className="text-blue-500 dark:text-blue-400" />
                          </div>
                          <span className="text-sm font-semibold text-c-text-secondary">
                            {t('myWork.notificationDetail.whatSHappening2', "What's happening")}
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
                            <ChevronDown size={18} className="text-c-text-muted" />
                          </motion.div>
                        </div>
                      </button>
                      <AnimatePresence>
                        {expandedSections.has('whats-happening') && (
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: 'auto' }}
                            exit={{ height: 0 }}
                            className="border-t border-c-border overflow-hidden"
                          >
                            <div className="p-5 space-y-4">
                              <div className="text-lg font-semibold text-c-text">
                                {contract.what}
                              </div>
                              <div>
                                <div className="text-xs uppercase tracking-wide text-c-text-muted mb-1">
                                  {t('myWork.notificationDetail.whyItMatters2', 'Why it matters')}
                                </div>
                                <div className="text-sm text-c-text-secondary leading-relaxed">
                                  {contract.whyImportant}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs uppercase tracking-wide text-c-text-muted mb-1">
                                  {t('myWork.notificationDetail.whatIsBlocked2', 'What is blocked')}
                                </div>
                                <div className="text-sm text-c-text-secondary leading-relaxed">
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
                      className="bg-c-surface/70 backdrop-blur-xl rounded-2xl border border-c-border shadow-lg shadow-c-border/50 overflow-hidden"
                    >
                      <button
                        onClick={() => toggleSection('ai-analysis')}
                        className="w-full flex items-center justify-between px-5 py-4 hover:bg-c-surface-raised/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-gradient-to-br from-c-info/10 to-c-info/10 dark:from-c-info/20 dark:to-c-info/20">
                            <TeresaMark size={18} className="text-c-info" />
                          </div>
                          <span className="text-sm font-semibold text-c-text-secondary">
                            {t('myWork.notificationDetail.aIAnalysis2', 'AI Analysis')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Sparkles size={14} className="text-c-info" />
                          <motion.div
                            animate={{ rotate: expandedSections.has('ai-analysis') ? 180 : 0 }}
                          >
                            <ChevronDown size={18} className="text-c-text-muted" />
                          </motion.div>
                        </div>
                      </button>
                      <AnimatePresence>
                        {expandedSections.has('ai-analysis') && aiAnalysis && (
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: 'auto' }}
                            exit={{ height: 0 }}
                            className="border-t border-c-border overflow-hidden"
                          >
                            <div className="p-5 space-y-4">
                              <div className="flex items-center gap-3">
                                <span
                                  className={`px-2.5 py-1 rounded-full text-xs font-bold ${aiAnalysis.riskLevel === 'critical' ? 'bg-danger-500/10 text-danger-500' : aiAnalysis.riskLevel === 'high' ? 'bg-amber-500/10 text-amber-500' : aiAnalysis.riskLevel === 'medium' ? 'bg-blue-500/10 text-blue-500' : 'bg-c-surface-raised0/10 text-c-text-muted'}`}
                                >
                                  {t('myWork.notificationDetail.priority2', 'Priority')}:{' '}
                                  {aiAnalysis.priority}
                                </span>
                                {aiAnalysis.confidence && (
                                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-c-info/10 text-c-info">
                                    {t('myWork.notificationDetail.confidence2', 'Confidence')}:{' '}
                                    {aiAnalysis.confidence}
                                  </span>
                                )}
                                {aiAnalysis.aiGenerated && (
                                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-500">
                                    AI Generated
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-c-text-secondary leading-relaxed">
                                {aiAnalysis.impact}
                              </div>
                              <div className="p-3 rounded-xl bg-c-info/10 border border-c-info/20">
                                <div className="flex items-start gap-2">
                                  <Zap size={16} className="text-c-info mt-0.5 shrink-0" />
                                  <div className="text-sm text-c-info">
                                    {aiAnalysis.recommendation}
                                  </div>
                                </div>
                              </div>
                              <button
                                onClick={handleAskAI}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-c-info/10 text-c-info hover:bg-c-info/20 transition-colors text-sm font-medium"
                              >
                                <MessageSquare size={14} />
                                {t(
                                  'myWork.notificationDetail.askAIForMore2',
                                  'Ask AI for more details'
                                )}
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
                      className="bg-c-surface/70 backdrop-blur-xl rounded-2xl border border-c-border shadow-lg shadow-c-border/50 overflow-hidden"
                    >
                      <button
                        onClick={() => toggleSection('expected-action')}
                        className="w-full flex items-center justify-between px-5 py-4 hover:bg-c-surface-raised/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500/10 to-blue-500/10 dark:from-emerald-500/20 dark:to-blue-500/20">
                            <CheckSquare
                              size={18}
                              className="text-emerald-500 dark:text-emerald-400"
                            />
                          </div>
                          <span className="text-sm font-semibold text-c-text-secondary">
                            {t('myWork.notificationDetail.expectedAction2', 'Expected Action')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-c-text-muted">
                            {actionChecklist.filter((i) => i.completed).length}/
                            {actionChecklist.length}
                          </span>
                          <motion.div
                            animate={{ rotate: expandedSections.has('expected-action') ? 180 : 0 }}
                          >
                            <ChevronDown size={18} className="text-c-text-muted" />
                          </motion.div>
                        </div>
                      </button>
                      <AnimatePresence>
                        {expandedSections.has('expected-action') && (
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: 'auto' }}
                            exit={{ height: 0 }}
                            className="border-t border-c-border overflow-hidden"
                          >
                            <div className="p-5 space-y-4">
                              <div className="flex items-center justify-between">
                                <label className="text-[11px] uppercase tracking-wide text-c-text-muted">
                                  {t(
                                    'myWork.notificationDetail.whatNeedsToBe2',
                                    'What needs to be done'
                                  )}
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
                                className="w-full px-0 py-2 bg-transparent text-sm leading-relaxed text-c-text-secondary focus:outline-none placeholder-c-text-muted resize-y border-b border-c-border focus:border-c-focus transition-colors"
                                placeholder={t(
                                  'myWork.notificationDetail.placeholder2',
                                  'Expected action...'
                                )}
                              />

                              <div className="flex items-center justify-between pt-1">
                                <label className="text-[11px] uppercase tracking-wide text-c-text-muted">
                                  {t('myWork.notificationDetail.checklist2', 'Checklist')}
                                </label>
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-medium text-c-text-muted tabular-nums">
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
                                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-c-surface-raised hover:bg-c-surface-raised transition-colors text-left"
                                  >
                                    <div
                                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${item.completed ? 'bg-emerald-500 border-emerald-500' : 'border-c-border'}`}
                                    >
                                      {item.completed && <Check size={12} className="text-white" />}
                                    </div>
                                    <span
                                      className={`text-sm ${item.completed ? 'text-c-text-muted line-through' : 'text-c-text-secondary'}`}
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
                      className="bg-c-surface/70 backdrop-blur-xl rounded-2xl border border-c-border shadow-lg shadow-c-border/50 overflow-hidden"
                    >
                      <button
                        onClick={() => toggleSection('comments')}
                        className="w-full flex items-center justify-between px-5 py-4 hover:bg-c-surface-raised/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/10 to-amber-500/10 dark:from-amber-500/20 dark:to-amber-500/20">
                            <MessageCircle
                              size={18}
                              className="text-amber-500 dark:text-amber-400"
                            />
                          </div>
                          <span className="text-sm font-semibold text-c-text-secondary">
                            {t('myWork.notificationDetail.comments3', 'Comments')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-c-surface-raised text-c-text-muted">
                            0
                          </span>
                          <motion.div
                            animate={{ rotate: expandedSections.has('comments') ? 180 : 0 }}
                          >
                            <ChevronDown size={18} className="text-c-text-muted" />
                          </motion.div>
                        </div>
                      </button>
                      <AnimatePresence>
                        {expandedSections.has('comments') && (
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: 'auto' }}
                            exit={{ height: 0 }}
                            className="border-t border-c-border overflow-hidden"
                          >
                            <div className="p-5 space-y-3">
                              <p className="text-sm text-c-text-muted text-center py-3">
                                {t('myWork.notificationDetail.noCommentsYet2', 'No comments yet')}
                              </p>
                              <button
                                onClick={handleOpenChat}
                                className="w-full px-4 py-2.5 rounded-xl border border-dashed border-c-info/30 text-c-info hover:border-c-info/50 hover:bg-c-info/5 transition-colors text-sm flex items-center justify-center gap-2"
                              >
                                <MessageSquare size={14} />
                                {t(
                                  'myWork.notificationDetail.openContextualChat2',
                                  'Open contextual chat'
                                )}
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
                      className="bg-c-surface/70 backdrop-blur-xl rounded-2xl border border-c-border shadow-lg shadow-c-border/50 overflow-hidden"
                    >
                      <button
                        onClick={() => toggleSection('activity-log')}
                        className="w-full flex items-center justify-between px-5 py-4 hover:bg-c-surface-raised/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-gradient-to-br from-c-text-muted/10 to-gray-500/10 dark:from-c-text-muted/20 dark:to-gray-500/20">
                            <History size={18} className="text-c-text-muted" />
                          </div>
                          <span className="text-sm font-semibold text-c-text-secondary">
                            {t('myWork.notificationDetail.activityLog2', 'Activity Log')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-c-surface-raised text-c-text-muted">
                            1
                          </span>
                          <motion.div
                            animate={{ rotate: expandedSections.has('activity-log') ? 180 : 0 }}
                          >
                            <ChevronDown size={18} className="text-c-text-muted" />
                          </motion.div>
                        </div>
                      </button>
                      <AnimatePresence>
                        {expandedSections.has('activity-log') && (
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: 'auto' }}
                            exit={{ height: 0 }}
                            className="border-t border-c-border overflow-hidden"
                          >
                            <div className="p-5 space-y-3">
                              <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-c-surface-raised flex items-center justify-center shrink-0">
                                  <Bell size={14} className="text-c-text-muted" />
                                </div>
                                <div>
                                  <p className="text-sm text-c-text-secondary">
                                    {t(
                                      'myWork.notificationDetail.notificationCreated',
                                      'Notification created'
                                    )}
                                  </p>
                                  <p className="text-xs text-c-text-muted">
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
                                    <p className="text-sm text-c-text-secondary">
                                      {t(
                                        'myWork.notificationDetail.markedAsRead',
                                        'Marked as read'
                                      )}
                                    </p>
                                    <p className="text-xs text-c-text-muted">
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
                      className="bg-c-surface/70 backdrop-blur-xl rounded-2xl border border-c-border shadow-lg shadow-c-border/50 overflow-hidden"
                    >
                      <button
                        onClick={() => toggleSection('control')}
                        className="w-full flex items-center justify-between px-5 py-4 hover:bg-c-surface-raised/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-gradient-to-br from-c-info/10 to-c-info/10 dark:from-c-info/20 dark:to-c-info/20">
                            <Flag size={18} className="text-c-info" />
                          </div>
                          <span className="text-sm font-semibold text-c-text-secondary">
                            Control
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-c-text-muted bg-c-surface-raised/80 px-2 py-0.5 rounded-lg">
                            #notif-{notificationId.slice(0, 8)}
                          </span>
                          <motion.div
                            animate={{ rotate: expandedSections.has('control') ? 180 : 0 }}
                          >
                            <ChevronDown size={18} className="text-c-text-muted" />
                          </motion.div>
                        </div>
                      </button>
                      <AnimatePresence>
                        {expandedSections.has('control') && (
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: 'auto' }}
                            exit={{ height: 0 }}
                            className="border-t border-c-border overflow-hidden"
                          >
                            <div className="p-4 space-y-3">
                              <div>
                                <label className="block text-xs text-c-text-muted mb-1">
                                  {t('myWork.notificationDetail.type3', 'Type')}
                                </label>
                                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-c-surface-raised border border-c-border">
                                  <TypeIcon size={14} className={typeConfig.color} />
                                  <span className="text-sm font-medium text-c-text-secondary">
                                    {notification.type.replace(/_/g, ' ')}
                                  </span>
                                </div>
                              </div>
                              <div>
                                <label className="block text-xs text-c-text-muted mb-1">
                                  {t('myWork.notificationDetail.severity', 'Severity')}
                                </label>
                                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-c-surface-raised border border-c-border">
                                  <div
                                    className={`w-2.5 h-2.5 rounded-full ${severityConfig.color}`}
                                  />
                                  <span
                                    className={`text-sm font-medium ${severityConfig.textColor}`}
                                  >
                                    {isPolish ? severityConfig.label.pl : severityConfig.label.en}
                                  </span>
                                </div>
                              </div>
                              <div>
                                <label className="block text-xs text-c-text-muted mb-1">
                                  {t('myWork.notificationDetail.category', 'Category')}
                                </label>
                                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-c-surface-raised border border-c-border">
                                  <span className="text-sm font-medium text-c-text-secondary capitalize">
                                    {notification.category}
                                  </span>
                                </div>
                              </div>
                              {(notification.projectName ||
                                (notification.data as any)?.projectName) && (
                                <div>
                                  <label className="block text-xs text-c-text-muted mb-1">
                                    {t('myWork.notificationDetail.project', 'Project')}
                                  </label>
                                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-c-surface-raised border border-c-border">
                                    <FolderOpen size={14} className="text-indigo-400" />
                                    <span className="text-sm font-medium text-c-text-secondary">
                                      {notification.projectName ||
                                        (notification.data as any)?.projectName}
                                    </span>
                                  </div>
                                </div>
                              )}
                              <div>
                                <label className="block text-xs text-c-text-muted mb-1">
                                  {t('myWork.notificationDetail.created', 'Created')}
                                </label>
                                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-c-surface-raised border border-c-border">
                                  <Clock size={14} className="text-c-text-muted" />
                                  <span className="text-sm text-c-text-secondary">
                                    {formatDate(notification.createdAt)}
                                  </span>
                                </div>
                              </div>
                              <div className="pt-2 border-t border-c-border space-y-2">
                                <div className="flex gap-2">
                                  <button
                                    onClick={handleMuteSimilar}
                                    className="flex-1 px-3 py-2 rounded-lg bg-c-surface-raised text-c-text-muted hover:bg-c-surface-raised transition-colors flex items-center justify-center gap-2 text-sm"
                                  >
                                    <BellOff size={14} />
                                    <span>{t('myWork.notificationDetail.mute2', 'Mute')}</span>
                                  </button>
                                  <button
                                    onClick={handleDelete}
                                    className="flex-1 px-3 py-2 rounded-lg bg-danger-50 dark:bg-danger-500/10 text-danger-600 dark:text-danger-400 hover:bg-danger-100 dark:hover:bg-danger-500/20 transition-colors flex items-center justify-center gap-2 text-sm"
                                  >
                                    <Trash2 size={14} />
                                    <span>{t('myWork.notificationDetail.delete2', 'Delete')}</span>
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
                      className="bg-c-surface/70 backdrop-blur-xl rounded-2xl border border-c-border shadow-lg shadow-c-border/50 overflow-hidden"
                    >
                      <button
                        onClick={() => toggleSection('stakeholders')}
                        className="w-full flex items-center justify-between px-5 py-4 hover:bg-c-surface-raised/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-500/10 dark:from-blue-500/20 dark:to-blue-500/20">
                            <Users size={18} className="text-blue-500 dark:text-blue-400" />
                          </div>
                          <span className="text-sm font-semibold text-c-text-secondary">
                            {t('myWork.notificationDetail.stakeholders', 'Stakeholders')}
                          </span>
                        </div>
                        <motion.div
                          animate={{ rotate: expandedSections.has('stakeholders') ? 180 : 0 }}
                        >
                          <ChevronDown size={18} className="text-c-text-muted" />
                        </motion.div>
                      </button>
                      <AnimatePresence>
                        {expandedSections.has('stakeholders') && (
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: 'auto' }}
                            exit={{ height: 0 }}
                            className="border-t border-c-border overflow-hidden"
                          >
                            <div className="p-4 space-y-2">
                              {sourceEntity?.assignee && (
                                <div className="flex items-center gap-3 p-2.5 rounded-lg bg-c-surface-raised">
                                  <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-xs font-bold text-blue-500">
                                    {String(sourceEntity.assignee).charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-c-text-secondary">
                                      {sourceEntity.assignee}
                                    </p>
                                    <p className="text-[10px] text-c-text-muted">
                                      {t('myWork.notificationDetail.assignee', 'Assignee')}
                                    </p>
                                  </div>
                                </div>
                              )}
                              {sourceEntity?.decider && (
                                <div className="flex items-center gap-3 p-2.5 rounded-lg bg-c-surface-raised">
                                  <div className="w-7 h-7 rounded-full bg-c-info/20 flex items-center justify-center text-xs font-bold text-c-info">
                                    {String(sourceEntity.decider).charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-c-text-secondary">
                                      {sourceEntity.decider}
                                    </p>
                                    <p className="text-[10px] text-c-text-muted">
                                      {t('myWork.notificationDetail.decider', 'Decider')}
                                    </p>
                                  </div>
                                </div>
                              )}
                              {!sourceEntity?.assignee && !sourceEntity?.decider && (
                                <p className="text-sm text-c-text-muted text-center py-2">
                                  {t(
                                    'myWork.notificationDetail.noStakeholdersAssigned',
                                    'No stakeholders assigned'
                                  )}
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
                        className="bg-c-surface/70 backdrop-blur-xl rounded-2xl border border-c-border shadow-lg shadow-c-border/50 overflow-hidden"
                      >
                        <div className="flex items-center justify-between px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/10 to-amber-500/10 dark:from-amber-500/20 dark:to-amber-500/20">
                              <Info size={18} className="text-amber-500 dark:text-amber-400" />
                            </div>
                            <span className="text-sm font-semibold text-c-text-secondary">
                              {t('myWork.notificationDetail.whyYouGotIt', 'Why you got it')}
                            </span>
                          </div>
                        </div>
                        <div className="border-t border-c-border p-4">
                          <p className="text-sm text-c-text-secondary leading-relaxed">
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
          {/* ── Dokowany prawy panel (SPEC-N §2.2) ──────────────────────────
              ETAP 1.4 — jasna zaokrąglona karta odsunięta od krawędzi
              (wrapper `sticky top-4 self-start`), nie sidebar doklejony do
              brzegu. SIOSTRA kolumny roboczej: panel zaczyna się na górnej
              krawędzi Menu 1 i oba menu kończą się przed nim — jak w Decyzji,
              Zadaniu i Inicjatywie. Tryb C ma własny akordeon, więc panel
              renderujemy tylko w trybie N.
              BEZ `hidden xl:block` (inaczej niż Decyzja/Zadanie) — ta karta
              pokazywała panel na KAŻDEJ szerokości; ukrycie <1280 zabrałoby
              użytkownikowi Właściwości i Historię, czyli byłaby to regresja
              funkcji pod pretekstem geometrii. */}
          {presentationMode === 'n' && (
            <div className="shrink-0 sticky top-4 self-start">
              <ArtifactRightPanel
                ariaLabel={t(
                  'myWork.notificationDetail.rightPanelAria',
                  'Notification details panel'
                )}
                className={ARTIFACT_PANEL_CARD_CLASS_STICKY}
                sections={rightPanelSections}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationDetailView;
