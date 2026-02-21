import { BellOff, BookOpen, Clock, Sparkles, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { useNotificationSnooze, type SnoozePreset } from '@/hooks/useNotificationSnooze';
import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';
import {
  getMutedNotificationTypes,
  isNotificationTypeMuted,
  muteNotificationTypeForSession,
  NOTIFICATION_MUTE_SESSION_CHANGED_EVENT,
} from '@/utils/notificationMuteSession';
import { createNotebookPage } from '@/utils/notebookStorage';

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  body?: string;
  severity?: 'INFO' | 'WARNING' | 'CRITICAL';
  createdAt?: string;
  projectId?: string;
  projectName?: string;
  data?: Record<string, unknown>;
};

interface ChatSignalsPanelProps {
  open: boolean;
  onClose: () => void;
  projectId?: string | null;
}

const isAiSignal = (n: Notification) => {
  const t = String(n.type || '').toUpperCase();
  return t.includes('AI') || t.includes('RECOMMENDATION') || t.includes('INSIGHT') || t.includes('RISK');
};

const clampText = (s: string, max = 220) => {
  const str = String(s || '').trim();
  if (str.length <= max) return str;
  return `${str.slice(0, max - 1)}…`;
};

export const ChatSignalsPanel: React.FC<ChatSignalsPanelProps> = ({ open, onClose, projectId }) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const { currentUser } = useAppStore();
  const { snooze, isSnoozed, formatRemainingTime } = useNotificationSnooze();

  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [mutedTypes, setMutedTypes] = useState<string[]>(() => getMutedNotificationTypes());

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await Api.getNotifications(false, 50);
      setNotifications(Array.isArray(data) ? data : []);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to load signals:', e);
      toast.error(t('aiChat.signals.loadFailed', 'Failed to load signals'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!open) return;
    refresh();
  }, [open, refresh]);

  useEffect(() => {
    const handler = () => setMutedTypes(getMutedNotificationTypes());
    window.addEventListener(NOTIFICATION_MUTE_SESSION_CHANGED_EVENT, handler as any);
    return () => window.removeEventListener(NOTIFICATION_MUTE_SESSION_CHANGED_EVENT, handler as any);
  }, []);

  const visibleSignals = useMemo(() => {
    const list = notifications
      .filter((n) => isAiSignal(n))
      .filter((n) => !isNotificationTypeMuted(n.type))
      .filter((n) => !isSnoozed(n.id));

    // Light context filter: prefer matching project if available.
    const withProject =
      projectId && projectId.trim()
        ? list.filter((n) => !n.projectId || n.projectId === projectId)
        : list;

    return withProject.slice(0, 12);
  }, [notifications, projectId, isSnoozed]);

  const handleSaveToIdeas = useCallback(
    async (n: Notification) => {
      try {
        const title = n.title || t('aiChat.signals.untitled', 'Signal');
        const body = `${n.message || n.body || ''}`.trim();
        const tags = n.projectName ? [String(n.projectName).trim()].filter(Boolean) : [];
        await Api.createMyIdea({
          title,
          body: body ? clampText(body, 1200) : undefined,
          tags,
          sourceType: 'signal',
          sourceConversationId: null,
          sourceMessageId: null,
        });
        toast.success(
          isPolish ? 'Zapisano do My Ideas' : 'Saved to My Ideas'
        );
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to save to My Ideas:', e);
        toast.error(isPolish ? 'Nie udało się zapisać' : 'Save failed');
      }
    },
    [isPolish, t]
  );

  const handleSaveToNotebook = useCallback(
    async (n: Notification) => {
      const userId = currentUser?.id || 'anonymous';
      const title = n.title || t('aiChat.signals.untitled', 'Signal');
      const body = `${n.message || n.body || ''}`.trim();
      const tags = n.projectName ? [String(n.projectName).trim()].filter(Boolean) : [];
      createNotebookPage(userId, {
        title,
        projectId: n.projectId || projectId || null,
        visibility: n.projectId || projectId ? 'project' : 'private',
        tags,
        contentText: body,
        contentJson: {
          type: 'doc',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: body || '' }] },
          ],
        },
      });
      toast.success(isPolish ? 'Zapisano do Notebook' : 'Saved to Notebook');
    },
    [currentUser?.id, isPolish, projectId, t]
  );

  const handleSnooze = useCallback(
    (n: Notification, preset: SnoozePreset) => {
      snooze(n.id, preset, 'chat-signals');
      toast.success(isPolish ? 'Wyciszono sygnał' : 'Signal snoozed');
    },
    [snooze, isPolish]
  );

  const handleMuteType = useCallback(
    (n: Notification) => {
      const type = String(n.type || '').toUpperCase();
      if (!type) return;
      muteNotificationTypeForSession(type);
      toast.success(isPolish ? 'Wyciszono typ sygnału (sesja)' : 'Muted signal type (session)');
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
              const snoozedLabel = formatRemainingTime(n.id, isPolish);
              return (
                <div
                  key={n.id}
                  className="rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-3"
                >
                  <div className="text-sm font-medium text-slate-900 dark:text-white">
                    {n.title || t('aiChat.signals.untitled', 'Signal')}
                  </div>
                  <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                    {clampText(n.message || n.body || '') || t('aiChat.signals.noDetails', 'No details')}
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
                      title={snoozedLabel ? (isPolish ? `Wyciszone: ${snoozedLabel}` : `Snoozed: ${snoozedLabel}`) : undefined}
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
                  </div>
                </div>
              );
            })
          )}

          {mutedTypes.length > 0 && (
            <div className="rounded-lg border border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-900 p-3 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-2 font-medium">
                <BellOff size={14} />
                <span>{t('aiChat.signals.mutedHint', 'Muted types (this session):')}</span>
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

