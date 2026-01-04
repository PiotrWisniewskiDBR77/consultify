# Admin API Documentation

This document describes all API endpoints available to Admin users (organization administrators).

## Authentication

All Admin API endpoints require authentication via Bearer token:

```
Authorization: Bearer <access_token>
```

## Base URL

All endpoints are prefixed with `/api/`

## Endpoints

### Organization Metrics

#### GET /api/metrics/org/overview

Returns metrics overview for the current user's organization.

**Response:**
```json
{
  "activeUsers": 15,
  "seatConfiguration": {
    "totalSeats": 20,
    "seatsUsed": 15,
    "seatsRemaining": 5,
    "utilizationPercent": 75
  },
  "teamAdoption": {
    "invitesSent": 25,
    "invitesAccepted": 20,
    "acceptanceRate": 80
  },
  "helpUsage": {
    "playbooksStarted": 45,
    "playbooksCompleted": 30,
    "completionRate": 67
  }
}
```

#### GET /api/metrics/org/help

Returns help/playbook metrics for the organization.

**Response:**
```json
{
  "byPlaybook": [
    {
      "playbookKey": "getting_started",
      "started": 20,
      "completed": 15,
      "completionRate": 75
    }
  ]
}
```

#### GET /api/metrics/org/team

Returns team metrics for the organization.

**Response:**
```json
{
  "invitations": {
    "sent": 25,
    "accepted": 20,
    "pending": 3,
    "acceptanceRate": 80
  },
  "seatManagement": {
    "seatsUsed": 15,
    "totalSeats": 20,
    "seatsRemaining": 5
  }
}
```

### Billing

#### GET /api/billing/usage

Returns current usage data for the organization.

**Response:**
```json
{
  "tokens": {
    "used": 75000,
    "limit": 100000
  },
  "storage": {
    "used_gb": 25,
    "limit_gb": 100
  },
  "seats": {
    "used": 15,
    "total": 20
  },
  "spend": {
    "current_period": 299.50,
    "budget": 500.00
  }
}
```

#### GET /api/billing/current

Returns current billing information.

**Response:**
```json
{
  "plan": "professional",
  "status": "active",
  "nextBilling": "2025-02-01",
  "amount": 299.00
}
```

#### GET /api/billing/payment-methods

Returns payment methods for the organization.

**Response:**
```json
{
  "paymentMethods": [
    {
      "id": "pm_123",
      "type": "card",
      "brand": "visa",
      "last4": "4242",
      "expiryMonth": 12,
      "expiryYear": 2025
    }
  ]
}
```

#### POST /api/billing/payment-methods

Adds a new payment method.

**Request:**
```json
{
  "cardNumber": "4242424242424242",
  "expiryMonth": 12,
  "expiryYear": 2025,
  "cvc": "123",
  "cardholderName": "John Smith"
}
```

#### GET /api/billing/invoices

Returns invoices for the organization.

**Response:**
```json
{
  "invoices": [
    {
      "id": "inv_123",
      "amount": 299.00,
      "status": "paid",
      "createdAt": "2025-01-01T00:00:00Z",
      "dueDate": "2025-01-31T00:00:00Z",
      "paidAt": "2025-01-15T00:00:00Z"
    }
  ]
}
```

#### GET /api/billing/spending-alerts

Returns spending alerts configuration.

**Response:**
```json
{
  "alerts": [
    {
      "id": "alert_123",
      "type": "AI_TOKENS",
      "threshold": 80,
      "thresholdType": "PERCENTAGE",
      "action": "NOTIFY",
      "notifyEmails": ["admin@example.com"],
      "isActive": true
    }
  ]
}
```

### Audit Logs

#### GET /api/audit-logs

Returns audit logs for the organization.

**Query Parameters:**
- `organizationId` (required): Organization ID
- `entityType` (optional): Filter by entity type
- `entityId` (optional): Filter by entity ID
- `limit` (optional): Number of results (default: 20)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "events": [
    {
      "id": "log_123",
      "timestamp": "2025-01-15T10:30:00Z",
      "userId": "user_123",
      "userName": "John Smith",
      "userEmail": "john@example.com",
      "action": "Updated project settings",
      "actionType": "UPDATE",
      "resource": "Project",
      "resourceId": "proj_123",
      "resourceName": "Digital Transformation",
      "details": {
        "field": "status",
        "oldValue": "active",
        "newValue": "completed"
      },
      "ipAddress": "192.168.1.100"
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 150
  }
}
```

#### GET /api/audit-logs/export/csv

Exports audit logs as CSV.

**Query Parameters:** Same as GET /api/audit-logs

**Response:** CSV file download

### User Groups

#### GET /api/organizations/:orgId/groups

Returns user groups for the organization.

**Response:**
```json
{
  "groups": [
    {
      "id": "group_123",
      "organizationId": "org_123",
      "name": "Project Managers",
      "description": "All project managers",
      "color": "violet",
      "leaderId": "user_123",
      "memberIds": ["user_123", "user_456"],
      "permissions": [
        {
          "resource": "projects",
          "actions": ["read", "create", "update"],
          "scope": "all"
        }
      ]
    }
  ]
}
```

#### POST /api/organizations/:orgId/groups

Creates a new user group.

**Request:**
```json
{
  "name": "Project Managers",
  "description": "All project managers",
  "color": "violet",
  "leaderId": "user_123",
  "permissions": [...]
}
```

#### PUT /api/organizations/:orgId/groups/:groupId

Updates a user group.

#### DELETE /api/organizations/:orgId/groups/:groupId

Deletes a user group.

### Ownership

#### GET /api/organizations/:orgId/ownership

Returns ownership information for the organization.

**Response:**
```json
{
  "id": "owner_123",
  "organizationId": "org_123",
  "ownerUserId": "user_123",
  "billingEmail": "billing@example.com",
  "billingName": "John Smith",
  "status": "ACTIVE",
  "createdAt": "2025-01-01T00:00:00Z",
  "updatedAt": "2025-01-15T00:00:00Z"
}
```

### AI Analytics

#### GET /api/ai-analytics/deep-reports

Returns deep AI analytics reports.

**Response:**
```json
{
  "successRate": 0.95,
  "avgResponseTime": 1.2,
  "totalTokens": 1200000,
  "estCost": 12.50,
  "usageTrend": [
    {
      "date": "2025-01-15",
      "tokens": 50000,
      "cost": 0.50
    }
  ],
  "topFailureModes": [
    {
      "reason": "Timeout",
      "count": 12
    }
  ]
}
```

#### GET /api/ai-analytics/ideas

Returns AI strategic ideas.

**Response:**
```json
{
  "ideas": [
    {
      "id": "idea_123",
      "title": "Optimize Workflow",
      "description": "AI suggests workflow optimization",
      "priority": "high",
      "status": "new",
      "createdAt": "2025-01-15T00:00:00Z"
    }
  ]
}
```

#### GET /api/ai-analytics/observations

Returns AI system observations.

**Response:**
```json
{
  "observations": [
    {
      "id": "obs_123",
      "category": "insight",
      "content": "System detected pattern",
      "confidence_score": 0.85,
      "created_at": "2025-01-15T00:00:00Z"
    }
  ]
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

### 403 Forbidden
```json
{
  "error": "Access denied"
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

## Rate Limiting

Admin API endpoints are rate-limited to prevent abuse. Rate limit headers are included in responses:

- `X-RateLimit-Limit`: Maximum requests per window
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Time when rate limit resets









