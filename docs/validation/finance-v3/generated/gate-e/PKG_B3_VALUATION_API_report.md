# Pakiet B3 — Valuation HTTP Surface — gate-e verification report

Worktree: `/Users/piotrwisniewski/consultify-wt/fv3p-b3-valuationapi`
Branch: `codex/fv3p-b3-valuationapi`
Base compared against: `45c39d68d0`
Final SHA verified: **`48d1a8d327a1b67ef1505145a61f933af639e297`**
DB used: local ephemeral PostgreSQL 15, `postgresql://piotrwisniewski@127.0.0.1:54330/b3_valuation`
(cloned from `fv3_template` via `/Users/piotrwisniewski/fv3-pg/newdb.sh`, STRICT `db:migrate`, 637/637
migrations, per `/Users/piotrwisniewski/fv3-pg/INFRA_REPORT.md`).

## 0. Commits on this branch (`45c39d68d0..HEAD`)

```
48d1a8d327 fix(finance-v3/pkg-b3): sensitivity grid gridId bug + independent review test supplement   [THIS SESSION]
9604652e27 wip(finance-v3/pkg-b3): UNVERIFIED work-in-progress — session ended on token budget
bf936b868e feat(finance-v3/pkg-b3): mount Valuation HTTP surface — 21 new endpoints (32 -> 53 total)
df2cea805d feat(finance-v3/pkg-b3): thin Valuation CRUD/reader additions
```

### Files changed (`git diff --stat 45c39d68d0..HEAD`), counted, not assumed

```
 valuation-b3-review.routes.pg.test.ts (NEW, this session)         | 442 ++++++++++++
 valuation-cross-tenant.routes.pg.test.ts                          | 256 +++++++
 valuation.routes.pg.test.ts                                       | 655 +++++++++++++++++
 finance-v2/index.ts                                               |   6 +
 finance-v2/valuation.routes.ts                                    | 771 +++++++++++++++++++++
 canonical/valuationAdvisorService.ts                               |  25 +
 canonical/valuationBridgeService.ts                                |  44 ++
 canonical/valuationComputeService.ts                               |  69 ++
 canonical/valuationSensitivityService.ts (bugfix, this session)    |  66 (+64/-2)
 canonical/valuationTerminalService.ts                              |  32 +
 canonical/valuationVariantService.ts (NEW)                         | 246 +++++++
 canonical/valuationWaccService.ts                                  | 110 +++
 12 files changed, 2720 insertions(+), 2 deletions(-)
```

`valuationDiscountService.ts` / `valuationFcffService.ts` were NOT touched by B3 (pre-existing, Gate
D / WP-D10) — `runDcfFcffValuation()` only calls into them.

## 1. What each of the 21 endpoints actually does

All under `router` in `valuation.routes.ts`, mounted via `financeV2Router.use(valuationRoutes)` in
`index.ts` (line 57, after `crosscuttingRoutes`, no path overlap — own `/valuation/*` prefix).

