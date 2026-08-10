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

## Independent control checkpoint — 2026-08-10

Recorded while Claude had an active uncommitted wave; it describes only the last committed candidate.

- Last committed candidate: `5d80167c5b1caa5f68d83adc2a7b992f05275cd7` (20 commits ahead of `origin/demo`).
- `scripts/check-actions.sh`: PASS — 177 unique actions, 104 runtime strings.
- `scripts/check-action-coverage.sh`: PASS as a ratchet with 288 existing constructs retained as baseline debt; not proof of complete coverage. [Correction 2026-08-10: `288` was already flagged as a stale figure in `03_CODEX_QUALITY_BACKLOG.md` QG-02 — the actual accounted baseline at HEAD `111868e07a` is 264 constructs (127 files), individually classified in `04_ACTION_COVERAGE_INVENTORY.csv` as 76 (a) / 152 (b) / 5 (c) / 31 (d); a separate heuristic fix then reduced the live ratchet total to 194 (91 files) without fixing any of the 36 unresolved class-(c)/(d) rows. **Further update 2026-08-10 (post-merge):** all 5 class-(c) and all 31 class-(d) rows have since been individually re-verified (registry id exists + component call site routes through `runIdeaAction` with that id) and reclassified `resolved` — live counts are now 76 (a) / 152 (b) / 0 (c) / 0 (d) / 36 (resolved). `03_CODEX_QUALITY_BACKLOG.md` QG-02 is now RESOLVED, not PARTIAL.]
- Independent focused regressions: 12 files, 76/76 PASS; repeated React duplicate-key warnings for `#3b82f6` remain.
- Full root type-check: **NOT VERIFIED**; no terminal result during the inspection window.
- Runtime/backend/database/cold-reopen readback: **NOT VERIFIED**.
- Final program acceptance: 0/16 epics under the full exact-SHA/runtime/persistence/visual-CX DoD.
- Required closure backlog: `03_CODEX_QUALITY_BACKLOG.md`.

## Current-state reconciliation — 2026-08-10 (QG-06)

Written by the QG-06 task (`03_CODEX_QUALITY_BACKLOG.md`) to bring this file up to date with the actual
committed HEAD instead of describing only E00. This section is a **documentation-vs-git reconciliation**,
not a fresh acceptance pass: every claim below is sourced from commit messages, `git log`/`git show`
evidence, the files each commit touched, and this session's own reruns of `scripts/check-actions.sh` /
`scripts/check-list-canon.sh` on this exact tree. It does **not** add any new runtime, persistence or
visual/CX verification — those remain exactly as unverified as the sections above already say. Do not
treat "implemented" below as "accepted"; acceptance requires the exact-SHA runtime/persistence/visual
chain in doc 11 and `QG-03`, which has not run.

### Candidate identity (current)

