# RESUME_HANDOFF — Ideas transformation program

Rewritten **2026-08-12** (stream S11-DOCS) at the close of the multi-stream
wave. This is the single entry point. Nothing here is a PASS claim beyond what
its evidence column literally says.

## 1. Candidate identity

| | |
|---|---|
| Worktree (this reconciliation pass) | `/Users/piotrwisniewski/.codex/worktrees/ideas-streams/s6-e09` |
| Branch | `codex/ideas-s11-docs` |
| HEAD | **`6fec03f7a0`** |
| Prior handoff SHA (all 10 streams forked from here) | `edb38d6a29` — 16 commits behind HEAD |
| Base | `origin/demo` |
| Position vs `origin/demo` | **57 commits ahead, 2 behind** (see §5 for the drift and why the comparison base stays frozen) |
| Working tree | **clean** (verify with `git status --short` — expect 0 lines) |
| Pushed? | **NO.** No push, no merge to demo, no deploy. No demo or production database was ever contacted. |

Do **not** create a new branch, worktree or program session without first
reading §5's drift note. A separate worktree (`ideas-transform/consultify`,
branch `codex/ideas-transformation-20260809`) exists on disk **ahead** of
`6fec03f7a0` (at `fe2b8b7a82` as observed this session) — that is a different,
older single-thread lineage this multi-stream wave forked away from at
`edb38d6a29`; it is **NOT VERIFIED** whether that worktree's further commits
are meant to be reconciled with this one or are a separate effort. Confirm
with the owner before touching it.

## 2. Gate board

| Gate | State | Evidence |
|---|---|---|
| 1 — full type-check | not re-run this wave (documentation-only pass); last known PASS at `d31dd37bd4` | `22_CODEX_REVIEW_REPORT.md` |
| 2 — QG backlog | unchanged, **QG-01…QG-06 all RESOLVED** | `03_CODEX_QUALITY_BACKLOG.md` |
| 3 — runtime + persistence | **PASS on isolated local DB, 9/9 chains** (E09 financial case added as chain 9 this wave) | `13_RUNTIME_GATE_EVIDENCE.md` |
| 4 — visual + CX + a11y | **all measured technical blockers RESOLVED; owner acceptance is the ONLY residual** | `19_VISUAL_CX_MATRIX.md`, `21_FOCUS_AND_CONTRAST.md` |
| E15 — two clean rounds | **NOT YET RE-RUN at `6fec03f7a0`** — last recorded clean-round result is at `c5b1b6e6b9`, 16 commits behind HEAD; the owner is running the two-round regression at this SHA separately, in parallel with this documentation pass | `20_E15_TWO_CLEAN_ROUNDS.md` (historical), `24_FINAL_ACCEPTANCE.md` (placeholder for the new numbers) |

**NOT `READY_FOR_CODEX_REVIEW`.** See §4 and `24_FINAL_ACCEPTANCE.md` for
exactly what blocks it — it is narrower than it used to be.

`check-ledger-csv.sh` and `check-focus-canon.sh`: **rc=0**.
`check-actions.sh`: **rc=1** — known, documented, deliberately deferred (see §4).

## 3. What this wave closed

Sixteen commits, `edb38d6a29..6fec03f7a0`, across ten parallel stream
worktrees, integrated onto this branch. Full per-row rulings live in
`16_OPEN_RISKS_AND_LIMITATIONS.csv` (now 38 rows); the short version:

- **RISK-35 (P2, contrast)** — all four originally-measured WCAG failures
  fixed with `c-*` tokens, **plus a fifth found and fixed** (Mind Map depth-3+
  badge, light theme). This is why Gate 4 no longer has a named technical
  blocker.
- **RISK-30 (P2)** — `ActionResult.confirmed` now reports truthfully for 6/6
  bus-dispatch sites plus the lane UI-closure branch; 58 other UI-closure
  sites degrade honestly to `confirmed:false` (still no chat correction —
  see §4).
- **RISK-26 (P3)** — de/es/ar/jp translated for this program's added keys
  (445 EN / 461 PL total, corrected from the stale "210" figure).
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
  and dialog wiring. 6/6 real-DB, re-run personally by the integrator.
- **RISK-13/14/15/16/17/18** — formally A/B-verified (not merely assumed)
  as genuinely inherited pre-existing failures, three stale ledger rows
  closed in the same pass.
