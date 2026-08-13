# Initiatives + Execution — NordWerk five-expert acceptance round

Status: `IN PROGRESS — destructive local proof PASS; independent live-demo visual round pending`

Candidate branch: `codex/initiatives-execution-final-candidate`

Candidate/deployed SHA at start of the round:
`b788968a14fd8acd5c0efe5da872ba8dc1b663a2`

Demo target: `https://demo.consultify.ai` only. Production and Railway staging remain out of scope.

## 1. Acceptance rule

Five independent disciplines score the same evidence. Every discipline must score at least `9.0/10`
and every P0 must pass. `NOT VERIFIED` is not PASS. A screenshot, component test, agent narrative or
healthy deployment does not by itself prove a material workflow.

The destructive and authority-sensitive journey runs only against disposable local PostgreSQL. The
shared demo is used for logged-in, non-destructive table, Preview, Workbench, keyboard, persistence,
responsive and visual acceptance.

## 2. The five expert disciplines

1. **PMO / portfolio / transformation** — three-Initiative truth, envelope, rank, dependency,
   scenario and decision quality.
2. **Operations / execution / resources** — Handoff, Case, work, allocation, intervention,
   delivery, results, closure and archive continuity.
3. **Enterprise UI/UX / accessibility** — table-first TRIADA, Preview, Workbench, row actions,
   Settings2, persistence, keyboard, responsive and 200% text.
4. **Governance / audit / security** — authority separation, isolation, OCC, idempotency,
   immutable versions, audit/outbox/receipt, AI boundary and archive guard.
5. **Data / KPI / Finance / reporting** — canonical source ownership, freshness/as-of/confidence,
   Finance reconciliation, KPI measurement versus attribution, Report Run hash/immutability and
   Distribution Evidence.

## 3. NordWerk small-plant case

### ACO-001 — Automated Changeover Optimization

- problem: Line 4 median changeover is 95 minutes;
- outcome hypothesis: governed weekly median at most 60 minutes;
- options: do nothing, SMED, automation + SMED;
- value range: PLN 1.4–2.2m/year; requested envelope PLN 1.2m;
- demand: Controls Engineer 0.8–1.2 FTE, Maintenance 0.4–0.7, Data Analyst 0.2–0.4;
- dependency: QMS architecture must be frozen before controls cutover;
- intended disposition: conditional reduced pilot, then the complete Execution journey.

### QMS-004 — QMS 4.0 Compliance Upgrade

- problem: incomplete critical-batch genealogy before the regulatory audit;
- outcome: independently accepted evidence for every critical batch;
- mandatory compliance work; no invented ROI;
- envelope PLN 0.9m;
- demand: Controls Engineer 0.5–0.8 FTE, Quality Lead 0.8, Data Analyst 0.3–0.5;
- intended disposition: included, rank 1, scheduled before ACO.

### ENR-002 — Energy Reduction Programme

- problem: 142 kWh/unit with stale tariff/baseline evidence;
- outcome hypothesis: at most 125 kWh/unit over eight weeks;
- envelope PLN 0.75m;
- demand: Controls Engineer 0.4–0.7, Maintenance 0.3, Data Analyst 0.4–0.6;
- Data Analyst operational load remains `UNKNOWN`;
- intended disposition: deferred pending source refresh and capacity evidence.

Hard constraints: total requested envelope PLN 2.85m against Sponsor envelope PLN 2.0m; one
Controls Engineer; QMS is mandatory; QMS precedes ACO; unknown non-project load is never zero.

## 4. Required functional journeys

### Initiatives

1. Three independent source-backed proposals register as three stable Initiatives.
2. Definition and Analysis use exact card/source versions, independent reviews and persisted
   GateSignoff/quorum receipts.
3. Portfolio publishes a constrained immutable scenario. QMS is approved, ACO conditionally
   approved with reduced pilot condition, Energy deferred. Scenario publication alone changes no
   lifecycle.
4. Plan publishes exact QMS-before-ACO windows and a versioned WEEK/Europe-Warsaw period basis.
5. Capacity reads the same Plan version, preserves low/base/high ranges and literal UNKNOWN supply,
   and introduces no operational allocation or lifecycle write.

### Execution

1. Schedule Decision freezes Handoff; first Handoff return creates no Case; retry/accept creates
   exactly one Case with rollout children.
