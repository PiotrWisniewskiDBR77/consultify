# Valuation Advisor — rule-based content generator

**Program:** `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md` section 9
("Valuation Advisor")
**Schema:** `WP-D09_valuation_schema_ADR.md` section 12 + `WP-D09b_valuation_migration_report.md`
**Sequencing dependency:** `BUGFIX_IF19_ADVISOR_SEQUENCING_report.md`
(`artifactVersionService.createComputeSnapshot()`)
**Result sources read:** `valuationComputeService.ts`, `valuationWaccService.ts`,
`valuationTerminalService.ts`, `valuationBridgeService.ts`, `valuationSensitivityService.ts` (WP-D10)
**Worktree:** `/Users/piotrwisniewski/consultify-wt/gate-a-20260809`, branch
`codex/finance-v3-gate-a-20260809`, base `1b0fd76c0c`
**Date:** 2026-08-10

---

## 1. What existed before, and what this work package adds

Before this package, the Valuation Advisor existed **only as storage and lifecycle mechanics**: the
`finance_valuation_advisor_outputs` table with its AI-policy columns, the
`finance_valuation_advisor_output_variants` compare bridge, the freeze-on-approval and
stale-on-recompute triggers (WP-D09b), and — after IF-19 — the pre-approval `compute_snapshot_id`
path that makes writing an Advisor row physically possible at all. `WP-D10` says so in its own
section 8 ("Valuation Advisor… entirely schema-only… not touched by this WP"), and the IF-19 bugfix
report closes with "**No `AdvisorGenerationService`. Still not built.**"

Nothing produced any content. Every Advisor row that had ever existed in this program was written by
a test or by the GoldCo integration script, by hand.

This package adds the generator: **`server/src/services/finance/canonical/valuationAdvisorService.ts`**,
a deterministic rule engine that reads a freshly computed valuation variant and emits facts,
hypotheses, risks, questions and recommended actions — each with an evidence pointer, an impact and a
confidence — plus a variant-compare entry point. It is the **first production caller of
`createComputeSnapshot()`**, which was added for exactly this consumer.

## 2. Scope decision: rule-based now, AI-based later, same data contract

**This generator calls no external LLM API.** No provider key, no network socket, no model budget.
That is a deliberate scope decision for this package, not an omission:

- The handoff's "wymagana polityka AI" (provider/model/prompt version, residency/no-training,
  cost/rate-limit, evidence digest, hallucination evaluation) describes governance for a **future
  LLM-based Advisor**. Those columns are `NOT NULL` today, so they must be filled by whatever writes
  Advisor rows now.
- Filling them with an invented provider name would be a lie in the audit trail. Instead the
  generator records what it actually is: `ai_provider='CONSULTIFY_RULE_ENGINE'`,
  `ai_model='valuation-advisor-rules'`, `ai_prompt_version='rules-v1.0.0'` (the rule-catalogue
  version — the rule-engine equivalent of pinning a prompt),
  `ai_residency_region='IN_PROCESS_NO_EGRESS'`, `ai_no_training_commitment=true`,
  `ai_estimated_cost_decimal=0`, `ai_rate_limit_bucket=NULL`.
- **The swap to an LLM is a change of one function.** `evaluateAdvisorRules(snapshot) →
  AdvisorFinding[]` is pure and I/O-free. Replacing its body with a model call, and
  `ADVISOR_GENERATOR_PROVENANCE` with the real provider, leaves untouched: the persisted row shape,
  the evidence-pointer contract, the freeze/staleness mechanics, the compute-snapshot sequencing,
  `compareVariantsForAdvisor()`, and both public entry points. The data contract is written once,
  here, for both generations of the Advisor.

A rule engine is also the only version of the Advisor that can be **proved** correct in CI, which is
why the thresholds live in one exported constant (`ADVISOR_THRESHOLDS`) and the catalogue in another
(`ADVISOR_RULES`) — the test asserts the catalogue and the fired rules agree, so this report's rule
table and the code cannot silently drift apart.

## 3. Reads results, computes nothing

