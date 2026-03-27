# T4 Charter - Landing Anna language fallback

Date: 2026-03-26
Lane: `Landing Anna language fallback`
Taxonomy: `T4`
Tranche: `Parking lot`
Status: `done`

## Why now

`Landing Anna guardrails` closed per-session rate limiting, but one bounded contract gap still remained: the Anna public
contract requires an English fallback note when the visitor writes in a language other than PL or EN, while the live runtime
still tried to continue the normal conversation path without any explicit unsupported-language handling.

## Goal

Promote one bounded `Landing Anna language fallback` slice that reduces mixed truth across:

1. Anna's public unsupported-language contract
2. the live `/api/public/anna/chat` runtime behavior
3. the landing widget's visible handling of unsupported-language fallback

## In scope

1. one bounded unsupported-language packet
2. split-brain map for contract-vs-runtime language fallback truth
3. bounded unsupported-language detection for the public Anna route
4. English fallback note returned and surfaced in the widget
5. tracker/program/evidence updates

## Explicitly out of scope

1. broader multilingual expansion beyond PL + EN
2. prompt or retrieval redesign
3. Anna analytics or placement breadth
4. broader landing copy or visual-system work

## Packet 1

Completed:

- add bounded unsupported-language fallback handling to `POST /api/public/anna/chat`
- return an English note that points the visitor back to supported languages and public CTA paths
- surface that note in `AnnaAssistantWidget`
- add focused route and widget regressions

Recorded in:

- `evidence/236-v81-landing-anna-language-fallback-split-brain-map.md`
- `evidence/237-v81-landing-anna-language-fallback-seam.md`

## Acceptance

Accepted in:

- `evidence/238-v81-landing-anna-language-fallback-t4-acceptance.md`

Residual visible backlog:

1. broader Anna analytics, prompt-quality, or placement work
2. broader landing IA / copy / visual-system work outside Anna language fallback
