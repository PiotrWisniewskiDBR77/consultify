# Content Module API Documentation

## Overview

The Content Module provides enterprise-level content management for Email Templates and AI Playbook Templates. This API enables organizations to create, manage, version, and analyze their content with comprehensive RBAC support.

**Base Path:** `/api/content`

## Authentication

All endpoints require JWT authentication via the `Authorization` header:

```
Authorization: Bearer <token>
```

## Response Format

All responses follow this format:

```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

Error responses:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message"
  }
}
```

---

## Email Templates

### List Email Templates

```
GET /api/content/emails/templates
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status (DRAFT, PUBLISHED, DEPRECATED) |
| `categoryId` | string | Filter by category |
| `languageCode` | string | Filter by language (e.g., 'en', 'pl') |
| `search` | string | Search in name, subject, content |
| `includeInactive` | boolean | Include inactive templates |
| `sortBy` | string | Sort field (name, createdAt, updatedAt) |
| `sortOrder` | string | Sort direction (asc, desc) |
| `limit` | number | Results per page (default: 50) |
| `offset` | number | Pagination offset |

**Response:**

```json
{
  "templates": [
    {
      "id": "et-uuid",
      "templateKey": "welcome-email",
      "name": "Welcome Email",
      "description": "Sent to new users",
      "subject": "Welcome, {{userName}}!",
      "htmlContent": "<p>Hello {{userName}}...</p>",
      "textContent": "Hello {{userName}}...",
      "availableVariables": ["userName", "loginLink"],
      "variablesSchema": { ... },
      "status": "PUBLISHED",
      "version": 3,
      "languageCode": "en",
      "categoryId": "cat-uuid",
      "createdBy": "user-uuid",
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-01-20T15:30:00Z",
      "publishedAt": "2024-01-18T09:00:00Z"
    }
  ],
  "total": 25,
  "offset": 0,
  "limit": 50
}
```

### Create Email Template

```
POST /api/content/emails/templates
```

**Required Role:** ADMIN, SUPERADMIN

**Request Body:**

```json
{
  "templateKey": "invoice-reminder",
  "name": "Invoice Reminder",
  "description": "Sent when invoice is due",
  "subject": "Invoice #{{invoiceNumber}} is due",
  "htmlContent": "<p>Dear {{customerName}}...</p>",
  "textContent": "Dear {{customerName}}...",
  "availableVariables": ["customerName", "invoiceNumber", "dueDate"],
  "variablesSchema": {
    "type": "object",
    "properties": {
      "customerName": { "type": "string" },
      "invoiceNumber": { "type": "string" },
      "dueDate": { "type": "string", "format": "date" }
    },
    "required": ["customerName", "invoiceNumber"]
  },
  "categoryId": "cat-billing",
  "languageCode": "en"
}
```

### Get Email Template

```
GET /api/content/emails/templates/:id
```

### Update Email Template

```
PUT /api/content/emails/templates/:id
```

**Required Role:** ADMIN, SUPERADMIN

### Delete Email Template

```
DELETE /api/content/emails/templates/:id
```

**Required Role:** SUPERADMIN

### Publish Email Template

```
POST /api/content/emails/templates/:id/publish
```

**Required Role:** ADMIN, SUPERADMIN

Changes template status from DRAFT to PUBLISHED.

### Deprecate Email Template

```
POST /api/content/emails/templates/:id/deprecate
```

**Required Role:** ADMIN, SUPERADMIN

### Clone Email Template

```
POST /api/content/emails/templates/:id/clone
```

**Request Body:**

```json
{
  "templateKey": "welcome-email-v2",
  "name": "Welcome Email V2",
  "description": "Updated version",
  "categoryId": "cat-onboarding",
  "languageCode": "en"
}
```

### Preview Email Template

```
GET /api/content/emails/templates/:id/preview?testData={"userName":"John"}
```

or

```
POST /api/content/emails/templates/:id/preview
```

**Request Body:**

```json
{
  "testData": {
    "userName": "John Doe",
    "loginLink": "https://app.example.com/login"
  }
}
```

**Response:**

```json
{
  "subject": "Welcome, John Doe!",
  "html": "<p>Hello John Doe...</p>",
  "text": "Hello John Doe...",
  "warnings": ["Variable 'unused' was not used"]
}
```

### Send Test Email

```
POST /api/content/emails/templates/:id/test-send
```

**Required Role:** ADMIN, SUPERADMIN

**Request Body:**

```json
{
  "recipientEmails": ["test@example.com"],
  "testData": {
    "userName": "Test User"
  }
}
```

### Get Version History

```
GET /api/content/emails/templates/:id/versions
```

**Response:**

```json
{
  "versions": [
    {
      "version": 3,
      "subject": "Updated subject",
      "htmlContent": "...",
      "modifiedBy": "user-uuid",
      "modifiedAt": "2024-01-20T15:30:00Z",
      "changeNotes": "Updated greeting text"
    }
  ]
}
```

### Restore Version

```
POST /api/content/emails/templates/:id/versions/:version/restore
```

### Get Template Analytics

```
GET /api/content/emails/templates/:id/analytics
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `dateFrom` | string | Start date (ISO 8601) |
| `dateTo` | string | End date (ISO 8601) |
| `eventType` | string | Filter by event type |
| `limit` | number | Max events to return |

