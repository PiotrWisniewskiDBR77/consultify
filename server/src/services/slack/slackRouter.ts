/**
 * Slack Router — single outbound egress point for the whole app.
 *
 * Part of the "Slack Command Center" program (docs/plans/SLACK_COMMAND_CENTER_PLAN.md),
 * Filar 1. Every existing Slack sender is migrated behind this router (adapter,
 * without breaking call-sites) so that:
 *  - channel routing lives in ONE place (env per channel key),
 *  - we prefer the Slack Web API (bot token) so we get back `ts` (needed for
 *    threads/updates in F2/F3), falling back to Incoming Webhooks,
 *  - fallbacks are DIAGNOSABLE (we always log which transport+channel was used —
 *    today's fallbacks are silent, which the plan §2 Filar 1 calls out),
 *  - identical events are deduped/throttled,
 *  - it is fully fail-soft: it NEVER throws to the caller.
 */

import logger from '../../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export type SlackChannelKey = 'alerts' | 'feedback' | 'progress' | 'ai_ops';

export type SlackSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export type SlackTransport = 'bot' | 'webhook' | 'none';

export interface RouteToSlackEvent {
  channel: SlackChannelKey;
  severity?: SlackSeverity;
  title: string;
  text: string;
  blocks?: unknown[];
  /** Slack thread timestamp to reply into (Web API only). */
  threadTs?: string;
  /** When set, identical dedupeKeys are suppressed for DEDUPE_WINDOW_MS. */
  dedupeKey?: string;
  /**
   * Human category for the push notification headline (watch/phone), e.g.
   * "Błąd", "Pomysł", "Awaria", "Postęp", "Rejestracja". When set (with title),
   * the router builds a scannable first line `<emoji> <Kategoria> · <PRIO> · <title>`
   * so the notification is self-describing without opening Slack.
   */
  category?: string;
  /** Short priority/severity tag for the headline, e.g. "HIGH", "CRITICAL". */
  priorityLabel?: string;
}

// ==========================================
// NOTIFICATION HEADLINE (watch/phone friendly)
// ==========================================

/** Real Unicode emoji per category — render on watch/phone, unlike `:codes:`. */
function categoryEmoji(category: string | undefined, severity?: SlackSeverity): string {
  const c = (category || '').toLowerCase();
  if (c.includes('wdroż') || c.includes('wdroz') || c.includes('deploy') || c.includes('release'))
    return '🚀';
  if (c.includes('pilne') || c.includes('awaria') || c.includes('crash')) return '🚨';
  if (c.includes('ostrzeż') || c.includes('ostrze')) return '⚠️';
  if (c.includes('rozlicz') || c.includes('billing') || c.includes('płat')) return '💳';
  if (c.includes('błąd') || c.includes('blad') || c.includes('bug')) return '🐛';
  if (c.includes('pomysł') || c.includes('pomysl') || c.includes('idea')) return '💡';
  if (c.includes('feature') || c.includes('funkcj')) return '✨';
  if (c.includes('postęp') || c.includes('postep') || c.includes('progress')) return '📊';
  if (c.includes('rejestr') || c.includes('user') || c.includes('signup')) return '🙋';
  if (c.includes('status') || c.includes('workflow') || c.includes('wątek')) return '🔧';
  if (c.includes('odpowied') || c.includes('reply')) return '💬';
  if (c.includes('digest') || c.includes('raport')) return '📋';
  if (c.includes('ai') || c.includes('koszt')) return '🤖';
  // Fall back to severity signal.
  if (severity === 'CRITICAL') return '🚨';
  if (severity === 'WARNING') return '⚠️';
  return '🔔';
}

