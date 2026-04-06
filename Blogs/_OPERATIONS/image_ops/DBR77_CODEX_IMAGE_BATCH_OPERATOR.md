# DBR77 Codex Image Batch Operator

## Purpose

This file is a direct instruction set for Codex.

Use it when you want Codex to work as one lane inside the DBR77 multi-channel image system.

Codex is best used for:

- prompt-aware generation
- premium rescue rerenders
- difficult `social` or `hero` corrections
- visual review and keep-or-rerender decisions
- narrow controlled batches when Codex is the assigned lane

## Channel Scope

This file governs the `Codex` lane only.

It does not mean Codex is the only allowed system for the whole project.

Project-wide channel assignment is defined in:

- `Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_PROVIDER_ROUTING.md`

If the assigned lane for a task is not `Codex`, this file should not be used as the main operator.

This file is written to be copy-pasted into Codex with minimal extra explanation.

## Recommended Use

This file is best used together with:

- `Blogs/_OPERATIONS/image_ops/DBR77_CODEX_SUPERVISED_PRODUCTION_SYSTEM.md`
- `Blogs/_OPERATIONS/image_ops/DBR77_CODEX_WORKER_TASKS.md`
- `Blogs/_OPERATIONS/image_ops/DBR77_CODEX_REVIEW_BOARD.csv`
- `Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_QC_STANDARD.md`
- `Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_PROVIDER_ROUTING.md`

Preferred operating model:

- I choose the batch
- I choose whether Codex is the assigned lane
- Codex executes only the assigned slugs and roles
- I review results and mark `approved` or `fix_required`
- if needed, I patch prompts before the next repair pass

## Core Mission For Codex

When Codex is the assigned production lane, Codex must generate DBR77 images for blog content in batches of **10 articles at a time** unless the operator names a smaller correction scope.

For each article, Codex must generate the full triptych:

- `hero`
- `analytical`
- `social`

That means a standard batch equals:

- `10` articles
- `30` images

Codex must not process the whole product line at once unless explicitly instructed.

## Default Execution Mode

Unless the operator explicitly says `review`, `rerender`, `improve existing`, or similar, Codex must treat the task as:

- `fresh production batch mode`

That means:

- choose the next `10` eligible article slugs that are **not yet fully completed**
- generate missing roles for those slugs
- review only the assets produced in the current run
- do **not** start by auditing or rerendering older completed batches

Existing completed slugs are not the default target.

## Two Valid Modes

### Mode A: Fresh Production Batch

Use this by default.

Definition:

- choose the next `10` slugs in queue order for one product
- skip any slug that already has a complete triptych and matching sidecars
- generate only the slugs that are not yet fully complete

### Mode B: Review / Repair Existing Batch

Use this only when the operator explicitly requests review, repair, rerender, or quality improvement of already-generated assets.

Definition:

- inspect existing generated images
- rerender only weak roles
- preserve prior versions

Codex must not silently switch from Mode A to Mode B on its own.

## Non-Negotiable Rules

Codex must:

- work from the queue, not from improvisation
- read `Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_PROVIDER_ROUTING.md` before assuming that Codex should handle the task
- use the OpenAI provider by default when Codex is the generating lane
- generate only rows that are active and marked for generation
- save outputs into the exact `assets/images/` folder defined by the queue
- save the matching `.meta.json` sidecar for every image
- open the generated image files and visually review them
- rerender only weak roles, not the whole batch blindly
- stop after the requested batch size is complete

Codex must not:

- stop early just because the operator did not name the product, if the queue makes the next product obvious
- spawn subagents or explorer agents for generic repo exploration
- propose optional next steps before finishing the assigned batch
- switch to reviewing old completed slugs unless the operator explicitly requested review mode
- build contact sheets, temp collages, or helper assets in `/tmp` unless explicitly asked
- use fragile shell loops when direct sequential runner calls are sufficient
- invent new folders
- rename files
- generate archive rows unless explicitly asked
- write text into the image unless the prompt explicitly allows it
- accept visibly weak assets just because the API returned successfully
- switch channels on its own without operator instruction or routing guidance

Codex must prefer direct execution over repo exploration.

