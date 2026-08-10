# E05 — Whiteboard acceptance

Candidate: HEAD `deb103fcde`, base `origin/demo` @ `9d17cac114`. Canon:
`docs/standards/idea-workspace/11_SPECYFIKACJE_NARZEDZI.md`. DoD:
`docs/qa/ideas-manual-audit-2026-08-09/11_..._PROTOCOL.md` §4 E05 ("12 mixed inserts have no
complete overlap; immediate naming; three clusters/four links/freehand/group/lock/layer persist;
workshop state honest; default labels trigger AI coaching; connector PPM and real object
copy/paste work").

## 1. Four-state summary

| State | Result |
|---|---|
| Code exists | Yes — 55 registry actions carry `tools` including `whiteboard` |
| Mounted in a real consumer | Yes — edge PPM, secondary toolbar, node/pane context menu, Teresa-parity gap closure (commits `7b0604cd80`, `c083518a11`, `f62ad27864`, `43fb54eb4c`) |
| Executed at runtime | NOT VERIFIED |
| Persisted and read back | NOT VERIFIED |

## 2. Evidence from this program's git history

- Registry wiring landed across 4 commits (E02 pilot + follow-ups): edge PPM, secondary toolbar,
  node/pane context menu, and a dedicated commit closing a documented Teresa-parity gap for edge
  actions (`43fb54eb4c` — the pilot commit `7b0604cd80` itself recorded that the 5 wired edge
  actions were "a thin passthrough to the original prop-callback" and that "Teresa CANNOT invoke
  these 5 actions yet" until a real bus receiver existed; `43fb54eb4c` is the commit that closed
  that specific follow-up).
- **WB-CLIPBOARD-01** (real object clipboard) — landed in Wave 5, commit `80dfde5e05` per the
  00_PROGRAM_STATUS reconciliation table. The ledger row for this requirement
  (`02_EXECUTION_LEDGER.csv`, `WB-CLIPBOARD-01`, epic `E05`) still reads `final_state:
  NOT_VERIFIED` — verified directly in the CSV by this task. The ledger's own explanation (embedded
  in `00_PROGRAM_STATUS_AND_VERSION.md`'s E05 row) is that this ledger row documents the *pre-fix*
  baseline finding and was not updated after the later fix landed, because its `candidate_sha` was
  already a real SHA rather than a placeholder needing QG-06 reconciliation. **This is a real,
  named gap in the delivery package's own bookkeeping**, carried forward here rather than silently
  resolved: the fix commit exists, but the ledger row that should track its acceptance state has
  not been re-verified or updated to reflect it.
- WB-P1-02 (placement service) and WB-P1-04 (keyboard drawing) — listed in `RESUME_HANDOFF.md` §3
  as DONE per Program C P1, not independently re-run by this task.
- Wave 4 (`4308bddb82`): "canvas-level undo now covers drawn strokes (two-undo-stack ownership
  resolved, not patched around)" and "Whiteboard frame context menu + legacy regex intent-detector
  reconciliation" — both commit-body claims, not independently re-verified here.
- `WB-I18N-01` (ledger row, epic E13 not E05, but Whiteboard-surfaced): the raw i18n key
  `myWork.whiteboard.toolbarExtra.insert` finding from Program A's baseline — ledger `final_state:
  NOT_VERIFIED`. Not re-checked by this task; flagged here because it visibly affects the
  Whiteboard Menu 3 surface.

## 3. Explicitly NOT VERIFIED for this epic

- The doc-11 §4 E05 DoD scenario (12 mixed inserts, three clusters/four links/freehand/group/
  lock/layer persistence, AI coaching on default labels, real connector PPM + object copy/paste as
  an end-to-end user flow) has not run against this or any SHA.
- No server-persistence or cold-reopen evidence for any Whiteboard mutation.

## 4. Verdict

**WIRED TO REGISTRY, WB-CLIPBOARD-01 code-landed but its own ledger row still reads NOT_VERIFIED
(unreconciled bookkeeping gap), DoD NOT CLOSED.** Consistent with, and adding one concrete
follow-up item beyond, `00_PROGRAM_STATUS_AND_VERSION.md`'s E05 line.
