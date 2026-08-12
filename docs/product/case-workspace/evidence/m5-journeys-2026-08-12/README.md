# M5 — Customer journey ledger reconciliation (2026-08-12)

Worktree: `/Users/piotrwisniewski/dev/consultify-case-workspace-v1-20260809`
Branch: `claude/case-workspace-v1-20260809`, HEAD at start `0687420a61`

## Scope

Walked the eighteen vertical journeys named in this packet's brief and wrote
one row per journey to `CUSTOMER_JOURNEY_LEDGER.csv` (`CW-JRN-01`..`CW-JRN-18`,
append-only, zero existing rows touched — `git diff --stat` shows `18
insertions(+), 0 deletions` for that file). Also verified and closed the
brief's "known ledger defect" item in `GOLDEN_CASE_EVIDENCE_LEDGER.csv` (see
below) with one append-only verification row, `CW-GC-NOMENCLATURE-M5-VERIFY`.

**Method, per journey**: read the cited canon line, opened every evidence
file/README this row cites before writing a word about it, grepped the
current tree for real UI callers (never trusted a prior packet's "zero
callers" claim without re-checking, since two callers had moved since those
claims were written), and where a golden-case test underlies the row, re-ran
it fresh against the live disposable Postgres. No journey was marked
`IMPLEMENTED_AND_PROVEN` unless every layer this program's own rule requires
(real consumer, real backend, real DB readback, negative control where
applicable) was independently confirmed in this pass or in a prior pass whose
artifact this packet personally opened.

## Test re-runs performed by this packet

```
cd server && DB_TYPE=postgres LC_ALL=C NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
  POSTGRES_SKIP_INIT_IN_TEST=1 \
  DATABASE_URL="postgresql://case_workspace:case_workspace@127.0.0.1:55432/case_workspace_test" \
  npx vitest run <file> --environment node
```

| File | Result | Time |
|---|---|---|
| `goldenCaseLightOneClick.pg.test.ts` | 1/1 PASS | 20:19 |
| `goldenCaseTransformationMultiModule.pg.test.ts` | 1/1 PASS | 20:19 |
| `goldenCaseDirectModuleLateBinding.pg.test.ts` | 1/1 PASS | 20:19 |
| `goldenCaseRequestChangesPartialRetry.pg.test.ts` | 1/1 PASS | 20:19 |
| `goldenCaseTenancyRefusal.pg.test.ts` | 1/1 PASS | 20:19 |
| `integration/chatIntake.pg.test.ts` | 14/14 PASS | 20:23 |

Backend used for all live-evidence cross-checks: `127.0.0.1:3001`, PID
`11390` (coordinator-owned, not restarted by this packet — `curl
.../api/health` → 200 confirmed before starting, no restart issued).

## New findings this packet made while tracing real consumers

These are **not** re-statements of prior packets' findings; each is a fresh
grep/read against the current tree that either confirms, refines, or
contradicts an existing ledger row. Filed against the relevant `CW-JRN-*`
row's `evidence_ref` in full; summarized here for the coordinator:

1. **`updatePlanDraft` now has a real call site, but it is unreachable.**
   `src/components/CaseWorkspace/PlanView.tsx:256` (`handleSave`) genuinely
   calls the real `updatePlanDraft` API function with real `expectedVersion`
   OCC handling — this contradicts packet M1's own README, which still
   claims "`updatePlanDraft` remains completely unwired." Reading the whole
   768-line file end to end found **zero** `onClick`/button/input anywhere
   that calls `handleSave`, `updateNodeLabel`, or sets `editMode` to `true`.
   The data-layer plumbing for a plan graph editor exists; there is no
   reachable UI control that triggers it. Filed against `CW-JRN-03`.

2. **The chat->Case propose/confirm mechanism is real and reachable over the
   actual HTTP route**, not merely at the service layer:
   `chat.routes.ts:375` (`POST /conversations/:id/case-intake/turn`) wires
   `chatExecutionService.classifyIntent` into
   `caseIntakeService.proposeConversationWorkOrder`, proven by
   `chatIntake.pg.test.ts`'s first test driving that exact route (14/14 pass,
   re-run this pass). But `src/components/AIChat/CaseIntakeConfirmCard.tsx`
   — the only frontend caller of the confirm half — is never rendered in a
   real conversation: `MessageRenderer.tsx`'s own inline comment (line ~817)
   states verbatim "Nothing in this chat pipeline attaches this metadata
   type today." Filed against `CW-JRN-01`/`CW-JRN-02`.

