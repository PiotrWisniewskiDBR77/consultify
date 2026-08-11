# RESUME_HANDOFF — Ideas transformation program

Rewritten **2026-08-11** at the close of the Gate-4 fix wave. This is the single
entry point. Nothing here is a PASS claim beyond what its evidence column
literally says.

## 1. Candidate identity

| | |
|---|---|
| Worktree | `/Users/piotrwisniewski/.codex/worktrees/ideas-transform/consultify` |
| Branch | `codex/ideas-transformation-20260809` |
| HEAD | **`d31dd37bd4`** |
| Base | `origin/demo` @ `9d17cac114` |
| Position | **40 commits ahead, 0 behind** |
| Working tree | **clean** (verify with `git status --short` — expect 0 lines) |
| Pushed? | **NO.** No push, no merge to demo, no deploy. No demo or production database was ever contacted. |

Do **not** create a new branch, worktree or program session. Continue in place.

## 2. Gate board

| Gate | State | Evidence |
|---|---|---|
| 1 — full type-check | **PASS** | client `tsc` exit 0 / 0 errors, server `tsc` exit 0 / 0 errors — run **serialized** |
| 2 — QG backlog | **QG-01…QG-06 all RESOLVED** | `03_CODEX_QUALITY_BACKLOG.md` |
| 3 — runtime + persistence | **PASS on isolated local DB, 8/8 chains** | `13_RUNTIME_GATE_EVIDENCE.md` |
| 4 — visual + CX + a11y | **FIX_REQUIRED** | `19_VISUAL_CX_MATRIX.md`, `21_FOCUS_AND_CONTRAST.md` |
| E15 — two clean rounds | **PASS on the corrected 208-file scope** | `20_E15_TWO_CLEAN_ROUNDS.md` (RE-RUN section) |

**NOT `READY_FOR_CODEX_REVIEW`.** See §4 for exactly what blocks it.

All seven guards **rc=0**: `check-actions`, `check-action-coverage`,
`check-list-canon`, `check-gestosc`, `check-ledger-csv`, `check-artefakt`,
`check-focus-canon`.

## 3. What the next session must do — in this order

### 3.1 Close Gate 4 (the only thing between here and Codex review)

**Three measured contrast failures (RISK-35, P2).** Measured on the composited
background, cross-checked by pixel sampling — these are real numbers, not
estimates:

| Control | Measured | Required |
|---|---|---|
| Idea Table row-actions kebab icon (light) | **1.93:1** | 3:1 (UI component) |
| Idea Table row-actions kebab icon (dark) | **1.61:1** | 3:1 |
| Mind Map dark "L2" node badge | **3.22:1** | 4.5:1 (text) |
| Process Flow light "Klient" swimlane label | **4.43:1** | 4.5:1 (hairline miss) |

Full table and method: `21_FOCUS_AND_CONTRAST.md`. Fix with `c-*` tokens.
**Never `primary-<n>` — every number of it is crimson `#85182F`, reserved for
critical semantics.**

Then re-capture the affected cells, look at them yourself, and only then ask
Piotr for acceptance.

### 3.2 The acceptance ask itself

Rule #7 is inviolable: Piotr must never be the first person to see a screen.
Everything is prepared — 100+ screenshots, a 24-cell matrix, 40 focus captures,
before/after shots. **But do not ask for acceptance while any P1 or any visible
collision remains in this program's own reports or images.** That rule exists
because I broke it on 2026-08-10 and the owner caught it (see §6).

### 3.3 Then, and only then, the Codex handoff

`22_CODEX_REVIEW_REPORT.md` is written and current as of `d31dd37bd4`. Re-verify
its numbers against the code before sending — it will be stale the moment
anything else lands.

## 4. Open items, honestly stated

**19 of 37 risk rows are open. Exactly ONE is P0/P1:**

- **RISK-12 (P1) — E09 financial case has NO SAVE PATH AT ALL.** Verdict (c),
  proven: the dialog mounts without `onCaseChange`, no route exists, no migration
  exists, no table exists in the live DB, and a test pins the absence (adds a
  driver, closes, reopens, asserts it is gone and `fetch` was never called).
  **The user's work is silently discarded.** Blast radius is limited: the flag
  `isIdeaFinancialCaseEnabled()` defaults OFF, and it is a real flag, not a
  phantom. Closing it is a **feature** and needs Piotr's decision — the gap is
  sized in `10_FINANCIAL_CASE_ACCEPTANCE.md`, deliberately not built.

The rest are P2/P3. The ones a successor should know about:

- **RISK-30 (P2)** — `runLaneParamCallback` returns `{ok:true}` unconditionally,
  so Teresa can still report success for a lane action that was refused. The
  human-visible defect is fixed (a toast fires); Teresa's own reply is not.
  Needs a synchronous ack from the quick-action bus — an architecture change.
- **RISK-31 (P2 part)** — Process Flow's perf fix is a **code-level argument
  only**. The post-fix benchmark never completed at N≥500 under machine load.
  Do not describe it as an improvement without an after-number.
- **RISK-36 (P2 part)** — Table's cap bounds *rendering*. Only CSV import has its
  own guard; AI add-rows, framework apply and duplicate can still inflate the
  data set without telling the user. N=5,000/10,000 post-fix: NOT MEASURED.
- **RISK-24 (P2)** — full-repo schema convergence is broken by both runners. The
  1011-table DB behind every runtime claim is a **partial** schema.
