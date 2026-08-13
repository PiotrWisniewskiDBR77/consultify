# DRD scoring — `legacy_v1` vs `drd_scoring_v2` (COORD-11)

> Canon: `docs/product/DRD_CANON.md` §6.1/§6.2. Engine:
> `src/services/drdStructure.ts` (`calculateOverallScore`/`calculateAxisScore`
> = `legacy_v1`, frozen; `calculateOverallScoreV2`/`calculateAxisScoreV2` =
> `drd_scoring_v2`, new). Flag: `src/utils/drdScoringV2Flag.ts` (default OFF).
> Tests: `src/services/__tests__/drdScoringV2.test.ts`,
> `src/services/__tests__/drdReportModel.calculationVersion.test.ts`.

## 1. The two confirmed defects, and what v2 does about each

### DEFECT 1 — no normalization across ladders of different length

DRD axes have different `Lmax` (1-5, 1-6, or 1-7 depending on the axis —
`DRDAxis.levelCount` in `drdStructure.ts`). `legacy_v1` averages raw
`achieved_level` values directly, so a level 5 on a 1-5 axis (100% of that
ladder) and a level 5 on a 1-7 axis (66.7% of that ladder) both report
`actual: 5` — indistinguishable, even though one is "fully mature on this
axis" and the other is "two-thirds of the way there".

```
legacy_v1:  calculateOverallScore({'2A': {actual:5, target:5}}).actual === 5
            calculateOverallScore({'1A': {actual:5, target:5}}).actual === 5   // SAME NUMBER
drd_scoring_v2:
            calculateOverallScoreV2({'2A': {actual:5, target:5}}).scoreNorm === 1.0      // 2A axis Lmax=5, at max
            calculateOverallScoreV2({'1A': {actual:5, target:5}}).scoreNorm === 0.6667   // 1A axis Lmax=7, 2/3 up the ladder
```

Formula (canon §6.1): `score_norm(a) = (achieved_level(a) − 1) / (Lmax(a) − 1)`.

### DEFECT 2 — zero counted as a level

`legacy_v1`'s only filter is `s !== undefined` — an unassessed area recorded
as `{actual: 0}` (the sentinel legacy callers use — see
`areaScoresFromAxisData` in `drdReportClient.ts`) is averaged in as if "0"
were a real, low maturity level.

```
legacy_v1:  calculateAxisScore(2, {2A:{actual:4,target:5}, 2B:{actual:4,target:5}}).actual                        === 4.0
            calculateAxisScore(2, {2A:{actual:4,target:5}, 2B:{actual:4,target:5}, 2C:{actual:0,target:0}}).actual === 2.7   // dragged down by the "0"
drd_scoring_v2:
            calculateAxisScoreV2(2, {2A:{actual:4,target:5}, 2B:{actual:4,target:5}}).scoreNorm                        === 0.75
            calculateAxisScoreV2(2, {2A:{actual:4,target:5}, 2B:{actual:4,target:5}, 2C:{actual:0,target:0}}).scoreNorm === 0.75  // unchanged — 2C excluded, not scored as 0
```

Canon §6.2, verbatim: *"Obszary nieocenione (score_raw = 0) nie wchodzą do
średniej — zamiast tego obniżają `completeness` i są jawnie listowane. Zakaz
liczenia zera jako poziomu."* `drd_scoring_v2`'s `excluded` array is that
"jawnie listowane" list; `coverage`/`coveragePercent` is that lowered
completeness signal.

## 2. Area states — what canon says explicitly vs. what it is silent on

| State | Canon says | This engine's rule |
| --- | --- | --- |
| `assessed` (score_raw ≥ 1) | §6.1: normalize via `(achieved−1)/(Lmax−1)` | Implemented verbatim |
| `unassessed` (no level) | §6.2: excluded from mean, lowers `completeness`, "jawnie listowane" | Implemented verbatim — `excluded`, `unassessedCount`, `coverage` |
| `assessed_zero` (real level 0) | **Not addressed** — canon's formula domain for `achieved_level(a)` is `{0, 1..Lmax(a)}` per §6.1's own type annotation (`score_raw(a) ∈ {0, 1..Lmax(a)} (0 = nieocenione)`), i.e. **the canon itself defines 0 as "unassessed", not as a valid measured level** | **Finding, not EVIDENCE_MISSING**: canon §6.1 already answers this — 0 always means "nieocenione" for DRD, never a real achieved level. Confirmed independently: every `DRDArea.levels` array in `drdStructure.ts` starts at `level: 1` — there is no level-0 rung on any of the 39 DRD ladders. `assessed_zero` is kept as a distinct enum value for API completeness (a future non-DRD method pack might allow a real zero) but for DRD it is normalized identically to `unassessed` — excluded, reported in `excluded`/`assessedZeroCount` separately so it's never confused with "not measured". |
| `insufficient_evidence` | Not named in §6 (§6.3 defines `confidence` as evidence-backed vs. declared, a separate axis from whether a level counts at all) | **EVIDENCE_MISSING** against a §6 citation for "does insufficient evidence exclude a level from the mean". Named rule adopted here, consistent with `drdAdapter.computeScore()`'s existing `needs_evidence` verdict (`src/method-core/methods/drd/drdAdapter.ts`): insufficient evidence never promotes a level into the mean — treated the same as `unassessed` (excluded from numerator, counted in denominator), but tracked in its own `insufficientEvidenceCount` bucket so it is distinguishable in the UI from "nobody looked at this yet". |
| `not_applicable` | **EVIDENCE_MISSING** — §6 never states whether N/A areas lower the denominator | Named rule adopted here (task instructions explicitly asked for a "jawnie nazwana reguła" when canon is silent): N/A is removed from **both** numerator and denominator — `denominatorCount = totalCount − notApplicableCount`. An org that has legitimately marked 3 of 39 areas out of scope is not penalized with a permanently-unreachable 100% coverage; `coverage` is computed against the 36 areas that actually apply to them. |