If the required files are already named in this document, Codex must read those files directly and proceed.
Codex must not respond with "I can inspect the queue", "I can explore the repo", or "I can spawn a subagent" as its main outcome.

## Files Codex Must Read First

Read these in order:

1. `Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_SYSTEM_MASTER.md`
2. `Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_SYSTEM_STRATEGY.md`
3. `Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_QC_STANDARD.md`
4. `Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_PROVIDER_ROUTING.md`
5. `Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_GENERATION_QUEUE.csv`

If generating for a specific article, also read:

6. `Blogs/<Product>/Blog/<slug>/image-prompts.md`

## Default Production Filter

Codex must filter the queue using all of the following:

- `generation_action = generate_now`
- `active_generation_target = true`
- `is_archive = false`
- `product = <requested product>`

If no product was specified by the operator, Codex must not stop immediately.

Instead Codex must:

1. inspect the filtered queue
2. group rows by product
3. identify the first product in queue order that still has active rows eligible for generation
4. select that product automatically
5. continue the batch without asking for confirmation

Only if the queue is ambiguous or empty may Codex ask for clarification.

### Default Autonomous Product Selection

Unless the operator explicitly names a different product, Codex should choose:

- the product containing the earliest eligible active row in `Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_GENERATION_QUEUE.csv`

At the time this workflow was written, the queue starts with `Consultify`, so if the queue order is unchanged, `Consultify` is the correct default first product.

## Default Provider

Default provider when Codex is generating:

- `openai`

Default model expected in environment:

- `gpt-image-1.5`

Codex should use any non-default provider only if the operator explicitly asks for a comparison or the routing document assigns such a test.

## Batch Definition

One standard production batch means:

- one product at a time
- the next `10` unique article slugs in queue order that are not already fully completed
- all `3` roles for each slug

Codex must not exceed `10` articles in one run unless the operator explicitly changes the batch size.

### Fully Completed Slug

A slug counts as fully completed when all of the following exist for the queue-defined target filenames:

- `hero` image
- `hero` sidecar
- `analytical` image
- `analytical` sidecar
- `social` image
- `social` sidecar

If a slug is fully completed, Codex must skip it in fresh production mode and continue scanning the queue for the next eligible incomplete slug.

## Exact Generation Workflow

### Step 1: Select The Next 10 Articles

Codex must:

1. Read `Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_GENERATION_QUEUE.csv`
2. Apply the default production filter
3. If the product was not explicitly given, auto-select the first eligible product in queue order
4. In fresh production mode, check for each slug whether the queue-defined target files already exist
5. Skip fully completed slugs
6. Extract the next `10` unique incomplete `asset_slug` values in queue order for the selected product
7. Build a working list of those `10` slugs

Codex must not stop after noticing that the first historical slugs already have files.
Codex must continue scanning until it either finds `10` incomplete slugs or reaches the end of eligible rows.

### Step 2: Generate Per Article

Codex must process each slug separately.

For a fresh generation where the role does not exist yet:

- generate through Codex's account-based image path only

If images already exist and the task is to improve quality instead of replacing history:

- rerender through Codex's account-based image path only

### Step 3: Review The Generated Images

After generating one article triptych in the current run, Codex must open and inspect:

- `hero_16x9_vN.png`
- `analytical_16x9_vN.png`
- `social_1x1_vN.png`

Codex must also inspect the matching sidecars.

Codex must use its own visual reasoning to judge whether the result is acceptable for DBR77 public use.

In fresh production mode, Codex must review the assets generated in that same run.
Codex must not first perform a broad review of old assets from earlier completed batches unless explicitly instructed to do so.

### Step 4: Decide Keep Or Rerender

If a role is strong:

- keep it

If a role is weak:

- rerender only that role
- increase the version number with `--rerender`
- do not delete the older version

Role-specific rerender rule:

- rerender only the exact weak role through Codex's account-based image path

### Step 5: Limit Rerenders

Codex must not loop forever.

For one role in one batch:

- maximum `2` rerenders after the initial render
- if still weak after that, keep the best version, mark it as weak in the report, and move on

Codex must not consume rerender budget on legacy assets outside the current batch unless the operator explicitly requested review mode.

