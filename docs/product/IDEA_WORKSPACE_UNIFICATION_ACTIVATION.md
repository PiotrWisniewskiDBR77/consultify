# Idea Workspace — Unification Activation Contract (M06–M09)

> Status: **Active build contract** (v1, 2026-06-20)
> Owner: Engineering (CTO) · Product input: Piotr
> Relationship to canon: this doc is **subordinate** to the V8 doctrine and the UI canon.
> It does **not** introduce new product doctrine — it translates frozen doctrine into a
> code-bound, verifiable work program. If it ever conflicts with the docs below, those win.

## Inherits (authority chain)

- `docs/product/IDEA_WORKSPACE_NAVIGATION_AND_CANVAS_ORCHESTRATION_V8.md` — *one idea = one workspace; canvases cooperate* (Area 1 doctrine)
- `docs/product/IDEA_WORKSPACE_UI_UX_UNIFICATION_V8.md` — *one shell, one state language, one color discipline* (Area 2 doctrine)
- `docs/product/IDEA_WORKSPACE_INTEGRATION_AND_PROMOTION_RUNTIME_V8.md` — promotion/traceability runtime
- `docs/ui-standards/CANON.md` — iron rule (compose approved components), MUST-NOT UX (§4), One Command Row (§4.5), doc↔code SSOT (§6)
- `docs/ui-standards/03-modules/TABLE_AND_PREVIEW_CANON.md` — table+preview+Menu 1/2/3 for the Table tool & Ideas list

The two V8 docs are **doctrine** (the destination). This doc is the **map** — what is shared, what is
systematic, and the order we build it in. Every requirement here is tied to a `path:line` and an
acceptance check.

---

## 0. Ground truth (what exists today, 2026-06-20)

The four Ideas instruments — **M06 Mind Map, M07 Process Flow, M08 Table, M09 Whiteboard** — are hosted
by one shared shell, but below the shell almost everything is re-implemented per tool.

**Genuinely unified today:**
- URL/tab shell + workspace routing — `MyWorkHub.tsx` (`parseMyWorkPathIntent` :439), one `IdeaMapWorkspace` per idea.
- Tool switcher registry — `IdeaWorkspaceToolbar.tsx:38` `TOOL_CONFIG` (one place lists all 4 tools).
- Selection contract — `ideaSelectionTypes.ts:8` `CanvasToolType`.
- Cross-tool transform — `transforms/crossToolTransform.ts` (`toMindMap/toTable/toWhiteboard/toProcessFlow`, selection-level, working).
- Shared shell chrome — `IdeaAISuggestionsPanel`, `IdeaExportMenu`, `IdeaNodeDetailDrawer`, `IdeaUnifiedSearch`, `IdeaTemplateGallery`, `CanvasZoomControls` (`canvas/CanvasZoomControls.tsx`), `canvas/useIdeasToolDefaults.ts`.
- Persistence row — one `my_idea_maps` row per (idea,user,org) with `nodes_json/edges_json/version/preferred_tool/extensions_json` (server `my-work.routes.ts:3498` GET `/map`, :4016 sync).

**Diverges (the work):**

| Surface | Mind Map | Process Flow | Table | Whiteboard | Verdict |
|---|---|---|---|---|---|
| Persistence | shared runtime (`workspaceGraphRuntime`) | own `useIdeaMapSync` | **separate `table-platform` store** | own `useIdeaMapSync` | 3 impls / 1 record |
| Realtime graph | full (`graph_patch`) | **presence only, no edit-sync** | own `useTableRealtime` | full (`useWhiteboardCollab`) | 3 behaviors |
| Presence | `CollaborationOverlay` | `CollaborationOverlay` | `table/CollaborationPresence` | inline avatars (`toolSession*`) | 4 systems |
| Toolbar | `mindmap/CanvasLeftToolbar`+7 popovers | `processflow/ProcessFlowToolbar` | `table/TableToolbar` | `whiteboard/WhiteboardToolbar`+own primitives | **P4✅** `canvas/CanvasToolbarPrimitives.tsx` shared primitive; WB shim re-exports |
| Keyboard | local listener `:3420` | local `:1719` | `table/useTableKeyboard` | local `:2742` | `useCanvasKeyboard` exists but **0 consumers (dead)** — P3 pending |
| Context menu | 3 menus (`Node/Pane/Edge`) | `ProcessFlowContextMenu` | none | `IdeaCanvasContextMenu` (sole user) | 3 strategies |
| Convert targets | 12 declared | 12 | 4 | — | **4 type defs, FE 8-in-menu vs BE 6 → dead paths** |
| Comments | `NodeCommentThread` | absent | absent | absent | mindmap only |
| Tokens | 78+217 hex, 0 `var(--c)` | 0 hex root, nodes use `var(--c)` | Tailwind, 248 `dark:` | 15+23 hex, 29 `dark:` | only PF nodes adopted tokens |
| Canvas bg | inline `rgba(…0.06)` g24 | inline `rgba(…0.15)` g20 | n/a | `canvasBackground.ts` | **P2✅** all 3 canvas tools call `getCanvasBg()` |

