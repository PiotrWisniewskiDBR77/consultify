# Consultify API Reference

## Overview

This document provides a reference for the Consultify API endpoints.

**Base URL:** `/api`

**Authentication:** All endpoints require JWT token in `Authorization: Bearer <token>` header unless marked as public.

---

## Common Response Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 204 | No Content |
| 400 | Bad Request - Validation error |
| 401 | Unauthorized - Invalid/missing token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found |
| 409 | Conflict - Duplicate or concurrent modification |
| 429 | Too Many Requests - Rate limited |
| 451 | Legal Block - Requires acceptance of terms |
| 500 | Internal Server Error |

---

## Endpoints by Module

### Authentication (`/api/auth`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/register` | Register new user | Public |
| POST | `/login` | Login with email/password | Public |
| POST | `/logout` | Logout current session | Required |
| GET | `/me` | Get current user profile | Required |
| POST | `/refresh` | Refresh JWT token | Required |

### Organizations (`/api/organizations`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/` | List user's organizations | Any |
| POST | `/` | Create organization | Any |
| GET | `/:orgId` | Get organization details | Member |
| PUT | `/:orgId` | Update organization | Admin |
| DELETE | `/:orgId` | Delete organization | Owner |

### AI Actions (`/api/ai/actions`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/proposals` | List pending AI proposals | Admin |
| GET | `/proposals/:id` | Get proposal details | Admin |
| POST | `/decide` | Record decision on proposal | Admin |
| POST | `/decisions/:id/execute` | Execute approved decision | Admin |
| POST | `/decisions/:id/dry-run` | Dry-run execution | Admin |
| GET | `/audit` | List action audit trail | Admin |
| GET | `/audit/export` | Export audit (CSV/JSON) | Admin |

### AI Policy (`/api/ai/policy`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/rules` | List policy rules | Admin |
| POST | `/rules` | Create policy rule | Admin |
| PUT | `/rules/:id/toggle` | Enable/disable rule | Admin |
| GET | `/global-status` | Get global engine status | SuperAdmin |
| PUT | `/global-status` | Toggle global engine | SuperAdmin |

### AI Playbooks (`/api/ai/playbooks`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/templates` | List playbook templates | Admin |
| GET | `/templates/:id` | Get template details | Admin |
| POST | `/templates` | Create draft template | Admin |
| PUT | `/templates/:id` | Update draft template | Admin |
| POST | `/templates/:id/publish` | Publish template | Admin |
| POST | `/templates/:id/export` | Export template JSON | Admin |
| POST | `/templates/import` | Import template | Admin |
| GET | `/runs` | List playbook runs | Admin |
| POST | `/runs` | Initiate playbook run | Admin |
| POST | `/runs/:id/advance` | Advance run step | Admin |
| POST | `/runs/:id/cancel` | Cancel run | Admin |

### Governance (`/api/governance`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/audit` | Query audit log | Admin |
| GET | `/audit/export` | Export audit log | Admin |
| POST | `/audit/verify-chain` | Verify hash chain | SuperAdmin |
| GET | `/permissions` | List permissions | Admin |
| PUT | `/permissions/:userId` | Update user permissions | Admin |
| POST | `/break-glass/start` | Start break-glass session | SuperAdmin |
| POST | `/break-glass/close` | Close break-glass session | SuperAdmin |

### Connectors (`/api/connectors`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/catalog` | List available connectors | Admin |
| GET | `/configs` | List org's connected integrations | Admin |
| POST | `/:key/connect` | Connect integration | Admin |
| POST | `/:key/disconnect` | Disconnect integration | Admin |
| POST | `/:key/test` | Test connection health | Admin |
| PUT | `/:key/rotate` | Rotate secrets | Admin |

### Analytics (`/api/ai/analytics`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/dashboard` | Get dashboard summary | Admin |
| GET | `/actions` | Action statistics | Admin |
| GET | `/approvals` | Approval breakdown | Admin |
| GET | `/playbooks` | Playbook statistics | Admin |
| GET | `/dead-letter` | Dead-letter stats | Admin |
| GET | `/roi` | ROI summary | Admin |
| GET | `/export` | Export analytics data | Admin |

### Workqueue (`/api/workqueue`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/my-approvals` | Get my pending approvals | Any |
| POST | `/assign` | Assign approval | Admin |
| POST | `/:id/ack` | Acknowledge assignment | Assignee |
| POST | `/:id/complete` | Complete assignment | Assignee |

---

## Request/Response Schemas

### Common Fields

All entities include:
- `id` (string): UUID
- `created_at` (string): ISO 8601 timestamp
- `updated_at` (string): ISO 8601 timestamp

### AI Proposal

```json
{
  "id": "uuid",
  "organization_id": "uuid",
  "action_type": "TASK_CREATE | PLAYBOOK_ASSIGN | MEETING_SCHEDULE | ...",
  "scope": "ORG | PROJECT | USER",
  "risk_level": "LOW | MEDIUM | HIGH",
  "title": "string",
  "description": "string",
  "payload": { },
  "status": "PENDING | APPROVED | REJECTED | EXECUTED"
}
```

### AI Decision

```json
{
  "id": "uuid",
  "proposal_id": "uuid",
  "decision": "APPROVED | REJECTED | MODIFIED",
  "decision_reason": "string",
  "proposal_snapshot": { },
  "decided_by": "uuid",
  "auto_approved": false,
  "policy_rule_id": "uuid | null"
}
```

---

## Error Response Format

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": []
}
```

---

## Rate Limits

| Endpoint Category | Limit |
|-------------------|-------|
| Authentication | 10/15min |
| Admin operations | 30/min |
| Break-glass | 5/hour |
| Export | 10/5min |
| General API | 200/min |

---

*Generated: 2025-12-21*
*Version: 1.0.0*
