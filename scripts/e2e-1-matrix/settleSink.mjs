/**
 * D-09 (C3b harness E2E-1): the per-module `settle` wrapper, extracted verbatim
 * from `run.mjs` so the sink-push WIRING is unit-testable without a browser —
 * `run.mjs` runs `main()` at top level (launches chromium, calls `process.exit`)
 * and exports nothing, so a test cannot import it. `settleAndWait` is injected;
 * the caller binds `base` (BASE) and `log`.
 *
 * DEC-590 (Wpis 39): spinner-aware wait lives in settle.mjs; this wrapper only
 * binds base + logger so the 7 call sites stay `(page, route, sink)`.
 * DEC-590 (Wpis 47): the outcome is no longer discarded — it is pushed into the
 * per-module sink so spinnerGone/elapsedMs reach the variant artifact.
 */
export function makeSettle(settleAndWait, { base, log }) {
  return async function settle(page, route, sink) {
    const outcome = await settleAndWait(page, route, { base, log });
    if (Array.isArray(sink)) sink.push(outcome);
    return outcome;
  };
}
