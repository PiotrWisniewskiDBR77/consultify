# T2 Charter - Chat

Date: 2026-03-26
Lane: `Chat`
Taxonomy: `T2`
Tranche: `Tranche 2`
Status: `done`

## Why now

`Notes` adjuncts are now accepted as the previous active bounded lane. `Chat` is the next highest-value
parked candidate because governed V8 chat runtime pieces already exist, visible V8 chat indicators already
exist on the live chat surface, and the remaining gap is now a bounded mixed-truth seam between that governed
chat spine and the broader happy-path chat chain.

## Goal

Promote one bounded chat parity slice that reduces mixed truth across:

- governed V8 chat runtime and visible chat-side V8 indicators
- chat-to-execution and chat-to-retrieval continuity on the active chat surface
- bounded V8-first chat continuity before broader AI-core and chat-send breadth

## In scope

1. chat workflow consistency on one bounded surface at a time
2. split-brain map for frontend surfaces, runtime contracts, and evidence
3. one bounded chat packet at a time
4. tracker/program/evidence updates after each packet

## Explicitly out of scope

1. broad chat composer/send architecture rewrite in one packet
2. full AI-core parity or operator tooling rollout in the same lane
3. broad prompt/provider lifecycle work
4. broad legacy chat helper retirement beyond the bounded happy-path seam

## Initial bounded packet

Packet 1:

- add one governed V8-first closure slice for chat-execution-retrieval continuity on the active chat surface
- extend the already-proven V8 chat spine (`snapshots`, `handoffs`, `bindings`) into one coherent happy-path
  chain used by the live chat panel
- keep broad AI-core exposure, provider lifecycle, and deeper chat-send breadth outside this first packet

Why this first:

- it matches the existing ledger next packet `B-02 chat-execution-retrieval closure`
- it is the smallest user-facing slice that builds on existing V8 chat routes, hooks, and indicators
- it reduces real mixed truth on the live chat surface without claiming complete chat or AI-core parity

Recorded in:

- `evidence/172-v81-chat-split-brain-map.md`

## Packet 1

Completed:

- add one governed V8-first closure slice for chat-execution-retrieval continuity on the active chat surface
- let the active `UnifiedChatPanel` derive a bounded governance context for the existing V8 chat controls
- let `V8ArtifactRunControl` capture a governed V8 snapshot directly from the live chat surface before output planning

Recorded in:

- `evidence/173-v81-chat-execution-retrieval-surface-seam.md`

## Packet 2

Completed:

- add one governed handoff readback slice on the active chat surface so conversation-scoped V8 handoff continuity is visible in the same lane
- extend `V8ContextIndicator` to read governed handoffs for the active conversation
- surface latest governed handoff goal, intent classification, and execution run reference in the active chat header strip

Recorded in:

- `evidence/174-v81-chat-handoff-readback-seam.md`

## Packet 3

Completed:

- add one governed handoff creation slice on the active chat surface so the same lane can create, not only read,
  V8 handoffs
- extend `V8ContextIndicator` to create a governed handoff from the latest active conversation snapshot and goal
- keep the create CTA on the same governed header strip as the snapshot and handoff readback surfaces

Recorded in:

- `evidence/175-v81-chat-handoff-creation-seam.md`

## Acceptance decision

Accepted for bounded `T2` completion.

Why acceptance is justified now:

1. the active chat surface now exposes a coherent governed V8 continuity chain for snapshot entry, handoff readback,
   and handoff creation
2. the remaining asks are broader chat composer/send-path and adjacent `AI core` breadth, not absence of a bounded
   governed V8 chat surface

Acceptance evidence:

- `evidence/176-v81-chat-t2-acceptance.md`

## Next bounded candidate

1. none inside the current bounded `Chat` lane
2. any further `Chat` work is broader parity expansion and should only be promoted explicitly if priorities change
