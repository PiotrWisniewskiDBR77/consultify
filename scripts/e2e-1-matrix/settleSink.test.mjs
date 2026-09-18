import assert from 'node:assert/strict';
import test from 'node:test';

import { makeSettle } from './settleSink.mjs';

// D-09: the debt was that run.mjs's `settle` wrapper pushed the spinner outcome
// into the per-module sink with NO test guarding it — removing `sink.push(outcome)`
// stayed green 14/14 because contract.test.mjs calls writeVariantArtifacts
// directly. run.mjs cannot be imported (top-level main() launches chromium and
// exits), so the wrapper was extracted to settleSink.mjs. These tests exercise the
// SAME factory run.mjs uses and assert the WIRING (the outcome argument actually
// reaches the sink), not mere source presence.

test('settle forwards the spinner outcome into an array sink and binds base/log (D-09 wiring)', async () => {
  const outcome = { route: '/chat', spinnerGone: true, elapsedMs: 42 };
  const calls = [];
  const fakeSettleAndWait = async (page, route, options) => {
    calls.push({ page, route, options });
    return outcome;
  };
  const logs = [];
  const settle = makeSettle(fakeSettleAndWait, {
    base: 'https://staging.consultify.ai',
    log: (message) => logs.push(message),
  });

  const fakePage = { url: () => 'https://staging.consultify.ai/chat' };
  const sink = [];
  const returned = await settle(fakePage, '/chat', sink);

  // The wrapper returns the outcome unchanged ...
  assert.equal(returned, outcome);
  // ... AND pushes that very outcome object into the sink (the wiring under test).
  assert.equal(sink.length, 1);
  assert.equal(sink[0], outcome);
  // settleAndWait is called once with the bound base + log options.
  assert.equal(calls.length, 1);
  assert.equal(calls[0].page, fakePage);
  assert.equal(calls[0].route, '/chat');
  assert.equal(calls[0].options.base, 'https://staging.consultify.ai');
  assert.equal(typeof calls[0].options.log, 'function');
  // the bound logger is the one passed through.
  calls[0].options.log('hello');
  assert.deepEqual(logs, ['hello']);
});

test('settle accumulates every outcome across calls (sink is the variant artifact feed)', async () => {
  let n = 0;
  const settle = makeSettle(async () => ({ id: ++n }), { base: 'b', log: () => {} });
  const sink = [];
  await settle({}, '/a', sink);
  await settle({}, '/b', sink);
  await settle({}, '/c', sink);
  assert.deepEqual(sink, [{ id: 1 }, { id: 2 }, { id: 3 }]);
});

test('settle is a no-op (does not throw) when sink is not an array', async () => {
  const outcome = { route: '/x', spinnerGone: false, elapsedMs: 7 };
  const settle = makeSettle(async () => outcome, { base: 'b', log: () => {} });
  // undefined sink (the wrapper guards with Array.isArray) and a non-array sink.
  assert.equal(await settle({}, '/x', undefined), outcome);
  assert.equal(await settle({}, '/x', null), outcome);
  assert.equal(await settle({}, '/x', { notAnArray: true }), outcome);
});
