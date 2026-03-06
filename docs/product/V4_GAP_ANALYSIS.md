# V4 Gap Analysis — Workbook (Benchmark → As‑is → V4 Target → Gaps → Epics)

> **Status:** Working document (V4 planning)  
> **Owner:** Product + Engineering  
> **Scope:** Full platform (core flow + enterprise layer)  
> **Method:** Compare enterprise leaders (benchmark) vs Consultify **as‑is** (code) vs **V4 target**, then derive **gaps** and **epics**.

---

## 0) Canonical references (SSOT to anchor decisions)

**Implementation program (SSOT dla wdrożenia):**
- `docs/product/V4_IMPLEMENTATION_PROGRAM.md` — task ledger (120 tasków), statusy, dashboard, zależności, PR checklist

Business truth / product positioning:
- `docs/product/BUSINESS_POSITIONING_SSOT.md`

System axis & artefacts:
- `docs/product/SYSTEM_ARCHITECTURE_BRIEF.md`
- `docs/product/SOURCE_TRACEABILITY_SPEC.md`

Verification rubric (OK/GAP/OPEN/RISK):
- `docs/product/V3_MODULE_VERIFICATION_MATRIX.md`

V3 requirements index (for “unfinished v3” gaps):
- `docs/product/REQUIREMENTS_V3_SSOT.md`
- `docs/product/V3_IMPLEMENTATION_PROGRAM.md`

UI/UX canon (must‑have consistency):
- `docs/ui-standards/README.md`
- `docs/ui-standards/UI_UX_CANON_V3.md`

---

## 1) How to use this workbook (canonical)

For each module:
- **Benchmark**: what “global enterprise leaders” provide (capabilities + UX patterns + integrations).
- **As‑is (code)**: what is implemented today (routes/controllers/services + UI components).
- **V4 target**: the desired enterprise-level end state (capabilities + Definition of Done).
- **Gaps**: missing or incomplete capabilities, SSOT inconsistencies, UX noncompliance, missing integrations, AI under‑enablement.
- **Gap coverage proposal**: epics (backend/UI/integrations/AI), dependencies, risks, and success metrics.

Statuses:
- **OK**: enterprise-ready (or intentionally accepted as “good enough” with rationale).
- **GAP**: missing or incomplete.
- **OPEN DECISION**: needs explicit product decision (tradeoffs/options).
- **GO‑LIVE RISK**: must fix before enterprise rollouts (security, data loss, compliance, core UX break).

V4 priority:
- **P0**: enterprise baseline / blocker.
- **P1**: strong differentiator or needed for enterprise scale.
- **P2**: polish / advanced.

---

## 2) Global non‑negotiables (apply to every module)

### 2.1 System axis & traceability (MUST)

Source rules (from `SYSTEM_ARCHITECTURE_BRIEF.md`):
- **Initiative** is the central object (one initiative = one lifecycle).
- Only two canonical sources create initiatives: **ToolSession** (Tools) and **Assessment Report** (Assessments).
- MyWork (Idea/Notebook) can seed work, but if it produces governance outputs it must materialize `MYWORK ToolSession` for traceability.

Checklist:
- [ ] Every output artefact (initiative/report/deck) has `source_type` + `source_id` to a canonical source (ToolSession/AssessmentReport, or MYWORK ToolSession).
- [ ] “Supporting artefacts” (Notebook/Workspace/Report/Deck) never silently become initiative sources.
- [ ] Backlinks (“Used in”) exist where UX claims they exist (LinkGraph contract).

### 2.2 UI/UX compliance (MUST)

Checklist:
- [ ] i18n PL+EN for user-facing strings.
- [ ] Locked/read-only behavior is consistent (no hidden edits).
- [ ] Module topbar order: **AI context → +New → View modes → Filters**.
- [ ] App Table Standard + Preview Pane Standard where applicable.
- [ ] Workspace “3-tools strip” for workspace-like surfaces (Tools / Context‑Links / AI Suggestions).

### 2.3 AI contract (MUST)

Checklist:
- [ ] AI never writes silently: **propose → accept/reject** for edits.
- [ ] Model/prompt governance exists (registry, versioning, cost controls) where relevant.
- [ ] AI actions are auditable (who/when/why; inputs/outputs; ability to reproduce).

### 2.4 Share / export / deliverables (MUST where present)

Checklist:
- [ ] Public share links consistent (expiry, password, watermark/read-only).
- [ ] Export quality gates exist (PDF/PPTX) and are predictable across browsers/OS.
- [ ] “Online artifact is primary; exports are renders” is either true in code or clearly labeled as target.

### 2.5 Enterprise readiness baseline (MUST for V4)

Checklist (cross-module):
- [ ] RBAC & capabilities enforced server-side (effective roles).
- [ ] Audit logs (security + business events).
- [ ] Multi-tenancy correctness (org boundaries; data residency policy).
- [ ] Observability (logs/metrics/traces) + DR/backup.
- [ ] Realtime collaboration baseline where “workspace” exists (presence → CRDT roadmap).

---

## 3) Module analysis template (copy/paste per module)

Use this block as a **canonical skeleton** (do not keep placeholder headings in the final doc).

```md
### <module-number> <Module name>

**Module snapshot**
- **As‑is**: <what exists in code today, 1–2 sentences>
- **V4 target**: <enterprise to‑be, 1–2 sentences>
- **Top gaps**: <3–7 bullets>
- **P0 epics**: <comma-separated epic ids>

**Benchmark leaders (input list):**
- …

**SSOT anchors:**
- …

**As‑is anchors (code reality):**
- Frontend: …
- Backend: …

| Area (5) | Benchmark (leaders) | As‑is (Consultify code) | V4 target (enterprise) | Gap | Proposal (epics) | Status | V4 Priority |
|---|---|---|---|---|---|---|---|
| 1) Capabilities |  |  |  |  |  |  |  |
| 2) Integrations |  |  |  |  |  |  |  |
| 3) AI enablement |  |  |  |  |  |  |  |
| 4) UI/UX quality |  |  |  |  |  |  |  |
| 5) Enterprise readiness |  |  |  |  |  |  |  |
```

---

## 4) Module index (by phase) — V4 audit map

### Phase A — MyWork (personal hub)
1. Ideas / Idea Workspace (mindmap / whiteboard / process flow / table)
2. Notebook + Knowledge
3. Tasks + Decisions
4. Inbox + Focus + Executive

### Phase B — Research/Diagnostics
5. Interview + Research/Diagnostics

### Phase C — Consulting Tools / Templates
6. Consulting Tools catalog + ToolSessions + templates + knowledge/RAG

### Phase D — Assessments
7. Assessments (SIRI/ADMA/DRD/VDA/ISO…)

### Phase E — Initiatives → Execution → Results/Economics
8. Initiatives (governance layer)
9. Execution / Implementation (project delivery)
10. Results / Benefits (KPI/ROI)
11. Financial Analysis

### Phase F — Deliverables
12. Reports
13. Presentations (Decks)

### Phase G — Enterprise platform (cross‑cutting)
14. Identity & access (SSO/SCIM/RBAC), audit logs, admin/superadmin
15. Security & compliance, data residency, retention/legal hold
16. Observability, DR/backup, performance budgets
17. AI governance (model registry, evals, cost controls)
18. Realtime collaboration baseline (presence → CRDT) for workspace surfaces
19. Organization intelligence (Benchmarking + Knowledge Graph)
20. AI Advisor (enterprise layer over modules)

---

## 5) Phase A — MyWork

### 5.1 Ideas / Idea Workspace (mindmap + whiteboard + process flow + table)

**Module snapshot**
- **As‑is**: Full-screen Idea Workspace with multiple tools (mindmap/whiteboard/process flow/table) sharing one persisted graph; AI generators exist with propose→accept patterns in parts of the UI.
- **V4 target**: Enterprise-grade “idea → execution” workspace: canonical graph, deterministic conversions to Tasks/Decisions/Initiatives with traceability, and collaboration (presence→CRDT) + audit.
- **Top gaps**:
  - Realtime collaboration end-to-end (presence, shared session state, CRDT) across all canvas tools.
  - Audit + reproducibility for user edits and AI-applied changes (with replay and retention alignment).
  - Node-level outcomes + traceability (clusters/outcomes → decisions/tasks/initiatives), not only “idea-level convert”.
  - Import/export interoperability (PDF, richer structured exports; BPMN/Visio/draw.io parity for diagrams).
  - Keyboard/A11y completion and strict UI standards compliance across tools.
- **P0 epics**: EPIC‑ENT‑RT‑01, EPIC‑IDEAS‑01, EPIC‑LINK‑01, EPIC‑AI‑IDEAS‑01, EPIC‑ENT‑AUDIT‑01

**Benchmark leaders (from your list):**
- Mind maps: MindMeister, Whimsical, XMind, Ayoa, SimpleMind
- Whiteboards: Miro, Mural, FigJam, Stormboard
- Process & system diagrams: Lucidchart, Microsoft Visio, Creately, Draw.io (diagrams.net)
- Structured thinking / tables: Airtable, Coda, Notion databases, Fibery, Smartsheet

**SSOT anchors:**
- `docs/product/IDEA_WORKSPACE_V3_SSOT.md`
- `docs/MYWORK_MODULE_SPECIFICATION.md` (Ideas section)
- UI: `docs/ui-standards/UI_UX_CANON_V3.md` (workspace selector + 3-tools strip rules)

**As‑is anchors (code):**
- Frontend: `src/components/MyWork/IdeaMapWorkspace.tsx`, `src/components/MyWork/IdeaCanvasToolSelector.tsx`, `src/components/MyWork/IdeaProcessFlowTool.tsx`, `src/components/MyWork/IdeaWhiteboardTool.tsx`, `src/components/MyWork/IdeaTableTool.tsx`
- Backend: `server/src/routes/my-work.routes.ts`, `server/src/services/ideaAIGeneratorService.ts`

| Area (5) | Benchmark (leaders) | As‑is (Consultify code) | V4 target (enterprise) | Gap | Proposal (epics) | Status | V4 Priority |
|---|---|---|---|---|---|---|---|
| 1) Capabilities | Keyboard-first mind map editing, multiple layouts (tree/radial/org/timeline), deep export (tasks/docs), workshop-grade whiteboard (sticky clustering, voting), diagram standards (BPMN shapes/import), table as “work OS” (views/relations/automations). | Single-idea full-screen workspace with multi-tool canvas; shared graph saved as nodes/edges/extensions; tool switch; AI propose→accept patches; process flow + table + whiteboard implementations exist. | One canonical `IdeaWorkspaceGraph` schema (node kinds + artifact refs) with no data loss across tools; keyboard-first interactions; robust export/import; conversion to Tasks/Decisions/Initiatives with traceability; offline resilience. | Real-time collaboration not enterprise-ready; import/export formats limited; formal BPMN/Visio parity missing; deeper “database-like” table features missing; keyboard coverage likely incomplete; audit trail for AI changes missing. | EPIC‑IDEAS‑01: Formalize graph schema + migrations + validators. EPIC‑IDEAS‑02: Realtime collab baseline (presence→CRDT). EPIC‑IDEAS‑03: Export/import (SVG/PDF/PNG + Visio-like). EPIC‑IDEAS‑04: Keyboard-first UX + accessibility. EPIC‑IDEAS‑05: AI audit log + reproducibility. | GAP | P0 |
| 2) Integrations | Seamless conversion to tasks/projects, embedding into docs/reports, backlinks “used in”, cross-workspace linking. | Convert flows exist (Idea→Initiative etc.) and LinkGraph backlinks are used in Idea context panel (per previous analysis). | One platform-wide LinkGraph contract used consistently across Ideas/Notebook/Tools/Initiatives/Reports/Decks; “Open in module” deep-links; source traceability non-negotiable. | Inconsistent parity of embedded previews/backlinks across artefacts; conversion targets may not unify to platform outputs; cross-module “Used in” surfaces likely uneven. | EPIC‑LINK‑01: Standardize embedded refs + backlinks surfaces across modules. EPIC‑CONVERT‑01: Universal convert targets & traceability policy enforcement. | GAP | P0 |
| 3) AI enablement | Smart clustering, branch expansion, diagram completion, table view generators, assisted synthesis into decisions/tasks; AI collaboration insights. | AI generator endpoint for Ideas; propose→accept is implemented in UI; per-tool generators exist conceptually in SSOT. | AI is a co-thinker with strict governance: proposal batches, partial accept, rationale/confidence, audit log, cost controls, evaluation harness. | Missing “AI change audit trail”; missing systematic evals; anti-spam policy enforcement; AI outputs not consistently insertable as graph-native notes. | EPIC‑AI‑IDEAS‑01: AI proposal audit log + replay. EPIC‑AI‑IDEAS‑02: Generator suite parity (lanes/columns/views/enrichment) + schemas. EPIC‑AI‑GOV‑01: model/prompt registry + cost controls + evals. | GAP | P0 |
| 4) UI/UX quality | Ultra-low friction creation, “quiet luxury” canvas, facilitation tools, consistent tool selector placement, robust snapping/alignment, accessibility. | Workspace tool selector exists; 3-tools strip concept exists; current placement and UX compliance to SSOT needs verification (historically noted mismatch). | SSOT compliance: tool selector top-right; 3-tools strip; consistent preview patterns; A11y keyboard; density controls where relevant. | Potential SSOT mismatch (selector placement); polish gaps for snapping/alignment; inconsistent UX patterns across tools. | EPIC‑UX‑IDEAS‑01: Align Ideas workspace with UI standards (selector/strip/preview). EPIC‑UX‑IDEAS‑02: Whiteboard interaction polish (snapping, alignment, lasso). | OPEN DECISION | P1 |
| 5) Enterprise readiness | Multi-user realtime, permissioned sharing, auditability, data retention, export compliance. | No v3 realtime (explicitly out-of-scope in v3 program); permissions/locked state exist as patterns but need consistent enforcement. | Enterprise-grade collaboration, audit logs, retention policies; RBAC enforced for edit/conversion actions; secure public share. | Realtime missing; audit events incomplete; policy layer (retention/legal hold) missing. | EPIC‑ENT‑RT‑01: Realtime collab platform (shared across workspaces). EPIC‑ENT‑AUDIT‑01: Audit logging framework. EPIC‑ENT‑POLICY‑01: retention/residency/legal hold policy engine. | GAP | P0 |

**Tasks do wdrożenia**
- [ ] Zdefiniować canonical `IdeaWorkspaceGraph` schema (node kinds, artifact refs, extensions) + migracje DB
- [ ] Wdrożyć WebSocket `/ws/collab/:ideaId` dla presence, cursors, shared session state (EPIC‑ENT‑RT‑01)
- [ ] Zintegrować CRDT (Yjs/ Automerge) dla mindmap/whiteboard/process flow — bez utraty danych przy równoczesnej edycji
- [ ] Dodać audit log dla edycji użytkownika i AI (actor, przed/po, reason, timestamp) + replay API
- [ ] Wdrożyć model cluster/outcome na poziomie node/sticky + deterministyczną konwersję do Tasks/Decisions/Initiatives z LinkGraph backlinks
- [ ] Rozszerzyć export mindmap o PDF + outline/markdown; whiteboard o PDF/PNG z watermarkingiem
- [ ] Uzupełnić keyboard shortcuts (reparent, multi-select, bulk ops) + focus model + screen-reader semantics (a11y DoD)
- [ ] Wdrożyć AI proposal audit — każda sugestia AI zapisywana jako proposal z diff; apply rejestrowane w audicie
- [ ] Ujednolicić LinkGraph contract w UI (embed chips, "Used in" surfaces) we wszystkich modułach

**Plan pokrycia gapu**
- **Realtime collaboration**: Platforma WebSocket + CRDT dla wszystkich canvasów (mindmap, whiteboard, process flow, table). Presence overlay już istnieje jako stub — trzeba dokończyć serwerową warstwę `/ws/collab/:ideaId`, integrację z Yjs/Automerge i sesję współdzieloną (w tym voting/timer z prawdziwymi identyfikatorami użytkowników).
- **Audit + reproducibility**: Framework zdarzeń audytowych (actor, eventType, payload, przed/po) zapisywany w immutable stream; integracja z retention/policy engine. Każda zmiana AI (propose/apply) musi generować zdarzenie z diffem i powiązaniem do runId.
- **Node-level outcomes + traceability**: Wprowadzić obiekty `Cluster` i `Outcome` jako first-class, z mapowaniem nodeId→clusterId→outcomeId. Konwersja do Tasks/Decisions/Initiatives z zapisem backlinków na poziomie node (nie tylko idea). UI "Used in" musi pokazywać źródłowy node/sticky.
- **Import/export**: PDF export dla mindmap (render canvas → PDF); outline/markdown export (drzewo → markdown). Import XMind/OPML z zachowaniem hierarchii i metadanych. Dla diagramów: BPMN XML, draw.io XML, round-trip gdzie możliwe.
- **Keyboard/A11y**: Pełny DoD skrótów (reparent, multi-select, fold/unfold, command palette), roving focus, ARIA labels, testy regresji dla a11y.

#### 5.1.1 Mind Maps (deep dive — benchmark verification)

**Scope (this deep dive):** mind map editing model + “idea → execution” conversion + export/import + collaboration/audit. (Whiteboard / table / process flow have separate competitive baselines.)

**Benchmark notes (what to learn, aligned with your prompt):**
- **MindMeister**: fast expansion from 1 node into many hypotheses; low-friction branching; collaboration + comments; export/conversion into tasks/docs (bridge from ideation → action).
- **Whimsical**: “no-barrier” UX (speed, minimal chrome); keyboard-first flow; users think visually immediately (ideal substrate for AI to analyze structure).
- **XMind**: multiple map structures (tree / logic chart / org / timeline) and “reasoning-model” building; strong layouting + theming + presentation/export.
- **Ayoa**: tight coupling mind maps ↔ tasks/projects (execution hand-off); transformation of a map into an actionable plan.
- **SimpleMind**: single-leader personal thinking model (often before team/project); offline/low-latency editing; personal workflows.

**As‑is verification anchors (code reality, not just SSOT):**
- **Mind map canvas**: `src/components/MyWork/IdeaRecommendationMap.tsx` (ReactFlow-based) — inline edit, collapse/expand, drill-down/submap, undo/redo, keyboard shortcuts (Tab/Enter/F2/Delete/Arrows + Cmd/Ctrl+Z), edge labels, multiple layout modes (tree/radial/force), node detail drawer, AI “expand branch” propose/apply modal.
- **Export**: `src/components/MyWork/mindmap/useMapExport.ts` (PNG/SVG/JSON); plus `src/components/MyWork/mindmap/ExportPowerPoint.tsx` (PPTX).
- **Import**: `src/components/MyWork/mindmap/ImportExternalMap.tsx` supports FreeMind `.mm` + XMind `.xmind`.
- **Collaboration**: `src/components/MyWork/mindmap/CollaborationOverlay.tsx` is a presence/multi-cursor **stub** expecting `/ws/collab/:ideaId` (no server implementation found).
- **Versioning**: `src/components/MyWork/mindmap/SnapshotHistory.tsx` is localStorage-only; there is a DB migration for server-side versions: `server/migrations/622_my_idea_map_versions.sql` (no read-path/UI integration yet).
- **Backend map API**: `server/src/routes/my-work.routes.ts` implements `GET/PUT /api/my-work/my-ideas/:id/map`, `POST /:id/map/expand`, plus `POST /:id/map/ai-suggestions` and `POST /:id/map/gap-analysis`.

| Slice (mind maps) | Benchmark (leaders) | As‑is (Consultify code) | V4 target (enterprise) | Gap | Proposal (epics) | Status | V4 Priority |
|---|---|---|---|---|---|---|---|
| 1) Frictionless “start → expand” | Whimsical/MindMeister: near-zero friction to create first branches; smooth expansion; minimal UI chrome; “flow” maintained. | Default “consulting frame” map is generated (root + branches) and supports Tab=child + Enter=sibling in `IdeaRecommendationMap.tsx`; context menu exists; inline edit is double-click. | 2 modes: **(a)** structured consulting frame (Problem/Goal/Options/Evidence/Risks/Experiments) **and** **(b)** free-form mind map; both share canonical graph. Onboarding shows shortcuts and actions. | Current UX still has “app-like chrome” (toolbars/modals/prompts); creation is good but not “Whimsical-fast”; free-form mode not explicit. | **EPIC‑IDEAS‑MM‑01**: Mind map interaction contract + onboarding (structured vs free-form). **EPIC‑UX‑IDEAS‑03**: Reduce friction (inline add, quick commands, fewer modals/prompts). | GAP | P0 |
| 2) Keyboard-first editing model | MindMeister/XMind: deep keyboard coverage (add, reparent, fold, navigate, search, style), consistent focus behavior, shortcut discoverability. | Tab/Enter/F2/Delete/Arrows + undo/redo in `IdeaRecommendationMap.tsx`; Cmd/Ctrl+F search exists at workspace level in `IdeaMapWorkspace.tsx`; shortcuts hint is rendered. | Full keyboard DoD + a11y: roving focus, screen-reader semantics, shortcut help modal, configurable shortcuts, “command palette” actions for mind map. | Keyboard coverage is partial (no clear reparent shortcut, multi-select actions, bulk operations); focus management and a11y not proven. | **EPIC‑IDEAS‑MM‑02**: Keyboard/A11y completion for mind map (DoD + tests). **EPIC‑IDEAS‑MM‑03**: Command palette + action registry for mind map. | GAP | P0 |
| 3) Structure transformations (reparent, fold, tidy) | XMind: fast reparent/drag, fold/unfold at scale, “tidy up” with minimal layout disruption; stable layouts. | Collapse/expand is implemented; auto-layout exists (tree) + radial/force toggles; drill-down/submap exists; reparent is possible via connect edges but not “mindmap-native reparent UX”. | Mindmap-native restructure: reparent, move subtree, fold/unfold subtree, “tidy selection”, stable layout with minimal diff; preserve manual positions. | Layout is mostly “algorithmic”; no explicit “tidy selection vs whole”; reparent UX unclear; no “layout stability” guarantees. | **EPIC‑IDEAS‑MM‑04**: Layout engine v2 (stable tidy + subtree ops + minimal diff). **EPIC‑IDEAS‑MM‑05**: Reparent UX + subtree operations. | GAP | P0 |
| 4) Multiple map structures (tree/logic/org/timeline) | XMind: switch structures to match problem type; timeline/org views turn reasoning into plan/org. | Layout modes today are tree/radial/force + a separate Timeline modal view; branches are “frame-based” around a center by default. | Add view-layer “render modes” (tree / radial / logic chart / org / timeline) with shared graph; template-driven “frames” (consulting) as optional. | Missing “logic chart/org chart” semantics; timeline is view-only, not a full structure mode. | **EPIC‑IDEAS‑MM‑06**: View-layer render modes + template-driven frames. | GAP | P1 |
| 5) Notes + metadata per node (reasoning context) | MindMeister/XMind: per-node notes, links, attachments, icons/tags; enables “reasoning graph” not just labels. | Node detail exists (`NodeDetailDrawer` and `IdeaNodeDetailDrawer`) but persistence appears partial; comments/activity are currently in-memory; some actions use `window.prompt`. | Canonical per-node schema: label + notes + tags + attachments + status + assignee + audit; persisted server-side; searchable; permission-aware. | Metadata persistence/consistency not guaranteed; collaboration artifacts (comments/activity) not persisted; prompts are not enterprise UI. | **EPIC‑IDEAS‑MM‑07**: Node metadata contract + persistence + search. **EPIC‑IDEAS‑MM‑08**: Replace prompts with proper UI + validations. | GAP | P0 |
| 6) Export/import parity | XMind/MindMeister: high-quality export (PNG/PDF/SVG), structured export (outline/markdown), import formats (XMind/OPML/etc). | PNG/SVG/JSON export exists; PPTX export exists; import supports `.mm` + `.xmind`. | Enterprise export package: PNG/SVG/PDF + markdown/outline + “execution export”; import: XMind + OPML + robust mapping (notes/tags if possible). | No PDF export; markdown/outline export for mindmap not explicit; import flattens to labels and loses rich metadata. | **EPIC‑IDEAS‑MM‑09**: Export suite (PDF + outline/markdown + packaging). **EPIC‑IDEAS‑MM‑10**: Import mapping improvements (preserve hierarchy + notes where possible). | GAP | P1 |
| 7) “Idea → execution” conversion | Ayoa: map transforms into tasks/projects with structure, owners, dependencies; MindMeister exports to tasks/docs. | Convert exists at idea level in `IdeaMapWorkspace.tsx` (`convert_initiative`, `convert_decision`), and there’s batch convert modal inside mindmap; node statuses exist. | Deterministic conversion pipeline: subtree → task set / initiative outline; mapping rules per nodeType/status; preview diff; LinkGraph backlinks to source nodes; governance checks. | Node-to-task mapping is not defined as a contract; traceability at node granularity likely missing; dependency edges not mapped to task dependencies. | **EPIC‑IDEAS‑MM‑11**: Node-granular conversion contract + preview/apply. **EPIC‑LINK‑02**: LinkGraph at node/artifact granularity (permission-aware). | GAP | P0 |
| 8) Collaboration + governance | MindMeister/Whimsical: realtime co-edit, presence, comments, history; enterprise sharing/permissions. | Presence overlay is a frontend stub; comments/activity are local/in-memory; snapshots are localStorage; backend has map persistence but no realtime. | Shared realtime baseline (presence → CRDT), per-node comments, assignment, review workflow, permissioned sharing (project/team), conflict-free history. | No server collab; no persistent comments/activity; no server-side version browser; no audit-grade history. | **EPIC‑ENT‑RT‑01**: Realtime collab platform baseline. **EPIC‑IDEAS‑MM‑12**: Persistent comments/activity for maps. **EPIC‑IDEAS‑MM‑13**: Server-side versions + restore UI (build on `my_idea_map_versions`). | GAP | P0 |
| 9) AI co-thinking for mind maps | Leaders are adding AI: expand, summarize, cluster, detect gaps; but enterprise needs controlled insertion + audit + cost controls. | There is AI expand branch (propose/apply) + multiple AI modals (blind spots, clustering, dependencies, priority, competitive landscape, what-if). | “AI as analyst”: structured proposals (batch accept + partial accept), citations to sources (notes/interviews/docs), audit log + replay, eval harness for generators. | AI features are rich but governance is not enterprise-grade (audit/replay, citations, evals); some AI additions are “direct insert” not traceable as proposals. | **EPIC‑AI‑IDEAS‑03**: Governed AI generator framework for mindmaps (audit + citations + evals). **EPIC‑AI‑GOV‑01**: Cost controls/registry/evals across features. | GAP | P0 |

#### 5.1.2 Whiteboards (deep dive — workshop + collaboration readiness)

**Benchmark notes (aligned with your prompt):**
- **Miro**: workshop-grade whiteboard (sticky notes, clustering, voting), large template ecosystem (journey map, strategy map, retro, etc.), and “shared thinking space” for teams in realtime.
- **Mural**: facilitation-first (timers, voting, grouping, facilitator tools) + structured synthesis from ideas → outcomes.
- **FigJam**: radical simplicity, low barrier-to-entry, realtime collaboration as default.
- **Stormboard**: structured idea capture + organization + voting leading into team decisions.

**As‑is verification anchors (code reality):**
- **Whiteboard canvas**: `src/components/MyWork/IdeaWhiteboardTool.tsx` — sticky notes, text blocks, shapes, frames (collapsible), images (paste + drag/drop), link cards w/ preview, connectors with labels, multi-select (selection box), align tools, layouts, auto-save, drawing overlay, “scenes” (viewport bookmarks).
- **Templates**: `src/components/MyWork/IdeaTemplateGallery.tsx` includes **whiteboard** templates (e.g., Business Model Canvas, Impact/Effort, Retro, Lean Canvas, Customer Journey Map).
- **Voting**: `src/components/MyWork/IdeaVotingMode.tsx` is a voting overlay used from `IdeaMapWorkspace.tsx` (works for mindmap + whiteboard), but currently local-only (`userId = 'current-user'`).
- **AI generators**: backend supports whiteboard generator types via `POST /api/my-work/my-ideas/:id/ai-generate` (`whiteboard_brainstorm`, `whiteboard_clusters`, `whiteboard_organize`, `sticky_summarize`) — see `server/src/routes/my-work.routes.ts` and `server/src/services/ideaAIGeneratorService.ts`.
- **Persistence**: whiteboard elements are stored in the shared idea map via `GET/PUT /api/my-work/my-ideas/:id/map` (`server/src/routes/my-work.routes.ts`).

| Slice (whiteboards) | Benchmark (leaders) | As‑is (Consultify code) | V4 target (enterprise) | Gap | Proposal (epics) | Status | V4 Priority |
|---|---|---|---|---|---|---|---|
| 1) Brainstorming primitives (fast capture) | FigJam/Miro: instant sticky creation, minimal chrome, fast multi-user capture; smooth pan/zoom + selection. | Strong base primitives exist in `IdeaWhiteboardTool.tsx` (stickies/text/shapes/frames/images/links, connectors, drawing). Creation is toolbar-first; paste/drop adds nodes; selection is box-select. | “No friction” creation: click-to-sticky, quick-add palette, keyboard shortcuts for add/edit, predictable selection/move; robust A11y. | UX still heavier than FigJam; no explicit “cursor tool” modes; keyboard coverage is limited (mostly Cmd/Ctrl+S). | **EPIC‑IDEAS‑WB‑01**: Whiteboard interaction contract (tools, shortcuts, focus model) + A11y DoD. **EPIC‑UX‑IDEAS‑WB‑01**: Reduce chrome + speed-up creation (click-to-sticky + quick-add). | GAP | P0 |
| 2) Facilitation toolkit (timers, voting, grouping) | Mural/Miro: timers, voting sessions, grouping/cluster flows, facilitator controls (lock, spotlight/follow-me, bring-to-me). | Voting overlay exists (`IdeaVotingMode.tsx`) with timer + reactions, but it’s local-only and not a real multi-user session; grouping exists as a node type, frames can contain items; no dedicated facilitation panel. | Workshop mode: facilitator role, timer, voting with per-user identity + persistence, grouping flows, spotlight/follow-me, exportable outcomes. | Missing true facilitation “session” model, facilitator controls, persistence of votes, and team identities. | **EPIC‑IDEAS‑WB‑02**: Facilitation mode (timer/voting/session roles/persistence). **EPIC‑ENT‑RT‑02**: Presence + identity + shared session state (used by voting/follow-me). | GAP | P0 |
| 3) Templates + workshop workflows | Miro/Mural: massive template library, guided workflows (retro, CJM, strategy map), org templates. | Whiteboard templates exist in `IdeaTemplateGallery.tsx` (BMC, retro, CJM, etc.). | Org-level template library + “guided workshop” flows (step-by-step), including custom templates per org/project. | Templates exist but not yet a governed enterprise library (ownership, versioning, permissions, publishing). | **EPIC‑IDEAS‑WB‑03**: Enterprise template library (publish/version/permissions) + guided workshop flows. | GAP | P1 |
| 4) Organize → synthesize outcomes | Stormboard/Mural: cluster → label → synthesize → decisions/action items; keep traceability from stickies to outputs. | Backend AI can propose clusters and organization (`whiteboard_clusters`, `whiteboard_organize`, `sticky_summarize`), and whiteboard has frames/groups primitives. | First-class “workshop outcomes”: cluster objects + summaries + decision/action extraction; link outcomes to Initiatives/Decisions/Tasks with node-level traceability. | No explicit outcomes model; conversion/traceability appears idea-level, not “sticky/cluster-level”; cluster proposals need productized UX (review/apply/undo). | **EPIC‑IDEAS‑WB‑04**: Outcomes model (clusters → summaries → decisions/tasks) + node-level traceability. **EPIC‑AI‑IDEAS‑WB‑01**: AI clustering/organize UX (propose→accept with diffs/undo). | GAP | P0 |
| 5) Realtime collaboration + governance | Miro/FigJam: realtime co-edit, presence, cursors, comments, permissions; enterprise auditability. | No evidence of realtime for whiteboard; map persistence is single-user save; voting uses a hardcoded user id; collaboration framework is not implemented end-to-end. | Realtime baseline (presence → CRDT), comment threads, per-object permissions where needed, audit log for edits and AI actions. | Realtime missing; audit/event stream not in place; multi-user identity not wired. | **EPIC‑ENT‑RT‑01**: Realtime collab platform baseline (shared across canvases). **EPIC‑ENT‑AUDIT‑01**: Audit logging framework for canvas edits/AI applies. | GAP | P0 |
| 6) Export/share/embed | Miro: share links, export (PNG/PDF), embed in docs, stakeholder-friendly outputs. | Core artifacts are persisted in the shared map; export/share flows are present at workspace level, and link previews exist (`/api/link-preview`). | Controlled sharing (project/public), export packages (PNG/PDF), embed into Reports/Decks with permission-safe previews. | Whiteboard-specific export/share flows are not clearly productized (permissions, watermarking, public share controls). | **EPIC‑IDEAS‑WB‑05**: Whiteboard export/share hardening (PDF/PNG, embeds, secure share links). | GAP | P1 |

