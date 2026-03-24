# Idea Workspace Integration And Promotion Runtime v8

> Status: Draft v8
> Owner: Product + Engineering
> Scope: define how the whole `Idea` module integrates with the rest of Consultify, including context handoff, artifact linking, promotion, traceability, and downstream runtime expectations

---

## 1. Why this document exists

The four native work systems are only half of the product truth.

The other half is:

`how work leaves the idea workspace without losing meaning`

This matters because the value of `Idea` is not only ideation.
The value is:

- preserving context
- structuring thinking
- promoting outputs into action
- and keeping traceability between source thinking and downstream artifacts

The critical refinement is:

`step 6 is not only about downstream promotion`

It must also define invisible, AI-driven integration between:

- the `AI agent`
- all four native canvases
- organization and tenant context
- notes and notebook-like artifacts
- external synced sources and the connector/search layer

This document closes step 6 of the `Idea v8` program.

---

## 2. Inherited truth

This document inherits:

- `IDEA_WORKSPACE_NAVIGATION_AND_CANVAS_ORCHESTRATION_V8.md`
- `IDEA_WORKSPACE_V5_SSOT.md`
- `ARTIFACT_LINKING_V5_SSOT.md`
- `PROCESS_MYWORK_TO_DELIVERABLES_V3.md`
- `AI_WORKSPACE_PROJECT_RUNTIME_ARCHITECTURE_V8.md`
- `AI_CONNECTORS_ENTERPRISE_SEARCH_ARCHITECTURE_V8.md`

Rule:

`Idea work may mature into many downstream artifacts, but it must remain traceable to one idea workspace and, where useful, to one specific workspace object inside it.`

Additional rule:

`the user should experience one intelligent workspace, while AI invisibly orchestrates cross-canvas context, organizational grounding, note linkage, and synced external knowledge in the background`

---

## 3. Core product statement

`Idea Workspace` is not an isolated creative environment.

It is the upstream thinking and structuring layer for real Consultify work.

That means it must support:

- inbound context from the rest of the product
- internal deepening across the four native work systems
- outbound promotion into execution and deliverables
- AI-agent orchestration across the full idea runtime
- organization-aware grounding
- note and knowledge continuity
- synced external-source grounding

Canonical statement:

`Idea is the AI-driven transformation layer where context enters as signals, artifacts, notes, synced sources, or questions and leaves as traceable decisions, initiatives, tasks, reports, presentations, and other execution-ready outputs without forcing the user to manage the integration machinery manually.`

---

## 4. Integration directions

The full integration model has four directions:

### 4.1 Inbound into Idea

Context may enter the workspace from:

- chat conversations
- radar prompts and learning signals
- notebook pages and notes
- interview outputs
- consulting tools and assessments
- imported files or structured data
- existing initiatives, decisions, tasks, reports, and presentations

### 4.2 Lateral inside Idea

Context may move between:

- mind map
- whiteboard
- process flow
- table
- idea card and context surfaces

### 4.3 Organization and knowledge grounding around Idea

The workspace must also stay continuously grounded in:

- organization context
- tenant policy and scope
- notebook and note artifacts
- synced external sources
- project and workspace identity

This grounding should remain mostly invisible to the user.
The user should not have to manually stitch these context layers together for routine work.

### 4.4 Outbound from Idea

Idea work may promote into:

- decision
- initiative
- task set
- report
- presentation
- notebook page
- result or KPI-ready structure
- downstream execution or workflow artifacts

---

## 5. Canonical objects

The integration runtime should revolve around these objects:

### 5.1 `IdeaWorkspaceRef`

```ts
type IdeaWorkspaceRef = {
  idea_id: string;
  workspace_id: string;
};
```

### 5.1a `IdeaIntegrationSnapshot`

