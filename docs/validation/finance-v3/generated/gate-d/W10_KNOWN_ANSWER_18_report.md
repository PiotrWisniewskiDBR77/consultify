# W10 — Known-answer KPI, gate FC-04.3: 6/18 → 17/18 (+ 1 structurally-unavailable, documented)

**Program:** `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md`, Gate D.
**Task:** domierzyć known-answer KPI coverage from `PARTIAL 6/18` (WP-D04 report §5) to as close to 18/18 as
the schema/data honestly support, per FC-04.3.
**Worktree:** `/Users/piotrwisniewski/consultify-wt/w10-knownanswer`, branch `codex/finance-v3-w10-knownanswer`.
**Base SHA (start of this session):** `f8dbef5a33` (built on `1271a0f721` + the W10 test-isolation fix).
**Final SHA (this session's own commit):** `eba9aeeed5` — `test(finance-v3): W10 known-answer KPI — 9 more
GoldCo KPI + DEBT_TO_EBITDA structural check`.
**Status:** CODE + TESTS — real ephemeral Postgres, not deployed/migrated to demo/dev/prod. Zero connections
to staging/demo/production made or attempted.

---

## 1. Headline result

| | |
|---|---|
| **Stan zastany (WP-D04 §5, as documented)** | `PARTIAL 6/18` |
| **Stan zastany (as actually running, before this session's edits)** | **8/18** — WP-D04's own 6 + `DIO`/`DPO`, added later by an undocumented-in-that-report commit (`35d7fc4a76`, "RC-02/RC-03/RC-04 regression tests on real Apator IFRS figures") that post-dates the WP-D04 report and was never folded back into its "6/18" count |
| **After this session** | **17/18 known-answer-verified as numbers** + **1/18 correctly proven structurally unavailable** (`DEBT_TO_EBITDA`, RC-09 — see §3) |
| **Gate FC-04.3 recommendation** | Raise from `PARTIAL 6/18` to `PARTIAL 17/18 (DEBT_TO_EBITDA structurally N/A on annual-only data, behavior verified)` — **not** `PASS 18/18`. See §6. |

This session added **one** new test (`server/src/services/finance/canonical/__tests__/kpiComputeService.pg.test.ts`,
describe block `W10 — 9 additional P0 KPI (known-answer) + 1 structurally-unavailable (DEBT_TO_EBITDA), GoldCo
PARENT FY2025`), covering the 9 P0 KPI that compute a real number plus `DEBT_TO_EBITDA` asserted as
correctly-`MISSING`. `DIO`/`DPO` were **not** added by this session — they were already known-answer-covered
by commit `35d7fc4a76`, confirmed green as part of this session's own baseline run (§2) and folded into the
final count because they meet the same discipline (hand-computed expected, real Postgres, DB read-back).

---

## 2. Baseline verification — before touching anything

Per CLAUDE.md's own golden rule ("verify REALNY runtime, not docs/flags — audits age in ~3 days and
overstate"), the very first step was to actually **run** the existing suite, not trust WP-D04's prose.

```
$ npx vitest run src/services/finance/canonical/__tests__/kpiComputeService.pg.test.ts --no-file-parallelism
 Test Files  1 passed (1)
      Tests  6 passed (6)
```

The 6 tests in that file, *before* this session's edit, were:
1. `6 KPI across 6 different categories, GoldCo PARENT standalone FY2025` — the 6 KPI WP-D04 §5 documents.
2/3. `negative denominator` — `DEBT_TO_EQUITY`/`GROSS_MARGIN_PCT` (not new known-answer KPI, policy-behavior tests).
4. `readiness gate + DRAFT -> READY_FOR_REVIEW` — lifecycle proof, not a KPI known-answer test.
5/6. `RC-04 fix — sign_convention=CONTRA` — **`DIO` and `DPO` on real Apator FY2024 data**, hand-computed
   expected values in the test's own header comment (`COGS_PER_DAY`, `EXPECTED_DIO`, `EXPECTED_DPO`), **not**
   produced by calling `formulaAstEvaluator`/`goldco_oracle.ts` — this meets the known-answer bar exactly as
   defined in this task's brief, it is simply undocumented as such in WP-D04 (which predates it).

**Finding, not invented for this report:** the real, currently-running state is **8/18**, not 6/18. This is a
genuine improvement over the stale audit, in the same spirit as the "audyty starzeją się" pattern this
program has hit before — except this time the stale number understated progress rather than overstating it.

---

## 3. The 12 KPI in scope, resolved

| # | KPI | Outcome this session |
|---|---|---|
| 1 | `QUICK_RATIO` | ✅ known-answer, new test |
| 2 | `CASH_RATIO` | ✅ known-answer, new test |
| 3 | `EBITDA_MARGIN_PCT` | ✅ known-answer, new test |
| 4 | `NET_MARGIN_PCT` | ✅ known-answer, new test |
| 5 | `DEBT_TO_EBITDA` | ⚠️ **structurally unavailable** on annual-only data (RC-09) — behavior verified, not a computed number. See below. |
| 6 | `INTEREST_COVERAGE` | ✅ known-answer, new test |
| 7 | `DIO` | ✅ already known-answer (commit `35d7fc4a76`, real Apator data) — confirmed green, not re-added |
| 8 | `DPO` | ✅ already known-answer (commit `35d7fc4a76`, real Apator data) — confirmed green, not re-added |
| 9 | `CASH_CONVERSION_CYCLE` | ✅ known-answer, new test (composes `DSO+DIO-DPO` via `formula_ref`, GoldCo data) |
| 10 | `FCF_MARGIN` | ✅ known-answer, new test — **with a documented scope decision**, see §4 |
| 11 | `REVENUE_GROWTH_YOY` | ✅ known-answer, new test |
| 12 | `ROA` | ✅ known-answer, new test |

**11 of the 12** compute a real, hand-verified number. **1 of the 12** (`DEBT_TO_EBITDA`) does not, and per this
task's own instruction ("jeśli `DEBT_TO_EBITDA` nie da się policzyć na danych rocznych, napisz to wprost jako
`EVIDENCE_MISSING` z przyczyną strukturalną") this report does exactly that rather than forcing a number.

### 3.1 `DEBT_TO_EBITDA` — why it is structurally unavailable, not a defect

`DEBT_TO_EBITDA = LONG_TERM_DEBT[CURRENT] / EBITDA[LTM_SUM_4Q]` (catalog row 8,
`20260809_finance_v3_d03_analysis_03_kpi_p0_catalog.sql`). `LTM_SUM_4Q` is resolved by
`periodConventionResolver.resolvePeriodOffset()`:

```ts
case 'LTM_SUM_4Q': {
  if (current.periodType !== 'Q') {
    return { ok: false, reason: 'WRONG_PERIOD_TYPE_FOR_LTM', ... };
  }
  ...
}
```

GoldCo's own oracle (`goldco_oracle.ts`) — and this test's fixture, and every other `.pg.test.ts` fixture in
this suite — only ever creates `period_type='FY'` periods. There is no quarterly period anywhere in this
dataset for `LTM_SUM_4Q` to walk. The failure is **not** a bug: `formulaAstEvaluator.ts`'s own header comment
says exactly this is a "readiness/configuration problem, not a DB-valid quality flag" and surfaces it as
`status='MISSING'` (never `NOT_APPLICABLE`, never a fabricated ratio, never a fake `0`).

This session's new test asserts the correct behavior explicitly:

```ts
expect(debtToEbitda!.status).toBe('MISSING');
expect(debtToEbitda!.value).toBeNull();
expect(debtToEbitda!.qualityFlag).toBeNull();
expect(debtToEbitda!.detail).toContain('WRONG_PERIOD_TYPE_FOR_LTM');
```

...and confirms the same shape via a direct `SELECT` against `finance_analysis_kpi_values`
(`value_status='MISSING'`, `value_decimal IS NULL`, `quality_flag IS NULL`).

**This is exactly the class of "3 unpracticed conventions" the task brief flagged in advance** (`LTM_SUM_4Q`
without quarterly data). It is not new information — RC-09 is a pre-existing, named condition — but this
session is the first to assert the *behavior* under test rather than merely note the limitation in prose.
**To actually compute `DEBT_TO_EBITDA` as a number would require a quarterly Statement Pack fixture** (4
consecutive `period_type='Q'` periods with `EBITDA` cells) — out of scope for this session (GoldCo's own
independent oracle has no quarterly P&L data beyond PARENT's FY2025 monthly detail, which is `MONTH`
granularity, not `Q`, and `LTM_SUM_4Q` requires `period_type='Q'` specifically, not a monthly rollup).
**`EVIDENCE_MISSING` for `DEBT_TO_EBITDA`-as-a-number stands.**

The other two named-in-advance unpracticed conventions:
- **`INTERIM_ANNUALIZED`** — still zero P0 catalog exercise (none of the 18 seeded KPI use it, confirmed
  by re-reading `20260809_finance_v3_d03_analysis_03_kpi_p0_catalog.sql`'s `period_convention` column for
  all 18 rows: `POINT_IN_TIME`/`FLOW_PERIOD`/`AVERAGE_BALANCE`/`LTM` only). Not exercised by this session
  either — no P0 KPI formula references it, so there is nothing to write a known-answer test *against*
  without inventing a 19th, non-catalog KPI, which is out of this task's scope. **`EVIDENCE_MISSING`, unchanged.**
- **`PRIOR_YEAR_SAME_PERIOD` for `WEEK`** — confirmed still unimplemented
  (`periodConventionResolver.ts`'s `yoyHopCount()` returns `null` for `'WEEK'`, with a comment explaining why:
  a 4-4-5/53-week calendar's week-count-per-year metadata is not exposed to this module). **Not** the same
  as `REVENUE_GROWTH_YOY` on `FY` data — that case (`yoyHopCount('FY') === 1`) **is** implemented and **is**
  exercised by this session's new test (GoldCo FY2025 vs FY2024, §5 row 11). **`EVIDENCE_MISSING` for
  `WEEK` specifically, unchanged; `FY`/`Q`/`MONTH` all implemented and (FY) now known-answer-tested.**

---

## 4. Documented scope decision — `FCF_MARGIN`'s `FCF` input

`goldco_oracle.ts` (the Fala 3 independent oracle this whole known-answer chain is built on) does **not**
model a `FCF` or `CAPEX` line at all — its `parent.*` objects carry only `cfo`/`cfi`/`cff`. But
`FCF_MARGIN`'s formula (catalog row 15) reads `FCF` as a plain `cell_ref` — i.e. in this schema `FCF` is a
**raw reported statement line**, not something the compute engine derives from `CFO`/`CAPEX` (exactly the
same way `OPERATING_CASH_FLOW_MARGIN`'s `CFO` is a raw given cell in the existing 6-KPI test, not derived).

Since the oracle gives no independent FCF figure, this session's test uses the standard identity
`FCF = CFO − CAPEX`, and — because GoldCo's oracle books no investing activity other than CAPEX (no M&A, no
securities purchases/sales anywhere in the oracle's FY2025 `cfi` line) — `CFI` stands in for `−CAPEX`
exactly: `FCF = CFO + CFI = 15,000,000 + (−9,000,000) = 6,000,000`.

**This is an assumption about the fixture's own input data, not about the KPI formula itself** (the formula
under test stays a plain `FCF / REVENUE` cell ratio, verified byte-for-byte against the DB-persisted `FCF`
cell this test writes). Flagged here explicitly per this task's "nie zaokrąglaj w górę" instruction — a
reviewer who considers `CFI ≈ −CAPEX` too strong an assumption for GoldCo specifically should treat
`FCF_MARGIN`'s ratio-arithmetic correctness as proven (it is — the division is exercised and independently
verified) while treating the *specific number* `0.032967...` as provisional on that one assumption.

---

## 5. The 9 new known-answer KPI — full arithmetic

All raw figures transcribed from `goldco_oracle.ts` (`parent.FY2025`, `parent.FY2024_original`, and the
restatement delta — see `docs/validation/finance-v3/generated/gate-d/goldco/goldco_oracle.ts`, credited by
field name in the code comments). Every expected value below is **plain JS/arithmetic on these raw integers**,
written directly into the test file's own header comment and `EXPECTED` map — never produced by calling
`formulaAstEvaluator`/`kpiComputeService`/`goldco_oracle.ts`'s derivation functions a second time.

**Raw PARENT FY2025:** revenue=182,000,000, cogs=118,000,000, opex=34,000,000, depreciation=7,000,000,
interest=2,000,000, taxExpense=3,990,000, cash=11,000,000, ar=26,000,000, inventory=19,500,000,
fixedAssets=101,500,000, ap=17,500,000, longTermDebt=40,500,000, cfo=15,000,000, cfi=−9,000,000.
**Raw PARENT FY2024 (revenue unaffected by the restatement):** revenue=165,000,000, ar=24,000,000,
inventory(restated)=18,000,000 (21,000,000 orig − 3,000,000 write-down), ap=16,500,000,
fixedAssets=96,500,000, cash=9,500,000.
**Derived FY2025:** grossMargin=64,000,000, ebitda=30,000,000, ebit=23,000,000, netIncome=17,010,000,
currentAssets=56,500,000, totalAssets=158,000,000. **Derived FY2024(restated):** totalAssets=148,000,000
(cross-checks the existing 6-KPI test's own independently-stated equity(FY2024_restated)=89,500,000 =
148,000,000 − 58,500,000).

| # | KPI | Formula | Substituted GoldCo figures | Hand-computed expected | Engine result | Diff | Verdict |
|---|---|---|---|---|---|---|---|
| 1 | `QUICK_RATIO` | (CURRENT_ASSETS−INVENTORY)/CURRENT_LIABILITIES | (56,500,000−19,500,000)/17,500,000 | `2.1142857142857143` | `2.1142857142857143` | 0 | ✅ PASS |
| 2 | `CASH_RATIO` | CASH/CURRENT_LIABILITIES | 11,000,000/17,500,000 | `0.6285714285714286` | `0.6285714285714286` | 0 | ✅ PASS |
| 3 | `EBITDA_MARGIN_PCT` | EBITDA/REVENUE | 30,000,000/182,000,000 | `0.16483516483516483` | `0.16483516483516483` | 0 | ✅ PASS |
| 4 | `NET_MARGIN_PCT` | NET_INCOME/REVENUE | 17,010,000/182,000,000 | `0.09346153846153846` | `0.09346153846153846` | 0 | ✅ PASS |
| 5 | `INTEREST_COVERAGE` | EBIT/INTEREST_EXPENSE | 23,000,000/2,000,000 | `11.5` | `11.5` | 0 | ✅ PASS |
| 6 | `ROA` | NET_INCOME/TOTAL_ASSETS_avg | 17,010,000/((158,000,000+148,000,000)/2) | `0.1111764705882353` | `0.1111764705882353` | 0 | ✅ PASS |
| 7 | `REVENUE_GROWTH_YOY` | (REVENUE−REVENUE_prior)/REVENUE_prior | (182,000,000−165,000,000)/165,000,000 | `0.10303030303030303` | `0.10303030303030303` | 0 | ✅ PASS |
| 8 | `FCF_MARGIN` | FCF/REVENUE (FCF=CFO+CFI, §4) | 6,000,000/182,000,000 | `0.03296703296703297` | `0.03296703296703297` | 0 | ✅ PASS (formula proven; FCF input provisional, §4) |
| 9 | `CASH_CONVERSION_CYCLE` | DSO+DIO−DPO (formula_ref composite) | DSO=50.13736…, DIO=57.99788…, DPO=52.58475… | `55.55049823058298` | `55.55049823058298` | 0 | ✅ PASS |

Every one of the 9 also asserted `status='PRESENT_NONZERO'` and `quality_flag IS NULL` (a clean compute), both
from the service's in-memory `ComputedKpiResult` **and** a direct `SELECT` against
`finance_analysis_kpi_values` (not just the service's own return value — same discipline
`statementServices.pg.test.ts` established). `toBeCloseTo(..., 6)` throughout, matching the existing 6-KPI
test's tolerance.

**`DIO`/`DPO` (real Apator data, already-existing coverage, confirmed not re-derived):**

| # | KPI | Formula | Substituted Apator figures | Hand-computed expected | Engine result | Verdict |
|---|---|---|---|---|---|---|
| 10 | `DIO` | INVENTORY_avg/(COGS/DAYS) | ((225,460+242,296)/2)/(913,065/366) | `93.7495…` | matches to `toBeCloseTo(..., 3)` | ✅ PASS |
| 11 | `DPO` | AP_avg/(COGS/DAYS) | ((722+93,591)/2)/(913,065/366) | `18.9026…` | matches to `toBeCloseTo(..., 3)` | ✅ PASS |

---

## 6. Negative control — mandatory, executed for 3 KPI across 3 distinct mechanisms

A green test that cannot be turned red proves nothing. Three separate, surgical corruptions were introduced
by hand-editing the production files (never `git stash` — it is shared across worktrees per this session's
own briefing), each targeting a different part of the pipeline, each run against the full
`kpiComputeService.pg.test.ts` suite, each then reverted and re-confirmed green via `git diff` (empty) before
moving to the next.

### 6.1 Corruption A — division → multiplication (`formulaAstEvaluator.ts`, `divide`/`ratio` branch)

```diff
- const result = numeric((left.value as number) / denomValue);
+ const result = numeric((left.value as number) * denomValue); // CORRUPTION A
```

```
 × ... W10 ... QUICK_RATIO / CASH_RATIO / ... match hand-computed values
   → QUICK_RATIO value: expected 647500000000000 to be close to 2.1142857142857143,
     received difference is 647499999999997.9, but expected 5e-7
```

`647,500,000,000,000` = `(56,500,000−19,500,000) × 17,500,000` — exactly the multiplication the corruption
introduced, not `undefined`/`NaN`/a silently-passing near-miss. **Sensible, diagnosable wrong value.**
Reverted; `git diff --stat` on the file: empty (byte-identical to the original). Full suite re-run green
(7/7, §7).

### 6.2 Corruption B — `AVERAGE_BALANCE` combine strategy (`kpiComputeService.ts`, `makeCellResolver`)

```diff
- else if (plan.combine === 'AVERAGE') combined = points.reduce((a, b) => a + b, 0) / points.length;
+ else if (plan.combine === 'AVERAGE') combined = points[0]; // CORRUPTION B — drops the averaging
```

This corruption is broader by design (it hits every `AVERAGE_CURRENT_AND_PRIOR` KPI at once) — deliberately
chosen to show the negative control is not narrowly tuned to pass:

```
 × ... 6 KPI ... CURRENT_RATIO / ... / DSO / ... / ROE ...
   → expected 52.14285714285714 to be close to 50.137362637362635, difference 2.0054945054945037
 × ... W10 ... ROA value: expected 0.10765822784810127 to be close to 0.1111764705882353,
     difference 0.0035182427401340283
 × ... RC-04 ... DIO and DPO compute from the real Apator FY2024 pack ...
   → expected 90.37512115785842 to be close to 93.74945704851243, difference 3.3743358906540095
 × ... RC-04 ... a NATURAL-signed pack is unaffected ...
   → expected 90.37512115785842 to be close to 93.74945704851243, difference 3.3743358906540095
 Test Files  1 failed (1)
      Tests  4 failed | 3 passed (7)
```

4 tests went red simultaneously (`DSO`, `ROA`, `DIO` ×2) — every one of them landed on a **different,
specific, computable wrong number** (e.g. ROA's `0.10765822784810127` = `17,010,000/158,000,000`, using only
the current-period `TOTAL_ASSETS` instead of the average — exactly what the corruption does), never
`undefined`. Reverted; `git diff --stat`: empty. Full suite re-run green.

### 6.3 Corruption C — `subtract` operator flipped to `add` (`formulaAstEvaluator.ts`)

```diff
- return numeric((left.value as number) - (right.value as number));
+ return numeric((left.value as number) + (right.value as number)); // CORRUPTION C
```

```
 × ... W10 ... QUICK_RATIO value: expected 4.3428571428571425 to be close to 2.1142857142857143,
     difference 2.228571428571428
 Test Files  1 failed (1)
      Tests  1 failed | 6 passed (7)
```

`4.3428571428571425` = `(56,500,000+19,500,000)/17,500,000` (`+` instead of `−`) — caught at `QUICK_RATIO`
(first key evaluated in the `EXPECTED` object; `CASH_CONVERSION_CYCLE`, which also depends on `subtract` via
the `formula_ref` composite root, was not separately isolated in this run because the test loop returns on
first mismatch — the mechanism (subtract) is nonetheless proven broken-then-fixed by this same corruption).
Reverted; `git diff --stat`: empty.

### 6.4 DB-gate negative control

Per this task's explicit instruction, confirmed a `.pg.test.ts` file run with **none** of
`RUN_DB_TESTS`/`MOCK_DB`/`DATABASE_URL` set never silently passes:

```
$ unset RUN_DB_TESTS MOCK_DB DATABASE_URL
$ npx vitest run .../kpiComputeService.pg.test.ts --no-file-parallelism
 Test Files  1 skipped (1)
      Tests  7 skipped (7)
```

`skipped`, not `passed` — the `describe.skipIf(!REAL_PG)` gate works as documented.

**Conclusion: no atrapa (mock-shaped false green) found in any of the 3 corrupted mechanisms or the DB gate.**
Every corruption produced a real, sensible, diagnosable red; every revert produced a real, confirmed green.

---

## 7. Final green run, full acceptance thresholds

```
$ npx vitest run kpiComputeService.pg.test.ts formulaAstEvaluator.test.ts periodConventionResolver.test.ts \
    --no-file-parallelism
 Test Files  3 passed (3)
      Tests  35 passed (35)          # 7 (.pg.test.ts) + 11 (formulaAstEvaluator) + 17 (periodConventionResolver)

$ npx vitest run server/src/services/finance/canonical --no-file-parallelism
 Test Files  26 passed (26)
      Tests  371 passed (371)         # whole canonical package, zero regressions

$ NODE_OPTIONS="--max-old-space-size=8192" npx tsc -p server --noEmit
(exit 0, zero errors)

$ NODE_ENV=test DB_TYPE=postgres DATABASE_URL=... npx tsx server/scripts/migrate.postgres.ts   # STRICT, no --safe
✅ Postgres migrations complete   (exit 0, fresh cluster, 0 skipped)
```

All 4 acceptance thresholds from the task brief are met:
- Migrations STRICT on a fresh DB: exit 0. ✅
- New known-answer tests green, each with a `SELECT`-backed read-back: ✅ (§5).
- `server/src/services/finance/canonical` full suite (`--no-file-parallelism`): 371/371, zero regressions. ✅
- `tsc -p server`: exit 0. ✅
- Negative control for 3+ KPI: ✅ (§6, 3 distinct mechanisms, 6 individual KPI observations across them).

---

## 8. The "32 vs 44/44" discrepancy in WP-D04 §4 — resolved

WP-D04 §4 lists, by name: `formulaAstEvaluator.test.ts` "12 tests", `periodConventionResolver.test.ts` "16
tests", `kpiComputeService.pg.test.ts` "4 tests, detailed in section 5" — **12+16+4 = 32**. The same section's
closing sentence says **"All three files were run ... 44/44 tests pass."** These two numbers, both in the
same section of the same report, do not agree with each other, and this task asked which one (if either) is
right.

**Actually running the two pure files today** (before any of this session's own edits, i.e. as WP-D04 itself
left them — no test in either file has been added or removed since):

```
$ npx vitest run formulaAstEvaluator.test.ts periodConventionResolver.test.ts --reporter=verbose
 Test Files  2 passed (2)
      Tests  28 passed (28)
```

**28**, composed of **11** in `formulaAstEvaluator.test.ts` (not 12 — WP-D04's own count is off by one for
this file) and **17** in `periodConventionResolver.test.ts` (not 16 — off by one in the other direction, so
the two errors partially cancel: 11+17=28 vs the report's stated 12+16=28, same total by coincidence). Adding
the `.pg.test.ts` file **as it stood when WP-D04 was written** (6 tests, per this session's own earlier
`git log` inspection — before the later `35d7fc4a76` RC-04 additions grew it to what is now 6+this
session's 1 = 7) gives **28+6 = 34** at the time of the report, not 44.

**No path from the report's own section 4 to "44" was found.** `git log` on all 3 files shows no earlier
version with more tests that could explain a since-trimmed 44 down to 32/34/28 either — `formulaAstEvaluator.test.ts`
and `periodConventionResolver.test.ts` have exactly one commit each in their history (`43f31fb9be`, the WP-D04
commit itself), so the file never had a different test count. **Conclusion: "44/44" in WP-D04 §4 is a
transcription/copy-paste error with no traceable origin in this repository's history** — most likely copied
from an unrelated work package's own test count while drafting the report, and never corrected. The
per-file breakdown (12+16+4) is the number that should have been trusted, and even that breakdown itself has
two small (self-cancelling) per-file miscounts (11 not 12, 17 not 16). **Recommendation: WP-D04 §4 should be
corrected to state "28 pure + N `.pg.test.ts` tests" rather than repeat "44/44."** Not fixed in this report
(out of this session's scope — modifying a different, frozen work package's report is not part of this
task), but the discrepancy is now traced to its root rather than left as an open question.

---

## 9. Collision points / files touched

Per this session's briefing, the following files were **temporarily** edited for the negative control (§6)
and **fully reverted** (`git diff --stat` empty on each, confirmed before moving to the next corruption and
again at the end of the session):
- `server/src/services/finance/canonical/formulaAstEvaluator.ts` (corruptions A and C — reverted).
- `server/src/services/finance/canonical/kpiComputeService.ts` (corruption B — reverted). Note:
  `kpiComputeService.ts` contains `computeAnalysisKpis()`, named in this session's own "do not touch" list —
  the file was edited **only** as a temporary, fully-reverted negative-control probe, never left changed, and
  `computeAnalysisKpis()`'s own body was never touched (only `makeCellResolver`'s `AVERAGE` branch, a
  different function in the same file). Flagging this explicitly per the collision-point protocol even
  though the net diff is zero.

**Permanently changed (committed):**
- `server/src/services/finance/canonical/__tests__/kpiComputeService.pg.test.ts` — one new `describe` block,
  no existing test touched. `git add -f` used (new-file rule does not apply here — the file already existed
  and was force-added by its original author; this session's `git add -f` on an already-tracked file is a
  no-op but was run anyway per the briefing's instruction to always `git add -f` under `tests/`-adjacent
  paths — note this specific file lives under `server/src/services/finance/canonical/__tests__/`, not
  `tests/`, and is normally tracked without `-f`; confirmed via `git status` that it was not ignored).

No UI/frontend files touched. No connection to staging/demo/production made.

---

## 10. Environment

```
PGBIN=/opt/homebrew/opt/postgresql@15/bin
PGDATA=/private/tmp/fv3-knownanswer-pgdata ; PGSOCK=/tmp/fv3kasock ; PORT=57641
rm -rf "$PGDATA" "$PGSOCK" && mkdir -p "$PGDATA" "$PGSOCK"
LC_ALL=C $PGBIN/initdb -D "$PGDATA" -U postgres -E UTF8 --locale=C
LC_ALL=C $PGBIN/pg_ctl -D "$PGDATA" -o "-p $PORT -k $PGSOCK -c listen_addresses=127.0.0.1" -l /tmp/fv3ka_pg.log start
$PGBIN/psql -h 127.0.0.1 -p $PORT -U postgres -c "CREATE DATABASE fv3_knownanswer;"
DBURL="postgresql://postgres@127.0.0.1:$PORT/fv3_knownanswer"
NODE_ENV=test DB_TYPE=postgres DATABASE_URL="$DBURL" npx tsx server/scripts/migrate.postgres.ts   # STRICT
```

Test commands (from `server/`):
```
RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL="$DBURL" NODE_ENV=test \
  npx vitest run src/services/finance/canonical/__tests__/kpiComputeService.pg.test.ts \
                  src/services/finance/canonical/__tests__/formulaAstEvaluator.test.ts \
                  src/services/finance/canonical/__tests__/periodConventionResolver.test.ts \
  --reporter=verbose --no-file-parallelism

RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL="$DBURL" NODE_ENV=test \
  npx vitest run src/services/finance/canonical --no-file-parallelism

NODE_OPTIONS="--max-old-space-size=8192" npx tsc -p server --noEmit
```

Cluster torn down at end of session:
```
/opt/homebrew/opt/postgresql@15/bin/pg_ctl -D /private/tmp/fv3-knownanswer-pgdata stop -m fast
rm -rf /private/tmp/fv3-knownanswer-pgdata /tmp/fv3kasock
```
Confirmed via `ps aux` before teardown that only this session's own cluster (port 57641) was touched — no
other agents' clusters (5432/28711/52824/57900/28933/57621/57601/57611/57631) were started, stopped, or
queried.

---

## 11. What is still `EVIDENCE_MISSING` — not rounded up

- **`DEBT_TO_EBITDA` as a computed number** — structurally impossible on any annual-only (`period_type='FY'`)
  fixture, including GoldCo's. Would require a quarterly Statement Pack fixture, out of this session's scope.
  Behavior (`MISSING`, `WRONG_PERIOD_TYPE_FOR_LTM` detail) is proven; the number is not, and cannot be, on
  this data.
- **`INTERIM_ANNUALIZED` end-to-end** — zero P0 catalog KPI use this convention; nothing to known-answer-test
  against without inventing a non-catalog 19th KPI.
- **`PRIOR_YEAR_SAME_PERIOD` for `WEEK` granularity** — confirmed still unimplemented
  (`yoyHopCount('WEEK') === null`); not exercised, not claimed exercised.
- **`FCF_MARGIN`'s specific number** (§4) rests on one documented assumption about GoldCo's own unmodeled
  `FCF` input (`FCF = CFO + CFI`) because `goldco_oracle.ts` does not carry an independent FCF figure to
  transcribe. The KPI's *formula* (division, `FCF/REVENUE`) is fully verified against whatever `FCF` cell is
  actually in the DB — only the specific business meaning of that one input number is provisional.
- **`CASH_CONVERSION_CYCLE`'s negative control (§6.3)** only directly demonstrated the `subtract`-corruption
  catching `QUICK_RATIO` (first key in the loop) — it was not separately isolated to show `CASH_CONVERSION_CYCLE`
  itself going red on that specific corruption in this session's run, though the shared `subtract` code path
  it depends on (via its `formula_ref`-composed root) is the exact mechanism proven broken.

---

## 12. Final count and gate recommendation

**17 of 18 P0 KPI are now known-answer-verified as real numbers** (6 WP-D04 + 2 DIO/DPO already-existing +
9 new this session), each with independently hand-computed expected values, real Postgres compute, and
`SELECT`-backed read-back. **1 of 18** (`DEBT_TO_EBITDA`) is correctly, provably, and by design never a
number on this kind of data — its *behavior* is known-answer-verified (a specific, expected `MISSING` +
`WRONG_PERIOD_TYPE_FOR_LTM` detail, not a silent or arbitrary failure), but its *value* is not, and per this
task's own instruction that is reported as `EVIDENCE_MISSING (structural)`, not rounded up to a fabricated
18/18.

**FC-04.3 recommendation:** raise from `PARTIAL 6/18` to **`PARTIAL 17/18`**, with `DEBT_TO_EBITDA` named
explicitly as structurally out of reach on annual-only data (not a defect, not pending work) rather than
silently omitted or forced to `PASS 18/18`.