#### 5.1.3 Gotowość “iść dalej” + dojście do ideału (enterprise global level) — opis zadania

**Czy jesteśmy gotowi iść dalej?** Tak — bo fundament jest właściwy i spójny:
- **Jeden canonical artefact** dla całego workspace (`GET/PUT /api/my-work/my-ideas/:id/map`) i wspólna warstwa danych dla narzędzi (mindmap/whiteboard/process flow/table).
- **Propose→accept** jako wzorzec zmian (AI i edycje grafu) już istnieje i jest skalowalny na kolejne powierzchnie.
- **Whiteboard + mindmap mają realne funkcje**, nie tylko “placeholdery” (templates, podstawowe narzędzia, AI generatory).

**Czego brakuje do “ideału” (global enterprise leader)?** To jest jasna, wspólna ścieżka dla mindmap + whiteboard:
- **Realtime collaboration (P0)**: presence → shared session state → CRDT (w tym voting/timer/follow‑me). Dziś brak end‑to‑end.
- **Audit + reproducibility (P0)**: jednolity audit log dla zmian użytkownika i AI (kto/co/why), plus replay i zgodność z retention/policy.
- **Workshop outcomes + traceability (P0)**: obiekty typu cluster/outcome, ekstrakcja do Decisions/Tasks/Initiatives z traceability na poziomie node/sticky (nie tylko “idea-level convert”).
- **Keyboard/A11y DoD (P0)**: pełny focus model, skróty, dostępność i testy regresji.
- **Enterprise sharing/export (P1)**: bezpieczne linki share, PDF/PNG eksport, embed do Reports/Decks z kontrolą uprawnień.

**Plan epików (minimalny “path to ideal” dla 5.1):**
- **P0**: `EPIC‑ENT‑RT‑01`, `EPIC‑ENT‑RT‑02`, `EPIC‑ENT‑AUDIT‑01`, `EPIC‑IDEAS‑MM‑11`, `EPIC‑IDEAS‑WB‑04`, `EPIC‑IDEAS‑MM‑02`, `EPIC‑IDEAS‑WB‑01`, `EPIC‑AI‑IDEAS‑WB‑01`, `EPIC‑AI‑IDEAS‑03`
- **P1**: `EPIC‑IDEAS‑MM‑06`, `EPIC‑IDEAS‑MM‑09`, `EPIC‑IDEAS‑WB‑03`, `EPIC‑IDEAS‑WB‑05`

#### 5.1.4 Process & System Diagrams (deep dive — Lucidchart/Visio/Creately/Draw.io)

**Benchmark notes (aligned with your prompt):**
- **Lucidchart**: formal process flows (BPMN), system diagrams + org charts; strong layout/connectors; diagrams linked to docs/data and easy to share/embed.
- **Microsoft Visio**: “corporate standard” formal diagrams (BPMN/flowcharts/network/org) + stencils + enterprise import/export and governance.
- **Creately**: diagrams connected to data objects (roles/processes/systems), collaboration, and “diagram as database”.
- **Draw.io (diagrams.net)**: minimal UI that still supports complex diagrams; huge format interoperability (esp. its XML) and easy sharing/export.

**As‑is verification anchors (code reality):**
- **Process Flow canvas**: `src/components/MyWork/IdeaProcessFlowTool.tsx` — swimlanes, node shapes (start/end/action/decision) + additional VSM shapes, dagre auto-layout, validations (missing start/end, dangling nodes, decision exits), lane reorder/delete/color picker, drag node between lanes (laneId auto-update), edge label editing, undo/redo, keyboard shortcuts (Enter/Shift+Enter add nodes).
- **Analytics overlays**: `src/components/MyWork/ProcessKPIDashboard.tsx`, `src/components/MyWork/VSMTimelineBar.tsx` (process intelligence + VSM lens).
- **Templates**: `src/components/MyWork/IdeaTemplateGallery.tsx` includes **process_flow** templates (basic process, approval workflow, PDCA, O2C, P2P).
- **AI generators**: `server/src/services/ideaAIGeneratorService.ts` supports process-related generators (`lane_generator`, `flow_generator`, `process_coach`, `process_summary`, `next_step`, `vsm_generator`, `vsm_future_state`) called via `POST /api/my-work/my-ideas/:id/ai-generate`.
- **Persistence**: shared map storage `GET/PUT /api/my-work/my-ideas/:id/map` (`server/src/routes/my-work.routes.ts`).

| Slice (process & system diagrams) | Benchmark (leaders) | As‑is (Consultify code) | V4 target (enterprise) | Gap | Proposal (epics) | Status | V4 Priority |
|---|---|---|---|---|---|---|---|
| 1) Formal notations + diagram types | Lucidchart/Visio: BPMN 2.0 palette, org charts, network/system diagrams, stencils; consistent semantics. | Strong **process-flow** editor with swimlanes + validations + VSM-like shapes; not a full BPMN/Visio stencil library. | Multi-diagram “kit”: **BPMN mode**, **System/Architecture mode** (C4/UML-lite where needed), **Org chart mode**, all stored in one canonical graph with typed nodes/edges. | Missing BPMN semantics (events/gateways/pools/messages); missing org chart/system diagram stencils and semantics; limited domain typing beyond node.data.shape. | **EPIC‑IDEAS‑DIAG‑01**: Formal diagram palette + typed schema (BPMN/system/org). **EPIC‑IDEAS‑DIAG‑02**: Diagram mode switch (process vs system vs org) w/ validations per mode. | GAP | P0 |
| 2) Link diagrams to data + documentation | Creately/Lucidchart: diagram elements linked to entities (roles/systems/processes), docs, and “diagram as database”. | Nodes can store metadata in `data` (duration/cost/FTE/status/attachments etc.) and there’s platform LinkGraph elsewhere, but explicit “diagram ↔ domain objects” linking is not formalized here. | Nodes/lanes map to canonical objects (roles/systems/processes/KPIs) via `artifactRef`/IDs; hover/preview, backlinks, and report-ready embeds. | No explicit reference contract + UI for linking nodes to system objects; no schema enforcement; backlinks parity not guaranteed. | **EPIC‑IDEAS‑DIAG‑03**: Diagram object refs (artifact links) + backlinks + preview cards. **EPIC‑LINK‑03**: Standardized “Used in” and embeds for diagram nodes. | GAP | P0 |
| 3) Layout/connectors quality at scale | Lucidchart/Visio: excellent routing, alignment, snap-to-grid, tidy-up, grouping, large diagrams staying readable. | Dagre auto-layout exists; lane backgrounds and drag-between-lanes works; but no explicit Visio-grade routing/connector styles, grouping, advanced alignment tools. | Visio-grade diagram UX: connector routing options, align/distribute, group/ungroup, snap settings, reusable styles/themes, large-diagram performance budgets. | Missing advanced alignment/distribution + routing controls; unclear scalability/perf on very large diagrams; limited style system. | **EPIC‑IDEAS‑DIAG‑04**: Diagram UX polish (routing, align/distribute, grouping, styles, perf). | GAP | P1 |
| 4) Import/export + interoperability | Visio/Lucidchart/Draw.io: import/export (Visio, BPMN XML, draw.io XML), high-quality PDF/SVG, round-tripping. | Persistence exists; export is mostly workspace-level (not process-flow-specific), and no evidence of Visio/draw.io/BPMN import/export for process flow. | Interop package: export PDF/SVG + structured export (BPMN XML / draw.io XML where feasible); import for Visio/draw.io/BPMN with best-effort mapping + warnings. | No round-tripping formats; enterprise customers expect Visio workflows; migration path for existing diagrams missing. | **EPIC‑IDEAS‑DIAG‑05**: Import/export interoperability (Visio/draw.io/BPMN) + mapping report. **EPIC‑IDEAS‑DIAG‑06**: PDF/SVG export pipeline with fidelity. | GAP | P0 |
| 5) Collaboration + governance | Leaders: realtime co-edit, comments, approvals, permissions, audit, retention. | Today: strong single-user editing + AI helpers; no realtime end-to-end; audit/policy layer is cross-cutting and not diagram-specific. | Enterprise collaboration baseline (presence→CRDT), comment threads per node/edge, approvals/sign-offs for formal diagrams, full audit trail. | Realtime + audit are not implemented end-to-end; approvals workflow for “official” diagrams missing. | **EPIC‑ENT‑RT‑01**: Realtime collab baseline (shared). **EPIC‑ENT‑AUDIT‑01**: audit events for diagram edits/exports. **EPIC‑IDEAS‑DIAG‑07**: Diagram approvals/sign-off workflow. | GAP | P0 |
| 6) AI-assisted process intelligence | Leaders: AI to suggest missing steps, optimize flow, generate documentation, summarize and propose improvements. | Process coach/summary + lane/flow generation + VSM generation exist in `ideaAIGeneratorService.ts` and are invoked from `IdeaProcessFlowTool.tsx`. | Governed AI for process/system diagrams: proposals with diffs, citations (why), evaluation harness, and “publishable” narrative export. | AI is strong functionally but needs enterprise governance (audit/replay/evals) and tighter UX integration for diff/preview across all AI actions. | **EPIC‑AI‑DIAG‑01**: Governed AI proposals for process/system diagrams (diff/preview + audit/replay + evals). | GAP | P0 |

#### 5.1.5 Structured Thinking (tables + frameworks) — Airtable/Coda/Notion DB/Fibery/Smartsheet

**Benchmark notes (aligned with your prompt):**
- **Airtable**: spreadsheet UX + relational DB; linked records, rollups/lookups, views, forms, automations; “model firmy w danych”.
- **Coda**: dokument + dane + automacje w jednym obiekcie; tabele jako “living doc” z przyciskami/flows; silna kompozycja z tekstem.
- **Notion databases**: bazy danych jako fundament “systemu myślenia” (frameworki typu SWOT/roadmap/initiative tracker) + widoki + relacje + dokumenty.
- **Fibery**: sieć obiektów (work graph) i modelowanie organizacji jako powiązane byty; relacje są pierwszorzędne.
- **Smartsheet**: arkuszowy model do zarządzania programami (Gantt, dependencies, approvals, automations, enterprise governance).

**As‑is verification anchors (code reality):**
- **Idea Table core**: `src/components/MyWork/IdeaTableTool.tsx` — saved views, view layouts (table/kanban/matrix/sticky/timeline), filters/sort/group, column show/hide/reorder/resize, bulk actions, row detail panel, conditional formatting, embedded analytics/heatmap, CSV import/export, export to presentation, selection + keyboard navigation, undo/redo.
- **Column types**: `src/components/MyWork/table/tableTypes.ts` includes rich set: `select`, `multiselect`, `date`, `rating`, `person`, `progress`, `formula`, `ai_generated`, `file`, `relation`, `rollup`, `currency`, etc.
- **Formulas + rollups**: `src/components/MyWork/table/FormulaEngineV2.ts` (“cross-row references, rollups from relations”).
- **Cross-table relations**: `src/components/MyWork/table/CrossTableRelations.tsx` (links nodes across idea maps + rollup configs) — currently contains demo fallback when listing maps is not available.
- **AI for tables**:
  - `POST /api/my-work/my-ideas/:id/ai-generate` supports `table_columns` and `table_views` (structured).
  - `POST /api/my-work/my-ideas/:id/ai-table-action` turns natural language into table operations (structured) — `server/src/routes/my-work.routes.ts`.
  - `POST /api/my-work/my-ideas/:id/ai-fill` auto-fills `ai_generated` columns.

| Slice (structured thinking tables) | Benchmark (leaders) | As‑is (Consultify code) | V4 target (enterprise) | Gap | Proposal (epics) | Status | V4 Priority |
|---|---|---|---|---|---|---|---|
| 1) “Table as model” (schemas + views) | Airtable/Notion/Fibery: users build their own modeling schema; many views over same data; repeatable framework templates. | Columns are configurable with many types; saved views exist; multiple layouts exist; templates/row templates exist; CSV import/export exists. | Treat tables as first-class modeling artifacts: schema versioning, reusable framework templates (SWOT, roadmap, initiative portfolio), and consistent “table contract” across app. | Schema governance is not formalized (versioning/migrations); template governance for org-level frameworks is partial; not clear how multiple tables per idea/org are represented. | **EPIC‑IDEAS‑TABLE‑01**: Table schema contract + versioning/migrations + validators. **EPIC‑IDEAS‑TABLE‑02**: Framework templates library (org-scoped) + guided setup (SWOT/roadmap/portfolio). | GAP | P0 |
| 2) Relations (linked records) + rollups | Airtable/Fibery: relations are first-class; lookups/rollups across linked entities; cross-table graph. | Relation/rollup column types exist; `FormulaEngineV2` supports rollups; `CrossTableRelations` exists (but with demo fallback + unclear backend contract). | Enterprise-grade relations: typed relations across artifacts (ideas/initiatives/tasks/kpis/tools), rollups with deterministic semantics, and graph navigation (“company model”). | Cross-table relations are not hardened end-to-end (backend listing/permissioning); rollups across real artifacts need a canonical reference model; lineage/traceability not explicit. | **EPIC‑IDEAS‑TABLE‑03**: Typed relations + rollups across platform artifacts (not demos). **EPIC‑IDEAS‑TABLE‑04**: Work graph navigation (network view + impact analysis). | GAP | P0 |
| 3) Formulas + computed fields | Airtable/Smartsheet: robust formula language, dependencies, recalculation, performance, deterministic results. | Formula columns exist; there is `FormulaEngineV2` + batch evaluation; computed values are stored in row data (UI-level). | Deterministic compute engine with caching, dependency graph, and consistent recalculation across clients; tests for formula correctness. | Compute seems client-side; no explicit dependency graph/persistence strategy; audit of computed changes missing. | **EPIC‑IDEAS‑TABLE‑05**: Compute engine hardening (dependency graph, caching, determinism, tests) + server-side evaluation option. | GAP | P1 |
| 4) Automations / workflows | Airtable/Coda/Smartsheet: automations (when X then Y), buttons/actions, approvals, notifications, integrations. | There are AI “table actions” and rich UI tools, but no explicit automation engine for table triggers/actions. | Automation layer for table models: triggers (field change, schedule), actions (create task/decision, notify, update fields), approvals; governed + auditable. | No automation engine or policy controls; no audit for automated actions; integration connectors not unified. | **EPIC‑IDEAS‑TABLE‑06**: Automation/workflow engine (triggers/actions) + audit + policy controls. | GAP | P0 |
| 5) Document + data composition (Coda/Notion style) | Coda/Notion: tables live inside docs; narrative + data as one artifact; embeds + backlinks. | Tables are inside Idea Workspace; Notebook exists separately; exports to presentation exist; embeddings exist conceptually but not unified as “doc+table single object”. | Unified “analysis doc” artifact: narrative blocks + embedded tables/diagrams with LinkGraph + permission-safe embeds into Reports/Decks. | Separation between Notebook and Table is product-level; embed/backlink parity and editing-in-doc is not standardized. | **EPIC‑DOC‑DATA‑01**: Embedded table blocks in Notebook/Reports with LinkGraph + permission gates + consistent preview. | OPEN DECISION | P1 |
| 6) Collaboration + governance | Enterprise leaders: realtime multi-user editing, comments, history, audit, permissions down to field/view. | Table has presence UI components (e.g., `CollaborationPresence`) and rich editing, but realtime end-to-end is not proven; audit/history is cross-cutting and incomplete. | Realtime baseline (presence→CRDT) for tables; cell-level cursors; comments/activity per row; audit stream; RBAC enforcement for edits/exports. | Realtime missing end-to-end; comments/activity may be UI-only; no immutable audit trail; per-field permissions not defined. | **EPIC‑ENT‑RT‑01**: Realtime collab baseline (shared). **EPIC‑IDEAS‑TABLE‑07**: Table comments/activity + version history (server-side). **EPIC‑ENT‑AUDIT‑01**: Audit events for table operations + AI actions. | GAP | P0 |
| 7) Import/export + enterprise interchange | Smartsheet/Airtable: CSV/XLSX import, export packages, BI-friendly outputs, governance. | CSV import/export exists; export to presentation exists. | XLSX import/export, structured export packages (schema + data + relations), admin controls, and APIs for BI (permissioned). | Limited to CSV; no xlsx; no stable external API contract for table models; governance missing. | **EPIC‑IDEAS‑TABLE‑08**: Import/export hardening (XLSX + schema packages + BI API). | GAP | P1 |
| 8) AI as analyst for frameworks | Leaders: AI to propose schemas/views, categorize, summarize, generate frameworks; but enterprise requires governance. | Table AI is strong: schema/view generation, AI fill, natural-language actions; plus extra AI tools in UI. | Governed AI for “structured thinking”: proposal batches w/ diffs, citations to sources, evaluation harness, and cost controls. | Needs audit/replay, citations, evals; “AI table action” must be safe, validated, and permissioned. | **EPIC‑AI‑TABLE‑01**: Governed AI actions for tables (validation + diff + audit + evals). **EPIC‑AI‑GOV‑01**: cost controls/registry/evals. | GAP | P0 |

---

### 5.2 Notebook + Knowledge

**Module snapshot**
- **As‑is**: TipTap-based Notebook with tags/status/pinning, project/private visibility, LinkGraph backlinks, and several AI helpers (extract actions/topics/classify + chat).
- **V4 target**: Enterprise knowledge system: multi-source capture, hybrid search (full-text + OCR + semantic with citations), governance (owners/verification/freshness), and permission-safe “answer in context”.
- **Top gaps**:
  - Capture connectors (web/email/file/PDF) + ingestion pipelines.
  - Search index + OCR + semantic retrieval with citations (permission-aware).
  - Knowledge lifecycle governance (ownership, verification, stale detection) and admin policy integration.
  - AI governance for knowledge: audited inserts-as-blocks + citations + evals.
- **P0 epics**: EPIC‑NOTE‑CAP‑01, EPIC‑NOTE‑SEARCH‑01, EPIC‑NOTE‑SEARCH‑02, EPIC‑RAG‑01, EPIC‑AI‑NOTE‑01, EPIC‑ENT‑AUDIT‑01, EPIC‑ENT‑POLICY‑01

**Benchmark leaders (from your list):** Evernote, Notion, Confluence, Guru, Slab, Tettra

**SSOT anchors:**
- `docs/product/NOTEBOOK_V3.md`
- `docs/product/LINK_GRAPH_V3.md`

**As‑is anchors (code):**
- Frontend: `src/components/MyWork/NotebookContent.tsx`, `src/components/MyWork/notebook/NotebookContextPanel.tsx`, `src/components/MyWork/notebook/SlashMenu.tsx`, `src/components/MyWork/notebook/ActionItemsPanel.tsx`, `src/components/MyWork/notebook/AITopicsPanel.tsx`
- Backend: `server/src/routes/my-work.routes.ts` (Notebook + LinkGraph routes)

| Area (5) | Benchmark (leaders) | As‑is (Consultify code) | V4 target (enterprise) | Gap | Proposal (epics) | Status | V4 Priority |
|---|---|---|---|---|---|---|---|
| 1) Capabilities | Fast capture + organization (tags/spaces), powerful search, page templates, content blocks, cross-linking, knowledge freshness workflows. | TipTap-based editor + maturity signals; pin/status; slash menu; “create from note” flows exist in UI; backend notebook CRUD: `GET/POST/GET/PUT/DELETE /api/my-work/notebook/pages` + pin/status. | Knowledge system as a platform artifact: strong capture, structured blocks, templates, and “living knowledge” loops (refresh/owners/verification), not just docs. | Missing enterprise knowledge ops (verification, ownership, stale detection); richer import/export; stronger structure beyond free text. | EPIC‑NOTE‑01: Knowledge lifecycle (owners, verification, stale signals). EPIC‑NOTE‑02: Templates library + org taxonomy (spaces/topics). EPIC‑NOTE‑03: Import/export (md/docx) + bulk capture. | GAP | P1 |
| 2) Integrations | Deep linking across work OS; inline embeds; backlinks; Slack/Teams knowledge surfaces. | LinkGraph edges endpoint exists (`POST /api/my-work/link-graph/edges`); Notebook UI creates edges when converting/creating; notebook pages support `visibility: private|project` with project membership checks. | LinkGraph becomes a platform contract used consistently across all editors (Notebook/Reports/Decks/Initiatives/Tools) with safe permissioned backlinks. | Parity of embedded previews + backlinks likely inconsistent beyond Notebook; cross-module “Used in” needs uniform UI surfaces. | EPIC‑LINK‑01: Platform-wide embedded refs + backlinks UI + batching/caching. EPIC‑NOTE‑INT‑01: Slack/Teams knowledge cards + “answer in context” (optional). | GAP | P0 |
| 3) AI enablement | Notion/Guru-like AI for summarize/extract/Q&A; context-aware suggestions; “write with AI” without overwriting user. | Notebook has AI streaming (`Api.chatWithAIStream`) + inline AI panels; backend endpoints exist for actions/topics/classify: `POST /notebook/pages/:id/extract-actions`, `/suggest-topics`, `/classify`. | Governed AI for knowledge: traceable suggestions, cite sources, insert blocks safely, evaluate quality, anti-spam. | Missing audit trail + reproducibility; missing knowledge-grounded answers across artifacts; missing evals/cost controls at feature level. | EPIC‑AI‑NOTE‑01: AI audit log + “insert as blocks” contract. EPIC‑AI‑NOTE‑02: Knowledge Q&A with citations + permissions. EPIC‑AI‑GOV‑01: evals + cost controls + prompt registry. | GAP | P0 |
| 4) UI/UX quality | Block editor polish, quick commands, frictionless linking/preview, consistent right-rail panels, keyboard-first. | Rich editor UI exists with custom blocks/styles; slash detection + menu; right panel components exist (context/topics/chat). | Consistent “workspace 3‑tools strip” mental model; embedded ref chips + preview cards across app; accessibility/keyboard polish. | Some strings/layout may not fully follow global UI canon; embedded preview parity across artefacts needs standard shell. | EPIC‑UX‑NOTE‑01: Standardize embed chips + preview shell. EPIC‑UX‑NOTE‑02: Keyboard/A11y pass for editor + slash menu. | GAP | P1 |
| 5) Enterprise readiness | Permissions, audit, retention, legal hold, eDiscovery, export. | Notebook visibility supports private/project access checks; no explicit enterprise retention/audit layer shown in Notebook routes. | Enterprise policy engine (retention/legal hold), audit events for reads/edits/exports, SSO/SCIM driven access. | Auditability and policy controls missing; admin controls for knowledge governance missing. | EPIC‑ENT‑AUDIT‑01: Audit logging framework (read/write/export). EPIC‑ENT‑POLICY‑01: retention/legal hold + admin policies. | GAP | P0 |

**Tasks do wdrożenia**
- [ ] Wdrożyć capture connectors: web clipper (browser extension), email forward (inbox integration), upload PDF/XLSX z ekstrakcją tekstu
- [ ] Zbudować pipeline ingestii: plik → extract (OCR dla PDF/img) → tokenize → indeks (full-text + opcjonalnie embedding)
- [ ] Zastąpić SQL LIKE search indeksem full-text (PostgreSQL FTS lub Elasticsearch) + filtry tags/space/project
- [ ] Wdrożyć semantic search z RAG + citations (permission-safe, zwracanie fragmentów z sourceRef)
- [ ] Dodać model `owner`, `verificationStatus`, `reviewCadence`, `staleAt` do notebook_pages + UI lifecycle
- [ ] Zintegrować AI insert-as-blocks z audit log (każda propozycja zapisana, apply rejestrowane)
- [ ] Ujednolicić embed chips + preview shell (NModeBlocks.EmbeddedView) w Notebook, Reports, Decks

**Plan pokrycia gapu**
- **Capture pipeline**: Web clipper jako rozszerzenie przeglądarki (save selection/page jako notebook page). Email forward przez dedykowany adres lub integrację z Notifications. Upload plików z OCR (Tesseract/Google Vision) dla PDF/obrazów — wynik zapisywany w content_json + indeksowany.
- **Search index + OCR**: Migracja z LIKE na full-text index. Opcja A: PostgreSQL `tsvector` (migracja w DB, `to_tsvector`). Opcja B: Elasticsearch gdy scale >100k stron. FTS first (R0), semantic RAG w R1. Dla OCR — osobna kolejka jobs, pipeline extract→index. Semantic retrieval przez embedding model + RAG service z citations do konkretnych fragmentów stron.
- **Knowledge lifecycle**: Rozszerzenie modelu o `ownerId`, `verificationStatus`, `lastVerifiedAt`, `reviewCadenceDays`. UI do oznaczania "verified", "needs review". Policy engine do wykrywania "stale" (np. >90 dni bez weryfikacji) i powiadomień.
- **AI governance**: Każda AI-suggested insert zapisywana jako proposal z diff; apply wymaga akceptacji użytkownika i generuje audit event. Eval harness dla extract-actions/suggest-topics/classify (golden set + metryki jakości).

#### 5.2.1 Knowledge systems (deep dive — Evernote/Notion/Confluence/Guru/Slab/Tettra)

**Benchmark notes (aligned with your prompt):**
- **Evernote**: “capture first” (web/PDF/email/mobile scan), OCR + search, tags + notebooks, fast retrieval.
- **Notion**: blocks + databases + docs in one graph; AI is mostly generator, but the key is unified context + relations.
- **Confluence**: enterprise spaces + structured documentation tied to delivery (Jira), permissions, audit, and governance.
- **Guru**: “cards” (small knowledge units) + verification workflows + delivery in context (Slack/browser).
- **Slab**: simpler Confluence; strong taxonomy + search + integrations; docs as “source of truth”.
- **Tettra**: lightweight wiki/Q&A; knowledge as answers to real questions + ownership.

**As‑is verification anchors (code reality):**
- **Block editor + commands**: `src/components/MyWork/NotebookContent.tsx` (TipTap, slash menu, templates, maturity signals).
- **Search**: backend `GET /api/my-work/notebook/pages?q=...` is SQL LIKE over `title/content_text/tags_json` (`server/src/routes/my-work.routes.ts`).
- **Permissions model**: note visibility is `private|project` with membership checks (`server/src/routes/my-work.routes.ts`).
- **Contextual knowledge**:
  - Backlinks/“Used in”: LinkGraph (`/api/my-work/link-graph/backlinks`) surfaced in `NotebookContextPanel.tsx`.
  - “Knowledge Pulse”: `src/components/MyWork/notebook/KnowledgePulse.tsx` suggests initiatives/tasks/decisions by search terms (title+tags).
- **AI for notes**: `POST /api/my-work/notebook/pages/:id/extract-actions`, `/suggest-topics`, `/classify` + inline AI chat panels in UI.

| Slice (knowledge systems) | Benchmark (leaders) | As‑is (Consultify code) | V4 target (enterprise) | Gap | Proposal (epics) | Status | V4 Priority |
|---|---|---|---|---|---|---|---|
| 1) Capture pipeline (multi-source) | Evernote/Guru: web clipper, email forward, mobile scan, PDF ingestion; auto organization. | Notebook is editor-first; no explicit web/email capture pipeline; content is stored as `content_json` + `content_text` in `notebook_pages`. | Multi-source capture: browser clipper, email ingest, file/PDF ingest, meeting notes capture, auto-tagging + routing into spaces/projects. | Missing capture connectors + ingestion pipeline; missing file store & extraction pipeline for knowledge items. | **EPIC‑NOTE‑CAP‑01**: Capture connectors (web/email/upload) + ingestion pipeline. **EPIC‑NOTE‑CAP‑02**: Auto-tagging/routing rules (org policies). | GAP | P0 |
| 2) OCR + “find anything” search | Evernote: OCR for images/PDFs; lightning fast search; Notion/Confluence: strong search + filters. | Search is basic (SQL LIKE over title/content_text/tags_json); no OCR pipeline found; no semantic search/citations. | Hybrid search: full-text + OCR index + semantic retrieval with permission-safe citations; query filters by tags/space/project/type. | Missing OCR; missing scalable index; missing semantic retrieval with citations; unclear performance at scale. | **EPIC‑NOTE‑SEARCH‑01**: Search index + filters + ranking. **EPIC‑NOTE‑SEARCH‑02**: OCR pipeline (PDF/images) + indexing. **EPIC‑RAG‑01**: Permissioned RAG w/ citations for knowledge answers. | GAP | P0 |
| 3) Knowledge organization (spaces/topics/cards/Q&A) | Confluence/Slab: spaces & taxonomy; Guru: cards + verification; Tettra: Q&A-first KB. | Notes have tags, status (inbox/active/converted/archived), pinning, and project visibility; no explicit “spaces”/card model; Q&A knowledge base not explicit. | Knowledge IA: org spaces/topics, card-based “single truth” units, Q&A layer (questions → curated answers), and templates per domain. | Missing “spaces” primitives; missing card/Q&A knowledge types; ownership/verification loops are not a first-class object model. | **EPIC‑NOTE‑IA‑01**: Spaces/topics taxonomy + navigation. **EPIC‑NOTE‑IA‑02**: Knowledge cards + verification workflow (Guru-like). **EPIC‑NOTE‑IA‑03**: Q&A knowledge base (Tettra-like) + answer lifecycle. | GAP | P1 |
| 4) Context delivery (in workflow) | Guru: surfaces knowledge in Slack/browser; Confluence: Jira links; Notion: embeds everywhere. | There is LinkGraph + contextual side panel (`NotebookContextPanel`) and KnowledgePulse; optional Slack/Teams integration exists conceptually elsewhere but not in Notebook. | Knowledge delivered in context: Slack/Teams cards, browser extension surfaces, deep links, “used in” everywhere; safe permissioned previews. | Missing “in-context” distribution channels; backlink parity across modules not guaranteed; no enterprise notifications/routing for knowledge. | **EPIC‑NOTE‑DIST‑01**: Slack/Teams knowledge delivery + routing policies. **EPIC‑LINK‑01**: Platform-wide embed/backlink parity. | GAP | P1 |
| 5) AI as co-thinker (not just generator) | Notion AI is generator; leaders add summarize/extract; enterprise needs governance + citations. | Good base: extract actions/topics/classify + inline AI chat; but no explicit citations-to-sources, evals, or replay audit. | Governed knowledge copilot: citations to notes/docs/tools, propose→accept inserts as blocks, eval harness, cost controls, audit/replay. | Missing audit trail and reproducibility; missing citations; missing knowledge-grounded answers across artifacts. | **EPIC‑AI‑NOTE‑01**: AI audit log + safe insert as blocks. **EPIC‑AI‑NOTE‑03**: Knowledge Q&A w/ citations + permissions. **EPIC‑AI‑GOV‑01**: evals/cost controls/registry. | GAP | P0 |
| 6) Knowledge governance (verification, freshness, ownership) | Guru/Confluence: ownership, verification, stale detection, approvals, audit. | Notebook has maturity signals (computed), statuses, and visibility checks; no explicit verification/ownership lifecycle in data model. | Knowledge lifecycle: owners, review cadence, stale detection, verification stamps, audit events, retention/legal hold policies. | Missing lifecycle primitives; missing admin policy engine integration; missing audit events for access/export. | **EPIC‑NOTE‑01**: Knowledge lifecycle (owners/verification/stale). **EPIC‑ENT‑AUDIT‑01**: audit framework for read/write/export. **EPIC‑ENT‑POLICY‑01**: retention/legal hold + residency. | GAP | P0 |