- HEAD: `111868e07a` — "Wave 5: E09 mounted, E10/E11/E12/E13/E14 opened, R10 debt cleared".
- Branch: `codex/ideas-transformation-20260809`.
- Base: `origin/demo` @ `9d17cac114`, 23 commits ahead, 0 behind (`git rev-list --count 9d17cac114..HEAD`).
- No push, no merge to `demo`, no deploy at any point (repeated in every wave's commit body).
- Registry size at this HEAD: **200 actions / 119 runtime strings / 5 events / 4 API methods**
  (`scripts/check-actions.sh`, rerun clean by this session, exit 0).
- `scripts/check-list-canon.sh` also rerun clean by this session on this tree (exit 0; repo-wide table-canon
  debt did not increase).

### Program A–H status (per `docs/qa/ideas-manual-audit-2026-08-09/09_..._PROGRAM_FOR_CLAUDE.md` §12)

| Program | State | Basis |
|---|---|---|
| A — candidate and contracts | DONE | E00 checklist above; `01_CANON_AND_DECISION_REGISTER.md`; baseline 4-scene screenshots. Ledger's own integrity was NOT part of Program A's original DoD but is now reconciled by this QG-06 pass (see below). |
| B — stabilize shared platform | IMPLEMENTED, DoD PARTIALLY CLOSED | Action Registry wired for all 4 tools (231 actions after the 2026-08-10 post-merge QG-02 remediation; `check-actions.sh` clean per this session's rerun). `03_CODEX_QUALITY_BACKLOG.md` QG-01 (registry monolith not yet split) is still open. QG-02 (coverage ratchet accounting) is now RESOLVED — all 36 former class-(c)/(d) rows are individually re-verified as genuinely registered and wired. Program B's own exit line ("shared primitives mounted by real consumers") is still not independently demonstrated at runtime — that remains QG-03/QG-05's job, not QG-02's. |
| C — finish four authoring tools | IMPLEMENTED per commit record, NOT VISUALLY/RUNTIME ACCEPTED | Wave 4/5 commit bodies claim P1/P2/P3 items closed (WB-CLIPBOARD-01 real object clipboard, WB-P1-02 placement service, MM-P1-01 sibling reentrancy, TB-P1-02/03, PF convert-wrong-target, MM invisible line-style, and others) plus targeted vitest green (Wave 4: 122/122; Wave 5 A/B: 25 failed/167 passed BEFORE vs 25 failed/247 passed AFTER, same pre-existing failure count). None of this is the doc-11 exact-SHA runtime/persistence/visual chain — see Independent control checkpoint above and QG-03. |
| D — business competence (E08) | PARTIAL, PERSISTENCE EVIDENCE_MISSING | Stage-gate model, business-case schema/service/routes/panel, and (per Wave 5) 9-dimension scoring + decision-log governance now compile and are flag-gated. Both `E08` migrations (`20260810_idea_maturity_gates.sql`, `20260810_idea_business_case.sql`) are UNAPPLIED (see below) — every header comment in those files says so explicitly. No readback has been proven. |
| E — financial competence (E09) | MOUNTED, NOT RUNTIME/PERSISTENCE VERIFIED | Wave 5: engine (`src/services/ideaFinance/`) and UX (`src/components/MyWork/table/financial/`), previously built by two independent agents and never connected (Wave 4 held this back as dead code per `check-gestosc.sh`), now have a real adapter (`engineAdapter.ts`) and are mounted behind a default-OFF flag. `check-gestosc.sh` passing is cited as the dead-code proof, which is a static-import check, not a runtime/persistence one. |
| F — visual completion (E13) | OPENED, NOT CLOSED | Wave 5 added 8 screenshots (`screenshots/e13-{mindmap,processflow,table,whiteboard}-{light,dark}.png`) and commit-body-claimed targeted fixes, but the doc-11 §6/§3.6 visual matrix (3 viewports × light/dark × PL/EN × 100/200%, hard-FAIL checklist) has not run against this SHA. |
| G — conversion and lifecycle (E11) | PARTIAL | Wave 5: mandatory preview dialog (`ConversionPreviewDialog.tsx`) now gates every conversion entry point; lineage gained `mappingVersion` + `source_link`; Mind Map single-node Convert no longer cascades. The `mappingVersion` column itself lives in an UNAPPLIED migration (`20260810_idea_conversion_mapping_version.sql`), so lineage completeness cannot be read back from a real database yet. |
| H — hardening and final check | NOT STARTED | No E15 final-regression/evidence-closure work found in the commit history; `RESUME_HANDOFF.md` §6 lists E15 under "remaining program scope (not started)" and nothing since Wave 4 changes that. |

### Epic E00–E15 status (per `docs/qa/ideas-manual-audit-2026-08-09/11_..._PROTOCOL.md` §4)

| Epic | State | Note |
|---|---|---|
| E00 Candidate control and ledger | DONE, ledger now reconciled | See E00 section above. This QG-06 pass additionally: replaced all 19 `"pending commit"` placeholders in `02_EXECUTION_LEDGER.csv` with the actual introducing commit SHA (traced via `git log -S<row-id> -- 02_EXECUTION_LEDGER.csv`, not guessed from chronology), and added `scripts/check-ledger-csv.sh` (a real-CSV-parser guard for the 20-column contract), which passes on this file. |
| E01 One Idea data model and integrity | NOT VERIFIED at epic-DoD level | Individual P0/P1 fixes referenced in Program C above, but no dedicated E01 closure evidence (duplication-through-representation-cycle test, two-users-different-views proof) found in this history. |
| E02 Action Registry | IMPLEMENTED, DoD PARTIALLY CLOSED | See Program B above; QG-01 open, QG-02 RESOLVED (2026-08-10 post-merge). |
| E03 Shell, navigation and ownership | IMPLEMENTED (chapter 13 N0–N8), acceptance NOT VERIFIED | Chapter 13 itself is headed "implemented candidate — acceptance evidence pending"; N5–N8 (= Program B/E02 wiring) are the packages this ledger tracks row-by-row. |
| E04 Mind Map | WIRED TO REGISTRY, DoD NOT CLOSED | N5.1–N5.5 (edge/pane/node-edit/convert/AI-style) all landed per the ledger rows now correctly SHA'd; the 18+ node scene / cross-link / AI-proposal persistence DoD has not been independently rerun. |
| E05 Whiteboard | WIRED TO REGISTRY, WB-CLIPBOARD-01 FIXED, DoD NOT CLOSED | Real object clipboard landed in Wave 5 (`80dfde5e05`); the ledger's own `WB-CLIPBOARD-01` row still correctly reads `NOT_VERIFIED` because it documents the pre-fix baseline finding, not the later fix — not altered by this pass since its `candidate_sha` was already a real SHA, not a placeholder. |
| E06 Process Flow | WIRED TO REGISTRY, DoD NOT CLOSED | N6.1–N6.4 landed; a real lane-resize-undo bug found and fixed in Wave 5, a lane-delete-silent-no-op bug found and left documented, not fixed. |
| E07 Table P15 | WIRED TO REGISTRY, DoD NOT CLOSED | N8.1/N8.2 + row/column/view menus landed; Program C's TB-P1-02/03 (field wizard, AI terminal states) claimed done per Wave 4 handoff. |
| E08 Business case and decision governance | PARTIAL, PERSISTENCE EVIDENCE_MISSING | See Program D above. |
| E09 Financial case | MOUNTED, NOT RUNTIME/PERSISTENCE VERIFIED | See Program E above. |
| E10 AI and Teresa | OPENED, NOT CLOSED | Wave 5 commit body: "opened with real audits and targeted fixes across AI scope honesty" — no epic-level DoD closure claimed. |
| E11 Conversion, import, export and templates | PARTIAL | See Program G above. |
| E12 Collaboration, security and resilience | OPENED, NOT CLOSED | Wave 5 added `ideaConfidentiality.ts` + `my-work.routes.ts` authorization changes; its migration (`20260810_idea_confidentiality.sql`) is UNAPPLIED. |
| E13 Visual system and CX | OPENED, NOT CLOSED | See Program F above. |
| E14 Accessibility, locale, performance and observability | OPENED, NOT CLOSED | Wave 5 commit body names this as opened with targeted fixes; `tests/unit/mindmap/dp5HeuristicAiGating.test.tsx` changes touched in the same wave, but the full a11y/locale/perf matrix (doc 11 §3.8) has not run. |
| E15 Final regression and evidence closure | NOT STARTED | See Program H above. |

### What is explicitly NOT VERIFIED (restated, not new)

This restates — it does not relax — the standing rule already stated in the Independent control checkpoint
section and in `RESUME_HANDOFF.md` §5:

- **Runtime verification** (mounted-build, authenticated-backend, real-DB mutation→save→refresh→cold-reopen
  chain per doc 11 §3.4/§3.7 and `QG-03`): **NOT VERIFIED** for any tool at this or any prior SHA in this
  program.
- **Persistence verification**: **NOT VERIFIED**. Four migrations exist in `server/migrations/` for this
  program and are **UNAPPLIED** — confirmed by each file's own header comment, not inferred:
  - `20260810_idea_maturity_gates.sql` (Program D / E08)
  - `20260810_idea_business_case.sql` (Program D / E08)
  - `20260810_idea_conversion_mapping_version.sql` (E11)
  - `20260810_idea_confidentiality.sql` (E12)

  Nothing has been run against any database (dev, demo, or otherwise) by this program; applying these
  requires an explicit owner/orchestrator decision, not a subagent action (repo DATABASE SAFETY rule).
- **Visual/CX acceptance**: **NOT VERIFIED**. Wave 5 captured 8 raw screenshots for E13, but the full doc-11
  §6/§3.6 matrix (3 viewports × light/dark × PL/EN × 100/200% zoom, hard-FAIL checklist, owner sign-off per
  CLAUDE.md rule #7) has not run against this or any SHA in this program.
- **Full root type-check**: still NOT VERIFIED (unchanged from the Independent control checkpoint above;
  QG-05 remains open per `03_CODEX_QUALITY_BACKLOG.md`).

This file is updated as the program proceeds; do not treat it as final until Program H closes.
