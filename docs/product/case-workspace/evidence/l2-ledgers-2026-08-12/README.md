# L2 — three ledgers, honest pass (2026-08-12)

Packet L2, worktree `/Users/piotrwisniewski/dev/consultify-case-workspace-v1-20260809`,
branch `claude/case-workspace-v1-20260809`, worktree HEAD at the time of this pass:
`e3d616b4b1912b585d7d720d706874a7aee74321` (uncommitted worktree — no CANDIDATE_SHA
stamped by this packet; ledger rows carry `PENDING-CANDIDATE-SHA` per the
`claude-e2-ledger-hygiene` convention already established in this repo's ledgers).

## Gap 3 — the five untested golden-case files

`docs/product/case-workspace/acceptance/GOLDEN_CASE_EVIDENCE_LEDGER.csv` had zero
references to five of the eight `goldenCases/*.pg.test.ts` files (confirmed by grepping
each filename against the ledger before touching anything):

| Test file | Header's own label | References in ledger before this pass |
|---|---|---|
| `goldenCaseDirectModuleLateBinding.pg.test.ts` | "GOLDEN CASE F" | 0 |
| `goldenCaseTenancyRefusal.pg.test.ts` | "GOLDEN CASE I" | 0 |
| `goldenCaseLightOneClick.pg.test.ts` | "GOLDEN CASE D" | 0 |
| `goldenCaseRequestChangesPartialRetry.pg.test.ts` | "GOLDEN CASE H" | 0 |
| `goldenCaseTransformationMultiModule.pg.test.ts` | "GOLDEN CASE E" | 0 |

(`goldenCaseHappyPath`=A, `goldenCaseApprovalRefused`=B, `goldenCaseWaitExpiry`=C were
already cited. `goldenCaseHarness.ts` is shared harness, not a test.)

**Important, separately confirmed finding:** the letters each test file's own header
uses (F, I, D, H, E) do **not** match the canon doc's own Golden Case A–F lettering
(`10_TEST_ACCEPTANCE_AND_GOLDEN_CASES.md` §4–9, which the existing `CW-GC-A..F` ledger
rows already cite against `goldenCaseHappyPath`/`goldenCaseApprovalRefused`/
`goldenCaseWaitExpiry`/contract tests/`playService.pg.test.ts`). The five files here
extend coverage to requirements that live in *other* canon docs
(`04_DOMAIN_RUNTIME_AND_STATE_MACHINES.md`, `13_CLAUDE_MULTI_AGENT_...md`,
`14_COMPLETE_DOD_EPICS_...md`) — not a second, undocumented "Golden Case G/H/I" canon
list. Ledger rows below cite the *actual* canon requirement each test proves, not the
test's own self-assigned letter.

### Command run (all five, real Postgres, real HTTP, no mocks)

```
cd server && DB_TYPE=postgres LC_ALL=C NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
  POSTGRES_SKIP_INIT_IN_TEST=1 \
  DATABASE_URL="postgresql://case_workspace:case_workspace@127.0.0.1:55432/case_workspace_test" \
  npx vitest run \
    src/services/caseWorkspace/__tests__/goldenCases/goldenCaseDirectModuleLateBinding.pg.test.ts \
    src/services/caseWorkspace/__tests__/goldenCases/goldenCaseTenancyRefusal.pg.test.ts \
    src/services/caseWorkspace/__tests__/goldenCases/goldenCaseLightOneClick.pg.test.ts \
    src/services/caseWorkspace/__tests__/goldenCases/goldenCaseRequestChangesPartialRetry.pg.test.ts \
    src/services/caseWorkspace/__tests__/goldenCases/goldenCaseTransformationMultiModule.pg.test.ts \
    --environment node --reporter=verbose
```

Result: **5 test files, 5 tests, all PASS.** Full transcript:
`golden-case-5-missing-run.log` in this directory (includes each suite's real HTTP
request/response error bodies for the negative-path assertions — e.g. Tenancy's 404
`CASE_ACCESS_DENIED` and 403 `NOT_ORG_MEMBER`, RequestChangesPartialRetry's 409
`PROPOSAL_STATUS_TRANSITION_NOT_ALLOWED` on the refused edges — these are the tests
asserting a refusal, not a defect in this run).

### Rule-2 ("a REAL consumer uses it, not only a test") investigation

Before writing any row, every write-path function each test exercises was checked for
a real caller in `src/` (frontend) and `server/src/` (backend orchestration), by name,
across the whole tree — not just the `CaseWorkspace` component directory:

```
grep -rn "<fnName>(" src/ --include="*.tsx" --include="*.ts" | grep -v "api.ts:" | grep -v __tests__
```

| Function (client wrapper in `src/components/CaseWorkspace/api.ts`) | Real caller found? |
|---|---|
| `linkArtifactToCase` (POST artifact-links) | **NO** — 0 callers anywhere in `src/` |
| `pinArtifactRevision` (POST .../pin) | **NO** — 0 callers |
| `unlinkArtifactFromCase` (DELETE artifact-links) | **NO** — 0 callers |
| `retryProposal` (POST .../retry, the "controlled idempotent retry") | **NO** — 0 callers |
| `createPlanDraft` / `proposePlanVersion` / `publishPlanVersion` / `withdrawPlanVersion` / `requestChangesOnPlanVersion` (plan-version lifecycle) | **NO** — 0 callers; only `getPlanGraph`/`listPlanVersions`/`validatePlanVersion` (reads) have callers |
| Case closure (any `closureType`, incl. `COMPLETED_PARTIAL`/`DELIVERY_COMPLETED`) | **NO endpoint even exists in the frontend client** — `api.ts` has no closure function at all |
| `startLightOneClick` (POST .../light-start) | **YES** — `CaseDetailScreen.tsx:691` |
| `requestChangesOnProposal` (proposal-level REQUEST_CHANGES) | **YES** — `RealizacjaView.tsx` `runPendingCommand`, wired to the "Poproś o zmiany" button |
| `provideHumanInput` | **YES** — `RealizacjaView.tsx:360` |
| `proposeConversationWorkOrder` / `confirmConversationWorkOrder` | **YES** — `src/components/AIChat/CaseIntakeConfirmCard.tsx`, rendered from `MessageRenderer.tsx` (real chat surface) |

Server-side: the seven module capability adapters
(`server/src/services/caseWorkspace/adapters/*.ts`, which call `linkArtifactToCase`
among other things) are confirmed **not wired into process boot** by that directory's
own `index.ts` header comment (coordinator-verified 2026-08-12): every capability there
is dead code in a real deployment until `registerBuiltinCapabilityAdapters` is called
at boot, which nothing in production currently does. So there is no server-side
consumer either for the artifact-link write path.

This directly determines which sub-claims each new ledger row below can honestly mark
closed vs PARTIAL: a claim proven only through a client function with zero real
callers fails rule 2 regardless of how solid the backend+DB proof is, and stays
PARTIAL/OPEN on that specific point.

## Gaps 1 and 2 — RESPONSIVE_ACCESSIBILITY_LEDGER.csv / CUSTOMER_JOURNEY_LEDGER.csv

Both ledgers were 0% evidence (all rows `NOT_IMPLEMENTED`, `claude-coordinator`,
2026-08-09, no test_ref/evidence_ref). This pass cross-referenced each row's literal
requirement text against the evidence packs this packet's brief pre-verified as
legitimate (`e5-a11y-matrix-2026-08-12/`, `f1-back-button-a11y-2026-08-12/`,
`f2-bottomnav-contrast-2026-08-12/`, `g1-nav-active-canon-2026-08-12/`,
`f3-partial-skipped-2026-08-12/`), plus grep-verified code facts (i18n keys, motion
usage, component wiring) for narrower claims. See the ledger CSVs themselves and the
final report for the row-by-row disposition — most rows do NOT have matching evidence
and were left `NOT_IMPLEMENTED`/`OPEN`, per the packet's own instruction that this is
the expected, correct outcome.
