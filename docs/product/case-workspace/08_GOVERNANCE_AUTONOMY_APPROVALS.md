# Case Workspace — Governance, Autonomy and Approvals

> Status: Target Model 1.0
> Owner: Product + Engineering + Governance
> Scope: governance contract for direct module work, Case planning and governed execution
> Parent anchors: `AGENT_EXECUTION_V8_SSOT.md`, `AGENT_EXECUTION_V8_PRODUCT_CHARTER_DOD_AND_EPICS.md`, `AI_HUMAN_IN_THE_LOOP_GOVERNANCE_ARCHITECTURE_V8.md`, `CHAT_V8_ACTIONS_AND_APPROVALS.md`

## 1. Product boundary

Consultify supports two first-class modes:

1. **Direct module work** — a user may run an Interview, Assessment, Finance analysis, KPI review, Initiative or document workflow without Teresa and without a Case.
2. **Orchestrated work** — Teresa may coordinate one bounded assignment or a complete Case across owning modules.

Teresa is an invited engagement partner and orchestrator, not a mandatory gateway and not the owner of module objects. Human and agent paths must call the same owning domain services and create the same canonical artifacts.

A conversation may remain conversational. It may produce an ephemeral draft without creating a durable Case. A durable Case requires explicit confirmation of Teresa's exact work-order summary, by button or unambiguous language; silence and conversational continuation do not qualify. A contracted Case additionally requires the approval semantics below. For a safe `LIGHT` Case, one literal `Zatwierdź i rozpocznij` action may create the Case, approve its contract, publish plan v1 and start it.

## 2. Proportionate governance tiers

### 2.1 Direct module task

Use when the expected result is bounded, has one clear owner, needs no cross-domain coordination and creates no material organizational commitment. Preserve source, owner and artifact lifecycle as required by the module.

### 2.2 Lightweight Case

Use when work needs multiple actions, hand-offs, resumability, synthesis or a limited approval, but does not justify full PMO overhead. Minimum contract:

- outcome or decision needed;
- accountable owner;
- short milestone plan;
- evidence digest;
- explicit material actions;
- completion criteria.

### 2.3 Standard Case

Use for multi-module work with several owners, formal Decisions or Initiatives, material replanning, domain QA, and delivery or implementation tracking.

### 2.4 Transformation Case with `CONTROLLED` governance

Required when any trigger applies: material budget, executive or client impact, regulated or sensitive data, external or hard-to-reverse action, high downside, formal ROI, several Initiatives, formal publication, or dual-control obligation.

`TRANSFORMATION` is the Case profile; `CONTROLLED` is its typical governance tier. A smaller profile may also be promoted to `CONTROLLED` before a material action. Controlled governance adds stage gates, independent challenge, change control, risk/dependency register, resource envelope, recovery evidence and a measurement plan.

Step count never determines the tier. Consequence, reversibility, access, accountability and audit need do.

## 3. Exact autonomy levels and hard ceilings

### 3.1 User-selectable Case policy

Each Case exposes exactly three policy levels:

1. `ASK_EACH_ACTION` — stop before every execution step.
2. `ASK_MATERIAL_ACTIONS` — execute safe work and stop at material actions; this is the default.
3. `EXECUTE_APPROVED_PLAN` — execute the disclosed approved plan and stop at hard policy boundaries or material change.

The organization sets the maximum. The user may select a lower level, never a higher one. These policies govern when Teresa must ask; they do not replace the execution action classes below.

Hard ceilings for all three policies:

- tenant, project, membership, permission and data policy are never bypassed;
- declared scope, recipients, target systems, cost/time limits and validity windows remain binding;
- formal business Decision, unapproved material commitment, policy override and prohibited action cannot be delegated by choosing a higher level;
- material scope, recipient, cost, data class, target system or commitment change stops execution for a new proposal/replan;
- every mutation remains typed, attributable, idempotent where required and auditable.

### 3.2 Execution action classes

The canonical levels remain those defined by Agent Execution V8. A Run exposes one current level; authorization may be narrowed by policy but never silently widened.

### A0 — advise

May answer, explain and recommend.

Hard ceiling:

- no durable proposal required unless the user elects to save one;
- no canonical mutation;
- no external action;
- no claim that work was executed.

### A1 — prepare

May research, analyze, create private drafts, simulate, and prepare typed proposals or plans.

Hard ceiling:

- outputs remain `DRAFT` or `PROPOSED`;
- no publication, formal Decision, owner assignment, budget commitment or target change;
- no mutation represented as approved or final;
- uncertainty and missing evidence remain literal.

### A2 — execute safe work

May perform policy-allowed, reversible internal actions through owning module services.

Hard ceiling:

- action class, target type, data class, cost/time envelope and validity window must be pre-authorized;
- tenant, project, membership and role checks still apply;
- every mutation requires audit, idempotency and readback;
- no formal Decision, Initiative launch, budget commitment, external publication, rights-sensitive promotion, destructive action or material scope change;
- cumulative actions must stop when their aggregate effect crosses the approved envelope.

### A3 — execute approved work

May apply a material mutation only after valid human approval of an exact proposal/version.

Hard ceiling:

- approval cannot be inferred from chat, silence or prior approval of another version;
- no self-approval by Teresa or the proposing agent;
- no execution outside the approved target, scope, amount, recipients or time window;
- destructive, regulated, high-impact or externally binding actions require step-up controls and, where policy requires it, dual control;
- execution does not itself prove validation, acceptance or outcome.

