# DBR77 Antygravity Operator Runbook

## Purpose

This file is the practical execution layer for Antygravity.

It is written for the moment when the image system is already standardized and the operator wants to hand real work to Antygravity without extra explanation.

Use this file when the question is:

- what exactly should I tell Antygravity
- what should it read
- what should it generate
- where should it save outputs
- how should it describe the outputs
- when is the task done

## Read These Files In Order

1. `Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_SYSTEM_MASTER.md`
2. `Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_QC_STANDARD.md`
3. `Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_PROVIDER_ROUTING.md`
4. `Blogs/_OPERATIONS/image_ops/DBR77_ANTYGRAVITY_IMAGE_WORKFLOW.md`
5. `Blogs/_OPERATIONS/image_ops/DBR77_ANTYGRAVITY_OPERATOR_RUNBOOK.md`
6. `Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_GENERATION_QUEUE.csv`

If Antygravity needs style context, also point it to:

- `Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_SYSTEM_STRATEGY.md`

## Core Operator Rule

Antygravity should not improvise the workflow.

Antygravity is now one channel inside the DBR77 multi-channel production system.

It must always work from:

1. `DBR77_IMAGE_GENERATION_QUEUE.csv`
2. the `image-prompts.md` file referenced by the row
3. the output directory and filenames specified by the row
4. the metadata contract from the workflow document
5. the shared approval contract from `Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_QC_STANDARD.md`
6. the role/channel assignment from `Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_PROVIDER_ROUTING.md`

## What Antygravity Is Allowed To Do

Antygravity should:

- read the queue
- read the referenced prompt file
- generate only the requested role
- save the image in the exact target folder
- save the exact metadata sidecar beside it
- stop at the end of the requested batch
- stay inside the assigned batch-production scope instead of acting like the premium rescue lane

Antygravity should not:

- invent new folders
- rename output files
- generate roles not requested by the queue
- write into `_LP_UPLOAD_READY/`
- change article copy
- merge multiple articles into one output
- ignore archive flags
- skip metadata

## Canonical Inputs

### Queue

Primary control file:

- `Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_GENERATION_QUEUE.csv`

### Prompt Sources

Allowed prompt source types:

- `Blogs/<Product>/Blog/<slug>/image-prompts.md`
- `Blogs/DBR77/Blog/<slug>/image-prompts.md`
- `Blogs/DBR77/Pages/<slug>/image-prompts.md`
- `Blogs/DBR77/Personas/<slug>/image-prompts.md`

### Strategy Context

Optional but recommended:

- `Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_SYSTEM_STRATEGY.md`

## Canonical Outputs

### Folder

For every source folder:

- `assets/images/`

### Files

Allowed output filenames:

- `hero_16x9_v1.png`
- `analytical_16x9_v1.png`
- `social_1x1_v1.png`
- optional `social_4x5_v1.png`

### Sidecars

Required sidecars:

- `hero_16x9_v1.meta.json`
- `analytical_16x9_v1.meta.json`
- `social_1x1_v1.meta.json`

## Definition Of A Finished Row

A queue row is done only when all of the following are true:

1. the requested image exists in the target folder
2. the filename exactly matches the queue row
3. the metadata sidecar exists beside it
4. the metadata contains the final prompt used
5. the metadata contains the negative prompt used
6. the image visually matches the requested role
7. the image is usable for the listed channel purpose

## Required Sidecar Fields

Every `.meta.json` must include:

```json
{
  "article_path": "Blogs/IoT/Blog/01_why_factories_still_dont_use_machine_data",
  "product": "IoT",
  "scope_type": "blog",
  "asset_slug": "01_why_factories_still_dont_use_machine_data",
  "role": "hero",
  "aspect_ratio": "16:9",
  "usage": ["website", "social", "newsletter"],
  "model": "name used in Antygravity",
  "prompt_source": "Blogs/IoT/Blog/01_why_factories_still_dont_use_machine_data/image-prompts.md",
  "prompt_text": "final prompt actually sent to the model",
  "negative_prompt": "final negative prompt actually sent to the model",
  "seed": "if available",
  "run_id": "if available",
  "created_at": "ISO-8601 timestamp",
  "alt_text_en": "Describe the business meaning of the image, not only the literal scene.",
  "caption_en": "One-sentence editorial caption aligned with the thesis.",
  "crop_safe_notes": "State whether the key subject is safe for 1:1 or 4:5 reuse."
}
```

Optional:

- `alt_text_pl`
- `alt_text_de`
- `caption_pl`
- `caption_de`

