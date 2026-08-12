# 22 — Codex review report

**Candidate:** `codex/ideas-transformation-20260809` (canonical integration
branch) @ **`bcdda752b7`** (documentation HEAD) — code-final at **`f5cdc7b867`**,
only documentation commits follow it. Integration of 10 parallel stream
branches forked from the prior handoff SHA `edb38d6a29`, plus 3 further
commits landed directly on the integration branch after those streams
(context-menu-portal test restoration, an E09 action-registry closure, a
cross-file type fix).
**Base:** `origin/demo` · **62 commits ahead, 2 behind** (see §0) · never pushed
**Status: NOT `READY_FOR_CODEX_REVIEW`** — see `24_FINAL_ACCEPTANCE.md` for the
formal recommendation. This report exists so the review can start from facts
rather than from a summary, and so the reviewer knows exactly which claims are
backed by what.

---

## 0. `origin/demo` moved during this wave — read before trusting any A/B claim below

`origin/demo` moved `9d17cac114` → `f3e7df565e` (2 commits, "Slack Command
Center hardening") from a *different* session while this program's streams were
running. Every A/B comparison in this package — including every
"pre-existing, not a regression" verdict — is measured against the FROZEN base
`9d17cac114`, not the current `origin/demo` tip. This is deliberate, not stale:
the 2 new `origin/demo` commits touch 6 files with **zero** overlap with
anything this program changed (verified directly), so freezing the base does
not invalidate any evidence here — but a future merge to `demo` will still need
its own 3-way reconciliation of those 6 files.

---

## 1. Gate board

| Gate | State | How it was established |
|---|---|---|
| 1 — type-check | **PASS at `f5cdc7b867`** — client `tsc` exit 0 / 0 errors, server `tsc` exit 0 / 0 errors, both serialized | commit `f5cdc7b867` |
| 2 — QG backlog | unchanged, **QG-01…QG-06 RESOLVED** | per-item evidence in `03_CODEX_QUALITY_BACKLOG.md` |
| 3 — runtime + persistence | **PASS, isolated local DB, 9/9 chains** (chain 9 = E09 financial case) | `13_RUNTIME_GATE_EVIDENCE.md` |
| 4 — visual + CX + a11y | **all measured technical blockers RESOLVED** | `19_VISUAL_CX_MATRIX.md`, `21_FOCUS_AND_CONTRAST.md` |
| E15 — two clean rounds | **RUN at `f5cdc7b867`. Mechanical verdict NOT CLEAN** — 2 items flagged, both adjudicated with evidence, neither an open defect | `20_E15_TWO_CLEAN_ROUNDS.md`, `24_FINAL_ACCEPTANCE.md` §4 |

**What blocks readiness now:** only the owner's visual acceptance (project
rule #7, no agent may substitute for it). Type-check is PASS, the persistence
and visual gates are closed, and E15 has run with a fully-adjudicated
verdict — there is no remaining mechanical or technical gap.

---

## 2. What this candidate changes since `d31dd37bd4`, and what proves it

### RISK-12 — E09 financial case: from "no save path at all" to a proven, registry-traced save path
The dialog previously mounted with neither `initialCase` nor `onCaseChange`
(verdict (c), `10_FINANCIAL_CASE_ACCEPTANCE.md` §5). This wave built the full
chain: an additive migration (`idea_financial_cases`), a service with a
two-layer optimistic-concurrency guard, org-scoped `GET|PUT
/api/idea-financial-case/:ideaId`, an API client, and dialog wiring.
**Proof:** 6/6 real-DB, re-run personally by the integrator, real exit 0.
**Falsifiability:** the OCC sabotage was two-staged — disabling only the
fast-path version check left the suite green (the SQL compare-and-swap alone
caught the race, correctly); disabling both layers turned it red
(`expected 200 to be 409`, the losing writer's payload visible at `version 3`).
A follow-up commit (`a537a022e2`) then closed the `check-actions.sh` gate
this left open (3 unregistered command handlers) by routing the dialog's
save/save-and-close/retry through `IDEA_ACTION_REGISTRY`, and fixed a latent
bug in the same pass: `save()`/`load()` now return a truthful
`Promise<boolean>`, so `confirmed` reflects an actual landed save, not "it
didn't throw." Full detail: `10_FINANCIAL_CASE_ACCEPTANCE.md` §6–§7.

### RISK-35 — contrast: four failures closed, a fifth found and fixed
Idea Table kebab, Mind Map dark badge, Process Flow swimlane label all raised
to their required WCAG ratios with `c-*` tokens (never `primary-*`). A fifth
failure — the Mind Map depth-3+ badge in light theme — was found by refusing to
accept an earlier "hypothetical, out of scope" write-off: `getNodeDepth()`
walks a real edge chain, so a real depth-3 node was built in the harness and
measured live. Fixed the same way. **This is why Gate 4 no longer has a named
technical blocker.**

### RISK-30 — Teresa's lane-action replies now mostly tell the truth
`ActionResult` gained an additive `confirmed?: boolean`. 6/6 bus-dispatch sites
plus the lane UI-closure branch now report via a correlated acknowledgement
instead of an unconditional `{ok:true}`. 58 other UI-closure sites degrade
honestly to `confirmed:false` — but a mechanism this wave found means that
still isn't the full fix: `UnifiedChatPanel.tsx` only posts a chat message when
`result.message` is set, so a silent `confirmed:false` with no message string
leaves the model's already-streamed "done" unchallenged on screen.

### RISK-22 — a dormant security gate gets a UI
Confidentiality could be read and enforced but never set from the UI. A control
now ships in `IdeaWorkspaceTools.tsx`'s Metadata group, reached through the
real production render chain, with a downgrade confirmation and real audit
rows. Stated plainly, not buried: the permission model is ownership-only —
there is no "who may lower a classification" convention anywhere in this
codebase, and this wave correctly did not invent one. A cross-file type
defect in this gate's `t` typing (a bespoke `TFn` alias not assignable from
i18next's real `TFunction`) was found and fixed at integration (`f5cdc7b867`)
— invisible to the implementing stream, since it only runs targeted vitest
and esbuild, neither of which checks types across file boundaries.

### RISK-26 — locale coverage extended, and the real number
de/es/ar/jp now carry this program's added keys (two passes: initial +
drift-closure). The row's carried-forward "210 keys" figure is corrected to
**478 EN / 494 PL** — measured directly against `9d17cac114` at this HEAD. An
earlier mid-wave count of 445/461 is retired: it predated the last three
locale-touching streams and simply undercounted.

### RISK-36 — the row-cap guard extended to every add path
AI add rows and framework apply are now capped via the same shared
`applyRowAddCap` CSV import already used, instead of relying on the render cap
alone to bound the underlying data set.

### RISK-06 — a dead mount reached
`RecordTemplateManager` is now reachable from `TableToolbar`'s real Tools menu,
proven by an accessible-name assertion with a sabotage/restore cycle.

### RISK-13/14/15/16/17/18 — formally A/B-verified, not carried forward on faith
Each ran identically against `origin/demo@9d17cac114` and the candidate,
compared by test name AND by test count per file. Three previously-stale
ledger rows (RISK-08/09/10) closed in the same pass.

### E15 coverage restoration and final run
A context-menu-portal test present at baseline and deleted by this program's
first commit was restored with stronger, more targeted assertions
(`fe2b8b7a82`) after the deletion was traced and the underlying re-home
verified as legitimate. The full two-clean-rounds regression then ran at the
final code SHA: 212 files / 1291 tests, 0 new failures, 8 fixed, 0
round-to-round drift — mechanical verdict NOT CLEAN, both flagged items
adjudicated. See `20_E15_TWO_CLEAN_ROUNDS.md`.

---

## 3. Claims this report does NOT make

Stated plainly, because the value of the rest depends on it.

- **RISK-30's residual is real, not closed.** Teresa can still leave a refused
  lane action's success message unchallenged for 58 un-migrated actions.
- **RISK-31 / RISK-36's performance claims remain NOT MEASURED**, by the
  owner's own explicit decision (the measurement machine carried non-trivial
  contention from unrelated processes) — do not read either as an
  improvement.