| # | Method + path | What it does |
|---|---|---|
| 1 | `POST /valuation/cases` | Creates a `finance_valuation_cases` row (naming/grouping container, no lifecycle). |
| 2 | `GET /valuation/cases` | Lists an org's Cases. |
| 3 | `GET /valuation/cases/:caseId` | Case detail + its Variants (joined from `finance_valuation_variants`+`finance_business_versions`). |
| 4 | `POST /valuation/cases/:caseId/variants` | Registers an EXISTING `VALUATION_CASE` business version as a named Variant of a Case (never creates the business version itself). |
| 5 | `GET /valuation/variants/:businessVersionId` | Variant detail (name/description/status/freshness/versionNo). |
| 6 | `PATCH /valuation/variants/:businessVersionId` | Renames/redescribes a Variant (partial update; explicit `null` clears description). |
| 7 | `POST /valuation/cases/:caseId/compare-variants` | Structural EV/Equity/WACC/terminal-share/terminal-g diff between two variants of the same Case; `persist:true` also writes Advisor findings against variant A (DEC-FIN-005 pt.1 + DEC-FIN-006 pt.5, same function). |
| 8 | `GET /valuation/variants/:id/methods` | Lists a Variant's valuation methods + the weighted recommendation. |
| 9 | `POST /valuation/variants/:id/methods` | Find-or-create a method row for a `methodType` (idempotent on `(business_version_id, method_type)`). |
| 10 | `POST /valuation/variants/:id/methods/basket` | Atomic batch basket membership/weight update (one transaction, DB `DEFERRABLE` trigger validates sum=100 at COMMIT). |
| 11 | `GET /valuation/variants/:id/wacc-inputs` | Reads the WACC input bundle. |
| 12 | `PUT /valuation/variants/:id/wacc-inputs` | Upserts WACC inputs; editing resets `wacc_computed_pct`/`beta_relevered` to NULL (never silently stale). |
| 13 | `POST /valuation/variants/:id/compute/dcf` | Runs a real DCF/FCFF valuation (FCFF → WACC → terminal → discount → EV), persists the method result + `compute_jobs` bookkeeping. |
| 14 | `GET /valuation/variants/:id/results` | Full results contract: headline EV, weighted recommendation, methods, WACC, terminal, bridge, sensitivity grids, method-agreement warnings. |
| 15 | `GET /valuation/variants/:id/bridge` | Reads the EV→Equity bridge (header + components). |
| 16 | `PUT /valuation/variants/:id/bridge` | Computes Equity from signed components server-side, writes header+components (as-of alignment enforced by DB trigger). |
| 17 | `GET /valuation/methods/:methodId/terminal` | Reads terminal value row(s) (Gordon/exit-multiple) for a method. |
| 18 | `POST /valuation/methods/:methodId/sensitivity` | Builds + persists a 5×5 sensitivity grid (25 cells, exactly 1 base cell). |
| 19 | `GET /valuation/methods/:methodId/sensitivity/:gridLabel` | Reads a named sensitivity grid. |
| 20 | `POST /valuation/variants/:id/advisor/generate` | Runs the Advisor rule catalogue against a freshly-computed, pre-approval variant; persists findings anchored to a NEW `finance_compute_snapshots` row. |
| 21 | `GET /valuation/variants/:id/advisor` | Lists persisted Advisor findings for a variant. |

## 2. Mounting proof — 404-with-`code` vs. 404-without-`code`

One explicit differential test (`valuation.routes.pg.test.ts`, "★ dowód montażu") proves the general
mechanism on this router instance: `GET /valuation/variants/:randomId` → **404 `{code:'NOT_FOUND'}`**
(handler ran); a truly non-existent path on the SAME app → **404, no `code`**; the SAME real id on a
pre-B3 router (`modelsRoutes` only, `valuationRoutes` NOT mounted) → **404, no `code`**. Since all 21
routes are registered on the ONE `router` object this test exercises before `export default router`,
this is the structural proof of mounting for the whole file.

Per-endpoint proof that the HANDLER itself ran (not just "some route matched") — a typed error code
or a 2xx success is *stronger* evidence than a bare 404, since it proves the specific business logic
executed:

| # | Endpoint | Evidence it ran (file : test) |
|---|---|---|
| 1 | POST /cases | 201 in every test via `makeCase()` helper (all 3 files) |
| 2 | GET /cases | 200 list, org-scoped — cross-tenant "GET /cases (list) for org B never includes org A case" |
| 3 | GET /cases/:caseId | 200 (author "POST cases; POST variants...") + 404 `NOT_FOUND` (cross-tenant) |
| 4 | POST /cases/:caseId/variants | 201 (author) + 404 `CASE_NOT_FOUND` (cross-tenant) |
| 5 | GET /variants/:id | 200 (author) + 404 `NOT_FOUND` (★ dowód montażu, cross-tenant) |
| 6 | PATCH /variants/:id | 200 rename (author) + 404 (cross-tenant) |
| 7 | POST /cases/:caseId/compare-variants | 200 persist false/true (author) + 404 `ORGANIZATION_MISMATCH` (cross-tenant) |
| 8 | GET /variants/:id/methods | 200 (author, multiple) + 404 (cross-tenant) |
| 9 | POST /variants/:id/methods | 201 (author, multiple) + 400 `INVALID_BODY` (author) + 404 (cross-tenant) |
| 10 | POST /variants/:id/methods/basket | 200/409 `BASKET_WEIGHT_SUM_INVALID`/400 (author) + 404 (cross-tenant) + 404 `METHOD_NOT_FOUND` (author, cross-variant) |
| 11 | GET /variants/:id/wacc-inputs | 200 + 404 `NOT_FOUND` (none yet, author) + 404 (cross-tenant) |
| 12 | PUT /variants/:id/wacc-inputs | 200 + 400 `INVALID_BODY` (author) + 404 (cross-tenant) |
| 13 | POST /variants/:id/compute/dcf | 200 + 422 `FCFF_NOT_FULLY_PRESENT` (author) + 404 (cross-tenant) |
| 14 | GET /variants/:id/results | 200 (author) + 404 `ORGANIZATION_MISMATCH`, body leak-free (cross-tenant) |
| 15 | GET /variants/:id/bridge | 200 + 404 (author, none yet) + 404 (cross-tenant) |
| 16 | PUT /variants/:id/bridge | 200 + 400 `AS_OF_MISMATCH` (author) + 404 (cross-tenant) |
| 17 | GET /methods/:id/terminal | 200 (author) + 404 (cross-tenant) |
| 18 | POST /methods/:id/sensitivity | 200 (author, cross-tenant) + 200 repeat-call regression (review) |
| 19 | GET /methods/:id/sensitivity/:gridLabel | 200 (author) + 404 `NOT_FOUND` same-org-missing-label AND wrong-org (review, **gap closed this session** — neither author file had covered this specific endpoint's 404 shape) |
| 20 | POST /variants/:id/advisor/generate | 200 + 409 `NOTHING_COMPUTED` (author) + 404 (cross-tenant) |
| 21 | GET /variants/:id/advisor | 200 (author) + 404 (cross-tenant) |

All 21/21 have at least one typed non-2xx AND one 2xx exercised through real HTTP + real Postgres.

## 3. Cross-tenant matrix — HTTP result + independent SQL confirmation

Every row below is HTTP (org B against org A's resource) **plus** a direct `psql`-equivalent SQL
read/count confirming zero leakage/mutation, not just the HTTP status.

| Resource family | HTTP (org B on org A resource) | Independent SQL check |
|---|---|---|
| Case (read/list) | 404 `NOT_FOUND`; list never contains org A's case | `finance_valuation_cases` row untouched (not re-queried by id, list-scan confirms absence) |
| Variant registration | 404 `CASE_NOT_FOUND` | `SELECT ... finance_valuation_variants WHERE business_version_id=?` → `null`, zero rows written |
| Variant read/rename | 404 both ways | `SELECT name, organization_id ...` → name unchanged, `organization_id = orgA` |
| Methods list/create/basket | 404 all three | `SELECT ... finance_valuation_methods WHERE bv=? AND org=orgB` → 0 rows |
| Method terminal/sensitivity (methodId-scoped) | 404 both | `SELECT ... finance_valuation_sensitivity_grids WHERE method_id=? AND org=orgB` → 0 rows |
| WACC inputs read/write | 404 both | `SELECT ... finance_valuation_wacc_inputs WHERE bv=?` → `null` |
| Compute DCF | 404 | `SELECT ... compute_jobs WHERE input_artifact_id=... AND org=orgB` → 0 rows |
| Results | 404 `ORGANIZATION_MISMATCH`; `JSON.stringify(body)` does not contain the real EV (`42000000`) | Legit org A read on the SAME variant still returns 200 with the real value — proves the block is org-scoped, not a general failure |
| Bridge read/write | 404 both | `SELECT ... finance_valuation_ev_equity_bridge WHERE bv=?` → `null` |
| Advisor generate/list | 404 both | `SELECT ... finance_valuation_advisor_outputs WHERE bv=? AND org=orgB` → 0 rows |
| Compare-variants (persist:true, org A ids, org B caller) | 404 `ORGANIZATION_MISMATCH` | `SELECT ... finance_valuation_advisor_outputs WHERE bv=bvA AND is_comparison=true` → 0 rows (org B's attempted persist never committed) |

Root cause of the guarantee: every reader/writer in `valuationVariantService.ts` /
`valuationComputeService.ts` / `valuationWaccService.ts` / `valuationBridgeService.ts` /
`valuationSensitivityService.ts` / `valuationTerminalService.ts` scopes its `WHERE` by
`organization_id`, AND the route layer resolves the owning Variant/Method via `getVariant()`/
`getMethod()` (both org-scoped) BEFORE touching any child resource — belt (route) and suspenders
(service SQL) and braces (composite FK `(business_version_id, organization_id)` on the DB, W9-C-7
migration).

## 4. N/A ≠ PLN 0 — hard proof, three distinct states

Author suite proves MISSING (no compute yet) and PRESENT_NONZERO (a real computed value) are never
conflated, in two separate tests. This session's supplement (`★ TRZY STANY...` test) proves all
**three** states coexist and are distinguishable in the SAME response, through the SAME contract:

| State | How produced | `GET .../methods` shape | SQL shape |
|---|---|---|---|
| `MISSING` (no data) | fresh `findOrCreateMethod`, nothing computed | `{status:'MISSING', valueDecimal:null}` | `result_value_status='MISSING', result_ev_decimal=NULL` |
| `PRESENT_ZERO` (real zero) | `setMethodResult({readiness:'READY', resultValueStatus:'PRESENT_ZERO', resultEvDecimal:0})` | `{status:'PRESENT_ZERO', valueDecimal:0}` | `result_value_status='PRESENT_ZERO', result_ev_decimal=0` (physically stored, not NULL) |
| `PRESENT_NONZERO` | same function, real value | `{status:'PRESENT_NONZERO', valueDecimal:4200000}` | `result_ev_decimal=4200000` |

Bonus finding from the same test: with two READY methods and no basket configured, `GET .../results`
reports `headlineEnterpriseValue.source: 'NONE'`, `value: null` — the resolver refuses to silently
pick one of two competing results rather than guessing, consistent with the N/A discipline.

DB-layer negative control (bypassing `valuationComputeService.ts` and the route entirely): a raw SQL
`INSERT ... readiness='READY', result_value_status='MISSING'` is rejected by
`chk_finance_methods_result_matches_readiness` itself — confirmed by `.rejects.toThrow(...)` against
a real Postgres constraint violation, not a mocked assertion.

## 5. Test results

All runs: `RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=postgresql://piotrwisniewski@127.0.0.1:54330/b3_valuation NODE_ENV=test`, from `server/`.

| Run | Files | Tests | Exit code |
|---|---|---|---|
| Combined, all 3 files, final | `valuation.routes.pg.test.ts` + `valuation-cross-tenant.routes.pg.test.ts` + `valuation-b3-review.routes.pg.test.ts` | **31 passed, 0 failed** | **0** |
| `valuation.routes.pg.test.ts` alone | 1 file | 14 passed | 0 |
| `valuation-cross-tenant.routes.pg.test.ts` alone | 1 file | 11 passed | 0 |
| `valuation-b3-review.routes.pg.test.ts` alone (with the endpoint-19 gap-closing test added) | 1 file | 6 passed | 0 |

**Flake note (not a Valuation defect):** an EARLIER combined run of the first two files hit exit code
1 with 25/25 tests still green, due to `Unhandled Rejection: column "file_hash" of relation
"knowledge_docs" already exists` — a check-then-`ALTER TABLE ADD COLUMN` race in
`ensureKnowledgeDocColumn()` (`server/src/database/PostgresDatabase.ts`, generic schema-sync code,
outside this package's allowlist) when two test files' `initDb()` calls race inside the same vitest
process. Reproduced once, did not reproduce on the final combined run (all 3 files, exit 0) — i.e.
intermittent, order-dependent, not deterministic, and orthogonal to anything Valuation-specific. Ran
every file individually as well specifically to isolate this from B3 logic; all individual runs are
clean.

## 6. tsc

```
NODE_OPTIONS=--max-old-space-size=12288 npx tsc --noEmit -p server/tsconfig.json
```
Exit code **0**, zero errors, on two separate runs (before and after the sensitivity-grid fix). One
earlier attempt reported exit 144 with an EMPTY log — a harness-level hiccup (killed background task,
zero tsc output at all), not a real tsc failure; re-run immediately after produced a clean, non-empty,
exit-0 result both times. Flagged per the brief's own warning about not trusting a suspicious exit
code silently — this one had no output at all, which is why it was treated as infra noise and re-run
rather than accepted.

## 7. Negative controls

| # | What was broken | Expected red | Actual result |
|---|---|---|---|
| 1 | Direct SQL `INSERT` into `finance_valuation_methods` with `readiness='READY', result_value_status='MISSING'` | DB `CHECK` rejects | ✅ Rejected — `chk_finance_methods_result_matches_readiness` (confirmed via `.rejects.toThrow`) |
| 2 | Same, inverse shape: `readiness='NOT_CONFIGURED', result_value_status='PRESENT_ZERO', result_ev_decimal=0` | DB `CHECK` rejects | ✅ Rejected — same constraint |
| 3 | Direct SQL `UPDATE finance_valuation_methods SET is_in_recommendation_basket=true, weight_pct=60` (sum=60, not 100) | `DEFERRABLE` constraint trigger rejects at COMMIT | ✅ Rejected — `trg_finance_valuation_methods_weight_sum`; row confirmed rolled back by follow-up `SELECT` |
| 4 | Author suite's own negative control (already in the codebase, re-verified this session): basket rebalance 60/30=90 after a successful 60/40 | 409 `BASKET_WEIGHT_SUM_INVALID`, prior 60/40 must survive unchanged | ✅ Confirmed — `mB`'s `weight_pct` still 40 after the failed write |
| 5 | `writeSensitivityGrid()` gridId bug (found in review, not injected) | A repeat POST returns a `gridId` naming 0 rows | Confirmed via static analysis (discarded transaction return value) — fixed same session; regression test added and green post-fix |

**Layered-defense caveat (per the brief's own warning), stated explicitly:** negative controls #1–#3
above bypass ALL app-layer validation (route + service) by using raw SQL directly — they isolate the
DB layer ALONE. They do not by themselves prove which app-layer check would have caught the same bad
input in a real HTTP call (that is separately covered by the author suite's route-level 400/409
tests). Rolling back only the service-layer check without also bypassing the DB layer would very
likely NOT have reproduced any of these three — the DB constraints are the ultimate backstop and were
deliberately targeted directly for that reason.

## 8. Approval / snapshot — atomicity, idempotency, immutability

**Atomicity (confirmed):** `setBasketWeights()` writes the whole batch in ONE
`withPinnedPostgresTransaction` call; a rebalance that fails the weight-sum check at COMMIT leaves
EVERY row exactly as it was before the call (test #4 above, both in the author suite and re-verified
this session). `writeSensitivityGrid()`'s 25-cell insert + `grid_status='COMPLETE'` flip is one
transaction with its own `DEFERRABLE` constraint trigger, same discipline.

**Immutability once approved (confirmed structurally, not exercised end-to-end):** all seven
Valuation content tables (`finance_valuation_variants`, `_wacc_inputs`, `_methods`, `_terminal`,
`_ev_equity_bridge(+components)`, `_sensitivity_grids(+cells)`, `_comps`) carry a
`BEFORE INSERT OR UPDATE OR DELETE` trigger that raises if the parent `finance_business_versions.status
= 'APPROVED'` (WP-D09b migration 02, §9). `finance_valuation_advisor_outputs` freezes
(`is_frozen=true`) on the SAME transition via a shared, business-version-attached trigger and then
rejects any further mutation (`trg_finance_advisor_outputs_enforce_freeze`). **Not exercised
end-to-end in this session's tests** — driving a Variant through the real
`DRAFT → SUBMITTED → IN_REVIEW → APPROVED` transition chain requires `versions.routes.ts` /
`artifactVersionService.approveVersion()` machinery (role/SoD/freshness preconditions) that is Pakiet
B2's scope, not B3's; B3 only wraps tables that INHERIT that immutability via trigger, and does not
add or change any transition logic itself. Status: **PARTIAL** — structural proof (trigger exists,
reads correctly) is solid; a live end-to-end "approve then try to mutate via B3's own PUT
`/wacc-inputs`" HTTP test was not built this session (would need a B2-owned fixture setup outside
this package's allowlist to do properly). Flagging honestly rather than claiming full coverage.

**Idempotency — REAL DEFECT FOUND, confirmed live, not fixed (see rationale below):**
`POST /valuation/variants/:id/compute/dcf`, called twice with byte-identical bodies (same `entityId`
/ `projectionYears` / `terminal`, hence the SAME `computeJobService` idempotency key
`valuation-compute:${bvId}:${sha256({bvId,entityId,projectionYears,terminal})}`), does **NOT** replay
idempotently. `computeJobService.enqueue()` correctly resolves the second call to the SAME
`compute_jobs` row (`ON CONFLICT ... DO NOTHING` + read-back, confirmed by SQL: `compute_jobs` row
count identical before/after) — but `runDcfFcffValuation()` discards the `wasExisting` flag `enqueue()`
returns and unconditionally calls `computeJobService.claimById()`, whose `UPDATE ... WHERE status =
'queued'` matches nothing (the existing row is already `'succeeded'`). `claimById()` returns `null`,
and the function throws a raw, untyped `Error` ("failed to self-claim just-enqueued job ... row is no
longer 'queued'"), which `asyncHandler` forwards to Express's generic error handler as an **uncaught
500** — verified live: response body
`{"error":"valuationComputeService: failed to self-claim just-enqueued job ... — row is no longer
'queued' (concurrent claim or already terminal)"}`, status 500 (confirmed with a temporary debug
print during this session, then removed; the permanent regression test in
`valuation-b3-review.routes.pg.test.ts` asserts this behavior via the 500 status + message regex).

This is a **pre-existing, cross-cutting pattern**, not something Pakiet B3 introduced:
`baselineComputeService.ts`, `predictionComputeService.ts`, and `kpiComputeService.ts` all discard
`enqueue()`'s `wasExisting` the exact same way (`grep -n "wasExisting" server/src/services/finance/canonical/*.ts`
finds it declared only in `computeJobService.ts`'s own return type — never read at any of the four
call sites). Pakiet B3 is simply the FIRST package whose HTTP surface makes the Valuation instance of
it reachable from outside a direct service-level test. **Not fixed in this package**: the file that
would need to change to fix it correctly (`computeJobService.ts`, or a coordinated fix across all
four `*ComputeService.ts` files) is outside this package's allowlist
(`server/src/services/finance/canonical/valuation*.ts` only covers the Valuation-specific file, and a
solo fix there without touching the shared `computeJobService.ts` semantics, or without knowing what
the other three packages need, risks diverging from a decision that isn't this package's to make
alone). Reported here as a confirmed, reproducible **P1** for the program to triage centrally, with a
regression test already in place that documents the exact current (broken) behavior so a future fix
attempt has an executable specification of both the bug and the desired behavior.

## 9. Method weights (point 7)

Confirmed structurally and by test: `computeWeightedRecommendation()` only sums basket members
(`is_in_recommendation_basket=true`); cross-checks are excluded from the weighted EV by construction
(filtered out before the reduce). The route enforces cross-checks NEVER carry a weight
(`weightPct` must be `null` when `isInRecommendationBasket=false`, checked before any DB write) and
the DB CHECK (`chk_finance_methods_weight_basket_only`) backs that physically. Sum-to-100 is enforced
by the DEFERRABLE trigger described in §7/§8 above. Both properties re-confirmed with a DB-layer
negative control in §7.

## 10. Decimal / determinism (point 10)

All Valuation monetary/percentage columns are Postgres `NUMERIC` (verified in both migration files —
zero `FLOAT`/`REAL`/`DOUBLE PRECISION` columns anywhere in the Valuation schema). `computeFcffSeries()`
(`valuationFcffService.ts`, pre-existing) explicitly sorts rows in memory by a computed `periodRank`
before use (`[...rowsForLine].sort(...)`), not relying on SQL row order. `listMethods()`'s
`ORDER BY method_type` is safe specifically because `method_type` is unique per
`business_version_id` (`uq_finance_valuation_methods_bv_type`) — an `ORDER BY` on a column that is
guaranteed unique within the result set IS a fully deterministic order (no tie-breaking ambiguity),
unlike the class of bug the memory note about a non-deterministic semantic hash describes (that bug
came from a query with NO `ORDER BY` at all). Not a defect; noted for completeness since the brief
asks this to be checked explicitly.

## 11. Deliverables checklist — PASS / FAIL / PARTIAL / EVIDENCE_MISSING / BLOCKED_EXTERNAL

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | Read full diff, describe all 21 endpoints | PASS | §1 |
| 2 | tsc clean, correct exit code discipline | PASS | §6 — exit 0 twice, one harness hiccup identified and not trusted blindly |
| 3 | Both test files runnable from `server/`, exit codes checked | PASS | §5 — 31/31, exit 0 combined; all individually clean too |
| 4 | Mounting proof (404-with-code vs. without) for all 21 endpoints, table | PASS | §2 — one gap (endpoint 19) found and closed this session |
| 5 | Cross-tenant matrix, HTTP + independent SQL, all endpoint families | PASS | §3 |
| 6 | N/A ≠ PLN 0 hard proof, three distinct states | PASS | §4 — extended beyond the two-state author coverage to a genuine three-state test |
| 7 | Method weights: basket=100%, cross-checks unweighted | PASS | §9 |
| 8 | Approval/snapshot: atomicity, idempotency, immutability | PARTIAL / DEFECT FOUND | §8 — atomicity PASS; immutability structurally PASS but not exercised end-to-end (PARTIAL, reason given); idempotency is a confirmed, reproduced, unfixed P1 (see rationale for not fixing solo) |
| 9 | Negative controls for every gating test, with layered-defense caveat | PASS | §7 |
| 10 | Decimal, deterministic ordering | PASS | §10 |

No item is silently marked done. The one genuine gap (item 8, compute idempotency) is reported with
full reproduction, root cause, blast radius (3 other services share the same pattern), and an explicit
reason it was not fixed solo inside this package's allowlist.