---

## Part 1 — Area 1: Management & orchestration ("the working form between the tools")

Doctrine (NAV V8 §5,§12,§17,§20): **one idea = one workspace; switching canvas is a lens change, not
export/import; promotion deepens the same work.** The activation contract:

### 1.1 One convert/promotion contract (FE↔BE single source) — **FIRST SLICE**
**Problem:** four divergent target lists; `action_plan`/`raid_log` are rendered, sent, and rejected 400
(CANON §4 violation — raw backend error, dead path).
**Contract:** one canonical registry `src/components/MyWork/ideaConvertTargets.ts`:
- each target = `{ id, labelPl, labelEn, icon, status: 'live' | 'soon', group }`.
- `live` = a server handler exists in `my-work.routes.ts` convert switch (initiative, task_set, decision, team_chat, report, presentation).
- `soon` = roadmap; surfaced **disabled** with an honest "wkrótce / coming soon" affordance — **never sent, never 400**.
- All FE convert types (`IdeaMapWorkspace`, `IdeaWorkspaceTools`, `IdeasTableContent`) import the id union from here. No more local re-declarations.
- Server keeps a matching `LIVE_CONVERT_TARGETS` allowlist with a comment pointing at this file as SSOT; FE never sends a non-live target.
**Acceptance:** clicking any rendered convert action either succeeds or is visibly disabled; no path returns 400 to the user; one type union; `vitest` contract test asserts FE-live set ⊆ BE-allowlist.

### 1.2 One persistence runtime (consolidate 3 → 1) — phased
Today Mind Map uses `workspaceGraphRuntime`, Process Flow + Whiteboard each spin their own `useIdeaMapSync`
(3 concurrent autosave timers sharing one localStorage draft key — last-writer-wins), Table uses
`table-platform`. Target: **Process Flow + Whiteboard consume the workspace `externalRuntime`** (as Mind Map
already does), so one idea has one autosave/version/draft engine. Table stays on `table-platform` but
projects through the same `onGraphChange` mirror contract (already exists). This kills the `globalIdeaVersions`
band-aid (`useIdeaMapSync.ts:202`).
**Acceptance:** switching tools re-fetches the idea **once**, not 2–3×; one draft key owner; 409 path tested.

### 1.3 One presence + realtime model — phased
Doctrine (NAV V8 §16): collaboration is a workspace concern, not a per-canvas accident. Target: all graph
tools register graph-sync through the one `/ws/collab/:ideaId` room (Process Flow currently has presence but
**no edit-sync** — `IdeaProcessFlowTool.tsx:2339` mounts overlay, never passes `onRegisterSend`). Presence
avatars become one shared component fed by one source.
**Acceptance:** Process Flow two-user edit propagates; one presence avatar component across the 3 canvas tools.

### 1.4 Cross-tool transform & start-from-any-lens grammar — formalize
`crossToolTransform.ts` already converts a selection between lenses and stamps `sourceTrace`. Formalize:
every tool switch preserves selection where meaningful (NAV V8 §12), and "start in X" entry (NAV V8 §9)
routes through one `preferred_tool` seed. This is mostly **already true** — contract just freezes it + adds tests.

