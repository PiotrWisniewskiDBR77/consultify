# T2 Charter - Multiplayer / Collaboration

Date: 2026-03-26
Lane: `Multiplayer / collaboration`
Taxonomy: `T2`
Tranche: `Tranche 2`
Status: `done`

## Why now

`Partner Program` is now accepted as the previous active `T2` lane. `Multiplayer / collaboration` is the
next highest-value parked candidate because it already has a governed V8 multiplayer read bridge,
documented staging continuity on the live operator surface, and a clear split between persisted V8
collaboration substrate truth and broader legacy / bespoke realtime UI behavior.

## Goal

Promote one bounded multiplayer parity slice that reduces mixed truth across:

- governed collaboration substrate and room-binding truth
- visible collaboration indicators on active workspace surfaces
- bounded V8-first collaboration continuity before broader websocket and co-editing breadth

## In scope

1. multiplayer/collaboration workflow consistency on one bounded surface at a time
2. split-brain map for frontend surfaces, runtime contracts, and evidence
3. one bounded multiplayer packet at a time
4. tracker/program/evidence updates after each packet

## Explicitly out of scope

1. full websocket transport migration
2. broad collaborative editing semantics in one packet
3. broad room lifecycle redesign
4. broad legacy collaboration helper retirement

## Initial bounded packet

Packet 1:

- add governed V8-first collaboration presence indicators to one active workspace tool header surface
- prefer existing `/api/v8/multiplayer` room-binding and presence truth instead of bespoke per-surface polling where feasible
- keep realtime heartbeats, co-editing semantics, and lock-mutation breadth outside this packet

Why this first:

- smallest visible collaboration UI slice that can build on the existing governed V8 read bridge
- closes a real operator/user-facing indicator seam without claiming full multiplayer parity
- aligns with `V8_UI_WIRING_QUEUE.md` `UI-09` while keeping scope bounded to one header-level indicator slice

Recorded in:

- `evidence/164-v81-multiplayer-collaboration-split-brain-map.md`

## Packet 1

Completed:

- add governed V8-first collaboration presence indicators to the `IdeaTableTool` workspace header surface
- resolve workspace room binding and persisted presence through `/api/v8/multiplayer` under `v8_multiplayer_enabled`
- keep legacy idea-level polling only as a compatibility path for existing `CellCursor` semantics rather than the visible header indicator

Recorded in:

- `evidence/165-v81-multiplayer-header-presence-v8-seam.md`

## Next bounded candidate

1. no further packet inside the current bounded `T2` lane
2. any next multiplayer work now belongs to broader realtime transport or editing-semantics parity, not the accepted header-indicator slice

## Packet 2

Completed:

- add governed V8-first workspace lock indicators to the same active `IdeaTableTool` header surface
- resolve active locks through `/api/v8/multiplayer` workspace room binding and room lock reads
- keep scope bounded to visible lock awareness without broadening into lock acquire/release mutation parity

Recorded in:

- `evidence/166-v81-multiplayer-lock-indicator-v8-seam.md`

## Acceptance decision

`Multiplayer / collaboration` is accepted as bounded `T2` complete.

Why acceptance is justified:

1. the governed V8 multiplayer bridge already had live operator-facing proof for workspace presence and active locks
2. the active `IdeaTableTool` header now exposes one coherent governed V8-first collaboration indicator slice for both presence and locks
3. the remaining realtime transport, heartbeat/write, and fine-grained co-editing semantics were explicitly out of scope for this bounded lane and are now treated as broader parity work

Recorded in:

- `evidence/167-v81-multiplayer-collaboration-t2-acceptance.md`
