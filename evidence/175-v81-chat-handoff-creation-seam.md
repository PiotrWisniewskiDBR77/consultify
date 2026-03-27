# V8.1 Evidence - Chat Handoff Creation Seam

Date: 2026-03-26
Lane: `Chat`
Taxonomy: `T2`
Packet: `B-02c chat handoff creation continuity`

## Goal

Close the remaining bounded active-surface gap in the promoted `Chat` lane by letting the live chat surface create
governed V8 handoffs directly from the same header strip that already exposes snapshot and handoff readback truth.

## What changed

1. `UnifiedChatPanel` now passes the current goal hint into `V8ContextIndicator`, so the governed context strip has
   the same live conversation goal that already feeds the active chat surface.
2. `V8ContextIndicator` now uses `useV8CreateHandoff()` and exposes a bounded `Create governed handoff` CTA whenever
   the active conversation already has a governed snapshot plus a non-empty goal.
3. The CTA creates the handoff from the latest governed snapshot for the active conversation, invalidates governed
   handoff queries through the existing hook behavior, and keeps the action on the same active header strip as the
   existing readback indicators.
4. Targeted component regression now covers the governed handoff creation path so the active chat surface cannot drift
   back to a read-only V8 indicator strip.

## Why it matters

Before this packet, the promoted `Chat` lane could:

- capture governed snapshots from the live chat surface, and
- read governed handoffs back on that same surface,

but it still could not create a governed handoff directly from the active chat UI. That left the bounded lane with one
remaining create/read split-brain seam.

After this packet, the active chat surface can now:

- capture governed snapshot context,
- read governed handoff state,
- and create a governed handoff against the current conversation goal

without leaving the live chat surface.

## Verification

- `npx vitest run tests/components/AIChat/V8ContextIndicator.test.tsx tests/components/AIChat/V8ArtifactRunControl.test.tsx`

## Residual risk

- Broader chat composer/send-path truth and adjacent `AI core` exposure remain outside this bounded lane.
- This packet proves active-surface continuity through targeted component regression, not fresh staging/browser proof.
