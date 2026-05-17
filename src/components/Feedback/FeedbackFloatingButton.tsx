/**
 * FeedbackFloatingButton
 *
 * Persistent bug-report entry point in the bottom-right corner of the app.
 * Clicking or pressing the hotkey (Shift+Ctrl+B / Shift+Meta+B on macOS)
 * opens the FeedbackSidePanel via the shared `activeSidePanel` store slot,
 * so there is a single source of truth for "is the feedback dialog open".
 *
 * Rendering:
 *  - Only visible for authenticated users (no floating CTA on login/public).
 *  - Hidden on `/superadmin/*` because the Superadmin feedback pipeline view
 *    is already the destination for bugs — button would be confusing there.
 *  - Gets temporarily hidden when the panel is open (the panel has its own
 *    close button).
 *
 * The button is intentionally thin on state — it reads from `useAppStore`
 * and triggers `toggleSidePanel('FEEDBACK')`.
 */

import { Bug } from 'lucide-react';
import React, { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

import { useAppStore } from '../../store/useAppStore';

const HOTKEY_HINT = 'Shift + Ctrl + B';

export const FeedbackFloatingButton: React.FC = () => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const currentUser = useAppStore((s) => s.currentUser);
  const activeSidePanel = useAppStore((s) => s.activeSidePanel);
  const toggleSidePanel = useAppStore((s) => s.toggleSidePanel);

  const isOnSuperadmin = pathname.startsWith('/superadmin');
  const isPanelOpen = activeSidePanel === 'FEEDBACK';
  const shouldRender = !!currentUser && !isOnSuperadmin && !isPanelOpen;

  const openPanel = useCallback(() => {
    if (activeSidePanel !== 'FEEDBACK') toggleSidePanel('FEEDBACK');
  }, [activeSidePanel, toggleSidePanel]);

  // Global hotkey: Shift+Ctrl+B (or Shift+Meta+B on macOS).
  // Ignores key events originating from text inputs / textareas / contenteditable
  // so typing "B" inside a form never triggers the dialog by accident.
  useEffect(() => {
    if (!currentUser) return;
    const handler = (ev: KeyboardEvent) => {
      const target = ev.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        const editable =
          tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
        if (editable) return;
      }
      const hasMeta = ev.ctrlKey || ev.metaKey;
      if (!hasMeta || !ev.shiftKey) return;
      if (ev.key.toLowerCase() !== 'b') return;
      ev.preventDefault();
      openPanel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentUser, openPanel]);

  if (!shouldRender) return null;

  const label = t('feedback.floatingButton.label', 'Zgłoś błąd');
  const ariaLabel = t('feedback.floatingButton.ariaLabel', 'Zgłoś błąd (Shift+Ctrl+B)');

  return (
    <button
      type="button"
      onClick={openPanel}
      aria-label={ariaLabel}
      title={`${label} · ${HOTKEY_HINT}`}
      data-feedback-redact
      className="fixed bottom-5 right-8 z-40 inline-flex items-center gap-2 rounded-full border border-amber-200/70 bg-white/90 px-3.5 py-2 text-xs font-semibold text-amber-700 shadow-md shadow-slate-950/10 backdrop-blur transition-all hover:scale-[1.02] hover:border-amber-400/80 hover:bg-amber-500 hover:text-white hover:shadow-lg hover:shadow-amber-500/20 active:scale-95 focus:outline-none focus:ring-2 focus:ring-amber-400/70 focus:ring-offset-2 focus:ring-offset-white dark:border-amber-300/20 dark:bg-navy-950/85 dark:text-amber-300 dark:shadow-black/25 dark:hover:border-amber-400/50 dark:hover:bg-amber-500 dark:hover:text-white dark:focus:ring-offset-navy-900"
    >
      <Bug size={14} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
};

export default FeedbackFloatingButton;
