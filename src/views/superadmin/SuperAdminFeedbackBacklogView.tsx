import { ExternalLink, Filter, Loader2, Tag } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

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

  const openTask = (taskId: string) => {
    const url = `/my-work/tasks/${taskId}`;
    window.open(url, '_blank', 'noopener,noreferrer');
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
                return (
                  <button
                    key={item.id}
                    onClick={() => openTask(item.id)}
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
                        <ExternalLink size={16} />
                      </div>
                    </div>
                  </button>
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
