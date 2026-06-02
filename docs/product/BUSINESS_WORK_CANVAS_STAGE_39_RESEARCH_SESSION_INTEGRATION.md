# Business Work Canvas Stage 39 ResearchSession Integration

Status: `PASSED`
Owner: Product + Engineering
Created: 2026-05-03
Parent plan: `docs/product/BUSINESS_WORK_CANVAS_IMPLEMENTATION_PLAN.md`

## 1. Purpose

Stage 39 connects Research Canvas to the existing `ResearchSession` runtime.

Research in Canvas must not become a second independent research system. A research draft can still start as Markdown, but the research mission needs a durable `ResearchSession` anchor so evidence, sources, confidence, final artifacts and follow-up work can converge on one runtime.

## 2. Completed Scope

- Added `researchSessionId` to frontend Canvas document state and active document context.
- Preserved `researchSessionId` through draft response mapping.
- Added `researchSessionId` to Canvas context packet active draft and memory anchors.
- Planned a `ResearchSession` when the Research starter is selected from a conversation.
- Persisted the planned session id on the Work Canvas draft.
- Displayed the linked `ResearchSession` in Canvas diagnostics.
- Added frontend coverage for Research starter to `ResearchSession` linking.
- Added backend coverage for `research_session_id` persistence on draft creation.

## 3. Safety Contract

- `/api/research/sessions` remains the source of truth for research lifecycle.
- Work Canvas stores only the `researchSessionId` anchor; it does not duplicate evidence graph state.
- The AI context packet carries the research session anchor, not raw evidence graph payloads.
- Research Canvas remains capability `partial` until evidence execution, sources/confidence panels and final artifact handoff are fully surfaced in Canvas.

## 4. Quality Gate

Stage 39 passes only when:

- Research starter creates a planned `ResearchSession` when a conversation id exists,
- draft creation persists `researchSessionId`,
- response mapping keeps `researchSessionId` in Canvas state,
- diagnostics and AI context anchors expose the linked session id,
- targeted frontend/backend tests pass,
- changed files have no linter errors.