3. **The seven case-workspace capability adapters ARE wired at process boot**
   (`server/src/index.ts:1895-1898` calls `bootstrapCaseWorkspaceCapabilities`
   for real) — this refines, rather than confirms, `CW-RT-063-L2`'s claim
   that they are "NOT WIRED INTO PROCESS BOOT." The boot call is real, but
   gated behind two unset env vars
   (`CASE_WORKSPACE_CAPABILITY_BOOT_ACTOR_ID`,
   `CASE_WORKSPACE_CAPABILITY_BOOT_ORG_ID`); without them the block logs
   `SKIPPED_MISSING_CONFIG` and no-ops (`index.ts`'s own comment says so).
   **Could not verify** whether the live coordinator-owned backend (PID
   11390) has those vars set — this packet has no working credentials
   against it and is forbidden from restarting it to check. Filed as an
   explicit "not verified either direction" against `CW-JRN-04`.

4. **`history` and `value` display are real, wired consumers, `closure` has
   none.** `CaseDetailScreen.tsx:688/702` call `listValueMeasurements` and
   `listHistoryEvents` as part of its real data load; `opisZdarzenia()`
   renders real history prose. A full-file grep of `api.ts` for the string
   `closure` returns nothing — there is no client function for any closure
   endpoint at all, confirming (not re-deriving) `CW-RT-041-L2`'s prior
   finding on this point. Filed against `CW-JRN-18`.

5. **No invented `CW-GC-G/H/I-*` row IDs exist anywhere** in any acceptance
   CSV (`grep -rn "CW-GC-G-|CW-GC-H-|CW-GC-I-" docs/product/case-workspace/acceptance/*.csv`
   → zero matches). The "invented second nomenclature" the brief warned
   about is real but lives only as **prose** inside
   `acceptance/SCOPE_ADJUDICATION.md` (e.g. "Golden Cases A/D/E/H", "Golden
   Case H") — it was never written into a ledger `row_id`. The five test
   files already carry real requirement-ID rows
   (`CW-RT-063-L2`/`CW-RT-065-L2`/`CW-CANON-L2-LIGHT`/`CW-RT-041-L2`/
   `CW-RT-024-L2`), added by `claude-l2-ledger-audit` in commit `a8003082a3`
   (18:25:04), which **predates** `CANDIDATE_DOD_AUDIT_2026-08-12.md`'s
   "zero matches" claim only in wall-clock terms that are close enough to be
   worth stating plainly: that audit's own git-tracked commit (`dbaaa4422d`)
   is at 17:50:45, i.e. **before** `a8003082a3` — so its finding was true
   when written and is stale now. See `CW-GC-NOMENCLATURE-M5-VERIFY` in
   `GOLDEN_CASE_EVIDENCE_LEDGER.csv` for the full citation chain.

## What this packet did NOT do

- Did not restart, redeploy, or send credentials against the coordinator-owned
  live backend (PID 11390).
- Did not run the full test suite or the 30-minute long-run test (per hard
  rule) — the 30-minute restart evidence cited for `CW-JRN-12` is opened from
  `evidence/e4-long-run-2026-08-12/*.json`, not re-run.
- Did not independently re-drive several UI actions with a fresh browser
  session where an existing packet's code-trace was judged sufficient and
  citing it precisely was more honest than re-clicking it for a marginal
  gain — each such row says explicitly, in its own `evidence_ref`, that the
  claim rests on a code trace rather than a fresh screenshot (see
  `CW-JRN-07`, `CW-JRN-08`, `CW-JRN-10`, `CW-JRN-14`, `CW-JRN-18`).
- Did not touch `VISUAL_TRIADA_SPEC_A_LEDGER.csv` (packet M4's), any other
  ledger CSV, `ledger-report.mjs`, or any product code.

## VoiceOver

Unchanged and out of this packet's scope — remains
`BLOCKED_BY_HOST_PERMISSION — VOICEOVER_MANUAL_EVIDENCE` per this program's
existing, unresolved record (`TERMINAL_STATUS_2026-08-12.md`, "BLOKER 3").
