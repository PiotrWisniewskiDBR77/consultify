---
module_id: MODULE_DOCUMENTS
doc_kind: DEEP_GAP_AUDIT_CODE_VS_DOCS
version: 1.0
owner: user
status: review
last_updated: 2026-05-11
scope_anchor: 10_dokumenty/MODULE_DEEP_AUDIT_CODE_VS_DOCS
work_type: docs-only
---

# Deep Gap Audit — Code vs Docs (`/wordy`)

## Scope

Audit compares As-Is runtime code against module 10 docs contract for `/wordy` and documents precise deltas with evidence.

## 1) As-Is Runtime Map (`route -> component -> behavior -> tests`)

| Layer | Code evidence | As-Is fact | Contract impact |
| --- | --- | --- | --- |
| Route identity | `src/routes/routeConfig.ts` (`ROUTES.WORDY`, `APP_VIEW_TO_ROUTE[AppView.WORDY]`) | `/wordy` is canonical route for `AppView.WORDY`. | aligns with docs |
| Route mount | `src/routes/AppRoutes.tsx` (`path={ROUTES.WORDY}`) | `/wordy` mounts `V4ComingSoonView` inside `ProtectedRoute` + `MainLayout`. | aligns with placeholder contract |
| Sidebar entry | `src/components/navigation/Sidebar/menuConfig.ts` (`MODULE_WORDY`) | Sidebar item exists, label `Documents`, badge `soon`. | partial alignment |
| Placeholder behavior | `src/views/V4ComingSoonView.tsx` (`copyByModule.wordy`) | Runtime is not editor; it is a contact-required/interest-capture page with marketing copy and CTA. | docs under-specify this variant |
| Target runtime implementation | `src/components/AIChat/KimiWorkspace/WordyView.tsx` | Full document artifact runtime exists in code (pipeline/reopen/template flows), but is not route-mounted. | aligns with "not mounted", but docs miss practical impact |
| Chat redirect behavior | `src/components/AIChat/UnifiedChatPanel.tsx` (document intent + output tool redirect to `/wordy`) | Teresa/chat redirects document requests to `/wordy` with message "starting work now". | contradiction with current placeholder reality |
| Template/use navigation | `src/components/ReportsAndPresentations/artifactNavigation.ts` (`report -> /wordy?templateArtifactId=...`) | Outputs templates "Use" action routes to `/wordy`, which currently lands on placeholder. | contradiction with expected target flow |
| Supporting tests | `tests/e2e/smoke/deploy-gate-wordy.spec.ts`, `tests/integration/routes/wordy-p22.pipeline.test.ts`, `tests/unit/utils/pilotAccess.test.ts` | E2E only checks no 5xx/console; backend pipeline tests exist; pilot policy blocks `/wordy` in pilot mode. | docs evidence matrix is incomplete |

## 2) Concrete Docs vs Code Contradictions

## P0

| ID | Contradiction | Code evidence | Docs evidence | Required docs closure |
| --- | --- | --- | --- | --- |
| `DGA-P0-001` | AI chat says document work starts now and redirects to `/wordy`, but `/wordy` is still placeholder contact page. | `UnifiedChatPanel.tsx` (`navigateToRoute('/wordy')`, redirect confirmation copy), `AppRoutes.tsx` (`V4ComingSoonView`) | `04_UI_UX.md` says no active AI doc actions as-is; no upstream redirect caveat | add explicit upstream redirect gap + `NOT_DONE` evidence row |
| `DGA-P0-002` | Template "use" path points to `/wordy`, but route does not mount `WordyView`. | `artifactNavigation.ts`, `WordyView.tsx`, `AppRoutes.tsx` | docs mention "not mounted" but not this broken handoff surface | add route-handoff contradiction in behavior/tests/cards |
| `DGA-P0-003` | State labeling is inconsistent (`soon` vs `Kontakt wymagany`) across module entry and runtime page. | `menuConfig.ts` badge `soon`; `V4ComingSoonView.tsx` wordy badge `Kontakt wymagany` | docs describe "coming soon" only | document dual-state and owner decision row |

## P1

| ID | Contradiction | Code evidence | Docs evidence | Required docs closure |
| --- | --- | --- | --- | --- |
| `DGA-P1-001` | E2E smoke test description says split-screen workspace, but assertions only check non-5xx/no console errors. | `tests/e2e/smoke/deploy-gate-wordy.spec.ts` | `07_ACCEPTANCE_AND_TESTS.md` currently uses generic "route/navigation smoke" | mark evidence quality as weak (`PASS_WITH_P2` / `NOT_DONE`) |
| `DGA-P1-002` | Backend artifact pipeline for `document/report` exists, but frontend route contract remains placeholder. | `tests/integration/routes/wordy-p22.pipeline.test.ts`, `WordyView.tsx`, `AppRoutes.tsx` | docs do not explicitly classify this as "backend-ready / frontend-not-mounted" split | add explicit split-readiness row |

