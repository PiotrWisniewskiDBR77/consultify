# FLOW-SECURITY-001: Advanced Security (SSO & SCIM)

> **ID:** FLOW-SECURITY-001 | **Status:** ✅ Complete | **Priority:** P1

## Overview

| Metric                    | Value              |
| ------------------------- | ------------------ |
| **Completeness**          | 100%               |
| **Implementation Status** | New implementation |

## Purpose

Zaawansowane funkcje bezpieczeństwa dla Enterprise - SSO, SCIM, IP Whitelisting, Session Management.

## Security Features

```
┌──────────────────────────────────────────────────────────────────────┐
│                    ENTERPRISE SECURITY FEATURES                     │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │
│  │      SSO        │  │     SCIM        │  │  IP WHITELIST   │      │
│  │  ─────────────  │  │  ─────────────  │  │  ─────────────  │      │
│  │  • SAML 2.0     │  │  • Auto sync    │  │  • IP ranges    │      │
│  │  • OIDC         │  │  • Provision    │  │  • CIDR blocks  │      │
│  │  • OAuth 2.0    │  │  • Deprovision  │  │  • Geo blocking │      │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘      │
│                                                                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │
│  │    SESSIONS     │  │      MFA        │  │   ENCRYPTION    │      │
│  │  ─────────────  │  │  ─────────────  │  │  ─────────────  │      │
│  │  • Timeouts     │  │  • TOTP         │  │  • At rest      │      │
│  │  • Concurrent   │  │  • WebAuthn     │  │  • In transit   │      │
│  │  • Remote kill  │  │  • SMS (soon)   │  │  • Key rotation │      │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘      │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## SSO Configuration

### Supported Protocols

| Protocol      | Providers                        | Status |
| ------------- | -------------------------------- | ------ |
| **SAML 2.0**  | Okta, Azure AD, OneLogin, Google | Active |
| **OIDC**      | Auth0, Okta, Azure AD, Keycloak  | Active |
| **OAuth 2.0** | Google, Microsoft                | Active |

### SAML Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        SAML SSO FLOW                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  User                Consultinity              IdP              │
│   │                      │                      │               │
│   │  1. Access app       │                      │               │
│   │─────────────────────►│                      │               │
│   │                      │                      │               │
│   │  2. SAML Request     │                      │               │
│   │◄─────────────────────│                      │               │
│   │                      │                      │               │
│   │  3. Redirect to IdP  │                      │               │
│   │─────────────────────────────────────────────►│               │
│   │                      │                      │               │
│   │  4. Authenticate     │                      │               │
│   │◄─────────────────────────────────────────────│               │
│   │                      │                      │               │
│   │  5. SAML Response    │                      │               │
│   │─────────────────────►│                      │               │
│   │                      │                      │               │
│   │                      │  6. Validate &       │               │
│   │                      │     Create session   │               │
│   │                      │                      │               │
│   │  7. Authenticated    │                      │               │
│   │◄─────────────────────│                      │               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### SSO Configuration

```typescript
interface SSOConfiguration {
  id: string;
  organizationId: string;
  protocol: 'saml' | 'oidc';

  // Provider info
  providerName: string;
  providerType: 'okta' | 'azure_ad' | 'google' | 'onelogin' | 'custom';

  // SAML config
  samlConfig?: {
    entityId: string;
    ssoUrl: string;
    sloUrl?: string;
    certificate: string;
    signatureAlgorithm: string;
    nameIdFormat: string;
    attributeMappings: {
      email: string;
      firstName: string;
      lastName: string;
      groups?: string;
    };
  };

  // OIDC config
  oidcConfig?: {
    issuer: string;
    clientId: string;
    clientSecret: string;
    authorizationUrl: string;
    tokenUrl: string;
    userInfoUrl: string;
    scopes: string[];
  };

  // Settings
  jitProvisioning: boolean; // Just-in-time user creation
  defaultRole: string;
  groupMappings: { idpGroup: string; appRole: string }[];

