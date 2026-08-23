# Wave 3 — Results acceptance

ID: `RES`
Routes: `/results`
Current gate: `TECHNICAL_BROWSER_PASS / OWNER_REVIEW_PENDING`
Owner: Piotr Wisniewski
Integrator: Codex
Mobile: `DEFERRED_NON_GATING`

> Recovery replay — 2026-08-23: the historical 817-migration database recorded
> below was absent at catalog revalidation. Replacement local-only database
> `consultify_w3_results_owner_recovered_20260823` passed the exact 831-migration
> chain and an independent post-restart SQL readback of KPI, Execution receipt,
> ROI Actual and OKR check-in. Its new FINAL `0600` receipt is marker-bound.
> Exact clean SHA `62e4b71ad7e3ec3e7100ee2086342a013f62a091` adopted it on
> server/client `4337/4338`: health/readiness/frontend `200/200/200`, migration
> ledgers `ok/ok`, client and SQL markers passed. OWNER login and KPI, ROI,
> program, cycle and OKR-set lists all returned `200`; MEMBER ROI access returned
> governed `403`, foreign KPI list returned an empty `200`, and anonymous KPI
> access `401`. This restores current technical API/storage readiness, not
> authenticated browser evidence, Piotr acceptance or release authority.

## Contract

Primary journey: inspect KPI/ROI/OKR, add an allowed observation and follow
lineage to its source. Required boundaries: retained/disabled legacy writer
truth, immutable history, retry, visibility grant and foreign tenant.

## G00–G20 checklist

