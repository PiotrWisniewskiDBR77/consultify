/**
 * Chat V9 / VOICE VM3.1 — voice-modes legend keyboard shortcut.
 *
 * Why this exists
 * ---------------
 * VM3 ships a `?` affordance inside `EnhancedChatInput` that
 * opens the voice-modes legend popover. The button is
 * discoverable once the input is focused, but keyboard-first
 * users who want to recheck "what does live mode do again?"
 * mid-conversation have to hunt for the button. This headless
 * component adds a single global chord (Alt+Shift+V, macOS
 * Option+Shift+V) that tells every mounted `VoiceModeLegend`
 * instance to open its popover via a `CustomEvent`.
 *
 * Shortcut rationale
 * ------------------
 *   - Alt+Shift+V is rare in the wild: `Cmd+V` is paste,
 *     `Cmd+Shift+V` is paste-without-formatting, browsers use
 *     Alt+V for the View menu on Windows. Alt+Shift+<letter> is
 *     the "application action" space, and "V" maps to "voice".
 *   - Paired with NAV-M1.1 (Alt+Shift+C → back to chat) this
 *     starts a consistent Alt+Shift+<letter> family: easy to
 *     teach, trivially extensible.
 *   - Listener short-circuits when focus is inside an editable
 *     element or when a modal (`aria-modal="true"`) is open, so
 *     it can never hijack typing or stomp on a confirm dialog.
 *   - The listener uses `keydown` with explicit modifier checks,
 *     so a lone "v" or `Ctrl+V` (paste) never triggers.
 *
 * Telemetry: emits `voice_mode_legend_shortcut` through
 * `trackFunnelEvent`. Payload is empty (symmetric with the
 * existing `voice_mode_legend_opened` event). Failures never
 * block the CustomEvent dispatch.
 *
 * Note: we do NOT dispatch the event if no `VoiceModeLegend` is
 * actually mounted — but detecting that reliably is a layering
 * violation (the shortcut would need to know about every
 * instance). Instead we dispatch unconditionally: a no-listener
 * dispatch is free and the legend's own `isEnabled()` gate still
 * holds, so a disabled VM3 flag keeps the popover closed.
 */

import React, { useCallback, useEffect } from 'react';

import { trackFunnelEvent } from '@/services/funnelAnalytics';

import {
  isVoiceLegendShortcutEnabled,
  VOICE_LEGEND_OPEN_EVENT,
} from '../../utils/voiceLegendShortcutFlag';

export interface VoiceLegendShortcutProps {
  /**
   * Test seam — lets unit tests force the enabled / disabled paths
   * deterministically. Production callers never pass this.
   */
  isEnabled?: () => boolean;
}

// eslint-disable-next-line react-refresh/only-export-components
export function matchesVoiceLegendShortcut(event: KeyboardEvent): boolean {
  if (!event.altKey || !event.shiftKey) return false;
  if (event.ctrlKey || event.metaKey) return false;
  const key = typeof event.key === 'string' ? event.key.toLowerCase() : '';
  if (key === 'v') return true;
  // Option+V on macOS produces a non-letter glyph ("√"), so fall
  // back to `event.code` for platform-independent matching.
  if (event.code === 'KeyV') return true;
  return false;
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

export const VoiceLegendShortcut: React.FC<VoiceLegendShortcutProps> = ({
  isEnabled = isVoiceLegendShortcutEnabled,
}) => {
  const handler = useCallback(
    (event: KeyboardEvent) => {
      if (!isEnabled()) return;
      if (!matchesVoiceLegendShortcut(event)) return;
      if (isEditableTarget(event.target)) return;
      if (typeof document !== 'undefined' && hasOpenModal(document)) return;

      event.preventDefault();
      event.stopPropagation();

      try {
        trackFunnelEvent('voice_mode_legend_shortcut', {});
      } catch {
        // Telemetry is advisory; the popover open is the primary
        // side effect users care about.
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(VOICE_LEGEND_OPEN_EVENT));
      }
    },
    [isEnabled]
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

export default VoiceLegendShortcut;
