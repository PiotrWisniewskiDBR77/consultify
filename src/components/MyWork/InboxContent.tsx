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
  ChevronsUpDown,
  ChevronUp,
  Clock,
  Copy,
  Edit2,
  Eye,
  FileText,
  Inbox,
  Layers,
  Lightbulb,
  type LucideIcon,
  MessageSquare,
  Minus,
  Pin,
  Scale,
  Sparkles,
  Square,
  Star,
  User,
  X,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { usePersistedColumnWidths } from '@/components/MyWork/shared/usePersistedColumnWidths';
import {
  type TableSettingsColumn,
  TableSettingsPopover,
} from '@/components/shared/ModuleHub/TableSettingsPopover';
import {
  actionPillClass,
  type ActionRow,
  type ExtraCopyFormat,
  type MetaPill,
  PreviewActionBar,
  PreviewDetailsSection,
  PreviewMetaCard,
  PreviewRelations,
  type RelationItem,
} from '@/components/shared/PreviewPane';
import {
  type RowAction,
  type RowActionSection,
  RowActionsMenu,
} from '@/components/shared/RowActionsMenu';
import {
  FOCUSED_ROW_CLASS,
  PREVIEW_SELECTED_ROW_CLASS,
  SELECTED_ROW_CLASS,
} from '@/components/shared/selectionTokens';
import {
  EmptyState as SharedEmptyState,
  LoadingState as SharedLoadingState,
} from '@/components/shared/states';
import {
  StandardTable,
  type TableColumn as StandardTableColumn,
  type TableRow as StandardTableRow,
} from '@/components/standard';
import { ErrorState } from '@/components/ui/primitives';
import { DueChip } from '@/components/ui/primitives/chips/DueChip';
import { EntityStatusChip } from '@/components/ui/primitives/chips/EntityStatusChip';
import {
  type ColumnDef,
  ColumnResizer,
  type ColumnWidths,
  type TableFilters,
} from '@/components/ui/ResizableTable';
import { PreviewPaneShell } from '@/components/ui/ResizableTable';
import { FilterDropdown } from '@/components/ui/ResizableTable/FilterDropdown';
import i18n from '@/i18n';
import { Api } from '@/services/api';
import {
  type V8CanonicalInboxItem,
  type V8CanonicalInboxStats,
  V8MyWorkApi,
} from '@/services/api/v8/my-work';
import { useAppStore } from '@/store/useAppStore';
import { copyAsMarkdown, copyForSlack } from '@/utils/clipboard';
import { isM03InboxStandardTableEnabled } from '@/utils/m03InboxStandardTableFlag';

// duplicateIdentity — CB-04/RB-019/RV-029.
//
// Shared "semantic duplicate" grouping for Personal Tasks and Inbox: neither
// list had ANY business-identity concept beyond the raw row id, so two rows
// with the exact same title, urgency, status, section, and source rendered
// as indistinguishable independent items with no grouping and no warning —
// a user could not tell a genuine duplicate assignment from two
// legitimately distinct pieces of work that just happen to share a title.
//
// This does NOT collapse or hide rows (every row still renders — hiding
// data a user might need to act on is worse than a cluttered list). It only
// computes, per item, how many OTHER items share the same identity key, so
// callers can render a visible "possible duplicate" grouping/warning.
//
// Kept local to this file (rather than a shared ./duplicateIdentity module)
// so it has no dependency outside this file's recovery scope.

/** Lowercases, trims, and collapses whitespace so trivial formatting
 * differences ("Fix bug" vs "fix   bug") don't defeat grouping. */
