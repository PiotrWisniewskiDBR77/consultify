## Assessment module redesign (DRD-first) — 2026-01-31

This document summarizes the implemented redesign work in the `assessment` module (DRD-first), including UX layout changes, logging, permissions, and the new `Manage` center.

### Goals (product)

- **ClickUp-like UX**: compact header, clear actions, fast navigation, right-side navigation panel, left workspace for “work”.
- **DRD-first**: implement the new experience for DRD framework first.
- **Single consistent format**: assessment tools share a common shell (`AssessmentToolShell`).
- **End-to-end workflow**: move from filling the assessment → review/approval → (next step) report generation → initiative generation.
- **Activity traction**: expose a full activity timeline (“who/when/what”).
- **Permissions**: enforce admin/manager visibility and access request flows.

---

## UX / UI architecture

### Two-column shell

- Right side: **navigation/control panel** (axis selector, areas list, Survey/Preview toggle).
- Left side: **workspace view**, swapped between:
  - Survey (level cards)
  - Preview (matrix)
  - Manage (admin/manager center)
  - Logs (inside Manage as a dedicated tab)

Component:

- `src/components/assessment/AssessmentToolShell.tsx`

DRD editor uses the shell:

- `src/components/assessment/drd/DRDAssessmentEditor.tsx`
  - supports `leftOverride` so Manage can replace the left workspace while keeping the right panel intact.

### Header (session editor)

File:

- `src/views/AssessmentSessionEditorView.tsx`

Key behavior:

- compact topbar with breadcrumb + inline rename for assessment title
- action buttons:
  - **Info**
  - **Manage** (admin/manager only)
  - **Chat** (opens a new conversation seeded with assessment context)
  - **Save & Exit** flow (confirmation modal)
- for admins: the “Edit lock” toggle is hidden and editing is always enabled.

---

## DRD editor changes

File:

- `src/components/assessment/drd/DRDAssessmentEditor.tsx`

Highlights:

- matrix as a first-class view (“Preview”), survey as card view
- improved cards: single column, reduced text, full-width example box, compact action buttons
- matrix cells show achieved level + suggested technologies; clicking a cell navigates to the right card
- links support on levels (`levelLinks` add/remove)
- tip text between controls was removed per UX request

---

## Activity logs (traction / timeline)

Frontend:

- `src/components/assessment/ActivityLogPanel.tsx` (timeline view)
- Logs are available in **Manage → Logs** tab.

Backend:

- `server/src/routes/assessment/assessment-workflow.routes.ts` includes:
  - `GET /api/assessment-workflow/:assessmentId/activity-logs` (robust against schema variants)
  - `POST /api/assessment-workflow/:assessmentId/log-activity`

Audit logger improvements:

- `server/src/utils/AssessmentAuditLogger.ts` updated to match actual DB schema variants (`timestamp`, `action_type`, `metadata`).

---

## Permissions & access requests (RBAC for assessments)

### Requirements implemented

- Only admin/manager can see **Manage**
- if user can’t edit:
  - lock icon is shown (for non-admin)
  - clicking proposes submitting an access request
  - admins receive a notification

### DB schema (SQLite migration)

Migration:

- `server/migrations/502_assessment_permissions.sql`

Tables:

- `assessment_roles`
- `assessment_access_requests`

### Backend service

File:

- `server/src/services/assessmentPermissionService.ts`

Responsibilities:

- compute effective permissions per role (admin/manager/editor/viewer)
- role assignments and removal
- create/approve/reject/cancel access requests
- fetch assessment admins (creator + explicit admin roles)

### API endpoints (v2 for UI)

Because the app runs primarily on `/api/assessment-workflow-v2`, the permission endpoints were added there as well:

- `GET /api/assessment-workflow-v2/:assessmentId/my-role`
- `GET /api/assessment-workflow-v2/:assessmentId/roles`
- `GET /api/assessment-workflow-v2/:assessmentId/access-requests`
- `POST /api/assessment-workflow-v2/:assessmentId/access-requests`

Frontend hook:

- `src/components/assessment/permissions/useAssessmentPermissions.ts`

Access request modal:

- `src/components/assessment/permissions/RequestAccessModal.tsx`

---

## Manage center (admin/manager)

Manage is the “control center” for the whole lifecycle (reports will be added in the next step).

UI:

- `src/components/assessment/manage/AssessmentManagePanel.tsx`

Tabs:

- **Workflow**: status + actions:
  - Submit for review
  - Approve
  - Send back (requires comment)
  - Generate initiatives (methodology + count)
- **Workflow (Enterprise)**: includes an **Eligibility** panel (authorization decision + gates)
- **Team**: roles listing
- **Access requests**: requests listing
- **Logs**: activity timeline (`ActivityLogPanel`)

Important: Manage replaces only the **left workspace**. The DRD right navigation panel remains visible and usable.

### Eligibility & gating (Enterprise)

Backend endpoint:

- `GET /api/assessment-workflow-v2/:assessmentId/eligibility`

Returns:

- role + effective permissions for current user
- compact eligibility checks (blocking vs warning)
- action-level allow/deny with “blockedBy” reasons (Submit/Approve/Send back/Generate initiatives)

Enforcement:

- `POST /api/assessment-workflow-v2/:assessmentId/request-review` requires `canChangeStatus`
- `POST /api/assessment-workflow-v2/:assessmentId/approve` requires `canApprove`
- `POST /api/assessment-workflow-v2/:assessmentId/send-back` requires `canApprove`
- `POST /api/assessment-workflow-v2/:assessmentId/generate-initiatives` requires `canGenerateInitiatives`
- `POST /api/assessment-workflow-v2/` (create) requires global admin

---

## Chat integration (assessment → chat)

Chat button creates a new conversation with PMO context:

- `pmoContext.assessmentId = <assessmentId>`

Files:

- `src/views/AssessmentSessionEditorView.tsx` (Chat button handler)
- `src/store/useConversationStore.ts` (supports passing `pmoContext` into `createConversation`)
- `server/src/routes/conversations.routes.ts` (persists `pmo_context`)

---

## Notes / next step

Next step requested by product:

- add **Reports** to Manage (generate + publish + version history) and surface published report in the Reports module.
