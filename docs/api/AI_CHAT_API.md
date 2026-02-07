# AI Chat System - API Specification

> **Document:** AI_CHAT_API.md  
> **Version:** 1.0  
> **Created:** 2026-01-11  
> **Status:** APPROVED

---

## 1. Overview

This document specifies all API endpoints for the AI Chat system.

### Base URL

```
Production: https://api.consultinity.com/api
Development: http://localhost:3001/api
```

### Authentication

All endpoints require JWT authentication via Bearer token:

```
Authorization: Bearer <jwt_token>
```

---

## 2. Conversations API

### 2.1 List Conversations

```http
GET /conversations
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `folderId` | string | No | Filter by chat folder |
| `pmoProjectId` | string | No | Filter by PMO project |
| `archived` | boolean | No | Include archived (default: false) |
| `starred` | boolean | No | Filter starred only |
| `limit` | number | No | Max results (default: 50) |
| `offset` | number | No | Pagination offset |

**Response:**

```json
{
  "success": true,
  "data": {
    "conversations": [
      {
        "id": "conv_123",
        "title": "Budget Planning Discussion",
        "titleSource": "auto",
        "chatFolderId": "folder_456",
        "pmoProjectId": "proj_789",
        "messageCount": 15,
        "lastMessageAt": "2026-01-11T10:30:00Z",
        "starred": false,
        "archived": false,
        "createdAt": "2026-01-10T08:00:00Z"
      }
    ],
    "total": 42,
    "hasMore": true
  }
}
```

---

### 2.2 Create Conversation

```http
POST /conversations
```

**Request Body:**

```json
{
  "title": "New Discussion",
  "chatFolderId": "folder_456",
  "pmoProjectId": "proj_789"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "conv_new",
    "title": "New Discussion",
    "titleSource": "user",
    "chatFolderId": "folder_456",
    "pmoProjectId": "proj_789",
    "messageCount": 0,
    "starred": false,
    "archived": false,
    "createdAt": "2026-01-11T12:00:00Z"
  }
}
```

---

### 2.3 Get Conversation

```http
GET /conversations/:id
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "conv_123",
    "title": "Budget Planning Discussion",
    "titleSource": "auto",
    "chatFolderId": "folder_456",
    "pmoProjectId": "proj_789",
    "messageCount": 15,
    "lastMessageAt": "2026-01-11T10:30:00Z",
    "starred": false,
    "archived": false,
    "createdAt": "2026-01-10T08:00:00Z",
    "folder": {
      "id": "folder_456",
      "name": "Marketing Discussions",
      "color": "#3B82F6"
    },
    "pmoProject": {
      "id": "proj_789",
      "name": "Marketing Digital Transformation"
    }
  }
}
```

---

### 2.4 Update Conversation

```http
PATCH /conversations/:id
```

**Request Body:**

```json
{
  "title": "Updated Title",
  "chatFolderId": "folder_new",
  "starred": true
}
```

---

### 2.5 Delete Conversation

```http
DELETE /conversations/:id
```

---

### 2.6 Archive Conversation

```http
POST /conversations/:id/archive
```

---

### 2.7 Unarchive Conversation

```http
POST /conversations/:id/unarchive
```

---

## 3. Messages API

### 3.1 Get Messages

```http
GET /conversations/:id/messages
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | number | No | Max results (default: 100) |
| `before` | string | No | Messages before this ID |
| `after` | string | No | Messages after this ID |

**Response:**

```json
{
    "success": true,
    "data": {
        "messages": [
            {
                "id": "msg_123",
                "conversationId": "conv_123",
                "role": "user",
                "content": "How should we approach the budget?",
                "messageType": "text",
                "createdAt": "2026-01-11T10:00:00Z"
            },
            {
                "id": "msg_124",
                "conversationId": "conv_123",
                "role": "ai",
                "content": "Based on the project context...",
                "messageType": "text",
                "metadata": {
                    "thinkingSteps": [...],
                    "artifacts": [...],
                    "actions": [...]
                },
                "createdAt": "2026-01-11T10:00:15Z"
            }
        ],
        "hasMore": false
    }
}
```

---

### 3.2 Send Message

```http
POST /conversations/:id/messages
```

**Request Body:**

