# Communication v8 - SSOT

> Status: Draft v8
> Owner: Product + Engineering
> Scope: canonical product truth for internal and external communication, collaboration, channel policy, communication routing and message-to-work conversion inside Consultify

---

## 1. Why this document exists

If Consultify is meant to absorb more real work from companies, it cannot stop at:

- task tracking
- chat with AI
- document generation

It must also define how work is communicated:

- inside teams
- across projects
- to clients and external partners
- across connected external channels

This package exists because communication is currently spread across:

- chat
- inbox
- notifications
- sync and connectors

but does not yet have one canonical product definition.

---

## 2. Core product statement

`Communication v8` is the governed communication layer of Consultify that turns internal collaboration, external project messaging, notifications and synced channels into one source-aware, policy-aware system connected to real work, approvals, decisions and deliverables.

Communication in Consultify is not a generic chat clone.

It exists to:

- move work forward
- reduce communication chaos
- preserve business context
- route decisions and actions into governed execution

---

## 3. Inherited truth

This document inherits:

- `CHAT_V8_SSOT.md`
- `INBOX_AND_WORKFLOW_RUNTIME_CONTRACT_V8.md`
- `ASYNC_NOTIFICATIONS_AND_REENGAGEMENT_V8.md`
- `AI_SYNC_AND_INTEROPERABILITY_STANDARDS_V8.md`
- `CONNECTOR_IMPLEMENTATION_PLAN_V8.md`
- `CONNECTOR_SYNC_MODES_AND_CONFLICT_RESOLUTION_V8.md`

Rule:

`communication must be connected to work objects, not drift into ungoverned message sprawl`

Additional rule:

`Consultify should reduce communication burden by converting noise into structured work, context and governed action`

---

## 4. What Communication v8 owns

This package owns:

- internal communication policy
- external communication policy
- channel classes
- communication-to-work routing
- collaboration and delivery semantics
- connector-backed communication channel doctrine

It does not replace:

- `Chat v8` for AI conversation shell and message-thread semantics
- `Inbox v8` for action queue and triage semantics
- `Sync v8` for connector runtime and interoperability mechanics

---

## 5. Canonical communication classes

The platform should use only these communication classes:

- `internal_operational`
- `internal_governance`
- `internal_async_review`
- `external_project_delivery`
- `external_client_coordination`
- `external_alerting`
- `system_notification`

Rule:

`every communication surface must make clear whether it is internal, external, user-visible system state, or AI-generated assistive communication`

---

## 6. Canonical communication surfaces

### 6.1 In-app communication surfaces

- governed chat and discussion
- inbox and approvals
- comments on artifacts
- review prompts
- delivery summaries

### 6.2 Synced channel surfaces

- Slack
- Teams
- email
- future mobile or push

### 6.3 External delivery surfaces

- client-facing email
- shared project updates
- milestone or gate communication
- deliverable handoff messages

---

## 7. Product principles

### 7.1 Communication must attach to business context

Messages should connect to:

- project
- initiative
- task
- decision
- artifact
- client or external stakeholder context

### 7.2 Internal and external communication must remain distinct

The platform must not blur:

- internal discussion
- internal governance
- client-safe communication
- system-generated delivery updates

### 7.3 Communication should reduce work, not create more of it

The system should promote:

- summaries
- routing
- action extraction
- review prompts
- delivery clarity

It should avoid:

- duplicate notifications
- message duplication across channels
- unstructured communication chains with no execution outcome

### 7.4 Channel routing must be governed

Project or org policy should determine:

- which channels are allowed
- which are internal-only
- which can be external
- who can trigger outbound communication

### 7.5 AI may assist but not silently misrepresent

AI can:

- summarize
- draft
- classify
- propose routing
- suggest actions

AI cannot:

- silently send critical external messages
- silently turn internal-only material into external communication
- create misleading delivery status

---

## 8. Communication object model

Canonical objects should include:

- `CommunicationThreadRef`
- `CommunicationMessageRef`
- `ChannelBindingRef`
- `CommunicationPolicyProfile`
- `DeliveryAudienceRef`
- `CommunicationOutcomeRef`

---

## 9. Completion criteria

Communication v8 is complete only if:

- internal communication has explicit policy
- external communication has explicit policy
- channels are tied to work objects and routing rules
- communication can be synchronized through governed connectors
- communication outcomes can materialize into inbox, tasks, approvals, decisions or deliverables

---

## 10. Related canonical docs

- `COMMUNICATION_V8_READINESS_AUDIT.md`
- `INTERNAL_COMMUNICATION_POLICY_AND_COLLABORATION_GOVERNANCE_V8.md`
- `EXTERNAL_COMMUNICATION_AND_CLIENT_CHANNELS_V8.md`
- `COMMUNICATION_CHANNEL_SYNC_AND_ROUTING_V8.md`
- `CHAT_V8_SSOT.md`
- `INBOX_AND_WORKFLOW_RUNTIME_CONTRACT_V8.md`
- `ASYNC_NOTIFICATIONS_AND_REENGAGEMENT_V8.md`
