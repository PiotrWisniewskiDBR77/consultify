# DBR77 Image QC Standard

## Purpose

This file is the shared quality-control contract for DBR77 image production.

Use it for:

- `Codex` image generation and repair
- `Antygravity` image generation and rerender tasks
- supervisor review
- future automation agents that create or approve editorial images

If a workflow document and this QC file disagree, this QC file wins on quality decisions.

## Core Rule

An image is not done just because it was generated successfully.

An image is done only when it is:

- thesis-aligned
- visually credible
- free from embarrassing artefacts
- safe for the intended channel use

## Review Modes

There are now two valid review modes.

### Mode 1: Legacy Operational Recovery

Use this only for already-generated backlogs where speed and salvage matter more than benchmark quality.

Rule:

- `publish / watch / reject`

This means:

- do not reject assets for minor polish issues alone
- do not reject assets just because they are somewhat generic
- do not reject assets for mild hand softness, mild background defects, or light compositional stiffness if the image is still usable in context
- reject only when the image is clearly wrong, visibly broken, childish, or likely to undermine trust in publication

### Mode 2: Professional Reset Production

Use this for all newly generated assets from the reset onward.

Rule:

- `approved / fix_required`

In this mode:

- images that look obviously AI-generated at first glance should not pass as `watchlist`
- generic but usable is not good enough
- mild dashboard drift is not acceptable
- sterile concept-art polish is not acceptable
- the default assumption is professional publication, not salvage

This is now the default for new production.

## Mandatory QC Gates

Every generated role must pass all of these gates:

1. `Thesis fit`: the image clearly supports the article or page claim.
2. `Operational credibility`: the scene feels plausible for industrial, executive, or transformation use.
3. `Role fit`: the image behaves like `hero`, `analytical`, or `social`, not a generic filler.
4. `Text integrity`: no readable gibberish, fake UI labels, broken signage, or pseudo-copy.
5. `Composition`: the focal hierarchy is clear and not visually cluttered.
6. `Brand maturity`: the result feels premium and publishable, not like throwaway AI art.
7. `Crop safety`: the key subject remains safe for the target aspect ratio and reuse.
8. `Distinctiveness`: the image does not feel like a generic stock-photo substitute.
9. `Human believability at first glance`: the image should not immediately read as synthetic, over-staged, or generative.
10. `Pixel aspect contract`: the **saved PNG** matches the role’s aspect ratio in actual pixel width and height (not only in filename or sidecar text). `hero` and `analytical` must be ~**16:9** (width÷height roughly **1.73–1.80**). `social` must be **1:1** (width÷height **0.98–1.02**). If the generator only outputs one raster size (e.g. 1376×768), **center-crop or pad** the `social` export to a true square before shipping `social_1x1_v*.png`, and note the crop in `crop_safe_notes`.

If a gate fails only mildly in legacy recovery mode, the role may still be published with `watchlist` status.
If `Human believability at first glance` fails in professional reset mode, the role must be rerendered.
If a gate fails clearly, the role must be rerendered or explicitly rejected.

## Automatic Reject Conditions

Reject and rerender automatically if any of these are present:

- obvious readable text artefacts
- severe fake dashboards or fake interface copy that dominate the image
- childish, toy-like, cartoonish, or amateur-looking rendering when editorial realism is expected
- severe anatomy or object failures that are visible at normal review size
- social crops with no usable focal center
- strong metaphor drift where the image clearly communicates the wrong topic
- missing or broken sidecar metadata for the final kept file
- obvious AI-first look: synthetic polish, dashboard-board composition, over-clean concept tableau, or generated sterility dominating the read
- chart-board or panel aesthetics in `analytical` when physical explanatory logic was expected
- wrong pixel geometry: `social_1x1_*.png` saved as a non-square frame (typical failure: **1376×768** carried over from a 16:9 render), or `hero`/`analytical` saved with a clearly non–16:9 ratio without an approved exception documented in the sidecar

Do not auto-reject only for:

- mild stock-photo stiffness
- mild sci-fi drift
- minor background weirdness
- slight hand softness
- minor compositional clutter

These should normally be treated as `watchlist`, not `reject`, unless they seriously weaken trust.

## What Fails The New "AI Look" Gate

Fail the role in professional reset mode if one or more of these dominate the read:

- the image looks like a generic AI concept composition rather than a believable photographed scene
- surfaces are too clean, too even, too glossy, or too synthetic
- props look arranged for symbolism instead of work
- the image behaves like a pseudo-dashboard or pseudo-infographic even without readable text
- the metaphor is tidy but emotionally empty, as if made to satisfy the prompt rather than the viewer
- the first reaction is "AI image of a factory/business concept" instead of "credible editorial asset"

## Role QC

### Hero

Accept only if:

- the image establishes trust immediately
- the scene looks like credible industrial, operational, or executive reality
- the composition is clean enough for top-of-article use
- the article thesis is legible from the scene without relying on text in the image
- the image feels like a photographed editorial moment, not a concept render

