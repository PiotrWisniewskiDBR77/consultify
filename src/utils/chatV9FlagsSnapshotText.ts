/**
 * Chat V9 / ADMIN AG1 v1.2 — pure helpers for the flags snapshot
 * copy affordance.
 *
 * Two pieces, deliberately decoupled from the panel component:
 *
 *   1. `buildChatV9FlagSnapshotText()` — formats the current flag
 *      snapshot as a Markdown table. Deterministic, dependency-free,
 *      directly unit-testable. The panel renders the button; the
 *      helper decides what ends up on the clipboard.
 *
 *   2. `copyTextToClipboard(text)` — writes a string to the system
 *      clipboard using the modern async API with a hidden-textarea
 *      `document.execCommand('copy')` fallback for legacy browsers
 *      or non-secure contexts (e.g. `http://` admin tunnels).
 *
 * The format is intentionally human + grep friendly: owners usually
 * paste this blob into a Notion incident note or a GitHub issue, so
 * Markdown pipes are the right fit (both Notion and GitHub render
 * Markdown tables; Slack auto-collapses them gracefully).
 */

import {
  CHAT_V9_FLAGS,
  getChatV9FlagOverrideState,
  getChatV9FlagSnapshot,
} from './chatV9FeatureFlags';

export interface BuildSnapshotTextOptions {
  /**
   * Override clock. Tests pass a fixed `Date` so the header
   * timestamp is stable.
   */
  now?: Date;
  /** Optional label prepended to the blob (e.g. tenant slug). */
  label?: string;
}

function formatHeader(now: Date, label?: string): string {
  const iso = now.toISOString();
  const prefix = label ? `Chat V9 flags snapshot · ${label}` : 'Chat V9 flags snapshot';
  return `${prefix} · ${iso}`;
}

/**
 * Render a deterministic Markdown blob describing the current flag
 * state. Columns: ticket · id · block · state · override · default
 * · matches default · storage key.
 */
export function buildChatV9FlagSnapshotText(options: BuildSnapshotTextOptions = {}): string {
  const now = options.now ?? new Date();
  const snapshot = getChatV9FlagSnapshot();
  const snapshotById = new Map(snapshot.map((entry) => [entry.id, entry]));

  const header = formatHeader(now, options.label);
  const totalFlags = CHAT_V9_FLAGS.length;
  const overridesCount = snapshot.filter((entry) => !entry.matchesDefault).length;
  const summary = `${totalFlags} flag${totalFlags === 1 ? '' : 's'}, ${overridesCount} override${
    overridesCount === 1 ? '' : 's'
  }.`;

  if (totalFlags === 0) {
    return `${header}\n\nNo Chat V9 flags are registered.`;
  }

  const headerRow =
    '| Ticket | ID | Block | State | Override | Default | Matches default | Storage key |';
  const dividerRow = '|---|---|---|---|---|---|---|---|';

  const rows = CHAT_V9_FLAGS.map((flag) => {
    const entry = snapshotById.get(flag.id);
    const override = getChatV9FlagOverrideState(flag.id);
    const state = entry ? (entry.enabled ? 'on' : 'off') : '—';
    const overrideCell = override === null ? '—' : override;
    const defaultCell = flag.default ? 'on' : 'off';
    const matchesDefaultCell = entry ? (entry.matchesDefault ? 'yes' : 'no') : '—';
    return `| ${flag.ticket} | \`${flag.id}\` | ${flag.block} | ${state} | ${overrideCell} | ${defaultCell} | ${matchesDefaultCell} | \`${flag.keys.localStorage}\` |`;
  });

  return [header, '', summary, '', headerRow, dividerRow, ...rows].join('\n');
}

export type ClipboardWriteResult =
  | { ok: true; via: 'async' | 'execCommand' }
  | { ok: false; reason: 'unavailable' | 'denied' | 'failed' };

/**
 * Write `text` to the system clipboard. Tries the async Clipboard
 * API first (secure-context only), falls back to the synchronous
 * `document.execCommand('copy')` pattern when the async path is
 * unavailable. Catches and classifies all failures so the caller
 * can render a distinct "Copy failed" state.
 */
export async function copyTextToClipboard(text: string): Promise<ClipboardWriteResult> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return { ok: true, via: 'async' };
    } catch (err) {
      // Fall through to the execCommand path. Permissions-Policy
      // and insecure-context errors land here.
      const name = (err as { name?: string } | null)?.name;
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        const fallback = tryExecCommandCopy(text);
        if (fallback.ok) return fallback;
        return { ok: false, reason: 'denied' };
      }
    }
  }

  return tryExecCommandCopy(text);
}

function tryExecCommandCopy(text: string): ClipboardWriteResult {
  if (typeof document === 'undefined' || typeof document.execCommand !== 'function') {
    return { ok: false, reason: 'unavailable' };
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  // Keep the textarea out of the tab order and off-screen so it
  // never flashes a focus ring.
  textarea.style.position = 'fixed';
  textarea.style.top = '-1000px';
  textarea.style.left = '-1000px';
  textarea.style.opacity = '0';
  textarea.setAttribute('aria-hidden', 'true');
  textarea.setAttribute('tabindex', '-1');

  const previouslyFocused = document.activeElement as HTMLElement | null;
  document.body.appendChild(textarea);
  try {
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    const succeeded = document.execCommand('copy');
    if (!succeeded) return { ok: false, reason: 'failed' };
    return { ok: true, via: 'execCommand' };
  } catch {
    return { ok: false, reason: 'failed' };
  } finally {
    document.body.removeChild(textarea);
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
      try {
        previouslyFocused.focus();
      } catch {
        // Focus restoration is best-effort.
      }
    }
  }
}
