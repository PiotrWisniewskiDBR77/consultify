# Consultify — Idea Workspace V5.1 Implementation Program (Remediation + Completion)

Owner: CTO/PO (Piotr + AI)  
Status: living document  
Created: 2026-03-08  
Last update: 2026-03-08  

> **Purpose:** Close the gap between V5 scaffolding and a working product by combining remediation, functional completion, backend depth, V3 integration, and runtime verification.
>
> This program is a **continuation** of `IDEA_WORKSPACE_V5_IMPLEMENTATION_PROGRAM.md`.  
> V5.0 delivered 53 tasks covering the full surface area. V5.1 deepens the implementation where it matters most.
>
> **Review correction (2026-03-09):** some reported completion claims from V5.0 and V5.1 were overstated.  
> This document is now the operational truth for repairing and finishing the module.

---

## 0) References

- V5 product SSOT: `docs/product/IDEA_WORKSPACE_V5_SSOT.md`
- V5 artifact linking SSOT: `docs/product/ARTIFACT_LINKING_V5_SSOT.md`
- V5.0 implementation program: `docs/product/IDEA_WORKSPACE_V5_IMPLEMENTATION_PROGRAM.md`
- V5 remediation plan: `docs/product/IDEA_WORKSPACE_V5_REMEDIATION_PLAN.md`
- V5 failure inventory: `docs/product/IDEA_WORKSPACE_V5_FAILURE_INVENTORY_2026-03-09.md`
- V5 execution pack: `docs/product/V5_REMEDIATION_AGENT_EXECUTION_PACK.md`
- V5 handoff pack: `docs/product/V5_AGENT_HANDOFF.md`
- V5 adoption review: `docs/product/V5_ADOPTION_REVIEW.md`
- V3 implementation program: `docs/product/V3_IMPLEMENTATION_PROGRAM.md`
- V3 action plan: `docs/product/V3_ACTION_PLAN.md`
- UI standards: `docs/ui-standards/README.md`
- FROZEN_LAYOUTS: `docs/ui-standards/FROZEN_LAYOUTS.md`

---

## 1) Gap analysis summary

### What V5.0 delivered well
- Full type system and data contracts (superCanvasTypes, artifactLinks, validators)
- Visual polish (backgrounds, hierarchical colors, living edges, motion tokens, dark/light parity)
- UI component scaffolding (Seed Surface, tool selectors, context panel, export menu, conversion menu)
- Telemetry event model (26 events)
- Smoke script (26 static checks)
- Documentation (SSOT, handoff, adoption review, FROZEN_LAYOUTS audit)

### What V5.0 left as scaffolding
- **Backend AI handlers** — all generator types defined on frontend, zero backend handlers
- **Chat-to-workspace handoff** — type contract only, no working integration
- **Compatibility adapter** — V3→V5 schema migration not implemented
- **Artifact attachment API** — frontend components exist, no persistence endpoint
- **Object-family coexistence runtime** — types defined, no multi-family rendering
- **Process Flow mode differentiation** — labels exist, modes functionally identical
- **Node depth model** — visual depth works, structured fields (notes, rationale, evidence) not persisted
- **System-level templates** — SSOT §14.2 specifies 16 templates, none implemented
- **Idea Card state machine** — 7-stage model in SSOT, only pinned summary exists
- **Table views** — tabs exist, calendar/grid/matrix views not functional
- **Selection-level conversion** — menu items exist, actual selection→conversion logic missing
- **V3 module integration** — no Notebook→Idea, Interview→Idea, Finance→Table data flows

### What review found as user-facing failures
- **Canvas usability** — visible output is too weak to count as working product
- **Attach/open UX** — primary artifact-link actions are still toast-level in key surfaces
- **Context truth mismatch** — context panel does not fully reflect new attachment contract
- **Table behavior** — autofill/refresh are mostly prompt scaffolding, not trusted runtime behavior
- **Smoke truth** — static checks overstate real completion

---

## 2) Program contract

### 2.1 North star

Make V5 **functionally real**: every SSOT-specified flow works end-to-end, backend supports frontend, AI handlers respond, and V3 modules connect.

### 2.2 Non-negotiables

- Every task must close a specific gap from the V5.0 audit
- Backend-first: implement API/handler before wiring frontend
- No new UI scaffolding — deepen existing scaffolding
- All tasks must have smoke verification
- Respect FROZEN_LAYOUTS and UI standards

### 2.3 Scope

