# Wave 3 — Results acceptance

ID: `RES`
Routes: `/results`
Current gate: `TECHNICAL_PREFLIGHT`
Owner: Piotr Wisniewski
Integrator: Codex
Mobile: `DEFERRED_NON_GATING`

## Contract

Primary journey: inspect KPI/ROI/OKR, add an allowed observation and follow
lineage to its source. Required boundaries: retained/disabled legacy writer
truth, immutable history, retry, visibility grant and foreign tenant.

## G00–G20 checklist

| Gate | Mandatory outcome | State | Evidence/decision |
|---|---|---|---|
| G00 | Scope, routes, dependencies, 82-task links and exclusions | `PASS` | Scope binds `RES-BVP-001`, `RES-MVP-LEGACY-CUTOVER-001`, `RES-MVP-VISIBILITY-001`, `RES-FLOW-ADAPTER-001`, `RES-UI-CANON-001`; all historical packets report `DONE_CURRENT_SHA` but were replayed rather than trusted. Canonical API families are KPI/ROI/OKR plus visibility, legacy archive and Execution ingress. Results owns immutable Actual; Finance may propose/reconcile but never overwrite it. Production telemetry, release and mobile are excluded. |
| G01 | Exact baseline and client/server/runtime/DB/migrations | `PASS_FOR_SOURCE_PREFLIGHT` | Source candidate `67544776da`; branch `codex/wave3-16-module-acceptance-20260821`; root/server typechecks PASS. Shared local PostgreSQL is `127.0.0.1:34940/consultinity`; fresh disposable schemas applied `816` migrations. Governed ROI and immutable legacy suites used exact-name disposable databases and verified their removal. Mounted browser remains intentionally on Organization product `ad0766ac4c1000c6c94934a1af1d53c0b4eed19c`; Results exact-SHA browser mount is pending. |
| G02 | Journeys, writes/readbacks, upstream/downstream and policy map | `PASS` | KPI definition/version/approval → measurement → deviation/recovery; ROI case → approved Finance source + Results Actual → proposal/dispute/PIR; OKR program/set/objectives/KRs → publish/check-in/review. Execution ingress is tenant-scoped and exactly-once. Legacy inventory is exactly `28 = 23 disabled + 5 retained-observed`. Cold reads, maker/checker, CAS, idempotency, immutable sources, foreign tenant and fail-closed legacy scalar boundaries are explicit. |
| G03 | Named allowed/denied personas | `PASS_FOR_PREFLIGHT` | Allowed module wall: same-tenant ACTIVE OWNER/ADMIN; independent maker/checker for governed commands. Denied: MEMBER/CONSULTANT/GUEST at restricted-beta wall, revoked/missing membership, forged role/superadmin, body tenant spoof and foreign tenant. Finance reconciliation additionally requires ACTIVE OWNER/ADMIN and current grant. Stable browser personas remain to be bound in G04. |
| G04 | Reproducible realistic and boundary fixtures | `READY_TO_SEED / OWNER_REVIEW_PENDING` | Fixture checkpoint `fd8ac4db21`. Guarded `server/scripts/seed-wave3-results-owner-review.ts` creates the three stable guided slices on exact-prefix disposable local DBs: KPI trend/deviation with a fully FK-valid Execution source graph and immutable receipt, ROI Actual/Finance reconciliation/PIR, and OKR program/cycle/set/objective/KR/check-in/review. OWNER, independent ADMIN checker, denied MEMBER and foreign tenant are stable. Two fresh migrated DB cycles passed seed, independent SQL graph readback, zero-orphan anti-joins and whole-DB drop with catalog remainder `0`; normalized manifests were deterministic, secret-free and `0600`. Manifest remains `READY_TO_SEED`, `ownerReviewReady:false`: canonical browser/API journeys, denied HTTP probes and runtime flag confirmation are open. |
| G05 | Functional preflight and cold readback | `PASS_FOR_PREFLIGHT` | Exact-current replay: UI/component `22 files / 141 tests`; KPI/ROI/OKR BVP `6 files / 30`; mounted visibility `4`; strict membership `11`; legacy registry `8`; legacy cutover `25`; legacy isolation `6`; governed ROI legacy-isolation + Finance reconciliation `20`; Execution ingress + cross-surface KPI identity `3`. All executed assertions PASS, zero skipped in claimed packets. Root/server typechecks and `git diff --check` PASS. React `act(...)` warnings remain non-gating test-quality debt; browser/owner gates G06+ are not claimed. |
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
| Three short owner slices | `/results` | ACTIVE OWNER; independent ADMIN checker; denied MEMBER/foreign decoy prepared technically | (1) KPI overview/trend/lineage and governed recovery observation; (2) ROI Actual/variance/PIR and Finance reconciliation without overwrite; (3) OKR hierarchy/progress/review, then cold reopen | Production telemetry, mobile, manual replay of every denied boundary | Five-second clarity, executive readability, chart semantics, source trust, actionability and whether Finance/Results ownership is understandable |

