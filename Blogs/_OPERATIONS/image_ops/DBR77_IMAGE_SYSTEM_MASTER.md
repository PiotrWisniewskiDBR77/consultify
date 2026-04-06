# DBR77 Image System Master

## Purpose

This is the entry point for the DBR77 image system.

Read this file first when you want to:

- understand the image strategy
- review the audit
- plan prompt rewrites
- run Antygravity generation
- manage image outputs for website, social, and newsletter use

## Package Contents

### 1. Strategy

- `Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_SYSTEM_STRATEGY.md`

Use for:

- visual direction
- image roles
- credibility rules
- prompt standard

### 2. Prompt Template

- `Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_PROMPT_TEMPLATE.md`

Use for:

- writing new `image-prompts.md`
- rewriting old prompt files into the shared contract

### 3. Audit

- `Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_PROMPTS_AUDIT.md`

Use for:

- current-state review
- product-by-product quality signals
- format and readiness analysis

### 4. Gap Coverage Plan

- `Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_GAP_COVERAGE_PLAN.md`

Use for:

- execution order
- batch sizing
- P0, P1, P2 prioritization
- product-level rewrite planning

### 5. Antygravity Workflow

- `Blogs/_OPERATIONS/image_ops/DBR77_ANTYGRAVITY_IMAGE_WORKFLOW.md`

Use for:

- input and output rules
- naming convention
- metadata sidecars
- queue-driven generation
- operator prompts

### 6. Antygravity Operator Runbook

- `Blogs/_OPERATIONS/image_ops/DBR77_ANTYGRAVITY_OPERATOR_RUNBOOK.md`

Use for:

- exact instructions to paste into Antygravity
- job modes: article, product, queue slice, rerender
- review rules
- done criteria
- operator checklists

### 7. Antygravity Master Prompt

- `Blogs/_OPERATIONS/image_ops/DBR77_ANTYGRAVITY_MASTER_PROMPT.md`

Use for:

- one copy-paste prompt for Antygravity
- bootstrapping Antygravity from `Blogs/` access only
- delegating work without additional oral instructions

### 8. Local Runner

- `Blogs/_TOOLS/run_image_generation.py`
- `Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_GENERATION_RUNNER.md`
- `Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_GENERATION_ENV.example`
- `Blogs/_TOOLS/.env.image-generation`

Use for:

- direct local generation without Antygravity
- queue-driven generation through Google or OpenAI APIs
- stable file writing into `assets/images/`
- logging and rerender control
- local API key storage for the runner

### 9. Codex Supervised Production

- `Blogs/_OPERATIONS/image_ops/DBR77_CODEX_SUPERVISED_PRODUCTION_SYSTEM.md`
- `Blogs/_OPERATIONS/image_ops/DBR77_CODEX_WORKER_TASKS.md`
- `Blogs/_OPERATIONS/image_ops/DBR77_CODEX_REVIEW_BOARD.csv`
- `Blogs/_OPERATIONS/image_ops/DBR77_CODEX_IMAGE_BATCH_OPERATOR.md`

Use for:

- supervisor-worker image production
- assigning exact batches to Codex
- reviewing and approving roles
- logging `approve / fix / prompt_patch`
- targeted rerender loops instead of uncontrolled autonomy

### 10. Shared QC Standard

- `Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_QC_STANDARD.md`

Use for:

- one shared image approval contract across agents
- automatic reject rules
- role-specific quality gates
- consistent supervisor review and rerender decisions

### 11. Provider Routing

- `Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_PROVIDER_ROUTING.md`

Use for:

- assigning image roles to channels
- balancing cost and quality
- avoiding single-channel production drift

### 12. Next 100 Image Window

- `Blogs/_OPERATIONS/image_ops/DBR77_NEXT_100_IMAGE_WINDOW.md`

Use for:

- controlled post-reset production
- logging channel performance
- deciding long-term routing after the next 100 images

### 13. Inventory

- `Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_PROMPTS_INVENTORY.csv`

Use for:

- filtering the current prompt library
- identifying missing roles and weak formats

### 14. Generation Queue

- `Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_GENERATION_QUEUE.csv`

Use for:

- batch execution in Antygravity
- separating generate-now rows from rewrite-first rows

## System Snapshot

Current image prompt estate:

- `327` total prompt files
- `320` active non-archive prompt files
- `960` active planned image outputs at `3` roles per asset
- `981` total queue rows including archive rows

Current reset conclusion:

- the old prompt system produced too many images with obvious AI, dashboard, or pseudo-infographic cues
- the next phase is not blind production continuation
- the next phase is visual reset, prompt reset, stricter QC, and controlled multi-channel testing

## Recommended Reading Order

1. `Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_SYSTEM_STRATEGY.md`
2. `Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_PROMPT_TEMPLATE.md`
3. `Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_QC_STANDARD.md`
4. `Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_PROVIDER_ROUTING.md`
5. `Blogs/_OPERATIONS/image_ops/DBR77_NEXT_100_IMAGE_WINDOW.md`
6. `Blogs/_OPERATIONS/image_ops/DBR77_ANTYGRAVITY_IMAGE_WORKFLOW.md`
7. `Blogs/_OPERATIONS/image_ops/DBR77_ANTYGRAVITY_OPERATOR_RUNBOOK.md`
8. `Blogs/_OPERATIONS/image_ops/DBR77_CODEX_SUPERVISED_PRODUCTION_SYSTEM.md`
9. `Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_GENERATION_QUEUE.csv`

## Recommended Execution Order

1. Rewrite prompts into the new professional-reset contract before resuming scale production
2. Assign channels using `Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_PROVIDER_ROUTING.md`
3. Run the next controlled 100-image window using `Blogs/_OPERATIONS/image_ops/DBR77_NEXT_100_IMAGE_WINDOW.md`
4. Review results against the stricter QC bar
5. Lock longer-term routing only after the 100-image checkpoint
6. Keep the queue as the operational control surface for future production

## First Antygravity Move

If you want the safest next batch after the reset:

1. open `Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_GENERATION_QUEUE.csv`
2. choose only rows that will be generated under the new prompt standard
3. assign a channel from `Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_PROVIDER_ROUTING.md`
4. log each output inside the next-100 test window
5. keep sidecars and role discipline unchanged

## Rule Of Use

Do not generate at scale from raw prompt files alone.

Always use:

- the strategy
- the queue
- the workflow

together.