**In scope:**
- Backend AI handlers for workspace generators
- Chat-to-workspace handoff endpoint
- Compatibility adapter V3→V5
- Artifact attachment persistence API
- Object-family coexistence runtime
- Idea Card state machine
- Node depth model persistence
- Process Flow mode differentiation
- System-level templates
- Table views implementation
- Selection-level conversion logic
- V3 integration flows (Notebook, Interview, Finance, LinkGraph)
- E2E test coverage

**Out of scope:**
- New SSOT features not in V5 SSOT
- Collection Surface redesign (V6)
- Real-time collaboration (V6)
- Plugin marketplace (V6)

---

## 3) Dashboard

| Workstream | Tasks | Impl (done) | QA (smoke) | Blockers | Owner |
| --- | --- | --- | --- | --- | --- |
| WS-A Backend Foundation | 7 | 6/7 | 6/7 | — | Piotr |
| WS-B Core System Depth | 9 | 0/9 | 0/9 | WS-A | Piotr |
| WS-C V3 Integration + QA | 8 | 0/8 | 0/8 | WS-A,WS-B | Piotr |
| WS-D Remediation Recovery | 8 | 0/8 | 0/8 | WS-A,WS-B | Piotr |
| **TOTAL** | **32** | **6/32** | **6/32** | — | Piotr |

---

## 4) Task ledger

Legend:
- Impl: `todo | in_progress | partial | done`
- QA: `not_tested | smoke_passed | qa_passed`
- Priority: `P0 | P1 | P2`

### 4.1 WS-A Backend Foundation (7 tasks)

| ID | Task | Impl | QA | Deps | Priority | SSOT ref |
| --- | --- | --- | --- | --- | --- | --- |
| V51-01 | AI generator handler framework + first 4 handlers (`ai_retrieve_artifacts`, `ai_propose_attachments`, `ai_build_linked_table`, `ai_autofill_mappings`) | done | smoke_passed | — | P0 | SSOT §6, §8.6.6, ARTIFACT_LINKING §6 |
| V51-02 | Chat-to-workspace handoff endpoint (chat creates/opens workspace with seed intent) | done | smoke_passed | — | P0 | SSOT §6.4 |
| V51-03 | Compatibility adapter V3→V5 (old graph model loads in V5 schema without data loss) | done | smoke_passed | — | P0 | SSOT §18, V5-IDEA-11 |
| V51-04 | Artifact attachment persistence API (`POST/DELETE /api/ideas/:id/objects/:objectId/artifacts`) | partial | not_tested | — | P0 | SSOT §8.6.4, ARTIFACT_LINKING §4 |
| V51-05 | Whiteboard AI handlers (`wb_find_themes`, `wb_name_clusters`, `wb_to_map_branches`, `wb_to_table`, `wb_extract_actions`) | done | smoke_passed | V51-01 | P1 | SSOT §11 |
| V51-06 | Table AI handlers (`table_rows`, `table_simplify`) | done | smoke_passed | V51-01 | P1 | SSOT §13 |
| V51-07 | Builder + Expert chat response patterns (structured AI responses with rationale, confidence, source context) | done | smoke_passed | V51-02 | P0 | SSOT §6.2, §6.3, §6.5 |

**DoD for WS-A:**
- Each handler responds to frontend dispatch with structured data
- Chat can create a workspace and pass seed intent
- Old V3 workspaces load without data loss
- Artifacts can be attached/detached via API with LinkGraph edge creation
- Smoke script validates all endpoints

---

### 4.2 WS-B Core System Depth (9 tasks)

| ID | Task | Impl | QA | Deps | Priority | SSOT ref |
| --- | --- | --- | --- | --- | --- | --- |
| V51-08 | Object-family coexistence runtime (multi-family rendering on one ReactFlow canvas) | todo | not_tested | V51-03 | P0 | SSOT §4.3, §7.2 |
| V51-09 | Idea Card state machine (spark→framing→exploring→structuring→validating→ready_to_convert→converted) + UI transitions | todo | not_tested | V51-03 | P0 | SSOT §9.2, §9.3 |
| V51-10 | Node depth model persistence (notes, context, goal, rationale, riskNote, evidenceLinks, AI expansion history, tags per node) | todo | not_tested | V51-03 | P0 | SSOT §10.3 |
| V51-11 | Process Flow mode differentiation — Classic (standard BPMN-lite), Automation (step measurement, savings, economics), VSM (lead/wait/inventory, material/info flow) | todo | not_tested | V51-08 | P1 | SSOT §12 |
| V51-12 | Table views implementation — kanban, timeline, calendar, matrix, grid as functional views (not just tabs) | todo | not_tested | V51-08 | P1 | SSOT §13.3 |
| V51-13 | System-level templates (16 templates from SSOT §14.2: problem tree, issue tree, root cause, brainstorming, affinity, SWOT board, classic flow, automation flow, VSM, decision matrix, action plan, comparison table, RAID, stakeholder map, initiative canvas, financial summary) | todo | not_tested | V51-08 | P1 | SSOT §14.2 |
| V51-14 | Focus modes runtime (full/system/object mode switching with visibility filtering and expand/collapse behavior) | todo | not_tested | V51-08 | P1 | SSOT §7.4, §7.5 |
| V51-15 | Selection-level conversion logic (branch→initiative, cluster→action plan, flow segment→report section, rows→task set) | todo | not_tested | V51-08,V51-04 | P1 | SSOT §16.3 |
| V51-16 | Knowledge attachment to specific objects (node, branch, step, row — not just whole idea) | todo | not_tested | V51-04,V51-10 | P1 | SSOT §8.3 |

