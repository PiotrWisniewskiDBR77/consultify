# DBR77 Image Provider Routing

## Purpose

This file defines how DBR77 should assign work across available image-generation channels during the professional reset.

Use it for:

- generator assignment
- cost-aware production planning
- deciding which channel should handle which role
- keeping the next 100 images comparable enough to evaluate later

## Important Distinction

DBR77 now has two layers:

1. `channel`: where the work is executed
2. `model/provider`: which model powers the generation inside that channel

Current available channels:

- `Codex`
- `Cursor OpenAI`
- `Antygravity`
- `Local runner`

This routing file assigns tasks by channel first.

## Routing Goal

Do not ask one generator to do every job.

Optimize for:

- cheapest publishable asset, not cheapest raw image
- believable editorial quality for `hero` and `social`
- controlled physical explanatory quality for `analytical`
- visible experimentation without losing file discipline

## Channel Roles

### 1. Codex

Primary job:

- prompt patching
- role-by-role rescue rerenders
- visual QA
- narrow premium correction passes

Use Codex when:

- one or two roles are weak and need intelligent repair
- the prompt needs rewriting based on visible failure patterns
- a human-like reviewer should decide what to keep
- `social` needs stronger focal hierarchy

Do not use Codex as the default bulk lane.

### 2. Cursor OpenAI

Primary job:

- premium final-image lane for the most credibility-sensitive roles

Use Cursor OpenAI when:

- `hero` needs maximum first-glance trust
- `social` needs a stronger editorial crop
- an important rerender must look less synthetic than the batch output

This is the preferred quality lane for high-stakes finals.

### 3. Antygravity

Primary job:

- controlled batch production lane
- repeatable article or queue execution with strong file discipline

Use Antygravity when:

- a batch is stable enough to process at volume
- prompts are already rewritten into the new system
- we want throughput without giving up role structure and sidecars

Antygravity should be the main volume lane once prompts are stable.

### 4. Local Runner

Primary job:

- controlled API comparisons
- cost logging
- scale experiments
- structured multi-provider tests

Use the local runner when:

- we want comparable model tests with recorded costs
- we want to compare providers on the same prompt family
- we need a lower-cost exploration lane before premium rerender

Do not use the local runner as the blind default final lane.

## Provisional Assignment By Role

This assignment applies for the next controlled 100-image window.

### Hero

Primary channels:

- `Cursor OpenAI`
- `Antygravity`

Fallback:

- `Codex`

Exploration only:

- `Local runner`

Reason:

- `Hero` needs the highest first-glance credibility
- `Hero` is the least forgiving role if it looks synthetic
- cheap exploration may be useful, but final keep should usually come from the strongest editorial-looking result

### Analytical

Primary channels:

- `Antygravity`
- `Local runner`

Fallback:

- `Codex`
- `Cursor OpenAI`

Reason:

- `Analytical` benefits from controlled, repeatable experiments
- we need to compare which channel best avoids slide/UI drift
- `Analytical` should not automatically inherit the same generator as `Hero`

### Social

Primary channels:

- `Cursor OpenAI`
- `Codex`

Fallback:

- `Antygravity`

Exploration only:

- `Local runner`

Reason:

- `Social` is the most thumbnail-sensitive role
- `Social` often needs stronger focal judgment and tighter cleanup
- fast volume alone usually hurts `Social`

## Job Types

Use these job types consistently:

### Premium Final

Best channel:

- `Cursor OpenAI`

Use for:

- final `hero`
- high-value `social`
- rescue rerenders for weak but important assets

### Batch Production

Best channel:

- `Antygravity`

Use for:

- stable article batches
- triptych production after prompt normalization

### Structured Experiment

Best channel:

- `Local runner`

Use for:

- cost-aware provider comparison
- repeated same-prompt tests
- analytical-role evaluation

### Intelligent Repair

Best channel:

- `Codex`

Use for:

- prompt repair after visible drift
- selective rerender decisions
- role-by-role salvage

## What The Routing Must Prevent

Do not allow:

- one channel to generate all three roles by habit
- low-cost channels to silently become final channels without review
- premium channels to be wasted on every first pass
- batch channels to decide quality policy on their own

## Required Logging For The Next 100 Images

For every image produced in the next controlled window, record:

- product
- slug
- role
- channel
- model/provider if known
- whether it was first pass or rerender
- QC result
- `editorial_first` or `ai_first`

## Decision Rule After 100 Images

After the next 100 images, review performance by:

- publishable rate
- rerender rate
- cost per approved asset
- AI-look failure rate
- role fit by channel

Only then lock longer-term routing.
