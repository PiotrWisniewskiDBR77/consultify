# Notatka v8 Platform Context And Integration

> Status: Draft v8
> Owner: Product + Engineering
> Scope: zdefiniowac, jak `Notebook` dziala w pelnym kontekscie wszystkich elementow aplikacji `consultify`, tak aby notatka nie byla izolowanym edytorem, tylko AI-native knowledge spine dla pracy uzytkownika, organizacji i calego systemu

---

## 1. Why this document exists

Dotychczasowy pakiet `Notatka v8` dobrze opisywal:

- benchmark,
- model notatki,
- workflow,
- AI governance,
- gapi i implementation plan.

Brakowalo jednak jednego dokumentu, ktory odpowiada na pytanie:

`jak notatka pracuje w pelnym kontekscie calego Consultify`

To jest krytyczne, bo user nie mysli:

`teraz jestem w module notebook, wiec korzystam z wiedzy`

User mysli:

`rozmawiam, analizuje, prowadze interview, buduje idea, pisze raport, pracuje nad initiative i potrzebuje, aby wiedza byla przy mnie przez caly ten czas`

---

## 2. Inherited truth

This document inherits:

- `NOTATKA_V8_SSOT.md`
- `NOTATKA_V8_WORKFLOW_MODEL.md`
- `NOTATKA_V8_AI_GOVERNANCE.md`
- `NOTEBOOK_V3.md`
- `LINK_GRAPH_V3.md`
- `ARTIFACT_LINKING_V5_SSOT.md`
- `AI_WORKSPACE_PROJECT_RUNTIME_ARCHITECTURE_V8.md`
- `AI_CONNECTORS_ENTERPRISE_SEARCH_ARCHITECTURE_V8.md`
- `IDEA_WORKSPACE_INTEGRATION_AND_PROMOTION_RUNTIME_V8.md`

Rule:

`notebook knowledge must be visible as one continuous knowledge layer across the product, while the integration machinery stays mostly invisible to the user`

Additional rule:

`AI may orchestrate context, recall, linking, dedupe and promotion, but all durable state changes still follow propose/review/accept and traceability rules`

---

## 3. Core product statement

`Notebook` is the durable knowledge spine of `consultify`.

It receives:

- raw signals
- captured evidence
- meeting and research notes
- AI outputs
- linked artifacts
- synced external knowledge

It returns:

- structured recall
- linked context
- task and decision candidates
- initiative seeds
- report and presentation source material
- reusable knowledge for future work

Canonical statement:

`Notebook v8` is the AI-driven knowledge layer that continuously captures, structures, recalls and promotes note-based context across the full Consultify runtime without forcing the user to manage the integration model manually.

---

## 4. Integration directions

The full model has four directions:

### 4.1 Inbound into Notebook

Knowledge may enter `Notebook` from:

- chat conversations and AI sessions
- radar insights and learning prompts
- idea workspace and all four idea canvases
- interview outputs and guided sessions
- consulting tools and assessments
- tasks, decisions, initiatives and execution work
- reports, presentations and deliverables
- uploads, email, web capture and API import
- synced external sources through connector/search runtime

### 4.2 Lateral around Notebook

Knowledge may move between:

- notebook page and notebook page
- notebook and linked artifacts
- notebook and AI context packs
- notebook and idea surfaces
- notebook and knowledge / help surfaces

### 4.3 Outbound from Notebook

Notebook may promote or contribute to:

- task
- decision
- initiative
- report
- presentation
- assessment
- client brief
- knowledge article
- AI context pack for later work

### 4.4 Invisible AI-driven orchestration

AI should keep notebook grounded in:

- current user intent
- current workspace or project context
- organization and tenant scope
- linked downstream artifacts
- synced external evidence

This grounding should remain mostly invisible to the user.

---

## 5. Canonical objects

### 5.1 `NotebookContextSnapshot`

A runtime snapshot used by AI and retrieval layers.

It should contain:

- `activeNoteIds`
- `linkedArtifactRefs`
- `projectId`
- `initiativeId`
- `ideaWorkspaceRef`
- `interviewSessionRef`
- `chatThreadRef`
- `organizationContextRef`
- `sourcePackRefs`
- `retrievalScope`

### 5.2 `NotebookSourcePack`

Represents source context entering or surrounding the note.

It should contain:

- `sourceType`
- `sourceRef`
- `sourceTitle`
- `captureSource`
- `provenance`
- `freshness`
- `permissionScope`

### 5.3 `NotebookPromotionProposal`

Represents AI or user-initiated conversion from note to another artifact.

It should contain:

- `targetArtifactType`
- `sourceNoteIds`
- `readinessReason`
- `outlineProposal`
- `traceabilityPlan`
- `resolution`

### 5.4 `NotebookEvidenceRef`

Represents evidence linked into a note from synced or imported sources.

It should contain:

- `externalObjectId`
- `connectorRef`
- `sourceUri`
- `citationSnippet`
- `freshnessStatus`
- `aclScope`

---

## 6. Notebook vs other note-like surfaces

The system must not confuse all "note-like" UI into one domain object.

### 6.1 `Notebook note`

Use when:

- the knowledge should persist
- the note should be retrievable later
- the content may mature into action or output
- the note should link to multiple artifacts or contexts

### 6.2 `Idea notes`

Use when:

- the note belongs to a specific idea node, branch or canvas object
- it is subordinate to the idea workspace grammar

Rule:

- idea notes may promote into notebook notes
- they are not the same thing by default

### 6.3 `Interview notes`

Use when:

- the note belongs to interview runtime, question flow or session evidence

Rule:

- interview evidence may produce notebook notes
- interview-local note fields do not replace the notebook as durable knowledge layer

### 6.4 `Comments`

Comments are:

- review signals
- collaboration annotations
- governance trace

They are not notebook notes.

### 6.5 `Knowledge article`

A knowledge article is:

- more stable
- more curated
- less personal and less in-flight

Rule:

- notebook notes may mature into knowledge articles
- notebook notes are still the primary in-work knowledge surface

---

## 7. Full-app inbound integration

### 7.1 Chat and AI agent

Notebook must support:

- create note from chat turn
- save AI result as note draft
- attach note as live context to a conversation
- AI recall of relevant notes during chat
- propose note growth, merge or follow-up without silent writes

### 7.2 Radar

Radar must support:

- create note from signal
- create research note from trend
- attach radar source context and why-it-matters metadata
- recall prior notes when similar radar signals return

### 7.3 Idea workspace

Idea and Notebook must support:

- create note from mind map branch
- create note from whiteboard synthesis
- create note from process-flow observation
- create note from table insight
- promote notebook note into idea workspace where structured thinking should continue

### 7.4 Interview

Interview must support:

- convert interview findings into notebook notes
- create structured research and observation notes from sessions
- preserve traceability from notebook back to interview source

### 7.5 Tasks, decisions and initiatives

Execution surfaces must support:

- attach note as working context
- create note from task or initiative reflection
- open all notes used by a task, decision or initiative
- AI recall of notes as support context during execution

### 7.6 Reports, presentations and assessments

Output surfaces must support:

- create deliverable outline from note
- cite notebook notes as source
- show used-in relationships back to output artifacts

### 7.7 External synced sources

Connector and search runtime must support:

- import source into notebook as captured evidence
- preserve provenance and ACL boundaries
- show freshness and source quality
- prevent notebook from becoming an untraceable dump of copied external text

---

## 8. Retrieval and recall across the app

Notebook knowledge must return in other modules through:

- explicit search
- semantic recall
- related-note recommendations
- source and used-in backlinks
- AI context suggestions
- module-aware context panels

Rules:

- every recall should expose enough explanation to be trusted
- citations or snippets should appear where retrieval influences decisions
- retrieval must remain permission-safe and tenant-safe

---

## 9. AI operating model for Notebook in full context

AI may:

- classify note type
- suggest metadata
- propose links and missing context
- suggest merges or dedupe between notes
- synthesize multiple notes
- propose conversion into downstream artifacts
- surface notes in other modules when context is relevant

AI may not:

- silently rewrite durable note content
- silently create downstream objects
- pull notebook context across org boundaries
- hide provenance of recalled knowledge

Canonical operating loop:

`capture or observe -> enrich -> propose links or synthesis -> review -> accept or reject -> preserve traceability`

---

## 10. What full-context completeness means

`Notebook v8` is complete in platform context only if:

- notebook can receive context from the major work surfaces of the app
- notebook can return context into those surfaces in a trusted way
- notebook remains the durable note layer while lighter module-local notes stay local
- external synced knowledge enters through provenance-safe evidence objects
- AI orchestration remains invisible in mechanics, but explicit in proposals and audit

---

## 11. Acceptance criteria for this package

This document is doing its job if the product truth is now clear:

- notebook is not an isolated module
- notebook is not the same as comments or local note fields
- notebook participates in idea, interview, execution, reporting and AI runtime
- synced external sources may enrich notes without breaking trust
- user experiences one knowledge layer across the application

---

## 12. Related canonical docs

- `NOTATKA_V8_READINESS_AUDIT.md`
- `NOTATKA_V8_SSOT.md`
- `NOTATKA_V8_WORKFLOW_MODEL.md`
- `NOTATKA_V8_AI_GOVERNANCE.md`
- `NOTEBOOK_V3.md`
- `LINK_GRAPH_V3.md`
- `AI_CONNECTORS_ENTERPRISE_SEARCH_ARCHITECTURE_V8.md`
- `IDEA_WORKSPACE_INTEGRATION_AND_PROMOTION_RUNTIME_V8.md`
