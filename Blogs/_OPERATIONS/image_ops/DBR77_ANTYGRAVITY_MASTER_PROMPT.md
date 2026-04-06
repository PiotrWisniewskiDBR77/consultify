# DBR77 Antygravity Master Prompt

Copy everything below into Antygravity.

```text
You are working inside the `Blogs` directory of the DBR77 marketing system.

Your job is to execute the DBR77 image production workflow exactly as documented in the repository.

You must begin by reading these files in this exact order:

1. `DBR77_IMAGE_SYSTEM_MASTER.md`
2. `DBR77_IMAGE_SYSTEM_STRATEGY.md`
3. `DBR77_ANTYGRAVITY_IMAGE_WORKFLOW.md`
4. `DBR77_ANTYGRAVITY_OPERATOR_RUNBOOK.md`
5. `DBR77_IMAGE_GENERATION_QUEUE.csv`

After reading them, execute image production strictly from the documented workflow.

## Mission

Generate DBR77 images from the existing `image-prompts.md` files and save them into the correct article folders with the correct filenames and metadata sidecars.

The system already contains:

- the image strategy
- the prompt standard
- the audit
- the queue
- the naming convention
- the metadata contract

Do not invent a new workflow.

## Non-Negotiable Rules

You must:

- treat `DBR77_IMAGE_GENERATION_QUEUE.csv` as the execution contract
- read the `source_prompt_path` from each queue row
- generate only the role requested by the row
- save the image into the exact `output_dir`
- use the exact `output_filename`
- write the exact metadata sidecar named in `meta_filename`
- preserve the role identity: `hero`, `analytical`, or `social`
- preserve the requested aspect ratio
- keep outputs reusable for website, social, and newsletter where specified

You must not:

- invent new folders
- rename files
- create extra roles
- skip metadata
- write into `_LP_UPLOAD_READY/`
- change article text files
- process archive rows unless explicitly requested
- process rows marked `rewrite_prompt_first`
- ignore the prompt role definitions inside `image-prompts.md`

## Default Execution Scope

Unless I explicitly narrow the scope, use this safe filter:

- `generation_action = generate_now`
- `active_generation_target = true`
- `is_archive = false`

If I specify a product or queue slice, apply that filter on top.

## Per-Row Execution Logic

For each eligible queue row:

1. Read the file at `source_prompt_path`.
2. Locate the requested role section:
   - `Hero`
   - `Analytical`
   - `Social`
3. Use only that role's instructions for generation.
4. Generate the image in the requested style and aspect ratio.
5. Save the image to `output_dir/output_filename`.
6. Save the metadata sidecar beside it as `meta_filename`.
7. Move to the next eligible row.

## Output Rules

Allowed image filenames include:

- `hero_16x9_v1.png`
- `analytical_16x9_v1.png`
- `social_1x1_v1.png`
- optional `social_4x5_v1.png` only when explicitly generated

The output folder is always:

- `assets/images/`

inside the article or page folder referenced by the queue row.

## Metadata Rules

For every generated image, write a `.meta.json` file beside it.

Each sidecar must include at least:

- `article_path`
- `product`
- `scope_type`
- `asset_slug`
- `role`
- `aspect_ratio`
- `usage`
- `model`
- `prompt_source`
- `prompt_text`
- `negative_prompt`
- `seed` if available
- `run_id` if available
- `created_at`
- `alt_text_en`
- `caption_en`
- `crop_safe_notes`

If available, also include:

- `alt_text_pl`
- `alt_text_de`
- `caption_pl`
- `caption_de`

## Quality Standard

Every image must satisfy DBR77's trust and realism requirements:

- industrially credible
- operationally grounded
- calm and professional
- not sci-fi
- not stock-photo-like
- not hype-driven
- not decorative only
- clearly aligned with the article thesis

Additional role rules:

### Hero

- build trust
- show real environment
- feel credible on the website

### Analytical

- explain one key idea clearly
- feel useful inside the article
- avoid decorative infographic behavior

### Social

- carry one strong thesis
- be crop-safe
- work for LinkedIn and newsletter reuse
- do not rely on generated text inside the image

## Automatic Re-Render Rule

Before considering a row finished, rerender the same role if any of these occur:

- obvious text artefacts
- obvious stock-photo stiffness
- cyberpunk or sci-fi drift
- low realism
- clutter that weakens the thesis
- broken crop safety for social use

If you rerender, keep the same role and save the improved image as the next version number:

- `v2`, `v3`, etc.

Do not overwrite the previous version unless I explicitly ask for replacement behavior.

## Stop-And-Report Blockers

Stop and report instead of improvising if:

- `source_prompt_path` does not exist
- the requested role does not exist in the prompt file
- `output_dir` cannot be resolved
- metadata cannot be written
- the queue row conflicts with the prompt file

## Delivery Format

When you finish a batch, report:

1. which filter you used
2. which rows were completed
3. which rows were skipped and why
4. which rows failed and why
5. where the outputs were written

## Start Instruction

Now begin by:

1. reading the required documentation files
2. loading `DBR77_IMAGE_GENERATION_QUEUE.csv`
3. applying the default safe filter unless I specify another
4. executing the batch exactly as documented

Do not ask me to redesign the workflow unless you hit a real blocker.
```

## Suggested Use

If you want Antygravity to work on a narrower scope, prepend one line before the master prompt, for example:

- `Process only rows where product = IoT.`
- `Process only rows where product = DT and role = hero.`
- `Process only rows where recommended_priority = P2 and is_archive = false.`

## Review Note

After Antygravity finishes, the next step is manual or agent review against:

- thesis fidelity
- operational realism
- crop safety
- metadata completeness

That review should be done before assets are treated as approved for public use.
