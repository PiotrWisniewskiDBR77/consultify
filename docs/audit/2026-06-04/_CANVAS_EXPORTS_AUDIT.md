# Canvas → Platform Exports Audit

**Date:** 2026-06-04
**Scope:** Every materialization / export / handoff path exposed by `WorkCanvasDocumentPanel` and its backend route `server/src/routes/work-canvas.routes.ts`.
**Auditor mandate (from owner):** *"Inne narzędzia dobrze nie działają, ale Canvas musi produkować sensowne wyjścia — schematy muszą się zgadzać, ID muszą być prawdziwe, dane mają round-tripować bez strat."*

---

## TL;DR — Overall Score: **38 / 100**

Canvas reaches downstream tools through **eleven distinct surfaces**, but only **three** of them produce data that a downstream tool will be able to consume sensibly when it is fixed:

- Tasks (via `TaskService.createTask`) — clean, canonical, schema-valid.
- Markdown / CSV / JSON / PDF binary downloads — pure file-out, no schema risk.
- Reports (after C4.2) — the `report_builder_reports` row is created with a valid `source_type` and back-link.

The other eight paths are some combination of:
- **Wrong schema** (Canvas writes columns that don't exist; bypasses canonical service; uses wrong type discriminant).
- **Fake back-link URLs** (target route doesn't exist in `AppRoutes.tsx`).
- **Silent data loss** (content_json is a degenerate `[{type:'paragraph', text: <entire markdown blob>}]` shape — no headings, no lists, no tables survive round-trip).
- **No bridge at all** (DocumentStudio, Outputs hub, Table Studio `tp_tables`).

The user is right: the downstream being incomplete makes this **more** urgent, not less. Every fake/degenerate write Canvas makes today is a ticking time bomb that will need migration scripts once the downstream tool lands.

---

## 1. Export Matrix

| Target | Wired? | Schema valid? | Required fields met? | Back-link works? | Visible downstream? | Notes |
|---|---|---|---|---|---|---|
| **idea** (`/save-to-workspace`) | YES | PARTIAL | YES | NO (URL mismatch) | YES (My Work Ideas) | Direct `INSERT INTO my_ideas` via `insertDynamic`. Writes `seed_text`, `stage='spark'`, `source_type='work_canvas'`. **Also creates a `my_idea_maps` row with empty nodes/edges JSON** — degenerate empty Mind Map. Returns URL `/my-work/ideas/${id}` but the panel **actually navigates to `/my-work?ideaId=${id}`** (different shape) — inconsistent internal contract. |
| **note** (`/save-to-workspace`) | YES | **NO** | YES | NO (URL mismatch) | YES, but degraded | Bypasses canonical `notebookService.createPage` and inserts directly. `content_json = {type:'doc', content:[{type:'paragraph', text: draft.contentMd}]}` — **the entire markdown blob lives inside one TipTap paragraph node**. No headings, no lists, no tables, no images survive round-trip. Returns `/my-work/notebook/${noteId}`, panel navigates to `/my-work?tab=notebook` — list, not specific note. |
| **initiative** (`/save-to-workspace`) | YES | **PARTIAL/UNSAFE** | NO | NO (`/initiatives/${id}` works only as list redirect) | DEPENDS ON SCHEMA | Two competing `initiatives` schemas live in the codebase. Postgres (`PostgresDatabase.ts:1968`) has `summary`, `owner_execution_id`, no `created_by`/`description`/`source_type`/`source_id`. Route ensure (`initiatives.routes.ts:48`) has `description`, `created_by NOT NULL`, no `summary`. Canvas writes a union of both (`name`, `title`, `summary`, `description`, `created_by`, `owner_id`, `owner_execution_id`, `source_type`, `source_id`) and lets `insertDynamic` drop unknown columns silently. End result depends entirely on which schema actually runs in prod. Bypasses canonical `initiativeService.createInitiative`. |
| **decision** (`/save-to-workspace`) | YES | **NO — invalid type** | YES | NO (`/decisions/${id}` redirects to list) | YES (in /my-work/decisions) | Canvas writes `type: 'strategic'`. The decisions service (`DecisionService.ts:24`) declares `type: 'GO_NO_GO' \| 'APPROVAL' \| 'RESOURCE_ALLOCATION' \| 'OTHER'`. `'strategic'` is **not in the enum**. The DB column is TEXT without CHECK, so insert succeeds — but every consumer that branches on `type` (and there are many — `DecisionController:706`, `decisionService.ts:99` for default options) gets fallback behavior or no options. Decision is created with **empty options array**, no escalation deadline, no stakeholders, no history record, no notification. Compare to canonical `decisionService.createDecision` which seeds options, schedules escalation, records history, notifies maker. |
| **task** (`/save-to-workspace`) | YES | YES | YES | NO (`/my-work?taskId=${id}` — handled by MyWorkHub) | YES | The one well-behaved promote target. Uses canonical `TaskService.createTask` — Zod-validated, proper INSERT with `$1..$11` Postgres params, notify-assignee path runs. **One concern**: `description` is `markdownSummary(draft.contentMd, 5000)` and `CreateTaskSchema` caps description at 5000 chars — so a borderline-large Canvas will throw a Zod validation error rather than truncate. Owner: missing — uses no assignee. |
| **report** (`/create-output`) | YES | YES | YES | NO (`/reports/${id}` does NOT exist) | UNCLEAR | C4.2 wires this properly: creates BOTH a `work_canvas_drafts kind='report'` row AND a `report_builder_reports` row (`source_type='UPLOAD_BUNDLE'`, `report_type='CANVAS_REPORT'`, `status='DRAFT'`). All NOT NULL fields satisfied. But `report_type='CANVAS_REPORT'` is **not in any known type enum** (e.g. `report_invocation_profiles` declares `R1\|R2\|R3\|R4\|custom`); list endpoint doesn't filter, so it appears in `/api/report-builder` listing, but any builder UI that switches on type will treat it as unknown. Return URL `/reports/${reportId}` — Reports module migrated to `/presentations` (see `AppRoutes.tsx:1847` "reports_ui_moved_to_presentations") — **back-link 404s**. |
| **presentation** (`/create-output`) | YES | **NO — wrong columns** | YES (for what gets inserted) | URL works (`/presentations/builder/${id}`) | YES | Canvas writes to `presentation_decks` with `created_by`, `source_id`, `source_refs_json` — **none of these columns exist** in the canonical Postgres schema (`568_presentations_brand_kits_templates.sql:128`; canonical uses `source_artifacts`, `generated_by`, no `created_by`). `insertDynamic` silently drops them. Result: deck rows have no provenance, no created-by attribution, and the `source_refs_json` payload built by `outputMetadata(...)` is **never persisted**. The "metadata" returned in the response is therefore **a fiction** — it was packaged but not saved. Also writes `presentation_cards` rows; that table has no migration anywhere — depends on legacy/manual schema. |
| **table output** (`/create-output`) | PARTIAL (deferred) | PARTIAL | YES | URL goes to draft editor | NO (does not reach Table Studio) | Creates a sibling `work_canvas_drafts kind='table'` row with markdown-rendered table inside, *not* a `tp_tables` Table Studio entry. Rationale (deferred): bridging to `tp_tables` needs `MetadataService.createField` for each column plus `RecordsService.createRecord` for rows (see `artifactRegistryService.ts:832 ensureStarterTableData`). Canvas markdown tables have no typed schema — naive bridge would land all-text columns with junk field names. **The rationale is sound** but the current "just stay in canvas" output is invisible in Table Studio's UI. Return URL `/work-canvas?draftId=...` is correct (re-opens the table draft in Canvas itself, not Table Studio). |
| **DOCX download** | YES | YES (binary) | N/A | N/A | N/A (download only) | `UnifiedExportService.exportDocx`. Output quality is **mediocre**: title + sourceLabel + lifecycle + then markdown lines as `Paragraph` blocks one-line-each — **NO heading parsing**, **NO list parsing**, **NO table parsing**. `##`, `\|`, `- [ ]` etc. all render as literal text. Truncates at 500 lines. Will not satisfy "produce a Word document a consultant would send to a client." |
| **XLSX download** | YES | YES (binary) | N/A | N/A | N/A | `UnifiedExportService.exportXlsx`. Pipes `exportCsv(draft)` into a sheet via naive `line.split(',')` — broken for any CSV with embedded commas inside quoted cells (the split happens before the quote-stripping replace, so quoted commas fragment cells). Footer rows added. Acceptable for a draft. **Not** a financial-model-quality output. |
| **PPTX download** | YES | YES (binary) | N/A | N/A | N/A | `UnifiedExportService.exportPptx`. Per-section slides, capped at 20. Title + body — markdown not rendered (raw markdown shows as text inside a textbox). No tables, no images, no theme. Comparable to "ChatGPT export to PowerPoint" baseline. |
| **PDF download** | YES | YES (binary) | N/A | N/A | N/A | pdfkit-based, single text block, raw markdown not rendered. |
| **Markdown / CSV / JSON download** | YES | YES | N/A | N/A | N/A | Pure passthrough. Zero schema risk. Solid. |
| **DocumentStudio bridge** | **NO** | — | — | — | — | **There is no Canvas → `/api/document-studio` API call anywhere in `WorkCanvasDocumentPanel.tsx` or `api.ts`.** The only path is: user downloads .docx and **manually uploads to DocumentStudio**. The proper intake → plan → generate pipeline (`POST /api/document-studio/plan` → `POST /api/document-studio/generate`) is **not invoked** from Canvas. |
| **Table Studio bridge** | **NO (deferred)** | — | — | — | — | No call into `tp_bases` / `tp_tables` / `MetadataService.createField` / `RecordsService.createRecord`. Deferred for the schema-inference reason above. |
| **Outputs hub** | **NO (broken)** | — | — | **NO** | NO | The `saveToOutputs()` UI action exports markdown via `workCanvasExportDraft(..., 'markdown')` (which returns a Blob the user downloads) and then navigates the SPA to `/outputs`. **There is no `/outputs` route in `AppRoutes.tsx`.** The user lands on a 404 (or whatever the catch-all renders). There is no `outputs_library` table, no `EE Deliverables` entry, no `OutputsAggregateTabContent` ingestion path. The "Save to Outputs" button **is a lie**. |
| **EE Deliverables module** | **NO** | — | — | — | — | The MEMORY.md project `project_ee_deliverables_module` calls for Document+Table+Presentation Studio + Outputs hub. Canvas writes to **none** of the Document/Table Studio backends and the Outputs hub doesn't exist. Presentation Studio gets a degenerate `presentation_decks` row with no `created_by`. EE Deliverables integration is **zero** at the data layer. |
| **commitProposalToDomain (approval flow)** | YES | INCONSISTENT | YES | varies | YES | Wired separately in `services/workCanvasService.ts:880`. **Diverges from `createWorkspaceResource`** in critical ways: (a) calls canonical services (`initiativeService.createInitiative`, `decisionService.createDecision`, `taskService.createTask`); (b) for `note` target returns `'unsupported'` while the save-to-workspace route happily creates a degenerate note; (c) for `idea` calls `createCanvasIdea` (a different helper); (d) types map sensibly to enum (`'APPROVAL'` default). **Two parallel implementations of the same domain operation with different correctness guarantees** — the `save-to-workspace` route is the buggier one. |

Legend: **YES** = works; **PARTIAL** = works on happy path with caveats; **NO** = wrong/broken; **N/A** = doesn't apply.

---

## 2. P0 — Broken Outputs (must fix before any downstream rollout)

### P0-1. Notes round-trip is content-destroying

**File:** `server/src/routes/work-canvas.routes.ts:2151-2185`

Canvas writes:
```js
content_json: JSON.stringify({
  type: 'doc',
  content: [{ type: 'paragraph', text: draft.contentMd }],
})
```

TipTap/ProseMirror schema: a paragraph node holds **inline content** (text runs), not a multi-paragraph markdown blob. When `NotebookPageRenderer` reads this back:

- All `##` headings render as plain text.
- All `\| col \| col \|` table syntax renders as plain text with literal pipes.
- All `- [ ]` checkboxes render as plain text.
- All `![alt](url)` images don't load.
- `\n` characters either collapse or render as literal `\n`.

The canonical writer (`notebookService.ts:251`) calls `textToBlocks(data.contentText)` which produces proper TipTap nodes. Canvas should use the same.

**Comparison:** `notebookService.create` and `routes/my-work/notebook.routes.ts:667` both go through `textToBlocks`. Canvas is the only writer that bypasses it.

**Impact:** When the Notes UI is fixed, every Canvas-promoted note will display as a single-paragraph wall of unstyled text. Owner loses the ability to re-edit content as a structured document.

### P0-2. Decisions get the wrong `type` and skip the canonical lifecycle

**File:** `server/src/routes/work-canvas.routes.ts:2187-2216`

Canvas writes `type: 'strategic'`. The decisions module's TypeScript enum (`DecisionService.ts:24`) declares only `'GO_NO_GO' | 'APPROVAL' | 'RESOURCE_ALLOCATION' | 'OTHER'`. Insert succeeds (column is TEXT) but:

- `DecisionService.createDecision` populates **options** (`go/no-go` or `approve/reject` defaults), **escalation_deadline** (`deadline + 7d`), **stakeholders**, **history record**, **notification to decision_maker**. Canvas does none of these.
- Reads (`DecisionController`) branch on `type` value; `'strategic'` will fall through every switch.
- The `commitProposalToDomain` path (workCanvasService.ts:952) correctly maps to `'APPROVAL'` default.

**Fix:** Replace the direct `insertDynamic('decisions', ...)` with `decisionService.createDecision({ organizationId, title, description, type: 'APPROVAL', decisionMakerId: userId, createdBy: userId, ... })`. Same change that `commitProposalToDomain` already uses correctly.

### P0-3. `/outputs` navigation 404s — "Save to Outputs" is a lie

**Files:**
- `src/components/AIChat/WorkCanvasDocumentPanel.tsx:1186` — `window.location.assign('/outputs')`
- `src/routes/AppRoutes.tsx` — **no route definition for `/outputs`**

The button label says "Save to Outputs Library" and the flow downloads a markdown file and then attempts SPA navigation to a non-existent route. There is no Outputs Library table, no Outputs ingestion endpoint, no Outputs aggregation route.

**Comment in code** (`saveToOutputs`, line 1182): *"Fixed: was navigating to /presentations (wrong module + full reload). /outputs is the correct Outputs/EE hub."* — except the route doesn't exist.

**Fix:** Either (a) remove the "Save to Outputs" CTA until the EE Deliverables module ships, or (b) navigate to `/presentations?tab=outputs` (an existing aggregate tab, see `ReportsAndPresentations/OutputsAggregateTabContent.tsx`) AND actually persist an Outputs record.

### P0-4. Reports back-link 404s

**File:** `server/src/routes/work-canvas.routes.ts:2577`

`createOutputResource` for `outputType==='report'` returns `url: /reports/${reportId}`. Reports module was relocated to `/presentations` (see `AppRoutes.tsx:1847` rendered placeholder with `reason="reports_ui_moved_to_presentations"`). There is no `/reports/:id` route.

The Canvas status feedback prints this URL as a clickable Markdown link. User clicks → 404.

**Fix:** Compute the URL based on the actual mounted route. Add a `reportsRouteFor(reportId)` helper that maps to `/presentations?reportId=${id}` (the canonical landing), or add a `/reports/:id` route.

### P0-5. Decision/Initiative back-link URLs land on lists, not entities

- Canvas decision URL: `/decisions/${id}` → `AppRoutes.tsx:1191` does `<Navigate to="/my-work/decisions" replace />` — **strips the id** and lands on the list.
- Canvas initiative URL: `/initiatives/${id}` → only `/initiatives` is a real route; `id` is dropped or 404 depending on router config.

User completes the promote and clicks "Open →" expecting the specific entity. Lands on a list and has to search for it.

**Fix:** Make the back-link target the entity-detail route the module actually uses (e.g. `/my-work/decisions/${id}` or `/initiatives?initiativeId=${id}`).

### P0-6. Presentation deck loses creator + provenance

**File:** `server/src/routes/work-canvas.routes.ts:2378-2394`

Canvas writes `created_by`, `source_id`, `source_refs_json` to `presentation_decks`. The canonical schema (`568_presentations_brand_kits_templates.sql:128`) has **none of those columns**. `insertDynamic` silently drops them. The deck row has:

- No `created_by` → cannot filter "decks I created".
- No `source_id` → no link back to the Canvas draft.
- No `source_refs_json` → the `outputMetadata(draft, {...})` payload (sourceVersionId, lifecycleState, createdAt, etc.) is **packaged in memory, returned to the client, and never persisted**. The next read of the deck will have `source_refs_json IS NULL`.

The canonical column for source attribution is `source_artifacts` (TEXT — looks like JSON). For creator, `generated_by` (TEXT).

**Fix:** Map `created_by → generated_by`, `source_id → source_artifacts` (as JSON `[{type:'work_canvas', id: draft.id}]`), `source_refs_json` is fictitious — drop it from the insert and store via `outline_json` if needed.

### P0-7. Initiative writes depend on which schema actually ran

**File:** `server/src/routes/work-canvas.routes.ts:2247-2268`

Two `CREATE TABLE IF NOT EXISTS initiatives` definitions coexist:

| Column | `routes/initiatives.routes.ts:48` | `PostgresDatabase.ts:1968` |
|---|---|---|
| `name` | YES NOT NULL | YES NOT NULL |
| `title` | YES | YES |
| `summary` | NO | YES |
| `description` | YES | NO |
| `created_by` | YES NOT NULL | NO |
| `owner_id` | NO | NO (has `owner_business_id`, `owner_execution_id`) |
| `user_id` | NO | NO |
| `source_type` / `source_id` | YES | NO |

Canvas writes a union and lets `insertDynamic` drop unknown columns. Result:

- If `routes/initiatives.routes.ts:48` ran first: `summary` lost, `created_by` set, source columns set, `owner_execution_id` lost.
- If `PostgresDatabase.ts:1968` ran first: `created_by` lost (and if the route schema also has `created_by NOT NULL` — depends on which definition ran — insert fails or null), `summary` set, source columns lost.

Either way **part of what Canvas thinks it persisted is gone**.

**Fix:** Route through the canonical `initiativeService.createInitiative({ ... market_context: ... })` like `commitProposalToDomain` already does. Stop hand-rolling inserts in two different shapes.

### P0-8. Idea promotion creates an empty Mind Map row

**File:** `server/src/routes/work-canvas.routes.ts:2124-2140`

`my_idea_maps` is created with `nodes_json: '[]'`, `edges_json: '[]'` — an empty Mind Map. When the user opens the idea expecting to see a structured visualization of the Canvas content, they see a blank canvas.

This isn't a schema bug per se — it's a missed translation opportunity. The Canvas markdown has sections, headings, lists — those map cleanly to nodes+edges. The current behavior gives the user the work of re-creating the structure inside Ideas.

**Fix (S):** At minimum, seed nodes from `markdownSections(draft.contentMd)` — one node per H2, with edges from a synthetic root. The same sectionizer used for PPTX is reusable.

---

## 3. P1 — Sensible-but-Incomplete

### P1-1. DOCX/XLSX/PPTX exports do not render markdown structure

**File:** `server/src/services/export/UnifiedExportService.ts`

- DOCX: `src.markdown.split('\n').slice(0, 500).map((line) => new docx.Paragraph(line || ' '))` — every line is one paragraph; **headings, lists, tables, bold, italics are all lost**. A Canvas with a beautiful markdown table → docx with raw `\| col \| col \|` text rows.
- XLSX: CSV parsing via `line.split(',')` THEN `cell.replace(/^"|"$/g, '').replace(/""/g, '"')` — quoted cells with commas inside fragment.
- PPTX: slide body is raw markdown text inside `addText` — `## subheading` shows as literal text including the hashes.
- PDF: same problem as DOCX.

**Comparison:** ChatGPT Canvas/Claude Artifacts and Gemini Canvas render markdown structure into the binary format. Consultify Canvas is a baseline below ChatGPT.

**Fix (M):** For DOCX, use a markdown → docx parser (e.g. `mdast-util-from-markdown` + `docx-md-to-docx` or hand-rolled walker over the AST). For PPTX/PDF, same path but project paragraphs through a renderer that recognizes headings, lists, code blocks. For XLSX, only render content if the Canvas is a `kind === 'table'`; otherwise the spreadsheet is meaningless and the button should be disabled.

### P1-2. Report `report_type='CANVAS_REPORT'` is not a recognized type

**File:** `server/src/routes/work-canvas.routes.ts:2561`

The `report_invocation_profiles` declares `'R1' | 'R2' | 'R3' | 'R4' | 'custom'` (and the older `'GENERAL'` / `'ASSESSMENT'` family). `'CANVAS_REPORT'` is a Canvas-specific invention.

- List endpoint (`/api/report-builder`) doesn't filter, so the row appears.
- The Report Builder UI's section generator / template router branches on `reportType` / `reportTypeV3`; an unknown type falls through to a "no template" branch.
- Profile lookup (`getProfilesForSourceType`) keys off `source_type` ('UPLOAD_BUNDLE') — that part works.

**Fix (S):** Use `'custom'` as the `report_type` value; store the Canvas hint in `config_json.canvasReport=true`.

### P1-3. `source_type='UPLOAD_BUNDLE'` is the right discriminant but the wrong sub-semantic

The Reports module designed `UPLOAD_BUNDLE` for actual file/upload bundle sources (`/api/report-builder/sources/upload_bundle`). A Canvas-promoted report is not an upload bundle — it's a generated-from-narrative source. There's no `WORK_CANVAS` enum value; using `UPLOAD_BUNDLE` is **the least-wrong existing choice** but will confuse "list reports created from uploads" queries.

**Fix (M):** Add `'WORK_CANVAS'` to `ReportSourceType` enum, migrate listing endpoints + the source-type-tabs UI.

### P1-4. `commitProposalToDomain` and `createWorkspaceResource` are TWO writers of the same entities with different correctness

The approve-proposal flow uses canonical services. The save-to-workspace flow hand-rolls inserts. Two code paths, two bug surfaces, two divergent behaviors:

| Target | `commitProposalToDomain` | `createWorkspaceResource` (save-to-workspace) |
|---|---|---|
| task | `TaskService.createTask` | `TaskService.createTask` (same — good) |
| initiative | `initiativeService.createInitiative` (proper) | Hand-rolled insertDynamic (broken — P0-7) |
| decision | `decisionService.createDecision` with valid enum | Hand-rolled with `type='strategic'` (broken — P0-2) |
| note | Returns `'unsupported'` | Hand-rolled with degenerate content_json (broken — P0-1) |
| idea | `createCanvasIdea` helper | Hand-rolled inline (different from createCanvasIdea) |

**Fix (M):** Delete `createWorkspaceResource` and have `/save-to-workspace` route call `commitProposalToDomain` (with a synthetic proposal record). The proposal-approval flow has been more carefully maintained.

### P1-5. Tasks bridge has projectId UUID validation risk

**File:** `server/src/services/TaskService.ts:17` + `routes/work-canvas.routes.ts:2228`

`CreateTaskSchema.projectId: z.string().uuid().optional().nullable()`. Canvas passes `draft.projectId || null`. But work_canvas_drafts can be created with arbitrary `projectId` shapes (the route doesn't validate UUID). If a non-UUID projectId is on the draft (e.g. a "demo-project" slug), `TaskService.createTask` will throw a Zod error → 500 to the user.

**Fix (S):** In the task branch of `createWorkspaceResource`, validate UUID before passing — fall back to `null` on mismatch.

### P1-6. Description field length

`markdownSummary(draft.contentMd, 5000)` exactly hits the Zod limit. Single-byte content that's exactly 5000 chars passes; multi-byte (Polish characters with diacritics often produce longer JSON than the markdown source) may produce strings >5000.

**Fix (S):** Cap at 4900 to leave headroom.

### P1-7. Workflows ledger writes are real, but the UI doesn't reach them

`/drafts/:id/workflows` creates a `governed_workflow_run` row — real. The Canvas surface that consumes this is a status badge, not a workflow UI. No regression — but means the "workflow" feature visible in the dropdown produces nothing the user sees.

---

## 4. P2 — Works As Advertised

- **Markdown download** — `exportMarkdown(draft)` round-trips the Canvas content faithfully.
- **CSV download** — for `kind='table'` Canvas drafts, sensible.
- **Metadata JSON download** — `exportJson(draft, userId)` returns the full draft envelope. Useful for debugging / federation.
- **Tasks** — `TaskService.createTask` is the canonical path.
- **Reports `report_builder_reports` row insert** — all NOT NULL columns satisfied, `source_type` is a real enum value (even if semantically off), `status='DRAFT'` is valid, listing endpoint surfaces the row.
- **Share link** (`/drafts/:id/share`) — backend persists a share record; not a "downstream tool export" per se but it works.
- **Version snapshots** (`createVersionSnapshot`) — created on every save-to-workspace and create-output call. Real audit trail.
- **Provenance back-pointers** on the Canvas draft — `linkedWorkspaceResources` and `createdOutputs` are persisted in the draft's `provenance` JSON via `updateDraftAfterOperation`. The Canvas knows where it sent its content, even if the downstream doesn't know where it came from.
- **Research finalize report** (`/research/finalize-report`) — works for `kind='research'` drafts, creates a real `report_builder_reports` row through `createOutputResource('report')`. Same caveats as P1-2/P1-3.

---

## 5. What's Missing Entirely

| Missing path | Owner expectation | Current reality |
|---|---|---|
| **Canvas → DocumentStudio (proper intake)** | One-click "send to Document Studio" that calls `/api/document-studio/plan` → `/generate`, lands in DocumentStudio editor with the markdown as the source of truth | Only manual `.docx` download → manual re-upload |
| **Canvas → Table Studio (`tp_tables`)** | One-click "send to Table Studio" that creates a `tp_base`/`tp_table`/`tp_fields`/`tp_records` set with proper field types | Sibling `work_canvas_drafts kind='table'` row — Table Studio never sees it |
| **Canvas → Outputs hub** | "Save to Outputs" lands the content in a unified hub the EE Deliverables module surfaces | `/outputs` route doesn't exist; button is a lie |
| **Canvas → EE Deliverables module** | Per `project_ee_deliverables_module` MEMORY.md, this is an active priority | Zero integration at any layer |
| **Canvas → Initiatives via canonical service** | Use `initiativeService.createInitiative` | Hand-rolled insert with wrong column shape |
| **Canvas → Decisions via canonical service** | Use `decisionService.createDecision` with seeded options + escalation + history | Hand-rolled insert with invalid type, no lifecycle |
| **Canvas → Notes via canonical service** | Use `notebookService.createPage` (or its route) with `textToBlocks` projection | Hand-rolled insert with degenerate single-paragraph content_json |
| **Canvas → Ideas Mind Map seeding** | Section nodes from markdown headings | Empty map |
| **Canvas → Project / WorkPacket** | Not surfaced as a target at all | Doesn't exist |
| **Canvas → Calendar (event from Canvas)** | Not surfaced | Doesn't exist |
| **Canvas → Email draft (send to client)** | Not surfaced | Doesn't exist |
| **Canvas → CRM (HubSpot, Notion sync via MCP)** | Not surfaced | Doesn't exist (MCP connectors exist but Canvas doesn't call them) |
| **Outputs hub schema** | A persistent record per export with downloadable artifact, source draft id, version, lifecycle state | No such table exists |

---

## 6. Recommendations — "Make Outputs Sensible"

Ranked S/M/L (effort), each with concrete code-change sketch. Priority: **bottom-up from P0**.

### S — same-day fixes (highest leverage)

#### S-1. Stop writing invalid decision type

`createWorkspaceResource` decision branch (`work-canvas.routes.ts:2187`) — replace direct `insertDynamic` with:

```ts
const { decisionService } = await import('../services/decisionService.js');
const decision = await decisionService.createDecision({
  organizationId,
  projectId: draft.projectId || undefined,
  title,
  description: summary,
  type: 'APPROVAL',
  decisionMakerId: userId,
  createdBy: userId,
  criteria: undefined,
});
return { type: 'decision', id: decision.id, title: decision.title, url: `/my-work/decisions/${decision.id}`, readBack: { ... } };
```

Side-benefit: gets escalation deadline, options, history, notification for free.

#### S-2. Fix back-link URLs

In `createWorkspaceResource` and `createOutputResource`:

- decision → `/my-work/decisions/${id}` (verify `/my-work/decisions/:id` exists; if not, `/my-work/decisions?decisionId=${id}`)
- initiative → `/initiatives?initiativeId=${id}` (matches the My Work pattern)
- report → `/presentations?reportId=${id}` (matches the actual hosting route)
- idea — already correct shape in URL, but the panel's `runWorkspaceAction` rewrites to `/my-work?ideaId=${id}` — unify on the same shape.

In `WorkCanvasDocumentPanel.tsx:1764-1774`, **use `linked.url` directly** instead of re-computing a different path. The backend already returns the URL; the frontend should trust it.

#### S-3. Disable / re-target "Save to Outputs"

Option A: temp disable until EE Deliverables ships. Option B: navigate to `/presentations` with `?source=canvas&draftId=...` so the user lands on the aggregate Outputs tab (`OutputsAggregateTabContent.tsx`).

```ts
window.location.assign(`/presentations?source=canvas&draftId=${encodeURIComponent(draft.draftId)}`);
```

#### S-4. Fix report_type

`work-canvas.routes.ts:2561` — replace `'CANVAS_REPORT'` with `'custom'`, and stash the Canvas hint in `config_json`:

```ts
const config = { canvasOutput: true, canvasReport: true, outputDraftId, sourceDraftId: draft.id };
// ...
'custom', // report_type
```

#### S-5. Cap description length

```ts
const summary = markdownSummary(draft.contentMd, 4900);
```

#### S-6. Validate UUID before TaskService

```ts
const projectId = draft.projectId && /^[0-9a-f-]{36}$/i.test(draft.projectId) ? draft.projectId : null;
```

### M — multi-day fixes

#### M-1. Route notes through the canonical writer

Refactor `createWorkspaceResource` note branch to call `notebookService.createPage` (or whatever the route equivalent is). Concretely:

```ts
const { notebookService } = await import('../services/notebookService.js');
const created = await notebookService.createPage({
  organizationId,
  userId,
  title,
  contentText: draft.contentMd,
  tags: ['work-canvas'],
  source: 'work_canvas',
  metadata: { sourceType: 'work_canvas', sourceId: draft.id },
});
return { type: 'note', id: created.pageId, title: created.title, url: `/my-work/notebook/${created.pageId}`, readBack: {...} };
```

This gets `textToBlocks` projection, embedding storage, FTS indexing for free.

#### M-2. Route initiatives through `initiativeService.createInitiative`

Same pattern as `commitProposalToDomain`:

```ts
const initiative = await initiativeService.createInitiative({
  organization_id: organizationId,
  project_id: draft.projectId || undefined,
  title,
  summary,
  status: 'DRAFT',
  owner_id: userId,
  market_context: `Created from Work Canvas draft ${draft.id}`,
} as any);
```

#### M-3. Fix presentation_decks column mapping

```ts
await insertDynamic('presentation_decks', {
  id: deckId,
  organization_id: organizationId,
  title: `Presentation: ${title}`,
  deck_type: 'custom',
  theme: 'modern',
  slide_count: slides.length,
  status: 'draft',
  generated_by: userId,                       // not created_by
  source_artifacts: JSON.stringify([          // not source_id
    { type: 'work_canvas_draft', id: draft.id, versionId: sourceVersionId || null },
  ]),
  outline_json: JSON.stringify({              // store metadata here, not in non-existent column
    canvasMetadata: metadata,
    slides,
  }),
  created_at: now,
  updated_at: now,
}, ['id']);
```

#### M-4. DOCX/PPTX/PDF — render markdown structure

For DOCX: switch from per-line `Paragraph` mapping to a markdown walker:

```ts
import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfm } from 'micromark-extension-gfm';
import { gfmFromMarkdown } from 'mdast-util-gfm';

function mdastToDocxChildren(tree, docx) {
  const out = [];
  for (const node of tree.children) {
    if (node.type === 'heading') {
      out.push(new docx.Paragraph({
        heading: ['Heading1','Heading2','Heading3','Heading4','Heading5','Heading6'][node.depth-1] || 'Heading6',
        children: [new docx.TextRun({ text: stringifyNode(node) })],
      }));
    } else if (node.type === 'list') {
      for (const item of node.children) {
        out.push(new docx.Paragraph({
          numbering: node.ordered ? { reference: 'numbered', level: 0 } : undefined,
          bullet: node.ordered ? undefined : { level: 0 },
          children: [new docx.TextRun({ text: stringifyNode(item) })],
        }));
      }
    } else if (node.type === 'table') {
      // build docx.Table
    } else {
      out.push(new docx.Paragraph(stringifyNode(node)));
    }
  }
  return out;
}
```

Same idea for PPTX (split into slides at H2, render bullets from lists). For PDF the same renderer drives pdfkit.

This is the **biggest user-perceived quality jump**. Consultants will judge Canvas by what the .docx looks like.

#### M-5. Outputs Library schema + ingestion

Net-new table (per `project_ee_deliverables_module`):

```sql
CREATE TABLE IF NOT EXISTS outputs_library (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  source_module TEXT NOT NULL,        -- 'work_canvas' | 'presentation_studio' | ...
  source_id TEXT NOT NULL,
  source_version_id TEXT,
  output_format TEXT NOT NULL,        -- 'markdown'|'docx'|'xlsx'|'pptx'|'pdf'
  title TEXT NOT NULL,
  artifact_path TEXT,                 -- if persisted to disk/object store
  metadata_json TEXT,
  status TEXT DEFAULT 'ready',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

Canvas `saveToOutputs` would `INSERT INTO outputs_library` instead of (or in addition to) downloading the markdown.

#### M-6. Add `'WORK_CANVAS'` ReportSourceType

`reportBuilderService.ts:21` — add to enum. Update report-builder source-tabs UI. Update Canvas to use it instead of `UPLOAD_BUNDLE`.

#### M-7. Unify save-to-workspace + commitProposalToDomain

Delete `createWorkspaceResource`. Have `/save-to-workspace` build a synthetic proposal record and call `commitProposalToDomain` directly. One writer, one schema, one place to fix bugs.

#### M-8. Seed Ideas Mind Map from Canvas sections

In the idea branch, replace empty maps:

```ts
const sections = markdownSections(draft.contentMd);
const nodes = [
  { id: 'root', label: title, x: 0, y: 0 },
  ...sections.map((s, i) => ({ id: `s${i}`, label: s.heading, x: 220, y: (i - sections.length/2) * 80 })),
];
const edges = sections.map((_, i) => ({ source: 'root', target: `s${i}` }));
await insertDynamic('my_idea_maps', { ..., nodes_json: JSON.stringify(nodes), edges_json: JSON.stringify(edges) });
```

### L — multi-week fixes

#### L-1. Canvas → DocumentStudio proper intake

Add `Api.workCanvasSendToDocumentStudio(draftId)`:
- Backend route `POST /work-canvas/drafts/:draftId/send-to-document-studio` that:
  1. Calls `POST /api/document-studio/plan` with `markdown: draft.contentMd, title: draft.title, source: 'work_canvas', sourceDraftId: draft.id`.
  2. Returns the plan + an "Open in DocumentStudio" URL.
- Front-end: new menu action `'send-to-document-studio'`.

This is the big missing bridge.

#### L-2. Canvas → Table Studio bridge (for `kind='table'` drafts)

Use `MetadataService.createField` per column header in the Canvas table. Use `RecordsService.createRecord` per row. Infer field types from cell content (date regex → `date`, numeric regex → `number`, etc.). Same pattern as `artifactRegistryService.ensureStarterTableData`.

Only enable this for Canvas drafts with `kind='table'` — for narrative Canvas drafts, the table action stays a no-op (or builds a degenerate 2-column "topic/detail" table as today).

#### L-3. EE Deliverables module alignment

See section 7 below.

#### L-4. Markdown image / attachment handling on round-trip

Canvas can include `![alt](data:image/png;base64,...)` or `![alt](/uploads/foo.png)`. On note round-trip these are lost (P0-1) but even on a proper round-trip the image data needs to be persisted into the target module's attachment store. Cross-module attachment portability.

---

## 7. Special Section: EE Deliverables Alignment

Owner's `project_ee_deliverables_module` calls for a unified Document + Table + Presentation Studio + Outputs hub. Canvas as a feeder should deliver:

| EE Deliverables consumer | What Canvas should send | What Canvas actually sends today |
|---|---|---|
| Document Studio | markdown → POST /api/document-studio/plan → editable artifact | nothing (download .docx, manually upload) |
| Table Studio (`tp_tables`) | columns + rows → MetadataService.createField + RecordsService.createRecord | a markdown table inside a sibling work_canvas_drafts row, invisible to Table Studio |
| Presentation Studio | slides → presentation_decks + presentation_cards with proper source attribution | presentation_decks row missing created_by/source_id (P0-6); cards table has no migration |
| Outputs hub | INSERT into outputs_library with source attribution | "Save to Outputs" 404s (P0-3); no outputs_library table |
| Deliverables backlinks (EE module surface) | Each EE deliverable should show "Source: Canvas draft X" with a back-button | back-button URLs are wrong (P0-4, P0-5); provenance partly stored only in the Canvas-side `linkedWorkspaceResources` JSON, not surfaced to consumers |

**Verdict:** Canvas is **not** currently a clean feeder for EE Deliverables at any layer. The data, the URLs, and the contracts all need work.

**Minimum to make Canvas a sensible EE feeder:**

1. (P0-3 fix) Decide on outputs_library shape; have Canvas write to it.
2. (M-3 fix) presentation_decks gets the right columns.
3. (L-1) Add the Canvas → DocumentStudio bridge.
4. (L-2) Add the Canvas → Table Studio bridge for `kind='table'` drafts.
5. (M-4) Render markdown structure in DOCX/PPTX/PDF so the downloads are usable.
6. (S-1, M-1, M-2) Workspace targets (decision/note/initiative) go through canonical services so EE Deliverables sees correctly-shaped rows.

Until those land, the EE Deliverables module will need defensive ingest logic for malformed Canvas data — which is exactly the wrong tradeoff.

---

## 8. Round-Trip Sanity Verdict (per target)

> "Promote canvas → re-open: same content?"

| Target | Round-trip fidelity | Why |
|---|---|---|
| Idea | LOW | Title + body summary stored. Seed_text holds full markdown. Mind Map is empty. The originating draft persists in work_canvas_drafts, so you can still open the Canvas. |
| Note | **DESTROYED** | content_json is a single paragraph holding the entire markdown blob. No headings, lists, tables, images survive (P0-1). |
| Initiative | PARTIAL | summary or description (depending on schema) holds the markdown summary. Full markdown only via back-link to the Canvas draft (if URL works). |
| Decision | PARTIAL | description holds summary. type is wrong (P0-2). No options, no history. |
| Task | GOOD | title + description (capped 5000). No structure beyond plain text, but that's the task model. |
| Report | GOOD | Both the work_canvas_drafts kind='report' AND report_builder_reports rows hold the markdown. Full fidelity. |
| Presentation | PARTIAL | Slides stored as `blocks_json` per card. Markdown structure inside slides is naively split. |
| Table output | PARTIAL | Stored as markdown inside a sibling work_canvas_drafts row, not as typed rows in tp_tables. |
| DOCX/PPTX/PDF/XLSX download | LOW | Markdown structure is lost in the binary (M-4). |
| Markdown / CSV / JSON download | PERFECT | Pure passthrough. |

---

## 9. Honest Summary

The owner's worry — *"downstream tools are broken, so Canvas outputs must at least be sensible"* — is exactly right, and Canvas currently fails that bar on 8 of 13 surfaces.

**The single highest-leverage fix** is **M-1 + S-1 + M-2 + M-7**: route every workspace promote through the canonical service that the proposal-approval flow already uses correctly. That alone takes the materialization quality from "rolls its own broken schema in two places" to "calls the same code the rest of the platform calls." It's an afternoon of work, not a week.

**The single biggest user-perceived quality jump** is **M-4**: render markdown structure into DOCX/PPTX/PDF. Today Canvas's office exports are below ChatGPT Canvas. Once the structure walker is in, they're at parity or better.

**The single biggest cross-module integration debt** is **L-1 (DocumentStudio) + L-2 (Table Studio) + M-5 (Outputs Library) + the EE Deliverables module hookup**. These are the "Canvas as a global environment piece" features the owner cares about. None of them exist today.

Everything else is housekeeping — URL fixes, type enums, description caps — important but bounded.

The good news: the proposal-approval flow already shows that the canonical contracts exist and work. Canvas just needs to stop reinventing them in a parallel, buggier place.