---

### 5.3 Tasks + Decisions (MyWork)

**Module snapshot**
- **As‑is**: Solid MyWork tasks/decisions UX (table/kanban/calendar/timeline) + real task dependencies; separate PMO task engine exists; decision queue/snooze exists.
- **V4 target**: Enterprise execution cockpit: unified hierarchy (program→initiative→workstream→task), configurable schemas/workflows, approvals, automation rules, and auditable actions.
- **Top gaps**:
  - Unified hierarchy/IA across “MyWork” and “PMO tasks” + rollups to initiatives/programs.
  - Custom fields + workflow engine (statuses/transitions/guards) with governance/versioning.
  - Automation rules (triggers→conditions→actions) with RBAC + audit.
  - Capacity/workload model that is grounded (allocation/skills/time) vs heuristics.
  - Enterprise controls: audit logs, retention/legal hold, approvals/sign-offs where required.
- **P0 epics**: EPIC‑TASK‑01, EPIC‑TASK‑02, EPIC‑TASK‑03, EPIC‑TASK‑04, EPIC‑DEC‑01, EPIC‑DEC‑02, EPIC‑ENT‑AUDIT‑01, EPIC‑ENT‑APPROVAL‑01

**Benchmark leaders (from your list):** ClickUp, Asana, Monday.com, Wrike, Smartsheet

**SSOT anchors:**
- `docs/MYWORK_MODULE_SPECIFICATION.md` (Tasks + Decisions sections)
- UI: `docs/ui-standards/01-shell-layout/presentation-modes.md`, `docs/ui-standards/UI_UX_CANON_V3.md`

**As‑is anchors (code):**
- Frontend: `src/components/MyWork/TaskDetailView.tsx`, `src/components/MyWork/MyTasksListContent.tsx`, `src/components/MyWork/TasksKanbanBoard.tsx`, `src/components/MyWork/TasksCalendarView.tsx`, `src/components/MyWork/DecisionDetailView.tsx`, `src/components/MyWork/DecisionsPanelContent.tsx`, `src/components/MyWork/DecisionsKanbanBoard.tsx`, `src/components/MyWork/DecisionsTimelineView.tsx`
- Backend: `server/src/routes/my-work.routes.ts` (Tasks/Decisions endpoints)

| Area (5) | Benchmark (leaders) | As‑is (Consultify code) | V4 target (enterprise) | Gap | Proposal (epics) | Status | V4 Priority |
|---|---|---|---|---|---|---|---|
| 1) Capabilities | Hierarchy (epic→task→subtask), custom fields, dependencies, approvals, automations, workload/resource planning, timeline/critical path. | Task + Decision detail views are substantial (N-mode layout, shared sections, AI helpers). Backend provides lightweight lists for MyWork + Focus: `GET /api/my-work/tasks`, `GET /api/my-work/decisions`; personal tasks CRUD: `/personal-tasks`; decision queue + snooze: `/decisions/queue`, `/decisions/:id/snooze`. | Enterprise execution cockpit: tasks & decisions tightly connected to initiatives/governance; configurable fields/workflows; dependencies; approvals; consistent timeline & workload views. | Likely missing: deep automation engine, enterprise-grade custom fields schema, true hierarchy, critical-path scheduling, cross-project workload model. | EPIC‑TASK‑01: Custom fields framework + workflow engine. EPIC‑TASK‑02: Dependencies/blocks model + UI parity across list/kanban/timeline. EPIC‑DEC‑01: Decision governance hardening (gate templates, SLA/escalation policies). EPIC‑EXEC‑01: Workload model (capacity, skills, allocation) beyond heuristics. | GAP | P0 |
| 2) Integrations | Jira/Teams/Slack, email-to-task, calendar sync, doc embeds, reporting ties. | Decisions view includes cloud integrations hooks (file picker) and delivery/escalation config types; MyWork has chat context enrichment endpoints. | Pluggable integrations layer: Jira sync, Teams/Slack actions, calendar sync, email capture, export to reports/decks. | Integrations exist in UI shapes but need platform-grade connectors + conflict handling. | EPIC‑INT‑01: Integration hub (connectors + sync engine + audit). EPIC‑INT‑JIRA‑01: Jira bidirectional sync for execution. EPIC‑INT‑CAL‑01: Calendar sync for tasks/decisions. | GAP | P1 |
| 3) AI enablement | AI for triage, breakdown, risk analysis, dependency suggestions, summaries, meeting briefs, automation suggestions. | Per-tab system prompts + quick prompts in `MyWorkHub.tsx`; Task/Decision have `buildAskAIMessage`, AI sections, and shared AI widgets (AIConnections/RelatedContext). | Governed AI that produces structured proposals (fields, dependencies, plans), with audit + cost controls + offline-safe drafts. | Need stronger “propose→accept” for AI edits across all task/decision fields; eval coverage and anti-spam. | EPIC‑AI‑TASK‑01: Structured AI proposals for task breakdown/fields/dependencies. EPIC‑AI‑DEC‑01: Decision briefs + scenario impacts with citations to linked artefacts. EPIC‑AI‑GOV‑01: evals/cost controls/registry. | GAP | P0 |
| 4) UI/UX quality | Fast table views, consistent preview pane, keyboard speed, predictable view modes, minimal chrome. | MyWork uses ModuleHub pattern; tasks have multiple view modes (table/kanban/calendar), decisions (table/kanban/timeline). Detail views use NModeLayout shared sections. | App-wide “one table” + preview pane parity; consistent view toggle order; keyboard/A11y across detail and boards. | Need compliance sweeps (table standard, preview pane parity, remove ad-hoc rows); ensure “review-next” not a view mode (SSOT rule). | EPIC‑UX‑TABLE‑01: App Table Standard adoption across Tasks/Decisions lists. EPIC‑UX‑PREVIEW‑01: Preview pane parity (actions match detail views). | GAP | P0 |
| 5) Enterprise readiness | Audit trails, approvals, RBAC, retention, SLA/escalations, reporting. | Server-side endpoints exist for queues/preferences/snooze; but audit logs and enterprise policy layer not visible here. | Full governance: auditable decisions/tasks, approvals workflow, RBAC enforcement, retention/legal hold, compliance exports. | Missing audit/event framework; missing admin policies; missing enterprise approval workflow engine. | EPIC‑ENT‑AUDIT‑01: Audit logging + immutable event stream. EPIC‑ENT‑POLICY‑01: retention/legal hold. EPIC‑ENT‑APPROVAL‑01: approvals + signatures (where needed). | GAP | P0 |

**Tasks do wdrożenia**
- [ ] Zunifikować hierarchię: program → initiative → workstream/list → task/subtask; spójne API dla MyWork i PMO
- [ ] Wdrożyć custom fields framework: schema registry (field defs per list/initiative), typy, walidacja, permissions
- [ ] Wdrożyć workflow engine: statusy + transitions + guards (required fields, role checks); approval steps z SLA
- [ ] Rozszerzyć dependencies o milestone objects + baseline snapshots + critical path calculation
- [ ] Wdrożyć automation rules engine: triggers (status/date/field change) → conditions → actions (assign, notify, create subtask, escalate); UI builder + dry-run + audit
- [ ] Połączyć workload model z allocation (capacity, skills, time tracking); integracja `/api/capacity` z task engine
- [ ] Wdrożyć decision playbooks: required fields (alternatives, rationale, evidence, owner, due), workflow propose→review→approve→publish
- [ ] Zintegrować audit framework: każda zmiana task/decision/automation emitować jako zdarzenie

**Plan pokrycia gapu**
- **Unified hierarchy**: Jeden model danych z `programId` → `initiativeId` → `listId` → `taskId`. MyWork i PMO używają tego samego API; filtry `scope=personal|initiative|program` określają widok. Rollupy (progress, count) obliczane z tej hierarchii.
- **Custom fields + workflow**: Schema jako first-class (tabela `task_field_definitions`, `decision_field_definitions` z typem, validation, permissions). Workflow: `statuses` + `transitions` z warunkami (np. "To Done wymaga completed subtasks"). Approval steps z `reviewerRole`, `slaHours`, escalation.
- **Automation engine**: Event bus (task.created, task.status_changed, decision.due_approaching) → rule evaluator → actions. Actions muszą być idempotentne, auditable (actor=system, reason=rule_id). Dry-run mode w UI.
- **Capacity model**: Tabela `resource_allocations` (resourceId, taskId, hours, period). Capacity endpoints zwracają utilization; conflict detection przy oversubscription. Time tracking: optional `time_entries` z integracją do cost rollups.

#### 5.3.1 Tasks + Decisions (deep dive — ClickUp/Asana/Monday/Wrike/Smartsheet)

**Benchmark notes (aligned with your prompt):**
- **ClickUp**: strict hierarchy (workspace → space → folder → list → task), heavy customization (custom fields, statuses), rich relations + dependencies, deep automations.
- **Asana**: projects + goals + timeline; dependencies/milestones as core; strong reporting and “from daily work → strategy” linking.
- **Monday.com**: Work OS modeled as **boards + columns + automations**; flexible schemas for business processes; cross-board relations and dashboards.
- **Wrike**: enterprise workflows + approvals; resource management; governance/reporting for large orgs.
- **Smartsheet**: spreadsheet-as-project plan; dependencies + critical path; program management; workflow automation on structured rows.

**As‑is verification anchors (code reality):**
- **MyWork Tasks UI**: `src/components/MyWork/MyTasksListContent.tsx`, `src/components/MyWork/TasksKanbanBoard.tsx`, `src/components/MyWork/TasksCalendarView.tsx`, `src/components/MyWork/TaskDetailView.tsx`
- **MyWork Decisions UI**: `src/components/MyWork/DecisionsPanelContent.tsx`, `src/components/MyWork/DecisionsKanbanBoard.tsx`, `src/components/MyWork/DecisionsTimelineView.tsx`, `src/components/MyWork/DecisionDetailView.tsx`
- **Dependencies UI**: `src/components/MyWork/shared/DependenciesSection.tsx` (FS/SS/FF/SF, lag, notes; add/edit/delete)
- **Backend**:
  - MyWork listing/triage: `GET /api/my-work/tasks`, `GET /api/my-work/decisions`, queue/snooze/preferences in `server/src/routes/my-work.routes.ts`
  - Task engine: `server/src/routes/pmo/tasks.routes.ts` (CRUD + `/search`, comments, assign/reassign/escalate, **`GET/POST/DELETE /api/tasks/:id/dependencies`**)

| Slice (tasks + decisions) | Benchmark (leaders) | As‑is (Consultify code) | V4 target (enterprise) | Gap | Proposal (epics) | Status | V4 Priority |
|---|---|---|---|---|---|---|---|
| 1) Information architecture (hierarchy) | ClickUp: workspace→space→folder→list→task; Asana: portfolios/projects; Monday: boards + groups; Smartsheet: sheets + reports. | MyWork provides personal views (table/kanban/calendar/timeline) and detail pages; PMO tasks exist as a separate engine (`/api/tasks`). | One coherent hierarchy/IA: program → initiative → workstream/list → tasks/subtasks; consistent navigation and filters across MyWork + PMO. | IA split between “MyWork” and “PMO tasks”; unclear canonical hierarchy and how tasks roll up to initiatives/programs. | **EPIC‑TASK‑03**: Unified task hierarchy + navigation model (program/initiative/list/subtask) with stable IDs and rollups. | GAP | P0 |
| 2) Custom fields / schema (boards/columns) | Monday/ClickUp: custom fields, field types, per-board schemas; Smartsheet: columns + formulas; Wrike: enterprise fields/governance. | Tables/filters exist in UI; but no explicit “custom fields schema” contract for Tasks is visible from the MyWork routes; task CRUD exists in `/api/tasks`. | Schema as first-class: field definitions per workspace/list/initiative; validated types; permissions; versioning and migration. | Missing explicit schema registry + governance; risk of ad-hoc fields per UI and inconsistent reporting. | **EPIC‑TASK‑01** (extend): Custom fields framework as platform contract (types + validation + permissions). **EPIC‑TASK‑07**: Schema versioning + migration + reporting compatibility. | GAP | P0 |
| 3) Workflow/status + approvals | Wrike: approvals workflows; ClickUp: custom statuses; Asana: approval tasks; Monday: status columns + automations. | Status/pills exist; Decisions have queue/snooze and reminder/escalation concepts; approvals exist conceptually (e.g. “Approvals & gates” in inbox taxonomy). | Configurable workflows per project/list: statuses + transitions + required fields; approval steps, sign-offs, and audit. | No explicit workflow engine/transition rules; approvals are not clearly modeled end-to-end for tasks/decisions. | **EPIC‑TASK‑01** (extend): Workflow engine (statuses, transitions, guards). **EPIC‑DEC‑02**: Decision/approval workflows (gates, reviewers, SLAs, escalation). **EPIC‑ENT‑APPROVAL‑01**: enterprise approval primitives. | GAP | P0 |
| 4) Dependencies, milestones, timeline, critical path | Asana/Smartsheet/Wrike: dependencies + milestones + Gantt/critical path; ClickUp: dependencies + workload; Monday: timeline/dependency columns. | Dependencies are real and fairly rich in UI (`DependenciesSection` FS/SS/FF/SF + lag + notes) backed by `/api/tasks/:id/dependencies`. Multiple views exist (calendar/timeline/kanban). | Enterprise scheduling: milestones, baseline snapshots, critical path, lead/lag, cross-project dependencies, timeline aggregation to initiatives/programs. | Missing explicit milestone objects + baseline/critical path; cross-project dependency governance and reporting unclear. | **EPIC‑TASK‑02** (extend): Dependencies + milestone model + critical-path/timeline aggregation. **EPIC‑EXEC‑02**: Program timeline views (initiative→task rollups + critical path). | GAP | P0 |
| 5) Automations / rules (business logic) | ClickUp/Monday/Smartsheet: rules/automations (triggers→conditions→actions), templates, webhooks, approvals. | There are notification triggers and “governance automation” shapes; but no explicit task automation rules engine is surfaced as a product feature. | Automation engine: event triggers (status/date/field change), conditions, actions (assign, notify, create subtask, escalate), safe RBAC + audit + dry-run. | Missing explicit user-configurable automation layer; “business process logic” can’t be expressed safely and consistently. | **EPIC‑TASK‑04**: Automation rules engine for tasks/decisions (UI + backend). **EPIC‑ENT‑AUDIT‑01**: audit for automated actions. | GAP | P0 |
| 6) Reporting, goals, and exec rollups | Asana: goals/portfolios; Monday/Smartsheet: dashboards; Wrike: reports & analytics; ClickUp: time/cost dashboards. | Executive dashboard exists for MyWork; initiative/results modules exist separately; tasks have list views with filters/saved views. | Unified reporting: goals/OKRs ↔ initiatives ↔ tasks; dashboards by program, owner, status, risk, SLA, capacity; export to reports/decks. | Goal/portfolio layer not clearly wired into tasks; cross-module reporting may be fragmented. | **EPIC‑TASK‑05**: Goals/portfolio layer + rollups into executive dashboards. **EPIC‑EXPORT‑01**: export packs for task/decision reporting into deliverables. | GAP | P1 |
| 7) Resource/capacity + time tracking | Wrike/ClickUp: workload, capacity, time tracking; Smartsheet: resource mgmt add-ons; Monday: workload view. | Team workload endpoints exist in MyWork; UI has “Team” panels; but capacity model is likely heuristic. | Real capacity model: skills, allocation, availability, time tracking, cost rates; resource conflict detection; staffing recommendations. | Missing time tracking and deterministic capacity model; workload planning not grounded in allocations. | **EPIC‑EXEC‑01** (extend): Workload model (capacity, allocation, skills). **EPIC‑TASK‑06**: Time tracking + cost rollups (permissioned). | GAP | P1 |
| 8) Enterprise controls (audit, retention, RBAC) | Leaders: audit logs, retention/legal hold, permissioned sharing, compliance exports. | Auth middleware + some governance concepts exist; but audit/policy layer is cross-cutting and incomplete. | Auditable tasks/decisions and automation actions; retention/legal hold; RBAC down to project/list; compliance exports. | Needs full audit/event stream + policy engine + admin controls. | **EPIC‑ENT‑AUDIT‑01**: audit logging (read/write/export + automation). **EPIC‑ENT‑POLICY‑01**: retention/legal hold/residency. | GAP | P0 |

---

### 5.4 Inbox + Focus + Executive (MyWork)

**Module snapshot**
- **As‑is**: Derived inbox + focus planning + executive rollups exist as a MyWork surface with dedicated backend endpoints (triage, bulk triage, signals, AI plan).
- **V4 target**: Enterprise-grade action queue + planning: canonical inbox item model, clear delegation + SLAs, explainable AI triage, and manager-grade signals with policy/audit.
- **Top gaps**:
  - Canonical inbox item schema (consistent types, lifecycle, audit, SLA).
  - External intake connectors (email/Slack/Teams) + routing policies.
  - AI triage governance: confidence thresholds, undo, evals, audited actions.
  - Strict UI standards compliance (table+preview parity, keyboard/A11y).
- **P0 epics**: EPIC‑INBOX‑01, EPIC‑FOCUS‑01, EPIC‑AI‑INBOX‑01, EPIC‑UX‑INBOX‑01, EPIC‑ENT‑AUDIT‑01

**Benchmark (closest patterns):**
- Work OS triage (ClickUp/Asana/Monday style “inbox + bulk actions”) + Outlook-style preview pane
- Signals/insights feed (enterprise “what needs attention” dashboards)

**SSOT anchors:**
- `docs/MYWORK_MODULE_SPECIFICATION.md` (Inbox/Focus/Executive sections)
- UI: `docs/ui-standards/UI_UX_CANON_V3.md` (Inbox=Action Queue, preview pane canon)

**As‑is anchors (code):**
- Frontend: `src/components/MyWork/InboxContent.tsx`, `src/components/MyWork/Focus/FocusView.tsx`, `src/components/MyWork/Executive/ExecutiveDashboard.tsx`, `src/components/MyWork/MyWorkHub.tsx`
- Backend: `server/src/routes/my-work.routes.ts` (`/inbox`, `/focus/*`, `/stats`, `/team-workload`, `/signals`, `/context-summary`)

| Area (5) | Benchmark (leaders) | As‑is (Consultify code) | V4 target (enterprise) | Gap | Proposal (epics) | Status | V4 Priority |
|---|---|---|---|---|---|---|---|
| 1) Capabilities | Unified action queue, bulk triage, delegation, snooze, smart sorting, “review next” flows, productivity lanes (Today/Week). | Backend supports derived inbox: `GET /api/my-work/inbox` + triage endpoints (`/inbox/:id/triage`, `/inbox/bulk-triage`, `/inbox/auto-triage`, `/inbox/ai-assist`). Focus persistence: `/focus/move`, `/focus/reorder`, `/focus/state`, `/focus/item`. | Enterprise-grade triage + focus planning with clear SLAs, delegation tracking, and team-level signals for managers. | Need hardening: consistent entity model for inbox items, SLA policies, delegation audit, advanced bulk ops, predictable UX across sections/view modes. | EPIC‑INBOX‑01: Inbox item canonical schema + audit. EPIC‑FOCUS‑01: Focus board v4 (capacity-aware planning, rules, shared templates). | GAP | P0 |
| 2) Integrations | Email/Slack/Teams intake, calendar-based focus, cross-module navigation consistency. | Chat context enrichment endpoint exists (`GET /api/my-work/context-summary`); signals endpoints exist (`/signals` + mute/snooze/dismiss). | Unified intake across channels (email/slack/teams/webhooks) with consistent triage + traceability. | Missing external intake connectors; missing org-level policies for notifications and routing. | EPIC‑INT‑INBOX‑01: Channel connectors (email/slack/teams) + routing rules. EPIC‑ENT‑POLICY‑02: notification/routing policies. | GAP | P1 |
| 3) AI enablement | AI auto-triage, daily briefs, predictive signals, “plan my day”, proactive nudges. | Backend has AI plan route for focus (`POST /api/my-work/focus/ai-plan`), signals feed, and per-tab prompts in UI. | Enterprise-grade AI with governance: explainable triage, controllable automation, measurable accuracy, cost controls. | Need evals and confidence gating; need consistent propose→accept for triage actions; need audit trail for AI-triggered actions. | EPIC‑AI‑INBOX‑01: AI triage proposals + confidence thresholds + undo. EPIC‑AI‑FOCUS‑01: Capacity-aware AI planning + explanations. EPIC‑AI‑GOV‑01: evals/cost controls/registry. | GAP | P0 |
| 4) UI/UX quality | Outlook-style preview, minimal clutter, strong keyboard shortcuts, consistent topbar + one command row. | MyWorkHub implements per-tab prompts and lazy loading; module hub pattern used. | Strict compliance to UI canon: preview pane default off, parity actions, no extra toolbars; density toggle for analytics screens. | Needs explicit compliance sweep: preview pane parity; remove any ad-hoc rows; ensure accessibility. | EPIC‑UX‑INBOX‑01: Inbox table+preview compliance. EPIC‑UX‑EXEC‑01: Executive readability + density toggle. | GAP | P0 |
| 5) Enterprise readiness | Team analytics, auditability, RBAC, retention. | Executive endpoints exist: `/stats` and `/team-workload` (simple rollup); signals prefs/snoozes/dismissals exist. | Full org-level analytics + permissioned insights + audit; manager/sponsor dashboards; retention policies. | Team workload currently uses heuristics; missing policy and audit framework. | EPIC‑ENT‑EXEC‑01: Executive analytics model (real capacity, initiatives linkage). EPIC‑ENT‑AUDIT‑01: Audit framework. EPIC‑ENT‑POLICY‑01: retention/legal hold. | GAP | P1 |

**Tasks do wdrożenia**
- [ ] Zdefiniować canonical inbox item schema: typy (task, decision, approval, signal), lifecycle, SLA fields, delegation
- [ ] Wdrożyć Focus board v4: capacity-aware planning, reguły (max items per day), shared templates, persistence
- [ ] Rozszerzyć AI triage: confidence score na każdą propozycję; threshold poniżej którego wymagana akceptacja; undo ostatniej AI triage
- [ ] Dodać evals dla AI triage (accuracy na golden set) + cost controls
- [ ] Ujednolicić Inbox table z App Table Standard; preview pane z parity actions vs detail view
- [ ] Wdrożyć connectors: email→inbox, Slack/Teams webhooks→inbox; routing rules (project/tag assignment)
- [ ] Zintegrować Executive analytics z real capacity (allocations) i initiatives linkage

**Plan pokrycia gapu**
- **Canonical inbox schema**: Jeden model — `inbox_items` jako **materialized view** (refresh on schedule) lub **derived query** z tasks/decisions/signals. Pola: `type` (task|decision|approval|signal), `entityId`, `entityType`, `dueAt`, `slaStatus`, `delegatedTo`, `orgId`, `userId` (dla personal queue). API triage: `POST /inbox/:id/triage` + `POST /inbox/bulk-triage` z body `{ action, reason? }`. Audit dla każdej triage action (bulk i single).
- **AI triage governance**: Propozycje AI zwracają `confidence` i `reasoning`. UI blokuje auto-apply gdy confidence < threshold (configurable). Undo = revert ostatniego batch. Eval: golden set 100+ items z expected triage; metryka accuracy.
- **Focus v4**: Persistence w DB (focus_items, ordering, lane). Reguły: "max 5 items Today", "no overload". Capacity-aware: sprawdzenie allocation przed dodaniem. Shared templates per team/org.
- **UI compliance**: Przegląd vs UI canon — preview pane default off, one command row, density toggle dla Executive. A11y: keyboard navigation, focus management.

---

## 6) Phase B–F — Remaining modules (deep dives below)

### 6.1 Interview + Research/Diagnostics

**Module snapshot**
- **As‑is**: Interview module is implemented end-to-end (templates, assignments, sessions, evidence, inference runs, exports with gating) and already feeds “company context”.
- **V4 target**: Full research/diagnostics engine: advanced survey logic + respondent UX + analytics dashboards + benchmark overlays, producing traceable outputs that drive Tools/Assessments/Initiatives.
- **Top gaps**:
  - Research-grade form engine constructs (branching/quotas/matrix/ranking) + respondent segmentation/cohorts.
  - Diagnostics dashboards (drivers/themes/trends) + benchmark packs ingestion and comparators.
  - Enterprise privacy/anonymity modes (cohort thresholds/redaction) + audited exports.
  - Evidence storage hardening (retention, scanning, access audit).
- **P0 epics**: EPIC‑INTV‑01, EPIC‑INTV‑02, EPIC‑INTV‑03, EPIC‑INTV‑04, EPIC‑DIAG‑01, EPIC‑DIAG‑03, EPIC‑ENT‑INTV‑02, EPIC‑ENT‑AUDIT‑01

**Benchmark leaders (from your list):** Qualtrics, SurveyMonkey, Typeform, Alchemer, CultureAmp

**SSOT anchors:**
- `docs/product/INTERVIEW_FORM_ENGINE_V3.md`
- `docs/product/LINK_GRAPH_V3.md` (evidence/links to system objects)
- UI: `docs/ui-standards/UI_UX_CANON_V3.md` + ModuleHub/Table/Preview standards

**As‑is anchors (code):**
- Frontend: `src/components/Interview/InterviewHub.tsx`, `src/components/Interview/InterviewWorkspace.tsx`, `src/components/Interview/TemplateBuilder.tsx`, `src/components/Interview/AssignInterviewModal.tsx`, `src/components/Interview/EvidencePanel.tsx`, `src/components/Interview/InsightViewer.tsx`
- Backend: `server/src/routes/interview.routes.ts`, `server/src/controllers/InterviewController.ts`

| Area (5) | Benchmark (leaders) | As‑is (Consultify code) | V4 target (enterprise) | Gap | Proposal (epics) | Status | V4 Priority |
|---|---|---|---|---|---|---|---|
| 1) Capabilities | Advanced survey logic (branching, quotas), rich question types (matrix/ranking), distribution + reminders, respondent UX, approvals, robust evidence attachments, dashboards/insight packs. | Full module with sessions, templates, assignments workflow + approvals (`/interview/assignments/*`); task-list style questions; evidence + notes + transcript routes; inference runs exist (`POST /interview/inference/run`). | Research/diagnostics engine: template versioning + approvals, assignment workflows, strong evidence capture, and structured outputs (facts → gaps → constraints → pain points) feeding Tools/Assessments/Initiatives. | “Research/Diagnostics” layer (analysis, dashboards, benchmarking) is limited; richer survey constructs (quotas/ranking) and enterprise distribution channels need formalization; file storage quality gates uncertain. | EPIC‑INTV‑01: Complete SSOT→implementation parity (question types incl. matrix/repeatable/ranking). EPIC‑INTV‑02: Distribution engine (channels, reminders, tracking, anonymity). EPIC‑INTV‑03: Evidence storage hardening (S3-like, scanning, retention). EPIC‑INTV‑04: Diagnostics outputs (benchmark dashboards + “evidence-to-recommendations” pipeline). | GAP | P0 |
| 2) Integrations | Data exports (CSV/SPSS), HRIS/SSO context, Slack/Teams notifications, linking to downstream work items. | Permission middleware in routes (`requirePermission`/`requireAnyPermission`); links possible via LinkGraph; notifications service used in controller; sessions are project/org scoped. | Integration surfaces: exports, webhooks, downstream linking to Tools/Assessments as context (never direct initiative source). | Missing standardized export packages; missing connector strategy for enterprise survey ingestion; missing cross-module backlink parity. | EPIC‑INTV‑INT‑01: Export packages + APIs for external BI. EPIC‑LINK‑01: Platform-wide embedded refs/backlinks parity (incl. Interview artefacts). EPIC‑INT‑NOTIF‑01: Slack/Teams notifications + routing policies. | GAP | P1 |
| 3) AI enablement | Text analytics (themes, sentiment), auto-coding, answer assistance, insight generation with governance; conversational forms. | Human-in-the-loop AI assist exists: `POST /interview/questions/:questionId/ai-suggest` and `POST /interview/sessions/:sessionId/ai-parse` (structured mapping from transcript to answers). | AI as diagnostics copilot: propose→accept for coding/themes; reproducible insight packs with citations; evaluation harness (accuracy/consistency). | Missing audit trail + evaluation; limited analytics (themes/sentiment/driver analysis); missing “research synthesis” across sessions. | EPIC‑AI‑INTV‑01: Thematic coding + structured insight generation (proposals). EPIC‑AI‑INTV‑02: Audit log + replay for AI suggestions. EPIC‑AI‑GOV‑01: evals/cost controls/registry. | GAP | P0 |
| 4) UI/UX quality | Frictionless respondent experience, strong progress narrative, premium template builder, clear review/approve flows, consistent table+preview. | InterviewHub uses ModuleHub patterns with table/grid and preview layout (`TableWithPreviewLayout`), dynamic tabs and modals; runtime mode selector exists in UI components. | Unified “enterprise survey UX”: fast for respondents, powerful for managers; strict UI standards compliance (no extra toolbars, consistent view modes, accessible keyboard). | Needs systematic compliance sweep vs UI standards; clarify “runtime mode truth” (task-list default, optional one-question mode). | EPIC‑UX‑INTV‑01: UI standards compliance sweep (tables/preview/topbar). EPIC‑UX‑INTV‑02: Respondent UX polish (accessibility, mobile, offline draft). | GAP | P0 |
| 5) Enterprise readiness | Anonymity modes, data retention, audit logs, SOC2-ready evidence handling, role-based access at scale. | Permissioned routes exist; org/project scoping present; evidence model includes file metadata fields. | Enterprise policies: retention/legal hold, audit events for access and exports, anonymization options per template/assignment, compliance reporting. | Policy engine and audit layer not fully present; anonymization modes need design; evidence retention needs integration with policy. | EPIC‑ENT‑AUDIT‑01: Audit logging framework (Interview access/exports). EPIC‑ENT‑POLICY‑01: retention/legal hold + residency. EPIC‑ENT‑INTV‑01: anonymization/privacy modes + governance. | GAP | P0 |

**Tasks do wdrożenia**
- [ ] Rozszerzyć question types: matrix, ranking, repeatable groups; branching (skip logic) + quotas; respondent segmentation
- [ ] Wdrożyć distribution engine: kanały (email/link), reminder scheduling, tracking (opened/started/completed), anonymity flags per template
- [ ] Zahardować evidence storage: S3-compatible, virus scanning, retention policy, access audit log
- [ ] Zbudować diagnostics dashboards: themes/sentiment/trends/segments, driver analysis, benchmark comparators (gdy EPIC‑BMK‑01 gotowy)
- [ ] Wdrożyć pipeline findings→recommendations→initiative program z traceability (insightId→initiativeId)
- [ ] Dodać anonymity modes: minimal cohort size, redaction rules, privacy-safe aggregation; export gating
- [ ] Rozszerzyć company context: versioning, confidence scoring, source citations (które interview sessions), reviewer sign-off

