---
module_id: MODULE_DOCUMENTS
doc_kind: RAW_TARGET_STATE_2_0_PACKET
version: 2.0
owner: user
status: review
last_updated: 2026-05-11
scope_anchor: 10_dokumenty/MODULE_INTEGRATION
work_type: docs-only
mode: canonical_module_packet
---

# RAW Target State 2.0 Packet — 10_dokumenty

## 0. Canonicalization Note

This packet closes the docs-only RAW alignment for module `10_dokumenty` and normalizes module-level scope for:

- `DOC_WORDY_PLACEHOLDER`
- `DOC_STUDIO_RUNTIME_TARGET`

Execution tracking is delegated to:

- `IMPLEMENTATION_TASK_BOARD.md`
- `function-cards/*_EXECUTION_CARD.md`
- `functions/*.md`
- `STAGE_1_5_ULTRA_DEEP_GAP_AUDIT_2026-05-11.md`

## 1. Scope and Sources

- primary module: `10_dokumenty`
- scope anchor: `10_dokumenty/MODULE_INTEGRATION`
- work type: `docs-only`
- mandatory source set:
  - `docs/modules/10_dokumenty/00_META.md`
  - `docs/modules/10_dokumenty/01_PURPOSE.md`
  - `docs/modules/10_dokumenty/02_SCOPE.md`
  - `docs/modules/10_dokumenty/03_BEHAVIOR.md`
  - `docs/modules/10_dokumenty/04_UI_UX.md`
  - `docs/modules/10_dokumenty/05_DATA_AND_INTEGRATIONS.md`
  - `docs/modules/10_dokumenty/06_PERMISSIONS_AND_SECURITY.md`
  - `docs/modules/10_dokumenty/07_ACCEPTANCE_AND_TESTS.md`
  - `docs/modules/10_dokumenty/functions/DOC_WORDY_PLACEHOLDER.md`
  - `docs/modules/10_dokumenty/functions/DOC_STUDIO_RUNTIME_TARGET.md`
  - `docs/modules/10_dokumenty/RAW_INPUT.md`
  - `docs/UI_UX/92_RAW_DOCUMENT_STUDIO_RESEARCH_2026-05-08.md`
  - `docs/UI_UX/93_RAW_DOCUMENT_STUDIO_ANALYSIS_2026-05-09.md`
  - `docs/UI_UX/94_RAW_DOCUMENT_STUDIO_AI_NATIVE_ARTIFACT_ENGINE_2026-05-09.md`
  - `docs/UI_UX/104_RAW_CONVERSATIONAL_WORK_OS_TERESA_CHAT_ENGINE_2026-05-09.md` (impact-only)
  - `docs/RAW/document-studio/92_RAW_DOCUMENT_STUDIO_RESEARCH_2026-05-08.md`
  - `docs/RAW/document-studio/93_RAW_DOCUMENT_STUDIO_ANALYSIS_2026-05-09.md`
  - `docs/RAW/document-studio/94_RAW_DOCUMENT_STUDIO_AI_NATIVE_ARTIFACT_ENGINE_2026-05-09.md`
  - `docs/product/V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_FUNCTIONAL_SPEC.md`
  - `docs/product/V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_IMPLEMENTATION_PLAN.md`

## 2. As-Is vs Target vs Delta

| Axis | As-Is verified | Target 2.0 | Delta |
| --- | --- | --- | --- |
| Runtime mount | `/wordy` shows `V4ComingSoonView`; studio runtime not mounted. | `/wordy` runs governed Document Studio runtime (`WordyView`) with lifecycle states. | `P0`: keep placeholder truth explicit; `P1`: mount runtime with evidence. |
| Teresa work execution | No explicit Teresa operating/execution contract in module docs. | Teresa is the document-work executor: she clarifies intent, drafts/edits document artifacts, preserves sources, and drives review/approval through the Document Studio runtime. | `P0`: encode work-execution doctrine; `P1`: runtime proof of Teresa-created/edited document artifacts. |
| Interaction model | Placeholder only, no operational command surfaces. | Light interaction model aligned with Tables/Presentations. | `P1`: add behavior + UI evidence matrix for parity pattern. |
| Menu 3 AI actions | Rule mentioned, but not tied to function-level evidence rows. | Contextual AI actions only in Menu 3/right command slot, no duplicate toolbar. | `P0`: lock rule in execution cards + acceptance matrix; `P1`: component evidence. |
| Review/approval before export | Declared in high-level docs, not fully operationalized per function. | Explicit review/approval gate before final output/export claims. | `P1`: route/component/API/test evidence for approval gate. |
| States + next action guidance | State list exists; no function-level evidence chain. | Mandatory loading/empty/error/degraded/success + next-action guidance per function. | `P0`: evidence rows in docs; `P2`: dedicated state-depth tests/manual pack. |

