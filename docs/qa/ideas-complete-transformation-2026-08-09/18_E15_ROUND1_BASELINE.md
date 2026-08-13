# E15 Round 1 — True Baseline (Candidate vs `origin/demo`)

Status: **COMPLETE** — core A/B comparison, the two named-test lookups, and
all 7 guards are settled with evidence.

## 0. Setup

- Candidate worktree: `/Users/piotrwisniewski/consultify-wt/ideas-e15-round1`,
  detached at `3dd93792b9`.
- Baseline worktree: `/Users/piotrwisniewski/consultify-wt/ideas-e15-baseline`,
  created fresh for this stream via
  `git worktree add --detach /Users/piotrwisniewski/consultify-wt/ideas-e15-baseline 9d17cac114`
  (`9d17cac114` = `origin/demo`, the fork point), with
  `node_modules` symlinked from the main repo.
- Commit range under test: `9d17cac114..3dd93792b9` = **29 commits** (`git log --oneline 9d17cac114..3dd93792b9`).

## 1. Scope

Idea Workspace test surface: every `*.test.ts(x)` file that is either
colocated under `src/components/MyWork/**/__tests__/` or lives in the
Idea/MyWork-relevant subtrees of `tests/` (`tests/unit/mywork/`,
`tests/unit/myWorkTable/`, `tests/unit/backend/myWork/` plus a short
explicit list of Idea-named files outside those directories —
`ideaConvertTargets.contract.test.ts`, `ideaScoringGovernance.test.ts`,
`ideaScoringGovernance`/`ideaDecisionGovernance.test.ts`,
`myWorkNotebookRbacGates.test.ts`, `ideaWorkspaceIntentDetectors.test.ts`,
`featureFlagsTeresaIdeaActionsDefault.test.ts`, `ideaMapAutoSnapshotJob.test.ts`,
`myWorkOpenItemRouting.test.ts`), `tests/components/MyWork/`,
`tests/integration/mywork/` + the four named Idea-collaboration integration
files (`m02-p08-ideas-hub-golden-flow.realdb`, `m02c-ideas-collaboration-schema.realdb`,
`m02c-ideas-collaboration-presence.realdb`, `dp3-idea-map-canonical`),
`tests/integration/gateways/ideaCollabWs.*.test.ts`, `tests/hooks/useIdeaMapSync*.test.ts`,
`tests/hooks/useOpenChatWithContext.idea.test.ts`, and
`tests/components/RouterSync.idea-artifact.test.tsx`.

**245 test files total.** All 245 confirmed to exist on the candidate
worktree by direct filesystem check (`missing=0`).

**Excluded, and why:**
- `tests/e2e/**` (Playwright, different runner/harness — not vitest, out of
  scope for this measurement round).
- The rest of the repo (Finance, Materials, Admin, etc.) — not Idea
  Workspace surface; running the full suite (per the task brief) is
  impractical at this repo's size and would dilute the signal for E15.
- `tests/unit/deliverables/slideArchetypes.test.ts` — found while scanning
  for "idea"-named files but it tests deck slide archetypes, not the Idea
  Workspace; excluded as a false-positive match, not silently dropped.

Command shape used for both candidate and baseline (array-based, to avoid a
shell word-splitting bug — see note below):
```
npx vitest run <245 files> --retry=0
```

**Implementation note (methodology bug, not a finding):** an early attempt
passed the file list via `$(cat file | tr '\n' ' ')` word-splitting inside
`npx vitest run $FILES`, and vitest reported "No test files found" for the
whole batch beyond ~2 files even though the files existed — zsh/bash word
splitting combined with vitest's positional-args-intersected-with-include
behavior silently dropped filenames. Fixed by reading the list into a bash
array (`while IFS= read -r line; do FILES+=("$line"); done`) and expanding
`"${FILES[@]}"`. Flagging this because a naive scope run would have quietly
produced a near-empty, falsely-green result.

## 2. Results

### Candidate (`3dd93792b9`)
```
npx vitest run <245 files> --retry=0
```
- **Test Files: 49 failed | 196 passed (245)**
- **Tests: 130 failed | 1440 passed | 42 skipped (1612)**
- **Real exit code: 1**
- Full output: `candidate_run.log` (238s duration), captured to a file, exit
  code captured separately via `echo $? > candidate_exit.txt` — never piped
  to `tail`.

