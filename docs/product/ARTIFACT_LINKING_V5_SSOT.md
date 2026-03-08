# Unified Artifact Linking V5 — SSOT

> **Status:** ACTIVE DRAFT (v5 planning SSOT)  
> **Owner:** Product / Platform / CTO  
> **Scope:** cross-platform artifact identity, indexing, linking, preview, retrieval, and workspace attachment behavior  
> **Purpose:** define one canonical system for how platform artifacts are addressed, linked, previewed, attached to workspace objects, and used by AI.

> **Important:** This document is a cross-platform SSOT.  
> It is not only for `Ideas`. `Idea Workspace V5` is the first place where this concept becomes fully visible and operational.

---

## 0) References (canonical)

Platform truth:
- `docs/product/LINK_GRAPH_V3.md`
- `docs/product/SOURCE_TRACEABILITY_SPEC.md`
- `docs/ui-standards/00-foundation/artifact-identity-map.md`
- `docs/MYWORK_MODULE_SPECIFICATION.md`

V5 execution:
- `docs/product/IDEA_WORKSPACE_V5_SSOT.md`
- `docs/product/IDEA_WORKSPACE_V5_IMPLEMENTATION_PROGRAM.md`

Related system documents:
- `docs/product/PRESENTATION_GENERATOR_V3.md`
- `docs/product/CONSULTING_TOOLS_V3.md`
- `docs/product/FINANCIAL_ANALYSIS_V3.md`

---

## 1) Product thesis

Consultify should not behave like a set of disconnected modules.

It should behave like one operating environment where all important work objects can:
- be found
- be opened
- be linked
- be previewed
- be used as context
- be reused by AI

This is the purpose of the unified artifact linking system.

### 1.1 Core product statement

Every important platform object must be addressable, linkable, and reusable across the product.

### 1.2 Why this matters

Without unified linking:
- ideas stay isolated from execution
- financial models stay isolated from strategy
- tables cannot become true comparison surfaces
- AI cannot work reliably with platform context
- users keep rebuilding context manually

With unified linking:
- one strategy map can point to many initiatives
- one comparison table can summarize many linked artifacts
- one process map can connect steps with real outputs, systems, or evidence
- one workspace becomes a living navigation layer for real work

---

## 2) Canonical rules

## 2.1 Rule: one artifact, one identity

Every important platform artifact must have:
- a stable technical identity
- a visible human-readable address
- a canonical icon and accent mapping
- a deep-link open behavior
- a preview behavior

## 2.2 Rule: LinkGraph owns relation truth

Linking truth must not live only in local UI state.

Platform relation truth belongs to:
- `LinkGraph`
- source traceability contracts where applicable
- permission-aware metadata lookup

Workspace-local state may cache or render links, but must not become the source of truth.

## 2.3 Rule: linking must stay lightweight

Unified linking is a product strength only if it feels effortless.

The system must avoid:
- relation forms
- heavy metadata dialogs
- cluttered nodes
- mandatory attachment steps

## 2.4 Rule: AI can propose, never silently attach

AI may suggest:
- which artifacts are relevant
- where to attach them
- how to autofill tables from them

But user acceptance is required before apply.

---

## 3) Canonical terminology

## 3.1 `Artifact`

An `Artifact` is any persistent platform object that can be:
- opened
- previewed
- linked
- referenced in context
- used by AI

### Examples

- `initiative`
- `task`
- `decision`
- `idea`
- `notebook_page`
- `tool_session`
- `assessment_report`
- `report`
- `presentation`
- `financial_model`
- `budget`
- `valuation`
- `analysis`

## 3.2 `ArtifactRef`

The canonical machine identity:

```ts
type ArtifactRef = {
  type: string;
  id: string;
};
```

This is the technical truth used in:
- LinkGraph
- deep links
- previews
- AI context packs
- source references

## 3.3 `ArtifactIndex`

The canonical human-readable address displayed in the UI.

Examples:
- `INIT-024`
- `TASK-118`
- `DEC-041`
- `IDEA-017`
- `REP-009`
- `DECK-021`
- `FIN-MOD-003`
- `BUD-012`
- `VAL-006`

### Canonical rule

`ArtifactIndex` is for people.  
`ArtifactRef` is for systems.

Both must exist.

## 3.4 `ArtifactLink`

An `ArtifactLink` is the product-level relation between:
- a workspace object or artifact container
- a target artifact

It is experienced by the user as:
- attached artifact
- linked artifact
- source artifact
- evidence artifact
- related artifact

## 3.5 `WorkspaceObjectRef`

For V5 workspace linking we need a stable object-level address:

