# AGENT_4_IDEA_MINDMAP — Execution Plan

> Status: supporting source, not canonical plan
> Manager note: use as supporting material only under the manager split
> Authority file: `docs/product/work-packets/MANAGER_FALA_1_CANONICAL_EXECUTION_MAP_2026-03-28.md`

## 1. Scope
- `Idea Workspace / Idea founder / Idea maker`
- `Mindmap`
- Within-scope shared flow: `idea -> workspace -> mindmap -> promotion to downstream artifact`
- Out of scope for this plan: `Whiteboard`, `Process Flow`, `Table` as separate delivery programs, plus `Outputs / Documents / Presentations / Excel / Sheet`

## 2. Source of truth reviewed
- Reviewed primary wave docs:
  - `docs/product/work-packets/V8_EXECUTION_WAVES_NOW_LATER_2026-03-28.md`
  - `docs/product/work-packets/V8_V81_GAP_ANALYSIS_AND_8_2_CUT_2026-03-28.md`
  - `docs/product/work-packets/V8_10_PHASE_REVIEW_REPORT_2026-03-28.md`
  - `docs/product/work-packets/POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM.md`
- Reviewed Idea / Mindmap canonical docs:
  - `docs/product/IDEA_V8_READINESS_AUDIT.md`
  - `docs/product/IDEA_WORKSPACE_NAVIGATION_AND_CANVAS_ORCHESTRATION_V8.md`
  - `docs/product/IDEA_WORKSPACE_INTEGRATION_AND_PROMOTION_RUNTIME_V8.md`
  - `docs/product/IDEA_WORKSPACE_UI_UX_UNIFICATION_V8.md`
  - `docs/product/MINDMAP_V8_READINESS_AUDIT.md`
  - `docs/product/MINDMAP_V1_SSOT.md`
  - `docs/product/MINDMAP_NAVIGATION_NODE_OPERATIONS_AND_AI_COPILOT_V8.md`
  - `docs/product/MINDMAP_CHAT_SIDEKICK_AND_COLLABORATIVE_IDEA_RUNTIME_V8.md`
  - `docs/product/MINDMAP_V1_IMPLEMENTATION_PLAN.md`
  - `docs/product/MINDMAP_DEVELOPMENT_STATUS_2026-03-15.md`
  - `docs/product/MINDMAP_COMPLETION_FINDINGS_2026-03-12.md`
  - `docs/product/DOCUMENTATION_REGISTRY.md`
  - `docs/product/SYSTEMATYKA_PRZEGLADU_V8.md`
- Reviewed key frontend paths:
  - `src/components/MyWork/MyWorkHub.tsx`
  - `src/components/MyWork/IdeaMapWorkspace.tsx`
  - `src/components/MyWork/IdeaRecommendationMap.tsx`
  - `src/components/MyWork/IdeaWorkspaceTools.tsx`
  - `src/components/MyWork/IdeasMindMap.tsx`
  - `src/components/MyWork/mindmap/useMindMapPersistence.ts`
  - `src/components/MyWork/mindmap/CollaborationOverlay.tsx`
  - `src/components/MyWork/mindmap/MindmapInspector.tsx`
- Reviewed key backend/runtime paths:
  - `server/src/routes/my-work.routes.ts`
  - `server/src/gateways/ideaCollabWs.gateway.ts`
  - `server/src/gateways/ideaCollab.gateway.ts`
  - `server/src/validators/ideaWorkspaceGraph.validators.ts`
  - `src/services/api.ts`
- Reviewed historical closure / status docs:
  - `docs/product/work-packets/cursor-work/V8_V81_CLOSURE_LEDGER.md`
  - `docs/product/work-packets/evidence/*idea-workspace*` references as cited from tracker
- Benchmarks reviewed:
  - `Miro`
  - `XMind`
  - `Whimsical`
  - `Lucidchart / Lucidspark`