## 3. RAW Synthesis (must / should / out)

## 3.1 MUST

1. Document Studio is an AI-native artifact engine, not a one-shot text generator.
2. Artifacts are structured, versioned, source-traceable, reviewable, auditable, and exportable.
3. High-impact changes require explicit review/approval before final external output/export.
4. Teresa is the primary document-work executor: conversation -> clarification -> draft -> edit -> review -> approval -> export/read-back.
5. Contextual AI actions are in Menu 3/right-side command slot only (no duplicated toolbar).
6. Mandatory runtime states must include next-action guidance.

## 3.2 SHOULD

1. Interaction model remains light and operational, matching Tables/Presentations ergonomics.
2. Module should reuse shared artifact substrate and avoid parallel truth/registry.
3. Template governance should include schema + formatting + export rules + governance metadata.

## 3.3 OUT

1. Competing with MS Word as a generic free-form editor.
2. Hidden writes, hidden approvals, silent finalization, or export-without-trace.
3. Any canvas-level duplicate AI toolbar conflicting with Menu 3 placement.

## 4. Decision Register (KEEP / ENHANCE / NEW / DEFER)

| Decision ID | Topic | Decision | Rationale | Evidence / status |
| --- | --- | --- | --- | --- |
| `D10-001` | As-Is placeholder honesty | `KEEP` | Existing contract truthfully states placeholder runtime on `/wordy`. | `03_BEHAVIOR.md`, `04_UI_UX.md`, `07_ACCEPTANCE_AND_TESTS.md` |
| `D10-002` | Teresa work-execution doctrine | `ENHANCE` | Hard UX gate requires Teresa to execute document work through the correct runtime, not only route or control it. | docs-level `PASS_WITH_P2`; runtime proof `NOT_DONE` |
| `D10-003` | Menu 3 AI placement strictness | `KEEP` + `ENHANCE` | Rule exists globally; module-level evidence rows were incomplete. | docs-level `PASS`; runtime component proof `NOT_DONE` |
| `D10-004` | Approval before export claim | `ENHANCE` | RAW and V8.1 require review/approval before final delivery/export claims. | docs-level `PASS_WITH_P1`; route/component/API/test `NOT_DONE` |
| `D10-005` | State machine with next actions | `NEW` | Mandatory states existed only as narrative; now normalized as evidence rows. | docs-level `PASS`; runtime depth tests `NOT_DONE` |
| `D10-006` | Visual reference grounding | `DEFER` | Provided screenshot asset is not available in repository path at audit time. | `NOT_DONE` (owner to re-attach or confirm omission) |

## 5. Critical Thesis Chain (RAW -> decision -> evidence / NOT_DONE)

