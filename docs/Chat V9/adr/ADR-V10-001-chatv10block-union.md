# ADR-V10-001: Introduce `ChatV10Block` as a new union, do not extend `ChatV9Block`

- **Status:** Accepted (2026-04-18)
- **Decision-makers:** CTO, product lead
- **Master plan row:** D-1 · [§10](../CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md#sec-10-open-decisions)

## Context

V9 shipped with a 5-value `ChatV9Block` union (`voice | trust |
navigation | input | admin`) driving the admin-panel grouper, the
runbook §4 table, and the dev-plan cross-references. V10 introduces 8
new blocks (`reasoning`, `learning`, `agent_runtime`, `research`,
`artifact`, `connectors`, `outcome`, `onboarding`) whose semantics do
not overlap with any V9 block — V9 is about per-feature guardrails
shipped inside the chat surface; V10 is about the full runtime (agent,
reasoning, memory, connectors, outcome, research).

We must decide whether V10 extends the existing enum (13-value union)
or introduces a parallel `ChatV10Block` type.

## Options considered

- **Option A (chosen):** Introduce a new `ChatV10Block` union.
  V9 block enum stays as-is; V9 flags continue to use it until each V9
  block is subsumed by a V10 equivalent (or explicitly retired).
- **Option B:** Extend `ChatV9Block` to 13 values.
  A single union for all flags, V9 + V10, ordered by historical
  arrival.
- **Option C:** Replace `ChatV9Block` with `ChatV10Block` and migrate
  all V9 flags to the new 8-value taxonomy.
  Requires remapping every V9 block to one of the V10 values, which
  is semantically lossy (e.g. `voice` does not cleanly map to any V10
  block; `admin` could be split between `outcome` and `connectors`).

## Decision

A new `ChatV10Block` union lives in `chatV10FeatureFlags.ts` with
exactly 8 values. `ChatV9Block` stays in `chatV9FeatureFlags.ts`. V9
flags keep using V9 block; V10 flags use V10 block. Neither union
imports the other.

## Rationale

- **Clean lifecycle split.** V9 flags have their own deprecation cadence
  (each gets retired once its feature ships by default or is removed).
  V10 flags have a fresh default-off rollout policy. Mixing the two
  unions forces every consumer (grouper, runbook, filter) to special-
  case "is this V9 or V10?" — better to keep them separate and let the
  consumer decide which registry to iterate.
- **Semantic non-overlap.** V9 blocks are UI-feature categories (voice,
  trust badge, input). V10 blocks are runtime subsystems (reasoning,
  learning, outcome). Forcing them into one taxonomy loses either
  resolution or coherence.
- **Reviewable diffs.** A flag landing in V10 only touches V10 registry
  + tests. A flag retiring in V9 only touches V9 registry + tests.
  A combined enum means every V10 PR also touches V9 test snapshots.
- **Cheap reversal.** If experience shows overlap is needed, a future
  ADR can introduce a `type ChatBlock = ChatV9Block | ChatV10Block`
  convenience alias without changing either source union. The inverse
  (splitting a merged union) is harder.

## Consequences

- `chatV10FeatureFlags.ts` declares its own `ChatV10Block` union;
  `chatV9FeatureFlags.ts` is untouched.
- CI invariant 33 (master plan §6.1) constrains V10 flags to the
  8-value union; no symmetric invariant enforces V9–V10 separation —
  the type system does that at compile time.
- The admin panel grouper must iterate both registries when rendering
  the unified flags view (currently not a problem; Hub UI already
  filters by `block`).
- A "V9 block retired" operation does not require a migration of V10 —
  the unions are independent.

## Execution notes

- Implemented in scaffolding pass V10-00 (2026-04-18).
- The master plan §1.1 fenced `export type ChatV10Block = ...` block is
  parsed by `chatV10FeatureFlags.test.ts` and compared against the
  runtime value — changing either without the other fails CI.
