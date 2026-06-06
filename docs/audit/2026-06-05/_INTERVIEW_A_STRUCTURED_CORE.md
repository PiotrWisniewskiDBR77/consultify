# Interview Module — Structured Core ("wywiad") — Code-Verified Audit

**Date:** 2026-06-05
**Branch:** `feat/wave1-foundations`
**Scope:** Task-list structured interview workflow — sessions, questions, AI assist, assignments/RBAC, three insight generations, report packs, summaries, transcripts. **Excludes** Discovery canvas and Interview Enterprise (separate agents).
**Method:** Full reads of routes, controller AI handlers, services, and frontend data-flow. No code modified.

---

## Score: 62 / 100

**One-liner:** A genuinely sophisticated, mostly-correct module (the P10 findings/readback/handoff governance is the best-engineered insight pipeline in the codebase) dragged down by a *two-writer* legacy/v8 split that is materially worse than Canvas's, a single shared `interview_insights` table carrying **three incompatible schemas**, a dead-but-mounted legacy inference UI, an unscheduled reminder/escalation job, and a cluster of `users.name` / `/discovery` deep-link bugs that break notifications and team display.

---

## The Two-Route Verdict

**Both routers are live. This is worse than it looks.**

- Legacy `routes/interview.routes.ts` is mounted at `/api/interview` in `server/src/Gateway.ts:926` **with a deprecation header but no removal** — every endpoint still executes.
- V8 `routes/v8/interview.routes.ts` + `routes/v8/interview-insights.routes.ts` are mounted at `/api/v8/interview` (`routes/v8/index.ts:77-78`).

**Who calls what (verified from `src/components/Interview/*`):**

| Concern | Router actually used | Evidence |
|---|---|---|
| Session **create / patch / complete** | **Legacy** `Api.post('/interview/sessions')`, `Api.patch('/interview/sessions/:id')` | `InterviewWorkspace.tsx:588,1060,1132` |
| Questions (list/add/update/ai-suggest/ai-parse) | **Legacy** | `InterviewWorkspace.tsx:622,780,813`; `QuestionsList.tsx:347,454` |
| Notes / Evidence / Summary / linked-items | **Legacy** | `InterviewWorkspace.tsx:623-645,835-990,1275` |
| Templates (list/clone/use/CRUD/quality) | **Legacy** | `InterviewHub.tsx:1036,1217`; `TemplateBuilder.tsx:360-847`; `AssignInterviewModal.tsx:116` |
| ai-improve / ai-explain (single-question runtime) | **Legacy** raw `fetch(${API_URL}/interview/...)` | `InterviewSingleQuestionRuntime.tsx:591,622` |
| Transcript + ai-parse (conversational) | **Legacy** raw `fetch('/api/interview/...')` | `ConversationalPanel.tsx:79,111,147` |
| Sessions list (managed/accepted), summaries | **V8 primary, legacy fallback** | `InterviewWorkspace.tsx:567-576` (`.catch(() => Api.get(...))`) |
| Assignments (my/managed/overdue/start/submit/sendback/approve/remind) | **V8** | `InterviewHub.tsx:870-2118`; `InterviewWorkspace.tsx:1099-1232` |
| Insights list/get/create/export/delete/comments/activity | **V8** | `InterviewHub.tsx:1032-3761`; `InsightCreatorModal.tsx:886` |
| P10 findings/candidates/analysis/source-pack/report-pack | **V8** (`interview-insights.routes.ts`) | `InsightViewer.tsx:573-675` |
| Inference runs + legacy insights list | **Legacy, but component is DEAD** | `InsightPackView.tsx:405,442-481` |

**Verdict:** This is NOT a clean "v8 is canonical, legacy is dead" story like we hoped. It is a **functional split by feature area**:

- The **entire authoring surface** (sessions/questions/notes/evidence/summary/templates/AI-assist/transcript) is served **only** by legacy `interview.routes.ts`. V8 never implemented `POST /sessions`, `/sessions/:id/questions`, `/questions/:id`, `/notes`, `/evidence`, `/templates`, `ai-suggest`, `ai-improve`, `ai-explain`. So legacy is **not removable** — it is load-bearing.
- The **manager/assignment/insight surface** is served by V8. Legacy duplicates of these (`getManagedSessions`, `evaluate-answers`, insight CRUD) still exist and are reached only via `.catch()` fallbacks.