```ts
type IdeaIntegrationSnapshot = {
  idea_workspace_ref: IdeaWorkspaceRef;
  active_canvas: 'mindmap' | 'whiteboard' | 'process_flow' | 'table';
  selected_object_refs: IdeaObjectRef[];
  org_context_ref?: string;
  project_context_ref?: string;
  note_refs?: ArtifactRef[];
  source_artifact_refs?: ArtifactRef[];
  synced_source_refs?: string[];
  ai_agent_session_ref?: string;
  scope_snapshot_ref?: string;
};
```

### 5.2 `IdeaObjectRef`

```ts
type IdeaObjectRef = {
  idea_id: string;
  object_type:
    | 'mindmap_node'
    | 'whiteboard_object'
    | 'process_step'
    | 'process_lane'
    | 'table'
    | 'table_record'
    | 'frame'
    | 'cluster'
    | 'idea_card';
  object_id: string;
};
```

### 5.3 `IdeaSourcePack`

```ts
type IdeaSourcePack = {
  source_artifacts: ArtifactRef[];
  supporting_links?: string[];
  import_origin?: 'chat' | 'radar' | 'notebook' | 'interview' | 'tool' | 'assessment' | 'manual' | 'external';
  synced_source_refs?: string[];
  org_context_ref?: string;
  rationale?: string;
};
```

### 5.4 `IdeaPromotionProposal`

```ts
type IdeaPromotionProposal = {
  proposal_id: string;
  source_workspace: IdeaWorkspaceRef;
  source_objects: IdeaObjectRef[];
  target_artifact_type:
    | 'decision'
    | 'initiative'
    | 'task_set'
    | 'report'
    | 'presentation'
    | 'notebook_page'
    | 'result_object';
  proposed_payload: Record<string, unknown>;
  rationale: string;
  risks?: string[];
};
```

### 5.5 `PromotedArtifactLink`

```ts
type PromotedArtifactLink = {
  source_workspace: IdeaWorkspaceRef;
  source_objects: IdeaObjectRef[];
  target_artifact: ArtifactRef;
  promotion_type: 'created_from' | 'derived_from' | 'linked_from';
};
```

---

## 6. Integration doctrine

## 6.1 Inbound doctrine

Work should enter `Idea` in context-rich ways, not only through empty starts.

Allowed inbound patterns:

- `chat -> create idea from conversation`
- `radar -> open signal as idea starter`
- `notebook -> turn note into idea workspace`
- `interview -> synthesize outputs into idea workspace`
- `tool or assessment -> open structured output as idea workspace`
- `existing artifact -> open as linked source inside current idea`
- `external synced source -> AI-grounded evidence or data enters the current idea`
- `organization knowledge -> AI proposes relevant internal context without forcing manual retrieval`

Rule:

Inbound entry should preserve enough source metadata that the user can still see:

- where the idea came from
- what artifacts fed it
- what was imported versus authored in the workspace
- what came from synced external systems
- what came from organization context or prior notes

## 6.2 Lateral doctrine

Context movement between canvases must preserve:

- same idea identity
- same traceability model
- linked artifacts
- AI context
- organization context
- note continuity
- synced-source grounding
- visible promotion history where relevant

Canvas switching must never behave like detached export/import.

Additional rule:

`all four canvases must participate in one AI-readable workspace state`

Meaning:

- the AI agent should understand the active canvas
- but also see the full idea context across the other canvases
- and use that invisibly to recommend switches, attach evidence, reuse notes, or propose structured promotion payloads

## 6.3 Invisible AI-driven integration doctrine

The default integration posture for `Idea` should be:

- `AI-driven`
- `context-aware`
- `mostly invisible`
- `user-controllable only when needed`

This means:

- users should not manually wire canvases together in normal flows
- users should not manually resolve whether AI can see notes, workspace state, or synced sources each time
- users should not manually move context between mind map, whiteboard, process flow, and table

Instead, the system should:

- maintain one evolving `IdeaIntegrationSnapshot`
- let the AI agent read cross-canvas state
- pull relevant org and synced-source context into proposal generation
- keep promotion payloads grounded in both local idea work and wider platform context