**Plan pokrycia gapu**
- **Research-grade form engine**: Rozszerzyć `interview_questions` o typy matrix/ranking/repeatable; tabela `question_branches` (condition→targetQuestionId). Quotas: `quota_rules` z maxPerSegment. Respondent segments: atrybuty (department, role) dla targetowania i analizy slice.
- **Diagnostics dashboards**: Nowy moduł/route `/api/interview/diagnostics` — agregacje themes, sentiment per question, trend over time. Driver analysis (CultureAmp-style): korelacja odpowiedzi z outcome. Benchmark packs: integracja z EPIC‑BMK‑01 gdy backend gotowy.
- **Evidence storage**: Migracja na S3/MinIO; ClamAV scan przed accept; retention policy z `evidence_retention_days` per org. Każdy read/export zapisywany w audit_log.
- **Privacy/anonymity**: Flagi `anonymous`, `minCohortSize` per template. Przy eksporcie/analizie — sprawdzenie cohort size; jeżeli < min → suppress lub aggregate. Redaction dla PII w odpowiedziach.

#### 6.1.1 Research / Diagnostics (deep dive — Qualtrics/SurveyMonkey/Typeform/Alchemer/CultureAmp)

**Benchmark notes (aligned with your prompt):**
- **Qualtrics / Alchemer**: enterprise survey logic (branching/quotas/segments), distribution at scale, dashboards, and standardized reporting packs.
- **SurveyMonkey**: “simple but scalable” survey builder + distribution + basic analytics.
- **Typeform**: best-in-class respondent UX (conversational flow, low friction, mobile-first completion).
- **CultureAmp**: turning diagnosis into actions (themes → drivers → recommended actions), benchmarking, and manager-ready dashboards.

**As‑is verification anchors (code reality):**
- **Distribution + reminders**: assignments workflow + reminder route (`POST /interview/assignments/:id/remind`) in `server/src/routes/interview.routes.ts` + UI actions in `src/components/Interview/InterviewHub.tsx`.
- **Company learning (“AI uczy się firmy”)**: org context endpoints (`GET/PUT /interview/context`) backed by `organization_context` updates in `server/src/controllers/InterviewController.ts`; surfaced via `InterviewWorkspace.tsx` + `InterviewContextBanner.tsx`.
- **Diagnostics artifacts**:
  - Inference runs: `POST /interview/inference/run` + runs list/status.
  - Insight packs: `GET/POST/PATCH/DELETE /interview/insights` + activity + comments.
  - Insight UI shows patterns/themes and quote sentiment filters in `src/components/Interview/InsightViewer.tsx`.
- **Export gating**: `POST /interview/sessions/:sessionId/export` and `POST /interview/insights/:id/export` (approval/completion gates) in `InterviewController.exportContext/exportInsight`.

| Slice (research/diagnostics) | Benchmark (leaders) | As‑is (Consultify code) | V4 target (enterprise) | Gap | Proposal (epics) | Status | V4 Priority |
|---|---|---|---|---|---|---|---|
| 1) Survey logic + question system | Qualtrics/Alchemer: complex branching, quotas, matrix/ranking, respondent segments; SurveyMonkey simpler set. | Strong template/assignment/session engine; “task-list style” questions; conversational transcript route exists; richer constructs are noted as incomplete in the base 6.1 table. | Full research-grade form engine: branching + quotas + sections, matrix/ranking, respondent segments, and versioned templates. | Advanced logic and segments not formalized; “research constructs” not guaranteed end-to-end. | **EPIC‑INTV‑05**: Research-grade question logic (branching/quotas/matrix/ranking) + validator contracts. **EPIC‑INTV‑06**: Respondent segmentation model (attributes, cohorts, sampling). | GAP | P0 |
| 2) Respondent UX (completion rate) | Typeform: conversational, one-question-at-a-time, polished transitions, mobile-first. | Conversational transcript exists; InterviewHub/Workspace UX exists, but “Typeform-level” completion flow is not clearly the default. | Dedicated respondent runtime: conversational mode with progress narrative, autosave/offline drafts, minimal chrome, accessibility and mobile polish. | Missing explicit “respondent UX runtime” contract; unclear offline-first behavior; friction may still be higher than Typeform. | **EPIC‑UX‑INTV‑03**: Respondent runtime (Typeform-level) + mobile/A11y + offline drafts. | GAP | P1 |
| 3) Diagnostics analytics + dashboards | Qualtrics/CultureAmp: dashboards, benchmarks, drivers, segmentation, trend views, manager-ready reporting. | InsightViewer provides themes/patterns + quote sentiment; inference runs exist; but no explicit dashboard/benchmark/driver-analysis layer is visible as a dedicated module surface. | Diagnostics module: theme/sentiment + driver analysis, segmentation slices, benchmarking overlays, trend over time, and exportable dashboards per project/org. | Missing driver analysis, benchmark packs, trends, and “manager dashboard” UX. | **EPIC‑DIAG‑01**: Diagnostics dashboards (themes/sentiment/trends/segments). **EPIC‑DIAG‑02**: Driver analysis + action recommendations (CultureAmp-like). **EPIC‑DIAG‑03**: Benchmark pack ingestion + comparators. | GAP | P0 |
| 4) From diagnosis → actions (initiatives) | CultureAmp: recommendations mapped to actions; owners, timelines, follow-ups, re-measurement loops. | Exports exist (context/insight → Tools/Assessment) with gating; initiatives pipeline exists elsewhere. | Deterministic “insight → recommendation → initiative program” pipeline with traceability, ownership, and re-measurement schedules. | Missing standardized mapping contract from diagnostics findings into initiatives (and back). | **EPIC‑DIAG‑04**: Findings → recommendations → initiative program generator (traceable). **EPIC‑LINK‑01**: backlinks parity “Used in” for findings across modules. | GAP | P0 |
| 5) Data export + enterprise analytics | Qualtrics: export packs (CSV/SPSS), APIs, BI-friendly models. | Insight/context export exists to internal targets; no explicit CSV/SPSS/BI export contract anchored here. | Export packages: CSV/XLSX + APIs, privacy-safe aggregation, permissioned access for BI and partners. | Missing standardized export formats (CSV/SPSS) and stable analytics APIs; governance needed. | **EPIC‑DIAG‑05**: Export packs (CSV/XLSX/SPSS-like) + BI API. **EPIC‑ENT‑AUDIT‑01**: audit for exports. | GAP | P1 |
| 6) “Company memory” quality + governance | Enterprise leaders: org knowledge baselines, confidence, freshness, traceability, reviewer sign-off. | Organization context exists with `completenessPercent` and “open gaps”; export gating prevents premature use. | Company knowledge graph: versioned context snapshots, confidence scoring, source citations (which interviews), reviewer sign-off, and freshness/retention policies. | Needs citations + confidence model + versioning; needs auditability and policy integration. | **EPIC‑DIAG‑06**: Company context versioning + citations + confidence scoring. **EPIC‑ENT‑POLICY‑01**: retention/legal hold/residency for research data. | GAP | P0 |
| 7) Privacy/anonymity & enterprise controls | CultureAmp/Qualtrics: anonymity modes, minimum group sizes, privacy-safe reporting. | Permissions exist; anonymity modes called out as missing in base 6.1. | Anonymity modes + minimum cohort sizes + redaction; audit, retention; policy controls per org/project. | Needs full privacy model for research/diagnostics outputs and exports. | **EPIC‑ENT‑INTV‑02**: Anonymity modes + cohort thresholds + redaction (research-safe). **EPIC‑ENT‑AUDIT‑01**: audit events for access/export. | GAP | P0 |

### 6.2 Consulting Tools / Templates

**Module snapshot**
- **As‑is**: Tool library + ToolSessions workflow exists (review/approve/send-back, initiative generation) with real interactive tool runtimes in UI.
- **V4 target**: One coherent “Consulting Tools” product: library → templates/workspaces → sessions → outputs → initiatives, with traceability as a hard rule and enterprise entitlements for licensed packs.
- **Top gaps**:
  - Consolidation of legacy tool shells + strict runtime contracts (typed I/O + DoD checks + deterministic exports).
  - Template operations at scale (curation, versioning, ownership, quality gates).
  - Realtime facilitation/collaboration for sessions (presence→CRDT) where workshops are expected.
  - Evidence-grounded AI suggestions with citations + replay + evals per tool.
- **P0 epics**: EPIC‑TOOLS‑01, EPIC‑TOOLS‑02, EPIC‑TOOLS‑04, EPIC‑TRACE‑01, EPIC‑ENT‑ENTITLE‑01, EPIC‑ENT‑RT‑01, EPIC‑AI‑TOOLS‑03

**Benchmark leaders (from your list):** Strategyzer, Miro (framework templates), Cascade Strategy, Lucidchart (VSM), Kumu

**SSOT anchors:**
- `docs/product/TOOLS_CATALOG_V3.md`
- `docs/product/CONSULTING_TOOLS_V3.md`
- `docs/product/CONSULTING_TOOLS_TOOL_SPECS_V3.md`
- `docs/product/SOURCE_TRACEABILITY_SPEC.md`
- `docs/product/LINK_GRAPH_V3.md`

**As‑is anchors (code):**
- Frontend (Discovery/Tools surfaces): `src/components/DiscoveryTools/ToolWizardView.tsx`, `src/components/DiscoveryTools/ToolDocumentView.tsx`, `src/components/DiscoveryTools/ToolWorkspace.tsx`, `src/components/DiscoveryTools/KnownToolDetailView.tsx`, `src/components/DiscoveryTools/KnownToolPreviewV3.tsx`
- Backend (sessions + library): `server/src/routes/tools.routes.ts` (ToolSessions workflow), `server/src/routes/knownTools.routes.ts` + `server/src/controllers/KnownToolsController.ts` + `server/src/services/KnownToolsService.ts`

| Area (5) | Benchmark (leaders) | As‑is (Consultify code) | V4 target (enterprise) | Gap | Proposal (epics) | Status | V4 Priority |
|---|---|---|---|---|---|---|---|
| 1) Capabilities | Rich tool libraries with curated frameworks, templates, training content; repeatable sessions; output packs; methodology guidance; VSM/system maps as first-class. | Tool sessions API exists (`POST/GET/PUT /api/tools` + review/approve/send-back + generate initiatives). Library endpoints exist for known tools (`GET /api/known-tools`). ToolDocumentView provides a “full tool document” surface incl. PDF export and initiative generation UI. | One coherent “Consulting Tools” module: Library → Sessions → Outputs → Initiatives; consulting templates run on a universal Workspace engine; content completeness enforced (when-to-use, steps, outputs, KB, preview graphic, micro-video). | Content completeness + governance enforcement likely partial; “templates on workspace engine” needs full coverage; VSM/system map runtime needs polishing; methodology packs/licensing not fully modeled. | EPIC‑TOOLS‑01: Unify Tools module navigation and mental model across legacy surfaces. EPIC‑TOOLS‑02: Consulting Templates library (workspace templates) with deterministic contracts + DoD checks. EPIC‑TOOLS‑03: Methodology Pack model (licensed tools) + entitlement governance. | GAP | P0 |
| 2) Integrations | Export to deliverables (reports/decks), embedding into initiatives, backlinks, external KB links. | Tool sessions include workflow endpoints for approval + initiative generation; ToolDocumentView has PDF export; traceability described in SSOT and implemented in parts of platform. | Full traceability: ToolSession is canonical source; outputs always reference it; LinkGraph shows “Used in”; deliverables can embed tool blocks with live metadata. | Cross-module parity for traceability/backlinks likely uneven; export/share needs unification and quality gates. | EPIC‑TRACE‑01: Enforce traceability at API boundaries for all outputs. EPIC‑LINK‑01: Embedded refs + backlinks parity across tool artefacts and outputs. EPIC‑EXPORT‑01: Unified export/share contracts for tools/reports/decks. | GAP | P0 |
| 3) AI enablement | AI-assisted framework filling, hypothesis generation, prioritization, scenario modelling; “propose→accept” edits; knowledge-grounded suggestions. | Tool AI hooks exist in UI (`useToolAI`); tools have structured steps; initiative generation flow exists; backend has AI stack elsewhere. | AI co-pilot per tool: structured proposals per step, citations to KB + evidence, audit logs + replay, model registry + evals. | Missing systematic per-tool evals/audit; knowledge/RAG grounding across tool packs not fully standardized. | EPIC‑AI‑TOOLS‑01: Structured AI proposals + partial accept per tool step. EPIC‑AI‑TOOLS‑02: Tool knowledge bank + scoped RAG with citations. EPIC‑AI‑GOV‑01: evals/cost controls/registry. | GAP | P0 |
| 4) UI/UX quality | “Quiet luxury” methodology UX, consistent wizard/workspace/document shells, preview pane for library, keyboard speed. | ToolDocumentView is positioned as canonical document view; multiple discovery tool components exist (wizard steps, workspace, previews). | Consolidated UI standard for tools: one module hub + standard preview + consistent detail shells; no duplicated toolbars; accessibility baseline. | Need consolidation of legacy tool surfaces; standardize library preview and session list UI. | EPIC‑UX‑TOOLS‑01: Consolidate tool shells (wizard/document/workspace) and remove duplicates. EPIC‑UX‑TOOLS‑02: App table + preview standards across Tools collections. | GAP | P1 |
| 5) Enterprise readiness | Governance, approvals, audit logs, licensing/entitlements, retention, multi-tenancy. | Review/approve/send-back endpoints exist for tool sessions; auth middleware used. | Enterprise governance: approvals, audit logs, role-based access, entitlements for licensed packs, retention/legal hold for deliverables. | Audit/policy layers not fully present; entitlements not formalized end-to-end. | EPIC‑ENT‑AUDIT‑01: Audit framework. EPIC‑ENT‑ENTITLE‑01: Licensing/entitlements + policy enforcement. EPIC‑ENT‑POLICY‑01: retention/legal hold/residency. | GAP | P0 |

**Tasks do wdrożenia**
- [ ] Ujednolicić nawigację Tools: jeden module hub, spójna lista sessions/library, standard preview
- [ ] Zdefiniować framework runtime contract: typed I/O (inputs/outputs per step), DoD gates, deterministic export package
- [ ] Rozszerzyć bibliotekę templates: SWOT/PESTLE/Porter/Journey/BCG/OKR; org-curated packs, versioning, ownership
- [ ] Wdrożyć facilitation layer: timer, voting z per-user identity, session roles (facilitator/participant), exportable outcomes
- [ ] Zintegrować realtime (EPIC‑ENT‑RT‑01): presence + multi-user editing dla tool sessions
- [ ] Wdrożyć Tool knowledge bank + scoped RAG: citations do interviews/notes/evidence przy AI proposals
- [ ] Wdrożyć entitlement model: licensed packs per org, policy enforcement (who can use which tool)

**Plan pokrycia gapu**
- **Runtime contract**: Każdy tool type ma JSON schema dla `inputs` i `outputs`; przed "complete" sprawdzane są wymagane pola (DoD). Export generuje pakiet (PDF + structured JSON) z wersją schematu. Traceability: ToolSession zawsze ma sourceRef do initiative/assessment.
- **Template ops**: Tabela `consulting_templates` z `orgId`, `version`, `publishedAt`, `ownerId`. UI do publish/deprecate. Guided setup: kroki (SWOT → uzupełnij 4 ćwiartki → AI suggests) z checkpointami.
- **Facilitation**: Session ma `facilitatorId`; timer/voting zapisuje do shared state (CRDT). Voting results: `{ optionId, userId, timestamp }` — persistowane, eksportowalne. Outcomes: obiekty Cluster/Summary z linkami do stickies.
- **AI governance**: Propozycje AI per step zapisywane z diff; partial accept wspierane. Citations do artifact IDs (interview session, note page, tool output). Eval harness per tool type (golden scenarios).

#### 6.2.1 Consulting frameworks + AI (deep dive — Strategyzer/Miro/Cascade/Lucidchart/Kumu)

**Benchmark notes (aligned with your prompt):**
- **Strategyzer**: frameworks as *interactive products* (Canvas, Value Proposition) with reusable building blocks, exports, and a strong “analysis → initiative ideas” motion.
- **Miro (framework templates)**: facilitation-first templates library (SWOT/PESTLE/Porter/Journey), real-time collaboration, clustering/voting, and conversion into structured outcomes.
- **Cascade Strategy**: strategy→goals→initiatives→KPIs, alignment and reporting; the “strategy execution” spine.
- **Lucidchart (VSM/process)**: diagram tooling maturity: shapes/stencils, connectors, layout, data-linked diagrams, enterprise governance, exports.
- **Kumu (system mapping)**: network/system maps (ecosystems, forces, stakeholders) with rich relationships, attributes, and analysis overlays.

**As‑is verification anchors (code reality):**
- **Framework library**: seeded tools include **Dynamic SWOT**, **Market Forces (Porter)**, and **VSM Builder** in `server/src/services/KnownToolsService.ts`.
- **Interactive tool runtime**: tool types and data models (SWOT items/correlations, Porter forces) in `src/store/useToolStore.ts`; step-based workspace orchestrator in `src/components/DiscoveryTools/ToolWorkspace.tsx`.
- **Porter implementation**: per-force scoring/drivers UI in `src/components/DiscoveryTools/tools/MarketForces/ForceStep.tsx`.
- **AI inside tools**: structured system prompts + JSON extraction in `src/hooks/discovery/useToolAI.ts` (incl. initiative drafts).
- **ToolSessions workflow → initiatives**: `server/src/routes/tools.routes.ts` (`POST /api/tools/:toolId/generate-initiatives`, review/approve/send-back), surfaced in `ToolDocumentView.tsx` / `ToolWorkspace.tsx`.

| Slice (consulting tools) | Benchmark (leaders) | As‑is (Consultify code) | V4 target (enterprise) | Gap | Proposal (epics) | Status | V4 Priority |
|---|---|---|---|---|---|---|---|
| 1) Frameworks as interactive tools (not slides) | Strategyzer: structured blocks + guardrails; reusable canvases; consistent exports. | Frameworks are real interactive sessions (SWOT/Porter/VSM etc.) with step flows and stored session state. | “Framework runtime contract”: every tool has typed inputs/outputs, quality gates, deterministic exports, and stable embedding into reports/decks. | Consistency of tool contracts across many tool types; DoD validation + export packaging not fully enforced. | **EPIC‑TOOLS‑04**: Framework runtime contracts (typed I/O + DoD gates + export packs). **EPIC‑EXPORT‑01**: Unified export/share contracts (tools→reports/decks). | GAP | P0 |
| 2) Templates library + scale (catalog) | Miro: huge template library + search + tagging; org curation; duplication-with-variants. | Known tools exist + UI surfaces exist; templates breadth is still limited vs leaders. | Large curated library: SWOT/PESTLE/Porter/Journey/Value Chain/BCG/OKR etc., with versions, localization, and org-curated packs. | Missing breadth + “template ops” (curation, lifecycle, quality checks, ownership). | **EPIC‑TOOLS‑02** (extend): Consulting Templates library with deterministic contracts + DoD. **EPIC‑TOOLS‑05**: Template ops (curation, versioning, ownership, quality checks). | GAP | P1 |
| 3) Facilitation + realtime collaboration | Miro: realtime cursors, voting, timers, facilitation mode, comments. | Tools are mostly single-user flows; realtime is a cross-cutting gap across the platform. | Realtime collaboration for tool sessions: presence + multi-user editing where appropriate; facilitation widgets; session roles (facilitator/participant). | Missing CRDT/presence backend; facilitation primitives not standardized across Tools. | **EPIC‑ENT‑RT‑01**: realtime collab baseline. **EPIC‑TOOLS‑FACIL‑01**: facilitation layer for Tools (voting/timers/roles) and exportable outcomes. | GAP | P0 |
| 4) Strategy execution spine (goals → initiatives → KPIs) | Cascade: objectives/OKRs/scorecards tied to initiatives and progress reporting. | Tools can generate initiative drafts and route into Initiatives module; strategy spine exists elsewhere but is not “native” to each framework outcome. | End-to-end: tool outcome → goals/OKRs hypotheses → initiatives → KPIs, with traceability and reporting loops. | Missing explicit goals/OKR layer binding tool outcomes to execution; inconsistent rollups. | **EPIC‑TOOLS‑CASCADE‑01**: Tool outcomes → goals/OKRs + initiative program linkage (traceable). **EPIC‑TASK‑05**: Goals/portfolio rollups (shared). | GAP | P0 |
| 5) VSM/process diagrams maturity | Lucidchart: rich diagram engine, stencils, data binding, exports; VSM specifically: timeline, metrics, current/future state, collaboration. | **VSM Builder** exists as a tool type; platform also has VSM generation logic in Idea Workspace AI services. | Enterprise VSM: current/future state workflows, metrics validation, timeline/PCE, exports to initiative waves and KPI baselines; diagram interoperability (SVG/Visio). | Needs hardened diagram engine for VSM and deterministic export semantics; interoperability exports incomplete. | **EPIC‑TOOLS‑VSM‑01**: VSM Builder v4 (current/future state + metrics + export). **EPIC‑TOOLS‑VSM‑02**: Diagram interoperability (SVG + enterprise exports). | GAP | P0 |
| 6) System mapping (ecosystems, forces, relationships) | Kumu: network maps with rich edge types, attributes, overlays, analysis. | We have LinkGraph concept and some ecosystem-related analytics elsewhere, but not a dedicated “Kumu-like” system map tool in Consulting Tools. | System maps as first-class consulting tool: nodes/edges/attributes, overlays (influence, risk, value flows), and conversion to initiatives/risks. | Missing a dedicated system-mapping runtime + data model; missing analysis overlays and enterprise exports. | **EPIC‑TOOLS‑SYS‑01**: System Mapping tool (Kumu-like) on top of platform LinkGraph + canvas runtime. | GAP | P1 |
| 7) AI co-thinker with governance | Leaders add AI summaries, but enterprise needs audit, citations, “propose→accept”. | AI prompts exist per tool; initiative drafts are generated; but audit/evals/citations are cross-cutting gaps. | Governed AI per framework: citations (to interviews/notes/evidence), diffs, replayable runs, evaluation harness per tool. | Missing per-tool audit/evals and evidence-grounding; risk of “pretty but untraceable” outputs. | **EPIC‑AI‑TOOLS‑03**: Evidence-grounded AI for Tools (citations + diffs + replay). **EPIC‑AI‑GOV‑01**: evals/cost controls/registry. **EPIC‑ENT‑AUDIT‑01**: audit trail for AI + exports. | GAP | P0 |

### 6.3 Assessments

**Module snapshot**
- **As‑is**: Multi-framework assessment workbench exists with strong report templates and hard-gated initiative generation; evidence service and stage gates exist.
- **V4 target**: Enterprise assessment platform: consistent engine across packs (SIRI/ADMA/DRD/VDA/ISO), evidence-first scoring, benchmark overlays, audited approvals, and deterministic exports + initiative programs.
- **Top gaps**:
  - Benchmarking backend is not configured (real blocker for enterprise “compare to peers”).
  - Pack versioning/schema normalization (reduce drift/legacy duplication) and ISO/VDA audit-native workflows (findings→CAPA).
  - Evidence governance (access audit, retention/legal hold) enforced platform-wide.
  - Governed AI scoring/initiative generation with citations + eval harness.
- **P0 epics**: EPIC‑ASMT‑01, EPIC‑ASMT‑02, EPIC‑ASMT‑03, EPIC‑ASMT‑04, EPIC‑ASMT‑06, EPIC‑ASMT‑07, EPIC‑AI‑ASMT‑01, EPIC‑ENT‑AUDIT‑01

**Benchmark leaders (from your list):** iBase‑t / SIRI platforms, ADMA Scan platforms, Deloitte Digital Maturity tools, VDA assessments (e.g. VDA 6.3), ISO compliance platforms (e.g. ISMS.online)

**SSOT anchors:**
- `docs/product/ASSESSMENT_WORKBENCH_STANDARD_V3.md`
- `docs/product/SIRI_ASSESSMENT_PACK_V3.md`
- `docs/product/DRD_ASSESSMENT_PACK_V3.md`
- `docs/product/SOURCE_TRACEABILITY_SPEC.md` (Assessment Report as canonical initiative source)

**As‑is anchors (code):**
- Frontend: `src/components/assessment/AssessmentModuleHub.tsx`, `src/components/assessment/AssessmentToolShell.tsx`, `src/components/assessment/drd/DRDAssessmentEditor.tsx`, `src/components/assessment/siri/SIRIAssessmentEditor.tsx`, `src/components/assessment/adma/ADMAAssessmentEditor.tsx`, `src/components/assessment/reports/templates/SIRIReportTemplate.tsx`
- Backend: `server/src/routes/assessment/index.ts` (subroutes), `server/src/controllers/AssessmentController.ts`, `server/src/services/assessmentService.ts`, `server/src/services/assessmentReportService.ts`, `server/src/services/AssessmentEvidenceService.ts`

| Area (5) | Benchmark (leaders) | As‑is (Consultify code) | V4 target (enterprise) | Gap | Proposal (epics) | Status | V4 Priority |
|---|---|---|---|---|---|---|---|
| 1) Capabilities | Full assessment lifecycle: scoped sessions, evidence discipline, scoring, benchmarking overlays, audit, and report→program outputs. | Strong v3-oriented workbench exists (hub + map + reports + initiatives). Backend controller describes gate workflow and initiative generation constraints; SSOT defines common workbench workflow and DoD. | Enterprise assessment platform: multi-framework engine with consistent workbench UX, versioned scoring, “current vs target” gaps, evidence-first, and deterministic exports (report/deck) with initiative program generation. | Need to unify and harden multi-framework consistency; ensure canonical mapping to “Assessment Report” as source; remove legacy route duplication and lock down data contracts. | EPIC‑ASMT‑01: Normalize assessment domain model (session/report/version). EPIC‑ASMT‑02: Score freeze + version diff + audit evidence completeness gates. EPIC‑ASMT‑03: Multi-framework orchestration (SIRI/ADMA/DRD/VDA/ISO packs). | GAP | P0 |
| 2) Integrations | Benchmark databases, evidence integrations (files, systems), compliance exports, partner ecosystems. | Evidence service/routes exist; external assessment routes exist in backend; report/deck templates exist in UI. | Partner-ready assessment ingestion + evidence connectors + compliance export packages; link to initiatives/execution/results seamlessly. | External benchmarking data ingestion and partner interfaces need formalization; evidence connectors beyond uploads/links need design. | EPIC‑ASMT‑INT‑01: External benchmarks ingestion + mapping. EPIC‑ASMT‑PARTNER‑01: Partner APIs for frameworks/packs. EPIC‑LINK‑01: LinkGraph parity across assessment artefacts. | GAP | P1 |
| 3) AI enablement | Assisted scoring with explanations, evidence suggestions, gap prioritization, initiative generation, narrative generation for reports/decks. | Assessment controller references audit logger; services include AI report generator helpers; workbench standard mandates “chat coach” and propose→accept. | AI as assessment copilot: propose scoring + missing evidence requests; generate initiatives with traceability; explainable and audited; evaluated for consistency. | Need consistent propose→accept surfaces everywhere; missing unified audit trail of AI suggestions; evals/cost controls per framework. | EPIC‑AI‑ASMT‑01: AI scoring proposals + evidence gap detection. EPIC‑AI‑ASMT‑02: Initiative program generator (waves, dependencies, KPIs) with partial accept. EPIC‑AI‑GOV‑01: evals/cost controls/registry. | GAP | P0 |
| 4) UI/UX quality | Highly guided workbench UX, clear navigation, consistent maps, easy exports, reviewer dashboards. | AssessmentModuleHub provides 4-tab hub; ToolShell split layout; editor maps exist per framework; workflow status bar exists. | Unified workbench standard across frameworks (no “special cases”), consistent reviewer flows, and export/share polish aligned with Reports/Deck generators. | Needs ongoing consolidation of multiple assessment route generations; ensure UI standards compliance (tables/preview) in hub surfaces. | EPIC‑UX‑ASMT‑01: Workbench UX compliance sweep + consolidation. EPIC‑UX‑ASMT‑02: Reviewer & audit UX hardening (diff, evidence, sign-off). | GAP | P0 |
| 5) Enterprise readiness | Auditability, compliance, retention, evidence security, role-based approvals, legal notices (SIRI). | Assessment workflow includes gated approvals and audit logger; permissions service exists; SIRI pack includes legal notice requirement. | Enterprise assessment governance: signed approvals, audit logs, retention/legal hold, secure evidence storage, partner entitlements. | Policy engine and immutable audit trail need to be platform-wide; evidence retention and access logging must be enforced. | EPIC‑ENT‑AUDIT‑01: Audit framework (incl. evidence access). EPIC‑ENT‑POLICY‑01: retention/legal hold/residency. EPIC‑ENT‑ENTITLE‑01: methodology pack entitlements/licensing. | GAP | P0 |

**Tasks do wdrożenia**
- [ ] Uruchomić i skonfigurować benchmark backend: `/api/benchmark/compare`, datasets ingestion, cohort privacy rules (min size, suppress)
- [ ] Zunifikować assessment domain model: session→report→version; usunąć legacy route duplication
- [ ] Wdrożyć score freeze + version diff + evidence completeness gates (blokada initiative generation bez pełnej evidence)
- [ ] Rozszerzyć VDA/ISO: findings/nonconformities object model, clause-level evidence mapping, CAPA workflow
- [ ] Zahardować evidence: clause mapping, access audit (każde otwarcie pliku), retention integration z policy engine
- [ ] Wdrożyć AI scoring proposals z citations do answers/evidence; eval harness per framework
- [ ] Dodać report version diff UX + reviewer sign-off workflow

**Plan pokrycia gapu**
- **Benchmark service**: Backend `/api/benchmark/compare` przyjmuje framework, subject (assessment ID), peerGroup (industry/region/size). Zwraca percentiles, cohort size, suppressed jeśli < min. Datasets: tabela `benchmark_datasets` + `benchmark_datasets_versions`; ingestion job. Privacy: nigdy raw peer list, tylko agregaty.
- **Benchmark seed (R0 minimum)**: Aby uniknąć 503: (a) syntetyczny dataset z CSV seed (np. SIRI/ADMA percentiles) **lub** (b) mock API zwracające 200 z przykładowymi percentiles. Pełny pipeline ingestion w R1. Szczegóły: V4_IMPLEMENTATION_PROGRAM sekcja 2.5 Risks.
- **Evidence discipline**: Każdy score/finding ma `evidence_ids[]`. Evidence: S3 path, scan status, access_log. Clause mapping dla ISO/VDA: `finding.clauseId` → evidence. Audit: każde `GET /evidence/:id` zapisuje event.
- **CAPA engine**: Obiekt `finding` z `correctiveActions[]` (owner, dueDate, verificationSteps). Workflow: proposed → in progress → verified → closed. Re-audit scheduling: `nextAuditDate` obliczane z policy.
- **Pack versioning**: `assessment_packs` ma `version`; migracje przy zmianie question bank. Usunięcie duplikatów routów (np. /siri vs /assessment/siri) na rzecz jednego `/assessment/:packType/:id`.

#### 6.3.1 Assessments (deep dive — SIRI/ADMA/Deloitte/VDA/ISO)

**Benchmark notes (aligned with your prompt):**
- **SIRI / iBase‑t class platforms**: structured maturity model + scoring across many dimensions; strong visualizations (3 blocks/16D), benchmark comparisons, and prioritization matrix; outputs become transformation roadmap.
- **ADMA Scan**: multi-area industrial maturity → transformation map; report points to concrete improvement areas and sequencing.
- **Deloitte maturity platforms**: questions mapped to recommendations; board-ready reports; repeatable re-assessments and progress tracking.
- **VDA 6.3 tools**: audit style (process-level questions) → findings → CAPA (corrective action plan), evidence discipline, auditor workflows and sign-off.
- **ISO compliance platforms (ISMS.online)**: clause-based checklists + document control + evidence links + audit trails + continuous compliance monitoring.

**As‑is verification anchors (code reality):**
- **Workflow + gating + initiatives**: `server/src/controllers/AssessmentController.ts`:
  - report approval is enforced (`assessment_reports` status + `report_approved_at`)
  - assessment approval lifecycle + send-back is recorded as decisions
  - initiative generation is hard-gated (`status === 'APPROVED'` + DoD + `count <= 7`) and writes `assessment_initiative_batches` + links.
