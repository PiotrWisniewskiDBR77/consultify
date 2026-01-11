# FLOW-AUDIT-001: Audit Logging

> **ID:** FLOW-AUDIT-001 | **Status:** ✅ Complete | **Priority:** P1

## Overview

| Metric                    | Value              |
| ------------------------- | ------------------ |
| **Completeness**          | 100%               |
| **Implementation Status** | New implementation |

## Purpose

Pełny audit trail dla compliance (GDPR, SOC 2, ISO 27001). 7-letnia retencja dla audit log.

## Audit Log Categories

```
┌──────────────────────────────────────────────────────────────────────┐
│                       AUDIT LOG CATEGORIES                          │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  AUTHENTICATION & ACCESS                                        ││
│  │  • Login/Logout                                                 ││
│  │  • SSO authentication                                           ││
│  │  • Failed login attempts                                        ││
│  │  • Password changes                                             ││
│  │  • MFA events                                                   ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  DATA CHANGES                                                   ││
│  │  • Create/Update/Delete operations                              ││
│  │  • Field-level change tracking                                  ││
│  │  • Data exports                                                 ││
│  │  • Bulk operations                                              ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  ADMIN ACTIONS                                                  ││
│  │  • User management                                              ││
│  │  • Role/permission changes                                      ││
│  │  • Organization settings                                        ││
│  │  • Billing changes                                              ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  AI ACTIONS                                                     ││
│  │  • AI-initiated changes                                         ││
│  │  • AI approvals/rejections                                      ││
│  │  • AI learning events                                           ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  SYSTEM EVENTS                                                  ││
│  │  • Integration sync                                             ││
│  │  • Scheduled jobs                                               ││
│  │  • Errors and exceptions                                        ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## Audit Log Entry Structure

```typescript
interface AuditLogEntry {
  id: string;
  timestamp: string;

  // Who
  actorType: 'user' | 'system' | 'ai' | 'integration' | 'superadmin';
  actorId?: string;
  actorEmail?: string;
  actorIp?: string;
  actorUserAgent?: string;

  // What
  action: string;
  actionCategory: 'auth' | 'data' | 'admin' | 'ai' | 'system';

  // On what
  resourceType: string;
  resourceId?: string;
  resourceName?: string;

  // Context
  organizationId?: string;
  projectId?: string;

  // Changes
  previousValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  changedFields?: string[];

  // Metadata
  metadata?: Record<string, unknown>;

  // Result
  result: 'success' | 'failure' | 'partial';
  errorMessage?: string;
}
```

## Action Types

### Authentication

| Action                        | Description              |
| ----------------------------- | ------------------------ |
| `auth.login.success`          | Successful login         |
| `auth.login.failure`          | Failed login attempt     |
| `auth.logout`                 | User logout              |
| `auth.sso.login`              | SSO login                |
| `auth.password.change`        | Password changed         |
| `auth.password.reset.request` | Password reset requested |
| `auth.mfa.enable`             | MFA enabled              |
| `auth.mfa.disable`            | MFA disabled             |
| `auth.session.revoke`         | Session revoked          |

### Data Operations

| Action             | Description      |
| ------------------ | ---------------- |
| `data.create`      | Resource created |
| `data.update`      | Resource updated |
| `data.delete`      | Resource deleted |
| `data.export`      | Data exported    |
| `data.import`      | Data imported    |
| `data.bulk.update` | Bulk update      |
| `data.bulk.delete` | Bulk delete      |

### Admin Operations

| Action                      | Description           |
| --------------------------- | --------------------- |
| `admin.user.create`         | User created          |
| `admin.user.update`         | User updated          |
| `admin.user.delete`         | User deleted          |
| `admin.user.role.change`    | User role changed     |
| `admin.org.settings.update` | Org settings changed  |
| `admin.billing.plan.change` | Plan changed          |
| `admin.sso.configure`       | SSO configured        |
| `admin.integration.connect` | Integration connected |

### AI Operations

| Action                  | Description            |
| ----------------------- | ---------------------- |
| `ai.action.execute`     | AI executed action     |
| `ai.action.approve`     | AI action approved     |
| `ai.action.reject`      | AI action rejected     |
| `ai.suggestion.create`  | AI created suggestion  |
| `ai.instruction.update` | AI instruction updated |

## Retention Policy

| Data Type       | Retention Period | Reason     |
| --------------- | ---------------- | ---------- |
| Security events | 7 years          | Compliance |
| Data changes    | 7 years          | Compliance |
| Admin actions   | 7 years          | Compliance |
| AI actions      | 3 years          | Analysis   |
| System events   | 1 year           | Debugging  |
| Login events    | 2 years          | Security   |

## Database Schema

```sql
-- Main audit log table
CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Actor
    actor_type TEXT NOT NULL, -- 'user', 'system', 'ai', 'integration', 'superadmin'
    actor_id TEXT,
    actor_email TEXT,
    actor_ip TEXT,
    actor_user_agent TEXT,

    -- Action
    action TEXT NOT NULL,
    action_category TEXT NOT NULL, -- 'auth', 'data', 'admin', 'ai', 'system'

    -- Resource
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    resource_name TEXT,

    -- Context
    organization_id TEXT,
    project_id TEXT,

    -- Changes (JSON)
    previous_values TEXT,
    new_values TEXT,
    changed_fields TEXT, -- JSON array

    -- Metadata
    metadata TEXT, -- JSON

    -- Result
    result TEXT NOT NULL, -- 'success', 'failure', 'partial'
    error_message TEXT,

    -- Compliance
    retention_until DATE,
    is_archived INTEGER DEFAULT 0
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_category ON audit_log(action_category);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_retention ON audit_log(retention_until);

