# Tool Knowledge Bank (authoring rules)

This folder contains **Tool Knowledge Packs** and **tool support artifacts** for consulting tools.

The goal is to keep one repo-native, reviewable source of truth for:

- tool-scoped RAG retrieval,
- runtime UI hints and guided questions,
- initiative / roadmap proposal generation,
- help center and chat guidance,
- visual asset briefs for library/help surfaces.

Canonical SSOT:

- `docs/product/TOOLS_KNOWLEDGE_BANK_V3.md`
- `docs/product/TOOLS_SSOT_SOURCES_V3.md`
- `docs/product/KB_ARTICLE_TEMPLATE_FOR_TOOLS_V1.md`

---

## What lives here

### 1. Tool knowledge packs

Knowledge packs are compact, chunk-friendly artifacts designed for UI + AI + downstream generators.

They are the primary source for:

- methodology guidance,
- structured question banks,
- initiative patterns,
- benchmark/context references,
- help and output guidance.

### 2. Tool support artifacts

Some content is not meant to be indexed into RAG as methodology chunks, but still belongs next to the tool pack:

- preview graphic briefs,
- asset copy,
- visual legends,
- thumbnail / teaser assumptions.

These artifacts live with the tool so product, content, and AI stay aligned.

---

## Folder structure

### 1. Indexed knowledge packs

Canonical indexed packs live under:

- `knowledge/tool-kb/<tool_slug>/<pack_type>/v<major>/...`

Supported `pack_type` values:

- `methodology`
- `qbank`
- `initiatives`
- `benchmarks`
- `help`

Where:

- `tool_slug`: `drd`, `siri`, `adma`, `dynamic-swot`, etc.
- `v<major>`: e.g. `v1`

### 2. Non-indexed support artifacts

Support artifacts live under:

- `knowledge/tool-kb/<tool_slug>/assets/v<major>/...`

Use `assets/` for:

- graphic briefs,
- asset descriptions,
- preview legend specs,
- visual copy and alt text.

`assets/` is a support folder, not a primary methodology pack type.

---

## Standard tool stack

Every tool should aim for the following authoring stack:

1. `methodology`
2. `qbank`
3. `initiatives`
4. `benchmarks`
5. `help`
6. `assets`

Minimum recommended baseline for a new tool:

- `methodology` or `qbank`
- `help`

Preferred complete stack:

- all five indexed pack types plus `assets`

---

## Authoring rules (MUST)

- **Compact**: prefer structured bullets over long paragraphs unless deep explanation is required.
- **Chunk-friendly**: write in sections that can be embedded and retrieved cleanly.
- **Stable ids**: every major section should have an id-like heading or marker.
- **Evidence-first**: explain what evidence is required and common mistakes.
- **Provenance**: always list canonical sources (repo docs, PDFs, archived URLs) for each artifact.
- **No client data**: project-specific notes do not belong here.
- **Product-aligned**: tool content must match the real runtime stages, outputs, and terminology.
- **Propose -> accept aware**: content may guide proposals, but must never imply silent automation.

---

## Canonical 4-block tool description

Every mature tool with a library/detail surface should be describable through the same 4 runtime-facing blocks:

1. `Goal`
2. `Process`
3. `Outcomes`
4. `Example`

These 4 blocks are not a help-center article and not a full methodology encyclopedia.
They are the canonical description layer for the product UI.

Their job is to help a serious user understand:

- what this tool is for,
- when to use it,
- how to move through it,
- what “good output” looks like,
- how the tool becomes a decision, report, deck, or initiative.

### Block 1. `Goal`

Purpose:

- explain what the tool is,
- what problem it solves,
- when to use it,
- when not to use it,
- what minimum input is needed before the user starts.

Required content:

- 1 strong definition,
- 3-5 bullets on what problem it solves,
- 3-5 bullets on when to use,
- 2-4 bullets on when not to use,
- 3-5 bullets on what to prepare before start.

Length guidance:

- target: `90-180 words` total in body copy,
- or `5-10 short bullets` plus `1-2 short paragraphs`,
- avoid walls of text longer than `5-6 lines` per paragraph.

Rules:

- `Goal` MUST NOT contain the main case study,
- `Goal` SHOULD NOT explain the entire flow step-by-step,
- `Goal` SHOULD answer “is this the right tool for me now?” within `10-20 seconds`.

### Block 2. `Process`

Purpose:

- show how the user actually moves through the tool,
- explain what each runtime step expects,
- reduce fear for users who do not know the framework well.

Required content:

- real runtime stages, not textbook-only stages,
- `4-6` primary steps for the standard view,
- for each step:
  - what happens here,
  - what the user should provide,
  - what good input looks like,
  - what AI helps with,
  - what mistake to avoid.

Length guidance:

