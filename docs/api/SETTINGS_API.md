# Settings API Documentation

> Complete API reference for the Settings module endpoints

## Overview

The Settings API provides endpoints for managing user preferences, AI settings, templates, history, API keys, webhooks, and GDPR compliance features.

**Base URL:** `/api/settings`

**Authentication:** All endpoints require Bearer token authentication.

---

## AI Settings Preferences

### AI Instructions

```
GET  /api/settings/preferences/ai-instructions
PUT  /api/settings/preferences/ai-instructions
```

**Request Body (PUT):**

```json
{
  "preferences": {
    "systemPrompt": "Be concise and professional",
    "responseStyle": "balanced",
    "includeContext": true,
    "maxContextLength": 4000
  }
}
```

### AI Model Selection

```
GET  /api/settings/preferences/ai-model
PUT  /api/settings/preferences/ai-model
```

**Request Body (PUT):**

```json
{
  "preferences": {
    "preferredModel": "gpt-4",
    "fallbackModel": "gpt-3.5-turbo",
    "autoSelect": true,
    "preferSpeed": false,
    "preferQuality": true
  }
}
```

### AI Parameters

```
GET  /api/settings/preferences/ai-parameters
PUT  /api/settings/preferences/ai-parameters
```

**Request Body (PUT):**

```json
{
  "preferences": {
    "temperature": 0.7,
    "maxTokens": 2048,
    "topP": 1,
    "frequencyPenalty": 0,
    "presencePenalty": 0,
    "streamResponse": true
  }
}
```

### AI Personality

```
GET  /api/settings/preferences/ai-personality
PUT  /api/settings/preferences/ai-personality
```

**Request Body (PUT):**

```json
{
  "preferences": {
    "tone": "professional",
    "formality": "balanced",
    "verbosity": "concise",
    "creativity": "moderate",
    "customInstructions": ""
  }
}
```

### AI Auto-Complete

```
GET  /api/settings/preferences/ai-autocomplete
PUT  /api/settings/preferences/ai-autocomplete
```

**Request Body (PUT):**

```json
{
  "preferences": {
    "enabled": true,
    "triggerDelay": 500,
    "minChars": 3,
    "suggestions": 3,
    "contexts": ["tasks", "comments", "documents"]
  }
}
```

### AI Memory

```
GET     /api/settings/preferences/ai-memory
PUT     /api/settings/preferences/ai-memory
DELETE  /api/settings/preferences/ai-memory/clear
```

**Request Body (PUT):**

```json
{
  "preferences": {
    "enabled": true,
    "retentionDays": 30,
    "includeConversations": true,
    "includePreferences": true,
    "includeContext": true
  }
}
```

### AI Voice/TTS

```
GET  /api/settings/preferences/ai-voice
PUT  /api/settings/preferences/ai-voice
```

**Request Body (PUT):**

```json
{
  "preferences": {
    "ttsEnabled": false,
    "sttEnabled": false,
    "voice": "alloy",
    "speed": 1.0,
    "autoPlay": false
  }
}
```

### AI Usage Statistics

```
GET /api/settings/ai-usage?period=30d
```

**Query Parameters:**

- `period` - Time period: `7d`, `30d`, `90d` (default: `30d`)

**Response:**

```json
{
  "period": "30d",
  "stats": {
    "totalRequests": 1247,
    "totalTokens": 892450,
    "totalCost": 8.92,
    "avgResponseTime": 1.5,
    "successRate": 99.5,
    "limit": 1000000,
    "used": 892450
  },
  "usageByFeature": [...],
  "dailyUsage": [...]
}
```

---

## Settings Templates

### List Templates

```
GET /api/settings/templates
```

**Response:**

```json
{
  "templates": [
    {
      "id": "minimal",
      "name": "Minimal",
      "description": "Clean, distraction-free settings",
      "icon": "🎯",
      "type": "system"
    },
    {
      "id": "custom-123",
      "name": "My Setup",
      "description": "Personal configuration",
      "icon": "⭐",
      "type": "custom",
      "createdAt": "2026-01-09T12:00:00Z"
    }
  ]
}
```

### Create Template

```
POST /api/settings/templates
```

**Request Body:**

```json
{
  "name": "My Custom Template",
  "description": "Optional description",
  "icon": "📋",
  "settingsData": {
    "ai": { "enabled": true },
    "notifications": { "email": true }
  }
}
```

### Update Template

```
PUT /api/settings/templates/:id
```

### Delete Template

```
DELETE /api/settings/templates/:id
```

### Apply Template

```
POST /api/settings/templates/:id/apply
```

**Response:**

```json
{
  "success": true,
  "applied": { ... }
}
```

---

## Settings History

### Get History

```
GET /api/settings/history?category=all&days=30
```

**Query Parameters:**

- `category` - Filter by category: `all`, `Profile`, `Security`, `Privacy`, `AI`, etc.
- `days` - Limit to last N days (default: 30)

**Response:**

```json
{
  "entries": [
    {
      "id": "entry-123",
      "category": "AI",
      "setting": "Preferred Model",
      "action": "updated",
      "oldValue": "GPT-3.5",
      "newValue": "GPT-4",
      "timestamp": "2026-01-09T12:00:00Z",
      "device": "Chrome on MacOS",
      "ipAddress": "192.168.1.1"
    }
  ],
  "stats": {
    "total": 42,
    "today": 3,
    "categories": 7
  }
}
```