- **RISK-19, RISK-29** — reconciled against what is actually on disk
  (no code change needed — the CSV text had drifted from the evidence
  files). A **new, narrower** finding surfaced in the same pass: at exactly
  1280×800, the Idea Table's row-actions kebab is not in frame at rest in
  the true production wrapper, with no visible scroll hint (the container is
  genuinely scrollable — `TableWithPreviewLayout.tsx`'s inner div — just not
  discoverable without prior knowledge). **Not yet triaged into its own risk
  row** — flagged for the owner/next session, see
  `19_VISUAL_CX_MATRIX.md` "PRODUCTION-SHAPE measurement" section.
- **RISK-38 (P3, new)** — `Intl.PluralRules('jp')` silently resolves to
  `en-US` because `jp` is not a valid BCP47 subtag. Pre-existing, unrelated
  to this program's own changes, found while investigating RISK-26.

## 4. Open items, honestly stated

**Only three P1/P2-adjacent items carry forward with a real residual** (the
rest of the 38-row CSV is P2/P3 detail, mostly OPEN-and-documented rather than
blocking):

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
  this package is a **partial** schema. Two new concrete instances this wave:
  `role_change_audit_events` is created only by `initializeDatabase()`
  (conditional on `DB_MANAGED_SCHEMA`), never by a migration; and
  `organization_context_snapshots` doesn't exist at all — every idea
  create/update swallows the resulting SQL error via `.catch(warn)`.

Plus the two un-triaged findings noted in §3 (production-shape kebab at
1280×800; the `jp` plural-rules defect, now filed as RISK-38 but not fixed).

**`check-actions.sh` is rc=1**, deliberately: 3 command-verb handlers in
`FinancialCaseDialog.tsx` (save/saveAndClose/retry) are not yet traced to
`IDEA_ACTION_REGISTRY`, because the file that needs the new entry
(`src/actions/registry/sharedActions.ts`) was being actively rewritten by
stream S5 this wave and the orchestrator placed it off-limits. Prepared fix
recorded in `10_FINANCIAL_CASE_ACCEPTANCE.md` §6.9.

## 5. `origin/demo` moved during this wave — and why the comparison base does not

