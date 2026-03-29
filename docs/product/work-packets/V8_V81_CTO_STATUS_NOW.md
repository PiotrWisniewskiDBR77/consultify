# V8 + V8.1 CTO Status Now

> Status date: 2026-03-26
> Audience: final decision owner
> Format: short operational status

## Decision

`closed`

## Why

- the frozen package is functionally converged,
- accepted closure-grade lanes are already sufficient for package completion,
- `hold bounded` lanes are proven enough and must not be reopened,
- deferred lanes are explicitly outside the active closure path,
- the earlier two narrow proof blockers were later retired by the post-closure tracker reconciliation.

## Exception status

The earlier carried exceptions for:

1. `Calendar`
2. `Organization / Admin / Superadmin`

were later retired in `cursor-work/../evidence/549-v8-v81-package-exception-retirement.md`.

## Rule now in force

- the wave is considered closed,
- no carried package-level exception remains active,
- any remaining breadth moves to post-closure follow-up work,
- the current wave must not be reopened.
