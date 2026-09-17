import assert from 'node:assert/strict';
import test from 'node:test';

import {
  NETWORKIDLE_CAP_MS,
  SETTLE_TIMEOUT_MS,
  SPINNER_SELECTOR,
  settle,
} from './settle.mjs';

// A minimal stand-in for the Playwright page. waitForSelector honours an
// injectable outcome so both branches (spinner gone / spinner stuck) are proven
// without a real browser or a literal 15 s wait.
function makePage({ spinnerGoneAfterMs = 0, spinnerStuck = false } = {}) {
  const calls = { goto: [], waitForSelector: [], waitForLoadState: [], waitForTimeout: [] };
  return {
    calls,
    async goto(url, options) {
      calls.goto.push({ url, options });
    },
    async waitForSelector(selector, options) {
      calls.waitForSelector.push({ selector, options });
      if (spinnerStuck) {
        // Mirror Playwright: reject once the (injected) timeout elapses.
        await new Promise((resolve) => setTimeout(resolve, options.timeout));
        throw new Error(`Timeout ${options.timeout}ms exceeded waiting for ${selector}`);
      }
      await new Promise((resolve) => setTimeout(resolve, spinnerGoneAfterMs));
    },
    async waitForLoadState(state, options) {
      calls.waitForLoadState.push({ state, options });
    },
    async waitForTimeout(ms) {
      calls.waitForTimeout.push(ms);
    },
  };
}

test('settle targets the route-loading skeleton and the frozen 15s bound', () => {
  assert.equal(SPINNER_SELECTOR, '[data-testid="route-loading-skeleton"]');
  assert.equal(SETTLE_TIMEOUT_MS, 15_000);
});

test('settle navigates to base+route and reports spinnerGone when the skeleton clears', async () => {
  const page = makePage({ spinnerGoneAfterMs: 20 });
  const logs = [];
  const result = await settle(page, '/admin/people', {
    base: 'https://staging.consultify.ai',
    log: (message) => logs.push(message),
  });

  assert.equal(page.calls.goto.length, 1);
  assert.equal(page.calls.goto[0].url, 'https://staging.consultify.ai/admin/people');
  assert.equal(page.calls.waitForSelector[0].selector, SPINNER_SELECTOR);
  assert.equal(page.calls.waitForSelector[0].options.state, 'hidden');
  // Default bound is the frozen 15 s contract.
  assert.equal(page.calls.waitForSelector[0].options.timeout, SETTLE_TIMEOUT_MS);
  assert.equal(result.route, '/admin/people');
  assert.equal(result.spinnerGone, true);
  assert.ok(result.elapsedMs >= 20, `elapsed ${result.elapsedMs}ms should include the wait`);
  assert.ok(
    logs.some((line) => line.includes('spinnerGone=true')),
    'expected a success settle log line'
  );
  assert.ok(!logs.some((line) => line.includes('settle ERROR')), 'no error line on the happy path');
});

test('settle does not throw when the spinner is stuck; it logs an error and flags spinnerGone=false', async () => {
  const page = makePage({ spinnerStuck: true });
  const logs = [];
  // Inject a short timeout so the stuck branch is proven without a 15 s wait.
  const result = await settle(page, '/my-work', {
    base: 'https://staging.consultify.ai',
    timeoutMs: 120,
    log: (message) => logs.push(message),
  });

  assert.equal(page.calls.waitForSelector[0].options.timeout, 120);
  assert.equal(result.spinnerGone, false);
  assert.ok(result.elapsedMs >= 120, `elapsed ${result.elapsedMs}ms should reach the timeout`);
  assert.ok(
    logs.some((line) => line.includes('settle ERROR') && line.includes('/my-work')),
    'expected an ERROR log naming the stuck route'
  );
  // The frame budget / networkidle cap still run so the shot is captured.
  assert.equal(page.calls.waitForTimeout.length, 1);
});

test('a stuck spinner can never collapse the networkidle budget to 0 (P1 hang)', async () => {
  const page = makePage({ spinnerStuck: true });
  // Inject a short spinner timeout so the stuck branch is proven without a 15 s
  // wait; the spinner consumes the ENTIRE budget, the exact P1 precondition.
  await settle(page, '/admin/people', {
    base: 'https://staging.consultify.ai',
    timeoutMs: 120,
    log: () => {},
  });

  const loadState = page.calls.waitForLoadState[0];
  assert.equal(loadState.state, 'networkidle');
  // Playwright reads timeout:0 as "no limit": the old derived form
  // Math.min(remaining, cap) returned 0 here and hung the route forever.
  assert.ok(
    loadState.options.timeout > 0,
    `networkidle timeout must be >0, got ${loadState.options.timeout}`
  );
  assert.equal(loadState.options.timeout, NETWORKIDLE_CAP_MS);
});