The Advisor never re-derives a valuation number. It reads what the WP-D10 engines already persisted
and reasons *about* those results:

| Layer | Table read | Never recomputed |
|---|---|---|
| Methods / basket | `finance_valuation_methods` | EV per method; the weighted basket is re-aggregated through `valuationComputeService.computeWeightedRecommendation()`, not re-implemented |
| Terminal | `finance_valuation_terminal` | terminal value, terminal share |
| WACC | `finance_valuation_wacc_inputs` | `wacc_computed_pct`, `beta_relevered` |
| EV→Equity | `finance_valuation_ev_equity_bridge(_components)` | EV, equity value |
| Sensitivity | `finance_valuation_sensitivity_grids/_cells` | cell values; monotonicity is checked via `valuationSensitivityService.findMonotonicityViolation()` |
| Peers | `finance_valuation_comps` | usable-peer count, same predicate as the D09b readiness trigger |
| Freshness | `finance_business_versions` | — |

The only arithmetic performed is *comparison* arithmetic over already-computed values (a difference,
a ratio, a dispersion). Never a discount factor, never a terminal value. A dedicated test takes a
fingerprint of methods/WACC/bridge before and after generation and asserts byte equality.

## 4. Rule catalogue — trigger → output

34 rules: 28 single-variant (`ADV-R*`) and 6 variant-compare (`ADV-C*`). All thresholds are exported
as `ADVISOR_THRESHOLDS`; the table below quotes their shipped values.

### 4.1 Single-variant rules

| Rule | Kind | Trigger | Output | Confidence |
|---|---|---|---|---|
| ADV-R01 | FACT | primary terminal row has `terminal_share_pct` | Terminal share of EV + terminal amount | HIGH |
| ADV-R02 | HYPOTHESIS | `terminal_share_pct` > **75%** | "Result is driven by terminal assumptions rather than the explicit forecast" | HIGH above 85%, else MEDIUM |
| ADV-R03 | RISK | `terminal_share_pct` > **75%** | Terminal-value concentration; impact = terminal amount | HIGH above 85%, else MEDIUM |
| ADV-R04 | ACTION | R03 fires and the method has no `EXIT_MULTIPLE` terminal row | "Add an exit-multiple terminal cross-check" | MEDIUM |
| ADV-R05 | RISK | `WACC − g` < **2 pp** | Narrow Gordon spread — denominator numerically fragile | HIGH |
| ADV-R06 | RISK | `\|g − reinvestment_rate × ROIC\|` > **0.5 pp** | Terminal g not reconciled with steady state | HIGH |
| ADV-R07 | QUESTION | primary Gordon row missing `reinvestment_rate_pct` or `roic_pct` | "What steady-state reinvestment and ROIC support terminal g?" | MEDIUM |
| ADV-R08 | FACT | basket complete (all members READY) | Weighted recommendation EV + per-method contributions | HIGH |
| ADV-R09 | RISK | a basket member is not READY | Basket incomplete — weights are NOT silently re-normalised | HIGH |
| ADV-R10 | RISK | no method in the basket | No weighted recommendation exists | HIGH |
| ADV-R11 | RISK | ≥2 READY methods and dispersion > **20%** of mean | Low method agreement | HIGH above **40%**, else MEDIUM |
| ADV-R12 | FACT | ≥2 READY methods | Method spread: min/max EV, dispersion % of mean | HIGH |
| ADV-R13 | RISK | no `TRADING_COMPS`/`PRECEDENT_TRANSACTIONS` with ≥1 usable peer | No market cross-check ("Not configured", explicitly not a zero) | HIGH |
| ADV-R14 | ACTION | same trigger as R13 | "Configure a trading-comps peer set" | MEDIUM |
| ADV-R15 | FACT | ≥1 `COMPLETE` grid with ≥2 defined cells | Sensitivity band min…max, width as % of base cell | HIGH |
| ADV-R16 | RISK | band width > **60%** of base cell | Wide sensitivity band — point estimate weakly determined | MEDIUM |
| ADV-R17 | RISK | `findMonotonicityViolation()` returns a violation | Grid not monotonic in WACC/g — grid or model suspect | HIGH |
| ADV-R18 | ACTION | no `COMPLETE` grid at all | "Run the 5×5 WACC × terminal-g sensitivity before approval" | HIGH |
| ADV-R19 | QUESTION | ≥1 undefined cell (`g ≥ WACC`) | "N of 25 cells undefined — is the axis range appropriate?" | MEDIUM |
| ADV-R20 | FACT | `wacc_computed_pct` present | WACC + cost of equity, after-tax cost of debt, target structure | HIGH |
| ADV-R21 | RISK | no WACC row, or `wacc_computed_pct IS NULL` | Discount rate never computed (NULL, deliberately not a silent zero) | HIGH |
| ADV-R22 | QUESTION | `\|target debt% − current debt%\|` > **15 pp** | "Is the transition to the target capital structure financeable?" | MEDIUM |
| ADV-R23 | RISK | `cost_of_debt_pretax_pct` < `risk_free_rate_pct` | Negative implied credit spread — inconsistent inputs | HIGH |
| ADV-R24 | FACT | EV→Equity bridge exists | EV → equity, net adjustments, component count, as-of | HIGH |
| ADV-R25 | ACTION | no bridge | "Complete the EV→Equity bridge before approval" | HIGH |
| ADV-R26 | RISK | bridge equity value ≤ 0 | Non-positive equity — a solvency statement, named as one | HIGH |
| ADV-R27 | RISK | `\|Σ adjustments\| / EV` > **50%** | Bridge adjustments dominate the equity result | MEDIUM |
| ADV-R28 | RISK | `finance_business_versions.freshness != 'CURRENT'` | Advisor ran on a candidate not marked freshly computed | HIGH |

