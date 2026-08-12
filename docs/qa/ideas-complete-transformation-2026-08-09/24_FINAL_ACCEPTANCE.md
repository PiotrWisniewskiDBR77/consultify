# 24 — Final acceptance (Codex handoff package)

**Numbering note:** `docs/qa/ideas-manual-audit-2026-08-09/11_..._PROTOCOL.md` §9
names this file `17_FINAL_ACCEPTANCE.md`. In this package, `17_` is already
taken by `17_PERFORMANCE_MEASUREMENT.md`, so this file is `24_` instead — the
next free number, not a sign a document is missing. Every §9-required item
below is present under its natural section.

**Owner correction, 2026-08-12 (S14-EPICS, worktree `ideas-streams/s2-locale`,
branch `codex/ideas-s14-epics`, no code changes):** the owner explicitly
rejected this document's prior claim that "the owner's visual acceptance is
the only remaining blocker." §3 (E00–E15 closure table), §5, §7, §9 and §11
below are rewritten from an independent epic-by-epic investigation to
establish the real residual list — it is longer than one item. Sections 1,
2, 4, 6, 8, 10 are otherwise unchanged from the prior candidate identity
(`bcdda752b7`/`f5cdc7b867`) and are marked inline wherever this session added
or corrected something.

**Documentation reconciliation, 2026-08-12 (S20-DOCS, worktree
`ideas-streams/s2-locale`, branch `codex/ideas-s20-docs`, no code changes):**
code moved further after S14-EPICS wrote the section above — three more
commits landed on top of `f5cdc7b867`: `a18b625a78` (S13-STICKY, pinned the
row-actions kebab to the sticky right edge, fixing the reachability half of
what §3's E07 row below called an open defect, but regressing the
Updated/actions column boundary in the process), `f86afc077f` (S18-NOOVERLAP,
closed that regression — two independent defects, both real-Chromium
measured), and `a11441233a` (fixed a self-disarming loophole in the geometry
test itself). **New code-final SHA: `f86afc077f`** (the last commit touching
`src/`; `a11441233a` and the evidence-capture commit `6b28161bc4` that follow
it touch only `tests/` and PNGs). `f5cdc7b867` stays on record below exactly
where the epic table cites it, because that is genuinely where E15's numbers
were measured — swapping the string without re-running E15 would assert a
false thing at a new SHA. The specific item this closes: §3's E07 row and
§9 item 7, both updated in place below with the evidence; every other
residual in §3/§5/§7/§9/§11 is untouched. Full record: `16_OPEN_RISKS_AND_LIMITATIONS.csv`
RISK-39.

**This continuation, 2026-08-12 (worktree
`/Users/piotrwisniewski/.codex/worktrees/ideas-transform/consultify`, branch
`codex/ideas-transformation-20260809` — the canonical integration branch
itself, code changes made): four defects fixed at candidate level (D1/D2/D3/D4,
new code-final SHA `914759d4cb`), documented in full in §12 below. §3's E04
row and §9 item 8 (RISK-24) are updated in place with pointers to §12. This
does not change the recommendation — see §12's closing note.**

---

## 1. Candidate identity, runtime and worktree

| | |
|---|---|
| Candidate SHA (documentation, HEAD) | **`bcdda752b7`** |
| Candidate SHA (code final — E15 measured here) | **`f5cdc7b867`** — only documentation commits follow it |
| Branch | `codex/ideas-transformation-20260809` (canonical integration branch; this pass ran from the `codex/ideas-s11-docs` satellite, since re-pointed at this HEAD) |
| Worktree (this reconciliation pass) | `/Users/piotrwisniewski/.codex/worktrees/ideas-streams/s6-e09` |
| Prior handoff SHA (10 parallel streams forked here) | `edb38d6a29` |
| Base | `origin/demo` — **62 commits ahead, 2 behind** (drift explained in §2) |
| Working tree | clean |
| Pushed / merged / deployed | **NO** — never pushed, no merge to `demo`, no deploy |
| Runtime URL / badge | **N/A — none exists.** This program has never been deployed; there is no staging URL or CI badge to cite. All evidence is from isolated local ephemeral Postgres plus vitest/Playwright runs inside the worktree. |

## 2. Baseline and exact changed-file scope

- **Frozen comparison base for every A/B claim in this package:** `origin/demo` @
  `9d17cac114`.
- `origin/demo`'s actual current tip has moved to `f3e7df565e` (2 commits,
  "Slack Command Center hardening", a *different* session, while this
  program's streams were running). Disjointness with this program verified
  directly: those 2 commits touch exactly 6 files
  (`AIOpsReportCron.ts`, `server/src/index.ts`, `auth.routes.ts`,
  `feedbackDigest.ts`, `slackRouter.ts`, `slackRouter.test.ts`); the
  intersection with every file this program has ever changed is **0**. The
  base stays frozen at `9d17cac114` because moving it would invalidate every
  A/B verdict this package makes — a future merge to `demo` needs its own
  reconciliation of those 6 files, unrelated to anything below.
- **This wave's exact scope:** `edb38d6a29..f5cdc7b867` — 16 commits across
  ten parallel stream worktrees, plus 3 further commits landed directly on
  the integration branch: `fe2b8b7a82` (restored E15-flagged test coverage),
  `a537a022e2` (routed E09's financial-case commands through the action
  registry, closing a `check-actions.sh` gate failure), `f5cdc7b867` (fixed a
  cross-file type error found only by a full `tsc` on the integrated tree).
  This documentation-reconciliation pass itself (through `bcdda752b7`)
  touched only `docs/qa/ideas-complete-transformation-2026-08-09/*` — no
  `src/`, `server/src/`, `tests/`, or `dev-render/` files.

## 3. E00–E15 closure table

**Rewritten by an independent investigation session (2026-08-12, S14-EPICS,
worktree `s2-locale`/branch `codex/ideas-s14-epics`, no code changes — see
final report).** The prior version of this section carried a single named
residual — "the owner's visual acceptance" — as the only thing separating
this package from `READY_FOR_CODEX_REVIEW`. **The owner rejected that
framing on the record**, and this rewrite establishes why it does not
survive scrutiny: fifteen of sixteen epics (every epic except E00) carry a
substantive, *technical* residual that has nothing to do with anyone's eyes
on a screenshot —
isolated-local-DB-only persistence, default-OFF feature flags, epics with
zero dedicated acceptance evidence at all, an idea-workspace-scoped (not
full-repo) regression run, and one confirmed, still-open UI defect. None of
that is new invention — nearly every fact below is already written
somewhere in `05`–`14`, `16`, `19`, `21`, `22` or `00_PROGRAM_STATUS...` —
but the top-level table and the final recommendation had stopped repeating
it by the time this section was last written, and repetition is what a
closure table is for.

