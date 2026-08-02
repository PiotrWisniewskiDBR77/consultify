---
doc_id: FIN-006-candidate-pack-handoff-report
truth_type: operations
status: FIN_06_AWAITING_CODEX_REVIEW
owner: claude
process_owner: codex
product_owner: piotr
packet: FIN-006
branch: feat/fin-006-candidate-pack-initiative-handoff
base_commit: 36aa6ffc401b9e764ab96e3c4995ef98da14decf
head_commit: a0d2f454f6c7297ff0c7a2dbd85ed17d6961b540
last_reviewed: 2026-08-02
---

# FIN-006 — Candidate Pack handoff: controlled-checkpoint report

Worktree `/private/tmp/consultify-fin-006-candidate-pack`, branch
`feat/fin-006-candidate-pack-initiative-handoff`, based on
`integrate/mvp-wave1-abc` @ `36aa6ffc401b9e764ab96e3c4995ef98da14decf`.
No push, merge, deploy, Railway, or demo mutation at any point.

## Final HEAD and new SHAs

**Final HEAD:** `a0d2f454f6c7297ff0c7a2dbd85ed17d6961b540`

Four commits on top of the last SHA you observed (`8382cc30bc`, the Gateway
router-mount commit):

```
19924b6ea2  feat(fin-006): persist canonical source snapshot and candidate lineage
478d0ae388  feat(fin-006): finish Finance candidate preview and confirmation UX
bd66fd2ad2  test(fin-006): verify canonical candidate handoff flows
a0d2f454f6  fix(fin-006): eslint/prettier formatting on all FIN-006 files
```

The first three match your requested messages exactly. The fourth is a
necessary follow-up discovered while executing your own KROK 4 lint gate
(below) — pure `eslint --fix` (indentation, trailing commas, import order),
zero behavior change, verified by re-running the full test suite before and
after with identical pass counts. Not a scope addition.

**`git status --short`:** empty.

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
| 1 | Source approved + tenant-scoped | ✅ `pack_readiness_status='ready'`; cross-tenant → `NOT_FOUND`/404, tested | ✅ `financial_models.status='approved'`, set only by the immutable `approveModel()` — not client-forgeable; cross-tenant → `NOT_FOUND`/404, tested | ⚠️ **tenant-scoped, verified** (cross-tenant → `NOT_FOUND`/404, tested) — **but NOT independently "approved"**: a valuation advisory recommendation is a plain object inside `valuations.advisory` JSONB with no acceptance/status field of its own. The only gate is "exists in this org's current advisory JSON" — identical to the pre-existing `convertAdvisoryRecommendationToInitiative` this replaces (verified: that function never checked a status field either). See "Open blocker" below. |
| 2 | User sees Candidate Pack before save | ✅ `GET .../preview`, read-only, no write | ✅ same | ✅ same |
| 3 | Confirm persists canonical Candidate | ✅ `createCandidateFromSource` via shared core; direct DB query confirms exactly 1 `initiative_candidates` row | ✅ same | ✅ same |
| 4 | Finance never creates Initiative directly | ✅ never had a violation (new source) | ✅ `POST /analyses/:analysisId/initiatives` neutralized → `410 DIRECT_INITIATIVE_CREATION_DISABLED`, zero `initiatives` rows regardless of `INITIATIVE_FUNNEL_ENABLED`, tested | ✅ `convertAdvisoryRecommendationToInitiative` now delegates to the Candidate adapter (returns `candidateId`, not `initiativeId`); the unrelated `POST /financial-analyses/:id/initiatives` (a different, out-of-scope source) also neutralized → `410`, tested |
| 5 | Retry never creates a second Candidate | ✅ N=1 retry + N=5 concurrency → exactly 1 row, direct DB query | ✅ same | ✅ same |
| 6 | Receipt has source type, source ID, snapshot/version | ✅ `finance_candidate_handoffs.source_type='finance_statement_pack'` + `source_snapshot` (currency, readiness/version real; CAPEX/OPEX/NPV/IRR/payback literal `'unknown'` — not applicable to a pack) | ✅ `source_type='finance_investment_case'` + `source_snapshot` (currency, scenario, approved-snapshot version real; NPV/IRR/payback literal `'unknown'` — confirmed not stored on `financial_models`) | ✅ `source_type='finance_valuation_recommendation'` + `source_snapshot` from real advisory JSONB fields |
| 7 | Candidate independently readable/reopenable | ✅ `GET .../:packId`, tested | ✅ `GET .../:modelId`, tested | ✅ `GET .../:recommendationId`, tested |
| 8 | Failure before finalize ⇒ no false success | ✅ TOCTOU test: pack flips ready→pending between preview and confirm → 409, 0 rows | ✅ TOCTOU test: model archived between preview and confirm → 409 `SOURCE_NOT_ELIGIBLE`, 0 rows | ✅ N=5 concurrency → exactly 1 row (no dedicated eligibility-flip test since there's no eligibility state to flip — see point 1) |

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

## Open blocker (your explicit decision needed)

**Valuation Recommendation has no real "approved" gate to prove point 1
against.** This is inherited, not introduced — the code this packet
replaces (`convertAdvisoryRecommendationToInitiative`) never had one either,
and a recommendation is structurally just an id inside a JSONB blob with no
independent row/status. Adding one now would mean introducing a new
acceptance-status concept onto `valuations.advisory` — exactly the kind of
new abstraction your STOP EXPANSION correction told me not to add this
round. I did not invent one. Flagging this explicitly rather than either
hiding it or unilaterally deciding it's fine: is this an acceptable,
disclosed pre-existing gap to carry forward (with a follow-up ticket), or a
hard blocker for FIN-006 specifically?

## KROK 4 — focused test results

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

## Open items / risks carried forward (not new to this checkpoint)

1. **Valuation Recommendation eligibility gap** — see "Open blocker" above.
2. Cross-endpoint idempotent-replay envelope-shape inconsistency
   (unrelated FIN-005 finding, not touched by FIN-006).
3. `FinancialStatementPackWorkspace.tsx`'s new UI entry point — flagged in
   KROK 1 for your explicit sign-off on whether a 3-line reused-slot button
   counts as in-scope "finish the flow" work or should be deferred.

FIN_06_AWAITING_CODEX_REVIEW
