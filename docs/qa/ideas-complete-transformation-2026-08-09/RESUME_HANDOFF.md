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
| 4 — visual + CX + a11y | **EVIDENCE COMPLETE, OWNER ACCEPTANCE PENDING** | `19_VISUAL_CX_MATRIX.md`, `14_A11Y_LOCALE_PERF_REPORT.md` |
| E15 — two clean rounds | **PASS** | `20_E15_TWO_CLEAN_ROUNDS.md` |

**Status: NOT `READY_FOR_CODEX_REVIEW` — one thing is missing, and it is not
something an agent may supply.** See §5.

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

1. **Your visual acceptance (rule #7).** I cannot give it and did not.
   `19_VISUAL_CX_MATRIX.md` plus 60+ screenshots are prepared for you to accept or
   reject. **This is the only thing blocking gate 4.** Start with:
   `screenshots/fix__table__rightpanel__1440x900__light__pl.png`,
   `screenshots/fix__{whiteboard,processflow}__zoom200reflow__720x450__light__pl.png`,
   and the `g4__*` matrix.
2. **20 modal overlays still lack dialog semantics** — listed by file and line in
   the a11y report. 58 are converted; these are not.
3. **Table has no virtualization and no row cap** — it OOMs at N=5,000 even with
   an 8 GB heap. Process Flow has no node cap either. Both P1, both reported and
   deliberately NOT attempted: they need a windowing library, which is structural.
4. **de/ar/jp/es** did not receive the 210 new keys. Not a regression — they had
   no entry before — but localization is not "done".
5. **Full-repo schema convergence is broken** (583 pending on one runner, 172 of
   787 failing on the other). Pre-existing, out of scope. The 1011-table database
   all runtime evidence used is a PARTIAL schema.
6. **No full-repo test run.** The E15 scope is the Idea Workspace surface only.

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
