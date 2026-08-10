# RESUME_HANDOFF — Ideas transformation program

Rewritten 2026-08-10 for a fresh session. Supersedes the earlier handoff (which
described HEAD `4308bddb82`). Nothing here is a PASS claim beyond what the
evidence column literally says.

## 1. Candidate identity

| | |
|---|---|
| Worktree | `/Users/piotrwisniewski/.codex/worktrees/ideas-transform/consultify` |
| Branch | `codex/ideas-transformation-20260809` |
| HEAD | `deb103fcde6e53f2d20d330535c66051ae6c6e14` (`deb103fcde`) |
| Base | `origin/demo` @ `9d17cac114` |
| Position | **25 commits ahead of `origin/demo`, 0 behind** |
| Working tree | **clean** |
| Pushed? | **NO.** No push, no merge to demo, no deploy, ever. |

Do NOT create a new branch, worktree or program session. Continue in place.

## 2. IN FLIGHT — a 7-agent wave was running when this was written

Workflow run id `wf_b40831de-458` (task id `w63kd3jjd`), launched from HEAD
`deb103fcde`. Its agents worked in isolated worktrees under
`<repo>/.claude/worktrees/wf_b40831de-458-*`. **None of it is merged.**

Streams: QG-01 registry split · E12 server-side authz verification · E13
visual/CX matrix · E14 a11y/locale/perf · evidence-package assembly · then a
dependent chain: runtime env setup (isolated DB + 4 migrations) → runtime
acceptance execution.

**To pick it up:** check whether those worktrees contain work
(`git -C <wt> status --short`, `git -C <wt> diff HEAD`). If they do, merge the
way this program has throughout: export each diff, `git apply -3` onto this
branch, resolve conflicts additively, then **independently re-verify** — do not
trust agent reports (two overclaims were caught exactly this way; see §6). If a
worktree is empty, that stream died — re-dispatch it. Resume is also possible via
`Workflow({scriptPath: ".../wave8-qg01-runtime-acceptance-wf_b40831de-458.js", resumeFromRunId: "wf_b40831de-458"})`.

## 3. Gate status

| Gate | State | Evidence |
|---|---|---|
| **1 — full type-check** | **PASS** | `npm run type-check` **exit 0, 0 errors, 119 s**, captured bare (no pipe). All 26 original errors fixed by modelling, not silencing. |
| **2 — QG backlog** | QG-02/04/05/06 **RESOLVED**; **QG-01 NOT DONE** (in flight); QG-03 **NOT DONE** | see §4 |
| **3 — runtime + persistence** | **NOT VERIFIED** | never executed; four migrations unapplied |
| **4 — visual + CX matrix** | **NOT VERIFIED** | in flight (E13/E14) |

All five repo guards **rc=0** at HEAD: `check-actions` (231 actions / 124
runtime strings / 7 events / 4 API methods), `check-action-coverage` (baseline
188 violations / 89 files, regenerated only after remediation landed),
`check-list-canon`, `check-gestosc`, `check-ledger-csv` (23 rows × exactly 20
columns).

## 4. What is genuinely DONE (committed, orchestrator-verified)

- **E00** candidate control; forward-port off `origin/demo` via a real 3-way merge.
- **Program A** baseline: four-scene readback + screenshots, canon/decision
  register, repo-wide dev-render harness repaired.
