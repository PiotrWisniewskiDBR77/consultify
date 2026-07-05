import { Bell, ChevronLeft, ExternalLink, Loader2, Plus, Send, Tag } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { useAppStore } from '../../store/useAppStore';
import { AppView } from '../../types';

type UpdateItem = {
  id: string;
  title: string;
  bodyMd: string;
  tags: string[];
  importance: 'low' | 'normal' | 'high';
  publishedAt: string | null;
  actionPayload: Record<string, any>;
  isRead: boolean;
  readAt: string | null;
};

type AdminUpdateItem = UpdateItem & {
  status: 'draft' | 'published' | 'archived' | string;
  createdAt: string;
};

// Helper to get auth token (mirrors HelpContext)
const getAuthToken = (): string | null => {
  try {
    const stored = localStorage.getItem('consultify-storage');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.state?.currentUser?.token || localStorage.getItem('auth_token') || null;
    }
    return localStorage.getItem('auth_token');
  } catch {
    return null;
  }
};

function importanceBadge(importance: string) {
  if (importance === 'high')
    return 'bg-danger-500/10 text-danger-700 dark:text-danger-300 border-danger-500/20';
  if (importance === 'low')
    return 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300 border-slate-200 dark:border-navy-700';
  return 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20';
}

const VIEW_OPTIONS: Array<{ labelKey: string; view: AppView }> = [
  { labelKey: 'help.updates.admin.views.dashboard', view: AppView.DASHBOARD_OVERVIEW },
  { labelKey: 'help.updates.admin.views.assessment', view: AppView.ASSESSMENT_SUMMARY },
  { labelKey: 'help.updates.admin.views.initiatives', view: AppView.FULL_STEP2_INITIATIVES },
  { labelKey: 'help.updates.admin.views.roadmap', view: AppView.PORTFOLIO_ROADMAP },
  { labelKey: 'help.updates.admin.views.reports', view: AppView.FULL_STEP6_REPORTS },
  { labelKey: 'help.updates.admin.views.aiChat', view: AppView.AI_CHAT },
];

