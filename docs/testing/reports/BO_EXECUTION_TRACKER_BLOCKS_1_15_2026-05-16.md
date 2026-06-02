# BO Execution Tracker Blocks 1-15 - 2026-05-16

## Purpose

Operational tracker for Business Owner execution to close all remaining items from Blocks 1-15 and reach global promotion criteria.

## Usage Protocol

1. For each block, execute every open checklist row.
2. Attach evidence links (screenshots/video/artifacts/API snippets).
3. Set `boStatus` according to evidence:
   - `READY_FOR_MANUAL` -> `IN_RETEST` -> `BUSINESS_PASS`, or
   - `READY_FOR_MANUAL` -> `PASS_WITH_NONBLOCKING_P2` (with explicit owner acceptance).
4. If any P1 appears, set `blockerClass=P1` and stop promotion.
5. After all blocks are closed, run final global promotion checklist at the bottom.

## Acceptance Evidence Contract (minimum)

- Screenshot/video evidence for each manually verified flow.
- Save/read-back proof for primary artifact flows.
- 401/403 denied-state snippets where required by block.
- Export artifacts/hashes where export exists.
- Trace/audit proof for Teresa proposal -> approval -> execution -> audit flows.
- Explicit P2 acceptance record when using `PASS_WITH_NONBLOCKING_P2`.

## Block Tracker