## Quality Review Criteria

Codex must apply `Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_QC_STANDARD.md` as the shared approval contract.

If the QC standard rejects a role, Codex must rerender that role even if the asset looks superficially acceptable.

For newly generated assets, Codex must assume the stricter professional reset QC mode, not the legacy salvage mode.

### Hero

Accept only if:

- feels like credible executive, industrial, or operational reality
- clearly supports the article thesis
- does not look like generic stock business art
- has no obvious readable text artefacts
- avoids sci-fi, fake holograms, or decorative AI nonsense

Reject or rerender if:

- scene is generic and could belong to any B2B article
- visible text appears in screens, papers, walls, or overlays
- composition feels stiff or stock-photo-like
- it reads as obvious AI concept imagery at first glance

### Analytical

Accept only if:

- explains one business idea clearly
- is visually structured
- looks like a premium operational metaphor, not a PowerPoint slide
- avoids readable labels, headers, numbers, or fake UI copy

Reject or rerender if:

- it drifts into dashboard screenshot aesthetics
- it contains chart labels or pseudo-text
- it feels like a templated infographic instead of a premium editorial explanatory visual
- it behaves like software UI instead of a physical explanatory construct

### Social

Accept only if:

- there is one dominant focal subject
- the crop is safe for square use
- it works as a strong LinkedIn or newsletter thumbnail
- it is visually memorable and not cluttered

Reject or rerender if:

- it looks like a document scan, poster, or stock thumbnail
- it has weak focal hierarchy
- it introduces random symbols, giant punctuation marks, robots, or generic AI clichés
- it reads as a generic AI thumbnail rather than an editorial crop

## Automatic Reject Conditions

Codex must automatically rerender a role if any of the following are present:

- obvious readable text
- obvious stock-photo stiffness
- cyberpunk or sci-fi drift
- decorative fake dashboard behavior
- weak crop safety for `social`
- mismatch between the article thesis and the scene
- obvious AI-first synthetic look

## Sidecar Rules

For every generated image, Codex must confirm that the matching `.meta.json` exists beside it and contains:

- `prompt_text`
- `negative_prompt`
- `model`
- `alt_text_en`
- `caption_en`
- `crop_safe_notes`

If sidecar creation fails, the row is not done.

## Definition Of Done For One Article

One article is done only when:

1. `hero` image exists
2. `analytical` image exists
3. `social` image exists
4. all three sidecars exist
5. Codex has visually reviewed all three images
6. weak roles were rerendered when needed
7. the final kept version for each role is acceptable or explicitly flagged as weak-but-kept

## Definition Of Done For One Batch

One batch is done only when:

1. `10` article slugs were processed
2. all `30` requested roles were generated
3. all outputs were reviewed
4. rerenders were applied selectively where needed
5. Codex wrote a final quality summary for the batch

If fewer than `10` incomplete slugs remain for the selected product, the batch is done when all remaining incomplete slugs were processed and this was stated explicitly in the final report.

## Required Final Report From Codex

At the end of the batch, Codex must report:

- product name
- article slugs processed
- total images generated
- total rerenders
- strongest sets
- weakest sets
- recurring quality problems
- recommendation: continue, fix prompts, or compare another provider

Codex must provide this report only after completing the batch work.
The report must not replace the work.

## Recommended Final Report Format

```text
Batch complete.

Product: <Product>
Articles: <10 slugs>
Images generated: <count>
Rerenders used: <count>

Best sets:
- <slug>
- <slug>

Weakest sets:
- <slug>
- <slug>

Recurring issues:
- <issue>
- <issue>

Recommendation:
- continue with next batch
- or fix specific prompts before scaling
```

## Copy-Paste Prompt For Codex

Use the block below directly in Codex.

