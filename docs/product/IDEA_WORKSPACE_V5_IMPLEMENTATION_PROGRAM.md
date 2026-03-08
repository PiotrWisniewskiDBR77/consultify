# Consultify — Idea Workspace V5 Implementation Program (SSOT / Backlog Ledger)

Owner: CTO/PO (Piotr + AI)  
Status: living document (v5 idea-workspace program)  
Last update: 2026-03-08  

> **Cel tego pliku:** mieć jedno, precyzyjne źródło prawdy dla wdrożenia `Idea Workspace V5`: założenia, taski, statusy, DoD, acceptance, zależności, ryzyka, fale wdrożeniowe i plan release.
>
> Ten dokument jest programem wdrożeniowym dla modułu `Ideas`.  
> Źródłem prawdy produktu jest `docs/product/IDEA_WORKSPACE_V5_SSOT.md`.

---

## ▶ START HERE — zacznij teraz

**Krok 0 — przeczytaj SSOT:**  
`docs/product/IDEA_WORKSPACE_V5_SSOT.md`

**Krok 1 — potwierdź kanon UI:**  
`docs/ui-standards/FROZEN_LAYOUTS.md`  
`docs/ui-standards/00-foundation/visual-language.md`

**Krok 2 — wybierz pierwszy task implementacyjny z Wave 1:**  
`V5-IDEA-04` Build Seed Surface shell  
albo `V5-IDEA-08` Implement chat-to-workspace handoff contract  
albo `V5-IDEA-10` Evolve canonical workspace document schema

**Krok 3 — branch naming:**  
`feature/V5-IDEA-04-seed-surface`  
`feature/V5-IDEA-08-chat-handoff`  
`feature/V5-IDEA-10-supercanvas-contract`

**Krok 4 — po zakończeniu taska:**  
zaktualizuj dashboard (2.3), blockers (2.4) i progress log (2.6).

---

## 0) Referencje (SSOT)

### Product / module
- `docs/product/IDEA_WORKSPACE_V5_SSOT.md`
- `docs/product/ARTIFACT_LINKING_V5_SSOT.md`
- `docs/MYWORK_MODULE_SPECIFICATION.md`
- `docs/product/PROCESS_MYWORK_TO_DELIVERABLES_V3.md`
- `docs/product/LINK_GRAPH_V3.md`
- `docs/product/CONSULTING_TOOLS_TOOL_SPECS_V3.md`
- `docs/product/TOOLS_CATALOG_V3.md`

### Historical / compatibility
- `docs/product/IDEA_WORKSPACE_V3_SSOT.md`
- `docs/product/IDEA_WORKPLACE_VNEXT_IMPLEMENTATION_PLAN.md`
- `docs/product/V4_GAP_ANALYSIS.md`

### UI/UX canon
- `docs/ui-standards/README.md`
- `docs/ui-standards/FROZEN_LAYOUTS.md`
- `docs/ui-standards/00-foundation/visual-language.md`
- `docs/ui-standards/00-foundation/color-system.md`
- `docs/ui-standards/01-shell-layout/artifact-shell.md`
- `docs/ui-standards/01-shell-layout/presentation-modes.md`
- `docs/ui-standards/02-components/workspace-3-tools-strip.md`
- `docs/ui-standards/03-modules/module-hub-standard.md`
- `docs/ui-standards/03-modules/view-modes-standard.md`
- `docs/ui-standards/03-modules/interactive-board-standard.md`

### Current code anchors
- `src/components/MyWork/MyWorkHub.tsx`
- `src/components/MyWork/IdeaMapWorkspace.tsx`
- `src/components/MyWork/IdeaCanvasToolSelector.tsx`
- `src/components/MyWork/IdeaWorkspaceToolbar.tsx`
- `src/components/MyWork/IdeaWorkspaceTools.tsx`
- `src/components/MyWork/IdeaTemplateGallery.tsx`
- `src/components/MyWork/IdeaContextPanel.tsx`
- `src/components/MyWork/IdeaProcessFlowTool.tsx`
- `src/components/MyWork/IdeaWhiteboardTool.tsx`
- `src/components/MyWork/IdeaTableTool.tsx`

---

## 0.5) Readiness checklist — 100% gotowość do wdrożenia

> Stan: **GOTOWI DO STARTU FALI 1** (2026-03-08)

