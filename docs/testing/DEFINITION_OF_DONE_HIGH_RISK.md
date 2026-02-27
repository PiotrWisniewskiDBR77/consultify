# Definition of Done — High-Risk Areas

| Field | Value |
|-------|-------|
| Effective date | 2026-02-26 |
| Applies to | All PRs touching files in high-risk areas |
| Enforced by | Code review policy + CI gate (planned) |
| Related | [Testing Maturity Model](TESTING_MATURITY_MODEL.md) · [Security Integrity Gate](../../scripts/security/verify-security-integrity.ts) |

---

## What are High-Risk Areas?

High-risk areas are code paths where a defect has **disproportionate business or security impact**: data breach, financial loss, compliance violation, or complete service unavailability.

| Area | Path patterns | Risk type |
|------|---------------|-----------|
| **Authentication** | `server/src/middleware/auth.*`, `server/src/routes/auth.*`, `server/src/routes/mfa.*`, `server/src/routes/sso.*` | Security, compliance |
| **Authorization** | `server/src/middleware/permission.*`, `server/src/services/accessPolicy*`, `server/src/routes/access-control.*` | Security, data access |
| **Billing & Payments** | `server/src/routes/billing.*`, `server/src/routes/pricing.*`, `server/src/services/billing/` | Financial |
| **Encryption** | `server/src/services/encryption/`, `server/src/utils/security.*` | Security, compliance |
| **CSRF / Input Sanitization** | `server/src/middleware/csrf.*`, `server/src/middleware/inputSanitization.*` | Security |
| **Session Management** | `server/src/middleware/rateLimitUserId.*`, `server/src/middleware/resourceQuota.*` | Security, availability |

---

## Definition of Done Checklist

When a PR modifies files in any high-risk area, the following **must** be true before merge:

### 1. Positive tests (happy path)

- [ ] Unit tests cover the changed logic (patch coverage ≥ 80%)
- [ ] At least one integration test exercises the full request/response cycle
- [ ] If UI is affected: component test verifies render + interaction

### 2. Negative tests (adversarial / edge cases)

- [ ] **Auth changes**: test with invalid/expired/missing token → expect 401
- [ ] **Permission changes**: test with insufficient role → expect 403
- [ ] **Billing changes**: test with invalid payment data, partial payment, webhook replay → expect graceful handling
- [ ] **Encryption changes**: test with corrupted/tampered data → expect rejection
- [ ] **CSRF changes**: test without CSRF token → expect 403
- [ ] **Input sanitization**: test with XSS payload, SQL injection attempt → expect sanitized output

### 3. Security verification

- [ ] Security integrity gate passes (29/29 checks)
- [ ] No new security-sensitive patterns introduced without review (hardcoded tokens, static secrets, mock routes in production)
- [ ] `npm audit` gate passes (no high/critical CVE)

### 4. Coverage thresholds

- [ ] L1 coverage gate passes (95% per-file on security middleware)
- [ ] Patch coverage ≥ 80% on all changed files
- [ ] If new middleware: added to `vitest.l1.config.ts` threshold list

### 5. Documentation

- [ ] If behavior changes: API docs or inline JSDoc updated
- [ ] If new auth flow: documented in `docs/flows/security/`

---

## Enforcement

### Currently automated

| Check | Gate | Blocks merge? |
|-------|------|---------------|
| Security integrity (29 checks) | `security-integrity` job | ✅ Yes |
| L1 coverage (95% per-file) | `levels-coverage-gates` job | ✅ Yes |
| Patch coverage (80%) | `patch-coverage` job | ✅ Yes |
| Anti-placeholder | `quality-check` job | ✅ Yes |
| npm audit | `security-integrity` job | ✅ Yes |

### Enforced via code review

| Check | Reviewer responsibility |
|-------|------------------------|
| Negative test cases exist | Reviewer verifies before approval |
| Test covers edge cases | Reviewer checks test quality |
| No security anti-patterns | Reviewer + CODEOWNERS |

### Planned automation (Faza 4)

- CI label detection: PRs touching high-risk paths get `high-risk` label automatically
- Mandatory 2nd reviewer for `high-risk` labeled PRs
- Negative test presence check (grep for 401/403/rejection patterns in test files touching the changed area)

---

## Module-Specific Requirements

### Authentication (`auth/`)

| Requirement | Type |
|-------------|------|
| Test login with valid credentials → success | Positive |
| Test login with invalid password → 401 | Negative |
| Test login with expired token → 401 | Negative |
| Test login with missing token → 401 | Negative |
| Test MFA challenge with wrong code → 403 | Negative |
| Test session expiry handling | Edge case |
| Test concurrent session limits | Edge case |

### Billing (`billing/`)

| Requirement | Type |
|-------------|------|
| Test successful payment flow | Positive |
| Test payment with invalid card → graceful error | Negative |
| Test Stripe webhook signature verification | Security |
| Test webhook replay (duplicate event ID) | Edge case |
| Test partial refund flow | Edge case |
| Test subscription upgrade/downgrade | Positive |
| Test billing with expired subscription → 403 | Negative |

### Permissions (`permission/`)

| Requirement | Type |
|-------------|------|
| Test access with correct role → success | Positive |
| Test access with insufficient role → 403 | Negative |
| Test access with no role → 403 | Negative |
| Test role escalation attempt → 403 | Security |
| Test cross-organization access → 403 | Security |
| Test RBAC matrix (role × resource × action) | Comprehensive |

---

## Quality Scorecard Impact

Modules tracked in the quality scorecard receive point deductions if:
- Critical-risk module has no dedicated security tests (−10 points)
- Critical-risk module has no negative test cases (−10 points)

Current scorecard status:
- **Auth & Security**: Grade A (100/100) ✅
- **Billing & Payments**: Grade D (35/100) — needs dedicated security tests + more coverage

---

*This policy is reviewed quarterly. Exceptions require Engineering Lead approval and are tracked in the skip-allowlist with TTL.*
