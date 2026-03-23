# Reports And Presentations Template Generator And Library Runtime v8

> Status: Draft v8
> Owner: Product + Engineering
> Scope: canonical runtime for template generation, template library and template governance for `Reports` and `Presentations`

---

## 1. Why this document exists

`Reports` and `Presentations` already think in terms of templates.

But template support is still uneven:

- `Presentations` already have visible gallery and clone semantics
- `Reports` have canonical template intent and report-type canon
- the shared output family still lacks one closed `template generator runtime`

Without this layer, the system has:

- templates as metadata, not as a true operating system
- inconsistent authoring between reports and decks
- weak `save as template` and auto-selection semantics

This document closes that gap.

---

## 2. Executive verdict

Current state:

- `Presentations template library`: `PARTIAL-STRONG`
- `Reports template library`: `PARTIAL-WEAK`
- `shared template generator runtime`: `MISSING`

Most important conclusion:

`consultify` does not yet have a complete template generator for reports and presentations as one governed output system`

What exists today is valuable, but still fragmented:

- report canonical templates exist conceptually
- presentation templates exist as a real gallery surface
- shared generator semantics, template authoring lifecycle and output-family template inheritance are still underdefined

---

## 3. Inherited truth

This document inherits:

- `PRESENTATIONS_AND_REPORTS_V3.md`
- `REPORTING_CANONICAL_TEMPLATES.md`
- `REPORTS_V8_SSOT.md`
- `PREZENTACJE_V8_SSOT.md`
- `REPORTS_AND_PRESENTATIONS_OUTPUT_OPERATING_MODEL_V8.md`
- `REPORTS_AND_PRESENTATIONS_FUNCTIONAL_COMPLETENESS_AND_GAP_MATRIX_V8.md`
- `REPORTS_AND_PRESENTATIONS_LLM_ROUTING_AND_MODEL_POLICY_V8.md`

Rule:

`template runtime is part of the output family operating model, not a side utility screen`

---

## 4. What a complete template generator must mean

A complete `template generator` is not only:

- a list of templates
- a hardcoded report type
- a clone button

It must support the full chain:

`template family -> template selection or recommendation -> scaffold generation -> source-aware adaptation -> generated artifact -> save as template -> governed reuse`

Canonical rule:

`a template is a reusable output blueprint with structure, source expectations, audience defaults, quality rules and generation hints`

---

## 5. Current reality and main gap

### 5.1 What is already strong

Strong today:

- `Reports` already define first-class `ReportTemplate`
- `Reporting` already has canonical report families `R1-R4`
- `Presentations` already define a meaningful template contract
- `DeckTemplateGallery` already supports library browsing and cloning
- the unified hub already exposes a `Templates` tab

### 5.2 What is still missing

Main missing areas:

- no single shared runtime for report and presentation templates
- no full `save output as template` doctrine
- no template family model for paired-output scenarios
- no template recommendation engine based on source context and audience
- no shared authoring lifecycle for templates
- no first-class template QA and template trust semantics

### 5.3 As-is product reality

Important product truth:

- `Presentations` already behave like a partial template product
- `Reports` still behave more like report-type-driven generation than a mature template platform

Critical runtime signal:

`report template runtime is not yet closed enough to be treated as complete`

---

## 6. Canonical template object model

### 6.1 Shared `OutputTemplate`

The output family should converge on a shared template vocabulary.

It should include:

- `templateId`
- `outputType`
- `templateFamily`
- `name`
- `description`
- `scope`
- `audienceDefaults`
- `goalDefaults`
- `communicationRegisterDefaults`
- `brandDefaults`
- `sourceExpectations`
- `structureBlueprint`
- `qualityRules`
- `generationHints`
- `sampleContentPolicy`
- `status`
- `isSystem`
- `clonedFromTemplateId`

### 6.2 `ReportTemplate`

Must additionally carry:

- `reportType`
- `sectionBlueprint`
- `sectionRequiredness`
- `ragLogicHints`
- `defaultExportModes`
- `refreshPolicy`

### 6.3 `PresentationTemplate`

Must additionally carry:

- `deckType`
- `outlineBlueprint`
- `mustHaveIntents`
- `visualHints`
- `slideCountRange`
- `speakerNotesPolicy`

### 6.4 `PairedOutputTemplateFamily`

The system should support one higher-level family object for paired-output scenarios.

It should include:

- `familyId`
- `familyName`
- `reportTemplateId`
- `presentationTemplateId`
- `sharedSourceExpectations`
- `sharedAudienceIntent`
- `promotionHints`

### 6.5 Canonical paired-output template families

> V8 Decision W6-3 applied — 2026-03-23

Wave 6 defines exactly three canonical paired-output template families:

| Family | Report form | Presentation form | Governed mapping |
|---|---|---|---|
| `Executive Steering Pack` | Executive steering report | Executive steering deck | Shared source expectations, audience intent, and promotion hints between report and deck |
| `Transformation Status Pack` | Transformation status report | Transformation status deck | Shared initiative/program context, KPI snapshot, and deviation summary |
| `Diagnostic / Assessment Pack` | Diagnostic or assessment report | Diagnostic or assessment deck | Shared assessment framework, findings structure, and recommendation mapping |

Each family supports: report form, presentation form, and governed mapping between them.

---

## 7. Template scopes and ownership

### 7.1 System templates

Owned by:

- platform
- SuperAdmin

Purpose:

- canonical best-practice starter templates
- benchmark-grade starting points

### 7.2 Organization templates

Owned by:

- organization admin
- authorized domain leads

Purpose:

- org-specific branding
- local board pack conventions
- local report and deck patterns

### 7.3 Personal drafts

Allowed as:

- working template drafts
- not yet globally reusable templates

Rule:

`personal drafts should not masquerade as trusted organizational templates`

---

## 8. Canonical template flows

### 8.1 Template-first generation

Flow:

`choose template -> inspect fit -> adapt source context -> review outline -> generate artifact`

This should be the primary path for:

- recurring management outputs
- board and steering materials
- branded client deliverables

### 8.2 Source-first recommendation

Flow:

`choose source pack -> AI recommends template -> user accepts/refines -> review outline -> generate artifact`

This should be the primary path for:

- artifact-first output generation
- initiative, finance, results or assessment entrypoints

### 8.3 Save as template

Flow:

`existing report or deck -> extract reusable blueprint -> review template payload -> save as org or personal template`

Rule:

`save as template must strip accidental one-off content while preserving reusable structure, defaults and quality expectations`

### 8.4 Clone and adapt

Flow:

`system template -> clone -> adapt -> save as org template`

This remains a baseline requirement.

### 8.5 Paired-output generation

Flow:

`choose family template -> create report and presentation from one source pack -> preserve shared lineage`

This should be first-class, not improvised later through manual conversion.

---

## 9. Template selection and recommendation engine

The generator should not rely only on manual browsing.

It should recommend templates based on:

- source module
- source artifact type
- audience
- goal
- communication mode
- confidentiality
- delivery mode

Examples:

- `Finance` + executive audience -> finance review report or paired-output family
- `Results` + quarterly review -> scorecard report + executive deck family
- `Initiative` + steering decision -> steering deck or initiative review family

Rule:

`template recommendation may be AI-assisted, but the user remains the decider`

---

## 10. Structure generation rules

Templates must not only store labels.

They must generate:

- report sections
- slide intents
- required blocks
- optional blocks
- notes and commentary scaffolds where relevant

The generator should support:

- required structure
- optional adaptive structure
- source-aware omission of irrelevant sections
- warnings when source coverage is insufficient

Rule:

`template generation should adapt to source reality without silently dropping critical governance sections`

---

## 11. Sample content and placeholder policy

Templates may include:

- placeholder text
- sample section prompts
- sample visuals or block types
- speaker-note hints

But the user should control whether to:

- keep sample content
- replace sample content
- remove sample content

Forbidden behavior:

- shipping polished sample text as if it were grounded output

---

## 12. Template quality and trust

Templates are first-class quality objects.

Each serious template should declare:

- required source classes
- intended audience
- communication register
- required sections or slide intents
- quality constraints
- brand constraints

Template QA should validate:

- structural completeness
- source compatibility
- output-family compatibility
- brand completeness
- duplicated or stale guidance

Rule:

`a weak template can degrade many outputs, so template quality must be governed more strictly than one-off drafts`

---

## 13. AI role in template generation

AI should support templates as:

- template recommender
- structure generator
- reusable-pattern extractor
- sample-content cleaner
- template-fit critic

AI may:

- suggest which template fits a source pack
- generate first draft of a new template blueprint
- derive a reusable template from a strong artifact

AI may not:

- silently publish a template to org library
- convert one-off artifact noise into a trusted default without review

---

## 14. Completeness criteria by output type

### 14.1 Reports

A complete report template generator requires:

- report-template library
- canonical report families beyond static `R1-R4` naming
- section blueprint generation
- source-fit validation
- save-as-template flow
- org-scoped customization
- quality and refresh semantics at template level

### 14.2 Presentations

A complete presentation template generator requires:

- gallery and preview
- clone and adapt flow
- slide-intent blueprint generation
- visual-hint generation
- speaker-note defaults
- template-family links to report equivalents

### 14.3 Shared output family

A complete shared template system requires:

- one vocabulary
- one scope model
- one authoring lifecycle
- one trust model
- one paired-output family runtime

---

## 15. Main gaps to close now

### P0

- shared output-template runtime
- report template runtime closure
- save-as-template doctrine
- source-aware template recommendation
- paired-output template family concept

### P1

- template QA and trust metadata
- richer org template authoring
- AI-assisted template extraction from strong outputs

### P2

- performance analytics per template
- template success scoring by audience and delivery mode
- deeper adaptive structure logic

---

## 16. Acceptance criteria

This element is complete when:

- `Reports` and `Presentations` share one template runtime vocabulary
- the system supports template-first and source-first generation
- `save as template` exists as a governed flow
- report and deck templates can belong to the same family
- template recommendation is source-aware and audience-aware
- template quality is governed as a first-class concern

---

## 17. Related canonical docs

- `PRESENTATIONS_AND_REPORTS_V3.md`
- `REPORTING_CANONICAL_TEMPLATES.md`
- `REPORTS_V8_SSOT.md`
- `PREZENTACJE_V8_SSOT.md`
- `REPORTS_AND_PRESENTATIONS_OUTPUT_OPERATING_MODEL_V8.md`
- `REPORTS_AND_PRESENTATIONS_FUNCTIONAL_COMPLETENESS_AND_GAP_MATRIX_V8.md`
- `REPORTS_AND_PRESENTATIONS_LLM_ROUTING_AND_MODEL_POLICY_V8.md`
