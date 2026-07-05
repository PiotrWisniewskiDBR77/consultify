/**
 * Slack inbound — Slack App "Consultify" (Slack Command Center, Filar 2 / F2).
 *
 * Turns Slack into an external window onto the EXISTING feedback pipeline:
 *   /consultify slash command  → modal → view_submission
 *   message shortcut           → same modal (prefilled)  → view_submission
 *   view_submission            → createFeedbackInternal() → feedback_items
 *                                 → auto-task → escalation → thread anchor
 *
 * We do NOT build a second system: the modal submit reuses the same
 * `createFeedbackInternal` helper the in-app widget uses (see
 * server/src/routes/feedback.routes.ts), so a Slack report walks the identical
 * feedback_items → auto-task → triage path.
 *
 * SECURITY: every request is verified with Slack's signing secret
 * (`v0:{timestamp}:{rawBody}` HMAC-SHA256, timing-safe, ±300s window). The
 * route is mounted against a RAW body parser (see server/src/index.ts) because
 * the signature is over the exact bytes. Without SLACK_SIGNING_SECRET we
 * fail-safe with 503 rather than accepting unverified input.
 */

import crypto from 'node:crypto';

import { type NextFunction, type Request, type Response, Router } from 'express';

import {
  createFeedbackInternal,
  type FeedbackIntakeInput,
} from '../feedback.routes.js';
import { anchorSlackThread } from '../../services/slack/feedbackThreadAnchor.js';
import { routeToSlack } from '../../services/slack/slackRouter.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { get as dbGet } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

const router = Router();

const SLACK_VIEWS_OPEN_URL = 'https://slack.com/api/views.open';
const MODAL_CALLBACK_ID = 'consultify_report';
const MESSAGE_SHORTCUT_CALLBACK_ID = 'report_to_consultify';
const DEFAULT_FALLBACK_EMAIL = 'piotr.wisniewski@dbr77.com';

// ==========================================
// ENV
// ==========================================

function signingSecret(): string | undefined {
  const raw = process.env.SLACK_SIGNING_SECRET;
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : undefined;
}

function botToken(): string | undefined {
  const raw = process.env.SLACK_BOT_TOKEN;
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : undefined;
}

// ==========================================
// RAW BODY + SIGNATURE VERIFICATION
// ==========================================

/** The route is mounted with express.raw → req.body is a Buffer. */
function getRawBody(req: Request): string {
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  if (typeof req.body === 'string') return req.body;
  // Fallback (e.g. tests injecting a string): never re-serialize an object,
  // that would break the signature.
  return '';
}

/**
 * Verify Slack's request signature. Returns true only when the timestamp is
 * fresh (±300s) and the HMAC matches in constant time.
 */
export function verifySlackSignature(input: {
  signingSecret: string;
  timestamp: string;
  signature: string;
  rawBody: string;
  nowMs?: number;
}): boolean {
  const { signingSecret: secret, timestamp, signature, rawBody } = input;
  if (!secret || !timestamp || !signature) return false;

  const tsNum = Number(timestamp);
  if (!Number.isFinite(tsNum)) return false;
  const nowSec = Math.floor((input.nowMs ?? Date.now()) / 1000);
  if (Math.abs(nowSec - tsNum) > 300) return false;

  const base = `v0:${timestamp}:${rawBody}`;
  const expected = 'v0=' + crypto.createHmac('sha256', secret).update(base).digest('hex');

  const expectedBuf = Buffer.from(expected, 'utf8');
  const providedBuf = Buffer.from(signature, 'utf8');
  if (expectedBuf.length !== providedBuf.length) return false;
  try {
    return crypto.timingSafeEqual(expectedBuf, providedBuf);
  } catch {
    return false;
  }
}

/**
 * Express guard: 503 when the secret is unset (fail-safe), 401 on bad/old
 * signature. On success attaches the parsed raw body string to `res.locals`.
 */