### Restore Setting

```
POST /api/settings/history/restore/:id
```

---

## Settings Export/Import

### Export Settings

```
POST /api/settings/export
```

**Request Body:**

```json
{
  "categories": ["profile", "ai", "notifications"]
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "version": "1.0.0",
    "exportedAt": "2026-01-09T12:00:00Z",
    "userId": "user-123",
    "settings": { ... }
  }
}
```

### Import Settings

```
POST /api/settings/import
```

**Request Body:**

```json
{
  "data": { ... },
  "overwrite": false
}
```

**Response:**

```json
{
  "success": true,
  "imported": ["profile", "ai"],
  "skipped": ["notifications"]
}
```

---

## API Keys

### List API Keys

```
GET /api/settings/api-keys
```

**Response:**

```json
{
  "keys": [
    {
      "id": "key-123",
      "name": "My API Key",
      "keyPrefix": "ck_abcdef12",
      "rateLimit": 1000,
      "lastUsedAt": "2026-01-09T12:00:00Z",
      "createdAt": "2026-01-01T00:00:00Z"
    }
  ]
}
```

### Create API Key

```
POST /api/settings/api-keys
```

**Request Body:**

```json
{
  "name": "Production Key",
  "permissions": ["read", "write"],
  "rateLimit": 1000,
  "expiresAt": "2027-01-01T00:00:00Z"
}
```

**Response (key shown only once!):**

```json
{
  "success": true,
  "key": {
    "id": "key-123",
    "name": "Production Key",
    "key": "ck_abcdefghijklmnopqrstuvwxyz12345",
    "keyPrefix": "ck_abcdef12",
    "createdAt": "2026-01-09T12:00:00Z"
  }
}
```

### Update API Key

```
PUT /api/settings/api-keys/:id
```

### Delete API Key

```
DELETE /api/settings/api-keys/:id
```

### Rotate API Key

```
POST /api/settings/api-keys/:id/rotate
```

---

## Webhooks

### List Webhooks

```
GET /api/settings/webhooks
```

### Create Webhook

```
POST /api/settings/webhooks
```

**Request Body:**

```json
{
  "name": "Task Notifications",
  "url": "https://example.com/webhook",
  "events": ["task.created", "task.completed"],
  "headers": { "X-Custom-Header": "value" }
}
```

**Response:**

```json
{
  "success": true,
  "webhook": {
    "id": "webhook-123",
    "name": "Task Notifications",
    "url": "https://example.com/webhook",
    "events": ["task.created", "task.completed"],
    "secret": "whsec_abcdefghijklmnop"
  }
}
```

### Update Webhook

```
PUT /api/settings/webhooks/:id
```

### Delete Webhook

```
DELETE /api/settings/webhooks/:id
```

### Test Webhook

```
POST /api/settings/webhooks/:id/test
```

**Response:**

```json
{
  "success": true,
  "status": 200,
  "message": "Webhook test successful"
}
```

---

## GDPR Compliance

### Export Status

```
GET /api/settings/gdpr/export-status
```

### Request Export

```
POST /api/settings/gdpr/export-request
```

**Response:**

```json
{
  "request": {
    "id": "export-123",
    "status": "completed",
    "requestedAt": "2026-01-09T12:00:00Z",
    "expiresAt": "2026-01-16T12:00:00Z"
  },
  "success": true
}
```

### Download Export

```
GET /api/settings/gdpr/export-download/:requestId
```

Returns JSON file as download.

### Deletion Status

```
GET /api/settings/gdpr/deletion-status
```

### Request Deletion

```
POST /api/settings/gdpr/deletion-request
```

**Request Body:**

```json
{
  "reason": "No longer using the service"
}
```

**Response:**

```json
{
  "request": {
    "id": "delete-123",
    "status": "scheduled",
    "scheduledAt": "2026-02-08T12:00:00Z",
    "requestedAt": "2026-01-09T12:00:00Z"
  },
  "success": true
}
```

### Cancel Deletion

```
POST /api/settings/gdpr/cancel-deletion
```

---

## Error Responses

All endpoints may return the following error responses:

### 401 Unauthorized

```json
{
  "error": "User not authenticated"
}
```

### 400 Bad Request

```json
{
  "error": "Invalid preferences payload"
}
```

### 404 Not Found

```json
{
  "error": "Resource not found"
}
```

### 500 Internal Server Error

```json
{
  "error": "Internal server error message"
}
```

---

## Rate Limits

- Standard endpoints: 100 requests/minute
- AI Usage endpoint: 10 requests/minute
- Export/Import: 5 requests/minute
- API Key creation: 10 keys/user maximum

---

## Changelog

### 2026-01-09

- Added all AI Settings endpoints (Instructions, Model, Parameters, Personality, AutoComplete, Memory, Voice, Usage)
- Added Templates CRUD with system templates
- Added Settings History with restore capability
- Added Export/Import functionality
- Added User API Keys management
- Added Webhooks management with test endpoint
- Added full GDPR compliance (export, delete, cancel)
