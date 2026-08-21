# Wave 3 — Interview acceptance

ID: `INT`
Routes: `/interview`, `/interview/respond/:token`
Current gate: `TECHNICAL_PREFLIGHT`
Owner: Piotr Wisniewski
Integrator: Codex
Mobile: `DEFERRED_NON_GATING`

## Contract

Primary journey: create/manage an interview and complete the isolated public
respondent path with durable response readback.

Required boundaries: expired/replayed/foreign token, respondent isolation from
organization navigation, insufficient manager role and duplicate submission.

## G00–G20 checklist

| Gate | Mandatory outcome | State | Evidence/decision |
|---|---|---|---|
| G00 | Scope, routes, dependencies, 82-task links and exclusions | `PASS` | Routes: authenticated `/interview` and isolated public `/interview/respond/:token`. Task links: `INT-BVP-001`, `INT-DELIVERY-OPS-001`, `INT-UI-CANON-001`; all three exact-current evidence packets report `DONE_CURRENT_SHA`. Mobile, production outreach and production release are excluded. |
| G01 | Exact baseline and client/server/runtime/DB/migrations | `PASS_FOR_SOURCE_PREFLIGHT` | Current source candidate `291e37340f`; disposable real PostgreSQL `int_bvp_wave3_20260821`; fresh migrations `816`, repeat `0`, dry-run pending `0`. Organization owner screen remains intentionally mounted on product `ad0766ac4c1000c6c94934a1af1d53c0b4eed19c`; Interview exact-SHA mount is deferred until the Organization owner round releases that screen. |
| G02 | Journeys, writes/readbacks, upstream/downstream and policy map | `PASS` | Manager: create/publish/assign/invite/review. Respondent: opaque token → resume/CAS answer → submit. Downstream: approved insight → exactly one initiative candidate. Durable boundaries include token expiry/revoke, anonymity wall, tenant/role access, answer CAS, AI timeout audit, notification fallback and immutable handoff receipt. |
| G03 | Named allowed/denied personas | `PASS_FOR_PREFLIGHT` | Allowed matrix: session owner, same-tenant ADMIN, direct assignee, team assignee and legitimate public-token respondent. Denied matrix: unrelated same-org member, inactive member, foreign-tenant ADMIN, revoked/expired token and replay/concurrent stale writer. Current real-PG suites cover these roles; named owner-review personas will be bound when the UI fixture is mounted. |
| G04 | Reproducible realistic and boundary fixtures | `PASS_FOR_TECHNICAL_PREFLIGHT` | Disposable `int_bvp_*` database with explicit immutable-cleanup opt-in, opaque 256-bit tokens, two isolated organizations and unique `intbvp001-*` fixture identities. Exact replay left `0` residue and immutable trigger `trg_interview_candidate_handoff_immutable` enabled (`O`). Owner-facing realistic interview content remains to be prepared before G07. |
| G05 | Functional preflight and cold readback | `IN_PROGRESS` | Current real-PG replay: `9/9` files and `70/70` tests PASS after correcting two exact-current preflight defects. Fresh/repeat/dry migrations: `816/0/0`; fixture residue `0`. Mounted manager/respondent UI replay and independent cold browser readback remain pending. |
| G06 | Desktop/tablet, PL/EN, themes, states, a11y, console/HTTP | `NOT_STARTED` | — |
| G07 | Piotr review card | `NOT_STARTED` | — |
| G08 | First-impression review | `NOT_STARTED` | — |
| G09 | Guided CX journey review | `NOT_STARTED` | — |
| G10 | Alternate-state owner review | `NOT_STARTED` | — |
| G11 | Every owner observation/screenshot durably registered | `NOT_STARTED` | — |
| G12 | Owner register reconciled and confirmed | `NOT_STARTED` | — |
| G13 | Solution and impact analysis | `NOT_STARTED` | — |
| G14 | Remediation with finding-to-commit traceability | `NOT_STARTED` | — |
| G15 | Integrator self-QA and impacted regression | `NOT_STARTED` | — |
| G16 | Before/after owner retest packet | `NOT_STARTED` | — |
| G17 | Owner retest decisions for every finding | `NOT_STARTED` | — |
| G18 | Module accepted on exact SHA and checkpointed | `NOT_STARTED` | — |
| G19 | Later-change regression obligations resolved | `NOT_STARTED` | — |
| G20 | Final 16/16 replay | `NOT_STARTED` | — |

## Piotr review card

| Purpose/value | Starting route | Persona/data | Guided actions | Conscious exclusions | Observation prompts |
|---|---|---|---|---|---|
| _prepare before G07_ | `/interview` | _pending_ | Create/manage interview → open respondent link → submit → readback | Production outreach | Interview clarity, respondent trust, completion friction, result usefulness |

## Persona and fixture ledger

| ID | Type | Purpose | Reproducible setup/reset | Durable readback | Expected access | Status | Evidence |
|---|---|---|---|---|---|---|---|
| `INT-TECH-01` | technical matrix | Invite, respondent, manager, delivery, timeout and candidate boundaries | Fresh disposable DB `int_bvp_wave3_20260821`; unique per-run fixtures; immutable cleanup requires both opt-in and `int_bvp_*` DB prefix | independent SQL assertions and cold-pool assertions in real-PG suites | allowed/denied matrix in G03 | `70/70 PASS` | current source candidate `291e37340f` |

## Integrator preflight observations

These are technical observations, not Piotr owner findings.

| ID | Observation | Evidence | State |
|---|---|---|---|
| `INT-PF-001` | The historical exactly-once test tried to delete an immutable handoff receipt and failed during teardown after all functional assertions passed. Cleanup now requires an explicit opt-in, a verified `int_bvp_*` disposable database, transaction-local replica role, zero-residue proof and enabled-trigger readback. | Initial current-SHA replay: `70/70` functional assertions with teardown failure; corrected replay on fresh PostgreSQL: `70/70 PASS`, residue `0`, trigger `O`; commit `9fcff61b7d`. | `FIXED_VERIFIED` |
| `INT-PF-002` | The shared candidate scanner referenced nonexistent `assessments.title` and `assessments.summary` columns. Its fail-soft catch hid the schema error and silently skipped Assessment candidates during an Interview scan. The query now uses canonical `name` and `description` columns. | Real-PG query error on initial replay; corrected exactly-once suite `11/11 PASS` without the missing-column error; commit `291e37340f`. | `FIXED_VERIFIED` |

## Owner UI/UX/CX register

| Finding ID | Captured | Piotr original wording | Category | Route/screen | Current behavior | Expected experience | Impact | Screenshot/hash | Product SHA | Severity | Decision/status | Fix commit | Self-QA | Owner retest |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| _none_ | | | | | | | | | | | | | | |

## Implementation/regression ledger

| Finding IDs | Root cause | Approved solution | Commit | Shared surfaces | Impacted modules | Tests/self-QA | Regression |
|---|---|---|---|---|---|---|---|
| _none_ | | | | | | | |

## Owner verdict

Decision: `PENDING`
Accepted SHA: —
Date: —
Accepted-out/deferred: —
Evidence manifest: —