---

## Part 2 — Area 2: UI/UX inside the tools ("shared where possible, systematic where not")

Doctrine (UNIFICATION V8 §3): *identity is shared, controls are predictable, colors mean the same thing.*
The rule that decides shared-vs-systematic:

> **SHARED (one component, imported by all):** anything that is *workspace chrome* or a *trust signal* —
> the user must not relearn it per canvas.
> **SYSTEMATIC (tool-local allowed, but same patterns/tokens):** anything that is *the thinking method
> itself* — editing grammar genuinely differs (you connect nodes in a flow, you type cells in a table).

### 2.1 SHARED — must collapse to one implementation
| Surface | Target shared component | Today |
|---|---|---|
| Tool switcher | `IdeaWorkspaceToolbar` | ✅ already shared |
| Zoom / fit / minimap toggle | `canvas/CanvasZoomControls` | ✅ shared (3 canvas tools) |
| Keyboard grammar (Tab/Enter/F2/Del/Ctrl+Z/Esc) | `canvas/useIdeasToolKeyboard` (`useCanvasKeyboard`) | ❌ **dead, 0 consumers** → wire into all 3 canvas tools |
| Canvas background (color/gap) | `canvas/canvasBackground.ts` | ⚠️ only whiteboard uses it → mindmap+PF hardcode different rgba → unify |
| AI suggestions / proposal review | `IdeaAISuggestionsPanel` + `IdeaProposalReview` | ✅ shared shell (keep; retire tool-local dups over time) |
| Export entry | `IdeaExportMenu` | ✅ shell; tool-local exporters become *formatters behind it*, not parallel menus |
| Node/record detail | `IdeaNodeDetailDrawer` | ✅ shell exists; tool inspectors feed it, don't replace it |
| Context menu | one `IdeaCanvasContextMenu` (whiteboard's, generalized) | ❌ 3 strategies → converge |
| Presence avatars | one component | ❌ 4 systems → one |
| Empty / loading / confirm | `shared/EmptyState`, one loading shell, `shared/ConfirmDialog` | ⚠️ `ConfirmDialog` imported by **none** of the 4 → adopt |

### 2.2 SYSTEMATIC — stays tool-local, but obeys one grammar
- **Node editing**: inline-edit (mindmap/whiteboard/table) vs properties-panel (process flow) — allowed to
  differ, but selection emphasis, F2-to-edit, Esc-to-cancel, Enter-to-commit must feel equivalent (UNIFICATION V8 §11).
- **Toolbars**: layout differs per method, but must use **one toolbar primitive** (button shape, size, density)
  — today whiteboard ships its own `ToolbarBtn`; target = one `canvas/ToolbarButton`.
- **Method colors**: whiteboard sticky palette, mind-map branch colors — allowed (UNIFICATION V8 §5.4), but they
  sit inside the workspace palette and **never** carry status/AI/validation meaning.

### 2.3 Token discipline (the biggest systematic gap)
- **Zero hardcoded hex** in tool roots/nodes. Status/selection/AI/severity → `var(--c-success|warning|danger|info|primary)`. Mind Map leaks ~295 hex — largest debt.
- **Red budget** (TABLE_CANON §4.0): `--c-danger` = ALARM only (overdue/error/blocked/rejected/delete). Never progress, never neutral dates.
- **Selection** = one shared accent across all canvases (UNIFICATION V8 §5.3). **AI** = one shared AI accent, review-oriented, never silent-commit (§12).
- Dark mode parity: whiteboard root (29 `dark:`) is thinnest → bring to parity.

---

## Part 3 — Build order (phased, each phase independently shippable + verifiable)

| Phase | Area | Scope | Risk | Acceptance |
|---|---|---|---|---|
| **P1** | 1 | One convert contract `ideaConvertTargets.ts`; FE types collapse; no dead paths; soon=disabled | low | no 400 to user; 1 type union; contract test FE-live ⊆ BE |
| **P2** ✅bg ✅2b | 2 | Unify canvas background token (mindmap+PF → `canvasBackground.ts`) | low | bg **DONE** `f24817a066`; P2b `useConfirmDialog` wired to Whiteboard clearDrawings **DONE** `9b81ec65b2` |
| **P3** ✅ | 2 | Wire dead `useCanvasKeyboard` into the 3 canvas tools (shared keyboard grammar) | med | **DONE** `ca136b98da` — ProcessFlow+Whiteboard wired; Delete undo bug fixed; MindMap already satisfies grammar (capture-phase handler) |
| **P4** ✅ | 2 | One toolbar primitive (`canvas/CanvasToolbarPrimitives`); retire whiteboard's own | med | **DONE** `a35b429687` |
| **P5** | 1 | Persistence: Process Flow + Whiteboard consume `externalRuntime`; kill `globalIdeaVersions` | high | 1 fetch/switch; 1 draft owner; 409 tested |
| **P6** | 1 | Realtime: Process Flow graph-sync via `/ws/collab`; one presence avatar component | high | PF 2-user edit propagates |
| **P7** ⚠️ | 2 | Token sweep (mindmap hex → `var(--c)`); red-budget audit; dark parity | med | scoped sweep DONE `9b81ec65b2`+`c420da6983`+`0eea7b7fc6`; LabeledEdge CSS-var resolver added; remaining: SWOT node colors (dark parity), IdeaFunnelAnalytics idea/exploring/converted hex (no clean token) |
| **P8** | 1+2 | One context menu; retire tool-local AI/export dups behind shell | med | one context menu; shell is the single AI/export entry |

Phases are ordered low→high risk so the contract proves out on safe slices first. P5/P6 (persistence +
realtime) are the deep architectural merges and gate on the earlier phases landing cleanly.

---

## Part 4 — Delivery log

- **2026-06-20 — P1 DONE** (`50c606b0de` → `ideaConvertTargets.ts`): convert SSOT, 4 types → 1 union, soon=disabled, contract test 5/5.
- **2026-06-20 — P2 bg DONE** (`f24817a066` → MindMap+ProcessFlow+Whiteboard wired to `getCanvasBg()`): canvas background token unified, `useIsDark` hook added to MindMap+PF. ConfirmDialog adoption deferred to P2b (no tools import it yet).
- **2026-06-20 — P4 DONE** (`a35b429687` → `canvas/CanvasToolbarPrimitives.tsx`): toolbar primitive moved to shared canvas location; Whiteboard shim re-exports for backwards compat.
- **2026-06-20 — P2b + P7 scoped DONE** (`9b81ec65b2`): `useConfirmDialog` wired to Whiteboard clearDrawings (first consumer, no undo path). Scoped token sweep: MapHealthScore (BranchHealthDot + ring), NodeEnhancements (MaturityRing), AIDependencyDetector (TYPE_CONFIG → var(--c-*) + colorBg via color-mix). P7 tool roots + dark parity remains.
- **2026-06-20 — P7 tool-roots slice** (`c420da6983`, `0eea7b7fc6`): dep-edge colors use var(--c-*) map (IdeaRecommendationMap onAddDependency/onAddAll); AISentimentOverlay dead `color` field removed; IdeaFunnelAnalytics validated/ready_to_convert → tokens; LabeledEdge: CSS-var resolution via getComputedStyle for SVG presentation attributes. Remaining P7: SWOT node palette in `useMindMapNodes` (needs dark variants, separate pass).
- **2026-06-20 — P3 DONE** (`ca136b98da`): `useCanvasKeyboard` wired into ProcessFlow + Whiteboard (was dead, 0 consumers). Strategy: `if(e.defaultPrevented)return` guard in bespoke handler + shared hook registered first → no double-fire; typing-safe fallbacks (Ctrl+S/Z/D) kept in bespoke. **Delete undo bug fixed** in both tools: `deleteKeyCode={null}` overrides `getIdeasToolInteractionProps` default, native ReactFlow delete disabled, `onDeleteSelected → deleteSelected()` (with pushUndo/onNodesDeleted) fires instead. Whiteboard gains Ctrl+D (duplicate) + Ctrl+0 (fitView) — previously missing. MindMap left as-is (capture-phase handler already satisfies grammar; different Space/Ctrl+D semantics preclude shared hook).
