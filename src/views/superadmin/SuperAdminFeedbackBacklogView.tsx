import { ChevronDown, ChevronRight, Filter, Loader2, Tag } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Api } from '../../services/api';

type TaskPriority = 'low' | 'medium' | 'high' | 'critical' | string;

interface FeedbackBacklogTask {
  id: string;
  organization_id: string;
  title: string;
  description?: string;
  status?: string;
  priority?: TaskPriority;
  tags?: string[];
  feedbackId?: string | null;
  created_at?: string;
}

export const SuperAdminFeedbackBacklogView: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<FeedbackBacklogTask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [priority, setPriority] = useState<string>('ALL');

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await Api.getFeedbackBacklogTasks(300);
        if (!mounted) return;
        setTasks((data || []) as FeedbackBacklogTask[]);
      } catch (e) {
        if (!mounted) return;
        console.error('[SuperAdminFeedbackBacklogView] Failed to load backlog tasks', e);
        setTasks([]);
        setError('Feedback backlog is temporarily unavailable.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (tasks || []).filter((tItem) => {
      if (
        priority !== 'ALL' &&
        String(tItem.priority || '').toLowerCase() !== priority.toLowerCase()
      )
        return false;
      if (!q) return true;
      return (
        String(tItem.title || '')
          .toLowerCase()
          .includes(q) ||
        String(tItem.feedbackId || '')
          .toLowerCase()
          .includes(q) ||
        String(tItem.description || '')
          .toLowerCase()
          .includes(q)
      );
    });
  }, [tasks, query, priority]);

  // Feedback #5e5a86c4 — previously this opened `/my-work/tasks/:id` in a new
  // tab. That route doesn't exist (the `/my-work/*` wildcard just re-renders
  // the generic My Work dashboard), so the user was dumped into an unrelated
  // task list in production — losing the superadmin context and seeing tasks
  // that had nothing to do with the feedback they clicked on. We now expand
  // the row in place with the full description, tags, and a direct link to
  // the originating feedback ticket, so the admin stays inside the console.
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpanded = (taskId: string) => {
    setExpandedId((curr) => (curr === taskId ? null : taskId));
  };

  const envFromTags = (tags?: string[]) =>
    (tags || []).find((x) => typeof x === 'string' && x.startsWith('env:'))?.slice('env:'.length) ||
    null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {t('feedback.backlog.title', 'Feedback Backlog (Tasks)')}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t(
              'feedback.backlog.subtitle',
              'Auto-created tasks from user feedback tickets. Use this as your implementation backlog.'
            )}
          </p>
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {t('common.count', 'Count')}: <b>{filtered.length}</b>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('common.search', 'Search…')}
            className="pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-sm text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-sm text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="ALL">{t('common.all', 'All')}</option>
          <option value="critical">{t('common.priority.critical', 'Critical')}</option>
          <option value="high">{t('common.priority.high', 'High')}</option>
          <option value="medium">{t('common.priority.medium', 'Medium')}</option>
          <option value="low">{t('common.priority.low', 'Low')}</option>
        </select>
      </div>

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 py-8">
          <Loader2 size={16} className="animate-spin" />
          {t('common.loading', 'Loading…')}
        </div>
      ) : (
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-2xl overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-6 text-sm text-slate-500 dark:text-slate-400">
              {t('feedback.backlog.empty', 'No feedback backlog tasks found.')}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-navy-800">
              {filtered.map((item) => {
                const env = envFromTags(item.tags);
                const isExpanded = expandedId === item.id;
                const otherTags = (item.tags || []).filter(
                  (tg) => typeof tg === 'string' && !tg.startsWith('env:')
                );
                return (
                  <div key={item.id}>
                    <button
                      onClick={() => toggleExpanded(item.id)}
                      className="w-full text-left p-4 hover:bg-slate-50 dark:hover:bg-navy-800/60 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                              {item.title}
                            </span>
                            {env && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300">
                                {env.toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                            <span>
                              {t('common.priority', 'Priority')}:{' '}
                              <b>{String(item.priority || 'medium')}</b>
                            </span>
                            <span>
                              {t('common.status', 'Status')}: <b>{String(item.status || 'todo')}</b>
                            </span>
                            {item.feedbackId && (
                              <span className="flex items-center gap-1">
                                <Tag size={12} />
                                {t('feedback.ticket', 'Ticket')}: <b>{item.feedbackId}</b>
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="shrink-0 text-slate-400 dark:text-slate-500">
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </div>
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-0 -mt-1 text-xs text-slate-600 dark:text-slate-300 space-y-2 bg-slate-50/60 dark:bg-navy-800/40">
                        {item.description ? (
                          <div className="whitespace-pre-wrap leading-relaxed">
                            {item.description}
                          </div>
                        ) : (
                          <div className="italic text-slate-400">
                            {t('feedback.backlog.noDescription', 'No description recorded.')}
                          </div>
                        )}
                        {otherTags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {otherTags.map((tg) => (
                              <span
                                key={tg}
                                className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-300 text-[10px]"
                              >
                                {tg}
                              </span>
                            ))}
                          </div>
                        )}
                        {item.feedbackId && (
                          <div className="pt-1">
                            <a
                              href={`#/superadmin/feedback?ticket=${encodeURIComponent(
                                item.feedbackId
                              )}`}
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
                              onClick={(e) => {
                                // Keep it within the SPA — navigate to the
                                // feedback registry and deep-link to this ticket.
                                e.preventDefault();
                                const targetHash = `#/superadmin/feedback?ticket=${encodeURIComponent(
                                  String(item.feedbackId)
                                )}`;
                                if (window.location.hash !== targetHash) {
                                  window.location.hash = targetHash;
                                }
                              }}
                            >
                              {t('feedback.backlog.openTicket', 'Open source feedback ticket')}
                              <Tag size={11} />
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SuperAdminFeedbackBacklogView;
