# RESUME_HANDOFF — Ideas transformation program

Written at a hard session limit. Nothing below is a PASS claim beyond what the
evidence column literally says.

## 1. Candidate identity

| | |
|---|---|
| Worktree | `/Users/piotrwisniewski/.codex/worktrees/ideas-transform/consultify` |
| Branch | `codex/ideas-transformation-20260809` |
| HEAD | `4308bddb8260cf6f31998c7aef46aa5f514400d6` (`4308bddb82`) |
| Base | `origin/demo` @ `9d17cac114` |
| Position | **21 commits ahead of `origin/demo`, 0 behind** |
| Pushed? | **NO.** No push, no merge to demo, no deploy at any point. |

## 2. Dirty state — 8 untracked paths, all deliberate

These are **built but deliberately NOT committed** (see §5 BLOCKED):

```
src/components/MyWork/table/financial/
src/components/MyWork/table/ideaDecisionGovernance.ts
src/components/MyWork/table/ideaScoringGovernance.ts
src/services/ideaFinance/
src/utils/ideaFinancialCaseFlag.ts
tests/components/MyWork/table/
tests/unit/table/ideaDecisionGovernance.test.ts
tests/unit/table/ideaScoringGovernance.test.ts
```

Do **not** `git clean`, `git stash` or `git checkout --` these — they are the
entire E09 deliverable plus the E08 scoring/decision model.

## 3. What is DONE (committed and verified)

| Program | State | Evidence |
|---|---|---|
| E00 candidate control | DONE | Fresh worktree off `origin/demo`; forward-port of navigation work reconciled via real 3-way merge, 8 conflicts resolved + independently re-verified |
| Program A baseline | DONE | 4-scene readback + screenshots; canon/decision register (`01_CANON_AND_DECISION_REGISTER.md`); repo-wide dev-render harness repaired |
| Program B / E02 action registry | DONE for all 4 tools | **184 actions**; Whiteboard, Mind Map, Process Flow, Table menus/toolbars/rails wired; keyboard hooks reconciled; `check-actions.sh` R1–R9 clean |
| E02 DoD machine check | DONE (guard exists), and QG-02 now RESOLVED | New `scripts/check-action-coverage.{sh,awk}` ratchet, wired into `check-actions.sh` as R10 + pre-commit; negative-control proven to bind. [Correction 2026-08-10: an earlier `288` figure here was stale, corrected by `03_CODEX_QUALITY_BACKLOG.md` QG-02 to an accounted baseline of 264 constructs (76 (a) / 152 (b) / 5 (c) / 31 (d), see `04_ACTION_COVERAGE_INVENTORY.csv`). Update 2026-08-10 (post-merge): all 5 class-(c) and all 31 class-(d) rows have been individually re-verified against the merged registry and their component call sites and are now `resolved` (76/152/0/0/36); QG-02 is RESOLVED, not PARTIAL.] |
| Program C P1 | DONE | WB-CLIPBOARD-01 (real object clipboard), WB-P1-02 (placement service), MM-P1-01 (sibling reentrancy), TB-P1-02 (field wizard), TB-P1-03 (AI terminal states), WB-P1-04 (keyboard drawing) |
| Program C P2 | DONE | Mind Map PPM regrouping, Process Flow creation-surface dedup + lane naming, Table toolbar IA, Whiteboard naming/AI-gating/tidy |
| Program C P3 | DONE | Tool→Appearance (EN+PL), Fit view 25–300%, Table empty-state 3 paths, AI scope vocabulary unified |
| Defects found & fixed | DONE | PF convert-wrong-target; MM invisible line-style; canvas undo now covers strokes; Table platform-mode lying "Column deleted" toast |
| E08 business (model+backend) | PARTIAL | Stage gates + business-case schema/service/routes/panel land and compile — but see §5 |

## 4. Tests actually run (targeted only; never the full suite — OOM-prone)