---

## Playbook Templates Extensions

### Get Version History

```
GET /api/content/playbooks/templates/:id/versions
```

### Restore Version

```
POST /api/content/playbooks/templates/:id/versions/:version/restore
```

### Clone Playbook Template

```
POST /api/content/playbooks/templates/:id/clone
```

**Request Body:**

```json
{
  "key": "cloned-playbook",
  "title": "Cloned Playbook",
  "description": "A cloned version"
}
```

### Get Analytics

```
GET /api/content/playbooks/templates/:id/analytics
```

### Search Playbook Templates

```
GET /api/content/playbooks/templates/search
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `query` | string | Search term |
| `status` | string | Filter by status |
| `categoryId` | string | Filter by category |
| `triggerSignal` | string | Filter by trigger signal |
| `sortBy` | string | Sort field |
| `sortOrder` | string | Sort direction |
| `limit` | number | Results per page |
| `offset` | number | Pagination offset |

### Bulk Actions

```
POST /api/content/playbooks/templates/bulk-action
```

**Request Body:**

```json
{
  "templateIds": ["pb-1", "pb-2", "pb-3"],
  "action": "PUBLISH",
  "payload": {}
}
```

**Available Actions:**
- `PUBLISH` - Publish templates
- `DEPRECATE` - Deprecate templates
- `CHANGE_CATEGORY` - Change category (requires `payload.categoryId`)
- `DELETE` - Soft delete templates

---

## Categories

### List Categories

```
GET /api/content/categories
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `contentType` | string | Filter by type (PLAYBOOK, EMAIL, ALL) |
| `parentId` | string | Filter by parent (use 'null' for root) |
| `includeInactive` | boolean | Include inactive categories |
| `tree` | boolean | Return as nested tree structure |

### Create Category

```
POST /api/content/categories
```

**Required Role:** ADMIN, SUPERADMIN

**Request Body:**

```json
{
  "name": "Onboarding",
  "slug": "onboarding",
  "description": "User onboarding content",
  "contentType": "ALL",
  "parentId": null,
  "sortOrder": 1,
  "color": "#6366F1",
  "icon": "user-plus"
}
```

### Get Category

```
GET /api/content/categories/:id
```

### Update Category

```
PUT /api/content/categories/:id
```

### Delete Category

```
DELETE /api/content/categories/:id
```

**Required Role:** SUPERADMIN

---

## Tags

### List Tags

```
GET /api/content/tags
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `contentType` | string | Filter by content type |
| `search` | string | Search in tag name |
| `includeInactive` | boolean | Include inactive tags |
| `sortBy` | string | Sort field (name, usage_count) |
| `limit` | number | Max results |

### Create Tag

```
POST /api/content/tags
```

**Required Role:** ADMIN, SUPERADMIN

**Request Body:**

```json
{
  "name": "Important",
  "slug": "important",
  "contentType": "ALL",
  "color": "#EF4444"
}
```

### Get Tag

```
GET /api/content/tags/:id
```

### Update Tag

```
PUT /api/content/tags/:id
```

### Delete Tag

```
DELETE /api/content/tags/:id
```

**Required Role:** SUPERADMIN

---

## Comments

### Get Comments for Content

```
GET /api/content/playbooks/templates/:id/comments
GET /api/content/emails/templates/:id/comments
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `includeResolved` | boolean | Include resolved comments (default: true) |

**Response:**

```json
{
  "comments": [
    {
      "id": "cmt-uuid",
      "commentText": "This looks great!",
      "userId": "user-uuid",
      "user": {
        "id": "user-uuid",
        "firstName": "John",
        "lastName": "Doe",
        "avatar": null
      },
      "isResolved": false,
      "createdAt": "2024-01-15T10:00:00Z",
      "replies": [...]
    }
  ]
}
```

### Create Comment

```
POST /api/content/playbooks/templates/:id/comments
```

**Request Body:**

```json
{
  "commentText": "Please review step 3",
  "parentCommentId": null,
  "positionRef": "step-3",
  "mentionedUserIds": ["user-uuid-1"]
}
```

### Update Comment

```
PUT /api/content/comments/:id
```

### Resolve Comment

```
POST /api/content/comments/:id/resolve
```

### Delete Comment

```
DELETE /api/content/comments/:id
```

---

## Reviews

### Get Pending Reviews

```
GET /api/content/reviews/pending
```

Returns reviews assigned to the current user.

### Create Review Request

```
POST /api/content/playbooks/templates/:id/reviews
```

**Request Body:**

```json
{
  "reviewerId": "user-uuid",
  "priority": "HIGH",
  "dueDate": "2024-02-01",
  "checklistItems": [
    { "id": "1", "text": "Check step descriptions", "checked": false },
    { "id": "2", "text": "Verify trigger conditions", "checked": false }
  ]
}
```

### Get Review

```
GET /api/content/reviews/:id
```

