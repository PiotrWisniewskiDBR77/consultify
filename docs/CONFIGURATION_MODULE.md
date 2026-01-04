# Configuration Module Documentation

## Overview

The Configuration Module provides comprehensive enterprise-level settings management for the Consultify platform. It enables SuperAdmins to configure security policies, billing, integrations, data management, and email settings across organizations.

## Architecture

```
components/SuperAdmin/
├── security/
│   ├── SecurityPoliciesPanel.tsx     # Security policy configuration
│   ├── SessionManagementPanel.tsx    # Active session management
│   ├── LoginAttemptsPanel.tsx        # Login attempts & lockouts
│   ├── IPAccessRulesPanel.tsx        # IP allowlist/blocklist
│   └── index.ts
├── billing/
│   ├── BillingOverviewPanel.tsx      # Billing dashboard
│   ├── InvoicesPanel.tsx             # Invoice management
│   ├── SubscriptionsPanel.tsx        # Subscription management
│   ├── CreditNotesPanel.tsx          # Credit notes
│   └── index.ts
├── integrations/
│   ├── WebhooksPanel.tsx             # Webhook management
│   ├── WebhookDeliveriesModal.tsx    # Delivery logs viewer
│   └── index.ts
├── data/
│   ├── DataExportPanel.tsx           # Data export requests
│   ├── BackupConfigPanel.tsx         # Backup configuration
│   └── index.ts
├── EmailConfigurationPanel.tsx       # Email/SMTP configuration
├── FeatureFlagsPanel.tsx             # Feature flag management
├── IntegrationsPanel.tsx             # Integration hub
└── LegalPanel.tsx                    # Legal & compliance
```

## Features

### 1. Security Management

#### Security Policies (`SecurityPoliciesPanel`)

Configure organization-level security settings:

- **Password Policy**
  - Minimum length (8-32 characters)
  - Character requirements (uppercase, lowercase, numbers, special)
  - Password expiry (30-365 days)
  - Password history (prevent reuse of last N passwords)

- **Session Policy**
  - Session timeout (15-480 minutes)
  - Concurrent sessions limit
  - Session binding (IP/device)
  
- **Account Lockout**
  - Max login attempts before lockout
  - Lockout duration
  
- **MFA Configuration**
  - Enable/disable MFA requirement
  - Supported methods: TOTP, SMS, Email, Hardware keys
  - Remember device option

- **Compliance Presets**
  - Standard (basic security)
  - SOC 2 (financial services)
  - HIPAA (healthcare)
  - GDPR (EU data protection)

#### Session Management (`SessionManagementPanel`)

Real-time management of active user sessions:

- View all active sessions across organizations
- Session details: device type, browser, OS, IP, location
- Terminate individual sessions
- Terminate all sessions for a user
- Search and filter by organization

#### Login Attempts (`LoginAttemptsPanel`)

Security monitoring dashboard:

- Login success/failure statistics
- Success rate trending
- Active lockout management
- Unlock accounts manually
- Filter by status (success/failed)
- IP-based analysis

#### IP Access Rules (`IPAccessRulesPanel`)

Network access control:

- **Allowlist**: Restrict access to specific IPs
- **Blocklist**: Block suspicious IPs
- CIDR notation support (e.g., `192.168.1.0/24`)
- Rule expiration dates
- Enable/disable rules individually

### 2. Billing Management

#### Billing Overview (`BillingOverviewPanel`)

Dashboard for billing metrics:

- Current plan information
- Usage statistics
- Monthly spending
- Active subscriptions count

#### Invoice Management (`InvoicesPanel`)

Complete invoice lifecycle:

- Invoice listing with filters
- Status tracking: draft, open, paid, void, uncollectible
- Line item details
- PDF generation and download
- Send invoice reminders
- Mark as paid

#### Subscription Management (`SubscriptionsPanel`)

Organization subscription control:

- Active subscriptions list
- Create new subscriptions
- Change plans (upgrade/downgrade)
- Cancel subscriptions
- Trial management
- Billing cycle configuration

#### Credit Notes (`CreditNotesPanel`)

Credit and refund management:

- Issue credit notes
- Track applied credits
- Total credits dashboard
- Credit history

### 3. Feature Flags

#### Feature Flags (`FeatureFlagsPanel`)

Feature rollout management:

- **Flag Types**
  - Boolean: Simple on/off
  - Percentage: Gradual rollout
  - Targeting: User/org-based rules
  - A/B Test: Split testing

- **Environments**: Development, Staging, Production
- **History**: Track flag changes over time
- **Targeting Rules**: Enable for specific users/organizations

### 4. Integrations & Webhooks

#### Webhooks (`WebhooksPanel`)

External system notifications:

- Webhook endpoint management
- Event type selection
- Secret key generation
- Enable/disable webhooks
- Test webhook delivery

#### Delivery Logs (`WebhookDeliveriesModal`)

Webhook debugging:

- Delivery history
- Request/response inspection
- Retry failed deliveries
- Duration tracking
- Error message display

### 5. Data Management

#### Data Export (`DataExportPanel`)

GDPR-compliant data export:

- **Export Types**
  - Full: Complete organization data
  - Partial: Selected data types
  - GDPR: User data export

- **Data Types**
  - Users and profiles
  - Projects and initiatives
  - Tasks and assignments
  - Documents and files
  - Audit logs
  - AI conversation history
  - Settings
  - Billing data

- Secure download links with expiration
- Export status tracking

#### Backup Configuration (`BackupConfigPanel`)

Automated backup management:

- Enable/disable automatic backups
- Frequency: Hourly, Daily, Weekly, Monthly
- Retention period configuration
- Include/exclude attachments
- Include/exclude audit logs
- Manual backup trigger
- Backup history

