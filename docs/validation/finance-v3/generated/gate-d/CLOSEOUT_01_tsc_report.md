# CLOSEOUT-01 — backend `tsc --noEmit` clean

**Date:** 2026-08-10
**Branch:** `codex/finance-v3-closeout-co1-tsc`
**Terminal criterion:** `npx tsc --noEmit -p server/tsconfig.json` exits 0 for the whole backend.
**Result:** MET — exit code 0, zero diagnostics.

---

## 1. Baseline — 18 errors before the fix

Command (repo root of worktree):

```
npx tsc --noEmit -p server/tsconfig.json
```

All 18 in one file, `server/src/services/resultsVnext/roi/engine/roiCalculationEngine.ts`:

| # | Line:Col | Code | Message |
|---|----------|------|---------|
| 1 | 272:11 | TS2709 | Cannot use namespace 'Decimal' as a type. |
| 2 | 299:42 | TS2351 | This expression is not constructable. Type `typeof import(".../decimal.js/decimal")` has no construct signatures. |
| 3 | 325:42 | TS2351 | This expression is not constructable. |
| 4 | 338:59 | TS2709 | Cannot use namespace 'Decimal' as a type. |
| 5 | 338:92 | TS2709 | Cannot use namespace 'Decimal' as a type. |
| 6 | 339:16 | TS2709 | Cannot use namespace 'Decimal' as a type. |
| 7 | 339:74 | TS2351 | This expression is not constructable. |
| 8 | 340:19 | TS2709 | Cannot use namespace 'Decimal' as a type. |
| 9 | 340:77 | TS2351 | This expression is not constructable. |
| 10 | 391:24 | TS2351 | This expression is not constructable. |
| 11 | 392:36 | TS2351 | This expression is not constructable. |
| 12 | 414:28 | TS2709 | Cannot use namespace 'Decimal' as a type. |
| 13 | 416:53 | TS2339 | Property 'ROUND_HALF_EVEN' does not exist on type `typeof import(".../decimal.js/decimal")`. |
| 14 | 416:79 | TS2339 | Property 'ROUND_HALF_UP' does not exist on type `typeof import(".../decimal.js/decimal")`. |
| 15 | 480:34 | TS2351 | This expression is not constructable. |
| 16 | 480:54 | TS2351 | This expression is not constructable. |
| 17 | 481:55 | TS2351 | This expression is not constructable. |
| 18 | 532:25 | TS2351 | This expression is not constructable. |

Note the reported type in every TS2351/TS2339: `typeof import(".../decimal.js/decimal")` — the
**module namespace object**, not the `Decimal` class. That is the whole diagnosis in one string.

## 2. Root cause — ESM→CJS default-import interop under `NodeNext`

Three facts combine:

1. `server/tsconfig.json` sets `"module": "NodeNext"` and `"moduleResolution": "NodeNext"`.
2. `server/package.json` declares `"type": "module"` → every file under `server/src/` is an
   **ES module** in TypeScript's module-format model.
3. `node_modules/decimal.js/package.json` has **no** `"type": "module"`, and its
   `exports["."].types` points at `./decimal.d.ts`. A `.d.ts` in a package without
   `"type": "module"` is **CJS-format types**.

Under `NodeNext`, when an ESM file default-imports a CJS module, TypeScript models Node's real
runtime interop: `default` binds to `module.exports` **itself**, i.e. the entire module namespace.
So `import Decimal from 'decimal.js'` gave the local name `Decimal` the type
`typeof import(".../decimal")` rather than the class:

- as a **type annotation** → TS2709 "Cannot use namespace 'Decimal' as a type" (7 sites);
- as `new Decimal(...)` → TS2351 "no construct signatures" (9 sites);
- as `Decimal.ROUND_HALF_EVEN` / `Decimal.ROUND_HALF_UP` → TS2339, because on the CJS-types model
  the statics live under the `default` property, not on the namespace (2 sites).

`esModuleInterop: true` and `allowSyntheticDefaultImports: true` are both already set and do **not**
change this — under `NodeNext` the module format, not those flags, decides the interop shape.

This file is the **only** decimal.js consumer in the repo
(`grep -rn "decimal\.js" server/src src` → one hit), so there was no existing working pattern to
copy; the correct form had to be derived from the package's own shape.

## 3. Fix — named import, one line, one file

`server/src/services/resultsVnext/roi/engine/roiCalculationEngine.ts:53`

```diff
-import Decimal from 'decimal.js';
+import { Decimal } from 'decimal.js';
```

(plus an explanatory comment block above it, so the next reader does not "simplify" it back).

No other line in the file changed — every `new Decimal(...)`, every `Decimal` type annotation and
both `Decimal.ROUND_*` references are untouched and now resolve to the class.

Why the named export is correct and not a workaround:

- `decimal.d.ts` declares `export declare class Decimal` as a **named** export, and its own header
  comment documents `import {Decimal} from "decimal.js"` as the primary supported form.