- Documentation risks found:
  - `Plan v8.pdf` is cited as original authority but is not present in the repo.
  - `Softs` is treated in `docs/cleanup/SOFTS_REFERENCE_HANDLING.md` as external reference corpus, not vendored canonical source.
  - `10-phase_softs_review_36408c2d.plan.md` is cited by `V8_10_PHASE_REVIEW_REPORT_2026-03-28.md` but not present in the repo.
  - Historical `T1` acceptance for `Idea workspace` covers bounded split-brain cleanup, while `V8_V81_CLOSURE_LEDGER.md` still marks `Idea workspace` as `red`; this is a real truth-layer mismatch, not a wording nuance.

## 3. Executive summary
`Idea Workspace` and `Mindmap` are not underbuilt. They are over-rich relative to product coherence. The docs are strong enough to define the intended product clearly: one idea should become one persistent workspace, and `Mindmap` should be the fastest structured-thinking surface inside it. The repo confirms that this is not theory only: the workspace shell exists, deep links work, four canvases are mounted, the mindmap has real persistence, snapshots, comments, AI proposals, imports, exports, drill-down, and a collaboration overlay. The problem is that historical closure only removed a bounded split-brain lane; it did not finish the product.

The biggest current risk is false confidence. `MINDMAP_DEVELOPMENT_STATUS_2026-03-15.md` reads like a completion log, but `MINDMAP_V8_READINESS_AUDIT.md` is more honest: breadth is ahead of trust. The workspace story has the same issue. `Idea Workspace` is conceptually strong and code-rich, but the main user-facing promise is still weaker than the shell suggests: start flow, cross-canvas continuity, promotion clarity, and collaboration truth are not yet calibrated into one calm system. This is exactly the kind of module that can look impressive in demos and still feel exhausting in real use.

The fastest win is not adding more canvases, more AI, or more export paths. The fastest win is making the existing shell and mindmap interaction model feel intentional, predictable, and safe. The second fastest win is making downstream promotion and traceability visible enough that the workspace stops feeling like an isolated creativity lab. The highest delivery leverage is therefore: first stabilize the workspace contract the user sees, then tighten `Mindmap` interaction grammar, then lock branch-aware sidekick and promotion flows. Do not reopen `Whiteboard`, `Process Flow`, or `Table` as separate programs inside this wave. They matter as dependencies, but the current scope should finish the visible `Idea -> Mindmap -> next action` spine.

## 4. Module-by-module analysis

### Idea Workspace / Idea founder

#### 4.1 Intended product behavior
- `Idea Workspace` is supposed to be one AI-native problem-solving environment, not a launcher for detached tools.
- The canonical doctrine is `one idea = one workspace`.
- The user should choose a problem or opportunity first, then the system should expose the best thinking surface without breaking identity.
- The workspace should let the user move between `Mind Map`, `Whiteboard`, `Process Flow`, and `Table` while preserving context, traceability, linked artifacts, notes, and AI continuity.
- Promotion is part of the product promise, not an afterthought. Idea work should mature into notes, decisions, initiatives, task sets, reports, and presentations without losing source lineage.
- AI should work across the whole idea runtime, invisibly reusing org context, notes, synced sources, and cross-canvas state instead of forcing users to manually restitch context.
- The shell must stay stable and obey frozen rules: same `My Work` structure, same shared workspace chrome, same `Tools | Context | AI Suggestions` strip, no extra strip and no canvas-specific chrome logic.