### 4.2 Variant-compare rules (`compareVariantsForAdvisor`)

Deltas are always **B − A**, A being the primary variant.

| Rule | Kind | Trigger | Output |
|---|---|---|---|
| ADV-C01 | FACT | both variants have a headline EV | ΔEV absolute and %, with each side's EV source named |
| ADV-C02 | FACT | both have `wacc_computed_pct` | ΔWACC in pp |
| ADV-C03 | FACT | both have a primary terminal share | Δterminal share in pp |
| ADV-C04 | HYPOTHESIS | `\|ΔEV\|` > **25%** and `\|ΔWACC\|` ≥ **1 pp** | "The EV gap is largely a discount-rate effect"; HIGH at ≥2 pp |
| ADV-C05 | RISK | `\|ΔEV\|` > **25%**, `\|ΔWACC\|` < **1 pp**, `\|Δterminal share\|` < **5 pp** | Material gap unexplained by rate or terminal profile — it sits in the operating forecast |
| ADV-C06 | FACT | both have a bridged equity value | Δequity value absolute and % |

### 4.3 Headline-EV resolution (shared by both entry points)

One resolution order is used by the single-variant rules **and** by compare, so an EV quoted in a
comparison can never come from a different layer than the EV quoted in a fact:
`BRIDGE` → `WEIGHTED_BASKET` → `SINGLE_READY_METHOD` → `NONE` (`value: null`, never a silent zero).

## 5. Sequencing: the Advisor writes before approval, and is frozen by it

`generateValuationAdvisorOutput()` obtains its `compute_snapshot_id` from
`artifactVersionService.createComputeSnapshot()` — the IF-19 path — while the business version is
still `DRAFT`/`READY_FOR_REVIEW`/`IN_REVIEW`/`NEEDS_CHANGES`. It refuses (`INVALID_STATUS`) once the
version is `APPROVED`/`SUPERSEDED`/`ARCHIVED`/`INVALIDATED`, mirroring
`finance_valuation_advisor_outputs_no_new_after_approval()` rather than racing it.

Re-running replaces only this generator's **own unfrozen, non-comparison** rows for that business
version (`is_comparison = false AND is_frozen = false AND ai_provider = 'CONSULTIFY_RULE_ENGINE'`),
so the panel never accumulates duplicates and anything already frozen by approval is untouchable.
Comparison rows are scoped by `driver_ref = 'VARIANT_COMPARE:<variantB>'`, so re-comparing A-vs-B
never disturbs a stored A-vs-C comparison.

