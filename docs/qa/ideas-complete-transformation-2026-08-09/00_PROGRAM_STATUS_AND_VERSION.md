# Ideas complete transformation — program status and version

Parent program: `docs/qa/ideas-manual-audit-2026-08-09/09_IDEAS_COMPLETE_TRANSFORMATION_PROGRAM_FOR_CLAUDE.md`
DoD/acceptance contract: `docs/qa/ideas-manual-audit-2026-08-09/11_IDEAS_EPICS_DOD_AND_FINAL_ACCEPTANCE_PROTOCOL.md`
Scope decision: full E00–E15 in one continuous program (owner decision 2026-08-09), executed with Opus
orchestration + Sonnet implementer/reviewer subagents, no push/deploy, Codex is an additional gate before
owner visual acceptance (owner decision 2026-08-09).

## Candidate identity

- Worktree: `/Users/piotrwisniewski/.codex/worktrees/ideas-transform/consultify`
- Branch: `codex/ideas-transformation-20260809`
- Base: `origin/demo` @ `9d17cac114` (fix(release): reconcile demo migration preflight)
- Prior stale branch carrying the original (uncommitted) navigation work: `codex/sync-demo-20260729`
  @ `635fd2d48d`, which was 693 commits behind `origin/demo` — not used as base per CLAUDE.md golden rule
  (base branch must always be `origin/demo`).

## E00 status — candidate control and ledger

- [x] Fresh worktree created from `origin/demo`.
- [x] Forward-port of the already-implemented, already-tested Ideas navigation/context-menu unification
  (see `docs/qa/ideas-navigation-2026-08-09/REPORT.md`) via `git diff` + `git apply -3` (real three-way
  merge using shared object store blobs). 22/30 files applied cleanly (including 3 intentional deletions:
  `ContextMenuPortal.tsx`, `ContextMenuPortal.test.tsx`, `src/utils/melsCanvasFlag.ts`). 8 files produced
  real merge conflicts, resolved by parallel Sonnet subagents (workflow `wf_55e1a247-b7d`) then verified by
  a second independent Sonnet pass per file.
- [x] Audit source docs (`docs/qa/ideas-manual-audit-2026-08-09/00`–`11`) copied into this worktree for
  reference.
- [x] `npm install` (node_modules did not exist in the fresh worktree) — 2073 packages, 38s, exit 0.
- [x] Conflict reconciliation verified by an independent Sonnet verification pass (workflow
  `wf_55e1a247-b7d`): 8/8 files PASS, 0 needsFix — no markers remaining, syntax valid, navigation-unification
  intent preserved, no origin/demo-side content silently dropped. Full per-file evidence in
  `journal.jsonl` under this workflow run, summarized per-file in commit body.
- [x] Focused vitest run of the 7 forward-ported/related test files: **51/54 pass, 3 fail**
  (`tests/unit/mindmap/dp5HeuristicAiGating.test.tsx`). Root-caused: identical 3 failures reproduce on the
  ORIGINAL stale branch (`codex/sync-demo-20260729`, pre-forward-port) — i18n test-setup gap
  (`AIActionsPopover` renders raw i18n keys like `myWorkMindmap.aiGen.mapSummary` instead of resolved
  strings under the test's i18n mock), **pre-existing, not a regression introduced by this candidate**.
  Logged as a known defect to fix in Program B/C, not silently absorbed into "PASS".
- [ ] Full REPORT.md test matrix (74/74 shell/rail/nav/MyWorkHub/Table-honesty/shared-menu/tool-preference,
  9/9 Whiteboard async, 3/3 NodeContextMenu gating, 2× clean Playwright rounds, 8 axe scans) could not be
  reproduced from distinct test files in this candidate — those counts likely span additional test files
  not part of the captured diff, or were partly e2e/Playwright runs against a live server. Status:
  **NOT VERIFIED** for this exact candidate SHA until rerun. This is the correct honest state per doc 11
  §3.8 (stale/mismatched-SHA evidence is not acceptance evidence) — carried into Program A as an open item,
  not assumed to still hold.
- [x] Baseline four-scene readback via dev-render harness (`?screen=melscanvas-workspace`, mock idea
  `idea-dbr77-demo-1`, real `<IdeaMapWorkspace>` component, no login, per CLAUDE.md rule #7). Confirmed:
  geometry (info panel left / tool rail right), mandatory 4-representation switcher present with correct
  a11y names (Mapa myśli/Whiteboard/Process Flow/Tabela), canvas content survives representation switch.
  Table already exposes the required saved views (Domyślny/Triażowanie/Scoring/Log decyzji/Timeline) —
  ahead of the §5.4 requirement. Screenshots: `screenshots/e00-baseline__{mindmap,whiteboard,processflow,
  table}__1280x800__light__pl.png`.
- [x] **Pre-existing repo-wide defect found and fixed**: `dev-render/main.tsx` statically lazy-imports
  `./screens/tools-sesja-wyjscie`, a file that does not exist on `origin/demo` — this broke the ENTIRE
  dev-render harness (all ~128 screens, not just Ideas) with a Vite import-analysis error. Same pattern
  previously logged in memory for M04/M06/M11/M13 ("harness dev-render znów martwy... 1 brakujący plik =
  128 ekranów") — recurring, not new. Fixed by removing the dangling lazy import + registry entry for
  `tools-sesja-wyjscie` (2-line removal, no content invented). This fix is local to this worktree/branch
  only; it is not yet on `origin/demo` and will need to land there separately for other sessions.
- [ ] Runtime/backend/database/session identity and version badge captured (dev-render harness is
  frontend-only mock; live backend/DB identity capture deferred to a later Program A pass with the real
  server running, not required to unblock Program B/C work).
- [ ] `01_CANON_AND_DECISION_REGISTER.md` populated (`02_EXECUTION_LEDGER.csv` skeleton created, one
  finding logged so far: untranslated i18n key `myWork.whiteboard.toolbarExtra.insert` visible in
  Whiteboard Menu 3 — both as label text and as the button's accessible name).

This file is updated as the program proceeds; do not treat it as final until Program H closes.
