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
  Eye,
  FileText,
  HelpCircle,
  Inbox,
  Layers,
  List,
  Loader2,
  MessageSquare,
  Minus,
  Pin,
  Scale,
  Settings,
  Sparkles,
  Square,
  Star,
  X,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import {
  type ColumnDef,
  ColumnResizer,
  type ColumnWidths,
  type TableFilters,
} from '@/components/ui/ResizableTable';
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
type TriageAction = 'accept_today' | 'accept_week' | 'accept_later' | 'schedule' | 'delegate' | 'archive' | 'dismiss' | 'done' | 'save' | 'snooze' | 'reject';
type InboxItemKey = `task:${string}` | `decision:${string}` | `notification:${string}`;
type InboxViewMode = 'flat' | 'sections';
type InboxStatusTab = 'open' | 'done' | 'saved' | 'all';
type SnoozePreset = '2h' | 'tomorrow' | '3d' | 'next_monday';

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

interface InboxContentProps {
  searchQuery: string;
  onOpenTask?: (taskId: string) => void;
  onOpenDecision?: (decisionId: string) => void;
  onOpenNotification?: (notificationId: string) => void;
  onCountsChange: (counts: { total: number; critical: number }) => void;
  refreshTrigger?: number;
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
const SMART_SECTIONS: { id: InboxSection; labelEn: string; labelPl: string; icon: React.ElementType; color: string }[] = [
  { id: 'decisions_required', labelEn: 'Requires Your Decision', labelPl: 'Wymaga Twojej decyzji', icon: Scale, color: 'text-purple-500' },
  { id: 'approvals_gates', labelEn: 'Approvals & Gates', labelPl: 'Akceptacje i bramki', icon: CheckCheck, color: 'text-blue-500' },
  { id: 'blocked_escalations', labelEn: 'Blocked — Needs Unblocking', labelPl: 'Zablokowane — do odblokowania', icon: AlertTriangle, color: 'text-red-500' },
  { id: 'overdue_sla_breach', labelEn: 'Overdue / SLA Breach', labelPl: 'Po terminie / SLA', icon: Clock, color: 'text-red-600' },
  { id: 'assigned_tasks', labelEn: 'New Assignments', labelPl: 'Nowe zadania', icon: CheckSquare, color: 'text-blue-400' },
  { id: 'ai_insights', labelEn: 'AI Insights & Signals', labelPl: 'AI Insights i sygnały', icon: AlertCircle, color: 'text-cyan-500' },
  { id: 'fyi_system', labelEn: 'System Notifications', labelPl: 'Powiadomienia systemowe', icon: Bell, color: 'text-slate-500' },
  { id: 'fyi_mentions', labelEn: 'Mentions & FYI', labelPl: 'Wzmianki i FYI', icon: MessageSquare, color: 'text-amber-500' },
  { id: 'other', labelEn: 'Other', labelPl: 'Inne', icon: Inbox, color: 'text-slate-400' },
];

// ── Relative time formatting ──
const formatRelativeTime = (iso: string, isPolish: boolean): { text: string; agingLevel: 'fresh' | 'warm' | 'hot' | 'critical' } => {
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
  else text = d.toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', { month: 'short', day: 'numeric' });

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
  const label = sla.level === 'none' ? 'OK' : sla.isBreached ? `${sla.level} +${timeStr}` : `${sla.level} ${timeStr}`;
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
  { id: 'select', label: '', width: 40, minWidth: 40, maxWidth: 40, resizable: false, filterable: false },
  { id: 'title', label: 'Title', width: 999, minWidth: 300, resizable: false, filterable: false },
  { id: 'status', label: 'Status', width: 100, minWidth: 80, maxWidth: 140, resizable: true, filterable: true, filterType: 'multiselect', filterOptions: INBOX_STATUS_FILTER_OPTIONS },
  { id: 'urgency', label: 'Urgency', width: 110, minWidth: 80, maxWidth: 150, resizable: true, filterable: true, filterType: 'multiselect', filterOptions: INBOX_URGENCY_FILTER_OPTIONS },
  { id: 'type', label: 'Type', width: 120, minWidth: 90, maxWidth: 160, resizable: true, filterable: true, filterType: 'multiselect', filterOptions: INBOX_TYPE_FILTER_OPTIONS },
  { id: 'section', label: 'Section', width: 150, minWidth: 110, maxWidth: 220, resizable: true, filterable: true, filterType: 'multiselect', filterOptions: INBOX_SECTION_FILTER_OPTIONS },
  { id: 'source', label: 'Source', width: 90, minWidth: 70, maxWidth: 130, resizable: true, filterable: true, filterType: 'multiselect', filterOptions: INBOX_SOURCE_FILTER_OPTIONS },
  { id: 'received', label: 'Received', width: 120, minWidth: 90, maxWidth: 160, resizable: true, filterable: false },
  { id: 'sla', label: 'SLA', width: 100, minWidth: 70, maxWidth: 140, resizable: true, filterable: false },
  { id: 'actions', label: '', width: 140, minWidth: 100, maxWidth: 180, resizable: false, filterable: false, align: 'right' },
];

const getDefaultColumnWidths = (): ColumnWidths =>
  INBOX_COLUMNS.reduce((acc, col) => ({ ...acc, [col.id]: col.width }), {});

// ═══════════════════════════════════════════════════════════════════════════════
// Preview Pane (A3 — Split View)
// ═══════════════════════════════════════════════════════════════════════════════
const PreviewPane: React.FC<{
  item: InboxItem;
  isPolish: boolean;
  onClose: () => void;
  onOpen: () => void;
  onTriage: (action: TriageAction) => void;
  onSnooze: (preset: SnoozePreset) => void;
  onSaveAsNote?: (item: InboxItem) => void;
}> = ({ item, isPolish, onClose, onOpen, onTriage, onSnooze, onSaveAsNote }) => {
  const u = urgencyConfig[item.urgency] || urgencyConfig.normal;
  const UIcon = u.icon;
  const TIcon = typeIcon[item.type] || Inbox;
  const sla = slaPill(item.sla);
  const { text: receivedText, agingLevel } = formatRelativeTime(item.receivedAt, isPolish);
  const sectionDef = SMART_SECTIONS.find((s) => s.id === item.section);
  const SectionIcon = sectionDef?.icon || Inbox;
  const isNotification = String(item._key || '').startsWith('notification:');

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900/50">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
          {isPolish ? 'Podgląd' : 'Preview'}
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={onOpen}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary-500/10 text-primary-600 dark:text-primary-400 hover:bg-primary-500/20 transition-colors"
          >
            <Eye size={13} />
            {isPolish ? 'Otwórz' : 'Open full'}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Title */}
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white leading-snug">
            {item.title}
          </h2>
          {item.description && (
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
              {item.description}
            </p>
          )}
        </div>