### 6. Email Configuration

#### Email Settings (`EmailConfigurationPanel`)

Email delivery configuration:

- **Providers**
  - Custom SMTP
  - SendGrid
  - Mailgun
  - Amazon SES

- **SMTP Settings**
  - Host and port
  - Username and password
  - TLS encryption

- **Sender Settings**
  - From email/name
  - Reply-to address

- **DNS Verification**
  - SPF record
  - DKIM signature
  - DMARC policy

- Test email functionality

## Database Schema

### Security Tables

```sql
-- security_policies
CREATE TABLE security_policies (
    id TEXT PRIMARY KEY,
    organization_id TEXT UNIQUE,
    password_min_length INTEGER DEFAULT 12,
    password_require_uppercase INTEGER DEFAULT 1,
    password_require_lowercase INTEGER DEFAULT 1,
    password_require_numbers INTEGER DEFAULT 1,
    password_require_special INTEGER DEFAULT 1,
    password_expiry_days INTEGER DEFAULT 90,
    password_history_count INTEGER DEFAULT 5,
    max_login_attempts INTEGER DEFAULT 5,
    lockout_duration_minutes INTEGER DEFAULT 30,
    session_timeout_minutes INTEGER DEFAULT 60,
    concurrent_sessions_limit INTEGER DEFAULT 3,
    require_session_binding INTEGER DEFAULT 0,
    ip_allowlist TEXT,
    ip_blocklist TEXT,
    geo_restrictions TEXT,
    mfa_required INTEGER DEFAULT 0,
    mfa_methods TEXT DEFAULT '["totp"]',
    mfa_remember_device_days INTEGER DEFAULT 30,
    compliance_preset TEXT DEFAULT 'none',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- password_history
CREATE TABLE password_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- login_attempts
CREATE TABLE login_attempts (
    id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL,
    user_id TEXT,
    organization_id TEXT,
    success INTEGER DEFAULT 0,
    failure_reason TEXT,
    auth_method TEXT DEFAULT 'password',
    ip_address TEXT,
    user_agent TEXT,
    location TEXT,
    risk_score REAL,
    risk_factors TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- account_lockouts
CREATE TABLE account_lockouts (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    user_email TEXT NOT NULL,
    organization_id TEXT,
    reason TEXT DEFAULT 'max_attempts',
    failed_attempts INTEGER DEFAULT 0,
    locked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    unlocked_at DATETIME,
    unlocked_by TEXT,
    ip_address TEXT
);

-- user_sessions
CREATE TABLE user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT,
    token_hash TEXT NOT NULL,
    device_fingerprint TEXT,
    device_type TEXT,
    device_name TEXT,
    browser TEXT,
    os TEXT,
    ip_address TEXT,
    location TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    is_active INTEGER DEFAULT 1
);
```

## API Endpoints

See [API Reference](./API_CONFIGURATION_MODULE.md) for detailed endpoint documentation.

## Usage Examples

### Setting Up Security Policy

```typescript
import { Api } from '../services/api';

// Get current policy
const { policy } = await Api.get('/security-policies/org-123');

// Update policy
await Api.put('/security-policies/org-123', {
    passwordMinLength: 14,
    mfaRequired: true,
    sessionTimeoutMinutes: 30
});

// Apply compliance preset
await Api.post('/security-policies/org-123/preset', {
    preset: 'soc2'
});
```

### Managing Webhooks

```typescript
// Create webhook
await Api.post('/settings/webhooks', {
    url: 'https://api.example.com/webhook',
    events: ['user.created', 'project.updated'],
    secret: 'generated_secret'
});

// Get delivery logs
const { deliveries } = await Api.get('/settings/webhooks/webhook-id/deliveries');

// Retry failed delivery
await Api.post('/settings/webhooks/deliveries/delivery-id/retry');
```

### Requesting Data Export

```typescript
// Request full export
await Api.post('/data-export/requests', {
    exportType: 'full',
    includeData: ['users', 'projects', 'tasks', 'documents']
});

// Check export status
const { requests } = await Api.get('/data-export/requests');
```

## Best Practices

1. **Security**
   - Use compliance presets for regulated industries
   - Enable MFA for all admin accounts
   - Set reasonable session timeouts
   - Review login attempts regularly

2. **Backups**
   - Enable daily automatic backups
   - Set retention period based on compliance requirements
   - Include audit logs for regulated industries
   - Test backup restoration periodically

3. **Webhooks**
   - Use HTTPS endpoints only
   - Implement retry logic on your end
   - Monitor delivery success rates
   - Rotate secrets periodically

4. **Email**
   - Set up SPF, DKIM, and DMARC records
   - Use a dedicated sending domain
   - Test deliverability regularly
   - Monitor bounce rates

## Troubleshooting

### Common Issues

1. **Session Terminated Unexpectedly**
   - Check session timeout settings
   - Verify IP binding isn't enabled if using VPN
   - Check concurrent session limits

2. **Webhook Deliveries Failing**
   - Verify endpoint URL is accessible
   - Check firewall rules
   - Validate SSL certificate
   - Review error messages in delivery logs

3. **Email Not Sending**
   - Verify SMTP credentials
   - Check TLS settings
   - Test connection with Send Test button
   - Review DNS verification status

4. **Export Taking Too Long**
   - Large datasets take longer
   - Exclude unnecessary data types
   - Check server resources

## Related Documentation

- [Security Policy Service](./architecture/security-service.md)
- [Billing Integration](./BILLING_INTEGRATION.md)
- [Webhook Events Reference](./WEBHOOK_EVENTS.md)
- [API Reference](./API_CONFIGURATION_MODULE.md)












