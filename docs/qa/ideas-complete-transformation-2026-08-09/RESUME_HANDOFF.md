# RESUME_HANDOFF — Ideas transformation program

Rewritten 2026-08-10 (overnight orchestrator session). Supersedes the previous
handoff, which described HEAD `deb103fcde`. Nothing here is a PASS claim beyond
what the evidence column literally says.

## 1. Candidate identity

| | |
|---|---|
| Worktree | `/Users/piotrwisniewski/.codex/worktrees/ideas-transform/consultify` |
| Branch | `codex/ideas-transformation-20260809` |
| HEAD | `c5b1b6e6b9` (+ this documentation commit) |
| Base | `origin/demo` @ `9d17cac114` |
| Position | **37 commits ahead, 0 behind** |
| Working tree | clean |
| Pushed? | **NO.** No push, no merge to demo, no deploy, ever. No demo/prod database was touched. |

## 2. Gate board

| Gate | State | Evidence |
|---|---|---|
| 1 — full type-check | **PASS** | `npm run type-check` exit 0, 0 errors, captured bare. Server `tsc --noEmit` exit 0 too. |
| 2 — QG backlog | **QG-01…QG-06 all RESOLVED** | `03_CODEX_QUALITY_BACKLOG.md` |
| 3 — runtime + persistence | **PASS on isolated local DB** — 8/8 chains | `13_RUNTIME_GATE_EVIDENCE.md` |
| 4 — visual + CX + a11y | **FIX_REQUIRED** (owner review 2026-08-11) | `19_VISUAL_CX_MATRIX.md`, `14_A11Y_LOCALE_PERF_REPORT.md` |
| E15 — two clean rounds | **PASS** | `20_E15_TWO_CLEAN_ROUNDS.md` |

**Status: NOT `READY_FOR_CODEX_REVIEW`.** An earlier revision of this file said
the only missing item was the owner's acceptance. **That was an overclaim and it
is withdrawn.** The owner reviewed the submitted Process Flow screenshot and saw
the "Brak ostrzeżeń" chip still clipped by the right rail at 720×450/200% — a
visible collision at a required viewport. Several P1s from this program's own
reports were also still open while the state was being summarised as complete.

Rule, now explicit: **a gate is never "awaiting acceptance" while this program's
own reports or submitted images contain open P1s or a visible collision.**
Reporting a defect in a subordinate clause does not discharge it. See §5.

## 3. What this session actually proved

- **QG-01** — the 10,696-line action registry split per tool behind an unchanged
  public API. 231/231 ids identical, **all 231 action bodies byte-identical**,
  Teresa manifest sha256 unchanged, 21/21 exports, acyclic import graph. Two
  defects the implementing stream did not report were found and fixed: it did not
  type-check (TS2304), and a `?? 0` sort fallback would have silently jumped any
  future unregistered action to the **top** of Menu 3. Closed permanently by new
  guard rule **R11**.
- **Gate 3** — the four `20260810_idea_*` migrations, owner-authorised, applied on
  an isolated ephemeral Postgres. Idempotent across three runs, schema proven via
  `information_schema` (not the runner's report — `--safe` reports failure as
  `skipped` with exit 0), CHECK constraint proven to bind (SQLSTATE 23514).
  All **8** persistence chains pass save → refresh → **cold reopen** → direct-SQL
  readback. The cold reopen is real: `pool.end()` TCP teardown, new app instance.
- **E12** — five endpoints that sent Idea content to an LLM or out as a file with
  **no gate whatsoever** now return 403 for a restricted Idea. Proven on a real
  1011-table Postgres.
- **E15** — two consecutive rounds, per-test A/B against `origin/demo`: 0 new
  failures, 0 lost tests, 11 fixed, +202 tests, zero flakiness between rounds.

**Every green was attacked before it was accepted.** Delete the CSV-export gate →
`expected 404 to be 403`. Neuter `edges_json` → `warm refresh (process flow)
missing mutateMark`. Reintroduce the duplicate hex → all 10 QG-04 tests red.
Remove an id from `ORIGINAL_ORDER` → R11 names it. Delete one locale key → the
i18n guard names it and all five call sites. Each was then reverted and the green
confirmed to return.

## 4. The findings that matter most

- **RISK-22 (P1, now fixed).** `my_ideas.confidentiality` could be read and
  enforced but **never set** — no write route existed anywhere. So the E12
  protection proven at runtime was **dormant in production**: no Idea could reach
  the state that triggers it. A write path, GET exposure and validation were
  added. **No UI was built** — that needs a prototype and your acceptance first.
- **The audit trail was hollow, repo-wide.** `before_json`/`after_json` were NULL
  in **0 of 8** `IDEA_UPDATE` rows. The middleware's allow-list silently dropped
  both fields for every caller in the app. Found by querying the database, not by
  reading the code. Now fixed; a `restricted → standard` downgrade is recorded.
- **Four whole features rendered English to Polish users.** `formBuilder.*`,
  `formsIndex.*`, `interfacesIndex.*`, `ideas.financial.*` were fully wired with
  `t()` and had **zero** locale entries. 210 keys fixed, guarded by an AST test.
