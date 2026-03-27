# V8.1 Evidence - AI core Split-Brain Map

Date: 2026-03-26
Lane: `AI core`
Taxonomy: `T2`
Status: `active`

## Why this lane is promoted now

`AI core` is the only remaining parked `T2` lane after `Chat` acceptance. The governed V8 runtime already exists and is
tested, but the live operator surface still lacks a bounded first-class read path that proves those contracts on a real
UI surface.

## Runtime truth

The governed V8 `AI core` runtime already exposes:

- `GET /api/v8/ai-core/environment`
- `POST /api/v8/ai-core/chat-turn`
- `GET /api/v8/ai-core/trust/provenance`
- `GET /api/v8/ai-core/tools`
- `GET /api/v8/ai-core/tools/:toolId/policy`

Existing route and service tests already cover those seams, and smoke proof for `environment` plus `tools` is recorded
in `evidence/05-smoke-test.json`.

## Surface truth before promotion

Before promotion:

- there was no bounded operator-facing `AI core` runtime panel comparable to the existing `Prompt OS runtime` panel
- `src/services/api/v8/ai-core.ts` existed, but had no visible live superadmin consumer for the basic runtime reads
- the lane therefore remained runtime-capable but surface-thin

## Bounded first packet

Packet `B-02 ai-core exposure completion` is narrowed to:

1. expose a read-only `AI core runtime` panel in `AI Platform -> Operations`
2. hydrate it from governed `/api/v8/ai-core/environment` and `/api/v8/ai-core/tools`
3. add bounded regression for the new operator-facing surface

## Explicitly not this packet

- trust/provenance workflow exposure
- tool policy drilldown
- chat-turn UI adoption
- broader AI operations lifecycle controls

## Why this is the right first slice

This is the smallest packet that turns `AI core` from a hidden runtime into a visible governed surface without claiming
full AI-platform parity or reopening broader chat/AI architecture work.