#### 4.2 Current repo truth
- The workspace is real. `MyWorkHub.tsx` parses `/my-work/ideas/:ideaId/workspace/:tool?` and query-based deep links, routes them into the `ideas` lane, and opens an `idea` document with `openMap` and `initialTool`.
- `IdeaMapWorkspace.tsx` is the real shell. It mounts all four canvases, tracks active tool, active panel, selection, focus modes, proposal batches, fullscreen, voting, artifacts, and cross-tool runtime state.
- The default workspace path is still `mindmap`. `IdeaMapWorkspace.tsx` sets `initialTool || 'mindmap'`.
- The workspace does expose visible downstream hooks: stage change, convert actions, chat open, template application, artifact linking, AI proposal replay, and selection-aware tooling.
- `IdeasMindMap.tsx` is now explicitly a deprecated compatibility shim that redirects to canonical `My Work -> Ideas`. This is good evidence that one historical split-brain path was removed.
- The repo truth supports the canonical shell more than the closure ledger suggests, but it does not prove workspace maturity as a product.
- What is genuinely usable now:
  - open an idea from `My Work`
  - deep-link directly into workspace
  - switch among the four canvases
  - persist shared graph/runtime state
  - operate with `Tools | Context | AI Suggestions`
  - trigger convert / AI / chat entry points
- What is partial or misleading:
  - historical tracker says `Idea workspace` was accepted for bounded `T1`, but the closure ledger still calls runtime unfinished
  - collaboration truth is not closed at workspace level
  - the shell carries many capabilities, but the main user journey is still more “power surface” than “guided problem-solving flow”
  - docs promise invisible cross-canvas AI integration and promotion discipline more strongly than the current visible UX communicates it
  - the module still depends on several shared primitives and side flows that can make the experience feel stitched rather than singular

#### 4.3 Competitive standard
- `Lucidchart / Lucidspark` set the benchmark for one container that can carry work from fuzzy ideation into structured visual artifacts without making users feel they switched products.
- `Miro` sets the benchmark for collaborative facilitation, quick starts, templates, voting, presence, and workshop-grade momentum inside one board.
- `Whimsical` sets the benchmark for calm, low-friction entry, lightweight command-first interaction, and not overwhelming users with system depth too early.
- `XMind` matters less for the whole workspace shell and more for the large-map navigation discipline that the workspace should inherit through its mindmap.
- The market standard for this module category is not “many canvases exist.” The standard is:
  - one obvious start path
  - one obvious identity
  - frictionless switching when a different lens is better
  - clear collaboration truth
  - visible provenance and next-step promotion
- Where the repo is strong versus market standard:
  - unusual depth of cross-tool ambition already exists
  - promotion and traceability doctrine are stronger in docs than in many competitors
  - the workspace is already integrated into a larger consulting product, not a blank visual board
- Where it still trails:
  - the start flow is heavier and less self-evident than Whimsical or Lucid
  - the shell does not yet feel as calm and predictable as a best-in-class multi-surface workspace
  - collaboration trust is weaker than Miro-class products
  - downstream promotion is conceptually strong but not yet communicated to the user as a smooth, visible flow

#### 4.4 Main gaps
- The module still does not present one calm problem-led start flow that makes the user feel they entered a single idea system.
- Cross-canvas continuity exists technically, but not yet as a strong visible product story.
- Promotion and traceability are described much more clearly in docs than in the day-to-day workspace surface.
- The historical `split-brain` cleanup can be mistaken for “workspace is done,” which is dangerous for planning.
- Shared collaboration truth at workspace level remains incomplete and insufficiently proven.
- Template and discovery entry still risk feeling like a system catalog instead of a lightweight doorway into work.
- The workspace needs a tighter line between “available capability” and “recommended next move.”

| Dimension | Short description | Quality | Most important gap |
| --- | --- | --- | --- |
| `User value` | Strong strategic value if it truly becomes the upstream thinking layer for the rest of Consultify. | `Medium` | The value is still more implied than experienced in the first 3-5 minutes of use. |
| `Flow completeness` | Open idea -> workspace exists, but the full `start -> deepen -> promote` story is not clean enough. | `Partial` | Promotion and context continuity are not yet obvious enough on the surface. |
| `UX quality` | Shared shell exists, but the module still feels denser and more experimental than premium. | `Partial` | Too much visible power before the main interaction model feels calm. |
| `Data / logic quality` | Runtime substrate looks serious and non-trivial. | `Medium` | Workspace-level truth and visible surface behavior still do not align cleanly enough. |
| `Integration quality` | This is one of the module’s strongest conceptual areas. | `Medium` | Integration doctrine is stronger than visible productized handoff UX. |
| `Trust / governance / error handling` | Some good governance seams exist, but user trust remains uneven. | `Partial` | Collaboration/runtime truth is not strong enough to claim production confidence. |
| `Market standard fit` | Ambitious on scope, below standard on calmness and end-to-end clarity. | `Partial` | Competitors feel more intentional and less stitched in the core entry flow. |

