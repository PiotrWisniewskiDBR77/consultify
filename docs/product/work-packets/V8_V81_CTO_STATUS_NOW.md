# V8 + V8.1 CTO Status Now

> Status date: 2026-03-26
> Audience: final decision owner
> Format: short operational status

## Decision

`close with bounded exceptions`

## Why

- the frozen package is functionally converged,
- accepted closure-grade lanes are already sufficient for package completion,
- `hold bounded` lanes are proven enough and must not be reopened,
- deferred lanes are explicitly outside the active closure path,
- only two narrow proof blockers remain.

## Carried exceptions

1. `Calendar`
   - governed read path is proven on staging,
   - create modal is real and submit-ready,
   - remaining gap is final create-submit capture or confirmation that `conflicts` `503` is the true runtime blocker.

2. `Organization / Admin / Superadmin`
   - admin route/client contract is covered,
   - live admin staging already proves `GET /api/v8/admin/flags`,
   - remaining gap is one superadmin-grade diagnostics proof pass.

## Rule now in force

- the wave is considered closed,
- the two items above are carried as bounded exceptions,
- any remaining breadth moves to post-closure follow-up work,
- the current wave must not be reopened.
