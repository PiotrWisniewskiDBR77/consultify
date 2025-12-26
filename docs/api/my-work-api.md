# My Work API Reference

## Overview

The My Work API provides endpoints for personal task management, inbox triage, execution tracking, and notifications. Part of the PMO upgrade to world-class standards.

## Base URL

```
/api/my-work
/api/notifications
```

## Authentication

All endpoints require JWT authentication via `Authorization: Bearer <token>` header.

---

## Focus API

### GET /api/my-work/focus

Get focus tasks for a specific date.

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `date` | string | No | ISO date (YYYY-MM-DD). Defaults to today |

**Response:**

```json
{
  "board": {
    "date": "2024-12-27",
    "userId": "uuid",
    "tasks": [
      {
        "id": "uuid",
        "taskId": "uuid",
        "title": "Review PMO report",
        "timeBlock": "morning",
        "position": 0,
        "priority": "high",
        "dueTime": "14:00",
        "initiativeName": "Digital Transformation",
        "projectName": "Project Alpha",
        "estimatedMinutes": 60,
        "isCompleted": false,
        "pmoCategory": "blocking_phase"
      }
    ],
    "maxTasks": 5,
    "executionScore": 78,
    "completedCount": 2
  },
  "suggestions": {
    "suggestedTasks": [...],
    "reasoning": "Based on your deadlines and priorities...",
    "generatedAt": "2024-12-27T08:00:00Z"
  }
}
```

### PUT /api/my-work/focus

Set focus tasks for a specific date.

**Request Body:**

```json
{
  "date": "2024-12-27",
  "tasks": [
    {
      "taskId": "uuid",
      "timeBlock": "morning",
      "position": 0
    },
    {
      "taskId": "uuid",
      "timeBlock": "afternoon",
      "position": 1
    }
  ]
}
```

**Response:**

```json
{
  "success": true,
  "board": { ... }
}
```

### POST /api/my-work/focus/reorder

Reorder tasks within the focus board.

**Request Body:**

```json
{
  "date": "2024-12-27",
  "fromIndex": 0,
  "toIndex": 2
}
```

**Response:**

```json
{
  "success": true,
  "tasks": [...]
}
```

### POST /api/my-work/focus/ai-suggest

Get AI-powered suggestions for focus tasks.

**Request Body:**

```json
{
  "date": "2024-12-27",
  "projectId": "uuid" // Optional - filter by project
}
```

**Response:**

```json
{
  "suggestions": {
    "suggestedTasks": [
      {
        "taskId": "uuid",
        "title": "Urgent: Client review",
        "reason": "Blocking phase gate, due today",
        "suggestedTimeBlock": "morning",
        "priority": "urgent"
      }
    ],
    "reasoning": "I've prioritized tasks that are blocking phase gates...",
    "generatedAt": "2024-12-27T08:00:00Z"
  }
}
```

---

## Inbox API

### GET /api/my-work/inbox

Get inbox items requiring triage.

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `includeTriaged` | boolean | No | Include already triaged items |
| `limit` | number | No | Max items to return (default: 50) |

**Response:**

```json
{
  "summary": {
    "total": 12,
    "critical": 2,
    "newToday": 5,
    "groups": {
      "urgent": [...],
      "new_assignments": [...],
      "mentions": [...],
      "review_requests": [...],
      "other": [...]
    }
  },
  "items": [
    {
      "id": "uuid",
      "type": "new_assignment",
      "title": "New task: Review documentation",
      "description": "Assigned by @Jan Kowalski",
      "source": {
        "type": "user",
        "userId": "uuid",
        "userName": "Jan Kowalski",
        "avatarUrl": "..."
      },
      "receivedAt": "2024-12-27T10:30:00Z",
      "urgency": "normal",
      "linkedTaskId": "uuid",
      "linkedTask": {
        "id": "uuid",
        "title": "Review documentation",
        "status": "todo",
        "priority": "medium",
        "dueDate": "2024-12-30"
      },
      "triaged": false
    }
  ]
}
```

