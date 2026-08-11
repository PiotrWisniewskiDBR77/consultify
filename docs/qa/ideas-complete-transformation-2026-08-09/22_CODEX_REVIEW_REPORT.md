# 22 — Codex review report

**Candidate:** `codex/ideas-transformation-20260809` @ **`d31dd37bd4`**
**Base:** `origin/demo` @ `9d17cac114` · **40 commits ahead, 0 behind** · never pushed
**Status: NOT `READY_FOR_CODEX_REVIEW`** — one gate is open. This report exists so
the review can start from facts rather than from a summary, and so the reviewer
knows exactly which claims are backed by what.

---

## 1. Gate board

| Gate | State | How it was established |
|---|---|---|
| 1 — type-check | **PASS** | client `tsc --noEmit` exit 0 / 0 errors; server `tsc --noEmit` exit 0 / 0 errors. Run serialized; exit codes captured bare, never through a pipe. |
| 2 — QG backlog | **QG-01…QG-06 RESOLVED** | per-item evidence in `03_CODEX_QUALITY_BACKLOG.md` |
| 3 — runtime + persistence | **PASS, isolated local DB, 8/8 chains** | `13_RUNTIME_GATE_EVIDENCE.md` |
| 4 — visual + CX + a11y | **FIX_REQUIRED** | 3 measured contrast failures remain; owner acceptance not sought |
| E15 — two clean rounds | **PASS, 208-file scope** | `20_E15_TWO_CLEAN_ROUNDS.md` RE-RUN |

**What blocks Gate 4:** three contrast failures measured on the composited
background — Table kebab icon 1.93:1 light / 1.61:1 dark (3:1 floor), Mind Map
dark badge 3.22:1 (4.5:1), Process Flow swimlane label 4.43:1 (4.5:1). Plus the
owner's own acceptance, which no agent may substitute for (project rule #7).

---

## 2. What this candidate changes, and what proves it

### QG-01 — the 231-action registry split
10,696-line monolith → a 404-line barrel plus `src/actions/registry/*`. Import
path unchanged for all 47 consumers.
**Proof:** 231/231 ids identical; **all 231 action bodies byte-identical**
(extracted and diffed, not eyeballed); Teresa manifest sha256 unchanged; 21/21
exports; acyclic import graph; guard reports the same 231/124/7/4 as before.
**New guard rule R11** makes menu-order drift impossible — proven by negative
control in both directions.

### Gate 3 — persistence, 8/8 chains
All four tools plus maturity gates, business case, conversion mapping-version and
confidentiality pass **save → refresh → genuine cold reopen → direct-SQL
readback**. Cold reopen is real: `pool.end()` TCP teardown, module-level pool
nulled, brand-new express app.
**Six sabotages**, one of which came back **vacuous** (a Postgres column `DEFAULT`
papered over an omitted write) and was reported and redesigned rather than
banked. Migrations were applied on an **isolated local ephemeral Postgres only**,
under explicit owner authorisation, after a four-condition review.

### E12 — a security gate that was dormant
Five endpoints that sent Idea content to an LLM or out as a file with **no gate
at all** now return 403 for a `restricted` Idea. Proven on a real 1011-table
Postgres; deleting one gate turns the suite red (`expected 404 to be 403`).
**Then the deeper finding:** the state that triggers the gate could never be
**set** — no write route existed anywhere. Added. And the audit trail that should
record it was hollow repo-wide: `before_json`/`after_json` were NULL in **0 of 8**
rows because the middleware's allow-list silently dropped both fields for every
caller in the app. Found by querying the database, not by reading code.

### Locale
Four entire features — `formBuilder.*`, `formsIndex.*`, `interfacesIndex.*`,
`ideas.financial.*` — were fully wired with `t()` and had **zero** locale
entries, rendering English to Polish users. 210 keys fixed for pl/en, guarded by
an AST test that re-derives its scope at run time.

### Accessibility
74 modal overlays brought to the full dialog contract (role, aria-modal,
accessible name, Escape, focus trap, focus restore). Three real bugs surfaced
doing it: the native-`autoFocus` focus-restore race, a bespoke mount-focus effect
doing the same, and a nested-dialog Escape firing both handlers.

