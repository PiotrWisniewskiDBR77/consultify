# V8.1 Evidence - Landing Anna degraded fallback T4 Acceptance

Date: 2026-03-26
Lane: `Landing Anna degraded fallback`
Taxonomy: `T4`
Status: `accepted`

## Acceptance basis

This bounded `Landing Anna degraded fallback` lane is ready for `T4` acceptance because the live Anna runtime and widget now
honor the contract-defined AI-unavailable message.

1. the public Anna route now returns the static unavailable message when providers are down
2. the widget now shows the same message when the request fails before reaching the backend
3. visible CTA controls remain available on the landing surface
4. focused route and widget regressions prove both degraded paths

## Why this is sufficient

The lane was scoped as one bounded degraded-state continuity cut, not as a broader Anna resilience or voice-mode program.
Within that scope, the service-unavailable split-brain is closed.

Any future voice-mode degraded handling, analytics, prompt-quality, or placement work remains visible backlog and should only
re-enter execution through a separate explicit promotion.

## Evidence chain

1. `evidence/240-v81-landing-anna-degraded-fallback-split-brain-map.md`
2. `evidence/241-v81-landing-anna-degraded-fallback-seam.md`
