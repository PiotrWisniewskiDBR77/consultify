# V8.1 Evidence - AI core Runtime Operator Exposure Seam

Date: 2026-03-26
Lane: `AI core`
Taxonomy: `T2`
Packet: `B-02 ai-core exposure completion`

## Goal

Expose one bounded read-only governed `AI core` runtime slice on a real superadmin surface so `/api/v8/ai-core`
stops being runtime-only and gains an operator-facing continuity path.

## What changed

1. Added `AICoreRuntimePanel` as a read-only superadmin panel for governed `AI core` runtime exposure.
2. The new panel loads `GET /api/v8/ai-core/environment` and `GET /api/v8/ai-core/tools`, then renders:
   - environment health
   - returned contract
   - layer status summary
   - governed tool catalog count and entries
3. Integrated the panel into `AI Platform -> Operations` as a new `AI core runtime` sub-tab beside the existing
   `Prompt OS runtime` operator surface.
4. Added bounded regression covering:
   - operations sub-tab presence and routing in `AIPlatformModule`
   - actual runtime panel hydration from the governed V8 AI-core client

## Why it matters

Before this packet, `AI core` already had governed runtime routes and smoke coverage, but no bounded live operator
surface proved those routes were wired into the product.

After this packet, the promoted `AI core` lane now has:

- a visible operator-facing read surface
- governed V8 runtime reads from the live superadmin AI platform
- regression that protects the first bounded exposure slice

## Verification

- `npx vitest run tests/components/SuperAdmin/AIPlatformModule.test.tsx tests/components/Admin/AI/AICoreRuntimePanel.test.tsx`

## Residual risk

- Tool-policy readback is still not surfaced on the same operator panel.
- Trust/provenance and broader chat-turn continuity remain outside this bounded packet.