## Persona and fixture ledger

| ID | Type | Purpose | Setup/reset | Readback | Expected access | Status/evidence |
|---|---|---|---|---|---|---|
| `RES-TECH-01` | run-scoped technical matrix | KPI/ROI/OKR lifecycle, visibility, membership, legacy isolation/cutover, Execution/Finance seams | Shared PG for scoped-clean suites; owned disposable DB for append-only governance/legacy | independent clients, immutable receipts/source envelope, catalog drop check | allowed/denied matrix in G03 | claimed packets all PASS; disposable DB remainder `0` |
| `RES-OWNER-01` | owner fixture | Stable executive KPI/ROI/OKR review dataset | guarded explicit-`YES` seed; exact `consultify_w3_results_owner_*`; independent SQL readback including Execution graph anti-joins; whole-DB reset | KPI `2+1+FK-valid receipt`; ROI `Actual+reconciliation+PIR`; OKR `hierarchy+check-in+review`; browser/API pending | OWNER + independent ADMIN; MEMBER/foreign seeded but denial requests not yet executed | `READY_TO_SEED / ownerReviewReady:false / NOT_ACCEPTED` |

## Integrator preflight observations

These are technical observations, not Piotr owner findings.

| ID | Observation | Evidence | State |
|---|---|---|---|
| `RES-PF-001` | Five component tests expected Save/update through the deliberately retired legacy KPI drawer. | Initial UI `138/143`; current drawer routes to `/results/kpi`. Tests now assert read-only archive controls, canonical handoff and zero legacy mutation; replay `141/141`. | `FIXED_VERIFIED` |
| `RES-PF-002` | KPI deviation fixture supplied obsolete `performanceStatus` hints and no evaluable threshold, producing no case. | Product evaluator derives status from approved definition. Fixture now pins target `100` and warning boundary `50`; sequential/concurrent deviation replay `3/3`. | `FIXED_VERIFIED` |
| `RES-PF-003` | ROI lifecycle, PIR and legacy-isolation fixtures used raw OPEN_ORG/RESTRICTED_ACL rows without canonical governance or active authoritative memberships. | Fixtures now use canonical governance publisher, OWNER/ADMIN membership and disposable-DB guards; relevant BVP/legacy packets PASS. | `FIXED_VERIFIED` |
| `RES-PF-004` | Mounted visibility expected the beta-wall code even when the earlier authoritative auth wall correctly returned `ORG_MEMBERSHIP_REVOKED`. | Expected code now reflects middleware ordering while retaining 403 and zero access; mounted replay `4/4`. | `FIXED_VERIFIED` |
| `RES-PF-005` | Finance reconciliation fixture used unpinned scalars and MEMBER reviewers; current contract requires exact Results Actual + approved Finance BV/WR/hash with matching metric and OWNER/ADMIN decision. | Fixture now creates complete immutable source envelopes and independent ADMIN reviewers; legacy scalar route asserts fail-closed `409 RESULTS_ACTUAL_SOURCE_REQUIRED`; replay `18/18`. | `FIXED_VERIFIED` |
| `RES-PF-006` | Multiple passing React suites emit `act(...)` warnings. | Full UI pack passes `141/141`; warnings are preserved as test-quality debt and must not be described as clean-console browser evidence. | `OPEN_NON_GATING` |

## Owner UI/UX/CX register

| Finding ID | Captured | Piotr original wording | Category | Route/screen | Current behavior | Expected experience | Impact | Screenshot/hash | Product SHA | Severity | Decision/status | Fix commit | Self-QA | Owner retest |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| _none_ | | | | | | | | | | | | | | |

## Implementation/regression ledger

| Finding IDs | Root cause | Approved solution | Commit | Shared surfaces | Impacted modules | Tests/self-QA | Regression |
|---|---|---|---|---|---|---|---|
| _none_ | | | | | | | |

## Preflight implementation ledger

| Observations | Resolution | Commits | Verification |
|---|---|---|---|
| `RES-PF-001..004` | Preserve governed KPI cutover; replace stale archive-write tests, correct evaluated KPI thresholds, bind canonical ROI governance/personas and authoritative mounted denial codes. | `0b41c28fac` | UI `141/141`; BVP `30/30`; mounted visibility `4/4`; strict membership `11/11`; legacy cutover `25/25` |
| `RES-PF-003`, `RES-PF-005` | Require owned disposable DBs for immutable governance; create exact Results Actual and approved Finance source envelopes; make legacy scalar overwrite fail closed. | `67544776da` | ROI legacy isolation `2/2`; Finance reconciliation `18/18`; combined `20/20`; disposable DB catalog remainder `0`; typechecks PASS |

## Owner verdict

Decision: `PENDING`
Accepted SHA: —
Date: —
Accepted-out/deferred: —
Evidence manifest: —
