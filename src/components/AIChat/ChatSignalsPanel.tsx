import { BellOff, BookOpen, ChevronDown, Clock, MoreVertical, Sparkles, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';

/**
 * M01-012 — hierarchia akcji w wierszu sygnału.
 *
 * Wcześniej KAŻDY wiersz pokazywał pięć przycisków na tej samej głębokości
 * (zapis do Notatnika, zapis do Idei, drzemka, wyciszenie typu, odrzucenie).
 * Kanon (consultify-gestosc): DOKŁADNIE JEDNA widoczna akcja główna na wiersz,
 * reszta w kebabie. Menu jest w pełni klawiaturowe: Enter/Spacja otwiera,
 * Escape zamyka i ZWRACA FOKUS do przycisku otwierającego (bo inaczej fokus
 * ląduje na <body> i nawigacja klawiaturą się urywa).
 */
type SignalMenuItem = {
  id: string;
  label: string;
  icon: React.ElementType;
  onSelect: () => void;
  variant?: 'default' | 'danger';
};

const SignalActionsMenu: React.FC<{
  items: SignalMenuItem[];
  label: string;
  testId: string;
}> = ({ items, label, testId }) => {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  // Fokus wchodzi w menu po otwarciu (inaczej czytnik ekranu nie wie, że coś się stało).
  useEffect(() => {
    if (!open) return;
    itemRefs.current[0]?.focus();
  }, [open]);

  // Escape zamyka niezależnie od tego, gdzie w menu siedzi fokus.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close(true);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, close]);

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar' || e.key === 'ArrowDown') {
      // preventDefault: dla <button> Enter/Spacja i tak wygenerowałyby click,
      // co przełączyłoby menu drugi raz (otwórz→zamknij w jednym naciśnięciu).
      e.preventDefault();
      setOpen(true);
    }
  };

  const handleMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const focusables = itemRefs.current.filter(Boolean) as HTMLButtonElement[];
      if (focusables.length === 0) return;
      const currentIndex = focusables.indexOf(document.activeElement as HTMLButtonElement);
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      const nextIndex = (currentIndex + delta + focusables.length) % focusables.length;
      focusables[nextIndex]?.focus();
      return;
    }
    if (e.key === 'Tab') {
      close(false);
    }
  };

  return (
    <div className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        data-testid={testId}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={handleTriggerKeyDown}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-c-text-muted transition-colors hover:bg-c-surface-raised hover:text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
      >
        <MoreVertical size={16} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => close(false)} aria-hidden="true" />
          <div
            role="menu"
            aria-label={label}
            onKeyDown={handleMenuKeyDown}
            className="absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded-lg border border-c-border bg-c-surface py-1 shadow-lg"
          >
            {items.map((item, index) => {
              const Icon = item.icon;
              const isDanger = item.variant === 'danger';
              return (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  onClick={() => {
                    item.onSelect();
                    close(true);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-c-focus ${
                    isDanger
                      ? 'text-c-danger hover:bg-c-surface-raised'
                      : 'text-c-text-secondary hover:bg-c-surface-raised hover:text-c-text'
                  }`}
                >
                  <Icon size={14} className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

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

/** Ile sygnałów widać zanim użytkownik rozwinie resztę (M01-012). */
const COLLAPSED_SIGNAL_COUNT = 12;

const clampText = (s: string, max = 220) => {
  const str = String(s || '').trim();
  if (str.length <= max) return str;
  return `${str.slice(0, max - 1)}…`;
};

export const ChatSignalsPanel: React.FC<ChatSignalsPanelProps> = ({ open, onClose, projectId }) => {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(false);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [mutedTypes, setMutedTypes] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(false);
  // M01-P03 — honest failure state (CANON §4.1: no silent fail). A failed
  // fetch used to leave `signals` at its previous/empty value and rely on a
  // toast alone, so the panel body rendered the SAME "No signals right now."
  // as a genuine empty result — indistinguishable from a real error or from
  // a 401/403. `errorKind` lets the render branch tell the three apart.
  const [errorKind, setErrorKind] = useState<'none' | 'forbidden' | 'failed'>('none');

  const refresh = useCallback(async () => {
    setLoading(true);
    setErrorKind('none');
    try {
      const params = new URLSearchParams();
      params.set('limit', '50');
      if (projectId) params.set('projectId', projectId);
      const data = (await Api.get(`/my-work/signals?${params.toString()}`)) as any;
      setSignals(Array.isArray(data?.signals) ? data.signals : []);
      setMutedTypes(Array.isArray(data?.mutedTypes) ? data.mutedTypes : []);
      setExpanded(false);
      trackFunnelEvent('signal_feed_opened', { surface: 'chat-signals' });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to load signals:', e);
      // A toast alone disappears — the panel body must keep telling the
      // truth after it fades, and must not fall back to the empty-state
      // copy (that would claim "zero signals", not "could not check").
      const status = (e as { status?: number } | null)?.status;
      setErrorKind(status === 401 || status === 403 ? 'forbidden' : 'failed');
      setSignals([]);
      toast.error(t('aiChat.signals.loadFailed', 'Failed to load signals'));
    } finally {
      setLoading(false);
    }
  }, [t, projectId]);

  useEffect(() => {
    if (!open) return;
    refresh();
  }, [open, refresh]);

  /**
   * M01-012 — koniec z cichym obcinaniem.
   *
   * Zapytanie prosi o `limit=50`, a ekran pokazywał `slice(0, 12)`: sygnały
   * 13..50 były pobierane i po cichu wyrzucane, bez śladu w interfejsie.
   * Teraz 12 to tylko domyślne ZWINIĘCIE — reszta jest o jedno kliknięcie,
   * a licznik wprost mówi, ile jeszcze zostało.
   */
  const allSignals = useMemo(() => signals || [], [signals]);
  const visibleSignals = useMemo(() => {
    return expanded ? allSignals : allSignals.slice(0, COLLAPSED_SIGNAL_COUNT);
  }, [allSignals, expanded]);
  const hiddenCount = Math.max(0, allSignals.length - visibleSignals.length);

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
        toast.success(t('chat.signals.savedToIdeas', 'Saved to My Ideas'));
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to save to My Ideas:', e);
        toast.error(t('chat.signals.saveFailed', 'Save failed'));
      }
    },
    [t]
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
      toast.success(t('chat.signals.savedToNotebook', 'Saved to Notebook'));
    },
    [projectId, t]
  );

  const handleSnooze = useCallback(
    async (n: Signal, preset: '1h' | '4h' | 'tomorrow' | 'week') => {
      try {
        await Api.post(`/my-work/signals/${encodeURIComponent(n.key)}/snooze`, { preset });
        setSignals((prev) => prev.filter((x) => x.key !== n.key));
        trackFunnelEvent('signal_snoozed', { surface: 'chat-signals', signalKey: n.key, preset });
        toast.success(t('chat.signals.snoozed', 'Signal snoozed'));
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to snooze signal:', e);
        toast.error(t('chat.signals.snoozeFailed', 'Snooze failed'));
      }
    },
    [t]
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
        toast.success(t('chat.signals.typeMuted', 'Muted signal type'));
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to mute type:', e);
        toast.error(t('chat.signals.muteFailed', 'Mute failed'));
      }
    },
    [t]
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
        toast.error(t('chat.signals.dismissFailed', 'Dismiss failed'));
      }
    },
    [t]
  );

  if (!open) return null;

  return (
    <div
      id="chat-signals-panel"
      role="dialog"
      aria-modal="true"
      aria-label={t('aiChat.signals.title', 'Important signals')}
      className="fixed inset-0 z-50"
    >
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
          <div className="text-xs text-slate-500 dark:text-slate-400" data-testid="chat-signals-count">
            {loading
              ? t('common.loading', 'Loading...')
              : t('aiChat.signals.count', '{{count}} signals', { count: allSignals.length })}
          </div>
          <button
            onClick={() => refresh()}
            className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:underline"
          >
            {t('common.refresh', 'Refresh')}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {errorKind === 'forbidden' ? (
            <div
              role="alert"
              data-testid="chat-signals-forbidden"
              className="rounded-lg border border-c-border bg-c-surface-raised p-4 text-sm text-c-text"
            >
              {t(
                'aiChat.signals.forbidden',
                "You don't have permission to view signals for this project."
              )}
            </div>
          ) : errorKind === 'failed' ? (
            <div
              role="alert"
              data-testid="chat-signals-error"
              className="rounded-lg border border-c-border bg-c-surface-raised p-4 text-sm text-c-text"
            >
              <p>{t('aiChat.signals.errorState', "Couldn't check for signals right now.")}</p>
              <button
                type="button"
                onClick={() => refresh()}
                className="mt-2 text-xs font-medium text-c-text-secondary underline hover:text-c-text"
              >
                {t('common.retry', 'Retry')}
              </button>
            </div>
          ) : visibleSignals.length === 0 ? (
            <div
              data-testid="chat-signals-empty"
              className="rounded-lg border border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-900 p-4 text-sm text-slate-600 dark:text-slate-300"
            >
              {t('aiChat.signals.empty', 'No signals right now.')}
            </div>
          ) : (
            visibleSignals.map((n) => {
              return (
                <div
                  key={n.key}
                  className="rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-3"
                >
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    {n.title || t('aiChat.signals.untitled', 'Signal')}
                  </div>
                  {/* M01-P03 — every row used to print "No details" whenever the
                      body was empty, styled exactly like real body text: a
                      fabricated line that reads as "we checked, there's
                      nothing here" when the truth is simply "no body was
                      sent". An absent field is honestly represented by
                      absent UI, not by manufactured filler — omit the line
                      instead of asserting a hollow claim on every empty row. */}
                  {n.body && n.body.trim() ? (
                    <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                      {clampText(n.body)}
                    </div>
                  ) : null}

                  {(n.projectName || n.projectId) && (
                    <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                      {n.projectName ? n.projectName : n.projectId}
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-between gap-2">
                    {/* JEDNA akcja główna na wiersz — reszta w kebabie. */}
                    <button
                      type="button"
                      data-testid="chat-signal-primary-action"
                      onClick={() => handleSaveToNotebook(n)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-c-border bg-c-surface-raised px-2.5 py-1.5 text-xs font-semibold text-c-text transition-colors hover:bg-c-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                    >
                      <BookOpen size={14} />
                      {t('aiChat.signals.saveNotebook', 'Save to Notebook')}
                    </button>

                    <SignalActionsMenu
                      testId="chat-signal-actions-menu"
                      label={t('aiChat.signals.moreActions', 'More actions')}
                      items={[
                        {
                          id: 'save-ideas',
                          label: t('aiChat.signals.saveIdeas', 'Save to My Ideas'),
                          icon: BookOpen,
                          onSelect: () => handleSaveToIdeas(n),
                        },
                        {
                          id: 'snooze',
                          label: t('aiChat.signals.snooze', 'Snooze'),
                          icon: Clock,
                          onSelect: () => handleSnooze(n, '1h'),
                        },
                        {
                          id: 'mute-type',
                          label: t('aiChat.signals.muteType', 'Mute type'),
                          icon: BellOff,
                          onSelect: () => handleMuteType(n),
                        },
                        {
                          id: 'dismiss',
                          label: t('aiChat.signals.dismiss', 'Dismiss'),
                          icon: X,
                          onSelect: () => handleDismiss(n),
                          variant: 'danger',
                        },
                      ]}
                    />
                  </div>
                </div>
              );
            })
          )}

          {(hiddenCount > 0 || expanded) && allSignals.length > COLLAPSED_SIGNAL_COUNT && (
            <button
              type="button"
              data-testid="chat-signals-show-more"
              onClick={() => setExpanded((prev) => !prev)}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-c-border bg-c-surface px-3 py-2 text-xs font-semibold text-c-text-secondary transition-colors hover:bg-c-surface-raised hover:text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              aria-expanded={expanded}
            >
              <ChevronDown
                size={14}
                className={expanded ? 'rotate-180 transition-transform' : 'transition-transform'}
              />
              {expanded
                ? t('aiChat.signals.showLess', 'Show fewer signals')
                : `${t('aiChat.signals.showMore', 'Show more signals')} (${hiddenCount})`}
            </button>
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
