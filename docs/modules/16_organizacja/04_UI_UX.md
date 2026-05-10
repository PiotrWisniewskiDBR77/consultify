---
module_id: MODULE_ORGANIZATION
doc_kind: UI_UX
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# UI/UX — Organizacja

## 1. Main Screen

As-Is: `/organization/*` is the active module shell for organization context. `/context/*` remains transitional/legacy context-builder surface. The screen job is organization knowledge, context and memory management with route/menu ownership kept explicit.

## 2. Runtime States

- Loading: organization/context data loads must be visible before knowledge state is trusted.
- Empty: no-context/no-asset states must explain how to add or connect organization material.
- Error: failures must be business-readable and avoid raw internals.
- Degraded: processing, partial-ready, OCR-required, unreadable, policy-blocked, quota-blocked or legacy/transitional context must be visible.
- Success: successful ingestion/update must confirm what is ready, what remains processing and what the user should do next.

## 3. Menu 2 / Menu 3 Contract

Menu 2 keeps organization module navigation. Menu 3 is the active organization/context command row for selected asset, knowledge area, memory setting or context-builder surface.

## 4. AI Actions Placement

Contextual AI actions for organization context must live in Menu 3/right-side command placement or selected asset controls. They must not be duplicated in the canvas.

## 5. Next Action Guidance

Organization UX must guide add/upload material, wait for processing, resolve OCR/policy/quota issues, review source coverage, approve use in AI context or retry.

## 6. Source / Evidence / Provenance

Organization context is source-of-truth material. UI must show asset/source identity, processing state, lineage and readiness before AI can use it. Missing or blocked context must be explicit.

## 7. Approval / Diff / Review

High-impact memory/context changes, permission changes and AI-use approvals require review/approval. No hidden learning or background memory write is allowed.

## 8. Anti-Patterns

- Hidden learning outside controlled stewardship/private-mode rules.
- Showing metadata-only upload as understood content.
- Hiding policy/quota/ACL blocks.
- AI actions duplicated in canvas and Menu 3.
- Legacy `/context/*` ambiguity without ownership copy.

## 9. As-Is Gaps

- Existing docs confirm active `/organization/*` shell and transitional `/context/*`, but the full ingestion readiness UI matrix is not enumerated here.
- Runtime evidence for lineage and readiness display across all organization asset types remains to be validated.

## 10. Acceptance Criteria

- `/organization/*` is documented as canonical organization ownership; `/context/*` is transitional/legacy.
- Runtime states include loading, empty, error, degraded and success with next-step guidance.
- AI actions use Menu 3/right-side placement without duplication.
- Context sources, readiness and lineage are visible.
- Memory/context mutations require review/approval and cannot be hidden.
