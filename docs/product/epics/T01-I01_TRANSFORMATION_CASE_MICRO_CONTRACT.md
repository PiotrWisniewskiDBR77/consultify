# T01-I01 — Teresa Mandate to Transformation Case and Plan Proposal

> Status: `PROPOSED FOR OWNER REVIEW`
> Parent epic: `EPIC-AGENT-T01_AUTONOMOUS_TRANSFORMATION_END_TO_END.md`
> Mutation scope: create draft Transformation Case and draft plan only
> Explicitly excluded: Ideas, Interview, DRD, Finance, KPI, Initiative and output mutations

> Evidence-status note: this file is the immutable I01 boundary contract, not
> the current delivery register. Later T01 v24 evidence supersedes its
> then-future adapter status; current acceptance remains governed by the final
> DOD audit and delivery matrix.

## 1. User transition

Before:

- user can discuss transformation in Teresa;
- Agent plans exist as disconnected tool-step plans;
- no durable cross-module transformation identity exists.

After:

- user asks Teresa to prepare a transformation plan;
- system creates exactly one draft Transformation Case;
- Agent produces one reviewable full-lifecycle plan proposal bound to that case;
- user can open the case and plan from chat/My Work;
- no downstream business artifact is silently created.

## 2. Command contract

Example input:

```json
{
  "conversationId": "conversation-id",
  "organizationId": "from-auth-context",
  "projectId": "active-project-id",
  "mandate": "Przygotuj plan transformacji dla tej organizacji",
  "desiredOutcomes": [
    "poprawa efektywności operacyjnej",
    "cyfryzacja procesów",
    "zdolność wykorzystania AI"
  ],
  "horizon": null,
  "sponsorUserId": null,
  "sourceRefs": []
}
```

Organization and user identity must come from authenticated server context, never from trusted client payload.

## 3. Transformation Case minimum schema

Required fields:

- `transformationCaseId`;
- `organizationId`;
- `projectId`;
- `conversationId`;
- `initiatedByUserId`;
- `mandate`;
- `desiredOutcomesJson`;
- `status = draft`;
- `lifecycleStage = mandate`;
- `autonomyLevel = A1_prepare`;
- `sourceRefsJson`;
- `assumptionsJson`;
- `missingInputsJson`;
- `activePlanId`;
- `lineageId`;
- `idempotencyKey`;
- `createdAt`, `updatedAt`;
- `version`.

Constraints:

- tenant/project foreign-key or application-level membership integrity;
- unique `(organizationId, idempotencyKey)`;
- non-empty mandate;
- lifecycle/status checks;
- active plan belongs to the same organization and case;
- optimistic version control.

## 4. Plan proposal contract

The first proposed plan includes all T01 lifecycle phases as business steps, even though later adapters are not yet executable.

Each step contains:

- `stepId`;
- `transformationCaseId`;
- `lifecycleStage`;
- `businessPurpose`;
- `moduleTarget`;
- `capabilityStatus`;
- `inputs[]`;
- `outputs[]`;
- `ownerRole`;
- `dependsOn[]`;
- `approvalClass`;
- `riskClass`;
- `executionMode`;
- `estimatedEffort`;
- `status = proposed`;
- `blockerReason?`.

Honesty rule:

- a step whose adapter is not connected must say `NOT_CONNECTED`;
- a plan proposal may describe the complete target without claiming every step is executable;
- Run is not enabled for the whole plan until required adapters pass capability checks.

## 5. Lifecycle transitions

Allowed in I01:

- case: `draft -> plan_proposed`;
- plan: `draft -> proposed -> pending_review`;
- case/plan may be cancelled;
- plan may be revised into a new version.

Not allowed in I01:

- `approved_for_execution` for the complete T01 plan;
- lifecycle advancement to discovery;
- downstream artifact creation;
- auto-approval.

## 6. API behavior

Required operations:

- create case from authenticated mandate;
- get case by ID, tenant/project guarded;
- list cases visible to current user;
- get active plan proposal;
- revise mandate/plan draft with version check;
- cancel draft case;
- create/read audit timeline.

Cross-tenant reads return not-found semantics where required by platform policy.

## 7. Idempotency

Repeating the same chat action/request with the same idempotency key:

- returns the existing case and active plan;
- does not create a duplicate case, run or plan;
- records retry/correlation metadata without duplicating the business event.

A materially changed mandate requires a new explicit plan version, not reuse of the old approval payload.

## 8. Audit events

Minimum events:

- `transformation_case.created`;
- `transformation_plan.drafted`;
- `transformation_plan.proposed`;
- `transformation_plan.revised`;
- `transformation_case.cancelled`;
- `transformation_case.idempotent_replay`.

Each event records actor, organization, project, conversation, case, plan/version, correlation, timestamp and payload digest.

## 9. UI result

Teresa response shows:

- Transformation Case title/mandate;
- desired outcomes;
- assumptions and missing inputs;
- full phase list with capability truth;
- plan version and review state;
- `Otwórz plan` action;
- disabled or guarded `Uruchom` with explanation until executable coverage is sufficient.

My Work Agent hub shows the case/plan without creating a competing local object.

## 10. Acceptance tests

### Contract/unit

- schema accepts valid case and rejects empty mandate;
- lifecycle rejects illegal transition;
- plan compiler emits all required T01 stages;
- capability truth never upgrades missing adapters;
- version and idempotency rules are deterministic.

### Integration/realDB

- authenticated create persists case, plan, steps and audit events;
- readback returns the same values and lineage;
- retry creates no duplicate rows;
- organization/project guards deny unauthorized access;
- transaction failure leaves no orphan case/plan/steps;
- migration succeeds on fresh PostgreSQL schema.

### UI/E2E

- Teresa mandate creates and renders one case/plan;
- refresh/reopen preserves it;
- open-plan route works;
- capability gaps are visible;
- no Ideas/Interview/DRD/Initiative rows are created;
- light/dark evidence is captured.

## 11. I01 Definition of Done

I01 is accepted only when:

- one current canonical SHA contains schema, service, API, plan compiler and UI binding;
- real PostgreSQL create/readback/idempotency/tenant tests pass;
- no competing case truth is introduced;
- existing Agent plan behavior remains regression-safe;
- capability-status honesty is visible;
- audit events are queryable;
- visual evidence maps route, state, role, viewport and SHA;
- Product accepts the user transition before I02 begins.
