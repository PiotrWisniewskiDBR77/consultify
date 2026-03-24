# Async Notifications And Reengagement v8

> Status: Draft v8
> Owner: Product + Engineering
> Purpose: zdefiniowac jeden kanoniczny model powiadomien, przypomnien i reengagement dla `Chat`, `Teresa`, `proposal-only` flows i async agent work.

---

## 1. Why this document exists

Gdy AI pracuje dluzej niz jeden idealny request-response loop, produkt musi umiec powiedziec userowi:

- ze cos czeka,
- ze cos sie skonczylo,
- ze cos wymaga review,
- ze cos wygaslo,
- ze warto wrocic do przerwanej pracy.

Bez tego nawet dobry runtime staje sie nieprzewidywalny.

---

## 2. Inherited truth

This document inherits:

- `CHAT_APPLICATION_AGENT_RUNTIME_V8.md`
- `TERESA_VOICE_CHAT_RAIL_V8.md`
- `AI_PROPOSAL_ONLY_APPLICATION_MODE_V8.md`
- `AI_BACKGROUND_AND_SCHEDULED_AGENT_RUNTIME_V8.md`
- `VOICE_TRUST_AND_APPROVALS_V8.md`
- `CHAT_V8_ENTERPRISE_AND_COMPLIANCE.md`

Rule:

`user-visible async status must be a first-class product surface, not an afterthought`

---

## 3. Notification classes

Canonical notification classes:

- `pending_review`
- `completed_async_work`
- `proposal_expiring`
- `proposal_expired`
- `resume_available`
- `failed_with_recovery_path`
- `scheduled_run_ready`

Each notification must preserve:

- `notification_id`
- `notification_class`
- `source_object_ref`
- `conversation_ref?`
- `execution_run_ref?`
- `worker_or_assistant_ref?`
- `priority`
- `created_at`
- `expires_at?`
- `action_cta_ref`

---

## 4. Delivery channels

Baseline channels:

- in-app notification center
- in-thread or in-rail pending state
- toast for immediate local completion

Promoted extensions:

- email
- tenant policy-based reminder delivery
- future mobile or push

Rule:

`v8 baseline should not promise more channels than runtime and policy can support`

---

## 5. Reengagement triggers

The system should re-engage the user when:

- a proposal is waiting for review
- a long-running async task completes
- an approval window is close to expiry
- a voice or agent session can be resumed
- a background job failed but has a clear recovery path

It should not spam the user for:

- low-value ephemeral suggestions
- already resolved work
- stale notifications without actionable meaning

---

## 6. Chat and Teresa integration

`Chat` and `Teresa rail` must show:

- pending review markers
- resume-session markers
- completion or failure markers for async work
- visible path back into the relevant context

Examples:

- `Review Teresa proposal`
- `Resume voice session`
- `Background synthesis complete`
- `Approval expired`

---

## 7. Notification semantics by object

### 7.1 Proposal

Proposal notifications may indicate:

- waiting for review
- expiring soon
- expired
- rejected elsewhere

### 7.2 Background job

Background job notifications may indicate:

- queued
- completed
- blocked
- failed with retry or resume path

### 7.3 Voice session

Voice session notifications may indicate:

- interrupted and resumable
- summary ready for review
- fallback to text required

---

## 8. Required user-facing statuses

The baseline visible vocabulary should include:

- `Waiting for review`
- `Ready`
- `Resume available`
- `Retry needed`
- `Expired`
- `Completed`
- `Failed`

These must map to durable backend meaning rather than local UI heuristics.

---

## 9. Team and tenant rules

If work is shared:

- the notification must respect the effective reviewer or owner
- team members should not receive duplicate or unauthorized review prompts
- tenant policy may limit which channels are allowed

---

## 10. Retention and compliance

Notifications must respect:

- tenant isolation
- content minimization
- retention owner and policy
- support and admin visibility rules

Notifications should not expose more content than needed to re-enter the governed surface.

---

## 11. Risks and anti-patterns

- long-running AI work completes silently
- expired proposals disappear without explanation
- resume is possible but invisible
- toasts imply durable success when no durable state changed
- notification text leaks content broader than policy allows

---

## 12. Acceptance criteria

- one notification vocabulary exists across chat and agent work
- async and pending-review work can re-engage the user visibly
- Teresa and background work have clear resume or review paths
- baseline notification behavior is productized, not left to local module heuristics
