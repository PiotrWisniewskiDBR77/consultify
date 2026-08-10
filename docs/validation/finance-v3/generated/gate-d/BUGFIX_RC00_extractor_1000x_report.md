# BUGFIX RC-00 — the 1000× extractor error, fixed

**Defect:** `REAL_COMPANY_PROOF_report.md` §RC-00 (P0)
**Branch:** `codex/finance-v3-roi-e007-integration`
**Commits:** `543dfc947f` (fix) · `a876f02c33` (parser unit tests) · `2ee1b54af4` (real-data regression + real-Postgres gate)
**Date:** 2026-08-10

---

## 1. What was actually broken

`extractFinancialLines()` in `server/src/services/financialStatementService.ts` decided the role of
`,` and `.` **per token, in isolation from the document**. The closure `normalizeNumber()` (line ~1658
before the fix) read:

```ts
const commaOnlyThousands = lastComma >= 0 && lastDot < 0 && /^\d{1,3}(?:,\d{3})+$/.test(s);
if (commaOnlyThousands) {
  s = s.replace(/,/g, '');       // comma = thousands
} else if (lastComma > lastDot) {
  s = s.replace(/\./g, '').replace(',', '.');  // European
} else {
  s = s.replace(/,/g, '');       // "US/UK" — a lone dot is left as a DECIMAL POINT
}
```

The last branch is the live defect. A single dot with three trailing digits — the European thousands
separator — falls through untouched and `parseFloat` reads it as a decimal point:

| token | issuer | old result | correct |
|---|---|---:|---:|
| `267.732` | BMW Group 2024, EUR millions | **267.732** | 267 732 |
| `36.752` | BMW Group 2024 | **36.752** | 36 752 |
| `16.535` | BMW Group 2024 | **16.535** | 16 535 |

**The digit sequence survives; only the magnitude drops, by exactly 1000×.** Nothing downstream can
notice: the unit/multiplier layer receives an already-broken number and multiplies it faithfully.

### What was already fixed before this package

The English half of RC-00 (`"122,070"` → `122.07`) was closed on 2026-08-08 by commit `e2e8f3e97f`
("parse UK report thousands correctly"), which added the `commaOnlyThousands` branch above. The audit
that RC-00 is written from (`STATEMENT_IMPORT_SAMPLE_AUDIT_2026-03-15.json`) was produced on
2026-03-15 and therefore records the pre-`e2e8f3e97f` state.

That is not a reason to close RC-00 as stale — the defect was **verified live on current HEAD** before
any change, by running the real `extractFinancialLines()`:

```
TESLA EN   "122,070" -> 122070    fractionalPct = 0%   (already fixed)
BMW DE     "267.732" -> 267.732   fractionalPct = 100% (LIVE 1000x error)
APATOR PL  "1 227 799" -> 1227799 fractionalPct = 0%   (never broken)
```

`e2e8f3e97f` also introduced the mirror-image hazard it did not name: with `commaOnlyThousands`
unconditional, a Polish or German `1,234` (meaning 1.234) is now silently read as 1234. Both
directions are addressed below.

---

## 2. The fix

### 2.1 Notation is a property of the DOCUMENT

New module `server/src/services/finance/numberNotation.ts`.

`detectNumberNotation(text, { language, currency })` resolves the notation once per document, in a
fixed order of authority:

1. **Structurally unambiguous shapes inside the document.** `1,234.56` / `1,234,567` prove comma =
   grouping; `1.234,56` / `1.234.567` prove dot = grouping. A document that shows both in comparable
   numbers is *not* trusted (a report quoting foreign figures) — it falls through.
2. **Weaker decimal-tail evidence.** `0,5` cannot be grouping; neither can `0.5`.
3. **Detected document language** (`pl`/`de`/`fr`/… → European, `en` → English).
4. **Reporting currency** (`PLN`/`CZK`/… → European, `USD`/`GBP`/… → English). `EUR` is deliberately
   *not* a signal — Ireland reports in English notation, Germany does not.
5. `unknown`.

Date-shaped text is stripped before counting, so `31.12.2024` is not mistaken for European grouping
and `December 31, 2024` is not mistaken for a European decimal. Both are covered by tests.