- **Program B / E02**: the action registry now drives all four tools' menus,
  toolbars, rails and keyboard hooks — **231 actions**. The R10 machine check
  (the DoD's "detects unregistered commands") exists, binds, and was proven by
  negative control.
- **QG-02 RESOLVED**: the 264-construct inventory is fully accounted —
  a=76, b=152, **c=0, d=0, resolved=36** — every resolved row verified twice by
  the orchestrator (id exists in the registry AND the cited component actually
  references it).
- **Program C**: all P1, P2 and P3 items from the audit plan.
- Real defects found and fixed: Whiteboard had no object clipboard (Ctrl+C/V did
  literally nothing); insertion overlap; Mind Map duplicate sibling editor;
  Process Flow convert targeted the wrong node; Mind Map line-style showed
  success but never changed anything; canvas undo missed drawn strokes; Table
  platform-mode column actions fired a green "Column deleted" toast over a no-op.
- **E08/E09/E10/E11/E12/E13/E14 opened** with real implementation — but none are
  runtime-verified.

## 5. BLOCKED / NOT VERIFIED — read before claiming anything

**BLOCKED (owner decision) — FOUR migrations written, committed, NEVER APPLIED:**
```
server/migrations/20260810_idea_maturity_gates.sql
server/migrations/20260810_idea_business_case.sql
server/migrations/20260810_idea_conversion_mapping_version.sql
server/migrations/20260810_idea_confidentiality.sql
```
(`20260810_t01_*` in the same directory belong to a different program — not ours.)
Additive by construction; nothing was ever run against any database. Until an
isolated-DB run proves them, **all persistence they enable is EVIDENCE_MISSING**.

**NOT VERIFIED — runtime, persistence, visual/CX.** No exact-SHA runtime
evidence, no cold-reopen readback, no completed acceptance matrix. Doc 11's
acceptance matrix is therefore **not** satisfied.

**Known open defect, reported not hidden:** `RecordTemplateManager` /
`TemplateDropdown` are rendered nowhere in the live app — their two registered
actions have working handlers but are unreachable from any UI.

**NOT `READY_FOR_CODEX_REVIEW`.** Do not declare it until gates 3 and 4 pass and
E15's two clean rounds are done.

## 6. Method that must continue — this is why the program is trustworthy

1. **Never trust an agent report.** Two overclaims were caught by re-verifying:
   (a) an entire 22-action stream silently failed to apply while `git apply -3`
   printed optimistic per-file messages — caught by checking the ids actually
   existed in the registry; (b) QG-02 was marked RESOLVED with "individually
   re-verified" while 4 rows had a registry entry but no call-site wiring —
   caught by asserting BOTH conditions per row.
2. **Real exit codes.** `npm run type-check | tail` reports *tail's* status.
   Always capture the command's own exit code.
3. **Real CSV parsing.** The inventory and ledger have quoted cells containing
   commas; naive `awk -F','` already produced published-wrong numbers once.
4. **Guards are never bypassed.** They caught real dead code and a raw-`<table>`
   canon violation. The single `--no-verify` used mid-session was documented in
   the commit body and cleared in the next commit.
5. **A/B against a throwaway worktree** at the pre-merge SHA to separate
   pre-existing failures from regressions.

**Known PRE-EXISTING test failures — never "fix" blind, never report as yours:**
i18n raw-key mocks (`dp5HeuristicAiGating`, `canvasLeftToolbar`,
`useTableSchema`/`useTableViews` "t is not a function"); roving-tabindex gaps in
the shared `CanvasContextMenu`; ~10 `ProcessFlowToolbar` AI-panel-trigger;
`AITableProposal`; `TablePlatformFrontend` "AI Table Builder";
`RowDetailPanel.comments`.

## 7. Remaining work, in the owner's required order

1. Merge/complete the in-flight wave (§2).
2. **QG-01** — split the 9,000-line registry: identical before/after id list,
   byte-identical Teresa manifest, no circular imports, guard still binds.
3. **QG-03 / Gate 3** — isolated local DB, apply the four migrations, verify the
   schema via `information_schema` (**not** the migration runner's own report —
   its `--safe` mode reports a failure as "skipped" with exit 0), then per tool
   and per Wave 4/5 feature: save → refresh → **cold reopen** → readback,
   confirmed with a DB query. Never demo, never production.
4. **Gate 4** — visual/CX + a11y matrices with indexed, SHA-stamped evidence.
5. **E15** — two consecutive clean rounds with no new P0/P1, the evidence package
   completed per master program §16, then and only then the Codex handoff.

## 8. First command to resume

```bash
cd "/Users/piotrwisniewski/.codex/worktrees/ideas-transform/consultify" && git log --oneline -3 && git status --short && for g in check-actions check-action-coverage check-list-canon check-gestosc check-ledger-csv; do bash scripts/$g.sh >/dev/null 2>&1; echo "$g rc=$?"; done
```

Then read, in order: this file → `03_CODEX_QUALITY_BACKLOG.md` →
`00_PROGRAM_STATUS_AND_VERSION.md` → `02_EXECUTION_LEDGER.csv` →
`04_ACTION_COVERAGE_INVENTORY.csv`, and check the in-flight worktrees from §2.
