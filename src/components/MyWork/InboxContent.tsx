/**
 * InboxContent — Unified Inbox (Action Queue + Notifications)
 *
 * Features:
 * - Merged notifications + tasks + decisions into single triage view
 * - A1: Deduplication / aggregation of repeated items
 * - A2: Inline quick actions (Focus, Done, Save, Dismiss, Snooze)
 * - B1: Snooze with time presets (backend-persisted)
 * - B2: Rich Bulk Triage Bar with smart-select
 * - B3: Keyboard-first triage (J/K/T/W/E/B/A/X)
 * - C2: Toggle flat list ↔ smart sections
 * - C3: Urgency heatmap (left border color gradient)
 * - E2: Relative time + aging indicator
 * - F3: Smart composite sorting
 * - N1: Read vs Done semantics (Open / Done / Saved tabs)
 * - N2: "Action Required" smart filter (isActionable)
 * - N7: "Why am I seeing this?" reason tooltip
 * - N8: Unified Dismiss (no delete)
 * - N9: Snooze backend persistence
 * - N10: Saved / Pin for "I'll come back"
 * - N11: Route to Focus (Today / This week / Later)
 */

import {
  AlertCircle,
  AlertTriangle,
  Archive,
  Bell,
  Bookmark,
  BookmarkCheck,
  Calendar,
  CalendarClock,
  Check,
  CheckCheck,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Eye,
  FileText,
  HelpCircle,
  Inbox,
  Layers,
  Lightbulb,
  Loader2,
  MessageSquare,
  Minus,
  MoreVertical,
  Pin,
  Scale,
  Settings2,
  Sparkles,
  Square,
  Star,
  X,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { type RowAction, RowActionsMenu } from '@/components/shared/RowActionsMenu';
import {
  PreviewActionBar,
  PreviewDetailsSection,
  PreviewMetaCard,
  PreviewRelations,
  actionPillClass,
  type ActionRow,
  type MetaPill,
  type RelationItem,
} from '@/components/shared/PreviewPane';
import { Modal } from '@/components/ui/primitives/Modal';
import {
  type ColumnDef,
  ColumnResizer,
  type ColumnWidths,
  type TableFilters,
} from '@/components/ui/ResizableTable';
import { PreviewPaneShell } from '@/components/ui/ResizableTable';
import { FilterDropdown } from '@/components/ui/ResizableTable/FilterDropdown';
import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';

type InboxUrgency = 'critical' | 'high' | 'normal' | 'low';
type InboxItemType =
  | 'new_assignment'
  | 'mention'
  | 'escalation'
  | 'review_request'
  | 'decision_request'
  | 'ai_suggestion'
  | 'system_alert'
  | 'billing_alert'
  | 'project_update';

type InboxSection =
  | 'decisions_required'
  | 'approvals_gates'
  | 'assigned_tasks'
  | 'blocked_escalations'
  | 'overdue_sla_breach'
  | 'fyi_system'
  | 'fyi_mentions'
  | 'ai_insights'
  | 'other';

type SlaLevel = 'none' | 'L1' | 'L2' | 'L3';
type TriageAction =
  | 'accept_today'
  | 'accept_week'
  | 'accept_later'
  | 'schedule'
  | 'delegate'
  | 'archive'
  | 'dismiss'
  | 'done'
  | 'save'
  | 'snooze'
  | 'reject';
type InboxItemKey = `task:${string}` | `decision:${string}` | `notification:${string}`;
type InboxViewMode = 'flat' | 'sections';
type InboxStatusTab = 'open' | 'done' | 'saved' | 'all';
type SnoozePreset = '2h' | 'tomorrow' | '3d' | 'next_monday';

type InboxEntityKind = 'task' | 'initiative' | 'survey' | 'decision' | 'notification';

const ENTITY_KIND_CONFIG: Record<
  InboxEntityKind,
  { icon: React.ElementType; labelEn: string; labelPl: string; pill: string; borderLeft: string }
> = {
  task: {
    icon: CheckSquare,
    labelEn: 'Task',
    labelPl: 'Zadanie',
    pill: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    borderLeft: 'border-l-emerald-500 dark:border-l-emerald-400',
  },
  initiative: {
    icon: Lightbulb,
    labelEn: 'Initiative',
    labelPl: 'Inicjatywa',
    pill: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
    borderLeft: 'border-l-blue-500 dark:border-l-blue-400',
  },
  survey: {
    icon: CheckCircle2,
    labelEn: 'Survey',
    labelPl: 'Ankieta',
    pill: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-300',
    borderLeft: 'border-l-cyan-500 dark:border-l-cyan-400',
  },
  decision: {
    icon: Scale,
    labelEn: 'Decision',
    labelPl: 'Decyzja',
    pill: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300',
    borderLeft: 'border-l-amber-500 dark:border-l-amber-400',
  },
  notification: {
    icon: Bell,
    labelEn: 'Notification',
    labelPl: 'Notyfikacja',
    pill: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300',
    borderLeft: 'border-l-red-500 dark:border-l-red-400',
  },
};

const getEntityKind = (item: InboxItem): InboxEntityKind => {
  const key = String(item._key || '');
  if (key.startsWith('task:')) return 'task';
  if (key.startsWith('decision:')) return 'decision';
  if (key.startsWith('notification:')) return 'notification';

  // Fallbacks for seeded / legacy item.type values
  switch (item.type) {
    case 'new_assignment':
      return 'task';
    case 'decision_request':
      return 'decision';
    case 'review_request':
      return 'survey';
    case 'project_update':
      return 'initiative';
    case 'mention':
    case 'system_alert':
    case 'billing_alert':
    case 'ai_suggestion':
      return 'notification';
    case 'escalation':
      return 'task';
    default:
      return 'notification';
  }
};

interface InboxItem {
  id: string;
  type: InboxItemType;
  section: InboxSection;
  title: string;
  description?: string;
  source?: { type: 'user' | 'system' | 'ai'; userName?: string };
  receivedAt: string;
  dueDate?: string;
  urgency: InboxUrgency;
  severity?: 'INFO' | 'WARNING' | 'CRITICAL';
  sla?: {
    dueAt: string;
    remainingMs: number;
    isBreached: boolean;
    level: SlaLevel;
  };
  linkedTaskId?: string;
  linkedDecisionId?: string;
  triaged: boolean;
  triageAction?: TriageAction;
  itemStatus: 'open' | 'done' | 'saved' | 'snoozed' | 'dismissed';
  reason: string;
  isActionable: boolean;
  suggestedAction?: TriageAction;
  suggestedReason?: string;
  /** V4-INBX-03: AI confidence 0–1 for threshold/undo */
  suggestedConfidence?: number;
  /** V4-INBX-01: Canonical type (task|decision|approval|signal) */
  itemType?: 'task' | 'decision' | 'approval' | 'signal';
  _key: InboxItemKey;
}

interface InboxSummary {
  total: number;
  critical: number;
  newToday: number;
  actionRequired?: number;
  counts?: {
    open: number;
    done: number;
    saved: number;
    dismissed: number;
  };
}

interface InboxResponse {
  summary: InboxSummary;
  items: InboxItem[];
}

interface InboxAIEvalRun {
  id: string;
  ran_at: string;
  total_items: number;
  correct: number;
  accuracy: number;
  cost_usd: number | null;
}

interface InboxAICostSummary {
  totalCostUsd: number;
  callCount: number;
  days: number;
}

export interface InboxCounts {
  total: number;
  critical: number;
  actionRequired: number;
  /** Items that are overdue / SLA-breached (derived client-side). */
  overdue: number;
  /** Items with AI origin / AI insights (derived client-side). */
  ai: number;
  newToday: number;
  newThisWeek: number;
  counts: {
    open: number;
    done: number;
    saved: number;
  };
}

export type InboxBulkTriageAction = 'accept_today' | 'accept_week' | 'done' | 'save' | 'dismiss';
export type InboxBulkBarPayload = {
  selectedCount: number;
  allSelected: boolean;
  someSelected: boolean;
  selectAllVisible: () => void;
  clearSelection: () => void;
  triage: (action: InboxBulkTriageAction) => void;
};

interface InboxContentProps {
  searchQuery: string;
  onOpenTask?: (taskId: string) => void;
  onOpenDecision?: (decisionId: string) => void;
  onOpenNotification?: (notificationId: string) => void;
  onCountsChange: (counts: InboxCounts) => void;
  refreshTrigger?: number;
  /** Controlled view mode (rendered by MyWork topbar in v3) */
  viewMode?: InboxViewMode;
  /** Controlled view mode change handler */
  onViewModeChange?: (mode: InboxViewMode) => void;
  /** Controlled: status tab (Open/Done/Saved/All) */
  statusTab?: InboxStatusTab;
  onStatusTabChange?: (tab: InboxStatusTab) => void;
  /** Controlled: received time scope filter */
  inboxSection?: 'today' | 'this_week' | 'all';
  onInboxSectionChange?: (section: 'today' | 'this_week' | 'all') => void;
  /** Controlled: action-required filter */
  actionRequiredOnly?: boolean;
  onActionRequiredOnlyChange?: (next: boolean) => void;
  /** Controlled: critical-only preset (Command Row). */
  criticalOnly?: boolean;
  onCriticalOnlyChange?: (next: boolean) => void;
  /** Controlled: overdue-only preset (Command Row). */
  overdueOnly?: boolean;
  onOverdueOnlyChange?: (next: boolean) => void;
  /** Controlled: AI-only preset (Command Row). */
  aiOnly?: boolean;
  onAiOnlyChange?: (next: boolean) => void;
  /** V3-A03: command row override mode (bulk selection) */
  onBulkBarChange?: (payload: InboxBulkBarPayload | null) => void;
}

// ── Deduplication: group items by _key ──
interface InboxGroup {
  key: string;
  representative: InboxItem;
  items: InboxItem[];
  count: number;
}

const groupItems = (items: InboxItem[]): InboxGroup[] => {
  const map = new Map<string, InboxItem[]>();
  for (const item of items) {
    const existing = map.get(item._key);
    if (existing) existing.push(item);
    else map.set(item._key, [item]);
  }
  return Array.from(map.entries()).map(([key, groupItems]) => ({
    key,
    representative: groupItems[0],
    items: groupItems,
    count: groupItems.length,
  }));
};

// ── Urgency config ──
const urgencyConfig: Record<
  InboxUrgency,
  { icon: React.ElementType; pill: string; label: string; heatColor: string }
> = {
  critical: {
    icon: AlertTriangle,
    pill: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
    label: 'Critical',
    heatColor: 'border-l-red-500',
  },
  high: {
    icon: AlertCircle,
    pill: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    label: 'High',
    heatColor: 'border-l-amber-500',
  },
  normal: {
    icon: Clock,
    pill: 'bg-slate-100 text-slate-700 dark:bg-navy-800 dark:text-slate-200',
    label: 'Normal',
    heatColor: 'border-l-slate-300 dark:border-l-navy-600',
  },
  low: {
    icon: Calendar,
    pill: 'bg-slate-50 text-slate-600 dark:bg-navy-900/40 dark:text-slate-300',
    label: 'Low',
    heatColor: 'border-l-slate-200 dark:border-l-navy-700',
  },
};

// ── Type icons / labels ──
const typeIcon: Record<InboxItemType, React.ElementType> = {
  new_assignment: Inbox,
  mention: Bell,
  escalation: AlertTriangle,
  review_request: AlertCircle,
  decision_request: Scale,
  ai_suggestion: AlertCircle,
  system_alert: Bell,
  billing_alert: AlertCircle,
  project_update: Inbox,
};

const typeLabel: Record<InboxItemType, string> = {
  new_assignment: 'assignment',
  mention: 'mention',
  escalation: 'escalation',
  review_request: 'review',
  decision_request: 'decision',
  ai_suggestion: 'ai insight',
  system_alert: 'system',
  billing_alert: 'billing',
  project_update: 'project',
};

// ── Section config for smart grouping ──
const SMART_SECTIONS: {
  id: InboxSection;
  labelEn: string;
  labelPl: string;
  icon: React.ElementType;
  color: string;
}[] = [
  {
    id: 'decisions_required',
    labelEn: 'Requires Your Decision',
    labelPl: 'Wymaga Twojej decyzji',
    icon: Scale,
    color: 'text-purple-500',
  },
  {
    id: 'approvals_gates',
    labelEn: 'Approvals & Gates',
    labelPl: 'Akceptacje i bramki',
    icon: CheckCheck,
    color: 'text-blue-500',
  },
  {
    id: 'blocked_escalations',
    labelEn: 'Blocked — Needs Unblocking',
    labelPl: 'Zablokowane — do odblokowania',
    icon: AlertTriangle,
    color: 'text-red-500',
  },
  {
    id: 'overdue_sla_breach',
    labelEn: 'Overdue / SLA Breach',
    labelPl: 'Po terminie / SLA',
    icon: Clock,
    color: 'text-red-600',
  },
  {
    id: 'assigned_tasks',
    labelEn: 'New Assignments',
    labelPl: 'Nowe zadania',
    icon: CheckSquare,
    color: 'text-blue-400',
  },
  {
    id: 'ai_insights',
    labelEn: 'AI Insights & Signals',
    labelPl: 'AI Insights i sygnały',
    icon: AlertCircle,
    color: 'text-cyan-500',
  },
  {
    id: 'fyi_system',
    labelEn: 'System Notifications',
    labelPl: 'Powiadomienia systemowe',
    icon: Bell,
    color: 'text-slate-500',
  },
  {
    id: 'fyi_mentions',
    labelEn: 'Mentions & FYI',
    labelPl: 'Wzmianki i FYI',
    icon: MessageSquare,
    color: 'text-amber-500',
  },
  { id: 'other', labelEn: 'Other', labelPl: 'Inne', icon: Inbox, color: 'text-slate-400' },
];

// ── Relative time formatting ──
const formatRelativeTime = (
  iso: string,
  isPolish: boolean
): { text: string; agingLevel: 'fresh' | 'warm' | 'hot' | 'critical' } => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { text: iso, agingLevel: 'fresh' };

  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  let text: string;
  if (diffMins < 1) text = isPolish ? 'Przed chwilą' : 'Just now';
  else if (diffMins < 60) text = isPolish ? `${diffMins} min temu` : `${diffMins}m ago`;
  else if (diffHours < 24) text = isPolish ? `${diffHours} godz. temu` : `${diffHours}h ago`;
  else if (diffDays < 7) text = isPolish ? `${diffDays} d temu` : `${diffDays}d ago`;
  else
    text = d.toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', { month: 'short', day: 'numeric' });

  let agingLevel: 'fresh' | 'warm' | 'hot' | 'critical';
  if (diffHours < 4) agingLevel = 'fresh';
  else if (diffHours < 24) agingLevel = 'warm';
  else if (diffDays < 3) agingLevel = 'hot';
  else agingLevel = 'critical';

  return { text, agingLevel };
};

