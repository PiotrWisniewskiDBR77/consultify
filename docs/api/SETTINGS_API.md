# Settings API Documentation

This document describes all API endpoints available for user settings and preferences.

## Authentication

All Settings API endpoints require authentication via Bearer token:

```
Authorization: Bearer <access_token>
```

## Base URL

All endpoints are prefixed with `/api/` or `/api/user/` or `/api/settings/`

## Endpoints

### Active Sessions

#### GET /api/auth/sessions

Returns active sessions for the current user.

**Response:**
```json
{
  "sessions": [
    {
      "id": "session_123",
      "deviceInfo": "Desktop",
      "device": "Desktop",
      "browser": "Chrome 120",
      "location": "New York, USA",
      "ipAddress": "192.168.1.100",
      "lastActive": "2025-01-15T10:30:00Z",
      "current": true
    }
  ]
}
```

#### DELETE /api/auth/sessions/:id

Revokes a specific session.

#### POST /api/auth/sessions/revoke-all

Revokes all sessions except the current one.

### Login History

#### GET /api/auth/login-history

Returns login history for the current user.

**Query Parameters:**
- `limit` (optional): Number of results (default: 50)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "login_123",
      "ip_address": "192.168.1.100",
      "user_agent": "Chrome on Windows",
      "location": "New York, USA",
      "status": "success",
      "device": "Chrome on Windows",
      "time": "2025-01-15T10:30:00Z",
      "created_at": "2025-01-15T10:30:00Z"
    }
  ]
}
```

### API Keys

#### GET /api/user/api-keys

Returns API keys for the current user.

**Response:**
```json
{
  "keys": [
    {
      "id": "key_123",
      "name": "Production Key",
      "prefix": "ck_live_",
      "createdAt": "2025-01-15T00:00:00Z",
      "lastUsed": "2 hours ago",
      "rateLimit": 1000,
      "quotaLimit": 100000,
      "quotaUsed": 45000,
      "quotaResetAt": "2025-01-22T00:00:00Z",
      "expiresAt": "2026-01-15T00:00:00Z",
      "ipWhitelist": ["192.168.1.1"],
      "scopes": ["read", "write"]
    }
  ]
}
```

#### POST /api/user/api-keys

Creates a new API key.

**Request:**
```json
{
  "name": "Production Key",
  "scopes": ["read", "write"]
}
```

**Response:**
```json
{
  "key": "ck_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "keyInfo": {
    "id": "key_123",
    "name": "Production Key",
    "prefix": "ck_live_",
    "createdAt": "2025-01-15T00:00:00Z"
  }
}
```

#### GET /api/user/api-keys/:keyId/usage

Returns usage statistics for an API key.

**Response:**
```json
{
  "requests": [
    {
      "date": "2025-01-15",
      "count": 1200
    }
  ],
  "period": "7d"
}
```

#### PUT /api/user/api-keys/:keyId

Updates an API key.

**Request:**
```json
{
  "rateLimit": 2000,
  "quotaLimit": 200000,
  "expiresAt": "2026-01-15T00:00:00Z",
  "ipWhitelist": ["192.168.1.1", "10.0.0.1"],
  "scopes": ["read", "write", "delete"]
}
```

#### PUT /api/user/api-keys/:keyId/rotate

Rotates an API key (generates new key, invalidates old one).

**Response:**
```json
{
  "newKey": "ck_live_yyyyyyyyyyyyyyyyyyyyyyyyyyyy"
}
```

#### DELETE /api/user/api-keys/:keyId

Deletes an API key.

### Webhooks

#### GET /api/integrations/webhooks

Returns webhooks for the current user/organization.

**Response:**
```json
{
  "webhooks": [
    {
      "id": "webhook_123",
      "name": "My Webhook",
      "url": "https://api.example.com/webhook",
      "eventTypes": ["task.created", "task.updated"],
      "secret": "hmac_secret_hash",
      "isActive": true,
      "createdAt": "2025-01-15T00:00:00Z"
    }
  ]
}
```

#### POST /api/integrations/webhooks

Creates a new webhook.

**Request:**
```json
{
  "name": "My Webhook",
  "url": "https://api.example.com/webhook",
  "eventTypes": ["task.created", "task.updated"],
  "secret": "hmac_secret"
}
```

#### PUT /api/integrations/webhooks/:id

Updates a webhook.

#### DELETE /api/integrations/webhooks/:id

Deletes a webhook.

### Notification Preferences

#### GET /api/settings/notifications

Returns notification preferences for the user.

**Query Parameters:**
- `userId` (required): User ID

**Response:**
```json
{
  "email": {
    "enabled": true,
    "types": {
      "task_assigned": true,
      "project_updated": true
    }
  },
  "push": {
    "enabled": true
  },
  "quietHours": {
    "enabled": false,
    "start": "22:00",
    "end": "08:00"
  }
}
```

#### POST /api/settings/notifications

Saves notification preferences.

**Request:**
```json
{
  "userId": "user_123",
  "preferences": {
    "email": {
      "enabled": true,
      "types": {
        "task_assigned": true
      }
    }
  }
}
```

### AI Preferences

#### GET /api/user/ai-preferences

Returns AI preferences for the user.

**Response:**
```json
{
  "model": "gpt-4",
  "temperature": 0.7,
  "maxTokens": 2000,
  "instructions": "You are a helpful assistant",
  "personality": "professional"
}
```

#### PUT /api/user/ai-preferences

Updates AI preferences.

**Request:**
```json
{
  "model": "gpt-4",
  "temperature": 0.7,
  "maxTokens": 2000,
  "instructions": "Updated instructions"
}
```

### Profile Settings

#### GET /api/profile

Returns user profile information.

**Response:**
```json
{
  "id": "user_123",
  "email": "john@example.com",
  "firstName": "John",
  "lastName": "Smith",
  "avatarUrl": "https://example.com/avatar.jpg",
  "jobTitle": "Product Manager",
  "timezone": "America/New_York",
  "locale": "en"
}
```

#### PUT /api/profile

Updates user profile.

**Request:**
```json
{
  "firstName": "John",
  "lastName": "Smith",
  "jobTitle": "Senior Product Manager",
  "timezone": "America/New_York"
}
```

### Password

#### POST /api/auth/change-password

Changes user password.

**Request:**
```json
{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword"
}
```

## Error Responses

All endpoints may return the following error responses:

### 401 Unauthorized
```json
{
  "error": "Authentication required"
}
```

### 400 Bad Request
```json
{
  "error": "Invalid request parameters"
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
  "error": "Internal server error"
}
```








