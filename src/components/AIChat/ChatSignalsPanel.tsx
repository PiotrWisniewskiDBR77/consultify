import { BellOff, BookOpen, Clock, Sparkles, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';

type Signal = {
  key: string;
  type: string;
  title: string;
  body: string;
  severity?: 'INFO' | 'WARNING' | 'CRITICAL';
  createdAt?: string;
  projectId?: string;
  projectName?: string;
  entityType?: string | null;
  entityId?: string | null;
};

interface ChatSignalsPanelProps {
  open: boolean;
  onClose: () => void;
  projectId?: string | null;
}

const clampText = (s: string, max = 220) => {
  const str = String(s || '').trim();
  if (str.length <= max) return str;
  return `${str.slice(0, max - 1)}…`;
};

export const ChatSignalsPanel: React.FC<ChatSignalsPanelProps> = ({ open, onClose, projectId }) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const [loading, setLoading] = useState(false);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [mutedTypes, setMutedTypes] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '50');
      if (projectId) params.set('projectId', projectId);
      const data = (await Api.get(`/my-work/signals?${params.toString()}`)) as any;
      setSignals(Array.isArray(data?.signals) ? data.signals : []);
      setMutedTypes(Array.isArray(data?.mutedTypes) ? data.mutedTypes : []);
      trackFunnelEvent('signal_feed_opened', { surface: 'chat-signals' });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to load signals:', e);
      toast.error(t('aiChat.signals.loadFailed', 'Failed to load signals'));
    } finally {
      setLoading(false);
    }
  }, [t, projectId]);

  useEffect(() => {
    if (!open) return;
    refresh();
  }, [open, refresh]);

  const visibleSignals = useMemo(() => {
    return (signals || []).slice(0, 12);
  }, [signals]);

  const handleSaveToIdeas = useCallback(
    async (n: Signal) => {
      try {
        const title = n.title || t('aiChat.signals.untitled', 'Signal');
        const body = `${n.body || ''}`.trim();
        const tags = n.projectName ? [String(n.projectName).trim()].filter(Boolean) : [];
        await Api.createMyIdea({
          title,
          body: body ? clampText(body, 1200) : undefined,
          tags,
          sourceType: 'signal',
          sourceConversationId: null,
          sourceMessageId: null,
        });
        trackFunnelEvent('signal_saved_to_ideas', { surface: 'chat-signals', signalKey: n.key });
        toast.success(isPolish ? 'Zapisano do My Ideas' : 'Saved to My Ideas');
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to save to My Ideas:', e);
        toast.error(isPolish ? 'Nie udało się zapisać' : 'Save failed');
      }
    },
    [isPolish, t]
  );

  const handleSaveToNotebook = useCallback(
    async (n: Signal) => {
      const title = n.title || t('aiChat.signals.untitled', 'Signal');
      const body = `${n.body || ''}`.trim();
      const tags = n.projectName ? [String(n.projectName).trim()].filter(Boolean) : [];
      await Api.post('/my-work/notebook/pages', {
        title,
        projectId: n.projectId || projectId || null,
        visibility: n.projectId || projectId ? 'project' : 'private',
        tags,
        contentText: body,
        contentJson: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: body || '' }] }],
        },
      });
      trackFunnelEvent('signal_saved_to_notebook', { surface: 'chat-signals', signalKey: n.key });
      toast.success(isPolish ? 'Zapisano do Notebook' : 'Saved to Notebook');
    },
    [isPolish, projectId, t]
  );

  const handleSnooze = useCallback(
    async (n: Signal, preset: '1h' | '4h' | 'tomorrow' | 'week') => {
      try {
        await Api.post(`/my-work/signals/${encodeURIComponent(n.key)}/snooze`, { preset });
        setSignals((prev) => prev.filter((x) => x.key !== n.key));
        trackFunnelEvent('signal_snoozed', { surface: 'chat-signals', signalKey: n.key, preset });
        toast.success(isPolish ? 'Wyciszono sygnał' : 'Signal snoozed');
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to snooze signal:', e);
        toast.error(isPolish ? 'Nie udało się wyciszyć' : 'Snooze failed');
      }
    },
    [isPolish]
  );

  const handleMuteType = useCallback(
    async (n: Signal) => {
      const type = String(n.type || '').toUpperCase();
      if (!type) return;
      try {
        const res = (await Api.post('/my-work/signals/mute-type', { type })) as any;
        setMutedTypes(Array.isArray(res?.mutedTypes) ? res.mutedTypes : []);
        setSignals((prev) => prev.filter((x) => String(x.type || '').toUpperCase() !== type));
        trackFunnelEvent('signal_type_muted', { surface: 'chat-signals', type });
        toast.success(isPolish ? 'Wyciszono typ sygnału' : 'Muted signal type');
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to mute type:', e);
        toast.error(isPolish ? 'Nie udało się wyciszyć' : 'Mute failed');
      }
    },
    [isPolish]
  );

  const handleDismiss = useCallback(
    async (n: Signal) => {
      try {
        await Api.post(`/my-work/signals/${encodeURIComponent(n.key)}/dismiss`, {});
        setSignals((prev) => prev.filter((x) => x.key !== n.key));
        trackFunnelEvent('signal_dismissed', { surface: 'chat-signals', signalKey: n.key });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to dismiss signal:', e);
        toast.error(isPolish ? 'Nie udało się ukryć' : 'Dismiss failed');
      }
    },
    [isPolish]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white dark:bg-navy-950 border-l border-slate-200 dark:border-white/[0.06] shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/60 dark:border-white/[0.06]">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
            <Sparkles size={16} />
            <span>{t('aiChat.signals.title', 'Important signals')}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06]"
            aria-label={t('common.close', 'Close')}
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-4 py-2 border-b border-slate-200/60 dark:border-white/[0.06] flex items-center justify-between">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {loading
              ? t('common.loading', 'Loading...')
              : t('aiChat.signals.count', '{{count}} signals', { count: visibleSignals.length })}
          </div>
          <button
            onClick={() => refresh()}
            className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline"
          >
            {t('common.refresh', 'Refresh')}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {visibleSignals.length === 0 ? (
            <div className="rounded-lg border border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-900 p-4 text-sm text-slate-600 dark:text-slate-300">
              {t('aiChat.signals.empty', 'No signals right now.')}
            </div>
          ) : (
            visibleSignals.map((n) => {
              return (
                <div
                  key={n.key}
                  className="rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-3"
                >
                  <div className="text-sm font-medium text-slate-900 dark:text-white">
                    {n.title || t('aiChat.signals.untitled', 'Signal')}
                  </div>
                  <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                    {clampText(n.body || '') || t('aiChat.signals.noDetails', 'No details')}
                  </div>

                  {(n.projectName || n.projectId) && (
                    <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                      {n.projectName ? n.projectName : n.projectId}
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => handleSaveToNotebook(n)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary-500/12 text-primary-700 dark:text-primary-300 px-2.5 py-1.5 text-xs font-medium hover:bg-primary-500/18"
                    >
                      <BookOpen size={14} />
                      {t('aiChat.signals.saveNotebook', 'Save to Notebook')}
                    </button>

                    <button
                      onClick={() => handleSaveToIdeas(n)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 px-2.5 py-1.5 text-xs font-medium hover:bg-amber-500/20"
                    >
                      <BookOpen size={14} />
                      {t('aiChat.signals.saveIdeas', 'Save to My Ideas')}
                    </button>

                    <button
                      onClick={() => handleSnooze(n, '1h')}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-200 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-200 dark:hover:bg-white/[0.10]"
                    >
                      <Clock size={14} />
                      {t('aiChat.signals.snooze', 'Snooze')}
                    </button>

                    <button
                      onClick={() => handleMuteType(n)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-200 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-200 dark:hover:bg-white/[0.10]"
                    >
                      <BellOff size={14} />
                      {t('aiChat.signals.muteType', 'Mute type')}
                    </button>

                    <button
                      onClick={() => handleDismiss(n)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-200 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-200 dark:hover:bg-white/[0.10]"
                    >
                      <X size={14} />
                      {t('aiChat.signals.dismiss', 'Dismiss')}
                    </button>
                  </div>
                </div>
              );
            })
          )}

          {mutedTypes.length > 0 && (
            <div className="rounded-lg border border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-900 p-3 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-2 font-medium">
                <BellOff size={14} />
                <span>{t('aiChat.signals.mutedHint', 'Muted types:')}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {mutedTypes.slice(0, 8).map((tpe) => (
                  <span
                    key={tpe}
                    className="rounded-full bg-slate-200 dark:bg-white/[0.08] px-2 py-0.5 text-[11px]"
                  >
                    {tpe}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
