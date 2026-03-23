# Consultinity – Execution Control, Inbox & Governance Enforcement (Canonical)

## 0. Purpose of this document
This document defines:
- what My Work / Inbox is
- which artefacts appear there
- how SLA, reminders, and escalations work
- how Inbox enforces governance and decisions

Canonical v8 runtime extensions for this area now live in:

- `docs/product/PROJECT_TASKS_AND_WORKFLOW_SOFTS_BENCHMARK_V8.md`
- `docs/product/INBOX_AND_WORKFLOW_RUNTIME_CONTRACT_V8.md`
- `docs/product/INTAKE_AND_TRIAGE_RUNTIME_V8.md`

Inbox is a **control mechanism**, not a task list.

---

## 1. My Work / Inbox – canonical definition

### 1.1 What is My Work
My Work is a personal execution cockpit showing:
- decisions waiting for me
- tasks assigned to me
- approvals & gates requiring my action
- escalations and alerts

Inbox ≠ To-Do list  
Inbox = governance enforcement layer

---

## 2. Artefacts visible in Inbox
Inbox aggregates only **actionable items**.

| Artefact | Trigger |
|---|---|
| Task | assigned to user |
| Decision | user is approver / decision maker |
| Gate approval | user is required approver for a gate |
| BLOCKED alert | user is Sponsor / Owner (as configured) |
| SLA breach | deadline exceeded |

Each inbox item:
- has owner
- has due date
- links to source artefact
- shows impact badge (initiative / project)

---

## 3. Inbox categories (UX)
Inbox is grouped into fixed sections:
1) Decisions Required  
2) Approvals & Gates  
3) Assigned Tasks  
4) Blocked / Escalations  
5) Overdue / SLA Breach

Non-negotiable UX:
- priority sorting
- SLA countdown badge
- impact indicator (initiative/project)
- quick actions (where applicable):
  - approve / reject
  - open task
  - escalate

---

## 4. SLA rules (canonical)

### 4.1 SLA applies to
- Decisions
- Gate approvals
- Critical tasks
- BLOCKED resolution

### 4.2 Default SLA table
Default values (configurable per organization/project):

| Artefact | SLA |
|---|---|
| Decision (APPROVE / CHANGE) | 5 business days |
| Gate approval | 3 business days |
| BLOCKED response | 2 business days |
| Task (critical) | defined per task |

---

## 5. Escalation logic

### 5.1 Escalation levels
| Level | Trigger |
|---|---|
| L1 | SLA - 1 day reminder |
| L2 | SLA breach |
| L3 | SLA breach + 3 days |

### 5.2 Escalation targets (canonical)
| Situation | Escalates to |
|---|---|
| Decision overdue | Project Sponsor |
| Gate overdue | Steering Committee |
| BLOCKED unresolved | PMO + Sponsor |
| Repeated breaches | Owner |

---

## 6. BLOCKED governance

### 6.1 When initiative enters BLOCKED
System automatically:
- creates a BLOCKED alert
- assigns responsibility
- starts SLA timer

### 6.2 Unblocking
BLOCKED can be resolved by:
- Decision (CHANGE with an UNBLOCK resolution)
- Task completion
- Sponsor action

Canonical rule:
- UNBLOCK is a **variant of CHANGE**, not a separate gate.

---

## 7. AI role in Inbox
AI Assistant:
- prioritizes items
- explains consequences
- drafts decision rationale
- does NOT auto-decide

---

## 8. Non-negotiable enforcement rule
Users cannot ignore Inbox:
- unread critical items persist
- system reminds until resolved

---

## 9. V8 Program Decisions

### 9.1 Cross-surface state propagation

> V8 Decision W7-1 applied — 2026-03-23

One object keeps one canonical state across Home, Calendar, and Inbox. Surfaces may show different projections, not different truths. Deduplication by canonical object identity; state updates propagate to all surfaces. Surface-local UI state may differ; object state may not. Inbox may hold pre-materialized intake state, but once promoted, canonical object truth wins.

Triage actions in Inbox (e.g. `schedule`, `delegate`, `done`) are authoritative state changes. Home and Calendar must reflect the resulting state.

### 9.2 Inbox materialization model

> V8 Decision W7-3 applied — 2026-03-23

Inbox materialization is event-driven through the notification/signal spine. Latency targets:

| Level | Latency |
|---|---|
| Target | Near-real-time |
| Acceptable operational | ≤ 60 seconds |
| Degraded but acceptable | ≤ 5 minutes |

Beyond degraded threshold, the surface must show delayed/degraded state honestly. Inbox items are not polled — they are materialized from upstream events (execution signals, AI proposals, async notifications).