- **Report templates**: `src/components/assessment/reports/templates/SIRIReportTemplate.tsx` (3 blocks/8 dimensions/prioritisation heatmap/gap+recommendations/legal notice); ADMA/CMMI templates also exist.
- **Benchmark UI exists**: `src/components/assessment/MultiFwBenchmarkComparison.tsx` expects `/api/benchmark/compare`, but **backend `server/src/routes/benchmark.routes.ts` is currently not configured (503)** → this is a real enterprise gap for SIRI/ADMA/Deloitte style benchmarking.
- **Versioning + remediation UX**: `src/components/assessment/AssessmentVersionHistory.tsx`, `src/components/assessment/InitiativeGeneratorWizard.tsx` (select gaps → constraints → AI charter preview).
- **AI assistance endpoints**: `server/src/routes/assessment/assessment-ai.routes.ts` provides AI suggestions (evidence/justification etc.) via `aiAssessmentPartnerService`.
- **Stage-gate UX**: `src/components/assessment/modals/StageGateModal.tsx` calls `/api/stage-gates/*` for readiness gates (shared governance layer).

| Slice (assessment platforms) | Benchmark (leaders) | As‑is (Consultify code) | V4 target (enterprise) | Gap | Proposal (epics) | Status | V4 Priority |
|---|---|---|---|---|---|---|---|
| 1) Multi-framework engine (SIRI/ADMA/DRD/VDA/ISO packs) | Leaders: multiple packs with consistent engine, clause/question versioning, and comparable scoring. | Multiple frameworks exist in UI + backend; AssessmentController supports types (`DRD/SIRI/ADMA/CMMI/LEAN`), reports, and initiative batches. | One assessment engine with pluggable packs: versioned question banks, scoring rules, mappings, and comparable outputs across packs. | Gaps for VDA/ISO-style clause findings and audit workflows; pack governance/versioning needs consolidation. | **EPIC‑ASMT‑03** (extend): Multi-pack orchestration incl. VDA/ISO packs. **EPIC‑ASMT‑08**: Pack versioning + schema normalization (remove legacy route duplication). | GAP | P0 |
| 2) Scoring + benchmark comparisons | SIRI/ADMA/Deloitte: benchmarks (industry/region/size), percentiles, radar/heatmaps, prioritization matrices. | Rich visualizations exist (SIRI heatmap etc.) and a benchmark comparison UI exists, but backend benchmark service is not configured. | Benchmark-ready analytics: configured benchmark datasets, percentile computation, disclaimers, cohort sizing, and privacy-safe aggregation. | **Benchmark backend is stubbed** (503); no ingestion/refresh pipeline for benchmarks; cohort privacy rules not formalized. | **EPIC‑ASMT‑04**: Benchmark service (datasets + ingestion + `/api/benchmark/compare` contract) + cohort privacy rules. | GAP | P0 |
| 3) Evidence discipline (audit-grade) | VDA/ISO: evidence linked to findings/clauses, attachments, audit trails, reviewer sign-off; eDiscovery. | Evidence services/routes exist; AI suggests evidence; approval workflow exists; but ISO/VDA-grade clause mapping and immutable evidence access logs are not guaranteed. | Evidence-first assessment: every score/finding has linked evidence, permissions, retention, access audit, and export packages. | Missing clause-level evidence mapping for ISO/VDA; missing platform-wide immutable audit for evidence access/exports. | **EPIC‑ASMT‑07**: Evidence lifecycle hardening (clause mapping + access audit + retention). **EPIC‑ENT‑AUDIT‑01**/**EPIC‑ENT‑POLICY‑01** (shared). | GAP | P0 |
| 4) Report pipeline (board-ready) | Deloitte/SIRI: executive report templates, controlled narrative, versioning, approvals. | Report templates exist (SIRI etc.); report approval is enforced before assessment approval and before initiative generation. | Deterministic report generation with version diff, reviewer workflows, legal notices per pack, and export to report/deck. | Need stronger version diff/compare UX and “facts vs recommendations” constraints across packs; unify report schemas. | **EPIC‑ASMT‑02** (extend): Report version diff + compare + freeze. **EPIC‑UX‑ASMT‑02** (extend): reviewer UX hardening. | GAP | P1 |
| 5) Program naprawczy / CAPA (corrective actions) | VDA/ISO: findings → CAPA plan with owners/dates, verification, re-audit scheduling. | Initiative generator wizard exists and AssessmentController writes batches/links; decisions are recorded. | “CAPA/program naprawczy” as first-class: findings mapped to corrective actions, verification steps, re-audit schedule, and closure evidence. | Missing explicit findings/nonconformities object model; remediation is initiative-centric but not audit-native. | **EPIC‑ASMT‑06**: CAPA engine (findings → corrective actions + verification + re-audit scheduling) integrated with Initiatives/Tasks/Decisions. | GAP | P0 |
| 6) Continuous compliance (ISO) | ISO platforms: clause library, controls, document control, continuous monitoring, audit readiness dashboard. | Some parts exist (attachments, reports, workflow, gates), but ISO controls/doc control is not a dedicated module contract. | ISO compliance workbench: clauses→controls→evidence→audits; policy and document control; recurring review loops. | Missing ISO clause/control library, document control, and continuous monitoring dashboards. | **EPIC‑ASMT‑ISO‑01**: ISO clause/control library + evidence mapping + continuous compliance dashboards. | GAP | P1 |
| 7) AI as assessment partner (governed) | Leaders add auto-insights; enterprise needs explainability, citations, audit and evals. | AI endpoints exist for evidence/justification; initiative generation is gated and limited; audit logger exists in controller. | Governed AI: explainable scoring suggestions, evidence gaps, initiative programs with citations to answers/evidence, replayable runs, eval harness. | Need unified AI audit/replay and citations across scoring/report/initiative generation. | **EPIC‑AI‑ASMT‑01**/**EPIC‑AI‑ASMT‑02** (extend): citations + replay + diffs. **EPIC‑AI‑GOV‑01** (shared). | GAP | P0 |

### 6.4 Initiatives

**Module snapshot**
- **As‑is**: Initiatives are a central object with a module hub, document view, rich sections (tasks/milestones/dependencies/etc.), and gate readiness checks; portfolio dependencies endpoints exist.
- **V4 target**: Enterprise initiative governance: backend-enforced gates, program hierarchy and portfolio rollups, deterministic planning (incl. baselines/critical path), and tight linkage to Execution/Results/Finance.
- **Top gaps**:
  - Backend enforcement for gate readiness and status transitions (no “best-effort” governance).
  - Program hierarchy + portfolio dashboards (health/deps/capacity/ROI) at scale.
  - Planning depth: baseline + critical path + Smartsheet-like plan view powered by task engine.
  - Governed AI for initiative blueprints (WBS/milestones/deps/resources) with citations + diff/accept + audit.
- **P0 epics**: EPIC‑INIT‑01, EPIC‑INIT‑02, EPIC‑EXEC‑02, EPIC‑AI‑INIT‑03, EPIC‑ENT‑AUDIT‑01

**Benchmark leaders (from your list):** WorkBoard, Cascade Strategy, AchieveIt, Perdoo, Smartsheet

**SSOT anchors:**
- `docs/product/SYSTEM_ARCHITECTURE_BRIEF.md` (Initiative as central object)
- `docs/product/INITIATIVE_LEVEL_TEMPLATES_V3.md` (templates/levels/gates/completeness)
- `docs/product/SOURCE_TRACEABILITY_SPEC.md`

**As‑is anchors (code):**
- Frontend: `src/components/Initiatives/InitiativesHub.tsx`, `src/components/Initiatives/InitiativeDocumentView.tsx`, `src/components/Initiatives/InitiativePreviewV3.tsx`, `src/components/Initiatives/sections/*`
- Backend: `server/src/routes/initiatives.routes.ts`, `server/src/routes/initiative-generator.routes.ts`, `server/src/routes/report-initiatives.routes.ts`

| Area (5) | Benchmark (leaders) | As‑is (Consultify code) | V4 target (enterprise) | Gap | Proposal (epics) | Status | V4 Priority |
|---|---|---|---|---|---|---|---|
| 1) Capabilities | Initiative/OKR alignment, program hierarchy, gates, milestones, dependencies, resource planning, portfolio analytics. | InitiativesHub provides module hub with view modes + previews and N-mode document view; initiative levels exist in UI; backend CRUD route exists; AI initiative generator routes exist. | Enterprise initiative governance system: template-driven sections, backend-enforced gates, portfolio-scale dependencies/resources, and linkage to execution/results/finance. | Need stronger server-side “gate readiness blocks status transitions”; need program-level hierarchy and critical-path-like dependencies at scale. | EPIC‑INIT‑01: Backend gate enforcement + missing-items contract. EPIC‑INIT‑02: Program hierarchy (initiative→program) + portfolio rollups. EPIC‑INIT‑03: Dependencies model + critical path (v4+). | GAP | P0 |
| 2) Integrations | Traceable sources, linking to tasks/decisions/finance/results, exports to reports/decks, external PM tools optional. | UI links to Task/Decision detail views; sections include FinancialAnalysis/KPIs/Dependencies/Timeline; traceability rules exist in SSOT and parts of codebase. | Seamless cross-module navigation + LinkGraph “Used in”; exports for sponsor-ready deliverables. | Parity of linkage/backlinks across modules; connector strategy for Jira/MSP optional but enterprise requested. | EPIC‑LINK‑01: Embedded refs/backlinks parity (incl. Initiative). EPIC‑INT‑PM‑01: Optional Jira/MS Project connectors for execution tracking. | GAP | P1 |
| 3) AI enablement | AI for initiative drafting, risk analysis, dependency suggestions, status summaries, stakeholder comms. | AI context hooks used in hub; various AI services exist in platform. | Governed AI proposals for initiative fields/sections; “weekly status narrative” generation; auditable and reproducible. | Need systematic propose→accept across initiative edits; audit log. | EPIC‑AI‑INIT‑01: Structured proposals per initiative section. EPIC‑AI‑INIT‑02: Status narrative generator with citations. EPIC‑AI‑GOV‑01: evals/cost controls/registry. | GAP | P0 |
| 4) UI/UX quality | Portfolio views (table/kanban/timeline/matrix), strong preview, clear readiness indicators. | Hub uses ModuleHub, TableWithPreviewLayout, analysis views; initiative templates/levels visible. | Fully consistent UI standards (one table, preview parity, view-modes order) + clear gate readiness and missing items UX. | Needs compliance sweep; ensure preview parity; reduce ad-hoc controls. | EPIC‑UX‑INIT‑01: UI standards compliance sweep + readiness UX polish. | GAP | P0 |
| 5) Enterprise readiness | Audit, RBAC/capabilities, approvals, retention, export governance. | Status lifecycle exists; backend auth exists; but platform-wide audit/policy layer not yet unified. | Enterprise governance: auditable approvals, RBAC enforced on transitions, retention/legal hold for artifacts. | Audit/policy gaps cross-cutting. | EPIC‑ENT‑AUDIT‑01, EPIC‑ENT‑POLICY‑01, EPIC‑ENT‑RBAC‑01 (capabilities enforcement). | GAP | P0 |

**Tasks do wdrożenia**
- [ ] Wdrożyć backend gate enforcement: `gate-readiness-check` zwraca missing items; transitions blokowane gdy gate nie passed
- [ ] Rozszerzyć program hierarchy: `initiative.parentProgramId`, portfolio rollups (health, deps, capacity, ROI)
- [ ] Wdrożyć initiative blueprint templates: WBS structure, milestone templates, role templates; DoD per level
- [ ] Wdrożyć goals/OKR spine: obiekty Goal z rollup do initiatives; alignment UI (initiative↔goal↔KPI)
- [ ] Rozszerzyć staffing plan: roles, allocations, skills w sekcji initiative; integracja z capacity model
- [ ] Wdrożyć AI initiative blueprint generator: WBS/milestones/deps/resources jako proposal z diff + citations do interviews/tools/assessments
- [ ] Zintegrować decision governance (SLA/escalations) i RAID gates z initiative readiness

**Plan pokrycia gapu**
- **Gate enforcement**: `GET /initiatives/:id/gate-readiness-check` zwraca `{ passed: bool, missing: [{ section, field, requirement }] }`. `PATCH /initiatives/:id` przy status change sprawdza gate; 400 jeśli missing. Missing items contract: np. "Tasks section wymaga min 1 task z assignee".
- **Program hierarchy**: `initiatives.parent_program_id` (nullable). Portfolio endpoints: rollups (count, health distribution, dependency graph). Dashboard: program health, cross-initiative dependencies, capacity utilization.
- **Blueprint templates**: Szablony WBS (np. Phase 1/2/3, standard milestones). DoD: checklist per initiative level (charter signed, budget approved, etc.). AI generator produkuje proposal z mapowaniem node→task, zachowaniem dependencies.
- **Goals/OKR**: Tabela `goals` (org/initiative scope, type=OKR/initiative, parentId). Initiative ma `goalIds[]`. Rollup: goal progress = f(linked initiatives progress). Alignment UI: matrix initiative×goal, drag to link.

#### 6.4.1 Initiatives (deep dive — WorkBoard/Cascade/AchieveIt/Perdoo/Smartsheet)

**Benchmark notes (aligned with your prompt):**
- **WorkBoard**: strategy execution OS: objectives/OKRs → initiatives → team actions, with KPI linkage and exec reporting.
- **Cascade Strategy / Perdoo**: strategy tree (goals/OKRs) tied to initiatives, owners, cadences, and progress narratives.
- **AchieveIt**: execution plans with milestones, accountability, and structured follow-up; strong “plan tracking” discipline.
- **Smartsheet**: program-level project planning via sheets + dependencies + timeline/Gantt + resource planning and cross-project rollups.

**As‑is verification anchors (code reality):**
- **Initiative project “canvas”**:
  - Tasks & milestones section: `src/components/Initiatives/sections/TasksMilestonesSection.tsx`
  - Dependencies and planning sections exist under `src/components/Initiatives/sections/*` (timeline/dependencies etc.)
  - Initiative summary/compact PM panel pulls tasks/decisions/RAID + gate readiness check: `src/components/Initiatives/InitiativeCompactPanel.tsx`
- **Backend initiative governance**:
  - Portfolio dependencies endpoints: `GET/POST/DELETE /api/initiatives/portfolio/dependencies` in `server/src/routes/pmo/initiatives.routes.ts`
  - Gate readiness: `GET /api/initiatives/:id/gate-readiness-check` (via InitiativeController; referenced in UI)
- **Tasks/Decisions are initiative-aware**:
  - Tasks: `initiativeId` filtering and progress recalculation in `server/src/controllers/TaskController.ts`
  - Decisions: `initiative_id` / `related_object_type` handling in `server/src/controllers/DecisionController.ts`

| Slice (initiative as “full project”) | Benchmark (leaders) | As‑is (Consultify code) | V4 target (enterprise) | Gap | Proposal (epics) | Status | V4 Priority |
|---|---|---|---|---|---|---|---|
| 1) Initiative completeness (project blueprint) | AchieveIt/Smartsheet: action plans + milestones + owners; WorkBoard: outcomes + KPIs. | Initiative document views + dedicated sections exist; tasks/milestones UI exists; gate readiness check exists. | Initiative as a *complete* execution artifact: charter, scope, milestones, task WBS, decisions, RAID, stakeholders, KPIs/benefits, budget, and readiness gates. | Some sections exist but “DoD” and status transitions are not fully enforced server-side; consistency across all initiatives varies. | **EPIC‑INIT‑01** (extend): backend completeness gates + missing-items contract blocks transitions. **EPIC‑INIT‑04**: Initiative blueprint templates (WBS/milestones/roles) + deterministic DoD. | GAP | P0 |
| 2) Strategy linkage (OKR/goals → initiatives → KPIs) | WorkBoard/Cascade/Perdoo: tight goal alignment + cadences + scorecards. | KPI/Results modules exist; initiatives link to KPIs in sections; but explicit OKR/goals layer is not a first-class spine in this workflow. | Goals/OKRs as first-class objects with rollups; every initiative links to outcomes, KPIs, and cadence updates (weekly narrative). | Missing explicit goals/OKR domain model and consistent rollups; strategy view not unified. | **EPIC‑INIT‑06**: Goals/OKR spine + alignment UI (initiative↔goal↔KPI). **EPIC‑AI‑INIT‑02** (extend): cadence/status narrative with citations. | GAP | P0 |
| 3) Program & portfolio management | Smartsheet/WorkBoard: portfolio dashboards, cross-project dependencies, program hierarchy. | Portfolio endpoints exist; dependencies exist; but program hierarchy is still a gap already noted in base 6.4. | Program-of-programs: initiative→program hierarchy, portfolio dashboards, cross-project dependencies, and what-if planning. | Program hierarchy and portfolio analytics need hardening and UX consolidation. | **EPIC‑INIT‑02** (extend): program hierarchy + portfolio rollups. **EPIC‑INIT‑07**: portfolio dashboard v4 (health, dependencies, capacity, ROI). | GAP | P0 |
| 4) Task planning depth (Smartsheet-like) | Smartsheet: sheet plan + Gantt + baselines, critical path, templates; AchieveIt: plan tracking. | Tasks exist and are initiative-scoped; dependencies exist at task level; multiple views exist across MyWork/Execution. | Unified planning view per initiative: sheet/table + timeline/Gantt, baselines, critical path, and milestone tracking, with exports. | Baselines/critical path not present; planning view parity across initiative/task/execution needs consolidation. | **EPIC‑TASK‑02** (extend): milestone + critical path semantics. **EPIC‑INIT‑08**: Smartsheet-like initiative plan view (sheet + gantt + baseline) powered by task engine. | GAP | P1 |
| 5) Team, resources, and capacity | Leaders: team ownership, staffing, workload, resource leveling. | Team/workload exists elsewhere; initiatives show owner/team signals but capacity appears heuristic. | Capacity-aware staffing: roles/skills, allocations, availability, cost rates; risk of over-commit; resource leveling. | Missing deterministic allocation model; initiative staffing plan not first-class and not enforced. | **EPIC‑INIT‑05**: Staffing & resource plan inside initiative (roles/allocations/skills). **EPIC‑EXEC‑01** (extend): capacity model grounded in allocations. | GAP | P0 |
| 6) Decisions, RAID, gates (governance) | Enterprise leaders: decision logs, approvals, stage gates, audit trails. | Decisions are linked to initiatives; RAID exists; gate readiness check exists; stage gates exist as a shared governance layer. | Governance standard: decision SLAs/escalations, stage gates with evidence, audit trail, and signatures where required. | Needs unified governance UX and immutable audit trail; RBAC/capabilities on transitions and approvals. | **EPIC‑DEC‑02** (extend): decision governance for initiatives (SLA/escalations). **EPIC‑ENT‑AUDIT‑01**/**EPIC‑ENT‑RBAC‑01** (shared). | GAP | P0 |
| 7) AI-generated initiative plans (propose→accept) | Leaders are weaker here; opportunity to be best-in-class with governed AI. | AI exists for initiative drafting and summaries; task suggestions exist in sections. | AI generates full initiative blueprint (WBS, milestones, dependencies, resources, KPIs) as a *proposal* with diffs and citations to sources (interviews/tools/assessments). | Needs structured diff/accept across tasks/milestones/resources; needs citations + audit/replay. | **EPIC‑AI‑INIT‑03**: Initiative blueprint generator (WBS/milestones/deps/resources) with propose→accept + diff + citations. **EPIC‑AI‑GOV‑01** (shared). | GAP | P0 |

### 6.5 Execution / Implementation

**Module snapshot**
- **As‑is**: ExecutionHub exists with workload/timeline views, risk/delay signals, mitigations, and an emerging governance control layer (Decisions/RAID/Stakeholders/KPI integration patterns).
- **V4 target**: Execution as operational control plane: deterministic signals + action queue + explainability (“why red”) across initiatives/tasks/decisions/risks/KPIs, with policy-driven automation loops and audit.
- **Top gaps**:
  - Signals engine hardening (deterministic health + explainability + next-best-action orchestration).
  - Schedule depth (baselines/critical path/constraints) and resource leveling grounded in allocations.
  - Closed-loop governance: signals→RAID→decisions→tasks→comms→verification.
  - Enterprise approvals/audit/capabilities enforcement on critical changes.
- **P0 epics**: EPIC‑EXEC‑01, EPIC‑EXEC‑02, EPIC‑EXEC‑03, EPIC‑DEC‑02, EPIC‑RAID‑02, EPIC‑STK‑02, EPIC‑ENT‑AUDIT‑01, EPIC‑ENT‑APPROVAL‑01

**Benchmark leaders (from your list):** Jira, Microsoft Project, Smartsheet, Wrike, Planview

**SSOT anchors:**
- `docs/product/EXECUTION_V3.md`
- `docs/product/RESULTS_V3.md` (execution→results linkage)

**As‑is anchors (code):**
- Frontend: `src/components/Execution/ExecutionHub.tsx`, `src/components/Execution/ExecutionWorkloadView.tsx`, `src/components/Execution/ExecutionTimelineView.tsx`, `src/components/Execution/MitigationPanel.tsx`
- Backend: `server/src/routes/execution.routes.ts`, `server/src/routes/executionControl.routes.ts`

| Area (5) | Benchmark (leaders) | As‑is (Consultify code) | V4 target (enterprise) | Gap | Proposal (epics) | Status | V4 Priority |
|---|---|---|---|---|---|---|---|
| 1) Capabilities | Work execution views (board/timeline/calendar), dependencies, resource mgmt, risk/blockers, escalations, delivery governance. | ExecutionHub offers multiple views + RAID/Decisions; backend provides summary/blockers/health/gate-check + calendar/stats/escalations endpoints. | Execution as operational lens on initiatives/tasks/decisions with deterministic signals + quick actions + reporting loops. | Enterprise scheduling depth (critical path, resource leveling) limited; needs stronger “signals” contract and consistent linkage to initiatives. | EPIC‑EXEC‑01: Signals engine + deterministic health model. EPIC‑EXEC‑02: Dependency & critical path (v4+). EPIC‑EXEC‑03: Resource leveling/workload model (enterprise). | GAP | P0 |
| 2) Integrations | Jira/MSP sync, calendar sync, reporting exports, teams notifications. | Calendar endpoint exists; many modules already integrate with tasks/decisions. | Optional connectors with conflict handling; standardized exports into reports/decks. | Connector engine missing/hardening; reporting exports need unification. | EPIC‑INT‑PM‑01: Jira/MSP/Smartsheet connectors. EPIC‑EXPORT‑01: Unified export to reports/decks. | GAP | P1 |
| 3) AI enablement | AI for risk detection, delay prediction, mitigation suggestions, status summaries. | ExecutionHub includes AI context entry points and signals panels; platform has AI services. | AI proposes mitigations and plans (propose→accept), with audit trail and measurable accuracy. | Missing evaluation harness and governance; need “no hallucinated signals” constraint. | EPIC‑AI‑EXEC‑01: AI mitigation proposals + evidence linking. EPIC‑AI‑GOV‑01. | GAP | P0 |
| 4) UI/UX quality | Fast triage (table+preview), consistent view modes, low clutter. | ExecutionHub uses shared ModuleHub, TableWithPreviewLayout, multiple views. | Strict UI standards compliance; preview parity; keyboard/A11y. | Needs compliance sweep and performance budgets for heavy views (DnD/timeline). | EPIC‑UX‑EXEC‑01: Execution hub compliance + perf pass. | GAP | P0 |
| 5) Enterprise readiness | Governance, audit, role-based actions, retention. | Gate-check endpoint exists; auth enforced. | Auditable status transitions and decisions; RBAC/capabilities enforced; retention/legal hold. | Cross-cutting audit/policy gaps. | EPIC‑ENT‑AUDIT‑01, EPIC‑ENT‑POLICY‑01, EPIC‑ENT‑RBAC‑01. | GAP | P0 |

**Tasks do wdrożenia**
- [ ] Utrwalić signals engine: deterministyczne health (GREEN/AMBER/RED) z wyjaśnieniem ("why red" = chain: signal→risk→decision→tasks)
- [ ] Wdrożyć Action Queue w ExecutionHub: overdue decisions, overdue comm items, high P×I risks bez mitigation, KPI deviations bez action plan
- [ ] Rozszerzyć critical path: obliczanie z dependencies, baseline snapshots UI, schedule risk analytics
- [ ] Zintegrować capacity model: allocations per task/initiative, leveling alerts, overload detection
- [ ] Wdrożyć closed-loop workaround: signals→RAID mitigation→tasks→verify→close; reuse library wzorców
- [ ] Wdrożyć Decision workflow: propose→review→approve→publish; auto-create tasks po publish; link do RAID/KPI
- [ ] Wdrożyć RAID scoring: P×I enforcement, appetite thresholds, heatmaps; auto-create risk z delay/KPI signals
- [ ] Wdrożyć Stakeholder comm: registry (influence/interest), plans per initiative, status/steerco packs, distribution (email/slack) z policy

**Plan pokrycia gapu**
- **Signals + explainability**: Każdy "red" stan ma reason: np. `delay_detected` → RAID issue → mitigation open. API `GET /execution/:projectId/explain?entity=initiative&id=x` zwraca chain. Action Queue agreguje z wszystkich inicjatyw; sortowanie po SLA/due.
- **Action Queue contract (ExecutionHub)**: Zawsze widoczne: overdue decisions, overdue comm items, high P×I risks bez mitigation, KPI deviations bez action plan. Implementacja zgodna z 6.5.1 sekcja E (UI contract).
- **Automation rules**: Tabela trigger→condition→effect w 6.5.1 sekcja D. Każdy trigger (signal.delay_detected, raid.scored, decision.published, comm.plan_due, raid.verified_closed) ma deterministyczny efekt. Implementacja krok po kroku; testy integracyjne per trigger.
- **Automation rules**: Eventy (signal.delay_detected, raid.scored, decision.published) triggerują akcje (create RAID, create Decision, create Tasks). Każda akcja w audicie. Policy: thresholds (delay severity, P×I), kto może approve.
- **Decision workflow**: Decision ma `status`: proposed → in_review → approved | rejected → published. Published triggers: create follow-up tasks, update plan (timeline/budget), enqueue comm items. Gate check: blocking decisions blokują readiness.
- **RAID + Stakeholders**: RAID z `probability`, `impact`; score P×I. Appetite: per program `risk_appetite_threshold`; przekroczenie → auto Decision. Stakeholder: segments, comm plans z items (type=status|steerco); send log z channel, recipientCount. Feedback loop: metrics (opened/clicked) gdzie możliwe.

#### 6.5.1 Wdrożenie / Project execution (deep dive — Jira/MS Project/Smartsheet/Wrike/Planview)

**Benchmark notes (aligned with your prompt):**
- **Jira**: agile execution (epics/stories, backlog, sprints), workflow/status automation, progress reporting (burndown/velocity), integrations.
- **Microsoft Project**: deterministic scheduling (Gantt), dependencies, baselines, critical path, and resource leveling.
- **Smartsheet**: spreadsheet plan as program control (dependencies + timelines + rollups), multi-project tracking.
- **Wrike**: enterprise workflows + approvals, workload views, proofing and governance.
- **Planview**: portfolio execution (programs, prioritization, capacity/funding, risk, scenario planning) at org scale.

**As‑is verification anchors (code reality):**
- **Execution Center UI**:
  - `src/components/Execution/ExecutionHub.tsx` (portfolio health snapshot, workload, risk/delay signals fetch, exec snapshot)
  - `src/components/Execution/ExecutionTimelineView.tsx` (risk/delay badges on timeline bars)
  - `src/components/Execution/DelayDetectionPanel.tsx` + `src/components/Execution/MitigationPanel.tsx` (signals + mitigation updates)
- **Execution APIs**:
  - `server/src/routes/execution.routes.ts`: `/api/execution/:projectId/summary`, `/blockers`, `/health`, `/gate-check`, plus `/stats`, `/escalations`, `/calendar`
  - `server/src/routes/executionControl.routes.ts`: risk signals (`GET /api/execution-control/risk-signals`), delay signals (detect/list/dismiss), warnings, timeline update + audit log, RAID mitigation update, budget/overspend controls.
- **Capacity endpoints exist**: `server/src/routes/pmo/capacity.routes.ts` (`/api/capacity/*`) — can become the real foundation for resource mgmt (currently not a full MS Project-grade model).
- **Schedule baseline snapshots exist**: `GET /api/initiatives/:id/schedule-baselines` in `server/src/routes/pmo/initiatives.routes.ts` (MS Project concept: baseline versions).

**V4 “Execution Governance Control Layer” — model that ties Initiative ↔ Decisions ↔ RAID ↔ Stakeholder Comms ↔ KPI**
- **Canonical anchor**: **Initiative** remains the primary execution object (already has sections for Decisions/RAID/Stakeholders).
- **Execution module role**: aggregate + enforce + explain (portfolio lenses, signals, gating, action queue), not duplicate data entry.
- **Minimal unified model (entities + key links)**:
  - **Decision** (`decision_id`, `initiative_id`, optional `project_id`, optional `task_id`)
    - links to: **RAID item(s)** it resolves, **KPI(s)** it impacts, **Stakeholder segment(s)** to notify, and **task(s)** created as follow-ups.
    - becomes a **gate** when: baseline/scope/budget/risk acceptance changes exceed policy thresholds.
  - **RAID item** (`raid_item_id`, `initiative_id`, type=risk/assumption/issue/dependency, scoring P×I, owner, due)
    - links to: **mitigation plan** (tasks + verification), **decision** (if acceptance/approval required), and **signals** (delay/KPI deviation).
  - **Stakeholder segment** + **Communication plan** + **Plan items** (`stakeholder_segments`, `stakeholder_comm_plans`, `stakeholder_comm_plan_items`)
    - links to: **initiative/program**, **decision status changes**, **risk escalations**, and **scheduled packs** (status/steerco reports & decks).
  - **KPI/ROI**: outcome objects stay in Results, but Execution reads them to power “why red/amber” and to compute impact of decisions/risks.
- **Why this matters**: this is the enterprise pattern used by portfolio tools (governance) + comm platforms (campaigns) — execution success depends on closing loops, not on separate logs.

**Market benchmarks to copy (3 areas):**
- **Decision governance in execution/portfolio tools**:
  - **ServiceNow SPM** (governance workflows, approvals, strategic alignment): `https://www.servicenow.com/uk/products/strategic-portfolio-management.html`
  - **Planview** (portfolio governance + issue lifecycle workflows): `https://www.planview.com/products-solutions/products/planview-portfolios/`
  - **Jira Align** (enterprise agile planning + program governance): `https://www.peerspot.com/products/comparisons/jira-align_vs_servicenow-strategic-portfolio-management`
- **RAID / risk register patterns inside PM tools**:
  - **Wrike** risk/risk-matrix patterns (impact×likelihood, dashboards): `https://www.wrike.com/blog/what-is-risk-matrix/`
  - Jira-style RAID via workflow customization (common enterprise pattern): `https://community.atlassian.com/forums/App-Central-articles/How-to-Set-Up-RAID-Project-Management-in-Jira-in-5-Steps/ba-p/3111906`
- **Stakeholder comm planning (cadence, segmentation, analytics)**:
  - **Staffbase Campaigns / Mission Control** (campaign calendar + approvals + impact analytics): `https://staffbase.com/mission-control`
  - **Firstup** (personalization/segmentation + acknowledgements + exportable analytics): `https://www.prnewswire.com/news-releases/firstup-elevates-the-employee-experience-with-advanced-personalization-in-latest-platform-release-302696754.html`
  - **Poppulo** (planning templates + analytics/insights): `https://www.poppulo.com/platform/software/analytics-and-insights`

**V4 integration contract (DoD) — Decisions + RAID + Stakeholder Comms + KPI inside Execution**
- **Contract goal**: in Execution, every “red/yellow” state must be explainable as a chain: **signal → (risk/decision) → action plan (tasks) → communication (stakeholders) → verification (KPI/close)**.

**A) Canonical ownership (no duplication)**
- **Initiative is the canonical scope** for Decisions/RAID/RACI (data lives on initiative; Execution aggregates).
- **Results (KPI/ROI) is canonical** for outcomes; Execution reads KPI status/deviations, never redefines KPI calculations.
- **Stakeholder comm objects are canonical** in Stakeholder Comms (segments/plans/items/log); Initiative references them, doesn’t duplicate.

**B) Required links (minimum graph completeness)**
- **Decision** MUST reference at least one: `initiativeId` OR `projectId` (prefer `initiativeId`).
- **RAID item** MUST reference: `initiativeId`, `type`, `ownerId`, `dueDate`, `probability`, `impact` (so we can compute \(P \times I\)).
- **Communication send log** MUST reference: `initiativeId` OR `segmentId` + `sentBy` + `channel` + `recipientCount`.
- **KPI deviation case** MUST reference: `kpiId` + an initiative linkage (direct mapping or attribution) + owner.

**C) Event taxonomy (what the Execution signals engine listens to)**
- **Decision events**: `decision.created`, `decision.updated`, `decision.status_changed`, `decision.escalated`, `decision.published`
- **RAID events**: `raid.created`, `raid.scored`, `raid.status_changed`, `raid.mitigation_updated`, `raid.verified_closed`
- **Stakeholder comm events**: `comm.plan_due`, `comm.item_scheduled`, `comm.item_sent`, `comm.feedback_received`
- **Signal events**: `signal.delay_detected`, `signal.risk_signal`, `signal.kpi_deviation_opened`, `signal.kpi_deviation_closed`

**D) Automation rules (minimum closed-loops)**
| Trigger | Condition | Execution effect (deterministic) |
|---|---|---|
| `signal.delay_detected` | delay severity ≥ threshold | Create/Update RAID item type=ISSUE and open mitigation loop; notify owner; create Decision gate if baseline change is needed. |
| `signal.kpi_deviation_opened` | deviation severity = AMBER/RED | Create/Update RAID item type=RISK; link KPI+initiative; propose action-plan tasks; require Decision if scope/budget/risk acceptance is implicated. |
| `raid.scored` | \(P \times I\) exceeds appetite | Auto-create Decision of type `RISK_ACCEPTANCE` (or equivalent) + SLA deadline; add accountable stakeholder; block gate readiness until decided. |
| `decision.published` | decision approved | Auto-create follow-up Tasks (owners/dates) + update execution plan (timeline/budget) if it’s a change; enqueue comm plan items. |
| `comm.plan_due` | plan overdue | Create Task “Send update” + raise Execution escalation; keep in action queue until sent/logged. |
| `raid.verified_closed` | verification complete | Close linked mitigation tasks; update Execution health; notify informed stakeholders. |

**E) UI contract (where this must show up)**
- **ExecutionHub** must have an **Action Queue** that includes: overdue decisions, overdue comm items, high \(P \times I\) risks without mitigation, KPI deviations without action plan.
- **ExecutionHub** must have **Explainability (“Why red?”)** that traverses: KPI deviation → risk → decision → tasks → comms.
- **Initiative view** must show **Gates**: blocking decisions + risks above appetite + missing required comm sends (if policy requires).

**F) Governance & audit (enterprise baseline)**
- Every automated action (risk/decision/task creation, comm enqueue) must emit an **audit event** (actor=user or “system”, reason, before/after).
- **Policy layer** must define thresholds (risk appetite, SLA windows, who can approve/publish, who can send comms).

| Slice (execution management) | Benchmark (leaders) | As‑is (Consultify code) | V4 target (enterprise) | Gap | Proposal (epics) | Status | V4 Priority |
|---|---|---|---|---|---|---|---|
| 1) Progress tracking + exec reporting | Jira/Wrike/Planview: portfolio dashboards, delivery health, gates, action queues. | ExecutionHub provides portfolio health snapshot + blockers + escalations + calendar; initiative gate-check exists; signals endpoints exist. | One “execution truth”: progress + blockers + gates + risks + finance signals combined with clear next actions and traceability to underlying tasks/decisions. | Signal semantics and scoring need hardening; “next best action” orchestration is still emerging; cross-module parity for “why this is red” needs discipline. | **EPIC‑EXEC‑01** (extend): Signals engine hardening (deterministic health + explanations). **EPIC‑INBOX‑01**: unify action queue and execution alerts. | GAP | P0 |
| 2) Agile planning (backlog/sprints) | Jira: backlog, sprints, story points, burndown/velocity, issue workflows. | Tasks have table/kanban/calendar; dependencies exist; but no explicit sprint/backlog/estimation system is visible as a first-class execution feature. | Agile layer (optional): backlog + sprint planning, estimates, burndown/velocity, and workflow automation; integrates with initiatives and capacity. | Missing sprint model + metrics; missing agile workflow automation and reporting. | **EPIC‑EXEC‑04**: Agile execution layer (backlog/sprints/story points/burndown) integrated with Tasks + Initiatives. **EPIC‑INT‑PM‑01** (extend): Jira sync including sprint state mapping. | GAP | P1 |
| 3) Scheduling depth (MS Project) | MS Project: baselines, critical path, what-if scheduling, dependency constraints. | Timeline view exists; dependencies exist; initiative schedule-baselines endpoints exist; delay signals exist. | Deterministic schedule engine: baselines, critical path, constraints, schedule risk forecasts, and what-if scenarios. | Critical path & constraints not explicit; baselines need UI + policy gating; schedule risk analytics needs productization. | **EPIC‑EXEC‑02** (extend): Critical path + constraints + schedule risk analytics. **EPIC‑INIT‑08** (extend): plan view w/ baseline management UI. | GAP | P0 |
| 4) Resource management + workload | Wrike/MS Project/Planview: resource leveling, allocations, capacity, skills, forecasting. | Workload views exist; `/api/capacity/*` exists; MyWork team-workload is heuristic in places. | Real resource model: allocations per initiative/task, leveling, skill-based staffing, forecasts, and overload alerts. | Allocation model not first-class; capacity endpoints need full integration + governance; leveling algorithms missing. | **EPIC‑EXEC‑03** (extend): resource leveling/workload model (allocation-based). **EPIC‑INIT‑05**: initiative staffing & allocations. **EPIC‑CAP‑01**: unify capacity model across MyWork/Execution/Initiatives. | GAP | P0 |
| 5) Risk & workaround (RAID + mitigations) | Planview/Wrike: risks with mitigation owners/dates, audit, escalations; “workarounds” tracked and reviewed. | RAID exists; mitigations can be updated via execution-control (RAID mitigation endpoint); risk signals exist; delay signals exist. | Workaround discipline: mitigation plans tied to risk/delay signals, owners, due dates, verification, and “learned workaround patterns” reused across projects. | Mitigation is present but not yet a complete closed-loop system (verification, effectiveness, reuse, linking to tasks/decisions). | **EPIC‑EXEC‑05**: Workaround/mitigation loop (signals → plan → tasks → verify → close) + reuse library. **EPIC‑AI‑EXEC‑01** (extend): AI mitigation proposals grounded in evidence. | GAP | P0 |
| 6) Workflow approvals & governance | Wrike/Jira: workflow automation, approvals, audit trails; Planview: governance at scale. | Gate-check exists; execution-control has audit log + timeline-update; decisions/escalations exist. | Enterprise governance: approvals on key changes (baseline/timeline/status), audit trail, RBAC capabilities, and policy controls. | Needs standardized approval workflow for schedule/budget changes; needs immutable audit/policy enforcement across all changes. | **EPIC‑ENT‑APPROVAL‑01**: approvals + signatures. **EPIC‑ENT‑AUDIT‑01**: immutable audit stream. **EPIC‑ENT‑RBAC‑01**: capabilities enforced on critical actions. | GAP | P0 |
| 7) Multi-project program management | Smartsheet/Planview: program-level rollups, dependencies, funding, prioritization, scenario planning. | Portfolio endpoints exist for initiatives; dependencies exist; finance/results exist; but “program-of-programs” and scenario planning is limited. | Program execution cockpit: cross-project dependencies, funding/capacity scenarios, portfolio what-if, and prioritization loops. | Needs explicit program hierarchy + scenario models that combine schedule/capacity/funding. | **EPIC‑INIT‑02**/**EPIC‑INIT‑07** (extend): program hierarchy + portfolio dashboards. **EPIC‑EXEC‑06**: portfolio what-if (schedule/capacity/funding). | GAP | P1 |
| 8) Decision Management (gating execution) | ServiceNow SPM / Planview / Jira Align: governance workflows, approvals, decision logs linked to portfolio execution. | Decision API exists: `server/src/routes/decisions.routes.ts` (decision request, options, criteria, deadline, stakeholderIds, delegation/escalation services). Decisions are initiative-aware and visible in execution context. | Decision system that blocks/unblocks execution: decision classes (strategic/tactical), required evidence, alternatives register, decision gates, SLA/escalation, immutable audit + publish. | Needs richer domain model (classes + required fields), explicit workflow (propose→review→approve→publish), and strong linking to RAID/KPI/tasks and gate checks. | **EPIC‑DEC‑01**: Decision playbooks + required fields (alternatives/rationale/evidence/owner/due). **EPIC‑DEC‑02**: Decision workflow (propose→review→approve→publish) + audit. **EPIC‑DEC‑03**: Decision→Execution link (auto tasks/plan changes; link to RAID/KPI). | GAP | P0 |
| 9) Risk Management (RAID enterprise) | Wrike/Planview patterns: risk register with scoring (P×I), dashboards/heatmaps, governance + escalations; Jira-style RAID via workflow customization. | RAID CRUD exists: `server/src/routes/raid.routes.ts` (type/status/owner/due, includes probability+impact fields in list); execution-control provides risk signals + mitigation updates; ExecutionHub shows a risk heatmap snapshot. | RAID as a control system: P×I scoring + appetite thresholds, controls & evidence, heatmaps by program, automated signals→risk updates, verification loops. | Probability/impact scoring isn’t enforced as a workflow; appetite/thresholds/controls/evidence are not first-class; early warning needs explicit mapping to risk objects. | **EPIC‑RAID‑01**: Risk scoring + heatmaps + appetite per program. **EPIC‑RAID‑02**: Signals→Risks (auto create/update from delay/KPI deviations). **EPIC‑RAID‑03**: Controls & evidence (tests, proof, audit). | GAP | P0 |
| 10) Stakeholders + Communication | Staffbase / Firstup / Poppulo: campaign calendars, segmentation, approvals, acknowledgements, analytics; tie comms to execution outcomes. | Stakeholder comm backend exists: `server/src/routes/stakeholder-comm.routes.ts` + `server/src/services/stakeholderCommService.ts` (segments, plans, plan items, send log, overdue). UI building blocks exist (e.g. `src/components/MyWork/shared/StakeholdersSection.tsx` RACI; initiative wrapper exists). | Execution-grade comms: stakeholder registry + influence/interest, comm plans per initiative/program, “steerco/status packs” distribution (email/slack/teams), feedback loop tied to decisions/RAID/actions, with audit/policy. | Needs unified Execution UX + governance: connect comm plans to deliverables (reports/decks/status reports), add adoption/feedback metrics, and enforce policy/audit for sends. | **EPIC‑STK‑01**: Stakeholder registry + influence/interest + ownership. **EPIC‑STK‑02**: Communication plans + packs (status/steerco) + distribution w/ policy. **EPIC‑STK‑03**: Feedback loop (insights→decisions→actions) + adoption metrics. | GAP | P0 |

