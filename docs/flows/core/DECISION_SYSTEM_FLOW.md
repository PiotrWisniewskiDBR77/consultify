# FLOW-DECISION-001: Decision System (Canonical)

> **ID:** FLOW-DECISION-001 | **Status:** ✅ Complete | **Priority:** P0

## Overview

| Metric                    | Value              |
| ------------------------- | ------------------ |
| **Completeness**          | 100%               |
| **Implementation Status** | New implementation |

## Purpose

The decision system is the core governance mechanism of Consultinity. It enables formal decisions with audit trail, escalation, and AI-assisted analysis.

Canonical references:
- `docs/product/SYSTEM_ARCHITECTURE_BRIEF.md`
- `docs/product/INITIATIVE_GOVERNANCE_MODEL.md`

## Core Concept

> **“Decisions are the heart of Consultinity.”**

An initiative or task can be blocked because a decision is missing. The system:

- Detects blockers
- Enables formal requests for decision
- Makes accountability visible (who delays which decisions)
- Learns patterns for better recommendations (AI System never decides)

## Triggers

| Trigger        | Description                                    |
| -------------- | ---------------------------------------------- |
| Manual Request | A user creates a decision request |
| AI Detection | AI detects a blocker and suggests a decision |
| Deadline | Automatic escalation after deadline |
| Escalation | No decision → escalation to higher authority |

## Outcomes

- Formal decision made with rationale
- Blocker removed (or initiative/task remains blocked by design)
- Complete audit trail
- AI learns patterns (recommendation only)

## Actors

| Actor | Role |
|---|---|
| Requester | Creates a decision request |
| Decision Maker | Makes the decision (Business Owner / Sponsor by default) |
| Stakeholders | Informed/consulted audience |
| AI System | Detects, analyzes, recommends, learns (never decides) |

## Decision Structure

| Field             | Required | Description                                    |
| ----------------- | -------- | ---------------------------------------------- |
| title             | ✅       | Krótki opis decyzji                            |
| description       | ✅       | Pełne wyjaśnienie kontekstu                    |
| type              | ✅       | APPROVAL, CHANGE, CANCEL, CLOSURE, OTHER |
| deadline          | ✅       | Kiedy decyzja potrzebna                        |
| decision_maker_id | ✅       | Kto decyduje                                   |
| stakeholders      | ○        | Kto jest informowany                           |
| options           | ○        | Opcje do wyboru (JSON array)                   |
| criteria          | ○        | Kryteria decyzji (JSON)                        |
| attachments       | ○        | Dokumenty wspierające                          |
| project_id        | ○        | Powiązanie z projektem                         |
| initiative_id     | ○        | Powiązanie z inicjatywą                        |
| task_id           | ○        | Powiązanie z taskiem (blokada)                 |

### Decision as the only governance artefact
Per `docs/product/SYSTEM_ARCHITECTURE_BRIEF.md`, **Decision** is the only governance artefact. Concepts like “stage gate” are implemented as:
- Decision templates/types (e.g., GO_NO_GO, APPROVAL, RESOURCE_ALLOCATION)
- Decision policies (who must decide, by when, escalation rules)

They must not become separate user-facing artefacts unless explicitly designed as an extension.

## Status Machine

```
┌─────────┐     ┌─────────┐     ┌───────────┐
│ PENDING │────►│APPROVED │     │ CANCELLED │
└────┬────┘     └─────────┘     └───────────┘
     │                               ▲
     │ (after deadline)              │
     ▼                               │
┌──────────┐                         │
│ESCALATED │─────────────────────────┘
└────┬─────┘     (if still no decision)
     │
     ▼
┌─────────┐
│ EXPIRED │
└─────────┘
```

Canonical `decision_status` values (single-field model):
- `PENDING`
- `APPROVED`
- `REJECTED`
- `ESCALATED`

## Sequence Diagram

```
┌──────────┐  ┌────────────┐  ┌──────────────┐  ┌──────────┐  ┌────┐
│ Requester│  │  Decision  │  │   Decision   │  │ Database │  │ AI │
│          │  │  Service   │  │    Maker     │  │          │  │    │
└────┬─────┘  └─────┬──────┘  └──────┬───────┘  └────┬─────┘  └──┬─┘
     │              │                │               │           │
     │ Create       │                │               │           │
     │ Decision     │                │               │           │
     │─────────────►│  INSERT        │               │           │
     │              │───────────────────────────────►│           │
     │              │                │               │           │
     │              │  Notify DM     │               │           │
     │              │───────────────►│               │           │
     │              │                │               │           │
     │              │  AI Analyze    │               │           │
     │              │──────────────────────────────────────────►│
     │              │◄──────────────────────────────────────────│
     │              │  {recommendation}              │           │
     │              │                │               │           │
     │              │                │ View Decision │           │
     │              │◄───────────────│               │           │
     │              │                │               │           │
     │              │                │ Make Decision │           │
     │              │◄───────────────│               │           │
     │              │  UPDATE        │               │           │
     │              │───────────────────────────────►│           │
     │              │                │               │           │
     │              │  Notify Requester              │           │
     │◄─────────────│                │               │           │
     │              │                │               │           │
     │              │  AI Learn      │               │           │
     │              │──────────────────────────────────────────►│
     │              │                │               │           │
```

