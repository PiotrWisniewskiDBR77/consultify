# 24 — Final acceptance (Codex handoff package)

**Numbering note:** `docs/qa/ideas-manual-audit-2026-08-09/11_..._PROTOCOL.md` §9
names this file `17_FINAL_ACCEPTANCE.md`. In this package, `17_` is already
taken by `17_PERFORMANCE_MEASUREMENT.md`, so this file is `24_` instead — the
next free number, not a sign a document is missing. Every §9-required item
below is present under its natural section.

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

Built from the epic acceptance docs (`05`–`12`, `04B`), the runtime gate
evidence (`13_`), and this wave's risk closures. Where a line says
"unchanged", the underlying acceptance doc's own SHA-sweep note (§ below)
records that it was not cheaply re-verifiable this wave and is carried
forward as history, not re-attested fresh.

| Epic | State at this HEAD | What this wave changed, if anything |
|---|---|---|
| E00 — Candidate control and ledger | **DONE** | Ledger extended to 40 rows for this wave's work; `check-ledger-csv.sh` rc=0. |
| E01 — One Idea data model and integrity | **NOT VERIFIED** (unchanged) | Nothing this wave touched E01-level integrity proofs. |
| E02 — Action Registry | **IMPLEMENTED, QG-01 RESOLVED** (now 234-action registry); Teresa runtime invocation still NOT VERIFIED | Registry grew 231→234 this wave (`table.financial_case.{save,save_and_close,retry}`, closing RISK-12's `check-actions.sh` gap); RISK-30 changed action *semantics* (truthful `confirmed`) separately. `check-actions.sh` is now **rc=0** — see §7. |
| E03 — Shell, navigation and ownership | **IMPLEMENTED, acceptance NOT VERIFIED** (unchanged) | No change this wave. |
| E04 — Mind Map | **WIRED TO REGISTRY, DoD NOT CLOSED** | RISK-35's depth-3 contrast fix landed (visual defect only); the 18-node-scene/cross-link/AI-proposal persistence DoD was not independently rerun. |
| E05 — Whiteboard | **WIRED TO REGISTRY, DoD NOT CLOSED** | No change this wave (WB-CLIPBOARD-01 was closed by S3-AB before this wave started). |
| E06 — Process Flow | **WIRED TO REGISTRY, DoD NOT CLOSED** | RISK-30's lane-action ack landed for this tool's `lane_frame.*` actions; RISK-31's node-cap guardrail already stood, performance stays NOT MEASURED. |
| E07 — Table P15 | **WIRED TO REGISTRY, DoD NOT CLOSED** | RISK-06 (dead mount reached), RISK-36 (row-cap extended to AI/framework add paths), RISK-35 (kebab contrast) all closed this wave. |
| E08 — Business case and decision governance | **PARTIAL; persistence now PROVEN ON ISOLATED LOCAL DB ONLY** | Its migrations (maturity gates, business case) were applied and proven under Gate 3 before this wave; unchanged this wave. Never run against demo/prod/dev. |
| E09 — Financial case | **SAVE PATH BUILT AND PERSISTENCE-VERIFIED ON ISOLATED LOCAL DB** (chain 9, 6/6); commands now registry-traced | **Closed this wave** (RISK-12, then its `check-actions.sh` residual closed by `a537a022e2`, which also fixed a latent bug — `save()`/`load()` now return a truthful `Promise<boolean>`). Flag `ff_ideaFinancialCase` stays default OFF; no owner browser click-through yet. |
| E10 — AI and Teresa | **OPENED, NOT CLOSED** | RISK-30 improves the truthfulness of lane-action acknowledgements Teresa relays; the epic's full behavioral DoD under a real model call is still not runtime-verified. |
| E11 — Conversion, import, export and templates | **PARTIAL** | No change this wave; its `mapping_version` migration was applied under Gate 3 before this wave (RISK-04). |
| E12 — Collaboration, security and resilience | **OPENED, materially advanced** | RISK-22 closed this wave: a UI now exists to set `confidentiality`, not just read/enforce it. A cross-file type defect in the confidentiality gate's `t` typing was also found and fixed at integration (`f5cdc7b867`). Ownership-only permission-model limitation stated, not hidden. |
| E13 — Visual system and CX | **All measured technical blockers RESOLVED this wave; owner acceptance is the ONLY residual** | RISK-19/29/35 closed. One new, untriaged, narrower finding surfaced (production-shape kebab at 1280×800 — see §8). |
| E14 — Accessibility, locale, performance and observability | **OPENED, NOT FULLY CLOSED** | RISK-26 extended locale coverage to de/es/ar/jp for this program's keys (478 EN/494 PL); RISK-38 (new, pre-existing `jp` plural-rules defect) filed, not fixed. Full a11y/locale/perf matrix (doc-11 §3.8) has still not run end-to-end. |
| E15 — Final regression and evidence closure | **RUN at `f5cdc7b867`. Mechanical verdict: NOT CLEAN — two items flagged, both adjudicated, neither an open defect.** | See §4 for the full table and adjudications. |

## 4. E15 — final regression numbers (run at `f5cdc7b867`)

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

Computed directly from `16_OPEN_RISKS_AND_LIMITATIONS.csv` (38 rows, real CSV
parser, not text search):

| Severity | Total rows | RESOLVED / CLOSED | PARTIAL | OPEN |
|---|---|---|---|---|
| P0 | 3 | **3** | 0 | 0 |
| P1 | 16 | 12 | 4 | 0 |
| P2 | 11 | 7 | 1 | 3 |
| P3 | 8 | 3 | 0 | 5 |
| **Total** | **38** | **25** | **5** | **8** |

**Zero open P0. Zero open P1** (the 4 P1 PARTIAL rows are RISK-19*, RISK-22,
RISK-31, RISK-36 — each has a real, named, non-blocking residual, not an
unaddressed core defect). All 8 fully-OPEN rows are P2/P3, individually
itemized in the CSV with their own evidence.

*RISK-19 is technically RESOLVED-in-substance (see its CSV row) but graded
PARTIAL here because its own status text still reads "PARTIALLY RESOLVED" —
kept exactly as the integrator wrote it rather than silently upgraded.

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
| Performance | **NOT MEASURED**, literally, for both open perf items (Process Flow node-cap speed, Table row-cap at N≥5,000) — owner's explicit decision given the measurement machine's non-Consultify load (84–832 load average from Teams/WindowServer/syspolicyd/xattr sweep/fileproviderd) | `17_PERFORMANCE_MEASUREMENT.md`, RISK-31/RISK-36 in the CSV |
| Accessibility (contrast + focus) | **RESOLVED** — 5/5 measured WCAG contrast failures fixed (RISK-35); focus-visible rings present on canvas nodes; 2 P0 keyboard defects fixed pre-wave | `21_FOCUS_AND_CONTRAST.md` |
| Locale | de/es/ar/jp now carry this program's added keys — **478 EN / 494 PL keys added in total** (diffed against `9d17cac114`); ~3,710 pre-existing missing keys in those locales remain, out of scope; `jp` plural-rules defect newly filed as RISK-38, not fixed | `16_OPEN_RISKS_AND_LIMITATIONS.csv` RISK-26/RISK-38 |

## 8. Guard results (real exit codes, captured bare)

```
bash scripts/check-actions.sh; echo rc=$?          → rc=0  (234 actions · 124 runtime strings · 7 events · 4 API methods)
bash scripts/check-action-coverage.sh; echo rc=$?   → rc=0
bash scripts/check-list-canon.sh; echo rc=$?        → rc=0
bash scripts/check-ledger-csv.sh; echo rc=$?        → rc=0
bash scripts/check-artefakt.sh; echo rc=$?          → rc=0
bash scripts/check-focus-canon.sh; echo rc=$?       → rc=0
bash scripts/check-gestosc.sh <28 explicitly-passed files>; echo rc=$?  → rc=0
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

Full detail: `16_OPEN_RISKS_AND_LIMITATIONS.csv` (38 rows). Highlights that
matter for a reviewer's first pass:

- **RISK-30 residual (P2)** — `confirmed:false` posts no chat correction, so
  58 un-migrated actions can still read as an unchallenged success in
  Teresa's reply.
- **RISK-31 / RISK-36 residual (P1/P2)** — performance is NOT MEASURED by
  owner decision, not by omission.
- **RISK-24 (P2)** — full-repo schema convergence is broken on a fresh
  database by both runners; two new concrete instances found this wave
  (`role_change_audit_events`, `organization_context_snapshots`).
- **New, untriaged finding (not yet a numbered risk):** at exactly 1280×800,
  the Idea Table's row-actions kebab is out of frame at rest in the true
  production wrapper, with no visible scroll affordance — reachable (a real
  `overflow-auto` container exists), not discoverable without prior
  knowledge. See `19_VISUAL_CX_MATRIX.md` "PRODUCTION-SHAPE measurement".
  Flagged here for the owner/next session to triage into its own row.
- **RISK-38 (P3, new)** — `Intl.PluralRules('jp')` resolves to `en-US`;
  pre-existing, unrelated to this program, filed not fixed.
- **The E15 NOT CLEAN adjudications above (§4)** are external context a
  reviewer should weigh, not a blocker — both items were resolved with
  evidence, not silently rounded up.
- **External/owner blocker:** the owner's visual acceptance (rule #7, no
  agent may substitute for it) is the only item this package cannot close
  by itself.

## 10. Evidence and ledger paths

- `16_OPEN_RISKS_AND_LIMITATIONS.csv` — 38 rows, 7 columns, the honest risk
  register.
- `02_EXECUTION_LEDGER.csv` — 40 rows, 20 columns, `check-ledger-csv.sh` rc=0.
- `13_RUNTIME_GATE_EVIDENCE.md` — 9 persistence chains.
- `19_VISUAL_CX_MATRIX.md`, `21_FOCUS_AND_CONTRAST.md` — visual/CX/contrast
  evidence.
- `10_FINANCIAL_CASE_ACCEPTANCE.md` — E09's full history through this wave's
  closure.
- `20_E15_TWO_CLEAN_ROUNDS.md` — the final `f5cdc7b867` run and its NOT CLEAN
  adjudications.
- `screenshots/` — 100+ captures, newest sets `g4v3__table__*` /
  `g4v4__table-production__*`.

## 11. Recommendation

# **`NOT_READY`**

The single named residual that blocks a `READY_FOR_CODEX_REVIEW`
recommendation is the **owner's visual acceptance**, which no agent may
substitute for (project rule #7) — every measured technical blocker to Gate 4
is closed, type-check is PASS, and E15 has been run with a fully-adjudicated
NOT CLEAN verdict (not a silent pass, not an unresolved gap). There is no
longer a mechanical or technical gap in this package — the owner's own eyes
on the Gate-4 evidence are what stand between this and
`READY_FOR_CODEX_REVIEW`.
