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
| Candidate SHA | **`6fec03f7a0`** |
| Branch | `codex/ideas-s11-docs` |
| Worktree (this reconciliation pass) | `/Users/piotrwisniewski/.codex/worktrees/ideas-streams/s6-e09` |
| Prior handoff SHA (10 parallel streams forked here) | `edb38d6a29` — 16 commits behind HEAD |
| Base | `origin/demo` — **57 commits ahead, 2 behind** (drift explained in §2) |
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
  intersection with every file this program has ever changed
  (`edb38d6a29..6fec03f7a0`, all 10 streams) is **0**. The base stays frozen
  at `9d17cac114` because moving it would invalidate every A/B verdict this
  package makes — a future merge to `demo` needs its own reconciliation of
  those 6 files, unrelated to anything below.
- **This wave's exact scope:** 16 commits, `edb38d6a29..6fec03f7a0`, listed in
  `00_PROGRAM_STATUS_AND_VERSION.md`'s "MULTI-STREAM WAVE — 2026-08-12" table.
  This documentation-reconciliation pass itself touched only
  `docs/qa/ideas-complete-transformation-2026-08-09/*` — no `src/`,
  `server/src/`, `tests/`, or `dev-render/` files.

## 3. E00–E15 closure table

Built from the epic acceptance docs (`05`–`12`, `04B`), the runtime gate
evidence (`13_`), and this wave's risk closures. Where a line says
"unchanged", the underlying acceptance doc's own SHA-sweep note (§ below)
records that it was not cheaply re-verifiable this wave and is carried
forward as history, not re-attested fresh.

| Epic | State at `6fec03f7a0` | What this wave changed, if anything |
|---|---|---|
| E00 — Candidate control and ledger | **DONE** | Ledger extended to 37 rows for this wave's work; `check-ledger-csv.sh` rc=0. |
| E01 — One Idea data model and integrity | **NOT VERIFIED** (unchanged) | Nothing this wave touched E01-level integrity proofs. |
| E02 — Action Registry | **IMPLEMENTED, QG-01 RESOLVED** (231-action split); Teresa runtime invocation still NOT VERIFIED | Registry coverage held at 231/124/7/4 all wave; RISK-30 changed *semantics* (truthful `confirmed`), not registry shape. `check-actions.sh` is currently **rc=1** — see §7. |
| E03 — Shell, navigation and ownership | **IMPLEMENTED, acceptance NOT VERIFIED** (unchanged) | No change this wave. |
| E04 — Mind Map | **WIRED TO REGISTRY, DoD NOT CLOSED** | RISK-35's depth-3 contrast fix landed (visual defect only); the 18-node-scene/cross-link/AI-proposal persistence DoD was not independently rerun. |
| E05 — Whiteboard | **WIRED TO REGISTRY, DoD NOT CLOSED** | No change this wave (WB-CLIPBOARD-01 was closed by S3-AB before this wave started). |
| E06 — Process Flow | **WIRED TO REGISTRY, DoD NOT CLOSED** | RISK-30's lane-action ack landed for this tool's `lane_frame.*` actions; RISK-31's node-cap guardrail already stood, performance stays NOT MEASURED. |
| E07 — Table P15 | **WIRED TO REGISTRY, DoD NOT CLOSED** | RISK-06 (dead mount reached), RISK-36 (row-cap extended to AI/framework add paths), RISK-35 (kebab contrast) all closed this wave. |
| E08 — Business case and decision governance | **PARTIAL; persistence now PROVEN ON ISOLATED LOCAL DB ONLY** | Its migrations (maturity gates, business case) were applied and proven under Gate 3 before this wave; unchanged this wave. Never run against demo/prod/dev. |
| E09 — Financial case | **SAVE PATH BUILT AND PERSISTENCE-VERIFIED ON ISOLATED LOCAL DB** (chain 9, 6/6) | **Closed this wave** (RISK-12). Flag `ff_ideaFinancialCase` stays default OFF; no owner browser click-through yet. |
| E10 — AI and Teresa | **OPENED, NOT CLOSED** | RISK-30 improves the truthfulness of lane-action acknowledgements Teresa relays; the epic's full behavioral DoD under a real model call is still not runtime-verified. |
| E11 — Conversion, import, export and templates | **PARTIAL** | No change this wave; its `mapping_version` migration was applied under Gate 3 before this wave (RISK-04). |
| E12 — Collaboration, security and resilience | **OPENED, materially advanced** | RISK-22 closed this wave: a UI now exists to set `confidentiality`, not just read/enforce it. Ownership-only permission-model limitation stated, not hidden. |
| E13 — Visual system and CX | **All measured technical blockers RESOLVED this wave; owner acceptance is the ONLY residual** | RISK-19/29/35 closed. One new, untriaged, narrower finding surfaced (production-shape kebab at 1280×800 — see §8). |
| E14 — Accessibility, locale, performance and observability | **OPENED, NOT FULLY CLOSED** | RISK-26 extended locale coverage to de/es/ar/jp for this program's keys (445 EN/461 PL); RISK-38 (new, pre-existing `jp` plural-rules defect) filed, not fixed. Full a11y/locale/perf matrix (doc-11 §3.8) has still not run end-to-end. |
| E15 — Final regression and evidence closure | **NOT YET RE-RUN AT THIS SHA** | Historical two-clean-rounds PASS is at `c5b1b6e6b9`, 16 commits behind HEAD. **The owner is running the two-round regression at `6fec03f7a0` now, separately — see the placeholder in §6.** |