## AI Integration

### 1. Detection

AI wykrywa że task/initiative stoi i sugeruje:

- "This task has been blocked for 5 days. Would you like to create a decision request?"

### 2. Analysis

AI analizuje kontekst i sugeruje opcje:

- "Based on similar past decisions, here are recommended options..."

### 3. Recommendation

AI rekomenduje decyzję z uzasadnieniem:

- "Recommendation: Approve with conditions. Rationale: ..."

### 4. Learning

AI uczy się trendów:

- "Decision Maker X typically chooses Option A when context includes Y"
- "Average decision time for this type: 3 days"

### 5. Prediction

AI przewiduje:

- "Estimated time to decision: 2 days based on DM's history"

## Escalation Flow

```
Day 0: Decision Request created
       └── Notification to Decision Maker

Day 3: First Reminder (if pending)
       └── Email + In-app reminder

Day 5: Escalation Warning
       └── "Decision will be escalated in 2 days"

Day 7: Auto-Escalation (if still pending)
       └── Status → ESCALATED
       └── Notify next-level Decision Maker
       └── Original DM still can decide

Day 14: Expiration (if still pending after escalation)
       └── Status → EXPIRED
       └── Alert to PM/Admin
       └── Task remains blocked
```

## Voting (Committee Decisions)

For high-value decisions (configurable threshold), a sponsor can require committee voting while keeping a single accountable authority.

```
Decision Type: COMMITTEE_VOTE
Required Votes: 3 of 5
Deadline: 2024-01-20
Voting: [majority | unanimous | weighted]

Votes:
├── User A: APPROVE (comment)
├── User B: APPROVE (comment)
├── User C: REJECT (comment)
├── User D: (pending)
└── User E: (pending)

Result: APPROVED (when threshold met)
```

## Database Schema

Created in migration `245_project_enhancements.sql`:

- `decisions` - Main decision table
- `decision_stakeholders` - Who is informed/consulted
- `decision_votes` - For committee voting
- `decision_history` - Audit trail

## API Endpoints

| Method | Endpoint                      | Description                                      |
| ------ | ----------------------------- | ------------------------------------------------ |
| GET    | `/api/decisions`              | List decisions (filters: project, status, maker) |
| POST   | `/api/decisions`              | Create decision request                          |
| GET    | `/api/decisions/:id`          | Get decision details                             |
| PUT    | `/api/decisions/:id`          | Update decision (make decision)                  |
| DELETE | `/api/decisions/:id`          | Cancel decision request                          |
| POST   | `/api/decisions/:id/escalate` | Manual escalation                                |
| GET    | `/api/decisions/:id/history`  | Get decision history                             |
| POST   | `/api/decisions/:id/vote`     | Cast vote (committee)                            |
| GET    | `/api/decisions/pending`      | Get my pending decisions                         |
| GET    | `/api/decisions/analytics`    | Decision analytics                               |

## Visibility

| View                  | Shows                                   |
| --------------------- | --------------------------------------- |
| **MyWork**            | Decisions waiting for me                |
| **Project Dashboard** | All pending decisions in project        |
| **Initiative View**   | Decisions blocking initiative           |
| **Task View**         | Decision blocking this task             |
| **Analytics**         | Decision metrics, patterns, bottlenecks |

## Configuration (per Organization)

```
decision_settings:
  default_deadline_days: 7
  escalation_enabled: true
  escalation_after_days: 7
  auto_expire_after_days: 14
  committee_threshold: 100000 (budget amount)
  voting_type: 'majority' | 'unanimous'
  reminders:
    - days: 3
    - days: 5
    - days: 6
```

## Metrics & Analytics

| Metric                | Description                         |
| --------------------- | ----------------------------------- |
| Average Decision Time | By type, by maker                   |
| Decision Backlog      | Pending decisions count             |
| Escalation Rate       | % decisions escalated               |
| Blocker Duration      | How long tasks blocked by decisions |
| Decision Pattern      | Most common outcomes                |

## Related Flows

- FLOW-PROJECT-001: Decisions can be project-level
- FLOW-INITIATIVE-001: Decisions can block initiatives
- FLOW-TASK-001: Decisions can block tasks
- FLOW-PMO-001: Stage gates are special decisions
- FLOW-AI-001: AI assists with decisions
- `docs/product/SYSTEM_ARCHITECTURE_BRIEF.md`
- `docs/product/INITIATIVE_GOVERNANCE_MODEL.md`