- **A P1 that wasn't.** The clipped Ideas-table panel was a **dev-render harness**
  artefact, not a product defect. Asking "harness or product?" before touching CSS
  is what stopped a healthy production layout being "fixed" to suit a broken
  screenshot. The four affected screenshots were recaptured.
- **A regression hiding behind a red file.** See `20_E15_TWO_CLEAN_ROUNDS.md` §3.

## 5. What is NOT done — read before claiming anything

**Gate-4 blockers (owner review 2026-08-11). These come before any acceptance
request, not after it.**

1. **Process Flow at 720×450 / 200%: the right rail clips the Menu-2 "Brak
   ostrzeżeń" chip.** Visible in the submitted
   `screenshots/fix__processflow__zoom200reflow__720x450__light__pl.png`. A prior
   stream fixed a *different* collision at this viewport and filed this one as
   "residual, out of scope". It is not.
2. **The verification matrix is too narrow.** Required: PL/EN × light/dark ×
   720×450, 1280×800, 1440×900, with **no occlusion of any Menu-2 element or any
   right-rail control** — for Process Flow and Whiteboard.
3. **No `:focus-visible` screenshots** and **no measured contrast** for the key
   controls. Both were recorded as NOT CAPTURED / NOT MEASURED and both are now
   required. Contrast must be computed on the **composited** background — this
   program has already published one wrong figure by measuring the wrong layer.
4. **20 modal overlays still lack dialog semantics** — listed by file and line in
   the a11y report. 58 converted; these 20 are not.
5. **Table: 5,000 rows OOMs even with an 8 GB heap.** No virtualization, no row
   cap, no import guard. Needs virtualization *or* a safe limit + import guard
   that never truncates silently.
6. **Process Flow: no node cap at all**, and mount cost is super-linear (~53 s at
   N=1,000). Needs a guardrail consistent with the sibling tools, plus whatever
   of the super-linear cost is honestly fixable.
7. **Lane delete is a silent no-op.** Must either work or refuse visibly — the
   worst defect class in this product's history is a control that looks like it
   worked and did not.

**Known and accepted limitations (not gate-4 blockers):**

8. **de/ar/jp/es** did not receive the 210 new keys. Not a regression — they had
   no entry before — but localization is not "done".
9. **Full-repo schema convergence is broken** (583 pending on one runner, 172 of
   787 failing on the other). Pre-existing, out of scope. The 1011-table database
   all runtime evidence used is a PARTIAL schema.
10. **No full-repo test run.** The E15 scope is the Idea Workspace surface only.

**Your visual acceptance (rule #7)** is still required and still cannot be given
by an agent — but it is *not* what is blocking today. Items 1-7 are. Nothing
should be submitted for acceptance until they are closed and re-verified.

## 6. Method that must continue

1. **Never trust an agent report.** This session caught: a split that did not
   compile, a vacuous sabotage that a column DEFAULT was papering over, an
   evidence document contradicting the code it described, and four defects created
   by my own three-way merges. Every one surfaced by running something, never by
   reading a summary.
2. **Attack every green before accepting it.** A test that cannot fail is not
   evidence. If a sabotage leaves the suite green, the assertion is vacuous — say
   so and fix the assertion instead of banking the pass.
3. **Compare test COUNTS, not just pass/fail.** An already-red file can lose every
   test it has and no red/green diff will notice.
4. **Real exit codes.** `cmd | tail` returns tail's status. `NODE_ENV=test`
   without `RUN_DB_TESTS=1` silently substitutes a DB mock and a suite goes green
   against nothing. Guards resolve paths relative to cwd — run them from the
   worktree root or you will chase a phantom failure (I did, once).
5. **Real CSV parsing.** Quoted cells contain commas; naive `awk -F','` has
   already published wrong numbers here.
6. **Ask "harness or product?" before fixing anything seen in a screenshot.**

## 7. Ephemeral databases left running

Two local clusters, deliberately still up for the next session:
`127.0.0.1:54329` (`ideas_qg03`) and `127.0.0.1:54331` (`ideas_e12`, 1011 tables).
Teardown commands are in `/tmp/claude-501/ideas-qg03-pg/CONNECTION.md` and
`/tmp/claude-501/ideas-e12-pg/CONNECTION.md`. Both are throwaway. Nothing outside
`/tmp` was touched and no non-local database was contacted at any point.

## 8. First command to resume

```bash
cd "/Users/piotrwisniewski/.codex/worktrees/ideas-transform/consultify" && git log --oneline -3 && git status --short && for g in check-actions check-action-coverage check-list-canon check-gestosc check-ledger-csv; do bash scripts/$g.sh >/dev/null 2>&1; echo "$g rc=$?"; done
```

Then read: this file → `20_E15_TWO_CLEAN_ROUNDS.md` →
`13_RUNTIME_GATE_EVIDENCE.md` → `03_CODEX_QUALITY_BACKLOG.md` →
`16_OPEN_RISKS_AND_LIMITATIONS.csv` (29 rows) → `19_VISUAL_CX_MATRIX.md`.
