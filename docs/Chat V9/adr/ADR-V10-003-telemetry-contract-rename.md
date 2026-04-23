# ADR-V10-003: Rename the telemetry contract from V9 to V10 in-place, triggered by first V10 event

- **Status:** Accepted (2026-04-18)
- **Decision-makers:** CTO, product lead
- **Master plan row:** D-3 · [§10](../CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md#sec-10-open-decisions)

## Context

The current telemetry contract file is
`docs/Chat V9/CHAT_V9_TELEMETRY_CONTRACT_2026-04-18.md`. V10 adds 8
new event families (`reasoning.*`, `learning.*`, `agent.*`,
`research.*`, `artifact.*`, `connect.*`, `outcome.*`, `onboard.*`)
plus extensions to existing V9 families.

We must decide whether to:
- maintain two separate contract files (V9 + V10),
- rename the existing file to V10 and extend it in place, or
- keep the V9 filename and add V10 content under it.

## Options considered

- **Option A (chosen):** Rename `CHAT_V9_TELEMETRY_CONTRACT_*.md` →
  `CHAT_V10_TELEMETRY_CONTRACT_*.md` in place. Extend with new V10
  event families. Git `mv` preserves history; a single file remains
  the SSoT.
- **Option B:** Two parallel files, `CHAT_V9_TELEMETRY_CONTRACT_*.md`
  (frozen) + `CHAT_V10_TELEMETRY_CONTRACT_*.md` (new).
- **Option C:** Keep V9 filename forever, add V10 families as new
  headings.

## Decision

The rename happens in-place. The **execution trigger** is explicit:
the rename lands in the same PR as the first V10 flag that declares a
telemetry event. Until then, the file keeps its V9 name so that V9
invariants (which read the file by hard-coded path) stay green.

## Rationale

- **Event families do not collide.** V9 events (`voice_*`, `trust_*`,
  `pii_*`, `navigation_*`, `private_*`) are a disjoint namespace from
  V10 families. Merging the index yields no conflicts.
- **Single SSoT beats two.** The telemetry contract exists so on-call
  can answer "where does event X live?" in one Ctrl-F. Splitting the
  file forces a two-step lookup and doubles the cross-reference
  surface (every event must appear in either file + the registry).
- **Git history continuity.** `git mv` preserves blame so the
  provenance of each event section is visible — valuable for events
  that cross the V9→V10 boundary.
- **Option C rejected:** keeping the V9 name after V10 is shipping is
  misleading and breaks naming symmetry with `CHAT_V10_IMPLEMENTATION_PLAN_*.md`.

## Consequences

- The rename PR must update:
  - V9 taxonomy invariant regex (currently
    `/^CHAT_V9_TELEMETRY_CONTRACT_\d{4}-\d{2}-\d{2}\.md$/`) to
    `/^CHAT_V1[09]_TELEMETRY_CONTRACT_\d{4}-\d{2}-\d{2}\.md$/` — or
    simpler, replace with `/^CHAT_V10_TELEMETRY_CONTRACT_.../` once
    the rename lands.
  - V9 test invariant 7 (`readFileSync(...CHAT_V9_TELEMETRY_CONTRACT_...)`)
    to read the V10 filename.
  - V9 invariant 20 / 28 (dev-plan Cross-refs block) — the `> **Cross-refs:**`
    snippet in every V9 dev plan cites the V9 contract filename.
    These must be swept in the same PR.
- Until the rename, V9 invariants continue to reference the V9 file;
  V10 dev plans already cite `CHAT_V10_TELEMETRY_CONTRACT_2026-04-18.md`
  as their future target (noted in each plan's Cross-refs block).
- Post-rename, V9 and V10 flags share the same `FunnelEventName`
  union in `src/services/funnelAnalytics.ts`; V10 extensions are
  appended to the union in the same PR.

## Execution notes

- **Tripwire:** the rename must not land before the first V10 flag
  with a non-empty `telemetry[]` array is ready to merge. Landing
  earlier leaves a 1000-line V10-named file with only V9 content,
  which confuses readers for zero gain.
- **Atomicity:** rename + V9 invariant sweep + V10 flag landing must
  be one PR. Splitting them guarantees a CI-red window on `develop`.
- **Post-rename reversal:** if the rename must be reverted, a new ADR
  supersedes this one. A `git mv` back is mechanical.