### 6.6 Results / KPI / ROI

**Module snapshot**
- **As‑is**: KPI catalog + time-series + deviation cases + ROI portfolio/initiative tracking exist, plus KPI snapshot reports that feed Report Builder.
- **V4 target**: Enterprise results layer: metrics semantic layer, connectors + scheduled refresh, deviation→action closed loop, and ROI with evidence/provenance linked to finance assumptions and initiative attribution.
- **Top gaps**:
  - Metrics semantic layer (Looker-style) + dimensions/slices + RLS and versioning.
  - Connector framework for KPI ingestion with provenance + reconciliation and scheduling.
  - Deviation loop completion (verification/effectiveness checks) and tighter linkage to execution artifacts.
  - ROI governance: evidence/provenance, finance-model linkage, and “no silent edits” policy.
- **P0 epics**: EPIC‑RES‑01, EPIC‑RES‑02, EPIC‑RES‑04, EPIC‑INT‑KPI‑01, EPIC‑ENT‑LINEAGE‑01, EPIC‑ENT‑AUDIT‑01

**Benchmark leaders (from your list):** Power BI, Tableau, Looker, Databox, Geckoboard

**SSOT anchors:**
- `docs/product/RESULTS_V3.md`
- `docs/product/ROI_TRACKING_CONTRACT_V3.md`

**As‑is anchors (code):**
- Frontend: `src/components/Results/ResultsHub.tsx`, `src/components/Results/ResultsKpisTableV3.tsx`, `src/components/Results/KPITimeSeriesDrawer.tsx`, `src/components/Results/ROITrackingView.tsx`, `src/components/Results/ResultsKpiReportsView.tsx`
- Backend: `server/src/routes/benefits.routes.ts` (KPI/time-series/attribution/deviation cases), `server/src/routes/results-kpi-reports.routes.ts`

| Area (5) | Benchmark (leaders) | As‑is (Consultify code) | V4 target (enterprise) | Gap | Proposal (epics) | Status | V4 Priority |
|---|---|---|---|---|---|---|---|
| 1) Capabilities | BI-grade modeling, dashboards, drilldowns, alerts, scheduled reporting, KPI ownership workflows. | ResultsHub implements KPI + KPI reports + ROI tabs; KPIs fetched from `/benefits/kpis` and mappings; backend has KPI deviation cases and report snapshots into Report Builder. | “One KPI table” + time-series + initiative attribution + deviation management + ROI plan vs realized, with export to reports/decks. | Deep BI modeling is out-of-scope, but enterprise requires connectors and governance; KPI deviation workflow must be end-to-end; ROI needs strong traceability to finance assumptions. | EPIC‑RES‑01: KPI deviation cases end-to-end (alerts→action plans). EPIC‑RES‑02: ROI plan vs realized (contract completion) + linkage to finance models. EPIC‑RES‑03: Scheduled KPI reporting + distribution. | GAP | P0 |
| 2) Integrations | Data connectors (ERP/BI), exports, alerts to Teams/Slack. | MCP client utilities exist in benefits routes; current data sources likely mostly internal/manual. | Connector framework for KPI ingestion + alerts + audit. | Need connector strategy + conflict/reconciliation, plus admin policies. | EPIC‑INT‑KPI‑01: KPI connectors (BI/ERP) + ingestion pipeline. EPIC‑INT‑ALERT‑01: Teams/Slack alerts + routing. | GAP | P1 |
| 3) AI enablement | Narrative insights, anomaly detection, driver analysis, automated action suggestions. | ResultsHub has AI context entry; backend has some automation hooks in deviation service. | AI proposes interpretations and action plans with citations to initiatives/finance assumptions; evaluated for correctness. | Need evaluation harness; need “facts-only” constraints for narratives; audit trail. | EPIC‑AI‑RES‑01: AI narrative + anomaly detection proposals. EPIC‑AI‑GOV‑01. | GAP | P1 |
| 4) UI/UX quality | Clear KPI table, trend widgets, fast drilldowns, consistent preview patterns. | Hub uses ModuleHub; drawers for KPI time-series and ROI details exist. | Strict UI standard compliance + accessible charts; minimal clutter. | Needs ongoing polish and consistency across dashboards; performance budgets for charts. | EPIC‑UX‑RES‑01: Results UI compliance + perf pass. | GAP | P1 |
| 5) Enterprise readiness | Audit, retention, data lineage, permissions. | Report snapshots exist and are traceable to snapshot IDs; auth enforced in routes. | Full data lineage: KPI value entries have evidence + provenance; audit trails for changes and exports. | Missing platform-wide audit/policy layers; provenance enforcement on imported data. | EPIC‑ENT‑AUDIT‑01, EPIC‑ENT‑POLICY‑01, EPIC‑ENT‑LINEAGE‑01 (data lineage). | GAP | P0 |

**Tasks do wdrożenia**
- [ ] Wdrożyć metrics semantic layer: KPI definitions + dimensions + slices, RLS, versioning; reuse w Results/Reports/Execution
- [ ] Rozszerzyć KPI connectors: ingestion pipeline (ERP/BI/SaaS), scheduled refresh, provenance per datapoint
- [ ] Dokończyć deviation loop: verify/close z evidence; linkage do tasks/initiatives; audit dla status changes
- [ ] Zahardować ROI: evidence dla realized values, provenance assumptions, linkage do finance models; "no silent edits"
- [ ] Wdrożyć scheduled KPI reporting: templates, approval gates, distribution policies (email/slack)
- [ ] Dodać wallboard mode: real-time refresh, alert banners, auto-rotation, team views

**Plan pokrycia gapu**
- **Metrics semantic layer**: Tabela `kpi_definitions` z dimensions (np. region, product), slices (filtry), formula. RLS: row-level security per org/department. Versioning: przy zmianie definicji nowa wersja; history dla time-series.
- **Data ingestion**: Connector framework (adapter per source: REST, DB, file). Job scheduler: refresh cadence per KPI. Provenance: każda wartość ma `source_ref` (connector_run_id, timestamp). Reconciliation: rules do wykrywania konfliktów (manual vs connector).
- **Deviation loop**: Case ma status: open → triage → rca → actions → verify → closed. Verify: owner potwierdza; effectiveness check (optional). Link do tasks: deviation może create task; task completion może trigger verify. Audit: każda zmiana statusu.
- **ROI governance**: Assumptions z `source_ref` (budget id, financial model id). Realized: wymagane attachment/evidence. No silent edits: każde update przez API z actor, reason; bulk updates wymagają approval gdzie policy tak mówi.

#### 6.6.1 Results / KPI / ROI (deep dive — Power BI/Tableau/Looker/Databox/Geckoboard)

**Benchmark notes (aligned with your prompt):**
- **Power BI / Tableau**: BI-grade semantic modeling + connectors + governed datasets; dashboards are outputs of the model.
- **Looker**: “metrics layer” (central model) + governed exploration; strong permissions/row-level security.
- **Databox / Geckoboard**: operational dashboards (near real-time) optimized for “are we on track today?” with fast connectors.

**As‑is verification anchors (code reality):**
- **KPI catalog + time series**: `server/src/routes/benefits.routes.ts`:
  - `GET/POST/PUT/DELETE /api/benefits/kpis`
  - `GET/POST /api/benefits/kpis/:kpiId/time-series` (write triggers deviation evaluation via `handleTimeSeriesRecorded`)
  - deviation management + action plans: `/api/benefits/kpis/:kpiId/deviation-cases` + `/api/benefits/deviation-cases/*`
  - attribution endpoints: `/api/benefits/attribution/:kpiId/*` backed by `server/src/services/kpiAttributionService.ts` (explicitly heuristic w/ disclaimer)
  - ROI endpoints incl. `GET /api/benefits/roi/portfolio/summary` + per-initiative assumptions/realized/variance.
  - connector hint: `POST /api/benefits/kpis/:kpiId/refresh/iris` (MCP remote tool call) suggests an external ingestion path exists.
- **KPI Reports → Report Builder**: `server/src/routes/results-kpi-reports.routes.ts` creates KPI snapshot reports (`RESULTS_KPI_REPORT`) and prefills Report Builder sections.
- **Deviation evaluation logic**: `server/src/services/results/kpiDeviationService.ts` computes GREEN/AMBER/RED and auto-creates/reopens cases + notifies owner.

| Slice (results platforms) | Benchmark (leaders) | As‑is (Consultify code) | V4 target (enterprise) | Gap | Proposal (epics) | Status | V4 Priority |
|---|---|---|---|---|---|---|---|
| 1) Metrics semantic layer (Looker-style) | Looker: governed model defines metrics/dimensions, reuse across dashboards; strong RLS. | KPIs exist as rows with thresholds and time series; mapping to initiatives exists; but no explicit “semantic model” contract for metrics/dimensions/datasets. | Metrics layer: KPI definitions + dimensions + slices, with row-level permissions, versioning, and reuse across Results/Reports/Execution. | Missing semantic layer + dimension modeling; risks ad-hoc dashboards and inconsistent calculations. | **EPIC‑RES‑04**: Metrics semantic layer (definitions + dimensions + RLS + versioning) feeding Results + Reports. | GAP | P0 |
| 2) Data ingestion + connectors (PowerBI/Databox parity) | Power BI/Databox: many connectors, scheduled refresh, incremental loads, governance. | Manual recording + an IRIS refresh hook exists; broader connectors are not standardized. | Connector framework for KPI ingestion (ERP/BI/SaaS), scheduled refresh, incremental loads, reconciliation, and provenance per datapoint. | Connector strategy is partial; provenance and reconciliation need hardening; scheduling not unified. | **EPIC‑INT‑KPI‑01** (extend): KPI connectors + ingestion pipeline + provenance. **EPIC‑RES‑06**: KPI data quality gates + reconciliation rules. | GAP | P0 |
| 3) Deviation management → action loop | Leaders: alerting + ownership + workflow for anomalies (often via BI + ticketing). | Strong start: deviation cases auto-created on time-series writes, RCA text + action plan tasks inside deviation module. | Closed loop: detect → triage → RCA → actions → verify → close; links back to initiatives/tasks/decisions; evidence attachments; audit. | Needs verification/effectiveness checks and tighter linkage to execution artifacts; ensure all status changes are audited. | **EPIC‑RES‑01** (extend): Deviation loop end-to-end (verify/close + links to tasks/initiatives). **EPIC‑ENT‑AUDIT‑01** (shared). | GAP | P0 |
| 4) ROI plan vs realized (initiative outcome accounting) | Enterprise leaders: benefit tracking tied to initiatives, baselines, and finance assumptions; audit-ready. | ROI portfolio summary exists; assumptions + realized values exist; variance endpoints exist; UI has ROI tracking + analysis views. | Outcome accounting: baselined assumptions, realized capture with evidence/provenance, scenario comparison, and links to finance budgets and KPI attribution. | Needs tighter finance model linkage and evidence discipline; “no silent edits” governance for ROI changes. | **EPIC‑RES‑02** (extend): ROI contract completion (evidence + provenance + finance link). **EPIC‑ENT‑LINEAGE‑01**: lineage for ROI/KPI datapoints. | GAP | P0 |
| 5) Reporting packs (board-ready) | BI tools export dashboards; enterprises need consistent exec packs and scheduled distribution. | KPI report snapshots feed Report Builder; sections are prefilled and can be exported from Report Builder. | Scheduled KPI/ROI executive packs with templates, approvals, distribution policies, and traceability. | Scheduling/distribution is not standardized; report governance needs policy layer. | **EPIC‑RES‑03** (extend): Scheduled KPI reporting + distribution policies. **EPIC‑INT‑ALERT‑01** (extend): Teams/Slack routing for KPI alerts & reports. | GAP | P1 |
| 6) Real-time operational dashboards | Databox/Geckoboard: near real-time dashboards, wallboards, simple status. | KPI table + latest measurement supports a dashboard view; but “wallboard mode” and streaming ingestion is not a stated product contract. | Wallboard mode: real-time/near-real-time KPIs, alert banners, auto-rotation, and team views with permissions. | Missing dedicated real-time dashboard mode and refresh scheduling; connector latency SLAs not defined. | **EPIC‑RES‑05**: Operational dashboards mode (wallboard) + refresh scheduling + alert banners. | GAP | P1 |
| 7) AI insights with guardrails | Leaders increasingly add AI narratives; enterprise requires citations and “facts-only” constraints. | AI exists conceptually in Results; deviation service provides structured facts; attribution service provides disclaimers. | AI proposes narratives/drivers with citations to KPI points, initiatives, and finance assumptions; eval harness; no hallucinated numbers. | Needs citations + eval harness + audit; ensure AI uses only source-of-truth data. | **EPIC‑AI‑RES‑01** (extend): AI insights w/ citations + facts-only mode. **EPIC‑AI‑GOV‑01** (shared). | GAP | P1 |

### 6.7 Financial Analysis

**Module snapshot**
- **As‑is**: Strong finance ingestion + modeling + valuation surfaces exist (statements pipeline, models with compute/validations/approve, budgets, valuation DCF/comps/sensitivity + exports).
- **V4 target**: Enterprise FP&A layer: versioned scenario graph across models/budgets/valuations, approvals, reconciled connectors (ERP/Excel), and full lineage from imported values → assumptions → ROI.
- **Top gaps**:
  - Unified scenario/version governance across all finance artifacts + “active baseline” policies.
  - Multi-dimensional planning layer (dimensions/allocations/consolidation) if aiming at Anaplan/Pigment class.
  - Provenance/lineage for every imported/edited value and mapping; audit/policy enforcement on exports/approvals.
  - Governed AI mapping/assumptions with citations + eval harness for extraction quality.
- **P0 epics**: EPIC‑FIN‑01, EPIC‑FIN‑02, EPIC‑FIN‑03, EPIC‑INT‑FIN‑01, EPIC‑ENT‑LINEAGE‑01, EPIC‑ENT‑AUDIT‑01, EPIC‑AI‑FIN‑01

**Benchmark leaders (from your list):** Anaplan, Pigment, Planful, Cube

**SSOT anchors:**
- `docs/product/FINANCIAL_ANALYSIS_V3.md`
- `docs/product/FINANCE_EXPORT_V3.md`

**As‑is anchors (code):**
- Frontend: `src/components/Economics/FinanceHub.tsx`, `src/components/Finance/FinancialStatementImportWizard.tsx`, `src/components/Finance/FinancialModelWorkspace.tsx`, `src/components/Finance/ExportToOutputDialog.tsx`
- Backend: `server/src/routes/finance-statements.routes.ts`, `server/src/routes/budget.routes.ts`, `server/src/routes/budgets.routes.ts`, `server/src/routes/ai-budgets.routes.ts`

| Area (5) | Benchmark (leaders) | As‑is (Consultify code) | V4 target (enterprise) | Gap | Proposal (epics) | Status | V4 Priority |
|---|---|---|---|---|---|---|---|
| 1) Capabilities | FP&A planning, scenario modeling, integrated statements, versioning, approvals, consolidation. | FinanceHub implements multi-tab economics surfaces; finance-statements ingestion pipeline exists (upload→detect→extract→map→validate→confirm) + ratios + benchmarks; initiative-scoped budgets exist. | Enterprise “self-reliant model”: canonical P&L/BS/CF with versioned scenarios, traceable imports, validations, saved analyses, and exports to reports/decks/initiatives. | Full FP&A suite is large; key gap is governance (versions/approvals), scenario engine depth, and enterprise-grade data lineage. | EPIC‑FIN‑01: Model versioning + scenario engine hardening. EPIC‑FIN‑02: Validation + tie-out completeness gates. EPIC‑FIN‑03: Finance→ROI linkage (Results) + traceability. | GAP | P0 |
| 2) Integrations | ERP/GL connectors, Excel sync, benchmark sources, approvals workflows. | Benchmarks endpoints exist in finance-statements routes; PDF import supported. | Connector framework with governance; approvals and audit; macro data sources whitelisted and cited. | Connectors and enterprise approvals missing; benchmark governance needs productization. | EPIC‑INT‑FIN‑01: ERP/Excel connectors + reconciliation. EPIC‑ENT‑APPROVAL‑01: approvals + audit for finance models. | GAP | P1 |
| 3) AI enablement | Assisted mapping, anomaly detection, narrative analysis, scenario suggestions. | Auto-map and extraction services exist; AI budgets routes exist. | AI as finance analyst: propose mappings/assumptions with citations, and never silently modifies models; evaluated and cost-controlled. | Need audited AI proposals; need eval harness for extraction/mapping quality. | EPIC‑AI‑FIN‑01: Audited AI mapping + confidence thresholds. EPIC‑AI‑FIN‑02: Narrative analysis generator with citations. EPIC‑AI‑GOV‑01. | GAP | P0 |
| 4) UI/UX quality | Spreadsheet-like speed, clear validations, saved views, premium previews and exports. | FinanceHub follows golden standard table+cards+preview and uses dedicated wizards/workspaces. | Consistent UX across all finance tabs, with predictable exports and performance budgets. | Needs ongoing polish and compliance across all sub-workspaces; ensure i18n everywhere. | EPIC‑UX‑FIN‑01: Finance UX compliance + perf budgets. | GAP | P1 |
| 5) Enterprise readiness | Audit, retention, SOC2, data lineage, access control, approvals. | Auth enforced; ingestion pipeline and benchmarks exist. | Enterprise policies + audit logs + lineage for every value and mapping; retention/legal hold. | Platform-wide audit/policy gaps. | EPIC‑ENT‑AUDIT‑01, EPIC‑ENT‑POLICY‑01, EPIC‑ENT‑LINEAGE‑01. | GAP | P0 |

**Tasks do wdrożenia**
- [ ] Wdrożyć model versioning + scenario engine: branch/compare/merge dla models/budgets/valuations
- [ ] Rozszerzyć multi-dimensional planning: dimensions (org/product/cost center), allocations, consolidation
- [ ] Wdrożyć rolling forecast: budget versions, forecast cycles, variance workflows, approval gates
- [ ] Wdrożyć Excel/ERP connectors: bidirectional sync (gdzie możliwe), reconciliation, provenance
- [ ] Zahardować valuation: versioning, diff, audit trail dla assumptions, linkage do initiatives
- [ ] Wdrożyć AI mapping/assumptions z citations + eval harness dla extraction quality
- [ ] Zintegrować finance→ROI: assumptions z financial model ID; realized capture z evidence

**Plan pokrycia gapu**
- **Scenario engine**: Obiekt `scenario` z `parentId` (branch), `baseVersionId`. Compare: diff między scenarios. Active baseline: policy per org "default scenario for reporting". Merge: conflict resolution (manual lub strategy: base wins / branch wins).
- **Multi-dimensional**: Tabela `plan_dimensions` (org, product, cost_center). `plan_cells`: dimension_values + value. Allocations: rules (np. revenue % per product). Consolidation: rollup z leaf do root.
- **Connectors + lineage**: Excel: import/export + optional live sync (polling). ERP: adapter per vendor (SAP, Oracle). Każda wartość: `source_ref` (connector_run_id, cell_ref). Lineage API: "skąd ta wartość" (import job, manual edit, formula).
- **Valuation governance**: Version per valuation; diff między wersjami. Assumptions: stored with `source_ref`. Approve workflow: lock po approve. Traceability: recommendation → initiative (LinkGraph).

#### 6.7.1 Financial Analysis / FP&A / Valuation (deep dive — Anaplan/Pigment/Planful/Cube)

**Benchmark notes (aligned with your prompt):**
- **Anaplan**: connected planning (multi-dimensional model) across sales/costs/resources; workflow approvals; scenario planning; enterprise governance.
- **Pigment**: modern planning + fast scenario modelling and “business model visualization”; collaboration + audit; strong UX for planning teams.
- **Planful**: budgeting + rolling forecast + close/reporting workflows; variance analysis; governance and approvals.
- **Cube**: spreadsheet-centric planning with bidirectional sync (Excel/Sheets) and a governed source-of-truth model underneath.