`origin/demo` moved **`9d17cac114` → `f3e7df565e`** (2 commits, "Slack Command
Center hardening") from a *different* session while this program's streams
were running. The branch's true position is **57 ahead, 2 behind** — not
"0 behind" as an earlier phase of this program could claim.

The comparison base for every A/B claim and every "pre-existing vs
regression" verdict in this package **stays frozen at `9d17cac114`**.
Disjointness verified directly: the 2 `origin/demo` commits touch exactly 6
files (`AIOpsReportCron.ts`, `server/src/index.ts`, `auth.routes.ts`,
`feedbackDigest.ts`, `slackRouter.ts`, `slackRouter.test.ts`). The
intersection with this session's changed files is **0**, and with the whole
program's changed files (`edb38d6a29..6fec03f7a0`, all streams) is also **0**.
A future merge to `demo` will need a genuine reconciliation of those 6 files —
but nothing in this evidence package needs to change because of the drift,
because nothing this program touched overlaps them.

## 6. Environment notes that will save you hours

- **Run `tsc` SERIALIZED.** This machine hosts several concurrent Claude
  sessions; parallel `tsc` runs have been CPU-starved to death before.
  Client then server, one at a time.
- **`git stash` is SHARED across every worktree of this repo.** Never use it
  to compare against pristine code — use `git diff > /tmp/x.patch` and
  `git apply -R`.
- **A clean `git apply` can still be wrong.** After any merge, check
  `git status` for files your program has never committed to:
  `git log --oneline <base>..HEAD -- <file> | wc -l` = 0 means it is not
  yours.
- **Ephemeral Postgres.** Two local clusters are still alive as of this
  wave: `127.0.0.1:54329` (`ideas_qg03`) and `127.0.0.1:54331` (`ideas_e12`,
  **1012 tables** as of this wave — up one from 1011 after the
  `idea_financial_cases` migration in RISK-12). Recreate with the recipe in
  `13_RUNTIME_GATE_EVIDENCE.md` §2 if they are gone. **Never demo**
  (trolley:28146), **never production** (centerbeam:37823), **never dev**
  (thomas:20221).
- **Real-DB tests need BOTH** `RUN_DB_TESTS=1` **and** `MOCK_DB=false`.
  `NODE_ENV=test` alone silently substitutes a DB mock and a suite goes
  green against nothing.
- **Guards resolve paths relative to cwd.** Run them from the worktree root.
- **`scripts/check-actions.sh` is currently rc=1**, deliberately — see §4
  before treating it as a regression to chase.

## 7. Method — this is why the numbers here can be trusted

1. **Never trust an agent report. Re-run it.** This wave caught: a stale
   grep-count evidence line whose verdict still held; a CSV row's "only
   light/pl recaptured" claim that was already contradicted by files on
   disk; a locale-key count carried forward from an earlier, narrower
   measurement.
2. **Attack every green before accepting it.** RISK-12's OCC sabotage was
   deliberately two-staged: disabling only the fast-path check left the
   suite green (correctly — the SQL layer caught it), and only disabling
   *both* layers turned it red. A green result from disabling one layer of a
   two-layer defense is not vacuous; check whether the *other* layer is
   still armed before calling it that.
3. **A scope is not a scope until the run proves it.** Applies as much to
   locale-key counts as to test files — this wave's own locale-key diff
   (478/494) did not exactly match the ruling's figure (445/461); both are
   recorded, not silently reconciled to make the numbers agree.
4. **"Known pre-existing failure" is a claim, not a fact.** RISK-13/16/17/18
   are now formally A/B-VERIFIED against `origin/demo@9d17cac114`, not
   merely carried forward as assumed.
5. **Ask "harness or product?" before fixing anything seen in a
   screenshot** — and ask it again before declaring a *matrix* current: this
   wave found that all four `g4__table__baseline__1440x900__*` cells were
   already clean on disk, while the CSV's own text still said otherwise.
6. **Never claim a gate is awaiting acceptance while your own reports
   contain open P1s or a visible collision.** That rule still holds; this
   wave's contribution is closing the last measured contrast failures so the
   claim becomes true rather than aspirational.

## 8. Document map

| File | What it is |
|---|---|
| `RESUME_HANDOFF.md` | this file — start here |
| `24_FINAL_ACCEPTANCE.md` | the Codex handoff package (numbered per doc-11 §9, filed as 24_ not 17_ — see that file for why) |
| `22_CODEX_REVIEW_REPORT.md` | the review package for Codex |
| `00_PROGRAM_STATUS_AND_VERSION.md` | gate board + dated corrections (read the tail first) |
| `03_CODEX_QUALITY_BACKLOG.md` | QG-01…QG-06 with per-item evidence |
| `13_RUNTIME_GATE_EVIDENCE.md` | migrations, E12 runtime, 9/9 persistence chains |
| `16_OPEN_RISKS_AND_LIMITATIONS.csv` | **38 rows** — the honest ledger, statuses reconciled to the code at `6fec03f7a0` |
| `19_VISUAL_CX_MATRIX.md` | visual matrix, the 24-cell re-verification, and the production-shape kebab finding |
| `20_E15_TWO_CLEAN_ROUNDS.md` | retraction **and** the corrected re-run (historical — pending a re-run at this SHA) |
| `21_FOCUS_AND_CONTRAST.md` | 40 focus captures, 87+ contrast measurements, the depth-3 closure |
| `02_EXECUTION_LEDGER.csv` | 37 rows × 20 columns, guard-validated |
| `screenshots/` | 100+ captures; `g4v3__*`/`g4v4__*` are the newest Table sets |

## 9. First commands to resume

```bash
cd "/Users/piotrwisniewski/.codex/worktrees/ideas-streams/s6-e09" && git log --oneline -3 && git status --short && git rev-list --left-right --count origin/demo...HEAD
```

```bash
cd "/Users/piotrwisniewski/.codex/worktrees/ideas-streams/s6-e09" && for g in check-actions check-ledger-csv check-focus-canon check-list-canon check-artefakt; do bash scripts/$g.sh >/dev/null 2>&1; echo "$g rc=$?"; done
```

Expected: `check-actions rc=1` (documented, §4), the rest `rc=0`.

Then read: this file → `24_FINAL_ACCEPTANCE.md` → `22_CODEX_REVIEW_REPORT.md` →
`16_OPEN_RISKS_AND_LIMITATIONS.csv` → `19_VISUAL_CX_MATRIX.md`'s
PRODUCTION-SHAPE section (the un-triaged 1280×800 finding is your first
open question).