```json
{
  "content": "What's the best approach for this initiative?",
  "messageType": "text",
  "attachments": [
    {
      "type": "file",
      "fileId": "file_123"
    }
  ],
  "context": {
    "focusMode": "project",
    "workspaceContext": {
      "type": "initiative",
      "entityId": "init_456",
      "entityName": "Process Automation"
    }
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "messageId": "msg_125",
    "conversationId": "conv_123"
  }
}
```

Note: AI response is streamed separately via `/ai/chat/stream`

---

### 3.3 Update Message Feedback

```http
PATCH /conversations/:convId/messages/:msgId/feedback
```

**Request Body:**

```json
{
  "rating": "like",
  "comment": "Very helpful response!",
  "correction": null
}
```

---

## 4. Chat Streaming API

### 4.1 Stream Chat Response

```http
POST /ai/chat/stream
```

**Request Body:**

```json
{
  "message": "How should we approach this initiative?",
  "conversationId": "conv_123",
  "history": [
    { "role": "user", "content": "Previous message" },
    { "role": "assistant", "content": "Previous response" }
  ],
  "systemInstruction": "Optional system instruction override",
  "roleName": "CONSULTANT",
  "language": "pl",

  "projectId": "00000000-0000-0000-0000-000000000000",
  "screenContext": {
    "currentScreen": "initiatives",
    "selectedObjectType": "initiative",
    "selectedObjectId": "init_456"
  },
  "focusMode": "all",

  "context": {
    "workspaceContext": {
      "projectId": "00000000-0000-0000-0000-000000000000"
    }
  },

  "aiModes": {
    "deepResearch": false,
    "webSearch": false,
    "showReasoning": true
  },
  "knowledgeSources": {
    "pmoDocuments": true,
    "projectData": true,
    "organizationData": false
  },
  "responseStyle": "concise",

  "selectedTier": "BUDGET",
  "selectedModelId": null,

  "resumeFromPartial": false
}
```

**Response (Server-Sent Events):**

```
Content-Type: text/event-stream

data: {"type": "thought", "step": "Analyzing project context..."}

data: {"type": "thought", "step": "Reviewing initiative details..."}

data: {"text": "Based on "}

data: {"text": "your initiative..."}

data: [DONE]
```

**Event Types:**
| Type | Description |
|------|-------------|
| `thought` | AI thinking/reasoning step |
| `text` | Response text chunk (sent as `{"text": "..."}`) |
| `error` | Error message |

**Additional Event Types (Deep Research / tools):**
| Type | Description |
|------|-------------|
| `dt_hint` | Suggestion to enable Deep Research (when off) |
| `dt_state` | Deep Research state machine (e.g. research, synthesis, closure) |
| `research_visibility` | User-facing plan items for Deep Research |
| `dt_selfcheck` | Self-check / repair loop status |
| `citations` | Web-search citations metadata (when enabled) |

**Deep Research Gate (flow-control):**

If `aiModes.deepResearch = true` and the client **did not** confirm understanding, the server returns **HTTP 400 JSON**:

```json
{
  "error": "Deep Thinking requires Confirm Understanding first. Call /api/ai/chat/confirm and then retry with context.deepThinkingConfirmed=true.",
  "code": "DEEP_THINKING_CONFIRM_REQUIRED"
}
```

The client should call `/api/ai/chat/confirm` and then retry stream with `context.deepThinkingConfirmed=true`.

---

### 4.2 Confirm Understanding (Deep Research)

```http
POST /ai/chat/confirm
```

**Purpose:** returns a structured “Confirm Understanding” object for the Deep Research flow.

**Request Body:**

```json
{
  "message": "I want a deep analysis of X ...",
  "history": [],
  "language": "pl",
  "conversationId": "conv_123"
}
```

**Response (example):**

```json
{
  "confirm": {
    "understanding": {
      "goal": "...",
      "context": "...",
      "constraints": ["..."],
      "expectedOutput": "StructuredAnalysis",
      "decisionHorizon": "Średnioterminowy"
    },
    "isClearEnoughToProceed": false,
    "missingInfoQuestions": [
      { "id": "q1", "question": "...", "whyItMatters": "..." }
    ],
    "researchPlanItems": [
      { "id": "r1", "type": "ConceptualFrameworks", "label": "...", "rationale": "..." }
    ],
    "suggestedDepth": "Standard"
  }
}
```

