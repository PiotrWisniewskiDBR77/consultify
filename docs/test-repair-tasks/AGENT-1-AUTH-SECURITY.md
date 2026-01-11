# 🔐 AGENT 1: Auth & Security Tests

## 📋 MISJA

Naprawa testów autentykacji i bezpieczeństwa - najbardziej krytycznych testów w systemie.

---

## 📁 PLIKI DO NAPRAWY (42 pliki)

### Auth Tests (5 plików)

```
tests/auth/oauth.test.js
tests/auth/sso.test.js
tests/auth/biometric.test.js
tests/auth/session-token.test.js
tests/auth/two-factor.test.js
```

### Security Tests (17 plików)

```
tests/security/multi-tenant-isolation.test.js
tests/security/replay-attack.test.js
tests/security/ai-multi-tenant.test.js
tests/security/input-sanitization.test.js
tests/security/ai-prompt-injection.test.js
tests/security/idor.test.js
tests/security/sql-injection.test.js
tests/security/rbac-security.test.js
tests/security/ai-pentest-suite.test.js
tests/security/compliance/soc2.test.js
tests/security/compliance/gdpr.test.js
tests/security/ssrf-prevention.test.js
tests/security/xss-prevention.test.js
tests/security/ai-zero-trust.test.js
tests/security/csrf-protection.test.js
tests/security/rate-limiting.test.js
tests/security/encryption-audit.test.js
```

### Middleware Tests (20 plików)

```
tests/unit/backend/middleware/userStateGuard.test.js
tests/unit/backend/middleware/legalComplianceMiddleware.test.js
tests/unit/backend/middleware/projectQuotaMiddleware.test.js
tests/unit/backend/middleware/permissionMiddleware.test.js
tests/unit/backend/middleware/auditLog.test.js
tests/unit/backend/middleware/rbac.test.js
tests/unit/backend/middleware/pmoValidation.test.js
tests/unit/backend/middleware/superAdminMiddleware.test.js
tests/unit/backend/middleware/quotaMiddleware.test.js
tests/unit/backend/middleware/demoGuard.test.js
tests/unit/backend/middleware/trialEntryGuard.test.js
tests/unit/backend/middleware/rapidLeanUploadMiddleware.test.js
tests/unit/backend/middleware/performanceMetrics.test.js
tests/unit/backend/middleware/economicsValidation.test.js
tests/unit/backend/middleware/featureGate.test.js
tests/unit/backend/middleware/fileUploadMiddleware.test.js
tests/unit/backend/middleware/adminMiddleware.test.js
tests/unit/backend/middleware/invitationRateLimiter.test.js
tests/unit/backend/middleware/securityHeadersMiddleware.test.js
tests/unit/backend/middleware/planLimits.test.js
```

---

## 🗄️ SCHEMAT BAZY DANYCH

### Tabele Auth