const AGING_STYLES = {
  fresh: 'text-emerald-600 dark:text-emerald-400',
  warm: 'text-amber-600 dark:text-amber-400',
  hot: 'text-orange-600 dark:text-orange-400',
  critical: 'text-red-600 dark:text-red-400 animate-pulse',
};

// ── SLA pill ──
const slaPill = (sla: InboxItem['sla']): { label: string; className: string; title?: string } => {
  if (!sla) return { label: '-', className: 'text-slate-300 dark:text-slate-600' };
  const abs = Math.abs(sla.remainingMs);
  const days = Math.floor(abs / 86400000);
  const hours = Math.floor((abs % 86400000) / 3600000);
  const timeStr = days > 0 ? `${days}d` : `${Math.max(1, hours)}h`;
  const label =
    sla.level === 'none'
      ? 'OK'
      : sla.isBreached
        ? `${sla.level} +${timeStr}`
        : `${sla.level} ${timeStr}`;
  const className =
    sla.level === 'none'
      ? 'bg-slate-100 text-slate-700 dark:bg-navy-800 dark:text-slate-200'
      : sla.level === 'L1'
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
        : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300';
  return { label, className, title: sla.dueAt ? `due: ${sla.dueAt}` : undefined };
};

// ── Snooze helpers ──
const SNOOZE_PRESETS: { id: SnoozePreset; labelEn: string; labelPl: string }[] = [
  { id: '2h', labelEn: '2 hours', labelPl: '2 godziny' },
  { id: 'tomorrow', labelEn: 'Tomorrow morning', labelPl: 'Jutro rano' },
  { id: '3d', labelEn: '3 days', labelPl: '3 dni' },
  { id: 'next_monday', labelEn: 'Next Monday', labelPl: 'Poniedziałek' },
];

// ── Filter options ──
const INBOX_STATUS_FILTER_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'done', label: 'Done' },
  { value: 'saved', label: 'Saved' },
  { value: 'dismissed', label: 'Dismissed' },
];

const INBOX_URGENCY_FILTER_OPTIONS = [
  { value: 'critical', label: 'Critical', color: 'text-red-500' },
  { value: 'high', label: 'High', color: 'text-amber-500' },
  { value: 'normal', label: 'Normal', color: 'text-slate-500' },
  { value: 'low', label: 'Low', color: 'text-slate-400' },
];

const INBOX_TYPE_FILTER_OPTIONS = [
  { value: 'new_assignment', label: 'Assignment' },
  { value: 'mention', label: 'Mention' },
  { value: 'escalation', label: 'Escalation' },
  { value: 'review_request', label: 'Review' },
  { value: 'decision_request', label: 'Decision' },
  { value: 'ai_suggestion', label: 'AI Insight' },
  { value: 'system_alert', label: 'System' },
  { value: 'billing_alert', label: 'Billing' },
  { value: 'project_update', label: 'Project' },
];

const INBOX_SECTION_FILTER_OPTIONS = [
  { value: 'decisions_required', label: 'Decisions required' },
  { value: 'approvals_gates', label: 'Approvals & gates' },
  { value: 'assigned_tasks', label: 'Assigned tasks' },
  { value: 'blocked_escalations', label: 'Blocked / escalations' },
  { value: 'overdue_sla_breach', label: 'Overdue / SLA breach' },
  { value: 'fyi_system', label: 'System notifications' },
  { value: 'fyi_mentions', label: 'Mentions & FYI' },
  { value: 'ai_insights', label: 'AI Insights' },
  { value: 'other', label: 'Other' },
];

// N13: Source / Creator filter
const INBOX_SOURCE_FILTER_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'ai', label: 'AI' },
  { value: 'user', label: 'User / Team' },
];

// ── Column definitions ──
const INBOX_COLUMNS: ColumnDef[] = [
  {
    id: 'select',
    label: '',
    width: 40,
    minWidth: 40,
    maxWidth: 40,
    resizable: false,
    filterable: false,
  },
  { id: 'title', label: 'Title', width: 999, minWidth: 300, resizable: false, filterable: false },
  {
    id: 'status',
    label: 'Status',
    width: 100,
    minWidth: 80,
    maxWidth: 140,
    resizable: true,
    filterable: true,
    filterType: 'multiselect',
    filterOptions: INBOX_STATUS_FILTER_OPTIONS,
  },
  {
    id: 'urgency',
    label: 'Urgency',
    width: 110,
    minWidth: 80,
    maxWidth: 150,
    resizable: true,
    filterable: true,
    filterType: 'multiselect',
    filterOptions: INBOX_URGENCY_FILTER_OPTIONS,
  },
  {
    id: 'type',
    label: 'Type',
    width: 120,
    minWidth: 90,
    maxWidth: 160,
    resizable: true,
    filterable: true,
    filterType: 'multiselect',
    filterOptions: INBOX_TYPE_FILTER_OPTIONS,
  },
  {
    id: 'section',
    label: 'Section',
    width: 150,
    minWidth: 110,
    maxWidth: 220,
    resizable: true,
    filterable: true,
    filterType: 'multiselect',
    filterOptions: INBOX_SECTION_FILTER_OPTIONS,
  },
  {
    id: 'source',
    label: 'Source',
    width: 110,
    minWidth: 90,
    maxWidth: 170,
    resizable: true,
    filterable: true,
    filterType: 'multiselect',
    filterOptions: INBOX_SOURCE_FILTER_OPTIONS,
  },
  {
    id: 'received',
    label: 'Received',
    width: 120,
    minWidth: 90,
    maxWidth: 160,
    resizable: true,
    filterable: false,
  },
  {
    id: 'sla',
    label: 'SLA',
    width: 100,
    minWidth: 70,
    maxWidth: 140,
    resizable: true,
    filterable: false,
  },
  {
    id: 'actions',
    label: '',
    // App Table Standard: actions column is kebab-only (compact).
    width: 64,
    minWidth: 56,
    maxWidth: 72,
    resizable: false,
    filterable: false,
    align: 'right',
  },
];

const getDefaultColumnWidths = (): ColumnWidths =>
  INBOX_COLUMNS.reduce((acc, col) => ({ ...acc, [col.id]: col.width }), {});

const INBOX_TABLE_VIEW_STORAGE_KEY = 'consultify-inbox-table-view';
const INBOX_TABLE_DEFAULT_HIDDEN_COLUMNS = ['type', 'section', 'source'] as const;
const INBOX_AI_SETTINGS_STORAGE_KEY = 'consultify-inbox-ai-settings';

function loadInboxHiddenColumns(): string[] {
  try {
    const raw = localStorage.getItem(INBOX_TABLE_VIEW_STORAGE_KEY);
    if (!raw) return [...INBOX_TABLE_DEFAULT_HIDDEN_COLUMNS];
    const parsed = JSON.parse(raw) as { hiddenColumns?: unknown };
    const arr = Array.isArray(parsed?.hiddenColumns) ? parsed.hiddenColumns : null;
    if (!arr) return [...INBOX_TABLE_DEFAULT_HIDDEN_COLUMNS];
    return arr.filter((x) => typeof x === 'string') as string[];
  } catch {
    return [...INBOX_TABLE_DEFAULT_HIDDEN_COLUMNS];
  }
}

function saveInboxHiddenColumns(hiddenColumns: string[]) {
  try {
    localStorage.setItem(
      INBOX_TABLE_VIEW_STORAGE_KEY,
      JSON.stringify({ hiddenColumns: Array.from(new Set(hiddenColumns)).sort() })
    );
  } catch {
    // ignore
  }
}

function loadInboxAITriageThreshold(): number {
  try {
    const raw = localStorage.getItem(INBOX_AI_SETTINGS_STORAGE_KEY);
    if (!raw) return 0.85;
    const parsed = JSON.parse(raw) as { threshold?: unknown };
    const threshold = typeof parsed?.threshold === 'number' ? parsed.threshold : 0.85;
    return Math.max(0.5, Math.min(0.99, threshold));
  } catch {
    return 0.85;
  }
}

