/**
 * Canvas view-mode persistence.
 *
 * The default mode became 'rich' (TipTap) after the editor overhaul. The key is
 * versioned to `.v2` so users who previously persisted 'md'/'document' under the
 * old key get the new 'rich' default ONCE, instead of being stuck on a stale
 * choice (which surfaced as the canvas showing raw markdown). Genuine choices
 * made afterwards still persist under the v2 key.
 */

import type { CanvasMode } from '@/types/canvasWorkspace';

export const VIEW_MODE_STORAGE_KEY = 'workCanvas.viewMode.v2';

export function getInitialCanvasMode(): CanvasMode {
  if (typeof window === 'undefined') return 'rich';
  try {
    const stored = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    if (stored === 'md') return 'md';
    if (stored === 'document') return 'document';
    if (stored === 'rich') return 'rich';
  } catch {
    // localStorage may be unavailable (private mode / SSR hydration race)
  }
  return 'rich';
}

export function persistCanvasMode(mode: CanvasMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  } catch {
    // ignore quota / availability errors — mode persistence is best-effort
  }
}
