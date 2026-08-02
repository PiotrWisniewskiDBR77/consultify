---
doc_id: FIN-006-candidate-pack-handoff-report
truth_type: operations
status: FIN06_READY_FOR_INDEPENDENT_CODEX_REVIEW
owner: claude
process_owner: codex
product_owner: piotr
packet: FIN-006
branch: feat/fin-006-candidate-pack-initiative-handoff
base_commit: 36aa6ffc401b9e764ab96e3c4995ef98da14decf
head_commit: 40838c55e318944a21835596bdc552e79f24d9dc
last_reviewed: 2026-08-02
---

# FIN-006 — Candidate Pack handoff: controlled-checkpoint report

Worktree `/private/tmp/consultify-fin-006-candidate-pack`, branch
`feat/fin-006-candidate-pack-initiative-handoff`, based on
`integrate/mvp-wave1-abc` @ `36aa6ffc401b9e764ab96e3c4995ef98da14decf`.
No push, merge, deploy, Railway, or demo mutation at any point.

## Independent re-verification round (this section) — no new code commits

A follow-up dispatch (citing "last known HEAD c43e259cb4", i.e. BEFORE the
Blocker 1/2 fixes and their commits already on this branch) re-described the
same two problems already fixed and required PROPER sabotage-based negative
controls, which the prior round had not explicitly performed as a distinct
meta-verification step. This round performed exactly that, on the
already-fixed code — **zero new production commits were needed**, since the
existing fix (HEAD `40838c55e3`, unchanged) already satisfies every
requirement re-stated in that dispatch. What follows is the verification
evidence.

**Blocker 1 negative control** (`financialStatementPackService.ts`,
`loadPackStatementsWithSchemaCompat`), against a genuinely fresh,
migrations-only Postgres instance:
1. Baseline, fixed code: `9/9 PASS`.
2. Sabotage — reverted the function to the exact original buggy shape
   (`return dbAll<any>(fullSql, [packId]);`, no `{fallback:false}`, no
   schema-compat catch/fallback): `3/9 FAIL` — specifically the two Blocker-1
   regression tests (real P&L x1/BS x1/CF x0 read-back; genuinely-broken-
   schema fails closed) plus the pre-existing golden preview test (which
   also depends on real counts).
3. Restored the exact committed code (`git diff --stat` on the file: empty
   afterward): `9/9 PASS` again.

