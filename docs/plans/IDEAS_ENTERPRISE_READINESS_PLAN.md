# Ideas Module — Enterprise SaaS Readiness Plan

**Date:** 2026-06-02
**Scope:** The My Work **Ideas** module (Mind Map, Process Flow, Whiteboard, Table) + shared workspace shell.
**Not in scope:** The in-chat **Canvas** module (separate module; see `docs/UNIFIED_AI_CHAT_SYSTEM.md`). Ideas ≠ Canvas.
**Source:** 6-agent audit (4 tools + shell + competitive benchmark), 2026-06-02. Readiness snapshot in memory `project_ideas_workspace_overhaul.md`.

---

## 0. Current state (verdict)

None of the 4 tools is "absolutely ready". The **editing engines** are strong (75–90%); the gap to Enterprise SaaS is the **cross-cutting layer** (collaboration + navigation/shell), missing across all tools.

| Area | Readiness | Verdict |
|---|---|---|
| Mind Map | ~72% | Mostly ready; debug logging ships in prod |
| Process Flow | ~72% | Mostly ready; validation fails silently |
| Table | ~68% | Mostly ready; no freeze columns, export stubs disabled |
| Whiteboard | ~45–55% | Partial; AI is regex intent-only |
| Shell / Navigation | ~52% | Partial — the bottleneck for parity |

### Scope decisions (locked)
- **Offline is OUT.** Miro / FigJam / Mural are all cloud-only; offline is not an enterprise baseline. Deprioritize / remove half-wired offline code rather than complete it.
- **Cloud-first, shared-layer-first.** Build collaboration + shell **once** at the workspace level so all 4 tools inherit it, instead of per-tool.
- **Three tracks, run roughly in order:** A (Shell/Nav — fast wins) → B (Collaboration — deep) → C (Tool completion + a11y). A and C-quick-fixes can overlap.

---

## TRACK A — Shell & Navigation  *(highest leverage; ~2–3 sprints)*

**Goal:** Make the workspace *read* as enterprise SaaS: discoverable commands, search, keyboard, breadcrumbs, and a real "home" for ideas. Touches all 4 tools at once.

### A0. Verified baseline (so we don't rebuild what exists)
- `Cmd/Ctrl+F` already opens search — `IdeaMapWorkspace.tsx:1505-1507`. `/` also opens it — `:1490`. **Missing: a visible button.**
- `IdeaUnifiedSearch` is mounted (`:3058`) with `open={searchOpen}` (`:299`). Works, just hidden.
- `CommandPalette` is mounted (`:3066`) but `useCommandPalette({ enabled: activeTool !== 'mindmap' })` (`:356`) **disables Cmd+K in Mind Map**, and its command list is **app-navigation only** (no workspace-scoped actions). `onNavigate` is not even passed.
- `KeyboardShortcutsHelp` is mounted (`:3078`), toggled by `?` via `useKeyboardShortcuts` (`hooks/useKeyboardShortcuts.ts:189`). **Missing: a visible "?" affordance.**
- `IdeaWorkspaceToolbar` (`IdeaWorkspaceToolbar.tsx`) is click-only; no keyboard hotkeys, no `aria` roles. TOOL order: mindmap, whiteboard, process_flow, table.
- No breadcrumb component anywhere in the workspace.
- `MyIdeasListContent.tsx` (home list) has sort/group but **no recents / favorites / folders / thumbnails**.

### A1. Command palette: enable everywhere + workspace-scoped commands
**Why:** Cmd+K is now a hard expectation (Miro ships it). Today it's dead in Mind Map and only navigates app views.
**Changes:**
1. `IdeaMapWorkspace.tsx:356` — drop the `enabled: activeTool !== 'mindmap'` gate. Resolve the underlying conflict instead: Mind Map's own `Cmd+K`/shortcut handler must not double-fire (check `mindmap` keyboard layer; namespace or let the palette win and `stopPropagation`).
2. `CommandPalette.tsx` — add a **`commands` (or `extraGroups`) prop** so the host injects context commands. Extend `CommandItem` usage; render an injected group above the static app-nav group.
3. Inject **workspace commands** from `IdeaMapWorkspace`: `Switch to Mind Map/Whiteboard/Process Flow/Table`, `Open template gallery`, `Export…`, `Search this idea`, `Convert selection to Initiative/Task/Decision`, `AI: expand selection`, `Show keyboard help`. Wire each to existing handlers (`setActiveTool`, export menu open, `setSearchOpen(true)`, the `idea-workspace-quick-action` dispatch path at `:702-988`).
4. Pass `onNavigate` at `:3066` so app-nav items work.
5. Add an empty-state hint "Press ⌘K for commands".
**Acceptance:** Cmd+K opens in all 4 tools; typing "table" switches tool; "export" opens export; no double-trigger in Mind Map.
**Effort:** M (2–3 d). **Files:** `CommandPalette.tsx`, `IdeaMapWorkspace.tsx`.

