import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bell,
  Calendar,
  Check,
  Clock,
  Inbox,
  Loader2,
  Scale,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

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
    const all = data?.items || [];
    const q = (searchQuery || '').trim().toLowerCase();
    if (!q) return all;
    return all.filter((i) => {
      const t = `${i.title || ''} ${i.description || ''}`.toLowerCase();
      return t.includes(q);
    });
  }, [data?.items, searchQuery]);

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
        <button
          onClick={fetchInbox}
          className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
        >
          {isPolish ? 'Odśwież' : 'Refresh'}
        </button>
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

      <div className="mt-4">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-slate-600 dark:text-slate-300">
            <Loader2 className="animate-spin mr-2" size={18} />
            {isPolish ? 'Ładowanie...' : 'Loading...'}
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-slate-600 dark:text-slate-300">
            {isPolish ? 'Inbox jest pusty.' : 'Inbox is empty.'}
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              const u = urgencyStyles[item.urgency] || urgencyStyles.normal;
              const UIcon = u.icon;
              const TIcon = typeIcon[item.type] || Inbox;

              return (
                <div
                  key={item.id}
                  className="p-3 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900/30 hover:bg-slate-50 dark:hover:bg-navy-900/50 transition-colors"
                >
                  {/* Line 1: Title */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${u.pill}`}
                        >
                          <UIcon size={12} />
                          {u.label}
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-slate-700 dark:text-slate-200">
                          <TIcon size={12} />
                          {item.type.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="mt-2 font-semibold text-slate-900 dark:text-white truncate">
                        {item.title}
                      </div>
                    </div>

                    <button
                      onClick={() => open(item)}
                      className="shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors"
                    >
                      {isPolish ? 'Otwórz' : 'Open'}
                      <ArrowRight size={14} />
                    </button>
                  </div>

                  {/* Line 2: Why important */}
                  <div className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                    <b>{isPolish ? 'Dlaczego:' : 'Why:'}</b>{' '}
                    {item.type === 'escalation'
                      ? isPolish
                        ? 'Zaległe / rosnący koszt braku reakcji.'
                        : 'Overdue / rising cost of inaction.'
                      : item.type === 'decision_request'
                        ? isPolish
                          ? 'Brak decyzji blokuje działania.'
                          : 'Missing decision blocks actions.'
                        : isPolish
                          ? 'Wymaga akcji (triage).'
                          : 'Requires action (triage).'}
                  </div>

                  {/* Line 3: Blocked / Context */}
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    <b>{isPolish ? 'Kontekst:' : 'Context:'}</b>{' '}
                    {isPolish ? 'Odebrane' : 'Received'}: {isoToLocal(item.receivedAt)}
                  </div>

                  {/* Line 4: CTA */}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => triage(item, 'accept_today')}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 text-white text-sm hover:bg-black transition-colors"
                    >
                      <Check size={14} />
                      {isPolish ? 'Biorę dziś' : 'Accept today'}
                    </button>
                    <button
                      onClick={() => triage(item, 'archive')}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
                    >
                      {isPolish ? 'Archiwizuj' : 'Archive'}
                    </button>
                  </div>

                  {item.description ? (
                    <div className="mt-3 text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                      {item.description}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