| Gate | Mandatory outcome | State | Evidence/decision |
|---|---|---|---|
| G00 | Scope, routes, dependencies, 82-task links and exclusions | `PASS` | Scope binds `RES-BVP-001`, `RES-MVP-LEGACY-CUTOVER-001`, `RES-MVP-VISIBILITY-001`, `RES-FLOW-ADAPTER-001`, `RES-UI-CANON-001`; all historical packets report `DONE_CURRENT_SHA` but were replayed rather than trusted. Canonical API families are KPI/ROI/OKR plus visibility, legacy archive and Execution ingress. Results owns immutable Actual; Finance may propose/reconcile but never overwrite it. Production telemetry, release and mobile are excluded. |
| G01 | Exact baseline and client/server/runtime/DB/migrations | `PASS_FOR_EXACT_RUNTIME_PREFLIGHT` | Clean checkpoint `12ef2e236af080c4aa4166e08ca902eb1c112716` adopted retained FINAL DB `consultify_w3_results_owner_final_20260821_c` on server/client `4112/4113`. Health, readiness and frontend were `200`; exact server/readiness/client marker, both migration ledgers, `817` migrations, FINAL manifest SHA `82283d75...` and durable SQL marker passed. Runtime manifest: `/private/tmp/consultify-wave3-runtime-manifest-results-checkpoint-20260822.json`. Owned process groups were stopped, ports freed and DB preserved. The earlier `fd4a7bcbc609...` authenticated browser evidence remains historical G06 evidence, not current-checkpoint visual acceptance. |
| G02 | Journeys, writes/readbacks, upstream/downstream and policy map | `PASS` | KPI definition/version/approval → measurement → deviation/recovery; ROI case → approved Finance source + Results Actual → proposal/dispute/PIR; OKR program/set/objectives/KRs → publish/check-in/review. Execution ingress is tenant-scoped and exactly-once. Legacy inventory is exactly `28 = 23 disabled + 5 retained-observed`. Cold reads, maker/checker, CAS, idempotency, immutable sources, foreign tenant and fail-closed legacy scalar boundaries are explicit. |
| G03 | Named allowed/denied personas | `PASS_FOR_PREFLIGHT` | Allowed module wall: same-tenant ACTIVE OWNER/ADMIN; independent maker/checker for governed commands. Denied: MEMBER/CONSULTANT/GUEST at restricted-beta wall, revoked/missing membership, forged role/superadmin, body tenant spoof and foreign tenant. Finance reconciliation additionally requires ACTIVE OWNER/ADMIN and current grant. Stable browser personas remain to be bound in G04. |
| G04 | Reproducible realistic and boundary fixtures | `PASS_OWNER_FIXTURE_RETAINED / OWNER_REVIEW_PENDING` | Guarded `server/scripts/seed-wave3-results-owner-review.ts` creates KPI trend/deviation with a fully FK-valid Execution receipt, ROI Actual/reconciliation/PIR, and OKR hierarchy/check-in/review. The retained DB and exclusive `0600` manifest use the FINAL `W3-RESULTS-OWNER-v1` nonce/SQL-marker contract. KPI, ROI and OKR carry explicit canonical visibility rows; ROI additionally carries the exact owner-approved governed-visibility publication. OWNER, independent ADMIN checker, denied MEMBER and foreign tenant are stable. SQL readback proves the domain rows, three visibility rows, one ROI governance publication, one complete Execution graph and zero orphans. |
| G05 | Functional preflight and cold readback | `PASS_FOR_PREFLIGHT` | Exact-current replay: UI/component `22 files / 141 tests`; KPI/ROI/OKR BVP `6 files / 30`; mounted visibility `4`; strict membership `11`; legacy registry `8`; legacy cutover `25`; legacy isolation `6`; governed ROI legacy-isolation + Finance reconciliation `20`; Execution ingress + cross-surface KPI identity `3`. A broader Results source/UI/vNext discovery executed `684/684 PASS`, `0 failed`, with `414` environment-gated skips reported separately. On clean checkpoint `12ef2e236a`, real OWNER login and canonical vNext reads returned exactly one KPI (`DELIVERY_ON_TIME`, active), one ROI case (`post_investment_review` with current Actual snapshot), one company OKR set, one active program and one review cycle. The owner-review profile routes `/results` to these vNext registries; the older `/api/v8/results/*` cockpit reads remain empty for this fixture and are not accepted as a substitute. Root/server typechecks and `git diff --check` PASS. React `act(...)` warnings remain non-gating test-quality debt; owner/provider/policy/mobile/release gates remain open. |
| G06 | Desktop/tablet, PL/EN, themes, states, a11y, console/HTTP | `PARTIAL_DESKTOP_PL` | Authenticated fixture-backed desktop PL replay opened KPI, ROI and OKR canonical screens. KPI `DELIVERY_ON_TIME` exposed two verified measurements (`92`, `78`), critical deviation and `execution_receipt`; ROI cold-read `200,000` approved, `125,000` Actual and `62.5%` realization plus finalized `Benefits partially realized` PIR and accepted Finance divergence; OKR exposed its objective, KR `84/90` (`70%`), last check-in and review. The `[object Object]%` slot-mapping defect was fixed and replayed as `62.5%`. Shared 1055 px empty-state clipping was also browser-verified fixed. Tablet, EN, alternate theme, systematic keyboard/a11y, clean-console/HTTP and owner judgment remain open. |
| G07 | Piotr review card | `READY_FOR_GUIDED_REPLAY` | Shared operator card: `../../GUIDED_OWNER_REPLAY.md`, row 8. Owner decisions remain pending. |
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
| `RES-OWNER-01` | owner fixture | Stable executive KPI/ROI/OKR review dataset | guarded explicit-`YES` seed; exact `consultify_w3_results_owner_*`; FINAL manifest + nonce-bound durable marker; independent SQL/API readback | KPI `2+1+FK-valid receipt`; ROI `Actual+reconciliation+PIR`; OKR `hierarchy+check-in+review`; all three canonical list APIs return one exact fixture row | OWNER + independent ADMIN; MEMBER/foreign seeded but denial requests not yet executed | `RETAINED_EXACT_RUNTIME / ownerReviewReady:false / BROWSER_PENDING` |

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
| `RES-PF-007` | The original owner seed populated KPI/ROI/OKR domain rows but omitted the visibility policies and resource projections used by the mounted vNext registries, so all three canonical list APIs returned empty. | Seed now writes exact KPI/OKR `OPEN_ORG` visibility and the owner-approved ROI governed-visibility publication plus `ROI_GOVERNED` resource row. Fresh retained runtime cold API readback returns the exact KPI, ROI case and company OKR set. | `FIXED_VERIFIED` |
| `RES-PF-008` | The current frontend regression pack exposed a duplicate Escape owner in registry previews, suppressed the organization-wide canonical dashboard when no initiative filter was supplied, and retained several obsolete archive-mutation, i18n and old-cockpit fixtures. | `StandardPreview` is now the sole Escape owner while focus return remains asserted; the default Results entry requests the unscoped canonical dashboard; archive drawers are tested as read-only canonical handoffs and stale fixtures now reflect the current three-pairs UI and real PL dictionary. Broad replay: `684` executed PASS, `0` failed, `414` environment-gated skips. | `FIXED_VERIFIED` |

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
