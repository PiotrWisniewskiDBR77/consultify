# Final Acceptance Journey — ACO-001 Automated Changeover Optimization

Status: `AUTOMATED ACCEPTED — steps 1–59 browser + isolated realDB; release/manual gates open`
Acceptance type: realDB + runtime + browser E2E + audit evidence
Epic: `IE-001`

## 1. Business case

`NordWerk Manufacturing` wants to reduce production-line changeover time. An Assessment identifies an opportunity but does not prove the preferred solution. The Initiative must compete with other work, be sequenced against scarce automation and maintenance capacity, be executed through a pilot and two waves, and prove an operational outcome.

### Fixed starting facts

| Fact                       | Value                                                                 |
| -------------------------- | --------------------------------------------------------------------- |
| source                     | Assessment finding `ASM-F-ACO-001`, version 3                         |
| proposed title             | Automated Changeover Optimization                                     |
| problem                    | median changeover 95 minutes; target hypothesis is not yet approved   |
| organization               | `nordwerk-e2e`                                                        |
| project                    | `operations-transformation-2027`                                      |
| governance                 | organization default Standard; project override Standard-Industrial   |
| Sponsor                    | Anna Sponsor                                                          |
| Initiative Owner           | Iwona Owner                                                           |
| Project Leader             | Paweł Leader                                                          |
| Execution Manager          | Ewa Manager                                                           |
| Resource Manager           | Roman Capacity                                                        |
| Benefit/KPI Owner          | Karolina Results                                                      |
| Finance Owner              | Filip Finance                                                         |
| competing work             | QMS 4.0 and Energy Reduction Programme                                |
| scarce roles               | Controls Engineer, Maintenance Lead, Data Analyst                     |
| planned delivery structure | pilot + wave 1 + wave 2 inside one Execution Case                     |
| intended KPI               | median changeover minutes, baseline 95, target 60, weekly observation |
| budget envelope            | PLN 1,200,000; Finance remains source of truth                        |

Values are fixtures, not product defaults.

## 2. Actor and negative-role matrix

The test uses separate authenticated users for each named role plus:

- `Viewer` — may read permitted projection, cannot mutate;
- `Unrelated Project User` — cannot access restricted content;
- `Foreign Tenant User` — receives no existence/content disclosure;
- `Admin` — configures policy but cannot become implicit business approver.

Every material step repeats at least one unauthorized attempt and verifies no write/audit leak beyond the denied-attempt policy.

## 3. Full journey

### Phase A — source to registered case

1. Open the Assessment finding and submit a Proposal.
2. Validator sees source/version/provenance and duplicate comparison.
3. Register with `clientRequestId=aco-register-001`.
4. Retry the same request after simulated timeout.
5. Assert one Initiative and one lineage relation exist.
6. Assert lifecycle `REGISTERED_DRAFT`; Candidate/Proposal remains source-owned.
7. Open from Inicjatywy table -> preview -> exact Initiative Card and return without losing table context.

### Phase B — definition and analysis

8. Resolve effective `Standard-Industrial` governance policy and persist its version.
9. Include applicable catalog cards; omit Communication temporarily and prove its old data/history would be preserved.
10. Complete Summary/Scope, Strategic Fit, Success Criteria, Outcomes, Options including do-nothing, Team/RACI and source evidence.
11. Create an accountable Task for Finance evidence and a Decision request for technical option selection.
12. Verify the same objects and IDs in Initiative, My Work and canonical detail.
13. Submit Definition Gate; stale source deliberately blocks it.
14. Refresh source, re-evaluate exact finding, submit and approve according to configured authority.
15. Assert `DEFINED`, then start applicable analysis and assert `ANALYZING`.
16. Populate/link Finance, KPI, Capacity estimate, Dependencies, RAID, Technical and Change evidence.
17. AI drafts challenge/counter-evidence; human rejects one proposal and accepts another. Only accepted content becomes card truth.
18. Resolve blockers; freeze Decision Brief and reach `READY_FOR_DECISION`.

### Phase C — portfolio selection

19. In Portfel compare ACO with QMS and Energy work in baseline and constrained scenarios.
20. Verify score decomposition, rank, overlap, confidence and manual override rationale.
21. Select ACO conditionally: Finance reconciliation and Controls Engineer commitment remain follow-up.
22. Publish Portfolio Decision; conditions create canonical Tasks.
23. Assert card read-back, immutable scenario/version and lifecycle `APPROVED_BACKLOG`.