### 2.2 Structure beats notation wherever structure is decisive

`parseStatementNumber(raw, notation)` consults the document notation **only** when the token cannot
decide for itself:

| token shape | rule | notation used? |
|---|---|---|
| both separators present (`1.227.799,50`) | rightmost is the decimal separator — universal | no |
| two identical separators (`1,227,799`) | grouping — a number has one decimal point at most | no |
| tail ≠ 3 digits (`0,5`, `12.34`, `1,2345`) | decimal separator | no |
| head > 3 digits (`12345,678`) | decimal separator | no |
| `<1–3 digits><sep><3 digits>` (`1,234`, `267.732`) | **ambiguous** | **yes** |
| spaces / NBSP / narrow NBSP / apostrophe | grouping | no |

### 2.3 An unresolved value is never a silent wrong number

When the shape is ambiguous **and** the document notation is `unknown`, the parser returns
`ambiguous: true` with `reason: 'AMBIGUOUS_SEPARATOR_NO_DOCUMENT_NOTATION'`. The extractor then:

- sets `ExtractedLine.separatorAmbiguous` on the affected row,
- reports `ExtractionResult.ambiguousSeparatorCount` and the full `numberNotation` profile
  (notation + confidence + the evidence counts it was decided on),
- pushes an explicit extraction warning naming the offending tokens and the 1000× risk.

The row still carries a best-effort value (read as a thousands group, because statement subtotals at
millions/thousands scale are integers) so balance checks keep working — but it is flagged, not quiet.

`extractFinancialLines()` also accepts `options.numberNotation` for callers that already know the
document locale.

---

## 3. Results on real data — before / after

Detector: the RC-00 metric itself — the share of extracted values carrying a fractional part.
Corpus: all 9 real filings in `STATEMENT_IMPORT_SAMPLE_AUDIT_2026-03-15.json`.
Test: `server/src/services/finance/__tests__/numberNotation.realCompanyRegression.test.ts`.

| Document | values | % with fraction — BEFORE | % with fraction — AFTER | verdict |
|---|---:|---:|---:|---|
| Tesla 10-K 2024 | 39 | **74.4 %** | **0.0 %** | fixed |
| Coca-Cola 10-K 2025 | 35 | **71.4 %** | **0.0 %** | fixed |
| bp Annual Report 2025 | 60 | **48.3 %** | **0.0 %** | fixed |
| BMW Group 2024 | 52 | **46.2 %** | **0.0 %** | fixed |
| KGHM SRR 2024 | 42 | 2.4 % | 0.0 % | improved |
| Apator SA R 2024 | 75 | 0.0 % | 0.0 % | unchanged |
| Grupa Apator RS 2023 | 89 | 0.0 % | 0.0 % | unchanged |
| Grupa Apator RS 2024 | 90 | 0.0 % | 0.0 % | unchanged |
| Raport skonsolidowany Apator | 101 | 0.0 % | 0.0 % | unchanged |

The BEFORE column is **computed from the audit inside the test**, not transcribed, and it reproduces
the figures published in §RC-00 to the decimal. The Polish corpus is asserted byte-for-byte unchanged.

Named figures restored:

| | stored by the old extractor | after the fix |
|---|---:|---:|
| Tesla · total assets | 122.07 | **122 070** (USD mln) |
| Tesla · cash | 16.139 | **16 139** |
| Coca-Cola · total assets | 100.549 | **100 549** |
| BMW · total assets | 267.732 | **267 732** |
| bp · total assets | 26.574 | **26 574** |

### End-to-end, through the real import path

The source PDFs are not in the repo, so Tesla / Coca-Cola / BMW are replayed from the audit's own
labels and reconstructed tokens and pushed through `extractFinancialLines()` **without** passing a
notation — the per-document resolution is what is under test:

```
Tesla       23 rows  notation=en/high  ambiguous=0  fractional=0.0%  totalAssets=122070
Coca-Cola   23 rows  notation=en/high  ambiguous=0  fractional=0.0%  totalAssets=100549
BMW          3 rows  notation=eu/high  ambiguous=0  fractional=0.0%
```

