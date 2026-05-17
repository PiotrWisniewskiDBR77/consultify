---
module_id: MODULE_OUTPUTS
function_id: OUT_PRESENTATION_WIZARD
doc_kind: FUNCTION_EXECUTION_CARD
owner_business: user
owner_tech: user
status: REVIEW
last_updated: 2026-05-11
work_type: docs-only
---

# Function Execution Card — OUT_PRESENTATION_WIZARD

## 1. Metadata

- scope_anchor: `09_outputs/OUT_PRESENTATION_WIZARD`
- primary_module: `09_outputs`
- primary_function: `OUT_PRESENTATION_WIZARD`
- work_type: `docs-only`

## 2. Scope Anchor

- In scope:
  - wizard route governance under outputs library doctrine
  - ownership boundary with `12_prezentacje` lane clarified in integration context
  - approval/review expectations before outward delivery claims
- Out of scope:
  - wizard runtime implementation
  - route migration or lane consolidation

## 3. Dependency Scope

| Dependency | Allowed use | Forbidden use |
| --- | --- | --- |
| `12_prezentacje/RAW_TARGET_STATE_2_0_PACKET.md` | downstream boundary and unresolved owner decisions | declaring module 12 runtime done from module 09 docs |
| `96_RAW_PRESENTATION_STUDIO_GAMMA_CLASS_2026-05-09.md` | target governance/quality intent | overstating runtime parity evidence not present |

## 4. Source Inputs

- `docs/modules/09_outputs/functions/OUT_PRESENTATION_WIZARD.md`
- `docs/modules/09_outputs/03_BEHAVIOR.md`
- `docs/modules/09_outputs/04_UI_UX.md`
- `docs/modules/09_outputs/07_ACCEPTANCE_AND_TESTS.md`
- `docs/modules/12_prezentacje/RAW_TARGET_STATE_2_0_PACKET.md`
- `docs/UI_UX/96_RAW_PRESENTATION_STUDIO_GAMMA_CLASS_2026-05-09.md`
- `docs/RAW/presentation-studio/96_RAW_PRESENTATION_STUDIO_GAMMA_CLASS_2026-05-09.md`

## 5. RAW -> Decision -> Evidence Chain

| Task ID | RAW requirement | Decision | Evidence |
| --- | --- | --- | --- |
| `OUT-WIZ-P0-001` | presentation generation flow in outputs must keep explicit ownership and handoff boundaries | `KEEP + ENHANCE` | `03_BEHAVIOR.md`, `04_UI_UX.md`, module 12 packet |
| `OUT-WIZ-P1-001` | review/approval and auditable lifecycle for impactful actions | `ENHANCE` | docs-level claims `PASS_WITH_P1`; runtime evidence `NOT_DONE` |
| `OUT-WIZ-P2-001` | lightweight parity and state guidance with visual grounding | `DEFER` | screenshot evidence unavailable (`NOT_DONE`) |

## 6. Gap Register

| Task ID | Priority | Gap | Status |
| --- | --- | --- | --- |
| `OUT-WIZ-P0-001` | `P0` | boundary between outputs lane and standalone presentations lane not normalized in execution card form | `READY` |
| `OUT-WIZ-P1-001` | `P1` | no dedicated route/component/API/test evidence for approval gate continuity in wizard-to-builder path | `WAITING_P0` |
| `OUT-WIZ-P2-001` | `P2` | missing visual evidence and parity checklist confirmation | `WAITING_P0` |

## 7. Evidence Plan

| Claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| Wizard route is mounted and tied to outputs lane. | `/presentations/wizard` route declarations | `PresentationWizard` | presentation generation endpoints | route smoke | `PASS_DOCS` |
| Wizard flow respects review/approval doctrine before export claims. | lifecycle route contract | wizard review/approval surfaces | review/export APIs | flow regression tests | `NOT_DONE` |
| UX remains lightweight with Menu 3/right-side contextual actions. | module shell route contract | command row action surface | n/a | UI action-placement assertions + screenshots | `NOT_DONE` |

## 8. Done Gate

- contract complete: `PASS`
- RAW alignment complete: `PASS`
- evidence complete: `PASS_WITH_P1`
- owner acceptance: `PENDING`