### POST /api/my-work/inbox/:id/triage

Triage a single inbox item.

**URL Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `id` | string | Inbox item ID |

**Request Body:**

```json
{
  "action": "accept_today",
  "params": {}
}
```

Or for scheduling:

```json
{
  "action": "schedule",
  "params": {
    "date": "2024-12-30",
    "timeBlock": "afternoon"
  }
}
```

Or for delegation:

```json
{
  "action": "delegate",
  "params": {
    "userId": "uuid",
    "message": "Can you handle this?"
  }
}
```

**Response:**

```json
{
  "success": true,
  "item": {
    "id": "uuid",
    "triaged": true,
    "triagedAt": "2024-12-27T11:00:00Z",
    "triageAction": "accept_today"
  }
}
```

### POST /api/my-work/inbox/bulk-triage

Triage multiple inbox items at once.

**Request Body:**

```json
{
  "itemIds": ["uuid1", "uuid2", "uuid3"],
  "action": "archive",
  "params": {
    "reason": "Not relevant to current sprint"
  }
}
```

**Response:**

```json
{
  "success": true,
  "triaged": 3,
  "items": [...]
}
```

---

## Dashboard API

### GET /api/my-work/dashboard

Get dashboard data (existing endpoint, enhanced).

**Response:**

```json
{
  "overdueCount": 3,
  "dueThisWeekCount": 8,
  "blockedCount": 1,
  "completedCount": 15,
  "totalCount": 27,
  "todayFocus": [...],
  "executionScore": 78
}
```

### GET /api/my-work/execution-score

Get detailed execution score and metrics.

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `historyDays` | number | No | Days of history (default: 30) |

**Response:**

```json
{
  "score": {
    "current": 78,
    "trend": "up",
    "vsLastWeek": 5,
    "breakdown": {
      "completionRate": 85,
      "onTimeRate": 72,
      "velocityScore": 80,
      "qualityScore": 75
    },
    "rank": {
      "position": 3,
      "totalInTeam": 12,
      "percentile": 75
    },
    "streak": {
      "current": 7,
      "best": 14,
      "lastBreak": "2024-12-20"
    }
  },
  "history": [
    {
      "date": "2024-12-26",
      "score": 73,
      "completedCount": 4,
      "overdueCount": 1,
      "onTimeRate": 0.8
    }
  ],
  "bottlenecks": [
    {
      "type": "stalled_tasks",
      "count": 2,
      "impact": "medium",
      "suggestion": "Review tasks with no activity in 7+ days",
      "affectedTasks": ["uuid1", "uuid2"]
    }
  ]
}
```

### GET /api/my-work/velocity

Get velocity metrics.

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `period` | string | No | "week" or "month" (default: "week") |
| `weeks` | number | No | Number of periods (default: 4) |

**Response:**

```json
{
  "metrics": {
    "period": "week",
    "data": [
      {
        "date": "2024-12-23",
        "completed": 12,
        "created": 8,
        "netVelocity": 4
      }
    ],
    "averageVelocity": 10.5,
    "teamAverageVelocity": 8.2,
    "trend": "up"
  }
}
```

### GET /api/my-work/bottlenecks

Get current bottlenecks and suggestions.

**Response:**

```json
{
  "bottlenecks": [
    {
      "type": "decision_delay",
      "count": 3,
      "impact": "high",
      "suggestion": "3 decisions pending >7 days are blocking progress",
      "affectedTasks": [...],
      "affectedInitiatives": [...]
    }
  ]
}
```

### GET /api/my-work/workload

Get team workload data.

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `teamId` | string | No | Filter by team |
| `days` | number | No | Days to display (default: 7) |

**Response:**