| blockId | blockName | owner | boStatus | blockerClass | openItemsCount | targetReport | strictDevReport | requiredEvidence |
|---:|---|---|---|---|---:|---|---|---|
| 1 | Czat | BO | `READY_FOR_MANUAL` | `none` | 7 | `CHAT_BUSINESS_OWNER_PASS_<date>.md` | [`CHAT_BUSINESS_OWNER_PASS_2026-05-16.md`](CHAT_BUSINESS_OWNER_PASS_2026-05-16.md) | Screenshots/video + denied/public boundary evidence |
| 2 | Canvas | BO | `READY_FOR_MANUAL` | `none` | 1 | `CANVAS_BUSINESS_OWNER_PASS_<date>.md` | [`CANVAS_BUSINESS_OWNER_PASS_2026-05-16.md`](CANVAS_BUSINESS_OWNER_PASS_2026-05-16.md) | Create/save/refresh/reopen evidence + route/API snippet |
| 3 | Teresa | BO | `READY_FOR_MANUAL` | `none` | 11 | `TERESA_CROSS_TOOL_BUSINESS_PASS_<date>.md` | [`TERESA_CROSS_TOOL_BUSINESS_PASS_2026-05-16.md`](TERESA_CROSS_TOOL_BUSINESS_PASS_2026-05-16.md) | Trace/audit ID per action + refusal screenshots |
| 4 | Radar | BO | `READY_FOR_MANUAL` | `P2` | 3 | `RADAR_BUSINESS_OWNER_PASS_<date>.md` | [`RADAR_BUSINESS_OWNER_PASS_2026-05-16.md`](RADAR_BUSINESS_OWNER_PASS_2026-05-16.md) | Radar flow media + empty/degraded + role boundary evidence |
| 5 | Idea: Mind Map | BO | `READY_FOR_MANUAL` | `none` | 4 | `IDEA_TOOLS_BUSINESS_PASS_<date>.md` (Mind Map) | [`IDEA_MIND_MAP_BLOCK5_STRICT_DEV_CLOSEOUT_2026-05-16.md`](IDEA_MIND_MAP_BLOCK5_STRICT_DEV_CLOSEOUT_2026-05-16.md) | Node ops/save/refresh/ACL/Teresa media evidence |
| 6 | Idea: Process Flow | BO | `READY_FOR_MANUAL` | `none` | 6 | `IDEA_TOOLS_BUSINESS_PASS_<date>.md` (Process Flow) | [`IDEA_PROCESS_FLOW_BLOCK6_STRICT_DEV_CLOSEOUT_2026-05-16.md`](IDEA_PROCESS_FLOW_BLOCK6_STRICT_DEV_CLOSEOUT_2026-05-16.md) | Create/edit/link/save/ACL/Teresa media evidence |
| 7 | Idea: Whiteboard | BO | `READY_FOR_MANUAL` | `none` | 7 | `IDEA_TOOLS_BUSINESS_PASS_<date>.md` (Whiteboard) | [`IDEA_WHITEBOARD_BLOCK7_STRICT_DEV_CLOSEOUT_2026-05-16.md`](IDEA_WHITEBOARD_BLOCK7_STRICT_DEV_CLOSEOUT_2026-05-16.md) | Object flow/save/AI/ACL/Teresa media evidence |
| 8 | Idea: Tabela | BO | `READY_FOR_MANUAL` | `none` | 8 | `IDEA_TOOLS_BUSINESS_PASS_<date>.md` (Idea Table) | [`IDEA_TABLE_BLOCK8_STRICT_DEV_CLOSEOUT_2026-05-16.md`](IDEA_TABLE_BLOCK8_STRICT_DEV_CLOSEOUT_2026-05-16.md) | Row/cell/save/conversion/ACL/Teresa media evidence |
| 9 | Calendar | BO | `READY_FOR_MANUAL` | `P2` | 7 | `CALENDAR_BUSINESS_OWNER_PASS_<date>.md` | [`CALENDAR_BLOCK9_STRICT_DEV_CLOSEOUT_2026-05-16.md`](CALENDAR_BLOCK9_STRICT_DEV_CLOSEOUT_2026-05-16.md) | Create/edit/read-back/relation/ACL/Teresa media evidence |
| 10 | Zarządzanie Taskami | BO | `READY_FOR_MANUAL` | `none` | 11 | `TASK_MANAGEMENT_BUSINESS_OWNER_PASS_<date>.md` | [`TASK_MANAGEMENT_BLOCK10_STRICT_DEV_CLOSEOUT_2026-05-16.md`](TASK_MANAGEMENT_BLOCK10_STRICT_DEV_CLOSEOUT_2026-05-16.md) | List/create/edit/assign/status/read-back/ACL/Teresa evidence |
| 11 | PMO Funkcje | BO | `READY_FOR_MANUAL` | `none` | 12 | `PMO_BUSINESS_OWNER_PASS_<date>.md` | [`PMO_FUNCTIONS_BLOCK11_STRICT_DEV_CLOSEOUT_2026-05-16.md`](PMO_FUNCTIONS_BLOCK11_STRICT_DEV_CLOSEOUT_2026-05-16.md) | Lifecycle/action-queue/results/finance/ACL/Teresa evidence |
| 12 | Excel | BO | `READY_FOR_MANUAL` | `none` | 11 | `EXCEL_TABLE_STUDIO_BUSINESS_OWNER_PASS_<date>.md` | [`EXCEL_TABLE_STUDIO_BLOCK12_STRICT_DEV_CLOSEOUT_2026-05-16.md`](EXCEL_TABLE_STUDIO_BLOCK12_STRICT_DEV_CLOSEOUT_2026-05-16.md) | Table flow + exports + AI/QA/source-pack/conversion/ACL evidence |
| 13 | Word | BO | `READY_FOR_MANUAL` | `none` | 11 | `WORD_DOCUMENTS_REPORTS_BUSINESS_OWNER_PASS_<date>.md` | [`WORD_DOCUMENTS_REPORTS_BLOCK13_STRICT_DEV_CLOSEOUT_2026-05-16.md`](WORD_DOCUMENTS_REPORTS_BLOCK13_STRICT_DEV_CLOSEOUT_2026-05-16.md) | Intake/edit/save/export/provenance/diff/ACL/Teresa evidence |
| 14 | Prezentacje | BO | `READY_FOR_MANUAL` | `none` | 11 | `PRESENTATIONS_BUSINESS_OWNER_PASS_<date>.md` | [`PRESENTATIONS_BLOCK14_STRICT_DEV_CLOSEOUT_2026-05-16.md`](PRESENTATIONS_BLOCK14_STRICT_DEV_CLOSEOUT_2026-05-16.md) | MT-PRES matrix + export artifacts + governance/Teresa evidence |
| 15 | Setting/Admin | BO | `READY_FOR_MANUAL` | `none` | 4 | `SETTINGS_ADMIN_BUSINESS_OWNER_PASS_<date>.md` | [`SETTINGS_ADMIN_BLOCK15_STRICT_DEV_CLOSEOUT_2026-05-16.md`](SETTINGS_ADMIN_BLOCK15_STRICT_DEV_CLOSEOUT_2026-05-16.md) | Denied-state UX + route-boundary + governance ownership evidence |

## Open Items by Block (exact operational list)

### Block 1 — Czat
- [ ] Chat route opens for authenticated user.
- [ ] Conversation persists through refresh.
- [ ] Message history does not disappear after navigation.
- [ ] Attachments or artifact context are visible when used.
- [ ] Source/citation/limitation language is honest.
- [ ] No raw tenant, ACL, token, prompt, or internal payload leaks.
- [ ] Public Anna remains separate from tenant Teresa.