- Runtime provides it in **both** builds:
  - CJS `decimal.js:4912` → `Decimal['default'] = Decimal.Decimal = Decimal;`
  - ESM `decimal.mjs:4908` → `export var Decimal = P.constructor = clone(DEFAULTS);`
- `server/tsconfig.json` and `package.json` were **not** touched (they affect the whole project and
  other sessions).

## 4. Proof — `tsc` exit 0

```
$ npx tsc --noEmit -p server/tsconfig.json
$ echo $?
0
```

Zero diagnostics, whole backend. No previously-masked errors surfaced, so **no additional files
needed changing** — the change set is exactly one file.

## 5. Proof of ZERO behaviour change

This is a types-only fix, evidenced three independent ways.

### 5.1 The two imports are literally the same object

```
$ node -e "import('decimal.js').then(m => ...)"   # run as ESM in-repo
same object (default === named): true
ROUND_HALF_EVEN default/named: 6 / 6
ROUND_HALF_UP   default/named: 4 / 4
2.345 HALF_EVEN 2dp: 2.34
2.345 HALF_UP   2dp: 2.35
```

`default === named` is `true` — identity, not equivalence. A behaviour change is therefore not
merely unobserved, it is impossible. Rounding-mode ordinals are unchanged (HALF_EVEN 6, HALF_UP 4).

### 5.2 Known-answer engine tests — 12/12, before and after

Config: repo-root `vitest.config.ts` (its `include` carries `tests/resultsVnext/**`), so the runner
is invoked from the **worktree root**, not `server/`. Tests genuinely executed — individual names
and per-test timings below, not a skipped/empty run.

```
$ npx vitest run tests/resultsVnext/roi/roiCalculationEngine.knownAnswer.test.ts --reporter=verbose
 ✓ KA-1  known-answer NPV and payback at 12% annual discount, monthly granularity   65ms
 ✓ KA-2  ramp linearly scales benefit from 0 toward full amount over rampPeriods     1ms
 ✓ KA-3  downside < base < upside, monotonic NPV via the assumption-mirror rule      1ms
 ✓ KA-4  delayed benefit start produces a non-integer payback period                 0ms
 ✓ KA-5  paybackPeriods is null (never Infinity) when never recovered                0ms
 ✓ KA-6  non-financial benefit line excluded from financial totals                   0ms
 ✓ KA-7  financial benefit line with amount=null excluded + recorded as finding      0ms
 ✓ KA-8  mixed-currency input hard-fails — no metric computed                        0ms
 ✓ KA-9  irrStatus 'not_applicable' when there is no sign change                     0ms
 ✓ KA-10 unresolved double-counting group flagged, resolves once a note is added     0ms
 ✓ KA-11 same input run twice produces deep-equal output                             1ms
 ✓ KA-12 requiredMetrics excluding 'irr' sets not_required_by_policy                 0ms

 Test Files  1 passed (1)
      Tests  12 passed (12)
```

The identical suite was re-run against the **pre-fix** file (`git show HEAD:<file>` restored
temporarily): also `Tests 12 passed (12)`, same 12 names. No DB was required — the engine is pure
(Decision D2), so the `RUN_DB_TESTS=1` + `MOCK_DB=false` gating that governs the Finance/ROI
`*.realdb.test.ts` files does not apply and no false-green DB skip is possible here.

### 5.3 Gap closed: the tests never exercised the two ROUND constants

`roiCalculationEngine.knownAnswer.test.ts` uses `roundingPolicy: 'none'` in **every** case, so
`roundMoney()` — the function holding the two TS2339 sites — was never covered by the suite. A
green suite alone would therefore **not** have proven the rounding semantics.

Closed with a direct differential probe through `runRoiCalculationEngine`, using an amount
(`100.125`) that lands on an exact `.xx5` tie where HALF_EVEN and HALF_UP must disagree:

```
                 BEFORE (default import)                    AFTER (named import)
none           totalCosts 100.125  npv -100.125     |     totalCosts 100.125  npv -100.125
half_even_2dp  totalCosts 100.12   npv -100.12      |     totalCosts 100.12   npv -100.12
half_up_2dp    totalCosts 100.13   npv -100.13      |     totalCosts 100.13   npv -100.13

$ diff round_before.txt round_after.txt   →  IDENTICAL
```

The two policies genuinely diverge (`100.12` vs `100.13`), which proves the constants are live and
correctly resolved through the new import — and the before/after outputs are byte-identical.

## 6. Files changed

| File | Change |
|------|--------|
| `server/src/services/resultsVnext/roi/engine/roiCalculationEngine.ts` | default → named `decimal.js` import (+ explanatory comment) |
| `docs/validation/finance-v3/generated/gate-d/CLOSEOUT_01_tsc_report.md` | this report |

Not touched, by instruction: `server/tsconfig.json`, `package.json`.
