# Configuration Module API Reference

## Base URL

```
/api
```

## Authentication

All endpoints require authentication via JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

---

## Security Policies

### Get Security Policy Defaults

```http
GET /security-policies/defaults
```

**Required Role:** SuperAdmin

**Response:**

```json
{
  "policy": {
    "passwordMinLength": 12,
    "passwordRequireUppercase": true,
    "passwordRequireLowercase": true,
    "passwordRequireNumbers": true,
    "passwordRequireSpecial": true,
    "passwordExpiryDays": 90,
    "passwordHistoryCount": 5,
    "maxLoginAttempts": 5,
    "lockoutDurationMinutes": 30,
    "sessionTimeoutMinutes": 60,
    "concurrentSessionsLimit": 3,
    "requireSessionBinding": false,
    "mfaRequired": false,
    "mfaMethods": ["totp"],
    "mfaRememberDeviceDays": 30
  }
}
```

### Update Security Policy Defaults

```http
PUT /security-policies/defaults
```

**Required Role:** SuperAdmin

**Request Body:**

```json
{
  "passwordMinLength": 14,
  "mfaRequired": true
}
```

### Get Organization Security Policy

```http
GET /security-policies/:orgId
```

**Required Role:** Admin (own org) or SuperAdmin

### Update Organization Security Policy

```http
PUT /security-policies/:orgId
```

**Required Role:** Admin (own org) or SuperAdmin

**Request Body:**

```json
{
  "passwordMinLength": 14,
  "passwordRequireSpecial": true,
  "sessionTimeoutMinutes": 30,
  "mfaRequired": true,
  "ipAllowlist": ["192.168.1.0/24"],
  "ipBlocklist": ["10.0.0.1"]
}
```

### Get Compliance Presets

```http
GET /security-policies/presets
```

**Response:**

```json
{
  "presets": [
    {
      "id": "none",
      "name": "Standard",
      "description": "Basic security settings"
    },
    {
      "id": "soc2",
      "name": "SOC 2",
      "description": "SOC 2 Type II compliance",
      "settings": {
        "passwordMinLength": 14,
        "mfaRequired": true,
        "sessionTimeoutMinutes": 30
      }
    },
    {
      "id": "hipaa",
      "name": "HIPAA",
      "description": "Healthcare compliance"
    },
    {
      "id": "gdpr",
      "name": "GDPR",
      "description": "EU data protection compliance"
    }
  ]
}
```

### Apply Compliance Preset

```http
POST /security-policies/:orgId/preset
```

**Required Role:** SuperAdmin

**Request Body:**

```json
{
  "preset": "soc2"
}
```

### Validate Password

```http
POST /security-policies/validate-password
```

**Request Body:**

```json
{
  "password": "MySecureP@ssw0rd",
  "organizationId": "org-123"
}
```

**Response:**

```json
{
  "valid": true,
  "errors": []
}
```

or

```json
{
  "valid": false,
  "errors": [
    "Password must contain at least one special character",
    "Password was used recently"
  ]
}
```

---

## Session Management

### Get All Active Sessions

```http
GET /security-policies/sessions/all
```

**Required Role:** SuperAdmin

**Response:**

```json
{
  "sessions": [
    {
      "id": "session-123",
      "user_id": "user-456",
      "organization_id": "org-789",
      "user_email": "user@example.com",
      "user_first_name": "John",
      "user_last_name": "Doe",
      "organization_name": "Acme Corp",
      "device_type": "desktop",
      "browser": "Chrome",
      "os": "Windows",
      "ip_address": "192.168.1.1",
      "location": "New York, US",
      "created_at": "2025-01-01T10:00:00Z",
      "last_activity": "2025-01-01T12:00:00Z",
      "is_active": true
    }
  ]
}
```

### Get Organization Sessions

```http
GET /security-policies/:orgId/sessions
```

### Terminate Session

```http
POST /security-policies/sessions/:sessionId/terminate
```

**Request Body:**

```json
{
  "reason": "admin_action"
}
```

