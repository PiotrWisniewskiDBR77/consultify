---
module_id: MODULE_PRESENTATIONS
doc_kind: DEEP_GAP_AUDIT_CODE_VS_DOCS
version: 1.0
owner: user
status: review
last_updated: 2026-05-11
scope_anchor: 12_prezentacje/MODULE_DEEP_AUDIT_CODE_VS_DOCS
work_type: docs-only
---

# Deep Gap Audit — Code vs Docs (2026-05-11)

## 1) Scope and Method

This audit validates real runtime behavior for the module 12 lane against module docs:

- lane route: `/prezentacje`
- ownership boundary route family: `/presentations`
- comparison type: code truth vs module contract truth
- mode: docs-only

Mandatory code and docs sources from the task packet were used.

## 2) As-Is Runtime Map (Code Truth)

| Surface | Code truth | Evidence |
| --- | --- | --- |
| Route declaration | `/prezentacje` exists as `ROUTES.PREZENTACJE_GEN`; `/presentations` exists as `ROUTES.PRESENTATIONS` | `src/routes/routeConfig.ts` |
| AppView mapping | `AppView.PREZENTACJE_GEN -> /prezentacje`; `AppView.PRESENTATIONS -> /presentations` | `src/routes/routeConfig.ts`, `src/types/core.ts` |
| Sidebar entries | Two distinct entries: `MODULE_PREZENTACJE_GEN` (`badge: soon`) and `MODULE_PRESENTATIONS` (Outputs library) | `src/components/navigation/Sidebar/menuConfig.ts` |
| `/prezentacje` mounted view | Renders `V4ComingSoonView` under protected route | `src/routes/AppRoutes.tsx` |
| `/presentations` mounted view | Renders `ReportsAndPresentationsHub` | `src/routes/AppRoutes.tsx`, `src/components/ReportsAndPresentations/ReportsAndPresentationsHub.tsx` |
| Presentation runtime tools | `/presentations/wizard -> PresentationWizard`; `/presentations/builder/:deckId -> DeckBuilder` | `src/routes/AppRoutes.tsx`, `src/components/Presentations/PresentationWizard.tsx`, `src/components/Presentations/DeckBuilder/DeckBuilder.tsx` |
| Standalone target runtime | `PrezentacjeView` is imported but not route-mounted | `src/routes/AppRoutes.tsx`, `src/components/AIChat/KimiWorkspace/PrezentacjeView.tsx` |

## 3) As-Is Ownership Boundary

### `/prezentacje` lane

- blocked placeholder lane with contact/interest CTA (`V4ComingSoonView`)
- no mounted deck workspace runtime
- no route-level generator state machine

### `/presentations` family

- active outputs runtime
- hub (`ReportsAndPresentationsHub`) with tabs and outputs taxonomy
- active generator tools through wizard/builder routes
- reports routes redirect into `/presentations?tab=documents`

## 4) Hard Docs-vs-Code Gaps

| Gap ID | Severity | Gap | Why it matters |
| --- | --- | --- | --- |
| `PR-DA-P0-001` | `P0` | Placeholder UX for `/prezentacje` does not explicitly redirect or point to active ownership route `/presentations`. | Users can misread blocked lane as commercial gate for the same runtime instead of clear ownership split. |
| `PR-DA-P1-001` | `P1` | Function contracts use stale evidence path `src/router/routeConfig.ts` (actual path is `src/routes/routeConfig.ts`). | Weakens traceability and acceptance audit reliability. |
| `PR-DA-P1-002` | `P1` | Module docs describe mandatory state contract, but placeholder runtime is a generic marketing block and does not show explicit lane states tied to ownership handoff. | UX trust risk in blocked/error/degraded semantics. |
| `PR-DA-P2-001` | `P2` | Deep audit visual evidence asset from task packet is still unavailable in workspace. | Visual claim verification cannot be closed in this pass. |

## 5) RAW Alignment

### Must

1. Governed artifact runtime and explicit ownership boundaries.
2. No silent high-impact delivery actions.
3. Explicit review/approval before high-impact publish/export claims.
4. Clear user-facing state semantics.

### Should

1. Gamma-like flow continuity (`setup -> outline -> generate -> builder -> deliver`).
2. Source/provenance visibility and reviewability.
3. Lightweight lane UX with no toolbar duplication.

### Out

1. Runtime remount of `PrezentacjeView` to `/prezentacje` in this pass.
2. Runtime/component code edits.

## 6) As-Is / Target / Delta

| Axis | As-Is | Target | Delta |
| --- | --- | --- | --- |
| Lane runtime | `/prezentacje` = `V4ComingSoonView` | explicit placeholder with clear handoff to canonical active runtime | `ENHANCE` |
| Ownership runtime | `/presentations` hosts active hub/wizard/builder | keep as canonical owner for current production flow | `KEEP` |
| Standalone generator | code exists (`PrezentacjeView`) but unmounted | either mount with governance or keep explicitly deferred | `DEFER_RUNTIME` |
| Approval/export doctrine | present in product docs and builder UX patterns | hard-link doctrine to function acceptance and audit chains | `ENHANCE` |

## 7) KEEP / ENHANCE / NEW / DEFER Decisions

| Function | Decision | Rationale |
| --- | --- | --- |
| `PR_GEN_PLACEHOLDER` | `KEEP + ENHANCE` | Keep blocked lane truth; enhance ownership handoff clarity and state semantics. |
| `PR_GEN_RUNTIME_TARGET` | `KEEP_DOC_TARGET + DEFER_RUNTIME` | Runtime exists in code but is not route-mounted; keep target contract without shipping claim. |
| `PR_OUTPUTS_OWNERSHIP_BOUNDARY` | `KEEP + ENHANCE` | Boundary is correct and code-backed; enhance explicit UX and acceptance evidence around it. |

## 8) RAW -> Decision -> Evidence Chain

| RAW thesis | Decision | Code/test evidence |
| --- | --- | --- |
| Standalone lane must not fake active runtime ownership | `KEEP` | `src/routes/AppRoutes.tsx`, `src/views/V4ComingSoonView.tsx` |
| Active production presentation flow is output-family runtime | `KEEP` | `src/routes/AppRoutes.tsx`, `src/components/ReportsAndPresentations/ReportsAndPresentationsHub.tsx`, `tests/unit/routes/routeConfig.test.ts` |
| Wizard + builder are active toolchain surfaces | `KEEP` | `src/routes/AppRoutes.tsx`, `src/components/Presentations/PresentationWizard.tsx`, `src/components/Presentations/DeckBuilder/DeckBuilder.tsx` |
| AI actions must be governed, review-first, no silent export/share | `ENHANCE` | `src/components/Presentations/DeckBuilder/DeckBuilder.tsx`, `docs/product/PREZENTACJE_V8_AI_GOVERNANCE.md` |
| Placeholder must explicitly prevent ownership confusion for users | `ENHANCE` | `NOT_DONE` (missing explicit `/presentations` handoff in `V4ComingSoonView` copy) |
| Screenshot-based visual proof | `NOT_DONE` | declared asset path not found |

## 9) Audit Verdict

- docs gate: `NEEDS_OWNER_DECISION`
- runtime gate: `BLOCKED_P1`

Reason:

1. Code truth and docs truth are mostly aligned on route ownership split.
2. A hard UX clarification gap remains on `/prezentacje` placeholder handoff messaging.
3. Evidence chain quality still has stale path references and missing visual artifact evidence.