        {/* Meta badges */}
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${u.pill}`}>
            <UIcon size={12} />
            {u.label}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-200">
            <TIcon size={12} />
            {typeLabel[item.type] || item.type.replace(/_/g, ' ')}
          </span>
          <span className={`text-xs font-medium ${AGING_STYLES[agingLevel]}`}>
            {receivedText}
          </span>
        </div>

        {/* Section */}
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-navy-800/40 rounded-lg">
          <SectionIcon size={14} className={sectionDef?.color || 'text-slate-400'} />
          <span className="text-xs text-slate-600 dark:text-slate-300">
            {sectionDef?.[isPolish ? 'labelPl' : 'labelEn'] || item.section}
          </span>
        </div>

        {/* N7: "Why am I seeing this?" */}
        {item.reason && (
          <div className="flex items-start gap-2 px-3 py-2 bg-sky-50 dark:bg-sky-500/10 rounded-lg border border-sky-200/50 dark:border-sky-500/15">
            <HelpCircle size={13} className="text-sky-500 mt-0.5 shrink-0" />
            <div className="text-xs text-sky-700 dark:text-sky-300">
              <span className="font-medium">{isPolish ? 'Dlaczego to widzę:' : 'Why am I seeing this:'}</span>{' '}
              {item.reason}
            </div>
          </div>
        )}

        {/* SLA */}
        {item.sla && sla.label !== '-' && (
          <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-navy-800/40 rounded-lg">
            <span className="text-xs text-slate-500 dark:text-slate-400">SLA</span>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${sla.className}`}>
              {sla.label}
            </span>
          </div>
        )}

        {/* Due date */}
        {item.dueDate && (
          <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-navy-800/40 rounded-lg">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {isPolish ? 'Termin' : 'Due date'}
            </span>
            <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
              {new Date(item.dueDate).toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        )}

        {/* AI Suggestion (C1) */}
        {item.suggestedAction && (
          <div className="flex items-start gap-2 px-3 py-2.5 bg-purple-50 dark:bg-purple-500/10 rounded-lg border border-purple-200/50 dark:border-purple-500/20">
            <span className="text-purple-500 text-sm mt-0.5">✨</span>
            <div>
              <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
                {isPolish ? 'Sugestia AI' : 'AI Suggestion'}
              </span>
              <p className="text-xs text-purple-600 dark:text-purple-400 mt-0.5">
                {item.suggestedReason || `Suggested: ${item.suggestedAction}`}
              </p>
              <button
                onClick={() => onTriage(item.suggestedAction!)}
                className="mt-1.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-200 hover:bg-purple-200 dark:hover:bg-purple-500/30 transition-colors"
              >
                <Check size={11} />
                {isPolish ? 'Zastosuj' : 'Apply'}
              </button>
            </div>
          </div>
        )}

        {/* Linked entities */}
        {(item.linkedTaskId || item.linkedDecisionId) && (
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {isPolish ? 'Powiązania' : 'Linked'}
            </span>
            {item.linkedTaskId && (
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-500/10 rounded-lg text-xs text-blue-700 dark:text-blue-300">
                <CheckSquare size={12} /> Task: {item.linkedTaskId.slice(0, 8)}…
              </div>
            )}
            {item.linkedDecisionId && (
              <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 dark:bg-purple-500/10 rounded-lg text-xs text-purple-700 dark:text-purple-300">
                <Scale size={12} /> Decision: {item.linkedDecisionId.slice(0, 8)}…
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="border-t border-slate-200 dark:border-navy-700 p-4 space-y-3">
        {/* N11: Route to Focus */}
        <div>
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
            {isPolish ? 'Dodaj do Focus:' : 'Add to Focus:'}
          </span>
          <div className="flex gap-1.5">
            <button
              onClick={() => onTriage('accept_today')}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-500/25 transition-colors"
            >
              <Zap size={13} />
              {isPolish ? 'Dziś' : 'Today'}
            </button>
            <button
              onClick={() => onTriage('accept_week')}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-500/25 transition-colors"
            >
              <CalendarClock size={13} />
              {isPolish ? 'Ten tydz.' : 'This week'}
            </button>
            <button
              onClick={() => onTriage('accept_later')}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 dark:bg-navy-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors"
            >
              <Calendar size={13} />
              {isPolish ? 'Później' : 'Later'}
            </button>
          </div>
        </div>

        {/* N1/N8/N10: Status actions */}
        <div className="grid grid-cols-4 gap-1.5">
          <button
            onClick={() => onTriage('done')}
            className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-500/20 transition-colors"
          >
            <CheckCircle2 size={13} />
            {isPolish ? 'Gotowe' : 'Done'}
          </button>
          <button
            onClick={() => onTriage('save')}
            className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors"
          >
            <Bookmark size={13} />
            {isPolish ? 'Zapisz' : 'Save'}
          </button>
          {onSaveAsNote && (
            <button
              onClick={() => onSaveAsNote(item)}
              className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium bg-slate-50 text-slate-700 dark:bg-navy-800 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
            >
              <FileText size={13} />
              {isPolish ? 'Zapisz jako notatkę' : 'Save as note'}
            </button>
          )}
          <button
            onClick={() => onTriage('dismiss')}
            className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 dark:bg-navy-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors"
          >
            <Archive size={13} />
            {isPolish ? 'Odłóż' : 'Dismiss'}
          </button>
        </div>

        {/* Snooze row */}
        <div>
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
            {isPolish ? 'Odłóż na:' : 'Snooze for:'}
          </span>
          <div className="flex flex-wrap gap-1">
            {SNOOZE_PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => onSnooze(p.id)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors"
              >
                <Clock size={11} />
                {isPolish ? p.labelPl : p.labelEn}
              </button>
            ))}
          </div>
        </div>
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
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');
  const { emitMyWorkEvent } = useAppStore();

  const [data, setData] = useState<InboxResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<InboxViewMode>('flat');
  const [inboxSection, setInboxSection] = useState<'today' | 'this_week' | 'all'>('all');

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Keyboard navigation
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const tableRef = useRef<HTMLDivElement>(null);

  // Column widths
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>(getDefaultColumnWidths());

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
  const [statusTab, setStatusTab] = useState<InboxStatusTab>('open');

  // N2: Action Required filter
  const [actionRequiredOnly, setActionRequiredOnly] = useState(false);

  // L4: Auto-triage
  const [autoTriageSuggestions, setAutoTriageSuggestions] = useState<any[]>([]);
  const [autoTriageLoading, setAutoTriageLoading] = useState(false);

  // ── Fetch ──
  const fetchInbox = useCallback(async () => {
    try {
      setLoading(true);
      const status = statusTab === 'all' ? 'all' : statusTab === 'done' ? 'done' : statusTab === 'saved' ? 'saved' : 'open';
      const res = (await Api.get(`/my-work/inbox?limit=200&status=${status}`)) as InboxResponse;
      setData(res);
      onCountsChange({ total: res?.summary?.total || 0, critical: res?.summary?.critical || 0 });
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
    if (urgencyFilter?.length) result = result.filter((item) => urgencyFilter.includes(item.urgency));
    if (typeFilter?.length) result = result.filter((item) => typeFilter.includes(item.type));
    if (sectionFilter?.length) result = result.filter((item) => sectionFilter.includes(item.section));
    const sourceFilter = tableFilters.source as string[] | undefined;
    if (sourceFilter?.length) result = result.filter((item) => sourceFilter.includes(item.source?.type || 'system'));
    // N2: Action required filter
    if (actionRequiredOnly) result = result.filter((item) => item.isActionable);
    return result;
  }, [items, tableFilters, actionRequiredOnly]);

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
    async (item: InboxItem, action: TriageAction) => {
      if (action === 'snooze') return;
      try {
        await Api.post(`/my-work/inbox/${encodeURIComponent(item.id)}/triage`, {
          action,
          itemKey: item._key,
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
        emitMyWorkEvent({ type: 'item:triaged', entityType: 'inbox', entityId: String(item.id), meta: { action } });
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

  // N9: Snooze — persist to backend (source of truth)
  const handleSnooze = useCallback(async (item: InboxItem, preset: SnoozePreset) => {
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
  }, [isPolish, previewItem]);

  // ── L4: Auto-triage ──
  const handleAutoTriage = async () => {
    setAutoTriageLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/my-work/inbox/auto-triage', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        const suggestions = data.suggestions || [];
        const autoApplyItems = suggestions.filter((s: any) => s.autoApply);
        for (const item of autoApplyItems) {
          try {
            await fetch(`/api/my-work/inbox/${item.itemId}/triage`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: item.suggestedAction, itemKey: item.itemKey }),
            });
          } catch { /* continue */ }
        }
        if (autoApplyItems.length > 0) {
          toast.success(isPolish ? `${autoApplyItems.length} elementów automatycznie przetriażowanych` : `${autoApplyItems.length} items auto-triaged`);
          emitMyWorkEvent({ type: 'item:triaged', entityType: 'inbox', entityId: 'bulk' });
        }
        setAutoTriageSuggestions(suggestions.filter((s: any) => !s.autoApply));
      }
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
        await Api.post('/my-work/inbox/bulk-triage', { itemKeys, action });
        const removedKeys = new Set(itemKeys);
        setData((prev) => {
          if (!prev) return prev;
          return { ...prev, items: prev.items.filter((x) => !removedKeys.has(x._key)) };
        });
        setSelectedIds(new Set());
        toast.success(
          isPolish ? `${selectedItems.length} elementów przetworzonych` : `${selectedItems.length} items processed`
        );
      } catch (e) {
        console.error('Bulk triage failed', e);
        toast.error(isPolish ? 'Nie udało się wykonać akcji' : 'Failed to process items');
      }
    },
    [filteredItems, selectedIds, isPolish]
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
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

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
          if (focusedIndex >= 0 && focusedIndex < flatItems.length) handleSelectItem(flatItems[focusedIndex].id);
          break;
        case 't':
        case 'T':
          if (focusedIndex >= 0 && focusedIndex < flatItems.length) triage(flatItems[focusedIndex], 'accept_today');
          break;
        case 'w':
        case 'W':
          if (focusedIndex >= 0 && focusedIndex < flatItems.length) triage(flatItems[focusedIndex], 'accept_week');
          break;
        case 'e':
        case 'E':
          if (focusedIndex >= 0 && focusedIndex < flatItems.length) triage(flatItems[focusedIndex], 'done');
          break;
        case 'b':
        case 'B':
          if (focusedIndex >= 0 && focusedIndex < flatItems.length) triage(flatItems[focusedIndex], 'save');
          break;
        case 'a':
        case 'A':
          if (focusedIndex >= 0 && focusedIndex < flatItems.length) triage(flatItems[focusedIndex], 'dismiss');
          break;
        case 'x':
        case 'X':
          if (focusedIndex >= 0 && focusedIndex < flatItems.length) triage(flatItems[focusedIndex], 'reject');
          break;
        case 'Escape':
          if (previewItem) { setPreviewItem(null); e.preventDefault(); }
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
    const TIcon = typeIcon[item.type] || Inbox;
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
            onClick={(e) => { e.stopPropagation(); handleSelectItem(item.id); }}
            className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${
              isSelected ? 'bg-primary-500 border-primary-500 text-white' : 'border-slate-300 dark:border-navy-500 hover:border-primary-400'
            }`}
          >
            {isSelected && <CheckSquare size={12} />}
          </button>
        </td>

        {/* Title */}
        <td className="px-3 py-2 w-full">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-900 dark:text-white truncate block" title={item.title}>
              {item.title}
            </span>
            {item.suggestedAction && (
              <span
                className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-purple-50 dark:bg-purple-500/10 text-[10px] font-medium text-purple-600 dark:text-purple-300 cursor-help"
                title={item.suggestedReason || (isPolish ? 'Sugestia AI' : 'AI suggestion')}
              >
                AI: {item.suggestedAction === 'accept_today' ? '✓' : item.suggestedAction === 'archive' ? '📦' : item.suggestedAction === 'schedule' ? '📅' : '→'}
              </span>
            )}
            {showDupeCount && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (groupKey) setExpandedGroups((prev) => {
                    const next = new Set(prev);
                    if (next.has(groupKey)) next.delete(groupKey);
                    else next.add(groupKey);
                    return next;
                  });
                }}
                className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-navy-800 text-[10px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors"
                title={isPolish ? `${groupCount} podobnych` : `${groupCount} similar`}
              >
                <Layers size={10} />
                x{groupCount}
                {isGroupExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              </button>
            )}
          </div>
          {item.description && (
            <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5 block">
              {item.description}
            </span>
          )}
          {/* N7: reason chip — visible on hover */}
          {item.reason && (
            <span className="hidden group-hover:inline-flex items-center gap-1 text-[10px] text-sky-600 dark:text-sky-400 mt-0.5">
              <HelpCircle size={10} className="shrink-0" />
              {item.reason}
            </span>
          )}
        </td>

        {/* Status */}
        <td className="px-3 py-2" style={{ width: columnWidths.status }}>
          {(() => {
            const st = item.itemStatus || (item.triaged ? 'done' : 'open');
            const cfg: Record<string, { color: string; dot: string; label: string }> = {
              open: { color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', dot: 'bg-amber-500', label: isPolish ? 'Otwarte' : 'Open' },
              done: { color: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300', dot: 'bg-green-500', label: isPolish ? 'Gotowe' : 'Done' },
              saved: { color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300', dot: 'bg-blue-500', label: isPolish ? 'Zapisane' : 'Saved' },
              snoozed: { color: 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300', dot: 'bg-purple-500', label: isPolish ? 'Odłożone' : 'Snoozed' },
              dismissed: { color: 'bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300', dot: 'bg-slate-400', label: isPolish ? 'Odłożone' : 'Dismissed' },
            };
            const c = cfg[st] || cfg.open;
            return (
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap leading-none ${c.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                {c.label}
                {item.isActionable && <Zap size={10} className="text-amber-500" />}
              </span>
            );
          })()}
        </td>

        {/* Urgency */}
        <td className="px-3 py-2" style={{ width: columnWidths.urgency }}>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${u.pill}`}>
            <UIcon size={11} />
            {u.label}
          </span>
        </td>

        {/* Type */}
        <td className="px-3 py-2" style={{ width: columnWidths.type }}>
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
            <TIcon size={12} />
            <span className="truncate">{typeLabel[item.type] || item.type.replace(/_/g, ' ')}</span>
          </span>
        </td>

        {/* Section */}
        <td className="px-3 py-2" style={{ width: columnWidths.section }}>
          <span className="text-xs text-slate-600 dark:text-slate-400">
            {SMART_SECTIONS.find((s) => s.id === item.section)?.[isPolish ? 'labelPl' : 'labelEn'] || item.section}
          </span>
        </td>

        {/* N13: Source */}
        <td className="px-3 py-2" style={{ width: columnWidths.source }}>
          {(() => {
            const src = item.source?.type || 'system';
            const cfg: Record<string, { icon: typeof Bell; color: string; label: string }> = {
              system: { icon: Bell, color: 'text-slate-500', label: 'System' },
              ai: { icon: Star, color: 'text-purple-500', label: 'AI' },
              user: { icon: MessageSquare, color: 'text-blue-500', label: item.source?.userName || 'User' },
            };
            const c = cfg[src] || cfg.system;
            const SrcIcon = c.icon;
            return (
              <span className={`inline-flex items-center gap-1 text-xs ${c.color}`}>
                <SrcIcon size={11} />
                {c.label}
              </span>
            );
          })()}
        </td>

        {/* Received (relative + aging) */}
        <td className="px-3 py-2" style={{ width: columnWidths.received }}>
          <span className={`text-xs font-medium whitespace-nowrap ${AGING_STYLES[agingLevel]}`}>
            {receivedText}
          </span>
        </td>

        {/* SLA */}
        <td className="px-3 py-2" style={{ width: columnWidths.sla }}>
          {sla.label === '-' ? (
            <span className={sla.className}>{sla.label}</span>
          ) : (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${sla.className}`} title={sla.title}>
              {sla.label}
            </span>
          )}
        </td>

        {/* Inline Actions */}
        <td className="px-2 py-2 text-right" style={{ width: columnWidths.actions }} onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-0.5">
            {/* Always visible: Open */}
            <button
              onClick={() => open(item)}
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
              title={isPolish ? 'Otwórz' : 'Open'}
            >
              <Eye size={14} />
            </button>

            {/* Hover actions */}
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => triage(item, 'accept_today')}
                className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                title={isPolish ? 'Focus → Dziś (T)' : 'Focus → Today (T)'}
              >
                <Zap size={14} />
              </button>
              <button
                onClick={() => triage(item, 'done')}
                className="p-1.5 rounded-md text-slate-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                title={isPolish ? 'Gotowe (E)' : 'Done (E)'}
              >
                <CheckCircle2 size={14} />
              </button>
              <button
                onClick={() => triage(item, 'save')}
                className="p-1.5 rounded-md text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                title={isPolish ? 'Zapisz (B)' : 'Save (B)'}
              >
                <Bookmark size={14} />
              </button>
              <button
                onClick={() => triage(item, 'dismiss')}
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
                title={isPolish ? 'Odłóż (A)' : 'Dismiss (A)'}
              >
                <Archive size={14} />
              </button>
              <button
                onClick={() => handleSaveAsNote(item)}
                className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                title={isPolish ? 'Zapisz jako notatkę' : 'Save as note'}
              >
                <FileText size={14} />
              </button>
              {/* Snooze */}
              <div className="relative">
                <button
                  onClick={() => setSnoozeOpenForId(snoozeOpenForId === item.id ? null : item.id)}
                  className="p-1.5 rounded-md text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                  title={isPolish ? 'Odłóż' : 'Snooze'}
                >
                  <Clock size={14} />
                </button>
                {snoozeOpenForId === item.id && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setSnoozeOpenForId(null)} />
                    <div className="absolute right-0 top-full mt-1 z-50 py-1 bg-white dark:bg-navy-800 rounded-lg shadow-xl border border-slate-200 dark:border-navy-700 min-w-[140px]">
                      {SNOOZE_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          onClick={() => handleSnooze(item, preset.id)}
                          className="w-full px-3 py-1.5 text-left text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
                        >
                          {isPolish ? preset.labelPl : preset.labelEn}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
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
            {allSelected ? <CheckSquare size={14} /> : someSelected ? <Minus size={14} /> : <Square size={14} />}
          </button>
        </th>

        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-full">
          {isPolish ? 'Tytuł' : 'Title'}
        </th>

        {/* Filterable columns */}
        {['status', 'urgency', 'type', 'section'].map((colId) => {
          const col = INBOX_COLUMNS.find((c) => c.id === colId)!;
          return (
            <th key={colId} className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider relative group/header" style={{ width: columnWidths[colId] }}>
              <div className="flex items-center gap-1">
                <span className={(tableFilters[colId] as string[])?.length ? 'text-primary-500' : ''}>
                  {col.label}
                </span>
                <FilterDropdown
                  column={col}
                  value={tableFilters[colId] as string[]}
                  onChange={(val) => handleFilterChange(colId, val as string[])}
                  isOpen={openFilterId === colId}
                  onToggle={() => setOpenFilterId(openFilterId === colId ? null : colId)}
                  onClose={() => setOpenFilterId(null)}
                />
              </div>
              <ColumnResizer columnId={colId} currentWidth={columnWidths[colId]} minWidth={col.minWidth!} maxWidth={col.maxWidth!} onResize={handleColumnResize} />
            </th>
          );
        })}

        {/* Non-filterable resizable columns */}
        {['received', 'sla'].map((colId) => {
          const col = INBOX_COLUMNS.find((c) => c.id === colId)!;
          return (
            <th key={colId} className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider relative group/header" style={{ width: columnWidths[colId] }}>
              <span>{col.label}</span>
              <ColumnResizer columnId={colId} currentWidth={columnWidths[colId]} minWidth={col.minWidth!} maxWidth={col.maxWidth!} onResize={handleColumnResize} />
            </th>
          );
        })}

        <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider" style={{ width: columnWidths.actions }}>
          {isPolish ? 'Akcje' : 'Actions'}
        </th>
      </tr>
    </thead>
  );

  // ── Render smart sections ──
  const renderSectionsView = () => {
    if (!sectionGroups) return null;
    let globalIndex = 0;

    return (
      <table className="w-full table-fixed" style={{ minWidth: 900 }}>
        {renderTableHeader()}
        <tbody>
          {SMART_SECTIONS.map((section) => {
            const sectionData = sectionGroups.get(section.id) || [];
            if (sectionData.length === 0) return null;
            const isCollapsed = collapsedSections.has(section.id);
            const SectionIcon = section.icon;
            const totalCount = sectionData.reduce((sum, g) => sum + g.count, 0);

            return (
              <React.Fragment key={section.id}>
                {/* Section header row */}
                <tr className="bg-slate-50/80 dark:bg-navy-800/40 border-b border-slate-200 dark:border-navy-700/50">
                  <td colSpan={10} className="px-3 py-2 border-l-[3px] border-l-transparent">
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => setCollapsedSections((prev) => {
                          const next = new Set(prev);
                          if (next.has(section.id)) next.delete(section.id);
                          else next.add(section.id);
                          return next;
                        })}
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
                  </td>
                </tr>
                {/* Section items */}
                {!isCollapsed &&
                  sectionData.map((group) => {
                    const idx = globalIndex++;
                    const rows = [renderRow(group.representative, idx, group.count, group.key)];
                    if (group.count > 1 && expandedGroups.has(group.key)) {
                      for (let i = 1; i < group.items.length; i++) {
                        rows.push(renderRow(group.items[i], globalIndex++));
                      }
                    }
                    return rows;
                  })}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
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
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-navy-950" ref={tableRef}>
      {/* Header */}
      <div className="px-4 pt-4 pb-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-slate-900 dark:text-white">
              {isPolish ? 'Inbox (Action Queue)' : 'Inbox (Action Queue)'}
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400">
              {isPolish
                ? 'Zadania, decyzje, powiadomienia — wszystko wymagające Twojej akcji.'
                : 'Tasks, decisions, notifications — everything requiring your action.'}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isPolish ? 'Skróty: J/K nawigacja · T dziś · W tydzień · E gotowe · B zapisz · A odłóż · ? pomoc' : 'Shortcuts: J/K nav · T today · W week · E done · B save · A dismiss · ? help'}
            </div>
          </div>

          {/* View mode toggle + Settings */}
          <div className="flex items-center gap-2">
            <div
              className="inline-flex items-center rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 p-0.5"
              role="radiogroup"
              aria-label={isPolish ? 'Tryb widoku' : 'View mode'}
            >
              <button
                onClick={() => setViewMode('flat')}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all duration-150 ${
                  viewMode === 'flat'
                    ? 'bg-white dark:bg-navy-800 text-primary-600 dark:text-primary-400 shadow-sm border border-slate-200 dark:border-navy-600'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
                title={isPolish ? 'Płaska lista' : 'Flat list'}
              >
                <List size={14} />
                {isPolish ? 'Lista' : 'List'}
              </button>
              <button
                onClick={() => setViewMode('sections')}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all duration-150 ${
                  viewMode === 'sections'
                    ? 'bg-white dark:bg-navy-800 text-primary-600 dark:text-primary-400 shadow-sm border border-slate-200 dark:border-navy-600'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
                title={isPolish ? 'Grupowanie tematyczne' : 'Smart sections'}
              >
                <Layers size={14} />
                {isPolish ? 'Sekcje' : 'Sections'}
              </button>
            </div>
            <button
              onClick={handleAutoTriage}
              disabled={autoTriageLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 transition-all"
            >
              {autoTriageLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {isPolish ? 'AI Triage' : 'AI Auto-Triage'}
            </button>
            <button
              className="p-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
              title={isPolish ? 'Ustawienia Inbox' : 'Inbox Settings'}
            >
              <Settings size={16} />
            </button>
          </div>
        </div>

        {/* N1: Status tabs */}
        <div className="mt-3 flex items-center gap-1 border-b border-slate-200 dark:border-navy-700">
          {([
            { id: 'open' as InboxStatusTab, icon: Inbox, label: isPolish ? 'Otwarte' : 'Open', count: data?.summary?.counts?.open },
            { id: 'done' as InboxStatusTab, icon: CheckCircle2, label: isPolish ? 'Gotowe' : 'Done', count: data?.summary?.counts?.done },
            { id: 'saved' as InboxStatusTab, icon: BookmarkCheck, label: isPolish ? 'Zapisane' : 'Saved', count: data?.summary?.counts?.saved },
            { id: 'all' as InboxStatusTab, icon: List, label: isPolish ? 'Wszystkie' : 'All', count: undefined },
          ]).map((tab) => {
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setStatusTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  statusTab === tab.id
                    ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                <TabIcon size={14} />
                {tab.label}
                {tab.count != null && <span className="text-xs opacity-60 ml-0.5">({tab.count})</span>}
              </button>
            );
          })}
        </div>

        {/* Summary pills + N2: Action Required toggle */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 dark:bg-navy-900/40 border border-slate-200 dark:border-navy-700 text-sm text-slate-700 dark:text-slate-200">
            <Inbox size={14} />
            {isPolish ? 'W kolejce' : 'In queue'}: <b>{data?.summary?.total ?? 0}</b>
          </span>
          {(data?.summary?.critical ?? 0) > 0 && (
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-100 dark:bg-red-500/15 border border-red-200/70 dark:border-red-500/25 text-sm text-red-700 dark:text-red-200">
              <AlertTriangle size={14} />
              {isPolish ? 'Krytyczne' : 'Critical'}: <b>{data?.summary?.critical ?? 0}</b>
            </span>
          )}
          {(data?.summary?.actionRequired ?? 0) > 0 && (
            <button
              onClick={() => setActionRequiredOnly(!actionRequiredOnly)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border transition-colors ${
                actionRequiredOnly
                  ? 'bg-amber-500 text-white border-amber-500 dark:bg-amber-600'
                  : 'bg-amber-50 dark:bg-amber-500/10 border-amber-200/70 dark:border-amber-500/25 text-amber-700 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-500/20'
              }`}
              title={isPolish ? 'Pokaż tylko wymagające akcji' : 'Show only items needing my action'}
            >
              <Zap size={14} />
              {isPolish ? 'Wymaga akcji' : 'Action required'}: <b>{data?.summary?.actionRequired ?? 0}</b>
            </button>
          )}
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-sm text-slate-600 dark:text-slate-300">
            <Clock size={14} />
            {isPolish ? 'Nowe dziś' : 'New today'}: <b>{data?.summary?.newToday ?? 0}</b>
          </span>
        </div>

        {/* Time section tabs */}
        <div className="mt-3 flex items-center gap-1 border-b border-slate-200 dark:border-navy-700">
          {(['today', 'this_week', 'all'] as const).map((section) => {
            const count = sectionCounts[section];
            const label =
              section === 'today' ? (isPolish ? 'Nowe dziś' : 'New today')
                : section === 'this_week' ? (isPolish ? 'Nowe w tym tygodniu' : 'New this week')
                  : (isPolish ? 'Wszystkie' : 'All');
            return (
              <button
                key={section}
                onClick={() => setInboxSection(section)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  inboxSection === section
                    ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                {label} <span className="text-xs opacity-60">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="px-4 py-2 bg-primary-50 dark:bg-primary-500/10 border-b border-primary-200 dark:border-primary-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
                {selectedIds.size} {isPolish ? 'zaznaczonych' : 'selected'}
              </span>
              <button onClick={() => handleSelectAll(true)} className="text-xs text-primary-600 dark:text-primary-400 hover:underline">
                {isPolish ? 'Zaznacz wszystkie' : 'Select all'}
              </button>
              <button onClick={() => setSelectedIds(new Set())} className="text-xs text-slate-500 hover:underline">
                {isPolish ? 'Odznacz' : 'Clear'}
              </button>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => bulkTriage('accept_today')} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-500/25 transition-colors">
                <Zap size={13} /> {isPolish ? 'Focus: Dziś' : 'Focus: Today'}
              </button>
              <button onClick={() => bulkTriage('accept_week')} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-500/25 transition-colors">
                <CalendarClock size={13} /> {isPolish ? 'Ten tydz.' : 'This week'}
              </button>
              <button onClick={() => bulkTriage('done')} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-500/25 transition-colors">
                <CheckCircle2 size={13} /> {isPolish ? 'Gotowe' : 'Done'}
              </button>
              <button onClick={() => bulkTriage('save')} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors">
                <Bookmark size={13} /> {isPolish ? 'Zapisz' : 'Save'}
              </button>
              <button onClick={() => bulkTriage('dismiss')} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 dark:bg-navy-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors">
                <Archive size={13} /> {isPolish ? 'Odłóż' : 'Dismiss'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content + Preview pane */}
      <div className="flex-1 flex min-h-0">
        {/* Table content */}
        <div className={`flex-1 overflow-y-auto p-4 pt-0 ${previewItem ? 'max-w-[65%]' : ''} transition-all duration-200`}>
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
                  <p className="text-base font-semibold mb-1">{isPolish ? 'Brak zakończonych elementów' : 'No completed items'}</p>
                  <p className="text-sm text-slate-500">{isPolish ? 'Oznaczaj elementy jako gotowe (E), żeby tu trafiały.' : 'Mark items as Done (E) and they\'ll appear here.'}</p>
                </>
              ) : statusTab === 'saved' ? (
                <>
                  <BookmarkCheck size={40} className="mx-auto mb-4 text-amber-400" />
                  <p className="text-base font-semibold mb-1">{isPolish ? 'Brak zapisanych elementów' : 'No saved items'}</p>
                  <p className="text-sm text-slate-500">{isPolish ? 'Użyj Zapisz (B) aby odłożyć elementy na później.' : 'Use Save (B) to bookmark items for later.'}</p>
                </>
              ) : (
                <>
                  <Inbox size={40} className="mx-auto mb-4 text-slate-400" />
                  <p className="text-base font-semibold mb-1">
                    {isPolish ? 'Inbox jest pusty — zero zaległości!' : 'Inbox is empty — zero backlog!'}
                  </p>
                  <p className="text-sm text-slate-500">
                    {isPolish ? 'Wszystko przetworzone. Świetna robota!' : 'Everything processed. Great job!'}
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden mt-4">
              {viewMode === 'sections' ? renderSectionsView() : renderFlatView()}
            </div>
          )}
        </div>

        {/* Preview Pane (A3) */}
        {previewItem && (
          <div className="w-[35%] min-w-[340px] border-l border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 overflow-y-auto">
            <PreviewPane
              item={previewItem}
              isPolish={isPolish}
              onClose={() => setPreviewItem(null)}
              onOpen={() => open(previewItem)}
              onTriage={(action) => { triage(previewItem, action); setPreviewItem(null); }}
              onSnooze={(preset) => { handleSnooze(previewItem, preset); setPreviewItem(null); }}
              onSaveAsNote={handleSaveAsNote}
            />
          </div>
        )}
      </div>
    </div>
  );
};