Live-confirmed in section 7: on approval, all findings flip to `is_frozen=true` with `frozen_at` set,
`is_stale` stays `false` (the freeze trigger sorts before the stale trigger by name), `approveVersion()`
reuses the Advisor's own pre-approval snapshot rather than minting a second one, and a subsequent
`UPDATE` on a frozen row is rejected by the database.

## 6. Evidence grounding — an honest `ai_hallucination_eval_status`

Every finding carries `evidence_ref.pointers[]`: `{table, column, rowId, observedValue, label}` —
the exact cell each number came from. `evaluateEvidenceGrounding()` re-reads every pointer straight
from the database and compares it against the claimed value, validating table and column against a
closed allow-list before either identifier reaches SQL. `PASSED` = every pointer resolved and agreed;
`FLAGGED` = at least one did not.

For a rule engine this covers the *entire* hallucination surface: there is no free-text generation,
so a finding can only be wrong by pointing at a cell that does not exist or by quoting a value the
cell does not hold. The status is computed, **never hardcoded** — and a test proves it (section 7.3).

## 7. Verification — real PostgreSQL, real results

### 7.1 Environment

Own ephemeral cluster, isolated from every shared instance:

- PostgreSQL 15.15 (Homebrew), `initdb --locale=C --encoding=UTF8`, `LC_ALL=C`
- data directory `/private/tmp/valadv-pgdata-20260810` (outside the repo), socket `/private/tmp/vadv-sk`
- port **56117**, inside the 55000–59999 range and confirmed free via `lsof -i:56117` before use —
  never 5432/28711/52824/57900/28933
- full migration set applied with `server/scripts/migrate.postgres.ts` **without `--safe`** (so a
  failed migration could not be silently downgraded to `skipped`): exit 0, `✅ Postgres migrations
  complete`, 1425 tables in `public`, all 12 `finance_valuation_*` tables present
- torn down at the end of the session with `pg_ctl -m fast stop` + `rm -rf` on both the data
  directory and the socket directory

```
DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
  DATABASE_URL=postgresql://postgres@127.0.0.1:56117/finance_v3_valadv \
  npx vitest run --config vitest.config.ts \
    src/services/finance/canonical/__tests__/valuationAdvisorService.pg.test.ts \
    --no-file-parallelism        # run from server/
```

### 7.2 Results

**New suite: `valuationAdvisorService.pg.test.ts` — 21 tests, 21 passed, 0 failed.**

**Whole canonical package (regression): 16 test files, 209 tests, all passed.**

**Whole `src/services/finance` tree: 21 files, 350 tests, 349 passed, 1 failed** — the single failure
is `workspace/__tests__/workspaceContracts.test.ts > AP-09 workspaceBarContract > fits every module at
1280 px` (`analysis: needs 1484px of 1280px`), an **untracked, in-progress package belonging to a
parallel session** (`server/src/services/finance/workspace/`, outside this package's allowlist and
never imported by it). Excluding that directory: **20 files, 272 tests, all passed.**

Type check: `npx tsc --noEmit -p server/tsconfig.json` reports **exactly one error, and it is not in
either new file** — a pre-existing `TS2322` in `lineageService.ts:177`
(`ASSUMPTION_SNAPSHOT_HASH_FORBIDDEN` missing from `InsertEdgeResult`), present on `1b0fd76c0c`
before this work. Zero errors in `valuationAdvisorService.ts` and its test.

### 7.3 Negative control — the tests can actually go red

Green tests prove nothing until they are shown to fail. Two mutations were applied to the shipped
service and the suite re-run:

| Mutation | Result |
|---|---|
| `terminalShareHighPct: 75 → 95` (the terminal-dominance threshold) | **2 tests failed** — "the two variants produce DIFFERENT… facts, hypotheses and risks" and "fires the terminal-dominance… rules on the downside variant". 15 passed. |
| `statuses.push(ok ? 'PASSED' : 'FLAGGED')` → `statuses.push('PASSED')` (hardcode grounding) | **1 test failed** — "FLAGS a finding whose evidence pointer does not resolve, and one that quotes a value the cell does not hold". 16 passed. |