### A2. Surface in-canvas search (button + count)
**Why:** Search works but is invisible.
**Changes:** Add a Search icon button to the top control cluster (next to the tool switcher / export). On click → `setSearchOpen(true)`. Add a `⌘F` tooltip. In `IdeaUnifiedSearch`, show result count and prev/next match navigation (it already filters node labels/desc/tags).
**Acceptance:** Visible search button in every tool; click + ⌘F + `/` all open it; result count shown.
**Effort:** S (1 d). **Files:** `IdeaMapWorkspace.tsx`, `IdeaUnifiedSearch.tsx`.

### A3. Keyboard: tool-switch hotkeys + visible "?" help
**Changes:**
1. Add tool-switch hotkeys in `IdeaMapWorkspace` (or extend `useKeyboardShortcuts`): **`Alt+1..4`** → `setActiveTool(['mindmap','whiteboard','process_flow','table'][n-1])`. Guard against input/contenteditable (pattern already at `useKeyboardShortcuts.ts:168-186`).
2. Add a **"?" button** in the control cluster → `setShortcutsHelpOpen(true)` (state already wired at `:1478/:3078`).
3. Audit `KeyboardShortcutsHelp` content: add the new Alt+1..4 rows and the ⌘K / ⌘F rows; group by tool. Translate (PL/EN).
**Acceptance:** Alt+1..4 switch tools (not in inputs); "?" button + key both open help; help lists every active shortcut accurately.
**Effort:** S–M (1–2 d). **Files:** `IdeaMapWorkspace.tsx`, `hooks/useKeyboardShortcuts.ts`, `shared/KeyboardShortcutsHelp.tsx`.

### A4. Breadcrumb bar (Project › Idea › Tool)
**Why:** Users lose context; no app-level crumbs.
**Changes:** New `IdeaWorkspaceBreadcrumb.tsx` rendered at the top of `IdeaMapWorkspace`. Segments: Project name (link → project), Idea title (editable inline → rename via existing idea update), active tool label (`getIdeaWorkspaceToolLabel`). Right side: save/sync status (reuse existing sync state), share button placeholder (Track B). Make it a thin sticky bar so the floating tool switcher can later move into it.
**Acceptance:** Breadcrumb shows real project/idea/tool; idea title editable; clicking project navigates out.
**Effort:** M (2 d). **Files:** new component + `IdeaMapWorkspace.tsx`.

### A5. Home shell for Ideas (recents / favorites / folders / search-across)
**Why:** No multi-board management — the single biggest "prototype vs SaaS" tell.
**Changes (frontend `MyIdeasListContent.tsx` + backend `my-work.routes.ts`):**
1. **Recents:** track `last_opened_at` per idea (client write on open + server column). Add a "Recent" rail at top of the list.
2. **Favorites/Starred:** add `is_favorite` (server) + star toggle in list rows + a "Starred" filter.
3. **Folders/Spaces:** add `folder_id` (nullable) + a folders sidebar (flat first; nesting later). Drag-to-folder optional v2.
4. **Search across ideas:** a top search box filtering by title/tags (server `LIKE`/FTS); distinct from in-canvas search.
5. **Thumbnails:** generate a lightweight snapshot on save (reuse the PNG export path from `IdeaExportMenu`) or a deterministic placeholder by tool type.
**Acceptance:** Home shows Recents + Starred + Folders; star toggles persist; search filters across all ideas; cards show a thumbnail/type icon.
**Effort:** L (4–6 d incl. backend + migration). **Decision needed:** folders now vs after Track B.

### A6. In-canvas navigation polish (per tool, shared where possible)
- **Minimap** consistency: always-available toggle in all ReactFlow tools (Mind Map / Process Flow / Whiteboard) with `M` hotkey.
- **Zoom-to-fit** (`Shift+1`) and **zoom-to-selection** (`⌘2`) shared helper over ReactFlow `fitView`.
- **Frames-as-presentation** (Whiteboard first): step through frames as slides (FigJam/Miro pattern). Whiteboard already has frames (`FrameNode`) + scenes (`IdeaScenesManager`); wire a present mode.
**Acceptance:** Consistent zoom/minimap controls + shortcuts across tools; Whiteboard present mode steps through frames.
**Effort:** M (2–3 d).

**Track A total:** ~12–18 dev-days. **Outcome:** shell parity jumps from ~52% → ~80%+.

---

## TRACK B — Collaboration  *(deep; ~4–6 sprints)*

