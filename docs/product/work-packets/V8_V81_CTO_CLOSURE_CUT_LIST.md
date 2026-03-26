# V8 + V8.1 CTO Closure Cut List

> Status: resolved by final closure declaration
> Date: 2026-03-26
> Purpose: convert the remaining `yellow` package tail into explicit `close now / hold / defer` decisions
> Final sign-off companion: `docs/product/work-packets/V8_V81_FINAL_SIGNOFF_MEMO.md`
> Final closure declaration: `docs/product/work-packets/V8_V81_WAVE_CLOSURE_DECLARATION.md`

---

## 1. Decision rule

From this point forward, work on `V8 + V8.1` is governed by one rule:

- do not expand product scope,
- do not chase broad parity where a bounded slice is already proven,
- only continue coding where the remaining gap still blocks closure of the frozen package.

The operating decision states are:

- `close now` - finish a bounded remaining gap because it is still cheap and material
- `hold bounded` - stop expanding; keep the current bounded V8 slice as the accepted closure target
- `defer` - explicitly move the remaining work out of the closure path

---

## 2. Close Now

These items are still worth closing inside the current wave because the remaining gap is bounded and the work is small relative to the confidence gain.

### `Calendar`

Decision: `close now`

Reason:

- bounded V8 routes already exist,
- route tests and fallback-guard tests already pass,
- current staging gap is specifically a clean create/recheck wave after `429` noise,
- this is a small closure step, not a large feature build.

Required finish line:

- one clean browser/API retest for governed calendar load + conflicts + create continuity,
- no legacy fallback in the same runtime window,
- if staging still only shows transient `429`, document that as infra noise and do not reopen product scope.

### `Organization / Admin / Superadmin`

Decision: `close now`

Reason:

- this area was under-proven rather than under-built,
- V8 admin routes exist for flags, health, metrics, and shadow diagnostics,
- new route regression now exists for those endpoints,
- this is now a bounded coherence validation problem, not a product implementation problem.

Required finish line:

- one operator-facing staging pass for the superadmin/admin V8 surfaces already in use,
- if the runtime matches the bounded admin route pack, mark this packet closed.

---

## 3. Hold Bounded

These items stay inside package truth, but we stop expanding them beyond the already proven bounded V8 slice.

### `Chat`

Decision: `hold bounded`

Reason:

- route coverage exists,
- staging smoke exists,
- the remaining ask is broader governed chat-chain parity, which is too open-ended for the current closure path.

Allowed work:

- regression fixes only if an existing bounded path breaks.

Not allowed:

- broader parity expansion across the full governed chat chain.

### `AI core`

Decision: `hold bounded`

Reason:

- route coverage exists,
- staging smoke exists,
- remaining gap is broader exposure/parity, not absence of a working bounded V8 lane.

### `Execution / delivery control`

Decision: `hold bounded`

Reason:

- read continuity is already broadly proven,
- route regression is strong,
- remaining gap is mostly broader write/operator parity still sitting on legacy.

Rule:

- do not expand write parity in this closure wave unless an existing bounded read/control slice regresses.

### `Results / KPI / ROI`

Decision: `hold bounded`

Reason:

- governed dashboard and runtime strip are proven,
- route tests and component regression exist,
- remaining gap is deeper KPI/ROI write/reconciliation breadth still on legacy.

Rule:

- accept the governed dashboard + runtime strip slice as the closure target for this wave.

### `Finance`

Decision: `hold bounded`

Reason:

- governed finance dashboard and runtime strip are proven,
- route tests and component regression now exist,
- remaining gap is downstream ingest/create/mutation parity, not absence of a V8-facing finance operator slice.

### `Partner Program`

Decision: `hold bounded`

Reason:

- broad partner read continuity is already staging-proven,
- route and component coverage exist,
- remaining gap is actual campaign/payout/referred-customer lifecycle completion.

Rule:

- do not reopen referral/payout CRUD as part of package closure.

### `Sync / connectors / interoperability`

Decision: `hold bounded`

Reason:

- inventory, auth health, escalation/conflict truth, connector auth-state mutation, and provider entry surface are already proven,
- route and component regressions now exist,
- remaining gap is provider connect/OAuth round-trip and broader provider mutation parity.

### `Multiplayer / collaboration`

Decision: `hold bounded`

Reason:

- persisted room-binding, presence, and locks are already proven on the operator-facing path,
- route, API, and component continuity checks now exist,
- remaining gap is websocket/live collaborative behavior, which is materially larger than the bounded current slice.

---

## 4. Defer

These items should not consume more closure capacity in the current wave.

### `Reports / Presentations`

Decision: `defer`

Reason:

- current blocker is structural split-brain (`API + UI split-brain remains`),
- this is not a small closure polish task,
- current component coverage already proves the unified hub and canonical data path,
- further work here is cleanup/refactor scope, not a cheap closure win.

### `Notes` adjunct side-lanes

Decision: `defer`

Reason:

- bounded notebook core lane is already proven,
- remaining work is specifically notebook adjunct/AI side-lanes,
- that is outside the cheapest path to package closure.

---

## 5. Closure Order From Here

Execution order:

1. `Calendar` clean bounded retest
2. `Organization / Admin / Superadmin` bounded staging coherence retest
3. freeze all `hold bounded` domains
4. explicitly mark `Reports / Presentations` and `Notes adjuncts` as deferred from the active closure path

---

## 5a. Execution Update

Current execution state after the latest bounded retests:

- `Calendar` remains the only active product-surface closure packet still waiting on one cleaner staging proof wave for create continuity; the current evidence already shows governed V8 reads/conflicts on staging with no matching legacy fallback in the same runtime window.
- `Organization / Admin / Superadmin` remains the only active operator-surface closure packet still waiting on one superadmin-grade staging proof wave; the bounded route/client contract is already covered and live staging already proves `GET /api/v8/admin/flags` from an authenticated admin surface.
- `Chat`, `AI core`, `Execution / delivery control`, `Results / KPI / ROI`, `Finance`, `Partner Program`, `Sync / connectors / interoperability`, and `Multiplayer / collaboration` are now frozen as `hold bounded` for the current finish path. Their remaining asks are broader parity breadth, not absence of a bounded V8 lane.
- `Reports / Presentations` and `Notes` adjunct side-lanes are now treated as explicitly outside the active closure path unless a previously proven bounded slice regresses.

Operational rule from this point:

- do not reopen any `hold bounded` or `defer` lane for broader parity work,
- only touch those domains again for regression containment,
- keep active closure energy on the two remaining narrow proof blockers above.

---

## 6. What No Longer Qualifies As Closure Work

The following are out of scope for the current finish path unless they break an already proven bounded slice:

- full write parity for `Execution`, `Results`, `Finance`, `Partner`
- provider OAuth round-trip completion in `Sync`
- websocket/live collaboration parity in `Multiplayer`
- broad chat/AI-core parity expansion beyond the already proven V8 routes
- outputs/report/presentation legacy cleanup
- notebook adjunct AI side-lanes

---

## 7. Acceptance Standard

A remaining packet is closure-ready when all of the following are true:

- bounded V8 route exists,
- bounded user/operator surface exists,
- automated regression exists for that bounded slice,
- one clean staging proof exists for the same slice,
- no new scope was added to make the proof pass.

If a packet fails that standard and fixing it requires new feature breadth, it must be deferred rather than expanded.