#### 4.5 Minimal acceptance state now
- User can enter `Idea Workspace` from the canonical `My Work -> Ideas` path or deep link and clearly understands they are still in one idea container.
- User can start from a lightweight problem statement or template entry without feeling forced to choose a permanent tool upfront.
- User can switch between canvases without losing idea identity, selection intent, or visible confidence that nothing was lost.
- `Tools | Context | AI Suggestions` remain the only right strip and each panel has a clear role.
- User can see why the current idea exists: source context, linked artifacts, or originating signal are visible enough to support trust.
- User can deepen the workspace into at least one downstream artifact flow from current work: `initiative`, `task set`, or `decision`, with backlink or source trace kept visible.
- AI proposals that materially change the workspace remain reviewable and explicit.
- Collaboration state is either live and understandable or explicitly degraded; it cannot fail silently.
- Empty, loading, blocked, and retry states must tell the user what to do next.
- Full Miro-class facilitation, full realtime collaboration parity, and full whiteboard/process/table maturity are not required for current acceptance.

#### 4.6 Top missing functions
- Problem-led entry flow that feels lighter than the current shell complexity.
- Canonical template/library entry that creates or extends the current workspace without feeling detached.
- Visible source and provenance layer for why this idea exists and what feeds it.
- Better “same idea, different lens” continuity when switching canvases.
- One obvious promotion review flow from workspace object to downstream artifact.
- Clear object-level backlinks from promoted artifacts into source idea context.
- Shared workspace collaboration truth and degraded-state explainability across the whole module.
- Better focus-mode UX for whole idea, current canvas, and current object.
- Stronger “what to do next” guidance inside the shell.
- Honest production labeling for mature versus still-maturing workspace capabilities.

#### 4.7 Proposed bounded delivery packets
##### Packet 1 — Workspace Entry And Shell Coherence
`Cel:` make `Idea Workspace` feel like one product from first entry.

`Zakres:` canonical entry from `My Work -> Ideas`, lightweight start copy, template/start clarity, shell labels, current-canvas clarity, visible source context, empty states.

`Co dokładnie dowozimy:` calmer first-run flow, clearer title/description/start intent, better current-canvas framing, visible “same idea workspace” continuity, and better workspace empty/start states.

`Czego świadomie nie ruszamy:` whiteboard/process/table feature breadth, new architecture, new panels, deep collaboration.

`Proof odbioru:` a user can create or open an idea, enter workspace, understand what it is for, understand what the active canvas is, and know the next useful move without product walkthrough.

`Ryzyka:` can expose deeper shell inconsistencies once the top layer becomes clearer.

##### Packet 2 — Cross-Canvas Continuity And Focus Modes
`Cel:` make switching lenses feel safe and intentional instead of technical.

`Zakres:` focus state UX, canvas switch continuity, selection persistence where meaningful, current-object/current-canvas cues, “whole idea vs focused work” clarity.

`Co dokładnie dowozimy:` visible continuity cues on tool switch, clearer focus-mode transitions, stronger current-object/current-canvas labeling, and confidence-building switching behavior.

`Czego świadomie nie ruszamy:` per-canvas feature redesign, new collaboration transport, new data model.

`Proof odbioru:` user switches from mindmap to one other canvas and back without feeling they left the idea or lost work context.

`Ryzyka:` touches shared shell primitives and may surface inconsistencies in other canvases that should remain out of scope for this wave.