### Block 2 — Canvas
- [ ] Teresa can propose a Canvas change without silent write.

### Block 3 — Teresa
- [ ] Teresa -> Canvas proposal -> approval -> artifact/read-back.
- [ ] Teresa -> Excel/Table proposal -> approval -> artifact/read-back.
- [ ] Teresa -> Word/Document proposal -> approval -> artifact/read-back.
- [ ] Teresa -> Presentation proposal -> approval -> deck/preview/export.
- [ ] Teresa -> Task proposal -> approval -> task visible in My Work.
- [ ] Teresa -> Initiative proposal -> approval -> initiative visible.
- [ ] Teresa -> Report proposal -> approval -> report/provenance visible.
- [ ] Refusal works for insufficient permission.
- [ ] Refusal works for unsafe mutation.
- [ ] Missing context produces a useful ask-for-clarification state.
- [ ] Every approved mutation has trace/audit evidence.

### Block 4 — Radar
- [ ] Radar detail or signal view is business-accepted end-to-end.
- [ ] Empty/degraded state UX is business-accepted.
- [ ] Teresa handoff proposal to Radar is business-accepted.

### Block 5 — Idea: Mind Map
- [ ] Logged-in visual node operations (add/edit/delete/reorder) are business-accepted end-to-end.
- [ ] Logged-in visual hierarchy readability/color behavior is business-accepted.
- [ ] ACL/denied-state UX is business-accepted.
- [ ] Teresa handoff from Mind Map flow is business-accepted.

### Block 6 — Idea: Process Flow
- [ ] Logged-in visual create/open flow is business-accepted end-to-end.
- [ ] Logged-in visual add/edit/reorder/link step flow is business-accepted.
- [ ] Save/read-back after refresh is business-accepted on full visual flow.
- [ ] Process analysis/QA layer behavior is business-accepted where enabled.
- [ ] ACL/denied-state UX is business-accepted.
- [ ] Teresa handoff from Process Flow is business-accepted.

### Block 7 — Idea: Whiteboard
- [ ] Logged-in visual create/open Whiteboard flow is business-accepted end-to-end.
- [ ] Logged-in visual add/edit/move/delete object flow is business-accepted.
- [ ] Save/read-back after refresh is business-accepted on full visual board flow.
- [ ] AI clustering/synthesis behavior is business-accepted where enabled.
- [ ] Version/diff/proposal visibility is business-accepted where AI changes content.
- [ ] ACL/denied-state UX is business-accepted.
- [ ] Teresa handoff from Whiteboard flow is business-accepted.

### Block 8 — Idea: Tabela
- [ ] Logged-in visual create/open Idea Table flow is business-accepted end-to-end.
- [ ] Logged-in visual add row/edit cell/delete row flow is business-accepted.
- [ ] Save/read-back after refresh is business-accepted on full table flow.
- [ ] Provenance/source indication UX is business-accepted where required.
- [ ] Scoring/prioritization UX is business-accepted where enabled.
- [ ] Convert row/table to task/initiative/document is business-accepted where supported.
- [ ] ACL/denied-state UX is business-accepted.
- [ ] Teresa handoff from Idea Table flow is business-accepted.

### Block 9 — Calendar
- [ ] Create event.
- [ ] Edit event.
- [ ] Delete/cancel event if supported.
- [ ] Link task to calendar event.
- [ ] Refresh/read-back preserves event.
- [ ] Role/tenant denied-state UX is business-accepted.
- [ ] Logged-in Teresa calendar handoff proposal -> approval -> event/read-back is business-accepted.

### Block 10 — Zarządzanie Taskami
- [ ] Task list opens with expected business data and empty-state honesty.
- [ ] Create task.
- [ ] Edit task title/description.
- [ ] Assign owner.
- [ ] Change status.
- [ ] Add due date.
- [ ] Open task detail.
- [ ] Refresh/read-back preserves changes.
- [ ] Task appears in related My Work/Calendar/Initiative surfaces where applicable.
- [ ] Role/tenant denied state works.
- [ ] Teresa task proposal -> approval -> task visible.

### Block 11 — PMO Funkcje
- [ ] Create initiative in logged-in business flow.
- [ ] Assign owner.
- [ ] Add tasks.
- [ ] Add decision.
- [ ] Add risk/blocker.
- [ ] Transition initiative status.
- [ ] Execution action queue shows overdue/missing-plan items.
- [ ] Results/KPI deviation closure works.
- [ ] Finance/investment-case decision path works.
- [ ] Report/read-back reflects PMO state.
- [ ] Role restrictions and denied states are correct.
- [ ] Teresa initiative/execution proposal requires approval.