**Recommendation:** Do **not** delete legacy. Instead:
1. Stop calling it "deprecated" at the gateway for the authoring routes — that header lies; those routes are canonical. Split the legacy router into `interview-authoring.routes.ts` (keep, drop deprecation header) and `interview-legacy-duplicates.routes.ts` (the assignment/insight handlers that V8 superseded — mark for deletion).
2. The `.catch(() => Api.get(legacy))` fallbacks in `InterviewWorkspace`/`InterviewHub` mask real V8 failures and create divergent behavior (legacy `getSessions` returns a bare array; V8 returns `{data:{sessions}}`). Pick one shape and delete the fallback. **P1.**
3. Kill `InsightPackView.tsx` + the legacy `/inference/*` routes + `interviewInferenceService.ts` outright (see three-insight verdict).

---

## The Three-Insight-Generation Verdict

There are **three generations sharing one table** (`interview_insights`), and the table carries **mutually incompatible column sets**:

### Gen 1 — Legacy Inference ("T016") — **DEAD, delete it**
- `services/interviewInferenceService.ts` → writes `interview_insights` columns: `category, content, structured_content, evidence_links, unknowns, counterpoints, assumptions, confidence_score, inference_run_id, insight_category` (lines 172-194).
- Surfaced only by `InsightPackView.tsx`, which is **imported nowhere** (verified: `grep InsightPackView` returns only its own file). It uses raw `fetch('/api/interview/insights')` and `/inference/run`.
- Routes `POST /inference/run`, `GET /inference/runs` still mounted (`interview.routes.ts:347-354`) but unreachable from UI.
- **This is decorative dead weight and an active schema hazard** (see below).

### Gen 2 — V2 Content Blob ("interview_insights" canonical) — **CURRENT authoring of insights**
- `services/InterviewInsightService.ts:1477 create()` → writes `interview_insights` columns: `session_id, category, title, prompt_type, source_session_ids, filters, source_session_count, analysis_scope_json, context_mode, analysis_mode, topic_focus_json, generation_context_json`.
- Async `generateInsight()` fills executive summary / themes / issues / opportunities / material_quality.
- This is what `V8InterviewApi.listInsights/getInsight/createInsight` drives, and what the UI renders.

### Gen 3 — P10 Findings (candidates → findings → evidence → readback → handoff) — **CURRENT governance layer, best code in the module**
- `services/v8/interviewInsightCandidateService.ts`, `interviewInsightFindingsService.ts`, `interviewInsightCanon.ts`, `interviewInsightAnalysisService.ts`.
- Candidates **auto-backfill** from the Gen-2 insight's themes/issues/opportunities via `buildInsightAnalysis()` (`interviewInsightCandidateService.ts:227 ensureBackfilledCandidates`). Triage → promote → finding → evidence pointers → client readback gating → handoff to initiatives.
- Publish is gated on: ≥1 finding, every finding passes `canPublishFinding`, AND `readback_status === 'confirmed_by_client'` (`interview-insights.routes.ts:173-203`). This is real consulting-grade rigor.

**Relationship:** Gen 2 is the *content*, Gen 3 is the *governed extraction* layered on top of the same insight id. They are **complementary, not competing** — good. Gen 1 is orphaned and conflicts at the schema level.