| # | Kryterium | Status |
| --- | --- | --- |
| 1 | Kanoniczny SSOT produktu dla V5 istnieje | ✅ |
| 2 | Program wdrożeniowy V5 istnieje | ✅ |
| 3 | SuperCanvas, Knowledge Layer i AI Builder+Expert są opisane | ✅ |
| 4 | 4 native systems mają odrębne kontrakty narzędzi | ✅ |
| 5 | Seed Surface + Chat handoff są opisane | ✅ |
| 6 | V5 task ledger z dependencies i falami istnieje | ✅ |
| 7 | R0 cutline jest zdefiniowana | ✅ |
| 8 | QA smoke scenarios są zdefiniowane | ✅ |
| 9 | Scope control: explicit out-of-scope zapisane | ✅ |
| 10 | Historyczne dokumenty wskazują na V5 jako aktualny kierunek | ✅ |

**Go-ahead:** Można startować implementację Wave 1. Dokumentacja i kierunek architektoniczny są zamknięte dla startu.

---

## 1) Kontrakt programu (V5)

### 1.1 North star

Zbudować `Idea Workspace V5` jako AI-native `Thinking OS`, w którym jedna idea ma jeden wspólny workspace z:
- lekkim wejściem
- wspólnym SuperCanvas
- 4 native systems
- warstwą wiedzy
- AI Builder + Expert
- ścieżką do execution

### 1.2 Nienegocjowalne (MUST)

- **SSOT-first**: każdy task mapuje do `IDEA_WORKSPACE_V5_SSOT.md`.
- **One workspace**: nie implementujemy 4 odseparowanych mini-aplikacji.
- **AI contract**: duże zmiany tylko `propose -> preview -> accept/reject`.
- **Workspace strip canon**: tylko `Tools | Context | AI Suggestions`.
- **Tech Sexy**: chrome monochromatyczny, depth przez tło, motion funkcjonalny, bez clutteru.
- **Traceability**: wszystkie wyjścia mają source lineage.
- **Dark + light parity**: obie wersje są premium.

### 1.3 Scope V5 (explicit)

W scope:
- Seed Surface
- Chat-first handoff
- SuperCanvas
- Idea Card
- Knowledge Layer
- 4 systems of work
- conversion to outputs
- visual polish

Out of scope:
- pełna real-time collaboration enterprise-wide
- plugin marketplace
- pełna Airtable admin parity
- whiteboard design-tool parity
- pełna BPMN certification scope

### 1.4 Definition of Done for any task

Task jest done tylko jeśli:
- jest zgodny z V5 SSOT
- respektuje UI standards i FROZEN_LAYOUTS
- ma jasny acceptance / smoke
- nie wprowadza cichego AI overwrite
- nie łamie wspólnego modelu jednej idei
- nie tworzy nowego równoległego source-of-truth

---

## 2) Dashboard programu (postęp + kontrola)

### 2.1 Statusy (kontrakty)

**Status specyfikacji (per task):**
- `draft`
- `review`
- `locked`
- `implemented`

**Status implementacji (per task):**
- `todo`
- `in_progress`
- `partial`
- `blocked`
- `done`

**Status QA (per task):**
- `not_tested`
- `smoke_passed`
- `qa_passed`

**Target release:**
- `R0` — foundation / no-stress launch baseline
- `R1` — functional parity of core workspace
- `R2` — premium differentiation and polish

### 2.2 Required fields in task ledger

Każdy task musi mieć:
- **ID**
- **SSOT**
- **Description**
- **Dependencies**
- **DoD / acceptance**
- **Owner**
- **PR / commit / notes** w progress log

Reguła:
- `done` bez smoke = nie istnieje

### 2.3 Dashboard workstreams

| Workstream | Tasks | Spec (locked) | Impl (done) | QA (smoke) | Blockers | Owner |
| --- | --- | --- | --- | --- | --- | --- |
| WS-A Product / IA | 4 | 4/4 | 4/4 | 4/4 | — | Piotr |
| WS-B Seed + Chat | 6 | 0/6 | 0/6 | 0/6 | — | Piotr |
| WS-C SuperCanvas Core | 7 | 0/7 | 0/7 | 0/7 | — | Piotr |
| WS-D Native Systems | 10 | 0/10 | 0/10 | 0/10 | — | Piotr |
| WS-E Knowledge + Context | 4 | 0/4 | 0/4 | 0/4 | — | Piotr |
| WS-F Artifact Linking + Retrieval | 6 | 0/6 | 0/6 | 0/6 | — | Piotr |
| WS-G Conversion + Outputs | 4 | 0/4 | 0/4 | 0/4 | — | Piotr |
| WS-H Visual Tech Sexy | 7 | 0/7 | 0/7 | 0/7 | — | Piotr |
| WS-I QA + Ops | 5 | 0/5 | 0/5 | 0/5 | — | Piotr |
| **TOTAL** | **53** | **4/53** | **4/53** | **4/53** | — | Piotr |

### 2.4 Current blockers

| Date | Blocker | Blocks tasks | Owner | Status | Next step |
| --- | --- | --- | --- | --- | --- |
| — | — | — | — | — | — |