## Recommended Operating Modes

There are only four valid Antygravity job types.

### Mode 1: Single Article Triptych

Use when:

- you want `Hero`, `Analytical`, and `Social` for one article

Instruction to paste:

```text
Use the DBR77 image workflow exactly.

Read:
- Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_SYSTEM_STRATEGY.md
- Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_QC_STANDARD.md
- Blogs/_OPERATIONS/image_ops/DBR77_ANTYGRAVITY_IMAGE_WORKFLOW.md
- Blogs/<Product>/Blog/<slug>/image-prompts.md

Task:
- Generate the three defined roles only: Hero, Analytical, Social.
- Use the role instructions exactly as written in image-prompts.md.
- Save outputs into Blogs/<Product>/Blog/<slug>/assets/images/.
- Use these exact filenames:
  - hero_16x9_v1.png
  - analytical_16x9_v1.png
  - social_1x1_v1.png
- If the Social role is suitable for 4:5, also create:
  - social_4x5_v1.png
- For every generated image, write the matching .meta.json sidecar beside it.
- Do not invent new roles, folders, or filenames.
- Do not write text into the generated image unless the prompt explicitly allows it.
```

### Mode 2: Product Batch

Use when:

- you want Antygravity to process all active rows for one product

Instruction to paste:

```text
Use the DBR77 image workflow exactly.

Read:
- Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_SYSTEM_STRATEGY.md
- Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_QC_STANDARD.md
- Blogs/_OPERATIONS/image_ops/DBR77_ANTYGRAVITY_IMAGE_WORKFLOW.md
- Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_GENERATION_QUEUE.csv

Task:
- Process only rows where:
  - product = <Product>
  - generation_action = generate_now
  - active_generation_target = true
- For each row:
  - read source_prompt_path
  - generate only the requested role
  - save the image to output_dir/output_filename
  - save the metadata sidecar as meta_filename
- Skip archive rows unless they are explicitly requested.
- Stop when all eligible rows for the product are complete.
- Do not modify the queue schema or create alternative output structures.
```

### Mode 3: Queue Slice

Use when:

- you want a mixed cross-product batch controlled only by queue filters

Instruction to paste:

```text
Use the DBR77 image workflow exactly.

Read:
- Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_SYSTEM_STRATEGY.md
- Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_QC_STANDARD.md
- Blogs/_OPERATIONS/image_ops/DBR77_ANTYGRAVITY_IMAGE_WORKFLOW.md
- Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_GENERATION_QUEUE.csv

Task:
- Process only rows matching this filter:
  - generation_action = generate_now
  - active_generation_target = true
  - recommended_priority = <value_or_values>
  - product in <allowed product set if specified>
  - is_archive = false unless archive work is explicitly requested
- For each eligible row:
  - read source_prompt_path
  - generate only the role listed in the row
  - save the image to output_dir/output_filename
  - write the sidecar metadata to meta_filename
- Do not process rows outside the filter.
- Do not create extra files.
```

### Mode 4: Re-Render Existing Role

Use when:

- one image already exists, but needs a better version

Instruction to paste:

```text
Use the DBR77 image workflow exactly.

Read:
- Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_QC_STANDARD.md
- Blogs/<Product>/Blog/<slug>/image-prompts.md
- the existing sidecar metadata for the current version

Task:
- Re-render only this role: <hero_or_analytical_or_social>
- Keep the same article path and role identity
- Save the improved image as the next version number, for example:
  - hero_16x9_v2.png
  - hero_16x9_v2.meta.json
- Preserve the role and aspect ratio
- Improve only the visual quality, clarity, realism, or crop safety
- Do not change the folder structure or create alternate naming patterns
```

## Review Rules For Antygravity Tasks

Antygravity should use the following review logic before considering a result acceptable.

`Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_QC_STANDARD.md` is the shared approval contract.
If a result fails that QC standard, Antygravity should rerender the role even if the workflow itself was followed correctly.

### Hero

Check:

- does it feel like real industrial or executive context
- does it support trust
- does it avoid “AI art” vibes

### Analytical

Check:

- does it explain one idea clearly
- is it structurally readable
- does it avoid decorative infographic behavior

### Social

Check:

- is there one strong thesis moment
- is the image crop-safe
- can it work in LinkedIn and newsletter without looking generic

## When Antygravity Should Re-Render Automatically

If any of these happen, Antygravity should re-render the same role before returning the task as done:

- obvious text artefacts in the image
- obvious stock-photo stiffness
- sci-fi / cyberpunk drift
- low operational realism
- clutter that weakens the thesis
- social crop not safe for center framing

