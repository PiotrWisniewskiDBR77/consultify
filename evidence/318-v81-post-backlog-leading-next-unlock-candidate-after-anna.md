# V8.1 Evidence - Leading next unlock candidate after Anna plateau

Date: 2026-03-26
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Status: `held`

## Recommendation

If Anna work is explicitly resumed, the leading next unlock candidate should be `Landing Anna prompt-quality`.

## Why this candidate leads

1. it improves the core answer quality across both typed and voice paths instead of only one continuity seam
2. the current Anna surface already has bounded runtime discipline, placement coverage, fallback handling, telemetry integrity, and reopen continuity
3. the remaining prompt/retrieval quality work is the most user-visible residual before multilingual breadth, broader voice UX/architecture, or analytics/dashboard breadth
4. current code already centralizes the main quality levers in one place: public system instruction, retrieved knowledge context, conversation history shaping, and starter prompts

## Why other visible backlog themes rank behind it

1. multilingual expansion is broader than the accepted language-fallback cut and introduces new breadth rather than the next smallest quality improvement
2. broader voice UX or architecture work is more invasive than prompt-quality and has less bounded surface area
3. backend analytics/dashboard breadth adds observability but not first-order answer quality on the live public surface

## Current conclusion

1. no new lane is promoted by this recommendation alone
2. the program remains held until an explicit unlock is granted
3. `Landing Anna prompt-quality` is the strongest first candidate when that unlock happens