*Reconstruction rule (stated in the test): the audit stores parsed values, not source tokens. A value
the old parser produced from `<head><sep><3 digits>` is recovered exactly by `Math.abs(v).toFixed(3)`
— the grouped digits are still there, JS only dropped trailing zeros when stringifying
(122.07 → "122.070" → "122,070"). Integers are replayed verbatim. For a token that had two grouping
separators the reconstruction recovers the first group only; that lower-bounds the digit count and
does not affect the fractional-part metric this gate measures.*

---

## 4. Negative control

The fix was reverted twice and the regression suite re-run, to prove the tests actually detect the
defect rather than describing the new code:

| mutation | equivalent to | result |
|---|---|---|
| `separatorIsGrouping = sep === ','` | HEAD immediately before this package | **3 red** — BMW 46.2 %, BMW end-to-end 66.7 %, `267.732 ≠ 267732` |
| `separatorIsGrouping = false` | pre-`e2e8f3e97f` (the state RC-00 was written from) | **8 red** — Tesla 74.4 %, Coca-Cola 71.4 %, bp 48.3 %, BMW 46.2 %, `122.07 ≠ 122070`, end-to-end Tesla/KO 91.3 %, BMW 66.7 % |

Both mutations reproduce the published §RC-00 percentages exactly. The fix was then restored and the
suite verified green again (`git status` clean on the file).

---

## 5. Test inventory

| file | what it proves | how run |
|---|---|---|
| `server/src/services/finance/__tests__/numberNotation.test.ts` | 18 cases on the strings issuers actually print — Tesla `122,070`/`16,139`, Coca-Cola `100,549`, bp `26,574`, BMW `267.732`, Apator `1 227 799` (+ NBSP variants), Tesco `5,092`; plus accounting negatives, mixed separators, date look-alikes, and the ambiguity flag | `cd server && npx vitest run src/services/finance/__tests__/numberNotation.test.ts` |
| `…/numberNotation.realCompanyRegression.test.ts` | 14 cases — the before/after table in §3, reproduced from the committed audit, plus end-to-end through `extractFinancialLines` | same runner |
| `…/numberNotation.persistence.pg.test.ts` | 3 cases on a **real PostgreSQL 15** — see §6 | `RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=… npx vitest run …` |
| `server/src/services/__tests__/financialStatementService.contract.test.ts` (existing) | no regression — 20/20, including the `e2e8f3e97f` UK-thousands case | same runner |

**55/55 green**, run from `server/` (running vitest from the repo root reports "No test files found"
and exits 1 — a false success).

---

## 6. Real-Postgres gate — and a finding

The fix multiplies every affected figure by 1000, and `financial_statement_values.value` is declared
`REAL`. That was verified against the live catalogue, not the migration file:

```sql
select data_type, numeric_precision from information_schema.columns
 where table_name='financial_statement_values' and column_name='value';
--  real | 24
```

Every corrected figure was written through the production table and read back exactly
(122 070 · 16 139 · 100 549 · 26 574 · 267 732 · 36 752 · 1 227 799 · 466 231). The suite deletes its
own rows, and **skips rather than passing** when `RUN_DB_TESTS=1` / `MOCK_DB=false` are absent —
confirmed by running it both ways.

Environment (ephemeral, torn down afterwards): PostgreSQL 15.15, port 56421,
`LC_ALL=C initdb --locale=C` and `LC_ALL=C pg_ctl start`, schema built by the real runner
`server/scripts/migrate.postgres.ts` → **1456 tables**.

