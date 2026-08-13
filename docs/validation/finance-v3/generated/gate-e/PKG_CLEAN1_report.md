# PKG_CLEAN1 — clean-candidate report (codex/fv3p-clean1-types)

Worktree: `/Users/piotrwisniewski/consultify-wt/fv3p-d-statements`
Branch: `codex/fv3p-clean1-types`
Base (fan-in candidate): `2b797bdeb1` (`docs(finance-v3/fan-in-wave1): fan-in report for D+F+G+E+fix-canonical+H+routes-exposure`)
Final SHA after this session: **`6649498d0f`**

Scope was narrow and blocking: (1) fix 9 root `tsc` errors in Pakiet D, (2)
bring one stale independent-verifier test back in line with the shipped P1
fix, (3) reuse-or-justify an enum-label fix for raw `PRESENT_NONZERO` leaking
to the UI. All three landed as three separate commits, one per task, per the
"commit after each task" instruction (network was reported unstable today).

## Commits (in order)

```
9c094fb1b6 fix(finance-v3/pkg-d): resolve 9 root tsc errors in statementPackWorkspaceV2
a2baac0f2f test(finance-v3/independent-verifier): flip DCF idempotency assertion to prove the fix, not the bug
6649498d0f fix(finance-v3/pkg-d): human labels for FinanceValueStatus — SourceEvidencePanel no longer leaks raw enum
```

## `git diff --stat` (2b797bdeb1..HEAD)

```
 .../valuation-independent-verifier.pg.test.ts      | 137 +++++++++++++++++----
 .../SourceEvidencePanel.tsx                        |  13 +-
 .../__tests__/CanonicalStatementTableV2.test.tsx   |   1 -
 .../__tests__/ReconciliationLedgerPanel.test.tsx   |   2 -
 .../__tests__/RelatedArtifactsSection.test.tsx     |   2 -
 .../__tests__/SourceEvidencePanel.test.tsx         |  45 +++++--
 .../__tests__/StatementPackWorkspaceV2.test.tsx    |   1 -
 .../__tests__/deriveStatementTable.test.ts         |   2 -
 .../deriveStatementTable.ts                        |   4 +-
 src/services/api/__tests__/financeV2.types.test.ts |  36 ++++++
 src/services/api/financeV2.types.ts                |  60 +++++++++
 11 files changed, 261 insertions(+), 42 deletions(-)
```

---

## ZADANIE 1 — 9 tsc errors (BLOCKING) — DONE, exit 0

Root cause confirmed exactly as briefed: `server/tsconfig.json` excludes
`**/*.test.ts`, root `tsconfig.json` excludes `server/**/*` entirely but does
NOT exclude frontend `*.test.tsx`/`*.test.ts` — so these 9 errors, all inside
`src/components/Finance/statementPackWorkspaceV2/`, were invisible to both
configs the author actually ran, and esbuild (used for local checks) never
type-checks at all.

**All 9 fixed by typing — zero suppressed.** Confirmed: no `any`,
`@ts-ignore`, `@ts-expect-error`, `as unknown as`, or tsconfig loosening
anywhere in the diff.

| # | File:line | Error | Fix |
|---|-----------|-------|-----|
| 1 | `__tests__/CanonicalStatementTableV2.test.tsx:18` | TS2783 `stmtLineId` specified more than once | Removed the redundant explicit `stmtLineId: overrides.stmtLineId,` — it was always overwritten by the trailing `...overrides` spread a few lines below (dead code; `stmtLineId` is required by the `Partial<...> & { stmtLineId: string }` type so the spread always carries it). |
| 2 | `__tests__/deriveStatementTable.test.ts:14` | TS2783 `stmtLineId` specified more than once | Same pattern, same fix. |
| 3 | `__tests__/deriveStatementTable.test.ts:234` | TS2783 `id` specified more than once | Same pattern (`reconRow` fixture), same fix. |
| 4 | `__tests__/ReconciliationLedgerPanel.test.tsx:23` | TS2783 `reconciliationRunId` specified more than once | Same pattern (`run` fixture), same fix. |
| 5 | `__tests__/ReconciliationLedgerPanel.test.tsx:53` | TS2783 `id` specified more than once | Same pattern (`detailRow` fixture), same fix. |
| 6 | `__tests__/RelatedArtifactsSection.test.tsx:20` | TS2783 `edgeId` specified more than once | Same pattern (`edge` fixture), same fix. |
| 7 | `__tests__/RelatedArtifactsSection.test.tsx:23` | TS2783 `targetVersionId` specified more than once | Same pattern, same fixture, same fix (two duplicated fields in one function). |
| 8 | `__tests__/StatementPackWorkspaceV2.test.tsx:40` | TS2783 `stmtLineId` specified more than once | Same pattern, same fix. |
| 9 | `CanonicalStatementTableV2.tsx:96` (pinned by the pkg D verifier) | TS7053 `UNIT_LABELS[headerScale.unit]` — `headerScale.unit` is `string`, not indexable into `Record<'UNITS'\|'THOUSANDS'\|'MILLIONS'\|'BILLIONS', string>` | Root cause was in `deriveStatementTable.ts`: `pickHeaderCurrencyAndScale()`'s return type declared `unit: string` even though the value assigned is always `cell.value.unit` (`FinanceValue['unit']`, the narrow union). Widened-then-narrowed for no reason. Fixed by changing the return type to `{ currency: string; unit: FinanceValue['unit'] }` — no cast, the real narrow type was available the whole time. |