### Terminate All User Sessions

```http
POST /security-policies/:orgId/sessions/terminate-all
```

**Request Body:**

```json
{
  "userId": "user-123",
  "reason": "security_concern"
}
```

---

## Login Attempts

### Get Login Attempts

```http
GET /security-policies/:orgId/login-attempts
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| limit | number | Max results (default: 100) |
| status | string | Filter: "success" or "failed" |
| startDate | string | ISO date filter |
| endDate | string | ISO date filter |

**Response:**

```json
{
  "attempts": [
    {
      "id": "attempt-123",
      "user_email": "user@example.com",
      "success": 1,
      "auth_method": "password",
      "ip_address": "192.168.1.1",
      "location": "New York, US",
      "created_at": "2025-01-01T10:00:00Z"
    }
  ]
}
```

### Get Security Statistics

```http
GET /security-policies/stats
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| days | number | Time range (default: 7) |

**Response:**

```json
{
  "activeSessions": 25,
  "loginAttempts": {
    "total": 100,
    "successful": 95,
    "failed": 5,
    "successRate": 95
  },
  "activeLockouts": 2,
  "customPolicies": 5
}
```

### Get Active Lockouts

```http
GET /security-policies/lockouts/all
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| active | boolean | Filter active only |

### Unlock Account

```http
POST /security-policies/unlock-account
```

**Required Role:** SuperAdmin

**Request Body:**

```json
{
  "email": "locked@example.com"
}
```

---

## IP Access Rules

### Get IP Rules

```http
GET /security-policies/:orgId/ip-rules
```

**Response:**

```json
{
  "rules": [
    {
      "id": "rule-123",
      "organization_id": "org-456",
      "ip_address": "192.168.1.0/24",
      "rule_type": "allow",
      "description": "Office network",
      "is_active": 1,
      "expires_at": null,
      "created_at": "2025-01-01T10:00:00Z"
    }
  ]
}
```

### Create IP Rule

```http
POST /security-policies/:orgId/ip-rules
```

**Request Body:**

```json
{
  "ipAddress": "192.168.1.0/24",
  "ruleType": "allow",
  "description": "Office network",
  "expiresAt": "2025-12-31T23:59:59Z"
}
```

### Update IP Rule

```http
PUT /security-policies/:orgId/ip-rules/:ruleId
```

**Request Body:**

```json
{
  "isActive": false
}
```

### Delete IP Rule

```http
DELETE /security-policies/:orgId/ip-rules/:ruleId
```

---

## Billing

### Get Billing Overview

```http
GET /billing/overview
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| organizationId | string | Filter by org |

**Response:**

```json
{
  "currentPlan": {
    "name": "Pro",
    "price": 9900,
    "billingCycle": "monthly"
  },
  "usage": {
    "users": 15,
    "usersLimit": 25,
    "storage": 5120,
    "storageLimit": 10240
  },
  "spending": {
    "currentMonth": 9900,
    "previousMonth": 9900
  }
}
```

### Get Invoices

```http
GET /billing/invoices
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | draft, open, paid, void |
| organizationId | string | Filter by org |
| limit | number | Max results |

**Response:**

```json
{
  "invoices": [
    {
      "id": "inv-123",
      "organization_id": "org-456",
      "organization_name": "Acme Corp",
      "invoice_number": "INV-2025-001",
      "status": "paid",
      "currency": "USD",
      "subtotal": 10000,
      "tax_amount": 1000,
      "total": 11000,
      "amount_paid": 11000,
      "amount_due": 0,
      "due_date": "2025-01-15",
      "line_items": [
        {
          "description": "Pro Plan",
          "quantity": 1,
          "unitPrice": 10000,
          "amount": 10000
        }
      ],
      "pdf_url": "https://...",
      "created_at": "2025-01-01T10:00:00Z"
    }
  ]
}
```

### Send Invoice

```http
POST /billing/invoices/:invoiceId/send
```

### Update Invoice Status

```http
PUT /billing/invoices/:invoiceId
```

**Request Body:**

```json
{
  "status": "paid"
}
```

### Get Subscriptions

```http
GET /billing/subscriptions
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | active, trialing, canceled, etc. |