> **Finding, out of this package's scope.** `real` is float4: integers are exact only up to
> 2²⁴ = 16 777 216. Every figure above fits, so the fix is safe. But a statement reported in **units**
> rather than thousands/millions (e.g. Apator's 1 227 799 000) would be stored inexactly. This is
> pre-existing and unrelated to RC-00; it belongs in a separate ticket that changes the column to
> `numeric`.

---

## 7. RC-00 part two — currency (USD read as EUR)

The audit records Tesla, Coca-Cola and bp as `EUR`. This is **already fixed on HEAD** and was not
touched by this package. `detectCurrency()` gained scored reporting-currency phrases
(`form 10-k`, `(in millions…)`, `in millions of dollars`, …) in commit `050ef26962` on 2026-03-15 —
the same day as, and after, the audit run. Verified empirically on representative filing headers:

```
Tesla 10-K   currency=USD scaling=millions lang=en
Coca-Cola    currency=USD scaling=millions lang=en
bp 20-F      currency=USD scaling=millions lang=en
BMW          currency=EUR scaling=millions lang=de
Apator       currency=PLN scaling=thousands lang=pl
```

The source PDFs are not in the repo, so this cannot be re-confirmed against the exact original text;
it should be re-checked when the corpus is available. Note that currency detection now also feeds the
notation resolver as a last-resort hint, so an error there degrades to a *flagged* ambiguity rather
than a silent 1000× error.

---

## 8. Known limits

- **Ambiguous documents.** A filing whose text contains no decisive shape and whose language and
  currency are both unreadable resolves to `unknown`; its `<1–3 digits><sep><3 digits>` values are
  flagged, not resolved. This is by design.
- **BMW replay extracts 3 of 12 rows.** German labels are dropped by the label/noise filters in
  `extractFinancialLines`. That is an extraction-coverage defect, unrelated to magnitude, and outside
  this package.
- **Scaling detection is untouched.** RC-00 notes bp's scale is detected as `thousands` where the
  filing is in millions; that is a separate defect in `detectScaling()`.

---

## 9. Regression sweep

Full server suite from `server/`: **9382 passed / 198 failed / 247 skipped** across 670 files.
None of the 57 failing files concern number parsing or statement extraction. Two were checked
directly:

- `src/routes/v8/__tests__/finance.routes.test.ts` — 3 failed / 44 passed **with and without** this
  change (verified by reverting both files to `543dfc947f^` and re-running). Pre-existing.
- `src/services/finance/canonical/__tests__/statementReconciliationService.test.ts` — belongs to the
  RC-01/RC-05 package being edited in parallel in this same worktree. **Reported, not touched.**

The remainder fail on missing `DATABASE_URL` / `process.exit(1)` in `DatabaseConfig`, i.e. the usual
no-database-configured failures, unrelated to this change.

---

## 10. Files changed

```
server/src/services/finance/numberNotation.ts                                    (new, 334 lines)
server/src/services/financialStatementService.ts                                 (extraction path only)
server/src/services/finance/__tests__/numberNotation.test.ts                     (new)
server/src/services/finance/__tests__/numberNotation.realCompanyRegression.test.ts (new)
server/src/services/finance/__tests__/numberNotation.persistence.pg.test.ts      (new)
docs/validation/finance-v3/generated/gate-d/BUGFIX_RC00_extractor_1000x_report.md (this file)
```

## 11. Reproduction

```bash
cd server

# parser + real-data regression (no database)
npx vitest run src/services/finance/__tests__/numberNotation.test.ts \
               src/services/finance/__tests__/numberNotation.realCompanyRegression.test.ts \
               src/services/__tests__/financialStatementService.contract.test.ts

# real-Postgres gate
PGBIN=/opt/homebrew/opt/postgresql@15/bin
PORT=56421              # check with lsof -i:$PORT first; never 5432/28711/52824
LC_ALL=C $PGBIN/initdb --locale=C -E UTF8 -D /private/tmp/rc00-pgdata -U postgres
LC_ALL=C $PGBIN/pg_ctl -D /private/tmp/rc00-pgdata \
  -o "-p $PORT -h 127.0.0.1 -k /private/tmp" -l /private/tmp/rc00-pg.log start
$PGBIN/createdb -h 127.0.0.1 -p $PORT -U postgres rc00_notation
DB_TYPE=postgres NODE_ENV=test \
  DATABASE_URL=postgresql://postgres@127.0.0.1:$PORT/rc00_notation \
  npx tsx ../server/scripts/migrate.postgres.ts
DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
  DATABASE_URL=postgresql://postgres@127.0.0.1:$PORT/rc00_notation \
  npx vitest run src/services/finance/__tests__/numberNotation.persistence.pg.test.ts
$PGBIN/pg_ctl -D /private/tmp/rc00-pgdata stop && rm -rf /private/tmp/rc00-pgdata
```
