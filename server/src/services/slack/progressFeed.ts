/**
 * Progress feed — batched work-activity stream to #cf-progress.
 *
 * Part of the "Slack Command Center" program
 * (docs/plans/SLACK_COMMAND_CENTER_PLAN.md), Filar 4 / F3.
 *
 * The notificationService already fans work events (TASK_ / INITIATIVE_ /
 * DECISION_ / GATE_ types) out to in_app/email/per-org-slack. This module is
 * an ADDITIONAL, GLOBAL feed: it buffers those events and flushes ONE
 * aggregated message to the router's `progress` channel every 15 minutes, so
 * the channel stays readable instead of dying like an #all- firehose.
 *
 * Anti-spam contract:
 *  - normal events buffer and flush as a single grouped digest every 15 min,
 *  - `urgent:true` (BLOCKED / CRITICAL) is sent immediately, on its own,
 *  - an empty buffer produces NO message,
 *  - the buffer is capped at MAX_ITEMS_SHOWN visible items ("+N więcej").
 *
 * Everything here is fail-soft: enqueue never throws to the caller, and a
 * flush failure is logged and swallowed (the router is itself fail-soft).
 */

import logger from '../../utils/Logger.js';
import { routeToSlack } from './slackRouter.js';

// ==========================================
// TYPES
// ==========================================

export interface ProgressEvent {
  /** Coarse bucket used for grouping in the digest header (e.g. TASK, INITIATIVE). */
  kind: string;
  /** One-line human summary, PL. */
  title: string;
  /** Optional extra context appended after an em-dash. */
  detail?: string;
  /** Owning org (informational only; the feed is global). */
  orgId?: string;
  /** When true, bypass the batch and send immediately (BLOCKED/CRITICAL). */
  urgent?: boolean;
}

// ==========================================
// CONFIG
// ==========================================

const FLUSH_INTERVAL_MS = 15 * 60 * 1000; // 15 min
/** Hard cap on how many individual items we render before "+N więcej". */
const MAX_ITEMS_SHOWN = 20;
/** Absolute buffer cap so a runaway loop can't grow memory unbounded. */
const MAX_BUFFER = 500;

// ==========================================
// STATE
// ==========================================

const buffer: ProgressEvent[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;

// ==========================================
// ENQUEUE
// ==========================================

/**
 * Buffer a work event for the next 15-min flush. `urgent` events are sent
 * immediately on their own. Fail-soft: never throws.
 */
export function enqueueProgressEvent(event: ProgressEvent): void {
  try {
    if (!event || typeof event.title !== 'string' || event.title.trim().length === 0) {
      return;
    }
    const normalized: ProgressEvent = {
      kind: String(event.kind || 'OTHER').toUpperCase(),
      title: event.title.trim().slice(0, 300),
      detail: event.detail ? String(event.detail).trim().slice(0, 300) : undefined,
      orgId: event.orgId || undefined,
      urgent: Boolean(event.urgent),
    };

    if (normalized.urgent) {
      // Fire-and-forget: immediate single-item send, doesn't touch the buffer.
      void sendUrgent(normalized);
      return;
    }

    if (buffer.length >= MAX_BUFFER) {
      // Drop oldest to bound memory; the "+N więcej" line still reflects volume
      // for the retained window.
      buffer.shift();
    }
    buffer.push(normalized);
  } catch (err) {
    logger.warn('[ProgressFeed] enqueueProgressEvent failed (fail-soft)', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ==========================================
// FORMATTING
// ==========================================

function formatItem(event: ProgressEvent): string {
  const detail = event.detail ? ` — ${event.detail}` : '';
  return `• ${event.title}${detail}`;
}

/** Group buffered events by `kind` and build the aggregated digest text. */
function buildBatchMessage(events: ProgressEvent[]): { title: string; text: string } {
  const counts = new Map<string, number>();
  for (const e of events) counts.set(e.kind, (counts.get(e.kind) || 0) + 1);

  const summary = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([kind, n]) => `${kind.toLowerCase()}: *${n}*`)
    .join(' · ');

  const lines: string[] = [];
  lines.push(':bar_chart: *Postępy (ostatnie 15 min)*');
  if (summary) lines.push(summary);
  lines.push('');

  const shown = events.slice(0, MAX_ITEMS_SHOWN);
  for (const e of shown) lines.push(formatItem(e));

  const remaining = events.length - shown.length;
  if (remaining > 0) lines.push(`… +${remaining} więcej`);

  return {
    title: 'Postępy (15 min)',
    text: lines.join('\n'),
  };
}

// ==========================================
// SEND
// ==========================================

async function sendUrgent(event: ProgressEvent): Promise<void> {
  try {
    const detail = event.detail ? `\n${event.detail}` : '';
    await routeToSlack({
      channel: 'progress',
      severity: 'CRITICAL',
      title: event.title,
      text: `:rotating_light: *${event.kind}* — ${event.title}${detail}`,
    });
  } catch (err) {
    logger.warn('[ProgressFeed] urgent send failed (fail-soft)', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Flush the current buffer as ONE aggregated message. No-op on an empty
 * buffer. Exported for tests and manual smoke. Fail-soft.
 */
export async function flushProgressNow(): Promise<void> {
  if (buffer.length === 0) return;
  // Drain synchronously so concurrent enqueues start a fresh window.
  const drained = buffer.splice(0, buffer.length);
  try {
    const { title, text } = buildBatchMessage(drained);
    await routeToSlack({
      channel: 'progress',
      severity: 'INFO',
      title,
      text,
    });
  } catch (err) {
    logger.warn('[ProgressFeed] flush failed (fail-soft)', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ==========================================
// SCHEDULER
// ==========================================

/**
 * Idempotent bootstrap. Starts the 15-min flush interval (unref-ed so it never
 * keeps the process alive). No-op under NODE_ENV=test.
 */
export function startProgressFeed(): void {
  if (process.env.NODE_ENV === 'test') return;
  if (flushTimer) return;
  flushTimer = setInterval(() => {
    void flushProgressNow();
  }, FLUSH_INTERVAL_MS);
  if (typeof flushTimer.unref === 'function') flushTimer.unref();
  logger.info('[ProgressFeed] Started (flush every 15 min).');
}

// ==========================================
// TEST HELPERS
// ==========================================

/** Test-only: current buffer length. */
export function __bufferLengthForTests(): number {
  return buffer.length;
}

/** Test-only: clear the buffer. */
export function __resetProgressFeedForTests(): void {
  buffer.length = 0;
}

export default { enqueueProgressEvent, flushProgressNow, startProgressFeed };
