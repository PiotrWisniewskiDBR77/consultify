# FLOW-DECISION-001: Decision System

> **ID:** FLOW-DECISION-001 | **Status:** ✅ Complete | **Priority:** P0

## Overview

| Metric                    | Value              |
| ------------------------- | ------------------ |
| **Completeness**          | 100%               |
| **Implementation Status** | New implementation |

## Purpose

System decyzji - serce Consultinity. Umożliwia formalne podejmowanie decyzji z audit trail, eskalacją i AI learning.

## Core Concept

> **"Decyzje to serce systemu Consultinity"**

Task lub inicjatywa może być zablokowana bo brak decyzji. System:

- Identyfikuje blokady
- Umożliwia formalne request for decision
- Śledzi kto przeciąga prace
- AI uczy się trendów decyzyjnych

## Triggers

| Trigger        | Description                                    |
| -------------- | ---------------------------------------------- |
| Manual Request | User tworzy request for decision               |
| AI Detection   | AI wykrywa blokadę i sugeruje decision request |
| Deadline       | Automatyczna eskalacja po deadline             |
| Escalation     | Brak decyzji → eskalacja do wyższego levelu    |

## Outcomes

- Formalna decyzja podjęta z uzasadnieniem
- Blokada usunięta
- Audit trail kompletny
- AI nauczył się z decyzji

## Actors

| Actor          | Role                                      |
| -------------- | ----------------------------------------- |
| Requester      | Tworzy request for decision               |
| Decision Maker | Podejmuje decyzję                         |
| Stakeholders   | Są informowani                            |
| AI             | Wykrywa, analizuje, rekomenduje, uczy się |

## Decision Structure

| Field             | Required | Description                                    |
| ----------------- | -------- | ---------------------------------------------- |
| title             | ✅       | Krótki opis decyzji                            |
| description       | ✅       | Pełne wyjaśnienie kontekstu                    |
| type              | ✅       | GO_NO_GO, APPROVAL, RESOURCE_ALLOCATION, OTHER |
| deadline          | ✅       | Kiedy decyzja potrzebna                        |
| decision_maker_id | ✅       | Kto decyduje                                   |
| stakeholders      | ○        | Kto jest informowany                           |
| options           | ○        | Opcje do wyboru (JSON array)                   |
| criteria          | ○        | Kryteria decyzji (JSON)                        |
| attachments       | ○        | Dokumenty wspierające                          |
| project_id        | ○        | Powiązanie z projektem                         |
| initiative_id     | ○        | Powiązanie z inicjatywą                        |
| task_id           | ○        | Powiązanie z taskiem (blokada)                 |

## Status Machine

```
┌─────────┐     ┌─────────┐     ┌───────────┐
│ PENDING │────►│  MADE   │     │ CANCELLED │
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

For high-value decisions (configurable threshold):

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
