# DBR77 Image Generation Runner

## Purpose

This file documents the local image-generation runner that works directly against the `Blogs/` folder and the DBR77 queue files.

Use it when you want to generate images without relying on Antygravity.

The runner:

- reads `DBR77_IMAGE_GENERATION_QUEUE.csv`
- reads the matching `image-prompts.md`
- calls either Google or OpenAI image APIs
- writes image files into `assets/images/`
- writes `.meta.json` sidecars beside them
- logs all actions to `DBR77_IMAGE_GENERATION_LOG.jsonl`

## Main File

- `Blogs/_TOOLS/run_image_generation.py`

## Supported Providers

- `google`
- `openai`

Provider selection is done with `--provider` or `DBR77_IMAGE_PROVIDER`.

## Required API Keys

### Google

Set one of:

- `GOOGLE_API_KEY`
- `GEMINI_API_KEY`

Default model:

- `imagen-4.0-generate-001`

Override with:

- `GOOGLE_IMAGE_MODEL`

### OpenAI

Set:

- `OPENAI_API_KEY`

Default model:

- `gpt-image-1.5`

Override with:

- `OPENAI_IMAGE_MODEL`

## Environment Example

See:

- `Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_GENERATION_ENV.example`
- `Blogs/_TOOLS/.env.image-generation`

The runner automatically loads:

- `Blogs/_TOOLS/.env.image-generation`

You can override that with:

- `--env-file <path>`

## Basic Usage

Run from the workspace root:

```bash
python3 "Blogs/_TOOLS/run_image_generation.py" --provider google --product Consultify --limit 3
```

Dry run:

```bash
python3 "Blogs/_TOOLS/run_image_generation.py" --provider google --product Consultify --limit 3 --dry-run
```

Generate only one role:

```bash
python3 "Blogs/_TOOLS/run_image_generation.py" --provider openai --product DT --role hero --limit 5
```

Generate from all active rows using defaults:

```bash
python3 "Blogs/_TOOLS/run_image_generation.py" --provider google
```

## Default Filtering Behavior

By default, the runner only processes rows where:

- `generation_action = generate_now`
- `active_generation_target = true`
- `is_archive = false`

You can relax that behavior with flags:

- `--include-archive`
- `--include-non-active`
- `--allow-non-generate-now`

## Useful CLI Flags

- `--provider google|openai`
- `--product <Product>`
- `--role hero|analytical|social`
- `--slug <article_slug>`
- `--priority P1|P2`
- `--limit <N>`
- `--dry-run`
- `--rerender`
- `--overwrite`

## Rerender Behavior

If the target file already exists:

- default behavior: skip existing image
- `--overwrite`: overwrite the existing target filename
- `--rerender`: write the next available version number such as `v2`, `v3`, etc.

## Output Behavior

The runner writes to the exact paths already defined in:

- `Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_GENERATION_QUEUE.csv`

Typical outputs:

- `hero_16x9_v1.png`
- `analytical_16x9_v1.png`
- `social_1x1_v1.png`
- matching `.meta.json` sidecars

## Aspect Ratio Notes

### Google

Google Imagen supports:

- `1:1`
- `3:4`
- `4:3`
- `16:9`
- `9:16`

### OpenAI

OpenAI supports:

- `1024x1024`
- `1536x1024`
- `1024x1536`

Because OpenAI does not expose an exact `16:9` size, the runner automatically center-crops the returned landscape image to the requested aspect ratio before saving it.

All saved outputs are normalized to PNG.

## Metadata

For each generated image, the runner writes a `.meta.json` sidecar containing:

- source prompt path
- final prompt text
- negative prompt
- model/provider used
- channel usage
- alt text
- caption
- crop notes
- output path

## Logs

Execution log:

- `Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_GENERATION_LOG.jsonl`

It includes:

- generated rows
- skipped rows
- failed rows
- batch summary

## Recommended First Real Run

Start with a dry run:

```bash
python3 "Blogs/_TOOLS/run_image_generation.py" --provider google --product Consultify --limit 3 --dry-run
```

Then run a small real batch:

```bash
python3 "Blogs/_TOOLS/run_image_generation.py" --provider google --product Consultify --limit 3
```

Then inspect:

- generated image files in `assets/images/`
- matching `.meta.json`
- the JSONL log

## Recommended Review Process

After each batch, review:

1. thesis fidelity
2. industrial realism
3. social crop safety
4. metadata completeness

If a role needs improvement, rerun only that role with:

```bash
python3 "Blogs/_TOOLS/run_image_generation.py" --provider google --product Consultify --slug 01_why_traditional_consulting_is_broken --role hero --rerender
```