### Phase D — plan and capacity

24. Build two Plan scenarios with dependencies and tentative windows.
25. Attempt direct drag-to-baseline and verify only a draft scenario changes.
26. In Obciążenie compare weekly low/base/high demand to available capacity; unknown non-project load remains unknown.
27. Detect Controls Engineer overload and simulate resequence, scope split and additional capacity.
28. Resource Manager conditionally commits named critical roles; assignees accept required assignments.
29. Review time/cost/risk/outcome impact and publish Schedule Decision; the same governed command
    freezes the versioned Handoff Pack identity and exact card/scenario/capacity snapshot.
30. Assert `SCHEDULED`, approved window/baseline snapshot, frozen Handoff Pack and preserved
    superseded scenario.

### Phase E — handoff and execution

31. Execution Manager opens the already frozen Handoff Pack with scope, selected option, success,
    baseline, open Tasks/Decisions/RAID and outcome contract; viewing or validating it does not
    create a second package.
32. Execution Manager returns it once for an unresolved critical dependency.
33. Resolve dependency and retry with the same handoff idempotency key.
34. Accept and assert exactly one active Execution Case, one `initiativeId`, execution deep link and lifecycle `IN_EXECUTION`.
35. Assert pilot, wave 1 and wave 2 are children, not parallel Execution Cases.

### Phase F — work, resources and intervention

36. Create pilot Tasks and a go/no-go Decision; verify My Work projections.
37. Block a cutover Task by the Decision and expose affected milestones/blast radius.
38. Publish conditional Decision; create follow-up Tasks idempotently and re-evaluate the blocker.
39. Record approved resource allocations and preserve unknown coverage without exact utilization claim.
40. Inject a stale milestone and capacity-conflict signal.
41. Sterowanie deduplicates sources into one Intervention Case.
42. Inspect why/source/blast radius and compare do-nothing, resequence and temporary-capacity options.
43. Approve a reversible resequence, perform canonical write and verify read-back in Plan, Execution, Task and My Work.
44. At `verifyBy`, record intervention result; an ineffective result remains open/escalates.

### Phase G — reporting and delivery

45. Generate a persisted monthly Report Run with exact source versions, freshness, completeness and confidence.
46. Drill a finding to its source and create one linked follow-up Task.
47. Freeze and approve the run; refresh creates a new draft rather than mutating the approved run.
48. Complete delivery Tasks with acceptance evidence.
49. Attempt completion without one required evidence item and verify Delivery Gate blocks.
50. Supply evidence, reconcile open residuals and accept delivery.
51. Assert lifecycle `DELIVERED`; benefit remains not yet achieved.

### Phase H — outcome and closure

52. Results accepts Benefits Handoff and asserts lifecycle `BENEFITS_TRACKING`.
53. Persist weekly KPI observations in Results: baseline 95, final median 58 minutes; Initiative only projects references/as-of.
54. Finance reconciles actual spend reference; Initiative does not copy ledger truth.
55. Run Effectiveness Review with evidence/attribution/confidence and record `CONFIRMED`.
56. Assert lifecycle `EFFECTIVENESS_REVIEWED`.
57. Assign all follow-up, capture lessons and approve Closure; assert `CLOSED`.
58. Apply retention policy and archive; assert `ARCHIVED`, read-only history and preserved links.
59. Attempt normal mutation and unauthorized restore; both fail without data loss.

## 4. Cross-cutting fault injections

The journey must also prove:

- duplicate register, Decision publish, handoff and report generation retries;
- stale aggregate version conflict with current-version diff;
- audit/outbox consumer interruption and recovery;
- read-model lag with synchronization-pending state;
- Finance or Results unavailable/partial/stale;
- capability loss between preview and confirmation;
- foreign-tenant IDs on reads and writes;
- browser refresh at dirty, saving, pending-read-back and conflict states;
- feature-flag rollback without data deletion.

## 5. Assertions by final state

At completion:

- exactly one Initiative exists for the source registration;
- exactly one active-or-ended ACO Execution Case lineage exists, with no parallel active case;
- all twelve lifecycle transitions are present in immutable history in valid order;
- gate Decisions reference policy and evidence versions;
- no Task/Decision duplicates exist across projections;
- Portfolio/Plan/Capacity scenario history is reconstructable;
- Task/Decision/RAID/resource/report counts reconcile to canonical stores;
- Finance and Results references resolve to their authoritative records;
- archive is read-only and ordinary UI cannot erase audit/lineage;
- no cross-tenant content is disclosed;
- UI semantic states and accessibility evidence pass.

## 6. Executable test composition

The final suite will be implemented as:

1. schema/contract tests for lifecycle, policy, registry and canonical objects;
2. backend integration tests using PostgreSQL-compatible realDB fixtures;
3. service tests for OCC/idempotency/outbox/read-back;
4. component tests for table/preview/card/gate/impact states;
5. Playwright project `initiatives-execution-aco` executing the numbered journey;
6. evidence collector binding requests, persisted rows, audit events and screenshots to exact SHA.

The Playwright case may be split into restartable phases, but one orchestrated acceptance run must execute them in order against the same fixture lineage.

## 7. Pass/fail rule

`PASS` requires every numbered step, fault injection and final assertion. A skipped, quarantined, mocked, flaky-retried-without-cause or manually asserted step is `NOT_PROVEN`, not PASS. Any partial result keeps IE-090 and the Epic open.

## 8. Final execution ledger — 2026-08-11

`PASS` below means the numbered browser/realDB action was executed in the current isolated fixture.
Backend implementation alone is `READY_FOR_REVIEW`, never step `PASS`.

| Steps | Current state | Evidence / limitation                                                                                                                          |
| ----- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 1–18  | PASS          | registered Card screenshot plus HTTP/realDB golden thread through `READY_FOR_DECISION`; browser journey exercised the mounted source/card flow |
| 19–20 | PASS          | `aco-browser-portfolio-scenario-step-19.png`, `aco-browser-portfolio-decision-step-20.png`                                                     |
| 21–22 | PASS          | `aco-browser-plan-scenario-steps-21-22.png`                                                                                                    |
| 23–27 | PASS          | Capacity Scenario and three options screenshots; unknown values remain non-zero/non-green                                                      |
| 28–31 | PASS          | commitment, Schedule request/decision and frozen handoff screenshots                                                                           |
| 32–34 | PASS          | handoff return/accept and single Execution Case screenshots                                                                                    |
| 35–39 | PASS          | canonical work, Decision blocker/follow-up and operational allocation screenshots                                                              |
| 40–42 | PASS          | `aco-browser-management-intervention-steps-40-42.png`                                                                                          |
| 43    | PASS          | governed capacity-option → Material Change → Plan resequence → Intervention apply/read-back; `aco-browser-plan-intervention-step-43.png`       |
| 44    | PASS          | `aco-browser-report-definition-step-44.png`; exact project-scoped published Report Definition                                                  |
| 45–47 | PASS          | persisted Run, frozen/approved snapshot, linked follow-up and refresh-as-new-draft screenshots                                                 |
| 48–50 | PASS          | delivery Tasks, missing-evidence block and accepted Delivery evidence screenshots                                                              |
| 51–55 | PASS          | Results acceptance, authoritative 95→58 observations, Finance ref and Effectiveness Review screenshots                                         |
| 56–59 | PASS          | Effectiveness snapshot, governed Closure, archive, read-only mutation/restore proof; `aco-browser-closure-archive-steps-56-59.png`             |

Current total persistent screenshot inventory: 25 ACO journey PNGs. The current Playwright result
adds 12 narrow `390x844` and 12 matching 200% text-resize PNGs across all nine functions plus
Source, Card and My Work. The full browser composition passes `3/3`. Product Owner acceptance was
granted for the historical isolated candidate on 2026-08-11. IE-090 remains automated `ACCEPTED`.
The reconstructed code candidate `cd5f5f858390d82694926e130ea77faa97f855ad` is deployed on Railway
demo as `d4bc7cd4-46cd-435c-bdc0-3440995d26fa`. The corrected final candidate later passed the
logged-in nine-function demo walkthrough on Piotr's owner account. Exact SHA, deployment identity,
health, table/Preview/Workbench interactions, persisted-column proof and screenshots are recorded in
`IE_FINAL_CANDIDATE_MANIFEST.md`; IE-099 can proceed to owner review without an engineering blocker.
