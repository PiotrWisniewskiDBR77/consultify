/**
 * progressFeed + notifySlackThread — Slack Command Center, Filar 4 / F3.
 *
 * Covers:
 *  - enqueue buffers and flushProgressNow sends ONE aggregated message;
 *  - urgent events are sent immediately (their own message), bypassing buffer;
 *  - an empty buffer produces NO Slack call;
 *  - the item cap renders at most N items + a "+N więcej" line;
 *  - notifySlackThread calls routeToSlack with threadTs ONLY when the ticket
 *    metadata carries slack_thread_ts (app-reported tickets → no-op).
 *
 * routeToSlack (the egress) and the DB layer are mocked; the batching /
 * gating logic under test is exercised for real.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// ── Slack egress router ──────────────────────────────────────────────────────
const mockRouteToSlack = vi.fn(async () => ({ ok: true, transport: 'bot' as const }));
vi.mock('../../../server/src/services/slack/slackRouter.js', () => ({
  routeToSlack: (...a: unknown[]) => mockRouteToSlack(...a),
}));

import {
  enqueueProgressEvent,
  flushProgressNow,
  __bufferLengthForTests,
  __resetProgressFeedForTests,
} from '../../../server/src/services/slack/progressFeed.js';

const flushPromises = () => new Promise((r) => setImmediate(r));

describe('progressFeed', () => {
  beforeEach(() => {
    __resetProgressFeedForTests();
    mockRouteToSlack.mockClear();
  });

  afterEach(() => {
    __resetProgressFeedForTests();
  });

  it('buffers non-urgent events and flushes them as ONE aggregated message', async () => {
    enqueueProgressEvent({ kind: 'TASK', title: 'Zadanie A ukończone' });
    enqueueProgressEvent({ kind: 'TASK', title: 'Zadanie B ukończone' });
    enqueueProgressEvent({ kind: 'INITIATIVE', title: 'Inicjatywa X → EXECUTING' });

    // Nothing sent yet — it's buffered.
    expect(mockRouteToSlack).not.toHaveBeenCalled();
    expect(__bufferLengthForTests()).toBe(3);

    await flushProgressNow();

    expect(mockRouteToSlack).toHaveBeenCalledTimes(1);
    const arg = mockRouteToSlack.mock.calls[0][0] as {
      channel: string;
      text: string;
    };
    expect(arg.channel).toBe('progress');
    // Grouped counters in the header.
    expect(arg.text).toContain('task: *2*');
    expect(arg.text).toContain('initiative: *1*');
    // Individual items present.
    expect(arg.text).toContain('Zadanie A ukończone');
    expect(arg.text).toContain('Inicjatywa X → EXECUTING');
    // Buffer drained after flush.
    expect(__bufferLengthForTests()).toBe(0);
  });

  it('sends urgent events immediately on their own, bypassing the buffer', async () => {
    enqueueProgressEvent({ kind: 'TASK', title: 'Zadanie zablokowane', urgent: true });
    await flushPromises();

    expect(mockRouteToSlack).toHaveBeenCalledTimes(1);
    const arg = mockRouteToSlack.mock.calls[0][0] as {
      channel: string;
      severity: string;
      text: string;
    };
    expect(arg.channel).toBe('progress');
    expect(arg.severity).toBe('CRITICAL');
    expect(arg.text).toContain('Zadanie zablokowane');
    // Urgent path does not touch the buffer.
    expect(__bufferLengthForTests()).toBe(0);
  });

  it('does not send anything when the buffer is empty', async () => {
    await flushProgressNow();
    expect(mockRouteToSlack).not.toHaveBeenCalled();
  });

  it('caps the number of rendered items and adds a "+N więcej" line', async () => {
    for (let i = 0; i < 25; i++) {
      enqueueProgressEvent({ kind: 'TASK', title: `Zadanie ${i}` });
    }
    await flushProgressNow();

    expect(mockRouteToSlack).toHaveBeenCalledTimes(1);
    const text = (mockRouteToSlack.mock.calls[0][0] as { text: string }).text;
    // 20 shown, 5 remaining.
    const bulletCount = (text.match(/^• /gm) || []).length;
    expect(bulletCount).toBe(20);
    expect(text).toContain('+5 więcej');
  });

  it('ignores empty-title events (fail-soft)', async () => {
    enqueueProgressEvent({ kind: 'TASK', title: '   ' });
    expect(__bufferLengthForTests()).toBe(0);
    await flushProgressNow();
    expect(mockRouteToSlack).not.toHaveBeenCalled();
  });
});

// ============================================================================
// notifySlackThread — the F3 lifecycle-into-thread gate.
// ============================================================================

const mockDbGet = vi.fn();
vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  get: (...a: unknown[]) => mockDbGet(...a),
  run: vi.fn(async () => ({ success: true })),
  all: vi.fn(async () => []),
}));

describe('notifySlackThread', () => {
  let notifySlackThread: (
    row: unknown,
    text: string
  ) => Promise<void>;

  beforeEach(async () => {
    mockRouteToSlack.mockClear();
    mockDbGet.mockReset();
    // Imported lazily so the DbPromise mock above is in place first.
    const mod = await import('../../../server/src/routes/feedback.routes.js');
    notifySlackThread = mod.notifySlackThread as typeof notifySlackThread;
  });

  it('routes into the thread when metadata carries slack_thread_ts', async () => {
    await notifySlackThread(
      { metadata_json: JSON.stringify({ slack_thread_ts: '1720000000.0001' }) },
      '🔧 Status: NEW → IN_PROGRESS'
    );

    expect(mockRouteToSlack).toHaveBeenCalledTimes(1);
    const arg = mockRouteToSlack.mock.calls[0][0] as {
      channel: string;
      threadTs?: string;
      text: string;
    };
    expect(arg.channel).toBe('feedback');
    expect(arg.threadTs).toBe('1720000000.0001');
    expect(arg.text).toContain('IN_PROGRESS');
  });

  it('is a no-op when metadata has no slack_thread_ts (app-reported ticket)', async () => {
    await notifySlackThread(
      { metadata_json: JSON.stringify({ source: 'app' }) },
      '🔧 Status change'
    );
    expect(mockRouteToSlack).not.toHaveBeenCalled();
  });

  it('accepts an already-parsed metadata object', async () => {
    await notifySlackThread({ slack_thread_ts: '1720000000.0002' }, '💬 Odpowiedź');
    expect(mockRouteToSlack).toHaveBeenCalledTimes(1);
    expect(
      (mockRouteToSlack.mock.calls[0][0] as { threadTs?: string }).threadTs
    ).toBe('1720000000.0002');
  });

  it('fetches metadata by id when passed a feedback id string', async () => {
    mockDbGet.mockResolvedValueOnce({
      metadata_json: JSON.stringify({ slack_thread_ts: '1720000000.0003' }),
    });
    await notifySlackThread('feedback-id-123', '💬 update');
    expect(mockDbGet).toHaveBeenCalledTimes(1);
    expect(mockRouteToSlack).toHaveBeenCalledTimes(1);
    expect(
      (mockRouteToSlack.mock.calls[0][0] as { threadTs?: string }).threadTs
    ).toBe('1720000000.0003');
  });

  it('does not send on empty text', async () => {
    await notifySlackThread(
      { metadata_json: JSON.stringify({ slack_thread_ts: '1720000000.0004' }) },
      '   '
    );
    expect(mockRouteToSlack).not.toHaveBeenCalled();
  });
});
