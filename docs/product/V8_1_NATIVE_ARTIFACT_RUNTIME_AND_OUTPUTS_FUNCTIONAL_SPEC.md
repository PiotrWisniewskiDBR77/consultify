# V8.1 Native Artifact Runtime And Outputs Functional Spec

> Status: Canonical v8.1  
> Owner: Product + Engineering  
> Scope: functional north star for how `consultify` should generate, store, review and reuse AI-created artifacts after the v8 closure wave

---

## 1. Why this document exists

`v8` brought strong documentation for:

- `Chat`
- `AI artifact runtime`
- `Reports`
- `Presentations`
- cross-module source traceability

What is still missing is one next-phase functional doctrine that closes the gap between:

- contextual chat generation,
- persistent output artifacts,
- a stable library where generated files always land,
- and personal operational work in `My Work`.

Without this layer, the product risks having:

- strong generators but weak everyday discoverability,
- artifacts scattered across module-specific screens,
- no one obvious home for generated work,
- and no simple mental model matching the Kimi-style user expectation.

---

## 2. Executive statement

`consultify` v8.1 should introduce one native artifact runtime where chat is the entry point, a persistent outputs library is the canonical home, and `My Work` is the user's operational filter over the same artifacts.

This is the most important rule in the whole document.

`the system should not treat generated documents, decks and sheets as temporary exports`

They should become first-class platform artifacts.

---

## 3. Core product doctrine

### 3.1 Chat is the primary creation surface

The main place where users ask for artifacts should be contextual chat:

- inside `Chat`
- inside notebook/chat side panels
- inside module-level AI kickoff flows

The user should be able to say:

- "prepare a board deck"
- "create a project brief"
- "build an Excel workbook from this analysis"

The system should interpret that request from context, not from a blank form.

### 3.2 Outputs Library is the canonical home

Generated artifacts must always land in one stable library surface.

This library should reuse the legacy shortcut / legacy documents surface that already exists in the product memory, but give it a new canonical meaning.

Canonical rule:

`every generated artifact must have one durable home in the Outputs Library`

### 3.3 My Work is not the source of truth

`My Work` should show:

- my drafts,
- my recent artifacts,
- artifacts waiting for my review,
- artifacts linked to my current work.

But `My Work` should not become the only storage or the canonical registry.

Canonical rule:

`Outputs Library stores the artifact; My Work helps the user work on it`

### 3.4 One registry, many runtimes

`v8.1` must not create a second parallel truth beside existing `Reports` and `Presentations`.

Canonical rule:

`there is one canonical artifact registry, while document/presentation/sheet runtimes remain format-specific engines below it`

That means:

- the shared artifact registry becomes the canonical index used by library and personal views,
- existing report and presentation runtimes remain valid format implementations,
- legacy module tables may continue to store format-native content and builder state,
- but artifacts shown in the new library must resolve to one shared artifact identity.

### 3.5 Visibility is scoped, not universal

`global discoverability` inside the library does not mean every user sees every artifact.

Canonical rule:

`artifacts are discoverable only inside the visibility scope granted to the current user`

Minimum visibility scopes:

- `private`
- `project`
- `organization`
- `review_shared`
- `demo`

---

## 4. What v8.1 is and is not

### 4.1 What it is

`v8.1` is:

- an integration closure layer after `v8`,
- a native artifact operating model,
- a cross-format runtime for `doc`, `slides`, and `sheet`,
- a product doctrine for contextual creation and durable reuse.

### 4.2 What it is not

`v8.1` is not:

- only a new export button,
- only a file repository,
- only a new `Docs` module,
- only a report/presentation improvement,
- or only a Kimi clone.

The point is not to mimic their stack.
The point is to match the right product behavior.

---

## 5. Canonical artifact family

Wave `v8.1` should treat three artifact classes as first-class:

- `Document`
- `Presentation`
- `Sheet`

### 5.1 Document

Best for:

- briefs,
- business documents,
- executive memos,
- structured reports,
- evidence-heavy reading artifacts.

### 5.2 Presentation

Best for:

- meeting delivery,
- board decks,
- workshops,
- steering updates,
- pitch and communication artifacts.

### 5.3 Sheet

Best for:

- structured analysis,
- workbooks with formulas,
- tabular operations,
- finance models,
- analytical exports that should remain live and editable.

---

