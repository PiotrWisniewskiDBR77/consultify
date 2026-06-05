# Interview › Templates tab — Code-Verified Audit

**Date:** 2026-06-05
**Branch:** `feat/wave1-foundations`
**Scope:** The Templates feature of the Interview module only (`InterviewTab === 'templates'`): the cards + table views in `InterviewHub.tsx`, the `TemplateBuilder.tsx` editor, `InterviewTemplatePreview.tsx`, and the backend templates CRUD in `interview.routes.ts` / `InterviewController.ts`.
**Method:** Read / Grep / Glob only. No code modified.

---

## Score: 68 / 100

The Templates feature is **real, end-to-end, and not mocked** at the data layer. Library list, create, clone, use, add/edit/delete questions, import-source (TXT/PDF text extraction), and AI draft generation all hit live endpoints with proper SQL persistence and permission gating. The `TemplateBuilder` question editor is genuinely deep (type, required, options, hint, description, evidence prompt, expected-answer-shape, 4 modalities, drag + up/down reorder).

What drags the score down is **surface-vs-engine drift**:
1. The status model is richer in the DB (`draft / in_review / approved / archived`) than anything the UI can show or set — the table renders a fake `Default | Active` badge that never reflects real status; the cards collapse 3 statuses into "Draft".
2. **Archive / Restore backend endpoints are completely unwired** in `InterviewHub` — dead routes.
3. The **per-question category is hardcoded to `'strategy'`** everywhere it is created (manual add, AI gen, demo) — the advertised "5-category" multi-category template builder does not exist in the UI; templates are flat question lists.
4. **Cards view is materially less capable than table view** (no preview pane, no row actions, dead `scopeColor`).
5. `evaluate-quality` is a deterministic linter named "AI quality" — fine, but mislabeled in code/UX.

None of these are crashes; all are honest-feature / data-integrity gaps. Hence high-60s, not low-50s.

---

## Cards ↔ Table verdict: **TABLE is the canonical, more-complete surface. Cards is a degraded read-only grid.**

| Capability | Table view | Cards view |
|---|---|---|
| Renderer | `renderTemplatesTable` (`InterviewHub.tsx:4408`) inside `TableWithPreviewLayout` (`:7564`) | `renderTemplatesCards` (`:4953`) |
| Row actions menu (Open/Assign/Use/Clone/Edit/Delete) | ✅ `RowActionsMenu` `:4827` | ❌ none — click=select, dblclick=open only |
| Preview pane (loads questions, AI hints, clone/delete) | ✅ `InterviewTemplatePreviewBody/Footer` `:7581` | ❌ absent |
| Real status shown | ❌ shows `Default`/`Active` pseudo-status `:4804-4816` | ⚠️ shows `Published`/`Draft` only (`approved` vs else) `:4998-5009` |
| Scope (System/Org/Private) | ❌ not shown (only in preview pane) | ✅ shown `:4982` (but dead color, see P1) |
| Area tags | ❌ not in row (in preview only) | ✅ `:5058` |
| Description | ⚠️ optional sub-line `:4768` (`showTemplateRowDescription`) | ✅ `:5052` |
| Est. time | ❌ | ✅ `:5081` |
| Category | ✅ chip `:4786` | ✅ footer `:5082` |
| Question count | ✅ `:4795` | ✅ `:5079` |
| Column hide/resize/view-settings | ✅ `:4454-4490`, `:4584` | ❌ n/a |
| Multi-select + bulk | ✅ checkbox col `:4730` | ❌ no selection checkbox |

**They do NOT render the same data consistently.** The two views show *different subsets* of the same record and *different* (both wrong) status semantics. A user toggling table→cards loses actions, multi-select, preview, and column control; toggling cards→table loses scope, area tags, est. time, and description. There is no shared row component. This is the single biggest consistency liability of the feature.

---

## What works (verified)

