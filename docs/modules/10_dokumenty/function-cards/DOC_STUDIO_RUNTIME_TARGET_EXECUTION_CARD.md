---
module_id: MODULE_DOCUMENTS
function_id: DOC_STUDIO_RUNTIME_TARGET
doc_kind: FUNCTION_EXECUTION_CARD
owner_business: user
owner_tech: user
status: REVIEW
last_updated: 2026-05-11
work_type: docs-only
---

# Function Execution Card — DOC_STUDIO_RUNTIME_TARGET

## 1. Metadata

- scope_anchor: `10_dokumenty/DOC_STUDIO_RUNTIME_TARGET`
- primary_module: `10_dokumenty`
- primary_function: `DOC_STUDIO_RUNTIME_TARGET`
- work_type: `docs-only`

## 2. Scope Anchor

- In scope:
  - target runtime contract closure for Document Studio
  - RAW synthesis (`must/should/out`)
  - explicit review/approval-before-export doctrine
  - function-level evidence rows and gaps
- Out of scope:
  - route mount changes
  - API and component implementation

## 3. Dependency Scope

| Dependency | Allowed use | Forbidden use |
| --- | --- | --- |
| `DOC_WORDY_PLACEHOLDER` | As-Is baseline and rollout guardrail | replacing placeholder truth before runtime evidence exists |

## 4. Source Inputs

- `docs/modules/10_dokumenty/functions/DOC_STUDIO_RUNTIME_TARGET.md`
- `docs/modules/10_dokumenty/01_PURPOSE.md`
- `docs/modules/10_dokumenty/02_SCOPE.md`
- `docs/modules/10_dokumenty/04_UI_UX.md`
- `docs/modules/10_dokumenty/05_DATA_AND_INTEGRATIONS.md`
- `docs/modules/10_dokumenty/06_PERMISSIONS_AND_SECURITY.md`
- `docs/modules/10_dokumenty/07_ACCEPTANCE_AND_TESTS.md`
- `docs/UI_UX/92_RAW_DOCUMENT_STUDIO_RESEARCH_2026-05-08.md`
- `docs/UI_UX/93_RAW_DOCUMENT_STUDIO_ANALYSIS_2026-05-09.md`
- `docs/UI_UX/94_RAW_DOCUMENT_STUDIO_AI_NATIVE_ARTIFACT_ENGINE_2026-05-09.md`
- `docs/product/V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_FUNCTIONAL_SPEC.md`
- `docs/product/V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_IMPLEMENTATION_PLAN.md`
- `docs/modules/10_dokumenty/DEEP_RAW_GAP_AUDIT_2026-05-11.md`
- `docs/modules/10_dokumenty/STAGE_1_5_ULTRA_DEEP_GAP_AUDIT_2026-05-11.md`

## 5. RAW -> Decision -> Evidence Chain

| Task ID | RAW requirement | Decision | Evidence |
| --- | --- | --- | --- |
| `DOC-STUDIO-P0-001` | Document Studio is artifact-native (sources, versions, diff, governance, export). | `KEEP` + `ENHANCE` | `01_PURPOSE.md`, `02_SCOPE.md`, `05_DATA_AND_INTEGRATIONS.md`, `RAW_TARGET_STATE_2_0_PACKET.md` |
| `DOC-STUDIO-P0-002` | template/use and chat handoff must resolve to executable runtime truth | `ENHANCE` | `DEEP_GAP_AUDIT_CODE_VS_DOCS_2026-05-11.md`, `artifactNavigation.ts`, `AppRoutes.tsx` |
| `DOC-STUDIO-P0-003` | hard RAW thesis chain must be explicit for Teresa/Menu3/approval/no-fake-runtime | `ENHANCE` | `DEEP_RAW_GAP_AUDIT_2026-05-11.md`, `04_UI_UX.md`, `07_ACCEPTANCE_AND_TESTS.md` |
| `DOC-STUDIO-P0-004` | `WordyView` is target/candidate footprint, not active `/wordy` route proof | `NEW_SPLIT_READINESS` | `STAGE_1_5_ULTRA_DEEP_GAP_AUDIT_2026-05-11.md`, `WordyView.tsx`, `AppRoutes.tsx` |
| `DOC-STUDIO-P1-001` | review/approval is mandatory before final output/export claims | `ENHANCE` | docs-level matrix `PASS_WITH_P1`; route/component/API/test proof `NOT_DONE` |
| `DOC-STUDIO-P2-001` | mandatory lifecycle states + next actions + provenance depth | `NEW` | docs evidence rows `PASS_WITH_P2`; deep test evidence `NOT_DONE` |

## 6. Gap Register

| Task ID | Priority | Gap | Status |
| --- | --- | --- | --- |
| `DOC-STUDIO-P0-001` | `P0` | target contract lacked unified packet + decision register + normalized deltas | `READY` |
| `DOC-STUDIO-P0-002` | `P0` | template-use and route mount mismatch (`/wordy` handoff -> placeholder) requires explicit split-readiness doctrine | `READY` |
| `DOC-STUDIO-P0-003` | `P0` | hard-rule thesis chain needs normalized RAW linkage and evidence status taxonomy | `READY` |
| `DOC-STUDIO-P0-004` | `P0` | Stage 1.5 must prevent `WordyView` import/pipeline support from being treated as mounted runtime evidence | `READY` |
| `DOC-STUDIO-P1-001` | `P1` | no runtime proof for explicit approval-before-export gate | `WAITING_P0` |
| `DOC-STUDIO-P2-001` | `P2` | no deep evidence for full lifecycle/provenance hardening | `WAITING_P0` |

## 7. Evidence Plan

| Claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| Target runtime remains documented as planned, not currently mounted. | `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx` | `WordyView` import footprint | n/a | route mapping check | `PASS_DOCS` |
| Template "use" handoff reaches executable document runtime. | `/wordy?templateArtifactId=...` | `artifactNavigation.ts` + `WordyView` support | report-builder/artifact substrate | no deterministic front-end assertion | `NOT_DONE` |
| Final output/export claims require explicit review/approval state. | target `/wordy` flow contract | review panel + approval card states | artifact review/export endpoints | dedicated approval-before-export regression | `NOT_DONE` |
| Runtime states include next-action guidance for blocked and success paths. | target runtime route contract | studio state surfaces and command row guidance | lifecycle/status reads | state matrix tests/manual evidence | `NOT_DONE` |
| `WordyView` footprint proves mounted Document Studio. | `/wordy` route mount | `WordyView` exists but is not mounted by `AppRoutes.tsx` | artifact pipeline may exist | deterministic mount test missing | `NOT_DONE` |

## 8. Done Gate

- contract complete: `PASS`
- RAW alignment complete: `PASS`
- evidence complete: `PASS_WITH_P1`
- implementation backlog ready: `PASS`
- owner acceptance: `PENDING`
