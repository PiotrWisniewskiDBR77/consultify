# FLOW-SECURITY-001: Authentication & Session Management

> **ID:** FLOW-SECURITY-001 | **Status:** ✅ Complete | **Priority:** HIGH

## Overview

| Metryka                  | Wartość                  |
| ------------------------ | ------------------------ |
| **Kompletność**          | 85%                      |
| **Zidentyfikowane luki** | 3                        |
| **Priorytet naprawy**    | HIGH (security-critical) |

## Purpose

Bezpieczna autentykacja użytkowników, zarządzanie sesjami, refresh tokenów, i zapewnienie bezpieczeństwa dostępu do systemu.

## Triggers

| Trigger          | Opis                                           |
| ---------------- | ---------------------------------------------- |
| User Login       | Użytkownik loguje się credentials lub SSO      |
| Token Expiration | Access token wygasa, wymaga refresh            |
| Session Activity | Użytkownik aktywny - update last_active        |
| Logout           | Użytkownik wylogowuje się                      |
| Password Change  | Zmiana hasła wymaga session review             |
| Security Event   | Podejrzane zachowanie (multiple failed logins) |

## Outcomes

- Użytkownik otrzymuje access token i refresh token
- Sesja jest trackowana w bazie danych
- Token rotation przy refresh
- Bezpieczne wylogowanie z wszystkich urządzeń

## Actors

| Aktor            | Rola                                  |
| ---------------- | ------------------------------------- |
| User             | Loguje się, używa systemu, wylogowuje |
| Auth Service     | Waliduje credentials, generuje tokeny |
| Session Manager  | Trackuje aktywne sesje                |
| Security Monitor | Wykrywa podejrzane zachowania         |

## Involved Modules

### Frontend

| Komponent        | Lokalizacja           | Odpowiedzialność      |
| ---------------- | --------------------- | --------------------- |
| AuthView         | `src/views/auth/`     | Login/Register forms  |
| useAuth hook     | `src/hooks/`          | Token management      |
| SessionProvider  | `src/providers/`      | Session context       |
| SecuritySettings | `src/views/settings/` | Session management UI |

### Backend

| Serwis/Route        | Lokalizacja                                  | Odpowiedzialność           |
| ------------------- | -------------------------------------------- | -------------------------- |
| auth.routes.ts      | `server/src/routes/auth.routes.ts`           | Login, register, refresh   |
| auth.middleware.ts  | `server/src/middleware/auth.middleware.ts`   | Token verification         |
| RefreshTokenService | `server/src/services/RefreshTokenService.ts` | Token generation, rotation |
| userSessionService  | `server/src/services/userSessionService.ts`  | Session tracking           |
| sessions.routes.ts  | `server/src/routes/user/sessions.routes.ts`  | Session CRUD               |

### Database

| Tabela                | Opis                                     |
| --------------------- | ---------------------------------------- |
| `users`               | User accounts, password hashes           |
| `refresh_tokens`      | Stored refresh tokens (hashed)           |
| `active_sessions`     | Current user sessions                    |
| `revoked_tokens`      | Blacklisted tokens                       |
| `login_attempts`      | Failed login tracking                    |
| `email_verifications` | Email verification tokens (GAP-AUTH-001) |

## Sequence Diagram

