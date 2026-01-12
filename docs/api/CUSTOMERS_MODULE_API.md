# Enterprise Customers Module API Documentation

## Overview

This document describes all API endpoints for the Enterprise Customers Module in the SuperAdmin panel.

## Base URL

All endpoints are prefixed with `/api/superadmin`

## Authentication

All endpoints require SuperAdmin authentication via Bearer token.

## Organizations

### Get Organization Metadata
```
GET /organizations/:id/metadata
```

Returns all custom metadata fields for an organization.

### Update Organization Metadata
```
PUT /organizations/:id/metadata
Body: { key, value, valueType?, category?, isSensitive? }
```

Sets or updates a metadata field.

### Get Organization Tags
```
GET /organizations/:id/tags
```

Returns all tags assigned to an organization.

### Add Organization Tag
```
POST /organizations/:id/tags
Body: { tag, color?, category? }
```

Adds a tag to an organization.

### Remove Organization Tag
```
DELETE /organizations/:id/tags/:tagId
```

Removes a tag from an organization.

### Get Organization Health
```
GET /organizations/:id/health?date=YYYY-MM-DD
```

Returns health score and churn risk for an organization.

### Get Organization Relationships
```
GET /organizations/:id/relationships
```

Returns all relationships (parent-child, partners) for an organization.

### Get Organization Analytics
```
GET /organizations/:id/analytics?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
```

Returns analytics metrics for an organization over a date range.

## Users

### Get User Profile Extended
```
GET /users/:id/profile-extended
```

Returns extended profile information for a user.

### Update User Profile Extended
```
PUT /users/:id/profile-extended
Body: { jobTitle?, department?, phone?, timezone?, locale?, avatarUrl?, bio?, linkedinUrl?, githubUrl?, websiteUrl?, skills?, certifications?, preferences? }
```

Updates extended profile information.

### Get User Activity
```
GET /users/:id/activity?period=YYYY-MM-DD
```

Returns activity summary for a user.

### Get User Sessions
```
GET /users/:id/sessions
```

Returns all active sessions for a user.

### Revoke User Session
```
DELETE /users/:id/sessions/:sessionId
```

Ends a specific user session.

### Get User Groups
```
GET /users/:id/groups
```

Returns all groups a user belongs to.

### Get User Onboarding Progress
```
GET /users/:id/onboarding
```

Returns onboarding progress for a user.

### Update User Onboarding Progress
```
PUT /users/:id/onboarding
Body: { stepKey, stepName, completed, skipped }
```

Updates onboarding progress.

### Get User License
```
GET /users/:id/license
```

Returns license information for a user.

### Assign User License
```
PUT /users/:id/license
Body: { licenseType, features?, limits?, expiresAt?, notes? }
```

Assigns or updates a license for a user.

## Security

### Get IP Whitelist
```
GET /organizations/:id/ip-whitelist
```

Returns IP whitelist for an organization.

### Add IP to Whitelist
```
POST /organizations/:id/ip-whitelist
Body: { ipAddress, ipRange?, description? }
```

Adds an IP address or range to the whitelist.

### Remove IP from Whitelist
```
DELETE /ip-whitelist/:id
```

Removes an IP from the whitelist.

### Get User Devices
```
GET /users/:id/devices
```

Returns all devices associated with a user.

### Block Device
```
POST /devices/:id/block
Body: { reason? }
```

Blocks a device from accessing the system.

### Get MFA Methods
```
GET /users/:id/mfa
```

Returns all MFA methods configured for a user.

### Setup TOTP
```
POST /users/:id/mfa/totp/setup
```

Initiates TOTP setup and returns secret and QR code.

### Verify TOTP
```
POST /users/:id/mfa/totp/verify
Body: { token }
```

Verifies a TOTP token and enables MFA.

### Get Password Policy
```
GET /organizations/:id/password-policy
```

Returns password policy for an organization.

### Update Password Policy
```
PUT /organizations/:id/password-policy
Body: { minLength?, requireUppercase?, requireLowercase?, requireNumbers?, requireSpecialChars?, maxAgeDays?, preventReuseCount?, lockoutAttempts?, lockoutDurationMinutes?, requireMfa? }
```

Updates password policy.

### Get Security Events
```
GET /security-events?organizationId=&userId=&eventType=&severity=&resolved=&limit=
```

Returns security events with optional filters.

## Support

### Get Support Tickets
```
GET /support/tickets?organizationId=&userId=&status=&priority=&assignedTo=&limit=
```

Returns support tickets with optional filters.

### Create Support Ticket
```
POST /support/tickets
Body: { organizationId, userId?, subject, description, priority?, category?, tags?, metadata? }
```

Creates a new support ticket.

