# Canvas Ecosystem Audit — Outgoing Bridges to Other Tools

Date: 2026-06-04
Branch: feat/wave1-foundations
Scope: code-verified mapping of every "send to / save as / convert to / export" path that originates from a Canvas surface (`UnifiedChatPanel` split-pane `WorkCanvasDocumentPanel`, standalone `/ai/work-canvas` `WorkCanvasShell`, and the TipTap `CanvasRichEditor`) and lands in another module of the platform.

## 1. Executive summary

**Headline integration score: 38 / 100.**

Canvas has TWO independent shells (`WorkCanvasDocumentPanel` rendered inside chat split-view and the standalone `WorkCanvasShell` route) and a NEW TipTap-based `CanvasRichEditor` that is wired into neither shell's outgoing-action machinery. The two shells expose different outgoing action vocabularies that are partially overlapping. Of the 11 target modules a Claude/ChatGPT/Gemini/Antigravity competitor would need, only **3 are end-to-end real** (Ideas, Notebook, Initiatives — via `save-to-workspace`), **1 more is mostly real** (Presentations — Canvas writes `presentation_decks` + `presentation_cards` rows). Everything else is either a stub that writes a *new work_canvas_drafts row of a different kind* and pretends it's a "Table"/"Report" output (Tables, Outputs/Reports), a backend-only path the UI never surfaces (Decisions, Tasks via `WorkCanvas proposals`), a download (Word/Excel via `/export?format=docx|xlsx`), or completely missing (Document Studio, Email, Slack, Knowledge Base). The single biggest gap relative to the stated differentiator is that the floating TipTap editor — the surface the user will spend most time in after the Chat overhaul — has **zero** outgoing actions; everything goes through the legacy markdown-string panel.

## 2. Master matrix

Legend: REAL = end-to-end, lands in the destination module's canonical tables and shows up in that module's UI. PARTIAL = action exists, lands somewhere, but not in the destination module's canonical schema (or routes through a separate copy). STUB = button/handler exists, writes a sentinel row but does NOT actually deliver to the named tool. MISSING = no code path.

