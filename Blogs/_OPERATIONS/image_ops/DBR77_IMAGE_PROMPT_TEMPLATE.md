# DBR77 Image Prompt Template

Use this template when writing or rewriting any `image-prompts.md` file.

Copy it into:

- `Blogs/<Product>/Blog/<NN_topic_slug>/image-prompts.md`
- `Blogs/DBR77/Blog/<NN_topic_slug>/image-prompts.md`
- `Blogs/DBR77/Pages/<page_slug>/image-prompts.md`
- `Blogs/DBR77/Personas/<persona_slug>/image-prompts.md`

Do not replace role names with custom labels.

Keep `Hero`, `Analytical`, and `Social` exactly as written.

## Core Reset Rule

Do not write prompts that sound like "premium AI image prompts."

Write prompts as if you are briefing:

- an editorial photographer
- a prop stylist building one physical explanatory setup
- a serious image editor selecting one believable business moment

## The Template

```md
# Image Prompts

## Hero

- objective:
- claim to prove:
- single scene:
- primary subject:
- business moment:
- camera framing:
- lens / distance:
- light / atmosphere:
- material cues:
- imperfection cues:
- style family: editorial industrial photography
- constraints: no readable text, no logos, no brand names, no fake dashboards, no staged stock-photo poses, no sci-fi UI, no over-clean symmetry
- negative prompts:
- aspect ratio: 16:9
- export pixels: deliver a true **16:9** raster on disk (e.g. 1920×1080 or 1376×768—pick one convention per product batch and keep it stable)

## Analytical

- objective:
- claim to prove:
- structure to explain:
- physical explanatory device:
- single scene:
- camera framing:
- light / atmosphere:
- material cues:
- style family: physical explanatory construction
- constraints: no readable text, no labels, no numbers, no dashboard UI, no chart board look, no generic slide layout, no decorative software schematic
- negative prompts:
- aspect ratio: 16:9
- export pixels: true **16:9** file on disk (same pixel-height convention as `hero` when possible, so layouts stay consistent)

## Social

- objective:
- claim to prove:
- single scene:
- focal subject:
- camera framing:
- light / atmosphere:
- material cues:
- style family: tight editorial crop
- constraints: no text in the generated image, no poster layout, no dashboard feel, no weak focal hierarchy, keep the main subject center-safe for 1:1 reuse
- negative prompts:
- aspect ratio: 1:1
- optional variant: 4:5
- export pixels: final `social_1x1_v*.png` must be **square** (width equals height within ~1%). If the image model outputs only 16:9, **center-crop** (preferred) or **pad** to square, then write the crop in sidecar `crop_safe_notes` and/or `generation_notes`
```

## How To Write Each Field

### Objective

Describe what job the image must do.

Good:

- show that approval delay creates operating friction
- show that rollout control matters more than rollout speed

Weak:

- create a strong image about industrial AI

### Claim To Prove

State the article argument the image must make believable.

Good:

- coordination load changes before hands-on work changes
- simulation helps only when it enters execution through one governed path

Weak:

- factories use AI

### Single Scene

Describe only one scene.

Good:

- one cross-shift handoff table where exception trays and approval controls are shared by day and night supervisors

Weak:

- factory, operators, dashboards, strategy meeting, routing board, data overlays, and management review all in one shot

### Primary Subject / Focal Subject

State the one thing the eye should read first.

Examples:

- one approval gate
- one incident marker entering a response loop
- one bounded rollout lane passing one readiness gate

### Business Moment

Use this field mainly for `Hero`.

State the visible moment of decision, control, handoff, or escalation.

Examples:

- supervisor routes an exception into owned follow-up
- one work packet pauses at a human approval step
- one live incident crosses an escalation threshold

### Structure To Explain

Use this field mainly for `Analytical`.

Explain the business structure, not the visual layout.

Good:

- response loop from intake to closure
- governance move from watch to advise to act
- bounded waves with rollback control

Weak:

- table with icons
- infographic with four blocks

### Physical Explanatory Device

Use this field mainly for `Analytical`.

Force the image away from software UI and toward physical explanation.

Examples:

- tabletop routing board with trays, gates, and metal rails
- physical ledger-and-packet system
- fabricated comparison rig with levers and bounded lanes
- overhead photographed control board with tokens and checkpoints

### Camera Framing

Always specify a believable read.

Examples:

- overhead editorial shot
- waist-high documentary view
- tight square crop
- medium-distance industrial still

### Lens / Distance

Use mainly for `Hero`.

Examples:

- medium documentary distance
- close editorial crop
- overhead wide-table read

### Light / Atmosphere

Use restrained, believable language.

Good:

- practical industrial light with soft falloff
- neutral workshop light with slight shadow depth
- calm documentary light, not theatrical

Weak:

- futuristic glow
- dramatic cyber lighting
- premium innovation lighting

### Material Cues

Ask for believable surfaces.

Examples:

- worn steel
- paper edges
- scuffed paint
- mixed wood and metal
- matte plastics
- practical workshop fixtures

### Imperfection Cues

Use this field for `Hero` when realism matters.

Examples:

- slight tool scatter
- natural wear
- non-symmetric placement
- restrained workflow messiness

Do not ask for chaos. Ask for credibility.

### Style Family

Use only:

- `editorial industrial photography`
- `physical explanatory construction`
- `tight editorial crop`

Do not use generic style phrases such as:

- premium industrial editorial realism
- strategic infographic
- enterprise design illustration

## Negative Prompt Rules

Negative prompts should block the failure that is most likely for that role.

Recommended negative blocks:

- fake dashboard
- software panel
- UI mockup
- infographic slide
- pseudo-labels
- readable text
- chart board
- concept-art glow
- generative sterility
- toy-like miniature setup

## Role Guidance

### Hero

Prefer:

- real people in a real workflow moment
- physical decisions, packets, approvals, routing, inspections, escalations
- believable backgrounds that support the scene

Avoid:

- "smart table" scenes
- screen-led compositions
- too many symbolic props

### Analytical

Prefer:

- one fabricated explanatory setup
- one overhead or frontal read
- one obvious structure in under three seconds

Avoid:

- software schematics
- fake charts
- readable pseudo-headers
- PowerPoint logic

### Social

Prefer:

- one dominant subject
- bold crop
- one metaphor only

Avoid:

- poster feel
- multi-step explanation
- tiny details that disappear in feed

## Quick Quality Check

Before approving a prompt, check:

1. Is there exactly one visual claim?
2. Is the scene believable as a photographed or physically built setup?
3. Does the wording avoid dashboard / software / infographic triggers?
4. Would this still look credible if someone saw it without knowing it was AI-generated?
5. Is the role-specific focal hierarchy obvious?
