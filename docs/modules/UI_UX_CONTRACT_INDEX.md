---
doc_id: UI_UX_CONTRACT_INDEX
doc_kind: UI_UX_INDEX
owner: user
status: draft
last_updated: 2026-05-09
---

# UI/UX Contract Index

## Purpose

This document links module-level UX contracts to the global Consultify UI/UX canon.

UX is treated as a contract: it defines user jobs, states, actions, evidence, approvals and prohibited patterns.

## Global Sources

- `DRD/UI_UX_SOURCE_OF_TRUTH.md`
- `DRD/consultify/docs/UI_UX/`
- `DRD/consultify/docs/ui-standards/`
- `DRD/consultify/docs/modules/README.md`
- `DRD/consultify/docs/modules/MODULE_ROUTING_ARCHITECTURE.md`

## Universal Module UX Requirements

Every module `04_UI_UX.md` must define:

- main screen,
- primary user job,
- Menu 2 behavior,
- Menu 3 / command row behavior,
- right-side placement for contextual AI actions,
- loading state,
- empty state,
- error state,
- degraded state,
- success state,
- source/provenance/evidence display,
- approval/diff/review display when relevant,
- next-action guidance,
- explicit anti-patterns.

## AI Action Placement

Contextual AI actions MUST live in Menu 3 / Dynamic Tabs / local command row right-side slot.

They MUST NOT be duplicated:

- under metadata strips,
- as a separate toolbar inside the canvas,
- at the bottom of the canvas,
- in both Menu 3 and the work canvas.

## Module UX Index

| Module | UX contract | Primary UX job |
| --- | --- | --- |
| `01_czat` | `01_czat/04_UI_UX.md` | Conversational intake, orchestration and source-aware assistance. |
| `02_moja-praca` | `02_moja-praca/04_UI_UX.md` | User work queue, next actions and cross-module attention. |
| `03_wywiad` | `03_wywiad/04_UI_UX.md` | Structured interview and evidence-backed diagnosis. |
| `04_narzedzia` | `04_narzedzia/04_UI_UX.md` | Consulting tools, frameworks and analysis execution. |
| `05_inicjatywy` | `05_inicjatywy/04_UI_UX.md` | Initiative portfolio, decisions and expected value. |
| `06_realizacja` | `06_realizacja/04_UI_UX.md` | Execution tracking, blockers, tasks and delivery evidence. |
| `07_rezultaty` | `07_rezultaty/04_UI_UX.md` | KPI, ROI and value realization review. |
| `08_finanse` | `08_finanse/04_UI_UX.md` | Financial modeling, assumptions and ROI calculations. |
| `09_outputs` | `09_outputs/04_UI_UX.md` | Packaging approved work into client-ready outputs. |
| `10_dokumenty` | `10_dokumenty/04_UI_UX.md` | Editable document authoring with sources and review. |
| `11_tabele` | `11_tabele/04_UI_UX.md` | Editable tables and structured analytical work. |
| `12_prezentacje` | `12_prezentacje/04_UI_UX.md` | Deck creation, narrative structure and source-backed slides. |
| `13_meeting` | `13_meeting/04_UI_UX.md` | Meeting prep, execution, follow-up and decisions. |
| `14_mcp-iris` | `14_mcp-iris/04_UI_UX.md` | Integration execution with approval and transparency. |
| `15_mcp-marketplace` | `15_mcp-marketplace/04_UI_UX.md` | Discovery, review and installation of MCP capabilities. |
| `16_organizacja` | `16_organizacja/04_UI_UX.md` | Organization context, knowledge and memory management. |
| `17_panel-administratora` | `17_panel-administratora/04_UI_UX.md` | Tenant/admin control, policy and governance. |
| `18_ustawienia` | `18_ustawienia/04_UI_UX.md` | User/workspace preferences and configuration. |
| `19_portal-partnerski` | `19_portal-partnerski/04_UI_UX.md` | Partner workflow, partner deliverables and access boundaries. |

## Review Checklist

For every UX contract update, verify:

- the user can see what state the module is in,
- the user can see what to do next,
- AI suggestions are distinguishable from approved truth,
- sources and evidence are visible where claims are made,
- destructive or high-impact actions require approval,
- tenant/ACL boundaries remain visible and enforced,
- contextual AI controls are in Menu 3.
