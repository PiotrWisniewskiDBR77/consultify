/**
 * Chat V9 / NAV NAV-M1.1 — "Back to chat" keyboard shortcut.
 *
 * Why this exists
 * ---------------
 * NAV-M1 ships a floating "Back to chat" pill on every non-chat
 * view that has an active conversation. The pill is discoverable
 * but slow for keyboard-first users. This headless component adds
 * a single global shortcut (Alt+Shift+C, macOS Option+Shift+C)
 * that triggers the same `returnToFullChat()` action.
 *
 * Shortcut rationale
 * ------------------
 *   - Alt+Shift+C is rare in the wild: Cmd/Ctrl+K is reserved for
 *     command palettes, Cmd/Ctrl+B for sidebars, Cmd/Ctrl+/ for
 *     comment toggle, Esc for modal close, and browser DevTools
 *     use Cmd+Opt+C / Ctrl+Shift+C. Alt+Shift+<letter> is the
 *     "application action" space and "C" mnemonic maps to "chat".
 *   - The listener never fires when the active element is an
 *     `<input>`, `<textarea>`, `[contenteditable]`, or when a
 *     modal has `aria-modal="true"` open anywhere in the tree —
 *     the shortcut cannot hijack typing or override a confirm.
 *   - The listener uses `keydown` with an explicit modifier check
 *     so a lone "c" keypress never matches.
 *
 * Emits `navigation_back_to_chat_shortcut` with a closed-enum
 * `fromView`. Telemetry failures never block navigation.
 */

import React, { useCallback, useEffect } from 'react';

import { trackFunnelEvent } from '@/services/funnelAnalytics';

import { useAppStore } from '../../store/useAppStore';
import { useConversationStore } from '../../store/useConversationStore';
import { AppView } from '../../types';
import { isBackToChatShortcutEnabled } from '../../utils/backToChatShortcutFlag';

const HIDDEN_VIEWS: ReadonlySet<AppView> = new Set([AppView.AI_CHAT, AppView.WELCOME]);

export interface BackToChatShortcutProps {
  /**
   * Test seam — lets unit tests force the enabled / disabled paths
   * without touching URL / localStorage / env. Production never sets.
   */
  isEnabled?: () => boolean;
}

// eslint-disable-next-line react-refresh/only-export-components
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target) return false;
  if (typeof Element === 'undefined' || !(target instanceof Element)) return false;

  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  const editable = target.getAttribute('contenteditable');
  if (editable === 'true' || editable === 'plaintext-only' || editable === '') return true;
  return false;
}

// eslint-disable-next-line react-refresh/only-export-components
export function hasOpenModal(doc: Document | null | undefined): boolean {
  if (!doc || typeof doc.querySelector !== 'function') return false;
  try {
    return doc.querySelector('[aria-modal="true"]') !== null;
  } catch {
    return false;
  }
}

// eslint-disable-next-line react-refresh/only-export-components
export function matchesShortcut(event: KeyboardEvent): boolean {
  if (!event.altKey || !event.shiftKey) return false;
  if (event.ctrlKey || event.metaKey) return false;
  const key = typeof event.key === 'string' ? event.key.toLowerCase() : '';
  // Alt+letter on some platforms produces a non-letter character
  // (e.g. Option+C → "ç" on macOS), so fall back to `event.code`.
  if (key === 'c') return true;
  if (event.code === 'KeyC') return true;
  return false;
}

export const BackToChatShortcut: React.FC<BackToChatShortcutProps> = ({
  isEnabled = isBackToChatShortcutEnabled,
}) => {
  const currentView = useAppStore((state) => state.currentView);
  const returnToFullChat = useAppStore((state) => state.returnToFullChat);
  const activeConversationId = useConversationStore((state) => state.activeConversationId);

  const handler = useCallback(
    (event: KeyboardEvent) => {
      if (!isEnabled()) return;
      if (!matchesShortcut(event)) return;
      if (HIDDEN_VIEWS.has(currentView)) return;
      if (!activeConversationId) return;
      if (typeof returnToFullChat !== 'function') return;
      if (isEditableTarget(event.target)) return;
      if (typeof document !== 'undefined' && hasOpenModal(document)) return;

      event.preventDefault();
      event.stopPropagation();

      try {
        trackFunnelEvent('navigation_back_to_chat_shortcut', {
          fromView: currentView,
        });
      } catch {
        // Telemetry is advisory — navigation is the primary effect.
      }

      returnToFullChat();
    },
    [activeConversationId, currentView, isEnabled, returnToFullChat]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
    };
  }, [handler]);

  return null;
};

export default BackToChatShortcut;
