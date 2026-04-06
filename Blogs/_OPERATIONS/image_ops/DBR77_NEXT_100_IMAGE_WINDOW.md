# DBR77 Next 100 Image Window

## Purpose

This file defines the next controlled production window after the professional reset.

The next 100 images are not "business as usual."

They are a controlled test of:

- the new prompt standard
- the new visual charter
- the new AI-look QC gate
- the new multi-channel routing model

## Scope

Window size:

- `100` images total

Recommended mix:

- approximately `33` full triptychs (`99` images)
- one additional single-role comparison or reserve slot

## Main Rule

Do not optimize only for speed during this window.

Optimize for learning which channel and prompt style produce the best professional result.

## What Must Be True Before An Image Counts Toward The 100

The image counts only if:

1. it was generated under the new prompt standard
2. it was reviewed under the new QC standard
3. its channel is recorded
4. its role is recorded
5. it was judged as either `editorial_first` or `ai_first`

## What To Test

### 1. Role Fit By Channel

Test whether:

- `hero` is strongest through premium editorial channels
- `analytical` is strongest through controlled physical-construction channels
- `social` is strongest through tighter manual or premium review lanes

### 2. Prompt Family Behavior

Track which prompt families create the cleanest outcomes:

- documentary hero scenes
- physical explanatory constructions
- tight editorial crop metaphors

### 3. AI-Look Failure Modes

Track which channels drift most often into:

- dashboard aesthetics
- fake text
- synthetic material look
- over-staged concept composition
- over-clean industrial still life

## Channel Assignment For The Window

Use the routing contract from:

- `Blogs/_OPERATIONS/image_ops/DBR77_IMAGE_PROVIDER_ROUTING.md`

Working rule:

- do not let a single channel dominate all 100 images
- do not let the easiest path become the only path

## Required Logging Per Image

Record at least:

- `product`
- `slug`
- `role`
- `channel`
- `provider/model` if known
- `first_pass` or `rerender`
- `approved` or `fix_required`
- `editorial_first` or `ai_first`
- short failure note if not approved

## Required Batch Notes

At the end of each micro-batch, note:

- strongest roles
- weakest roles
- recurring drift pattern
- which prompt phrasing caused trouble
- which channel looked most believable

## Evaluation Questions At The End Of 100

At the checkpoint, answer:

1. Which channel produced the highest rate of believable `hero` images?
2. Which channel produced the lowest UI / slide drift in `analytical`?
3. Which channel produced the strongest `social` thumbnail behavior?
4. Which channel had the lowest cost per approved asset?
5. Which channel caused the highest rerender burden?
6. Which prompt family most often caused an obvious AI look?

## Decisions To Make After 100

After the window, lock:

- primary channel for `hero`
- primary channel for `analytical`
- primary channel for `social`
- fallback channel per role
- when the local runner is economically justified
- when Antygravity is the main batch lane
- when Codex or Cursor OpenAI should be reserved for premium rescue only

## What This Window Is Not

This is not:

- a pure speed sprint
- a random mix of generators
- a continuation of the old relaxed watchlist logic
- a proof that one generator should win before measurement

This is a controlled decision-making window.