### 2.5 Risks

| Risk | Impact | Mitigation | Status |
| --- | --- | --- | --- |
| Seed Surface becomes too busy | High | one hero input, 3 primary starts, advanced brief hidden | OPEN |
| SuperCanvas becomes messy | High | object families + focus modes + layout rules | OPEN |
| Whiteboard scope explodes | High | keep business-first subset, no plugin zoo | OPEN |
| Table scope turns into DB builder | High | keep decision/analysis focus, not admin modeling | OPEN |
| Process Flow tries to do too much | Medium | split into Classic / Automation / VSM modes with explicit scope | OPEN |
| Motion becomes gimmicky | Medium | functional motion only, no decorative animation | OPEN |
| AI writes too much too fast | High | strict preview/apply rule | OPEN |

### 2.6 Progress log

| Date | Done | Notes / link |
| --- | --- | --- |
| 2026-03-08 | V5 docs initialized | Created `IDEA_WORKSPACE_V5_SSOT.md` and `IDEA_WORKSPACE_V5_IMPLEMENTATION_PROGRAM.md`; aligned implementation direction around Seed Surface, SuperCanvas, Knowledge Layer, 4 native systems, and Tech Sexy 2026. |
| 2026-03-08 | Docs alignment closed | Updated `MYWORK_MODULE_SPECIFICATION.md`, `IDEA_WORKSPACE_V3_SSOT.md`, and `IDEA_WORKPLACE_VNEXT_IMPLEMENTATION_PLAN.md` to point new work to V5. Closed WS-A doc/IA tasks. |
| 2026-03-08 | Artifact linking direction added | Extended V5 with platform artifact identity, lightweight linking UX, finance artifact parity, table autofill, and AI artifact linking proposals. |
| 2026-03-08 | Artifact Linking SSOT created | Added `ARTIFACT_LINKING_V5_SSOT.md` as canonical cross-platform source of truth and locked implementation tasks V5-IDEA-31..36. |
| 2026-03-08 | WS-E Knowledge Layer done | V5-IDEA-29 (capture/import flows), V5-IDEA-30 (search & insert knowledge). Context panel now has evidence capture (URL, text, canvas) and knowledge search with source filters. |
| 2026-03-08 | WS-F Artifact Linking core done | V5-IDEA-31 (unified artifact identity: ArtifactRef, ArtifactIndex, ARTIFACT_IDENTITY map with 19 types incl. finance), V5-IDEA-32 (WorkspaceObjectRef + ObjectAttachment contract in validators + frontend), V5-IDEA-33 (ArtifactPreviewCard, ArtifactAttachPopover, ArtifactLinkIndicator shared components + attach/open quick actions in workspace). |
| 2026-03-08 | WS-F complete + WS-G started | V5-IDEA-34 (finance getBasePath parity for /economics routes), V5-IDEA-35 (table autofill/refresh quick actions + AI chat prompts), V5-IDEA-36 (4 new AI generator types: ai_retrieve_artifacts, ai_propose_attachments, ai_build_linked_table, ai_autofill_mappings + UI in workspace tools). |
| 2026-03-08 | WS-G Conversion done | V5-IDEA-37 (extended IdeaConvertTarget with finance types, expanded ConvertToOutputMenu with 7 targets incl. financial_model/budget/valuation/analysis + navigation), V5-IDEA-38 (per-system "Convert selection" sections in workspace tools for mindmap/whiteboard/flow/table + CONVERT_PREFIX_MAP routing in IdeaMapWorkspace). |
| 2026-03-08 | WS-G complete + WS-H started | V5-IDEA-39 (traceability: LinkGraph edge creation + outputLinks persistence on conversion), V5-IDEA-40 (report/deck export formats in IdeaExportMenu dispatching conversion actions). |
| 2026-03-08 | WS-H Visual Tech Sexy first 3 done | V5-IDEA-41 (Seed Surface premium visual language: gradient header, icon badges, depth shadows, enhanced PrimaryStartButton with hover animations), V5-IDEA-42 (unified canvasBackground.ts config with per-tool light/dark tokens, variant selector, applied to mind map), V5-IDEA-43 (hierarchical color system: DEPTH_OPACITY modulation, getNodeDepth utility, depth injection on load, depth-aware branchColor for edges). |
| 2026-03-08 | WS-H complete + WS-I started | V5-IDEA-44 (living edges: selection pulse, hover thickness, directional particles on GradientEdge and FlowEdgeComponent), V5-IDEA-45 (CanvasZoomControls shared component: zoom in/out, fit view, focus selected, restore saved viewport), V5-IDEA-46 (dark/light parity: ArtifactPreviewCard metadata, ArtifactLinkIndicator badge, ConvertToOutputMenu full light mode), V5-IDEA-47 (motionTokens.ts canonical config, tool selector microinteractions with scale/active states), V5-IDEA-48 (26 new V5 telemetry events in FunnelEventName: seed surface, systems, knowledge, artifacts, AI, conversion, export, viewport). |