-- Audit log archive (for old data)
CREATE TABLE IF NOT EXISTS audit_log_archive (
    id TEXT PRIMARY KEY,
    original_id TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    actor_type TEXT NOT NULL,
    actor_id TEXT,
    action TEXT NOT NULL,
    action_category TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    organization_id TEXT,
    compressed_data TEXT, -- Compressed JSON of full entry
    archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit log export history
CREATE TABLE IF NOT EXISTS audit_export_history (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    exported_by TEXT NOT NULL,

    -- Filter used
    date_from DATE,
    date_to DATE,
    action_category TEXT,

    -- Export details
    total_records INTEGER,
    file_format TEXT, -- 'csv', 'json'
    file_size_bytes INTEGER,

    -- Download tracking
    download_url TEXT,
    expires_at TIMESTAMP,
    download_count INTEGER DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## API Endpoints

| Method | Endpoint            | Description                   |
| ------ | ------------------- | ----------------------------- |
| GET    | `/api/audit`        | Get audit logs (with filters) |
| GET    | `/api/audit/:id`    | Get single entry              |
| POST   | `/api/audit/export` | Export audit logs             |
| GET    | `/api/audit/stats`  | Get audit statistics          |
| GET    | `/api/audit/actors` | Get unique actors             |

## Query Examples

```typescript
// Get all admin actions by user in last 24h
const logs = await getAuditLogs({
  organizationId: orgId,
  actorId: userId,
  actionCategory: 'admin',
  fromDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
});

// Get all changes to a specific resource
const changes = await getAuditLogs({
  resourceType: 'initiative',
  resourceId: initiativeId,
});

// Get all failed login attempts
const failures = await getAuditLogs({
  action: 'auth.login.failure',
  organizationId: orgId,
});
```

## SuperAdmin View

```
┌─────────────────────────────────────────────────────────────────────┐
│  Audit Log                                    [Export] [Filters]    │
├─────────────────────────────────────────────────────────────────────┤
│  Filter: [All Categories ▼] [All Actions ▼] [Date Range ▼]         │
│                                                                     │
│  ──────────────────────────────────────────────────────────────────│
│                                                                     │
│  2026-01-11 14:32:15 | john@company.com                            │
│  🔧 admin.user.role.change                                          │
│  Changed role of sarah@company.com from 'user' to 'admin'          │
│  IP: 195.56.xxx.xxx | Warsaw, Poland                               │
│                                                                     │
│  ──────────────────────────────────────────────────────────────────│
│                                                                     │
│  2026-01-11 14:28:03 | SYSTEM                                      │
│  🔄 system.sync.integration                                         │
│  Synced 45 tasks from Jira                                         │
│                                                                     │
│  ──────────────────────────────────────────────────────────────────│
│                                                                     │
│  2026-01-11 14:25:11 | AI                                          │
│  🤖 ai.action.execute                                               │
│  Created 3 initiatives from assessment results                      │
│  Approved by: john@company.com                                      │
│                                                                     │
│  [Load More]                                                        │
└─────────────────────────────────────────────────────────────────────┘
```

## Related Flows

- FLOW-SECURITY-001: Security events → audit log
- FLOW-ADMIN-001: Admin actions logged
- FLOW-AI-001: AI actions logged
- FLOW-GDPR-001: Data access requests use audit log