**Goal:** Real multi-user. Today: presence/cursors only, **no edit sync** → last-write-wins data loss on concurrent edit (confirmed in Whiteboard + Mind Map audits).

### B1. Real-time multiplayer editing (the big one)
**Decision (needs sign-off): CRDT (Yjs) vs server-authoritative OT.**
- **Recommended: Yjs + `y-websocket`** (or Hocuspocus) + per-tool bindings. CRDT fits a graph/whiteboard model, has mature React/ProseMirror/awareness ecosystems, and avoids building an OT server.
- Map the shared `IdeaWorkspaceGraph` (nodes/edges/extensions) onto a Yjs document. The graph is already the single source of truth across tools (`graphRuntime.graph`), which makes one Y.Doc per idea natural.
**Work:**
1. Stand up a Yjs sync service (WebSocket) with auth (reuse JWT) + per-idea room = `idea:{id}`.
2. Bind ReactFlow nodes/edges + tool `extensions` to Y maps/arrays; debounced reconcile with existing `useIdeaMapSync`. Keep the REST snapshot as the durable store (Yjs for live, REST for persistence/versioning).
3. **Awareness** for live cursors + selection (replace the 5s presence polling in Whiteboard `:1990-2059` and Mind Map `CollaborationOverlay`). Cursors with names/colors.
4. Conflict story: CRDT merges; remove "last-write-wins" assumptions and the 409 pessimism where Yjs now owns live state.
**Acceptance:** Two browsers editing the same idea see each other's nodes/cursors live; no lost edits; reload restores from REST snapshot.
**Effort:** XL (10–15 d incl. infra). **Risk:** infra + binding complexity; do Whiteboard first as the pilot, then Mind Map/Process Flow/Table.

### B2. Comments + @mentions
**Changes:** Comment threads anchored to a node/cell (Whiteboard sticky, Mind Map node, Process Flow step, Table row). Backend `idea_comments` (idea_id, anchor_ref, body, author, mentions[], resolved). `@`-autocomplete over team members. Notifications via existing inbox. Side panel + resolve/thread + unread badges (Whiteboard already shows a comment-count badge on stickies — wire it to real data).
**Acceptance:** Comment on any object; @mention notifies; resolve hides; counts reflect real threads.
**Effort:** L (5–7 d).

### B3. Sharing / roles / permissions (workspace level)
**Changes:** Share dialog (link + invite by email) with roles **viewer / commenter / editor / owner**. Backend `idea_shares` + enforcement in map sync + comment + Yjs room auth. Surface a presence/share button in the breadcrumb (A4). Replace the current URL-only sharing.
**Acceptance:** Owner shares with a role; viewer can't edit; commenter can only comment; enforced server-side and in the live room.
**Effort:** L (5–7 d). **Depends on:** B1 room auth.

### B4. Version history UI (browse / restore / diff)
**Note:** Backend snapshot/restore for the **Ideas map** is NOT confirmed (unlike the Canvas module, which has a working `/versions/:id/restore`). **First task: verify/extend the backend** (idea map sync route; search `useIdeaMapSync` / `captureGraph` server side). The Mind Map audit references frontend `SnapshotHistory` + audit log, so partial pieces exist.
**Changes:** If backend missing, add `idea_map_versions` (snapshot of graph envelope + author + ts) and a restore endpoint mirroring the Canvas pattern. Frontend: a version timeline sidebar (list → preview → restore), with a basic node/edge diff (added/removed/changed).
**Acceptance:** Browse versions, preview, restore; diff highlights changes.
**Effort:** M–L (4–6 d, +backend if absent).

---

## TRACK C — Tool completion + accessibility  *(parallelizable; ~3–4 sprints)*

### C1. Whiteboard (lowest readiness — biggest tool-level lift)
- **Real AI** (replace regex `whiteboardIntentDetector`): call Teresa to (a) **generate** a populated board from a prompt, (b) **cluster** existing stickies into frames by theme, (c) **summarize** board → takeaways, (d) **extract action items**. Use the existing proposal→accept/reject UI (`IdeaProposalReview`) as the surface.
- **Execution conversion:** wire the existing `outcomeRegistry` to "Create Initiative/Task from selected cluster" (UI + the `convert_*` quick-action path already in `IdeaMapWorkspace:869-926`).
- **Facilitation gaps:** private ideation (hide-until-reveal), "summon everyone to frame", reactions UI (state exists, no UI).
- **Search/find** in board (covered by A2 once shared).
**Effort:** L (6–8 d).

