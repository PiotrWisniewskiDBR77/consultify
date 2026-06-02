---
module_id: MODULE_DOCUMENTS
doc_kind: BEHAVIOR
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-11
---

# Behavior — Dokumenty / Wordy

## As-Is Runtime Behavior

- Module entry is reachable from sidebar and direct route, but user lands on `V4ComingSoonView`.
- No Document Studio transactional workflow is mounted under `/wordy` in current `AppRoutes`.
- Navigation identity is stabilized by `AppView.WORDY` in `src/types/core.ts` and `APP_VIEW_TO_ROUTE` mapping in `routeConfig.ts`.
- `/wordy` is auth-protected and wrapped with `MainLayout` + `ProtectedRoute`.
- Chat-level document intents and output-tool redirects can actively route users to `/wordy` even though mounted runtime stays placeholder.

## Function Runtime Breakdown

- `DOC_WORDY_PLACEHOLDER`: active function on `/wordy` delivering coming-soon state.
- `DOC_STUDIO_RUNTIME_TARGET`: documented target runtime function, currently not mounted.
- `WordyView` target runtime exists in code and backend pipeline tests, but not in route mount.

## As-Is Contradiction Register (Code vs Docs)

| ID | Contradiction | Evidence | Status |
| --- | --- | --- | --- |
| `DGA-P0-001` | Chat announces active document work and redirects to `/wordy`, but `/wordy` is placeholder page. | `src/components/AIChat/UnifiedChatPanel.tsx`, `src/routes/AppRoutes.tsx` | `OPEN` |
| `DGA-P0-002` | Template "use" path routes to `/wordy?templateArtifactId=...`, but route does not mount `WordyView`. | `src/components/ReportsAndPresentations/artifactNavigation.ts`, `src/routes/AppRoutes.tsx` | `OPEN` |
| `DGA-P0-003` | Module state labels are inconsistent (`soon` in sidebar vs `Kontakt wymagany` in runtime placeholder page). | `src/components/navigation/Sidebar/menuConfig.ts`, `src/views/V4ComingSoonView.tsx` | `OPEN` |

## Hard-Rule Behavior Chains (`RAW -> decision -> evidence`)

| Rule thesis | RAW source | Decision | Code evidence | Status |
| --- | --- | --- | --- | --- |
| Teresa-executed document work is mandatory. | `docs/UI_UX/104_RAW_CONVERSATIONAL_WORK_OS_TERESA_CHAT_ENGINE_2026-05-09.md` (impact-only) | `ENHANCE` | Teresa/chat can route to `/wordy`; mounted route stays placeholder, so draft/edit/review execution remains `NOT_DONE` | `NOT_DONE` |
| No fake active-runtime claim while placeholder is mounted. | `docs/RAW/document-studio/93_RAW_DOCUMENT_STUDIO_ANALYSIS_2026-05-09.md`, `docs/RAW/document-studio/94_RAW_DOCUMENT_STUDIO_AI_NATIVE_ARTIFACT_ENGINE_2026-05-09.md` | `KEEP` + `ENHANCE` | `/wordy` mount in `AppRoutes.tsx` + upstream redirect copy in `UnifiedChatPanel.tsx` | `OPEN` |
| Approval-before-export remains mandatory for runtime target. | `docs/RAW/document-studio/92_RAW_DOCUMENT_STUDIO_RESEARCH_2026-05-08.md` + `93/94` | `KEEP` | target `WordyView` not mounted on `/wordy` | `NOT_DONE` |

## Must

- MUST keep route/appview/sidebar mapping aligned across `menuConfig.ts`, `routeConfig.ts`, and `AppRoutes.tsx`.
- MUST preserve module ownership boundaries defined in global operating docs.
- MUST expose blocked/placeholder state honestly when runtime is not yet mounted.

## Must Not

- MUST NOT treat target-state RAW assumptions as current behavior.
- MUST NOT move ownership from canonical module boundaries documented in As-Is global docs.
- MUST NOT hide route aliasing or legacy surfaces from module contract narrative.

## Acceptance Criteria (Behavior)

- [ ] Direct navigation to launch route resolves to documented current runtime.
- [ ] AppView-to-route mapping resolves to the same module owner.
- [ ] Cross-module ownership statements match global resolved decisions.
- [ ] Upstream chat/template handoffs do not claim active runtime behavior when mount is placeholder.
