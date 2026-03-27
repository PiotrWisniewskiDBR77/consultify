# V8.1 Evidence - AI core Tool Policy Readback Seam

Date: 2026-03-26
Lane: `AI core`
Taxonomy: `T2`
Packet: `B-02b ai-core tool-policy readback continuity`

## Goal

Close the remaining bounded read-side gap on the promoted `AI core` operator surface by letting the active
`AI core runtime` panel explain not only which governed tools exist, but also the effective governance policy for the
selected tool.

## What changed

1. Extended `AICoreRuntimePanel` so the governed tool catalog is now an interactive read-only selector.
2. The panel now reads `GET /api/v8/ai-core/tools/:toolId/policy` for the selected governed tool under
   `consumerClass=chat`.
3. The same operator surface now renders the effective policy summary, including:
   - policy state
   - approval class
   - allowed flag
   - approval override
   - max invocations per run
   - policy reference
   - block reason
4. Added bounded regression covering both initial policy hydration and policy switching when a different governed tool
   is selected.

## Why it matters

Before this packet, `AI core` already had a bounded operator-facing runtime summary and tool catalog, but the live
surface still stopped short of explaining how those tools were governed.

After this packet, the active `AI core runtime` operator surface now provides a coherent read-only continuity chain for:

- environment status
- governed tool catalog
- effective tool-policy readback

without broadening into write controls or wider AI-core workflow expansion.

## Verification

- `npx vitest run tests/components/Admin/AI/AICoreRuntimePanel.test.tsx tests/components/SuperAdmin/AIPlatformModule.test.tsx`

## Residual risk

- Trust/provenance exposure remains outside this bounded lane.
- Broader chat-turn and AI-operations lifecycle work remain broader parity expansion, not a blocker for this packet.