- **RISK-24 (schema convergence) is unchanged and still broken** on both
  runners, on a fresh database. Two new concrete instances were found this
  wave (see `16_OPEN_RISKS_AND_LIMITATIONS.csv`), not fixed.
- **A NEW, narrower visual finding is open and untriaged**: at exactly
  1280×800, the Idea Table's row-actions kebab is out of frame at rest in the
  true production wrapper, with no visible scroll affordance. It is reachable
  (a real scroll container exists one component down), not unreachable — but
  not discoverable without prior knowledge. Not yet filed as its own risk row.
- **RISK-38 (the `jp` plural-rules defect) is filed, not fixed.** It predates
  this program and was explicitly left out of scope.
- **E15's mechanical verdict is NOT CLEAN, and this report does not describe
  it as clean.** Both flagged items are adjudicated (§2, `20_E15_TWO_CLEAN_ROUNDS.md`),
  neither is an open product defect, but the aggregate-looks-good numbers
  were not used as a reason to round the verdict up.
- **The E01 (data model integrity) and E03 (shell/navigation acceptance)
  epics remain NOT VERIFIED** — nothing in this wave or the prior one closed
  their DoD.

---

## 4. Corrections the reviewer should weigh

This program has a documented pattern of overclaims caught and corrected in
writing before the next report — the reviewer should treat that pattern as a
reason to spot-check, not as reassurance it cannot happen again.