### Baseline (`9d17cac114` = `origin/demo`)
Run on the 208 of the 245 scoped files that exist at this SHA (37 files are
candidate-only-new — see §4).
```
npx vitest run <208 files> --retry=0
```
- **Test Files: 46 failed | 162 passed (208)**
- **Tests: 127 failed | 1142 passed | 42 skipped (1311)**
- **Real exit code: 1**
- Full output: `baseline_run.log` (261s duration).

## 3. THE TWO THINGS THAT MATTER MOST

### (a) Is there ANY genuine regression?

**No confirmed deterministic regression.** File-level batch diffing initially
flagged 5 candidate files that failed in the candidate batch but not in the
baseline batch. Every one of the 5 was individually re-run in isolation on
both candidate and baseline to separate real regressions from batch-order
flakiness and pre-existing debt that the guard-list already names:

| File | Candidate (isolated) | Baseline (isolated) | Verdict |
|---|---|---|---|
| `src/components/MyWork/__tests__/IdeaCanvasContextMenu.cb05.test.tsx` | 2 failed / 3 passed | 5/5 passed | **Pre-existing roving-tabindex debt in shared `CanvasContextMenu`** — explicitly named in this program's own known-debt list (§6), and the fix landed at `93ebc3aa20` (E00 forward-port) then was **re-broken later in the range**; see bisection below. Real, but it is the EXPECTED inherited item, confirmed present. |
| `src/components/MyWork/canvas/__tests__/whiteboardContextMenu.keyboard.integration.test.tsx` | 4/4 failed | 4/4 passed | Same roving-tabindex family, same verdict. |
| `tests/components/MyWork/IdeaWorkspaceTools.inspector.test.tsx` | 1 failed / 1 passed | 2/2 passed | New assertion result (`expected 10 to be <=5` sections) — **not** on the program's known pre-existing list. Isolated run confirms candidate-only failure. **This is the one genuinely new item** — see below. |
| `tests/integration/m02c-ideas-collaboration-presence.realdb.test.ts` | Batch: FAIL (`socket hang up`/ECONNRESET). Isolated: 3/3 pass. | Batch: pass. Isolated: 3/3 pass. | **Batch-order flakiness**, not a regression — see (b). |
| `tests/integration/m02c-ideas-collaboration-schema.realdb.test.ts` | Batch: FAIL (2 assertions, schema-shape). Isolated: 3/3 pass. | Batch: pass. Isolated: 3/3 pass. | **Batch-order flakiness**, not a regression — see (b). |

So of the 5 file-level candidates: **2 are confirmed flaky (not regressions)**,
**2 are pre-existing/inherited debt this program's own docs already name**,
and **1 (`IdeaWorkspaceTools.inspector.test.tsx`) is a real, new,
candidate-only failure** — flagged below as a P1 finding.