Both mutations were reverted and the suite re-run green (verified by `grep` that the original lines
are back before committing).

**Rule coverage: 34 of 34.** Every rule in the published catalogue fires against the real database in
this suite, and a dedicated guard test proves it — it queries
`SELECT DISTINCT evidence_ref->>'ruleId'` for the run's organization and asserts the set equals
`ADVISOR_RULES`. Adding a rule without a fixture that reaches it turns that test red.

### 7.4 Fixtures

Five variants of one `finance_valuation_case`, built through the real schema (every DB trigger in the
path actually fired — basket weight-sum, comps readiness, g<WACC, the 25-cell/1-base sensitivity gate,
bridge as-of alignment):

- **"Base case"** — WACC 9.50%, DCF_FCFF 1 000 000 @60% + TRADING_COMPS 1 100 000 @40% (3 peers),
  terminal share 60%, g 2.5% with reinvestment 25% × ROIC 10% (reconciles exactly), full bridge
  (equity 850 000), a strictly monotonic 25-cell grid, freshness `CURRENT`.
- **"Downside"** — WACC 13.00%, DCF_FCFF 600 000 @100% + unweighted ASSET_BASED 1 000 000, terminal
  share 86.7%, g 11.5% (spread 1.5 pp) with no reinvestment/ROIC recorded, no comps, no grid, bridge
  to **negative** equity (−30 000), cost of debt 3.5% below the 4.0% risk-free rate, freshness
  `NEVER_COMPUTED`.

- **"Degenerate"** — no `finance_valuation_wacc_inputs` row at all, no basket, no bridge, terminal
  g 8% against reinvestment 50% × ROIC 10% (implies 5% — a 3 pp gap), and a `COMPLETE` grid that is
  simultaneously wide (140% of base), anti-monotonic and 3-cells undefined. Fires exactly
  `R01, R06, R10, R13, R14, R15, R16, R17, R19, R21, R25, R28`.
- **"Half-baked basket"** — DCF_FCFF READY @60% plus TRADING_COMPS `NOT_CONFIGURED` @40% (weights
  still sum to 100, so the DB weight-sum trigger is satisfied). Fires `ADV-R09` and, correctly,
  neither `R08` (no weighted result exists) nor `R10` (a basket does exist).
- **"Same rate, lower forecast"** — a clone of the base case with EV 40% lower at an identical WACC
  and identical terminal share, built to reach `ADV-C05`.

One fixture note worth recording: `finance_valuation_methods_check_comps_readiness()` is a
**non-deferred** `BEFORE` trigger, while peer rows FK to the method. A comps method can therefore only
be created `NOT_CONFIGURED`, then have peers inserted, then be promoted to `READY` — method → comps →
`UPDATE` is the only sequence the schema permits, not a test workaround.

### 7.5 Real generated output

Base case — **7 findings** (6 FACT, 1 QUESTION):

```
ADV-R01 | FACT     | Terminal value is 60.00% of enterprise value                          | HIGH
ADV-R08 | FACT     | Weighted recommendation: enterprise value 1 040 000                    | HIGH
ADV-R12 | FACT     | Method spread: 9.5% across 2 ready methods                             | HIGH
ADV-R15 | FACT     | Sensitivity band on "WACC x terminal g": 800 000 … 1 200 000           | HIGH
ADV-R20 | FACT     | WACC = 9.50%                                                           | HIGH
ADV-R22 | QUESTION | Target capital structure differs from current by 20.0pp                | MEDIUM
ADV-R24 | FACT     | EV 1 000 000 → equity 850 000                                          | HIGH
```

Downside — **19 findings** (5 FACT, 1 HYPOTHESIS, 8 RISK, 2 QUESTION, 3 ACTION):