```
┌──────────┐     ┌─────────────┐     ┌──────────────┐     ┌──────────┐
│  Client  │     │    Auth     │     │ RefreshToken │     │ Database │
│          │     │   Routes    │     │   Service    │     │          │
└────┬─────┘     └──────┬──────┘     └──────┬───────┘     └────┬─────┘
     │                  │                   │                  │
     │ POST /login      │                   │                  │
     │─────────────────>│   validate        │                  │
     │                  │───────────────────────credentials───>│
     │                  │<─────────────────────user found      │
     │                  │   generateTokenPair()               │
     │                  │──────────────────>│   CREATE        │
     │                  │                   │─────────token──>│
     │                  │<─────────────────────────────────────│
     │<─────────────────────{accessToken, refreshToken}       │
     │                  │                   │                  │
     │ [Later] Request  │                   │                  │
     │ with Bearer      │                   │                  │
     │─────────────────>│   verifyToken()   │                  │
     │                  │───────check revoked─────────────────>│
     │                  │<────────────────────not revoked      │
     │<───────────────────────authorized                       │
     │                  │                   │                  │
     │ POST /refresh    │                   │                  │
     │─────────────────>│   refreshTokens() │                  │
     │                  │──────────────────>│   ROTATE        │
     │                  │                   │───────────token─>│
     │                  │<─────────────────────new pair        │
     │<──────────────────────{new accessToken, refreshToken}  │
     │                  │                   │                  │
     │ POST /logout     │                   │                  │
     │─────────────────>│   revokeAll()     │                  │
     │                  │──────────────────>│   REVOKE ALL    │
     │                  │                   │───────────all───>│
     │<─────────────────────────success                        │
     │                  │                   │                  │
```

## Integration Points

### 1. Auth → RBAC

- **Type:** Permission Check
- **Status:** ✅ Working
- **Details:** Token includes role, PermissionService checks capabilities

### 2. Auth → Audit Log

- **Type:** Event Logging
- **Status:** ⚠️ Partial
- **Details:** Some auth events logged, but not comprehensive

### 3. Sessions → Security Alerts

- **Type:** Detection
- **Status:** ❌ Missing
- **Details:** Multiple sessions from different locations not flagged

### 4. Auth → Email Service

- **Type:** Notification
- **Status:** ✅ Working (GAP-AUTH-001 implemented)
- **Details:** Email verification implemented

---

## Gap Analysis

### GAP-SECURITY-001: Session invalidation przy password change

| Atrybut              | Wartość                                                     |
| -------------------- | ----------------------------------------------------------- |
| **Priorytet**        | HIGH                                                        |
| **Szacowany effort** | 2h                                                          |
| **Wpływ**            | Security - old sessions remain active after password change |

**Problem:** Gdy użytkownik zmienia hasło, istniejące sesje i refresh tokeny pozostają aktywne. Atakujący z przejętym tokenem nadal ma dostęp.

**Rozwiązanie:**

```typescript
// W auth.routes.ts po zmianie hasła
async function changePassword(userId: string, newPassword: string): Promise<void> {
  // ... update password ...

  // Revoke all existing refresh tokens
  await RefreshTokenService.revokeAllUserTokens(userId, 'password_change');

  // Invalidate all active sessions
  await dbRun(`DELETE FROM active_sessions WHERE user_id = ?`, [userId]);

  // Log security event
  await AuditService.log({
    action: 'password_change_session_revoke',
    userId,
    metadata: { reason: 'password_change' },
  });
}
```

**Pliki do modyfikacji:**

- `server/src/routes/auth.routes.ts` - password change endpoint
- `server/src/services/RefreshTokenService.ts` - ensure revokeAllUserTokens works

---

### GAP-SECURITY-002: Brak comprehensive audit log dla auth events

| Atrybut              | Wartość                        |
| -------------------- | ------------------------------ |
| **Priorytet**        | MEDIUM                         |
| **Szacowany effort** | 3h                             |
| **Wpływ**            | Compliance, security forensics |

**Problem:** Nie wszystkie auth events są logowane:

- Failed login attempts (jest, ale nie detailed)
- Successful logins z device info (partial)
- Token refresh events (missing)
- Session termination (missing)
- MFA events (missing)

**Rozwiązanie:**

