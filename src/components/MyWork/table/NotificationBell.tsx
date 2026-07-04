/**
 * NotificationBell — Table Platform notification inbox (P7).
 *
 * Self-contained badge + dropdown. Polls the user's inbox for the unread count,
 * renders a compact list, and supports mark-read (single + all). Zero global UI
 * changes: styling is entirely via existing c-* tokens, matching StatusBar /
 * ActivityFeed conventions.
 */
import { Bell, Check, CheckCheck } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type TpNotification,
} from '../../../services/api/tablePlatform.api';

const POLL_INTERVAL = 30_000;

function relativeTime(ts: string, isPl: boolean): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return isPl ? 'teraz' : 'just now';
  if (mins < 60) return isPl ? `${mins} min temu` : `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return isPl ? `${hours} godz. temu` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return isPl ? `${days} dni temu` : `${days}d ago`;
}

function notificationLabel(n: TpNotification, isPl: boolean): string {
  const action = (n.payload?.action as string) ?? '';
  switch (n.type) {
    case 'mention':
      return isPl ? 'Wspomniano Cię w komentarzu' : 'You were mentioned in a comment';
    case 'record_changed':
      if (action === 'delete') return isPl ? 'Rekord usunięty' : 'Record deleted';
      return isPl ? 'Obserwowany rekord zmieniony' : 'Watched record changed';
    case 'watch':
      return isPl ? 'Aktualizacja obserwowanego rekordu' : 'Watched record update';
    default:
      return isPl ? 'Powiadomienie' : 'Notification';
  }
}

export const NotificationBell: React.FC = () => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<TpNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const res = await listNotifications({ limit: 20 });
      setNotifications(res.notifications);
      setUnreadCount(res.unreadCount);
    } catch {
      // Best-effort: leave prior state on transient failure.
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  // Poll for unread count (silent) even while the dropdown is closed.
  useEffect(() => {
    void refresh({ silent: true });
    const id = setInterval(() => void refresh({ silent: true }), POLL_INTERVAL);
    return () => clearInterval(id);
  }, [refresh]);

  // Refresh the full list when the dropdown opens.
  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleMarkRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id && !n.read_at ? { ...n, read_at: new Date().toISOString() } : n))
    );
    try {
      const res = await markNotificationRead(id);
      setUnreadCount(res.unreadCount);
    } catch {
      void refresh({ silent: true });
    }
  }, [refresh]);

  const handleMarkAll = useCallback(async () => {
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    setUnreadCount(0);
    try {
      await markAllNotificationsRead();
    } catch {
      void refresh({ silent: true });
    }
  }, [refresh]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center justify-center h-7 w-7 rounded-lg text-c-text-muted hover:text-c-text-secondary hover:bg-c-surface-raised transition-colors"
        aria-label={isPl ? 'Powiadomienia' : 'Notifications'}
        title={isPl ? 'Powiadomienia' : 'Notifications'}
      >
        <Bell size={15} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 flex items-center justify-center rounded-full bg-c-info text-white text-[9px] font-semibold leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 z-[200] w-80 bg-c-surface rounded-lg shadow-xl border border-c-border overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-c-border-subtle">
            <span className="text-xs font-semibold text-c-text">
              {isPl ? 'Powiadomienia' : 'Notifications'}
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAll}
                className="flex items-center gap-1 text-[11px] text-c-info hover:text-c-info/80 transition-colors"
              >
                <CheckCheck size={12} />
                {isPl ? 'Oznacz wszystkie' : 'Mark all read'}
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-c-text-muted">
                {isPl ? 'Ładowanie…' : 'Loading…'}
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-c-text-muted">
                {isPl ? 'Brak powiadomień' : 'No notifications'}
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-2 px-3 py-2 border-b border-c-border-subtle last:border-b-0 ${
                    n.read_at ? '' : 'bg-c-info/5'
                  }`}
                >
                  {!n.read_at && (
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-c-info flex-shrink-0" />
                  )}
                  <div className={`flex-1 min-w-0 ${n.read_at ? 'pl-3.5' : ''}`}>
                    <p className="text-xs text-c-text-secondary leading-snug">
                      {notificationLabel(n, isPl)}
                    </p>
                    <p className="text-[10px] text-c-text-muted mt-0.5">
                      {relativeTime(n.created_at, isPl)}
                    </p>
                  </div>
                  {!n.read_at && (
                    <button
                      type="button"
                      onClick={() => handleMarkRead(n.id)}
                      className="text-c-text-muted hover:text-c-info transition-colors flex-shrink-0"
                      title={isPl ? 'Oznacz jako przeczytane' : 'Mark as read'}
                    >
                      <Check size={13} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
