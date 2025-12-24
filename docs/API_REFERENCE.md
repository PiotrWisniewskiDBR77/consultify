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

### Projects (`/api/projects`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/` | List user's projects | Any |
| POST | `/` | Create new project | Any |
| GET | `/:projectId` | Get project details | Member |
| PUT | `/:projectId` | Update project | Admin |
| DELETE | `/:projectId` | Delete project | Admin |

### Assessment (`/api/assessment`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/:projectId` | Get assessment for project | Member |
| PUT | `/:projectId` | Save/update assessment | Admin |
| POST | `/:projectId/gap-analysis` | Generate gap analysis | Member |

### Initiatives (`/api/initiatives`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/` | List all initiatives | Member |
| POST | `/` | Create new initiative | Admin |
| GET | `/:id` | Get initiative details | Member |
| PUT | `/:id` | Update initiative | Admin |
| DELETE | `/:id` | Delete initiative | Admin |
| POST | `/:id/generate` | AI-generate initiative details | Admin |

### Tasks (`/api/tasks`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/` | List tasks (with filters) | Member |
| POST | `/` | Create new task | Member |
| GET | `/:id` | Get task details | Member |
| PUT | `/:id` | Update task | Member |
| DELETE | `/:id` | Delete task | Admin |
| POST | `/:id/complete` | Mark task as complete | Assignee |
| POST | `/:id/assign` | Assign task to user | Admin |

### Roadmap (`/api/roadmap`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/:projectId` | Get roadmap for project | Member |
| PUT | `/:projectId` | Update roadmap | Admin |
| POST | `/:projectId/optimize` | AI-optimize roadmap | Admin |

### Execution (`/api/execution`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/:projectId` | Get execution status | Member |
| GET | `/:projectId/initiatives` | Get execution initiatives | Member |
| PUT | `/:projectId/initiatives/:id` | Update initiative execution | Admin |

### PMO (`/api/pmo`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/health/:projectId` | Get PMO health snapshot | Member |

### PMO Domains (`/api/pmo-domains`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/` | List all PMO domains | Member |
| GET | `/standards-mapping` | Get standards mapping table | Member |

### PMO Context (`/api/pmo-context`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/:projectId` | Get PMO context for project | Member |
| PUT | `/:projectId` | Update PMO context | Admin |

### PMO Analysis (`/api/pmo-analysis`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/:projectId` | Get PMO analysis | Member |
| POST | `/:projectId/analyze` | Run PMO analysis | Admin |

### Decisions (`/api/decisions`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/` | List decisions | Member |
| POST | `/` | Create decision | Admin |
| GET | `/:id` | Get decision details | Member |
| PUT | `/:id` | Update decision | Admin |
| POST | `/:id/resolve` | Resolve decision | Admin |

### Stage Gates (`/api/stage-gates`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/:projectId` | Get stage gates for project | Member |
| POST | `/:projectId` | Create stage gate | Admin |
| PUT | `/:id` | Update stage gate | Admin |
| POST | `/:id/review` | Review stage gate | Admin |

### Context (`/api/context`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/:projectId` | Get project context | Member |
| PUT | `/:projectId` | Update project context | Admin |

### Reports (`/api/reports`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/` | List reports | Member |
| POST | `/` | Generate new report | Admin |
| GET | `/:id` | Get report details | Member |
| GET | `/:id/export` | Export report (PDF/Excel) | Member |

### Economics (`/api/economics`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/:projectId` | Get economics data | Member |
| PUT | `/:projectId` | Update economics | Admin |
| POST | `/:projectId/calculate-roi` | Calculate ROI | Member |

### Stabilization (`/api/stabilization`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/:projectId` | Get stabilization status | Member |
| POST | `/:projectId/assess` | Assess stabilization | Admin |

### Teams (`/api/teams`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/` | List teams | Member |
| POST | `/` | Create team | Admin |
| GET | `/:id` | Get team details | Member |
| PUT | `/:id` | Update team | Admin |
| DELETE | `/:id` | Delete team | Admin |
| POST | `/:id/members` | Add team member | Admin |
| DELETE | `/:id/members/:userId` | Remove team member | Admin |

### Users (`/api/users`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/` | List users | Admin |
| GET | `/:id` | Get user details | Member |
| PUT | `/:id` | Update user | Admin |
| DELETE | `/:id` | Delete user | Admin |
| PUT | `/:id/role` | Update user role | Admin |

### Sessions (`/api/sessions`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/` | List user sessions | Member |
| GET | `/:type` | Get session by type | Member |
| PUT | `/:type` | Update session | Member |
| DELETE | `/:type` | Clear session | Member |

