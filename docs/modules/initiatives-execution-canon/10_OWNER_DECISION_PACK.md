---
doc_id: initiatives-execution-owner-decision-pack
truth_type: owner_decision_input
status: partially_decided
owner: product-owner
version: 1.0
last_reviewed: 2026-08-09
---

# Owner decision pack before coding

This file collects only decisions that materially affect schema, authority, irreversible behavior or implementation scope. Recommended defaults allow one focused owner review instead of ad hoc decisions during coding.

## OD-01 `CANCELLED`, `REJECTED` and `STOPPED`

**Owner decision 2026-08-09: ACCEPTED.**

### Recommendation

- `REJECTED` — disposition before substantive approval; a new attempt requires a new version/candidate.
- `STOPPED` — governed termination after `SCHEDULED` or `IN_EXECUTION`; requires impact, closure/replacement and residual-risk handling.
- `CANCELLED` — technical/administrative invalidation only: duplicate created in error, corrupted setup or formally withdrawn before decision. It must not replace business rejection or execution stop.

### Impact

Requires separate disposition value, reason code, actor, decision reference and effective time. Legacy `CANCELLED` is ambiguous and must enter migration review.

## OD-02 Governance profiles

**Owner decision 2026-08-09: ACCEPTED WITH CONFIGURABILITY.** The product baselines are cloneable. Organization sets the default, project may override it, Initiative may be escalated, and downgrade requires an audited Decision.

### Recommendation

- `Lite`: Project Leader registers; Sponsor Go/No-Go; Project Leader schedules within approved tolerances.
- `Standard`: Initiative Owner + domain reviews; Portfolio Owner/Sponsor decision; Resource Owners confirm capacity; Execution Manager accepts handoff.
- `Complex`: formal board/quorum, staged funding, regulatory/domain approvals, independent risk/challenge, wave/cutover and benefits governance.

Profile is versioned per Initiative and every gate Decision records the effective policy version. Teresa recommends; an authorized human confirms. Authority, quorum, delegation, self-approval, separation-of-duties, evidence, SLA and materiality are profile configuration, not hard-coded job titles.

## OD-02A Lifecycle and Initiative cards

**Owner decision 2026-08-09: ACCEPTED.**

- the common twelve-state lifecycle is fixed across organizations;
- organizations configure gates and working phases, not the main lifecycle states;
- the 26-card catalog is closed;
- template or Initiative may include, omit and reorder only existing catalog cards;
- omitted cards retain their data/history and required cards need configured waiver/Decision;
- custom fields and auxiliary sections are permitted but do not define new business-card types;
- Admin configures card requiredness, fields, reviewers, freshness and waiver rules, while security/audit/immutable snapshots remain mandatory.

## OD-03 Default review SLAs

### Recommendation

Use configurable business-day defaults, never hardcoded promises:

- source validation: 3 days;
- definition review: 5 days;
- domain analysis response: 5 days;
- portfolio decision: 7 days;
- schedule/capacity confirmation: 5 days;
- execution handoff acceptance: 2 days;
- delivery acceptance: 5 days;
- effectiveness review: 10 days after measurement window.

Reminder at 60% and 90%; overdue at 100%; escalation route depends on governance profile. SLA pause requires reason and audit.

## OD-04 Materiality and tolerances

### Recommendation

Do not ship universal numeric thresholds. Store organization/project policy with dimensions:

- schedule variance;
- cost variance;
- scope/outcome change;
- residual risk;
- resource commitment;
- privacy/regulatory impact.

Absence of configured tolerance means escalate to Sponsor/PMO, not automatic approval.

## OD-05 Minimum model activating full Zasoby

### Recommendation

Full `Zasoby` becomes writable only when all exist:

- canonical Person/Team/Role/Skill identity;
- availability by explicit time bucket and unit;
- Assignment with requested/accepted/rejected state;
- task/work-package remaining estimate in compatible unit;
- calendars/non-project load or explicit unknown coverage;
- cost/rate access policy where Money is shown;
- version/concurrency, audit, idempotency and read-back.

Without this, ship constraint visibility as `PARTIAL` in Sterowanie/Realizacje; do not show exact utilization or writable balancing.

## OD-06 Initiative to Execution cardinality

**Owner decision 2026-08-09: ACCEPTED.**

### Recommendation

One Initiative has one active Execution Case at a time, with versioned phases/waves inside it. Additional delivery units are Workstreams/Waves, not parallel shadow Initiative executions. Reopening creates a new execution episode/version under the same Initiative identity, preserving history.

## OD-07 Archive and retention

### Recommendation

- Archive is read-only and reversible only by Governance Admin with reason.
- Closed records enter archive according to configurable retention policy.
- audit, decisions, source lineage and financial/compliance references are never deleted by ordinary UI archive.
- legal hold blocks deletion/anonymization where policy requires.
- exact retention durations remain organization/compliance configuration.

## OD-08 AI at hard governance gates

### Recommendation

- AI readiness failure must fail closed for a hard gate.
- System may permit human exception only through explicit exception decision with evidence, authority, expiry and audit.
- AI may draft and challenge; it never becomes approver or quorum member.
- model/prompt/policy/source versions are retained with recommendations used in decisions.

## OD-09 Event and command reliability

### Recommendation

Material commands require aggregate version plus idempotency key. Persistence, audit and required read-model trigger must be transactional or use a durable outbox. Best-effort fire-and-forget is insufficient for status, approval, handoff, allocation, baseline, report publication or closure.

## OD-10 Mobile scope

### Recommendation

Mobile supports read, preview, comments, simple Task state and authorized Decision action. Complex scenario editing, timeline drag, capacity simulation, resource reallocation, rebaseline and report design remain desktop/tablet until dedicated mobile workflows are accepted.

## Decision record template

For each item record:

```yaml
decision_id: OD-XX
decision: accepted | modified | rejected | deferred
chosen_rule:
rationale:
effective_version:
decided_by:
decided_at:
affected_docs:
schema_or_migration_impact:
```

OD-01, OD-02/OD-02A and OD-06 are owner-accepted. OD-05, OD-08 and OD-09 are accepted as architecture recommendations but still require runtime evidence in their affected slices. The package remains blocked from unconditional `READY_FOR_CODING` where resource truth, hard-gate AI enforcement or reliable command/outbox infrastructure is not proven; safe read-only/degraded slices may proceed.
