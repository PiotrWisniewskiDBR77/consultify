# Case Workspace — owner decision register

> Status: `FROZEN`
> Decision owner: Piotr Wisniewski
> Decision date: 2026-08-09
> Scope: decisions required before code-ready documentation

| ID | Decision | Owner resolution | Consequence |
| --- | --- | --- | --- |
| OD-01 | Lightweight work model | One Case; no additional Engagement or Job object | Profiles provide proportional governance over one lifecycle and runtime. |
| OD-02 | Direct work | Consultify modules work with or without Case and Teresa | Module artifacts remain canonical and may later be linked to a Case. |
| OD-03 | Chat to Case boundary | Case is created after explicit confirmation of Teresa's exact summary | An ephemeral proposal may exist; silence is never consent. |
| OD-04 | Lightweight confirmation | Safe Light Case may use one `Zatwierdź i rozpocznij` action | Larger or risky Cases separate contract, plan, start and material approvals. |
| OD-05 | Autonomy | Three selectable levels per Case | Middle level is default; organization sets the maximum; hard controls always apply. |
| OD-06 | Long value measurement | Measurement may become a linked Monitoring Case | The source Case can close delivery/implementation without claiming proven value. |
| OD-07 | Challenger | Independent challenger is risk- and materiality-based | Mandatory for material recommendations and Cases under `CONTROLLED` governance, not every result. |
| OD-08 | Polish product language | `Zlecenie` is the default UI term; `Case` remains the domain term | Copy can be natural without forking the model. |
| OD-09 | Intelligence identity | Teresa remains the public orchestrator identity | Specialist agents and capabilities stay behind one user relationship. |
| OD-10 | Builder direction | Build new lightweight Simple and Expert views over one graph | Current heavy builder is only a temporary legacy surface and component donor. |
| OD-11 | Reusable Plays | Everyone may create private drafts; shared publication requires permission or review | Published versions are immutable and governed. |

## Derived product rules

The following are direct consequences and do not require another owner decision:

- a direct Interview, Assessment, Finance analysis, KPI, Decision, Initiative, document or presentation can exist without Case;
- a durable assignment to Teresa always becomes one Case after confirmation;
- an existing standalone artifact is linked or pinned at an exact revision; any derived successor is created and owned by the native module with lineage, never forked or copied by Case;
- `EXECUTE_APPROVED_PLAN` is not an unrestricted safety bypass;
- material scope, recipients, cost, data class, target system or business commitment changes require a new proposal or replan;
- the initial product host is My Work and the later Chat embedding uses the same workspace and runtime;
- no implementation may introduce a second Chat-specific plan, approval or execution truth.

## Remaining non-owner work

Engineering and design own the remaining decisions, including exact schemas, API transport, retry defaults, database indexes, layout algorithms, breakpoints, token values and rollout mechanics. They must satisfy the invariants and acceptance gates in this package.
