# 545 - Wave 1 mind map connect-exit closeout

Date: 2026-03-28
Lane: first-tranche `must have` / `Mind map`
Status: code landed, awaiting deploy-backed manual re-check

## Problem

During live manual acceptance of `My Work -> Ideas -> Mind map` on `https://consultify.ai/my-work`, connect-mode exit still behaved ambiguously:

- clicking `Connect` a second time did not visibly leave connect mode,
- clicking empty canvas did leave connect mode, but the surface appeared to land in `pan` rather than `select`,
- and the pointer-mode tooltip reused pan copy while connect mode was active, making the state harder to trust during testing.

That meant the intended Packet 6 grammar was still not provably honest on the live surface.

## What landed

- added `stabilizeMindmapInteractionMode()` in `src/components/MyWork/mindmap/mindmapInteractionGrammar.ts`
- routed both toolbar-triggered and canvas-triggered mindmap mode changes through the same stabilization path in `src/components/MyWork/IdeaMapWorkspace.tsx`
- explicitly collapse any accidental `connect -> pan` transition back to `select`
- added connect-specific pointer tooltip copy so the pointer button no longer pretends the surface is in pan while connect mode is active
- updated the tiny mode badge to show `LNK` in connect mode instead of reusing the select/pan shorthand

## Verification

Automated:

- `npx vitest run tests/unit/mindmap/mindmapInteractionGrammar.test.ts tests/unit/mindmap/canvasLeftToolbar.test.tsx`

Result:

- `11 / 11` tests passed

Coverage added/expanded for:

- explicit connect-button exit contract
- connect-specific pointer-mode copy
- stabilization of accidental `connect -> pan` transitions

Static:

- `ReadLints` on touched files returned no diagnostics

## Manual status

Hosted manual acceptance previously reproduced the blocker.

This fix is now in code, but the live module gate still needs a post-deploy re-run to confirm:

1. second click on `Connect` returns to `select`
2. click on empty canvas returns to `select`, not `pan`
3. active pointer/help copy accurately reflects connect mode

## Why this matters

The mind map lane was already close to acceptable, but interaction grammar must be exact in Wave 1. A user should never have to guess whether they are selecting, panning, or connecting after leaving a transient mode.
