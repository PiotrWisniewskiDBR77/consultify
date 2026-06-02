---
module_id: MODULE_DOCUMENTS
function_id: DOC_WORDY_PLACEHOLDER
doc_kind: FUNCTION_EXECUTION_CARD
owner_business: user
owner_tech: user
status: REVIEW
last_updated: 2026-05-11
work_type: docs-only
---

# Function Execution Card — DOC_WORDY_PLACEHOLDER

## 1. Metadata

- scope_anchor: `10_dokumenty/DOC_WORDY_PLACEHOLDER`
- primary_module: `10_dokumenty`
- primary_function: `DOC_WORDY_PLACEHOLDER`
- work_type: `docs-only`

## 2. Scope Anchor

- In scope:
  - placeholder truth contract for `/wordy`
  - hard UX rules mapped to placeholder behavior
  - evidence rows for states and next-action guidance
- Out of scope:
  - runtime/component/API edits
  - mounting `WordyView` as active runtime

## 3. Dependency Scope

| Dependency | Allowed use | Forbidden use |
| --- | --- | --- |
| `DOC_STUDIO_RUNTIME_TARGET` | target-state reference for gap framing | claiming target runtime as As-Is behavior |

## 4. Source Inputs

- `docs/modules/10_dokumenty/functions/DOC_WORDY_PLACEHOLDER.md`
- `docs/modules/10_dokumenty/03_BEHAVIOR.md`
- `docs/modules/10_dokumenty/04_UI_UX.md`
- `docs/modules/10_dokumenty/07_ACCEPTANCE_AND_TESTS.md`
- `docs/UI_UX/93_RAW_DOCUMENT_STUDIO_ANALYSIS_2026-05-09.md`
- `docs/UI_UX/94_RAW_DOCUMENT_STUDIO_AI_NATIVE_ARTIFACT_ENGINE_2026-05-09.md`
- `docs/UI_UX/104_RAW_CONVERSATIONAL_WORK_OS_TERESA_CHAT_ENGINE_2026-05-09.md` (impact-only for hard UX parity)
- `docs/modules/10_dokumenty/DEEP_RAW_GAP_AUDIT_2026-05-11.md`
- `docs/modules/10_dokumenty/STAGE_1_5_ULTRA_DEEP_GAP_AUDIT_2026-05-11.md`

## 5. RAW -> Decision -> Evidence Chain

| Task ID | RAW requirement | Decision | Evidence |
| --- | --- | --- | --- |
| `DOC-WORDY-P0-001` | placeholder state must be explicit and not masquerade as active editor | `KEEP` | `03_BEHAVIOR.md`, `04_UI_UX.md`, `07_ACCEPTANCE_AND_TESTS.md` |
| `DOC-WORDY-P0-002` | no UX claim should imply active generation when runtime is blocked | `ENHANCE` | `DEEP_GAP_AUDIT_CODE_VS_DOCS_2026-05-11.md`, `UnifiedChatPanel.tsx` + `AppRoutes.tsx` contradiction row |
| `DOC-WORDY-P0-003` | hard-rule chain must stay explicit (`Teresa`, `Menu3`, `no fake runtime`) | `ENHANCE` | `DEEP_RAW_GAP_AUDIT_2026-05-11.md`, `04_UI_UX.md`, `07_ACCEPTANCE_AND_TESTS.md` |
| `DOC-WORDY-P0-004` | `/wordy` route is real but active mount is placeholder, and upstream handoff contradiction is owner-gated | `KEEP_AS_IS_TRUTH` + `DEFER_OWNER` | `STAGE_1_5_ULTRA_DEEP_GAP_AUDIT_2026-05-11.md`, `AppRoutes.tsx`, `V4ComingSoonView.tsx`, `UnifiedChatPanel.tsx` |
| `DOC-WORDY-P1-001` | Teresa-executed document work + Menu 3/right-side contextual actions only | `ENHANCE` | docs contract rows `PASS`; runtime component proof `NOT_DONE` |
| `DOC-WORDY-P2-001` | mandatory states with next-action guidance and no hidden approvals/writes | `NEW` | docs evidence matrix `PASS_WITH_P2`; dedicated test pack `NOT_DONE` |

## 6. Gap Register

| Task ID | Priority | Gap | Status |
| --- | --- | --- | --- |
| `DOC-WORDY-P0-001` | `P0` | placeholder contract needs explicit hard-UX mapping in module packet and acceptance matrix | `READY` |
| `DOC-WORDY-P0-002` | `P0` | chat redirect and state-label inconsistency (`soon` vs `Kontakt wymagany`) need explicit contract treatment | `READY` |
| `DOC-WORDY-P0-004` | `P0` | Stage 1.5 must prevent false runtime claims by separating route identity from mounted runtime and unmounted target footprint | `READY` |
| `DOC-WORDY-P1-001` | `P1` | no runtime evidence that Teresa can execute document draft/edit/review/read-back and that Menu 3 is sole contextual AI action slot | `WAITING_P0` |
| `DOC-WORDY-P2-001` | `P2` | no deep state-evidence pack (loading/empty/error/degraded/success + next actions) | `WAITING_P0` |

## 7. Evidence Plan

| Claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| `/wordy` resolves to honest placeholder runtime. | `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx` | `V4ComingSoonView` | n/a | route mapping + navigation smoke | `PASS_DOCS` |
| Chat redirect to `/wordy` does not over-claim active execution. | `/wordy` route mount | `UnifiedChatPanel` document-intent redirect copy | n/a | dedicated assertion missing | `NOT_DONE` |
| Placeholder explains blocked state and directs user to next useful action. | `/wordy` contract notes | placeholder view copy/content rules | n/a | manual UI smoke + copy check | `PASS_WITH_P2` |
| No duplicate AI toolbar; contextual actions belong to Menu 3/right slot. | route-level module shell | `WordyView`/module shell command row (target runtime) | n/a | component/UI assertion | `NOT_DONE` |
| Upstream handoffs are truthful while placeholder is mounted. | `/wordy` route mount | `UnifiedChatPanel` + template-use paths | n/a | copy/handoff regression | `NOT_DONE_OWNER` |

## 8. Done Gate

- contract complete: `PASS`
- UI/UX hard rules mapped: `PASS_WITH_P2`
- evidence complete: `PASS_WITH_P2`
- implementation backlog ready: `PASS`
- owner acceptance: `PENDING`