---

### 4.3 Chat Attachments Ingestion (conversation-scoped RAG)

```http
POST /ai/attachments/ingest
```

**Auth:** Bearer JWT

**Content-Type:** `multipart/form-data`

**Form fields:**
| Field | Type | Required | Description |
|------|------|----------|-------------|
| `file` | file | Yes | Text/PDF/Markdown/CSV/JSON file (max 25MB) |

**Response:**

```json
{
  "success": true,
  "docId": "uuid",
  "filename": "README.md",
  "mimeType": "text/markdown",
  "totalChunks": 4,
  "embeddedChunks": 0
}
```

**Usage with chat stream:**

- Put the returned `docId` into `context.attachmentDocIds`.
- The backend will restrict retrieval to only those documents and inject matched chunks into the system instruction as `[A1]..[A5]`.

---

## 5. Chat Folders API

### 5.1 List Folders

```http
GET /chat-folders
```

**Response:**

```json
{
  "success": true,
  "data": {
    "folders": [
      {
        "id": "folder_123",
        "name": "Marketing Discussions",
        "description": "All marketing-related conversations",
        "color": "#3B82F6",
        "icon": "📁",
        "conversationCount": 5,
        "lastActivityAt": "2026-01-11T10:00:00Z",
        "createdAt": "2026-01-01T08:00:00Z"
      }
    ]
  }
}
```

---

### 5.2 Create Folder

```http
POST /chat-folders
```

**Request Body:**

```json
{
  "name": "New Folder",
  "description": "Folder description",
  "color": "#10B981",
  "icon": "📂",
  "customInstructions": "Focus on technical topics..."
}
```

---

### 5.3 Update Folder

```http
PATCH /chat-folders/:id
```

**Request Body:**

```json
{
  "name": "Updated Name",
  "color": "#EF4444"
}
```

---

### 5.4 Delete Folder

```http
DELETE /chat-folders/:id
```

Note: Conversations in folder are moved to "uncategorized", not deleted.

---

### 5.5 Move Conversation to Folder

```http
POST /chat-folders/:folderId/conversations/:conversationId
```

---

### 5.6 Remove Conversation from Folder

```http
DELETE /chat-folders/:folderId/conversations/:conversationId
```

---

## 6. AI Memory API

### 6.1 Get User Memory

```http
GET /ai/memory/user
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "mem_123",
    "userId": "user_456",
    "preferences": {
      "language": "pl",
      "detailLevel": "balanced",
      "communicationStyle": "casual",
      "timezone": "Europe/Warsaw"
    },
    "expertise": ["project management", "lean", "digital transformation"],
    "recentTopics": ["budget planning", "initiative review"],
    "interactionCount": 150,
    "lastInteractionAt": "2026-01-11T10:00:00Z"
  }
}
```

---

### 6.2 Update User Memory

```http
PUT /ai/memory/user
```

**Request Body:**

```json
{
  "preferences": {
    "detailLevel": "detailed",
    "communicationStyle": "formal"
  },
  "expertise": ["project management", "lean", "agile"]
}
```

---

### 6.3 Get Organization Memory

```http
GET /ai/memory/org
```

**Response:**

```json
{
    "success": true,
    "data": {
        "id": "orgmem_123",
        "organizationId": "org_456",
        "industry": "Manufacturing",
        "companySize": "medium",
        "strategicContext": "Focus on digital transformation...",
        "terminology": {
            "DRD": "Digital Readiness Diagnostic",
            "PMO": "Project Management Office"
        },
        "decisionPatterns": [...],
        "assessmentInsights": [...]
    }
}
```

---

### 6.4 Update Organization Memory

```http
PUT /ai/memory/org
```

**Request Body:**

```json
{
  "industry": "Manufacturing",
  "strategicContext": "Updated context...",
  "terminology": {
    "DRD": "Digital Readiness Diagnostic",
    "SIRI": "Smart Industry Readiness Index"
  }
}
```

---

## 7. AI Actions API

### 7.1 Get Pending Actions

