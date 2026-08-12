# 22 — Codex review report

**Candidate:** `codex/ideas-s11-docs` @ **`6fec03f7a0`** (integration of 10 parallel
stream branches forked from the prior handoff SHA `edb38d6a29`, 16 commits ahead
of it)
**Base:** `origin/demo` · **57 commits ahead, 2 behind** (see §0) · never pushed
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
| 1 — type-check | not re-run this wave (documentation-only pass); last known PASS at `d31dd37bd4` | `00_PROGRAM_STATUS_AND_VERSION.md` |
| 2 — QG backlog | unchanged, **QG-01…QG-06 RESOLVED** | per-item evidence in `03_CODEX_QUALITY_BACKLOG.md` |
| 3 — runtime + persistence | **PASS, isolated local DB, 9/9 chains** (chain 9 = E09 financial case, added this wave) | `13_RUNTIME_GATE_EVIDENCE.md` |
| 4 — visual + CX + a11y | **all measured technical blockers RESOLVED** | `19_VISUAL_CX_MATRIX.md`, `21_FOCUS_AND_CONTRAST.md` |
| E15 — two clean rounds | **NOT YET RE-RUN at this SHA** — historical PASS at `c5b1b6e6b9`, 16 commits behind HEAD | `20_E15_TWO_CLEAN_ROUNDS.md`, `24_FINAL_ACCEPTANCE.md` placeholder |

**What blocks readiness now:** the owner's visual acceptance (project rule #7,
no agent may substitute for it) plus a pending E15 two-round re-run at
`6fec03f7a0`, which the owner is running separately and will supply. That is
narrower than the prior wave's blocker — there is no longer a named technical
contrast defect.

---

## 2. What this candidate changes since `d31dd37bd4`, and what proves it

### RISK-12 — E09 financial case: from "no save path at all" to a proven save path
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
Full detail: `10_FINANCIAL_CASE_ACCEPTANCE.md` §6–§7.

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
codebase, and this wave correctly did not invent one.

### RISK-26 — locale coverage extended, and a real number corrected
de/es/ar/jp now carry this program's added keys (two passes: initial +
drift-closure). The row's carried-forward "210 keys" figure is corrected to
"445 EN / 461 PL" — and the integrator's own independent diff against
`9d17cac114` measured 478/494, close but not identical; both numbers are on
record rather than quietly reconciled to agree.

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

---

## 3. Claims this report does NOT make

Stated plainly, because the value of the rest depends on it.

- **Type-check (Gate 1) was not re-run this wave.** The last real, independently
  captured PASS is at `d31dd37bd4`, 16 commits behind this candidate. This
  documentation pass did not touch `src/`, `server/src/`, or `tests/`, so the
  risk of a fresh type error is low but **NOT VERIFIED** at `6fec03f7a0`.
- **E15's two-clean-rounds regression has not been re-run at this SHA.** The
  owner is running it separately; `24_FINAL_ACCEPTANCE.md` carries a marked
  placeholder, not a number.
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
- **`scripts/check-actions.sh` is currently rc=1**, and this report does not
  claim otherwise: 3 command-verb handlers in `FinancialCaseDialog.tsx` are not
  yet traced to `IDEA_ACTION_REGISTRY`, deliberately deferred because the file
  that needs the new entry was being actively rewritten by a different stream
  this wave.

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

**(b) A locale-key count did not reconcile cleanly, and was left unreconciled
on purpose.** The integrator's own diff (478 EN / 494 PL new keys since
`9d17cac114`) did not exactly match the figure recorded in the RISK-26 ruling
(445/461). Rather than silently picking one, both are on record with the
likely explanation (differing diff scope) stated as unconfirmed.

**(c) A "Table-evidence recapture: only light/pl done" claim was already false
when it was written.** All four `g4__table__baseline__1440x900__*` cells were
already clean on disk from an earlier, unrelated recapture — the CSV text and
the evidence directory had drifted apart. No product code was affected; the
lesson is to check the files before writing "not yet done."

**(d) Two P0 keyboard defects from the prior wave (forward Tab hijacked
globally; Shift+Tab spawning a Mind Map node) remain fixed and unregressed** —
re-confirmed only indirectly this wave (no dedicated re-run), carried forward
as historical fact, not re-verified at `6fec03f7a0`.

---

## 5. Where to look first

1. `24_FINAL_ACCEPTANCE.md` — the formal recommendation and closure table.
2. `16_OPEN_RISKS_AND_LIMITATIONS.csv` — 38 rows, statuses reconciled to the
   code at this SHA, in both directions (things closed *and* things newly
   found).
3. `13_RUNTIME_GATE_EVIDENCE.md` — the strongest evidence in the package,
   now 9 persistence chains.
4. `10_FINANCIAL_CASE_ACCEPTANCE.md` §6–§7 — RISK-12's full closure and the
   two-stage OCC sabotage.
5. `19_VISUAL_CX_MATRIX.md` — the PRODUCTION-SHAPE section carries the one
   new, untriaged finding from this wave.

## 6. Reproducing the evidence

```bash
cd "/Users/piotrwisniewski/.codex/worktrees/ideas-streams/s6-e09"
for g in check-actions check-ledger-csv check-focus-canon check-list-canon check-artefakt; do bash scripts/$g.sh >/dev/null 2>&1; echo "$g rc=$?"; done
```

Expected: `check-actions rc=1` (documented above and in
`10_FINANCIAL_CASE_ACCEPTANCE.md` §6.9), the rest `rc=0`.

Real-DB suites need an isolated local Postgres plus **both** `RUN_DB_TESTS=1`
and `MOCK_DB=false`; recipe in `13_RUNTIME_GATE_EVIDENCE.md` §2. Never demo,
never production.