Verdicts use exactly four words, per the protocol: **DONE**, **PARTIAL**
(exactly what is missing, stated), **NOT DONE**, or **NOT VERIFIED**
(nothing establishable was found). Four code-states are distinguished
per doc-11 §9: `CODE EXISTS` / `MOUNTED IN A REAL CONSUMER` (a production
mount — `MyWorkHub.tsx` → `IdeaMapWorkspace.tsx`/`MyIdeasListContent.tsx`,
never `dev-render/` alone) / `EXECUTED AT RUNTIME` / `PERSISTED AND READ
BACK`. This session independently re-verified the production mount chain by
grep: `MyWorkHub.tsx:150,4084` imports and renders `MyIdeasListContent` (the
Ideas list) and separately, at `MyWorkHub.tsx:3891` (`renderDocumentContent()`,
`case 'idea'`), renders `IdeaMapWorkspace` directly for whichever Idea the
user opened from that list — `IdeaMapWorkspace.tsx:4271/4361/4389/4441`
then mounts `IdeaRecommendationMap`/`IdeaTableTool`/`IdeaProcessFlowTool`/
`IdeaWhiteboardTool` respectively. That chain is the one this table treats
as "real consumer"; `dev-render/screens/*` compositions are cited only where
explicitly labelled as harness evidence.

