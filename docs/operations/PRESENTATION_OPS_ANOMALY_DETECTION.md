# Presentation Operations Health — Anomaly Detection

> Sprint 13. Adds basic statistical anomaly detection to the SuperAdmin
> "Operations Health" scoreboard. When an SLO's current observed value
> materially deviates from its prior 24-hour baseline, the backend emits
> a throttled `anomaly_detected` runtime event and the frontend renders an
> orange "Anomaly" chip on the affected SLO card.

## 1. Purpose

The Sprint 10–12 scoreboard already classifies each SLO into
`pass | at_risk | breach | inconclusive` against a *steady-state* SLO
target. That signal is intentionally slow-moving — it answers "are we
honoring the SLO right now?" but not "is the system getting worse than
usual?".

Anomaly detection complements the steady-state pill with a short-term
deviation signal:

- The **PASS / AT_RISK / BREACH pill** (existing) tells operators where
  an SLO sits relative to its hard threshold.
- The **orange "Anomaly" chip** (new) tells operators where today's
  observed value is *materially different* from its prior 24-hour
  baseline — even if the SLO is still nominally PASS.

The two coexist on the same card so the operator sees both at a glance.
A green `pass` SLO with an orange `Anomaly` chip is a useful early
warning. A red `breach` SLO with no chip means the breach is consistent
with recent history — there is no surprise.

## 2. Algorithm

Pure logic lives in
`server/src/services/presentationOperationsAnomalyDetectionService.ts`
and is unit-tested by
`server/src/services/__tests__/presentationOperationsAnomalyDetectionService.test.ts`.

### 2.1 Inputs per SLO

```ts
interface DetectAnomalyInput {
  sloId: AnomalySloId;        // one of the 5 detectable SLOs
  current: number | null;     // current observed value (windowDays-scoped)
  baseline: AnomalySample[];  // last 24h, 1h buckets
  nowIso?: string;
}
```

### 2.2 Pipeline

1. **Filter baseline** — drop entries whose `observedValue` is `null` or
   non-finite (NaN / ±Infinity).
2. If fewer than `MIN_BASELINE_SAMPLES` (= **6**) valid samples remain,
   return `{ status: 'insufficient_data' }`. This protects cold-start
   dashboards from flapping the moment the very first hour ticks in.
3. If `current` is not a finite number, return
   `{ status: 'invalid_input' }`.
4. Compute the **mean** and the **population standard deviation**
   (divisor `n`, not `n-1`, because we are summarizing the entire
   observed sample — not estimating a population parameter).
5. If `stdev < MIN_BASELINE_STDEV` (= **0.0001**), return
   `{ status: 'insufficient_data' }`. A near-constant baseline gives a
   meaningless z-score (divide-by-near-zero).
6. Compute `z = (current - mean) / stdev`.
7. **Direction-aware classification** (see §3).
8. Return either a `detected` verdict with `severity ∈ { minor, major }`
   and a human-readable `reason`, or a `no_anomaly` verdict with the
   computed numbers attached for debugging.

### 2.3 Severity thresholds

| `|z|` magnitude | Severity |
|-----------------|----------|
| `|z| ≥ 3.5`     | `major`  |
| `|z| ≥ 2.5`     | `minor`  |
| `|z| < 2.5`     | none     |

Thresholds are exported as `MAJOR_Z_THRESHOLD` and `MINOR_Z_THRESHOLD`
constants at the top of the service file. To re-tune, edit those two
numbers and rerun the test suite — the tests are written against
mathematically-controlled baselines so any threshold drift is caught
deterministically.

## 3. Per-SLO direction interpretation

Each SLO has a "polarity" recorded in the `SLO_DIRECTION` table inside
the service. The detector only flags **regressions** — improvements
(current better than baseline) are reported as `no_anomaly` even when
their `|z|` exceeds the major threshold.

| SLO id                          | Polarity            | Flagged when… |
|---------------------------------|---------------------|---------------|
| `generation_success_rate`       | higher_is_better    | `current << baseline` (`z ≤ -2.5`) |
| `export_success_rate`           | higher_is_better    | `current << baseline` (`z ≤ -2.5`) |
| `agent_edit_success_rate`       | higher_is_better    | `current << baseline` (`z ≤ -2.5`) |
| `p95_generation_latency_ms`     | lower_is_better     | `current >> baseline` (`z ≥ +2.5`) |
| `export_blocked_rate`           | lower_is_better     | `current >> baseline` (`z ≥ +2.5`) |

Concrete example: if `generation_success_rate` jumps from a baseline of
70% to 95% (z = +5.0) the verdict is `no_anomaly` because acceptance
*rates* getting *better* is good news. The same z-magnitude in the other
direction (95% → 70%, z = -5.0) is a `major` anomaly.

## 4. Throttling and runtime events

Every `detected` verdict prompts the route layer to write a runtime
event of type `anomaly_detected` into `presentation_runtime_events`:

```jsonc
{
  "eventType": "anomaly_detected",
  "scope": "operations_health",
  "metadata": {
    "sloId": "<one of the 5 SLOs>",
    "severity": "minor" | "major",
    "direction": "above" | "below",
    "zScore": -3.42,
    "baselineMean": 95.6,
    "current": 81.2,
    "reason": "MAJOR anomaly on generation_success_rate: ..."
  }
}
```

To prevent spam from the dashboard's 60-second auto-refresh, the route
**throttles** writes per `(orgId, sloId)` for `ANOMALY_THROTTLE_MS`
(= **60 minutes**). The throttle is implemented as a best-effort
SELECT against `presentation_runtime_events`; if the table is missing
or the query throws, the throttle defaults to "allow write" and the
write itself is also wrapped in `try { ... } catch { ... }` — see the
"CRITICAL invariants" section below.

