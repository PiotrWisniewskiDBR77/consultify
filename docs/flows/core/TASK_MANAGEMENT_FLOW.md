# FLOW-TASK-001: Task Management

> **ID:** FLOW-TASK-001 | **Status:** ✅ Complete | **Priority:** P0

## Overview

| Metric                    | Value              |
| ------------------------- | ------------------ |
| **Completeness**          | 85%                |
| **Gaps Identified**       | 2                  |
| **Implementation Status** | Mostly implemented |

## Purpose

Zarządzanie zadaniami w ramach inicjatyw - kluczowy poziom pracy operacyjnej.

## Task Hierarchy

```
Organization
└── Location (optional)
    └── Project
        └── Initiative
            └── Task ← (tu jesteśmy)
                └── Decision (blocking)
```

## Task Status Machine

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    TODO     │────►│ IN_PROGRESS │────►│   REVIEW    │
└─────────────┘     └──────┬──────┘     └──────┬──────┘
                          │                    │
                          ▼                    ▼
                    ┌──────────┐         ┌──────────┐
                    │ BLOCKED  │         │   DONE   │
                    └──────────┘         └──────────┘
```

## Triggers

| Trigger           | Description                             |
| ----------------- | --------------------------------------- |
| Manual Creation   | PM/User tworzy task                     |
| From Initiative   | Task generowany z planning inicjatywy   |
| AI Suggestion     | AI sugeruje task na podstawie kontekstu |
| Decision Blocking | Task blokowany przez pending decision   |

## Decision Integration

Task może być zablokowany przez brak decyzji:

```
Task Status: BLOCKED
Blocked By: Decision #DEC-123
Blocked Since: 2024-01-15
Blocked Reason: "Waiting for budget approval"

Actions Available:
├── View Decision Details
├── Escalate Decision
└── Cancel Task
```

### Auto-Blocking

Gdy tworzony jest Decision Request z `task_id`, task automatycznie:

1. Zmienia status na BLOCKED
2. Zapisuje `blocked_by_decision_id`
3. Zapisuje `blocked_at` i `blocked_reason`

### Auto-Unblocking

Gdy Decision jest `made`:

1. Task automatycznie zmienia status na poprzedni (IN_PROGRESS)
2. `blocked_by_decision_id` = NULL
3. Notyfikacja do assignee

## Existing Features

- ✅ CRUD operations
- ✅ Comments
- ✅ Assignment/Reassignment
- ✅ Escalation system
- ✅ Overdue tracking
- ✅ At-risk tracking
- ✅ Workload analysis

## Gap Analysis

### GAP-TASK-001: Brak integracji z Decision System

| Attribute    | Value                                  |
| ------------ | -------------------------------------- |
| **Priority** | HIGH                                   |
| **Effort**   | 4h                                     |
| **Impact**   | Taski nie pokazują decyzji blokujących |

**Solution:**

- Dodać `blocked_by_decision_id` do tasks (done in migration 247)
- Auto-block when decision created with task_id
- Auto-unblock when decision made
- UI: Show blocking decision on task card

---

### GAP-TASK-002: Brak move task to different initiative

| Attribute    | Value                          |
| ------------ | ------------------------------ |
| **Priority** | MEDIUM                         |
| **Effort**   | 2h                             |
| **Impact**   | Taski nie mogą być przenoszone |

**Solution:**

- Endpoint: `POST /api/tasks/:id/move`
- Validate initiative belongs to same org
- Update `initiative_id` and `project_id`
- Audit log

## API Endpoints

### Existing

| Method | Endpoint                     | Description     |
| ------ | ---------------------------- | --------------- |
| GET    | `/api/tasks`                 | List tasks      |
| POST   | `/api/tasks`                 | Create task     |
| GET    | `/api/tasks/:id`             | Get task        |
| PUT    | `/api/tasks/:id`             | Update task     |
| DELETE | `/api/tasks/:id`             | Delete task     |
| POST   | `/api/tasks/:id/assign`      | Assign task     |
| POST   | `/api/tasks/:id/reassign`    | Reassign task   |
| POST   | `/api/tasks/:id/unassign`    | Unassign task   |
| POST   | `/api/tasks/:id/escalate`    | Escalate task   |
| GET    | `/api/tasks/:id/escalations` | Get escalations |
| GET    | `/api/tasks/:id/comments`    | Get comments    |
| POST   | `/api/tasks/:id/comments`    | Add comment     |

### To Add

| Method | Endpoint                           | Description                        |
| ------ | ---------------------------------- | ---------------------------------- |
| POST   | `/api/tasks/:id/block`             | Block task (manual or by decision) |
| POST   | `/api/tasks/:id/unblock`           | Unblock task                       |
| POST   | `/api/tasks/:id/move`              | Move to different initiative       |
| GET    | `/api/tasks/:id/blocking-decision` | Get blocking decision details      |

## MyWork Integration

Tasks appear in MyWork view:

- **My Tasks** - Assigned to me
- **Decisions Needed** - My tasks blocked by decisions I need to make
- **Blocked Tasks** - My tasks blocked by others' decisions

## Related Flows

- FLOW-INITIATIVE-001: Tasks belong to initiatives
- FLOW-DECISION-001: Decisions can block tasks
- FLOW-PROJECT-001: Tasks belong to projects
- FLOW-PMO-001: Task roles per PMO standard