- **List load** — `GET /interview/templates` → `getTemplates` (`InterviewController.ts:3785`). Scope-aware SQL (system/org/private), org-language filtering for system templates, `question_count` + `sessions_used` subqueries, `source`/`areaTags` query filtering. Wired in `InterviewHub.tsx:1036` (initial `Promise.allSettled`) and `loadTemplates` (`:1137`). Normalized via `normalizeTemplateRecord` (`:847`).
- **Create** — `POST /interview/templates` → `createTemplate` (`:3967`). Full metadata persist incl. scope/visibility resolution (`resolveRequestedTemplateScope` / `resolveTemplateStoragePolicy`), area tags JSON, `version=1`, `status` default `draft`. Frontend `handleSave` (`TemplateBuilder.tsx:781`).
- **Clone** — `POST /interview/templates/:id/clone` → `cloneTemplate` (`:4041`). Deep-copies template **and all questions** (loop `:4106`), starts as `draft`, sets `source_template_id`. Two callers: `InterviewHub.handleCloneTemplate` (`:2000`) and `TemplateBuilder.handleCloneTemplate` (`:472`).
- **Use** — `POST /interview/templates/:id/use` → `useTemplate` (`:3927`) → `createSessionFromTemplate` (`:1188`). Gated to `status==='approved'` (`:3941`, `:1213`). Snapshots `template_version`, falls back to first org project if none supplied (`resolveValidProjectId :1151`).
- **Delete** — `DELETE /interview/templates/:id` → `deleteTemplate` (`:4141`). Blocks system + default templates, cascades question delete. UI `handleDeleteTemplate` (`:2033`) with confirm.
- **Questions CRUD** — add/update/delete (`:4362` / `:4435` / `:4557`). Every question mutation bumps `template.version` (`:4423`, `:4545`, `:4574`). Full field set persisted (answer_type, is_required, options JSON, expected_answer_shape, description, evidence_prompt, allow_voice/file/url/context_note).
- **Import-source** — `POST /interview/templates/import-source` → `importTemplateSource` (`:4582`). Real: multer upload, PDF via `PDFParserService.extractTextFromBuffer`, TXT/MD via utf-8, 50k char cap, returns truncation flag. UI `importSourceFile` (`TemplateBuilder.tsx:1048`).
- **AI draft generation** — `handleGenerateWithAI` (`TemplateBuilder.tsx:876`) → real `sendMessageToAI(...)` (gemini) with a structured JSON system prompt; parses, normalizes, replaces question list. **Real LLM call, not stubbed.**
- **AI question-improvement proposal** — `proposeQuestionImprovementsWithAI` (`:1100`+) → real LLM, returns add/update/remove/reorder proposal surfaced in a diff modal (`showAiProposalModal`). Real.
- **Template builder editor** — per-question card (`TemplateBuilder.tsx:2493`): textarea question, answer-type `<select>`, required toggle, options editor (select/scale), help hint, description, evidence prompt, expected-answer-shape, 4 modality pills, up/down + dnd-kit drag reorder. Validation (`validate :559`) enforces name, ≥1 question, ≥2 options for select/scale.
- **Preview pane** — `InterviewTemplatePreview.tsx`: meta pills, description, audience, first-12 questions (lazy-loaded via `templateQuestionsById` `:842` / loader `:1410`), AI hint strip (Summarize/Improve/Find gaps → real prompt build `:7490`), clone/delete/edit actions.
- **Table polish** — resizable columns with paired-delta bounds (`:4454`), hideable columns + view-settings popover (`:4584`), select-all/indeterminate (`:4509`), keyboard nav (Enter/Space/Esc `:4708`), empty state with CTA (`:4926`).
- **Schema self-healing** — `ensureInterviewTemplateV6Columns` (`:687`) / `...QuestionV6Columns` (`:731`) idempotent ALTER-ADD migrations run before template ops.

**Nothing in the Templates data path is mocked.** Demo data (`interviewDemoData`) is only a *fallback* when the API errors or returns empty in specific refresh paths (`:5147-5150`) and in `TemplateBuilder.loadTemplate` for `isInterviewDemoId` ids (`:337`).

---

## P0 — must fix before GA

### P0-1 — Archive & Restore are dead backend endpoints (no UI)
`POST /interview/templates/:id/archive` (`interview.routes.ts:268` → `archiveTemplate` `InterviewController.ts:4178`) and `/restore` (`:275` → `restoreTemplate` `:4206`) are fully implemented server-side but **never called from the frontend**. Grep of `InterviewHub.tsx` for `archive`/`restore` returns only an unrelated `archived` status-config key (`:450`, `:2949`) and no handler/menu item. The row actions menu (`:4829`) offers Open/Assign/Use/Clone/Edit/Delete — no Archive/Restore.
**Impact:** Users can never archive a template; once `status='archived'` is reached (only reachable via direct API), there is no UI to restore it, and (see P0-2) it still shows as "Active". Lifecycle is broken.
**Fix:** Add Archive (and Restore when archived) to `RowActionsMenu` + preview footer, wired to the endpoints, with optimistic `loadTemplates()` refresh.