---

## 3) Task ledger (pełna lista — 53 tasks)

Legend:
- Spec: `draft | review | locked | implemented`
- Impl: `todo | in_progress | partial | blocked | done`
- QA: `not_tested | smoke_passed | qa_passed`
- Priority: `P0 | P1 | P2`

### 3.1 WS-A Product / IA (4)

| ID | Task | Spec | Impl | QA | Deps | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| V5-IDEA-00 | Align docs and source of truth | implemented | done | smoke_passed | — | P0 |
| V5-IDEA-01 | Lock Seed Surface IA and startup logic | implemented | done | smoke_passed | V5-IDEA-00 | P0 |
| V5-IDEA-02 | Lock SuperCanvas architecture and object families | implemented | done | smoke_passed | V5-IDEA-00 | P0 |
| V5-IDEA-03 | Lock per-system tool contracts and scope cutlines | implemented | done | smoke_passed | V5-IDEA-00 | P0 |

### 3.2 WS-B Seed + Chat (6)

| ID | Task | Spec | Impl | QA | Deps | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| V5-IDEA-04 | Build Seed Surface shell | draft | todo | not_tested | V5-IDEA-01 | P0 |
| V5-IDEA-05 | Add hero input + primary start actions | draft | todo | not_tested | V5-IDEA-04 | P0 |
| V5-IDEA-06 | Add Popular Starts intent system | draft | todo | not_tested | V5-IDEA-05 | P1 |
| V5-IDEA-07 | Add Structured Brief advanced mode | draft | todo | not_tested | V5-IDEA-05 | P1 |
| V5-IDEA-08 | Implement chat-to-workspace handoff contract | draft | todo | not_tested | V5-IDEA-01 | P0 |
| V5-IDEA-09 | Builder + Expert chat response patterns | draft | todo | not_tested | V5-IDEA-08 | P0 |

### 3.3 WS-C SuperCanvas Core (7)

| ID | Task | Spec | Impl | QA | Deps | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| V5-IDEA-10 | Evolve canonical workspace document schema | draft | todo | not_tested | V5-IDEA-02 | P0 |
| V5-IDEA-11 | Add compatibility adapter from current graph model | draft | todo | not_tested | V5-IDEA-10 | P0 |
| V5-IDEA-12 | Refactor workspace shell for V5 | draft | todo | not_tested | V5-IDEA-02 | P0 |
| V5-IDEA-13 | Add pinned Idea Card summary surface | draft | todo | not_tested | V5-IDEA-12 | P0 |
| V5-IDEA-14 | Add object-family coexistence on shared canvas | draft | todo | not_tested | V5-IDEA-10 | P0 |
| V5-IDEA-15 | Add focus modes and expand/collapse behavior | draft | todo | not_tested | V5-IDEA-14 | P1 |
| V5-IDEA-16 | Persist viewport, selection, preferred system, and reopen state | draft | todo | not_tested | V5-IDEA-12 | P0 |

### 3.4 WS-D Native Systems (10)

| ID | Task | Spec | Impl | QA | Deps | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| V5-IDEA-17 | Mind Map v5 interaction layer | draft | todo | not_tested | V5-IDEA-03,V5-IDEA-14 | P0 |
| V5-IDEA-18 | Mind Map node depth model + node detail persistence | draft | todo | not_tested | V5-IDEA-17 | P0 |
| V5-IDEA-19 | Whiteboard v5 interaction layer | draft | todo | not_tested | V5-IDEA-03,V5-IDEA-14 | P0 |
| V5-IDEA-20 | Whiteboard clustering and facilitation foundations | draft | todo | not_tested | V5-IDEA-19 | P1 |
| V5-IDEA-21 | Process Flow classic mode | draft | todo | not_tested | V5-IDEA-03,V5-IDEA-14 | P0 |
| V5-IDEA-22 | Process Flow automation mode | draft | todo | not_tested | V5-IDEA-21 | P0 |
| V5-IDEA-23 | Process Flow VSM mode | draft | todo | not_tested | V5-IDEA-21 | P0 |
| V5-IDEA-24 | Table v5 core model and starter views | draft | todo | not_tested | V5-IDEA-03,V5-IDEA-14 | P0 |
| V5-IDEA-25 | Table AI-generated structure and simplification flows | draft | todo | not_tested | V5-IDEA-24 | P0 |
| V5-IDEA-26 | Cross-system transforms (selection -> other system) | draft | todo | not_tested | V5-IDEA-17,V5-IDEA-19,V5-IDEA-21,V5-IDEA-24 | P1 |