##### Packet 3 — Promotion And Traceability Lane
`Cel:` make the workspace’s downstream value visible and testable.

`Zakres:` one bounded promotion lane from workspace object or branch into `initiative`, `task set`, or `decision`; source refs; backlink visibility; review-before-create.

`Co dokładnie dowozimy:` one clear promote flow, visible source rationale, explicit review step, and reopened backlink into source workspace object.

`Czego świadomie nie ruszamy:` broad reports/presentations scope, new outputs program, broad execution-side enhancements.

`Proof odbioru:` user promotes one branch into a downstream artifact and can later see where it came from.

`Ryzyka:` requires clean contract reuse with downstream modules; if those contracts are uneven, the packet can reveal real dependency debt.

##### Packet 4 — Workspace Collaboration Truth
`Cel:` stop the module from overpromising on shared work.

`Zakres:` visible workspace collaboration state, degraded-state explainability, one honest review/comment path, and one browser/staging proof of real behavior.

`Co dokładnie dowozimy:` explicit collaboration status in the live workspace, honest degraded-state messaging, one shared review/comment flow, and evidence that the chosen path actually works.

`Czego świadomie nie ruszamy:` full realtime editing parity, CRDT-grade merges, workshop-scale facilitation breadth.

`Proof odbioru:` user can tell whether collaboration is connected, degraded, or unavailable and what that means for their work.

`Ryzyka:` may surface unresolved split between native WebSocket runtime and legacy Socket.IO stub.

#### 4.8 Risks and dependencies
- `Mindmap` is the default visible entry into the workspace, so any shell-level improvement will depend on mindmap UX being trustworthy enough to carry that role.
- Shared shell changes can accidentally expose unfinished behavior in `Whiteboard`, `Process Flow`, and `Table`; those modules must remain dependencies, not absorbed scope.
- Promotion depends on stable contracts with `Initiatives`, `Tasks`, and `Decisions`.
- Collaboration depends on shared workspace runtime and the current dual-path server reality (`native ws` path plus legacy `socket.io` stub).
- Documentation authority is slightly muddy because a bounded historical acceptance exists alongside a current closure-ledger `red`.

### Mindmap

#### 4.1 Intended product behavior
- `Mind Map` should be the fastest structured-thinking surface inside `Idea Workspace`.
- It should let the user grow a tree directly from nodes with minimal friction.
- The core promise is not feature breadth; it is direct growth, predictable interaction, contextual AI help, semantic node depth, and stable persistence.
- Large maps should remain workable through branch focus, drill-down/drill-up, outline navigation, search/jump, and clear keyboard grammar.
- AI should behave as a branch-aware sidekick, not a generic chat window and not a silent mutator.
- Material AI mutations must stay in `propose -> preview -> accept/reject`.
- Node-level work should happen at two speeds: quick nearby edits for small changes and drawer depth for semantic editing.
- The canvas should stay calm, trustworthy, and clearly distinguish production-grade behavior from experimental depth.

#### 4.2 Current repo truth
- `Mindmap` is real, not a placeholder.
- `IdeaRecommendationMap.tsx` contains a broad production-like canvas with selection, connect, drag, branch growth, drill path, detail drawer, AI apply/review flows, preview flows, exports, and overlays.
- `useMindMapPersistence.ts` documents a serious ownership model: ReactFlow is canonical owner, workspace runtime is read-only mirror, saves go through conflict-safe `POST /map/sync`, and `409` conflict reload is explicit.
- Backend support is broad. `server/src/routes/my-work.routes.ts` exposes:
  - `GET/PUT /my-ideas/:id/map`
  - `POST /my-ideas/:id/map/sync`
  - `POST /my-ideas/:id/map/expand`
  - `POST /my-ideas/:id/map/ai-suggestions`
  - `POST /my-ideas/:id/map/gap-analysis`
  - snapshots endpoints
  - node comments endpoints
