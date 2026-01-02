# Security & Privacy Module - Architecture Documentation

## Overview

The Security & Privacy module is an enterprise-grade security management system following industry standards from HubSpot and ClickUp. It provides comprehensive security controls, GDPR compliance, and user privacy management.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        SecurityPrivacyModule                             │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │  Dashboard  │  │     MFA     │  │   Trusted   │  │  Sessions   │    │
│  │   (Score)   │  │   Setup     │  │   Devices   │  │   Active    │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                      │
│  │  Security   │  │    Data     │  │  Privacy    │                      │
│  │   Events    │  │  Controls   │  │  Settings   │                      │
│  └─────────────┘  └─────────────┘  └─────────────┘                      │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Backend API                                      │
├─────────────────────────────────────────────────────────────────────────┤
│  /api/security/*        /api/mfa/*        /api/gdpr/*                   │
│  - /score              - /setup           - /consents                    │
│  - /compliance         - /verify-setup    - /retention                   │
│  - /events             - /disable         - /export-request              │
│  - /report             - /devices         - /deletion-request            │
│  - /alert-settings     - /regenerate      - /download/:id                │
└─────────────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Security Dashboard (`SecurityDashboard.tsx`)

Central hub displaying security posture with real-time metrics.

**Features:**
- Security Score (0-100) based on multiple factors
- Score breakdown by category (MFA, Password, Activity, Sessions, Data Controls)
- Compliance badges (GDPR, SOC 2, ISO 27001, Encryption)
- Recent security events summary
- Quick action cards for common tasks
- Recommendations for improving security

**Security Score Calculation:**
| Factor | Max Points | Criteria |
|--------|-----------|----------|
| MFA | 30 | Enabled = 30, Disabled = 0 |
| Password Strength | 25 | Based on complexity and age |
| Recent Activity | 20 | Penalized for suspicious events |
| Sessions | 15 | Fewer active sessions = higher score |
| Data Controls | 10 | Based on consent and opt-out settings |

### 2. MFA Setup (`MFASetup.tsx`)

Enhanced two-factor authentication management with modern UX.

**Features:**
- TOTP-based authentication (Google Authenticator, Authy)
- QR code and manual entry options
- Step-by-step setup wizard
- Backup codes with copy/download functionality
- Recovery email verification (UI ready)
- SMS fallback option (UI ready, requires backend)
- Trust device option during login

**Flow:**
1. Initial → Method Selection → QR Scan → Verification → Backup Codes → Complete

### 3. Trusted Devices (`TrustedDevicesSettings.tsx`)

Manage devices that can skip MFA verification.

**Features:**
- List all trusted devices with metadata
- Device type, browser, OS, location, IP
- Trust expiration dates
- Revoke individual or all devices
- Configurable trust duration (7-90 days or never)
- Current device indicator

### 4. Security Events (`SecurityEventsSettings.tsx`)

Personal security audit log for users.

**Features:**
- Comprehensive event history
- Filter by event type (login, security, MFA, data, suspicious)
- Search functionality
- Severity indicators (info, warning, critical)
- Export to CSV/PDF
- Security alert configuration

**Event Types:**
- `login` - Login attempts (success/failure)
- `logout` - Session terminations
- `security` - Password changes, account updates
- `mfa` - 2FA enable/disable/verify
- `data` - Data access and export events
- `suspicious` - Failed attempts, unusual patterns

### 5. Data Controls (`DataControlsSettings.tsx`)

GDPR-compliant data management interface.

**Features:**
- Consent management dashboard
- Data retention period selection
- Data portability (export all user data)
- Right to be forgotten (account deletion)
- Third-party data sharing controls
- AI training opt-out

**Consent Categories:**
- Analytics - Usage data collection
- Personalization - Experience customization
- Marketing - Promotional communications
- Third-party sharing - Partner data sharing
- AI Training - Model improvement

**Data Retention Options:**
- 30, 90, 180, 365 days, or Forever

### 6. Privacy Settings

User visibility and communication preferences.

**Features:**
- Profile visibility controls
- Activity sharing settings
- Communication preferences
- Third-party integration privacy

## API Endpoints

### Security Routes (`/api/security/*`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/score` | GET | Calculate security health score |
| `/compliance` | GET | Get compliance certification status |
| `/events` | GET | List security events (with filters) |
| `/report` | POST | Generate security report |
| `/alert-settings` | GET/PUT | Security alert preferences |

### MFA Routes (`/api/mfa/*`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/setup` | POST | Start MFA setup (returns QR) |
| `/verify-setup` | POST | Verify TOTP and enable MFA |
| `/disable` | POST | Disable MFA |
| `/devices` | GET | List trusted devices |
| `/devices/:id` | DELETE | Revoke trusted device |
| `/regenerate-codes` | POST | Generate new backup codes |
| `/status` | GET | Get MFA status |

### GDPR Routes (`/api/gdpr/*`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/consents` | GET/PUT | Consent preferences |
| `/retention` | GET/PUT | Data retention settings |
| `/export-request` | POST | Request data export |
| `/export-status` | GET | Check export status |
| `/download/:id` | GET | Download exported data |
| `/deletion-request` | POST | Request account deletion |
| `/cancel-deletion` | POST | Cancel deletion request |
| `/deletion-status` | GET | Check deletion status |

## Database Schema

### New Tables (Migration 106)

```sql
-- User consent preferences
user_consents (
    user_id, analytics, personalization, marketing,
    third_party_sharing, ai_training, timestamps
)

-- Data retention settings
user_data_retention (
    user_id, retention_period, auto_delete, timestamps
)

-- Export requests
data_export_requests (
    id, user_id, status, download_url, expires_at, timestamps
)

-- Deletion requests
data_deletion_requests (
    id, user_id, status, scheduled_for, cancelled_at, timestamps
)

-- Security alerts
user_security_alerts (
    user_id, email_suspicious_login, email_new_device,
    email_password_change, email_mfa_change, push_notifications
)

-- Trusted devices
trusted_devices (
    id, user_id, device_fingerprint, device_name, device_type,
    browser, os, ip_address, location, trusted_at, expires_at
)

-- Consent audit log
consent_audit_log (
    id, user_id, changes, ip_address, user_agent, timestamp
)
```

## Security Considerations

### Data Protection
- All sensitive data encrypted at rest (AES-256)
- TLS 1.3 for data in transit
- MFA secrets stored hashed
- Backup codes single-use and hashed

### Audit Trail
- All security events logged
- Consent changes recorded
- Login attempts tracked
- IP and device fingerprinting

### Compliance
- GDPR Article 17 (Right to Erasure)
- GDPR Article 20 (Data Portability)
- 30-day grace period for deletions
- Export data in JSON format

### Rate Limiting
- MFA verification: 5 attempts per 15 minutes
- Export requests: 1 per 24 hours
- Login attempts: 10 per 15 minutes

## Testing

Unit tests located in `tests/unit/securityModule.test.tsx`:

```bash
# Run security module tests
npm test -- --testPathPattern=securityModule
```

### Test Coverage Areas
- Security Dashboard rendering and score calculation
- MFA setup flow (enable/disable)
- Trusted devices management
- Security events filtering and export
- Data controls consent management
- GDPR export and deletion workflows

## Files Reference

### Frontend Components
- `components/settings/SecurityDashboard.tsx`
- `components/settings/TrustedDevicesSettings.tsx`
- `components/settings/SecurityEventsSettings.tsx`
- `components/settings/DataControlsSettings.tsx`
- `components/Profile/MFASetup.tsx`
- `views/settings/SecurityPrivacyModule.tsx`

### Backend Routes
- `server/routes/security.js`
- `server/routes/gdpr.js`
- `server/routes/mfa.js`
- `server/routes/sessions.js`

### Database Migrations
- `server/migrations/106_security_privacy_enterprise.sql`

### Tests
- `tests/unit/securityModule.test.tsx`

## Usage Example

```tsx
import { SecurityPrivacyModule } from './views/settings/SecurityPrivacyModule';

// In settings view
<SecurityPrivacyModule
    initialTab="dashboard"
    currentUser={currentUser}
    onUpdateUser={handleUpdateUser}
/>
```

## SMS MFA (Fallback 2FA)

### Overview

SMS MFA provides an alternative authentication method for users who cannot use authenticator apps. While less secure than TOTP due to SIM swapping risks, it offers wider accessibility.

### Features

- Phone number verification with E.164 format
- 6-digit OTP codes with 10-minute expiry
- Rate limiting (5 SMS/hour, 20 SMS/day)
- Delivery status tracking via Twilio webhooks
- Mock mode for development/testing

### Setup Requirements

**Environment Variables:**
```env
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
SMS_MOCK_MODE=true  # Set to false for production
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/mfa/methods` | GET | Get available MFA methods |
| `/api/mfa/sms/setup` | POST | Initialize SMS MFA with phone number |
| `/api/mfa/sms/verify-setup` | POST | Verify phone and enable SMS MFA |
| `/api/mfa/sms/send` | POST | Send SMS code for login |
| `/api/mfa/sms/verify` | POST | Verify SMS code during login |
| `/api/mfa/sms/disable` | POST | Disable SMS MFA |
| `/api/mfa/primary-method` | PUT | Set primary MFA method |
| `/api/mfa/phone-status` | GET | Get phone verification status |

### Database Tables

```sql
-- SMS verification codes
sms_verification_codes (id, user_id, phone_number, code, purpose, expires_at, attempts)

-- SMS delivery log
sms_delivery_log (id, user_id, phone_number, message_type, message_sid, status, error_code)

-- User phone fields (added to users table)
phone_number, phone_verified, phone_verified_at, mfa_sms_enabled, mfa_primary_method
```

### Security Considerations

1. **Rate Limiting**: Maximum 5 SMS per phone per hour, 20 per day
2. **OTP Expiry**: Codes expire after 10 minutes
3. **Max Attempts**: 3 verification attempts per code
4. **Brute Force Protection**: Same protection as TOTP
5. **Phone Verification**: Required before enabling SMS MFA

### Files

- `server/services/smsService.js` - SMS delivery and OTP management
- `server/routes/mfa.js` - SMS MFA API endpoints
- `server/migrations/107_sms_mfa.sql` - Database schema
- `components/Profile/MFASetup.tsx` - Frontend UI with method selection

---

## Future Enhancements

1. **Hardware Keys** - WebAuthn/FIDO2 support
2. **Session Geofencing** - Location-based access control
3. **Advanced Threat Detection** - ML-based anomaly detection
4. **Biometric Authentication** - Face/fingerprint on supported devices
5. **Password Breach Checking** - Have I Been Pwned integration

