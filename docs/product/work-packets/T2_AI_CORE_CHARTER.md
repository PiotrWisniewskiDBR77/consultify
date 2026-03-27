# T2 Charter - AI core

Date: 2026-03-26
Lane: `AI core`
Taxonomy: `T2`
Tranche: `Tranche 2`
Status: `done`

## Why now

`Chat` is now accepted as the previous active bounded lane. `AI core` is the next highest-value parked candidate because
the governed V8 runtime already exists under `/api/v8/ai-core`, smoke/runtime coverage already proves the bounded read
contract, and the clearest remaining gap is operator-facing surface exposure rather than missing backend capability.

## Goal

Promote one bounded `AI core` parity slice that reduces mixed truth across:

- governed V8 AI-core runtime and the operator-facing AI Platform surface
- existing runtime reads (`environment`, `tools`, later `policy`) and a real live panel that uses them
- bounded operator exposure before any broader chat-send or trust-workflow expansion

## In scope

1. read-only operator-facing `AI core` continuity on one bounded surface at a time
2. split-brain map for frontend surfaces, runtime contracts, and evidence
3. one bounded `AI core` packet at a time
4. tracker/program/evidence updates after each packet

## Explicitly out of scope

1. broad chat composer/send-path expansion
2. full trust/provenance workflow rollout in one packet
3. deeper AI operations lifecycle or policy-write tooling
4. broader prompt/provider/runtime programs already tracked elsewhere

## Initial bounded packet

Packet 1:

- add one read-only governed operator exposure slice for `AI core` runtime summary in `AI Platform -> Operations`
- surface governed `/api/v8/ai-core/environment` and `/api/v8/ai-core/tools` on the live superadmin surface
- keep tool-policy drilldown, provenance, and chat-turn expansion outside this first packet

Why this first:

- it matches the ledger direction of `B-02 ai-core exposure completion`
- it is the smallest visible user/operator slice that proves `AI core` is not only a hidden runtime
- it uses an existing `Prompt OS runtime` operations-tab pattern instead of inventing a new surface

Recorded in:

- `evidence/177-v81-ai-core-split-brain-map.md`

## Packet 1

Completed:

- add one read-only governed operator exposure slice for the `AI core` runtime summary in `AI Platform -> Operations`
- surface governed environment status and tool catalog through a dedicated `AI core runtime` operations tab
- add bounded regression for the new operator-facing V8 panel and operations-tab routing

Recorded in:

- `evidence/178-v81-ai-core-runtime-operator-exposure-seam.md`

## Packet 2

Completed:

- add one bounded governed tool-policy readback slice on the same operator surface so the panel can explain not only
  which tools exist, but how they are governed
- let `AICoreRuntimePanel` read effective governed policy for the selected tool under `consumerClass=chat`
- keep the policy drilldown on the same read-only operator surface as the runtime summary and tool catalog

Recorded in:

- `evidence/179-v81-ai-core-tool-policy-readback-seam.md`

## Acceptance decision

Accepted for bounded `T2` completion.

Why acceptance is justified now:

1. the active operator surface now exposes a coherent governed V8 read chain for runtime summary, tool catalog, and
   tool-policy readback
2. the remaining asks are broader trust/provenance, chat-turn, and AI-operations breadth, not absence of a bounded
   governed `AI core` surface

Acceptance evidence:

- `evidence/180-v81-ai-core-t2-acceptance.md`

## Next bounded candidate

1. none inside the current bounded `AI core` lane
2. any further `AI core` work is broader parity expansion and should only be promoted explicitly if priorities change