function normalizeIdentityTitle(title: string | null | undefined): string {
  return String(title || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** Joins a normalized title with additional disambiguating context (e.g.
 * project id, source, section) into one identity key. Two items are only
 * flagged as semantic duplicates when BOTH the title AND the context match —
 * matching title alone over-flags legitimately distinct same-named items in
 * different projects/sources. */
function buildDuplicateIdentityKey(
  title: string | null | undefined,
  ...context: Array<string | null | undefined>
): string {
  const normalizedContext = context
    .map((c) =>
      String(c || '')
        .trim()
        .toLowerCase()
    )
    .join('::');
  return `${normalizeIdentityTitle(title)}::${normalizedContext}`;
}

interface DuplicateGroupCounts {
  /** identityKey -> how many items share it. */
  counts: Map<string, number>;
  /** identityKey -> the ids of every item sharing it (for "N duplicates" UI). */
  idsByKey: Map<string, string[]>;
}

function computeDuplicateGroups(
  items: Array<{ id: string; identityKey: string }>
): DuplicateGroupCounts {
  const idsByKey = new Map<string, string[]>();
  for (const item of items) {
    const existing = idsByKey.get(item.identityKey);
    if (existing) existing.push(item.id);
    else idsByKey.set(item.identityKey, [item.id]);
  }
  const counts = new Map<string, number>();
  for (const [key, ids] of idsByKey) counts.set(key, ids.length);
  return { counts, idsByKey };
}

export type InboxUrgency = 'critical' | 'high' | 'normal' | 'low';
export type InboxItemType =
  | 'new_assignment'
  | 'mention'
  | 'escalation'
  | 'review_request'
  | 'decision_request'
  | 'ai_suggestion'
  | 'system_alert'
  | 'billing_alert'
  | 'project_update';

export type InboxSection =
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
  { icon: LucideIcon; labelEn: string; labelPl: string; pill: string; borderLeft: string }
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
    pill: 'border border-c-border-subtle bg-c-surface-raised text-c-text-secondary',
    borderLeft: 'border-l-c-border-strong',
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
    pill: 'border border-c-border-subtle bg-c-surface-raised text-c-text-secondary',
    borderLeft: 'border-l-c-border-strong',
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

export interface InboxItem {
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
  /** Raw source entity type as materialized (task|decision|notification|…). */
  sourceEntityType?: string;
  /** Who this item belongs to (canonical_inbox_items.user_id). */
  userId?: string;
  /** Which org this item was materialized under. */
  organizationId?: string;
  /** Last time the canonical row itself changed (triage, re-materialize). */
  updatedAt?: string;
  /**
   * Status of the SOURCE task/decision at materialization time — distinct
   * from `itemStatus` above (this item's own triage status). Undefined for
   * notification-sourced items and for items materialized before this field
   * existed. Render only if present (MW-CORE-003 golden-flow packet).
   */
  sourceStatus?: string;
  /**
   * initiative_id of the SOURCE task/decision. Undefined for
   * notification-sourced items — render only if present, no placeholder.
   */
  initiativeId?: string;
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

const ACTIONABLE_SECTIONS = new Set<InboxSection>([
  'approvals_gates',
  'decisions_required',
  'assigned_tasks',
  'blocked_escalations',
]);

const CANONICAL_SECTION_SET = new Set<InboxSection>([
  'decisions_required',
  'approvals_gates',
  'assigned_tasks',
  'blocked_escalations',
  'overdue_sla_breach',
  'fyi_system',
  'fyi_mentions',
  'ai_insights',
  'other',
]);

function mapInboxStatusToV8(
  status: InboxStatusTab
): 'pending' | 'resolved' | 'snoozed' | undefined {
  switch (status) {
    case 'done':
      return 'resolved';
    case 'saved':
      return 'snoozed';
    case 'open':
      return 'pending';
    default:
      return undefined;
  }
}

function mapCanonicalSection(section?: string): InboxSection {
  return section && CANONICAL_SECTION_SET.has(section as InboxSection)
    ? (section as InboxSection)
    : 'other';
}

function mapCanonicalItemType(itemType: V8CanonicalInboxItem['itemType']): InboxItemType {
  switch (itemType) {
    case 'task':
      return 'new_assignment';
    case 'decision':
      return 'decision_request';
    case 'approval':
      return 'review_request';
    case 'mention':
      return 'mention';
    case 'escalation':
      return 'escalation';
    case 'signal':
    default:
      return 'system_alert';
  }
}

function mapCanonicalItemStatus(status: V8CanonicalInboxItem['status']): InboxItem['itemStatus'] {
  switch (status) {
    case 'resolved':
      return 'done';
    case 'snoozed':
      return 'saved';
    default:
      return 'open';
  }
}

function buildCanonicalReason(section: InboxSection): string {
  switch (section) {
    case 'assigned_tasks':
      return 'Assigned work requires review or triage.';
    case 'decisions_required':
      return 'A decision is waiting for your input.';
    case 'approvals_gates':
      return 'An approval gate is waiting for action.';
    case 'blocked_escalations':
      return 'A blocker or escalation needs attention.';
    case 'overdue_sla_breach':
      return 'This item is overdue or at SLA risk.';
    case 'fyi_mentions':
      return 'You were mentioned or notified.';
    case 'ai_insights':
      return 'AI surfaced this item for awareness.';
    case 'fyi_system':
    case 'other':
    default:
      return 'This item appears in your inbox based on current workflow state.';
  }
}

function mapCanonicalItem(item: V8CanonicalInboxItem): InboxItem {
  const section = mapCanonicalSection(item.section);
  const sourceType =
    item.sourceEntityType === 'ai' ? 'ai' : item.sourceEntityType === 'user' ? 'user' : 'system';
  const itemStatus = mapCanonicalItemStatus(item.status);
  const dueAt = item.slaDeadline ? new Date(item.slaDeadline).toISOString() : undefined;

  return {
    id: item.id,
    type: mapCanonicalItemType(item.itemType),
    itemType:
      item.itemType === 'mention' || item.itemType === 'escalation' ? 'signal' : item.itemType,
    section,
    title: item.title,
    description: item.description,
    source: { type: sourceType },
    receivedAt: new Date(item.createdAt).toISOString(),
    dueDate: dueAt,
    urgency: item.priority,
    severity:
      item.priority === 'critical' ? 'CRITICAL' : item.priority === 'high' ? 'WARNING' : 'INFO',
    sla: dueAt
      ? {
          dueAt,
          remainingMs: new Date(dueAt).getTime() - Date.now(),
          isBreached: item.slaStatus === 'breached',
          level: item.slaStatus === 'breached' ? 'L3' : item.slaStatus === 'at_risk' ? 'L2' : 'L1',
        }
      : undefined,
    linkedTaskId: item.sourceEntityType === 'task' ? item.sourceEntityId : undefined,
    linkedDecisionId: item.sourceEntityType === 'decision' ? item.sourceEntityId : undefined,
    triaged: item.status !== 'pending',
    itemStatus,
    reason: buildCanonicalReason(section),
    isActionable: ACTIONABLE_SECTIONS.has(section),
    sourceEntityType: item.sourceEntityType,
    userId: item.userId,
    organizationId: item.organizationId,
    updatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : undefined,
    sourceStatus: item.sourceStatus || undefined,
    initiativeId: item.initiativeId || undefined,
    _key: `${item.sourceEntityType}:${item.sourceEntityId}` as InboxItemKey,
  };
}

function buildInboxResponseFromCanonical(
  items: V8CanonicalInboxItem[],
  stats: V8CanonicalInboxStats | null
): InboxResponse {
  const mappedItems = items.map(mapCanonicalItem);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const actionableCount =
    (stats?.bySection?.approvals_gates || 0) +
    (stats?.bySection?.decisions_required || 0) +
    (stats?.bySection?.assigned_tasks || 0) +
    (stats?.bySection?.blocked_escalations || 0);

  return {
    summary: {
      total: stats?.total ?? mappedItems.length,
      critical:
        stats?.byPriority?.critical ??
        mappedItems.filter((item) => item.urgency === 'critical').length,
      newToday: mappedItems.filter((item) => new Date(item.receivedAt) >= todayStart).length,
      actionRequired:
        stats != null ? actionableCount : mappedItems.filter((item) => item.isActionable).length,
      counts: {
        open:
          stats?.byStatus?.pending ??
          mappedItems.filter((item) => item.itemStatus === 'open').length,
        done:
          stats?.byStatus?.resolved ??
          mappedItems.filter((item) => item.itemStatus === 'done').length,
        saved:
          stats?.byStatus?.snoozed ??
          mappedItems.filter((item) => item.itemStatus === 'saved').length,
        dismissed: 0,
      },
    },
    items: mappedItems,
  };
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
// Exported (kanon TRIADA §27, flag ff_m03InboxStandardTable) so the
// grouped-rows flatten/mirror invariant (`flattenInboxDisplayGroups` below)
// is unit-testable without rendering the component — see
// tests/inboxStandardTableGrouping.test.ts.
export interface InboxGroup {
  key: string;
  representative: InboxItem;
  items: InboxItem[];
  count: number;
}

// ── StandardTable grouped-rows shape (kanon TRIADA §27, flag
// ff_m03InboxStandardTable) — flattened dedup-group row (representative or
// child). Typed cast target for `row as unknown as InboxStandardRow`, wzór
// `row as unknown as Task` (MyTasksListContent) zamiast `any`. `status`/
// `urgency`/`type`/`section`/`source`/`title`/`received` are the
// group-representative-MIRRORED sort/filter keys (see `inboxStandardRows`
// comment) — cell rendering never reads them, only `__item`.
export interface InboxStandardRow extends StandardTableRow {
  __item: InboxItem;
  __groupKey: string;
  __groupCount: number;
  __isGroupHeader: boolean;
  __groupExpanded: boolean;
  __visibleIndex: number;
  status: string;
  urgency: InboxUrgency;
  type: InboxItemType;
  section: InboxSection;
  source: string;
  title: string;
  received: string;
}

export const groupItems = (items: InboxItem[]): InboxGroup[] => {
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

// ── Flatten dedup-groups into StandardTable rows (kanon TRIADA §27, flag
// ff_m03InboxStandardTable) — pure, exported for unit testing (see
// tests/inboxStandardTableGrouping.test.ts). Each group becomes a
// representative row + (when `isExpanded`) its child rows, all independent
// `InboxStandardRow`s. `status`/`urgency`/`type`/`section`/`source`/`title`/
// `received` are MIRRORED from the group's representative onto EVERY row of
// the group (parent + children): StandardTable/FilterableTable's native
// per-column sort/filter operate directly on this flat array, and would
// otherwise split a group apart (e.g. sorting by "Received" could scatter
// children away from their parent). Because every row in a group carries the
// SAME sort/filter key, and `Array.prototype.sort` is spec-stable (rows with
// equal keys keep their original relative order), the child rows stay glued
// immediately after their representative regardless of which column is
// sorted/filtered. Cell rendering never reads these mirrored fields — it
// always reads `__item` (the row's OWN real item) so children still display
// their OWN actual status/urgency/etc, exactly like legacy
// `renderRow(group.items[i], …)`.
export const flattenInboxDisplayGroups = (
  displayGroups: (InboxGroup & { isExpanded: boolean })[]
): InboxStandardRow[] => {
  const rows: InboxStandardRow[] = [];
  let visibleIndex = 0;
  for (const group of displayGroups) {
    const rep = group.representative;
    const mirrored = {
      status: rep.itemStatus || (rep.triaged ? 'done' : 'open'),
      urgency: rep.urgency,
      type: rep.type,
      section: rep.section,
      source: rep.source?.type || 'system',
      title: rep.title,
      received: rep.receivedAt,
    };
    rows.push({
      id: rep.id,
      __item: rep,
      __groupKey: group.key,
      __groupCount: group.count,
      __isGroupHeader: true,
      __groupExpanded: group.isExpanded,
      __visibleIndex: visibleIndex++,
      ...mirrored,
    } as unknown as InboxStandardRow);
    if (group.count > 1 && group.isExpanded) {
      for (let i = 1; i < group.items.length; i++) {
        rows.push({
          id: group.items[i].id,
          __item: group.items[i],
          __groupKey: group.key,
          __groupCount: group.count,
          __isGroupHeader: false,
          __groupExpanded: group.isExpanded,
          __visibleIndex: visibleIndex++,
          ...mirrored, // MIRRORED to representative — group cohesion, see comment above
        } as unknown as InboxStandardRow);
      }
    }
  }
  return rows;
};

/**
 * ── Urgency config ──
 *
 * N-10 (przegląd 128 zrzutów, 2026-07-27): `Critical` renderował się jako
 * WYPEŁNIONA czerwona pigułka z ramką — kanon A4 zabrania („kropka + tonowany
 * TEKST, nie pigułka"), a tabela Tasks w tym samym module robiła to poprawnie.
 * `pill` niesie teraz kropkę + tonowany tekst, w skali wspólnej z
 * `standard/PriorityCell` (ta sama semantyka: kolor tylko na kropce).
 * Ikona zostaje — dokłada rozróżnienie niezależne od koloru (dostępność).
 */
const urgencyConfig: Record<
  InboxUrgency,
  { icon: LucideIcon; pill: string; label: string; heatColor: string }
> = {
  critical: {
    icon: AlertTriangle,
    pill: 'text-danger-700 dark:text-danger-300 [&>svg]:text-danger-500',
    label: i18n.t('myWork.inboxContent.urgency.critical', 'Critical'),
    heatColor: 'border-l-danger-500',
  },
  high: {
    icon: AlertCircle,
    pill: 'text-c-text-secondary [&>svg]:text-amber-500',
    label: i18n.t('myWork.inboxContent.urgency.high', 'High'),
    heatColor: 'border-l-amber-500',
  },
  normal: {
    icon: Clock,
    pill: 'text-c-text-muted [&>svg]:text-slate-400',
    label: i18n.t('myWork.inboxContent.urgency.normal', 'Normal'),
    heatColor: 'border-l-c-border',
  },
  low: {
    icon: Calendar,
    pill: 'text-c-text-muted [&>svg]:text-slate-400',
    label: i18n.t('myWork.inboxContent.urgency.low', 'Low'),
    heatColor: 'border-l-c-border-subtle',
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

// FALA 1 / „surowe identyfikatory w UI" (2026-07-27): kolumna TYPE pokazywała
// surowe, nietłumaczone enumy z małej litery (`assignment`, `review`,
// `system`). Etykiety są teraz tłumaczone i pisane jak nazwy — 1:1 z opcjami
// filtra (`INBOX_TYPE_FILTER_OPTIONS`), żeby filtr i komórka mówiły to samo.
// Klucze i18n czytane leniwie (funkcja), bo `i18n.t` na poziomie modułu
// zamraża język na moment importu.
const INBOX_TYPE_LABEL_KEYS: Record<InboxItemType, { key: string; fallback: string }> = {
  new_assignment: { key: 'myWork.inboxContent.typeFilter.assignment', fallback: 'Assignment' },
  mention: { key: 'myWork.inboxContent.typeFilter.mention', fallback: 'Mention' },
  escalation: { key: 'myWork.inboxContent.typeFilter.escalation', fallback: 'Escalation' },
  review_request: { key: 'myWork.inboxContent.typeFilter.review', fallback: 'Review' },
  decision_request: { key: 'myWork.inboxContent.typeFilter.decision', fallback: 'Decision' },
  ai_suggestion: { key: 'myWork.inboxContent.typeFilter.aiInsight', fallback: 'AI Insight' },
  system_alert: { key: 'myWork.inboxContent.typeFilter.system', fallback: 'System' },
  billing_alert: { key: 'myWork.inboxContent.typeFilter.billing', fallback: 'Billing' },
  project_update: { key: 'myWork.inboxContent.typeFilter.project', fallback: 'Project' },
};

/** Czytelna etykieta typu pozycji Inboxa — nigdy surowy enum. */
const inboxTypeLabel = (type: InboxItemType | string): string => {
  const entry = INBOX_TYPE_LABEL_KEYS[type as InboxItemType];
  if (entry) return i18n.t(entry.key, entry.fallback);
  // Nieznany typ z backendu: zamiast `some_new_kind` pokaż „Some new kind".
  const words = String(type || '').replace(/_/g, ' ');
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : '—';
};

// S1-U3b: cards view — max cards visible per section before "show more (N)".
// 6 = two full rows on xl (3-col grid), one clean row on sm.
const SECTION_CARD_LIMIT = 6;

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
    color: 'text-amber-500',
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
    color: 'text-danger-500',
  },
  {
    id: 'overdue_sla_breach',
    labelEn: 'Overdue / SLA Breach',
    labelPl: 'Po terminie / SLA',
    icon: Clock,
    color: 'text-danger-600',
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
    color: 'text-blue-500',
  },
  {
    id: 'fyi_system',
    labelEn: 'System Notifications',
    labelPl: 'Powiadomienia systemowe',
    icon: Bell,
    color: 'text-c-text-muted',
  },
  {
    id: 'fyi_mentions',
    labelEn: 'Mentions & FYI',
    labelPl: 'Wzmianki i FYI',
    icon: MessageSquare,
    color: 'text-amber-500',
  },
  { id: 'other', labelEn: 'Other', labelPl: 'Inne', icon: Inbox, color: 'text-c-text-secondary' },
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
  if (diffMins < 1) text = i18n.t('myWork.inboxContent.justNow', 'Just now');
  else if (diffMins < 60) text = isPolish ? `${diffMins} min temu` : `${diffMins}m ago`;
  else if (diffHours < 24) text = isPolish ? `${diffHours} godz. temu` : `${diffHours}h ago`;
  else if (diffDays < 7) text = isPolish ? `${diffDays} d temu` : `${diffDays}d ago`;
  else
    text = d.toLocaleDateString(i18n.t('myWork.inboxContent.dToLocaleDateString', 'en-US'), {
      month: 'short',
      day: 'numeric',
    });

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
  hot: 'text-amber-700 dark:text-amber-300',
  critical: 'text-danger-700 dark:text-danger-300',
};

// ── SLA pill ──
const slaPill = (
  sla: InboxItem['sla']
): { label: string; className: string; dot: string; title?: string } => {
  if (!sla) return { label: '-', className: 'text-c-text-secondary', dot: 'bg-slate-400' };
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
  const isOverdue = sla.isBreached || sla.level === 'L2' || sla.level === 'L3';
  const className =
    sla.level === 'none'
      ? 'border border-c-border-subtle bg-c-surface-raised text-c-text-secondary dark:border-transparent'
      : sla.level === 'L1'
        ? 'border border-c-border-subtle bg-c-surface-raised text-c-text-secondary dark:bg-amber-500/15 dark:text-amber-300 dark:border-transparent'
        : 'border border-c-border-subtle bg-c-surface-raised text-c-text-secondary dark:bg-danger-500/15 dark:text-danger-300 dark:border-transparent';
  const dot = sla.level === 'none' ? 'bg-slate-400' : isOverdue ? 'bg-danger-500' : 'bg-amber-500';
  return { label, className, dot, title: sla.dueAt ? `due: ${sla.dueAt}` : undefined };
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
  { value: 'open', label: i18n.t('myWork.inboxContent.statusFilter.open', 'Open') },
  { value: 'done', label: i18n.t('myWork.inboxContent.statusFilter.done', 'Done') },
  { value: 'saved', label: i18n.t('myWork.inboxContent.statusFilter.saved', 'Saved') },
  { value: 'dismissed', label: i18n.t('myWork.inboxContent.statusFilter.dismissed', 'Dismissed') },
];

const INBOX_URGENCY_FILTER_OPTIONS = [
  {
    value: 'critical',
    label: i18n.t('myWork.inboxContent.urgency.critical', 'Critical'),
    color: 'text-danger-500',
  },
  {
    value: 'high',
    label: i18n.t('myWork.inboxContent.urgency.high', 'High'),
    color: 'text-amber-500',
  },
  {
    value: 'normal',
    label: i18n.t('myWork.inboxContent.urgency.normal', 'Normal'),
    color: 'text-c-text-muted',
  },
  {
    value: 'low',
    label: i18n.t('myWork.inboxContent.urgency.low', 'Low'),
    color: 'text-c-text-secondary',
  },
];

const INBOX_TYPE_FILTER_OPTIONS = [
  {
    value: 'new_assignment',
    label: i18n.t('myWork.inboxContent.typeFilter.assignment', 'Assignment'),
  },
  { value: 'mention', label: i18n.t('myWork.inboxContent.typeFilter.mention', 'Mention') },
  { value: 'escalation', label: i18n.t('myWork.inboxContent.typeFilter.escalation', 'Escalation') },
  { value: 'review_request', label: i18n.t('myWork.inboxContent.typeFilter.review', 'Review') },
  {
    value: 'decision_request',
    label: i18n.t('myWork.inboxContent.typeFilter.decision', 'Decision'),
  },
  {
    value: 'ai_suggestion',
    label: i18n.t('myWork.inboxContent.typeFilter.aiInsight', 'AI Insight'),
  },
  { value: 'system_alert', label: i18n.t('myWork.inboxContent.typeFilter.system', 'System') },
  { value: 'billing_alert', label: i18n.t('myWork.inboxContent.typeFilter.billing', 'Billing') },
  { value: 'project_update', label: i18n.t('myWork.inboxContent.typeFilter.project', 'Project') },
];

const INBOX_SECTION_FILTER_OPTIONS = [
  {
    value: 'decisions_required',
    label: i18n.t('myWork.inboxContent.sectionFilter.decisionsRequired', 'Decisions required'),
  },
  {
    value: 'approvals_gates',
    label: i18n.t('myWork.inboxContent.sectionFilter.approvalsGates', 'Approvals & gates'),
  },
  {
    value: 'assigned_tasks',
    label: i18n.t('myWork.inboxContent.sectionFilter.assignedTasks', 'Assigned tasks'),
  },
  {
    value: 'blocked_escalations',
    label: i18n.t('myWork.inboxContent.sectionFilter.blockedEscalations', 'Blocked / escalations'),
  },
  {
    value: 'overdue_sla_breach',
    label: i18n.t('myWork.inboxContent.sectionFilter.overdueSlaBreach', 'Overdue / SLA breach'),
  },
  {
    value: 'fyi_system',
    label: i18n.t('myWork.inboxContent.sectionFilter.systemNotifications', 'System notifications'),
  },
  {
    value: 'fyi_mentions',
    label: i18n.t('myWork.inboxContent.sectionFilter.mentionsFyi', 'Mentions & FYI'),
  },
  {
    value: 'ai_insights',
    label: i18n.t('myWork.inboxContent.sectionFilter.aiInsights', 'AI Insights'),
  },
  { value: 'other', label: i18n.t('myWork.inboxContent.sectionFilter.other', 'Other') },
];

// N13: Source / Creator filter
const INBOX_SOURCE_FILTER_OPTIONS = [
  { value: 'system', label: i18n.t('myWork.inboxContent.sourceFilter.system', 'System') },
  { value: 'ai', label: i18n.t('myWork.inboxContent.sourceFilter.ai', 'AI') },
  { value: 'user', label: i18n.t('myWork.inboxContent.sourceFilter.userTeam', 'User / Team') },
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
  {
    id: 'title',
    label: i18n.t('myWork.inboxContent.columns.title', 'Title'),
    width: 560,
    minWidth: 360,
    maxWidth: 900,
    resizable: true,
    filterable: false,
  },
  {
    id: 'status',
    label: i18n.t('myWork.inboxContent.columns.status', 'Status'),
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
    label: i18n.t('myWork.inboxContent.columns.urgency', 'Urgency'),
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
    label: i18n.t('myWork.inboxContent.columns.type', 'Type'),
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
    label: i18n.t('myWork.inboxContent.columns.section', 'Section'),
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
    label: i18n.t('myWork.inboxContent.columns.source', 'Source'),
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
    label: i18n.t('myWork.inboxContent.columns.received', 'Received'),
    width: 120,
    minWidth: 90,
    maxWidth: 160,
    resizable: true,
    filterable: false,
  },
  {
    id: 'sla',
    label: i18n.t('myWork.inboxContent.columns.sla', 'SLA'),
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

type InboxResizableColumn =
  | 'title'
  | 'status'
  | 'urgency'
  | 'type'
  | 'section'
  | 'source'
  | 'received'
  | 'sla';

// Per-column sort (canon §5/§27.O) — sortable fields + deterministic ordinals.
type InboxSortField = 'title' | 'status' | 'urgency' | 'type' | 'section' | 'source' | 'received';

const INBOX_URGENCY_ORDER: Record<InboxUrgency, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

const INBOX_STATUS_ORDER: Record<string, number> = {
  open: 0,
  saved: 1,
  snoozed: 2,
  done: 3,
  dismissed: 4,
};

function compareInboxItems(a: InboxItem, b: InboxItem, field: InboxSortField): number {
  switch (field) {
    case 'title':
      return (a.title || '').localeCompare(b.title || '');
    case 'status':
      return (INBOX_STATUS_ORDER[a.itemStatus] ?? 99) - (INBOX_STATUS_ORDER[b.itemStatus] ?? 99);
    case 'urgency':
      return INBOX_URGENCY_ORDER[a.urgency] - INBOX_URGENCY_ORDER[b.urgency];
    case 'type':
      return (a.type || '').localeCompare(b.type || '');
    case 'section':
      return (a.section || '').localeCompare(b.section || '');
    case 'source':
      return (a.source?.type || '').localeCompare(b.source?.type || '');
    case 'received':
      return new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime();
    default:
      return 0;
  }
}

const InboxSortIcon: React.FC<{
  field: InboxSortField;
  sortConfig: { field: InboxSortField; direction: 'asc' | 'desc' } | null;
}> = ({ field, sortConfig }) => {
  if (sortConfig?.field !== field)
    return <ChevronsUpDown size={12} className="text-slate-300 dark:text-slate-600" />;
  return sortConfig.direction === 'asc' ? (
    <ChevronUp size={12} className="text-c-text-secondary" />
  ) : (
    <ChevronDown size={12} className="text-c-text-secondary" />
  );
};

const INBOX_RESIZE_BOUNDS: Record<InboxResizableColumn, { min: number; max: number }> = {
  title: { min: 360, max: 900 },
  status: { min: 80, max: 140 },
  urgency: { min: 80, max: 150 },
  type: { min: 90, max: 160 },
  section: { min: 110, max: 220 },
  source: { min: 90, max: 170 },
  received: { min: 90, max: 160 },
  sla: { min: 70, max: 140 },
};

const getDefaultColumnWidths = (): ColumnWidths =>
  INBOX_COLUMNS.reduce((acc, col) => ({ ...acc, [col.id]: col.width }), {});

const INBOX_TABLE_VIEW_STORAGE_KEY = 'consultify-inbox-table-view';
const INBOX_TABLE_ROW_DESCRIPTION_STORAGE_KEY = 'consultify-inbox-show-row-description';
const INBOX_TABLE_DEFAULT_HIDDEN_COLUMNS = ['type', 'section', 'source'] as const;

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

function loadInboxRowDescriptionSetting(): boolean {
  try {
    const raw = localStorage.getItem(INBOX_TABLE_ROW_DESCRIPTION_STORAGE_KEY);
    return raw === null ? true : raw === 'true';
  } catch {
    return true;
  }
}

function saveInboxRowDescriptionSetting(showDescription: boolean) {
  try {
    localStorage.setItem(INBOX_TABLE_ROW_DESCRIPTION_STORAGE_KEY, String(showDescription));
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
  onOpenTask?: (taskId: string) => void;
  onOpenDecision?: (decisionId: string) => void;
}> = ({
  item,
  isPolish,
  onClose,
  onOpen,
  onTriage,
  onSnooze,
  onSaveAsNote,
  onUndoLastAI,
  onOpenTask,
  onOpenDecision,
}) => {
  const u = urgencyConfig[item.urgency] || urgencyConfig.normal;
  const UIcon = u.icon;
  const sla = slaPill(item.sla);
  const { text: receivedText, agingLevel } = formatRelativeTime(item.receivedAt, isPolish);
  const sectionDef = SMART_SECTIONS.find((s) => s.id === item.section);
  const SectionIcon = sectionDef?.icon || Inbox;
  const entityKind = getEntityKind(item);
  const kindCfg = ENTITY_KIND_CONFIG[entityKind];
  const KindIcon = kindCfg.icon;

  // MW-CORE-003 golden-flow packet: identity/lineage so the user understands
  // why this item appeared. Recipient/organization are resolved to a display
  // name only when the id matches the signed-in session's own user/org
  // (an Inbox item's userId/organizationId are almost always "me, this org"
  // by construction — GET is already scoped that way) — otherwise the raw id
  // is shown, same fallback used for source identifiers elsewhere in this
  // panel (RelationItem.title convention, FALA 1 2026-07-27).
  const { currentUser, currentOrganization } = useAppStore();
  const recipientLabel =
    item.userId && currentUser?.id === item.userId
      ? currentUser.displayName ||
        `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() ||
        currentUser.email ||
        item.userId
      : item.userId;
  const organizationLabel =
    item.organizationId && currentOrganization?.id === item.organizationId
      ? currentOrganization.name || item.organizationId
      : item.organizationId;
  const sourceTaskDeepLink =
    item.sourceEntityType === 'task' && item.linkedTaskId
      ? `/my-work?taskId=${encodeURIComponent(item.linkedTaskId)}`
      : undefined;
  const lineageUpdatedText = item.updatedAt
    ? formatRelativeTime(item.updatedAt, isPolish).text
    : undefined;

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

  const requestInboxAiAssist = useCallback(
    async (payload: {
      language: string;
      item: {
        title: string;
        description?: string;
        type: InboxItemType;
        section: InboxSection;
        urgency: InboxUrgency;
        receivedAt: string;
        dueDate?: string;
        sla?: InboxItem['sla'];
        reason: string;
        linkedTaskId?: string;
        linkedDecisionId?: string;
        source?: { type: 'user' | 'system' | 'ai'; userName?: string };
      };
    }) => {
      return V8MyWorkApi.aiAssistInboxItem(payload)
        .then((res) => res.result)
        .catch(() => Api.post('/my-work/inbox/ai-assist', payload).then((res: any) => res?.result));
    },
    []
  );

  const runAi = useCallback(async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const r = await requestInboxAiAssist({
        language: i18n.t('myWork.inboxContent.language', 'en'),
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
      });
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
      setAiError(e?.message || i18n.t('myWork.inboxContent.aIUnavailable', 'AI unavailable'));
    } finally {
      setAiLoading(false);
    }
  }, [isPolish, item, requestInboxAiAssist]);

  useEffect(() => {
    setAiResult(null);
    setAiError(null);
    setDetailsOverride(null);
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
          toast.success(i18n.t('myWork.inboxContent.toastSuccess', 'Copied'));
        } catch {
          toast.error(i18n.t('myWork.inboxContent.toastError', 'Copy failed'));
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

        const r = await requestInboxAiAssist({
          language: i18n.t('myWork.inboxContent.language2', 'en'),
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
        });
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
        toast.error(i18n.t('myWork.inboxContent.toastError2', 'AI unavailable'));
      } finally {
        setDetailsLoading(false);
      }
    },
    [isPolish, item, descriptionTrimmed, detailsOverride, aiResult, requestInboxAiAssist]
  );

  const metaPills: MetaPill[] = [
    {
      label: isPolish ? kindCfg.labelPl : kindCfg.labelEn,
      className: kindCfg.pill,
      icon: KindIcon,
    },
    { label: u.label, className: u.pill, icon: UIcon },
  ];

  const metaTrailing = (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <span className={`text-[11px] font-medium ${AGING_STYLES[agingLevel]}`}>{receivedText}</span>
      {item.sla && sla.label !== '-' ? (
        <>
          <span className="text-c-text-muted">·</span>
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${sla.className}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${sla.dot}`} />
            SLA {sla.label}
          </span>
        </>
      ) : null}
    </div>
  );

  // FALA 1 / „surowe identyfikatory w UI" (2026-07-27): chipy pokazywały
  // `Task 8ef8640d…` / `Decision 4b23ab49…` — obcięty UUID nic użytkownikowi
  // nie mówi. Teraz czytelna etykieta, a pełny identyfikator wyłącznie
  // w tooltipie (`RelationItem.title`).
  const relationItems: RelationItem[] = [
    ...(item.linkedTaskId
      ? [
          {
            label: i18n.t('myWork.inboxContent.linkedTask', 'Linked task'),
            title: item.linkedTaskId,
            icon: CheckSquare,
            tone: 'text-emerald-600 dark:text-emerald-400',
            onClick: onOpenTask ? () => onOpenTask(item.linkedTaskId!) : undefined,
          } as RelationItem,
        ]
      : []),
    ...(item.linkedDecisionId
      ? [
          {
            label: i18n.t('myWork.inboxContent.linkedDecision', 'Linked decision'),
            title: item.linkedDecisionId,
            icon: Scale,
            tone: 'text-amber-600 dark:text-amber-400',
            onClick: onOpenDecision ? () => onOpenDecision(item.linkedDecisionId!) : undefined,
          } as RelationItem,
        ]
      : []),
  ];

  // S1-U3a + Artifact Anatomy §9.2① — ONE primary action per panel
  // ("Today" = the next-best triage), everything else secondary/neutral.
  // Never a color-per-button rainbow (Today green / Save yellow / Done green…).
  const actionRows: ActionRow[] = [
    {
      buttons: [
        {
          label: i18n.t('myWork.inboxContent.label', 'Today'),
          icon: Zap,
          onClick: () => onTriage('accept_today'),
          colorScheme: 'neutral',
          flex: true,
          shortcut: 'T',
        },
        {
          label: i18n.t('myWork.inboxContent.label2', 'Week'),
          icon: CalendarClock,
          onClick: () => onTriage('accept_week'),
          colorScheme: 'neutral',
          flex: true,
          shortcut: 'W',
        },
        {
          label: i18n.t('myWork.inboxContent.label3', 'Later'),
          icon: Calendar,
          onClick: () => onTriage('accept_later'),
          colorScheme: 'neutral',
          flex: true,
          shortcut: 'L',
        },
      ],
    },
    {
      columns: onSaveAsNote ? 4 : 3,
      buttons: [
        {
          label: i18n.t('myWork.inboxContent.label4', 'Done'),
          icon: CheckCircle2,
          onClick: () => onTriage('done'),
          // 'Zrobione' zamyka sprawe pozytywnie — ten sam skutek co Task.'Zrobione',
          // wiec ten sam wariant (§7.3b). Bylo 'neutral', rozjechane z Task.
          colorScheme: 'emerald',
          shortcut: 'D',
        },
        {
          label: i18n.t('myWork.inboxContent.label5', 'Save'),
          icon: Bookmark,
          onClick: () => onTriage('save'),
          colorScheme: 'neutral',
          shortcut: 'S',
        },
        ...(onSaveAsNote
          ? [
              {
                label: i18n.t('myWork.inboxContent.label6', 'Note'),
                icon: FileText,
                onClick: () => onSaveAsNote(item),
                colorScheme: 'neutral' as const,
                shortcut: 'N',
              },
            ]
          : []),
        {
          label: i18n.t('myWork.inboxContent.label7', 'Dismiss'),
          icon: Archive,
          onClick: () => onTriage('dismiss'),
          colorScheme: 'neutral',
          shortcut: 'X',
        },
      ],
    },
  ];

  const extraCopyFormats: ExtraCopyFormat[] = [
    {
      label: i18n.t('myWork.inboxContent.label8', 'Copy as Markdown'),
      onClick: () =>
        void copyAsMarkdown(
          {
            title: item.title || '',
            description: descriptionTrimmed,
            aiSummary: aiResult?.brief,
          },
          isPolish ? 'pl' : 'en'
        ),
    },
    {
      label: i18n.t('myWork.inboxContent.label9', 'Copy for Slack'),
      onClick: () =>
        void copyForSlack(
          {
            title: item.title || '',
            description: descriptionTrimmed,
            aiSummary: aiResult?.brief,
          },
          isPolish ? 'pl' : 'en'
        ),
    },
  ];

  return (
    <PreviewPaneShell
      kicker={undefined}
      title={item.title || i18n.t('myWork.inboxContent.inboxItem', 'Inbox item')}
      onClose={onClose}
      actions={
        <button
          onClick={onOpen}
          className="inline-flex items-center h-7 px-3 rounded-full text-xs font-medium border border-c-border-subtle bg-c-surface text-c-text-secondary hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
        >
          {i18n.t('myWork.inboxContent.open', 'Open')}
        </button>
      }
      footer={
        // canon §7.3 — footer cards stacked with space-y-2.5, NO dividers between framed cards.
        <div className="space-y-2.5">
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

          {/* ── Linked documents ── */}
          <PreviewRelations items={relationItems} />

          {/* ── Action buttons ── */}
          <PreviewActionBar rows={actionRows} />

          <div className="pt-1.5">
            <button
              onClick={() => setSnoozeOpen(!snoozeOpen)}
              className="inline-flex items-center gap-1 text-xs font-medium text-c-text-muted hover:text-c-text-secondary transition-colors"
            >
              <Clock size={14} />
              {i18n.t('myWork.inboxContent.snooze', 'Snooze…')}
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
            <div className="pt-2 border-t border-c-border-subtle">
              <button
                onClick={onUndoLastAI}
                className="inline-flex items-center gap-1 text-xs font-medium text-c-text-muted hover:text-c-text transition-colors"
              >
                <Minus size={12} />
                {i18n.t('myWork.inboxContent.undoLastAISuggestion', 'Undo last AI suggestion')}
              </button>
            </div>
          ) : null}
        </div>
      }
    >
      <div className="space-y-4">
        <PreviewMetaCard pills={metaPills} trailing={metaTrailing}>
          {/* MW-CORE-003 golden-flow packet: identity/lineage — why this item
              appeared and where it came from. Source/recipient/org/updated
              are always derivable; sourceStatus/initiativeId render ONLY
              when present (no placeholder dash — most notification-sourced
              items legitimately have neither). */}
          <div className="mt-2.5 pt-2.5 border-t border-slate-200/60 dark:border-white/[0.06] grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            <div className="col-span-2 flex items-center gap-1.5">
              <KindIcon size={12} className="text-slate-400 dark:text-slate-500 shrink-0" />
              <span className="text-slate-500 dark:text-slate-400">
                {i18n.t('myWork.inboxContent.lineageSource', 'Source')}:
              </span>
              <span className="text-slate-700 dark:text-slate-300 font-medium">
                {isPolish ? kindCfg.labelPl : kindCfg.labelEn}
              </span>
            </div>

            {item.linkedTaskId ? (
              <div className="col-span-2 flex items-center gap-1.5 min-w-0">
                <span className="text-slate-500 dark:text-slate-400 shrink-0">
                  {i18n.t('myWork.inboxContent.lineageSourceTask', 'Source task')}:
                </span>
                {sourceTaskDeepLink ? (
                  <a
                    href={sourceTaskDeepLink}
                    onClick={(e) => {
                      if (onOpenTask) {
                        e.preventDefault();
                        onOpenTask(item.linkedTaskId!);
                      }
                    }}
                    className="text-c-info hover:underline truncate"
                    title={item.linkedTaskId}
                  >
                    {item.linkedTaskId.slice(0, 8)}…
                  </a>
                ) : (
                  <span className="text-slate-700 dark:text-slate-300 truncate">
                    {item.linkedTaskId}
                  </span>
                )}
              </div>
            ) : null}

            {recipientLabel ? (
              <div className="flex items-center gap-1.5 min-w-0">
                <User size={12} className="text-slate-400 dark:text-slate-500 shrink-0" />
                <span className="text-slate-500 dark:text-slate-400 shrink-0">
                  {i18n.t('myWork.inboxContent.lineageRecipient', 'Recipient')}:
                </span>
                <span className="text-slate-700 dark:text-slate-300 truncate">
                  {recipientLabel}
                </span>
              </div>
            ) : null}

            {organizationLabel ? (
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-slate-500 dark:text-slate-400 shrink-0">
                  {i18n.t('myWork.inboxContent.lineageOrganization', 'Organization')}:
                </span>
                <span className="text-slate-700 dark:text-slate-300 truncate">
                  {organizationLabel}
                </span>
              </div>
            ) : null}

            {lineageUpdatedText ? (
              <div className="flex items-center gap-1.5 min-w-0">
                <Clock size={12} className="text-slate-400 dark:text-slate-500 shrink-0" />
                <span className="text-slate-500 dark:text-slate-400 shrink-0">
                  {i18n.t('myWork.inboxContent.lineageUpdated', 'Updated')}:
                </span>
                <span className="text-slate-700 dark:text-slate-300 truncate">
                  {lineageUpdatedText}
                </span>
              </div>
            ) : null}

            {item.sourceStatus ? (
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-slate-500 dark:text-slate-400 shrink-0">
                  {i18n.t('myWork.inboxContent.lineageSourceStatus', 'Source status')}:
                </span>
                <EntityStatusChip status={item.sourceStatus} />
              </div>
            ) : null}

            {item.initiativeId ? (
              <div className="col-span-2 flex items-center gap-1.5 min-w-0">
                <span className="text-slate-500 dark:text-slate-400 shrink-0">
                  {i18n.t('myWork.inboxContent.lineageInitiative', 'Initiative')}:
                </span>
                <span className="text-slate-700 dark:text-slate-300 truncate">
                  {item.initiativeId}
                </span>
              </div>
            ) : null}
          </div>
        </PreviewMetaCard>

        <PreviewDetailsSection
          text={detailsDisplayText}
          loading={detailsLoading || aiLoading}
          onExpand={() => handleDetailsAction('expand')}
          onSummarize={() => handleDetailsAction('summarize')}
          onCopy={() => handleDetailsAction('copy')}
          extraCopyFormats={extraCopyFormats}
        />
      </div>
    </PreviewPaneShell>
  );
};

const AI_HINT_CHIPCLASS =
  'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] font-medium border border-c-border-subtle bg-transparent text-c-text-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors cursor-pointer active:scale-[0.98]';

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
        <div className="flex items-center gap-1.5 text-c-text-muted">
          <Sparkles size={12} />
          <span className="text-[10px] font-medium uppercase tracking-wider">AI</span>
        </div>

        <div className="relative flex items-center gap-1">
          {result ? (
            <button
              onClick={() => onApplyAction(result.recommendedAction)}
              className="inline-flex items-center gap-1 h-6 px-2 rounded-full text-[11px] font-medium border border-green-300/40 dark:border-green-500/30 bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-200 hover:bg-green-100/70 dark:hover:bg-green-500/15 transition-colors"
            >
              <Check size={11} />
              {actionLabel(result.recommendedAction)}
            </button>
          ) : null}
          {/* canon §17 — portalowane menu SSOT (nie clipowane przez stopkę preview) */}
          <RowActionsMenu
            iconVariant="vertical"
            size="sm"
            sections={[
              {
                id: 'ai-actions',
                kind: 'manage',
                actions: [
                  {
                    id: 'regenerate',
                    label: i18n.t('myWork.inboxContent.label10', 'Regenerate'),
                    icon: Sparkles,
                    onClick: () => onRun(),
                  },
                  {
                    id: 'copy',
                    label: i18n.t('myWork.inboxContent.label11', 'Copy'),
                    icon: Copy,
                    disabled: !result,
                    onClick: () => {
                      if (result) {
                        navigator.clipboard
                          .writeText(
                            [result.brief, ...(result.bullets || []).map((b) => `- ${b}`)].join(
                              '\n'
                            )
                          )
                          .then(() =>
                            toast.success(i18n.t('myWork.inboxContent.toastSuccess2', 'Copied'))
                          );
                      }
                    },
                  },
                  {
                    id: 'clear',
                    label: i18n.t('myWork.inboxContent.label12', 'Clear'),
                    icon: X,
                    disabled: !result,
                    onClick: () => onClear(),
                  },
                ],
              },
            ]}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {hints.map((hint, idx) => (
          <button key={idx} onClick={onRun} disabled={loading} className={AI_HINT_CHIPCLASS}>
            <Sparkles size={10} className="text-c-ai/80" />
            {hint}
          </button>
        ))}
      </div>
    </div>
  );
};

