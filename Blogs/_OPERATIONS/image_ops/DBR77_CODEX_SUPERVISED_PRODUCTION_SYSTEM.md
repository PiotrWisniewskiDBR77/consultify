# DBR77 Codex Supervised Production System

## Purpose

This file defines the production system where:

- Codex is the worker
- I am the supervisor
- the user is the final approver

The goal is to stop Codex from improvising batch selection, over-reviewing old assets, or deciding quality policy on its own.

Instead:

- I choose the batch
- Codex generates only the assigned work
- I review the outputs
- I mark each role as approved or requiring fixes
- if needed, I improve the prompts
- Codex receives only the next precise follow-up task

This is the recommended operating mode for DBR77 from now on.

## Why This System Is Better

Autonomous Codex mode is useful, but it tends to:

- over-explore
- reinterpret the batch scope
- review work that was not requested
- rerender too broadly
- accept mediocre analytical or social assets

The supervised system fixes this by separating responsibilities.

## Roles

### 1. Codex = Worker

Codex is responsible only for:

- reading the exact files I point to
- generating the exact assigned slugs and roles
- saving image outputs and sidecars
- following rerender instructions exactly
- reporting what it did

Codex is not responsible for:

- deciding which batch to do next
- deciding whether the batch scope should change
- deciding whether existing older assets should be reviewed
- changing prompt strategy without instruction

### 2. Me = Supervisor

I am responsible for:

- selecting the next batch from the queue
- deciding whether the batch is fresh generation or repair mode
- reviewing the actual PNG outputs
- marking roles as `approved` or `fix_required`
- identifying whether the issue is generation-only or prompt-level
- patching prompt files when needed
- sending Codex only the next exact repair or generation task

### 3. User = Final Decision Layer

The user only needs to:

- decide whether to continue the production wave
- optionally inspect selected approved outputs
- decide when to scale to the next product or next batch block

## System Components

This supervised system uses four files:

1. `Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_GENERATION_QUEUE.csv`
2. `Blogs/_OPERATIONS/image_ops/DBR77_CODEX_REVIEW_BOARD.csv`
3. `Blogs/_OPERATIONS/image_ops/DBR77_CODEX_WORKER_TASKS.md`
4. `Blogs/_OPERATIONS/image_ops/DBR77_CODEX_IMAGE_BATCH_OPERATOR.md`
5. `Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_QC_STANDARD.md`

## Golden Rule

Codex never selects the batch on its own in supervised mode.

I always hand Codex:

- the product
- the exact slug list
- the allowed roles
- whether this is fresh generation or rerender

## Standard Workflow

### Phase 1: Supervisor Prepares The Batch

I do the following:

1. Read `Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_GENERATION_QUEUE.csv`
2. Choose the next batch of `10` slugs or a smaller targeted repair batch
3. Record those assignments in `Blogs/_OPERATIONS/image_ops/DBR77_CODEX_REVIEW_BOARD.csv`
4. Send Codex a precise worker task from `Blogs/_OPERATIONS/image_ops/DBR77_CODEX_WORKER_TASKS.md`

### Phase 2: Codex Generates

Codex does only the assigned work.

For a fresh batch:

- generate `hero`, `analytical`, and `social`
- write images and sidecars
- stop

For a repair batch:

- rerender only the exact assigned roles
- do not touch other roles
- stop

### Phase 3: Supervisor Reviews

I open the generated images and review each role.

For every role, I assign one of these decisions:

- `approved`
- `fix_required`
- `prompt_patch_required`
- `keep_best_available`

I record that in `Blogs/_OPERATIONS/image_ops/DBR77_CODEX_REVIEW_BOARD.csv`.

### Phase 4: Prompt Repair If Needed

If the problem comes from the prompt rather than random generation drift:

- I edit the source `image-prompts.md`
- I mark `prompt_patch_required = yes`
- I send Codex a repair task only for the affected role

### Phase 5: Close Or Continue

When all roles in the batch are approved or intentionally kept:

- I mark the batch as closed
- then I prepare the next batch

## Review Decision Rules

### Approve

Use `approved` when:

- the image is publishable
- the role is thesis-aligned
- the image matches DBR77 standards
- the image passes `Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_QC_STANDARD.md`

### Fix Required

Use `fix_required` when:

- the prompt is probably good enough
- the output is weak due to generation variance
- rerendering the same role is likely enough

### Prompt Patch Required

Use `prompt_patch_required` when:

- the image repeatedly drifts in the same wrong direction
- the role keeps turning into slide/UI/dashboard behavior
- the social keeps becoming symbolic poster art
- the hero keeps becoming generic business stock art

### Keep Best Available

Use `keep_best_available` when:

- rerender budget is exhausted
- the current result is imperfect but usable
- moving forward is better than burning more budget

## What Gets Tracked In The Review Board

Track at role level, not only article level.

For each assigned role, record:

- product
- slug
- role
- batch id
- source prompt path
- current chosen version
- generation status
- review decision
- prompt patch needed
- rerender count
- notes

## How Prompt Repair Works

Prompt repair should be done only by me, not by Codex, unless I explicitly delegate prompt editing.

Repair loop:

1. identify repeated failure pattern
2. patch the role in `image-prompts.md`
3. rerender only that role
4. review again
5. either approve or patch again

## Recommended Batch Logic

### Fresh Production

Best default:

- `10` slugs
- `3` roles each
- one product at a time

### Repair Batch

Best default:

- `5-12` roles total
- only roles that failed review
- no untouched roles

## Cost Control Rules

To stay fast and cheap:

- do not rerender good heroes
- do not rerender full triptychs if only one role is weak
- patch prompts only when the failure pattern repeats
- stop at `2` rerenders per role unless the user explicitly approves more

## Recommended Practical Operating Pattern

For each product:

1. fresh batch of `10` slugs
2. supervisor review
3. targeted repair batch
4. close the batch
5. move to the next `10`

This is much more stable than asking Codex to self-manage quality end-to-end.

## What I Should Tell Codex

In supervised mode, I should never say:

- "do the next batch however you think best"
- "review what looks weak"
- "pick what to rerender"

Instead I should say:

- "generate these 10 slugs"
- "rerender these 6 exact roles"
- "do not touch anything else"

## Final Recommendation

Use this supervised system as the default DBR77 production workflow.

It gives us:

- better quality control
- lower API waste
- cleaner prompt evolution
- much less Codex improvisation
