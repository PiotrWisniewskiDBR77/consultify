# Wave 3 exact-SHA browser replay — 2026-08-23

Runtime candidates:

- `a7e43c31ac128f895d278e3035c4f9ff00675767` — Organization through Assessment.
- `b36a6a0eb9d728ed9c4538a55ca09d8285731cd7` — Initiatives through Meetings;
  its only change from the first candidate is this evidence document.
- `6d28066e5e9b273e44662c3b272a3b90e0510d05` — Results, Finance and Materials.
- `62b8ca12cbfe94490140ddffff2ad22500b9d7a9` — Audits after the fail-closed
  coverage-contract repair.
- `c02afa5205a5d2fff900902a7d414ec1c6931829` — Chat, Admin, Settings and
  Partner; its only change from the Audits candidate is this evidence document.

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
| Initiatives | Real OWNER login; `/initiatives` rendered one `W realizacji` initiative, `Delivery` lifecycle, owner, next action, expected 30% planning improvement and truthful `Confidence: UNKNOWN`/health state. | `BROWSER_PASS_OWNER_ACCEPTANCE_REQUIRED` |
| Execution | Real OWNER login; `/execution/w3-exe-case-v1` rendered the one active Customer pilot case, exact handoff `w3-exe-handoff-v1@v1`, accepted Initiative baseline `v3`, zero open gaps, next milestone and independent acceptance request contract. | `BROWSER_PASS_OWNER_ACCEPTANCE_REQUIRED` |
| My Work / Agent | Real OWNER login; `/my-work` rendered the full module navigation and empty canonical Inbox. Direct cold-open `/my-work/tasks` rendered the durable `Review pilot` task as `W trakcie`, high priority and assigned to the owner. | `BROWSER_PASS_OWNER_ACCEPTANCE_REQUIRED` |
| Meetings | Real OWNER login; `/meeting` rendered all three completed owner fixtures: pending minutes, rejected minutes and approved minutes, with exact scheduled dates, participants and zero follow-ups. | `BROWSER_PASS_OWNER_ACCEPTANCE_REQUIRED` |
| Results | Real OWNER login; `/results` canonicalized to `/results/kpi` and rendered the active `DELIVERY_ON_TIME` KPI, its owner and durable update date. | `BROWSER_PASS_OWNER_ACCEPTANCE_REQUIRED` |
| Finance | Real OWNER login; `/finance?tab=statements` rendered three statements, two rejected imports, zero repair-queue items, one ready statement, the approved CD PROJEKT 2024 statement and the two truthful 2025 draft states. | `BROWSER_PASS_OWNER_ACCEPTANCE_REQUIRED` |
| Materials | Real OWNER login; canonical document, presentation and workbook routes rendered the transformation plan with two substantive sections, the four-slide deck and the pilot-budget workbook/XLSX identity. | `BROWSER_PASS_OWNER_ACCEPTANCE_REQUIRED` |
| Audits | The initial replay exposed a real contract defect: the list and criterion showed `1/1`, while the preview silently rendered `0/0`. The server returned canonical `applicableTotal`/`concludedTotal` fields but the client read obsolete `...Criteria` names and defaulted them to zero. Commit `62b8ca12cb` maps the canonical fields and rejects malformed coverage instead of fabricating zeroes. Exact-SHA runtime replay on the preserved fixture then rendered `Postęp 1/1`, `Pokrycie 1/1`, `Dowód niewystarczający 0`, and criterion `TA.1` as `1 / 1`. | `BROWSER_PASS_OWNER_ACCEPTANCE_REQUIRED` |
| Chat | Real OWNER login and canonical conversation deep link rendered the sourced Pilot Atlas message, external evidence link, two preserved source references, content hash/version and the governed proposal in truthful `Pending review` state with separate Approve/Reject controls. No decision or materialization write was performed. | `BROWSER_PASS_OWNER_ACCEPTANCE_REQUIRED` |
| Admin | Real OWNER login and `/admin/audit/events` rendered the rebuilt task-oriented Admin navigation and a reconciled audit surface: `3` total, `3` unresolved, `3` high-risk, with all three durable IAM events present in the table. No export or IAM mutation was performed. | `BROWSER_PASS_OWNER_ACCEPTANCE_REQUIRED` |
| Settings | Real OWNER login and `/settings/data-controls` rendered the pending export with durable receipt and the previous deletion request as cancelled, explicitly stating that no automated erasure is scheduled. No consent, retention, export or deletion mutation was performed. Broad GDPR-compliance copy remains a separate legal/source-authorization gate; this replay does not substantiate it. | `BROWSER_PASS_OWNER_ACCEPTANCE_REQUIRED` |
| Partner | Real OWNER login and `/partner/profile` rendered active partner state, certification `1/10`, one attribution, one participant-ledger record and zero accrued economics. The governed boundary explicitly disables accrual, payout and self-approval without an approved versioned rule. The navigation still exposes commission/payout sections while economics is policy-gated; the previously recorded owner IA decision remains open. | `BROWSER_PASS_OWNER_ACCEPTANCE_REQUIRED / IA_DECISION_OPEN / ECONOMICS_OFF` |

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
- My Work task content was proven through its canonical `/my-work/tasks` deep
  link. Clicking the visible tab label did not produce a separately captured
  state transition while onboarding was still overlaid, so that click-level
  interaction remains `NOT VERIFIED`; no task-content claim depends on it.
- Onboarding remained visible because dismissing it would write review state.
  It did not block direct route readback, but onboarding acceptance remains a
  separate owner decision.

## Remaining denominator

Browser-qualified across the exact-SHA candidate lineage: `16/16` modules.

The desktop exact-SHA browser denominator is complete. This is a technical
replay across the candidate lineage, not one frozen final-candidate regression
run and not Piotr owner acceptance. Responsive/accessibility checks, the
Partner IA/economics decision, Settings legal-copy substantiation and Piotr
owner acceptance remain open.
