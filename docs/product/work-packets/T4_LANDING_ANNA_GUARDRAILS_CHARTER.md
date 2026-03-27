# T4 Charter - Landing Anna guardrails

Date: 2026-03-26
Lane: `Landing Anna guardrails`
Taxonomy: `T4`
Tranche: `Parking lot`
Status: `done`

## Why now

`Landing Anna handoff` closed the visible CTA contract on the widget surface, but one bounded governance gap still remained:
the Anna public contract requires per-session rate limiting with a polite redirect to static CTA paths, while the live
`/api/public/anna/chat` route had no Anna-specific limiter and the widget collapsed non-`200` responses into a generic error.

## Goal

Promote one bounded `Landing Anna guardrails` slice that reduces mixed truth across:

1. Anna's public contract requirement for per-session abuse protection
2. the live `/api/public/anna/chat` runtime behavior
3. the landing widget's visible handling of Anna rate-limit responses

## In scope

1. one bounded Anna guardrail packet
2. split-brain map for contract-vs-runtime rate-limit truth
3. per-session rate limiting on `POST /api/public/anna/chat`
4. polite rate-limit message surfaced on the live widget
5. tracker/program/evidence updates

## Explicitly out of scope

1. unsupported-language handling
2. prompt or retrieval redesign
3. analytics/reporting breadth for Anna conversations
4. broader landing placement, copy, or visual work

## Packet 1

Completed:

- add bounded per-session rate limiting to `POST /api/public/anna/chat`
- return a polite handoff-oriented message on `429`
- surface that rate-limit message in `AnnaAssistantWidget` instead of falling back to a generic error
- add focused route and widget regressions

Recorded in:

- `evidence/232-v81-landing-anna-guardrails-split-brain-map.md`
- `evidence/233-v81-landing-anna-guardrails-rate-limit-seam.md`

## Acceptance

Accepted in:

- `evidence/234-v81-landing-anna-guardrails-t4-acceptance.md`

Residual visible backlog:

1. broader Anna analytics or prompt-quality work
2. broader landing IA / copy / visual-system work outside Anna guardrails
