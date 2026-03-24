# Communication Channel Sync And Routing v8

> Status: Draft v8
> Owner: Product + Engineering
> Scope: canonical channel-binding, routing, connector-backed delivery, internal versus external separation and communication-to-work materialization model

---

## 1. Why this document exists

Communication becomes operationally useful only when channels, routing and sync behavior are explicit.

This document bridges:

- communication policy
- connector-backed delivery
- inbox and work materialization

---

## 2. Core statement

Communication channels in Consultify are not just destinations.

They are governed bindings between:

- audience
- work context
- channel policy
- delivery behavior

---

## 3. Canonical channel bindings

The platform should use explicit channel binding objects such as:

- `OrgChannelBinding`
- `ProjectChannelBinding`
- `UserChannelBinding`
- `ExternalAudienceBinding`

Each binding should preserve:

- channel class
- provider
- scope
- owner
- allowed message classes
- review requirement

---

## 4. Routing model

Routing should consider:

- internal vs external communication class
- object context
- urgency
- approval state
- delivery policy

Canonical path:

`message intent -> classify -> bind to allowed channel -> review if needed -> deliver or materialize -> log outcome`

---

## 5. Channel families

### 5.1 Internal synced channels

- Slack
- Teams
- internal email pathways

### 5.2 External client channels

- client email
- controlled shared workspace channels where policy allows

### 5.3 In-app channels

- inbox
- comments
- review prompts
- delivery status

---

## 6. Communication-to-work materialization

Communication should be able to materialize into:

- inbox item
- task
- approval
- decision
- delivery record
- support or follow-up event

Rule:

`important communication must create durable work meaning when appropriate`

---

## 7. Sync semantics for channels

For connector-backed channels, the product must expose:

- connection state
- delivery mode
- sync direction
- routing owner
- failure behavior

Examples:

- Slack channel receives internal operational notices
- Teams receives approval review prompts
- email receives external-ready milestone update

---

## 8. Related canonical docs

- `COMMUNICATION_V8_SSOT.md`
- `INTERNAL_COMMUNICATION_POLICY_AND_COLLABORATION_GOVERNANCE_V8.md`
- `EXTERNAL_COMMUNICATION_AND_CLIENT_CHANNELS_V8.md`
- `AI_SYNC_AND_INTEROPERABILITY_STANDARDS_V8.md`
- `INBOX_AND_WORKFLOW_RUNTIME_CONTRACT_V8.md`