| Target tool | Verdict | Mechanism (file:line) | Gap |
|---|---|---|---|
| **Document Studio (Word)** | MISSING | No `documentStudio` reference inside `src/components/AIChat/**`. Canvas does have `Api.workCanvasExportDraft` for a `.docx` download (`src/services/Api.ts:5194`) and `WorkCanvasDocumentPanel.runOutputAction('create-report')` (`WorkCanvasDocumentPanel.tsx:1758`) but `create-output: 'report'` writes a sibling `work_canvas_drafts` row of kind `report`, not a Document Studio document (see `server/src/routes/work-canvas.routes.ts:2388-2504`). | No code path from Canvas to `src/components/DocumentStudio/*` or to a `documents` backend table. |
| **Table / Excele / Table Studio** | STUB | UI: `WorkCanvasDocumentPanel.runOutputAction(actionId,'table')` (`WorkCanvasDocumentPanel.tsx:1758-1782`) → `Api.workCanvasCreateOutput` (`src/services/Api.ts:5138`) → `POST /work-canvas/drafts/:id/create-output` (`server/src/routes/work-canvas.routes.ts:3820`). Backend `createOutputResource` (`work-canvas.routes.ts:2388-2504`) for `'table'` inserts a NEW `work_canvas_drafts` row with `kind='table'` — it never touches the real Table Studio (`tp_tables` / `tablePlatformService`). XLSX download via `workCanvasExportDraft('xlsx')` works (`work-canvas.routes.ts:965`). | Wire `create-output: 'table'` to `tablePlatform.createTable` + `RecordsService.createRecord` so the new entity appears in `/my-work/tabele`. |
| **Presentations / Presentation Studio** | REAL | `WorkCanvasDocumentPanel.runOutputAction(_, 'presentation')` → `createOutputResource(_, 'presentation')` (`work-canvas.routes.ts:2332-2386`) writes real rows to `presentation_decks` + `presentation_cards` with `url: /presentations/builder/:deckId`. The WorkCanvas governed lane (`workCanvasService.saveDraftAsArtifact` + `artifactRegistryService` `outputType==='presentation'` branch in `server/src/services/v8/artifactRegistryService.ts:3003-3039`) ALSO routes to `presentationGeneratorService.generateOutline`. | Two divergent paths to the same outcome; the slide-content quality from `buildPresentationSlides` is basic markdown-section bullets. |
| **Outputs / Reports (Report Builder)** | STUB (in chat shell) / REAL (in WorkCanvasShell governed lane) | Chat-shell button `runOutputAction(_, 'report')` (`WorkCanvasDocumentPanel.tsx:1758`) → `createOutputResource('report')` writes a `work_canvas_drafts` row of `kind='report'`, NOT a Reports row (`work-canvas.routes.ts:2388-2504`). However the standalone `WorkCanvasShell.markSaved` (`WorkCanvas/WorkCanvasShell.tsx:728-748`) → `WorkCanvasApi.saveAsArtifact` → `workCanvasService.saveDraftAsArtifact` → `artifactRegistryService.materializeArtifactRun` outputType `'report'` (`server/src/services/v8/artifactRegistryService.ts:2943-3001`) does call `reportBuilderService.createReport` — a REAL report. Also the `'research_finalize-report'` route (`work-canvas.routes.ts:3885`) STILL uses the stub `createOutputResource('report')`. | Replace `createOutputResource('report')` with `reportBuilderService.createReport` so the in-chat "Create report" button matches the standalone shell. |
| **Ideas (My Work → Ideas)** | REAL | `runWorkspaceAction('send-to-idea', 'idea')` (`WorkCanvasDocumentPanel.tsx:1721-1756`) → `Api.workCanvasSaveToWorkspace` (`Api.ts:5110`) → `POST /work-canvas/drafts/:id/save-to-workspace` → `createWorkspaceResource(_, 'idea')` (`work-canvas.routes.ts:2099-2145`) inserts into `my_ideas` AND `my_idea_maps`, deep-links `/my-work?ideaId=…`. The `WorkCanvas/WorkCanvasShell.proposeConversion('idea')` path (`WorkCanvas/WorkCanvasShell.tsx:750`) also approves to a real idea via `workCanvasService.createCanvasIdea`. | Solid. Idea Map is created empty — no auto-seeded nodes from Canvas content. |
| **Notebook (My Work → Notebook)** | REAL | `runWorkspaceAction(_, 'note')` → `createWorkspaceResource('note')` (`work-canvas.routes.ts:2147-2181`) inserts into `notebook_pages` with `content_json` + `content_text`, deep-links `/my-work?tab=notebook` (not the specific note id). | The redirect lands on the Notebook tab but not on the new note (no `?noteId=` query). Tag is hard-coded `['work-canvas']`. |
| **Initiatives** | REAL | `runWorkspaceAction(_, 'initiative')` → `createWorkspaceResource('initiative')` (`work-canvas.routes.ts:2214-2242`) inserts into `initiatives` with source linkage. WorkCanvasShell proposal path also calls `initiativeService.createInitiative` (`workCanvasService.ts:930-951`). | Both paths bypass each other's field shapes; no unified status mapping. |
| **Decisions** | PARTIAL (backend-only) | The WorkCanvas proposal lane DOES create real decisions (`workCanvasService.ts:952-980` → `decisionService.createDecision`) AND `createWorkspaceResource('decision')` exists (`work-canvas.routes.ts:2183-2212`, real `decisions` insert). BUT the chat-shell UI does NOT expose a `send-to-decision` action — `menuWorkspaceActionIds` in `WorkCanvasDocumentPanel.tsx:293-297` only lists `send-to-idea`, `save-as-note`, `create-initiative`. Only the standalone `/ai/work-canvas` route surfaces a "Decision" target via `WorkCanvas/WorkCanvasShell.tsx:43-51` `TARGETS`. | Add a `send-to-decision` chip in `menuWorkspaceActionIds` so the in-chat Canvas can log decisions. |
| **Tasks** | PARTIAL (backend-only) | The WorkCanvas proposal lane DOES create real tasks (`workCanvasService.ts:897-928` via `TaskService.createTask`). `WorkCanvas/WorkCanvasShell` shows a "Task" target chip and approves to a real task. BUT the chat-shell `WorkCanvasDocumentPanel` UI never exposes a "Create task(s)" action — no `send-to-task` in `menuWorkspaceActionIds`, no "Create checklist of tasks". Teresa has `create_task` + `update_task` tool definitions (`server/src/services/ai/toolDefinitions.ts:449-494`) and a chat slash-command `/task <title>` (`UnifiedChatPanel.tsx:1720-1758`) but neither is wired to canvas selection. | Add a "Create task" / "Create tasks from checklist" chip in WorkCanvasDocumentPanel; ideally selection-aware (highlight checklist → split into N tasks). |
| **Email / Slack / external share** | PARTIAL (internal share link only) | `runShareAction` (`WorkCanvasDocumentPanel.tsx:1813-1834`) → `POST /work-canvas/drafts/:id/share` (`work-canvas.routes.ts:3706-3721`) generates an INTERNAL token only valid inside the app (`/work-canvas/shared/:token`, 7d expiry). No email send, no Slack post, no external link. | No outbound email/Slack/Teams adapters in `work-canvas.routes.ts` (verified — only `share` endpoint exists). |
| **Knowledge Base** | MISSING | `Teresa` has `search_knowledge_base` (`server/src/services/ai/toolDefinitions.ts:57`) but there is no `add_to_knowledge_base` tool and no "Save to KB" button in Canvas. `grep` for `knowledge_base|addToKB` in `src/components/AIChat/` returns nothing relevant. | Wire a `POST /knowledge/entries` write tool and a Canvas action "Promote to KB". |