  // Status
  isEnabled: boolean;
  isDefault: boolean;
}
```

## SCIM Provisioning

### SCIM 2.0 Endpoints

| Method | Endpoint              | Description  |
| ------ | --------------------- | ------------ |
| GET    | `/scim/v2/Users`      | List users   |
| GET    | `/scim/v2/Users/:id`  | Get user     |
| POST   | `/scim/v2/Users`      | Create user  |
| PUT    | `/scim/v2/Users/:id`  | Replace user |
| PATCH  | `/scim/v2/Users/:id`  | Update user  |
| DELETE | `/scim/v2/Users/:id`  | Delete user  |
| GET    | `/scim/v2/Groups`     | List groups  |
| POST   | `/scim/v2/Groups`     | Create group |
| PATCH  | `/scim/v2/Groups/:id` | Update group |
| DELETE | `/scim/v2/Groups/:id` | Delete group |

### User Schema

```typescript
interface SCIMUser {
  schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'];
  id: string;
  externalId: string;
  userName: string;
  name: {
    givenName: string;
    familyName: string;
  };
  emails: { value: string; primary: boolean }[];
  active: boolean;
  groups: { value: string; display: string }[];
  meta: {
    resourceType: 'User';
    created: string;
    lastModified: string;
  };
}
```

## Session Management

### Session Configuration

```typescript
interface SessionConfiguration {
  organizationId: string;

  // Timeouts
  sessionTimeoutMinutes: number; // Default: 480 (8 hours)
  idleTimeoutMinutes: number; // Default: 30

  // Concurrent sessions
  maxConcurrentSessions: number; // 0 = unlimited

  // Security
  enforceReauthForSensitive: boolean;
  reauthTimeoutMinutes: number;

  // IP binding
  bindSessionToIp: boolean;
}
```

### Active Sessions View

```
┌─────────────────────────────────────────────────────────────────┐
│  Active Sessions                                   [Revoke All] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ✓ Current Session                                              │
│    Chrome · macOS · Warsaw, Poland                              │
│    Last active: Just now                                        │
│    IP: 195.56.xxx.xxx                                           │
│                                                                 │
│  ──────────────────────────────────────────────────────────────│
│                                                                 │
│  📱 iPhone · Safari                                 [Revoke]    │
│    Last active: 2 hours ago                                     │
│    IP: 195.56.xxx.xxx                                           │
│                                                                 │
│  💻 Windows · Firefox                               [Revoke]    │
│    Last active: 1 day ago                                       │
│    IP: 83.21.xxx.xxx                                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## IP Whitelisting

```typescript
interface IPWhitelistRule {
  id: string;
  organizationId: string;

  ruleType: 'ip' | 'cidr' | 'range';
  value: string; // IP, CIDR, or start-end
  description?: string;

  // Enforcement
  isEnabled: boolean;
  bypassForAdmins: boolean;

  createdBy: string;
  createdAt: string;
}
```

## Database Schema

