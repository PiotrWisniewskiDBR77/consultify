# UI/UX Step Registry - 2026-05-15

Status: `LOCKED_FOR_GLOBAL_UI_GATE`
Gate: `FINAL_GLOBAL_UI_GATE_2026-05-15`
Model: `block = module`, `step = tab/workspace mode`

## Purpose

This registry closes `G-01` from the pre-audit gap analysis by defining an authoritative, repeatable audit scope for all in-scope module steps.

Rules:

- Chat is excluded from this cycle.
- Every step below must be audited with the same control pack.
- No module can be marked done if any of its steps is not explicitly decided.

## Global Scope Summary

- Blocks: `9`
- Steps: `44`

Block and step totals:

| Block ID | Module | Step Count |
|---|---|---:|
| `B1` | `My Work` | `8` |
| `B2` | `Interview` | `6` |
| `B3` | `Tools` | `4` |
| `B4` | `Assessment` | `3` |
| `B5` | `Initiatives` | `2` |
| `B6` | `Execution` | `3` |
| `B7` | `Results` | `5` |
| `B8` | `Finance` | `6` |
| `B9` | `Outputs` | `7` |

## Step Decision Model (Mandatory)

Allowed decision per step:

- `PASS`
- `PASS_WITH_NONBLOCKING_P2`
- `BLOCKED_P1`

No step may remain implicit, inherited, or "covered by neighbor tab".

## Step Registry

## B1 - My Work (8 steps)

Source module: `src/components/MyWork/MyWorkHub.tsx`

| Step ID | Step (Tab/Workspace) | Canonical Tab ID |
|---|---|---|
| `B1-S1` | Radar | `home` |
| `B1-S2` | Ideas | `ideas` |
| `B1-S3` | Notebook | `notebook` |
| `B1-S4` | Inbox | `inbox` |
| `B1-S5` | Calendar | `calendar` |
| `B1-S6` | Tasks | `tasks` |
| `B1-S7` | Decisions | `decisions` |
| `B1-S8` | Manager | `manager` |

## B2 - Interview (6 steps)

Source module: `src/components/Interview/InterviewHub.tsx`

| Step ID | Step (Tab/Workspace) | Canonical Tab ID |
|---|---|---|
| `B2-S1` | My Assignments | `my_assignments` |
| `B2-S2` | Sessions | `sessions` |
| `B2-S3` | Assigned | `managed` |
| `B2-S4` | Templates | `templates` |
| `B2-S5` | Insights | `insights` |
| `B2-S6` | Initiatives | `initiatives` |

## B3 - Tools (4 steps)

Source module: `src/components/Discovery/DiscoveryToolsHub.tsx`

| Step ID | Step (Tab/Workspace) | Canonical Tab ID |
|---|---|---|
| `B3-S1` | Library | `library` |
| `B3-S2` | Sessions | `sessions` |
| `B3-S3` | Reports & Presentations | `outputs` |
| `B3-S4` | Initiatives | `initiatives` |

## B4 - Assessment (3 steps)

Source module: `src/components/assessment/AssessmentHub.tsx`

| Step ID | Step (Tab/Workspace) | Canonical Tab ID |
|---|---|---|
| `B4-S1` | Assessment | `list` |
| `B4-S2` | Reports | `reports` |
| `B4-S3` | Initiatives | `initiatives` |

## B5 - Initiatives (2 steps)

Source module: `src/components/Initiatives/InitiativesHub.tsx`

| Step ID | Step (Tab/Workspace) | Canonical Tab ID |
|---|---|---|
| `B5-S1` | Portfolio | `list` |
| `B5-S2` | Analysis | `analysis` |

## B6 - Execution (3 steps)

Source module: `src/components/Execution/ExecutionHub.tsx`

| Step ID | Step (Tab/Workspace) | Canonical Tab ID |
|---|---|---|
| `B6-S1` | Summary | `list` |
| `B6-S2` | Reporting | `reports` |
| `B6-S3` | Management | `people_change` |

## B7 - Results (5 steps)

Source module: `src/components/Results/ResultsHub.tsx`

| Step ID | Step (Tab/Workspace) | Canonical Tab ID |
|---|---|---|
| `B7-S1` | Initiatives | `results_initiatives` |
| `B7-S2` | KPI | `results_kpi` |
| `B7-S3` | KPI Reports | `results_reports` |
| `B7-S4` | ROI | `roi` |
| `B7-S5` | ROI Analysis | `roi_analysis` |

## B8 - Finance (6 steps)

Source module: `src/components/Economics/FinanceHub.tsx`

| Step ID | Step (Tab/Workspace) | Canonical Tab ID |
|---|---|---|
| `B8-S1` | Statements | `statements` |
| `B8-S2` | Models | `models` |
| `B8-S3` | Analysis | `analysis` |
| `B8-S4` | Prediction | `prediction` |
| `B8-S5` | Enterprise Valuation | `valuation` |
| `B8-S6` | Investment Analysis | `investment` |

## B9 - Outputs (7 steps)

Source module: `src/components/ReportsAndPresentations/ReportsAndPresentationsHub.tsx`

| Step ID | Step (Tab/Workspace) | Canonical Tab ID |
|---|---|---|
| `B9-S1` | All | `outputs_all` |
| `B9-S2` | Mine | `outputs_mine` |
| `B9-S3` | Needs Review | `outputs_review` |
| `B9-S4` | Documents | `outputs_documents` |
| `B9-S5` | Presentations | `presentations` |
| `B9-S6` | Sheets | `outputs_sheets` |
| `B9-S7` | Template Library | `templates` |

## Per-Step Mandatory Control Pack

Every step above must be verified against these 7 control groups:

1. Shell and navigation compliance.
2. Menu 3 and action governance compliance.
3. Component contract compliance.
4. Visual token and semantic compliance.
5. Runtime state and trust compliance.
6. Security/tenant/ACL UI compliance.
7. Enterprise premium quality compliance.

Detailed check criteria are defined in:

- `FINAL_GLOBAL_UI_GATE_2026-05-15.md` -> `Step Compliance Checklist`.

## Evidence And Naming Contract

Step evidence must use:

- `block_id`
- `step_id`
- `decision`
- `severity`
- `open_p1_count`
- `accepted_p2_count`
- `evidence_link`

Recommended file pattern:

- `docs/testing/reports/UI_UX_STEP_<block_id>_<step_id>_<date>.md`

## Change Control

This registry is locked for current gate execution.

Any step addition/removal/rename requires:

1. UI/UX Owner approval,
2. update to this registry,
3. update to the parent gate report.
