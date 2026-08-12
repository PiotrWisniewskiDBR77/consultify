# RESUME_HANDOFF — Ideas transformation program

Rewritten **2026-08-12** (stream S11-DOCS), updated same day after three
coordinator corrections and the E15 final numbers. This is the single entry
point. Nothing here is a PASS claim beyond what its evidence column literally
says.

**UPDATE 2026-08-12 (S20-DOCS, worktree `ideas-streams/s2-locale`, branch
`codex/ideas-s20-docs`, documentation only — no `src/`, `server/`, `tests/`,
or `dev-render/` changes):**

1. **This file's own "the only residual is the owner's visual acceptance"
   line below (§2) is stale and was already superseded** — the owner
   explicitly rejected that framing on 2026-08-12 (S14-EPICS), and the
   current, corrected epic-by-epic status lives in
   `24_FINAL_ACCEPTANCE.md` §3/§9/§11 and the tail of
   `00_PROGRAM_STATUS_AND_VERSION.md` ("CORRECTION 2026-08-12 (S14-EPICS)").
   Read those before trusting §2's gate board here. This pass did not rewrite
   §2 in place (see the reasoning `00_PROGRAM_STATUS_AND_VERSION.md` gives
   for the same choice: superseding a section rather than editing history in
   place keeps the record of what an earlier pass believed auditable).
2. **New code landed after this file's `f5cdc7b867` identity: new code-final
   SHA `f86afc077f`.** Three commits (`a18b625a78` S13-STICKY,
   `19f78356f9` S17-OVERLAPTEST, `f86afc077f` S18-NOOVERLAP, plus a test-only
   fix `a11441233a` and an evidence-capture commit `6b28161bc4`) closed the
   Idea Table's Updated/actions column-overlap regression at the 1280×800
   acceptance viewport — filed and resolved as `RISK-39`. Full detail: §3
   below, `16_OPEN_RISKS_AND_LIMITATIONS.csv` RISK-39,
   `19_VISUAL_CX_MATRIX.md`'s "RISK-39" section.