### C2. Table
- **Freeze columns** (sticky left columns in `GridView`).
- **Remove or implement** disabled export stubs ("Presentation/Report/Table = soon", `IdeasTableContent.tsx:1074-1097`) — at minimum hide until real.
- **Lookup field UI** (`LookupFieldOptions` defined, no UI) + cross-table aggregation UI.
- **Delete unwired offline code** (`useOfflineAware` never called) per scope decision.
**Effort:** M–L (4–6 d).

### C3. Mind Map
- **Remove prod debug**: logging at `IdeaRecommendationMap.tsx:1701+` and the DEBUG INSPECTOR overlay `:6145+` (gate behind `import.meta.env.DEV` or a flag).
- **Error boundary** around the map (a node render throw currently crashes the whole map).
- **Presentation mode** beyond read-only stub; rate-limit AI suggestion fetches (debounce).
- Split the 42K-line `NodeDetailDrawer` (code health, not blocking).
**Effort:** M (3–4 d).

### C4. Process Flow
- **Validation error toasts** (currently silent on failure, `useProcessFlowValidation`).
- **Surface AI `risk_flags`** in `AIProposalPanel` (returned, not rendered).
- Version history (shared with B4).
**Effort:** S–M (2–3 d).

### C5. Accessibility pass (WCAG 2.2 AA) — cross-cutting
- ARIA roles/labels on canvas objects + toolbars; focus traps in modals; keyboard-only operability; visible focus rings. Miro publishes a VPAT and ships 3 keyboard-nav modes — match the baseline (linear nav + labels first).
**Effort:** L (5–7 d), can trail the other work.

---

## Sequencing & milestones

| Milestone | Contents | Rough effort |
|---|---|---|
| **M1 — "Feels like SaaS"** | A1–A4, A6 + C3 debug removal + C4 toasts | ~2–3 weeks |
| **M2 — Home & discovery** | A5 (recents/favorites/folders/search-across/thumbnails) | ~1–1.5 weeks |
| **M3 — Live collaboration (pilot)** | B1 on Whiteboard + awareness cursors | ~3 weeks |
| **M4 — Collaboration complete** | B1 on remaining tools, B2 comments, B3 sharing/roles, B4 versions | ~4–5 weeks |
| **M5 — Tool completion + a11y** | C1 Whiteboard AI/exec, C2 Table, C5 WCAG | ~3–4 weeks |

**Critical path:** B3 (permissions) depends on B1 (room auth). B4 backend should be verified early (cheap) so the UI work isn't blocked.

## Decisions — LOCKED (2026-06-02)
1. **Start point:** ✅ **M1 — Track A** (Shell/Navigation) first.
2. **CRDT library (Track B):** ✅ **Yjs + y-websocket** (revisit only if a managed fallback is needed during the M3 pilot).
3. **Folders (A5):** still open — default plan: ship Recents + Favorites first, add Folders within M2.
4. **Collaboration pilot tool (B1):** still open — default plan: Whiteboard-first.

## M1 execution breakdown (Track A — ordered slices)
Ship as small, independently-mergeable PRs in this order:
1. ✅ **A2 — visible Search button** — DONE (commit `fe290505f`).
2. ✅ **A3 — Alt+1..4 tool hotkeys + "?" help button** — DONE (`fe290505f`).
3. ✅ **A1 — Command palette everywhere + workspace commands** — DONE (`fe290505f`).
4. ✅ **A4 — Breadcrumb (Ideas › Idea title › Tool)** — DONE (`fe290505f`). PMO project-name crumb deferred (not trivially in store; idea title + tool shown, leading crumb links to /my-work).
5. 🟡 **A6 — in-canvas nav** — PARTIAL: shared **Shift+1 = zoom-to-fit** added to Mind Map / Process Flow / Whiteboard (+ Whiteboard gained ⌘0 too) + help-modal row. **Deferred:** `M` minimap hotkey (plain-letter conflict risk) and **frames-as-presentation** (larger feature — own slice).
6. **Quick fixes:** ✅ C4 Process Flow validation toasts (DONE, `fe290505f`). ⏭️ C3 NOT NEEDED — audit overstated: `debugEnabled` is hardcoded `false` (`IdeaRecommendationMap.tsx:1617`), both the `console.log` and the DEBUG INSPECTOR overlay are gated → nothing leaks in prod.
Each slice ends with: PL/EN strings, an acceptance check, and a focused test where logic is non-trivial.

## Risks
- **B1 is the schedule risk** (infra + per-tool bindings). De-risk with a Whiteboard pilot and a managed option as fallback.
- **A1 palette double-trigger** in Mind Map — must resolve the existing keyboard conflict, not just un-gate.
- **A5 needs a DB migration** — coordinate with backend/data.
- Large components (`IdeaRecommendationMap` 6.3K LOC, `NodeDetailDrawer` 42K) make changes risky; add tests around touched areas.