function saveInboxAITriageThreshold(threshold: number) {
  try {
    localStorage.setItem(
      INBOX_AI_SETTINGS_STORAGE_KEY,
      JSON.stringify({ threshold: Math.max(0.5, Math.min(0.99, threshold)) })
    );
  } catch {
    // ignore
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Preview Pane (A3 — Canonical Anatomy)
//
// Sections (top → bottom, "above the fold = decision"):
//   1. Shell header  — type pill + title + [Open] + [X]
//   2. Meta row      — urgency · received (aging) · SLA
//   3. Triage bar    — Focus (Today/Week/Later) · Done/Save/Dismiss
//   4. AI suggest    — purple block + Apply  (only when suggestedAction)
//   5. Why           — reason info block
//   6. Description   — full text (scrollable)
//   7. Key fields    — 2-col grid (due date, section)
//   8. Relations     — linked task / decision
//   9. Snooze        — collapsible secondary
// ═══════════════════════════════════════════════════════════════════════════════
const PreviewPane: React.FC<{
  item: InboxItem;
  isPolish: boolean;
  onClose: () => void;
  onOpen: () => void;
  onTriage: (action: TriageAction) => void;
  onSnooze: (preset: SnoozePreset) => void;
  onSaveAsNote?: (item: InboxItem) => void;
  onUndoLastAI?: () => void;
}> = ({ item, isPolish, onClose, onOpen, onTriage, onSnooze, onSaveAsNote, onUndoLastAI }) => {
  const u = urgencyConfig[item.urgency] || urgencyConfig.normal;
  const UIcon = u.icon;
  const sla = slaPill(item.sla);
  const { text: receivedText, agingLevel } = formatRelativeTime(item.receivedAt, isPolish);
  const sectionDef = SMART_SECTIONS.find((s) => s.id === item.section);
  const SectionIcon = sectionDef?.icon || Inbox;
  const entityKind = getEntityKind(item);
  const kindCfg = ENTITY_KIND_CONFIG[entityKind];
  const KindIcon = kindCfg.icon;

  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [detailsMenuOpen, setDetailsMenuOpen] = useState(false);
  const [detailsOverride, setDetailsOverride] = useState<string | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<{
    brief: string;
    bullets: string[];
    recommendedAction: TriageAction;
    recommendedReason: string;
  } | null>(null);

  const runAi = useCallback(async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = (await Api.post('/my-work/inbox/ai-assist', {
        language: isPolish ? 'pl' : 'en',
        item: {
          title: item.title,
          description: item.description,
          type: item.type,
          section: item.section,
          urgency: item.urgency,
          receivedAt: item.receivedAt,
          dueDate: item.dueDate,
          sla: item.sla,
          reason: item.reason,
          linkedTaskId: item.linkedTaskId,
          linkedDecisionId: item.linkedDecisionId,
          source: item.source
            ? { type: item.source.type, userName: item.source.userName }
            : undefined,
        },
      })) as any;
      const r = res?.result;
      if (!r?.brief || !r?.recommendedAction) throw new Error('Invalid AI response');
      setAiResult({
        brief: String(r.brief),
        bullets: Array.isArray(r.bullets)
          ? r.bullets.map((x: any) => String(x)).filter(Boolean)
          : [],
        recommendedAction: r.recommendedAction as TriageAction,
        recommendedReason: String(r.recommendedReason || ''),
      });
    } catch (e: any) {
      setAiError(e?.message || (isPolish ? 'AI niedostępne' : 'AI unavailable'));
    } finally {
      setAiLoading(false);
    }
  }, [isPolish, item]);

  useEffect(() => {
    setAiResult(null);
    setAiError(null);
    setDetailsOverride(null);
    runAi();
  }, [item._key]); // eslint-disable-line react-hooks/exhaustive-deps

  const descriptionTrimmed = (item.description || '').trim();

  const detailsDisplayText = detailsOverride
    ? detailsOverride
    : aiResult
      ? [
          aiResult.brief,
          ...(aiResult.bullets || []).map((b) => `• ${b}`),
          aiResult.recommendedReason ? `\n${aiResult.recommendedReason}` : '',
        ]
          .filter(Boolean)
          .join('\n')
      : descriptionTrimmed + (aiError ? `\n\n${aiError}` : '');

  const handleDetailsAction = useCallback(
    async (action: 'expand' | 'summarize' | 'copy') => {
      if (action === 'copy') {
        const textToCopy =
          detailsOverride || aiResult?.brief
            ? [aiResult?.brief, ...(aiResult?.bullets || []).map((b) => `• ${b}`)]
                .filter(Boolean)
                .join('\n')
            : descriptionTrimmed;
        try {
          await navigator.clipboard.writeText(textToCopy || '');
          toast.success(isPolish ? 'Skopiowano' : 'Copied');
        } catch {
          toast.error(isPolish ? 'Nie udało się skopiować' : 'Copy failed');
        }
        return;
      }
      setDetailsLoading(true);
      try {
        const prompt =
          action === 'expand'
            ? isPolish
              ? `Rozwiń poniższy opis narzędzia. Wyjaśnij kontekst, cel i co użytkownik powinien z tym zrobić. Pisz zwięźle, max 4-5 zdań.\n\nTytuł: ${item.title}\nOpis: ${descriptionTrimmed || 'Brak opisu'}`
              : `Expand the following tool description. Explain context, purpose and what the user should do. Be concise, max 4-5 sentences.\n\nTitle: ${item.title}\nDescription: ${descriptionTrimmed || 'No description'}`
            : isPolish
              ? `Podsumuj poniższy element w 1-2 zdaniach. Co to jest i co z tym zrobić?\n\nTytuł: ${item.title}\nOpis: ${descriptionTrimmed || 'Brak opisu'}`
              : `Summarize the following item in 1-2 sentences. What is it and what to do?\n\nTitle: ${item.title}\nDescription: ${descriptionTrimmed || 'No description'}`;

        const res = (await Api.post('/my-work/inbox/ai-assist', {
          language: isPolish ? 'pl' : 'en',
          item: {
            title: item.title,
            description: prompt,
            type: item.type,
            section: item.section,
            urgency: item.urgency,
            receivedAt: item.receivedAt,
            dueDate: item.dueDate,
            sla: item.sla,
            reason: item.reason,
            linkedTaskId: item.linkedTaskId,
            linkedDecisionId: item.linkedDecisionId,
            source: item.source
              ? { type: item.source.type, userName: item.source.userName }
              : undefined,
          },
        })) as any;
        const r = res?.result;
        if (r?.brief) {
          const full = [
            r.brief,
            ...(Array.isArray(r.bullets) ? r.bullets : []).map((b: string) => `• ${b}`),
          ]
            .filter(Boolean)
            .join('\n');
          setDetailsOverride(full);
        }
      } catch {
        toast.error(isPolish ? 'AI niedostępne' : 'AI unavailable');
      } finally {
        setDetailsLoading(false);
      }
    },
    [isPolish, item, descriptionTrimmed, detailsOverride, aiResult]
  );

  const metaPills: MetaPill[] = [
    { label: isPolish ? kindCfg.labelPl : kindCfg.labelEn, className: kindCfg.pill, icon: KindIcon },
    { label: u.label, className: u.pill, icon: UIcon },
  ];

  const metaTrailing = (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <span className={`text-[11px] font-medium ${AGING_STYLES[agingLevel]}`}>
        {receivedText}
      </span>
      {item.sla && sla.label !== '-' ? (
        <>
          <span className="text-slate-300 dark:text-navy-600">·</span>
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${sla.className}`}
          >
            SLA {sla.label}
          </span>
        </>
      ) : null}
    </div>
  );

  const relationItems: RelationItem[] = [
    ...(item.linkedTaskId
      ? [
          {
            label: `Task ${item.linkedTaskId.slice(0, 8)}…`,
            icon: CheckSquare,
            tone: 'text-emerald-600 dark:text-emerald-400',
          } as RelationItem,
        ]
      : []),
    ...(item.linkedDecisionId
      ? [
          {
            label: `${isPolish ? 'Decyzja' : 'Decision'} ${item.linkedDecisionId.slice(0, 8)}…`,
            icon: Scale,
            tone: 'text-amber-600 dark:text-amber-400',
          } as RelationItem,
        ]
      : []),
  ];

  const actionRows: ActionRow[] = [
    {
      buttons: [
        {
          label: isPolish ? 'Dziś' : 'Today',
          icon: Zap,
          onClick: () => onTriage('accept_today'),
          colorScheme: 'emerald',
          flex: true,
        },
        {
          label: isPolish ? 'Tydzień' : 'Week',
          icon: CalendarClock,
          onClick: () => onTriage('accept_week'),
          colorScheme: 'blue',
          flex: true,
        },
        {
          label: isPolish ? 'Później' : 'Later',
          icon: Calendar,
          onClick: () => onTriage('accept_later'),
          colorScheme: 'neutral',
          flex: true,
        },
      ],
    },
    {
      columns: onSaveAsNote ? 4 : 3,
      buttons: [
        {
          label: isPolish ? 'Gotowe' : 'Done',
          icon: CheckCircle2,
          onClick: () => onTriage('done'),
          colorScheme: 'green',
        },
        {
          label: isPolish ? 'Zapisz' : 'Save',
          icon: Bookmark,
          onClick: () => onTriage('save'),
          colorScheme: 'amber',
        },
        ...(onSaveAsNote
          ? [
              {
                label: isPolish ? 'Notatka' : 'Note',
                icon: FileText,
                onClick: () => onSaveAsNote(item),
                colorScheme: 'neutral' as const,
              },
            ]
          : []),
        {
          label: isPolish ? 'Odłóż' : 'Dismiss',
          icon: Archive,
          onClick: () => onTriage('dismiss'),
          colorScheme: 'neutral',
        },
      ],
    },
  ];

  return (
    <PreviewPaneShell
      kicker={undefined}
      title={item.title || (isPolish ? 'Inbox item' : 'Inbox item')}
      onClose={onClose}
      actions={
        <button
          onClick={onOpen}
          className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-medium border border-slate-200/70 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors"
        >
          <Eye size={12} />
          {isPolish ? 'Otwórz' : 'Open'}
        </button>
      }
      footer={
        <div className="space-y-0">
          {/* ── AI hint chips ── */}
          <AIHintStrip
            item={item}
            isPolish={isPolish}
            loading={aiLoading}
            onRun={runAi}
            onApplyAction={onTriage}
            result={aiResult}
            onClear={() => {
              setAiResult(null);
              setAiError(null);
            }}
          />

          <div className="border-t border-slate-200/50 dark:border-white/[0.06] my-3" />

          {/* ── Linked documents ── */}
          <PreviewRelations items={relationItems} />

          <div className="border-t border-slate-200/50 dark:border-white/[0.06] my-3" />

          {/* ── Action buttons ── */}
          <PreviewActionBar rows={actionRows} />

          <div className="pt-1.5">
            <button
              onClick={() => setSnoozeOpen(!snoozeOpen)}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            >
              <Clock size={14} />
              {isPolish ? 'Odłóż na…' : 'Snooze…'}
              <ChevronDown
                size={12}
                className={`transition-transform ${snoozeOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {snoozeOpen ? (
              <div className="flex flex-wrap gap-2 mt-2">
                {SNOOZE_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => onSnooze(p.id)}
                    className={`${actionPillClass('amber', 'h-8 px-3')}`}
                  >
                    <Clock size={13} />
                    {isPolish ? p.labelPl : p.labelEn}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {onUndoLastAI ? (
            <div className="pt-2 border-t border-slate-200/50 dark:border-white/[0.06]">
              <button
                onClick={onUndoLastAI}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
              >
                <Minus size={12} />
                {isPolish ? 'Cofnij ostatnią sugestię AI' : 'Undo last AI suggestion'}
              </button>
            </div>
          ) : null}
        </div>
      }
    >
      <div className="space-y-4">
        <PreviewMetaCard pills={metaPills} trailing={metaTrailing} />

        <PreviewDetailsSection
          text={detailsDisplayText}
          loading={detailsLoading || aiLoading}
          onExpand={() => handleDetailsAction('expand')}
          onSummarize={() => handleDetailsAction('summarize')}
          onCopy={() => handleDetailsAction('copy')}
        />
      </div>
    </PreviewPaneShell>
  );
};

const AI_HINT_CHIPCLASS =
  'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] font-medium border border-slate-200/70 dark:border-white/[0.08] bg-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-white/[0.04] transition-colors cursor-pointer active:scale-[0.98]';

const AIHintStrip: React.FC<{
  item: InboxItem;
  isPolish: boolean;
  loading: boolean;
  onRun: () => void;
  onApplyAction: (action: TriageAction) => void;
  result: {
    brief: string;
    bullets: string[];
    recommendedAction: TriageAction;
    recommendedReason: string;
  } | null;
  onClear: () => void;
}> = ({ item, isPolish, loading, onRun, onApplyAction, result, onClear }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const hints = useMemo(() => {
    const isCritical = item.urgency === 'critical' || item.urgency === 'high';
    const isDecision = String(item._key || '').startsWith('decision:');
    const isTask = String(item._key || '').startsWith('task:');

    if (isPolish) {
      if (isDecision) return ['Podsumuj kontekst', 'Zaproponuj opcje', 'Oceń ryzyko'];
      if (isCritical) return ['Dlaczego pilne?', 'Plan działania', 'Kto może pomóc?'];
      if (isTask) return ['Podsumuj zadanie', 'Next step', 'Oszacuj czas'];
      return ['Podsumuj', 'Co robić?', 'Zaproponuj triage'];
    }
    if (isDecision) return ['Summarize context', 'Propose options', 'Assess risk'];
    if (isCritical) return ['Why urgent?', 'Action plan', 'Who can help?'];
    if (isTask) return ['Summarize task', 'Next step', 'Estimate effort'];
    return ['Summarize', 'What to do?', 'Suggest triage'];
  }, [isPolish, item]);

  const actionLabel = (a: TriageAction): string => {
    const map: Record<string, Record<TriageAction, string>> = {
      pl: {
        accept_today: 'Dziś',
        accept_week: 'Tydzień',
        accept_later: 'Później',
        done: 'Gotowe',
        save: 'Zapisz',
        dismiss: 'Odłóż',
        archive: 'Archiwizuj',
        delegate: 'Deleguj',
        schedule: 'Zaplanuj',
        reject: 'Odrzuć',
        snooze: 'Odłóż',
      },
      en: {
        accept_today: 'Today',
        accept_week: 'Week',
        accept_later: 'Later',
        done: 'Done',
        save: 'Save',
        dismiss: 'Dismiss',
        archive: 'Archive',
        delegate: 'Delegate',
        schedule: 'Schedule',
        reject: 'Reject',
        snooze: 'Snooze',
      },
    };
    return (isPolish ? map.pl : map.en)[a] || a;
  };

  return (
    <div className="py-1">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
          <Sparkles size={12} />
          <span className="text-[10px] font-medium uppercase tracking-wider">AI</span>
        </div>

        <div className="relative flex items-center gap-1">
          {result ? (
            <button
              onClick={() => onApplyAction(result.recommendedAction)}
              className="inline-flex items-center gap-1 h-6 px-2 rounded-full text-[11px] font-medium border border-purple-400/30 dark:border-purple-500/20 bg-transparent text-purple-600 dark:text-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-500/10 transition-colors"
            >
              <Check size={11} />
              {actionLabel(result.recommendedAction)}
            </button>
          ) : null}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1 rounded-md text-slate-400 dark:text-slate-500 hover:bg-slate-200/50 dark:hover:bg-white/[0.06] transition-colors"
          >
            <MoreVertical size={13} />
          </button>
          {menuOpen ? (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 bottom-full mb-1 z-50 min-w-[170px] rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-white dark:bg-navy-900 shadow-lg py-1">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onRun();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors"
                >
                  <Sparkles size={12} className="text-purple-500" />
                  {isPolish ? 'Regeneruj' : 'Regenerate'}
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    if (result) {
                      navigator.clipboard
                        .writeText(
                          [result.brief, ...(result.bullets || []).map((b) => `- ${b}`)].join('\n')
                        )
                        .then(() => toast.success(isPolish ? 'Skopiowano' : 'Copied'));
                    }
                  }}
                  disabled={!result}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.04] disabled:opacity-40 transition-colors"
                >
                  <Copy size={12} />
                  {isPolish ? 'Kopiuj' : 'Copy'}
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onClear();
                  }}
                  disabled={!result}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.04] disabled:opacity-40 transition-colors"
                >
                  <X size={12} />
                  {isPolish ? 'Wyczyść' : 'Clear'}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {hints.map((hint, idx) => (
          <button key={idx} onClick={onRun} disabled={loading} className={AI_HINT_CHIPCLASS}>
            <Sparkles size={10} className="text-purple-400/70 dark:text-purple-500/70" />
            {hint}
          </button>
        ))}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════════
export const InboxContent: React.FC<InboxContentProps> = ({
  searchQuery,
  onOpenTask,
  onOpenDecision,
  onOpenNotification,
  onCountsChange,
  refreshTrigger,
  viewMode: controlledViewMode,
  onViewModeChange,
  statusTab: controlledStatusTab,
  onStatusTabChange,
  inboxSection: controlledInboxSection,
  onInboxSectionChange,
  actionRequiredOnly: controlledActionRequiredOnly,
  onActionRequiredOnlyChange,
  criticalOnly: controlledCriticalOnly,
  onCriticalOnlyChange,
  overdueOnly: controlledOverdueOnly,
  onOverdueOnlyChange,
  aiOnly: controlledAiOnly,
  onAiOnlyChange,
  onBulkBarChange,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');
  const { emitMyWorkEvent } = useAppStore();

  const [data, setData] = useState<InboxResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [uncontrolledViewMode, setUncontrolledViewMode] = useState<InboxViewMode>('flat');
  const viewMode = controlledViewMode ?? uncontrolledViewMode;
  const setViewMode = useCallback(
    (next: InboxViewMode) => {
      onViewModeChange?.(next);
      if (!controlledViewMode) setUncontrolledViewMode(next);
    },
    [controlledViewMode, onViewModeChange]
  );
  const [uncontrolledInboxSection, setUncontrolledInboxSection] = useState<
    'today' | 'this_week' | 'all'
  >('all');
  const inboxSection = controlledInboxSection ?? uncontrolledInboxSection;
  const setInboxSection = useCallback(
    (next: 'today' | 'this_week' | 'all') => {
      onInboxSectionChange?.(next);
      if (!controlledInboxSection) setUncontrolledInboxSection(next);
    },
    [controlledInboxSection, onInboxSectionChange]
  );

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Keyboard navigation
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const tableRef = useRef<HTMLDivElement>(null);

  // Column widths
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>(getDefaultColumnWidths());

  // View settings (Columns) — persisted
  const [isViewSettingsOpen, setIsViewSettingsOpen] = useState(false);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>(loadInboxHiddenColumns);
  const hiddenSet = useMemo(() => new Set(hiddenColumns), [hiddenColumns]);

  useEffect(() => {
    saveInboxHiddenColumns(hiddenColumns);
  }, [hiddenColumns]);

  // Filters
  const [tableFilters, setTableFilters] = useState<TableFilters>({});
  const [openFilterId, setOpenFilterId] = useState<string | null>(null);

  // Snooze
  const [snoozeOpenForId, setSnoozeOpenForId] = useState<string | null>(null);
  const [snoozedKeys, setSnoozedKeys] = useState<Set<string>>(new Set());

  // Expanded groups (for deduplication)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Collapsed sections (for smart sections view)
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // Preview pane (A3)
  const [previewItem, setPreviewItem] = useState<InboxItem | null>(null);

  // N1: Status tabs (Open / Done / Saved)
  const [uncontrolledStatusTab, setUncontrolledStatusTab] = useState<InboxStatusTab>('open');
  const statusTab = controlledStatusTab ?? uncontrolledStatusTab;
  const setStatusTab = useCallback(
    (next: InboxStatusTab) => {
      onStatusTabChange?.(next);
      if (!controlledStatusTab) setUncontrolledStatusTab(next);
    },
    [controlledStatusTab, onStatusTabChange]
  );

  // N2: Action Required filter
  const [uncontrolledActionRequiredOnly, setUncontrolledActionRequiredOnly] = useState(false);
  const actionRequiredOnly = controlledActionRequiredOnly ?? uncontrolledActionRequiredOnly;
  const setActionRequiredOnly = useCallback(
    (next: boolean) => {
      onActionRequiredOnlyChange?.(next);
      if (!controlledActionRequiredOnly) setUncontrolledActionRequiredOnly(next);
    },
    [controlledActionRequiredOnly, onActionRequiredOnlyChange]
  );

  // N2+: Preset filters (Command Row)
  const [uncontrolledCriticalOnly, setUncontrolledCriticalOnly] = useState(false);
  const criticalOnly = controlledCriticalOnly ?? uncontrolledCriticalOnly;
  const setCriticalOnly = useCallback(
    (next: boolean) => {
      onCriticalOnlyChange?.(next);
      if (!controlledCriticalOnly) setUncontrolledCriticalOnly(next);
    },
    [controlledCriticalOnly, onCriticalOnlyChange]
  );

  const [uncontrolledOverdueOnly, setUncontrolledOverdueOnly] = useState(false);
  const overdueOnly = controlledOverdueOnly ?? uncontrolledOverdueOnly;
  const setOverdueOnly = useCallback(
    (next: boolean) => {
      onOverdueOnlyChange?.(next);
      if (!controlledOverdueOnly) setUncontrolledOverdueOnly(next);
    },
    [controlledOverdueOnly, onOverdueOnlyChange]
  );

  const [uncontrolledAiOnly, setUncontrolledAiOnly] = useState(false);
  const aiOnly = controlledAiOnly ?? uncontrolledAiOnly;
  const setAiOnly = useCallback(
    (next: boolean) => {
      onAiOnlyChange?.(next);
      if (!controlledAiOnly) setUncontrolledAiOnly(next);
    },
    [controlledAiOnly, onAiOnlyChange]
  );

  // L4: Auto-triage
  const [autoTriageSuggestions, setAutoTriageSuggestions] = useState<any[]>([]);
  const [autoTriageLoading, setAutoTriageLoading] = useState(false);
  const [aiTriageThreshold, setAiTriageThreshold] = useState(loadInboxAITriageThreshold);
  const [canonicalStats, setCanonicalStats] = useState<any | null>(null);
  const [aiEvalRuns, setAiEvalRuns] = useState<InboxAIEvalRun[]>([]);
  const [aiCostSummary, setAiCostSummary] = useState<InboxAICostSummary | null>(null);
  const [aiOpsLoading, setAiOpsLoading] = useState(false);

  useEffect(() => {
    saveInboxAITriageThreshold(aiTriageThreshold);
  }, [aiTriageThreshold]);

  // ── Fetch ──
  const fetchInbox = useCallback(async () => {
    try {
      setLoading(true);
      await Api.materializeInbox().catch(() => null);
      const status =
        statusTab === 'all'
          ? 'all'
          : statusTab === 'done'
            ? 'done'
            : statusTab === 'saved'
              ? 'saved'
              : 'open';
      const [res, statsRes] = await Promise.all([
        Api.get(`/my-work/inbox?limit=200&status=${status}`) as Promise<InboxResponse>,
        Api.getCanonicalInboxStats().catch(() => null),
      ]);
      setData(res);
      setCanonicalStats(statsRes);
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekEnd = new Date(todayStart.getTime() + 7 * 86400000);
      const items = res?.items || [];
      const newToday = items.filter((i) => new Date(i.receivedAt || '') >= todayStart).length;
      const newThisWeek = items.filter((i) => {
        const d = new Date(i.receivedAt || '');
        return d >= todayStart && d < weekEnd;
      }).length;

      const nowTs = Date.now();
      const overdue = items.filter((i) => {
        if (i.itemStatus !== 'open') return false;
        if (i.sla?.isBreached) return true;
        if (i.sla?.dueAt) {
          const due = new Date(i.sla.dueAt).getTime();
          return Number.isFinite(due) && due < nowTs;
        }
        if (i.dueDate) {
          const due = new Date(i.dueDate).getTime();
          return Number.isFinite(due) && due < nowTs;
        }
        return false;
      }).length;

      const ai = items.filter((i) => {
        const src = i.source?.type || 'system';
        if (src === 'ai') return true;
        if (i.type === 'ai_suggestion') return true;
        if (i.section === 'ai_insights') return true;
        return false;
      }).length;

      onCountsChange({
        total: res?.summary?.total || 0,
        critical: res?.summary?.critical || 0,
        actionRequired: res?.summary?.actionRequired || 0,
        overdue,
        ai,
        newToday: res?.summary?.newToday ?? newToday,
        newThisWeek,
        counts: {
          open: res?.summary?.counts?.open || 0,
          done: res?.summary?.counts?.done || 0,
          saved: res?.summary?.counts?.saved || 0,
        },
      });
    } catch (e) {
      console.error('Failed to load inbox', e);
      toast.error(isPolish ? 'Nie udało się załadować Inbox' : 'Failed to load Inbox');
    } finally {
      setLoading(false);
    }
  }, [isPolish, onCountsChange, statusTab]);

  useEffect(() => {
    fetchInbox();
  }, [fetchInbox, refreshTrigger]);

  const fetchAIOperations = useCallback(async () => {
    try {
      setAiOpsLoading(true);
      const [runsRes, costRes] = await Promise.all([
        Api.getInboxEvalRuns(5).catch(() => ({ runs: [] })),
        Api.getInboxEvalsCostSummary(30).catch(() => null),
      ]);
      setAiEvalRuns(Array.isArray(runsRes?.runs) ? runsRes.runs : []);
      setAiCostSummary(costRes);
    } finally {
      setAiOpsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAIOperations();
  }, [fetchAIOperations]);

  // ── Items with search + section filtering ──
  const items = useMemo(() => {
    let all = data?.items || [];
    const q = (searchQuery || '').trim().toLowerCase();
    if (q) {
      all = all.filter((i) => `${i.title || ''} ${i.description || ''}`.toLowerCase().includes(q));
    }
    if (inboxSection !== 'all') {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekEnd = new Date(todayStart.getTime() + 7 * 86400000);
      all = all.filter((i) => {
        const d = new Date(i.receivedAt || '');
        if (inboxSection === 'today') return d >= todayStart;
        if (inboxSection === 'this_week') return d >= todayStart && d < weekEnd;
        return true;
      });
    }
    // Filter snoozed
    all = all.filter((i) => !snoozedKeys.has(i._key));
    return all;
  }, [data?.items, searchQuery, inboxSection, snoozedKeys]);

  // ── Apply table filters ──
  const filteredItems = useMemo(() => {
    let result = [...items];
    const statusFilter = tableFilters.status as string[] | undefined;
    const urgencyFilter = tableFilters.urgency as string[] | undefined;
    const typeFilter = tableFilters.type as string[] | undefined;
    const sectionFilter = tableFilters.section as string[] | undefined;

    if (statusFilter?.length) {
      result = result.filter((item) => statusFilter.includes(item.itemStatus || 'open'));
    }
    if (urgencyFilter?.length)
      result = result.filter((item) => urgencyFilter.includes(item.urgency));
    if (typeFilter?.length) result = result.filter((item) => typeFilter.includes(item.type));
    if (sectionFilter?.length)
      result = result.filter((item) => sectionFilter.includes(item.section));
    const sourceFilter = tableFilters.source as string[] | undefined;
    if (sourceFilter?.length)
      result = result.filter((item) => sourceFilter.includes(item.source?.type || 'system'));
    // N2: Action required filter
    if (actionRequiredOnly) result = result.filter((item) => item.isActionable);

    if (criticalOnly)
      result = result.filter((item) => item.urgency === 'critical' || item.severity === 'CRITICAL');

    if (overdueOnly) {
      const nowTs = Date.now();
      result = result.filter((item) => {
        if (item.itemStatus !== 'open') return false;
        if (item.sla?.isBreached) return true;
        if (item.sla?.dueAt) {
          const due = new Date(item.sla.dueAt).getTime();
          return Number.isFinite(due) && due < nowTs;
        }
        if (item.dueDate) {
          const due = new Date(item.dueDate).getTime();
          return Number.isFinite(due) && due < nowTs;
        }
        return false;
      });
    }

    if (aiOnly)
      result = result.filter((item) => {
        const src = item.source?.type || 'system';
        if (src === 'ai') return true;
        if (item.type === 'ai_suggestion') return true;
        if (item.section === 'ai_insights') return true;
        return false;
      });

    return result;
  }, [items, tableFilters, actionRequiredOnly, aiOnly, criticalOnly, overdueOnly]);

  // ── Deduplicated groups ──
  const groups = useMemo(() => groupItems(filteredItems), [filteredItems]);

  // ── Flat display list (respecting expanded groups) ──
  const displayItems = useMemo(() => {
    const result: (InboxGroup & { isExpanded: boolean })[] = [];
    for (const group of groups) {
      result.push({ ...group, isExpanded: expandedGroups.has(group.key) });
    }
    return result;
  }, [groups, expandedGroups]);

  // ── Smart sections grouping ──
  const sectionGroups = useMemo(() => {
    if (viewMode !== 'sections') return null;
    const map = new Map<InboxSection, InboxGroup[]>();
    for (const section of SMART_SECTIONS) {
      map.set(section.id, []);
    }
    for (const group of groups) {
      const section = group.representative.section;
      const arr = map.get(section) || map.get('other')!;
      arr.push(group);
    }
    return map;
  }, [groups, viewMode]);

  // ── Triage ──
  const triage = useCallback(
    async (
      item: InboxItem,
      action: TriageAction,
      opts?: { fromAISuggestion?: boolean; confidence?: number }
    ) => {
      if (action === 'snooze') return;
      try {
        await Api.post(`/my-work/inbox/${encodeURIComponent(item.id)}/triage`, {
          action,
          itemKey: item._key,
          ...(opts?.fromAISuggestion && {
            fromAISuggestion: true,
            confidence: opts.confidence ?? item.suggestedConfidence,
          }),
        });
        // Optimistic: remove from current view (item moves to different status tab)
        setData((prev) => {
          if (!prev) return prev;
          return { ...prev, items: prev.items.filter((x) => x._key !== item._key) };
        });
        if (previewItem?._key === item._key) setPreviewItem(null);
        const labels: Record<string, string> = {
          accept_today: isPolish ? 'Focus → Dziś' : 'Focus → Today',
          accept_week: isPolish ? 'Focus → Ten tydzień' : 'Focus → This week',
          accept_later: isPolish ? 'Focus → Później' : 'Focus → Later',
          done: isPolish ? 'Oznaczono jako gotowe' : 'Marked as done',
          save: isPolish ? 'Zapisano' : 'Saved for later',
          dismiss: isPolish ? 'Odłożono' : 'Dismissed',
          archive: isPolish ? 'Zarchiwizowano' : 'Archived',
          delegate: isPolish ? 'Delegowano' : 'Delegated',
          schedule: isPolish ? 'Zaplanowano' : 'Scheduled',
          reject: isPolish ? 'Odrzucono' : 'Rejected',
        };
        toast.success(labels[action] || 'Done');
        emitMyWorkEvent({
          type: 'item:triaged',
          entityType: 'inbox',
          entityId: String(item.id),
          meta: { action },
        });
      } catch (e) {
        console.error('Failed to triage inbox item', e);
        toast.error(isPolish ? 'Nie udało się wykonać akcji' : 'Failed to triage item');
      }
    },
    [isPolish, previewItem, emitMyWorkEvent]
  );

  // Save as note — create notebook page from inbox item
  const handleSaveAsNote = useCallback(
    async (item: InboxItem) => {
      try {
        await Api.createNotebookPage({
          title: item.title,
          contentText: item.title + '\n\n' + (item.description || ''),
          tags: ['from-inbox'],
          status: 'inbox',
        });
        toast.success(isPolish ? 'Zapisano jako notatkę' : 'Saved as note');
      } catch (e) {
        console.error('Failed to save inbox item as note', e);
        toast.error(isPolish ? 'Nie udało się zapisać jako notatkę' : 'Failed to save as note');
      }
    },
    [isPolish]
  );

  // V4-INBX-03: Undo last AI triage
  const handleUndoLastAI = useCallback(async () => {
    try {
      const res = await Api.undoLastAITriage();
      if (res.success) {
        toast.success(isPolish ? 'Cofnięto ostatnią sugestię AI' : 'Undo last AI suggestion');
        fetchInbox();
      } else {
        toast.error(res.message || (isPolish ? 'Brak AI do cofnięcia' : 'No AI triage to undo'));
      }
    } catch (e) {
      toast.error(isPolish ? 'Nie udało się cofnąć' : 'Undo failed');
    }
  }, [isPolish, fetchInbox]);

  // N9: Snooze — persist to backend (source of truth)
  const handleSnooze = useCallback(
    async (item: InboxItem, preset: SnoozePreset) => {
      setSnoozedKeys((prev) => new Set([...prev, item._key]));
      setSnoozeOpenForId(null);
      try {
        await Api.post(`/my-work/inbox/${encodeURIComponent(item.id)}/triage`, {
          action: 'archive',
          itemKey: item._key,
          params: { snooze: preset },
        });
        setData((prev) => {
          if (!prev) return prev;
          return { ...prev, items: prev.items.filter((x) => x._key !== item._key) };
        });
        if (previewItem?._key === item._key) setPreviewItem(null);
      } catch (_e) {
        // rollback optimistic
        setSnoozedKeys((prev) => {
          const next = new Set(prev);
          next.delete(item._key);
          return next;
        });
      }
      toast.success(isPolish ? 'Odłożono' : 'Snoozed');
    },
    [isPolish, previewItem]
  );

  // ── L4: Auto-triage ──
  const handleAutoTriage = async () => {
    setAutoTriageLoading(true);
    try {
      const data = await Api.post('/my-work/inbox/auto-triage', { threshold: aiTriageThreshold });
      const suggestions = data?.suggestions || [];
      const autoApplyItems = suggestions.filter((s: any) => s.autoApply);
      for (const item of autoApplyItems) {
        try {
          await Api.post(`/my-work/inbox/${item.itemId}/triage`, {
            action: item.suggestedAction,
            itemKey: item.itemKey,
            fromAISuggestion: true,
            confidence: item.confidence,
          });
        } catch {
          // continue applying the rest
        }
      }
      if (autoApplyItems.length > 0) {
        toast.success(
          isPolish
            ? `${autoApplyItems.length} elementów automatycznie przetriażowanych`
            : `${autoApplyItems.length} items auto-triaged`
        );
        emitMyWorkEvent({ type: 'item:triaged', entityType: 'inbox', entityId: 'bulk' });
        fetchInbox();
      }
      setAutoTriageSuggestions(suggestions.filter((s: any) => !s.autoApply));
      fetchAIOperations();
    } catch {
      toast.error(isPolish ? 'Auto-triage nieudany' : 'Auto-triage failed');
    }
    setAutoTriageLoading(false);
  };

  // ── Bulk triage ──
  const bulkTriage = useCallback(
    async (action: TriageAction) => {
      const selectedItems = filteredItems.filter((i) => selectedIds.has(i.id));
      if (selectedItems.length === 0) return;
      try {
        const itemKeys = selectedItems.map((i) => i._key);
        const aiItems = selectedItems
          .filter((item) => item.suggestedAction === action && item.suggestedConfidence != null)
          .map((item) => ({
            itemKey: item._key,
            confidence: item.suggestedConfidence ?? null,
          }));
        await Api.post('/my-work/inbox/bulk-triage', { itemKeys, action, aiItems });
        const removedKeys = new Set(itemKeys);
        setData((prev) => {
          if (!prev) return prev;
          return { ...prev, items: prev.items.filter((x) => !removedKeys.has(x._key)) };
        });
        setSelectedIds(new Set());
        fetchAIOperations();
        toast.success(
          isPolish
            ? `${selectedItems.length} elementów przetworzonych`
            : `${selectedItems.length} items processed`
        );
      } catch (e) {
        console.error('Bulk triage failed', e);
        toast.error(isPolish ? 'Nie udało się wykonać akcji' : 'Failed to process items');
      }
    },
    [fetchAIOperations, filteredItems, selectedIds, isPolish]
  );

  // ── Preview item (single click) ──
  const preview = useCallback((item: InboxItem) => {
    setPreviewItem((prev) => (prev?.id === item.id ? null : item));
  }, []);

  // ── Open item in full view (double-click or button) ──
  const open = useCallback(
    (item: InboxItem) => {
      setPreviewItem(null);
      if (item.linkedTaskId) return onOpenTask?.(item.linkedTaskId);
      if (item.linkedDecisionId) return onOpenDecision?.(item.linkedDecisionId);
      if (String(item._key).startsWith('notification:')) {
        const id = String(item._key).replace(/^notification:/, '');
        return onOpenNotification?.(id);
      }
    },
    [onOpenDecision, onOpenNotification, onOpenTask]
  );

  // ── Selection ──
  const allVisibleIds = useMemo(() => new Set(filteredItems.map((i) => i.id)), [filteredItems]);
  const allSelected = selectedIds.size > 0 && selectedIds.size === allVisibleIds.size;
  const someSelected = selectedIds.size > 0 && selectedIds.size < allVisibleIds.size;

  const handleSelectItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) setSelectedIds(new Set(allVisibleIds));
    else setSelectedIds(new Set());
  };

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const selectAllVisible = useCallback(() => handleSelectAll(true), [allVisibleIds]);

  // V3-A03: bulk selection lives as a mode of the single command row (parent)
  useEffect(() => {
    if (!onBulkBarChange) return;
    if (selectedIds.size === 0) {
      onBulkBarChange(null);
      return;
    }

    onBulkBarChange({
      selectedCount: selectedIds.size,
      allSelected,
      someSelected,
      selectAllVisible,
      clearSelection,
      triage: (action) => bulkTriage(action),
    });
  }, [
    onBulkBarChange,
    selectedIds.size,
    allSelected,
    someSelected,
    selectAllVisible,
    clearSelection,
    bulkTriage,
  ]);

  const handleSelectSection = (section: InboxSection) => {
    const sectionIds = filteredItems.filter((i) => i.section === section).map((i) => i.id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of sectionIds) next.add(id);
      return next;
    });
  };

  // ── Column resize ──
  const handleColumnResize = (columnId: string, newWidth: number) => {
    setColumnWidths((prev) => ({ ...prev, [columnId]: newWidth }));
  };

  const getColumnLabel = useCallback(
    (columnId: string) => {
      const dict: Record<string, { pl: string; en: string }> = {
        title: { pl: 'Tytuł', en: 'Title' },
        status: { pl: 'Status', en: 'Status' },
        urgency: { pl: 'Pilność', en: 'Urgency' },
        type: { pl: 'Typ', en: 'Type' },
        section: { pl: 'Sekcja', en: 'Section' },
        source: { pl: 'Źródło', en: 'Source' },
        received: { pl: 'Otrzymano', en: 'Received' },
        sla: { pl: 'SLA', en: 'SLA' },
        actions: { pl: 'Widok', en: 'View' },
      };
      return isPolish ? dict[columnId]?.pl || columnId : dict[columnId]?.en || columnId;
    },
    [isPolish]
  );

  // ── Filter change ──
  const handleFilterChange = (columnId: string, values: string[]) => {
    setTableFilters((prev) => ({ ...prev, [columnId]: values.length > 0 ? values : undefined }));
  };

  // ── Section tab counts ──
  const sectionCounts = useMemo(() => {
    const all = data?.items || [];
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekEnd = new Date(todayStart.getTime() + 7 * 86400000);
    return {
      today: all.filter((i) => new Date(i.receivedAt || '') >= todayStart).length,
      this_week: all.filter((i) => {
        const d = new Date(i.receivedAt || '');
        return d >= todayStart && d < weekEnd;
      }).length,
      all: all.length,
    };
  }, [data?.items]);

  // ── Keyboard navigation ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
        return;

      const flatItems = filteredItems;
      if (flatItems.length === 0) return;

      switch (e.key) {
        case 'j':
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex((prev) => Math.min(prev + 1, flatItems.length - 1));
          break;
        case 'k':
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < flatItems.length) {
            if (previewItem?.id === flatItems[focusedIndex].id) open(flatItems[focusedIndex]);
            else preview(flatItems[focusedIndex]);
          }
          break;
        case ' ':
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < flatItems.length)
            handleSelectItem(flatItems[focusedIndex].id);
          break;
        case 't':
        case 'T':
          if (focusedIndex >= 0 && focusedIndex < flatItems.length)
            triage(flatItems[focusedIndex], 'accept_today');
          break;
        case 'w':
        case 'W':
          if (focusedIndex >= 0 && focusedIndex < flatItems.length)
            triage(flatItems[focusedIndex], 'accept_week');
          break;
        case 'e':
        case 'E':
          if (focusedIndex >= 0 && focusedIndex < flatItems.length)
            triage(flatItems[focusedIndex], 'done');
          break;
        case 'b':
        case 'B':
          if (focusedIndex >= 0 && focusedIndex < flatItems.length)
            triage(flatItems[focusedIndex], 'save');
          break;
        case 'a':
        case 'A':
          if (focusedIndex >= 0 && focusedIndex < flatItems.length)
            triage(flatItems[focusedIndex], 'dismiss');
          break;
        case 'x':
        case 'X':
          if (focusedIndex >= 0 && focusedIndex < flatItems.length)
            triage(flatItems[focusedIndex], 'reject');
          break;
        case 'Escape':
          if (previewItem) {
            setPreviewItem(null);
            e.preventDefault();
          }
          break;
        case '?':
          toast(
            isPolish
              ? 'Skróty: J/K nawigacja, T dziś, W ten tydz., E gotowe, B zapisz, A odłóż, X odrzuć, Enter otwórz, Space zaznacz'
              : 'Shortcuts: J/K nav, T today, W week, E done, B save, A dismiss, X reject, Enter open, Space select',
            { duration: 5000, icon: '⌨️' }
          );
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredItems, focusedIndex, open, preview, previewItem, triage, isPolish]);

  // ── Render row ──
  const renderRow = (item: InboxItem, index: number, groupCount?: number, groupKey?: string) => {
    const u = urgencyConfig[item.urgency] || urgencyConfig.normal;
    const UIcon = u.icon;
    const isSelected = selectedIds.has(item.id);
    const isFocused = index === focusedIndex;
    const isPreviewed = previewItem?.id === item.id;
    const isNotification = String(item._key || '').startsWith('notification:');
    const { text: receivedText, agingLevel } = formatRelativeTime(item.receivedAt, isPolish);
    const sla = slaPill(item.sla);
    const showDupeCount = groupCount && groupCount > 1;
    const isGroupExpanded = groupKey ? expandedGroups.has(groupKey) : false;

    return (
      <tr
        key={item.id}
        data-index={index}
        className={`
          group cursor-pointer border-b border-slate-200 dark:border-navy-700/50
          border-l-[3px] ${u.heatColor}
          ${isSelected ? 'bg-primary-50 dark:bg-primary-500/10' : ''}
          ${isPreviewed ? 'bg-cyan-50/50 dark:bg-cyan-500/5 border-l-cyan-500!' : ''}
          ${isFocused && !isPreviewed ? 'ring-2 ring-inset ring-cyan-400/50 bg-cyan-50/30 dark:bg-cyan-500/5' : ''}
          transition-colors duration-150
          hover:bg-slate-50 dark:hover:bg-navy-800/50
        `}
        onClick={() => preview(item)}
        onDoubleClick={() => open(item)}
      >
        {/* Checkbox */}
        <td className="w-10 px-2 py-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleSelectItem(item.id);
            }}
            className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${
              isSelected
                ? 'bg-primary-500 border-primary-500 text-white'
                : 'border-slate-300 dark:border-navy-500 hover:border-primary-400'
            }`}
          >
            {isSelected && <CheckSquare size={12} />}
          </button>
        </td>

        {/* Title */}
        <td className="px-3 py-2 w-full">
          <div className="flex items-center gap-2">
            <span
              className="text-sm font-medium text-slate-900 dark:text-white truncate block"
              title={item.title}
            >
              {item.title}
            </span>
            {item.suggestedAction && (
              <span
                className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-purple-50 dark:bg-purple-500/10 text-[10px] font-medium text-purple-600 dark:text-purple-300 cursor-help"
                title={item.suggestedReason || (isPolish ? 'Sugestia AI' : 'AI suggestion')}
              >
                AI:{' '}
                {item.suggestedAction === 'accept_today'
                  ? '✓'
                  : item.suggestedAction === 'archive'
                    ? '📦'
                    : item.suggestedAction === 'schedule'
                      ? '📅'
                      : '→'}
              </span>
            )}
            {showDupeCount && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (groupKey)
                    setExpandedGroups((prev) => {
                      const next = new Set(prev);
                      if (next.has(groupKey)) next.delete(groupKey);
                      else next.add(groupKey);
                      return next;
                    });
                }}
                className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-navy-800 text-[10px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors"
                title={isPolish ? `${groupCount} podobnych` : `${groupCount} similar`}
              >
                <Layers size={10} />x{groupCount}
                {isGroupExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              </button>
            )}
          </div>
          {/* N7: reason chip — visible on hover */}
          {item.reason && (
            <span className="hidden group-hover:inline-flex items-center gap-1 text-[10px] text-sky-600 dark:text-sky-400 mt-0.5">
              <HelpCircle size={10} className="shrink-0" />
              {item.reason}
            </span>
          )}
        </td>

        {/* Status */}
        {!hiddenSet.has('status') && (
          <td className="px-3 py-2" style={{ width: columnWidths.status }}>
            {(() => {
              const st = item.itemStatus || (item.triaged ? 'done' : 'open');
              const cfg: Record<string, { color: string; dot: string; label: string }> = {
                open: {
                  color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
                  dot: 'bg-amber-500',
                  label: isPolish ? 'Otwarte' : 'Open',
                },
                done: {
                  color: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300',
                  dot: 'bg-green-500',
                  label: isPolish ? 'Gotowe' : 'Done',
                },
                saved: {
                  color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
                  dot: 'bg-blue-500',
                  label: isPolish ? 'Zapisane' : 'Saved',
                },
                snoozed: {
                  color: 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300',
                  dot: 'bg-purple-500',
                  label: isPolish ? 'Odłożone' : 'Snoozed',
                },
                dismissed: {
                  color: 'bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300',
                  dot: 'bg-slate-400',
                  label: isPolish ? 'Odłożone' : 'Dismissed',
                },
              };
              const c = cfg[st] || cfg.open;
              return (
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap leading-none ${c.color}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                  {c.label}
                  {item.isActionable && <Zap size={10} className="text-amber-500" />}
                </span>
              );
            })()}
          </td>
        )}

        {/* Urgency */}
        {!hiddenSet.has('urgency') && (
          <td className="px-3 py-2" style={{ width: columnWidths.urgency }}>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${u.pill}`}
            >
              <UIcon size={11} />
              {u.label}
            </span>
          </td>
        )}

        {/* Type */}
        {!hiddenSet.has('type') && (
          <td className="px-3 py-2" style={{ width: columnWidths.type }}>
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
              <span className="truncate">
                {typeLabel[item.type] || item.type.replace(/_/g, ' ')}
              </span>
            </span>
          </td>
        )}

        {/* Section */}
        {!hiddenSet.has('section') && (
          <td className="px-3 py-2" style={{ width: columnWidths.section }}>
            <span className="text-xs text-slate-600 dark:text-slate-400">
              {SMART_SECTIONS.find((s) => s.id === item.section)?.[
                isPolish ? 'labelPl' : 'labelEn'
              ] || item.section}
            </span>
          </td>
        )}

        {/* Source */}
        {!hiddenSet.has('source') && (
          <td className="px-3 py-2" style={{ width: columnWidths.source }}>
            {(() => {
              const src = item.source?.type || 'system';
              const cfg: Record<string, { icon: typeof Bell; color: string; label: string }> = {
                system: {
                  icon: Bell,
                  color: 'text-slate-500',
                  label: isPolish ? 'System' : 'System',
                },
                ai: { icon: Star, color: 'text-purple-500', label: 'AI' },
                user: {
                  icon: MessageSquare,
                  color: 'text-blue-500',
                  label: item.source?.userName || (isPolish ? 'Zespół' : 'Team'),
                },
              };
              const c = cfg[src] || cfg.system;
              const SrcIcon = c.icon;
              return (
                <span className={`inline-flex items-center gap-1 text-xs ${c.color}`}>
                  <SrcIcon size={11} />
                  <span className="truncate">{c.label}</span>
                </span>
              );
            })()}
          </td>
        )}

        {/* Received (relative + aging) */}
        {!hiddenSet.has('received') && (
          <td className="px-3 py-2" style={{ width: columnWidths.received }}>
            <span className={`text-xs font-medium whitespace-nowrap ${AGING_STYLES[agingLevel]}`}>
              {receivedText}
            </span>
          </td>
        )}

        {/* SLA */}
        {!hiddenSet.has('sla') && (
          <td className="px-3 py-2" style={{ width: columnWidths.sla }}>
            {sla.label === '-' ? (
              <span className={sla.className}>{sla.label}</span>
            ) : (
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${sla.className}`}
                title={sla.title}
              >
                {sla.label}
              </span>
            )}
          </td>
        )}

        {/* Inline Actions */}
        <td
          className="px-2 py-2 text-right"
          style={{ width: columnWidths.actions }}
          onClick={(e) => e.stopPropagation()}
        >
          {(() => {
            const actions: RowAction[] = [
              {
                id: 'open',
                label: isPolish ? 'Otwórz' : 'Open',
                icon: Eye,
                variant: 'primary',
                onClick: () => open(item),
              },
              ...(item.suggestedAction && !item.triaged
                ? [
                    {
                      id: 'apply-ai',
                      label: isPolish
                        ? `Zastosuj AI (${item.suggestedAction})`
                        : `Apply AI (${item.suggestedAction})`,
                      icon: Sparkles,
                      onClick: () =>
                        triage(item, item.suggestedAction!, {
                          fromAISuggestion: true,
                          confidence: item.suggestedConfidence,
                        }),
                    } as RowAction,
                  ]
                : []),
              {
                id: 'focus-today',
                label: isPolish ? 'Focus → Dziś' : 'Focus → Today',
                icon: Zap,
                onClick: () => triage(item, 'accept_today'),
              },
              {
                id: 'focus-week',
                label: isPolish ? 'Focus → Ten tydz.' : 'Focus → This week',
                icon: CalendarClock,
                onClick: () => triage(item, 'accept_week'),
              },
              {
                id: 'focus-later',
                label: isPolish ? 'Focus → Później' : 'Focus → Later',
                icon: Calendar,
                onClick: () => triage(item, 'accept_later'),
              },
              {
                id: 'done',
                label: isPolish ? 'Gotowe' : 'Done',
                icon: CheckCircle2,
                divider: true,
                onClick: () => triage(item, 'done'),
              },
              {
                id: 'save',
                label: isPolish ? 'Zapisz' : 'Save',
                icon: Bookmark,
                onClick: () => triage(item, 'save'),
              },
              {
                id: 'save-note',
                label: isPolish ? 'Zapisz jako notatkę' : 'Save as note',
                icon: FileText,
                onClick: () => handleSaveAsNote(item),
              },
              {
                id: 'dismiss',
                label: isPolish ? 'Odłóż' : 'Dismiss',
                icon: Archive,
                onClick: () => triage(item, 'dismiss'),
              },
              {
                id: 'reject',
                label: isPolish ? 'Odrzuć' : 'Reject',
                icon: X,
                variant: 'danger',
                onClick: () => triage(item, 'reject'),
              },
              ...SNOOZE_PRESETS.map((p, idx) => ({
                id: `snooze-${p.id}`,
                label: `${isPolish ? 'Odłóż' : 'Snooze'}: ${isPolish ? p.labelPl : p.labelEn}`,
                icon: Clock,
                divider: idx === 0,
                onClick: () => handleSnooze(item, p.id),
              })),
            ];
            return <RowActionsMenu actions={actions} iconVariant="vertical" />;
          })()}
        </td>
      </tr>
    );
  };

  // ── Render table header ──
  const renderTableHeader = () => (
    <thead>
      <tr className="border-b border-slate-200 dark:border-navy-700/50 bg-slate-50 dark:bg-navy-900/50 sticky top-0 z-10">
        {/* Select All */}
        <th className="w-10 px-2 py-2 border-l-[3px] border-l-transparent">
          <button
            onClick={() => handleSelectAll(!allSelected)}
            className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
              allSelected
                ? 'bg-primary-500 border-primary-500 text-white'
                : someSelected
                  ? 'bg-primary-500/50 border-primary-500 text-white'
                  : 'border-slate-300 dark:border-navy-500 hover:border-primary-400 text-transparent hover:text-slate-400'
            }`}
          >
            {allSelected ? (
              <CheckSquare size={14} />
            ) : someSelected ? (
              <Minus size={14} />
            ) : (
              <Square size={14} />
            )}
          </button>
        </th>

        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-full">
          {isPolish ? 'Tytuł' : 'Title'}
        </th>

        {INBOX_COLUMNS.filter(
          (c) => !['select', 'title', 'actions'].includes(c.id) && !hiddenSet.has(c.id)
        ).map((col) => {
          const colId = col.id;
          const isFilterable = Boolean(col.filterable);
          const hasFilter = isFilterable && col.filterOptions?.length;
          const isResizable = Boolean(col.resizable);
          return (
            <th
              key={colId}
              className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider relative group/header"
              style={{ width: columnWidths[colId] }}
            >
              <div className="flex items-center gap-1">
                <span
                  className={(tableFilters[colId] as string[])?.length ? 'text-primary-500' : ''}
                >
                  {getColumnLabel(colId)}
                </span>
                {hasFilter ? (
                  <FilterDropdown
                    column={col}
                    value={tableFilters[colId] as string[]}
                    onChange={(val) => handleFilterChange(colId, val as string[])}
                    isOpen={openFilterId === colId}
                    onToggle={() => setOpenFilterId(openFilterId === colId ? null : colId)}
                    onClose={() => setOpenFilterId(null)}
                  />
                ) : null}
              </div>
              {isResizable ? (
                <ColumnResizer
                  columnId={colId}
                  currentWidth={columnWidths[colId]}
                  minWidth={col.minWidth!}
                  maxWidth={col.maxWidth!}
                  onResize={handleColumnResize}
                />
              ) : null}
            </th>
          );
        })}

        <th
          className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider"
          style={{ width: columnWidths.actions }}
        >
          <button
            onClick={() => setIsViewSettingsOpen(true)}
            className="inline-flex items-center justify-center h-7 w-7 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors"
            aria-label={isPolish ? 'Ustawienia widoku tabeli' : 'Table view settings'}
            title={isPolish ? 'Ustawienia widoku' : 'View settings'}
          >
            <Settings2 size={14} />
          </button>
        </th>
      </tr>
    </thead>
  );

  // ── Render smart sections ──
  const renderSectionsView = () => {
    if (!sectionGroups) return null;
    const renderStatusPill = (item: InboxItem) => {
      const st = item.itemStatus || (item.triaged ? 'done' : 'open');
      const cfg: Record<string, { color: string; dot: string; label: string }> = {
        open: {
          color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
          dot: 'bg-amber-500',
          label: isPolish ? 'Otwarte' : 'Open',
        },
        done: {
          color: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300',
          dot: 'bg-green-500',
          label: isPolish ? 'Gotowe' : 'Done',
        },
        saved: {
          color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
          dot: 'bg-blue-500',
          label: isPolish ? 'Zapisane' : 'Saved',
        },
        snoozed: {
          color: 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300',
          dot: 'bg-purple-500',
          label: isPolish ? 'Odłożone' : 'Snoozed',
        },
        dismissed: {
          color: 'bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300',
          dot: 'bg-slate-400',
          label: isPolish ? 'Odłożone' : 'Dismissed',
        },
      };
      const c = cfg[st] || cfg.open;
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap leading-none ${c.color}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
          {c.label}
          {item.isActionable && <Zap size={10} className="text-amber-500" />}
        </span>
      );
    };

    const renderCard = (item: InboxItem, groupCount?: number, groupKey?: string) => {
      const u = urgencyConfig[item.urgency] || urgencyConfig.normal;
      const UIcon = u.icon;
      const isSelected = selectedIds.has(item.id);
      const isPreviewed = previewItem?.id === item.id;
      const { text: receivedText, agingLevel } = formatRelativeTime(item.receivedAt, isPolish);
      const sla = slaPill(item.sla);
      const showDupeCount = groupCount && groupCount > 1;
      const isGroupExpanded = groupKey ? expandedGroups.has(groupKey) : false;
      const entityKind = getEntityKind(item);
      const kindCfg = ENTITY_KIND_CONFIG[entityKind];
      const KindIcon = kindCfg.icon;

      const descTrimmed = (item.description || '').trim();
      const cardBrief = descTrimmed
        ? descTrimmed
            .split('\n')
            .find((l) => l.trim().length > 0)
            ?.trim() || ''
        : '';
      const cardBriefText = cardBrief.length > 120 ? `${cardBrief.slice(0, 117)}…` : cardBrief;

      return (
        <div
          key={item.id}
          className={[
            'group relative rounded-xl border-l-[3px] border border-slate-200/60 dark:border-white/[0.06] transition-all duration-150 overflow-hidden',
            kindCfg.borderLeft,
            'bg-slate-50/80 dark:bg-navy-800/60',
            'hover:bg-white dark:hover:bg-navy-800/80 hover:shadow-sm',
            isSelected ? 'ring-2 ring-primary-400/50' : '',
            isPreviewed ? 'ring-2 ring-cyan-400/40' : '',
          ].join(' ')}
          onClick={() => preview(item)}
          onDoubleClick={() => open(item)}
        >
          <div className="p-3 flex flex-col gap-2.5">
            {/* Row 1: Title + actions */}
            <div className="flex items-start gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectItem(item.id);
                }}
                className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-all shrink-0 ${
                  isSelected
                    ? 'bg-primary-500 border-primary-500 text-white'
                    : 'border-slate-300 dark:border-navy-500 hover:border-primary-400'
                }`}
                aria-label={
                  isSelected ? (isPolish ? 'Odznacz' : 'Deselect') : isPolish ? 'Zaznacz' : 'Select'
                }
              >
                {isSelected && <CheckSquare size={10} />}
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-1.5">
                  <h3
                    className="text-[13px] font-semibold text-slate-900 dark:text-white leading-snug line-clamp-2"
                    title={item.title}
                  >
                    {item.title}
                  </h3>
                  <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                    {(() => {
                      const actions: RowAction[] = [
                        {
                          id: 'open',
                          label: isPolish ? 'Otwórz' : 'Open',
                          icon: Eye,
                          variant: 'primary',
                          onClick: () => open(item),
                        },
                        {
                          id: 'focus-today',
                          label: isPolish ? 'Focus → Dziś' : 'Focus → Today',
                          icon: Zap,
                          onClick: () => triage(item, 'accept_today'),
                        },
                        {
                          id: 'focus-week',
                          label: isPolish ? 'Focus → Ten tydz.' : 'Focus → This week',
                          icon: CalendarClock,
                          onClick: () => triage(item, 'accept_week'),
                        },
                        {
                          id: 'focus-later',
                          label: isPolish ? 'Focus → Później' : 'Focus → Later',
                          icon: Calendar,
                          onClick: () => triage(item, 'accept_later'),
                        },
                        {
                          id: 'done',
                          label: isPolish ? 'Gotowe' : 'Done',
                          icon: CheckCircle2,
                          divider: true,
                          onClick: () => triage(item, 'done'),
                        },
                        {
                          id: 'save',
                          label: isPolish ? 'Zapisz' : 'Save',
                          icon: Bookmark,
                          onClick: () => triage(item, 'save'),
                        },
                        {
                          id: 'dismiss',
                          label: isPolish ? 'Odłóż' : 'Dismiss',
                          icon: Archive,
                          onClick: () => triage(item, 'dismiss'),
                        },
                        ...(handleSaveAsNote
                          ? [
                              {
                                id: 'save-as-note',
                                label: isPolish ? 'Zapisz jako notatkę' : 'Save as note',
                                icon: FileText,
                                onClick: () => handleSaveAsNote(item),
                                divider: true,
                              } satisfies RowAction,
                            ]
                          : []),
                        ...SNOOZE_PRESETS.map((p, idx) => ({
                          id: `snooze-${p.id}`,
                          label: `${isPolish ? 'Odłóż' : 'Snooze'}: ${isPolish ? p.labelPl : p.labelEn}`,
                          icon: Clock,
                          divider: idx === 0 && !handleSaveAsNote,
                          onClick: () => handleSnooze(item, p.id),
                        })),
                      ];
                      return <RowActionsMenu actions={actions} iconVariant="vertical" />;
                    })()}
                  </div>
                </div>
              </div>
            </div>

            {/* Row 2: Brief */}
            {cardBriefText ? (
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2 -mt-0.5">
                {cardBriefText}
              </p>
            ) : null}

            {/* Row 3: Meta pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${kindCfg.pill}`}
              >
                <KindIcon size={10} />
                {isPolish ? kindCfg.labelPl : kindCfg.labelEn}
              </span>
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap ${u.pill}`}
              >
                <UIcon size={10} />
                {u.label}
              </span>
              <span
                className={`text-[10px] font-medium whitespace-nowrap ${AGING_STYLES[agingLevel]}`}
              >
                {receivedText}
              </span>
              {sla.label !== '-' ? (
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap ${sla.className}`}
                  title={sla.title}
                >
                  {sla.label}
                </span>
              ) : null}
              {showDupeCount && groupKey && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedGroups((prev) => {
                      const next = new Set(prev);
                      if (next.has(groupKey)) next.delete(groupKey);
                      else next.add(groupKey);
                      return next;
                    });
                  }}
                  className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-slate-200/60 dark:bg-white/[0.06] text-[10px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/[0.08] transition-colors"
                  title={isPolish ? `${groupCount} podobnych` : `${groupCount} similar`}
                >
                  <Layers size={10} />x{groupCount}
                  {isGroupExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                </button>
              )}
            </div>

            {/* Row 4: Linked docs (if any) */}
            {item.linkedTaskId || item.linkedDecisionId ? (
              <div className="flex flex-wrap items-center gap-1.5 -mt-0.5">
                {item.linkedTaskId ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                    <CheckSquare size={10} />
                    Task {item.linkedTaskId.slice(0, 8)}…
                  </span>
                ) : null}
                {item.linkedDecisionId ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                    <Scale size={10} />
                    {isPolish ? 'Decyzja' : 'Decision'} {item.linkedDecisionId.slice(0, 8)}…
                  </span>
                ) : null}
              </div>
            ) : null}

            {/* Row 5: Quick actions (visible on hover) */}
            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity -mt-0.5">
              {renderStatusPill(item)}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  triage(item, 'accept_today');
                }}
                className="inline-flex items-center gap-1 h-6 px-2 rounded-full text-[10px] font-medium border border-emerald-300/40 dark:border-emerald-500/20 bg-transparent text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-500/10 transition-colors"
              >
                <Zap size={10} />
                {isPolish ? 'Dziś' : 'Today'}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  triage(item, 'done');
                }}
                className="inline-flex items-center gap-1 h-6 px-2 rounded-full text-[10px] font-medium border border-green-300/40 dark:border-green-500/20 bg-transparent text-green-700 dark:text-green-400 hover:bg-green-50/50 dark:hover:bg-green-500/10 transition-colors"
              >
                <CheckCircle2 size={10} />
                {isPolish ? 'Gotowe' : 'Done'}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  triage(item, 'dismiss');
                }}
                className="inline-flex items-center gap-1 h-6 px-2 rounded-full text-[10px] font-medium border border-slate-200/60 dark:border-white/[0.06] bg-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-white/[0.04] transition-colors"
              >
                <Archive size={10} />
                {isPolish ? 'Odłóż' : 'Dismiss'}
              </button>
            </div>
          </div>
        </div>
      );
    };

    return (
      <div className="p-3">
        {SMART_SECTIONS.map((section) => {
          const sectionData = sectionGroups.get(section.id) || [];
          if (sectionData.length === 0) return null;
          const isCollapsed = collapsedSections.has(section.id);
          const SectionIcon = section.icon;
          const totalCount = sectionData.reduce((sum, g) => sum + g.count, 0);

          return (
            <div key={section.id} className="mb-4 last:mb-0">
              <div className="flex items-center justify-between px-2 py-2 rounded-lg bg-slate-50/80 dark:bg-navy-800/40 border border-slate-200 dark:border-navy-700/50">
                <button
                  onClick={() =>
                    setCollapsedSections((prev) => {
                      const next = new Set(prev);
                      if (next.has(section.id)) next.delete(section.id);
                      else next.add(section.id);
                      return next;
                    })
                  }
                  className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  <SectionIcon size={14} className={section.color} />
                  {isPolish ? section.labelPl : section.labelEn}
                  <span className="px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-navy-700 text-[10px] font-medium text-slate-600 dark:text-slate-300">
                    {totalCount}
                  </span>
                </button>
                <button
                  onClick={() => handleSelectSection(section.id)}
                  className="text-[10px] font-medium text-slate-500 dark:text-slate-400 hover:text-primary-500 transition-colors"
                >
                  {isPolish ? 'Zaznacz wszystkie' : 'Select all'}
                </button>
              </div>

              {!isCollapsed && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {sectionData.flatMap((group) => {
                    const itemsToRender =
                      group.count > 1 && expandedGroups.has(group.key)
                        ? group.items
                        : [group.representative];
                    return itemsToRender.map((it, idx) =>
                      renderCard(
                        it,
                        idx === 0 ? group.count : undefined,
                        idx === 0 ? group.key : undefined
                      )
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // ── Render flat view ──
  const renderFlatView = () => {
    let globalIndex = 0;
    return (
      <table className="w-full table-fixed" style={{ minWidth: 900 }}>
        {renderTableHeader()}
        <tbody>
          {displayItems.map((group) => {
            const idx = globalIndex++;
            const rows = [renderRow(group.representative, idx, group.count, group.key)];
            if (group.count > 1 && group.isExpanded) {
              for (let i = 1; i < group.items.length; i++) {
                rows.push(renderRow(group.items[i], globalIndex++));
              }
            }
            return rows;
          })}
        </tbody>
      </table>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div
      className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-navy-950"
      ref={tableRef}
    >
      {/* Main content + Preview pane */}
      <div className="flex-1 flex min-h-0 gap-1.5">
        {/* Table content */}
        <div className="flex-1 min-w-0 overflow-y-auto pl-4 pr-1.5 pt-3 pb-4 transition-all duration-200">
          <div className="mb-3 grid grid-cols-1 xl:grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.04] px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {isPolish ? 'AI triage' : 'AI triage'}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {isPolish ? 'Próg auto-apply' : 'Auto-apply threshold'}{' '}
                    {Math.round(aiTriageThreshold * 100)}%
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {isPolish
                      ? `${autoTriageSuggestions.length} sugestii czeka na ręczną decyzję`
                      : `${autoTriageSuggestions.length} suggestions waiting for manual review`}
                  </div>
                </div>
                <button
                  onClick={handleAutoTriage}
                  disabled={autoTriageLoading}
                  className="inline-flex items-center gap-2 h-9 px-4 rounded-full border border-cyan-300/40 dark:border-cyan-500/30 bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-200 hover:bg-cyan-100/70 dark:hover:bg-cyan-500/15 transition-colors disabled:opacity-50"
                >
                  {autoTriageLoading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Sparkles size={14} />
                  )}
                  {isPolish ? 'Uruchom' : 'Run'}
                </button>
              </div>
              <input
                type="range"
                min={0.5}
                max={0.99}
                step={0.01}
                value={aiTriageThreshold}
                onChange={(e) => setAiTriageThreshold(Number(e.target.value))}
                className="mt-3 w-full accent-cyan-600"
              />
            </div>

            <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.04] px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {isPolish ? 'Evale i koszt' : 'Evals and cost'}
              </div>
              <div className="mt-2 flex items-center gap-4">
                <div>
                  <div className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                    {aiEvalRuns[0] ? `${Math.round((aiEvalRuns[0].accuracy || 0) * 100)}%` : '—'}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {isPolish ? 'ostatni eval accuracy' : 'latest eval accuracy'}
                  </div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                    {aiCostSummary ? `$${(aiCostSummary.totalCostUsd || 0).toFixed(2)}` : '—'}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {isPolish ? 'koszt 30 dni' : '30-day cost'}
                  </div>
                </div>
              </div>
              <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {aiOpsLoading
                  ? isPolish
                    ? 'Ładowanie diagnostyki AI...'
                    : 'Loading AI diagnostics...'
                  : isPolish
                    ? `${aiCostSummary?.callCount || 0} wywołań, ${aiEvalRuns.length} ostatnich runów`
                    : `${aiCostSummary?.callCount || 0} calls, ${aiEvalRuns.length} recent runs`}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.04] px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {isPolish ? 'Canonical inbox' : 'Canonical inbox'}
              </div>
              <div className="mt-2 flex items-center gap-4">
                <div>
                  <div className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                    {canonicalStats?.total ?? data?.summary?.total ?? 0}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {isPolish ? 'łączna liczba pozycji' : 'total items'}
                  </div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                    {canonicalStats?.actionRequired ?? data?.summary?.actionRequired ?? 0}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {isPolish ? 'wymaga akcji' : 'action required'}
                  </div>
                </div>
              </div>
              <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {isPolish
                  ? 'Inbox materializuje canonical items przed odświeżeniem widoku.'
                  : 'Inbox materializes canonical items before refreshing the view.'}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-600 dark:text-slate-300">
              <Loader2 className="animate-spin mr-2" size={18} />
              {isPolish ? 'Ładowanie...' : 'Loading...'}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-16 text-center text-slate-600 dark:text-slate-300">
              {statusTab === 'done' ? (
                <>
                  <CheckCircle2 size={40} className="mx-auto mb-4 text-green-400" />
                  <p className="text-base font-semibold mb-1">
                    {isPolish ? 'Brak zakończonych elementów' : 'No completed items'}
                  </p>
                  <p className="text-sm text-slate-500">
                    {isPolish
                      ? 'Oznaczaj elementy jako gotowe (E), żeby tu trafiały.'
                      : "Mark items as Done (E) and they'll appear here."}
                  </p>
                </>
              ) : statusTab === 'saved' ? (
                <>
                  <BookmarkCheck size={40} className="mx-auto mb-4 text-amber-400" />
                  <p className="text-base font-semibold mb-1">
                    {isPolish ? 'Brak zapisanych elementów' : 'No saved items'}
                  </p>
                  <p className="text-sm text-slate-500">
                    {isPolish
                      ? 'Użyj Zapisz (B) aby odłożyć elementy na później.'
                      : 'Use Save (B) to bookmark items for later.'}
                  </p>
                </>
              ) : (
                <>
                  <Inbox size={40} className="mx-auto mb-4 text-slate-400" />
                  <p className="text-base font-semibold mb-1">
                    {isPolish
                      ? 'Inbox jest pusty — zero zaległości!'
                      : 'Inbox is empty — zero backlog!'}
                  </p>
                  <p className="text-sm text-slate-500">
                    {isPolish
                      ? 'Wszystko przetworzone. Świetna robota!'
                      : 'Everything processed. Great job!'}
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="bg-white/70 dark:bg-navy-900/70 border border-slate-200/70 dark:border-white/[0.06] rounded-xl backdrop-blur overflow-hidden">
              {viewMode === 'sections' ? renderSectionsView() : renderFlatView()}
            </div>
          )}
        </div>

        {/* Preview Pane (A3) */}
        {previewItem && (
          <div
            className="shrink-0 bg-slate-50 dark:bg-navy-950 p-3"
            style={{ width: 'clamp(340px, 28%, 480px)' }}
          >
            <PreviewPane
              item={previewItem}
              isPolish={isPolish}
              onClose={() => setPreviewItem(null)}
              onOpen={() => open(previewItem)}
              onTriage={(action) => {
                const isFromAI =
                  action === previewItem.suggestedAction && previewItem.suggestedConfidence != null;
                triage(
                  previewItem,
                  action,
                  isFromAI
                    ? { fromAISuggestion: true, confidence: previewItem.suggestedConfidence }
                    : undefined
                );
                setPreviewItem(null);
              }}
              onSnooze={(preset) => {
                handleSnooze(previewItem, preset);
                setPreviewItem(null);
              }}
              onSaveAsNote={handleSaveAsNote}
              onUndoLastAI={handleUndoLastAI}
            />
          </div>
        )}
      </div>

      {/* Table View Settings (standard) */}
      <Modal
        open={isViewSettingsOpen}
        onClose={() => setIsViewSettingsOpen(false)}
        title={isPolish ? 'Ustawienia widoku tabeli' : 'Table view settings'}
        description={
          isPolish
            ? 'Wybierz, które kolumny są widoczne w tabeli.'
            : 'Choose which columns are visible in the table.'
        }
        size="sm"
        footer={
          <>
            <button
              onClick={() => setHiddenColumns([...INBOX_TABLE_DEFAULT_HIDDEN_COLUMNS])}
              className="inline-flex items-center justify-center h-9 px-4 rounded-full text-sm font-medium border border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900"
            >
              {isPolish ? 'Reset' : 'Reset'}
            </button>
            <button
              onClick={() => setIsViewSettingsOpen(false)}
              className="inline-flex items-center justify-center h-9 px-4 rounded-full text-sm font-medium border border-primary-500/40 dark:border-primary-500/30 bg-primary-600 text-white hover:bg-primary-700 transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900"
            >
              {isPolish ? 'Gotowe' : 'Done'}
            </button>
          </>
        }
      >
        <div className="space-y-2">
          {INBOX_COLUMNS.filter((c) => c.id !== 'select').map((col) => {
            const alwaysVisible = col.id === 'title' || col.id === 'actions';
            const checked = alwaysVisible ? true : !hiddenSet.has(col.id);
            return (
              <label
                key={col.id}
                className={`flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-navy-800 ${
                  alwaysVisible ? 'opacity-60' : 'cursor-pointer'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={alwaysVisible}
                  onChange={() => {
                    if (alwaysVisible) return;
                    setHiddenColumns((prev) => {
                      const set = new Set(prev);
                      if (set.has(col.id)) set.delete(col.id);
                      else set.add(col.id);
                      return Array.from(set);
                    });
                  }}
                  className="w-4 h-4 rounded border-slate-300 dark:border-navy-700 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-slate-800 dark:text-slate-200 flex-1">
                  {getColumnLabel(col.id)}
                </span>
                {alwaysVisible ? (
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">
                    {isPolish ? 'Wymagane' : 'Required'}
                  </span>
                ) : null}
              </label>
            );
          })}
        </div>
      </Modal>
    </div>
  );
};
