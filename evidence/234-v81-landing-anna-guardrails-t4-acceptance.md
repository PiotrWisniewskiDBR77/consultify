# V8.1 Evidence - Landing Anna guardrails T4 Acceptance

Date: 2026-03-26
Lane: `Landing Anna guardrails`
Taxonomy: `T4`
Status: `accepted`

## Acceptance basis

This bounded `Landing Anna guardrails` lane is ready for `T4` acceptance because the live Anna runtime and landing widget now
honor the contract-required rate-limit guardrail.

1. `POST /api/public/anna/chat` now enforces a bounded per-session limit
2. the runtime returns a polite CTA-oriented `429` message instead of failing silently
3. `AnnaAssistantWidget` now surfaces that message directly on the landing surface
4. focused route and widget regressions prove the guardrail and surface behavior

## Why this is sufficient

The lane was scoped as one bounded guardrail cut, not as a full Anna governance program. Within that scope, the missing
rate-limit contract is now real on both runtime and active surface.

Any future unsupported-language, analytics, prompt-quality, or broader landing breadth remains visible backlog and should only
re-enter execution through a separate explicit promotion.

## Evidence chain

1. `evidence/232-v81-landing-anna-guardrails-split-brain-map.md`
2. `evidence/233-v81-landing-anna-guardrails-rate-limit-seam.md`
