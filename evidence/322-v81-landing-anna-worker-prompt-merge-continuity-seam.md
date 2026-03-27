# V8.1 Evidence - Landing Anna worker prompt merge continuity seam

Date: 2026-03-26
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: `Landing Anna prompt-quality / retrieval-quality`
Packet: `Landing Anna worker prompt merge continuity`
Status: `landed`

## Seam closed

The third bounded quality packet now closes the worker-prompt merge continuity seam for public Anna.

## What changed

1. `server/src/routes/public-anna.routes.ts` now builds the final Anna runtime instruction through a dedicated `buildAnnaRuntimeInstruction()` seam
2. worker-specific `system_prompt` content is now treated as an addon, not as a replacement for the base Anna public contract
3. the base Anna contract still stays present in the final runtime instruction: public role, current-surface framing, language rules, and retrieved knowledge context
4. `server/src/routes/v8/__tests__/public-anna.routes.test.ts` now proves that the base Anna public contract remains in place even when worker prompt overrides are present

## Why this packet matters

Before this packet:

1. worker prompt configuration could replace the public Anna contract
2. that created a quality and consistency risk between LP contract truth and runtime prompt truth

After this packet:

1. worker prompt customization can refine Anna
2. but it no longer silently displaces the core public Anna behavior
3. prompt quality stays aligned with the LP contract instead of drifting into worker-only truth

## Lane state after this packet

The broader `Landing Anna prompt-quality / retrieval-quality` lane remains active.

The next step is to assess the next smallest prompt or retrieval quality residual after:

1. locale-aware retrieval quality
2. follow-up retrieval continuity
3. worker prompt merge continuity

are all landed.