### Create Subscription

```http
POST /billing/subscriptions
```

**Request Body:**

```json
{
  "organizationId": "org-123",
  "planId": "plan-456",
  "billingCycle": "monthly",
  "trialDays": 14
}
```

### Update Subscription

```http
PUT /billing/subscriptions/:subscriptionId
```

**Request Body:**

```json
{
  "planId": "plan-789"
}
```

### Cancel Subscription

```http
POST /billing/subscriptions/:subscriptionId/cancel
```

**Request Body:**

```json
{
  "immediately": false
}
```

### Get Plans

```http
GET /billing/plans
```

### Get Credit Notes

```http
GET /billing/credit-notes
```

### Create Credit Note

```http
POST /billing/credit-notes
```

**Request Body:**

```json
{
  "organizationId": "org-123",
  "amount": 2500,
  "reason": "Service credit"
}
```

---

## Feature Flags

### Get Feature Flags

```http
GET /feature-flags
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| environment | string | development, staging, production |

### Evaluate Flag (Client)

```http
POST /feature-flags/evaluate
```

**Request Body:**

```json
{
  "flagKey": "new-dashboard",
  "userId": "user-123",
  "organizationId": "org-456"
}
```

**Response:**

```json
{
  "enabled": true,
  "variant": "A"
}
```

### Create Feature Flag

```http
POST /feature-flags
```

**Required Role:** SuperAdmin

**Request Body:**

```json
{
  "key": "new-feature",
  "name": "New Feature",
  "description": "Enable new feature",
  "type": "boolean",
  "defaultValue": false,
  "environments": {
    "development": true,
    "staging": true,
    "production": false
  }
}
```

### Update Feature Flag

```http
PUT /feature-flags/:flagId
```

### Toggle Feature Flag

```http
POST /feature-flags/:flagId/toggle
```

**Request Body:**

```json
{
  "environment": "production",
  "enabled": true
}
```

### Get Flag History

```http
GET /feature-flags/:flagId/history
```

---

## Webhooks

### Get Webhooks

```http
GET /settings/webhooks
```

### Create Webhook

```http
POST /settings/webhooks
```

**Request Body:**

```json
{
  "url": "https://api.example.com/webhook",
  "events": ["user.created", "project.updated", "task.completed"],
  "secret": "generated_secret",
  "enabled": true
}
```

### Update Webhook

```http
PUT /settings/webhooks/:webhookId
```

### Delete Webhook

```http
DELETE /settings/webhooks/:webhookId
```

### Test Webhook

```http
POST /settings/webhooks/:webhookId/test
```

### Get Webhook Deliveries

```http
GET /settings/webhooks/:webhookId/deliveries
```

**Response:**

```json
{
  "deliveries": [
    {
      "id": "delivery-123",
      "webhook_id": "webhook-456",
      "event_type": "user.created",
      "payload": "{...}",
      "response_status": 200,
      "response_body": "{...}",
      "duration_ms": 150,
      "success": 1,
      "delivered_at": "2025-01-01T10:00:00Z"
    }
  ]
}
```

### Retry Delivery

```http
POST /settings/webhooks/deliveries/:deliveryId/retry
```

---

## Data Export

### Get Export Requests

```http
GET /data-export/requests
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| organizationId | string | Filter by org |
| status | string | pending, processing, completed, failed |

### Create Export Request

```http
POST /data-export/requests
```

**Request Body:**

```json
{
  "exportType": "full",
  "includeData": ["users", "projects", "tasks", "documents"],
  "excludeData": []
}
```

### Cancel Export Request

```http
DELETE /data-export/requests/:requestId
```

### Get Backup Configuration

```http
GET /data-export/backup-config
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| organizationId | string | Required |

### Update Backup Configuration

```http
PUT /data-export/backup-config
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| organizationId | string | Required |