### 3.5 WS-E Knowledge + Context (4)

| ID | Task | Spec | Impl | QA | Deps | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| V5-IDEA-27 | Knowledge card object family | draft | todo | not_tested | V5-IDEA-02,V5-IDEA-14 | P0 |
| V5-IDEA-28 | Context panel v5 (notes, evidence, backlinks, artifacts) | draft | todo | not_tested | V5-IDEA-27 | P0 |
| V5-IDEA-29 | Capture/import flows for notes and evidence | implemented | done | not_tested | V5-IDEA-27 | P1 |
| V5-IDEA-30 | Search and insert knowledge into workspace | implemented | done | not_tested | V5-IDEA-28 | P1 |

### 3.6 WS-F Artifact Linking + Retrieval (6)

| ID | Task | Spec | Impl | QA | Deps | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| V5-IDEA-31 | Unified artifact identity contract (`ArtifactRef`, `ArtifactIndex`, icon/accent parity) | implemented | done | not_tested | V5-IDEA-00,V5-IDEA-02 | P0 |
| V5-IDEA-32 | Workspace object attachment contract (node/sticky/step/row -> linked artifacts) | implemented | done | not_tested | V5-IDEA-31,V5-IDEA-14 | P0 |
| V5-IDEA-33 | Lightweight attach/open/preview UX | implemented | done | not_tested | V5-IDEA-32,V5-IDEA-28 | P0 |
| V5-IDEA-34 | Finance artifact parity in linking and previews | implemented | done | not_tested | V5-IDEA-31 | P0 |
| V5-IDEA-35 | Table row artifact autofill and refresh contract | implemented | done | not_tested | V5-IDEA-32,V5-IDEA-24 | P0 |
| V5-IDEA-36 | AI artifact retrieval and link proposal flows | implemented | done | not_tested | V5-IDEA-33,V5-IDEA-35 | P1 |

### 3.7 WS-G Conversion + Outputs (4)

| ID | Task | Spec | Impl | QA | Deps | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| V5-IDEA-37 | Convert whole idea to outputs | implemented | done | not_tested | V5-IDEA-13 | P0 |
| V5-IDEA-38 | Convert branch / cluster / flow segment / rows | implemented | done | not_tested | V5-IDEA-26 | P0 |
| V5-IDEA-39 | Traceability and LinkGraph for output conversions | implemented | done | not_tested | V5-IDEA-37,V5-IDEA-38 | P0 |
| V5-IDEA-40 | Report/deck export from workspace selections | implemented | done | not_tested | V5-IDEA-39 | P1 |

### 3.8 WS-H Visual Tech Sexy (7)

| ID | Task | Spec | Impl | QA | Deps | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| V5-IDEA-41 | Seed Surface visual language | implemented | done | not_tested | V5-IDEA-04 | P1 |
| V5-IDEA-42 | SuperCanvas background system | implemented | done | not_tested | V5-IDEA-12 | P1 |
| V5-IDEA-43 | Mind Map hierarchical color system | implemented | done | not_tested | V5-IDEA-17 | P0 |
| V5-IDEA-44 | Living edge and line behavior | implemented | done | not_tested | V5-IDEA-17,V5-IDEA-21 | P1 |
| V5-IDEA-45 | Zoom / focus / fit / restore interaction model | implemented | done | not_tested | V5-IDEA-16 | P0 |
| V5-IDEA-46 | Dark/light premium parity pass | implemented | done | not_tested | V5-IDEA-41,V5-IDEA-42,V5-IDEA-43 | P1 |
| V5-IDEA-47 | Motion and microinteraction polish | implemented | done | not_tested | V5-IDEA-44,V5-IDEA-45 | P2 |

### 3.9 WS-I QA + Ops (5)

| ID | Task | Spec | Impl | QA | Deps | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| V5-IDEA-48 | Telemetry model for starts, systems, AI, conversion | implemented | done | not_tested | V5-IDEA-08,V5-IDEA-37 | P1 |
| V5-IDEA-49 | Smoke script pack for V5 core flows | draft | todo | not_tested | V5-IDEA-04,V5-IDEA-08,V5-IDEA-17,V5-IDEA-21,V5-IDEA-24,V5-IDEA-33 | P0 |
| V5-IDEA-50 | UI/UX compliance and FROZEN_LAYOUTS audit | draft | todo | not_tested | V5-IDEA-12,V5-IDEA-41 | P0 |
| V5-IDEA-51 | Agent handoff pack and delivery notes | draft | todo | not_tested | V5-IDEA-00 | P1 |
| V5-IDEA-52 | Post-release adoption review and iteration backlog | draft | todo | not_tested | V5-IDEA-48 | P2 |