User-visible behavior should remain lightweight:

- optional source visibility
- optional attachment confirmation
- optional promotion review

Not required from the user:

- connector-level orchestration
- manual context packing
- manual cross-canvas synchronization
- repeated note reattachment

## 6.4 Outbound doctrine

Promotion from `Idea` must be:

- explicit
- proposal-governed where AI is involved
- traceable
- reversible at the linkage level

Meaning:

- the user may create downstream artifacts from idea work
- but the created artifact must retain its link to the idea workspace and, where useful, to the exact source object

---

## 7. Promotion targets and required behavior

### 7.1 Decision

Use when:

- the idea has reached a clear choice point

Required behavior:

- decision can cite workspace/object source
- user can open the source idea from the decision
- AI may propose the decision payload but cannot silently finalize it

### 7.2 Initiative

Use when:

- the idea is mature enough to become transformation work

Required behavior:

- initiative inherits source rationale, linked evidence, and scope hints
- initiative retains backlink to idea workspace and, where useful, source objects

### 7.3 Task set

Use when:

- part of the idea should move directly into actionable work

Required behavior:

- tasks may be created from branch, cluster, process step set, or table selection
- source links must survive

### 7.4 Report

Use when:

- the idea needs a narrative or analytical output for stakeholders

Required behavior:

- report creation flow can consume the idea workspace or selected objects as source context
- report keeps source traceability

### 7.5 Presentation

Use when:

- the idea must be presented, sold, or aligned around

Required behavior:

- deck creation may start from the whole workspace or a selected subset
- deck keeps source traceability and linked evidence

### 7.6 Notebook page

Use when:

- the work should become a durable knowledge artifact without yet becoming execution

Required behavior:

- notebook page preserves source references and can reopen the originating idea

### 7.7 Results or KPI-ready structures

Use when:

- process or table work becomes ready to feed results tracking or KPI structures

Required behavior:

- metrics and assumptions remain attributable to their idea origins

---

## 8. Artifact linking doctrine inside Idea

`Idea` should be one of the richest surfaces for artifact linking in the whole product.

Inside the module, users should be able to:

- attach existing artifacts to workspace objects
- preview them without losing focus
- use them as AI context
- promote new artifacts outward
- reopen source artifacts later
- let AI quietly reuse relevant notes, artifacts, and synced-source evidence where policy allows

Canonical rules:

1. linking truth must not live only in local UI state
2. AI may propose links, not silently attach them
3. object-level links are allowed where they materially improve traceability
4. restricted artifacts must obey permission-aware previews

---

## 9. AI runtime doctrine for Idea integration

AI inside `Idea` must understand:

- the active idea workspace
- the active canvas
- the active object selection
- the other canvases in the same workspace
- linked artifacts
- note context
- organization context
- synced-source context and freshness state
- possible promotion targets

AI may:

- orchestrate context across all four native canvases
- suggest source artifacts to attach
- suggest relevant notes or notebook pages
- suggest relevant organization context and prior work
- suggest relevant synced-source evidence
- suggest the best next canvas
- suggest promotions into downstream artifacts
- prepare structured payloads for decision, initiative, task, report, or presentation creation

AI may not:

- silently attach artifacts
- silently create downstream artifacts
- break traceability by generating detached outputs with no source links
- silently use blocked or stale synced sources without policy-aware handling

## 9.1 AI agent contract for Idea

Within `Idea`, the AI agent should behave as:

- workspace copilot
- cross-canvas memory and context broker
- note and artifact linker
- synced-source evidence synthesizer
- promotion planner

It should not behave as:

- a separate visible mini-product with its own detached state
- a chat-only helper unaware of canvas state
- a connector admin surface exposed to normal end users

---

## 10. Runtime handoff contract

The minimum handoff chain should be:

`source context -> idea workspace -> selected idea objects -> promotion proposal -> target artifact -> backlink and source trace`

The stronger AI-driven chain should be:

`org context + notes + synced sources + active canvas state -> idea integration snapshot -> AI reasoning/proposal -> optional user review -> apply/promotion -> trace ledger`

Every material outbound action should preserve:

- `idea_id`
- `workspace_id`
- `source_object_refs[]`
- `source_artifact_refs[]` where relevant
- `note_refs[]` where relevant
- `org_context_ref` where relevant
- `synced_source_refs[]` where relevant
- `promotion_reason`

This allows support, AI, and users to reconstruct:

- where the output came from
- what source object created it
- whether the promotion was manual or AI-assisted

---

## 11. What the module must integrate with

`Idea` should integrate most strongly with:

### 11.1 AI agent and chat runtime

- start an idea from conversation
- use the idea workspace as AI context
- promote AI conversation outcomes into structured idea work
- orchestrate context invisibly across all four canvases
- keep one AI-readable workspace state rather than per-canvas local context

### 11.2 Radar

- start ideas from signals
- preserve signal-to-idea traceability
- allow radar prompts to reopen the related idea

### 11.3 Notebook

- move between notes and idea workspace without duplication
- treat notebook as a durable knowledge companion to idea work
- let AI reuse note context without forcing repeated manual attachment

### 11.4 Interview

- convert interview results into maps, boards, flows, and tables
- preserve respondent/output traceability where appropriate

### 11.5 Tools and assessments

- use tool outputs as structured sources for idea work
- promote idea outputs back into tool-adjacent deliverables if useful

### 11.6 Organization context

- use tenant, project, role, and organizational memory context to ground idea work
- let AI read relevant organizational context invisibly where policy allows
- prevent idea work from becoming detached from real organization scope and priorities

### 11.7 External synced sources

- use connector-backed sources as evidence and structure input for idea work
- let AI pull relevant synced-source context without forcing users into connector management flows
- preserve freshness, provenance, and permission awareness

### 11.8 Initiatives and execution

- turn mature idea work into initiatives and task sets
- keep initiative and execution artifacts linked back to the originating idea

### 11.9 Results

- allow metrics or process/table outputs from idea work to feed result structures with retained traceability

### 11.10 Reports and presentations

- use idea work as one of the strongest source surfaces for narrative and deck generation

---

## 12. Remaining implementation-facing blockers

Even after this document, the biggest remaining blockers are still:

1. one consistent promotion UX across all four native work systems
2. one stable object-ref model across all canvas object types
3. one invisible AI-driven integration layer that stays powerful without feeling heavy
4. one permission-aware artifact preview and backlink behavior
5. one org-context and synced-source grounding model reused by all canvases
6. one runtime trace model reused by AI, support, and downstream modules

These are no longer conceptual gaps.
They are implementation and integration hardening gaps.

---

## 13. Acceptance criteria

This document is satisfied only when:

- `Idea` is clearly defined as an upstream transformation layer for downstream work
- inbound, lateral, and outbound integration directions are explicit
- AI-agent orchestration across the whole module is explicit
- all-canvas integration is explicit
- organization context, notes, and synced external sources are explicit parts of step 6
- promotion targets are explicit
- traceability rules are explicit
- AI integration rules are explicit
- the module no longer depends on vague assumptions about how outputs leave the workspace

---

## 14. Related canonical docs

- `IDEA_V8_READINESS_AUDIT.md`
- `IDEA_WORKSPACE_NAVIGATION_AND_CANVAS_ORCHESTRATION_V8.md`
- `IDEA_WORKSPACE_V5_SSOT.md`
- `ARTIFACT_LINKING_V5_SSOT.md`
- `PROCESS_MYWORK_TO_DELIVERABLES_V3.md`
- `AI_WORKSPACE_PROJECT_RUNTIME_ARCHITECTURE_V8.md`
