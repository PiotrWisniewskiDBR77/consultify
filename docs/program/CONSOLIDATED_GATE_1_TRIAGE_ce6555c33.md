# CONSOLIDATED-GATE-1 triage — ce6555c33

This is a deterministic first-pass triage of the 198 non-green files captured at
`032ca27f71a06256710cb5c7124df73ea11fb8de`, projected onto current candidate
`ce6555c33bf38c806ccbe4219a4cc4e14b2ab6eb`. The full 4,093-file suite was not rerun.

## Queue

| Classification | Files | Handling |
|---|---:|---|
| PRODUCT_REGRESSION | 116 | Reproduce on current SHA; product change only after confirmation |
| STALE_CONTRACT | 51 | Compare to current route/schema; port or retire in a harness packet |
| HARNESS_ENV | 2 | Supply the declared dependency/runtime before interpreting result |
| EXPECTED_PENDING | 29 | Keep visible; do not count as a product regression |

Priority split: P0 12, P1 104, P2 82.

Exact, non-overlapping agent allowlists are embedded in the machine file:

- P0 security and persistence: 12
- P1 server and backend: 23
- P1 mounted UI: 8
- P1 integration: 45
- P1 other contracts: 28
- P2 stale, environment, and pending: 82

## Current typechecks

Both typechecks were rerun at `ce6555c33` and remain red:

- Root: 3 errors in two Transformation Case fixtures and the Notebook conflict helper constraint.
- Server: 21 nullable partner/payout errors in `server/src/routes/v8/partner.routes.ts`.

The machine artifact `CONSOLIDATED_GATE_1_TRIAGE_ce6555c33.json` contains all 198 records,
their first-pass category, priority, assertion counts, reason, and the exact agent allowlists.
Classification is intentionally conservative: a `PRODUCT_REGRESSION` entry is a reproduction
queue, not proof that application code rather than its current test contract is wrong.