**As‑is verification anchors (code reality):**
- **Finance hub IA**: `src/components/Economics/FinanceHub.tsx` (tabs: models/analysis/prediction/valuation; golden standard table+preview).
- **Statements ingestion + ratios + benchmarks**: `server/src/routes/finance-statements.routes.ts` supports PDF/XLSX/XLS/CSV upload and pipeline (detect→extract→map→validate→confirm) + ratio catalog and benchmarks.
- **Financial modeling engine**: `server/src/routes/financial-modeling.routes.ts` + `src/components/Finance/FinancialModelWorkspace.tsx` (models, economic events timeline, compute, validations, submit-review, approve).
- **Initiative-scoped budget tracking**: `server/src/routes/budget.routes.ts` (`/initiative/:initiativeId` summaries + transactions) used by Execution/Initiatives budgeting views.
- **Enterprise valuation module**:
  - APIs: `server/src/routes/economics.routes.ts` (`/api/economics/valuations/*` list/create/get/update assumptions/peers/compute/approve/advisory/negotiation-pack/export)
  - Core compute: `server/src/services/valuationService.ts` implements **DCF** (WACC + terminal method gordon/exit multiple), **comps**, and sensitivity grids.
  - UI: `src/components/Benefits/ValuationWorkspace.tsx` + create modal `src/components/Economics/modals/CreateValuationModal.tsx` (source: budget/financial model/manual).

| Slice (finance platforms) | Benchmark (leaders) | As‑is (Consultify code) | V4 target (enterprise) | Gap | Proposal (epics) | Status | V4 Priority |
|---|---|---|---|---|---|---|---|
| 1) Connected planning model (multi-dimensional) | Anaplan/Pigment: cubes, dimensions, allocations, consolidation, approvals. | Financial models exist with events and computed outputs; budgets exist; but no explicit multi-dimensional planning “cube” with dimensions/allocations/consolidation is evident. | Finance planning model as a platform: dimensions (org/product/cost center), allocations, consolidation, scenarios, and workflow approvals. | Missing cube/dimension model; missing consolidation; workflow approvals are present for models but not end-to-end across budgets/plans. | **EPIC‑FIN‑01** (extend): model versioning + scenario engine. **EPIC‑FIN‑04**: multi-dimensional planning layer (dimensions/allocations/consolidation). **EPIC‑ENT‑APPROVAL‑01** (shared). | GAP | P0 |
| 2) Budgeting + rolling forecast | Planful: budgets ↔ forecasts ↔ actuals; variance analysis; workflow and audit. | Initiative budgets & transactions exist; project/org budget management routes exist but depend on a service that may be unavailable in some envs; finance statements ingestion supports actuals capture. | Rolling forecast: budget versions, forecast cycles, variance drilldowns, and approval workflows per org/project/initiative. | Limited forecasting cycle management; approval semantics for budgets not unified; variance analysis needs a first-class workflow. | **EPIC‑FIN‑05**: rolling forecast + budget versioning + variance workflows. **EPIC‑FIN‑02** (extend): validation/tie-out gates for budget/forecast vs statements. | GAP | P0 |
| 3) Scenario management & “what-if” | Anaplan/Pigment: fast scenario compare, branching, sensitivity, explanation. | Financial models have `scenario` + `version` fields; valuation has sensitivity tables (WACC vs g / exit multiple). | Scenario graph: branch/compare/merge across finance models + budgets + valuations; scenario dashboards with deltas and narratives. | Missing unified scenario compare across artifacts; missing scenario governance and reproducible “active baseline” selection per org/project. | **EPIC‑FIN‑06**: scenario graph + compare/merge across model/budget/valuation + “active baseline” policies. | GAP | P1 |
| 4) Data ingestion & spreadsheet workflow (Cube parity) | Cube: Excel/Sheets bidirectional sync + governed model; connectors and refresh. | XLSX/CSV import exists for statements; no explicit bi-directional Excel sync for plans/models; connectors are not standardized. | Spreadsheet integration: controlled import/export, optional live sync, and reconciliation with clear provenance; connectors to ERP/GL optional. | Missing live sync + reconciliation layer; provenance/lineage across imports/edits needs hardening. | **EPIC‑INT‑FIN‑01** (extend): Excel/ERP connectors + reconciliation. **EPIC‑ENT‑LINEAGE‑01** (shared): lineage for financial values and mappings. | GAP | P0 |
| 5) Valuation (DCF + comps + packs) | Enterprise tooling supports DCF, comps, sensitivities, approvals, and board-ready outputs. | Strong base: DCF (WACC + terminal), comps, sensitivity grids, advisory + negotiation pack, approve workflow, and PPTX export exist. | Valuation as executive product: versioned valuations, audit trail, evidence/provenance of assumptions, cap table and M&A variants (optional), and conversion of recommendations into initiatives. | Need stronger governance: versioning/diff, assumptions provenance, audit logs, and policy controls; optional cap table/M&A flows not modeled. | **EPIC‑FIN‑VAL‑01**: valuation versioning + diff + audit/provenance. **EPIC‑FIN‑VAL‑02**: cap table / M&A variants (optional enterprise). **EPIC‑LINK‑01**: traceability from valuation recommendations → initiatives. | GAP | P0 |
| 6) Governance (approve, lock, audit) | Leaders: approvals, locked states, audit logs, retention, role-based access. | Models and valuations have approve flows and delete restrictions; broader audit/policy is cross-cutting and not unified. | Finance governance baseline: approvals, immutable audit events for edits/exports, retention/legal hold, and capabilities enforced. | Missing unified audit/policy enforcement across finance artifacts; RBAC/capabilities enforcement needs standardization. | **EPIC‑ENT‑AUDIT‑01**/**EPIC‑ENT‑POLICY‑01**/**EPIC‑ENT‑RBAC‑01** (shared). | GAP | P0 |
| 7) AI in finance (safe + evaluated) | Leaders add AI helpers; enterprise needs citations, no silent edits, evals. | AI exists for statement mapping/extraction and valuation advisory; model computations are deterministic; AI budgets are a separate governance topic. | AI as finance copilot: propose→accept assumptions/mappings with citations to statements/evidence; eval harness for extraction/mapping quality; cost controls. | Needs explicit audited AI proposals + eval coverage; ensure citations and “facts-only” constraints. | **EPIC‑AI‑FIN‑01** (extend): audited AI mapping/assumptions with citations. **EPIC‑AI‑FIN‑03**: eval harness for finance extraction/mapping. **EPIC‑AI‑GOV‑01** (shared). | GAP | P0 |

### 6.8 Reports

**Module snapshot**
- **As‑is**: Report Builder is feature-rich (templates, invocation profiles, RAG per section, quality gates, brand voice, exports, scheduled reports, KPI snapshots integration).
- **V4 target**: Enterprise report system: “source pack” UX + claim-level citations, data bindings with refresh+diff+approvals, template governance, and policy-driven distribution.
- **Top gaps**:
  - Claim/block-level citations enforcement (not only section-level traceability).
  - Data bindings + deterministic refresh engine (diff preview + approvals).
  - Template governance at scale (variables, versioning, regression harness for exports).
  - Distribution policies (who can send/share/export) + audit + retention.
- **P0 epics**: EPIC‑RPT‑01, EPIC‑RPT‑04, EPIC‑RPT‑05, EPIC‑AI‑RPT‑01, EPIC‑ENT‑AUDIT‑01, EPIC‑ENT‑POLICY‑01

**Benchmark leaders (from your list):** Notion AI, Microsoft Copilot (Word/Excel), Jasper, Writer

**SSOT anchors:**
- `docs/product/PRESENTATIONS_AND_REPORTS_V3.md`
- `docs/product/REPORT_GENERATOR_V3.md`
- `docs/product/SOURCE_TRACEABILITY_SPEC.md`
- `docs/REPORT_BUILDER_EXPORTS_STANDARD.md`

**As‑is anchors (code):**
- Frontend: `src/components/ReportsAndPresentations/ReportsAndPresentationsHub.tsx`, `src/components/ReportsAndPresentations/ReportsTabContent.tsx`, `src/components/assessment/ReportEditorModal.tsx` (assessment-linked), `src/components/ReportsAndPresentations/previews/ReportPreview.tsx`
- Backend: `server/src/routes/report-builder.routes.ts` (Report Builder core), `server/src/routes/results-kpi-reports.routes.ts` (KPI report snapshots → builder), `server/src/services/reportAgentService.ts`, `server/src/services/reportQualityGatesService.ts`

| Area (5) | Benchmark (leaders) | As‑is (Consultify code) | V4 target (enterprise) | Gap | Proposal (epics) | Status | V4 Priority |
|---|---|---|---|---|---|---|---|
| 1) Capabilities | Template-driven reports, data+doc ingestion, collaboration, versioning, exports, brand consistency. | Unified hub exists; Report Builder backend supports report CRUD/sections, AI agent messaging, RAG computation, quality gates, and exports (PDF/DOCX/PPTX). | Sponsor-ready reports (R1–R4) generated from platform artifacts, with traceability, quality gates, and consistent exports. | Need to ensure end-to-end “canonical R1–R4” completeness and policy enforcement; collaboration/audit readiness for enterprise. | EPIC‑RPT‑01: Canonical R1–R4 end-to-end (templates + data sources + RAG + escalation). EPIC‑RPT‑02: Versioning + review workflow hardening. EPIC‑RPT‑03: Export quality gates automation + regression harness. | GAP | P0 |
| 2) Integrations | Office ecosystem, Notion/Confluence export, data connectors, scheduled reports. | Backend has `exportReportToNotion` integration hook; KPI report snapshots feed into builder; multi-source is supported conceptually. | Connector framework for inputs and exports (Office/Notion/Confluence), scheduled reports with distribution (email/slack). | Scheduling and enterprise distribution policies not fully standardized; connector governance needs platformization. | EPIC‑INT‑RPT‑01: Scheduled reports + distribution policies. EPIC‑INT‑DOCS‑01: Export integrations (Notion/Confluence/SharePoint). | GAP | P1 |
| 3) AI enablement | AI drafting, summarization, style enforcement, brand voice, citations. | Report agent service exists; brand voice profile service exists; proposeOutline + knowledge map building exists. | AI as co-author: propose→accept blocks, citations to source artifacts, evaluated and auditable. | Ensure AI edits always propose→accept in UI; audit trail and eval harness needed. | EPIC‑AI‑RPT‑01: Audited AI proposals + citations. EPIC‑AI‑RPT‑02: Brand voice governance + per-org style profile. EPIC‑AI‑GOV‑01. | GAP | P0 |
| 4) UI/UX quality | Gamma-like low friction start, template-first, clean editing, predictable exports. | Hub + builder flow exists; exports endpoints exist; templates tab exists. | Unified generator UX across reports and decks, consistent preview panes, fast editing, accessibility. | Need consistency between legacy subsystems and v3 hub; performance and UX polish. | EPIC‑UX‑RPT‑01: Unify report generator entry points + reduce legacy surface duplication. EPIC‑UX‑RPT‑02: A11y/perf pass. | GAP | P1 |
| 5) Enterprise readiness | Audit logs, retention/legal hold, permissions, SSO/SCIM, export controls. | Auth exists; auto-version creation exists in report builder; but platform-wide audit/policy layer is not unified. | Enterprise governance: audit logs for edits/exports/shares, retention/legal hold, RBAC enforcement. | Cross-cutting audit/policy gaps; need consistent permission model for sharing and template scopes. | EPIC‑ENT‑AUDIT‑01, EPIC‑ENT‑POLICY‑01, EPIC‑ENT‑RBAC‑01. | GAP | P0 |

**Tasks do wdrożenia**
- [ ] Wdrożyć Source Pack Builder: unified artifact picker (initiative/tool/assessment/KPI/upload), upload bundle, enforced citations na poziomie block/claim
- [ ] Wdrożyć data bindings: sekcje raportu referencują dataset (KPI id, finance view); refresh engine z diff preview + approval gates
- [ ] Rozszerzyć template system: variables, versioning, org governance, regression harness dla exportów
- [ ] Zahardować brand voice: admin UX dla policy, hard mode (require source dla claims, no marketing language)
- [ ] Wdrożyć per-block AI propose→accept: diff preview, citations, audit, eval harness per report type
- [ ] Rozszerzyć scheduled distribution: approval gates przed send, recipient policies, proof of delivery, audit

**Plan pokrycia gapu**
- **Source Pack + citations**: UX "Select sources": multi-select z Initiatives/Assessments/Tools/KPI/Upload. Każdy block ma `source_refs[]` (artifactType, id, fragmentId). Quality gate: min citations coverage %. Claim-level: jeśli claim nie ma ref → gate fails.
- **Data bindings**: Block type `data_bound` z `bindingRef` (kpiId, financeViewId). Refresh: pobierz current value → diff vs last → jeśli zmiana, optional approval. Scheduled report run triggers refresh before generate.
- **Template governance**: Variables w template (np. {{clientName}}). Org templates: publish/deprecate workflow. Regression: golden reports per template; export diff przy zmianie engine.
- **Distribution policies**: Policy: kto może schedule, max recipients, allowed channels. Approval: przed pierwszym send dla nowego schedule. Proof: log (sentAt, channel, recipientCount, status).

#### 6.8.1 Reports (deep dive — Notion AI/Microsoft Copilot/Jasper/Writer)

**Benchmark notes (aligned with your prompt):**
- **Notion AI**: raport “z kontekstu” — AI widzi dokumenty + bazy danych, potrafi streszczać i budować raporty w stylu workspace; klucz: kontekst + linki do źródeł.
- **Microsoft Copilot (Word/Excel)**: raport “z danych” — dokument jest zasilany tabelami/arkuszami; klucz: **auto‑update** przy zmianie danych, plus standard Office i governance.
- **Jasper**: raport “z szablonu” — wiele wariantów tego samego dokumentu, workflow wersji, szybkie generowanie powtarzalnych raportów.
- **Writer**: raport “w standardzie organizacji” — style guide / brand voice, compliance, kontrola języka i claimów, audytowalność.

**As‑is verification anchors (code reality):**
- **Unified hub + preview**: `src/components/ReportsAndPresentations/ReportsAndPresentationsHub.tsx`, `src/components/ReportsAndPresentations/previews/ReportPreview.tsx`.
- **Report Builder orchestration**: `server/src/routes/report-builder.routes.ts`:
  - invocation profiles (source types + sections + allowed blocks): `server/src/config/reportInvocationProfiles.ts`
  - agent chat with diff preview and apply: `server/src/services/reportAgentService.ts`
  - canonical templates + outline proposals: `server/src/services/reportCanonicalTemplatesService.ts`
  - RAG computation per section/report: `computeRagForReport` in `server/src/services/ragLogicService.ts`
  - quality gates incl. traceability + numeric consistency + RAG consistency: `server/src/services/reportQualityGatesService.ts`
  - brand voice profile + compliance rules: `server/src/services/brandVoiceProfileService.ts`
  - integrations: `exportReportToNotion` hook and cloud upload flow inside `server/src/routes/report-builder.routes.ts`
  - “bring your own docs”: upload bundle sources + `upload-chaos` endpoints for file ingestion.
- **Scheduled reporting**: `server/src/routes/scheduled-reports.routes.ts` + `server/src/services/scheduledReportService.ts` (cron presets, delivery methods, executions).
- **Source type coverage evidence**: profiles include both narrow and mixed contexts (e.g. `ASSESSMENT`, `TOOL`, `RESULTS_KPI_REPORT`, plus a mixed profile that allows `ASSESSMENT/TOOL/INITIATIVE/INTERVIEW/UPLOAD_BUNDLE`).