| Thesis | RAW source | Decision | Evidence / NOT_DONE |
| --- | --- | --- | --- |
| Document runtime must be artifact-native and governed end-to-end. | `92/93/94` (UI_UX + RAW mirrors), V8.1 Functional Spec | `D10-001` keep module purpose + `D10-004` enhance approval/export | `01_PURPOSE.md`, `02_SCOPE.md`, `05_DATA_AND_INTEGRATIONS.md` (`PASS_DOCS`) |
| Placeholder cannot be presented as a working editor. | module As-Is docs + RAW target gap framing | `D10-001` keep honesty | `03_BEHAVIOR.md`, `04_UI_UX.md`, `07_ACCEPTANCE_AND_TESTS.md` (`PASS`) |
| Teresa executes document work through conversation and Document Studio runtime. | Hard UX rules + `104_RAW_CONVERSATIONAL_WORK_OS_TERESA_CHAT_ENGINE_2026-05-09.md` work-operating doctrine | `D10-002` enhance | module docs updated (`PASS_WITH_P2`), runtime proof `NOT_DONE` |
| AI actions only in Menu 3/right-side slot, no duplicate toolbars. | Hard UX rules + `104_RAW...` + global Menu 3 rule | `D10-003` keep/enhance | `04_UI_UX.md` + execution cards (`PASS_DOCS`), component screenshot/DOM proof `NOT_DONE` |
| Mandatory states with explicit next-action guidance. | `93_RAW...` state/gov requirements + Hard UX rules | `D10-005` new evidence normalization | `04_UI_UX.md`, `07_ACCEPTANCE_AND_TESTS.md`, function execution cards (`PASS_WITH_P2`) |
| Explicit review/approval before final output/export claims. | `92/93/94` + V8.1 review lifecycle doctrine | `D10-004` enhance | docs contract rows present (`PASS_WITH_P1`); API/flow evidence `NOT_DONE` |

## 6. Normalized Gap Register (P0 / P1 / P2)

### P0 must close in docs scope

| Gap | Required closure | Status |
| --- | --- | --- |
| Missing module-level packet for target-state RAW alignment. | Canonical `RAW_TARGET_STATE_2_0_PACKET.md` with As-Is/Target/Delta and decision register. | `DONE_DOC` |
| Missing implementation task board and function execution cards. | Add board and card files with immutable scope anchors. | `DONE_DOC` |
| Missing function-level critical thesis chain and evidence rows. | Add RAW->decision->evidence tables and `NOT_DONE` markers. | `DONE_DOC` |

### P1 runtime evidence blockers

| Gap | Evidence needed | Status |
| --- | --- | --- |
| No runtime proof that Teresa can create/edit document artifacts end-to-end in `/wordy`. | route/component/API/test behavior proving Teresa-mediated document drafting, editing, review and read-back. | `NOT_DONE` |
| No runtime proof that Menu 3 is the only contextual AI action surface. | UI component evidence showing right-slot actions and no duplicate toolbar. | `NOT_DONE` |
| No runtime proof for review/approval gate before export claims. | API and UX flow evidence for approve-before-export. | `NOT_DONE` |

### P2 hardening

| Gap | Evidence needed | Status |
| --- | --- | --- |
| Full state-depth matrix (loading/empty/error/degraded/success) with next actions. | dedicated tests/manual evidence per state family. | `NOT_DONE` |
| Full provenance and audit trail depth for export artifacts. | explicit source, diff, version, reviewer and export records evidence. | `NOT_DONE` |
| Visual input grounding row. | valid screenshot path attached to module evidence pack. | `NOT_DONE` |

## 7. Function Map and Scope Anchors

| Function | Scope anchor | Source card | Docs gate | Runtime posture |
| --- | --- | --- | --- | --- |
| `DOC_WORDY_PLACEHOLDER` | `10_dokumenty/DOC_WORDY_PLACEHOLDER` | `function-cards/DOC_WORDY_PLACEHOLDER_EXECUTION_CARD.md` | `APPROVED_FOR_DOCS` | `BLOCKED_P1` |
| `DOC_STUDIO_RUNTIME_TARGET` | `10_dokumenty/DOC_STUDIO_RUNTIME_TARGET` | `function-cards/DOC_STUDIO_RUNTIME_TARGET_EXECUTION_CARD.md` | `APPROVED_FOR_DOCS` | `BLOCKED_P1` |

## 7A. Stage 1.5 Ultra-Deep Audit Normalization