/** Remove Slack `:codes:` and markdown markers so a preview reads cleanly aloud. */
function stripForPreview(s: string): string {
  return String(s || '')
    .replace(/:[a-z0-9_+-]+:/gi, '')
    .replace(/[*_`>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Push-notification PREVIEW text — this is what a phone reads out / shows on the
 * lock screen (Slack uses the message `text` field as the notification fallback,
 * not the blocks). A natural sentence, not `·`-separated fragments, so TTS is
 * legible: `🐛 Błąd (HIGH): <tytuł> — <pierwsze zdanie opisu>`.
 */
function buildPreview(event: RouteToSlackEvent, body: string): string {
  const emoji = categoryEmoji(event.category, event.severity);
  const cat = stripForPreview(event.category || '');
  const prio = stripForPreview(event.priorityLabel || '');
  const title = stripForPreview(event.title || '');
  const snippet = stripForPreview(body).slice(0, 140);
  const head = `${cat}${prio ? ` (${prio})` : ''}${title ? `: ${title}` : ''}`.trim();
  return `${emoji} ${head}${snippet && snippet !== title ? ` — ${snippet}` : ''}`.trim();
}

/** Visual Block Kit for Slack itself (header + body). Preview stays in `text`. */
function buildAutoBlocks(event: RouteToSlackEvent, body: string): unknown[] {
  const emoji = categoryEmoji(event.category, event.severity);
  const cat = stripForPreview(event.category || '');
  const prio = stripForPreview(event.priorityLabel || '');
  const title = stripForPreview(event.title || '');
  const headerText = `${emoji} ${cat}${prio ? ` · ${prio}` : ''}`.trim().slice(0, 150);
  const blocks: unknown[] = [
    { type: 'header', text: { type: 'plain_text', text: headerText || 'Consultify', emoji: true } },
  ];
  if (title) blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `*${title}*` } });
  if (body && body.trim()) {
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: body.slice(0, 2900) } });
  }
  return blocks;
}

export interface RouteToSlackResult {
  ok: boolean;
  ts?: string;
  channelId?: string;
  transport: SlackTransport;
}

// ==========================================
// DEDUP / THROTTLE
// ==========================================

// In-memory dedupe map (dedupeKey -> lastSentAt ms). Mirrors the throttle
// pattern in server/src/services/systemAlertNotifier.ts. Cleared on restart —
// acceptable for alert-suppression (a restart implies "state changed").
const DEDUPE_WINDOW_MS = 30 * 60 * 1000; // 30 min
const dedupeMap = new Map<string, number>();

function isDuplicate(dedupeKey?: string): boolean {
  if (!dedupeKey) return false;
  const now = Date.now();
  const lastSentAt = dedupeMap.get(dedupeKey);
  if (typeof lastSentAt === 'number' && now - lastSentAt < DEDUPE_WINDOW_MS) {
    return true;
  }
  dedupeMap.set(dedupeKey, now);
  return false;
}

// ==========================================
// ENV RESOLUTION
// ==========================================

/** APP_ENV/NODE_ENV normalized to an env-var suffix, e.g. `PRODUCTION`. */
function envSuffix(): string {
  return String(process.env.APP_ENV || process.env.NODE_ENV || 'development')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_');
}

/** Read `${base}_${ENV}` first, then `${base}` — same resolver as slackService. */
function resolveEnv(base: string): string | undefined {
  const suffix = envSuffix();
  const scoped = process.env[`${base}_${suffix}`];
  if (typeof scoped === 'string' && scoped.trim().length > 0) return scoped.trim();
  const bare = process.env[base];
  if (typeof bare === 'string' && bare.trim().length > 0) return bare.trim();
  return undefined;
}

/** Bot channel id per channel key (env: SLACK_CHANNEL_<KEY>_ID). */
function resolveChannelId(channel: SlackChannelKey): string | undefined {
  const map: Record<SlackChannelKey, string> = {
    alerts: 'SLACK_CHANNEL_ALERTS_ID',
    feedback: 'SLACK_CHANNEL_FEEDBACK_ID',
    progress: 'SLACK_CHANNEL_PROGRESS_ID',
    ai_ops: 'SLACK_CHANNEL_AI_OPS_ID',
  };
  return resolveEnv(map[channel]);
}

/**
 * Webhook URL per channel key (fallback transport).
 * - alerts   -> SLACK_WEBHOOK_URL (env-scoped, matches slackService main)
 * - feedback -> SLACK_FEEDBACK_WEBHOOK_URL
 * - progress -> SLACK_PROGRESS_WEBHOOK_URL (new) -> SLACK_WEBHOOK_URL
 * - ai_ops   -> AI_OPS_SLACK_WEBHOOK_URL -> AI_SLACK_WEBHOOK_URL
 */
function resolveWebhookUrl(channel: SlackChannelKey): string | undefined {
  switch (channel) {
    case 'alerts':
      return resolveEnv('SLACK_WEBHOOK_URL');
    case 'feedback':
      return resolveEnv('SLACK_FEEDBACK_WEBHOOK_URL') || resolveEnv('SLACK_WEBHOOK_URL');
    case 'progress':
      return resolveEnv('SLACK_PROGRESS_WEBHOOK_URL') || resolveEnv('SLACK_WEBHOOK_URL');
    case 'ai_ops':
      return (
        resolveEnv('AI_OPS_SLACK_WEBHOOK_URL') ||
        resolveEnv('AI_SLACK_WEBHOOK_URL') ||
        resolveEnv('SLACK_WEBHOOK_URL')
      );
    default:
      return resolveEnv('SLACK_WEBHOOK_URL');
  }
}

function botToken(): string | undefined {
  return resolveEnv('SLACK_BOT_TOKEN');
}

// ==========================================
// TRANSPORTS
// ==========================================

const SLACK_POST_MESSAGE_URL = 'https://slack.com/api/chat.postMessage';

interface SlackApiResponse {
  ok?: boolean;
  ts?: string;
  channel?: string;
  error?: string;
}

/** Post via Slack Web API (bot token). Returns ts on success. */
async function postViaBot(
  event: RouteToSlackEvent,
  token: string,
  channelId: string
): Promise<RouteToSlackResult> {
  const body: Record<string, unknown> = {
    channel: channelId,
    text: event.text,
  };
  if (Array.isArray(event.blocks)) body.blocks = event.blocks;
  if (event.threadTs) body.thread_ts = event.threadTs;

  const response = await fetch(SLACK_POST_MESSAGE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const data = (await response.json().catch(() => ({}))) as SlackApiResponse;
  if (response.ok === false || data.ok === false) {
    logger.warn('[SlackRouter] Bot transport failed', {
      channel: event.channel,
      channelId,
      httpStatus: response.status,
      slackError: data.error,
    });
    return { ok: false, transport: 'bot', channelId };
  }

  logger.info('[SlackRouter] Sent via bot (Web API)', {
    channel: event.channel,
    channelId,
    ts: data.ts,
    severity: event.severity,
  });
  return { ok: true, ts: data.ts, channelId: data.channel || channelId, transport: 'bot' };
}

/** Post via Incoming Webhook (no ts returned by Slack for webhooks). */
async function postViaWebhook(
  event: RouteToSlackEvent,
  webhookUrl: string
): Promise<RouteToSlackResult> {
  const payload: Record<string, unknown> = { text: event.text };
  if (Array.isArray(event.blocks)) payload.blocks = event.blocks;

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (response.ok === false) {
    logger.warn('[SlackRouter] Webhook transport failed', {
      channel: event.channel,
      httpStatus: response.status,
    });
    return { ok: false, transport: 'webhook' };
  }

  logger.info('[SlackRouter] Sent via webhook', {
    channel: event.channel,
    severity: event.severity,
  });
  return { ok: true, transport: 'webhook' };
}

// ==========================================
// PUBLIC ENTRY
// ==========================================

/**
 * Route a single event to Slack. Bot-first, webhook fallback. Fail-soft.
 * Never throws — on any failure returns { ok: false, ... }.
 */
export async function routeToSlack(rawEvent: RouteToSlackEvent): Promise<RouteToSlackResult> {
  try {
    // Compose message. When a `category` is given we split the payload:
    //  - `text`  = natural-language PREVIEW (what the phone reads / shows on the
    //              lock screen — Slack uses `text` as the notification fallback),
    //  - `blocks` = pretty Block Kit for Slack itself (unless the caller passed
    //               its own blocks). This is what makes notifications legible on
    //               a watch/phone. Without a category the caller's text/blocks
    //               are sent verbatim (back-compat).
    const event: RouteToSlackEvent = rawEvent.category
      ? {
          ...rawEvent,
          text: buildPreview(rawEvent, rawEvent.text || ''),
          blocks: Array.isArray(rawEvent.blocks)
            ? rawEvent.blocks
            : buildAutoBlocks(rawEvent, rawEvent.text || ''),
        }
      : rawEvent;

    if (isDuplicate(event.dedupeKey)) {
      logger.debug('[SlackRouter] Deduped (within 30m window)', {
        channel: event.channel,
        dedupeKey: event.dedupeKey,
      });
      return { ok: false, transport: 'none' };
    }

    const token = botToken();
    const channelId = resolveChannelId(event.channel);

    // Transport (a): bot Web API when both token + channel id present.
    if (token && channelId) {
      try {
        const result = await postViaBot(event, token, channelId);
        if (result.ok) return result;
        // Bot configured but the call failed — fall through to webhook if any.
      } catch (err) {
        logger.warn('[SlackRouter] Bot transport threw, trying webhook fallback', {
          channel: event.channel,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Transport (b): webhook fallback.
    const webhookUrl = resolveWebhookUrl(event.channel);
    if (webhookUrl) {
      try {
        return await postViaWebhook(event, webhookUrl);
      } catch (err) {
        logger.warn('[SlackRouter] Webhook transport threw', {
          channel: event.channel,
          error: err instanceof Error ? err.message : String(err),
        });
        return { ok: false, transport: 'webhook' };
      }
    }

    // Neither transport is configured for this channel — diagnosable log.
    logger.warn('[SlackRouter] No transport configured for channel — message dropped', {
      channel: event.channel,
      hasBotToken: Boolean(token),
      hasChannelId: Boolean(channelId),
      severity: event.severity,
      title: event.title,
    });
    return { ok: false, transport: 'none' };
  } catch (err) {
    // Absolute fail-soft guard: never throw to caller.
    logger.error('[SlackRouter] Unexpected failure (fail-soft)', {
      channel: rawEvent.channel,
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, transport: 'none' };
  }
}

/** Test-only: clear the in-memory dedupe map. */
export function __resetDedupeForTests(): void {
  dedupeMap.clear();
}

export default { routeToSlack };