- Collaboration is also not fake. `CollaborationOverlay.tsx` opens authenticated `/ws/collab/:ideaId`, surfaces degraded mode, and syncs presence/locks/graph events.
- At the same time, the server still contains `ideaCollab.gateway.ts`, explicitly marked as a stub and noting that the frontend expects native WebSocket instead. This is a real coherence risk.
- `MINDMAP_DEVELOPMENT_STATUS_2026-03-15.md` shows a very broad implemented surface: tree growth, persistence, node depth model, subtree conversion, keyboard operations, layouts, import/export, AI expand, auto-clustering, branch health, artifact suggestions, branch summary, presentation mode.
- What genuinely works today:
  - default workspace entry into mindmap
  - child/sibling creation and inline edit
  - stable persistence and conflict detection
  - drill-down breadcrumb mechanics
  - node detail editing
  - snapshots/comments/import/export
  - multiple AI helpers and proposal review
- What is still partial:
  - interaction grammar is broader than calmer
  - contextual sidekick is present but not yet fully frozen as the main chat contract
  - collaboration and review are promising but still not one simple product story
  - some AI flows still use static or local fallbacks
  - the module exposes many advanced capabilities before the basic user model feels fully trustworthy

#### 4.3 Competitive standard
- `Miro` defines the modern baseline for collaborative mindmap-adjacent work:
  - fast node-local growth
  - easy collaboration and presence
  - branch collapse
  - export/share
  - workshop-grade ease rather than expert-only navigation
- `XMind` defines the baseline for large-map navigation:
  - drill down / drill up
  - breadcrumb path
  - branch-only focus
  - fold/unfold
  - keyboard-supported structural navigation
- `Whimsical` defines the baseline for calmness:
  - low-friction command menu
  - lightweight board behavior
  - fast recent-history access
  - less system heaviness during thinking work
- `Lucidchart / Lucidspark` define the baseline for downstream handoff:
  - visual ideation should connect naturally to structured outcomes, templates, actions, and shared team review
- User expectations in this category today are:
  - the main growth gesture is obvious
  - large maps remain navigable without wrestling the canvas
  - AI assists locally and contextually
  - collaboration state is understandable
  - menus do not feel like tool catalogs
- Where the repo is strong:
  - unusually deep semantic node model
  - serious persistence and conflict posture
  - strong branch-aware and artifact-aware ambition
  - stronger convert/governance ideas than most lightweight mindmapping tools
- Where it still trails:
  - calmness and trust are behind capability depth
  - chat-sidekick behavior is not yet as native as it should be
  - large-map navigation is part-implemented, but not yet finished as a simple, stable grammar
  - collaboration truth is not yet at the level of a board users can fully trust

#### 4.4 Main gaps
- The main interaction grammar is still too broad relative to how simple the core job should feel.
- The module needs clearer separation between primary branch-growth actions and secondary power features.
- Large-map navigation needs to feel fully solved, not just partially available through scattered features.
- The contextual AI sidekick needs to be more node-aware, branch-aware, and review-oriented in the visible UX.
- Review, comments, AI proposals, and collaboration need to feel like one coherent trust model.
- The product still lacks enough honest signaling about what is production-grade versus still maturing.
- Too many advanced features are already surfaced before the basic mental model is quiet enough.

| Dimension | Short description | Quality | Most important gap |
| --- | --- | --- | --- |
| `User value` | Strong for structured thinking and idea expansion. | `High` | The experience can still feel like a lab instead of a finished thinking tool. |
| `Flow completeness` | Many flows exist, but the primary happy path is not calibrated enough. | `Partial` | The main branch-growth and navigation grammar still needs freezing. |
| `UX quality` | Feature-rich but not calm enough. | `Partial` | Product simplicity is behind implementation breadth. |
| `Data / logic quality` | Better than average; persistence and semantic depth are real strengths. | `High` | Trust suffers when rich logic is not matched by equally clear interaction cues. |
| `Integration quality` | Stronger than a standalone mindmap tool because it sits in a larger system. | `Medium` | Downstream handoff and chat-sidekick still need cleaner visible productization. |
| `Trust / governance / error handling` | Good foundations, not yet product-finished. | `Partial` | Dual collaboration runtime story and uneven AI/co-review UX weaken confidence. |
| `Market standard fit` | Competitive on depth, below benchmark on calmness and closure. | `Partial` | Competitors feel more intentional in the core user model. |