## P2

| ID | Gap | Code evidence | Docs evidence | Required docs closure |
| --- | --- | --- | --- | --- |
| `DGA-P2-001` | No deterministic `/wordy` acceptance tests assert exact mounted component and deep-link behavior (`artifactId`, `templateArtifactId`). | no dedicated route assertion found in required tests | `07_ACCEPTANCE_AND_TESTS.md` lacks this specific row | add tests backlog row with `NOT_DONE` |

## 3) RAW Alignment (must / should / out)

## MUST

1. Document runtime is artifact-native (source, version, review, approval, export).
2. No misleading UX claims about active generation when runtime is blocked.
3. Review/approval remains explicit before export claims.
4. Teresa-executed document work must be truthful to mounted runtime behavior.

## SHOULD

1. Keep light interaction model and clear next-action guidance.
2. Keep one route truth for template/use and document generation handoff.
3. Preserve Menu 3/right-side placement doctrine for contextual AI actions.

## OUT

1. Pretending placeholder equals active Document Studio.
2. Silent/implicit finalization or approval.
3. Parallel undocumented route behavior for same document job.

## 4) As-Is vs Target vs Delta

| Axis | As-Is (code-verified) | Target (docs + RAW) | Delta |
| --- | --- | --- | --- |
| `/wordy` mount | `V4ComingSoonView` | `WordyView` Document Studio runtime | `DGA-P0-001`, `DGA-P0-002` |
| Chat-to-wordy handoff | active redirect intent from Teresa/chat | redirect only when route can execute document flow | `DGA-P0-001` |
| Template use handoff | `/wordy?templateArtifactId=...` currently hits placeholder | template use opens executable document runtime | `DGA-P0-002` |
| State labeling | mixed `soon` vs `Kontakt wymagany` | single canonical blocked-state taxonomy | `DGA-P0-003` |
| Evidence quality | smoke + backend tests, weak UI assertions | deterministic route/component/deep-link matrix | `DGA-P1-001`, `DGA-P2-001` |

## 5) Decision Register (KEEP / ENHANCE / NEW / DEFER)

| Decision | Type | Why | Evidence |
| --- | --- | --- | --- |
| Keep `/wordy` canonical route identity under module 10. | `KEEP` | route/appview/sidebar identity is coherent. | `routeConfig.ts`, `menuConfig.ts`, `AppRoutes.tsx` |
| Enhance docs with explicit "upstream redirect to blocked runtime" contradiction. | `ENHANCE` | current docs understate user-facing mismatch. | `UnifiedChatPanel.tsx` + `AppRoutes.tsx` |
| Add readiness split: backend document pipeline exists, frontend route not mounted. | `NEW` | prevents false "all blocked" or false "ready" claims. | `wordy-p22.pipeline.test.ts` + `AppRoutes.tsx` |
| Defer runtime resolution choice (mount `WordyView` vs keep placeholder). | `DEFER` | requires owner execution decision outside docs-only scope. | `NOT_DONE` owner decision |

## 6) Critical Thesis Chain (`RAW -> decision -> code/test evidence`)

| Thesis | RAW source | Decision | Code/Test evidence | Status |
| --- | --- | --- | --- | --- |
| Document Studio is not a text generator; it is governed artifact runtime. | `92/93/94` (UI_UX + RAW mirrors) | `KEEP` target doctrine | `WordyView.tsx` runtime exists; backend pipeline tests pass | `PASS_WITH_P1` (frontend mount missing) |
| UX must not claim active document generation when blocked. | `93/94` governance and workflow truthfulness | `ENHANCE` docs contradiction rows | `UnifiedChatPanel.tsx` redirect copy vs `/wordy` placeholder in `AppRoutes.tsx` | `NOT_DONE` |
| Template-driven generation should execute in document runtime. | `93` tryb 3 + template/approval flow | `ENHANCE` handoff contract | `artifactNavigation.ts` -> `/wordy?templateArtifactId=...`; route still placeholder | `NOT_DONE` |
| Explicit review/approval before export is mandatory. | `92/93/94` + module docs | `KEEP` doctrine | no mounted `/wordy` UI evidence yet; backend lifecycle exists | `NOT_DONE` |
| Teresa-executed document work should align with real runtime state. | hard UX gate + `104_RAW...` impact doctrine | `NEW` contradiction row | `UnifiedChatPanel.tsx` intent routing active, but target runtime absent | `NOT_DONE` |

## 7) Final Deep-Audit Verdict

- docs audit completion: `APPROVED_FOR_DOCS`
- runtime/code truth for `/wordy`: `BLOCKED_P1`
- decision type for this scope anchor: `NEEDS_OWNER_DECISION`

Reason: documentation can be made internally coherent with concrete contradictions and backlog rows, but runtime-path decision (`/wordy` placeholder vs mounted studio) must be owner-closed before any "ready" claim.