- **RISK-26 (P3)** — de/ar/jp/es never received the 210 new locale keys.

## 5. Environment notes that will save you hours

- **Run `tsc` SERIALIZED.** This machine hosts several concurrent Claude sessions;
  three parallel `tsc` runs in this session were CPU-starved to death (0% CPU for
  8+ minutes). Client then server, one at a time.
- **`git stash` is SHARED across every worktree of this repo.** It pulled another
  session's WIP into this worktree twice on 2026-08-11. Never use it to compare
  against pristine code — use `git diff > /tmp/x.patch` and `git apply -R`.
  Backups of the foreign WIP that landed here:
  `/private/tmp/consultify-ideas-foreign-wip-backup/` (9 files). The owning
  session's stash entry was left untouched.
- **A clean `git apply` can still be wrong.** Three foreign files applied with
  **zero conflicts** and were only caught later by the server type-check naming
  them. After any merge, check `git status` for files your program has never
  committed to: `git log --oneline <base>..HEAD -- <file> | wc -l` = 0 means it
  is not yours.
- **Ephemeral Postgres.** Two local clusters were left running:
  `127.0.0.1:54329` (`ideas_qg03`) and `127.0.0.1:54331` (`ideas_e12`,
  1011 tables). After 24h they are probably gone. Recreate with the recipe in
  `13_RUNTIME_GATE_EVIDENCE.md` §2 (`LC_ALL=C`, short socket dir via `-k`,
  `node tests/acceptance/schema.mjs` for the full schema). Teardown commands:
  `/tmp/claude-501/ideas-{qg03,e12}-pg/CONNECTION.md`. **Never demo
  (trolley:28146), never production (centerbeam:37823), never dev
  (thomas:20221).**
- **Real-DB tests need BOTH** `RUN_DB_TESTS=1` **and** `MOCK_DB=false`.
  `NODE_ENV=test` alone silently substitutes a DB mock and a suite goes green
  against nothing.
- **Guards resolve paths relative to cwd.** Run them from the worktree root or
  you will chase a phantom failure.

## 6. Method — this is why the numbers here can be trusted

1. **Never trust an agent report.** Re-run it. This session caught: a registry
   split that did not compile, a vacuous sabotage a column `DEFAULT` was papering
   over, an evidence document contradicting the code it described, four defects
   created by my own three-way merges, and a stream reporting a regression as
   "pre-existing" when it was not.
2. **Attack every green before accepting it.** A test that cannot fail is not
   evidence. If a sabotage leaves the suite green, the *assertion* is vacuous —
   say so and fix the assertion rather than banking the pass.
3. **Compare test COUNTS per file, not just pass/fail.** An already-red file can
   silently lose every test it has.
4. **A scope is not a scope until the run proves it.** Assert the file count and
   assert a named file you expect is present. I got this wrong: a quoted glob
   passed to vitest matched **zero** files, 59 of 208 never ran, and a regression
   from this program's first commit hid there for weeks.
5. **"Known pre-existing failure" is a claim, not a fact.** One item on that list
   turned out to be this program's own regression, and its place on the list is
   exactly what stopped anyone bisecting it. **Any item never A/B'd against
   `origin/demo` is unverified, not inherited.**
6. **Ask "harness or product?" before fixing anything seen in a screenshot.** A
   P1 filed against a production layout was a dev-render composition the product
   never uses.
7. **Never claim a gate is awaiting acceptance while your own reports contain
   open P1s or a visible collision.** Naming a defect in a subordinate clause
   does not discharge it.

## 7. Document map

| File | What it is |
|---|---|
| `RESUME_HANDOFF.md` | this file — start here |
| `22_CODEX_REVIEW_REPORT.md` | the review package for Codex |
| `00_PROGRAM_STATUS_AND_VERSION.md` | gate board + dated corrections (read the tail first) |
| `03_CODEX_QUALITY_BACKLOG.md` | QG-01…QG-06 with per-item evidence |
| `13_RUNTIME_GATE_EVIDENCE.md` | migrations, E12 runtime, 8/8 persistence chains |
| `16_OPEN_RISKS_AND_LIMITATIONS.csv` | **37 rows** — the honest ledger, statuses match the code at `d31dd37bd4` |
| `19_VISUAL_CX_MATRIX.md` | visual matrix + the 24-cell re-verification |
| `20_E15_TWO_CLEAN_ROUNDS.md` | retraction **and** the corrected re-run |
| `21_FOCUS_AND_CONTRAST.md` | 40 focus captures, 87 contrast measurements |
| `02_EXECUTION_LEDGER.csv` | 28 rows × 20 columns, guard-validated |
| `screenshots/` | 100+ captures; `g4v2__*` is the current matrix, `fix__*` the before/afters |

## 8. First commands to resume

```bash
cd "/Users/piotrwisniewski/.codex/worktrees/ideas-transform/consultify" && git log --oneline -3 && git status --short && git rev-list --left-right --count origin/demo...HEAD
```

```bash
cd "/Users/piotrwisniewski/.codex/worktrees/ideas-transform/consultify" && for g in check-actions check-action-coverage check-list-canon check-gestosc check-ledger-csv check-artefakt check-focus-canon; do bash scripts/$g.sh >/dev/null 2>&1; echo "$g rc=$?"; done
```

Then read: this file → `22_CODEX_REVIEW_REPORT.md` →
`16_OPEN_RISKS_AND_LIMITATIONS.csv` → `21_FOCUS_AND_CONTRAST.md` (the contrast
table is your first task).