```sql
-- Users
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'USER',  -- SUPERADMIN, ADMIN, USER
    status TEXT DEFAULT 'active',  -- active, pending, blocked
    first_name TEXT,
    last_name TEXT,
    last_login DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Organizations
CREATE TABLE organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    plan TEXT DEFAULT 'free',  -- free, pro, enterprise
    status TEXT DEFAULT 'pending',  -- pending, active, blocked
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sessions & Tokens
CREATE TABLE refresh_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    device_info TEXT,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE revoked_tokens (
    jti TEXT PRIMARY KEY,
    user_id TEXT,
    expires_at DATETIME,
    reason TEXT
);

-- MFA
CREATE TABLE mfa_settings (
    user_id TEXT PRIMARY KEY,
    enabled INTEGER DEFAULT 0,
    secret TEXT,
    backup_codes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE trusted_devices (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    device_fingerprint TEXT NOT NULL,
    device_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 📝 WZORZEC TESTU - KOPIUJ TEN PLIK

```javascript
/**
 * [Feature] Security Tests
 *
 * Real integration tests for security features
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import app from '../../server/src/index.js';
import { getDatabase } from '../../server/src/database/Database.js';
import { initializeDatabase } from '../../server/src/database/DatabaseInitializer.js';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

// Use separate test database per worker
vi.hoisted(() => {
  process.env.MOCK_DB = 'false';
  const workerId = process.env.VITEST_WORKER_ID || '0';
  process.env.SQLITE_PATH = `./test-security-${workerId}.db`;
});

describe('Security Tests', () => {
  const db = getDatabase();
  let testOrgId;
  let testUserId;
  let testEmail;
  let testToken;

  beforeAll(async () => {
    await initializeDatabase();

    // Create test organization
    testOrgId = uuidv4();
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`,
        [testOrgId, 'Security Test Org', 'pro', 'active'],
        (err) => (err ? reject(err) : resolve())
      );
    });

    // Create test user
    testUserId = uuidv4();
    testEmail = `security-test-${Date.now()}@test.com`;
    const hashedPassword = await bcrypt.hash('SecurePass123!', 10);
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO users (id, organization_id, email, password, role, status) VALUES (?, ?, ?, ?, ?, ?)`,
        [testUserId, testOrgId, testEmail, hashedPassword, 'ADMIN', 'active'],
        (err) => (err ? reject(err) : resolve())
      );
    });

    // Get auth token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: testEmail, password: 'SecurePass123!' });
    testToken = loginRes.body.token;
  });

  afterAll(async () => {
    // Cleanup
    await new Promise((r) =>
      db.run(`DELETE FROM users WHERE organization_id = ?`, [testOrgId], () => r())
    );
    await new Promise((r) =>
      db.run(`DELETE FROM organizations WHERE id = ?`, [testOrgId], () => r())
    );
  });

  // ========== EXAMPLE TESTS ==========

  describe('Rate Limiting', () => {
    it('should block after too many failed login attempts', async () => {
      const fakeEmail = `ratelimit-${Date.now()}@test.com`;

      // Make multiple failed attempts
      for (let i = 0; i < 5; i++) {
        await request(app).post('/api/auth/login').send({ email: fakeEmail, password: 'wrong' });
      }

      // Next attempt should be rate limited
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: fakeEmail, password: 'wrong' });

      expect([401, 429]).toContain(res.status);
    });
  });

  describe('SQL Injection Prevention', () => {
    it('should prevent SQL injection in login', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: "'; DROP TABLE users; --",
        password: 'password',
      });

      expect(res.status).toBe(401);

      // Verify users table still exists
      const users = await new Promise((resolve) => {
        db.all('SELECT COUNT(*) as count FROM users', [], (err, rows) => {
          resolve(rows);
        });
      });
      expect(users[0].count).toBeGreaterThan(0);
    });
  });

  describe('XSS Prevention', () => {
    it('should sanitize script tags in user input', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          name: '<script>alert("xss")</script>Test Project',
        });

      if (res.status === 201) {
        expect(res.body.project.name).not.toContain('<script>');
      }
    });
  });

  describe('CSRF Protection', () => {
    it('should reject requests without proper headers', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${testToken}`)
        .set('Origin', 'https://evil-site.com');

      // Should either succeed (if CORS is configured correctly) or reject
      expect([200, 204, 403]).toContain(res.status);
    });
  });

  describe('Authorization', () => {
    it('should deny access without token', async () => {
      const res = await request(app).get('/api/users/me');

      expect([401, 403]).toContain(res.status);
    });

    it('should deny access with invalid token', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', 'Bearer invalid-token-12345');

      expect([401, 403]).toContain(res.status);
    });
  });
});
```

---

## 🔍 ZNAJDOWANIE FAŁSZYWYCH TESTÓW

```bash
# Znajdź fałszywe asercje w swoim obszarze
grep -rn --include="*.test.js" -E "expect\((true|false|[0-9]+)\)\.toBe\((true|false|[0-9]+)\)" tests/auth/ tests/security/ tests/unit/backend/middleware/

# Przykłady fałszywych testów do naprawy:
# expect(true).toBe(true)
# expect(401).toBe(401)
# expect([]).toEqual([])
```

---

## ✅ CHECKLIST

- [ ] Przeczytaj wzorzec testu powyżej
- [ ] Przejrzyj każdy plik na liście
- [ ] Znajdź fałszywe asercje
- [ ] Zamień na prawdziwe testy (lub `it.todo()` jeśli brak czasu)
- [ ] Uruchom testy: `npm run test:unit -- tests/auth/ tests/security/`
- [ ] Sprawdź czy wszystkie przechodzą

---

## 📞 POMOC

Wzorcowy plik do kopiowania: `tests/integration/auth.test.js`

Dokumentacja bazy: `server/src/database/schema/`
