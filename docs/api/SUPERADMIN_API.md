# SuperAdmin API Documentation

This document describes all API endpoints available to SuperAdmin users (platform administrators).

## Authentication

All SuperAdmin API endpoints require authentication via Bearer token and SuperAdmin role verification:

```
Authorization: Bearer <access_token>
```

SuperAdmin endpoints automatically verify the user has SuperAdmin role.

## Base URL

All endpoints are prefixed with `/api/superadmin/` or `/api/metrics/` (for metrics endpoints)

## Endpoints

### Overview & Metrics

#### GET /api/metrics/overview

Returns global metrics overview for SuperAdmin dashboard.

**Response:**
```json
{
  "totalUsers": 1500,
  "activeOrganizations": 250,
  "pendingInvites": 45,
  "estimatedRevenue": 125000.00,
  "systemHealth": {
    "status": "healthy",
    "uptime": 99.9
  }
}
```

#### GET /api/metrics/funnels

Returns conversion funnels.

**Query Parameters:**
- `days` (optional): Number of days to analyze (default: 30)

**Response:**
```json
{
  "period": "30 days",
  "funnels": {
    "demoToTrial": {
      "name": "Demo → Trial",
      "entered": 500,
      "converted": 300,
      "conversionRate": 60
    },
    "trialToPaid": {
      "name": "Trial → Paid",
      "entered": 300,
      "converted": 150,
      "conversionRate": 50
    }
  }
}
```

### Organizations

#### GET /api/superadmin/organizations

Returns all organizations.

**Query Parameters:**
- `status` (optional): Filter by status
- `plan` (optional): Filter by plan
- `limit` (optional): Number of results
- `offset` (optional): Pagination offset

**Response:**
```json
{
  "organizations": [
    {
      "id": "org_123",
      "name": "Acme Corporation",
      "plan": "professional",
      "status": "active",
      "createdAt": "2025-01-01T00:00:00Z",
      "userCount": 15,
      "projectCount": 5
    }
  ],
  "total": 250
}
```

#### PUT /api/superadmin/organizations/:id

Updates an organization.

**Request:**
```json
{
  "name": "Updated Name",
  "plan": "enterprise",
  "status": "active"
}
```

#### DELETE /api/superadmin/organizations/:id

Deletes an organization.

### Users

#### GET /api/superadmin/users

Returns all users across all organizations.

**Query Parameters:**
- `organizationId` (optional): Filter by organization
- `role` (optional): Filter by role
- `status` (optional): Filter by status
- `limit` (optional): Number of results
- `offset` (optional): Pagination offset

**Response:**
```json
{
  "users": [
    {
      "id": "user_123",
      "email": "john@example.com",
      "firstName": "John",
      "lastName": "Smith",
      "role": "ADMIN",
      "organizationId": "org_123",
      "organizationName": "Acme Corporation",
      "status": "active",
      "lastLogin": "2025-01-15T10:30:00Z"
    }
  ],
  "total": 1500
}
```

### AI Intelligence

#### GET /api/ai/learning/patterns

Returns AI learning patterns.

**Response:**
```json
{
  "patterns": [
    {
      "id": "pattern_123",
      "name": "User Preference Pattern",
      "frequency": 45,
      "confidence": 0.85
    }
  ]
}
```

#### GET /api/ai/learning/interactions

Returns recent AI interactions.

**Query Parameters:**
- `limit` (optional): Number of results (default: 10)
- `range` (optional): Time range (7d, 30d, 90d)

**Response:**
```json
{
  "interactions": [
    {
      "id": "interaction_123",
      "userId": "user_123",
      "prompt": "Help with project",
      "response": "AI response",
      "qualityScore": 0.87,
      "timestamp": "2025-01-15T10:30:00Z"
    }
  ]
}
```

#### GET /api/ai/learning/metrics

Returns AI learning metrics.

**Query Parameters:**
- `range` (optional): Time range (7d, 30d, 90d)

**Response:**
```json
{
  "metrics": {
    "totalInteractions": 1250,
    "successRate": 94.5,
    "avgQualityScore": 0.87,
    "avgResponseTime": 1.2,
    "patternsLearned": 12,
    "activeModels": 7
  },
  "qualityTrends": [
    {
      "date": "2025-01-15",
      "score": 0.85
    }
  ]
}
```

### Revenue

#### GET /api/superadmin/revenue/billing-center

Returns billing center data.

**Response:**
```json
{
  "mrr": 125000.00,
  "arr": 1500000.00,
  "activeSubscriptions": 250,
  "churnRate": 2.5
}
```

#### GET /api/superadmin/revenue/invoices

Returns all invoices.

**Query Parameters:**
- `status` (optional): Filter by status
- `fromDate` (optional): Start date
- `toDate` (optional): End date

**Response:**
```json
{
  "invoices": [
    {
      "id": "inv_123",
      "organizationId": "org_123",
      "organizationName": "Acme Corporation",
      "amount": 299.00,
      "status": "paid",
      "createdAt": "2025-01-01T00:00:00Z",
      "paidAt": "2025-01-15T00:00:00Z"
    }
  ]
}
```

### Security

#### GET /api/superadmin/security/audit-logs

Returns admin audit logs.

**Query Parameters:**
- `adminId` (optional): Filter by admin ID
- `actionType` (optional): Filter by action type
- `riskScoreMin` (optional): Minimum risk score
- `status` (optional): Filter by status
- `limit` (optional): Number of results

**Response:**
```json
{
  "logs": [
    {
      "id": "log_123",
      "adminId": "admin_123",
      "adminEmail": "admin@example.com",
      "actionType": "ORGANIZATION_DELETE",
      "resourceType": "Organization",
      "resourceId": "org_123",
      "riskScore": 8.5,
      "status": "pending",
      "timestamp": "2025-01-15T10:30:00Z"
    }
  ]
}
```

#### POST /api/superadmin/security/audit-logs/:logId/resolve

Resolves an audit log entry.

**Request:**
```json
{
  "resolutionNotes": "Reviewed and approved"
}
```

### System

#### GET /api/superadmin/system/health

Returns system health status.

**Response:**
```json
{
  "status": "healthy",
  "uptime": 99.9,
  "database": "connected",
  "aiSystem": {
    "status": "operational",
    "latency": 120
  }
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
  "error": "SuperAdmin access required"
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









