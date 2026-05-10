---
module_id: MODULE_PARTNER_PORTAL
doc_kind: UI_UX
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# UI/UX — Portal Partnerski

## 1. Main Screen

As-Is: `/partner/*` is the protected partner portal ownership. Public partner acquisition routes are related but not portal-internal ownership. The screen job is partner workflow, partner deliverables and access-boundary management.

## 2. Runtime States

- Loading: partner account, deliverable and workflow data must show loading before being trusted.
- Empty: no-deliverable/no-workflow states must explain what partner action or internal setup is needed.
- Error: failures must show business-readable error states and avoid raw internals.
- Degraded: restricted access, incomplete onboarding, partial deliverables or separated public/protected contexts must be visible.
- Success: partner submissions, status updates or deliverable actions must confirm outcome and next partner/internal step.

## 3. Menu 2 / Menu 3 Contract

Menu 2 keeps partner portal navigation. Menu 3 is the active partner command row for selected workflow, deliverable, request or account context.

## 4. AI Actions Placement

Any contextual AI assistance for partner deliverables or workflow review must live in Menu 3/right-side command placement or selected record controls. It must not be duplicated in the portal canvas.

## 5. Next Action Guidance

Partner UX must tell the user whether to complete onboarding, submit/request information, review deliverable, retry, contact owner, request access or wait for internal approval.

## 6. Source / Evidence / Provenance

Partner deliverables and workflow claims must show source request, partner account/context, owner and review status. Public acquisition surfaces must not expose protected portal provenance.

## 7. Approval / Diff / Review

Partner-facing deliverables, access changes and high-impact workflow transitions require explicit review/approval. Public-to-protected transitions must preserve security state and audit.

## 8. Anti-Patterns

- Leaking protected portal state into public acquisition routes.
- Hidden partner access denial.
- Deliverable status changes without confirmation/review.
- AI actions duplicated in canvas and Menu 3.
- Source-free partner deliverables presented as approved.

## 9. As-Is Gaps

- Existing docs confirm active protected portal plus public partner journey surfaces, but not each surface's state/copy matrix.
- Runtime evidence for deliverable provenance and approval/audit flow remains to be validated.

## 10. Acceptance Criteria

- `/partner/*` is documented as protected portal ownership; public routes remain separate.
- Loading, empty, error, degraded and success states are visible and actionable.
- AI/help actions use Menu 3/right-side placement without duplication.
- Partner deliverables show source/provenance and review status.
- Access and high-impact partner workflow transitions require approval/review.
