---
module_id: MODULE_INTERVIEW
function_id: WY_PENDING_REVIEW
function_name: Interview — Pending Review
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
last_updated: 2026-05-10
---

# Function Contract — Pending Review

## 1. Function Identity
- Function ID: `WY_PENDING_REVIEW`
- UI labels: `Pending Review`
- Scope: Interview tab `pending_review`
- Feature state: `real` (permission-dependent)

## 2. User Job and Business Outcome
- User job: review pending interview insights/actions before final acceptance.
- Outcome: governance quality and reduced unreviewed conclusions.

## 3. Trigger and Entry Points
- Entry: `pending_review` tab when review permissions are available.

## 4. UI Component Footprint
- Review-filtered views in `InterviewHub` using shared table/preview controls.

## 5. Inputs, Data Contracts, and Dependencies
- Pending insight/assignment review sets and status metadata.
- Dependencies: Interview API review/state endpoints.

## 6. Outputs and Side Effects
- Review approvals/rejections/send-back transitions.

## 7. Ownership and Handoff Boundaries
- Owner: interview review state.
- Must not auto-approve or silently finalize downstream impact.

## 8. Runtime States and UX Behavior
- Loading/empty/error/degraded/success states with clear review next actions.

## 9. AI, Source, Evidence, Approval
- AI can assist reviewers but cannot replace explicit approval action.
- Source/session provenance is mandatory in review context.

## 10. Security, Roles, and Tenancy
- Role-gated review surface; deny by default when uncertain.

## 11. Acceptance Criteria and Test Evidence
- Pending review tab appears only for authorized review contexts.
- Review actions are explicit and visible.
- Evidence: `InterviewHub.tsx` tab and review-state handling.

## 12. Open Risks and Change Log
- Risk: hidden review assumptions if reviewer permissions drift.
- Change log: initial function contract created.