**Consolidation recommendation:**
1. **Delete Gen 1 entirely**: `interviewInferenceService.ts`, `InsightPackView.tsx`, routes `/inference/run`, `/inference/runs`, `/inference/runs/:id`, and the `inference_run_id / structured_content / evidence_links / unknowns / counterpoints / assumptions / insight_category / content / category` columns it owns on `interview_insights`. Confirm no other reader (the `/insights/:id/export` legacy fallback at `v8/interview.routes.ts:1201` *does* `SELECT ... category, description, insight_type` in a try/catch — that's Gen-1 column-sniffing; remove once Gen 1 dies).
2. Keep Gen 2 + Gen 3 as the canonical pair.
3. The `interview_insights` table should be migrated to a single coherent column set; right now it is a union of three schemas held together by `try/catch` column-sniffing (`v8/interview.routes.ts:1192-1209`). **This is the same "two writers, one table" rot that hurt Canvas, amplified to three.**

---

## P0 — Broken / Data-loss / Security

### P0-1 — Reminder & escalation jobs are never scheduled
`services/InterviewAssignmentService.ts` implements `checkAndSendReminders()` (940) and `checkAndEscalate()` (1021), and `jobs/interviewReminderJob.ts` wraps them — but **nothing registers them in `cron/Scheduler.ts`** (verified: `grep interviewReminder server/src/cron` → no hits; `Scheduler.ts:118` schedules only `decisionEscalationChainService`). The job header even says "Run via: npx ts-node ... Or schedule with cron" — i.e. it's a manual script. **Result: the entire "48h/24h/2h reminder + auto-escalation after deadline" feature advertised in the file header is dormant in production.** Assignees get the initial assignment notification and nothing else; overdue assignments never escalate to the manager. Manual "Remind" button (`/assignments/:id/remind`) works; automatic windows do not.
**Fix (S):** Register an hourly job in `Scheduler.ts` calling `interviewReminderJob.runJob()`.

### P0-2 — `users.name` column does not exist → team-member load & reminder emails break
The `users` table uses `first_name`/`last_name` everywhere (e.g. assignment service itself: lines 489, 818, 866, 1030). But two queries read a non-existent `name` column:
- `InterviewAssignmentService.ts:713` — `SELECT m.*, u.name as user_name, u.email ... ` in `getTeamMembers()`. On Postgres this **throws** (`column u.name does not exist`); the GET `/assignments/:id/members` route returns 500 for any team assignment.
- `InterviewAssignmentService.ts:1203` — `SELECT email, name FROM users WHERE id = ?` in `dispatchReminder()`. Throws on Postgres → reminder dispatch aborts in the catch at line 1232 (silently swallowed), reinforcing P0-1. Even if it returned, `data.userName` would be undefined → emails greet "Hi undefined".
**Fix (S):** Replace both with `(first_name || ' ' || last_name) as user_name` / `SELECT email, first_name, last_name`.

### P0-3 — `ConversationalPanel` calls the API with no auth/org headers
`ConversationalPanel.tsx:79,111,147` use bare `fetch('/api/interview/sessions/:id/transcript' | '/ai-parse')` with only `Content-Type` — **no `Authorization: Bearer` and no org-context header** (compare `InterviewSingleQuestionRuntime.tsx:591` which correctly uses `getHeaders()`). The legacy router requires `verifyToken` + `requireOrgAccess`. Auth only succeeds if a `access_token`/`token` cookie happens to be set (`auth.middleware.ts:427-433` cookie fallback) — fragile, and `requireOrgAccess` still won't get the org header the rest of the app sends. Transcript send + ai-parse will 401 for any session where the cookie path isn't populated.
**Fix (S):** Route these through `Api.get/Api.post` (which injects `getHeaders()`), or pass `headers: getHeaders()` to the raw fetches.

### P0-4 — `interview_insights` triple-schema collision (latent data corruption)
A single table is written by three code paths with disjoint required columns (see three-insight verdict). With `DB_MANAGED_SCHEMA` off in dev, the lazy-ensure paths and `try/catch` SELECT-sniffing (`v8/interview.routes.ts:1192-1209`) paper over missing columns at *read* time, but `interviewInferenceService.ts:172` blind-INSERTs Gen-1 columns. If Gen-1 ever runs against a DB provisioned only for Gen-2 columns (or vice-versa), the INSERT throws and the inference run is marked `failed` — or worse, partially writes. **It is a loaded gun even though Gen-1's trigger (InsightPackView) is currently unreachable.**
**Fix (M):** Delete Gen 1, then write one authoritative migration for the table.

---

## P1 — Works but rough

### P1-1 — `/discovery?assignmentId=` deep links are wrong everywhere
Every notification/email `actionUrl` points at `/discovery` (the canvas module), not `/interview`:
- `InterviewAssignmentService.ts:1060, 1132, 1179, 1258, 1280`
- `InterviewController.ts:3131` (`interview_approved`)

The structured interview UI is `/interview` (and P10 notifications in `interview-insights.routes.ts:101,122` correctly use `/interview?artifact=insight:...`). So assignment/reminder/escalation/approval notifications and emails all link the recipient to the **wrong module**. **Fix (S):** global replace `/discovery?assignmentId=` → `/interview?assignmentId=` in the assignment service + controller.

### P1-2 — `ai-suggest` prompt hardcodes a vertical
`InterviewController.ts:4674` — *"You are a senior **manufacturing transformation** consultant..."*. For a horizontal B2B consulting platform this biases every suggested answer toward manufacturing. The other prompts (`ai-improve`, `ai-explain`, `evaluate-answers`, `ai-parse`) are vertical-neutral and good. **Fix (S):** make it "senior management consultant" and let org context (which is already injected at 4687) carry the vertical.

### P1-3 — Summary extraction is keyword-only, not AI
`generateSummary` (`InterviewController.ts:6328`) does **not** call the LLM. It builds `facts` by string-concatenating every `question: answer`, and classifies `constraints`/`painPoints` purely by whether the question's `tags` array contains `'constraint'`/`'pain_point'`/`'risk'`, and `gaps` by unanswered-or-low-confidence. So:
- `summary_facts` is just a dump of all Q&A (no synthesis).
- `constraints`/`painPoints` are empty unless a human tagged each question.
- Despite the docstring "AI-extracted", it's a deterministic transform.
This *populates* and persists correctly (no data loss), but the output is low-value. The much richer `evaluate-answers` and insight pipeline exist; summary is the weak link. **Fix (M):** either replace with an LLM extraction pass or rename so it's not sold as AI.

### P1-4 — Report-pack markdown export dumps rows as raw JSON code-fences
`interviewInsightReportPackService.ts:368-373 buildWorksheetMarkdown` renders each worksheet row as ` ```json {…} ``` `. This is the same "not client-ready" problem just fixed for Canvas. A consultant exporting a report pack gets `### Row 1` followed by a JSON blob, not a table or prose. Worksheet `markdown` field (if present) renders fine; the `rows` fallback does not. **Fix (M):** render rows as Markdown tables keyed off worksheet schema, mirroring the Canvas export fix.

### P1-5 — Insight `/export` to tools/assessment hardcodes targets & org-default project
`v8/interview.routes.ts:1310-1471` always creates a `dynamic-swot` tool session and a `'DRD'` assessment, and picks `resolveValidProjectId` = "most recently created project in org" (`:171-175`) when none supplied. Cross-project leakage risk: an insight exported without explicit project lands in whatever project was last created. Also the tool type / assessment type are not user-selectable. **Fix (M):** require an explicit projectId on export; let the caller choose tool/assessment type.

### P1-6 — Legacy/V8 response-shape divergence behind `.catch` fallbacks
Legacy `getSessions` returns a bare array (`InterviewController.ts:1923 res.json(sessions)`); V8 returns `{data:{sessions}, meta}`. The frontend `.catch(() => Api.get('/interview/sessions...'))` paths (`InterviewWorkspace.tsx:574-576`) then have to handle both shapes. Any silent V8 error falls through to legacy with a different contract → subtle bugs. **Fix (S):** remove fallbacks once V8 is trusted; normalize.

### P1-7 — `evaluate-answers` org-scoping does an inner JOIN on projects
`InterviewController.ts:4866-4878` resolves the session via `JOIN projects p ON p.id = s.project_id` — sessions with `project_id IS NULL` (ad-hoc) won't match and fall to the `user_id` back-compat branch, which *also* inner-joins projects. Net: **ad-hoc (project-less) sessions cannot be evaluated** because both branches require a project row. Contrast with `getSummary`/`createInsight` which correctly use `(p.organization_id = ? OR (s.project_id IS NULL AND s.organization_id = ?))`. **Fix (S):** use the null-safe org predicate here too.

---

## P2 — Polish

- **P2-1** `ai-improve`/`ai-explain` owner gate (`session_owner_id !== user.id`, controller 4729/4811) blocks managers/team-leads from using AI assist on a team member's session even though `submitAssignment` allows lead/creator/owner. Inconsistent. Loosen to the same access predicate.
- **P2-2** `interview_insight_activity` and `interview_insight_exports` and `tool_sessions`/`assessments` tables are `CREATE TABLE IF NOT EXISTS`-ensured inline inside request handlers (`v8/interview.routes.ts:108-128, 1258, 1312, 1389`). Works, but schema-in-handler is a smell and adds latency to the hot path. Move to migrations.
- **P2-3** `parseToAnswers` in `ConversationalPanel` flattens transcript with `[ROLE]: content` then re-derives questionText client-side; fine, but no de-dup against already-answered questions — re-parsing overwrites. Minor.
- **P2-4** `getMyAssignments` (assignment service 729) has no project/manager scoping (correct — it's *my* tasks) but also no `organization_id` index hint beyond the composite; fine. The `ORDER BY CASE status` is good UX.
- **P2-5** `addMessage`/`getMessages` in `interviewTranscriptService.ts` are org-scoped and parameterized — clean. No issues.
- **P2-6** `interviewManagerScope.ts` is **correct**: parameterized placeholders, `UPPER(COALESCE(...))` role match, org-join on projects, safe fallback to creator-scope. No IDOR. Good.
- **P2-7** `ai-parse` (`InterviewController.ts:4942`) enforces `owner_id === user.id` and parameterizes the `IN (...)` list — safe.
- **P2-8** Empty-state handling in `evaluateSessionAnswers` (returns `overallVerdict:'empty'`) is correct and matches the TS union.

---

## What's Working Well (credit where due)

1. **P10 findings governance is excellent.** `interview-insights.routes.ts` gates publish on findings existence, per-finding `canPublishFinding` canon, AND client `readback_status === 'confirmed_by_client'` (173-203). Handoff additionally re-checks readback + publishability and records a context-source artifact with confidence weighting (641-757). Evidence pointers support tombstoning (soft-delete with removal reason) so exports never silently lose provenance. This is the most rigorous insight pipeline in the platform.
2. **Candidate auto-backfill** (`interviewInsightCandidateService.ts:227`) derives triage state (`needs_split` on contradiction, `needs_evidence` on zero pointers, `validate` on single-perspective) from the analysis matrix — thoughtful, consulting-aware heuristics, not a stub.
3. **Org-scoping on the V8 surface is consistent and correct.** Every insight handler re-fetches `interview_insights.organization_id` and 403s on mismatch before acting (e.g. `v8/interview.routes.ts:509-511, 890-892`). Insight comments enforce author-or-admin delete (1758-1763).
4. **Lifecycle gating is real.** `approveAssignment` runs `evaluateGatePolicy` + a hard 50% completeness floor (`InterviewController.ts:3035,3073`) before flipping to `approved` and completing the session. `submitAssignment` allows the right actor set (assignee/lead/creator/owner). Insight creation rejects non-approved source sessions (`v8/interview.routes.ts:983-1005`, mirrored in `InterviewInsightService.create` 1491-1509). Summary/export are gated on approval too (6345-6361).
5. **AI prompts (except ai-suggest's vertical) are good.** `evaluate-answers` (1854) has a clear 1-5 rubric, fixType taxonomy, language switch, structured Zod schema enforced via `llmService.call({type:'structured', schema})`. `ai-improve` has five distinct mode instruction blocks. `ai-explain` returns explanation + examples + why-it-matters. All enforce structured output; none return mock data.
6. **AI review snapshot is persisted**, not decorative — `evaluate-answers` writes `ai_review_snapshot_json` + `ai_reviewed_at` onto the assignment (4919-4930), and approve/send-back append a `review_decision_memory` audit trail capturing AI-vs-manager alignment (`appendInterviewReviewDecisionMemory`). This is the opposite of Canvas's "computed but never saved" panel.
7. **Report-pack workflow** has proper draft→in_review→published immutability (published packs reject worksheet edits with `INTERVIEW_REPORT_PACK_IMMUTABLE`, `v8/interview.routes.ts:925`), readiness scoring with blockers/warnings, manifest-hash + export-hash for tamper-evidence, and full audit-log rows on every export.
8. **No `@ts-nocheck`** anywhere in the Interview frontend or these services. No raw SQL injection surface found — all dynamic `IN (...)` lists use generated `?` placeholders.

---

## Ranked Remediation Plan

### Small (hours each)
1. **[P0-1]** Register `interviewReminderJob.runJob()` hourly in `cron/Scheduler.ts`. Without this the reminder/escalation feature is vaporware.
2. **[P0-2]** Fix `users.name` → `first_name/last_name` at `InterviewAssignmentService.ts:713` and `:1203`.
   ```sql
   -- 713
   SELECT m.*, (u.first_name || ' ' || u.last_name) AS user_name, u.email AS user_email ...
   -- 1203
   SELECT email, first_name, last_name FROM users WHERE id = ?   -- then greet first_name
   ```
3. **[P0-3]** `ConversationalPanel.tsx` — replace bare `fetch` with `Api.get/Api.post` (or add `headers: getHeaders()`).
4. **[P1-1]** Global replace `/discovery?assignmentId=` → `/interview?assignmentId=` (5 sites in assignment service + `InterviewController.ts:3131`).
5. **[P1-2]** `InterviewController.ts:4674` — "manufacturing transformation consultant" → "senior management consultant".
6. **[P1-7]** Make `evaluate-answers` session lookup null-safe for project-less sessions (reuse the `OR (s.project_id IS NULL AND s.organization_id = ?)` predicate).
7. **[P1-6]** Remove legacy `.catch()` fallbacks for sessions/summary in `InterviewWorkspace`/`InterviewHub`; normalize on V8 shape.

### Medium (1-3 days each)
8. **[P0-4 + Gen-1 kill]** Delete `interviewInferenceService.ts`, `InsightPackView.tsx`, routes `/inference/*`, and the Gen-1-only columns. Remove the Gen-1 column-sniffing `try/catch` in `v8/interview.routes.ts:1192-1209`. Then author one migration that defines `interview_insights` as exactly the Gen-2 column set.
9. **[P1-3]** Replace keyword-only `generateSummary` with an LLM extraction pass (facts/gaps/constraints/painPoints), or rename the endpoint/UI so it isn't presented as AI synthesis.
10. **[P1-4]** Rewrite `buildWorksheetMarkdown` rows-fallback to emit Markdown tables (per-worksheet schema), matching the Canvas client-ready export fix.
11. **[P1-5]** Require explicit `projectId` (and target sub-type) on insight `/export`; stop defaulting to "newest project in org".
12. **Split the legacy router.** Move authoring routes (sessions/questions/notes/evidence/summary/templates/ai-assist/transcript) into a non-deprecated `interview-authoring.routes.ts`; quarantine the assignment/insight duplicates for deletion. Update the gateway so the deprecation header only covers the duplicates.

### Large (week+)
13. **Unify the two-route surface.** Either (a) port the authoring endpoints into V8 so the whole module speaks the `{data, meta}` contract and one auth path, then retire `/api/interview`; or (b) formally bless legacy as the authoring API and stop pretending it's deprecated. Pick one — the current "live deprecated authoring + live v8 management + dead v8-shadowed legacy management + dead legacy inference" four-way split is the root cause of half the bugs above.
14. **Single `interview_insights` schema + provenance contract** spanning Gen-2 content and Gen-3 findings, with a migration that backfills and a constraint set, eliminating the `try/catch` column-sniffing pattern permanently.

---

## Appendix — Files read in full / in depth
- `routes/interview.routes.ts` (full), `routes/v8/interview.routes.ts` (full), `routes/v8/interview-insights.routes.ts` (full)
- `controllers/InterviewController.ts` — AI handlers 1820-1911, 4636-5027; summary 6328-6463; lifecycle 2533-2620, 3022-3140; completed-sessions 6469-6546
- `services/InterviewAssignmentService.ts` (full), `interviewManagerScope.ts` (full), `interviewTranscriptService.ts` (full), `interviewInferenceService.ts` (full)
- `services/InterviewInsightService.ts` — create 1477-1596; `interviewInsightReportPackService.ts` — markdown/export 340-470; `v8/interviewInsightCandidateService.ts` — 150-280; `v8/interviewInsightFindingsService.ts` / `interviewInsightCanon.ts` (via route usage)
- Frontend: `InterviewHub.tsx`, `InterviewWorkspace.tsx`, `QuestionsList.tsx`, `InterviewSingleQuestionRuntime.tsx`, `ConversationalPanel.tsx`, `InsightCreatorModal.tsx`, `InsightViewer.tsx`, `InsightPackView.tsx`, `TemplateBuilder.tsx`, `AssignInterviewModal.tsx`, `services/api/v8/interview.ts`, `services/api.ts` (auth), `auth.middleware.ts`, `Gateway.ts`, `cron/Scheduler.ts`