**Two P0 keyboard defects** found while capturing focus evidence: forward Tab was
hijacked globally (listener on `document`, guard excluded inputs but not
buttons), so Tab never moved focus while a canvas tool was open; and Shift+Tab
spawned an empty node on Mind Map from a fresh page with zero clicks. Both fixed.

### Scale
Table: hard 500-row render cap + explicit CSV import guard, nothing silently
truncated. Process Flow: 500/200 node guardrail on every add path. Both chosen
over virtualization with the reasoning recorded in code.

---

## 3. Claims this report does NOT make

Stated plainly, because the value of the rest depends on it.

- **Process Flow's performance fix is unmeasured.** The O(N²)→O(N) argument is
  traceable in `@reactflow/core`, but the post-fix benchmark never completed at
  N≥500 under machine load. It is not proven faster.
- **Table at N=5,000/10,000 post-cap: NOT MEASURED.** The cap bounds DOM cost by
  construction (N=1,000 measured 1,000→500 rendered rows, a structural fact), but
  the OOM ceiling was not re-tested.
- **E09 financial case has no save path at all** (verdict (c), RISK-12, P1). The
  dialog discards the user's work. Flag defaults OFF. Sized, deliberately not
  built — it is a feature and needs the owner's decision.
- **Teresa can still report success for a refused lane action** (RISK-30) — the
  registry dispatch returns `{ok:true}` unconditionally. Human-visible defect
  fixed; the AI-facing one is not.
- **Full-repo schema convergence is broken** (RISK-24). The 1011-table database
  behind every runtime claim is a **partial** schema.
- **No full-repo test run.** E15's scope is the Idea Workspace surface: 208 files.
- **de/ar/jp/es** did not receive the 210 new locale keys.

---

## 4. Two corrections the reviewer should weigh

This program made two claims that did not hold. Both were withdrawn in writing,
in the documents themselves, before this report was written.

**(a) Gate 4 was described as "awaiting owner acceptance" while a submitted
screenshot still showed a clipped label** and several P1s were open. The owner
caught it. The rule now written into the status doc: a gate is never awaiting
acceptance while this program's own reports or images contain open P1s or a
visible collision.

**(b) The first "two clean rounds" measured a scope that silently excluded 59 of
208 files.** A quoted glob passed to vitest is a path *filter*, not a glob — it
matched nothing. Hiding in the excluded tier: `whiteboardContextMenu.keyboard.
integration.test.tsx`, 4 passed at `origin/demo` and 4 failed from **`93ebc3aa20`
— this program's first commit**. Focus never returned to the trigger and the menu
had no roving tabindex, across all seven context-menu consumers.

That second one carries a warning for the reviewer: **"roving-tabindex gaps in
the shared CanvasContextMenu" sat on this program's KNOWN PRE-EXISTING FAILURES
list for weeks and was not pre-existing.** Any other item on that list that has
never been A/B'd against `origin/demo` should be treated as unverified.

---

## 5. Where to look first

1. `16_OPEN_RISKS_AND_LIMITATIONS.csv` — 37 rows, statuses reconciled to the code
   at this SHA, in both directions (things closed *and* things re-opened).
2. `13_RUNTIME_GATE_EVIDENCE.md` — the strongest evidence in the package.
3. `20_E15_TWO_CLEAN_ROUNDS.md` — read the retraction before the results.
4. `21_FOCUS_AND_CONTRAST.md` — the open Gate-4 blockers.
5. `03_CODEX_QUALITY_BACKLOG.md` — QG-01…QG-06.

## 6. Reproducing the evidence

```bash
cd "/Users/piotrwisniewski/.codex/worktrees/ideas-transform/consultify"
for g in check-actions check-action-coverage check-list-canon check-gestosc check-ledger-csv check-artefakt check-focus-canon; do bash scripts/$g.sh >/dev/null 2>&1; echo "$g rc=$?"; done
```

```bash
npx vitest run tests/components/MyWork tests/unit/mindmap src/components/MyWork --retry=0 --reporter=json --outputFile=/tmp/verify.json
```

Then assert the scope from the JSON itself — 208 files, 59 colocated,
`whiteboardContextMenu` present. A filter that matches nothing exits 0 and looks
exactly like one that matches everything and passes.

Real-DB suites need an isolated local Postgres plus **both** `RUN_DB_TESTS=1`
and `MOCK_DB=false`; recipe in `13_RUNTIME_GATE_EVIDENCE.md` §2. Never demo,
never production.