| Stage 1.5 finding | Normalized decision | Evidence / status |
| --- | --- | --- |
| `/wordy` exists but mounts `V4ComingSoonView`, not Document Studio. | `KEEP_AS_IS_TRUTH` | `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx`; `PASS_AS_IS`, runtime target `NOT_DONE`. |
| `WordyView` exists as target/candidate footprint but is not mounted on `/wordy`. | `NEW_SPLIT_READINESS` | `src/components/AIChat/KimiWorkspace/WordyView.tsx`; route mount proof `NOT_DONE`. |
| Teresa/chat redirects imply document work starts on `/wordy` while mounted route is placeholder. | `DEFER_OWNER` | `src/components/AIChat/UnifiedChatPanel.tsx`; owner resolution `NOT_DONE_OWNER`. |
| Template-use routes point to `/wordy?templateArtifactId=...` while route is placeholder. | `DEFER_OWNER` | `src/components/ReportsAndPresentations/artifactNavigation.ts`; owner resolution `NOT_DONE_OWNER`. |
| Teresa work execution, Menu3, approval and provenance hard rules are valid target doctrine but not mounted runtime proof. | `KEEP` + `ENHANCE` | docs `PASS_DOCS`; route/component/API/test evidence `NOT_DONE`. |

## 8. Delivery Plan

| Wave | Scope | Exit gate | Decision |
| --- | --- | --- | --- |
| P0 docs closure | packet + board + cards + evidence row normalization | all docs artifacts present and consistent | `APPROVED_FOR_DOCS` |
| P1 runtime evidence | Teresa-executed document draft/edit/review/read-back, Menu 3-only actions, approval-before-export proof | route/component/API/test evidence available | `BLOCKED_P1` until done |
| P2 quality hardening | state-depth and provenance depth evidence | quality packet complete or owner-accepted defer | `WAITING_P1` |

## 9. Final Decision

- docs verdict: `APPROVED_FOR_DOCS`
- runtime verdict: `BLOCKED_P1`
- module integration verdict for this docs pass: `NEEDS_OWNER_DECISION`

## 10. Open Questions

1. Confirm final canonical source for Teresa hard UX requirements: should module 10 SSOT formally include `104_RAW_CONVERSATIONAL_WORK_OS_TERESA_CHAT_ENGINE_2026-05-09.md` as impact-only?
2. Should `DOC_STUDIO_RUNTIME_TARGET` retain route `/wordy` during rollout, or use staged dual-route alias before cutover?
3. Re-attach or dismiss the missing screenshot evidence path to close visual grounding row.

## 11. Deep Audit Addendum (`2026-05-11`)

- linked scope anchor: `10_dokumenty/MODULE_DEEP_AUDIT_CODE_VS_DOCS`
- linked report: `DEEP_GAP_AUDIT_CODE_VS_DOCS_2026-05-11.md`
- critical contradictions promoted from deep audit:
  - `DGA-P0-001`: chat redirect/copy implies active document work while `/wordy` mounts placeholder.
  - `DGA-P0-002`: template-use path resolves to `/wordy` but mounted runtime is not `WordyView`.
  - `DGA-P0-003`: state taxonomy inconsistency (`soon` vs `Kontakt wymagany`).
- docs decision after deep audit: `APPROVED_FOR_DOCS`.
- module-level execution decision after deep audit: `NEEDS_OWNER_DECISION`.

## 12. Deep RAW Addendum (`2026-05-11`)

- linked report: `DEEP_RAW_GAP_AUDIT_2026-05-11.md`
- RAW hard-rule delta reinforced:
  - Teresa-executed document work remains mandatory.
  - Menu 3/right-side contextual actions remain mandatory.
  - no-fake-active-runtime rule remains mandatory while `/wordy` mounts placeholder.
  - approval-before-export remains mandatory.
- unresolved owner-level gate:
  - `/wordy` runtime strategy (keep `V4ComingSoonView` vs mount `WordyView`) stays `NOT_DONE_OWNER`.

## 13. Stage 1.5 Ultra-Deep Audit Addendum (`2026-05-11`)

- linked report: `STAGE_1_5_ULTRA_DEEP_GAP_AUDIT_2026-05-11.md`
- normalized runtime reality:
  - `/wordy` route identity is real and coherent.
  - `/wordy` mounted runtime is `V4ComingSoonView`.
  - `WordyView` is an unmounted target/candidate runtime footprint, not As-Is route evidence.
  - Teresa/chat and template-use handoffs are user-facing contradictions until owner decides mount/copy/handoff strategy.
- final Stage 1.5 gate:
  - docs gate: `APPROVED_FOR_DOCS`
  - runtime gate: `BLOCKED_P1`
  - owner decision gate: `NEEDS_OWNER_DECISION`