```json
{
  "workload": {
    "period": {
      "start": "2024-12-27",
      "end": "2025-01-03"
    },
    "members": [
      {
        "userId": "uuid",
        "userName": "Anna Kowalska",
        "avatarUrl": "...",
        "allocation": 85,
        "status": "at_capacity",
        "taskCount": 8,
        "hoursAllocated": 34,
        "hoursCapacity": 40,
        "dailyBreakdown": [
          { "date": "2024-12-27", "allocation": 100, "taskCount": 3 },
          { "date": "2024-12-28", "allocation": 60, "taskCount": 2 }
        ]
      }
    ],
    "teamAverage": 72,
    "overloadedCount": 2,
    "underutilizedCount": 1
  }
}
```

---

## Notifications API

### GET /api/notifications/preferences

Get notification preferences for current user.

**Response:**

```json
{
  "preferences": {
    "userId": "uuid",
    "categories": {
      "task_assigned": { "inapp": true, "push": true, "email": false },
      "task_overdue": { "inapp": true, "push": true, "email": true },
      "decision_required": { "inapp": true, "push": true, "email": true },
      "mention": { "inapp": true, "push": true, "email": false },
      "comment": { "inapp": true, "push": false, "email": false },
      "status_change": { "inapp": true, "push": false, "email": false },
      "ai_insight": { "inapp": true, "push": false, "email": false },
      "blocking_alert": { "inapp": true, "push": true, "email": true }
    },
    "quietHours": {
      "enabled": true,
      "start": "20:00",
      "end": "08:00",
      "timezone": "Europe/Warsaw"
    },
    "weekendSettings": {
      "criticalOnly": true,
      "digestOnly": false
    },
    "dailyDigest": {
      "enabled": true,
      "time": "09:00"
    },
    "weeklyDigest": {
      "enabled": true,
      "day": "monday",
      "time": "09:00"
    }
  }
}
```

### PUT /api/notifications/preferences

Update notification preferences.

**Request Body:**

```json
{
  "preferences": {
    "categories": {
      "task_assigned": { "push": false }
    },
    "quietHours": {
      "enabled": true,
      "start": "21:00",
      "end": "07:00"
    }
  }
}
```

**Response:**

```json
{
  "success": true,
  "preferences": { ... }
}
```

### GET /api/notifications/digest

Get digest preview (for testing/preview purposes).

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `period` | string | No | "daily" or "weekly" (default: "daily") |

**Response:**

```json
{
  "digest": {
    "period": "daily",
    "generatedAt": "2024-12-27T09:00:00Z",
    "summary": {
      "tasksCompleted": 5,
      "tasksCreated": 3,
      "overdueCount": 1,
      "decisionsRequired": 2,
      "executionScore": 78,
      "scoreChange": 3
    },
    "highlights": [
      {
        "type": "achievement",
        "title": "7-Day Streak!",
        "description": "You've completed all focus tasks for 7 days in a row"
      }
    ],
    "upcomingDeadlines": [
      {
        "taskId": "uuid",
        "title": "Client presentation",
        "dueDate": "2024-12-28"
      }
    ],
    "aiInsights": [
      "Consider delegating 2 low-priority tasks to free capacity for strategic work"
    ]
  }
}
```

---

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": { ... }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request parameters |
| `MAX_FOCUS_EXCEEDED` | 400 | Cannot add more than 5 focus tasks |
| `ALREADY_TRIAGED` | 400 | Inbox item already triaged |
| `INVALID_TRIAGE_ACTION` | 400 | Invalid triage action for item type |

---

## Rate Limits

| Endpoint Group | Limit |
|----------------|-------|
| Focus API | 100 requests/minute |
| Inbox API | 100 requests/minute |
| Dashboard API | 60 requests/minute |
| Notifications API | 30 requests/minute |

---

## Webhooks

The My Work module emits the following webhook events:

| Event | Description |
|-------|-------------|
| `focus.updated` | Focus board was modified |
| `inbox.triaged` | Inbox item was triaged |
| `execution_score.changed` | Execution score changed significantly |
| `bottleneck.detected` | New bottleneck detected |

See [Webhook Documentation](/docs/api/webhooks.md) for integration details.