export const FeatureUpdatesPanel: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const { t } = useTranslation();
  const currentUser = useAppStore((s) => s.currentUser);
  const setCurrentView = useAppStore((s) => s.setCurrentView);

  const isAdmin = useMemo(() => {
    const r = String(currentUser?.role || '').toUpperCase();
    return ['ADMIN', 'OWNER', 'SUPERADMIN', 'SUPER_ADMIN'].includes(r);
  }, [currentUser?.role]);

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<UpdateItem[]>([]);
  const [selected, setSelected] = useState<UpdateItem | null>(null);

  const [adminLoading, setAdminLoading] = useState(false);
  const [adminItems, setAdminItems] = useState<AdminUpdateItem[]>([]);
  const [showComposer, setShowComposer] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Composer state
  const [title, setTitle] = useState('');
  const [bodyMd, setBodyMd] = useState('');
  const [tags, setTags] = useState<string>('');
  const [importance, setImportance] = useState<'low' | 'normal' | 'high'>('normal');
  const [actionView, setActionView] = useState<AppView>(AppView.PORTFOLIO_ROADMAP);

  const authHeaders = useMemo<Record<string, string>>(() => {
    const token = getAuthToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }, [currentUser?.id]);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/updates/feed?limit=30', { headers: authHeaders });
      if (!res.ok) throw new Error('Failed to load updates');
      const data = await res.json();
      setItems(data.items || []);
    } catch (e: any) {
      toast.error(t('help.updates.errors.load', 'Failed to load updates'));
    } finally {
      setLoading(false);
    }
  }, [authHeaders, t]);

  const loadAdminList = useCallback(async () => {
    if (!isAdmin) return;
    setAdminLoading(true);
    try {
      const res = await fetch('/api/updates/admin/list', { headers: authHeaders });
      if (!res.ok) throw new Error('Failed to load admin updates');
      const data = await res.json();
      setAdminItems(data.items || []);
    } catch {
      // Non-blocking: admin list isn't required for normal usage.
    } finally {
      setAdminLoading(false);
    }
  }, [authHeaders, isAdmin]);

  useEffect(() => {
    if (!currentUser?.id) return;
    loadFeed();
    loadAdminList();
  }, [currentUser?.id, loadAdminList, loadFeed]);

  const markRead = async (id: string) => {
    try {
      await fetch(`/api/updates/${id}/read`, { method: 'POST', headers: authHeaders, body: '{}' });
    } catch {
      // ignore
    }
  };

  const openUpdate = async (u: UpdateItem) => {
    setSelected(u);
    setItems((prev) => prev.map((x) => (x.id === u.id ? { ...x, isRead: true } : x)));

    try {
      await fetch(`/api/updates/${u.id}/opened`, {
        method: 'POST',
        headers: authHeaders,
        body: '{}',
      });
    } catch {
      // ignore
    }
    await markRead(u.id);
  };

  const clickTryItNow = async (u: UpdateItem) => {
    const kind = u.actionPayload?.kind;
    const view = u.actionPayload?.view;
    if (kind === 'view' && typeof view === 'string') {
      try {
        await fetch(`/api/updates/${u.id}/clicked`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ url: `view:${view}` }),
        });
      } catch {
        // ignore
      }
      setCurrentView(view as AppView);
      onClose?.();
    }
  };

  const unreadCount = useMemo(() => items.filter((i) => !i.isRead).length, [items]);

  const publishNow = async () => {
    if (!title.trim() || !bodyMd.trim()) {
      toast.error(t('help.updates.admin.errors.required', 'Title and body are required'));
      return;
    }

    setPublishing(true);
    try {
      const tagsArr = tags
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 10);

      const createRes = await fetch('/api/updates/admin/create', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          title: title.trim(),
          bodyMd: bodyMd.trim(),
          tags: tagsArr,
          importance,
          actionPayload: {
            kind: 'view',
            view: actionView,
            label: t('help.updates.tryItNow', 'Try it now'),
          },
        }),
      });
      if (!createRes.ok) throw new Error('Create failed');
      const created = await createRes.json();

      const pubRes = await fetch(`/api/updates/admin/${created.id}/publish`, {
        method: 'POST',
        headers: authHeaders,
        body: '{}',
      });
      if (!pubRes.ok) throw new Error('Publish failed');

      toast.success(t('help.updates.admin.success', 'Update published'));
      setShowComposer(false);
      setTitle('');
      setBodyMd('');
      setTags('');
      setImportance('normal');
      await loadFeed();
      await loadAdminList();
    } catch {
      toast.error(t('help.updates.admin.errors.publish', 'Failed to publish update'));
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="animate-spin text-primary-500" />
      </div>
    );
  }

  if (selected) {
    const badgeCls = importanceBadge(selected.importance);
    const canAction =
      selected.actionPayload?.kind === 'view' && typeof selected.actionPayload?.view === 'string';

    return (
      <div className="space-y-4">
        <button
          onClick={() => setSelected(null)}
          className="text-xs text-slate-500 hover:text-primary-600 dark:text-slate-400 dark:hover:text-primary-400 flex items-center gap-1"
        >
          <ChevronLeft size={14} />
          {t('help.updates.back', 'Back to updates')}
        </button>

        <div className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{selected.title}</h3>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badgeCls}`}
                >
                  {t(`help.updates.importance.${selected.importance}`, selected.importance)}
                </span>
                {selected.publishedAt && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {new Date(selected.publishedAt).toLocaleDateString()}
                  </span>
                )}
                {selected.tags?.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                    <Tag size={12} />
                    {selected.tags.join(', ')}
                  </span>
                )}
              </div>
            </div>
            <Bell size={18} className="text-primary-500 flex-shrink-0 mt-1" />
          </div>

          <div className="prose prose-slate dark:prose-invert max-w-none text-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{selected.bodyMd}</ReactMarkdown>
          </div>

          {canAction && (
            <button
              onClick={() => clickTryItNow(selected)}
              className="w-full mt-2 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] text-sm font-semibold transition-colors"
            >
              {t('help.updates.tryItNow', 'Try it now')}
              <ExternalLink size={16} />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Bell size={18} className="text-primary-500" />
            {t('help.updates.title', "What's new")}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {t('help.updates.subtitle', 'Product updates, improvements, and release notes.')}
          </p>
        </div>
        {unreadCount > 0 && (
          <span className="px-2 py-1 rounded-full bg-primary-500/10 text-primary-700 dark:text-primary-300 text-xs font-semibold">
            {t('help.updates.unread', '{{count}} unread', { count: unreadCount })}
          </span>
        )}
      </div>

      {isAdmin && (
        <div className="flex items-center justify-between gap-2 p-3 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl">
          <div className="text-xs text-slate-600 dark:text-slate-300">
            {t('help.updates.admin.hint', 'Publish an update for your users.')}
          </div>
          <button
            onClick={() => setShowComposer(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] text-xs font-semibold transition-colors"
          >
            <Plus size={14} />
            {t('help.updates.admin.new', 'New update')}
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="text-center py-10">
          <Bell size={28} className="mx-auto text-slate-600 dark:text-slate-400 mb-2" />
          <div className="text-sm text-slate-600 dark:text-slate-300">
            {t('help.updates.empty', 'No updates yet.')}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((u) => (
            <button
              key={u.id}
              onClick={() => openUpdate(u)}
              className="w-full text-left bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-4 hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {!u.isRead && (
                      <span className="w-2 h-2 rounded-full bg-navy-900 flex-shrink-0" />
                    )}
                    <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {u.title}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${importanceBadge(
                        u.importance
                      )}`}
                    >
                      {t(`help.updates.importance.${u.importance}`, u.importance)}
                    </span>
                    {u.publishedAt && (
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {new Date(u.publishedAt).toLocaleDateString()}
                      </span>
                    )}
                    {u.tags?.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                        <Tag size={12} />
                        {u.tags.join(', ')}
                      </span>
                    )}
                  </div>
                </div>
                <Bell size={16} className="text-slate-600 dark:text-slate-400 flex-shrink-0 mt-1" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Composer modal */}
      {showComposer && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-overlay"
            onClick={() => (publishing ? null : setShowComposer(false))}
          />
          <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between">
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  {t('help.updates.admin.composeTitle', 'Publish update')}
                </div>
                <button
                  onClick={() => (publishing ? null : setShowComposer(false))}
                  className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-white"
                >
                  {t('common.close', 'Close')}
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {t('help.updates.admin.fields.title', 'Title')}
                  </div>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-sm"
                    placeholder={t('help.updates.admin.placeholders.title', 'Short and specific')}
                  />
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {t('help.updates.admin.fields.body', 'Body (Markdown)')}
                  </div>
                  <textarea
                    value={bodyMd}
                    onChange={(e) => setBodyMd(e.target.value)}
                    rows={8}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-sm font-mono"
                    placeholder={t(
                      'help.updates.admin.placeholders.body',
                      'Write short sections, include bullets, and end with a “Try it now” hint.'
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {t('help.updates.admin.fields.tags', 'Tags (modules)')}
                    </div>
                    <input
                      value={tags}
                      onChange={(e) => setTags(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-sm"
                      placeholder={t(
                        'help.updates.admin.placeholders.tags',
                        'e.g. roadmap, reports'
                      )}
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {t('help.updates.admin.fields.importance', 'Importance')}
                    </div>
                    <select
                      value={importance}
                      onChange={(e) => setImportance(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-sm"
                    >
                      <option value="low">{t('help.updates.importance.low', 'Low')}</option>
                      <option value="normal">
                        {t('help.updates.importance.normal', 'Normal')}
                      </option>
                      <option value="high">{t('help.updates.importance.high', 'High')}</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {t('help.updates.admin.fields.tryItNow', '"Try it now" target')}
                    </div>
                    <select
                      value={actionView}
                      onChange={(e) => setActionView(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-sm"
                    >
                      {VIEW_OPTIONS.map((o) => (
                        <option key={o.view} value={o.view}>
                          {t(o.labelKey, o.view)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {t(
                      'help.updates.admin.notice',
                      'Publishing sends an in-app notification. Email is sent only if SMTP is configured and throttling allows it.'
                    )}
                  </div>
                  <button
                    onClick={publishNow}
                    disabled={publishing}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] disabled:opacity-60 text-white text-xs font-semibold transition-colors"
                  >
                    {publishing ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Send size={14} />
                    )}
                    {t('help.updates.admin.publish', 'Publish')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Admin list (debug visibility, non-blocking) */}
      {isAdmin && adminItems.length > 0 && (
        <div className="pt-2 border-t border-slate-200 dark:border-navy-700">
          <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-2">
            <Tag size={12} />
            {t('help.updates.admin.recent', 'Recent (admin)')}
            {adminLoading && <Loader2 size={12} className="animate-spin" />}
          </div>
          <div className="space-y-2">
            {adminItems.slice(0, 3).map((u) => (
              <div
                key={u.id}
                className="p-3 bg-slate-50 dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-700 dark:text-slate-200 truncate">
                    {u.title}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                    {u.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FeatureUpdatesPanel;