## 6. Canonical surface model

The artifact system should work across five visible surfaces.

### 6.1 Surface A — Contextual Chat Entry

Purpose:

- ask for artifact creation in context,
- refine intent,
- review AI plan,
- accept generation.

Examples of source context:

- `Initiative`
- `Report`
- `Presentation`
- `Finance analysis`
- `Tool session`
- `Notebook`
- `Interview`
- `My Work`

### 6.2 Surface B — Outputs Library

Purpose:

- canonical home of generated artifacts,
- global discoverability,
- open/reopen/reuse/export/share.

The library should eventually support views such as:

- `All`
- `Mine`
- `Needs review`
- `Project Docs`
- `Recent`
- `Templates`

### 6.3 Surface C — My Work Outputs View

Purpose:

- personal cockpit,
- operational queue,
- drafts and approvals,
- "what needs my attention now".

### 6.4 Surface D — Object-linked Outputs

Every major object should show linked artifacts where relevant:

- initiative-related artifacts,
- report/deck linked outputs,
- project docs,
- finance-origin artifacts,
- note-origin artifacts.

### 6.5 Surface E — Artifact Workspace

Once opened, the artifact must support:

- preview,
- editing,
- review,
- versioning,
- export,
- linked source inspection.

---

## 7. Canonical lifecycle

The artifact lifecycle should be consistent across all three artifact classes.

Recommended lifecycle:

- `requested`
- `planning`
- `generating`
- `validating`
- `draft`
- `in_review`
- `approved`
- `exported`
- `archived`

### 7.1 Requested

The user asks for an artifact from chat or context.

### 7.2 Planning

AI proposes:

- artifact type,
- structure,
- likely source set,
- template or style recommendation,
- delivery mode.

### 7.3 Generating

The system builds the first artifact draft.

### 7.4 Validating

The system checks format-specific quality rules before durable save.

### 7.5 Draft

This is the first persistent artifact state.

### 7.6 In Review

Human review, comments, approval or send-back happens here.

### 7.7 Approved

The artifact is considered ready for operational use.

### 7.8 Exported

The artifact has been rendered to final delivery formats.

### 7.9 Archived

The artifact remains traceable but is not active work.

### 7.10 Review and approval relation to v8 governance

`Artifact review` must not become a second independent approval universe beside the existing `v8` execution and proposal spine.

Canonical rule:

`execution spine governs whether the system may create or materially refresh a durable artifact; artifact review governs whether a produced version is accepted for operational use or outward delivery`

This means:

- plan acceptance for chat-triggered durable generation follows governed runtime rules where required,
- artifact review happens after a draft version exists,
- review may approve, reject, or send back a version,
- but review cannot silently bypass execution approvals required by the broader `v8` governance model.

---

## 8. Generation doctrine

### 8.1 Context-first, not blank-first

The user should start from context whenever possible.

Canonical rule:

`the system should know what the artifact is about before asking for cosmetic settings`

### 8.2 Plan before generate

Before durable generation, the system should propose:

- artifact mode,
- structure,
- source grounding,
- destination library placement,
- validation expectations.

### 8.3 Validate before deliver

No artifact should move from `generating` to `draft` without basic runtime validation.

### 8.4 Review before irreversible publish

AI can propose and scaffold.
Human review remains the authority for durable acceptance and outward delivery.

---

## 9. Library doctrine

The Outputs Library should not behave like a dead archive.

It should behave like a working operating surface.

Every row/card should eventually expose:

- artifact title,
- artifact type,
- owner,
- status,
- source context,
- updated date,
- export availability,
- review state,
- where it belongs.

The library should support both:

- global discovery,
- and easy reopen from the old shortcut users already know.

Visibility rule:

- `All` means all artifacts visible to the current user inside their granted scope,
- `Mine` means artifacts owned by or assigned to the current user,
- `Project Docs` means artifacts visible through current project membership,
- review queues only show artifacts explicitly routed for that reviewer.

Canonical rule:

`legacy shortcut preserved, semantics upgraded`

---

## 10. Relationship to existing Reports & Presentations

`Reports` and `Presentations` already have a strong `v8` package.

`v8.1` should not replace that package.
It should wrap and extend it.

Required rule:

- existing report and presentation generators remain valid,
- but they become part of one broader artifact runtime,
- and a third pillar `Sheet` joins the family.