```ts
type WorkspaceObjectRef = {
  workspaceType: 'idea_workspace';
  workspaceId: string;
  objectType: 'node' | 'sticky' | 'cluster' | 'frame' | 'step' | 'lane' | 'vsm_block' | 'table' | 'row' | 'knowledge_card' | 'idea_card';
  objectId: string;
};
```

This allows object-level linking without ambiguity.

---

## 4) Artifact identity contract

## 4.1 Minimum identity contract

Every artifact type participating in the system must expose:
- `artifactRef`
- `artifactIndex`
- `title`
- `artifactTypeLabel`
- `icon`
- `accent`
- `url`
- `permissions`
- `previewMeta`

## 4.2 Preview metadata contract

Preview metadata should be minimal but useful.

At minimum:
- status
- owner
- updatedAt

Optional by type:
- due date
- progress
- value
- spend
- ROI
- stage
- source count

## 4.3 Access rule

If a user does not have permission:
- relation may still exist
- preview must not leak restricted details
- UI may show `Restricted`

---

## 5) Supported artifact families

## 5.1 V5 core families

These must be supported first:
- `initiative`
- `task`
- `decision`
- `idea`
- `notebook_page`
- `tool_session`
- `assessment_report`
- `report`
- `presentation`

## 5.2 Finance parity families

These are mandatory in V5 because they unlock high-value reasoning:
- `financial_model`
- `budget`
- `valuation`
- `analysis`

## 5.3 Future-ready extension

The model must be open for:
- meeting artifacts
- execution plans
- KPI entities
- governance records
- imported external records

---

## 6) Link roles

## 6.1 Why roles are needed

Not every link means the same thing.

The UI should stay visually light, but the system must understand intent.

## 6.2 Canonical `linkRole`

Supported roles:
- `context`
- `source`
- `evidence`
- `related`
- `output`
- `depends_on`

### Guidance

- `context`: useful background
- `source`: direct input to current object or reasoning
- `evidence`: supporting proof or data
- `related`: relevant but secondary
- `output`: artifact created from this object
- `depends_on`: operational dependency link

## 6.3 Rule

The initial UI may render these roles subtly, but the data contract must preserve them from the start.

---

## 7) Link persistence model

## 7.1 Platform relation truth

Platform-level link truth belongs to LinkGraph.

Minimal relation shape:
- `source`
- `target`
- `relation`
- `context`

## 7.2 Workspace-local attachment state

Workspace objects may store lightweight attached-artifact render state:

```ts
type WorkspaceArtifactLink = {
  artifactRef: ArtifactRef;
  artifactIndex?: string;
  label?: string;
  linkRole?: 'context' | 'source' | 'evidence' | 'related' | 'output' | 'depends_on';
  pinned?: boolean;
};
```

### Rule

Local workspace state exists for:
- rendering
- fast interaction
- local grouping

But persisted relation truth must still flow through LinkGraph-compatible storage.

## 7.3 Object-level context payload

When persisting a relation from workspace object to artifact, context should include:
- `workspaceType`
- `workspaceId`
- `objectType`
- `objectId`
- `createdAt`
- `createdBy`
- optional `linkRole`

---

## 8) UX principles

## 8.1 Lightweight by default

The system must feel invisible until needed.

Default object behavior:
- object remains the main focus
- links appear only if present
- attachment UI stays secondary

## 8.2 Object-level affordance

If an object has linked artifacts:
- show a tiny indicator
- allow quick preview
- allow open in native module
- allow manage links without leaving the object

### Recommended display

- icon + count
- icon row
- small linked badge

Not recommended:
- large chips always visible
- card stack permanently attached to node

## 8.3 Core actions

Every linkable object should support:
- `Attach artifact`
- `Open linked artifacts`
- `Open artifact`
- `Remove link`

Optional:
- `Pin primary artifact`
- `Refresh linked data`

## 8.4 Supported entry paths

Users should be able to create links through:
- object context menu
- Context panel drag/drop
- search picker
- paste of deep link or artifact index
- AI proposal

---

## 9) Preview and navigation behavior

## 9.1 Preview contract

Clicking the link indicator should open lightweight preview UI, not hard navigation.

Preview must show:
- icon
- title
- `ArtifactIndex`
- type
- key metadata
- `Open artifact`

## 9.2 Open behavior

`Open artifact` must navigate to the artifact's native module and preserve route coherence.

## 9.3 Multi-link behavior

If many artifacts are attached:
- show compact stack or list
- support one-click open
- support filter by type if needed

---

## 10) Surface-specific behavior in Idea Workspace V5

## 10.1 Mind Map

Nodes may carry linked artifacts such as:
- initiative
- task
- decision
- notebook page
- finance model

Use cases:
- strategy tree with linked initiatives
- issue tree with linked evidence
- decision tree with linked decisions

