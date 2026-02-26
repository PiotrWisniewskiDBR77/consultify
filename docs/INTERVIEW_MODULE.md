## Interview Module (Discovery Interview) — Specification

**Status**: in progress (source of truth: `wdrozenia/modules/interview/`)  
**This document**: product + workflow spec for the whole Interview area (end‑to‑end).

### 1) Goal (what this module is for)

Interview is the “Discovery intake” layer: it collects **facts-only** context about an organization/project via structured templates and assignments.

**Outputs of Interview are inputs to:**
- **Tools** (strategic/operational/digital/process automation analysis tools)
- **Assessment** (DRD/SIRI/… frameworks)
- **Initiatives** (generated later from Tools / Assessment, not inside Interview answers)

**Hard rule:** Interview answers and summaries are **facts only** (no recommendations, no action plans).

### 2) Core concepts (domain objects)

- **Template**: a reusable library of questions (categorized), versioned and published.
- **Session**: a concrete execution of a template (for a specific org/project), containing questions, answers, notes, evidence.
- **Question**: task-like item inside a session; has status + confidence + answer payload (type depends on question type).
- **Assignment**: delegation wrapper around a session lifecycle for a person/team with deadline + reminders + review gates.
- **Insight**: AI-generated report compiled from one or multiple sessions (facts-only findings), used for exports to Tools/Assessment.

### 3) Users, roles, and access model

#### 3.1 Personas (how people use Interview)

- **Employee / Team Member (assignee)**
  - Sees: **Inbox** (assigned interviews)
  - Does: opens assignment → answers questions → submits for review
  - May also be a manager (managing others and answering own assignments)

- **Manager / Project Manager / Owner (reviewer + assigner)**
  - Sees: **Sessions**, **Assigned**, **Insights**, and often **Templates**
  - Does: creates assignments; reviews submissions; approves or sends back; exports insights to Tools/Assessment

- **Admin**
  - Sees and manages everything; ensures correct templates, permissions, project context

#### 3.2 Permissions (RBAC)

Interview permissions are referenced in backend middleware. High-level keys used in the module:
- `INTERVIEW_TEMPLATE_VIEW`, `INTERVIEW_TEMPLATE_USE`, `INTERVIEW_TEMPLATE_MANAGE`
- `INTERVIEW_ASSIGN_VIEW`, `INTERVIEW_ASSIGN_MANAGE`, `INTERVIEW_REMIND`
- (optionally) `INTERVIEW_INSIGHTS_*` (generation/export)

> Note: in dev environments without seeded `role_permissions`, backend may fall back to safe defaults for `INTERVIEW_*` permissions.

### 4) UI structure (what screens exist)

#### 4.1 InterviewHub (module hub)

Primary workspace: `src/components/Interview/InterviewHub.tsx`

Tabs (expected behavior):
- **Inbox**: “Assigned to me” (assignee view)
- **Sessions**: all interview sessions (review and audit)
- **Templates**: template library (build + publish)
- **Insights**: AI-generated reports (facts-only)
- **Assigned**: assignments management (create, remind, review)

#### 4.2 Session workspace (answering questions)

Component: `src/components/Interview/InterviewWorkspace.tsx`

Expected UX:
- Category sidebar (e.g., Strategy/Operations/Digital/People/Finance)
- Main content with tabs: Questions / Notes / Evidence / Summary
- Company/Organization context panel (facts & gaps)
- **All collapsible sections default collapsed** for readability (same pattern as Tasks/Insights)

#### 4.3 Insight viewer (post-interview report)

Component: `src/components/Interview/InsightViewer.tsx`

Expected UX:
- Two-column layout (left content, right control/metrics) aligned with TaskDetailView standard
- Sections collapsible by default
- Export actions:
  - Export to **Tools** → opens created tool session immediately
  - Export to **Assessment** → opens created assessment immediately

#### 4.4 Tools viewer (post-export)

Discovery Tools module is project-scoped. Some tool types may not have a dedicated UI.

Expected behavior:
- If tool type has a dedicated UI → open ToolDocumentView
- If tool type is not supported yet → open **GenericToolDocumentView** (shows data instead of “not implemented”)

### 5) End-to-end workflows (how it should work)

#### 5.1 Manager assigns interviews

1) Manager goes to **Assigned**
2) Opens “Assign Interview”
3) Selects:
   - Template
   - Assignee(s)
   - Due date, priority, optional notes
4) Assignment is created with status `pending`
5) Assignee sees it in **Inbox**

#### 5.2 Assignee answers interview (Inbox → Session)

1) Assignee opens **Inbox**
2) Clicks assignment row:
   - If not started → **Start** creates a session from template
   - If started → opens existing session
3) Assignee answers questions (task-like list)
4) Assignee adds Notes/Evidence where required
5) Assignee hits **Submit** → assignment becomes `submitted`

#### 5.3 Reviewer quality gate (Approve / Send Back)

1) Reviewer sees `submitted` items in **Assigned** and/or Sessions list
2) Reviewer opens the session:
   - verifies required questions quality (facts-only)
   - marks questions needing follow-up (optional)
