# A03 — editable planning workshop evidence

Date: 2026-08-08
Scope: local candidate; not final epic acceptance

## Delivered

- A plan revision can carry the complete edited step graph, including order and dependencies.
- Validation runs before persistence and rejects duplicate lifecycle stages, unknown dependencies, self-dependencies and transitive cycles.
- Saving creates a new immutable plan version, resets it to `pending_review`, updates the canonical run's `plan_version` and writes an audit event.
- Transformation Cases presents dependency inputs, move-up/move-down controls and an explicit “save new plan version” action before plan approval.

## PostgreSQL proof

Database: `consultify_agent_a03_proof_20260807`
Script: `server/src/scripts/a03PlanningWorkshopRealDbProof.ts`

```json
{
  "proof": "A03_REALDB_GREEN",
  "reorderedPersisted": true,
  "graphValidatedBeforeWrite": true,
  "version": 2,
  "approvalReset": true,
  "canonicalRunPlanVersion": 2,
  "audit": true
}
```

## Automated proof

- Focused plan compiler/service and Transformation Cases DOM suites: `26/26` PASS.
- Full repository TypeScript check: PASS with an 8 GB Node heap.

## Safe rich step editor

The `plan_proposed` workshop now edits business purpose, target module, inputs, outputs, owner, dependencies, approval class, risk class, execution mode and estimated effort. Users can add and remove steps; the UI blocks removal of a lifecycle stage while retained steps still depend on it and names those dependants. Lifecycle identity, capability status and blocker reason are displayed read-only.

Every persisted existing step is addressed through `sourceStepId`. Inside one pinned PostgreSQL transaction the service locks the tenant-scoped Case and active-plan step rows before authoritative validation and compilation. An existing source step must preserve its lifecycle stage, capability status and blocker reason. A new step must use a `custom_` lifecycle identity, remain `PROPOSAL_ONLY` and carry a non-empty blocker. Unknown or duplicate source identities, forged `REAL`, forged lifecycle identity and referenced removal fail closed.

Fresh PostgreSQL database: `consultify_agent_a03_rich_editor_proof_20260808`.

```json
{"proof":"A03_REALDB_GREEN","version":3,"richFieldsPersisted":true,"safeCustomStepAddedAndRemoved":true,"authoritativeCapabilityTruth":true,"concurrencyExactlyOne":true,"rejectedGraphAndInsertRollback":true,"tenantAndActorFailClosed":true,"approvalReset":true,"canonicalRunPlanVersion":3,"audit":true}
```

The proof persisted the edited 15-step plan, added a safe custom step and removed it in the following version. Two concurrent revisions with one expected version produced exactly one version 2. Forged capability/lifecycle commands, a dependency cycle, foreign tenant and missing actor failed closed. A trigger-forced step insert failure rolled back the candidate plan and left Case version, plan count and audit count unchanged. The successful removal produced version 3, reset the plan to `pending_review`, updated canonical-run `plan_version` and wrote exactly the expected revision audit.

## Durable clarification intake

Teresa no longer creates a Transformation Case and 15-step plan immediately from an underspecified transformation-plan command. The durable planning intake moves through `needs_clarification -> ready -> converted` and normalizes the mandate plus four exact required fields: `measurable_outcomes`, `sponsor`, `scope` and `horizon`. The intake is tenant-, project-, conversation- and actor-bound and uses a durable idempotency key.

The fresh proof was run after a clean T01 schema replay:

```json
{"proof":"A03_PLANNING_CLARIFICATION_REALDB_GREEN","exactMissingKeys":true,"zeroPrematureCaseWrites":true,"statuses":["needs_clarification","ready","converted"],"concurrentConversion":2,"cases":1,"plans":1,"canonicalRuns":1,"conversionAudits":1,"idempotentReplay":true,"crossTenantFailClosed":true,"actorFailClosed":true}
```

An incomplete command created one durable intake and zero Case, plan or execution-run rows. Partial answers remained blocked. After all four fields were supplied, two concurrent conversion calls plus a replay produced exactly one Transformation Case, one plan version 1, one canonical run and one intake-to-Case conversion audit. Cross-tenant and wrong-actor access failed closed. Focused clarification and intent tests: `9/9` PASS. Full repository TypeScript check: PASS with an 8 GB Node heap.

## Governed template-to-intake conversion

A published process-template version may now carry a validated 15-step planning blueprint alongside its legacy Work Graph runtime bundle. The immutable version stores a SHA-256 digest over the complete template content. Selecting “Use for transformation” requires an `Idempotency-Key` and pins the exact template ID, version, version ID, full digest and copied blueprint snapshot into the durable intake. Clarification updates the mandate fields without changing any pinned template reference. Draft and foreign-tenant templates fail closed; a version pinned while published remains convertible if the template is later deprecated.

Conversion has its own required idempotency key and runs on one pinned PostgreSQL transaction. It creates one Transformation Case, plan v1 with exactly 15 pinned steps, context snapshot, canonical execution run, run identity, intake-to-Case link, explicit template lineage, conversion audit, template governance event, usage increment and conversion receipt. A trigger-forced audit failure rolls all of those writes back together.

Fresh PostgreSQL database: `consultify_agent_a03_template_intake_proof_20260808`.

```json
{"proof":"A03_TEMPLATE_INTAKE_REALDB_GREEN","publishedVersionPinned":true,"immutableSnapshotAfterClarification":true,"zeroPrematureCaseWrites":true,"deprecationAfterPinConvertible":true,"concurrencyExactlyOnce":2,"cases":1,"plans":1,"canonicalRuns":1,"lineageAudits":1,"templateEvents":1,"usageIncrement":1,"replayNoDuplicates":true,"startAndConvertConflictFailClosed":true,"draftForeignTenantActorDenied":true,"forcedFailureRolledBackAll":true,"canonicalPlanSteps":15,"noPastedRunId":true}
```

Two concurrent conversions returned the same identifiers and produced exactly one Case, plan, context snapshot, canonical run, identity, intake link, lineage audit, template event, usage increment and receipt. Start and conversion replays created no duplicates; reusing either key with different content failed with a payload conflict. The template source/version remained unchanged. The UI exposes defaults and exact missing keys, performs clarification inline and deep-links to the created canonical Case without asking for a Run ID. Focused service, route and DOM evidence passed `17/17`; the refreshed A12 legacy Work Graph regression remained GREEN and the full TypeScript check passed.

## Remaining acceptance boundary

A03 remains `PARTIAL` only at the release-evidence boundary: same-SHA deployed HTTP/browser proof for template selection, clarification and the complete edit-review-approve-execute sequence remains.
