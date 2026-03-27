# V8.1 Chat Handoff Readback Seam

Date: 2026-03-26
Lane: `Chat`
Taxonomy: `T2`
Status: `active`

## Goal

Surface conversation-scoped governed handoff readback on the active chat surface so the same header strip that
already shows governed snapshots and retrieval evidence also exposes existing V8 handoff continuity.

## What changed

1. Governed handoff readback on the active chat surface
   - updated `src/components/AIChat/V8ContextIndicator.tsx`
   - the governed chat context indicator now also reads `useV8Handoffs()` for the active conversation
   - the active chat header now shows a compact governed handoff badge and a panel summary for the latest
     handoff goal, intent classification, and execution run id

2. Unified governed evidence strip
   - the same `V8ContextIndicator` surface now aggregates three conversation-scoped governed reads:
     snapshots, retrieval traces, and chat handoffs
   - this keeps the packet bounded to readback continuity without changing how handoffs are created

3. Regression coverage
   - extended `tests/components/AIChat/V8ContextIndicator.test.tsx`
   - kept `tests/components/AIChat/V8ArtifactRunControl.test.tsx` green for the adjacent governed chat control

## Why this matters

This closes the second bounded chat split-brain slice on the live chat surface:

- governed handoff continuity is now visible on the active chat surface instead of remaining an unseen V8-only
  route family
- the governed chat header strip now reflects snapshots, retrieval evidence, and handoff state in one place
- the packet stays bounded to readback continuity and does not claim full handoff creation/send-path parity

## Verification

Passed:

- `tests/components/AIChat/V8ContextIndicator.test.tsx`
- `tests/components/AIChat/V8ArtifactRunControl.test.tsx`

Verification command:

`npx vitest run tests/components/AIChat/V8ContextIndicator.test.tsx tests/components/AIChat/V8ArtifactRunControl.test.tsx`

Result: `8` tests passing.

## Residual note

The active chat surface still does not create governed handoffs directly in the same bounded lane, so
handoff creation continuity and any broader chat-send / AI-core unification remain outside this packet.