### Update Review

```
PUT /api/content/reviews/:id
```

### Approve Review

```
POST /api/content/reviews/:id/approve
```

**Request Body:**

```json
{
  "reviewNotes": "Approved - looks good!"
}
```

### Reject Review

```
POST /api/content/reviews/:id/reject
```

**Request Body:**

```json
{
  "reviewNotes": "Please fix issues mentioned in comments"
}
```

### Request Changes

```
POST /api/content/reviews/:id/request-changes
```

---

## Favorites

### Get User Favorites

```
GET /api/content/favorites
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `contentType` | string | Filter by content type |
| `folderName` | string | Filter by folder |

### Add to Favorites

```
POST /api/content/favorites
```

**Request Body:**

```json
{
  "contentId": "pb-uuid",
  "contentType": "PLAYBOOK_TEMPLATE",
  "notes": "Great for onboarding",
  "folderName": "Work"
}
```

### Remove from Favorites

```
DELETE /api/content/favorites/:contentType/:contentId
```

### Check if Favorited

```
GET /api/content/favorites/check/:contentType/:contentId
```

---

## Global Search

```
GET /api/content/search
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `query` | string | Search term |
| `contentTypes` | string | Comma-separated types |
| `statuses` | string | Comma-separated statuses |
| `categoryIds` | string | Comma-separated category IDs |
| `tagIds` | string | Comma-separated tag IDs |
| `sortBy` | string | Sort field |
| `sortOrder` | string | Sort direction |
| `page` | number | Page number (default: 1) |
| `limit` | number | Results per page |

**Response:**

```json
{
  "items": [
    {
      "id": "pb-uuid",
      "contentType": "PLAYBOOK_TEMPLATE",
      "key": "onboarding-playbook",
      "title": "User Onboarding",
      "description": "...",
      "status": "PUBLISHED",
      "version": 2,
      "categoryId": "cat-uuid",
      "createdAt": "2024-01-10T00:00:00Z",
      "updatedAt": "2024-01-15T00:00:00Z"
    }
  ],
  "total": 100,
  "page": 1,
  "limit": 20,
  "hasMore": true
}
```

---

## Analytics Dashboard

```
GET /api/content/analytics/dashboard
```

**Required Role:** ADMIN, SUPERADMIN

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `dateFrom` | string | Start date |
| `dateTo` | string | End date |

**Response:**

```json
{
  "totalPlaybookTemplates": 25,
  "totalEmailTemplates": 15,
  "totalCategories": 8,
  "totalTags": 20,
  "publishedPlaybooks": 18,
  "publishedEmails": 12,
  "totalPlaybookRuns": 1500,
  "totalEmailsSent": 5000,
  "avgPlaybookSuccessRate": 85,
  "avgEmailOpenRate": 45,
  "avgEmailClickRate": 12,
  "topPlaybooks": [...],
  "topEmails": [...],
  "recentActivity": [...],
  "usageByCategory": [...],
  "usageOverTime": [...]
}
```

---

## Bulk Actions

```
POST /api/content/bulk-action
```

**Required Role:** ADMIN, SUPERADMIN

**Request Body:**

```json
{
  "action": "PUBLISH",
  "contentIds": ["id-1", "id-2"],
  "contentType": "EMAIL_TEMPLATE",
  "payload": {}
}
```

**Available Actions:**
- `PUBLISH` - Publish content
- `DEPRECATE` - Deprecate content
- `DELETE` - Delete content
- `ADD_TAG` - Add tag (requires `payload.tagId`)
- `REMOVE_TAG` - Remove tag (requires `payload.tagId`)

**Response:**

```json
{
  "success": true,
  "processed": 2,
  "failed": 0,
  "errors": []
}
```

---

## Error Codes

| Code | Description |
|------|-------------|
| `NOT_FOUND` | Resource not found |
| `VALIDATION_ERROR` | Invalid request data |
| `UNAUTHORIZED` | Authentication required |
| `FORBIDDEN` | Insufficient permissions |
| `CONFLICT` | Resource conflict (e.g., duplicate key) |
| `INTERNAL_ERROR` | Server error |

---

## Permissions

| Permission Key | Description |
|----------------|-------------|
| `EMAIL_TEMPLATE_VIEW` | View email templates |
| `EMAIL_TEMPLATE_CREATE` | Create email templates |
| `EMAIL_TEMPLATE_EDIT` | Edit email templates |
| `EMAIL_TEMPLATE_DELETE` | Delete email templates |
| `EMAIL_TEMPLATE_PUBLISH` | Publish email templates |
| `PLAYBOOK_TEMPLATE_VIEW` | View playbook templates |
| `PLAYBOOK_TEMPLATE_CREATE` | Create playbook templates |
| `PLAYBOOK_TEMPLATE_EDIT` | Edit playbook templates |
| `CONTENT_COMMENT_CREATE` | Create comments |
| `CONTENT_REVIEW_APPROVE` | Approve reviews |
| `CONTENT_BULK_ACTIONS` | Perform bulk actions |

See full permissions list in `server/migrations/048_content_module_permissions.sql`.