3) Reviewer chooses:
   - **Approve** → assignment becomes `approved`
   - **Send back** → assignment becomes `sent_back` with a reason + missing items list
4) Assignee receives feedback and re-submits

#### 5.4 Insights generation (facts-only reports)

1) Reviewer/admin goes to **Insights**
2) Creates an insight by selecting:
   - insight type (e.g. summary/trends/problems/gaps/risk…)
   - source sessions (one or multiple)
3) AI generates report (facts-only)
4) In InsightViewer:
   - export to Tools / Assessment
   - keep activity log for exports/regenerations

#### 5.5 Export to Tools (Interview → Tool Session)

Goal: produce an actionable analysis workspace (Tools), seeded with context.

Expected behavior:
- Backend creates `tool_sessions` record with:
  - `tool_type` (e.g. `dynamic-swot`)
  - `context_snapshot` containing source insight + org context
- Frontend navigates to `ROUTES.DISCOVERY_TOOLS.STRATEGIC?tool=<toolSessionId>` (auto-opens)

#### 5.6 Export to Assessment (Interview → Assessment)

Goal: create an assessment artifact seeded with Interview context.

Expected behavior:
- Backend creates `assessments` record (default `DRD` for now) with `context_snapshot`
- Frontend navigates to `/assessment/<type>/<assessmentId>` (auto-opens)

### 6) Status models (canonical)

#### 6.1 Assignment status

- `pending` → not started
- `in_progress` → session created, work ongoing
- `submitted` → waiting for review
- `sent_back` → reviewer requested rework
- `approved` → accepted, safe to use as input to exports

#### 6.2 Question status (inside session)

- `not_started`
- `in_progress`
- `answered`
- `needs_follow_up`

#### 6.3 Insight status

- `generating`
- `completed`
- `failed`

### 7) Data model (tables; high-level)

Interview:
- `interview_templates`, `interview_template_questions`
- `interview_sessions`, `interview_questions`
- `interview_notes`, `interview_evidence`
- `interview_assignments`
- `interview_insights`, `interview_insight_exports`, `interview_context_exports`
- `organization_context`

Tools:
- `tool_sessions` (+ linking tables for initiatives/decisions)

Assessment:
- `assessments` (+ workflow/report tables)

### 8) API (high-level map)

Canonical routes live in `server/src/routes/interview.routes.ts` and `server/src/controllers/InterviewController.ts`.

Key groups:
- **Assignments**: create/start/submit/send-back/approve/remind/list(my/managed/overdue)
- **Sessions**: create/list/get/update/status/summary
- **Templates**: list/get/create/update/clone/use
- **Insights**: list/get/create/regenerate/export
- **Context**: organization context CRUD

#### 8.1 Endpoints (most used)

Assignments:
- `POST /api/interview/assignments` (create)
- `POST /api/interview/assignments/:id/start`
- `POST /api/interview/assignments/:id/submit`
- `POST /api/interview/assignments/:id/send-back`
- `POST /api/interview/assignments/:id/approve`
- `POST /api/interview/assignments/:id/remind`
- `GET /api/interview/assignments/my`
- `GET /api/interview/assignments/managed`
- `GET /api/interview/assignments/overdue`

Templates:
- `GET /api/interview/templates`
- `GET /api/interview/templates/:id`
- `GET /api/interview/templates/:id/questions`
- `POST /api/interview/templates`
- `PATCH /api/interview/templates/:id`
- `POST /api/interview/templates/:id/clone`
- `POST /api/interview/templates/:id/use`

Sessions:
- `GET /api/interview/sessions`
- `GET /api/interview/sessions/:id`
- `PATCH /api/interview/sessions/:id`
- `GET /api/interview/sessions/:id/questions`
- `PATCH /api/interview/questions/:id` (answer/status/confidence)
- `POST /api/interview/sessions/:id/summary`

Insights:
- `GET /api/interview/insights`
- `GET /api/interview/insights/:id`
- `POST /api/interview/insights`
- `POST /api/interview/insights/:id/regenerate`
- `POST /api/interview/insights/:id/export` with `{ "target": "tools" | "assessment" }`

#### 8.2 Permission map (high-level)

Templates:
- view: `INTERVIEW_TEMPLATE_VIEW`
- create/edit/publish/clone: `INTERVIEW_TEMPLATE_MANAGE`
- use template to create a session: `INTERVIEW_TEMPLATE_USE`

Assignments:
- manage assignments + review actions: `INTERVIEW_ASSIGN_MANAGE`
- view managed assignments: `INTERVIEW_ASSIGN_VIEW`
- reminders: `INTERVIEW_REMIND`

Insights:
- generation/export: (project policy; typically admin/pm; enforced server-side via middleware)

### 9) UX/quality rules

- **No mock data** in UI: show loading/error/empty with retry
- **Facts-only** enforcement for answers and summaries
- **Collapsed by default** for insight/session panels to keep readability
- **Clear “what happened” after actions**:
  - export opens target artifact
  - errors must be readable (no `[object Object]`)