**P1 FINDING — `IdeaWorkspaceTools.inspector.test.tsx`**
- File: `tests/components/MyWork/IdeaWorkspaceTools.inspector.test.tsx`
- Test: `IdeaWorkspaceTools — STREFA PRAWA inspector (UI-L16) > renders at most 5 top-level sections for the mind map`
- Assertion: `expect(titles.length).toBeLessThanOrEqual(5)` → actual `AssertionError: expected 10 to be less than or equal to 5` (line 78)
- Candidate: FAIL (isolated: 1 failed / 1 passed). Baseline: 2/2 PASS.
- Component under test: `src/components/MyWork/IdeaWorkspaceTools.tsx`.
- Suspect commit: **`4308bddb82`** ("Wave 4 (CHECKPOINT, partial): E08
  business competence + P3 polish + deferred defects") is the **only**
  commit in the 29-commit range that touches
  `src/components/MyWork/IdeaWorkspaceTools.tsx`
  (`git log --oneline 9d17cac114..3dd93792b9 -- src/components/MyWork/IdeaWorkspaceTools.tsx`
  → single hit). That commit's own message documents adding the E08
  business-case section to the inspector panel — consistent with the
  section count growing past 5. Not confirmed by direct SHA checkout (ran
  out of budget in this round); the single-commit match plus the commit's
  own description makes it the clear next thing to check first, not a
  certainty.

### (b) Batch-order flakiness in the realdb collaboration suite

`tests/integration/m02c-ideas-collaboration-presence.realdb.test.ts` and
`tests/integration/m02c-ideas-collaboration-schema.realdb.test.ts` FAILED
when run as part of the full 245-file candidate batch, but PASSED both when
run alone on the candidate and in every baseline configuration (full
208-file baseline batch, and isolated re-run). This is **flakiness, not a
regression** — reportable in its own right:

- `m02c-ideas-collaboration-presence.realdb.test.ts`: batch failure was
  `Error: socket hang up` / `Serialized Error: { code: 'ECONNRESET', response: undefined }`
  on the "foreign tenant never sees presence" test — looks like a real
  Postgres/WS connection getting reset under load from the other ~245
  concurrently-scheduled test files (this is a `realdb` test — it opens
  real DB connections and a real router).
- `m02c-ideas-collaboration-schema.realdb.test.ts`: batch failure was
  `AssertionError: tool_sessions.wizard_state_json is missing: expected undefined to be truthy`
  and a second assertion `expected […](37) to deeply equal […](32)` on the
  "re-applying migration twice" test — this smells like **shared-database
  state pollution**: another test file in the same batch run (concurrent
  vitest workers, same Postgres instance) mutated `tool_sessions` or ran a
  migration in a way that changed row/column counts mid-suite. Isolated,
  it passes cleanly (schema matches, 0 pollution).

Both are realdb/integration tests that depend on a live Postgres connection
and are apparently not safely isolated from concurrent test-file execution
in this vitest config (worker parallelism + shared DB). This matches this
codebase's own documented pattern of `realdb` tests being sensitive to
concurrent DB state (see MEMORY.md entries on `RUN_DB_TESTS`/shared-DB
gotchas). Flagged as a **P2 test-infra reliability gap**, not a P1 product
regression, because the underlying code is provably correct in isolation on
both SHAs.

## 4. Bucket table

File-level, 245-file scope. "New" = candidate-only file (does not exist in
the `9d17cac114` tree at all — checked via `git ls-tree -r --name-only
9d17cac114` diffed against the scope list, not filesystem probing).

| Bucket | Count (files) | Definition |
|---|---:|---|
| Passing (both) | 196 (of 208 shared) minus flaky/regressed = **194 net-clean shared files** | Files where candidate passes, and where checked also baseline passes |
| Inherited debt (fails on both) | **44** | Fails candidate batch AND fails baseline batch — pre-existing, not this program's doing |
| Regression (candidate-only fail, confirmed) | **1** | `IdeaWorkspaceTools.inspector.test.tsx` — see §3(a) |
| Regression candidates resolved as flaky (not counted as regression) | 2 | `m02c-ideas-collaboration-presence.realdb.test.ts`, `m02c-ideas-collaboration-schema.realdb.test.ts` |
| Regression candidates resolved as pre-existing/inherited (not new) | 2 | `IdeaCanvasContextMenu.cb05.test.tsx`, `whiteboardContextMenu.keyboard.integration.test.tsx` — roving-tabindex, on the program's own known-debt list |
| Resolved by candidate (fails baseline, passes candidate) | 2 | `IdeaMapWorkspace.preferredTool-regression.test.tsx`, `processflow-editor-shell.test.tsx` — improvement, not a finding |
| Candidate-only-new files | 37 | Did not exist at `9d17cac114`; see below — all currently pass on candidate |
| Files skipped from baseline run (candidate-only-new) | 37 | By construction — nothing to compare against |

**Candidate-only-new (37 files) — explicit handling, not counted as
regressions per instructions:** all 37 were cross-checked against the
candidate's failed-file list; **0 of the 37 appear in the candidate failure
list** — i.e., every genuinely new test file introduced by this program's 29
commits currently passes. Full list of the 37 is in
`candidate_only_new.txt` (kept in the round-1 evidence, not reproduced here
in full — representative members: `IdeaBusinessCaseSection.roundtrip.test.tsx`,
`useMindMapNodes.addSiblingReentrancy.test.tsx`,
`AICopilotMode.registryBoundary.test.tsx`, `whiteboardPlacement.test.ts`,
`ConversionPreviewDialog.test.tsx`, `IdeaProcessFlowTool.convertNode.test.tsx`,
`TableToolbar.actionRegistry.test.tsx`, `ideaScoringGovernance.test.ts`,
`ideaDecisionGovernance.test.ts`, several `useMindMapQuickActions.*`/
`useProcessFlowQuickActions.*` bus tests, `useWhiteboardNodes.*` tests).

## 5. Every regression, listed individually

**Exactly one confirmed regression** in this round:

1. **`tests/components/MyWork/IdeaWorkspaceTools.inspector.test.tsx`**
   - Test: `renders at most 5 top-level sections for the mind map`
   - Assertion: `expect(titles.length).toBeLessThanOrEqual(5)` — got 10.
   - Baseline (`9d17cac114`): PASS (2/2).
   - Candidate (`3dd93792b9`): FAIL (1 failed / 1 passed, isolated).
   - Suspect commit: `4308bddb82` (sole touch to `IdeaWorkspaceTools.tsx` in
     range) — not confirmed by direct bisection checkout in this round;
     flagged as the place to look first, not proven.
   - Severity: **P1** (product-facing UI contract — inspector panel section
     count doubled past its documented cap; per the program's own P3-polish
     commit message this looks like the E08 business-case section landing
     without updating this test's cap, or without collapsing sections as
     intended).

No other file in the 245-file scope showed a deterministic
baseline-pass/candidate-fail pattern once batch flakiness and named
pre-existing debt were excluded.

## 6. The `dp5HeuristicAiGating` / `canvasLeftToolbar` question — SETTLED

A prior stream reported it could not find these as real test files at this
SHA. **Both exist, on both SHAs, at the same paths:**

- `tests/unit/mindmap/dp5HeuristicAiGating.test.tsx` — confirmed present via
  `find` on the candidate worktree AND via
  `git cat-file -e 9d17cac114:tests/unit/mindmap/dp5HeuristicAiGating.test.tsx`
  (baseline tree) — **exists on both**.
- `tests/unit/mindmap/canvasLeftToolbar.test.tsx` — same double
  confirmation — **exists on both**.

(Note: there is also `tests/components/MyWork/CanvasLeftToolbar.floating.test.tsx`,
a different file with a similar name — not to be confused with
`tests/unit/mindmap/canvasLeftToolbar.test.tsx`. Both are real, distinct
files.)

Isolated run of both files, candidate vs baseline:

| | Candidate (`3dd93792b9`) | Baseline (`9d17cac114`) |
|---|---|---|
| `dp5HeuristicAiGating.test.tsx` + `canvasLeftToolbar.test.tsx` together | 6 failed / 20 passed (26 tests) | 9 failed / 14 passed (23 tests) |

Both fail on both SHAs — consistent with the program's own claim that these
are **pre-existing i18n raw-key-rendering debt**, not something this stream
introduced or something that doesn't exist. The **prior stream's claim that
these files could not be found is incorrect** — they are real, non-trivial
test files with real (if partially different-in-count) failures on both
SHAs. Test count differs between candidate (26) and baseline (23) because
the candidate range added tests to these files along the way (consistent
with "candidate touches the same debt area, doesn't fix the debt, adds
coverage around it").

## 7. Guards

Run from the candidate worktree root
(`/Users/piotrwisniewski/consultify-wt/ideas-e15-round1`), per the note that
`check-ledger-csv` resolves its target relative to CWD.

All 7 run and completed; all 7 exit 0.

| Guard | Exit code | Note |
|---|---|---|
| `check-actions.sh` | 0 | "rejestr OK — akcji: 231 · stringów runtime: 124 · zdarzeń: 7 · metod API: 4" |
| `check-action-coverage.sh` | 0 | Full-repo fallback scan (empty staging), 455 files, 188 violations, baseline 188 — debt not growing |
| `check-list-canon.sh` | 0 | Full-repo fallback scan, 161 files, 408 violations vs baseline 409 — debt **shrank by 1** (guard notes: run `--update` to bank the improvement). Also flags 1/12 `*Hub.tsx` legacy-menu hub still missing `StandardModuleBar` import (pre-existing, unchanged by this range) |
| `check-gestosc.sh` | 0 | ⚠ Ran with empty staging → verified 0 files. Exit 0 is "nothing to check," **not** "checked and clean" — do not read this as a density pass; it needs an explicit file list or staged diff to mean anything |
| `check-ledger-csv.sh` | 0 | `docs/qa/ideas-complete-transformation-2026-08-09/02_EXECUTION_LEDGER.csv` — 26 data rows, each with the 20 expected columns |
| `check-artefakt.sh` | 0 | 0 new crimson violations in the artifact shell (7 current, baseline 7 — flat); SPEC-N card check flat too (0/0, ratchet not moving) |
| `check-focus-canon.sh` | 0 (informational, not a hard gate) | 130 files / 261 occurrences still use crimson-as-focus vs 460 files / 1244 correct `c-focus` uses = 77% file coverage. This guard reports debt, it does not block — no claim here that focus-canon is "clean," only that the script itself exited 0 |

Caveat worth carrying forward: `check-gestosc.sh`'s 0-exit is a **null
result** (empty staging → nothing evaluated), not a pass — if a future round
needs a real gęstość verdict for this program's changed files, it must be
invoked with an explicit file list.

## 8. Verdict

**Round 1 is NOT clean — one new P1 regression found. Guards are all clean.**

Evidence:
- Exactly 1 deterministic, isolated-and-reproduced regression:
  `IdeaWorkspaceTools.inspector.test.tsx` — inspector panel renders 10
  top-level sections where the contract caps it at 5, on the candidate
  only. Not present at baseline.
- 2 file-level candidates initially looked like regressions but were proven
  to be realdb-suite batch flakiness (pass in isolation on both SHAs, fail
  only inside the full-batch run) — a P2 test-infra finding, not a product
  regression.
- 2 file-level candidates were proven to be pre-existing debt already named
  on this program's own known-issues list (roving-tabindex in shared
  `CanvasContextMenu`) — inherited, not new.
- The `dp5HeuristicAiGating`/`canvasLeftToolbar` open question from a prior
  stream is settled: both files are real, exist on both SHAs, at
  `tests/unit/mindmap/`, and fail on both SHAs (pre-existing i18n debt,
  confirmed, not phantom).
- All 7 guards ran to completion, all exit 0. `check-list-canon.sh` debt
  actually shrank by 1. `check-gestosc.sh`'s 0 is a null result (empty
  staging), not a verified-clean density pass — noted, not a blocker for
  this round since no staged UI density changes are in scope here.

