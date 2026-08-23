# Wave 3 exact-SHA browser replay — 2026-08-23

Candidate: `a7e43c31ac128f895d278e3035c4f9ff00675767`

Scope: credentialed in-app browser replay against isolated recovered local
PostgreSQL databases. Railway, staging, demo and production were not mutated.
Each runtime passed the guarded SHA, migration-chain, fixture-marker, frontend
marker and dotenv-isolation gates before browser work. Runtimes were stopped
after use and their databases were preserved.

This is runtime evidence, not Piotr owner acceptance or release authorization.

## Results

| Module | Browser evidence | Status |
| --- | --- | --- |
| Organization | Real OWNER login; `/organization` canonicalized to `/organization/profile/identity-scale`; Organization Profile, Professional Services choice, `27 claims`, governance wording and `100%` data completeness were visible. At `390×844`, the document reported no horizontal overflow. | `BROWSER_PASS_OWNER_ACCEPTANCE_REQUIRED` |
| Interview | Real OWNER login; `/interview` rendered two durable assignments: one `In progress / 0%` and one `Submitted / 100%`. The anonymous public deep link rendered all three required Polish questions and submit action without authentication. | `BROWSER_PASS_OWNER_ACCEPTANCE_REQUIRED` |
| Tools | Real OWNER login; `/discovery-tools?docId=wave3-tools-owner-approved-v1` rendered the `APPROVED`, `100%` Dynamic SWOT session, mission/context, five-question workflow, properties and executive-summary-backed output. | `BROWSER_PASS_OWNER_ACCEPTANCE_REQUIRED` |
| Assessment | Real OWNER login; `/assessment` rendered the DRD library plus both canonical sessions with exact IDs, pinned method `2.0.0-methodpack.1`, versions `v5`/`v3`, and states `frozen`/`active`. Direct cold-open of `/assessment/drd/23aaf18e-19f3-4067-ae91-204495b642e5` rendered immutable Output v1, content hash, scope/limitations, two unit scores, two findings and the governed local Initiative Proposal Draft. | `BROWSER_PASS_OWNER_ACCEPTANCE_REQUIRED` |

## Qualification notes

- The in-app browser origin was intentionally reused while the guarded local
  server was restarted against a different fixture database. Old tokens from
  the previous ephemeral runtime secret produced initial `401` refresh/profile
  console messages before each explicit fresh login. The fresh logins and all
  module reads above succeeded; these messages are harness-origin churn, not
  evidence of tenant data leakage.
- The Assessment session was proven through its exact canonical deep link.
  The table's `Open` action did not produce an independently captured navigation
  event in this run, so action-level click acceptance remains `NOT VERIFIED`
  rather than being inferred from the successful direct route.
- Onboarding remained visible because dismissing it would write review state.
  It did not block direct route readback, but onboarding acceptance remains a
  separate owner decision.

## Remaining denominator

Browser-qualified on this candidate: `4/16` modules.

Pending exact-SHA browser replay: Initiatives, Execution, My Work / Agent,
Meetings, Results, Finance, Materials, Audits, Chat, Admin, Settings and Partner.
Responsive/accessibility checks and Piotr owner acceptance remain open for the
full denominator.
