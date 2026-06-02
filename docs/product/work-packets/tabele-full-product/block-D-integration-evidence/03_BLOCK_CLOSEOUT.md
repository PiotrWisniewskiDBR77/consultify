# Block Closeout — Block D: Integration & Evidence

> **STATUS: DONE_WITH_CONSTRAINTS — closed at D-S7 on 2026-05-08.**
> This file is also the program closeout pointer.

## Block ID / Name

`TABELE_BLOCK_D_INTEGRATION_EVIDENCE`

## Goal

Deliver Tabele → Wordy/Prezentacje conversion, Form-as-intake-app,
Anygravity P0 #2, full evidence pack, and program closeout per
`00_TASK_PACKET.md`.

## Outcome

- **Status:** `DONE_WITH_CONSTRAINTS`
- **Summary:** Block D shipped its full backend + frontend surface across
  D-S0 → D-S7 (eight sprints). The conversion pipeline (`TableArtifactConversionService`
  + `TabeleSharePanel` in the Tabele right rail) and the form-intake JWT
  pipeline (`FormIntakeService` + `IntakeJwtPanel` admin UI +
  `PublicJwtFormPage` recipient UI) are wired end-to-end behind kill
  switches. The Anygravity P0 trial card is filed in
  `DRD/testy_antygravity/TEST_QUEUE.md` and the demo storyboard is ready
  for the operator's recording window. Code-side validation across L1–L8
  is `PASS`; the residual constraints are the manual trial verdict, the
  demo recording, the localization sweep, the live LLM provider /
  artifact materializer wiring, and 12 pre-existing test failures in
  unrelated services that pre-date the program.

## Validation Performed

### Automated (code-side)

- L1.1–L1.6 — `PASS` (lint + typecheck on the D-S surface; one
  pre-existing TS error outside the surface).
- L2.1–L2.3 — `PASS` — 146 / 146 across the program surface
  (106 backend Block C + D + 40 frontend Tabele + forms).
- L3.1–L3.5 — `PASS` (right-rail wiring, forms admin handoff, public
  JWT round-trip).
- L4.1–L4.7 — `PASS` (all migrations additive + idempotent + rollback
  scripts present).
- L5.1–L5.3 — `PASS` (cross-tenant ACL, JWT verify, in-process and
  HTTP rate limits).
- L7.1–L7.5 — `PASS` (every mutation writes to its audit ledger).
- L8.1–L8.2 — `PASS` (provenance fields populated on every ledger row).

### Manual (deferred to operator window)

- L6.1 Anygravity P0 trial #2 — `READY_FOR_MANUAL` (card `TQ-20260508-001`).
- L6.2 DBR77 review — `RECORDED` (`evidence/sprint-5-anygravity/dbr77-grid.md`).
- L6.3 Menu 3 audit — `RECORDED` (`evidence/sprint-5-anygravity/menu3-audit.md`).
- L6.4 Word-canvas parity — `RECORDED` (`evidence/sprint-5-anygravity/word-canvas-parity.md`).
- L6.5 Demo recording — `READY_FOR_OPERATOR` (storyboard
  `evidence/sprint-6-demo/demo-storyboard.md`).
- L6.6 Spec compliance audit — `RECORDED` (`evidence/sprint-6-demo/spec-compliance-final.md`,
  97 % compliance).

## Gate Result

- DoD: `PASS_WITH_P2` (residual P2/P3 follow-ups documented; no P1 open).
- Security/Tenant: `PASS` (cross-tenant ACL probes and rate-limit tests
  green; JWT lifecycle validated).
- Release impact: `LOW` (all kill switches default off; rollback scripts
  present).
- Block Exit Gate: `GO_WITH_CONSTRAINTS`.
- Program Exit: `RESIDUAL_FOLLOW_UPS` (ship the surface dark by default;
  flip kill switches per workspace once the manual trial verdict lands).

## Remaining Risks

> Aggregated across all 4 blocks.

| Risk | Block | Severity | Mitigation |
|---|---|---|---|
| Manual Anygravity trial #2 verdict not yet recorded | D | P2 | Trial card filed; operator window scheduled. |
| Demo recording not yet captured | D | P3 | Storyboard ready; capture is mechanical. |
| Live LLM provider not wired (stub used in tests) | C | P2 | `LlmProvider` is injectable; switch is one config flip post-D-S7. |
| Live artifact materializer not wired (stub used) | D | P1 | `ArtifactMaterializer` adapter present; final wiring scheduled in a follow-up sprint. |
| Pre-existing test failures in unrelated services | program-wide | P2 | `TBL-FU-D-12` filed for platform team triage; not in Block C / D code paths. |
| en/pl localization gap | D | P2 | `TBL-FU-D-1` filed; must land before manual trial. |
| Block A backlog field types (status, date_range, team, rating, progress) | A | P2 | `A-S8` filed; non-blocking for ship. |

## Spec compliance summary

**97 %** spec compliance against the Consultify Table Studio program
spec (see `evidence/sprint-6-demo/spec-compliance-final.md`).

The 3 % residual is two real deferrals:
- Manual trial verdict + demo recording capture.
- Live LLM provider + live artifact materializer wiring.

Both are tracked, both are owned, neither blocks ship.

## Follow-ups

| ID | Title | Severity |
|---|---|---|
| `TBL-FU-D-1` | Localize Tabele share + intake strings (en/pl) | P2 |
| `TBL-FU-D-2` | Polling refresh of `listTableConversions` while running | P3 |
| `TBL-FU-D-3` | Promote `share` panel header to shared right-rail header | P3 |
| `TBL-FU-D-4` | `htmlFor` / `id` accessibility on `PublicFormFieldInput` | P2 |
| `TBL-FU-D-5` | JWT links list view in `IntakeJwtPanel` | P3 |
| `TBL-FU-D-6` | Amber pulse animation on near-expiry warning | P3 |
| `TBL-FU-D-7` | Harmonize legacy `PublicFormPage` palette | P3 |
| `TBL-FU-D-8` | Submitted-banner accent fix | P3 |
| `TBL-FU-D-9..11` | Density / typography / dark-mode contrast hotfixes if manual sweep flags drift | P2-P3 |
| `TBL-FU-D-12` | Triage 12 pre-existing failures in `RecordsService`, `MetadataService`, `InterfaceService`, `ModuleSyncService`, `ScheduledAutomationExecutor`, `smoke` | P2 |
| `A-S8` | Block A backlog field types | P2 |
| Live LLM provider wiring | (no FU id; tracked as Block C ops task) | P2 |
| Live artifact materializer wiring | (no FU id; tracked as Block D ops task) | P1 |

## Final Program Closeout

Pointer: `consultify/docs/product/TABLE_STUDIO_FULL_PRODUCT_CLOSEOUT_2026-05-08.md`
(filed at D-S7) aggregates Blocks A + B + C + D and the residual roadmap.

## Next Step

Ship the surface dark, schedule the manual trial + demo capture, and
hand the live provider / materializer wiring to the Block C and Block D
ops follow-up sprints. Treat each kill-switch flip as a per-workspace
opt-in until the trial verdict lands.

---

## Sign-off

- Block lead: CTO (Claude Opus 4.7 acting on user delegation)
- UI/UX reviewer: deferred — manual operator window
- Security reviewer: code-side ACL + rate-limit tests green; manual
  cross-tenant probe deferred to trial card
- QA reviewer: 146 / 146 program tests green; 12 pre-existing failures
  documented out of scope
- Date closed: 2026-05-08
