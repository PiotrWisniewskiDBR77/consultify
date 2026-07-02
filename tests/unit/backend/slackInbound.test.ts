/**
 * Slack inbound — Slack Command Center, Filar 2 / F2.
 *
 * Covers:
 *  - HMAC-SHA256 signature verification: valid / wrong-secret / stale-timestamp
 *    (signatures computed for real, no mock of the crypto path);
 *  - url_verification → echoes challenge;
 *  - 503 fail-safe when SLACK_SIGNING_SECRET is unset;
 *  - slash `/consultify` → views.open called with the trigger_id;
 *  - view_submission → createFeedbackInternal called with source=slack and the
 *    Slack thread ts persisted back onto the ticket metadata.
 *
 * The router is mounted on a bare express app with a raw body parser,
 * mirroring the production body parser in server/src/index.ts (the signature is
 * over the exact raw bytes). DB, schema, feedback intake and the Slack router
 * are mocked.
 */
import crypto from 'node:crypto';

import express, { type Express } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// ── Feedback intake (the shared pipeline) ───────────────────────────────────
const mockCreateFeedbackInternal = vi.fn();
vi.mock('../../../server/src/routes/feedback.routes.js', () => ({
  createFeedbackInternal: (...a: unknown[]) => mockCreateFeedbackInternal(...a),
}));

// ── Slack outbound router ───────────────────────────────────────────────────
const mockRouteToSlack = vi.fn();
vi.mock('../../../server/src/services/slack/slackRouter.js', () => ({
  routeToSlack: (...a: unknown[]) => mockRouteToSlack(...a),
}));

// ── DB layer ────────────────────────────────────────────────────────────────
const mockDbGet = vi.fn();
const mockDbRun = vi.fn();
vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  get: (...a: unknown[]) => mockDbGet(...a),
  run: (...a: unknown[]) => mockDbRun(...a),
  all: vi.fn(),
}));

vi.mock('../../../server/src/utils/dbSchema.js', () => ({
  getTableColumns: vi.fn(async () => new Set<string>(['id', 'metadata_json', 'updated_at'])),
}));

import slackInboundRouter, {
  verifySlackSignature,
} from '../../../server/src/routes/slack/slackInbound.routes.js';

// ── Helpers ─────────────────────────────────────────────────────────────────
const SIGNING_SECRET = 'test-signing-secret';

function slackSign(secret: string, timestamp: string, rawBody: string): string {
  const base = `v0:${timestamp}:${rawBody}`;
  return 'v0=' + crypto.createHmac('sha256', secret).update(base).digest('hex');
}

function nowTs(): string {
  return String(Math.floor(Date.now() / 1000));
}

function createApp(): Express {
  const app = express();
  // Production mounts these routes against a RAW parser (see index.ts).
  app.use(express.raw({ type: '*/*' }));
  app.use('/api/slack', slackInboundRouter);
  return app;
}

/** POST a signed request the way Slack would. */
function signedPost(app: Express, path: string, rawBody: string, opts?: { timestamp?: string; secret?: string }) {
  const ts = opts?.timestamp ?? nowTs();
  const sig = slackSign(opts?.secret ?? SIGNING_SECRET, ts, rawBody);
  return request(app)
    .post(path)
    .set('x-slack-request-timestamp', ts)
    .set('x-slack-signature', sig)
    .set('Content-Type', 'application/x-www-form-urlencoded')
    .send(rawBody);
}

let savedEnv: Record<string, string | undefined> = {};
const ENV_KEYS = [
  'SLACK_SIGNING_SECRET',
  'SLACK_BOT_TOKEN',
  'SLACK_INBOUND_ORG_ID',
  'SLACK_INBOUND_FALLBACK_EMAIL',
];