### P0-2 — Table status column shows fabricated status, never the real one
`InterviewHub.tsx:4799-4818`: the "Status" column renders only `template.isDefault ? "Default" : "Active"`. It never reads `template.status`. A `draft`, `in_review`, or `archived` template all render as **"Active"** in the table.
**Impact:** Drafts are indistinguishable from approved templates in the primary (table) view; archived templates look live; reviewers cannot triage. Directly contradicts the column header "Status".
**Fix:** Map `template.status` → localized badge (Draft/In review/Approved/Archived) with distinct colors; keep "Default" as a separate chip if desired.

### P0-3 — Status filter chips filter by `isDefault`, not status
`filteredTemplates` (`:1683-1688`): `templateStatusFilter` of `'default'` filters `t.isDefault`, anything else filters `!t.isDefault`. There is no draft/approved/archived filter. `templateStats` (`:1750`) likewise counts `default`/`active` off `isDefault`.
**Impact:** No way to find drafts or hide archived. Combined with P0-1/P0-2, the entire status lifecycle is invisible and unfilterable.
**Fix:** Replace/extend the chips with real status filters; add an "Archived" filter that, by default, hides archived (the backend currently *returns* archived templates — see P1-4).

---

## P1 — high

### P1-1 — Per-question category is hardcoded to `'strategy'`; no multi-category builder
`TemplateBuilder.tsx`: every question-creation site sets `category: 'strategy'` — manual add (`:626`), AI-generated (`:990`, ignoring the AI's returned category), and the AI-proposal path (`:1523`). There is **no category selector** in the question editor card (`:2493`–`2835`; grep confirms category only appears in types/payload, never as an input). The file header advertises "5 Categories: Strategy, Operations, Digital, People, Finance" (`:6-7`) — aspirational, not built.
**Impact:** You cannot build a real multi-category template through the UI. Backend `getTemplateQuestions` orders by `category, sort_order` (`:3920`) — with all questions `'strategy'`, the category sort is inert. The `QuestionCategory` type is effectively unused.
**Fix:** Add a category `<select>` to the question card; default new questions to the template's domain; respect AI-returned `category` on generation.

### P1-2 — Cards view loses the preview pane and all row actions
`renderTemplatesCards` (`:4953`) returns a bare grid of `<button>`s (`:5013`) with only `onClick=select` / `onDoubleClick=open`. In cards mode (`:7553`) the entire `TableWithPreviewLayout` (preview pane + AI hints + clone/delete/edit) is bypassed. No multi-select checkbox either.
**Impact:** Switching to cards silently strips functionality the user had in table mode. Inconsistent mental model.
**Fix:** Either add a row-actions kebab + selection to cards, or render cards *inside* the same preview layout so the preview pane persists across both modes.

### P1-3 — `scopeColor` is dead code (all three branches identical)
`InterviewHub.tsx:4993-4997`: System / Org / Private all resolve to the exact same class string. The scope badge is colorless-by-design despite the conditional implying differentiation.
**Impact:** Scope is visually undifferentiated in cards; reader assumes a bug. Pure noise / misleading code.
**Fix:** Give each scope a distinct token, or collapse to a single constant and drop the ternary.

### P1-4 — `getTemplates` returns archived templates into the live list
`getTemplates` SQL (`:3816`) has no `status != 'archived'` filter; it only *deprioritizes* archived via `ORDER BY CASE t.status ... ELSE 2 END` (`:3844`). With P0-2/P0-3, archived templates therefore appear as normal "Active" rows that can be cloned/used (use is blocked at `:3941`, but clone/edit are not).
**Impact:** Archived templates pollute the library and are actionable. Archive becomes meaningless.
**Fix:** Exclude archived by default at the query (or filter client-side) and surface them only under an explicit "Archived" filter.

### P1-5 — `evaluate-quality` is a deterministic linter labeled "AI quality"
`evaluateTemplateQuality` (`:7435`) delegates to `interviewQuestionQualityRules.ts` — a pure, no-AI, 10-rule regex/length linter (`evaluateQuestionQuality :20`, header explicitly says "no DB, no AI"). The frontend (`TemplateBuilder.tsx:294`, toast `:838`) and route comment (`V6-B04`) call it "AI quality gate".
**Impact:** Not a defect of correctness, but a truthfulness gap: marketing/UX implies AI scoring; it is heuristic linting. Acceptable as a feature, mislabeled.
**Fix:** Rename UX/comments to "Question quality check" (or actually route through the LLM if "AI" is the promise).

---

## P2 — medium / low

### P2-1 — N+1 question save loop
`TemplateBuilder.handleSave` (`:787-818`): deletes then upserts each question with a **separate awaited HTTP request** in a `for` loop. A 30-question template ⇒ 30+ sequential round-trips on every save. No batch endpoint exists.
**Fix:** Add a bulk `PUT /interview/templates/:id/questions` (replace-set) endpoint; or `Promise.all` the per-question calls at minimum.

### P2-2 — `version` is sent on PATCH but ignored; never surfaced
`handleSave` spreads `...template` (incl. `version`) into the PATCH body (`:772-779`). `updateTemplate` (`:4234`) does **not** read `version` from body (good — it bumps internally `:4338`), so the client value is silently dropped. `buildTemplateResponse` (`:1099`) never returns `version`, so the UI can't display it anyway. Versioning exists in the DB but is invisible to users.
**Fix:** Stop sending `version` from the client; expose `version` in `buildTemplateResponse` and show it (e.g., preview pane / row).

### P2-3 — `answerDesignGuide` field is overloaded to store allowed-answer-types JSON
`TemplateBuilder` stores a JSON array of allowed answer types *inside* the free-text `answerDesignGuide` column (`parseAllowedAnswerTypes :206`, `serializeAllowedAnswerTypes :223`, consumed at `:462`). Backend treats `answer_design_guide` as a plain guide string (`:4322`, `:1117`).
**Impact:** Field semantics are ambiguous; a human-entered guide and a machine JSON blob share one column. Fragile (legacy non-JSON falls back to "all types").
**Fix:** Add a dedicated `allowed_answer_types` column or store under a clearly-typed metadata key.

### P2-4 — Templates load failure has no error banner (silent false-empty)
Initial load (`:1080-1085`) and `loadTemplates` (`:1137`) set `templates=[]` on rejection with only a `console.error`. Unlike sessions/insights/initiatives, there is **no `templatesLoadError` state / banner**. A backend 500 renders identically to a genuinely empty library ("No templates yet" `:4932`).
**Fix:** Add a `templatesLoadError` banner mirroring `sessionsLoadError` etc.

### P2-5 — Category chips render lowercased ("quick"/"data"/"digital")
`buildTemplateResponse` lowercases `category` (`:1110`); the table chip (`:4786`) and cards footer (`:5082`) render it verbatim. The screenshot's `QUICK / DATA / DIGITAL` tags will actually display lowercased and unstyled (single neutral `INTERVIEW_META_CHIP_CLASS`), with no per-category color or icon.
**Fix:** Title-case + color-map known categories (DIGITAL/OPERATIONAL/COST/DATA/STANDARD/QUICK/CUSTOM) consistently in both views.

### P2-6 — Type/status model mismatch frontend↔backend
`TemplateBuilder` `Template.status` is typed `'draft' | 'approved'` (`:104`) and `visibility` `'global'|'org'|'role_based'|'admin_only'` (`:105`), omitting backend's `in_review` / `archived` statuses. The publish flow is binary `draft→approved` (`:775`); there is **no in-app review/approval workflow** even though the backend `ORDER BY` and `useTemplate` gating presuppose an `in_review`→`approved` transition.
**Fix:** Decide whether `in_review` is a product concept; if yes, build the review UI; if no, drop it server-side to avoid dead states.

### P2-7 — `ensureInterview*V6Columns` runs PRAGMA on nearly every template request
`getTemplates`/`getTemplate`/`getTemplateQuestions`/create/clone/update/add/update-question all call `ensureInterviewTemplateV6Columns()` (and often the question variant), each doing `getTableColumns` (PRAGMA table_info) on every request (`:3787`, `:3885`, `:3907`, `:3969`, …).
**Impact:** Minor per-request overhead; migrations should be one-time at boot.
**Fix:** Run the column-ensure once at startup (or memoize a "migrated" flag) instead of per-request.

### P2-8 — Preview "Assign" action never wired in preview footer
`InterviewTemplatePreviewFooter` supports an `onAssign` prop (`:204`, `:231`) but the call site (`InterviewHub.tsx:7603`) never passes it, so Assign is absent from the preview even though it exists in the table row menu (`:4838`). Minor inconsistency between row-menu and preview-footer action sets.

### P2-9 — `buildPrompt` status line also fabricated
The AI-hint prompt builder (`:7526`) emits `Status: ${tpl?.isDefault ? 'Default' : 'Active'}` — feeding the same fake status to the LLM. Cosmetic but propagates P0-2's wrong model into AI context.

---

## Ranked remediation backlog

### Small (S) — hours each
- **P0-2** Real status badge in table (map `template.status`). *(also fixes P2-9 by reusing the mapping)*
- **P1-3** Kill dead `scopeColor` ternary.
- **P2-2** Stop sending `version` on PATCH; expose `version` in `buildTemplateResponse`.
- **P2-4** Add `templatesLoadError` banner (copy the sessions pattern).
- **P2-5** Title-case + color-map category chips in both views.
- **P1-5 / P2-9** Rename "AI quality" → "Question quality check" in UX + comments.
- **P2-8** Pass `onAssign` into preview footer (or intentionally drop the prop).

### Medium (M) — 0.5–2 days each
- **P0-1** Wire Archive/Restore into row menu + preview footer + handlers + refresh.
- **P0-3** Real status filter chips + counts (replace `isDefault`-based logic); default-hide archived.
- **P1-4** Exclude archived from `getTemplates` default result; add explicit archived query path.
- **P1-1** Per-question category selector in the editor card; respect AI-returned categories.
- **P2-1** Bulk question-save endpoint (or `Promise.all`).
- **P2-7** Move V6 column-ensure to one-time boot migration.

### Large (L) — multi-day
- **P1-2** Unify cards & table on a single row model + shared preview layout so both views expose identical actions/selection/preview (eliminates the cards↔table capability gap wholesale).
- **P2-6** Build (or formally remove) the `in_review` review/approval workflow end-to-end so the DB status model and the UI agree.

---

## File:line index (load-bearing)

**Backend** — `server/src/routes/interview.routes.ts`
- Template routes block: `:191`–`:298` (list/create/import-source/evaluate-quality/get/questions/use/clone/update/delete/archive/restore/+question CRUD)

**Backend** — `server/src/controllers/InterviewController.ts`
- `getTemplates :3785` · `getTemplate :3882` · `getTemplateQuestions :3904` · `useTemplate :3927`
- `createTemplate :3967` · `cloneTemplate :4041` (deep question copy `:4106`) · `deleteTemplate :4141`
- `archiveTemplate :4178` · `restoreTemplate :4206` *(both UI-unwired — P0-1)* · `updateTemplate :4234` (version bump `:4338`)
- `addTemplateQuestion :4362` · `updateTemplateQuestion :4435` · `deleteTemplateQuestion :4557` · `importTemplateSource :4582`
- `evaluateTemplateQuality :7435` (heuristic, not AI — P1-5)
- helpers: `buildTemplateResponse :1099` (no `version`; lowercases category) · `buildTemplateQuestionResponse :1129` · `createSessionFromTemplate :1188` · scope/storage `:402`/`:412`/`:439` · access `:465`/`:479` · V6 migrations `:687`/`:731`
- `server/src/services/interviewQuestionQualityRules.ts` — 10-rule linter (no AI)

**Frontend** — `src/components/Interview/InterviewHub.tsx`
- view state `:606-619` · templates state `:766` · question cache `:842`
- load `:1036` / `loadTemplates :1137` / refresh-with-demo-fallback `:5142-5151`
- `filteredTemplates :1679` (status filter = isDefault — P0-3) · `templateStats :1750`
- `handleCloneTemplate :2000` · `handleDeleteTemplate :2033`
- `renderTemplatesTable :4408` (status fake `:4799`; actions menu `:4827`; empty `:4926`)
- `renderTemplatesCards :4953` (dead scopeColor `:4993`; status `:4998`; no actions)
- templates tab render + preview wiring `:7483-7634` (buildPrompt fake status `:7526`)
- view toggle `:8271-8297`

**Frontend** — `src/components/Interview/TemplateBuilder.tsx`
- types/status `:75-161` · default template state `:252` · load (+demo) `:334`
- `validate :559` · `handleAddQuestion :620` (category hardcoded `:626`)
- `handleSave :749` (N+1 loop `:787`; status binary `:775`)
- `handleGenerateWithAI :876` (real LLM; category hardcoded `:990`)
- `proposeQuestionImprovementsWithAI :1100`+ (category hardcoded `:1523`) · `importSourceFile :1048`
- `evaluateQuality :695` · allowed-answer-types overload `:206`/`:223`/`:462`
- question card editor `:2493`–`2835` (no category input)

**Frontend** — `src/components/Interview/InterviewTemplatePreview.tsx`
- `InterviewTemplatePreviewBody :57` (status pill fake `:76`) · `InterviewTemplatePreviewFooter :211` (`onAssign` unused `:231`)