```http
GET /ai/actions/pending
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `conversationId` | string | No | Filter by conversation |

**Response:**

```json
{
  "success": true,
  "data": {
    "actions": [
      {
        "id": "action_123",
        "conversationId": "conv_456",
        "messageId": "msg_789",
        "type": "create_initiative",
        "title": "Create Initiative",
        "description": "Process Automation Phase 1",
        "icon": "💡",
        "payload": {
          "name": "Process Automation Phase 1",
          "axisId": "axis_processes",
          "priority": "high"
        },
        "status": "pending",
        "createdAt": "2026-01-11T10:00:00Z"
      }
    ]
  }
}
```

---

### 7.2 Approve Action

```http
POST /ai/actions/:id/approve
```

**Request Body (optional modifications):**

```json
{
  "payloadModifications": {
    "priority": "medium"
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "actionId": "action_123",
    "status": "executed",
    "executedAt": "2026-01-11T10:05:00Z",
    "result": {
      "success": true,
      "resultId": "init_new",
      "message": "Initiative created successfully"
    }
  }
}
```

---

### 7.3 Reject Action

```http
POST /ai/actions/:id/reject
```

**Request Body:**

```json
{
  "reason": "Not applicable at this time"
}
```

---

### 7.4 Get Action History

```http
GET /ai/actions/history
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | string | No | Filter by status |
| `limit` | number | No | Max results |
| `offset` | number | No | Pagination |

---

## 8. AI Context API

### 8.1 Get Current Context

```http
GET /ai/context
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `view` | string | No | Current view name |
| `entityType` | string | No | Entity type |
| `entityId` | string | No | Entity ID |

**Response:**

```json
{
    "success": true,
    "data": {
        "systemContext": {
            "platform": "Consultinity",
            "standards": ["ISO 21500", "PMBOK 7", "PRINCE2"]
        },
        "organizationContext": {
            "industry": "Manufacturing",
            "terminology": {...}
        },
        "userContext": {
            "expertise": [...],
            "preferences": {...}
        },
        "workspaceContext": {
            "type": "initiative",
            "entityId": "init_123",
            "entityName": "Process Automation",
            "pmoProjectId": "proj_456",
            "data": {...}
        }
    }
}
```

---

### 8.2 Build Context for Chat

```http
POST /ai/context/build
```

**Request Body:**

```json
{
  "conversationId": "conv_123",
  "workspaceContext": {
    "type": "task",
    "entityId": "task_456"
  },
  "focusMode": "project"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "contextLayers": {
      "system": "...",
      "organization": "...",
      "user": "...",
      "workspace": "...",
      "conversation": "..."
    },
    "totalTokens": 2500,
    "warnings": []
  }
}
```

---

## 9. Error Responses

### Standard Error Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "details": {
      "field": "title",
      "issue": "Required field missing"
    }
  }
}
```

### Error Codes

| Code                  | HTTP Status | Description              |
| --------------------- | ----------- | ------------------------ |
| `UNAUTHORIZED`        | 401         | Invalid or missing token |
| `FORBIDDEN`           | 403         | Insufficient permissions |
| `NOT_FOUND`           | 404         | Resource not found       |
| `VALIDATION_ERROR`    | 400         | Invalid request data     |
| `CONFLICT`            | 409         | Resource conflict        |
| `AI_BUDGET_EXHAUSTED` | 429         | AI token budget exceeded |
| `AI_PROVIDER_ERROR`   | 502         | LLM provider error       |
| `INTERNAL_ERROR`      | 500         | Server error             |

---

## 10. Rate Limits

| Endpoint Category | Rate Limit | Window |
| ----------------- | ---------- | ------ |
| Conversations     | 100 req    | 1 min  |
| Messages          | 60 req     | 1 min  |
| Chat Stream       | 30 req     | 1 min  |
| AI Memory         | 20 req     | 1 min  |
| AI Actions        | 50 req     | 1 min  |

---

## 11. WebSocket Events (Future)

For real-time updates, WebSocket connection:

```
ws://api.consultinity.com/ws
```

**Events:**
| Event | Description |
|-------|-------------|
| `conversation.updated` | Conversation was modified |
| `message.new` | New message in conversation |
| `action.status_changed` | AI action status changed |
| `memory.updated` | User/org memory updated |

---

_Document Version: 1.0_  
_Last Updated: 2026-01-11_
