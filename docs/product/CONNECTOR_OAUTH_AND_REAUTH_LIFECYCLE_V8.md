# Connector OAuth And Reauth Lifecycle v8

> Status: Draft v8
> Owner: Product + Engineering
> Scope: canonical OAuth, token refresh, reauth, revoke and degraded-auth lifecycle for serious external connectors in Consultify

---

## 1. Why this document exists

Trusted sync cannot exist if authentication is treated as a hidden technical detail.

For serious connectors, auth lifecycle is part of product truth.

This document exists to define:

- what the full auth lifecycle means
- which providers must support it first
- how auth failure should be visible to admins, operators and users
- how reauth should avoid silent connector decay

---

## 2. Core statement

For durable connectors, authentication is not a one-time setup step.

It is a managed lifecycle:

`connect -> authorize -> verify -> use -> refresh -> degrade if needed -> reauth -> recover or revoke`

Rule:

`no serious sync connector may be treated as production-grade unless its auth lifecycle is explicit, observable and recoverable`

---

## 3. Providers in scope

This lifecycle is mandatory first for:

- `Google Workspace`
- `Microsoft 365`
- `Slack`
- `Jira`
- cloud file providers tied to those ecosystems

Then for:

- `Asana`
- `Monday`
- `ClickUp`
- `Linear`

---

## 4. Canonical auth stages

### 4.1 Connect intent

The user or admin chooses:

- provider
- ownership level
- connector purpose
- capability scope

### 4.2 Authorization

The product redirects the actor through the correct auth model:

- org-level OAuth
- user-level OAuth
- service-account-like path where applicable
- API-key or webhook path if not OAuth-based

### 4.3 Verification

The product must verify:

- token or credential validity
- granted scopes
- reachable workspace, tenant or project
- provider account identity

### 4.4 Active use

While healthy, the product must track:

- last token verification
- next expected refresh
- current scope integrity
- connector health state

### 4.5 Refresh

Where the provider supports refresh tokens or renewable sessions, the platform must:

- refresh before hard expiry where possible
- log refresh success or failure
- distinguish transient provider failure from true credential expiry

#### 4.5.1 Transient-failure discrimination doctrine

> V8 Decision W5-2 applied — 2026-03-23

Provider-family criteria under one shared doctrine:

**Retry later** (temporary transport/provider instability):

- network timeout
- rate limit (HTTP 429)
- transient 5xx
- temporary provider outage
- short-lived webhook delivery issue

**Reauth now** (auth/scope/identity break):

- expired or revoked token
- missing scope
- invalid refresh flow
- account disconnected
- user removed from source system

Rule: `temporary transport/provider instability → retry path; auth/scope/identity break → reauth path`

### 4.6 Degraded auth state

If refresh or token use fails, the product must transition into visible degraded state.

Examples:

- token expired
- refresh failed
- scope revoked
- workspace access revoked
- account disconnected

#### 4.6.1 Degraded-state escalation thresholds

> V8 Decision W5-3 applied — 2026-03-23

Default escalation ladder:

| Duration | Action |
|---|---|
| 0–4 hours | Standard notification to connector owner |
| 4–24 hours | Escalation: `degraded` — notification to org admin |
| 24–72 hours | Escalation: `critical` — operator alert; connector flagged as at-risk |
| >72 hours | `disconnected` candidate — forced intervention; auto-disable recommendation surfaced to admin; operator incident created |

These are cross-platform defaults. Connector families and tenant policies may tighten thresholds but not relax them below baseline.

### 4.7 Reauth

Reauth must be explicit and guided.

The product must preserve:

- mapping state
- provider identity context
- object linkage where still valid
- explanation of what will recover after reauth

### 4.8 Revoke and disconnect

Disconnect must preserve:

- audit trace
- connector history
- last known mapping state
- clear statement of what stops syncing immediately

---

## 5. Ownership and auth model doctrine

Every serious connector must declare:

- whether it is org-owned, user-owned or mixed
- who can connect it
- who can reauth it
- whose token or credential context powers runtime operations
- what happens if the original actor loses access

Rule:

`runtime ownership must not be ambiguous`

### 5.1 Admin token re-binding

> V8 Decision W5-1 applied — 2026-03-23

Admin may re-bind a connector to a different user's token only through a governed admin recovery flow.

Conditions:

- original user is unavailable
- connector ownership continuity is required
- admin cannot silently swap identity semantics

Audit must capture:

- old binding
- new binding
- actor
- reason
- timestamp

Rule: `re-bind must be explicit, auditable and policy-checked; never invisible credential reassignment`

---

## 6. Scope and permission doctrine

The product must expose granted permissions honestly.

At minimum it should show:

- read scope
- write scope
- admin scope if any
- project, workspace or board scope
- user-owned vs organization-owned scope

Forbidden behavior:

- implying full sync when scope is read-only
- hiding missing permissions until runtime failure
- allowing connector enablement when required scopes are missing without explicit degraded warning

---

## 7. Reauth user journey

The target product journey should be:

`auth degraded -> explain reason -> show impact -> offer reauth -> verify recovery -> resume runs`

The surface must explain:

- why reauth is needed
- which provider account is affected
- what business objects are impacted
- whether sync is paused, partially degraded or publish-only
- what happens after successful reauth

---

## 8. Runtime states

Every connector should expose one of these auth states:

- `not_connected`
- `authorizing`
- `connected_unverified`
- `healthy`
- `refreshing`
- `degraded_reauth_needed`
- `revoked`
- `disconnected`

The product must avoid vague labels like:

- `error`
- `warning`

without state meaning.

---

## 9. Operator and support expectations

The operator surface must allow:

- search by connector and provider account
- see last refresh success
- see last auth failure
- classify failure as provider outage, token expiry, missing scope, revoked access or callback issue
- re-run verification
- confirm whether queued sync is paused because of auth only

The support surface must allow:

- explain the issue in non-technical language
- route the reauth task to the right owner
- distinguish auth failure from mapping or business conflict

---

## 10. PM-specific implications

For PM connectors, auth failure is not just a connector problem.

It directly affects:

- task freshness
- review delivery
- inbox ingestion
- decision callback handling
- schedule alignment

So PM surfaces should show when linked work is stale because auth degraded.

---

## 11. Acceptance criteria

Auth lifecycle is complete only when:

- serious connectors expose clear auth states
- refresh and reauth are visible product states, not hidden implementation details
- the right owner can recover the connector without remapping everything
- degraded auth impact is visible on affected work objects
- support can explain and route the issue without engineering-only knowledge

---

## 12. Related canonical docs

- `CONNECTOR_IMPLEMENTATION_PLAN_V8.md`
- `EXTERNAL_SYNC_READINESS_AUDIT_V8.md`
- `TASK_SYNC_AND_EXTERNAL_WORK_INTEROPERABILITY_RUNTIME_V8.md`
- `CONNECTOR_OPERATOR_AND_SUPPORT_SURFACES_V8.md`
- `AI_SYNC_AND_INTEROPERABILITY_STANDARDS_V8.md`