---

## 3.3) Wave 1 — fully locked tasks with DoD

These tasks should be completed first and are considered **no-stress start pack** tasks.

### V5-IDEA-00 — Align docs and source of truth

**SSOT:** `IDEA_WORKSPACE_V5_SSOT.md`  
**Goal:** make sure all relevant docs point to V5 as canonical for future implementation.

**DoD:**
- `MYWORK_MODULE_SPECIFICATION.md` points to V5 Ideas SSOT
- `IDEA_WORKSPACE_V3_SSOT.md` contains clear compatibility / superseded note
- `IDEA_WORKPLACE_VNEXT_IMPLEMENTATION_PLAN.md` contains clear superseded note
- no ambiguity about which document is canonical for implementation

**Acceptance / smoke:**
- an external agent opening docs sees V5 as the current source of truth within 2 minutes

### V5-IDEA-01 — Lock Seed Surface IA and startup logic

**Goal:** fully close all UX ambiguity around the first experience.

**DoD:**
- hero input, 3 primary starts, popular starts, structured brief are fully specified
- startup outcomes are explicit
- chat handoff expectations are explicit
- no unresolved product decision remains for first-entry UX

**Acceptance / smoke:**
- a different agent can implement Seed Surface without asking "what happens after click?"

### V5-IDEA-03 — Lock per-system tool contracts and scope cutlines

**Goal:** prevent scope creep and tool chaos.

**DoD:**
- each native system has dedicated tool groups
- each system has explicit "must-have" and explicit "not now"
- selection-aware actions are defined
- right panel behavior is clear

**Acceptance / smoke:**
- frontend agent can split implementation by system without product ambiguity

### V5-IDEA-04 — Build Seed Surface shell

**Goal:** introduce the new, premium start screen for Ideas.

**DoD:**
- seed shell exists in Ideas flow
- input, 3 starts, popular starts, advanced brief entry point are visible
- shell respects DBR77 and FROZEN_LAYOUTS
- dark/light both look premium

**Acceptance / smoke:**
- user can create an idea from the new screen without confusion

### V5-IDEA-08 — Implement chat-to-workspace handoff contract

**Goal:** make the persistent side chat a native entry path into Ideas.

**DoD:**
- chat can open or create idea workspace with seed
- handoff supports preferred initial system
- optional template and optional proposal can be passed
- handoff is recoverable and debuggable

**Acceptance / smoke:**
- user can start in chat and land in workspace with preserved intent

### V5-IDEA-10 — Evolve canonical workspace document schema

**Goal:** make the existing graph model able to support SuperCanvas and mixed object families.

**DoD:**
- schema extension is documented and implemented
- compatibility adapter exists
- no-data-loss rule is preserved
- all four systems can store their semantics in one shared document

**Acceptance / smoke:**
- one idea can contain mixed families without breaking existing save/load

---

## 3.4) Locked tasks — Artifact Linking foundation

These tasks are now specification-locked by:
- `docs/product/ARTIFACT_LINKING_V5_SSOT.md`
- `docs/product/IDEA_WORKSPACE_V5_SSOT.md`

### V5-IDEA-31 — Unified artifact identity contract

**Goal:** establish one platform-wide artifact identity system for linking, preview, and AI retrieval.

**DoD:**
- canonical `ArtifactRef` and `ArtifactIndex` are defined
- icon/accent parity maps to artifact identity rules
- the list of V5-supported artifact families is explicit
- the contract is reusable across modules, not only Ideas

**Acceptance / smoke:**
- an agent can implement artifact addressing without inventing new IDs or naming rules

### V5-IDEA-32 — Workspace object attachment contract

**Goal:** allow workspace objects to attach artifacts consistently and lightly.

**DoD:**
- `WorkspaceObjectRef` contract is defined
- supported attachable object types are explicit
- local attachment payload and LinkGraph persistence responsibilities are separated
- link roles are defined

**Acceptance / smoke:**
- a node, step, or row can be linked without ambiguity about how it is addressed or persisted

### V5-IDEA-33 — Lightweight attach/open/preview UX

**Goal:** make artifact linking feel like a subtle superpower, not a heavy workflow.

**DoD:**
- attach entry points are explicit
- preview contract is defined
- open behavior is defined
- no-clutter UX rules are explicit

**Acceptance / smoke:**
- a designer or frontend agent can implement linked-artifact UI without overloading workspace objects

### V5-IDEA-34 — Finance artifact parity in linking and previews

**Goal:** ensure finance artifacts participate in the same system as strategic and execution artifacts.