2. Task and Decision retain their native IDs across Case, Praca and My Work. Conditional Decision
   creates exactly one follow-up Task and blocker re-evaluation is explicit.
3. Allocation follows propose → simulate → request → assignee accept → Resource Manager confirm;
   UNKNOWN activation evidence fails closed.
4. Management Signals deduplicate into one Intervention Case. Apply uses an exact canonical command
   receipt; ineffective/partial verification escalates rather than closes.
5. Report Definition and Run are persisted and versioned. Freeze records source manifest/hash;
   approval is independent; refresh creates a new draft; follow-up uses the same canonical Task ID.
6. Delivery, Results, Finance/KPI observations, Effectiveness Review, Closure and Archive stay
   separate. Archive is read-only and rejects normal writes, repeat archive and forged restore.

## 5. Shared UI/UX P0 gate — every one of nine functions

- frozen Menu 2 and one real Menu 3 with counts from the visible dataset;
- one primary StandardTable; no dashboard/form/workbench replacing the register;
- Settings2 visibility/order/width persistence and screen-specific persistKey;
- single click opens six-block Preview without route/filter/scroll loss;
- Enter, double-click and Open resolve one exact Workbench; Back restores full context and focus;
- kebab, right-click and Shift+F10 expose identical capability-derived actions;
- loading, first-use empty, filtered empty, partial, stale, unknown, permission, write failure,
  read-back pending and conflict are honest and recoverable;
- keyboard path, visible focus, screen-reader names, dark/light, 1440x900, 1280x720, 200% text and
  390x844 without document overflow or clipped actions;
- no raw UUID/enum/ISO/developer copy as the primary business label; status is not color-only.

## 6. Mandatory negative matrix

- preparer/self-approver, Viewer, Admin without business binding, expired delegate, unrelated
  project and foreign tenant;
- duplicate retry and same key with different payload;
- stale expectedVersion concurrent write;
- stale source after freeze; mismatched Portfolio/Plan/Capacity identity and time basis;
- mandatory QMS removed without governed reason; envelope overrun treated as in-tolerance;
- unknown availability rendered as zero/utilization/green;
- Task completion without evidence, AI material approval, second active Case;
- Finance/KPI actual copied into Execution/Report; effectiveness inferred only from hitting target;
- published Report Run overwritten; cross-tenant distribution; archived ordinary mutation.

## 7. Evidence and scoring

Every material step requires exact SHA/environment/tenant/project/actor, IDs and versions, before
and after read-back, command receipt/correlation, aggregate/audit/outbox reconciliation, retry or
denial evidence and a UI screenshot where applicable.

Each discipline scores ten assertions at 0/0.5/1 or five categories at 0/1/2. Acceptance requires
`>=9.0/10` from each expert and zero automatic fail. Any unexecuted assertion remains
`NOT VERIFIED` and prevents the final report from claiming acceptance.

## 8. Current execution ledger — 2026-08-12

- demo `/ping`: PASS;
- demo `/api/health`: PASS, PostgreSQL and Redis connected;
- demo `gitSha`: `b788968a14fd8acd5c0efe5da872ba8dc1b663a2`;
- new three-Initiative realDB case:
  `tests/integration/initiatives-execution/nordwerkThreeInitiative.realdb.test.ts` — `1/1 PASS`;
- complete Initiatives/Execution realDB suite on disposable pgvector PostgreSQL:
  `39/39 files, 89/89 tests PASS`;
- complete Initiatives/Execution unit suite plus shared StandardTable contract:
  `60/60 files, 154/154 tests PASS`;
- full ACO browser golden thread plus WCAG 200%/390x844:
  `3/3 PASS`;
- repository typecheck, new-test focused ESLint and `git diff --check`: PASS.

The new realDB proof establishes three source-backed Initiative lineages, constrained Portfolio
decisions, QMS-before-ACO Plan lineage, exact Plan→Capacity periods and an UNKNOWN supply with
null ranges. The existing ACO browser journey supplies the complete Execution/Closure/Archive path.

## 9. Remaining gate before five scores may be issued

The current Codex execution channel does not expose callable control of the user's logged-in browser.
Therefore a fresh independent live-demo click/visual round for the exact candidate remains
`NOT VERIFIED`. Historical exact-SHA screenshots are useful prior evidence, but the five experts
will not assign terminal scores from old screenshots alone. Once direct browser control is available,
repeat the nine-function P0 checklist on the logged-in owner account and attach the new evidence to
this ledger.