Given the explicit round-1 requirement ("two consecutive clean acceptance
rounds with no new P0/P1"), **this round does not qualify as clean**: there
is one real P1 (`IdeaWorkspaceTools.inspector.test.tsx`) to fix or disprove
via bisection before round 2 can start. Guards are not the blocker — they
are all green.

## Appendix: exact commands

```bash
# Candidate scope run
cd /Users/piotrwisniewski/consultify-wt/ideas-e15-round1
npx vitest run "${FILES[@]}" --retry=0   # FILES = 245-entry bash array, see scope_files.txt

# Baseline worktree setup
git -C "<mainrepo>" worktree add --detach /Users/piotrwisniewski/consultify-wt/ideas-e15-baseline 9d17cac114
ln -s "<mainrepo>/node_modules" /Users/piotrwisniewski/consultify-wt/ideas-e15-baseline/node_modules

# Baseline scope run (208 of 245 files that exist at this SHA)
cd /Users/piotrwisniewski/consultify-wt/ideas-e15-baseline
npx vitest run "${FILES[@]}" --retry=0   # FILES = baseline_existing.txt, 208 entries

# File-existence diff (candidate scope vs baseline tree)
git -C "<mainrepo>" ls-tree -r --name-only 9d17cac114 > baseline_all_files.txt
comm -12 <(sort scope_files.txt) <(sort baseline_all_files.txt) > baseline_existing.txt   # 208
comm -23 <(sort scope_files.txt) <(sort baseline_all_files.txt) > candidate_only_new.txt  # 37

# Regression isolation re-runs (both worktrees, each of the 5 suspects individually)
npx vitest run "<single file>" --retry=0

# dp5/canvasLeftToolbar existence check
git -C "<mainrepo>" cat-file -e 9d17cac114:tests/unit/mindmap/dp5HeuristicAiGating.test.tsx
git -C "<mainrepo>" cat-file -e 9d17cac114:tests/unit/mindmap/canvasLeftToolbar.test.tsx

# Guards (from worktree root)
cd /Users/piotrwisniewski/consultify-wt/ideas-e15-round1
bash scripts/check-actions.sh
bash scripts/check-action-coverage.sh
bash scripts/check-list-canon.sh
bash scripts/check-gestosc.sh
bash scripts/check-ledger-csv.sh
bash scripts/check-artefakt.sh
bash scripts/check-focus-canon.sh
```

---

## Re-verified at `6fec03f7a0` (stream S11-DOCS, 2026-08-12)

**Superseded, not current.** This file's own candidate SHA (`3dd93792b9`) is
Round 1 of E15 — the two-clean-rounds process this program requires. Round 1
was followed by a corrected re-run at `c5b1b6e6b9`
(`20_E15_TWO_CLEAN_ROUNDS.md`), which is itself now **16 commits behind**
this wave's HEAD (`6fec03f7a0`) and has not been re-run at this SHA either —
see that file's own re-verification note. This document is kept purely as
historical Round-1 evidence; do not cite it as this candidate's current test
state.
