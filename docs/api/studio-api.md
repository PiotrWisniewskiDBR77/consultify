# Studio API Reference

Complete API documentation for Consultify Studio endpoints.

## Base URL

All endpoints are prefixed with `/api/studio`

## Authentication

All endpoints require authentication via Bearer token:

```
Authorization: Bearer <token>
```

---

## Documents

### List Documents

```http
GET /api/studio/documents
```

**Query Parameters:**
- `type` (string, optional) - Filter by diagram type
- `linkedTaskId` (string, optional) - Filter by linked task
- `linkedProjectId` (string, optional) - Filter by linked project
- `linkedInitiativeId` (string, optional) - Filter by linked initiative
- `limit` (number, optional, default: 50) - Results limit
- `offset` (number, optional, default: 0) - Pagination offset

**Response:**
```json
[
  {
    "id": "doc-123",
    "name": "Process Flow",
    "type": "process_flow",
    "nodes": [...],
    "edges": [...],
    "viewport": { "x": 0, "y": 0, "zoom": 1 },
    "createdAt": "2025-01-01T00:00:00Z",
    "updatedAt": "2025-01-01T00:00:00Z"
  }
]
```

---

### Create Document

```http
POST /api/studio/documents
```

**Request Body:**
```json
{
  "name": "My Diagram",
  "description": "Optional description",
  "type": "process_flow",
  "nodes": [],
  "edges": [],
  "viewport": { "x": 0, "y": 0, "zoom": 1 },
  "linkedTaskId": "task-123",
  "linkedProjectId": "project-456",
  "linkedInitiativeId": "init-789",
  "tags": ["tag1", "tag2"],
  "templateId": "template-123"
}
```

**Response:** `201 Created`
```json
{
  "id": "doc-123",
  "name": "My Diagram",
  "type": "process_flow",
  "nodes": [],
  "edges": [],
  "createdAt": "2025-01-01T00:00:00Z"
}
```

---

### Get Document

```http
GET /api/studio/documents/:id
```

**Response:**
```json
{
  "id": "doc-123",
  "name": "My Diagram",
  "type": "process_flow",
  "nodes": [...],
  "edges": [...],
  "viewport": {...},
  "snapshots": [...],
  "comments": [...],
  "aiMessages": [...]
}
```

---

### Update Document

```http
PUT /api/studio/documents/:id
```

**Request Body:**
```json
{
  "name": "Updated Name",
  "nodes": [...],
  "edges": [...],
  "viewport": {...},
  "createSnapshot": true,
  "snapshotReason": "manual"
}
```

**Response:**
```json
{
  "id": "doc-123",
  "name": "Updated Name",
  "nodes": [...],
  "edges": [...],
  "updatedAt": "2025-01-01T00:00:00Z"
}
```

---

### Delete Document

```http
DELETE /api/studio/documents/:id
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Document deleted"
}
```

---

## Snapshots

### Create Snapshot

```http
POST /api/studio/documents/:id/snapshot
```

**Request Body:**
```json
{
  "name": "Version 2.0",
  "reason": "manual"
}
```

**Response:** `201 Created`
```json
{
  "id": "snap-123",
  "documentId": "doc-123",
  "version": 2,
  "name": "Version 2.0",
  "createdAt": "2025-01-01T00:00:00Z"
}
```

---

### Restore Snapshot

```http
POST /api/studio/documents/:id/restore/:snapshotId
```

**Response:**
```json
{
  "id": "doc-123",
  "nodes": [...],
  "edges": [...],
  "updatedAt": "2025-01-01T00:00:00Z"
}
```

---

## Sharing

### Generate Share Link

```http
POST /api/studio/documents/:id/share
```

**Response:**
```json
{
  "shareToken": "abc123def456",
  "shareUrl": "/studio/shared/abc123def456"
}
```

---

### Get Shared Document

```http
GET /api/studio/shared/:token
```

**Response:** (Public, no auth required)
```json
{
  "id": "doc-123",
  "name": "Shared Diagram",
  "type": "process_flow",
  "nodes": [...],
  "edges": [...],
  "creatorName": "John Doe",
  "createdAt": "2025-01-01T00:00:00Z"
}
```

---

## Templates

### List Templates

```http
GET /api/studio/templates
```

**Query Parameters:**
- `category` (string, optional) - Filter by category

**Response:**
```json
[
  {
    "id": "tpl-123",
    "name": "Process Flow Template",
    "category": "process_flow",
    "nodes": [...],
    "edges": [...],
    "isPublic": true,
    "usageCount": 42
  }
]
```

---

### Create Template

```http
POST /api/studio/templates
```

