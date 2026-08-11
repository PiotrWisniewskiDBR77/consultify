# IE-001 implementation task register

Status values: `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, `READY_FOR_REVIEW`, `ACCEPTED`.
Rule: a task becomes `ACCEPTED` only with its listed evidence; code completion is insufficient.

| ID | Task | Depends on | Required evidence | Status |
| --- | --- | --- | --- | --- |
| IE-000 | Safety baseline, source-diff ownership and allowlist | — | clean isolated worktree; 323 source changes untouched; ownership ledger | ACCEPTED |
| IE-001 | Controlled import of owner canon with checksum verification | IE-000 | all documented SHA-256 values match; link/diff checks pass | ACCEPTED |
| IE-010 | Canonical 26-card registry and legacy-key adapter | IE-001 | total mapping; duplicate/missing-key tests; DB reload | ACCEPTED |
| IE-011 | Workspace shell and one `InitiativeDocumentView` route | IE-010 | all consumers mapped; context/focus tests; legacy disposition | ACCEPTED |
| IE-012 | Per-Initiative card include/omit/order | IE-010 | no new type; preserved data/history; waiver test | ACCEPTED |
| IE-020 | Twelve-state lifecycle compatibility projection | IE-001 | transition matrix; ambiguous legacy quarantine; round-trip tests | ACCEPTED |
| IE-021 | Governance policy schema and resolution | IE-020 | org/project/Initiative precedence; version snapshot; fail-closed test | ACCEPTED |
| IE-022 | Gate readiness finding engine | IE-010, IE-021 | exact card/rule/evidence finding; stale/blocker/waiver tests | ACCEPTED |
| IE-023 | Material change and reapproval | IE-021, IE-022 | deterministic impact diff; authority; atomic publish; history | ACCEPTED |
| IE-030 | OCC, idempotency and durable domain outbox | IE-001 | duplicate retry, conflict and crash/recovery integration tests | ACCEPTED |
| IE-040 | Source registration and lineage | IE-020, IE-021, IE-030 | all dispositions; atomic Initiative/lineage/project/visibility/owner/policy/audit/outbox/read-back realDB flow | ACCEPTED |
| IE-041A | Minimal canonical Task/Decision/My Work vertical | IE-030, IE-040 | same IDs/versions in Card, My Work and detail; retry/conflict/read-back | ACCEPTED |
| IE-041B | Definition cards and Definition Gate | IE-010–IE-012, IE-021, IE-022, IE-040, IE-041A | applicable-card matrix; published versions; independent authority; evidence snapshot; `DEFINED` | ACCEPTED |
| IE-041C | Analysis cards and Analysis Gate | IE-041B | applicable analysis; challenge/counter-evidence; accepted human truth; `READY_FOR_DECISION` | ACCEPTED |
| IE-042 | Full canonical Task/Decision/My Work integration | IE-041A, IE-041C | blocker/follow-up/publish/SLA/read-back workflows | ACCEPTED |
| IE-050 | Portfolio Scenario and decision | IE-041, IE-042 | versioned scenario/diff/rank/decision to Approved Backlog | ACCEPTED |
| IE-060 | Plan Scenario and dependencies | IE-050 | tentative window; dependency impact; no drag baseline write | ACCEPTED |
| IE-061 | Capacity assessment and commitments | IE-060 | known/estimated/unknown; time-window compatibility; assignment acceptance | ACCEPTED |
| IE-062 | Schedule Decision and frozen Handoff Package | IE-060, IE-061 | approved window/capacity/card snapshot, conditions and immutable handoff identity created atomically with `SCHEDULED` | ACCEPTED |
| IE-070 | Handoff acceptance and one Execution Case | IE-062, IE-030 | consume the frozen pack; accept/conditional/return; duplicate retry creates one case | ACCEPTED |
| IE-071 | Realizacje registry, preview and Execution workspace | IE-070 | baseline/current/forecast/actual; exact source/read-back | ACCEPTED |
| IE-072 | Praca queue and canonical actions | IE-042, IE-071 | Task/Decision projection, SLA, evidence and parent refresh | ACCEPTED |
| IE-073 | Zasoby operational allocation | IE-061, IE-071 | minimum resource model gate; simulation/impact/approved write | ACCEPTED |
| IE-074 | Sterowanie intervention loop | IE-071, IE-072, IE-073 | signal->why->options->approval->write->verify effectiveness | ACCEPTED |
| IE-075 | Persisted Report Run | IE-071, IE-074 | source snapshot/freshness/review/freeze/export/follow-up | ACCEPTED |
| IE-076 | Versioned Report Definition | IE-021, IE-075 | project-scoped definition, independent publish, immutable version, exact Run binding | ACCEPTED |
| IE-080 | Delivery Acceptance and Results/Finance handoff | IE-071–IE-075 | accepted scope distinct from outcome; source-authoritative read-back | ACCEPTED |
| IE-081 | Effectiveness, closure and archive | IE-080 | confirmed/partial/not achieved; follow-up; retention/history | ACCEPTED |
| IE-082 | Results/Finance authoritative measurement bridge | IE-080, IE-081 | exact observation/reconciliation refs and versions; unavailable/stale fail closed | ACCEPTED |
| IE-083 | Governance profiles and persisted Gate Signoff quorum | IE-021 | Baseline Small/Standard/Complex; delegation; separation; exact quorum receipt | ACCEPTED |
| IE-084 | Project-scoped authorization boundary | IE-021, IE-030 | Viewer/unrelated/foreign/Admin/expired delegate/capability-loss; zero-mutation proof | ACCEPTED |
| IE-090 | Final ACO acceptance journey | all | complete evidence packet from `FINAL_ACCEPTANCE_CASE_ACO.md` | ACCEPTED |
| IE-091 | Standard and Complex policy regression | IE-090 | same golden thread with configured authority/quorum variants | ACCEPTED |
| IE-099 | Owner acceptance and release disposition | IE-090, IE-091 | signed acceptance on one exact deployed SHA or literal gaps; no implied release | READY_FOR_REVIEW |

## First independently accepted vertical

`IE-V1 — Source Proposal to approved Definition` ends at `DEFINED`; it does not claim that Analysis
or Execution has started. Its required chain is IE-010, IE-011, IE-012, IE-020, IE-021, IE-030,
IE-040, IE-041A, IE-022 and IE-041B. Acceptance additionally requires:

- realDB reload after Register, card publish, source refresh and Definition approval;
- no self-approval unless the effective policy explicitly permits it;
- exact source, policy and published-card versions frozen in the Definition Decision;
- unauthorized and foreign-tenant attempts without write or content disclosure;
- browser proof for table -> preview -> Card -> preserved return context;
- literal `UNKNOWN`, `STALE`, `CONFLICT`, `PERMISSION_DENIED` and `READ_BACK_PENDING` states;
- one atomic registration effect and deterministic retry/fingerprint conflict behavior.

## Execution discipline

1. Only one foundation task and one dependent vertical task may be `IN_PROGRESS` concurrently unless files and contracts are independent.
2. Every task begins with an allowlist and baseline diff.
3. Every task ends with tests, `git diff --check`, exact changed-file list and evidence links.
4. A failed gate remains `BLOCKED`; scope is not weakened to mark it complete.
5. No stage/commit/push/deploy occurs without the applicable authorization.

## Final acceptance gate — 2026-08-11

- All bounded backend verticals through closure/archive, including governance profiles/signoffs,
  Plan `timeBasis`, Execution Milestones, Report Definitions and the Results/Finance bridge, are
  implemented and `ACCEPTED`.
- Browser ACO steps 1–59 pass in repeatable execution. The current full composition is `3/3 PASS`
  and includes Source/Card, the complete ACO lineage and the nine-function WCAG/responsive matrix.
- Standard/Complex and `BASELINE_SMALL` policy fixtures, exact quorum/signoff authority and negative
  Admin/delegation behavior are evidenced; IE-091 is owner-accepted.
- Unit is `59/59 files, 144/144 tests PASS`; isolated sequential realDB is `38/38 files, 88/88 tests
  PASS` against the dedicated PostgreSQL acceptance database.
- Lint across every changed or untracked TypeScript/TSX path passes with zero errors;
  `git diff --check` passes.
- WCAG 200% text resize and `390x844` narrow responsive verification pass for all nine functions,
  Source, Card and My Work.
- The historical isolated candidate was owner-accepted on 2026-08-11. The reconstructed candidate
  now passes repository-wide type-check and production build, but has no final deployed SHA yet.
- IE-099 remains `READY_FOR_REVIEW` until the same reconstructed SHA is deployed and accepted in the
  logged-in demo. Historical commit evidence remains recorded in `IE_001_EVIDENCE_LOG.md`.