#### 4.5 Minimal acceptance state now
- User opens `Mindmap` as the default thinking surface inside `Idea Workspace`.
- User can create child and sibling nodes directly and immediately edit them.
- User can move around the structure without guessing the mode, including branch focus and return.
- User can open quick semantic depth on a node without always paying the full drawer cost.
- User can open full node details for deeper metadata, notes, tags, evidence, and artifact links.
- User can invoke contextual AI on a selected node or branch and review structural proposals before applying them.
- User can reload without losing map state and sees explicit handling on conflict or degraded collaboration.
- User can import at least one real external format and export at least one real outline format.
- User sees honest collaboration state, not silent failure.
- Full Miro-class workshop facilitation, full collaboration parity, and exhaustive export permutations are not required for current wave acceptance.

#### 4.6 Top missing functions
- Frozen interaction grammar for select, pan, connect, and branch focus.
- Node-local action ring that clearly prioritizes add child, add sibling, properties, note, and AI.
- Two-speed editing model that is obvious in use, not just scattered in components.
- Strong branch drill-down / drill-up with clear breadcrumb and return behavior.
- Outline tree with search and jump for medium and large maps.
- More node-native quick note, tag, and evidence access.
- Contextual chat-sidekick that is selection-aware and branch-aware by default.
- Calmer AI suggestions grouped by intent instead of broad power exposure.
- One coherent collaboration/review story for comments, locks, authorship, and degraded mode.
- Honest production signaling for stable versus maturing features.

#### 4.7 Proposed bounded delivery packets
##### Packet 1 — Mindmap Interaction Grammar Freeze
`Cel:` make the core editing model obvious and fast.

`Zakres:` select/pan/connect clarity, node-local primary actions, keyboard consistency, immediate edit after create, calmer menu hierarchy.

`Co dokładnie dowozimy:` one explicit main branch-growth grammar plus clearer visible mode state and lighter menu burden.

`Czego świadomie nie ruszamy:` new AI breadth, new export families, collaboration architecture.

`Proof odbioru:` a user can build a branch tree for several minutes without menu hunting or mode confusion.

`Ryzyka:` may require pruning or demoting some advanced actions that are currently visible.

##### Packet 2 — Branch Focus, Outline, And Search
`Cel:` make larger maps workable instead of merely possible.

`Zakres:` drill-down, drill-up, breadcrumb stability, branch-only work, outline tree, search/jump.

`Co dokładnie dowozimy:` one coherent large-map navigation lane that complements the canvas instead of forcing zoom-only behavior.

`Czego świadomie nie ruszamy:` whiteboard/process/table navigation, new workspace shell, advanced analytics.

`Proof odbioru:` a user can enter one branch, work there, jump elsewhere, and return to full-map context without losing orientation.

`Ryzyka:` touches selection and visibility logic that already has significant code depth.

##### Packet 3 — Contextual Chat Sidekick
`Cel:` turn chat from adjacent helper into a true branch-aware copilot.

`Zakres:` selected-node conversation, branch conversation, review conversation, promotion conversation, node-native entry points, context package visibility.

`Co dokładnie dowozimy:` context-aware prompts, node/branch-native invocation points, clearer proposal review, better recommendations for switch-to-table/flow/whiteboard only when justified.

`Czego świadomie nie ruszamy:` broad AI platform redesign, generic chat OS scope, cross-product memory program.

`Proof odbioru:` user can ask about a branch, get a branch-aware response, review a structural proposal, and apply or reject it without leaving the map context.

`Ryzyka:` depends on existing chat/runtime contracts and can expose broader AI context inconsistencies.