**Request Body:**

```json
{
  "enabled": true,
  "frequency": "daily",
  "retentionDays": 30,
  "includeAttachments": true,
  "includeAuditLogs": true
}
```

### Trigger Manual Backup

```http
POST /data-export/backup-config/trigger
```

**Request Body:**

```json
{
  "organizationId": "org-123"
}
```

### Get Backup History

```http
GET /data-export/backup-history
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| organizationId | string | Required |

---

## Email Configuration

### Get Email Configuration

```http
GET /settings/email-config
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| organizationId | string | Required |

### Update Email Configuration

```http
PUT /settings/email-config
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| organizationId | string | Required |

**Request Body:**

```json
{
  "provider": "smtp",
  "smtp_host": "smtp.example.com",
  "smtp_port": 587,
  "smtp_username": "user@example.com",
  "smtp_password_encrypted": "encrypted_password",
  "smtp_use_tls": true,
  "from_email": "noreply@example.com",
  "from_name": "Consultify",
  "reply_to_email": "support@example.com"
}
```

### Send Test Email

```http
POST /settings/email-config/test
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| organizationId | string | Required |

**Request Body:**

```json
{
  "email": "test@example.com"
}
```

### Verify DNS Records

```http
POST /settings/email-config/verify-dns
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| organizationId | string | Required |

**Response:**

```json
{
  "spf": true,
  "dkim": true,
  "dmarc": false
}
```

---

## Error Responses

All endpoints return errors in the following format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| UNAUTHORIZED | 401 | Invalid or missing token |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| VALIDATION_ERROR | 400 | Invalid request data |
| RATE_LIMITED | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Server error |

---

## Rate Limiting

API requests are rate-limited:

- **Standard endpoints:** 100 requests/minute
- **Bulk operations:** 10 requests/minute
- **Export requests:** 5 requests/hour

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704067200
```

---

## Webhook Events

Events that can trigger webhooks:

| Event | Description |
|-------|-------------|
| `user.created` | New user registered |
| `user.updated` | User profile updated |
| `user.deleted` | User account deleted |
| `project.created` | New project created |
| `project.updated` | Project settings changed |
| `project.deleted` | Project deleted |
| `task.created` | New task created |
| `task.updated` | Task modified |
| `task.completed` | Task marked complete |
| `task.deleted` | Task deleted |
| `subscription.created` | New subscription |
| `subscription.updated` | Subscription changed |
| `subscription.canceled` | Subscription canceled |
| `invoice.created` | Invoice generated |
| `invoice.paid` | Invoice payment received |
| `export.completed` | Data export ready |
| `backup.completed` | Backup finished |

---

## SDK Examples

### JavaScript/TypeScript

```typescript
import { Api } from '@consultify/api';

// Security policy
const policy = await Api.get('/security-policies/org-123');
await Api.put('/security-policies/org-123', { mfaRequired: true });

// Webhooks
const webhooks = await Api.get('/settings/webhooks');
await Api.post('/settings/webhooks', {
  url: 'https://example.com/hook',
  events: ['user.created']
});

// Data export
const { requests } = await Api.get('/data-export/requests');
await Api.post('/data-export/requests', {
  exportType: 'full',
  includeData: ['users', 'projects']
});
```

### Python

```python
import requests

headers = {'Authorization': f'Bearer {token}'}

# Security policy
policy = requests.get(
    f'{BASE_URL}/security-policies/org-123',
    headers=headers
).json()

# Create webhook
requests.post(
    f'{BASE_URL}/settings/webhooks',
    headers=headers,
    json={
        'url': 'https://example.com/hook',
        'events': ['user.created']
    }
)
```

---

## Changelog

### v2.0.0 (2025-01-02)

- Added Security Policies API
- Added Session Management API
- Added Login Attempts tracking
- Added IP Access Rules
- Added Billing Management APIs
- Added Feature Flags system
- Added Webhooks with delivery logs
- Added Data Export functionality
- Added Backup Configuration
- Added Email Configuration with DNS verification