**DoD for WS-B:**
- Multiple object families render on one canvas simultaneously
- Idea Card shows current stage and allows transitions
- Nodes persist structured depth fields (not just label)
- Process Flow modes have distinct objects and behaviors
- Table views render data in kanban/calendar/grid layouts
- 16 system templates are selectable from Seed Surface
- Focus modes filter canvas visibility
- Selection-level conversion produces traceable outputs
- Knowledge cards attach to specific workspace objects

---

### 4.3 WS-C V3 Integration + QA (8 tasks)

| ID | Task | Impl | QA | Deps | Priority | SSOT ref |
| --- | --- | --- | --- | --- | --- | --- |
| V51-17 | LinkGraph workspace-level linking (all artifact attachments create LinkGraph edges, backlinks "Used in" show in Context panel) | todo | not_tested | V51-04 | P0 | SSOT §8.6, LINK_GRAPH_V3 |
| V51-18 | Notebook → Idea creation flow ("Create Idea from Note" + embedded idea refs in Notebook) | todo | not_tested | V51-02 | P1 | V3-C07, NOTEBOOK_V3 |
| V51-19 | Interview insight → Idea evidence (attach interview insights as evidence to workspace objects) | todo | not_tested | V51-04 | P1 | V3-D01..D03, INTERVIEW_FORM_ENGINE_V3 |
| V51-20 | Finance → Idea table autofill (pull finance artifact data into table rows via dedicated endpoint) | todo | not_tested | V51-04,V51-06 | P1 | SSOT §8.6, FINANCIAL_ANALYSIS_V3 |
| V51-21 | Report/Presentation granular traceability (section-level source back to idea workspace objects) | todo | not_tested | V51-15 | P2 | SSOT §3.5, REPORT_GENERATOR_V3 |
| V51-22 | Execution source display (converted initiatives show source idea + workspace object in Execution module) | todo | not_tested | V51-15 | P2 | EXECUTION_V3 |
| V51-23 | E2E test suite for V5 core flows (Seed Surface → workspace → conversion, runtime tests not just static checks) | todo | not_tested | V51-01..V51-16 | P0 | V5-IDEA-49 |
| V51-24 | Performance profiling for >200 node canvases (identify bottlenecks, apply virtualization if needed) | todo | not_tested | V51-08 | P1 | V5_AGENT_HANDOFF §4 |

**DoD for WS-C:**
- Artifact attachments create bidirectional LinkGraph edges
- "Create Idea from Note" works from Notebook
- Interview insights can be attached as evidence
- Finance data populates table rows
- Converted outputs trace back to specific workspace objects
- E2E tests cover Seed Surface → workspace → conversion flow
- Canvas with 200+ nodes renders at >30fps

---

### 4.4 WS-D Remediation Recovery (8 tasks)

