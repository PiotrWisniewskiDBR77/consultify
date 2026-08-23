# Initiatives — consolidated three-expert review

Date: 2026-08-24  
Module: `INI`  
Decision: `NO-GO_FOR_OWNER_ACCEPTANCE / REMEDIATION_REQUIRED`

## Evidence boundary

The three independent reviews inspected source at `2cf780d62f9a421ec4b372e8168b247435c464ec`. Current product HEAD is `1885ea5cde`; the intervening commit changes Assessment navigation only and does not close any Initiatives finding. Historical exact-SHA runtime and browser evidence remains preserved, but it does not qualify the current source or replace owner acceptance.

Inputs:

- `INITIATIVES_EXPERT_METHOD_REVIEW_2026-08-24.md`
- `INITIATIVES_EXPERT_UX_REVIEW_2026-08-24.md`
- `INITIATIVES_EXPERT_TECH_REVIEW_2026-08-24.md`

## What is genuinely present

The repository contains a substantial canonical Initiative and Execution foundation: authenticated organization-scoped runtime routes, material commands, versioned cards, audit/outbox/idempotency storage, Plan and Capacity scenario APIs, an Initiative-to-Execution identity seam and focused source tests. This is reusable product work, not an empty mock.

## Consolidated closure packages

| ID | Priority | Required closure | Acceptance gate |
|---|---|---|---|
| `INI-C01` | P0 | Remove implicit DEV fixtures and fail closed when canonical reads fail. Fixture mode must be explicit and visibly labelled. | A failed API produces a blocking error and zero unlabelled demo rows; explicit sample mode remains deterministic. |
| `INI-C02` | P0 | Make ordinary local Plan and Capacity use their real APIs. | Create, save, refresh and reopen Plan and Capacity records against a disposable canonical DB. |
| `INI-C03` | P0 | Prove one canonical Initiative identity through Execution. | Same initiative/case IDs survive restart and cold readback; foreign tenant is denied; no duplicate/shadow row exists. |
| `INI-C04` | P0 | Requalify the current frozen SHA in browser and close the 21-gate package without promoting fixtures to persistence evidence. | Exact source/server/client/DB identity plus API, SQL and browser evidence; owner verdict remains separately explicit. |
| `INI-C05` | P1 | Complete the premise-to-AI-draft creation flow with human review and idempotent save/readback. | Source and assumptions are retained; AI never silently creates or mutates the canonical initiative. |
| `INI-C06` | P1 | Deliver Plan as versioned what-if analysis: status filters, include/exclude, dependency-aware AI proposal, weekly editable Gantt, rationale and human save. | Two named scenarios can be compared, manually adjusted, versioned and cold-reopened without changing source initiative dates. |
| `INI-C07` | P1 | Deliver Capacity as multiple analyses per saved Plan with person/team saturation, ranges/confidence, conflicts and governed suggestions. | Two analyses for one Plan persist independently; proposals require approve/reject and cold readback. |
| `INI-C08` | P1 | Enforce project and priority filters and reconcile counters. | Mixed-project/priority fixture returns exactly the selected IDs and denominator. |
| `INI-C09` | P1 | Standardize full-height preview, concise row menu, selection and bulk-action reachability. | Canonical desktop/tablet browser matrix passes keyboard, focus, resize and menu action checks. |
| `INI-C10` | P1 | Define versioned decision reports for Plan and Capacity with source lineage. | Saved report identifies author, source snapshot, status selection, assumptions, version and export/readback. |
| `INI-C11` | P2 | Separate empty, forbidden, unavailable and transport-error states for supporting data. | 403/404/500/network and successful-empty render distinct, testable states. |
| `INI-C12` | P2 | Isolate or remove unreachable historical Candidate/Portfolio/classic UI branches after preserving required read compatibility. | Active-route reachability proves only Initiatives, Plan and Capacity; legacy writers remain fail-closed. |
| `INI-C13` | P2 | Complete PL/EN, responsive and accessibility verification. | No clipped critical controls; keyboard/focus/labels pass on the agreed viewport matrix. |

## Required closure order

1. Truthful data source (`INI-C01`, `INI-C02`).
2. Canonical identity and scope (`INI-C03`, `INI-C08`).
3. Product workflows (`INI-C05`–`INI-C07`, `INI-C10`).
4. Shared UI and ambiguity reduction (`INI-C09`, `INI-C11`–`INI-C13`).
5. Freeze one candidate and run one proportional exact-SHA qualification (`INI-C04`).
6. Owner retest and explicit verdict.

## Claims deliberately not made

`RUNTIME_NOT_VERIFIED`, `DB_APPLIED_STATE_NOT_VERIFIED`, `PERSISTENCE_NOT_VERIFIED`, `BROWSER_NOT_VERIFIED_FOR_CURRENT_HEAD`, `OWNER_ACCEPTED_NO`, `RELEASE_READY_NO`.