**Blocker 2 negative control**
(`financeValuationRecommendationCandidateHandoff.ts`), against the local
Postgres already carrying the golden-flow fixtures:
1. Baseline, fixed code: `11/11 PASS`.
2. Sabotage — commented out `if (!isApproved(found)) return { ok: false,
   reason: 'NOT_APPROVED' };` at BOTH call sites (preview's
   `resolveEligibleSource` and confirm's locked re-check): `9/11 FAIL` —
   specifically Blocker 2 scenarios A (DRAFT valuation wrongly reported
   `eligible:true`) and B (confirm on a since-downgraded valuation returned
   a real `201 created:true` with a real `candidateId` instead of `409`).
3. Restored the exact committed code (`git diff --stat` on the file: empty
   afterward): `11/11 PASS` again.

No sabotaged version was committed at any point — `git status --short` was
empty before, and confirmed empty again immediately after each restore.

Full gate re-run on the final, unchanged, already-committed state: 27/27
FIN-006 acceptance (both a genuinely fresh AND the long-lived schema),
20/20 component, scoped backend typecheck 0 errors, scoped lint 0 errors,
`git diff --check` clean, secret scan clean.

## MINIMAL FIX_REQUIRED round — addendum (this section)

Codex's independent real-Postgres run found a genuine bug this session's own
`consultinity_test` database masked (see §"Blocker 1 root cause" below) and
a genuine, correctly-identified gap in Valuation Recommendation eligibility.
Both are fixed, independently re-reproduced against a genuinely fresh schema
before and after the fix, and covered by new regression tests. The rest of
this document (KROK 1-4 sections below) is the PRIOR checkpoint report,
left intact for history; this addendum documents only what changed since.

**Final HEAD:** `d6616aaef8062edf56ef447a6b602a597aec300b`

Three new commits on top of the HEAD you independently reviewed
(`c43e259cb4`):

```
172204b1ae  fix(fin-006): fail closed on statement-pack source read
2739615b13  fix(fin-006): require approved valuation at candidate confirmation
d6616aaef8  test(fin-006): cover source eligibility and statement readback regressions
```

Three commits, not four — your requested `docs(fin-006): record final
acceptance evidence` commit is this document's own update, committed
immediately after this content lands (see final `git log` in the
confirmation section below for its actual hash, since a file cannot
truthfully state its own not-yet-created commit SHA).

**`git status --short`:** empty (verified immediately before and after
every commit in this round).

### Blocker 1 root cause (full Postgres error, not the truncated logger line)

Reproduced independently against a genuinely fresh, migrations-only
Postgres instance (`consultinity_test_fin006_repro`, bootstrapped via
`npx tsx server/scripts/migrate.postgres.ts --safe` from empty — the exact
class of database Codex's own `consultify_fin006_test` on port 32770 is).
My long-lived `consultinity_test` did NOT reproduce the failure at first,
because — unlike a from-scratch migration run — it still carried a
production-baseline-derived schema snapshot from earlier sessions this
branch, which happens to already have the columns in question. That
divergence was itself the first finding: the bug only shows up on a truly
clean bootstrap, exactly Codex's environment.

`getStatementPackDetail()`'s (and, identically, `recomputeStatementPack()`'s)
statement-listing query selected `fs.readiness_status`, `fs.readiness_score`,
`fs.quality_summary`, `fs.quality_reason_codes`, `fs.values_version`
(`financial_statements`) and `fsv.is_non_financial`
(`financial_statement_values`) — none of which exist on those tables via
the `server/migrations` path alone. They are added ONLY by
`server/migrations/20260719_baseline_gap.sql`, a large best-effort
prod-baseline-sync migration that this repo's own earlier tooling notes
(from FIN-005 work) already document as failing/skipping on a genuinely
empty database. Confirmed directly: `\d financial_statements` on the fresh
repro DB shows no such columns; the migration log for `20260719_baseline_gap.sql`
completes without error but silently never adds them on that path.

Both queries called `dbAll()` without `{ fallback: false }`. `DbPromise.ts`'s
`all()` defaults to `fallback: true`, which on ANY query error (including
Postgres's real `column "readiness_status" does not exist` error for this
exact query) resolves `[]` instead of throwing — the underlying Postgres
error was never even reaching application code as an error, just a silently
empty result set. `financeStatementPackCandidateHandoff.ts`'s
`countByType()` then correctly counted zero statements of every type against
that empty array, and its `buildCandidateFields()` correctly rendered
`"statements on file: P&L x0, BS x0, CF x0"` — every individual piece of
code downstream of the swallowed error behaved correctly; the swallow itself
was the defect.

### Blocker 1 fix

Both queries now probe with `{ fallback: false }` (so the real Postgres
error throws instead of being swallowed) inside a `try/catch` using the
exact `isSchemaCompatError` predicate this same file already defines and
already uses for `loadStatementForPack`'s identical class of gap. On a
recognized schema-compat error specifically, each retries with a second
query using ONLY the columns the base `20260316_financial_statement_packs.sql`
migration creates unconditionally — which is everything FIN-06's
statement-type counting genuinely needs. Any OTHER error (not this
specific, named class of gap) is re-thrown, never masked. `recomputeStatementPack`
was fixed identically, not just `getStatementPackDetail`: it is the function
that WRITES `pack_readiness_status` (the exact signal FIN-06's own
eligibility gate depends on), and on the same schema gap it was treating a
genuinely non-empty pack as having zero statements, which would call
`pruneEmptyPack` on it — a live data-integrity risk broader than the
reported preview bug, not something left half-fixed.

**Direct DB read-back proof** (new test,
`Blocker 1: real per-type statement counts...`): the fixture is confirmed,
by a direct `GROUP BY statement_type` query against `financial_statements`,
to have exactly 1 `P&L` row, 1 `BS` row, 0 `CF` rows — and the preview
endpoint's `rationale` is asserted to contain exactly `P&L x1`, `BS x1`,
`CF x0`, matching the DB precisely.

**Fail-closed proof** (new test,
`Blocker 1: a genuinely broken required schema fails closed...`): a column
BOTH the primary and the fallback query require (`statement_type` — never
one of the five optional "bonus" columns) is renamed away mid-test. The
preview call is asserted to NOT return the shape the original bug produced
(`200` + `eligible:true` + a rationale containing `P&L x0`) and instead
returns `>= 500`. The column is restored in a `finally` block; a follow-up
call in the same test confirms the golden preview is back to normal,
correct counts afterward.

### Blocker 2 fix

`financeValuationRecommendationCandidateHandoff.ts` now selects
`valuations.status` in both the read used by preview
(`findRecommendationAcrossValuations`) and the read used by confirm's
re-check INSIDE the lock (`readRecommendationFromValuation`), and requires
it to be exactly `'APPROVED'` before treating a recommendation as eligible
— no new table, no new status column on the recommendation object itself,
reusing the existing `valuations.status` column (`DRAFT`/`REVIEW`/`APPROVED`)
that `generateAdvisory()` itself already gates on at generation time. The
value is read fresh from the database on every call; nothing from the
client/session is trusted for this decision.

## KROK 1 — dirty-diff classification

Delivered in the prior message as a table (file / acceptance criterion /
why-necessary / prod-test-migration / KEEP-REMOVE). Summary: all 17 changed
files trace to two authorized integration tasks — (A) structured
source-value carry-over per your "don't recompute, `unknown` not `0`"
correction, (B) the single shared UI component replacing three separate
dialogs per your "no three dialogs" correction. Zero REMOVE_FROM_SCOPE. One
item flagged for your explicit judgment:
`src/components/Finance/FinancialStatementPackWorkspace.tsx` — Statement
Pack had NO prior UI entry point; a 3-line "Send as Candidate" button was
added to an *existing* header action-bar slot (not a new screen) so the
golden flow is actually reachable by a user for all three sources, not just
two.

## KROK 2 — commit split

Done as above (four commits, not three, for the disclosed reason). Migration
is in the first commit. No runtime reports, logs, cache, or `junit.xml`
were committed (`junit.xml` is gitignored — confirmed empty in
`git status --short` after every test run).

## KROK 3 — doctrine proof per source

| # | Requirement | Statement Pack | Investment Case | Valuation Recommendation |
|---|---|---|---|---|
| 1 | Source approved + tenant-scoped | ✅ `pack_readiness_status='ready'`; cross-tenant → `NOT_FOUND`/404, tested | ✅ `financial_models.status='approved'`, set only by the immutable `approveModel()` — not client-forgeable; cross-tenant → `NOT_FOUND`/404, tested | ✅ **FIXED this round.** `valuations.status='APPROVED'`, re-read fresh from the DB at both preview AND inside confirm's lock (never trusted from the client); cross-tenant → `NOT_FOUND`/404, tested. A recommendation whose parent valuation is `DRAFT` is ineligible even if the recommendation id still exists in a stale `advisory` JSON blob — tested directly (Blocker 2 scenarios A/B below). |
| 2 | User sees Candidate Pack before save | ✅ `GET .../preview`, read-only, no write | ✅ same | ✅ same |
| 3 | Confirm persists canonical Candidate | ✅ `createCandidateFromSource` via shared core; direct DB query confirms exactly 1 `initiative_candidates` row | ✅ same | ✅ same |
| 4 | Finance never creates Initiative directly | ✅ never had a violation (new source) | ✅ `POST /analyses/:analysisId/initiatives` neutralized → `410 DIRECT_INITIATIVE_CREATION_DISABLED`, zero `initiatives` rows regardless of `INITIATIVE_FUNNEL_ENABLED`, tested | ✅ `convertAdvisoryRecommendationToInitiative` now delegates to the Candidate adapter (returns `candidateId`, not `initiativeId`); the unrelated `POST /financial-analyses/:id/initiatives` (a different, out-of-scope source) also neutralized → `410`, tested |
| 5 | Retry never creates a second Candidate | ✅ N=1 retry + N=5 concurrency → exactly 1 row, direct DB query | ✅ same | ✅ same |
| 6 | Receipt has source type, source ID, snapshot/version | ✅ `finance_candidate_handoffs.source_type='finance_statement_pack'` + `source_snapshot` (currency, readiness/version real; CAPEX/OPEX/NPV/IRR/payback literal `'unknown'` — not applicable to a pack); **statement-type counts now proven correct against a genuinely fresh schema** (Blocker 1 fix) | ✅ `source_type='finance_investment_case'` + `source_snapshot` (currency, scenario, approved-snapshot version real; NPV/IRR/payback literal `'unknown'` — confirmed not stored on `financial_models`) | ✅ `source_type='finance_valuation_recommendation'` + `source_snapshot` from real advisory JSONB fields |
| 7 | Candidate independently readable/reopenable | ✅ `GET .../:packId`, tested | ✅ `GET .../:modelId`, tested | ✅ `GET .../:recommendationId`, tested |
| 8 | Failure before finalize ⇒ no false success | ✅ TOCTOU test: pack flips ready→pending between preview and confirm → 409, 0 rows. **Plus (this round): a genuine schema/query failure fails closed (>=500), never a fake `eligible:true`/`P&L x0` result** — tested via real column sabotage + revert. | ✅ TOCTOU test: model archived between preview and confirm → 409 `SOURCE_NOT_ELIGIBLE`, 0 rows | ✅ **FIXED this round**: APPROVED→DRAFT between preview and confirm → 409 `SOURCE_NOT_ELIGIBLE` inside the lock, 0 rows, then succeeds once flipped back to APPROVED (proves live re-check, not a one-way latch) |

**Architectural note on point 8, all three sources:** unlike FIN-005's
reservation/business-write split (business writes committed independently
of the reservation, which is what created that packet's orphan bug), this
packet's `confirmFinanceCandidateHandoff` wraps lock + existing-receipt
check + `createCandidateFromSource` + receipt insert in ONE Postgres
transaction (`withPinnedPostgresTransaction`, the same helper INT-08/ASM-08
use). A crash mid-transaction rolls back everything — there is no window
where a Candidate exists without its receipt, or vice versa. This is a
stronger guarantee than FIN-005 needed to retrofit, verified by reading
`financeCandidateHandoffCore.ts` directly, not assumed.

## Open blocker — RESOLVED this round

The previous round flagged, but deliberately did not close, Valuation
Recommendation's missing "approved" gate rather than unilaterally decide it
was acceptable. Your MINIMAL FIX_REQUIRED confirmed it as Blocker 2 and
specified the exact minimal fix (reuse `valuations.status`, no new
table/column on the recommendation) — implemented exactly as specified, see
"Blocker 2 fix" above. No longer an open item.

## KROK 4 — focused test results (superseded by this round's re-run below)

The table immediately below is the PRIOR round's result, kept for history.
This round's authoritative re-run: **27/27** across the three FIN-006
acceptance suites (was 22, +5 new: 2 for Blocker 1, 3 for Blocker 2),
re-run against BOTH a long-lived local Postgres and a genuinely fresh,
migrations-only Postgres instance (the class of database that reproduced
Codex's original failure) — identical 27/27 on both. **20/20** component
suites unaffected. Scoped backend typecheck: 0 errors in any touched file.
Scoped lint (both newly-touched production files + both updated test
files): 0 errors. `git diff --check`: clean. Secret scan: no findings.
Migration re-verified on a fresh schema (table + unique index + the
`source_snapshot` column all present via `\d finance_candidate_handoffs`).

All run against real local Postgres (`RUN_DB_TESTS=1 MOCK_DB=false
DB_TYPE=postgres`), no timeout/heap increases.

| Gate | Result |
|---|---|
| 3× FIN-006 acceptance tests (Statement Pack, Investment Case, Valuation Recommendation) | **22/22 PASS**, 3.09s |
| `ValuationWorkspace.candidateHandoff.test.tsx` | included below |
| `ExportToOutputDialog.v8-proposals.test.tsx` | included below |
| `FinanceCandidateHandoffModal.test.tsx` (the shared component itself — not on your original list, but the direct unit-level coverage for the shared core UI your correction required) | included below |
| → the three component files together | **20/20 PASS**, 2.09s |
| Scoped backend typecheck (`server/tsconfig.json --skipLibCheck`, default heap, ~80s) | **0 errors** in any touched file (confirmed via completed, non-timed-out run — not just an unverified grep) |
| Scoped backend lint (`financeCandidateHandoffCore.ts` + 3 adapters) | **0 errors** after the one `fix(fin-006)` commit above |
| Scoped frontend lint (4 component files + 3 API clients) | **0 errors** after the same fix commit |
| Migration on fresh PostgreSQL schema | **PASS** — genuinely empty local DB, sanctioned `migrate.postgres.ts --safe` path only; `\d finance_candidate_handoffs` confirms the table, the `(organization_id, source_type, source_id)` unique dedupe index, and the `source_snapshot jsonb` column all present |
| Full-project frontend `tsc --noEmit` | **root-caused, not run to completion, not masked**: this repo's own `package.json` `type-check` script requires `NODE_OPTIONS=--max-old-space-size=8192` — a documented, pre-existing whole-project limitation. A first attempt was moved to background by the harness at 90s; the completed run's own log ends in a native Node crash stack (OOM-pattern), reproducing the exact reason that script bumps the heap. Given your explicit "don't increase heap/timeout" instruction, I did not run this and instead rely on: (a) the scoped, genuinely-completed backend `tsc` above, (b) an `esbuild` syntax-only pass on all 11 non-test touched files (0 errors), and (c) 20/20 passing component tests actually exercising these components at runtime. This is a pre-existing repo-scale characteristic, not evidence of a hang introduced by FIN-006.
| `financeCandidateHandoffCore.ts` scoped backend tests | No dedicated unit-test file exists for this module specifically (only exercised indirectly through the three sources' acceptance suites, which do cover its `preview`/`confirm`/`getFinanceCandidateHandoff` functions end-to-end via real HTTP + direct DB assertions) — did not fabricate a separate unit-test file to pad this line item |
| `git diff --check` | clean |
| Secret scan | no findings |

No test failed to start or stalled past 60 seconds without a diagnosed root
cause (the one case that did — the frontend full-project `tsc` — is
diagnosed above, not silently retried or masked).

## Confirmation: no direct Finance → Initiative writer

- Investment Case's `POST /analyses/:analysisId/initiatives` → `410`, tested,
  zero `initiatives` rows regardless of feature flag state.
- Valuation Recommendation's `convertAdvisoryRecommendationToInitiative` →
  now creates a Candidate, never an Initiative, tested.
- Valuation-domain's separate `POST /financial-analyses/:id/initiatives` →
  `410`, tested.
- Statement Pack never had a violation to begin with (new source, built
  directly on the canonical Candidate writer).
- The canonical `initiative_candidates` writer (`createCandidateFromSource`)
  remains the ONLY code path any of the three adapters call to create
  anything — no adapter contains its own `INSERT INTO initiatives`.

## Open items / risks carried forward

1. ~~Valuation Recommendation eligibility gap~~ — **RESOLVED this round**
   (Blocker 2).
2. Cross-endpoint idempotent-replay envelope-shape inconsistency
   (unrelated FIN-005 finding, not touched by FIN-006).
3. `FinancialStatementPackWorkspace.tsx`'s new UI entry point — flagged in
   KROK 1 for your explicit sign-off on whether a 3-line reused-slot button
   counts as in-scope "finish the flow" work or should be deferred. Still
   open, not addressed this round (out of MINIMAL FIX_REQUIRED's two named
   blockers).
4. `loadStatementForPack()` (a sibling function in the same file as
   Blocker 1's fix, used by `syncStatementToPack`/`detachStatementFromPack`/
   `assignStatementToExistingPack`) has the identical "bonus column"
   read pattern but returns `null` (schema-compat caught, statement treated
   as not-found) rather than falling back to core columns — a DIFFERENT,
   narrower failure mode than Blocker 1's, not touched this round since it
   is not on FIN-006's own read path and changing it needs its own review of
   those three callers' behavior on a `null`. Flagged for awareness, not
   fixed — deliberately out of this round's minimal scope.

## Final confirmation

- `git status --short`: empty.
- No push, merge, deploy, Railway, or demo mutation at any point this round.
- No FIN-01..05 file touched this round (only `financeValuationRecommendation
  CandidateHandoff.ts`, `financialStatementPackService.ts`, and the two
  FIN-006 acceptance test files).
- All required focused tests green: 27/27 acceptance, 20/20 component,
  scoped typecheck/lint clean, `git diff --check` clean, secret scan clean.
- Both blockers' negative controls this round: PASS → SABOTAGE FAIL →
  RESTORED PASS (see "Independent re-verification round" section above).
  No sabotaged code committed.

FIN06_READY_FOR_INDEPENDENT_CODEX_REVIEW