```
ADV-R01 | FACT       | Terminal value is 86.70% of enterprise value                         | HIGH
ADV-R02 | HYPOTHESIS | The valuation is driven by terminal assumptions rather than the
                       explicit forecast                                                    | HIGH
ADV-R03 | RISK       | Terminal-value concentration                                         | HIGH
ADV-R04 | ACTION     | Add an exit-multiple terminal cross-check                             | MEDIUM
ADV-R05 | RISK       | Narrow terminal spread: WACC − g = 1.50pp                             | HIGH
ADV-R07 | QUESTION   | What steady-state reinvestment and ROIC support terminal g = 11.50%?  | MEDIUM
ADV-R08 | FACT       | Weighted recommendation: enterprise value 600 000                     | HIGH
ADV-R11 | RISK       | Low method agreement (50.0% dispersion)                               | HIGH
ADV-R12 | FACT       | Method spread: 50.0% across 2 ready methods                           | HIGH
ADV-R13 | RISK       | No market cross-check — the intrinsic result is unbenchmarked         | HIGH
ADV-R14 | ACTION     | Configure a trading-comps peer set                                    | MEDIUM
ADV-R18 | ACTION     | Run the 5×5 WACC × terminal-g sensitivity before approval             | HIGH
ADV-R20 | FACT       | WACC = 13.00%                                                         | HIGH
ADV-R22 | QUESTION   | Target capital structure differs from current by 20.0pp               | MEDIUM
ADV-R23 | RISK       | Pre-tax cost of debt is below the risk-free rate                      | HIGH
ADV-R24 | FACT       | EV 600 000 → equity -30 000                                           | HIGH
ADV-R26 | RISK       | Equity value is not positive after the bridge                         | HIGH
ADV-R27 | RISK       | Bridge adjustments are 105.0% of enterprise value                     | MEDIUM
ADV-R28 | RISK       | Advisor ran against a candidate whose freshness is NEVER_COMPUTED     | HIGH
```

Variant compare (primary = Downside, compared against = Base case) — **5 findings**:

```
ADV-C01 | FACT       | Enterprise value: "Base case" is 400 000 higher than "Downside"
ADV-C02 | FACT       | Discount rate differs by -3.50pp
ADV-C03 | FACT       | Terminal share differs by -26.70pp
ADV-C04 | HYPOTHESIS | The enterprise-value gap between the variants is largely a discount-rate effect
ADV-C06 | FACT       | Equity value differs by 880 000
```

Note ADV-C05 correctly does **not** fire: the 40% EV gap comes with a 3.5 pp WACC gap, so the
discount-rate hypothesis (C04) applies and the "unexplained gap" risk does not.

One finding in full, as persisted (`ADV-R05`, Downside):

> **Narrow terminal spread: WACC − g = 1.50pp**
> The Gordon denominator is (WACC − g) = 13.00% − 11.50% = 1.50pp, below the 2pp guardrail. At this
> spread the terminal value is hypersensitive: a 0.5pp move in either input changes it
> disproportionately, which is a property of the formula, not of the business.

```json
{
  "ruleId": "ADV-R05",
  "generator": "RULE_ENGINE",
  "rulesVersion": "rules-v1.0.0",
  "impactUnit": "PP",
  "derived": { "spreadPp": 1.5, "thresholdPp": 2 },
  "pointers": [
    { "table": "finance_valuation_terminal",   "column": "g_pct",             "rowId": "db9187d9-…", "observedValue": 11.5, "label": "Terminal growth g" },
    { "table": "finance_valuation_wacc_inputs","column": "wacc_computed_pct", "rowId": "8d583df0-…", "observedValue": 13,   "label": "Computed WACC" }
  ]
}
```
`ai_evidence_digest = sha256:eb364340a8a834df71f955325e23a951973b21be625f18e61c6e3329145c28ea`,
`ai_hallucination_eval_status = PASSED`.

### 7.6 What the 21 tests assert

1. findings are written against a **pre-approval** snapshot while the variant is still `DRAFT`
   (the IF-19 path), nothing frozen, nothing stale;
2. every finding has a title, a narrative, an evidence ref, a driver and a confidence;
3. the two variants produce **different, non-identical** rule sets, counts and narratives — including
   different numbers inside the rules that fire for both;
