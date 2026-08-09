# Case Workspace — product canon and modes

> Status: `APPROVED_PRODUCT_DIRECTION / IMPLEMENTATION_PARTIAL`
> Date: 2026-08-09
> Owner: Product Owner (Piotr) + Product Architecture
> Scope: the user-facing `Zlecenie`/Case model, Teresa-orchestrated work and direct module work
> UI parent: `docs/ui-standards/CANON.md`
> Runtime parents: `docs/product/AGENT_EXECUTION_V8_SSOT.md`, `docs/product/AGENT_TRANSFORMATION_LIFECYCLE_CANON_V1.md`

## 1. Purpose and authority

This document freezes the approved product meaning of Case Workspace. It does not replace the UI canon, module canons or runtime contracts. Where an existing implementation differs, the implementation is a migration source, not a competing product model.

The product promise is:

> In Consultify a user may perform specialist work directly in a module or ask Teresa to plan and conduct any size of work, from one Interview to a complete transformation, using the same canonical data and owner modules.

## 2. Approved owner decisions

The following decisions are closed:

1. There is **one Case**, not a separate chat case, agent case and module case.
2. Direct module work and Teresa-orchestrated work are equal first-class modes.
3. Interview, Assessment, Finance, KPI, Initiative, Documents and other modules remain independently usable products.
4. Teresa is the public identity of the orchestration intelligence. `Agent` is a technical/runtime term.
5. The Polish user-facing term is **Zlecenie**. `Case` remains the domain/API term. A large Case may be labelled `Zlecenie transformacyjne`.
6. A Case is not a mandatory wrapper for every activity.
7. A module object may be attached to a Case later without copying it or changing its canonical identity.
8. Three autonomy levels are supported and visible before execution.
9. A small, safe, unambiguous one-step request may be started with one click.
10. The default UI is lightweight. Governance, graph configuration and diagnostics use progressive disclosure.

## 3. Product mental model

### 3.1 Direct work

The user knows what to do and opens the owning module. Examples:

- create and conduct one Interview;
- run one Assessment;
- build a Finance model;
- define or update a KPI;
- create an Initiative or document.

The resulting object is complete and valid without Teresa and without a Case.

### 3.2 Teresa-orchestrated work

The user states an outcome. Teresa clarifies only material ambiguity, proposes a reviewable plan, explains autonomy and approvals, and conducts the approved work through the same module capabilities.

The scale is continuous:

`one Work Item -> one-step flow -> small multi-step flow -> cross-module Case -> transformation Case`

There is no architectural or UX threshold that creates a second Consultify at any point on this continuum.

### 3.3 One Case

A Case is the durable context for coordinated, outcome-oriented work. It references canonical module objects and contains:

- mandate, scope, outcome and definition of done;
- organization, tenant and optional project context;
- owners, participants and authority;
- versioned plan definitions;
- Runs pinned to exact plan versions;
- approvals, exceptions and audit;
- references to evidence and native deliverables;
- results, benefits and sustainability state.

A Case is justified when one or more of these are present:

- multiple related results or modules;
- decisions or approvals;
- multiple participants;
- long-running, resumable or monitored work;
- shared evidence, lineage, governance or value tracking.

For a small safe request the system may create the minimal durable Case/Run representation as part of the one-click action, but must not force a project-like setup ceremony or imply that all direct module work is incomplete without it.

## 4. Canonical objects and boundaries

| Object | Meaning | Invariant |
|---|---|---|
| Conversation | Exploration and control context | It is not execution and does not silently mutate business state. |
| Work Item | Native module object or result | Its owning module and canonical identity never change because Teresa used it. |
| Case / Zlecenie | Durable outcome context | It references Work Items; it does not copy their business truth. |
| Plan Definition | Editable intended method | Draft is distinct from published version. |
| Plan Version | Immutable approved definition | Every Run names the exact version. |
| Run | One execution of one version | Runtime state never overwrites the definition. |
| Proposal | Exact proposed mutation or plan change | Material mutation requires policy-compliant decision. |
| Approval / Decision | Durable human authority record | It is version-bound and auditable. |
| Deliverable | Native result owned by a module | Case exposes a deep link and lineage, not a fork. |
| Outcome observation | Evidence of business value | `delivered`, `benefit achieved` and `sustained` are distinct. |

## 5. Three user-selectable autonomy policies

### `ASK_EACH_ACTION` — Pytaj przed działaniem

Teresa analyzes and proposes, then stops before every execution step. Use for
high uncertainty, sensitive scope, early discovery and users who want direct
control.

### `ASK_MATERIAL_ACTIONS` — Pytaj przy ważnych działaniach

Teresa executes safe work inside the approved plan and pauses at material
actions, declared approvals, missing input, changed scope, policy boundaries or
material risk. This is the default.

### `EXECUTE_APPROVED_PLAN` — Wykonaj cały zatwierdzony plan

Teresa executes the disclosed plan without artificial step approvals and stops
only at mandatory policy boundaries or material change. It never bypasses
tenant permissions, organization limits, scope, recipients, cost/time limits or
mandatory legal and organizational approvals.

These three user policies define when Teresa asks. They are distinct from the
internal V8 action classes `A0` through `A4`, which classify what an action is
allowed to do. The mapping and hard ceilings are defined in
`08_GOVERNANCE_AUTONOMY_APPROVALS.md`.

