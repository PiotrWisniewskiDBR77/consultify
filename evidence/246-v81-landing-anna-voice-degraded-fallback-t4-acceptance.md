# V8.1 Evidence - Landing Anna voice degraded fallback T4 Acceptance

Date: 2026-03-26
Lane: `Landing Anna voice degraded fallback`
Taxonomy: `T4`
Status: `accepted`

## Acceptance basis

This bounded `Landing Anna voice degraded fallback` lane is ready for `T4` acceptance because the public Anna voice surface no
longer exposes technical setup details and now uses the same contract-safe degraded-state message as the main Anna widget path.

1. the live voice-unavailable hint now uses the static unavailable message
2. the live voice-start failure path now uses the same message
3. the public widget no longer shows visitor-facing references to browser setup or API-key configuration on the degraded voice path
4. focused widget regression proves the no-technical-details rule on the public surface

## Why this is sufficient

The lane was explicitly narrowed to a visitor-facing copy and contract-alignment cut, not to a broader Anna voice
implementation refactor. Within that scope, the voice degraded-state split-brain is closed.

Any future voice architecture, permission-handling UX, analytics, prompt-quality, or placement work remains separate visible
backlog and should re-enter execution only through a new explicit promotion.

## Evidence chain

1. `evidence/244-v81-landing-anna-voice-degraded-fallback-split-brain-map.md`
2. `evidence/245-v81-landing-anna-voice-degraded-fallback-seam.md`
