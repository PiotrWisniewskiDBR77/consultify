/**
 * Acceptance E2E — T2: Feedback SLA escalation (F5) + security alerts
 * (brute-force / crash) reach Slack #cf-alerts.
 *
 * REJESTR T2: "mechanika eskalacji SLA→Slack #cf-alerts + alerty
 * crash/brute-force (wdrożone cf52b0057f, bez dowodu)". This suite builds
 * that dowód by driving the REAL cron-handler / real alert functions
 * directly against the REAL local parity Postgres (:5443), with `fetch`
 * intercepted (Slack endpoint mocked by capturing the HTTP call the way
 * `permission-fail-closed.e2e.test.ts` captures DB calls) so we can assert
 * on the actual outbound payload instead of trusting the code path exists.
 *
 * Live callers confirmed (not phantoms) before testing:
 *   - server/src/services/feedbackSla.ts `runFeedbackSlaSweepOnce()` is
 *     started on a 15-min interval from server/src/index.ts
 *     (`startFeedbackSlaSweepCron`) and exposed on demand via
 *     `POST /api/feedback/sla/sweep` (superadmin) — server/src/routes/
 *     feedback.routes.ts.
 *   - server/src/services/securityAlerts.ts `recordFailedLogin()` is called
 *     from server/src/controllers/AuthController.ts on every failed login
 *     (wrong password AND unknown user, lines ~167/~207).
 *   - server/src/index.ts `fireCrashAlert()` (registered on
 *     `process.on('uncaughtException'/'unhandledRejection')`) calls
 *     `sendSystemAlert()` with an identical shape to what we call directly
 *     below — we do NOT boot server/src/index.ts itself (that would both
 *     throw a real uncaught exception into the test process AND pull the
 *     46 self-resolving lazy AI wrappers that are documented to hang on
 *     await — MEMORY finding lazyloader_46_self_resolving_hang).
 *
 * ★ FINDING while building this test (recorded, not a phantom): the
 * `feedback_items.due_at` / `sla_escalated_at` columns are NOT created by
 * any server/migrations/*.sql file (confirmed: `git log --all -p -- server/
 * migrations | grep sla_escalated_at` = zero hits). They are added lazily,
 * best-effort, by `ensureFeedbackSchema()` in feedback.routes.ts
 * (`ALTER TABLE feedback_items ADD COLUMN due_at ...`) the first time any
 * feedback route runs. On a FRESH parity DB (confirmed via `\d feedback_items`
 * before this suite ran) those columns are absent, so
 * `runFeedbackSlaSweepOnce()` early-returns 0 — the sweep is a silent no-op
 * until the self-heal has fired at least once. This suite's own ticket
 * creation (via the real `createFeedbackInternal`) triggers that self-heal
 * for real, so the sweep test below is proof for the STEADY-STATE (post
 * first-ticket) condition that matches demo/prod once any ticket has ever
 * been filed — not a synthetic bypass.
 *
 * Fixture hygiene: all rows created here carry title/message prefixed
 * `odbior--t2--` and are deleted in afterAll (feedback_items +
 * feedback_items_status_history). No standing config is mutated: SLACK_*
 * env vars and global.fetch are saved/restored.
 */
import { randomUUID } from 'node:crypto';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { pgClient } from './harness.js';
import { seed } from './seed.mjs';
import { SEED } from './seed.mjs';

// ==========================================================================
// Shared fetch capture — stands in for "the Slack endpoint" per T2 scope.
// ==========================================================================

interface CapturedCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: any;
}

let capturedCalls: CapturedCall[] = [];
let originalFetch: typeof fetch;
let savedEnv: Record<string, string | undefined> = {};

function stubFetch(): void {
  originalFetch = global.fetch;
  global.fetch = vi.fn(async (url: any, init: any = {}) => {
    let parsedBody: any = undefined;
    try {
      parsedBody = init?.body ? JSON.parse(init.body) : undefined;
    } catch {
      parsedBody = init?.body;
    }
    capturedCalls.push({
      url: String(url),
      method: String(init?.method || 'GET'),
      headers: (init?.headers || {}) as Record<string, string>,
      body: parsedBody,
    });
    return {
      ok: true,
      status: 200,
      json: async () => ({ ok: true, ts: '1721300000.000100', channel: parsedBody?.channel }),
    } as any;
  }) as any;
}

function restoreFetch(): void {
  global.fetch = originalFetch;
}

const SLACK_ENV_KEYS = [
  'SLACK_BOT_TOKEN',
  'SLACK_CHANNEL_ALERTS_ID',
  'SLACK_WEBHOOK_URL',
  'AI_SLACK_WEBHOOK_URL',
] as const;

function stubSlackEnv(): void {
  savedEnv = {};
  for (const key of SLACK_ENV_KEYS) savedEnv[key] = process.env[key];
  process.env.SLACK_BOT_TOKEN = 'xoxb-odbior-t2-test-token';
  // The real prod/demo config for the 'alerts' channel key resolves to the
  // Slack channel humans call #cf-alerts (per rejestr T2). We assert on this
  // literal so the test proves the CONFIGURED channel is what's used, not an
  // unrelated one.
  process.env.SLACK_CHANNEL_ALERTS_ID = '#cf-alerts';
  delete process.env.AI_SLACK_WEBHOOK_URL;
}