export function slackVerifyMiddleware(req: Request, res: Response, next: NextFunction): void {
  const secret = signingSecret();
  if (!secret) {
    logger.error(
      '[SlackInbound] SLACK_SIGNING_SECRET not configured — refusing unverified Slack request (fail-safe 503)'
    );
    res.status(503).json({ error: 'Slack integration not configured' });
    return;
  }

  const timestamp = String(req.header('x-slack-request-timestamp') || '');
  const signature = String(req.header('x-slack-signature') || '');
  const rawBody = getRawBody(req);

  if (!verifySlackSignature({ signingSecret: secret, timestamp, signature, rawBody })) {
    logger.warn('[SlackInbound] Signature verification failed', {
      path: req.path,
      hasTimestamp: Boolean(timestamp),
      hasSignature: Boolean(signature),
    });
    res.status(401).json({ error: 'Invalid Slack signature' });
    return;
  }

  (res.locals as Record<string, unknown>).slackRawBody = rawBody;
  next();
}

// ==========================================
// PAYLOAD PARSERS
// ==========================================

/** Parse an x-www-form-urlencoded raw body into a flat record. */
function parseFormBody(rawBody: string): Record<string, string> {
  const out: Record<string, string> = {};
  const params = new URLSearchParams(rawBody);
  for (const [key, value] of params.entries()) out[key] = value;
  return out;
}

// ==========================================
// MODAL (BLOCK KIT)
// ==========================================

interface ModalPrivateMetadata {
  channel_id?: string;
  response_url?: string;
  message_ts?: string;
  permalink?: string;
  slack_user_id?: string;
  slack_username?: string;
}

/**
 * Build the "Report to Consultify" modal. `descriptionPrefill` seeds the
 * description input (slash trailing text or a shortcut's message text).
 */
function buildReportModal(input: {
  privateMetadata: ModalPrivateMetadata;
  descriptionPrefill?: string;
}): Record<string, unknown> {
  const descriptionBlock: Record<string, unknown> = {
    type: 'input',
    block_id: 'description_block',
    label: { type: 'plain_text', text: 'Opis' },
    element: {
      type: 'plain_text_input',
      action_id: 'description',
      multiline: true,
      max_length: 3000,
    },
  };
  if (input.descriptionPrefill && input.descriptionPrefill.trim().length > 0) {
    (descriptionBlock.element as Record<string, unknown>).initial_value = input.descriptionPrefill
      .trim()
      .slice(0, 3000);
  }

  return {
    type: 'modal',
    callback_id: MODAL_CALLBACK_ID,
    private_metadata: JSON.stringify(input.privateMetadata),
    title: { type: 'plain_text', text: 'Zgłoś do Consultify' },
    submit: { type: 'plain_text', text: 'Wyślij' },
    close: { type: 'plain_text', text: 'Anuluj' },
    blocks: [
      {
        type: 'input',
        block_id: 'type_block',
        label: { type: 'plain_text', text: 'Typ' },
        element: {
          type: 'static_select',
          action_id: 'type',
          initial_option: {
            text: { type: 'plain_text', text: 'Bug' },
            value: 'BUG',
          },
          options: [
            { text: { type: 'plain_text', text: 'Bug' }, value: 'BUG' },
            { text: { type: 'plain_text', text: 'Pomysł' }, value: 'IDEA' },
            { text: { type: 'plain_text', text: 'Feature' }, value: 'FEATURE' },
          ],
        },
      },
      {
        type: 'input',
        block_id: 'title_block',
        label: { type: 'plain_text', text: 'Tytuł' },
        element: {
          type: 'plain_text_input',
          action_id: 'title',
          max_length: 120,
        },
      },
      descriptionBlock,
      {
        type: 'input',
        block_id: 'priority_block',
        label: { type: 'plain_text', text: 'Priorytet' },
        element: {
          type: 'static_select',
          action_id: 'priority',
          initial_option: {
            text: { type: 'plain_text', text: 'MEDIUM' },
            value: 'MEDIUM',
          },
          options: [
            { text: { type: 'plain_text', text: 'LOW' }, value: 'LOW' },
            { text: { type: 'plain_text', text: 'MEDIUM' }, value: 'MEDIUM' },
            { text: { type: 'plain_text', text: 'HIGH' }, value: 'HIGH' },
            { text: { type: 'plain_text', text: 'CRITICAL' }, value: 'CRITICAL' },
          ],
        },
      },
      {
        type: 'input',
        block_id: 'area_block',
        optional: true,
        label: { type: 'plain_text', text: 'Obszar / moduł' },
        element: {
          type: 'plain_text_input',
          action_id: 'area',
          max_length: 120,
        },
      },
    ],
  };
}