3. **Two methodological findings from this cycle, worth carrying forward
   because they generalize beyond this one ticket** (see §8 below for where
   they now sit alongside this program's existing method notes):
   - A sabotage that breaks *compilation* (not just the target logic)
     produces a red result for the wrong reason across an entire test file —
     confirm the sabotaged code still compiles (e.g. an `esbuild` syntax
     check) before trusting a red.
   - A test that derives its own pass/fail strictness from measured runtime
     state, instead of a fixed expectation, can be disarmed by the very
     regression it exists to catch — a reverted fix can silently reclassify
     itself into a "this case is exempt" branch and the test passes against
     sabotaged code.

**UPDATE 2026-08-12 (this continuation, worktree
`/Users/piotrwisniewski/.codex/worktrees/ideas-transform/consultify`, branch
`codex/ideas-transformation-20260809` — the canonical integration branch
itself, not a satellite this time):**

1. **Four defects closed, candidate-level (implementation + targeted test)
   only — NOT owner/runtime-accepted.** Splitting this cleanly, per this
   program's own rule of not conflating the three: **(a) implementation
   candidate** — exists, compiles, has a passing targeted test; **(b)
   runtime/manual odbiór — BLOCKED / EVIDENCE_MISSING**, nobody has clicked
   through any of these four fixes in a running app against a real backend;
   **(c) integration into `demo`/production — BLOCKED / EVIDENCE_MISSING**,
   this branch is not on `origin` at all (0 refs, see item 5 below).

   - **D1** (`2771824f08`) — `moduleHub.openDocuments.mywork` sessionStorage
     key was GLOBAL, unscoped to any identity: two identities in the same
     browser tab inherited each other's open-document tabs. Scoped to
     `moduleHub.openDocuments.mywork.<organizationId>.<userId>`; read/write
     skipped without both ids present; the old unscoped key is cleared on
     migration. Test: `src/components/MyWork/__tests__/MyWorkHub.storageScope.test.ts`,
     6/6 — candidate-level only, not run against a live multi-identity
     session.
   - **D4** (`87360b62e9`) — onboarding "Skip for now" called
     `finishAndGo(DEFAULT_ENTRY_ROUTE)`, force-navigating to `/chat`
     regardless of where the user actually was. **Reproduced live** before
     the fix: `location.pathname` flipped `/my-work` → `/chat` on Skip. Now
     closes the modal without navigating. Test: 7/7.
   - **D2** (`499b4b98c2`) — **raised from P2 to DATA-LOSS class.**
     `useWorkspaceGraphRuntime.refresh()` had no `catch` around the
     `GET /map` call: on failure, `graph` stayed at its untouched empty
     initial state, `shouldBootstrapStarterGraph()` read that as "brand-new
     idea," built a 6-node starter template, and **persisted it back to the
     server via `runtimeCaptureGraph` — overwriting the real server map**
     (the code's own pre-existing comment named this exact failure mode:
     "overwriting the real server map"). The existing M06 guard only
     covered `rtLoading`, never the error case. Fix: explicit error state
     (`role="alert" aria-live="assertive"`) plus a focusable retry calling a
     real refresh — no more silent bootstrap-and-overwrite on fetch failure.
     Test: 3/3, sabotage → 2/3 red.
   - **D3** (`914759d4cb`) — `primeServerVersion()` read a local draft's
     `pending` flag with NO version comparison, so a stale draft could pin
     the save-state indicator on "Changes queued" forever, and a genuinely
     queued draft was never auto-retried. Fix: `draftBaseVersion <
     serverVersion` comparison (stale → cleared) plus immediate flush of a
     real pending draft. Test: 2/2, sabotage → 2/2 red. **Live measurement
     confirming the pre-fix bug**, not just the unit test: after inserting
     an object, the indicator held "Changes queued" ≥10 s, survived a full
     reload (`navType === 'reload'`), and was still showing "Changes
     queued" 96 s post-reload with no further edits — while the server
     already had `GET /map` → 200, 7 nodes, 5 edges, version 9. Same root
     cause as D3.

2. **Hygiene.**
   - `a64b2657be` — cleared all 20 non-CSV `git diff --check` whitespace
     findings (8 docs + `src/actions/ideaActionRegistry.ts`). The remaining
     580 findings live in the program's 4 RFC-4180 evidence CSVs and are
     deliberately NOT converted (CRLF is correct there).
   - `b2438008fd` — 4× `TS2345` in the new D1 regression test (`status:
     'open'` is not a member of `ItemStatus`), found only by a FULL `tsc`,
     never by `esbuild` (workers never type-check). **Worth repeating for
     whoever resumes:** the FIRST `tsc` run against this tree returned
     `rc=134` (SIGABRT/OOM) while printing what looked like "0 errors" —
     that is a FALSE GREEN, not a pass. Only re-running with
     `NODE_OPTIONS=--max-old-space-size=8192` surfaced the 4 real errors.
     Do not trust a bare `tsc` exit code on this machine without checking
     it is not 134.
   - `diff --check` full run: `rc=2` / 580 findings / 0 conflict markers.
     Same run excluding ONLY the 4 evidence CSVs under
     `docs/qa/ideas-complete-transformation-2026-08-09/`: `rc=0` / 0
     findings / 0 conflict markers. Those 4 CSVs are 100% CRLF (43/43,
     265/265, 232/232, 40/40 lines) per RFC 4180 and are intentionally left
     that way.

3. **RISK-24 — the two-migration-mechanism problem, spelled out plainly.**
   `16_OPEN_RISKS_AND_LIMITATIONS.csv` RISK-24 is NOT edited by this pass
   (CSV files under this directory are out of scope for documentation
   work) — this is a prose elaboration of the same already-filed finding,
   not a new claim:
   - `server/scripts/migrate.postgres.ts:555-558` — with `--safe`, a FAILED
     migration is recorded as `skipped`, the loop continues, and the script
     still prints `✅ Postgres migrations complete` and exits **0**. A
     broken migration is invisible in the exit code.
   - The npm-script names actively mislead: `db:migrate`,
     `db:migrate:strict` and `db:migrate:postgres` are the SAME command
     with no flag; `db:migrate:unsafe-continue` is the one that passes
     `--safe`. The flag named "safe" is the dangerous one.
   - A second, independent mechanism exists: `DB_MANAGED_SCHEMA`
     (`server/src/index.ts:239-244`,
     `server/src/database/PostgresDatabase.ts:477-479`) can disable
     automatic DDL/migrations at server start entirely.
   - **Consequence:** there are two independent paths to change the
     schema, with separate bookkeeping. A "green migration" run proves
     nothing about whether the live schema matches what the code expects.

4. **Locale gap, stated plainly, not silently left implied-done.** The
   `mindmap.persistence` error-state keys D2 added (`mapLoadErrorTitle`,
   `mapLoadErrorBody`, `mapLoadErrorRetry`) are real, distinct EN/PL
   strings — but `de`/`ar`/`ja`/`es` all carry the raw ENGLISH text as
   PLACEHOLDERS (verified directly against
   `public/locales/{de,ar,ja,es}/translation.json`), not translations. Same
   class of gap RISK-26 already tracks for this program's earlier keys —
   not a new pattern, just a new, OPEN instance of it.

5. **Branch/remote state.** This branch has never been pushed:
   `git ls-remote origin 'codex/ideas-transformation-20260809'` returns
   nothing, `git branch -r` lists no matching ref. **REMOTE REACHABILITY:
   NOT VERIFIED, PUSH AUTHORIZATION REQUIRED** before any of this can be
   reviewed by anything outside this filesystem. Provenance:
   `git log --oneline 9d17cac114..HEAD | wc -l` = **83 commits** ahead of
   the frozen baseline (41 inherited from prior streams/passes + the
   commits of this continuation).

   Nothing here changes the recommendation: still `NOT_READY` — this
   closes 4 defects off a long residual list (see `24_FINAL_ACCEPTANCE.md`
   §9), not the list itself. Candidate code identity for everything above:
   **`914759d4cb`** (last commit before this pass's own documentation
   commit). Documentation-final HEAD after this pass's single commit:
   KANDYDAT KODU+DOKUMENTACJI: `83d6576c83e98b2316f02a6e5590b5d9cf3c24a6` — na tym SHA zmierzono E15, macierz wizualną
i Golden Journey. FINALNY HEAD to commit uzupełniający niniejsze wyniki; jest on
WYŁĄCZNIE dokumentacyjny (zero plików kodu), więc pomiary powyżej pozostają ważne.
Finalny SHA odczytaj z `git log -1` — commit nie może zawierać własnego skrótu. — that commit rewrites this very file,
   so it cannot correctly cite its own hash; the immutable code receipt
   stays `914759d4cb`, and the documentation-final HEAD is the placeholder
   above, to be filled in from `git log -1` after this commit lands.

## 1. Candidate identity

| | |
|---|---|
| Worktree (this reconciliation pass) | `/Users/piotrwisniewski/.codex/worktrees/ideas-streams/s6-e09` |
| Branch | `codex/ideas-s11-docs` |
| HEAD | **`bcdda752b7`** (this session's doc commit, cherry-picked onto the integration branch) |
| Code-final SHA (E15 was measured here) | **`f5cdc7b867`** — only documentation commits follow it |
| Prior handoff SHA (all 10 streams forked from here) | `edb38d6a29` |
| Base | `origin/demo` |
| Position vs `origin/demo` | **62 commits ahead, 2 behind** (see §5 for the drift and why the comparison base stays frozen) |
| Working tree | **clean** (verify with `git status --short` — expect 0 lines) |
| Pushed? | **NO.** No push, no merge to demo, no deploy. No demo or production database was ever contacted. |

`ideas-transform/consultify` (branch `codex/ideas-transformation-20260809`) is
the **canonical integration worktree** — every stream branch, including this
one, was cut FROM it, and every stream's commits are cherry-picked back INTO
it. It is not a separate lineage and there is nothing to reconcile with it;
this worktree (`s6-e09`) is a satellite used to prepare this documentation
pass and has itself now been moved onto the integrated tip (`bcdda752b7`).

Between the previous version of this file (HEAD `6fec03f7a0`) and now, three
code commits landed on the integration branch, none of them by this stream:

| Commit | What it did |
|---|---|
| `fe2b8b7a82` | Restored `tests/components/MyWork/canvasContextMenu.portal.test.tsx`, closing an E15-flagged coverage gap dating to this program's first commit (`93ebc3aa20`) — see §3. |
| `a537a022e2` | Routed E09's financial-case save/save-and-close/retry through `IDEA_ACTION_REGISTRY`, closing the `check-actions.sh` rc=1 this file previously reported as deliberately deferred — see §3. |
| `f5cdc7b867` | Fixed a cross-file type error (`useIdeaConfidentialityGate`'s bespoke `TFn` alias vs i18next's real `TFunction`) found only by a full, serialized `tsc` on the integrated tree — invisible to any individual stream by construction (workers run targeted vitest + esbuild, neither checks cross-file types). Client and server `tsc`: **exit 0, 0 errors**, both serialized. |

## 2. Gate board

| Gate | State | Evidence |
|---|---|---|
| 1 — full type-check | **PASS** — client `tsc` exit 0 / 0 errors, server `tsc` exit 0 / 0 errors, both serialized, at `f5cdc7b867` (two cross-file defects found and fixed at integration; see §1) | commit `f5cdc7b867` |
| 2 — QG backlog | unchanged, **QG-01…QG-06 all RESOLVED** | `03_CODEX_QUALITY_BACKLOG.md` |
| 3 — runtime + persistence | **PASS on isolated local DB, 9/9 chains** (E09 financial case added as chain 9) | `13_RUNTIME_GATE_EVIDENCE.md` |
| 4 — visual + CX + a11y | **all measured technical blockers RESOLVED; owner acceptance is the ONLY residual** | `19_VISUAL_CX_MATRIX.md`, `21_FOCUS_AND_CONTRAST.md` |
| E15 — two clean rounds | **RUN at `f5cdc7b867`. Mechanical verdict: NOT CLEAN — two flagged items, both adjudicated as legitimate, neither an open defect.** See §3 and `24_FINAL_ACCEPTANCE.md`/`20_E15_TWO_CLEAN_ROUNDS.md` for the full numbers and adjudications. | `20_E15_TWO_CLEAN_ROUNDS.md` |

**NOT `READY_FOR_CODEX_REVIEW`.** The only residual is the owner's visual
acceptance (rule #7, no agent may substitute for it). See `24_FINAL_ACCEPTANCE.md`.

Guards, all real and captured bare at `bcdda752b7`/`f5cdc7b867`:
`check-actions` **rc=0 (234·124·7·4)**, `check-action-coverage` rc=0,
`check-list-canon` rc=0, `check-ledger-csv` rc=0, `check-artefakt` rc=0,
`check-focus-canon` rc=0, `check-gestosc` rc=0 on 28 explicitly-passed files.

## 3. What this wave closed

Nineteen commits total (`edb38d6a29..bcdda752b7`: 16 across ten parallel
stream worktrees, plus the three integration-only commits in §1), integrated
onto this branch. Full per-row rulings live in
`16_OPEN_RISKS_AND_LIMITATIONS.csv` (38 rows); the short version:

- **RISK-35 (P2, contrast)** — all four originally-measured WCAG failures
  fixed with `c-*` tokens, **plus a fifth found and fixed** (Mind Map depth-3+
  badge, light theme). This is why Gate 4 no longer has a named technical
  blocker.
- **RISK-30 (P2)** — `ActionResult.confirmed` now reports truthfully for 6/6
  bus-dispatch sites plus the lane UI-closure branch; 58 other UI-closure
  sites degrade honestly to `confirmed:false` (still no chat correction —
  see §4).
- **RISK-26 (P3)** — de/es/ar/jp translated for this program's added keys.
  **478 EN / 494 PL keys added in total** (diffed against `9d17cac114`,
  re-confirmed at this HEAD) — corrected from the stale "210" figure; an
  earlier mid-wave count of 445/461 read lower only because it predated the
  last three locale-touching streams.
- **RISK-36 (P1, residual)** — AI add rows and framework apply now capped
  the same way CSV import already was, via a shared `applyRowAddCap`.
- **RISK-06 (P2)** — `RecordTemplateManager` reachable from a real toolbar
  menu, no longer a dead mount.
- **RISK-22 (P1)** — a confidentiality UI control ships in production
  (`IdeaWorkspaceTools.tsx`); ownership-only permission limitation stated
  plainly, not built around.
- **RISK-12 (P1) — CLOSED.** E09's financial case now has a full save path:
  migration, service with a real OCC (two-layer, both independently
  falsified — see `10_FINANCIAL_CASE_ACCEPTANCE.md` §7), routes, API client,
  and dialog wiring. 6/6 real-DB. **Its `check-actions.sh` residual is also
  now closed** (`a537a022e2`, see §1) — the dialog's save/save-and-close/retry
  are registered actions, and a latent bug surfaced in the same fix:
  `save()`/`load()` now return a truthful `Promise<boolean>`, so `confirmed`
  reflects an actual landed save, never "it didn't throw."
- **RISK-13/14/15/16/17/18** — formally A/B-verified (not merely assumed)
  as genuinely inherited pre-existing failures, three stale ledger rows
  closed in the same pass.
- **RISK-19, RISK-29** — reconciled against what is actually on disk
  (no code change needed — the CSV text had drifted from the evidence
  files). A **new, narrower** finding surfaced in the same pass: at exactly
  1280×800, the Idea Table's row-actions kebab is not in frame at rest in
  the true production wrapper, with no visible scroll hint (the container is
  genuinely scrollable — `TableWithPreviewLayout.tsx`'s inner div — just not
  discoverable without prior knowledge). At the time this section was
  written it was not yet triaged into its own risk row.
- **RISK-39 (P1) — NEW, filed and RESOLVED 2026-08-12 (S20-DOCS).** The
  finding named directly above got a code fix (S13-STICKY, `a18b625a78`:
  pin the row-actions column `sticky; right:0`), and that fix itself
  regressed the same boundary — a width-proportional overflow at 1280×800
  rest and a constant 8px sliver still covered at max scroll on every
  viewport. The owner rejected treating this as an acceptable trade-off and
  called it a regression to fix outright. S18-NOOVERLAP (`f86afc077f`)
  fixed both defects; real-Chromium measurement across all four required
  viewports is 0px overlap at 1280×800/1440×900 (no overflow at all) and
  0px overlap at `scrollLeft=max` on 720×450/200%-zoom. Falsified by
  sabotage. 19 evidence captures:
  `docs/qa/ideas-table-overlap-s18-2026-08-12/`. Full record:
  `16_OPEN_RISKS_AND_LIMITATIONS.csv` RISK-39,
  `19_VISUAL_CX_MATRIX.md`'s "RISK-39" section.
- **RISK-38 (P3, new)** — `Intl.PluralRules('jp')` silently resolves to
  `en-US` because `jp` is not a valid BCP47 subtag. Pre-existing, unrelated
  to this program's own changes, found while investigating RISK-26.
- **E15 coverage gap (`fe2b8b7a82`)** — `ContextMenuPortal.test.tsx`, present
  at baseline and deleted by this program's first commit along with the
  component it covered, has been restored as
  `canvasContextMenu.portal.test.tsx`, proving context menus still portal
  outside the canvas's transformed stacking context. The earlier "two clean
  rounds" (`c5b1b6e6b9`) reported 0 files losing tests and missed this,
  because that comparison only looked at files present on **both** sides — a
  file that vanishes entirely never entered it.
- **E15 two clean rounds — RUN at `f5cdc7b867`.** Full table in §4 below.

## 4. E15 — the final regression numbers (run at `f5cdc7b867`)

Scope proven from each run's own JSON, never from the typed command line,
`--retry=0` both rounds:

| | Baseline `9d17cac114` | Round 1 | Round 2 |
|---|---:|---:|---:|
| Test files | 155 | **212** | **212** |
| Colocated `src/**/__tests__` | 33 | **59** | **59** |
| Tests collected | 887 | **1291** | **1291** |
| Tests failed | 132 | **121** | **121** |
| `whiteboardContextMenu.keyboard.integration` | present, 4/4 | present, 4/4 | present, 4/4 |
| New failing tests vs baseline | — | **0** | **0** |
| Tests fixed vs baseline | — | **8** | **8** |
| Round 1 vs Round 2 differences | — | — | **0 — zero flakiness** |

Both rounds real exit code **1**, which is expected and not concealed: the
baseline itself carries 132 failures and neither side is green.

**Mechanical verdict: NOT CLEAN — stated plainly, not rounded up.** The
comparison script flags two items. Both were individually adjudicated with
evidence; neither is an open defect:

1. **`tests/components/MyWork/ContextMenuPortal.test.tsx`** — present at
   baseline, absent on the candidate. Deleted by `93ebc3aa20` (this program's
   FIRST commit) together with the component it covered, when the behaviour
   was re-homed into the shared `CanvasContextMenu` (`createPortal(menu,
   portalTarget ?? document.body)` — verified in code before concluding
   anything). The deletion of the *component* was legitimate; the deletion of
   the *assertion* was not. **Restored** as
   `tests/components/MyWork/canvasContextMenu.portal.test.tsx` (commit
   `fe2b8b7a82`): 3 assertions (menu outside the transformed subtree, no
   transformed ancestor anywhere on the portalled chain, menu still
   `position: fixed`), negative control (in-place render instead of portal
   turns it red on two independent assertions). The comparison still flags
   the old filename because it compares by path and cannot know about a
   deliberate re-home — **that is the detector working correctly**, not a
   defect. Also recorded: the earlier "two clean rounds" missed this
   entirely, because it only compared files present on both sides.
2. **Three tests gone from `tests/unit/mindmap/dp5HeuristicAiGating.test.tsx`.**
   Not lost — deliberately superseded by the E10 work, which moved whole-map
   AI generators out of the node context menu into the pane menu. The
   replacements assert both the new location (`pane_dependencies`) and the
   removal of the old (`"E10: ctx_ai_deepen no longer exists"`,
   `"E10: whole-map AI generators no longer render inside the node menu"`).
   The file gained tests overall.

## 5. Open items, honestly stated

**Two P1/P2-adjacent items carry forward with a real residual** (the rest of
the 39-row CSV / 42-row ledger is P2/P3 detail, mostly OPEN-and-documented
rather than blocking):

- **RISK-30 residual (P2)** — `confirmed:false` still posts no chat message,
  so 58 un-migrated actions can still read as an unchallenged success in
  Teresa's reply. Needs a UI-side correction path, not just an honest flag.
- **RISK-31 / RISK-36 residual (P1/P2 parts)** — Process Flow's node-cap
  performance and the Table's row-cap behaviour at N≥5,000 are **NOT
  MEASURED**, literally, by the owner's explicit decision: the measurement
  machine carried load averages of 84–832 from Microsoft Teams,
  WindowServer, `syspolicyd`, a recursive `xattr` sweep, and iCloud's
  `fileproviderd` — mostly non-Consultify load. Do not describe either as an
  improvement without a clean number.
- **RISK-24 (P2)** — full-repo schema convergence is broken on a fresh
  database by both runners; the 1012-table DB behind every runtime claim in
  this package is a **partial** schema. Two new concrete instances found
  earlier this wave: `role_change_audit_events` is created only by
  `initializeDatabase()` (conditional on `DB_MANAGED_SCHEMA`), never by a
  migration; and `organization_context_snapshots` doesn't exist at all —
  every idea create/update swallows the resulting SQL error via
  `.catch(warn)`.

Plus the `jp` plural-rules defect noted in §3 (RISK-38, pre-existing, filed
but not fixed). The other item that used to sit in this "un-triaged" bucket
— the production-shape kebab finding at 1280×800 — is no longer un-triaged:
it is `RISK-39`, filed and RESOLVED, S20-DOCS, 2026-08-12 (see §3 above).

**`check-actions.sh` is now rc=0 at 234/124/7/4** — the residual this file
previously reported (3 unregistered `FinancialCaseDialog` handlers) was
closed by `a537a022e2`. Nothing is deferred on that guard anymore.

## 6. `origin/demo` moved during this wave — and why the comparison base does not

`origin/demo` moved **`9d17cac114` → `f3e7df565e`** (2 commits, "Slack Command
Center hardening") from a *different* session while this program's streams
were running. The branch's true position is **62 ahead, 2 behind**.

The comparison base for every A/B claim and every "pre-existing vs
regression" verdict in this package **stays frozen at `9d17cac114`**.
Disjointness verified directly: the 2 `origin/demo` commits touch exactly 6
files (`AIOpsReportCron.ts`, `server/src/index.ts`, `auth.routes.ts`,
`feedbackDigest.ts`, `slackRouter.ts`, `slackRouter.test.ts`). The
intersection with this session's changed files is **0**, and with the whole
program's changed files (`edb38d6a29..bcdda752b7`, all streams) is also **0**.
A future merge to `demo` will need a genuine reconciliation of those 6 files —
but nothing in this evidence package needs to change because of the drift,
because nothing this program touched overlaps them.

## 7. Environment notes that will save you hours

- **Run `tsc` SERIALIZED.** This machine hosts several concurrent Claude
  sessions; parallel `tsc` runs have been CPU-starved to death before.
  Client then server, one at a time — this is exactly how the two
  cross-file type defects in §1 were caught.
- **`git stash` is SHARED across every worktree of this repo.** Never use it
  to compare against pristine code — use `git diff > /tmp/x.patch` and
  `git apply -R`.
- **A clean `git apply` can still be wrong.** After any merge, check
  `git status` for files your program has never committed to:
  `git log --oneline <base>..HEAD -- <file> | wc -l` = 0 means it is not
  yours.
- **A file that vanishes entirely can hide in a "0 files lost tests"
  comparison.** Compare file SETS (present-at-baseline-only,
  present-at-candidate-only), not just per-file test counts on the
  intersection — see §4 item 1.
- **Ephemeral Postgres.** Two local clusters are still alive as of this
  wave: `127.0.0.1:54329` (`ideas_qg03`) and `127.0.0.1:54331` (`ideas_e12`,
  **1012 tables** — up one from 1011 after the `idea_financial_cases`
  migration in RISK-12). Recreate with the recipe in
  `13_RUNTIME_GATE_EVIDENCE.md` §2 if they are gone. **Never demo**
  (trolley:28146), **never production** (centerbeam:37823), **never dev**
  (thomas:20221).
- **Real-DB tests need BOTH** `RUN_DB_TESTS=1` **and** `MOCK_DB=false`.
  `NODE_ENV=test` alone silently substitutes a DB mock and a suite goes
  green against nothing.
- **Guards resolve paths relative to cwd.** Run them from the worktree root.

## 8. Method — this is why the numbers here can be trusted

1. **Never trust an agent report. Re-run it.** This wave caught: a stale
   grep-count evidence line whose verdict still held; a CSV row's "only
   light/pl recaptured" claim that was already contradicted by files on
   disk; a locale-key count carried forward from an earlier, narrower
   measurement (445/461, superseded by 478/494 once the last three streams'
   keys were counted).
2. **Attack every green before accepting it.** RISK-12's OCC sabotage was
   deliberately two-staged: disabling only the fast-path check left the
   suite green (correctly — the SQL layer caught it), and only disabling
   *both* layers turned it red.
3. **A scope is not a scope until the run proves it — including "clean."**
   The two-clean-rounds numbers at `f5cdc7b867` are real (0 new failures, 8
   fixed, 0 round-to-round drift), but the mechanical verdict is still **NOT
   CLEAN** because two items were flagged. Both were individually
   adjudicated with evidence rather than the whole run being rounded up to
   "clean" because the numbers looked good.
4. **A file that disappears entirely can hide from a diff that only compares
   the intersection.** The previous "two clean rounds" pass reported 0 files
   lost and missed a real, since-restored coverage gap for exactly this
   reason.
5. **"Known pre-existing failure" is a claim, not a fact.** RISK-13/16/17/18
   are formally A/B-VERIFIED against `origin/demo@9d17cac114`, not merely
   carried forward as assumed.
6. **Workers being locally green does not mean the integrated tree
   type-checks.** Two cross-file type defects (§1) were invisible to every
   stream by construction — they only run targeted vitest and esbuild,
   neither of which checks types across file boundaries — and only surfaced
   under a full, serialized `tsc` on the integrated tree.
7. **Never claim a gate is awaiting acceptance while your own reports
   contain open P1s or a visible collision.** That rule still holds.
8. **A sabotage that breaks compilation is not evidence of anything (S20-DOCS,
   RISK-39).** The first attempt at re-proving the Idea Table overlap
   regression used a blunt regex that also turned a variable declaration
   into a syntax error, so the build failed and every viewport "failed" for
   the wrong reason. A red result is not evidence until you know *why* it is
   red — confirm the sabotaged code still compiles (e.g. an `esbuild` syntax
   check) before trusting a red.
9. **A test that derives its own strictness from the state it is guarding
   can be disarmed by the very defect it exists to catch (S20-DOCS,
   RISK-39).** The first version of the overlap-geometry contract decided
   whether a viewport had to be overlap-free at rest by checking the
   *measured* `scrollMax` at that instant, instead of a fixed per-viewport
   expectation. A regression that reintroduces overflow also reintroduces a
   nonzero `scrollMax`, which silently reclassified the acceptance viewport
   into an exception meant for a different, narrower one — and the test
   PASSED against sabotaged code. Fixed by hard-coding the expectation per
   viewport instead of deriving it from runtime state.

## 9. Document map

| File | What it is |
|---|---|
| `RESUME_HANDOFF.md` | this file — start here |
| `24_FINAL_ACCEPTANCE.md` | the Codex handoff package (numbered per doc-11 §9, filed as 24_ not 17_ — see that file for why) |
| `22_CODEX_REVIEW_REPORT.md` | the review package for Codex |
| `00_PROGRAM_STATUS_AND_VERSION.md` | gate board + dated corrections (read the tail first) |
| `03_CODEX_QUALITY_BACKLOG.md` | QG-01…QG-06 with per-item evidence |
| `13_RUNTIME_GATE_EVIDENCE.md` | migrations, E12 runtime, 9/9 persistence chains |
| `16_OPEN_RISKS_AND_LIMITATIONS.csv` | **39 rows** — the honest ledger, statuses reconciled to the code at this HEAD (S20-DOCS added `RISK-39`) |
| `19_VISUAL_CX_MATRIX.md` | visual matrix, the 24-cell re-verification, the production-shape kebab finding, and (new) the `RISK-39` overlap-fix section |
| `20_E15_TWO_CLEAN_ROUNDS.md` | the retraction, the corrected `c5b1b6e6b9` re-run (historical), and the final `f5cdc7b867` run with its NOT CLEAN adjudications |
| `21_FOCUS_AND_CONTRAST.md` | 40 focus captures, 87+ contrast measurements, the depth-3 closure |
| `02_EXECUTION_LEDGER.csv` | 42 rows × 20 columns, guard-validated |
| `screenshots/` | 100+ captures; `g4v3__*`/`g4v4__*` are the newest Table sets |
| `docs/qa/ideas-table-overlap-s18-2026-08-12/` | 19 captures for the `RISK-39` Updated/actions overlap fix |

## 10. First commands to resume

```bash
cd "/Users/piotrwisniewski/.codex/worktrees/ideas-streams/s6-e09" && git log --oneline -3 && git status --short && git rev-list --left-right --count origin/demo...HEAD
```

```bash
cd "/Users/piotrwisniewski/.codex/worktrees/ideas-streams/s6-e09" && for g in check-actions check-action-coverage check-list-canon check-ledger-csv check-artefakt check-focus-canon; do bash scripts/$g.sh >/dev/null 2>&1; echo "$g rc=$?"; done
```

Expected: all `rc=0`.

Then read: this file → `24_FINAL_ACCEPTANCE.md` → `22_CODEX_REVIEW_REPORT.md` →
`16_OPEN_RISKS_AND_LIMITATIONS.csv` → `19_VISUAL_CX_MATRIX.md`'s
PRODUCTION-SHAPE section and, immediately after it, the "RISK-39" section
that closes the finding PRODUCTION-SHAPE raised. **The 1280×800
kebab/Updated-column finding is CLOSED as of 2026-08-12 (S20-DOCS,
`f86afc077f`, RISK-39) — it is no longer your first open question.** Your
first open question is now whichever item heads the current residual list
in `24_FINAL_ACCEPTANCE.md` §9 (ten items as of this pass, item 7 marked
closed there).