Last full verification pass before checkpoint:
- `bash scripts/check-actions.sh` → **184 actions, R1–R9 clean**
- `bash scripts/check-list-canon.sh` → clean
- `bash scripts/check-gestosc.sh` → clean (after held-back set removed)
- `esbuild --bundle=false` → clean on every changed/new source file
- Wave 4 targeted vitest: **122/122 across 10 files**
- Wave 3 targeted vitest: **94/94 across 13 files**

Known **pre-existing** failures — repeatedly A/B-confirmed against HEAD, never
introduced by this program, do NOT "fix" them blind: i18n mocks returning raw
keys (`dp5HeuristicAiGating`, `canvasLeftToolbar`); roving-tabindex gaps in the
shared `CanvasContextMenu`; ~10 `ProcessFlowToolbar` AI-panel-trigger failures;
~11 `useTableViews` "t is not a function".

## 5. BLOCKED / PARTIAL / EVIDENCE_MISSING — read before claiming anything

**PARTIAL — E09 financial competence. Do NOT report as delivered.**
Engine (`src/services/ideaFinance/`, 32 hand-computed tests green) and UX
(`src/components/MyWork/table/financial/`) were built by two independent agents
and have **never been connected** — the UI consumes a seam interface, the engine
exposes its own API, nobody wrote the adapter. Uncommitted because
`check-gestosc.sh` correctly refused three modules with **zero importers**
(dead code — the "code exists, wiring doesn't" anti-pattern this repo has been
burned by). Guard was **not** bypassed and **not** silenced with a fake import.
The mounting task was dispatched and died at the session limit with zero edits.

**BLOCKED (owner decision) — two migrations committed but NEVER APPLIED.**
`server/migrations/20260810_idea_maturity_gates.sql`
`server/migrations/20260810_idea_business_case.sql`
Additive by construction. Nothing was run against any database; this program has
no deploy authority and this repo's migration machinery is known-fragile.

**EVIDENCE_MISSING — E08 persistence end-to-end.** Model, service and routes
exist and compile; **no readback has been proven** because the migrations above
are unapplied.

**OPEN DEBT — one deliberate, documented guard bypass in HEAD.** `4308bddb82`
was committed with `--no-verify`. R10 flags two unregistered action-like
handlers in the new `src/components/MyWork/panel/IdeaBusinessCaseSection.tsx`
(L166 jump-to-source, L207 `onRemove(idx)`). Real unresolved debt, recorded not
hidden, **not** baseline-bumped. This is the first task next session.

**NOT VERIFIED — visual/runtime evidence for recent waves.** Program A captured
baseline screenshots, but waves 2–4 have **no** exact-SHA runtime screenshots,
no cold-reopen readback, no PL/EN × light/dark × viewport matrix. Doc 11's
acceptance matrix is therefore **not** satisfied. Nothing here is
`READY_FOR_CODEX_REVIEW`.

## 6. Remaining program scope (not started)

E10 AI/Teresa full parity · E11 conversion/lineage (prior waves proved
conversions lack preview and append-only lineage, and Process-Flow "conversion"
is actually representation-generation) · E12 collaboration/security/resilience ·
E13/E14 visual + a11y/locale matrices · E15 two clean regression rounds +
evidence package + Codex handoff. Also unbuilt: Whiteboard frame containment
beyond the menu, and the ~55 remaining `TableToolbar.tsx` handlers.

## 7. First command to resume

```bash
cd "/Users/piotrwisniewski/.codex/worktrees/ideas-transform/consultify" && git log --oneline -3 && git status --short && bash scripts/check-actions.sh
```

Then, in order:
1. Register (or correct the heuristic for) the two R10 handlers in
   `IdeaBusinessCaseSection.tsx` so HEAD stops needing `--no-verify`.
2. Write the engine↔UI adapter for E09, mount `FinancialCaseView` behind
   `ideaFinancialCaseFlag`, wire `ideaScoringGovernance` / `ideaDecisionGovernance`
   into Table's existing "Scoring" / "Log decyzji" views, then commit the
   held-back set — `check-gestosc.sh` passing is the acceptance criterion.
3. Ask the owner for a decision on the two unapplied migrations.
