/**
 * Chat V9 / VOICE VM3.2 — pure formatter for the "Copy legend"
 * clipboard payload on the voice-modes popover.
 *
 * What we emit
 * ------------
 * A Markdown-ish block users can paste into a Notion page, an
 * onboarding doc, or a Slack message so the voice-mode
 * explanation travels outside the product without a screenshot.
 *
 * Two layouts, mirroring the popover:
 *
 *   1. Two-mode (default):
 *
 *      ```
 *      Voice modes:
 *
 *      - Dictation — Speech fills the input field. You review the text and press send — nothing is sent automatically.
 *      - Conversation (live) — Continuous back-and-forth: each turn is transcribed and sent as soon as you pause. Tap the volume icon to stop the current read.
 *      ```
 *
 *   2. Unavailable (VM1-lite state):
 *
 *      ```
 *      Voice modes:
 *
 *      Voice is unavailable in this browser. Try Chrome or Edge on desktop, or Safari on iOS 15+. Microphone access must be allowed for this site.
 *      ```
 *
 * Design notes
 * ------------
 * - Deterministic and dependency-free. The caller passes the
 *   already-translated strings (headers + per-row `title` +
 *   `body`), so the helper never re-translates or re-humanises.
 * - Rendering rules:
 *     * The header line is always the payload `title` followed
 *       by a colon — same shape as the TRUST T-TR1.4 reasoning
 *       block so both clipboard payloads read like siblings.
 *     * Unavailable layout: one `<title>. <body>` sentence (we
 *       join with a period + space so a final period in the
 *       title is not mandatory). If `body` is empty after trim,
 *       only the `title` is emitted.
 *     * Two-mode layout: one `- <title> — <body>` line per mode;
 *       rows with an empty `title` OR empty `body` after trim
 *       are skipped (no numbered-list gap problem, but we still
 *       keep the filter to match VM3's own "never show an empty
 *       row" contract).
 *     * When both `unavailable` and `modes` are absent (or
 *       every mode is filtered out), the payload degrades to
 *       just the header + "No content recorded." stub so
 *       nothing lands silently on the clipboard.
 */

export interface VoiceLegendCopyUnavailable {
  title: string;
  body: string;
}

export interface VoiceLegendCopyMode {
  title: string;
  body: string;
}

export interface VoiceLegendCopyPayload {
  /** Popover title — rendered as `<title>:` on the first line. */
  title: string;
  /**
   * When present, the payload uses the single-row "voice is
   * unavailable" layout. Takes precedence over `modes` so the
   * copy always matches whatever the popover is showing.
   */
  unavailable?: VoiceLegendCopyUnavailable | null;
  /**
   * Two-mode layout. Ignored when `unavailable` is provided.
   * Rows with empty `title` / `body` are filtered out.
   */
  modes?: readonly VoiceLegendCopyMode[] | null;
}

function trimOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function renderUnavailable(unavailable: VoiceLegendCopyUnavailable): string {
  const title = trimOrEmpty(unavailable.title);
  const body = trimOrEmpty(unavailable.body);
  if (title && body) {
    const separator = /[.!?]$/.test(title) ? ' ' : '. ';
    return `${title}${separator}${body}`;
  }
  if (title) return title;
  if (body) return body;
  return '';
}

export function buildVoiceLegendCopyText(payload: VoiceLegendCopyPayload): string {
  const rawTitle = trimOrEmpty(payload?.title);
  const header = rawTitle.length > 0 ? `${rawTitle}:` : 'Voice modes:';

  if (payload?.unavailable) {
    const sentence = renderUnavailable(payload.unavailable);
    if (sentence) {
      return `${header}\n\n${sentence}`;
    }
    return `${header}\n\nNo content recorded.`;
  }

  const modes = Array.isArray(payload?.modes) ? payload.modes : [];
  const lines: string[] = [];
  for (const mode of modes) {
    if (!mode || typeof mode !== 'object') continue;
    const title = trimOrEmpty(mode.title);
    const body = trimOrEmpty(mode.body);
    if (!title || !body) continue;
    lines.push(`- ${title} — ${body}`);
  }

  if (lines.length === 0) {
    return `${header}\n\nNo content recorded.`;
  }

  return [header, '', ...lines].join('\n');
}
