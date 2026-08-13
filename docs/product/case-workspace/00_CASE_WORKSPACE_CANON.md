# Case Workspace / Zlecenia — canon

> Status: `APPROVED_SPEC / RUNTIME_PARTIAL`
> Owner: Product + Engineering
> Owner decisions: approved 2026-08-09
> Scope: product, UX and technical foundation for Teresa-led durable work

## 1. Purpose

This package defines the code-ready target for a lightweight Case Workspace in Consultify. It consolidates the earlier Agent Execution V8, Agent Transformation and Run Agent documents around one product rule:

> Every durable work order accepted by Teresa has one Case. Consultify modules remain fully usable without Teresa and without a Case.

In Polish product copy the user-facing term is `Zlecenie`. `Case` remains the canonical domain and engineering term.

## 2. Product contract

Consultify supports two equal modes of work:

1. **Direct module work** — the user works in Interview, Assessment, Finance, KPI, Decisions, Initiatives, Documents or another owning module. A Case is optional.
2. **Teresa-led work** — the user delegates a durable result to Teresa. After an explicit confirmation Teresa creates exactly one Case and conducts the work through its plan, execution and results.

An informational answer, exploration or ordinary conversation does not create a Case. A direct module artifact can later be linked to a Case without copying or changing its canonical owner.

## 3. One object, proportional governance

There is no separate Engagement, Job or Teresa Run domain object for lightweight work. The Case profile determines proportional behavior:

- `LIGHT` — a small, bounded work order;
- `STANDARD` — multi-step or multi-module delivery;
- `TRANSFORMATION` — governed, material and long-running change;
- `MONITORING` — measurement of value, KPI or sustainability.

Profiles do not create separate lifecycles or runtimes. A Case can be promoted to a stronger profile without migration to another object.

## 4. Three product phases

The primary workspace is:

`Plan | Realizacja | Rezultaty`

- **Plan** defines the result and the nearest safe execution horizon.
- **Realizacja** shows what is happening, what requires attention and who or what owns the next move.
- **Rezultaty** exposes accepted deliverables, decisions, evidence, lineage and measured value.

These are projections of one Case. They are not separate stores or products.

## 5. Lightweight UI doctrine

Case Workspace establishes the new lightweight Consultify UI standard:

- high information density with low visual weight;
- compact semantic elements and restrained borders;
- one dominant work surface;
- no permanent palette or configuration wall;
- contextual `+`, popover, drawer and command palette;
- progressive disclosure from business outcome to technical diagnostics;
- Simple, Expert and List views over one canonical graph;
- no current heavy builder promoted unchanged as the expert target;
- mobile uses a semantically equivalent list, not a compressed desktop canvas.

The initial host is My Work. The workspace must not depend on My Work layout so it can later be embedded beside or inside the main Teresa Chat without creating another planner or runtime.

## 6. Teresa and autonomy

Teresa is the public identity and orchestrator. Users do not manage a catalogue of agents. Modules, models, MCP servers, APIs, connectors and specialist executors are capabilities behind Teresa.

Every Case has one visible autonomy policy:

1. `ASK_EACH_ACTION` — ask before every execution step;
2. `ASK_MATERIAL_ACTIONS` — execute safe work and stop at material actions; default;
3. `EXECUTE_APPROVED_PLAN` — execute the entire disclosed plan and stop only at hard policy boundaries or material scope changes.

The organization sets the maximum allowed level. A user may choose a lower level. No level bypasses tenancy, permissions, policy, declared scope, cost/time limits, audit or mandatory legal and organizational approvals.

## 7. Confirmation contract

Teresa may prepare an ephemeral proposal from conversation. A canonical Case is created only after the user confirms an exact work-order summary by button or unambiguous language. Silence and continued conversation are not confirmation.

For a safe `LIGHT` Case one action may approve the contract, publish plan v1 and start execution: `Zatwierdź i rozpocznij`. Standard, Transformation and material Cases separate contract, plan publication, start and consequential approvals.

## 8. Results and value

Artifacts remain owned by their modules and are linked using typed, revision-aware references. A generated file is not automatically an accepted deliverable. Delivery, Decision, Implementation and Outcome are separate closure levels.

Short value measurement can remain in the originating Case. Long measurement or changed accountability can create a linked `MONITORING` Case. The source Case then closes honestly, for example `IMPLEMENTATION_COMPLETED / OUTCOME_PENDING`.

## 9. Plays and quality

Every user may create private Play drafts. Publishing a reusable Play to a team or organization requires an authorized publisher or review. Published Play versions are immutable.

Independent challenger review is proportional. It is mandatory for material recommendations, decision packs, key financial models and controlled/high-risk Cases; it is not ceremonial overhead for every lightweight deliverable.

## 10. Authoritative invariants

1. Durable Teresa work creates exactly one Case after explicit confirmation.
2. Informational Chat creates no Case.
3. Direct module work remains fully supported without Case or Teresa.
4. Case references module artifacts and never forks their business truth.
5. Plan versions are immutable after publication.
6. Every Run is bound to an exact plan version and semantic digest.
7. Runtime status belongs to Run and NodeRun, not definition nodes.
8. Simple, Expert and List edit one canonical graph.
9. Chat and My Work use one domain core and one execution truth.
10. Waits, human work and external work are durable first-class runtime semantics.
11. Approval is bound to an exact proposal version and material digest.
12. `PARTIAL`, `UNKNOWN`, `BLOCKED` and `EVIDENCE_MISSING` are never promoted to success.
13. History is append-only and value is not inferred from completed steps.
14. Legacy AgentPlan may be an adapter, never a second authoritative runtime.

## 11. Package map

- `01_PRODUCT_CANON_AND_MODES.md`
- `02_INFORMATION_ARCHITECTURE_AND_UX.md`
- `03_INTERACTION_RESPONSIVE_ACCESSIBILITY.md`
- `04_DOMAIN_RUNTIME_AND_STATE_MACHINES.md`
- `05_CANONICAL_GRAPH_CAPABILITIES_AND_APIS.md`
- `06_SECURITY_EVENTS_OBSERVABILITY.md`
- `07_LEGACY_MIGRATION_AND_DELIVERY_PLAN.md`
- `08_GOVERNANCE_AUTONOMY_APPROVALS.md`
- `09_HISTORY_VALUE_REUSE_AND_PLAYS.md`
- `10_TEST_ACCEPTANCE_AND_GOLDEN_CASES.md`
- `11_OWNER_DECISION_REGISTER.md`
- `12_CASE_WORKSPACE_MODULE_SSOT.md`
- `13_CLAUDE_MULTI_AGENT_IMPLEMENTATION_MASTER_PLAN.md`
- `14_COMPLETE_DOD_EPICS_ACCEPTANCE_AND_CLAUDE_PROMPT.md`

## 12. Authority and supersession

This package refines the earlier Run Agent agreements and Agent Transformation documents for the unified lightweight and transformation-capable Case model. Existing module SSOTs continue to own their artifacts and legal mutations. Agent Execution V8 continues to own governed runtime behavior where it does not conflict with the owner-approved decisions recorded here.

Conflict order for this scope:

1. owner-approved decisions in `11_OWNER_DECISION_REGISTER.md`;
2. this canon and its package documents;
3. Agent Execution V8 SSOT and product charter;
4. prior Run Agent agreements and transformation proposals;
5. implementation as-is.
