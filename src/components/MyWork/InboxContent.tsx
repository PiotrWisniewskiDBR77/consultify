import {
  AlertCircle,
  AlertTriangle,
  Archive,
  Bell,
  Calendar,
  Check,
  CheckCheck,
  CheckSquare,
  Clock,
  Eye,
  Inbox,
  Loader2,
  Minus,
  Scale,
  Square,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

import { RowAction, RowActionsMenu } from '../shared/RowActionsMenu';

type InboxUrgency = 'critical' | 'high' | 'normal' | 'low';
type InboxItemType =
  | 'new_assignment'
  | 'mention'
  | 'escalation'
  | 'review_request'
  | 'decision_request'
  | 'ai_suggestion';

type InboxSection =
  | 'decisions_required'
  | 'approvals_gates'
  | 'assigned_tasks'
  | 'blocked_escalations'
  | 'overdue_sla_breach'
  | 'other';

type SlaLevel = 'none' | 'L1' | 'L2' | 'L3';

type TriageAction = 'accept_today' | 'schedule' | 'delegate' | 'archive' | 'reject';

type InboxItemKey = `task:${string}` | `decision:${string}` | `notification:${string}`;

interface InboxItem {
  id: string;
  type: InboxItemType;
  section: InboxSection;
  title: string;
  description?: string;
  receivedAt: string;
  dueDate?: string;
  urgency: InboxUrgency;
  sla?: {
    dueAt: string;
    remainingMs: number;
    isBreached: boolean;
    level: SlaLevel;
  };
  linkedTaskId?: string;
  linkedDecisionId?: string;
  triaged: boolean;
  _key: InboxItemKey;
}

interface InboxSummary {
  total: number;
  critical: number;
  newToday: number;
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
}

// ── Urgency styles ──
const urgencyStyles: Record<
  InboxUrgency,
  { icon: React.ElementType; pill: string; label: string }
> = {
  critical: {
    icon: AlertTriangle,
    pill: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
    label: 'Critical',
  },
  high: {
    icon: AlertCircle,
    pill: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    label: 'High',
  },
  normal: {
    icon: Clock,
    pill: 'bg-slate-100 text-slate-700 dark:bg-navy-800 dark:text-slate-200',
    label: 'Normal',
  },
  low: {
    icon: Calendar,
    pill: 'bg-slate-50 text-slate-600 dark:bg-navy-900/40 dark:text-slate-300',
    label: 'Low',
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
};

const typeLabel: Record<InboxItemType, string> = {
  new_assignment: 'new assign…',
  mention: 'mention',
  escalation: 'escalation',
  review_request: 'review req…',
  decision_request: 'decision req…',
  ai_suggestion: 'ai suggestion',
};

// ── Status config ──
const statusConfig = (triaged: boolean) =>
  triaged
    ? {
        bg: 'bg-green-100 dark:bg-green-500/15',
        color: 'text-green-700 dark:text-green-300',
        dot: 'bg-green-500',
        label: 'Triaged',
      }
    : {
        bg: 'bg-amber-100 dark:bg-amber-500/15',
        color: 'text-amber-700 dark:text-amber-300',
        dot: 'bg-amber-500',
        label: 'New',
      };

// ── Date helpers ──
const formatReceivedDate = (iso: string): string => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDueDate = (dueDate?: string): string => {
  if (!dueDate) return '-';
  const date = new Date(dueDate);
  if (isNaN(date.getTime())) return dueDate;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateOnly = new Date(date);
  dateOnly.setHours(0, 0, 0, 0);
  if (dateOnly.getTime() === today.getTime()) return 'Today';
  if (dateOnly.getTime() === tomorrow.getTime()) return 'Tomorrow';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const isDueDateOverdue = (dueDate?: string, triaged?: boolean): boolean => {
  if (!dueDate || triaged) return false;
  const date = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
};

const formatSectionLabel = (section: InboxSection, isPolish: boolean): string => {
  switch (section) {
    case 'decisions_required':
      return isPolish ? 'Decyzje' : 'Decisions';
    case 'approvals_gates':
      return isPolish ? 'Akceptacje' : 'Approvals';
    case 'assigned_tasks':
      return isPolish ? 'Zadania' : 'Tasks';
    case 'blocked_escalations':
      return isPolish ? 'Blokady' : 'Blocked';
    case 'overdue_sla_breach':
      return isPolish ? 'Po terminie' : 'Overdue';
    case 'other':
    default:
      return isPolish ? 'Inne' : 'Other';
  }
};

const slaPill = (
  sla: InboxItem['sla'] | undefined
): { label: string; className: string; title?: string } => {
  if (!sla) {
    return { label: '-', className: 'text-slate-300 dark:text-slate-600' };
  }
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

  return {
    label,
    className,
    title: sla.dueAt ? `due: ${sla.dueAt}` : undefined,
  };
};

// ── Filter option sets ──
const INBOX_STATUS_FILTER_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'triaged', label: 'Triaged' },
];

const INBOX_URGENCY_FILTER_OPTIONS = [
  { value: 'critical', label: 'Critical', color: 'text-red-500' },
  { value: 'high', label: 'High', color: 'text-amber-500' },
  { value: 'normal', label: 'Normal', color: 'text-slate-500' },
  { value: 'low', label: 'Low', color: 'text-slate-400' },
];

const INBOX_TYPE_FILTER_OPTIONS = [
  { value: 'new_assignment', label: 'New assignment' },
  { value: 'mention', label: 'Mention' },
  { value: 'escalation', label: 'Escalation' },
  { value: 'review_request', label: 'Review request' },
  { value: 'decision_request', label: 'Decision request' },
  { value: 'ai_suggestion', label: 'AI suggestion' },
];

const INBOX_SECTION_FILTER_OPTIONS = [
  { value: 'decisions_required', label: 'Decisions required' },
  { value: 'approvals_gates', label: 'Approvals & gates' },
  { value: 'assigned_tasks', label: 'Assigned tasks' },
  { value: 'blocked_escalations', label: 'Blocked / escalations' },
  { value: 'overdue_sla_breach', label: 'Overdue / SLA breach' },
  { value: 'other', label: 'Other' },
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
    label: 'Title',
    width: 999, // flex – stretches
    minWidth: 300,
    resizable: false,
    filterable: false,
  },
  {
    id: 'status',
    label: 'Status',
    width: 110,
    minWidth: 90,
    maxWidth: 160,
    resizable: true,
    filterable: true,
    filterType: 'multiselect',
    filterOptions: INBOX_STATUS_FILTER_OPTIONS,
  },
  {
    id: 'urgency',
    label: 'Urgency',
    width: 120,
    minWidth: 90,
    maxWidth: 170,
    resizable: true,
    filterable: true,
    filterType: 'multiselect',
    filterOptions: INBOX_URGENCY_FILTER_OPTIONS,
  },
  {
    id: 'type',
    label: 'Type',
    width: 140,
    minWidth: 100,
    maxWidth: 180,
    resizable: true,
    filterable: true,
    filterType: 'multiselect',
    filterOptions: INBOX_TYPE_FILTER_OPTIONS,
  },
  {
    id: 'section',
    label: 'Section',
    width: 170,
    minWidth: 130,
    maxWidth: 240,
    resizable: true,
    filterable: true,
    filterType: 'multiselect',
    filterOptions: INBOX_SECTION_FILTER_OPTIONS,
  },
  {
    id: 'received',
    label: 'Received',
    width: 160,
    minWidth: 120,
    maxWidth: 200,
    resizable: true,
    filterable: false,
  },
  {
    id: 'dueDate',
    label: 'Due Date',
    width: 120,
    minWidth: 90,
    maxWidth: 160,
    resizable: true,
    filterable: false,
  },
  {
    id: 'sla',
    label: 'SLA',
    width: 120,
    minWidth: 90,
    maxWidth: 170,
    resizable: true,
    filterable: false,
  },
  {
    id: 'actions',
    label: 'Actions',
    width: 70,
    minWidth: 50,
    maxWidth: 90,
    resizable: false,
    filterable: false,
    align: 'right',
  },
];

