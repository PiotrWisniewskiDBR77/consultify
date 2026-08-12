/**
 * slackRouter — central Slack egress (Slack Command Center, Filar 1).
 *
 * Covers: bot-first transport selection, webhook fallback, `ts` returned from
 * the bot Web API, 30-min dedupe window, fail-soft on transport errors, and
 * channel -> env mapping (feedback/progress/ai_ops fallbacks).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import {
  routeToSlack,
  __resetDedupeForTests,
  __resetDurableDedupeForTests,
} from '../../../server/src/services/slack/slackRouter.js';

// Snapshot & restore env between tests so channel/token mapping is isolated.
const SLACK_ENV_KEYS = [
  'SLACK_BOT_TOKEN',
  'SLACK_CHANNEL_ALERTS_ID',
  'SLACK_CHANNEL_FEEDBACK_ID',
  'SLACK_CHANNEL_PROGRESS_ID',
  'SLACK_CHANNEL_AI_OPS_ID',
  'SLACK_WEBHOOK_URL',
  'SLACK_FEEDBACK_WEBHOOK_URL',
  'SLACK_PROGRESS_WEBHOOK_URL',
  'AI_OPS_SLACK_WEBHOOK_URL',
  'AI_SLACK_WEBHOOK_URL',
  'SLACK_DISABLED_STAGING',
  'SLACK_DISABLED_TEST',
  'APP_ENV',
  'NODE_ENV',
];

let savedEnv: Record<string, string | undefined> = {};

function clearSlackEnv() {
  for (const key of SLACK_ENV_KEYS) delete process.env[key];
}

function mockFetchOk(json: Record<string, unknown>, httpOk = true) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: httpOk,
    status: httpOk ? 200 : 500,
    json: async () => json,
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(async () => {
  savedEnv = {};
  for (const key of SLACK_ENV_KEYS) savedEnv[key] = process.env[key];
  clearSlackEnv();
  // Neutral env so resolver suffix is deterministic.
  process.env.NODE_ENV = 'test';
  await __resetDurableDedupeForTests();
  vi.clearAllMocks();
});

afterEach(() => {
  for (const key of SLACK_ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  vi.unstubAllGlobals();
});

describe('slackRouter.routeToSlack', () => {
  it('prefers the bot transport when SLACK_BOT_TOKEN + channel id are present, and returns ts', async () => {
    process.env.SLACK_BOT_TOKEN = 'xoxb-test';
    process.env.SLACK_CHANNEL_ALERTS_ID = 'C_ALERTS';
    // A webhook is ALSO present — must NOT be used because bot wins.
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/should-not-be-used';

    const fetchMock = mockFetchOk({ ok: true, ts: '1700000000.000100', channel: 'C_ALERTS' });

    const result = await routeToSlack({
      channel: 'alerts',
      severity: 'CRITICAL',
      title: 'DB down',
      text: 'Database unreachable',
    });

    expect(result).toEqual({
      ok: true,
      ts: '1700000000.000100',
      channelId: 'C_ALERTS',
      transport: 'bot',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://slack.com/api/chat.postMessage');
    expect(init.headers.Authorization).toBe('Bearer xoxb-test');
    const body = JSON.parse(init.body);
    expect(body.channel).toBe('C_ALERTS');
    expect(body.text).toBe('Database unreachable');
  });

  it('builds a natural PREVIEW (text) + Block Kit when category is provided', async () => {
    process.env.SLACK_BOT_TOKEN = 'xoxb-test';
    process.env.SLACK_CHANNEL_FEEDBACK_ID = 'C_FB';
    const fetchMock = mockFetchOk({ ok: true, ts: '1.2', channel: 'C_FB' });

    await routeToSlack({
      channel: 'feedback',
      category: 'Błąd',
      priorityLabel: 'HIGH',
      // Title carries Slack markup + :emoji: codes that must be stripped from the
      // notification preview so the phone reads it cleanly.
      title: ':bug: *M15 Rezultaty: wykresy nie renderują się*',
      text: 'Szczegóły zgłoszenia w treści',
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    // `text` = the notification PREVIEW the phone reads: a natural sentence
    // (emoji + category (priority): title — body snippet), no markdown/codes.
    expect(body.text).toBe(
      '🐛 Błąd (HIGH): M15 Rezultaty: wykresy nie renderują się — Szczegóły zgłoszenia w treści'
    );
    // Visual Block Kit is auto-built (header + title + body) for Slack itself.
    expect(Array.isArray(body.blocks)).toBe(true);
    expect(body.blocks[0].type).toBe('header');
    expect(String(body.blocks[0].text.text)).toContain('Błąd');
  });

  it('sends the caller text verbatim when no category (back-compat)', async () => {
    process.env.SLACK_BOT_TOKEN = 'xoxb-test';
    process.env.SLACK_CHANNEL_ALERTS_ID = 'C_ALERTS';
    const fetchMock = mockFetchOk({ ok: true, ts: '1.2', channel: 'C_ALERTS' });
    await routeToSlack({ channel: 'alerts', title: 'x', text: 'raw body only' });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).text).toBe('raw body only');
  });

  it('passes thread_ts to the bot API when threadTs is provided', async () => {
    process.env.SLACK_BOT_TOKEN = 'xoxb-test';
    process.env.SLACK_CHANNEL_FEEDBACK_ID = 'C_FB';
    const fetchMock = mockFetchOk({ ok: true, ts: '111.222', channel: 'C_FB' });

    await routeToSlack({
      channel: 'feedback',
      title: 'reply',
      text: 'status changed',
      threadTs: '999.888',
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.thread_ts).toBe('999.888');
  });

  it('falls back to the webhook transport when no bot token/channel id is configured', async () => {
    process.env.SLACK_PROGRESS_WEBHOOK_URL = 'https://hooks.slack.com/services/progress';
    const fetchMock = mockFetchOk({}, true);

    const result = await routeToSlack({
      channel: 'progress',
      title: 'New signup',
      text: 'Someone registered',
    });

    expect(result.transport).toBe('webhook');
    expect(result.ok).toBe(true);
    expect(result.ts).toBeUndefined(); // webhooks never return ts
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://hooks.slack.com/services/progress');
  });

  it('falls back to webhook when bot API returns ok:false', async () => {
    process.env.SLACK_BOT_TOKEN = 'xoxb-test';
    process.env.SLACK_CHANNEL_ALERTS_ID = 'C_ALERTS';
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/alerts';

    const fetchMock = vi
      .fn()
      // 1st call: bot API fails logically
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: false, error: 'channel_not_found' }) })
      // 2nd call: webhook succeeds
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);

    const result = await routeToSlack({ channel: 'alerts', title: 't', text: 'x' });

    expect(result.transport).toBe('webhook');
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('dedupes identical dedupeKey within the 30-min window', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/alerts';
    const fetchMock = mockFetchOk({}, true);

    const first = await routeToSlack({
      channel: 'alerts',
      title: 'flap',
      text: 'again',
      dedupeKey: 'same-key',
    });
    const second = await routeToSlack({
      channel: 'alerts',
      title: 'flap',
      text: 'again',
      dedupeKey: 'same-key',
    });

    expect(first.ok).toBe(true);
    expect(second).toEqual({ ok: false, transport: 'none' });
    expect(fetchMock).toHaveBeenCalledTimes(1); // second suppressed
  });

  it('does NOT dedupe when no dedupeKey is given', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/alerts';
    const fetchMock = mockFetchOk({}, true);

    await routeToSlack({ channel: 'alerts', title: 'a', text: 'b' });
    await routeToSlack({ channel: 'alerts', title: 'a', text: 'b' });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('is fail-soft: returns ok:false instead of throwing when fetch rejects', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/alerts';
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await routeToSlack({ channel: 'alerts', title: 't', text: 'x' });

    expect(result).toEqual({ ok: false, transport: 'webhook' });
  });

  it('returns transport:none when nothing is configured for the channel', async () => {
    // No token, no channel id, no webhook.
    const fetchMock = mockFetchOk({}, true);
    const result = await routeToSlack({ channel: 'feedback', title: 't', text: 'x' });

    expect(result).toEqual({ ok: false, transport: 'none' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps ai_ops channel to AI_OPS_SLACK_WEBHOOK_URL', async () => {
    process.env.AI_OPS_SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/ai-ops';
    const fetchMock = mockFetchOk({}, true);

    const result = await routeToSlack({ channel: 'ai_ops', title: 'AI health', text: 'ok' });

    expect(result.transport).toBe('webhook');
    expect(fetchMock.mock.calls[0][0]).toBe('https://hooks.slack.com/services/ai-ops');
  });

  it('ai_ops falls back to AI_SLACK_WEBHOOK_URL then SLACK_WEBHOOK_URL', async () => {
    process.env.AI_SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/ai-legacy';
    const fetchMock = mockFetchOk({}, true);

    await routeToSlack({ channel: 'ai_ops', title: 'x', text: 'y' });
    expect(fetchMock.mock.calls[0][0]).toBe('https://hooks.slack.com/services/ai-legacy');
  });

  it('feedback falls back to SLACK_WEBHOOK_URL when no dedicated feedback webhook', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/main';
    const fetchMock = mockFetchOk({}, true);

    await routeToSlack({ channel: 'feedback', title: 'x', text: 'y' });
    expect(fetchMock.mock.calls[0][0]).toBe('https://hooks.slack.com/services/main');
  });

  it('prefers env-scoped webhook (SLACK_WEBHOOK_URL_<ENV>) over the bare var', async () => {
    process.env.APP_ENV = 'staging';
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/bare';
    process.env.SLACK_WEBHOOK_URL_STAGING = 'https://hooks.slack.com/services/staging';
    const fetchMock = mockFetchOk({}, true);

    await routeToSlack({ channel: 'alerts', title: 'x', text: 'y' });
    expect(fetchMock.mock.calls[0][0]).toBe('https://hooks.slack.com/services/staging');

    delete process.env.SLACK_WEBHOOK_URL_STAGING;
  });

  // Regression coverage for the observed bug: #cf-progress received 11
  // identical "🚀 Wdrożenie" posts for the SAME commit within ~1 minute
  // because the dedupe map was purely in-memory and got wiped on every
  // process restart. `__resetDedupeForTests()` (memory-only, NOT the durable
  // DB-backed table) simulates exactly that: a fresh process, same DB.
  it('dedupe SURVIVES a simulated process restart (durable, DB-backed)', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/alerts';
    const fetchMock = mockFetchOk({}, true);

    const first = await routeToSlack({
      channel: 'alerts',
      title: 'deploy',
      text: 'v1',
      dedupeKey: 'deploy:demo:abc123',
    });
    expect(first.ok).toBe(true);

    // Simulate a process restart: only the in-memory map is cleared, the
    // durable table is untouched — this is exactly what a redeploy/crash-loop
    // does to the real process.
    __resetDedupeForTests();

    const second = await routeToSlack({
      channel: 'alerts',
      title: 'deploy',
      text: 'v1',
      dedupeKey: 'deploy:demo:abc123',
    });

    expect(second).toEqual({ ok: false, transport: 'none' });
    expect(fetchMock).toHaveBeenCalledTimes(1); // NOT re-sent after the "restart"
  });

  it('honours a per-event dedupeWindowMs override instead of the 30-min default', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/alerts';
    const fetchMock = mockFetchOk({}, true);

    await routeToSlack({
      channel: 'alerts',
      title: 'digest',
      text: 'day 1',
      dedupeKey: 'digest:demo:day1',
      dedupeWindowMs: 1, // effectively no suppression — expires almost immediately
    });
    await new Promise((r) => setTimeout(r, 5));
    await routeToSlack({
      channel: 'alerts',
      title: 'digest',
      text: 'day 1',
      dedupeKey: 'digest:demo:day1',
      dedupeWindowMs: 1,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2); // window already elapsed both times
  });

  it('SLACK_DISABLED_<ENV> silences the environment entirely (kill switch for e.g. staging CI noise)', async () => {
    process.env.APP_ENV = 'staging';
    process.env.SLACK_DISABLED_STAGING = 'true';
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/alerts';
    const fetchMock = mockFetchOk({}, true);

    const result = await routeToSlack({ channel: 'progress', title: 'noise', text: 'ignore me' });

    expect(result).toEqual({ ok: false, transport: 'none' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('SLACK_DISABLED_<ENV> does not affect a DIFFERENT environment', async () => {
    process.env.APP_ENV = 'demo';
    process.env.SLACK_DISABLED_STAGING = 'true'; // only staging is disabled
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/alerts';
    const fetchMock = mockFetchOk({}, true);

    const result = await routeToSlack({ channel: 'progress', title: 'ok', text: 'still sent' });

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