beforeEach(() => {
  savedEnv = {};
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
  process.env.SLACK_SIGNING_SECRET = SIGNING_SECRET;
  process.env.SLACK_BOT_TOKEN = 'xoxb-test';
  delete process.env.SLACK_INBOUND_ORG_ID;
  delete process.env.SLACK_INBOUND_FALLBACK_EMAIL;

  vi.clearAllMocks();
  mockDbGet.mockResolvedValue({ id: 'user-1', organization_id: 'org-1' });
  mockDbRun.mockResolvedValue({ success: true, changes: 1, lastID: 1 });
  mockCreateFeedbackInternal.mockResolvedValue({
    feedbackId: 'fb-1234567890abcdef',
    taskId: 'task-1234567890',
    priority: 'medium',
    metadataJson: {},
    appEnv: 'test',
    organizationId: 'org-1',
    escalationPromise: Promise.resolve(),
  });
  mockRouteToSlack.mockResolvedValue({
    ok: true,
    ts: '1700000000.000100',
    channelId: 'C_FEEDBACK',
    transport: 'bot',
  });
  // fetch (views.open / response_url) — always ok.
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) })
  );
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  vi.unstubAllGlobals();
});

// ── Signature verification (pure) ───────────────────────────────────────────
describe('verifySlackSignature', () => {
  it('accepts a correctly signed, fresh request', () => {
    const ts = nowTs();
    const rawBody = 'payload=%7B%7D';
    const signature = slackSign(SIGNING_SECRET, ts, rawBody);
    expect(
      verifySlackSignature({ signingSecret: SIGNING_SECRET, timestamp: ts, signature, rawBody })
    ).toBe(true);
  });

  it('rejects a wrong signature (bad secret)', () => {
    const ts = nowTs();
    const rawBody = 'payload=%7B%7D';
    const signature = slackSign('WRONG-SECRET', ts, rawBody);
    expect(
      verifySlackSignature({ signingSecret: SIGNING_SECRET, timestamp: ts, signature, rawBody })
    ).toBe(false);
  });

  it('rejects a stale timestamp (>300s old)', () => {
    const staleTs = String(Math.floor(Date.now() / 1000) - 600);
    const rawBody = 'payload=%7B%7D';
    const signature = slackSign(SIGNING_SECRET, staleTs, rawBody);
    expect(
      verifySlackSignature({
        signingSecret: SIGNING_SECRET,
        timestamp: staleTs,
        signature,
        rawBody,
      })
    ).toBe(false);
  });
});

// ── 503 fail-safe ───────────────────────────────────────────────────────────
describe('POST /api/slack/* without SLACK_SIGNING_SECRET', () => {
  it('returns 503 (fail-safe, never accepts unverified input)', async () => {
    delete process.env.SLACK_SIGNING_SECRET;
    const app = createApp();
    const res = await request(app)
      .post('/api/slack/events')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ type: 'url_verification', challenge: 'abc' }));
    expect(res.status).toBe(503);
  });
});

// ── Events API ──────────────────────────────────────────────────────────────
describe('POST /api/slack/events', () => {
  it('echoes the challenge on url_verification', async () => {
    const app = createApp();
    const rawBody = JSON.stringify({ type: 'url_verification', challenge: 'chal-xyz' });
    const res = await signedPost(app, '/api/slack/events', rawBody);
    expect(res.status).toBe(200);
    expect(res.body.challenge).toBe('chal-xyz');
  });

  it('rejects a request with an invalid signature (401)', async () => {
    const app = createApp();
    const rawBody = JSON.stringify({ type: 'url_verification', challenge: 'chal-xyz' });
    const ts = nowTs();
    const res = await request(app)
      .post('/api/slack/events')
      .set('x-slack-request-timestamp', ts)
      .set('x-slack-signature', 'v0=deadbeef')
      .set('Content-Type', 'application/json')
      .send(rawBody);
    expect(res.status).toBe(401);
  });

  it('acks event_callback with 200', async () => {
    const app = createApp();
    const rawBody = JSON.stringify({ type: 'event_callback', event: { type: 'message' } });
    const res = await signedPost(app, '/api/slack/events', rawBody);
    expect(res.status).toBe(200);
  });
});