Every plan preview must show:

- selected autonomy level;
- actions Teresa may execute;
- actions that require approval;
- scope, recipients, data and connections;
- time, cost and stop conditions;
- reversibility and audit behavior.

The autonomy level cannot expand silently during a Run.

## 6. Entry and promotion rules

Canonical entry points are:

- direct module action;
- My Work `Nowe zlecenie`;
- a template/Play;
- an existing Idea, Finding, Assessment gap, Finance/KPI signal, Decision or Initiative;
- later, a free-form conversation with Teresa.

Conversation-to-work progression is:

`conversation -> proposed brief -> proposed plan -> explicit acceptance -> Case/Plan -> Run`

Exceptions:

- a direct factual answer creates no Case;
- `Otwórz moduł` transfers the user to direct work without Case;
- a small safe one-step proposal can expose one primary `Zatwierdź i rozpocznij` action, but the button still shows outcome, owner module, autonomy and side effect before execution.

## 7. Cross-mode invariants

1. One tenant and organization context per Case.
2. A Work Item has one canonical owner and identity.
3. Teresa calls owning services; she does not maintain private copies of module truth.
4. AI proposes; authorized humans decide material gates.
5. No silent execution, silent scope expansion or silent recipient change.
6. Every mutation has idempotency, readback and audit evidence.
7. Source, fact, assumption, inference and decision remain distinguishable.
8. Approved human work is protected during retry and rerun.
9. Changed upstream evidence marks downstream work stale.
10. Partial, blocked, failed, waived and skipped remain literal.
11. A file is not completion without its underlying business-state readback and lineage.
12. `Run complete` does not mean `benefit achieved`; `benefit achieved` does not mean `sustained`.
13. My Work remains the shared attention system for direct and orchestrated work.
14. Chat, Case Workspace and native modules are projections of shared truth, not parallel applications.

## 8. Lifecycle mapping

The full transformation lifecycle remains:

`mandate -> discovery -> interviews -> diagnosis -> opportunity system -> options/finance/KPI -> decisions/initiatives -> mobilization -> execution -> results/benefits -> sustainability/learning`

A Case may enter at a later stage, reuse valid existing Work Items and explicitly satisfy or waive prerequisites. The lifecycle is a completeness model, not a forced wizard for every Zlecenie.

## 9. Current code mapping and convergence boundary

This is a verified mapping pointer, not a claim of runtime completion:

| Concern | Current implementation source | Target disposition |
|---|---|---|
| My Work Run Agent surface | `src/components/AIChat/AgentHubShell.tsx`, mounted by `src/components/MyWork/MyWorkHub.tsx` | Evolve into the lightweight Zlecenia list and Case Workspace entry. |
| Current plan workspace | `src/components/AIChat/AgentPlanWorkspace.tsx`, `AgentPlanPanel.tsx`, `AgentPlanCanvas.tsx` | Treat as migration input; split simple Case Plan from Advanced Designer. |
| Current palette/catalog | `src/components/AIChat/AgentWorkshopPalette.tsx`, `agentWorkshopCatalog.ts` | Map to typed capabilities; unavailable executors remain disabled/`soon`. |
| Current AgentPlan API | `src/services/api/agentPlan.api.ts`, `server/src/routes/ai/agent-plan.routes.ts` | Adapter/migration source; must converge with canonical Case/Plan/Run rather than remain a second truth. |
| Scheduling | `server/src/jobs/agentPlanSchedulerJob.ts` | Reuse only behind canonical Run semantics and evidence. |
| Execution spine | `server/src/services/v8/executionSpineService.ts`, `executionVisibilityService.ts`, `server/src/routes/v8/execution.routes.ts` | Canonical candidate for proposals, approvals, visibility and Run controls; acceptance still requires exact-SHA proof. |
| Chat proposals | `server/src/services/v8/chatExecutionService.ts`, `server/src/types/chatExecutionIntegration.ts` | Thin chat projection; must not duplicate governance state. |
| Shared proposal types | `server/src/types/executionSpine.ts`, `packages/shared/src/types/domain/ai.ts` | Converge contracts before UI declares one model complete. |
| Route entry | `src/views/AgentPlanView.tsx`, `src/routes/routeConfig.ts` | Transitional route/deep-link compatibility; user-facing naming becomes Zlecenie. |

No implementation is accepted merely because it is listed here. Any divergence between documentation and code is reported, not hidden by UI adapters.

## 10. Acceptance contract

Product canon is implemented only when one exact candidate SHA proves:

- a direct Interview/Assessment/Finance/KPI flow works without Teresa or Case;
- the same native object can be linked into one Case without duplication;
- Teresa can propose and conduct a one-step, small multi-step and cross-module flow;
- all three autonomy levels are visible, enforced and audited;
- a safe small task has an honest one-click path;
- a material plan is reviewed before execution;
- Plan Definition, immutable version and Run remain distinct;
- restart/resume and idempotent replay preserve state;
- approvals are version-bound and tenant/project permissions are enforced;
- native deliverables open through stable deep links and return to the same Case context;
- partial/blocked/failed and value/sustainability states remain honest;
- browser, API, realDB and artifact evidence all identify the same SHA and deployment.

Until that evidence exists, implementation status remains `PARTIAL`.