Errors 1–8 are the exact same one-line dead-code pattern repeated across 5
files (an explicit required-field assignment immediately shadowed by a
trailing object spread); error 9 is a genuine type-widening bug in
production code (`deriveStatementTable.ts`), fixed at its source rather than
at the call site.

**Verification:**

```
$ NODE_OPTIONS=--max-old-space-size=12288 npx tsc --noEmit   # from repo root
EXIT: 0
```

```
$ npx vitest run src/components/Finance/statementPackWorkspaceV2 --maxWorkers=2
Test Files  8 passed (8)
     Tests  68 passed (68)
```

(8 files / 68 tests at that point in the session — task 3 later added a 9th
file's worth of new tests to `SourceEvidencePanel.test.tsx`/
`financeV2.types.test.ts`, see task 3 below; no regression at any point.)

---

## ZADANIE 2 — stale idempotency test (BLOCKING) — DONE, 636/636

`server/src/routes/v8/finance-v2/__tests__/valuation-independent-verifier.pg.test.ts`
originally asserted the P1 BUG (repeat POST `.../compute/dcf` → unhandled
500 "failed to self-claim"). The P1 fix
(`computeJobService.claimForCompute()`, documented in
`PKG_FIX_CANONICAL_report.md`, already present at the fan-in base) makes the
same repeat POST reply idempotently instead — so the OLD assertion now fails
forever against correctly-fixed code. Confirmed this is a stale assertion,
not a production regression, by reading `claimForCompute()`'s own decision
table in `computeJobService.ts` and `runDcfFcffValuation()`'s
`already_committed` branch in `valuationComputeService.ts`.

**What changed:** rewrote the file's single test into two, both still
HTTP-level, non-branching, single-outcome probes (the same discipline the
original author asked for):

1. **Idempotent-success case** (the flipped assertion): byte-identical
   repeat POST → HTTP 200, **same `jobId`** as the first call, and an
   **independent SQL read** (`SELECT id FROM compute_job_outputs WHERE
   job_id = ?`, never the HTTP response or a service return value) confirms
   **exactly one** row for that job.
2. **Still-running case (new — this file never covered it before)**: a
   duplicate POST that arrives while the first attempt is genuinely
   `running` (real interleaving via `vi.spyOn` on
   `computeJobService.completeJobSuccess`, same technique
   `idempotentComputeRetry.pg.test.ts` already uses for
   `baselineComputeService`, applied here at the HTTP layer for DCF
   specifically) gets a **hard 409 `JOB_NOT_RUNNING`** error — never
   silently resumed as success. Kept as a **separate** test from case 1 so
   "already succeeded" and "still in flight" are never conflated into one
   lenient assertion (explicit instruction; the two are genuinely different
   `claimForCompute()` outcomes — `already_committed` vs `hard_error`).

The header comment documents the 2026-08-12 reversal, why it is a reversal
of the assertion and not a weakening of the test's evidentiary value, and
why the file still does its job as a regression guard (if `claimForCompute`
wiring ever regresses, this file goes red again — now on the success
assertion instead of the old crash assertion).

No `.skip`/`.only`, no deleted assertions, no loosened expected values
outside of the two assertions this task explicitly ordered inverted.

**Verification (own throwaway Postgres cluster, `newdb.sh`, dropped after):**

```
$ DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
  DATABASE_URL=postgresql://.../clean1_task2 \
  npx vitest run --config vitest.config.ts \
    src/routes/v8/finance-v2/__tests__/valuation-independent-verifier.pg.test.ts \
    --no-file-parallelism
Test Files  1 passed (1)
     Tests  2 passed (2)
```

```
$ DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
  DATABASE_URL=postgresql://.../clean1_full \
  npx vitest run --config vitest.config.ts \
    src/routes/v8/finance-v2 src/services/finance/canonical \
    --no-file-parallelism
Test Files  59 passed (59)
     Tests  636 passed (636)
```

**636/636** — reference was 59 files / 635 tests with 1 failure; 636 = 635 +
this file's new second test, all green. Both ephemeral databases
(`clean1_task2`, `clean1_full`) were dropped after the run.

---

## ZADANIE 3 — raw enum leaking to UI — DONE, existing solution evaluated and rejected, new function added in the correct home