**Request Body:**
```json
{
  "name": "My Template",
  "description": "Template description",
  "category": "process_flow",
  "nodes": [...],
  "edges": [...],
  "tags": ["tag1"],
  "isPublic": false,
  "fromDocumentId": "doc-123"
}
```

**Response:** `201 Created`
```json
{
  "id": "tpl-123",
  "name": "My Template",
  "category": "process_flow",
  "nodes": [...],
  "edges": [...]
}
```

---

## AI Endpoints

### Generate Diagram

```http
POST /api/studio/ai/generate
```

**Request Body:**
```json
{
  "prompt": "Create a process flow for employee onboarding",
  "diagramType": "process_flow"
}
```

**Response:**
```json
{
  "nodes": [
    {
      "id": "node-1",
      "type": "processStep",
      "position": { "x": 0, "y": 0 },
      "data": { "label": "Start Onboarding" }
    }
  ],
  "edges": [...],
  "diagramType": "process_flow",
  "suggestedTitle": "Employee Onboarding Process",
  "tokensUsed": 150
}
```

---

### Modify Diagram

```http
POST /api/studio/ai/modify
```

**Request Body:**
```json
{
  "prompt": "Add a decision point for manager approval",
  "nodes": [...],
  "edges": [...]
}
```

**Response:**
```json
{
  "nodes": [...],
  "edges": [...],
  "changes": {
    "added": ["node-5"],
    "modified": ["node-2"],
    "removed": []
  },
  "tokensUsed": 75
}
```

---

### AI Chat

```http
POST /api/studio/ai/chat
```

**Request Body:**
```json
{
  "message": "Create a process flow",
  "documentId": "doc-123",
  "context": {
    "nodes": [...],
    "edges": [...]
  }
}
```

**Response:**
```json
{
  "text": "I've created a process flow with 5 nodes.",
  "intent": "CREATE_DIAGRAM",
  "confidence": 0.9,
  "diagramUpdate": {
    "action": "replace",
    "nodes": [...],
    "edges": [...]
  }
}
```

---

### Get Suggestions

```http
POST /api/studio/ai/suggest
```

**Request Body:**
```json
{
  "nodes": [...],
  "edges": [...],
  "diagramType": "process_flow"
}
```

**Response:**
```json
{
  "suggestions": [
    {
      "type": "warning",
      "message": "2 nodes are not connected to the flow",
      "nodeIds": ["node-3", "node-4"]
    }
  ]
}
```

---

### Classify Intent

```http
POST /api/studio/ai/classify
```

**Request Body:**
```json
{
  "message": "Add a decision node"
}
```

**Response:**
```json
{
  "intent": "ADD_NODE",
  "confidence": 0.85
}
```

---

## Linking

### Link Document

```http
POST /api/studio/documents/:id/link
```

**Request Body:**
```json
{
  "taskId": "task-123",
  "projectId": "project-456",
  "initiativeId": "init-789"
}
```

**Response:**
```json
{
  "id": "doc-123",
  "linkedTaskId": "task-123",
  "linkedProjectId": "project-456",
  "linkedInitiativeId": "init-789"
}
```

---

## Comments

### Add Comment

```http
POST /api/studio/documents/:id/comments
```

**Request Body:**
```json
{
  "nodeId": "node-123",
  "text": "This step needs clarification"
}
```

**Response:** `201 Created`
```json
{
  "id": "comment-123",
  "documentId": "doc-123",
  "nodeId": "node-123",
  "text": "This step needs clarification",
  "authorId": "user-123",
  "createdAt": "2025-01-01T00:00:00Z"
}
```

---

### Resolve Comment

```http
PUT /api/studio/comments/:commentId/resolve
```

**Response:**
```json
{
  "id": "comment-123",
  "resolved": true,
  "resolvedAt": "2025-01-01T00:00:00Z",
  "resolvedBy": "user-123"
}
```

---

## Error Responses

All endpoints may return standard error responses:

**400 Bad Request**
```json
{
  "error": "Name is required"
}
```

**401 Unauthorized**
```json
{
  "error": "Authentication required"
}
```

**404 Not Found**
```json
{
  "error": "Document not found"
}
```

**500 Internal Server Error**
```json
{
  "error": "Failed to process request"
}
```

---

## Rate Limits

- Standard API rate limits apply
- AI endpoints: 10 requests/minute per user
- Document operations: 100 requests/minute per user

---

## Webhooks

Studio supports webhooks for document events (coming soon):
- `document.created`
- `document.updated`
- `document.deleted`
- `snapshot.created`

---

**Last Updated**: 2025-01-XX