## 3. Aggregation output — what `drd_scoring_v2` reports that `legacy_v1` hides

`legacy_v1`'s `calculateAxisScore`/`calculateOverallScore` return exactly
`{actual, target, gap}` — three numbers, no indication of how many areas
went into them or whether any were skipped. `drd_scoring_v2`'s
`DrdAggregateResultV2` always reports, explicitly, never behind a single
averaged number:

```
scoreNorm, targetNorm, gapNorm, level (I..V per §6.2 thresholds),
assessedCount, assessedZeroCount, unassessedCount, insufficientEvidenceCount,
notApplicableCount, denominatorCount, coverage, coveragePercent, excluded[]
```

Worked example (canon test 6 from the coordinator's list — 2 of 3 areas
assessed): `calculateAxisScoreV2(2, {'2A':{actual:4,target:5}, '2B':{actual:4,target:5}, '2C':{actual:undefined,target:undefined}})` →
`assessedCount: 2, denominatorCount: 3, coverage: 0.6667, coveragePercent: 66.7`.

## 4. Representative fixture — how many positions change, v1 → v2

Fixture: all 39 DRD areas populated (partial, realistic assessment — not a
toy 2-area example): area 1 of every axis at that axis's max level, area 2 at
a mid-level, one area explicitly `not_applicable`, one explicitly
`insufficient_evidence`, and every other even-indexed area left unassessed
(`{actual:0, target:0}`, the legacy sentinel) — remaining areas at level 1.
Computed with the actual `calculateAxisScore`/`calculateAxisScoreV2`
functions (not hand-derived), one run, no flags.

**Overall:**

| | `legacy_v1` | `drd_scoring_v2` |
| --- | --- | --- |
| Headline number | `actual: 2` (raw mean of 39 numbers on mixed 5/6/7-level scales — not interpretable as a percentage) | `scoreNorm: 0.4682` → **46.8%**, level **III** |
| Coverage | not reported (all 39 areas silently averaged in, including the 15 unassessed-as-zero and the 1 N/A) | `assessedCount: 22`, `denominatorCount: 38` (39 − 1 N/A), **coverage 57.9%** |
| Excluded areas | not reported (silently pulled the mean down instead) | 17 areas listed by id + reason (15 unassessed, 1 not_applicable, 1 insufficient_evidence) |

**Per-area: 32 of 39 areas (82%) produce a different result between the two
engines** on this fixture — full table below. The 7 that agree are exactly
the areas at their axis's maximum level (100% in both engines, coincidentally
— not because the formulas agree, but because "top of any ladder" always
normalizes to 1.0 regardless of ladder length).