## 4. P0–P3 totals and states

Computed directly from `16_OPEN_RISKS_AND_LIMITATIONS.csv` (38 rows, real CSV
parser, not text search) as of this wave:

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

## 5. Four scenes, business case, financial case, golden journey

- **Four scenes (Mind Map / Whiteboard / Process Flow / Table):** each WIRED
  TO REGISTRY per §3; none has an independently rerun full DoD scene-level
  acceptance this wave. See `05`–`08_*_ACCEPTANCE.md`.
- **Business case (E08):** PARTIAL, persistence proven on isolated DB only —
  see §3 and `09_BUSINESS_CASE_ACCEPTANCE.md`.
- **Financial case (E09):** save path built and proven this wave, 6/6 real-DB,
  two-stage OCC sabotage — see `10_FINANCIAL_CASE_ACCEPTANCE.md` §6–§7.
- **Golden journey (create → develop → convert, cross-tool):** **NOT
  VERIFIED** as a single end-to-end run at `6fec03f7a0`. No document in this
  package claims a full golden-journey execution at this SHA.

## 6. Automated / type-check / migration / performance / a11y results

| Area | Result | Evidence |
|---|---|---|
| Type-check (client + server) | **NOT re-run this wave** — last real PASS at `d31dd37bd4`, 16 commits behind HEAD | `22_CODEX_REVIEW_REPORT.md` §3 |
| Migrations | 6 additive migrations exist and are applied on the isolated local DB (`127.0.0.1:54331/ideas_e12`, **1012 tables**): maturity gates, business case, conversion mapping-version, confidentiality (all pre-wave), plus `idea_financial_cases` (this wave) | `13_RUNTIME_GATE_EVIDENCE.md` |
| E15 two clean rounds | **PLACEHOLDER — NOT YET RUN AT `6fec03f7a0`.** Historical result: 208 files / 1239 tests, two identical clean rounds, at `c5b1b6e6b9`. The owner is running this at the current SHA separately from this documentation pass and will supply the numbers; this line must be filled in before any `READY_FOR_CODEX_REVIEW` recommendation. | `20_E15_TWO_CLEAN_ROUNDS.md` (historical), owner to supply |
| Performance | **NOT MEASURED**, literally, for both open perf items (Process Flow node-cap speed, Table row-cap at N≥5,000) — owner's explicit decision given the measurement machine's non-Consultify load (84–832 load average from Teams/WindowServer/syspolicyd/xattr sweep/fileproviderd) | `17_PERFORMANCE_MEASUREMENT.md`, RISK-31/RISK-36 in the CSV |
| Accessibility (contrast + focus) | **RESOLVED** — 5/5 measured WCAG contrast failures fixed (RISK-35); focus-visible rings present on canvas nodes; 2 P0 keyboard defects fixed pre-wave | `21_FOCUS_AND_CONTRAST.md` |
| Locale | de/es/ar/jp now carry this program's added keys (RISK-26); ~3,710 pre-existing missing keys in those locales remain, out of scope; `jp` plural-rules defect newly filed as RISK-38, not fixed | `16_OPEN_RISKS_AND_LIMITATIONS.csv` RISK-26/RISK-38 |

