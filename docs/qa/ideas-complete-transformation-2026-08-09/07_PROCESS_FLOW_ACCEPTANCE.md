# E06 — Process Flow acceptance

Candidate: HEAD `deb103fcde`, base `origin/demo` @ `9d17cac114`. Canon:
`docs/standards/idea-workspace/11_SPECYFIKACJE_NARZEDZI.md`. DoD:
`docs/qa/ideas-manual-audit-2026-08-09/11_..._PROTOCOL.md` §4 E06 ("complaint scene with
lanes/Yes-No/correction loop persists; one creation path; immediate lane naming; editable/
deletable edges; initial `Not validated`; Fit works from 25–300%; Insert/Split availability is
context-correct").

## 1. Four-state summary

| State | Result |
|---|---|
| Code exists | Yes — 43 registry actions carry `tools` including `process_flow` |
| Mounted in a real consumer | Yes — N6.1 edge menu, N6.2 node menu + floating toolbar, N6.3 canvas menu + lane controls (commits `9182ae70cd`, `3a6ea7cd51`, `915c458485`) |
| Executed at runtime | NOT VERIFIED |
| Persisted and read back | NOT VERIFIED |

## 2. Evidence from this program's git history

- N6.1–N6.4 landed across dedicated commits: edge menu, node menu + floating toolbar, canvas menu +
  lane controls, and (per `00_PROGRAM_STATUS_AND_VERSION.md`'s E07 epic table cross-reference and
  the ledger rows `E02-N6.4-MODE`/`E02-N6.4-OVERFLOW`) mode/overflow handling — both ledger rows
  read `final_state: REPAIRED_RETESTED`, verified directly in `02_EXECUTION_LEDGER.csv` by this
  task.
- Program C (Wave 3/4/5): "Process Flow creation-surface dedup + lane naming" (Program C P2, per
  `RESUME_HANDOFF.md` §3) and "PF convert-wrong-target" defect fixed (00_PROGRAM_STATUS Program C
  row).
- `idea.view.pf_add_start` (verified in `04_ACTION_COVERAGE_INVENTORY.csv` QG-02 remediation table
  and cross-checked in `15_ALL_ACTIONS_INVENTORY.csv`): a genuine mechanism-mismatch finding, not a
  reuse — `idea.element.add`'s Process Flow runtime hardcodes shape `'action'`, but the empty-state
  CTA adds a `'start'`/`'vsm_process'` node, so a distinct id was registered instead of forcing a
  false reuse.
- Wave 5 (`111868e07a`) commit body, quoted directly in `00_PROGRAM_STATUS_AND_VERSION.md`'s E06
  row: "a real lane-resize-undo bug found and fixed in Wave 5, a lane-delete-silent-no-op bug found
  and left documented, not fixed." **This second item is a real, open, named defect** — a
  lane-delete operation silently no-ops instead of either deleting or refusing with a reason. Not
  independently reproduced by this task (no runtime session); recorded here because it is the kind
  of "fake enabled action" doc 11's hard-visual-FAIL list explicitly forbids and it has not been
  closed anywhere in this program's history.

## 3. Explicitly NOT VERIFIED for this epic

- The doc-11 §4 E06 DoD scenario (complaint scene with lanes/Yes-No/correction loop, one creation
  path, immediate lane naming, editable/deletable edges, initial `Not validated`, Fit 25–300%,
  context-correct Insert/Split) has not run against this or any SHA.
- The lane-delete-silent-no-op defect above is unresolved and would very likely fail Pass B of the
  doc-11 acceptance matrix if it were run.

## 4. Verdict

**WIRED TO REGISTRY, DoD NOT CLOSED, one known open defect (lane-delete silent no-op) carried
forward undisguised.** Consistent with `00_PROGRAM_STATUS_AND_VERSION.md`'s E06 line; this report
adds the ledger cross-reference and restates the lane-delete defect as a named, unresolved risk
rather than letting it fade from view between program documents.