This means:

- the current `Reports & Presentations` hub becomes a core part of the new artifact system,
- not a dead-end side module.

---

## 11. Relationship to My Work

`My Work` should consume the artifact system in a personal way.

Recommended `My Work` views:

- `My Drafts`
- `Waiting For Review`
- `Recent Outputs`
- `Artifacts Linked To My Initiatives`

Canonical rule:

`My Work is a perspective over artifacts, not a second artifact registry`

---

## 12. Relationship to templates

Templates remain important, but templates are not the primary concept.

Primary concept:

- user intent,
- source context,
- artifact plan,
- generated draft.

Templates are:

- accelerators,
- defaults,
- quality rails.

They should live inside the artifact family, not beside it.

---

## 13. Source truth and traceability

Every artifact must preserve:

- source references,
- source object type,
- source object ids,
- context snapshot used at generation,
- run provenance,
- version lineage.

Canonical rule:

`artifacts communicate source truth; they do not replace source truth`

---

## 14. AI governance doctrine

Shared across all artifact classes:

- AI proposes,
- AI may scaffold,
- AI may refresh,
- AI may rewrite,
- AI may validate,
- user remains the durable decision-maker.

Hard rules:

- no fake citations,
- no silent source loss,
- no hidden status mutation,
- no export-without-trace.

---

## 15. Kimi-inspired lessons we should explicitly adopt

The product lessons to import are:

- chat-first creation,
- one obvious place where outputs land,
- artifact-native behavior instead of export-first behavior,
- visible planning stage,
- validation before delivery,
- strong reuse and reopenability.

The things we should not copy blindly:

- exact library choices,
- exact backend stack,
- exact naming or visual shell.

Imported rule:

`copy the operating model, not the implementation mythology`

---

## 16. Non-goals for v8.1

Wave `v8.1` should not try to solve everything at once.

Non-goals:

- full Google Docs / Slides parity,
- collaborative realtime editing across all artifact classes,
- full cloud publishing matrix on day one,
- advanced workflow approvals beyond essential review states,
- perfect sheet intelligence before the runtime foundations exist.

---

## 17. Functional rollout order

Recommended order:

1. unify artifact doctrine and library home
2. connect chat generation to durable artifact creation
3. keep `Reports` and `Presentations` as the first strong runtime
4. add `Sheet` as the third artifact class
5. expose `My Work` as personal view over the same artifacts
6. deepen validation, review and sharing

---

## 18. Acceptance criteria

`v8.1` is functionally complete when:

- users can create artifacts from contextual chat,
- every artifact lands in one canonical library,
- the old shortcut remains an easy access point,
- `My Work` shows a personal working view of the same artifacts,
- document, presentation and sheet share one lifecycle doctrine,
- artifacts preserve source and run traceability,
- generated work is reviewable before final delivery.

---

## 19. Related canonical docs

- `docs/product/AI_ARTIFACT_RUNTIME_ARCHITECTURE_V8.md`
- `docs/product/V8_1_IMPLEMENTATION_START_PACKET.md`
- `docs/product/REPORTS_AND_PRESENTATIONS_OUTPUT_OPERATING_MODEL_V8.md`
- `docs/product/REPORTS_AND_PRESENTATIONS_TEMPLATE_GENERATOR_AND_LIBRARY_RUNTIME_V8.md`
- `docs/product/PRESENTATIONS_AND_REPORTS_V3.md`
- `docs/product/TOOLS_CATALOG_V3.md`
- `docs/product/REPORTS_AND_PRESENTATIONS_V8_MASTER_SUMMARY.md`

## 20. Document runtime productization

The Document format runtime defined in this spec is productized as **Consultify Document Studio**. The productized doctrine, document type taxonomy, gap matrix and implementation plan live in:

- `docs/product/CONSULTIFY_DOCUMENT_STUDIO_V1_SSOT.md`
- `docs/product/CONSULTIFY_DOCUMENT_STUDIO_V1_TYPE_TAXONOMY.md`
- `docs/product/CONSULTIFY_DOCUMENT_STUDIO_V1_GAP_MATRIX.md`
- `docs/product/CONSULTIFY_DOCUMENT_STUDIO_V1_IMPLEMENTATION_PLAN.md`

Document Studio specializes the Document format runtime above this substrate. It does not replace anything in this spec.

