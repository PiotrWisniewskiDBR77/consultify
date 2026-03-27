# V8.1 Chat Execution / Retrieval Surface Seam

Date: 2026-03-26
Lane: `Chat`
Taxonomy: `T2`
Status: `active`

## Goal

Extend the governed V8 chat spine into one real active chat-surface happy path so execution and retrieval
controls no longer depend on pre-existing hidden snapshot state.

## What changed

1. Governed chat-surface snapshot entry
   - updated `src/components/AIChat/UnifiedChatPanel.tsx`
   - updated `src/components/AIChat/V8ArtifactRunControl.tsx`
   - the active chat panel now derives a bounded governance context and passes it into the existing governed
     output-planning control
   - `V8ArtifactRunControl` now exposes a governed `Capture V8 snapshot` action when the conversation has valid
     chat governance context but no prior snapshot

2. Existing governed execution and retrieval controls now form one usable chain
   - `V8ArtifactRunControl` no longer behaves like a disabled shell for snapshot-less conversations
   - once a snapshot is captured, the same active chat surface can immediately continue into governed artifact
     planning/execution
   - `V8ContextIndicator` remains the readback surface for governed snapshot and retrieval evidence on the
     same chat header strip

3. Regression coverage
   - extended `tests/components/AIChat/V8ArtifactRunControl.test.tsx`
   - kept `tests/components/AIChat/V8ContextIndicator.test.tsx` green for the readback surface

## Why this matters

This closes the first bounded chat split-brain slice on the live chat surface:

- the governed V8 chat spine is now reachable from the active chat panel instead of being mostly passive
  read-side infrastructure
- governed retrieval evidence and governed execution planning now share a real entry point on the same
  operator-facing surface
- the packet stays bounded to snapshot-entry and active-surface continuity without broadening into full
  chat-send or AI-core parity

## Verification

Passed:

- `tests/components/AIChat/V8ArtifactRunControl.test.tsx`
- `tests/components/AIChat/V8ContextIndicator.test.tsx`

Verification command:

`npx vitest run tests/components/AIChat/V8ArtifactRunControl.test.tsx tests/components/AIChat/V8ContextIndicator.test.tsx`

Result: `8` tests passing.

## Residual note

Conversation-scoped governed handoff history and broader chat-send / AI-core path unification still remain
outside this packet, so `Chat` stays active after this seam lands.