- target: `180-320 words` total,
- step labels should stay short,
- each step should use `1 short sentence` plus `2-4 bullets`,
- if a tool needs deeper step logic, keep the runtime block concise and move detail to methodology/help.

Rules:

- `Process` must feel operational, not academic,
- `Process` should be the most “operator-friendly” block,
- `Process` should assume the reader is smart but not already trained in the framework.

### Block 3. `Outcomes`

Purpose:

- explain what the result contains,
- teach the user how to read it,
- show what becomes possible after the tool is finished.

Required content:

- 1 short framing paragraph,
- a structured output view, preferably a `Decision Board` or equivalent table,
- explanation of what a good result looks like,
- downstream outputs in Consultify.

Preferred table shape:

- `Outcome block`
- `What it tells you`
- `Why it matters`
- `What it enables next`

Recommended row count:

- `4-6 rows`

Length guidance:

- target: `100-220 words` outside the table,
- each table cell should stay to roughly `1-2 sentences` or `1-3 short bullets`,
- avoid turning `Outcomes` into another process description.

Rules:

- `Outcomes` must look like decision-grade material,
- `Outcomes` must show that the tool is not a dead end,
- `Outcomes` should explain quality, not only list artifacts.

### Block 4. `Example`

Purpose:

- show one realistic end-to-end use of the tool,
- make the method concrete,
- prove what “good” looks like in practice.

Required content:

- one realistic business context,
- one clear starting question,
- `3-5` input signals or facts,
- `2-4` key interpretations / findings,
- `1-3` recommended moves,
- `1-2` created outputs.

Length guidance:

- target: `180-320 words` total,
- context intro: `2-3 sentences`,
- input snapshot: `3-5 bullets`,
- conclusion / move / output: concise bullets, not essay paragraphs.

Rules:

- use `one` case only in the main block,
- the case must be realistic enough to teach the tool, not just decorate the page,
- the case should show the move from input -> interpretation -> action,
- do not write a vague “toy example”.

### Graphics canon

Almost every mature tool should have at least one presentation graphic.

Canonical repo location:

- `knowledge/tool-kb/<tool_slug>/assets/v<major>/...`

Canonical graphic roles:

1. **Primary explainer graphic**
2. **Optional example/case graphic**

#### Primary explainer graphic

Use in:

- `Goal` or `Process`

Purpose:

- explain the structure of the tool,
- show the logic of the flow,
- help the user understand the mental model fast.

Rules:

- there should usually be `one` primary graphic,
- it should explain, not decorate,
- it should not contain all knowledge needed to use the tool,
- text must still stand on its own without the image.

#### Example / case graphic

Use in:

- `Example`

Purpose:

- visualize one realistic case,
- show how the tool turns signals into insight and next action.

Rules:

- use only if the tool benefits from a case walkthrough,
- keep it tied to one scenario, not a collage of many ideas,
- if both graphics exist, the primary graphic explains the method and the second graphic explains the case.

### Visual language canon

Tool graphics and highlighted content blocks must look intentional and system-designed.
They must not look like randomly assembled slides.

#### Color strategy

Use one clear hierarchy of colors:

- **Base surface**: neutral, quiet background for the whole block or canvas,
- **Primary accent**: one main brand/section color for the tool logic,
- **Support accent**: one secondary color for relationships, dependencies, or evidence,
- **State color**: one reserved color for warning/risk/tension.

Rules:

- use `1` dominant accent and at most `1-2` support accents,
- avoid rainbow palettes and arbitrary per-card colors,
- color must encode meaning, not decoration,
- if a tool already has a known accent family, reuse it consistently across preview, detail, help, and graphic assets.

Recommended semantic mapping:

- `primary`: core method / main flow / selected stage,
- `support`: evidence / context / linked element,
- `warning`: tension / risk / blocker / contradiction,
- `neutral`: explanatory copy, frame, background, supporting labels.

#### Highlighted / selected blocks

When a block is selected, primary, or currently in focus, it should be visibly elevated.

Preferred emphasis methods:

- slightly stronger surface tint,
- stronger border or keyline,
- subtle glow or shadow,
- stronger title contrast,
- optional background field behind the active cluster.

Rules:

- use `one` dominant emphasis method and at most `one` supporting method,
- selected state must be obvious in under `1 second`,
- highlighted blocks should feel more important, not louder everywhere,
- avoid heavy neon, thick random borders, or unrelated background colors.

Recommended treatment:

- normal block: quiet neutral surface with soft border,
- highlighted block: tinted background + stronger border + slightly elevated shadow,
- critical block: same as highlighted, plus small badge or label if needed.

#### Special graphics

Some tools need more than a standard explainer diagram.

Allowed special graphic types:

1. **Flow graphic**: sequence from input -> interpretation -> output
2. **Matrix graphic**: 2-axis structure with explained meaning
3. **Decision board graphic**: summary of what matters now and what follows next
4. **Signal-to-move graphic**: evidence -> tension -> move translation
5. **Case walkthrough graphic**: one scenario from starting question to action

Rules:

- use a special graphic only when it clarifies the method materially,
- choose `one` primary graphic logic per tool surface,
- avoid mixing matrix + roadmap + dashboard + illustration in one crowded visual,
- if multiple graphics exist, each must have a distinct job.

#### How graphics should be authored

Every graphic should be created from a brief, not improvised directly in UI code.

The brief should define:

- graphic goal,
- audience,
- placement (`Goal`, `Process`, `Example`, preview, help),
- one-sentence takeaway,
- information hierarchy,
- semantic color mapping,
- legend labels,
- alt text,
- what must be emphasized,
- what must stay secondary.

Authoring rules:

- start from the message, not the shape,
- one graphic should communicate `one` primary idea,
- text inside the graphic should be short enough to scan,
- labels should use product language, not consultant jargon overload,
- spacing must separate groups clearly,
- alignment should follow an obvious grid or flow direction,
- decorative elements must be subordinate to information.

#### Visual quality bar

A good tool graphic should feel:

- deliberate,
- premium,
- product-native,
- easy to scan,
- credible for executive and operator audiences.

A bad tool graphic feels:

- accidental,
- overfilled,
- inconsistent in spacing,
- random in color usage,
- too clever to read quickly.

#### Anti-patterns

Avoid:

- more than `3-4` visual colors with equal weight,
- too many boxes with identical emphasis,
- long paragraphs inside cards,
- decorative arrows everywhere,
- mixed metaphors in one graphic,
- icons with no meaning,
- gradients/noise/glow that reduce legibility,
- “presentation slide” clutter pretending to be a product diagram.

### Quality bar for all 4 blocks

The 4-block description should be:

- consulting-grade,
- practical for a non-expert user,
- skimmable in under `2-3 minutes`,
- strong enough that a first-time user understands what to do next.

The 4-block description should not be:

- lazy filler,
- a rewritten marketing landing page,
- a methodology dump,
- so short that the user still does not know how to use the tool.

---

## What each pack should contain

### `methodology`

Use for:

- what the tool is for,
- when to use it and when not to,
- step logic and evidence discipline,
- framework comparisons,
- interpretation rules,
- anti-patterns.

Do not use for:

- client-specific findings,
- verbose marketing copy,
- implementation-only code notes.

### `qbank`

Use for:

- guided questions by stage / area / level,
- evidence prompts,
- examples of strong vs weak answers,
- acceptance/rejection hints for AI-assisted capture.

Do not use for:

- final conclusions,
- generic brainstorming lists without stage context.

### `initiatives`

Use for:

- mapping gaps / tensions / patterns into actionable moves,
- suggested initiative shapes,
- owners, KPIs, dependencies, first steps,
- ordering rules such as foundation before scale.

Do not use for:

- automatic commitments,
- speculative outputs without evidence conditions.

### `benchmarks`

Use for:

- external comparisons,
- adjacent-framework positioning,
- examples, cases, strategic context, and pattern libraries,
- structured source cataloging for deeper AI assistance.

Do not use for:

- unsupported claims presented as canon,
- outdated benchmark data without provenance or date context.

### `help`

Use for:

- help center article content,
- chat-coach scripts,
- onboarding checklists,
- output guidance,
- video / teaser outline if needed.

Do not use for:

- full methodology duplication,
- long-form benchmark synthesis better suited to other packs.

### `assets`

Use for:

- preview graphic brief,
- visual composition notes,
- legend,
- alt text,
- thumbnail/video still guidance.

Do not use for:

- large binary files,
- storing generated assets as canon without description and provenance.

---

## Provenance rules

For each pack or support artifact:

- list product SSOT sources first,
- then runtime contract sources,
- then archived/local external sources,
- label archived sources by purpose where helpful: `method`, `comparison`, `example`, `visual`, `benchmark`.

If a source is derived from a local archive snapshot, cite both:

- the zip file path,
- the internal archived page path if known.

---

## RAG / indexing notes

Indexed pack types:

- `methodology`
- `qbank`
- `initiatives`
- `benchmarks`
- `help`

Recommended metadata:

- `tool_slug`
- `pack_type`
- `pack_version`
- `language`
- `source_kind='tool_pack'`

`assets/` content is usually not indexed into RAG unless a future pipeline explicitly supports `source_kind='tool_asset'`.

---

## Templates

Use:

- `knowledge/tool-kb/_templates/tool-pack.v1.md`
- `knowledge/tool-kb/_templates/tool-asset-brief.v1.md`

