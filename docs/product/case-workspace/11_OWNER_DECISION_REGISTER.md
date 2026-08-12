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
| OD-12 | Comments panel section, V1 scope | The mandatory `Komentarze` accordion section is **deferred past V1** (`DEFERRED_POST_V1`), decided 2026-08-12 | See below. |

### OD-12 — `Komentarze` deferred past V1 (2026-08-12)

**What the canon requires.** `ARTIFACT_ANATOMY_STANDARD.md` §10.2 and §11.2 both
list `Komentarze` as the fixed fourth of five right-panel accordion sections and
explicitly forbid archetype-level panel changes; §18.1's DoD MUST checklist
repeats it. §13.1's per-artifact table omits `Komentarze` for every Archetype-C
row, but it equally omits `Akcje`, which is also mandatory — so that omission
reflects the column's scope (differentiating content only) and is **not** an
override. The canon does not contradict itself here.

**Why it is deferred rather than built.** Case Workspace has no comments feature
of any kind: no `case_comments` table, no service, no route, no client function.
Other modules have their own (`task_comments`, `studio_comments`,
`report_builder_comments`), but none is Case's. Satisfying the requirement means
building the feature end to end — migration, table, service, routes, UI, tests —
which is new product scope, not the correction of a deviation.

**Owner resolution.** Deferred past V1. Recorded as an explicit, cited debt
against the canon rather than silently dropped. The requirement stays visible in
`VISUAL_TRIADA_SPEC_A_LEDGER.csv` as `DEFERRED_POST_V1`, citing this decision.

**Related correction.** `CaseDetailScreen.tsx`'s header previously justified the
omission by citing §10.2/§11.2 — the very sections that mandate the section. That
comment was wrong and has been corrected to cite this decision instead. A code
comment that misquotes the canon it points at is worse than no comment: it makes
a gap look settled.

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
