# External Communication And Client Channels v8

> Status: Draft v8
> Owner: Product + Engineering
> Scope: canonical model for external communication, client-facing channel policy, delivery updates, safe outbound messaging and project implementation communication

---

## 1. Why this document exists

Consultify is intended to absorb more delivery and coordination work from companies.

That requires a disciplined external communication model for:

- clients
- partners
- external reviewers
- implementation stakeholders

---

## 2. Core statement

External communication in Consultify should be:

- purposeful
- client-safe
- context-aware
- linked to real project state

It should never behave like an uncontrolled outbound messaging tool.

---

## 3. Canonical external communication classes

- `client_update`
- `delivery_handoff`
- `review_request`
- `implementation_coordination`
- `status_alert`
- `escalation_notice`

---

## 4. External communication rules

### 4.1 External communication must derive from governed state

Outgoing communication should be based on:

- approved artifact
- approved milestone state
- verified task or implementation status
- explicit review workflow

### 4.2 Internal and external wording must be separated

Internal operational language is not automatically safe for clients.

The platform must distinguish:

- internal notes
- internal debate
- external-ready summary
- external-ready deliverable message

### 4.3 Channel choice must follow policy

Allowed external channels should be defined by org or project policy.

Typical channels:

- email
- client-facing Teams or Slack context where allowed
- controlled delivery notification

### 4.4 External communication should minimize manual repetition

The product should help with:

- implementation updates
- milestone notices
- deliverable handoff
- review request packaging

This is one of the core ways Consultify can remove communication burden from organizations.

### 4.5 High-risk external messages require review

The system should default to review for:

- milestone claims
- decision announcements
- governance-sensitive delivery messages
- escalations

---

## 5. Project implementation communication

For project implementation work, the platform should support:

- internal prep
- external-ready summary
- linked deliverable or action context
- recipient-safe routing
- durable record that the communication happened

---

## 6. AI role in external communication

AI may:

- draft summaries
- convert implementation state into client-ready wording
- suggest channel and audience
- summarize what changed

AI may not:

- silently send high-impact client communication
- overstate completion
- turn internal-only material into external delivery copy without explicit review

---

## 7. Communication outcomes

External communication should preserve durable outcome state:

- `drafted`
- `ready_for_review`
- `approved_for_send`
- `sent`
- `delivery_failed`
- `response_pending`

---

## 8. Related canonical docs

- `COMMUNICATION_V8_SSOT.md`
- `COMMUNICATION_CHANNEL_SYNC_AND_ROUTING_V8.md`
- `AI_SYNC_AND_INTEROPERABILITY_STANDARDS_V8.md`
- `CONNECTOR_IMPLEMENTATION_PLAN_V8.md`
