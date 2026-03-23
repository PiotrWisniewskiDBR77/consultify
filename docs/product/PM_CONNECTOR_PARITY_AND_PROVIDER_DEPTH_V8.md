# PM Connector Parity And Provider Depth v8

> Status: Draft v8
> Owner: Product + Engineering
> Scope: canonical parity model, provider depth tiers and minimum runtime promises for external PM and task systems

---

## 1. Why this document exists

It is not enough to say that `consultify` supports “PM sync”.

Different PM systems need different depth promises, and the product must be honest about that.

This document exists to define:

- what parity means beyond `Jira`
- which providers are strategic first-class targets
- what minimum runtime depth each provider must reach
- how roadmap and shipped capability should be separated

---

## 2. Core statement

`consultify` should not become a Jira-only sync story with other providers listed as decoration.

Canonical rule:

`PM connector parity means at least two serious PM systems reach enterprise-grade interoperability, while additional providers expose honest, scoped depth`

---

## 3. Provider tiers

### 3.1 Tier A - enterprise parity

Providers:

- `Jira`
- one peer provider: `Asana` or `Monday`

Required depth:

- OAuth lifecycle
- org and project ownership clarity
- rich task mapping
- assignee mapping
- due-date authority
- status-model mapping
- webhook plus fallback fetch strategy where needed
- conflict handling
- retry and replay support
- operator and support visibility

### 3.2 Tier B - strong operational interoperability

Providers:

- `ClickUp`
- `Linear`

Required depth:

- durable connector
- structured object mapping
- strong task import and publish support
- scoped bidirectional sync for core task fields
- visible limitations

### 3.3 Tier C - adjacent PM collaboration

Providers:

- `Notion`
- email-origin work capture
- messaging-driven work callbacks

Required depth:

- governed import or publish behavior
- no false promise of full PM parity

### 3.4 Tier D - benchmark or future scope

Providers:

- (future PM or ALM tools not yet committed to runtime parity)

Required depth:

- visible in roadmap and connector catalog
- not promised as mature runtime parity
- no sync mode, conflict model or operator surface required
- honest labeling as future scope on all surfaces

> Added per Decision 7 (DECISION_LOG_WAVE_1.md). Aligns with TASK_SYNC_AND_EXTERNAL_WORK_INTEROPERABILITY_RUNTIME_V8.md §5.4.

---

## 4. Canonical parity dimensions

Provider parity must be judged across these dimensions:

- auth maturity
- ownership and scope model
- task object mapping
- assignee model
- status and workflow model
- due-date and schedule semantics
- comment or review semantics
- conflict handling
- replay and supportability
- UI honesty about limits

---

## 5. Minimum provider contracts

### 5.1 Jira

Must be the first fully hardened provider.

Minimum promise:

- project, board and issue-type aware mapping
- custom field mapping where justified
- assignee and reporter handling
- status and transition mapping
- comments or review callbacks where enabled
- conflict queue and replay

### 5.2 Asana

If chosen as the first non-Jira peer, the minimum promise is:

- workspace and project ownership model
- task, section and assignee mapping
- due-date and completion-state sync
- clear handling of subtasks if supported
- limitations on custom fields stated explicitly

### 5.3 Monday

If chosen as the first non-Jira peer, the minimum promise is:

- workspace, board and item mapping
- group and status-column mapping
- people-column mapping
- due-date mapping
- explicit handling of formula or mirror columns as limited or unsupported

### 5.4 ClickUp

Minimum promise:

- space, folder or list mapping
- task status and assignee sync
- due-date sync
- explicit statement on docs, custom fields and hierarchy depth

### 5.5 Linear

Minimum promise:

- team and issue mapping
- status, assignee and priority sync
- label and cycle awareness where justified
- explicit statement on initiative or epic equivalence limits

---

## 6. Honest provider labeling

Every provider card and settings surface must show:

- provider tier
- sync modes supported
- whether OAuth is complete
- whether bidirectional sync is available
- whether `InboxItem` ingestion is supported
- biggest current limitations

Forbidden behavior:

- showing all PM connectors as equal when only one is truly mature
- implying bidirectional sync for providers that only support import or publish

---

## 7. Recommended sequence

The recommended sequence is:

1. `Jira` Tier A hardening
2. `Asana` or `Monday` Tier A peer parity
3. `ClickUp` Tier B depth
4. `Linear` Tier B depth
5. further PM or ALM tools after those four are honest and supportable
6. Tier D providers remain visible in roadmap but are not scheduled for runtime implementation until Tiers A-C are honest and supportable

---

## 8. Acceptance criteria

PM connector parity is strong only when:

- the product is no longer Jira-only in serious PM depth
- at least one non-Jira peer reaches Tier A
- `ClickUp` and `Linear` have honest, useful Tier B depth
- provider cards and docs communicate limits without ambiguity
- support and operators can diagnose provider-specific sync issues
- Tier D providers are honestly labeled as future scope and do not appear as shipped connectors

---

## 9. Related canonical docs

- `TASK_SYNC_AND_EXTERNAL_WORK_INTEROPERABILITY_RUNTIME_V8.md`
- `CONNECTOR_OAUTH_AND_REAUTH_LIFECYCLE_V8.md`
- `CONNECTOR_IMPLEMENTATION_PLAN_V8.md`
- `EXTERNAL_SYNC_READINESS_AUDIT_V8.md`
- `AI_SYNC_AND_INTEROPERABILITY_STANDARDS_V8.md`