**Where:** `src/components/Finance/statementPackWorkspaceV2/SourceEvidencePanel.tsx:75-79`
(right panel, "Status" row) rendered `cell.value.status` directly — the raw
`FinanceValueStatus` token (`PRESENT_NONZERO`, `MISSING`, `NA`,
`NOT_APPLICABLE`, `PRESENT_ZERO`) shown verbatim as the visible label,
matching the brief's screenshot reference.

**Reuse assessment (done first, as instructed):** read
`src/components/Benefits/ValuationWorkspace.tsx`'s `valuationStatusLabel`/
`valuationSourceLabel` (task #110) and their test,
`tests/unit/finance/valuationEnumLabels.test.ts`. **Rejected as a base to
extend**, for three concrete, verified reasons:
1. Different enum entirely — `DRAFT`/`REVIEW`/`APPROVED` and
   `budget`/`financial_model`/`financial_analysis`/`manual` share zero
   values with `FinanceValueStatus`'s five states. Calling
   `valuationStatusLabel('PRESENT_NONZERO', t)` would fall through every
   `if` and return the wrong default (`'Draft'`).
2. Different language convention — those functions return **English**
   labels via a `TranslateFn` `t(key, fallback)` parameter; every other
   string in `financeV2.types.ts`/`SourceEvidencePanel.tsx` is a **Polish
   literal with no i18n dependency**.
3. Wrong layer — `financeV2.types.ts` is shared with pure, non-React
   derivation code (`deriveStatementTable.ts`); importing a
   React-component-scoped `t()`-based helper into it would be a new,
   backwards dependency.

**What was reused instead:** this exact enum already has a correct,
in-package precedent one function above in the same file —
`financeValueDisplayReasonLabel` (already used by
`CanonicalStatementTableV2.tsx`). Added a sibling,
`financeValueStatusLabel(status): string`, in `financeV2.types.ts`, same
file, same convention (Polish, no i18n), covering all five states:

| Status | Label |
|---|---|
| `PRESENT_ZERO` | "Obecna wartość: zero" |
| `PRESENT_NONZERO` | "Obecna wartość" |
| `MISSING` | "Brak danych" |
| `NA` | "Nie dotyczy (analityk)" |
| `NOT_APPLICABLE` | "Nie dotyczy (struktura)" |

Deliberately **different wording** from `financeValueDisplayReasonLabel`'s
own (longer) sentences for MISSING/NA/NOT_APPLICABLE — the two render as
adjacent rows ("Status" and "Powód braku") in `SourceEvidencePanel`, so
identical text in both would be visually redundant and would break
`getByText` uniqueness in tests. All five labels are pairwise-distinct
(enforced by a negative-control test using `new Set(labels).size ===
statuses.length`), and the raw token is still available structurally as a
`data-value-status` HTML attribute (never as visible text) for any tooling
that needs it.

`SourceEvidencePanel.tsx` now renders `financeValueStatusLabel(cell.value.status)`
instead of the raw token.

**Tests:** the pre-existing `SourceEvidencePanel.test.tsx` assertions that
pinned the raw enum text (`toHaveTextContent('PRESENT_ZERO')` etc.) were
updated to assert the new human label — this is the literal content of the
fix (not a weakening): same five states, same one-assertion-per-state
strictness, plus `data-value-status` attribute checks and a new pairwise-
distinctness negative control added on top. `financeV2.types.test.ts` got
five new tests for `financeValueStatusLabel` directly (coverage of all five
states, pairwise distinctness, "never returns the raw token", and explicit
distinctness from `financeValueDisplayReasonLabel`).

**Verification:**

```
$ NODE_OPTIONS=--max-old-space-size=12288 npx tsc --noEmit   # from repo root
EXIT: 0
```

```
$ npx vitest run src/components/Finance/statementPackWorkspaceV2 \
    src/services/api/__tests__/financeV2.types.test.ts --maxWorkers=2
Test Files  9 passed (9)
     Tests  87 passed (87)
```

```
$ npx vitest run tests/unit/finance/valuationEnumLabels.test.ts --maxWorkers=2
# confirms the rejected-reuse candidate is untouched
Test Files  1 passed (1)
     Tests  10 passed (10)
```

Status: **DONE.**

---

## Nothing undelivered

All three tasks were completed in full within this session's scope; nothing
was skipped or partially delivered. `docs/validation/finance-v3/generated/gate-e/PKG_CLEAN1_report.md`
(this file) is committed alongside.

## Environment notes / cleanup

- Two ephemeral Postgres databases were created via
  `/Users/piotrwisniewski/fv3-pg/newdb.sh` (`clean1_task2`, `clean1_full`)
  and dropped via `dropdb` immediately after their respective test runs —
  no lingering state on the shared cluster.
- No connections were made to demo/staging/production at any point.
- No `git reset --hard`, `git clean`, `git stash`, or `push` were used.
- Files respecting the `codex/fv3p-clean2-shape` allowlist boundary: none of
  `comments.routes.ts`, `saved-views.routes.ts`,
  `src/components/Finance/Analysis/**`, `src/components/Finance/Valuation/**`,
  or `analysisKpiTable.contract.ts` were touched.