| Slice (report generators) | Benchmark (leaders) | As‑is (Consultify code) | V4 target (enterprise) | Gap | Proposal (epics) | Status | V4 Priority |
|---|---|---|---|---|---|---|---|
| 1) “Report from context” (workspace knowledge) | Notion AI: uses doc + DB context; links back to sources. | RAG compute exists; knowledge map builder exists; report sections can store `source_refs_json`; quality gates explicitly check traceability coverage. | One “source pack” UX: pick internal artifacts + optionally upload docs; system generates a traceable report where every claim can show sources. | UX/contract needs hardening: enforce citations at block/claim level (not only section-level); unify “select sources” flow across modules. | **EPIC‑RPT‑04**: Source Pack Builder (artifact picker + upload bundle) + enforced citations. **EPIC‑ENT‑LINEAGE‑01** (shared): lineage/provenance for generated claims. | GAP | P0 |
| 2) “Report from data” + auto‑update | Copilot/Excel: living doc tied to live data; refresh with changes; governance. | Scheduled reports exist (time-based generation); KPI report snapshots exist (Results → builder). | Live bindings: reports can reference datasets (KPIs/finance/execution) and refresh sections deterministically, with diff preview and approval gates. | Missing first-class “data binding” model and change-driven refresh; scheduled runs are not the same as live bindings with diffs. | **EPIC‑RPT‑05**: Data bindings + refresh engine (diff + approvals). **EPIC‑INT‑ALERT‑01** (extend): notifications when bindings refresh or drift. | GAP | P0 |
| 3) Template system + variants | Jasper: repeatable templates, variants, fast iteration, A/B versions. | Invocation profiles + canonical templates exist; proposeOutline exists; auto-version exists on status change in report builder. | Template catalog that is org-scoped with variables, versioning, and “variant generation” (audience/goals) with controlled diffs. | Need richer “template product”: variables, reusable blocks, org template governance, and regression harness for exports. | **EPIC‑RPT‑01** (extend): canonical templates + variable system. **EPIC‑RPT‑03** (extend): export regression harness + template QA gates. | GAP | P0 |
| 4) Brand voice + compliance (Writer parity) | Writer: style guide, forbidden words, compliance, claims policy, audit trail. | Brand voice profile exists (vocab, hedging rules, compliance rules); quality gate 7 validates content against profile; quality gate 8 enforces traceability coverage thresholds. | Enterprise compliance mode: enforce “require source for claims” + “no marketing language” + “recommendations need next step” across all generated sections; audit logs for AI edits + exports. | Some checks exist but enforcement is mostly “gates” not hard policy; need org-admin UX to manage policy and see violations at claim-level. | **EPIC‑AI‑RPT‑02** (extend): brand voice admin + hard policy mode. **EPIC‑ENT‑AUDIT‑01**/**EPIC‑ENT‑POLICY‑01** (shared). | GAP | P0 |
| 5) AI “agentic editing” with safe apply | Notion/Copilot: iterate conversationally; keep control. | Report agent supports section reorder/add/remove/update with diff preview + apply. | Propose→accept for *content* and *structure* with per-block diffs; AI actions are auditable and reversible; eval harness for quality. | Structure-level agent exists; content-level propose→accept + evaluation harness needs to be systematic. | **EPIC‑AI‑RPT‑01** (extend): audited AI edits + citations + per-block diffs. **EPIC‑AI‑EVAL‑01** (shared): eval harness per report type. | GAP | P0 |
| 6) Distribution + channels | Copilot/enterprise suites: scheduled packs, distribution, storage, permissions. | Scheduled reports service exists with delivery methods (email/webhook/storage/dashboard). | Board-ready distribution: scheduled exec packs, approval gates before send, retention rules, and recipient policies per org. | Need end-to-end policy enforcement (who can send what to whom), plus consistent “proof of delivery” and audit. | **EPIC‑INT‑RPT‑01** (extend): scheduled distribution policies + approvals. **EPIC‑ENT‑POLICY‑01** (shared). | GAP | P1 |

### 6.9 Presentations (Decks)

**Module snapshot**
- **As‑is**: Wizard + generator + template system exist, plus a WYSIWYG deck builder with deterministic layouts, refresh endpoints, exports, share links and quality gates (collab hook in UI, but realtime backend not evidenced).
- **V4 target**: Consulting-grade deck system: context-pack→deck with slide/block citations, data bindings + refresh diffs, governed templates/brand kits, PPTX import/export fidelity, and enterprise sharing/audit.
- **Top gaps**:
  - Block-level citations + refresh diffs + approvals (regeneration must be auditable and safe).
  - PPTX import + round-trip fidelity regression harness.
  - Realtime collaboration backend (presence→CRDT) and permissions.
  - Template governance (variables, approvals, deprecation) and media rights/entitlements.
- **P0 epics**: EPIC‑DECK‑01, EPIC‑DECK‑04, EPIC‑DECK‑03, EPIC‑AI‑DECK‑01, EPIC‑ENT‑RT‑01, EPIC‑ENT‑AUDIT‑01

**Benchmark leaders (from your list):** Gamma, Beautiful.ai, Pitch, Canva, PowerPoint + Copilot

**SSOT anchors:**
- `docs/product/PRESENTATIONS_AND_REPORTS_V3.md`
- `docs/product/PRESENTATION_GENERATOR_V3.md`
- `docs/REPORT_BUILDER_EXPORTS_STANDARD.md` (PPTX export baseline)
- `docs/product/SOURCE_TRACEABILITY_SPEC.md`

**As‑is anchors (code):**
- Frontend: `src/components/Presentations/PresentationWizard.tsx`, `src/components/Presentations/PresentationsHub.tsx`, `src/components/Presentations/DeckBuilder/DeckBuilder.tsx`, `src/components/Presentations/DeckTemplateGallery.tsx`
- Backend: `server/src/routes/presentations.routes.ts`, `server/src/services/presentationGeneratorService.ts`

| Area (5) | Benchmark (leaders) | As‑is (Consultify code) | V4 target (enterprise) | Gap | Proposal (epics) | Status | V4 Priority |
|---|---|---|---|---|---|---|---|
| 1) Capabilities | Fast deck generation, beautiful layouts, collaborative editing, template system, branding, exports. | Presentation wizard and templates exist (SSOT notes MVP as-is); backend supports templates + outline + deck generation. | Gamma-like deck builder with brand kit first, slide/block intents, layout engine, and traceability to artifacts. | Need full “target v3” features (presentation modes, visuals engine, online view) and enterprise collab/audit readiness. | EPIC‑DECK‑01: Deck builder parity (block editing + layout engine + intents). EPIC‑DECK‑02: Brand kit + media library + theme governance. EPIC‑DECK‑03: Export hardening (PPTX quality + reproducibility). | GAP | P0 |
| 2) Integrations | Import/export PowerPoint, assets library, data-linked charts. | Templates endpoint exists; deck list endpoint exists; generation pipeline exists. | Import from PPTX, asset pipeline, and data-linked visuals with refresh. | PPTX import and data refresh pipelines need design/hardening. | EPIC‑INT‑DECK‑01: PPTX import + slide mapping. EPIC‑INT‑MEDIA‑01: Media library + rights/entitlements. | GAP | P1 |
| 3) AI enablement | Outline generation, slide rewriting, auto-layout, visual suggestions, tone consistency. | `generateOutline` and `generateDeck` exist; wizard collects audience/goal/theme/confidentiality; AI-driven pipeline exists. | AI as deck co-author: propose→accept changes, explainable, citations to artifacts, eval harness. | Need audit trail, evals, and consistent propose→accept at block level. | EPIC‑AI‑DECK‑01: Audited AI block proposals + citations. EPIC‑AI‑GOV‑01. | GAP | P0 |
| 4) UI/UX quality | “Click, approve, wow” in <60s, minimal clutter, premium interactions. | Hub + wizard exist; deck library table+cards pattern exists. | Consistent generator UX across Reports/Decks; strong preview; accessible editing; performance budgets. | Need further UX consolidation and polish; ensure SSOT mismatch (MVP vs target) is reflected in UI labels. | EPIC‑UX‑DECK‑01: Generator UX polish + compliance. EPIC‑UX‑DECK‑02: Performance budgets + A11y. | GAP | P1 |
| 5) Enterprise readiness | Audit logs, retention, permissions, sharing, SSO/SCIM, legal/compliance. | Auth exists; templates are org/system scoped; exports exist. | Enterprise governance for decks: share links, audit logs, retention/legal hold, RBAC enforcement. | Cross-cutting audit/policy gaps. | EPIC‑ENT‑AUDIT‑01, EPIC‑ENT‑POLICY‑01, EPIC‑ENT‑RBAC‑01. | GAP | P0 |

**Tasks do wdrożenia**
- [ ] Wdrożyć block-level traceability: każdy block ma sourceRefs; citation UI przy hover/click
- [ ] Wdrożyć deck refresh engine: bindings do artifacts, refresh z diff preview, approval gates przed apply
- [ ] Zahardować layout rules: auto-layout engine z guardrails (spacing, typography); export fidelity QA + regression tests
- [ ] Rozszerzyć template governance: variables, versioning, consulting pack templates (status report, steerco, roadmap)
- [ ] Wdrożyć PPTX import: mapowanie slajdów do blocks, round-trip gdzie możliwe
- [ ] Zintegrować realtime (EPIC‑ENT‑RT‑01): WebSocket dla DeckBuilder, presence, cursors
- [ ] Wdrożyć media library governance: rights, entitlements, watermarking dla public share

**Plan pokrycia gapu**
- **Block citations + refresh**: Block ma `sourceRefs` (artifactType, id, fragment). Citation UI: chip przy block, modal z preview. Refresh: `useDataRefresh` rozszerzyć o diff; jeśli zmiana znacząca → wymagana akceptacja. Audit: każdy refresh zapisany.
- **Layout rules**: LayoutEngine rozszerzyć o rules (min spacing, max text density). Przy naruszeniu: warning w editorze. Export: regression — golden decks, diff PNG przy zmianie pipeline.
- **Template governance**: Variables w template ({{initiativeName}}). Consulting packs: status report, steerco, transformation roadmap — wymagane sekcje, intent catalog. Approval dla org templates.
- **PPTX import**: Parser PPTX → blocks (text, image, chart). Mapping: slide→card, shape→block. Round-trip: export→import zachowuje strukturę gdzie możliwe; raport "what was lost".

#### 6.9.1 Presentations (deep dive — Gamma/Beautiful.ai/Pitch/Canva/PowerPoint+Copilot)

**Benchmark notes (aligned with your prompt):**
- **Gamma**: “text/data → structured deck” + quick editing; AI can regenerate parts as content changes; emphasis on narrative flow + modern visual defaults.
- **Beautiful.ai**: auto-layout rules enforce good design; user focuses on content, system keeps alignment/spacing hierarchy consistent.
- **Pitch**: real-time collaboration, comments, share links, and data-linked slides that can refresh.
- **Canva**: massive template library + brand kits + easy asset workflows; speed for non-designers; export compatibility.
- **PowerPoint + Copilot**: enterprise standard; generate from doc/report; incremental updates; strongest requirement is **PPTX compatibility** and governance.

**As‑is verification anchors (code reality):**
- **Wizard (Gamma-like flow)**: `src/components/Presentations/PresentationWizard.tsx` (sources → setup → outline → generate → result).
- **Deck generator pipeline**: `server/src/routes/presentations.routes.ts` + `server/src/services/presentationGeneratorService.ts`:
  - `POST /api/presentations/generate/outline` + `POST /api/presentations/generate/deck`
  - sources include platform artifacts (initiative/execution/kpi_roi/raid/assessment/tool_session/report/valuation/financial_analysis)
  - PPTX via `PptxPipelineService` (see `server/src/services/presentationGeneratorService.ts`)
- **Templates + intents + brand kit**:
  - templates CRUD + clone: `/api/presentations/templates/*` (DB: `presentation_templates`)
  - intent catalog: `GET /api/presentations/intents` (DB: `presentation_intents`)
  - brand kit: `GET/PUT /api/presentations/brand-kit` (DB: `brand_kits`)
- **Deck editing surface**: `src/components/Presentations/DeckBuilder/DeckBuilder.tsx` (WYSIWYG cards/blocks) with:
  - deterministic layout selection engine: `src/components/Presentations/DeckBuilder/layouts/LayoutEngine.ts`
  - per-block data refresh hook: `src/components/Presentations/DeckBuilder/useDataRefresh.ts` backed by `POST /api/presentations/decks/:deckId/cards/:cardId/blocks/:blockId/refresh`
  - collaboration UI hook exists: `src/components/Presentations/DeckBuilder/useCollaboration.ts` (WebSocket presence), but server WS endpoint is not evidenced in `server/src/`
- **Exports & distribution**:
  - PPTX download: `GET /api/presentations/decks/:id/download`
  - HTML export: `POST /api/presentations/decks/:deckId/export/html`
  - per-card SVG “PNG export” zip (implemented as SVGs): `POST /api/presentations/decks/:deckId/export/png`
  - share token links + analytics: `POST /api/presentations/decks/:id/share` + `/api/presentations/decks/:deckId/analytics/*`
  - quality gates: `POST /api/presentations/decks/:deckId/quality-gates` (service: `server/src/services/presentationQualityGatesService.ts`)
  - autosave: `PUT /api/presentations/decks/:deckId/autosave`
- **Media library**: `GET /api/presentations/media` (DB: `organization_media`)

| Slice (presentation platforms) | Benchmark (leaders) | As‑is (Consultify code) | V4 target (enterprise) | Gap | Proposal (epics) | Status | V4 Priority |
|---|---|---|---|---|---|---|---|
| 1) “From company context” deck generation | Gamma/Copilot: generate from text/docs/data; maintain narrative structure as inputs evolve. | Generator consumes platform artifacts (incl. KPI/ROI, execution, assessments, valuations) and creates outline + deck; traceability fields exist in setup. | Consulting-grade “context pack → deck” with citations per slide/block, and refreshable cards when underlying artifacts change. | Need systematic citations at block level + deterministic refresh model + governance (diff/approval) for regenerated content. | **EPIC‑DECK‑01** (extend): block-level traceability + citation UI. **EPIC‑DECK‑04**: deck refresh engine (bindings + diff + approvals). | GAP | P0 |
| 2) Auto-layout + visual consistency | Beautiful.ai: layout rules keep decks “beautiful by default”. | Deterministic `LayoutEngine` with curated templates; deck quality gates include layout variety + text density checks. | Auto-layout rules + “design guardrails”: enforce spacing, typography, image density, and mode-specific density with preview warnings. | Need deeper “rules engine” + consistent enforcement in editor; ensure export matches editor faithfully. | **EPIC‑DECK‑01** (extend): layout rules engine + enforcement. **EPIC‑DECK‑03** (extend): export fidelity QA + regressions. | GAP | P0 |
| 3) Template library + brand kits (“formatki konsultingowe”) | Canva: templates at scale + brand kits; organizations standardize decks. | Templates exist (system/org) with clone/edit; brand kit exists (colors/fonts/footer/confidentiality); intent catalog exists. | Consulting playbook templates (status report, steering committee pack, transformation roadmap) with org governance, versioning, and required intents/sections. | Need template governance product (variables, versioning, approval, deprecation) and “formatki” as first-class deliverables. | **EPIC‑DECK‑02** (extend): template governance + consulting pack templates. **EPIC‑ENT‑APPROVAL‑01** (shared): approvals for org templates. | GAP | P0 |
| 4) Data-linked slides + refresh | Pitch/Copilot: data-linked charts/tables refresh as data changes. | Per-block refresh endpoint exists and supports some artifact types; hook marks outdated data heuristically (time-based). | True data bindings: refresh triggers based on source `updated_at`, explicit SLAs, and visible “data changed” diffs. | Refresh is partial and heuristic; bindings schema is not a formal contract; no event-driven refresh. | **EPIC‑DECK‑04**: formal data bindings + event-driven refresh + diffs. **EPIC‑INT‑ALERT‑01** (extend): notify owners about stale decks. | GAP | P0 |
| 5) Collaboration (real-time) | Pitch: realtime co-editing, presence, comments, permissions. | Share links + analytics exist; collaboration hook exists in UI, but server WS/collab backend not evidenced. | Realtime collaboration baseline: presence + comments + CRDT co-editing for deck JSON, with audit and permissions. | Missing backend realtime platform + conflict-free editing; current collab appears stubbed. | **EPIC‑ENT‑RT‑01** (shared): realtime platform (presence→CRDT). **EPIC‑DECK‑COLLAB‑01**: deck collaboration integration + permissions. | GAP | P0 |
| 6) PowerPoint compatibility (import/export) | PowerPoint standard: import existing PPTX, round-trip fidelity. | PPTX export exists; no PPTX import surfaced. | PPTX import + mapping to cards/blocks + theme mapping; predictable export fidelity across versions. | No PPTX import; round-trip fidelity not guaranteed without regression harness. | **EPIC‑INT‑DECK‑01** (extend): PPTX import + slide mapping. **EPIC‑DECK‑03** (extend): export reproducibility harness. | GAP | P1 |
| 7) Assets & rights/entitlements | Canva: asset library, licensing, org-level media governance. | Media library endpoint exists; brand kit supports logo/fonts/colors; visuals pipeline exists in generator. | Enterprise media library: rights metadata, expiry, entitlements, reuse tracking, and safe AI image generation policy. | Rights management + entitlements not modeled; AI image governance needs policy + audit. | **EPIC‑INT‑MEDIA‑01** (extend): media library rights/entitlements. **EPIC‑AI‑GOV‑01** (shared): policy/audit for AI visuals. | GAP | P1 |
| 8) Distribution + analytics | Pitch/Canva: share, embed, analytics; enterprises need audit + retention. | Share tokens + embed/HTML export + analytics exist; quality gates exist; autosave exists. | Distribution policies: who can share/export/embeds; retention/legal hold; auditable access logs; scheduled decks optional. | Needs policy + audit hardening and admin controls for sharing/embedding. | **EPIC‑ENT‑AUDIT‑01**/**EPIC‑ENT‑POLICY‑01**/**EPIC‑ENT‑RBAC‑01** (shared). | GAP | P0 |

### 6.10 Enterprise Platform (cross-cutting)

**Module snapshot**
- **As‑is**: PBAC/RBAC patterns exist; AI model routing/governance exists in parts; observability/security are present but not an explicit unified enterprise layer.
- **V4 target**: Enterprise baseline for all modules: identity (SSO/SCIM), policy engine (retention/legal hold/residency), audit logs, integration hub, realtime collaboration platform, and AI governance/evals.
- **Top gaps**:
  - Unified audit log and policy enforcement across all modules (read/write/export/automation).
  - SSO/SCIM readiness and capabilities enforcement as a contract.
  - Connector governance (queues/retry/secrets/residency).
  - Realtime platform (presence→CRDT) reused by all “workspace” surfaces.
- **P0 epics**: EPIC‑ENT‑ID‑01, EPIC‑ENT‑ID‑02, EPIC‑ENT‑AUDIT‑01, EPIC‑ENT‑POLICY‑01, EPIC‑ENT‑INT‑01, EPIC‑ENT‑RT‑01

**Scope:** cross-module enterprise baseline (not a single product module).

**SSOT anchors:**
- `docs/product/ROLES_MODEL.md` (effective roles + capabilities)
- `docs/product/MODEL_REGISTRY_V3.md` + `docs/product/modules/ai/AI_PRICING_COST_CONTROLS_V3.md` (AI governance)
- `docs/product/SYSTEM_ARCHITECTURE_BRIEF.md` (multi-tenancy + artefacts)

**As‑is anchors (code):**
- RBAC/PBAC: `server/src/middleware/permission.middleware.ts`, `server/src/services/permissionService.ts`
- AI routing/governance surfaces: `server/src/services/ai/modelRouter.ts`, `server/src/routes/llm.routes.ts`, `src/components/SuperAdmin/ModelTierAssignments.tsx` (as referenced by SSOT)
- Audit examples exist in some modules (e.g. assessment audit logger, report auto-version), but not yet unified platform-wide.

| Area (5) | Benchmark (enterprise baseline) | As‑is (Consultify code) | V4 target (enterprise) | Gap | Proposal (epics) | Status | V4 Priority |
|---|---|---|---|---|---|---|---|
| 1) Capabilities | SSO (SAML/OIDC), SCIM provisioning, RBAC/capabilities, audit logs, policy engine (retention/legal hold), admin/superadmin separation. | PBAC middleware exists + database-backed permission service; roles model exists in SSOT. | Full identity and policy layer: SSO/SCIM, org policies, capabilities per workflow gate, audit logs for all sensitive actions. | SSO/SCIM not evidenced; audit logs not unified; policy engine not implemented end-to-end. | EPIC‑ENT‑ID‑01: SSO (OIDC/SAML) + session hardening. EPIC‑ENT‑ID‑02: SCIM provisioning + deprovisioning. EPIC‑ENT‑RBAC‑01: Capabilities contract enforced across modules. EPIC‑ENT‑AUDIT‑01: Unified audit log (actor/action/resource/before/after). EPIC‑ENT‑POLICY‑01: retention/legal hold/residency. | GAP | P0 |
| 2) Integrations | Enterprise integrations hub, webhooks, connector governance, data residency controls. | Some integration hooks exist (e.g. MCP client utilities; Notion export hook in report builder). | Integration hub with connectors lifecycle, retry/queue, conflict handling, secrets vaulting, per-org allowlists. | No unified connector governance and ops; residency allowlists need enforcement. | EPIC‑ENT‑INT‑01: Integration hub (connectors + queues + audit). EPIC‑ENT‑SECRETS‑01: Secrets management + rotation. EPIC‑ENT‑RESIDENCY‑01: Residency/region policies enforced by provider routing. | GAP | P0 |
| 3) AI enablement | Model registry, purposes/assignments, usage metering, budgets/limits, evals, safe fallbacks, audit. | Model registry SSOT exists; routing tiers exist; cost controls SSOT exists; per-feature AI exists in multiple modules. | Enterprise AI governance: per-purpose metering and budgets, price snapshots, eval pipelines, prompt/version registry, and audited actions (incl. AI-triggered changes). | Evals/audit/meters may be partial; need consistent “AI propose→accept” + replay in every editing surface. | EPIC‑AI‑GOV‑01: Purposes registry + metering + budgets + alerts. EPIC‑AI‑GOV‑02: Prompt/version registry + reproducibility. EPIC‑AI‑EVAL‑01: Evaluation harness (golden sets) per module. | GAP | P0 |
| 4) UI/UX quality | Admin consoles that are consistent, safe, and explain policies (no hidden state). | SuperAdmin/Admin surfaces exist across app; standards exist. | Unified admin IA: org settings, roles, AI policies, integrations, audit viewer; consistent tables/filters and safe destructive actions. | Needs consolidation and consistency (single admin mental model). | EPIC‑ENT‑ADMIN‑01: Unified Admin/SuperAdmin IA + UI standards compliance. | GAP | P1 |
| 5) Enterprise readiness | Observability (logs/metrics/traces), DR/backup, security (OWASP), compliance (SOC2/ISO), realtime collaboration for workspaces. | Logging utilities exist; no explicit realtime collab baseline in v3 program. | Full ops readiness: tracing + SLOs, DR plans, security scanning, and realtime collab roadmap (presence→CRDT) for workspace surfaces. | Observability/DR/security posture needs explicit hardening; realtime collab not implemented. | EPIC‑ENT‑OBS‑01: Observability stack (metrics/traces) + SLOs. EPIC‑ENT‑DR‑01: Backup/restore + DR drills. EPIC‑ENT‑SEC‑01: Security hardening (rate limiting, secrets, OWASP). EPIC‑ENT‑RT‑01: Realtime collaboration platform (presence→CRDT). | GAP | P0 |

**Tasks do wdrożenia**
- [ ] Wdrożyć SSO (OIDC/SAML): provider config per org, session hardening, logout propagation
- [ ] Wdrożyć SCIM: provisioning/deprovisioning, group sync, conflict handling
- [ ] Zbudować unified audit log: tabela `audit_events`, middleware per route, actor/action/resource/before/after, query API
- [ ] Wdrożyć policy engine: retention/legal hold/residency rules; enforcement hooks w routes; admin UI
- [ ] Zbudować integration hub: connector registry, queue/retry, secrets vaulting, per-org allowlists, conflict handling
- [ ] Wdrożyć realtime platform: WebSocket gateway, presence service, CRDT store (Yjs/Automerge), permission-aware sync
- [ ] Zahardować AI governance: purposes registry, per-purpose metering, budgets + alerts, prompt/version registry, eval pipelines
- [ ] Wdrożyć observability: metrics (Prometheus), traces (OpenTelemetry), SLOs, DR drills, security hardening (OWASP, rate limits)

**Plan pokrycia gapu**
- **Audit log**: Tabela `audit_events` (actorId, actorType, action, resourceType, resourceId, before, after, metadata, timestamp). Middleware `requireAudit` wrapuje write routes; before/after diff gdzie możliwe. Query: filters (resource, actor, date range). Retention policy per org.
- **Policy engine**: Tabela `org_policies` (retentionDays, legalHoldEnabled, residencyRegion). Enforcement: przed delete/export — sprawdzenie policy; block jeśli legal hold. Residency: routing do providera w regionie.
- **Integration hub**: Connector = definicja (type, configSchema). Job = run (connectorId, params). Queue: Bull/BullMQ; retry with backoff; dead-letter. Secrets: HashiCorp Vault lub env-scoped encryption. Allowlist: org może wyłączyć konkretne connectory.
- **Realtime**: WebSocket gateway (Socket.io lub custom). Presence: userId→{ docIds, cursor }. CRDT: Yjs doc per workspace; sync via provider; permission check przed subscribe. Audit: collaborative edits zapisywane w audit z before/after.

### 6.11 Organization (Benchmarking + Knowledge Graph)

**Module snapshot**
- **As‑is**: Benchmarking API is a stub (503); LinkGraph exists; KG extraction exists (entities/relations from AI) but is not productized as a unified query/explain layer.
- **V4 target**: Org-level “company intelligence”: governed benchmarking datasets + privacy rules and a unified knowledge graph (typed nodes/edges + provenance) powering Assessments/Execution/AI Advisor.
- **Top gaps**:
  - Benchmark datasets ingestion + compare contract + cohort privacy controls (backend not shipped).
  - Unified KG query/search/explain API (merge LinkGraph + KG extraction) with permission-aware results.
  - Provenance/lineage as a first-class contract for “why” explainers and AI recommendations.
  - Governance: PII redaction strategy, retention/legal hold, and audit for reads/exports.
- **P0 epics**: EPIC‑BMK‑01, EPIC‑BMK‑02, EPIC‑KG‑01, EPIC‑KG‑02, EPIC‑KG‑03, EPIC‑ENT‑LINEAGE‑01

**Intent:** add org-level “company intelligence” capabilities that power Assessments/Execution/Results without duplicating those modules.

**SSOT anchors:**
- `docs/product/modules/admin/ADMIN_ORGANIZATION_MODULE_FINAL.md` (current Organization admin scope)
- `docs/product/LINK_GRAPH_V3.md` (backlinks / “Used in”)

**As‑is anchors (code reality):**
- **Benchmarking API is a stub**: `server/src/routes/benchmark.routes.ts` returns `503 not_configured` (the UI already expects benchmark comparisons in Assessments, but backend is not shipped).
- **LinkGraph (typed edges for traceability)**: `server/src/routes/my-work.routes.ts` includes Link Graph v3 backlinks endpoint (`/api/my-work/link-graph/backlinks`) backed by `link_graph_edges`.
- **Knowledge Graph extraction (org-level entities/relations)**: `server/src/services/ai/knowledgeGraphService.ts`
  - stores `knowledge_graph_entities` + `knowledge_graph_relations` (Postgres tables)
  - is invoked best-effort post AI stream: `server/src/routes/ai.routes.ts` calls `processConversation(...)`
- **Knowledge Base / Knowledge admin surfaces exist separately**: `server/src/routes/knowledgeBase.routes.ts` (KB articles/categories/search) and `server/src/routes/knowledge.routes.ts` (knowledge candidates/strategies/docs; parts are “not_configured” depending on service availability).

**Tasks do wdrożenia**
- [ ] Uruchomić benchmark backend: zastąpić stub 503; dataset registry, ingestion pipeline, refresh cadence, versioning
- [ ] Wdrożyć cohort privacy: min N, suppression rules, noise/rounding, audit dla benchmark queries
- [ ] Zbudować framework mappings: SIRI/ADMA/DRD/ISO — dimension-level percentiles, "what good looks like", disclaimers
- [ ] Wdrożyć pipeline benchmark→gap→initiatives: automatyczne programy naprawcze z traceability
- [ ] Zunifikować KG schema: jeden model (LinkGraph + KG extraction), typowane nodes/edges, provenance per edge
- [ ] Wdrożyć query API + UI explorer: graph traversal, semantic search, permission-aware filtering
- [ ] Zahardować provenance: source artifact IDs, timestamps, actor, confidence; "why explainers" w UI
- [ ] Wdrożyć KG governance: permission-aware edges, retention/legal hold, PII redaction (UUID-only w KG), audit reads/exports
- [ ] Rozszerzyć freshness: scheduled rebuilds, dedup/merge, confidence decay, monitoring coverage/drift

**Plan pokrycia gapu**
- **Benchmark service**: Tabela `benchmark_datasets` (name, version, dimensions[], industry, region, size, sourceRef). Ingestion: job per dataset; refresh cadence configurable. API `GET /api/benchmark/compare` (framework, orgId, dimensions) zwraca percentiles z privacy guard (suppress jeśli cohort < minN).
- **Cohort privacy**: Konfig `minCohortSize` (default 5). Przy query: jeżeli N < min → zwróć "insufficient data" lub aggregate tylko. Optional: noise injection, rounding do 5. Audit: każdy benchmark query w audit_log.
- **Unified KG**: Jeden schema `graph_nodes` (type, attributes, sourceRef, createdAt) + `graph_edges` (fromId, toId, type, sourceRef, confidence, actorId). Merge: LinkGraph edges = traceability; KG extraction = entities/relations. Provenance: każda krawędź ma sourceRef (artifact, timestamp).
- **Query + search**: API `/api/kg/query` (traversal, filters). Semantic: embeddings dla nodes; vector search. Permission: filtruj po org/project przed zwrotem. UI explorer: graph view + "where used" + "what depends on".

#### 6.11.1 Benchmarking (deep dive — SIRI/GA Benchmarks/Cohort assessments)

**Benchmark notes (market patterns):**
- **INCIT SIRI**: global benchmarking model (“3B benchmark”: best-in-class / broad middle / bottom) used to contextualize maturity scores: `https://incit.org/en_nz/what-we-do/siri/assessment/`
- **Benchmarking privacy patterns (percentiles + thresholds)**: aggregated benchmarks expose percentiles (median/25/75) and suppress small cohorts to prevent re-identification (common approach): `https://support.google.com/analytics/answer/16388466`
- **Cohort benchmarking**: cohort tools often require a minimum cohort size (e.g. \(N \ge 5\)) and only return aggregated insights: `https://www.dataorchard.org.uk/cohort-dma-and-pricing`

| Slice (benchmarking) | Benchmark (leaders) | As‑is (Consultify code) | V4 target (enterprise) | Gap | Proposal (epics) | Status | V4 Priority |
|---|---|---|---|---|---|---|---|
| 1) Benchmark datasets + ingestion | SIRI-like: curated datasets + refresh/versions; GA-style: stable peer group definitions. | Backend benchmark route is a stub (503). | Dataset registry: versioned benchmark datasets (industry/region/size), ingestion pipelines, refresh cadence, and provenance of sources. | No datasets, no ingestion, no refresh governance; UI contracts can’t be satisfied. | **EPIC‑BMK‑01**: Benchmark service (datasets + ingestion + API contract + privacy rules). | GAP | P0 |
| 2) Cohort privacy + disclosure controls | Percentiles + suppression thresholds; minimum cohort size; avoid “small cell” leakage. | Not implemented; no cohort model. | Cohort privacy rules: minimum \(N\), suppression, noise/rounding policies (optional), audit log for benchmark queries, and policy controls. | No privacy framework for benchmarking; risks data leakage when org count is small. | **EPIC‑BMK‑01** (extend): cohort privacy rules + query guardrails. **EPIC‑BMK‑03**: governance + audit. | GAP | P0 |
| 3) “What good looks like” per framework | SIRI/ISO tools: benchmarks tied to model dimensions, with narrative interpretation. | Assessments have rich scoring UX, but benchmark backend is missing. | Per-framework benchmark packs (SIRI/ADMA/DRD/ISO): dimension-level percentiles + “what good looks like” guidance; disclaimers. | Missing benchmark packs and dimension mappings. | **EPIC‑BMK‑01** (extend): framework mappings + percentile engine. | GAP | P0 |
| 4) Benchmark → Gap → Initiatives | Leaders connect benchmark gaps to recommendations/programs. | Initiative generator exists in Assessments, but not benchmark-driven as a first-class pipeline. | Automated program generation: benchmark gaps → recommended initiatives/programs with constraints, sequencing, and expected KPI impacts. | Missing end-to-end pipeline with traceability and governance. | **EPIC‑BMK‑02**: Benchmark→Gap→Initiatives pipeline (automatyczne programy naprawcze). | GAP | P0 |
| 5) Benchmark governance (enterprise) | Versioning, source citations, auditability, legal disclaimers. | Not implemented (benchmark stub). | Benchmark governance: dataset versioning, source citations, audit events, retention policies, and entitlements if dataset is licensed. | Missing platform-wide audit/policy enforcement for benchmark usage. | **EPIC‑BMK‑03**: Benchmark governance (wersjonowanie, źródła, audyt). **EPIC‑ENT‑AUDIT‑01**/**EPIC‑ENT‑POLICY‑01** (shared). | GAP | P0 |

#### 6.11.2 Knowledge Graph firmy (deep dive — Stardog/Palantir Foundry/Neo4j/GraphDB)

**Benchmark notes (market patterns):**
- **Stardog**: enterprise KG platform (semantic unification, inference, connectors): `https://www.stardog.com/platform/`
- **Palantir Foundry**: ontology modeling + object permissioning + lineage: `https://palantir.com/docs/foundry/ontology/overview/`, `https://palantir.com/docs/foundry/ontologies/ontology-permissions/`, `https://palantir.com/docs/foundry/workflow-lineage/getting-started/`
- **Neo4j**: fine-grained access control incl. property-based controls (important for multi-tenant/privacy): `https://neo4j.com/docs/operations-manual/current/authentication-authorization/property-based-access-control/`
- **Ontotext GraphDB**: SHACL validation + fine-grained access control (data quality + governance): `https://graphdb.ontotext.com/documentation/11.0/fine-grained-access-control.html`, `https://graphdb.ontotext.com/documentation/10.0/shacl-validation.html`

| Slice (knowledge graph) | Benchmark (leaders) | As‑is (Consultify code) | V4 target (enterprise) | Gap | Proposal (epics) | Status | V4 Priority |
|---|---|---|---|---|---|---|---|
| 1) Canonical graph schema (ontology) | Ontology-first: object types + link types + rules, consistent across apps. | LinkGraph edges exist (traceability). Separate KG extraction stores entities/relations from AI conversations. | Unified KG schema (typed nodes/edges) that covers initiatives/KPI/decisions/risks/sources/org facts; supports both traceability and “company memory”. | Two parallel graphs (LinkGraph vs KG extraction) are not unified; ontology not explicit. | **EPIC‑KG‑01**: Unified Knowledge Graph schema + typed edges + provenance. | GAP | P0 |
| 2) Provenance + lineage (“why”) | Leaders show “why” via lineage + sources + evidence; explainability is mandatory for enterprise AI. | LinkGraph supports backlinks (“Used in”). KG extraction has `confidence` and could store attributes, but sources/citations aren’t a strict contract. | Provenance per edge: source artifact IDs + timestamps + actor (human/AI) + confidence; “why explainers” in UI for recommendations and reports. | Missing strict provenance contract and UI explainers; needs convergence with report/deck citations. | **EPIC‑KG‑02**: Graph queries + “why” explainers. **EPIC‑ENT‑LINEAGE‑01** (shared). | GAP | P0 |
| 3) Query + search (semantic) | Graph queries + semantic search + filters; cross-app discovery (“where used”). | Backlinks endpoint exists; KG context is used in AI pipeline (`buildGraphContext`). | Search layer: semantic search + graph traversal queries (who owns, what depends on, what is blocked by), with permission-aware filtering. | Missing productized query API and UI surfaces; today it’s mostly internal/supporting. | **EPIC‑KG‑02** (extend): query API + UI explorer + embeddings-powered search. | GAP | P0 |
| 4) Governance (access control, retention, PII) | Fine-grained access control (ABAC/PBAC), retention/legal hold, PII redaction patterns. | Platform PBAC exists; no explicit KG policy layer; knowledge routes include quota scaffolding but some services are not configured. | KG governance: permission-aware edges, retention/legal hold, PII redaction strategy (e.g. UUID-only in KG + PII in primary tables), and audit logs for reads/exports. | Needs consistent policy enforcement and audit trail; avoid leaking PII into KG/LLM contexts. | **EPIC‑KG‑03**: Governance (permissions, retention, audit, PII redaction). **EPIC‑ENT‑AUDIT‑01**/**EPIC‑ENT‑POLICY‑01** (shared). | GAP | P0 |
| 5) Operationalization (keep graph fresh) | Leaders maintain freshness via connectors/ETL and lifecycle jobs; reconcile duplicates. | KG extraction runs best-effort after AI responses; no explicit freshness SLAs or reconciliation UX. | Freshness model: scheduled rebuilds, dedup/merge workflows, confidence decay, and monitoring (coverage, drift). | No freshness SLAs; no dedup/merge UX; risk of noisy graph. | **EPIC‑KG‑01** (extend): dedup/merge + freshness jobs + monitoring. | GAP | P1 |

### 6.12 AI Advisor (enterprise layer — “advisor over modules”)

**Module snapshot**
- **As‑is**: Strong AI foundations exist (routing tiers/purpose, budgets, governance endpoints, prompt SSOT, usage logs) but “Advisor as a unified layer” is not a single runtime contract across modules.
- **V4 target**: Enterprise advisor runtime: propose→justify→cite→ask for acceptance→execute typed actions, with strict governance (policy, budgets, evals, audit) and domain playbooks.
- **Top gaps**:
  - One canonical Advisor response + actions contract reused by all modules.
  - Citation-first enforcement (claims must point to internal sources) + explainability UX.
  - Typed actions execution engine with preview/diff, RBAC/capabilities, idempotency, audit.
  - Eval harness per domain/purpose + regression gates for prompts/models/routing.
- **P0 epics**: EPIC‑AI‑ADV‑01, EPIC‑AI‑ADV‑02, EPIC‑AI‑ADV‑03, EPIC‑AI‑GOV‑01, EPIC‑ENT‑AUDIT‑01

**Intent:** make AI a consistent **enterprise-grade advisor runtime** across the whole app: **propose → justify → cite sources → ask for acceptance → execute actions**, with governance (policies, budgets, evals, audit).

**As‑is anchors (code reality):**
- **AI runtime pipeline** (prompt SSOT T116, budget enforcement, usage logs, fallbacks): `server/src/services/ai/AIPipeline.ts`
- **Model routing & org policy gating** (tiers, purpose routing, soft-cap degradation, dataClass): `server/src/services/ai/modelRouter.ts`
- **AI Governance endpoints** (policy/context-policy/privacy/document governance): `server/src/routes/ai-governance.routes.ts` + `docs/api/AI_GOVERNANCE_API_MAP.md`
- **Budgets + model permissions** (admin control plane): `server/src/routes/ai-budgets.routes.ts`
- **Context pack concept exists** (structured “pack” from artifacts): `server/src/services/contextPackBuilder.ts`
- **Agent audit scaffolding exists** (sources, gates, reviews): `server/src/services/ai/agentAudit/*`

**V4 premise:** AI Advisor is **not “one more chat screen”**. It is a **platform layer** that every module can call to:
- produce a **typed answer** (decision-ready),
- attach **citations** to concrete internal sources,
- propose **typed actions** that can be accepted/rejected,
- generate an **audit trail** that can be replayed and evaluated.

| Slice (AI Advisor) | Enterprise baseline (leaders) | As‑is (Consultify code) | V4 target (enterprise) | Gap | Proposal (epics) | Status | V4 Priority |
|---|---|---|---|---|---|---|---|
| 1) Unified Advisor response contract | Assistants that always: identify intent, justify, cite, propose actions, request acceptance. | Many AI features exist per-module, but response shapes vary; artifacts/thinking extraction exists; propose→accept is a “rule”, not a shared runtime contract. | **One canonical Advisor contract** used across modules (UI + backend): `intent`, `answer`, `citations[]`, `proposedActions[]`, `questions[]`, `confidence`, `safetyNotes`. | No single contract means inconsistent UX, weak governance, and poor audit/eval comparability. | **EPIC‑AI‑ADV‑01**: Advisor runtime (intent routing + context pack + citations + propose→accept). | GAP | P0 |
| 2) Citations & provenance (“why”) | Enterprise copilots require explainability; internal sources are mandatory for decision outputs. | RAG/KG/help-doc injection exists; document governance logging exists (best-effort). No universal “citation required” validator per claim. | **Citation-first**: important claims must carry citations to internal artifacts (assessment section, initiative field, KPI datapoint, tool session output, report section). UI surfaces sources consistently. | Citations not enforced; provenance not standardized across modules and exports. | **EPIC‑AI‑ADV‑01** (extend): citations schema + claim→source linking. **EPIC‑ENT‑LINEAGE‑01** (shared). | GAP | P0 |
| 3) Action runtime (propose→accept→execute) | Copilots do safe “preview/diff”, idempotent actions, role-gated execution, full audit trail. | Guardrail exists (“never write silently”), but actions are not a unified typed system (varies per feature). | **Typed actions framework**: propose actions with preview/diff → user accepts → execution engine runs (RBAC/PBAC, idempotency, rollback where possible) → audit entry ties back to citations. | No shared action model means duplicated work, inconsistent safety, and hard-to-audit changes. | **EPIC‑AI‑ADV‑01** (extend): action schemas + execution engine + UI review queue. **EPIC‑ENT‑AUDIT‑01** (shared). | GAP | P0 |
| 4) Context governance + data classification | Enterprises require policy-driven context: PII rules, confidential-only-local policies, document visibility approvals, retention modes. | Governance routes exist + modelRouter supports org policy + `dataClass`; privacy modes exist in AIPipeline (privateMode/retentionMode). | **End-to-end enforcement**: every Advisor call declares `dataClass` + permitted sources; policy engine filters/blocks sources and logs “blocked due to policy”; “requires approval” becomes a formal gate. | Today it’s best-effort; enforcement is not a universal “Advisor runtime” gate across modules. | **EPIC‑AI‑ADV‑02**: Advisor governance (policies, audit trails, cost budgets, eval harness). **EPIC‑AI‑GOV‑01** (shared). | GAP | P0 |
| 5) Cost controls + budget-aware behavior | Budget-aware copilots: preflight cost estimate, adaptive context size, tier selection transparency, throttles. | Budgets exist + usage logs + soft caps + purpose routing; pricing snapshot support exists. | **Budget-aware Advisor**: preflight estimate, automatic context compression, tier degrade rules by intent criticality, per-purpose budgets, and user-visible “why this tier/cost”. | Need to unify costs with runtime intent routing and provide user/admin transparency by design. | **EPIC‑AI‑ADV‑02** (extend): budgets→routing policy + preflight estimator. | GAP | P0 |
| 6) Evaluation harness (enterprise QA) | Evals per domain: golden sets, policy violation tests, citation coverage metrics, regression gating on prompts/models. | Partial scaffolding exists (agent audit types, prompts SSOT). Evals not a productized pipeline per feature/purpose. | **Eval harness** per purpose/domain: datasets, metrics dashboards, regression gates for prompts/models/routing rules. | No systematic QA means risk of silent regressions and compliance failures. | **EPIC‑AI‑ADV‑02** (extend): eval harness + CI gates. **EPIC‑AI‑EVAL‑01** (shared). | GAP | P0 |
| 7) Domain playbooks (strategy/decisions/risks/stakeholders/results) | Enterprise copilots have domain-specific workflows and checklists, not generic chat. | Some domain AI exists (reports, decks, assessments, initiatives). Audit KB + “gates” concepts exist but not unified as playbooks. | **Playbooks per domain**: required inputs + required citations + allowed actions + quality gates + outputs (initiatives pack, risk register updates, decision pack, comms plan, KPI action plan). | Missing structured “Advisor over modules” workflows; today it’s feature-by-feature. | **EPIC‑AI‑ADV‑03**: Advisor playbooks per domain (strategy/decisions/risks/stakeholders/results). | GAP | P0 |

**Tasks do wdrożenia**
- [ ] Zdefiniować canonical AdvisorResponse schema: intent, answer, citations[], proposedActions[], questions[], confidence, safetyNotes
- [ ] Wdrożyć intent routing + context pack: standardized build z artifacts, stable identifiers, versioned snapshot dla audit/replay
- [ ] Zahardować citation-first: claims muszą mieć citations do internal sources; UI surface per claim; validator przed accept
- [ ] Wdrożyć typed actions framework: propose z preview/diff → accept → execution engine (RBAC, idempotency, rollback) → audit
- [ ] Rozszerzyć governance: dataClass + permitted sources per call; policy engine blokuje sources; "requires approval" jako formal gate
- [ ] Zintegrować budgets z routing: preflight cost estimate, tier selection policy-driven, user/admin transparency
- [ ] Zbudować eval harness: golden sets per purpose, citation coverage, policy violation tests, regression gates dla prompts/models
- [ ] Wdrożyć domain playbooks: Strategy, Decisions, RAID/Risks, Stakeholders/Comms, Results — required inputs, allowed actions, quality gates

**Plan pokrycia gapu**
- **Advisor contract**: Interfejs `AdvisorResponse` używany przez Assessments, Execution, Results, Reports, Decks. citations[] ma format `{ artifactType, id, fragmentId, excerpt }`. proposedActions[] ma `{ actionType, params, preview, diff }`. Context pack: snapshot artifactów w momencie call; versioned do replay.
- **Citation enforcement**: Config `minCitationCoverage` (%). Przy generate: jeśli claim bez ref → gate fails lub downgrade confidence. UI: każde claim klikalne → modal z source preview. Audit: citations zapisane przy każdym Advisor run.
- **Action runtime**: Action schemas (np. updateInitiative, createTask, addRisk). Execution: RBAC check → preview diff → user accepts → run (idempotency key) → audit. Rollback: gdzie możliwe (np. create → soft delete).
- **Playbooks**: YAML/JSON per domain. Definiuje: inputSchema, requiredCitations[], allowedActionTypes[], qualityGates (PASS/PASS_WITH_RISKS/FAIL), outputMappings. Playbook loader przed Advisor call; gates evaluated po response.

**V4 Definition of Done — epics**

**EPIC‑AI‑ADV‑01: Advisor runtime (intent routing + context pack + citations + propose→accept)**
- [ ] A canonical **AdvisorResponse** schema is used by at least: Assessments, Execution, Results, Reports/Decks.
- [ ] Advisor always returns **citations[]** for decision-grade claims (configurable threshold), and UI can open each source.
- [ ] Advisor outputs **proposedActions[]** as typed actions with preview; no direct writes without acceptance.
- [ ] “Context pack” is standardized (built from artifacts; stable identifiers; versioned snapshot for audit/replay).

**EPIC‑AI‑ADV‑02: Advisor governance (policies, audit trails, cost budgets, eval harness)**
- [ ] Every Advisor run logs: actor, purpose/intent, model+prompt version, sources used/blocked, costs, and acceptance/execution results.
- [ ] Data-classification/policy enforcement is **hard** (fail-closed where required) and consistent across modules.
- [ ] Budgets integrate with routing: tier selection is policy-driven and user/admin-visible.
- [ ] Evals exist for top purposes; prompt/model changes are gated by regression metrics.

**EPIC‑AI‑ADV‑03: Advisor playbooks per domain**
- [ ] Playbooks exist for: **Strategy**, **Decisions**, **RAID/Risks**, **Stakeholders/Comms**, **Results (KPI deviations/ROI)**.
- [ ] Each playbook defines: required inputs, required citations, allowed actions, and quality gates (PASS/PASS_WITH_RISKS/FAIL).
- [ ] Playbooks produce outputs that map to platform artifacts (initiative packs, decision records, RAID items, comms plans) through propose→accept.