## 10.2 Whiteboard

Stickies, clusters, and frames may carry linked artifacts such as:
- workshop outputs
- ideas
- notes
- follow-up tasks

Use cases:
- cluster -> linked initiative set
- sticky -> linked note or evidence

## 10.3 Process / System Flow

Steps, lanes, and VSM blocks may carry linked artifacts such as:
- systems
- initiatives
- procedures
- analyses
- cost models

Use cases:
- process step linked to an automation initiative
- VSM block linked to cost analysis
- lane linked to org unit artifact

## 10.4 Table

Rows are the most important artifact-linking surface after Mind Map.

Rows may attach:
- one primary artifact
- multiple supporting artifacts

Use cases:
- investment comparison table
- initiative portfolio summary
- scenario planning sheet

## 10.5 Idea Card

The pinned or expanded idea card should support:
- primary source artifacts
- evidence artifacts
- related outputs

---

## 11) Table autofill and data binding

## 11.1 Why this matters

This is where unified linking starts to feel magical.

The user should be able to build a table from linked artifacts instead of retyping data.

## 11.2 Core behavior

If a row is linked to an artifact, the system may offer:
- autofill selected fields
- refresh from artifact
- show sourced values
- show stale indicators if data changed

## 11.3 Examples of autofillable fields

- title
- owner
- status
- stage
- spend
- budget
- ROI
- payback
- timeline
- priority

## 11.4 Contract

Autofill must be:
- non-destructive
- previewable
- selective
- refreshable
- source-aware

## 11.5 User trust rule

Users must always understand:
- which fields came from which artifact
- when they were refreshed
- what will change before apply

---

## 12) AI retrieval and linking

## 12.1 AI capability

AI should be able to:
- retrieve relevant artifacts
- propose attachments
- propose artifact-based table construction
- propose autofill mappings
- explain why artifacts were selected

## 12.2 Example user intents

- "Attach all initiatives related to this branch"
- "Build a table from all investment ideas linked to this topic"
- "Find the finance models connected to this transformation stream"
- "Attach source evidence to these process steps"

## 12.3 AI output contract

AI proposal should include:
- proposed artifacts
- why they are relevant
- where they should be attached
- optional field mappings
- confidence

## 12.4 Governance

AI never silently attaches artifacts.

All attach and autofill actions are:
- previewed
- accepted or rejected
- auditable

---

## 13) Finance artifact parity

## 13.1 Why finance matters here

If financial artifacts are outside the linking system, the platform loses one of its strongest cross-module advantages.

## 13.2 Mandatory finance artifact support

V5 must support at least:
- `financial_model`
- `budget`
- `valuation`
- `analysis`

## 13.3 High-value use cases

- compare investment ideas in a linked table
- attach valuation to a strategic option
- link budget to an execution branch
- link analysis to a process bottleneck

---

## 14) Naming and UX language

## 14.1 Recommended product language

Use:
- `Artifacts`
- `Linked artifacts`
- `Attach artifact`
- `Open artifact`

Avoid as primary labels:
- `references`
- `resources`
- `objects`

## 14.2 Reason

`Artifact` is concrete, platform-wide, and extensible.

---

## 15) Implementation mechanics for V5

## 15.1 Rollout principle

Do not implement the whole vision at once.

Roll it out in layers so the system stays stable and light.

## 15.2 Phase A — Foundation

Must deliver:
- artifact identity contract
- index convention
- workspace object attachment contract
- one picker / resolver path
- one preview pattern

## 15.3 Phase B — Workspace adoption

Must deliver:
- Mind Map linking
- Table linking
- Process Flow linking
- Idea Card linking
- Context panel integration

## 15.4 Phase C — Finance and autofill

Must deliver:
- finance artifact parity
- row autofill
- refresh behavior
- source-aware row rendering

## 15.5 Phase D — AI linking

Must deliver:
- artifact retrieval
- attach proposals
- autofill proposals
- explainability

## 15.6 Phase E — Cross-platform expansion

Then expand to:
- more modules
- richer previews
- more link roles
- advanced relation semantics

---

## 16) Definition of Done

The concept is correctly implemented only when:
- artifacts have stable identity and human-readable index
- workspace objects can attach artifacts lightly
- preview and open behaviors are coherent
- LinkGraph remains relation truth
- finance artifacts work in the same system
- table autofill is source-aware and previewable
- AI can propose links safely

---

## 17) Explicit anti-patterns

Do not build this as:
- a CRM-like relation editor
- a giant metadata form
- a mandatory attachment workflow
- a second, separate graph beside LinkGraph
- a visual clutter layer on every node

The system must feel:
- quiet
- precise
- optional
- powerful
- native
