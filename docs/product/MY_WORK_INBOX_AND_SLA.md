# Consultinity – Execution Control, Inbox & Governance Enforcement (Canonical)

## 0. Purpose of this document
This document defines:
- what My Work / Inbox is
- which artefacts appear there
- how SLA, reminders, and escalations work
- how Inbox enforces governance and decisions

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