#### 9.1 UI compliance (V3) — InterviewHub tables (MUST)

InterviewHub jest “hubem tabelarycznym” (Inbox/Sessions/Assigned/Templates/Insights). Wszystkie te listy muszą być zgodne z:

- `docs/ui-standards/03-modules/module-hub-standard.md` (topbar order + 1 command row)
- `docs/ui-standards/03-modules/app-table-standard.md` (header filters + resizable + kebab actions + brak duplikacji kontrolek)
- `docs/ui-standards/03-modules/table-preview-pane-standard.md` (preview jako opcjonalny panel po prawej, nie osobny widok)

**Kanon (powtarzalne problemy do usunięcia):**

- brak filtrów w headerach kolumn (MUST dodać, jeśli kolumna ma służyć do filtrowania)
- brak resizerów kolumn (MUST)
- brak Actions column z kebab (⋮) (MUST)
- ad-hoc “help strip/bannery” między topbarem a tabelą (MUST NOT; zamiast tego Command Row counters)
- chaos w kolejności przycisków topbara (MUST trzymać kolejność z ModuleHub Standard)

##### Inbox (Assignments to me) — MUST

- tabela zgodna z App Table Standard (filtry/resizery/actions)
- status + deadline + progress jako osobne kolumny (filtrowalne gdzie ma sens)
- akcje wiersza wyłącznie w kebab (⋮) + max 1–2 quick icons (opcjonalnie)

##### Sessions — MUST

- **MUST NOT:** dodatkowa linia “workflow help” między topbarem a tabelą
  - jeśli trzeba edukacji: video help / help center (nie w hubie)
- prawy topbar: **AI context → +New (np. +Przydziel) → View modes → Filters**
- badge przy tabie (np. “Przydzielone (8)”) to tylko liczba — bez dodatkowych ikon “zdarzeń”

##### Assigned — MUST

- “3 zaległe przydziały” nie jako osobny, nowy komponent/boks
  - zamiast tego: **Context counters row** (chip “Spóźnione (3)”) + klik ustawia filtr
- w wierszu: żadnych losowych ikonek typu dzwonek jako “akcja”
  - akcje w kebab (⋮)
  - stan “gotowe do zatwierdzenia” jako sygnał w kolumnie status / badge (call to action może być w quick actions, ale spójnie)

##### Templates — MUST / SHOULD

- App Table Standard: filtry w headerze, resizery, kebab actions
- **MUST:** żadnych “dwóch linii” z duplikacją (np. nazwa + pod nią slug/kategoria) — jeśli potrzebne, to osobna kolumna
- **SHOULD:** alternatywny view mode “Cards” jest dozwolony (template library), ale tylko jeśli nadal jest spójny z ModuleHub (te same filtry/topbar/akcje)

##### Insights — MUST

- **MUST:** usuwać “Przydziel” z tego widoku (tu już wnioskujemy, nie przydzielamy)
- filtry “wg raportu / wg osoby” nie jako dwa osobne kontrolki; wszystko w **Filters…** (jedno miejsce)
- podziały “Sesja 1/2/…/Ogólne” nie jako osobne sekcje tabeli:
  - zamiast tego: kolumna `Źródło / Sesja` + filtr (albo group-by jako view option R1+)
- **SHOULD:** dodać preview pane dla wniosku (podgląd + Open full), bo Insight ma N-mode i mamy payload do preview

### 10) Definition of Done (module readiness)

Functional acceptance checklist:
- Assign Interview modal lists **templates and users** correctly
- Assignee can open Inbox assignment and see question list + statuses
- Start creates session with valid `projectId` (no SQLite constraint errors)
- Reviewer can approve/send back and status changes persist
- Insight generation works and InsightViewer is readable (collapsed sections)
- Export to Tools creates `tool_sessions` and opens tool view
- Export to Assessment creates `assessments` and opens assessment view
- Tools view never shows “not implemented” as a dead end (generic viewer fallback)

Suggested smoke test plan (10–15 minutes):
- Create assignment (template + assignee + due date) → appears in assignee Inbox
- Start assignment → session opens; answer 1–2 questions; verify question status updates persist
- Submit assignment → reviewer sees it as `submitted`
- Send back with reason → assignee sees `sent_back`; re-submit; then approve
- Create insight from approved session → open insight; verify sections collapsed by default
- Export to Tools → auto-open tool; verify `contextSnapshot.source.insightId` present
- Export to Assessment → auto-open assessment; verify `contextSnapshot.source.insightId` present

### 11) References (source files / deeper specs)

- Implementation docs (work-in-progress): `wdrozenia/modules/interview/`
- Templates + AI assist: `docs/INTERVIEW_TEMPLATES_AND_AI_ASSIST.md`
- Interview hub structure: `wdrozenia/modules/interview/frontend/01-hub-structure.md`
- Session workspace: `wdrozenia/modules/interview/frontend/03-session-detail.md`
- Assignments workflow: `wdrozenia/modules/interview/features/01-assignments.md`
- Templates library: `wdrozenia/modules/interview/features/02-templates.md`