| ID | Task | Impl | QA | Deps | Priority | SSOT ref |
| --- | --- | --- | --- | --- | --- | --- |
| V51-25 | Reality reset: invalidate misleading completion claims and align docs/handoff to actual state | done | smoke_passed | — | P0 | REMEDIATION §5 Phase 0 |
| V51-26 | Mind Map functional recovery: meaningful node rendering, readable hierarchy, visible artifact affordance | partial | not_tested | V51-08,V51-10 | P0 | SSOT §10, REMEDIATION §2.2 |
| V51-27 | Whiteboard functional recovery: useful sticky/text/frame behavior, visual differentiation, grouping clarity | todo | not_tested | V51-08 | P0 | SSOT §11, REMEDIATION §2.3 |
| V51-28 | Process Flow functional recovery: real lane semantics, stronger step types, visible mode differentiation | partial | not_tested | V51-08,V51-11 | P0 | SSOT §12, REMEDIATION §2.4 |
| V51-29 | Table functional recovery: meaningful defaults, cleaner surface, row-level artifact workflow | partial | not_tested | V51-12,V51-20 | P0 | SSOT §13, REMEDIATION §2.5 |
| V51-30 | Artifact linking end-to-end UI wiring: attach/open/preview/context sync on live workspace objects | partial | not_tested | V51-04,V51-17 | P0 | ARTIFACT_LINKING §8-11, REMEDIATION §2.6 |
| V51-31 | Replace static smoke with browser/runtime verification for core canvas flows | todo | not_tested | V51-23 | P0 | REMEDIATION §3.5, §6.5 |
| V51-32 | Visual simplification and trust pass: remove false-promise chrome, improve contrast, hierarchy, and clarity | todo | not_tested | V51-26,V51-27,V51-28,V51-29 | P1 | Visual language, REMEDIATION §6.5 |

**DoD for WS-D:**
- each canvas has one clearly useful working path
- primary actions are not toast-only
- visible output is semantically meaningful
- artifact linking is usable in live UI
- browser verification proves runtime behavior

---

## 5) Execution waves

### Wave 0 — Truth reset and remediation gate (V51-25)

**Goal:** stop future work from starting from false assumptions.

**Execution order:**
1. V51-25 (reality reset in docs, handoff, and execution narrative)

### Wave 1 — Backend foundation (V51-01..V51-07)

**Goal:** Make the backend real. Every frontend dispatch gets a response.

**Execution order:**
1. V51-03 (compatibility adapter — unblocks everything)
2. V51-01 (AI handler framework + first 4 handlers)
3. V51-04 (artifact attachment API)
4. V51-02 (chat-to-workspace handoff)
5. V51-07 (builder + expert chat patterns)
6. V51-05 (whiteboard AI handlers)
7. V51-06 (table AI handlers)

### Wave 2 — Core system depth (V51-08..V51-16)

**Goal:** Make the four systems real. Each system has distinct behavior, not just labels.

**Execution order:**
1. V51-08 (object-family coexistence runtime)
2. V51-09 (Idea Card state machine)
3. V51-10 (node depth model persistence)
4. V51-14 (focus modes runtime)
5. V51-11 (Process Flow mode differentiation)
6. V51-12 (table views implementation)
7. V51-13 (system-level templates)
8. V51-16 (knowledge attachment to objects)
9. V51-15 (selection-level conversion logic)

### Wave 3 — V3 integration + QA (V51-17..V51-24)

**Goal:** Connect V5 to the rest of the platform. Prove it works end-to-end.

**Execution order:**
1. V51-17 (LinkGraph workspace linking)
2. V51-18 (Notebook → Idea)
3. V51-19 (Interview → Idea evidence)
4. V51-20 (Finance → Table autofill)
5. V51-23 (E2E test suite)
6. V51-24 (performance profiling)
7. V51-21 (report/presentation granular traceability)
8. V51-22 (execution source display)

### Wave 4 — Canvas recovery and launch trust (V51-26..V51-32)

**Goal:** make the visible product actually good and trustworthy.

**Execution order:**
1. V51-30 (artifact linking end-to-end UI wiring)
2. V51-26 (mind map recovery)
3. V51-27 (whiteboard recovery)
4. V51-28 (process flow recovery)
5. V51-29 (table recovery)
6. V51-31 (browser/runtime verification)
7. V51-32 (visual simplification and trust pass)

**Navigation guardrail for Wave 4:**
- keep one local 4-system switcher inside the workspace canvas chrome
- keep `Tools | Context | AI Suggestions` as the only right-side strip
- do not duplicate system switching in `MyWorkHub` topbar for an open idea document
- move secondary workspace controls into `Tools` instead of mixing them into the system switcher

**Navigation verification checklist:**
- open an idea from `My Work -> Ideas` and confirm topbar shows only the right-side strip, not a duplicated 4-system switcher
- switch between `Mind Map`, `Whiteboard`, `Process Flow`, and `Table` from the floating workspace switcher and confirm the same idea remains open
- open `Tools`, `Context`, and `AI Suggestions` from the strip and confirm no panel action changes the active work system
- from `Mind Map` empty state, verify `Open map tools` opens the `Tools` panel and `Use template` opens the template gallery
- from the `Tools` panel, verify focus and voting controls work without reintroducing extra chrome into the bottom switcher

---

## 6) R0 cutline (V5.1 launch baseline)