| Epic | Verdict | What is actually missing (if PARTIAL/NOT DONE/NOT VERIFIED) |
|---|---|---|
| E00 — Candidate control and ledger | **DONE**, one minor scope gap | Runtime/backend/DB/session identity and a version badge (part of E00's *scope*, not stated verbatim in its DoD) were never captured — flagged by the program's own E00 checklist as deferred and never later done. |
| E01 — One Idea data model and integrity | **NOT VERIFIED** | Literally no epic-level evidence exists anywhere in this package — no acceptance doc, no duplication-through-representation-cycle test, no two-users-different-views proof, no destructive-import preview/restore check. |
| E02 — Action Registry | **PARTIAL** | Structural/machine-check DoD is satisfied (234 actions, `check-actions.sh` R1–R11); real-browser + real-Teresa (LLM) runtime invocation of any registered action has **never** happened in this program's history; `check-action-coverage.sh`'s repo-wide ratchet still carries 188 unregistered call sites in 89 files outside the Idea Workspace surface this program touched. |
| E03 — Shell, navigation and ownership | **PARTIAL** | Implemented and mounted (chapter 13 N0–N8); its own source doc is headed "implemented candidate — acceptance evidence pending" and stays that way — no deep-link-survives-refresh, URL/tab/tool-agreement, or size/zoom essential-control check was ever run against a live route. |
| E04 — Mind Map | **PARTIAL** | Registry-wired (72 actions). The DoD scenario itself — 18+ node scene from zero, 20 mixed rapid sibling ops never creating two editors, two cross-links + comments/evidence + AI proposal surviving persistence, first-level PPM fitting 1280×800 — has never run against any SHA in this program. One visual-only fix landed (depth-3 badge contrast, RISK-35) — does not touch the functional DoD. **This continuation (2026-08-12, candidate `914759d4cb`, not owner/runtime-accepted, BLOCKED / EVIDENCE_MISSING for runtime odbiór):** closed a DATA-LOSS-class defect adjacent to this epic — a failed `GET /map` was silently read as "new idea" and the resulting 6-node starter template was persisted back over the real server map (D2, `499b4b98c2`, 3/3 test + sabotage 2/3 red); and a save-state indicator that could pin "Changes queued" forever on a stale local draft, never auto-retrying a genuinely queued one (D3, `914759d4cb`, 2/2 test + sabotage 2/2 red, plus a live reproduction of the pre-fix bug). Neither touches the DoD scenario above — the scenario itself is still un-run. |
| E05 — Whiteboard | **PARTIAL** | Registry-wired (55 actions); real object clipboard (WB-CLIPBOARD-01) is now genuinely fixed AND its own ledger row reconciled (`REPAIRED_RETESTED`, 3/3 unit test). The DoD scenario (12 mixed inserts with no complete overlap, three clusters/four links/freehand/group/lock/layer persistence, AI coaching on default labels, connector PPM + real copy/paste as one user flow) has never run end-to-end. |
| E06 — Process Flow | **PARTIAL** | Registry-wired (43 actions); the named lane-delete silent-no-op defect is fixed for the human-visible path (a toast now refuses). Residual, not closed: Teresa's acknowledgement of a refused lane action can still read as an unchallenged success (RISK-30 — 58 UI-closure sites, including some lane actions, still degrade to `confirmed:false` with no chat correction). The DoD scenario (complaint scene with lanes/Yes-No/correction loop, one creation path, immediate lane naming, editable/deletable edges, initial `Not validated`, Fit 25–300%, context-correct Insert/Split) has never run. Node-cap **performance is NOT MEASURED** — see the ACCEPTED_DEFERMENT note under §5/§7 (RISK-31): the owner explicitly chose not to force a number out of a measurement machine that was carrying a 84–832 load average from Teams/WindowServer/`syspolicyd`/an `xattr` sweep/`fileproviderd`; that deferment covers the *performance number only*, not the rest of this epic's DoD. |
| E07 — Table P15 | **PARTIAL** | Registry-wired (60 actions, the largest per-tool count); `RecordTemplateManager`'s dead-mount defect is fixed and re-verified (reachable from `TableToolbar`'s Tools menu, accessible-name test with sabotage/restore). **Kebab-reachability defect at 1280×800 — CLOSED this pass (S20-DOCS, `f86afc077f`), see RISK-39.** The fix (S13-STICKY, `a18b625a78`) that pinned the row-actions kebab to a sticky right edge to close the ~74px-past-the-edge finding this row previously described introduced its own regression at the same boundary — a width-proportional overflow at 1280×800 rest (Defect A) and a constant 8px sliver still covered at max scroll on every viewport (Defect B). Both are now fixed: real-Chromium measurement (`tests/e2e/ideas-table-overlap-geometry.spec.ts`, 4/4) shows 0px overlap and no horizontal overflow at all at 1280×800 and 1440×900, and 0px overlap at `scrollLeft=max` at 720×450 and 200%-zoom reflow (720×450 still shows an arithmetically-unavoidable 435px overlap at rest — 794px of fixed non-title columns against a 720px viewport — explicitly owner-accepted as the narrow-viewport exception, not a residual defect). Falsified by sabotage (reverting the fix reproduces the overlap, red only at the acceptance viewport). 19 evidence captures: `docs/qa/ideas-table-overlap-s18-2026-08-12/`. The DoD scenario (11-row portfolio persistence, field-wizard interaction budget, CSV append/update/replace + recovery) has never run. Row-cap performance at N≥5,000/10,000 is **NOT MEASURED** — same owner ACCEPTED_DEFERMENT as E06 (RISK-36's performance dimension only). |
| E08 — Business case and decision governance | **PARTIAL** | Model/service/routes/panel + 9-dimension scoring + 4-outcome decision log exist and compile; ships behind `ff_ideaBusinessCase`, **default OFF** — confirmed by reading the flag file's own doc comment pattern (same convention as E09's flag, checked directly). Migrations applied and persistence-proven **on isolated local ephemeral Postgres only** (`127.0.0.1:5433x`) — never demo, dev or production. The DoD scenario (stage gates enforcing completeness, decision-summary traceability, score weight/override exposure, distinct Approve/Reject/Return/Defer persistence, reopen-versioning) has never run against a real backend a real user can reach. |
| E09 — Financial case | **PARTIAL** | Confirmed this session by direct read: the calculation engine is genuinely wired (`FinancialCaseView.tsx:32,76` imports and defaults to `computeIdeaFinancialCase` from `./engineAdapter`, not a stub), and the save path is real (`server/src/services/ideaFinancialCaseService.ts`, `GET|PUT /api/idea-financial-case/:ideaId`, SQL compare-and-swap OCC, 6/6 real-DB pass with a two-stage falsifiability sabotage). Ships behind `ff_ideaFinancialCase` — confirmed default OFF by reading `src/utils/ideaFinancialCaseFlag.ts` directly (query → localStorage → env → **default false**). Persistence proven **isolated local DB only**, never demo/dev/prod. Residuals the program's own doc admits: concurrency proven by a *sequential* stale-version test, not two genuinely simultaneous writers; `FinancialCaseSummaryPanel`/`FinancialConversionActions` render English strings ("No drivers yet", "Stale — recompute needed", "Convert to Financial Model") inside the Polish UI, not fixed. The full compute→save→reopen→mutate→stale→recompute→convert/readback chain has not run as one scenario. |
| E10 — AI and Teresa | **NOT DONE** | Every one of 234 registry actions carries a `teresa: {}` block (R9, structural parity) — but no session in this program's history has Teresa (a real chat/LLM call) actually invoke a registered action and had the result observed end-to-end. "No silent AI mutation" is *partly* addressed (RISK-30: 6/6 bus-dispatch sites plus the lane UI-closure branch now report a truthful `confirmed`), but the fix's own residual undercuts the DoD directly: 58 other UI-closure sites still degrade to `confirmed:false`, and `UnifiedChatPanel.tsx` only posts a correction when `result.message` is set — so a silent `confirmed:false` leaves the model's already-streamed "done" reply on screen, unchallenged. "Unsupported claims marked" and "every request terminates in proposal/result/error/cancel" have not been exercised against a live model call anywhere in this program. |
| E11 — Conversion, import, export and templates | **PARTIAL** | `ConversionPreviewDialog` is genuinely mounted in `IdeaMapWorkspace.tsx` (the program's own re-check found it at two render sites, not a dangling import); the mandatory-preview gate and the Mind Map single-node-Convert-no-longer-cascades fix are real. The `mapping_version` migration is applied and read-back-proven **isolated local DB only**. No end-to-end conversion (Idea → Initiative/Task/Decision/Report/Presentation) has ever been observed writing a real backlink and being read back on any real database. "Exports are real/openable files" and "import recovery passes" have never been runtime-tested. |
| E12 — Collaboration, security and resilience | **PARTIAL — cannot be closed by visual acceptance at all, per explicit owner instruction; kept PARTIAL regardless of what follows.** | Confirmed this session by direct read, independent of the program's own claim: the confidentiality write path is real (`server/src/routes/my-work.routes.ts:3217-3228` validates and sets the column on `PUT /my-ideas/:id`, both GET routes feature-detect it back) and the UI control genuinely ships in the production mount (`src/components/MyWork/IdeaWorkspaceTools.tsx` Metadata group, wired from `IdeaMapWorkspace.tsx:367-377,3479-3482` `useIdeaConfidentialityGate`, itself mounted by `MyWorkHub.tsx` as described above — not a dev-render-only composition). Stated plainly, and not something owner acceptance can fix: the permission model is **ownership-only** (`WHERE id = ? AND user_id = ? AND organization_id = ?`) — there is no "who may lower a security classification" convention anywhere in this codebase, so `restricted` protects an Idea from *others*, not from its own owner downgrading it. This session did not independently re-verify reconnect/dedup/offline-retry behavior beyond what the program's own mock-based E12 suite already claims. |
| E13 — Visual system and CX | **PARTIAL — NOT "only owner acceptance remains".** | The contrast, focus-visible, and 200%-reflow/rail-collision fixes are real and were falsified before being accepted (five WCAG failures raised to their floors with `c-*` tokens; 40 `:focus-visible` captures; a real rail-overlap bug found and fixed, re-verified in 2 independent spot-checks). But: **(a)** ~~the E07 kebab-at-1280×800 defect above is a genuine, currently-open visual/reachability defect on one of doc-11 §6's three mandatory acceptance viewports, found this wave and not yet triaged into its own numbered risk row~~ — **CLOSED this pass (S20-DOCS, `f86afc077f`)**, see the E07 row above and `16_OPEN_RISKS_AND_LIMITATIONS.csv` RISK-39; no longer a residual on this row; **(b)** the doc-11 §6 visual/CX matrix that ran was a *targeted* matrix of previously-known-defect cells (24 checksummed cells across 2 tools), not the full Pass A/B rebuild-the-scene-from-zero walkthrough across all four tools at all three viewports the protocol actually specifies; **(c)** the owner's visual acceptance itself (rule #7) has genuinely not been sought and no agent may substitute for it. (b) and (c) are real, independent residuals, and (c) alone would not justify `NOT_READY` on its own if (b) were closed, which it is not — this row stays PARTIAL on (b) and (c). |
| E14 — Accessibility, locale, performance and observability | **NOT DONE** | Real fixes landed and are falsified: 2 keyboard P0s (global Tab hijack; Shift+Tab spawning a node), 74 modal overlays given dialog semantics, `:focus-visible` on canvas nodes, 478 EN / 494 PL locale keys added and back-filled into de/es/ar/jp (**corrected this session by direct diff against `origin/demo@9d17cac114`** — the program's own risk-CSV text still carries a stale 445/461 figure in one place even though its own later correction and this package's own §7 already say 478/494; see the correction note under §5). Genuinely unmet: 6+ hardcoded-English strings remain unfixed and named (`MindMap3DView.tsx:178`, `WhiteboardNodeReactions.tsx:111`, plural-unsafe artifact-count strings in `TextBlockNode.tsx`/`StickyNoteNode.tsx`, plus E09's `FinancialCaseSummaryPanel`/`FinancialConversionActions` above); the pseudo-locale/error-copy matrix required by doc-11 §3.8/§6 has never run anywhere in this program (no artifact under that name exists); `Intl.PluralRules('jp')` silently resolves to `en-US` (confirmed live this session: `node -e "console.log(new Intl.PluralRules('jp').resolvedOptions())"` → `{locale:'en-US',...}`) — filed as RISK-38, not fixed; none of the three canvas tools has real viewport virtualization by default (Table's fix is a hard row cap, not virtualization; Whiteboard/Process Flow's `<ReactFlow>` instances pass no `onlyRenderVisibleElements`; Mind Map has the mechanism but its flag defaults OFF) — this is a structural gap, not merely an unmeasured one; actual p50/p95 SLOs were never measured for **any** of the four tools (RISK-31/RISK-36's owner ACCEPTED_DEFERMENT covers exactly two specific numbers — Process Flow node-cap speed and Table row-cap at N≥5,000 — not the general E14 SLO requirement, which was never attempted at all, deferred or otherwise); "no sensitive canvas content in analytics" has no evidence of any kind in this package — telemetry/content-safety is **NOT VERIFIED**, not merely unmentioned. |
| E15 — Final regression and evidence closure | **NOT DONE** | The mechanical run (212 files / 1291 tests at `f5cdc7b867`) is honestly reported as **NOT CLEAN** by the program's own adjudication — 2 flagged items, both individually explained with evidence and neither an open product defect (§4). That honesty is real progress and is preserved below. But the epic's DoD is not met on two further, independent grounds this session confirmed directly: **(1) scope.** The command that produced those numbers (`20_E15_TWO_CLEAN_ROUNDS.md` §1) is `npx vitest run tests/components/MyWork tests/unit/mindmap "src/components/MyWork/**/__tests__/**"` — the Idea Workspace surface only. No "full automation/manual rerun" (the epic's own Scope line) has ever executed in this program's history; `00_PROGRAM_STATUS_AND_VERSION.md`'s own "Still open" list already says so ("No full-repo test run"). **(2) unaccepted P2/P3.** The DoD requires "P2/P3 all implemented or explicitly owner-accepted as named limitation." Of the 39-row risk CSV, 7–8 rows are genuinely OPEN with no owner sign-off of any kind: RISK-13/15/16/17/18 (pre-existing test-failure classes, confirmed but not fixed), RISK-24 (full-repo schema convergence broken on a fresh DB by both runners — the 1012-table isolated DB behind every persistence claim in this package is itself a partial schema), RISK-30's residual, and RISK-38. Only RISK-31/RISK-36's *performance measurement* now carries an explicit owner ACCEPTED_DEFERMENT (§5) — every other open row does not. The E07 kebab/Updated-column finding is now `RISK-39`, RESOLVED (S20-DOCS, `f86afc077f`) — no longer open, does not add to this count. |

## 4. E15 — final regression numbers (run at `f5cdc7b867`)

**Scope note added 2026-08-12 (S14-EPICS):** these numbers are real and the
adjudications below hold, but the scope is the Idea Workspace test surface
(`tests/components/MyWork tests/unit/mindmap "src/components/MyWork/**/__tests__/**"`),
**not a full-repo run**. Doc-11 §4 E15's own Scope line reads "full
automation/manual rerun" — that has never executed in this program's
history. Treat this section as the Idea-Workspace regression result, not as
"the program's tests pass."

Scope proven from each run's own JSON, never from the typed command line;
both rounds `--retry=0`.

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

Both rounds real exit code **1** — expected and not concealed: the baseline
itself carries 132 failures and neither side is green.

**Mechanical verdict: NOT CLEAN — reported as such, not rounded up to
"clean."** Two items flagged, both individually adjudicated with evidence,
neither an open product defect:

1. **`tests/components/MyWork/ContextMenuPortal.test.tsx`** — present at
   baseline, absent on the candidate. Deleted by `93ebc3aa20` (this program's
   FIRST commit) together with the `ContextMenuPortal` component it covered;
   the behaviour was re-homed into the shared `CanvasContextMenu`, which
   portals via `createPortal(menu, portalTarget ?? document.body)` — verified
   in code, not assumed. The component deletion was legitimate; the
   **assertion** going with it was not — from that commit until this wave,
   nothing proved context menus still escape the canvas's transformed
   stacking context (correct-by-accident is indistinguishable from correct).
   **Restored** as `tests/components/MyWork/canvasContextMenu.portal.test.tsx`
   (commit `fe2b8b7a82`): 3 assertions (menu outside the transformed subtree;
   no transformed ancestor anywhere on the portalled chain; menu still
   `position: fixed`). Negative control: replacing the portal with an
   in-place render turns it red on two independent assertions. The
   comparison still flags the old filename because it compares by path and
   cannot know about a deliberate re-home — **that is the detector working
   correctly, not a defect.** Also recorded: the earlier "two clean rounds"
   (`c5b1b6e6b9`) reported 0 files losing tests and did not catch this,
   because that comparison only looked at files present on **both** sides —
   a file that vanishes entirely never entered it.
2. **Three tests gone from `tests/unit/mindmap/dp5HeuristicAiGating.test.tsx`.**
   Not lost — deliberately superseded by the E10 work, which moved whole-map
   AI generators out of the node context menu into the pane menu. The
   replacements assert both the new location (`pane_dependencies`) and the
   removal of the old (`"E10: ctx_ai_deepen no longer exists"`,
   `"E10: whole-map AI generators no longer render inside the node menu"`).
   The file gained tests overall.

## 5. P0–P3 totals and states

Computed directly from `16_OPEN_RISKS_AND_LIMITATIONS.csv` (39 rows as of this
pass — S20-DOCS added `RISK-39`, resolved, for the S13-STICKY/S18-NOOVERLAP
regression-and-fix cycle closed this session, see §3's E07 row — real CSV
parser, not text search):

| Severity | Total rows | RESOLVED / CLOSED | PARTIAL | OPEN |
|---|---|---|---|---|
| P0 | 3 | **3** | 0 | 0 |
| P1 | 17 | 13 | 4 | 0 |
| P2 | 11 | 7 | 1 | 3 |
| P3 | 8 | 3 | 0 | 5 |
| **Total** | **39** | **26** | **5** | **8** |

**Zero open P0. Zero open P1** (the 4 P1 PARTIAL rows are RISK-19*, RISK-22,
RISK-31, RISK-36 — each has a real, named, non-blocking residual, not an
unaddressed core defect; `RISK-39` is P1 and RESOLVED, not one of the four).
All 8 fully-OPEN rows are P2/P3, individually itemized in the CSV with their
own evidence. Independently recounted this session directly from the CSV
with a real parser (`csv.DictReader`, not text search) — the P0 (3/3
resolved) and P1 (13 resolved/4 partial/0 open, post-`RISK-39`) rows match
exactly; the P2 partial/open split depends on how `RISK-23` ("MITIGATED
in the test... but the same trap applies to every other column with a
non-null DEFAULT") is categorized — the CSV counts it OPEN, which is a
defensible reading (the underlying trap is unresolved), not an error.

**Four constraints on these four PARTIAL/pre-owner-decision rows, stated
explicitly because the closure table above depends on them:**

- **RISK-19** (E13, visual/CX matrix) may be closed **only** by the owner's
  visual acceptance under rule #7. It is graded PARTIAL here — not
  "effectively closed" — and stays that way until that acceptance happens.
  No agent may substitute for it, and this document does not attempt to.
- **RISK-22** (E12, confidentiality write path/UI) and **RISK-31/RISK-36**
  (E06/E07, node-cap and row-cap performance) **cannot be closed by visual
  acceptance at all** — they are not visual findings. RISK-22 stays PARTIAL
  because of the ownership-only permission-model gap named in §3's E12 row,
  which no screenshot review touches.
- **RISK-31 and RISK-36's performance sub-claim carries an explicit owner
  `ACCEPTED_DEFERMENT`, recorded here as evidence, not a code state:** the
  owner reviewed the post-fix benchmark attempts and chose, on the record,
  to leave both node-cap/row-cap performance numbers as literally **NOT
  MEASURED** — the measurement machine carried load averages of 84–832
  throughout the session, dominated by Microsoft Teams, WindowServer,
  `syspolicyd`, a recursive `xattr` sweep, and iCloud's `fileproviderd`, so
  any number produced would have been noise rather than signal about the
  product. **This deferment covers the performance dimension of RISK-31/
  RISK-36 only** — the guardrails themselves (500-node/500-row hard caps,
  visible refusal copy in both locales) are proven and unaffected by it, and
  every other open item on those two rows (E06/E07's DoD scenarios never run,
  Table's row cap never re-tested at N≥5,000/10,000, no virtualization) is
  still genuinely open, not deferred.
- **RISK-38** (`jp` plural-rules resolving to `en-US`) is pre-existing,
  confirmed live again this session, filed, out of this program's stated
  scope, and simply OPEN — no deferment claimed for it.

*RISK-19 is technically RESOLVED-in-substance for its *technical* content
(see its CSV row) but graded PARTIAL here because the one thing that closes
it — owner acceptance — has not happened; kept exactly as the integrator
wrote it rather than silently upgraded.

## 6. Four scenes, business case, financial case, golden journey

- **Four scenes (Mind Map / Whiteboard / Process Flow / Table):** each WIRED
  TO REGISTRY per §3; none has an independently rerun full DoD scene-level
  acceptance this wave. See `05`–`08_*_ACCEPTANCE.md`.
- **Business case (E08):** PARTIAL, persistence proven on isolated DB only —
  see §3 and `09_BUSINESS_CASE_ACCEPTANCE.md`.
- **Financial case (E09):** save path built and proven this wave, 6/6 real-DB,
  two-stage OCC sabotage, and now registry-traced with a truthful
  `Promise<boolean>` — see `10_FINANCIAL_CASE_ACCEPTANCE.md` §6–§7.
- **Golden journey (create → develop → convert, cross-tool):** **NOT
  VERIFIED** as a single end-to-end run at this SHA. No document in this
  package claims a full golden-journey execution.

## 7. Automated / type-check / migration / performance / a11y results

| Area | Result | Evidence |
|---|---|---|
| Type-check (client + server) | **PASS at `f5cdc7b867`** — client `tsc` exit 0 / 0 errors, server `tsc` exit 0 / 0 errors, both serialized. Two cross-file type defects found and fixed at integration (invisible to individual streams, which run targeted vitest + esbuild only, neither checking cross-file types). | commit `f5cdc7b867` |
| Migrations | 6 additive migrations exist and are applied on the isolated local DB (`127.0.0.1:54331/ideas_e12`, **1012 tables**): maturity gates, business case, conversion mapping-version, confidentiality (all pre-wave), plus `idea_financial_cases` (this wave) | `13_RUNTIME_GATE_EVIDENCE.md` |
| E15 two clean rounds | **RUN at `f5cdc7b867`.** 212 files / 1291 tests, 0 new failures, 8 fixed, 0 round-to-round drift. **Mechanical verdict NOT CLEAN** — 2 flagged items, both adjudicated as legitimate (see §4), neither an open defect. | `20_E15_TWO_CLEAN_ROUNDS.md`, §4 above |
| Performance | **NOT MEASURED**, literally. Two specific items (Process Flow node-cap speed, Table row-cap at N≥5,000) carry an explicit owner `ACCEPTED_DEFERMENT` for that measurement given the machine's non-Consultify load (84–832 load average from Teams/WindowServer/syspolicyd/xattr sweep/fileproviderd — see §5). **The broader E14 SLO requirement (actual p50/p95 for all four tools) was never attempted at all, deferred or otherwise**, and none of the three canvas tools ships default-on viewport virtualization (Mind Map has the mechanism, flag OFF; Whiteboard/Process Flow have none; Table substitutes a hard row cap). | `17_PERFORMANCE_MEASUREMENT.md`, `14_A11Y_LOCALE_PERF_REPORT.md` (E14-PERF-01/02/03), RISK-31/RISK-36 in the CSV |
| Accessibility (contrast + focus) | **RESOLVED** — 5/5 measured WCAG contrast failures fixed (RISK-35); focus-visible rings present on canvas nodes; 2 P0 keyboard defects fixed pre-wave | `21_FOCUS_AND_CONTRAST.md` |
| Locale | de/es/ar/jp now carry this program's added keys — **478 EN / 494 PL keys added in total**, re-measured directly this session (`git show <sha>:public/locales/<loc>/translation.json`, flattened and diffed against `origin/demo@9d17cac114` in Python — not copied from any prior report): en +478, pl +494, and de/es/ar/jp each gained 478–510 keys in the two backfill passes. **Correction:** `16_OPEN_RISKS_AND_LIMITATIONS.csv` RISK-26's own status text still carries the retired mid-wave figure "445 EN / 461 PL" even though this document and `22_CODEX_REVIEW_REPORT.md` already corrected it to 478/494 — the CSV row itself was not updated to match its own program's later correction; flagged here rather than silently edited into the CSV. 6+ product-chrome strings remain hardcoded English regardless of this count (§3 E14); `jp` plural-rules defect (RISK-38) confirmed live again this session, filed, not fixed | `16_OPEN_RISKS_AND_LIMITATIONS.csv` RISK-26/RISK-38, `22_CODEX_REVIEW_REPORT.md` §4(b) |

## 8. Guard results (real exit codes, captured bare)

**Note (S14-EPICS, 2026-08-12):** this investigation session made no `src/`,
`server/src/`, `tests/`, or `dev-render/` changes (documentation only, per its
own scope), and confirmed no code commits landed between this file's last
code-affecting SHA (`f5cdc7b867`) and this worktree's current HEAD
(`1727ec0794` — two more documentation-only commits). Of the seven guards
below, this session personally re-ran only `check-ledger-csv.sh` (still
**rc=0**, 40 rows/20 columns, re-run bare after this section's own edits).
The other six are carried forward from the prior session's report, unchanged
because nothing they check changed:

```
bash scripts/check-actions.sh; echo rc=$?          → rc=0  (234 actions · 124 runtime strings · 7 events · 4 API methods) — carried forward, not re-run this session
bash scripts/check-action-coverage.sh; echo rc=$?   → rc=0  — carried forward, not re-run this session
bash scripts/check-list-canon.sh; echo rc=$?        → rc=0  — carried forward, not re-run this session
bash scripts/check-ledger-csv.sh; echo rc=$?        → rc=0  — RE-RUN THIS SESSION, confirmed live
bash scripts/check-artefakt.sh; echo rc=$?          → rc=0  — carried forward, not re-run this session
bash scripts/check-focus-canon.sh; echo rc=$?       → rc=0  — carried forward, not re-run this session
bash scripts/check-gestosc.sh <28 explicitly-passed files>; echo rc=$?  → rc=0  — carried forward, not re-run this session (no src/ changes this session, so there was nothing new to check with it; running it with zero arguments would check zero files and is not a pass)
```

`check-actions.sh` was previously rc=1 (3 unregistered `FinancialCaseDialog`
command handlers). Closed by commit `a537a022e2`: the fix took the registry
route — `table.financial_case.{save,save_and_close,retry}` added to
`src/actions/registry/tableActions.ts` (ids placed per R11's
`ORIGINAL_ORDER` requirement, not merely appended), the dialog's three
handlers routed through `runIdeaAction`, **not** a `--update` baseline bump.
The same commit surfaced and fixed a latent bug: `save()`/`load()` in
`useIdeaFinancialCasePersistence.ts` now return a truthful `Promise<boolean>`,
so `ActionResult.confirmed` reflects a real landed save (never true on a 409
or a transport error) rather than "the call didn't throw."

`check-gestosc.sh` was run explicitly against the 28 files this wave's three
integration commits touched (not with zero arguments, which would report a
false pass by checking nothing).

## 9. Unresolved risks and external blockers

**Rewritten 2026-08-12 (S14-EPICS)** — the prior version of this section
ended with a single external/owner blocker line. That is not the complete
residual list; the epic table in §3 establishes eleven residuals that are
not the owner's visual acceptance and would each independently need to close
before `READY_FOR_CODEX_REVIEW`. Full detail: `16_OPEN_RISKS_AND_LIMITATIONS.csv`
(39 rows as of S20-DOCS, 2026-08-12 — see item 7 below, the one item of the
eleven that has since closed).

**Technical/process residuals (not fixable by owner acceptance):**

1. **E01 has zero epic-level evidence** — no acceptance doc, no duplication/
   two-users/destructive-import proof exists anywhere in this program.
2. **E03's acceptance has never run** — implemented and mounted, but no
   deep-link/refresh/URL-agreement check exists.
3. **E04–E07's own DoD scenarios have never run** — every one of the four
   tools is "wired to the registry," which is necessary but not what any of
   their DoD paragraphs actually asks for (rebuild-the-scene-from-zero,
   N mixed rapid operations, persistence of the scene's structure).
4. **E08/E09/E11's persistence is proven on an isolated local ephemeral
   Postgres only** — never demo, dev, or production. E08 and E09 additionally
   ship behind default-OFF flags (`ff_ideaBusinessCase`, `ff_ideaFinancialCase`),
   so even an owner who clicked through the demo environment today could not
   reach either feature without an explicit flag override.
5. **E10 has no real-model runtime verification anywhere** — Teresa has never
   actually invoked a registered action with the result observed end-to-end
   in this program's history. RISK-30 residual (P2) — `confirmed:false` posts
   no chat correction, so 58 un-migrated actions (lane actions among them)
   can still read as an unchallenged success in Teresa's reply.
6. **E12's permission model is ownership-only** — no "who may lower a
   security classification" convention exists in this codebase; `restricted`
   protects an Idea from others, not from its own owner. This is a genuine
   product-design gap, not something a screenshot review resolves.
7. ~~**New, open product defect (not yet a numbered risk row):** at exactly
   1280×800 — one of doc-11 §6's three mandatory acceptance viewports — the
   Idea Table's row-actions kebab sits ~74px past the visible viewport edge
   in the true production wrapper (columns sum to 1354px: select 40 + title
   560 + stage 150 + tags 230 + tool 190 + date 128 + actions 56), with no
   visible scroll affordance at rest.~~ **CLOSED, S20-DOCS, 2026-08-12
   (`f86afc077f`), now filed as `RISK-39`.** The fix that closed the
   reachability half of this finding (S13-STICKY, `a18b625a78`, sticky-right
   pin on the actions column) itself regressed the same boundary — a
   width-proportional overflow at 1280×800 rest and a constant 8px sliver
   still covered at max scroll on every viewport. Both are now fixed and
   real-Chromium measured: 0px overlap and no horizontal overflow at all at
   1280×800/1440×900; 0px overlap at `scrollLeft=max` at 720×450/200%-zoom
   (720×450 still shows an arithmetically-unavoidable 435px overlap at rest,
   owner-accepted as the narrow-viewport exception, not a residual defect).
   Falsified by sabotage (reverting the fix reproduces the overlap, red only
   at the acceptance viewport). Evidence: `docs/qa/ideas-table-overlap-
   s18-2026-08-12/` (19 captures); `tests/e2e/ideas-table-overlap-geometry.spec.ts`
   (4/4). Full record: `16_OPEN_RISKS_AND_LIMITATIONS.csv` RISK-39. **This is
   the one item of the original eleven that has closed — the other ten
   remain open, as stated below.**
8. **RISK-24 (P2)** — full-repo schema convergence is broken on a fresh
   database by both runners; the 1012-table isolated DB behind every
   persistence claim in this package is itself a partial schema. Two new
   concrete instances found this wave (`role_change_audit_events`,
   `organization_context_snapshots`). **This continuation (2026-08-12)
   traced the mechanism further, still EVIDENCE_MISSING / OPEN, not
   closed:** `server/scripts/migrate.postgres.ts:555-558` — with `--safe`,
   a FAILED migration is recorded `skipped`, the run continues, and the
   script still prints `✅ Postgres migrations complete` at exit **0** (a
   broken migration is invisible in the exit code); the npm-script naming
   compounds this — `db:migrate`/`db:migrate:strict`/`db:migrate:postgres`
   are the SAME unflagged command, `db:migrate:unsafe-continue` is the one
   that passes `--safe`, so the flag named "safe" is the dangerous one; a
   second, wholly independent mechanism (`DB_MANAGED_SCHEMA`,
   `server/src/index.ts:239-244`,
   `server/src/database/PostgresDatabase.ts:477-479`) can disable
   automatic DDL/migrations at server start entirely. Two separately-tracked
   paths to change the schema means a green migration run proves nothing
   about whether the live schema matches what the code expects. See §12
   below.
9. **RISK-38 (P3)** — `Intl.PluralRules('jp')` resolves to `en-US`,
   reconfirmed live this session; pre-existing, unrelated to this program,
   filed not fixed.
10. **E14's a11y/locale/perf matrix has not run end-to-end** — 6+ hardcoded-
    English strings remain (named in §3's E14 row); the pseudo-locale/error-
    copy matrix required by doc-11 §3.8/§6 has never run anywhere in this
    program; no canvas tool ships default-on viewport virtualization; actual
    p50/p95 SLOs were never measured for any of the four tools (only two
    specific numbers within RISK-31/RISK-36 carry the owner's explicit
    ACCEPTED_DEFERMENT — see §5 — the general SLO requirement was never
    attempted, deferred or otherwise); telemetry content-safety is NOT
    VERIFIED, with no evidence of any kind found in this package.
11. **E15's regression scope is the Idea Workspace surface, not the full
    repo**, and 7–8 of the CSV's 39 rows are genuinely OPEN with no owner
    sign-off (RISK-13/15/16/17/18/24/30-residual/38) — the DoD's "P2/P3 all
    implemented or explicitly owner-accepted as named limitation" is not met.

**The E15 NOT CLEAN adjudications (§4)** remain external context a reviewer
should weigh, not a blocker — both flagged items were resolved with
evidence, not silently rounded up.

**External/owner blocker (RISK-19 only):** the owner's visual acceptance
(rule #7, no agent may substitute for it) closes exactly one thing —
RISK-19/the visual-CX matrix's technical content. It does not close any of
the ten still-open items above (item 7 closed this pass, S20-DOCS — see
above), and this document does not claim it would.

## 10. Evidence and ledger paths

- `16_OPEN_RISKS_AND_LIMITATIONS.csv` — 39 rows, 7 columns, the honest risk
  register.
- `02_EXECUTION_LEDGER.csv` — 42 rows, 20 columns, `check-ledger-csv.sh` rc=0.
- `13_RUNTIME_GATE_EVIDENCE.md` — 9 persistence chains.
- `19_VISUAL_CX_MATRIX.md`, `21_FOCUS_AND_CONTRAST.md` — visual/CX/contrast
  evidence.
- `docs/qa/ideas-table-overlap-s18-2026-08-12/` — 19 captures for the
  `RISK-39` Updated/actions overlap fix (1280×800, 1440×900, 720×450,
  200%-zoom, light+dark, plus 1280×800 interaction states).
- `10_FINANCIAL_CASE_ACCEPTANCE.md` — E09's full history through this wave's
  closure.
- `20_E15_TWO_CLEAN_ROUNDS.md` — the final `f5cdc7b867` run and its NOT CLEAN
  adjudications, scoped to the Idea Workspace test surface (§4).
- `14_A11Y_LOCALE_PERF_REPORT.md` — the E14 findings table (E14-A11Y-*/LOC-*/
  PERF-*) this document's §3 E14 row and §9 item 10 draw on directly.
- `screenshots/` — 156 captures (counted directly this session), newest sets
  `g4v3__table__*` / `g4v4__table-production__*`.

## 11. Recommendation

# **`NOT_READY`**

**Rewritten 2026-08-12 (S14-EPICS), because the owner explicitly rejected the
prior wording** ("the single named residual is the owner's visual
acceptance"). That claim does not survive an epic-by-epic check: §3
establishes that 15 of 16 epics (E01, E02, E03, E04, E05, E06, E07, E08, E09,
E10, E11, E12, E13, E14, E15 — everything except E00) carry at least one
PARTIAL/NOT DONE/NOT VERIFIED verdict, and §9 originally listed eleven
concrete residuals that are not the owner's visual acceptance and that no
amount of owner screenshot review would close (one of the eleven — the E07
kebab/Updated-column defect — has since closed this session, S20-DOCS,
`f86afc077f`/`RISK-39`; the other ten have not): two epics (E01, E03) with
essentially no acceptance evidence at all; four tools (E04–E07) whose
registry wiring is real but whose actual DoD scenario has never been run;
three features (E08, E09, E11) proven only against an isolated local
database and, for two of them, shipping behind default-OFF flags; Teresa/AI
with zero real-model runtime verification (E10); a permission-model gap in
E12 that visual review cannot touch; locale/a11y/performance gaps that were
never measured, not merely deferred, outside two specific numbers the owner
explicitly chose to defer; and an E15 regression run that is honestly NOT
CLEAN, scoped to less than the full repository, and still carries several
genuinely open, un-accepted P2/P3 rows.

None of this erases the real, falsified, evidence-backed work this program
has done — the contrast fixes, the two keyboard P0s, the E09 financial-case
save path, the E12 write path and UI, the RecordTemplateManager fix, the
Idea Table Updated/actions overlap fix (`RISK-39`), and the honest NOT CLEAN
E15 adjudication are all genuine and stand as recorded in §3–§8. But
`READY_FOR_CODEX_REVIEW` requires all of E00–E15 closed under the full DoD,
and that is not this package's state — closing one of eleven residuals is
real progress, not the finish line, and the owner has already rejected
"your acceptance is the only blocker" as a framing once; this document does
not repeat that mistake in a smaller form by treating "one fewer residual"
as "basically done." The owner's visual acceptance remains necessary for
RISK-19 specifically and cannot be supplied by any agent — but it is one
item on a longer list, not the list.

## 12. UPDATE 2026-08-12 (this continuation) — four defects closed, hygiene,
## RISK-24 mechanism detail, remote-reachability gap

Worktree `/Users/piotrwisniewski/.codex/worktrees/ideas-transform/consultify`,
branch `codex/ideas-transformation-20260809`. Candidate code identity:
**`914759d4cb`** — the last commit before this pass's own single
documentation commit (which cannot correctly cite its own hash, since it
rewrites this file). Documentation-final HEAD:
<<FINALNY_SHA_DO_UZUPELNIENIA>>, to be read from `git log -1` after that
commit lands.

### Position and push status

`git log --oneline 9d17cac114..HEAD | wc -l` = **83 commits** ahead of the
frozen comparison base `origin/demo@9d17cac11484a82f729a51044e30453e39fbcb02`
(41 inherited from prior streams/passes + this continuation's own commits).
Still **2 behind** `origin/demo` — the same, already-established
"Slack Command Center hardening" drift with zero file overlap with this
program. **This branch has never been pushed:** `git ls-remote origin
'codex/ideas-transformation-20260809'` returns nothing, `git branch -r`
lists no matching ref. **REMOTE REACHABILITY: NOT VERIFIED, PUSH
AUTHORIZATION REQUIRED** — a precondition this package did not carry before,
because no prior pass stated it explicitly.

### Three things kept separate, per this program's own rule (§8's method notes)

For every item below: **(a) implementation candidate** exists, compiles,
and has a passing targeted test — real. **(b) runtime/manual odbiór** —
**BLOCKED / EVIDENCE_MISSING**, nobody has clicked through any of these
four fixes in a running app against a real backend. **(c) integration**
(merge/deploy/demo) — **BLOCKED / EVIDENCE_MISSING**, this branch is not
even reachable on `origin` (see above), so integration cannot start.

| Defect | Commit | Class | Fix, in one line | Test evidence |
|---|---|---|---|---|
| D1 | `2771824f08` | P2 — cross-identity data leak in the UI | scoped `moduleHub.openDocuments.mywork` sessionStorage key to `<organizationId>.<userId>`, cleared the old unscoped key | `MyWorkHub.storageScope.test.ts`, 6/6 |
| D4 | `87360b62e9` | P2 — forced navigation away from the user's actual screen, reproduced live | "Skip for now" closes the onboarding modal without navigating | 7/7 |
| D2 | `499b4b98c2` | **DATA-LOSS class** (raised from P2) — unhandled `GET /map` failure caused a 6-node starter template to be built and **persisted over the real server map** | explicit error state (`role="alert" aria-live="assertive"`) + focusable retry, no silent bootstrap-and-overwrite | 3/3, sabotage → 2/3 red |
| D3 | `914759d4cb` | P2 — save-state indicator could pin "Changes queued" forever on a stale draft; a genuinely queued draft was never auto-retried | version comparison (`draftBaseVersion < serverVersion`) + immediate flush of a real pending draft | 2/2, sabotage → 2/2 red, plus a live reproduction: indicator stuck "Changes queued" 96 s post-reload while the server already had version 9 |

### Hygiene

- `a64b2657be` — cleared all 20 non-CSV `git diff --check` findings (8
  documents + `src/actions/ideaActionRegistry.ts`). 580 findings remain,
  all inside the program's 4 RFC-4180 evidence CSVs, deliberately CRLF and
  not converted. Full run: `rc=2` / 580 findings / 0 conflict markers with
  the CSVs included; `rc=0` / 0 findings / 0 conflict markers excluding
  only those 4 files.
- `b2438008fd` — 4× `TS2345` in the new D1 regression test (`status: 'open'`
  is not a member of `ItemStatus`), visible only to a FULL, serialized
  `tsc` — invisible to `esbuild`, which is all workers run. **The FIRST
  `tsc` invocation against this tree returned `rc=134` (SIGABRT/OOM) while
  its console output read as "0 errors" — a FALSE GREEN, not a pass.**
  `NODE_OPTIONS=--max-old-space-size=8192` was required before the 4 real
  errors surfaced. Repeating this program's own §8 method note in a new
  form: do not trust a bare `tsc` exit code on this machine without first
  checking it is not 134.

### RISK-24 — mechanism-level detail (elaborates the existing CSV row; the CSV itself is not edited by this pass)

`16_OPEN_RISKS_AND_LIMITATIONS.csv` RISK-24 already states, correctly, that
full-repo schema convergence is broken on a fresh database. This pass
traced *why* a "green migration" cannot be trusted as proof of anything,
two independent mechanisms:

1. `server/scripts/migrate.postgres.ts:555-558` — with `--safe`, a FAILED
   migration is recorded as `skipped`, the loop continues past it, and the
   script still prints `✅ Postgres migrations complete` and exits **0**.
   A broken migration is invisible in the exit code.
2. The npm-script naming actively misleads: `db:migrate`,
   `db:migrate:strict` and `db:migrate:postgres` (`package.json`) are the
   SAME unflagged command; `db:migrate:unsafe-continue` is the one that
   passes `--safe`. The word "safe" is attached to the dangerous one.
3. A second, wholly independent mechanism: `DB_MANAGED_SCHEMA`
   (`server/src/index.ts:239-244`,
   `server/src/database/PostgresDatabase.ts:477-479`) can disable
   automatic DDL/migrations at server start entirely, separately from
   anything the migration runner reports.

**Consequence for this package's own claims:** every persistence chain in
§6/§7 above ran against the isolated local DB behind RISK-24's own partial
schema. That does not invalidate those chains (they proved what they
proved, on the schema that existed), but it means "the migrations ran
clean" can never, on its own, stand in for "the schema matches the code" —
there are two independent, separately-tracked paths that can drift it, and
this pass found no evidence either is reconciled against the other anywhere
in this program's history. Status: **OPEN, EVIDENCE_MISSING** for
convergence — not closed by this pass, only explained further.

### Locale gap (OPEN, not closed by this pass)

D2's new `mindmap.persistence` error-state keys (`mapLoadErrorTitle`,
`mapLoadErrorBody`, `mapLoadErrorRetry`) are real, distinct EN/PL strings,
confirmed by direct read of `public/locales/{en,pl}/translation.json`.
`de`/`ar`/`ja`/`es` carry the identical raw ENGLISH text as PLACEHOLDERS
(confirmed by direct read of each locale's `translation.json`) — not
translations. This is the same class of gap `16_OPEN_RISKS_AND_LIMITATIONS.csv`
RISK-26 already tracks for this program's earlier keys, a new instance of
it, and it is OPEN, not done. Do not read this section as "locale is
handled" — it explicitly is not, for these three keys, in four locales.

### What this does and does not change

- **§3's E04 row and §9 item 8 (RISK-24)** are updated in place above with
  pointers to this section.
- **Every other residual in §3/§5/§7/§9/§11 is untouched** — E01, E03,
  E04's own DoD scenario (still un-run — the two fixes above are adjacent
  to Mind Map, not the DoD scenario itself), E05–E07's own DoD scenarios,
  E08/E09/E11's isolated-DB-only persistence, E10's zero real-model
  verification, E12's permission-model gap, E14's unmeasured SLOs and
  locale gaps (now including the new instance above), and E15's scoped,
  NOT-CLEAN regression run all remain exactly as open as §3/§9 already
  record them.
- **New, not previously stated anywhere in this package: remote
  reachability.** This branch has 0 refs on `origin`. Nothing in this
  package can be reviewed, merged, or deployed until it is pushed with
  explicit authorization — a precondition layered on top of, not a
  replacement for, the owner's visual acceptance and every technical
  residual in §9.

### Recommendation

**Unchanged: `NOT_READY`.** Four defects closed with candidate-level
evidence — real fixes, real targeted tests, one of them (D2) closing a
genuine data-loss path and one (D4) independently reproduced live before
the fix — but none has runtime odbiór or integration, and the RISK-24 and
locale gaps above are traced further, not resolved. This is real, narrow
progress on top of an already-long, honestly-tracked residual list; it does
not shorten that list to something close to done, and this document does
not claim otherwise.