**DoD:**
- `financial_model`, `budget`, `valuation`, and `analysis` are first-class linkable artifacts
- preview expectations are clear
- high-value finance use cases are explicit

**Acceptance / smoke:**
- a table or map can link finance artifacts using the same contract as initiatives or tasks

### V5-IDEA-35 — Table row artifact autofill and refresh contract

**Goal:** turn linked rows into useful analysis surfaces instead of passive references.

**DoD:**
- autofill contract is defined
- source-aware rendering is defined
- refresh behavior is defined
- user trust rules are explicit

**Acceptance / smoke:**
- a frontend agent can build row autofill with preview and refresh without inventing product rules

### V5-IDEA-36 — AI artifact retrieval and link proposal flows

**Goal:** let AI retrieve and propose artifacts safely.

**DoD:**
- AI proposal shape is defined
- explainability is required
- attach and autofill still require acceptance
- examples of supported intents are listed

**Acceptance / smoke:**
- an AI agent can propose linked artifacts and mappings without silent mutations or ambiguous behavior

---

## 4) R0 cutline (launch baseline)

R0 = the smallest coherent implementation that makes V5 direction real without overloading scope.

**R0 tasks (must):**
- V5-IDEA-00
- V5-IDEA-01
- V5-IDEA-02
- V5-IDEA-03
- V5-IDEA-04
- V5-IDEA-05
- V5-IDEA-08
- V5-IDEA-09
- V5-IDEA-10
- V5-IDEA-11
- V5-IDEA-12
- V5-IDEA-13
- V5-IDEA-16
- V5-IDEA-17
- V5-IDEA-21
- V5-IDEA-24
- V5-IDEA-27
- V5-IDEA-28
- V5-IDEA-31
- V5-IDEA-32
- V5-IDEA-33
- V5-IDEA-34
- V5-IDEA-35
- V5-IDEA-37
- V5-IDEA-39
- V5-IDEA-43
- V5-IDEA-45
- V5-IDEA-49
- V5-IDEA-50

**R0 acceptance:**
- user can create idea from Seed Surface
- user can start from chat
- SuperCanvas exists in foundation form
- at least one meaningful object family from each native system works
- Idea Card exists
- knowledge cards / context are attached
- linked artifacts can be attached and opened without cluttering the workspace
- conversion to at least one output is traceable
- zoom / fit / focus work
- core visual direction is visible

---

## 5) Suggested execution order (waves)

### Wave 1 — No-stress foundations
- V5-IDEA-00
- V5-IDEA-01
- V5-IDEA-02
- V5-IDEA-03
- V5-IDEA-04
- V5-IDEA-05
- V5-IDEA-08
- V5-IDEA-10
- V5-IDEA-12

### Wave 2 — Core workspace and first value
- V5-IDEA-09
- V5-IDEA-11
- V5-IDEA-13
- V5-IDEA-14
- V5-IDEA-16
- V5-IDEA-17
- V5-IDEA-21
- V5-IDEA-24
- V5-IDEA-27
- V5-IDEA-28
- V5-IDEA-31
- V5-IDEA-32

### Wave 3 — Working system depth
- V5-IDEA-18
- V5-IDEA-19
- V5-IDEA-20
- V5-IDEA-22
- V5-IDEA-23
- V5-IDEA-25
- V5-IDEA-29
- V5-IDEA-30
- V5-IDEA-33
- V5-IDEA-34
- V5-IDEA-35
- V5-IDEA-36
- V5-IDEA-37
- V5-IDEA-38
- V5-IDEA-39

### Wave 4 — Visual differentiation and conversion excellence
- V5-IDEA-40
- V5-IDEA-41
- V5-IDEA-42
- V5-IDEA-43
- V5-IDEA-44
- V5-IDEA-45
- V5-IDEA-46
- V5-IDEA-47

### Wave 5 — QA, telemetry, and finishing
- V5-IDEA-48
- V5-IDEA-49
- V5-IDEA-50
- V5-IDEA-51
- V5-IDEA-52

---

## 5.1) Implementation mechanics — Artifact Linking rollout

This is the recommended no-stress implementation sequence for the linking system.

### Step 1 — Identity foundation

Tasks:
- V5-IDEA-31

Deliver:
- canonical artifact type map
- `ArtifactRef`
- `ArtifactIndex`
- icon/accent identity parity

Do not start UI attachment work before this step is closed.

### Step 2 — Workspace attachment plumbing

Tasks:
- V5-IDEA-32

Deliver:
- `WorkspaceObjectRef`
- object-level attachment payload
- LinkGraph persistence mapping
- attach/remove/update mechanics

This step makes linking technically possible.

### Step 3 — User-facing lightweight UX