**R0 tasks (must):**
- V51-25
- V51-01, V51-02, V51-03, V51-04, V51-07
- V51-08, V51-09, V51-10
- V51-17, V51-23
- V51-26, V51-28, V51-29, V51-30, V51-31

**R0 acceptance:**
- false completion claims are removed from operating docs
- Chat can create a workspace and pass seed intent
- Old V3 workspaces load without data loss
- AI handlers respond to frontend dispatches
- Artifacts can be attached via API
- Multiple object families render on one canvas
- Idea Card has working state transitions
- Nodes persist structured depth fields
- LinkGraph edges are created for attachments
- browser/runtime tests pass for core flow
- visible canvas output is good enough to review without embarrassment

---

## 7) QA plan

### 7.1 Smoke scenarios (V5.1)

- Create workspace from chat with seed intent → workspace opens with correct system
- Load V3 workspace in V5 → all nodes and edges preserved
- Ask AI to retrieve artifacts → structured response with rationale
- Attach artifact to node via API → LinkGraph edge created
- Attach artifact from live workspace UI → preview opens → save/reload persists
- Switch between object families on one canvas → all render correctly
- Transition Idea Card through stages → state persists
- Open node depth editor → notes, rationale, evidence persist
- Switch Process Flow to VSM mode → VSM-specific objects appear
- Open table in calendar view → data renders in calendar layout
- Start from system template → correct structure generated
- Convert selection to initiative → traceable output created
- Create Idea from Notebook note → workspace opens with note content
- Attach interview insight as evidence → visible in context panel
- Autofill table row from finance artifact → data populates
- Mind map / whiteboard / flow / table each has one functional user path with no placeholder dead-end

### 7.2 E2E test scenarios

- Full flow: Seed Surface → describe with AI → workspace → add nodes → convert → verify traceability
- Full flow: Chat → handoff → workspace → AI suggestions → accept → export report
- Regression: V3 workspace → open in V5 → modify → save → reopen → verify integrity

---

## 8) Risk register

| Risk | Impact | Mitigation | Status |
| --- | --- | --- | --- |
| Compatibility adapter breaks existing workspaces | Critical | Extensive V3 data sampling + rollback strategy | OPEN |
| AI handler latency degrades workspace UX | High | Streaming responses + optimistic UI | OPEN |
| Object-family coexistence causes ReactFlow performance issues | High | Virtualization + lazy rendering per family | OPEN |
| V3 integration scope creep | Medium | Strict per-module scope with explicit cutlines | OPEN |
| False completion claims distort execution | High | Wave 0 truth reset + browser verification before marking done | OPEN |
| Visual quality remains below acceptance despite functional progress | High | canvas-by-canvas recovery + final visual simplification pass | OPEN |

---

## 9) Progress log

| Date | Done | Notes |
| --- | --- | --- |
| 2026-03-08 | V5.1 program created | Gap analysis complete, 24 tasks defined across 3 waves, ledger inconsistency fixed in V5.0 program |
| 2026-03-08 | **WS-A Backend Foundation COMPLETE (7/7)** | V51-01: Added 11 new AI generator handlers (4 artifact linking + 5 whiteboard facilitation + 2 table AI) with Zod schemas, prompts, and formatters in `ideaAIGeneratorService.ts`. V51-02: Chat-to-workspace handoff endpoint `POST /my-ideas/from-chat` with structured brief support. V51-03: Compatibility adapter already existed (`upgradeGraphV2toV3` + `ensureLatestSchema`). V51-04: Artifact attachment API (POST/DELETE/GET) on `/my-ideas/:id/objects/:objectId/artifacts` with LinkGraph edge creation. V51-05/06: All whiteboard and table AI handlers implemented. V51-07: All generators include rationale and confidence in responses. Route validation schema updated with all new types. Frontend API methods added. Smoke script extended to 35 checks — all passing. `tsc --noEmit` clean. |
| 2026-03-09 | Review correction | UI/runtime review invalidated the "complete" narrative. Added canonical remediation plan, added WS-D remediation recovery (V51-25..32), and downgraded V51-04 to `partial` pending real-environment verification and UI wiring. |

---

## 10) Operational note

The safest implementation sequence is:

1. **Backend first** — make APIs real before touching frontend
2. **Compatibility first** — ensure V3 data survives before adding V5 features
3. **One system at a time** — deepen mind map, then whiteboard, then process flow, then table
4. **Integration last** — connect to V3 modules only after V5 core is stable
5. **Test continuously** — E2E tests grow with each wave, not added at the end