```sql
-- SSO configurations
CREATE TABLE IF NOT EXISTS sso_configurations (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,

    -- Protocol
    protocol TEXT NOT NULL, -- 'saml', 'oidc'
    provider_name TEXT NOT NULL,
    provider_type TEXT NOT NULL, -- 'okta', 'azure_ad', 'google', 'onelogin', 'custom'

    -- SAML config (JSON)
    saml_config TEXT,

    -- OIDC config (JSON, encrypted)
    oidc_config TEXT,

    -- Settings
    jit_provisioning INTEGER DEFAULT 1,
    default_role TEXT DEFAULT 'user',
    group_mappings TEXT DEFAULT '[]', -- JSON

    -- Status
    is_enabled INTEGER DEFAULT 0,
    is_default INTEGER DEFAULT 0,

    -- Audit
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(organization_id, provider_name)
);

-- SCIM configuration
CREATE TABLE IF NOT EXISTS scim_configurations (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL UNIQUE,

    -- Token
    bearer_token_hash TEXT NOT NULL,
    token_prefix TEXT NOT NULL,

    -- Settings
    is_enabled INTEGER DEFAULT 1,
    sync_groups INTEGER DEFAULT 1,

    -- Audit
    last_sync_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SCIM sync log
CREATE TABLE IF NOT EXISTS scim_sync_log (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    operation TEXT NOT NULL, -- 'create_user', 'update_user', 'delete_user', 'create_group', etc.
    resource_type TEXT NOT NULL, -- 'User', 'Group'
    resource_id TEXT,
    external_id TEXT,
    status TEXT NOT NULL, -- 'success', 'error'
    error_message TEXT,
    request_data TEXT, -- JSON
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Session configuration per org
CREATE TABLE IF NOT EXISTS session_configurations (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL UNIQUE,

    session_timeout_minutes INTEGER DEFAULT 480,
    idle_timeout_minutes INTEGER DEFAULT 30,
    max_concurrent_sessions INTEGER DEFAULT 0, -- 0 = unlimited

    enforce_reauth_sensitive INTEGER DEFAULT 0,
    reauth_timeout_minutes INTEGER DEFAULT 15,

    bind_session_to_ip INTEGER DEFAULT 0,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User sessions (enhanced)
CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,

    -- Session details
    session_token_hash TEXT NOT NULL,
    refresh_token_hash TEXT,

    -- Device info
    user_agent TEXT,
    browser TEXT,
    os TEXT,
    device_type TEXT, -- 'desktop', 'mobile', 'tablet'

    -- Location
    ip_address TEXT,
    geo_country TEXT,
    geo_city TEXT,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,

    -- Status
    is_active INTEGER DEFAULT 1,
    revoked_at TIMESTAMP,
    revoked_by TEXT,
    revoke_reason TEXT
);

-- IP whitelist
CREATE TABLE IF NOT EXISTS ip_whitelist (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,

    rule_type TEXT NOT NULL, -- 'ip', 'cidr', 'range'
    rule_value TEXT NOT NULL,
    description TEXT,

    is_enabled INTEGER DEFAULT 1,
    bypass_for_admins INTEGER DEFAULT 1,

    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Security events
CREATE TABLE IF NOT EXISTS security_events (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    user_id TEXT,

    event_type TEXT NOT NULL, -- 'login_success', 'login_failed', 'session_revoked', 'ip_blocked', etc.
    severity TEXT DEFAULT 'info', -- 'info', 'warning', 'critical'

    ip_address TEXT,
    user_agent TEXT,
    geo_location TEXT,

    details TEXT, -- JSON

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sso_org ON sso_configurations(organization_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON user_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_ip_whitelist_org ON ip_whitelist(organization_id);
CREATE INDEX IF NOT EXISTS idx_security_events_org ON security_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
```

## API Endpoints

### SSO

| Method | Endpoint                  | Description              |
| ------ | ------------------------- | ------------------------ |
| GET    | `/api/admin/sso`          | Get SSO configuration    |
| POST   | `/api/admin/sso`          | Create SSO configuration |
| PUT    | `/api/admin/sso/:id`      | Update SSO configuration |
| DELETE | `/api/admin/sso/:id`      | Delete SSO configuration |
| POST   | `/api/admin/sso/:id/test` | Test SSO connection      |
| GET    | `/auth/sso/:orgSlug`      | Initiate SSO login       |
| POST   | `/auth/saml/callback`     | SAML callback            |
| GET    | `/auth/oidc/callback`     | OIDC callback            |

### Sessions

| Method | Endpoint                     | Description                  |
| ------ | ---------------------------- | ---------------------------- |
| GET    | `/api/security/sessions`     | Get my active sessions       |
| DELETE | `/api/security/sessions/:id` | Revoke session               |
| DELETE | `/api/security/sessions`     | Revoke all sessions          |
| GET    | `/api/admin/sessions`        | Get all org sessions (admin) |

### IP Whitelist

| Method | Endpoint                      | Description |
| ------ | ----------------------------- | ----------- |
| GET    | `/api/admin/ip-whitelist`     | Get rules   |
| POST   | `/api/admin/ip-whitelist`     | Add rule    |
| DELETE | `/api/admin/ip-whitelist/:id` | Delete rule |

## Related Flows

- FLOW-AUTH-001: Authentication flow
- FLOW-AUDIT-001: Security event logging
- FLOW-ADMIN-001: Admin security settings
