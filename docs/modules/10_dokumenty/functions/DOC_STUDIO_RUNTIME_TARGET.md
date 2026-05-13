---
module_id: MODULE_DOCUMENTS
function_id: DOC_STUDIO_RUNTIME_TARGET
function_name: Documents — Document Studio Runtime Target
doc_kind: FUNCTION_CONTRACT
status: draft
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-11
---

# Function Contract — Document Studio Runtime Target

## 1. Function Identity
- Function ID: `DOC_STUDIO_RUNTIME_TARGET`
- Intended runtime anchor: `WordyView`/Document Studio surface
- Current mounted status: `partial` (imported but not mounted on launch route)

## 2. User Job and Business Outcome
- Purpose: preserve target runtime contract while staying honest about As-Is gap.

## 3. Trigger and Entry Points
- Primary trigger and entry points follow the route/runtime scope documented in Section 1.

## 4. UI Component Footprint
- UI footprint follows the mounted runtime anchor and standard module layout components.

## 5. Inputs, Data Contracts, and Dependencies
- Inputs: document artifacts, templates, sources and review workflows (target-state).

## 6. Outputs and Side Effects
- Outputs: governed document editing/review/export flows (target-state).

## 7. Ownership and Handoff Boundaries
- Boundaries: this contract does not claim active production mounting today.

## 8. Runtime States and UX Behavior
- Runtime behavior must keep loading/empty/error/degraded/success states explicit with next-step guidance.

## 9. AI, Source, Evidence, Approval
- AI actions, source visibility, and approval expectations follow Menu 3 placement and auditable review rules.

## 10. Security, Roles, and Tenancy
- Security is deny-by-default with tenant/ACL and role boundaries enforced for this function.

## 11. Acceptance Criteria and Test Evidence

- Acceptance checks: section maintained; explicit evidence mapping required for gate compliance.

- Route evidence: module route/view scope for `10_dokumenty` in router declarations (`src/router/routeConfig.ts` and/or `src/AppRoutes.tsx`) and module view path references.
- Component evidence: module UI footprint under `src/components/**` and `src/views/**` for `10_dokumenty` function surface.
- API evidence: integration boundary through `src/services/api.ts` and backend route ownership in `server/src/routes/**` when endpoint-level mapping is not explicitly documented.
- Test evidence: module regression coverage references in `tests/**` and `tests/e2e/**` aligned to `10_dokumenty` user flows.

## 11A. RAW Chain Note

- RAW thesis: template/use and approval-governed document generation must resolve to executable runtime.
- Decision: `ENHANCE` split-readiness and handoff contradiction tracking.
- Evidence: `03_BEHAVIOR.md` (`DGA-P0-002`), `07_ACCEPTANCE_AND_TESTS.md` deep rows, `DEEP_RAW_GAP_AUDIT_2026-05-11.md`.

## 11B. Stage 1.5 Split-Readiness Note

- Stage 1.5 thesis: `WordyView` is a target/candidate runtime footprint, not current `/wordy` route evidence.
- Decision: `NEW_SPLIT_READINESS`.
- Evidence: `STAGE_1_5_ULTRA_DEEP_GAP_AUDIT_2026-05-11.md`, `src/components/AIChat/KimiWorkspace/WordyView.tsx`, `src/routes/AppRoutes.tsx`.
- NOT_DONE: route/component/API/test proof that `WordyView` is mounted and enforces Teresa, Menu 3, approval-before-export and provenance rules.

## 12. Open Risks and Change Log
- Risk: template/use and chat handoff paths already point to `/wordy`, but route mount still resolves to placeholder.
- Risk: backend pipeline readiness may be misread as frontend runtime readiness without explicit split-gate evidence.