### AI (`/api/ai`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| POST | `/chat` | Send chat message | Member |
| POST | `/stream` | Stream AI response | Member |
| GET | `/history` | Get chat history | Member |

### AI Coach (`/api/ai/coach`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| POST | `/advice` | Get coaching advice | Member |
| GET | `/insights` | Get insights | Member |

### AI Explain (`/api/ai/explain`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| POST | `/` | Explain concept/decision | Member |

### AI Async (`/api/ai-async`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| POST | `/` | Submit async AI job | Member |
| GET | `/:jobId` | Get job status | Member |
| GET | `/:jobId/result` | Get job result | Member |

### Analytics (`/api/analytics`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/dashboard` | Get analytics dashboard | Admin |
| GET | `/metrics` | Get metrics | Admin |

### Advanced Analytics (`/api/analytics/advanced`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/` | Get advanced analytics | Admin |
| GET | `/funnels` | Get funnel metrics | Admin |

### Journey Analytics (`/api/analytics/journey`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/` | Get journey analytics | Admin |
| POST | `/track` | Track journey event | System |

### AI Analytics (`/api/analytics/ai`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/usage` | Get AI usage stats | Admin |
| GET | `/performance` | Get AI performance | Admin |

### Billing (`/api/billing`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/invoices` | List invoices | Admin |
| GET | `/invoices/:id` | Get invoice details | Admin |
| GET | `/subscription` | Get subscription details | Admin |
| POST | `/subscription/upgrade` | Upgrade subscription | Admin |
| POST | `/subscription/cancel` | Cancel subscription | Admin |

### Token Billing (`/api/token-billing`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/usage` | Get token usage | Member |
| GET | `/limits` | Get token limits | Member |

### Notifications (`/api/notifications`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/` | List notifications | Member |
| GET | `/unread` | Get unread count | Member |
| PUT | `/:id/read` | Mark as read | Member |
| PUT | `/read-all` | Mark all as read | Member |
| DELETE | `/:id` | Delete notification | Member |

### Notification Settings (`/api/notification-settings`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/` | Get notification settings | Member |
| PUT | `/` | Update notification settings | Member |

### My Work (`/api/my-work`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/dashboard` | Get my work dashboard | Member |
| GET | `/tasks` | Get my tasks | Member |
| GET | `/decisions` | Get pending decisions | Member |

### Settings (`/api/settings`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/` | Get user settings | Member |
| PUT | `/` | Update user settings | Member |
| GET | `/preferences` | Get preferences | Member |
| PUT | `/preferences` | Update preferences | Member |

### LLM (`/api/llm`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/providers` | List LLM providers | Admin |
| POST | `/providers` | Add LLM provider | SuperAdmin |
| PUT | `/providers/:id` | Update LLM provider | SuperAdmin |
| DELETE | `/providers/:id` | Delete LLM provider | SuperAdmin |
| PUT | `/providers/:id/activate` | Activate provider | Admin |

### Knowledge (`/api/knowledge`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/` | List knowledge items | Member |
| POST | `/` | Add knowledge item | Admin |
| GET | `/:id` | Get knowledge item | Member |
| PUT | `/:id` | Update knowledge item | Admin |
| DELETE | `/:id` | Delete knowledge item | Admin |

### Documents (`/api/documents`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/` | List documents | Member |
| POST | `/` | Upload document | Member |
| GET | `/:id` | Get document | Member |
| DELETE | `/:id` | Delete document | Admin |

### Super Admin (`/api/superadmin`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/overview` | Get system overview | SuperAdmin |
| GET | `/organizations` | List all organizations | SuperAdmin |
| GET | `/users` | List all users | SuperAdmin |
| GET | `/metrics` | Get system metrics | SuperAdmin |

### Trial (`/api/trial`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/status` | Get trial status | Member |
| POST | `/start` | Start trial | Member |
| POST | `/extend` | Extend trial | Admin |

### Onboarding (`/api/onboarding`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/status` | Get onboarding status | Member |
| POST | `/complete` | Complete onboarding step | Member |

### Demo (`/api/demo`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/session` | Get demo session data | Public |
| POST | `/session` | Create demo session | Public |

### OAuth (`/api/auth`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/google` | Initiate Google OAuth | Public |
| GET | `/google/callback` | Google OAuth callback | Public |
| GET | `/linkedin` | Initiate LinkedIn OAuth | Public |
| GET | `/linkedin/callback` | LinkedIn OAuth callback | Public |