## 3. Per-target detail

### Document Studio (Word)
There is a full Document Studio module (`src/components/DocumentStudio/DocumentStudioView.tsx`, `DocumentStudioEditorPanel.tsx`, etc.) with its own backend (separate from work_canvas). Canvas has ZERO references to Document Studio APIs — `grep -rn documentStudio src/components/AIChat` is empty. The closest thing is `Api.workCanvasExportDraft(draftId, 'docx')` which streams a one-off DOCX file (`server/src/routes/work-canvas.routes.ts:958-963`). For the consultancy use-case (where a one-page note grows into a multi-section "deliverable doc" that lives in Document Studio with template/branding), this gap is the single most visible difference vs Claude/ChatGPT/Gemini Canvas (which "graduate" drafts into a dedicated long-form doc surface).

### Table / Excele / Table Studio
The user sees a "Create table" button that succeeds with a green toast — but the only thing it does is duplicate the markdown into a *new* `work_canvas_drafts` row whose `kind` field is `'table'`. That row never appears in `/my-work/tabele` (which reads from `tp_tables`/`tablePlatformService`). The XLSX download path is the only thing that actually leaves Canvas with table data. The governed-lane `workCanvasService.saveDraftAsArtifact` for kind `'sheet'` does materialize through `artifactRegistryService` outputType `'sheet'` (which uses `tablePlatform/MetadataService` per `server/src/services/v8/artifactRegistryService.ts:2634-2640, 3057-3067`), but that path is only triggered by the "Save as artifact" pill in `WorkCanvasShell`, not by the chat-shell "Create table" button.

### Presentations / Presentation Studio
This is the bridge that actually works end-to-end from the chat shell. `createOutputResource('presentation')` (`work-canvas.routes.ts:2332-2386`) writes `presentation_decks` (with theme `'modern'`, `deck_type='custom'`, `source_id=draft.id`) and an N-card `presentation_cards` set built from markdown sections via `buildPresentationSlides` (`work-canvas.routes.ts:2291-2320`). The deck URL `/presentations/builder/:deckId` opens the real Presentation Studio. The deck is intentionally minimal (title slide + content slides + next-steps slide); no theme inference, no image/chart generation, no asset attachment.

### Outputs / Reports
The chat-shell `Create report` button is misleading: `createOutputResource('report')` (`work-canvas.routes.ts:2388-2504`) creates a *work_canvas_drafts* row of kind `'report'` with hand-built markdown ("Executive Summary / Context / Key Points / Next Steps"), URL `/work-canvas?draftId=…`. It does NOT land in the Reports module. The governed `saveAsArtifact` path in `WorkCanvasShell` DOES land in Reports via `reportBuilderService.createReport` (`artifactRegistryService.ts:2943-3001`). So the same nominal action has two completely different code paths and outcomes depending on which Canvas shell you use.

### Ideas
This is the most thoroughly wired bridge. `createWorkspaceResource('idea')` inserts both an `my_ideas` row AND a paired `my_idea_maps` row (with `schema_version=3` and `extensions_json` carrying source provenance). Deep link `/my-work?ideaId=…` opens the new idea. The map is created empty (no nodes parsed from Canvas markdown headings); that would be a high-value enhancement.

### Notebook
Real insert into `notebook_pages` with both `content_json` (a fake TipTap-style doc with one paragraph) and the raw markdown in `content_text`. Capture source recorded as `'work_canvas'`. The redirect goes to the Notebook tab not the specific page (no `?pageId=`).

