# FLOW-GDPR-001: GDPR & Data Compliance

> **ID:** FLOW-GDPR-001 | **Status:** ✅ Complete | **Priority:** P1

## Overview

| Metric                    | Value              |
| ------------------------- | ------------------ |
| **Completeness**          | 100%               |
| **Implementation Status** | New implementation |

## Purpose

Pełna zgodność z GDPR i innymi regulacjami ochrony danych. Data Subject Rights, Retention Policies, Consent Management.

## GDPR Requirements

```
┌──────────────────────────────────────────────────────────────────────┐
│                     GDPR COMPLIANCE AREAS                           │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  DATA SUBJECT RIGHTS                                            ││
│  │  • Right to Access (Art. 15)                                    ││
│  │  • Right to Rectification (Art. 16)                             ││
│  │  • Right to Erasure (Art. 17)                                   ││
│  │  • Right to Portability (Art. 20)                               ││
│  │  • Right to Object (Art. 21)                                    ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  CONSENT MANAGEMENT                                             ││
│  │  • Cookie consent                                               ││
│  │  • Marketing consent                                            ││
│  │  • Processing consent                                           ││
│  │  • Withdrawal mechanism                                         ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  DATA RETENTION                                                 ││
│  │  • Configurable policies                                        ││
│  │  • Automatic deletion                                           ││
│  │  • Archive before delete                                        ││
│  │  • Audit log retention (7 years)                                ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  DATA PROCESSING                                                ││
│  │  • Processing agreements (DPA)                                  ││
│  │  • Sub-processor list                                           ││
│  │  • Data transfer mechanisms                                     ││
│  │  • Privacy Impact Assessments                                   ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## Data Subject Access Request (DSAR)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Data Subject Request                                    [+ New]    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Request #DSAR-2026-0015                                            │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  Type: Data Export (Right to Portability)                           │
│  Subject: john.doe@example.com                                      │
│  Submitted: 2026-01-11 10:30 UTC                                    │
│  Deadline: 2026-02-10 (30 days)                                     │
│  Status: 🟡 In Progress                                             │
│                                                                     │
│  Progress                                                           │
│  ─────────────────────────────────────────────────────────────────  │
│  ✅ Identity verified                                               │
│  ✅ Data collection initiated                                       │
│  🔄 Data compilation in progress (65%)                              │
│  ○  Review pending                                                  │
│  ○  Delivery pending                                                │
│                                                                     │
│  Data Categories                                                    │
│  ─────────────────────────────────────────────────────────────────  │
│  ☑️ Profile data                                                    │
│  ☑️ Activity logs                                                   │
│  ☑️ Project contributions                                           │
│  ☑️ AI interactions                                                 │
│  ☐ Exclude organization data                                        │
│                                                                     │
│  [Download Data] [Complete Request] [Extend Deadline]               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Retention Policies

| Data Type            | Active Account | Cancelled Account | After Delete |
| -------------------- | -------------- | ----------------- | ------------ |
| **User Profile**     | Indefinite     | 30 days grace     | Anonymize    |
| **Project Data**     | Indefinite     | 90 days archive   | Delete       |
| **Audit Logs**       | 7 years        | 7 years           | Archive      |
| **AI Conversations** | 2 years        | Delete on cancel  | -            |
| **Session Logs**     | 90 days        | Delete            | -            |
| **Billing Data**     | 7 years        | 7 years           | Archive      |

## Database Schema

```sql
-- Data subject requests (DSAR)
CREATE TABLE IF NOT EXISTS data_subject_requests (
    id TEXT PRIMARY KEY,
    request_number TEXT NOT NULL UNIQUE,
    organization_id TEXT,

    -- Subject
    subject_email TEXT NOT NULL,
    subject_name TEXT,
    subject_user_id TEXT, -- If registered user

    -- Request details
    request_type TEXT NOT NULL, -- 'access', 'rectification', 'erasure', 'portability', 'objection', 'restriction'
    request_details TEXT,

    -- Identity verification
    identity_verified INTEGER DEFAULT 0,
    verification_method TEXT, -- 'email', 'document', 'account_login'
    verified_at TIMESTAMP,
    verified_by TEXT,

    -- Processing
    status TEXT DEFAULT 'pending', -- 'pending', 'verified', 'processing', 'review', 'completed', 'rejected', 'extended'
    assigned_to TEXT,

    -- Deadlines
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deadline_at TIMESTAMP, -- 30 days from submission
    extended_deadline_at TIMESTAMP,
    extension_reason TEXT,

    -- Response
    response_type TEXT, -- 'data_export', 'confirmation', 'partial', 'rejection'
    response_data_url TEXT,
    response_notes TEXT,
    completed_at TIMESTAMP,
    completed_by TEXT,

    -- If rejected
    rejection_reason TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- DSAR activity log
CREATE TABLE IF NOT EXISTS dsar_activity_log (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,

    activity_type TEXT NOT NULL, -- 'status_change', 'verification', 'data_collected', 'review', 'completed'
    description TEXT,
    performed_by TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (request_id) REFERENCES data_subject_requests(id) ON DELETE CASCADE
);

-- Consent records
CREATE TABLE IF NOT EXISTS consent_records (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    email TEXT, -- For non-registered
    organization_id TEXT,

    -- Consent details
    consent_type TEXT NOT NULL, -- 'cookies_essential', 'cookies_analytics', 'cookies_marketing', 'email_marketing', 'data_processing', 'ai_training'
    consent_given INTEGER NOT NULL, -- 1 = given, 0 = denied

    -- Context
    consent_text TEXT, -- The actual text shown
    consent_version TEXT,
    ip_address TEXT,
    user_agent TEXT,

    -- Timestamps
    given_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    withdrawn_at TIMESTAMP,

    -- Source
    source TEXT, -- 'registration', 'cookie_banner', 'settings', 'email'

    UNIQUE(user_id, consent_type) -- Latest consent per type
);

-- Retention policies
CREATE TABLE IF NOT EXISTS retention_policies (
    id TEXT PRIMARY KEY,
    organization_id TEXT, -- NULL for system defaults

    data_category TEXT NOT NULL, -- 'user_profile', 'project_data', 'audit_logs', 'ai_conversations', 'session_logs', 'billing'

    -- Active account
    active_retention_days INTEGER, -- NULL = indefinite

    -- Cancelled account
    grace_period_days INTEGER DEFAULT 30,
    archive_days INTEGER, -- Days to keep in archive before delete
    delete_after_days INTEGER,

    -- Actions
    anonymize_on_delete INTEGER DEFAULT 0,
    archive_before_delete INTEGER DEFAULT 1,

    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(organization_id, data_category)
);

-- Data deletion log
CREATE TABLE IF NOT EXISTS data_deletion_log (
    id TEXT PRIMARY KEY,
    organization_id TEXT,

    -- What was deleted
    data_type TEXT NOT NULL,
    record_count INTEGER,

    -- Why
    deletion_reason TEXT NOT NULL, -- 'retention_policy', 'user_request', 'account_cancellation', 'manual'
    dsar_request_id TEXT,

    -- Who
    deleted_by TEXT, -- User ID or 'system'

    -- When
    deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Verification
    deletion_verified INTEGER DEFAULT 0,
    verified_at TIMESTAMP
);

-- Sub-processors
CREATE TABLE IF NOT EXISTS sub_processors (
    id TEXT PRIMARY KEY,

    name TEXT NOT NULL,
    description TEXT,
    purpose TEXT NOT NULL,

    -- Location
    country TEXT NOT NULL,
    country_code TEXT,
    region TEXT, -- 'EU', 'US', 'APAC'

    -- Data categories processed
    data_categories TEXT NOT NULL, -- JSON array

    -- Compliance
    gdpr_compliant INTEGER DEFAULT 1,
    dpa_signed INTEGER DEFAULT 1,
    dpa_url TEXT,

    -- Transfer mechanism
    transfer_mechanism TEXT, -- 'adequacy_decision', 'scc', 'bcr', 'consent'

    is_active INTEGER DEFAULT 1,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed default retention policies
INSERT OR IGNORE INTO retention_policies (id, organization_id, data_category, active_retention_days, grace_period_days, archive_days, delete_after_days) VALUES
    ('ret-audit', NULL, 'audit_logs', NULL, 0, 2555, 2555), -- 7 years
    ('ret-billing', NULL, 'billing', NULL, 0, 2555, 2555), -- 7 years
    ('ret-sessions', NULL, 'session_logs', 90, 0, 0, 90),
    ('ret-ai', NULL, 'ai_conversations', 730, 0, 0, 730), -- 2 years
    ('ret-projects', NULL, 'project_data', NULL, 90, 365, 365),
    ('ret-users', NULL, 'user_profile', NULL, 30, 0, 30);

CREATE INDEX IF NOT EXISTS idx_dsar_org ON data_subject_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_dsar_email ON data_subject_requests(subject_email);
CREATE INDEX IF NOT EXISTS idx_dsar_status ON data_subject_requests(status);
CREATE INDEX IF NOT EXISTS idx_consent_user ON consent_records(user_id);
CREATE INDEX IF NOT EXISTS idx_consent_type ON consent_records(consent_type);
CREATE INDEX IF NOT EXISTS idx_deletion_log_org ON data_deletion_log(organization_id);
```

## API Endpoints

### DSAR

| Method | Endpoint                          | Description              |
| ------ | --------------------------------- | ------------------------ |
| GET    | `/api/gdpr/requests`              | List requests (admin)    |
| POST   | `/api/gdpr/requests`              | Submit new request       |
| GET    | `/api/gdpr/requests/:id`          | Get request details      |
| PUT    | `/api/gdpr/requests/:id`          | Update request           |
| POST   | `/api/gdpr/requests/:id/verify`   | Verify identity          |
| POST   | `/api/gdpr/requests/:id/complete` | Complete request         |
| GET    | `/api/gdpr/my-data`               | Download my data         |
| DELETE | `/api/gdpr/my-account`            | Request account deletion |

### Consent

| Method | Endpoint                    | Description     |
| ------ | --------------------------- | --------------- |
| GET    | `/api/gdpr/consent`         | Get my consents |
| POST   | `/api/gdpr/consent`         | Update consent  |
| GET    | `/api/gdpr/consent/history` | Consent history |

### Admin

| Method | Endpoint                         | Description            |
| ------ | -------------------------------- | ---------------------- |
| GET    | `/api/admin/gdpr/retention`      | Get retention policies |
| PUT    | `/api/admin/gdpr/retention`      | Update policies        |
| GET    | `/api/admin/gdpr/sub-processors` | List sub-processors    |

## Related Flows

- FLOW-SECURITY-001: Security compliance
- FLOW-AUDIT-001: Audit logs for compliance
- FLOW-ENTERPRISE-001: Data residency
- FLOW-AUTH-001: User account management