Reject if:

- it looks clearly fake, childish, or broken
- it relies on readable gibberish or broken UI
- it communicates the wrong topic
- it reads as a staged AI tableau before it reads as an article image

Watchlist if:

- it is somewhat generic
- it uses a familiar stock-like setup
- it has mild decorative overlay drift but remains usable

In professional reset mode, do not use `watchlist` for a `Hero` that already reads as AI-generated at thumbnail size.

### Analytical

Accept only if:

- the image explains one idea clearly
- the structure is readable in under three seconds
- the metaphor looks editorial and premium, not like a slide or template infographic
- labels are avoided unless the prompt explicitly allows real text
- the structure is built from believable physical logic, not software logic

Reject if:

- it is dominated by pseudo-labels, fake UI modules, or unreadable charts
- it becomes obviously childish, broken, or nonsensical
- it tries to explain too many ideas and fails clarity entirely
- it behaves like a polished schematic panel instead of a physical explanatory construct

Watchlist if:

- it is slightly diagrammatic
- it contains mild dashboard flavor without clear text failure
- it feels somewhat templated but remains readable and on-thesis

In professional reset mode, mild dashboard flavor is not acceptable for `Analytical`.

### Social

Accept only if:

- there is one dominant focal subject
- the square crop remains strong
- the image works as a thumbnail without extra context
- the image is memorable at small size
- the image looks like a real editorial crop or a believable physical metaphor, not a mini poster

Reject if:

- it behaves like a poster or document scan
- the focal point is so weak that the thumbnail fails
- it depends almost entirely on detail that disappears in feeds
- it is visually broken or childish
- it looks like a generic AI thumbnail or a synthetic product-demo crop

Watchlist if:

- the focal point is acceptable but not great
- the crop is usable but not ideal
- the image is a bit busy yet still serviceable for social use

In professional reset mode, a `Social` role should be rerendered if it feels generic, synthetic, or template-like in feed view.

## Product-Specific Signals

### Consultify

Preferred signals:

- executive realism
- premium materials
- structured decision objects
- transformation governance made tangible

Watch-outs:

- repeated boardroom sameness
- too many pointing hands
- overuse of the same wooden tabletop metaphor

### Vector

Preferred signals:

- industrial AI security
- on-prem vs cloud contrast
- governed data paths
- real controls, machinery, and secure infrastructure

Watch-outs:

- fake interface text
- glossy cyber visuals
- tech scenes that feel generic instead of industrial

### DT

Preferred signals:

- factory systems
- simulation logic
- operational trade-off metaphors
- physicalized models, scenarios, and decision structures

Watch-outs:

- concept-art overload
- too many abstract objects with weak business meaning
- unreadable analytical labels

### DBR77

Preferred signals:

- system logic
- modules, bottlenecks, and governed flow
- productized decision architecture
- clear structure over mood

Watch-outs:

- diagrams that feel too cold or schematic
- beautiful but emotionally flat compositions
- abstract system boards with no obvious business thesis

## Review Decision Policy

Use these decisions consistently:

- `approved`: publishable now
- `watchlist`: publishable now, but not a benchmark asset
- `fix_required`: clearly wrong, childish, broken, or trust-damaging
- `prompt_patch_required`: the prompt repeatedly drives the wrong behavior
- `keep_best_available`: acceptable to ship when speed matters, even if not elegant

Operational rule:

- in legacy recovery mode, prefer `approved` or `watchlist` unless the asset clearly deserves rejection
- in professional reset mode, use `fix_required` whenever the asset clearly reads as AI-first, slide-like, dashboard-like, or not credible enough for premium publication

## Rerender Policy

When a role clearly fails QC:

1. rerender only the weak role
2. preserve the old version
3. increase the version number
4. document the reason in the report or review board

Do not rerender a whole triptych just because one role is weak.
Do not rerender merely to chase perfection when the role is already publishable.

## Sidecar QC

An image cannot pass QC without a valid sidecar.

Confirm that the matching `.meta.json` contains at least:

- `prompt_text`
- `negative_prompt`
- `model`
- `alt_text_en`
- `caption_en`
- `crop_safe_notes`

Reject the row if the image exists but the sidecar is missing or incomplete.

## Minimum Final Review Notes

Every agent or reviewer that closes work should explicitly note:

- strongest roles or sets
- weakest roles or sets
- recurring failure patterns
- whether rerenders were enough or prompts should be patched

## Short QC Summary For Agents

Use this when a workflow needs a compact reminder:

```text
Apply DBR77 image QC before closing any role.

For legacy backlog recovery, use publish / watch / reject.
For all new production, use the stricter professional reset bar.

Pass only images that are thesis-aligned, operationally credible, visually mature, and believable at first glance.

Auto-reject not only readable gibberish and severe fake UI, but also obvious AI-first imagery, sterile concept-board scenes, and dashboard-like analyticals.

In new production, do not keep an image merely because it is usable. Keep it only if it is believable and professional enough to represent the brand.
```