### MFA (`/api/mfa`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| POST | `/setup` | Setup MFA | Member |
| POST | `/verify` | Verify MFA code | Member |
| POST | `/disable` | Disable MFA | Member |

### Verify (`/api/verify`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/email/:token` | Verify email address | Public |
| POST | `/resend` | Resend verification email | Member |

### Help (`/api/help`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/topics` | List help topics | Member |
| GET | `/topics/:id` | Get help topic | Member |
| POST | `/search` | Search help content | Member |

### Feedback (`/api/feedback`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| POST | `/` | Submit feedback | Member |
| GET | `/` | List feedback (admin) | Admin |

### Referrals (`/api/referrals`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/` | Get referral info | Member |
| POST | `/` | Create referral | Member |
| GET | `/stats` | Get referral stats | Member |

### Partners (`/api/partners`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/` | List partners | Admin |
| POST | `/` | Create partner | SuperAdmin |
| GET | `/:id` | Get partner details | Admin |

### Consultants (`/api/consultants`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/` | List consultants | Admin |
| POST | `/` | Add consultant | Admin |
| DELETE | `/:id` | Remove consultant | Admin |

### Gamification (`/api/gamification`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/achievements` | Get user achievements | Member |
| GET | `/leaderboard` | Get leaderboard | Member |
| POST | `/claim` | Claim achievement | Member |

### User Goals (`/api/user`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/goals` | Get user goals | Member |
| POST | `/goals` | Create user goal | Member |
| PUT | `/goals/:id` | Update user goal | Member |
| DELETE | `/goals/:id` | Delete user goal | Member |

### Metrics (`/api/metrics`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/overview` | Get metrics overview | SuperAdmin |
| GET | `/funnels` | Get funnel metrics | SuperAdmin |

### Performance Metrics (`/api/performance-metrics`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/` | Get performance metrics | Admin |
| GET | `/api` | Get API performance | Admin |

### System Health (`/api/system/health`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/` | Get system health | Public |

### Audit (`/api/audit`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/` | Query audit log | Admin |
| GET | `/export` | Export audit log | Admin |

### GDPR (`/api/gdpr`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/export` | Export user data | Member |
| POST | `/delete` | Request data deletion | Member |

### Legal (`/api/legal`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/terms` | Get terms of service | Public |
| GET | `/privacy` | Get privacy policy | Public |
| POST | `/accept` | Accept legal documents | Member |

### Feature Flags (`/api/features`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/` | List feature flags | Admin |
| PUT | `/:key` | Toggle feature flag | SuperAdmin |

### Webhooks (`/api/webhooks`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| POST | `/stripe` | Stripe webhook handler | System |
| GET | `/subscriptions` | List webhook subscriptions | Admin |
| POST | `/subscriptions` | Create webhook subscription | Admin |

### Locations (`/api/locations`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/` | List locations | Member |
| POST | `/` | Create location | Admin |

### Megatrends (`/api/megatrends`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/` | List megatrends | Member |
| GET | `/:id` | Get megatrend details | Member |

### Baselines (`/api/baselines`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/:projectId` | Get baselines | Member |
| PUT | `/:projectId` | Update baselines | Admin |

### Capacity (`/api/capacity`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/:projectId` | Get capacity data | Member |
| PUT | `/:projectId` | Update capacity | Admin |

### Scenarios (`/api/scenarios`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/:projectId` | List scenarios | Member |
| POST | `/:projectId` | Create scenario | Admin |
| GET | `/:projectId/:id` | Get scenario | Member |
| PUT | `/:projectId/:id` | Update scenario | Admin |

### Access Control (`/api/access-control`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/` | List access controls | Admin |
| POST | `/` | Create access control | Admin |
| PUT | `/:id` | Update access control | Admin |
| DELETE | `/:id` | Delete access control | Admin |

### Access Codes (`/api/access-codes`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/` | List access codes | Admin |
| POST | `/` | Create access code | Admin |
| DELETE | `/:id` | Revoke access code | Admin |

### Organization Limits (`/api/organization`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/limits` | Get organization limits | Admin |
| PUT | `/limits` | Update limits | SuperAdmin |

### Promo (`/api/promo`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| POST | `/validate` | Validate promo code | Public |
| GET | `/` | List promo codes | SuperAdmin |

### Settlements (`/api/settlements`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/` | List settlements | SuperAdmin |
| POST | `/` | Create settlement | SuperAdmin |

### SSO (`/api/sso`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/config` | Get SSO configuration | Admin |
| POST | `/config` | Configure SSO | SuperAdmin |

### Preferences (`/api/preferences`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/` | Get user preferences | Member |
| PUT | `/` | Update preferences | Member |

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