### A4 — monitor

May continue scheduled or event-driven observation within an approved mandate, create observations and request attention.

Hard ceiling:

- no expansion of scope, data access, recipient set or corrective action class;
- no autonomous formal interpretation of a target as achieved;
- no automatic material remediation unless that exact class is separately authorized at A2 or A3;
- mandate expiry, stale data, policy change or exceeded resource envelope stops the monitor;
- long-lived monitoring may be a separate linked Monitoring Case with its own owner, mandate, cadence, acceptance and closure.

## 4. Approval semantics

The system distinguishes:

`intent -> confirmation -> authorization -> execution -> validation -> acceptance`

These states must never be collapsed.

Natural language may confirm context, authorize A0/A1 work and explicitly confirm Teresa's exact work-order summary to create a Case. It is insufficient for A3/A4 commitments, plan publication, formal Decision, Initiative launch, budget use, shared publication, external action or Case closure. A safe `LIGHT` Case may use the single combined confirmation defined above; larger or risky Cases separate contract, plan publication, start and material approvals.

Every formal approval binds:

`proposal_id + exact_version + material_hash + approver_role + scope + expiry`

The approval card must show above the fold:

- what will happen and to which canonical object;
- material before/after or exact delta;
- evidence and known limitations;
- cost, risk, data class and recipients;
- reversibility or compensation path;
- alternatives and consequence of no approval;
- validity window and required role.

Allowed decisions are `APPROVE`, `REJECT`, `REQUEST_CHANGES` and `DEFER`. Reject and request-changes are first-class, non-punitive and audited. Silence never means consent.

## 5. Approval classes

- **Conversational confirmation** — exact Chat-to-Case confirmation and A0/A1 work only. A2 execution requires an explicit `Zatwierdź i rozpocznij`/equivalent control or an already published plan policy.
- **Explicit approval button** — Case contract, published plan, formal Decision, Initiative, official internal deliverable, material owner/deadline/target change, Case acceptance.
- **Step-up authentication** — external publication, financial commitment, production action, restricted-data export, access grant, destructive or regulated operation, policy override.
- **Dual control** — separation-of-duties cases defined by tenant policy, including material finance, sensitive access, client acceptance and high-impact exceptions.

Approving a plan does not approve all future material actions. A combined `Approve plan vN and start` is permitted only when its literal label and card disclose immediate effects and no hidden A3/A4 action is included.

## 6. Versioning, expiry and replanning

Published plans are immutable. Material change creates a new version and invalidates approval for the affected scope.

Material changes include outcome, scope, acceptance, owner, access, data class, consequential action, resource envelope, critical deadline, governance tier, KPI/ROI method, required QA, or official recipient.

Approval expires by time or event, including new material evidence, changed membership, changed target environment, breached envelope or superseding version. After expiry the action remains `WAITING_FOR_APPROVAL`; it must not execute.

Teresa may autonomously reorder technically equivalent safe work, retry an idempotent operation, correct non-material metadata and prepare a replan. A material replan records cause, evidence, diff, downstream effect and owner decision before execution.

## 7. Human attention, waits and external work

An attention request must ask for one concrete decision or input and show recommendation, alternatives, evidence, deadline and consequence of no response.

- `WAITING` means planned waiting with a known event/source, deadline and timeout behavior.
- `AT_RISK` means work may continue but time, cost, quality or outcome is threatened.
- `BLOCKED` means the critical path cannot continue; the blocker has an owner and explicit unblock condition.
- `EXTERNAL_STATUS_UNKNOWN` is used when outside work has no verified status.

External work is complete only after trusted system readback, supplied evidence or authorized human confirmation. Teresa may never attest that another party completed work without such evidence.

## 8. Proportionate challenger

Challenge is risk-based, not ceremonial.

- Direct work and Lightweight Case: creator self-check plus domain review when the output is material.
- Standard Case: independent domain review for formal Findings, Recommendations and Decisions.
- `CONTROLLED` governance: independent challenger is mandatory for material recommendations, executive/client decision packs, formal ROI, high-risk actions and exceptions.

Challenger outcomes are literal: `PASS`, `PASS_WITH_LIMITATIONS`, `REWORK_REQUIRED`, `EVIDENCE_NEEDED`, `REJECTED`. `PASS_WITH_LIMITATIONS` cannot be rendered as unconditional PASS.

## 9. Fail-closed language

- `PARTIAL` means a named subset is complete and the remaining scope is explicitly listed. It never means almost complete.
- `UNKNOWN` means the fact has not been established. It is neither yes nor no.
- `EVIDENCE_MISSING` means a required claim or gate lacks acceptable current proof and promotion/acceptance is blocked.

Teresa, UI summaries and reports must preserve these literals. Generated prose, confidence, code presence, deployment or self-attestation cannot upgrade them.

## 10. Governance acceptance

This governance contract passes only when the runtime proves, on one candidate SHA and real database:

- direct module work remains possible without Case;
- A0-A4 ceilings are enforced server-side;
- membership, tenant and role denial paths fail closed;
- approvals bind exact versions and expiry;
- reject/request-changes stop execution;
- restart/retry does not duplicate mutations;
- audit distinguishes proposed, approved, executed, validated and accepted;
- external and high-impact paths require their configured step-up controls.

Mocks, UI-only states and green helper tests are not sufficient.