function restoreSlackEnv(): void {
  for (const key of SLACK_ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
}

beforeAll(async () => {
  await seed();
  stubSlackEnv();
  stubFetch();
}, 60_000);

afterAll(() => {
  restoreFetch();
  restoreSlackEnv();
});

beforeEach(() => {
  capturedCalls = [];
});

// ==========================================================================
// F5 — Feedback SLA overdue escalation sweep
// ==========================================================================

describe('T2-F5 · runFeedbackSlaSweepOnce — overdue ticket escalates to Slack #cf-alerts', () => {
  let createFeedbackInternal: typeof import('../../server/src/routes/feedback.routes.js').createFeedbackInternal;
  let runFeedbackSlaSweepOnce: typeof import('../../server/src/services/feedbackSla.js').runFeedbackSlaSweepOnce;
  let __resetDedupeForTests: typeof import('../../server/src/services/slack/slackRouter.js').__resetDedupeForTests;
  const createdFeedbackIds: string[] = [];

  beforeAll(async () => {
    const feedbackRoutesMod = await import('../../server/src/routes/feedback.routes.js');
    createFeedbackInternal = feedbackRoutesMod.createFeedbackInternal;
    const feedbackSlaMod = await import('../../server/src/services/feedbackSla.js');
    runFeedbackSlaSweepOnce = feedbackSlaMod.runFeedbackSlaSweepOnce;
    const slackRouterMod = await import('../../server/src/services/slack/slackRouter.js');
    __resetDedupeForTests = slackRouterMod.__resetDedupeForTests;
  });

  afterAll(async () => {
    if (createdFeedbackIds.length === 0) return;
    const client = pgClient();
    await client.connect();
    try {
      await client.query(
        `DELETE FROM feedback_items_status_history WHERE feedback_id = ANY($1::text[])`,
        [createdFeedbackIds]
      );
      await client.query(`DELETE FROM feedback_items WHERE id = ANY($1::text[])`, [
        createdFeedbackIds,
      ]);
    } finally {
      await client.end();
    }
  });

  it('creates a real ticket, backdates its due_at, sweeps, and proves a Slack #cf-alerts payload + DB escalation record', async () => {
    // 1) Real intake path (self-heals due_at/sla_escalated_at columns for real).
    const probeTitle = `odbior--t2-- SLA escalation probe ${randomUUID().slice(0, 8)}`;
    const result = await createFeedbackInternal(
      {
        type: 'BUG',
        title: probeTitle,
        message: 'odbior--t2-- probe ticket created by acceptance test for SLA sweep evidence',
        severity: 'CRITICAL',
        userId: SEED.USER_ID,
      } as any,
      {}
    );
    await result.escalationPromise.catch(() => undefined);
    createdFeedbackIds.push(result.feedbackId);
    expect(result.feedbackId).toBeTruthy();

    // 2) Confirm the self-heal really added the columns (would 500 otherwise).
    const client = pgClient();
    await client.connect();
    try {
      const cols = await client.query(
        `SELECT column_name FROM information_schema.columns
          WHERE table_name = 'feedback_items' AND column_name IN ('due_at', 'sla_escalated_at')`
      );
      expect(cols.rows.map((r) => r.column_name).sort()).toEqual(['due_at', 'sla_escalated_at']);

      // 3) Force the ticket into "overdue, never escalated" state — CRITICAL's
      //    4h window means any due_at in the past qualifies.
      const overdueIso = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
      const upd = await client.query(
        `UPDATE feedback_items SET due_at = $1, sla_escalated_at = NULL, status = 'NEW'
          WHERE id = $2 RETURNING id`,
        [overdueIso, result.feedbackId]
      );
      expect(upd.rowCount).toBe(1);
    } finally {
      await client.end();
    }

    // 4) Tick the escalator — the REAL cron-handler, invoked directly (not via
    //    the 15-min timer, exactly as the rejestr instructs).
    __resetDedupeForTests();
    capturedCalls = [];
    const escalatedCount = await runFeedbackSlaSweepOnce();
    expect(escalatedCount).toBeGreaterThanOrEqual(1);

    // 5) Slack payload evidence: channel is the configured #cf-alerts, body
    //    mentions the ticket.
    const slackCall = capturedCalls.find(
      (c) => c.url.includes('chat.postMessage') && c.body?.channel === '#cf-alerts'
    );
    expect(slackCall).toBeTruthy();
    expect(slackCall!.headers.Authorization).toBe('Bearer xoxb-odbior-t2-test-token');
    // `text` is the notification preview built by buildPreview(); `blocks[1]`
    // carries the per-ticket lines built by feedbackSla.ts.
    const blocksText = JSON.stringify(slackCall!.body.blocks || []);
    expect(blocksText).toContain(probeTitle.slice(0, 40));
    expect(slackCall!.body.text || '').toMatch(/termin|SLA|zaległ/i);

    // 6) DB-side escalation record: sla_escalated_at stamped, so a re-sweep
    //    does NOT re-escalate the same ticket (nudge-once contract).
    const client2 = pgClient();
    await client2.connect();
    try {
      const row = await client2.query(
        `SELECT sla_escalated_at FROM feedback_items WHERE id = $1`,
        [result.feedbackId]
      );
      expect(row.rows[0]?.sla_escalated_at).toBeTruthy();
    } finally {
      await client2.end();
    }

    __resetDedupeForTests();
    capturedCalls = [];
    const secondSweep = await runFeedbackSlaSweepOnce();
    // Same ticket must not be picked up again (sla_escalated_at gate).
    const secondSlackCall = capturedCalls.find(
      (c) => c.url.includes('chat.postMessage') && c.body?.channel === '#cf-alerts'
    );
    expect(secondSlackCall).toBeFalsy();
    void secondSweep;
  }, 30_000);
});

// ==========================================================================
// F5-adjacent — security alerts (brute-force threshold, and the crash-alert
// shape used by server/src/index.ts fireCrashAlert()).
// ==========================================================================

describe('T2 · Security alerts (brute-force, crash) reach Slack #cf-alerts', () => {
  let recordFailedLogin: typeof import('../../server/src/services/securityAlerts.js').recordFailedLogin;
  let __resetSecurityWindows: typeof import('../../server/src/services/securityAlerts.js').__resetSecurityWindows;
  let sendSystemAlert: typeof import('../../server/src/services/systemAlertNotifier.js').sendSystemAlert;
  let __resetDedupeForTests: typeof import('../../server/src/services/slack/slackRouter.js').__resetDedupeForTests;

  beforeAll(async () => {
    const securityAlertsMod = await import('../../server/src/services/securityAlerts.js');
    recordFailedLogin = securityAlertsMod.recordFailedLogin;
    __resetSecurityWindows = securityAlertsMod.__resetSecurityWindows;
    const systemAlertNotifierMod = await import('../../server/src/services/systemAlertNotifier.js');
    sendSystemAlert = systemAlertNotifierMod.sendSystemAlert;
    const slackRouterMod = await import('../../server/src/services/slack/slackRouter.js');
    __resetDedupeForTests = slackRouterMod.__resetDedupeForTests;
  });

  it('F3/F5 brute-force: 8 failed logins against one account cross the threshold and page Slack #cf-alerts', async () => {
    __resetSecurityWindows();
    __resetDedupeForTests();
    capturedCalls = [];

    const probeEmail = `odbior--t2--brute-${randomUUID().slice(0, 8)}@test.local`;
    const probeIp = '203.0.113.77';

    // SECURITY_ALERT_CONFIG.FAILED_LOGIN_THRESHOLD = 8; the alert fires on the
    // crossing edge (count === threshold), mirroring AuthController.ts's real
    // call sites on wrong-password / unknown-user failed logins.
    for (let i = 0; i < 8; i++) {
      // eslint-disable-next-line no-await-in-loop -- sequential by design: simulates real chronological attempts.
      await recordFailedLogin(probeEmail, probeIp);
    }

    const bruteForceCall = capturedCalls.find(
      (c) =>
        c.url.includes('chat.postMessage') &&
        c.body?.channel === '#cf-alerts' &&
        JSON.stringify(c.body).toLowerCase().includes('brute')
    );
    expect(bruteForceCall).toBeTruthy();
    const preview = String(bruteForceCall!.body.text || '');
    expect(preview).toMatch(/nieudanych prób logowania/i);
    expect(preview.toLowerCase()).toContain(probeEmail.toLowerCase());
  });

  it('crash alert: the exact sendSystemAlert() shape fireCrashAlert() uses (index.ts) reaches Slack #cf-alerts as CRITICAL', async () => {
    __resetDedupeForTests();
    capturedCalls = [];

    const probeDetail = `odbior--t2-- probe crash ${randomUUID().slice(0, 8)}`;
    // Identical call shape to server/src/index.ts fireCrashAlert(): title
    // `[<label>] Unhandled server error`, source 'Process', severity CRITICAL.
    await sendSystemAlert({
      title: '[uncaughtException] Unhandled server error',
      message: probeDetail,
      severity: 'CRITICAL',
      source: 'Process',
      throttleKey: `crash_uncaughtException_probe_${randomUUID()}`,
      throttleMs: 60_000,
    });

    const crashCall = capturedCalls.find(
      (c) => c.url.includes('chat.postMessage') && c.body?.channel === '#cf-alerts'
    );
    expect(crashCall).toBeTruthy();
    expect(JSON.stringify(crashCall!.body)).toContain(probeDetail);
    // CRITICAL -> 'Awaria' category headline (🚨) per systemAlertNotifier.ts.
    expect(String(crashCall!.body.text || '')).toMatch(/🚨/);
  });
});
