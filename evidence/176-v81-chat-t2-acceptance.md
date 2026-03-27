# V8.1 Evidence - Chat T2 Acceptance

Date: 2026-03-26
Lane: `Chat`
Taxonomy: `T2`
Decision: `accepted`

## Acceptance basis

The promoted bounded `Chat` lane is now accepted because the active chat surface has a coherent governed V8 continuity
chain for the scoped seam that justified promotion:

1. snapshot entry is available directly from the live chat surface via `V8ArtifactRunControl`
2. conversation-scoped governed handoff readback is visible on the same live chat header strip
3. governed handoff creation is now available on that same active chat surface through `V8ContextIndicator`
4. targeted regression covers the bounded create/read surface chain

This closes the specific mixed-truth question that promoted `Chat` into active `T2`: whether the live chat surface
could use the governed V8 chat spine for one bounded happy-path continuity chain rather than only exposing passive
indicators.

## Accepted bounded scope

Accepted now:

- active-surface governed snapshot entry
- active-surface governed handoff readback
- active-surface governed handoff creation

Explicitly not required for this bounded acceptance:

- broad chat composer/send-path parity
- broader AI-core/operator exposure
- wider workflow expansion beyond the bounded chat header/control seam

## Evidence chain

- `evidence/172-v81-chat-split-brain-map.md`
- `evidence/173-v81-chat-execution-retrieval-surface-seam.md`
- `evidence/174-v81-chat-handoff-readback-seam.md`
- `evidence/175-v81-chat-handoff-creation-seam.md`

## Verification

- `npx vitest run tests/components/AIChat/V8ContextIndicator.test.tsx tests/components/AIChat/V8ArtifactRunControl.test.tsx`

## Residual follow-up

Any further `Chat` work is now broader parity work, not a blocker for the bounded accepted lane. The clearest adjacent
candidate remains a separate `AI core` or broader chat send-path promotion if the finish path changes later.