```text
You are executing the DBR77 image production workflow from the Blogs folder.

Your task is to generate one controlled fresh production batch of 10 article slugs.

Read first:
- Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_SYSTEM_MASTER.md
- Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_SYSTEM_STRATEGY.md
- Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_QC_STANDARD.md
- Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_GENERATION_QUEUE.csv

Then:
1. Filter the queue to rows where:
   - generation_action = generate_now
   - active_generation_target = true
   - is_archive = false
2. If the operator did not specify a product, automatically choose the product that appears first in queue order among eligible rows and continue without asking.
3. Fresh production mode is the default. Do not switch into review/rerender-existing mode unless the operator explicitly asks for that.
4. Skip any slug that already has a complete triptych and matching sidecars for the queue-defined target files.
5. Keep scanning until you collect the next 10 incomplete slugs for that product.
6. For each selected slug, generate Hero + Analytical + Social through Codex's account-based image path only.
7. Save images and sidecars into the exact queue-defined output folder.
8. Review only the images generated in this run.
9. If a role generated in this run is weak, rerender only that role through Codex's account-based image path.
10. Do not rerender the same role more than 2 times after the initial render.
11. Do not spawn explorer agents or subagents. Do not do generic repo exploration. Do not build contact sheets or temporary review assets unless explicitly requested.
12. Do not use the local runner or any API-key-based fallback.
13. Continue until all 10 selected article triptychs are complete.
14. Finish with a concise batch report that names:
   - strongest sets
   - weakest sets
   - recurring quality problems
   - whether the next batch should continue immediately

Quality rules:
- Apply Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_QC_STANDARD.md as the approval contract.
- Hero must feel credible, executive, and non-generic.
- Analytical must explain one idea without slide-like or text-heavy drift.
- Social must have one strong focal subject and be safe for square use.
- Reject visible text artefacts, stock-photo stiffness, cyberpunk drift, fake dashboards, giant punctuation, and generic AI clichés.

Use OpenAI as the default provider when Codex is the assigned lane.
Do not improvise the folder structure or filenames.
Treat the queue as the execution contract.
Read the routing file before assuming Codex should do the batch.
Do not stop to ask for product selection if the queue order makes the next product obvious.
Do the work first, then report.
```

## Shorter Autonomous Prompt

Use this shorter block when you want Codex to execute immediately with minimum back-and-forth.

```text
Execute one DBR77 image batch now from the Blogs folder.

Read directly:
- Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_SYSTEM_MASTER.md
- Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_SYSTEM_STRATEGY.md
- Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_QC_STANDARD.md
- Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_GENERATION_QUEUE.csv

Do not explore the repo broadly.
Do not spawn subagents.
Do not ask for product selection unless the queue is genuinely ambiguous.
Default to fresh production mode, not review mode.
Skip slugs that already have a complete triptych and sidecars.
Do not create contact sheets or temporary review collages.
Do not rerender old completed assets unless explicitly told to review them.

Instead:
1. filter to active non-archive rows where generation_action = generate_now
2. choose the first eligible product in queue order
3. skip fully completed slugs and continue scanning
4. take the next 10 incomplete unique slugs for that product
5. generate hero, analytical, and social for each slug through Codex's account-based image path
6. review each image generated in this run visually
7. rerender only weak roles from this run, max 2 rerenders per role
8. confirm every image has a matching .meta.json sidecar
9. end with a compact quality report

Treat the queue as the execution contract and complete the batch before reporting.
```

## One-Shot Hard Prompt

Use this when Codex still tries to over-think the task.

```text
Do not explore the repo. Do not spawn agents. Do not ask what product to use unless the queue is ambiguous.

Read only:
- Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_SYSTEM_MASTER.md
- Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_SYSTEM_STRATEGY.md
- Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_QC_STANDARD.md
- Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_GENERATION_QUEUE.csv

Then execute one fresh production batch:
- choose the first eligible product in queue order
- skip any slug that already has hero, analytical, social, and matching sidecars
- collect the next 10 incomplete slugs
- generate all 3 roles for each slug through Codex's account-based image path
- review only images created in this run
- rerender only weak roles from this run
- max 2 rerenders per role
- no contact sheets
- no helper scripts beyond what is necessary
- no review of old completed batches

Complete the batch first. Report only after the work is done.
```

## Strong Recommendation

For the current DBR77 setup, Codex should use this operating model:

- `OpenAI` for final quality generation
- one product at a time
- `10` articles per batch
- selective rerenders only
- mandatory visual self-review before closing the batch

This is the safest way to get publishable assets without losing quality control or creating uncontrolled costs.
