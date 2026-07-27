> ⚠️ **DOKUMENT UNIEWAŻNIONY 2026-07-27** — powód: model „Raporty i Prezentacje = dwa osobne
> produkty" jest sprzeczny z jednym modułem Materiały i decyzją Piotra 27.07 „raport = dokument
> Word" · zastąpiony przez: `docs/product/MATERIALS_TARGET_STATE_AND_TEMPLATE_CANON_2026-07-24.md`.

# Reports And Presentations Output Operating Model v8

> Status: Draft v8
> Owner: Product + Engineering
> Scope: canonical operating model for how `consultify` should use `Report` and `Presentation` as two related but distinct output products

---

## 1. Why this document exists

`consultify` already has both `Reports` and `Presentations`.

What is still missing is one clear rulebook for:

- when to use which output
- how both should coexist
- how they should share AI, traceability and delivery semantics

Without this, the system risks duplicating effort and confusing users.

---

## 2. Core statement

`Reports` and `Presentations` should operate as one output family with two primary delivery modes.

Canonical rule:

`the system should choose the output form based on communication intent, reading context and delivery mode, not on which generator the user happened to open first`

Additional rule:

`report and presentation remain separate artifacts, but they share source truth, AI doctrine and output governance`

---

## 3. The two primary output modes

### 3.1 `Report`

Best when:

- the artifact must be read asynchronously
- the reader needs logic, justification and detail
- the output should stand on its own without a presenter
- traceability and evidence density matter more than visual rhythm

### 3.2 `Presentation`

Best when:

- the artifact is meant to be presented
- the story must unfold slide by slide
- live communication matters
- timing, pacing and visual signal matter more than document density

---

## 4. Canonical output choice doctrine

The system should support three primary output choices:

- `report-first`
- `presentation-first`
- `paired-output`

### 4.1 Report-first

Use when:

- the main artifact is a management or evidence document
- the presentation may be derived later

Examples:

- steering committee report
- portfolio review
- due-diligence or diagnostic report
- finance review pack

### 4.2 Presentation-first

Use when:

- the main artifact is meant for meeting delivery
- the report is optional or secondary

Examples:

- workshop deck
- board presentation
- initiative pitch
- sales or partner briefing

### 4.3 Paired-output

Use when:

- both reading pack and deck are expected
- one artifact should support the other

Examples:

- board pack + board deck
- initiative review report + steering deck
- finance analysis pack + executive summary deck

#### Canonical paired-output template families

> V8 Decision W6-3 applied — 2026-03-23

Three canonical paired-output template families are defined:

- `Executive Steering Pack` — executive steering report + executive steering deck
- `Transformation Status Pack` — transformation status report + transformation status deck
- `Diagnostic / Assessment Pack` — diagnostic/assessment report + diagnostic/assessment deck

Each family supports: report form, presentation form, and governed mapping between them. Detailed template definitions live in `REPORTS_AND_PRESENTATIONS_TEMPLATE_GENERATOR_AND_LIBRARY_RUNTIME_V8.md` §6.5.

---

## 5. Output choice engine

The product should eventually make an intelligent recommendation between:

- `report`
- `presentation`
- `both`

The recommendation should consider:

- audience
- goal
- communication register
- density needs
- delivery mode
- whether live presenting is expected
- whether evidence-heavy reading is required

AI may propose the output mode.
The user remains the decider.

---

## 6. Shared taxonomy across both outputs

The two output products should share one controlled vocabulary for:

- `audience`
- `goal`
- `communicationRegister`
- `language`
- `confidentiality`
- `deliveryMode`
- `sourceRefs`
- `contextPackSnapshot`
- `reviewState`
- `qualityState`

This prevents report and deck systems from drifting into separate worlds.

---

## 7. Shared AI doctrine

Both output systems should follow the same AI governance pattern:

`AI propose -> user review -> accept/reject/refine -> execution`

Shared AI rules:

- no silent edits
- no fake evidence
- no hidden traceability loss
- no delivery-state mutation without explicit user action

Shared AI action families:

- plan
- generate
- rewrite
- condense
- deepen
- refresh
- restyle
- summarize
- prepare for delivery

Output-specific AI actions may differ, but the governance model should be the same.

### 7.1 Prompt OS preset boundary

> V8 Decision W6-2 applied — 2026-03-23

Reports and presentations require **separate Prompt OS presets** with **independent eval gates**.

- `report_builder` preset — governs report generation, evidence-density requirements, section-level refresh, and structured output contracts.
- `presentation_builder` preset — governs presentation generation, visual-rhythm requirements, slide-level mutations, and speaker-note generation.

Both presets may share generator/runtime substrate assets, but must have:

- independent preset definitions
- independent eval gates and golden sets
- independent quality thresholds tuned to their respective output constraints

Reason: different quality targets, format constraints, and publish/review semantics.

Canonical rule:

`shared substrate, separate presets`

---

## 8. Shared source and traceability doctrine

Both outputs should preserve:

- source artifact references
- context-pack snapshot
- section or slide grounding where relevant
- evidence-aware refresh status

Canonical rule:

`promotion or conversion between outputs must not discard source lineage`

---

## 9. Shared delivery doctrine

Both outputs should support delivery as a first-class concern.

Shared delivery vocabulary should include:

- `draft`
- `generated`
- `editing`
- `in_review`
- `ready`
- `shared`
- `archived`

Shared delivery actions should include:

- internal review share
- export projection
- external controlled share where allowed
- audit of distribution history

---

## 10. Shared quality doctrine

The output family should define:

- common quality expectations
- output-specific quality expectations

### 10.1 Common expectations

- source traceability
- AI governance
- brand compliance
- audience fit
- communication register fit
- delivery readiness

### 10.2 Report-specific expectations

- evidence density
- logic coverage
- section completeness
- claim and numeric consistency

### 10.3 Presentation-specific expectations

- visual rhythm
- slide quality
- story progression
- presenter support

---

## 11. Platform entrypoint doctrine

Both outputs should be creatable from:

- `Finance`
- `Results`
- `Initiatives`
- `Execution`
- `Tools`
- `Interview`
- `Notes`
- `Idea`

But the output recommendation should differ by context.

Examples:

- `Finance` may often produce report-first or paired-output
- `Results` may produce report-first for review packs and deck-first for executive briefings
- `Initiatives` may produce deck-first for steering and report-first for detailed governance

---

## 12. Promotion doctrine

The output family must support:

- report promoted into presentation
- presentation promoted into report
- paired-output generated from the same source pack

Promotion should preserve:

- title and objective continuity
- source refs
- context-pack lineage
- audience and register intent
- brand and confidentiality defaults

Promotion should adapt:

- density
- narrative shape
- section vs slide structure
- delivery expectations

---

## 13. Library and workspace doctrine

The library model should help the user understand:

- what is a `Report`
- what is a `Presentation`
- what belongs together as a paired output
- what came from the same source pack or project context

The system should support:

- filtering by output type
- viewing related outputs
- seeing conversion lineage
- keeping shared artifacts close without merging them

---

## 14. Why this is stronger than analog apps

Most analogous apps are strong in only one slice:

- `Gamma` in AI deck generation
- `Beautiful.ai` in slide polish
- `Pitch` in team deck delivery

`consultify` can be stronger if it makes:

- document output
- deck output
- source grounding
- AI governance
- cross-module artifact lineage

work as one coherent system.

---

## 15. Acceptance criteria

The operating model is strong when:

- the user can understand which output form to use
- report and deck share the same source and governance layer
- paired-output is a first-class scenario
- conversion does not destroy context or quality
- both outputs feel related, not duplicated

---

## 16. Related canonical docs

- `REPORTS_V8_SSOT.md`
- `PREZENTACJE_V8_SSOT.md`
- `REPORT_TO_PRESENTATION_PROMOTION_AND_CONVERSION_RUNTIME_V8.md`
- `REPORTS_AND_PRESENTATIONS_FUNCTIONAL_COMPLETENESS_AND_GAP_MATRIX_V8.md`