Tasks:
- V5-IDEA-33

Deliver:
- attach artifact action
- preview behavior
- open artifact behavior
- compact object-level indicator

This step makes linking usable without adding AI yet.

### Step 4 — Finance parity

Tasks:
- V5-IDEA-34

Deliver:
- finance artifact adapters
- finance previews
- finance picker / resolver support

This step prevents strategy-finance separation from reappearing.

### Step 5 — Table autofill

Tasks:
- V5-IDEA-35

Deliver:
- row autofill preview
- refresh-from-artifact
- sourced field rendering

This is the first "magical" layer and should come only after the core linking contract is stable.

### Step 6 — AI linking

Tasks:
- V5-IDEA-36

Deliver:
- retrieval contract
- attach proposals
- autofill proposals
- explainability / confidence / accept-reject

AI linking is last on purpose. It depends on stable artifact identity and stable user-visible behavior.

### Engineering rule

Implementation order should be:
1. backend / contract
2. resolver / preview plumbing
3. object-level UI
4. finance adapters
5. table autofill
6. AI proposal flows

Do not invert this order.

---

## 6) QA and smoke plan

### 6.1 Core smoke scenarios

- Create new idea from hero input
- Create new idea from chat handoff
- Start with blank canvas
- Start with template
- Open advanced structured brief
- Open workspace and see pinned Idea Card
- Add mind map branch
- Add whiteboard notes
- Add process flow steps
- Add table block
- Keep all objects in one workspace
- Open context / insert knowledge
- Attach artifact to a node / step / row
- Open linked artifact preview from workspace object
- Navigate from workspace object to native artifact view
- Attach finance artifact and preview key metadata
- Autofill table row from linked artifact with preview
- Ask AI to propose changes
- Ask AI to propose artifact links
- Accept and reject AI proposals
- Convert output with traceability

### 6.2 Visual smoke scenarios

- Fit to content
- Focus selection
- Restore viewport on reopen
- Branch color inheritance
- Edge motion subtle and non-distracting
- Dark mode premium
- Light mode premium

### 6.3 QA gate

No task touching V5 core is considered complete unless:
- smoke passes for affected flows
- UI standards are checked
- no new source-of-truth ambiguity is introduced

---

## 7) PR checklist (Ideas V5)

Before merge:
- [ ] Task ID referenced in PR
- [ ] SSOT section referenced
- [ ] No FROZEN_LAYOUTS violation
- [ ] No extra right-side panel beyond `Tools | Context | AI Suggestions`
- [ ] AI still uses preview/apply
- [ ] Dark/light visually checked
- [ ] Smoke scenario executed
- [ ] Progress log updated

---

## 8) Old-to-new mapping (working materials -> V5)

The following are treated as predecessor materials:

- `docs/product/IDEA_WORKSPACE_V3_SSOT.md`
- `docs/product/IDEA_WORKPLACE_VNEXT_IMPLEMENTATION_PLAN.md`

Use them for historical context and implementation anchors only.
For new work:
- product truth = `IDEA_WORKSPACE_V5_SSOT.md`
- implementation truth = `IDEA_WORKSPACE_V5_IMPLEMENTATION_PROGRAM.md`

---

## 9) Task index (quick lookup)

| Area | Task IDs |
| --- | --- |
| Docs / source of truth | V5-IDEA-00 |
| Seed Surface | V5-IDEA-01, 04, 05, 06, 07 |
| Chat handoff | V5-IDEA-08, 09 |
| SuperCanvas core | V5-IDEA-02, 10, 11, 12, 13, 14, 15, 16 |
| Mind Map | V5-IDEA-17, 18, 43, 44 |
| Whiteboard | V5-IDEA-19, 20 |
| Process / Automation / VSM | V5-IDEA-21, 22, 23 |
| Table | V5-IDEA-24, 25 |
| Cross-system transforms | V5-IDEA-26 |
| Knowledge / Context | V5-IDEA-27, 28, 29, 30 |
| Artifact linking / retrieval | V5-IDEA-31, 32, 33, 34, 35, 36 |
| Outputs / conversion | V5-IDEA-37, 38, 39, 40 |
| Visual / motion / dark-light | V5-IDEA-41, 42, 43, 44, 45, 46, 47 |
| QA / ops / telemetry | V5-IDEA-48, 49, 50, 51, 52 |

---

## 10) Final operational note

The safest implementation sequence is:

1. lock docs and architecture
2. build Seed Surface and chat handoff
3. build SuperCanvas contract and shell
4. deepen systems one by one
5. only then spend heavily on polish

This preserves the no-stress rule:
- one canonical SSOT
- one canonical implementation ledger
- one clear wave order
- no parallel invention by multiple agents