### Block 12 — Excel
- [ ] Add/edit record in full logged-in business flow.
- [ ] Save/read-back after refresh in full logged-in business flow.
- [ ] AI Editor 8 levels visual flow is business-accepted.
- [ ] QA Report visual flow is business-accepted.
- [ ] Source Pack visual flow is business-accepted.
- [ ] Convert to Word/Document visual flow is business-accepted.
- [ ] Convert to Presentation visual flow is business-accepted.
- [ ] Form Intake JWT full business flow is business-accepted.
- [ ] Menu 3 AI actions are correctly placed.
- [ ] Kill switches and disabled states are honest.
- [ ] ACL/adversarial probes pass.

### Block 13 — Word
- [ ] Create document from intake in full logged-in business flow.
- [ ] Open existing document in full logged-in business flow.
- [ ] Edit document in full logged-in business flow.
- [ ] Save/read-back after refresh in full logged-in business flow.
- [ ] Export DOCX business flow is accepted.
- [ ] Export PDF business flow is accepted.
- [ ] Source/provenance panel is visible and business-accepted.
- [ ] AI edit proposal produces diff/approval where supported and is business-accepted.
- [ ] Report Builder document/report generation is business-accepted.
- [ ] Tenant/ACL denied-state UX is business-accepted.
- [ ] Teresa document/report proposal requires approval in full business rehearsal.

### Block 14 — Prezentacje
- [ ] Execute MT-PRES-001..031.
- [ ] Create deck in full logged-in business flow.
- [ ] Edit deck in full logged-in business flow.
- [ ] Preview/render has no empty-render in full business flow.
- [ ] Export PDF business flow is accepted.
- [ ] Export PPTX business flow is accepted.
- [ ] Export parity is acceptable in full business flow.
- [ ] Source-linked claims/provenance work in full business flow.
- [ ] Subscriber dashboard and token/usage views work in full business flow.
- [ ] Template governance works in full business flow (approved, blocked, audit, role/tenant).
- [ ] Teresa presentation proposal requires approval in full business rehearsal.

### Block 15 — Setting/Admin
- [ ] RBAC denied-state UX is business-accepted (no silent redirect, no infinite spinner, clear Access Denied copy, no raw internal details).
- [ ] Owner/Admin/User route boundaries are business-accepted.
- [ ] Governance writes are business-accepted as audited.
- [ ] Settings ownership is business-accepted (personal/pod tenant-admin/superadmin scope).

## Cross-Block Residuals (must close before GLOBAL_ALL_MODULES_GO)

- [ ] `docs/UI_UX/99_RAW_INPUT 2.md` classified as merge/archive/delete.
- [ ] Draft modules resolved or explicitly classified out of scope:
  - Wywiad
  - Meeting
  - MCP IRIS
  - MCP Marketplace
  - Organizacja
  - Portal partnerski
- [ ] Landing Page / Public P2 polish closed (PL/DE labels, footer spacing, legal/entity consistency).
- [ ] Final production build captured and PASS.
- [ ] Final staging smoke captured and PASS.
- [ ] Final docs gates captured and PASS.

## Promotion Workflow (READY_FOR_MANUAL -> BUSINESS_PASS/PASS_WITH_NONBLOCKING_P2)

1. Set block to `IN_RETEST` when manual execution begins.
2. Execute all open items listed for the block.
3. Attach all required evidence in target BO report.
4. Classify outcomes:
   - all pass -> set `BUSINESS_PASS`,
   - nonblocking risk remains -> set `PASS_WITH_NONBLOCKING_P2` + explicit owner acceptance,
   - blocking issue -> set `BLOCKED_P1`.
5. Sync status in:
   - `FINAL_GLOBAL_MODULE_GATE_2026-05-15.md`
   - `GLOBAL_MODULE_CLOSEOUT_STATUS_BOARD_2026-05-15.md`
6. Repeat for all blocks 1-15.

## Final Global Promotion Checklist

- [ ] Every block 1-15 is `BUSINESS_PASS` or accepted `PASS_WITH_NONBLOCKING_P2`.
- [ ] No active `BLOCKED_P1`.
- [ ] Cross-block residuals closed.
- [ ] Final capture artifacts attached (build/smoke/docs).
- [ ] Global verdict promoted to `GLOBAL_ALL_MODULES_GO`.