| area | axis (Lmax) | v1 raw level | v1 %(of Lmax) | v2 scoreNorm | v2 % | changed | reason |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1A | 1 (7) | 7 | 100% | 1.000 | 100% | no | at axis max — coincidental agreement |
| 1B | 1 (7) | 4 | 57.1% | 0.500 | 50% | **yes** | normalization |
| 1C | 1 (7) | 0 | 0% | null (excluded) | — | **yes** | unassessed, v1 scores it as a real 0 |
| 1D | 1 (7) | 1 | 14.3% | 0.000 | 0% | **yes** | normalization (min-max, not raw/Lmax) |
| 1E | 1 (7) | 0 | 0% | null (excluded) | — | **yes** | unassessed |
| 1F | 1 (7) | 1 | 14.3% | 0.000 | 0% | **yes** | normalization |
| 1G | 1 (7) | 0 | 0% | null (excluded) | — | **yes** | unassessed |
| 1H | 1 (7) | 1 | 14.3% | 0.000 | 0% | **yes** | normalization |
| 1I | 1 (7) | 0 | 0% | null (excluded) | — | **yes** | unassessed |
| 2A | 2 (5) | 5 | 100% | 1.000 | 100% | no | at axis max |
| 2B | 2 (5) | 3 | 60% | 0.500 | 50% | **yes** | normalization |
| 2C | 2 (5) | 0 | 0% | null (excluded) | — | **yes** | unassessed |
| 2D | 2 (5) | 1 | 20% | 0.000 | 0% | **yes** | normalization |
| 2E | 2 (5) | 0 | 0% | null (excluded) | — | **yes** | unassessed |
| 3A | 3 (5) | 5 | 100% | 1.000 | 100% | no | at axis max |
| 3B | 3 (5) | 3 | 60% | 0.500 | 50% | **yes** | normalization |
| 3C | 3 (5) | 0 | 0% | null (excluded) | — | **yes** | unassessed |
| 3D | 3 (5) | 1 | 20% | 0.000 | 0% | **yes** | normalization |
| 3E | 3 (5) | 0 | 0% | null (excluded) | — | **yes** | unassessed |
| 4A | 4 (7) | 7 | 100% | 1.000 | 100% | no | at axis max |
| 4B | 4 (7) | 4 | 57.1% | 0.500 | 50% | **yes** | normalization |
| 4C | 4 (7) | 0 | 0% | null (excluded) | — | **yes** | not_applicable (v1 has no such concept) |
| 4D | 4 (7) | 1 | 14.3% | 0.000 | 0% | **yes** | normalization |
| 4E | 4 (7) | 0 | 0% | null (excluded) | — | **yes** | unassessed |
| 5A | 5 (6) | 6 | 100% | 1.000 | 100% | no | at axis max |
| 5B | 5 (6) | 3 | 50% | 0.400 | 40% | **yes** | normalization |
| 5C | 5 (6) | 0 | 0% | null (excluded) | — | **yes** | unassessed |
| 5D | 5 (6) | 1 | 16.7% | 0.000 | 0% | **yes** | normalization |
| 5E | 5 (6) | 0 | 0% | null (excluded) | — | **yes** | unassessed |
| 6A | 6 (6) | 6 | 100% | 1.000 | 100% | no | at axis max |
| 6B | 6 (6) | 3 | 50% | 0.400 | 40% | **yes** | normalization |
| 6C | 6 (6) | 0 | 0% | null (excluded) | — | **yes** | unassessed |
| 6D | 6 (6) | 6 | 100% | null (excluded) | — | **yes** | insufficient_evidence (v1 takes the proposed level at face value) |
| 6E | 6 (6) | 0 | 0% | null (excluded) | — | **yes** | unassessed |
| 7A | 7 (5) | 5 | 100% | 1.000 | 100% | no | at axis max |
| 7B | 7 (5) | 3 | 60% | 0.500 | 50% | **yes** | normalization |
| 7C | 7 (5) | 0 | 0% | null (excluded) | — | **yes** | unassessed |
| 7D | 7 (5) | 1 | 20% | 0.000 | 0% | **yes** | normalization |
| 7E | 7 (5) | 0 | 0% | null (excluded) | — | **yes** | unassessed |

**Count: 32 areas changed, 7 unchanged, out of 39 (100%).**

Reproduction: the fixture and comparison were generated by a scratch script
(`npx tsx`, deleted after use — not part of the deliverable) that imports the
real `calculateAxisScore`/`calculateAxisScoreV2` from `drdStructure.ts`
directly; every number in the two tables above is the function's actual
return value, not hand-computed. Re-derivable by anyone from the formulas in
§1-2 and the fixture description at the top of §4.

## 5. Known gap NOT fixed this round

`src/method-core/methods/drd/drdAdapter.ts`'s `aggregate()` is a **third**,
separate DRD scoring pipeline (Path B in `DRD_SCORING_V2_BACKFILL_PLAN.md`
§1) used by the new kernel Session/Output/Report objects
(`drdSessionRuntime.ts`, `AssessmentOutput`, `ReportSnapshot`). It already
excludes null/N/A unit levels from its mean (done independently, before
COORD-11), so it does **not** reproduce DEFECT 2 — but it still averages raw
`unit.level` values without normalizing across `Lmax`, so it **does**
reproduce DEFECT 1. This document and this round's code changes do not touch
`drdAdapter.ts`/`contracts/methodPack.ts` — flagged here as a finding for the
coordinator, not silently left unmentioned. See
`DRD_SCORING_V2_BACKFILL_PLAN.md` §1 for the precedent
(`PrioritisationResult.calculationVersion?`) to follow if this path is
versioned in a future round.

## NOT VERIFIED

- Real client assessment data was not used for §4 — the fixture is
  synthetic/representative, not sampled from a live database (A13 ran zero DB
  queries, per the coordinator's ban).
- Whether any UI currently renders `legacy_v1`'s raw mixed-scale `actual`
  number to a client as if it were a percentage (a plausible pre-existing
  bug, out of scope to chase down this round — `drdReportModel.ts`'s
  `overall.actualPercent` is a *different*, already-normalized computation:
  mean of per-axis `actualPercent`, not `calculateOverallScore().actual`
  itself; whether every consumer draws from the right one was not audited).