```typescript
// server/src/services/authAuditService.ts
interface AuthAuditEvent {
  type:
    | 'login_success'
    | 'login_failure'
    | 'logout'
    | 'token_refresh'
    | 'session_terminate'
    | 'password_change'
    | 'mfa_enable'
    | 'mfa_disable';
  userId?: string;
  email?: string;
  ipAddress: string;
  userAgent: string;
  deviceInfo?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

async function logAuthEvent(event: AuthAuditEvent): Promise<void> {
  await db.run(
    `INSERT INTO auth_audit_log (id, event_type, user_id, email, ip_address, 
         user_agent, device_info, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      uuidv4(),
      event.type,
      event.userId,
      event.email,
      event.ipAddress,
      event.userAgent,
      event.deviceInfo,
      JSON.stringify(event.metadata),
    ]
  );
}
```

**Pliki do modyfikacji:**

- `server/src/services/authAuditService.ts` (NEW)
- `server/src/routes/auth.routes.ts` - add logging calls
- Database migration for `auth_audit_log`

---

### GAP-SECURITY-003: Multi-device session management - brak alertów

| Atrybut              | Wartość                                              |
| -------------------- | ---------------------------------------------------- |
| **Priorytet**        | MEDIUM                                               |
| **Szacowany effort** | 3h                                                   |
| **Wpływ**            | Security - potential account compromise not detected |

**Problem:** System śledzi sesje, ale:

- Nie alertuje przy nowych urządzeniach
- Nie wykrywa logowań z nietypowych lokalizacji
- Brak limitu równoczesnych sesji

**Rozwiązanie:**

```typescript
// server/src/services/sessionSecurityService.ts
async function checkNewSession(
  userId: string,
  device: string,
  ipAddress: string
): Promise<{ isNew: boolean; alert?: string }> {
  // Check if device is known
  const knownDevice = await db.get(
    `SELECT id FROM known_devices WHERE user_id = ? AND device_hash = ?`,
    [userId, hashDevice(device)]
  );

  if (!knownDevice) {
    // Send email alert about new device
    await sendNewDeviceAlert(userId, device, ipAddress);

    // Log new device
    await db.run(
      `INSERT INTO known_devices (id, user_id, device_hash, ip_address, first_seen)
             VALUES (?, ?, ?, ?, datetime('now'))`,
      [uuidv4(), userId, hashDevice(device), ipAddress]
    );

    return { isNew: true, alert: 'new_device_login' };
  }

  return { isNew: false };
}
```

**Pliki do modyfikacji:**

- `server/src/services/sessionSecurityService.ts` (NEW)
- `server/src/routes/auth.routes.ts` - integrate check on login
- Email template for new device alert

---

## Summary

| Kategoria           | Count |
| ------------------- | ----- |
| **Total Gaps**      | 3     |
| **HIGH Priority**   | 1     |
| **MEDIUM Priority** | 2     |
| **LOW Priority**    | 0     |
| **Total Effort**    | ~8h   |

## Security Features Status

| Feature                        | Status | Notes             |
| ------------------------------ | ------ | ----------------- |
| Password hashing (bcrypt)      | ✅     | Implemented       |
| JWT tokens                     | ✅     | Access + Refresh  |
| Token rotation                 | ✅     | On refresh        |
| Token revocation               | ✅     | Blacklist system  |
| Session tracking               | ✅     | Multi-device      |
| Rate limiting                  | ✅     | On auth endpoints |
| MFA support                    | ✅     | TOTP implemented  |
| Email verification             | ✅     | GAP-AUTH-001 done |
| Password change session revoke | ❌     | GAP-SECURITY-001  |
| Comprehensive audit logging    | ⚠️     | GAP-SECURITY-002  |
| New device alerts              | ❌     | GAP-SECURITY-003  |

## Recommendations

1. **Immediate (Security Critical):** GAP-SECURITY-001 - session invalidation on password change
2. **Short-term:** GAP-SECURITY-002 - comprehensive audit logging for compliance
3. **Medium-term:** GAP-SECURITY-003 - new device alerts

## Related Flows

- FLOW-AUTH-001: User Onboarding (initial registration)
- FLOW-TEAM-001: Team & Permissions (RBAC integration)
- FLOW-NOTIFICATION-001: Notification System (security alerts)