## 7. Guard results (real exit codes, captured bare)

```
bash scripts/check-ledger-csv.sh; echo rc=$?      → rc=0
bash scripts/check-focus-canon.sh; echo rc=$?     → rc=0
bash scripts/check-actions.sh; echo rc=$?         → rc=1  (documented, deliberate — see below)
```

`check-gestosc.sh` was **not run** — this wave changed no `src/` files, so
running it with zero arguments would check zero files and report a false
pass, not a real one; it is correctly omitted rather than faked.

`check-actions.sh` rc=1 is a known, pre-existing-within-this-wave condition:
3 command-verb handlers in `FinancialCaseDialog.tsx` (`save`/`saveAndClose`/
retry) are not yet traced to `IDEA_ACTION_REGISTRY`. The fix requires an entry
in `src/actions/registry/sharedActions.ts`, a file stream S5 was actively
rewriting this wave; the orchestrator placed it off-limits to avoid a
collision. A prepared fix is recorded in `10_FINANCIAL_CASE_ACCEPTANCE.md`
§6.9 for whoever lands after S5.

## 8. Unresolved risks and external blockers

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
- **External/owner blockers:** the owner's visual acceptance (rule #7, no
  agent may substitute for it) and the E15 re-run (§6) are the only items
  this package cannot close by itself.

## 9. Evidence and ledger paths

- `16_OPEN_RISKS_AND_LIMITATIONS.csv` — 38 rows, 7 columns, the honest risk
  register.
- `02_EXECUTION_LEDGER.csv` — 37 rows, 20 columns, `check-ledger-csv.sh` rc=0.
- `13_RUNTIME_GATE_EVIDENCE.md` — 9 persistence chains.
- `19_VISUAL_CX_MATRIX.md`, `21_FOCUS_AND_CONTRAST.md` — visual/CX/contrast
  evidence.
- `10_FINANCIAL_CASE_ACCEPTANCE.md` — E09's full history through this wave's
  closure.
- `screenshots/` — 100+ captures, newest sets `g4v3__table__*` /
  `g4v4__table-production__*`.

## 10. Recommendation

# **`NOT_READY`**

The single named residual that blocks a `READY_FOR_CODEX_REVIEW`
recommendation is the **owner's visual acceptance**, which no agent may
substitute for (project rule #7) — every measured technical blocker to Gate 4
is closed as of this wave. The **E15 two-clean-rounds re-run at `6fec03f7a0`**
is the second, mechanical gap: it has not happened at this exact SHA yet; the
owner is running it now and will supply the numbers.

**>>> PLACEHOLDER — E15 TWO-ROUND RESULTS AT `6fec03f7a0` GO HERE <<<**
**>>> Filled in by the owner after this documentation pass; do not treat this **
**>>> file as final, and do not infer a PASS from its absence, until that **
**>>> placeholder is replaced with real numbers. <<<**

Once (a) the owner has reviewed the Gate-4 evidence and signed off, and
(b) the placeholder above carries a real two-clean-rounds result for
`6fec03f7a0`, this file's recommendation should be revisited — not
auto-flipped to `READY_FOR_CODEX_REVIEW` by whoever fills in the placeholder,
but re-decided against the actual numbers.