4. the base fixture fires exactly `R01/R08/R12/R15/R20/R22/R24` and **none** of the stress rules;
5. the downside fixture fires terminal-dominance, narrow-spread, no-comps, dispersion, bridge and
   freshness rules with the expected confidences and impacts;
6. determinism — two evaluations of the same snapshot are byte-identical;
7. provenance is rule-engine, cost 0, and each finding's evidence digest is distinct;
8. every generated finding grounds to `PASSED`;
9. grounding **FLAGS** an unresolvable row id, a wrong quoted value, and a column outside the
   allow-list;
10. re-running replaces rather than duplicates, and reuses the same compute snapshot;
11. generation changes no valuation data (byte-identical fingerprint of methods/WACC/bridge);
12. refuses a non-`VALUATION_CASE` artifact, a variant with nothing computed, and a foreign
    organization;
13. compare returns the expected EV/equity/WACC/terminal deltas and the expected comparison rules;
14. compare rejects a variant outside the Case and a self-comparison;
15. persisted comparisons write both variants into the many-to-many bridge with
    `PRIMARY`/`COMPARED_AGAINST`, and re-persisting replaces rather than duplicates;
16. **freeze on approval**: all rows flip to `is_frozen=true` with `frozen_at` set and `is_stale=false`,
    `approveVersion()` reuses the Advisor's own snapshot, a later generation attempt returns
    `INVALID_STATUS/APPROVED`, and a direct `UPDATE` on a frozen row is rejected by the trigger;
17. the structural-gap fixture fires `R06/R10/R16/R17/R19/R21/R25` and, correctly, not `R07`/`R20`;
18. `ADV-R09` fires for an incomplete basket whose weights still sum to 100;
19. `ADV-C05` fires — and `ADV-C04` does not — when a 40% EV gap comes with an identical WACC and an
    identical terminal share;
20. the exported rule catalogue has unique ids and its declared kind matches every fired finding;
21. **every one of the 34 catalogue rules actually fired and landed in the database** (coverage guard).

## 8. Files changed

- `server/src/services/finance/canonical/valuationAdvisorService.ts` — **new**, 1958 lines.
- `server/src/services/finance/canonical/__tests__/valuationAdvisorService.pg.test.ts` — **new**, 847 lines.
- This report — **new**.

Nothing else. No migration, no change to any existing service, no change to the D09/D09b schema —
the storage and lifecycle mechanics were already correct; only the content generator was missing.

## 9. What was deliberately NOT done

- **No external LLM call.** See section 2. The seam for it is `evaluateAdvisorRules()` plus
  `ADVISOR_GENERATOR_PROVENANCE`.
- **No API route / UI surface.** This is a service-layer package; wiring it into the
  `Source → … → Valuation Advisor → Export` flow (handoff section 9, "Flow UX") is separate work.
- **No TRS context handoff.** The handoff also asks that "wynik, sources i variants trafiają do
  kontekstu TRS przez immutable refs". The immutable refs now exist (`compute_snapshot_id`,
  `evidence_ref.pointers[]`, the compare bridge rows); pushing them into TRS is a different consumer.
- **No change to `finance_business_versions.freshness` semantics.** That column is never written by
  any compute service today (only `compute_job_outputs.freshness` is), so the "fresh computed
  candidate" precondition is checked against **data** — at least one method `READY` with a result,
  else `NOTHING_COMPUTED` — and a non-`CURRENT` freshness is surfaced as ADV-R28 rather than used as
  a hard gate that nothing in the system could satisfy.
- **No org-level threshold overrides.** `ADVISOR_THRESHOLDS` is a single exported constant precisely
  so a future per-organization override has one seam to attach to, but no override mechanism ships
  here — the thresholds are global.
- **No operational sensitivity / tornado / implied-multiple checks.** Handoff section 9 also lists
  those under Sensitivity; the Advisor reads whatever grids exist but has no rules specific to a
  tornado or an implied-multiple check, because WP-D10 does not persist either yet.