### Initiatives
Two divergent code paths both insert real rows:
- chat-shell: `createWorkspaceResource('initiative')` (raw `INSERT INTO initiatives`)
- standalone: `initiativeService.createInitiative` (via the service)
They populate different field shapes (`name`+`title`+`summary` vs the service's structured DTO). Pick one.

### Decisions
The backend has BOTH a chat-shell-callable `createWorkspaceResource('decision')` AND a proposal-lane `decisionService.createDecision`. The chat-shell UI never offers `'decision'` as a workspace target; only `WorkCanvas/WorkCanvasShell` surfaces it. Adding `'send-to-decision'` to `menuWorkspaceActionIds` (`WorkCanvasDocumentPanel.tsx:293`) plus a `workspaceTargets['send-to-decision']='decision'` entry would unlock this with no backend work.

### Tasks
Real backend tool exists (`workCanvasService.commitProposalToDomain` 'task' branch calls `TaskService.createTask`). The standalone WorkCanvasShell offers "Task" as a target chip. Chat-shell `WorkCanvasDocumentPanel` does not. The chat composer has a `/task` slash command but it operates on the message, not on selected Canvas text. There is currently NO way to highlight a checklist in Canvas and create N tasks.

### Email / Slack / external share
`POST /work-canvas/drafts/:id/share` mints a 7-day token at `/work-canvas/shared/:token` (verified, in-app only). No Gmail/Outlook/Slack/Teams adapter is referenced from `work-canvas.routes.ts`.

### Knowledge Base
Teresa has `search_knowledge_base` but no write-side tool. No KB action exists on Canvas. For the "world-class consultancy AI" pitch this is a meaningful miss — a great deliverable should auto-promote to org KB for retrieval.

## 4. Reverse flow brief

There is essentially NO reverse flow. The only entry points into Canvas are:
- `/ai/work-canvas?draftId=…` (route in `routeConfig.ts:230`) — used by `WorkCanvas/WorkCanvasShell` self-redirects and `WorkCanvasRedirect` route.
- `MessageRenderer.tsx:652` does a hard `window.location.href = '/ai/work-canvas'` from a chat message link.

There is NO "Open in Canvas" button from:
- Notebook pages (`src/pages/Notebook*` / `src/components/MyWork/Notes*`)
- Tasks list (`src/components/Tasks/*`)
- Decisions (`src/pages/Decisions*`)
- Initiatives (`src/pages/Initiatives*`)
- Reports/Outputs (`src/components/Outputs*`)
- Document Studio (`src/components/DocumentStudio/*`)

So Canvas is currently a one-way OUTBOUND surface: drafts flow OUT to other modules but other modules cannot "edit-in-canvas" their content. For the Notebook-meets-Canvas value prop this is the biggest reverse-flow miss.

## 5. Top 10 prioritized bridges to build

Ranked by impact (consulting use case) vs effort. Each row points at the file that needs the new wiring.

| # | Bridge | Impact | Effort | Files |
|---|---|---|---|---|
| 1 | **"Create task(s)" from Canvas selection** — split checklist/bullet list into N real tasks via `TaskService.createTask` | Very High (consultants ship work as task lists) | Low (backend exists in `workCanvasService.commitProposalToDomain 'task' branch`; just add UI chip + selection-aware payload) | UI: `src/components/AIChat/WorkCanvasDocumentPanel.tsx:293,323`; backend: reuse `server/src/services/workCanvasService.ts:897` |
| 2 | **"Send to Decision" chip in chat-shell Canvas** — surface the existing backend path | Very High (decisions are core consultancy artifact) | Trivial (1-line UI addition; backend ready) | `src/components/AIChat/WorkCanvasDocumentPanel.tsx:293,323`; backend already present at `server/src/routes/work-canvas.routes.ts:2183` |
| 3 | **Real "Create table" → Table Studio** — replace stub with `tablePlatform.createTable` + `RecordsService.createRecord` parsing Canvas markdown table rows | High (Excel rivalry is the user's stated differentiator) | Med (need markdown-table → schema mapping) | `server/src/routes/work-canvas.routes.ts:2388-2504` (`createOutputResource` table branch); use `server/src/services/tablePlatform/MetadataService.ts:466` |
| 4 | **Real "Create report" → Reports module** — chat-shell button currently writes a sibling canvas draft; route it through `reportBuilderService.createReport` like the governed lane already does | High (reports are the deliverable hub) | Low (copy the call from `artifactRegistryService.ts:2944-2956`) | `server/src/routes/work-canvas.routes.ts:2388-2504` report branch |
| 5 | **"Open in Canvas" reverse flow from Notebook + Tasks + Decisions** | High (closes the loop: edit existing artifacts with the streaming AI editor) | Med (need draft seeding from arbitrary entity + reverse-link recording) | New endpoint `POST /work-canvas/drafts/from-entity`; UI add buttons in `src/components/MyWork/Notes*`, `src/components/Tasks/*`, `src/pages/Decisions*` |
| 6 | **Real "Send to Document Studio" (Word)** — new bridge to the existing DocumentStudio backend; deep-link `/documents/:id` | High (matches Claude Canvas → long-form-doc graduation) | Med-High (need to call DocumentStudio's create API + transfer markdown/blocks) | UI: add `create-document` action to `menuOutputActionIds` (`WorkCanvasDocumentPanel.tsx:299`); backend: new route + adapter to `src/components/DocumentStudio/api.ts` server |
| 7 | **Outgoing actions on the TipTap CanvasRichEditor** — the new floating editor (`CanvasRichEditor.tsx`, `CanvasAIFloatingMenu.tsx`) has zero "send to" hooks; selection menu only does expand/shorten/rewrite/translate | High (this is the UI the chat overhaul puts in front of users post-GA) | Med (port the workspace/output action map from `WorkCanvasDocumentPanel.runWorkspaceAction`/`runOutputAction`) | `src/components/AIChat/CanvasEditor/CanvasAIFloatingMenu.tsx`; reuse `Api.workCanvasSaveToWorkspace` |
| 8 | **Save Canvas to Knowledge Base** — new write tool + UI chip | Med-High (closes loop with `search_knowledge_base` retrieval) | Med (need KB write endpoint; one doesn't exist yet) | New `server/src/routes/knowledge.routes.ts` write endpoint; UI: add `add-to-kb` action |
| 9 | **Email/Slack share-out** — extend the share endpoint to optionally email a PDF export or post a Slack/Teams card | Med (extends external share beyond internal token) | Med (Gmail + Slack adapters already exist for other features; need a Canvas wrapper) | `server/src/routes/work-canvas.routes.ts:3706` + adapters in `server/src/services/integrations/*` |
| 10 | **Auto-seed Idea Map from Canvas headings** — when `save-to-workspace: idea` runs, parse markdown H2/H3 into idea-map nodes instead of leaving the map empty | Med (idea-map is the differentiator inside Ideas; empty maps disappoint) | Low (helper next to `createWorkspaceResource('idea')`) | `server/src/routes/work-canvas.routes.ts:2120-2136` |

## Appendix — Canvas surfaces (file map)

- Standalone shell + bottom chip bar: `src/components/AIChat/WorkCanvas/WorkCanvasShell.tsx` (1216 LOC) — has `TARGETS = ['idea','initiative','task','project_brief','decision','research_report','client_deliverable']` and a "Save artifact" button (`markSaved`).
- Chat split-pane shell: `src/components/AIChat/WorkCanvasDocumentPanel.tsx` (3548 LOC) — has `menuWorkspaceActionIds = ['send-to-idea','save-as-note','create-initiative']` and `menuOutputActionIds = ['create-presentation','create-table','create-report']`. Plus a `share` button (internal token), `copy`, `save`, and inline `createArtifactBlockFromSelection` for table/chart/diagram/research/decision blocks (INLINE only — these become embedded blocks inside the canvas markdown, NOT separate module entities).
- TipTap editor: `src/components/AIChat/CanvasEditor/CanvasRichEditor.tsx` + `CanvasEditorToolbar.tsx` + `CanvasAIFloatingMenu.tsx` — formatting-only toolbar; floating menu has Expand/Shorten/Rewrite/Translate→EN/Translate→PL and a custom-prompt input. ZERO outgoing-tool actions.
- Backend service: `server/src/services/workCanvasService.ts` (1142 LOC) — proposal/approve lane with real domain writes for `task`, `initiative`, `decision`, `idea`; artifact materialization for `project_brief`/`client_deliverable`/`research_report`/`kpi_roi_artifact`; `'note'` returns `'unsupported'` (`CANVAS_NOTE_COMMIT_UNSUPPORTED`).
- Backend routes: `server/src/routes/work-canvas.routes.ts` (4060 LOC) — `save-to-workspace`, `create-output`, `research/finalize-report`, `save-as-artifact`, `share`, `export`, plus 8 workflow endpoints. Tools NOT reachable: email send, Slack post, knowledge-base write.
