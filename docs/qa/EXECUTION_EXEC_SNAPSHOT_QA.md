# QA Checklist — Execution / Executive Snapshot

## Preconditions
- You have at least 1 Project with at least 1 Initiative (and ideally: workstreams, RAID risks, KPI/benefits).
- You are logged in and have access to the Project.
- API is reachable (`/api`).

## Access control (RBAC)
- **Non-member**: user who is not in `project_members` for the project
  - Open `/execution` for that project (or switch to it) → Executive snapshot should **fail** with **403** (frontend shows error callout).
- **Member with view permission**:
  - As a project member with `permissions.canViewProject=true` → snapshot loads.
- **System admin override**:
  - As `ADMIN`/`SUPERADMIN`/`OWNER` → snapshot loads even if not in `project_members`.

## Snapshot loading & controls
- Open `ExecutionHub` → `Control` tab → snapshot area appears.
- Change **Period** (WEEK/MONTH/QUARTER) → snapshot reloads and values change (where data exists).
- Toggle **AI**:
  - If user has `ai_view_insights`: AI section shows insights (or “No insights available yet.”).
  - If user does **not** have `ai_view_insights`: backend forces `includeAI=false` and UI should show “AI insights are disabled…”.
- Click **Refresh** → snapshot reloads (server bypasses cache).

## Data sanity (smoke)
- **Overview**: progress % is within 0–100, “Priority alerts” renders (can be empty).
- **Workstreams**: list renders; “Unassigned” count is not negative.
- **KPIs**: table renders; empty state appears when none exist.
- **ROI**: summary cards render; empty state appears when none exist.
- **Risks**:
  - Heatmap table renders (or “No risk heatmap data.”).
  - Top risks table renders (or “No top risks.”).

## Export / Reporting (Final Transformation Report)
- `/api/report-builder/templates` contains `tpl-final-transformation-report` (system template).
- Create report from template (UI or API) and verify export:
  - PDF: `GET /api/report-builder/:id/export/pdf` downloads PDF and creates export record.
  - PPTX: `GET /api/report-builder/:id/export/pptx` downloads PPTX and creates export record.
  - Notion: `POST /api/report-builder/:id/export/notion` returns `{ url }` when integration configured.

## Recurring scheduler (minimal)
- Ensure cron job runs `ReportGenerationJob` and scheduled reports execute:
  - Create schedule (via scheduled reports API) and wait for next run.
  - Confirm execution record created and `last_run_status` updates.

