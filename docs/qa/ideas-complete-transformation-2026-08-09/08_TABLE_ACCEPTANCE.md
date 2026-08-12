# E07 — Table P15 acceptance

Candidate: HEAD `deb103fcde`, base `origin/demo` @ `9d17cac114`. Canon:
`docs/standards/idea-workspace/11_SPECYFIKACJE_NARZEDZI.md`. DoD:
`docs/qa/ideas-manual-audit-2026-08-09/11_..._PROTOCOL.md` §4 E07 ("11-row portfolio/schema
persists; field wizard meets interaction budget; row/cell/header PPM works; saved views preserve
contracts; AI supported/unsupported/error/cancel durable; CSV append/update/replace and recovery
pass; no canvas metaphors/legacy dual path").

## 1. Four-state summary

| State | Result |
|---|---|
| Code exists | Yes — 60 registry actions carry `tools` including `table` (the single largest per-tool count in the registry) |
| Mounted in a real consumer | Yes for the 22 platform-module actions verified this session (see §2); pre-existing for N8.1/N8.2 |
| Executed at runtime | NOT VERIFIED |
| Persisted and read back | NOT VERIFIED |

## 2. Evidence from this program's git history and this session's own checks

- N8.1 view-menu + shared rail undo/redo/cursor (`ffcc8e00a3`), N8.2 column menu, row menu — ledger
  rows `E02-N8-VIEW-MENU`, `E02-N8.2-COLUMN-MENU`, `E02-N8-ROW-MENU`, all `final_state:
  REPAIRED_RETESTED` (verified directly in `02_EXECUTION_LEDGER.csv`).
- TB-P1-02 (field wizard) and TB-P1-03 (AI terminal states) — Program C P1, `RESUME_HANDOFF.md` §3,
  not independently re-run by this task.
- QG-02 remediation (`deb103fcde`): **22 class-(d) rows across the Table platform modules**
  (Automations, Connectors, Distribution ×2 impls, Forms, Interfaces, Sync, Sharing, Record
  Templates, Date Dependency) were wired to 22 new `table.*` registry entries. This session
  independently re-confirmed the specific `RecordTemplateManager` finding from that same
  remediation pass by grepping the live tree: `RecordTemplateManager.tsx` is referenced in exactly
  two files, itself and `src/actions/ideaActionRegistry.ts` — **zero component imports it anywhere
  in `src/`**. The two actions this component would expose are registered with real handlers but
  are unreachable from any rendered UI. This is not a stale claim; it reproduces on this exact HEAD.
- Wave 5 (`111868e07a`) commit body: "Table's 'Scoring' and 'Log decyzji' saved views were nothing
  but column presets with no model behind them — exactly the prior suspicion. Real governance
  (9-dimension scoring with versioned weights and append-only history; decision log with four
  distinct outcomes, approval gate and reopen-versioning) is now wired, flag-gated." This is a
  business-model feature (`ideaScoringGovernance.ts`, `ideaDecisionGovernance.ts`) layered onto the
  Table tool rather than a pure E07 mechanics item — cross-referenced in `09_BUSINESS_CASE_ACCEPTANCE.md`.
- Wave 4 (`4308bddb82`) fixed defect: "Table platform-mode column actions no longer mutate dead
  state while firing a green 'Column deleted' toast" — a fake-success defect found and closed.

## 3. Explicitly NOT VERIFIED for this epic

- The doc-11 §4 E07 DoD scenario (11-row portfolio schema persistence, field-wizard interaction
  budget, saved-view contract preservation, CSV append/update/replace + recovery) has not run
  against this or any SHA.
- The 22 newly-wired `table.*` platform-module actions have registry entries and real handlers
  (verified by `check-actions.sh` R1–R9 passing) but **no runtime click-through evidence** — "wired"
  here means the code path from UI to `runIdeaAction`/`TP.*` call exists, not that it was clicked
  and observed to work.
- `RecordTemplateManager` remains a confirmed dead mount — registered actions with no reachable UI
  entry point. Carried forward as an open finding, not silently dropped.

## 4. Verdict

**WIRED TO REGISTRY, DoD NOT CLOSED. One confirmed dead-mount defect (RecordTemplateManager,
re-verified this session) remains open** — same finding QG-02's remediation pass reported, not a
new regression, but still unresolved as of this HEAD. Consistent with
`00_PROGRAM_STATUS_AND_VERSION.md`'s E07 line.

---

**Re-verified at `6fec03f7a0` (stream S11-DOCS, 2026-08-12):** the
dead-mount defect this verdict names as still open is now CLOSED —
`RecordTemplateManager` is reachable from `TableToolbar`'s real "More" > Tools
menu, proven by an accessible-name test with a sabotage/restore cycle (19/19
pass). See `16_OPEN_RISKS_AND_LIMITATIONS.csv` RISK-06. Three further items
landed on this tool this wave: RISK-36 extended the row-add cap to AI add-rows
and framework-apply (previously only CSV import had it); RISK-35 raised the
row-actions kebab icon to its 3:1 contrast floor. A **new, untriaged** finding
also surfaced this wave and is NOT part of this verdict: at exactly 1280×800,
the kebab column is out of frame at rest in the true production wrapper, with
no visible scroll hint — see `19_VISUAL_CX_MATRIX.md` "PRODUCTION-SHAPE
measurement". **Verdict otherwise unchanged: WIRED TO REGISTRY, DoD NOT
CLOSED.**