// ── Slash command → views.open ──────────────────────────────────────────────
describe('POST /api/slack/interactions — slash /consultify', () => {
  it('acks 200 and opens the modal via views.open with the trigger_id', async () => {
    const app = createApp();
    const params = new URLSearchParams({
      command: '/consultify',
      trigger_id: 'trigger-abc-123',
      text: 'logowanie pada',
      channel_id: 'C_SRC',
      user_id: 'U_PIOTR',
      user_name: 'piotr',
      response_url: 'https://hooks.slack.com/actions/resp',
    }).toString();

    const res = await signedPost(app, '/api/slack/interactions', params);
    expect(res.status).toBe(200);

    // views.open should have been called (fetch to the Slack Web API).
    const fetchMock = vi.mocked(fetch);
    const openCall = fetchMock.mock.calls.find((c) =>
      String(c[0]).includes('views.open')
    );
    expect(openCall).toBeTruthy();
    const openBody = JSON.parse(String((openCall![1] as RequestInit).body));
    expect(openBody.trigger_id).toBe('trigger-abc-123');
    expect(openBody.view.callback_id).toBe('consultify_report');
    // Slash trailing text prefills the description input.
    const descBlock = openBody.view.blocks.find((b: any) => b.block_id === 'description_block');
    expect(descBlock.element.initial_value).toBe('logowanie pada');
  });
});

// ── view_submission → feedback pipeline ─────────────────────────────────────
describe('POST /api/slack/interactions — view_submission', () => {
  function buildSubmissionPayload() {
    return {
      type: 'view_submission',
      user: { id: 'U_PIOTR', username: 'piotr' },
      view: {
        callback_id: 'consultify_report',
        private_metadata: JSON.stringify({
          channel_id: 'C_SRC',
          response_url: 'https://hooks.slack.com/actions/resp',
        }),
        state: {
          values: {
            type_block: { type: { selected_option: { value: 'BUG' } } },
            title_block: { title: { value: 'Logowanie pada' } },
            description_block: { description: { value: 'Klik login → 500' } },
            priority_block: { priority: { selected_option: { value: 'HIGH' } } },
            area_block: { area: { value: 'Auth' } },
          },
        },
      },
    };
  }

  it('acks clear, then creates feedback with source=slack and persists thread ts', async () => {
    const app = createApp();
    const params = new URLSearchParams({
      payload: JSON.stringify(buildSubmissionPayload()),
    }).toString();

    const res = await signedPost(app, '/api/slack/interactions', params);
    expect(res.status).toBe(200);
    expect(res.body.response_action).toBe('clear');

    // The detached handler runs after the ack — let microtasks settle.
    await new Promise((r) => setTimeout(r, 20));

    // createFeedbackInternal invoked with a slack-sourced payload.
    expect(mockCreateFeedbackInternal).toHaveBeenCalledTimes(1);
    const [intake, ctx] = mockCreateFeedbackInternal.mock.calls[0];
    expect(intake.type).toBe('BUG');
    expect(intake.title).toBe('Logowanie pada');
    expect(intake.severity).toBe('HIGH');
    expect(intake.metadata.source).toBe('slack');
    expect(intake.metadata.slack_user_id).toBe('U_PIOTR');
    // No JWT actor — Slack maps to the resolved fallback user.
    expect(intake.userId).toBe('user-1');
    expect(ctx).toEqual({});

    // Ticket posted to #cf-feedback and thread ts anchored back onto the ticket.
    expect(mockRouteToSlack).toHaveBeenCalledTimes(1);
    expect(mockRouteToSlack.mock.calls[0][0].channel).toBe('feedback');

    const updateCall = mockDbRun.mock.calls.find((c) =>
      String(c[0]).includes('UPDATE feedback_items')
    );
    expect(updateCall).toBeTruthy();
    const persistedMeta = JSON.parse(String(updateCall![1][0]));
    expect(persistedMeta.slack_thread_ts).toBe('1700000000.000100');
    expect(persistedMeta.slack_channel_id).toBe('C_FEEDBACK');
  });
});
