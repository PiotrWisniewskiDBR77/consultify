# ADR-V10-002: Split the flag registry — new `chatV10FeatureFlags.ts` + shared helpers

- **Status:** Accepted (2026-04-18)
- **Decision-makers:** CTO, product lead
- **Master plan row:** D-2 · [§10](../CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md#sec-10-open-decisions)

## Context

V9 ships ~50 flags in a single `chatV9FeatureFlags.ts` file with ~1000
LoC. V10 forecasts ~188 flags (8 blocks × ~24 tickets/block) at full
buildout. Adding V10 flags to the existing V9 file would grow it to
~4000 LoC, slow every registry test that reads the file, and produce
monolithic PR diffs that a reviewer cannot sensibly scan.

We must decide how to physically organise the V10 registry.

## Options considered

- **Option A (chosen):** New file `chatV10FeatureFlags.ts` + a shared
  helpers module `chatFlagsShared.ts` for generic utilities (write,
  read, encode) that both registries consume.
- **Option B:** Keep one file (`chatV9FeatureFlags.ts`) and append all
  V10 flags.
- **Option C:** One file per block (8 V10 files). Loaded into a common
  index via a barrel export.

## Decision

V10 gets its own `chatV10FeatureFlags.ts`. Cross-registry utilities
(localStorage writer, override state reader, override state encoder)
live in `chatFlagsShared.ts`. V9 file is left in place with its
inlined helpers — the V9 helpers will migrate to the shared module in
a separate pass once V9 tests are de-risked.

## Rationale

- **Reviewable PR diffs.** A V10 flag PR touches `chatV10FeatureFlags.ts`
  + a per-flag helper + the V10 test file. A V9 flag PR touches V9 only.
  No cross-contamination.
- **Test performance.** The V9 registry test reads every descriptor
  + parses several doc files for invariant 9 / 24 / 27. Doubling the
  registry doubles test runtime. Split registries keep each test ≤ 2s.
- **Ownership clarity.** V9 is maintained by the chat-surface team
  (voice, trust, input). V10 is maintained by the runtime team
  (agent, reasoning, memory). Separate files make CODEOWNERS
  enforcement precise.
- **Option C rejected:** 8 block files force cross-file imports for
  every consumer (grouper, admin panel, test) and multiply the surface
  area that can drift. V10 is a closed taxonomy (no new blocks without
  an ADR); the single-file cost is bounded.

## Consequences

- `chatFlagsShared.ts` is the SSoT for write-side helpers. V9 and V10
  registries both delegate through it; neither can drift (e.g. V9
  writing `'true'` while V10 writes `'1'`).
- V9 inlined helpers are grandfathered for now. A follow-up pass
  (tracked informally; not an ADR) will migrate V9 to the shared module
  once V9 resolver-contract tests are guaranteed to catch any
  refactor-induced drift.
- The admin Hub UI continues to support both registries by iterating
  each independently.
- The telemetry contract doc remains single (see ADR-V10-003 for the
  rename policy).

## Execution notes

- Implemented in scaffolding pass V10-00 (2026-04-18).
- Follow-up migration ("V9 helpers → chatFlagsShared") is tracked as a
  maintenance task; no ADR change needed unless the decision to
  migrate is itself reversed.