The rerender should increase only the version number.

## When Antygravity Should Stop And Return A Blocker

Stop and report instead of improvising if:

- source prompt file is missing
- queue row path is invalid
- output directory cannot be resolved
- multiple conflicting role instructions exist in one file
- the requested role is not defined and queue says `generate_now`
- metadata cannot be written

## Required Image Descriptions

Antygravity should not leave image meaning implicit.

For every sidecar:

### `alt_text_en`

Write for website reuse.

Rule:

- describe the business meaning first
- then the scene

Good:

- `Industrial comparison image showing why a structured supplier shortlist creates clearer automation decisions than scattered vendor offers.`

Weak:

- `A meeting room with people and papers.`

### `caption_en`

Write as a one-line editorial takeaway.

Good:

- `A shortlist becomes useful only after the broader market has already been disciplined into a comparable decision set.`

## Exact Queue Interpretation Rules

### `generation_action = generate_now`

Generate immediately.

### `generation_action = review_then_generate`

Generate only if the operator explicitly included these rows in the task.

### `generation_action = rewrite_prompt_first`

Do not generate.

Return the blocker.

### `generation_action = exclude_from_active_batch`

Ignore unless the operator explicitly asks for archive or exception work.

## Recommended Default Production Filter

If no narrower instruction is given, Antygravity should use this safe filter:

- `generation_action = generate_now`
- `active_generation_target = true`
- `is_archive = false`

## Full-System Instruction

Use this when you want Antygravity to be able to work repeatedly without restating the whole setup:

```text
You are executing the DBR77 image production workflow.

Your source of truth is:
- Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_SYSTEM_STRATEGY.md
- Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_QC_STANDARD.md
- Blogs/_OPERATIONS/image_ops/DBR77_ANTYGRAVITY_IMAGE_WORKFLOW.md
- Blogs/_OPERATIONS/image_ops/DBR77_ANTYGRAVITY_OPERATOR_RUNBOOK.md
- Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_GENERATION_QUEUE.csv

You must:
- read the queue row
- read the referenced image-prompts.md
- generate only the role requested by the row
- save the image to the exact output_dir/output_filename
- write the exact .meta.json sidecar listed for that role

You must not:
- invent new folders
- invent new roles
- rename files
- skip metadata
- process archive rows unless explicitly requested
- generate rows marked rewrite_prompt_first

A row is finished only when the image and sidecar both exist and the image matches the requested role and channel use.
```

## Product-Specific Assignment Prompt

Use this when you want to hand off a whole product:

```text
Execute the DBR77 image production workflow for product <Product>.

Read:
- Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_SYSTEM_STRATEGY.md
- Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_QC_STANDARD.md
- Blogs/_OPERATIONS/image_ops/DBR77_ANTYGRAVITY_IMAGE_WORKFLOW.md
- Blogs/_OPERATIONS/image_ops/DBR77_ANTYGRAVITY_OPERATOR_RUNBOOK.md
- Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_GENERATION_QUEUE.csv

Process all rows where:
- product = <Product>
- generation_action = generate_now
- active_generation_target = true
- is_archive = false

For each row:
- read source_prompt_path
- generate only the requested role
- save the image into output_dir/output_filename
- write meta_filename beside the image

Return only when the full filtered set is complete or when a real blocker prevents continuation.
```

## Review Assignment Prompt

Use this when you want Antygravity to rework weak results:

```text
Review the already generated DBR77 image assets for this scope: <scope>.

For each role:
- compare the generated image against the prompt role
- apply Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_QC_STANDARD.md
- check thesis fidelity
- check industrial realism
- check social crop safety where relevant
- check text artefacts and generic AI drift

If the image is strong, keep the current version.
If the image is weak, re-render only that role and save it as the next version number with a fresh sidecar.
Do not rename the previous version.
```

## Operator Checklist Before Delegating Work

Before you send a task to Antygravity, confirm:

1. the queue rows you want are filtered
2. the work is active, not archive by accident
3. the target scope is clear: article, product, or queue slice
4. you know whether you want only `v1` generation or also rerender authority

## Operator Checklist After Antygravity Finishes

Confirm:

1. files were written into the exact target folder
2. filenames match the queue
3. sidecars exist for every output
4. metadata contains `prompt_text`, `negative_prompt`, `alt_text_en`, and `caption_en`
5. the image is believable enough for DBR77 public use

## Final Rule

If Antygravity does not follow the queue, the result is not part of the DBR77 system.

The queue is the execution contract.