/** Open a modal via views.open (Web API). Non-blocking; logs on failure. */
async function openModal(triggerId: string, view: Record<string, unknown>): Promise<void> {
  const token = botToken();
  if (!token) {
    logger.error('[SlackInbound] SLACK_BOT_TOKEN not configured — cannot open modal');
    return;
  }
  try {
    const response = await fetch(SLACK_VIEWS_OPEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ trigger_id: triggerId, view }),
    });
    const data = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!response.ok || !data.ok) {
      logger.warn('[SlackInbound] views.open failed', {
        httpStatus: response.status,
        slackError: data.error,
      });
    }
  } catch (err) {
    logger.warn('[SlackInbound] views.open threw', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** POST an ephemeral confirmation back to the slash/shortcut response_url. */
async function postToResponseUrl(responseUrl: string, text: string): Promise<void> {
  try {
    await fetch(responseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response_type: 'ephemeral', text }),
    });
  } catch (err) {
    logger.warn('[SlackInbound] response_url post threw', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ==========================================
// ACTOR MAPPING (Slack has no JWT)
// ==========================================

interface SlackActor {
  userId: string | null;
  organizationId: string | null;
}

/**
 * Map an inbound Slack request to a Consultify user/org. Slack does not carry
 * a JWT, so we route every Slack report to a single destination:
 *   - org: env SLACK_INBOUND_ORG_ID (preferred), else the org of the fallback
 *          user (SLACK_INBOUND_FALLBACK_EMAIL, default piotr.wisniewski@dbr77.com).
 *   - user: the fallback user (looked up by LOWER(email)).
 */
export async function resolveSlackActor(): Promise<SlackActor> {
  const fallbackEmail = (
    process.env.SLACK_INBOUND_FALLBACK_EMAIL || DEFAULT_FALLBACK_EMAIL
  )
    .trim()
    .toLowerCase();

  let userId: string | null = null;
  let organizationId: string | null =
    (process.env.SLACK_INBOUND_ORG_ID || '').trim() || null;

  try {
    const userRow = await dbGet<{ id?: string; organization_id?: string }>(
      `SELECT id, organization_id FROM users WHERE LOWER(email) = ? LIMIT 1`,
      [fallbackEmail]
    );
    if (userRow?.id) userId = String(userRow.id);
    if (!organizationId && userRow?.organization_id) {
      organizationId = String(userRow.organization_id);
    }
  } catch (err) {
    logger.warn('[SlackInbound] resolveSlackActor lookup failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return { userId, organizationId };
}

// ==========================================
// VIEW SUBMISSION → FEEDBACK
// ==========================================

interface SubmittedValues {
  type: 'BUG' | 'IDEA';
  rawType: string;
  title: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  area?: string;
}

/** Slack modal `type` allows FEATURE; the feedback schema only knows BUG/IDEA. */
function normalizeFeedbackType(rawType: string): 'BUG' | 'IDEA' {
  return String(rawType).toUpperCase() === 'BUG' ? 'BUG' : 'IDEA';
}

function extractSubmittedValues(view: any): SubmittedValues {
  const state = view?.state?.values || {};
  const rawType = String(
    state?.type_block?.type?.selected_option?.value || 'BUG'
  ).toUpperCase();
  const title = String(state?.title_block?.title?.value || '').trim().slice(0, 120);
  const description = String(state?.description_block?.description?.value || '').trim();
  const severity = String(
    state?.priority_block?.priority?.selected_option?.value || 'MEDIUM'
  ).toUpperCase() as SubmittedValues['severity'];
  const area = String(state?.area_block?.area?.value || '').trim() || undefined;
  return {
    type: normalizeFeedbackType(rawType),
    rawType,
    title,
    description,
    severity: (['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(severity)
      ? severity
      : 'MEDIUM') as SubmittedValues['severity'],
    area,
  };
}

/**
 * Create a feedback item from a submitted modal, reusing createFeedbackInternal,
 * then anchor the Slack thread (ts + channel) back onto the ticket metadata and
 * confirm to the reporter via response_url. Runs detached from the HTTP ack.
 */
export async function handleViewSubmission(payload: any): Promise<void> {
  let meta: ModalPrivateMetadata = {};
  try {
    meta = JSON.parse(String(payload?.view?.private_metadata || '{}')) as ModalPrivateMetadata;
  } catch {
    meta = {};
  }

  const values = extractSubmittedValues(payload?.view);
  const slackUserId = String(payload?.user?.id || meta.slack_user_id || '');
  const slackUsername = String(
    payload?.user?.username || payload?.user?.name || meta.slack_username || ''
  );

  const actor = await resolveSlackActor();

  const description =
    values.description ||
    values.title ||
    `Zgłoszenie ze Slacka (${slackUsername || slackUserId || 'nieznany'})`;

  const slackMeta: Record<string, unknown> = {
    source: 'slack',
    slack_user_id: slackUserId || undefined,
    slack_username: slackUsername || undefined,
    channel_id: meta.channel_id || undefined,
    slack_modal_type: values.rawType,
  };
  if (values.area) slackMeta.area = values.area;
  if (meta.permalink) slackMeta.slack_message_permalink = meta.permalink;
  if (meta.message_ts) slackMeta.slack_source_message_ts = meta.message_ts;

  const intake: FeedbackIntakeInput = {
    userId: actor.userId || undefined,
    type: values.type,
    title: values.title || undefined,
    message: description.slice(0, 5000),
    description: description.slice(0, 15000),
    severity: values.severity,
    workspaceContext: values.area ? values.area.slice(0, 1000) : undefined,
    metadata: slackMeta,
  };

  let feedbackId: string | null = null;
  let taskId: string | null = null;
  try {
    const result = await createFeedbackInternal(intake, {});
    feedbackId = result.feedbackId;
    taskId = result.taskId;
    // No wait needed: the escalation's metadata persist ('alertDispatch') and
    // this anchor ('slack_thread_ts') both use atomic per-key jsonb_set writes
    // (see updateFeedbackMetadataKey / anchorSlackThread), so they commute
    // regardless of completion order — the earlier read-modify-write race is gone.
  } catch (err) {
    logger.error('[SlackInbound] createFeedbackInternal failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    if (meta.response_url) {
      await postToResponseUrl(
        meta.response_url,
        '⚠️ Nie udało się utworzyć zgłoszenia. Spróbuj ponownie lub zgłoś w aplikacji.'
      );
    }
    return;
  }

  // Post the ticket into #cf-feedback via the router → capture ts + channelId
  // and anchor them on the ticket. This is the anchor for the F3 thread loop.
  try {
    const categoryLabel =
      values.rawType === 'BUG' ? 'Błąd' : values.rawType === 'FEATURE' ? 'Funkcja' : 'Pomysł';
    const routed = await routeToSlack({
      channel: 'feedback',
      severity:
        values.severity === 'CRITICAL'
          ? 'CRITICAL'
          : values.severity === 'HIGH'
            ? 'WARNING'
            : 'INFO',
      // Headline (watch/phone): `🐛 Błąd · HIGH · <tytuł>` — self-describing.
      category: categoryLabel,
      priorityLabel: values.severity !== 'MEDIUM' ? values.severity : undefined,
      title: values.title || description.slice(0, 80),
      text: `${description.slice(0, 500)}\n_zgłosił(a) ${slackUsername || slackUserId || 'Slack'} · ticket ${feedbackId}${taskId ? ` · task ${taskId}` : ''}_`,
    });

    if (routed.ok && routed.ts && feedbackId) {
      await anchorSlackThread(feedbackId, routed.channelId, routed.ts);
    }
  } catch (err) {
    logger.warn('[SlackInbound] routeToSlack (feedback channel) failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Confirm to the reporter (works without extra scopes).
  if (meta.response_url) {
    const shortId = feedbackId ? feedbackId.slice(0, 8) : '?';
    await postToResponseUrl(
      meta.response_url,
      `✅ Zgłoszenie #${shortId} przyjęte${taskId ? ` → task ${taskId.slice(0, 8)}` : ''}. Śledzenie: wątek na #cf-feedback.`
    );
  }
}

// ==========================================
// ROUTES
// ==========================================

/**
 * POST /api/slack/events — Slack Events API.
 * url_verification → echo challenge (unblocks Events URL config).
 * event_callback   → ack 200 (real event handling lands in F3).
 */
router.post(
  '/events',
  slackVerifyMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const rawBody = String((res.locals as Record<string, unknown>).slackRawBody || '');
    let body: any = {};
    try {
      body = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }

    if (body.type === 'url_verification') {
      return res.status(200).json({ challenge: body.challenge });
    }

    // event_callback (and everything else) — ack immediately; F3 handles events.
    return res.status(200).send('');
  })
);

/**
 * POST /api/slack/interactions — slash command + interactivity.
 * Slash `/consultify` arrives as form fields; interactivity (view_submission,
 * message_action) arrives as a `payload` form field holding a JSON string.
 */
router.post(
  '/interactions',
  slackVerifyMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const rawBody = String((res.locals as Record<string, unknown>).slackRawBody || '');
    const form = parseFormBody(rawBody);

    // --- Interactivity (has a `payload` JSON field) ---
    if (form.payload) {
      let payload: any = {};
      try {
        payload = JSON.parse(form.payload);
      } catch {
        return res.status(400).json({ error: 'Invalid interaction payload' });
      }

      // Modal submit → ack clear immediately, create feedback detached.
      if (payload.type === 'view_submission' && payload.view?.callback_id === MODAL_CALLBACK_ID) {
        void handleViewSubmission(payload);
        return res.status(200).json({ response_action: 'clear' });
      }

      // Message shortcut → open the same modal, prefilled with the message text.
      if (
        payload.type === 'message_action' &&
        payload.callback_id === MESSAGE_SHORTCUT_CALLBACK_ID
      ) {
        const messageText = String(payload?.message?.text || '').slice(0, 3000);
        const privateMetadata: ModalPrivateMetadata = {
          channel_id: payload?.channel?.id,
          response_url: payload?.response_url,
          message_ts: payload?.message?.ts || payload?.message_ts,
          slack_user_id: payload?.user?.id,
          slack_username: payload?.user?.username || payload?.user?.name,
        };
        const triggerId = String(payload?.trigger_id || '');
        // Ack first (3s limit); open modal after.
        res.status(200).send('');
        if (triggerId) {
          void openModal(
            triggerId,
            buildReportModal({ privateMetadata, descriptionPrefill: messageText })
          );
        }
        return;
      }

      // Unknown interaction — ack so Slack doesn't retry.
      return res.status(200).send('');
    }

    // --- Slash command `/consultify` ---
    if (form.command || form.trigger_id) {
      const triggerId = String(form.trigger_id || '');
      const prefill = String(form.text || '').trim();
      const privateMetadata: ModalPrivateMetadata = {
        channel_id: form.channel_id,
        response_url: form.response_url,
        slack_user_id: form.user_id,
        slack_username: form.user_name,
      };
      // Ack empty 200 immediately (3s limit); open modal non-blocking.
      res.status(200).send('');
      if (triggerId) {
        void openModal(
          triggerId,
          buildReportModal({ privateMetadata, descriptionPrefill: prefill })
        );
      }
      return;
    }

    return res.status(200).send('');
  })
);

export default router;