const getDefaultColumnWidths = (): ColumnWidths =>
  INBOX_COLUMNS.reduce((acc, col) => ({ ...acc, [col.id]: col.width }), {});

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export const InboxContent: React.FC<InboxContentProps> = ({
  searchQuery,
  onOpenTask,
  onOpenDecision,
  onOpenNotification,
  onCountsChange,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');

  const [data, setData] = useState<InboxResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [inboxSection, setInboxSection] = useState<'today' | 'this_week' | 'all'>('all');

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Column widths (resizable)
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>(getDefaultColumnWidths());

  // Filter state (session-only)
  const [tableFilters, setTableFilters] = useState<TableFilters>({});
  const [openFilterId, setOpenFilterId] = useState<string | null>(null);

  // ── Fetch ──
  const fetchInbox = useCallback(async () => {
    try {
      setLoading(true);
      const res = (await Api.get('/my-work/inbox?limit=50')) as InboxResponse;
      setData(res);
      onCountsChange({ total: res?.summary?.total || 0, critical: res?.summary?.critical || 0 });
    } catch (e) {
      console.error('Failed to load inbox', e);
      toast.error(isPolish ? 'Nie udało się załadować Inbox' : 'Failed to load Inbox');
    } finally {
      setLoading(false);
    }
  }, [isPolish, onCountsChange]);

  useEffect(() => {
    fetchInbox();
  }, [fetchInbox]);

  // ── Items with search + section filtering ──
  const items = useMemo(() => {
    let all = data?.items || [];
    const q = (searchQuery || '').trim().toLowerCase();
    if (q) {
      all = all.filter((i) => {
        const t = `${i.title || ''} ${i.description || ''}`.toLowerCase();
        return t.includes(q);
      });
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
    return all;
  }, [data?.items, searchQuery, inboxSection]);

  // ── Apply table-level filters ──
  const filteredItems = useMemo(() => {
    let result = [...items];

    const statusFilter = tableFilters.status as string[] | undefined;
    const urgencyFilter = tableFilters.urgency as string[] | undefined;
    const typeFilter = tableFilters.type as string[] | undefined;
    const sectionFilter = tableFilters.section as string[] | undefined;

    if (statusFilter?.length) {
      result = result.filter((item) => {
        const val = item.triaged ? 'triaged' : 'new';
        return statusFilter.includes(val);
      });
    }
    if (urgencyFilter?.length) {
      result = result.filter((item) => urgencyFilter.includes(item.urgency));
    }
    if (typeFilter?.length) {
      result = result.filter((item) => typeFilter.includes(item.type));
    }
    if (sectionFilter?.length) {
      result = result.filter((item) => sectionFilter.includes(item.section));
    }

    return result;
  }, [items, tableFilters]);

  // ── Triage ──
  const triage = useCallback(
    async (item: InboxItem, action: TriageAction) => {
      try {
        await Api.post(`/my-work/inbox/${encodeURIComponent(item.id)}/triage`, {
          action,
          itemKey: item._key,
        });
        setData((prev) => {
          if (!prev) return prev;
          return { ...prev, items: prev.items.filter((x) => x._key !== item._key) };
        });
        toast.success(isPolish ? 'Zatwierdzono' : 'Triaged');
      } catch (e) {
        console.error('Failed to triage inbox item', e);
        toast.error(isPolish ? 'Nie udało się wykonać akcji' : 'Failed to triage item');
      }
    },
    [isPolish]
  );

  const open = useCallback(
    (item: InboxItem) => {
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

  // ── Column resize ──
  const handleColumnResize = (columnId: string, newWidth: number) => {
    setColumnWidths((prev) => ({ ...prev, [columnId]: newWidth }));
  };

  // ── Filter change ──
  const handleFilterChange = (columnId: string, values: string[]) => {
    setTableFilters((prev) => ({
      ...prev,
      [columnId]: values.length > 0 ? values : undefined,
    }));
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

  // ═══════════════════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-navy-950">
      {/* Header */}
      <div className="px-4 pt-4 pb-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-slate-900 dark:text-white">
              {isPolish ? 'Inbox (Action Queue)' : 'Inbox (Action Queue)'}
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400">
              {isPolish ? 'Tylko rzeczy wymagające akcji.' : 'Only items requiring action.'}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {isPolish
                ? 'Zakładki „Nowe dziś / w tym tygodniu” liczą elementy wg czasu otrzymania. „Focus → Today” to Twoja lista na dziś (terminy + rzeczy, które oznaczysz „Biorę dziś”).'
                : '“New today / this week” counts items by received time. “Focus → Today” is your curated list for today (due items + anything you mark as “Accept today”).'}
            </div>
          </div>
        </div>

        {/* Summary pills */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 dark:bg-navy-900/40 border border-slate-200 dark:border-navy-700 text-sm text-slate-700 dark:text-slate-200">
            <Inbox size={14} />
            {isPolish ? 'W kolejce' : 'In queue'}: <b>{data?.summary?.total ?? 0}</b>
          </span>
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-100 dark:bg-red-500/15 border border-red-200/70 dark:border-red-500/25 text-sm text-red-700 dark:text-red-200">
            <AlertTriangle size={14} />
            {isPolish ? 'Krytyczne' : 'Critical'}: <b>{data?.summary?.critical ?? 0}</b>
          </span>
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-500/15 border border-amber-200/70 dark:border-amber-500/25 text-sm text-amber-700 dark:text-amber-200">
            <Clock size={14} />
            {isPolish ? 'Nowe dziś' : 'New today'}: <b>{data?.summary?.newToday ?? 0}</b>
          </span>
        </div>

        {/* Section tabs */}
        <div className="mt-4 flex items-center gap-1 border-b border-slate-200 dark:border-navy-700">
          {(['today', 'this_week', 'all'] as const).map((section) => {
            const count = sectionCounts[section];
            const label =
              section === 'today'
                ? isPolish
                  ? 'Nowe dziś'
                  : 'New today'
                : section === 'this_week'
                  ? isPolish
                    ? 'Nowe w tym tygodniu'
                    : 'New this week'
                  : isPolish
                    ? 'Wszystkie'
                    : 'All';
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

      {/* Table content */}
      <div className="flex-1 overflow-y-auto p-4 pt-0">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-slate-600 dark:text-slate-300">
            <Loader2 className="animate-spin mr-2" size={18} />
            {isPolish ? 'Ładowanie...' : 'Loading...'}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-12 text-center text-slate-600 dark:text-slate-300">
            <Inbox size={32} className="mx-auto mb-3 text-slate-400" />
            <p className="text-sm font-medium">
              {isPolish ? 'Inbox jest pusty — zero zaległości!' : 'Inbox is empty — zero backlog!'}
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden mt-4">
            <table className="w-full table-fixed" style={{ minWidth: 900 }}>
              <thead>
                <tr className="border-b border-slate-200 dark:border-navy-700/50 bg-slate-50 dark:bg-navy-900/50 sticky top-0 z-10">
                  {/* Select All */}
                  <th className="w-10 px-2 py-2">
                    <button
                      onClick={() => handleSelectAll(!allSelected)}
                      className={`
                        w-5 h-5 rounded border flex items-center justify-center transition-colors
                        ${
                          allSelected
                            ? 'bg-primary-500 border-primary-500 text-white'
                            : someSelected
                              ? 'bg-primary-500/50 border-primary-500 text-white'
                              : 'border-slate-300 dark:border-navy-500 hover:border-primary-400 text-transparent hover:text-slate-400'
                        }
                      `}
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

                  {/* Title */}
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-full">
                    Title
                  </th>

                  {/* Status — filterable + resizable */}
                  <th
                    className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider relative group/header"
                    style={{ width: columnWidths.status }}
                  >
                    <div className="flex items-center gap-1">
                      <span
                        className={
                          (tableFilters.status as string[])?.length ? 'text-primary-500' : ''
                        }
                      >
                        Status
                      </span>
                      <FilterDropdown
                        column={INBOX_COLUMNS.find((c) => c.id === 'status')!}
                        value={tableFilters.status as string[]}
                        onChange={(val) => handleFilterChange('status', val as string[])}
                        isOpen={openFilterId === 'status'}
                        onToggle={() =>
                          setOpenFilterId(openFilterId === 'status' ? null : 'status')
                        }
                        onClose={() => setOpenFilterId(null)}
                      />
                    </div>
                    <ColumnResizer
                      columnId="status"
                      currentWidth={columnWidths.status}
                      minWidth={90}
                      maxWidth={160}
                      onResize={handleColumnResize}
                    />
                  </th>

                  {/* Urgency — filterable + resizable */}
                  <th
                    className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider relative group/header"
                    style={{ width: columnWidths.urgency }}
                  >
                    <div className="flex items-center gap-1">
                      <span
                        className={
                          (tableFilters.urgency as string[])?.length ? 'text-primary-500' : ''
                        }
                      >
                        Urgency
                      </span>
                      <FilterDropdown
                        column={INBOX_COLUMNS.find((c) => c.id === 'urgency')!}
                        value={tableFilters.urgency as string[]}
                        onChange={(val) => handleFilterChange('urgency', val as string[])}
                        isOpen={openFilterId === 'urgency'}
                        onToggle={() =>
                          setOpenFilterId(openFilterId === 'urgency' ? null : 'urgency')
                        }
                        onClose={() => setOpenFilterId(null)}
                      />
                    </div>
                    <ColumnResizer
                      columnId="urgency"
                      currentWidth={columnWidths.urgency}
                      minWidth={90}
                      maxWidth={170}
                      onResize={handleColumnResize}
                    />
                  </th>

                  {/* Type — filterable + resizable */}
                  <th
                    className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider relative group/header"
                    style={{ width: columnWidths.type }}
                  >
                    <div className="flex items-center gap-1">
                      <span
                        className={
                          (tableFilters.type as string[])?.length ? 'text-primary-500' : ''
                        }
                      >
                        Type
                      </span>
                      <FilterDropdown
                        column={INBOX_COLUMNS.find((c) => c.id === 'type')!}
                        value={tableFilters.type as string[]}
                        onChange={(val) => handleFilterChange('type', val as string[])}
                        isOpen={openFilterId === 'type'}
                        onToggle={() => setOpenFilterId(openFilterId === 'type' ? null : 'type')}
                        onClose={() => setOpenFilterId(null)}
                      />
                    </div>
                    <ColumnResizer
                      columnId="type"
                      currentWidth={columnWidths.type}
                      minWidth={100}
                      maxWidth={180}
                      onResize={handleColumnResize}
                    />
                  </th>

                  {/* Received — resizable */}
                  {/* Section — filterable + resizable */}
                  <th
                    className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider relative group/header"
                    style={{ width: columnWidths.section }}
                  >
                    <div className="flex items-center gap-1">
                      <span
                        className={
                          (tableFilters.section as string[])?.length ? 'text-primary-500' : ''
                        }
                      >
                        Section
                      </span>
                      <FilterDropdown
                        column={INBOX_COLUMNS.find((c) => c.id === 'section')!}
                        value={tableFilters.section as string[]}
                        onChange={(val) => handleFilterChange('section', val as string[])}
                        isOpen={openFilterId === 'section'}
                        onToggle={() =>
                          setOpenFilterId(openFilterId === 'section' ? null : 'section')
                        }
                        onClose={() => setOpenFilterId(null)}
                      />
                    </div>
                    <ColumnResizer
                      columnId="section"
                      currentWidth={columnWidths.section}
                      minWidth={130}
                      maxWidth={240}
                      onResize={handleColumnResize}
                    />
                  </th>

                  {/* Received — resizable */}
                  <th
                    className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider relative group/header"
                    style={{ width: columnWidths.received }}
                  >
                    <span>Received</span>
                    <ColumnResizer
                      columnId="received"
                      currentWidth={columnWidths.received}
                      minWidth={120}
                      maxWidth={200}
                      onResize={handleColumnResize}
                    />
                  </th>

                  {/* Due Date — resizable */}
                  <th
                    className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider relative group/header"
                    style={{ width: columnWidths.dueDate }}
                  >
                    <span>Due Date</span>
                    <ColumnResizer
                      columnId="dueDate"
                      currentWidth={columnWidths.dueDate}
                      minWidth={90}
                      maxWidth={160}
                      onResize={handleColumnResize}
                    />
                  </th>

                  {/* SLA — resizable */}
                  <th
                    className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider relative group/header"
                    style={{ width: columnWidths.sla }}
                  >
                    <span>SLA</span>
                    <ColumnResizer
                      columnId="sla"
                      currentWidth={columnWidths.sla}
                      minWidth={90}
                      maxWidth={170}
                      onResize={handleColumnResize}
                    />
                  </th>

                  {/* Actions */}
                  <th
                    className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider"
                    style={{ width: columnWidths.actions }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredItems.map((item) => {
                  const u = urgencyStyles[item.urgency] || urgencyStyles.normal;
                  const UIcon = u.icon;
                  const TIcon = typeIcon[item.type] || Inbox;
                  const sc = statusConfig(item.triaged);
                  const isSelected = selectedIds.has(item.id);
                  const overdue = isDueDateOverdue(item.dueDate, item.triaged);
                  const isNotification = String(item._key || '').startsWith('notification:');

                  const rowActions: RowAction[] = [
                    {
                      id: 'open',
                      label: isPolish ? 'Otwórz' : 'Open',
                      icon: Eye,
                      onClick: () => open(item),
                      variant: 'primary',
                    },
                    ...(isNotification
                      ? [
                          {
                            id: 'acknowledge',
                            label: isPolish ? 'Potwierdzam' : 'Acknowledge',
                            icon: CheckCheck,
                            onClick: () => triage(item, 'archive'),
                          },
                        ]
                      : [
                          {
                            id: 'accept',
                            label: isPolish ? 'Biorę dziś' : 'Accept today',
                            icon: Check,
                            onClick: () => triage(item, 'accept_today'),
                          },
                          {
                            id: 'acknowledge',
                            label: isPolish ? 'Potwierdzam' : 'Acknowledge',
                            icon: CheckCheck,
                            onClick: () => triage(item, 'accept_today'),
                          },
                        ]),
                    {
                      id: 'archive',
                      label: isPolish ? 'Archiwizuj' : 'Archive',
                      icon: Archive,
                      onClick: () => triage(item, 'archive'),
                      divider: true,
                    },
                  ];

                  return (
                    <tr
                      key={item.id}
                      className={`
                        group cursor-pointer border-b border-slate-200 dark:border-navy-700/50
                        ${isSelected ? 'bg-primary-50 dark:bg-primary-500/10' : ''}
                        transition-colors duration-150
                        hover:bg-slate-50 dark:hover:bg-navy-800/50
                      `}
                      onClick={() => open(item)}
                    >
                      {/* Checkbox */}
                      <td className="w-10 px-2 py-2.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectItem(item.id);
                          }}
                          className={`
                            w-5 h-5 rounded border flex items-center justify-center transition-all
                            ${
                              isSelected
                                ? 'bg-primary-500 border-primary-500 text-white'
                                : 'border-slate-300 dark:border-navy-500 hover:border-primary-400'
                            }
                          `}
                        >
                          {isSelected && <CheckSquare size={12} />}
                        </button>
                      </td>

                      {/* Title */}
                      <td className="px-3 py-2.5 w-full">
                        <span
                          className="text-sm font-medium text-slate-900 dark:text-white truncate block"
                          title={item.title}
                        >
                          {item.title}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-3 py-2.5" style={{ width: columnWidths.status }}>
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap leading-none ${sc.bg} ${sc.color}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                          {sc.label}
                        </span>
                      </td>

                      {/* Urgency */}
                      <td className="px-3 py-2.5" style={{ width: columnWidths.urgency }}>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${u.pill}`}
                        >
                          <UIcon size={11} />
                          {u.label}
                        </span>
                      </td>

                      {/* Type */}
                      <td className="px-3 py-2.5" style={{ width: columnWidths.type }}>
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                          <TIcon size={12} />
                          <span className="truncate">
                            {typeLabel[item.type] || item.type.replace(/_/g, ' ')}
                          </span>
                        </span>
                      </td>

                      {/* Section */}
                      <td className="px-3 py-2.5" style={{ width: columnWidths.section }}>
                        <span className="text-xs text-slate-600 dark:text-slate-400">
                          {formatSectionLabel(item.section, isPolish)}
                        </span>
                      </td>

                      {/* Received */}
                      <td
                        className="px-3 py-2.5 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap"
                        style={{ width: columnWidths.received }}
                      >
                        {formatReceivedDate(item.receivedAt)}
                      </td>

                      {/* Due Date */}
                      <td className="px-3 py-2.5" style={{ width: columnWidths.dueDate }}>
                        <div
                          className={`flex items-center gap-1.5 text-xs ${
                            !item.dueDate
                              ? 'text-slate-300 dark:text-slate-600'
                              : overdue
                                ? 'text-red-700 dark:text-red-400 font-medium'
                                : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {item.dueDate && <Calendar size={12} />}
                          <span>{formatDueDate(item.dueDate)}</span>
                        </div>
                      </td>

                      {/* SLA */}
                      <td className="px-3 py-2.5" style={{ width: columnWidths.sla }}>
                        {(() => {
                          const pill = slaPill(item.sla);
                          if (pill.label === '-') {
                            return <span className={pill.className}>{pill.label}</span>;
                          }
                          return (
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${pill.className}`}
                              title={pill.title}
                            >
                              {pill.label}
                            </span>
                          );
                        })()}
                      </td>

                      {/* Actions */}
                      <td
                        className="px-3 py-2.5 text-right"
                        style={{ width: columnWidths.actions }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <RowActionsMenu actions={rowActions} size="sm" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