##### Packet 4 — Trust And Collaboration Calibration
`Cel:` make the module trustworthy enough to stop overselling maturity.

`Zakres:` degraded-state visibility, lock/presence truth, comment/review coherence, explicit authorship, one browser/staging proof for shared-work behavior.

`Co dokładnie dowozimy:` visible collaboration status, clearer review semantics, reduced silent failure risk, and one evidence-backed statement of what shared editing really supports.

`Czego świadomie nie ruszamy:` full realtime merge parity, CRDT program, workshop-scale multiplayer breadth.

`Proof odbioru:` two users or one degraded session produce an understandable and documented collaboration state, with no silent ambiguity.

`Ryzyka:` server-side dual-path collaboration runtime is still a structural smell and may require explicit containment.

#### 4.8 Risks and dependencies
- `Mindmap` depends on the shared workspace shell staying stable; if shell is noisy, mindmap cannot feel calm enough.
- Branch-aware sidekick depends on existing AI context and proposal infrastructure behaving consistently.
- Collaboration packet depends on resolving or clearly containing the `native ws` versus `socket.io` stub split.
- Some historical docs overstate completion; the delivery program must use the stricter readiness audit as the active quality bar.
- If the team continues adding breadth first, the module will get worse, not better.

## 5. Cross-module dependencies
- `Idea Workspace` depends on `Mindmap` because it is the default and strongest visible thinking surface in the current repo truth.
- `Mindmap` depends on workspace shell coherence because without a calm shell the canvas cannot feel like part of one idea system.
- Promotion packets depend on existing contracts with `Tasks`, `Decisions`, and `Initiatives`, but should reuse those contracts rather than broaden them.
- Artifact linking and note continuity depend on existing notebook/artifact contracts; this plan should consume them, not redesign them.
- Collaboration packets depend on shared workspace multiplayer/runtime infrastructure; this plan should only ask for honest visible continuity, not reopen the whole multiplayer program.

## 6. Recommended execution order
1. `Idea Workspace — Entry And Shell Coherence`
   Uzasadnienie: without this, the module still feels like a powerful container in search of a main flow.
2. `Mindmap — Interaction Grammar Freeze`
   Uzasadnienie: the default canvas must feel trustworthy before more visible shell polish can fully land.
3. `Mindmap — Branch Focus, Outline, And Search`
   Uzasadnienie: this is the highest user-facing value for medium and large maps and closes the biggest navigation gap vs benchmark tools.
4. `Idea Workspace — Promotion And Traceability Lane`
   Uzasadnienie: this is the moment where the workspace starts feeling operational instead of isolated.
5. `Mindmap — Contextual Chat Sidekick`
   Uzasadnienie: once interaction grammar is calm, sidekick behavior can become genuinely useful instead of additive complexity.
6. `Idea Workspace + Mindmap — Trust And Collaboration Calibration`
   Uzasadnienie: this should close the remaining honesty gap about what the module really supports in shared work.

## 7. Final recommendation
The right way to finish this scope is not to celebrate breadth and not to restart architecture. The right way is to treat `Idea Workspace` as a shell-coherence problem and `Mindmap` as a trust-calibration problem. The module already has enough depth to impress; it does not yet have enough calmness to be reliably loved. That is why the next packets must remove ambiguity, not add novelty.

Do not reopen `Whiteboard`, `Process Flow`, or `Table` as adjacent delivery programs under this agent. Use them only where they are required to preserve workspace continuity. Do not claim `Miro-class` completion. Do not hide behind the historical `T1` acceptance, because that acceptance closed a bounded split-brain lane, not the user-facing product finish. Do not let AI breadth grow faster than interaction trust. Do not let promotion remain a doctrinal promise that the user cannot clearly feel.

If these packets are executed in order, this scope can move from “ambitious and code-rich” to “credible, usable, and execution-linked.” If they are not, the module will remain one of the clearest examples of a product that has many features but still asks the user to do too much interpretive work.
