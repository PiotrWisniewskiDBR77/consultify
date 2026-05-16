/**
 * Sprint 10 — Presentation Governance Alert Worker integration tests.
 *
 * Exercises the full diff cycle (read deck rows + subscriptions + worker_state,
 * dispatch, persist) against a real Postgres instance. Mirrors the
 * `confidentiality-controls.test.ts` precondition pattern: every test starts
 * with a `pgReachable()` check, and when the database is not reachable OR
 * the migration-762/763 schema is missing the suite returns early without
 * failing. CI environments with Postgres get true coverage; local dev
 * without Postgres sees a single stderr skip line and a clean exit 0.
 *
 * Outbound webhook calls are stubbed via a fake `globalThis.fetch`. The
 * worker still computes signatures and writes audit rows exactly as it
 * would in production — only the network egress is replaced.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  // Force the application's database factory to use a real Postgres pool
  // when one is configured. The harness's `pgReachable()` precondition
  // still gates whether tests actually run, so this is safe even on
  // machines without a database — the lazy `databaseConfig` proxy is
  // never accessed in that case.
  if (
    process.env.DATABASE_URL ||
    process.env.PGHOST ||
    process.env.DB_HOST
  ) {
    process.env.MOCK_DB = 'false';
    process.env.RUN_DB_TESTS = '1';
    process.env.DB_TYPE = 'postgres';
  }
  // Make sure the dispatcher records signed audit rows: when this env var
  // is `'true'` the dispatcher short-circuits to status='dry_run' with
  // signature_present=false. Force it off so we exercise the signing path.
  process.env.PRESENTATION_GOVERNANCE_ALERTS_DRY_RUN = 'false';
});

import {
  pgReachable,
  setupAlertWorkerHarness,
  insertSubscription,
  insertWatchlistDeckRow,
  readWorkerStateRow,
  readDispatchRows,
  clearOrgRows,
  type PgHarness,
} from './_helpers/alert-worker-pg-harness';
import { runSingleCycleForTest } from '../../../server/scripts/run-presentation-alert-worker';

// ---------------------------------------------------------------------------
// Fake fetch — keeps the dispatcher hermetic so we can assert signing without
// hitting `https://example.test/...` for real.
// ---------------------------------------------------------------------------

let originalFetch: typeof globalThis.fetch | undefined;

function installFakeFetch(): void {
  originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => ({
    status: 200,
    ok: true,
    text: async () => '',
    json: async () => ({}),
  })) as unknown as typeof globalThis.fetch;
}

function restoreFetch(): void {
  if (originalFetch) {
    globalThis.fetch = originalFetch;
  }
  originalFetch = undefined;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('Alert worker — DB integration', () => {
  let harness: PgHarness | null = null;
  let skipMessageEmitted = false;

  function emitSkipOnce(): void {
    if (skipMessageEmitted) return;
    skipMessageEmitted = true;
    // eslint-disable-next-line no-console
    console.error(
      '[skip] Postgres not reachable — alert worker integration tests skipped'
    );
  }

  beforeAll(async () => {
    if (!(await pgReachable())) {
      emitSkipOnce();
      return;
    }
    harness = await setupAlertWorkerHarness();
    if (!harness) {
      emitSkipOnce();
    }
  }, 30_000);

  afterAll(async () => {
    if (harness) {
      await harness.cleanup();
      harness = null;
    }
  });

  beforeEach(async () => {
    if (!harness) return;
    await clearOrgRows(harness);
    installFakeFetch();
  });

  afterEach(() => {
    restoreFetch();
  });

  // Helper that mirrors the `it.skip`-conditional pattern used by
  // `confidentiality-controls.test.ts`: when the harness is unavailable we
  // simply early-return so the test reports as a clean (vacuous) pass.
  const itDB = (
    name: string,
    fn: (h: PgHarness) => Promise<void>,
    timeoutMs: number = 30_000
  ) =>
    it(
      name,
      async () => {
        if (!harness) {
          expect(true).toBe(true);
          return;
        }
        await fn(harness);
      },
      timeoutMs
    );

  itDB('bootstrap cycle does not emit alerts even with BLOCKED_P0 deck', async (h) => {
    await insertSubscription(h, {
      channel: 'webhook',
      target: 'https://example.test/hook-bootstrap',
      minSeverity: 'BLOCKED_P0',
      active: true,
    });
    await insertWatchlistDeckRow(h, {
      deckId: 'deck_p0_a',
      title: 'P0 deck',
      verdict: 'BLOCKED_P0',
      p0: 3,
      p1: 1,
      p2: 0,
    });

    const summary = await runSingleCycleForTest(h.testOrgId, { dryRun: true });

    expect(summary.transitions).toBe(0);
    expect(summary.errored).toBe(false);

    const state = await readWorkerStateRow(h);
    expect(state).not.toBeNull();
    expect(state?.last_snapshot_json).not.toBeNull();
    expect(state?.failures_in_a_row).toBe(0);
    expect(state?.paused).toBe(false);

    const dispatches = await readDispatchRows(h);
    expect(dispatches.length).toBe(0);
  });

  itDB('second cycle with new BLOCKED_P0 deck emits dispatch', async (h) => {
    await insertSubscription(h, {
      channel: 'webhook',
      target: 'https://example.test/hook-second',
      minSeverity: 'BLOCKED_P0',
      active: true,
    });

    // Bootstrap with an empty watchlist so the second cycle clearly diffs
    // a brand-new BLOCKED_P0 deck against an empty baseline.
    const bootstrap = await runSingleCycleForTest(h.testOrgId, { dryRun: true });
    expect(bootstrap.transitions).toBe(0);

    await insertWatchlistDeckRow(h, {
      deckId: 'deck_p0_b',
      title: 'New P0',
      verdict: 'BLOCKED_P0',
      p0: 5,
    });

    const summary = await runSingleCycleForTest(h.testOrgId, { dryRun: true });
    expect(summary.transitions).toBe(1);
    expect(summary.errored).toBe(false);

    const dispatches = await readDispatchRows(h);
    expect(dispatches.length).toBeGreaterThanOrEqual(1);
    expect(
      dispatches.some((d) => d.status === 'dry_run' || d.status === 'sent')
    ).toBe(true);
    expect(dispatches.some((d) => d.to_verdict === 'BLOCKED_P0')).toBe(true);
  });

  itDB('signature_present true when subscription has signing_secret', async (h) => {
    await insertSubscription(h, {
      channel: 'webhook',
      target: 'https://example.test/signed',
      minSeverity: 'BLOCKED_P0',
      active: true,
      signingSecret: 'a'.repeat(64),
    });

    // Bootstrap (no decks) so the second cycle diffs a fresh BLOCKED_P0 entry.
    await runSingleCycleForTest(h.testOrgId, { dryRun: true });

    await insertWatchlistDeckRow(h, {
      deckId: 'deck_signed',
      title: 'Signed',
      verdict: 'BLOCKED_P0',
    });

    await runSingleCycleForTest(h.testOrgId, { dryRun: true });

    const dispatches = await readDispatchRows(h);
    const signed = dispatches.find((d) => d.signature_present === true);
    expect(signed).toBeDefined();
    if (signed) {
      expect(signed.signature_algorithm).toBe('HMAC-SHA256');
    }
  });

  itDB('failures_in_a_row increments on transient error', async (h) => {
    const result = await runSingleCycleForTest(h.testOrgId, {
      simulateFailure: true,
    });
    expect(result.errored).toBe(true);

    const state = await readWorkerStateRow(h);
    expect(state).not.toBeNull();
    expect(state?.failures_in_a_row).toBeGreaterThan(0);
    expect(state?.paused).toBe(false);
  });

  itDB('paused=true after 5 consecutive failures', async (h) => {
    for (let i = 0; i < 5; i++) {
      await runSingleCycleForTest(h.testOrgId, { simulateFailure: true });
    }
    const state = await readWorkerStateRow(h);
    expect(state).not.toBeNull();
    expect(state?.failures_in_a_row).toBeGreaterThanOrEqual(5);
    expect(state?.paused).toBe(true);
    expect(state?.paused_reason).toBe('too_many_failures');
  });
});