### Update Support Ticket
```
PUT /support/tickets/:id
Body: { status?, priority?, assignedTo?, tags?, metadata? }
```

Updates a support ticket.

### Add Ticket Comment
```
POST /support/tickets/:id/comments
Body: { commentText, isInternal? }
```

Adds a comment to a support ticket.

### Get Customer Success Notes
```
GET /organizations/:id/customer-success/notes?noteType=&userId=&limit=
```

Returns customer success notes for an organization.

### Create Customer Success Note
```
POST /organizations/:id/customer-success/notes
Body: { userId?, noteType?, title, content, actionItems?, followUpDate? }
```

Creates a customer success note.

### Get Customer Health Check
```
GET /organizations/:id/customer-success/health?date=YYYY-MM-DD
```

Returns health check data for an organization.

## Feedback

### Get Feedback Items
```
GET /feedback?organizationId=&userId=&feedbackType=&status=&limit=
```

Returns feedback items with optional filters.

### Create Feedback Item
```
POST /feedback
Body: { organizationId?, userId, feedbackType, category?, title, description, priority?, screenshots?, attachments?, metadata? }
```

Creates a new feedback item.

### Vote on Feedback
```
POST /feedback/:id/vote
Body: { voteType }
```

Votes on a feedback item (upvote/downvote).

### Add Feedback Comment
```
POST /feedback/:id/comments
Body: { commentText, isInternal? }
```

Adds a comment to a feedback item.

### Get Feature Roadmap
```
GET /feature-roadmap?status=
```

Returns feature roadmap items.

### Update Feature Roadmap
```
PUT /feature-roadmap/:id
Body: { status?, priority?, targetReleaseDate?, relatedFeedbackIds? }
```

Updates a feature roadmap item.

## Analytics

### Get User Adoption Metrics
```
GET /users/:id/adoption-metrics?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
```

Returns adoption metrics for a user.

### Get Churn Prediction
```
GET /organizations/:id/churn-prediction
```

Returns churn risk prediction for an organization.

## Compliance

### Get Data Retention Policies
```
GET /compliance/retention-policies?organizationId=
```

Returns data retention policies.

### Create Data Retention Policy
```
POST /compliance/retention-policies
Body: { organizationId?, dataType, retentionDays, autoDelete?, archiveBeforeDelete? }
```

Creates a data retention policy.

### Get GDPR Requests
```
GET /compliance/gdpr-requests?organizationId=
```

Returns GDPR data subject access requests.

### Create GDPR Request
```
POST /compliance/gdpr-requests
Body: { organizationId, userId?, requestType, notes? }
```

Creates a GDPR request.

### Get User Consents
```
GET /users/:id/consents
```

Returns all consents for a user.

### Update User Consent
```
PUT /users/:id/consents
Body: { consentType, status, consentVersion? }
```

Updates user consent status.

## Automation

### Get Automation Rules
```
GET /automation/rules?organizationId=&activeOnly=
```

Returns automation rules for an organization.

### Create Automation Rule
```
POST /automation/rules
Body: { organizationId, name, description?, triggerType, triggerConfig, actionType, actionConfig, conditions? }
```

Creates an automation rule.

### Update Automation Rule
```
PUT /automation/rules/:id
Body: { name?, description?, triggerType?, triggerConfig?, actionType?, actionConfig?, conditions?, isActive? }
```

Updates an automation rule.

### Get Webhook Subscriptions
```
GET /webhooks?organizationId=
```

Returns webhook subscriptions for an organization.

### Create Webhook Subscription
```
POST /webhooks
Body: { organizationId, name, url, events, secret? }
```

Creates a webhook subscription.

## Communication

### Get Email Templates
```
GET /email/templates?category=&activeOnly=
```

Returns email templates.

### Create Email Template
```
POST /email/templates
Body: { templateKey, name, subject, bodyHtml, bodyText?, variables?, category? }
```

Creates an email template.

### Get Email Campaigns
```
GET /email/campaigns?organizationId=&status=
```

Returns email campaigns.

### Create Email Campaign
```
POST /email/campaigns
Body: { organizationId?, name, templateId?, subject, bodyHtml, recipientFilter?, status? }
```

Creates an email campaign.

### Get Notification Preferences
```
GET /users/:id/notification-preferences
```

Returns notification preferences for a user.

### Update Notification Preferences
```
PUT /users/:id/notification-preferences
Body: { preferences: [{ organizationId?, notificationType, channel?, isEnabled, frequency? }] }
```

Updates notification preferences.

## Error Responses

All endpoints may return the following error responses:

- `401 Unauthorized` - Invalid or missing authentication token
- `403 Forbidden` - User does not have SuperAdmin role
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

Error response format:
```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```








