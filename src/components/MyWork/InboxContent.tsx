import {
  AlertCircle,
  AlertTriangle,
  Archive,
  ArrowRight,
  Bell,
  Calendar,
  Check,
  CheckCheck,
  Clock,
  Eye,
  Inbox,
  Loader2,
  Scale,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { type CardViewStyle, CardViewSwitcher } from '@/components/shared/CardViewSwitcher';
import type { GenericListItem, ListColumn, ListSection } from '@/components/shared/ViewLayouts';
import { ClickUpListView, NotionListView } from '@/components/shared/ViewLayouts';
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

type TriageAction = 'accept_today' | 'schedule' | 'delegate' | 'archive' | 'reject';

type InboxItemKey = `task:${string}` | `decision:${string}` | `notification:${string}`;

interface InboxItem {
  id: string;
  type: InboxItemType;
  title: string;
  description?: string;
  receivedAt: string;
  urgency: InboxUrgency;
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

const typeIcon: Record<InboxItemType, React.ElementType> = {
  new_assignment: Inbox,
  mention: Bell,
  escalation: AlertTriangle,
  review_request: AlertCircle,
  decision_request: Scale,
  ai_suggestion: AlertCircle,
};

const isoToLocal = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString();
};

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
  // A2.3: Section filter analogous to Focus
  const [inboxSection, setInboxSection] = useState<'today' | 'this_week' | 'all'>('all');
  const [cardViewStyle, setCardViewStyle] = useState<CardViewStyle>('d');

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

  const items = useMemo(() => {
    let all = data?.items || [];
    const q = (searchQuery || '').trim().toLowerCase();
    if (q) {
      all = all.filter((i) => {
        const t = `${i.title || ''} ${i.description || ''}`.toLowerCase();
        return t.includes(q);
      });
    }
    // A2.3: Filter by section
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

  const triage = useCallback(
    async (item: InboxItem, action: TriageAction) => {
      try {
        await Api.post(`/my-work/inbox/${encodeURIComponent(item.id)}/triage`, {
          action,
          itemKey: item._key,
        });
        // optimistic: remove from list
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
      // notification:<id> can be parsed from _key
      if (String(item._key).startsWith('notification:')) {
        const id = String(item._key).replace(/^notification:/, '');
        return onOpenNotification?.(id);
      }
    },
    [onOpenDecision, onOpenNotification, onOpenTask]
  );

  /* ─── Mapping for N / C views ─── */
  const inboxItemToGeneric = (item: InboxItem): GenericListItem => {
    const u = urgencyStyles[item.urgency] || urgencyStyles.normal;
    return {
      id: item.id,
      title: item.title || 'Untitled',
      subtitle: item.description || undefined,
      status: item.triaged ? 'Triaged' : 'New',
      statusVariant: item.triaged ? 'success' : 'warning',
      priority: u.label,
      priorityVariant:
        item.urgency === 'critical'
          ? 'critical'
          : item.urgency === 'high'
            ? 'high'
            : item.urgency === 'low'
              ? 'low'
              : 'medium',
      dueDate: item.receivedAt
        ? new Date(item.receivedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : undefined,
      secondaryLabel: item.type.replace(/_/g, ' '),
      isHighlighted: item.urgency === 'critical' || !item.triaged,
      _raw: item,
    };
  };

  const inboxViewSections: ListSection[] = useMemo(() => {
    const critical = items.filter((i) => i.urgency === 'critical').map(inboxItemToGeneric);
    const high = items.filter((i) => i.urgency === 'high').map(inboxItemToGeneric);
    const normal = items.filter((i) => i.urgency === 'normal').map(inboxItemToGeneric);
    const low = items.filter((i) => i.urgency === 'low').map(inboxItemToGeneric);
    return [
      ...(critical.length
        ? [
            {
              id: 'critical',
              label: isPolish ? 'Krytyczne' : 'Critical',
              items: critical,
              accentColor: 'text-red-500',
            },
          ]
        : []),
      ...(high.length
        ? [
            {
              id: 'high',
              label: isPolish ? 'Wysokie' : 'High',
              items: high,
              accentColor: 'text-amber-500',
            },
          ]
        : []),
      ...(normal.length
        ? [
            {
              id: 'normal',
              label: isPolish ? 'Normalne' : 'Normal',
              items: normal,
              accentColor: 'text-slate-500',
            },
          ]
        : []),
      ...(low.length
        ? [
            {
              id: 'low',
              label: isPolish ? 'Niskie' : 'Low',
              items: low,
              accentColor: 'text-slate-400',
            },
          ]
        : []),
    ];
  }, [items, isPolish]);

  const INBOX_CLICKUP_COLUMNS: ListColumn[] = [
    { key: 'title', label: 'Title', width: 'flex-1 min-w-0' },
    { key: 'status', label: 'Status', width: 'w-24' },
    { key: 'priority', label: 'Urgency', width: 'w-24' },
    { key: 'secondaryLabel', label: 'Type', width: 'w-28' },
    { key: 'dueDate', label: 'Received', width: 'w-28' },
  ];

  const handleInboxItemClick = (item: GenericListItem) => {
    const raw = item._raw as InboxItem;
    if (raw) open(raw);
  };

  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-slate-900 dark:text-white">
            {isPolish ? 'Inbox (Action Queue)' : 'Inbox (Action Queue)'}
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-400">
            {isPolish
              ? 'Tylko rzeczy wymagające akcji. 4-linijkowy format + CTA.'
              : 'Only items requiring action. 4-line format + CTA.'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CardViewSwitcher
            moduleId="my-work-inbox"
            value={cardViewStyle}
            onChange={setCardViewStyle}
            compact
          />
          <button
            onClick={fetchInbox}
            className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
          >
            {isPolish ? 'Odśwież' : 'Refresh'}
          </button>
        </div>
      </div>

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

      {/* A2.3: Section tabs analogous to Focus (Today / This Week / All) */}
      <div className="mt-4 flex items-center gap-1 border-b border-slate-200 dark:border-navy-700 mb-0">
        {(['today', 'this_week', 'all'] as const).map((section) => {
          const now = new Date();
          const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const weekEnd = new Date(todayStart.getTime() + 7 * 86400000);
          const sectionCount =
            section === 'today'
              ? items.filter((i) => new Date(i.receivedAt || '') >= todayStart).length
              : section === 'this_week'
                ? items.filter((i) => {
                    const d = new Date(i.receivedAt || '');
                    return d >= todayStart && d < weekEnd;
                  }).length
                : items.length;
          const label =
            section === 'today'
              ? isPolish
                ? 'Dziś'
                : 'Today'
              : section === 'this_week'
                ? isPolish
                  ? 'Ten tydzień'
                  : 'This Week'
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
              {label} <span className="text-xs opacity-60">({sectionCount})</span>
            </button>
          );
        })}
      </div>

      {/* Unified table layout (A2.1, A2.2, A2.3) — switches layout based on cardViewStyle */}
      <div className="mt-0">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-slate-600 dark:text-slate-300">
            <Loader2 className="animate-spin mr-2" size={18} />
            {isPolish ? 'Ładowanie...' : 'Loading...'}
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-slate-600 dark:text-slate-300">
            <Inbox size={32} className="mx-auto mb-3 text-slate-400" />
            <p className="text-sm font-medium">
              {isPolish ? 'Inbox jest pusty — zero zaległości!' : 'Inbox is empty — zero backlog!'}
            </p>
          </div>
        ) : cardViewStyle === 'n' ? (
          <div className="mt-4">
            <NotionListView
              sections={inboxViewSections}
              onItemClick={handleInboxItemClick}
              emptyMessage={isPolish ? 'Inbox jest pusty' : 'Inbox is empty'}
            />
          </div>
        ) : cardViewStyle === 'c' ? (
          <div className="mt-4">
            <ClickUpListView
              sections={inboxViewSections}
              columns={INBOX_CLICKUP_COLUMNS}
              onItemClick={handleInboxItemClick}
              emptyMessage={isPolish ? 'Inbox jest pusty' : 'Inbox is empty'}
            />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-navy-700/50 bg-slate-50 dark:bg-navy-900/50 sticky top-0 z-10">
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-[80px]">
                    {isPolish ? 'Pilność' : 'Urgency'}
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-[100px]">
                    {isPolish ? 'Typ' : 'Type'}
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    {isPolish ? 'Tytuł' : 'Title'}
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-[140px]">
                    {isPolish ? 'Odebrane' : 'Received'}
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-[80px]">
                    {isPolish ? 'Status' : 'Status'}
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider w-[60px]">
                    {isPolish ? 'Akcje' : 'Actions'}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-navy-800 divide-y divide-slate-200 dark:divide-white/5">
                {items.map((item) => {
                  const u = urgencyStyles[item.urgency] || urgencyStyles.normal;
                  const UIcon = u.icon;
                  const TIcon = typeIcon[item.type] || Inbox;

                  const rowActions: RowAction[] = [
                    {
                      id: 'open',
                      label: isPolish ? 'Otwórz' : 'Open',
                      icon: Eye,
                      onClick: () => open(item),
                      variant: 'primary',
                    },
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
                      className="hover:bg-slate-50 dark:hover:bg-white/[0.02] cursor-pointer transition-colors"
                      onClick={() => open(item)}
                    >
                      {/* Urgency */}
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${u.pill}`}
                        >
                          <UIcon size={11} />
                          {u.label}
                        </span>
                      </td>
                      {/* Type */}
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                          <TIcon size={12} />
                          <span className="truncate max-w-[80px]">
                            {item.type.replace(/_/g, ' ')}
                          </span>
                        </span>
                      </td>
                      {/* Title — single line, truncated (A2.2) */}
                      <td className="px-3 py-2.5">
                        <span
                          className="text-sm font-medium text-slate-900 dark:text-white truncate block max-w-[400px]"
                          title={item.title}
                        >
                          {item.title}
                        </span>
                      </td>
                      {/* Received */}
                      <td className="px-3 py-2.5 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {isoToLocal(item.receivedAt)}
                      </td>
                      {/* Status (A2.3) */}
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                            item.triaged
                              ? 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                          }`}
                        >
                          {item.triaged
                            ? isPolish
                              ? 'Obsłużone'
                              : 'Triaged'
                            : isPolish
                              ? 'Nowe'
                              : 'New'}
                        </span>
                      </td>
                      {/* Actions — "⋯" menu */}
                      <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
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