**(a) A CSV evidence line was stale even though its verdict wasn't.** RISK-06's
row claimed `grep -rln RecordTemplateManager src/` returns 2 hits; re-run at
`edb38d6a29` it returned 4 (2 were `source:` comment strings, not real
consumers). The RESOLVED verdict this wave establishes is independent of that
old grep count, but the count itself sat wrong in the record until this pass.

**(b) A locale-key count went through two revisions before landing on the
real one.** A mid-wave measurement recorded 445/461; the true figure, measured
directly against `9d17cac114` at this HEAD (and re-confirmed after the last
three locale streams landed), is **478/494**. Both figures are visible in this
package's history rather than the earlier one being silently deleted.

**(c) A "Table-evidence recapture: only light/pl done" claim was already false
when it was written.** All four `g4__table__baseline__1440x900__*` cells were
already clean on disk from an earlier, unrelated recapture — the CSV text and
the evidence directory had drifted apart. No product code was affected; the
lesson is to check the files before writing "not yet done."

**(d) A "0 files losing tests" claim from an earlier E15 pass missed a file
that lost ALL its tests.** `c5b1b6e6b9`'s two-clean-rounds comparison only
diffed test counts on files present on both sides; a file deleted entirely
(`ContextMenuPortal.test.tsx`, gone since this program's first commit) never
entered that comparison. Restored and reproven this wave — see
`20_E15_TWO_CLEAN_ROUNDS.md`.

**(e) Two cross-file type defects were invisible to every individual stream
by construction**, found only when the integrated tree got a full, serialized
`tsc` run — workers are barred from that (it OOMs/starves on this machine)
and rely on targeted vitest + esbuild, neither of which checks types across
file boundaries. Both fixed at integration (`f5cdc7b867`).

---

## 5. Where to look first

1. `24_FINAL_ACCEPTANCE.md` — the formal recommendation and closure table.
2. `16_OPEN_RISKS_AND_LIMITATIONS.csv` — 38 rows, statuses reconciled to the
   code at this SHA, in both directions (things closed *and* things newly
   found).
3. `13_RUNTIME_GATE_EVIDENCE.md` — the strongest evidence in the package,
   now 9 persistence chains.
4. `20_E15_TWO_CLEAN_ROUNDS.md` — the final regression numbers and the two
   NOT CLEAN adjudications.
5. `10_FINANCIAL_CASE_ACCEPTANCE.md` §6–§7 — RISK-12's full closure and the
   two-stage OCC sabotage.
6. `19_VISUAL_CX_MATRIX.md` — the PRODUCTION-SHAPE section carries the one
   new, untriaged finding from this wave.

## 6. Reproducing the evidence

```bash
cd "/Users/piotrwisniewski/.codex/worktrees/ideas-streams/s6-e09"
for g in check-actions check-action-coverage check-list-canon check-ledger-csv check-artefakt check-focus-canon; do bash scripts/$g.sh >/dev/null 2>&1; echo "$g rc=$?"; done
```

Expected: all `rc=0` (`check-actions` reports 234 actions · 124 runtime
strings · 7 events · 4 API methods).

Real-DB suites need an isolated local Postgres plus **both** `RUN_DB_TESTS=1`
and `MOCK_DB=false`; recipe in `13_RUNTIME_GATE_EVIDENCE.md` §2. Never demo,
never production.