// ── StandardTable kebab (kanon TRIADA §27, flag ff_m03InboxStandardTable) ──
// Plain function (not a hook) — StandardTable calls `rowActions(row)` directly,
// same pattern as `buildTaskKebabSections` (MyTasksListContent) /
// `buildDecisionKebabSections` (DecisionsPanelContent). Sections 1:1 z legacy
// `renderRow`'s inline kebab (context actions / fixed manifest — Open preview·
// Edit·Archive / danger — Reject); legacy `renderRow` keeps its OWN inline
// copy untouched (this is a parallel extraction for the new render path, not
// a refactor of the default one — zero risk to the legacy render).
interface InboxRowHandlers {
  onOpen: (item: InboxItem) => void;
  onOpenPreview: (item: InboxItem) => void;
  onTriage: (item: InboxItem, action: TriageAction) => void;
  onApplyAiSuggestion: (item: InboxItem) => void;
  onSaveAsNote: (item: InboxItem) => void;
  onSnooze: (item: InboxItem, preset: SnoozePreset) => void;
}

const buildInboxKebabSections = (
  item: InboxItem,
  h: InboxRowHandlers,
  t: (key: string, defaultValue: string) => string,
  isPolish: boolean
): RowActionSection[] => {
  const contextActions: RowAction[] = [
    {
      id: 'open',
      label: t('myWork.inboxContent.label17', 'Open'),
      icon: Eye,
      variant: 'primary',
      onClick: () => h.onOpen(item),
    },
    ...(item.suggestedAction && !item.triaged
      ? [
          {
            id: 'apply-ai',
            label: isPolish
              ? `Zastosuj AI (${item.suggestedAction})`
              : `Apply AI (${item.suggestedAction})`,
            icon: Sparkles,
            onClick: () => h.onApplyAiSuggestion(item),
          } as RowAction,
        ]
      : []),
    {
      id: 'focus-today',
      label: t('myWork.inboxContent.label18', 'Focus → Today'),
      icon: Zap,
      onClick: () => h.onTriage(item, 'accept_today'),
    },
    {
      id: 'focus-week',
      label: t('myWork.inboxContent.label19', 'Focus → This week'),
      icon: CalendarClock,
      onClick: () => h.onTriage(item, 'accept_week'),
    },
    {
      id: 'focus-later',
      label: t('myWork.inboxContent.label20', 'Focus → Later'),
      icon: Calendar,
      onClick: () => h.onTriage(item, 'accept_later'),
    },
    {
      id: 'done',
      label: t('myWork.inboxContent.label21', 'Done'),
      icon: CheckCircle2,
      divider: true,
      onClick: () => h.onTriage(item, 'done'),
    },
    {
      id: 'save',
      label: t('myWork.inboxContent.label22', 'Save'),
      icon: Bookmark,
      onClick: () => h.onTriage(item, 'save'),
    },
    {
      id: 'save-note',
      label: t('myWork.inboxContent.label23', 'Save as note'),
      icon: FileText,
      onClick: () => h.onSaveAsNote(item),
    },
    ...SNOOZE_PRESETS.map(
      (p, idx) =>
        ({
          id: `snooze-${p.id}`,
          label: `${t('myWork.inboxContent.snooze2', 'Snooze')}: ${isPolish ? p.labelPl : p.labelEn}`,
          icon: Clock,
          divider: idx === 0,
          onClick: () => h.onSnooze(item, p.id),
        }) as RowAction
    ),
  ];

  return [
    { id: 'context', kind: 'context', actions: contextActions },
    {
      id: 'fixed',
      kind: 'manage',
      actions: [
        {
          id: 'open-preview',
          label: t('myWork.inboxContent.label13', 'Open preview'),
          icon: ChevronRight,
          divider: true,
          onClick: () => h.onOpenPreview(item),
        },
        {
          id: 'edit',
          label: t('myWork.inboxContent.label14', 'Edit'),
          icon: Edit2,
          disabled: true,
          description: t('myWork.inboxContent.description', 'Coming soon (backend)'),
          onClick: () => {},
        },
        {
          // Archive = soft-delete (reversible); maps to existing "dismiss" triage.
          id: 'archive',
          label: t('myWork.inboxContent.label15', 'Archive'),
          icon: Archive,
          onClick: () => h.onTriage(item, 'dismiss'),
        },
      ],
    },
    {
      id: 'danger',
      kind: 'danger',
      actions: [
        {
          id: 'reject',
          label: t('myWork.inboxContent.label24', 'Reject'),
          icon: X,
          variant: 'danger',
          onClick: () => h.onTriage(item, 'reject'),
        },
      ],
    },
  ];
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
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');
  const { emitMyWorkEvent } = useAppStore();

  const [data, setData] = useState<InboxResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uncontrolledViewMode, setUncontrolledViewMode] = useState<InboxViewMode>('flat');
  const viewMode = controlledViewMode ?? uncontrolledViewMode;
  const setViewMode = useCallback(
    (next: InboxViewMode) => {
      onViewModeChange?.(next);
      if (!controlledViewMode) setUncontrolledViewMode(next);
    },
    [controlledViewMode, onViewModeChange]
  );
  // kanon TRIADA §27 (flag ff_m03InboxStandardTable, default OFF) — flat mode
  // renders StandardTable grouped-rows instead of the bespoke table markup
  // below (renderFlatView, untouched as the default render). `sections` view
  // is never affected by this flag.
  const useInboxStandardTable = isM03InboxStandardTableEnabled();
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
  const [columnWidths, setColumnWidths] = usePersistedColumnWidths(
    'mywork:inbox:column-widths',
    getDefaultColumnWidths
  ); // M03 L-10

  // View settings (Columns) — persisted via TableSettingsPopover (canon §16)
  const [hiddenColumns, setHiddenColumns] = useState<string[]>(loadInboxHiddenColumns);
  const [showRowDescription, setShowRowDescription] = useState(loadInboxRowDescriptionSetting);
  const hiddenSet = useMemo(() => new Set(hiddenColumns), [hiddenColumns]);
  const isColumnVisible = useCallback((columnId: string) => !hiddenSet.has(columnId), [hiddenSet]);

  const visibleResizableColumns = useMemo((): InboxResizableColumn[] => {
    return INBOX_COLUMNS.filter(
      (column): column is ColumnDef & { id: InboxResizableColumn } =>
        column.id in INBOX_RESIZE_BOUNDS && isColumnVisible(column.id)
    ).map((column) => column.id);
  }, [isColumnVisible]);

  const tableMinWidth = useMemo(() => {
    const visibleWidth = INBOX_COLUMNS.reduce((sum, column) => {
      if (column.id !== 'select' && column.id !== 'actions' && hiddenSet.has(column.id)) return sum;
      return sum + (columnWidths[column.id] || column.width);
    }, 0);

    return Math.max(1080, visibleWidth);
  }, [columnWidths, hiddenSet]);

  useEffect(() => {
    saveInboxHiddenColumns(hiddenColumns);
  }, [hiddenColumns]);

  const updateRowDescriptionSetting = useCallback((next: boolean) => {
    setShowRowDescription(next);
    saveInboxRowDescriptionSetting(next);
  }, []);

  // Per-column sort (canon §5/§27.O) — client-side, flat view.
  const [sortConfig, setSortConfig] = useState<{
    field: InboxSortField;
    direction: 'asc' | 'desc';
  } | null>(null);

  const handleSort = useCallback((field: InboxSortField) => {
    setSortConfig((prev) => {
      if (prev?.field !== field) return { field, direction: 'asc' };
      if (prev.direction === 'asc') return { field, direction: 'desc' };
      return null; // asc → desc → none
    });
  }, []);

  // Filters
  const [tableFilters, setTableFilters] = useState<TableFilters>({});
  const [openFilterId, setOpenFilterId] = useState<string | null>(null);

  // Snooze
  const [snoozeOpenForId, setSnoozeOpenForId] = useState<string | null>(null);
  const [snoozedKeys, setSnoozedKeys] = useState<Set<string>>(new Set());

  // Expanded groups (for deduplication)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const toggleGroupExpanded = useCallback((key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // Collapsed sections (for smart sections view)
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // S1-U3b: sections view is capped per section ("wall of 152 cards" fix) —
  // sections show up to SECTION_CARD_LIMIT cards + a "show more (N)" control.
  const [uncappedSections, setUncappedSections] = useState<Set<string>>(new Set());

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

  // ── Fetch ──
  const fetchInbox = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const status =
        statusTab === 'all'
          ? 'all'
          : statusTab === 'done'
            ? 'done'
            : statusTab === 'saved'
              ? 'saved'
              : 'open';
      const v8Status = mapInboxStatusToV8(statusTab);
      const [res] = await Promise.all([
        (async () => {
          try {
            const [tableRes, statsRes] = await Promise.all([
              V8MyWorkApi.getCanonicalInboxTable({ status: v8Status, limit: 200 }),
              V8MyWorkApi.getCanonicalInboxStats().catch(() => null),
            ]);
            return buildInboxResponseFromCanonical(tableRes.items, statsRes);
          } catch (error) {
            if (!Api.shouldFallbackToLegacyMyWorkInbox(error)) {
              throw error;
            }
            return Api.inboxGetTable({ status, limit: 200 }).catch(() =>
              Api.get(`/my-work/inbox?limit=200&status=${status}`)
            ) as Promise<InboxResponse>;
          }
        })(),
        (async () => {
          try {
            return await V8MyWorkApi.materializeCanonicalInbox();
          } catch (error) {
            if (!Api.shouldFallbackToLegacyMyWorkInbox(error)) {
              return null;
            }
            return Api.materializeInbox().catch(() => null);
          }
        })(),
      ]);
      setData(res);
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
      setLoadError(t('myWork.inboxContent.setLoadError', 'Failed to load Inbox'));
      toast.error(t('myWork.inboxContent.toastError3', 'Failed to load Inbox'));
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

    // Per-column sort (canon §5/§27.O) — applied only when a column is active.
    if (sortConfig) {
      const dir = sortConfig.direction === 'asc' ? 1 : -1;
      result = [...result].sort((a, b) => compareInboxItems(a, b, sortConfig.field) * dir);
    }

    return result;
  }, [items, tableFilters, actionRequiredOnly, aiOnly, criticalOnly, overdueOnly, sortConfig]);

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

  // ── StandardTable rows (kanon TRIADA §27, flag ff_m03InboxStandardTable) ──
  // Delegates to the pure, unit-tested `flattenInboxDisplayGroups` (see its
  // doc comment above for the group-cohesion/mirroring rationale, and
  // tests/inboxStandardTableGrouping.test.ts for the regression coverage).
  const inboxStandardRows = useMemo<StandardTableRow[]>(() => {
    if (!useInboxStandardTable) return [];
    return flattenInboxDisplayGroups(displayItems);
  }, [displayItems, useInboxStandardTable]);

  // CB-04/RV-029 — SEMANTIC duplicate warning, distinct from the "×N similar"
  // badge above. That badge groups by `_key` (sourceEntityType:sourceEntityId)
  // — the SAME underlying record surfaced through multiple channels. It does
  // NOT catch two genuinely DIFFERENT records that just happen to share a
  // title/section/source (e.g. "Submit Compliance Documentation" filed
  // twice) — exactly the RV-029 repro. Computed over group-header rows only
  // (children of an existing exact-entity group aren't separate business
  // records, so they're excluded to avoid double-flagging).
  const inboxSemanticDuplicateGroups = useMemo(() => {
    const headerRows = inboxStandardRows.filter(
      (r) => (r as unknown as InboxStandardRow).__isGroupHeader
    ) as unknown as InboxStandardRow[];
    return computeDuplicateGroups(
      headerRows.map((r) => ({
        id: r.__groupKey,
        identityKey: buildDuplicateIdentityKey(r.title, r.section, r.source),
      }))
    );
  }, [inboxStandardRows]);

  // ── StandardTable columns (kanon TRIADA §27) — cell markup 1:1 z legacy
  // `renderRow` (title/status/urgency/type/section/source/received/sla).
  // `row as unknown as InboxStandardRow` at each render/sortAccessor boundary
  // — wzór `row as unknown as Task` (MyTasksListContent) zamiast `any`.
  const inboxStandardColumns = useMemo<StandardTableColumn[]>(() => {
    if (!useInboxStandardTable) return [];
    return [
      {
        id: 'title',
        label: t('myWork.inboxContent.columns.title', 'Title'),
        width: '380px',
        sortable: true,
        render: (row: StandardTableRow) => {
          const r = row as unknown as InboxStandardRow;
          const item = r.__item;
          const showDupeCount = r.__isGroupHeader && r.__groupCount > 1;
          return (
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-semibold text-c-text truncate" title={item.title}>
                {item.title}
              </span>
              {item.suggestedAction && (
                <span
                  className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border border-c-border-subtle bg-c-surface-raised text-[10px] font-medium text-c-text-secondary cursor-help"
                  title={
                    item.suggestedReason || t('myWork.inboxContent.aISuggestion', 'AI suggestion')
                  }
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
                    toggleGroupExpanded(r.__groupKey);
                  }}
                  className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-c-surface-raised text-[10px] font-semibold text-c-text-secondary hover:bg-c-border-subtle transition-colors"
                  title={isPolish ? `${r.__groupCount} podobnych` : `${r.__groupCount} similar`}
                >
                  <Layers size={10} />x{r.__groupCount}
                  {r.__groupExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                </button>
              )}
              {/* CB-04/RV-029: SEMANTIC duplicate — a different underlying
                  record (different sourceEntityId, so the ×N badge above
                  never catches it) with the same title/section/source.
                  Never hides/merges rows — only warns. */}
              {r.__isGroupHeader &&
                (inboxSemanticDuplicateGroups.counts.get(
                  buildDuplicateIdentityKey(r.title, r.section, r.source)
                ) ?? 1) > 1 && (
                  <span
                    className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border border-amber-400/40 bg-amber-500/10 text-[10px] font-medium text-amber-600 dark:text-amber-300"
                    title={t(
                      'myWork.inboxContent.possibleDuplicateHint',
                      'Another item with the same title, section, and source exists — check it is not a duplicate.'
                    )}
                  >
                    {t('myWork.inboxContent.possibleDuplicate', 'Possible duplicate ({{count}})', {
                      count: inboxSemanticDuplicateGroups.counts.get(
                        buildDuplicateIdentityKey(r.title, r.section, r.source)
                      ),
                    })}
                  </span>
                )}
            </div>
          );
        },
      },
      {
        id: 'status',
        label: t('myWork.inboxContent.columns.status', 'Status'),
        width: '130px',
        sortable: true,
        sortAccessor: (row) =>
          INBOX_STATUS_ORDER[(row as unknown as InboxStandardRow).status] ?? 99,
        filterable: true,
        filterOptions: INBOX_STATUS_FILTER_OPTIONS,
        render: (row: StandardTableRow) => {
          const item = (row as unknown as InboxStandardRow).__item;
          const st = item.itemStatus || (item.triaged ? 'done' : 'open');
          const labels: Record<string, string> = {
            open: t('myWork.inboxContent.open2', 'Open'),
            done: t('myWork.inboxContent.done2', 'Done'),
            saved: t('myWork.inboxContent.saved', 'Saved'),
            snoozed: t('myWork.inboxContent.snoozed', 'Snoozed'),
            dismissed: t('myWork.inboxContent.dismissed', 'Dismissed'),
          };
          return (
            <span className="inline-flex items-center gap-1.5">
              <EntityStatusChip status={st} label={labels[st] || labels.open} />
              {item.isActionable && <Zap size={10} className="text-c-warning" />}
            </span>
          );
        },
      },
      {
        id: 'urgency',
        label: t('myWork.inboxContent.columns.urgency', 'Urgency'),
        width: '120px',
        sortable: true,
        sortAccessor: (row) =>
          INBOX_URGENCY_ORDER[(row as unknown as InboxStandardRow).urgency] ?? 9,
        filterable: true,
        filterOptions: INBOX_URGENCY_FILTER_OPTIONS,
        render: (row: StandardTableRow) => {
          const item = (row as unknown as InboxStandardRow).__item;
          const u = urgencyConfig[item.urgency] || urgencyConfig.normal;
          const UIcon = u.icon;
          return (
            <span
              className={`inline-flex items-center gap-1.5 text-[11px] font-medium whitespace-nowrap ${u.pill}`}
            >
              <UIcon size={11} />
              {u.label}
            </span>
          );
        },
      },
      {
        id: 'type',
        label: t('myWork.inboxContent.columns.type', 'Type'),
        width: '130px',
        sortable: true,
        filterable: true,
        filterOptions: INBOX_TYPE_FILTER_OPTIONS,
        render: (row: StandardTableRow) => {
          const item = (row as unknown as InboxStandardRow).__item;
          return (
            <span className="inline-flex items-center gap-1.5 text-xs text-c-text-secondary">
              <span className="truncate">{inboxTypeLabel(item.type)}</span>
            </span>
          );
        },
      },
      {
        id: 'section',
        label: t('myWork.inboxContent.columns.section', 'Section'),
        width: '170px',
        sortable: true,
        filterable: true,
        filterOptions: INBOX_SECTION_FILTER_OPTIONS,
        render: (row: StandardTableRow) => {
          const item = (row as unknown as InboxStandardRow).__item;
          return (
            <span className="text-xs text-c-text-secondary">
              {SMART_SECTIONS.find((s) => s.id === item.section)?.[
                isPolish ? 'labelPl' : 'labelEn'
              ] || item.section}
            </span>
          );
        },
      },
      {
        id: 'source',
        label: t('myWork.inboxContent.columns.source', 'Source'),
        width: '130px',
        sortable: true,
        filterable: true,
        filterOptions: INBOX_SOURCE_FILTER_OPTIONS,
        render: (row: StandardTableRow) => {
          const item = (row as unknown as InboxStandardRow).__item;
          const src = item.source?.type || 'system';
          const cfg: Record<string, { icon: typeof Bell; color: string; label: string }> = {
            system: {
              icon: Bell,
              color: 'text-c-text-muted',
              label: t('myWork.inboxContent.label16', 'System'),
            },
            ai: { icon: Star, color: 'text-c-ai', label: 'AI' },
            user: {
              icon: MessageSquare,
              color: 'text-c-info',
              label: item.source?.userName || t('myWork.inboxContent.team', 'Team'),
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
        },
      },
      {
        id: 'received',
        label: t('myWork.inboxContent.columns.received', 'Received'),
        width: '130px',
        sortable: true,
        sortAccessor: (row) => new Date((row as unknown as InboxStandardRow).received).getTime(),
        render: (row: StandardTableRow) => {
          const item = (row as unknown as InboxStandardRow).__item;
          const { text: receivedText, agingLevel } = formatRelativeTime(item.receivedAt, isPolish);
          return (
            <span className={`text-xs font-medium whitespace-nowrap ${AGING_STYLES[agingLevel]}`}>
              {receivedText}
            </span>
          );
        },
      },
      {
        id: 'sla',
        label: t('myWork.inboxContent.columns.sla', 'SLA'),
        width: '110px',
        render: (row: StandardTableRow) => {
          const item = (row as unknown as InboxStandardRow).__item;
          const sla = slaPill(item.sla);
          if (sla.label === '-') return <span className="text-c-text-muted">—</span>;
          return (
            <DueChip
              label={sla.label}
              risk={
                item.sla?.isBreached
                  ? 'overdue'
                  : item.sla && item.sla.level !== 'none' && item.sla.level !== 'L1'
                    ? 'soon'
                    : 'none'
              }
              title={sla.title}
            />
          );
        },
      },
    ];
  }, [t, isPolish, useInboxStandardTable, toggleGroupExpanded, inboxSemanticDuplicateGroups]);

  // ── Triage ──
  const triage = useCallback(
    async (
      item: InboxItem,
      action: TriageAction,
      opts?: { fromAISuggestion?: boolean; confidence?: number }
    ) => {
      if (action === 'snooze') return;
      try {
        await V8MyWorkApi.triageCanonicalInboxItem(item.id, {
          action,
          itemKey: item._key,
          ...(opts?.fromAISuggestion && {
            fromAISuggestion: true,
            confidence: opts.confidence ?? item.suggestedConfidence,
          }),
        }).catch(() =>
          Api.post(`/my-work/inbox/${encodeURIComponent(item.id)}/triage`, {
            action,
            itemKey: item._key,
            ...(opts?.fromAISuggestion && {
              fromAISuggestion: true,
              confidence: opts.confidence ?? item.suggestedConfidence,
            }),
          })
        );
        // Optimistic: remove from current view (item moves to different status tab)
        setData((prev) => {
          if (!prev) return prev;
          return { ...prev, items: prev.items.filter((x) => x._key !== item._key) };
        });
        if (previewItem?._key === item._key) setPreviewItem(null);
        const labels: Record<string, string> = {
          accept_today: t('myWork.inboxContent.acceptToday', 'Focus → Today'),
          accept_week: t('myWork.inboxContent.acceptWeek', 'Focus → This week'),
          accept_later: t('myWork.inboxContent.acceptLater', 'Focus → Later'),
          done: t('myWork.inboxContent.done', 'Marked as done'),
          save: t('myWork.inboxContent.save', 'Saved for later'),
          dismiss: t('myWork.inboxContent.dismiss', 'Dismissed'),
          archive: t('myWork.inboxContent.archive', 'Archived'),
          delegate: t('myWork.inboxContent.delegate', 'Delegated'),
          schedule: t('myWork.inboxContent.schedule', 'Scheduled'),
          reject: t('myWork.inboxContent.reject', 'Rejected'),
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
        toast.error(t('myWork.inboxContent.toastError4', 'Failed to triage item'));
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
        toast.success(t('myWork.inboxContent.toastSuccess3', 'Saved as note'));
      } catch (e) {
        console.error('Failed to save inbox item as note', e);
        toast.error(t('myWork.inboxContent.toastError5', 'Failed to save as note'));
      }
    },
    [isPolish]
  );

  // V4-INBX-03: Undo last AI triage
  const handleUndoLastAI = useCallback(async () => {
    try {
      const res = await Api.undoLastAITriage();
      if (res.success) {
        toast.success(t('myWork.inboxContent.toastSuccess4', 'Undo last AI suggestion'));
        fetchInbox();
      } else {
        toast.error(res.message || t('myWork.inboxContent.noAITriageTo', 'No AI triage to undo'));
      }
    } catch (e) {
      toast.error(t('myWork.inboxContent.toastError6', 'Undo failed'));
    }
  }, [isPolish, fetchInbox]);

  // N9: Snooze — persist to backend (source of truth)
  const handleSnooze = useCallback(
    async (item: InboxItem, preset: SnoozePreset) => {
      setSnoozedKeys((prev) => new Set([...prev, item._key]));
      setSnoozeOpenForId(null);
      try {
        await V8MyWorkApi.triageCanonicalInboxItem(item.id, {
          action: 'archive',
          itemKey: item._key,
          params: { snooze: preset },
        }).catch(() =>
          Api.post(`/my-work/inbox/${encodeURIComponent(item.id)}/triage`, {
            action: 'archive',
            itemKey: item._key,
            params: { snooze: preset },
          })
        );
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
      toast.success(t('myWork.inboxContent.toastSuccess5', 'Snoozed'));
    },
    [isPolish, previewItem]
  );

  // ── Bulk triage ──
  const bulkTriage = useCallback(
    async (action: TriageAction) => {
      const selectedItems = filteredItems.filter((i) => selectedIds.has(i.id));
      if (selectedItems.length === 0) return;
      if (action === 'snooze') return;
      try {
        const itemKeys = selectedItems.map((i) => i._key);
        const aiItems = selectedItems
          .filter((item) => item.suggestedAction === action && item.suggestedConfidence != null)
          .map((item) => ({
            itemKey: item._key,
            confidence: item.suggestedConfidence ?? null,
          }));
        await V8MyWorkApi.bulkTriageCanonicalInbox({
          items: selectedItems.map((item) => ({ itemId: item.id, itemKey: item._key })),
          itemKeys,
          action,
          aiItems,
        }).catch(() => Api.post('/my-work/inbox/bulk-triage', { itemKeys, action, aiItems }));
        const removedKeys = new Set(itemKeys);
        setData((prev) => {
          if (!prev) return prev;
          return { ...prev, items: prev.items.filter((x) => !removedKeys.has(x._key)) };
        });
        setSelectedIds(new Set());
        toast.success(
          isPolish
            ? `${selectedItems.length} elementów przetworzonych`
            : `${selectedItems.length} items processed`
        );
      } catch (e) {
        console.error('Bulk triage failed', e);
        toast.error(t('myWork.inboxContent.toastError7', 'Failed to process items'));
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

  // ── Fixed Bottom Manifest (canon §9.2): Otwórz podgląd · Edytuj · Archiwizuj ──
  // Inbox items carry no `due_date`, so the Delay slot (pos. 4) is N/A and omitted.
  const buildBottomManifest = useCallback(
    (item: InboxItem): RowAction[] => [
      {
        id: 'open-preview',
        label: t('myWork.inboxContent.label13', 'Open preview'),
        icon: ChevronRight,
        divider: true,
        onClick: () => setPreviewItem(item),
      },
      {
        id: 'edit',
        label: t('myWork.inboxContent.label14', 'Edit'),
        icon: Edit2,
        disabled: true,
        description: t('myWork.inboxContent.description', 'Coming soon (backend)'),
        onClick: () => {},
      },
      {
        // Archive = soft-delete (reversible). For Inbox this maps to the
        // existing "dismiss" triage (item leaves the active queue, not destroyed).
        id: 'archive',
        label: t('myWork.inboxContent.label15', 'Archive'),
        icon: Archive,
        onClick: () => triage(item, 'dismiss'),
      },
    ],
    [isPolish, triage]
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
    const currentColumn = columnId as InboxResizableColumn;
    const currentBounds = INBOX_RESIZE_BOUNDS[currentColumn];
    if (!currentBounds) {
      setColumnWidths((prev) => ({ ...prev, [columnId]: newWidth }));
      return;
    }

    setColumnWidths((prev) => {
      const currentWidth = prev[currentColumn];
      const nextColumn =
        visibleResizableColumns[visibleResizableColumns.indexOf(currentColumn) + 1];
      const clampedWidth = Math.max(currentBounds.min, Math.min(currentBounds.max, newWidth));

      if (!nextColumn) {
        return { ...prev, [currentColumn]: clampedWidth };
      }

      const nextBounds = INBOX_RESIZE_BOUNDS[nextColumn];
      const nextWidth = prev[nextColumn];
      const requestedDelta = clampedWidth - currentWidth;
      const requestedNextWidth = nextWidth - requestedDelta;
      const clampedNextWidth = Math.max(
        nextBounds.min,
        Math.min(nextBounds.max, requestedNextWidth)
      );
      const appliedDelta = nextWidth - clampedNextWidth;

      return {
        ...prev,
        [currentColumn]: currentWidth + appliedDelta,
        [nextColumn]: clampedNextWidth,
      };
    });
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
            t(
              'myWork.inboxContent.shortcutsJKNav',
              'Shortcuts: J/K nav, T today, W week, E done, B save, A dismiss, X reject, Enter open, Space select'
            ),
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
          group cursor-pointer border-b border-slate-200/60 dark:border-white/[0.03]
          ${isSelected ? SELECTED_ROW_CLASS : ''}
          ${isPreviewed ? PREVIEW_SELECTED_ROW_CLASS : ''}
          ${isFocused && !isPreviewed ? FOCUSED_ROW_CLASS : ''}
          transition-colors duration-150
          hover:bg-slate-50/70 dark:hover:bg-white/[0.03]
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
            className={`h-3.5 w-3.5 rounded-[4px] border flex items-center justify-center transition-all ${
              isSelected
                ? 'bg-c-text border-c-text text-c-surface opacity-100'
                : 'border-c-border-strong bg-white/80 text-transparent opacity-0 hover:border-c-border-strong group-hover:opacity-100 focus:opacity-100 dark:border-white/[0.14] dark:bg-white/[0.035] dark:group-hover:bg-white/[0.08]'
            }`}
          >
            {isSelected && <CheckSquare size={12} />}
          </button>
        </td>

        {/* Title */}
        <td className="px-3 py-3" style={{ width: columnWidths.title }}>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-c-text truncate block" title={item.title}>
              {item.title}
            </span>
            {item.suggestedAction && (
              <span
                className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border border-slate-200/60 dark:border-white/[0.03] bg-c-surface-raised text-[10px] font-medium text-c-text-secondary cursor-help"
                title={
                  item.suggestedReason || t('myWork.inboxContent.aISuggestion', 'AI suggestion')
                }
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
                className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-c-surface-raised text-[10px] font-semibold text-c-text-secondary hover:bg-c-border-subtle transition-colors"
                title={isPolish ? `${groupCount} podobnych` : `${groupCount} similar`}
              >
                <Layers size={10} />x{groupCount}
                {isGroupExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              </button>
            )}
          </div>
          {showRowDescription && (item.description || item.reason) ? (
            <div className="mt-0.5 truncate pr-6 text-[11px] leading-4 text-c-text-muted">
              {item.description || item.reason}
            </div>
          ) : null}
        </td>

        {/* Status */}
        {!hiddenSet.has('status') && (
          <td className="px-3 py-2 text-left" style={{ width: columnWidths.status }}>
            {(() => {
              const st = item.itemStatus || (item.triaged ? 'done' : 'open');
              const labels: Record<string, string> = {
                open: t('myWork.inboxContent.open2', 'Open'),
                done: t('myWork.inboxContent.done2', 'Done'),
                saved: t('myWork.inboxContent.saved', 'Saved'),
                snoozed: t('myWork.inboxContent.snoozed', 'Snoozed'),
                dismissed: t('myWork.inboxContent.dismissed', 'Dismissed'),
              };
              return (
                <span className="inline-flex items-center gap-1.5">
                  {/* EntityStatusChip carries the canonical filled signal shell
                      (info/success/… ) in both light and dark — §5 / SYS-3. */}
                  <EntityStatusChip status={st} label={labels[st] || labels.open} />
                  {item.isActionable && <Zap size={10} className="text-amber-500" />}
                </span>
              );
            })()}
          </td>
        )}

        {/* Urgency */}
        {!hiddenSet.has('urgency') && (
          <td className="px-3 py-2 text-left" style={{ width: columnWidths.urgency }}>
            <span
              className={`inline-flex items-center gap-1.5 text-[11px] font-medium whitespace-nowrap ${u.pill}`}
            >
              <UIcon size={11} />
              {u.label}
            </span>
          </td>
        )}

        {/* Type */}
        {!hiddenSet.has('type') && (
          <td className="px-3 py-2 text-left" style={{ width: columnWidths.type }}>
            <span className="inline-flex items-center gap-1.5 text-xs text-c-text-secondary">
              <span className="truncate">{inboxTypeLabel(item.type)}</span>
            </span>
          </td>
        )}

        {/* Section */}
        {!hiddenSet.has('section') && (
          <td className="px-3 py-2 text-left" style={{ width: columnWidths.section }}>
            <span className="text-xs text-c-text-secondary">
              {SMART_SECTIONS.find((s) => s.id === item.section)?.[
                isPolish ? 'labelPl' : 'labelEn'
              ] || item.section}
            </span>
          </td>
        )}

        {/* Source */}
        {!hiddenSet.has('source') && (
          <td className="px-3 py-2 text-left" style={{ width: columnWidths.source }}>
            {(() => {
              const src = item.source?.type || 'system';
              const cfg: Record<string, { icon: typeof Bell; color: string; label: string }> = {
                system: {
                  icon: Bell,
                  color: 'text-c-text-muted',
                  label: t('myWork.inboxContent.label16', 'System'),
                },
                ai: { icon: Star, color: 'text-c-ai', label: 'AI' },
                user: {
                  icon: MessageSquare,
                  color: 'text-blue-500',
                  label: item.source?.userName || t('myWork.inboxContent.team', 'Team'),
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
          <td className="px-3 py-2 text-left" style={{ width: columnWidths.received }}>
            <span className={`text-xs font-medium whitespace-nowrap ${AGING_STYLES[agingLevel]}`}>
              {receivedText}
            </span>
          </td>
        )}

        {/* SLA / due — single DueChip (canon §4.4) */}
        {!hiddenSet.has('sla') && (
          <td className="px-3 py-2 text-left" style={{ width: columnWidths.sla }}>
            {sla.label === '-' ? (
              <span className="text-c-text-muted">—</span>
            ) : (
              <DueChip
                label={sla.label}
                risk={
                  item.sla?.isBreached
                    ? 'overdue'
                    : item.sla && item.sla.level !== 'none' && item.sla.level !== 'L1'
                      ? 'soon'
                      : 'none'
                }
                title={sla.title}
              />
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
            const contextActions: RowAction[] = [
              {
                id: 'open',
                label: t('myWork.inboxContent.label17', 'Open'),
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
                label: t('myWork.inboxContent.label18', 'Focus → Today'),
                icon: Zap,
                onClick: () => triage(item, 'accept_today'),
              },
              {
                id: 'focus-week',
                label: t('myWork.inboxContent.label19', 'Focus → This week'),
                icon: CalendarClock,
                onClick: () => triage(item, 'accept_week'),
              },
              {
                id: 'focus-later',
                label: t('myWork.inboxContent.label20', 'Focus → Later'),
                icon: Calendar,
                onClick: () => triage(item, 'accept_later'),
              },
              {
                id: 'done',
                label: t('myWork.inboxContent.label21', 'Done'),
                icon: CheckCircle2,
                divider: true,
                onClick: () => triage(item, 'done'),
              },
              {
                id: 'save',
                label: t('myWork.inboxContent.label22', 'Save'),
                icon: Bookmark,
                onClick: () => triage(item, 'save'),
              },
              {
                id: 'save-note',
                label: t('myWork.inboxContent.label23', 'Save as note'),
                icon: FileText,
                onClick: () => handleSaveAsNote(item),
              },
              ...SNOOZE_PRESETS.map((p, idx) => ({
                id: `snooze-${p.id}`,
                label: `${t('myWork.inboxContent.snooze2', 'Snooze')}: ${isPolish ? p.labelPl : p.labelEn}`,
                icon: Clock,
                divider: idx === 0,
                onClick: () => handleSnooze(item, p.id),
              })),
            ];
            const sections: RowActionSection[] = [
              { id: 'context', kind: 'context', actions: contextActions },
              { id: 'fixed', kind: 'manage', actions: buildBottomManifest(item) },
              {
                id: 'danger',
                kind: 'danger',
                actions: [
                  {
                    id: 'reject',
                    label: t('myWork.inboxContent.label24', 'Reject'),
                    icon: X,
                    variant: 'danger',
                    onClick: () => triage(item, 'reject'),
                  },
                ],
              },
            ];
            return (
              <RowActionsMenu
                sections={sections}
                iconVariant="vertical"
                className="opacity-40 transition-opacity group-hover:opacity-100"
              />
            );
          })()}
        </td>
      </tr>
    );
  };

  // ── Render table header ──
  const renderTableHeader = () => (
    <thead>
      <tr className="border-b border-c-border-subtle bg-c-surface sticky top-0 z-10">
        {/* Select All */}
        <th className="w-10 px-2 py-2">
          <button
            onClick={() => handleSelectAll(!allSelected)}
            className={`h-3.5 w-3.5 rounded-[4px] border flex items-center justify-center transition-colors ${
              allSelected
                ? 'bg-c-text border-c-text text-c-surface'
                : someSelected
                  ? 'bg-c-text/60 border-c-text text-c-surface'
                  : 'border-c-border-subtle text-transparent hover:border-c-border-strong hover:text-c-text-muted'
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

        <th
          className="relative px-3 py-2 text-left text-[11px] font-semibold text-c-text-muted uppercase tracking-wider"
          style={{ width: columnWidths.title }}
        >
          <button
            type="button"
            onClick={() => handleSort('title')}
            className="inline-flex items-center gap-1 transition-colors hover:text-c-text-secondary"
          >
            {t('myWork.inboxContent.title', 'Title')}
            <InboxSortIcon field="title" sortConfig={sortConfig} />
          </button>
          <ColumnResizer
            columnId="title"
            currentWidth={columnWidths.title}
            minWidth={INBOX_RESIZE_BOUNDS.title.min}
            maxWidth={INBOX_RESIZE_BOUNDS.title.max}
            onResize={handleColumnResize}
          />
        </th>

        {INBOX_COLUMNS.filter(
          (c) => !['select', 'title', 'actions'].includes(c.id) && !hiddenSet.has(c.id)
        ).map((col) => {
          const colId = col.id;
          const isFilterable = Boolean(col.filterable);
          const hasFilter = isFilterable && col.filterOptions?.length;
          const isResizable = Boolean(col.resizable);
          // Canon §3.3: chip/text columns left-aligned (status/urgency/type/section/source).
          const leftAligned = [
            'status',
            'urgency',
            'type',
            'section',
            'source',
            'received',
          ].includes(colId);
          // Canon §5/§27.O: every column except SLA is sortable (sla has no stable order).
          const isSortable = colId !== 'sla';
          return (
            <th
              key={colId}
              className={`px-3 py-2 ${leftAligned ? 'text-left' : 'text-center'} text-[11px] font-semibold text-c-text-muted uppercase tracking-wider relative group/header`}
              style={{ width: columnWidths[colId] }}
            >
              <div
                className={`flex items-center gap-1 ${leftAligned ? 'justify-start' : 'justify-center'}`}
              >
                {isSortable ? (
                  <button
                    type="button"
                    onClick={() => handleSort(colId as InboxSortField)}
                    className={`inline-flex items-center gap-1 transition-colors hover:text-c-text-secondary ${
                      (tableFilters[colId] as string[])?.length ? 'text-c-text-secondary' : ''
                    }`}
                  >
                    {getColumnLabel(colId)}
                    <InboxSortIcon field={colId as InboxSortField} sortConfig={sortConfig} />
                  </button>
                ) : (
                  <span
                    className={
                      (tableFilters[colId] as string[])?.length ? 'text-c-text-secondary' : ''
                    }
                  >
                    {getColumnLabel(colId)}
                  </span>
                )}
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
          className="relative px-3 py-2 text-right text-[11px] font-semibold text-c-text-muted uppercase tracking-wider"
          style={{ width: columnWidths.actions }}
        >
          <div className="flex items-center justify-end normal-case tracking-normal">
            <TableSettingsPopover
              columns={INBOX_COLUMNS.filter((c) => c.id !== 'select').map(
                (col): TableSettingsColumn => ({
                  id: col.id,
                  label: getColumnLabel(col.id),
                  required: col.id === 'title' || col.id === 'actions',
                  visible:
                    col.id === 'title' || col.id === 'actions' ? true : !hiddenSet.has(col.id),
                })
              )}
              onToggle={(columnId, visible) =>
                setHiddenColumns((prev) => {
                  const set = new Set(prev);
                  if (visible) set.delete(columnId);
                  else set.add(columnId);
                  return Array.from(set);
                })
              }
              showDescription={showRowDescription}
              onToggleDescription={updateRowDescriptionSetting}
              label={t('myWork.inboxContent.label25', 'View settings')}
              columnsHeading={t('myWork.inboxContent.columnsHeading', 'Visible columns')}
              descriptionLabel={t('myWork.inboxContent.descriptionLabel', 'Show row description')}
            />
          </div>
        </th>
      </tr>
    </thead>
  );

  // ── Render smart sections ──
  const renderSectionsView = () => {
    if (!sectionGroups) return null;
    const renderStatusPill = (item: InboxItem) => {
      const st = item.itemStatus || (item.triaged ? 'done' : 'open');
      const labels: Record<string, string> = {
        open: t('myWork.inboxContent.open3', 'Open'),
        done: t('myWork.inboxContent.done3', 'Done'),
        saved: t('myWork.inboxContent.saved2', 'Saved'),
        snoozed: t('myWork.inboxContent.snoozed2', 'Snoozed'),
        dismissed: t('myWork.inboxContent.dismissed2', 'Dismissed'),
      };
      return (
        <span className="inline-flex items-center gap-1.5">
          <EntityStatusChip status={st} label={labels[st] || labels.open} />
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
            'group relative rounded-xl border border-c-border-subtle transition-all duration-150 overflow-hidden',
            'bg-c-surface',
            'hover:shadow-md',
            isSelected ? 'ring-2 ring-c-info/50' : '',
            isPreviewed ? 'ring-2 ring-c-info/40' : '',
          ].join(' ')}
          onClick={() => preview(item)}
          onDoubleClick={() => open(item)}
        >
          <div className="p-2.5 flex flex-col gap-2">
            {/* Row 1: Title + actions */}
            <div className="flex items-start gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectItem(item.id);
                }}
                className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-all shrink-0 ${
                  isSelected
                    ? 'bg-c-text border-c-text text-c-surface'
                    : 'border-c-border-subtle hover:border-c-border-strong'
                }`}
                aria-label={
                  isSelected
                    ? t('myWork.inboxContent.deselect', 'Deselect')
                    : t('myWork.inboxContent.select', 'Select')
                }
              >
                {isSelected && <CheckSquare size={10} />}
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-1.5">
                  <h3
                    className="text-[13px] font-semibold text-c-text leading-snug line-clamp-1"
                    title={item.title}
                  >
                    {item.title}
                  </h3>
                  <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                    {(() => {
                      const contextActions: RowAction[] = [
                        {
                          id: 'open',
                          label: t('myWork.inboxContent.label26', 'Open'),
                          icon: Eye,
                          variant: 'primary',
                          onClick: () => open(item),
                        },
                        {
                          id: 'focus-today',
                          label: t('myWork.inboxContent.label27', 'Focus → Today'),
                          icon: Zap,
                          onClick: () => triage(item, 'accept_today'),
                        },
                        {
                          id: 'focus-week',
                          label: t('myWork.inboxContent.label28', 'Focus → This week'),
                          icon: CalendarClock,
                          onClick: () => triage(item, 'accept_week'),
                        },
                        {
                          id: 'focus-later',
                          label: t('myWork.inboxContent.label29', 'Focus → Later'),
                          icon: Calendar,
                          onClick: () => triage(item, 'accept_later'),
                        },
                        {
                          id: 'done',
                          label: t('myWork.inboxContent.label30', 'Done'),
                          icon: CheckCircle2,
                          divider: true,
                          onClick: () => triage(item, 'done'),
                        },
                        {
                          id: 'save',
                          label: t('myWork.inboxContent.label31', 'Save'),
                          icon: Bookmark,
                          onClick: () => triage(item, 'save'),
                        },
                        ...(handleSaveAsNote
                          ? [
                              {
                                id: 'save-as-note',
                                label: t('myWork.inboxContent.label32', 'Save as note'),
                                icon: FileText,
                                onClick: () => handleSaveAsNote(item),
                                divider: true,
                              } satisfies RowAction,
                            ]
                          : []),
                        ...SNOOZE_PRESETS.map((p, idx) => ({
                          id: `snooze-${p.id}`,
                          label: `${t('myWork.inboxContent.snooze3', 'Snooze')}: ${isPolish ? p.labelPl : p.labelEn}`,
                          icon: Clock,
                          divider: idx === 0 && !handleSaveAsNote,
                          onClick: () => handleSnooze(item, p.id),
                        })),
                      ];
                      const sections: RowActionSection[] = [
                        { id: 'context', kind: 'context', actions: contextActions },
                        { id: 'fixed', kind: 'manage', actions: buildBottomManifest(item) },
                        // canon §9 — strefa danger identyczna jak w wariancie tabelarycznym (parytet kebaba).
                        {
                          id: 'danger',
                          kind: 'danger',
                          actions: [
                            {
                              id: 'reject',
                              label: t('myWork.inboxContent.label33', 'Reject'),
                              icon: X,
                              variant: 'danger',
                              onClick: () => triage(item, 'reject'),
                            },
                          ],
                        },
                      ];
                      return <RowActionsMenu sections={sections} iconVariant="vertical" />;
                    })()}
                  </div>
                </div>
              </div>
            </div>

            {/* Row 2: Brief */}
            {showRowDescription && cardBriefText ? (
              <p className="-mt-0.5 line-clamp-1 text-[11px] leading-4 text-c-text-muted">
                {cardBriefText}
              </p>
            ) : null}

            {/* Row 3: Meta pills (incl. status — no reserved hover row, S1-U3b) */}
            <div className="flex flex-wrap items-center gap-1.5">
              {renderStatusPill(item)}
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${kindCfg.pill}`}
              >
                <KindIcon size={10} />
                {isPolish ? kindCfg.labelPl : kindCfg.labelEn}
              </span>
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-medium whitespace-nowrap ${u.pill}`}
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
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap ${sla.className}`}
                  title={sla.title}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${sla.dot}`} />
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
                  className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-c-surface-raised text-[10px] font-semibold text-c-text-secondary hover:bg-c-border-subtle dark:hover:bg-white/[0.08] transition-colors"
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
                    {t('myWork.inboxContent.decision2', 'Decision')}{' '}
                    {item.linkedDecisionId.slice(0, 8)}…
                  </span>
                ) : null}
              </div>
            ) : null}

            {/* S1-U3b: no reserved hover-actions row — triage lives in the
                kebab + preview panel; status pill moved into the meta row.
                Cards stay compact so sections fit the viewport. */}
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
              <div className="flex items-center justify-between px-2 py-2 rounded-lg bg-c-surface-raised border border-c-border-subtle">
                <button
                  onClick={() =>
                    setCollapsedSections((prev) => {
                      const next = new Set(prev);
                      if (next.has(section.id)) next.delete(section.id);
                      else next.add(section.id);
                      return next;
                    })
                  }
                  className="flex items-center gap-2 text-xs font-semibold text-c-text-secondary hover:text-c-text transition-colors"
                >
                  {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  <SectionIcon size={14} className={section.color} />
                  {isPolish ? section.labelPl : section.labelEn}
                  <span className="px-1.5 py-0.5 rounded-full bg-c-surface-raised text-[10px] font-medium text-c-text-secondary">
                    {totalCount}
                  </span>
                </button>
                <button
                  onClick={() => handleSelectSection(section.id)}
                  className="text-[10px] font-medium text-c-text-muted hover:text-c-text-secondary transition-colors"
                >
                  {t('myWork.inboxContent.selectAll', 'Select all')}
                </button>
              </div>

              {!isCollapsed &&
                (() => {
                  // S1-U3b: flatten groups, then cap the section height —
                  // max SECTION_CARD_LIMIT cards + "show more (N)" instead of
                  // an unbounded vertical wall.
                  const flatCards = sectionData.flatMap((group) => {
                    const itemsToRender =
                      group.count > 1 && expandedGroups.has(group.key)
                        ? group.items
                        : [group.representative];
                    return itemsToRender.map((it, idx) => ({
                      it,
                      groupCount: idx === 0 ? group.count : undefined,
                      groupKey: idx === 0 ? group.key : undefined,
                    }));
                  });
                  const isUncapped = uncappedSections.has(section.id);
                  const visibleCards = isUncapped
                    ? flatCards
                    : flatCards.slice(0, SECTION_CARD_LIMIT);
                  const hiddenCount = flatCards.length - visibleCards.length;
                  const toggleCap = () =>
                    setUncappedSections((prev) => {
                      const next = new Set(prev);
                      if (next.has(section.id)) next.delete(section.id);
                      else next.add(section.id);
                      return next;
                    });

                  return (
                    <>
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                        {visibleCards.map(({ it, groupCount, groupKey }) =>
                          renderCard(it, groupCount, groupKey)
                        )}
                      </div>
                      {hiddenCount > 0 ? (
                        <button
                          type="button"
                          onClick={toggleCap}
                          data-testid={`inbox-section-show-more-${section.id}`}
                          className="mt-2 inline-flex h-7 items-center gap-1.5 rounded-full border border-slate-200/60 dark:border-white/[0.03] px-3 text-[11px] font-medium text-c-text-secondary transition-colors hover:bg-c-surface-raised"
                        >
                          <ChevronDown size={12} />
                          {isPolish
                            ? `Pokaż więcej (${hiddenCount})`
                            : `Show more (${hiddenCount})`}
                        </button>
                      ) : isUncapped && flatCards.length > SECTION_CARD_LIMIT ? (
                        <button
                          type="button"
                          onClick={toggleCap}
                          className="mt-2 inline-flex h-7 items-center gap-1.5 rounded-full border border-slate-200/60 dark:border-white/[0.03] px-3 text-[11px] font-medium text-c-text-secondary transition-colors hover:bg-c-surface-raised"
                        >
                          <ChevronUp size={12} />
                          {t('myWork.inboxContent.showLess', 'Show less')}
                        </button>
                      ) : null}
                    </>
                  );
                })()}
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
      <table
        /* §27-todo: lista encji → migracja do FilterableTable + Menu 1/2/3 (kanon §2); swiadomie oznaczona, nie przepisana w tej sesji */ className="w-full table-fixed"
        style={{ minWidth: tableMinWidth }}
      >
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

  // ── Render flat view — StandardTable grouped-rows (kanon TRIADA §27, flag
  // ff_m03InboxStandardTable, default OFF). Replaces the ENTIRE bespoke table
  // markup above for the flat mode when the flag is ON; `renderFlatView`
  // (legacy, default render) stays untouched. `sections` view is unaffected.
  const renderStandardFlatView = () => (
    <StandardTable
      columns={inboxStandardColumns}
      data={inboxStandardRows}
      onRowClick={(row) => preview((row as unknown as InboxStandardRow).__item)}
      onRowDoubleClick={(row) => open((row as unknown as InboxStandardRow).__item)}
      rowActions={(row) => {
        const item = (row as unknown as InboxStandardRow).__item;
        const handlers: InboxRowHandlers = {
          onOpen: open,
          onOpenPreview: (it) => setPreviewItem(it),
          onTriage: (it, action) => {
            void triage(it, action);
          },
          onApplyAiSuggestion: (it) => {
            if (!it.suggestedAction) return;
            void triage(it, it.suggestedAction, {
              fromAISuggestion: true,
              confidence: it.suggestedConfidence,
            });
          },
          onSaveAsNote: (it) => {
            void handleSaveAsNote(it);
          },
          onSnooze: (it, preset) => {
            void handleSnooze(it, preset);
          },
        };
        return buildInboxKebabSections(item, handlers, t, !!isPolish);
      }}
      rowClassName={(row) => {
        const r = row as unknown as InboxStandardRow;
        const item = r.__item;
        const isSelected = selectedIds.has(item.id);
        const isPreviewed = previewItem?.id === item.id;
        const isFocused = r.__visibleIndex === focusedIndex;
        return [
          isSelected ? SELECTED_ROW_CLASS : '',
          isPreviewed ? PREVIEW_SELECTED_ROW_CLASS : '',
          isFocused && !isPreviewed ? FOCUSED_ROW_CLASS : '',
        ]
          .filter(Boolean)
          .join(' ');
      }}
      rowDescription={(row) => {
        const item = (row as unknown as InboxStandardRow).__item;
        return item.description || item.reason || null;
      }}
      selection={{ selectedIds, onChange: setSelectedIds }}
      persistKey="mywork.inbox.flat"
    />
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-c-bg" ref={tableRef}>
      {/* Main content + Preview pane */}
      <div className="flex-1 flex min-h-0 gap-1.5">
        {/* Table content */}
        <div className="flex-1 min-w-0 overflow-y-auto pl-4 pr-1.5 pt-3 pb-4 transition-all duration-200">
          {loading ? (
            <SharedLoadingState template="list" rows={6} />
          ) : loadError ? (
            <ErrorState message={loadError} retry={() => void fetchInbox()} />
          ) : filteredItems.length === 0 &&
            ((searchQuery || '').trim().length > 0 || actionRequiredOnly) ? (
            <SharedEmptyState
              variant="filter"
              title={t('myWork.inboxContent.title2', 'Nothing matches this filter')}
              description={t(
                'myWork.inboxContent.changeYourSearchOr',
                'Change your search or turn off the “action required” filter to see more.'
              )}
            />
          ) : filteredItems.length === 0 ? (
            <div className="py-16 text-center text-c-text-secondary">
              {statusTab === 'done' ? (
                <>
                  <CheckCircle2 size={40} className="mx-auto mb-4 text-emerald-400" />
                  <p className="text-base font-semibold mb-1">
                    {t('myWork.inboxContent.noCompletedItems', 'No completed items')}
                  </p>
                  <p className="text-sm text-c-text-muted">
                    {t(
                      'myWork.inboxContent.markItemsAsDone',
                      "Mark items as Done (E) and they'll appear here."
                    )}
                  </p>
                </>
              ) : statusTab === 'saved' ? (
                <>
                  <BookmarkCheck size={40} className="mx-auto mb-4 text-amber-400" />
                  <p className="text-base font-semibold mb-1">
                    {t('myWork.inboxContent.noSavedItems', 'No saved items')}
                  </p>
                  <p className="text-sm text-c-text-muted">
                    {t(
                      'myWork.inboxContent.useSaveBTo',
                      'Use Save (B) to bookmark items for later.'
                    )}
                  </p>
                </>
              ) : (
                <>
                  <Inbox size={40} className="mx-auto mb-4 text-c-text-muted" />
                  <p className="text-base font-semibold mb-1">
                    {t('myWork.inboxContent.inboxIsEmptyZero', 'Inbox is empty — zero backlog!')}
                  </p>
                  <p className="text-sm text-c-text-muted">
                    {t(
                      'myWork.inboxContent.everythingProcessedGreatJob',
                      'Everything processed. Great job!'
                    )}
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-xl">
              {viewMode === 'sections'
                ? renderSectionsView()
                : useInboxStandardTable
                  ? renderStandardFlatView()
                  : renderFlatView()}
            </div>
          )}
        </div>

        {/* Preview Pane (A3) */}
        {previewItem && (
          <div className="shrink-0 bg-c-bg p-3" style={{ width: 'clamp(340px, 28%, 480px)' }}>
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
              onOpenTask={onOpenTask}
              onOpenDecision={onOpenDecision}
            />
          </div>
        )}
      </div>
    </div>
  );
};