The 60-minute window matches the 24-hour baseline horizon: an operator
investigating the chip should be able to find the originating event in
the same hour, without paging being repeated every minute.

## 5. Visual semantics

The frontend (`PresentationOperationsHealthView.tsx`) renders an orange
chip in the corner of any SLO card whose anomaly verdict is
`status === 'detected'`:

| Severity | Tailwind tone                     | Notes |
|----------|-----------------------------------|-------|
| `major`  | `bg-orange-500 text-white`        | Solid orange for paging-grade anomalies. |
| `minor`  | `bg-orange-100 text-orange-800`   | Light orange for "look at this" anomalies. |

Other behaviors:

- The chip's `title` and `aria-label` carry the full anomaly `reason`
  so screen-reader users hear the deviation summary alongside the SLO
  label.
- Clicking anywhere on the card (including the chip) opens the existing
  drill-down panel for that SLO — the chip is intentionally rendered
  *inside* the same `<button>` element to keep keyboard / mouse focus
  behavior consistent.
- `insufficient_data`, `no_anomaly`, and `invalid_input` verdicts
  produce **no** chip. The card looks identical to Sprint 12.
- The chip coexists with the steady-state PASS / AT_RISK / BREACH
  pill; both are visible simultaneously.

## 6. Limitations

The implementation is intentionally simple. Known limitations, kept
explicit so future sprints can address them in order:

- **1-hour bucket granularity**. Sub-hour spikes are smoothed away.
  Sprint 14+ may add 5- or 15-minute buckets when the baseline horizon
  shrinks.
- **No seasonal awareness**. A weekday vs. weekend pattern shift can
  produce false positives early on Monday morning. Sprint 14+ may
  augment the baseline with same-day-of-week hourly samples from the
  prior week.
- **No trend filtering**. A slow drift over many hours that
  monotonically degrades the SLO will not be caught until the
  *current* value crosses the z threshold against the (also drifting)
  baseline. A separate trend detector is in scope for Sprint 14+.
- **z-score assumes near-Gaussian distribution**. Heavy-tailed metrics
  (latency in particular) can produce more false positives than
  success-rate metrics. The thresholds are deliberately conservative
  (`|z| ≥ 2.5` to fire) to keep precision high.
- **Best-effort, not authoritative**. A failed baseline fetch yields
  an empty `anomalies` array — the rest of the report still renders.
  Operators should never use the absence of a chip as proof that
  nothing is wrong.

## 7. Tuning the thresholds

Three tuning knobs live as `export const` declarations at the top of
`presentationOperationsAnomalyDetectionService.ts`:

```ts
export const MIN_BASELINE_SAMPLES = 6;
export const MIN_BASELINE_STDEV = 0.0001;
export const MAJOR_Z_THRESHOLD = 3.5;
export const MINOR_Z_THRESHOLD = 2.5;
```

To tune:

1. Edit the constant in the service file.
2. Update the corresponding test assertions in
   `__tests__/presentationOperationsAnomalyDetectionService.test.ts`.
3. Re-run `npx vitest run server/src/services/__tests__/presentationOperationsAnomalyDetectionService.test.ts`
   and ensure all 15 tests still pass.
4. Update the threshold table in §2.3 of this document.

A future sprint may move the constants into per-org configuration; for
now they are global to keep the surface area small.

## 8. Operator playbook — what to do when an anomaly fires

When you see an orange chip on an SLO card:

1. **Check the steady-state pill on the same card.** A `breach` pill
   plus an `Anomaly` chip means an active incident; a `pass` pill plus
   a `minor` `Anomaly` chip is an early warning.
2. **Click the card** to open the drill-down panel and inspect the
   30-day trend, top problematic decks, and recent event samples for
   that SLO. Look for a single deck driving the deviation.
3. **Inspect the originating event** in `presentation_runtime_events`:
   ```sql
   SELECT created_at, metadata_json
     FROM presentation_runtime_events
    WHERE organization_id = ?
      AND event_type = 'anomaly_detected'
    ORDER BY created_at DESC
    LIMIT 20;
   ```
   The `metadata_json.zScore`, `baselineMean`, and `current` fields
   tell you exactly how far off baseline the value is.
4. **Decide on action**:
   - `minor` — usually monitor; check again at the next refresh.
   - `major` — investigate immediately; engage the relevant on-call
     using the existing alert dispatch flow.
5. **Throttling reminder**: a single anomaly only emits ONE event per
   org+SLO per hour. If the chip stays orange for >1h with no new
   event, the situation has not improved — re-check with the SQL above.

## 9. Related files

- `server/src/services/presentationOperationsAnomalyDetectionService.ts`
  — pure detector + tunable constants.
- `server/src/services/__tests__/presentationOperationsAnomalyDetectionService.test.ts`
  — 15 unit tests pinning algorithm + thresholds.
- `server/src/services/presentationOperationsHealthService.ts`
  — `OperationsHealthAnomaly` and `OperationsHealthReport.anomalies`
  type extensions.
- `server/src/routes/presentations.routes.ts`
  — `/operations/health` and `/operations/health/export` integration,
  baseline bucketing, throttling, and runtime event emission.
- `src/services/presentationOperationsHealth.ts`
  — frontend type + payload normalizer.
- `src/views/superadmin/PresentationOperationsHealthView.tsx`
  — orange "Anomaly" chip rendering on the SLO grid.
