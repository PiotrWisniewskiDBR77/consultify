---
module_id: MODULE_MY_WORK
doc_kind: UI_UX
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# UI/UX — Moja Praca / My Work

## 1. Main Screen

As-Is: `/my-work/*` uses `MyWorkView` with `SplitLayout` and `MyWorkHub` as the main runtime surface. The screen job is personal work orchestration: tabbed workspace UX, document/detail side flows, attention items and cross-module next actions.

## 2. Runtime States

- Loading: hub subviews must show explicit loading flags/spinners while personal work data is fetched.
- Empty: each tab/subview must explain why there is no work and what the user can do next.
- Error: failed work-queue or detail loads must surface toast/banner copy rather than raw errors.
- Degraded: feature/pilot restrictions or partial data must be visible and must not imply that all work is current.
- Success: completed refreshes, task transitions or opened details must confirm the result and route the user to the next logical step.

## 3. Menu 2 / Menu 3 Contract

Menu 2 keeps global app/module navigation. Menu 3 is the hub command row for the active My Work tab/detail context. `WorkspacePanelStrip` and module controls may expose context actions there; the canvas remains focused on the selected work surface.

## 4. AI Actions Placement

Chat/context actions must be invoked from hub command-row/right-side controls or equivalent Menu 3 slots. The module must not duplicate the same AI action in the work canvas and Menu 3.

## 5. Next Action Guidance

Every item, tab state and restriction must tell the user the next action: open owner module, continue review, retry, clear filters, request access or wait for data.

## 6. Source / Evidence / Provenance

Cross-module work cards must preserve owner-module context, source object and status. If the item is a projection from another module, My Work must not hide where the underlying record lives.

## 7. Approval / Diff / Review

My Work is an orchestration surface. Canonical edits of external objects must route to owner modules or explicit review flows; high-impact transitions require visible approval/review, not hidden direct writes.

## 8. Anti-Patterns

- Treating My Work as the source of truth for objects owned by other modules.
- Dead-end empty states without a next action.
- Hidden feature/pilot denial.
- Duplicate AI toolbar under the canvas.
- Success toast before owner-module write/read-back is confirmed.

## 9. As-Is Gaps

- Existing docs confirm tabbed hub, side flows and permission checks, but the full copy matrix for each tab's loading/empty/error/degraded state is not enumerated here.
- Runtime evidence for refresh resistance of every cross-module transition remains to be validated.

## 10. Acceptance Criteria

- `/my-work/*` renders `MyWorkView`/`MyWorkHub` as the documented main screen.
- Each hub tab exposes loading, empty, error, degraded and success states with next-step guidance.
- Contextual AI actions use Menu 3/right-side command placement only.
- Work items show source/owner-module provenance.
- High-impact actions route through owner-module approval/review flows.
