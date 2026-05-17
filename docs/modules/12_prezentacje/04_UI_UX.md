---
module_id: MODULE_PRESENTATIONS
doc_kind: UI_UX
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# UI/UX — Prezentacje / Generator Lane

## 1. Main Screen

As-Is: standalone generator lane `/prezentacje` is blocked/placeholder. Production presentations UX lives in `09_outputs` on `/presentations`. Future standalone generator runtime must preserve this ownership distinction and avoid creating a parallel Outputs library.

## 2. Runtime States

- Loading: placeholder does not load a deck workspace; future generator must show deck/template loading.
- Empty: placeholder must say the generator lane is blocked/coming soon and direct users to current presentations ownership when relevant.
- Error: placeholder must avoid raw internals; future errors must offer retry or fallback.
- Degraded: current state is blocked generator lane; future partial source/deck generation must be marked degraded.
- Success: no active standalone generator success exists as-is; production success belongs to Outputs/builder flows.

## 3. Menu 2 / Menu 3 Contract

As-Is: no active generator command system beyond the placeholder route. Future Menu 2 must follow executive module chips where applicable; future Menu 3 must be the active slide/deck command row/right-side contextual action slot.

## 4. AI Actions Placement

No active standalone generator AI actions are implemented as-is. Future deck AI actions must live in Menu 3/Dynamic Tabs/local command row right-side slot and must not be duplicated in slide canvas and Menu 3.

## 5. Next Action Guidance

The placeholder must tell the user that standalone generator is blocked and where current presentation work is owned. Future runtime must guide create, edit, source review, approve, present/export or retry flows.

## 6. Source / Evidence / Provenance

As-Is: no standalone generated deck claims are produced. Future generated slides must show source materials, assumptions and evidence, or explicitly mark missing sources.

## 7. Approval / Diff / Review

As-Is: no active standalone deck mutation exists. Future generated presentations require review/approval before final presentation/export and must support diff/review where relevant.

## 8. Anti-Patterns

- Creating a second production presentations library outside `09_outputs`.
- Presenting blocked generator lane as working deck runtime.
- AI actions duplicated in slide canvas and Menu 3.
- Source-free slide claims presented as approved.
- Exporting without review/approval.

## 9. As-Is Gaps

- Main screen is blocked/placeholder.
- Active production presentation UX is owned by `09_outputs`, not this module.
- No standalone generator runtime, provenance UI, review/diff UI or success flow are validated as implemented.

## 9A. Deep Audit UX Risk Matrix (Code vs Docs, 2026-05-11)

| Risk ID | Severity | UX risk | Code evidence | Docs delta |
| --- | --- | --- | --- | --- |
| `PR-DA-P0-001` | `P0` | User on `/prezentacje` can miss that active ownership is in `/presentations`. | `src/views/V4ComingSoonView.tsx`, `src/routes/AppRoutes.tsx` | Add explicit handoff copy requirement to canonical Outputs route. |
| `PR-DA-P1-001` | `P1` | Placeholder presents generic "contact required" flow instead of module ownership guidance-first flow. | `src/views/V4ComingSoonView.tsx` | Tighten placeholder UX doctrine in module acceptance checks. |
| `PR-DA-P1-002` | `P1` | Mandatory states are documented but not function-level audited against real placeholder lane behavior. | `src/views/V4ComingSoonView.tsx`, `functions/*.md` | Require per-function state evidence rows. |
| `PR-DA-P2-001` | `P2` | Visual audit screenshot unavailable for verification. | `NOT_DONE` | Keep visual assertion blocked until artifact path is available. |

## 9B. Deep RAW Hardening (2026-05-11)

- hard boundary remains explicit: `/prezentacje` is lane placeholder, `/presentations` is active outputs runtime.
- Menu 3 doctrine remains mandatory: contextual AI actions belong to right-side command row only; no canvas toolbar duplication.
- Teresa doctrine source is `impact-only` for module 12 in this pass and requires explicit owner closure record.
- placeholder UX must include ownership handoff semantics, not only generic contact gating copy.

## 9C. Stage 1.5 Ultra-Deep UI/UX Synchronization (2026-05-11)

Source: `STAGE_1_5_ULTRA_DEEP_GAP_AUDIT_2026-05-11.md`.

| UI/UX rule | Stage 1.5 decision | Evidence status |
| --- | --- | --- |
| `/prezentacje` must be honest about blocked standalone runtime | `KEEP + ENHANCE` | `AppRoutes.tsx` shows placeholder; explicit handoff copy remains `NOT_DONE` in runtime |
| `/presentations` remains active Outputs runtime | `KEEP_AS_09_RUNTIME` | `ReportsAndPresentationsHub`, `PresentationWizard`, `DeckBuilder` |
| Menu 3/right-side only for contextual AI actions | `KEEP + ENHANCE` | global rule + hub command row evidence; builder-specific proof remains future verification |
| Teresa deck-work execution rule | `OWNER_DECISION_REQUIRED` | impact-only RAW 104; not silently closed |
| MELS / executive layout | `DEFER_EVIDENCE` | source file not found at expected path in this pass |
| Visual screenshot proof | `NOT_DONE` | referenced asset unavailable |

UI hard stops for future runtime work:

- No contextual AI action may be added in the slide canvas, bottom canvas toolbar, or separate duplicated toolbar if it is also available in Menu 3/right-side command row.
- No future `/prezentacje` runtime may present export/share/publish as final delivery without visible review/approval and audit posture.
- No future `/prezentacje` runtime may duplicate the `/presentations` library as a second production Outputs owner.

## 10. Acceptance Criteria

- Sidebar/route lands on `/prezentacje`.
- Current UI honestly renders blocked/placeholder generator state.
- Contract explicitly points production presentations ownership to `09_outputs`.
- Future standalone runtime preserves Menu 3 AI placement, provenance visibility and approval/review gates.
- Placeholder UX explicitly shows the canonical active ownership path (`/presentations`) to reduce user confusion.
- Teresa deck-work execution hard-rule status is explicitly recorded as either `closed` or `owner decision pending` (no implicit state).
- Stage 1.5 final UI status remains `NEEDS_OWNER_DECISION` until Teresa binding and missing visual/MELS evidence are resolved or explicitly deferred by owner.

## 11. Function Annex — Presentation Generator Functions

| Function ID | Function | Entry / Route | As-Is state | UI Component Footprint (key) | Contract |
| --- | --- | --- | --- | --- | --- |
| `PR_GEN_PLACEHOLDER` | Generator Placeholder Runtime | `/prezentacje` | partial | `V4ComingSoonView` | `functions/PR_GEN_PLACEHOLDER.md` |
| `PR_GEN_RUNTIME_TARGET` | Generator Runtime Target | planned standalone generator on `/prezentacje` | partial | target `PrezentacjeView` runtime (not currently mounted) | `functions/PR_GEN_RUNTIME_TARGET.md` |
| `PR_OUTPUTS_OWNERSHIP_BOUNDARY` | Outputs Ownership Boundary | `/prezentacje` vs `/presentations` | real | route ownership and lane boundary contract | `functions/PR_OUTPUTS_OWNERSHIP_BOUNDARY.md` |
